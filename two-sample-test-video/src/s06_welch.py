"""06 侧门：两个方差不一样（Welch，拓展）"""
from common import *


class Welch(VScene):
    header = "方差不等 · Welch t 检验（拓展）"

    def construct(self):
        self.add_ghost()
        ne = tex(r"\sigma_1\neq\sigma_2", size=80).move_to(UP * 0.5)
        with self.say("f01") as d:
            self.play(FadeIn(ne, scale=0.95), run_time=0.9)
        cant = zh("约不掉", 34, RED).next_to(ne, DOWN, buff=0.45)
        with self.say("f02") as d:
            self.play(find_glyphs(ne, r"\sigma").animate.set_color(RED), run_time=0.6)
            self.play(FadeIn(cant), run_time=0.6)

        name = serif("Behrens–Fisher 问题", 56).move_to(UP * 0.6)
        rule = Line(LEFT * 2.6, RIGHT * 2.6, color=GOLD, stroke_width=2).next_to(name, DOWN, buff=0.2)
        sub = zh("没有一个让所有人满意的精确解", 30, SOFT).next_to(rule, DOWN, buff=0.35)
        with self.say("f03") as d:
            self.play(FadeOut(VGroup(ne, cant)), run_time=0.5)
            self.play(FadeIn(name, shift=UP * 0.1), Create(rule), run_time=1.0)
            self.wait(d * 0.3)
            self.play(FadeIn(sub), run_time=0.7)

        T = tex(r"T=\frac{\bar X-\bar Y}{\sqrt{S_1^2/n_1+S_2^2/n_2}}", size=50)
        nu = tex(r"\nu\approx\frac{\left(S_1^2/n_1+S_2^2/n_2\right)^2}{\dfrac{(S_1^2/n_1)^2}{n_1-1}+\dfrac{(S_2^2/n_2)^2}{n_2-1}}", size=42)
        VGroup(T, nu).arrange(RIGHT, buff=1.0).move_to(UP * 1.4)
        lab1 = zh("各用各的方差", 26, SOFT).next_to(T, DOWN, buff=0.3)
        lab2 = zh("自由度用公式去凑", 26, SOFT).next_to(nu, DOWN, buff=0.3)
        with self.say("f04") as d:
            self.play(FadeOut(VGroup(name, rule, sub)), run_time=0.5)
            self.play(Write(T), run_time=1.0)
            self.play(FadeIn(lab1), run_time=0.5)
            self.play(Write(nu), run_time=1.2)
            self.play(FadeIn(lab2), run_time=0.5)

        eqn = tex(r"n_1=n_2=n:\quad", r"S_w^2\left(\frac1n+\frac1n\right)", "=", r"\frac{S_1^2+S_2^2}{2}\cdot\frac2n",
                  "=", r"\frac{S_1^2}{n}+\frac{S_2^2}{n}", size=44)
        eqn.move_to(DOWN * 1.1)
        eqn[1].set_color(INK)
        eqn[5].set_color(GOLD)
        with self.say("f05") as d:
            self.play(Write(eqn[0]), run_time=0.6)
            self.play(Write(eqn[1]), run_time=0.8)
            self.play(Write(eqn[2:4]), run_time=0.9)
            self.play(Write(eqn[4:]), run_time=0.9)
            box = SurroundingRectangle(eqn[5], color=GOLD, buff=0.1, corner_radius=0.06, stroke_width=2)
            self.play(Create(box), run_time=0.6)
        df = VGroup(zh("自由度", 28, SOFT), tex(r"78", size=40), zh("对", 28, SOFT), tex(r"\approx 76.9", size=40)).arrange(RIGHT, buff=0.25)
        df.next_to(eqn, DOWN, buff=0.5)
        with self.say("f06") as d:
            self.play(FadeIn(df), run_time=0.7)
        big = VGroup(zh("样本够大：", 30, INK), tex(r"T\approx N(0,1)", size=44)).arrange(RIGHT, buff=0.3)
        big.move_to(DOWN * 1.1)
        with self.say("f07") as d:
            self.play(FadeOut(VGroup(eqn, box, df)), run_time=0.5)
            self.play(FadeIn(big), run_time=0.7)
        tip = zh("实际研究：常直接用 Welch　考试：按课本流程", 26, SOFT).next_to(big, DOWN, buff=0.55)
        with self.say("f08") as d:
            self.play(FadeIn(tip), run_time=0.7)
        self.wait(0.6)
        self.play(FadeOut(VGroup(T, nu, lab1, lab2, big, tip)), run_time=1.0)
        self.wait(0.4)
