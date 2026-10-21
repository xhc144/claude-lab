"""七 · 参数估计：点估计与区间估计、偏差、MSE、相合性、最大似然（Π、分号、argmax、ℓ）；置信区间及其含义。"""
from common import *

HDR = "七 · 参数估计"


def target(bias, spread, seed):
    rings = VGroup(*[Circle(radius=r, stroke_color=LINE if i % 2 else GRAY, stroke_width=2) for i, r in
                     enumerate((1.0, 0.7, 0.4))])
    bull = Dot(radius=0.07, color=RED)
    rng = np.random.default_rng(seed)
    hits = VGroup(*[Dot([bias[0] + rng.normal(0, spread), bias[1] + rng.normal(0, spread), 0], radius=0.045, color=BLUE)
                    for _ in range(12)])
    return VGroup(rings, bull, hits)


class Estimation(VScene):
    header = HDR

    def construct(self):
        nl = NumberLine(x_range=[0.3, 0.9, 0.1], length=8, color=LINE, include_numbers=False, tick_size=0.05).move_to(UP * 0.3)
        pe = Dot(nl.n2p(0.62), radius=0.11, color=ORANGE)
        pe_l = VGroup(zh("点估计 point estimate", 24, ORANGE), tex(r"\hat\theta=0.62", size=34, color=ORANGE)) \
            .arrange(DOWN, buff=0.1).next_to(pe, UP, buff=0.3)
        lo, hi = nl.n2p(0.55), nl.n2p(0.69)
        ie = VGroup(Line(lo, hi, color=BLUE, stroke_width=6), Line(lo + UP * 0.15, lo + DOWN * 0.15, color=BLUE, stroke_width=4),
                    Line(hi + UP * 0.15, hi + DOWN * 0.15, color=BLUE, stroke_width=4)).shift(DOWN * 1.3)
        ie_l = VGroup(zh("区间估计 interval estimate", 24, BLUE), tex(r"[0.55,\ 0.69]", size=34, color=BLUE)) \
            .arrange(DOWN, buff=0.1).next_to(ie, DOWN, buff=0.3)
        with self.say("e01") as d:
            self.play(Create(nl), run_time=0.6)
            self.play(FadeIn(pe, scale=0.5), FadeIn(pe_l), run_time=0.9)
            self.wait(d * 0.25)
            self.play(Create(ie), FadeIn(ie_l), run_time=0.9)
        ax = axes((-3, 5, 1), (0, 0.45, 0.1), 8.0, 2.4, center=DOWN * 0.9, y_axis=False)
        mu = ValueTracker(0.0)
        bell = always_redraw(lambda: curve(ax, lambda x: npdf(x, mu.get_value(), 0.9), -3, 5, color=ORANGE))
        th = DashedLine(ax.c2p(0, 0), ax.c2p(0, 0.5), color=BLUE, dash_length=0.07)
        th_l = tex(r"\theta", size=36, color=BLUE).next_to(ax.c2p(0, 0), DOWN, buff=0.15)
        smp = VGroup(zh("估计量", 26, ORANGE), tex(r"\hat\theta", size=40, color=ORANGE), zh("的抽样分布", 26, ORANGE)) \
            .arrange(RIGHT, buff=0.15).move_to(UP * 1.9)
        with self.say("e02") as d:
            self.clear(run_time=0.6)
            self.play(Create(ax), Create(th), FadeIn(th_l), run_time=0.8)
            self.play(Create(bell), FadeIn(smp), run_time=1.2)
        bias_f = VGroup(tex(r"\text{Bias}(\hat\theta)=E(\hat\theta)-\theta", size=42),
                        zh("偏差为 0：无偏 unbiased", 24, GREEN)).arrange(DOWN, buff=0.15).move_to(UP * 1.9)
        with self.say("e03") as d:
            self.play(FadeOut(smp), mu.animate.set_value(1.5), run_time=1.2)
            ar = always_redraw(lambda: DoubleArrow(ax.c2p(0, 0.47), ax.c2p(mu.get_value(), 0.47), buff=0, color=RED,
                                                   stroke_width=3, tip_length=0.15))
            self.add(ar)
            self.play(Write(bias_f[0]), run_time=1.2)
            self.wait(d * 0.15)
            self.play(mu.animate.set_value(0.0), FadeIn(bias_f[1]), run_time=1.2)
            self.remove(ar)
        bell.clear_updaters()
        cols = [("无偏", (0, 0)), ("有偏", (0.42, 0.3))]
        rows = [("方差小", 0.12), ("方差大", 0.33)]
        tg = VGroup()
        for r, (rn, sp) in enumerate(rows):
            for c, (cn, b) in enumerate(cols):
                tg.add(target(b, sp, 10 + 2 * r + c))
        tg.arrange_in_grid(rows=2, cols=2, buff=(0.8, 0.35)).scale(0.95).move_to(LEFT * 2.0 + DOWN * 0.35)
        clab = VGroup(*[zh(cn, 24, SOFT).next_to(tg[c], UP, buff=0.12) for c, (cn, _) in enumerate(cols)])
        rlab = VGroup(*[zh(rn, 24, SOFT).next_to(tg[2 * r], LEFT, buff=0.3) for r, (rn, _) in enumerate(rows)])
        expl = VGroup(zh("偏差：弹孔整体偏离靶心多远", 24), zh("方差：弹孔散得有多开", 24)).arrange(DOWN, buff=0.2, aligned_edge=LEFT) \
            .move_to(RIGHT * 4.0 + UP * 0.9)
        with self.say("e04") as d:
            self.clear(run_time=0.6)
            self.play(LaggedStart(*[FadeIn(t) for t in tg], lag_ratio=0.25), FadeIn(clab), FadeIn(rlab), run_time=1.6)
            self.play(FadeIn(expl, shift=LEFT * 0.1), run_time=0.9)
        mse = VGroup(tex(r"\text{MSE}(\hat\theta)=E\big[(\hat\theta-\theta)^2\big]", size=36),
                     tex(r"=\Var(\hat\theta)+\text{Bias}(\hat\theta)^2", size=36), zh("均方误差 mean squared error", 22, SOFT)) \
            .arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(expl, DOWN, buff=0.45).align_to(expl, LEFT)
        with self.say("e05") as d:
            self.play(Write(mse[0]), run_time=1.2)
            self.play(Write(mse[1]), FadeIn(mse[2]), run_time=1.2)
        s2 = VGroup(VGroup(tex(r"E(s^2)=\sigma^2", size=46, color=GREEN), zh("无偏", 26, GREEN)).arrange(RIGHT, buff=0.3),
                    VGroup(tex(r"E(s)<\sigma", size=46, color=RED), zh("略微偏小（正态、n = 7 时约 0.96σ）", 24, RED))
                    .arrange(RIGHT, buff=0.3)).arrange(DOWN, buff=0.4, aligned_edge=LEFT).move_to(UP * 0.4)
        with self.say("e06") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(s2[0], shift=UP * 0.1), run_time=0.9)
            self.wait(d * 0.2)
            self.play(FadeIn(s2[1], shift=UP * 0.1), run_time=0.9)
        ax2 = axes((-2, 2, 1), (0, 4.2, 1), 7.0, 2.6, center=DOWN * 1.05 + LEFT * 1.6, y_axis=False)
        cs = VGroup(*[curve(ax2, lambda x, s=s: npdf(x, 0, s), -2, 2, color=c, width=3) for s, c in
                      ((0.8, GRAY), (0.3, GOLD), (0.1, ORANGE))])
        leg = VGroup(*[tex(f"n={n}", size=28, color=c) for n, c in ((10, GRAY), (100, GOLD), (1000, ORANGE))]) \
            .arrange(DOWN, buff=0.08, aligned_edge=LEFT).next_to(ax2.c2p(0.4, 3.6), RIGHT, buff=0.2)
        thl = tex(r"\theta", size=32, color=BLUE).next_to(ax2.c2p(0, 0), DOWN, buff=0.12)
        cons = VGroup(VGroup(zh("相合性 · 一致性", 26, ORANGE), zh("consistency", 20, SOFT)).arrange(RIGHT, buff=0.2),
                      tex(r"\hat\theta\xrightarrow{\ P\ }\theta", size=40, color=ORANGE),
                      VGroup(zh("有效性", 26, BLUE), zh("efficiency：无偏里方差小者更有效", 20, SOFT)).arrange(RIGHT, buff=0.2)) \
            .arrange(DOWN, buff=0.22, aligned_edge=LEFT).move_to(RIGHT * 4.2 + DOWN * 0.9)
        with self.say("e07") as d:
            self.play(s2.animate.scale(0.75).to_edge(UP, buff=0.8), run_time=0.6)
            self.play(Create(ax2), FadeIn(thl), LaggedStart(*[Create(c) for c in cs], lag_ratio=0.4), FadeIn(leg), run_time=1.8)
            self.play(FadeIn(cons[:2]), run_time=0.8)
            self.wait(d * 0.15)
            self.play(FadeIn(cons[2]), run_time=0.7)

        # ------------------------------------------------ 最大似然
        mle = VGroup(zh("最大似然估计", 34, GOLD), zh("maximum likelihood estimation · MLE", 22, SOFT)).arrange(DOWN, buff=0.12) \
            .move_to(UP * 0.4)
        with self.say("e08") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(mle, shift=UP * 0.1), run_time=0.9)
        heads = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1]
        coins = VGroup(*[coin(h, 0.24) for h in heads]).arrange(RIGHT, buff=0.12).move_to(UP * 2.35)
        q = zh("7 次正面：p 取多少最能解释？", 24, SOFT).next_to(coins, DOWN, buff=0.2)
        with self.say("e09") as d:
            self.play(mle.animate.scale(0.6).to_corner(UR, buff=0.4).shift(DOWN * 0.1), run_time=0.6)
            self.play(LaggedStart(*[FadeIn(c, scale=0.5) for c in coins], lag_ratio=0.12), run_time=1.6)
            self.play(FadeIn(q), run_time=0.6)
        L = lambda p: p ** 7 * (1 - p) ** 3
        lax = axes((0, 1, 0.1), (0, 0.0025, 0.001), 6.4, 2.6, center=LEFT * 2.6 + DOWN * 0.95)
        lx = VGroup(*[tex(f"{v:g}", size=22, color=SOFT).next_to(lax.c2p(v, 0), DOWN, buff=0.1) for v in (0, 0.2, 0.4, 0.6, 0.8, 1)])
        lc = curve(lax, L, 0, 1, color=ORANGE)
        pl = tex("p", size=28, color=SOFT).next_to(lax.c2p(1, 0), RIGHT, buff=0.15)
        Lf = tex(r"L(p)=p^7(1-p)^3", size=42, color=ORANGE).move_to(RIGHT * 3.6 + UP * 1.0)
        Ll = zh("似然函数 likelihood", 22, SOFT).next_to(Lf, DOWN, buff=0.12)
        with self.say("e10") as d:
            self.play(FadeOut(q), Write(Lf), FadeIn(Ll), run_time=1.2)
            self.play(Create(lax), FadeIn(lx), FadeIn(pl), Create(lc), run_time=1.4)
        gen = tex(r"L(\theta)=", r"\prod_{i=1}^{n}", r"f(x_i", r";", r"\,\theta)", size=46).move_to(RIGHT * 3.6 + DOWN * 0.6)
        pin = VGroup(note(gen[1], "Π：连乘", DOWN, GOLD, 22, 0.25), )
        pair = VGroup(tex(r"\sum", size=40, color=SOFT), zh("连加", 20, SOFT), tex(r"\prod", size=40, color=GOLD),
                      zh("连乘", 20, GOLD)).arrange(RIGHT, buff=0.15).next_to(gen, DOWN, buff=0.85)
        with self.say("e11") as d:
            self.play(Write(gen), run_time=1.3)
            self.play(FadeIn(pin), run_time=0.7)
            self.wait(d * 0.2)
            self.play(FadeIn(pair), run_time=0.8)
        semi = note(gen[3], "分号：θ 是参数", UP, RED, 22, 0.25).shift(RIGHT * 0.35)
        with self.say("e12") as d:
            self.play(Indicate(gen[3], color=RED, scale_factor=1.6), FadeIn(semi), run_time=1.2)
        top_pt = Dot(lax.c2p(0.7, L(0.7)), radius=0.09, color=GOLD)
        drop = DashedLine(lax.c2p(0.7, L(0.7)), lax.c2p(0.7, 0), color=GOLD, dash_length=0.06)
        phat = tex(r"\hat p=0.7", size=34, color=GOLD).next_to(top_pt, UP, buff=0.15)
        with self.say("e13") as d:
            self.play(FadeOut(VGroup(pin, pair, semi)), run_time=0.4)
            self.play(FadeIn(top_pt, scale=0.5), Create(drop), run_time=0.9)
            self.play(Write(phat), run_time=0.7)
        am = tex(r"\hat p=\argmax_{p}\,L(p)", size=44, color=GOLD).move_to(RIGHT * 3.6 + DOWN * 0.6)
        across = DashedLine(lax.c2p(0, L(0.7)), lax.c2p(0.7, L(0.7)), color=SOFT, dash_length=0.06)
        mx_l = zh("max：最大值", 20, SOFT).next_to(lax.c2p(0, L(0.7)), RIGHT, buff=0.1).shift(UP * 0.18)
        am_l = zh("argmax：取到最大的位置", 20, GOLD).next_to(lax.c2p(0.7, 0), DOWN, buff=0.45)
        with self.say("e14") as d:
            self.play(ReplacementTransform(gen, am), run_time=1.0)
            self.play(Create(across), FadeIn(mx_l), run_time=0.8)
            self.play(FadeIn(am_l), run_time=0.7)
        ll = tex(r"\ell(p)=\ln L(p)=7\ln p+3\ln(1-p)", size=34, color=BLUE).next_to(am, DOWN, buff=0.4)
        lnote = zh("统计里 log 通常就是自然对数 ln", 20, SOFT).next_to(ll, DOWN, buff=0.15)
        with self.say("e15") as d:
            self.play(Write(ll), run_time=1.4)
            self.play(FadeIn(lnote), run_time=0.6)
        notp = VGroup(tex(r"\int_0^1 L(p)\,dp\approx 0.00076\neq 1", size=36, color=RED),
                      zh("似然不是 p 的概率分布", 24, RED)).arrange(DOWN, buff=0.12).move_to(RIGHT * 3.6 + UP * 1.0)
        with self.say("e16") as d:
            self.play(FadeOut(VGroup(Lf, Ll)), run_time=0.4)
            self.play(FadeIn(notp, shift=UP * 0.1), run_time=1.0)
        self.wait(0.3)
        self.clear(run_time=0.6)


