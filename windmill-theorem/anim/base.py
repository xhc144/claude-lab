"""Narration-driven scene base class and reusable visual pieces."""
import json
import textwrap
from contextlib import contextmanager
from pathlib import Path

import numpy as np
from manim import (
    DOWN, LEFT, ORIGIN, PI, RIGHT, UL, UP, DR,
    AnimationGroup, Create, FadeIn, FadeOut, GrowFromCenter, ImageMobject,
    Line, MathTex, Polygon, Rectangle, Rotate, RoundedRectangle, Scene,
    SurroundingRectangle, Text, VGroup, VMobject, Write, config, rate_functions,
)

from config import (BG, BUILD, CHAPTER_KEYS, CUES_DIR, FAINT, FONT_EN, FONT_UI,
                    FONT_ZH, GOLD, INK, LANG, MUTED, PANEL, TEAL, TIMING_SOURCE,
                    VIOLET, line_duration, sentence_offsets)
import geometry as G

ease = rate_functions.ease_in_out_sine
ease_out = rate_functions.ease_out_cubic


COL_X = 0.35   # left edge of the right-hand text column


def col(m, y, x=COL_X):
    """Place m with its left edge at x and its centre at height y."""
    m.move_to(np.array([x + m.width / 2, y, 0]))
    return m


def below(m, ref, buff=0.35):
    m.next_to(ref, DOWN, buff)
    m.align_to(ref, LEFT)
    return m


# ------------------------------------------------------------------ text
def _has_cjk(s):
    return any("　" <= ch <= "鿿" or "＀" <= ch <= "￯" for ch in s)


def tx(s, size=34, color=INK, weight="NORMAL", font=None, **kw):
    """Text with a font chosen by content (CJK -> Noto Sans CJK, else Inter)."""
    if font is None:
        font = FONT_ZH if _has_cjk(s) else FONT_EN
    return Text(s, font=font, font_size=size, color=color, weight=weight, **kw)


def mtx(*tex, size=40, color=INK, **kw):
    m = MathTex(*tex, font_size=size, **kw)
    m.set_color(color)
    return m


def wrap(s, width):
    """Wrap a paragraph; CJK text is wrapped by characters."""
    if _has_cjk(s):
        return "\n".join(s[i:i + width] for i in range(0, len(s), width))
    return "\n".join(textwrap.wrap(s, width))


def fit(s, size=30, max_w=6.4, color=INK, **kw):
    """Text wrapped (by words, or by characters for CJK) to fit max_w units."""
    t = tx(s, size=size, color=color, **kw)
    if t.width <= max_w:
        return t
    n = len(s)
    for width in range(n - 1, 4, -1):
        t = tx(wrap(s, width), size=size, color=color, line_spacing=0.9, **kw)
        if t.width <= max_w:
            return t
    return t.scale_to_fit_width(max_w)


def chip(label, color=TEAL, size=26, pad=0.18, fill=0.14):
    t = tx(label, size=size, color=color)
    box = RoundedRectangle(corner_radius=0.16, width=t.width + 2 * pad, height=t.height + 1.6 * pad,
                           stroke_color=color, stroke_width=2, fill_color=color, fill_opacity=fill)
    box.move_to(t)
    return VGroup(box, t)


def card(width, height, color=FAINT, fill=PANEL, opacity=0.92, radius=0.22, stroke=1.6):
    return RoundedRectangle(corner_radius=radius, width=width, height=height, stroke_color=color,
                            stroke_width=stroke, fill_color=fill, fill_opacity=opacity)


# --------------------------------------------------------------- windmills
def _rect(r, unit):
    u0, v0, u1, v1 = r
    rect = Rectangle(width=(u1 - u0) * unit, height=(v1 - v0) * unit)
    rect.move_to(np.array([(u0 + u1) / 2 * unit, (v0 + v1) / 2 * unit, 0]))
    return rect


def _segs(segs, unit, color, width, opacity=1.0):
    g = VGroup()
    for (a, b) in segs:
        g.add(Line(np.array([a[0] * unit, a[1] * unit, 0]), np.array([b[0] * unit, b[1] * unit, 0]),
                   stroke_color=color, stroke_width=width, stroke_opacity=opacity))
    return g


class Windmill(VGroup):
    """A windmill for (x, y, z).  Sub-mobjects:

    square, blades (4), grid (faint cell lines), outline.
    Coordinates: centre at ORIGIN before any move; ``unit`` = cell size.
    """

    def __init__(self, x, y, z, unit=0.3, hand=1, sq_color=GOLD, bl_color=TEAL,
                 fill=0.88, grid=True, outline=True, stroke=None, **kw):
        super().__init__(**kw)
        self.t, self.unit, self.hand = (x, y, z), unit, hand
        sq, bl = G.pieces(x, y, z, hand)
        sw = stroke if stroke is not None else max(1.2, min(3.0, unit * 7))
        self.square = _rect(sq, unit).set_fill(sq_color, fill).set_stroke(BG, sw)
        self.blades = VGroup(*[_rect(r, unit).set_fill(bl_color, fill).set_stroke(BG, sw) for r in bl])
        cells = G.windmill_cells(x, y, z, hand)
        self.cells = cells
        self.grid = _segs(G.grid_segments(cells, x), unit, BG, max(0.6, sw * 0.45), 0.55)
        poly = G.outline(cells, x)
        self.poly = poly
        self.outline = Polygon(*[np.array([u * unit, v * unit, 0]) for u, v in poly],
                               stroke_color=INK, stroke_width=sw * 1.1, fill_opacity=0)
        self.add(self.square, self.blades)
        if grid:
            self.add(self.grid)
        if outline:
            self.add(self.outline)

    def attach_grid(self):
        """Add the cell grid (built at the origin) at the windmill's current position and scale."""
        s = self.scale_factor()
        self.grid.scale(s).move_to(self.square.get_center())
        self.add(self.grid)
        return self.grid

    # helpers that map windmill coordinates to scene points (after moves/scales)
    def point(self, u, v):
        c = self.square.get_center()
        s = self.square.width / (self.t[0] * self.unit) if self.t[0] else 1
        return c + np.array([u * self.unit * s, v * self.unit * s, 0])

    def scale_factor(self):
        return self.square.width / (self.t[0] * self.unit)

    def cuts(self, color=INK, width=4, opacity=1.0):
        x, y, z = self.t
        sq, bl = G.pieces(x, y, z, self.hand)
        segs = G.interior_segments([sq] + bl, self.cells, x)
        s = self.scale_factor()
        g = _segs(segs, self.unit * s, color, width, opacity)
        g.shift(self.square.get_center())
        return g

    def flip_blades(self, run_time=1.6):
        """Animations flipping each blade over its corner diagonal: (x,y,z) -> (x,z,y)."""
        anims = []
        x = self.t[0]
        for k, blade in enumerate(self.blades):
            (cu, cv), (du, dv) = G.blade_anchor_axis(x, k, self.hand)
            anims.append(Rotate(blade, angle=PI, axis=np.array([du, dv, 0.0]),
                                about_point=self.point(cu, cv), run_time=run_time, rate_func=ease))
        return anims


