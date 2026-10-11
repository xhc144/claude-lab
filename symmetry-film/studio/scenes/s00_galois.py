"""Cold open: Paris, the night of 29 May 1832.  Galois' last manuscript."""
import functools
import math

import cv2
import numpy as np
import skia

from ..core import (W, H, CREAM, GOLD, INK, c4, caption, clamp, draw_math, draw_text, ease_in_cubic,
                    ease_out_cubic, envelope, font, hash01, lerp, mix, paint, seg, smooth, text_width)
from ..noise import fbm
from . import Scene

PAPER_W, PAPER_H = 1560, 940
INK_COL = "#2a170b"


@functools.lru_cache(maxsize=2)
def paper_image(scale):
    w, h = int(PAPER_W * scale), int(PAPER_H * scale)
    n1 = fbm(w, h, octaves=7, base=3, seed=3)
    n2 = fbm(w, h, octaves=5, base=12, seed=9)
    fibres = fbm(w, h, octaves=3, base=60, seed=21)
    base = np.array([0.80, 0.69, 0.50], np.float32)
    tone = 0.84 + 0.24 * n1[..., None] - 0.06 * np.clip((n2[..., None] - 0.6) * 4, 0, 1) + 0.05 * fibres[..., None]
    img = base * tone
    # foxing stains
    rng = np.random.default_rng(5)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    for _ in range(14):
        cx, cy = rng.random() * w, rng.random() * h
        r = (0.02 + 0.06 * rng.random()) * w
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        ring = np.exp(-(d - 1) ** 2 * 18) * 0.06 + np.exp(-d * d) * 0.03
        img = img * (1 - ring[..., None] * np.array([0.2, 0.45, 0.8], np.float32))
    # burnt / darkened edges
    ex = np.minimum(xx, w - 1 - xx) / w
    ey = np.minimum(yy, h - 1 - yy) / h
    e = np.minimum(ex * 1.0, ey * 1.6)
    edge = np.clip(e / 0.07 + (n2 - 0.5) * 0.9, 0, 1)
    img = img * (0.35 + 0.65 * edge[..., None] ** 0.6)
    alpha = np.clip(e * w / (6 * scale) + (n1 - 0.5) * 0.8, 0, 1)
    rgba = np.zeros((h, w, 4), np.uint8)
    a = alpha[..., None]
    rgba[..., :3] = np.clip(img * a * 255, 0, 255).astype(np.uint8)
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    return skia.Image.fromarray(rgba, colorType=skia.kRGBA_8888_ColorType, alphaType=skia.kPremul_AlphaType)


# Manuscript layout in paper coordinates (origin top-left of the sheet).
LINES = [
    # (text, x, y, size, font, start, duration)
    ("Mémoire sur les conditions de résolubilité", 170, 150, 52, "garamond_it", 0.9, 1.6),
    ("des équations par radicaux.", 400, 218, 52, "garamond_it", 2.4, 1.0),
    ("Soit une équation donnée, dont a, b, c, … sont les m racines.", 120, 330, 38, "garamond_it", 3.3, 1.7),
    ("Il y aura toujours un groupe de permutations des lettres", 120, 392, 38, "garamond_it", 4.9, 1.6),
    ("a, b, c, … qui jouira de la propriété suivante :", 120, 454, 38, "garamond_it", 6.3, 1.3),
]
MATH_LINE = (r"$x^5 + ax^4 + bx^3 + cx^2 + dx + e = 0$", 620, 555, 50, 7.4, 1.4)
NOTE = ("Je n'ai pas le temps.", 930, 690, 62, 8.6, 1.6)
GROUPE_WORD = "groupe"


def _groupe_center():
    text, x, y, size, key, *_ = LINES[3]
    i = text.index(GROUPE_WORD)
    pre = text_width(text[:i], key, size)
    wd = text_width(GROUPE_WORD, key, size)
    return x + pre + wd / 2, y - size * 0.32, wd


