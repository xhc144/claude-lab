"""A quiet procedural music bed: slow major-seventh pads, sparse bell notes, a soft swell at
every chapter, ducked under the narration.  numpy only.

    make_music(total_seconds, chapter_starts, speech_intervals, out_wav)
"""
import numpy as np

SR = 48000


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# D major colour: Dmaj9, Bm9, Gmaj9, A6/9  (MIDI notes)
CHORDS = [
    [38, 50, 54, 57, 61, 64],
    [35, 47, 50, 54, 57, 61],
    [31, 43, 47, 50, 54, 57],
    [33, 45, 49, 52, 54, 59],
]
BELL = [74, 76, 78, 81, 83, 86, 88]   # D major pentatonic, high register


def pad_segment(notes, n, rng):
    t = np.arange(n) / SR
    out = np.zeros((n, 2), np.float32)
    for i, m in enumerate(notes):
        f = midi(m)
        amp = (0.55 if i == 0 else 0.32) / len(notes)
        for det, pan in ((-0.0025, 0.25), (0.0025, 0.75)):
            ph = rng.uniform(0, 2 * np.pi)
            lfo = 0.75 + 0.25 * np.sin(2 * np.pi * rng.uniform(0.04, 0.09) * t + rng.uniform(0, 6.28))
            w = (np.sin(2 * np.pi * f * (1 + det) * t + ph) + 0.18 * np.sin(4 * np.pi * f * (1 + det) * t + ph)) * lfo
            out[:, 0] += (amp * (1 - pan) * w).astype(np.float32)
            out[:, 1] += (amp * pan * w).astype(np.float32)
    return out


def make_music(total, chapter_starts, speech, out_wav, seg=9.0, xf=3.0, seed=11):
    import soundfile as sf
    rng = np.random.default_rng(seed)
    N = int(total * SR) + SR
    bed = np.zeros((N, 2), np.float32)
    step = int((seg - xf) * SR)
    L = int(seg * SR)
    fade = np.ones(L, np.float32)
    k = int(xf * SR)
    fade[:k] = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    fade[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    i, c = 0, 0
    while i < N:
        n = min(L, N - i)
        bed[i:i + n] += pad_segment(CHORDS[c % len(CHORDS)], n, rng) * fade[:n, None]
        i += step
        c += 1
    # sparse bells
    t = 4.0
    while t < total:
        f = midi(int(rng.choice(BELL)))
        n = int(3.5 * SR)
        s = int(t * SR)
        if s + n < N:
            tt = np.arange(n) / SR
            env = np.exp(-tt * 1.6) * (1 - np.exp(-tt * 80))
            w = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2.76 * f * tt) * np.exp(-tt * 3)) * env * 0.045
            pan = rng.uniform(0.25, 0.75)
            bed[s:s + n, 0] += (w * (1 - pan)).astype(np.float32)
            bed[s:s + n, 1] += (w * pan).astype(np.float32)
        t += rng.uniform(4.5, 9.0)
    # chapter swells
    for cs in chapter_starts:
        s = int(cs * SR)
        n = int(3.0 * SR)
        if s + n < N:
            tt = np.arange(n) / SR
            env = np.sin(np.pi * tt / 3.0) ** 2
            w = sum(np.sin(2 * np.pi * midi(m) * tt) for m in (62, 66, 69, 74)) * env * 0.03
            bed[s:s + n] += w[:, None].astype(np.float32)
    # ducking: -9 dB while someone speaks, smoothed
    g = np.ones(N, np.float32)
    for a, b in speech:
        g[int(max(0, a - 0.25) * SR): int(min(total, b + 0.35) * SR)] = 0.355
    win = int(0.35 * SR)
    kern = np.ones(win, np.float32) / win
    g = np.convolve(g, kern, mode="same").astype(np.float32)
    bed *= g[:, None]
    bed *= 0.16 / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * 0.35   # quiet bed
    # gentle fade in/out
    fi = int(2.0 * SR)
    bed[:fi] *= np.linspace(0, 1, fi)[:, None]
    bed[-fi:] *= np.linspace(1, 0, fi)[:, None]
    sf.write(out_wav, bed[: int(total * SR)], SR, subtype="PCM_16")
