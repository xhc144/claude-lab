"""三 · 概率：Ω、事件、P、补、并、交、互斥、条件概率；检测的例子、贝叶斯公式、独立。"""
from common import *
from data import FP, HEALTHY, POP, SICK, TP

HDR = "三 · 概率"


class Probability(VScene):
    header = HDR

    def construct(self):
        omega = Rectangle(width=6.2, height=4.6, stroke_color=INK, stroke_width=2.5, fill_color=PAPER,
                          fill_opacity=1).move_to(LEFT * 3.5 + DOWN * 0.15)
        om_lab = tex(r"\Omega", size=44).next_to(omega.get_corner(UL), DR, buff=0.18)
        right_x = 3.25

        def rtext(*items, y=1.6):
            g = VGroup(*items).arrange(DOWN, buff=0.18, aligned_edge=LEFT)
            return g.move_to([right_x, y, 0])

        with self.say("b01") as d:
            self.play(FadeIn(omega), run_time=0.8)
        t_om = rtext(VGroup(zh("样本空间", 30), zh("sample space", 20, SOFT)).arrange(RIGHT, buff=0.2),
                     VGroup(tex(r"\Omega", size=40), zh("读作 omega（欧米伽），也有书写作 S", 22, SOFT)).arrange(RIGHT, buff=0.2),
                     y=2.2)
        with self.say("b02") as d:
            self.play(Write(om_lab), run_time=0.6)
            self.play(FadeIn(t_om, shift=LEFT * 0.1), run_time=0.9)
        cA = Circle(radius=1.35, stroke_color=BLUE, stroke_width=3, fill_color=BLUE, fill_opacity=0.18) \
            .move_to(omega.get_center() + LEFT * 0.9)
        lA = tex("A", size=40, color=BLUE).move_to(cA.get_center() + UL * 0.62)
        t_ev = rtext(VGroup(zh("事件 event：A、B", 26)),
                     VGroup(tex(r"P(A)", size=40, color=BLUE), zh("读作“A 的概率”", 24)).arrange(RIGHT, buff=0.2),
                     tex(r"0\le P(A)\le 1", size=36), y=0.65)
        with self.say("b03") as d:
            self.play(DrawBorderThenFill(cA), Write(lA), run_time=1.0)
            self.play(FadeIn(t_ev, shift=LEFT * 0.1), run_time=1.0)
        t_pr = rtext(VGroup(tex(r"P,\ \Pr", size=36), zh("← probability", 22, SOFT)).arrange(RIGHT, buff=0.2), y=-0.55)
        with self.say("b04") as d:
            self.play(FadeIn(t_pr, shift=LEFT * 0.1), run_time=0.8)
        comp = Difference(omega, cA, fill_color=GOLD, fill_opacity=0.28, stroke_width=0)
        lc = tex(r"A^{c}\ \ \text{或}\ \ \bar A", size=36, color=GOLD).move_to(omega.get_center() + RIGHT * 1.8 + DOWN * 1.4)
        t_c = rtext(VGroup(zh("对立事件 · 补事件", 26, GOLD), zh("complement", 20, SOFT)).arrange(RIGHT, buff=0.2),
                    tex(r"P(A^{c})=1-P(A)", size=40, color=GOLD), y=1.2)
        with self.say("b05") as d:
            self.play(FadeOut(VGroup(t_om, t_ev, t_pr)), run_time=0.5)
            self.play(FadeIn(comp), FadeIn(lc), run_time=1.0)
            self.play(FadeIn(t_c, shift=LEFT * 0.1), run_time=0.9)
        cmpb = rtext(VGroup(tex(r"\bar A", size=48, color=GOLD), zh("取补", 26, GOLD)).arrange(RIGHT, buff=0.25),
                     VGroup(tex(r"\bar x", size=48, color=ORANGE), zh("取平均", 26, ORANGE)).arrange(RIGHT, buff=0.25),
                     y=-0.6)
        neq = zh("同样一横，意思不同", 22, SOFT).next_to(cmpb, DOWN, buff=0.2).align_to(cmpb, LEFT)
        with self.say("b06") as d:
            self.play(FadeIn(cmpb, shift=LEFT * 0.1), run_time=0.8)
            self.play(FadeIn(neq), run_time=0.5)

        cB = Circle(radius=1.35, stroke_color=ORANGE, stroke_width=3, fill_color=ORANGE, fill_opacity=0.0) \
            .move_to(omega.get_center() + RIGHT * 0.9)
        lB = tex("B", size=40, color=ORANGE).move_to(cB.get_center() + UR * 0.62)
        uni = Union(cA, cB, fill_color=GREEN, fill_opacity=0.3, stroke_width=0)
        inter = Intersection(cA, cB, fill_color=RED, fill_opacity=0.45, stroke_width=0)
        t_u = rtext(VGroup(tex(r"A\cup B", size=44, color=GREEN), zh("并：至少一个发生", 24)).arrange(RIGHT, buff=0.25),
                    VGroup(tex(r"A\cap B", size=44, color=RED), zh("交：同时发生，也写 AB", 24)).arrange(RIGHT, buff=0.25),
                    y=1.3)
        with self.say("b07") as d:
            self.play(FadeOut(VGroup(comp, lc, t_c, cmpb, neq)), cA.animate.set_fill(opacity=0.0), run_time=0.6)
            self.play(Create(cB), Write(lB), run_time=0.8)
            self.play(FadeIn(uni), FadeIn(t_u[0], shift=LEFT * 0.1), run_time=0.9)
            self.wait(d * 0.2)
            self.play(FadeOut(uni), FadeIn(inter), FadeIn(t_u[1], shift=LEFT * 0.1), run_time=0.9)
        add = tex(r"P(A\cup B)=P(A)+P(B)-P(A\cap B)", size=34).move_to([right_x, -0.2, 0])
        with self.say("b08") as d:
            self.play(Write(add), run_time=1.4)
            self.play(Indicate(inter, color=RED, scale_factor=1.1), Indicate(add[0][-8:], color=RED), run_time=1.2)
        ex = VGroup(tex(r"A\cap B=\varnothing", size=40, color=SOFT), zh("互斥 mutually exclusive", 24, SOFT)) \
            .arrange(RIGHT, buff=0.25).move_to([right_x, -1.4, 0])
        with self.say("b09") as d:
            self.play(FadeOut(inter), cA.animate.shift(LEFT * 0.75), lA.animate.shift(LEFT * 0.75),
                      cB.animate.shift(RIGHT * 0.75), lB.animate.shift(RIGHT * 0.75), run_time=1.0)
            self.play(FadeIn(ex, shift=LEFT * 0.1), run_time=0.8)
            self.wait(d * 0.2)
            self.play(cA.animate.shift(RIGHT * 0.75), lA.animate.shift(RIGHT * 0.75), cB.animate.shift(LEFT * 0.75),
                      lB.animate.shift(LEFT * 0.75), run_time=0.9)
        cond = VGroup(tex(r"P(A\mid B)", size=60, color=INK),
                      zh("在 B 发生的条件下，A 的概率", 24, SOFT)).arrange(DOWN, buff=0.25).move_to([right_x, 1.5, 0])
        bar_n = note(cond[0][0][3], "竖线：给定", direction=UP, size=22, buff=0.3)
        with self.say("b10") as d:
            self.play(FadeOut(VGroup(t_u, add, ex)), run_time=0.5)
            self.play(Write(cond[0]), run_time=0.9)
            self.play(FadeIn(bar_n), FadeIn(cond[1]), run_time=0.8)
        dim = Difference(omega, cB, fill_color=BG, fill_opacity=0.82, stroke_width=0)
        inter2 = Intersection(cA, cB, fill_color=RED, fill_opacity=0.45, stroke_width=0)
        with self.say("b11") as d:
            self.play(FadeIn(dim), cB.animate.set_stroke(width=5), run_time=1.0)
            self.play(FadeIn(inter2), run_time=0.8)
        frac = tex(r"P(A\mid B)=", r"{P(A\cap B)", r"\over", r"P(B)}", size=50).move_to([right_x, -0.6, 0])
        frac[1].set_color(RED)
        frac[3].set_color(ORANGE)
        with self.say("b12") as d:
            self.play(Write(frac), run_time=1.3)
            self.play(Indicate(inter2, color=RED), Indicate(frac[1], color=RED), run_time=0.9)
            self.play(Indicate(cB, color=ORANGE), Indicate(frac[3], color=ORANGE), run_time=0.9)
        self.wait(0.3)
        self.clear(run_time=0.6)


