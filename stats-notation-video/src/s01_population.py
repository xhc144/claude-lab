"""一 · 总体与样本：参数用希腊字母、统计量用拉丁字母；帽子是估计；大写是随机变量。"""
from common import *


def field(center, w=5.4, h=4.0, n=340, seed=1):
    rng = np.random.default_rng(seed)
    region = RoundedRectangle(width=w, height=h, corner_radius=0.5, stroke_color=BLUE, stroke_width=2,
                              fill_color=BLUE, fill_opacity=0.05).move_to(center)
    pts = []
    while len(pts) < n:
        x, y = rng.uniform(-w / 2 + 0.25, w / 2 - 0.25), rng.uniform(-h / 2 + 0.25, h / 2 - 0.25)
        pts.append(center + np.array([x, y, 0]))
    dots = VGroup(*[Dot(p, radius=0.035, color=BLUE).set_opacity(0.75) for p in pts])
    return region, dots


class Population(VScene):
    header = "一 · 总体与样本"

    def construct(self):
        region, dots = field(LEFT * 3.2 + UP * 0.1)
        circ = Circle(radius=1.45, color=ORANGE, stroke_width=2, fill_color=ORANGE, fill_opacity=0.05).move_to(
            RIGHT * 3.7 + UP * 0.1)
        rng = np.random.default_rng(7)
        pick = rng.choice(len(dots), 26, replace=False)
        targets = []
        while len(targets) < len(pick):
            v = rng.uniform(-1.2, 1.2, 2)
            if np.linalg.norm(v) < 1.22:
                targets.append(circ.get_center() + np.array([v[0], v[1], 0]))
        lab_pop = zh("总体", 32, BLUE).next_to(region, UP, buff=0.2)
        lab_smp = zh("样本", 32, ORANGE).next_to(circ, UP, buff=0.2).align_to(lab_pop, UP)

        with self.say("p01") as d:
            self.play(FadeIn(region), LaggedStart(*[FadeIn(x, scale=0.5) for x in dots], lag_ratio=0.004),
                      run_time=min(2.5, d * 0.45))
            chosen = VGroup(*[dots[i].copy() for i in pick])
            self.play(*[dots[i].animate.set_color(ORANGE).set_opacity(1) for i in pick], run_time=0.8)
            self.play(Create(circ), *[c.animate.move_to(t).set_color(ORANGE).set_opacity(1)
                                      for c, t in zip(chosen, targets)], run_time=min(2.0, d * 0.3))
        ex_pop = zh("全国高三学生的平均身高？", 24, SOFT).next_to(region, DOWN, buff=0.25)
        ex_smp = zh("实际测了 1000 人", 24, SOFT).next_to(circ, DOWN, buff=0.25).align_to(ex_pop, UP)
        with self.say("p02") as d:
            self.play(FadeIn(ex_pop, shift=UP * 0.1), run_time=0.7)
            self.play(FadeIn(ex_smp, shift=UP * 0.1), run_time=0.7)
        en1 = zh("population", 22, SOFT).next_to(lab_pop, RIGHT, buff=0.2).align_to(lab_pop, DOWN)
        en2 = zh("sample", 22, SOFT).next_to(lab_smp, RIGHT, buff=0.2).align_to(lab_smp, DOWN)
        with self.say("p03") as d:
            self.play(Write(lab_pop), FadeIn(en1), run_time=0.9)
            self.wait(d * 0.35)
            self.play(Write(lab_smp), FadeIn(en2), run_time=0.9)
        nn = tex(r"n=1000", size=36, color=ORANGE).move_to(circ.get_center() + DOWN * 0.0).set_z_index(3)
        nn_bg = BackgroundRectangle(nn, color=BG, fill_opacity=0.85, buff=0.08)
        NN = tex(r"N", size=36, color=BLUE).next_to(region.get_corner(UR), DL, buff=0.25)
        with self.say("p04") as d:
            self.play(FadeOut(ex_smp), run_time=0.4)
            self.play(FadeIn(nn_bg), Write(nn), run_time=0.8)
            self.wait(d * 0.35)
            self.play(FadeOut(ex_pop), Write(NN), run_time=0.8)
        par = VGroup(zh("参数 parameter", 28, BLUE), zh("确定，但通常不知道", 22, SOFT)).arrange(DOWN, buff=0.12) \
            .next_to(region, DOWN, buff=0.25)
        sta = VGroup(zh("统计量 statistic", 28, ORANGE), zh("算得出，换一批人就变", 22, SOFT)).arrange(DOWN, buff=0.12) \
            .next_to(circ, DOWN, buff=0.25).align_to(par, UP)
        with self.say("p05") as d:
            self.play(FadeIn(par, shift=UP * 0.1), run_time=0.8)
        with self.say("p06") as d:
            self.play(FadeIn(sta, shift=UP * 0.1), run_time=0.8)
            self.wait(d * 0.4)
            # 换一批人：样本点换一换
            new = []
            while len(new) < len(chosen):
                v = rng.uniform(-1.2, 1.2, 2)
                if np.linalg.norm(v) < 1.22:
                    new.append(circ.get_center() + np.array([v[0], v[1], 0]))
            self.play(*[c.animate.move_to(t) for c, t in zip(chosen, new)], run_time=1.0)
        greek = zh("希腊字母", 30, BLUE).next_to(par, DOWN, buff=0.2)
        latin = zh("拉丁字母", 30, ORANGE).next_to(sta, DOWN, buff=0.2)
        with self.say("p07") as d:
            self.play(Indicate(par[0], color=BLUE, scale_factor=1.08), FadeIn(greek, shift=UP * 0.1), run_time=1.0)
            self.play(Indicate(sta[0], color=ORANGE, scale_factor=1.08), FadeIn(latin, shift=UP * 0.1), run_time=1.0)

        # ------------------------------------------------ 对照表
        def sym(t, read, color):
            s = tex(t, size=46, color=color)
            if read:
                return VGroup(s, zh(read, 20, SOFT)).arrange(RIGHT, buff=0.22)
            return s

        rows = [
            [zh("", 24), zh("参数 · 总体", 26, BLUE), zh("统计量 · 样本", 26, ORANGE)],
            [zh("均值", 26), sym(r"\mu", "mu 缪", BLUE), sym(r"\bar x", "x bar · x 拔", ORANGE)],
            [zh("标准差", 26), sym(r"\sigma", "sigma 西格玛", BLUE), sym(r"s", None, ORANGE)],
            [zh("方差", 26), sym(r"\sigma^2", None, BLUE), sym(r"s^2", None, ORANGE)],
            [zh("相关系数", 26), sym(r"\rho", "rho 柔", BLUE), sym(r"r", None, ORANGE)],
            [zh("比例", 26), sym(r"p\ \ (\pi)", None, BLUE), sym(r"\hat p", "p hat · p 帽", ORANGE)],
            [zh("回归系数", 26), sym(r"\beta", "beta 贝塔", BLUE), sym(r"\hat\beta,\ b", None, ORANGE)],
            [zh("泛指参数", 26), sym(r"\theta", "theta 西塔", BLUE), sym(r"\hat\theta", "theta hat · 西塔帽", ORANGE)],
        ]
        tb = grid_table(rows, [2.4, 4.0, 4.4], row_h=0.7).move_to(DOWN * 0.15)
        head, body_rows, rule = tb[0], list(tb[1:-1]), tb[-1]
        with self.say("p08") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(head), Create(rule[0]), run_time=0.6)
            self.play(FadeIn(body_rows[0], shift=UP * 0.1), run_time=0.8)
        bar = body_rows[0][2][0]
        hl = boxed(bar, GOLD)
        nt = zh("一横 = 平均", 24, GOLD).next_to(body_rows[0][2], RIGHT, buff=0.3)
        with self.say("p09") as d:
            self.play(Create(hl), FadeIn(nt), run_time=0.8)
        with self.say("p10") as d:
            self.play(FadeOut(hl), FadeOut(nt), FadeIn(body_rows[1], shift=UP * 0.1), run_time=0.8)
        for k, row in zip(["p11", "p12", "p13", "p14", "p15"], body_rows[2:]):
            with self.say(k) as d:
                self.play(FadeIn(row, shift=UP * 0.1), run_time=0.8)
                if k == "p15":
                    self.play(*[Create(r) for r in rule[1:]], run_time=0.6)

        # ------------------------------------------------ 帽子
        big = VGroup(tex(r"\theta", size=120, color=BLUE), Arrow(LEFT, RIGHT, color=GOLD, stroke_width=4).scale(0.9),
                     tex(r"\hat\theta", size=120, color=ORANGE)).arrange(RIGHT, buff=0.5).move_to(UP * 0.6)
        cap = VGroup(zh("真值（参数）", 24, BLUE).next_to(big[0], DOWN, buff=0.3),
                     zh("估计", 24, GOLD).next_to(big[1], UP, buff=0.15),
                     zh("用样本算出的估计", 24, ORANGE).next_to(big[2], DOWN, buff=0.3))
        with self.say("p16") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(big[0]), run_time=0.6)
            self.play(GrowArrow(big[1]), FadeIn(cap[1]), TransformFromCopy(big[0], big[2]), run_time=1.0)
            self.play(FadeIn(cap[0]), FadeIn(cap[2]), Indicate(big[2], color=GOLD), run_time=1.0)
        more = VGroup(
            VGroup(tex(r"\hat p", size=60, color=ORANGE), zh("比例的估计", 24, SOFT)).arrange(DOWN, buff=0.2),
            VGroup(tex(r"\hat y", size=60, color=ORANGE), zh("对 y 的预测", 24, SOFT)).arrange(DOWN, buff=0.2),
        ).arrange(RIGHT, buff=2.0).move_to(DOWN * 1.8)
        with self.say("p17") as d:
            self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.15) for m in more], lag_ratio=0.5), run_time=1.4)
            self.wait(d * 0.3)
            self.play(Circumscribe(VGroup(big[2], more), color=GOLD, fade_out=True), run_time=1.4)

        # ------------------------------------------------ 大写与小写
        t_before = zh("抽样之前", 30, SOFT).move_to(LEFT * 3.4 + UP * 2.4)
        t_after = zh("抽样之后", 30, SOFT).move_to(RIGHT * 3.4 + UP * 2.4)
        sep = DashedLine(UP * 2.7, DOWN * 2.6, color=LINE, dash_length=0.1)
        with self.say("p18") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(t_before), FadeIn(t_after), Create(sep), run_time=0.9)
        Xi = tex(r"X_i", size=96, color=BLUE).move_to(LEFT * 3.4 + UP * 1.1)
        ax = axes((150, 195, 15), (0, 0.06, 0.02), 3.0, 0.9, center=LEFT * 3.4 + DOWN * 0.3, y_axis=False)
        bell = curve(ax, lambda x: npdf(x, 171, 7), 150, 195, color=BLUE, width=3)
        lab_rv = zh("随机变量 · 大写", 24, BLUE).next_to(ax, DOWN, buff=0.25)
        with self.say("p19") as d:
            self.play(Write(Xi), run_time=0.8)
            self.play(Create(bell), FadeIn(ax), run_time=1.2)
            self.play(FadeIn(lab_rv), run_time=0.6)
        xi = tex(r"x_i", r"=172.4", size=96, color=ORANGE).move_to(RIGHT * 3.4 + UP * 1.1)
        xi[1].set_color(INK).scale(0.7, about_edge=LEFT)
        lab_obs = zh("观测值 · 小写", 24, ORANGE).move_to(RIGHT * 3.4).align_to(lab_rv, UP)
        sub_i = note(xi[0][1], "i：第几个", direction=DOWN, color=GOLD, size=22, buff=0.6)
        with self.say("p20") as d:
            self.play(TransformFromCopy(Xi, xi[0]), run_time=1.0)
            self.play(Write(xi[1]), FadeIn(lab_obs), run_time=0.9)
            self.play(FadeIn(sub_i), run_time=0.6)
        Xb = VGroup(tex(r"\bar X", size=60, color=BLUE), zh("随样本而变", 22, SOFT)).arrange(RIGHT, buff=0.3) \
            .move_to(LEFT * 3.4 + DOWN * 2.2)
        xb = VGroup(tex(r"\bar x=170.3", size=60, color=ORANGE), zh("这一次的数", 22, SOFT)).arrange(RIGHT, buff=0.3) \
            .move_to(RIGHT * 3.4 + DOWN * 2.2)
        with self.say("p21") as d:
            self.play(FadeOut(sub_i), FadeIn(Xb, shift=UP * 0.1), run_time=0.8)
            self.wait(d * 0.3)
            self.play(FadeIn(xb, shift=UP * 0.1), run_time=0.8)
        est1 = VGroup(zh("估计量", 30, BLUE), zh("estimator", 20, SOFT),
                      tex(r"\bar X=\frac{1}{n}\sum_{i=1}^n X_i", size=44, color=BLUE)).arrange(DOWN, buff=0.18)
        est2 = VGroup(zh("估计值", 30, ORANGE), zh("estimate", 20, SOFT),
                      tex(r"\bar x=170.3", size=44, color=ORANGE)).arrange(DOWN, buff=0.18)
        est1.move_to(LEFT * 3.4 + DOWN * 0.4)
        est2.move_to(RIGHT * 3.4 + DOWN * 0.4).align_to(est1, UP)
        with self.say("p22") as d:
            self.play(FadeOut(VGroup(Xi, ax, bell, lab_rv, xi, lab_obs)), Xb.animate.set_opacity(0.0),
                      xb.animate.set_opacity(0.0), run_time=0.6)
            self.remove(Xb, xb)
            self.play(FadeIn(est1, shift=UP * 0.1), run_time=0.8)
            self.wait(d * 0.25)
            self.play(FadeIn(est2, shift=UP * 0.1), run_time=0.8)

        # ------------------------------------------------ 推断与抽样方式
        region2, dots2 = field(LEFT * 3.4 + UP * 0.2, w=4.6, h=3.4, n=220, seed=3)
        circ2 = Circle(radius=1.2, color=ORANGE, stroke_width=2, fill_color=ORANGE, fill_opacity=0.06) \
            .move_to(RIGHT * 3.4 + UP * 0.2)
        sdots = VGroup(*[Dot(circ2.get_center() + 0.95 * np.array([math.cos(a) * r, math.sin(a) * r, 0]), radius=0.04,
                             color=ORANGE) for a, r in zip(np.linspace(0, 12, 18), np.linspace(0.15, 1, 18))])
        arr1 = CurvedArrow(region2.get_top() + RIGHT * 0.8, circ2.get_top() + LEFT * 0.3, angle=-0.6, color=SOFT)
        arr2 = CurvedArrow(circ2.get_bottom() + LEFT * 0.3, region2.get_bottom() + RIGHT * 0.8, angle=-0.6, color=GOLD,
                           stroke_width=5)
        l1 = zh("抽样", 26, SOFT).next_to(arr1, UP, buff=0.1)
        l2 = VGroup(zh("统计推断", 30, GOLD), zh("估计 · 检验", 22, SOFT)).arrange(DOWN, buff=0.1).next_to(arr2, DOWN,
                                                                                                   buff=0.1)
        with self.say("p23") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(region2), FadeIn(dots2), Create(circ2), FadeIn(sdots), run_time=1.0)
            self.play(Create(arr1), FadeIn(l1), run_time=0.8)
            self.play(Create(arr2), FadeIn(l2, shift=UP * 0.1), run_time=1.0)

        def mini(kind):
            box = RoundedRectangle(width=3.6, height=2.6, corner_radius=0.2, stroke_color=LINE, stroke_width=1.5,
                                   fill_color=PAPER, fill_opacity=1)
            r = np.random.default_rng(11)
            pts = [np.array([x, y, 0]) for x in np.linspace(-1.4, 1.4, 10) for y in np.linspace(-0.95, 0.95, 7)]
            ds = VGroup(*[Dot(p, radius=0.045, color=GRAY) for p in pts])
            deco = VGroup()
            if kind == "srs":
                for i in r.choice(len(ds), 12, replace=False):
                    ds[i].set_color(ORANGE).scale(1.4)
            elif kind == "strat":
                for j, yy in enumerate(np.linspace(-0.95, 0.95, 7)):
                    pass
                for b in range(3):
                    y0 = -1.05 + b * 0.7
                    deco.add(Rectangle(width=3.2, height=0.62, stroke_width=0, fill_color=[BLUE, GOLD, GREEN][b],
                                       fill_opacity=0.12).move_to([0, y0 + 0.35, 0]))
                    idx = [i for i, p in enumerate(pts) if y0 < p[1] < y0 + 0.7]
                    for i in r.choice(idx, 4, replace=False):
                        ds[i].set_color(ORANGE).scale(1.4)
            elif kind == "cluster":
                for cx in range(5):
                    for cy in range(2):
                        deco.add(RoundedRectangle(width=0.56, height=0.88 if cy == 0 else 0.88, corner_radius=0.1,
                                                  stroke_color=LINE, stroke_width=1.2)
                                 .move_to([-1.25 + cx * 0.62, -0.5 + cy * 1.0, 0]))
                for k in (1, 7):
                    deco[k].set_stroke(ORANGE, 2.5)
                    for i, p in enumerate(pts):
                        if np.all(np.abs(p[:2] - deco[k].get_center()[:2]) < [0.29, 0.45]):
                            ds[i].set_color(ORANGE).scale(1.4)
            elif kind == "bias":
                for i, p in enumerate(pts):
                    if p[0] > 0.7 and p[1] > 0.1:
                        ds[i].set_color(RED).scale(1.4)
            g = VGroup(box, deco, ds)
            return g

        names = [("简单随机抽样", "srs"), ("分层抽样", "strat"), ("整群抽样", "cluster")]
        minis = VGroup(*[VGroup(mini(k), zh(n, 26)).arrange(DOWN, buff=0.2) for n, k in names]) \
            .arrange(RIGHT, buff=0.45).move_to(UP * 0.1)
        with self.say("p24") as d:
            self.clear(run_time=0.6)
            self.play(FadeIn(minis[0], shift=UP * 0.1), run_time=0.9)
            self.play(Indicate(minis[0][1], color=GOLD), run_time=0.8)
        bias = VGroup(mini("bias"), zh("选择偏差", 26, RED)).arrange(DOWN, buff=0.2)
        with self.say("p25") as d:
            self.play(LaggedStart(FadeIn(minis[1], shift=UP * 0.1), FadeIn(minis[2], shift=UP * 0.1), lag_ratio=0.5),
                      run_time=1.4)
            self.wait(d * 0.3)
            self.play(minis.animate.scale(0.8).to_edge(LEFT, buff=0.5), run_time=0.7)
            bias.scale(0.8).next_to(minis, RIGHT, buff=0.6)
            self.play(FadeIn(bias, shift=LEFT * 0.2), run_time=0.8)
        self.wait(0.6)
        self.clear(run_time=0.7)
