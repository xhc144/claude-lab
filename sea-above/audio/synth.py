"""A small offline synthesizer: oscillators, envelopes, filters, instruments,
sound effects and a convolution reverb. Everything is numpy / scipy."""
import numpy as np
from scipy import signal

SR = 48000
_rng = np.random.default_rng(7)


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, float) - 69.0) / 12.0)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def n2m(name):
    """'F#4' -> midi number."""
    pitch, octv = name[:-1], int(name[-1])
    return 12 * (octv + 1) + NOTE[pitch]


def hz(name):
    return float(mtof(n2m(name)))


def tvec(dur):
    return np.arange(int(round(dur * SR))) / SR


# ---------------------------------------------------------------- envelopes
def adsr(n, a, d, s, r, sustain_level=None):
    """n samples; a/d/r in seconds; s = sustain level. Release occupies the end."""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    env = np.full(n, s, np.float64)
    a = min(a, n)
    env[:a] = np.linspace(0, 1, a, endpoint=False) ** 1.5 if a else env[:a]
    d = min(d, max(n - a, 0))
    if d:
        env[a:a + d] = 1 + (s - 1) * (1 - np.exp(-5 * np.linspace(0, 1, d))) / (1 - np.exp(-5))
    r = min(r, n)
    if r:
        env[n - r:] *= np.linspace(1, 0, r) ** 2
    return env


def swell(n, att_frac=0.5, curve=2.0):
    x = np.linspace(0, 1, n)
    up = np.clip(x / att_frac, 0, 1) ** curve
    down = np.clip((1 - x) / (1 - att_frac), 0, 1) ** 1.5
    return up * down


# ---------------------------------------------------------------- oscillators
def _blep(t, dt):
    """polyBLEP residual for a sawtooth (t = phase in [0,1), dt = phase increment)."""
    out = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    out[m] = x + x - x * x - 1.0
    m = t > 1.0 - dt
    x = (t[m] - 1.0) / dt[m]
    out[m] = x * x + x + x + 1.0
    return out


def saw(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,)).astype(float)
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    return 2.0 * ph - 1.0 - _blep(ph, dt)


def sine(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    ph = phase0 + 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph)


def noise(n):
    return _rng.standard_normal(n)


def pink(n):
    w = np.fft.rfft(_rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    return np.fft.irfft(w / np.sqrt(f), n) * 30.0


def brown(n):
    x = np.cumsum(_rng.standard_normal(n))
    x = signal.sosfilt(signal.butter(1, 20, "hp", fs=SR, output="sos"), x)
    return x / (np.abs(x).max() + 1e-9)


# ---------------------------------------------------------------- filters
def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, min(fc, SR * 0.45), "lp", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "hp", fs=SR, output="sos"), x)


def bp(x, f0, q):
    bw = f0 / q
    lo, hi = max(f0 - bw / 2, 10), min(f0 + bw / 2, SR * 0.45)
    return signal.sosfilt(signal.butter(2, [lo, hi], "bp", fs=SR, output="sos"), x)


