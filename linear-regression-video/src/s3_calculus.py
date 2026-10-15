"""二 · 让 S 最小：对 a、b 求偏导，得到两个条件，解出斜率与截距"""
from common import *
from data import SXX, SXY, sse

RX = 3.55


def contour_panel(center, w=5.0, h=3.0, a_rng=(31, 71), b_rng=(1, 7)):
    """S(a,b) 的等高线：S − S_min = Δᵀ H Δ，H = [[n, Σx], [Σx, Σx²]]。"""
    ax = Axes(x_range=[*a_rng, 10], y_range=[*b_rng, 2], x_length=w, y_length=h,
              axis_config={"color": LINE, "stroke_width": 2, "include_tip": False, "tick_size": 0.04}).move_to(center)
    la = tex("a", size=30, color=SOFT).next_to(ax.x_axis, RIGHT, buff=0.12)
    lb = tex("b", size=30, color=SOFT).next_to(ax.y_axis, UP, buff=0.1)
    H = np.array([[len(X), X.sum()], [X.sum(), (X ** 2).sum()]])
    lam, vec = np.linalg.eigh(H)
    rings = VGroup()
    for k, c in enumerate([25, 90, 200, 380, 600]):
        th = np.linspace(0, TAU, 160)
        pts = [ax.c2p(*(np.array([A, B]) + np.sqrt(c) * (np.cos(t) * vec[:, 0] / np.sqrt(lam[0])
                                                         + np.sin(t) * vec[:, 1] / np.sqrt(lam[1]))))
               for t in th]
        r = VMobject(stroke_color=ORANGE, stroke_width=2, stroke_opacity=0.85 - 0.12 * k).set_points_smoothly(pts)
        rings.add(r)
    return ax, VGroup(ax, la, lb, rings)


def slice_panel(center, var, v_rng, s_max, f, w=5.0, h=2.4):
    ax = Axes(x_range=[*v_rng, 1 if var == "b" else 5], y_range=[0, s_max, s_max / 2], x_length=w, y_length=h,
              axis_config={"color": LINE, "stroke_width": 2, "include_tip": False, "tick_size": 0.04}).move_to(center)
    lv = tex(var, size=32, color=SOFT).next_to(ax.x_axis, RIGHT, buff=0.12)
    ls = tex("S", size=32, color=ORANGE).next_to(ax.y_axis, UP, buff=0.1)
    curve = ax.plot(f, x_range=list(v_rng), color=ORANGE, stroke_width=3)
    return ax, VGroup(ax, lv, ls, curve)


