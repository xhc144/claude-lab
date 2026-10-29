from common import *
from data import (A0, B0, CI_SIMS, CRED, FAN, FLAT, FLAT_CRED, LEAGUE_AVG, P_ABOVE, POST_A, POST_B, POST_MEAN,
                  SEASON_H, SEASON_N, TRUE_THETA, WALD, beta_interval, beta_pdf)


def zoom_axes(w=10.6, h=4.0, center=DOWN * 0.55, x0=0.2, x1=0.6, y_max=12.5):
    ax = Axes(x_range=[x0, x1, 0.05], y_range=[0, y_max, y_max], x_length=w, y_length=h,
              axis_config={"color": DIM, "stroke_width": 2, "include_tip": False, "tick_size": 0.05},
              y_axis_config={"stroke_opacity": 0, "tick_size": 0})
    ax.move_to(center)
    labels = VGroup(*[tex(f"{v:.1f}", size=26, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.16)
                      for v in np.arange(x0, x1 + 1e-9, 0.1)])
    name = tex(r"\theta", size=36, color=SOFT).next_to(ax.c2p(x1, 0), RIGHT, buff=0.25)
    return ax, VGroup(labels, name)


def post_f(x):
    return float(beta_pdf(x, POST_A, POST_B))


class Answers(VScene):
    header = "05 · 后验能回答什么"

    def construct(self):
        ax, labs = zoom_axes()
        curve = neon_density(ax, post_f, AMBER, fill=0.0)
        name = VGroup(neon("后验", 34, AMBER), tex(r"\mathrm{Beta}(75,\,115)", size=36, color=AMBER)).arrange(RIGHT, buff=0.25)
        name.move_to(RIGHT * 3.6 + UP * 2.1)
        data = zh("150 投 60 中 · 联盟先验", 24, SOFT).next_to(name, DOWN, buff=0.15)
        with self.say("a01") as d:
            self.play(Create(ax), FadeIn(labs), run_time=0.7)
            self.play(Create(curve), FadeIn(name), FadeIn(data), run_time=1.4)

        lo, hi = CRED
        band = density_fill(ax, post_f, lo, hi, AMBER, opacity=0.38)
        ml = marker(ax, lo, post_f(lo), AMBER, dashed=False)
        mh = marker(ax, hi, post_f(hi), AMBER, dashed=False)
        bl = tex(f"{lo:.3f}", size=30, color=AMBER).next_to(ax.c2p(lo, 0), DOWN, buff=0.55)
        bh = tex(f"{hi:.3f}", size=30, color=AMBER).next_to(ax.c2p(hi, 0), DOWN, buff=0.55)
        cap = VGroup(tex(r"95\%", size=40, color=AMBER), zh("可信区间", 30, AMBER)).arrange(RIGHT, buff=0.15)
        cap.next_to(ax.c2p(0.33, 7.5), LEFT, buff=0.1)
        tails = VGroup(tex(r"2.5\%", size=26, color=SOFT).move_to(ax.c2p(lo - 0.035, 1.6)),
                       tex(r"2.5\%", size=26, color=SOFT).move_to(ax.c2p(hi + 0.035, 1.6)))
        with self.say("a02") as d:
            self.play(FadeIn(band), Create(ml), Create(mh), run_time=1.0)
            self.play(FadeIn(bl), FadeIn(bh), FadeIn(tails), run_time=0.6)
            self.wait(max(0.1, d * 0.3))
            self.play(FadeIn(cap, scale=0.9), run_time=0.6)

        above = density_fill(ax, post_f, LEAGUE_AVG, 0.6, CYAN, opacity=0.38)
        lm = marker(ax, LEAGUE_AVG, 11.0, CYAN)
        ll = VGroup(zh("联盟平均", 22, CYAN), tex("0.35", size=28, color=CYAN)).arrange(DOWN, buff=0.06).next_to(lm, UP, buff=0.08)
        pa = VGroup(tex(r"P(\theta>0.35\mid\text{数据})", size=36, color=CYAN), tex(r"\approx", size=36),
                    tex(f"{P_ABOVE * 100:.0f}\\%", size=44, color=CYAN)).arrange(RIGHT, buff=0.15)
        pa.next_to(ax.c2p(0.45, 8.0), RIGHT, buff=0.1)
        with self.say("a03") as d:
            self.play(FadeOut(VGroup(band, ml, mh, bl, bh, cap, tails)), run_time=0.5)
            self.play(Create(lm), FadeIn(ll), run_time=0.6)
            self.play(FadeIn(above), run_time=0.8)
            self.play(Write(pa), run_time=1.0)

        mk = marker(ax, POST_MEAN, post_f(POST_MEAN), WHITE_HOT)
        b = ball(0.26)
        nxt = VGroup(b, zh("下一球投进的概率", 26, INK), tex(r"\approx", size=36), tex(f"{POST_MEAN:.2f}", size=44, color=AMBER))
        nxt.arrange(RIGHT, buff=0.18).move_to(LEFT * 3.5 + UP * 2.1)
        integ = tex(r"\int_0^1 \theta\, p(\theta\mid\text{数据})\,d\theta", "=", r"\text{后验均值}", size=34)
        integ[2].set_color(AMBER)
        integ.next_to(nxt, DOWN, buff=0.25).align_to(nxt, LEFT)
        with self.say("a04") as d:
            self.play(FadeOut(VGroup(above, lm, ll, pa)), run_time=0.5)
            self.play(Create(mk), FadeIn(nxt, shift=RIGHT * 0.2), run_time=0.9)
            self.play(Write(integ), run_time=1.2)
        self.clear(run_time=0.8)


