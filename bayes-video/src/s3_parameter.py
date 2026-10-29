from common import *
from data import A0, B0, POST1, SHOTS, beta_pdf, beta_interval

Y_MAX = 6.5


def make_axes():
    return theta_axes(w=10.4, h=4.1, center=DOWN * 0.5, y_max=Y_MAX)


def beta_f(a, b):
    return lambda x: float(beta_pdf(x, a, b))


class Parameter(VScene):
    header = "03 · 把未知的数当成随机的"

    def construct(self):
        # 两种假设 → 一整段取值
        ax2 = Axes(x_range=[0, 1, 1], y_range=[0, 1, 1], x_length=4, y_length=2.6,
                   axis_config={"color": DIM, "stroke_width": 2, "include_tip": False},
                   y_axis_config={"stroke_opacity": 0}).move_to(LEFT * 3.4 + DOWN * 0.3)
        b_s = Rectangle(width=0.8, height=2.6 * POST1, stroke_width=0, fill_color=RED, fill_opacity=0.9)
        b_w = Rectangle(width=0.8, height=2.6 * (1 - POST1), stroke_width=0, fill_color=GREEN, fill_opacity=0.9)
        b_s.move_to(ax2.c2p(0.15, 0), aligned_edge=DOWN)
        b_w.move_to(ax2.c2p(0.85, 0), aligned_edge=DOWN)
        l_s = zh("有病", 24, RED).next_to(b_s, DOWN, buff=0.15)
        l_w = zh("没病", 24, GREEN).next_to(ax2.c2p(0.85, 0), DOWN, buff=0.15)
        two = zh("两种可能", 28, SOFT).next_to(ax2, UP, buff=0.5)
        ax3 = Axes(x_range=[0, 1, 1], y_range=[0, 1, 1], x_length=4, y_length=2.6,
                   axis_config={"color": DIM, "stroke_width": 2, "include_tip": False},
                   y_axis_config={"stroke_opacity": 0}).move_to(RIGHT * 3.4 + DOWN * 0.3)
        cont = neon_density(ax3, lambda x: 0.95 * float(beta_pdf(x, 3, 4)) / 2.2, CYAN)
        lab0 = tex("0", size=28, color=SOFT).next_to(ax3.c2p(0, 0), DOWN, buff=0.15)
        lab1 = tex("1", size=28, color=SOFT).next_to(ax3.c2p(1, 0), DOWN, buff=0.15)
        many = zh("零到一之间的任何数", 28, SOFT).next_to(ax3, UP, buff=0.5)
        arrow = Arrow(LEFT * 0.8, RIGHT * 0.8, color=SOFT, stroke_width=4).move_to(DOWN * 0.3)
        with self.say("p01") as d:
            self.play(Create(ax2), FadeIn(two), run_time=0.6)
            self.play(GrowFromEdge(b_s, DOWN), GrowFromEdge(b_w, DOWN), FadeIn(l_s), FadeIn(l_w), run_time=0.8)
            self.wait(max(0.1, d * 0.35))
            self.play(GrowArrow(arrow), run_time=0.5)
            self.play(Create(ax3), FadeIn(lab0), FadeIn(lab1), FadeIn(many), run_time=0.6)
            self.play(Create(cont), run_time=1.0)

        # 新秀的命中率 θ
        self.clear(run_time=0.6)
        bl = ball(0.42).move_to(LEFT * 4.6 + UP * 1.3)
        what = VGroup(zh("三分球命中率", 34), tex(r"\theta", size=60, color=AMBER)).arrange(RIGHT, buff=0.3)
        what.next_to(bl, RIGHT, buff=0.5)
        nl = NumberLine(x_range=[0, 1, 0.1], length=9, color=DIM, include_numbers=False, tick_size=0.06).move_to(DOWN * 0.6)
        n0 = tex("0", size=30, color=SOFT).next_to(nl.n2p(0), DOWN, buff=0.2)
        n1 = tex("1", size=30, color=SOFT).next_to(nl.n2p(1), DOWN, buff=0.2)
        th = ValueTracker(0.3)
        q = always_redraw(lambda: VGroup(tex("?", size=44, color=AMBER),
                                         Triangle(color=AMBER, fill_opacity=1, stroke_width=0).scale(0.1).rotate(PI))
                          .arrange(DOWN, buff=0.08).next_to(nl.n2p(th.get_value()), UP, buff=0.05))
        with self.say("p02") as d:
            self.play(FadeIn(bl, scale=0.6), run_time=0.6)
            self.play(FadeIn(what, shift=LEFT * 0.2), run_time=0.7)
            self.play(Create(nl), FadeIn(n0), FadeIn(n1), FadeIn(q), run_time=0.8)
            self.play(th.animate.set_value(0.72), run_time=max(0.5, d * 0.25), rate_func=there_and_back_with_pause)

        # 两种看法
        self.clear(run_time=0.6)
        left = panel(5.8, 4.6, color=SOFT).move_to(LEFT * 3.3 + DOWN * 0.35)
        right = panel(5.8, 4.6, color=AMBER).move_to(RIGHT * 3.3 + DOWN * 0.35)
        lt = zh("频率学派", 32, INK).next_to(left.get_top(), DOWN, buff=0.3)
        rt = zh("贝叶斯", 32, AMBER).next_to(right.get_top(), DOWN, buff=0.3)
        axl = NumberLine(x_range=[0, 1, 0.25], length=4.6, color=DIM, tick_size=0.05).move_to(left.get_center() + DOWN * 1.0)
        fixed = DashedLine(axl.n2p(0.4), axl.n2p(0.4) + UP * 2.1, color=INK, stroke_width=3, dash_length=0.1)
        fq = VGroup(tex(r"\theta", size=36), zh("固定，但不知道", 22, SOFT)).arrange(RIGHT, buff=0.15).next_to(fixed, UP, buff=0.1)
        rng = np.random.default_rng(4)
        marks = VGroup()
        for k in range(14):
            pos = axl.n2p(rng.uniform(0.05, 0.95)) + UP * rng.uniform(0.3, 1.6)
            m = (check_mark(GREEN, 0.11) if rng.uniform() < 0.4 else cross_mark(RED, 0.08)).move_to(pos)
            marks.add(m)
        dl = zh("随机的是数据", 22, SOFT).next_to(axl, DOWN, buff=0.25)
        axr = Axes(x_range=[0, 1, 0.25], y_range=[0, 3.2, 1], x_length=4.6, y_length=2.3,
                   axis_config={"color": DIM, "stroke_width": 2, "include_tip": False},
                   y_axis_config={"stroke_opacity": 0}).move_to(right.get_center() + DOWN * 0.15)
        rc = neon_density(axr, lambda x: float(beta_pdf(x, 5, 7)), AMBER)
        rl = zh("对 θ 的不确定，也用概率描述", 22, SOFT).next_to(axr, DOWN, buff=0.25)
        with self.say("p03") as d:
            self.play(FadeIn(left), FadeIn(lt), Create(axl), run_time=0.7)
            self.play(Create(fixed), FadeIn(fq), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(m, scale=0.5) for m in marks], lag_ratio=0.08), FadeIn(dl),
                      run_time=min(2.0, d * 0.4))
        with self.say("p04") as d:
            self.play(FadeIn(right), FadeIn(rt), Create(axr), run_time=0.7)
            self.play(Create(rc), FadeIn(rl), run_time=1.4)

        # 曲线下的面积是概率
        self.clear(run_time=0.6)
        ax, labs = make_axes()
        f0 = beta_f(A0, B0)
        prior = neon_density(ax, f0, CYAN, fill=0.0)
        a, b = 0.3, 0.45
        area = density_fill(ax, f0, a, b, CYAN, opacity=0.4)
        from scipy import stats
        pm = stats.beta.cdf(b, A0, B0) - stats.beta.cdf(a, A0, B0)
        area_lab = VGroup(zh("面积", 26, CYAN), tex("=", size=34), zh("θ 落在这一段的概率", 26, CYAN))
        area_lab.arrange(RIGHT, buff=0.15).next_to(ax.c2p(0.62, 4.3), RIGHT, buff=0.1)
        hi = Arrow(ax.c2p(0.5, 5.4), ax.c2p(0.39, 5.25), color=SOFT, stroke_width=3, buff=0.05)
        hi_l = zh("越高，越相信", 24, SOFT).next_to(hi, RIGHT, buff=0.1)
        with self.say("p05") as d:
            self.play(Create(ax), FadeIn(labs), run_time=0.7)
            self.play(Create(prior), run_time=1.2)
            self.play(FadeIn(area), FadeIn(area_lab), run_time=0.8)
            self.wait(max(0.1, d * 0.2))
            self.play(GrowArrow(hi), FadeIn(hi_l), run_time=0.6)

        # 联盟新秀的命中率
        rng = np.random.default_rng(9)
        rates = rng.beta(A0, B0, 70)
        bins = np.floor(rates / 0.025).astype(int)
        stack = {}
        drops = VGroup()
        for r, k in zip(rates, bins):
            h = stack.get(k, 0)
            stack[k] = h + 1
            p = ax.c2p((k + 0.5) * 0.025, 0) + UP * (0.11 + 0.21 * h)
            drops.add(Dot(p, radius=0.08, color=CYAN).set_opacity(0.85))
        league = zh("联盟里的新秀（每个点是一名球员）", 24, SOFT).next_to(ax.c2p(0.62, 5.6), RIGHT, buff=0.1)
        rng_lab = VGroup(tex("0.25", size=30, color=CYAN), zh("到", 24, SOFT), tex("0.5", size=30, color=CYAN))
        rng_lab.arrange(RIGHT, buff=0.12)
        with self.say("p06") as d:
            self.play(FadeOut(VGroup(area, area_lab, hi, hi_l, prior)), run_time=0.5)
            self.play(LaggedStart(*[FadeIn(dd, shift=DOWN * 2.5) for dd in drops], lag_ratio=0.03),
                      FadeIn(league), run_time=min(3.0, d * 0.5))
            br = BraceBetweenPoints(ax.c2p(0.25, 4.4), ax.c2p(0.5, 4.4), UP, color=CYAN)
            rng_lab.next_to(br, UP, buff=0.08)
            self.play(GrowFromCenter(br), FadeIn(rng_lab), run_time=0.7)

        prior = neon_density(ax, f0, CYAN, fill=0.16)
        mean = marker(ax, A0 / (A0 + B0), f0(A0 / (A0 + B0)), CYAN)
        name = VGroup(neon("先验", 34, CYAN), tex(r"\mathrm{Beta}(15,\,25)", size=36, color=CYAN)).arrange(RIGHT, buff=0.25)
        name.next_to(ax.c2p(0.62, 4.6), RIGHT, buff=0.1)
        ml = tex("0.375", size=30, color=CYAN).next_to(ax.c2p(A0 / (A0 + B0), 0), DOWN, buff=0.55)
        with self.say("p07") as d:
            self.play(drops.animate.set_opacity(0.18), FadeOut(league), FadeOut(br), FadeOut(rng_lab), run_time=0.5)
            self.play(Create(prior), run_time=1.2)
            self.play(FadeIn(name, shift=LEFT * 0.2), Create(mean), FadeIn(ml), run_time=0.8)
        self.play(FadeOut(drops), FadeOut(ml), FadeOut(mean), run_time=0.5)


