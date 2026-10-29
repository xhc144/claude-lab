from common import *
from data import (FALSE_POS, FP_IDX, GRID_COLS, GRID_ROWS, HEALTHY, N_PEOPLE, POS, SICK, SICK_IDX, TP_IDX,
                  TRUE_POS)


class Thousand(VScene):
    header = "01 · 一千个人"

    def construct(self):
        sp = 0.155
        dots = VGroup()
        for i in range(N_PEOPLE):
            r, c = divmod(i, GRID_COLS)
            dots.add(Dot([c * sp, -r * sp, 0], radius=0.046, color=DIM))
        dots.move_to(LEFT * 2.7 + DOWN * 0.35)
        center = dots.get_center()
        order = sorted(range(N_PEOPLE), key=lambda i: np.linalg.norm(dots[i].get_center() - center))
        n_lab = VGroup(tex("1000", size=54, color=INK), zh("人", 30, SOFT)).arrange(RIGHT, buff=0.12, aligned_edge=DOWN)
        n_lab.next_to(dots, UP, buff=0.3)

        with self.say("t01") as d:
            self.play(LaggedStart(*[FadeIn(dots[i], scale=0.3) for i in order], lag_ratio=0.0016,
                                  run_time=min(3.2, d * 0.6)))
            self.play(FadeIn(n_lab, shift=DOWN * 0.15), run_time=0.6)

        # 右侧计数面板
        def counter(label, num, color):
            return VGroup(zh(label, 28, color), tex(str(num), size=48, color=color)).arrange(RIGHT, buff=0.3)

        c_sick = counter("有病", SICK, RED)
        c_well = counter("健康", HEALTHY, GREEN)
        col = VGroup(c_sick, c_well).arrange(DOWN, buff=0.4, aligned_edge=LEFT).move_to(RIGHT * 4.6 + UP * 1.4)
        sick = VGroup(*[dots[i] for i in SICK_IDX])
        well = VGroup(*[dots[i] for i in range(N_PEOPLE) if i not in SICK_IDX])
        halos = VGroup(*[halo_dot(dots[i].get_center(), RED, r=0.05, rings=3, strength=0.3)[0] for i in SICK_IDX])
        with self.say("t02") as d:
            self.play(*[m.animate.set_color(RED).scale(1.3) for m in sick], FadeIn(halos, scale=2.5), FadeIn(c_sick), run_time=1.0)
            self.wait(max(0.1, d * 0.3))
            self.play(well.animate.set_color(GREEN).set_opacity(0.55), FadeIn(c_well), run_time=1.0)

        def ring(i, color=MAGENTA):
            return Circle(radius=0.075, stroke_color=color, stroke_width=2.2).move_to(dots[i])

        tp_rings = VGroup(*[ring(i) for i in TP_IDX])
        fp_rings = VGroup(*[ring(i) for i in FP_IDX])
        c_tp = counter("病人阳性", TRUE_POS, MAGENTA)
        c_fp = counter("误报阳性", FALSE_POS, MAGENTA)
        col2 = VGroup(c_tp, c_fp).arrange(DOWN, buff=0.4, aligned_edge=LEFT).next_to(col, DOWN, buff=0.7, aligned_edge=LEFT)
        with self.say("t03") as d:
            self.play(LaggedStart(*[Create(r) for r in tp_rings], lag_ratio=0.12), FadeIn(c_tp), run_time=min(2.0, d * 0.7))
        with self.say("t04") as d:
            self.play(LaggedStart(*[Create(r) for r in fp_rings], lag_ratio=0.02), FadeIn(c_fp), run_time=min(3.0, d * 0.7))

        # 阳性的人站到一起
        pos_idx = TP_IDX + FP_IDX
        cluster_pos = []
        cols = 14
        for k in range(POS):
            r, c = divmod(k, cols)
            cluster_pos.append(np.array([c * 0.23, -r * 0.23, 0]))
        cl_center = RIGHT * 4.05 + DOWN * 1.0
        off = cl_center - (cluster_pos[0] + cluster_pos[-1]) / 2 - np.array([0, 0, 0])
        cluster_pos = [p + off for p in cluster_pos]
        # 病人排在前面，便于一眼看出
        movers = []
        for k, i in enumerate(pos_idx):
            g = VGroup(dots[i], tp_rings[k] if k < TRUE_POS else fp_rings[k - TRUE_POS])
            movers.append(g)
        others = VGroup(*[dots[i] for i in range(N_PEOPLE) if i not in pos_idx])
        total = VGroup(tex("9", size=46, color=RED), tex("+", size=40), tex("89", size=46, color=GREEN),
                       tex("=", size=40), tex("98", size=52, color=MAGENTA)).arrange(RIGHT, buff=0.18)
        total.move_to(RIGHT * 4.05 + UP * 1.25)
        with self.say("t05") as d:
            self.play(FadeOut(col), FadeOut(col2), others.animate.set_opacity(0.12), FadeOut(halos), run_time=0.8)
            self.play(LaggedStart(*[m.animate.move_to(p) for m, p in zip(movers, cluster_pos)], lag_ratio=0.01),
                      run_time=min(2.6, d * 0.55))
            self.play(Write(total), run_time=0.8)

        you = VGroup(zh("你在这里面", 24, AMBER), Arrow(UP * 0.3, DOWN * 0.3, color=AMBER, stroke_width=3,
                                                     max_tip_length_to_length_ratio=0.35))
        you.arrange(DOWN, buff=0.08).next_to(VGroup(*movers), UP, buff=0.25).shift(LEFT * 1.2)
        sick_pos = VGroup(*[movers[k][0] for k in range(TRUE_POS)])
        sick_halo = VGroup(*[halo_dot(m.get_center(), RED, r=0.06, rings=3, strength=0.35)[0] for m in sick_pos])
        with self.say("t06") as d:
            self.play(total.animate.shift(UP * 0.55), FadeIn(you, shift=DOWN * 0.1), run_time=0.7)
            self.wait(max(0.1, d * 0.35))
            self.play(FadeIn(sick_halo, scale=2), Indicate(sick_pos, color=RED, scale_factor=1.6), run_time=1.2)

        frac = tex(r"{9", r"\over", r"98}", r"\approx", r"9.2\%", size=72)
        frac[0].set_color(RED)
        frac[2].set_color(MAGENTA)
        frac[4].set_color(AMBER)
        frac.move_to(LEFT * 2.7 + DOWN * 0.3)
        with self.say("t07") as d:
            self.play(FadeOut(others), FadeOut(n_lab), run_time=0.6)
            self.play(Write(frac[:3]), run_time=0.8)
            self.play(Write(frac[3:]), run_time=0.7)
            self.add(glow(frac[4].copy(), AMBER, layers=3))

        # 直觉错在哪：只看了准确率
        self.clear(run_time=0.7)
        acc = VGroup(zh("检测有多准", 32, MAGENTA), tex("90\\%", "\\;/\\;", "9\\%", size=44, color=MAGENTA)).arrange(DOWN, buff=0.3)
        rare = VGroup(zh("这种病有多少见", 32, CYAN), tex("1\\%", size=44, color=CYAN)).arrange(DOWN, buff=0.3)
        pa = on_panel(acc, pad=0.45, color=MAGENTA, min_w=4.2, min_h=2.2).move_to(LEFT * 3.0 + UP * 0.5)
        pr = on_panel(rare, pad=0.45, color=CYAN, min_w=4.2, min_h=2.2).move_to(RIGHT * 3.0 + UP * 0.5)
        x = cross_mark(RED, 0.35).next_to(pr, DOWN, buff=0.3)
        forgot = zh("被忽略了", 26, RED).next_to(x, RIGHT, buff=0.2)
        with self.say("t08") as d:
            self.play(FadeIn(pa, shift=UP * 0.2), run_time=0.7)
            self.wait(max(0.1, d * 0.35))
            self.play(FadeIn(pr, shift=UP * 0.2), run_time=0.7)
            self.play(Create(x), FadeIn(forgot), run_time=0.6)

        # 两个乘法：误报的人数远多于病人
        m1 = tex(r"10", r"\times", r"90\%", "=", r"9", size=50)
        m2 = tex(r"990", r"\times", r"9\%", "=", r"89", size=50)
        for m, c in ((m1, RED), (m2, GREEN)):
            m[0].set_color(c)
            m[2].set_color(MAGENTA)
            m[4].set_color(c)
        ms = VGroup(m1, m2).arrange(DOWN, buff=0.45, aligned_edge=RIGHT).move_to(LEFT * 2.6 + DOWN * 1.7)
        bw = 0.05
        b1 = Rectangle(width=9 * bw, height=0.4, stroke_width=0, fill_color=RED, fill_opacity=0.9)
        b2 = Rectangle(width=89 * bw, height=0.4, stroke_width=0, fill_color=GREEN, fill_opacity=0.9)
        b1.next_to(m1, RIGHT, buff=0.5)
        b2.next_to(m2, RIGHT, buff=0.5)
        b1.align_to(b2, LEFT)
        with self.say("t09") as d:
            self.play(FadeOut(VGroup(pa, pr, x, forgot)), run_time=0.5)
            ms.move_to(DOWN * 0.1 + LEFT * 2.2)
            b1.next_to(m1, RIGHT, buff=0.5)
            b2.next_to(m2, RIGHT, buff=0.5)
            b1.align_to(b2, LEFT)
            self.play(Write(m1), run_time=0.8)
            self.play(GrowFromEdge(b1, LEFT), run_time=0.5)
            self.play(Write(m2), run_time=0.8)
            self.play(GrowFromEdge(b2, LEFT), run_time=1.0)

        prior = VGroup(zh("先验", 40, CYAN), tex(r"P(\text{有病})", "=", r"1\%", size=48)).arrange(RIGHT, buff=0.4)
        prior[1][0].set_color(CYAN)
        prior[1][2].set_color(CYAN)
        box = on_panel(prior, pad=0.4, color=CYAN).move_to(UP * 2.0)
        with self.say("t10") as d:
            self.play(FadeIn(box[0], scale=0.9), FadeIn(prior[0]), run_time=0.7)
            self.play(Write(prior[1]), run_time=0.9)
            self.add(glow(prior[0].copy(), CYAN, layers=3))
        self.clear(run_time=0.8)
