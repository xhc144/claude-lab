"""SHOT 4 - The Other Shore.

We surface on the night side of the hanging sea: a mirror ocean full of stars,
a city of stairs that ignores gravity, an enormous pearl moon. Then the
horizon lifts and the whole world rolls up into a cylinder around us.
"""
import numpy as np

from engine.camera import Track, look_at, Drift
from shots.base import Shot


class OtherShore(Shot):
    name = "s4_above"
    shader = "shot4.glsl"
    duration = 20.0
    spp = 4
    post = dict(exposure=0.4, bloom=0.10, punch=0.4, saturation=1.05, contrast=0.15, vignette=0.35,
                lift=(0.004, 0.006, 0.012))

    def __init__(self):
        self.pos = Track([(0.0, (0.0, 2.0, 0.0)), (20.0, (0.0, 30.0, -500.0))])
        self.tgt = Track([(0.0, (0.0, 40.0, -620.0)), (20.0, (0.0, 80.0, -1500.0))])
        self.fold = Track([(0.0, 0.0), (10.0, 0.0), (18.0, 1.0 / 260.0)])
        self.drift = Drift(4)

    def camera(self, t):
        p = self.pos(t) + 0.2 * self.drift(t)
        return dict(pos=p, rot=look_at(p, self.tgt(t)), tanfov=0.40)

    def uniforms(self, t):
        return dict(uFold=self.fold(t), uLanterns=1.0, uDusk=1.0, uSeaLanterns=0.22,
                    uMoonPos=(0.0, 600.0, -4200.0), uMoonR=480.0)
