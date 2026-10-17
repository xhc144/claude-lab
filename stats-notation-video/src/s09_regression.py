"""九 · 回归：因变量与自变量、β₀ β₁ ε、ŷ、残差 e 与误差 ε、OLS、SST/SSR/SSE 的两套写法、R²、矩阵形式、调整 R²；
方差分析表、逻辑回归、odds、OR、RR、混杂。"""
from common import *

HDR = "九 · 回归"

RNG = np.random.default_rng(8)
XS = np.array([1.0, 1.8, 2.5, 3.2, 4.0, 4.6, 5.5, 6.1, 7.0, 7.8, 8.6, 9.5])
B0, B1 = 2.0, 0.8                                    # 总体直线（未知）
YS = B0 + B1 * XS + RNG.normal(0, 1.1, len(XS))
b1, b0 = np.polyfit(XS, YS, 1)                       # 拟合直线


class Regression(VScene):
    header = HDR

    def construct(self):
        ax = axes((0, 11, 1), (0, 12, 2), 6.2, 4.3, center=LEFT * 3.2 + DOWN * 0.45)
        pts = VGroup(*[Dot(ax.c2p(x, y), radius=0.08, color=INK) for x, y in zip(XS, YS)])
        xl = VGroup(tex("x", size=34, color=BLUE), zh("自变量 · 解释变量 · 预测变量", 20, BLUE)).arrange(RIGHT, buff=0.15) \
            .next_to(ax.c2p(11, 0), DOWN, buff=0.25).align_to(ax.c2p(11, 0), RIGHT)
        yl = VGroup(tex("y", size=34, color=ORANGE), zh("因变量 · 响应变量", 20, ORANGE)).arrange(RIGHT, buff=0.15) \
            .next_to(ax.c2p(0, 12), UP, buff=0.15).align_to(ax.c2p(0, 12), LEFT)
        with self.say("r01") as d:
            self.play(Create(ax), run_time=0.7)
            self.play(LaggedStart(*[FadeIn(p, scale=0.5) for p in pts], lag_ratio=0.08), run_time=1.2)
            self.play(FadeIn(yl), run_time=0.6)
            self.wait(d * 0.15)
            self.play(FadeIn(xl), run_time=0.6)
        RX = 3.6
        model = tex(r"y=", r"\beta_0", r"+", r"\beta_1", r"x", r"+", r"\varepsilon", size=56).move_to([RX, 2.0, 0])
        mn = VGroup(note(model[1], "截距", DOWN, BLUE, 22, 0.25), note(model[3], "斜率", DOWN, BLUE, 22, 0.25))
        true_l = DashedLine(ax.c2p(0, B0), ax.c2p(11, B0 + B1 * 11), color=GRAY, dash_length=0.1, stroke_width=2.5)
        tl_l = zh("总体直线（未知）", 20, GRAY).next_to(ax.c2p(10.5, B0 + B1 * 10.5), UP, buff=0.2).shift(LEFT * 0.6)
        with self.say("r02") as d:
            self.play(Write(model), run_time=1.3)
            self.play(FadeIn(mn), model[1].animate.set_color(BLUE), model[3].animate.set_color(BLUE), run_time=0.8)
            self.play(Create(true_l), FadeIn(tl_l), run_time=0.9)
        eps = VGroup(VGroup(tex(r"\varepsilon", size=44, color=RED), zh("epsilon 艾普西隆 · 误差项", 22, RED)).arrange(RIGHT, buff=0.2),
                     tex(r"\varepsilon\sim N(0,\,\sigma^2)", size=40, color=RED)).arrange(DOWN, buff=0.2).move_to([RX, 0.45, 0])
        with self.say("r03") as d:
            self.play(model[6].animate.set_color(RED), FadeIn(eps[0]), run_time=0.8)
            self.wait(d * 0.3)
            self.play(Write(eps[1]), run_time=1.0)
        fit = Line(ax.c2p(0, b0), ax.c2p(11, b0 + b1 * 11), color=BLUE, stroke_width=4)
        fitf = VGroup(tex(r"\hat y=\hat\beta_0+\hat\beta_1x", size=48, color=BLUE),
                      zh("拟合值 · 预测值 fitted value", 22, SOFT)).arrange(DOWN, buff=0.12).move_to([RX, 0.45, 0])
        with self.say("r04") as d:
            self.play(FadeOut(eps), Create(fit), run_time=1.0)
            self.play(FadeIn(fitf), run_time=0.8)
        res = VGroup(*[Line(ax.c2p(x, b0 + b1 * x), ax.c2p(x, y), color=ORANGE, stroke_width=3) for x, y in zip(XS, YS)])
        k = 8
        xk, yk = XS[k], YS[k]
        e_lab = tex(r"e_i", size=32, color=ORANGE).next_to(res[k], RIGHT, buff=0.1)
        eps_seg = DashedLine(ax.c2p(xk - 0.15, B0 + B1 * xk), ax.c2p(xk - 0.15, yk), color=RED, dash_length=0.05, stroke_width=3)
        eps_lab = tex(r"\varepsilon_i", size=32, color=RED).next_to(eps_seg, LEFT, buff=0.1)
        cmp = VGroup(VGroup(tex(r"e_i=y_i-\hat y_i", size=40, color=ORANGE), zh("残差：样本里，算得出", 22, ORANGE)).arrange(DOWN, buff=0.1),
                     VGroup(tex(r"\varepsilon_i", size=40, color=RED), zh("误差：总体里，看不见", 22, RED)).arrange(DOWN, buff=0.1)) \
            .arrange(RIGHT, buff=0.6).move_to([RX, -1.35, 0])
        with self.say("r05") as d:
            self.play(LaggedStart(*[Create(r) for r in res], lag_ratio=0.08), run_time=1.2)
            self.play(FadeIn(e_lab), FadeIn(cmp[0]), run_time=0.8)
            self.wait(d * 0.15)
            self.play(Create(eps_seg), FadeIn(eps_lab), FadeIn(cmp[1]), run_time=0.9)
        ols = VGroup(tex(r"\min\ \sum_{i=1}^{n} e_i^2", size=46, color=ORANGE),
                     zh("普通最小二乘 ordinary least squares · OLS", 22, SOFT)).arrange(DOWN, buff=0.12).move_to([RX, -0.2, 0])
        with self.say("r06") as d:
            self.play(FadeOut(VGroup(cmp, eps_seg, eps_lab, e_lab, fitf, mn)), run_time=0.5)
            self.play(Write(ols[0]), FadeIn(ols[1]), run_time=1.2)
        ss = VGroup(tex(r"\text{SST}=\sum(y_i-\bar y)^2", size=36),
                    tex(r"\text{SSR}=\sum(\hat y_i-\bar y)^2", size=36, color=BLUE),
                    tex(r"\text{SSE}=\sum(y_i-\hat y_i)^2", size=36, color=ORANGE)).arrange(DOWN, buff=0.18, aligned_edge=LEFT)
        names = VGroup(zh("总平方和", 22), zh("回归平方和", 22, BLUE), zh("残差平方和", 22, ORANGE))
        for n_, s_ in zip(names, ss):
            n_.next_to(s_, RIGHT, buff=0.25)
        sumf = tex(r"\text{SST}=\text{SSR}+\text{SSE}", size=44, color=GOLD)
        ssg = VGroup(VGroup(ss, names), sumf).arrange(DOWN, buff=0.35).move_to([RX + 0.1, -0.3, 0])
        ybar = DashedLine(ax.c2p(0, YS.mean()), ax.c2p(11, YS.mean()), color=GOLD, dash_length=0.08, stroke_width=2)
        yb = tex(r"\bar y", size=30, color=GOLD).next_to(ax.c2p(11, YS.mean()), RIGHT, buff=0.1)
        with self.say("r07") as d:
            self.play(FadeOut(ols), FadeOut(model), FadeOut(true_l), FadeOut(tl_l), Create(ybar), FadeIn(yb), run_time=0.7)
            self.play(FadeIn(ss[0]), FadeIn(names[0]), run_time=0.8)
            self.play(FadeIn(ss[1]), FadeIn(names[1]), run_time=0.8)
            self.play(FadeIn(ss[2]), FadeIn(names[2]), run_time=0.8)
            self.play(Write(sumf), run_time=0.9)
        conv = [[zh("", 22), zh("本片 · 多数统计教材", 22, SOFT), zh("部分计量经济学教材", 22, SOFT)],
                [zh("解释掉的", 24), tex(r"\text{SSR}", size=36, color=BLUE), tex(r"\text{SSE}\ \ (\text{ESS})", size=36, color=RED)],
                [zh("剩下的残差", 24), tex(r"\text{SSE}", size=36, color=ORANGE), tex(r"\text{SSR}\ \ (\text{RSS})", size=36, color=RED)]]
        ctb = grid_table(conv, [2.2, 3.4, 3.6], row_h=0.8)
        warn = VGroup(zh("同样的缩写，可能正好反过来", 28, RED), ctb, zh("认准定义，别只认字母", 26, GOLD)).arrange(DOWN, buff=0.35) \
            .move_to(DOWN * 0.1)
        with self.say("r08") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(warn[0]), run_time=0.7)
            self.play(FadeIn(ctb), run_time=1.2)
            self.wait(d * 0.3)
            self.play(FadeIn(warn[2], shift=UP * 0.1), run_time=0.8)
        r2 = VGroup(tex(r"R^2=\frac{\text{SSR}}{\text{SST}}=1-\frac{\text{SSE}}{\text{SST}}", size=50),
                    zh("决定系数 coefficient of determination", 24, SOFT),
                    VGroup(zh("只有一个自变量时：", 24), tex(r"R^2=r^2", size=44, color=GOLD)).arrange(RIGHT, buff=0.2)) \
            .arrange(DOWN, buff=0.3).move_to(UP * 0.2)
        with self.say("r09") as d:
            self.clear(run_time=0.6)
            self.play(Write(r2[0]), FadeIn(r2[1]), run_time=1.4)
            self.wait(d * 0.2)
            self.play(FadeIn(r2[2], shift=UP * 0.1), run_time=0.8)
        mat = tex(r"\underbrace{\begin{pmatrix}y_1\\ \vdots\\ y_n\end{pmatrix}}_{\mathbf y}=",
                  r"\underbrace{\begin{pmatrix}1&x_{11}&\cdots&x_{1p}\\ \vdots&\vdots&&\vdots\\ 1&x_{n1}&\cdots&x_{np}\end{pmatrix}}_{\mathbf X}",
                  r"\underbrace{\begin{pmatrix}\beta_0\\ \vdots\\ \beta_p\end{pmatrix}}_{\boldsymbol\beta}+",
                  r"\underbrace{\begin{pmatrix}\varepsilon_1\\ \vdots\\ \varepsilon_n\end{pmatrix}}_{\boldsymbol\varepsilon}", size=40) \
            .move_to(DOWN * 0.3)
        short = tex(r"\mathbf y=\mathbf X\boldsymbol\beta+\boldsymbol\varepsilon", size=56).move_to(UP * 2.1)
        dm = note(mat[1], "设计矩阵 design matrix：每列一个变量", DOWN, BLUE, 22, 0.25)
        with self.say("r10") as d:
            self.clear(run_time=0.6)
            self.play(Write(short), run_time=1.0)
            self.play(FadeIn(mat), run_time=1.2)
            self.play(mat[1].animate.set_color(BLUE), FadeIn(dm), run_time=0.8)
        sol = VGroup(tex(r"\hat{\boldsymbol\beta}=(\mathbf X^{\mathsf T}\mathbf X)^{-1}\mathbf X^{\mathsf T}\mathbf y", size=56, color=BLUE),
                     VGroup(zh("ᵀ：转置 transpose", 24, SOFT), zh("计量经济学常写", 24, SOFT), tex(r"\mathbf X'\mathbf X", size=40, color=SOFT))
                     .arrange(RIGHT, buff=0.3)).arrange(DOWN, buff=0.3).move_to(DOWN * 0.2)
        with self.say("r11") as d:
            self.play(FadeOut(mat), FadeOut(dm), run_time=0.5)
            self.play(Write(sol[0]), run_time=1.4)
            self.wait(d * 0.15)
            self.play(FadeIn(sol[1], shift=UP * 0.1), run_time=0.8)
        adj = VGroup(tex(r"\bar R^2=1-(1-R^2)\,\frac{n-1}{n-p-1}", size=48),
                     VGroup(zh("调整后的 R² adjusted", 24, SOFT), zh("p：自变量个数（又一个 p）", 24, RED)).arrange(RIGHT, buff=0.5)) \
            .arrange(DOWN, buff=0.25).move_to(DOWN * 0.6)
        with self.say("r12") as d:
            self.play(sol.animate.scale(0.7).move_to(UP * 1.0), run_time=0.6)
            self.play(Write(adj[0]), run_time=1.3)
            self.play(FadeIn(adj[1]), run_time=0.7)
        self.wait(0.3)
        self.clear(run_time=0.6)


