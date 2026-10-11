"""Finale: the Monster group, a montage, the title card and Poincaré's line."""
import math

import cv2
import numpy as np
import skia

from .. import core
from ..core import (W, H, CREAM, GOLD, c4, caption, clamp, draw_text, ease_in_cubic, ease_in_out, ease_out_cubic,
                    ease_out_expo, envelope, glow_line, hash01, lerp, mix, paint, seg, smooth, title_block)
from . import Scene

MONSTER = "808017424794512875886459904961710757005754368000000000"
MONTAGE_T0 = 6.8
MONTAGE = [  # scene, local start time
    ("symmetry", 9.9), ("symmetry", 22.4), ("music", 8.4), ("rubik", 4.0), ("solids", 12.2),
    ("solids", 19.2), ("alhambra", 8.6), ("hyperbolic", 3.6), ("hyperbolic", 10.6), ("quintic", 20.4),
    ("quintic", 27.4), ("elliptic", 16.2), ("physics", 14.4), ("physics", 21.6),
]


def montage_cuts():
    """List of (t0, t1, scene, local_t0) in finale-local time; cuts accelerate."""
    out = []
    t = MONTAGE_T0
    n = len(MONTAGE)
    for i, (name, lt) in enumerate(MONTAGE):
        d = lerp(0.78, 0.42, i / (n - 1))
        out.append((t, t + d, name, lt))
        t += d
    return out


CUTS = montage_cuts()
MONTAGE_T1 = CUTS[-1][1]
TITLE_T0 = MONTAGE_T1 + 0.35


