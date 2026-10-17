"""四 · 随机变量：X 与 x、PMF、PDF、CDF、期望、方差（D）、协方差、相关系数、不相关不等于独立。"""
from common import *
from data import DICE

HDR = "四 · 随机变量"


def dice_pmf(center=DOWN * 0.4, w=8.4, h=3.6):
    ax = axes((1, 13, 1), (0, 7 / 36, 1 / 36), w, h, center=center)
    xs = list(range(2, 13))
    b = bars(ax, xs, [DICE[x] for x in xs], width=0.72, color=BLUE, opacity=0.7)
    xl = VGroup(*[tex(str(x), size=24, color=SOFT).next_to(ax.c2p(x, 0), DOWN, buff=0.12) for x in xs])
    yl = VGroup(*[tex(rf"\tfrac{{{k}}}{{36}}", size=24, color=SOFT).next_to(ax.c2p(1, k / 36), LEFT, buff=0.1)
                  for k in (2, 4, 6)])
    return ax, b, xl, yl


class RandomVar(VScene):
    header = HDR

    def construct(self):
        d1, d2 = die(3, 0.9), die(4, 0.9)
        pair = VGroup(d1, d2).arrange(RIGHT, buff=0.3).move_to(LEFT * 3.2 + UP * 0.6)
        arr = Arrow(LEFT, RIGHT, color=GOLD).scale(0.9).next_to(pair, RIGHT, buff=0.4)
        val = tex(r"X=3+4=7", size=56).next_to(arr, RIGHT, buff=0.4)
        lab = zh("随机变量 random variable：把随机结果变成数", 26, SOFT).move_to(DOWN * 1.2)
        with self.say("v01") as d:
            self.play(FadeIn(d1, shift=DOWN * 0.3), FadeIn(d2, shift=DOWN * 0.3), run_time=0.8)
            self.play(GrowArrow(arr), Write(val), run_time=1.1)
            self.play(FadeIn(lab), run_time=0.6)
        X = VGroup(tex("X", size=80, color=BLUE), zh("大写：掷之前，不确定", 24, BLUE)).arrange(DOWN, buff=0.2)
        x = VGroup(tex("x", size=80, color=ORANGE), zh("小写：取到的具体值", 24, ORANGE)).arrange(DOWN, buff=0.2)
        cmp = VGroup(X, x).arrange(RIGHT, buff=2.0).move_to(DOWN * 1.4)
        with self.say("v02") as d:
            self.play(FadeOut(lab), VGroup(pair, arr, val).animate.shift(UP * 1.0), run_time=0.6)
            self.play(FadeIn(X, shift=UP * 0.1), run_time=0.7)
            self.play(FadeIn(x, shift=UP * 0.1), run_time=0.7)

        ax, b, xl, yl = dice_pmf()
        title = VGroup(tex(r"P(X=x)", size=44, color=BLUE),
                       zh("概率质量函数 PMF · 分布列", 26)).arrange(RIGHT, buff=0.35).move_to(UP * 2.3)
        with self.say("v03") as d:
            self.clear(run_time=0.6)
            self.play(Create(ax), FadeIn(xl), FadeIn(yl), run_time=0.8)
            self.play(LaggedStart(*[GrowFromEdge(r, DOWN) for r in b], lag_ratio=0.08), run_time=1.5)
            self.play(FadeIn(title), run_time=0.7)
        h7 = boxed(b[5], RED, buff=0.04)
        t7 = tex(r"P(X=7)=\tfrac{6}{36}=\tfrac16", size=36, color=RED).next_to(b[5], UP, buff=0.25).shift(RIGHT * 2.2)
        with self.say("v04") as d:
            self.play(Create(h7), FadeIn(t7), run_time=0.9)

        # ------------------------------------------------ 连续：密度与分布函数
        sd = 0.3
        f = lambda t: npdf(t, 0, sd)
        F = lambda t: 0.5 * (1 + math.erf(t / (sd * math.sqrt(2))))
        top = axes((-1.5, 1.5, 0.5), (0, 1.5, 0.5), 6.2, 2.4, center=UP * 1.15 + LEFT * 2.3)
        pdf = curve(top, f, -1.5, 1.5, color=BLUE)
        one = DashedLine(top.c2p(-1.5, 1), top.c2p(1.5, 1), color=GRAY, stroke_width=1.5, dash_length=0.06)
        one_l = tex("1", size=24, color=SOFT).next_to(top.c2p(-1.5, 1), LEFT, buff=0.1)
        cont = VGroup(zh("连续型随机变量", 26), zh("continuous", 20, SOFT)).arrange(RIGHT, buff=0.2).move_to(RIGHT * 4.3 + UP * 2.3)
        with self.say("v05") as d:
            self.clear(run_time=0.6)
            self.play(Create(top), FadeIn(cont), run_time=0.8)
            self.play(Create(pdf), run_time=1.2)
            pt = Dot(top.c2p(0.2, 0), color=RED)
            pl = tex(r"P(X=a)=0", size=32, color=RED).next_to(pt, DOWN, buff=0.2)
            self.play(FadeIn(pt, scale=0.5), FadeIn(pl), run_time=0.8)
        a, bb = -0.3, 0.4
        sh = area(top, f, a, bb, BLUE, 0.35)
        ftxt = VGroup(tex(r"f(x)", size=40, color=BLUE), zh("概率密度函数 PDF", 24)).arrange(DOWN, buff=0.12) \
            .move_to(RIGHT * 4.3 + UP * 1.3)
        integ = tex(r"P(a\le X\le b)=\int_a^b f(x)\,dx", size=36).move_to(RIGHT * 4.3 + UP * 0.1)
        with self.say("v06") as d:
            self.play(FadeOut(VGroup(pt, pl)), FadeIn(ftxt), run_time=0.7)
            self.play(FadeIn(sh), run_time=0.8)
            self.play(Write(integ), run_time=1.3)
        with self.say("v07") as d:
            self.play(Create(one), FadeIn(one_l), run_time=0.8)
            peak = note(Dot(top.c2p(0, f(0))), "密度可以大于 1", direction=RIGHT, size=22, color=RED, buff=0.4)
            self.play(FadeIn(peak), run_time=0.7)
            whole = area(top, f, -1.5, 1.5, BLUE, 0.2)
            self.play(FadeIn(whole), FadeOut(sh), run_time=0.8)
            tot = tex(r"\text{总面积}=1", size=32, color=BLUE).next_to(integ, DOWN, buff=0.3)
            self.play(FadeIn(tot), run_time=0.6)
        bot = axes((-1.5, 1.5, 0.5), (0, 1, 0.5), 6.2, 1.5, center=DOWN * 1.75 + LEFT * 2.3)
        cdf = curve(bot, F, -1.5, 1.5, color=ORANGE)
        bl = VGroup(tex("0", size=22, color=SOFT).next_to(bot.c2p(-1.5, 0), LEFT, buff=0.1),
                    tex("1", size=22, color=SOFT).next_to(bot.c2p(-1.5, 1), LEFT, buff=0.1))
        Ftxt = VGroup(tex(r"F(x)=P(X\le x)", size=36, color=ORANGE), zh("累积分布函数 CDF · 分布函数", 22)) \
            .arrange(DOWN, buff=0.12).move_to(RIGHT * 4.2 + DOWN * 1.5)
        xt = ValueTracker(-1.2)
        left_area = always_redraw(lambda: area(top, f, -1.5, xt.get_value(), ORANGE, 0.35))
        cdot = always_redraw(lambda: Dot(bot.c2p(xt.get_value(), F(xt.get_value())), color=ORANGE, radius=0.07))
        guide = always_redraw(lambda: DashedLine(top.c2p(xt.get_value(), 0), bot.c2p(xt.get_value(), F(xt.get_value())),
                                                 color=GRAY, stroke_width=1.5, dash_length=0.06))
        with self.say("v08") as d:
            self.play(FadeOut(VGroup(whole, peak, one, one_l, integ, tot)), run_time=0.5)
            self.play(Create(bot), FadeIn(bl), FadeIn(Ftxt), run_time=0.8)
            self.add(left_area, guide, cdot)
            self.play(Create(cdf), xt.animate.set_value(1.2), run_time=min(4.0, d - 1.6), rate_func=linear)
        lab2 = VGroup(VGroup(tex("f", size=40, color=BLUE), zh("小写：密度", 22)).arrange(RIGHT, buff=0.15),
                      VGroup(tex("F", size=40, color=ORANGE), zh("大写：分布函数", 22)).arrange(RIGHT, buff=0.15)) \
            .arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(ftxt, DOWN, buff=0.35)
        with self.say("v09") as d:
            self.play(xt.animate.set_value(-0.4), run_time=1.2)
            self.play(xt.animate.set_value(1.4), run_time=1.2)
            self.play(FadeIn(lab2, shift=UP * 0.1), run_time=0.7)
        for m in (left_area, cdot, guide):
            m.clear_updaters()

        # ------------------------------------------------ 期望
        ex = VGroup(VGroup(zh("期望 expectation", 28, GOLD), tex(r"E(X)=\mu", size=44)).arrange(RIGHT, buff=0.4),
                    VGroup(zh("离散", 24, SOFT), tex(r"E(X)=\sum_x x\,P(X=x)", size=40)).arrange(RIGHT, buff=0.3),
                    VGroup(zh("连续", 24, SOFT), tex(r"E(X)=\int x\,f(x)\,dx", size=40)).arrange(RIGHT, buff=0.3)) \
            .arrange(DOWN, buff=0.3, aligned_edge=LEFT).move_to(UP * 0.4)
        with self.say("v10") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(ex[0], shift=UP * 0.1), run_time=0.9)
        with self.say("v11") as d:
            self.play(FadeIn(ex[1], shift=UP * 0.1), run_time=0.9)
            self.wait(d * 0.3)
            self.play(FadeIn(ex[2], shift=UP * 0.1), run_time=0.9)
        ax, b, xl, yl = dice_pmf(center=DOWN * 0.9, w=7.2, h=2.8)
        fulc = Triangle(color=GOLD, fill_color=GOLD, fill_opacity=1).scale(0.15).move_to(ax.c2p(7, 0) + DOWN * 0.7)
        e7 = tex(r"E(X)=7", size=40, color=GOLD).next_to(fulc, RIGHT, buff=0.3)
        with self.say("v12") as d:
            self.play(ex.animate.scale(0.75).to_edge(UP, buff=0.75), run_time=0.7)
            self.play(Create(ax), FadeIn(b), FadeIn(xl), run_time=0.9)
            self.play(FadeIn(fulc, shift=UP * 0.2), FadeIn(e7), run_time=0.8)
        var = VGroup(tex(r"\Var(X)=E\big[(X-\mu)^2\big]", size=44),
                     VGroup(zh("国内教材", 22, SOFT), tex(r"D(X)", size=40, color=BLUE), zh("D：dispersion", 22, SOFT))
                     .arrange(RIGHT, buff=0.25)).arrange(DOWN, buff=0.25)
        with self.say("v13") as d:
            self.clear(run_time=0.6)
            var.move_to(UP * 1.1)
            self.play(Write(var[0]), run_time=1.3)
            self.wait(d * 0.3)
            self.play(FadeIn(var[1], shift=UP * 0.1), run_time=0.8)
        sdl = VGroup(tex(r"\sigma=\sqrt{\Var(X)}", size=42),
                     VGroup(tex(r"\mu_X,\ \sigma_X", size=42, color=BLUE), zh("下标说明是谁的", 22, SOFT)).arrange(RIGHT, buff=0.3)) \
            .arrange(DOWN, buff=0.3).next_to(var, DOWN, buff=0.5)
        with self.say("v14") as d:
            self.play(FadeIn(sdl[0], shift=UP * 0.1), run_time=0.8)
            self.play(FadeIn(sdl[1], shift=UP * 0.1), run_time=0.8)

        # ------------------------------------------------ 协方差与相关系数
        rng = np.random.default_rng(2)

        def scatter(r, label, color):
            a = axes((-3, 3, 1), (-3, 3, 1), 2.6, 2.6, y_axis=True)
            zx = rng.normal(0, 1, 60)
            zy = r * zx + math.sqrt(1 - r * r) * rng.normal(0, 1, 60)
            pts = VGroup(*[Dot(a.c2p(np.clip(u, -2.9, 2.9), np.clip(v, -2.9, 2.9)), radius=0.035, color=color)
                           for u, v in zip(zx, zy)])
            return VGroup(VGroup(a, pts), tex(label, size=30, color=color)).arrange(DOWN, buff=0.15)

        sc = VGroup(scatter(0.85, r"\Cov>0,\ \rho\approx 0.85", BLUE), scatter(-0.85, r"\Cov<0,\ \rho\approx -0.85", RED),
                    scatter(0.0, r"\rho\approx 0", GRAY)).arrange(RIGHT, buff=0.7).move_to(DOWN * 1.2)
        cov = tex(r"\Cov(X,Y)=E\big[(X-\mu_X)(Y-\mu_Y)\big]", size=40).move_to(UP * 2.2)
        with self.say("v15") as d:
            self.clear(run_time=0.6)
            self.play(Write(cov), run_time=1.3)
            self.play(FadeIn(sc[0]), run_time=0.8)
        rho = tex(r"\rho=\frac{\Cov(X,Y)}{\sigma_X\,\sigma_Y}\in[-1,1]", size=40, color=GOLD).next_to(cov, DOWN, buff=0.3)
        with self.say("v16") as d:
            self.play(FadeIn(sc[1]), run_time=0.8)
            self.play(Write(rho), run_time=1.2)
            self.play(FadeIn(sc[2]), run_time=0.8)
        unc = VGroup(tex(r"\rho=0", size=44, color=GRAY), zh("不相关：没有线性关系", 26),
                     tex(r"\neq", size=44, color=RED), zh("独立", 26)).arrange(RIGHT, buff=0.3).move_to(UP * 0.1)
        with self.say("v17") as d:
            self.play(FadeOut(VGroup(sc[0], sc[1], rho)), sc[2].animate.to_edge(LEFT, buff=0.8), run_time=0.8)
            self.play(FadeIn(unc, shift=UP * 0.1), run_time=0.9)
        pa = axes((-1.5, 1.5, 1), (-0.2, 1.4, 1), 4.0, 2.4, center=RIGHT * 3.4 + DOWN * 1.6)
        par = curve(pa, lambda t: t * t, -1.15, 1.15, color=LINE, width=2)
        pts = VGroup(*[Dot(pa.c2p(t, t * t), radius=0.1, color=ORANGE) for t in (-1, 0, 1)])
        pl = VGroup(tex(r"X\in\{-1,0,1\},\ Y=X^2", size=30), tex(r"\rho=0", size=34, color=GRAY),
                    zh("Y 完全由 X 决定", 22, RED)).arrange(DOWN, buff=0.12).next_to(pa, LEFT, buff=0.5)
        with self.say("v18") as d:
            self.play(FadeOut(sc[2]), run_time=0.4)
            self.play(Create(pa), Create(par), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(p, scale=0.5) for p in pts], lag_ratio=0.3), FadeIn(pl[0]), run_time=1.0)
            self.play(FadeIn(pl[1]), FadeIn(pl[2]), run_time=0.8)
        self.wait(0.3)
        self.clear(run_time=0.6)
