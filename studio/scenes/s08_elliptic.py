"""Elliptic curves: the chord-and-tangent group law, and its finite-field version (cryptography)."""
import functools
import math

import numpy as np
import skia

from ..core import (W, H, CREAM, CYAN, GOLD, MAGENTA, c4, caption, clamp, draw_math, draw_text, ease_in_out,
                    ease_out_back, ease_out_cubic, envelope, glow_dot, glow_line, hash01, lerp, mix, paint, seg,
                    smooth)
from . import Scene

A, B = -1.0, 1.0  # y^2 = x^3 - x + 1
OX, OY, SC = 880, 440, 120  # screen origin / pixels per unit
P_FIELD = 1009
SECP_P = "FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE FFFFFC2F"


def to_screen(x, y):
    return OX + x * SC, OY - y * SC


def add(P, Q):
    if P is None:
        return Q
    if Q is None:
        return P
    (x1, y1), (x2, y2) = P, Q
    if abs(x1 - x2) < 1e-12:
        if abs(y1 + y2) < 1e-12:
            return None
        lam = (3 * x1 * x1 + A) / (2 * y1)
    else:
        lam = (y2 - y1) / (x2 - x1)
    x3 = lam * lam - x1 - x2
    return (x3, lam * (x1 - x3) - y1)


@functools.lru_cache(maxsize=1)
def curve_path_pts():
    # real root of x^3 - x + 1
    r = np.roots([1, 0, A, B])
    x0 = float(min(r.real[np.abs(r.imag) < 1e-9]))
    s = np.linspace(0, 1, 500)
    xs = x0 + (s ** 2) * (2.25 - x0)
    ys = np.sqrt(np.maximum(xs ** 3 + A * xs + B, 0))
    upper = list(zip(xs[::-1], ys[::-1]))
    lower = list(zip(xs, -ys))
    return upper + lower


@functools.lru_cache(maxsize=1)
def multiples(n=40):
    G = (-1.0, 1.0)
    # use a less special starting point so the orbit looks irregular
    G = (0.35, math.sqrt(0.35 ** 3 - 0.35 + 1))
    pts = [G]
    cur = G
    for _ in range(n - 1):
        cur = add(cur, G)
        pts.append(cur)
    return pts


def _inv(a, p):
    return pow(a, p - 2, p)


def fadd(P, Q, p=P_FIELD, a=0):
    if P is None:
        return Q
    if Q is None:
        return P
    (x1, y1), (x2, y2) = P, Q
    if x1 == x2 and (y1 + y2) % p == 0:
        return None
    if P == Q:
        lam = (3 * x1 * x1 + a) * _inv(2 * y1, p) % p
    else:
        lam = (y2 - y1) * _inv((x2 - x1) % p, p) % p
    x3 = (lam * lam - x1 - x2) % p
    return (x3, (lam * (x1 - x3) - y1) % p)


@functools.lru_cache(maxsize=1)
def field_points():
    p = P_FIELD
    sq = {}
    for y in range(p):
        sq.setdefault(y * y % p, []).append(y)
    pts = []
    for x in range(p):
        r = (x ** 3 + 7) % p
        for y in sq.get(r, []):
            pts.append((x, y))
    return pts


@functools.lru_cache(maxsize=1)
def field_multiples(n=60):
    G = (5, None)
    for x, y in field_points():
        if x == 17:
            G = (x, y)
            break
    out = [G]
    cur = G
    for _ in range(n - 1):
        cur = fadd(cur, G)
        if cur is None:
            break
        out.append(cur)
    return out


FIELD_BOX = (W / 2 - 380, 50, 760)  # x0, y0, size


def fscreen(x, y):
    x0, y0, s = FIELD_BOX
    return x0 + (x + 0.5) / P_FIELD * s, y0 + s - (y + 0.5) / P_FIELD * s


