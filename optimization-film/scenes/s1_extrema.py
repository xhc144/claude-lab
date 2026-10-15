"""第一章：极值与不等式。导数看局部，不等式给全局的地板，乘子是约束的价格。"""
import numpy as np

from common import *  # noqa: F401,F403


class S1A(VScene):
    """铁皮盒子：建模、导数为零、立方函数的反例。"""

    def construct(self):
        self.chapter("s1_00", "第一章", "极值与不等式", "怎样找到最好，又怎样证明它最好")
        x = ValueTracker(1.0)
        S = 2.7                       # 铁皮在画面上的边长（对应实际边长 6）
        k = S / 6
        o = np.array([-4.7, 1.55, 0])

        def net():
            c = x.get_value() * k
            sheet = Square(S, stroke_color=DIM, stroke_width=2, fill_color=BLUE, fill_opacity=0.18).move_to(o)
            cuts = VGroup(*[Square(c, stroke_color=RED, stroke_width=2, fill_color=BG, fill_opacity=1)
                            .move_to(o + np.array([sx * (S - c) / 2, sy * (S - c) / 2, 0]))
                            for sx in (-1, 1) for sy in (-1, 1)])
            folds = VGroup(*[DashedLine(o + np.array([sx * (S / 2 - c), -S / 2, 0]), o + np.array([sx * (S / 2 - c), S / 2, 0]),
                                        stroke_width=1.5, color=DIM, dash_length=0.08) for sx in (-1, 1)],
                           *[DashedLine(o + np.array([-S / 2, sy * (S / 2 - c), 0]), o + np.array([S / 2, sy * (S / 2 - c), 0]),
                                        stroke_width=1.5, color=DIM, dash_length=0.08) for sy in (-1, 1)])
            return VGroup(sheet, folds, cuts)

        def box():
            v = x.get_value()
            b, h = (6 - 2 * v) * k * 0.9, v * k * 0.9
            d = np.array([0.42, 0.3, 0]) * b / (4 * k * 0.9)
            p0 = np.array([-4.7 - b / 2 - d[0] / 2, -1.9, 0])
            front = Polygon(p0, p0 + RIGHT * b, p0 + RIGHT * b + UP * h, p0 + UP * h,
                            stroke_color=BLUE, stroke_width=2.5, fill_color=BLUE, fill_opacity=0.35)
            side = Polygon(p0 + RIGHT * b, p0 + RIGHT * b + d, p0 + RIGHT * b + d + UP * h, p0 + RIGHT * b + UP * h,
                           stroke_color=BLUE, stroke_width=2.5, fill_color=BLUE, fill_opacity=0.22)
            back = DashedVMobject(Polygon(p0 + UP * h, p0 + UP * h + d, p0 + RIGHT * b + d + UP * h, p0 + RIGHT * b + UP * h),
                                  num_dashes=24, color=BLUE)
            top_l = Line(p0 + UP * h, p0 + UP * h + d, color=BLUE, stroke_width=2.5)
            top_b = Line(p0 + UP * h + d, p0 + RIGHT * b + d + UP * h, color=BLUE, stroke_width=2.5)
            return VGroup(front, side, back, top_l, top_b)

        net_m, box_m = always_redraw(net), always_redraw(box)
        side_lbl = M(r"6", size=34, color=DIM).next_to(o + LEFT * S / 2, LEFT, buff=0.15)
        cut_lbl = always_redraw(lambda: M(r"x", size=34, color=RED).next_to(
            o + np.array([S / 2 - x.get_value() * k / 2, S / 2, 0]), UP, buff=0.1))
        vol = M(r"V(x) = x\,(6-2x)^2", size=44).move_to([2.2, 3.05, 0])
        q = T("剪多大，容积最大？", 34, YELLOW).move_to([2.2, 2.1, 0])

        with self.say("s1_01") as d:
            self.play(FadeIn(net_m), FadeIn(side_lbl), run_time=1.2)
            self.play(FadeIn(cut_lbl), run_time=0.8)
            self.wait(d * 0.18)
            self.play(FadeIn(box_m, shift=UP * 0.3), run_time=1.4)
            self.wait(d * 0.15)
            self.play(Write(vol), run_time=1.6)
            self.play(FadeIn(q, shift=UP * 0.2), run_time=1.0)

        ax = Axes(x_range=[0, 3.3, 1], y_range=[0, 18, 4], x_length=6.4, y_length=4.0,
                  axis_config={"color": DIM, "include_tip": False, "font_size": 26},
                  x_axis_config={"numbers_to_include": [1, 2, 3]},
                  y_axis_config={"numbers_to_include": [4, 8, 12, 16]}).move_to([2.4, -1.0, 0])
        xl = ax.get_x_axis_label(M("x", size=34), edge=RIGHT, direction=DOWN)
        yl = ax.get_y_axis_label(M("V", size=34), edge=UP, direction=LEFT)
        V = lambda t: t * (6 - 2 * t) ** 2
        graph = ax.plot(V, x_range=[0, 3, 0.01], color=BLUE, stroke_width=4)
        dot = always_redraw(lambda: Dot(ax.c2p(x.get_value(), V(x.get_value())), color=YELLOW, radius=0.09))
        trace = always_redraw(lambda: ax.plot(V, x_range=[0, max(x.get_value(), 0.011), 0.01], color=BLUE, stroke_width=4))
        with self.say("s1_02") as d:
            self.play(FadeOut(q), Create(ax), FadeIn(xl), FadeIn(yl), run_time=1.2)
            x.set_value(0.01)
            self.add(trace, dot)
            self.play(x.animate.set_value(2.9), run_time=d - 2.4, rate_func=rate_functions.ease_in_out_sine)
        self.remove(trace)
        self.add(graph, dot)

        def tangent():
            t = x.get_value()
            sl = (V(t + 1e-4) - V(t - 1e-4)) / 2e-4
            p0 = ax.c2p(t, V(t))
            dv = ax.c2p(t + 1, V(t) + sl) - p0
            dv /= np.linalg.norm(dv)
            return Line(p0 - dv * 1.6, p0 + dv * 1.6, color=ORANGE, stroke_width=4)

        tan = always_redraw(tangent)
        d1 = M(r"V'(x) = (6-2x)(6-6x) = 0", size=40).move_to([2.2, 2.3, 0])
        ans = M(r"x = 1,\quad V_{\max} = 16", size=44, color=YELLOW).next_to(d1, DOWN, buff=0.2)
        with self.say("s1_03") as d:
            self.play(x.animate.set_value(0.3), run_time=1.2)
            self.play(FadeIn(tan), run_time=0.6)
            self.play(x.animate.set_value(1.0), run_time=3.4, rate_func=rate_functions.ease_out_sine)
            flat = DashedLine(ax.c2p(0.2, 16), ax.c2p(1.8, 16), color=YELLOW, stroke_width=2)
            self.play(Create(flat), Flash(dot, color=YELLOW), run_time=1.0)
            self.wait(d * 0.12)
            self.play(Write(d1), run_time=1.6)
            self.play(FadeIn(ans, shift=UP * 0.2), run_time=1.0)
        self.clear_all()

        ax3 = Axes(x_range=[-1.6, 1.6, 1], y_range=[-3, 3, 1], x_length=6, y_length=5,
                   axis_config={"color": FAINT, "include_ticks": False}).shift(DOWN * 0.35)
        cub = ax3.plot(lambda t: t ** 3 * 0.75, color=BLUE, stroke_width=5)
        flat0 = Line(ax3.c2p(-0.9, 0), ax3.c2p(0.9, 0), color=ORANGE, stroke_width=4)
        lab = M(r"y = x^3", size=44, color=BLUE).move_to(ax3.c2p(1.0, 2.6))
        msg = VGroup(M(r"f'(x)=0", size=48), T("不一定是极值", 36, ORANGE, weight=BOLD)).arrange(RIGHT, buff=0.4)
        msg.to_edge(UP, buff=0.5)
        p = ValueTracker(-1.4)
        mover = always_redraw(lambda: Dot(ax3.c2p(p.get_value(), 0.75 * p.get_value() ** 3), color=YELLOW, radius=0.1))
        with self.say("s1_04") as d:
            self.play(Create(ax3), Create(cub), FadeIn(lab), run_time=1.6)
            self.play(Write(msg[0]), run_time=1.0)
            self.wait(d * 0.12)
            self.play(Create(flat0), run_time=0.8)
            self.add(mover)
            self.play(p.animate.set_value(1.4), run_time=4.0, rate_func=rate_functions.ease_in_out_sine)
            self.play(FadeIn(msg[1], shift=LEFT * 0.2), run_time=0.8)
        self.clear_all()