def windmill_icon(t, size=1.3, hand=1, **kw):
    """A windmill scaled to fit in a box of the given size."""
    ext = G.extent(*t)
    unit = size / (2 * ext)
    return Windmill(*t, unit=unit, hand=hand, grid=False, **kw)


def triple_tex(t, size=30, color=INK):
    return mtx(r"(%d,\,%d,\,%d)" % t, size=size, color=color)


# ------------------------------------------------------------- base scene
class NarratedScene(Scene):
    chapter = None   # e.g. "S03_Necessity"
    number = None

    def setup(self):
        self.camera.background_color = BG
        bg = BUILD / "bg.png"
        if bg.exists():
            img = ImageMobject(str(bg))
            img.height = config.frame_height
            if img.width < config.frame_width:
                img.width = config.frame_width
            self.add(img)
        self.cues = []
        self.tag = None

    # -- narration -------------------------------------------------------
    @contextmanager
    def say(self, key, pad=0.35):
        d = line_duration(key)
        t0 = self.renderer.time
        self.cues.append({"id": key, "t": round(t0, 4), "dur": round(d, 4)})
        self._line = (key, t0, d)
        yield d
        rem = d + pad - (self.renderer.time - t0)
        if rem > 1e-3:
            self.wait(rem)

    def at(self, k, lead=0.0):
        """Wait until sentence k of the current line starts (minus `lead` seconds)."""
        key, t0, _ = self._line
        target = t0 + self.sent_at(key, k) - lead
        now = self.renderer.time
        if target - now > 1e-3:
            self.wait(target - now)

    def at_frac(self, f):
        """Wait until fraction f of the current line has elapsed."""
        key, t0, d = self._line
        target = t0 + f * d
        now = self.renderer.time
        if target - now > 1e-3:
            self.wait(target - now)

    def sent_at(self, key, k):
        """Seconds from the start of line `key` to the start of its k-th sentence."""
        offs = sentence_offsets(key)
        return offs[min(k, len(offs) - 1)]

    def tear_down(self):
        CUES_DIR.mkdir(parents=True, exist_ok=True)
        out = {"scene": type(self).__name__, "lang": LANG, "timing": TIMING_SOURCE,
               "duration": round(self.renderer.time, 4), "cues": self.cues}
        (CUES_DIR / f"{type(self).__name__}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1),
                                                             encoding="utf-8")

    # -- chapter card ----------------------------------------------------
    def chapter_intro(self, hold=0.6):
        zh, en = CHAPTER_KEYS[type(self).__name__]
        num = f"{self.number:02d}"
        title = zh if LANG == "zh" else en
        big_num = tx(num, size=110, color=GOLD, weight="BOLD", font=FONT_EN)
        big_title = tx(title, size=64, color=INK, weight="BOLD")
        sub = tx(en if LANG == "zh" else zh, size=28, color=MUTED)
        grp = VGroup(big_num, big_title, sub).arrange(DOWN, buff=0.28).move_to(UP * 0.4)
        bar = Line(LEFT * 1.6, RIGHT * 1.6, stroke_color=GOLD, stroke_width=4).next_to(big_title, DOWN, 0.2)
        sub.next_to(bar, DOWN, 0.25)
        self.play(FadeIn(big_num, shift=UP * 0.3), FadeIn(big_title, shift=UP * 0.2),
                  Create(bar), run_time=0.9, rate_func=ease_out)
        self.play(FadeIn(sub), run_time=0.4)
        self.wait(hold)
        tag_num = tx(num, size=22, color=GOLD, weight="BOLD", font=FONT_EN)
        tag_title = tx(title, size=22, color=MUTED)
        tag = VGroup(tag_num, tag_title).arrange(RIGHT, buff=0.18)
        tag.to_corner(UL, buff=0.38)
        self.play(FadeOut(sub), FadeOut(bar),
                  big_num.animate.become(tag_num), big_title.animate.become(tag_title),
                  run_time=0.8, rate_func=ease)
        self.remove(big_num, big_title)
        self.add(tag)
        self.tag = tag

    def clear_stage(self, run_time=0.6, keep=()):
        mobs = [m for m in self.mobjects
                if m is not self.tag and not isinstance(m, ImageMobject) and m not in keep]
        if mobs:
            self.play(*[FadeOut(m) for m in mobs], run_time=run_time)