class Intervals(VScene):
    header = "05 · 可信区间与置信区间"

    def construct(self):
        lp = panel(6.25, 5.2, color=SOFT).move_to(LEFT * 3.3 + DOWN * 0.45)
        rp = panel(6.25, 5.2, color=AMBER).move_to(RIGHT * 3.3 + DOWN * 0.45)
        lt = VGroup(zh("置信区间", 30, INK), zh("频率学派", 22, SOFT)).arrange(RIGHT, buff=0.2, aligned_edge=DOWN)
        rt = VGroup(zh("可信区间", 30, AMBER), zh("贝叶斯", 22, SOFT)).arrange(RIGHT, buff=0.2, aligned_edge=DOWN)
        lt.next_to(lp.get_top(), DOWN, buff=0.25)
        rt.next_to(rp.get_top(), DOWN, buff=0.25)
        with self.say("i01") as d:
            self.play(FadeIn(lp), FadeIn(lt), run_time=0.7)
            self.play(FadeIn(rp), FadeIn(rt), run_time=0.7)

        # 左：重复很多次
        nl = NumberLine(x_range=[0.25, 0.6, 0.05], length=5.4, color=DIM, tick_size=0.04).move_to(lp.get_center() + DOWN * 2.15)
        nls = VGroup(*[tex(f"{v:.1f}", size=22, color=SOFT).next_to(nl.n2p(v), DOWN, buff=0.1) for v in (0.3, 0.4, 0.5)])
        truth = DashedLine(nl.n2p(TRUE_THETA), nl.n2p(TRUE_THETA) + UP * 3.0, color=WHITE_HOT, stroke_width=2.5, dash_length=0.08)
        tl = zh("真值", 20, INK).next_to(truth, UP, buff=0.05)
        segs, misses = VGroup(), VGroup()
        for k, (a, b) in enumerate(CI_SIMS):
            y = 0.2 + k * 0.14
            miss = not a <= TRUE_THETA <= b
            s = Line(nl.n2p(a) + UP * y, nl.n2p(b) + UP * y, color=RED if miss else CYAN, stroke_width=3.2)
            segs.add(s)
            if miss:
                misses.add(s)
        cover = VGroup(tex("19/20", size=34, color=CYAN), zh("盖住了真值", 22, SOFT)).arrange(RIGHT, buff=0.15)
        cover.next_to(lt, DOWN, buff=0.12)
        with self.say("i02") as d:
            self.play(Create(nl), FadeIn(nls), Create(truth), FadeIn(tl), run_time=0.8)
            self.play(LaggedStart(*[Create(s) for s in segs], lag_ratio=0.25), run_time=min(5.0, d * 0.6))
            self.play(FadeIn(cover), Indicate(misses, color=RED),
                      run_time=0.9)
        one = segs[3]
        q = tex("?", size=40, color=AMBER).next_to(one, RIGHT, buff=0.12)
        with self.say("i03") as d:
            self.play(*[s.animate.set_opacity(0.18) for s in segs if s is not one], one.animate.set_stroke(AMBER, 5),
                      FadeIn(q, scale=1.4), run_time=0.9)

        # 右：后验曲线
        ax = Axes(x_range=[0.25, 0.6, 0.05], y_range=[0, 12.5, 12.5], x_length=5.4, y_length=3.0,
                  axis_config={"color": DIM, "stroke_width": 2, "include_tip": False, "tick_size": 0.04},
                  y_axis_config={"stroke_opacity": 0}).move_to(rp.get_center() + DOWN * 0.5)
        axl = VGroup(*[tex(f"{v:.1f}", size=22, color=SOFT).next_to(ax.c2p(v, 0), DOWN, buff=0.1) for v in (0.3, 0.4, 0.5)])
        f = lambda x: float(beta_pdf(x, POST_A, POST_B))
        cur = neon_density(ax, f, AMBER, fill=0.0, width=3.5)
        band = density_fill(ax, f, CRED[0], CRED[1], AMBER, opacity=0.4)
        stmt = tex(r"P(0.33<\theta<0.47\mid\text{数据})", "=", r"95\%", size=30)
        stmt[0].set_color(AMBER)
        stmt[2].set_color(AMBER)
        stmt.next_to(rt, DOWN, buff=0.2)
        with self.say("i04") as d:
            self.play(Create(ax), FadeIn(axl), Create(cur), run_time=1.0)
            self.play(FadeIn(band), run_time=0.7)
            self.play(Write(stmt), run_time=1.2)

        # 换几个先验
        self.clear(run_time=0.7)
        nl2 = NumberLine(x_range=[0.3, 0.55, 0.05], length=9, color=DIM, tick_size=0.05).move_to(DOWN * 1.4)
        nl2s = VGroup(*[tex(f"{v:.2f}", size=24, color=SOFT).next_to(nl2.n2p(v), DOWN, buff=0.12)
                        for v in (0.30, 0.35, 0.40, 0.45, 0.50, 0.55)])
        rows = []
        specs = [("联盟先验", (A0, B0), AMBER), ("平的先验", FLAT, VIOLET), ("球迷的先验", FAN, RED)]
        for k, (nm, (pa_, pb_), c) in enumerate(specs):
            a, b = beta_interval(pa_ + SEASON_H, pb_ + SEASON_N - SEASON_H)
            y = 2.9 - k * 0.75
            seg = glow(Line(nl2.n2p(a) + UP * y, nl2.n2p(b) + UP * y, color=c, stroke_width=6), c, layers=2)
            lab = zh(nm, 24, c).next_to(nl2.n2p(0.3) + UP * y, LEFT, buff=0.3)
            ends = tex(f"[{a:.3f},\\ {b:.3f}]", size=26, color=c).next_to(nl2.n2p(b) + UP * y, RIGHT, buff=0.25)
            rows.append(VGroup(seg, lab, ends))
        ttl = zh("同一组数据（150 投 60 中），不同先验的 95% 可信区间", 26, SOFT).to_edge(UP, buff=1.05)
        with self.say("i05") as d:
            self.play(FadeIn(ttl), Create(nl2), FadeIn(nl2s), run_time=0.8)
            for r in rows:
                self.play(FadeIn(r, shift=RIGHT * 0.2), run_time=0.6)
            self.wait(max(0.1, d * 0.15))
            self.play(rows[2].animate.set_opacity(0.45), run_time=0.5)

        # 平的先验 vs 置信区间
        self.play(FadeOut(rows[0]), FadeOut(rows[2]), FadeOut(ttl), run_time=0.5)
        wald = VGroup(
            glow(Line(nl2.n2p(WALD[0]) + UP * 1.4, nl2.n2p(WALD[1]) + UP * 1.4, color=CYAN, stroke_width=6), CYAN, layers=2),
            zh("95% 置信区间", 24, CYAN).next_to(nl2.n2p(0.3) + UP * 1.4, LEFT, buff=0.3),
            tex(f"[{WALD[0]:.3f},\\ {WALD[1]:.3f}]", size=26, color=CYAN).next_to(nl2.n2p(WALD[1]) + UP * 1.4, RIGHT, buff=0.25))
        same = zh("几乎一样", 30, INK).move_to(UP * 2.2)
        with self.say("i06") as d:
            self.play(rows[1].animate.shift(UP * 0.0), FadeIn(wald, shift=UP * 0.2), run_time=0.9)
            self.play(FadeIn(same, scale=0.9), run_time=0.6)
        self.clear(run_time=0.8)
