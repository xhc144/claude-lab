"""五 · 常见分布：~、N(μ, σ²)、Z、φ、Φ、分位点；B(n, p)、组合数、阶乘、泊松、均匀、指数；χ²、t、F、i.i.d.。"""
from scipy import stats

from common import *

HDR = "五 · 常见分布"


def std_axes(center=DOWN * 0.9, w=9.0, h=3.0, lo=-4, hi=4, top=0.45):
    ax = axes((lo, hi, 1), (0, top, 0.1), w, h, center=center, y_axis=False)
    lab = VGroup(*[tex(str(v), size=24, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.12) for v in range(lo, hi + 1)])
    return ax, lab


class Normal(VScene):
    header = HDR

    def construct(self):
        tilde = VGroup(tex(r"\sim", size=140, color=GOLD), zh("波浪号", 26, SOFT)).arrange(DOWN, buff=0.2).move_to(UP * 0.4)
        with self.say("n01") as d:
            self.play(Write(tilde[0]), run_time=1.0)
            self.play(FadeIn(tilde[1]), run_time=0.6)
        f = tex(r"X", r"\sim", r"N", r"(", r"\mu", r",\,", r"\sigma^2", r")", size=80).move_to(UP * 1.6)
        notes = VGroup(note(f[1], "服从", UP, GOLD, 24, 0.25), note(f[2], "正态分布", DOWN, BLUE, 24, 0.3),
                       note(f[4], "均值", UP, ORANGE, 24, 0.25), note(f[6], "方差", DOWN, RED, 24, 0.3))
        with self.say("n02") as d:
            self.play(ReplacementTransform(tilde[0], f[1]), FadeOut(tilde[1]), run_time=0.8)
            self.play(Write(VGroup(f[0], *f[2:])), run_time=1.0)
            self.play(LaggedStart(*[FadeIn(n) for n in notes], lag_ratio=0.4), run_time=min(2.4, d - 1.8))
        ax, lab = std_axes(center=DOWN * 1.5, h=2.4)
        bell = curve(ax, npdf, -4, 4, color=BLUE)
        gauss = VGroup(zh("正态分布 · 高斯分布", 26, BLUE), zh("normal / Gaussian", 20, SOFT)).arrange(DOWN, buff=0.08) \
            .next_to(ax.c2p(2.4, 0.3), RIGHT, buff=0.1)
        not_approx = VGroup(tex(r"\sim", size=40, color=GOLD), zh("读“服从”，不读“约等于”", 22, GOLD)).arrange(RIGHT, buff=0.15) \
            .move_to(LEFT * 3.6 + UP * 0.25)
        with self.say("n03") as d:
            self.play(FadeIn(not_approx), run_time=0.7)
            self.wait(d * 0.2)
            self.play(Create(ax), FadeIn(lab), Create(bell), run_time=1.2)
            self.play(FadeIn(gauss), run_time=0.7)
        # N(0, 4)
        ax2, lab2 = std_axes(center=DOWN * 0.8 + LEFT * 2.2, w=7.2, h=2.6, lo=-6, hi=6, top=0.22)
        b2 = curve(ax2, lambda x: npdf(x, 0, 2), -6, 6, color=BLUE)
        sd_br = BraceBetweenPoints(ax2.c2p(0, 0), ax2.c2p(2, 0), DOWN, color=RED, buff=0.5)
        sd_l = tex(r"\sigma=2", size=30, color=RED).next_to(sd_br, DOWN, buff=0.08)
        n04 = tex(r"N(0,\,4)", size=56).move_to(LEFT * 2.2 + UP * 1.6)
        n04n = note(n04[0][4], "方差 4", UP, RED, 22, 0.2)
        code = VGroup(zh("但很多软件要的是标准差：", 22, SOFT),
                      mono("rnorm(n, mean = 0, sd = 2)", 20),
                      mono("np.random.normal(0, 2)", 20),
                      mono("norm(loc=0, scale=2)", 20)).arrange(DOWN, buff=0.18, aligned_edge=LEFT)
        code = on_panel(code, fill=PAPER).move_to(RIGHT * 4.0 + DOWN * 0.3)
        with self.say("n04") as d:
            self.clear(run_time=0.6)
            self.play(Write(n04), run_time=0.8)
            self.play(FadeIn(n04n), Create(ax2), FadeIn(lab2), Create(b2), run_time=1.2)
            self.play(GrowFromCenter(sd_br), FadeIn(sd_l), run_time=0.8)
            self.wait(d * 0.15)
            self.play(FadeIn(code, shift=LEFT * 0.2), run_time=0.9)
        # 标准化
        ax, lab = std_axes(center=DOWN * 1.0, w=10.0, h=2.8, lo=-4, hi=8, top=0.45)
        mu, sd = ValueTracker(3.0), ValueTracker(1.6)
        movable = always_redraw(lambda: curve(ax, lambda x: npdf(x, mu.get_value(), sd.get_value()), -4, 8, color=BLUE))
        zt = VGroup(tex(r"Z\sim N(0,\,1)", size=48, color=GOLD), zh("标准正态分布 standard normal", 24, SOFT)) \
            .arrange(RIGHT, buff=0.4).move_to(UP * 2.2)
        zf = tex(r"Z=\frac{X-\mu}{\sigma}", size=48).move_to(UP * 0.9 + RIGHT * 3.5)
        with self.say("n05") as d:
            self.clear(run_time=0.6)
            self.play(Create(ax), FadeIn(lab), Create(movable), run_time=1.0)
            self.play(FadeIn(zt), run_time=0.8)
        with self.say("n06") as d:
            self.play(Write(zf), run_time=1.0)
            self.play(mu.animate.set_value(0.0), run_time=1.4)
            self.play(sd.animate.set_value(1.0), run_time=1.2)
            zs = zh("标准化 = z 分数", 22, SOFT).next_to(zf, DOWN, buff=0.2)
            self.play(FadeIn(zs), run_time=0.6)
        movable.clear_updaters()
        self.clear(run_time=0.5)
        ax, lab = std_axes(center=DOWN * 1.2, w=9.0, h=3.0)
        bell = curve(ax, npdf, -4, 4, color=BLUE)
        phi = VGroup(tex(r"\varphi(z)", size=44, color=BLUE), zh("小写 phi：密度", 22, BLUE)).arrange(RIGHT, buff=0.2) \
            .next_to(ax.c2p(0.8, 0.38), RIGHT, buff=0.2)
        z0 = 0.8
        left = area(ax, npdf, -4, z0, ORANGE, 0.35)
        Phi = VGroup(tex(r"\Phi(z)=P(Z\le z)", size=40, color=ORANGE), zh("大写 Phi：分布函数", 22, ORANGE)) \
            .arrange(DOWN, buff=0.1).move_to(LEFT * 3.6 + UP * 1.7)
        with self.say("n07") as d:
            self.play(Create(ax), FadeIn(lab), Create(bell), run_time=0.9)
            self.play(FadeIn(phi), run_time=0.7)
            self.wait(d * 0.2)
            self.play(FadeIn(left), FadeIn(Phi), run_time=0.9)
        left2 = area(ax, npdf, -4, 1.96, ORANGE, 0.35)
        mid = area(ax, npdf, -1.96, 1.96, GREEN, 0.35)
        p975 = tex(r"\Phi(1.96)\approx 0.975", size=40, color=ORANGE).move_to(RIGHT * 3.6 + UP * 1.7)
        p95 = tex(r"P(-1.96\le Z\le 1.96)\approx 95\%", size=36, color=GREEN).next_to(p975, DOWN, buff=0.2)
        ticks = VGroup(vline(ax, -1.96, npdf(1.96), GREEN, 2), vline(ax, 1.96, npdf(1.96), GREEN, 2))
        with self.say("n08") as d:
            self.play(Transform(left, left2), FadeIn(p975), run_time=1.0)
            self.wait(d * 0.2)
            self.play(FadeOut(left), FadeIn(mid), Create(ticks), FadeIn(p95), run_time=1.0)
        bands = VGroup(area(ax, npdf, -3, 3, BLUE, 0.12), area(ax, npdf, -2, 2, BLUE, 0.18), area(ax, npdf, -1, 1, BLUE, 0.25))
        btxt = VGroup(tex(r"\pm1\sigma:\ 68\%", size=34), tex(r"\pm2\sigma:\ 95\%", size=34),
                      tex(r"\pm3\sigma:\ 99.7\%", size=34)).arrange(DOWN, buff=0.12, aligned_edge=LEFT).move_to(RIGHT * 3.8 + UP * 1.6)
        with self.say("n09") as d:
            self.play(FadeOut(VGroup(mid, ticks, p95, p975, Phi, phi)), run_time=0.5)
            for k in (2, 1, 0):
                self.play(FadeIn(bands[k]), FadeIn(btxt[2 - k]), run_time=0.8)
        tail = area(ax, npdf, 1.96, 4, RED, 0.5)
        za = VGroup(tex(r"z_\alpha", size=48, color=RED), zh("上 α 分位点：右边面积为 α", 24, RED)).arrange(RIGHT, buff=0.25) \
            .move_to(RIGHT * 2.5 + UP * 1.7)
        z025 = tex(r"z_{0.025}=1.96", size=40, color=RED).next_to(za, DOWN, buff=0.2)
        al = tex(r"\alpha", size=34, color=RED).move_to(ax.c2p(2.6, 0.06))
        zmark = tex(r"z_\alpha", size=30, color=RED).next_to(ax.c2p(1.96, 0), DOWN, buff=0.45)
        with self.say("n10") as d:
            self.play(FadeOut(VGroup(bands, btxt)), run_time=0.5)
            self.play(FadeIn(tail), FadeIn(al), FadeIn(zmark), FadeIn(za), run_time=1.0)
            self.wait(d * 0.3)
            self.play(Write(z025), run_time=0.9)
        alt = VGroup(VGroup(zh("国内教材", 22, SOFT), tex(r"u_\alpha", size=40, color=RED)).arrange(RIGHT, buff=0.2),
                     VGroup(zh("有的书", 22, SOFT), tex(r"z_{1-\alpha}", size=40, color=RED), zh("同一个点", 22, SOFT))
                     .arrange(RIGHT, buff=0.2)).arrange(DOWN, buff=0.2, aligned_edge=LEFT).move_to(LEFT * 3.6 + UP * 1.6)
        with self.say("n11") as d:
            self.play(FadeIn(alt[0], shift=RIGHT * 0.1), run_time=0.8)
            self.wait(d * 0.2)
            self.play(FadeIn(alt[1], shift=RIGHT * 0.1), run_time=0.8)
        self.wait(0.3)
        self.clear(run_time=0.6)


