"""Low-discrepancy sub-frame samples: pixel jitter, shutter time, lens position."""
import math

import numpy as np


def radical_inverse(i, base):
    f, r = 1.0, 0.0
    while i > 0:
        f /= base
        r += f * (i % base)
        i //= base
    return r


def concentric_disk(u, v):
    a, b = 2 * u - 1, 2 * v - 1
    if a == 0 and b == 0:
        return 0.0, 0.0
    if abs(a) > abs(b):
        r, phi = a, (math.pi / 4) * (b / a)
    else:
        r, phi = b, math.pi / 2 - (math.pi / 4) * (a / b)
    return r * math.cos(phi), r * math.sin(phi)


def frame_samples(n, frame_index, fps, shutter=0.5, filter_radius=0.75):
    """Return a list of (jitter_xy, dt, lens_xy, seed) for one frame.

    dt is the time offset (seconds) from the frame's nominal time; the shutter
    is centred on the frame (180 degrees by default).
    """
    out = []
    rot = (frame_index * 0.6180339887) % 1.0  # Cranley-Patterson rotation per frame
    for i in range(n):
        u = (radical_inverse(i + 1, 2) + rot) % 1.0
        v = (radical_inverse(i + 1, 3) + rot) % 1.0
        # tent filter for smoother antialiasing
        def tent(x):
            x = 2 * x
            return (math.sqrt(x) - 1) if x < 1 else (1 - math.sqrt(2 - x))
        jx, jy = tent(u) * filter_radius, tent(v) * filter_radius
        ts = ((i + 0.5) / n + 0.37 * rot) % 1.0 if n > 1 else 0.5
        dt = (ts - 0.5) * shutter / fps
        lu = (radical_inverse(i + 1, 5) + rot) % 1.0
        lv = (radical_inverse(i + 1, 7) + rot) % 1.0
        lx, ly = concentric_disk(lu, lv)
        seed = (frame_index * 97.0 + i * 13.37) % 1000.0
        out.append(((jx, jy), dt, (lx, ly), seed))
    return out
