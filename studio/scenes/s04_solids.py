"""The five Platonic solids, their rotation groups, and the crystal lattice."""
import functools
import math

import numpy as np
import skia
from scipy.optimize import linear_sum_assignment

from ..core import (W, H, CREAM, GOLD, c4, caption, clamp, draw_text, ease_in_out, ease_out_cubic, envelope,
                    glow_dot, hash01, hexrgb, lerp, mix, paint, seg, smooth)
from ..geom3d import PHI, edge_points, project, rot_axis, rot_euler, solid
from . import Scene

NPTS = 720
SOLIDS = [
    # name, cn, faces, group, order, colour, show_t0, show_t1
    ("tetra", "正四面体", "4 个面", "A₄", 12, "#ff8a4c", 0.6, 2.7),
    ("cube", "正六面体", "6 个面", "S₄", 24, "#4fd4ff", 3.4, 5.4),
    ("octa", "正八面体", "8 个面", "S₄", 24, "#59f0b0", 6.1, 8.1),
    ("dodeca", "正十二面体", "12 个面", "A₅", 60, "#b38cff", 8.8, 10.8),
    ("icosa", "正二十面体", "20 个面", "A₅", 60, "#ffd36e", 11.5, 15.6),
]
MORPH = 0.7
CRYSTAL_T = 15.6


@functools.lru_cache(maxsize=None)
def _targets():
    """Point clouds for each stage, matched so consecutive stages pair up nicely."""
    rng = np.random.default_rng(3)
    start = rng.normal(size=(NPTS, 3))
    start = start / np.linalg.norm(start, axis=1)[:, None] * (3.5 + 2 * rng.random((NPTS, 1)))
    clouds = [start]
    for name, *_ in SOLIDS:
        pts = edge_points(name, NPTS)
        prev = clouds[-1]
        cost = np.linalg.norm(prev[:, None] - pts[None], axis=2)
        r, cidx = linear_sum_assignment(cost)
        clouds.append(pts[cidx])
    lat = _lattice()[0]
    sel = rng.choice(len(lat), NPTS, replace=len(lat) < NPTS)
    tgt = lat[sel]
    cost = np.linalg.norm(clouds[-1][:, None] - tgt[None] / 1.0, axis=2)
    r, cidx = linear_sum_assignment(cost)
    clouds.append(tgt[cidx])
    return clouds


@functools.lru_cache(maxsize=None)
def _lattice(n=2):
    """Diamond-cubic lattice: atoms and bonds, centred, unit cell size 1."""
    fcc = np.array([(0, 0, 0), (0, .5, .5), (.5, 0, .5), (.5, .5, 0)])
    basis = np.concatenate([fcc, fcc + 0.25])
    pts = []
    for i in range(-n, n):
        for j in range(-n, n):
            for k in range(-n, n):
                pts.append(basis + (i, j, k))
    pts = np.concatenate(pts)
    pts = pts[np.all(np.abs(pts + 0.125) <= n - 0.1, axis=1)]
    pts = pts - pts.mean(axis=0)
    d = np.linalg.norm(pts[:, None] - pts[None], axis=2)
    bl = math.sqrt(3) / 4
    ii, jj = np.where(np.abs(d - bl) < 1e-3)
    bonds = [(i, j) for i, j in zip(ii, jj) if i < j]
    return pts, np.array(bonds)


