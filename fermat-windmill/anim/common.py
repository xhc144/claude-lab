"""Shared look, timing and geometry for every scene.

Render one scene:   FW_LANG=zh manim -qh anim/scenes_a.py S01_Hook
Language:           FW_LANG = zh | en   (texts on screen + narration timing)

Every scene is driven by the narration timing in audio/<lang>/timing.json:
`with self.seg("hook_2"):` starts a narration segment; `self.at(k)` waits until
sentence k (0-based) of that segment begins. The scene writes its real segment
start times to render/<lang>/timeline/<Scene>.json, which the assembler uses to
place audio and subtitles, so animations may run longer than the voice without
ever drifting out of sync.
"""
from __future__ import annotations

import json
import os
from contextlib import contextmanager
from pathlib import Path

import numpy as np
from manim import *  # noqa: F401,F403
from shapely.geometry import Polygon as SPoly
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
LANG = os.environ.get("FW_LANG", "zh")
ZH = LANG == "zh"

# ------------------------------------------------------------------ palette
BG = "#0D1117"
PANEL = "#161B26"
PANEL2 = "#1D2433"
GRID = "#283044"
TEXT = "#E9ECF2"
MUTED = "#8C94A8"
DIM = "#4A5368"
SQ = "#F4C152"        # central square
ARM = "#36B5AE"       # blades
FLIP = "#5AA9F8"      # the swap / flip involution
RECUT = "#FF7A59"     # Zagier's re-cutting involution
GOOD = "#8EE28E"
BAD = "#FF5C6C"
VIOLET = "#A08CFF"
NEUTRAL = "#3B4458"

config.background_color = BG
config.frame_rate = int(os.environ.get("FW_FPS", "30"))

CJK_FONT = "Noto Sans CJK SC"
LAT_FONT = "Inter"
SUB_Y = -2.72         # keep content above this line: subtitles live below it
FS = 1.18             # global type scale (sizes in the scene code are pre-scale)


def L(zh: str, en: str):
    return zh if ZH else en


def _has_cjk(s: str) -> bool:
    return any("⺀" <= ch <= "鿿" or "＀" <= ch <= "￯" for ch in s)


def T(s: str, size: float = 34, color=TEXT, weight=NORMAL, font=None, **kw) -> Text:
    """Text in the right font for its script."""
    f = font or (CJK_FONT if _has_cjk(s) else LAT_FONT)
    return Text(s, font=f, font_size=size * FS, color=color, weight=weight, **kw)


def TL(zh: str, en: str, size: float = 34, **kw) -> Text:
    return T(L(zh, en), size, **kw)


def M(*args, font_size=None, color=None, **kw) -> MathTex:
    """MathTex shorthand: M(tex[, tex2, ...][, size][, color]). Colours are '#rrggbb' strings."""
    tex, nums = [], []
    for a in args:
        if isinstance(a, str) and a.startswith("#"):
            color = a
        elif isinstance(a, str):
            tex.append(a)
        else:
            nums.append(a)
    return MathTex(*tex, font_size=(font_size or (nums[0] if nums else 44)) * FS, color=color or TEXT, **kw)


def Para(lines, size=30, color=TEXT, buff=0.18, align=LEFT, **kw) -> VGroup:
    g = VGroup(*[T(s, size, color, **kw) for s in lines])
    return g.arrange(DOWN, aligned_edge=align, buff=buff)


def card(mob: Mobject, pad=0.35, color=PANEL, stroke=GRID, radius=0.18, opacity=0.92) -> VGroup:
    r = RoundedRectangle(corner_radius=radius, width=mob.width + 2 * pad, height=mob.height + 2 * pad,
                         fill_color=color, fill_opacity=opacity, stroke_color=stroke, stroke_width=1.5)
    r.move_to(mob)
    return VGroup(r, mob)


def tag(s: str, color=SQ, size=24) -> VGroup:
    t = T(s, size, BG, weight=BOLD)
    r = RoundedRectangle(corner_radius=0.12, width=t.width + 0.34, height=t.height + 0.2,
                         fill_color=color, fill_opacity=1, stroke_width=0).move_to(t)
    return VGroup(r, t)


def check_mark(color=GOOD, scale=0.35) -> VMobject:
    m = VMobject(stroke_color=color, stroke_width=8)
    m.set_points_as_corners([LEFT * 0.5 + UP * 0.05, DOWN * 0.4 + LEFT * 0.1, UP * 0.55 + RIGHT * 0.6])
    return m.scale(scale)


