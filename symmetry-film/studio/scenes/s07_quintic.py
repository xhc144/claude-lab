"""The quest for formulas, the quintic, braiding roots, and the Littlewood fractal."""
import functools
import math

import cv2
import numpy as np
import skia

from ..core import (W, H, CREAM, GOLD, c4, caption, clamp, draw_math, draw_text, ease_in_cubic, ease_in_out,
                    ease_out_cubic, ease_out_expo, envelope, glow_dot, hash01, hsv, lerp, mix, paint, seg, smooth)
from . import Scene

QUAD = r"$x=\dfrac{-b\pm\sqrt{b^{2}-4ac}}{2a}$"
CUBIC = (r"$x=\sqrt[3]{-\dfrac{q}{2}+\sqrt{\dfrac{q^{2}}{4}+\dfrac{p^{3}}{27}}}"
         r"+\sqrt[3]{-\dfrac{q}{2}-\sqrt{\dfrac{q^{2}}{4}+\dfrac{p^{3}}{27}}}$")
QUARTIC = [
    r"$x=-\dfrac{b}{4a}\pm S\pm\dfrac{1}{2}\sqrt{-4S^{2}-2p\pm\dfrac{q}{S}}$",
    r"$p=\dfrac{8ac-3b^{2}}{8a^{2}}\qquad q=\dfrac{b^{3}-4abc+8a^{2}d}{8a^{3}}$",
    r"$S=\dfrac{1}{2}\sqrt{-\dfrac{2}{3}p+\dfrac{1}{3a}\left(Q+\dfrac{\Delta_{0}}{Q}\right)}$",
    r"$Q=\sqrt[3]{\dfrac{\Delta_{1}+\sqrt{\Delta_{1}^{2}-4\Delta_{0}^{3}}}{2}}$",
    r"$\Delta_{0}=c^{2}-3bd+12ae$",
    r"$\Delta_{1}=2c^{3}-9bcd+27b^{2}e+27ad^{2}-72ace$",
]
QUINTIC = r"$ax^{5}+bx^{4}+cx^{3}+dx^{2}+ex+f=0$"

ROOT_COLS = ["#ff6b6b", "#ffd166", "#4ee6a8", "#4cc9ff", "#c18cff"]
PLANE_C = (W / 2 - 120, H / 2 - 60)
PLANE_S = 255.0  # pixels per unit

BRAID_T0 = 16.4
BRAID_T1 = 22.4
LIT_T0 = 22.2


def c_path(u):
    """Coefficient path for x^5 - x + c, u in [0, 1]: three loops, each around one branch point."""
    bp = 0.8 * (0.2 ** 0.25)  # |branch point| ~ 0.535
    centres = [complex(bp, 0), complex(0, bp), complex(-bp, 0)]
    k = min(int(u * 3), 2)
    v = u * 3 - k
    m = centres[k] * 0.62
    phi = 2 * math.pi * ease_in_out(v)
    return m * (1 - complex(math.cos(phi), math.sin(phi)))


@functools.lru_cache(maxsize=1)
def root_tracks(n=3000):
    us = np.linspace(0, 1, n)
    out = np.zeros((n, 5), complex)
    prev = np.roots([1, 0, 0, 0, -1, 0])
    prev = prev[np.argsort(np.angle(prev))]
    for i, u in enumerate(us):
        c = c_path(u)
        r = np.roots([1, 0, 0, 0, -1, c])
        # match to previous by greedy nearest
        used = set()
        cur = np.zeros(5, complex)
        for k in range(5):
            d = [abs(r[j] - prev[k]) if j not in used else 1e9 for j in range(5)]
            j = int(np.argmin(d))
            used.add(j)
            cur[k] = r[j]
        out[i] = cur
        prev = cur
    return out


@functools.lru_cache(maxsize=1)
def question_particles():
    """Sample points inside a large '?' glyph."""
    from ..core import font
    size = 520
    w, h = 420, 560
    arr = np.zeros((h, w, 4), np.uint8)
    surf = skia.Surface(arr)
    cv = surf.getCanvas()
    f = font("serif_cn_bold", size)
    cv.drawString("?", 70, 470, f, skia.Paint(Color=skia.ColorWHITE, AntiAlias=True))
    ys, xs = np.where(arr[..., 3] > 128)
    rng = np.random.default_rng(1)
    sel = rng.choice(len(xs), 900, replace=False)
    pts = np.stack([xs[sel] - w / 2, ys[sel] - h / 2], axis=1).astype(float)
    return pts


@functools.lru_cache(maxsize=2)
def littlewood_image():
    from ..sims.littlewood import density
    d = np.asarray(density(22), dtype=np.float32)
    return d


