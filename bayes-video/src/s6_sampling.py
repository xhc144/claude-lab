from common import *
from data import (AL_RANGE, BE_RANGE, DIST, MADE, beta_pdf, metropolis, post_grid)

CHAIN = metropolis()
BURN = 300
DEMO = range(520, 526)


def heat_rgba(v):
    """后验密度 → 霓虹色：深蓝 → 紫 → 品红 → 琥珀 → 白，越淡越透明。"""
    stops = np.array([[0.0, 6, 9, 19], [0.25, 70, 40, 160], [0.5, 200, 60, 200], [0.78, 255, 180, 70], [1.0, 255, 250, 235]])
    v = np.clip(v, 0, 1)
    rgb = np.stack([np.interp(v, stops[:, 0], stops[:, k]) for k in (1, 2, 3)], -1)
    a = np.clip(v ** 0.55 * 1.15, 0, 1) * 255
    return np.concatenate([rgb, a[..., None]], -1).astype(np.uint8)


class Sampling(VScene):
    header = "06 · 算不出来的时候：抽样"

    def construct(self):
        # 一个参数 → 很多参数
        a1 = Axes(x_range=[0, 1, 1], y_range=[0, 6, 6], x_length=3.6, y_length=1.8,
                  axis_config={"color": DIM, "stroke_width": 2, "include_tip": False},
                  y_axis_config={"stroke_opacity": 0}).move_to(LEFT * 3.4 + DOWN * 0.2)
        c1 = neon_density(a1, lambda x: float(beta_pdf(x, 20, 26)), AMBER, width=3)
        t1 = VGroup(zh("一个参数", 28, AMBER), tex(r"\theta", size=34, color=AMBER)).arrange(RIGHT, buff=0.15).next_to(a1, UP, buff=0.35)
        f1 = zh("后验有公式", 24, SOFT).next_to(a1, DOWN, buff=0.3)
        many = VGroup(*[tex(f"\\theta_{{{k}}}", size=32, color=VIOLET) for k in range(1, 7)], tex(r"\cdots", size=32, color=VIOLET))
        many.arrange_in_grid(2, 4, buff=0.35).move_to(RIGHT * 3.4 + DOWN * 0.2)
        t2 = zh("很多参数", 28, VIOLET).next_to(many, UP, buff=0.5)
        with self.say("m01") as d:
            self.play(Create(a1), Create(c1), FadeIn(t1), FadeIn(f1), run_time=1.2)
            self.wait(max(0.1, d * 0.3))
            self.play(LaggedStart(*[FadeIn(m, scale=0.5) for m in many], lag_ratio=0.12), FadeIn(t2), run_time=1.2)

        # 命中率随距离下降：逻辑回归
        self.clear(run_time=0.6)
        ax = Axes(x_range=[0, 9, 1], y_range=[0, 1, 0.5], x_length=6.2, y_length=3.2,
                  axis_config={"color": DIM, "stroke_width": 2, "include_tip": False, "tick_size": 0.05}).move_to(LEFT * 2.9 + DOWN * 0.6)
        xl = VGroup(*[tex(str(v), size=24, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.12) for v in (2, 4, 6, 8)])
        yl = VGroup(*[tex(str(v), size=24, color=SOFT).next_to(ax.c2p(0, v), LEFT, buff=0.12) for v in (0, 1)])
        xn = zh("投篮距离（米）", 22, SOFT).next_to(ax, DOWN, buff=0.5)
        rng = np.random.default_rng(8)
        pts = VGroup(*[Dot(ax.c2p(dd, m + (rng.uniform(-0.04, 0.04) if m else rng.uniform(0, 0.04))), radius=0.045,
                           color=GREEN if m else RED).set_opacity(0.8) for dd, m in zip(DIST, MADE)])
        al_m, be_m = np.array([s[3] for s in CHAIN[BURN:]]).mean(0)
        curve = glow(ax.plot(lambda x: 1 / (1 + np.exp(-(al_m + be_m * x))), x_range=[0.5, 9], color=AMBER, stroke_width=4), AMBER)
        model = tex(r"p(d)", "=", r"\frac{1}{1+e^{-(\alpha+\beta d)}}", size=40).move_to(RIGHT * 3.6 + UP * 1.2)
        model[0].set_color(AMBER)
        ab = VGroup(VGroup(tex(r"\alpha", size=40, color=CYAN), zh("截距", 26, CYAN)).arrange(RIGHT, buff=0.15),
                    VGroup(tex(r"\beta", size=40, color=MAGENTA), zh("斜率", 26, MAGENTA)).arrange(RIGHT, buff=0.15)).arrange(RIGHT, buff=0.7)
        ab.next_to(model, DOWN, buff=0.5)
        leg = VGroup(VGroup(Dot(color=GREEN, radius=0.06), zh("投进", 22, GREEN)).arrange(RIGHT, buff=0.1),
                     VGroup(Dot(color=RED, radius=0.06), zh("没进", 22, RED)).arrange(RIGHT, buff=0.1)).arrange(RIGHT, buff=0.4)
        leg.next_to(ax, UP, buff=0.25)
        with self.say("m02") as d:
            self.play(Create(ax), FadeIn(xl), FadeIn(yl), FadeIn(xn), run_time=0.7)
            self.play(LaggedStart(*[FadeIn(p, scale=0.4) for p in pts], lag_ratio=0.01), FadeIn(leg), run_time=1.4)
            self.play(Create(curve), Write(model), run_time=1.3)
            self.play(FadeIn(ab, shift=UP * 0.15), run_time=0.7)

        # 后验地形图
        self.clear(run_time=0.6)
        al, be, z = post_grid(480, 270)
        W, H = 7.4, 4.6
        pax = Axes(x_range=[AL_RANGE[0], AL_RANGE[1], 1], y_range=[BE_RANGE[0], BE_RANGE[1], 0.2], x_length=W, y_length=H,
                   axis_config={"color": DIM, "stroke_width": 1.5, "include_tip": False, "tick_size": 0.05})
        pax.move_to(LEFT * 2.35 + DOWN * 0.45)
        img = ImageMobject(heat_rgba(z[::-1])).stretch_to_fit_width(W).stretch_to_fit_height(H).move_to(pax)
        img.set_resampling_algorithm(RESAMPLING_ALGORITHMS["bilinear"])
        pxl = VGroup(*[tex(str(v), size=22, color=SOFT).next_to(pax.c2p(v, BE_RANGE[0]), DOWN, buff=0.1) for v in (0, 1, 2, 3, 4)])
        pyl = VGroup(*[tex(f"{v:.1f}", size=22, color=SOFT).next_to(pax.c2p(AL_RANGE[0], v), LEFT, buff=0.1) for v in (-0.8, -0.6, -0.4, -0.2, 0.0)])
        an = tex(r"\alpha", size=34, color=CYAN).next_to(pax, DOWN, buff=0.45)
        bn = tex(r"\beta", size=34, color=MAGENTA).next_to(pax, LEFT, buff=0.75)
        with self.say("m03") as d:
            self.play(Create(pax), FadeIn(pxl), FadeIn(pyl), FadeIn(an), FadeIn(bn), run_time=0.7)
            self.play(FadeIn(img), run_time=1.6)

        post = tex(r"p(\alpha,\beta\mid D)", "=", r"{p(D\mid\alpha,\beta)\,p(\alpha,\beta)", r"\over",
                   r"\iint p(D\mid\alpha,\beta)\,p(\alpha,\beta)\,d\alpha\,d\beta}", size=30)
        post[0].set_color(AMBER)
        post[4].set_color(RED)
        post.scale_to_fit_width(4.5).move_to(RIGHT * 4.45 + UP * 1.6)
        hard = zh("参数一多，算不出来", 24, RED).next_to(post, DOWN, buff=0.25)
        with self.say("m04") as d:
            self.play(Write(post), run_time=1.6)
            self.play(Circumscribe(post[4], color=RED), FadeIn(hard), run_time=1.0)

        mcmc = VGroup(neon("马尔可夫链蒙特卡洛", 30, CYAN), tex(r"\text{MCMC}", size=34, color=SOFT)).arrange(DOWN, buff=0.12)
        mcmc.move_to(RIGHT * 4.35 + DOWN * 0.3)
        with self.say("m05") as d:
            self.play(FadeIn(mcmc, scale=0.9), run_time=0.9)

        # 走几步：更高就走，更低按比值抽签
        p = lambda q: pax.c2p(q[0], q[1])
        walker = halo_dot(p(CHAIN[DEMO[0]][3]), WHITE_HOT, r=0.075, strength=0.3)
        verdict = VGroup()
        with self.say("m06") as d:
            self.play(FadeOut(VGroup(mcmc, hard)), post.animate.move_to(RIGHT * 4.45 + UP * 2.2), run_time=0.5)
            self.play(FadeIn(walker, scale=2), run_time=0.5)
            per = max(0.9, (d - 1.2) / len(DEMO))
            for i in DEMO:
                prop, ok, r, cur = CHAIN[i]
                arr = DashedLine(p(cur), p(prop), color=CYAN, stroke_width=2.5, dash_length=0.06)
                pd = Dot(p(prop), radius=0.06, color=CYAN)
                txt = (f"r = {min(r, 1):.2f}", "更高，走过去" if r >= 1 else ("抽中，走过去" if ok else "没抽中，留下"))
                v = VGroup(tex(txt[0], size=32, color=AMBER), zh(txt[1], 24, GREEN if ok else RED)).arrange(RIGHT, buff=0.25)
                v.move_to(RIGHT * 4.35 + DOWN * 0.4)
                self.play(Create(arr), FadeIn(pd), FadeOut(verdict), FadeIn(v), run_time=per * 0.45)
                if ok:
                    self.play(walker.animate.move_to(p(prop)), FadeOut(arr), FadeOut(pd), run_time=per * 0.4)
                else:
                    x = cross_mark(RED, 0.09).move_to(p(prop))
                    self.play(FadeIn(x), run_time=per * 0.2)
                    self.play(FadeOut(VGroup(arr, pd, x)), run_time=per * 0.2)
                verdict = v
            self.play(FadeOut(verdict), run_time=0.3)

        # 比值里分母约掉
        ratio = tex(r"r", "=", r"{p(\theta'\mid D)", r"\over", r"p(\theta\mid D)}", "=",
                    r"{p(D\mid\theta')\,p(\theta')\,/\,", r"P(D)", r"\over", r"p(D\mid\theta)\,p(\theta)\,/\,", r"P(D)}", size=34)
        ratio.move_to(RIGHT * 4.25 + DOWN * 0.2)
        ratio.scale_to_fit_width(min(ratio.width, 4.9))
        s1 = Line(ratio[7].get_corner(DL), ratio[7].get_corner(UR), color=RED, stroke_width=4)
        s2 = Line(ratio[10].get_corner(DL), ratio[10].get_corner(UR), color=RED, stroke_width=4)
        gone = zh("分母约掉了", 26, RED).next_to(ratio, DOWN, buff=0.35)
        with self.say("m07") as d:
            self.play(FadeOut(post), Write(ratio), run_time=1.8)
            self.play(Create(s1), Create(s2), FadeIn(gone), run_time=0.9)

        # 快进几千步
        trail_pts = [p(CHAIN[i][3]) for i in range(DEMO[-1], 1500)]
        trail = VMobject(stroke_color=CYAN, stroke_width=1.2, stroke_opacity=0.5).set_points_as_corners(trail_pts)
        samples = [CHAIN[i][3] for i in range(BURN, len(CHAIN), 2)]
        cloud = VGroup(*[Dot(p(q), radius=0.022, color=WHITE_HOT).set_opacity(0.55) for q in samples])
        step = ValueTracker(DEMO[-1])
        cnt = always_redraw(lambda: VGroup(zh("第", 24, SOFT), Integer(int(step.get_value()), font_size=34, color=INK, group_with_commas=False),
                                           zh("步", 24, SOFT)).arrange(RIGHT, buff=0.1).move_to(RIGHT * 4.35 + UP * 2.4))
        with self.say("m08") as d:
            self.play(FadeOut(VGroup(ratio, s1, s2, gone)), FadeIn(cnt), run_time=0.5)
            self.play(Create(trail), step.animate.set_value(1500), walker.animate.move_to(trail_pts[-1]),
                      run_time=min(3.5, d * 0.45), rate_func=linear)
            self.play(LaggedStart(*[FadeIn(c) for c in cloud], lag_ratio=0.0006), FadeOut(trail),
                      step.animate.set_value(len(CHAIN)), run_time=min(3.0, d * 0.4), rate_func=linear)
            self.play(img.animate.set_opacity(0.35), run_time=0.6)

        # 数一数：斜率的后验
        bs = np.array([q[1] for q in samples])
        hist_ax = Axes(x_range=[-0.85, 0.15, 0.2], y_range=[0, 1, 1], x_length=4.4, y_length=2.0,
                       axis_config={"color": DIM, "stroke_width": 1.5, "include_tip": False, "tick_size": 0.04},
                       y_axis_config={"stroke_opacity": 0}).move_to(RIGHT * 4.35 + DOWN * 0.3)
        counts, edges = np.histogram(bs, bins=26, range=(-0.85, 0.15))
        counts = counts / counts.max()
        bars = VGroup()
        for c, e0, e1 in zip(counts, edges[:-1], edges[1:]):
            lo_, hi_ = hist_ax.c2p(e0, 0), hist_ax.c2p(e1, c)
            bars.add(Rectangle(width=hi_[0] - lo_[0] - 0.02, height=max(0.001, hi_[1] - lo_[1]), stroke_width=0,
                               fill_color=MAGENTA, fill_opacity=0.85).move_to((lo_ + hi_) / 2))
        hxl = VGroup(*[tex(f"{v:.1f}", size=22, color=SOFT).next_to(hist_ax.c2p(v, 0), DOWN, buff=0.1) for v in (-0.8, -0.4, 0.0)])
        lo95, hi95 = np.percentile(bs, [2.5, 97.5])
        ht = VGroup(tex(r"\beta", size=32, color=MAGENTA), zh("的后验（数出来的）", 24, MAGENTA)).arrange(RIGHT, buff=0.1)
        ht.next_to(hist_ax, UP, buff=0.3)
        hs = tex(rf"\beta\approx{bs.mean():.2f},\ \ 95\%:\ [{lo95:.2f},\,{hi95:.2f}]", size=30, color=INK).next_to(hxl, DOWN, buff=0.25)
        with self.say("m09") as d:
            self.play(FadeOut(cnt), Create(hist_ax), FadeIn(hxl), FadeIn(ht), run_time=0.6)
            self.play(LaggedStart(*[GrowFromEdge(b, DOWN) for b in bars], lag_ratio=0.04), run_time=1.4)
            self.play(FadeIn(hs), run_time=0.6)
        with self.say("m10") as d:
            self.play(cloud.animate.set_color(AMBER).set_opacity(0.7), run_time=1.2)
            self.play(img.animate.set_opacity(1), run_time=1.2)
        self.clear(run_time=0.9)