class Bayes(VScene):
    header = HDR

    def construct(self):
        cols, rows, s = 50, 20, 0.17
        sq = VGroup(*[Square(side_length=s, stroke_width=0, fill_color=GRAY, fill_opacity=0.35)
                      for _ in range(cols * rows)]).arrange_in_grid(rows=rows, cols=cols, buff=0.035)
        sq.move_to(DOWN * 0.35)
        rng = np.random.default_rng(3)
        sick = sorted(rng.choice(cols * rows, SICK, replace=False))
        healthy = [i for i in range(cols * rows) if i not in set(sick)]
        tp = sick[:TP]
        fp = sorted(rng.choice(healthy, FP, replace=False))
        top = zh("1000 人，其中 10 人患病", 28).move_to(UP * 2.75)
        with self.say("b13") as d:
            self.play(FadeIn(sq, lag_ratio=0.001), run_time=1.2)
            self.play(FadeIn(top), *[sq[i].animate.set_fill(RED, 0.45) for i in sick], run_time=1.0)
        sens = VGroup(tex(r"P(\text{阳性}\mid\text{患病})=\tfrac{9}{10}=90\%", size=36, color=RED),
                      zh("灵敏度 sensitivity", 22, SOFT)).arrange(RIGHT, buff=0.3).move_to(UP * 2.75)
        with self.say("b14") as d:
            self.play(FadeOut(top), *[sq[i].animate.set_fill(RED, 1.0) for i in tp], run_time=1.0)
            self.play(FadeIn(sens), run_time=0.8)
        fpt = VGroup(zh("健康 990 人中 99 人假阳性", 24, ORANGE),
                     VGroup(zh("特异度 specificity", 22, SOFT), tex(r"=\tfrac{891}{990}=90\%", size=32, color=SOFT))
                     .arrange(RIGHT, buff=0.12)).arrange(RIGHT, buff=0.6).move_to(DOWN * 2.75)
        with self.say("b15") as d:
            self.play(LaggedStart(*[sq[i].animate.set_fill(ORANGE, 0.95) for i in fp], lag_ratio=0.01), run_time=1.6)
            self.play(FadeIn(fpt[0]), run_time=0.6)
            self.wait(d * 0.2)
            self.play(FadeIn(fpt[1]), run_time=0.6)
        pos = [i for i in tp] + list(fp)
        block = VGroup(*[Square(side_length=s * 1.4, stroke_width=0, fill_color=RED if k < TP else ORANGE,
                                fill_opacity=1) for k in range(len(pos))]).arrange_in_grid(rows=9, cols=12, buff=0.05)
        block.move_to(RIGHT * 4.3 + DOWN * 0.1)
        res = VGroup(zh("阳性一共 108 人", 26),
                     tex(r"P(\text{患病}\mid\text{阳性})=\tfrac{9}{108}\approx 8\%", size=38, color=RED)) \
            .arrange(DOWN, buff=0.2).next_to(block, UP, buff=0.3)
        with self.say("b16") as d:
            self.play(FadeOut(sens), FadeOut(fpt), sq.animate.scale(0.62).to_edge(LEFT, buff=0.5).shift(DOWN * 0.2),
                      run_time=0.9)
            self.play(*[TransformFromCopy(sq[i], block[k]) for k, i in enumerate(pos)], run_time=1.4)
            self.play(FadeIn(res[0]), run_time=0.5)
            self.wait(d * 0.25)
            self.play(Write(res[1]), run_time=1.0)
        big = VGroup(VGroup(tex(r"P(\text{阳性}\mid\text{患病})", size=40), tex(r"90\%", size=72, color=RED))
                     .arrange(DOWN, buff=0.25),
                     tex(r"\neq", size=72, color=SOFT),
                     VGroup(tex(r"P(\text{患病}\mid\text{阳性})", size=40), tex(r"8\%", size=72, color=RED))
                     .arrange(DOWN, buff=0.25)).arrange(RIGHT, buff=0.8).move_to(UP * 0.4)
        with self.say("b17") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(big, shift=UP * 0.1), run_time=1.0)
        bayes = tex(r"P(A\mid B)=\frac{P(B\mid A)\,P(A)}{P(B)}", size=56).move_to(UP * 1.2)
        num = tex(r"=\frac{0.9\times 0.01}{0.108}\approx 0.083", size=44, color=SOFT).next_to(bayes, DOWN, buff=0.35)
        name = zh("贝叶斯公式 Bayes' theorem", 26, GOLD).next_to(bayes, UP, buff=0.35)
        with self.say("b18") as d:
            self.play(FadeOut(big), run_time=0.5)
            self.play(Write(bayes), FadeIn(name), run_time=1.4)
            self.play(FadeIn(num, shift=UP * 0.1), run_time=0.9)
        pri = VGroup(tex(r"P(\text{患病})=1\%", size=36, color=BLUE), zh("先验概率 prior", 24, BLUE)).arrange(DOWN, buff=0.12)
        post = VGroup(tex(r"P(\text{患病}\mid\text{阳性})\approx 8\%", size=36, color=RED),
                      zh("后验概率 posterior", 24, RED)).arrange(DOWN, buff=0.12)
        arrow = Arrow(LEFT, RIGHT, color=GOLD).scale(0.8)
        flow = VGroup(pri, VGroup(arrow, zh("看到检测结果", 20, GOLD)).arrange(DOWN, buff=0.08), post) \
            .arrange(RIGHT, buff=0.45).move_to(DOWN * 1.7)
        with self.say("b19") as d:
            self.play(FadeIn(pri, shift=UP * 0.1), run_time=0.8)
            self.wait(d * 0.3)
            self.play(GrowArrow(arrow), FadeIn(flow[1][1]), FadeIn(post, shift=UP * 0.1), run_time=1.0)

        # 独立：A 是竖条，B 是横条，交的面积恰是两者之积
        unit = Square(side_length=3.6, stroke_color=INK, stroke_width=2.5, fill_color=PAPER, fill_opacity=1) \
            .move_to(LEFT * 3.4 + DOWN * 0.2)
        x0, y0 = unit.get_corner(DL)[0], unit.get_corner(DL)[1]
        sA = Rectangle(width=3.6 * 0.4, height=3.6, stroke_width=0, fill_color=BLUE, fill_opacity=0.3) \
            .move_to([x0 + 3.6 * 0.2, unit.get_y(), 0])
        sB = Rectangle(width=3.6, height=3.6 * 0.3, stroke_width=0, fill_color=ORANGE, fill_opacity=0.3) \
            .move_to([unit.get_x(), y0 + 3.6 * 0.15, 0])
        lab = VGroup(tex(r"P(A)=0.4", size=28, color=BLUE).next_to(sA, UP, buff=0.12),
                     tex(r"P(B)=0.3", size=28, color=ORANGE).next_to(sB, LEFT, buff=0.12).rotate(PI / 2))
        ind = VGroup(VGroup(zh("相互独立", 30, GREEN), zh("independent", 20, SOFT)).arrange(RIGHT, buff=0.2),
                     tex(r"P(A\mid B)=P(A)", size=40),
                     tex(r"\Longleftrightarrow\ P(A\cap B)=P(A)\,P(B)", size=40),
                     tex(r"0.12=0.4\times 0.3", size=34, color=SOFT)).arrange(DOWN, buff=0.28, aligned_edge=LEFT) \
            .move_to(RIGHT * 2.9 + UP * 0.5)
        with self.say("b20") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(unit), FadeIn(sA), FadeIn(lab[0]), run_time=0.8)
            self.play(FadeIn(sB), FadeIn(lab[1]), run_time=0.8)
            self.play(FadeIn(ind[0]), Write(ind[1]), run_time=1.0)
            self.play(Write(ind[2]), run_time=1.0)
            self.play(FadeIn(ind[3]), run_time=0.6)
        perp = VGroup(tex(r"A\indep B", size=56, color=GREEN), zh("独立的记号", 22, SOFT)).arrange(RIGHT, buff=0.3) \
            .next_to(ind, DOWN, buff=0.45).align_to(ind, LEFT)
        with self.say("b21") as d:
            self.play(Write(perp[0]), FadeIn(perp[1]), run_time=1.0)
        # 互斥 vs 独立
        a1 = Circle(radius=0.8, color=BLUE, fill_color=BLUE, fill_opacity=0.2)
        b1 = Circle(radius=0.8, color=ORANGE, fill_color=ORANGE, fill_opacity=0.2)
        ex = VGroup(a1, b1).arrange(RIGHT, buff=0.5)
        box_ex = VGroup(ex, zh("互斥", 30, RED), zh("一个发生，另一个必不发生", 22, SOFT),
                        tex(r"P(A\cap B)=0\neq P(A)P(B)", size=30, color=RED)).arrange(DOWN, buff=0.22)
        box_in = VGroup(VGroup(unit, sA, sB).copy().scale(0.5), zh("独立", 30, GREEN), zh("知道一个，不改变另一个", 22, SOFT),
                        tex(r"P(A\cap B)=P(A)P(B)", size=30, color=GREEN)).arrange(DOWN, buff=0.22)
        cmpg = VGroup(on_panel(box_ex, fill=PAPER, min_w=5.2), on_panel(box_in, fill=PAPER, min_w=5.2)) \
            .arrange(RIGHT, buff=0.6).move_to(DOWN * 0.15)
        with self.say("b22") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(cmpg[0], shift=UP * 0.1), run_time=0.9)
            self.play(FadeIn(cmpg[1], shift=UP * 0.1), run_time=0.9)
            self.wait(d * 0.3)
            self.play(Circumscribe(cmpg[0], color=RED, fade_out=True), run_time=1.2)
        self.wait(0.3)
        self.clear(run_time=0.6)