class Calculus(VScene):
    header = "二 · 让 S 最小"

    def construct(self):
        pl = Plot(width=6.4, height=4.9, center=[-3.35, -0.45, 0])
        dots = pl.dots()
        a, b = ValueTracker(58.0), ValueTracker(2.6)
        self.pivot = False

        def ga():
            return YBAR - b.get_value() * XBAR if self.pivot else a.get_value()

        ln = always_redraw(lambda: pl.line(ga(), b.get_value(), color=GRAY, width=4))
        self.add(pl.frame(), dots, ln)

        top = tex(r"S(a,b)", "=", r"\sum", r"\bigl(y_i-a-bx_i\bigr)^2", size=38).move_to([RX, 2.65, 0])
        top[0].set_color(ORANGE)
        goal = zh("找让 S 最小的 a、b", 26, SOFT).next_to(top, DOWN, buff=0.25)
        with self.say("c01") as d:
            self.play(Write(top), run_time=1.2)
            self.play(FadeIn(goal), run_time=0.6)

        cax, cp = contour_panel([RX, -1.3, 0])
        pt = always_redraw(lambda: Dot(cax.c2p(ga(), b.get_value()), radius=0.07, color=INK))
        bowl = zh("碗底", 22, BLUE).next_to(cax.c2p(A, B), UP, buff=0.35).shift(RIGHT * 0.35)
        with self.say("c02") as d:
            self.play(FadeIn(cp), FadeIn(pt), run_time=1.0)
            self.play(a.animate.set_value(A), b.animate.set_value(B), run_time=min(2.4, d * 0.5),
                      rate_func=rate_functions.ease_in_out_sine)
            self.play(FadeIn(bowl), run_time=0.5)

        # 只动 a：S(a) 是抛物线
        sax, sp = slice_panel([RX, -2.25, 0], "a", (41, 61), 1400, lambda v: sse(v, B))
        spt = always_redraw(lambda: Dot(sax.c2p(ga(), sse(ga(), b.get_value())), radius=0.08, color=INK))
        with self.say("c03") as d:
            self.play(FadeOut(cp), FadeOut(pt), FadeOut(bowl), FadeOut(goal), run_time=0.5)
            self.play(FadeIn(sp), FadeIn(spt), run_time=0.7)
            self.play(a.animate.set_value(44), run_time=d * 0.25)
            self.play(a.animate.set_value(58), run_time=d * 0.3)
            self.play(a.animate.set_value(A), run_time=d * 0.2)

        da = tex(r"\frac{\partial S}{\partial a}", "=", r"-2\sum(y_i-a-bx_i)", "=", "0", size=36).move_to([RX, 1.45, 0])
        tan = always_redraw(lambda: Line(sax.c2p(ga() - 3, sse(ga(), B)), sax.c2p(ga() + 3, sse(ga(), B)),
                                         color=BLUE, stroke_width=2.5))
        with self.say("c04") as d:
            self.play(Write(da[:3]), run_time=1.0)
            self.play(Write(da[3:]), Create(tan), run_time=0.9)
            self.play(Indicate(da[2], color=ORANGE), run_time=0.8)
        c1 = VGroup(zh("条件一", 26, BLUE), tex(r"\sum e_i=0", size=40, color=ORANGE)).arrange(RIGHT, buff=0.3)
        c1.move_to([RX, 0.35, 0])
        box1 = SurroundingRectangle(c1, color=BLUE, buff=0.15, corner_radius=0.08, stroke_width=2)
        with self.say("c05") as d:
            self.play(FadeIn(c1), Create(box1), run_time=0.9)

        cen = Dot(pl.p(XBAR, YBAR), radius=0.1, color=GOLD).set_z_index(5)
        mean_eq = tex(r"\bar y", "=", "a", "+", "b", r"\bar x", size=42).move_to([RX, -0.75, 0])
        mean_eq[0].set_color(GOLD); mean_eq[5].set_color(GOLD)
        with self.say("c06") as d:
            self.play(FadeOut(sp), FadeOut(spt), FadeOut(tan), run_time=0.5)
            self.play(Write(mean_eq), run_time=1.0)
            self.wait(d * 0.3)
            self.play(FadeIn(cen, scale=1.6), run_time=0.7)
        cen_lab = tex(r"(6.5,\ 77)", size=32, color=GOLD).next_to(cen, UL, buff=0.08)
        with self.say("c07") as d:
            self.play(FadeIn(cen_lab), run_time=0.7)

        sbx, sb = slice_panel([RX, -2.35, 0], "b", (1, 7), 1200, lambda v: sse(YBAR - v * XBAR, v), h=2.0)
        sbt = always_redraw(lambda: Dot(sbx.c2p(b.get_value(), sse(ga(), b.get_value())), radius=0.08, color=INK))
        self.pivot = True
        with self.say("c08") as d:
            self.play(FadeIn(sb), FadeIn(sbt), run_time=0.6)
            self.play(b.animate.set_value(2.0), run_time=d * 0.3)
            self.play(b.animate.set_value(6.0), run_time=d * 0.35)
            self.play(b.animate.set_value(B), run_time=d * 0.2)

        db = tex(r"\frac{\partial S}{\partial b}", "=", r"-2\sum x_i(y_i-a-bx_i)", "=", "0", size=36).move_to([RX, 1.45, 0])
        c2 = VGroup(zh("条件二", 26, BLUE), tex(r"\sum x_i e_i=0", size=40, color=ORANGE)).arrange(RIGHT, buff=0.3)
        c2.move_to([RX, -0.75, 0])
        box2 = SurroundingRectangle(c2, color=BLUE, buff=0.15, corner_radius=0.08, stroke_width=2)
        with self.say("c09") as d:
            self.play(FadeOut(da), FadeOut(mean_eq), run_time=0.5)
            self.play(Write(db), run_time=1.2)
            self.play(FadeIn(c2), Create(box2), run_time=0.8)

        cov = VGroup(tex(r"\sum (x_i-\bar x)\,e_i=0", size=36, color=ORANGE), zh("残差与 x 不相关", 26, BLUE)).arrange(RIGHT, buff=0.35)
        cov.move_to([RX, -1.6, 0])
        with self.say("c10") as d:
            self.play(FadeOut(sb), FadeOut(sbt), run_time=0.4)
            self.play(FadeIn(cov, shift=UP * 0.1), run_time=0.9)

        res = always_redraw(lambda: pl.residuals(ga(), b.get_value()))
        trend = zh("左边多为负、右边多为正：还有趋势", 24, RED).move_to([RX, -2.7, 0])
        with self.say("c11") as d:
            self.play(b.animate.set_value(2.0), run_time=1.0)
            self.add(res)
            self.play(FadeIn(trend), run_time=0.6)
            self.wait(d * 0.3)
            self.play(b.animate.set_value(B), FadeOut(trend), run_time=1.6)

        # 解出斜率与截距
        right = VGroup(top, db, c1, box1, c2, box2, cov)
        bf = frac(tex(r"\sum (x_i-\bar x)(y_i-\bar y)", size=38), tex(r"\sum (x_i-\bar x)^2", size=38),
                  lhs=tex(r"b=", size=44))
        bf.move_to([RX, 1.6, 0])
        af = tex(r"a", "=", r"\bar y-b\bar x", size=44).move_to([RX, 0.0, 0])
        with self.say("c12") as d:
            self.play(FadeOut(right), run_time=0.6)
            self.play(Write(bf), run_time=1.4)
            self.play(Write(af), run_time=0.9)

        bn = tex(rf"b=\frac{{{SXY:g}}}{{{SXX:g}}}=4", size=44).move_to([RX, 1.6, 0])
        an = tex(r"a=77-4\times 6.5=51", size=44).move_to([RX, 0.0, 0])
        with self.say("c13") as d:
            self.play(TransformMatchingShapes(bf, bn), run_time=1.0)
            self.wait(d * 0.3)
            self.play(TransformMatchingShapes(af, an), run_time=1.0)

        best = pl.line(A, B, color=BLUE, width=5)
        eq = tex(r"\hat y", "=", "51", "+", "4", "x", size=56, color=BLUE).move_to([RX, -1.6, 0])
        with self.say("c14") as d:
            self.play(FadeOut(res), Create(best), run_time=1.0)
            self.remove(ln)
            self.play(Write(eq), run_time=1.0)
        note = zh("数据里的关联 ≠ 多学一小时就多得 4 分", 26, SOFT).move_to([RX, -2.75, 0])
        with self.say("c15") as d:
            self.play(FadeIn(note), run_time=0.8)
        ln.clear_updaters(); res.clear_updaters()
        self.play(FadeOut(VGroup(pl.frame(), dots, best, cen, cen_lab, bn, an, eq, note)), run_time=0.8)
