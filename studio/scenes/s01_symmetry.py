"""'群' title, a growing snowflake, its 12 symmetries and the Cayley table of D6."""
import math

import numpy as np
import skia
from numba import njit

from ..core import (W, H, CREAM, GOLD, ICE, INK, c4, caption, clamp, draw_text, ease_in_out, ease_out_back,
                    ease_out_cubic, ease_out_expo, envelope, glow_dot, glow_line, hash01, hsv, lerp, mix, paint,
                    pixel_grid, seg, smooth, title_block)
from ..sims.snowflake import freeze_field
from . import Scene

SQ3 = math.sqrt(3.0)
FLAKE_PARAMS = dict(n=401, alpha=1.0, beta=0.4, gamma=0.001, tag="main")


@njit(cache=True)
def _sample(F, n, q, r, k, fw):
    """Barycentric sample of mask and age at fractional axial coords."""
    c = n // 2
    q += c
    r += c
    q0 = math.floor(q)
    r0 = math.floor(r)
    fq = q - q0
    fr = r - r0
    if q0 < 0 or r0 < 0 or q0 + 1 >= n or r0 + 1 >= n:
        return 0.0, 0.0
    if fq + fr < 1.0:
        w0, w1, w2 = 1.0 - fq - fr, fq, fr
        f0, f1, f2 = F[q0, r0], F[q0 + 1, r0], F[q0, r0 + 1]
    else:
        w0, w1, w2 = fq + fr - 1.0, 1.0 - fr, 1.0 - fq
        f0, f1, f2 = F[q0 + 1, r0 + 1], F[q0 + 1, r0], F[q0, r0 + 1]
    m0 = min(max((k - f0) / fw, 0.0), 1.0)
    m1 = min(max((k - f1) / fw, 0.0), 1.0)
    m2 = min(max((k - f2) / fw, 0.0), 1.0)
    a0 = min(max((k - f0) / (k * 0.6 + 1.0), 0.0), 1.0)
    a1 = min(max((k - f1) / (k * 0.6 + 1.0), 0.0), 1.0)
    a2 = min(max((k - f2) / (k * 0.6 + 1.0), 0.0), 1.0)
    return w0 * m0 + w1 * m1 + w2 * m2, w0 * a0 + w1 * a1 + w2 * a2


