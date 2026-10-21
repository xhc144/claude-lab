"""逐句合成配音：python tts.py [--estimate]

用通义千问语音合成接口（默认模型 qwen-audio-3.0-tts-plus，音色龙安灵心）合成每句旁白，
输出 build/voice/<键>.wav（24 kHz 单声道）和 build/voice/durations.json。
配音文字、音色、模型、语速都没变的句子直接复用缓存。
durations.json 里的 norm 是接口实际朗读的文字（数字、符号展开之后），check.py 用它和语音识别结果核对。

配置（环境变量，或写在项目根目录的 .env 里；.env 已被 .gitignore 排除，不要提交密钥）：
  QWEN_TTS_API_KEY    必填（也认 DASHSCOPE_API_KEY）
  QWEN_TTS_MODEL      默认 qwen-audio-3.0-tts-plus
  QWEN_TTS_VOICE      默认 longanlingxin（龙安灵心，plus 的系统音色）
  QWEN_TTS_RATE       语速，默认 0.95
  QWEN_TTS_BASE_URL   默认 https://dashscope.aliyuncs.com
  QWEN_TTS_PROTOCOL   speech（百炼 SpeechSynthesizer 流式接口，默认，Qwen-Audio-TTS 与 CosyVoice 用它）、
                      dashscope（多模态生成接口，qwen3-tts-flash 等）或 openai（/v1/audio/speech 兼容接口）

--estimate 不调接口，按字数估计每句时长，只用于在拿到配音前预览画面节奏；
估计值在 durations.json 里标 "estimate": true，assemble.py 遇到它会拒绝出成片。
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time

import numpy as np
import requests
import soundfile as sf

from narration import PINYIN, all_lines

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "build", "voice")
SR = 24000


def load_env():
    path = os.path.join(ROOT, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def settings():
    load_env()
    key = os.environ.get("QWEN_TTS_API_KEY") or os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        sys.exit("缺少 QWEN_TTS_API_KEY：在环境变量或 linear-regression-video/.env 里设置")
    return {
        "key": key,
        "model": os.environ.get("QWEN_TTS_MODEL", "qwen-audio-3.0-tts-plus"),
        "voice": os.environ.get("QWEN_TTS_VOICE", "longanlingxin"),
        "rate": float(os.environ.get("QWEN_TTS_RATE", "0.95")),
        "base": os.environ.get("QWEN_TTS_BASE_URL", "https://dashscope.aliyuncs.com").rstrip("/"),
        "protocol": os.environ.get("QWEN_TTS_PROTOCOL", "speech"),
    }


def _post(url, cfg, body, tries=5, headers=None, stream=False):
    for k in range(tries):
        try:
            r = requests.post(url, json=body, timeout=120, stream=stream,
                              headers={"Authorization": f"Bearer {cfg['key']}", "Content-Type": "application/json",
                                       **(headers or {})})
            if r.status_code == 200:
                return r
            # 限流和服务端错误重试，其他错误（鉴权、参数）直接报出
            if r.status_code not in (429, 500, 502, 503, 504):
                sys.exit(f"语音接口返回 {r.status_code}：{r.text[:500]}")
        except requests.exceptions.ProxyError as e:
            host = url.split("/")[2]
            sys.exit(f"连不上 {host}：网络代理拒绝了这个域名（{e.__class__.__name__}）。"
                     f"把 {host} 加入运行环境允许访问的域名后重试。")
        except requests.RequestException as e:
            if k == tries - 1:
                raise
            print("  网络错误，重试：", e)
        time.sleep(2 ** (k + 1))
    sys.exit(f"语音接口多次失败：{url}")


def synth_speech(text, cfg):
    """SpeechSynthesizer 流式接口：音频以 base64 分块直接放在 SSE 事件里，不需要再去 OSS 下载。

    返回 (24 kHz 16 位 PCM 字节, 接口展开后的朗读文字, 逐字时间戳 [[字, 起, 止], ...]（秒）)。PINYIN 里出现在本句的词按给定拼音读，
    用来固定多音字（残差的“差”、标准差的“差”、得先的“得”……）。
    """
    fix = [{w: py} for w, py in PINYIN.items() if w in text]
    params = {"voice": cfg["voice"], "format": "pcm", "sample_rate": SR, "rate": cfg["rate"], "language_hints": ["zh"],
              "word_timestamp_enabled": True}
    if fix:
        params["hot_fix"] = {"pronunciation": fix}
    body = {"model": cfg["model"], "input": {"text": text}, "parameters": params}
    for k in range(4):
        r = _post(f"{cfg['base']}/api/v1/services/audio/tts/SpeechSynthesizer", cfg, body,
                  headers={"X-DashScope-SSE": "enable"}, stream=True)
        pcm, norm, err, words, begun = b"", None, None, {}, {}
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data:"):
                continue
            ev = json.loads(raw[5:])
            if "output" not in ev:
                err = ev
                break
            out = ev["output"]
            norm = out.get("normalized_text") or norm
            sent = out.get("sentence") or {}
            idx = sent.get("index", 0)
            begun.setdefault(idx, len(pcm) / 2 / SR)
            if sent.get("words"):           # 每个分句给出累积的逐字列表
                words[idx] = sent["words"]
            if (out.get("audio") or {}).get("data"):
                pcm += base64.b64decode(out["audio"]["data"])
        if pcm and not err:
            if pcm[:4] == b"RIFF":          # 个别情况下首块带 wav 头
                pcm = pcm[44:]
            ws = []
            for i in sorted(words):
                # 时间从整段音频开头算；万一某个分句从零重新计时，就加上它开始前已收到的音频长度
                off = begun.get(i, 0.0) if ws and words[i][0]["begin_time"] / 1000 < ws[-1][2] - 0.05 else 0.0
                ws += [[w["text"], w["begin_time"] / 1000 + off, w["end_time"] / 1000 + off] for w in words[i]]
            return pcm, norm, ws
        print("  流式合成中断，重试：", json.dumps(err, ensure_ascii=False)[:300] if err else "没有音频")
        time.sleep(2 ** (k + 1))
    sys.exit(f"语音合成多次失败：{text}")


def synth_dashscope(text, cfg):
    url = f"{cfg['base']}/api/v1/services/aigc/multimodal-generation/generation"
    body = {"model": cfg["model"], "input": {"text": text, "voice": cfg["voice"], "language_type": "Chinese"}}
    out = _post(url, cfg, body).json().get("output", {})
    audio = out.get("audio") or {}
    if audio.get("data"):
        return base64.b64decode(audio["data"])
    if audio.get("url"):
        r = requests.get(audio["url"], timeout=120)
        r.raise_for_status()
        return r.content
    sys.exit(f"接口没有返回音频：{json.dumps(out, ensure_ascii=False)[:500]}")


def synth_openai(text, cfg):
    base = cfg["base"] if cfg["base"].endswith("/v1") else cfg["base"] + "/v1"
    body = {"model": cfg["model"], "input": text, "voice": cfg["voice"], "response_format": "wav"}
    return _post(f"{base}/audio/speech", cfg, body).content


def decode(blob):
    """接口可能给 wav、mp3 或 pcm 封装，一律交给 ffmpeg 转成 24 kHz 单声道。"""
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "in"), os.path.join(d, "out.wav")
        open(src, "wb").write(blob)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", str(SR), dst], check=True)
        w, _ = sf.read(dst, dtype="float32")
    return w


def trim(w, sr=SR, thr=0.008, pad=0.05):
    idx = np.where(np.abs(w) > thr)[0]
    if len(idx) == 0:
        return w, 0.0
    a = max(0, idx[0] - int(pad * sr)); b = min(len(w), idx[-1] + int(pad * sr))
    out = w[a:b].copy()
    f = int(0.01 * sr)
    out[:f] *= np.linspace(0, 1, f); out[-f:] *= np.linspace(1, 0, f)
    return out, a / sr


def build():
    cfg = settings()
    synth = {"openai": synth_openai, "dashscope": synth_dashscope}.get(cfg["protocol"])
    os.makedirs(OUT, exist_ok=True)
    meta_path = os.path.join(OUT, "durations.json")
    meta = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
    for scene, key, sub, say in all_lines():
        fix = sorted(f"{w}={py}" for w, py in PINYIN.items() if w in say)
        h = hashlib.sha1(f"{cfg['model']}|{cfg['voice']}|{cfg['rate']}|{say}|{fix}".encode()).hexdigest()[:12]
        wav = os.path.join(OUT, f"{key}.wav")
        if key in meta and meta[key].get("hash") == h and "words" in meta[key] and os.path.exists(wav):
            meta[key]["sub"] = sub          # 只改字幕不改配音时，不重新合成
            continue
        norm, words = None, []
        if synth is None:
            pcm, norm, words = synth_speech(say, cfg)
            w = np.frombuffer(pcm[: len(pcm) // 2 * 2], "<i2").astype(np.float32) / 32768
        else:
            w = decode(synth(say, cfg))
        w, cut = trim(w)
        words = [[c, round(max(0.0, a - cut), 3), round(max(0.0, b - cut), 3)] for c, a, b in words]
        w = w / max(1e-6, np.abs(w).max()) * 0.89
        sf.write(wav, w, SR)
        meta[key] = {"scene": scene, "sub": sub, "say": say, "norm": norm, "hash": h, "dur": round(len(w) / SR, 3),
                     "words": words}
        print(f"{key} {meta[key]['dur']:5.2f}s {sub}")
        json.dump(meta, open(meta_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(meta, open(meta_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    tot = sum(m["dur"] for m in meta.values())
    print(f"{len(meta)} 句，配音合计 {tot / 60:.1f} 分钟")


def estimate(rate=4.4):
    """按每秒约 4.4 个字估计时长，只为预览节奏。"""
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for scene, key, sub, say in all_lines():
        meta[key] = {"scene": scene, "sub": sub, "say": say, "dur": round(0.4 + len(say) / rate, 3), "estimate": True}
    json.dump(meta, open(os.path.join(OUT, "durations.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"已写入估计时长，合计 {sum(m['dur'] for m in meta.values()) / 60:.1f} 分钟")


if __name__ == "__main__":
    estimate() if "--estimate" in sys.argv else build()
