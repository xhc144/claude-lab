"""04 σ 不知道的时候（合并方差 t 检验）"""
from common import *
from data import NEW, OLD, POOL

ORIG = np.array([True] * 40 + [False] * 40)


def whisker(sr, mean, s, y, color, label):
    x0, x1 = sr.x(mean - s), sr.x(mean + s)
    seg = Line([x0, y, 0], [x1, y, 0], color=color, stroke_width=4)
    ends = VGroup(*[Line([x, y - 0.1, 0], [x, y + 0.1, 0], color=color, stroke_width=3) for x in (x0, x1)])
    c = Dot([sr.x(mean), y, 0], radius=0.06, color=color)
    lab = tex(label, size=40, color=color).next_to(seg, RIGHT, buff=0.3)
    return VGroup(seg, ends, c, lab)


def beaker(w, h, color):
    outline = VMobject(color=INK, stroke_width=2.5)
    outline.set_points_as_corners([[-w / 2, h, 0], [-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0]])
    return outline


class PooledT(VScene):
    header = "σ 未知 · 合并方差的 t 检验"

    def construct(self):
        self.add_ghost()
        sr = ScoreRows()

        # ------------------------------------------------ 没人告诉你 σ
        s10 = tex(r"\sigma=10", size=72).move_to(UP * 0.6)
        with self.say("d01") as d:
            self.play(FadeIn(s10), run_time=0.6)
            self.wait(d * 0.4)
            st = Line(s10.get_left() + LEFT * 0.2, s10.get_right() + RIGHT * 0.2, color=RED, stroke_width=5)
            self.play(Create(st), run_time=0.5)
        dots = sr.dots(POOL, ORIG)
        lab_new = zh("新方法", 28, BLUE).move_to([-6.3, sr.row_y[0] + 0.05, 0])
        lab_old = zh("旧方法", 28, ORANGE).move_to([-6.3, sr.row_y[1] + 0.05, 0])
        rows = VGroup(sr.axis, sr.nums, dots, lab_new, lab_old)
        with self.say("d02") as d:
            self.play(FadeOut(VGroup(s10, st)), run_time=0.5)
            self.play(FadeIn(rows, lag_ratio=0.02), run_time=1.4)
        w1 = whisker(sr, NEW.mean(), NEW.std(ddof=1), 1.2, BLUE, r"S_1=9.6")
        w2 = whisker(sr, OLD.mean(), OLD.std(ddof=1), -0.55, ORANGE, r"S_2=10.8")
        with self.say("d03") as d:
            self.wait(d * 0.3)
            self.play(GrowFromCenter(w1[0]), FadeIn(w1[1:]), run_time=0.9)
            self.wait(d * 0.15)
            self.play(GrowFromCenter(w2[0]), FadeIn(w2[1:]), run_time=0.9)

        # ------------------------------------------------ 分母只有一个 σ 的位置
        top = tex(r"\bar X-\bar Y", size=60)
        bot = tex(r"\sigma", r"\sqrt{\frac{1}{n_1}+\frac{1}{n_2}}", size=60)
        bot[0].set_color(RED)
        f = frac(top, bot).move_to(UP * 0.55)
        slot = SurroundingRectangle(bot[0], color=RED, buff=0.1, corner_radius=0.06, stroke_width=2.5)
        c1 = tex("9.6", size=52, color=BLUE).move_to(LEFT * 3.0 + DOWN * 1.6)
        c2 = tex("10.8", size=52, color=ORANGE).move_to(RIGHT * 3.0 + DOWN * 1.6)
        with self.say("d04") as d:
            self.play(FadeOut(VGroup(rows, w1[:3], w2[:3])), ReplacementTransform(w1[3], c1),
                      ReplacementTransform(w2[3], c2), run_time=1.0)
            self.play(Write(f), Create(slot), run_time=1.0)
        q = self.pause_q("分母里只有一个 σ 的位置。9.6 和 10.8，填哪个？")
        self.play(FadeOut(q), run_time=0.5)

        a1 = Arrow(c1.get_top(), slot.get_corner(DL), color=BLUE, stroke_width=3, buff=0.15, tip_length=0.2)
        a2 = Arrow(c2.get_top(), slot.get_corner(DR), color=ORANGE, stroke_width=3, buff=0.15, tip_length=0.2)
        same = zh("同一个 σ", 30, RED).next_to(slot, UP, buff=0.0).shift(UP * 1.45)
        with self.say("d05") as d:
            self.play(GrowArrow(a1), GrowArrow(a2), run_time=1.0)
        with self.say("d06") as d:
            self.play(FadeIn(same, shift=DOWN * 0.1), run_time=0.7)
        sw = tex(r"S_w", size=60, color=INK).move_to(bot[0])
        merged = tex(r"S_w", size=52).move_to(DOWN * 1.6)
        with self.say("d07") as d:
            self.wait(d * 0.45)
            self.play(FadeOut(VGroup(a1, a2, same)), c1.animate.move_to(DOWN * 1.6), c2.animate.move_to(DOWN * 1.6),
                      run_time=1.0)
            self.play(FadeOut(c1), FadeOut(c2), FadeIn(merged), run_time=0.5)
            self.play(merged.animate.move_to(bot[0].get_center()), FadeOut(bot[0]), FadeOut(slot), run_time=0.9)
        f_t = VGroup(top, f[1], bot[1], merged)

        # ------------------------------------------------ 合并：按自由度加权
        self.play(FadeOut(f_t), run_time=0.7)
        H = 2.4 / 8143
        b1, b2 = beaker(1.4, 2.0, BLUE).move_to([-3.6, -1.05, 0]), beaker(1.4, 2.0, ORANGE).move_to([-0.8, -1.05, 0])
        big = beaker(2.6, 2.7, INK).move_to([3.6, -0.7, 0])
        base1, base2, base3 = b1.get_bottom(), b2.get_bottom(), big.get_bottom()
        l1 = Rectangle(width=1.36, height=39 * 9.6 ** 2 * H, stroke_width=0, fill_color=BLUE, fill_opacity=0.55)
        l2 = Rectangle(width=1.36, height=39 * 10.8 ** 2 * H, stroke_width=0, fill_color=ORANGE, fill_opacity=0.55)
        l1.move_to(base1 + UP * l1.height / 2)
        l2.move_to(base2 + UP * l2.height / 2)
        t1 = tex(r"39\times 9.6^2", size=34, color=BLUE).next_to(b1, DOWN, buff=0.18)
        t2 = tex(r"39\times 10.8^2", size=34, color=ORANGE).next_to(b2, DOWN, buff=0.18)
        with self.say("d08") as d:
            self.play(Create(b1), Create(b2), run_time=0.7)
            self.play(GrowFromEdge(l1, DOWN), GrowFromEdge(l2, DOWN), FadeIn(t1), FadeIn(t2), run_time=min(1.6, d))
        wnote = VGroup(zh("权重 = 自由度", 28, SOFT), tex(r"n-1", size=36, color=SOFT)).arrange(RIGHT, buff=0.2)
        half = zh("这里两班各 39，一样重", 26, SOFT)
        VGroup(wnote, half).arrange(DOWN, buff=0.15).next_to(VGroup(b1, b2), UP, buff=0.4)
        with self.say("d09") as d:
            self.play(FadeIn(wnote), run_time=0.6)
            self.wait(d * 0.4)
            self.play(FadeIn(half), run_time=0.6)
        # 倒进大桶
        l3a = Rectangle(width=2.56, height=l1.height, stroke_width=0, fill_color=BLUE, fill_opacity=0.55)
        l3b = Rectangle(width=2.56, height=l2.height, stroke_width=0, fill_color=ORANGE, fill_opacity=0.55)
        l3a.move_to(base3 + UP * l3a.height / 2)
        l3b.move_to(base3 + UP * (l3a.height + l3b.height / 2))
        div = tex(r"\div(39+39)", size=40).next_to(big, DOWN, buff=0.18)
        self.play(Create(big), run_time=0.6)
        self.play(Transform(l1, l3a), Transform(l2, l3b), FadeOut(wnote), FadeOut(half), run_time=1.4)
        self.play(FadeIn(div), run_time=0.5)
        sw2 = tex(r"S_w^2", "=", r"\frac{(n_1-1)S_1^2+(n_2-1)S_2^2}{n_1+n_2-2}", "=",
                  r"\frac{39\times 9.6^2+39\times 10.8^2}{78}", "=", "104.4", size=40)
        sw2.move_to(UP * 2.45)
        swv = tex(r"S_w\approx 10.22", size=40).next_to(sw2, DOWN, buff=0.3).align_to(sw2, LEFT)
        self.play(Write(sw2), run_time=1.8)
        self.play(FadeIn(swv), run_time=0.5)
        with self.say("d10") as d:
            hl = SurroundingRectangle(sw2[4][-2:], color=GOLD, buff=0.06, stroke_width=2.5)
            self.play(Create(hl), run_time=0.6)
            self.play(Indicate(sw2[4][-2:], color=GOLD), run_time=0.9)

        # ------------------------------------------------ 少掉的两个：被均值锁住
        keep = VGroup(sw2, swv, hl)
        self.play(FadeOut(VGroup(b1, b2, big, l1, l2, t1, t2, div)),
                  keep.animate.scale(0.85).to_edge(UP, buff=0.85).set_x(0.6), run_time=0.9)
        nl = NumberLine(x_range=[0, 10, 1], length=10, color=LINE, include_tip=False, stroke_width=2).move_to(DOWN * 1.2)
        vals = [ValueTracker(v) for v in (2.0, 3.5, 5.5, 7.0)]
        mean = 5.0
        mline = Line(nl.n2p(mean) + DOWN * 0.15, nl.n2p(mean) + UP * 2.2, color=INK, stroke_width=2.5)
        mlab = tex(r"\bar x", size=40).next_to(mline, UP, buff=0.1)

        def last():
            return 5 * mean - sum(v.get_value() for v in vals)

        ys = [0.0, 0.0, 0.0, 0.0, 0.0]
        lvls = [1.75, 1.35, 0.95, 0.55, 0.15]

        def build():
            g = VGroup()
            xs = [v.get_value() for v in vals] + [last()]
            for i, x in enumerate(xs):
                y = nl.n2p(0)[1] + lvls[i] + 0.25
                p = [nl.n2p(x)[0], y, 0]
                col = GRAY if i == 4 else BLUE
                g.add(Arrow([nl.n2p(mean)[0], y, 0], p, buff=0, color=col, stroke_width=3, tip_length=0.16,
                            max_tip_length_to_length_ratio=0.5))
                g.add(Dot(p, radius=0.1, color=col))
            return g

        arrows = always_redraw(build)
        lock = zh("被均值锁住", 28, GRAY)
        lock.add_updater(lambda m: m.next_to([nl.n2p(last())[0], nl.n2p(0)[1] + lvls[4] + 0.25, 0], RIGHT, buff=0.3))
        with self.say("d11") as d:
            self.play(Create(nl), Create(mline), FadeIn(mlab), run_time=0.8)
            self.play(FadeIn(arrows), run_time=0.8)
            sumz = tex(r"\sum (x_i-\bar x)=0", size=40).next_to(nl, DOWN, buff=0.55).shift(LEFT * 3)
            self.play(FadeIn(sumz), run_time=0.6)
        with self.say("d12") as d:
            self.play(vals[0].animate.set_value(1.0), vals[2].animate.set_value(6.5), run_time=d * 0.35)
            self.play(vals[1].animate.set_value(4.2), vals[3].animate.set_value(8.2), run_time=d * 0.35)
            self.play(FadeIn(lock), run_time=0.5)
        dof = tex(r"80-2=78", size=48, color=GOLD).next_to(nl, DOWN, buff=0.55).shift(RIGHT * 3)
        with self.say("d13") as d:
            self.play(vals[0].animate.set_value(2.6), vals[3].animate.set_value(6.4), run_time=d * 0.3)
            self.play(FadeIn(dof, shift=UP * 0.1), run_time=0.7)
        lock.clear_updaters()
        self.play(FadeOut(VGroup(nl, mline, mlab, arrows, lock, sumz, dof, keep)), run_time=0.8)

        # ------------------------------------------------ 分母也在抖 → 尾巴更厚
        rng = np.random.default_rng(12)
        K = 260
        num = rng.normal(0, 1, (K, 3)).mean(1) - rng.normal(0, 1, (K, 3)).mean(1)
        sp = np.sqrt((rng.chisquare(2, K) + rng.chisquare(2, K)) / 4)
        den = sp * np.sqrt(2 / 3)
        T = num / den
        # 选一个分母特别小、被甩得很远的样本放在慢镜头里
        cand = np.arange(70, 190)
        far = int(cand[np.argmax(np.where(np.abs(T[cand]) < 6.8, np.abs(T[cand]), 0))])

        ax = dist_axes(-7, 7, 1, width=12, height=2.6, ymax=0.42, numbers=[-6, -4, -2, 0, 2, 4, 6]).move_to(DOWN * 1.2)
        edges = np.arange(-7, 7.01, 0.5)
        counts = np.zeros(len(edges) - 1)
        hist = VGroup()

        def rebuild(n):
            c, _ = np.histogram(T[:n], edges)
            g = VGroup()
            for j, v in enumerate(c):
                if v == 0:
                    continue
                h = v / (n * 0.5) * (2.6 / 0.42)
                x0, x1 = ax.c2p(edges[j], 0)[0] + 0.02, ax.c2p(edges[j + 1], 0)[0] - 0.02
                g.add(Rectangle(width=x1 - x0, height=h, stroke_width=0, fill_color=GOLD, fill_opacity=0.3)
                      .move_to([(x0 + x1) / 2, ax.c2p(0, 0)[1] + h / 2, 0]))
            return g

        fn = DecimalNumber(num[0], num_decimal_places=2, font_size=44, color=GOLD, include_sign=True)
        fd = DecimalNumber(den[0], num_decimal_places=2, font_size=44, color=SOFT)
        fv = DecimalNumber(T[0], num_decimal_places=2, font_size=48, color=INK, include_sign=True)
        fbar = Line(LEFT * 0.75, RIGHT * 0.75, color=INK, stroke_width=2.5)
        fn.next_to(fbar, UP, buff=0.12)
        fd.next_to(fbar, DOWN, buff=0.12)
        eq = tex("=", size=48).next_to(fbar, RIGHT, buff=0.25)
        fv.next_to(eq, RIGHT, buff=0.25)
        live = VGroup(fn, fbar, fd, eq, fv).move_to(UP * 1.75)
        demo = zh("演示：每组只有 3 人", 24, SOFT).to_corner(UR, buff=0.5).shift(DOWN * 0.75)
        nlab = zh("分母", 26, SOFT).next_to(fd, LEFT, buff=0.35)
        tri = Triangle(color=GOLD, fill_opacity=1, stroke_width=0).scale(0.1)

        def place(i):
            fn.set_value(num[i]); fd.set_value(den[i]); fv.set_value(T[i])
            tri.move_to(ax.c2p(np.clip(T[i], -6.9, 6.9), 0) + DOWN * 0.12)

        with self.say("d14") as d:
            self.play(Create(ax), FadeIn(live), FadeIn(demo), FadeIn(nlab), run_time=1.0)
            place(0)
            self.add(tri, hist)
            box = SurroundingRectangle(fd, color=GRAY, buff=0.08, stroke_width=2)
            wob = ValueTracker(0)
            self.play(Create(box), run_time=0.4)
            state = {"n": 1}

            def stream(m, alpha):
                n = max(1, int(alpha * (far - 1)))
                if n != state["n"]:
                    state["n"] = n
                    place(n - 1)
                    hist.become(rebuild(n))

            self.play(UpdateFromAlphaFunc(VGroup(), stream), run_time=max(1.0, d - 1.8), rate_func=linear)
        with self.say("d15") as d:
            # 慢镜头：分母偏小，整个分数被甩远
            fn.set_value(num[far]); fv.set_value(T[far])
            self.play(fd.animate.set_value(den[far]), box.animate.stretch(0.8, 0), run_time=1.0)
            self.play(Indicate(fd, color=RED, scale_factor=1.2), run_time=0.7)
            self.play(tri.animate.move_to(ax.c2p(np.clip(T[far], -6.9, 6.9), 0) + DOWN * 0.12),
                      run_time=1.8, rate_func=rate_functions.ease_out_cubic)
            hist.become(rebuild(far + 1))
        state = {"n": far + 1}

        def stream2(m, alpha):
            n = far + 1 + int(alpha * (K - far - 1))
            if n != state["n"]:
                state["n"] = n
                place(n - 1)
                hist.become(rebuild(n))

        norm_c = DashedVMobject(pdf_curve(ax, normal_pdf, -7, 7, SOFT, 3), num_dashes=60)
        t4 = pdf_curve(ax, t_pdf(4), -7, 7, INK, 3.5)
        with self.say("d16") as d:
            self.play(UpdateFromAlphaFunc(VGroup(), stream2), run_time=d * 0.45, rate_func=linear)
            self.play(Create(norm_c), run_time=0.8)
            self.play(Create(t4), run_time=0.9)
        ntag = zh("正态", 26, SOFT).move_to(ax.c2p(1.6, 0.36))
        ttag = zh("t 分布", 26, INK).move_to(ax.c2p(3.6, 0.1))
        self.play(FadeIn(ntag), FadeIn(ttag), run_time=0.5)

        # 自由度越大越接近正态
        dfv = ValueTracker(2)
        tcur = always_redraw(lambda: pdf_curve(ax, t_pdf(dfv.get_value()), -7, 7, INK, 3.5))
        dft = always_redraw(lambda: VGroup(zh("自由度", 28, SOFT),
                                           tex(str(int(round(dfv.get_value()))), size=44)).arrange(RIGHT, buff=0.2)
                            .move_to(UP * 1.75))
        with self.say("d17") as d:
            self.play(FadeOut(VGroup(live, nlab, box, tri, hist, demo, ttag)), FadeOut(t4), FadeIn(tcur), FadeIn(dft),
                      run_time=0.8)
            for v in (5, 30, 78):
                self.play(dfv.animate.set_value(v), run_time=d * 0.22)
        self.play(FadeOut(VGroup(ax, norm_c, ntag, tcur, dft)), run_time=0.8)

        # ------------------------------------------------ Student
        card = VGroup(
            serif("Student", 72),
            Text("The Probable Error of a Mean · Biometrika, 1908", font="Noto Serif CJK SC", font_size=26,
                 color=SOFT, slant=ITALIC),
            zh("威廉·戈塞特，都柏林健力士啤酒厂的化学家", 30, INK),
            zh("手上的样本常常只有几个", 28, SOFT),
        ).arrange(DOWN, buff=0.32).move_to(UP * 0.3)
        rule = Line(LEFT * 2.2, RIGHT * 2.2, color=GOLD, stroke_width=2).next_to(card[0], DOWN, buff=0.14)
        card[1:].shift(DOWN * 0.15)
        with self.say("d18") as d:
            self.play(FadeIn(card[0], shift=UP * 0.1), Create(rule), run_time=1.0)
            self.play(FadeIn(card[1]), run_time=0.6)
            self.play(FadeIn(card[2]), run_time=0.6)
        with self.say("d19") as d:
            self.play(FadeIn(card[3]), run_time=0.6)
        self.play(FadeOut(VGroup(card, rule)), run_time=0.7)

        # ------------------------------------------------ 拆开看：σ 约掉
        t1 = tex(r"T=\frac{\bar X-\bar Y}{S_w\sqrt{\frac{1}{n_1}+\frac{1}{n_2}}}", size=50).move_to(UP * 2.15 + LEFT * 3.4)
        with self.say("d20") as d:
            self.play(Write(t1), run_time=1.4)
        top2 = tex(r"\dfrac{\bar X-\bar Y}{\sigma\sqrt{\dfrac{1}{n_1}+\dfrac{1}{n_2}}}", size=42)
        bot2 = tex(r"\sqrt{\dfrac{(n_1+n_2-2)S_w^2}{\sigma^2}\Big/(n_1+n_2-2)}", size=42)
        big = frac(top2, bot2, tex("=", size=46), gap=0.18).next_to(t1, DOWN, buff=0.35).align_to(t1, LEFT).shift(RIGHT * 0.4)
        sig = VGroup(*find_glyphs(top2, r"\sigma"), *find_glyphs(bot2, r"\sigma"))
        with self.say("d21") as d:
            self.play(Write(big), run_time=1.6)
            self.play(sig.animate.set_color(RED), run_time=0.5)
            self.play(Indicate(sig, color=RED, scale_factor=1.3), run_time=0.8)
            strikes = VGroup(*[strike(g) for g in sig])
            self.play(Create(strikes), run_time=0.6)
        b1 = Brace(top2, RIGHT, color=SOFT)
        n1 = tex(r"\sim N(0,1)", size=38, color=SOFT).next_to(b1, RIGHT, buff=0.15)
        b2 = Brace(bot2, RIGHT, color=SOFT)
        n2 = VGroup(tex(r"\sim\sqrt{\chi^2(\nu)/\nu}", size=36, color=SOFT), tex(r"\nu=n_1+n_2-2", size=28, color=SOFT))
        n2.arrange(DOWN, buff=0.12, aligned_edge=LEFT).next_to(b2, RIGHT, buff=0.15)
        with self.say("d22") as d:
            self.play(sig.animate.set_opacity(0.25), strikes.animate.set_opacity(0.6), run_time=0.6)
            self.play(GrowFromCenter(b1), FadeIn(n1), run_time=0.7)
            self.play(GrowFromCenter(b2), FadeIn(n2), run_time=0.7)
        res = VGroup(zh("分子分母独立", 28, INK), tex(r"\Rightarrow\ T\sim t(n_1+n_2-2)", size=44, color=GOLD))
        res.arrange(RIGHT, buff=0.3).next_to(big, DOWN, buff=0.45).align_to(t1, LEFT)
        foot = VGroup(
            tex(r"\chi^2(n_1-1)+\chi^2(n_2-1)=\chi^2(n_1+n_2-2)", size=30, color=SOFT),
            zh("样本均值与样本方差相互独立，这一条只在正态总体下成立", 22, SOFT),
        ).arrange(DOWN, aligned_edge=RIGHT, buff=0.14).to_corner(DR, buff=0.5).shift(UP * 0.6)
        with self.say("d23") as d:
            self.play(FadeIn(res, shift=UP * 0.1), run_time=0.8)
            self.play(FadeIn(foot), run_time=0.6)

        cond = VGroup(
            tex(r"\sigma_1\neq\sigma_2", size=44, color=RED),
            zh("分子里是一种组合，分母里是另一种组合", 28, INK),
            zh("约不掉", 30, RED),
        ).arrange(RIGHT, buff=0.4)
        with self.say("d24") as d:
            self.play(FadeOut(VGroup(b1, n1, b2, n2, res, foot)), run_time=0.6)
            eqsig = tex(r"\sigma_1=\sigma_2", size=46, color=GOLD).next_to(big, RIGHT, buff=0.8)
            self.play(FadeIn(eqsig), run_time=0.6)
        with self.say("d25") as d:
            cond.next_to(big, DOWN, buff=0.5).align_to(t1, LEFT)
            self.play(FadeIn(cond[0]), run_time=0.5)
            self.play(FadeIn(cond[1]), run_time=0.6)
            self.play(FadeIn(cond[2]), run_time=0.5)

        calc = tex(r"T=\frac{3.3}{10.22\times\sqrt{2/40}}=\frac{3.3}{2.28}\approx 1.44", size=48).move_to(UP * 2.0)
        plot, mk = t_test_plot(78, 1.44, 1.99, center=DOWN * 1.0, label=r"t(78)")
        with self.say("d26") as d:
            self.play(FadeOut(VGroup(t1, big, sig, strikes, eqsig, cond)), run_time=0.6)
            self.play(Write(calc), run_time=1.0)
            self.play(FadeIn(plot), run_time=0.7)
            mk.shift(UP * 2)
            self.add(mk)
            self.play(mk.animate.shift(DOWN * 2), run_time=0.7, rate_func=rate_functions.ease_in_quad)
        self.wait(0.8)
        self.play(FadeOut(VGroup(calc, plot, mk)), run_time=1.0)
        self.wait(0.4)
