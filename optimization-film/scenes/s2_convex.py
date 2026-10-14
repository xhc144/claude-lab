"""第二章：凸优化。凸集、凸函数、切线即全局下界、Lasso 的尖角、对偶的上下夹逼。"""
import numpy as np

from common import *  # noqa: F401,F403


def bumpy(x):
    return 0.12 * x ** 2 + 0.55 * np.sin(2.3 * x) + 0.35 * np.cos(4.1 * x + 0.5) + 1.6


def bowl(x):
    return 0.16 * x ** 2 + 0.4


def descend(f, x0, lo, hi, steps=400, lr=0.02):
    """沿曲线做小步梯度下降，返回路径上的横坐标序列（用于小球滚动）。"""
    xs = [x0]
    for _ in range(steps):
        g = (f(xs[-1] + 1e-4) - f(xs[-1] - 1e-4)) / 2e-4
        xs.append(np.clip(xs[-1] - lr * g * 8, lo, hi))
    return np.array(xs)


def clip_line(p0, d, rect, **kw):
    """过点 p0、方向 d 的直线在矩形 rect 内的那一段。"""
    (x0, y0), (x1, y1) = rect.get_corner(DL)[:2], rect.get_corner(UR)[:2]
    ts = []
    for lo, hi, p, v in ((x0, x1, p0[0], d[0]), (y0, y1, p0[1], d[1])):
        if abs(v) > 1e-9:
            ts.append(sorted(((lo - p) / v, (hi - p) / v)))
    a, b = max(t[0] for t in ts), min(t[1] for t in ts)
    return Line(p0 + d * a, p0 + d * b, **kw)