class S1B(VScene, ThreeDScene):
    """二维的鞍点：沿一个方向是谷底，沿另一个方向是山顶。"""

    def construct(self):
        self.set_camera_orientation(phi=62 * DEGREES, theta=-50 * DEGREES, zoom=1.05)
        axes = ThreeDAxes(x_range=[-1.8, 1.8], y_range=[-1.8, 1.8], z_range=[-1.5, 1.5], x_length=6, y_length=6,
                          z_length=3.6, axis_config={"color": FAINT, "include_ticks": False})
        f = lambda u, v: 0.55 * (u ** 2 - v ** 2)
        surf = Surface(lambda u, v: axes.c2p(u, v, f(u, v)), u_range=[-1.5, 1.5], v_range=[-1.5, 1.5],
                       resolution=(30, 30), should_make_jagged=False)
        surf.set_style(fill_opacity=0.75, stroke_width=0.4, stroke_color=BLUE_E)
        surf.set_fill_by_value(axes=axes, colorscale=[(PURPLE, -1.2), (BLUE, 0), (TEAL, 1.2)], axis=2)
        cx = ParametricFunction(lambda t: axes.c2p(t, 0, f(t, 0)), t_range=[-1.5, 1.5], color=YELLOW, stroke_width=6)
        cy = ParametricFunction(lambda t: axes.c2p(0, t, f(0, t)), t_range=[-1.5, 1.5], color=RED, stroke_width=6)
        dot = Dot3D(axes.c2p(0, 0, 0), radius=0.1, color=INK)
        title = T("鞍点", 48, INK, weight=BOLD).to_edge(UP, buff=0.45)
        l1 = T("沿黄线：最低点", 30, YELLOW).to_corner(UL, buff=0.8).shift(DOWN * 0.6)
        l2 = T("沿红线：最高点", 30, RED).to_corner(UR, buff=0.8).shift(DOWN * 0.6)
        l3 = VGroup(M(r"\nabla f = 0", size=40), T("只说明这里是平的", 30, DIM)).arrange(RIGHT, buff=0.3)
        l3.move_to(DOWN * 2.75)
        for m in (title, l1, l2, l3):
            self.add_fixed_in_frame_mobjects(m)
            self.remove(m)
        with self.say("s1_05", tail=0.6) as d:
            self.play(Create(axes), FadeIn(surf), FadeIn(title), run_time=1.8)
            self.begin_ambient_camera_rotation(rate=0.06)
            self.play(Create(cx), FadeIn(l1), run_time=1.6)
            self.wait(d * 0.1)
            self.play(Create(cy), FadeIn(l2), run_time=1.6)
            self.play(FadeIn(dot), run_time=0.6)
            self.wait(d * 0.15)
            self.play(FadeIn(l3), run_time=1.0)
        self.stop_ambient_camera_rotation()
        self.play(FadeOut(VGroup(axes, surf, cx, cy, dot)), FadeOut(VGroup(title, l1, l2, l3)), run_time=0.8)


