"""全片共用：配色、字体、公式、配音对时、卡片、表格、分布曲线。"""
import json
import math
import os
from contextlib import contextmanager

import numpy as np
from manim import *  # noqa: F401,F403

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD = os.path.join(ROOT, "build")

# ---------------------------------------------------------------- 配色与字体
BG = "#F5F1E8"
INK = "#2B2A28"
SOFT = "#6F6A62"     # 次要文字、读音
BLUE = "#3D5A98"     # 总体、参数（希腊字母）
ORANGE = "#C8763A"   # 样本、统计量（拉丁字母）、残差
GOLD = "#B8902F"     # 强调
GREEN = "#4F8A5B"    # 正确、盖住真值
RED = "#C0504D"      # 错误、拒绝域、反例
GRAY = "#9A958C"
LINE = "#CFC7B8"     # 坐标轴、细线
PANEL = "#ECE5D7"
PAPER = "#FBF9F4"

SERIF = "Noto Serif CJK SC"
SANS = "Noto Sans CJK SC"
MONO = "DejaVu Sans Mono"

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
\usepackage{mathrsfs}
\usepackage{xeCJK}
\setCJKmainfont{Noto Sans CJK SC}
\newcommand{\iid}{\overset{\text{i.i.d.}}{\sim}}
\newcommand{\indep}{\perp\!\!\!\perp}
\DeclareMathOperator*{\argmax}{arg\,max}
\DeclareMathOperator{\Var}{Var}
\DeclareMathOperator{\Cov}{Cov}
""",
)
MathTex.set_default(color=INK, tex_template=CTEX)
Tex.set_default(color=INK, tex_template=CTEX)


def zh(s, size=34, color=INK, font=SANS, weight=NORMAL, **kw):
    return Text(s, font=font, font_size=size, color=color, weight=weight, **kw)


def serif(s, size=40, color=INK, weight=NORMAL, **kw):
    return Text(s, font=SERIF, font_size=size, color=color, weight=weight, **kw)


def mono(s, size=24, color=INK, **kw):
    return Text(s, font=MONO, font_size=size, color=color, **kw)


def tex(*s, size=44, color=INK, **kw):
    return MathTex(*s, font_size=size, color=color, **kw)


def lines(*items, buff=0.22, aligned=LEFT):
    """几行文字或公式竖排，左对齐。"""
    return VGroup(*items).arrange(DOWN, buff=buff, aligned_edge=aligned)


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
    pass


def make_header(text):
    t = zh(text, 24, SOFT)
    bar = Line(ORIGIN, RIGHT * 0.45, color=GOLD, stroke_width=3)
    g = VGroup(bar, t).arrange(RIGHT, buff=0.18)
    return g.to_corner(UL, buff=0.45)


# ---------------------------------------------------------------- 版式部件
def panel(w, h, fill=PANEL, stroke=LINE, r=0.16, opacity=1.0, width=1.5):
    return RoundedRectangle(width=w, height=h, corner_radius=r, fill_color=fill, fill_opacity=opacity,
                            stroke_color=stroke, stroke_width=width)


def on_panel(content, pad=0.35, fill=PANEL, stroke=LINE, min_w=0, min_h=0, **kw):
    bg = panel(max(min_w, content.width + 2 * pad), max(min_h, content.height + 2 * pad), fill=fill,
               stroke=stroke, **kw)
    bg.move_to(content)
    return VGroup(bg, content)


def card(sym, read=None, meaning=None, color=INK, size=84, w=3.0, fill=PANEL):
    """符号卡片：大号记号、读法、含义。sym 是 TeX 字符串或现成的对象。"""
    s = tex(sym, size=size, color=color) if isinstance(sym, str) else sym
    items = [s]
    if read:
        items.append(zh(read, 22, SOFT))
    if meaning:
        items.append(zh(meaning, 26, INK))
    g = VGroup(*items).arrange(DOWN, buff=0.22)
    return on_panel(g, pad=0.32, fill=fill, min_w=w)


def pill(text, color=GOLD, size=24, fill_opacity=0.14, txt_color=None):
    t = zh(text, size, txt_color or color) if isinstance(text, str) else text
    bg = RoundedRectangle(width=t.width + 0.4, height=t.height + 0.24, corner_radius=min(0.2, (t.height + 0.24) / 2),
                          stroke_color=color, stroke_width=1.6, fill_color=color, fill_opacity=fill_opacity)
    bg.move_to(t)
    return VGroup(bg, t)


def boxed(mob, color=GOLD, buff=0.1, width=2.5):
    return SurroundingRectangle(mob, color=color, buff=buff, stroke_width=width, corner_radius=0.08)


def under(mob, color=GOLD, width=3, buff=0.08):
    return Line(mob.get_corner(DL) + DOWN * buff, mob.get_corner(DR) + DOWN * buff, color=color, stroke_width=width)


def note(target, text, direction=DOWN, color=GOLD, size=24, buff=0.35, arrow=True):
    """指向某个对象的小注释：一条短线加一行字。"""
    t = zh(text, size, color) if isinstance(text, str) else text
    t.next_to(target, direction, buff=buff)
    if not arrow:
        return t
    a = Line(target.get_edge_center(direction), t.get_edge_center(-direction), color=color, stroke_width=2,
             buff=0.06)
    return VGroup(a, t)


def grid_table(rows, col_w, row_h=0.62, header=True, head_color=SOFT, line_color=LINE, align=None):
    """rows 是对象的二维列表；返回 VGroup(格子行..., 线)，table[0] 是表头行。"""
    n_cols = len(col_w)
    xs = np.cumsum([0] + list(col_w))
    total_w = xs[-1]
    out = VGroup()
    for r, row in enumerate(rows):
        g = VGroup()
        for c, cell in enumerate(row):
            if cell is None:
                cell = VMobject()
            x = xs[c] + col_w[c] / 2 - total_w / 2
            if align and align[c] == "l":
                cell.move_to([xs[c] - total_w / 2 + 0.15 + cell.width / 2, -r * row_h, 0])
            else:
                cell.move_to([x, -r * row_h, 0])
            g.add(cell)
        out.add(g)
    rule = VGroup()
    if header:
        rule.add(Line([-total_w / 2, -row_h / 2, 0], [total_w / 2, -row_h / 2, 0], color=line_color, stroke_width=2))
    for r in range(1 if header else 0, len(rows) - 1):
        y = -(r + 0.5) * row_h
        if r >= 1:
            rule.add(Line([-total_w / 2, y, 0], [total_w / 2, y, 0], color=line_color, stroke_width=1).set_opacity(0.6))
    out.add(rule)
    return out


def check_mark(color=GREEN, s=0.28):
    return VMobject(color=color, stroke_width=5).set_points_as_corners(
        [LEFT * s * 0.9 + UP * s * 0.05, DOWN * s * 0.55, RIGHT * s + UP * s * 0.75])


def cross_mark(color=RED, s=0.22):
    return VGroup(Line(UL * s, DR * s, color=color, stroke_width=5), Line(UR * s, DL * s, color=color, stroke_width=5))


# ---------------------------------------------------------------- 分布与坐标
def npdf(x, mu=0.0, sd=1.0):
    return math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * math.sqrt(2 * math.pi))


def axes(x_range, y_range, w, h, center=ORIGIN, tips=False, y_axis=True):
    ax = Axes(x_range=list(x_range), y_range=list(y_range), x_length=w, y_length=h,
              axis_config={"color": LINE, "stroke_width": 2, "include_tip": tips, "tick_size": 0.05},
              y_axis_config={"stroke_opacity": 1 if y_axis else 0, "tick_size": 0.05 if y_axis else 0})
    ax.move_to(center)
    return ax


def x_labels(ax, values, fmt="{:g}", size=24, color=SOFT, buff=0.14):
    return VGroup(*[tex(fmt.format(v) if not isinstance(v, str) else v, size=size, color=color)
                    .next_to(ax.c2p(v if not isinstance(v, str) else 0, ax.y_range[0]), DOWN, buff=buff)
                    for v in values])


def curve(ax, f, x0, x1, color=BLUE, width=4, n=200):
    return ax.plot(f, x_range=[x0, x1, (x1 - x0) / n], color=color, stroke_width=width)


def area(ax, f, a, b, color=BLUE, opacity=0.35, n=120):
    """曲线 f 在 [a, b] 上与 x 轴之间的区域。"""
    xs = np.linspace(a, b, n)
    pts = [ax.c2p(a, 0)] + [ax.c2p(x, f(x)) for x in xs] + [ax.c2p(b, 0)]
    return Polygon(*pts, stroke_width=0, fill_color=color, fill_opacity=opacity)


def bars(ax, xs, ys, width=0.8, color=BLUE, opacity=0.75, stroke=BG):
    out = VGroup()
    for x, y in zip(xs, ys):
        p0, p1 = ax.c2p(x - width / 2, 0), ax.c2p(x + width / 2, y)
        r = Rectangle(width=max(1e-3, p1[0] - p0[0]), height=max(1e-3, p1[1] - p0[1]), stroke_color=stroke,
                      stroke_width=1.2, fill_color=color, fill_opacity=opacity)
        r.move_to([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0])
        out.add(r)
    return out


def vline(ax, x, y1, color=GOLD, width=3, dashed=False, y0=0):
    ln = Line(ax.c2p(x, y0), ax.c2p(x, y1), color=color, stroke_width=width)
    return DashedLine(ax.c2p(x, y0), ax.c2p(x, y1), color=color, stroke_width=width, dash_length=0.08) if dashed else ln


def coin(head=True, r=0.24):
    c = Circle(radius=r, stroke_color=GOLD if head else GRAY, stroke_width=2.5,
               fill_color=GOLD if head else PANEL, fill_opacity=0.35 if head else 1)
    t = zh("正" if head else "反", int(r * 80), INK)
    return VGroup(c, t.move_to(c))


def die(n, s=0.62, color=INK):
    sq = RoundedRectangle(width=s, height=s, corner_radius=0.08, stroke_color=color, stroke_width=2,
                          fill_color=PAPER, fill_opacity=1)
    pos = {1: [(0, 0)], 2: [(-1, 1), (1, -1)], 3: [(-1, 1), (0, 0), (1, -1)],
           4: [(-1, 1), (1, 1), (-1, -1), (1, -1)], 5: [(-1, 1), (1, 1), (0, 0), (-1, -1), (1, -1)],
           6: [(-1, 1), (1, 1), (-1, 0), (1, 0), (-1, -1), (1, -1)]}[n]
    dots = VGroup(*[Dot([x * s * 0.27, y * s * 0.27, 0], radius=s * 0.075, color=color) for x, y in pos])
    return VGroup(sq, dots.move_to(sq))


__all__ = [n for n in dir() if not n.startswith("_")]
