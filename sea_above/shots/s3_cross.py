"""SHOT 3 - Crossing.

A spiralling flight up one of the water columns into the sea overhead. We
plunge through its underside in a burst of bubbles, then rise through the
water itself - bright with the day below, darkening toward night above - as
a humpback whale glides past.
"""
import math

import numpy as np

from engine.camera import look_at, rot_axis, Drift, smoothstep, ease_in_out
from shots.base import Shot

SUN = np.array([0.48, 0.125, -1.0])
SUN /= np.linalg.norm(SUN)
AXIS = np.array([-205.0, 0.0, -1245.0])        # column 0 (x, -, z)
SUNH = np.array([SUN[0], 0.0, SUN[2]]) / np.linalg.norm([SUN[0], SUN[2]])


class Crossing(Shot):
    name = "s3_cross"
    shader = "shot3.glsl"
    duration = 9.0
    spp = 4
    T_CROSS = 2.2

    def __init__(self):
        self.drift = Drift(21, freqs=(0.2, 0.37, 0.61), amps=(1.0, 0.5, 0.25))
        # start on the shadow side, looking toward the low sun through the column
        self.theta0 = math.atan2(-SUNH[2], -SUNH[0]) + 0.25

    START = np.array([-150.0, 215.0, -1050.0])

    def _outside(self, t):
        """Rushing straight up at the sea's underside, the whale looming above it."""
        x = min(t / self.T_CROSS, 1.0)
        y = 215.0 + (432.0 - 215.0) * (0.55 * x + 0.45 * x * x)
        pos = self.START + np.array([12.0 * x, y - 215.0, -8.0 * x])
        # look up at ~50 degrees, toward the whale's side, so the glowing rim stays in frame
        wp = np.asarray(self.whale_pos(self.T_CROSS + 2.0)[:3])
        dh = (wp - pos) * np.array([1.0, 0.0, 1.0])
        dh /= np.linalg.norm(dh)
        pitch = math.radians(48.0 + 22.0 * smoothstep(0.6, self.T_CROSS, t))
        tgt = pos + dh * math.cos(pitch) * 100.0 + np.array([0.0, math.sin(pitch) * 100.0, 0.0])
        return pos, tgt

    def camera(self, t):
        if t <= self.T_CROSS:
            pos, tgt = self._outside(t)
            fov = 0.46
        else:
            p0, _ = self._outside(self.T_CROSS)
            tau = t - self.T_CROSS
            dur = self.duration - self.T_CROSS
            # the plunge carries us up, then the water slows us down
            rise = 150.0 * (1 - math.exp(-tau / 1.4)) / (1 - math.exp(-dur / 1.4))
            pos = p0 + np.array([0.0, rise, 0.0])
            wp = np.asarray(self.whale_pos(t)[:3])
            up = pos + np.array([0.0, 100.0, 0.0])
            w1 = smoothstep(0.2, 1.8, tau)
            # settle on a slow pan while the whale glides across the frame
            mid = np.asarray(self.whale_pos(self.T_CROSS + 3.4)[:3])
            hd = self.whale_pos(t)[3]
            pan = mid + np.array([math.sin(hd), 0.0, math.cos(hd)]) * (14.0 * (tau - 3.4))
            tgt = up * (1 - w1) + pan * w1
            fov = 0.46 - 0.04 * smoothstep(0.0, 2.0, tau)
        pos = pos + self.drift(t) * 0.6
        return dict(pos=pos, rot=look_at(pos, tgt), tanfov=fov)

    def whale_pos(self, t):
        # a colossal humpback crossing in front of the rising camera
        p0 = self.START + np.array([12.0, 217.0, -8.0])       # where we cross the surface
        tau = t - self.T_CROSS
        heading = 0.9
        d = np.array([math.sin(heading), 0.0, math.cos(heading)])
        perp = np.array([d[2], 0.0, -d[0]])
        c = p0 + perp * 120.0 + d * (-120.0 + 16.0 * tau) + np.array([0.0, 120.0 + 4.0 * tau, 0.0])
        return (c[0], c[1], c[2], heading)

    def uniforms(self, t):
        p0, _ = self._outside(self.T_CROSS)
        burst = smoothstep(self.T_CROSS - 0.05, self.T_CROSS + 0.1, t) * (1 - smoothstep(self.T_CROSS + 0.5, self.T_CROSS + 1.8, t))
        return dict(uDropDensity=0.3, uDropRise=0.9,
                    uWhale0=self.whale_pos(t), uWhale1=(500.0, 600.0, -1500.0 + 7.0 * t, 0.2),
                    uWhale2=(-900.0, 640.0, -900.0 + 6.0 * t, -0.4),
                    uBubbles=0.2 * burst, uBubbleC=tuple(p0), uBubbleOffset=tuple(self.bubble_drag(t)))

    def bubble_drag(self, t):
        """Bubbles entrained by the plunge travel with the camera, then fall behind."""
        if t <= self.T_CROSS:
            return np.zeros(3)
        dt = 1.0 / 240.0
        off = np.zeros(3)
        prev = self.camera(self.T_CROSS)["pos"]
        tau = self.T_CROSS
        while tau < t:
            nxt = min(tau + dt, t)
            cur = self.camera(nxt)["pos"]
            off += (cur - prev) * math.exp(-(tau - self.T_CROSS) / 0.45)
            prev, tau = cur, nxt
        return off

    def post_at(self, t):
        under = smoothstep(self.T_CROSS, self.T_CROSS + 0.3, t)
        p = dict(exposure=-1.9 + 1.4 * under, bloom=0.08, punch=0.8, saturation=1.18, contrast=0.3,
                 vignette=0.32 + 0.1 * under, lift=(0.01, 0.012, 0.018), gain=(1.02, 1.0, 0.97))
        # a bright flash on impact
        p["exposure"] += 1.4 * math.exp(-((t - self.T_CROSS) / 0.10) ** 2)
        return p