def cross_mark(color=BAD, scale=0.3) -> VGroup:
    return VGroup(Line(UL, DR, stroke_width=8, color=color),
                  Line(UR, DL, stroke_width=8, color=color)).scale(scale)


# ------------------------------------------------------------------ timing
def _load_timing():
    fn = ROOT / "audio" / LANG / "timing.json"
    if fn.exists():
        return json.loads(fn.read_text(encoding="utf-8"))
    return {}


TIMING = _load_timing()


class FScene(Scene):
    """Scene base: chapter header, narration-synchronised segments."""

    chapter = ""

    def setup(self):
        self.timeline = []
        self._seg = None
        self._seg_t0 = 0.0
        self.header = None

    # ---- time helpers
    @property
    def now(self) -> float:
        return self.renderer.time

    def wait_until(self, t: float):
        dt = t - self.now
        if dt > 1.0 / config.frame_rate:
            self.wait(dt)

    def hold(self, dt: float):
        if dt > 1.0 / config.frame_rate:
            self.wait(dt)

    def seg_dur(self, sid=None) -> float:
        sid = sid or self._seg
        return TIMING.get(sid, {}).get("dur", 4.0)

    def sent_start(self, k: int, sid=None) -> float:
        sid = sid or self._seg
        ss = TIMING.get(sid, {}).get("sentences", [])
        if not ss:
            return self.seg_dur(sid) * k / 6
        k = max(0, min(k, len(ss) - 1))
        return ss[k]["start"]

    def nsent(self, sid=None) -> int:
        sid = sid or self._seg
        return len(TIMING.get(sid, {}).get("sentences", [])) or 1

    def at(self, k: int, offset: float = 0.0):
        """Wait until sentence k of the current segment starts (+offset)."""
        self.wait_until(self._seg_t0 + self.sent_start(k) + offset)

    def at_frac(self, f: float):
        self.wait_until(self._seg_t0 + self.seg_dur() * f)

    def left(self) -> float:
        """Seconds of narration left in the current segment."""
        return max(0.0, self._seg_t0 + self.seg_dur() - self.now)

    @contextmanager
    def seg(self, sid: str, tail: float = 0.35):
        if sid not in TIMING and TIMING:
            raise KeyError(f"no narration for segment {sid} in {LANG}")
        self._seg, self._seg_t0 = sid, self.now
        self.timeline.append({"seg": sid, "start": round(self.now, 3), "dur": self.seg_dur(sid)})
        yield self
        self.wait_until(self._seg_t0 + self.seg_dur(sid) + tail)
        self._seg = None

    def tear_down(self):
        out = ROOT / "render" / LANG / "timeline"
        out.mkdir(parents=True, exist_ok=True)
        (out / f"{type(self).__name__}.json").write_text(
            json.dumps({"scene": type(self).__name__, "duration": round(self.now, 3),
                        "segments": self.timeline}, indent=1), encoding="utf-8")

    # ---- chapter card
    def chapter_card(self, num: int, zh: str, en: str):
        n = T(f"{num:02d}", 120, SQ, weight=BOLD, font=LAT_FONT)
        title = TL(zh, en, 64, weight=BOLD)
        sub = T(en if ZH else "", 28, MUTED) if ZH else VMobject()
        grp = VGroup(n, title).arrange(RIGHT, buff=0.5)
        if ZH:
            sub.next_to(title, DOWN, aligned_edge=LEFT, buff=0.18)
            grp.add(sub)
        if grp.width > 12.2:
            grp.scale_to_fit_width(12.2)
        grp.move_to(ORIGIN)
        bar = Line(LEFT * 0.0, RIGHT * 0.0, color=SQ, stroke_width=6).next_to(grp, DOWN, buff=0.35)
        bar_full = Line(grp.get_left(), grp.get_right(), color=SQ, stroke_width=6).next_to(grp, DOWN, buff=0.35)
        self.play(FadeIn(n, shift=RIGHT * 0.4), Write(title), run_time=0.8)
        if ZH:
            self.play(FadeIn(sub), Transform(bar, bar_full), run_time=0.45)
        else:
            self.play(Transform(bar, bar_full), run_time=0.45)
        self.wait(0.6)
        head = VGroup(T(f"{num:02d}", 26, SQ, weight=BOLD, font=LAT_FONT), TL(zh, en, 24, color=MUTED))
        head.arrange(RIGHT, buff=0.22).to_corner(UL, buff=0.38)
        self.play(ReplacementTransform(VGroup(n, title), head), FadeOut(bar),
                  *( [FadeOut(sub)] if ZH else []), run_time=0.7)
        self.header = head