class Models(VScene):
    header = HDR

    def construct(self):
        T = lambda s, c=INK, z=34: tex(s, size=z, color=c)
        rows = [[zh(t, 24, SOFT) for t in ("来源", "df", "SS", "MS", "F", "p")],
                [zh("回归", 26, BLUE), T("p"), T(r"\text{SSR}", BLUE), T(r"\text{MSR}=\frac{\text{SSR}}{p}", BLUE),
                 T(r"\frac{\text{MSR}}{\text{MSE}}", GOLD), T(r"\cdots", SOFT)],
                [zh("残差", 26, ORANGE), T("n-p-1"), T(r"\text{SSE}", ORANGE), T(r"\text{MSE}=\frac{\text{SSE}}{n-p-1}", ORANGE),
                 VMobject(), VMobject()],
                [zh("总计", 26), T("n-1"), T(r"\text{SST}"), VMobject(), VMobject(), VMobject()]]
        tb = grid_table(rows, [1.6, 1.6, 1.4, 3.6, 1.8, 1.0], row_h=1.0).move_to(DOWN * 0.3)
        ttl = VGroup(zh("方差分析表", 30, GOLD), zh("ANOVA table", 22, SOFT)).arrange(RIGHT, buff=0.3).next_to(tb, UP, buff=0.4)
        with self.say("r13") as d:
            self.play(FadeIn(ttl), FadeIn(tb[0]), Create(tb[-1]), run_time=0.9)
            self.play(LaggedStart(*[FadeIn(VGroup(*r[:3]), shift=UP * 0.1) for r in tb[1:4]], lag_ratio=0.35), run_time=1.6)
            self.wait(d * 0.15)
            self.play(FadeIn(tb[1][3]), FadeIn(tb[2][3]), FadeIn(tb[1][4]), FadeIn(tb[1][5]), run_time=1.0)
        with self.say("r14") as d:
            self.play(Circumscribe(VGroup(tb[1][3], tb[2][3]), color=GOLD, fade_out=True), run_time=1.4)
            self.play(Circumscribe(tb[1][4], color=GOLD, fade_out=True), run_time=1.2)
        # 逻辑回归
        ax = axes((-6, 6, 2), (0, 1, 0.5), 6.0, 3.2, center=LEFT * 3.3 + DOWN * 0.5, y_axis=False)
        ax.add(Line(ax.c2p(-6, 0), ax.c2p(-6, 1.05), color=LINE, stroke_width=2))
        sig = lambda x: 1 / (1 + math.exp(-x))
        sc = curve(ax, sig, -6, 6, color=BLUE)
        rng = np.random.default_rng(4)
        xs = np.linspace(-5.5, 5.5, 22)
        ys = [1 if rng.random() < sig(x) else 0 for x in xs]
        dts = VGroup(*[Dot(ax.c2p(x, y), radius=0.06, color=ORANGE if y else GRAY) for x, y in zip(xs, ys)])
        yl = VGroup(tex("1", size=24, color=SOFT).next_to(ax.c2p(-6, 1), LEFT, buff=0.1), tex("0", size=24, color=SOFT).next_to(ax.c2p(-6, 0), LEFT, buff=0.1),
                    zh("是", 20, ORANGE).next_to(ax.c2p(6, 1), RIGHT, buff=0.1), zh("否", 20, GRAY).next_to(ax.c2p(6, 0), RIGHT, buff=0.1))
        lg = VGroup(zh("逻辑斯谛回归 · 逻辑回归", 28, BLUE), zh("logistic regression", 20, SOFT),
                    tex(r"\text{logit}(p)=\ln\frac{p}{1-p}=\beta_0+\beta_1x", size=38)).arrange(DOWN, buff=0.15).move_to(RIGHT * 3.4 + UP * 1.6)
        with self.say("r15") as d:
            self.clear(run_time=0.6)
            self.play(Create(ax), FadeIn(yl), FadeIn(dts), run_time=0.9)
            self.play(Create(sc), FadeIn(lg[:2]), run_time=1.0)
            self.play(Write(lg[2]), run_time=1.3)
        od = VGroup(tex(r"\text{odds}=\frac{p}{1-p}", size=46, color=GOLD),
                    zh("优势 · 比值（也译“几率”）", 24, GOLD),
                    zh("≠ 日常说的几率（概率）", 22, RED)).arrange(DOWN, buff=0.15).move_to(RIGHT * 3.4 + DOWN * 0.55)
        with self.say("r16") as d:
            self.play(Write(od[0]), run_time=1.1)
            self.play(FadeIn(od[1]), run_time=0.6)
            self.wait(d * 0.2)
            self.play(FadeIn(od[2]), run_time=0.6)
        ex = VGroup(tex(r"p=0.8:\ \ \text{odds}=\frac{0.8}{0.2}=4", size=40), zh("“4 比 1”", 24, SOFT)).arrange(RIGHT, buff=0.3)
        orr = VGroup(tex(r"\text{OR}=\frac{\text{odds}_1}{\text{odds}_2}", size=44, color=BLUE), zh("比值比 · 优势比 odds ratio", 22, SOFT),
                     zh("OR = 1：两组没有差别", 22, BLUE)).arrange(DOWN, buff=0.12)
        g17 = VGroup(ex, orr).arrange(DOWN, buff=0.45).move_to(UP * 0.2)
        with self.say("r17") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(ex, shift=UP * 0.1), run_time=1.0)
            self.wait(d * 0.15)
            self.play(Write(orr[0]), FadeIn(orr[1]), run_time=1.1)
            self.play(FadeIn(orr[2]), run_time=0.6)
        rr = VGroup(tex(r"\text{RR}=\frac{p_1}{p_2}", size=44, color=ORANGE), zh("相对危险度 relative risk", 22, SOFT)).arrange(DOWN, buff=0.12)
        cmp = [[zh("", 22), zh("p₁", 24, SOFT), zh("p₂", 24, SOFT), zh("RR", 24, ORANGE), zh("OR", 24, BLUE)],
               [zh("常见事件", 24), T("0.4"), T("0.2"), T("2", ORANGE), T("2.67", BLUE)],
               [zh("罕见事件", 24), T("0.02"), T("0.01"), T("2", ORANGE), T("2.02", BLUE)]]
        ctb = grid_table(cmp, [2.2, 1.4, 1.4, 1.4, 1.4], row_h=0.7)
        g18 = VGroup(rr, ctb).arrange(RIGHT, buff=0.9).move_to(DOWN * 0.2)
        with self.say("r18") as d:
            self.play(FadeOut(ex), orr.animate.scale(0.8).to_edge(UP, buff=0.8), run_time=0.6)
            self.play(FadeIn(rr), run_time=0.9)
            self.play(FadeIn(ctb), run_time=1.0)
            self.play(Indicate(ctb[2][4], color=GOLD), Indicate(ctb[2][3], color=GOLD), run_time=1.0)

        def box(t, c):
            return on_panel(zh(t, 26, c), fill=PAPER, stroke=c, pad=0.25)

        z = box("气温", RED).move_to(UP * 1.6)
        xi = box("冰淇淋销量", BLUE).move_to(LEFT * 3.2 + DOWN * 1.0)
        yi = box("溺水人数", ORANGE).move_to(RIGHT * 3.2 + DOWN * 1.0)
        a1 = Arrow(z.get_bottom(), xi.get_top(), color=RED, buff=0.15)
        a2 = Arrow(z.get_bottom(), yi.get_top(), color=RED, buff=0.15)
        q = DashedLine(xi.get_right(), yi.get_left(), color=GRAY, dash_length=0.12, buff=0.15)
        ql = zh("相关，但不是因果", 22, GRAY).next_to(q, DOWN, buff=0.15)
        conf = zh("混杂变量 confounder", 24, RED).next_to(z, RIGHT, buff=0.3)
        rct = pill("随机对照试验 RCT：随机分组，切断混杂", GREEN, 24).move_to(DOWN * 2.5)
        with self.say("r19") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(xi), FadeIn(yi), Create(q), FadeIn(ql), run_time=1.0)
            self.play(FadeIn(z), GrowArrow(a1), GrowArrow(a2), FadeIn(conf), run_time=1.2)
            self.wait(d * 0.25)
            self.play(FadeIn(rct, shift=UP * 0.1), run_time=0.8)
        self.wait(0.3)
        self.clear(run_time=0.6)
