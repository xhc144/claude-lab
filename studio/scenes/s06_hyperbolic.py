"""Hyperbolic tilings in the Poincaré disc ({7,3} and {5,4}), flowing under Möbius maps."""
import math

import numpy as np
import skia
from numba import njit

from ..core import (W, H, CREAM, GOLD, c4, caption, ease_in_out, ease_out_cubic, envelope, lerp, paint, seg,
                    smooth)
from . import Scene

PALETTES = {
    (7, 3): np.array([[0.04, 0.16, 0.42], [0.02, 0.38, 0.44], [0.46, 0.08, 0.30], [0.62, 0.38, 0.08]]),
    (5, 4): np.array([[0.30, 0.07, 0.46], [0.04, 0.24, 0.55], [0.62, 0.18, 0.08], [0.05, 0.40, 0.30]]),
}


@njit(cache=True)
def _tile(out, cx, cy, R, scale, p, q, wr, wi, rot, pal, alpha, ss):
    h, w = out.shape[0], out.shape[1]
    a = math.pi / p
    b = math.pi / q
    d = math.cos(b) / math.sqrt(math.cos(b) ** 2 - math.sin(a) ** 2)
    r = math.sqrt(d * d - 1.0)
    sa, ca = math.sin(a), math.cos(a)
    cr, sr = math.cos(rot), math.sin(rot)
    pix = 1.0 / (R * scale)  # size of one output pixel in disc units
    y0 = max(0, int((cy - R - 4) * scale))
    y1 = min(h, int((cy + R + 4) * scale) + 1)
    x0 = max(0, int((cx - R - 4) * scale))
    x1 = min(w, int((cx + R + 4) * scale) + 1)
    ops = np.zeros(64, np.int8)
    for py in range(y0, y1):
        for px in range(x0, x1):
            accr = 0.0
            accg = 0.0
            accb = 0.0
            cov = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    X = ((px + (sx + 0.5) / ss) / scale - cx) / R
                    Y = ((py + (sy + 0.5) / ss) / scale - cy) / R
                    rr = X * X + Y * Y
                    if rr >= 1.0:
                        continue
                    cov += 1.0
                    # Möbius: z -> e^{i rot} (z - w) / (1 - conj(w) z)
                    nr = X - wr
                    ni = Y - wi
                    dr = 1.0 - (wr * X + wi * Y)
                    di = -(wr * Y - wi * X)
                    dd = dr * dr + di * di
                    zr = (nr * dr + ni * di) / dd
                    zi = (ni * dr - nr * di) / dd
                    # derivative magnitude |(1-|w|^2)/(1-conj(w)z)^2|
                    dscale = (1.0 - wr * wr - wi * wi) / dd
                    x = zr * cr - zi * sr
                    y = zr * sr + zi * cr
                    flips = 0
                    inv = 0
                    nops = 0
                    for it in range(60):
                        changed = False
                        if y < 0:
                            y = -y
                            flips += 1
                            changed = True
                            if nops < 64:
                                ops[nops] = 0
                                nops += 1
                        dot = -x * sa + y * ca
                        if dot > 0:
                            x += 2 * dot * sa
                            y -= 2 * dot * ca
                            flips += 1
                            changed = True
                            if nops < 64:
                                ops[nops] = 1
                                nops += 1
                        dx = x - d
                        d2 = dx * dx + y * y
                        if d2 < r * r:
                            k = r * r / d2
                            x = d + dx * k
                            y = y * k
                            dscale *= k
                            inv += 1
                            changed = True
                            if nops < 64:
                                ops[nops] = 2
                                nops += 1
                        if not changed:
                            break
                    # tile centre = inverse ops applied to the origin
                    tx = 0.0
                    ty = 0.0
                    for j in range(nops - 1, -1, -1):
                        o = ops[j]
                        if o == 0:
                            ty = -ty
                        elif o == 1:
                            dt = -tx * sa + ty * ca
                            tx += 2 * dt * sa
                            ty -= 2 * dt * ca
                        else:
                            ddx = tx - d
                            dd2 = ddx * ddx + ty * ty
                            kk = r * r / dd2
                            tx = d + ddx * kk
                            ty = ty * kk
                    qx = int(math.floor(tx * 2000.0 + 0.5))
                    qy = int(math.floor(ty * 2000.0 + 0.5))
                    hsh = ((qx * 73856093) ^ (qy * 19349663)) & 0x7fffffff
                    hsh = (hsh ^ (hsh >> 13)) * 1274126177
                    hsh = (hsh ^ (hsh >> 16)) & 0x7fffffff
                    # local pixel footprint in folded coordinates
                    fp = pix * dscale / ss
                    # distance to the edge geodesic (circle) and to radial mirror
                    de = abs(math.sqrt((x - d) ** 2 + y * y) - r)
                    dm = abs(-x * sa + y * ca)
                    rad = math.sqrt(x * x + y * y)
                    ci = hsh % 4 if inv > 0 else 0
                    cr0 = pal[ci, 0]
                    cg0 = pal[ci, 1]
                    cb0 = pal[ci, 2]
                    shade = 0.78 if (flips % 2) == 0 else 1.0
                    # radial gradient inside each tile (glass)
                    g = 0.55 + 0.75 * math.exp(-rad * rad * 6.0)
                    cr1 = cr0 * shade * g
                    cg1 = cg0 * shade * g
                    cb1 = cb0 * shade * g
                    # centre rosette ring
                    ring = abs(rad - 0.16)
                    lw = 0.012
                    mr = min(max((lw + fp - ring) / (2 * fp + 1e-9), 0.0), 1.0)
                    cr1 = cr1 * (1 - mr) + 0.95 * mr
                    cg1 = cg1 * (1 - mr) + 0.78 * mr
                    cb1 = cb1 * (1 - mr) + 0.50 * mr
                    # radial spokes (faint)
                    ms = min(max((0.004 + fp - dm) / (2 * fp + 1e-9), 0.0), 1.0) * 0.35
                    cr1 += ms * 0.6
                    cg1 += ms * 0.55
                    cb1 += ms * 0.45
                    # gold leading on tile edges
                    lw = 0.016
                    me = min(max((lw + fp - de) / (2 * fp + 1e-9), 0.0), 1.0)
                    glow = math.exp(-de / 0.05) * 0.16
                    cr1 = cr1 * (1 - me) + 1.05 * me + glow * 0.9
                    cg1 = cg1 * (1 - me) + 0.80 * me + glow * 0.65
                    cb1 = cb1 * (1 - me) + 0.42 * me + glow * 0.25
                    # tiny tiles near the rim: fade toward an average tone
                    tiny = min(max((fp - 0.02) / 0.08, 0.0), 1.0)
                    cr1 = cr1 * (1 - tiny) + 0.18 * tiny
                    cg1 = cg1 * (1 - tiny) + 0.16 * tiny
                    cb1 = cb1 * (1 - tiny) + 0.22 * tiny
                    accr += cr1
                    accg += cg1
                    accb += cb1
            if cov > 0:
                n = ss * ss
                k = alpha / n
                out[py, px, 0] = out[py, px, 0] * (1 - alpha * cov / n) + accr * k
                out[py, px, 1] = out[py, px, 1] * (1 - alpha * cov / n) + accg * k
                out[py, px, 2] = out[py, px, 2] * (1 - alpha * cov / n) + accb * k


