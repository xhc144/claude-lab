"""Synthesize narration for both language versions with sherpa-onnx + Kokoro.

Each sentence is synthesized separately (cached by text/voice/speed), trimmed and
joined with short pauses. Output per language:
    audio/<lang>/<segment>.wav     narration for one segment
    audio/<lang>/timing.json      duration + sentence offsets for every segment

Usage:  python tts/synth.py [zh|en ...]
Models: FW_MODEL_DIR (default ./models) must contain kokoro-multi-lang-v1_0/ and
        kokoro-multi-lang-v1_1/ from the sherpa-onnx tts-models release.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "build"))
import scriptlib as SL  # noqa: E402

ROOT = SL.ROOT
MODEL_DIR = Path(os.environ.get("FW_MODEL_DIR", ROOT / "models"))
CACHE = ROOT / "cache" / "tts"
AUDIO = ROOT / "audio"
SR = 24000
GAP = {"zh": 0.30, "en": 0.55}       # pause between sentences, by text language
MODELS = {"kokoro10": "kokoro-multi-lang-v1_0", "kokoro11": "kokoro-multi-lang-v1_1"}

_engines = {}


def engine(name: str):
    if name not in _engines:
        import sherpa_onnx
        d = MODEL_DIR / MODELS[name]
        cfg = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                    model=str(d / "model.onnx"), voices=str(d / "voices.bin"),
                    tokens=str(d / "tokens.txt"), data_dir=str(d / "espeak-ng-data"),
                    dict_dir=str(d / "dict"),
                    lexicon=f"{d}/lexicon-us-en.txt,{d}/lexicon-zh.txt"),
                num_threads=int(os.environ.get("FW_TTS_THREADS", "4")), provider="cpu"),
            rule_fsts=f"{d}/date-zh.fst,{d}/phone-zh.fst,{d}/number-zh.fst",
            max_num_sentences=1)
        _engines[name] = sherpa_onnx.OfflineTts(cfg)
    return _engines[name]


def trim(x: np.ndarray, thr=0.012, margin=0.04) -> np.ndarray:
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x[:0]
    m = int(margin * SR)
    return x[max(0, idx[0] - m): min(len(x), idx[-1] + m)]


def synth_sentence(text: str, voice: dict) -> np.ndarray:
    key = hashlib.sha1(json.dumps([text, voice], ensure_ascii=False).encode()).hexdigest()[:16]
    fn = CACHE / f"{key}.wav"
    if fn.exists():
        x, _ = sf.read(fn, dtype="float32")
        return x
    audio = engine(voice["model"]).generate(text, sid=voice["sid"], speed=voice["speed"])
    assert audio.sample_rate == SR, audio.sample_rate
    x = trim(np.asarray(audio.samples, dtype=np.float32))
    # gentle fades so joins never click
    f = min(len(x) // 4, int(0.012 * SR))
    if f > 0:
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
    CACHE.mkdir(parents=True, exist_ok=True)
    sf.write(fn, x, SR, subtype="FLOAT")
    return x


def build(lang: str):
    data = SL.load()
    out = AUDIO / lang
    out.mkdir(parents=True, exist_ok=True)
    timing = {}
    for sc, seg in SL.all_segments(data):
        plan = SL.segment_plan(seg, lang)
        if plan is None:
            continue
        voice_key, tlang, text = plan
        voice = data["voices"][voice_key]
        pieces, sents, t = [], [], 0.0
        for i, s in enumerate(SL.sentences(text, tlang)):
            x = synth_sentence(SL.spoken(s), voice)
            if i:
                gap = np.zeros(int(GAP[tlang] * SR), np.float32)
                pieces.append(gap)
                t += len(gap) / SR
            pieces.append(x)
            sents.append({"start": round(t, 3), "end": round(t + len(x) / SR, 3),
                          "text": SL.display(s), "lang": tlang})
            t += len(x) / SR
        y = np.concatenate(pieces) if pieces else np.zeros(1, np.float32)
        sf.write(out / f"{seg['id']}.wav", y, SR, subtype="PCM_16")
        timing[seg["id"]] = {"scene": sc["id"], "voice": voice_key, "dur": round(len(y) / SR, 3),
                             "sentences": sents}
        print(f"[{lang}] {seg['id']:10s} {len(y)/SR:6.2f}s  {voice_key}", flush=True)
    with open(out / "timing.json", "w", encoding="utf-8") as f:
        json.dump(timing, f, ensure_ascii=False, indent=1)
    total = sum(v["dur"] for v in timing.values())
    print(f"[{lang}] total narration {total/60:.1f} min in {len(timing)} segments")


if __name__ == "__main__":
    for lang in (sys.argv[1:] or ["zh", "en"]):
        build(lang)
