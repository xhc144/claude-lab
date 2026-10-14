"""全片共用：配色、字体、公式、配音对时、常用图形。"""
import json
import os
from contextlib import contextmanager

import numpy as np
from manim import *  # noqa: F401,F403
from scipy import stats

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD = os.path.join(ROOT, "build")

# ---------------------------------------------------------------- 配色与字体
BG = "#F5F1E8"
INK = "#2B2A28"
SOFT = "#6F6A62"     # 次要文字
BLUE = "#3D5A98"     # 新方法班、后测
ORANGE = "#C8763A"   # 旧方法班、前测
GOLD = "#B8902F"     # 差（分子）
GRAY = "#9A958C"     # 抖动（分母）
RED = "#C0504D"      # 拒绝域、未知参数
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


class VScene(Scene):
    """每句旁白占据的时长至少等于配音时长加一个短停顿。

    with self.say("c01") as d:    # d 是这句配音的秒数
        self.play(..., run_time=d * 0.6)
    离开 with 时，如果动画比配音短，自动等到配音念完。
    """

    header = None

    def setup(self):
        self.voice_log = []
        self.ghost = None
        if self.header:
            self.add(make_header(self.header))

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

    def pause_q(self, text, hold=3.2, pos=UP * 2.62, mark_pos=None):
        """【停顿】：画面静止，只出一个问题和一个淡淡的问号。"""
        q = serif(text, 38).move_to(pos)
        mark = serif("？", 64, GRAY).to_corner(DR, buff=0.55).shift(UP * 0.5)
        if mark_pos is not None:
            mark.move_to(mark_pos)
        self.play(FadeIn(q, shift=DOWN * 0.15), FadeIn(mark), run_time=0.8)
        self.voice_log.append({"key": "_pause", "t": round(self.time, 3), "dur": hold})
        self.wait(hold)
        self.play(FadeOut(mark), run_time=0.4)
        return q

    def add_ghost(self):
        self.ghost = make_ghost()
        self.add(self.ghost)
        return self.ghost

    def tear_down(self):
        os.makedirs(os.path.join(BUILD, "timing"), exist_ok=True)
        with open(os.path.join(BUILD, "timing", f"{type(self).__name__}.json"), "w", encoding="utf-8") as f:
            json.dump({"duration": round(self.time, 3), "lines": self.voice_log}, f, ensure_ascii=False, indent=1)


def make_header(text):
    t = zh(text, 24, SOFT)
    bar = Line(ORIGIN, RIGHT * 0.45, color=GOLD, stroke_width=3)
    g = VGroup(bar, t).arrange(RIGHT, buff=0.18)
    return g.to_corner(UL, buff=0.45)


GHOST_POS = np.array([5.45, 3.35, 0])


def make_ghost():
    """角落里的 −2Cov 虚线幽灵，03 段放进去，07 段取回来。"""
    term = tex(r"-2\operatorname{Cov}(\bar X,\bar Y)", size=30, color=GRAY)
    box = DashedVMobject(SurroundingRectangle(term, buff=0.12, corner_radius=0.08, color=GRAY, stroke_width=1.6),
                         num_dashes=28)
    g = VGroup(term, box)
    g.set_opacity(0.55)
    return g.move_to(GHOST_POS)


# ---------------------------------------------------------------- 分布曲线
def pdf_curve(ax, f, x0, x1, color=INK, width=3, n=240):
    xs = np.linspace(x0, x1, n)
    pts = [ax.c2p(x, f(x)) for x in xs]
    c = VMobject(color=color, stroke_width=width)
    c.set_points_smoothly(pts)
    return c


def area_under(ax, f, x0, x1, color=RED, opacity=0.22, n=80):
    xs = np.linspace(x0, x1, n)
    top = [ax.c2p(x, f(x)) for x in xs]
    poly = Polygon(ax.c2p(x0, 0), *top, ax.c2p(x1, 0), stroke_width=0, fill_color=color, fill_opacity=opacity)
    return poly


def dist_axes(x0, x1, step, width=10, height=2.6, ymax=0.45, numbers=None, num_size=26):
    ax = Axes(x_range=[x0, x1, step], y_range=[0, ymax, ymax], x_length=width, y_length=height,
              axis_config={"color": LINE, "stroke_width": 2, "include_tip": False, "include_ticks": True,
                           "tick_size": 0.05},
              y_axis_config={"stroke_opacity": 0, "include_ticks": False})
    if numbers is not None:
        labels = VGroup(*[tex(f"{v:g}", size=num_size, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.16)
                          for v in numbers])
        ax.add(labels)
    return ax


def normal_pdf(x):
    return stats.norm.pdf(x)


def t_pdf(df):
    return lambda x: stats.t.pdf(x, df)


def f_pdf(d1, d2):
    return lambda x: stats.f.pdf(x, d1, d2) if x > 0 else 0.0


def chi2_scaled_pdf(df):
    """χ²(df)/df 的密度，均值为 1。"""
    return lambda x: df * stats.chi2.pdf(x * df, df) if x > 0 else 0.0


def marker(ax, x, color=GOLD, label=None, size=30, r=0.09):
    d = Dot(ax.c2p(x, 0), radius=r, color=color).set_z_index(5)
    if label is None:
        return d
    lab = tex(label, size=size, color=color).next_to(d, UP, buff=0.22)
    return VGroup(d, lab)


def reject_regions(ax, f, lo, hi, x0, x1, opacity=0.22):
    g = VGroup()
    if lo is not None:
        g.add(area_under(ax, f, x0, lo, RED, opacity))
    if hi is not None:
        g.add(area_under(ax, f, hi, x1, RED, opacity))
    return g