def svf_lp(x, fc, q=0.7):
    """Time-varying state-variable low-pass (fc may be an array)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 10, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    out = np.empty_like(x)
    ic1 = ic2 = 0.0
    for i in range(len(x)):
        v3 = x[i] - ic2
        v1 = a1[i] * ic1 + g[i] * a1[i] * v3
        v2 = ic2 + g[i] * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v2
    return out


def svf_bp(x, fc, q=2.0):
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 10, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    out = np.empty_like(x)
    ic1 = ic2 = 0.0
    for i in range(len(x)):
        v3 = x[i] - ic2
        v1 = a1[i] * ic1 + g[i] * a1[i] * v3
        v2 = ic2 + g[i] * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v1
    return out


# ---------------------------------------------------------------- instruments (mono)
def pad_note(f, dur, att=2.0, rel=3.0, cutoff=1400.0, detune=0.007, bright=0.0):
    n = int((dur + rel) * SR)
    x = np.zeros(n)
    for d in (-detune, 0.0, detune * 0.7):
        x += saw(f * (1 + d), n, _rng.random())
    x += 0.8 * sine(f * 0.5, n)
    x = lp(x, cutoff * (1 + bright), 2)
    env = adsr(n, att, 0.5, 0.85, rel)
    trem = 1 + 0.06 * np.sin(2 * np.pi * (0.13 + 0.05 * _rng.random()) * np.arange(n) / SR + _rng.random() * 6)
    return x * env * trem * 0.18


def string_note(f, dur, att=1.5, rel=2.5, cutoff=2600.0):
    n = int((dur + rel) * SR)
    tt = np.arange(n) / SR
    vib = 1 + 0.0035 * np.sin(2 * np.pi * 5.1 * tt + _rng.random() * 6) * np.clip(tt / 1.2, 0, 1)
    x = np.zeros(n)
    for d in (-0.004, 0.0, 0.0045, 0.009):
        x += saw(f * (1 + d) * vib, n, _rng.random())
    x = lp(x, cutoff, 2)
    x = x - 0.6 * lp(x, 180, 1)          # thin the low end
    env = adsr(n, att, 0.4, 0.9, rel)
    return x * env * 0.1


VOWEL_A = ((750, 1.0, 9), (1150, 0.6, 10), (2800, 0.25, 14), (3500, 0.12, 16))


def choir_note(f, dur, att=1.8, rel=2.5, vowel=VOWEL_A):
    n = int((dur + rel) * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for v in range(3):        # three voices per note
        vib = 1 + 0.004 * np.sin(2 * np.pi * (5.2 + 0.4 * v) * tt + _rng.random() * 6)
        src = saw(f * (1 + 0.003 * (v - 1)) * vib, n, _rng.random()) + 0.15 * noise(n)
        for fr, g, q in vowel:
            out += bp(src, fr, q) * g
    out = lp(out, 4500)
    env = adsr(n, att, 0.5, 0.9, rel)
    return out * env * 0.12


def piano_note(f, vel=0.7, dur=6.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    B = 0.00035
    tau0 = 4.5 * (220.0 / f) ** 0.45
    for k in range(1, 14):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 16000:
            break
        amp = (1.0 / k ** 1.25) * (0.6 + 0.4 * vel) ** (k * 0.3)
        tau = tau0 / (1 + 0.35 * (k - 1))
        for det in (-0.35, 0.35):     # two strings, slightly apart
            x += amp * np.sin(2 * np.pi * (fk + det) * tt + _rng.random() * 6) * np.exp(-tt / tau)
    ham = lp(noise(int(0.012 * SR)), 3000) * np.linspace(1, 0, int(0.012 * SR)) ** 2 * 0.3
    x[:len(ham)] += ham
    att = np.clip(tt / 0.004, 0, 1)
    return x * att * vel * 0.12


def bell(f, dur=4.0, idx=2.2, ratio=3.5, decay=1.6, gain=0.12):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    I = idx * np.exp(-tt / (decay * 0.4))
    x = np.sin(2 * np.pi * f * tt + I * np.sin(2 * np.pi * f * ratio * tt))
    x += 0.35 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt / (decay * 0.5))
    x += 0.2 * np.sin(2 * np.pi * f * 4.07 * tt) * np.exp(-tt / (decay * 0.25))
    env = np.exp(-tt / decay) * np.clip(tt / 0.002, 0, 1)
    return x * env * gain


def sub(f, dur, att=2.0, rel=3.0, gain=0.25):
    n = int((dur + rel) * SR)
    x = sine(f, n) + 0.15 * sine(2 * f, n)
    return x * adsr(n, att, 0.5, 1.0, rel) * gain


# ---------------------------------------------------------------- water & air
def plip(f0=900.0, f1=2600.0, dur=0.07, gain=0.2):
    """A drop leaving a surface: a quick upward-chirping resonance."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 * (f1 / f0) ** np.clip(tt / (dur * 0.6), 0, 1)
    x = sine(f, n) * np.exp(-tt / (dur * 0.35)) * np.clip(tt / 0.001, 0, 1)
    return x * gain


def bubble(f0, gain=0.1):
    tau = 0.004 + 3.0 / f0
    n = int(tau * 6 * SR)
    tt = np.arange(n) / SR
    f = f0 * (1 + 0.6 * tt / (tau * 6))
    return sine(f, n) * np.exp(-tt / tau) * gain


def bubbles(dur, rate, fmin=500, fmax=3500, gain=0.08):
    n = int(dur * SR)
    out = np.zeros(n + SR)
    k = int(rate * dur)
    for _ in range(k):
        t0 = int(_rng.random() ** 1.3 * n)
        f = fmin * (fmax / fmin) ** _rng.random()
        b = bubble(f, gain * (0.3 + 0.7 * _rng.random()))
        out[t0:t0 + len(b)] += b
    return out[:n]