class Hyperbolic(Scene):
    duration = 14.5
    bloom = 0.45
    bloom_threshold = 0.6
    vignette = 0.6

    def draw(self, f, t):
        c = f.c
        bg = skia.GradientShader.MakeRadial(skia.Point(W / 2, H / 2 - 40), 1100,
                                            [c4("#120a24").toColor(), c4("#020106").toColor()])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=bg))
        cx, cy = W / 2, H / 2 - 75
        grow = ease_out_cubic(seg(t, 0.0, 1.6))
        R = 420 * lerp(0.2, 1.0, grow)
        c.drawCircle(cx, cy, R * 1.04, paint("#c9a2ff", 0.18 * grow, blur=40, blend="add"))
        rgb = f.rgb()
        wr = 0.42 * math.sin(t * 0.45)
        wi = 0.30 * math.sin(t * 0.31 + 1.0)
        rot = t * 0.12
        x = smooth(seg(t, 7.0, 8.2))
        alpha = smooth(seg(t, 0.0, 1.0)) * (1 - smooth(seg(t, 13.8, 14.5)))
        if x < 1:
            _tile(rgb, cx, cy, R, f.scale, 7, 3, wr, wi, rot, PALETTES[(7, 3)], alpha * (1 - x), 2)
        if x > 0:
            _tile(rgb, cx, cy, R, f.scale, 5, 4, -wr, wi, -rot, PALETTES[(5, 4)], alpha * x, 2)
        f.set_rgb(rgb)
        # rim
        c.drawCircle(cx, cy, R, paint("#e7d3ff", 0.55 * alpha, stroke=2.0))
        c.drawCircle(cx, cy, R, paint("#b58cff", 0.4 * alpha, stroke=8, blur=10, blend="add"))
        fl = envelope(t, 7.0, 8.4, 0.3, 1.0)
        if fl > 0:
            c.drawCircle(cx, cy, R, paint("#ffffff", 0.18 * fl, blur=60, blend="add"))
        caption(c, t, 0.6, 4.4, "如果空间本身是弯曲的呢？", "What if space itself is curved?")
        caption(c, t, 4.6, 9.2, "埃舍尔《圆极限》：无穷多块全等的图形，挤进一个圆",
                "Escher's Circle Limit: infinitely many equal tiles inside one disc")
        caption(c, t, 9.4, 14.3, "双曲平面的对称群 —— 无穷，却井然有序", "Hyperbolic symmetry: infinite, yet perfectly ordered")
        draw_label = envelope(t, 1.5, 13.5, 0.6, 0.6)
        if draw_label > 0:
            from ..core import draw_text
            lab = "{7, 3}" if t < 7.6 else "{5, 4}"
            la = draw_label * (1 - envelope(t, 7.0, 8.2, 0.6, 0.6))
            draw_text(c, lab, 1620, 520, 54, "math", CREAM, a=la, glow=8, glow_color="#b58cff")
            draw_text(c, "SCHLÄFLI SYMBOL", 1620, 560, 16, "inter_light", CREAM, a=la * 0.6, tracking=0.3)