def colormap(v):
    """v in [0,1] -> RGB (black, indigo, magenta-red, orange, pale gold, white)."""
    stops = np.array([0.0, 0.18, 0.4, 0.62, 0.82, 1.0])
    cols = np.array([[0, 0, 0], [0.10, 0.05, 0.32], [0.55, 0.10, 0.45], [0.95, 0.38, 0.12],
                     [1.0, 0.82, 0.45], [1.0, 1.0, 0.95]], np.float32)
    out = np.zeros(v.shape + (3,), np.float32)
    for ch in range(3):
        out[..., ch] = np.interp(v, stops, cols[:, ch])
    return out


class Quintic(Scene):
    duration = 29.0
    bloom = 0.55
    bloom_threshold = 0.5
    vignette = 0.6

    def draw(self, f, t):
        c = f.c
        bg = skia.GradientShader.MakeRadial(skia.Point(W / 2, H / 2), 1200,
                                            [c4("#0b0d18").toColor(), c4("#020205").toColor()])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=bg))
        if t >= LIT_T0 - 0.1:
            self._littlewood(f, t)
            c = f.c
        if t < BRAID_T1 + 2.2:
            self._plane(c, t, f)
        if t < 17.5:
            self._formulas(c, t, f.scale)

        caption(c, t, 0.4, 2.7, "回到伽罗瓦的问题：", "Back to Galois' question:")
        caption(c, t, 10.9, 13.7, "此后近三百年，无数数学家倒在了五次方程面前",
                "For nearly 300 years the quintic defeated everyone")
        caption(c, t, 13.9, 16.4, "伽罗瓦揭示了原因：一般的五次方程，不存在求根公式",
                "Galois showed why: the general quintic has no formula")
        caption(c, t, 16.6, 19.0, "让系数绕一圈，五个根就会交换位置", "Loop a coefficient — the five roots swap places")
        caption(c, t, 19.2, 22.0, "这些置换构成了它的伽罗瓦群 S₅ —— 它「不可解」，所以公式不存在",
                "They form its Galois group S5 — not solvable, so no formula", size=42)
        caption(c, t, 22.4, 25.3, "把所有系数为 ±1 的多项式的根，全部画出来……",
                "Now plot every root of every polynomial with coefficients ±1…")
        caption(c, t, 25.6, 29.0, "……这，就是代数的样子", "…this is what algebra looks like", fade=0.7)

    # ------------------------------------------------------------------
    def _formulas(self, c, t, sc):
        stages = [
            ("二次方程", "古巴比伦 · 约公元前 1800 年", 2.6, 5.4),
            ("三次方程", "1545 · 卡尔达诺《大术》", 5.4, 8.2),
            ("四次方程", "1545 · 费拉里", 8.2, 10.9),
            ("五次方程", "？", 10.9, 15.0),
        ]
        for i, (name, sub, t0, t1) in enumerate(stages):
            a = envelope(t, t0, t1, 0.5, 0.45)
            if i == 3:
                a = envelope(t, t0, 14.4, 0.5, 0.6)
            if a <= 0:
                continue
            p = ease_out_cubic(seg(t, t0, t0 + 0.8))
            draw_text(c, name, W / 2, 250 - (1 - p) * 20, 54, "serif_cn_bold", CREAM, a=a, tracking=0.25)
            draw_text(c, sub, W / 2, 300, 22, "sans_cn_light", GOLD, a=a * 0.85, tracking=0.2)
            blur = (1 - p) * 10
            if i == 0:
                draw_math(c, r"$ax^{2}+bx+c=0$", W / 2, 400, 40, "#9aa3c7", a=a, frame_scale=sc)
                draw_math(c, QUAD, W / 2, 560, 72, "#ffffff", a=a, glow=6, frame_scale=sc, blur=blur)
            elif i == 1:
                draw_math(c, r"$x^{3}+px+q=0$", W / 2, 400, 40, "#9aa3c7", a=a, frame_scale=sc)
                draw_math(c, CUBIC, W / 2, 570, 50, "#ffffff", a=a, glow=6, frame_scale=sc, blur=blur)
            elif i == 2:
                for k, line in enumerate(QUARTIC):
                    lp = ease_out_cubic(seg(t, t0 + 0.2 + k * 0.28, t0 + 0.7 + k * 0.28))
                    if lp <= 0:
                        continue
                    y = 385 + k * 100 - 30 * seg(t, t0, t1)
                    draw_math(c, line, W / 2 + (1 - lp) * 60, y, 34, "#ffffff", a=a * lp, glow=4, frame_scale=sc)
            else:
                shatter = seg(t, 13.6, 15.0)
                fa = a * (1 - smooth(seg(t, 13.6, 14.0)))
                draw_math(c, QUINTIC, W / 2, 420, 50, "#ffffff", a=fa, glow=6, frame_scale=sc, blur=blur)
                if t < 13.6:
                    pulse = 1 + 0.04 * math.sin(t * 7)
                    qa = a * smooth(seg(t, 11.6, 12.4))
                    c.save()
                    c.translate(W / 2, 640)
                    c.scale(pulse, pulse)
                    draw_text(c, "x = ?", 0, 60, 150, "math_it", "#ffffff", a=qa, glow=24, glow_color="#ff6b8a")
                    c.restore()
                self._shatter(c, t)

    def _shatter(self, c, t):
        if t < 13.6 or t > 17.2:
            return
        pts = question_particles()
        tr = root_tracks()
        roots = tr[0]
        p = seg(t, 13.6, 17.0)
        for i, (px, py) in enumerate(pts):
            x0, y0 = W / 2 + 170 + px * 0.28, 640 + py * 0.28  # '?' location (right part of 'x = ?')
            ang = hash01(i, 1) * 2 * math.pi
            sp = 120 + 380 * hash01(i, 2)
            # explode then gather into the five roots
            e = ease_out_expo(seg(t, 13.6, 14.6))
            ex = x0 + math.cos(ang) * sp * e + 40 * math.sin(t * 2 + i)
            ey = y0 + math.sin(ang) * sp * e
            k = i % 5
            tx = PLANE_C[0] + roots[k].real * PLANE_S
            ty = PLANE_C[1] - roots[k].imag * PLANE_S
            g = ease_in_out(seg(t, 14.6, 16.4))
            x = lerp(ex, tx, g)
            y = lerp(ey, ty, g)
            col = mix("#ffffff", ROOT_COLS[k], smooth(seg(t, 14.0, 15.5)))
            a = (1 - smooth(seg(t, 16.2, 16.8)))
            c.drawCircle(x, y, 2.0, paint(col, 0.9 * a, blend="add"))

    def _plane(self, c, t, f):
        g = smooth(seg(t, 14.6, 16.0)) * (1 - smooth(seg(t, BRAID_T1 + 0.6, BRAID_T1 + 2.0)))
        if g <= 0:
            return
        cx, cy = PLANE_C
        # grid
        for k in range(-6, 7):
            a = 0.10 if k else 0.3
            c.drawLine(cx + k * PLANE_S / 2, cy - 520, cx + k * PLANE_S / 2, cy + 520, paint("#7f8fd0", a * g, stroke=1))
            c.drawLine(cx - 900, cy + k * PLANE_S / 2, cx + 900, cy + k * PLANE_S / 2, paint("#7f8fd0", a * g, stroke=1))
        c.drawCircle(cx, cy, PLANE_S, paint("#7f8fd0", 0.25 * g, stroke=1.2))
        draw_text(c, "ℂ", cx - 700, cy - 360, 44, "dejavu_serif", "#9aa3c7", a=g * 0.8)
        tr = root_tracks()
        n = len(tr)
        u = seg(t, BRAID_T0, BRAID_T1)
        i1 = int(u * (n - 1))
        trail = 1100
        nseg = 6
        for k in range(5):
            col = ROOT_COLS[k]
            i0 = max(0, i1 - trail)
            for sgi in range(nseg):
                a0 = i0 + (i1 - i0) * sgi // nseg
                a1 = i0 + (i1 - i0) * (sgi + 1) // nseg
                if a1 <= a0 + 1:
                    continue
                fa = (sgi + 1) / nseg
                pts = tr[a0:a1 + 1:2, k]
                path = skia.Path()
                for j, z in enumerate(pts):
                    x, y = cx + z.real * PLANE_S, cy - z.imag * PLANE_S
                    (path.moveTo if j == 0 else path.lineTo)(x, y)
                c.drawPath(path, paint(col, 0.30 * g * fa, stroke=8, blur=6, blend="add"))
                c.drawPath(path, paint(col, 0.9 * g * fa, stroke=2.4, blend="add"))
            z = tr[i1, k]
            ra = g * smooth(seg(t, 16.0, 16.6))
            glow_dot(c, cx + z.real * PLANE_S, cy - z.imag * PLANE_S, 9, col, ra)
        # coefficient inset
        ia = g * smooth(seg(t, BRAID_T0 - 0.2, BRAID_T0 + 0.4))
        if ia > 0:
            ix, iy, s = 1590, 300, 150
            c.drawRoundRect(skia.Rect(ix - 190, iy - 190, ix + 190, iy + 230), 16, 16, paint("#0b0e1c", 0.75 * ia))
            c.drawRoundRect(skia.Rect(ix - 190, iy - 190, ix + 190, iy + 230), 16, 16,
                            paint("#7f8fd0", 0.35 * ia, stroke=1.2))
            c.drawLine(ix - 170, iy, ix + 170, iy, paint("#7f8fd0", 0.3 * ia, stroke=1))
            c.drawLine(ix, iy - 170, ix, iy + 170, paint("#7f8fd0", 0.3 * ia, stroke=1))
            bp = 0.8 * (0.2 ** 0.25)
            for z in (bp, -bp, 1j * bp, -1j * bp):  # branch points (roots collide)
                x, y = ix + z.real * s, iy - z.imag * s
                c.drawLine(x - 6, y - 6, x + 6, y + 6, paint("#ff6b8a", ia, stroke=2))
                c.drawLine(x - 6, y + 6, x + 6, y - 6, paint("#ff6b8a", ia, stroke=2))
            us = np.linspace(math.floor(u * 3 - 1e-9) / 3 if u > 0 else 0, u, 80)
            path = skia.Path()
            for j, uu in enumerate(us):
                z = c_path(uu)
                (path.moveTo if j == 0 else path.lineTo)(ix + z.real * s, iy - z.imag * s)
            c.drawPath(path, paint(GOLD, 0.9 * ia, stroke=2.2))
            z = c_path(u)
            glow_dot(c, ix + z.real * s, iy - z.imag * s, 6, GOLD, ia)
            draw_math(c, r"$x^{5}-x+c$", ix, iy + 200, 30, CREAM, a=ia, frame_scale=f.scale)

    def _littlewood(self, f, t):
        img = littlewood_image()
        from ..sims.littlewood import EXTENT, RES
        reveal = ease_out_expo(seg(t, LIT_T0 + 0.2, LIT_T0 + 2.0))
        if reveal <= 0:
            return
        # view: zoom geometrically towards a fractal "dragon" at the edge of the inner hole
        z0 = PLANE_S * 0.92
        zp = ease_in_out(seg(t, 25.0, 29.0))
        zoom = z0 * math.exp(math.log(7.5) * zp)
        tx, ty = -0.47, 0.55
        cxu = tx + (0.0 - tx) * (z0 / zoom)
        cyu = ty + (0.0 - ty) * (z0 / zoom)
        sx, sy = lerp(PLANE_C[0], W / 2, zp), lerp(PLANE_C[1], H / 2 - 40, zp)
        # crop region of the density image for output pixels
        ow, oh = f.w, f.h
        ppu_img = RES / (2 * EXTENT)
        scale_out = zoom * f.scale  # output pixels per unit
        k = ppu_img / scale_out
        # output pixel (ox, oy) -> image pixel (ax*ox + bx, ay*oy + by)
        ax = k
        bx = (cxu + EXTENT) * ppu_img - sx * f.scale * k
        ay = k
        by = (EXTENT - cyu) * ppu_img - sy * f.scale * k
        # crop bounding box then resize (fast INTER_AREA when minifying)
        x0 = int(max(0, math.floor(bx)))
        y0 = int(max(0, math.floor(by)))
        x1 = int(min(RES, math.ceil(bx + ax * ow)))
        y1 = int(min(RES, math.ceil(by + ay * oh)))
        canvas = np.zeros((oh, ow), np.float32)
        if x1 > x0 and y1 > y0:
            crop = np.asarray(img[y0:y1, x0:x1], dtype=np.float32)
            # output rectangle covered by the crop
            ox0 = int(round((x0 - bx) / ax))
            oy0 = int(round((y0 - by) / ay))
            ow2 = max(1, int(round((x1 - x0) / ax)))
            oh2 = max(1, int(round((y1 - y0) / ay)))
            interp = cv2.INTER_AREA if ax > 1 else cv2.INTER_LINEAR
            res = cv2.resize(crop, (ow2, oh2), interpolation=interp) * (ax * ax)
            xa, ya = max(0, ox0), max(0, oy0)
            xb, yb = min(ow, ox0 + ow2), min(oh, oy0 + oh2)
            if xb > xa and yb > ya:
                canvas[ya:yb, xa:xb] = res[ya - oy0:yb - oy0, xa - ox0:xb - ox0]
        # back to counts per density-image pixel, then log tone map
        dimg = canvas / (ax * ax)
        v = np.minimum(np.clip(np.log1p(dimg) / math.log1p(40.0), 0, 1) ** 0.9, 0.93)
        rgb = colormap(v)
        # radial reveal from the centre
        if reveal < 1:
            yy, xx = np.mgrid[0:oh, 0:ow].astype(np.float32)
            rr = np.hypot(xx / f.scale - sx, yy / f.scale - sy)
            m = np.clip((reveal * 1300 - rr) / 200, 0, 1)
            rgb *= m[..., None]
        base = f.rgb()
        f.set_rgb(np.maximum(base, rgb * (1 - smooth(seg(t, 28.4, 29.0)))))
        # flash on the reveal
        fl = 1 - smooth(seg(t, LIT_T0 + 0.2, LIT_T0 + 0.8))
        if 0 < fl < 1:
            f.c.drawCircle(sx, sy, 380, paint("#fff0d8", 0.35 * fl, blur=110, blend="add"))
