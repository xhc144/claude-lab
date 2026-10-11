"""Symmetry in physics: Noether, the eightfold way (Omega-minus), and E8."""
import functools
import itertools
import math

import numpy as np
import skia

from ..core import (W, H, CREAM, CYAN, GOLD, MAGENTA, c4, caption, clamp, draw_math, draw_text, ease_in_out,
                    ease_out_back, ease_out_cubic, ease_out_expo, envelope, glow_dot, glow_line, hash01, hsv,
                    lerp, mix, paint, seg, smooth)
from . import Scene

E8_SNAP = 19.0


@functools.lru_cache(maxsize=1)
def e8():
    roots = []
    for i, j in itertools.combinations(range(8), 2):
        for si in (-1, 1):
            for sj in (-1, 1):
                v = np.zeros(8)
                v[i], v[j] = si, sj
                roots.append(v)
    for signs in itertools.product((-0.5, 0.5), repeat=8):
        if sum(1 for s in signs if s < 0) % 2 == 0:
            roots.append(np.array(signs))
    R = np.array(roots)
    G = R @ R.T
    ii, jj = np.where(np.abs(G - 1) < 1e-9)
    edges = np.array([(i, j) for i, j in zip(ii, jj) if i < j])
    # Coxeter plane
    e = np.eye(8)
    simple = [0.5 * np.array([1, -1, -1, -1, -1, -1, -1, 1]), e[0] + e[1], -e[0] + e[1], -e[1] + e[2],
              -e[2] + e[3], -e[3] + e[4], -e[4] + e[5], -e[5] + e[6]]
    C = np.eye(8)
    for a in simple:
        S = np.eye(8) - 2 * np.outer(a, a) / (a @ a)
        C = C @ S
    w, V = np.linalg.eig(C)
    k = np.argmin(np.abs(np.angle(w) - 2 * np.pi / 30))
    v = V[:, k]
    b1 = np.real(v)
    b2 = np.imag(v)
    b1 /= np.linalg.norm(b1)
    b2 -= (b2 @ b1) * b1
    b2 /= np.linalg.norm(b2)
    petrie = np.stack([b1, b2])
    rad = np.linalg.norm(R @ petrie.T, axis=1)
    levels = np.unique(np.round(rad, 4))
    ring = np.array([int(np.argmin(np.abs(levels - r))) for r in rad])
    return R, edges, petrie, ring


def _orth(B):
    q, _ = np.linalg.qr(B.T)
    return q.T[:2]


@functools.lru_cache(maxsize=1)
def _random_basis():
    rng = np.random.default_rng(12)
    return _orth(rng.normal(size=(2, 8)))


DECUPLET = [  # label, row (strangeness), position in row, charge
    ("Δ⁻", 0, 0), ("Δ⁰", 0, 1), ("Δ⁺", 0, 2), ("Δ⁺⁺", 0, 3),
    ("Σ*⁻", 1, 0), ("Σ*⁰", 1, 1), ("Σ*⁺", 1, 2),
    ("Ξ*⁻", 2, 0), ("Ξ*⁰", 2, 1),
    ("Ω⁻", 3, 0),
]
MASSES = ["1232 MeV", "1385 MeV", "1530 MeV", "1672 MeV"]


