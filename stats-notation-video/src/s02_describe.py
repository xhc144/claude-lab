"""二 · 描述统计：数据类型、Σ、x̄、顺序统计量、中位数、众数、直方图与偏度；四分位数、箱线图、方差、自由度、z 分数。"""
from common import *
from data import HOURS, MEAN7

HDR = "二 · 描述统计"


def number_line(center=DOWN * 1.9, length=10.5, lo=0, hi=16):
    nl = NumberLine(x_range=[lo, hi, 1], length=length, color=LINE, include_numbers=False, tick_size=0.05,
                    stroke_width=2).move_to(center)
    nums = VGroup(*[tex(str(v), size=24, color=SOFT).next_to(nl.n2p(v), DOWN, buff=0.15) for v in range(lo, hi + 1, 2)])
    return nl, nums


def stacked_dots(nl, values, color=INK, r=0.1, gap=0.27):
    seen, out = {}, VGroup()
    for v in values:
        k = seen.get(v, 0)
        seen[v] = k + 1
        out.add(Dot(nl.n2p(v) + UP * (0.2 + k * gap), radius=r, color=color))
    return out


def value_boxes(values, w=0.9, color=INK):
    g = VGroup()
    for v in values:
        sq = RoundedRectangle(width=w, height=w * 0.8, corner_radius=0.08, stroke_color=LINE, stroke_width=1.5,
                              fill_color=PAPER, fill_opacity=1)
        g.add(VGroup(sq, tex(str(v), size=40, color=color).move_to(sq)))
    return g.arrange(RIGHT, buff=0.16)