class Discrete(VScene):
    header = HDR

    def construct(self):
        n, p = 10, 0.3
        ax = axes((-1, 11, 1), (0, 0.3, 0.1), 6.4, 2.8, center=LEFT * 3.2 + DOWN * 1.0)
        ks = list(range(0, 11))
        pm = [stats.binom.pmf(k, n, p) for k in ks]
        bb = bars(ax, ks, pm, width=0.72, color=BLUE, opacity=0.7)
        kl = VGroup(*[tex(str(k), size=22, color=SOFT).next_to(ax.c2p(k, 0), DOWN, buff=0.1) for k in ks])
        coins = VGroup(*[coin(h, 0.22) for h in [1, 0, 0, 1, 0, 0, 0, 1, 0, 0]]).arrange(RIGHT, buff=0.1) \
            .move_to(LEFT * 3.2 + UP * 1.4)
        title = VGroup(tex(r"X\sim B(n,\,p)", size=48, color=BLUE), zh("二项分布 binomial · 也写 Bin(n, p)", 24)) \
            .arrange(DOWN, buff=0.15).move_to(RIGHT * 3.4 + UP * 1.9)
        with self.say("n12") as d:
            self.play(Write(title[0]), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(c, scale=0.6) for c in coins], lag_ratio=0.1), run_time=1.4)
            cnt = tex(r"X=3", size=34, color=GOLD).next_to(coins, DOWN, buff=0.2)
            self.play(FadeIn(cnt), run_time=0.5)
            self.play(Create(ax), FadeIn(kl), LaggedStart(*[GrowFromEdge(r, DOWN) for r in bb], lag_ratio=0.06), run_time=1.4)
            self.play(FadeIn(title[1]), run_time=0.6)
        pmf = tex(r"P(X=k)=", r"\binom{n}{k}", r"p^k(1-p)^{n-k}", size=42).move_to(RIGHT * 3.4 + UP * 0.55)
        comb = VGroup(tex(r"\binom{n}{k}=\frac{n!}{k!\,(n-k)!}", size=40),
                      zh("读作“n 选 k”", 22, SOFT),
                      VGroup(zh("国内常写", 22, SOFT), tex(r"C_n^k", size=40, color=ORANGE)).arrange(RIGHT, buff=0.2)) \
            .arrange(DOWN, buff=0.18).move_to(RIGHT * 3.4 + DOWN * 1.1)
        with self.say("n13") as d:
            self.play(Write(pmf), run_time=1.3)
            self.play(Indicate(pmf[1], color=ORANGE), run_time=0.8)
            self.play(FadeIn(comb[0]), FadeIn(comb[1]), run_time=0.9)
            self.wait(d * 0.15)
            self.play(FadeIn(comb[2]), run_time=0.7)
        fac = VGroup(tex(r"n!=1\times2\times\cdots\times n", size=36), tex(r"5!=120", size=32, color=SOFT)) \
            .arrange(RIGHT, buff=0.5).move_to(RIGHT * 3.4 + DOWN * 2.45)
        with self.say("n14") as d:
            self.play(FadeIn(fac, shift=UP * 0.1), run_time=0.9)
        mom = VGroup(tex(r"E(X)=np\qquad \Var(X)=np(1-p)", size=38),
                     VGroup(tex(r"B(1,\,p)", size=38, color=BLUE), zh("两点分布 · 伯努利分布 Bernoulli", 22)).arrange(RIGHT, buff=0.25)) \
            .arrange(DOWN, buff=0.3).move_to(RIGHT * 3.4 + DOWN * 0.6)
        with self.say("n15") as d:
            self.play(FadeOut(VGroup(comb, fac)), pmf.animate.shift(UP * 0.1), run_time=0.6)
            self.play(Write(mom[0]), run_time=1.2)
            self.wait(d * 0.2)
            self.play(FadeIn(mom[1], shift=UP * 0.1), run_time=0.8)
        # 泊松
        lam = 3
        ax2 = axes((-1, 11, 1), (0, 0.25, 0.1), 6.4, 2.8, center=LEFT * 3.2 + DOWN * 0.6)
        pp = bars(ax2, ks, [stats.poisson.pmf(k, lam) for k in ks], width=0.72, color=ORANGE, opacity=0.7)
        kl2 = VGroup(*[tex(str(k), size=22, color=SOFT).next_to(ax2.c2p(k, 0), DOWN, buff=0.1) for k in ks])
        ptitle = VGroup(zh("泊松分布 Poisson", 28, ORANGE),
                        tex(r"P(X=k)=\frac{\lambda^k e^{-\lambda}}{k!}", size=42),
                        VGroup(tex(r"\lambda", size=40, color=ORANGE), zh("lambda 兰姆达", 22, SOFT)).arrange(RIGHT, buff=0.2),
                        tex(r"E(X)=\Var(X)=\lambda", size=38)).arrange(DOWN, buff=0.25).move_to(RIGHT * 3.4 + UP * 0.6)
        phone = zh("一小时接到几个电话（λ = 3）", 24, SOFT).next_to(ax2, UP, buff=0.4)
        with self.say("n16") as d:
            self.clear(run_time=0.6)
            self.play(Create(ax2), FadeIn(kl2), FadeIn(phone), LaggedStart(*[GrowFromEdge(r, DOWN) for r in pp], lag_ratio=0.06),
                      run_time=1.4)
            self.play(FadeIn(ptitle[0]), Write(ptitle[1]), run_time=1.2)
            self.play(FadeIn(ptitle[2]), run_time=0.6)
            self.wait(d * 0.15)
            self.play(FadeIn(ptitle[3]), run_time=0.8)
        names = VGroup(tex(r"P(\lambda)", size=44, color=ORANGE), tex(r"\pi(\lambda)", size=44, color=ORANGE),
                       tex(r"\text{Pois}(\lambda)", size=44, color=ORANGE)).arrange(RIGHT, buff=0.6).move_to(RIGHT * 3.4 + DOWN * 1.6)
        warn = zh("这里的 P、π 不是概率，也不是圆周率", 22, RED).next_to(names, DOWN, buff=0.25)
        with self.say("n17") as d:
            self.play(LaggedStart(*[FadeIn(nm, shift=UP * 0.1) for nm in names], lag_ratio=0.4), run_time=1.4)
            self.play(FadeIn(warn), run_time=0.7)
        # 均匀与指数
        ua = axes((0, 6, 1), (0, 0.6, 0.2), 5.6, 2.4, center=LEFT * 3.4 + DOWN * 0.8)
        ub = Rectangle(width=ua.c2p(4, 0)[0] - ua.c2p(1.5, 0)[0], height=ua.c2p(0, 0.4)[1] - ua.c2p(0, 0)[1],
                       stroke_color=BLUE, stroke_width=3, fill_color=BLUE, fill_opacity=0.2)
        ub.move_to([(ua.c2p(1.5, 0)[0] + ua.c2p(4, 0)[0]) / 2, (ua.c2p(0, 0)[1] + ua.c2p(0, 0.4)[1]) / 2, 0])
        ulab = VGroup(tex("a", size=30, color=SOFT).next_to(ua.c2p(1.5, 0), DOWN, buff=0.12),
                      tex("b", size=30, color=SOFT).next_to(ua.c2p(4, 0), DOWN, buff=0.12),
                      tex(r"\tfrac{1}{b-a}", size=30, color=BLUE).next_to(ub, UP, buff=0.12))
        ut = VGroup(tex(r"U(a,\,b)", size=44, color=BLUE), zh("均匀分布 uniform", 24)).arrange(RIGHT, buff=0.3) \
            .next_to(ua, UP, buff=0.5)
        with self.say("n18") as d:
            self.clear(run_time=0.6)
            self.play(Create(ua), FadeIn(ut), run_time=0.8)
            self.play(DrawBorderThenFill(ub), FadeIn(ulab), run_time=1.0)
        ea = axes((0, 6, 1), (0, 1.0, 0.5), 5.6, 2.4, center=RIGHT * 3.4 + DOWN * 0.8)
        ec = curve(ea, lambda x: 0.9 * math.exp(-0.9 * x), 0, 6, color=ORANGE)
        ea_area = area(ea, lambda x: 0.9 * math.exp(-0.9 * x), 0, 6, ORANGE, 0.15)
        et = VGroup(tex(r"\text{Exp}(\lambda)", size=44, color=ORANGE), zh("指数分布 · 等待时间", 24)).arrange(RIGHT, buff=0.3) \
            .next_to(ea, UP, buff=0.5)
        em = tex(r"f(x)=\lambda e^{-\lambda x},\quad E(X)=\tfrac{1}{\lambda}", size=34).next_to(ea, DOWN, buff=0.35)
        with self.say("n19") as d:
            self.play(Create(ea), FadeIn(et), run_time=0.8)
            self.play(Create(ec), FadeIn(ea_area), run_time=1.0)
            self.play(FadeIn(em), run_time=0.8)
        self.wait(0.3)
        self.clear(run_time=0.6)


