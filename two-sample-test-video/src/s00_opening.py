"""00 冷开场 · 01 片名 · 02 一个分数"""
from common import *
from data import FAST, NEW, OLD, POOL, SHUFFLES

ORIG = np.array([True] * 40 + [False] * 40)


class Opening(VScene):
    def marks(self, sr, mask, show_values=True):
        top, bot = POOL[mask].mean(), POOL[~mask].mean()
        ml_t = sr.mean_line(top, 0, BLUE if show_values else INK)
        ml_b = sr.mean_line(bot, 1, ORANGE if show_values else INK)
        y = 1.6
        x0, x1 = sorted([sr.x(top), sr.x(bot)])
        br = gap_bracket(x0, x1, y, label=f"{abs(top - bot):.1f}", size=46)
        guides = VGroup(*[DashedLine([sr.x(v), y - 0.12, 0], [sr.x(v), ml.get_top()[1] + 0.05, 0],
                                     color=GOLD, stroke_width=1.5, dash_length=0.06).set_opacity(0.6)
                          for v, ml in ((top, ml_t), (bot, ml_b))])
        g = VGroup(ml_t, ml_b, guides, br)
        if show_values:
            vt = tex(f"{top:.1f}", size=38, color=BLUE).next_to(ml_t, RIGHT, buff=0.12).shift(UP * 0.35)
            vb = tex(f"{bot:.1f}", size=38, color=ORANGE).next_to(ml_b, LEFT, buff=0.12).shift(UP * 0.35)
            g.add(vt, vb)
        return g

    def apply(self, sr, dots, mask, colors=(BLUE, ORANGE)):
        pos = sr.layout(POOL, mask)
        for d, p, m in zip(dots, pos, mask):
            d.move_to(p).set_color(colors[0] if m else colors[1])

    def construct(self):
        sr = ScoreRows()
        lab_new = zh("新方法", 28, BLUE).move_to([-6.3, sr.row_y[0] + 0.05, 0])
        lab_old = zh("旧方法", 28, ORANGE).move_to([-6.3, sr.row_y[1] + 0.05, 0])

        # ------------------------------------------------ 00 冷开场
        with self.say("a01") as d:
            self.play(Create(sr.axis), FadeIn(sr.nums, lag_ratio=0.1), run_time=1.6)

        dots = sr.dots(POOL, ORIG)
        targets = [x.get_center().copy() for x in dots]
        for x in dots:
            x.shift(UP * 4.6)
        marks = self.marks(sr, ORIG)
        ml_t, ml_b, guides, br, vt, vb = marks
        with self.say("a02") as d:
            fall = lambda idx: LaggedStart(*[dots[i].animate(rate_func=rate_functions.ease_out_cubic).move_to(targets[i])
                                             for i in idx], lag_ratio=0.06, run_time=d * 0.38)
            self.play(FadeIn(lab_new), fall(range(40)))
            self.play(FadeIn(ml_t, shift=DOWN * 0.1), FadeIn(vt), run_time=0.5)
            self.play(FadeIn(lab_old), fall(range(40, 80)))
            self.play(FadeIn(ml_b, shift=DOWN * 0.1), FadeIn(vb), run_time=0.5)
        with self.say("a03") as d:
            self.play(Create(guides), GrowFromCenter(br[0]), FadeIn(br[1]), run_time=0.9)
            self.play(Write(br[2]), run_time=0.6)
        self.line("a04", gap=0.6)

        # 倒在一起，再随手分两拨
        merged_y = (sr.row_y[0] + sr.row_y[1]) / 2 - 0.15
        merged = sr.positions(np.sort(POOL), 0)
        order = np.argsort(POOL, kind="stable")
        merged_pos = [None] * 80
        for i, p in zip(order, merged):
            merged_pos[i] = p + np.array([0, merged_y - sr.row_y[0], 0])
        with self.say("a05") as d:
            self.play(FadeOut(marks), FadeOut(lab_new), FadeOut(lab_old), run_time=0.6)
            self.play(*[x.animate.move_to(p).set_color(GRAY) for x, p in zip(dots, merged_pos)], run_time=1.4)
            self.wait(0.4)
            pos = sr.layout(POOL, SHUFFLES[0])
            self.play(*[x.animate.move_to(p).set_color(BLUE if m else ORANGE)
                        for x, p, m in zip(dots, pos, SHUFFLES[0])], run_time=1.3)
            marks = self.marks(sr, SHUFFLES[0], show_values=False)
            self.play(FadeIn(marks), run_time=0.5)

        def reshuffle(mask, rt):
            nonlocal marks
            pos = sr.layout(POOL, mask)
            new = self.marks(sr, mask, show_values=False)
            self.play(*[x.animate.move_to(p).set_color(BLUE if m else ORANGE) for x, p, m in zip(dots, pos, mask)],
                      Transform(marks, new), run_time=rt)

        with self.say("a06") as d:
            self.wait(d * 0.08)
            reshuffle(SHUFFLES[1], d * 0.16)
            self.wait(d * 0.06)
            reshuffle(SHUFFLES[2], d * 0.16)
            self.wait(d * 0.14)
            reshuffle(SHUFFLES[3], d * 0.16)

        # 越洗越快
        k = len(FAST)
        state = {"i": -1}

        def flicker(mob, alpha):
            i = min(k - 1, int(k * alpha ** 1.8))
            if i != state["i"]:
                state["i"] = i
                self.apply(sr, dots, FAST[i])
                marks.become(self.marks(sr, FAST[i], show_values=False))

        d7, d8 = DUR["a07"]["dur"], DUR["a08"]["dur"]
        self.voice_log.append({"key": "a07", "t": round(self.time + 0.3, 3), "dur": d7})
        self.voice_log.append({"key": "a08", "t": round(self.time + 0.3 + d7 + GAP, 3), "dur": d8})
        self.wait(0.3)
        self.play(UpdateFromAlphaFunc(VGroup(), flicker), run_time=d7 + GAP + d8, rate_func=linear)
        self.wait(GAP)

        with self.say("a09") as d:
            pos = sr.layout(POOL, ORIG)
            final = self.marks(sr, ORIG)
            self.play(*[x.animate.move_to(p).set_color(BLUE if m else ORANGE) for x, p, m in zip(dots, pos, ORIG)],
                      FadeOut(marks), FadeIn(lab_new), FadeIn(lab_old), run_time=1.2)
            marks = final
            self.play(FadeIn(marks), run_time=0.6)
            self.wait(d * 0.35)
            self.play(Indicate(marks[3], color=GOLD, scale_factor=1.15), run_time=1.0)
        self.wait(0.6)

        # ------------------------------------------------ 01 片名
        seg = marks[3]
        self.play(FadeOut(dots), FadeOut(sr.axis), FadeOut(sr.nums), FadeOut(lab_new), FadeOut(lab_old),
                  FadeOut(marks[0]), FadeOut(marks[1]), FadeOut(marks[2]), FadeOut(marks[4]), FadeOut(marks[5]),
                  FadeOut(seg[2]), run_time=1.0)
        point = Dot(UP * 0.9, radius=0.06, color=GOLD)
        self.play(Transform(VGroup(seg[0], seg[1]), point), run_time=1.0)
        title = serif("差了 3.3 分，算不算数", 66).move_to(UP * 0.1)
        sub = zh("双样本检验：从哪来，为什么这么算", 30, SOFT).next_to(title, DOWN, buff=0.45)
        self.play(FadeIn(title, shift=UP * 0.1), run_time=1.2)
        self.play(FadeIn(sub), run_time=0.8)
        self.wait(3.2)
        self.play(FadeOut(title), FadeOut(sub), FadeOut(seg[0]), FadeOut(seg[1]), run_time=0.9)
        self.remove(seg)
        self.wait(0.3)

        # ------------------------------------------------ 02 一个分数
        minis = VGroup(
            tex(r"\frac{\bar X-\bar Y}{\sqrt{\sigma_1^2/n_1+\sigma_2^2/n_2}}"),
            tex(r"\frac{\bar X-\bar Y}{S_w\sqrt{1/n_1+1/n_2}}"),
            tex(r"\frac{S_1^2}{S_2^2}"),
            tex(r"\frac{\bar X-\bar Y}{\sqrt{S_1^2/n_1+S_2^2/n_2}}"),
            tex(r"\frac{\bar d}{S_d/\sqrt{n}}"),
            tex(r"\frac{\hat p_1-\hat p_2}{\sqrt{\hat p(1-\hat p)(1/n_1+1/n_2)}}"),
        )
        for m in minis:
            m.scale(0.95)
        minis.arrange_in_grid(rows=2, cols=3, buff=(0.75, 1.1)).move_to(UP * 0.35)
        if minis.width > 13.2:
            minis.scale_to_fit_width(13.2)

        num = Line(LEFT * 1.5, RIGHT * 1.5, color=GOLD, stroke_width=8)
        bar = Line(LEFT * 2.5, RIGHT * 2.5, color=INK, stroke_width=3)
        phase = ValueTracker(0)
        amp = ValueTracker(0.13)
        wv = always_redraw(lambda: wave(4.0, amp.get_value(), 4.0, phase=phase.get_value(), stroke=5).move_to(UP * 0.6 + LEFT * 2.8))
        pict = VGroup(num.copy().move_to(UP * 2.0), bar.copy().move_to(UP * 1.35), wave(4.0, 0.13, 4.0, stroke=5).move_to(UP * 0.6))
        pict.shift(LEFT * 2.8)

        with self.say("b01") as d:
            self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.15) for m in minis], lag_ratio=0.25), run_time=d * 0.85)
        with self.say("b02") as d:
            self.play(*[Transform(m, pict.copy()) for m in minis], run_time=min(1.6, d * 0.9))
        self.remove(*minis)
        num_m, bar_m = pict[0], pict[1]
        self.add(num_m, bar_m, wv)
        phase.add_updater(lambda m, dt: m.increment_value(dt * 2.2))
        self.add(phase)

        lab_num = zh("看到的差", 36, GOLD).next_to(num_m, RIGHT, buff=0.9).align_to(num_m, DOWN).shift(DOWN * 0.15)
        lab_den = zh("假如两边其实没区别，\n这个差平常会抖多大", 36, SOFT, line_spacing=1.2)
        lab_den.next_to(bar_m, RIGHT, buff=0.9).shift(DOWN * 0.75)
        lab_den.align_to(lab_num, LEFT)
        with self.say("b03") as d:
            self.play(Indicate(num_m, color=GOLD, scale_factor=1.1), FadeIn(lab_num, shift=LEFT * 0.2), run_time=1.0)
        with self.say("b04") as d:
            self.play(FadeIn(lab_den, shift=LEFT * 0.2), run_time=1.0)

        with self.say("b05") as d:
            self.play(num_m.animate.stretch(1.4, 0), amp.animate.set_value(0.035), run_time=d * 0.4)
            self.wait(d * 0.25)
            self.play(num_m.animate.stretch(1 / 1.4, 0), amp.animate.set_value(0.13), run_time=d * 0.3)

        fl = tex(r"\text{统计量}=", size=52)
        fn = tex(r"\text{看到的差}", r"-", r"\text{原假设下的差}", size=52)
        fd = tex(r"\text{这个差平常抖多大}", size=52, color=SOFT)
        fn[0].set_color(GOLD)
        formula = frac(fn, fd, fl).move_to(DOWN * 1.75)
        with self.say("b06") as d:
            self.play(Write(formula), run_time=1.6)
            h0 = VGroup(fn[1], fn[2])
            self.play(h0.animate.set_opacity(0.3), run_time=0.6)
            zero = zh("通常是 0", 26, SOFT).next_to(fn, RIGHT, buff=0.3)
            self.play(FadeIn(zero), run_time=0.4)
            box = SurroundingRectangle(fd, color=GRAY, buff=0.1, corner_radius=0.06, stroke_width=2)
            self.play(Create(box), run_time=0.8)

        left = VGroup(num_m, bar_m, lab_num, lab_den)
        with self.say("b07") as d:
            self.play(FadeOut(box), FadeOut(zero), FadeOut(left), FadeOut(wv), run_time=0.7)
            self.remove(phase)
            ax = dist_axes(-4, 4, 1, width=7.5, height=2.5, ymax=0.42).move_to(DOWN * 0.6)
            cur = pdf_curve(ax, normal_pdf, -4, 4, INK, 3)
            self.play(formula.animate.move_to(UP * 2.2).scale(0.85), run_time=0.8)
            self.play(Create(ax), Create(cur), run_time=1.2)
            dot = Dot(ax.c2p(1.2, 0) + UP * 1.8, radius=0.11, color=GOLD)
            self.play(FadeIn(dot), run_time=0.3)
            self.play(dot.animate.move_to(ax.c2p(1.2, 0)), run_time=0.7, rate_func=rate_functions.ease_in_quad)
            self.play(Flash(dot, color=GOLD, line_length=0.15, num_lines=10), run_time=0.6)

        sig = tex(r"\sigma", size=64, color=RED).next_to(fd, RIGHT, buff=0.35)
        q = serif("？", 60, RED).move_to(ax.c2p(0, 0.22))
        with self.say("b08") as d:
            self.play(FadeIn(sig, scale=1.3), run_time=0.6)
            self.play(cur.animate.set_stroke(opacity=0.25), ax.animate.set_opacity(0.35), FadeIn(q), run_time=0.9)
        with self.say("b09") as d:
            self.wait(d * 0.35)
            self.play(sig.animate.scale(0.2).set_opacity(0), FadeOut(q), run_time=1.0)
            self.remove(sig)
            self.play(cur.animate.set_stroke(opacity=1), ax.animate.set_opacity(1), run_time=0.8)
        self.wait(0.6)
        self.play(FadeOut(VGroup(formula, ax, cur, dot)), run_time=1.0)
        self.wait(0.4)
