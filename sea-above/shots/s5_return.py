"""SHOT 5 - Return.

The world inside the moon dissolves into the world inside a dew drop: we are
back on the grass blade at sunrise, where a new drop is gathering at the tip.
The camera eases back to where the film began. The loop closes.
"""
import math

import numpy as np

from engine.camera import look_at, rot_axis, Drift, smoothstep
from shots.s1_drop import Drop, P0, FD, blade_tip


class Return(Drop):
    name = "s5_return"
    duration = 12.0

    def __init__(self):
        super().__init__()
        self.drift = Drift(31, freqs=(0.13, 0.29, 0.47), amps=(1.0, 0.45, 0.2))

    def world_time(self, t):
        return 40.0 + 0.06 * t            # deep slow motion, as at the start

    def drop_state(self, t):
        r = 0.0016 + 0.0005 * smoothstep(0.0, 11.0, t)
        tip = blade_tip()
        wob = 0.00004 * math.sin(t * 6.0)
        c = tip + np.array([0.0, r * 0.82, 0.0]) + FD * 0.0004
        return dict(c=c, radii=(r - wob, r * 1.05 + wob, r - wob), neck=0.0009, sat=(0, 0, 0, 0),
                    tip_defl=0.00012 * smoothstep(0.0, 11.0, t))

    def camera(self, t):
        st = self.drop_state(t)
        az = rot_axis((0, 1, 0), math.radians(14.0))
        look = az @ FD
        side = np.cross(look, [0, 1, 0])
        side /= np.linalg.norm(side)
        look = rot_axis(side, math.radians(7.5)) @ look
        # start with the drop filling the frame, ease back to the opening composition
        u = smoothstep(0.0, 8.5, t)
        u = 1 - (1 - u) ** 2
        dist = math.exp(math.log(0.0105) * (1 - u) + math.log(0.040) * u)
        target = st["c"] * (1 - u) + (blade_tip() + np.array([0.0, 0.0028, 0.0])) * u
        pos = target - look * dist + self.drift(t) * 0.00025 * u
        return dict(pos=P0 + pos, local=pos, rot=look_at(pos, pos + look), tanfov=0.21)

    def dof(self, t):
        cam = self.camera(t)
        st = self.drop_state(t)
        f = float(np.linalg.norm(st["c"] - cam["local"]))
        return dict(focus=f, k_px=2.8, max_px=80.0, taps=400)

    def post_at(self, t):
        p = dict(self.POST_MACRO)
        p.update(lift=(0.01, 0.012, 0.018), gain=(1.02, 1.0, 0.97))
        return p

    def uniforms(self, t):
        u = super().uniforms(t)
        u["uNearDrops"] = 0.45
        return u
