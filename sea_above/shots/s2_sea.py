"""SHOT 2 - The Sea Above.

We arrive among the rising drops above the travertine terraces. The camera
cranes up and tilts: the sky is an ocean hanging overhead, fed by columns of
water flowing up from the valley, with whales gliding through it.
"""
import numpy as np

from engine.camera import Track, look_at, Drift
from shots.base import Shot


class SeaAbove(Shot):
    name = "s2_sea"
    shader = "shot2.glsl"
    duration = 15.0
    spp = 4
    post = dict(exposure=-1.2, bloom=0.07, punch=0.5, saturation=1.08, contrast=0.25, vignette=0.3,
                lift=(0.01, 0.012, 0.018), gain=(1.02, 1.0, 0.97))

    def __init__(self):
        self.pos = Track([(0.0, (6.0, 28.0, 40.0)), (15.0, (-30.0, 60.0, -120.0))])
        self.tgt = Track([(0.0, (-60.0, -10.0, -900.0)), (15.0, (-150.0, 300.0, -1300.0))])
        self.drift = Drift(2)

    def camera(self, t):
        p = self.pos(t) + 0.3 * self.drift(t)
        return dict(pos=p, rot=look_at(p, self.tgt(t)), tanfov=0.36)

    def uniforms(self, t):
        return dict(uDropDensity=0.35, uDropRise=0.9,
                    uWhale0=(-300.0, 560.0, -600.0 + 9.0 * t, 0.3),
                    uWhale1=(500.0, 600.0, -1500.0 + 7.0 * t, 0.2),
                    uWhale2=(200.0, 520.0, 300.0 + 6.0 * t, -0.4))
