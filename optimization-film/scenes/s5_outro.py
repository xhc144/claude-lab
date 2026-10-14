"""尾声：三条主线，三句话。"""
import numpy as np

from common import *  # noqa: F401,F403


class S5(VScene):
    def construct(self):
        names = [("一", "极值与不等式", BLUE), ("二", "凸优化", TEAL), ("三", "梯度下降", YELLOW), ("四", "线性规划", ORANGE)]
        cards = VGroup()
        for n, s, c in names:
            box = RoundedRectangle(corner_radius=0.2, width=2.9, height=1.5, stroke_color=c, stroke_width=2.5,
                                   fill_color=BG, fill_opacity=1)
            cards.add(VGroup(box, VGroup(T(n, 24, DIM, font=SERIF), T(s, 30, INK, weight=BOLD)).arrange(DOWN, buff=0.12).move_to(box)))
        cards.arrange(RIGHT, buff=0.35)
        with self.say("s5_01", tail=0.5):
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.3) for c in cards], lag_ratio=0.2), run_time=1.6)
            self.play(cards.animate.scale(0.55).to_edge(UP, buff=0.35), run_time=1.2)

        cols = []
        # 主线一：局部与全局 —— 碗与切线地板
        ax1 = Axes(x_range=[-2, 2], y_range=[0, 2.4], x_length=3.4, y_length=2.2,
                   axis_config={"color": FAINT, "include_ticks": False, "include_tip": False})
        bowl = ax1.plot(lambda x: 0.4 * x * x + 0.35, x_range=[-2, 2, 0.01], color=TEAL, stroke_width=4)
        floor = Line(ax1.c2p(-2, 0.35), ax1.c2p(2, 0.35), color=YELLOW, stroke_width=3)
        tanl = ax1.plot(lambda x: 0.4 * 1.96 + 0.35 + 0.8 * 1.4 * (x - 1.4), x_range=[0.55, 2, 0.01], color=ORANGE, stroke_width=2.5)
        art1 = VGroup(ax1, bowl, tanl, floor, Dot(ax1.c2p(0, 0.35), color=YELLOW, radius=0.07))
        cols.append((art1, "局部与全局", "凸性：连接局部与全局", TEAL))
        # 主线二：上界与下界 —— 两列点夹住最优值
        ups = [2.0, 1.45, 1.1, 0.9, 0.8, 0.76]
        lows = [-0.6, 0.15, 0.48, 0.64, 0.72, 0.75]
        xs = np.linspace(-1.5, 1.5, 6)
        art2 = VGroup(DashedLine([-1.8, 0.75, 0], [1.8, 0.75, 0], color=YELLOW, stroke_width=2),
                      *[Dot([x, y, 0], radius=0.06, color=ORANGE) for x, y in zip(xs, ups)],
                      *[Dot([x, y, 0], radius=0.06, color=TEAL) for x, y in zip(xs, lows)]).scale(0.95)
        cols.append((art2, "上界与下界", "不等式与对偶：找那块地板", YELLOW))
        # 主线三：约束都有价格
        lam = M(r"\lambda", size=110, color=YELLOW)
        tags = VGroup(T("拉格朗日乘子", 22, DIM), T("墙的推力", 22, DIM), T("影子价格", 22, DIM))
        for tg, ang in zip(tags, (150, 30, 270)):
            tg.move_to(lam.get_center() + np.array([1.55 * np.cos(np.deg2rad(ang)), 1.0 * np.sin(np.deg2rad(ang)), 0]))
        art3 = VGroup(lam, tags)
        cols.append((art3, "约束都有价格", "价格告诉你约束有多紧", ORANGE))

        groups = VGroup()
        for art, title, sub, c in cols:
            art.set_height(min(art.height, 2.3))
            t = T(title, 36, c, weight=BOLD)
            s = T(sub, 26, INK)
            groups.add(VGroup(art, t, s).arrange(DOWN, buff=0.3))
        groups.arrange(RIGHT, buff=0.7, aligned_edge=UP).shift(DOWN * 0.4)
        if groups.width > 13.4:
            groups.scale_to_fit_width(13.4)
        for g, sid in zip(groups, ("s5_02", "s5_03", "s5_04")):
            with self.say(sid) as d:
                self.play(FadeIn(g[1], shift=UP * 0.2), run_time=0.8)
                self.play(FadeIn(g[0]), run_time=1.4)
                self.wait(d * 0.2)
                self.play(FadeIn(g[2], shift=UP * 0.15), run_time=0.9)
        qs = VGroup(*[VGroup(T(q, 40, c, weight=BOLD), T(a, 26, DIM)).arrange(DOWN, buff=0.15)
                      for q, a, c in [("我能控制什么？", "决策变量", YELLOW), ("我想要什么？", "目标函数", BLUE),
                                      ("我被什么限制？", "约束条件", TEAL)]]).arrange(RIGHT, buff=0.9).shift(UP * 0.8)
        f = M(r"\min_{x}", r"\; f(x)", r"\quad \text{s.t.} \quad", r"x \in C", size=72).next_to(qs, DOWN, buff=0.8)
        f[0].set_color(YELLOW)
        f[1].set_color(BLUE)
        f[3].set_color(TEAL)
        with self.say("s5_05", tail=0.6) as d:
            self.play(FadeOut(groups), FadeOut(cards), run_time=0.8)
            for q in qs:
                self.play(FadeIn(q, shift=UP * 0.2), run_time=0.9)
                self.wait(d * 0.08)
            self.play(Write(f), run_time=1.8)
        self.play(FadeOut(qs), FadeOut(f), run_time=0.8)
        title = T("最优化的本质", 76, INK, font=SERIF, weight=BOLD)
        sub = T("在所有允许的选择里，找出最好的那一个", 30, DIM).next_to(title, DOWN, buff=0.45)
        line = Line(LEFT * 2.6, RIGHT * 2.6, color=YELLOW, stroke_width=1.5).next_to(title, DOWN, buff=0.2)
        cred = T("动画：Manim · 旁白：离线语音合成 · 全部画面与数值由程序生成", 20, FAINT).to_edge(DOWN, buff=0.5)
        self.play(Write(title), run_time=1.6)
        self.play(Create(line), FadeIn(sub, shift=UP * 0.15), run_time=1.0)
        self.play(FadeIn(cred), run_time=0.8)
        self.wait(3.0)
        self.play(FadeOut(VGroup(title, sub, line, cred)), run_time=1.5)
        self.wait(0.5)