class S2(VScene):
    def construct(self):
        self.chapter("s2_00", "第二章", "凸优化", "什么时候，局部就是全局")
        self.two_walkers()
        self.quote()
        self.convex_sets()
        self.halfplanes()
        self.convex_fn()
        self.tangent_floor()
        self.feasible_notch()
        self.family()
        self.lasso()
        self.duality()
        self.closing()

    # ---------------------------------------------------------------
    def two_walkers(self):
        axl = Axes(x_range=[-3.2, 3.2], y_range=[0, 3.6], x_length=5.8, y_length=3.6,
                   axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).move_to([-3.5, -0.4, 0])
        axr = axl.copy().move_to([3.5, -0.4, 0])
        cl = axl.plot(bumpy, x_range=[-3.2, 3.2, 0.01], color=ORANGE, stroke_width=5)
        cr = axr.plot(bowl, x_range=[-3.2, 3.2, 0.01], color=TEAL, stroke_width=5)
        tl = T("崎岖的山地", 30, ORANGE).next_to(axl, UP, buff=0.35)
        tr = T("一只碗", 30, TEAL).next_to(axr, UP, buff=0.35)
        pl = descend(bumpy, -2.9, -3.2, 3.2)
        pr = descend(bowl, -2.9, -3.2, 3.2, lr=0.06)
        sl, sr = ValueTracker(0), ValueTracker(0)
        bl = always_redraw(lambda: Dot(axl.c2p(pl[int(sl.get_value())], bumpy(pl[int(sl.get_value())])),
                                       radius=0.12, color=YELLOW).shift(UP * 0.1))
        br = always_redraw(lambda: Dot(axr.c2p(pr[int(sr.get_value())], bowl(pr[int(sr.get_value())])),
                                       radius=0.12, color=YELLOW).shift(UP * 0.1))
        with self.say("s2_01") as d:
            self.play(Create(axl), Create(axr), Create(cl), Create(cr), FadeIn(tl), FadeIn(tr), run_time=1.8)
            self.play(FadeIn(bl), FadeIn(br), run_time=0.6)
            self.play(sl.animate.set_value(len(pl) - 1), sr.animate.set_value(len(pr) - 1),
                      run_time=d - 3.2, rate_func=rate_functions.ease_out_sine)
        xs = np.linspace(-3.2, 3.2, 4001)
        xg = xs[np.argmin(bumpy(xs))]
        qm = T("？", 44, ORANGE, weight=BOLD).next_to(bl, UP, buff=0.25)
        ll = T("只是众多小坑之一", 26, ORANGE).next_to(axl, DOWN, buff=0.25)
        deeper = Star(n=5, outer_radius=0.17, inner_radius=0.07, color=DIM, fill_opacity=1).move_to(
            axl.c2p(xg, bumpy(xg)) + UP * 0.12)
        star = Star(n=5, outer_radius=0.22, inner_radius=0.09, color=YELLOW, fill_opacity=1).move_to(br.get_center() + UP * 0.45)
        lr_ = T("一定是全局最低", 26, YELLOW, weight=BOLD).next_to(axr, DOWN, buff=0.25)
        with self.say("s2_02") as d:
            self.play(FadeIn(qm, shift=UP * 0.2), run_time=0.8)
            self.play(FadeIn(deeper, scale=0.5), FadeIn(ll), run_time=1.2)
            self.wait(d * 0.3)
            self.play(GrowFromCenter(star), FadeIn(lr_), run_time=1.2)
        self.clear_all()

    def quote(self):
        zh1 = T("优化真正的分水岭，", 46, INK, font=SERIF)
        zh2 = T("不在线性与非线性之间，", 46, INK, font=SERIF)
        zh3 = T("而在凸与非凸之间。", 46, YELLOW, font=SERIF, weight=BOLD)
        zh = VGroup(zh1, zh2, zh3).arrange(DOWN, aligned_edge=LEFT, buff=0.3).shift(UP * 0.6)
        en = T("“The great watershed in optimization isn't between linearity and nonlinearity,\n"
               "but convexity and nonconvexity.”", 22, DIM, font=SERIF).next_to(zh, DOWN, buff=0.6)
        who = T("—— R. T. Rockafellar，1993", 26, DIM).next_to(en, DOWN, buff=0.3).align_to(en, RIGHT)
        bar = Line(zh.get_corner(UL) + LEFT * 0.4 + UP * 0.1, zh.get_corner(DL) + LEFT * 0.4 + DOWN * 0.1,
                   color=YELLOW, stroke_width=4)
        with self.say("s2_03") as d:
            self.wait(d * 0.25)
            self.play(Create(bar), FadeIn(zh1, shift=RIGHT * 0.2), run_time=1.0)
            self.play(FadeIn(zh2, shift=RIGHT * 0.2), run_time=1.0)
            self.play(FadeIn(zh3, shift=RIGHT * 0.2), run_time=1.0)
            self.play(FadeIn(en), FadeIn(who), run_time=1.2)
        self.clear_all()

    def convex_sets(self):
        title = T("凸集：任意两点的连线都在集合里", 36, INK, weight=BOLD).to_edge(UP, buff=0.55)
        disk = Circle(radius=1.05, color=TEAL, fill_opacity=0.25, stroke_width=3)
        tri = Polygon([-1.1, -0.85, 0], [1.15, -0.7, 0], [-0.1, 1.15, 0], color=TEAL, fill_opacity=0.25, stroke_width=3)
        moon = Difference(Circle(radius=1.05), Circle(radius=0.95).shift(RIGHT * 0.55 + UP * 0.05),
                          color=ORANGE, fill_opacity=0.25, stroke_width=3)
        ring = Annulus(inner_radius=0.5, outer_radius=1.05, color=ORANGE, fill_opacity=0.25, stroke_width=3)
        ring.set_stroke(ORANGE, 3)
        moon_off = ORIGIN - moon.get_center()       # 月牙包围盒中心到原圆心的偏移
        shapes = VGroup(disk, tri, moon, ring).arrange(RIGHT, buff=1.1).shift(DOWN * 0.1)
        tests = [(disk, (-0.6, 0.5), (0.7, -0.55), True), (tri, (-0.75, -0.6), (0.0, 0.85), True),
                 (moon, (moon_off[0], 0.95 + moon_off[1]), (moon_off[0], -0.95 + moon_off[1]), False),
                 (ring, (-0.78, 0.0), (0.8, 0.1), False)]
        lines, marks = VGroup(), VGroup()
        for shp, a, b, ok in tests:
            o = shp.get_center()
            pa, pb = o + np.array([*a, 0]), o + np.array([*b, 0])
            seg = Line(pa, pb, color=GREEN, stroke_width=4) if ok else DashedLine(pa, pb, color=RED, stroke_width=4, dash_length=0.1)
            lines.add(VGroup(seg, Dot(pa, color=INK, radius=0.06), Dot(pb, color=INK, radius=0.06)))
            marks.add(T("凸" if ok else "非凸", 32, TEAL if ok else ORANGE, weight=BOLD).next_to(shp, DOWN, buff=0.45))
        with self.say("s2_04") as d:
            self.play(FadeIn(title, shift=DOWN * 0.2), run_time=1.0)
            self.wait(d * 0.12)
            self.play(LaggedStart(*[FadeIn(s, scale=0.9) for s in shapes], lag_ratio=0.2), run_time=1.6)
            self.play(Create(lines[0]), Create(lines[1]), run_time=1.4)
            self.play(FadeIn(marks[0]), FadeIn(marks[1]), run_time=0.8)
            self.wait(d * 0.12)
            self.play(Create(lines[2]), Create(lines[3]), run_time=1.6)
            self.play(FadeIn(marks[2]), FadeIn(marks[3]), run_time=0.8)
        self.clear_all()

    def halfplanes(self):
        title = VGroup(T("凸集", 34, TEAL, weight=BOLD), M(r"\cap", size=48), T("凸集", 34, TEAL, weight=BOLD),
                       M("=", size=48), T("凸集", 34, TEAL, weight=BOLD)).arrange(RIGHT, buff=0.25).to_edge(UP, buff=0.55)
        frame = Rectangle(width=11, height=5.6, stroke_width=0).shift(DOWN * 0.45)
        region = frame.copy().set_fill(TEAL, 0.22).set_stroke(TEAL, 0)
        cons = [((1, 0.35), 2.2), ((-0.3, 1), 1.5), ((-1, 0.2), 2.6), ((0.15, -1), 1.9), ((0.9, 0.9), 2.6)]
        lines = VGroup()
        with self.say("s2_05") as d:
            self.play(FadeIn(title, shift=DOWN * 0.2), FadeIn(region), run_time=1.0)
            for (a, b), c in cons:
                nrm = np.array([a, b, 0.0]) / np.hypot(a, b)
                p0 = frame.get_center() + nrm * (c / np.hypot(a, b))
                tdir = np.array([-nrm[1], nrm[0], 0])
                ln = clip_line(p0, tdir, frame, color=INK, stroke_width=2.5)
                hp = Polygon(p0 - tdir * 20, p0 + tdir * 20, p0 + tdir * 20 - nrm * 30, p0 - tdir * 20 - nrm * 30)
                new = Intersection(region, hp, color=TEAL, fill_opacity=0.22, stroke_width=0)
                lines.add(ln)
                self.play(Create(ln), run_time=0.6)
                self.play(Transform(region, new), ln.animate.set_stroke(opacity=0.35), run_time=0.9)
                self.wait(d * 0.03)
            self.play(region.animate.set_stroke(TEAL, 4), run_time=0.8)
        self.clear_all()

    def convex_fn(self):
        axl = Axes(x_range=[-3, 3], y_range=[0, 3.2], x_length=5.6, y_length=3.6,
                   axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).move_to([-3.4, -0.7, 0])
        axr = axl.copy().move_to([3.4, -0.7, 0])
        fb = lambda x: 0.27 * x ** 2 + 0.3
        fw = lambda x: 0.11 * x ** 4 - 0.75 * x ** 2 + 1.75
        cl = axl.plot(fb, x_range=[-3, 3, 0.01], color=TEAL, stroke_width=5)
        cr = axr.plot(fw, x_range=[-2.75, 2.75, 0.01], color=ORANGE, stroke_width=5)
        a, b = ValueTracker(-2.4), ValueTracker(0.6)

        def chord(ax, f, col):
            pa, pb = ax.c2p(a.get_value(), f(a.get_value())), ax.c2p(b.get_value(), f(b.get_value()))
            return VGroup(Line(pa, pb, color=col, stroke_width=4), Dot(pa, color=INK, radius=0.07), Dot(pb, color=INK, radius=0.07))

        chl = always_redraw(lambda: chord(axl, fb, YELLOW))
        chr_ = always_redraw(lambda: chord(axr, fw, RED))
        title = M(r"f\big(\theta x + (1-\theta) y\big) \;\le\; \theta f(x) + (1-\theta) f(y)", size=42).to_edge(UP, buff=0.5)
        tl = T("凸函数：弦在上方", 30, TEAL).next_to(axl, UP, buff=0.2)
        tr = T("非凸：弦钻到下面", 30, ORANGE).next_to(axr, UP, buff=0.2)
        with self.say("s2_06") as d:
            self.play(Create(axl), Create(cl), FadeIn(tl), run_time=1.4)
            self.play(Write(title), FadeIn(chl), run_time=1.6)
            self.play(a.animate.set_value(-0.9), b.animate.set_value(2.6), run_time=2.2)
            self.play(Create(axr), Create(cr), FadeIn(tr), run_time=1.4)
            a.set_value(-1.75)
            b.set_value(1.75)
            self.play(FadeIn(chr_), run_time=0.8)
            self.play(a.animate.set_value(-2.1), b.animate.set_value(1.3), run_time=2.4)
        self.clear_all()

    def tangent_floor(self):
        ax = Axes(x_range=[-3.2, 3.2], y_range=[-0.6, 3.4], x_length=8.4, y_length=4.4,
                  axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).shift(DOWN * 0.75)
        f = lambda x: 0.25 * (x - 0.4) ** 2 + 0.35
        df = lambda x: 0.5 * (x - 0.4)
        c = ax.plot(f, x_range=[-3.2, 3.2, 0.01], color=TEAL, stroke_width=5)
        x0 = ValueTracker(-2.2)

        def span(x_):
            """切线落在坐标区内（不低于 -0.6）的横坐标范围。"""
            lo, hi, k = -3.2, 3.2, df(x_)
            if abs(k) > 1e-9:
                xc = x_ + (-0.6 - f(x_)) / k
                lo, hi = (lo, min(hi, xc)) if k < 0 else (max(lo, xc), hi)
            return lo, hi

        def tangent(x_, col=ORANGE, w=3.5, op=1.0):
            lo, hi = span(x_)
            return Line(ax.c2p(lo, f(x_) + df(x_) * (lo - x_)), ax.c2p(hi, f(x_) + df(x_) * (hi - x_)),
                        color=col, stroke_width=w, stroke_opacity=op)

        tan = always_redraw(lambda: tangent(x0.get_value()))
        pt = always_redraw(lambda: Dot(ax.c2p(x0.get_value(), f(x0.get_value())), color=YELLOW, radius=0.09))
        ghosts = VGroup()
        t1 = T("在任意一点作切线，整条切线都在曲线下方", 32, INK).to_edge(UP, buff=0.6)
        with self.say("s2_07") as d:
            self.play(Create(ax), Create(c), FadeIn(t1, shift=DOWN * 0.2), run_time=1.6)
            self.play(FadeIn(tan), FadeIn(pt), run_time=0.6)
            for xv in np.linspace(-1.6, 2.8, 6):
                ghosts.add(tangent(x0.get_value(), col=ORANGE, w=1.5, op=0.35))
                self.add(ghosts[-1])
                self.play(x0.animate.set_value(xv), run_time=(d - 2.6) / 6, rate_func=linear)
        ineq = M(r"f(y)", r"\;\ge\;", r"f(x)", r"+", r"f'(x)", r"\,(y - x)", size=56).to_edge(UP, buff=0.55)
        ineq[2].set_color(YELLOW)
        ineq[4].set_color(ORANGE)
        b1 = Brace(VGroup(ineq[2], ineq[4]), DOWN, color=DIM, buff=0.1)
        b1t = T("只用到一个点：函数值和斜率", 26, DIM).next_to(b1, DOWN, buff=0.1)
        def shade_poly():
            x_ = x0.get_value()
            lo, hi = span(x_)
            return Polygon(ax.c2p(lo, f(x_) + df(x_) * (lo - x_)), ax.c2p(hi, f(x_) + df(x_) * (hi - x_)),
                           ax.c2p(hi, -0.6), ax.c2p(lo, -0.6), stroke_width=0, fill_color=ORANGE, fill_opacity=0.12)

        shade = always_redraw(shade_poly)
        glob = T("却给出了整条曲线的下界", 30, ORANGE, weight=BOLD).move_to([3.3, 1.0, 0])
        with self.say("s2_08") as d:
            self.play(FadeOut(ghosts), FadeOut(t1), x0.animate.set_value(-1.6), run_time=1.0)
            self.play(Write(ineq), run_time=1.8)
            self.play(GrowFromCenter(b1), FadeIn(b1t), run_time=1.0)
            self.wait(d * 0.12)
            self.add(shade, c, tan, pt)
            self.play(FadeIn(shade), run_time=1.0)
            self.play(FadeIn(glob, shift=UP * 0.2), run_time=1.0)
        hatch = always_redraw(lambda: VGroup(*[
            Line(ax.c2p(t, f(0.4)), ax.c2p(t - 0.12, f(0.4) - 0.18), color=YELLOW, stroke_width=1.5)
            for t in np.arange(-3.0, 3.2, 0.2)]).set_opacity(1 if abs(x0.get_value() - 0.4) < 0.02 else 0))
        thm = VGroup(T("导数为零的点，一定是全局最小值", 32, YELLOW, weight=BOLD),
                     T("局部最优 = 全局最优", 40, INK, weight=BOLD)).arrange(DOWN, buff=0.3)
        thm = label_box(thm, buff=0.35).to_edge(UP, buff=0.4)
        thm[0].set_stroke(YELLOW, 2)
        floor_lbl = T("地板", 28, YELLOW).next_to(ax.c2p(3.2, f(0.4)), RIGHT, buff=0.15)
        with self.say("s2_09") as d:
            self.play(FadeOut(glob), FadeOut(b1), FadeOut(b1t), run_time=0.6)
            self.play(x0.animate.set_value(0.4), run_time=2.6, rate_func=rate_functions.ease_in_out_sine)
            self.add(hatch)
            self.play(FadeIn(floor_lbl), Flash(pt, color=YELLOW), run_time=1.0)
            self.wait(d * 0.15)
            self.play(FadeOut(ineq), FadeIn(thm, shift=DOWN * 0.2), run_time=1.2)
        self.clear_all()

    def feasible_notch(self):
        region = Difference(RoundedRectangle(corner_radius=0.5, width=6.4, height=4.2),
                            Rectangle(width=3.2, height=2.6).shift(RIGHT * 1.9 + UP * 0.2),
                            color=TEAL, fill_opacity=0.22, stroke_width=3).shift(DOWN * 0.4)
        A, B = np.array([1.2, 1.4, 0]), np.array([1.2, -2.0, 0])
        pa, pb = Dot(A, color=INK), Dot(B, color=INK)
        seg = DashedLine(A, B, color=RED, stroke_width=4)
        out = T("半路出界", 28, RED).next_to(seg, RIGHT, buff=0.3)
        title = T("可行域也必须是凸的", 36, INK, weight=BOLD).to_edge(UP, buff=0.6)
        with self.say("s2_10") as d:
            self.play(FadeIn(title, shift=DOWN * 0.2), FadeIn(region), run_time=1.4)
            self.wait(d * 0.15)
            self.play(FadeIn(pa), FadeIn(pb), run_time=0.6)
            self.play(Create(seg), run_time=1.6)
            self.play(FadeIn(out), run_time=0.8)
        self.clear_all()

    def family(self):
        def card(title, art, col):
            box = RoundedRectangle(corner_radius=0.2, width=3.0, height=2.7, stroke_color=col, stroke_width=2.5,
                                   fill_color=BG, fill_opacity=1)
            art.move_to(box.get_center() + UP * 0.3)
            t = T(title, 28, INK, weight=BOLD).move_to(box.get_bottom() + UP * 0.4)
            return VGroup(box, art, t)

        rng = np.random.default_rng(2)
        xs = np.linspace(-1, 1, 12)
        ys = 0.55 * xs + rng.normal(0, 0.18, xs.size)
        ls = VGroup(*[Dot([x, y * 0.8, 0], radius=0.05, color=BLUE) for x, y in zip(xs, ys)],
                    Line([-1.15, -0.55, 0], [1.15, 0.55, 0], color=YELLOW, stroke_width=3))
        pie = VGroup(*[AnnularSector(inner_radius=0, outer_radius=0.75, angle=a1, start_angle=a0, color=c, fill_opacity=0.8)
                       for a0, a1, c in [(0, 2.2, BLUE), (2.2, 2.4, TEAL), (4.6, 1.68, ORANGE)]])
        pos = VGroup(*[Dot([x, y, 0], radius=0.06, color=TEAL) for x, y in [(-0.9, 0.6), (-0.6, 0.15), (-0.3, 0.75), (-0.95, -0.1)]])
        neg = VGroup(*[Dot([x, y, 0], radius=0.06, color=ORANGE) for x, y in [(0.5, -0.5), (0.85, 0.05), (0.3, -0.85), (0.95, -0.7)]])
        svm = VGroup(pos, neg, Line([-0.55, -1.0, 0], [0.45, 1.0, 0], color=YELLOW, stroke_width=3),
                     DashedLine([-0.95, -0.9, 0], [0.05, 1.1, 0], color=DIM, stroke_width=1.5),
                     DashedLine([-0.15, -1.1, 0], [0.85, 0.9, 0], color=DIM, stroke_width=1.5))
        lp = Polygon([-0.9, -0.7, 0], [0.6, -0.8, 0], [1.0, 0.1, 0], [0.2, 0.85, 0], [-0.8, 0.5, 0],
                     color=TEAL, fill_opacity=0.25, stroke_width=3)
        cards = VGroup(card("最小二乘", ls, BLUE), card("投资组合", pie, TEAL), card("支持向量机", svm, ORANGE),
                       card("线性规划", lp, YELLOW)).arrange(RIGHT, buff=0.35).shift(UP * 0.35)
        banner = T("可靠的算法 · 保证找到全局最优", 34, YELLOW, weight=BOLD).next_to(cards, DOWN, buff=0.55)
        with self.say("s2_11") as d:
            for cd in cards:
                self.play(FadeIn(cd, shift=UP * 0.3), run_time=0.8)
                self.wait(d * 0.1)
            self.play(FadeIn(banner, shift=UP * 0.2), run_time=1.0)
        self.clear_all()

    def lasso(self):
        ax = Axes(x_range=[-1.6, 4.6, 1], y_range=[-1.6, 3.4, 1], x_length=6.2, y_length=5.0,
                  axis_config={"color": DIM, "include_ticks": False, "include_tip": True}).move_to([-3.6, 0.1, 0])
        xl = M(r"\beta_1", size=36).next_to(ax.x_axis.get_end(), DOWN, buff=0.15)
        yl = M(r"\beta_2", size=36).next_to(ax.y_axis.get_end(), LEFT, buff=0.15)
        t = 1.2
        dia = Polygon(ax.c2p(t, 0), ax.c2p(0, t), ax.c2p(-t, 0), ax.c2p(0, -t), color=TEAL, fill_opacity=0.25, stroke_width=3)
        cir = Circle(radius=ax.c2p(t, 0)[0] - ax.c2p(0, 0)[0], color=PURPLE, fill_opacity=0.22, stroke_width=3).move_to(ax.c2p(0, 0))
        c = np.array([2.2, 1.0])
        th = np.deg2rad(-45)
        R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])

        def ellipse(r, col=BLUE, w=2.5, op=1.0):
            s = np.linspace(0, 2 * np.pi, 160)
            pts = (c[:, None] + R @ np.vstack([r * np.cos(s), r / 2 * np.sin(s)])).T
            return VMobject(stroke_color=col, stroke_width=w, stroke_opacity=op).set_points_smoothly(
                [ax.c2p(x, y) for x, y in pts])

        center = Dot(ax.c2p(*c), color=BLUE, radius=0.07)
        cl = T("误差最小处", 22, BLUE).next_to(center, UP, buff=0.12)
        rr = ValueTracker(0.15)
        ell = always_redraw(lambda: ellipse(rr.get_value(), col=YELLOW, w=4))
        rings = VGroup(*[ellipse(r, op=0.35) for r in (0.7, 1.4, 2.1)])
        eq = VGroup(T("限制", 28), M(r"|\beta_1| + |\beta_2| \le t", size=40, color=TEAL)).arrange(RIGHT, buff=0.2)
        eq.move_to([3.5, 2.7, 0])
        info = VGroup(T("约束区域是菱形", 28, TEAL), T("尖角落在坐标轴上", 28, TEAL)).arrange(DOWN, buff=0.15).next_to(eq, DOWN, buff=0.35)
        with self.say("s2_12") as d:
            self.play(Create(ax), FadeIn(xl), FadeIn(yl), run_time=1.2)
            self.play(Write(eq), DrawBorderThenFill(dia), run_time=1.8)
            self.play(FadeIn(info), run_time=0.8)
            self.wait(d * 0.08)
            self.play(FadeIn(center), FadeIn(cl), Create(rings), run_time=1.6)
            self.add(ell)
            self.play(rr.animate.set_value(2.828), run_time=d * 0.38, rate_func=rate_functions.ease_in_out_sine)
            hit = Dot(ax.c2p(t, 0), color=YELLOW, radius=0.11)
            hl = label_box(M(r"\beta_2 = 0", size=40, color=YELLOW), buff=0.06).next_to(hit, DL, buff=0.12)
            self.play(FadeIn(hit, scale=0.5), Flash(hit, color=YELLOW), run_time=0.8)
            self.play(Write(hl), run_time=1.0)
        self.remove(ell)
        ell_d = ellipse(2.828, col=YELLOW, w=4)
        self.add(ell_d)
        sparse = VGroup(T("L1 菱形：自动挑出少数有用的变量", 26, YELLOW),
                        T("其余的系数被压成零", 26, YELLOW)).arrange(DOWN, buff=0.12).next_to(info, DOWN, buff=0.5)
        rr.set_value(2.254)
        ell_c = ellipse(2.254, col=PURPLE, w=4)
        p2 = Dot(ax.c2p(0.968, 0.709), color=PURPLE, radius=0.1)
        l2 = VGroup(T("L2 圆形：没有尖角", 26, PURPLE),
                    T("系数变小，却很少恰好为零", 26, PURPLE)).arrange(DOWN, buff=0.12).next_to(sparse, DOWN, buff=0.35)
        with self.say("s2_13") as d:
            self.play(FadeIn(sparse, shift=UP * 0.2), run_time=1.0)
            self.wait(d * 0.15)
            self.play(FadeIn(cir), Create(ell_c), run_time=1.6)
            self.play(FadeIn(p2, scale=0.5), Flash(p2, color=PURPLE), run_time=0.8)
            self.play(FadeIn(l2, shift=UP * 0.2), run_time=1.0)
        self.clear_all()

    def duality(self):
        axis = NumberLine(x_range=[0, 10, 1], length=6.2, rotation=PI / 2, color=DIM, include_ticks=False).shift(LEFT * 2.3 + DOWN * 0.3)
        vl = T("目标值", 26, DIM).next_to(axis, UP, buff=0.2)
        star_y = 5.0
        opt = DashedLine(axis.n2p(star_y) + LEFT * 2.6, axis.n2p(star_y) + RIGHT * 6.8, color=YELLOW, stroke_width=2.5)
        ol = M(r"p^\ast", size=40, color=YELLOW).next_to(opt, RIGHT, buff=0.15)
        ups = [9.4, 8.1, 7.1, 6.3, 5.75, 5.35, 5.12, 5.03]
        lows = [0.6, 2.1, 3.1, 3.85, 4.4, 4.75, 4.93, 4.99]
        xs = np.linspace(-1.3, 5.6, len(ups))
        up_d = VGroup(*[Dot([axis.get_center()[0] + 1.0 + x, axis.n2p(v)[1], 0], color=ORANGE, radius=0.08) for x, v in zip(xs, ups)])
        lo_d = VGroup(*[Dot([axis.get_center()[0] + 1.0 + x, axis.n2p(v)[1], 0], color=TEAL, radius=0.08) for x, v in zip(xs, lows)])
        up_l = VMobject(stroke_color=ORANGE, stroke_width=2.5).set_points_smoothly([d.get_center() for d in up_d])
        lo_l = VMobject(stroke_color=TEAL, stroke_width=2.5).set_points_smoothly([d.get_center() for d in lo_d])
        tu = T("原问题的可行解：从上方压下来", 26, ORANGE).move_to([2.6, 3.3, 0])
        tl = T("对偶给出的地板：从下方托上去", 26, TEAL).move_to([2.6, -3.0, 0])
        title = T("对偶", 40, INK, weight=BOLD).to_corner(UL, buff=0.6)
        with self.say("s2_14") as d:
            self.play(FadeIn(title), Create(axis), FadeIn(vl), run_time=1.2)
            self.play(Create(opt), FadeIn(ol), run_time=1.0)
            self.wait(d * 0.15)
            self.play(LaggedStart(*[FadeIn(p, shift=DOWN * 0.3) for p in up_d[:4]], lag_ratio=0.3),
                      FadeIn(tu), run_time=2.2)
            self.play(LaggedStart(*[FadeIn(p, shift=UP * 0.3) for p in lo_d[:4]], lag_ratio=0.3), FadeIn(tl), run_time=2.2)
        gl = T("间隙", 24, DIM).next_to(up_d[3], RIGHT, buff=0.6).shift(DOWN * 0.7)
        cert = label_box(VGroup(T("上下相等 ⟹ 最优性证书", 32, YELLOW, weight=BOLD),
                                T("这个解不可能再好了", 26, INK)).arrange(DOWN, buff=0.15), buff=0.3).move_to([3.6, 1.55, 0])
        cert[0].set_stroke(YELLOW, 2)
        with self.say("s2_15") as d:
            g = BraceBetweenPoints(up_d[3].get_center() + RIGHT * 0.25, lo_d[3].get_center() + RIGHT * 0.25, direction=RIGHT, color=DIM)
            self.play(GrowFromCenter(g), FadeIn(gl), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(p) for p in up_d[4:]], lag_ratio=0.3),
                      LaggedStart(*[FadeIn(p) for p in lo_d[4:]], lag_ratio=0.3),
                      FadeOut(g), FadeOut(gl), run_time=3.0)
            self.play(Create(up_l), Create(lo_l), run_time=1.4)
            meet = Dot(up_d[-1].get_center(), color=YELLOW, radius=0.13)
            self.play(FadeIn(meet, scale=0.4), Flash(meet, color=YELLOW), run_time=0.9)
            self.wait(d * 0.12)
            self.play(FadeIn(cert, shift=UP * 0.2), run_time=1.0)
        self.clear_all()

    def closing(self):
        ax = Axes(x_range=[-3.2, 3.2], y_range=[0, 3.6], x_length=8.6, y_length=4.2,
                  axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).shift(DOWN * 0.7)
        c = ax.plot(bumpy, x_range=[-3.2, 3.2, 0.01], color=ORANGE, stroke_width=5)
        xs = np.linspace(-3.2, 3.2, 801)
        ys = bumpy(xs)
        # 下凸包络：所有在曲线下方的凸函数里最高的那个
        pts = list(zip(xs, ys))
        hull = []
        for p in pts:
            while len(hull) >= 2 and (hull[-1][0] - hull[-2][0]) * (p[1] - hull[-2][1]) - (hull[-1][1] - hull[-2][1]) * (p[0] - hull[-2][0]) <= 0:
                hull.pop()
            hull.append(p)
        env = VMobject(stroke_color=TEAL, stroke_width=4).set_points_as_corners([ax.c2p(x, y) for x, y in hull])
        env = DashedVMobject(env, num_dashes=60)
        el = T("凸的近似", 28, TEAL).next_to(ax.c2p(2.2, 0.9), RIGHT, buff=0.1)
        msg = T("凸性告诉我们：什么时候局部就是全局", 36, YELLOW, weight=BOLD).to_edge(UP, buff=0.7)
        nn = T("非凸：比如训练神经网络", 28, ORANGE).next_to(ax.c2p(-3.0, 3.4), RIGHT, buff=0.1)
        with self.say("s2_16", tail=1.0) as d:
            self.play(Create(ax), Create(c), FadeIn(nn), run_time=1.6)
            self.wait(d * 0.12)
            self.play(Create(env), FadeIn(el), run_time=2.2)
            self.wait(d * 0.2)
            self.play(FadeIn(msg, shift=DOWN * 0.2), run_time=1.2)
        self.clear_all(0.9)