class Finale(Scene):
    duration = 25.0
    bloom = 0.6
    bloom_threshold = 0.5
    vignette = 0.6

    def __init__(self):
        rng = np.random.default_rng(23)
        X = rng.normal(size=(2600, 24))
        self.cloud = X / np.linalg.norm(X, axis=1)[:, None]
        self.cloud_r = rng.random(2600) ** 0.5

    def draw(self, f, t):
        c = f.c
        if MONTAGE_T0 <= t < MONTAGE_T1:
            return self._montage(f, t)
        c.clear(c4("#020205"))
        if t < MONTAGE_T0:
            self._monster(c, t)
        else:
            self._title(c, t)

    # ------------------------------------------------------------------
    def _monster(self, c, t):
        a = smooth(seg(t, 0.0, 0.8)) * (1 - smooth(seg(t, 6.3, 6.8)))
        # a slowly turning 24-dimensional cloud, projected
        ang = t * 0.25
        B = np.zeros((24, 2))
        for k in range(12):
            B[2 * k, 0] = math.cos(ang * (k + 1) * 0.3 + k)
            B[2 * k + 1, 0] = math.sin(ang * (k + 1) * 0.3 + k)
            B[2 * k, 1] = -math.sin(ang * (k + 2) * 0.21 + 2 * k)
            B[2 * k + 1, 1] = math.cos(ang * (k + 2) * 0.21 + 2 * k)
        P = self.cloud @ B
        P /= np.abs(P).max() + 1e-9
        cx, cy = W / 2, H / 2 - 40
        path = skia.Path()
        for i in range(len(P)):
            x = cx + P[i, 0] * 620
            y = cy + P[i, 1] * 380
            path.addCircle(float(x), float(y), 1.4)
        c.drawPath(path, paint("#8b6cff", 0.35 * a, blend="add"))
        c.drawCircle(cx, cy, 380, paint("#5b3cff", 0.08 * a, blur=150, blend="add"))
        # rolling digits
        groups = [MONSTER[i:i + 3] for i in range(0, len(MONSTER), 3)]
        lines = [" ".join(groups[:9]), " ".join(groups[9:])]
        size = 70
        for li, line in enumerate(lines):
            y = 420 + li * 100
            wdt = core.text_width(line, "inter_display_light", size, 0.02)
            x = W / 2 - wdt / 2
            for k, ch in enumerate(line):
                adv = core.char_advance("inter_display_light", size, ch) + 0.02 * size
                if ch != " ":
                    idx = li * 27 + k
                    lock = 0.6 + idx * 0.045
                    if t < lock:
                        d = str(int(hash01(int(t * 30), idx) * 10))
                        ca = a * 0.55 * smooth(seg(t, lock - 0.6, lock - 0.3))
                        col = "#9d8cff"
                    else:
                        d = ch
                        ca = a
                        col = mix("#ffffff", CREAM, smooth(seg(t, lock, lock + 0.4)))
                    if ca > 0:
                        flash = max(0.0, 1 - (t - lock) / 0.3) if t >= lock else 0
                        # centre the (possibly different) glyph in the final digit's slot
                        dx = (core.char_advance("inter_display_light", size, ch)
                              - core.char_advance("inter_display_light", size, d)) / 2
                        draw_text(c, d, x + dx, y, size, "inter_display_light", col, a=ca, align="left",
                                  glow=8 * flash + 2, glow_color="#b8a6ff")
                x += adv
        draw_text(c, "|M| ≈ 8 × 10⁵³", W / 2, 640, 40, "math", GOLD, a=a * smooth(seg(t, 3.2, 3.9)), glow=8,
                  glow_color=GOLD)
        draw_text(c, "MONSTER GROUP", W / 2, 300, 22, "inter_light", "#b8a6ff", a=a * smooth(seg(t, 0.4, 1.2)),
                  tracking=0.6)
        caption(c, t, 0.5, 3.4, "魔群：最大的「散在」单群，1982 年才被构造出来",
                "The Monster: the largest sporadic simple group, built in 1982")
        caption(c, t, 3.6, 6.6, "它的元素个数，比地球上所有的原子还要多几千倍",
                "It has thousands of times more elements than Earth has atoms")

    def _montage(self, f, t):
        from .. import timeline
        for t0, t1, name, lt in CUTS:
            if t0 <= t < t1:
                break
        sc = timeline.scene_by_name(name)
        core.SUPPRESS_CAPTIONS = True
        try:
            rgb = sc.render(lt + (t - t0), f.scale)
        finally:
            core.SUPPRESS_CAPTIONS = False
        # punch-in zoom at each cut
        z = 1.0 + 0.06 * (1 - ease_out_cubic(seg(t, t0, t0 + 0.35)))
        if z > 1.0005:
            h, w = rgb.shape[:2]
            M = np.array([[z, 0, (1 - z) * w / 2], [0, z, (1 - z) * h / 2]], np.float32)
            rgb = cv2.warpAffine(rgb, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        f.set_rgb(np.clip(rgb, 0, 1))
        c = f.c
        fl = 1 - smooth(seg(t, t0, t0 + 0.16))
        if fl > 0:
            c.drawRect(skia.Rect(0, 0, W, H), paint("#ffffff", 0.55 * fl))
        # letterbox bars for the montage
        bar = 70
        c.drawRect(skia.Rect(0, 0, W, bar), paint("#000000", 1))
        c.drawRect(skia.Rect(0, H - bar - 140, W, H), paint("#000000", 0.0))
        c.drawRect(skia.Rect(0, H - bar, W, H), paint("#000000", 1))
        sh = skia.GradientShader.MakeLinear([skia.Point(0, H - 330), skia.Point(0, H - 120)],
                                            [c4("#000000", 0).toColor(), c4("#000000", 0.85).toColor()])
        c.drawRect(skia.Rect(0, H - 330, W, H - bar), skia.Paint(Shader=sh))
        caption(c, t, MONTAGE_T0 + 0.1, MONTAGE_T0 + 3.9, "从雪花到晶体，从魔方到密码，从方程到粒子 ——",
                "From snowflakes to crystals, puzzles to codes, equations to particles —", y=900)
        caption(c, t, MONTAGE_T0 + 4.1, MONTAGE_T1 + 0.2, "它们说着同一种语言", "they all speak the same language",
                y=900, size=52)
        return None

    def _title(self, c, t):
        a = smooth(seg(t, TITLE_T0, TITLE_T0 + 1.0)) * (1 - smooth(seg(t, 24.2, 25.0)))
        tt = t - TITLE_T0
        cx, cy = W / 2, H / 2 - 60
        # ignition point
        ip = seg(t, TITLE_T0 - 0.3, TITLE_T0 + 0.8)
        if 0 < ip < 1:
            r = lerp(2, 1400, ease_out_expo(ip))
            c.drawCircle(cx, cy, r, paint(GOLD, 0.5 * (1 - ip), stroke=4, blur=3, blend="add"))
            c.drawCircle(cx, cy, 40 * (1 - ip) + 4, paint("#ffffff", 1 - ip, blur=20, blend="add"))
        # rosette behind the title: {12/5} star + rings, slowly turning
        ra = a * 0.55 * (1 - 0.75 * smooth(seg(t, 20.2, 21.0)))
        if ra > 0:
            rot = tt * 0.06
            for k, (rad, n, step) in enumerate(((330, 12, 5), (470, 12, 1))):
                pts = []
                for i in range(n + 1):
                    ang = rot * (1 if k % 2 == 0 else -1) + 2 * math.pi * ((i * step) % n) / n - math.pi / 2
                    pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
                grow = smooth(seg(tt, 0.2 + k * 0.3, 1.6 + k * 0.3))
                m = max(2, int(len(pts) * grow))
                glow_line(c, pts[:m], GOLD, width=1.2, glow=6, a=ra * 0.6, core=False)
            for rad in (250, 560):
                c.drawCircle(cx, cy, rad, paint(GOLD, ra * 0.25, stroke=1))
            for i in range(12):
                ang = -tt * 0.06 + 2 * math.pi * i / 12 - math.pi / 2
                core.glow_dot(c, cx + 520 * math.cos(ang), cy + 520 * math.sin(ang), 3.5, GOLD,
                              ra * smooth(seg(tt, 1.0 + i * 0.05, 1.4 + i * 0.05)))
            c.drawCircle(cx, cy, 300, paint("#000000", 0.85 * a, blur=60))
        title_block(c, t, TITLE_T0 + 0.2, 20.4, "抽象代数", None, y=cy + 52, size=150, key="serif_cn_black",
                    color="#fff3dc", glow=22, tracking=0.32)
        sa = smooth(seg(t, TITLE_T0 + 1.2, TITLE_T0 + 2.2)) * (1 - smooth(seg(t, 19.8, 20.4)))
        draw_text(c, "ABSTRACT ALGEBRA", cx, cy + 140, 30, "inter_light", GOLD, a=sa, tracking=0.75)
        draw_text(c, "对称的语言 · THE LANGUAGE OF SYMMETRY", cx, cy + 205, 26, "serif_cn", CREAM,
                  a=sa * 0.8 * smooth(seg(t, TITLE_T0 + 1.8, TITLE_T0 + 2.8)), tracking=0.2)
        # Poincaré
        qa = envelope(t, 20.6, 24.8, 1.0, 1.0)
        if qa > 0:
            draw_text(c, "「数学，是给不同的事物以相同名称的艺术。」", W / 2, H / 2 - 10, 50, "serif_cn_semibold", "#fff3dc",
                      a=qa, tracking=0.12, per_char=core.reveal_chars(t, 20.6, dur=0.7, stagger=0.06, rise=10, blur0=10))
            draw_text(c, "“Mathematics is the art of giving the same name to different things.”", W / 2, H / 2 + 62,
                      26, "garamond_it", CREAM, a=qa * 0.85 * smooth(seg(t, 21.6, 22.6)))
            draw_text(c, "—— 亨利 · 庞加莱  Henri Poincaré", W / 2, H / 2 + 140, 26, "serif_cn", GOLD,
                      a=qa * smooth(seg(t, 22.2, 23.0)), tracking=0.15)
