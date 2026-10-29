"""全片共用：深色霓虹配色、背景、光晕、配音对时、版式部件与分布曲线。"""
import json
import math
import os
from contextlib import contextmanager

import numpy as np
from manim import *  # noqa: F401,F403
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD = os.path.join(ROOT, "build")

# ---------------------------------------------------------------- 配色与字体
BG = "#060913"
INK = "#E9EDF8"      # 正文
SOFT = "#8A93AE"     # 次要文字
DIM = "#3A4361"      # 坐标轴、细线、未点亮的点
PANEL = "#0E1426"
CYAN = "#3BE3FF"     # 先验
MAGENTA = "#FF4FD8"  # 似然、证据
AMBER = "#FFC247"    # 后验
VIOLET = "#9D7BFF"   # 平的先验、分母
GREEN = "#4DF5A6"    # 健康
RED = "#FF5470"      # 有病、没盖住
WHITE_HOT = "#FFFFFF"

SANS = "Noto Sans CJK SC"
SERIF = "Noto Serif CJK SC"

config.background_color = BG
config.frame_rate = 30

CTEX = TexTemplate(
    tex_compiler="xelatex",
    output_format=".xdv",
    documentclass=r"\documentclass[preview]{standalone}",
    preamble=r"""
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{xeCJK}
\setCJKmainfont{Noto Sans CJK SC}
""",
)
MathTex.set_default(color=INK, tex_template=CTEX)
Tex.set_default(color=INK, tex_template=CTEX)


def zh(s, size=34, color=INK, font=SANS, weight=NORMAL, **kw):
    return Text(s, font=font, font_size=size, color=color, weight=weight, **kw)


def tex(*s, size=44, color=INK, **kw):
    return MathTex(*s, font_size=size, color=color, **kw)


# ---------------------------------------------------------------- 背景
def background_path(w=None, h=None):
    """深色径向渐变 + 很淡的网格 + 稀疏星点，按渲染分辨率生成一次。"""
    w = w or config.pixel_width
    h = h or config.pixel_height
    path = os.path.join(BUILD, "bg", f"bg_{w}x{h}.png")
    if os.path.exists(path):
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((x - w * 0.5) / w, (y - h * 0.42) / h)
    t = np.clip(r / 0.75, 0, 1)[..., None]
    inner, outer = np.array([20, 27, 54]), np.array([5, 7, 15])
    img = inner * (1 - t) ** 1.6 + outer * (1 - (1 - t) ** 1.6)
    # 网格：每 1/16 画面宽一条线，越靠边越淡
    step = w / 16
    gx = np.abs(((x + step / 2) % step) - step / 2) < max(1, w / 1920)
    gy = np.abs(((y + step / 2) % step) - step / 2) < max(1, w / 1920)
    grid = (gx | gy).astype(np.float32)[..., None] * (1 - t) * 9
    img = img + grid * np.array([0.6, 0.8, 1.0])
    rng = np.random.default_rng(1)
    n = int(w * h / 9000)
    xs, ys = rng.integers(0, w, n), rng.integers(0, h, n)
    br = rng.uniform(20, 90, n) * rng.uniform(0, 1, n) ** 2
    for px, py, b in zip(xs, ys, br):
        img[py, px] += b
    img = np.clip(img, 0, 255).astype(np.uint8)
    Image.fromarray(img, "RGB").save(path)
    return path


class BgCamera(Camera):
    def __init__(self, **kw):
        kw.setdefault("background_image", background_path())
        super().__init__(**kw)


# ---------------------------------------------------------------- 配音对时
_VOICE = os.path.join(BUILD, "voice", "durations.json")
DUR = json.load(open(_VOICE, encoding="utf-8")) if os.path.exists(_VOICE) else {}
GAP = 0.32


def _estimate(key):
    """还没合成配音的句子按每秒 4.4 字估计，只用于试渲染；assemble.py 不会拿它出成片。"""
    from narration import all_lines
    say = next(s for _, k, _, s in all_lines() if k == key)
    return round(0.4 + len(say) / 4.4, 3)


