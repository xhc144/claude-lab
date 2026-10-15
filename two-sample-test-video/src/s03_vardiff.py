"""03 相减，抖得更厉害（σ 已知，Z 检验）"""
from common import *


class Jitter:
    """三条数轴：两个独立抖动的平均分，以及它们的差；每条轴上方累积直方图。"""

    RATE = 10          # 每秒采样次数
    EXTRA = 4          # 每次采样额外累积的隐藏样本，让直方图更快成形
    BW = 0.5
    LO, HI = -4.5, 4.5

    def __init__(self, rows=(1.75, 0.1, -1.55), x0=-4.2, length=9.0, seed=2):
        self.rows = rows
        self.x0, self.length = x0, length
        rng = np.random.default_rng(seed)
        n = 400
        self.X = rng.normal(0, 1, n)
        self.Y = rng.normal(0, 1, n)
        self.hx = rng.normal(0, 1, (n, self.EXTRA))
        self.hy = rng.normal(0, 1, (n, self.EXTRA))
        self.edges = np.arange(self.LO, self.HI + 1e-9, self.BW)
        self.counts = np.zeros((3, len(self.edges) - 1))
        self.n = 0
        self.t = 0.0

    def px(self, v):
        return self.x0 + (v - self.LO) / (self.HI - self.LO) * self.length

    def lines(self):
        cols = (BLUE, ORANGE, GOLD)
        g = VGroup()
        for y, c in zip(self.rows, cols):
            g.add(Line([self.px(self.LO), y, 0], [self.px(self.HI), y, 0], color=LINE, stroke_width=2))
            g.add(Line([self.px(0), y - 0.08, 0], [self.px(0), y + 0.08, 0], color=LINE, stroke_width=2))
        return g

    def labels(self):
        xs = self.px(self.LO) - 0.45
        a = tex(r"\bar X", size=46, color=BLUE)
        b = tex(r"\bar Y", size=46, color=ORANGE)
        c = tex(r"\bar X-\bar Y", size=46, color=GOLD)
        for m, y in zip((a, b, c), self.rows):
            m.move_to([xs, y + 0.25, 0], aligned_edge=RIGHT)
        return VGroup(a, b, c)

    def value(self, t):
        """平滑插值后的当前位置。"""
        k = t * self.RATE
        i = int(k)
        f = k - i
        s = (1 - np.cos(PI * f)) / 2
        x = self.X[i] * (1 - s) + self.X[i + 1] * s
        y = self.Y[i] * (1 - s) + self.Y[i + 1] * s
        return x, y

    def advance(self, t):
        upto = int(t * self.RATE)
        while self.n < upto:
            i = self.n
            xs = np.concatenate([[self.X[i]], self.hx[i]])
            ys = np.concatenate([[self.Y[i]], self.hy[i]])
            for r, v in enumerate((xs, ys, xs - ys)):
                h, _ = np.histogram(v, self.edges)
                self.counts[r] += h
            self.n += 1

    def bars(self, H=2.3):
        g = VGroup()
        cols = (BLUE, ORANGE, GOLD)
        total = max(1, self.n * (1 + self.EXTRA))
        for r, (y, c) in enumerate(zip(self.rows, cols)):
            dens = self.counts[r] / (total * self.BW)
            for j, dv in enumerate(dens):
                if dv <= 0:
                    continue
                x0 = self.px(self.edges[j]) + 0.02
                x1 = self.px(self.edges[j + 1]) - 0.02
                g.add(Rectangle(width=x1 - x0, height=dv * H, stroke_width=0, fill_color=c, fill_opacity=0.28)
                      .move_to([(x0 + x1) / 2, y + dv * H / 2, 0]))
        return g

    def curves(self, H=2.3):
        g = VGroup()
        for y, c, sd in zip(self.rows, (BLUE, ORANGE, GOLD), (1, 1, np.sqrt(2))):
            xs = np.linspace(self.LO, self.HI, 200)
            pts = [[self.px(x), y + stats.norm.pdf(x, 0, sd) * H, 0] for x in xs]
            m = VMobject(color=c, stroke_width=3)
            m.set_points_smoothly(pts)
            g.add(DashedVMobject(m, num_dashes=50))
        return g