# ---------------------------------------------------------------- 分数点阵
class ScoreRows:
    """共享一条 50–100 数轴的两行点阵：上面一行新方法，下面一行旧方法。"""

    def __init__(self, axis_y=-2.35, x_left=-5.3, length=11.6, row_y=(0.15, -1.65), r=0.075, gap=0.19):
        self.axis = NumberLine(x_range=[50, 100, 5], length=length, color=LINE, stroke_width=2,
                               include_tip=False, tick_size=0.06)
        self.axis.move_to([x_left + length / 2, axis_y, 0])
        self.nums = VGroup(*[tex(str(v), size=30, color=SOFT).next_to(self.axis.n2p(v), DOWN, buff=0.15)
                             for v in range(50, 101, 10)])
        self.row_y = row_y
        self.r = r
        self.gap = gap

    def x(self, v):
        return self.axis.n2p(v)[0]

    def positions(self, scores, row):
        """整数分数相同的点竖着叠起来。"""
        y0 = self.row_y[row]
        seen = {}
        out = []
        for v in scores:
            k = seen.get(v, 0)
            seen[v] = k + 1
            out.append(np.array([self.x(v), y0 + k * self.gap, 0]))
        return out

    def layout(self, pool, mask):
        """pool 是全部 80 个分数，mask 为 True 的放上面一行。返回每个点的位置。"""
        pos = [None] * len(pool)
        for row, sel in ((0, mask), (1, ~mask)):
            idx = np.where(sel)[0]
            order = idx[np.argsort(pool[idx], kind="stable")]
            for i, p in zip(order, self.positions(pool[order], row)):
                pos[i] = p
        return pos

    def dots(self, pool, mask, colors=(BLUE, ORANGE)):
        pos = self.layout(pool, mask)
        return VGroup(*[Dot(p, radius=self.r, color=colors[0] if m else colors[1]) for p, m in zip(pos, mask)])

    def mean_line(self, v, row, color, h=1.0):
        y0 = self.row_y[row] - 0.2
        ln = Line([self.x(v), y0, 0], [self.x(v), y0 + h, 0], color=color, stroke_width=3)
        tri = Triangle(color=color, fill_opacity=1, stroke_width=0).scale(0.07).rotate(PI)
        tri.next_to(ln, UP, buff=0.02)
        return VGroup(ln, tri)


def gap_bracket(x0, x1, y, color=GOLD, label=None, size=34):
    seg = Line([x0, y, 0], [x1, y, 0], color=color, stroke_width=5)
    ticks = VGroup(*[Line([x, y - 0.1, 0], [x, y + 0.1, 0], color=color, stroke_width=3) for x in (x0, x1)])
    g = VGroup(seg, ticks)
    if label is not None:
        g.add(tex(label, size=size, color=color).next_to(seg, UP, buff=0.14))
    return g


def wave(width=3.2, amp=0.09, cycles=3.5, color=GRAY, phase=0.0, stroke=4):
    return FunctionGraph(lambda x: amp * np.sin(2 * PI * cycles * x / width + phase),
                         x_range=[-width / 2, width / 2], color=color, stroke_width=stroke)


def frac(numer, denom, lhs=None, gap=0.14, extra=0.25, stroke=2.5):
    """手工拼的分数，分子、分母可以分别上色、分别动画。返回 VGroup(lhs?, numer, bar, denom)。"""
    w = max(numer.width, denom.width) + extra
    bar = Line(LEFT * w / 2, RIGHT * w / 2, color=INK, stroke_width=stroke)
    numer.next_to(bar, UP, buff=gap)
    denom.next_to(bar, DOWN, buff=gap)
    g = VGroup(numer, bar, denom)
    if lhs is not None:
        lhs.next_to(bar, LEFT, buff=0.2)
        g = VGroup(lhs, numer, bar, denom)
    return g


def _norm_pts(p):
    p = p[:, :2] - p[:, :2].mean(axis=0)
    h = np.ptp(p[:, 1]) or 1.0
    return p / h


def find_glyphs(m, sym, tol=0.03):
    """在一个 MathTex 里找出与符号 sym 形状相同的字形，返回它们（用于给 σ 上色、划掉）。"""
    ref = MathTex(sym)[0][0]
    rp = _norm_pts(ref.points)
    hits = VGroup()
    for g in m.family_members_with_points():
        if len(g.points) == len(ref.points) and np.abs(_norm_pts(g.points) - rp).max() < tol:
            hits.add(g)
    return hits


def strike(g, color=RED, width=4):
    return Line(g.get_corner(DL) + DL * 0.06, g.get_corner(UR) + UR * 0.06, color=color, stroke_width=width)


def t_test_plot(df, t_obs, crit, x0=-4.5, x1=4.5, width=10, center=DOWN * 1.0, label=None):
    ax = dist_axes(x0, x1, 1, width=width, height=2.5, ymax=0.42, numbers=[-crit, 0, crit]).move_to(center)
    f = t_pdf(df) if df else normal_pdf
    cur = pdf_curve(ax, f, x0, x1)
    rej = reject_regions(ax, f, -crit, crit, x0, x1)
    mk = marker(ax, min(t_obs, x1 - 0.1), GOLD)
    g = VGroup(ax, cur, rej)
    if label:
        g.add(tex(label, size=34, color=SOFT).next_to(ax.c2p(x0, 0.38), RIGHT, buff=0.1))
    return g, mk
