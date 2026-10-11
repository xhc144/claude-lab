"""Small procedural-texture helpers (value-noise fbm via numpy/cv2)."""
import numpy as np
import cv2


def fbm(w, h, octaves=6, base=4, persistence=0.55, seed=0):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        n = base * (2 ** o)
        g = rng.random((max(2, int(n * h / w) + 2), n + 2)).astype(np.float32)
        up = cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC)
        out += amp * up
        total += amp
        amp *= persistence
    out /= total
    out -= out.min()
    out /= max(out.max(), 1e-6)
    return out