class Solids(Scene):
    duration = 21.0
    bloom = 0.75
    bloom_threshold = 0.42
    vignette = 0.65

    def stage(self, t):
        """Return (index, morph progress) where index refers to SOLIDS (or -1 start / 5 crystal)."""
        for i, s in enumerate(SOLIDS):
            if t < s[6]:
                return i - 1, i, ease_in_out(seg(t, s[6] - MORPH, s[6]))
            if t < s[7] or i == len(SOLIDS) - 1 and t < CRYSTAL_T:
                return i, i, 1.0
        return len(SOLIDS) - 1, len(SOLIDS), ease_in_out(seg(t, CRYSTAL_T, CRYSTAL_T + 1.6))

    def draw(self, f, t):
        c = f.c
        bg = skia.GradientShader.MakeRadial(skia.Point(W / 2, H / 2 - 40), 1200,
                                            [c4("#0c1022").toColor(), c4("#020309").toColor()])
        c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=bg))
        fade = smooth(seg(t, 0.0, 0.6)) * (1 - smooth(seg(t, 20.3, 21.0)))
        clouds = _targets()
        a_idx, b_idx, p = self.stage(t)
        cx, cy = W / 2 - 60, H / 2 - 50
        scale = 300

        # global orientation (slow tumble); pause + 72° snap on the icosahedron
        R = rot_euler(0.45 + 0.2 * math.sin(t * 0.3), t * 0.55, 0.1)
        ico_axis = solid("icosa")[0][0]
        snap = ease_in_out(seg(t, 13.4, 14.4))
        if t > 12.6:
            # freeze tumble at 12.6 and spin about a 5-fold axis by 72 deg
            R = rot_euler(0.45 + 0.2 * math.sin(12.6 * 0.3), 12.6 * 0.55, 0.1) @ rot_axis(ico_axis, 2 * math.pi / 5 * snap)
            if t > 14.9:
                R = rot_euler(0.45 + 0.2 * math.sin((t - 2.3) * 0.3), (t - 2.3) * 0.55, 0.1)
                R = R @ rot_axis(ico_axis, 2 * math.pi / 5)

        cryst = b_idx == len(SOLIDS)
        if cryst:
            lat, bonds = _lattice()
            zoom = lerp(1.0, 0.62, ease_in_out(seg(t, CRYSTAL_T, 21)))
            scale = lerp(300, 300 / 1.6 * 1.25 * zoom * 1.6, p) if p < 1 else 300 / 1.6 * 1.25 * zoom * 1.6
            Rc = rot_euler(0.5, 0.6 + (t - CRYSTAL_T) * 0.35, 0.15)
            R = Rc if p >= 1 else R

        # interpolate the particle cloud
        A = clouds[a_idx + 1]
        B = clouds[b_idx + 1]
        if cryst:
            B = B * 0.42  # lattice spans ~6 units; bring into scale
        bulge = math.sin(math.pi * p) * 0.35
        P = A * (1 - p) + B * p
        P = P * (1 + bulge)
        PR = P @ R.T
        xy, z, k = project(PR, cx, cy, scale)

        col_a = hexrgb(SOLIDS[a_idx][5]) if a_idx >= 0 else hexrgb("#ffffff")
        col_b = hexrgb(SOLIDS[b_idx][5]) if b_idx < len(SOLIDS) else hexrgb("#9fe7ff")
        col = mix(col_a, col_b, p)

        settled = (p >= 1 or (a_idx == b_idx))
        if not cryst:
            name = SOLIDS[b_idx][0]
            edge_a = smooth(seg(t, SOLIDS[b_idx][6], SOLIDS[b_idx][6] + 0.4)) if b_idx >= 0 else 0
            # dissolve edges just before the next morph
            nxt = SOLIDS[b_idx + 1][6] - MORPH if b_idx + 1 < len(SOLIDS) else CRYSTAL_T
            edge_a *= 1 - smooth(seg(t, nxt - 0.25, nxt))
            if edge_a > 0:
                self._solid(c, name, R, cx, cy, scale, col, edge_a * fade)
            # particles
            pa = (1 - edge_a * 0.8) * fade
        else:
            pa = fade
        if pa > 0.01:
            for i in range(len(xy)):
                r = 2.2 * k[i]
                a = pa * (0.45 + 0.55 * clamp((z[i] + 1.5) / 3)) * (0.6 + 0.4 * hash01(i, 5))
                c.drawCircle(float(xy[i, 0]), float(xy[i, 1]), r * 2.2, paint(col, 0.25 * a, blur=r * 1.5, blend="add"))
                c.drawCircle(float(xy[i, 0]), float(xy[i, 1]), r * 0.8, paint(mix(col, "#ffffff", 0.6), a, blend="add"))

        if cryst:
            self._crystal(c, t, R, cx, cy, scale, p, fade)

        if b_idx < len(SOLIDS) and b_idx >= 0:
            self._axes(c, t, R, cx, cy, scale, fade)
            self._label(c, t, fade)

        caption(c, t, 0.5, 5.3, "为什么完美的正多面体，只有这五种？", "Why are there only five perfect solids?")
        caption(c, t, 5.5, 10.6, "答案藏在它们的「旋转对称群」里", "The answer is hidden in their rotation groups")
        caption(c, t, 10.8, 15.4, "正二十面体：60 种旋转，每一种都让它与自身重合",
                "Icosahedron: 60 rotations, each maps it onto itself")
        caption(c, t, 15.8, 21.0, "从食盐到钻石，所有晶体只有 230 种空间群", "From salt to diamond: just 230 space groups",
                fade=0.6)

    # ------------------------------------------------------------------
    def _solid(self, c, name, R, cx, cy, scale, col, a):
        v, edges, faces = solid(name)
        VR = v @ R.T
        xy, z, k = project(VR, cx, cy, scale)
        # faces back-to-front: glassy fill
        light = np.array([-0.4, 0.6, 0.7])
        light /= np.linalg.norm(light)
        order = sorted(range(len(faces)), key=lambda i: VR[faces[i]].mean(axis=0)[2])
        for fi in order:
            idx = faces[fi]
            n = np.cross(VR[idx[1]] - VR[idx[0]], VR[idx[2]] - VR[idx[0]])
            n /= np.linalg.norm(n)
            if np.dot(n, VR[idx].mean(axis=0)) < 0:
                n = -n
            facing = n[2]
            path = skia.Path()
            path.moveTo(*xy[idx[0]])
            for i in idx[1:]:
                path.lineTo(*xy[i])
            path.close()
            lam = max(0.0, float(np.dot(n, light)))
            fa = (0.05 + 0.16 * lam + 0.05 * (facing > 0)) * a
            c.drawPath(path, paint(mix(col, "#ffffff", 0.2 * lam), fa, blend="add"))
        # edges: back edges dim, front bright
        for i, j in edges:
            depth = (VR[i, 2] + VR[j, 2]) / 2
            front = clamp((depth + 0.6) / 1.2)
            ea = a * (0.25 + 0.75 * front)
            p0, p1 = xy[i], xy[j]
            c.drawLine(*p0, *p1, paint(col, 0.5 * ea, stroke=7, blur=6, blend="add"))
            c.drawLine(*p0, *p1, paint(mix(col, "#ffffff", 0.55), ea, stroke=2.2, blend="add"))
        for i in range(len(v)):
            front = clamp((VR[i, 2] + 0.6) / 1.2)
            glow_dot(c, float(xy[i, 0]), float(xy[i, 1]), 4.5 * k[i], col, a * (0.3 + 0.7 * front))

    def _axes(self, c, t, R, cx, cy, scale, fade):
        g = envelope(t, 12.0, 15.2, 0.6, 0.5) * fade
        if g <= 0:
            return
        v = solid("icosa")[0]
        seen = []
        for i in range(len(v)):
            d = v[i]
            if any(np.allclose(d, -s) for s in seen):
                continue
            seen.append(d)
            main = i == 0
            P = np.array([d * 1.75, -d * 1.75]) @ R.T
            xy, z, k = project(P, cx, cy, scale)
            col = "#fff2c4" if main else GOLD
            aa = g * (1.0 if main else 0.45)
            sh = skia.GradientShader.MakeLinear([skia.Point(*xy[0]), skia.Point(*xy[1])],
                                                [c4(col, 0).toColor(), c4(col, aa).toColor(),
                                                 c4(col, aa).toColor(), c4(col, 0).toColor()],
                                                [0.0, 0.3, 0.7, 1.0])
            p = skia.Paint(Shader=sh, AntiAlias=True, StrokeWidth=3.0 if main else 1.6)
            p.setStyle(skia.Paint.kStroke_Style)
            p.setBlendMode(skia.BlendMode.kPlus)
            c.drawLine(*xy[0], *xy[1], p)
            if main:
                p2 = skia.Paint(Shader=sh, AntiAlias=True, StrokeWidth=14)
                p2.setStyle(skia.Paint.kStroke_Style)
                p2.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 8))
                p2.setBlendMode(skia.BlendMode.kPlus)
                c.drawLine(*xy[0], *xy[1], p2)
                # 72 degree arc indicator near the tip
                snap = seg(t, 13.4, 14.4)
                if 0 < snap < 1.0 or 14.4 <= t < 15.0:
                    r = 60
                    path = skia.Path()
                    path.addArc(skia.Rect(xy[0, 0] - r, xy[0, 1] - r * 0.45, xy[0, 0] + r, xy[0, 1] + r * 0.45),
                                -90, 72 * ease_in_out(snap))
                    c.drawPath(path, paint(GOLD, g, stroke=3, blend="add"))
                    draw_text(c, "72°", xy[0, 0] + 80, xy[0, 1] - 20, 34, "math", GOLD, a=g)

    def _label(self, c, t, fade):
        for name, cn, faces, grp, order, col, t0, t1 in SOLIDS:
            end = t1 if name != "icosa" else CRYSTAL_T
            a = envelope(t, t0 - 0.1, end + 0.2, 0.4, 0.35) * fade
            if a <= 0:
                continue
            x = 1530
            p = ease_out_cubic(seg(t, t0 - 0.1, t0 + 0.5))
            dx = (1 - p) * 40
            draw_text(c, cn, x + dx, 400, 50, "serif_cn_semibold", CREAM, a=a, align="left", tracking=0.1)
            draw_text(c, faces, x + dx, 450, 24, "sans_cn_light", mix(CREAM, "#000000", 0.25), a=a, align="left",
                      tracking=0.1)
            c.drawLine(x + dx, 482, x + dx + 220, 482, paint(col, 0.6 * a, stroke=1.5))
            draw_text(c, grp, x + dx, 560, 64, "math", col, a=a, align="left", glow=10, glow_color=col)
            draw_text(c, f"|G| = {order}", x + dx + 110, 556, 34, "math", CREAM, a=a * 0.9, align="left")

    def _crystal(self, c, t, R, cx, cy, scale, p, fade):
        b = smooth(seg(t, CRYSTAL_T + 1.0, CRYSTAL_T + 2.4)) * fade
        if b <= 0:
            return
        lat, bonds = _lattice()
        P = lat * 0.42 @ R.T
        xy, z, k = project(P, cx, cy, scale)
        zmin, zmax = z.min(), z.max()
        fr_all = (z - zmin) / (zmax - zmin + 1e-6)
        # painter's algorithm: bonds and atoms sorted together by depth
        items = [((z[i] + z[j]) / 2 - 1e-3, 0, i, j) for i, j in bonds] + [(z[i], 1, i, -1) for i in range(len(lat))]
        items.sort()
        for depth, kind, i, j in items:
            if kind == 0:
                fr = (depth - zmin) / (zmax - zmin + 1e-6)
                col = mix("#14224a", "#9fd8ff", fr)
                c.drawLine(*xy[i], *xy[j], paint(col, b * (0.35 + 0.65 * fr), stroke=(2.0 + 3.0 * fr) * k[i]))
            else:
                fr = fr_all[i]
                r = (5 + 6 * fr) * k[i]
                x, y = float(xy[i, 0]), float(xy[i, 1])
                base = mix("#1a2a66", "#7fd0ff", fr)
                hi = mix("#3b5bbf", "#ffffff", fr)
                sh = skia.GradientShader.MakeRadial(skia.Point(x - r * 0.35, y - r * 0.35), r * 1.3,
                                                    [c4(hi, b).toColor(), c4(base, b).toColor(),
                                                     c4(mix(base, "#000000", 0.6), b).toColor()], [0.0, 0.55, 1.0])
                c.drawCircle(x, y, r, skia.Paint(Shader=sh, AntiAlias=True))
        # a soft cool glow around the whole crystal
        c.drawCircle(cx, cy, scale * 1.2, paint("#3a7bff", 0.06 * b, blur=120, blend="add"))
