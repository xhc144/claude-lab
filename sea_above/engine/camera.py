"""Camera rigs: keyframed splines, easing, look-at, and organic "operator" drift."""
import math

import numpy as np


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def smootherstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * t * (t * (t * 6 - 15) + 10)


def ease_in_out(x, p=2.0):
    x = min(max(x, 0.0), 1.0)
    return x ** p / (x ** p + (1 - x) ** p)


def mix(a, b, t):
    return a + (b - a) * t


class Track:
    """Piecewise cubic Hermite interpolation of keyframes (t, value).

    Tangents follow Catmull-Rom with non-uniform knot spacing, which gives
    C1-continuous, natural-looking motion through every key. Values can be
    scalars or vectors. Optional per-key tangent override via `tangents`.
    """

    def __init__(self, keys, tangents=None):
        self.t = np.array([k[0] for k in keys], np.float64)
        self.v = np.array([np.atleast_1d(np.asarray(k[1], np.float64)) for k in keys])
        n = len(keys)
        m = np.zeros_like(self.v)
        for i in range(n):
            if tangents and i in tangents:
                m[i] = np.atleast_1d(tangents[i])
            elif i == 0 or i == n - 1:
                m[i] = 0.0  # ease in/out at the ends
            else:
                m[i] = (self.v[i + 1] - self.v[i - 1]) / (self.t[i + 1] - self.t[i - 1])
        self.m = m
        self.scalar = np.ndim(keys[0][1]) == 0

    def __call__(self, t):
        ts, v, m = self.t, self.v, self.m
        if t <= ts[0]:
            r = v[0]
        elif t >= ts[-1]:
            r = v[-1]
        else:
            i = int(np.searchsorted(ts, t) - 1)
            h = ts[i + 1] - ts[i]
            s = (t - ts[i]) / h
            h00 = 2 * s ** 3 - 3 * s ** 2 + 1
            h10 = s ** 3 - 2 * s ** 2 + s
            h01 = -2 * s ** 3 + 3 * s ** 2
            h11 = s ** 3 - s ** 2
            r = h00 * v[i] + h10 * h * m[i] + h01 * v[i + 1] + h11 * h * m[i + 1]
        return float(r[0]) if self.scalar else r.copy()


def look_at(pos, target, up=(0, 1, 0), roll=0.0):
    pos = np.asarray(pos, np.float64)
    f = np.asarray(target, np.float64) - pos
    f /= np.linalg.norm(f)
    return basis_from_forward(f, up, roll)


def basis_from_forward(f, up=(0, 1, 0), roll=0.0):
    f = np.asarray(f, np.float64)
    f = f / np.linalg.norm(f)
    up = np.asarray(up, np.float64)
    r = np.cross(f, up)
    if np.linalg.norm(r) < 1e-6:
        r = np.cross(f, np.array([0, 0, 1.0]))
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    if roll:
        c, s = math.cos(roll), math.sin(roll)
        r, u = c * r + s * u, -s * r + c * u
    return np.stack([r, u, f], axis=1)  # columns


def rot_axis(axis, ang):
    axis = np.asarray(axis, np.float64)
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s = math.cos(ang), math.sin(ang)
    C = 1 - c
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


class Drift:
    """Smooth pseudo-random drift, like a camera operator breathing."""

    def __init__(self, seed, freqs=(0.11, 0.23, 0.41), amps=(1.0, 0.5, 0.25)):
        rng = np.random.default_rng(seed)
        self.terms = [(f * rng.uniform(0.8, 1.25), a, rng.uniform(0, 2 * np.pi, 3)) for f, a in zip(freqs, amps)]

    def __call__(self, t):
        out = np.zeros(3)
        for f, a, ph in self.terms:
            out += a * np.sin(2 * np.pi * f * t + ph)
        return out


def fov_from_focal(mm, sensor_h=24.0):
    """Vertical tan(fov/2) for a lens focal length on a full-frame (2.39 crop) sensor."""
    return (sensor_h * 0.5) / mm