class Voiced:
    """每句旁白占据的时长至少等于配音时长加一个短停顿。

    with self.say("p01") as d:    # d 是这句配音的秒数
        self.play(..., run_time=d * 0.6)
    离开 with 时，如果动画比配音短，自动等到配音念完。
    """

    header = None

    def setup(self):
        self.voice_log = []
        self.hdr = None
        if self.header:
            self.hdr = make_header(self.header)
            self.add(self.hdr)

    @contextmanager
    def say(self, key, gap=GAP):
        est = key not in DUR or DUR[key].get("estimate", False)
        d = DUR[key]["dur"] if key in DUR else _estimate(key)
        t0 = self.time
        self.voice_log.append({"key": key, "t": round(t0, 3), "dur": d, **({"estimate": True} if est else {})})
        yield d
        rem = d + gap - (self.time - t0)
        if rem > 1e-3:
            self.wait(rem)

    def line(self, key, gap=GAP):
        with self.say(key, gap):
            pass

    def hit(self):
        """在这一刻放一个音效（标题出现时的低频冲击），assemble.py 读取。"""
        self.voice_log.append({"key": "_hit", "t": round(self.time, 3), "dur": 0})

    def clear(self, *keep, run_time=0.6):
        """淡出画面上除页眉和 keep 之外的全部对象。"""
        out = [m for m in self.mobjects if m is not self.hdr and m not in keep]
        if out:
            self.play(*[FadeOut(m) for m in out], run_time=run_time)

    def tear_down(self):
        os.makedirs(os.path.join(BUILD, "timing"), exist_ok=True)
        with open(os.path.join(BUILD, "timing", f"{type(self).__name__}.json"), "w", encoding="utf-8") as f:
            json.dump({"duration": round(self.time, 3), "lines": self.voice_log}, f, ensure_ascii=False, indent=1)


class VScene(Voiced, Scene):
    def __init__(self, **kw):
        kw.setdefault("camera_class", BgCamera)
        super().__init__(**kw)


def make_header(text):
    t = zh(text, 22, SOFT)
    bar = Line(ORIGIN, RIGHT * 0.45, color=CYAN, stroke_width=3)
    g = VGroup(glow(bar, layers=2), t).arrange(RIGHT, buff=0.18)
    return g.to_corner(UL, buff=0.45)


# ---------------------------------------------------------------- 光晕
def glow(mob, color=None, layers=3, spread=2.6, strength=0.16):
    """在线条下面叠几层更粗、更透明的同色描边，看起来像霓虹灯管。

    返回 VGroup(光晕..., 原对象)；对文字（填充字形）同样有效。
    """
    halo = VGroup()
    base_w = max(mob.get_stroke_width(), 2.0) if mob.get_stroke_width() > 0 else 2.0
    for k in range(layers, 0, -1):
        c = mob.copy()
        for sm in c.family_members_with_points():
            col = color or (sm.get_stroke_color() if sm.get_stroke_width() > 0 else sm.get_fill_color())
            sm.set_fill(opacity=0)
            sm.set_stroke(col, width=base_w * (1 + spread * k), opacity=strength / k ** 0.6)
        halo.add(c)
    return VGroup(halo, mob)


def neon(s, size=34, color=CYAN, layers=3, **kw):
    """会发光的中文。"""
    t = zh(s, size, color, **kw)
    return glow(t, color, layers=layers, spread=3.0 * 30 / max(size, 18), strength=0.22)


def halo_dot(point, color=AMBER, r=0.07, rings=3, strength=0.22):
    d = Dot(point, radius=r, color=color)
    hs = VGroup(*[Circle(radius=r * (1 + 1.1 * k), stroke_width=0, fill_color=color,
                         fill_opacity=strength / k).move_to(point) for k in range(rings, 0, -1)])
    return VGroup(hs, d)


# ---------------------------------------------------------------- 版式部件
def panel(w, h, color=CYAN, fill=PANEL, opacity=0.78, r=0.18, width=1.4):
    return RoundedRectangle(width=w, height=h, corner_radius=r, fill_color=fill, fill_opacity=opacity,
                            stroke_color=color, stroke_width=width, stroke_opacity=0.55)


def on_panel(content, pad=0.35, color=CYAN, min_w=0, min_h=0, **kw):
    bg = panel(max(min_w, content.width + 2 * pad), max(min_h, content.height + 2 * pad), color=color, **kw)
    bg.move_to(content)
    return VGroup(bg, content)


def pill(text, color=AMBER, size=24, fill_opacity=0.14, txt_color=None):
    t = zh(text, size, txt_color or color) if isinstance(text, str) else text
    bg = RoundedRectangle(width=t.width + 0.42, height=t.height + 0.26, corner_radius=min(0.22, (t.height + 0.26) / 2),
                          stroke_color=color, stroke_width=1.6, fill_color=color, fill_opacity=fill_opacity)
    bg.move_to(t)
    return VGroup(bg, t)


def boxed(mob, color=AMBER, buff=0.12, width=2.5):
    return glow(SurroundingRectangle(mob, color=color, buff=buff, stroke_width=width, corner_radius=0.1), layers=2)