@njit(cache=True)
def render_flake(out, F, k, cx, cy, cell, rot, flip_axis, flip, scale, tint_r, tint_g, tint_b, gain, ghost):
    """Additively render the crystal into out (h, w, 3) float32.

    cx, cy, cell are in design pixels; scale converts design -> output pixels.
    flip in [-1, 1] squashes the flake perpendicular to flip_axis (3-D flip).
    ghost=1 renders only the outline.
    """
    h, w = out.shape[0], out.shape[1]
    n = F.shape[0]
    rad = (n // 2) * cell * 1.02
    ca, sa = math.cos(-rot), math.sin(-rot)
    cf, sf = math.cos(flip_axis), math.sin(flip_axis)
    fw = 25.0
    lx, ly, lz = -0.45, -0.6, 0.66
    eps = 0.75 / scale
    y0 = max(0, int((cy - rad) * scale) - 2)
    y1 = min(h, int((cy + rad) * scale) + 2)
    x0 = max(0, int((cx - rad) * scale) - 2)
    x1 = min(w, int((cx + rad) * scale) + 2)
    for py in range(y0, y1):
        for px in range(x0, x1):
            dx0 = (px + 0.5) / scale - cx
            dy0 = (py + 0.5) / scale - cy
            if dx0 * dx0 + dy0 * dy0 > rad * rad:
                continue
            hv = np.zeros(3)
            mv = 0.0
            for s in range(3):
                dx = dx0 + (eps if s == 1 else 0.0)
                dy = dy0 + (eps if s == 2 else 0.0)
                # undo flip: coordinates along / across the axis
                a = dx * cf + dy * sf
                b = -dx * sf + dy * cf
                if abs(flip) < 1e-3:
                    hv[s] = 0.0
                    continue
                b = b / flip
                dx = a * cf - b * sf
                dy = a * sf + b * cf
                # undo rotation
                x = (dx * ca - dy * sa) / cell
                y = (dx * sa + dy * ca) / cell
                rr = y / (SQ3 / 2.0)
                qq = x - rr / 2.0
                m, ag = _sample(F, n, qq, rr, k, fw)
                hv[s] = m * (0.35 + 0.65 * math.sqrt(ag))
                if s == 0:
                    mv = m
            if mv <= 0.001 and hv[1] <= 0.001 and hv[2] <= 0.001:
                continue
            gx = (hv[1] - hv[0]) * 2.2
            gy = (hv[2] - hv[0]) * 2.2
            nx, ny, nz = -gx, -gy, 1.0
            nl = math.sqrt(nx * nx + ny * ny + nz * nz)
            nx /= nl
            ny /= nl
            nz /= nl
            edge = min(1.0, math.sqrt(gx * gx + gy * gy) * 1.6)
            if ghost > 0:
                v = edge * gain
                out[py, px, 0] += tint_r * v
                out[py, px, 1] += tint_g * v
                out[py, px, 2] += tint_b * v
                continue
            diff = max(0.0, nx * lx + ny * ly + nz * lz)
            # specular (half vector between light and viewer)
            hx, hy, hz = lx, ly, lz + 1.0
            hl = math.sqrt(hx * hx + hy * hy + hz * hz)
            spec = max(0.0, (nx * hx + ny * hy + nz * hz) / hl) ** 40
            body = mv * (0.10 + 0.35 * hv[0])
            v_r = body * 0.55 + diff * mv * 0.18 + spec * 1.6 + edge * 0.9
            v_g = body * 0.80 + diff * mv * 0.25 + spec * 1.6 + edge * 1.0
            v_b = body * 1.00 + diff * mv * 0.32 + spec * 1.6 + edge * 1.15
            out[py, px, 0] += v_r * tint_r * gain
            out[py, px, 1] += v_g * tint_g * gain
            out[py, px, 2] += v_b * tint_b * gain


# --- D6 group -------------------------------------------------------------
LABELS = ["e", "r", "r²", "r³", "r⁴", "r⁵", "s", "rs", "r²s", "r³s", "r⁴s", "r⁵s"]


def d6_mul(a, b):
    k1, f1 = a % 6, a // 6
    k2, f2 = b % 6, b // 6
    k = (k1 + (k2 if f1 == 0 else -k2)) % 6
    return k + 6 * (f1 ^ f2)


ELEM_COL = [hsv(0.07 + 0.075 * i, 0.55, 1.0) for i in range(6)] + [hsv(0.5 + 0.07 * i, 0.55, 1.0) for i in range(6)]


def icon(c, x, y, size, elem, a=1.0, col=ICE):
    """A stylised snowflake with an asymmetric marker so all 12 symmetries differ."""
    k, f = elem % 6, elem // 6
    c.save()
    c.translate(x, y)
    if f:
        c.scale(1, -1)  # reflect across the horizontal axis
    c.rotate(-60 * k)
    for i in range(6):
        ang = math.radians(60 * i)
        dx, dy = math.cos(ang), math.sin(ang)
        c.drawLine(0, 0, dx * size, dy * size, paint(col, 0.9 * a, stroke=size * 0.07))
        for t in (0.45, 0.7):
            bx, by = dx * size * t, dy * size * t
            for s in (-1, 1):
                a2 = ang + s * math.radians(50)
                c.drawLine(bx, by, bx + math.cos(a2) * size * 0.25, by + math.sin(a2) * size * 0.25,
                           paint(col, 0.8 * a, stroke=size * 0.05))
    # marker: a little gold flag on one side of arm 0
    p = skia.Path()
    p.moveTo(size * 0.82, 0)
    p.lineTo(size * 0.98, -size * 0.28)
    p.lineTo(size * 1.08, -size * 0.06)
    p.close()
    c.drawPath(p, paint(GOLD, a))
    c.drawCircle(size * 1.0, 0, size * 0.11, paint(GOLD, a))
    c.restore()


class Symmetry(Scene):
    duration = 24.0
    bloom = 0.6
    bloom_threshold = 0.5
    vignette = 0.6

    def __init__(self):
        self.F, self.steps = freeze_field(**FLAKE_PARAMS)
        rng = np.random.default_rng(7)
        self.snow = [(rng.random() * W, rng.random() * H, 0.5 + 2.5 * rng.random() ** 2, rng.random())
                     for _ in range(160)]

    def flake_state(self, t):
        """Return dict with growth step, rotation, flip etc."""
        k = self.steps * (0.05 + 0.95 * ease_out_cubic(seg(t, 0.0, 12.0)) ** 0.9)
        rot = math.radians(4 * t)
        # rotation demo 8.0 - 9.6 : +60 degrees
        rot += math.radians(60) * ease_in_out(seg(t, 8.0, 9.7))
        flip = 1.0
        flip_axis = math.radians(90) + rot  # an arm direction rotated with the flake
        fp = ease_in_out(seg(t, 12.0, 13.6))
        flip = math.cos(math.pi * fp)
        scale = 1.0
        cx, cy = W / 2, H / 2 - 50
        shrink = ease_in_out(seg(t, 14.4, 15.6))
        scale = lerp(1.0, 0.36, shrink)
        alpha = 1.0 - smooth(seg(t, 15.2, 16.2))
        return k, rot, flip_axis, flip, scale, cx, cy, alpha

    def draw(self, f, t):
        c = f.c
        # background: deep blue night with soft glow
        bg = skia.GradientShader.MakeRadial(skia.Point(W / 2, H / 2), 1100,
                                            [c4("#0e2138").toColor(), c4("#03060c").toColor()])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=bg))
        # drifting snow bokeh
        for i, (x0, y0, r, ph) in enumerate(self.snow):
            x = (x0 + 30 * math.sin(t * 0.5 + ph * 7)) % W
            y = (y0 + t * (14 + 28 * r)) % H
            a = 0.10 + 0.25 * hash01(i, 11)
            c.drawCircle(x, y, r * 1.5, paint("#cfe9ff", a, blur=r * 1.5 if r > 1.5 else 0.6, blend="add"))

        rgb = f.rgb()
        k, rot, fa, flip, sc, cx, cy, alpha = self.flake_state(t)
        cell = 2.05 * sc
        if alpha > 0:
            layer = np.zeros_like(rgb)
            render_flake(layer, self.F, k, cx, cy, cell, rot, fa, flip, f.scale, 1.0, 1.0, 1.0, 1.0, 0)
            # ghost of the original orientation during the rotation demo
            g = envelope(t, 7.6, 10.4, 0.4, 0.7)
            if g > 0:
                rot0 = math.radians(4 * t)
                render_flake(layer, self.F, k, cx, cy, cell, rot0, fa, 1.0, f.scale, 1.0, 0.8, 0.45, 0.9 * g, 1)
            rgb += layer * alpha
        f.set_rgb(rgb)

        self._overlays(c, t, rot, cx, cy)
        self._group(c, t)
        self._cayley(c, t)

        # opening title "群"
        if t < 4.2:
            fl = 1 - ease_out_expo(seg(t, 0.0, 1.2))
            if fl > 0:
                c.drawRect(skia.Rect(0, 0, W, H), paint("#fff4dc", fl))
            ring = seg(t, 0.0, 1.6)
            if 0 < ring < 1:
                r = lerp(80, 1300, ease_out_cubic(ring))
                c.drawCircle(W / 2, H / 2, r, paint(GOLD, 0.5 * (1 - ring), stroke=6, blur=4, blend="add"))
            ta = 1 - smooth(seg(t, 3.2, 4.1))
            s = lerp(1.15, 1.0, ease_out_cubic(seg(t, 0, 2.5)))
            c.save()
            c.translate(W / 2, H / 2)
            c.scale(s, s)
            c.translate(-W / 2, -H / 2)
            draw_text(c, "群", W / 2, H / 2 + 110, 320, "serif_cn_black", "#fff1d6", a=ta, glow=30,
                      glow_color=GOLD)
            c.restore()
            draw_text(c, "G R O U P", W / 2, H / 2 + 230, 30, "inter_light", GOLD, a=ta * smooth(seg(t, 0.6, 1.6)),
                      tracking=0.6)

        caption(c, t, 4.0, 7.6, "群，是描述「对称」的语言", "Groups are the language of symmetry")
        caption(c, t, 7.8, 11.6, "把雪花旋转 60°，它和原来一模一样", "Rotate a snowflake by 60° — nothing changes")
        caption(c, t, 11.8, 15.2, "沿着六条对称轴翻转，它依然不变", "Flip it across any of its six axes — still the same")
        caption(c, t, 15.4, 19.0, "这 12 个「不变的变换」，构成了一个群：D₆",
                "These 12 symmetries form a group: the dihedral group D6")
        caption(c, t, 19.2, 21.7, "任意两个变换接连做，结果仍在这 12 个之中",
                "Compose any two and you land on one of the twelve")
        caption(c, t, 21.8, 24.0, "每一行、每一列，每个元素恰好出现一次", "Each appears exactly once in every row and column",
                fade=0.6)

    # ------------------------------------------------------------------
    def _overlays(self, c, t, rot, cx, cy):
        # rotation arc during the 60 degree turn
        g = envelope(t, 7.8, 10.6, 0.4, 0.8)
        if g > 0:
            p = ease_in_out(seg(t, 8.0, 9.7))
            r = 430
            start = -90 + math.degrees(math.radians(4 * t))
            path = skia.Path()
            path.addArc(skia.Rect(cx - r, cy - r, cx + r, cy + r), start, 60 * p)
            c.drawPath(path, paint(GOLD, 0.9 * g, stroke=4, blend="add"))
            c.drawPath(path, paint(GOLD, 0.5 * g, stroke=12, blur=8, blend="add"))
            ang = math.radians(start + 60 * p)
            glow_dot(c, cx + r * math.cos(ang), cy + r * math.sin(ang), 7, GOLD, g)
            draw_text(c, "60°", cx + (r + 70) * math.cos(math.radians(start + 30)),
                      cy + (r + 70) * math.sin(math.radians(start + 30)) + 14, 44, "math", GOLD, a=g * smooth(p * 3))
            # coincidence flash
            fl = envelope(t, 9.6, 10.3, 0.05, 0.6)
            if fl > 0:
                c.drawCircle(cx, cy, 420, paint(ICE, 0.25 * fl, blur=60, blend="add"))
        # six mirror axes
        g = envelope(t, 11.4, 15.0, 0.5, 0.8)
        if g > 0:
            for i in range(6):
                p = ease_out_cubic(seg(t, 11.4 + i * 0.1, 12.2 + i * 0.1))
                ang = rot + math.radians(90 + 30 * i)
                L = 470 * p
                dx, dy = math.cos(ang) * L, math.sin(ang) * L
                hl = 1.0 if i == 0 else 0.45
                pe = skia.Paint(AntiAlias=True, Color4f=c4(GOLD, g * hl))
                pe.setStyle(skia.Paint.kStroke_Style)
                pe.setStrokeWidth(2.5 if i == 0 else 1.6)
                pe.setPathEffect(skia.DashPathEffect.Make([14, 10], -t * 40))
                pe.setBlendMode(skia.BlendMode.kPlus)
                c.drawLine(cx - dx, cy - dy, cx + dx, cy + dy, pe)

    def _group(self, c, t):
        g = envelope(t, 15.0, 19.6, 0.6, 0.8)
        if g <= 0:
            return
        cx, cy = W / 2, H / 2 - 50
        R = 330
        for e in range(12):
            p = ease_out_cubic(seg(t, 15.0 + e * 0.07, 16.3 + e * 0.07))
            ang = math.radians(-90 + 30 * e)
            x = lerp(cx, cx + R * math.cos(ang), p)
            y = lerp(cy, cy + R * math.sin(ang), p)
            col = ELEM_COL[e]
            c.drawCircle(x, y, 62, paint(col, 0.10 * g * p, blur=20, blend="add"))
            icon(c, x, y, 38 * lerp(0.6, 1.0, p), e, a=g * p, col=mix(col, "#ffffff", 0.5))
            draw_text(c, LABELS[e], x, y + 86, 30, "math_it", col, a=g * smooth(seg(t, 16.0 + e * 0.07, 16.6 + e * 0.07)))
        # centre title
        draw_text(c, "D₆", cx, cy + 34, 96, "math", CREAM, a=g * smooth(seg(t, 16.2, 17.0)), glow=12, glow_color=GOLD)

    def _cayley(self, c, t):
        g = smooth(seg(t, 19.0, 19.8))
        if g <= 0:
            return
        n = 12
        cs = 52
        gx0 = W / 2 - cs * n / 2 + 20
        gy0 = 120
        # headers
        for i in range(n):
            a = g * smooth(seg(t, 19.0 + i * 0.03, 19.5 + i * 0.03))
            draw_text(c, LABELS[i], gx0 + cs * i + cs / 2, gy0 - 16, 22, "math_it", ELEM_COL[i], a=a)
            draw_text(c, LABELS[i], gx0 - 30, gy0 + cs * i + cs / 2 + 8, 22, "math_it", ELEM_COL[i], a=a)
        c.drawLine(gx0 - 6, gy0 - 4, gx0 + cs * n, gy0 - 4, paint(CREAM, 0.4 * g, stroke=1.2))
        c.drawLine(gx0 - 6, gy0 - 4, gx0 - 6, gy0 + cs * n, paint(CREAM, 0.4 * g, stroke=1.2))
        hl_row = int(clamp((t - 22.0) / 0.25, 0, 11)) if t > 22.0 else -1
        hl_a = envelope(t, 21.8, 24.0, 0.3, 0.4)
        for i in range(n):
            for j in range(n):
                p = seg(t, 19.3 + (i + j) * 0.055, 19.9 + (i + j) * 0.055)
                if p <= 0:
                    continue
                e = d6_mul(i, j)
                s = ease_out_back(p) * (cs - 6)
                x = gx0 + cs * j + cs / 2
                y = gy0 + cs * i + cs / 2
                col = ELEM_COL[e]
                lit = 1.0
                if hl_a > 0 and hl_row >= 0:
                    on = (i == hl_row) or (j == hl_row)
                    lit = lerp(1.0, 1.35 if on else 0.45, hl_a)
                r = skia.Rect(x - s / 2, y - s / 2, x + s / 2, y + s / 2)
                c.drawRoundRect(r, 6, 6, paint(mix(col, "#000000", 0.35), g * min(1, lit) * 0.92))
                if lit > 1.0:
                    c.drawRoundRect(r, 6, 6, paint(col, g * (lit - 1.0) * 1.5, blur=8, blend="add"))
                draw_text(c, LABELS[e], x, y + 7, 20, "math_it", "#ffffff", a=g * smoothstep01(p) * min(1, lit))


def smoothstep01(x):
    return smooth(x)
