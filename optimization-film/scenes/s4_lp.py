"""第四章：线性规划。木工坊的可行域、等利润线、单纯形法、影子价格、对偶与整数规划。"""
import numpy as np

from common import *  # noqa: F401,F403

WOOD, LABOR, CHAIR = BLUE, ORANGE, PURPLE


def table_icon(col=INK, s=1.0):
    top = Rectangle(width=1.2, height=0.12, fill_color=col, fill_opacity=1, stroke_width=0).shift(UP * 0.3)
    legs = VGroup(*[Rectangle(width=0.08, height=0.6, fill_color=col, fill_opacity=1, stroke_width=0).move_to([x, -0.06, 0])
                    for x in (-0.48, 0.48)])
    return VGroup(top, legs).scale(s)


def chair_icon(col=INK, s=1.0):
    seat = Rectangle(width=0.62, height=0.1, fill_color=col, fill_opacity=1, stroke_width=0)
    back = Rectangle(width=0.08, height=0.62, fill_color=col, fill_opacity=1, stroke_width=0).move_to([-0.27, 0.32, 0])
    legs = VGroup(*[Rectangle(width=0.07, height=0.42, fill_color=col, fill_opacity=1, stroke_width=0).move_to([x, -0.25, 0])
                    for x in (-0.27, 0.27)])
    return VGroup(seat, back, legs).scale(s)