class S1C(VScene):
    """地板、均值不等式、取等陷阱、拉格朗日乘子、墙与小球。"""

    def construct(self):
        self.floor()
        self.amgm()
        self.box_by_amgm()
        self.trap()
        self.lagrange()
        self.wall()
        self.summary()

    def floor(self):
        ax = Axes(x_range=[-2.2, 3.2, 1], y_range=[-1, 3.6, 1], x_length=8, y_length=4.3,
                  axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).shift(DOWN * 0.9)
        f = lambda t: 0.28 * (t - 0.6) ** 2 + 0.35 * np.cos(1.9 * t) + 1.2
        g = ax.plot(f, x_range=[-2.2, 3.2, 0.01], color=BLUE, stroke_width=5)
        xs = np.linspace(-2.2, 3.2, 3001)
        xm = xs[np.argmin(f(xs))]
        m = f(xm)
        h = ValueTracker(-0.6)
        fl = always_redraw(lambda: VGroup(
            Line(ax.c2p(-2.2, h.get_value()), ax.c2p(3.2, h.get_value()), color=YELLOW, stroke_width=4),
            *[Line(ax.c2p(a, h.get_value()), ax.c2p(a - 0.14, h.get_value() - 0.22), color=YELLOW, stroke_width=1.5)
              for a in np.arange(-2.1, 3.2, 0.2)]))
        lab = always_redraw(lambda: T("地板", 28, YELLOW).next_to(ax.c2p(3.2, h.get_value()), RIGHT, buff=0.2))
        with self.say("s1_06") as d:
            self.play(Create(ax), Create(g), run_time=1.6)
            self.wait(d * 0.3)
            self.play(FadeIn(fl), FadeIn(lab), run_time=1.0)
        s1 = VGroup(T("①", 32, YELLOW), T("证明处处不低于地板", 32), M(r"f(x) \ge m", size=40)).arrange(RIGHT, buff=0.3)
        s2 = VGroup(T("②", 32, YELLOW), T("找到一点恰好踩上去", 32), M(r"f(x_0) = m", size=40)).arrange(RIGHT, buff=0.3)
        steps = VGroup(s1, s2).arrange(DOWN, aligned_edge=LEFT, buff=0.3).to_edge(UP, buff=0.4)
        concl = VGroup(M(r"\Longrightarrow", size=44), T("地板的高度就是全局最小值", 32, YELLOW, weight=BOLD)
                       ).arrange(RIGHT, buff=0.3).next_to(steps, DOWN, buff=0.25)
        touch = Dot(ax.c2p(xm, m), color=YELLOW, radius=0.11)
        with self.say("s1_07") as d:
            self.play(FadeIn(s1, shift=DOWN * 0.2), h.animate.set_value(m - 0.55), run_time=1.6)
            self.wait(d * 0.2)
            self.play(FadeIn(s2, shift=DOWN * 0.2), run_time=1.0)
            self.play(h.animate.set_value(m), run_time=2.2, rate_func=rate_functions.ease_out_cubic)
            self.play(FadeIn(touch, scale=0.5), Flash(touch, color=YELLOW), run_time=0.8)
            self.wait(d * 0.08)
            self.play(FadeIn(concl, shift=UP * 0.2), run_time=1.0)
        self.clear_all()

    def amgm(self):
        R = 2.9
        c = np.array([-2.5, -1.85, 0])
        a = ValueTracker(1.5)          # 左段长度（画面单位），总长 2R
        arc = Arc(radius=R, start_angle=0, angle=PI, arc_center=c, color=DIM, stroke_width=3)
        dia = Line(c + LEFT * R, c + RIGHT * R, color=DIM, stroke_width=3)

        def split():
            return c + LEFT * R + RIGHT * a.get_value()

        def chord():
            p = split()
            hh = np.sqrt(max(R ** 2 - (p[0] - c[0]) ** 2, 0))
            return Line(p, p + UP * hh, color=YELLOW, stroke_width=6)

        def radius():
            p = split()
            hh = np.sqrt(max(R ** 2 - (p[0] - c[0]) ** 2, 0))
            ang = np.arctan2(hh, p[0] - c[0])
            return Line(c, c + R * np.array([np.cos(ang), np.sin(ang), 0]), color=BLUE, stroke_width=5)

        ch, rd = always_redraw(chord), always_redraw(radius)
        tri = always_redraw(lambda: VGroup(
            DashedLine(c + LEFT * R, chord().get_end(), color=FAINT, stroke_width=2),
            DashedLine(c + RIGHT * R, chord().get_end(), color=FAINT, stroke_width=2)))
        ba = always_redraw(lambda: Brace(Line(c + LEFT * R, split()), DOWN, color=ORANGE, buff=0.08))
        bb = always_redraw(lambda: Brace(Line(split(), c + RIGHT * R), DOWN, color=ORANGE, buff=0.08))
        la = always_redraw(lambda: M("a", size=40, color=ORANGE).next_to(ba, DOWN, buff=0.08))
        lb = always_redraw(lambda: M("b", size=40, color=ORANGE).next_to(bb, DOWN, buff=0.08))
        lc = always_redraw(lambda: M(r"\sqrt{ab}", size=42, color=YELLOW).next_to(
            chord(), RIGHT if split()[0] >= c[0] else LEFT, buff=0.15))
        def rlabel():
            ln = radius()
            dv = ln.get_end() - ln.get_start()
            dv /= np.linalg.norm(dv)
            side = 1 if dv[0] >= 0 else -1
            perp = np.array([-dv[1], dv[0], 0]) * side
            return M(r"\tfrac{a+b}{2}", size=42, color=BLUE).move_to(ln.get_center() + perp * 0.5)

        lr = always_redraw(rlabel)
        eq = M(r"\frac{a+b}{2}", r"\;\ge\;", r"\sqrt{ab}", size=64).move_to([4.0, 1.6, 0])
        eq[0].set_color(BLUE)
        eq[2].set_color(YELLOW)
        names = VGroup(T("算术平均", 28, BLUE), T("几何平均", 28, YELLOW))
        names[0].next_to(eq[0], DOWN, buff=0.3)
        names[1].next_to(eq[2], DOWN, buff=0.3)
        with self.say("s1_08") as d:
            self.play(Write(eq), FadeIn(names), run_time=1.8)
            self.wait(d * 0.15)
            self.play(Create(dia), Create(arc), run_time=1.4)
            self.play(GrowFromEdge(ba, LEFT), GrowFromEdge(bb, RIGHT), FadeIn(la), FadeIn(lb), run_time=1.0)
            self.play(Create(ch), FadeIn(lc), FadeIn(tri), run_time=1.2)
            self.wait(d * 0.12)
            self.play(Create(rd), FadeIn(lr), run_time=1.2)
            self.play(a.animate.set_value(0.6), run_time=2.0, rate_func=rate_functions.ease_in_out_sine)
            self.play(a.animate.set_value(4.4), run_time=3.0, rate_func=rate_functions.ease_in_out_sine)
        eqc = T("相等时取等号", 30, INK).next_to(names, DOWN, buff=0.5)
        with self.say("s1_09") as d:
            self.play(a.animate.set_value(R), run_time=2.4, rate_func=rate_functions.ease_in_out_sine)
            self.play(Indicate(eq[1], color=YELLOW, scale_factor=1.3), FadeIn(eqc), run_time=1.4)
        self.clear_all()

    def box_by_amgm(self):
        l1 = M(r"4V", r"=", r"4x", r"\cdot", r"(6-2x)", r"\cdot", r"(6-2x)", size=54)
        l2 = M(r"4x", r"+", r"(6-2x)", r"+", r"(6-2x)", r"=", r"12", size=54)
        l3 = M(r"4V", r"\le", r"\left(\tfrac{12}{3}\right)^{3}", r"=", r"64", r"\;\Longrightarrow\;", r"V \le 16", size=54)
        l4 = M(r"4x = 6-2x", r"\;\Longrightarrow\;", r"x = 1", size=54)
        lines = VGroup(l1, l2, l3, l4).arrange(DOWN, buff=0.5).shift(UP * 0.4)
        for part in (l1[2], l2[0]):
            part.set_color(ORANGE)
        for part in (l1[4], l1[6], l2[2], l2[4]):
            part.set_color(BLUE)
        l2[6].set_color(YELLOW)
        l3[6].set_color(YELLOW)
        l4[2].set_color(YELLOW)
        tags = VGroup(T("和是常数", 26, YELLOW).next_to(l2, RIGHT, buff=0.4),
                      T("和一定，积有上限", 26, DIM).next_to(l3, RIGHT, buff=0.4),
                      T("三个数相等", 26, DIM).next_to(l4, RIGHT, buff=0.4))
        badge = VGroup(T("答案", 32, YELLOW, weight=BOLD), T("+", 32, DIM), T("证明", 32, YELLOW, weight=BOLD)
                       ).arrange(RIGHT, buff=0.25)
        badge = label_box(badge, buff=0.3).set_z_index(3).to_edge(DOWN, buff=1.15)
        badge[0].set_stroke(YELLOW, 2)
        with self.say("s1_10") as d:
            self.play(Write(l1), run_time=2.0)
            self.wait(d * 0.08)
            self.play(TransformFromCopy(VGroup(l1[2], l1[4], l1[6]), VGroup(l2[0], l2[2], l2[4])),
                      FadeIn(VGroup(l2[1], l2[3], l2[5])), run_time=1.6)
            self.play(Write(l2[6]), FadeIn(tags[0]), run_time=1.0)
            self.wait(d * 0.12)
            self.play(Write(l3), FadeIn(tags[1]), run_time=2.2)
            self.wait(d * 0.12)
            self.play(Write(l4), FadeIn(tags[2]), run_time=1.8)
            self.play(FadeIn(badge, scale=0.9), run_time=1.0)
        self.clear_all()

    def trap(self):
        ax = Axes(x_range=[0, 7, 1], y_range=[0, 8, 2], x_length=8.4, y_length=4.6,
                  axis_config={"color": DIM, "include_tip": False, "font_size": 26},
                  x_axis_config={"numbers_to_include": [1, 2, 3, 4, 5, 6]},
                  y_axis_config={"numbers_to_include": [2, 4, 6]}).shift(DOWN * 0.55 + LEFT * 0.4)
        f = lambda t: t + 4 / t
        g = ax.plot(f, x_range=[0.6, 7, 0.01], color=BLUE, stroke_width=5)
        lab = M(r"f(x) = x + \frac{4}{x}", size=44, color=BLUE).move_to(ax.c2p(4.0, 7.3))
        floor = DashedLine(ax.c2p(0, 4), ax.c2p(7, 4), color=YELLOW, stroke_width=3)
        fl_l = M(r"f(x)\ge 4", size=36, color=YELLOW).next_to(ax.c2p(7, 4), RIGHT, buff=0.15)
        p2 = Dot(ax.c2p(2, 4), color=YELLOW, radius=0.09)
        p2l = M(r"x=2", size=32, color=YELLOW).next_to(p2, DOWN, buff=0.15)
        ban = Rectangle(width=ax.c2p(3, 0)[0] - ax.c2p(0, 0)[0], height=4.6, stroke_width=0,
                        fill_color=RED, fill_opacity=0.12).move_to(ax.c2p(1.5, 4))
        ban_l = M(r"x \ge 3", size=40, color=RED).move_to(ax.c2p(1.5, 7.2))
        p3 = Dot(ax.c2p(3, 13 / 3), color=ORANGE, radius=0.11)
        p3l = M(r"\min = f(3) = \tfrac{13}{3}", size=40, color=ORANGE).move_to(ax.c2p(4.6, 2.6))
        p3a = Arrow(p3l.get_left() + LEFT * 0.05, p3.get_center(), buff=0.15, color=ORANGE, stroke_width=3,
                    max_tip_length_to_length_ratio=0.2)
        hang = T("地板悬在半空", 28, YELLOW).move_to(ax.c2p(5.6, 4.55))
        with self.say("s1_11") as d:
            self.play(Create(ax), Create(g), FadeIn(lab), run_time=1.8)
            self.play(Create(floor), FadeIn(fl_l), run_time=1.2)
            self.play(FadeIn(p2), FadeIn(p2l), run_time=0.8)
            self.wait(d * 0.12)
            self.play(FadeIn(ban), FadeIn(ban_l), p2.animate.set_opacity(0.3), p2l.animate.set_opacity(0.3), run_time=1.4)
            self.wait(d * 0.1)
            self.play(FadeIn(hang), run_time=1.0)
            self.wait(d * 0.08)
            self.play(FadeIn(p3, scale=0.5), Flash(p3, color=ORANGE), run_time=0.9)
            self.play(Write(p3l), GrowArrow(p3a), run_time=1.2)
        self.clear_all()

    def lagrange(self):
        ax = Axes(x_range=[0, 11, 1], y_range=[0, 11, 1], x_length=6.0, y_length=6.0,
                  axis_config={"color": DIM, "include_tip": False, "include_ticks": False}).move_to([-2.8, 0.05, 0])
        levels = [4, 9, 16, 25, 36, 49, 64]
        cols = color_gradient([PURPLE, BLUE, TEAL], len(levels))
        hyp = VGroup(*[ax.plot(lambda t, c=c: c / t, x_range=[c / 10.8, 10.8, 0.02], color=col, stroke_width=2.2,
                               stroke_opacity=0.75) for c, col in zip(levels, cols)])
        title = M(r"\max\; f(x,y) = xy", size=44).move_to([3.7, 2.9, 0])
        cons = M(r"\text{s.t.}\;\; x + y = 10", size=44, color=TEAL).next_to(title, DOWN, buff=0.25)
        path = Line(ax.c2p(0, 10), ax.c2p(10, 0), color=TEAL, stroke_width=5)
        road = T("小路", 28, TEAL).next_to(ax.c2p(8.3, 1.7), RIGHT, buff=0.15)
        hill = T("等高线：越往右上越高", 24, DIM).next_to(ax, UP, buff=0.1)
        with self.say("s1_12") as d:
            self.play(Create(ax), LaggedStart(*[Create(h) for h in hyp], lag_ratio=0.12), FadeIn(hill), run_time=2.2)
            self.play(Write(title), run_time=1.0)
            self.play(Create(path), FadeIn(road), Write(cons), run_time=1.6)

        u = ValueTracker(1.4)
        walker = always_redraw(lambda: Dot(ax.c2p(u.get_value(), 10 - u.get_value()), color=YELLOW, radius=0.11).set_z_index(4))
        cur = always_redraw(lambda: ax.plot(
            lambda t: u.get_value() * (10 - u.get_value()) / t,
            x_range=[u.get_value() * (10 - u.get_value()) / 10.8, 10.8, 0.02], color=YELLOW, stroke_width=4))
        val = always_redraw(lambda: M(r"f = %.1f" % (u.get_value() * (10 - u.get_value())), size=40, color=YELLOW
                                      ).move_to([3.7, 1.1, 0]))
        with self.say("s1_13") as d:
            self.play(FadeIn(walker), FadeIn(cur), FadeIn(val), run_time=1.0)
            self.play(u.animate.set_value(3.2), run_time=3.0, rate_func=linear)
            self.wait(d * 0.08)
            self.play(u.animate.set_value(5.0), run_time=3.6, rate_func=rate_functions.ease_out_cubic)
            tang = T("相切", 32, YELLOW, weight=BOLD).next_to(ax.c2p(5, 5), UR, buff=0.25)
            self.play(Flash(ax.c2p(5, 5), color=YELLOW), FadeIn(tang), run_time=1.0)
        self.tang = tang
        P = ax.c2p(5, 5)
        n = np.array([1, 1, 0]) / np.sqrt(2)
        gf = Arrow(P, P + n * 2.0, buff=0, color=ORANGE, stroke_width=6, max_tip_length_to_length_ratio=0.15)
        gg = Arrow(P, P + n * 0.9, buff=0, color=TEAL, stroke_width=7, max_tip_length_to_length_ratio=0.3)
        gfl = M(r"\nabla f", size=38, color=ORANGE).next_to(gf.get_end(), UP, buff=0.1)
        ggl = M(r"\nabla g", size=34, color=TEAL).next_to(gg.get_end(), DR, buff=0.06)
        law = M(r"\nabla f", r"=", r"\lambda", r"\,\nabla g", size=60).move_to([3.7, -0.3, 0])
        law[0].set_color(ORANGE)
        law[2].set_color(YELLOW)
        law[3].set_color(TEAL)
        lname = T("拉格朗日乘子", 30, YELLOW).next_to(law, DOWN, buff=0.3)
        with self.say("s1_14") as d:
            self.play(FadeOut(tang), GrowArrow(gf), FadeIn(gfl), run_time=1.4)
            self.play(GrowArrow(gg), FadeIn(ggl), run_time=1.2)
            self.wait(d * 0.15)
            self.play(Write(law), run_time=1.6)
            self.play(FadeIn(lname, shift=UP * 0.2), Indicate(law[2], color=YELLOW, scale_factor=1.4), run_time=1.4)

        # 约束放宽：x + y = 10 → 11，最优值 25 → 30.25，增量约为 λ = 5
        path2 = Line(ax.c2p(0, 11), ax.c2p(11, 0), color=TEAL, stroke_width=3, stroke_opacity=0.6)
        hyp2 = ax.plot(lambda t: 30.25 / t, x_range=[30.25 / 10.8, 10.8, 0.02], color=ORANGE, stroke_width=3)
        dot2 = Dot(ax.c2p(5.5, 5.5), color=ORANGE, radius=0.09)
        sens = VGroup(T("最优值的增量", 28), M(r"\approx", size=40), M(r"\lambda", size=44, color=YELLOW),
                      M(r"\times", size=40), T("约束的放松量", 28)).arrange(RIGHT, buff=0.18).move_to([3.7, -1.65, 0])
        num = VGroup(M(r"\lambda = 5", size=46, color=YELLOW), T("每放松一个单位，最优值约多五", 26, DIM)
                     ).arrange(DOWN, buff=0.2).move_to([3.7, -2.65, 0])
        price = T("约束的价格 · 影子价格", 32, YELLOW, weight=BOLD).move_to([3.7, -2.65, 0])
        with self.say("s1_15") as d:
            self.play(FadeOut(lname), FadeOut(val), run_time=0.6)
            self.play(Create(path2), run_time=1.4)
            self.play(Create(hyp2), FadeIn(dot2), run_time=1.4)
            self.wait(d * 0.1)
            self.play(Write(sens), run_time=2.0)
            self.wait(d * 0.12)
            self.play(FadeIn(num, shift=UP * 0.2), run_time=1.2)
            self.wait(d * 0.18)
            self.play(FadeOut(num), FadeIn(price, shift=UP * 0.2), run_time=1.0)
        self.clear_all()

    def wall(self):
        ax = Axes(x_range=[-1.5, 6.5, 1], y_range=[0, 6, 1], x_length=9, y_length=4.6,
                  axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).shift(DOWN * 0.5)
        f = lambda t: 0.42 * (t - 3) ** 2 + 0.3
        bowl = ax.plot(f, x_range=[-0.6, 6.5, 0.01], color=BLUE, stroke_width=5)
        wx = ValueTracker(1.0)

        def wall():
            x0 = wx.get_value()
            top, bot = ax.c2p(x0, 5.6), ax.c2p(x0, 0)
            ln = Line(bot, top, color=INK, stroke_width=6)
            hatch = VGroup(*[Line(ax.c2p(x0, y), ax.c2p(x0, y) + np.array([0.22, -0.18, 0]), color=DIM, stroke_width=2)
                             for y in np.arange(0.2, 5.6, 0.35)])
            return VGroup(ln, hatch)

        w = always_redraw(wall)
        bx = ValueTracker(-0.45)
        r = 0.2

        def ball_pos():
            t = bx.get_value()
            p = ax.c2p(t, f(t))
            slope = (ax.c2p(t + 1e-3, f(t + 1e-3)) - p)
            nrm = np.array([-slope[1], slope[0], 0])
            nrm /= np.linalg.norm(nrm)
            return p + nrm * r

        ball = always_redraw(lambda: Circle(radius=r, color=YELLOW, fill_opacity=1).move_to(ball_pos()).set_z_index(3))
        cons = M(r"x \le 1", size=44, color=INK).to_corner(UR, buff=0.7)
        with self.say("s1_16") as d:
            self.play(Create(ax), Create(bowl), run_time=1.4)
            self.play(FadeIn(w), FadeIn(cons), FadeIn(ball), run_time=1.0)
            self.play(bx.animate.set_value(1.0 - r * 1.05), run_time=2.2, rate_func=rate_functions.ease_in_quad)
            c = ball_pos()
            push_g = Arrow(c + LEFT * 1.7, c + LEFT * 0.28, buff=0, color=ORANGE, stroke_width=6,
                           max_tip_length_to_length_ratio=0.2)
            wall_x = ax.c2p(wx.get_value(), 0)[0]
            push_w = Arrow([wall_x - 0.05, c[1] + 0.75, 0], [wall_x - 1.6, c[1] + 0.75, 0], buff=0, color=YELLOW,
                           stroke_width=6, max_tip_length_to_length_ratio=0.2)
            gl = label_box(T("想滚向碗底", 24, ORANGE), buff=0.08).next_to(push_g, DOWN, buff=0.08)
            wl = label_box(T("墙的推力 = 乘子", 28, YELLOW, weight=BOLD), buff=0.1).next_to(push_w, UP, buff=0.08)
            self.play(GrowArrow(push_g), FadeIn(gl), run_time=1.0)
            self.wait(d * 0.08)
            self.play(GrowArrow(push_w), FadeIn(wl), run_time=1.0)

        lam0 = T("推力 = 0", 28, YELLOW, weight=BOLD)
        rule = VGroup(T("要么贴着墙，要么推力为零", 32, INK, weight=BOLD),
                      VGroup(M(r"\lambda \times", size=44, color=YELLOW), T("约束的余量", 30, YELLOW),
                             M(r"= 0", size=44, color=YELLOW)).arrange(RIGHT, buff=0.18),
                      T("互补松弛 · KKT 条件的核心", 26, DIM)).arrange(DOWN, buff=0.25)
        rule = label_box(rule, buff=0.25, opacity=0.92).to_corner(UL, buff=0.45)
        cons2 = M(r"x \le 5", size=44, color=INK).move_to(cons)
        with self.say("s1_17") as d:
            self.play(FadeOut(push_g), FadeOut(push_w), FadeOut(gl), FadeOut(wl), run_time=0.6)
            self.play(wx.animate.set_value(5.0), Transform(cons, cons2), run_time=1.6)
            self.play(bx.animate.set_value(3.0), run_time=2.2, rate_func=rate_functions.ease_in_out_sine)
            lam0.next_to(ax.c2p(5, 5.6), UP, buff=0.1)
            self.play(FadeIn(lam0), run_time=0.8)
            self.wait(d * 0.08)
            self.play(FadeIn(rule[0]), FadeIn(rule[1][0], shift=DOWN * 0.2), run_time=1.0)
            self.play(Write(rule[1][1]), run_time=1.2)
            self.play(FadeIn(rule[1][2]), run_time=0.8)
        self.clear_all()

    def summary(self):
        items = [("导数", "局部的判断", BLUE), ("不等式", "全局的证明", YELLOW), ("乘子", "约束的价格", TEAL)]
        cards = VGroup()
        for a, b, c in items:
            box = RoundedRectangle(corner_radius=0.2, width=3.6, height=2.0, stroke_color=c, stroke_width=3,
                                   fill_color=BG, fill_opacity=1)
            txt = VGroup(T(a, 40, c, weight=BOLD), T(b, 30, INK)).arrange(DOWN, buff=0.25).move_to(box)
            cards.add(VGroup(box, txt))
        cards.arrange(RIGHT, buff=0.5).shift(UP * 0.2)
        with self.say("s1_18", tail=1.0) as d:
            for c in cards:
                self.play(FadeIn(c, shift=UP * 0.3), run_time=0.9)
                self.wait(d * 0.12)
        self.clear_all(0.9)