class Shots(VScene):
    header = "03 · 一球一球地更新"

    def construct(self):
        ax, labs = make_axes()
        f0 = beta_f(A0, B0)
        ghost = neon_density(ax, f0, CYAN, fill=0.16)
        name = VGroup(neon("先验", 34, CYAN), tex(r"\mathrm{Beta}(15,\,25)", size=36, color=CYAN)).arrange(RIGHT, buff=0.25)
        name.next_to(ax.c2p(0.62, 4.6), RIGHT, buff=0.1)
        self.add(ax, labs, ghost, name)
        shadow = neon_density(ax, f0, CYAN, fill=0.05, layers=1).set_stroke(opacity=0.45)

        # 似然：命中 ∝ θ，不中 ∝ 1 − θ
        def mini(f, color, title):
            a = Axes(x_range=[0, 1, 1], y_range=[0, 1, 1], x_length=1.9, y_length=1.1,
                     axis_config={"color": DIM, "stroke_width": 1.5, "include_tip": False},
                     y_axis_config={"stroke_opacity": 0})
            c = glow(a.plot(f, x_range=[0, 1], color=color, stroke_width=3.5), color, layers=2)
            t = title.next_to(a, UP, buff=0.12)
            return VGroup(a, c, t)

        hit = mini(lambda x: x, MAGENTA, VGroup(zh("投中", 24, MAGENTA), tex(r"\propto\theta", size=32, color=MAGENTA)).arrange(RIGHT, buff=0.12))
        miss = mini(lambda x: 1 - x, MAGENTA, VGroup(zh("投丢", 24, MAGENTA), tex(r"\propto 1-\theta", size=32, color=MAGENTA)).arrange(RIGHT, buff=0.12))
        minis = VGroup(hit, miss).arrange(RIGHT, buff=0.7).move_to(LEFT * 3.6 + UP * 2.05)
        with self.say("s01") as d:
            self.play(FadeIn(hit, shift=DOWN * 0.15), run_time=0.8)
            self.wait(max(0.1, d * 0.3))
            self.play(FadeIn(miss, shift=DOWN * 0.15), run_time=0.8)

        rule = tex(r"\text{后验}", r"\;\propto\;", r"\text{先验}", r"\times", r"\text{似然}", size=44)
        rule[0].set_color(AMBER)
        rule[2].set_color(CYAN)
        rule[4].set_color(MAGENTA)
        rule.move_to(RIGHT * 3.4 + UP * 2.2)
        norm = zh("再把总面积调回 1", 22, SOFT).next_to(rule, DOWN, buff=0.15)
        with self.say("s02") as d:
            self.play(Write(rule), run_time=1.2)
            self.play(FadeIn(norm), run_time=0.6)

        # 一球一球地投
        self.play(FadeOut(VGroup(minis, norm)), name.animate.scale(0.75).next_to(ax.c2p(0.03, 3.4), RIGHT, buff=0.0),
                  rule.animate.scale(0.8).move_to(RIGHT * 4.3 + UP * 2.75), run_time=0.6)
        ta, tb = ValueTracker(A0), ValueTracker(B0)
        post = always_redraw(lambda: neon_density(ax, beta_f(ta.get_value(), tb.get_value()), AMBER, fill=0.14))
        self.play(ReplacementTransform(ghost, shadow), run_time=0.3)
        ghost = shadow
        self.add(post)
        slots = VGroup(*[Circle(radius=0.22, stroke_color=DIM, stroke_width=2) for _ in SHOTS]).arrange(RIGHT, buff=0.22)
        slots.move_to(LEFT * 3.2 + UP * 2.2)
        sl = zh("投篮", 24, SOFT).next_to(slots, LEFT, buff=0.3)
        self.play(FadeIn(slots), FadeIn(sl), run_time=0.4)

        def shoot(k, t=0.9):
            made = SHOTS[k]
            mk = (check_mark(GREEN, 0.15) if made else cross_mark(RED, 0.12)).move_to(slots[k])
            b = ball(0.16).move_to(slots[k].get_center() + DOWN * 1.0 + LEFT * 0.4)
            self.play(FadeIn(b, scale=0.5), run_time=0.2)
            self.play(b.animate.move_to(slots[k]), run_time=0.35, rate_func=rate_functions.ease_out_cubic)
            # 似然画在主图上（缩放到和曲线同一高度）
            lf = (lambda x: x) if made else (lambda x: 1 - x)
            ln = DashedLine(ax.c2p(0, lf(0) * Y_MAX * 0.9), ax.c2p(1, lf(1) * Y_MAX * 0.9), color=MAGENTA,
                            stroke_width=2.5, dash_length=0.1)
            self.play(FadeOut(b), FadeIn(mk, scale=1.5), FadeIn(ln), slots[k].animate.set_stroke(GREEN if made else RED),
                      run_time=0.3)
            self.play(ta.animate.increment_value(made), tb.animate.increment_value(1 - made), run_time=t)
            self.play(FadeOut(ln), run_time=0.25)

        with self.say("s03") as d:
            self.wait(0.4)
            shoot(0, t=max(1.0, d * 0.35))
        with self.say("s04") as d:
            shoot(1, t=0.8)
            self.wait(max(0.1, d * 0.2))
            shoot(2, t=1.0)
        with self.say("s05") as d:
            for k in (3, 4, 5):
                shoot(k, t=0.6)
            dm = marker(ax, 5 / 6, 5.2, MAGENTA)
            dml = VGroup(zh("只看六球", 22, MAGENTA), tex("5/6\\approx0.83", size=30, color=MAGENTA)).arrange(DOWN, buff=0.08)
            dml.next_to(dm, UP, buff=0.08)
            self.play(Create(dm), FadeIn(dml), run_time=0.7)

        a1, b1 = A0 + sum(SHOTS), B0 + len(SHOTS) - sum(SHOTS)
        pm = a1 / (a1 + b1)
        pmk = marker(ax, pm, float(beta_pdf(pm, a1, b1)), AMBER)
        pml = VGroup(zh("后验均值", 22, AMBER), tex(f"{pm:.2f}", size=32, color=AMBER)).arrange(DOWN, buff=0.08)
        pml = VGroup(zh("后验均值", 22, AMBER), tex(f"{pm:.2f}", size=32, color=AMBER)).arrange(RIGHT, buff=0.12)
        pml.next_to(ax.c2p(pm, float(beta_pdf(pm, a1, b1))), UR, buff=0.12)
        with self.say("s06") as d:
            self.play(Create(pmk), FadeIn(pml), run_time=0.8)
            self.play(Indicate(pml, color=AMBER), run_time=0.8)

        flat = DashedLine(ax.c2p(0, 1), ax.c2p(1, 1), color=VIOLET, stroke_width=3, dash_length=0.12)
        fl = zh("平的先验", 24, VIOLET).next_to(ax.c2p(0.02, 1), UP, buff=0.12, aligned_edge=LEFT)
        fpost = neon_density(ax, beta_f(1 + sum(SHOTS), 1 + len(SHOTS) - sum(SHOTS)), VIOLET, fill=0.14)
        fpl = VGroup(zh("它的后验", 22, VIOLET), tex(r"\text{均值 }0.75", size=30, color=VIOLET)).arrange(DOWN, buff=0.08)
        fpl.next_to(ax.c2p(0.72, 3.3), LEFT, buff=0.0)
        with self.say("s07") as d:
            self.play(Create(flat), FadeIn(fl), run_time=0.8)
            self.wait(max(0.1, d * 0.3))
            self.play(TransformFromCopy(flat, fpost), FadeIn(fpl), run_time=1.4)
        with self.say("s08") as d:
            self.play(Indicate(ghost, color=CYAN, scale_factor=1.0), run_time=1.0)
            self.play(Circumscribe(pml, color=AMBER), run_time=1.0)
        self.clear(run_time=0.8)