class S4(VScene):
    def construct(self):
        self.chapter("s4_00", "第四章", "线性规划", "有限的资源，最好的安排")
        self.story()
        self.region()
        self.isoprofit()
        self.simplex()
        self.shadow()
        self.dual()
        self.integer()

    # ---------------------------------------------------------------
    def story(self):
        def card(icon, name, rows, col):
            box = RoundedRectangle(corner_radius=0.2, width=4.6, height=3.4, stroke_color=col, stroke_width=2.5,
                                   fill_color=BG, fill_opacity=1)
            head = VGroup(icon, T(name, 36, col, weight=BOLD)).arrange(RIGHT, buff=0.4)
            lines = VGroup(*[VGroup(T(a, 28, DIM), T(b, 28, c)).arrange(RIGHT, buff=0.3) for a, b, c in rows]
                           ).arrange(DOWN, aligned_edge=LEFT, buff=0.18)
            VGroup(head, lines).arrange(DOWN, buff=0.35).move_to(box)
            return VGroup(box, head, lines)

        t = card(table_icon(TEAL), "桌子", [("木料", "1 份", WOOD), ("工时", "2 小时", LABOR), ("利润", "300 元", YELLOW)], TEAL)
        c = card(chair_icon(TEAL), "椅子", [("木料", "1 份", WOOD), ("工时", "1 小时", LABOR), ("利润", "200 元", YELLOW)], TEAL)
        cards = VGroup(t, c).arrange(RIGHT, buff=0.8).shift(UP * 0.6)
        with self.say("s4_01") as d:
            self.play(FadeIn(t, shift=UP * 0.3), run_time=1.0)
            self.wait(d * 0.35)
            self.play(FadeIn(c, shift=UP * 0.3), run_time=1.0)
        res = VGroup(VGroup(T("每周", 28, DIM), T("木料 ≤ 40 份", 30, WOOD), T("工时 ≤ 60 小时", 30, LABOR),
                            T("椅子最多卖 30 把", 30, CHAIR)).arrange(RIGHT, buff=0.45),
                     T("怎样安排生产，利润最大？", 36, YELLOW, weight=BOLD)).arrange(DOWN, buff=0.35)
        res.next_to(cards, DOWN, buff=0.45)
        with self.say("s4_02") as d:
            self.play(FadeIn(res[0], shift=UP * 0.2), run_time=1.2)
            self.wait(d * 0.3)
            self.play(FadeIn(res[1], shift=UP * 0.2), run_time=1.0)
        lp = VGroup(M(r"\max\;\; 300x + 200y", size=46, color=YELLOW),
                    M(r"x + y \le 40", size=42, color=WOOD),
                    M(r"2x + y \le 60", size=42, color=LABOR),
                    M(r"y \le 30", size=42, color=CHAIR),
                    M(r"x,\; y \ge 0", size=42, color=DIM)).arrange(DOWN, aligned_edge=LEFT, buff=0.22)
        names = VGroup(T("x：桌子数", 26, DIM), T("y：椅子数", 26, DIM)).arrange(DOWN, aligned_edge=LEFT, buff=0.12)
        lin = T("全是一次式：线性", 30, TEAL, weight=BOLD)
        grp = VGroup(lp, VGroup(names, lin).arrange(DOWN, aligned_edge=LEFT, buff=0.5)).arrange(RIGHT, buff=1.2)
        with self.say("s4_03") as d:
            self.play(FadeOut(VGroup(cards, res)), run_time=0.7)
            self.play(Write(lp), FadeIn(names), run_time=2.6)
            self.wait(d * 0.15)
            self.play(FadeIn(lin, shift=UP * 0.2), run_time=1.0)
        self.play(FadeOut(lin), FadeOut(names), lp.animate.scale(0.78).to_corner(UR, buff=0.45), run_time=1.0)
        self.lp = lp

    def region(self):
        ax = Axes(x_range=[0, 44, 10], y_range=[0, 44, 10], x_length=5.6, y_length=5.6,
                  axis_config={"color": DIM, "include_tip": False, "font_size": 24},
                  x_axis_config={"numbers_to_include": [10, 20, 30, 40]},
                  y_axis_config={"numbers_to_include": [10, 20, 30, 40]}).move_to([-3.4, -0.15, 0])
        self.ax = ax
        xl = T("桌子", 24, DIM).next_to(ax.x_axis.get_end(), DOWN, buff=0.35)
        yl = T("椅子", 24, DIM).next_to(ax.y_axis.get_end(), LEFT, buff=0.2)
        box = Polygon(ax.c2p(0, 0), ax.c2p(44, 0), ax.c2p(44, 44), ax.c2p(0, 44), fill_color=TEAL, fill_opacity=0.18, stroke_width=0)
        region = box.copy()
        lines = [(Line(ax.c2p(0, 40), ax.c2p(40, 0), color=WOOD, stroke_width=4), "木料", WOOD,
                  [ax.c2p(0, 40), ax.c2p(40, 0), ax.c2p(60, 0), ax.c2p(60, 60), ax.c2p(0, 60)]),
                 (Line(ax.c2p(8, 44), ax.c2p(30, 0), color=LABOR, stroke_width=4), "工时", LABOR,
                  [ax.c2p(8, 44), ax.c2p(30, 0), ax.c2p(60, 0), ax.c2p(60, 60), ax.c2p(8, 60)]),
                 (Line(ax.c2p(0, 30), ax.c2p(44, 30), color=CHAIR, stroke_width=4), "销量", CHAIR,
                  [ax.c2p(0, 30), ax.c2p(60, 30), ax.c2p(60, 60), ax.c2p(0, 60)])]
        self.cons_lines = []
        with self.say("s4_04") as d:
            self.play(Create(ax), FadeIn(xl), FadeIn(yl), FadeIn(region), run_time=1.4)
            spots = {"木料": ax.c2p(5, 36), "工时": ax.c2p(27, 7), "销量": ax.c2p(36, 31.5)}
            for ln, name, col, bad in lines:
                lab = T(name, 24, col).next_to(spots[name], RIGHT if name != "销量" else UP, buff=0.12)
                cut = Difference(region, Polygon(*bad), fill_color=TEAL, fill_opacity=0.18, stroke_width=0)
                self.play(Create(ln), FadeIn(lab), run_time=0.9)
                self.play(Transform(region, cut), run_time=0.9)
                self.cons_lines.append(VGroup(ln, lab))
            verts = [(0, 0), (30, 0), (20, 20), (10, 30), (0, 30)]
            vd = VGroup(*[Dot(ax.c2p(*v), radius=0.07, color=INK) for v in verts])
            vl = VGroup(*[label_box(M(r"(%d,%d)" % v, size=26, color=DIM), buff=0.04).next_to(ax.c2p(*v), dr, buff=0.06)
                          for v, dr in zip(verts, [UR, UR, RIGHT, UR, DR])])
            self.play(region.animate.set_stroke(TEAL, 3), FadeIn(vd), FadeIn(vl), run_time=1.2)
            conv = T("可行域：半平面的交集，一定是凸的", 28, TEAL).move_to([3.3, -0.9, 0])
            self.play(FadeIn(conv, shift=UP * 0.2), run_time=1.0)
        self.region_m, self.vd, self.vl, self.conv = region, vd, vl, conv

    def iso_line(self, c, col=YELLOW, w=4):
        """利润为 c 的等利润线 300x + 200y = c，截在坐标框 [0,44]^2 内。"""
        ax = self.ax
        pts = []
        for x in (0, 44):
            y = (c - 300 * x) / 200
            if 0 <= y <= 44:
                pts.append((x, y))
        for y in (0, 44):
            x = (c - 200 * y) / 300
            if 0 <= x <= 44:
                pts.append((x, y))
        pts = sorted(set((round(a, 6), round(b, 6)) for a, b in pts))
        if len(pts) < 2:
            return VMobject()
        return DashedLine(ax.c2p(*pts[0]), ax.c2p(*pts[-1]), color=col, stroke_width=w + 1, dash_length=0.14)

    def isoprofit(self):
        ax = self.ax
        c = ValueTracker(1500)
        line = always_redraw(lambda: self.iso_line(c.get_value()))
        val = always_redraw(lambda: VGroup(T("利润", 30, YELLOW), M(r"%d" % (round(c.get_value() / 100) * 100), size=44, color=YELLOW),
                                           T("元", 30, YELLOW)).arrange(RIGHT, buff=0.2).move_to([3.3, -2.0, 0]))
        with self.say("s4_05") as d:
            self.play(FadeOut(self.conv), FadeIn(line), FadeIn(val), run_time=1.0)
            self.wait(d * 0.12)
            self.play(c.animate.set_value(10000), run_time=d * 0.55, rate_func=rate_functions.ease_in_out_sine)
            best = Dot(ax.c2p(20, 20), radius=0.13, color=YELLOW).set_z_index(5)
            self.play(FadeIn(best, scale=0.4), Flash(best, color=YELLOW), run_time=1.0)
            ans = VGroup(table_icon(TEAL, 0.5), M("20", size=40), chair_icon(TEAL, 0.6), M("20", size=40)).arrange(RIGHT, buff=0.25)
            ans.next_to(val, UP, buff=0.35)
            self.play(FadeIn(ans, shift=UP * 0.2), run_time=0.8)
        self.best, self.iso, self.val, self.ans = best, line, val, ans
        # 为什么在顶点：从内部一点出发，沿着让利润增加的方向走到边，再沿边走到顶点
        # (6,14) 向右走先碰到工时线于 (23,14)，再沿工时边走到顶点 (20,20)；利润 4600 → 9700 → 10000
        path = [ax.c2p(6, 14), ax.c2p(23, 14), ax.c2p(20, 20)]
        why = VGroup(T("线性函数没有弯：", 28, INK), T("沿任何线段，要么一直增，要么一直减", 26, DIM)).arrange(DOWN, buff=0.12)
        why = label_box(why, buff=0.2).move_to([3.3, 0.3, 0])
        walker = Dot(path[0], color=TEAL, radius=0.1).set_z_index(6)
        a1 = Arrow(path[0], path[1], buff=0.05, color=TEAL, stroke_width=4, max_tip_length_to_length_ratio=0.12)
        with self.say("s4_06") as d:
            self.play(FadeOut(line), FadeOut(val), FadeOut(ans), self.best.animate.set_opacity(0.4), run_time=0.8)
            self.play(FadeIn(walker), FadeIn(why), run_time=1.0)
            self.wait(d * 0.1)
            self.play(GrowArrow(a1), walker.animate.move_to(path[1]), run_time=2.2)
            self.play(walker.animate.move_to(path[2]), run_time=1.6)
            self.play(Flash(walker, color=TEAL), self.best.animate.set_opacity(1), run_time=0.8)
        self.play(FadeOut(VGroup(walker, a1, why)), run_time=0.5)

    def simplex(self):
        ax = self.ax
        # 多面体示意：很多顶点，沿边爬到最高
        rng = np.random.default_rng(4)
        ang = np.sort(rng.uniform(0, 2 * np.pi, 16))
        poly_pts = [np.array([3.3 + 2.4 * np.cos(a), -0.4 + 1.9 * np.sin(a), 0]) for a in ang]
        poly = Polygon(*poly_pts, color=TEAL, fill_opacity=0.15, stroke_width=2.5)
        vds = VGroup(*[Dot(p, radius=0.05, color=INK) for p in poly_pts])
        order = np.argsort([p[1] for p in poly_pts])
        lo = int(order[0])
        hi = int(order[-1])
        n = len(poly_pts)
        route = [lo]
        while route[-1] != hi:
            route.append((route[-1] + 1) % n)
        if len(route) > n // 2 + 1:
            route = [lo]
            while route[-1] != hi:
                route.append((route[-1] - 1) % n)
        tour = VMobject(stroke_color=YELLOW, stroke_width=5).set_points_as_corners([poly_pts[i] for i in route])
        up = Arrow([6.4, -1.8, 0], [6.4, 1.2, 0], buff=0, color=YELLOW, stroke_width=4)
        upl = T("更好", 24, YELLOW).next_to(up, UP, buff=0.1)
        who = label_box(VGroup(T("单纯形法", 34, YELLOW, weight=BOLD), T("丹齐格，1947 年", 24, DIM)).arrange(DOWN, buff=0.1),
                        buff=0.18).move_to([3.3, 2.75, 0])
        many = T("顶点多到无法枚举", 28, DIM).move_to([3.3, -2.75, 0])
        with self.say("s4_07") as d:
            self.play(FadeOut(self.lp), run_time=0.6)
            self.play(Create(poly), FadeIn(vds), FadeIn(many), run_time=1.4)
            self.wait(d * 0.2)
            self.play(FadeIn(who, shift=DOWN * 0.2), GrowArrow(up), FadeIn(upl), run_time=1.2)
            self.play(Create(tour), run_time=d * 0.35, rate_func=linear)
        self.play(FadeOut(VGroup(poly, vds, tour, up, upl, many, who)), run_time=0.6)

        w = Dot(ax.c2p(0, 0), radius=0.12, color=YELLOW).set_z_index(6)
        profit = ValueTracker(0)
        pv = always_redraw(lambda: VGroup(T("利润", 30, YELLOW), M(r"%d" % round(profit.get_value()), size=44, color=YELLOW),
                                          T("元", 30, YELLOW)).arrange(RIGHT, buff=0.2).move_to([3.3, 2.6, 0]))
        l1 = VGroup(table_icon(TEAL, 0.45), T("桌子更赚钱，先做桌子", 28, INK)).arrange(RIGHT, buff=0.25)
        l1b = T("做到 30 张，工时用完", 26, LABOR)
        s1 = VGroup(l1, l1b).arrange(DOWN, aligned_edge=LEFT, buff=0.15).move_to([3.3, 1.2, 0])
        self.best.set_opacity(0)
        with self.say("s4_08") as d:
            self.play(FadeIn(w), FadeIn(pv), run_time=0.8)
            self.play(FadeIn(l1), run_time=0.8)
            self.wait(d * 0.15)
            self.play(w.animate.move_to(ax.c2p(30, 0)), profit.animate.set_value(9000), run_time=3.0)
            self.play(FadeIn(l1b), Indicate(self.cons_lines[1][0], color=LABOR), run_time=1.2)
        rows = VGroup(
            VGroup(T("多一把椅子", 26, INK), M(r"+200", size=36, color=GREEN)).arrange(RIGHT, buff=0.3),
            VGroup(T("少半张桌子", 26, INK), M(r"-150", size=36, color=RED)).arrange(RIGHT, buff=0.3),
            VGroup(T("净赚", 26, INK, weight=BOLD), M(r"+50", size=40, color=GREEN), T("划算", 26, GREEN, weight=BOLD)).arrange(RIGHT, buff=0.3),
        ).arrange(DOWN, aligned_edge=RIGHT, buff=0.15)
        s2 = VGroup(T("沿着工时用满的边：用桌子换椅子", 26, LABOR), rows).arrange(DOWN, buff=0.25).move_to([3.3, 0.4, 0])
        with self.say("s4_09") as d:
            self.play(FadeOut(s1), FadeIn(s2[0]), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(r, shift=LEFT * 0.2) for r in rows], lag_ratio=0.6), run_time=2.6)
            self.wait(d * 0.12)
            self.play(w.animate.move_to(ax.c2p(20, 20)), profit.animate.set_value(10000), run_time=3.4)
            self.play(Indicate(self.cons_lines[0][0], color=WOOD), run_time=1.0)
        try1 = DashedLine(ax.c2p(20, 20), ax.c2p(13, 27), color=RED, stroke_width=4)
        try2 = DashedLine(ax.c2p(20, 20), ax.c2p(26, 8), color=RED, stroke_width=4)
        rows2 = VGroup(
            VGroup(T("再多一把椅子", 26, INK), M(r"+200", size=36, color=GREEN)).arrange(RIGHT, buff=0.3),
            VGroup(T("少一整张桌子", 26, INK), M(r"-300", size=36, color=RED)).arrange(RIGHT, buff=0.3),
            VGroup(T("净亏", 26, INK, weight=BOLD), M(r"-100", size=40, color=RED)).arrange(RIGHT, buff=0.3),
        ).arrange(DOWN, aligned_edge=RIGHT, buff=0.15).move_to([3.3, 0.4, 0])
        stop = T("所有方向都不划算：停", 30, YELLOW, weight=BOLD).move_to([3.3, -1.3, 0])
        with self.say("s4_10") as d:
            self.play(FadeOut(s2), Create(try1), FadeIn(rows2), run_time=1.4)
            self.play(Create(try2), run_time=0.8)
            self.play(FadeIn(stop, shift=UP * 0.2), Flash(w, color=YELLOW), run_time=1.0)
        why = label_box(VGroup(T("只比较了相邻的顶点……", 28, DIM),
                               T("可行域是凸的：局部最优 = 全局最优", 30, YELLOW, weight=BOLD)).arrange(DOWN, buff=0.18),
                        buff=0.25).move_to([3.3, -1.3, 0])
        why[0].set_stroke(YELLOW, 2)
        with self.say("s4_11") as d:
            self.play(FadeOut(try1), FadeOut(try2), FadeOut(rows2), FadeOut(stop), run_time=0.6)
            self.wait(d * 0.2)
            self.play(FadeIn(why, shift=UP * 0.2), run_time=1.0)
        self.play(FadeOut(why), run_time=0.5)
        self.w, self.pv, self.profit = w, pv, profit

    def shadow(self):
        ax = self.ax
        region = self.region_m
        table = VGroup()
        hdr = VGroup(T("多一个单位", 26, DIM), T("利润变化", 26, DIM)).arrange(RIGHT, buff=0.9)
        table.add(hdr)
        rows = [("木料", WOOD, "+100"), ("工时", LABOR, "+100"), ("椅子销量", CHAIR, "+0")]
        rmobs = []
        for name, col, dv in rows:
            r = VGroup(T(name, 28, col), M(dv, size=38, color=GREEN if dv != "+0" else DIM)).arrange(RIGHT, buff=1.2)
            rmobs.append(r)
        tab = VGroup(hdr, *rmobs).arrange(DOWN, aligned_edge=LEFT, buff=0.22).move_to([3.4, 0.6, 0])
        for r in rmobs:
            r[1].move_to([hdr[1].get_center()[0], r.get_center()[1], 0])

        def pentagon(w=40, l=60, ch=30):
            # 可行域顶点（按 w, l, ch 计算，只用于本例的参数范围）
            pts = [(0, 0), (l / 2, 0), (l - w, 2 * w - l), (w - ch, ch), (0, ch)]
            return Polygon(*[ax.c2p(*p) for p in pts], fill_color=TEAL, fill_opacity=0.18, stroke_color=TEAL, stroke_width=3)

        q = T("多一份木料，值多少钱？", 32, YELLOW, weight=BOLD).move_to([3.4, 2.75, 0])
        with self.say("s4_12") as d:
            self.play(FadeIn(q, shift=DOWN * 0.2), FadeOut(self.pv), FadeOut(self.vl), run_time=1.0)
            self.play(FadeIn(hdr), run_time=0.6)
            w41 = Line(ax.c2p(0, 41), ax.c2p(41, 0), color=WOOD, stroke_width=4)
            self.play(Transform(self.cons_lines[0][0], w41), Transform(region, pentagon(w=41)),
                      self.w.animate.move_to(ax.c2p(19, 22)), run_time=1.6)
            note = M(r"(19,22)\;\to\;10100", size=34, color=YELLOW).next_to(ax.c2p(19, 22), UR, buff=0.12)
            self.play(FadeIn(note), FadeIn(rmobs[0]), run_time=1.0)
            self.wait(d * 0.12)
            back = Line(ax.c2p(0, 40), ax.c2p(40, 0), color=WOOD, stroke_width=4)
            l61 = Line(ax.c2p(8.5, 44), ax.c2p(30.5, 0), color=LABOR, stroke_width=4)
            self.play(FadeOut(note), Transform(self.cons_lines[0][0], back), Transform(self.cons_lines[1][0], l61),
                      Transform(region, pentagon(l=61)), self.w.animate.move_to(ax.c2p(21, 19)), run_time=1.6)
            note2 = M(r"(21,19)\;\to\;10100", size=34, color=YELLOW).next_to(ax.c2p(21, 19), RIGHT, buff=0.15)
            self.play(FadeIn(note2), FadeIn(rmobs[1]), run_time=1.0)
        l60 = Line(ax.c2p(8, 44), ax.c2p(30, 0), color=LABOR, stroke_width=4)
        c31 = Line(ax.c2p(0, 31), ax.c2p(44, 31), color=CHAIR, stroke_width=4)
        slack = BraceBetweenPoints(ax.c2p(20, 30), ax.c2p(20, 20), direction=LEFT, color=CHAIR)
        sl = T("富余 10 把", 24, CHAIR).next_to(slack, LEFT, buff=0.1)
        wall = label_box(VGroup(T("没碰到的墙，推力为零", 28, INK), T("有富余的资源：影子价格 = 0", 28, YELLOW, weight=BOLD)
                                ).arrange(DOWN, buff=0.15), buff=0.22).move_to([3.4, -1.75, 0])
        with self.say("s4_13") as d:
            self.play(FadeOut(note2), Transform(self.cons_lines[1][0], l60), Transform(region, pentagon()),
                      self.w.animate.move_to(ax.c2p(20, 20)), run_time=1.4)
            self.play(Transform(self.cons_lines[2][0], c31), run_time=1.2)
            self.play(FadeIn(rmobs[2]), GrowFromCenter(slack), FadeIn(sl), run_time=1.2)
            self.wait(d * 0.15)
            self.play(FadeIn(wall, shift=UP * 0.2), run_time=1.0)
        self.clear_all()

    def dual(self):
        buyer = VGroup(T("收购商", 40, YELLOW, weight=BOLD), T("买下全部木料、工时和销售配额", 30, INK)).arrange(DOWN, buff=0.2)
        buyer.to_edge(UP, buff=0.5)
        prices = VGroup(*[VGroup(M(s, size=44, color=c), T(t, 28, DIM)).arrange(RIGHT, buff=0.2)
                          for s, c, t in [("a", WOOD, "元 / 份木料"), ("b", LABOR, "元 / 小时工时"), ("c", CHAIR, "元 / 把配额")]]
                        ).arrange(RIGHT, buff=0.8).next_to(buyer, DOWN, buff=0.5)
        with self.say("s4_14") as d:
            self.play(FadeIn(buyer[0], shift=DOWN * 0.2), run_time=0.8)
            self.play(FadeIn(buyer[1]), run_time=0.8)
            self.wait(d * 0.2)
            self.play(LaggedStart(*[FadeIn(p, shift=UP * 0.2) for p in prices], lag_ratio=0.4), run_time=2.2)
        c1 = VGroup(M(r"a + 2b \;\ge\; 300", size=48), T("桌子用的资源，不低于桌子的利润", 26, DIM)).arrange(RIGHT, buff=0.5)
        c2 = VGroup(M(r"a + b + c \;\ge\; 200", size=48), T("椅子用的资源，不低于椅子的利润", 26, DIM)).arrange(RIGHT, buff=0.5)
        ob = VGroup(M(r"\min\;\; 40a + 60b + 30c", size=48, color=YELLOW), T("他想花最少的钱", 26, DIM)).arrange(RIGHT, buff=0.5)
        sysm = VGroup(c1, c2, ob).arrange(DOWN, aligned_edge=LEFT, buff=0.35).next_to(prices, DOWN, buff=0.6)
        with self.say("s4_15") as d:
            self.play(FadeIn(c1, shift=UP * 0.2), run_time=1.2)
            self.play(FadeIn(c2, shift=UP * 0.2), run_time=1.2)
            self.wait(d * 0.12)
            self.play(FadeIn(ob, shift=UP * 0.2), run_time=1.2)
        sol = VGroup(M(r"a = 100", size=48, color=WOOD), M(r"b = 100", size=48, color=LABOR), M(r"c = 0", size=48, color=CHAIR)
                     ).arrange(RIGHT, buff=0.8).move_to(UP * 1.0)
        tot = M(r"40\times100 + 60\times100 + 30\times 0 \;=\; 10000", size=48).next_to(sol, DOWN, buff=0.5)
        eq = VGroup(VGroup(T("最大利润", 32, TEAL, weight=BOLD), M("10000", size=56, color=TEAL)).arrange(DOWN, buff=0.15),
                    M("=", size=72, color=YELLOW),
                    VGroup(T("资源的最低公允估价", 32, YELLOW, weight=BOLD), M("10000", size=56, color=YELLOW)).arrange(DOWN, buff=0.15)
                    ).arrange(RIGHT, buff=0.7).next_to(tot, DOWN, buff=0.6)
        name = T("线性规划的对偶", 28, DIM).next_to(eq, DOWN, buff=0.3)
        with self.say("s4_16") as d:
            self.play(FadeOut(VGroup(sysm, prices)), buyer.animate.scale(0.75).to_edge(UP, buff=0.35), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(s, shift=UP * 0.2) for s in sol], lag_ratio=0.4), run_time=2.0)
            self.play(Write(tot), run_time=2.0)
            self.wait(d * 0.12)
            self.play(FadeIn(eq, shift=UP * 0.2), run_time=1.4)
            self.play(FadeIn(name), run_time=0.8)
        self.clear_all()
        nob = VGroup(T("1975 年诺贝尔经济学奖", 40, YELLOW, weight=BOLD),
                     T("康托罗维奇 · 库普曼斯", 36, INK),
                     T("资源最优配置的理论", 30, DIM)).arrange(DOWN, buff=0.35)
        medal = VGroup(Circle(radius=0.6, color=YELLOW, fill_opacity=0.15, stroke_width=3),
                       Circle(radius=0.45, color=YELLOW, stroke_width=1.5)).next_to(nob, UP, buff=0.4)
        with self.say("s4_17") as d:
            self.play(DrawBorderThenFill(medal), run_time=1.2)
            self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.2) for m in nob], lag_ratio=0.4), run_time=2.0)
        self.clear_all()

    def integer(self):
        ax = Axes(x_range=[0, 4.6, 1], y_range=[0, 4.6, 1], x_length=5.4, y_length=5.4,
                  axis_config={"color": DIM, "include_tip": False, "font_size": 24},
                  x_axis_config={"numbers_to_include": [1, 2, 3, 4]},
                  y_axis_config={"numbers_to_include": [1, 2, 3, 4]}).move_to([-3.3, -0.1, 0])
        verts = [(0, 0), (4, 0), (2.4, 2.4), (1.8, 2.8), (0, 1)]
        poly = Polygon(*[ax.c2p(*v) for v in verts], fill_color=TEAL, fill_opacity=0.2, stroke_color=TEAL, stroke_width=3)
        feas = lambda x, y: -x + y <= 1 and 3 * x + 2 * y <= 12 and 2 * x + 3 * y <= 12
        grid = VGroup(*[Dot(ax.c2p(i, j), radius=0.07, color=TEAL if feas(i, j) else FAINT) for i in range(5) for j in range(5)])
        lp = Dot(ax.c2p(1.8, 2.8), radius=0.11, color=YELLOW).set_z_index(4)
        lpl = label_box(M(r"(1.8,\,2.8)", size=32, color=YELLOW), buff=0.05).next_to(lp, LEFT, buff=0.15)
        rd = ax.c2p(2, 3)
        cross = VGroup(Line(rd + UL * 0.16, rd + DR * 0.16, color=RED, stroke_width=6),
                       Line(rd + UR * 0.16, rd + DL * 0.16, color=RED, stroke_width=6))
        rdl = label_box(T("四舍五入 (2, 3)：出界", 26, RED), buff=0.06).next_to(rd, RIGHT, buff=0.35)
        best = VGroup(*[Circle(radius=0.18, color=YELLOW, stroke_width=3).move_to(ax.c2p(*p)) for p in [(1, 2), (2, 2)]])
        bl = label_box(T("真正的整数最优", 26, YELLOW), buff=0.06).next_to(ax.c2p(2, 2), RIGHT, buff=0.35)
        prob = VGroup(M(r"\max\; y", size=40), M(r"-x + y \le 1", size=36), M(r"3x + 2y \le 12", size=36),
                      M(r"2x + 3y \le 12", size=36), VGroup(M(r"x, y", size=36), T("取整数", 28, YELLOW)).arrange(RIGHT, buff=0.2)
                      ).arrange(DOWN, aligned_edge=LEFT, buff=0.18).move_to([3.0, 1.6, 0])
        hard = label_box(VGroup(T("整数规划：没有已知的高效通用算法", 28, INK, weight=BOLD),
                                T("分支定界：用一个个线性规划去逼近", 26, DIM)).arrange(DOWN, buff=0.15), buff=0.22).move_to([3.0, -1.9, 0])
        with self.say("s4_18", tail=1.0) as d:
            self.play(Create(ax), FadeIn(prob), run_time=1.4)
            self.play(DrawBorderThenFill(poly), FadeIn(grid), run_time=1.4)
            self.play(FadeIn(lp, scale=0.5), FadeIn(lpl), run_time=0.8)
            self.wait(d * 0.08)
            self.play(Create(cross), FadeIn(rdl), run_time=1.0)
            self.wait(d * 0.08)
            self.play(Create(best), FadeIn(bl), run_time=1.0)
            self.wait(d * 0.1)
            self.play(FadeIn(hard, shift=UP * 0.2), run_time=1.0)
        self.clear_all(0.9)
