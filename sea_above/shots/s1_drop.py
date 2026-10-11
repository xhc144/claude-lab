"""SHOT 1 - The Drop (continuous into the reveal of the sea above).

A dew drop clings to the tip of a grass blade on a terrace rim, glowing in
the low sun. It swells, stretches upward, pinches off and rises. We follow it
up, and pull back until the whole world opens: terraces, water columns, and
the ocean hanging in the sky.
"""
import math

import numpy as np

from engine.camera import Track, look_at, rot_axis, Drift, smoothstep, ease_in_out
from shots.base import Shot

SUN = np.array([0.48, 0.125, -1.0])
SUN /= np.linalg.norm(SUN)
P0 = np.array([-20.0, 42.36, -130.5])
FD = np.array([SUN[0], 0.0, SUN[2]])
FD /= np.linalg.norm(FD)
BL_C = np.array([0.062, 0.098])


def blade_tip(defl=0.0):
    """Tip position relative to the blade root P0."""
    return FD * BL_C[0] + np.array([0.0, BL_C[1] + defl, 0.0])


class Drop(Shot):
    name = "s1_drop"
    shader = "shot1.glsl"
    duration = 24.0
    spp = 4
    post = dict(exposure=-3.2, bloom=0.08, punch=1.0, saturation=1.3, contrast=0.4, vignette=0.35,
                lift=(0.01, 0.012, 0.018), gain=(1.02, 1.0, 0.97))

    T_STRETCH = 5.0
    T_PINCH = 6.3

    def __init__(self):
        self.drift = Drift(11, freqs=(0.13, 0.29, 0.47), amps=(1.0, 0.45, 0.2))

    # ---------------------------------------------------------------- drop physics (stylised)
    def drop_state(self, t):
        r0 = 0.0021
        r = r0 * (1.0 + 0.06 * smoothstep(0.0, 5.0, t))
        tip_defl = 0.0
        tip = blade_tip()
        if t < self.T_STRETCH:
            c = tip + np.array([0.0, r * 0.82, 0.0]) + FD * 0.0004
            radii = (r, r * 1.06, r)
            neck = 0.0010
            wob = 0.00004 * math.sin(t * 7.0)
            radii = (r - wob, r * 1.06 + wob, r - wob)
            sat = (0, 0, 0, 0)
            tip_defl = 0.00015 * smoothstep(0, 5.0, t)
        elif t < self.T_PINCH:
            u = (t - self.T_STRETCH) / (self.T_PINCH - self.T_STRETCH)
            e = u * u
            tip_defl = 0.00015 + 0.0009 * e
            tip = blade_tip(tip_defl)
            c = tip + np.array([0.0, r * (0.82 + 1.4 * e), 0.0]) + FD * 0.0004
            radii = (r * (1 - 0.08 * e), r * (1.06 + 0.22 * e), r * (1 - 0.08 * e))
            neck = 0.0010 * (1.0 - u) ** 1.5 + 0.00002
            sat = (0, 0, 0, 0)
        else:
            tau = t - self.T_PINCH
            tip_defl = 0.00105 * math.exp(-3.5 * tau) * math.cos(2 * math.pi * 3.2 * tau)
            tip = blade_tip(0.0)
            # rising: gentle acceleration to a slow-motion terminal speed
            v = 0.016
            rise = v * (tau - (1 - math.exp(-2.5 * tau)) / 2.5)
            c0 = blade_tip(0.00105) + np.array([0.0, r * 2.22, 0.0]) + FD * 0.0004
            c = c0 + np.array([0.0, rise, 0.0]) + FD * 0.0012 * (1 - math.exp(-tau))
            osc = 0.16 * math.exp(-2.2 * tau) * math.cos(2 * math.pi * 3.0 * tau + 0.6)
            ry = r * (1 + osc)
            rx = r / math.sqrt(1 + osc)
            radii = (rx, ry, rx)
            neck = 0.0
            sc = c0 + np.array([0.0, -r * 1.5 + 0.6 * rise, 0.0]) + FD * 0.0004
            sat = (*sc, 0.00028 * smoothstep(0.0, 0.05, tau))
        return dict(c=c, radii=radii, neck=neck, sat=sat, tip_defl=tip_defl)

    # ---------------------------------------------------------------- time
    def world_time(self, t):
        """Speed ramp: the macro opening runs in deep slow motion, the reveal in real time."""
        # integral of a rate that eases from 0.06x to 1x between 8.5 s and 13 s
        a, b, s0 = 8.5, 13.0, 0.06
        if t <= a:
            return s0 * t
        if t >= b:
            return s0 * a + (b - a) * (s0 + 1.0) / 2.0 + (t - b)
        u = (t - a) / (b - a)
        # integral of s0 + (1 - s0) * smoothstep(u)
        ss_int = u ** 3 - 0.5 * u ** 4
        return s0 * a + (b - a) * (s0 * u + (1.0 - s0) * ss_int)

    # ---------------------------------------------------------------- camera
    YAW0 = math.radians(14.0)

    def _macro_cam(self, t):
        """Camera in the blade's local frame, phases A-C (macro, follow, pull back)."""
        st = self.drop_state(t)
        tip = blade_tip()
        target_a = tip + np.array([0.0, 0.0028, 0.0])
        w_follow = smoothstep(5.4, 7.4, t)
        target = target_a * (1 - w_follow) + (st["c"] + np.array([0.0, 0.0006, 0.0])) * w_follow
        # exponential pull-back
        u = smoothstep(7.4, 15.0, t)
        u = u * u * (1.6 - 0.6 * u)
        dist = math.exp(math.log(0.036) * (1 - u) + math.log(38.0) * u)
        if t < 7.4:
            dist = 0.046 - 0.010 * smoothstep(0.0, 5.0, t)
        # yaw swings left a little; pitch goes from slightly up, to looking down on the terraces
        yaw = self.YAW0 + math.radians(10.0) * smoothstep(8.0, 15.0, t)
        pitch = math.radians(7.5) + math.radians(4.0) * smoothstep(5.5, 8.5, t) - math.radians(24.0) * smoothstep(9.5, 15.0, t)
        look = rot_axis((0, 1, 0), yaw) @ FD
        side = np.cross(look, [0, 1, 0])
        side /= np.linalg.norm(side)
        look = rot_axis(side, pitch) @ look
        pos = target - look * dist
        return pos, target, look

    def camera(self, t):
        if t <= 15.0:
            pos, target, look = self._macro_cam(t)
        else:
            # phase D: crane up and tilt up to the ocean overhead
            pos, target, look = self._macro_cam(15.0)
            u = smoothstep(15.0, 24.0, t)
            u2 = smoothstep(15.0, 22.5, t)
            side = np.cross(look, [0, 1, 0])
            side /= np.linalg.norm(side)
            pos = pos + np.array([0.0, 85.0 * u, 0.0]) + look * 40.0 * u
            look = rot_axis(side, math.radians(43.0) * u2 ** 1.15) @ look
            target = pos + look * 100.0
        pos = pos + self.drift(t) * (0.0003 + 0.25 * smoothstep(9.0, 16.0, t))
        return dict(pos=P0 + pos, local=pos, rot=look_at(pos, pos + look), tanfov=0.21 + 0.17 * smoothstep(8.5, 15.0, t))

    def dof(self, t):
        if t > 16.0:
            return None
        cam = self.camera(t)
        st = self.drop_state(t)
        # focus rides the drop; depth of field deepens naturally as we pull away
        f = float(np.linalg.norm(st["c"] - cam["local"]))
        return dict(focus=f, k_px=2.8, max_px=80.0, taps=400)

    POST_MACRO = dict(exposure=-3.2, bloom=0.08, punch=1.0, saturation=1.3, contrast=0.4, vignette=0.35)
    POST_WIDE = dict(exposure=-2.0, bloom=0.07, punch=0.8, saturation=1.18, contrast=0.32, vignette=0.30)

    def post_at(self, t):
        w = smoothstep(9.0, 15.0, t)
        p = {k: self.POST_MACRO[k] * (1 - w) + self.POST_WIDE[k] * w for k in self.POST_MACRO}
        p.update(lift=(0.01, 0.012, 0.018), gain=(1.02, 1.0, 0.97))
        # fade in from black
        p["exposure"] += math.log2(max(smoothstep(0.0, 1.6, t), 1e-4)) if t < 1.6 else 0.0
        return p

    def uniforms(self, t):
        st = self.drop_state(t)
        tw = self.world_time(t)
        return dict(uMacro=1.0, uP0=tuple(P0), uFd=tuple(FD), uTipDefl=st["tip_defl"],
                    uCamL=tuple(self.camera(t)["local"]),
                    uDropC=tuple(st["c"]), uDropR=tuple(st["radii"]), uNeck=st["neck"], uSat=tuple(st["sat"]),
                    uNearDrops=0.5, uDropDensity=0.35, uDropRise=0.9,
                    uWorldTime=tw,
                    uWhale0=(-330.0 + 7.0 * tw, 505.0, -560.0 - 4.0 * tw, 2.1),
                    uWhale1=(500.0, 600.0, -1500.0 + 7.0 * tw, 0.2),
                    uWhale2=(200.0, 520.0, 300.0 + 6.0 * tw, -0.4))
