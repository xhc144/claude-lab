"""四 · 勾股定理与 R²；五 · 多列与弯曲的线；六 · 为什么叫回归；尾声"""
from common import *
from data import (A_O, B_O, COEF_Q, COEF_QL, R, R2, SSE, SSR, SX, SY, SYY, XQ, YQ)

RX = 3.5


class Pythagoras(VScene):
    header = "三 · 换个角度：勾股定理"

    def construct(self):
        k = 6.0 / np.sqrt(SYY)
        o = np.array([-5.6, -1.9, 0])
        hat = o + RIGHT * np.sqrt(SSR) * k
        yv = hat + UP * np.sqrt(SSE) * k
        plane = Polygon(o + LEFT * 0.4 + DOWN * 0.35, hat + RIGHT * 0.9 + DOWN * 0.35, hat + RIGHT * 1.5 + UP * 0.35,
                        o + RIGHT * 0.2 + UP * 0.35, stroke_width=0, fill_color=BLUE, fill_opacity=0.12)
        base = Arrow(o, hat, buff=0, color=BLUE, stroke_width=5, tip_length=0.22)
        ev = Arrow(hat, yv, buff=0, color=ORANGE, stroke_width=5, tip_length=0.22)
        hyp = Arrow(o, yv, buff=0, color=INK, stroke_width=5, tip_length=0.22)
        lb = tex(r"\hat{\mathbf y}-\bar y\mathbf 1", size=36, color=BLUE).next_to(base, DOWN, buff=0.45)
        le = tex(r"\mathbf e", size=40, color=ORANGE).next_to(ev, RIGHT, buff=0.15)
        lh = tex(r"\mathbf y-\bar y\mathbf 1", size=36).move_to((o + yv) / 2 + UP * 0.45 + LEFT * 0.45)
        od = Dot(o, radius=0.06, color=GOLD)
        ol = tex(r"\bar y\mathbf 1", size=32, color=GOLD).next_to(od, LEFT, buff=0.15)

        with self.say("p01") as d:
            self.play(FadeIn(plane), FadeIn(od), FadeIn(ol), run_time=0.8)

        eq = tex(r"\mathbf y-\bar y\mathbf 1", "=", r"(\hat{\mathbf y}-\bar y\mathbf 1)", "+", r"\mathbf e", size=40)
        eq[2].set_color(BLUE); eq[4].set_color(ORANGE)
        eq.move_to([RX, 2.2, 0])
        note = zh("ȳ1 和 ŷ 都在平面里，所以 ŷ − ȳ1 也在", 22, SOFT).next_to(eq, DOWN, buff=0.25)
        with self.say("p02") as d:
            self.play(GrowArrow(base), FadeIn(lb), run_time=0.8)
            self.play(GrowArrow(ev), FadeIn(le), run_time=0.7)
            self.play(GrowArrow(hyp), FadeIn(lh), run_time=0.7)
            self.play(Write(eq), FadeIn(note), run_time=1.0)

        ra = right_angle(hat, LEFT, UP, size=0.25, color=INK, width=2)
        pyth = tex(r"\|\mathbf y-\bar y\mathbf 1\|^2", "=", r"\|\hat{\mathbf y}-\bar y\mathbf 1\|^2", "+", r"\|\mathbf e\|^2",
                   size=40).move_to([RX, 0.9, 0])
        pyth[2].set_color(BLUE); pyth[4].set_color(ORANGE)
        with self.say("p03") as d:
            self.play(Create(ra), run_time=0.6)
            self.play(Write(pyth), run_time=1.2)

        names = VGroup(zh("总平方和", 21, INK), zh("回归平方和", 21, BLUE), zh("残差平方和", 21, ORANGE))
        for n_, part in zip(names, (pyth[0], pyth[2], pyth[4])):
            n_.next_to(part, DOWN, buff=0.2)
        nums = tex("1636", "=", "1320", "+", "316", size=48).move_to([RX, -0.75, 0])
        nums[2].set_color(BLUE); nums[4].set_color(ORANGE)
        for i in (0, 2, 4):
            nums[i].set_x(pyth[i].get_x())
        nums[1].set_x((nums[0].get_right()[0] + nums[2].get_left()[0]) / 2)
        nums[3].set_x((nums[2].get_right()[0] + nums[4].get_left()[0]) / 2)
        with self.say("p04") as d:
            self.play(FadeOut(note), FadeIn(names, lag_ratio=0.3), run_time=1.2)
            self.wait(d * 0.3)
            self.play(Write(nums), run_time=1.0)

        r2 = tex(r"R^2", "=", r"\frac{1320}{1636}", r"\approx 0.81", size=46).move_to([RX, -2.1, 0])
        r2[0].set_color(BLUE)
        with self.say("p05") as d:
            self.play(Write(r2), run_time=1.2)
        eight = zh("约八成的离散可由直线解释", 24, SOFT).next_to(r2, DOWN, buff=0.25)
        with self.say("p06") as d:
            self.play(FadeIn(eight), run_time=0.7)

        ang = Arc(radius=1.0, start_angle=0, angle=np.arctan2(yv[1] - o[1], yv[0] - o[0]), arc_center=o, color=GOLD,
                  stroke_width=3)
        th = tex(r"\theta", size=34, color=GOLD).next_to(ang, RIGHT, buff=0.08).shift(UP * 0.12)
        cos = tex(r"R^2=\cos^2\theta", size=46, color=GOLD).move_to([RX, -2.1, 0])
        with self.say("p07") as d:
            self.play(Create(ang), FadeIn(th), run_time=0.8)
            self.play(FadeOut(eight), ReplacementTransform(r2, cos), run_time=1.0)
        self.wait(0.5)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.8)


