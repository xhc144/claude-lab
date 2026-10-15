"""一 · 什么叫最好：残差与残差平方和"""
from common import *
from data import sse

RX = 3.9  # 右侧文字栏的中心横坐标


class Residual(VScene):
    header = "一 · 什么叫“最好”"

    def construct(self):
        pl = Plot(width=7.0, height=5.2, center=[-2.75, -0.35, 0])
        dots = pl.dots()
        self.add(pl.frame(), dots)

        a, b = ValueTracker(49.0), ValueTracker(4.3)
        self.pivot = False

        def ga():
            return YBAR - b.get_value() * XBAR if self.pivot else a.get_value()

        ln = always_redraw(lambda: pl.line(ga(), b.get_value(), color=GRAY, width=4))
        form = tex("y", "=", "a", "+", "b", "x", size=52).move_to([RX, 2.4, 0])
        form[2].set_color(BLUE); form[4].set_color(BLUE)
        cap = VGroup(zh("a：截距", 26, SOFT), zh("b：斜率", 26, SOFT)).arrange(RIGHT, buff=0.6).next_to(form, DOWN, buff=0.3)
        with self.say("r01") as d:
            self.play(Create(ln), Write(form), run_time=1.2)
            self.play(FadeIn(cap), run_time=0.6)

        # 一个同学：真实值、预测值、残差
        i = 2  # x = 4, y = 77
        xi, yi = X[i], Y[i]
        hl = Circle(radius=0.17, color=ORANGE, stroke_width=3).move_to(pl.p(xi, yi))
        pred = Dot(pl.p(xi, a.get_value() + b.get_value() * xi), radius=0.07, color=GRAY)
        one = Line(pl.p(xi, a.get_value() + b.get_value() * xi), pl.p(xi, yi), color=ORANGE, stroke_width=4)
        lab_y = tex(r"y_i", size=34).next_to(pl.p(xi, yi), LEFT, buff=0.22)
        lab_p = tex(r"a+bx_i", size=30, color=SOFT).next_to(pred, RIGHT, buff=0.15).shift(DOWN * 0.15)
        res_def = tex(r"e_i", "=", r"y_i", "-", r"(a+bx_i)", size=44).next_to(cap, DOWN, buff=0.7)
        res_def[0].set_color(ORANGE)
        res_cap = zh("残差 = 真实分数 − 预测分数", 26, SOFT).next_to(res_def, DOWN, buff=0.25)
        with self.say("r02") as d:
            self.play(Create(hl), FadeIn(lab_y), run_time=0.7)
            self.play(FadeIn(pred), FadeIn(lab_p), run_time=0.6)
            self.wait(d * 0.3)
            self.play(Create(one), Write(res_def), FadeIn(res_cap), run_time=1.0)

        res = always_redraw(lambda: pl.residuals(ga(), b.get_value()))
        sign = VGroup(tex(r"e_i>0", size=32, color=ORANGE), zh("点在线上方", 24, SOFT),
                      tex(r"e_i<0", size=32, color=ORANGE), zh("点在线下方", 24, SOFT)).arrange_in_grid(2, 2, buff=(0.3, 0.2))
        sign.next_to(res_cap, DOWN, buff=0.5)
        with self.say("r03") as d:
            self.play(FadeOut(hl), FadeOut(lab_p), FadeOut(pred), FadeOut(lab_y), run_time=0.5)
            self.add(res)
            self.remove(one)
            self.play(FadeIn(sign), run_time=0.8)

        # 竖直还是垂直？
        k = 6  # x = 8, y = 87
        av, bv = a.get_value(), b.get_value()
        p = pl.p(X[k], Y[k])
        q0, q1 = pl.p(0, av), pl.p(12, av + 12 * bv)
        u = (q1 - q0) / np.linalg.norm(q1 - q0)
        foot = q0 + np.dot(p - q0, u) * u
        perp = DashedLine(p, foot, color=SOFT, stroke_width=3, dash_length=0.06)
        ra = right_angle(foot, p - foot, u, size=0.12, color=SOFT, width=1.5)
        q_txt = serif("竖直距离，还是垂直距离？", 32).move_to([RX, -1.9, 0])
        with self.say("r04") as d:
            self.play(FadeOut(sign), run_time=0.4)
            self.play(Create(perp), Create(ra), FadeIn(q_txt), run_time=1.0)

        why = VGroup(
            VGroup(zh("已知", 26, SOFT), tex("x", size=36), zh("，预测", 26, SOFT), tex("y", size=36)).arrange(RIGHT, buff=0.1),
            zh("错在分数上 → 沿 y 方向量", 26, ORANGE),
        ).arrange(DOWN, buff=0.25).move_to([RX, -1.75, 0])
        with self.say("r05") as d:
            self.play(FadeOut(q_txt), run_time=0.4)
            self.play(FadeIn(why[0]), run_time=0.6)
            self.wait(d * 0.35)
            self.play(FadeIn(why[1]), Indicate(res[k], color=ORANGE, scale_factor=1.15), run_time=1.0)
        alt = VGroup(zh("垂直距离：回答的是另一个问题，", 22, SOFT), zh("而且随坐标单位改变", 22, SOFT)).arrange(DOWN, buff=0.12).move_to([RX, -2.75, 0])
        with self.say("r06") as d:
            self.play(FadeIn(alt), run_time=0.7)
            self.wait(d * 0.6)
            self.play(FadeOut(perp), FadeOut(ra), run_time=0.6)

        # 加起来？
        right_old = VGroup(cap, res_def, res_cap, why, alt)
        tot = tex(r"e_1+e_2+\cdots+e_{10}", "=", "?", size=42).move_to([RX, 0.9, 0])
        tot[0].set_color(ORANGE)
        with self.say("r07") as d:
            self.play(FadeOut(right_old), run_time=0.5)
            self.play(Write(tot), run_time=1.0)

        def sum_val():
            return float((Y - ga() - b.get_value() * X).sum())

        sum_lbl = tex(r"\textstyle\sum e_i", "=", size=44).move_to([RX - 0.6, 0.9, 0])
        sum_lbl[0].set_color(ORANGE)
        sum_num = always_redraw(lambda: DecimalNumber(0.0 if abs(sum_val()) < 0.05 else sum_val(), num_decimal_places=1,
                                                      font_size=44, color=INK).next_to(sum_lbl, RIGHT, buff=0.2))
        with self.say("r08") as d:
            self.play(a.animate.set_value(YBAR), b.animate.set_value(0.0), FadeOut(tot), FadeIn(sum_lbl), FadeIn(sum_num),
                      run_time=1.6)
            flat = zh("这条线完全不看学习时长", 24, SOFT).next_to(sum_lbl, DOWN, buff=0.4).shift(RIGHT * 0.4)
            self.play(FadeIn(flat), run_time=0.6)

        cen = Dot(pl.p(XBAR, YBAR), radius=0.1, color=GOLD).set_z_index(5)
        cen_lab = tex(r"(\bar x,\bar y)", size=30, color=GOLD).next_to(cen, UP + LEFT, buff=0.08)
        self.pivot = True
        with self.say("r09") as d:
            self.play(FadeOut(flat), FadeIn(cen), FadeIn(cen_lab), run_time=0.6)
            self.play(b.animate.set_value(7.0), run_time=d * 0.35)
            self.play(b.animate.set_value(1.5), run_time=d * 0.35)

        opts = VGroup(tex(r"|e_i|", size=48, color=ORANGE), zh("或", 28, SOFT), tex(r"e_i^2", size=48, color=ORANGE)).arrange(RIGHT, buff=0.5)
        opts.move_to([RX, -0.6, 0])
        with self.say("r10") as d:
            self.play(FadeIn(opts, lag_ratio=0.3), run_time=1.0)

        sq = always_redraw(lambda: pl.squares(ga(), b.get_value()))
        with self.say("r11") as d:
            self.play(opts[0].animate.set_opacity(0.3), opts[1].animate.set_opacity(0.3), Indicate(opts[2], color=ORANGE),
                      run_time=0.8)
            self.play(FadeIn(sq), run_time=1.0)

        s_def = tex(r"S(a,b)", "=", r"\sum_{i=1}^{10}", r"\bigl(y_i-a-bx_i\bigr)^2", size=40).move_to([RX, 2.35, 0])
        s_def[0].set_color(ORANGE)
        s_lbl = tex("S", "=", size=44).move_to([RX - 0.6, 0.9, 0])
        s_lbl[0].set_color(ORANGE)
        s_num = always_redraw(lambda: DecimalNumber(sse(ga(), b.get_value()), num_decimal_places=0,
                                                    font_size=44, color=INK).next_to(s_lbl, RIGHT, buff=0.2))
        with self.say("r12") as d:
            self.play(FadeOut(form), FadeOut(opts), run_time=0.5)
            self.play(Write(s_def), run_time=1.2)
            self.play(FadeOut(sum_lbl), FadeOut(sum_num), FadeIn(s_lbl), FadeIn(s_num), run_time=0.6)
        ls = VGroup(serif("最小二乘法", 36), zh("least squares", 24, SOFT)).arrange(DOWN, buff=0.15).move_to([RX, -0.7, 0])
        with self.say("r13") as d:
            self.play(FadeIn(ls, shift=UP * 0.1), run_time=0.8)

        with self.say("r14") as d:
            self.play(b.animate.set_value(7.5), run_time=d * 0.3)
            self.play(b.animate.set_value(0.8), run_time=d * 0.35)
            self.play(b.animate.set_value(4.0), run_time=d * 0.25)

        alt2 = VGroup(tex(r"\sum|e_i|", size=40, color=ORANGE), zh("也能用，对离群点更不敏感", 24, SOFT)).arrange(RIGHT, buff=0.3)
        alt2.move_to([RX, -2.0, 0])
        with self.say("r15") as d:
            self.play(FadeIn(alt2), run_time=0.8)
        pros = VGroup(
            VGroup(zh("①", 28), zh("求导，一次算出答案", 26)).arrange(RIGHT, buff=0.2),
            VGroup(zh("②", 28), zh("平方和 = 距离的平方", 26, BLUE)).arrange(RIGHT, buff=0.2),
        ).arrange(DOWN, buff=0.3, aligned_edge=LEFT).move_to([RX, -2.3, 0])
        with self.say("r16") as d:
            self.play(FadeOut(alt2), run_time=0.4)
            self.play(FadeIn(pros[0], shift=RIGHT * 0.1), run_time=0.7)
            self.wait(d * 0.3)
            self.play(FadeIn(pros[1], shift=RIGHT * 0.1), run_time=0.7)

        # 历史
        self.play(FadeOut(VGroup(pl.frame(), dots, ln, res, sq, cen, cen_lab, s_def, s_lbl, s_num, ls, pros)), run_time=0.8)
        ln.clear_updaters(); res.clear_updaters(); sq.clear_updaters(); s_num.clear_updaters()
        leg = VGroup(serif("勒让德", 40), tex("1805", size=44, color=GOLD),
                     zh("《计算彗星轨道的新方法》附录", 26, SOFT)).arrange(DOWN, buff=0.25)
        gau = VGroup(serif("高斯", 40), tex("1809", size=44, color=GOLD),
                     zh("《天体运动论》：与正态误差相联系", 26, SOFT),
                     zh("自称 1795 年起使用", 22, SOFT)).arrange(DOWN, buff=0.25)
        VGroup(leg, gau).arrange(RIGHT, buff=1.6, aligned_edge=UP).move_to(UP * 0.2)
        with self.say("r17") as d:
            self.play(FadeIn(leg, shift=UP * 0.15), run_time=0.9)
        with self.say("r18") as d:
            self.play(FadeIn(gau, shift=UP * 0.15), run_time=0.9)
        self.play(FadeOut(VGroup(leg, gau)), run_time=0.7)
