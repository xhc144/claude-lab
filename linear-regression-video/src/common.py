"""全片共用：配色、字体、公式、配音对时、散点图。"""
import json
import os
from contextlib import contextmanager

import numpy as np
from manim import *  # noqa: F401,F403

from data import A, B, X, XBAR, Y, YBAR

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD = os.path.join(ROOT, "build")

# ---------------------------------------------------------------- 配色与字体
BG = "#F5F1E8"
INK = "#2B2A28"
SOFT = "#6F6A62"     # 次要文字
BLUE = "#3D5A98"     # 回归直线、拟合值、投影
ORANGE = "#C8763A"   # 残差：线段、正方形、残差向量，全片不换色
GOLD = "#B8902F"     # 平均点、强调
GRAY = "#9A958C"     # 候选直线、基向量
RED = "#C0504D"      # 反例、离群点
LINE = "#CFC7B8"     # 坐标轴、细线
PANEL = "#ECE5D7"

SERIF = "Noto Serif CJK SC"
SANS = "Noto Sans CJK SC"

config.background_color = BG
config.frame_rate = 30

CTEX = TexTemplate(
    tex_compiler="xelatex",
    output_format=".xdv",
    documentclass=r"\documentclass[preview]{standalone}",
    preamble=r"""
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{bm}
\usepackage{xeCJK}
\setCJKmainfont{Noto Sans CJK SC}
""",
)
MathTex.set_default(color=INK, tex_template=CTEX)
Tex.set_default(color=INK, tex_template=CTEX)


def zh(s, size=34, color=INK, font=SANS, weight=NORMAL, **kw):
    return Text(s, font=font, font_size=size, color=color, weight=weight, **kw)


def serif(s, size=40, color=INK, weight=NORMAL, **kw):
    return Text(s, font=SERIF, font_size=size, color=color, weight=weight, **kw)


def tex(*s, size=44, color=INK, **kw):
    return MathTex(*s, font_size=size, color=color, **kw)


# ---------------------------------------------------------------- 配音对时
_VOICE = os.path.join(BUILD, "voice", "durations.json")
DUR = json.load(open(_VOICE, encoding="utf-8")) if os.path.exists(_VOICE) else {}
GAP = 0.32


class Voiced:
    """每句旁白占据的时长至少等于配音时长加一个短停顿。

    with self.say("c01") as d:    # d 是这句配音的秒数
        self.play(..., run_time=d * 0.6)
    离开 with 时，如果动画比配音短，自动等到配音念完。
    """

    header = None

    def setup(self):
        self.voice_log = []
        if self.header:
            h = make_header(self.header)
            if isinstance(self, ThreeDScene):
                self.add_fixed_in_frame_mobjects(h)
            else:
                self.add(h)

    @contextmanager
    def say(self, key, gap=GAP):
        d = DUR[key]["dur"]
        t0 = self.time
        self.voice_log.append({"key": key, "t": round(t0, 3), "dur": d})
        yield d
        rem = d + gap - (self.time - t0)
        if rem > 1e-3:
            self.wait(rem)

    def line(self, key, gap=GAP):
        with self.say(key, gap):
            pass

    def tear_down(self):
        os.makedirs(os.path.join(BUILD, "timing"), exist_ok=True)
        with open(os.path.join(BUILD, "timing", f"{type(self).__name__}.json"), "w", encoding="utf-8") as f:
            json.dump({"duration": round(self.time, 3), "lines": self.voice_log}, f, ensure_ascii=False, indent=1)


class VScene(Voiced, Scene):
    pass


class VThreeDScene(Voiced, ThreeDScene):
    pass


def make_header(text):
    t = zh(text, 24, SOFT)
    bar = Line(ORIGIN, RIGHT * 0.45, color=GOLD, stroke_width=3)
    g = VGroup(bar, t).arrange(RIGHT, buff=0.18)
    return g.to_corner(UL, buff=0.45)