class Beyond(VScene):
    header = "四 · 同一个投影"

    def construct(self):
        t = serif("投影不在乎平面由几列张成", 36).to_edge(UP, buff=0.9)
        with self.say("m01") as d:
            self.play(FadeIn(t, shift=DOWN * 0.1), run_time=0.8)

        xm = tex(r"X=\begin{pmatrix}1 & x_1 & z_1\\ 1 & x_2 & z_2\\ \vdots & \vdots & \vdots\\ 1 & x_{10} & z_{10}\end{pmatrix}",
                 size=42).move_to(LEFT * 3.0 + DOWN * 0.3)
        heads = VGroup(
            VGroup(tex(r"\mathbf 1", size=32), zh("截距", 22, SOFT)).arrange(RIGHT, buff=0.15),
            VGroup(tex(r"\mathbf x", size=32), zh("学习时长", 22, SOFT)).arrange(RIGHT, buff=0.15),
            VGroup(tex(r"\mathbf z", size=32, color=GOLD), zh("睡眠时间（新的一列）", 22, GOLD)).arrange(RIGHT, buff=0.15),
        ).arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(xm, DOWN, buff=0.4)
        with self.say("m02") as d:
            self.play(Write(xm), run_time=1.2)
            self.play(FadeIn(heads, lag_ratio=0.3), run_time=0.9)

        ne = tex(r"X^{\mathsf T}X\,\hat{\boldsymbol\beta}=X^{\mathsf T}\mathbf y", size=48, color=BLUE).move_to([RX, 0.9, 0])
        with self.say("m03") as d:
            self.play(Write(ne), run_time=1.0)
        sol = tex(r"\hat{\boldsymbol\beta}=(X^{\mathsf T}X)^{-1}X^{\mathsf T}\mathbf y", size=48).move_to([RX, -0.3, 0])
        cond = zh("条件：X 的各列线性无关", 26, SOFT).next_to(sol, DOWN, buff=0.3)
        with self.say("m04") as d:
            self.play(Write(sol), run_time=1.0)
            self.play(FadeIn(cond), run_time=0.6)

        xm2 = tex(r"X=\begin{pmatrix}1 & x_1 & 60x_1\\ \vdots & \vdots & \vdots\\ 1 & x_{10} & 60x_{10}\end{pmatrix}",
                  size=42).move_to(xm)
        heads2 = VGroup(
            VGroup(tex(r"\mathbf x", size=32), zh("用小时记", 22, SOFT)).arrange(RIGHT, buff=0.15),
            VGroup(tex(r"60\mathbf x", size=32, color=RED), zh("同一时长用分钟记", 22, RED)).arrange(RIGHT, buff=0.15),
        ).arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(xm2, DOWN, buff=0.4)
        many = VGroup(tex(r"\hat{\mathbf y}=51+4x", size=40, color=BLUE), zh("仍然唯一", 24, BLUE),
                      tex(r"b+60c=4", size=40, color=RED), zh("坐标有无穷多组", 24, RED)).arrange_in_grid(2, 2, buff=(0.35, 0.3))
        many.move_to([RX, -2.3, 0])
        with self.say("m05") as d:
            self.play(FadeOut(xm), FadeOut(heads), run_time=0.5)
            self.play(FadeIn(xm2), FadeIn(heads2), run_time=0.9)
            self.wait(d * 0.25)
            self.play(FadeIn(many[:2]), run_time=0.7)
            self.play(FadeIn(many[2:]), run_time=0.7)

        # 弯曲的线
        q = serif("“线性”说的是什么？", 36).to_edge(UP, buff=0.9)
        with self.say("m06") as d:
            self.play(FadeOut(VGroup(xm2, heads2, ne, sol, cond, many)), ReplacementTransform(t, q), run_time=0.9)
        pl = Plot(width=6.0, height=4.4, center=[-3.4, -0.7, 0], x_range=(0, 10, 2), y_range=(10, 60, 10),
                  xlabel="x", ylabel="y")
        pl.xlabel.next_to(pl.ax.x_axis, RIGHT, buff=0.15); pl.ylabel.next_to(pl.ax.y_axis, UP, buff=0.12)
        dq = pl.dots(XQ, YQ)
        lin = pl.ax.plot(lambda v: COEF_QL[0] + COEF_QL[1] * v, x_range=[0, 10], color=GRAY, stroke_width=3)
        quad = pl.ax.plot(lambda v: COEF_Q[0] + COEF_Q[1] * v + COEF_Q[2] * v * v, x_range=[0, 10], color=BLUE,
                          stroke_width=4)
        model = tex(r"y=a+bx+cx^2", size=46).move_to([RX, 1.6, 0])
        with self.say("m07") as d:
            self.play(FadeIn(pl.frame()), FadeIn(dq, lag_ratio=0.08), run_time=1.0)
            self.play(Create(lin), run_time=0.7)
            self.play(Write(model), Create(quad), run_time=1.2)
        xq = tex(r"X=\begin{pmatrix}1 & x_1 & x_1^2\\ \vdots & \vdots & \vdots\\ 1 & x_n & x_n^2\end{pmatrix}", size=40)
        xq.move_to([RX, -0.2, 0])
        lin_p = tex(r"\hat{\mathbf y}=a\,\mathbf 1+b\,\mathbf x+c\,\mathbf x^2", size=40, color=BLUE).move_to([RX, -1.85, 0])
        with self.say("m08") as d:
            self.play(Write(xq), run_time=1.0)
            self.play(Write(lin_p), run_time=1.0)
        key = zh("线性 = 对参数 a、b、c 线性", 30, BLUE).move_to([RX, -2.85, 0])
        with self.say("m09") as d:
            self.play(FadeIn(key, shift=UP * 0.1), run_time=0.8)
        self.wait(0.4)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.8)


