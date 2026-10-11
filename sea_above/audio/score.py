#!/usr/bin/env python3
"""The soundtrack of 'The Sea Above': music and sound design, cued to the cut.

  python -m audio.score out/score.wav

Cue sheet (film seconds) - see edit.py for the picture side:
   0.0  black; a low drone and glints of light
   1.6  the dew drop fades in; 3.0 focus finds it
   5.0  the drop stretches upward, 6.3 pinches off and rises (an upward "plip")
   9    we pull back: strings and choir open up the world
  20.5  the sea above, the whale calls from the sky
  24    cut: rushing up a column of water
  26.2  the plunge: splash, bubbles, everything muffled under water
  27-32 the whale passes close
  33.6  we breach into the night: lanterns, a music-box melody
  44.5  the world folds up into a tunnel of lights; swell to the climax at 50.5
  56    into the moon - a bell - back to the dew drop
  64.4  title; the last chord rings out
"""
import os
import sys
import wave

import numpy as np

from audio import synth as S
from audio.synth import SR, hz

TOTAL = 71.0
T_PLUNGE = 26.2
T_BREACH = 33.6


class Mix:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.bus = {k: np.zeros((self.n, 2)) for k in ("music", "sfx", "whale", "dry")}

    def add(self, bus, t0, x, gain=1.0, p=0.0):
        if x.ndim == 1:
            x = S.pan(x, p)
        i = int(t0 * SR)
        if i >= self.n:
            return
        m = min(len(x), self.n - i)
        self.bus[bus][i:i + m] += x[:m] * gain


def chord(mix, t0, dur, notes, inst="pad", gain=1.0, spread=0.6, **kw):
    fn = {"pad": S.pad_note, "strings": S.string_note, "choir": S.choir_note}[inst]
    k = len(notes)
    for i, nm in enumerate(notes):
        p = spread * (2 * i / max(k - 1, 1) - 1)
        mix.add("music", t0, fn(hz(nm), dur, **kw), gain, p)


