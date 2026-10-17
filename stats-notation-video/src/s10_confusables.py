"""十 · 容易混淆的记号：p、β、π、α、r/ρ/R²/R、头顶记号、像等号的符号、竖线与分号；贝叶斯、写法变体、缩写速查。"""
from scipy import stats

from common import *

HDR = "十 · 容易混淆的记号"


def big_card(sym, rows, color=INK, sym_size=120):
    """左边一个大记号，右边逐条列出它的几种意思。rows 里每条是 (TeX 记号或 None, 中文说明, 颜色)。"""
    s = tex(sym, size=sym_size, color=color) if isinstance(sym, str) else sym
    items = VGroup()
    for t, txt, c in rows:
        parts = []
        if t:
            parts.append(tex(t, size=40, color=c))
        parts.append(zh(txt, 28, c))
        items.add(VGroup(*parts).arrange(RIGHT, buff=0.25))
    items.arrange(DOWN, buff=0.32, aligned_edge=LEFT)
    body = VGroup(s, items).arrange(RIGHT, buff=0.9)
    return on_panel(body, pad=0.5, fill=PAPER, min_w=10.5, min_h=4.2)


class Confusables(VScene):
    header = HDR

    def construct(self):
        t = VGroup(zh("同一个符号，身兼数职", 40), zh("记号不够用，只好一字多义", 26, SOFT)).arrange(DOWN, buff=0.25).move_to(UP * 0.3)
        with self.say("c01") as d:
            self.play(FadeIn(t, shift=UP * 0.1), run_time=1.0)
        cards = [
            ("c02", "p", [(r"p", "p 值", RED), (r"p", "成功的概率 · 比例", BLUE), (r"p", "回归里自变量的个数", ORANGE),
                          (r"P", "概率", INK)]),
            ("c03", r"\beta", [(None, "检验：第二类错误的概率", RED), (None, "回归：系数", BLUE), (None, "贝塔分布 Beta(a, b)", GREEN)]),
            ("c04", r"\pi", [(None, "圆周率 3.14159…", SOFT), (None, "总体比例", BLUE), (r"\pi(\lambda)", "泊松分布", ORANGE),
                             (r"\pi(\theta)", "先验分布", GREEN), (r"\prod", "大写：连乘", INK)]),
            ("c05", r"\alpha", [(None, "显著性水平", RED), (None, "有些回归模型里的截距", BLUE)]),
            ("c06", r"r\ \ \rho\ \ R^2\ \ R", [(r"r", "样本相关系数", ORANGE), (r"\rho", "总体相关系数", BLUE),
                                              (r"R^2", "决定系数", GOLD), (r"R", "极差 / 复相关系数 / 统计软件 R", SOFT)]),
            ("c07", r"\bar x\ \ \bar A\ \ \hat\theta\ \ \tilde x", [(r"\bar x", "横线：平均", ORANGE), (r"\bar A", "横线：补事件", GOLD),
                                                                    (r"\hat\theta", "帽子：估计", BLUE), (r"\tilde x", "波浪：常指中位数", GREEN)]),
            ("c08", r"\sim\ \approx\ \propto", [(r"\sim", "服从", GOLD), (r"\approx", "约等于", INK), (r"\propto", "正比于", BLUE),
                                                (r":=\ \ \triangleq", "定义为", GREEN)]),
            ("c09", r"\mid\ \ ;", [(r"f(x\mid\theta)", "给定 θ：θ 当作随机变量的取值（贝叶斯）", BLUE),
                                   (r"f(x;\theta)", "θ 是一个固定的参数", ORANGE)]),
        ]
        prev = t
        for key, sym, rows in cards:
            c = big_card(sym, rows, sym_size=110 if len(sym) > 8 else 130).move_to(DOWN * 0.1)
            lst = c[1][1]
            with self.say(key) as d:
                self.play(FadeOut(prev, shift=LEFT * 1.5), FadeIn(c[0], shift=LEFT * 1.5), FadeIn(c[1][0], shift=LEFT * 1.5),
                          run_time=0.8)
                step = max(0.4, min(1.2, (d - 1.2) / len(lst)))
                for it in lst:
                    self.play(FadeIn(it, shift=RIGHT * 0.15), run_time=min(0.6, step))
                    self.wait(max(0, step - 0.6))
            prev = c
        self.wait(0.3)
        self.play(FadeOut(prev), run_time=0.6)


