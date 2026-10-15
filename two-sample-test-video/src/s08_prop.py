"""08 数人头（两比例 Z 检验，拓展）"""
from common import *
from data import RIGHT_NEW, RIGHT_OLD


def grid(k, color, cell=0.34, gap=0.07):
    g = VGroup()
    for i in range(40):
        r, c = divmod(i, 8)
        sq = Square(cell, stroke_width=1.5, stroke_color=LINE)
        if i < k:
            sq.set_fill(color, 0.85).set_stroke(color, 1.5)
        sq.move_to([c * (cell + gap), -r * (cell + gap), 0])
        g.add(sq)
    return g


class Proportion(VScene):
    header = "两个比例 · Z 检验（拓展）"

    def construct(self):
        card = VGroup(serif("附加题", 52), zh("做对，还是做错", 28, SOFT)).arrange(DOWN, buff=0.3).move_to(UP * 0.4)
        with self.say("h01") as d:
            self.play(FadeIn(card[0], shift=UP * 0.1), run_time=0.8)
        with self.say("h02") as d:
            self.play(FadeIn(card[1]), run_time=0.6)

        gn, go = grid(RIGHT_NEW, BLUE), grid(RIGHT_OLD, ORANGE)
        gn.move_to(LEFT * 3.4 + UP * 0.2)
        go.move_to(RIGHT * 3.4 + UP * 0.2)
        ln = VGroup(zh("新方法", 28, BLUE), tex(r"26/40=65\%", size=40, color=BLUE)).arrange(RIGHT, buff=0.3).next_to(gn, DOWN, buff=0.4)
        lo = VGroup(zh("旧方法", 28, ORANGE), tex(r"16/40=40\%", size=40, color=ORANGE)).arrange(RIGHT, buff=0.3).next_to(go, DOWN, buff=0.4)
        with self.say("h03") as d:
            self.play(FadeOut(card), run_time=0.5)
            self.play(LaggedStart(*[FadeIn(s, scale=0.8) for s in gn], lag_ratio=0.03), FadeIn(ln), run_time=d * 0.4)
            self.play(LaggedStart(*[FadeIn(s, scale=0.8) for s in go], lag_ratio=0.03), FadeIn(lo), run_time=d * 0.4)

        ones = VGroup(*[tex("1" if i < RIGHT_NEW else "0", size=24, color=BG if i < RIGHT_NEW else SOFT).move_to(s)
                        for i, s in enumerate(gn)])
        mean = tex(r"\hat p_1=\frac{1+1+\cdots+0}{40}", size=40).next_to(gn, UP, buff=0.35)
        with self.say("h04") as d:
            self.play(FadeIn(ones, lag_ratio=0.02), run_time=1.2)
            self.wait(d * 0.25)
            self.play(FadeIn(mean), run_time=0.7)

        skel = frac(tex(r"\hat p_1-\hat p_2", size=48, color=GOLD), tex(r"\text{差平常抖多大}", size=40, color=SOFT),
                    tex(r"Z=", size=48)).move_to(UP * 2.4)
        with self.say("h05") as d:
            self.play(FadeOut(VGroup(ones, mean)), VGroup(gn, go, ln, lo).animate.shift(DOWN * 0.7), run_time=0.7)
            self.play(Write(skel), run_time=1.2)
        var = tex(r"\operatorname{Var}=p(1-p)", size=44).next_to(skel, RIGHT, buff=0.9)
        for g in find_glyphs(var, "p"):
            g.set_color(RED)
        with self.say("h06") as d:
            self.play(FadeIn(var), run_time=0.8)
        q = self.pause_q("p 用 65%，还是 40%？", pos=UP * 1.0)
        with self.say("h07") as d:
            x1 = Cross(ln[1], stroke_color=RED, stroke_width=4)
            x2 = Cross(lo[1], stroke_color=RED, stroke_width=4)
            self.play(Create(x1), Create(x2), run_time=0.7)
        with self.say("h08") as d:
            self.play(FadeOut(q), FadeOut(x1), FadeOut(x2), run_time=0.5)
            self.play(gn.animate.next_to(ORIGIN, LEFT, buff=0.04).shift(UP * 0.1),
                      go.animate.next_to(ORIGIN, RIGHT, buff=0.04).shift(UP * 0.1),
                      FadeOut(ln), FadeOut(lo), run_time=1.4)
        allg = VGroup(*gn, *go)
        pooled = VGroup(tex(r"\hat p=\frac{26+16}{40+40}=\frac{42}{80}=52.5\%", size=44)).next_to(allg, DOWN, buff=0.35)
        with self.say("h09") as d:
            self.wait(d * 0.35)
            self.play(*[s.animate.set_fill(GOLD, 0.85).set_stroke(GOLD, 1.5) for s in allg if s.get_fill_opacity() > 0.5],
                      run_time=0.9)
            self.play(Write(pooled), run_time=1.2)
        same = VGroup(tex(r"S_w", size=44, color=SOFT), zh("与", 26, SOFT), tex(r"\hat p", size=44, color=GOLD),
                      zh("：原假设说两边一样，就按一样来估", 26, SOFT)).arrange(RIGHT, buff=0.2)
        same.next_to(pooled, DOWN, buff=0.35)
        with self.say("h10") as d:
            self.play(FadeIn(same), run_time=0.8)

        z = tex(r"Z=\frac{\hat p_1-\hat p_2}{\sqrt{\hat p(1-\hat p)\left(\frac1{n_1}+\frac1{n_2}\right)}}=\frac{0.65-0.40}{0.112}\approx 2.24",
                size=46).move_to(UP * 2.0)
        plot, mk = t_test_plot(None, 2.24, 1.96, x0=-4, x1=4, width=10, center=DOWN * 1.0, label=r"N(0,1)")
        with self.say("h11") as d:
            self.play(FadeOut(VGroup(skel, var, allg, pooled, same)), run_time=0.6)
            self.play(Write(z), run_time=1.2)
            self.play(FadeIn(plot), run_time=0.6)
            mk.shift(UP * 2)
            self.add(mk)
            self.play(mk.animate.shift(DOWN * 2), run_time=0.6, rate_func=rate_functions.ease_in_quad)
        clt = VGroup(zh("中心极限定理：0 和 1 加起来，样本一大就近似正态", 26, SOFT)).to_corner(DR, buff=0.5).shift(UP * 0.55)
        with self.say("h12") as d:
            self.play(Flash(mk, color=GOLD, line_length=0.2, num_lines=12), run_time=0.6)
            self.play(FadeIn(clt), run_time=0.7)
        chk = VGroup(
            zh("用前看一眼：做对、做错的人数都不少于 5", 28, INK),
            tex(r"26,\ 14\qquad 16,\ 24\quad\checkmark", size=40, color=GOLD),
        ).arrange(DOWN, buff=0.25).move_to(UP * 0.1)
        with self.say("h13") as d:
            self.play(FadeOut(VGroup(plot, mk, clt)), run_time=0.5)
            self.play(FadeIn(chk[0]), run_time=0.6)
            self.play(FadeIn(chk[1]), run_time=0.6)
        self.wait(0.6)
        self.play(FadeOut(VGroup(z, chk)), run_time=1.0)
        self.wait(0.4)
