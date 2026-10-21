"""Narration with Alibaba Cloud Model Studio (百炼) speech synthesis: qwen-audio-3.0-tts-plus.

    python tts/qwen.py --lang zh
    python tts/qwen.py --lang en [--only q1 a1]

The API key comes from QWEN_TTS_API_KEY / DASHSCOPE_API_KEY or windmill-theorem/.env (git-ignored).
Writes the same files as tts/synth.py, so the animation and assembly steps don't care which engine
made them: build/audio/<lang>/<line_id>.wav (48 kHz mono) and build/audio/<lang>/manifest.json
    {line_id: {"dur", "sents": [[start, end], ...], "spk", "words": [[[text, start, end], ...], ...],
               "norm": [...], "hash"}}
"words" are the engine's word timestamps (seconds from the start of the line); subtitles.py uses
them to time the subtitle chunks inside a sentence.  "norm" is the text the engine actually read
after expanding numbers and symbols; check_voice.py compares it with speech recognition.

Each sentence is synthesized separately, so sentence starts are exact; a line whose text, voice
and settings are unchanged is reused from the cache.
"""
import argparse
import base64
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from content.script import lines_for, sentences, spoken  # noqa: E402

SR = 48000
GAP = {"zh": 0.28, "en": 0.40}           # pause between sentences of one line
MODEL = "qwen-audio-3.0-tts-plus"
# (voice, speech rate).  zh: 龙安鲁风, a system voice of the plus model.  en: base voices of the plus
# model (Adrian Gao, calm narration; Ivy Hu, a confident older examiner; Nora Hu, a lively student).
VOICES = {
    "zh": {"narrator": ("longanlufeng", 0.95)},
    "en": {"narrator": ("qwen-audio-3.0-tts-plus-loongadriangao", 1.0),
           "interviewer": ("qwen-audio-3.0-tts-plus-loongivyhu", 1.0),
           "candidate": ("qwen-audio-3.0-tts-plus-loongnorahu", 0.92)},
}
# Polyphonic characters, pinned with the engine's hot_fix (only toned syllables: neutral-tone
# syllables such as "le5" are read as other characters).
PINYIN = {
    "模": "mo2",                # 模四余一, 模长, 模拟面试
    "只差": "zhi3 cha4",
    "差距": "cha1 ju4",
    "凹角处": "ao1 jiao3 chu4",
    "两处": "liang3 chu4",
    "长什": "zhang3 shen2",
    "卡住": "qia3 zhu4",
    "转起": "zhuan4 qi3",
    "数一数": "shu3 yi1 shu3",
}


def load_env():
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def api_key():
    load_env()
    key = os.environ.get("QWEN_TTS_API_KEY") or os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        sys.exit("QWEN_TTS_API_KEY is not set (environment variable or windmill-theorem/.env)")
    return key


BASE = os.environ.get("QWEN_TTS_BASE_URL", "https://dashscope.aliyuncs.com").rstrip("/")


