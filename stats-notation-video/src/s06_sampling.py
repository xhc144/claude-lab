"""六 · 抽样分布：X̄ 是随机变量、E(X̄) = μ、SE = σ/√n、SD 与 SE、大数定律、中心极限定理、收敛与近似的记号。"""
from common import *

HDR = "六 · 抽样分布"


def expo(x):
    return math.exp(-x) if x >= 0 else 0.0


class Sampling(VScene):
    header = HDR

    def construct(self):
        rng = np.random.default_rng(12)
        chips = VGroup(*[pill(tex(rf"\bar x={v}", size=34, color=ORANGE), ORANGE) for v in ("1.12", "0.87", "1.05", "0.94")]) \
            .arrange(RIGHT, buff=0.4).move_to(UP * 0.6)
        with self.say("s01") as d:
            self.play(LaggedStart(*[FadeIn(c, shift=DOWN * 0.2) for c in chips], lag_ratio=0.45), run_time=min(3.0, d - 0.5))
        rv = VGroup(tex(r"\bar X", size=64, color=BLUE), zh("是随机变量，它的分布叫", 28),
                    zh("抽样分布 sampling distribution", 28, GOLD)).arrange(RIGHT, buff=0.3).move_to(DOWN * 1.1)
        with self.say("s02") as d:
            self.play(FadeIn(rv, shift=UP * 0.1), run_time=1.0)

        # 总体（上）与样本均值的直方图（下）
        top = axes((0, 4, 1), (0, 1.0, 0.5), 7.0, 1.6, center=UP * 1.45 + LEFT * 2.2, y_axis=False)
        pdf = curve(top, expo, 0, 4, color=BLUE)
        fill = area(top, expo, 0, 4, BLUE, 0.15)
        ptxt = VGroup(zh("总体：右偏", 24, BLUE), tex(r"\mu=1,\ \sigma=1", size=30, color=BLUE)).arrange(DOWN, buff=0.1) \
            .next_to(top, RIGHT, buff=0.4)
        with self.say("s03") as d:
            self.clear(run_time=0.6)
            self.play(Create(top), Create(pdf), FadeIn(fill), run_time=1.0)
            self.play(FadeIn(ptxt), run_time=0.6)
        bot = axes((0, 4, 1), (0, 160, 50), 7.0, 2.6, center=DOWN * 1.35 + LEFT * 2.2, y_axis=False)
        bl = VGroup(*[tex(str(v), size=22, color=SOFT).next_to(bot.c2p(v, 0), DOWN, buff=0.1) for v in range(5)])
        n = 10
        means = rng.exponential(1.0, (800, n)).mean(axis=1)
        edges = np.arange(0, 4.01, 0.1)

        def hist(k):
            c, _ = np.histogram(means[:k], bins=edges)
            return bars(bot, edges[:-1] + 0.05, c, width=0.1, color=ORANGE, opacity=0.7, stroke=BG)

        h = hist(10)
        btxt = VGroup(zh("每次抽 n = 10 个，记下", 24, ORANGE), tex(r"\bar x", size=34, color=ORANGE)) \
            .arrange(RIGHT, buff=0.12).next_to(bot, RIGHT, buff=0.4)
        with self.say("s04") as d:
            self.play(Create(bot), FadeIn(bl), FadeIn(btxt), FadeIn(h), run_time=0.8)
            steps = [40, 120, 300, 800]
            for k in steps:
                self.play(Transform(h, hist(k)), run_time=max(0.5, (d - 1.2) / len(steps) * 0.8))
        mu_t = DashedLine(top.c2p(1, 0), top.c2p(1, 1), color=GOLD, dash_length=0.07)
        mu_b = DashedLine(bot.c2p(1, 0), bot.c2p(1, 160), color=GOLD, dash_length=0.07)
        ex = tex(r"E(\bar X)=\mu", size=40, color=GOLD).next_to(bot, RIGHT, buff=0.4).shift(UP * 0.6)
        with self.say("s05") as d:
            self.play(FadeOut(btxt), Create(mu_t), Create(mu_b), run_time=0.8)
            self.play(Write(ex), run_time=0.9)
        sd_t = DoubleArrow(top.c2p(1, 0.75), top.c2p(2, 0.75), buff=0, color=BLUE, stroke_width=3, tip_length=0.15)
        sdl_t = tex(r"\sigma", size=30, color=BLUE).next_to(sd_t, UP, buff=0.05)
        se = 1 / math.sqrt(n)
        sd_b = DoubleArrow(bot.c2p(1, 135), bot.c2p(1 + se, 135), buff=0, color=ORANGE, stroke_width=3, tip_length=0.12)
        sdl_b = tex(r"\sigma/\sqrt{n}", size=28, color=ORANGE).next_to(sd_b, UP, buff=0.05)
        vf = tex(r"\Var(\bar X)=\frac{\sigma^2}{n},\quad \text{SD}(\bar X)=\frac{\sigma}{\sqrt n}", size=34) \
            .next_to(ex, DOWN, buff=0.35).align_to(ex, LEFT)
        with self.say("s06") as d:
            self.play(GrowFromCenter(sd_t), FadeIn(sdl_t), run_time=0.8)
            self.play(GrowFromCenter(sd_b), FadeIn(sdl_b), run_time=0.8)
            self.play(Write(vf), run_time=1.2)
        se_lab = VGroup(zh("标准误 standard error", 26, ORANGE),
                        tex(r"\text{SE}=\frac{\sigma}{\sqrt n}\quad(\text{均值的标准误：SEM})", size=32, color=ORANGE)) \
            .arrange(DOWN, buff=0.12, aligned_edge=LEFT).next_to(vf, DOWN, buff=0.35).align_to(ex, LEFT)
        with self.say("s07") as d:
            self.play(FadeIn(se_lab, shift=UP * 0.1), run_time=1.0)

        # SD 与 SE
        sd_card = on_panel(VGroup(zh("SD 标准差", 32, BLUE), tex(r"s", size=48, color=BLUE),
                                  zh("个体之间有多分散", 24)).arrange(DOWN, buff=0.2), fill=PAPER, min_w=4.6)
        se_card = on_panel(VGroup(zh("SE 标准误", 32, ORANGE), tex(r"s/\sqrt{n}", size=48, color=ORANGE),
                                  zh("估计值在抽样之间晃多少", 24)).arrange(DOWN, buff=0.2), fill=PAPER, min_w=4.6)
        pair = VGroup(sd_card, se_card).arrange(RIGHT, buff=0.8).move_to(UP * 0.9)
        with self.say("s08") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(sd_card, shift=UP * 0.1), run_time=0.8)
            self.wait(d * 0.25)
            self.play(FadeIn(se_card, shift=UP * 0.1), run_time=0.8)
        grow = VGroup(zh("n 变大：", 26), zh("SE 变小", 26, ORANGE), zh("SD 不会因此变小", 26, BLUE)) \
            .arrange(RIGHT, buff=0.4).next_to(pair, DOWN, buff=0.5)
        with self.say("s09") as d:
            self.play(FadeIn(grow, shift=UP * 0.1), run_time=0.9)
            self.wait(d * 0.3)
            self.play(Indicate(se_card[1][1], color=GOLD), run_time=1.0)
        ex2 = VGroup(VGroup(tex(r"170\pm 6", size=40, color=BLUE), zh("（SD）", 24, BLUE)).arrange(RIGHT, buff=0.1),
                     VGroup(tex(r"170\pm 0.6", size=40, color=ORANGE), zh("（SE，n = 100）", 24, ORANGE)).arrange(RIGHT, buff=0.1)) \
            .arrange(RIGHT, buff=1.2).next_to(grow, DOWN, buff=0.45)
        with self.say("s10") as d:
            self.play(FadeIn(ex2[0], shift=UP * 0.1), run_time=0.8)
            self.play(FadeIn(ex2[1], shift=UP * 0.1), run_time=0.8)

        # 大数定律
        ax = axes((0, 400, 100), (0, 2.5, 0.5), 8.0, 3.0, center=LEFT * 1.8 + DOWN * 0.6)
        xs = VGroup(*[tex(str(v), size=22, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.1) for v in (0, 100, 200, 300, 400)])
        nlab = tex("n", size=28, color=SOFT).next_to(ax.c2p(400, 0), RIGHT, buff=0.2)
        draws = np.random.default_rng(21).exponential(1.0, 400)
        run = np.cumsum(draws) / np.arange(1, 401)
        path = VMobject(color=ORANGE, stroke_width=3).set_points_as_corners([ax.c2p(i + 1, min(2.45, v)) for i, v in enumerate(run)])
        mu_l = DashedLine(ax.c2p(0, 1), ax.c2p(400, 1), color=GOLD, dash_length=0.08)
        mu_t2 = tex(r"\mu", size=32, color=GOLD).next_to(ax.c2p(0, 1), LEFT, buff=0.15)
        lln = VGroup(zh("大数定律", 28, GOLD), zh("law of large numbers", 20, SOFT),
                     tex(r"\bar X_n\xrightarrow{\ P\ }\mu", size=48), zh("依概率收敛", 22, SOFT)).arrange(DOWN, buff=0.15) \
            .move_to(RIGHT * 4.5 + UP * 0.6)
        with self.say("s11") as d:
            self.clear(run_time=0.6)
            self.play(Create(ax), FadeIn(xs), FadeIn(nlab), Create(mu_l), FadeIn(mu_t2), run_time=0.8)
            self.play(Create(path), run_time=min(3.0, d * 0.4), rate_func=linear)
            self.play(FadeIn(lln[:2]), Write(lln[2]), FadeIn(lln[3]), run_time=1.2)

        # 中心极限定理
        def clt(nn, color):
            a = axes((0, 3, 1), (0, 1.6, 0.5), 3.6, 2.4, y_axis=False)
            m = np.random.default_rng(nn).exponential(1.0, (4000, nn)).mean(axis=1)
            e = np.arange(0, 3.01, 0.1)
            c, _ = np.histogram(m, bins=e, density=True)
            b = bars(a, e[:-1] + 0.05, np.minimum(c, 1.58), width=0.1, color=color, opacity=0.7, stroke=BG)
            g = VGroup(a, b)
            if nn > 1:
                s = 1 / math.sqrt(nn)
                g.add(curve(a, lambda x: min(1.6, npdf(x, 1, s)), 0, 3, color=INK, width=2.5))
            lab = tex(f"n={nn}", size=32, color=color)
            return VGroup(g, lab).arrange(DOWN, buff=0.2)

        cl = VGroup(clt(1, BLUE), clt(5, GOLD), clt(30, ORANGE)).arrange(RIGHT, buff=0.5).move_to(DOWN * 0.9)
        ct = VGroup(zh("中心极限定理", 30, GOLD), zh("central limit theorem", 20, SOFT)).arrange(RIGHT, buff=0.3).move_to(UP * 2.4)
        with self.say("s12") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(ct), run_time=0.8)
            self.play(FadeIn(cl[0], shift=UP * 0.1), run_time=0.9)
        with self.say("s13") as d:
            self.play(FadeIn(cl[1], shift=UP * 0.1), run_time=0.9)
            self.play(FadeIn(cl[2], shift=UP * 0.1), run_time=0.9)
        conv = tex(r"\frac{\bar X_n-\mu}{\sigma/\sqrt n}", r"\xrightarrow{\ d\ }", r"N(0,1)", size=50).move_to(UP * 1.25)
        alts = VGroup(tex(r"\xrightarrow{\ L\ }", size=44), tex(r"\rightsquigarrow", size=44)).arrange(RIGHT, buff=0.5)
        alt_l = VGroup(zh("依分布收敛 · d = distribution；也写", 22, SOFT), alts).arrange(RIGHT, buff=0.3).next_to(conv, DOWN, buff=0.15)
        with self.say("s14") as d:
            self.play(cl.animate.scale(0.75).shift(DOWN * 0.55), run_time=0.6)
            self.play(Write(conv), run_time=1.4)
            self.play(Indicate(conv[1], color=GOLD), run_time=0.8)
            self.play(FadeIn(alt_l), run_time=0.8)
        approx = VGroup(tex(r"\bar X\ \dot\sim\ N\!\left(\mu,\tfrac{\sigma^2}{n}\right)", size=40),
                        tex(r"\bar X\ \overset{a}{\sim}\ N\!\left(\mu,\tfrac{\sigma^2}{n}\right)", size=40),
                        tex(r"\bar X\approx N\!\left(\mu,\tfrac{\sigma^2}{n}\right)", size=40)).arrange(RIGHT, buff=0.7)
        ap_l = zh("“近似服从”的几种写法 · a = asymptotic 渐近", 22, SOFT)
        apg = VGroup(approx, ap_l).arrange(DOWN, buff=0.2).move_to(UP * 1.3)
        with self.say("s15") as d:
            self.play(FadeOut(VGroup(conv, alt_l)), run_time=0.5)
            self.play(LaggedStart(*[FadeIn(a, shift=UP * 0.1) for a in approx], lag_ratio=0.5), FadeIn(ap_l), run_time=1.8)
        use = pill("大样本 → 正态近似 → 检验与置信区间", GOLD, 26).next_to(cl, UP, buff=0.25)
        with self.say("s16") as d:
            self.play(FadeOut(apg), FadeIn(use, shift=UP * 0.1), run_time=0.9)
        self.wait(0.3)
        self.clear(run_time=0.6)
