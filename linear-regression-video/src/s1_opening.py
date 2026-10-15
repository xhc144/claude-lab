"""开场：十个点，哪条线最好？"""
from common import *


class Opening(VScene):
    def construct(self):
        pl = Plot()
        dots = pl.dots()
        tgt = [d.get_center().copy() for d in dots]
        for d in dots:
            d.shift(UP * 5)
        with self.say("o01") as d:
            self.play(FadeIn(pl.frame()), run_time=1.0)
            self.play(LaggedStart(*[x.animate(rate_func=rate_functions.ease_out_cubic).move_to(p)
                                    for x, p in zip(dots, tgt)], lag_ratio=0.12), run_time=min(3.0, d - 1.2))
        self.line("o02")

        q = serif("用一条直线概括这个关系？", 36).to_edge(UP, buff=0.35)
        with self.say("o03") as d:
            self.play(FadeIn(q, shift=DOWN * 0.15), run_time=0.8)

        a, b = ValueTracker(44.0), ValueTracker(4.9)
        cand = always_redraw(lambda: pl.line(a.get_value(), b.get_value(), color=GRAY, width=4))
        with self.say("o04") as d:
            self.play(Create(cand), run_time=0.9)
            self.wait(d * 0.25)
            self.play(a.animate.set_value(56.0), b.animate.set_value(3.3), run_time=1.4)
        cand.clear_updaters()

        others = VGroup(*[pl.line(aa, bb, color=GRAY, width=2.2).set_opacity(0.55)
                          for aa, bb in [(48, 4.5), (53, 3.7), (50, 4.2), (46, 4.6), (55, 3.4), (52, 3.9)]])
        q2 = serif("什么叫“最好”？", 40).to_edge(UP, buff=0.35)
        with self.say("o05") as d:
            self.play(LaggedStart(*[Create(o) for o in others], lag_ratio=0.15), run_time=1.6)
            self.play(ReplacementTransform(q, q2), run_time=0.8)

        title = serif("线性回归", 76).move_to(UP * 0.5)
        sub = zh("从一条直线，到一次投影", 34, SOFT).next_to(title, DOWN, buff=0.45)
        bar = Line(LEFT * 1.6, RIGHT * 1.6, color=GOLD, stroke_width=3).next_to(sub, DOWN, buff=0.4)
        with self.say("o06") as d:
            self.wait(d * 0.45)
            self.play(FadeOut(VGroup(pl.frame(), dots, cand, others, q2)), run_time=0.8)
            self.play(Write(title), run_time=1.2)
            self.play(FadeIn(sub, shift=UP * 0.1), Create(bar), run_time=0.8)
        self.wait(1.2)
        self.play(FadeOut(VGroup(title, sub, bar)), run_time=0.8)
