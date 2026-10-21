"""八 · 假设检验：H₀、H₁、μ₀、检验统计量、p 值、α、拒绝域、临界值、单双侧；两类错误、功效、星号、报告格式、效应量、多重比较。"""
from scipy import stats

from common import *
from data import CI, DF, P_VAL, T, T_CRIT

HDR = "八 · 假设检验"


def t_axes(center=DOWN * 0.85, w=9.6, h=2.7):
    ax = axes((-4, 4, 1), (0, 0.42, 0.1), w, h, center=center, y_axis=False)
    lab = VGroup(*[tex(str(v), size=24, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.12) for v in range(-4, 5)])
    return ax, lab


def loaf(w=0.55):
    body = RoundedRectangle(width=w, height=w * 0.55, corner_radius=w * 0.25, stroke_color=GOLD, stroke_width=2,
                            fill_color=GOLD, fill_opacity=0.35)
    cuts = VGroup(*[Line(UP * 0.08 + RIGHT * x, DOWN * 0.04 + RIGHT * (x + 0.06), color=GOLD, stroke_width=1.5)
                    for x in (-0.14, 0, 0.14)]).move_to(body)
    return VGroup(body, cuts)


class Testing(VScene):
    header = HDR

    def construct(self):
        claim = pill("面包店：平均每个 500 克", GOLD, 30).move_to(UP * 2.3)
        loaves = VGroup(*[loaf() for _ in range(16)]).arrange_in_grid(rows=2, cols=8, buff=(0.22, 0.25)).move_to(UP * 0.7)
        st = tex(r"n=16,\quad \bar x=494,\quad s=10", size=44).move_to(DOWN * 0.7)
        with self.say("t01") as d:
            self.play(FadeIn(claim, shift=DOWN * 0.1), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(l, scale=0.6) for l in loaves], lag_ratio=0.05), run_time=1.4)
            self.play(Write(st), run_time=1.2)
        q = VGroup(tex(r"494-500=-6", size=40, color=RED), zh("真的偏轻，还是抽样的偶然？", 28)).arrange(RIGHT, buff=0.4) \
            .move_to(DOWN * 1.9)
        with self.say("t02") as d:
            self.play(FadeIn(q, shift=UP * 0.1), run_time=1.0)
        h0 = VGroup(tex(r"H_0:\ \mu=500", size=54, color=BLUE),
                    zh("H 零 · 原假设 · 零假设 null hypothesis", 24, BLUE)).arrange(DOWN, buff=0.15)
        h1 = VGroup(tex(r"H_1:\ \mu\neq 500", size=54, color=ORANGE),
                    zh("备择假设 alternative · 也写 Hₐ", 24, ORANGE)).arrange(DOWN, buff=0.15)
        hyp = VGroup(h0, h1).arrange(RIGHT, buff=1.4).move_to(UP * 1.2)
        with self.say("t03") as d:
            self.play(FadeOut(VGroup(loaves, st, q)), claim.animate.scale(0.8).to_edge(UP, buff=0.35).shift(RIGHT * 2.5),
                      run_time=0.7)
            self.play(Write(h0[0]), run_time=1.0)
            self.play(FadeIn(h0[1]), run_time=0.7)
        mu0 = VGroup(tex(r"\mu_0=500", size=44, color=BLUE), zh("缪零：原假设给出的值", 24, SOFT)).arrange(RIGHT, buff=0.3) \
            .move_to(DOWN * 0.4)
        with self.say("t04") as d:
            self.play(FadeIn(mu0, shift=UP * 0.1), run_time=0.9)
        with self.say("t05") as d:
            self.play(Write(h1[0]), run_time=1.0)
            self.play(FadeIn(h1[1]), run_time=0.7)
        idea = on_panel(VGroup(zh("先假定 H₀ 成立", 28, BLUE), Arrow(LEFT, RIGHT, color=GOLD).scale(0.6),
                               zh("这样的数据有多罕见？", 28)).arrange(RIGHT, buff=0.3), fill=PAPER).move_to(DOWN * 1.8)
        with self.say("t06") as d:
            self.play(FadeIn(idea, shift=UP * 0.1), run_time=1.0)
        tf = tex(r"t=\frac{\bar x-\mu_0}{s/\sqrt n}", size=56).move_to(LEFT * 2.6 + DOWN * 0.9)
        tl = VGroup(zh("检验统计量", 26, GOLD), zh("test statistic", 20, SOFT)).arrange(DOWN, buff=0.08).next_to(tf, LEFT, buff=0.4)
        with self.say("t07") as d:
            self.play(FadeOut(idea), FadeOut(mu0), run_time=0.5)
            self.play(Write(tf), FadeIn(tl), run_time=1.3)
            se_n = note(tf[0][9:], "标准误", DOWN, SOFT, 22, 0.2)
            self.play(FadeIn(se_n), run_time=0.6)
        tv = tex(r"=\frac{494-500}{10/4}=-2.4", size=56).next_to(tf, RIGHT, buff=0.25)
        with self.say("t08") as d:
            self.play(FadeOut(se_n), Write(tv), run_time=1.4)
            six = zh("比 500 低了 2.4 个标准误", 24, RED).next_to(tv, DOWN, buff=0.3)
            self.play(FadeIn(six), run_time=0.7)

        # ------------------------------------------------ t 分布、p 值、拒绝域
        f = lambda x: stats.t.pdf(x, DF)
        ax, lab = t_axes()
        cv = curve(ax, f, -4, 4, color=INK)
        summ = VGroup(tex(r"H_0:\ \mu=500", size=34, color=BLUE), tex(r"t=-2.4", size=34, color=RED),
                      tex(r"t\sim t(15)\ \text{（若 }H_0\text{ 成立）}", size=34)).arrange(RIGHT, buff=0.6).move_to(UP * 2.35)
        tmark = VGroup(Line(ax.c2p(T, 0), ax.c2p(T, 0.2), color=RED, stroke_width=4),
                       tex(r"-2.4", size=28, color=RED).next_to(ax.c2p(T, 0.2), UP, buff=0.08))
        with self.say("t09") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(summ[:2]), run_time=0.6)
            self.play(Create(ax), FadeIn(lab), Create(cv), FadeIn(summ[2]), run_time=1.3)
            self.play(Create(tmark[0]), FadeIn(tmark[1]), run_time=0.7)
        tails = VGroup(area(ax, f, -4, T, RED, 0.5), area(ax, f, -T, 4, RED, 0.5))
        mirror = DashedLine(ax.c2p(-T, 0), ax.c2p(-T, 0.2), color=RED, dash_length=0.06)
        pv = VGroup(tex(r"p=P\big(|T|\ge 2.4\mid H_0\big)\approx 0.030", size=40, color=RED),
                    zh("p 值 p-value：两侧尾巴的面积", 24, RED)).arrange(DOWN, buff=0.12).move_to(UP * 1.1)
        with self.say("t10") as d:
            self.play(FadeIn(tails), Create(mirror), run_time=1.0)
            self.play(Write(pv[0]), run_time=1.3)
            self.play(FadeIn(pv[1]), run_time=0.6)
        dec = VGroup(tex(r"\alpha=0.05", size=40, color=GOLD), zh("显著性水平 significance level", 22, SOFT)).arrange(RIGHT, buff=0.3)
        rule = VGroup(tex(r"p\le\alpha", size=40), Arrow(LEFT, RIGHT, color=GOLD).scale(0.5), zh("拒绝 H₀ · 统计上显著", 26, RED)) \
            .arrange(RIGHT, buff=0.25)
        decg = VGroup(dec, rule).arrange(DOWN, buff=0.2).move_to(UP * 1.1)
        with self.say("t11") as d:
            self.play(FadeOut(pv), run_time=0.4)
            self.play(FadeIn(dec, shift=UP * 0.1), run_time=0.8)
            self.wait(d * 0.2)
            self.play(FadeIn(rule, shift=UP * 0.1), run_time=0.9)
        rej = VGroup(area(ax, f, -4, -T_CRIT, GOLD, 0.45), area(ax, f, T_CRIT, 4, GOLD, 0.45))
        crit = VGroup(*[VGroup(Line(ax.c2p(s * T_CRIT, 0), ax.c2p(s * T_CRIT, 0.32), color=GOLD, stroke_width=3),
                               tex(f"{s * T_CRIT:+.2f}", size=26, color=GOLD).next_to(ax.c2p(s * T_CRIT, 0.32), UP, buff=0.06))
                        for s in (-1, 1)])
        rl = VGroup(zh("拒绝域 rejection region", 24, GOLD), zh("边界：临界值 critical value", 22, SOFT)) \
            .arrange(DOWN, buff=0.08).move_to(ax.c2p(3.6, 0.36))
        with self.say("t12") as d:
            self.play(FadeOut(decg), tails.animate.set_opacity(0.15), run_time=0.5)
            self.play(FadeIn(rej), Create(crit), run_time=1.0)
            self.play(FadeIn(rl), run_time=0.8)
        eq = VGroup(tex(r"p\le\alpha", size=40, color=RED), tex(r"\Longleftrightarrow", size=40),
                    zh("统计量落进拒绝域", 28, GOLD)).arrange(RIGHT, buff=0.3).move_to(UP * 1.1)
        with self.say("t13") as d:
            self.play(FadeIn(eq, shift=UP * 0.1), run_time=0.9)
            self.play(Indicate(tmark, color=RED), run_time=1.0)
        # 误读
        wrong = VGroup(VGroup(cross_mark(), zh("P(H₀ 为真)", 28)).arrange(RIGHT, buff=0.3),
                       VGroup(cross_mark(), zh("“结果出于偶然”的概率", 28)).arrange(RIGHT, buff=0.3),
                       VGroup(check_mark(), tex(r"P(\text{至少这么极端}\mid H_0)", size=40, color=GREEN)).arrange(RIGHT, buff=0.3)) \
            .arrange(DOWN, buff=0.35, aligned_edge=LEFT).move_to(UP * 0.3)
        ptitle = zh("p 值不是什么", 30, RED).next_to(wrong, UP, buff=0.4)
        with self.say("t14") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(ptitle), FadeIn(wrong[0], shift=RIGHT * 0.1), run_time=0.8)
            self.play(FadeIn(wrong[1], shift=RIGHT * 0.1), run_time=0.8)
            self.wait(d * 0.2)
            self.play(FadeIn(wrong[2], shift=RIGHT * 0.1), run_time=0.9)
        nr = VGroup(VGroup(check_mark(), zh("不拒绝 H₀", 30, GREEN)).arrange(RIGHT, buff=0.25),
                    VGroup(cross_mark(), zh("接受 H₀", 30, RED)).arrange(RIGHT, buff=0.25),
                    zh("证据不足 ≠ 证明成立", 26, SOFT)).arrange(RIGHT, buff=0.7).move_to(DOWN * 2.2)
        cond = tex(r"p>\alpha:", size=36).next_to(nr, LEFT, buff=0.4)
        with self.say("t15") as d:
            VGroup(cond, nr).move_to(DOWN * 2.2)
            self.play(FadeIn(cond), FadeIn(nr[0]), run_time=0.8)
            self.play(FadeIn(nr[1]), run_time=0.7)
            self.play(FadeIn(nr[2]), run_time=0.7)

        def mini(two):
            a = axes((-3.5, 3.5, 1), (0, 0.42, 0.1), 4.2, 1.6, y_axis=False)
            g = VGroup(a, curve(a, npdf, -3.5, 3.5, color=INK, width=2.5))
            if two:
                g.add(area(a, npdf, -3.5, -1.96, RED, 0.5), area(a, npdf, 1.96, 3.5, RED, 0.5),
                      tex(r"\tfrac{\alpha}{2}", size=26, color=RED).move_to(a.c2p(-2.7, 0.12)),
                      tex(r"\tfrac{\alpha}{2}", size=26, color=RED).move_to(a.c2p(2.7, 0.12)))
            else:
                g.add(area(a, npdf, -3.5, -1.645, RED, 0.5), tex(r"\alpha", size=26, color=RED).move_to(a.c2p(-2.6, 0.12)))
            return g

        two = VGroup(mini(True), tex(r"H_1:\ \mu\neq\mu_0", size=32), zh("双侧检验 two-sided", 24)).arrange(DOWN, buff=0.15)
        one = VGroup(mini(False), tex(r"H_1:\ \mu<\mu_0\ \ (\text{或}>)", size=32), zh("单侧检验 one-sided", 24)).arrange(DOWN, buff=0.15)
        sides = VGroup(two, one).arrange(RIGHT, buff=1.2).move_to(DOWN * 0.1)
        with self.say("t16") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(two, shift=UP * 0.1), run_time=0.9)
            self.wait(d * 0.3)
            self.play(FadeIn(one, shift=UP * 0.1), run_time=0.9)
        self.wait(0.3)
        self.clear(run_time=0.6)