class Describe(VScene):
    header = HDR

    def construct(self):
        def node(t, en, color=INK, size=30):
            return VGroup(zh(t, size, color), zh(en, 18, SOFT)).arrange(DOWN, buff=0.08)

        root = node("数据", "data", INK, 34).move_to(UP * 2.3)
        cat = node("分类变量", "categorical", ORANGE).move_to(LEFT * 3.3 + UP * 0.9)
        num = node("数值变量", "numerical", BLUE).move_to(RIGHT * 3.3 + UP * 0.9)
        leaves = [
            (node("定类", "nominal", ORANGE, 28), "性别、血型", LEFT * 5.0 + DOWN * 0.7, cat),
            (node("定序", "ordinal", ORANGE, 28), "低 < 中 < 高", LEFT * 1.7 + DOWN * 0.7, cat),
            (node("离散", "discrete", BLUE, 28), "人数、次数", RIGHT * 1.7 + DOWN * 0.7, num),
            (node("连续", "continuous", BLUE, 28), "身高、时间", RIGHT * 5.0 + DOWN * 0.7, num),
        ]
        leaf_g = []
        for nd, ex, pos, par in leaves:
            nd.move_to(pos)
            e = zh(ex, 24, SOFT).next_to(nd, DOWN, buff=0.22)
            ln = Line(par.get_bottom(), nd.get_top(), color=LINE, stroke_width=2, buff=0.12)
            leaf_g.append(VGroup(ln, nd, e))
        l_root = VGroup(Line(root.get_bottom(), cat.get_top(), color=LINE, stroke_width=2, buff=0.12),
                        Line(root.get_bottom(), num.get_top(), color=LINE, stroke_width=2, buff=0.12))
        with self.say("d01") as d:
            self.play(FadeIn(root, shift=DOWN * 0.1), run_time=0.8)
        with self.say("d02") as d:
            self.play(Create(l_root[0]), FadeIn(cat), run_time=0.8)
            self.play(FadeIn(leaf_g[0], shift=DOWN * 0.1), run_time=0.8)
        with self.say("d03") as d:
            self.play(FadeIn(leaf_g[1], shift=DOWN * 0.1), run_time=0.8)
            self.wait(d * 0.3)
            self.play(Create(l_root[1]), FadeIn(num), run_time=0.8)
            self.play(LaggedStart(FadeIn(leaf_g[2], shift=DOWN * 0.1), FadeIn(leaf_g[3], shift=DOWN * 0.1),
                                  lag_ratio=0.5), run_time=1.2)

        # ------------------------------------------------ 七个数
        row = tex(r"6,\ 6,\ 6,\ 7,\ 7,\ 10,\ 14", size=50).move_to(UP * 2.35)
        nl, nums = number_line()
        dots = stacked_dots(nl, HOURS)
        unit = zh("小时", 22, SOFT).next_to(nl, RIGHT, buff=0.2)
        with self.say("d04") as d:
            self.clear(run_time=0.6)
            self.play(Write(row), run_time=1.0)
            self.play(Create(nl), FadeIn(nums), FadeIn(unit), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(x, shift=DOWN * 0.3) for x in dots], lag_ratio=0.2), run_time=1.4)
        sig = tex(r"\sum", size=110).move_to(UP * 0.55 + LEFT * 2.2)
        sig_lab = VGroup(zh("Σ  大写西格玛", 26, GOLD), zh("全部加起来", 24, SOFT)).arrange(DOWN, buff=0.12) \
            .next_to(sig, RIGHT, buff=0.6)
        with self.say("d05") as d:
            self.play(Write(sig), run_time=0.8)
            self.play(FadeIn(sig_lab, shift=LEFT * 0.1), run_time=0.7)
        full = tex(r"\sum_{i=1}^{n}", r"x_i", r"=x_1+x_2+\cdots+x_n", size=56).move_to(UP * 0.75)
        a1 = note(full[0][2:5], "起点 i = 1", direction=DOWN, size=22, buff=0.35)
        a2 = note(full[0][0], "终点 n", direction=UP, size=22, buff=0.2)
        a3 = note(full[1], "每一项", direction=DOWN, size=22, buff=0.55, color=ORANGE)
        with self.say("d06") as d:
            self.play(FadeOut(sig_lab), ReplacementTransform(sig, full[0]), run_time=0.9)
            self.play(FadeIn(a2), FadeIn(a1), run_time=0.8)
            self.play(Write(full[1]), FadeIn(a3), run_time=0.7)
            self.play(Write(full[2]), run_time=1.0)
        s56 = tex(r"\sum_{i=1}^{7}x_i=6+6+6+7+7+10+14=56", size=44).move_to(UP * 1.15)
        mean = tex(r"\bar x=\frac{1}{n}\sum_{i=1}^{n}x_i=\frac{56}{7}=8", size=44, color=ORANGE).next_to(s56, DOWN,
                                                                                                   buff=0.25)
        fulc = Triangle(color=ORANGE, fill_color=ORANGE, fill_opacity=1).scale(0.13).move_to(nl.n2p(8) + DOWN * 0.13)
        fl = tex(r"\bar x", size=34, color=ORANGE).next_to(fulc, DOWN, buff=0.35)
        with self.say("d07") as d:
            self.play(FadeOut(VGroup(a1, a2, a3)), ReplacementTransform(full, s56), run_time=0.9)
            self.wait(d * 0.2)
            self.play(Write(mean), run_time=1.2)
            self.play(FadeIn(fulc, shift=UP * 0.2), FadeIn(fl), run_time=0.7)

        # ------------------------------------------------ 顺序统计量
        boxes = value_boxes(sorted(HOURS)).move_to(UP * 1.0)
        labs = VGroup(*[tex(rf"x_{{({i})}}", size=34, color=SOFT).next_to(b, UP, buff=0.18)
                        for i, b in enumerate(boxes, 1)])
        with self.say("d08") as d:
            self.play(FadeOut(VGroup(s56, mean)), ReplacementTransform(row, boxes), run_time=1.0)
            self.play(LaggedStart(*[FadeIn(l, shift=DOWN * 0.1) for l in labs], lag_ratio=0.15), run_time=1.4)
        with self.say("d09") as d:
            self.play(Indicate(labs[0], color=GOLD), run_time=0.8)
            lab_n = tex(r"x_{(n)}", size=34, color=GOLD).move_to(labs[-1])
            self.play(Indicate(labs[-1], color=GOLD), Transform(labs[-1], lab_n), run_time=0.9)
        med_box = boxed(boxes[3], BLUE, buff=0.06)
        med_lab = VGroup(zh("中位数 median = 7", 26, BLUE),
                         tex(r"\tilde x\ \ (\text{x 波浪})\qquad M\qquad Q_2", size=34, color=BLUE)) \
            .arrange(DOWN, buff=0.15).next_to(boxes, DOWN, buff=0.4)
        with self.say("d10") as d:
            self.play(Create(med_box), run_time=0.6)
            self.play(FadeIn(med_lab[0]), run_time=0.6)
            self.wait(d * 0.3)
            self.play(Write(med_lab[1]), run_time=1.0)
        mode_box = boxed(VGroup(*boxes[:3]), GREEN, buff=0.06)
        mode_lab = zh("众数 mode = 6", 26, GREEN).next_to(mode_box, DOWN, buff=0.35).align_to(med_lab, UP)
        with self.say("d11") as d:
            self.play(med_lab.animate.shift(RIGHT * 2.4), run_time=0.5)
            self.play(Create(mode_box), FadeIn(mode_lab), run_time=0.8)

        def marker(v, color, label):
            ln = DashedLine(nl.n2p(v) + UP * 1.3, nl.n2p(v), color=color, stroke_width=3, dash_length=0.07)
            t = zh(label, 22, color).next_to(ln, UP, buff=0.08)
            return VGroup(ln, t)

        mk = VGroup(marker(6, GREEN, "众数 6"), marker(7, BLUE, "中位数 7"), marker(8, ORANGE, "均值 8"))
        mk[1][1].shift(UP * 0.35)
        mk[2][1].shift(UP * 0.7)
        pull = Arrow(nl.n2p(14) + UP * 0.6, nl.n2p(9.2) + UP * 0.6, color=RED, stroke_width=3, buff=0,
                     max_tip_length_to_length_ratio=0.12)
        with self.say("d12") as d:
            self.play(FadeOut(VGroup(boxes, labs, med_box, med_lab, mode_box, mode_lab)), run_time=0.6)
            self.play(LaggedStart(*[FadeIn(m, shift=DOWN * 0.1) for m in mk], lag_ratio=0.4), run_time=1.6)
            self.play(Indicate(dots[-1], color=RED, scale_factor=1.6), GrowArrow(pull), run_time=1.0)

        # ------------------------------------------------ 直方图与偏度
        rng = np.random.default_rng(5)
        sample = rng.gamma(2.2, 2.0, 200)
        edges = np.arange(0, 22, 2)
        cnt, _ = np.histogram(sample, bins=edges)
        ax = axes((0, 20, 2), (0, 60, 10), 9.0, 4.2, center=DOWN * 0.15 + LEFT * 0.4)
        hb = bars(ax, edges[:-1] + 1, cnt, width=2.0, color=BLUE, opacity=0.55)
        ylab_f = zh("频数", 24, SOFT).next_to(ax.c2p(0, 60), UP, buff=0.15)
        ylab_r = zh("频率", 24, GOLD).move_to(ylab_f)
        yt_f = VGroup(*[tex(str(v), size=22, color=SOFT).next_to(ax.c2p(0, v), LEFT, buff=0.12) for v in (20, 40, 60)])
        yt_r = VGroup(*[tex(f"{v / 200:.1f}", size=22, color=GOLD).next_to(ax.c2p(0, v), LEFT, buff=0.12)
                        for v in (20, 40, 60)])
        xt = VGroup(*[tex(str(v), size=22, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.12) for v in range(0, 21, 4)])
        hist_lab = zh("直方图 histogram", 26, BLUE).move_to(RIGHT * 3.6 + UP * 2.2)
        with self.say("d13") as d:
            self.clear(run_time=0.6)
            self.play(Create(ax), FadeIn(xt), FadeIn(yt_f), FadeIn(ylab_f), run_time=0.8)
            self.play(LaggedStart(*[GrowFromEdge(b, DOWN) for b in hb], lag_ratio=0.1), run_time=min(2.0, d * 0.3))
            self.wait(d * 0.2)
            self.play(ReplacementTransform(yt_f, yt_r), ReplacementTransform(ylab_f, ylab_r), run_time=0.9)
            self.play(FadeIn(hist_lab), run_time=0.6)
        warn = on_panel(VGroup(zh("统计里的频率 = 频数 ÷ 总数", 26), zh("是比例，不是“每秒几次”", 24, SOFT))
                        .arrange(DOWN, buff=0.15), fill=PAPER).move_to(RIGHT * 3.6 + UP * 1.1)
        with self.say("d14") as d:
            self.play(FadeIn(warn, shift=UP * 0.1), run_time=0.8)
        k = 2.2
        dens = lambda x: (x ** (k - 1) * math.exp(-x / 2.0)) / (math.gamma(k) * 2.0 ** k) * 200 * 2.0
        cv = curve(ax, dens, 0.01, 20, color=INK, width=3)
        mean_v, med_v = k * 2.0, 3.72
        m1 = VGroup(vline(ax, med_v, dens(med_v), BLUE, 3), zh("中位数", 20, BLUE))
        m2 = VGroup(vline(ax, mean_v, dens(mean_v), ORANGE, 3), zh("均值", 20, ORANGE))
        m1[1].next_to(m1[0].get_top(), LEFT, buff=0.12).shift(DOWN * 0.9)
        m2[1].next_to(m2[0].get_top(), RIGHT, buff=0.12).shift(DOWN * 0.7)
        skew_lab = VGroup(zh("右偏 · 正偏", 30, RED), zh("right-skewed", 20, SOFT)).arrange(DOWN, buff=0.1) \
            .move_to(ax.c2p(13, 32))
        tail = Arrow(ax.c2p(9, 14), ax.c2p(17, 4), color=RED, stroke_width=3, buff=0)
        with self.say("d15") as d:
            self.play(FadeOut(warn), FadeOut(hist_lab), hb.animate.set_opacity(0.25), Create(cv), run_time=1.0)
            self.play(GrowArrow(tail), FadeIn(skew_lab), run_time=0.9)
            self.play(Create(m1[0]), FadeIn(m1[1]), Create(m2[0]), FadeIn(m2[1]), run_time=0.9)

        def shape(fn, color=INK):
            a = axes((-3, 3, 1), (0, 0.6, 0.2), 2.4, 1.0, y_axis=False)
            return VGroup(a, curve(a, fn, -3, 3, color=color, width=3))

        sk = lambda s: (lambda x: 2 * npdf(x) * (0.5 * (1 + math.erf(s * x / math.sqrt(2)))))
        skews = VGroup(VGroup(shape(sk(-4)), zh("左偏", 22, SOFT)).arrange(DOWN, buff=0.12),
                       VGroup(shape(npdf), zh("对称", 22, SOFT)).arrange(DOWN, buff=0.12),
                       VGroup(shape(sk(4)), zh("右偏", 22, SOFT)).arrange(DOWN, buff=0.12)).arrange(RIGHT, buff=0.4)
        lap = lambda x: 0.5 / 0.75 * math.exp(-abs(x) / 0.75) * 0.75 / 0.75
        kurts = VGroup(VGroup(shape(lambda x: math.exp(-abs(x) * 1.6) * 0.8), zh("尾部厚 · 尖", 22, SOFT)).arrange(DOWN, buff=0.12),
                       VGroup(shape(lambda x: 0.38 * max(0, 1 - (x / 2.1) ** 4)), zh("尾部薄 · 平", 22, SOFT)).arrange(DOWN, buff=0.12)
                       ).arrange(RIGHT, buff=0.4)
        g1 = VGroup(VGroup(zh("偏度", 30, ORANGE), zh("skewness", 20, SOFT)).arrange(RIGHT, buff=0.2), skews) \
            .arrange(DOWN, buff=0.3)
        g2 = VGroup(VGroup(zh("峰度", 30, BLUE), zh("kurtosis", 20, SOFT)).arrange(RIGHT, buff=0.2), kurts) \
            .arrange(DOWN, buff=0.3)
        VGroup(g1, g2).arrange(DOWN, buff=0.5).move_to(DOWN * 0.15)
        with self.say("d16") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(g1, shift=UP * 0.1), run_time=0.9)
            self.wait(d * 0.2)
            self.play(FadeIn(g2, shift=UP * 0.1), run_time=0.9)
        self.wait(0.4)
        self.clear(run_time=0.6)