class GaloisOpen(Scene):
    duration = 16.0
    bloom = 0.55
    bloom_threshold = 0.55
    vignette = 0.9
    grain = 0.02

    def __init__(self):
        rng = np.random.default_rng(42)
        self.dust = [(rng.random() * W, rng.random() * H, 0.6 + rng.random() * 2.5, rng.random(), rng.random())
                     for _ in range(110)]

    # ------------------------------------------------------------------
    def camera(self, t):
        """Return (scale, focus_x, focus_y) in paper coordinates."""
        gx, gy, _ = _groupe_center()
        base_s = lerp(1.0, 1.08, smooth(t / 12.0))
        cx0, cy0 = PAPER_W / 2, PAPER_H / 2
        p = ease_in_cubic(seg(t, 11.4, 16.0))
        s = base_s * lerp(1.0, 6.5, p)
        fx = lerp(cx0, gx, smooth(seg(t, 11.0, 14.0)))
        fy = lerp(cy0, gy, smooth(seg(t, 11.0, 14.0)))
        return s, fx, fy

    def draw(self, f, t):
        c = f.c
        flick = 0.86 + 0.07 * math.sin(t * 7.3) + 0.04 * math.sin(t * 13.7 + 1.3) + 0.03 * math.sin(t * 23.1)
        fade_in = smooth(seg(t, 0.0, 1.4))

        # warm room background
        sh = skia.GradientShader.MakeRadial(skia.Point(W * 0.25, H * 1.05), 1500,
                                            [c4("#3a2312", fade_in).toColor(), c4("#070403").toColor()])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=sh))

        s, fx, fy = self.camera(t)
        c.save()
        c.translate(W / 2, H / 2)
        c.scale(s, s)
        c.rotate(-2.2 + 0.4 * math.sin(t * 0.3))
        c.translate(-fx, -fy)

        # paper
        img = paper_image(f.scale)
        p = skia.Paint(AntiAlias=True)
        p.setAlphaf(fade_in)
        # drop shadow
        c.drawRect(skia.Rect(16, 22, PAPER_W + 16, PAPER_H + 22),
                   paint("#000000", 0.6 * fade_in, blur=30))
        c.drawImageRect(img, skia.Rect(0, 0, PAPER_W, PAPER_H),
                        skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear), p)

        # ruled lines (faint)
        for k in range(14):
            y = 120 + k * 62
            c.drawLine(80, y + 14, PAPER_W - 80, y + 14, paint("#6b5a44", 0.10 * fade_in, stroke=1.2))

        self._ink(c, t, fade_in, s)
        c.restore()

        # candle-light falloff over everything
        sh = skia.GradientShader.MakeRadial(
            skia.Point(W * 0.22, H * 0.95), 1700 * flick,
            [c4("#000000", 0.0).toColor(), c4("#000000", 0.15).toColor(), c4("#000000", 0.62).toColor()],
            [0.0, 0.45, 1.0])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=sh))
        warm = skia.GradientShader.MakeRadial(skia.Point(W * 0.18, H * 1.0), 900,
                                              [c4("#ff9a3c", 0.22 * flick).toColor(), c4("#ff9a3c", 0).toColor()])
        wp = skia.Paint(Shader=warm)
        wp.setBlendMode(skia.BlendMode.kScreen)
        c.drawRect(skia.Rect(0, 0, W, H), wp)

        # floating dust in the candle light
        for i, (x0, y0, r, ph, sp) in enumerate(self.dust):
            x = (x0 + 18 * math.sin(t * 0.4 + ph * 6) + t * 6 * (sp - 0.5)) % W
            y = (y0 - t * (8 + 20 * sp)) % H
            a = (0.15 + 0.35 * hash01(i, 3)) * fade_in * (0.6 + 0.4 * math.sin(t * 2 + ph * 9))
            c.drawCircle(x, y, r, paint("#ffcf8a", a, blur=r * 1.2, blend="add"))

        # captions -------------------------------------------------------
        bar = max(envelope(t, 0.6, 11.6, 0.8, 0.8), envelope(t, 11.6, 15.6, 0.4, 0.6))
        if bar > 0:
            sh = skia.GradientShader.MakeLinear([skia.Point(0, H - 330), skia.Point(0, H)],
                                                [c4("#000000", 0).toColor(), c4("#000000", 0.78 * bar).toColor()])
            c.drawRect(skia.Rect(0, H - 330, W, H), skia.Paint(Shader=sh))
        caption(c, t, 0.8, 4.4, "1832 年 5 月 29 日 · 深夜 · 巴黎", "Paris · the night of May 29, 1832",
                color=CREAM, size=44)
        caption(c, t, 4.6, 8.4, "一个 20 岁的年轻人，彻夜写下他的数学手稿", "A twenty-year-old writes through the night",
                color=CREAM, size=44)
        caption(c, t, 8.6, 11.4, "页边潦草地写着：「我没有时间了。」", "In the margin: “I have no time.”",
                color=CREAM, size=44)
        caption(c, t, 11.6, 15.7, "次日清晨，伽罗瓦在决斗中倒下。他留下了一个词 ——",
                "The next morning Galois fell in a duel. He left behind one word —", color=CREAM, size=44)

        # end: white flash builds up
        wf = ease_in_cubic(seg(t, 15.2, 16.0))
        if wf > 0:
            c.drawRect(skia.Rect(0, 0, W, H), paint("#fff4dc", wf))

    # ------------------------------------------------------------------
    def _ink(self, c, t, fade_in, cam_s):
        ink = c4(INK_COL)
        for text, x, y, size, key, t0, dur in LINES:
            p = seg(t, t0, t0 + dur)
            if p <= 0:
                continue
            wd = text_width(text, key, size)
            c.save()
            # handwriting reveal: clip grows left to right with a soft pen tip
            c.clipRect(skia.Rect(x - 10, y - size * 1.2, x + wd * p + 4, y + size * 0.6))
            draw_text(c, text, x, y, size, key, INK_COL, a=0.92 * fade_in, align="left")
            c.restore()
            if 0 < p < 1:
                c.drawCircle(x + wd * p, y - size * 0.25, 5, paint("#ffcf8a", 0.35, blur=6, blend="add"))
            # the word "groupe" glows at the end
            if GROUPE_WORD in text:
                gx, gy, gw = _groupe_center()
                g = smooth(seg(t, 10.8, 13.5))
                if g > 0:
                    i = text.index(GROUPE_WORD)
                    pre = text_width(text[:i], key, size)
                    pulse = 1 + 0.15 * math.sin(t * 6)
                    k = 1.0 / cam_s
                    # spotlight: darken the page around the word
                    sp = skia.GradientShader.MakeRadial(
                        skia.Point(gx, gy), gw * 1.1,
                        [c4("#000000", 0.62 * g).toColor(), c4("#000000", 0.9 * g).toColor()], [0.3, 1.0])
                    c.drawRect(skia.Rect(-4000, -4000, 6000, 6000), skia.Paint(Shader=sp))
                    c.drawRoundRect(skia.Rect(x + pre - 6, y - size * 0.85, x + pre + gw + 6, y + size * 0.3),
                                    8, 8, paint("#ff9a2a", 0.10 * g * pulse, blur=10 * k + 4, blend="add"))
                    draw_text(c, GROUPE_WORD, x + pre, y, size, key, "#ffc25a", a=g, align="left",
                              glow=(2 + 3 * g) * max(k, 0.3), glow_color="#ff8a1e")
                    draw_text(c, GROUPE_WORD, x + pre, y, size, key, "#fff3d0", a=0.85 * g, align="left")

        tex, mx, my, msize, t0, dur = MATH_LINE
        p = seg(t, t0, t0 + dur)
        if p > 0:
            c.save()
            c.clipRect(skia.Rect(mx - 400, my - 60, mx - 400 + 800 * p, my + 60))
            draw_math(c, tex, mx, my, msize, INK_COL, a=0.9 * fade_in, frame_scale=2.0)
            c.restore()

        text, nx, ny, nsize, t0, dur = NOTE
        p = seg(t, t0, t0 + dur)
        if p > 0:
            c.save()
            c.translate(nx, ny)
            c.rotate(-7)
            wd = text_width(text, "script", nsize)
            c.save()
            c.clipRect(skia.Rect(-10, -nsize, wd * p + 6, nsize * 0.5))
            draw_text(c, text, 0, 0, nsize, "script", "#3a1408", a=0.95, align="left")
            c.restore()
            # hasty underline
            u = seg(t, t0 + dur, t0 + dur + 0.5)
            if u > 0:
                path = skia.Path()
                path.moveTo(-6, 16)
                path.cubicTo(wd * 0.3, 24, wd * 0.7, 10, (wd + 20) * u, 20)
                c.drawPath(path, paint("#3a1408", 0.85, stroke=3.2))
            c.restore()
