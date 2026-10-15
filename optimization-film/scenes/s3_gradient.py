"""第三章：梯度下降。雾中下山、最陡方向、学习率、条件数与之字形、动量、随机梯度、牛顿法。"""
import math

import contourpy
import numpy as np

from common import *  # noqa: F401,F403


def hills(x, y):
    """一片不规则的山地，只有一个谷底，用于"雾中下山"。"""
    return (0.06 * (x - 1.6) ** 2 + 0.16 * (y + 0.6) ** 2
            + 0.9 * np.exp(-((x + 2.2) ** 2 + (y - 1.2) ** 2) / 2.2)
            + 0.5 * np.exp(-((x - 3.6) ** 2 + (y - 1.8) ** 2) / 1.5)
            + 0.18 * np.sin(0.9 * x + 0.4) * np.cos(0.7 * y))


def grad(f, x, y, h=1e-4):
    return np.array([(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)])


def contour_group(ax, f, xr, yr, levels, colors, n=220, width=2.0, opacity=0.8):
    X, Y = np.meshgrid(np.linspace(*xr, n), np.linspace(*yr, n))
    gen = contourpy.contour_generator(X, Y, f(X, Y))
    out = VGroup()
    for lv, col in zip(levels, colors):
        for seg in gen.lines(lv):
            if len(seg) < 6:
                continue
            pts = [ax.c2p(x, y) for x, y in seg[:: max(1, len(seg) // 120)]]
            if np.linalg.norm(seg[0] - seg[-1]) < 1e-6:
                pts.append(pts[0])
            out.add(VMobject(stroke_color=col, stroke_width=width, stroke_opacity=opacity).set_points_smoothly(pts))
    return out


def valley_path(kappa, start, steps, eta=None, beta=0.0):
    L, mu = 2 * kappa, 2
    if eta is None:
        eta = 2 / (L + mu)
    p = prev = np.array(start, dtype=float)
    out = [p.copy()]
    for _ in range(steps):
        g = np.array([2 * p[0], 2 * kappa * p[1]])
        p, prev = p - eta * g + beta * (p - prev), p
        out.append(p.copy())
    return np.array(out)


class S3(VScene):
    def construct(self):
        self.chapter("s3_00", "第三章", "梯度下降", "只看脚下，一步一步走")
        self.fog_walk()
        self.gradient_field()
        self.steepest()
        self.rule()
        self.step_sizes()
        self.valley()
        self.momentum()
        self.sgd()
        self.newton()
        self.summary()

    # ---------------------------------------------------------------
    def fog_walk(self):
        ax = Axes(x_range=[-6.5, 6.5], y_range=[-3.2, 3.2], x_length=12.6, y_length=6.2,
                  axis_config={"stroke_opacity": 0, "include_tip": False, "include_ticks": False}).shift(UP * 0.35)
        self.ax = ax
        xs, ys = np.meshgrid(np.linspace(-6.5, 6.5, 200), np.linspace(-3.2, 3.2, 200))
        z = hills(xs, ys)
        levels = np.linspace(z.min() + 0.04, z.max() - 0.05, 16)
        cols = color_gradient(["#2B4C8C", BLUE, TEAL, GREEN, YELLOW], len(levels))
        cmap = contour_group(ax, hills, (-6.5, 6.5), (-3.2, 3.2), levels, cols)
        self.cmap = cmap
        # 梯度下降路径
        p = np.array([-5.6, 2.4])
        path = [p.copy()]
        for _ in range(2400):
            p = p - 0.25 * grad(hills, *p)
            path.append(p.copy())
        path = np.array(path)
        arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
        self.walk = path
        walker = Dot(ax.c2p(*path[0]), radius=0.13, color=YELLOW).set_z_index(10)
        # 雾：一张径向渐变的大图，中心的窗口跟着小球移动
        fog = fog_image(3 * config.frame_width, 3 * config.frame_height,
                        lambda X, Y: smoothstep(1.05, 1.9, np.hypot(X, Y)), px_per_unit=40)
        fog.move_to(walker).set_z_index(8)
        fog.add_updater(lambda m: m.move_to(walker.get_center()))
        trail_pts = [walker.get_center().copy(), walker.get_center() + RIGHT * 1e-3]
        trail = VMobject(stroke_color=YELLOW, stroke_width=3, stroke_opacity=0.8).set_z_index(7)
        trail.set_points_as_corners(trail_pts)

        def grow(m):
            trail_pts.append(walker.get_center().copy())
            m.set_points_as_corners(trail_pts)

        stops = [int(np.searchsorted(arc, k * 0.62)) for k in range(11)]   # 每一步约迈 0.62
        with self.say("s3_01") as d:
            self.add(cmap, fog, walker)
            self.play(FadeIn(cmap), FadeIn(walker), run_time=1.2)
            self.wait(d * 0.22)
            self.add(trail)
            trail.add_updater(grow)
            per = (d * 0.72 - 1.2) / (len(stops) - 1)
            for a, b in zip(stops[:-1], stops[1:]):
                g = grad(hills, *path[a])
                tip = ax.c2p(*(path[a] - 0.9 * g / np.linalg.norm(g)))
                arr = Arrow(walker.get_center(), tip, buff=0, color=ORANGE, stroke_width=5,
                            max_tip_length_to_length_ratio=0.3).set_z_index(11)
                self.add(arr)
                pts = [ax.c2p(*q) for q in path[a:b + 1]]
                self.play(MoveAlongPath(walker, VMobject().set_points_as_corners(pts)) if len(pts) > 1 else Wait(per),
                          FadeOut(arr), run_time=per, rate_func=rate_functions.ease_in_out_sine)
        fog.clear_updaters()
        trail.clear_updaters()
        full = VMobject(stroke_color=YELLOW, stroke_width=3.5).set_points_smoothly([ax.c2p(*q) for q in path[:2400:12]])
        bottom = Dot(ax.c2p(*path[-1]), radius=0.11, color=YELLOW)
        name = label_box(VGroup(T("梯度下降", 40, INK, weight=BOLD), T("柯西，1847 年", 26, DIM)).arrange(DOWN, buff=0.15),
                         buff=0.25).to_corner(UL, buff=0.5)
        today = label_box(T("今天：几乎所有人工智能模型都靠它训练", 28, YELLOW), buff=0.2).to_corner(UR, buff=0.55)
        with self.say("s3_02") as d:
            self.play(FadeOut(fog, run_time=2.0))
            self.remove(trail)
            self.play(walker.animate.move_to(bottom), Create(full), run_time=2.0)
            self.play(FadeIn(name, shift=DOWN * 0.2), run_time=1.0)
            self.wait(d * 0.12)
            self.play(FadeIn(today, shift=DOWN * 0.2), run_time=1.0)
        self.play(FadeOut(VGroup(full, walker, name, today)), cmap.animate.set_stroke(opacity=0.55), run_time=0.8)

    def gradient_field(self):
        ax, cmap = self.ax, self.cmap
        arrows = VGroup()
        for x in np.arange(-6.0, 6.5, 0.9):
            for y in np.arange(-2.8, 3.1, 0.8):
                g = grad(hills, x, y)
                n = np.linalg.norm(g)
                if n < 0.02:
                    continue
                L = 0.18 + 0.55 * min(n / 0.45, 1)
                a = ax.c2p(x, y)
                arrows.add(Arrow(a, a + np.array([*g / n, 0]) * L, buff=0, stroke_width=3, color=ORANGE,
                                 max_tip_length_to_length_ratio=0.35, max_stroke_width_to_length_ratio=8))
        P = np.array([-3.8, -1.4])
        g = grad(hills, *P)
        u = g / np.linalg.norm(g)
        cp = ax.c2p(*P)
        big = Arrow(cp, cp + np.array([*u, 0]) * 1.5, buff=0, color=YELLOW, stroke_width=7, max_tip_length_to_length_ratio=0.2)
        tan = Line(cp - np.array([-u[1], u[0], 0]) * 1.1, cp + np.array([-u[1], u[0], 0]) * 1.1, color=INK, stroke_width=3)
        tv, uv, e = np.array([-u[1], u[0], 0]), np.array([u[0], u[1], 0]), 0.22
        ra = VMobject(stroke_color=INK, stroke_width=2.5).set_points_as_corners([cp + tv * e, cp + tv * e + uv * e, cp + uv * e])
        lab = label_box(VGroup(M(r"\nabla f", size=44, color=YELLOW), T("垂直于等高线，指向上坡最陡的方向", 28, INK)
                               ).arrange(RIGHT, buff=0.3), buff=0.2).to_edge(UP, buff=0.35)
        lab2 = label_box(T("箭头越长，坡越陡", 26, DIM), buff=0.15).next_to(lab, DOWN, buff=0.15)
        with self.say("s3_03") as d:
            self.play(LaggedStart(*[GrowArrow(a) for a in arrows], lag_ratio=0.01), run_time=2.4)
            self.play(FadeIn(lab, shift=DOWN * 0.2), run_time=1.0)
            self.wait(d * 0.1)
            self.play(arrows.animate.set_opacity(0.25), Create(tan), GrowArrow(big), run_time=1.4)
            self.play(Create(ra), run_time=0.6)
            self.play(FadeIn(lab2), run_time=0.8)
        self.play(FadeOut(VGroup(arrows, tan, big, ra, lab, lab2, cmap)), run_time=0.8)

    def steepest(self):
        C = np.array([-3.3, -0.3, 0])
        g = np.array([1.0, 0.55, 0])
        g = g / np.linalg.norm(g) * 2.0
        circ = DashedVMobject(Circle(radius=1.6, color=DIM, stroke_width=2).move_to(C), num_dashes=40)
        ga = Arrow(C, C + g, buff=0, color=ORANGE, stroke_width=7, max_tip_length_to_length_ratio=0.15)
        gl = M(r"\nabla f", size=42, color=ORANGE).next_to(ga.get_end(), UR, buff=0.08)
        th = ValueTracker(2.4)
        uarr = always_redraw(lambda: Arrow(C, C + 1.6 * np.array([np.cos(th.get_value()), np.sin(th.get_value()), 0]),
                                           buff=0, color=YELLOW, stroke_width=6, max_tip_length_to_length_ratio=0.2))
        ul = always_redraw(lambda: M("u", size=40, color=YELLOW).move_to(
            C + 1.95 * np.array([np.cos(th.get_value()), np.sin(th.get_value()), 0])))
        gn = np.linalg.norm(g)
        ga_ang = np.arctan2(g[1], g[0])
        meter_x, meter_b, meter_h = 3.0, -2.4, 4.6
        frame = Rectangle(width=0.7, height=meter_h, stroke_color=DIM, stroke_width=2).move_to([meter_x, meter_b + meter_h / 2, 0])
        zero = DashedLine([meter_x - 0.6, meter_b + meter_h / 2, 0], [meter_x + 0.6, meter_b + meter_h / 2, 0], color=DIM)

        def bar():
            v = np.cos(th.get_value() - ga_ang)
            h = abs(v) * meter_h / 2
            col = YELLOW if v > 0 else TEAL
            r = Rectangle(width=0.62, height=max(h, 1e-3), stroke_width=0, fill_color=col, fill_opacity=0.85)
            return r.move_to([meter_x, meter_b + meter_h / 2 + np.sign(v) * h / 2, 0])

        b = always_redraw(bar)
        ml = VGroup(M(r"\nabla f \cdot u", size=40), T("上升的快慢", 24, DIM)).arrange(DOWN, buff=0.12).next_to(frame, UP, buff=0.2)
        cs = M(r"\nabla f \cdot u \;\le\; |\nabla f|\,|u|", size=46)
        cs_l = T("柯西–施瓦茨不等式", 26, DIM).next_to(cs, DOWN, buff=0.15)
        side = VGroup(cs, cs_l).move_to([-0.2, 2.9, 0])
        top = always_redraw(lambda: Line([meter_x - 0.5, meter_b + meter_h, 0], [meter_x + 0.5, meter_b + meter_h, 0],
                                         color=YELLOW, stroke_width=3))
        with self.say("s3_04") as d:
            self.play(Create(circ), GrowArrow(ga), FadeIn(gl), run_time=1.2)
            self.play(FadeIn(uarr), FadeIn(ul), Create(frame), Create(zero), FadeIn(ml), FadeIn(b), run_time=1.2)
            self.play(th.animate.set_value(2.4 + 2 * PI), run_time=5.0, rate_func=rate_functions.ease_in_out_sine)
            self.play(th.animate.set_value(ga_ang + 2 * PI), run_time=1.6)
            self.play(Create(top), Flash(ga.get_end(), color=YELLOW), run_time=0.8)
            self.play(Write(cs), FadeIn(cs_l), run_time=1.6)
            self.wait(max(d * 0.08, 0.1))
            neg = Arrow(C, C - g, buff=0, color=TEAL, stroke_width=7, max_tip_length_to_length_ratio=0.15)
            nl = VGroup(M(r"-\nabla f", size=42, color=TEAL), T("下降最快", 28, TEAL, weight=BOLD)).arrange(RIGHT, buff=0.2)
            nl.next_to(neg.get_end(), DOWN, buff=0.15)
            self.play(th.animate.set_value(ga_ang + 3 * PI), GrowArrow(neg), FadeIn(nl), run_time=1.6)
        self.clear_all()

    def rule(self):
        f = M(r"x_{k+1}", r"\;=\;", r"x_k", r"\;-\;", r"\eta", r"\,\nabla f(x_k)", size=88).shift(UP * 0.8)
        f[0].set_color(TEAL)
        f[4].set_color(YELLOW)
        f[5].set_color(ORANGE)
        labs = [(f[0], "新的位置", TEAL), (f[2], "旧的位置", INK), (f[4], "步长（学习率）", YELLOW), (f[5], "梯度", ORANGE)]
        gs = VGroup()
        for part, txt, col in labs:
            br = Brace(part, DOWN, color=col, buff=0.15)
            gs.add(VGroup(br, T(txt, 28, col).next_to(br, DOWN, buff=0.12)))
        low = min(g[1].get_bottom()[1] for g in gs)
        for i, g in enumerate(gs):
            g[1].shift(UP * (low - g[1].get_bottom()[1]) + (DOWN * 0.75 if i == 2 else ORIGIN))
        with self.say("s3_05") as d:
            self.play(Write(f), run_time=2.0)
            for g in gs:
                self.play(FadeIn(g, shift=UP * 0.15), run_time=0.7)
            self.wait(d * 0.1)
            self.play(Indicate(f[4], color=YELLOW, scale_factor=1.3), run_time=1.0)
        self.clear_all()

    def step_sizes(self):
        cfg = [("s3_06", 0.1, "稳，但慢", TEAL), ("s3_07", 0.9, "来回弹，但收敛", YELLOW), ("s3_08", 1.1, "越弹越远：发散", RED)]
        panels = VGroup()
        axs = []
        for i, (_, eta, _, col) in enumerate(cfg):
            ax = Axes(x_range=[-4, 4], y_range=[0, 14], x_length=4.0, y_length=3.6,
                      axis_config={"color": FAINT, "include_ticks": False, "include_tip": False})
            g = ax.plot(lambda t: t * t, x_range=[-3.74, 3.74, 0.02], color=BLUE, stroke_width=4)
            ttl = M(r"\eta = %s" % eta, size=40, color=col).next_to(ax, UP, buff=0.2)
            panels.add(VGroup(ax, g, ttl))
            axs.append(ax)
        panels.arrange(RIGHT, buff=0.6).shift(DOWN * 0.1)
        head = M(r"f(x) = x^2", size=44).to_edge(UP, buff=0.45)
        self.add(head)
        for (sid, eta, verdict, col), pnl, ax in zip(cfg, panels, axs):
            xs = [2.5]
            for _ in range(14):
                xs.append(xs[-1] * (1 - 2 * eta))
            pts = [ax.c2p(x, x * x) for x in xs]
            with self.say(sid) as d:
                if sid == "s3_06":
                    self.play(FadeIn(head), run_time=0.5)
                self.play(FadeIn(pnl), run_time=0.8)
                ball = Dot(pts[0], radius=0.1, color=col).set_z_index(4)
                self.play(FadeIn(ball), run_time=0.3)
                n = 9 if eta < 1 else 3
                per = (d - 3.2) / n
                for k in range(n):
                    a, b = pts[k], pts[k + 1]
                    if eta > 1 and k == n - 1:
                        b = a + (b - a) * 0.55
                    ang = PI / 3 if eta < 1 else PI / 14
                    arc = ArcBetweenPoints(a, b, angle=-ang if b[0] > a[0] else ang, color=col, stroke_width=2.5)
                    arc = DashedVMobject(arc, num_dashes=10)
                    self.play(Create(arc), ball.animate.move_to(b), run_time=per)
                if eta > 1:
                    self.play(FadeOut(ball), run_time=0.3)
                v = T(verdict, 28, col, weight=BOLD).next_to(ax, DOWN, buff=0.3)
                self.play(FadeIn(v, shift=UP * 0.15), run_time=0.8)
        self.clear_all()

    def valley_axes(self):
        ax = Axes(x_range=[-8.6, 8.6], y_range=[-2.45, 2.45], x_length=13.0, y_length=13.0 * 4.9 / 17.2,
                  axis_config={"stroke_opacity": 0, "include_tip": False, "include_ticks": False}).shift(DOWN * 0.2)
        levels = [0.6, 2.5, 6, 12, 22, 36, 55]
        ell = VGroup(*[Ellipse(width=2 * math.sqrt(c) * ax.x_axis.unit_size, height=2 * math.sqrt(c / 10) * ax.y_axis.unit_size,
                               color=col, stroke_width=2.2, stroke_opacity=0.85).move_to(ax.c2p(0, 0))
                       for c, col in zip(levels, color_gradient(["#2B4C8C", BLUE, TEAL, GREEN], len(levels)))])
        return ax, ell

    def valley(self):
        rule = VGroup(M(r"\eta \;<\; \frac{2}{L}", size=72, color=YELLOW),
                      T("L：曲线最大的弯曲程度", 28, DIM)).arrange(DOWN, buff=0.3).move_to([-3.4, 0.6, 0])
        ax = Axes(x_range=[0, 10], y_range=[0, 10], x_length=4.6, y_length=3.2,
                  axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).move_to([3.3, 0.3, 0])
        lossx = np.linspace(0, 10, 120)
        lossy = np.where(lossx < 6.5, 6 * np.exp(-0.35 * lossx) + 1, 6 * np.exp(-0.35 * 6.5) + 1 + 0.12 * np.exp(1.25 * (lossx - 6.5)))
        lossy = np.minimum(lossy, 9.8)
        lc = VMobject(stroke_color=BLUE, stroke_width=4).set_points_smoothly([ax.c2p(a, b) for a, b in zip(lossx, lossy)])
        nan = T("损失突然暴涨", 28, RED, weight=BOLD).next_to(ax.c2p(8.6, 9.8), UP, buff=0.15)
        tip = T("先把学习率调小", 30, YELLOW, weight=BOLD).next_to(ax, DOWN, buff=0.4)
        cap = T("训练曲线", 24, DIM).next_to(ax, UP, buff=0.2).shift(LEFT * 1.2)
        with self.say("s3_09") as d:
            self.play(Write(rule[0]), run_time=1.4)
            self.play(FadeIn(rule[1]), run_time=0.8)
            self.wait(d * 0.18)
            self.play(Create(ax), FadeIn(cap), run_time=0.8)
            self.play(Create(lc), run_time=3.0, rate_func=linear)
            self.play(FadeIn(nan, scale=1.2), run_time=0.6)
            self.play(FadeIn(tip, shift=UP * 0.2), run_time=0.8)
        self.clear_all()

        ax, ell = self.valley_axes()
        self.vax, self.vell = ax, ell
        title = T("狭长的山谷", 36, INK, weight=BOLD).to_edge(UP, buff=0.5)
        f = M(r"f(x,y) = x^2 + 10\,y^2", size=40).next_to(title, DOWN, buff=0.2)
        steep = label_box(T("这个方向很陡", 26, ORANGE), buff=0.1).next_to(ax.c2p(0, 2.1), RIGHT, buff=0.2)
        flat = label_box(T("这个方向很平缓", 26, TEAL), buff=0.1).next_to(ax.c2p(-6.6, 0), UP, buff=0.35)
        a1 = DoubleArrow(ax.c2p(0, -1.5), ax.c2p(0, 1.5), color=ORANGE, buff=0, stroke_width=3, tip_length=0.16)
        a2 = DoubleArrow(ax.c2p(-7.0, 0), ax.c2p(7.0, 0), color=TEAL, buff=0, stroke_width=3, tip_length=0.16)
        with self.say("s3_10") as d:
            self.play(FadeIn(title), Write(f), LaggedStart(*[Create(e) for e in ell], lag_ratio=0.1), run_time=2.2)
            self.wait(d * 0.15)
            self.play(GrowFromCenter(a1), FadeIn(steep), run_time=1.0)
            self.play(GrowFromCenter(a2), FadeIn(flat), run_time=1.0)
        self.play(FadeOut(VGroup(a1, a2, steep, flat)), run_time=0.5)

        P = valley_path(10, (-8.0, 1.6), 35, eta=0.09)
        self.gd_path = P
        dots = VGroup(*[Dot(ax.c2p(*p), radius=0.05, color=ORANGE) for p in P])
        segs = VGroup(*[Line(ax.c2p(*P[i]), ax.c2p(*P[i + 1]), color=ORANGE, stroke_width=3) for i in range(len(P) - 1)])
        garrs = VGroup()
        for i in (0, 1, 2):
            g = np.array([2 * P[i][0], 20 * P[i][1]])
            u = -g / np.linalg.norm(g)
            a = ax.c2p(*P[i])
            garrs.add(Arrow(a, a + np.array([u[0], u[1], 0]) * 1.1, buff=0, color=YELLOW, stroke_width=5,
                            max_tip_length_to_length_ratio=0.25))
        wall = label_box(T("梯度几乎指向侧壁，而不是谷底", 28, YELLOW), buff=0.12).next_to(ax.c2p(-4.5, -2.4), DOWN, buff=0.1)
        with self.say("s3_11") as d:
            self.play(FadeIn(dots[0]), run_time=0.4)
            for i in range(6):
                self.play(Create(segs[i]), FadeIn(dots[i + 1]), run_time=0.55)
            self.play(LaggedStart(*[GrowArrow(a) for a in garrs], lag_ratio=0.3), FadeIn(wall), run_time=1.6)
            self.wait(d * 0.12)
            self.play(LaggedStart(*[AnimationGroup(Create(s), FadeIn(dt)) for s, dt in zip(segs[6:], dots[7:])],
                                  lag_ratio=1.0), FadeOut(garrs), run_time=d * 0.35)
        self.gd_mobs = VGroup(dots, segs)
        kap = VGroup(M(r"\kappa \;=\; \frac{L}{\mu}", size=56, color=YELLOW),
                     T("最陡 ÷ 最平缓的弯曲程度", 26, DIM)).arrange(DOWN, buff=0.15)
        kap = label_box(kap, buff=0.2).to_corner(UL, buff=0.35)
        bars = VGroup()
        data = [(10, 35), (100, 346), (1000, 3454)]
        for i, (k, n) in enumerate(data):
            h = 0.35 + 1.5 * math.log10(n) / math.log10(3454)
            r = Rectangle(width=0.7, height=h, stroke_width=0, fill_color=ORANGE, fill_opacity=0.85)
            r.move_to([3.4 + i * 1.25, -2.6 + h / 2, 0])
            bars.add(VGroup(r, M(str(n), size=30).next_to(r, UP, buff=0.08), M(r"\kappa=%d" % k, size=28, color=DIM).next_to(r, DOWN, buff=0.1)))
        bt = T("步数（对数刻度）", 24, DIM).next_to(bars, UP, buff=0.15)
        bars = label_box(VGroup(bars, bt), buff=0.25, opacity=0.94)
        bt = VMobject()
        with self.say("s3_12") as d:
            self.play(FadeOut(wall), FadeOut(title), FadeOut(f), FadeIn(kap, shift=DOWN * 0.2), run_time=1.2)
            self.wait(d * 0.15)
            self.play(FadeIn(bars[0]), FadeIn(bars[1][1]), LaggedStart(*[GrowFromEdge(b, DOWN) for b in bars[1][0]], lag_ratio=0.4),
                      run_time=2.4)
            self.wait(d * 0.1)
        circles = VGroup(*[Circle(radius=e.width / 2 * 0.36, color=e.get_color(), stroke_width=2.2, stroke_opacity=0.85
                                  ).move_to(ax.c2p(0, 0)) for e in ell])
        start = ax.c2p(-2.2, 1.7)
        shot = Arrow(start, ax.c2p(0, 0), buff=0.05, color=TEAL, stroke_width=6, max_tip_length_to_length_ratio=0.12)
        sd = Dot(start, color=TEAL, radius=0.08)
        norm = label_box(VGroup(T("特征缩放到相近的尺度", 30, TEAL, weight=BOLD), T("山谷变圆，梯度直指谷底", 26, INK)
                                ).arrange(DOWN, buff=0.12), buff=0.2).to_corner(UR, buff=0.45)
        with self.say("s3_13") as d:
            self.play(FadeOut(VGroup(bars, bt, kap, self.gd_mobs)), run_time=0.8)
            self.play(Transform(ell, circles), run_time=2.2)
            self.play(FadeIn(sd), GrowArrow(shot), FadeIn(norm, shift=DOWN * 0.2), run_time=1.4)
        self.play(FadeOut(VGroup(shot, sd, norm)), run_time=0.5)
        ax2, ell2 = self.valley_axes()
        self.play(Transform(ell, ell2), run_time=1.2)
        self.gd_mobs.set_opacity(0.35)

    def momentum(self):
        ax = self.vax
        H = valley_path(10, (-8.0, 1.6), 20, eta=0.09, beta=0.35)   # 15 步把函数值降到百万分之一
        hb = VMobject(stroke_color=TEAL, stroke_width=5).set_points_as_corners([ax.c2p(*p) for p in H])
        ball = Circle(radius=0.16, color=TEAL, fill_opacity=1, stroke_color=INK, stroke_width=2).move_to(ax.c2p(*H[0])).set_z_index(5)
        title = label_box(VGroup(T("动量法", 36, TEAL, weight=BOLD), T("给小球加上质量", 26, DIM)).arrange(DOWN, buff=0.1),
                          buff=0.2).to_corner(UL, buff=0.4)
        eq = label_box(VGroup(M(r"v_{k+1} = \beta\, v_k + \nabla f(x_k)", size=36),
                              M(r"x_{k+1} = x_k - \eta\, v_{k+1}", size=36)).arrange(DOWN, buff=0.12), buff=0.18).to_corner(UR, buff=0.4)
        gd_ghost = self.gd_mobs.copy().set_opacity(0.35)
        with self.say("s3_14") as d:
            self.play(FadeIn(gd_ghost), FadeIn(title, shift=DOWN * 0.2), run_time=1.0)
            self.play(FadeIn(eq), FadeIn(ball), run_time=1.0)
            self.wait(d * 0.12)
            self.play(Create(hb), MoveAlongPath(ball, hb), run_time=d * 0.62, rate_func=rate_functions.ease_in_out_sine)
        c1 = VGroup(T("梯度下降", 30, ORANGE), M(r"35", size=48, color=ORANGE), T("步", 30, ORANGE)).arrange(RIGHT, buff=0.2)
        c2 = VGroup(T("动量法", 30, TEAL), M(r"15", size=48, color=TEAL), T("步", 30, TEAL)).arrange(RIGHT, buff=0.2)
        cnt = label_box(VGroup(c1, c2).arrange(DOWN, aligned_edge=LEFT, buff=0.15), buff=0.2).move_to([0.6, 2.55, 0])
        c3 = label_box(VGroup(M(r"\kappa = 100:", size=40), M(r"346", size=44, color=ORANGE), M(r"\text{ vs. }", size=36),
                              M(r"58", size=44, color=TEAL)).arrange(RIGHT, buff=0.2), buff=0.2).move_to([4.7, 2.55, 0])
        sub = T("函数值缩小一百万倍所需步数", 22, DIM).next_to(cnt, UP, buff=0.12)
        with self.say("s3_15") as d:
            self.play(FadeOut(eq), FadeIn(cnt, shift=UP * 0.2), FadeIn(sub), run_time=1.2)
            self.wait(d * 0.35)
            self.play(FadeIn(c3, shift=UP * 0.2), run_time=1.0)
        self.clear_all()

    def sgd(self):
        ax = Axes(x_range=[-5, 5], y_range=[-3, 3], x_length=7.6, y_length=7.6 * 0.6,
                  axis_config={"stroke_opacity": 0, "include_tip": False, "include_ticks": False}).move_to([-2.6, 0.1, 0])
        f = lambda x, y: 0.5 * x ** 2 + 1.2 * y ** 2
        levels = [0.3, 1.2, 2.7, 4.8, 7.5, 10.8]
        rings = VGroup(*[Ellipse(width=2 * math.sqrt(c / 0.5) * ax.x_axis.unit_size, height=2 * math.sqrt(c / 1.2) * ax.y_axis.unit_size,
                                 color=col, stroke_width=2, stroke_opacity=0.8).move_to(ax.c2p(0, 0))
                         for c, col in zip(levels, color_gradient(["#2B4C8C", BLUE, TEAL, GREEN], len(levels)))])
        rng = np.random.default_rng(7)
        p = np.array([-4.4, 2.3])
        P = [p.copy()]
        for _ in range(26):
            g = np.array([p[0], 2.4 * p[1]]) + rng.normal(0, 0.9, 2)
            p = p - 0.22 * g
            P.append(p.copy())
        path = VMobject(stroke_color=YELLOW, stroke_width=3).set_points_as_corners([ax.c2p(*q) for q in P])
        ball = Dot(ax.c2p(*P[0]), color=YELLOW, radius=0.1).set_z_index(4)
        # 右侧：数据集与随机小批
        grid = VGroup(*[Dot([3.0 + (i % 12) * 0.3, 1.5 - (i // 12) * 0.3, 0], radius=0.06, color=FAINT) for i in range(96)])
        dl = T("全部数据：几百万条", 26, DIM).next_to(grid, UP, buff=0.25)
        bl = T("每一步只随机抽一小批", 26, YELLOW).next_to(grid, DOWN, buff=0.25)
        ttl = label_box(T("随机梯度下降", 34, YELLOW, weight=BOLD), buff=0.15).to_corner(UL, buff=0.4)
        with self.say("s3_16") as d:
            self.play(FadeIn(rings), FadeIn(ttl), FadeIn(grid), FadeIn(dl), run_time=1.2)
            self.play(FadeIn(ball), FadeIn(bl), run_time=0.6)
            per = (d * 0.55) / (len(P) - 1)
            for i in range(len(P) - 1):
                pick = rng.choice(96, 8, replace=False)
                hi = VGroup(*[grid[j].copy().set_color(YELLOW).scale(1.5) for j in pick])
                seg = Line(ax.c2p(*P[i]), ax.c2p(*P[i + 1]), color=YELLOW, stroke_width=3)
                self.add(hi)
                self.play(Create(seg), ball.animate.move_to(ax.c2p(*P[i + 1])), run_time=per, rate_func=linear)
                self.remove(hi)
            self.play(FadeOut(VGroup(*[m for m in self.mobjects if m is not ttl])), run_time=0.8)
            # 鞍点：梯度下降停住，随机梯度被噪声推下去
            sx = Axes(x_range=[-2, 2], y_range=[-2, 2], x_length=4.4, y_length=4.4, axis_config={"stroke_opacity": 0, "include_tip": False, "include_ticks": False}).move_to([0, -0.2, 0])
            hyp = VGroup()       # f = x^2 - y^2 的等高线：青色是低处，橙色是高处
            for c in (0.4, 1.0, 1.8):
                for s in (1, -1):
                    hyp.add(ParametricFunction(lambda t, c=c, s=s: sx.c2p(t, s * math.sqrt(t * t + c)), t_range=[-1.5, 1.5],
                                               color=TEAL, stroke_width=2, stroke_opacity=0.7))
                    hyp.add(ParametricFunction(lambda t, c=c, s=s: sx.c2p(s * math.sqrt(t * t + c), t), t_range=[-1.5, 1.5],
                                               color=ORANGE, stroke_width=2, stroke_opacity=0.7))
            cap = label_box(T("鞍点：梯度为零，普通梯度下降停在这里", 26, INK), buff=0.12).next_to(sx, UP, buff=0.05)
            b2 = Dot(sx.c2p(0, 0), color=YELLOW, radius=0.11).set_z_index(4)
            self.play(FadeIn(hyp), FadeIn(cap), FadeIn(b2), run_time=1.0)
            jit = [(0.05, 0.08), (-0.06, 0.2), (0.04, 0.45), (-0.03, 0.8), (0.02, 1.3), (0.0, 1.85)]
            self.play(Succession(*[b2.animate.move_to(sx.c2p(*q)) for q in jit]), run_time=max(d * 0.45 - 4.2, 1.5))
            esc = label_box(T("噪声把它推了下去", 26, YELLOW), buff=0.1).next_to(sx, RIGHT, buff=0.3)
            self.play(FadeIn(esc), run_time=0.6)
        self.clear_all()

        parts = [("动量", TEAL), ("随机梯度", YELLOW), ("自适应步长", PURPLE)]
        cards = VGroup(*[label_box(T(a, 34, c, weight=BOLD), buff=0.35).set_stroke(c, 2) for a, c in parts])
        for c in cards:
            c[0].set_stroke(c[1].get_color(), 2)
        row = VGroup(cards[0], M("+", size=56), cards[1], M("+", size=56), cards[2]).arrange(RIGHT, buff=0.35).shift(UP * 0.5)
        res = VGroup(M(r"\Longrightarrow", size=56), T("Adam / AdamW", 40, INK, font=SANS, weight=BOLD)).arrange(RIGHT, buff=0.35)
        res.next_to(row, DOWN, buff=0.7)
        cap = T("今天训练大模型最常用的优化器", 26, DIM).next_to(res, DOWN, buff=0.25)
        with self.say("s3_17") as d:
            self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.2) for m in row], lag_ratio=0.3), run_time=2.6)
            self.wait(d * 0.12)
            self.play(FadeIn(res, shift=UP * 0.2), FadeIn(cap), run_time=1.2)
        self.clear_all()

    def newton(self):
        ax = Axes(x_range=[-2.2, 3.2], y_range=[-0.5, 6], x_length=8.2, y_length=4.6,
                  axis_config={"color": FAINT, "include_ticks": False, "include_tip": False}).move_to([-1.6, -0.5, 0])
        f = lambda x: 0.04 * x ** 4 + 0.35 * x ** 2 - 0.6 * x + 1.0
        d1 = lambda x: 0.16 * x ** 3 + 0.7 * x - 0.6
        d2 = lambda x: 0.48 * x ** 2 + 0.7
        c = ax.plot(f, x_range=[-2.0, 3.0, 0.01], color=BLUE, stroke_width=5)
        ttl = label_box(VGroup(T("牛顿法", 36, PURPLE, weight=BOLD), T("用一只碗贴合函数，直接跳到碗底", 26, INK)
                               ).arrange(DOWN, buff=0.12), buff=0.2).to_corner(UL, buff=0.4)
        x = 2.8
        with self.say("s3_18") as d:
            self.play(Create(ax), Create(c), FadeIn(ttl), run_time=1.4)
            dot = Dot(ax.c2p(x, f(x)), color=YELLOW, radius=0.1).set_z_index(4)
            self.play(FadeIn(dot), run_time=0.4)
            for k in range(3):
                q = lambda t, x=x: f(x) + d1(x) * (t - x) + 0.5 * d2(x) * (t - x) ** 2
                xn = x - d1(x) / d2(x)
                span = 1.9 / math.sqrt(d2(x))
                para = ax.plot(q, x_range=[max(-2.0, xn - span * 1.6), min(3.1, xn + span * 1.6), 0.01], color=PURPLE, stroke_width=3.5)
                self.play(Create(para), run_time=1.0)
                self.play(dot.animate.move_to(ax.c2p(xn, q(xn))), run_time=0.7)
                self.play(dot.animate.move_to(ax.c2p(xn, f(xn))), FadeOut(para), run_time=0.6)
                x = xn
            fast = label_box(T("几步就收敛", 28, YELLOW, weight=BOLD), buff=0.12).next_to(dot, UP, buff=0.4)
            self.play(FadeIn(fast), run_time=0.6)
            self.wait(d * 0.05)
            mat = label_box(VGroup(T("曲率矩阵", 30, PURPLE, weight=BOLD), M(r"n \times n", size=44),
                                   M(r"n = 10^{9} \;\Rightarrow\; 10^{18}", size=40), T("个数，根本存不下", 26, RED)
                                   ).arrange(DOWN, buff=0.18), buff=0.3).move_to([4.6, 0.0, 0])
            self.play(FadeIn(mat, shift=LEFT * 0.3), run_time=1.2)
        self.clear_all()

    def summary(self):
        def panel(fn, col, txt, xr=(-3, 3)):
            ax = Axes(x_range=[*xr], y_range=[0, 3.4], x_length=3.6, y_length=2.4,
                      axis_config={"color": FAINT, "include_ticks": False, "include_tip": False})
            g = ax.plot(fn, x_range=[*xr, 0.01], color=col, stroke_width=4)
            t = T(txt, 26, col, weight=BOLD).next_to(ax, DOWN, buff=0.3)
            return VGroup(ax, g, t)

        p1 = panel(lambda x: 0.3 * x ** 2 + 0.3, TEAL, "凸的碗：保证到达全局最低")
        p2 = panel(lambda x: 0.12 * x ** 2 + 0.5 * np.sin(2.3 * x) + 0.3 * np.cos(4.1 * x) + 1.4, ORANGE, "非凸：只能尽力而为")
        ax3 = Axes(x_range=[-1, 1], y_range=[-1, 1], x_length=3.6, y_length=2.4, axis_config={"stroke_opacity": 0, "include_tip": False, "include_ticks": False})
        e3 = VGroup(*[Ellipse(width=3.4 * s, height=0.55 * s, color=BLUE, stroke_width=2, stroke_opacity=0.8) for s in (0.35, 0.65, 1.0)])
        zz = VMobject(stroke_color=YELLOW, stroke_width=2.5).set_points_as_corners(
            [[-1.5 + i * 0.25, 0.22 * (-1) ** i * (0.85 ** i), 0] for i in range(13)])
        p3 = VGroup(ax3, VGroup(e3, zz).move_to(ax3), T("快慢：由山谷的形状决定", 26, BLUE, weight=BOLD).next_to(ax3, DOWN, buff=0.3))
        row = VGroup(p1, p2, p3).arrange(RIGHT, buff=0.7).shift(UP * 0.2)
        with self.say("s3_19", tail=1.0) as d:
            for p in row:
                self.play(FadeIn(p, shift=UP * 0.3), run_time=1.0)
                self.wait(d * 0.15)
        self.clear_all(0.9)
