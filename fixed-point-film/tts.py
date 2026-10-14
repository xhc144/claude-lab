"""Narration synthesis and timeline layout.

Reads script.json, speaks every line with Kokoro (offline ONNX), and writes
  build/<lang>/line_XX_YY.wav      one clip per subtitle line
  build/<lang>/narration.wav       the full narration track (24 kHz mono)
  build/<lang>/timing.json         scene and line start/end times for the renderer

Usage:  python tts.py en|zh|all  [--voice NAME] [--speed X]
Models: $KOKORO_DIR (default ./models) must hold
  kokoro-v1.0.onnx, voices-v1.0.bin           (English)
  kokoro-v1.1-zh.onnx, voices-v1.1-zh.bin     (Mandarin)
"""
import argparse
import json
import os
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.environ.get("KOKORO_DIR", os.path.join(HERE, "models"))
SR = 24000
XFADE = 0.7          # visual cross-fade between scenes (s)
GAP = {"en": 0.42, "zh": 0.36}
SPEED = {"en": 0.94, "zh": 1.0}


def english_g2p():
    try:
        from misaki import en, espeak
        g2p = en.G2P(trf=False, british=False, fallback=espeak.EspeakFallback(british=False))
        return lambda text: g2p(text)[0]
    except Exception as exc:  # misaki[en] missing: Kokoro falls back to espeak
        print("misaki[en] unavailable, using espeak phonemizer:", exc, file=sys.stderr)
        return None


def make_speaker(lang, voice, speed):
    from kokoro_onnx import Kokoro
    en_g2p = english_g2p()
    if lang == "en":
        tts = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))

        def speak(text):
            if en_g2p:
                return tts.create(en_g2p(text), voice=voice, speed=speed, is_phonemes=True)
            return tts.create(text, voice=voice, speed=speed, lang="en-us")
        return speak

    from misaki import zh
    g2p = zh.ZHG2P(version="1.1", en_callable=en_g2p)
    tts = Kokoro(os.path.join(MODELS, "kokoro-v1.1-zh.onnx"), os.path.join(MODELS, "voices-v1.1-zh.bin"))

    def speak(text):
        phonemes, _ = g2p(text)
        return tts.create(phonemes, voice=voice, speed=speed, is_phonemes=True)
    return speak


def trim(samples, thresh=0.006, pad=0.04):
    """Cut leading/trailing silence, keep a short pad so consonants are not clipped."""
    env = np.convolve(np.abs(samples), np.ones(240) / 240, mode="same")
    idx = np.where(env > thresh)[0]
    if len(idx) == 0:
        return samples
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(samples), idx[-1] + int(pad * SR))
    return samples[a:b]


def build(lang, voice=None, speed=None):
    script = json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))
    voice = voice or script["voices"][lang]
    speed = speed or SPEED[lang]
    out = os.path.join(HERE, "build", lang)
    os.makedirs(out, exist_ok=True)
    speak = make_speaker(lang, voice, speed)
    other = "zh" if lang == "en" else "en"

    timeline, t, clips = [], 0.0, []
    for si, scene in enumerate(script["scenes"]):
        start = 0.0 if si == 0 else t - XFADE
        entry = {"id": scene["id"], "start": round(start, 3), "lines": []}
        if "fixed" in scene:
            end = start + scene["fixed"]
        else:
            cur = start + scene["lead"]
            for li, line in enumerate(scene["lines"]):
                text = line.get(lang + "_tts", line[lang])
                samples, sr = speak(text)
                assert sr == SR, sr
                samples = trim(np.asarray(samples, dtype=np.float32))
                path = os.path.join(out, f"line_{si:02d}_{li:02d}.wav")
                sf.write(path, samples, SR)
                dur = len(samples) / SR
                entry["lines"].append({
                    "start": round(cur, 3), "end": round(cur + dur, 3),
                    "text": line[lang], "alt": line[other],
                })
                clips.append((cur, samples))
                print(f"[{lang}] {scene['id']}#{li}: {dur:5.2f}s  {line[lang][:60]}")
                cur += dur + GAP[lang]
            end = cur - GAP[lang] + scene["tail"]
        entry["end"] = round(end, 3)
        timeline.append(entry)
        t = end

    total = t + 0.3
    track = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for start, samples in clips:
        i = int(round(start * SR))
        track[i:i + len(samples)] += samples
    track = track[: int(total * SR)]
    peak = np.max(np.abs(track))
    track *= 0.89 / peak
    sf.write(os.path.join(out, "narration.wav"), track, SR)
    timing = {"lang": lang, "voice": voice, "duration": round(total, 3), "xfade": XFADE, "scenes": timeline}
    with open(os.path.join(out, "timing.json"), "w", encoding="utf-8") as fh:
        json.dump(timing, fh, ensure_ascii=False, indent=1)
    print(f"[{lang}] total {total:.1f}s -> {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("lang", choices=["en", "zh", "all"])
    ap.add_argument("--voice")
    ap.add_argument("--speed", type=float)
    args = ap.parse_args()
    for lang in (["en", "zh"] if args.lang == "all" else [args.lang]):
        build(lang, args.voice, args.speed)
