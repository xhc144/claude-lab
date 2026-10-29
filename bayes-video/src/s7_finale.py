from common import *
from data import POST1, beta_pdf


def mini_curve(f, color, w=2.6, h=1.1):
    a = Axes(x_range=[0, 1, 1], y_range=[0, 1, 1], x_length=w, y_length=h,
             axis_config={"color": DIM, "stroke_width": 1.5, "include_tip": False},
             y_axis_config={"stroke_opacity": 0})
    return VGroup(a, neon_density(a, f, color, width=3, fill=0.15, layers=2))


class Finale(VScene):
    header = "尾声"

    def construct(self):
        plus = glow(VGroup(Rectangle(width=0.2, height=0.8), Rectangle(width=0.8, height=0.2))
                    .set_fill(MAGENTA, 1).set_stroke(MAGENTA, 2), MAGENTA, layers=3)
        slip = on_panel(VGroup(zh("检测结果", 22, SOFT), plus, zh("阳性", 30, MAGENTA)).arrange(DOWN, buff=0.25),
                        pad=0.35, color=MAGENTA, min_w=2.4).move_to(LEFT * 2.2)
        val = VGroup(tex(r"P(\text{有病}\mid\text{阳性})", size=40, color=AMBER), tex(r"\approx 9\%", size=56, color=AMBER))
        val.arrange(DOWN, buff=0.3).next_to(slip, RIGHT, buff=0.9)
        with self.say("z01") as d:
            self.play(FadeIn(slip, scale=0.9), run_time=0.8)
            self.play(FadeIn(val, shift=LEFT * 0.2), run_time=0.8)

        rule = tex(r"\text{后验}", r"\;\propto\;", r"\text{先验}", r"\;\times\;", r"\text{似然}", size=76)
        rule[0].set_color(AMBER)
        rule[2].set_color(CYAN)
        rule[4].set_color(MAGENTA)
        rule.move_to(UP * 2.3)
        with self.say("z02") as d:
            self.play(FadeOut(VGroup(slip, val)), run_time=0.6)
            self.play(Write(rule), run_time=1.4)
            self.add(glow(rule.copy(), layers=3, spread=1.4, strength=0.12))

        cards = VGroup()
        specs = [("先验", "原来知道什么", CYAN, lambda x: float(beta_pdf(x, 6, 9))),
                 ("似然", "证据支持什么", MAGENTA, lambda x: float(beta_pdf(x, 9, 4))),
                 ("后验", "合在一起的判断", AMBER, lambda x: float(beta_pdf(x, 14, 12)))]
        for name, what, c, f in specs:
            m = mini_curve(lambda x, f=f: f(x) / 4.2, c)
            g = VGroup(neon(name, 34, c), m, zh(what, 24, SOFT)).arrange(DOWN, buff=0.25)
            cards.add(on_panel(g, pad=0.35, color=c, min_w=3.5))
        cards.arrange(RIGHT, buff=0.5).move_to(DOWN * 0.4)
        with self.say("z03") as d:
            for k, cd in enumerate(cards):
                self.play(FadeIn(cd, shift=UP * 0.2), run_time=0.6)
                self.wait(max(0.1, d * 0.2))

        loop = CurvedArrow(cards[2].get_bottom() + DOWN * 0.05, cards[0].get_bottom() + DOWN * 0.05, angle=-0.7,
                           color=AMBER, stroke_width=4)
        lt = zh("今天的后验 → 明天的先验", 26, AMBER).next_to(loop, DOWN, buff=0.05)
        with self.say("z04") as d:
            self.play(Create(glow(loop, AMBER, layers=2)), run_time=1.2)
            self.play(FadeIn(lt), run_time=0.5)
        with self.say("z05") as d:
            self.play(Indicate(rule, color=WHITE_HOT, scale_factor=1.05), run_time=1.2)

        # 片尾
        self.clear(run_time=1.0)
        title = zh("贝叶斯统计", 96, INK, weight=BOLD).move_to(UP * 0.6)
        lit = glow(title, CYAN, layers=4, spread=2.0, strength=0.22)
        sub = zh("让证据改变判断", 32, SOFT).next_to(title, DOWN, buff=0.4)
        cred = zh("动画 Manim · 配音 通义千问语音合成 · Claude Lab", 22, DIM).to_edge(DOWN, buff=0.9)
        rng = np.random.default_rng(12)
        motes = VGroup(*[Dot([rng.uniform(-7, 7), rng.uniform(-4, 4), 0], radius=rng.uniform(0.012, 0.03),
                             color=[CYAN, MAGENTA, AMBER, VIOLET][k % 4]).set_opacity(rng.uniform(0.3, 0.9))
                         for k in range(160)])
        self.hit()
        self.play(FadeIn(lit, scale=1.04), FadeIn(motes, lag_ratio=0.004), run_time=1.2)
        self.play(FadeIn(sub, shift=UP * 0.15), FadeIn(cred), motes.animate.shift(UP * 0.4), run_time=1.2)
        self.play(motes.animate.shift(UP * 0.5).set_opacity(0.2), run_time=2.6, rate_func=linear)
        self.play(FadeOut(VGroup(lit, sub, cred, motes)), run_time=1.4)
