"""SHOT 4 - The Other Shore.

We break the surface on the night side of the hanging sea: a mirror ocean
scattered with floating lanterns, a city of stairs that ignores gravity, and
an enormous pearl moon resting beyond the edge of the water. We glide past the
city, then the horizon lifts on both sides and the whole world rolls up into
a tunnel of lights around us, with the moon at its end.
"""
import math

import numpy as np

from engine.camera import Track, look_at, basis_from_forward, Drift, smoothstep, ease_in_out
from shots.base import Shot

CITY = np.array([150.0, 0.0, -430.0])
MOON = np.array([0.0, 260.0, -3600.0])


class OtherShore(Shot):
    name = "s4_above"
    shader = "shot4.glsl"
    duration = 24.0
    spp = 4

    def __init__(self):
        self.drift = Drift(4, freqs=(0.12, 0.27, 0.5), amps=(1.0, 0.5, 0.2))
        # camera path (x, y, z) after the breach
        self.path = Track([
            (0.0, (0.0, -1.6, 40.0)),
            (1.2, (0.0, 2.6, 22.0)),
            (5.0, (12.0, 3.4, -80.0)),
            (8.5, (34.0, 14.0, -220.0)),
            (11.5, (58.0, 58.0, -330.0)),
            (14.5, (40.0, 120.0, -520.0)),
            (17.5, (10.0, 190.0, -820.0)),
            (20.0, (0.0, 238.0, -1180.0)),
            (24.0, (0.0, 252.0, -1750.0)),
        ])
        self.fold = Track([(0.0, 0.0), (11.5, 0.0), (17.0, 1.0 / 260.0), (20.0, 1.0 / 250.0), (24.0, 1.0 / 250.0)])

    def camera(self, t):
        pos = self.path(t) + self.drift(t) * (0.15 + 0.5 * smoothstep(3.0, 9.0, t)) * (1 - smoothstep(18.0, 21.0, t))
        # where we look: up at the sky while breaching, then the city, then the moon
        moon = MOON
        tower = CITY + np.array([0.0, 90.0, 0.0])
        sky = pos + np.array([0.0, 100.0, -60.0])
        w_breach = smoothstep(0.2, 1.6, t)
        horizon = pos + np.array([18.0, 4.0, -100.0])
        tgt = sky * (1 - w_breach) + horizon * w_breach
        w_city = smoothstep(4.0, 8.5, t) * (1 - smoothstep(11.0, 14.5, t))
        tgt = tgt * (1 - w_city) + tower * w_city
        w_moon = smoothstep(11.0, 14.5, t)
        tgt = tgt * (1 - w_moon) + (moon - np.array([0.0, 0.0, 0.0])) * w_moon
        roll = math.radians(22.0) * (1 - smoothstep(0.0, 1.8, t)) - math.radians(8.0) * smoothstep(8.0, 10.5, t) * (1 - smoothstep(10.5, 13.5, t))
        f = tgt - pos
        rot = basis_from_forward(f, roll=roll)
        # a slow telephoto push until the moon - and the world inside it - fills the frame
        tf = 0.42 + 0.06 * smoothstep(12.0, 18.0, t)
        z = smoothstep(19.0, 24.0, t)
        tf = math.exp(math.log(tf) * (1 - z) + math.log(0.085) * z)
        return dict(pos=pos, rot=rot, tanfov=tf)

    def uniforms(self, t):
        return dict(uFold=self.fold(t), uLanterns=1.0, uDusk=1.0, uSeaLanterns=0.22,
                    uMoonPos=tuple(MOON), uMoonR=230.0)

    def post_at(self, t):
        return dict(exposure=0.0, bloom=0.10, punch=0.5, saturation=1.1, contrast=0.2, vignette=0.35,
                    lift=(0.004, 0.006, 0.014), gain=(1.0, 1.0, 1.0))