class VarDiff(VScene):
    header = "σ 已知 · 两个均值的 Z 检验"

    def construct(self):
        J = Jitter()
        lines, labels = J.lines(), J.labels()
        clock = ValueTracker(0)

        def dots():
            x, y = J.value(clock.get_value())
            a = Dot([J.px(x), J.rows[0], 0], radius=0.11, color=BLUE)
            b = Dot([J.px(y), J.rows[1], 0], radius=0.11, color=ORANGE)
            c = Dot([J.px(x - y), J.rows[2], 0], radius=0.11, color=GOLD)
            band = Line(a.get_center(), b.get_center(), color=GOLD, stroke_width=2.5).set_opacity(0.7)
            return VGroup(band, a, b, c).set_z_index(3)

        moving = always_redraw(dots)
        with self.say("c01") as d:
            self.play(Create(lines), FadeIn(labels), run_time=1.4)
            self.play(FadeIn(moving), run_time=0.6)
        q = self.pause_q("两个都在抖的数，相减以后：更稳？还是更晃？")

        hist = VGroup()
        self.add(hist)

        def tick(m, dt):
            clock.increment_value(dt)
            J.advance(clock.get_value())
            hist.become(J.bars())

        clock.add_updater(tick)
        self.add(clock)
        with self.say("c02") as d:
            self.play(FadeOut(q), run_time=0.5)
        self.line("c03")
        self.line("c04")
        self.wait(1.0)
        clock.clear_updaters()
        curves = J.curves()
        self.play(Create(curves), run_time=1.2)
        self.wait(0.8)

        # 方差分解
        f = tex(r"\operatorname{Var}(\bar X-\bar Y)", "=", r"\operatorname{Var}(\bar X)", "+",
                r"\operatorname{Var}(\bar Y)", r"-2\operatorname{Cov}(\bar X,\bar Y)", size=56)
        f[0].set_color(GOLD); f[2].set_color(BLUE); f[4].set_color(ORANGE)
        f.move_to(UP * 1.2)
        self.play(FadeOut(VGroup(lines, labels, moving, hist, curves)), run_time=0.8)
        self.play(Write(f[0:2]), run_time=0.9)
        self.play(Write(f[2:4]), run_time=0.7)
        self.play(Write(f[4]), run_time=0.6)
        self.play(Write(f[5]), run_time=0.8)
        with self.say("c05") as d:
            self.play(Indicate(f[5], color=INK, scale_factor=1.08), run_time=1.0)
            zero = tex(r"=0", size=40, color=SOFT).next_to(f[5], DOWN, buff=0.3)
            self.wait(d * 0.3)
            self.play(FadeIn(zero, shift=UP * 0.1), run_time=0.6)
        ghost = make_ghost()
        with self.say("c06") as d:
            self.play(FadeOut(zero), run_time=0.4)
            self.play(Transform(f[5], ghost), f[0:5].animate.move_to(UP * 1.6), run_time=1.6)
        self.remove(f[5])
        self.add(ghost)

        # 平均越多越稳
        ax = dist_axes(-3, 3, 1, width=7, height=2.0, ymax=1.0).move_to(DOWN * 1.35 + RIGHT * 1.2)
        n = ValueTracker(1)
        bell = always_redraw(lambda: pdf_curve(
            ax, lambda x: np.exp(-0.5 * (x * np.sqrt(n.get_value())) ** 2) * 0.95, -3, 3, INK, 3.5, n=300))
        who = zh("一个学生的分数", 28, SOFT).next_to(ax, UP, buff=0.15).align_to(ax, LEFT)
        who2 = zh("40 个人的平均分", 28, SOFT).move_to(who, aligned_edge=LEFT)
        ntext = always_redraw(lambda: tex(rf"n={int(round(n.get_value()))}", size=40, color=SOFT)
                              .next_to(ax, RIGHT, buff=0.4).shift(UP * 0.8))
        vx = tex(r"\operatorname{Var}(\bar X)=\frac{\sigma^2}{n}", size=48).next_to(ax, LEFT, buff=0.6).shift(UP * 0.4)
        with self.say("c07") as d:
            self.play(Create(ax), Create(bell), FadeIn(ntext), FadeIn(who), run_time=1.0)
            self.play(n.animate.set_value(40), Transform(who, who2), run_time=d * 0.5, rate_func=rate_functions.ease_in_out_sine)
            self.play(FadeIn(vx), run_time=0.6)

        f2 = tex(r"\operatorname{Var}(\bar X-\bar Y)", "=", r"\frac{\sigma_1^2}{n_1}", "+", r"\frac{\sigma_2^2}{n_2}", size=56)
        f2[0].set_color(GOLD); f2[2].set_color(BLUE); f2[4].set_color(ORANGE)
        f2.move_to(UP * 1.6)
        with self.say("c08") as d:
            self.play(FadeOut(VGroup(ax, bell, ntext, vx, who)), run_time=0.6)
            self.play(*[ReplacementTransform(f[i], f2[i]) for i in range(5)], run_time=1.4)

        known = VGroup(zh("往年经验", 28, SOFT), tex(r"\sigma_1=\sigma_2=10", size=46)).arrange(RIGHT, buff=0.35)
        known.next_to(f2, DOWN, buff=0.7)
        tag = zh("方差已知", 26, GOLD).next_to(known, RIGHT, buff=0.5)
        with self.say("c09") as d:
            self.play(FadeIn(known, shift=UP * 0.1), run_time=0.9)
        with self.say("c10") as d:
            self.play(FadeIn(tag), run_time=0.6)

        z = tex(r"Z", "=", r"\frac{\bar X-\bar Y}{\sqrt{\sigma_1^2/n_1+\sigma_2^2/n_2}}", "=",
                r"\frac{3.3}{\sqrt{100/40+100/40}}", "=", r"\frac{3.3}{2.24}", r"\approx", "1.48", size=46)
        z.move_to(UP * 2.0)
        z[2].set_color(INK)
        with self.say("c11") as d:
            self.play(FadeOut(VGroup(f2, known, tag)), run_time=0.6)
            self.play(Write(z[0:3]), run_time=1.0)
            self.play(Write(z[3:5]), run_time=d * 0.35)
            self.play(Write(z[5:7]), run_time=0.8)
            self.play(Write(z[7:9]), run_time=0.6)
        z[8].set_color(GOLD)

        ax = dist_axes(-4, 4, 1, width=10, height=2.6, ymax=0.42, numbers=[-1.96, 0, 1.96]).move_to(DOWN * 0.9)
        curve = pdf_curve(ax, normal_pdf, -4, 4)
        rej = reject_regions(ax, normal_pdf, -1.96, 1.96, -4, 4)
        note = zh("两个正态总体相互独立 ⇒ 差仍服从正态 ⇒ Z ~ N(0, 1)；α = 0.05，双侧", 22, SOFT)
        note.to_corner(DR, buff=0.5).shift(UP * 0.55)
        mk = marker(ax, 1.48, GOLD)
        with self.say("c12") as d:
            self.play(Create(ax), Create(curve), FadeIn(note), run_time=1.0)
            self.play(FadeIn(rej), run_time=0.5)
            mk.shift(UP * 2.2)
            self.add(mk)
            self.play(mk.animate.shift(DOWN * 2.2), run_time=0.8, rate_func=rate_functions.ease_in_quad)
        self.line("c13")
        pa = VGroup(area_under(ax, normal_pdf, 1.48, 4, GOLD, 0.35), area_under(ax, normal_pdf, -4, -1.48, GOLD, 0.35))
        plab = VGroup(tex(r"p\approx 0.14", size=44, color=GOLD), zh("约每七次一次", 26, GOLD)).arrange(DOWN, buff=0.15)
        plab.move_to(ax.c2p(3.0, 0.26))
        with self.say("c14") as d:
            self.wait(d * 0.45)
            self.play(FadeIn(pa), run_time=0.8)
            self.play(FadeIn(plab), run_time=0.6)
        self.line("c15", gap=0.8)
        self.play(FadeOut(VGroup(z, ax, curve, rej, note, mk, pa, plab)), run_time=1.0)
        self.wait(0.4)
