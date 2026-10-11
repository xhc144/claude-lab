"""The twelve-tone circle: stepping by a fifth (+7) generates the cyclic group Z12."""
import math

import skia

from ..core import (W, H, CREAM, GOLD, c4, caption, draw_text, ease_out_back, ease_out_cubic, envelope, glow_dot,
                    glow_line, hsv, lerp, mix, paint, seg, smooth)
from . import Scene

NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
STEP_T0 = 3.9  # local time of the first fifth
STEP_DT = 0.32  # seconds per fifth (music syncs to this)
N_STEPS = 12


def step_times():
    return [STEP_T0 + i * STEP_DT for i in range(N_STEPS + 1)]


class TwelveTone(Scene):
    duration = 10.5
    bloom = 0.7
    bloom_threshold = 0.45
    vignette = 0.6

    def draw(self, f, t):
        c = f.c
        bg = skia.GradientShader.MakeRadial(skia.Point(W / 2, H / 2 - 40), 1100,
                                            [c4("#1a0f2e").toColor(), c4("#040209").toColor()])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=bg))
        fade = smooth(seg(t, 0.0, 0.8))
        cx, cy, R = W / 2, H / 2 - 75, 300
        spin = math.radians(6 * max(0.0, t - 8.0))

        def pos(k, rr=R):
            a = math.radians(-90 + 30 * k) + spin
            return cx + rr * math.cos(a), cy + rr * math.sin(a)

        # concentric guide rings
        for i, rr in enumerate((R, R * 0.62, R * 1.32)):
            c.drawCircle(cx, cy, rr, paint("#8f7bd6", (0.18 if i == 0 else 0.07) * fade, stroke=1.4))
        # ripples from each new note
        times = step_times()
        for i, ts in enumerate(times):
            p = seg(t, ts, ts + 1.4)
            if 0 < p < 1:
                k = (7 * i) % 12
                x, y = pos(k)
                c.drawCircle(x, y, lerp(10, 160, ease_out_cubic(p)),
                             paint(hsv(i / 12, 0.6, 1), 0.5 * (1 - p), stroke=2.5, blend="add"))

        # star polygon {12/7}
        pts = []
        cur_end = None
        for i in range(N_STEPS):
            ts = times[i]
            p = seg(t, ts, ts + STEP_DT * 0.95)
            if p <= 0:
                break
            a, b = (7 * i) % 12, (7 * (i + 1)) % 12
            xa, ya = pos(a)
            xb, yb = pos(b)
            xe, ye = lerp(xa, xb, ease_out_cubic(p)), lerp(ya, yb, ease_out_cubic(p))
            col = hsv(i / 12, 0.65, 1.0)
            glow_line(c, [(xa, ya), (xe, ye)], col, width=3.0, glow=10, a=fade)
            cur_end = (xe, ye, col)
        if cur_end and seg(t, times[0], times[-1]) < 1:
            glow_dot(c, cur_end[0], cur_end[1], 6, cur_end[2], 1.0)
        # completed star glows
        done = smooth(seg(t, times[-1], times[-1] + 0.8))
        if done > 0:
            path = skia.Path()
            for i in range(13):
                x, y = pos((7 * i) % 12)
                (path.moveTo if i == 0 else path.lineTo)(x, y)
            c.drawPath(path, paint(GOLD, 0.35 * done, stroke=10, blur=18, blend="add"))

        # note nodes
        visited = {}
        for i, ts in enumerate(times):
            if t >= ts:
                visited[(7 * i) % 12] = ts
        for k in range(12):
            p = seg(t, 0.4 + k * 0.08, 0.9 + k * 0.08)
            if p <= 0:
                continue
            x, y = pos(k)
            hit = 0.0
            if k in visited:
                hit = max(0.0, 1 - (t - visited[k]) / 0.8)
            col = mix("#bfb2ff", "#ffffff", hit)
            r = 9 * ease_out_back(p) * (1 + 0.6 * hit)
            glow_dot(c, x, y, r, col, a=fade * (0.6 + 0.4 * (k in visited)))
            lx, ly = pos(k, R + 58)
            draw_text(c, NOTES[k], lx, ly + 12, 34, "garamond", mix(CREAM, "#ffffff", hit), a=fade * smooth(p))
            ix, iy = pos(k, R - 44)
            draw_text(c, str(k), ix, iy + 8, 22, "math", "#9d8fe0", a=fade * smooth(p) * 0.8)

        # dark disc so the centre text reads over the star
        da = smooth(seg(t, times[0], times[0] + 0.5)) * fade
        if da > 0:
            c.drawCircle(cx, cy + 10, 120, paint("#07040f", 0.85 * da, blur=30))
        # running arithmetic at the centre
        cur = None
        for i, ts in enumerate(times):
            if t >= ts:
                cur = i
        if cur is not None and t < times[-1] + 1.0:
            val = (7 * cur) % 12
            a = smooth(seg(t, times[0], times[0] + 0.3)) * (1 - smooth(seg(t, times[-1] + 0.4, times[-1] + 1.0)))
            draw_text(c, f"{cur} × 7 ≡ {val}", cx, cy + 4, 46, "math", CREAM, a=a)
            draw_text(c, "(mod 12)", cx, cy + 50, 26, "math", "#a99be8", a=a * 0.8)
        z = smooth(seg(t, times[-1] + 0.6, times[-1] + 1.4))
        if z > 0:
            draw_text(c, "ℤ₁₂", cx, cy + 30, 110, "dejavu_serif", "#fff3dc", a=z * fade, glow=16, glow_color=GOLD)

        caption(c, t, 0.4, 3.7, "音乐里也藏着群：十二平均律", "Music hides a group, too: the twelve-tone scale")
        caption(c, t, 3.9, 7.9, "每次升高一个五度（+7），走遍全部十二个音，回到起点",
                "Climb by fifths (+7): every note once, then home")
        caption(c, t, 8.1, 10.5, "这就是循环群 ℤ₁₂ —— 和声的骨架", "The cyclic group Z12 — the skeleton of harmony",
                fade=0.5)
