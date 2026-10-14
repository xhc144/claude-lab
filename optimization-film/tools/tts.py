"""把 narration.py 的每段旁白合成为 build/audio/<段落编号>.wav，并记录时长。

    python tools/tts.py            # 只合成文本有变化的段落
    python tools/tts.py --force    # 全部重新合成
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import sherpa_onnx
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from narration import SCENES  # noqa: E402

MODELS = ROOT / "build" / "models"
OUT = ROOT / "build" / "audio"
SPEED = 0.92          # 略慢于默认语速，讲解更从容
SR_OUT = 48000


# 模型词典里读错的多音字与词。字的默认读音按本片的用法改写（"步长""边长"的长、
# "稳稳地"的地、"剪得"的得……），词条同时加进分词词典，保证整词被切出来。
PRON_CHARS = {"长": "chang2", "弹": "tan2", "地": "de", "得": "de", "切": "qie1"}
PRON_WORDS = {"曲率": "qu1 lv4", "乘子": "cheng2 zi3", "得到": "de2 dao4", "步长": "bu4 chang2",
              "边长": "bian1 chang2", "狭长": "xia2 chang2", "切线": "qie1 xian4", "相切": "xiang1 qie1"}
# 音译人名按惯例读音替换成同音字，只影响合成，不影响字幕
SAY_AS = {"卡鲁什": "卡鲁石", "；": "，"}


def patched_model_files(m):
    """在 build/models/patched 下生成改过的词典副本，原模型文件保持不动。"""
    out = MODELS / "patched"
    lex = out / "lexicon.txt"
    if lex.exists():
        return lex, out / "dict"
    shutil.copytree(m / "dict", out / "dict")
    keep = [ln for ln in (m / "lexicon.txt").read_text().splitlines()
            if ln.split(" ", 1)[0] not in PRON_CHARS and ln.split(" ", 1)[0] not in PRON_WORDS]
    extra = [f"{w} {p}" for w, p in {**PRON_CHARS, **PRON_WORDS}.items()]
    lex.write_text("\n".join(extra + keep) + "\n")
    with open(out / "dict" / "user.dict.utf8", "a") as f:
        f.write("".join(f"{w} 100000 n\n" for w in PRON_WORDS))
    return lex, out / "dict"


def make_tts():
    m = MODELS / "matcha-icefall-zh-baker"
    lexicon, dict_dir = patched_model_files(m)
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            matcha=sherpa_onnx.OfflineTtsMatchaModelConfig(
                acoustic_model=str(m / "model-steps-3.onnx"),
                vocoder=str(MODELS / "vocos-22khz-univ.onnx"),
                lexicon=str(lexicon),
                tokens=str(m / "tokens.txt"),
                dict_dir=str(dict_dir),
            ),
            num_threads=4,
        ),
        rule_fsts=",".join(str(m / f) for f in ("phone.fst", "date.fst", "number.fst")),
        max_num_sentences=1,
    )
    return sherpa_onnx.OfflineTts(cfg)


def polish(x, sr):
    """去掉首尾静音，统一响度，加极短的淡入淡出，重采样到 48 kHz。"""
    env = np.abs(x)
    thr = 0.02 * env.max()
    idx = np.where(env > thr)[0]
    a, b = max(idx[0] - int(0.03 * sr), 0), min(idx[-1] + int(0.12 * sr), len(x))
    x = x[a:b]
    x = resample_poly(x, SR_OUT, sr).astype(np.float32)
    rms = np.sqrt(np.mean(x ** 2) + 1e-12)
    x *= 0.08 / rms                          # 约 -22 dBFS RMS
    peak = np.abs(x).max()
    if peak > 0.89:
        x *= 0.89 / peak
    f = int(0.01 * SR_OUT)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def main():
    force = "--force" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    meta_path = OUT / "durations.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() and not force else {}
    tts = None
    for scene, segs in SCENES.items():
        for sid, text in segs:
            h = hashlib.sha1(f"{SPEED}|{PRON_CHARS}|{PRON_WORDS}|{SAY_AS}|{text}".encode()).hexdigest()[:12]
            wav = OUT / f"{sid}.wav"
            if meta.get(sid, {}).get("hash") == h and wav.exists():
                continue
            tts = tts or make_tts()
            say = text
            for a, b in SAY_AS.items():
                say = say.replace(a, b)
            audio = tts.generate(say, sid=0, speed=SPEED)
            x = polish(np.asarray(audio.samples, dtype=np.float32), audio.sample_rate)
            sf.write(wav, x, SR_OUT, subtype="PCM_16")
            meta[sid] = {"hash": h, "duration": round(len(x) / SR_OUT, 3), "text": text, "scene": scene}
            print(f"{sid}  {meta[sid]['duration']:6.2f}s  {text[:24]}…", flush=True)
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    total = sum(v["duration"] for v in meta.values())
    print(f"total narration {total / 60:.1f} min")


if __name__ == "__main__":
    main()