def ci_runs(k=100, n=25, misses=5):
    """找一组恰好有 misses 个区间没盖住 μ = 0 的模拟（σ = 1 已知，95% 区间）。"""
    half = 1.96 / math.sqrt(n)
    for seed in range(1000):
        xb = np.random.default_rng(seed).normal(0, 1, (k, n)).mean(axis=1)
        miss = np.abs(xb) > half
        if miss.sum() == misses:
            return xb, half, miss
    raise RuntimeError


class Interval(VScene):
    header = HDR

    def construct(self):
        f1 = tex(r"\bar x\pm 1.96\cdot\frac{\sigma}{\sqrt n}", size=58).move_to(UP * 1.8)
        se_n = note(f1[0][7:], "标准误", DOWN, SOFT, 22, 0.25)
        with self.say("e17") as d:
            self.play(Write(f1), run_time=1.3)
            self.play(FadeIn(se_n), run_time=0.6)
        f2 = tex(r"\bar x", r"\pm", r"z_{\alpha/2}\cdot\frac{\sigma}{\sqrt n}", size=58).move_to(UP * 1.8)
        br = Brace(f2[2], DOWN, color=ORANGE)
        br_l = VGroup(zh("误差范围 · 边际误差", 24, ORANGE), zh("margin of error", 20, SOFT)).arrange(DOWN, buff=0.08).next_to(br, DOWN, buff=0.1)
        lvl = VGroup(tex(r"1-\alpha", size=42, color=BLUE), zh("置信水平 confidence level（如 95%）", 24, BLUE)).arrange(RIGHT, buff=0.3) \
            .move_to(DOWN * 0.9)
        with self.say("e18") as d:
            self.play(FadeOut(se_n), TransformMatchingShapes(f1, f2), run_time=1.2)
            self.play(FadeIn(lvl, shift=UP * 0.1), run_time=0.8)
            self.wait(d * 0.15)
            self.play(GrowFromCenter(br), FadeIn(br_l), run_time=0.9)
        f3 = VGroup(zh("σ 未知：", 26, SOFT), tex(r"\bar x\pm t_{\alpha/2}(n-1)\cdot\frac{s}{\sqrt n}", size=50, color=BLUE)) \
            .arrange(RIGHT, buff=0.3).move_to(DOWN * 2.1)
        with self.say("e19") as d:
            self.play(FadeIn(f3, shift=UP * 0.1), run_time=1.1)

        xb, half, miss = ci_runs()
        yc, scale = DOWN * 0.2, 2.0
        x0, dx = -6.2, 0.124
        mu_line = DashedLine([x0 - 0.2, yc[1], 0], [x0 + 99 * dx + 0.2, yc[1], 0], color=GOLD, dash_length=0.08)
        mu_l = tex(r"\mu", size=34, color=GOLD).next_to(mu_line, LEFT, buff=0.1)
        segs = VGroup()
        for i, (m, bad) in enumerate(zip(xb, miss)):
            x = x0 + i * dx
            segs.add(Line([x, yc[1] + (m - half) * scale, 0], [x, yc[1] + (m + half) * scale, 0],
                          color=RED if bad else GREEN, stroke_width=3.2))
        q = zh("重复抽样 100 次，每次算一个 95% 区间", 26).move_to(UP * 2.55)
        with self.say("e20") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(q), Create(mu_line), FadeIn(mu_l), run_time=0.8)
            self.play(LaggedStart(*[Create(s) for s in segs], lag_ratio=0.03), run_time=min(4.5, d - 1.0))
        cnt = VGroup(VGroup(Line(UP * 0.18, DOWN * 0.18, color=GREEN, stroke_width=4), zh("盖住 μ：95 个", 24, GREEN)).arrange(RIGHT, buff=0.15),
                     VGroup(Line(UP * 0.18, DOWN * 0.18, color=RED, stroke_width=4), zh("没盖住：5 个", 24, RED)).arrange(RIGHT, buff=0.15)) \
            .arrange(RIGHT, buff=0.8).move_to(DOWN * 2.65)
        with self.say("e21") as d:
            self.play(*[Indicate(s, color=RED, scale_factor=1.2) for s, b in zip(segs, miss) if b], run_time=1.2)
            self.play(FadeIn(cnt), run_time=0.8)
        rate = pill("95% 是这个方法的成功率", GOLD, 28).move_to(UP * 2.55)
        with self.say("e22") as d:
            self.play(FadeOut(q), FadeIn(rate, shift=DOWN * 0.1), run_time=0.9)
        k = 37
        hl = boxed(segs[k], GOLD, buff=0.12)
        one = VGroup(zh("某一个具体区间：μ 要么在里面，要么不在", 24),
                     VGroup(cross_mark(RED, 0.15), zh("“μ 有 95% 的概率在这个区间里”", 24, RED)).arrange(RIGHT, buff=0.2)) \
            .arrange(DOWN, buff=0.15)
        with self.say("e23") as d:
            self.play(segs.animate.set_opacity(0.25), FadeOut(cnt), run_time=0.6)
            self.play(segs[k].animate.set_opacity(1), Create(hl), run_time=0.7)
            one.next_to(hl, RIGHT, buff=0.3).shift(DOWN * 1.6)
            if one.get_right()[0] > 6.8:
                one.shift(LEFT * (one.get_right()[0] - 6.8))
            self.play(FadeIn(one[0]), run_time=0.8)
            self.wait(d * 0.2)
            self.play(FadeIn(one[1]), run_time=0.8)
        bay = pill("能这样说的：贝叶斯的可信区间 credible interval", BLUE, 26).move_to(UP * 2.55)
        with self.say("e24") as d:
            self.play(FadeOut(rate), FadeIn(bay, shift=DOWN * 0.1), run_time=0.9)
        self.wait(0.3)
        self.clear(run_time=0.6)
