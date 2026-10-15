"""三 · 换个角度：残差平方和是距离，最小二乘是正交投影"""
from common import *
from data import A3, B3, FIT3, RES3, X3, Y3

RX = 3.9


class Vectors(VScene):
    """两个条件 → 两个点积 → 把数据看成一个向量 → 缩到三个点。"""
    header = "三 · 换个角度"

    def construct(self):
        c1 = tex(r"\sum", r"1\cdot e_i", "=0", size=50).move_to(UP * 1.1 + LEFT * 2.6)
        c2 = tex(r"\sum", r"x_i\cdot e_i", "=0", size=50).move_to(UP * 1.1 + RIGHT * 2.6)
        c1[1].set_color(ORANGE); c2[1].set_color(ORANGE)
        lab = VGroup(zh("条件一", 26, BLUE).next_to(c1, UP, buff=0.35), zh("条件二", 26, BLUE).next_to(c2, UP, buff=0.35))
        with self.say("g01") as d:
            self.play(FadeIn(lab), Write(c1), Write(c2), run_time=1.4)

        d1 = tex(r"\mathbf 1\cdot \mathbf e=0", size=54).move_to(DOWN * 0.6 + LEFT * 2.6)
        d2 = tex(r"\mathbf x\cdot \mathbf e=0", size=54).move_to(DOWN * 0.6 + RIGHT * 2.6)
        perp = VGroup(tex(r"\mathbf e\perp\mathbf 1", size=50, color=BLUE), tex(r"\mathbf e\perp\mathbf x", size=50, color=BLUE))
        perp[0].next_to(d1, DOWN, buff=0.5); perp[1].next_to(d2, DOWN, buff=0.5)
        q = serif("垂直于什么？", 36).to_edge(DOWN, buff=0.45)
        defs = tex(r"\mathbf 1=(1,\dots,1),\quad \mathbf x=(x_1,\dots,x_{10}),\quad \mathbf e=(e_1,\dots,e_{10})",
                   size=32, color=SOFT).next_to(perp, DOWN, buff=0.5).set_x(0)
        with self.say("g02") as d:
            self.play(TransformFromCopy(c1, d1), TransformFromCopy(c2, d2), FadeIn(defs), run_time=1.2)
            self.wait(d * 0.3)
            self.play(FadeIn(perp, shift=DOWN * 0.1), run_time=0.8)
            self.play(FadeIn(q), run_time=0.6)

        # 十个分数排成一列
        vals = [int(v) for v in Y]
        vec = tex(r"\mathbf y=", r"\begin{pmatrix}" + r"\\".join(str(v) for v in vals) + r"\end{pmatrix}", size=34)
        col = vec[1]
        vec.move_to(LEFT * 1.5 + DOWN * 0.15)
        inr = VGroup(tex(r"\mathbf y\in\mathbb R^{10}", size=50, color=BLUE), zh("十维空间里的一个向量", 28, SOFT)).arrange(DOWN, buff=0.3)
        inr.next_to(vec, RIGHT, buff=1.2)
        with self.say("g03") as d:
            self.play(FadeOut(VGroup(c1, c2, lab, d1, d2, perp, q, defs)), run_time=0.6)
            self.play(Write(col), run_time=1.6)
            self.play(FadeIn(vec[0]), run_time=0.6)
            self.wait(d * 0.2)
            self.play(FadeIn(inr), run_time=0.8)

        pl = Plot(width=4.6, height=3.6, center=[0, -0.4, 0], x_range=(0, 3, 1), y_range=(0, 4, 1),
                  xlabel="x", ylabel="y", num_size=28)
        pl.xlabel.next_to(pl.ax.x_axis, RIGHT, buff=0.15); pl.ylabel.next_to(pl.ax.y_axis, UP, buff=0.12)
        small = serif("三个点", 34).to_edge(UP, buff=0.9)
        with self.say("g04") as d:
            self.play(FadeOut(vec), FadeOut(inr), run_time=0.6)
            self.play(FadeIn(small), FadeIn(pl.frame()), run_time=0.8)
        pts = pl.dots(X3, Y3, r=0.1)
        labs = VGroup(*[tex(f"({x:g},{y:g})", size=30, color=SOFT).next_to(p, UR, buff=0.08) for p, x, y in zip(pts, X3, Y3)])
        with self.say("g05") as d:
            self.play(LaggedStart(*[FadeIn(p, scale=1.5) for p in pts], lag_ratio=0.3), run_time=1.2)
            self.play(FadeIn(labs), run_time=0.6)
        self.play(FadeOut(VGroup(pl.frame(), pts, labs, small)), run_time=0.7)


