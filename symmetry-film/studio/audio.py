"""Procedural soundtrack, synthesised with numpy and synced to the edit.

    python -m studio.audio output/soundtrack.wav
"""
import math
import sys
import wave

import numpy as np
from numba import njit
from scipy.signal import butter, fftconvolve, sosfilt

from . import timeline
from .scenes import s02_music, s03_rubik, s04_solids, s07_quintic, s10_finale

SR = 44100
RNG = np.random.default_rng(2024)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


# ---------------------------------------------------------------------------
# DSP primitives
# ---------------------------------------------------------------------------
@njit(cache=True)
def _saw(freq, n, sr, phase):
    out = np.empty(n)
    dt = freq / sr
    p = phase
    for i in range(n):
        v = 2.0 * p - 1.0
        # polyBLEP
        if p < dt:
            x = p / dt
            v -= x + x - x * x - 1.0
        elif p > 1.0 - dt:
            x = (p - 1.0) / dt
            v -= x * x + x + x + 1.0
        out[i] = v
        p += dt
        if p >= 1.0:
            p -= 1.0
    return out


@njit(cache=True)
def _svf(x, cutoff, res, sr, mode):
    """TPT state-variable filter; cutoff is a per-sample array. mode 0=LP,1=BP,2=HP."""
    n = x.shape[0]
    out = np.empty(n)
    ic1 = 0.0
    ic2 = 0.0
    k = 2.0 - 2.0 * res
    for i in range(n):
        fc = min(max(cutoff[i], 20.0), sr * 0.45)
        g = math.tan(math.pi * fc / sr)
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            out[i] = v2
        elif mode == 1:
            out[i] = v1
        else:
            out[i] = x[i] - k * v1 - v2
    return out


@njit(cache=True)
def _karplus(freq, n, sr, decay, bright, seed):
    np.random.seed(seed)
    N = max(2, int(sr / freq))
    buf = np.random.uniform(-1.0, 1.0, N)
    # soften the excitation
    for i in range(1, N):
        buf[i] = bright * buf[i] + (1 - bright) * buf[i - 1]
    out = np.empty(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        v = buf[idx]
        out[i] = v
        nv = decay * 0.5 * (v + prev)
        prev = v
        buf[idx] = nv
        idx += 1
        if idx >= N:
            idx = 0
    return out


def lp(x, fc, order=2):
    sos = butter(order, fc, btype="low", fs=SR, output="sos")
    return sosfilt(sos, x)


def hp(x, fc, order=2):
    sos = butter(order, fc, btype="high", fs=SR, output="sos")
    return sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)


def env_adsr(n, a, d, s, r, hold=None):
    """ADSR in seconds; hold = sustain length (defaults to fill)."""
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    if hold is None:
        H = max(0, n - A - D - R)
    else:
        H = int(hold * SR)
    e = np.concatenate([np.linspace(0, 1, max(A, 1), endpoint=False),
                        np.linspace(1, s, max(D, 1), endpoint=False),
                        np.full(H, s), np.linspace(s, 0, max(R, 1))])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def noise(n):
    return RNG.standard_normal(n)