class Errors(VScene):
    header = HDR

    def construct(self):
        def cell(t1, t2, color, op=0.15):
            g = VGroup(zh(t1, 26, color), tex(t2, size=46, color=color) if t2 else VMobject()).arrange(DOWN, buff=0.1)
            bg = Rectangle(width=4.0, height=1.3, stroke_width=0, fill_color=color, fill_opacity=op).move_to(g)
            return VGroup(bg, g)

        rows = [
            [zh("", 24), zh("H₀ 为真", 28, BLUE), zh("H₀ 为假", 28, ORANGE)],
            [zh("拒绝 H₀", 28), cell("第一类错误 · 弃真", r"\alpha", RED), cell("正确：功效", r"1-\beta", GREEN)],
            [zh("不拒绝 H₀", 28), cell("正确", r"1-\alpha", GREEN, 0.08), cell("第二类错误 · 取伪", r"\beta", BLUE)],
        ]
        tb = grid_table(rows, [2.6, 4.2, 4.2], row_h=1.45).move_to(DOWN * 0.1)
        with self.say("t17") as d:
            self.play(FadeIn(tb[0]), FadeIn(tb[1][0]), FadeIn(tb[2][0]), Create(tb[-1]), run_time=0.9)
            self.play(FadeIn(tb[1][1], scale=0.9), run_time=0.9)
            self.play(FadeIn(tb[2][1]), run_time=0.6)
        with self.say("t18") as d:
            self.play(FadeIn(tb[2][2], scale=0.9), run_time=0.9)
        with self.say("t19") as d:
            self.play(FadeIn(tb[1][2], scale=0.9), run_time=0.9)
            pw = zh("功效 · 检验力 power", 24, GREEN).next_to(tb, DOWN, buff=0.3).align_to(tb[1][2], LEFT)
            self.play(FadeIn(pw), run_time=0.6)

        ax = axes((-3, 6, 1), (0, 0.7, 0.1), 10.0, 3.0, center=DOWN * 0.9, y_axis=False)
        sd, c = ValueTracker(1.0), ValueTracker(1.64)
        m1 = 2.6
        f0 = lambda x: npdf(x, 0, sd.get_value())
        f1 = lambda x: npdf(x, m1, sd.get_value())
        g0 = always_redraw(lambda: curve(ax, f0, -3, 6, color=BLUE))
        g1 = always_redraw(lambda: curve(ax, f1, -3, 6, color=ORANGE))
        aa = always_redraw(lambda: area(ax, f0, c.get_value(), 6, RED, 0.55))
        bb = always_redraw(lambda: area(ax, f1, -3, c.get_value(), BLUE, 0.3))
        cl = always_redraw(lambda: Line(ax.c2p(c.get_value(), 0), ax.c2p(c.get_value(), 0.66), color=GOLD, stroke_width=3))
        labs = VGroup(zh("H₀ 成立时", 24, BLUE).move_to(ax.c2p(-1.6, 0.5)), zh("H₁ 成立时", 24, ORANGE).move_to(ax.c2p(4.4, 0.5)))
        leg = VGroup(VGroup(Square(0.25, fill_color=RED, fill_opacity=0.55, stroke_width=0), tex(r"\alpha", size=34, color=RED)).arrange(RIGHT, buff=0.15),
                     VGroup(Square(0.25, fill_color=BLUE, fill_opacity=0.3, stroke_width=0), tex(r"\beta", size=34, color=BLUE)).arrange(RIGHT, buff=0.15),
                     VGroup(Line(UP * 0.15, DOWN * 0.15, color=GOLD, stroke_width=3), zh("临界值", 22, GOLD)).arrange(RIGHT, buff=0.15)) \
            .arrange(RIGHT, buff=0.6).move_to(UP * 2.1)
        with self.say("t20") as d:
            self.clear(run_time=0.6)
            self.add(g0, g1)
            self.play(Create(ax), FadeIn(labs), run_time=0.8)
            self.add(bb, aa, cl)
            self.play(FadeIn(leg), run_time=0.7)
            self.wait(d * 0.35)
            self.play(c.animate.set_value(2.4), run_time=1.6)
            self.play(c.animate.set_value(1.64), run_time=1.0)
        nn = pill("加大样本量：两条曲线都变窄", GOLD, 26).move_to(UP * 1.35)
        pa = VGroup(zh("功效分析 power analysis：事先估算样本量", 22, SOFT)).next_to(nn, DOWN, buff=0.15)
        with self.say("t21") as d:
            self.play(FadeIn(nn), sd.animate.set_value(0.62), c.animate.set_value(1.02), run_time=1.8)
            self.play(FadeIn(pa), run_time=0.6)
        for m in (g0, g1, aa, bb, cl):
            m.clear_updaters()

        # ------------------------------------------------ 星号与报告格式
        rws = [[zh("变量", 24, SOFT), zh("系数", 24, SOFT)],
               [zh("学习时长", 26), tex(r"0.42^{***}", size=34)],
               [zh("睡眠时间", 26), tex(r"0.18^{**}", size=34)],
               [zh("通勤时间", 26), tex(r"-0.11^{*}", size=34)],
               [zh("年龄", 26), tex(r"0.03\ \ \text{n.s.}", size=34, color=SOFT)]]
        reg = grid_table(rws, [2.4, 2.4], row_h=0.6).move_to(LEFT * 3.2 + DOWN * 0.1)
        key = VGroup(tex(r"^{*}\ \ p<0.05", size=36), tex(r"^{**}\ \ p<0.01", size=36), tex(r"^{***}\ \ p<0.001", size=36),
                     VGroup(tex(r"\text{n.s.}", size=36), zh("不显著", 24)).arrange(RIGHT, buff=0.2)) \
            .arrange(DOWN, buff=0.22, aligned_edge=LEFT).move_to(RIGHT * 2.6 + DOWN * 0.1)
        with self.say("t22") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(reg), run_time=0.9)
            self.play(LaggedStart(*[FadeIn(k, shift=LEFT * 0.1) for k in key], lag_ratio=0.4), run_time=min(3.0, d - 1.6))
        rep = tex(r"t", r"(15)", r"=-2.40,\ \ p=", r".030", size=64).move_to(UP * 0.7)
        rn = VGroup(note(rep[1], "自由度", DOWN, GOLD, 24, 0.3), note(rep[3], "省略开头的 0", DOWN, GOLD, 24, 0.3))
        with self.say("t23") as d:
            self.clear(run_time=0.6)
            self.play(Write(rep), run_time=1.3)
            self.play(FadeIn(rn[0]), run_time=0.7)
            self.wait(d * 0.2)
            self.play(FadeIn(rn[1]), run_time=0.7)
        big = VGroup(zh("n = 100000，平均只轻了 0.1 克", 26), tex(r"p<0.001", size=40, color=RED),
                     zh("统计显著 ≠ 差别重要", 30, GOLD)).arrange(DOWN, buff=0.2).move_to(UP * 0.4)
        with self.say("t24") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(big[0]), run_time=0.7)
            self.play(FadeIn(big[1]), run_time=0.7)
            self.play(FadeIn(big[2], shift=UP * 0.1), run_time=0.8)
        es = VGroup(VGroup(zh("效应量 effect size", 28, BLUE), zh("Cohen's d", 22, SOFT)).arrange(RIGHT, buff=0.3),
                    tex(r"d=\frac{|\bar x-\mu_0|}{s}=\frac{6}{10}=0.6", size=48, color=BLUE)).arrange(DOWN, buff=0.25).move_to(DOWN * 1.5)
        with self.say("t25") as d:
            self.play(big.animate.shift(UP * 0.7), run_time=0.5)
            self.play(FadeIn(es[0]), Write(es[1]), run_time=1.4)
        grid = VGroup(*[RoundedRectangle(width=0.55, height=0.55, corner_radius=0.08, stroke_color=LINE, stroke_width=1.5,
                                         fill_color=PAPER, fill_opacity=1) for _ in range(20)]).arrange_in_grid(rows=2, cols=10, buff=0.12)
        grid.move_to(UP * 1.2)
        gl = zh("20 次检验，每次 α = 0.05", 24, SOFT).next_to(grid, UP, buff=0.25)
        fam = tex(r"P(\text{至少一次误报})=1-0.95^{20}\approx 64\%", size=36, color=RED).next_to(grid, DOWN, buff=0.35)
        bon = VGroup(zh("邦费罗尼校正 Bonferroni：", 26, GREEN), tex(r"\alpha/m=0.05/20=0.0025", size=38, color=GREEN)) \
            .arrange(RIGHT, buff=0.2).next_to(fam, DOWN, buff=0.35)
        with self.say("t26") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(gl), LaggedStart(*[FadeIn(g, scale=0.7) for g in grid], lag_ratio=0.04), run_time=1.2)
            self.play(grid[13].animate.set_fill(RED, 0.8), run_time=0.6)
            self.play(Write(fam), run_time=1.2)
            self.wait(d * 0.15)
            self.play(FadeIn(bon, shift=UP * 0.1), run_time=0.9)
        trs = [[zh("检验", 24, SOFT), zh("统计量的分布", 24, SOFT), zh("常见用途", 24, SOFT)],
               [zh("z 检验", 28), tex(r"N(0,1)", size=36), zh("σ 已知、大样本", 24)],
               [zh("t 检验", 28), tex(r"t(\text{df})", size=36), zh("均值，σ 未知", 24)],
               [zh("卡方检验", 28), tex(r"\chi^2(\text{df})", size=36), zh("列联表、拟合优度", 24)],
               [zh("F 检验 · ANOVA", 28), tex(r"F(\text{df}_1,\text{df}_2)", size=36), zh("方差之比、多组均值", 24)]]
        ttb = grid_table(trs, [3.6, 3.4, 4.0], row_h=0.78).move_to(DOWN * 0.1)
        with self.say("t27") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(ttb[0]), Create(ttb[-1]), run_time=0.6)
            self.play(LaggedStart(*[FadeIn(r, shift=UP * 0.1) for r in ttb[1:-1]], lag_ratio=0.35), run_time=min(3.2, d - 1.2))
            self.play(Indicate(ttb[4][0], color=GOLD), run_time=0.8)
        self.wait(0.3)
        self.clear(run_time=0.6)
