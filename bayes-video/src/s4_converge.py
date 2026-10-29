from common import *
from data import A0, B0, CHECKS, FAN, FLAT, SEASON_H, SEASON_N, beta_pdf, checks_at

PEOPLE = [("联盟先验", (A0, B0), AMBER), ("平的先验", FLAT, VIOLET), ("球迷", FAN, RED)]


def params(prior, n):
    h = checks_at(n)
    return prior[0] + h, prior[1] + n - h


class Converge(VScene):
    header = "04 · 数据越多，先验越轻"

    def construct(self):
        ax, labs = theta_axes(w=10.4, h=3.9, center=DOWN * 0.65, y_max=1.0)
        n = ValueTracker(0)
        xs = np.linspace(0.001, 0.999, 400)

        def scale():
            peak = max(float(np.max(beta_pdf(xs, *params(p, n.get_value())))) for _, p, _ in PEOPLE)
            return peak * 1.08

        def curves():
            s = scale()
            g = VGroup()
            for _, p, c in PEOPLE:
                a, b = params(p, n.get_value())
                g.add(neon_density(ax, lambda x, a=a, b=b: float(beta_pdf(x, a, b)) / s, c, width=3.5, fill=0.1))
            return g

        cur = always_redraw(curves)

        def legend_row(name, color):
            ln = glow(Line(ORIGIN, RIGHT * 0.5, color=color, stroke_width=4), layers=2)
            return VGroup(ln, zh(name, 24, color)).arrange(RIGHT, buff=0.15)

        rows = [legend_row(nm, c) for nm, _, c in PEOPLE]
        legend = VGroup(*rows).arrange(DOWN, buff=0.18, aligned_edge=LEFT).move_to(RIGHT * 5.2 + UP * 2.05)
        cnt = always_redraw(lambda: VGroup(
            zh("出手", 26, SOFT), Integer(round(n.get_value()), font_size=44, color=INK),
            zh("命中", 26, SOFT), Integer(round(checks_at(n.get_value())), font_size=44, color=INK),
        ).arrange(RIGHT, buff=0.18).move_to(LEFT * 3.6 + UP * 2.2))

        with self.say("c01") as d:
            self.play(Create(ax), FadeIn(labs), run_time=0.7)
            self.play(FadeIn(cnt), run_time=0.5)
        with self.say("c02") as d:
            self.add(cur)
            for r in rows:
                self.play(FadeIn(r, shift=LEFT * 0.2), run_time=0.45)
                self.wait(max(0.1, d * 0.22))
        with self.say("c03") as d:
            self.play(n.animate.set_value(30), run_time=min(3.0, d * 0.7), rate_func=rate_functions.ease_in_out_sine)
        with self.say("c04") as d:
            self.play(n.animate.set_value(150), run_time=min(3.5, d * 0.75), rate_func=rate_functions.ease_in_out_sine)
        with self.say("c05") as d:
            self.play(n.animate.set_value(600), run_time=min(4.0, d * 0.75), rate_func=rate_functions.ease_in_out_sine)
            band = BraceBetweenPoints(ax.c2p(0.36, 0) + DOWN * 0.42, ax.c2p(0.44, 0) + DOWN * 0.42, DOWN, color=AMBER)
            self.play(GrowFromCenter(band), run_time=0.5)

        # 似然越来越尖
        inset = Axes(x_range=[0, 1, 1], y_range=[0, 1.05, 1], x_length=3.4, y_length=1.5,
                     axis_config={"color": DIM, "stroke_width": 1.5, "include_tip": False},
                     y_axis_config={"stroke_opacity": 0})
        il = VGroup()
        for k, (nn, hh) in enumerate(CHECKS[1:]):
            pk = float(np.max(beta_pdf(xs, hh + 1, nn - hh + 1)))
            c = inset.plot(lambda x, nn=nn, hh=hh, pk=pk: float(beta_pdf(x, hh + 1, nn - hh + 1)) / pk,
                           x_range=[0.001, 0.999, 0.004], color=MAGENTA, stroke_width=2.5)
            c.set_stroke(opacity=0.35 + 0.65 * k / 3)
            il.add(c)
        it = zh("似然：6、30、150、600 投", 20, MAGENTA).next_to(inset, UP, buff=0.12)
        inset_g = VGroup(inset, il, it).move_to(LEFT * 3.9 + UP * 0.45)
        with self.say("c06") as d:
            self.play(cnt.animate.shift(UP * 0.0), FadeIn(inset), FadeIn(it), run_time=0.5)
            self.play(LaggedStart(*[Create(c) for c in il], lag_ratio=0.5), run_time=min(2.6, d * 0.6))

        # 三条后验均值随出手次数的变化
        self.play(FadeOut(inset_g), FadeOut(band), run_time=0.4)
        ch = Axes(x_range=[0, 4, 1], y_range=[0.35, 0.8, 0.1], x_length=4.4, y_length=2.2,
                  axis_config={"color": DIM, "stroke_width": 1.5, "include_tip": False, "tick_size": 0.04})
        ch.move_to(LEFT * 3.6 + UP * 0.75)
        ticks = VGroup(*[tex(str(v), size=20, color=SOFT).next_to(ch.c2p(i, 0.35), DOWN, buff=0.1)
                         for i, v in enumerate([0, 6, 30, 150, 600])])
        yl = VGroup(*[tex(f"{v:.1f}", size=20, color=SOFT).next_to(ch.c2p(0, v), LEFT, buff=0.1) for v in (0.4, 0.6, 0.8)])
        paths = VGroup()
        for _, p, c in PEOPLE:
            pts = []
            for i, (nn, hh) in enumerate(CHECKS):
                a, b = p[0] + hh, p[1] + nn - hh
                pts.append(ch.c2p(i, a / (a + b)))
            pl = VMobject(stroke_color=c, stroke_width=3).set_points_as_corners(pts)
            paths.add(VGroup(glow(pl, c, layers=2), *[Dot(q, radius=0.05, color=c) for q in pts]))
        ct = zh("后验均值", 20, SOFT).next_to(ch, UP, buff=0.1)
        with self.say("c07") as d:
            self.play(FadeOut(cnt), Create(ch), FadeIn(ticks), FadeIn(yl), FadeIn(ct), run_time=0.6)
            self.play(LaggedStart(*[Create(pth) for pth in paths], lag_ratio=0.3), run_time=min(2.8, d * 0.5))
            self.play(Indicate(paths[2], color=RED, scale_factor=1.05), Indicate(rows[2], color=RED), run_time=1.0)
        self.clear(run_time=0.7)

        # ---------------- Beta 分布：加上次数就行
        dens = tex(r"\mathrm{Beta}(a,\,b)", r":\quad", r"p(\theta)\;\propto\;\theta^{\,a-1}(1-\theta)^{\,b-1}", size=46)
        dens[0].set_color(CYAN)
        dens.move_to(UP * 1.9)
        with self.say("c08") as d:
            self.play(Write(dens), run_time=1.6)

        upd = tex(r"\theta^{\,a-1}(1-\theta)^{\,b-1}", r"\times", r"\theta^{\,h}(1-\theta)^{\,m}", r"=",
                  r"\theta^{\,a+h-1}(1-\theta)^{\,b+m-1}", size=42)
        upd[0].set_color(CYAN)
        upd[2].set_color(MAGENTA)
        upd[4].set_color(AMBER)
        upd.move_to(UP * 0.55)
        res = tex(r"\mathrm{Beta}(a,\,b)", r"\;\xrightarrow{\;h\text{ 中}\;m\text{ 不中}\;}\;", r"\mathrm{Beta}(a+h,\;b+m)", size=46)
        res[0].set_color(CYAN)
        res[2].set_color(AMBER)
        res.next_to(upd, DOWN, buff=0.5)
        with self.say("c09") as d:
            self.play(Write(upd), run_time=1.8)
            self.play(FadeIn(res, shift=UP * 0.15), run_time=0.9)
            self.add(boxed(res[2], AMBER))

        # 先验相当于事先看过的投篮
        self.play(FadeOut(VGroup(dens, upd)), *[FadeOut(m) for m in self.mobjects if m not in (self.hdr, res)],
                  res.animate.scale(0.8).to_edge(UP, buff=1.0), run_time=0.7)
        balls = VGroup(*[Circle(radius=0.1, stroke_color=CYAN, stroke_width=2,
                                fill_color=CYAN, fill_opacity=0.85 if k < A0 else 0.0) for k in range(A0 + B0)])
        balls.arrange_in_grid(2, 20, buff=0.12).move_to(UP * 0.35)
        bl = VGroup(tex(r"\mathrm{Beta}(15,\,25)", size=40, color=CYAN), zh("≈ 事先看过 40 投 15 中", 28, CYAN)).arrange(RIGHT, buff=0.3)
        bl.next_to(balls, UP, buff=0.35)
        with self.say("c10") as d:
            self.play(FadeIn(bl), run_time=0.6)
            self.play(LaggedStart(*[FadeIn(b, scale=0.4) for b in balls], lag_ratio=0.03), run_time=min(2.5, d * 0.45))

        calc = tex(r"\text{后验均值}", "=", r"{15+60", r"\over", r"40+150}", "=", r"{75", r"\over", r"190}",
                   r"\approx", r"0.395", size=46)
        calc[0].set_color(AMBER)
        calc[10].set_color(AMBER)
        calc.move_to(DOWN * 1.15)
        with self.say("c11") as d:
            self.play(Write(calc[:5]), run_time=1.2)
            self.wait(max(0.1, d * 0.2))
            self.play(Write(calc[5:]), run_time=1.2)

        # 加权平均：一根跷跷板
        self.play(FadeOut(VGroup(balls, bl, res)), calc.animate.scale(0.8).to_edge(UP, buff=1.0), run_time=0.6)
        nl = NumberLine(x_range=[0.36, 0.41, 0.01], length=10, color=DIM, include_numbers=False, tick_size=0.05)
        nl.move_to(DOWN * 1.35)
        nums = VGroup(*[tex(f"{v:.2f}", size=24, color=SOFT).next_to(nl.n2p(v), DOWN, buff=0.15)
                        for v in (0.36, 0.37, 0.38, 0.39, 0.40, 0.41)])
        w_p = Circle(radius=0.3 * np.sqrt(40 / 40), fill_color=CYAN, fill_opacity=0.7, stroke_color=CYAN, stroke_width=2)
        w_d = Circle(radius=0.3 * np.sqrt(150 / 40), fill_color=MAGENTA, fill_opacity=0.6, stroke_color=MAGENTA, stroke_width=2)
        w_p.next_to(nl.n2p(0.375), UP, buff=0.02)
        w_d.next_to(nl.n2p(0.40), UP, buff=0.02)
        lp = VGroup(zh("先验均值", 22, CYAN), tex("0.375", size=28, color=CYAN), zh("40 投", 22, CYAN)).arrange(DOWN, buff=0.06)
        ld = VGroup(zh("实际命中率", 22, MAGENTA), tex("0.400", size=28, color=MAGENTA), zh("150 投", 22, MAGENTA)).arrange(DOWN, buff=0.06)
        lp.next_to(w_p, UP, buff=0.15)
        ld.next_to(w_d, UP, buff=0.15)
        mean = 75 / 190
        fulcrum = Triangle(fill_color=AMBER, fill_opacity=1, stroke_width=0).scale(0.22).next_to(nl.n2p(mean), DOWN, buff=0.02)
        fl = VGroup(tex("0.395", size=32, color=AMBER), zh("后验均值", 22, AMBER)).arrange(DOWN, buff=0.06).next_to(fulcrum, DOWN, buff=0.1)
        wavg = tex(r"0.395", "=", r"\tfrac{40}{190}", r"\times 0.375", "+", r"\tfrac{150}{190}", r"\times 0.400", size=40)
        wavg[0].set_color(AMBER)
        wavg[2].set_color(CYAN)
        wavg[3].set_color(CYAN)
        wavg[5].set_color(MAGENTA)
        wavg[6].set_color(MAGENTA)
        wavg.next_to(calc, DOWN, buff=0.4)
        with self.say("c12") as d:
            self.play(Create(nl), FadeIn(nums), run_time=0.6)
            self.play(GrowFromCenter(w_p), FadeIn(lp), run_time=0.6)
            self.play(GrowFromCenter(w_d), FadeIn(ld), run_time=0.7)
            self.play(FadeIn(fulcrum, shift=UP * 0.2), FadeIn(fl), run_time=0.6)
            self.play(Write(wavg), run_time=1.4)
            self.add(glow(fulcrum.copy(), AMBER, layers=3))
        self.clear(run_time=0.8)