class Glossary(VScene):
    header = HDR

    def construct(self):
        ax = axes((0, 1, 0.1), (0, 4.2, 1), 6.6, 3.2, center=LEFT * 3.0 + DOWN * 0.6, y_axis=False)
        xl = VGroup(*[tex(f"{v:g}", size=22, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.1) for v in (0, 0.5, 1)])
        th = tex(r"\theta", size=30, color=SOFT).next_to(ax.c2p(1, 0), RIGHT, buff=0.15)
        prior = lambda x: stats.beta.pdf(x, 2, 2)
        like = lambda x: stats.beta.pdf(x, 8, 4)          # 7 正 3 反的似然，已归一化便于同框比较
        post = lambda x: stats.beta.pdf(x, 9, 5)
        cp = curve(ax, prior, 0.001, 0.999, color=BLUE)
        cl = DashedVMobject(curve(ax, like, 0.001, 0.999, color=ORANGE), num_dashes=50)
        cq = curve(ax, post, 0.001, 0.999, color=GREEN, width=5)
        labs = VGroup(VGroup(tex(r"\pi(\theta)", size=34, color=BLUE), zh("先验 prior", 22, BLUE)).arrange(RIGHT, buff=0.15),
                      VGroup(tex(r"p(x\mid\theta)", size=34, color=ORANGE), zh("似然 likelihood", 22, ORANGE)).arrange(RIGHT, buff=0.15),
                      VGroup(tex(r"p(\theta\mid x)", size=34, color=GREEN), zh("后验 posterior", 22, GREEN)).arrange(RIGHT, buff=0.15)) \
            .arrange(DOWN, buff=0.25, aligned_edge=LEFT).move_to(RIGHT * 3.6 + UP * 1.4)
        with self.say("c10") as d:
            self.play(Create(ax), FadeIn(xl), FadeIn(th), run_time=0.7)
            self.play(Create(cp), FadeIn(labs[0]), run_time=1.0)
            self.wait(d * 0.15)
            self.play(Create(cl), FadeIn(labs[1]), run_time=1.0)
            self.wait(d * 0.15)
            self.play(Create(cq), FadeIn(labs[2]), run_time=1.0)
        prop = tex(r"p(\theta\mid x)", r"\propto", r"p(x\mid\theta)", r"\,\pi(\theta)", size=48).move_to(RIGHT * 3.5 + DOWN * 0.5)
        prop[0].set_color(GREEN); prop[2].set_color(ORANGE); prop[3].set_color(BLUE)
        pn = note(prop[1], "省掉一个常数 p(x)", DOWN, GOLD, 22, 0.3)
        with self.say("c11") as d:
            self.play(Write(prop), run_time=1.4)
            self.play(Indicate(prop[1], color=GOLD, scale_factor=1.5), FadeIn(pn), run_time=1.0)
        lo, hi = stats.beta.ppf(0.025, 9, 5), stats.beta.ppf(0.975, 9, 5)
        cred = area(ax, post, lo, hi, GREEN, 0.3)
        cr = VGroup(zh("95% 可信区间 credible interval", 24, GREEN),
                    tex(rf"P({lo:.2f}\le\theta\le {hi:.2f}\mid x)=0.95", size=32, color=GREEN)).arrange(DOWN, buff=0.12) \
            .move_to(RIGHT * 3.5 + DOWN * 2.3)
        with self.say("c12") as d:
            self.play(FadeIn(cred), run_time=0.9)
            self.play(FadeOut(pn), FadeIn(cr), run_time=0.9)
        T = lambda s, c=INK: tex(s, size=44, color=c)
        rows = [[zh("概念", 24, SOFT), zh("常见写法", 24, SOFT)],
                [zh("期望", 28), VGroup(T("E"), T(r"\mathbb{E}", GOLD)).arrange(RIGHT, buff=0.5)],
                [zh("方差", 28), VGroup(T(r"\Var"), T("D"), T("V")).arrange(RIGHT, buff=0.5)],
                [zh("概率", 28), VGroup(T("P"), T(r"\Pr"), T(r"\mathbb{P}", GOLD)).arrange(RIGHT, buff=0.5)]]
        vt = grid_table(rows, [2.4, 4.4], row_h=0.85).move_to(DOWN * 0.1)
        with self.say("c13") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(vt[0]), Create(vt[-1]), run_time=0.6)
            self.play(LaggedStart(*[FadeIn(r, shift=UP * 0.1) for r in vt[1:-1]], lag_ratio=0.4), run_time=min(3.0, d - 1.0))

        def group(title, pairs, color):
            rows = VGroup(*[VGroup(zh(a, 30, color, weight=BOLD), zh(b, 24)).arrange(RIGHT, buff=0.3) for a, b in pairs])
            rows.arrange(DOWN, buff=0.22, aligned_edge=LEFT)
            head = zh(title, 26, SOFT)
            return on_panel(VGroup(head, rows).arrange(DOWN, buff=0.3, aligned_edge=LEFT), fill=PAPER, pad=0.3, min_w=3.9, min_h=4.6)

        g1 = group("描述统计", [("SD", "标准差"), ("SE", "标准误"), ("IQR", "四分位距"), ("CV", "变异系数")], ORANGE)
        g2 = group("分布与估计", [("PDF", "密度函数"), ("CDF", "分布函数"), ("i.i.d.", "独立同分布"), ("MLE", "最大似然估计"),
                             ("OLS", "普通最小二乘"), ("CI", "置信区间")], BLUE)
        g3 = group("检验与模型", [("H₀", "原假设"), ("df", "自由度"), ("ANOVA", "方差分析"), ("OR", "比值比"), ("RR", "相对危险度")], GREEN)
        gs = VGroup(g1, g2, g3).arrange(RIGHT, buff=0.35, aligned_edge=UP).move_to(DOWN * 0.15)
        for k, g in zip(("c14", "c15", "c16"), gs):
            with self.say(k) as d:
                if k == "c14":
                    self.clear(run_time=0.6)
                rows_ = g[1][1]
                self.play(FadeIn(g[0]), FadeIn(g[1][0]), run_time=0.5)
                step = max(0.35, min(1.0, (d - 0.9) / len(rows_)))
                for r in rows_:
                    self.play(FadeIn(r, shift=RIGHT * 0.1), run_time=min(0.5, step))
                    self.wait(max(0, step - 0.5))
        self.wait(0.8)
        self.clear(run_time=0.6)