# ---------------------------------------------------------------------------
# Instruments (return mono or stereo numpy arrays)
# ---------------------------------------------------------------------------
def pad(notes, dur, attack=1.5, release=2.5, cutoff=1800, bright_lfo=0.15, detune=0.08, voices=3):
    n = int((dur + release) * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for v in range(voices):
            dt = (v - (voices - 1) / 2) * detune
            fl = f * 2 ** (dt / 12)
            fr = f * 2 ** (-dt / 12)
            L += _saw(fl, n, SR, RNG.random())
            R += _saw(fr, n, SR, RNG.random())
    tt = np.arange(n) / SR
    cut = cutoff * (1 + bright_lfo * np.sin(2 * math.pi * 0.11 * tt)) * np.minimum(1, 0.35 + tt / max(attack, .01))
    L = _svf(L, cut, 0.15, SR, 0)
    R = _svf(R, cut, 0.15, SR, 0)
    e = env_adsr(n, attack, 0.5, 0.85, release, hold=max(0, dur - attack - 0.5))
    g = 0.5 / (len(notes) * voices) ** 0.5
    return np.stack([L * e * g, R * e * g])


def piano(m, dur=3.0, vel=0.7, bright=1.0):
    f = mtof(m)
    n = int((dur + 0.5) * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.0003
    for k in range(1, 14):
        fk = f * k * math.sqrt(1 + B * k * k)
        if fk > 16000:
            break
        amp = (1.0 / k ** 1.25) * (vel ** (0.5 + 0.2 * k)) * (bright if k > 3 else 1)
        tau = (1.8 + 2.0 * (60 / max(f, 60))) / (1 + 0.35 * k)
        out += amp * np.sin(2 * math.pi * fk * tt + RNG.random() * 6) * np.exp(-tt / tau)
    hammer = lp(noise(int(0.02 * SR)), 3000) * np.linspace(1, 0, int(0.02 * SR)) * 0.08 * vel
    out[:len(hammer)] += hammer
    rel = np.ones(n)
    rs = int(dur * SR)
    if rs < n:
        rel[rs:] = np.linspace(1, 0, n - rs)
    out *= rel * np.minimum(1, tt / 0.004)
    return lp(out, 5500) * 0.5 * vel


def bell(m, dur=2.5, vel=0.5, ratio=3.5, index=2.2):
    f = mtof(m)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    ienv = index * np.exp(-tt / 0.5)
    mod = np.sin(2 * math.pi * f * ratio * tt) * ienv
    car = np.sin(2 * math.pi * f * tt + mod)
    car += 0.3 * np.sin(2 * math.pi * f * 2.76 * tt) * np.exp(-tt / 0.3)
    e = np.exp(-tt / (dur * 0.35)) * np.minimum(1, tt / 0.002)
    return car * e * vel * 0.35


def pluck(m, dur=1.6, vel=0.6, decay=0.996, bright=0.6):
    f = mtof(m)
    n = int(dur * SR)
    s = _karplus(f, n, SR, decay, bright, int(RNG.integers(1 << 30)))
    s = s * np.minimum(1, np.linspace(0, dur, n) / 0.002)
    return lp(s, 6000) * vel * 0.5


def kick(vel=1.0, tone=48.0, length=0.6):
    n = int(length * SR)
    tt = np.arange(n) / SR
    f = tone + 110 * np.exp(-tt / 0.03)
    ph = 2 * math.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt / 0.18)
    click = hp(noise(n), 2000) * np.exp(-tt / 0.004) * 0.25
    return np.tanh((body + click) * 1.6) * vel * 0.8


def tom(m, vel=0.8, length=1.2):
    n = int(length * SR)
    tt = np.arange(n) / SR
    f0 = mtof(m)
    f = f0 * (1 + 0.6 * np.exp(-tt / 0.05))
    ph = 2 * math.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt / 0.35)
    skin = lp(noise(n), 1200) * np.exp(-tt / 0.03) * 0.3
    return (body + skin) * vel * 0.7


def snare(vel=0.7):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    nz = bp(noise(n), 1200, 9000) * np.exp(-tt / 0.07)
    body = np.sin(2 * math.pi * 190 * tt) * np.exp(-tt / 0.05) * 0.5
    return (nz + body) * vel * 0.45


def hat(vel=0.3, open_=False):
    n = int((0.35 if open_ else 0.07) * SR)
    tt = np.arange(n) / SR
    return hp(noise(n), 7000, 4) * np.exp(-tt / (0.12 if open_ else 0.018)) * vel * 0.5


def frame_drum(low=True, vel=0.7):
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    if low:
        f = 95 * (1 + 0.4 * np.exp(-tt / 0.03))
        s = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.16)
        s += lp(noise(n), 500) * np.exp(-tt / 0.02) * 0.3
    else:
        s = bp(noise(n), 1500, 6000) * np.exp(-tt / 0.03) + np.sin(2 * math.pi * 420 * tt) * np.exp(-tt / 0.03) * 0.4
    return s * vel * 0.6


def boom(vel=1.0, length=6.0, tone=34.0):
    n = int(length * SR)
    tt = np.arange(n) / SR
    f = tone + 50 * np.exp(-tt / 0.12)
    sub = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-tt / 1.6)
    crack = lp(noise(n), 2500) * np.exp(-tt / 0.08) * 0.6
    rumble = lp(noise(n), 180) * np.exp(-tt / 1.2) * 1.2
    return np.tanh((sub * 1.2 + crack + rumble) * 1.3) * vel


def riser(length=3.0, vel=0.6, f0=300, f1=7000):
    n = int(length * SR)
    tt = np.arange(n) / SR
    x = tt / length
    cut = f0 * (f1 / f0) ** (x ** 1.5)
    s = _svf(noise(n), cut, 0.75, SR, 1)
    tone_f = 110 * 2 ** (x * 2.5)
    tone = np.sin(2 * math.pi * np.cumsum(tone_f) / SR) * 0.25
    e = x ** 2.2
    return (s * 0.8 + tone) * e * vel


def reverse_swell(length=1.6, vel=0.5):
    n = int(length * SR)
    tt = np.arange(n) / SR
    s = lp(noise(n), 4000) * np.exp(-tt / 0.5)
    return s[::-1] * vel