class Galton(VScene):
    header = "五 · 为什么叫“回归”"

    def construct(self):
        q = serif("拟合，为什么叫“回归”？", 40).move_to(UP * 0.3)
        with self.say("h01") as d:
            self.play(FadeIn(q, shift=DOWN * 0.1), run_time=0.8)
        card = VGroup(serif("高尔顿", 40), zh("1880 年代 · 父母与子女的身高", 26, SOFT)).arrange(DOWN, buff=0.25).to_edge(UP, buff=0.9)
        with self.say("h02") as d:
            self.play(FadeOut(q), run_time=0.4)
            self.play(FadeIn(card), run_time=0.8)

        # 示意：父母身高（标准分）→ 子女平均身高（标准分）
        lft, rgt = LEFT * 2.6, RIGHT * 2.6
        y0, sc = -0.9, 0.9
        axl = Line(lft + UP * (y0 - 2.2 * sc), lft + UP * (y0 + 2.2 * sc), color=LINE, stroke_width=3)
        axr = Line(rgt + UP * (y0 - 2.2 * sc), rgt + UP * (y0 + 2.2 * sc), color=LINE, stroke_width=3)
        tl = zh("父母身高", 24, SOFT).next_to(axl, DOWN, buff=0.2)
        tr = zh("子女平均身高", 24, SOFT).next_to(axr, DOWN, buff=0.2)
        mean_l = DashedLine(lft + LEFT * 0.6 + UP * y0, rgt + RIGHT * 0.6 + UP * y0, color=GOLD, stroke_width=2)
        ml = zh("平均", 22, GOLD).next_to(mean_l, RIGHT, buff=0.15)
        arrows = VGroup()
        for z in (-2, -1, 1, 2):
            p0 = lft + UP * (y0 + z * sc)
            p1 = rgt + UP * (y0 + z * 0.65 * sc)
            arrows.add(VGroup(Dot(p0, radius=0.07, color=INK), Arrow(p0, p1, buff=0.1, color=BLUE, stroke_width=3,
                                                                     tip_length=0.16), Dot(p1, radius=0.07, color=BLUE)))
        schem = zh("示意", 20, SOFT).to_corner(DR, buff=0.5)
        with self.say("h03") as d:
            self.play(FadeIn(VGroup(axl, axr, tl, tr, mean_l, ml, schem)), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(a) for a in arrows[2:]], lag_ratio=0.4), run_time=d * 0.35)
            self.play(LaggedStart(*[FadeIn(a) for a in arrows[:2]], lag_ratio=0.4), run_time=d * 0.3)
        reg = serif("向平均回归", 40, BLUE).move_to(card)
        sub = zh("Regression towards Mediocrity in Hereditary Stature, 1886", 20, SOFT).next_to(reg, DOWN, buff=0.2)
        with self.say("h04") as d:
            self.play(FadeOut(card), FadeIn(reg), FadeIn(sub), run_time=0.9)
        bform = tex(r"b", "=", r"\frac{\sum(x_i-\bar x)(y_i-\bar y)}{\sum(x_i-\bar x)^2}", "=", r"r\cdot\frac{s_y}{s_x}",
                    size=46).move_to(DOWN * 0.4)
        bform[4].set_color(BLUE)
        with self.say("h05") as d:
            self.play(FadeOut(VGroup(axl, axr, tl, tr, mean_l, ml, schem, arrows, sub)), reg.animate.scale(0.7).to_corner(UR, buff=0.5),
                      run_time=0.9)
            self.play(Write(bform), run_time=1.2)

        # 标准分散点图
        zx, zy = (X - XBAR) / SX, (Y - YBAR) / SY
        ax = Axes(x_range=[-2.2, 2.2, 1], y_range=[-2.2, 2.2, 1], x_length=5.2, y_length=5.2,
                  axis_config={"color": LINE, "stroke_width": 2, "include_tip": False, "tick_size": 0.05}).move_to([-3.2, -0.45, 0])
        nums = VGroup(*[tex(f"{v}", size=24, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.12) for v in (-2, -1, 1, 2)],
                      *[tex(f"{v}", size=24, color=SOFT).next_to(ax.c2p(0, v), LEFT, buff=0.12) for v in (-2, -1, 1, 2)])
        lx = zh("学习时长标准分", 20, SOFT).next_to(ax.c2p(2.2, 0), DOWN, buff=0.45).shift(LEFT * 0.6)
        ly = zh("分数标准分", 20, SOFT).next_to(ax.c2p(0, 2.2), LEFT, buff=0.15)
        dz = VGroup(*[Dot(ax.c2p(a_, b_), radius=0.07, color=INK) for a_, b_ in zip(zx, zy)])
        diag = DashedLine(ax.c2p(-2.1, -2.1), ax.c2p(2.1, 2.1), color=GRAY, stroke_width=2)
        dl = tex("y=x", size=26, color=GRAY).next_to(ax.c2p(2.1, 2.1), RIGHT, buff=0.1)
        reg_l = Line(ax.c2p(-2.1, -2.1 * R), ax.c2p(2.1, 2.1 * R), color=BLUE, stroke_width=4)
        form = tex(r"\frac{\hat y-\bar y}{s_y}", "=", "r", r"\cdot\frac{x-\bar x}{s_x}", size=44).move_to([RX, 1.7, 0])
        form[2].set_color(BLUE)
        with self.say("h06") as d:
            self.play(FadeOut(bform), run_time=0.5)
            self.play(FadeIn(ax), FadeIn(nums), FadeIn(lx), FadeIn(ly), FadeIn(dz, lag_ratio=0.06), run_time=1.2)
            self.play(Write(form), run_time=1.2)
            self.play(Create(reg_l), run_time=0.8)
        rr = tex(r"|r|<1", size=44, color=BLUE).move_to([RX, 0.5, 0])
        with self.say("h07") as d:
            self.play(Create(diag), FadeIn(dl), run_time=0.8)
            self.play(Write(rr), run_time=0.7)

        g1 = DashedLine(ax.c2p(1, 0), ax.c2p(1, 1), color=SOFT, stroke_width=2)
        p_line = Dot(ax.c2p(1, R), radius=0.08, color=BLUE)
        p_diag = Dot(ax.c2p(1, 1), radius=0.06, color=GRAY)
        h_r = DashedLine(ax.c2p(0, R), ax.c2p(1, R), color=BLUE, stroke_width=2)
        vals = tex(r"x:\ +1\,s_x\ \Rightarrow\ \hat y:\ +0.9\,s_y", size=38).move_to([RX, -0.6, 0])
        with self.say("h08") as d:
            self.play(Create(g1), FadeIn(p_diag), run_time=0.7)
            self.play(FadeIn(p_line), Create(h_r), run_time=0.7)
            self.play(Write(vals), run_time=1.0)
        back = zh("预测值往平均收", 28, BLUE).move_to([RX, -1.5, 0])
        with self.say("h09") as d:
            self.play(FadeIn(back), run_time=0.7)

        reg2 = Line(ax.c2p(-2.1 * R, -2.1), ax.c2p(2.1 * R, 2.1), color=GOLD, stroke_width=4)
        two = VGroup(
            VGroup(Line(ORIGIN, RIGHT * 0.5, color=BLUE, stroke_width=4), zh("用时长预测分数：竖直残差", 22, BLUE)).arrange(RIGHT, buff=0.2),
            VGroup(Line(ORIGIN, RIGHT * 0.5, color=GOLD, stroke_width=4), zh("用分数预测时长：水平残差", 22, GOLD)).arrange(RIGHT, buff=0.2),
        ).arrange(DOWN, buff=0.25, aligned_edge=LEFT).move_to([RX, -2.5, 0])
        with self.say("h10") as d:
            self.play(FadeOut(VGroup(g1, p_line, p_diag, h_r)), run_time=0.4)
            self.play(Create(reg2), run_time=1.0)
            self.play(FadeIn(two[0]), FadeIn(two[1]), run_time=0.8)
        vres = VGroup(*[Line(ax.c2p(a_, R * a_), ax.c2p(a_, b_), color=ORANGE, stroke_width=2.5) for a_, b_ in zip(zx, zy)])
        hres = VGroup(*[Line(ax.c2p(R * b_, b_), ax.c2p(a_, b_), color=GOLD, stroke_width=2.5) for a_, b_ in zip(zx, zy)])
        with self.say("h11") as d:
            self.play(Create(vres), run_time=0.9)
            self.wait(d * 0.15)
            self.play(FadeOut(vres), Create(hres), run_time=0.9)
        with self.say("h12") as d:
            self.play(FadeOut(hres), run_time=0.6)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.8)


