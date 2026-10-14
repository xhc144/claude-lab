"""07 同一个人，考两次（配对 t 检验）"""
from common import *
from data import AFTER, BEFORE, DIFF


class Paired(VScene):
    header = "配对数据 · 差值的 t 检验"

    def construct(self):
        ghost = self.add_ghost()

        recap = VGroup(
            VGroup(tex(r"Z=1.48<1.96", size=44, color=SOFT), zh("方差已知", 26, SOFT)).arrange(RIGHT, buff=0.4),
            VGroup(tex(r"T=1.44<1.99", size=44, color=SOFT), zh("方差未知", 26, SOFT)).arrange(RIGHT, buff=0.4),
        ).arrange(DOWN, buff=0.4, aligned_edge=LEFT).move_to(UP * 0.4)
        with self.say("g01") as d:
            self.play(FadeIn(recap, lag_ratio=0.3), run_time=1.2)
        self.line("g02")

        sr = ScoreRows(axis_y=-2.3, row_y=(0.75, -1.15), r=0.1, gap=0.24)
        lab_b = zh("前测", 28, ORANGE).move_to([-6.3, sr.row_y[0] + 0.05, 0])
        lab_a = zh("后测", 28, BLUE).move_to([-6.3, sr.row_y[1] + 0.05, 0])
        pb = sr.positions(BEFORE, 0)
        pa = sr.positions(AFTER, 1)
        db = VGroup(*[Dot(p, radius=0.1, color=ORANGE) for p in pb])
        da = VGroup(*[Dot(p, radius=0.1, color=BLUE) for p in pa])
        with self.say("g03") as d:
            self.play(FadeOut(recap), run_time=0.5)
            self.play(Create(sr.axis), FadeIn(sr.nums), run_time=0.8)
            tgt = [x.get_center().copy() for x in db]
            for x in db:
                x.shift(UP * 4)
            self.play(FadeIn(lab_b), LaggedStart(*[x.animate(rate_func=rate_functions.ease_out_cubic).move_to(p)
                                                   for x, p in zip(db, tgt)], lag_ratio=0.12), run_time=d * 0.35)
            tgt = [x.get_center().copy() for x in da]
            for x in da:
                x.shift(UP * 4)
            self.play(FadeIn(lab_a), LaggedStart(*[x.animate(rate_func=rate_functions.ease_out_cubic).move_to(p)
                                                   for x, p in zip(da, tgt)], lag_ratio=0.12), run_time=d * 0.35)
        mb, ma = BEFORE.mean(), AFTER.mean()
        lb = sr.mean_line(mb, 0, ORANGE, h=0.9)
        la = sr.mean_line(ma, 1, BLUE, h=0.9)
        br = gap_bracket(sr.x(mb), sr.x(ma), 1.75, label="2.9", size=44)
        vb = tex("75.9", size=34, color=ORANGE).next_to(lb, LEFT, buff=0.1).shift(UP * 0.3)
        va = tex("78.8", size=34, color=BLUE).next_to(la, RIGHT, buff=0.1).shift(UP * 0.3)
        with self.say("g04") as d:
            self.play(FadeIn(lb), FadeIn(la), FadeIn(vb), FadeIn(va), run_time=0.7)
            self.play(GrowFromCenter(br), run_time=0.7)
        ind = VGroup(zh("当成两个独立的班：", 26, SOFT), tex(r"t=0.56", size=40, color=SOFT)).arrange(RIGHT, buff=0.2)
        ind.to_edge(RIGHT, buff=0.6).shift(UP * 2.55)
        with self.say("g05") as d:
            self.wait(d * 0.45)
            self.play(FadeIn(ind), run_time=0.7)
        self.play(FadeOut(ind), run_time=0.4)
        q = self.pause_q("这 20 个分数，其实是 10 个人考的。我们漏掉了什么？", pos=UP * 2.75, mark_pos=[6.45, -0.2, 0])

        links = VGroup(*[Line(a.get_center(), b.get_center(), color=INK, stroke_width=2.2)
                         for a, b in zip(db, da)])
        with self.say("g06") as d:
            self.play(FadeOut(q), run_time=0.4)
            self.play(LaggedStart(*[Create(l) for l in links], lag_ratio=0.15), run_time=1.6)

        # 平移到同一起点：一簇箭头
        dax = NumberLine(x_range=[-2, 8, 1], length=7.0, color=LINE, include_tip=False, stroke_width=2)
        dax.move_to(DOWN * 2.0 + RIGHT * 1.2)
        dnums = VGroup(*[tex(str(v), size=28, color=SOFT).next_to(dax.n2p(v), DOWN, buff=0.14) for v in (-2, 0, 2, 4, 6, 8)])
        dlab = zh("后 − 前", 28, GOLD).next_to(dax, LEFT, buff=0.5)
        order = np.argsort(DIFF, kind="stable")
        arrows = VGroup()
        for k, i in enumerate(order):
            y = -1.55 + k * 0.33
            arrows.add(Arrow(dax.n2p(0) + UP * (y - dax.n2p(0)[1]), dax.n2p(DIFF[i]) + UP * (y - dax.n2p(0)[1]),
                             buff=0, color=GOLD, stroke_width=4, tip_length=0.16, max_tip_length_to_length_ratio=0.45))
        zero = DashedLine(dax.n2p(0) + DOWN * 0.1, dax.n2p(0) + UP * 3.6, color=SOFT, stroke_width=1.5)
        with self.say("g07") as d:
            spread = VGroup(sr.axis, sr.nums, db, da, lb, la, vb, va, br, lab_a, lab_b)
            self.play(FadeOut(spread), *[ReplacementTransform(links[i], arrows[k]) for k, i in enumerate(order)],
                      run_time=1.8)
            self.play(Create(dax), FadeIn(dnums), FadeIn(dlab), Create(zero), run_time=0.8)
        self.line("g08")
        self.line("g09")

        # 协方差回来了
        f = tex(r"\operatorname{Var}(X-Y)", "=", r"\operatorname{Var}(X)", "+", r"\operatorname{Var}(Y)",
                r"-2\operatorname{Cov}(X,Y)", size=52).move_to(UP * 1.6)
        f[0].set_color(GOLD); f[2].set_color(ORANGE); f[4].set_color(BLUE)
        nums = tex("4.1", "=", "133.9", "+", "131.5", r"-261.3", size=50).move_to(DOWN * 0.1)
        for i in range(6):
            nums[i].set_x(f[i].get_x())
        nums[0].set_color(GOLD)
        with self.say("g10") as d:
            self.play(FadeOut(VGroup(arrows, dax, dnums, dlab, zero)), run_time=0.6)
            self.play(Write(f[0:5]), run_time=1.2)
            self.play(ReplacementTransform(ghost, f[5]), run_time=1.4)
            self.play(Indicate(f[5], color=RED, scale_factor=1.1), run_time=0.9)
        with self.say("g11") as d:
            self.play(FadeIn(nums[2:5], shift=UP * 0.1), run_time=0.8)
        with self.say("g12") as d:
            self.play(FadeIn(nums[5], shift=UP * 0.1), run_time=0.6)
            self.play(FadeIn(nums[0:2]), run_time=0.6)
            self.play(Indicate(nums[0], color=GOLD, scale_factor=1.3), run_time=0.8)

        dl = tex(r"d_i:\ 3,\ 5,\ 2,\ 4,\ 1,\ 6,\ 2,\ 3,\ -1,\ 4", size=46, color=GOLD).move_to(UP * 2.15)
        st = tex(r"\bar d=2.9,\qquad S_d\approx 2.02", size=44).next_to(dl, DOWN, buff=0.35)
        with self.say("g13") as d:
            self.play(FadeOut(VGroup(f, nums)), run_time=0.6)
            self.play(Write(dl), run_time=1.6)
            self.play(FadeIn(st), run_time=0.7)
        T = tex(r"T=\frac{\bar d}{S_d/\sqrt{n}}=\frac{2.9}{2.02/\sqrt{10}}\approx 4.53\ \sim\ t(9)", size=46)
        T.next_to(st, DOWN, buff=0.35)
        with self.say("g14") as d:
            self.wait(d * 0.4)
            self.play(Write(T), run_time=1.6)

        with self.say("g15") as d:
            self.play(VGroup(dl, st, T).animate.scale(0.8).to_edge(UP, buff=1.0), run_time=0.7)
            plot, mk = t_test_plot(9, 4.53, 2.26, x0=-5.5, x1=5.5, width=10, center=DOWN * 1.2, label=r"t(9)")
            self.play(FadeIn(plot), run_time=0.7)
            mk.shift(UP * 2)
            self.add(mk)
            self.play(mk.animate.shift(DOWN * 2), run_time=0.7, rate_func=rate_functions.ease_in_quad)
            self.play(Flash(mk, color=GOLD, line_length=0.2, num_lines=12), run_time=0.6)

        # 噪声对比
        bars = VGroup()
        for i, (name, v, c) in enumerate((("独立算法的标准误", 5.15, GRAY), ("配对算法的标准误", 0.64, GOLD))):
            r = Rectangle(width=v * 1.3, height=0.32, stroke_width=0, fill_color=c, fill_opacity=0.7)
            lab = zh(name, 26, SOFT)
            val = tex(f"{v:.2f}", size=36, color=c if c == GOLD else SOFT)
            row = VGroup(lab, r, val).arrange(RIGHT, buff=0.3)
            bars.add(row)
        bars.arrange(DOWN, buff=0.35, aligned_edge=LEFT).move_to(DOWN * 1.2)
        for row in bars:
            row[1].align_to(bars[0][1], LEFT)
            row[2].next_to(row[1], RIGHT, buff=0.3)
        dfs = VGroup(zh("自由度", 26, SOFT), tex(r"18\ \to\ 9", size=40)).arrange(RIGHT, buff=0.3)
        dfs.next_to(bars, UP, buff=0.4).align_to(bars, LEFT)
        with self.say("g16") as d:
            self.play(FadeOut(VGroup(plot, mk)), run_time=0.5)
            self.play(FadeIn(dfs), run_time=0.6)
            self.play(GrowFromEdge(bars[0][1], LEFT), FadeIn(bars[0][0]), FadeIn(bars[0][2]), run_time=0.8)
            self.play(GrowFromEdge(bars[1][1], LEFT), FadeIn(bars[1][0]), FadeIn(bars[1][2]), run_time=0.8)
        self.line("g17")

        warn = VGroup(
            zh("两组人本来不是一一对应的，不能硬配。", 32, INK),
            zh("配不配对，是设计实验时定的，不是算的时候挑的。", 32, INK),
        ).arrange(DOWN, buff=0.4).move_to(DOWN * 0.3)
        with self.say("g18") as d:
            self.play(FadeOut(VGroup(dl, st, T, bars, dfs)), run_time=0.6)
            self.play(FadeIn(warn[0]), run_time=0.7)
        with self.say("g19") as d:
            self.play(FadeIn(warn[1]), run_time=0.7)
        aside = zh("严格的实验还要有对照组，排除“第二次本来就会考得好一点”。这里只讲计算。", 24, SOFT)
        aside.next_to(warn, DOWN, buff=0.7)
        with self.say("g20") as d:
            self.play(FadeIn(aside), run_time=0.7)
        self.line("g21", gap=0.8)
        self.play(FadeOut(VGroup(warn, aside)), run_time=1.0)
        self.wait(0.4)