# ---------------------------------------------------------------- θ 轴与曲线
def theta_axes(w=10.0, h=4.2, center=DOWN * 0.4, y_max=6.0, ticks=(0, 0.25, 0.5, 0.75, 1)):
    ax = Axes(x_range=[0, 1, 0.25], y_range=[0, y_max, y_max], x_length=w, y_length=h,
              axis_config={"color": DIM, "stroke_width": 2, "include_tip": False, "tick_size": 0.05},
              y_axis_config={"stroke_opacity": 0, "tick_size": 0})
    ax.move_to(center)
    labels = VGroup(*[tex(f"{v:g}", size=26, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.16) for v in ticks])
    name = tex(r"\theta", size=36, color=SOFT).next_to(ax.c2p(1, 0), RIGHT, buff=0.25)
    return ax, VGroup(labels, name)


def density_curve(ax, f, color=AMBER, width=4, n=240, x0=0.0, x1=1.0, y_cap=None):
    xs = np.linspace(x0, x1, n)
    ys = np.array([f(x) for x in xs])
    if y_cap is not None:
        ys = np.minimum(ys, y_cap)
    pts = [ax.c2p(x, y) for x, y in zip(xs, ys)]
    return VMobject(stroke_color=color, stroke_width=width).set_points_smoothly(pts)


def density_fill(ax, f, a=0.0, b=1.0, color=AMBER, opacity=0.22, n=200, y_cap=None):
    xs = np.linspace(a, b, n)
    ys = np.array([f(x) for x in xs])
    if y_cap is not None:
        ys = np.minimum(ys, y_cap)
    pts = [ax.c2p(a, 0)] + [ax.c2p(x, y) for x, y in zip(xs, ys)] + [ax.c2p(b, 0)]
    return Polygon(*pts, stroke_width=0, fill_color=color, fill_opacity=opacity)


def neon_density(ax, f, color=AMBER, width=4, fill=0.18, y_cap=None, layers=3, x0=None, x1=None):
    """发光的密度曲线加淡淡的填充：VGroup(填充, 光晕+曲线)。默认画满坐标轴的横轴范围。"""
    x0 = ax.x_range[0] if x0 is None else x0
    x1 = ax.x_range[1] if x1 is None else x1
    c = density_curve(ax, f, color, width, x0=x0, x1=x1, y_cap=y_cap)
    parts = [glow(c, color, layers=layers)]
    if fill:
        parts.insert(0, density_fill(ax, f, x0, x1, color=color, opacity=fill, y_cap=y_cap))
    return VGroup(*parts)


def marker(ax, x, y_top, color=WHITE_HOT, width=2.5, dashed=True):
    a, b = ax.c2p(x, 0), ax.c2p(x, y_top)
    if dashed:
        return DashedLine(a, b, color=color, stroke_width=width, dash_length=0.09)
    return Line(a, b, color=color, stroke_width=width)


def ball(r=0.3):
    """一个简笔篮球。"""
    c = Circle(radius=r, stroke_color="#FF8A3D", stroke_width=3, fill_color="#FF8A3D", fill_opacity=0.25)
    seams = VGroup(
        Line(c.get_top(), c.get_bottom(), color="#FF8A3D", stroke_width=2),
        Line(c.get_left(), c.get_right(), color="#FF8A3D", stroke_width=2),
        ArcBetweenPoints(c.get_top() + LEFT * r * 0.15, c.get_bottom() + LEFT * r * 0.15, angle=0.9,
                         color="#FF8A3D", stroke_width=2).shift(LEFT * r * 0.35),
        ArcBetweenPoints(c.get_bottom() + RIGHT * r * 0.15, c.get_top() + RIGHT * r * 0.15, angle=0.9,
                         color="#FF8A3D", stroke_width=2).shift(RIGHT * r * 0.35),
    )
    return glow(VGroup(c, seams), "#FF8A3D", layers=2)


def check_mark(color=GREEN, s=0.26):
    return VMobject(color=color, stroke_width=5).set_points_as_corners(
        [LEFT * s * 0.9 + UP * s * 0.05, DOWN * s * 0.55, RIGHT * s + UP * s * 0.75])


def cross_mark(color=RED, s=0.2):
    return VGroup(Line(UL * s, DR * s, color=color, stroke_width=5), Line(UR * s, DL * s, color=color, stroke_width=5))


def pct(x, nd=1):
    return f"{x * 100:.{nd}f}\\%"


__all__ = [n for n in dir() if not n.startswith("_")]