class Spread(VScene):
    header = HDR

    def construct(self):
        boxes = value_boxes(sorted(HOURS)).move_to(UP * 2.0)
        nl, nums = number_line(center=DOWN * 1.6)
        dots = stacked_dots(nl, HOURS)
        qs = [(1, r"Q_1=6", ORANGE), (3, r"Q_2=7", BLUE), (5, r"Q_3=10", ORANGE)]
        qlab = VGroup(*[tex(t, size=34, color=c).next_to(boxes[i], DOWN, buff=0.3) for i, t, c in qs])
        lo_half = BraceBetweenPoints(boxes[0].get_corner(UL), boxes[2].get_corner(UR), UP, color=SOFT)
        hi_half = BraceBetweenPoints(boxes[4].get_corner(UL), boxes[6].get_corner(UR), UP, color=SOFT)
        with self.say("d17") as d:
            self.play(FadeIn(boxes), Create(nl), FadeIn(nums), FadeIn(dots), run_time=0.9)
            self.play(Indicate(boxes[3], color=BLUE), FadeIn(qlab[1]), run_time=0.8)
            self.play(GrowFromCenter(lo_half), GrowFromCenter(hi_half), run_time=0.8)
            self.play(FadeIn(qlab[0]), FadeIn(qlab[2]), run_time=0.8)
        alg = pill("算法不止一种，软件结果可能略有不同", SOFT, 24).move_to(UP * 0.35)
        with self.say("d18") as d:
            self.play(FadeIn(alg, shift=UP * 0.1), run_time=0.7)
        pct = VGroup(tex(r"Q_1", size=34, color=ORANGE), zh("= 25% 分位数", 24),
                     tex(r"Q_2", size=34, color=BLUE), zh("= 50% 分位数（中位数）", 24),
                     tex(r"Q_3", size=34, color=ORANGE), zh("= 75% 分位数", 24))
        prow = VGroup(VGroup(pct[0], pct[1]).arrange(RIGHT, buff=0.12), VGroup(pct[2], pct[3]).arrange(RIGHT, buff=0.12),
                      VGroup(pct[4], pct[5]).arrange(RIGHT, buff=0.12)).arrange(RIGHT, buff=0.6).move_to(UP * 0.35)
        with self.say("d19") as d:
            self.play(FadeOut(alg), run_time=0.4)
            self.play(LaggedStart(*[FadeIn(p, shift=UP * 0.1) for p in prow], lag_ratio=0.4), run_time=1.6)
        iqr = BraceBetweenPoints(nl.n2p(6), nl.n2p(10), DOWN, color=ORANGE, buff=0.55)
        iqr_l = tex(r"\text{IQR}=Q_3-Q_1=4", size=32, color=ORANGE).next_to(iqr, DOWN, buff=0.1)
        rng_b = BraceBetweenPoints(nl.n2p(6), nl.n2p(14), UP, color=SOFT, buff=1.15)
        rng_l = VGroup(zh("极差 range", 22, SOFT), tex(r"=14-6=8", size=30, color=SOFT)).arrange(RIGHT, buff=0.1) \
            .next_to(rng_b, UP, buff=0.08)
        with self.say("d20") as d:
            self.play(FadeOut(prow), FadeOut(nums), GrowFromCenter(iqr), FadeIn(iqr_l), run_time=0.9)
            self.wait(d * 0.3)
            self.play(GrowFromCenter(rng_b), FadeIn(rng_l), run_time=0.9)
        # 箱线图画在数轴上方
        y0 = nl.n2p(0)[1] + 1.35
        x = lambda v: nl.n2p(v)[0]
        box = Rectangle(width=x(10) - x(6), height=0.6, stroke_color=BLUE, stroke_width=3, fill_color=BLUE,
                        fill_opacity=0.12).move_to([(x(6) + x(10)) / 2, y0, 0])
        medl = Line([x(7), y0 - 0.3, 0], [x(7), y0 + 0.3, 0], color=BLUE, stroke_width=4)
        wh = VGroup(Line([x(10), y0, 0], [x(14), y0, 0], color=BLUE, stroke_width=2.5),
                    Line([x(14), y0 - 0.18, 0], [x(14), y0 + 0.18, 0], color=BLUE, stroke_width=2.5))
        bp = VGroup(box, medl, wh)
        fence = DashedLine([x(16), y0 - 0.6, 0], [x(16), y0 + 0.9, 0], color=RED, dash_length=0.08)
        fence_l = VGroup(tex(r"Q_3+1.5\,\text{IQR}=16", size=26, color=RED), zh("超过它算离群值", 20, RED)) \
            .arrange(DOWN, buff=0.06).next_to(fence, UP, buff=0.1).shift(LEFT * 0.6)
        bp_lab = zh("箱线图 boxplot", 26, BLUE).next_to(box, UP, buff=0.95).shift(LEFT * 1.3)
        with self.say("d21") as d:
            self.play(FadeOut(VGroup(rng_b, rng_l, boxes, qlab, lo_half, hi_half)), dots.animate.set_opacity(0.3),
                      run_time=0.7)
            self.play(Create(bp), FadeIn(bp_lab), run_time=1.2)
            self.wait(d * 0.25)
            self.play(Create(fence), FadeIn(fence_l), run_time=0.9)

        # ------------------------------------------------ 离差与方差
        self.clear(run_time=0.6)
        nl2, nums2 = number_line(center=DOWN * 2.0, length=6.6)
        VGroup(nl2, nums2).to_edge(LEFT, buff=0.7)
        dots2 = stacked_dots(nl2, HOURS, r=0.08, gap=0.22)
        mline = DashedLine(nl2.n2p(8) + UP * 1.0, nl2.n2p(8), color=ORANGE, dash_length=0.07)
        ml = tex(r"\bar x=8", size=28, color=ORANGE).next_to(mline, UP, buff=0.08)
        devs = VGroup()
        for dt in dots2:
            v = nl2.p2n(dt.get_center())
            devs.add(Arrow(nl2.n2p(8) + UP * (dt.get_center()[1] - nl2.n2p(0)[1]), dt.get_center(), buff=0.08,
                           color=ORANGE if v > 8 else BLUE, stroke_width=3, max_tip_length_to_length_ratio=0.3,
                           max_stroke_width_to_length_ratio=20))
        rows = [[tex(r"x_i", size=32, color=SOFT), tex(r"x_i-\bar x", size=32, color=SOFT),
                 tex(r"(x_i-\bar x)^2", size=32, color=SOFT)]]
        for v in HOURS:
            dv = int(v - MEAN7)
            rows.append([tex(str(v), size=32), tex(f"{dv:+d}".replace("+", "") if dv <= 0 else f"+{dv}", size=32,
                                                       color=BLUE if dv < 0 else ORANGE), tex(str(dv * dv), size=32)])
        rows.append([tex(r"\Sigma\ 56", size=32), tex("0", size=32, color=GOLD), tex("54", size=32, color=GOLD)])
        tb = grid_table(rows, [1.4, 1.7, 2.0], row_h=0.5).to_edge(RIGHT, buff=0.7).shift(UP * 0.1)
        sum_line = Line(tb[-2].get_left() + UP * 0.25, tb[-2].get_right() + UP * 0.25, color=INK, stroke_width=1.5)
        sum_line.set_x(tb.get_x()).set_width(tb.width)
        with self.say("d22") as d:
            self.play(Create(nl2), FadeIn(nums2), FadeIn(dots2), Create(mline), FadeIn(ml), run_time=0.9)
            self.play(LaggedStart(*[GrowArrow(a) for a in devs], lag_ratio=0.12), run_time=1.4)
            self.play(FadeIn(tb[0]), Create(tb[-1][0]), *[FadeIn(VGroup(r[0], r[1])) for r in tb[1:8]], run_time=1.0)
        with self.say("d23") as d:
            self.play(FadeIn(tb[8][1]), Create(sum_line), FadeIn(tb[8][0]), run_time=0.8)
            self.play(Indicate(tb[8][1], color=GOLD, scale_factor=1.4), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(r[2]) for r in tb[1:8]], lag_ratio=0.1), run_time=1.2)
            self.play(FadeIn(tb[8][2]), Indicate(tb[8][2], color=GOLD, scale_factor=1.4), run_time=0.9)
        s2 = tex(r"s^2=\frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar x)^2=\frac{54}{6}=9", size=40, color=ORANGE) \
            .move_to(LEFT * 3.0 + UP * 1.9)
        s1 = tex(r"s=\sqrt{9}=3", size=40, color=ORANGE).next_to(s2, DOWN, buff=0.3)
        with self.say("d24") as d:
            self.play(Write(s2), run_time=1.4)
            self.wait(d * 0.25)
            self.play(Write(s1), run_time=0.9)
        # 自由度：七个离差，前六个随意，第七个被定死
        slots = VGroup(*[RoundedRectangle(width=0.7, height=0.6, corner_radius=0.08, stroke_color=LINE,
                                          fill_color=PAPER, fill_opacity=1) for _ in range(7)]).arrange(RIGHT, buff=0.12)
        slots.move_to(LEFT * 3.0 + UP * 0.05)
        vals = [-2, -2, -2, -1, -1, 2]
        fill = VGroup(*[tex(str(v), size=30, color=BLUE if v < 0 else ORANGE).move_to(s) for v, s in zip(vals, slots)])
        q = tex("?", size=34, color=RED).move_to(slots[6])
        six = tex("6", size=34, color=RED).move_to(slots[6])
        cons = tex(r"\text{和}=0", size=30, color=GOLD).next_to(slots, DOWN, buff=0.25)
        with self.say("d25") as d:
            self.play(FadeOut(VGroup(devs, nl2, nums2, dots2, mline, ml)), FadeIn(slots), FadeIn(cons), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(f, scale=0.6) for f in fill], lag_ratio=0.25), run_time=min(2.4, d * 0.3))
            self.play(FadeIn(q), run_time=0.4)
            self.wait(d * 0.15)
            self.play(ReplacementTransform(q, six), Indicate(cons, color=GOLD), run_time=1.0)
        dfl = VGroup(zh("自由度", 30, GOLD), zh("degrees of freedom", 20, SOFT),
                     tex(r"\text{df}=n-1=6\qquad \nu\ (\text{nu 纽})", size=34, color=GOLD)).arrange(DOWN, buff=0.12) \
            .next_to(cons, DOWN, buff=0.3)
        with self.say("d26") as d:
            self.play(FadeIn(dfl, shift=UP * 0.1), run_time=0.9)
        unb = VGroup(tex(r"E(s^2)=\sigma^2", size=40, color=BLUE), zh("无偏 unbiased", 24, BLUE)).arrange(RIGHT, buff=0.3)
        with self.say("d27") as d:
            self.play(FadeOut(VGroup(slots, fill, six, cons, dfl, s1)), run_time=0.6)
            unb.next_to(s2, DOWN, buff=0.45)
            self.play(FadeIn(unb, shift=UP * 0.1), run_time=0.9)
        popf = VGroup(zh("总体", 24, BLUE),
                      tex(r"\sigma^2=\frac{1}{N}\sum_{i=1}^{N}(x_i-\mu)^2", size=40, color=BLUE)).arrange(RIGHT, buff=0.3)
        smpf = VGroup(zh("样本", 24, ORANGE),
                      tex(r"s^2=\frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar x)^2", size=40, color=ORANGE)).arrange(RIGHT, buff=0.3)
        cmp = VGroup(popf, smpf).arrange(DOWN, buff=0.4, aligned_edge=LEFT).move_to(LEFT * 3.0 + DOWN * 0.1)
        with self.say("d28") as d:
            self.play(FadeOut(unb), ReplacementTransform(s2, smpf[1]), FadeIn(smpf[0]), run_time=0.9)
            self.play(FadeIn(popf, shift=DOWN * 0.1), run_time=0.9)
            self.play(Circumscribe(popf, color=GOLD, fade_out=True), run_time=1.2)

        # ------------------------------------------------ z 分数
        self.clear(run_time=0.6)
        zf = tex(r"z=\frac{x-\bar x}{s}", size=60).move_to(UP * 1.9)
        zl = VGroup(zh("标准分 · z 分数", 28, GOLD), zh("standard score", 20, SOFT)).arrange(DOWN, buff=0.08) \
            .next_to(zf, RIGHT, buff=0.7)
        with self.say("d29") as d:
            self.play(Write(zf), run_time=1.0)
            self.play(FadeIn(zl), run_time=0.6)
        z14 = tex(r"z_{14}=\frac{14-8}{3}=2", size=48, color=ORANGE).next_to(zf, DOWN, buff=0.4)
        nl3 = NumberLine(x_range=[2, 14, 1], length=9.0, color=LINE, include_numbers=False, tick_size=0.05) \
            .move_to(DOWN * 1.2)
        top = VGroup(*[tex(str(v), size=24, color=SOFT).next_to(nl3.n2p(v), UP, buff=0.15) for v in (2, 5, 8, 11, 14)])
        bot = VGroup(*[tex(str(z), size=26, color=GOLD).next_to(nl3.n2p(8 + 3 * z), DOWN, buff=0.15)
                       for z in (-2, -1, 0, 1, 2)])
        zlab = zh("z", 24, GOLD).next_to(bot, LEFT, buff=0.3)
        xlab = zh("小时", 22, SOFT).next_to(top, LEFT, buff=0.3)
        d14 = Dot(nl3.n2p(14), radius=0.12, color=ORANGE)
        with self.say("d30") as d:
            self.play(Write(z14), run_time=1.2)
            self.play(Create(nl3), FadeIn(top), FadeIn(xlab), run_time=0.8)
            self.play(FadeIn(bot), FadeIn(zlab), FadeIn(d14, scale=0.5), run_time=0.9)
        ex = VGroup(VGroup(zh("身高 180 cm", 24), tex(r"\to z=1.2", size=32, color=GOLD)).arrange(RIGHT, buff=0.15),
                    VGroup(zh("体重 62 kg", 24), tex(r"\to z=-0.5", size=32, color=GOLD)).arrange(RIGHT, buff=0.15)) \
            .arrange(RIGHT, buff=1.0).move_to(DOWN * 2.45)
        with self.say("d31") as d:
            self.play(FadeIn(ex, shift=UP * 0.1), run_time=0.9)
        cv = VGroup(tex(r"\text{CV}=\frac{s}{\bar x}=\frac{3}{8}\approx 0.38", size=44, color=BLUE),
                    zh("变异系数 coefficient of variation", 22, SOFT)).arrange(DOWN, buff=0.15)
        with self.say("d32") as d:
            self.play(FadeOut(VGroup(nl3, top, bot, zlab, xlab, d14, ex)), run_time=0.6)
            cv.move_to(DOWN * 1.2)
            self.play(Write(cv[0]), FadeIn(cv[1]), run_time=1.2)
        self.wait(0.4)
        self.clear(run_time=0.6)
