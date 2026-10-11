"""Islamic star patterns (Hankin's polygons-in-contact) on the 4.8.8 and 4.6.12 tilings."""
import functools
import math

import numpy as np
import skia

from ..core import (W, H, CREAM, GOLD, c4, caption, draw_text, ease_in_out, ease_out_back, ease_out_cubic,
                    envelope, hexrgb, lerp, mix, paint, seg, smooth)
from ..noise import fbm
from . import Scene


def _poly(cx, cy, n, phi, s):
    R = s / (2 * math.sin(math.pi / n))
    return [(cx + R * math.cos(phi + 2 * math.pi * k / n), cy + R * math.sin(phi + 2 * math.pi * k / n))
            for k in range(n)]


@functools.lru_cache(maxsize=None)
def tiling(kind, s=1.0, extent=16.0):
    """List of tiles (cx, cy, n, phi, type) covering a disc of radius extent (units of side s)."""
    tiles = []
    if kind == "488":
        a = s * (1 + math.sqrt(2))
        m = int(extent / a) + 2
        for i in range(-m, m + 1):
            for j in range(-m, m + 1):
                x, y = i * a, j * a
                if math.hypot(x, y) < extent:
                    tiles.append((x, y, 8, math.pi / 8, 0))
                x2, y2 = x + a / 2, y + a / 2
                if math.hypot(x2, y2) < extent:
                    tiles.append((x2, y2, 4, 0.0, 1))
    elif kind == "4612":
        r12 = s / (2 * math.tan(math.pi / 12))
        r6 = s * math.sqrt(3) / 2
        L = 2 * r12 + s
        m = int(extent / L) + 3
        e1 = np.array([L, 0.0])
        e2 = np.array([L / 2, L * math.sqrt(3) / 2])
        cents = []
        for i in range(-m, m + 1):
            for j in range(-m, m + 1):
                p = i * e1 + j * e2
                cents.append(p)
                if np.hypot(*p) < extent:
                    tiles.append((p[0], p[1], 12, math.radians(-15) + math.radians(15), 0))
        for i in range(-m, m + 1):
            for j in range(-m, m + 1):
                p = i * e1 + j * e2
                for q in (p + e1, p + e2, p + e2 - e1):
                    mid = (p + q) / 2
                    d = math.atan2(q[1] - p[1], q[0] - p[0])
                    if np.hypot(*mid) < extent:
                        tiles.append((mid[0], mid[1], 4, d - math.pi / 4 + math.pi / 4, 2))
                for tri in ((p, p + e1, p + e2), (p, p + e2, p + e2 - e1)):
                    cc = sum(tri) / 3
                    d0 = math.atan2(tri[0][1] - cc[1], tri[0][0] - cc[0])
                    if np.hypot(*cc) < extent:
                        tiles.append((cc[0], cc[1], 6, d0 - math.pi / 6 + math.pi / 6, 1))
        # dedupe squares (each counted once per lattice point already)
    return tiles


def _fix_phi(n, normal_dir):
    """Vertex phase so that one edge normal points along normal_dir."""
    return normal_dir - math.pi / n


def hankin(cx, cy, n, phi, s, theta):
    """Star polygon (list of points) for a regular polygon with contact angle theta."""
    V = _poly(cx, cy, n, phi, s)
    M = [((V[k][0] + V[(k + 1) % n][0]) / 2, (V[k][1] + V[(k + 1) % n][1]) / 2) for k in range(n)]
    out = []
    # the intersection near vertex V[k+1] lies on the ray centre->V[k+1]
    R = s / (2 * math.sin(math.pi / n))
    half_int = math.pi / 2 - math.pi / n  # half of interior angle
    for k in range(n):
        out.append(M[k])
        vx, vy = V[(k + 1) % n]
        # triangle M_k, V_{k+1}, X : angle at V = half_int, angle at M = theta, side MV = s/2
        ang_x = math.pi - half_int - theta
        if ang_x <= 0.02:
            ang_x = 0.02
        d = (s / 2) * math.sin(theta) / math.sin(ang_x)  # distance V -> X
        ux, uy = (cx - vx) / R, (cy - vy) / R
        out.append((vx + ux * d, vy + uy * d))
    return out


PAL = {
    "488": {"bg": "#0b2742", "fill": ["#e9dcbc", "#1b7f7a"], "strap": "#f2c66d"},
    "4612": {"bg": "#0a1f3a", "fill": ["#f0e2c0", "#b5542d", "#1d8a85"], "strap": "#f5cf7a"},
}


@functools.lru_cache(maxsize=2)
def glaze(scale):
    w, h = int(W * scale) // 2, int(H * scale) // 2
    n = fbm(w, h, octaves=6, base=6, seed=11)
    img = np.zeros((h, w, 4), np.uint8)
    v = (n * 255).astype(np.uint8)
    img[..., 0] = v
    img[..., 1] = v
    img[..., 2] = v
    img[..., 3] = 255
    return skia.Image.fromarray(img, colorType=skia.kRGBA_8888_ColorType)


