"""尾声：回到开头那一段，逐句读出来。"""
from common import *
from s00_opening import paper


class Finale(VScene):
    header = "尾声"

    def construct(self):
        pg = paper(40).scale(0.88).move_to(UP * 0.95)
        page, rule, body = pg
        l1, l2, l3, l4, l5 = body
        with self.say("f01") as d:
            self.play(FadeIn(page, shift=UP * 0.2), Create(rule), FadeIn(body), run_time=1.0)

        def explain(key, mobs, color, lines_):
            txt = VGroup(*[zh(t, 26, c) if isinstance(t, str) else t for t, c in lines_]).arrange(DOWN, buff=0.14)
            txt.move_to(DOWN * 2.15)
            bx = VGroup(*[boxed(m, color, buff=0.06) for m in mobs])
            return bx, txt

        steps = [
            ("f02", [l1], BLUE, [("X₁…X₁₆ 独立同分布、服从正态：16 个面包的重量是简单随机样本", INK),
                                 ("μ 和 σ 是不知道的参数（希腊字母）", BLUE)]),
            ("f03", [l2], ORANGE, [("H₀：原假设 μ = 500　H₁：备择假设 μ ≠ 500", INK), ("“不等于”：双侧检验", ORANGE)]),
            ("f04", [l3], GOLD, [(VGroup(tex(r"\hat\mu=\bar x=494", size=36), zh("：用样本均值估计 μ；s = 10 是样本标准差", 26))
                                  .arrange(RIGHT, buff=0.1), INK),
                                 ("t = −2.4，H₀ 成立时服从自由度 15 的 t 分布", GOLD)]),
            ("f05", [l4], RED, [("p ≈ 0.03 ≤ α = 0.05", INK), ("拒绝原假设", RED)]),
            ("f06", [l5[0], l5[1]], GREEN, [("95% 置信区间 [488.7, 499.3] 不含 500", INK), ("与检验结论一致", GREEN)]),
            ("f07", [l5[3]], BLUE, [("效应量 d = 0.6：平均轻了 0.6 个标准差", INK)]),
        ]
        prev = None
        for key, mobs, color, lines_ in steps:
            bx, txt = explain(key, mobs, color, lines_)
            with self.say(key) as d:
                anims = [Create(bx), FadeIn(txt, shift=UP * 0.1)]
                if prev:
                    anims += [FadeOut(prev[0]), FadeOut(prev[1])]
                self.play(*anims, run_time=0.9)
            prev = (bx, txt)
        msg = VGroup(zh("认准定义，比记住字母更要紧", 40, GOLD),
                     zh("同一个字母，在不同的书里可能是不同的意思", 26, SOFT)).arrange(DOWN, buff=0.3).move_to(UP * 0.2)
        with self.say("f08") as d:
            self.play(FadeOut(prev[0]), FadeOut(prev[1]), FadeOut(pg), run_time=0.8)
            self.play(FadeIn(msg, shift=UP * 0.1), run_time=1.0)
        title = serif("统计的符号与术语", 68).move_to(UP * 0.5)
        bar = Line(LEFT * 1.8, RIGHT * 1.8, color=GOLD, stroke_width=3).next_to(title, DOWN, buff=0.45)
        cred = zh("配音：通义千问语音合成", 22, SOFT).next_to(bar, DOWN, buff=0.4)
        with self.say("f09") as d:
            self.play(FadeOut(msg), run_time=0.6)
            self.play(Write(title), Create(bar), run_time=1.2)
            self.play(FadeIn(cred), run_time=0.6)
        self.wait(2.0)
        self.play(FadeOut(VGroup(title, bar, cred)), run_time=1.0)
        self.wait(0.5)
