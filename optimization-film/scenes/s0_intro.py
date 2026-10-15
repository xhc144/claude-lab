"""第 0 段：开场。万物皆可优化；三个零件；局部与全局。"""
import numpy as np

from common import *  # noqa: F401,F403


def landscape(x):
    """一片有浅谷也有深谷的山地：左边的浅谷是陷阱，右边的深谷才是全局最低。"""
    return (2.2 - 1.05 * np.exp(-(x + 2.7) ** 2 / 0.9) - 2.0 * np.exp(-(x - 3.1) ** 2 / 1.1)
            - 0.55 * np.exp(-(x - 0.2) ** 2 / 0.35) + 0.018 * x ** 2 + 0.12 * np.sin(1.7 * x))


class S0(VScene):
    def construct(self):
        self.opening()
        self.vignettes()
        self.three_parts()
        self.flip()
        self.local_global()
        self.roadmap()

    def opening(self):
        t = T("最优化的本质", 84, INK, font=SERIF, weight=BOLD)
        s = T("极值 · 凸性 · 梯度下降 · 线性规划", 32, DIM).next_to(t, DOWN, buff=0.5)
        dots = VGroup(*[Dot(radius=0.035, color=YELLOW).move_to([np.cos(a) * 3.6, np.sin(a) * 1.6 + 0.2, 0])
                        for a in np.linspace(0, 2 * np.pi, 48, endpoint=False)])
        self.play(LaggedStart(*[FadeIn(d, scale=0.3) for d in dots], lag_ratio=0.03), run_time=1.6)
        self.play(Write(t), dots.animate.set_opacity(0.25), run_time=1.6)
        self.play(FadeIn(s, shift=UP * 0.2), run_time=0.8)
        self.wait(1.4)
        self.play(FadeOut(VGroup(t, s, dots)), run_time=0.8)

    def vignettes(self):
        # (a) 道路网络里的最快路线
        rng = np.random.default_rng(3)
        pts = [np.array([i * 1.0 - 1.5 + rng.uniform(-.18, .18), j * 0.9 - 0.9 + rng.uniform(-.15, .15), 0])
               for j in range(3) for i in range(4)]
        edges = [(a, b) for a in range(12) for b in range(a + 1, 12)
                 if np.linalg.norm(pts[a] - pts[b]) < 1.45]
        net = VGroup(*[Line(pts[a], pts[b], stroke_width=2, color=FAINT) for a, b in edges])
        nodes = VGroup(*[Dot(p, radius=0.06, color=DIM) for p in pts])
        route = [0, 5, 6, 11]
        path = VMobject(stroke_color=YELLOW, stroke_width=6).set_points_as_corners([pts[i] for i in route])
        road = VGroup(net, nodes, path)
        cap_a = T("最快路线", 26, DIM)

        # (b) 骑手与订单的匹配
        riders = [np.array([-1.2, y, 0]) for y in (0.9, 0, -0.9)]
        orders = [np.array([1.2, y, 0]) for y in (1.1, 0.35, -0.35, -1.1)]
        rd = VGroup(*[Dot(p, radius=0.11, color=TEAL) for p in riders])
        od = VGroup(*[Square(0.2, color=ORANGE, fill_opacity=1, stroke_width=0).move_to(p) for p in orders])
        match = VGroup(*[Line(riders[a], orders[b], stroke_width=3, color=YELLOW)
                         for a, b in [(0, 0), (1, 2), (2, 3), (0, 1)]])
        disp = VGroup(rd, od, match)
        cap_b = T("派单", 26, DIM)

        # (c) 训练时下降的损失曲线
        ax = Axes(x_range=[0, 10, 10], y_range=[0, 1.2, 1.2], x_length=3.2, y_length=2.2,
                  axis_config={"color": FAINT, "include_ticks": False, "include_tip": False})
        xs = np.linspace(0, 10, 200)
        noise = np.random.default_rng(5).normal(0, 0.025, xs.size)
        ys = 0.08 + 0.95 * np.exp(-0.45 * xs) + noise * np.exp(-0.15 * xs)
        loss = VMobject(stroke_color=BLUE, stroke_width=4).set_points_smoothly(
            [ax.c2p(a, b) for a, b in zip(xs[::4], ys[::4])])
        train = VGroup(ax, loss)
        cap_c = T("训练模型", 26, DIM)

        cols = VGroup(VGroup(road, cap_a), VGroup(disp, cap_b), VGroup(train, cap_c))
        for g in cols:
            g[1].next_to(g[0], DOWN, buff=0.45)
        cols.arrange(RIGHT, buff=1.4).move_to(UP * 0.3)

        with self.say("s0_01", tail=0.2) as d:
            self.play(FadeIn(net), FadeIn(nodes), FadeIn(cap_a), run_time=1.0)
            self.play(Create(path), run_time=1.8)
            self.play(FadeIn(rd), FadeIn(od), FadeIn(cap_b), run_time=1.0)
            self.play(LaggedStart(*[Create(m) for m in match], lag_ratio=0.4), run_time=2.2)
            self.wait(0.6)
            self.play(Create(ax), FadeIn(cap_c), run_time=1.0)
            self.play(Create(loss), run_time=d - 8.0, rate_func=linear)

        core = T("在所有允许的选择里，找出最好的那一个", 44, INK, weight=BOLD)
        core[10:].set_color(YELLOW)
        with self.say("s0_02") as d:
            target = dimmed(cols, 0.45).scale(0.7).to_edge(UP, buff=0.6)
            self.play(Transform(cols, target), run_time=1.6)
            self.wait(d * 0.35)
            self.play(Write(core), run_time=2.2)
        self.play(FadeOut(cols), core.animate.scale(0.7).to_edge(UP, buff=0.7), run_time=0.9)
        self.core = core

    def three_parts(self):
        f = M(r"\min_{x}", r"\quad f(x)", r"\qquad \text{s.t.} \qquad", r"x \in C", size=90)
        f[0].set_color(YELLOW)
        f[1].set_color(BLUE)
        f[3].set_color(TEAL)
        f.move_to(UP * 0.2)
        labels = [("决策变量", "你能控制的选择", YELLOW, f[0]),
                  ("目标函数", "想让它尽可能小", BLUE, f[1]),
                  ("约束条件", "选择必须满足的限制", TEAL, f[3])]
        groups = []
        for name, desc, col, part in labels:
            br = Brace(part, DOWN, color=col, buff=0.2)
            g = VGroup(T(name, 32, col, weight=BOLD), T(desc, 24, DIM)).arrange(DOWN, buff=0.15)
            g.next_to(br, DOWN, buff=0.2)
            groups.append(VGroup(br, g))
        low = min(gr[0].get_bottom()[1] for gr in groups)
        for i, gr in enumerate(groups):
            gr[1].move_to([gr[1].get_center()[0], low - 0.2 - gr[1].height / 2 - (0.95 if i == 1 else 0), 0])
        with self.say("s0_03") as d:
            self.play(Write(f), run_time=1.6)
            self.wait(0.6)
            self.play(FadeIn(groups[0], shift=UP * 0.2), Indicate(f[0], color=YELLOW), run_time=1.2)
            self.wait(d * 0.18)
            self.play(FadeIn(groups[1], shift=UP * 0.2), Indicate(f[1], color=BLUE), run_time=1.2)
            self.wait(d * 0.2)
            self.play(FadeIn(groups[2], shift=UP * 0.2), Indicate(f[3], color=TEAL), run_time=1.2)
        self.play(FadeOut(VGroup(f, *groups, self.core)), run_time=0.8)

    def flip(self):
        ax = Axes(x_range=[-3, 3, 1], y_range=[-2.2, 2.2, 1], x_length=7, y_length=4.2,
                  axis_config={"color": FAINT, "include_ticks": False}).shift(DOWN * 0.3)
        g = ax.plot(lambda x: 1.6 * np.exp(-x ** 2 / 1.4) - 0.2, color=ORANGE, stroke_width=5)
        top = Dot(ax.c2p(0, 1.4), color=YELLOW, radius=0.09)
        cap = T("最大化", 30, ORANGE).move_to(ax.c2p(-2.3, 1.9))
        eq = M(r"\max f(x) \;=\; -\min\big(-f(x)\big)", size=52).to_edge(UP, buff=0.6)
        with self.say("s0_04") as d:
            self.play(Create(ax), Create(g), FadeIn(top), FadeIn(cap), run_time=1.6)
            self.wait(d * 0.2)
            flipped = ax.plot(lambda x: -(1.6 * np.exp(-x ** 2 / 1.4) - 0.2), color=BLUE, stroke_width=5)
            cap2 = T("最小化", 30, BLUE).move_to(cap)
            self.play(Transform(g, flipped), top.animate.move_to(ax.c2p(0, -1.4)),
                      Transform(cap, cap2), run_time=2.0)
            self.play(Write(eq), run_time=1.4)
        self.play(FadeOut(VGroup(ax, g, top, cap, eq)), run_time=0.7)

    def local_global(self):
        ax = Axes(x_range=[-6, 6, 1], y_range=[0, 3, 1], x_length=13, y_length=4.6,
                  axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).shift(DOWN * 0.45)
        curve = ax.plot(landscape, x_range=[-6, 6, 0.02], color=BLUE, stroke_width=5)
        fill = ax.get_area(curve, x_range=[-6, 6], color=BLUE, opacity=0.08)
        xs = np.linspace(-6, 6, 4001)
        ys = landscape(xs)
        loc = xs[np.argmin(np.where(xs < 0, ys, 9))]
        glo = xs[np.argmin(ys)]

        # 雾：只留下小球附近的一扇窗（一张横向渐变的图片）
        cx = ax.c2p(loc, 0)[0]
        fog = fog_image(config.frame_width + 0.4, config.frame_height + 0.4,
                        lambda X, Y: smoothstep(1.2, 3.6, np.abs(X - cx)))
        ball = Dot(ax.c2p(loc - 1.25, landscape(loc - 1.25)), radius=0.14, color=YELLOW).set_z_index(5)
        track = ax.plot(landscape, x_range=[loc - 1.25, loc, 0.01])
        up_l = Arrow(ax.c2p(loc - 0.15, landscape(loc) + 0.35), ax.c2p(loc - 0.75, landscape(loc - 0.75) + 0.45),
                     color=DIM, stroke_width=4, buff=0, max_tip_length_to_length_ratio=0.25)
        up_r = Arrow(ax.c2p(loc + 0.15, landscape(loc) + 0.35), ax.c2p(loc + 0.75, landscape(loc + 0.75) + 0.45),
                     color=DIM, stroke_width=4, buff=0, max_tip_length_to_length_ratio=0.25)
        q = T("这是最低点吗？", 34, INK).move_to(ax.c2p(loc, 2.7))

        with self.say("s0_05") as d:
            self.add(curve, fill, fog, ball)
            self.play(FadeIn(curve), FadeIn(fill), FadeIn(ball), run_time=1.2)
            self.play(MoveAlongPath(ball, track), run_time=2.4, rate_func=rate_functions.ease_out_cubic)
            self.play(GrowArrow(up_l), GrowArrow(up_r), run_time=1.0)
            self.wait(max(d - 6.5, 0.2))
            self.play(Write(q), run_time=1.0)

        star = Star(n=5, outer_radius=0.22, inner_radius=0.09, color=YELLOW, fill_opacity=1).move_to(
            ax.c2p(glo, landscape(glo) - 0.0) + UP * 0.05)
        l1 = T("局部最优", 30, ORANGE).next_to(ax.c2p(loc, landscape(loc)), DOWN, buff=0.35)
        l2 = T("全局最优", 30, YELLOW, weight=BOLD).next_to(ax.c2p(glo, landscape(glo)), DOWN, buff=0.35)
        with self.say("s0_06") as d:
            self.play(FadeOut(q), FadeOut(up_l), FadeOut(up_r), run_time=0.6)
            self.play(FadeOut(fog, run_time=3.0, rate_func=rate_functions.ease_in_out_sine))
            self.play(GrowFromCenter(star), run_time=0.8)
            self.wait(d * 0.15)
            self.play(FadeIn(l1, shift=UP * 0.2), ball.animate.set_color(ORANGE), run_time=0.9)
            self.play(FadeIn(l2, shift=UP * 0.2), run_time=0.9)
        self.landscape_group = VGroup(ax, curve, fill, ball, star, l1, l2)

    def roadmap(self):
        msg = VGroup(T("只能看见局部", 40, ORANGE, weight=BOLD), M(r"\Longrightarrow", size=60, color=DIM),
                     T("想知道全局", 40, YELLOW, weight=BOLD)).arrange(RIGHT, buff=0.5).to_edge(UP, buff=0.8)
        names = [("一", "极值与不等式"), ("二", "凸优化"), ("三", "梯度下降"), ("四", "线性规划")]
        cards = VGroup()
        for i, (n, s) in enumerate(names):
            box = RoundedRectangle(corner_radius=0.2, width=2.9, height=1.6, stroke_color=[BLUE, TEAL, YELLOW, ORANGE][i],
                                   stroke_width=2.5, fill_color=BG, fill_opacity=1)
            txt = VGroup(T(n, 26, DIM, font=SERIF), T(s, 30, INK, weight=BOLD)).arrange(DOWN, buff=0.15).move_to(box)
            cards.add(VGroup(box, txt))
        cards.arrange(RIGHT, buff=0.35).move_to(DOWN * 0.6)
        with self.say("s0_07", tail=1.0) as d:
            self.play(FadeOut(self.landscape_group), run_time=1.0)
            self.play(FadeIn(msg[0], shift=RIGHT * 0.2), run_time=0.8)
            self.play(GrowFromCenter(msg[1]), FadeIn(msg[2], shift=LEFT * 0.2), run_time=1.0)
            self.wait(d * 0.3)
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.3) for c in cards], lag_ratio=0.35), run_time=2.6)
        self.clear_all(0.9)