class Alhambra(Scene):
    duration = 18.5
    bloom = 0.45
    bloom_threshold = 0.6
    vignette = 0.75

    def draw(self, f, t):
        c = f.c
        fade = smooth(seg(t, 0.0, 0.8))
        x1 = smooth(seg(t, 10.6, 12.2))  # crossfade to the 12-fold pattern
        if x1 < 1:
            self._pattern(c, t, "488", 1.0, fade)
        if x1 > 0:
            layer = c.saveLayerAlpha(None, int(255 * x1))
            self._pattern(c, t, "4612", 1.0, fade)
            c.restore()
        # glaze texture (multiply) and light sweep
        img = glaze(f.scale)
        p = skia.Paint()
        p.setBlendMode(skia.BlendMode.kSoftLight)
        p.setAlphaf(0.3)
        c.drawImageRect(img, skia.Rect(0, 0, W, H), skia.SamplingOptions(skia.FilterMode.kLinear), p)
        sweep = (t * 0.18) % 1.6 - 0.3
        sx = sweep * W * 1.4
        sh = skia.GradientShader.MakeLinear([skia.Point(sx - 300, 0), skia.Point(sx + 300, H * 0.6)],
                                            [c4("#ffffff", 0).toColor(), c4("#fff3d0", 0.10).toColor(),
                                             c4("#ffffff", 0).toColor()])
        sp = skia.Paint(Shader=sh)
        sp.setBlendMode(skia.BlendMode.kPlus)
        c.drawRect(skia.Rect(0, 0, W, H), sp)

        # caption backdrop
        sh = skia.GradientShader.MakeLinear([skia.Point(0, H - 330), skia.Point(0, H - 150)],
                                            [c4("#000000", 0).toColor(), c4("#03060c", 0.9).toColor()])
        c.drawRect(skia.Rect(0, H - 330, W, H), skia.Paint(Shader=sh))
        caption(c, t, 0.6, 4.9, "格拉纳达 · 阿尔罕布拉宫", "The Alhambra · Granada")
        caption(c, t, 5.1, 9.5, "14 世纪的工匠，用对称铺满了整座宫殿", "Fourteenth-century artisans tiled a palace with symmetry")
        caption(c, t, 9.7, 14.0, "数学家后来证明：平面图案的对称方式，恰好只有 17 种",
                "Mathematicians later proved: there are exactly 17 wallpaper groups")
        caption(c, t, 14.2, 18.5, "传说，这 17 种都能在宫殿的墙上找到", "Legend says all 17 hide on the palace walls", fade=0.6)
        if t > 17.7:
            c.drawRect(skia.Rect(0, 0, W, H), paint("#000000", smooth(seg(t, 17.7, 18.5))))

    # ------------------------------------------------------------------
    def _pattern(self, c, t, kind, alpha, fade):
        pal = PAL[kind]
        c.drawRect(skia.Rect(0, 0, W, H), paint(pal["bg"], fade))
        s = 64 if kind == "488" else 46
        tiles = tiling(kind, 1.0, 26.0 if kind == "488" else 44.0)
        if kind == "488":
            theta = math.radians(lerp(67.5, 40, ease_in_out(seg(t, 6.0, 9.0))))
            theta = math.radians(lerp(math.degrees(theta), 72, ease_in_out(seg(t, 9.0, 11.5))))
            rot = math.radians(4 * t)
            zoom = lerp(1.25, 0.95, ease_in_out(seg(t, 0, 11)))
            reveal_t0, reveal_speed = 0.3, 0.85
        else:
            theta = math.radians(lerp(58, 72, 0.5 + 0.5 * math.sin((t - 11) * 0.8)))
            rot = math.radians(4 * t + 10)
            zoom = lerp(1.15, 0.7, ease_in_out(seg(t, 10.6, 18.5)))
            reveal_t0, reveal_speed = -100, 1
        c.save()
        c.translate(W / 2, H / 2 - 30)
        c.rotate(math.degrees(rot))
        c.scale(zoom, zoom)
        strap = pal["strap"]
        # order tiles by distance for the radial reveal
        for (x, y, n, phi, typ) in tiles:
            X, Y = x * s, y * s
            dist = math.hypot(X, Y)
            if dist * zoom > 1300:
                continue
            p = seg(t, reveal_t0 + dist / 260.0 * reveal_speed, reveal_t0 + dist / 260.0 * reveal_speed + 0.6)
            if p <= 0:
                continue
            e = ease_out_back(p)
            star = hankin(X, Y, n, phi, s, theta)
            path = skia.Path()
            for i, (px, py) in enumerate(star):
                qx, qy = X + (px - X) * e, Y + (py - Y) * e
                (path.moveTo if i == 0 else path.lineTo)(qx, qy)
            path.close()
            fills = pal["fill"]
            col = fills[typ % len(fills)]
            a = smooth(p) * fade
            c.drawPath(path, paint(col, a))
            # inner rosette ring
            if n >= 8:
                c.drawCircle(X, Y, s * (0.32 if n == 8 else 0.55) * e, paint(pal["bg"], 0.85 * a))
                c.drawCircle(X, Y, s * (0.18 if n == 8 else 0.35) * e, paint(strap, 0.9 * a))
            # strapwork: dark outline + gold band
            c.drawPath(path, paint("#071425", 0.9 * a, stroke=s * 0.20))
            c.drawPath(path, paint(strap, a, stroke=s * 0.10))
            c.drawPath(path, paint("#fff4d6", 0.5 * a, stroke=s * 0.025))
            # pop flash
            if p < 1:
                c.drawCircle(X, Y, s * 0.9, paint(GOLD, 0.35 * (1 - p) * fade, blur=s * 0.5, blend="add"))
        # mirror lines of p4m during the first reveal
        g = envelope(t, 1.0, 5.0, 0.6, 1.0) * (kind == "488")
        if g > 0:
            for k in range(4):
                ang = math.radians(45 * k)
                L = 1500
                pe = skia.Paint(AntiAlias=True, Color4f=c4("#fff0c0", 0.7 * g))
                pe.setStyle(skia.Paint.kStroke_Style)
                pe.setStrokeWidth(2.0 / zoom)
                pe.setPathEffect(skia.DashPathEffect.Make([18, 12], -t * 60))
                pe.setBlendMode(skia.BlendMode.kPlus)
                c.drawLine(-L * math.cos(ang), -L * math.sin(ang), L * math.cos(ang), L * math.sin(ang), pe)
        c.restore()