def synth(text, voice, rate, lang, key, tries=5):
    """One sentence -> (float32 samples at SR, [[word, start, end], ...], normalized text).

    Uses the SpeechSynthesizer streaming endpoint: audio arrives base64-encoded inside the SSE
    events, so nothing has to be downloaded from OSS afterwards.
    """
    params = {"voice": voice, "format": "pcm", "sample_rate": SR, "rate": rate,
              "language_hints": [lang], "word_timestamp_enabled": True}
    fix = [{w: py} for w, py in PINYIN.items() if w in text] if lang == "zh" else []
    if fix:
        params["hot_fix"] = {"pronunciation": fix}
    body = {"model": MODEL, "input": {"text": text}, "parameters": params}
    err = None
    for k in range(tries):
        try:
            r = requests.post(f"{BASE}/api/v1/services/audio/tts/SpeechSynthesizer", json=body, stream=True,
                              timeout=180, headers={"Authorization": f"Bearer {key}", "X-DashScope-SSE": "enable"})
            if r.status_code != 200 and r.status_code not in (429, 500, 502, 503, 504):
                sys.exit(f"speech API returned {r.status_code}: {r.text[:400]}")
            pcm, words, begun, norm, err = b"", {}, {}, None, None
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
                begun.setdefault(idx, len(pcm) / 2 / SR)   # audio already received when it starts
                if sent.get("words"):                 # cumulative list per engine sentence
                    words[idx] = sent["words"]
                if (out.get("audio") or {}).get("data"):
                    pcm += base64.b64decode(out["audio"]["data"])
            if pcm and not err:
                if pcm[:4] == b"RIFF":
                    pcm = pcm[44:]
                x = np.frombuffer(pcm[: len(pcm) // 2 * 2], "<i2").astype(np.float32) / 32768
                ws = []
                for i in sorted(words):
                    # times are counted from the start of the audio; should an engine sentence
                    # restart its clock, shift it by the audio received before it began
                    off = begun.get(i, 0.0) if ws and words[i][0]["begin_time"] / 1000 < ws[-1][2] - 0.05 else 0.0
                    ws += [[w["text"], w["begin_time"] / 1000 + off, w["end_time"] / 1000 + off] for w in words[i]]
                return x, ws, norm
        except requests.RequestException as e:
            err = str(e)
        print(f"  retry {k + 1}: {json.dumps(err, ensure_ascii=False)[:300] if err else 'no audio'}")
        time.sleep(2 ** (k + 1))
    sys.exit(f"speech synthesis failed: {text}")


def trim(x, ws, thr=0.012, keep=0.04):
    """Cut leading/trailing silence; shift the word times by the same amount."""
    a = np.abs(x)
    idx = np.where(a > thr * max(1e-9, a.max()))[0]
    if len(idx) == 0:
        return x, ws
    k = int(keep * SR)
    i0, i1 = max(0, idx[0] - k), min(len(x), idx[-1] + k)
    d = i0 / SR
    return x[i0:i1], [[t, max(0.0, s - d), max(0.0, e - d)] for t, s, e in ws]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, choices=["zh", "en"])
    ap.add_argument("--only", nargs="*", default=None, help="line ids to (re)synthesize")
    ap.add_argument("--force", action="store_true", help="ignore the cache")
    a = ap.parse_args()
    import soundfile as sf
    key = api_key()
    out = ROOT / "build" / "audio" / a.lang
    out.mkdir(parents=True, exist_ok=True)
    man_p = out / "manifest.json"
    manifest = json.loads(man_p.read_text(encoding="utf-8")) if man_p.exists() else {}
    for line in lines_for(a.lang):
        if a.only and line.id not in a.only:
            continue
        voice, rate = VOICES[a.lang].get(line.spk, VOICES[a.lang]["narrator"])
        texts = [spoken(t) for t, _ in sentences(line, a.lang)]
        h = hashlib.sha1(json.dumps([MODEL, voice, rate, texts, sorted(PINYIN.items())],
                                    ensure_ascii=False).encode()).hexdigest()[:12]
        if not a.force and manifest.get(line.id, {}).get("hash") == h and (out / f"{line.id}.wav").exists():
            continue
        pieces, sents, words, norms, t = [], [], [], [], 0.0
        for k, txt in enumerate(texts):
            x, ws, norm = synth(txt, voice, rate, a.lang, key)
            x, ws = trim(x, ws)
            if k:
                pieces.append(np.zeros(int(GAP[a.lang] * SR), np.float32))
                t += GAP[a.lang]
            pieces.append(x)
            sents.append([round(t, 3), round(t + len(x) / SR, 3)])
            words.append([[w, round(t + s, 3), round(t + e, 3)] for w, s, e in ws])
            norms.append(norm)
            t += len(x) / SR
        y = np.concatenate(pieces)
        y = y * (0.1 / (np.sqrt(np.mean(y ** 2)) + 1e-9))      # about -20 dBFS RMS
        peak = np.abs(y).max()
        if peak > 0.95:
            y *= 0.95 / peak
        sf.write(out / f"{line.id}.wav", y, SR, subtype="PCM_16")
        manifest[line.id] = {"dur": round(len(y) / SR, 3), "sents": sents, "spk": line.spk,
                             "words": words, "norm": norms, "hash": h}
        print(f"{line.id:8s} {len(y) / SR:6.2f}s  {len(sents)} sentence(s)  [{voice.split('-')[-1]}]")
        man_p.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    keep = {ln.id for ln in lines_for(a.lang)}
    for k in [k for k in manifest if k not in keep]:
        del manifest[k]
    man_p.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(v["dur"] for v in manifest.values())
    print(f"total narration {total / 60:.1f} min -> {man_p}")


if __name__ == "__main__":
    main()