class Finale(VScene):
    def construct(self):
        t = serif("回头看", 40).to_edge(UP, buff=0.7)
        with self.say("f01") as d:
            self.play(FadeIn(t), run_time=0.7)
        rows = VGroup(
            VGroup(zh("定义", 26, SOFT), tex(r"\min_{a,b}\ \sum e_i^2", size=42, color=ORANGE)),
            VGroup(zh("求导", 26, SOFT), tex(r"\sum e_i=0,\qquad \sum x_i e_i=0", size=42)),
            VGroup(zh("几何", 26, SOFT), tex(r"X^{\mathsf T}\mathbf e=0", r"\iff", r"\hat{\mathbf y}=\text{投影}", size=42, color=BLUE)),
        )
        for r_ in rows:
            r_.arrange(RIGHT, buff=0.6)
        rows.arrange(DOWN, buff=0.6, aligned_edge=LEFT).move_to(DOWN * 0.2)
        for k, key in enumerate(("f02", "f03", "f04")):
            with self.say(key) as d:
                self.play(FadeIn(rows[k], shift=RIGHT * 0.15), run_time=0.9)

        pl = Plot(width=7.4, height=5.0, center=[-1.6, -0.45, 0], y_range=(30, 100, 10))
        dots = pl.dots()
        ln = pl.line(A, B, color=BLUE, width=4)
        out = Dot(pl.p(11, 40), radius=0.11, color=RED)
        out_l = tex("(11,\\ 40)", size=30, color=RED).next_to(out, LEFT, buff=0.15)
        with self.say("f05") as d:
            self.play(FadeOut(VGroup(t, rows)), run_time=0.6)
            self.play(FadeIn(pl.frame()), FadeIn(dots), Create(ln), run_time=1.0)
            self.play(FadeIn(out, scale=1.8), FadeIn(out_l), run_time=0.8)
        ln2 = pl.line(A_O, B_O, color=RED, width=4)
        slope = tex(r"b:\ 4\ \to\ 1.8", size=46, color=RED).move_to([5.0, 1.0, 0])
        sq = Square(side_length=abs(pl.p(11, 40)[1] - pl.p(11, A + 11 * B)[1]), stroke_color=RED, stroke_width=1.5,
                    fill_color=RED, fill_opacity=0.12)
        sq.move_to([pl.p(11, 40)[0] - sq.width / 2, (pl.p(11, 40)[1] + pl.p(11, A + 11 * B)[1]) / 2, 0])
        with self.say("f06") as d:
            self.play(FadeIn(sq), run_time=0.7)
            self.play(ReplacementTransform(ln.copy(), ln2), ln.animate.set_opacity(0.3), run_time=1.4)
            self.play(Write(slope), run_time=0.8)
        look = zh("用之前，先看看图", 32, INK).move_to([5.0, -0.2, 0])
        with self.say("f07") as d:
            self.play(FadeIn(look), run_time=0.7)

        title = serif("线性回归", 72).move_to(UP * 0.5)
        sub = zh("一条线，一次投影", 36, SOFT).next_to(title, DOWN, buff=0.45)
        bar = Line(LEFT * 1.6, RIGHT * 1.6, color=GOLD, stroke_width=3).next_to(sub, DOWN, buff=0.4)
        with self.say("f08") as d:
            self.play(FadeOut(VGroup(pl.frame(), dots, ln, ln2, out, out_l, slope, sq, look)), run_time=0.8)
            self.play(Write(title), FadeIn(sub, shift=UP * 0.1), Create(bar), run_time=1.2)
        self.wait(2.5)
        self.play(FadeOut(VGroup(title, sub, bar)), run_time=1.2)
        self.wait(0.5)