class SamplingDists(VScene):
    header = HDR

    def construct(self):
        cards = VGroup(card(r"\chi^2", "卡方 chi-square", None, ORANGE, 80, w=3.4),
                       card(r"t", "t 分布 Student's t", None, BLUE, 80, w=3.4),
                       card(r"F", "F 分布", None, GREEN, 80, w=3.4)).arrange(RIGHT, buff=0.6).move_to(UP * 0.3)
        with self.say("n20") as d:
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.15) for c in cards], lag_ratio=0.35), run_time=1.6)
        ax = axes((0, 14, 2), (0, 0.5, 0.1), 7.0, 3.0, center=LEFT * 2.9 + DOWN * 0.9, y_axis=False)
        xl = VGroup(*[tex(str(v), size=22, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.1) for v in range(0, 15, 2)])
        cols = [RED, ORANGE, GOLD, GREEN]
        cs = VGroup(*[curve(ax, lambda x, k=k: min(0.5, stats.chi2.pdf(x, k)), 0.05 if k > 1 else 0.12, 14, color=c, width=3)
                      for k, c in zip((1, 2, 4, 8), cols)])
        ks = VGroup(*[tex(f"k={k}", size=32, color=c) for k, c in zip((1, 2, 4, 8), cols)]).arrange(DOWN, buff=0.08, aligned_edge=LEFT) \
            .next_to(ax.c2p(10, 0.45), RIGHT, buff=0)
        chi_f = VGroup(tex(r"Z_1^2+Z_2^2+\cdots+Z_k^2\sim\chi^2(k)", size=40),
                       zh("k：自由度", 24, SOFT)).arrange(DOWN, buff=0.15).move_to(RIGHT * 3.6 + UP * 1.6)
        with self.say("n21") as d:
            self.play(FadeOut(cards), run_time=0.7)
            self.play(Write(chi_f[0]), run_time=1.3)
            self.play(Create(ax), FadeIn(xl), LaggedStart(*[Create(c) for c in cs], lag_ratio=0.25), FadeIn(ks), run_time=1.6)
            self.play(FadeIn(chi_f[1]), run_time=0.6)
        read = VGroup(tex(r"\chi", size=72, color=ORANGE), zh("chi，中文读“卡”；χ² 读“卡方”", 24)).arrange(RIGHT, buff=0.3) \
            .move_to(RIGHT * 3.6 + DOWN * 0.3)
        with self.say("n22") as d:
            self.play(FadeIn(read, shift=UP * 0.1), run_time=0.9)
        # t
        tf = VGroup(tex(r"T=\frac{Z}{\sqrt{V/k}}\sim t(k)", size=44, color=BLUE),
                    tex(r"Z\sim N(0,1),\ V\sim\chi^2(k)\ \text{相互独立}", size=30, color=SOFT)).arrange(DOWN, buff=0.15) \
            .move_to(RIGHT * 3.6 + UP * 1.5)
        with self.say("n23") as d:
            self.clear(run_time=0.6)
            self.play(Write(tf[0]), run_time=1.3)
            self.play(FadeIn(tf[1]), run_time=0.8)
        ta, tl = std_axes(center=LEFT * 2.9 + DOWN * 0.9, w=7.0, h=3.0)
        nrm = DashedVMobject(curve(ta, npdf, -4, 4, color=INK, width=2.5), num_dashes=40)
        t1 = curve(ta, lambda x: stats.t.pdf(x, 1), -4, 4, color=RED, width=3)
        t4 = curve(ta, lambda x: stats.t.pdf(x, 4), -4, 4, color=BLUE, width=3)
        leg = VGroup(tex(r"t(1)", size=28, color=RED), tex(r"t(4)", size=28, color=BLUE),
                     tex(r"N(0,1)", size=28, color=INK)).arrange(DOWN, buff=0.08, aligned_edge=LEFT).next_to(ta.c2p(2.4, 0.4), RIGHT, buff=0)
        with self.say("n24") as d:
            self.play(Create(ta), FadeIn(tl), Create(nrm), run_time=0.9)
            self.play(Create(t1), Create(t4), FadeIn(leg), run_time=1.2)
            self.play(Indicate(VGroup(t1, t4), color=GOLD, scale_factor=1.0), run_time=1.0)
        gos = on_panel(VGroup(zh("戈塞特 W. S. Gosset · 1908", 26), zh("啤酒厂职员，笔名 Student", 22, SOFT),
                              zh("→ 学生 t 分布 Student's t", 24, BLUE)).arrange(DOWN, buff=0.15), fill=PAPER) \
            .move_to(RIGHT * 3.6 + DOWN * 0.9)
        with self.say("n25") as d:
            self.play(FadeIn(gos, shift=UP * 0.1), run_time=0.9)
        # F
        fa = axes((0, 5, 1), (0, 1.0, 0.5), 6.2, 2.8, center=LEFT * 3.2 + DOWN * 0.9, y_axis=False)
        fl = VGroup(*[tex(str(v), size=22, color=SOFT).next_to(fa.c2p(v, 0), DOWN, buff=0.1) for v in range(0, 6)])
        fc = curve(fa, lambda x: stats.f.pdf(x, 5, 12), 0.01, 5, color=GREEN, width=3.5)
        ff = VGroup(tex(r"F=\frac{U/m}{V/n}\sim F(m,\,n)", size=44, color=GREEN),
                    tex(r"U\sim\chi^2(m),\ V\sim\chi^2(n)\ \text{相互独立}", size=30, color=SOFT),
                    zh("两个自由度 · F 取自费希尔 Fisher", 24)).arrange(DOWN, buff=0.18).move_to(RIGHT * 3.4 + UP * 0.9)
        with self.say("n26") as d:
            self.clear(run_time=0.6)
            self.play(Write(ff[0]), run_time=1.2)
            self.play(FadeIn(ff[1]), Create(fa), FadeIn(fl), Create(fc), run_time=1.2)
            self.play(FadeIn(ff[2]), run_time=0.7)
        iid = VGroup(tex(r"X_1,\dots,X_n\iid N(\mu,\sigma^2)", size=52),
                     zh("i.i.d. = independent and identically distributed", 22, SOFT),
                     zh("独立同分布 · 简单随机样本", 30, GOLD)).arrange(DOWN, buff=0.25).move_to(UP * 0.2)
        with self.say("n27") as d:
            self.clear(run_time=0.6)
            self.play(Write(iid[0]), run_time=1.3)
            self.play(FadeIn(iid[1]), run_time=0.7)
            self.play(FadeIn(iid[2], shift=UP * 0.1), run_time=0.8)
        self.wait(0.3)
        self.clear(run_time=0.6)
