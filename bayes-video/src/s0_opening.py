from common import *
from data import FPR, POST1, PREV, SENS


def outline_points(mob, n, rng):
    """沿文字轮廓均匀取 n 个点（按每段轮廓的长度分配）。"""
    parts = [sm for sm in mob.family_members_with_points() if sm.get_num_points() > 0]
    lens = np.array([max(1e-3, sm.get_arc_length(sample_points_per_curve=6)) for sm in parts])
    counts = np.maximum(1, np.round(n * lens / lens.sum()).astype(int))
    pts = []
    for sm, k in zip(parts, counts):
        for t in rng.uniform(0, 1, k):
            pts.append(sm.point_from_proportion(t))
    return pts


class Opening(VScene):
    def construct(self):
        # 一百个人，一个有病
        grid = VGroup(*[Dot(radius=0.075, color=DIM) for _ in range(100)]).arrange_in_grid(10, 10, buff=0.2)
        grid.move_to(LEFT * 3.3 + DOWN * 0.2)
        sick = grid[37]
        with self.say("o01") as d:
            self.play(LaggedStart(*[FadeIn(g, scale=0.2) for g in grid], lag_ratio=0.012, run_time=min(2.4, d * 0.5)))
            ring = halo_dot(sick.get_center(), RED, r=0.085)
            lab = neon("1%", 30, RED).next_to(grid, DOWN, buff=0.35)
            self.play(FadeIn(ring, scale=2), sick.animate.set_color(RED), FadeIn(lab), run_time=0.8)

        # 检测的两项指标
        row1 = VGroup(zh("病人", 30, RED), Arrow(LEFT, RIGHT, color=SOFT, stroke_width=3, max_tip_length_to_length_ratio=0.2).scale(0.5),
                      zh("90% 阳性", 30, MAGENTA)).arrange(RIGHT, buff=0.3)
        row2 = VGroup(zh("健康", 30, GREEN), Arrow(LEFT, RIGHT, color=SOFT, stroke_width=3, max_tip_length_to_length_ratio=0.2).scale(0.5),
                      zh("9% 误报阳性", 30, MAGENTA)).arrange(RIGHT, buff=0.3)
        rows = VGroup(row1, row2).arrange(DOWN, buff=0.5, aligned_edge=LEFT)
        card = on_panel(rows, pad=0.45, color=MAGENTA).move_to(RIGHT * 3.3 + UP * 0.6)
        title = zh("一种检测", 24, SOFT).next_to(card, UP, buff=0.2)
        with self.say("o02") as d:
            self.play(FadeIn(card[0], shift=LEFT * 0.3), FadeIn(title), run_time=0.7)
            self.play(FadeIn(row1, shift=RIGHT * 0.2), run_time=0.6)
            self.wait(max(0.1, d * 0.35))
            self.play(FadeIn(row2, shift=RIGHT * 0.2), run_time=0.6)

        # 化验单：阳性
        plus = glow(VGroup(Rectangle(width=0.28, height=1.1), Rectangle(width=1.1, height=0.28))
                    .set_fill(MAGENTA, 1).set_stroke(MAGENTA, 2), MAGENTA, layers=3)
        slip = on_panel(VGroup(zh("检测结果", 24, SOFT), plus, zh("阳性", 34, MAGENTA)).arrange(DOWN, buff=0.3),
                        pad=0.4, color=MAGENTA, min_w=2.6)
        slip.move_to(RIGHT * 3.3 + DOWN * 0.3)
        q = tex(r"P(\text{有病}\mid\text{阳性})", "=", "\\,?", size=50).next_to(slip, DOWN, buff=0.45)
        q[0].set_color(AMBER)
        with self.say("o03") as d:
            self.play(FadeOut(card), FadeOut(title), run_time=0.5)
            self.play(FadeIn(slip, scale=0.85), run_time=0.8)
            self.play(Write(q), run_time=1.0)

        # 直觉 90% 和答案 9%
        bar_w = 4.6
        base = RoundedRectangle(width=bar_w, height=0.36, corner_radius=0.18, stroke_color=DIM, stroke_width=1.5,
                                fill_color=PANEL, fill_opacity=0.8)
        base2 = base.copy()
        meters = VGroup(base, base2).arrange(DOWN, buff=0.95).move_to(RIGHT * 2.6 + DOWN * 0.4)
        lab1 = zh("直觉", 26, SOFT).next_to(base, UP, buff=0.18, aligned_edge=LEFT)
        lab2 = zh("实际", 26, AMBER).next_to(base2, UP, buff=0.18, aligned_edge=LEFT)

        def fill(b, frac, color):
            r = RoundedRectangle(width=max(0.36, bar_w * frac), height=0.36, corner_radius=0.18, stroke_width=0,
                                 fill_color=color, fill_opacity=0.9)
            return r.align_to(b, LEFT).align_to(b, UP)

        f1 = fill(base, 0.9, SOFT)
        f2 = fill(base2, POST1, AMBER)
        n1 = tex("90\\%", size=40, color=SOFT).next_to(base, RIGHT, buff=0.25)
        n2 = tex("\\approx 9\\%", size=44, color=AMBER).next_to(base2, RIGHT, buff=0.25)
        with self.say("o04") as d:
            self.play(FadeOut(slip), q.animate.scale(0.8).move_to(RIGHT * 3.1 + UP * 2.2), run_time=0.7)
            self.play(FadeIn(base), FadeIn(lab1), run_time=0.4)
            self.play(GrowFromEdge(f1, LEFT), FadeIn(n1), run_time=0.9)
            self.wait(max(0.1, d * 0.3))
            self.play(FadeIn(base2), FadeIn(lab2), run_time=0.4)
            self.play(GrowFromEdge(f2, LEFT), FadeIn(n2), run_time=0.9)
            self.play(Indicate(n2, color=AMBER, scale_factor=1.15), run_time=0.8)

        times = neon("相差十倍", 34, AMBER).next_to(meters, DOWN, buff=0.6)
        with self.say("o05") as d:
            self.play(FadeIn(times, shift=UP * 0.2), run_time=0.6)
            self.wait(max(0.1, d - 2.0))
            self.clear(run_time=0.9)

        # ---------------- 标题：光点汇聚
        rng = np.random.default_rng(2)
        title = zh("贝叶斯统计", 120, INK, weight=BOLD).move_to(UP * 0.55)
        sub = zh("让证据改变判断", 34, SOFT).next_to(title, DOWN, buff=0.45)
        targets = outline_points(title, 520, rng)
        cols = [CYAN, MAGENTA, AMBER, VIOLET]
        motes = VGroup()
        for i, p in enumerate(targets):
            a = rng.uniform(0, 2 * np.pi)
            rad = rng.uniform(4.5, 9)
            m = Dot([rad * np.cos(a) * 1.4, rad * np.sin(a) * 0.8, 0], radius=rng.uniform(0.018, 0.04),
                    color=cols[i % 4]).set_opacity(rng.uniform(0.5, 1))
            motes.add(m)
        self.play(FadeIn(motes, lag_ratio=0.002), run_time=0.8)
        moves = [m.animate(rate_func=rate_functions.ease_in_out_cubic).move_to(p) for m, p in zip(motes, targets)]
        self.play(LaggedStart(*moves, lag_ratio=0.0015), run_time=2.4)
        lit = glow(title.copy().set_color(INK), CYAN, layers=4, spread=2.0, strength=0.25)
        self.hit()
        self.play(FadeIn(lit, scale=1.04), motes.animate.set_opacity(0).scale(1.08), run_time=0.7)
        self.remove(motes)
        formula = tex(r"P(H\mid E)", "=", r"{P(E\mid H)\,P(H)", r"\over", r"P(E)}", size=46)
        formula[0].set_color(AMBER)
        formula[2].set_color(MAGENTA)
        formula[4].set_color(VIOLET)
        formula.next_to(sub, DOWN, buff=0.55)
        self.play(FadeIn(sub, shift=UP * 0.15), run_time=0.7)
        self.play(FadeIn(glow(formula, layers=2, spread=1.4, strength=0.12), shift=UP * 0.1), run_time=0.9)
        self.wait(1.8)
        self.play(FadeOut(VGroup(lit, sub, formula)), run_time=0.9)