def compose():
    m = Mix(TOTAL + 1.0)
    rng = np.random.default_rng(11)

    # ---------------------------------------------------------------- I. the drop (0 - 9)
    m.add("music", 0.0, S.sub(hz("D2"), 9.0, att=4.0, rel=4.0, gain=0.06))
    m.add("sfx", 0.6, S.shimmer(8.5, density=3.0, gain=0.02), 1.0, 0.3)
    chord(m, 1.0, 8.0, ["D3", "A3", "E4", "F#4", "C#5"], "pad", 0.22, att=4.0, rel=4.0, cutoff=900)
    # the drop catches the light when focus finds it
    m.add("music", 3.05, S.bell(hz("A5"), 5.0, gain=0.07), 1.0, 0.1)
    m.add("music", 3.12, S.bell(hz("E6"), 5.0, gain=0.04), 1.0, 0.25)
    for t, nm, v in ((4.1, "F#5", 0.45), (4.9, "A5", 0.4), (5.6, "E5", 0.38)):
        m.add("music", t, S.piano_note(hz(nm), v), 1.0, 0.15)
    # stretching: a held, rising tension
    m.add("music", 5.0, S.string_note(hz("A5"), 1.4, att=1.2, rel=0.4, cutoff=3000), 0.5, 0.0)
    m.add("music", 5.0, S.string_note(hz("E6"), 1.4, att=1.3, rel=0.4, cutoff=3500), 0.25, 0.1)
    # pinch-off: the drop falls upward
    m.add("sfx", 6.30, S.plip(800, 2600, 0.08, 0.32), 1.0, 0.05)
    m.add("sfx", 6.37, S.plip(2400, 5200, 0.03, 0.08), 1.0, 0.15)
    m.add("music", 6.30, S.piano_note(hz("D6"), 0.55), 1.0, 0.0)
    m.add("music", 6.31, S.bell(hz("D6"), 5.0, gain=0.05), 1.0, -0.1)
    for t, nm, v in ((7.1, "C#6", 0.35), (7.9, "A5", 0.33), (8.7, "F#5", 0.32)):
        m.add("music", t, S.piano_note(hz(nm), v), 1.0, -0.1)
    m.add("sfx", 6.4, S.shimmer(3.5, density=9.0, fmin=5000, fmax=11000, gain=0.018), 1.0, 0.0)

    # ---------------------------------------------------------------- II. the world opens (9 - 24)
    prog = [
        (9.0, ["G2", "D3", "B3", "F#4", "A4", "C#5"]),
        (12.0, ["F#2", "D3", "A3", "E4", "F#4", "A4"]),
        (15.0, ["E2", "B2", "G3", "D4", "F#4", "B4"]),
        (18.0, ["A2", "E3", "A3", "B3", "D4", "E4"]),
    ]
    for t, notes in prog:
        g = 0.35 + 0.12 * (t - 9) / 3
        chord(m, t, 3.4, notes, "strings", g, att=1.6, rel=2.4, cutoff=2400 + 300 * (t - 9) / 3)
        chord(m, t, 3.4, notes[:3], "pad", 0.22, att=1.2, rel=2.5, cutoff=700)
    m.add("music", 9.0, S.sub(hz("G1"), 3.0, att=2.0, rel=1.5, gain=0.07))
    m.add("music", 12.0, S.sub(hz("F#1"), 3.0, att=1.0, rel=1.5, gain=0.08))
    m.add("music", 15.0, S.sub(hz("E1"), 3.0, att=1.0, rel=1.5, gain=0.09))
    m.add("music", 18.0, S.sub(hz("A1"), 2.5, att=1.0, rel=1.5, gain=0.10))
    chord(m, 11.0, 9.0, ["A4", "D5", "F#5"], "choir", 0.3, att=4.0, rel=2.0)
    # the arrival chord as the sea above comes into view
    climax = ["D2", "A2", "D3", "A3", "F#4", "A4", "D5", "E5"]
    chord(m, 20.4, 3.4, climax, "strings", 0.95, att=0.9, rel=2.2, cutoff=3400)
    chord(m, 20.4, 3.4, ["D4", "F#4", "A4", "E5"], "choir", 0.6, att=1.2, rel=2.2)
    m.add("music", 20.4, S.sub(hz("D1"), 3.4, att=0.6, rel=2.0, gain=0.13))
    m.add("sfx", 20.3, S.boom(0.22))
    for i, (t, nm) in enumerate(((12.8, "F#5"), (13.6, "A5"), (14.4, "E6"), (16.2, "D6"), (17.0, "B5"),
                                 (21.0, "A5"), (21.5, "D6"), (22.0, "F#6"), (22.5, "E6"))):
        m.add("music", t, S.piano_note(hz(nm), 0.32), 1.0, 0.4 * np.sin(i))
    # rising drops, air, the whale calling from the sky
    m.add("sfx", 9.0, S.wind(15.0, 0.06, 600) * S.swell(15 * SR, 0.5))
    m.add("whale", 19.6, S.whale_call(3.4, 260, 420, 230, 0.16, 0.8), 1.0, -0.4)
    m.add("whale", 22.2, S.whale_call(2.0, 380, 300, 520, 0.08, 0.9), 1.0, -0.5)
    m.add("sfx", 22.6, S.whoosh(1.45, 300, 4000, 0.25, True), 1.0, 0.0)

    # ---------------------------------------------------------------- III. crossing (24 - 33.6)
    m.add("sfx", 24.0, S.whoosh(2.3, 500, 2500, 0.35, True), 1.0, 0.0)
    m.add("sfx", 24.0, S.wind(2.3, 0.25, 1500) * np.linspace(0.3, 1.0, int(2.3 * SR)), 1.0, 0.0)
    for k in range(8):           # driving low pulse toward the plunge
        t = 24.0 + k * 0.275
        m.add("music", t, S.pad_note(hz("B1"), 0.2, att=0.01, rel=0.25, cutoff=500), 0.6 + 0.05 * k)
    chord(m, 24.0, 2.2, ["B2", "F#3", "B3", "D4"], "strings", 0.6, att=1.8, rel=0.3, cutoff=3000)
    m.add("sfx", T_PLUNGE, S.splash(0.75))
    m.add("sfx", T_PLUNGE, S.boom(0.35))
    m.add("sfx", T_PLUNGE + 0.02, S.bubbles(2.5, 120, 400, 3000, 0.07), 1.0, 0.0)
    m.add("sfx", T_PLUNGE + 2.0, S.bubbles(5.0, 10, 300, 1800, 0.05), 1.0, 0.2)
    chord(m, T_PLUNGE + 0.2, 6.8, ["B1", "F#2", "A2", "D3", "C#4"], "pad", 0.4, att=1.0, rel=2.0, cutoff=600)
    m.add("music", T_PLUNGE, S.sub(hz("B1"), 7.0, att=0.5, rel=2.0, gain=0.08))
    # the whale, close
    m.add("whale", 27.0, S.whale_call(2.8, 180, 300, 140, 0.34, 1.0), 1.0, 0.2)
    m.add("whale", 29.4, S.whale_call(2.4, 330, 220, 380, 0.26, 1.1), 1.0, 0.35)
    m.add("whale", 30.9, S.whale_whistle(1.6, 900, 1500, 0.05), 1.0, 0.4)
    m.add("whale", 31.6, S.whale_call(1.8, 150, 210, 120, 0.3, 0.9), 1.0, 0.3)

    # ---------------------------------------------------------------- IV. the night above (33.6 - 56)
    m.add("sfx", T_BREACH, S.splash(0.35), 1.0, 0.0)
    m.add("sfx", T_BREACH - 0.2, S.whoosh(0.6, 2000, 400, 0.15, False), 1.0, 0.0)
    m.add("sfx", T_BREACH, S.water_lap(22.5, 0.10), 1.0, 0.0)
    m.add("sfx", T_BREACH, S.wind(22.5, 0.04, 400), 1.0, 0.0)
    night = [
        (34.0, ["G2", "D3", "A3", "B3", "F#4"]),
        (37.0, ["E2", "B2", "D3", "G3", "F#4"]),
        (40.0, ["B1", "F#2", "D3", "A3", "C#4"]),
        (43.0, ["A1", "E2", "C#3", "E3", "B3"]),
    ]
    for t, notes in night:
        chord(m, t, 3.3, notes, "pad", 0.26, att=1.5, rel=2.5, cutoff=1100)
    # a music-box melody over the lanterns
    penta = ["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6"]
    mel = [(34.4, "F#5"), (34.8, "A5"), (35.2, "B5"), (35.6, "A5"), (36.4, "F#5"), (36.8, "E5"), (37.2, "D5"),
           (38.0, "E5"), (38.4, "F#5"), (38.8, "A5"), (39.6, "B5"), (40.0, "D6"), (40.4, "B5"), (40.8, "A5"),
           (41.6, "F#5"), (42.0, "E5"), (42.4, "F#5"), (43.2, "A5"), (44.0, "E6")]
    for t, nm in mel:
        m.add("music", t, S.bell(hz(nm), 3.5, idx=1.4, ratio=4.0, decay=1.2, gain=0.09), 1.0, 0.2)
        m.add("music", t, S.piano_note(hz(nm), 0.25), 0.6, -0.2)
    for _ in range(40):          # far lanterns chiming in the dark
        t = 34.0 + rng.random() * 22.0
        nm = penta[rng.integers(3, len(penta))]
        m.add("sfx", t, S.bell(hz(nm) * 2, 2.0, idx=0.8, ratio=3.0, decay=0.6, gain=0.018), 1.0, rng.uniform(-0.9, 0.9))

    # the fold: the world bends and closes over us
    m.add("sfx", 44.5, S.rumble(7.5, 0.5), 1.0, 0.0)
    fold = [(45.5, ["B1", "F#2", "B2", "D3", "F#3", "B3"]),
            (47.0, ["G1", "D2", "G2", "B2", "D3", "F#3", "A3"]),
            (48.5, ["F#1", "C#2", "F#2", "A2", "E3", "A3", "C#4"])]
    for t, notes in fold:
        chord(m, t, 1.8, notes, "strings", 0.45 + 0.12 * (t - 45.5), att=1.0, rel=1.2, cutoff=2000 + 600 * (t - 45.5))
    chord(m, 45.5, 5.0, ["F#4", "B4", "D5"], "choir", 0.5, att=3.5, rel=0.8)
    m.add("sfx", 48.9, S.whoosh(1.6, 200, 6000, 0.22, True), 1.0, 0.0)
    big = ["D1", "D2", "A2", "D3", "F#3", "A3", "E4", "F#4", "A4", "D5", "E5", "A5"]
    chord(m, 50.5, 5.6, big, "strings", 1.0, att=0.7, rel=3.0, cutoff=4200)
    chord(m, 50.5, 5.6, ["A3", "D4", "F#4", "A4", "D5"], "choir", 0.75, att=1.0, rel=3.0)
    m.add("music", 50.5, S.sub(hz("D1"), 5.6, att=0.4, rel=3.0, gain=0.14))
    m.add("sfx", 50.45, S.boom(0.4))
    m.add("sfx", 50.6, S.shimmer(6.0, density=14.0, fmin=4000, fmax=10000, gain=0.02), 1.0, 0.0)
    for i, (t, nm) in enumerate(((51.2, "A5"), (51.8, "D6"), (52.4, "F#6"), (53.0, "A6"), (54.2, "E6"), (55.0, "D6"))):
        m.add("music", t, S.bell(hz(nm), 4.0, idx=1.0, ratio=3.5, decay=1.5, gain=0.06), 1.0, 0.5 * np.sin(i * 2))

    # ---------------------------------------------------------------- V. return (56 - 71)
    m.add("music", 56.1, S.bell(hz("D6"), 7.0, idx=1.6, ratio=3.5, decay=2.6, gain=0.11), 1.0, 0.0)
    m.add("music", 56.1, S.bell(hz("A5"), 7.0, idx=1.2, ratio=3.5, decay=2.6, gain=0.06), 1.0, -0.2)
    m.add("sfx", 55.4, S.whoosh(0.9, 6000, 800, 0.12, False), 1.0, 0.0)
    chord(m, 56.5, 8.0, ["D3", "A3", "E4", "F#4", "C#5"], "pad", 0.2, att=2.0, rel=4.0, cutoff=900)
    m.add("music", 56.5, S.sub(hz("D2"), 8.0, att=2.0, rel=4.0, gain=0.05))
    m.add("sfx", 56.8, S.shimmer(8.0, density=3.0, gain=0.018), 1.0, 0.3)
    for t, nm, v in ((58.2, "F#5", 0.42), (59.0, "A5", 0.38), (59.7, "E5", 0.36), (61.4, "D5", 0.34),
                     (62.4, "A4", 0.3)):
        m.add("music", t, S.piano_note(hz(nm), v), 1.0, 0.15)
    m.add("sfx", 60.5, S.plip(700, 1500, 0.05, 0.06), 1.0, 0.1)
    # title: the last chord
    chord(m, 64.4, 4.5, ["D2", "A2", "F#3", "E4", "A4"], "strings", 0.32, att=2.0, rel=3.5, cutoff=1800)
    m.add("music", 64.4, S.bell(hz("D5"), 7.0, idx=1.0, ratio=3.5, decay=3.0, gain=0.08), 1.0, 0.0)
    m.add("music", 64.5, S.piano_note(hz("D4"), 0.4, 7.0), 1.0, -0.1)
    m.add("music", 64.5, S.piano_note(hz("A4"), 0.35, 7.0), 1.0, 0.1)
    return m


