"""Ambient score + final mix (numpy only).

Builds a slow pad that follows the scene timeline, ducks it under the narration,
and writes build/<lang>/mix.wav (48 kHz stereo, 16-bit).

Usage:  python music.py en|zh|all
"""
import json
import os
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
rng = np.random.default_rng(7)


def read_wav(path):
    with wave.open(path) as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    x = x.reshape(-1, ch).mean(axis=1)
    if sr != SR:  # linear resample is fine for a 24 kHz speech track
        t_new = np.arange(int(len(x) * SR / sr)) / SR
        x = np.interp(t_new, np.arange(len(x)) / sr, x).astype(np.float32)
    return x


def write_wav(path, stereo):
    pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def adsr(n, a, r):
    env = np.ones(n, dtype=np.float32)
    na, nr = int(a * SR), int(r * SR)
    env[:na] = np.linspace(0, 1, na) ** 2
    env[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return env


def pad_note(freq, dur, amp):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2), dtype=np.float32)
    for detune, pan in ((-5, 0.25), (0, 0.5), (5, 0.75)):
        f = freq * 2 ** (detune / 1200)
        ph = rng.uniform(0, 2 * np.pi)
        tone = np.zeros(n, dtype=np.float32)
        for k in range(1, 7):  # soft saw-like spectrum, upper partials breathe slowly
            breathe = 0.75 + 0.25 * np.sin(2 * np.pi * (0.07 + 0.013 * k) * t + k)
            tone += (np.sin(2 * np.pi * f * k * t + ph * k) / k ** 1.7 * breathe).astype(np.float32)
        out[:, 0] += tone * np.sqrt(1 - pan)
        out[:, 1] += tone * np.sqrt(pan)
    return out * adsr(n, 2.2, 2.8)[:, None] * amp


def chime(freq, amp, pan):
    n = int(4.0 * SR)
    t = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 3)) * np.exp(-t * 1.1)
    tone *= np.minimum(1, t / 0.004)
    return np.stack([tone * np.sqrt(1 - pan), tone * np.sqrt(pan)], axis=1).astype(np.float32) * amp


def reverb(x, seconds=3.2, wet=0.35):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.empty_like(x)
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    for c in range(2):
        ir = rng.standard_normal(n).astype(np.float32) * np.exp(-t * 6.9 / seconds)
        ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        y = np.fft.irfft(np.fft.rfft(x[:, c], size) * np.fft.rfft(ir, size), size)[: len(x)]
        out[:, c] = (1 - wet) * x[:, c] + wet * y
    return out


# D major colour, slow: Dmaj9  Bm7(11)  Gmaj7(#11)  A6sus
PROGRESSION = [
    [50, 57, 61, 64, 66, 69],
    [47, 54, 57, 62, 64, 66],
    [43, 50, 54, 57, 61, 66],
    [45, 52, 57, 59, 62, 66],
]
PENTA = [74, 76, 78, 81, 83, 86, 88, 90]


def score(duration, timing):
    n = int(duration * SR) + SR * 4
    mix = np.zeros((n, 2), dtype=np.float32)
    bar = 8.0
    i, t = 0, 0.0
    while t < duration + 2:
        chord = PROGRESSION[i % len(PROGRESSION)]
        for j, m in enumerate(chord):
            note = pad_note(midi(m), bar + 3.0, 0.055 if j else 0.075)
            a = int(t * SR)
            mix[a:a + len(note)] += note[: max(0, n - a)]
        # sparse chimes, two per bar, from the pentatonic set
        for k in range(2):
            ct = t + bar * (0.3 + 0.45 * k) + rng.uniform(-0.4, 0.4)
            c = chime(midi(PENTA[rng.integers(len(PENTA))]), 0.03, rng.uniform(0.2, 0.8))
            a = int(ct * SR)
            if a < n:
                mix[a:a + len(c)] += c[: n - a]
        t += bar
        i += 1
    # a soft swell + low bell on the title card and on the closing beat
    for scene in timing["scenes"]:
        if scene["id"] in ("title", "closing"):
            at = scene["start"] + (0.3 if scene["id"] == "title" else scene["end"] - scene["start"] - 4.0)
            for m, amp in ((38, 0.10), (62, 0.05), (69, 0.04), (78, 0.035)):
                c = chime(midi(m), amp, 0.5)
                a = int(at * SR)
                mix[a:a + len(c)] += c[: n - a]
    mix = reverb(mix)
    mix = mix[: int(duration * SR)]
    fade = int(3.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    mix[: int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))[:, None]
    return mix / np.max(np.abs(mix))


def duck_curve(voice):
    win = int(0.05 * SR)
    env = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode="same"))
    env = np.clip(env / (np.percentile(env[env > 1e-4], 90) + 1e-9), 0, 1)
    out = np.empty_like(env)
    att, rel, g = np.exp(-1 / (0.06 * SR)), np.exp(-1 / (0.6 * SR)), 0.0
    for k in range(0, len(env), 64):  # block-wise smoothing is plenty at this resolution
        target = env[k]
        coef = att if target > g else rel
        g = target + (g - target) * coef ** 64
        out[k:k + 64] = g
    return 1.0 - 0.55 * out


def build(lang):
    out = os.path.join(HERE, "build", lang)
    timing = json.load(open(os.path.join(out, "timing.json"), encoding="utf-8"))
    voice = read_wav(os.path.join(out, "narration.wav"))
    dur = timing["duration"]
    voice = np.pad(voice, (0, max(0, int(dur * SR) - len(voice))))[: int(dur * SR)]
    music = score(dur, timing) * 0.16
    music *= duck_curve(voice)[:, None]
    mix = music + voice[:, None] * 0.92
    mix /= max(1.0, np.max(np.abs(mix)) / 0.97)
    write_wav(os.path.join(out, "mix.wav"), mix)
    print(f"[{lang}] mix {dur:.1f}s -> {out}/mix.wav")


if __name__ == "__main__":
    lang = sys.argv[1] if len(sys.argv) > 1 else "all"
    for l in (["en", "zh"] if lang == "all" else [lang]):
        build(l)