# ---------------------------------------------------------------- 散点图
class Plot:
    """学习时长—分数散点图：x 轴 0–12 小时，y 轴 40–100 分。"""

    def __init__(self, width=8.6, height=5.4, center=DOWN * 0.25, x_range=(0, 12, 2), y_range=(40, 100, 10),
                 xlabel="每周学习时长（小时）", ylabel="期末分数", num_size=26):
        self.ax = Axes(x_range=list(x_range), y_range=list(y_range), x_length=width, y_length=height,
                       axis_config={"color": LINE, "stroke_width": 2, "include_tip": False, "tick_size": 0.05})
        self.ax.move_to(center)
        xs = np.arange(x_range[0], x_range[1] + 1e-9, x_range[2])
        ys = np.arange(y_range[0], y_range[1] + 1e-9, y_range[2])
        self.nums = VGroup(
            *[tex(f"{v:g}", size=num_size, color=SOFT).next_to(self.ax.c2p(v, y_range[0]), DOWN, buff=0.14)
              for v in xs[1:]],
            *[tex(f"{v:g}", size=num_size, color=SOFT).next_to(self.ax.c2p(x_range[0], v), LEFT, buff=0.14)
              for v in ys[1:]],
        )
        self.xlabel = zh(xlabel, 22, SOFT).next_to(self.ax.c2p(x_range[1], y_range[0]), DOWN, buff=0.5).shift(LEFT * 1.2)
        self.ylabel = zh(ylabel, 22, SOFT).next_to(self.ax.c2p(x_range[0], y_range[1]), UP, buff=0.2)
        self.x_range, self.y_range = x_range, y_range

    def frame(self):
        return VGroup(self.ax, self.nums, self.xlabel, self.ylabel)

    def p(self, x, y):
        return self.ax.c2p(x, y)

    def dots(self, xs=X, ys=Y, color=INK, r=0.085):
        return VGroup(*[Dot(self.p(x, y), radius=r, color=color) for x, y in zip(xs, ys)])

    def line(self, a, b, color=BLUE, width=4, x0=None, x1=None):
        x0 = self.x_range[0] if x0 is None else x0
        x1 = self.x_range[1] if x1 is None else x1
        # 裁到 y 轴范围内，避免画出坐标框
        lo, hi = self.y_range[0], self.y_range[1]
        if abs(b) > 1e-9:
            xa, xb = sorted([(lo - a) / b, (hi - a) / b])
            x0, x1 = max(x0, xa), min(x1, xb)
        return Line(self.p(x0, a + b * x0), self.p(x1, a + b * x1), color=color, stroke_width=width)

    def residuals(self, a, b, xs=X, ys=Y, color=ORANGE, width=3.5):
        return VGroup(*[Line(self.p(x, a + b * x), self.p(x, y), color=color, stroke_width=width)
                        for x, y in zip(xs, ys)])

    def squares(self, a, b, xs=X, ys=Y, color=ORANGE, opacity=0.22):
        """以残差为边的正方形，画在残差线段的右侧（残差为负时也朝右）。"""
        out = VGroup()
        for x, y in zip(xs, ys):
            p0, p1 = self.p(x, a + b * x), self.p(x, y)
            s = abs(p1[1] - p0[1])
            lo = min(p0[1], p1[1])
            sq = Square(side_length=max(s, 1e-3), stroke_width=1.2, stroke_color=color,
                        fill_color=color, fill_opacity=opacity)
            sq.move_to([p0[0] + s / 2, lo + s / 2, 0])
            out.add(sq)
        return out


def line_through(px, py, slope):
    """经过 (px, py)、斜率为 slope 的直线的截距。"""
    return py - slope * px


def frac(numer, denom, lhs=None, gap=0.14, extra=0.25, stroke=2.5):
    """手工拼的分数，分子、分母可以分别上色、分别动画。"""
    w = max(numer.width, denom.width) + extra
    bar = Line(LEFT * w / 2, RIGHT * w / 2, color=INK, stroke_width=stroke)
    numer.next_to(bar, UP, buff=gap)
    denom.next_to(bar, DOWN, buff=gap)
    g = VGroup(numer, bar, denom)
    if lhs is not None:
        lhs.next_to(bar, LEFT, buff=0.2)
        g = VGroup(lhs, numer, bar, denom)
    return g


def right_angle(corner, d1, d2, size=0.22, color=INK, width=2):
    """在 corner 处、沿两条互相垂直的方向 d1、d2 画直角记号（三维里也能用）。"""
    d1 = np.asarray(d1, float) / np.linalg.norm(d1)
    d2 = np.asarray(d2, float) / np.linalg.norm(d2)
    a = corner + d1 * size
    b = corner + (d1 + d2) * size
    c = corner + d2 * size
    return VMobject(color=color, stroke_width=width).set_points_as_corners([a, b, c])


__all__ = [n for n in dir() if not n.startswith("_")]