def whoosh(length=0.8, vel=0.4, up=True):
    n = int(length * SR)
    x = np.linspace(0, 1, n)
    cut = 400 * (12 ** (x if up else 1 - x))
    s = _svf(noise(n), cut, 0.6, SR, 1)
    return s * np.sin(math.pi * x) ** 2 * vel


def click(vel=0.4):
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    s = bp(noise(n), 1800, 6500) * np.exp(-tt / 0.006)
    s += np.sin(2 * math.pi * 2400 * tt) * np.exp(-tt / 0.01) * 0.3
    return s * vel


def tick(vel=0.15, f=3200):
    n = int(0.04 * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * math.pi * f * tt) * np.exp(-tt / 0.008) * vel


def shimmer(m, dur=3.0, vel=0.3):
    out = np.zeros(int(dur * SR))
    for k, (mm, dt) in enumerate(((m, 0), (m + 7, 0.06), (m + 12, 0.12), (m + 19, 0.18), (m + 24, 0.24))):
        b = bell(mm, dur - dt, vel * (0.9 ** k), ratio=2.0, index=1.0)
        o = int(dt * SR)
        out[o:o + len(b)] += b
    return out


# ---------------------------------------------------------------------------
# Mixer
# ---------------------------------------------------------------------------
class Mix:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.dry = np.zeros((2, self.n))
        self.wet = np.zeros((2, self.n))  # reverb send

    def add(self, sig, t, gain=1.0, pan=0.0, rev=0.25):
        i = int(t * SR)
        if i >= self.n:
            return
        if sig.ndim == 1:
            a = (pan + 1) * math.pi / 4
            st = np.stack([sig * math.cos(a), sig * math.sin(a)]) * math.sqrt(2)
        else:
            st = sig
        m = min(st.shape[1], self.n - i)
        if i < 0:
            st = st[:, -i:]
            m = min(st.shape[1], self.n)
            i = 0
        self.dry[:, i:i + m] += st[:, :m] * gain * (1 - rev * 0.5)
        self.wet[:, i:i + m] += st[:, :m] * gain * rev

    def render(self):
        ir_len = int(3.6 * SR)
        tt = np.arange(ir_len) / SR
        irs = []
        for ch in range(2):
            ir = noise(ir_len) * np.exp(-tt * 6.9 / 3.4)
            ir = lp(ir, 5200)
            ir[: int(0.012 * SR)] = 0
            irs.append(ir / np.sqrt(np.sum(ir ** 2)))
        wet = np.stack([fftconvolve(self.wet[ch], irs[ch])[: self.n] for ch in range(2)])
        out = self.dry + wet * 0.9
        # gentle master EQ: trim sub rumble below 28 Hz
        out = np.stack([hp(out[ch], 28) for ch in range(2)])
        peak = np.max(np.abs(out)) + 1e-9
        out = out / peak * 1.25
        out = np.tanh(out) / np.tanh(1.25)
        return out * 0.89


# ---------------------------------------------------------------------------
# The score
# ---------------------------------------------------------------------------
BEAT = 0.64  # 93.75 bpm; one eighth = 0.32 s = one fifth-step in the Z12 scene

DM = [38, 50, 57, 62, 65, 69]
CHORDS = {
    "Dm9": [38, 50, 57, 62, 64, 65, 69],
    "Bbmaj7": [34, 46, 53, 57, 62, 65, 69],
    "Fmaj7": [41, 53, 57, 60, 64, 69],
    "Cadd9": [36, 48, 55, 60, 62, 64, 67],
    "Gm7": [43, 55, 58, 62, 65, 70],
    "A": [45, 57, 61, 64, 69],
    "Dm": [38, 50, 57, 62, 65],
    "Bb": [34, 46, 53, 58, 62, 65],
    "F": [41, 53, 57, 60, 65],
    "C": [36, 48, 55, 60, 64, 67],
    "D": [38, 50, 57, 62, 66, 69],
    "Eb": [39, 51, 58, 63, 67, 70],
    "Gsus": [43, 55, 60, 62, 67],
}