# ------------------------------------------------------------------ number theory
def S_of(n: int):
    out = []
    x = 1
    while x * x < n:
        r = n - x * x
        if r % 4 == 0:
            m = r // 4
            for y in range(1, m + 1):
                if m % y == 0:
                    out.append((x, y, m // y))
        x += 1
    return out


def zagier(t):
    x, y, z = t
    if x < y - z:
        return (x + 2 * z, z, y - x - z), "A"
    if y - z < x < 2 * y:
        return (2 * y - x, y, x - y + z), "B"
    if x > 2 * y:
        return (x - 2 * y, x - y + z, y), "C"
    return None, "boundary"


def swap(t):
    return (t[0], t[2], t[1])


# ------------------------------------------------------------------ windmills
def _rot(k):
    c, s = [(1, 0), (0, 1), (-1, 0), (0, -1)][k % 4]
    return np.array([[c, -s], [s, c]])


def windmill_geometry(x, y, z, chir=1):
    """Corner lists (in grid units, centred at 0) for the square and the 4 blades.

    Blade k is anchored at a corner of the square; L is its length direction (y
    cells), W its width direction (z cells, pointing away from the square).
    chir=-1 gives the mirror image (the windmill turning the other way).
    """
    h = x / 2
    mirror = np.diag([chir, 1])
    sq = [mirror @ np.array(p) for p in [(-h, -h), (h, -h), (h, h), (-h, h)]]
    blades = []
    for k in range(4):
        R = mirror @ _rot(k)
        a = R @ np.array([-h, -h])
        Ld = R @ np.array([1.0, 0.0])
        Wd = R @ np.array([0.0, -1.0])
        pts = [a, a + y * Ld, a + y * Ld + z * Wd, a + z * Wd]
        blades.append({"pts": pts, "anchor": a, "L": Ld, "W": Wd})
    return sq, blades


def windmill_outline(x, y, z, chir=1):
    sq, bl = windmill_geometry(x, y, z, chir)
    u = unary_union([SPoly(sq)] + [SPoly(b["pts"]) for b in bl])
    return list(u.exterior.coords)[:-1]


def windmill_extent(x, y, z):
    pts = np.array(windmill_outline(x, y, z))
    return float(np.abs(pts).max())


class Windmill(VGroup):
    """x² + 4yz drawn as a windmill. Units: `unit` scene units per grid cell."""

    def __init__(self, x, y, z, unit=0.4, chir=1, cells=True, sq_color=SQ, arm_color=ARM,
                 stroke=BG, stroke_width=3.0, cell_opacity=0.35, **kw):
        super().__init__(**kw)
        self.xyz = (x, y, z)
        self.unit = unit
        self.chir = chir
        self.opts = dict(cells=cells, sq_color=sq_color, arm_color=arm_color, stroke=stroke,
                         stroke_width=stroke_width, cell_opacity=cell_opacity)
        u = unit
        P = lambda p: np.array([p[0] * u, p[1] * u, 0.0])  # noqa: E731
        sqp, blades = windmill_geometry(x, y, z, chir)

        def piece(pts, color, dims, axes, origin):
            poly = Polygon(*[P(p) for p in pts], fill_color=color, fill_opacity=1,
                           stroke_color=stroke, stroke_width=stroke_width)
            grp = VGroup(poly)
            if cells:
                lines = VGroup()
                (na, nb), (ea, eb) = dims, axes
                for i in range(1, na):
                    s0 = origin + ea * i
                    lines.add(Line(P(s0), P(s0 + eb * nb)))
                for j in range(1, nb):
                    s0 = origin + eb * j
                    lines.add(Line(P(s0), P(s0 + ea * na)))
                lines.set_stroke(stroke, 1.6, opacity=cell_opacity)
                grp.add(lines)
            return grp

        h = x / 2
        mirror = np.diag([chir, 1])
        self.square = piece(sqp, sq_color, (x, x), (mirror @ np.array([1.0, 0]), mirror @ np.array([0, 1.0])),
                            mirror @ np.array([-h, -h]))
        self.blades = VGroup()
        self.blade_info = blades
        for b in blades:
            self.blades.add(piece(b["pts"], arm_color, (y, z), (b["L"], b["W"]), b["anchor"]))
        self.add(self.square, self.blades)

    def anchor_point(self, k):
        a = self.blade_info[k]["anchor"] * self.unit
        return self.square[0].get_center() + np.array([a[0], a[1], 0])

    def flip_axis(self, k):
        b = self.blade_info[k]
        d = b["L"] + b["W"]
        return np.array([d[0], d[1], 0.0])

    def outline_mob(self, color=TEXT, width=4):
        pts = windmill_outline(*self.xyz, self.chir)
        c = self.square[0].get_center()
        return Polygon(*[c + np.array([p[0], p[1], 0]) * self.unit for p in pts],
                       stroke_color=color, stroke_width=width, fill_opacity=0)

    def label(self, size=26, color=MUTED, buff=0.18):
        x, y, z = self.xyz
        return M(f"({x},{y},{z})", size, color).next_to(self, DOWN, buff=buff)

    def centre(self):
        return self.square[0].get_center()

    def remake(self, x, y, z, chir=None, unit=None):
        """A new windmill with the same style, centred where this one is."""
        w = Windmill(x, y, z, unit=unit or self.unit, chir=self.chir if chir is None else chir, **self.opts)
        return w.shift(self.centre())

    def silhouette(self, fill=NEUTRAL, stroke=TEXT, width=4):
        o = self.outline_mob(stroke, width)
        o.set_fill(fill, 1)
        return o


def flip_anims(wm: Windmill, run_time=1.2):
    """Each blade turns over about the diagonal through its anchor corner."""
    return [Rotate(wm.blades[k], angle=PI, axis=wm.flip_axis(k), about_point=wm.anchor_point(k),
                   run_time=run_time) for k in range(4)]


def do_flip(scene, wm: Windmill, run_time=1.0):
    scene.play(*flip_anims(wm, run_time))
    x, y, z = wm.xyz
    new = wm.remake(x, z, y)
    scene.remove(wm)
    scene.add(new)
    return new


def do_recut(scene, wm: Windmill, run_time=1.3, border=RECUT):
    t2, case = zagier(wm.xyz)
    chir2 = -wm.chir if case == "B" else wm.chir
    new = wm.remake(*t2, chir=chir2)
    sil = wm.silhouette()
    sq = Square(t2[0] * wm.unit, stroke_color=border, stroke_width=5).move_to(wm.centre())
    scene.play(FadeIn(sil), FadeOut(wm), run_time=run_time * 0.3)
    scene.play(Create(sq), run_time=run_time * 0.4)
    scene.play(FadeIn(new), FadeOut(sil), FadeOut(sq), run_time=run_time * 0.3)
    return new


def tip_lines(wm: Windmill, color=RECUT, length=None, width=3):
    """Dashed lines through the four blade tips (they bound the 'tip square')."""
    x, y, z = wm.xyz
    c = wm.centre()
    s = (y - x / 2) * wm.unit
    ext = length or (max(x / 2 + z, abs(y - x / 2)) + 1.2) * wm.unit
    g = VGroup()
    for d in [RIGHT, UP, LEFT, DOWN]:
        n = np.array([-d[1], d[0], 0])
        p = c + d * s
        g.add(DashedLine(p - n * ext, p + n * ext, color=color, stroke_width=width, dash_length=0.08))
    return g


def tip_edges(wm: Windmill, color=RECUT, width=7):
    u = wm.unit
    c = wm.centre()
    g = VGroup()
    for b in wm.blade_info:
        p1, p2 = b["pts"][1], b["pts"][2]
        g.add(Line(c + np.array([p1[0] * u, p1[1] * u, 0]), c + np.array([p2[0] * u, p2[1] * u, 0]),
                   color=color, stroke_width=width))
    return g


def tip_square_side(x, y, z):
    return abs(2 * y - x)


def outer_square_side(x, y, z):
    return x + 2 * z


def dashed_square(side, unit, centre, color=RECUT, width=3.5):
    s = Square(side * unit, stroke_color=color, stroke_width=width).move_to(centre)
    return DashedVMobject(s, num_dashes=max(12, int(side * 6)), dashed_ratio=0.55)


# ------------------------------------------------------------------ misc visuals
def lattice_dots(n=6, unit=0.4, centre=ORIGIN, color=DIM, r=0.035):
    g = VGroup()
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            g.add(Dot(centre + np.array([i * unit, j * unit, 0]), radius=r, color=color))
    return g


def pair_arc(a: np.ndarray, b: np.ndarray, color, up=True, width=4, angle=None):
    ang = angle if angle is not None else (-PI / 2.2 if up else PI / 2.2)
    return ArcBetweenPoints(a, b, angle=ang, stroke_color=color, stroke_width=width)


def ring(dot: Mobject, color, r=0.3, width=4):
    return Circle(radius=r, stroke_color=color, stroke_width=width).move_to(dot.get_center())


def self_loop(p: np.ndarray, color, up=True, r=0.2, width=4):
    c = p + (UP if up else DOWN) * r * 1.1
    return Circle(radius=r, stroke_color=color, stroke_width=width).move_to(c)