def splash(gain=0.6):
    n = int(1.6 * SR)
    tt = np.arange(n) / SR
    x = svf_bp(noise(n), 3500 * np.exp(-tt * 2.5) + 300, 0.9) * np.exp(-tt / 0.25)
    x += 0.9 * sine(70 * np.exp(-tt * 1.5) + 35, n) * np.exp(-tt / 0.35)
    return x * gain


def whoosh(dur, f0=200.0, f1=2500.0, gain=0.3, rise=True):
    n = int(dur * SR)
    x = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** (x if rise else 1 - x)
    env = (x if rise else 1 - x) ** 2.2
    y = svf_bp(pink(n) * 0.05, fc, 1.4)
    return y * env * gain


def water_lap(dur, gain=0.12):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    env = np.zeros(n)
    t = 0.0
    while t < dur:
        c = int(t * SR)
        L = int((0.9 + 1.2 * _rng.random()) * SR)
        e = swell(L, 0.3) * (0.4 + 0.6 * _rng.random())
        env[c:c + L] += e[:max(0, min(L, n - c))]
        t += 1.2 + 1.8 * _rng.random()
    x = lp(brown(n), 900) * 1.8 + hp(noise(n), 3000) * 0.015 * env
    return x * (0.15 + env) * gain


def wind(dur, gain=0.08, fc=500.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    mod = 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * tt) * np.sin(2 * np.pi * 0.11 * tt + 1.0)
    return lp(pink(n), fc) * 0.04 * mod * gain / 0.08


def shimmer(dur, density=6.0, fmin=3500, fmax=9000, gain=0.03):
    n = int(dur * SR)
    out = np.zeros(n + SR)
    for _ in range(int(density * dur)):
        t0 = int(_rng.random() * n)
        f = fmin * (fmax / fmin) ** _rng.random()
        b = bell(f, 0.9, idx=0.6, ratio=2.0, decay=0.25, gain=gain * (0.3 + _rng.random()))
        out[t0:t0 + len(b)] += b
    return out[:n]


def rumble(dur, gain=0.3):
    n = int(dur * SR)
    return lp(brown(n), 90, 4) * swell(n, 0.6) * gain


def boom(gain=0.5):
    n = int(4.0 * SR)
    tt = np.arange(n) / SR
    x = sine(55 * np.exp(-tt * 0.6) + 30, n) * np.exp(-tt / 1.2)
    x += lp(noise(n), 180) * np.exp(-tt / 0.3) * 0.5
    return x * gain


def whale_call(dur, f_a, f_b, f_c, gain=0.3, bright=1.0):
    """A humpback moan gliding a -> b -> c, rich in harmonics, slightly rough."""
    n = int(dur * SR)
    x = np.linspace(0, 1, n)
    lf = np.log(f_a) * (1 - x) ** 2 + 2 * np.log(f_b) * x * (1 - x) + np.log(f_c) * x ** 2
    f = np.exp(lf) * (1 + 0.012 * np.sin(2 * np.pi * 4.5 * x * dur))
    out = np.zeros(n)
    for k, a in enumerate((1.0, 0.7, 0.5, 0.25, 0.15, 0.08), start=1):
        out += a * sine(f * k, n, _rng.random())
    rough = 1 + 0.25 * lp(noise(n), 40)
    out = out * rough
    out = lp(out, 1800 * bright)
    env = swell(n, 0.35, 1.5)
    return out * env * gain


def whale_whistle(dur, f_a, f_b, gain=0.08):
    n = int(dur * SR)
    x = np.linspace(0, 1, n)
    f = f_a * (f_b / f_a) ** (x ** 0.7)
    return sine(f, n) * swell(n, 0.4) * gain


# ---------------------------------------------------------------- space
def reverb_ir(seconds=4.5, damp=0.6, seed=3):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    irs = []
    for ch in range(2):
        x = rng.standard_normal(n) * np.exp(-tt * 6.9 / seconds)
        # darker as it decays
        lo = lp(x, 2500)
        mix = np.clip(tt / seconds * 2 * damp, 0, 1)
        x = x * (1 - mix) + lo * mix
        x[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        irs.append(x / np.sqrt(np.sum(x ** 2)))
    return np.stack(irs, 1)


def convolve_stereo(x, ir):
    """x: (n, 2); ir: (m, 2)."""
    out = np.zeros((len(x) + len(ir) - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(x[:, c], ir[:, c])
    return out[:len(x)]


def pan(x, p):
    """p in [-1, 1] -> (n, 2) equal-power."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)