class Physics(Scene):
    duration = 25.0
    bloom = 0.65
    bloom_threshold = 0.45
    vignette = 0.6

    def draw(self, f, t):
        c = f.c
        bg = skia.GradientShader.MakeRadial(skia.Point(W / 2, H / 2), 1200,
                                            [c4("#0d0a1c").toColor(), c4("#020106").toColor()])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=bg))
        if t < 7.6:
            self._noether(c, t)
        if 6.8 < t < 16.9:
            self._decuplet(c, t, f.scale)
        if t > 16.0:
            self._e8(c, t)
        caption(c, t, 0.4, 3.3, "1918 年，埃米·诺特证明了一个惊人的定理：", "1918: Emmy Noether proves a stunning theorem")
        caption(c, t, 3.5, 7.2, "每一种对称，都对应着一条守恒定律", "Every symmetry gives a conservation law")
        caption(c, t, 7.6, 10.6, "1962 年，盖尔曼用 SU(3) 对称群给粒子排队", "1962: Gell-Mann arranges particles by SU(3) symmetry")
        caption(c, t, 10.8, 13.6, "图案缺了一角 —— 他预言了一个从未见过的粒子", "One slot was empty — he predicted an unseen particle")
        caption(c, t, 13.8, 16.6, "1964 年，Ω⁻ 粒子在实验中被找到，质量与预言惊人一致",
                "1964: the Omega-minus is found, right where symmetry said", size=42)
        caption(c, t, 17.0, 20.6, "E₈ —— 一个 248 维的对称群", "E8 — a symmetry group of dimension 248")
        caption(c, t, 20.8, 25.0, "人类发现的最庞大、也最美丽的结构之一",
                "One of the largest and most beautiful structures ever found", fade=0.6)

    # ------------------------------------------------------------------
    def _noether(self, c, t):
        out = 1 - smooth(seg(t, 6.9, 7.6))
        items = [("时间平移", "能量守恒", "TIME → ENERGY", "#ffb15c"),
                 ("空间平移", "动量守恒", "SPACE → MOMENTUM", CYAN),
                 ("旋转", "角动量守恒", "ROTATION → ANGULAR MOMENTUM", "#c18cff")]
        for i, (sym, law, en, col) in enumerate(items):
            a = smooth(seg(t, 1.0 + i * 0.5, 1.6 + i * 0.5)) * out
            if a <= 0:
                continue
            cx = W / 2 + (i - 1) * 520
            cy = 390
            p = ease_out_cubic(seg(t, 1.0 + i * 0.5, 1.8 + i * 0.5))
            c.save()
            c.translate(0, (1 - p) * 30)
            c.drawCircle(cx, cy, 120, paint(col, 0.06 * a, blur=40, blend="add"))
            c.drawCircle(cx, cy, 110, paint(col, 0.5 * a, stroke=1.5))
            if i == 0:  # clock
                for k in range(12):
                    ang = k * math.pi / 6
                    c.drawLine(cx + 92 * math.cos(ang), cy + 92 * math.sin(ang), cx + 102 * math.cos(ang),
                               cy + 102 * math.sin(ang), paint(col, 0.8 * a, stroke=2))
                ang = t * 2.0 - math.pi / 2
                glow_line(c, [(cx, cy), (cx + 80 * math.cos(ang), cy + 80 * math.sin(ang))], col, 3, 6, a)
                ang2 = t * 0.4 - math.pi / 2
                glow_line(c, [(cx, cy), (cx + 55 * math.cos(ang2), cy + 55 * math.sin(ang2))], col, 4, 6, a)
            elif i == 1:  # translating lattice
                c.save()
                c.clipRect(skia.Rect(cx - 104, cy - 104, cx + 104, cy + 104))
                path = skia.Path()
                path.addCircle(cx, cy, 104)
                c.clipPath(path, doAntiAlias=True)
                off = (t * 40) % 40
                for gx in range(-4, 5):
                    for gy in range(-3, 4):
                        glow_dot(c, cx + gx * 40 + off, cy + gy * 40, 3, col, a * 0.8, glow=2)
                c.restore()
                glow_line(c, [(cx - 60, cy + 140), (cx + 60, cy + 140)], col, 2, 4, a)
                c.drawPath(_arrow_head(cx + 60, cy + 140, 0), paint(col, a))
            else:  # orbit
                c.save()
                c.translate(cx, cy)
                c.scale(1, 0.45)
                c.drawCircle(0, 0, 85, paint(col, 0.6 * a, stroke=2.5))
                c.restore()
                ang = t * 1.6
                px, py = cx + 85 * math.cos(ang), cy + 85 * 0.45 * math.sin(ang)
                glow_dot(c, cx, cy, 10, "#fff2c4", a)
                glow_dot(c, px, py, 7, col, a)
            draw_text(c, sym, cx, cy + 210, 40, "serif_cn_semibold", CREAM, a=a, tracking=0.15)
            draw_text(c, "⇓", cx, cy + 262, 30, "dejavu", col, a=a * smooth(seg(t, 3.6 + i * 0.3, 4.0 + i * 0.3)))
            la = a * smooth(seg(t, 3.8 + i * 0.3, 4.4 + i * 0.3))
            draw_text(c, law, cx, cy + 320, 46, "serif_cn_bold", col, a=la, tracking=0.15, glow=10, glow_color=col)
            draw_text(c, en, cx, cy + 362, 15, "inter_light", CREAM, a=la * 0.7, tracking=0.3)
            c.restore()

    def _decuplet(self, c, t, sc):
        a = smooth(seg(t, 7.0, 7.8)) * (1 - smooth(seg(t, 16.2, 16.9)))
        if a <= 0:
            return
        cx, cy = W / 2 - 80, 170
        dx, dy = 175, 170

        def pos(row, k):
            n = 4 - row
            return cx + (k - (n - 1) / 2) * dx, cy + row * dy

        # lattice lines
        for row in range(4):
            n = 4 - row
            x0, y0 = pos(row, 0)
            x1, y1 = pos(row, n - 1)
            c.drawLine(x0, y0, x1, y1, paint("#6c5fb0", 0.35 * a, stroke=1.2))
        # the two diagonal families
        for m in range(4):
            c.drawLine(*pos(0, m), *pos(3 - m, m), paint("#6c5fb0", 0.25 * a, stroke=1.0))
            c.drawLine(*pos(0, 3 - m), *pos(3 - m, 0), paint("#6c5fb0", 0.25 * a, stroke=1.0))
        # outer triangle
        tri = [pos(0, 0), pos(0, 3), pos(3, 0)]
        glow_line(c, tri, "#9b7bff", 1.6, 8, 0.6 * a, closed=True)
        omega_t = 13.8
        for lab, row, k in DECUPLET:
            x, y = pos(row, k)
            if lab == "Ω⁻":
                if t < omega_t:
                    pa = a * smooth(seg(t, 10.8, 11.4))
                    pe = skia.Paint(AntiAlias=True, Color4f=c4(GOLD, pa), StrokeWidth=2.2)
                    pe.setStyle(skia.Paint.kStroke_Style)
                    pe.setPathEffect(skia.DashPathEffect.Make([8, 7], t * 20))
                    pulse = 1 + 0.08 * math.sin(t * 6)
                    c.drawCircle(x, y, 34 * pulse, pe)
                    draw_text(c, "?", x, y + 18, 50, "serif_cn_bold", GOLD, a=pa, glow=10, glow_color=GOLD)
                else:
                    p = seg(t, omega_t, omega_t + 1.6)
                    self._tracks(c, x, y, p, a)
                    glow_dot(c, x, y, 16 * ease_out_back(seg(t, omega_t, omega_t + 0.5)), GOLD, a, glow=3.5)
                    draw_text(c, lab, x, y + 72, 40, "math", GOLD, a=a, glow=8, glow_color=GOLD)
                    r = lerp(20, 500, ease_out_cubic(p))
                    c.drawCircle(x, y, r, paint(GOLD, 0.5 * (1 - p) * a, stroke=3, blend="add"))
                continue
            pa = a * smooth(seg(t, 7.6 + row * 0.6 + k * 0.12, 8.0 + row * 0.6 + k * 0.12))
            if pa <= 0:
                continue
            col = ["#ff8fb1", "#8fd3ff", "#b4a0ff"][row % 3]
            glow_dot(c, x, y, 12 * ease_out_back(seg(t, 7.6 + row * 0.6 + k * 0.12, 8.1 + row * 0.6 + k * 0.12)),
                     col, pa)
            draw_text(c, lab, x, y - 30, 34, "math", CREAM, a=pa)
        # masses column
        for row in range(4):
            ma = a * smooth(seg(t, 8.0 + row * 0.6, 8.6 + row * 0.6))
            if row == 3:
                ma = a * smooth(seg(t, 11.4, 12.0))
            x, y = pos(row, 3 - row)
            txt = MASSES[row] if row < 3 else ("≈ 1680 MeV ?" if t < omega_t else "1672 MeV ✓")
            col = CREAM if row < 3 else GOLD
            draw_text(c, txt, 1460, y + 10, 28, "math", col, a=ma * 0.9, align="left")
            if row > 0 and row < 3:
                draw_text(c, ["", "+ 153", "+ 145"][row], 1640, y - dy / 2 + 10, 20, "math", "#9b8fd8", a=ma * 0.7,
                          align="left")
        draw_text(c, "SU(3)", 330, 170, 52, "math", "#c9b8ff", a=a, glow=10, glow_color="#9b7bff")
        draw_text(c, "重子十重态", 330, 222, 26, "serif_cn", CREAM, a=a * 0.85)

    def _tracks(self, c, x, y, p, a):
        """Bubble-chamber style spiral tracks bursting from the new particle."""
        if p <= 0:
            return
        for k in range(7):
            ang0 = hash01(k, 3) * 2 * math.pi
            curl = (0.5 + hash01(k, 4)) * (1 if k % 2 else -1)
            path = skia.Path()
            n = 60
            L = ease_out_cubic(p) * (160 + 220 * hash01(k, 5))
            for i in range(n):
                s = i / (n - 1) * L
                ang = ang0 + curl * s / 120
                r = s * (1 - s / (L * 2.6 + 1))
                px, py = x + r * math.cos(ang), y + r * math.sin(ang)
                (path.moveTo if i == 0 else path.lineTo)(px, py)
            col = [GOLD, CYAN, MAGENTA][k % 3]
            c.drawPath(path, paint(col, 0.7 * a * (1 - 0.6 * p), stroke=1.6, blend="add"))
            c.drawPath(path, paint(col, 0.25 * a * (1 - 0.6 * p), stroke=6, blur=5, blend="add"))

    def _e8(self, c, t):
        a = smooth(seg(t, 16.3, 17.3)) * (1 - smooth(seg(t, 24.4, 25.0)))
        if a <= 0:
            return
        R, edges, petrie, ring = e8()
        B0 = _random_basis()
        s = ease_in_out(seg(t, 17.2, E8_SNAP))
        # slow 8-D drift before the snap
        drift = (1 - s)
        ang = t * 0.5
        rot = np.eye(8)
        for (i, j, w) in ((0, 4, 1.0), (1, 5, 0.7), (2, 6, 0.5), (3, 7, 0.3)):
            cth, sth = math.cos(ang * w * drift), math.sin(ang * w * drift)
            Rm = np.eye(8)
            Rm[i, i] = cth
            Rm[j, j] = cth
            Rm[i, j] = -sth
            Rm[j, i] = sth
            rot = rot @ Rm
        B = _orth((1 - s) * (B0 @ rot) + s * petrie)
        P = R @ B.T
        spin = (t - E8_SNAP) * 0.08
        cs, sn = math.cos(spin), math.sin(spin)
        P = P @ np.array([[cs, -sn], [sn, cs]])
        cx, cy = W / 2, H / 2 - 60
        scale = 300 * lerp(0.75, 1.0, s)
        xs = cx + P[:, 0] * scale
        ys = cy + P[:, 1] * scale
        cols = [hsv(0.52 + 0.065 * r, 0.7, lerp(0.55, 1.0, r / 7)) for r in range(8)]
        # edges batched per ring colour
        ea = a * lerp(0.05, 0.075, s)
        for r in range(8):
            path = skia.Path()
            sel = edges[ring[edges[:, 0]] == r]
            for i, j in sel:
                path.moveTo(xs[i], ys[i])
                path.lineTo(xs[j], ys[j])
            c.drawPath(path, paint(cols[r], ea, stroke=1.1, blend="add"))
        for i in range(len(R)):
            col = cols[ring[i]]
            glow_dot(c, float(xs[i]), float(ys[i]), 3.6, col, a * 0.95, glow=2.6)
        fl = envelope(t, E8_SNAP - 0.05, E8_SNAP + 1.3, 0.05, 1.2)
        if fl > 0:
            c.drawCircle(cx, cy, 480, paint("#ffffff", 0.12 * fl, blur=90, blend="add"))
            r = lerp(100, 1100, ease_out_cubic(seg(t, E8_SNAP, E8_SNAP + 1.3)))
            c.drawCircle(cx, cy, r, paint("#bfe8ff", 0.5 * fl, stroke=3, blend="add"))
        draw_text(c, "E₈", 1640, 470, 90, "math", "#eaf6ff", a=a * smooth(seg(t, E8_SNAP, E8_SNAP + 1.0)), glow=14,
                  glow_color=CYAN)
        draw_text(c, "240 roots · 6720 edges", 1640, 520, 18, "inter_light", CREAM,
                  a=a * 0.7 * smooth(seg(t, E8_SNAP + 0.4, E8_SNAP + 1.4)), tracking=0.15)


def _arrow_head(x, y, ang):
    p = skia.Path()
    p.moveTo(x + 14 * math.cos(ang), y + 14 * math.sin(ang))
    p.lineTo(x + 10 * math.cos(ang + 2.4), y + 10 * math.sin(ang + 2.4))
    p.lineTo(x + 10 * math.cos(ang - 2.4), y + 10 * math.sin(ang - 2.4))
    p.close()
    return p