class Space(VThreeDScene):
    """三维里的投影。"""
    header = "三 · 换个角度"

    def construct(self):
        THETA = 8 * DEGREES
        PHI = 68 * DEGREES
        ax = ThreeDAxes(x_range=[-0.5, 3.5, 1], y_range=[-0.5, 3.5, 1], z_range=[-0.5, 3.2, 1],
                        x_length=4.4, y_length=4.4, z_length=4.0,
                        axis_config={"color": LINE, "stroke_width": 2, "include_tip": False, "tick_size": 0.04})
        P = ax.c2p
        o = P(0, 0, 0)
        # 让三维内容偏左，右边留给公式
        right_dir = np.array([-np.sin(THETA), np.cos(THETA), 0])
        center = P(1.2, 1.4, 1.1) + 2.6 * right_dir
        self.set_camera_orientation(phi=PHI, theta=-40 * DEGREES, frame_center=center, zoom=1.0)

        def arrow(v, color, width=5):
            return Arrow3D(o, P(*v), color=color, thickness=0.018, height=0.22, base_radius=0.06)

        def label(text, pos, color=INK, size=36, is_tex=True):
            m = tex(text, size=size, color=color) if is_tex else zh(text, size - 10, color)
            m.move_to(pos)
            self.add_fixed_orientation_mobjects(m)
            return m

        def side(m, y):
            m.move_to([RX + 0.6, y, 0])
            self.add_fixed_in_frame_mobjects(m)
            return m

        axl = VGroup(*[zh(f"同学{k}", 20, SOFT) for k in (1, 2, 3)])
        axl[0].move_to(P(3.8, 0, 0)); axl[1].move_to(P(0, 3.8, 0)); axl[2].move_to(P(0, 0, 3.5))
        ya = arrow(Y3, INK)
        with self.say("g06") as d:
            self.play(Create(ax), run_time=1.0)
            self.add_fixed_orientation_mobjects(*axl)
            self.play(FadeIn(axl), run_time=0.4)
            self.play(FadeIn(ya), run_time=0.8)
            yl = label(r"\mathbf y", P(*Y3) + OUT * 0.3 + RIGHT * 0.1)
            yv = side(tex(r"\mathbf y=(1,\,3,\,2)", size=40), 2.3)
            self.play(FadeIn(yl), FadeIn(yv), run_time=0.6)
        self.move_camera(theta=THETA, run_time=2.4)

        one_a = arrow((1, 1, 1), GRAY)
        x_a = arrow(X3, GRAY)
        onel = label(r"\mathbf 1", P(1, 1, 1) + OUT * 0.28, GRAY)
        xl = label(r"\mathbf x", P(*X3) + OUT * 0.28, GRAY)
        comb = side(tex(r"a\,\mathbf 1+b\,\mathbf x=(a,\ a+b,\ a+2b)", size=34), 1.4)
        comb_sub = side(VGroup(tex(r"\mathbf 1=(1,1,1)", size=30, color=SOFT), tex(r"\mathbf x=(0,1,2)", size=30, color=SOFT))
                        .arrange(RIGHT, buff=0.5), 0.75)
        with self.say("g07") as d:
            self.play(FadeIn(one_a), FadeIn(onel), FadeIn(comb_sub), run_time=0.9)
            self.play(FadeIn(x_a), FadeIn(xl), run_time=0.9)
            self.wait(d * 0.2)
            self.play(FadeIn(comb), run_time=0.8)

        s0, s1, t0, t1 = -0.1, 3.0, -0.75, 1.35
        corners = [P(*(s * np.ones(3) + t * X3)) for s, t in [(s0, t0), (s1, t0), (s1, t1), (s0, t1)]]
        plane = Polygon(*corners, stroke_width=1, stroke_color=BLUE, fill_color=BLUE, fill_opacity=0.16)
        span = label(r"\operatorname{span}\{\mathbf 1,\mathbf x\}", P(*(2.75 * np.ones(3) - 0.6 * X3)) + IN * 0.2, BLUE, 30)
        sa, tb = ValueTracker(0.6), ValueTracker(1.0)

        def cur():
            return sa.get_value() * np.ones(3) + tb.get_value() * X3

        mv = always_redraw(lambda: Dot3D(P(*cur()), radius=0.06, color=BLUE))
        with self.say("g08") as d:
            self.play(FadeIn(plane), FadeIn(span), run_time=1.0)
            self.add(mv)
            self.play(sa.animate.set_value(2.4), tb.animate.set_value(-0.4), run_time=d * 0.35)
            self.play(sa.animate.set_value(1.0), tb.animate.set_value(0.9), run_time=d * 0.3)

        resv = always_redraw(lambda: Line(P(*cur()), P(*Y3), color=ORANGE, stroke_width=5))
        s_eq = side(tex(r"S", "=", r"\bigl\|\mathbf y-(a\mathbf 1+b\mathbf x)\bigr\|^2", size=38), -0.15)
        s_eq[0][0].set_color(ORANGE)
        with self.say("g09") as d:
            self.play(Create(resv), run_time=0.8)
            self.play(FadeIn(s_eq), run_time=0.8)
            self.play(sa.animate.set_value(2.2), tb.animate.set_value(0.2), run_time=d * 0.4)
        qn = side(serif("平面上哪一点离 y 最近？", 30), -1.1)
        with self.say("g10") as d:
            self.play(FadeIn(qn), run_time=0.7)

        hat = P(*FIT3)
        foot_lab = label(r"\hat{\mathbf y}", hat + IN * 0.32 + LEFT * 0.05, BLUE)
        in_dir = P(*(FIT3 + 0.6 * np.ones(3))) - hat
        ra = right_angle(hat, P(*Y3) - hat, in_dir, size=0.2, color=INK, width=2.5)
        proj_t = side(VGroup(zh("垂足 = 正交投影", 26, BLUE)), -1.85)
        with self.say("g11") as d:
            self.play(sa.animate.set_value(A3), tb.animate.set_value(B3), run_time=min(2.0, d * 0.45))
            self.play(Create(ra), FadeIn(foot_lab), FadeIn(proj_t), run_time=0.8)

        other = FIT3 + 1.0 * np.ones(3) - 0.5 * X3
        po = Dot3D(P(*other), radius=0.06, color=GRAY)
        hyp = DashedLine(P(*other), P(*Y3), color=GRAY, stroke_width=3)
        leg = DashedLine(P(*other), hat, color=GRAY, stroke_width=3)
        why = side(VGroup(zh("斜边 > 直角边", 26, SOFT)), -2.5)
        with self.say("g12") as d:
            self.play(FadeIn(po), Create(leg), run_time=0.8)
            self.play(Create(hyp), FadeIn(why), run_time=0.8)
            self.wait(d * 0.3)
            self.play(FadeOut(po), FadeOut(hyp), FadeOut(leg), run_time=0.6)

        # 垂直于两个张成向量 = 两个条件
        resv.clear_updaters(); mv.clear_updaters()
        cond = side(VGroup(tex(r"\mathbf 1\cdot\mathbf e=0", size=36), tex(r"\mathbf x\cdot\mathbf e=0", size=36))
                    .arrange(RIGHT, buff=0.6), -1.1)
        with self.say("g13") as d:
            self.play(FadeOut(qn), FadeOut(proj_t), FadeOut(why), run_time=0.5)
            self.play(Indicate(one_a, color=GRAY), Indicate(x_a, color=GRAY), run_time=1.0)
            self.play(FadeIn(cond), run_time=0.7)
        same = side(zh("= 求导得到的条件一、条件二", 26, BLUE), -1.8)
        with self.say("g14") as d:
            self.play(FadeIn(same), run_time=0.8)

        old = VGroup(yv, comb, comb_sub, s_eq, cond, same)
        xm = side(tex(r"X=\bigl[\,\mathbf 1\ \ \mathbf x\,\bigr]", size=38), 2.3)
        xte = side(tex(r"X^{\mathsf T}\mathbf e", "=", r"X^{\mathsf T}(\mathbf y-X\boldsymbol\beta)", "=", "0", size=38), 1.4)
        with self.say("g15") as d:
            self.play(FadeOut(old), run_time=0.6)
            self.play(FadeIn(xm), run_time=0.7)
            self.play(FadeIn(xte), run_time=0.9)
        ne = side(tex(r"X^{\mathsf T}X\,\boldsymbol\beta=X^{\mathsf T}\mathbf y", size=44, color=BLUE), 0.4)
        ne_box = side(SurroundingRectangle(ne, color=BLUE, buff=0.18, corner_radius=0.08, stroke_width=2), 0.4)
        ne_lab = side(zh("正规方程（法方程）", 26, BLUE), -0.35)
        with self.say("g16") as d:
            self.play(FadeIn(ne), Create(ne_box), run_time=1.0)
            self.play(FadeIn(ne_lab), run_time=0.6)

        sol = side(tex(r"a=1.5,\quad b=0.5", size=38), -1.2)
        ev = side(tex(r"\mathbf e=(-0.5,\ 1,\ -0.5)", size=38, color=ORANGE), -1.9)
        with self.say("g17") as d:
            self.play(FadeIn(sol), run_time=0.7)
            self.play(FadeIn(ev), run_time=0.7)
        chk = side(VGroup(tex(r"-0.5+1-0.5=0", size=32), tex(r"0(-0.5)+1(1)+2(-0.5)=0", size=32))
                   .arrange(DOWN, buff=0.15, aligned_edge=LEFT), -2.85)
        with self.say("g18") as d:
            self.play(FadeIn(chk[0]), run_time=0.7)
            self.wait(d * 0.2)
            self.play(FadeIn(chk[1]), run_time=0.7)

        # 对象与坐标
        old2 = VGroup(xm, xte, ne, ne_box, ne_lab, sol, ev, chk)
        obj = side(VGroup(tex(r"\hat{\mathbf y}=(1.5,\ 2,\ 2.5)", size=38, color=BLUE),
                          zh("平面上的一个点：由 y 和平面决定", 24, SOFT)).arrange(DOWN, buff=0.18), 2.0)
        ring = Circle(radius=0.16, color=BLUE, stroke_width=3).move_to(hat)
        self.add_fixed_orientation_mobjects(ring)
        with self.say("g19") as d:
            self.play(FadeOut(old2), run_time=0.6)
            self.play(FadeIn(obj), Create(ring), run_time=0.9)
        crd = side(VGroup(tex(r"\hat{\mathbf y}=1.5\,\mathbf 1+0.5\,\mathbf x", size=38),
                          zh("(a, b) 是它在基 {1, x} 下的坐标", 24, SOFT)).arrange(DOWN, buff=0.18), 0.5)
        with self.say("g20") as d:
            self.play(FadeIn(crd), run_time=0.9)

        xc = np.array([-1.0, 0.0, 1.0])  # x − x̄·1
        xc_a = arrow(xc, GOLD)
        xcl = label(r"\mathbf x-\bar x\mathbf 1", P(*xc) + OUT * 0.3 + LEFT * 0.2, GOLD, 30)
        crd2 = side(VGroup(tex(r"\hat{\mathbf y}=2\,\mathbf 1+0.5\,(\mathbf x-\bar x\mathbf 1)", size=36),
                           zh("坐标变成 (2, 0.5)，投影点不变", 24, BLUE)).arrange(DOWN, buff=0.18), -1.1)
        with self.say("g21") as d:
            self.play(FadeIn(xc_a), FadeIn(xcl), run_time=0.9)
            self.play(FadeIn(crd2), run_time=0.9)
            self.play(Indicate(ring, color=BLUE, scale_factor=1.4), run_time=1.0)
        self.wait(0.6)
        self.play(*[FadeOut(m) for m in self.mobjects if m not in self.foreground_mobjects], run_time=0.8)