def master(m):
    ir_m = S.reverb_ir(4.8, 0.6, 1)
    ir_s = S.reverb_ir(2.2, 0.5, 2)
    ir_w = S.reverb_ir(6.5, 0.7, 3)
    music = m.bus["music"] * 0.72 + S.convolve_stereo(m.bus["music"], ir_m) * 0.42
    sfx = m.bus["sfx"] * 0.9 + S.convolve_stereo(m.bus["sfx"], ir_s) * 0.18
    whale = m.bus["whale"] * 0.5 + S.convolve_stereo(m.bus["whale"], ir_w) * 0.7
    mix = music + sfx
    # under water: everything muffles; the whale is right there with us
    n = len(mix)
    tt = np.arange(n) / SR
    w = np.clip((tt - T_PLUNGE) / 0.06, 0, 1) * np.clip((T_BREACH - tt) / 0.15, 0, 1)
    muff = np.stack([S.lp(mix[:, c], 650, 4) for c in range(2)], 1) * 0.95
    mix = mix * (1 - w[:, None]) + muff * w[:, None]
    whale = whale * (0.6 + 0.25 * w[:, None])
    whale = np.stack([S.lp(whale[:, c], 2400, 2) for c in range(2)], 1)
    mix = mix + whale + m.bus["dry"]
    mix = np.stack([S.hp(mix[:, c], 32, 2) for c in range(2)], 1)
    # gentle glue and a soft ceiling
    peak = np.abs(mix).max()
    mix = mix / peak * 1.9
    mix = np.tanh(mix / 1.15) * 1.15 * 0.8
    fade = np.clip(tt / 0.8, 0, 1) * np.clip((TOTAL - tt) / 1.5, 0, 1)
    mix = mix * fade[:, None]
    return mix[:int(TOTAL * SR)]


def write_wav(path, x):
    x16 = np.clip(x * 32767, -32768, 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(x16.tobytes())


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "out", "score.wav")
    m = compose()
    x = master(m)
    write_wav(out, x)
    print(f"wrote {out}  ({len(x) / SR:.1f}s, peak {np.abs(x).max():.2f})")


if __name__ == "__main__":
    main()
