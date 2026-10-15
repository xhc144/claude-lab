"""逐句合成配音：python tts.py [--check]

输出 build/voice/<键>.wav（24 kHz 单声道）和 build/voice/durations.json。
配音文字不变的句子直接复用缓存。--check 用 SenseVoice 把配音识别回文字，列出字错率高的句子。
"""
import hashlib, json, os, re, sys, difflib
import numpy as np
import soundfile as sf
import sherpa_onnx
from narration import all_lines

MODELS = os.environ.get("TTS_MODELS", os.path.join(os.path.dirname(__file__), "..", "build", "models"))
OUT = os.path.join(os.path.dirname(__file__), "..", "build", "voice")
SID, SPEED = 20, 0.97
# 词典里读错的多音字：方差读 fāngchā，“差”在本片多指差值读 chā，“晃”读 huàng，都柏林读 dū
LEX_FIX = {"差": "ㄔ ㄚ 1", "方差": "ㄈ ㄤ 1 ㄔ ㄚ 1", "晃": "ㄏ 王 4", "都柏林": "ㄉ ㄨ 1 ㄅ ㄛ 2 ㄌ 阴 2"}


def patched_lexicon(d):
    out = os.path.join(OUT, "lexicon-zh.txt")
    os.makedirs(OUT, exist_ok=True)
    with open(f"{d}/lexicon-zh.txt", encoding="utf-8") as f, open(out, "w", encoding="utf-8") as g:
        for line in f:
            w = line.split(" ", 1)[0]
            g.write(f"{w} {LEX_FIX[w]}\n" if w in LEX_FIX else line)
    return out


def engine():
    d = f"{MODELS}/kokoro-multi-lang-v1_1"
    k = sherpa_onnx.OfflineTtsKokoroModelConfig(
        model=f"{d}/model.onnx", voices=f"{d}/voices.bin", tokens=f"{d}/tokens.txt",
        data_dir=f"{d}/espeak-ng-data", dict_dir=f"{d}/dict",
        lexicon=f"{d}/lexicon-us-en.txt,{patched_lexicon(d)}")
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(kokoro=k, num_threads=4),
        rule_fsts=f"{d}/date-zh.fst,{d}/phone-zh.fst,{d}/number-zh.fst")
    return sherpa_onnx.OfflineTts(cfg)


def trim(w, sr, thr=0.008, pad=0.04):
    idx = np.where(np.abs(w) > thr)[0]
    if len(idx) == 0:
        return w
    a = max(0, idx[0] - int(pad * sr)); b = min(len(w), idx[-1] + int(pad * sr))
    out = w[a:b].copy()
    f = int(0.01 * sr)
    out[:f] *= np.linspace(0, 1, f); out[-f:] *= np.linspace(1, 0, f)
    return out


def build():
    os.makedirs(OUT, exist_ok=True)
    meta_path = f"{OUT}/durations.json"
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    tts = None
    for scene, key, sub, say in all_lines():
        h = hashlib.sha1(f"{SID}|{SPEED}|{sorted(LEX_FIX.items())}|{say}".encode()).hexdigest()[:12]
        wav = f"{OUT}/{key}.wav"
        if key in meta and meta[key].get("hash") == h and os.path.exists(wav):
            continue
        tts = tts or engine()
        a = tts.generate(say, sid=SID, speed=SPEED)
        w = trim(np.asarray(a.samples, dtype=np.float32), a.sample_rate)
        w = w / max(1e-6, np.abs(w).max()) * 0.89
        sf.write(wav, w, a.sample_rate)
        meta[key] = {"scene": scene, "sub": sub, "say": say, "hash": h, "dur": round(len(w) / a.sample_rate, 3)}
        print(f"{key} {meta[key]['dur']:5.2f}s {sub}")
    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, indent=1)
    tot = sum(m["dur"] for m in meta.values())
    print(f"{len(meta)} 句，配音合计 {tot/60:.1f} 分钟")


def check(limit=0.08):
    import scipy.signal as ss
    d = f"{MODELS}/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"
    rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=f"{d}/model.int8.onnx", tokens=f"{d}/tokens.txt", language="zh", use_itn=False, num_threads=4)
    meta = json.load(open(f"{OUT}/durations.json"))
    norm = lambda x: re.sub(r"[^\w]", "", x).lower()
    for key, m in meta.items():
        w, sr = sf.read(f"{OUT}/{key}.wav", dtype="float32")
        s = rec.create_stream(); s.accept_waveform(16000, ss.resample_poly(w, 16000, sr).astype(np.float32))
        rec.decode_stream(s)
        got = s.result.text
        c = 1 - difflib.SequenceMatcher(None, norm(m["say"]), norm(got)).ratio()
        if c > limit:
            print(f"{key} cer={c:.2f}\n   要读：{m['say']}\n   听到：{got}")


if __name__ == "__main__":
    check() if "--check" in sys.argv else build()