def compose():
    S = timeline.start_of
    total = timeline.total_duration() + 3.0
    mx = Mix(total)

    # ---------------- A. Galois (0 - 16) --------------------------------
    mx.add(pad([38, 45, 50], 15.5, attack=3.0, release=2.0, cutoff=500), 0.0, 0.55, rev=0.3)
    motif = [(1.2, 69), (2.0, 74), (2.8, 77), (3.6, 76), (5.2, 74), (5.8, 72), (6.4, 69), (8.0, 70),
             (8.6, 69), (9.2, 67), (9.8, 69), (11.6, 74), (12.4, 72), (13.2, 70), (14.0, 69)]
    for t, m in motif:
        mx.add(piano(m, 2.5, 0.55), t, 0.9, pan=0.15, rev=0.5)
    for t, ch in ((1.2, [50, 57]), (5.2, [46, 53]), (8.0, [43, 50]), (11.6, [45, 52, 57])):
        for m in ch:
            mx.add(piano(m, 3.5, 0.4), t, 0.7, pan=-0.2, rev=0.5)
    # quill scratches while writing
    from .scenes.s00_galois import LINES
    for _, _, _, _, _, t0, dur in LINES:
        k = 0.0
        while k < dur:
            s = bp(noise(int(0.05 * SR)), 2200, 6000) * np.hanning(int(0.05 * SR)) * 0.022
            mx.add(s, t0 + k, 1.0, pan=0.3, rev=0.1)
            k += 0.07 + 0.08 * RNG.random()
    # heartbeat accelerating into the hit
    t = 10.5
    gap = 0.95
    while t < 15.4:
        mx.add(kick(0.55, 40, 0.5), t, 0.8, rev=0.2)
        mx.add(kick(0.35, 40, 0.5), t + 0.22, 0.8, rev=0.2)
        t += gap
        gap = max(0.42, gap * 0.86)
    mx.add(riser(3.2, 0.5), 12.8, 0.9, rev=0.3)
    mx.add(reverse_swell(1.6, 0.6), 14.4, 0.9, rev=0.2)

    # ---------------- B. Symmetry (16 - 39.2) ---------------------------
    t0 = S("symmetry")
    mx.add(boom(1.0, 7.0), t0, 1.2, rev=0.45)
    mx.add(shimmer(74, 5.0, 0.35), t0 + 0.05, 0.9, rev=0.6)
    prog = ["Dm9", "Bbmaj7", "Fmaj7", "Cadd9", "Dm9", "Bbmaj7"]
    for i, name in enumerate(prog):
        mx.add(pad(CHORDS[name], 4.2, attack=1.4, release=2.2, cutoff=1600), t0 + 1.0 + i * 3.84, 0.75, rev=0.5)
    # icy bell arpeggio in eighths
    arp_notes = {"Dm9": [74, 76, 77, 81, 86], "Bbmaj7": [70, 74, 77, 81, 82], "Fmaj7": [72, 76, 77, 81, 84],
                 "Cadd9": [72, 74, 76, 79, 84]}
    for i, name in enumerate(prog[:5]):
        for k in range(12):
            tt = t0 + 3.0 + i * 3.84 + k * 0.32
            if tt > t0 + 22.6:
                break
            seq = arp_notes[name]
            m = seq[(k * 2 + i) % len(seq)]
            mx.add(bell(m, 1.6, 0.18 + 0.05 * (k % 4 == 0)), tt, 0.8, pan=0.5 * math.sin(k * 1.3), rev=0.55)
    # Cayley table cells pop in: soft ticks along the diagonal wave
    for d in range(23):
        mx.add(tick(0.10, 2600 + 60 * d), t0 + 19.3 + d * 0.055, 1.0, pan=(d - 11) / 14, rev=0.3)
    # row/column sweep
    for k in range(12):
        mx.add(bell(86 - (k % 5) * 2, 0.8, 0.10), t0 + 22.0 + k * 0.25, 0.7, pan=(k - 6) / 8, rev=0.5)

    # ---------------- B2. Twelve tones -----------------------------------
    t0 = S("music")
    mx.add(pad([36, 43, 48, 55], 10.0, attack=1.5, release=2.5, cutoff=1100), t0 - 0.4, 0.7, rev=0.5)
    for k in range(12):
        mx.add(tick(0.07, 1800 + 120 * k), t0 + 0.4 + k * 0.08, 1.0, pan=math.sin(k), rev=0.4)
    fifths = [72, 79, 74, 81, 76, 83, 78, 73, 80, 75, 82, 77, 84]
    for i, ts in enumerate(s02_music.step_times()):
        m = fifths[i]
        mx.add(pluck(m, 2.0, 0.55, 0.997, 0.7), t0 + ts, 0.9, pan=0.6 * math.sin(i * 2.1), rev=0.45)
        mx.add(bell(m + 12, 1.4, 0.10), t0 + ts, 0.8, pan=-0.4 * math.sin(i * 2.1), rev=0.6)
        mx.add(pluck(m - 24, 1.2, 0.35, 0.995, 0.4), t0 + ts, 0.6, rev=0.3)
    tz = t0 + s02_music.step_times()[-1]
    mx.add(pad([48, 55, 60, 64, 67, 72], 4.5, attack=0.6, release=2.5, cutoff=2400), tz, 0.8, rev=0.55)
    mx.add(shimmer(84, 3.0, 0.3), tz, 0.8, rev=0.6)
    mx.add(riser(2.2, 0.45), S("rubik") - 2.2, 0.9, rev=0.25)

    # ---------------- C. Rubik + Solids (49.7 - 90) --------------------
    t0 = S("rubik")
    t_end = S("alhambra") + 0.6
    mx.add(boom(0.8, 4.0, 38), t0, 1.0, rev=0.35)
    bars = int((t_end - t0) / (4 * BEAT)) + 1
    prog = ["Dm", "Bb", "F", "C"]
    for b in range(bars):
        tb = t0 + b * 4 * BEAT
        if tb > t_end:
            break
        name = prog[(b // 2) % 4] if b % 2 == 0 else None
        if name:
            mx.add(pad(CHORDS[name], 8 * BEAT, attack=0.4, release=1.6, cutoff=1300 + 60 * b), tb, 0.55, rev=0.45)
        root = CHORDS[prog[(b // 2) % 4]][0] + 12
        intensity = min(1.0, b / 10)
        for k in range(8):  # eighth-note sub bass with pumping envelope
            tt = tb + k * BEAT / 2
            if tt > t_end:
                break
            n = int(BEAT / 2 * SR)
            x = np.arange(n) / SR
            s = np.sin(2 * math.pi * mtof(root) * x) * (1 - np.exp(-x / 0.02)) * np.exp(-x / 0.25)
            mx.add(np.tanh(s * 1.5) * 0.55, tt, 0.8, rev=0.05)
        # drums
        for k in range(4):
            tt = tb + k * BEAT
            if tt > t_end:
                break
            if k % 2 == 0 or b >= 6:
                mx.add(kick(0.9), tt, 0.85, rev=0.05)
            if b >= 8 and k % 2 == 1:
                mx.add(snare(0.6), tt, 0.7, rev=0.3)
            for h in range(2 if b < 4 else 4):
                mx.add(hat(0.22 if h % 2 == 0 else 0.14), tt + h * BEAT / (2 if b < 4 else 4), 0.6,
                       pan=0.3, rev=0.1)
        # 16th arp pluck (from bar 4)
        if b >= 4:
            tones = [m for m in CHORDS[prog[(b // 2) % 4]] if m >= 55][:4]
            for k in range(16):
                tt = tb + k * BEAT / 4
                if tt > t_end:
                    break
                m = tones[(k * 3) % len(tones)] + (12 if k % 8 >= 6 else 0)
                mx.add(pluck(m, 0.5, 0.25 + 0.1 * (k % 4 == 0), 0.993, 0.8), tt, 0.5 * intensity,
                       pan=0.4 * math.sin(k), rev=0.3)
    # cube twist clicks
    for m, tm, d in s03_rubik.SCHEDULE:
        mx.add(click(0.5), t0 + tm + 0.01, 0.9, pan=0.2 * RNG.standard_normal(), rev=0.15)
        mx.add(click(0.3), t0 + tm + d - 0.02, 0.9, pan=0.2 * RNG.standard_normal(), rev=0.15)
    mx.add(shimmer(81, 3.5, 0.4), t0 + s03_rubik.SOLVED_AT, 1.0, rev=0.6)
    mx.add(boom(0.5, 3.0, 45), t0 + s03_rubik.SOLVED_AT, 0.6, rev=0.4)
    # solids: whoosh on each morph, chime on the icosahedron snap, crystal shimmer
    ts = S("solids")
    for name, *_r, show_t0, _ in s04_solids.SOLIDS:
        mx.add(whoosh(0.9, 0.35), ts + show_t0 - s04_solids.MORPH - 0.1, 0.9, rev=0.3)
        mx.add(bell(74 + 3 * len(name) % 12, 2.0, 0.25), ts + show_t0, 0.8, rev=0.5)
    mx.add(shimmer(86, 2.5, 0.35), ts + 14.4, 0.9, rev=0.6)
    mx.add(whoosh(1.4, 0.45), ts + s04_solids.CRYSTAL_T - 0.2, 0.9, rev=0.3)
    mx.add(shimmer(74, 4.0, 0.35), ts + s04_solids.CRYSTAL_T + 1.2, 0.9, rev=0.6)

    # ---------------- D. Alhambra + hyperbolic (Phrygian dominant) ------
    t0 = S("alhambra")
    t1 = S("hyperbolic")
    mx.add(pad([38, 45, 50, 54, 57], t1 - t0 + 1, attack=1.0, release=3.0, cutoff=1400), t0, 0.7, rev=0.5)
    scale = [62, 63, 66, 67, 69, 70, 72, 74]
    melody = [0, 1, 2, 3, 4, 3, 2, 1, 2, 1, 0, 0, 4, 5, 4, 3, 2, 3, 2, 1, 0, 1, 2, 1, 0, 0, 0, 0]
    k = 0
    t = t0 + 1.0
    while t < t1 - 1.5:
        i = melody[k % len(melody)]
        dur = 0.32 if (k % 4) != 3 else 0.64
        mx.add(pluck(scale[i], 1.4, 0.6, 0.995, 0.75), t, 0.75, pan=0.25, rev=0.4)
        if k % 2 == 0:
            mx.add(pluck(scale[i] - 12, 1.0, 0.3, 0.993, 0.5), t, 0.6, pan=-0.25, rev=0.4)
        t += dur
        k += 1
    # maqsum frame-drum rhythm (D t - t D - t -)
    pat = [(0, True), (1, False), (3, False), (4, True), (6, False)]
    b = 0
    while t0 + b * 8 * BEAT / 2 < t1 - 0.5:
        tb = t0 + b * 4 * BEAT
        for pos, low in pat:
            tt = tb + pos * BEAT / 2
            if tt < t1 - 0.3:
                mx.add(frame_drum(low, 0.8 if low else 0.5), tt, 0.8, pan=-0.1 if low else 0.2, rev=0.3)
        b += 1
    # tile reveal sparkle
    for i in range(30):
        mx.add(tick(0.06, 2000 + 90 * i), t0 + 0.3 + i * 0.14, 1.0, pan=math.sin(i), rev=0.5)
    # hyperbolic: ethereal swell
    mx.add(reverse_swell(1.2, 0.4), t1 - 1.2, 0.8, rev=0.4)
    mx.add(pad([38, 50, 57, 62, 66, 69, 76], 14.0, attack=2.0, release=3.0, cutoff=2600, detune=0.12), t1, 0.65,
           rev=0.6)
    for i in range(18):
        m = [74, 78, 81, 86, 85, 81, 78, 76][i % 8]
        mx.add(bell(m, 2.0, 0.14), t1 + 0.8 + i * 0.72, 0.8, pan=math.sin(i * 1.7) * 0.6, rev=0.65)
    mx.add(boom(0.5, 3.0, 40), t1 + 7.0, 0.6, rev=0.5)
    mx.add(shimmer(81, 3.0, 0.3), t1 + 7.0, 0.8, rev=0.6)

    # ---------------- E. Quintic -------------------------------------------
    t0 = S("quintic")
    mx.add(pad([38, 45], 14.0, attack=2.5, release=2.0, cutoff=420), t0, 0.8, rev=0.4)
    for st, ch in ((2.6, [50, 57, 62]), (5.4, [46, 53, 58]), (8.2, [43, 50, 55]), (10.9, [45, 52, 57, 61])):
        mx.add(tom(38, 0.9), t0 + st, 0.9, rev=0.4)
        mx.add(boom(0.35, 2.5, 42), t0 + st, 0.6, rev=0.4)
        for m in ch:
            mx.add(piano(m + 12, 2.6, 0.55), t0 + st, 0.8, rev=0.5)
    # rising string ostinato under the quartic and quintic
    for k in range(int((13.6 - 7.6) / 0.16)):
        tt = t0 + 7.6 + k * 0.16
        m = [62, 65, 69, 65][k % 4] + (1 if tt - t0 > 10.9 and k % 4 == 1 else 0)
        n = int(0.15 * SR)
        s = _saw(mtof(m), n, SR, 0.0) * np.hanning(n)
        mx.add(lp(s, 900 + 200 * k / 10) * (0.10 + 0.25 * k / 38), tt, 0.8, pan=0.3 * math.sin(k), rev=0.3)
    mx.add(riser(2.0, 0.5), t0 + 11.6, 0.8, rev=0.3)
    # the '?' shatters
    tsh = t0 + 13.6
    mx.add(boom(0.6, 3.0, 44), tsh, 0.8, rev=0.4)
    glass = hp(noise(int(0.6 * SR)), 3000) * np.exp(-np.arange(int(0.6 * SR)) / (0.12 * SR))
    mx.add(glass * 0.5, tsh, 0.9, rev=0.5)
    for i in range(40):
        mx.add(bell(88 + int(RNG.integers(0, 14)), 0.6, 0.06), tsh + RNG.random() * 1.2, 0.8,
               pan=RNG.uniform(-0.8, 0.8), rev=0.6)
    # braid: mysterious pad and a 5-note motif
    tb = t0 + s07_quintic.BRAID_T0
    mx.add(pad(CHORDS["Gm7"], 3.2, attack=1.0, release=2.0, cutoff=1500), tb - 0.4, 0.6, rev=0.55)
    mx.add(pad(CHORDS["Eb"], 3.4, attack=1.0, release=2.0, cutoff=1500), tb + 2.8, 0.6, rev=0.55)
    five = [74, 77, 81, 79, 76]
    for i in range(15):
        mx.add(bell(five[i % 5], 1.5, 0.16), tb + i * 0.4, 0.8, pan=(i % 5 - 2) / 3, rev=0.6)
    tl = t0 + s07_quintic.LIT_T0 + 0.2
    mx.add(riser(2.6, 0.55), tl - 2.6, 0.9, rev=0.3)
    mx.add(reverse_swell(1.0, 0.5), tl - 1.0, 0.8, rev=0.3)
    mx.add(boom(1.0, 7.0, 32), tl, 1.2, rev=0.5)
    mx.add(pad([26, 38, 45, 50, 57, 62, 64, 69, 74], 7.5, attack=0.3, release=3.5, cutoff=2600, detune=0.14), tl,
           0.9, rev=0.6)
    mx.add(shimmer(86, 5.0, 0.35), tl, 0.9, rev=0.7)

    # ---------------- F. Elliptic curves ----------------------------------
    t0 = S("elliptic")
    t1 = S("physics") + 0.6
    mx.add(pad(CHORDS["Dm"], 10.0, attack=1.5, release=2.0, cutoff=900), t0, 0.5, rev=0.5)
    mx.add(pad(CHORDS["Bb"], 10.0, attack=1.0, release=2.0, cutoff=1300), t0 + 10.0, 0.5, rev=0.5)
    seq = [62, 65, 69, 72, 74, 72, 69, 65]
    k = 0
    tt = t0 + 0.6
    while tt < t1 - 0.4:
        lvl = 0.25 + 0.35 * min(1, (tt - t0) / 12)
        m = seq[k % 8] + (12 if (k // 32) % 2 == 1 else 0)
        n = int(0.14 * SR)
        s = _svf(_saw(mtof(m), n, SR, 0.0), np.full(n, 1400 + 1800 * lvl), 0.5, SR, 0) * expdecay(n, 0.05)
        mx.add(s * lvl, tt, 0.6, pan=0.5 * math.sin(k * 0.7), rev=0.35)
        k += 1
        tt += BEAT / 4
    for b in range(int((t1 - (t0 + 11.0)) / BEAT)):
        tt = t0 + 11.0 + b * BEAT
        mx.add(kick(0.85), tt, 0.8, rev=0.05)
        mx.add(hat(0.2), tt + BEAT / 2, 0.6, pan=0.3, rev=0.1)
        if b % 2 == 1:
            mx.add(snare(0.45), tt, 0.6, rev=0.3)
    for i in range(60):  # hops on the finite curve
        mx.add(tick(0.07, 1500 + 37 * (i % 23)), t0 + 13.2 + i * 0.085, 1.0, pan=math.sin(i * 1.3) * 0.7, rev=0.3)
    mx.add(whoosh(1.0, 0.4), t0 + 10.5, 0.9, rev=0.3)

    # ---------------- G. Physics ------------------------------------------
    t0 = S("physics")
    for i, (name, dur) in enumerate((("F", 3.6), ("C", 3.6), ("Dm", 3.6), ("Bb", 3.6))):
        mx.add(pad(CHORDS[name], dur, attack=0.8, release=2.0, cutoff=1500), t0 + i * 3.6, 0.6, rev=0.5)
    for i in range(3):
        mx.add(tom(45 + 3 * i, 0.6), t0 + 1.0 + i * 0.5, 0.7, rev=0.4)
        mx.add(bell(77 + 2 * i, 2.0, 0.2), t0 + 3.8 + i * 0.3, 0.8, rev=0.5)
    # decuplet: rising toms as rows appear, suspense under the empty slot
    for row in range(3):
        mx.add(tom(41 + 4 * row, 0.7), t0 + 7.6 + row * 0.6, 0.8, rev=0.4)
    mx.add(pad([43, 50, 55, 62, 67], 5.5, attack=1.2, release=1.0, cutoff=1100), t0 + 8.0, 0.6, rev=0.5)
    for k in range(int((13.8 - 10.8) / 0.32)):
        mx.add(tick(0.10, 900), t0 + 10.8 + k * 0.32, 1.0, rev=0.3)
        mx.add(kick(0.35, 44, 0.4), t0 + 10.8 + k * 0.32, 0.7, rev=0.1)
    mx.add(riser(1.6, 0.45), t0 + 12.2, 0.8, rev=0.3)
    mx.add(boom(0.85, 5.0, 36), t0 + 13.8, 1.0, rev=0.5)
    mx.add(pad(CHORDS["Gsus"], 3.0, attack=0.1, release=2.5, cutoff=2400), t0 + 13.8, 0.8, rev=0.55)
    mx.add(shimmer(79, 3.0, 0.35), t0 + 13.8, 0.9, rev=0.6)
    # E8: from chaos to symmetry
    from .scenes.s09_physics import E8_SNAP
    mx.add(pad([38, 45, 50, 57], 3.0, attack=1.0, release=1.0, cutoff=700), t0 + 16.4, 0.6, rev=0.5)
    mx.add(riser(2.4, 0.6), t0 + E8_SNAP - 2.4, 1.0, rev=0.3)
    mx.add(reverse_swell(1.2, 0.6), t0 + E8_SNAP - 1.2, 0.9, rev=0.3)
    mx.add(boom(1.0, 7.0, 31), t0 + E8_SNAP, 1.25, rev=0.5)
    mx.add(pad([26, 38, 45, 50, 57, 62, 65, 69, 74, 76], 6.0, attack=0.2, release=3.0, cutoff=3000, detune=0.15),
           t0 + E8_SNAP, 0.95, rev=0.6)
    mx.add(shimmer(86, 5.0, 0.4), t0 + E8_SNAP, 0.9, rev=0.7)
    for b in range(int((25.0 - E8_SNAP) / BEAT)):
        mx.add(tom(38 if b % 2 == 0 else 33, 0.6), t0 + E8_SNAP + 0.64 + b * BEAT, 0.6, rev=0.4)

    # ---------------- H. Finale -------------------------------------------
    t0 = S("finale")
    mx.add(pad([26, 33, 38], 7.0, attack=1.0, release=1.0, cutoff=380), t0, 0.9, rev=0.4)
    for idx in range(54):  # digits locking in
        mx.add(click(0.35), t0 + 0.6 + idx * 0.045, 0.8, pan=(idx % 27 - 13) / 16, rev=0.2)
    mx.add(boom(0.6, 3.0, 40), t0 + 3.2, 0.7, rev=0.4)
    mx.add(riser(2.4, 0.5), t0 + s10_finale.MONTAGE_T0 - 2.4, 0.9, rev=0.3)
    # montage: hits on every cut, driving drums underneath
    tm0 = t0 + s10_finale.MONTAGE_T0
    tm1 = t0 + s10_finale.MONTAGE_T1
    prog = ["Dm", "Bb", "F", "C", "Dm", "Bb", "Gm7", "A"]
    seg_len = (tm1 - tm0) / len(prog)
    for i, name in enumerate(prog):
        mx.add(pad(CHORDS[name], seg_len, attack=0.05, release=0.6, cutoff=2600), tm0 + i * seg_len, 0.7, rev=0.4)
    for i, (c0, c1, name, lt) in enumerate(s10_finale.CUTS):
        mx.add(boom(0.45, 1.5, 44), t0 + c0, 0.55, rev=0.3)
        mx.add(kick(1.0), t0 + c0, 0.9, rev=0.05)
        mx.add(snare(0.5), t0 + c0, 0.4, rev=0.4)
        mx.add(hat(0.3, True), t0 + (c0 + c1) / 2, 0.5, pan=0.3, rev=0.2)
        mx.add(bell(74 + [0, 3, 7, 10, 12, 15, 19][i % 7], 1.0, 0.15), t0 + c0, 0.8, rev=0.5)
    mx.add(riser(2.2, 0.7), t0 + s10_finale.TITLE_T0 - 2.2, 1.0, rev=0.3)
    mx.add(reverse_swell(1.4, 0.7), t0 + s10_finale.TITLE_T0 - 1.4, 1.0, rev=0.3)
    tt = t0 + s10_finale.TITLE_T0
    mx.add(boom(1.0, 8.0, 30), tt, 1.35, rev=0.55)
    mx.add(pad([26, 38, 45, 50, 54, 57, 62, 66, 69, 74], 6.5, attack=0.15, release=4.0, cutoff=2800, detune=0.14),
           tt, 1.0, rev=0.65)
    mx.add(shimmer(86, 6.0, 0.45), tt, 1.0, rev=0.7)
    # Poincaré: quiet piano in D major
    tq = t0 + 20.6
    for i, m in enumerate([62, 66, 69, 74, 73, 69, 71, 74]):
        mx.add(piano(m, 3.0, 0.45), tq + i * 0.55, 0.8, pan=0.2 * math.sin(i), rev=0.6)
    mx.add(pad([38, 50, 57, 62, 66], 4.5, attack=1.5, release=2.5, cutoff=900), tq, 0.6, rev=0.6)

    out = mx.render()
    # master fade-in/out
    fade_in = int(0.3 * SR)
    out[:, :fade_in] *= np.linspace(0, 1, fade_in)
    end = int(timeline.total_duration() * SR)
    tail = out.shape[1] - end
    if tail > 0:
        out[:, end:] *= np.linspace(1, 0, tail) ** 2
    return out[:, : end + int(1.0 * SR)]


def write_wav(path, stereo):
    data = (np.clip(stereo.T, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == "__main__":
    out = compose()
    write_wav(sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav", out)
    print("wrote", out.shape[1] / SR, "s")
