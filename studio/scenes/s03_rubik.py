"""The Rubik's cube: a group with 43 quintillion elements."""
import functools
import math

import cv2
import numpy as np
import skia

from ..core import (W, H, CREAM, GOLD, c4, caption, draw_text, ease_in_out, ease_out_cubic, ease_out_expo,
                    envelope, lerp, paint, seg, smooth)
from ..sims import rubik as rk
from . import Scene

SCRAMBLE = "R U F' L2 D B' R' U2 F L' D2 B R2 U' L F2 D' B2 R U'".split()


def inverse(m):
    if m.endswith("2"):
        return m
    if m.endswith("'"):
        return m[0]
    return m + "'"


SOLVE = [inverse(m) for m in reversed(SCRAMBLE)]
ORDER = 43252003274489856000


def _schedule():
    """List of (move, t0, dur) in scene-local time."""
    out = []
    t = 1.6
    for i, m in enumerate(SCRAMBLE):
        d = lerp(0.36, 0.17, min(1.0, i / 10))
        out.append((m, t, d * (1.4 if m.endswith("2") else 1.0)))
        t += out[-1][2] + 0.02
    t = 12.4
    for i, m in enumerate(SOLVE):
        d = lerp(0.24, 0.15, min(1.0, i / 6))
        out.append((m, t, d * (1.35 if m.endswith("2") else 1.0)))
        t += out[-1][2] + 0.015
    return out


SCHEDULE = _schedule()
SOLVED_AT = SCHEDULE[-1][1] + SCHEDULE[-1][2]


@functools.lru_cache(maxsize=None)
def _states():
    st = [rk.CubeState()]
    for m, _, _ in SCHEDULE:
        s = st[-1].copy()
        s.apply(m)
        st.append(s)
    return st


def move_times():
    return [(m, t0, d) for m, t0, d in SCHEDULE]


class Rubik(Scene):
    duration = 20.0
    bloom = 0.45
    bloom_threshold = 0.6
    vignette = 0.7
    ss = 2

    def cube_at(self, t):
        states = _states()
        idx = 0
        axis, layer, ang = 0, 0, 0.0
        for i, (m, t0, d) in enumerate(SCHEDULE):
            if t >= t0 + d:
                idx = i + 1
            elif t >= t0:
                idx = i
                axis, layer, q = rk.parse(m)
                ang = q * (math.pi / 2) * ease_in_out((t - t0) / d)
                break
            else:
                break
        return states[idx], axis, layer, ang, idx

    def draw(self, f, t):
        st, axis, layer, ang, idx = self.cube_at(t)
        w, h = f.w * self.ss, f.h * self.ss
        out = np.zeros((h, w, 3), np.float32)
        # whole-cube orientation: slow tumble
        spin = 0.35 * t + 0.6 * ease_out_expo(seg(t, 0, 2.5))
        M = rk.rot_xyz(0.42 + 0.05 * math.sin(t * 0.4), 0.55 + spin, 0.0)
        Mi = np.ascontiguousarray(M.T)
        dist = lerp(16.0, 12.6, ease_out_cubic(seg(t, 0, 4))) + 1.2 * smooth(seg(t, 6.5, 9.5)) \
            - 1.2 * smooth(seg(t, 12.0, 14.0))
        cam_y = 1.2
        cam_pos = np.array([0.0, cam_y, dist])
        target = np.array([0.0, -0.35 + 0.45 * smooth(seg(t, 6.5, 9.0)) - 0.45 * smooth(seg(t, 12.0, 14.0)), 0.0])
        cam_rot = rk.look_at(cam_pos, target)
        light = smooth(seg(t, 0.0, 1.6)) * (1 - smooth(seg(t, 19.2, 20.0)))
        rk.render(out, self.ss, cam_pos, cam_rot, math.radians(32), Mi, axis, layer, ang, st.cell_table(),
                  st.orient.astype(np.float64), st.orig.astype(np.float64), -2.75, light)
        img = cv2.resize(out, (f.w, f.h), interpolation=cv2.INTER_AREA)
        f.set_rgb(img)
        c = f.c

        # solved flash
        fl = envelope(t, SOLVED_AT, SOLVED_AT + 1.2, 0.05, 1.1)
        if fl > 0:
            c.drawCircle(W / 2, H / 2 - 20, 420, paint("#ffffff", 0.10 * fl, blur=90, blend="add"))
            r = lerp(200, 900, ease_out_cubic(seg(t, SOLVED_AT, SOLVED_AT + 1.2)))
            c.drawCircle(W / 2, H / 2 - 20, r, paint(GOLD, 0.6 * fl, stroke=3, blur=2, blend="add"))

        self._ticker(c, t, idx)
        self._counter(c, t)
        caption(c, t, 1.8, 6.6, "魔方的每一次转动，都是一个群里的元素", "Every twist of a Rubik's Cube is an element of a group")
        caption(c, t, 7.0, 12.0, "这个群里，一共有 43,252,003,274,489,856,000 种状态",
                "It has 43,252,003,274,489,856,000 possible states")
        caption(c, t, 12.3, 16.2, "可无论怎么打乱，最多 20 步就能复原", "Yet every scramble can be solved in 20 moves or fewer")
        caption(c, t, 16.4, 20.0, "这个数字，被称为「上帝之数」（2010 年证明）", "God's Number — proven in 2010")

    def _ticker(self, c, t, idx):
        a = envelope(t, 1.5, 7.3, 0.4, 0.4) + envelope(t, 12.2, 17.0, 0.4, 0.6)
        if a <= 0:
            return
        # recent moves scroll from the right
        x = W - 120
        y = 120
        shown = 0
        for i in range(min(idx + 1, len(SCHEDULE)) - 1, -1, -1):
            m, t0, d = SCHEDULE[i]
            if t < t0:
                continue
            age = t - t0
            p = ease_out_cubic(seg(t, t0, t0 + 0.2))
            col = GOLD if i >= len(SCRAMBLE) else CREAM
            alpha = a * p * max(0.0, 1 - shown * 0.13)
            if alpha <= 0:
                break
            txt = m.replace("'", "′")
            draw_text(c, txt, x - shown * 70 + (1 - p) * 30, y, 44 if shown == 0 else 36, "math", col, a=alpha,
                      align="right", glow=8 if shown == 0 else 0, glow_color=col)
            shown += 1
            if shown > 8:
                break
        label = "打乱 SCRAMBLE" if idx < len(SCRAMBLE) or t < SCHEDULE[len(SCRAMBLE)][1] else "复原 SOLVE"
        draw_text(c, label, W - 120, y + 44, 18, "sans_cn_light", CREAM, a=a * 0.7, align="right", tracking=0.2)

    def _counter(self, c, t):
        a = envelope(t, 7.0, 12.2, 0.4, 0.6)
        if a <= 0:
            return
        p = ease_out_expo(seg(t, 7.0, 10.0))
        val = int(ORDER * p ** 0.25) if p < 1 else ORDER
        s = f"{val:,}"
        draw_text(c, s, W / 2, 175, 78, "inter_display_light", "#fff6e2", a=a, tracking=0.02, glow=14,
                  glow_color=GOLD)
        draw_text(c, "≈ 4.3 × 10¹⁹", W / 2, 232, 30, "math", GOLD, a=a * smooth(seg(t, 9.6, 10.4)))