class Elliptic(Scene):
    duration = 20.0
    bloom = 0.6
    bloom_threshold = 0.5
    vignette = 0.6

    def draw(self, f, t):
        c = f.c
        bg = skia.GradientShader.MakeRadial(skia.Point(W / 2, H / 2), 1200,
                                            [c4("#071420").toColor(), c4("#010307").toColor()])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=bg))
        real_a = 1 - smooth(seg(t, 10.6, 11.8))
        if real_a > 0:
            self._real(c, t, real_a, f.scale)
        if t > 10.6:
            self._field(c, t, f.scale)
        caption(c, t, 0.4, 3.9, "椭圆曲线上的点，也能做「加法」", "Points on an elliptic curve can be added")
        caption(c, t, 4.1, 7.4, "连线、找到第三个交点、再翻折 —— 它们构成一个群",
                "Draw a line, find the third point, reflect — a group")
        caption(c, t, 7.6, 10.8, "从 P 出发不断加 P：P, 2P, 3P…… 轨迹看似毫无规律",
                "Keep adding P: P, 2P, 3P… the path looks random")
        caption(c, t, 11.2, 14.4, "换到有限域上，曲线化作一片星海", "Over a finite field, the curve becomes a sea of stars")
        caption(c, t, 14.6, 17.2, "由 P 算出 nP 很容易；由 nP 倒推 n，却几乎不可能",
                "Computing nP is easy — recovering n is practically impossible")
        caption(c, t, 17.4, 20.0, "比特币、HTTPS、手机支付……都由这个群守护", "Bitcoin, HTTPS, mobile payments — all guarded by this group",
                fade=0.6)

    # ------------------------------------------------------------------
    def _real(self, c, t, alpha, sc):
        # axes
        c.drawLine(OX - 2.0 * SC, OY, OX + 3.6 * SC, OY, paint("#5f7fa0", 0.35 * alpha, stroke=1.2))
        c.drawLine(OX, OY - 3.0 * SC, OX, OY + 3.0 * SC, paint("#5f7fa0", 0.35 * alpha, stroke=1.2))
        pts = curve_path_pts()
        p = ease_in_out(seg(t, 0.0, 1.6))
        n = max(2, int(len(pts) * p))
        sp = [to_screen(x, y) for x, y in pts[:n]]
        glow_line(c, sp, CYAN, width=3.0, glow=12, a=alpha)
        draw_math(c, r"$y^{2}=x^{3}-x+1$", OX + 2.6 * SC, OY - 2.55 * SC, 40, CREAM, a=alpha * smooth(seg(t, 0.8, 1.6)),
                  frame_scale=sc)
        # group law with P=(-1,1), Q=(0,1), R=(1,1), P+Q=(1,-1)
        g = alpha * (1 - smooth(seg(t, 7.2, 7.8)))
        if g > 0:
            P, Q, R, S = (-1, 1), (0, 1), (1, 1), (1, -1)
            la = ease_out_cubic(seg(t, 2.0, 3.1))
            if la > 0:
                x0, x1 = -1.9, lerp(-0.6, 3.2, la)
                glow_line(c, [to_screen(x0, 1), to_screen(x1, 1)], "#ffffff", width=1.8, glow=6, a=0.7 * g)
            va = ease_in_out(seg(t, 3.4, 4.3))
            if va > 0:
                pe = skia.Paint(AntiAlias=True, Color4f=c4(GOLD, 0.9 * g), StrokeWidth=2)
                pe.setStyle(skia.Paint.kStroke_Style)
                pe.setPathEffect(skia.DashPathEffect.Make([10, 8], 0))
                a0 = to_screen(1, 1)
                a1 = to_screen(1, lerp(1, -1, va))
                c.drawLine(*a0, *a1, pe)
            for (pt, lab, t0, col) in ((P, "P", 1.0, MAGENTA), (Q, "Q", 1.4, MAGENTA), (R, "R", 3.0, "#ffffff"),
                                       (S, "P + Q", 4.3, GOLD)):
                a = g * smooth(seg(t, t0, t0 + 0.3))
                if a <= 0:
                    continue
                x, y = to_screen(*pt)
                pop = ease_out_back(seg(t, t0, t0 + 0.4))
                glow_dot(c, x, y, 9 * pop, col, a)
                draw_text(c, lab, x + 22, y - 18 if pt[1] > 0 else y + 44, 34, "math_it", col, a=a, align="left")
        # multiples nP
        m = alpha * envelope(t, 7.4, 11.5, 0.4, 0.8)
        if m > 0:
            pts = multiples()
            k = int(clamp((t - 7.6) / 0.11, 0, len(pts) - 1))
            fr = clamp((t - 7.6) / 0.11 - k, 0, 1)
            for i in range(k + 1):
                x, y = pts[i]
                if abs(x) > 4 or abs(y) > 4:
                    continue
                sx, sy = to_screen(x, y)
                age = (k - i) * 0.11 + fr * 0.11
                a = m * (0.35 + 0.65 * math.exp(-age * 1.2))
                glow_dot(c, sx, sy, 6, GOLD if i == k else "#ffd98a", a)
                if i < 6:
                    draw_text(c, f"{i + 1}P" if i else "P", sx + 14, sy - 14, 26, "math_it", GOLD, a=a * 0.9, align="left")
                if i > 0:
                    x0, y0 = pts[i - 1]
                    if abs(x0) < 4 and abs(y0) < 4:
                        s0 = to_screen(x0, y0)
                        c.drawLine(*s0, sx, sy, paint(GOLD, 0.25 * a, stroke=1.4, blend="add"))

    def _field(self, c, t, sc):
        fa = smooth(seg(t, 10.8, 12.0)) * (1 - smooth(seg(t, 19.4, 20.0)))
        x0, y0, s = FIELD_BOX
        c.drawRect(skia.Rect(x0, y0, x0 + s, y0 + s), paint("#3d6b8f", 0.35 * fa, stroke=1.2))
        pts = field_points()
        for i, (x, y) in enumerate(pts):
            a = fa * smooth(seg(t, 11.0 + x / P_FIELD * 1.6, 11.3 + x / P_FIELD * 1.6))
            if a <= 0:
                continue
            sx, sy = fscreen(x, y)
            tw = 0.6 + 0.4 * math.sin(t * 3 + hash01(i, 4) * 20)
            c.drawCircle(sx, sy, 2.2, paint(mix(CYAN, "#ffffff", 0.4), a * tw, blend="add"))
            c.drawCircle(sx, sy, 5, paint(CYAN, 0.18 * a * tw, blur=3, blend="add"))
        # labels
        draw_math(c, r"$y^{2}\equiv x^{3}+7$", x0 - 40, y0 + 330, 36, CREAM, a=fa * 0.9, align="right",
                  frame_scale=sc)
        draw_math(c, r"$(\mathrm{mod}\ 1009)$", x0 - 40, y0 + 390, 30, "#9fd8ff", a=fa * 0.8, align="right",
                  frame_scale=sc)
        # hopping multiples
        ha = envelope(t, 13.0, 19.6, 0.4, 0.6)
        if ha > 0:
            mp = field_multiples()
            k = int(clamp((t - 13.2) / 0.085, 0, len(mp) - 1))
            for i in range(1, k + 1):
                a = ha * math.exp(-(k - i) * 0.08)
                s0 = fscreen(*mp[i - 1])
                s1 = fscreen(*mp[i])
                col = mix(MAGENTA, GOLD, i / len(mp))
                c.drawLine(*s0, *s1, paint(col, 0.55 * a, stroke=1.6, blend="add"))
            for i in range(k + 1):
                sx, sy = fscreen(*mp[i])
                a = ha * (1.0 if i == k else 0.5 * math.exp(-(k - i) * 0.05))
                glow_dot(c, sx, sy, 6 if i == k else 3.5, GOLD if i == k else MAGENTA, a)
            sx, sy = fscreen(*mp[k])
            draw_text(c, f"{k + 1}P", sx + 14, sy - 12, 26, "math_it", GOLD, a=ha, align="left")
        # secp256k1 panel
        pa = envelope(t, 16.8, 20.0, 0.6, 0.6)
        if pa > 0:
            draw_text(c, "secp256k1", 1640, 360, 34, "mono", GOLD, a=pa, glow=6)
            draw_math(c, r"$y^{2}=x^{3}+7$", 1640, 420, 36, CREAM, a=pa, frame_scale=sc)
            draw_text(c, "p =", 1480, 490, 22, "mono", CREAM, a=pa * 0.8, align="left")
            for i, chunk in enumerate(SECP_P.split()):
                ca = pa * smooth(seg(t, 17.0 + i * 0.12, 17.3 + i * 0.12))
                draw_text(c, chunk, 1560 + (i % 2) * 150, 490 + (i // 2) * 34, 24, "mono", "#9fd8ff", a=ca, align="left")
            draw_text(c, "≈ 1.16 × 10⁷⁷", 1640, 660, 24, "math", CREAM, a=pa * 0.8)
