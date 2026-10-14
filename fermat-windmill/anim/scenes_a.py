"""Chapters 1-5: hook, statement and history, the easy direction, parity, the set S."""
from common import *  # noqa: F401,F403


# ------------------------------------------------------------------ helpers
def atl(scene: FScene, zh_k: int, en_k: int, offset: float = 0.0):
    scene.at(zh_k if ZH else en_k, offset)


def avatar(color, label=None):
    head = Circle(0.36, fill_color=color, fill_opacity=1, stroke_width=0)
    body = Arc(radius=0.62, start_angle=0, angle=PI, fill_color=color, fill_opacity=1, stroke_width=0)
    body.next_to(head, DOWN, buff=0.1)
    g = VGroup(head, body)
    if label:
        g.add(T(label, 24, MUTED).next_to(body, DOWN, buff=0.18))
    return g


def bubble(text_mob, tail_dir=DL, color=PANEL2):
    r = RoundedRectangle(corner_radius=0.25, width=text_mob.width + 0.7, height=text_mob.height + 0.55,
                         fill_color=color, fill_opacity=1, stroke_color=GRID, stroke_width=1.5).move_to(text_mob)
    c = r.get_corner(tail_dir) + (-tail_dir[0] * 0.7) * RIGHT + 0.02 * UP * (-tail_dir[1])
    tail = Polygon(c + LEFT * 0.18, c + RIGHT * 0.18, c + tail_dir * 0.38 + RIGHT * tail_dir[0] * 0.1,
                   fill_color=color, fill_opacity=1, stroke_width=0)
    return VGroup(tail, r, text_mob)


def tile_square(n, unit, color):
    sq = Square(n * unit, fill_color=color, fill_opacity=1, stroke_color=BG, stroke_width=2)
    lines = VGroup()
    for i in range(1, n):
        lines.add(Line(sq.get_corner(DL) + RIGHT * i * unit, sq.get_corner(UL) + RIGHT * i * unit))
        lines.add(Line(sq.get_corner(DL) + UP * i * unit, sq.get_corner(DR) + UP * i * unit))
    lines.set_stroke(BG, 1.4, opacity=0.4)
    return VGroup(sq, lines)


def two_squares(a, b, unit=0.24, gap=0.42):
    A = tile_square(a, unit, SQ)
    B = tile_square(b, unit, ARM)
    plus = M("+", 36, MUTED)
    g = VGroup(A, plus, B).arrange(RIGHT, buff=0.16, aligned_edge=DOWN)
    plus.align_to(A, DOWN).shift(UP * 0.05)
    return g


# ------------------------------------------------------------------ 01
class S01_Hook(FScene):
    def construct(self):
        # ---- hook_1: the interview question
        with self.seg("hook_1"):
            prof = avatar(FLIP, L("考官", "Examiner")).shift(LEFT * 4.3 + DOWN * 0.9)
            me = avatar(SQ, L("你", "You")).shift(RIGHT * 4.3 + DOWN * 0.9)
            q = TL("你最喜欢的数学定理是什么？", "What is your favorite theorem?", 40)
            b = bubble(q, DL).move_to(UP * 1.55 + LEFT * 0.6)
            self.play(FadeIn(prof, shift=UP * 0.3), FadeIn(me, shift=UP * 0.3), run_time=0.8)
            self.at(0, 1.6 if ZH else 2.6)
            self.play(FadeIn(b[0]), FadeIn(b[1], scale=0.9), run_time=0.4)
            self.play(AddTextLetterByLetter(q, time_per_char=0.05 if ZH else 0.035))
            think = VGroup(*[Dot(radius=0.07 + 0.03 * i, color=MUTED) for i in range(3)])
            think.arrange(UR, buff=0.12).next_to(me, UL, buff=0.1)
            self.play(LaggedStart(*[FadeIn(d) for d in think], lag_ratio=0.3), run_time=0.8)
        self.play(FadeOut(VGroup(prof, me, b, think)), run_time=0.5)

        # ---- hook_2: 5, 13, 17, 29 as sums of two squares
        good = [(5, 1, 2), (13, 2, 3), (17, 1, 4), (29, 2, 5)]
        xs = [-5.3, -2.0, 1.3, 4.6]
        with self.seg("hook_2"):
            nums = VGroup(*[T(str(p), 76, TEXT, weight=BOLD, font=LAT_FONT).move_to([x, 2.45, 0])
                            for (p, _, _), x in zip(good, xs)])
            self.at(1)
            self.play(LaggedStart(*[FadeIn(n, shift=DOWN * 0.3) for n in nums], lag_ratio=0.25), run_time=1.2)
            self.at(2)
            eqs = VGroup()
            for k, ((p, a, b), x) in enumerate(zip(good, xs)):
                self.at(3 + k)
                sq = two_squares(a, b, 0.3)
                sq.move_to([x, 0.0, 0], aligned_edge=DOWN).shift(UP * 0.15)
                lab = M(f"{a*a} + {b*b}", 42, MUTED).next_to(sq, DOWN, buff=0.18)
                self.play(nums[k].animate.set_color(GOOD),
                          GrowFromCenter(sq[0]), FadeIn(sq[1]), GrowFromCenter(sq[2]), run_time=0.8)
                self.play(FadeIn(lab, shift=UP * 0.15), run_time=0.4)
                eqs.add(VGroup(sq, lab))

        # ---- hook_3: 3, 7, 11, 19 never are
        bad = [3, 7, 11, 19]
        with self.seg("hook_3"):
            bnums = VGroup(*[T(str(p), 68, TEXT, weight=BOLD, font=LAT_FONT).move_to([x, -1.75, 0])
                             for p, x in zip(bad, xs)])
            self.play(LaggedStart(*[FadeIn(n, shift=UP * 0.3) for n in bnums], lag_ratio=0.2), run_time=1.0)
            marks = VGroup()
            for n in bnums:
                q = M(r"\neq \square + \square", 34, MUTED).next_to(n, RIGHT, buff=0.15)
                marks.add(q)
            self.play(LaggedStart(*[Write(m) for m in marks], lag_ratio=0.2), run_time=1.0)
            self.play(*[Wiggle(n, scale_value=1.08) for n in bnums],
                      bnums.animate.set_color(BAD), run_time=1.0)

        # ---- hook_4: remainders mod 4
        with self.seg("hook_4"):
            self.at(1)
            div = VGroup(*[M(r"\div 4", 40, MUTED).next_to(n, RIGHT, buff=0.2) for n in nums])
            self.play(FadeOut(marks), LaggedStart(*[FadeIn(d) for d in div], lag_ratio=0.1), run_time=0.8)
            self.play(FadeOut(div), run_time=0.3)
            atl(self, 2, 2)
            r1 = VGroup(*[M(r"\equiv 1", 44, GOOD).next_to(n, RIGHT, buff=0.15) for n in nums])
            self.play(LaggedStart(*[FadeIn(r, shift=LEFT * 0.2) for r in r1], lag_ratio=0.15), run_time=0.9)
            box1 = SurroundingRectangle(VGroup(nums, eqs, r1), color=GOOD, buff=0.25, corner_radius=0.15)
            self.play(Create(box1), run_time=0.6)
            atl(self, 2, 3, 1.4 if ZH else 0.0)
            r3 = VGroup(*[M(r"\equiv 3", 44, BAD).next_to(n, RIGHT, buff=0.15) for n in bnums])
            self.play(LaggedStart(*[FadeIn(r, shift=LEFT * 0.2) for r in r3], lag_ratio=0.15), run_time=0.9)
            box3 = SurroundingRectangle(VGroup(bnums, r3), color=BAD, buff=0.25, corner_radius=0.15)
            lab1 = M(r"4k+1", 36, GOOD).next_to(box1, LEFT, buff=0.1).rotate(PI / 2)
            self.play(Create(box3), run_time=0.6)

        # ---- hook_5: title
        with self.seg("hook_5"):
            self.play(FadeOut(VGroup(nums, eqs, r1, box1, bnums, r3, box3)), run_time=0.7)
            wm = Windmill(3, 1, 1, unit=0.42).move_to(UP * 1.2)
            title = TL("风车里的素数", "Primes in a Windmill", 76, weight=BOLD).next_to(wm, DOWN, buff=0.55)
            sub = TL("费马平方和定理 · 扎吉尔的一句话证明",
                     "Fermat's two-square theorem · Zagier's one-sentence proof", 32, color=MUTED)
            sub.next_to(title, DOWN, buff=0.28)
            if sub.width > 12.6:
                sub.scale_to_fit_width(12.6)
            self.play(DrawBorderThenFill(wm.square), LaggedStart(*[GrowFromPoint(b, wm.centre()) for b in wm.blades],
                                                                    lag_ratio=0.15), run_time=1.4)
            wm.add_updater(lambda m, dt: m.rotate(-0.5 * dt, about_point=m.centre()))
            self.play(Write(title), run_time=1.2)
            self.play(FadeIn(sub, shift=UP * 0.2), run_time=0.8)
        self.hold(0.6)
        wm.clear_updaters()
        self.play(FadeOut(VGroup(wm, title, sub)), run_time=0.8)


# ------------------------------------------------------------------ 02
def year_x(y):
    pts = [(1640, -5.3), (1749, -2.5), (1832, 0.2), (1984, 3.2), (1990, 5.3)]
    for (a, xa), (b, xb) in zip(pts, pts[1:]):
        if a <= y <= b:
            return xa + (xb - xa) * (y - a) / (b - a)
    return pts[-1][1]


class S02_Statement(FScene):
    def construct(self):
        self.chapter_card(2, "定理与历史", "Statement and history")

        # ---- st_1: statement
        with self.seg("st_1"):
            head = TL("定理（费马平方和定理）", "Theorem (Fermat's two-square theorem)", 30, color=SQ, weight=BOLD)
            l1 = TL("设 p 为奇素数，x, y 为整数。", "Let p be an odd prime, and x, y integers.", 34)
            l2 = M(r"p = x^2 + y^2", 60)
            iff = M(r"\iff", 60, MUTED)
            l3 = M(r"p \equiv 1 \pmod 4", 60)
            row = VGroup(l2, iff, l3).arrange(RIGHT, buff=0.45)
            body = VGroup(head, l1, row).arrange(DOWN, buff=0.45, aligned_edge=LEFT)
            thm = card(body, pad=0.5).move_to(UP * 0.4)
            self.play(FadeIn(thm[0], scale=0.97), FadeIn(head), run_time=0.7)
            self.at(1)
            self.play(Write(l1), run_time=1.0)
            self.at(2)
            self.play(Write(l2), run_time=0.9)
            self.play(Write(iff), run_time=0.4)
            self.play(Write(l3), run_time=0.9)
            self.play(Circumscribe(l3, color=SQ, buff=0.12), run_time=1.0)

        # ---- st_2: circles through lattice points
        with self.seg("st_2"):
            self.play(thm.animate.scale(0.62).to_edge(LEFT, buff=0.45).shift(UP * 0.7), run_time=0.8)
            u = 0.36
            cen = RIGHT * 3.0 + DOWN * 0.15
            dots = lattice_dots(6, u, cen, DIM, 0.03)
            axes = VGroup(Line(cen + LEFT * 6.4 * u, cen + RIGHT * 6.4 * u, stroke_width=1.5, color=GRID),
                          Line(cen + DOWN * 6.4 * u, cen + UP * 6.4 * u, stroke_width=1.5, color=GRID))
            self.play(FadeIn(axes), FadeIn(dots, lag_ratio=0.002), run_time=0.8)

            def ring(n):
                ok = n % 4 == 1
                c = Circle(radius=np.sqrt(n) * u, stroke_color=GOOD if ok else BAD, stroke_width=4).move_to(cen)
                pts = VGroup(*[Dot(cen + np.array([i * u, j * u, 0]), radius=0.075, color=SQ)
                               for i in range(-6, 7) for j in range(-6, 7) if i * i + j * j == n])
                lab = M(rf"x^2+y^2={n}", 36, GOOD if ok else BAD).next_to(thm, DOWN, buff=0.5).align_to(thm, LEFT)
                return c, pts, lab
            seq = [13, 11, 17, 19, 29]
            c, pts, lab = ring(seq[0])
            self.play(Create(c), FadeIn(lab), run_time=1.0)
            self.play(LaggedStart(*[GrowFromCenter(p) for p in pts], lag_ratio=0.1), run_time=0.8)
            step = max(1.2, (self.left() - 1.0) / (len(seq) - 1))
            for n in seq[1:]:
                c2, pts2, lab2 = ring(n)
                self.play(Transform(c, c2), FadeOut(pts), Transform(lab, lab2), run_time=0.7)
                pts = pts2
                if len(pts2):
                    self.play(LaggedStart(*[GrowFromCenter(p) for p in pts2], lag_ratio=0.08), run_time=0.5)
                    self.hold(step - 1.2)
                else:
                    self.play(Wiggle(c, scale_value=1.04), run_time=0.5)
                    self.hold(step - 1.2)
        self.play(FadeOut(VGroup(dots, axes, c, pts, lab, thm)), run_time=0.8)

        # ---- st_3: Fermat 1640
        axis = Line(LEFT * 6.5, RIGHT * 6.5, color=GRID, stroke_width=3).shift(UP * 0.95)
        events = {}

        def marker(year, top, who, what, color=SQ):
            x = year_x(year)
            p = axis.get_center() + RIGHT * x
            d = Dot(p, radius=0.09, color=color)
            yr = T(str(year), 26, color, weight=BOLD, font=LAT_FONT)
            nm = T(who, 28, TEXT, weight=BOLD)
            ds = T(what, 22, MUTED)
            g = VGroup(yr, nm, ds).arrange(DOWN, buff=0.08)
            g.next_to(p, UP if top else DOWN, buff=0.35)
            stem = Line(p, g.get_bottom() if top else g.get_top(), stroke_width=2, color=GRID)
            return VGroup(d, stem, g)

        with self.seg("st_3"):
            self.play(Create(axis), run_time=0.8)
            m1 = marker(1640, True, L("费马", "Fermat"), L("致梅森的信", "letter to Mersenne"))
            self.play(FadeIn(m1, shift=DOWN * 0.2), run_time=0.7)
            self.at(1)
            env = VGroup(Rectangle(width=3.6, height=1.7, fill_color=PANEL2, fill_opacity=1, stroke_color=SQ,
                                   stroke_width=2))
            flap = VMobject(stroke_color=SQ, stroke_width=2).set_points_as_corners(
                [env[0].get_corner(UL), env[0].get_center() + DOWN * 0.1, env[0].get_corner(UR)])
            date = T(L("1640 年 12 月 25 日", "25 December 1640"), 22, SQ, weight=BOLD)
            env.add(flap, date.move_to(env[0].get_bottom() + UP * 0.38))
            env.next_to(axis, DOWN, buff=0.45).set_x(-3.6)
            self.play(FadeIn(env, shift=UP * 0.3), run_time=0.8)
            self.at(2)
            q = TL("证明？没有写下来", "Proof? Never written down", 26, color=MUTED, slant=ITALIC)
            q.next_to(env, RIGHT, buff=0.35)
            self.play(Write(q), run_time=0.9)
            self.at(3)
            xm = tag(L("费马圣诞定理", "Fermat's Christmas theorem"), SQ, 26).next_to(env, DOWN, buff=0.3)
            self.play(FadeIn(xm, scale=0.8), run_time=0.6)
        self.play(FadeOut(VGroup(env, q, xm)), run_time=0.5)

        # ---- st_4: Euler, Gauss
        with self.seg("st_4"):
            m2 = marker(1749, False, L("欧拉", "Euler"), L("无穷递降法", "infinite descent"), FLIP)
            self.play(FadeIn(m2, shift=UP * 0.2), run_time=0.8)
            self.at(1)
            m3 = marker(1832, True, L("高斯", "Gauss"), L("高斯整数 ℤ[i]", "Gaussian integers ℤ[i]"), ARM)
            self.play(FadeIn(m3, shift=DOWN * 0.2), run_time=0.8)

        # ---- st_5: Heath-Brown, Zagier
        with self.seg("st_5"):
            m5 = marker(1990, True, L("扎吉尔", "Zagier"), L("一句话证明", "one-sentence proof"), RECUT)
            self.play(FadeIn(m5, shift=DOWN * 0.2), run_time=0.8)
            t1 = T("A One-Sentence Proof That Every Prime", 34, TEXT, weight=BOLD)
            t2 = VGroup(T("p ≡ 1 (mod 4) Is a Sum of Two Squares", 34, TEXT, weight=BOLD))
            src = T("D. Zagier · Amer. Math. Monthly 97 (1990), 144", 22, MUTED)
            lines = [t1, t2, src]
            if ZH:
                lines.append(T("《用一句话证明：每个模 4 余 1 的素数都是两个平方数之和》", 24, SQ))
            paper = card(VGroup(*lines).arrange(DOWN, buff=0.16), pad=0.4, color=PANEL2, stroke=RECUT)
            paper.move_to(DOWN * 1.75)
            if paper.width > 9.6:
                paper.scale_to_fit_width(9.6)
            atl(self, 0, 1, 2.2 if ZH else 0.0)
            self.play(FadeIn(paper, shift=UP * 0.3), run_time=0.9)
            atl(self, 1, 2)
            m4 = marker(1984, False, L("希思-布朗", "Heath-Brown"), L("想法", "the idea"), VIOLET)
            self.play(FadeIn(m4, shift=UP * 0.2), run_time=0.8)
            atl(self, 2, 3)
            self.play(Indicate(t1, color=RECUT, scale_factor=1.04), run_time=1.2)
        self.play(FadeOut(VGroup(axis, m1, m2, m3, m4, m5, paper)), run_time=0.8)


# ------------------------------------------------------------------ 03
class S03_Easy(FScene):
    def construct(self):
        self.chapter_card(3, "容易的方向", "The easy direction")
        u = 0.46
        # ---- ez_1
        with self.seg("ez_1"):
            even = tile_square(4, u, VIOLET).move_to(LEFT * 3.3 + UP * 0.45)
            odd = tile_square(5, u, NEUTRAL).move_to(RIGHT * 3.3 + UP * 0.45)
            ev_l = M(r"(2k)^2 = 4k^2", 40).next_to(even, DOWN, buff=0.4)
            od_l = M(r"(2k+1)^2 = 4k(k+1) + 1", 40).next_to(odd, DOWN, buff=0.4)
            self.at(1)
            r = VGroup(*[M(rf"{n}^2 = {n*n}", 34, MUTED) for n in range(0, 6)]).arrange(RIGHT, buff=0.5)
            m = VGroup(*[M(rf"\equiv {n*n % 4}", 30, GOOD) for n in range(0, 6)])
            for a, b in zip(r, m):
                b.next_to(a, DOWN, buff=0.15)
            tbl = VGroup(r, m).move_to(UP * 0.6)
            self.play(LaggedStart(*[FadeIn(a) for a in r], lag_ratio=0.12), run_time=1.0)
            self.play(LaggedStart(*[FadeIn(b, shift=UP * 0.1) for b in m], lag_ratio=0.12), run_time=1.0)
            self.at(2)
            self.play(FadeOut(tbl), run_time=0.4)
            self.play(FadeIn(even, scale=0.9), run_time=0.6)
            quads = VGroup(*[Square(2 * u, stroke_color=SQ, stroke_width=4).move_to(even.get_center() + d * u)
                             for d in [UL, UR, DL, DR]])
            self.play(Create(quads), Write(ev_l), run_time=1.2)
            self.at(3)
            self.play(FadeIn(odd, scale=0.9), run_time=0.6)
            self.play(Write(od_l), run_time=1.2)

        # ---- ez_2: odd square = windmill
        with self.seg("ez_2"):
            wm = Windmill(1, 3, 2, unit=u).move_to(odd.get_center())
            self.play(FadeOut(odd[1]), run_time=0.3)
            self.play(FadeIn(wm.square), odd[0].animate.set_fill(opacity=0.15), run_time=0.7)
            self.play(LaggedStart(*[FadeIn(b, shift=(b.get_center() - wm.centre()) * 0.25) for b in wm.blades],
                                  lag_ratio=0.25), run_time=1.6)
            self.play(*[b.animate.shift((b.get_center() - wm.centre()) * 0.18) for b in wm.blades], run_time=0.6)
            self.play(*[b.animate.shift(-(b.get_center() - wm.centre()) * 0.18 / 1.18) for b in wm.blades],
                      run_time=0.6)
            self.at(1)
            bm = tag(L("风车 · 待会儿再见", "a windmill · see you later"), ARM, 24).next_to(wm, UP, buff=0.3)
            self.play(FadeIn(bm, shift=DOWN * 0.2), wm.animate.rotate(-PI / 2, about_point=wm.centre()), run_time=1.0)

        # ---- ez_3: sums of two squares mod 4
        with self.seg("ez_3"):
            self.play(FadeOut(VGroup(even, quads, ev_l, odd[0], wm, od_l, bm)), run_time=0.6)
            hdr = VGroup(M("+", 44, MUTED), M("0", 44, GOOD), M("1", 44, GOOD))
            r0 = VGroup(M("0", 44, GOOD), M("0", 44), M("1", 44))
            r1 = VGroup(M("1", 44, GOOD), M("1", 44), M("2", 44))
            grid = VGroup(hdr, r0, r1)
            for i, row in enumerate(grid):
                for j, c in enumerate(row):
                    c.move_to(np.array([j * 1.5, -i * 1.15, 0]))
            grid.move_to(LEFT * 2.6 + UP * 0.5)
            hl = Line(grid.get_corner(UL) + DOWN * 0.55 + LEFT * 0.2, grid.get_corner(UR) + DOWN * 0.55 + RIGHT * 0.2,
                      color=GRID)
            vl = Line(grid.get_corner(UL) + RIGHT * 0.6 + UP * 0.2, grid.get_corner(DL) + RIGHT * 0.6 + DOWN * 0.2,
                      color=GRID)
            cap = TL("平方和除以 4 的余数", "a² + b²  (mod 4)", 28, color=MUTED).next_to(grid, UP, buff=0.4)
            self.play(FadeIn(cap), Create(hl), Create(vl), FadeIn(hdr), FadeIn(VGroup(r0[0], r1[0])), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(c, scale=1.3) for c in [r0[1], r0[2], r1[1], r1[2]]], lag_ratio=0.3),
                      run_time=1.4)
            three = M("3", 120, BAD).move_to(RIGHT * 2.8 + UP * 0.5)
            x3 = cross_mark(BAD, 0.7).move_to(three)
            atl(self, 0, 1)
            self.play(FadeIn(three, scale=0.6), run_time=0.5)
            self.play(Create(x3), run_time=0.5)
            atl(self, 1, 2)
            ps = [3, 7, 11, 19, 23, 31, 43, 47]
            strip = VGroup(*[T(str(p), 34, BAD, font=LAT_FONT) for p in ps]).arrange(RIGHT, buff=0.5)
            strip.move_to(DOWN * 1.9)
            lab = M(r"4k+3", 34, BAD).next_to(strip, LEFT, buff=0.5)
            self.play(FadeIn(lab), LaggedStart(*[FadeIn(s, shift=UP * 0.2) for s in strip], lag_ratio=0.1), run_time=1.0)
            strikes = VGroup(*[Line(s.get_left() + LEFT * 0.08, s.get_right() + RIGHT * 0.08, color=BAD, stroke_width=4)
                               for s in strip])
            self.play(LaggedStart(*[Create(s) for s in strikes], lag_ratio=0.1), run_time=0.9)
        self.play(FadeOut(VGroup(grid, hl, vl, cap, three, x3, strip, lab, strikes)), run_time=0.6)

        # ---- ez_4: 21
        with self.seg("ez_4"):
            n21 = T("21", 90, TEXT, weight=BOLD, font=LAT_FONT).move_to(LEFT * 4.6 + UP * 0.9)
            r = M(r"\equiv 1 \pmod 4", 36, GOOD).next_to(n21, DOWN, buff=0.2)
            self.play(FadeIn(n21), run_time=0.5)
            self.play(Write(r), run_time=0.7)
            atl(self, 0, 1)
            tries = VGroup()
            for k, a in enumerate([1, 2, 3, 4]):
                rest = 21 - a * a
                e = M(rf"21 - {a}^2 = {rest}", 36)
                tries.add(e)
            tries.arrange(DOWN, buff=0.28, aligned_edge=LEFT).move_to(LEFT * 0.3 + UP * 0.6)
            xs_ = VGroup(*[cross_mark(BAD, 0.16).next_to(e, RIGHT, buff=0.3) for e in tries])
            nt = TL("都不是平方数", "none is a square", 26, color=BAD).next_to(tries, DOWN, buff=0.3)
            for e, x in zip(tries, xs_):
                self.play(FadeIn(e, shift=RIGHT * 0.2), run_time=0.35)
                self.play(Create(x), run_time=0.2)
            self.play(FadeIn(nt), run_time=0.4)
            f = M(r"21 = 3 \times 7", 40, MUTED).next_to(r, DOWN, buff=0.35)
            self.play(Write(f), run_time=0.6)
            atl(self, 1, 2)
            nec = VGroup(TL("必要条件", "necessary", 34), check_mark(GOOD, 0.4)).arrange(RIGHT, buff=0.3)
            suf = VGroup(TL("充分条件", "sufficient", 34), cross_mark(BAD, 0.2)).arrange(RIGHT, buff=0.35)
            ns = VGroup(nec, suf).arrange(DOWN, buff=0.35, aligned_edge=LEFT).move_to(RIGHT * 4.3 + UP * 0.8)
            self.play(FadeIn(nec, shift=LEFT * 0.2), run_time=0.6)
            self.play(FadeIn(suf, shift=LEFT * 0.2), run_time=0.6)
            atl(self, 2, 3)
            pin = card(TL("素数条件用在哪里？", "Where is primality used?", 30, color=SQ), pad=0.25, stroke=SQ)
            pin.move_to(DOWN * 1.85)
            self.play(FadeIn(pin, shift=UP * 0.2), run_time=0.7)
            atl(self, 3, 4)
            self.play(Indicate(pin, color=SQ, scale_factor=1.06), run_time=1.0)
        self.play(FadeOut(VGroup(n21, r, tries, xs_, nt, f, ns, pin)), run_time=0.6)

        # ---- ez_5: the hard direction
        with self.seg("ez_5"):
            reps = [(5, 1, 2), (13, 2, 3), (17, 1, 4), (29, 2, 5), (37, 1, 6), (41, 4, 5), (53, 2, 7), (61, 5, 6),
                    (73, 3, 8), (89, 5, 8), (97, 4, 9)]
            cells = VGroup(*[M(rf"{p} = {a}^2 + {b}^2", 32) for p, a, b in reps])
            cells.arrange_in_grid(rows=4, cols=3, buff=(0.7, 0.3), flow_order="dr").move_to(UP * 0.35)
            atl(self, 0, 1)
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.15) for c in cells], lag_ratio=0.12), run_time=2.2)
            atl(self, 1, 2)
            ex = TL("存在性命题", "a pure existence statement", 40, color=SQ, weight=BOLD)
            q = M(r"p = \;?^2 + \;?^2", 64, SQ)
            grp = VGroup(ex, q).arrange(DOWN, buff=0.35)
            back = BackgroundRectangle(grp, color=BG, fill_opacity=0.85, buff=0.35)
            self.play(cells.animate.set_opacity(0.12), FadeIn(back), FadeIn(grp, scale=0.9), run_time=1.0)
            atl(self, 2, 3)
            nf = TL("没有公式", "no formula", 30, color=BAD).next_to(grp, DOWN, buff=0.3)
            self.play(FadeIn(nf, shift=UP * 0.15), Wiggle(q, scale_value=1.05), run_time=1.0)
        self.play(FadeOut(VGroup(cells, back, grp, nf)), run_time=0.7)


# ------------------------------------------------------------------ 04
class S04_Parity(FScene):
    def construct(self):
        self.chapter_card(4, "奇偶与对合", "Parity and involutions")
        # ---- par_1
        with self.seg("par_1"):
            box = RoundedRectangle(corner_radius=0.2, width=3.2, height=2.2, fill_color=PANEL2, fill_opacity=1,
                                   stroke_color=GRID).move_to(LEFT * 3.5 + UP * 0.4)
            qm = T("?", 100, MUTED, weight=BOLD, font=LAT_FONT).move_to(box)
            cap = TL("解在哪里？", "where is the solution?", 26, color=MUTED).next_to(box, DOWN, buff=0.25)
            self.play(FadeIn(box), Write(qm), FadeIn(cap), run_time=0.9)
            self.at(1)
            cnt = TL("数一数", "count", 44, color=SQ, weight=BOLD).move_to(RIGHT * 2.8 + UP * 1.3)
            self.play(FadeIn(cnt, shift=LEFT * 0.3), run_time=0.6)
            self.at(2)
            chain = VGroup(TL("解的个数为奇数", "# solutions is odd", 34), M(r"\Longrightarrow", 44, MUTED),
                           M(r"\ne 0", 50, GOOD)).arrange(RIGHT, buff=0.3).next_to(cnt, DOWN, buff=0.6)
            chain.shift(LEFT * 0.4)
            self.play(Write(chain), run_time=1.2)
        self.play(FadeOut(VGroup(box, qm, cap, cnt, chain)), run_time=0.5)

        # ---- par_2: pairing shows oddness
        rng = np.random.default_rng(7)
        with self.seg("par_2"):
            pos = [np.array([x, y, 0]) for x, y in
                   [(-4.5, 1.2), (-3.2, -0.6), (-1.8, 1.5), (-0.6, -0.2), (0.8, 1.4), (1.9, -0.8), (3.1, 1.0),
                    (4.3, -0.4), (5.1, 1.6)]]
            dots = VGroup(*[Dot(p, radius=0.16, color=TEXT) for p in pos])
            self.play(LaggedStart(*[GrowFromCenter(d) for d in dots], lag_ratio=0.08), run_time=1.0)
            pairs = [(0, 1), (2, 3), (4, 5), (6, 7)]
            arcs = VGroup()
            self.at(0, 1.2)
            for a, b in pairs:
                arc = ArcBetweenPoints(pos[a], pos[b], angle=-PI / 3, stroke_color=FLIP, stroke_width=5)
                arcs.add(arc)
                self.play(Create(arc), dots[a].animate.set_color(FLIP), dots[b].animate.set_color(FLIP), run_time=0.45)
            self.play(dots[8].animate.set_color(SQ).scale(1.5), Flash(dots[8], color=SQ), run_time=0.7)
            odd = TL("剩下一个 ⇒ 奇数", "one left over ⇒ odd", 32, color=SQ).move_to(DOWN * 1.6 + RIGHT * 2.5)
            self.play(FadeIn(odd), run_time=0.5)
        self.play(FadeOut(VGroup(dots, arcs, odd)), run_time=0.5)

        # ---- par_3: involution
        blob = Ellipse(width=8.6, height=4.0, stroke_color=GRID, stroke_width=2, fill_color=PANEL, fill_opacity=0.6)
        blob.move_to(DOWN * 0.15)
        P = [np.array(p) for p in [(-3.2, 0.9, 0), (-2.1, -0.8, 0), (-1.2, 1.1, 0), (-0.1, -0.9, 0), (0.6, 0.8, 0),
                                   (1.7, -0.4, 0), (2.7, 1.0, 0), (3.3, -0.6, 0), (-2.9, -0.1, 0), (1.3, 1.45, 0),
                                   (0.2, 0.05, 0)]]
        P = [p + DOWN * 0.15 for p in P]
        pairs = [(0, 1), (2, 3), (4, 5), (6, 7)]
        fixed = [8, 9, 10]
        with self.seg("par_3"):
            title = VGroup(TL("对合", "involution", 44, color=SQ, weight=BOLD))
            if ZH:
                title.add(T("involution", 26, MUTED, slant=ITALIC))
            title.arrange(RIGHT, buff=0.3, aligned_edge=DOWN).to_edge(UP, buff=0.95)
            Sl = M("S", 44, MUTED).next_to(blob, LEFT, buff=0.2).shift(UP * 1.2)
            dots = VGroup(*[Dot(p, radius=0.13, color=TEXT) for p in P])
            self.play(FadeIn(title, shift=DOWN * 0.2), FadeIn(blob), FadeIn(Sl), run_time=0.8)
            self.play(LaggedStart(*[GrowFromCenter(d) for d in dots], lag_ratio=0.05), run_time=0.8)
            self.at(1)
            a, b = P[4], P[5]
            la = M("a", 34).next_to(dots[4], UP, buff=0.12)
            lb = M("f(a)", 34).next_to(dots[5], DOWN, buff=0.12)
            ar1 = CurvedArrow(a + RIGHT * 0.12, b + UP * 0.15, angle=-PI / 2.5, color=FLIP, stroke_width=4)
            ar2 = CurvedArrow(b + LEFT * 0.12, a + DOWN * 0.15, angle=-PI / 2.5, color=FLIP, stroke_width=4)
            self.play(FadeIn(la), dots[4].animate.set_color(FLIP), run_time=0.4)
            self.play(Create(ar1), FadeIn(lb), dots[5].animate.set_color(FLIP), run_time=0.8)
            atl(self, 1, 2)
            self.play(Create(ar2), run_time=0.8)
            ff = M(r"f(f(a)) = a", 44, FLIP).next_to(blob, DOWN, buff=0.22)
            self.play(Write(ff), run_time=0.8)

        # ---- par_4: pairs + fixed points
        with self.seg("par_4"):
            self.play(FadeOut(VGroup(ar1, ar2, la, lb)), run_time=0.4)
            arcs = VGroup(*[ArcBetweenPoints(P[i], P[j], angle=-PI / 2.6, stroke_color=FLIP, stroke_width=4.5)
                            for i, j in pairs])
            self.play(LaggedStart(*[Create(a) for a in arcs], lag_ratio=0.2),
                      *[dots[i].animate.set_color(FLIP) for pr in pairs for i in pr], run_time=1.6)
            self.at(1)
            loops = VGroup(*[ring(dots[i], SQ, r=0.3) for i in fixed])
            self.play(*[dots[i].animate.set_color(SQ).scale(1.25) for i in fixed],
                      LaggedStart(*[Create(l) for l in loops], lag_ratio=0.2), run_time=1.0)
            fl = TL("不动点", "fixed points", 30, color=SQ).next_to(loops[1], UR, buff=0.1)
            self.play(FadeIn(fl), run_time=0.4)

        # ---- par_5: parity
        with self.seg("par_5"):
            self.play(arcs.animate.set_stroke(opacity=0.3), *[dots[i].animate.set_opacity(0.35) for pr in pairs for i in pr],
                      run_time=0.8)
            ev = TL("成对：偶数个", "pairs: even", 28, color=FLIP).next_to(blob, LEFT, buff=-2.6).shift(DOWN * 1.55)
            self.play(FadeIn(ev), run_time=0.5)
            self.at(1)
            law = M(r"|S| \equiv \#\mathrm{Fix}(f) \pmod 2", 48, SQ)
            law.move_to(ff)
            self.play(ReplacementTransform(ff, law), run_time=1.0)
            self.play(Circumscribe(law, color=SQ), run_time=1.0)
        self.play(FadeOut(VGroup(blob, dots, arcs, loops, fl, ev, Sl, title)), law.animate.to_edge(UP, buff=0.95),
                  run_time=0.8)

        # ---- par_6: two involutions
        with self.seg("par_6"):
            n = 7
            Q = [np.array([-4.2 + 1.4 * i, 0.15, 0]) for i in range(n)]
            dd = VGroup(*[Dot(q, radius=0.15, color=TEXT) for q in Q])
            self.play(LaggedStart(*[GrowFromCenter(d) for d in dd], lag_ratio=0.08), run_time=0.8)
            self.at(1)
            g_pairs, f_pairs = [(1, 2), (3, 4), (5, 6)], [(0, 1), (2, 3), (4, 5)]
            g_arcs = VGroup(*[ArcBetweenPoints(Q[i], Q[j], angle=-PI / 1.6, stroke_color=FLIP, stroke_width=5)
                              for i, j in g_pairs])
            f_arcs = VGroup(*[ArcBetweenPoints(Q[i], Q[j], angle=PI / 1.6, stroke_color=RECUT, stroke_width=5)
                              for i, j in f_pairs])
            gl = M("g", 40, FLIP).next_to(dd, LEFT, buff=0.5).shift(UP * 0.5)
            fl2 = M("f", 40, RECUT).next_to(dd, LEFT, buff=0.5).shift(DOWN * 0.5)
            self.play(FadeIn(fl2), LaggedStart(*[Create(a) for a in f_arcs], lag_ratio=0.2), run_time=1.0)
            self.play(FadeIn(gl), LaggedStart(*[Create(a) for a in g_arcs], lag_ratio=0.2), run_time=1.0)
            self.at(2)
            fl_loop = ring(dd[6], RECUT, r=0.32)
            one = TL("f 恰有 1 个不动点", "f has exactly one fixed point", 28, color=RECUT)
            one.next_to(dd, DOWN, buff=1.1)
            self.play(Create(fl_loop), dd[6].animate.set_color(RECUT), FadeIn(one), run_time=0.9)
            res = M(r"\#\mathrm{Fix}(g) \equiv \#\mathrm{Fix}(f) = 1 \pmod 2 \;\Rightarrow\; \#\mathrm{Fix}(g) \ge 1",
                    40, TEXT).next_to(one, DOWN, buff=0.3)
            self.play(Write(res), run_time=1.6)
            g_loop = ring(dd[0], FLIP, r=0.32)
            self.play(Create(g_loop), dd[0].animate.set_color(FLIP).scale(1.3), Flash(dd[0], color=FLIP), run_time=0.9)
        self.play(FadeOut(VGroup(dd, g_arcs, f_arcs, gl, fl2, fl_loop, one, res, g_loop, law)), run_time=0.6)

        # ---- par_7: Sperner nod
        with self.seg("par_7"):
            tri = self.sperner_icon().scale(1.0).move_to(RIGHT * 2.6 + DOWN * 0.1)
            lbl = VGroup(TL("斯潘纳引理", "Sperner's lemma", 40, weight=BOLD),
                         TL("数“门”的奇偶", "count doors, mod 2", 30, color=MUTED)).arrange(DOWN, buff=0.25,
                                                                                      aligned_edge=LEFT)
            lbl.move_to(LEFT * 3.3)
            self.play(FadeIn(tri, lag_ratio=0.02), run_time=1.2)
            self.at(1)
            self.play(FadeIn(lbl, shift=RIGHT * 0.2), run_time=0.8)
            self.play(Indicate(tri[-1], color=SQ), run_time=1.0)
        self.play(FadeOut(VGroup(tri, lbl)), run_time=0.6)

    def sperner_icon(self):
        n = 4
        A, B, C = np.array([-2.0, -1.6, 0]), np.array([2.0, -1.6, 0]), np.array([0, 1.9, 0])
        P = lambda i, j: A + (B - A) * i / n + (C - A) * j / n  # noqa: E731
        cols = {}
        for i in range(n + 1):
            for j in range(n + 1 - i):
                k = n - i - j
                if j == 0 and k == 0:
                    c = 0
                elif i == 0 and k == 0:
                    c = 1
                elif i == 0 and j == 0:
                    c = 2
                elif j == 0:
                    c = [0, 1][(i + k) % 2] if False else (0 if i <= 2 else 1)
                elif k == 0:
                    c = 1 if j >= 2 else 2
                elif i == 0:
                    c = 2 if j <= 1 else 0
                else:
                    c = [0, 1, 2][(i * 2 + j) % 3]
                cols[(i, j)] = c
        palette = [RECUT, ARM, SQ]
        edges = VGroup()
        tris = []
        for i in range(n):
            for j in range(n - i):
                tris.append([(i, j), (i + 1, j), (i, j + 1)])
                if i + j < n - 1:
                    tris.append([(i + 1, j), (i + 1, j + 1), (i, j + 1)])
        for t in tris:
            edges.add(Polygon(*[P(*v) for v in t], stroke_color=GRID, stroke_width=2, fill_opacity=0))
        doors = VGroup()
        for t in tris:
            for a, b in [(0, 1), (1, 2), (2, 0)]:
                ca, cb = cols[t[a]], cols[t[b]]
                if {ca, cb} == {0, 1}:
                    doors.add(Line(P(*t[a]), P(*t[b]), stroke_color=SQ, stroke_width=6))
        verts = VGroup(*[Dot(P(i, j), radius=0.09, color=palette[c]) for (i, j), c in cols.items()])
        full = VGroup(*[Polygon(*[P(*v) for v in t], stroke_width=0, fill_color=GOOD, fill_opacity=0.35)
                        for t in tris if {cols[v] for v in t} == {0, 1, 2}])
        return VGroup(edges, doors, verts, full)


# ------------------------------------------------------------------ 05
class S05_Set(FScene):
    def construct(self):
        self.chapter_card(5, "制造对称", "Creating a symmetry")
        # ---- set_1
        with self.seg("set_1"):
            plan = VGroup(TL("想要的解", "the solutions we want", 40),
                          M("=", 54, MUTED), TL("某个对合的不动点", "fixed points of an involution", 40, color=SQ))
            plan.arrange(RIGHT, buff=0.35).move_to(UP * 0.4)
            self.play(FadeIn(plan[0], shift=RIGHT * 0.2), run_time=0.7)
            self.play(FadeIn(plan[1]), FadeIn(plan[2], shift=LEFT * 0.2), run_time=0.8)
        self.play(plan.animate.scale(0.6).to_edge(UP, buff=0.95), run_time=0.6)

        # ---- set_2
        with self.seg("set_2"):
            e1 = M(r"p", r"=", r"x^2", r"+", r"y^2", font_size=64)
            self.play(Write(e1), run_time=0.8)
            note = TL("p 是奇数 ⇒ 一奇一偶", "p odd ⇒ one even, one odd", 28, color=MUTED).next_to(e1, DOWN, buff=0.5)
            self.play(FadeIn(note), run_time=0.5)
            self.at(1)
            e2 = M(r"p", r"=", r"x^2", r"+", r"(2y)^2", font_size=64)
            self.play(TransformMatchingTex(e1, e2), run_time=1.0)
            e3 = M(r"p", r"=", r"x^2", r"+", r"4", r"\cdot", r"y", r"\cdot", r"y", font_size=64)
            self.play(TransformMatchingTex(e2, e3), run_time=1.0)
        # ---- set_3
        with self.seg("set_3"):
            atl(self, 0, 1)
            z = M("z", font_size=64, color=VIOLET).move_to(e3[8])
            self.play(e3[8].animate.shift(UP * 0.6).set_opacity(0), FadeIn(z, shift=UP * 0.6), run_time=0.9)
            self.play(Flash(z, color=VIOLET), run_time=0.6)
            atl(self, 1, 2)
            Sdef = M(r"S = \{\, (x,y,z) \in \mathbb{Z}_{>0}^3 \;:\; x^2 + 4yz = p \,\}", 50)
            Sdef.move_to(DOWN * 0.2)
            self.play(VGroup(e3, z).animate.shift(UP * 1.3), FadeOut(note), run_time=0.6)
            self.play(Write(Sdef), run_time=1.6)
        # ---- set_4
        with self.seg("set_4"):
            fin = M(r"x^2 < p, \quad yz < p/4 \;\Rightarrow\; |S| < \infty", 40, MUTED).next_to(Sdef, DOWN, buff=0.4)
            self.play(FadeIn(fin), run_time=0.8)
            self.at(1)
            self.play(FadeOut(VGroup(e3, z, fin)), Sdef.animate.scale(0.8).next_to(plan, DOWN, buff=0.35), run_time=0.7)
            trip = [(1, 1, 3), (1, 3, 1), (3, 1, 1)]
            cards = VGroup()
            for t in trip:
                x, y, zz = t
                c = card(VGroup(M(rf"({x},{y},{zz})", 46), M(rf"{x*x} + 4\cdot{y}\cdot{zz} = 13", 30, MUTED))
                         .arrange(DOWN, buff=0.2), pad=0.3)
                cards.add(c)
            cards.arrange(RIGHT, buff=0.7).move_to(DOWN * 0.55)
            p13 = M("p = 13", 36, SQ).next_to(cards, UP, buff=0.3).align_to(cards, LEFT)
            self.play(FadeIn(p13), LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in cards], lag_ratio=0.25),
                      run_time=1.3)
        # ---- set_5
        with self.seg("set_5"):
            atl(self, 0, 1)
            gdef = M(r"g:\ (x,y,z) \mapsto (x,z,y)", 44, FLIP).next_to(cards, UP, buff=0.3).align_to(cards, RIGHT)
            self.play(Write(gdef), run_time=1.0)
            atl(self, 1, 2)
            arc = ArcBetweenPoints(cards[0].get_bottom() + DOWN * 0.05, cards[1].get_bottom() + DOWN * 0.05, angle=PI / 3,
                                   stroke_color=FLIP, stroke_width=5)
            self.play(Create(arc), run_time=0.7)
            loop = self_loop(cards[2].get_bottom() + DOWN * 0.05, FLIP, up=False, r=0.22)
            self.play(Create(loop), cards[2][0].animate.set_stroke(FLIP, 3), run_time=0.7)
            atl(self, 2, 3)
            sol = M(r"y = z \;\Rightarrow\; p = x^2 + (2y)^2", 40, SQ).next_to(cards, DOWN, buff=0.75).shift(LEFT * 1.2)
            self.play(Write(sol), run_time=1.0)
            ex = M(r"13 = 3^2 + 2^2", 40, GOOD).next_to(sol, RIGHT, buff=0.6)
            self.play(FadeIn(ex, shift=LEFT * 0.2), run_time=0.6)
        self.play(FadeOut(VGroup(cards, p13, gdef, arc, loop, sol, ex)), run_time=0.6)

        # ---- set_6: reduction chain
        with self.seg("set_6"):
            b1 = card(TL("g 有不动点", "g has a fixed point", 32), pad=0.28, stroke=FLIP)
            b2 = card(TL("|S| 是奇数", "|S| is odd", 32), pad=0.28, stroke=SQ)
            b3 = card(TL("另一个对合 f 恰有 1 个不动点", "another involution f with exactly 1 fixed point", 32),
                      pad=0.28, stroke=RECUT)
            chain = VGroup(b1, M(r"\Longleftarrow", 48, MUTED), b2).arrange(RIGHT, buff=0.35).move_to(UP * 0.3)
            self.play(FadeIn(b1, shift=RIGHT * 0.2), run_time=0.6)
            atl(self, 0, 1)
            self.play(FadeIn(chain[1]), FadeIn(b2, shift=LEFT * 0.2), run_time=0.8)
            atl(self, 1, 2)
            arr2 = M(r"\Big\Uparrow", 48, MUTED).next_to(b2, DOWN, buff=0.2)
            b3.next_to(arr2, DOWN, buff=0.2)
            self.play(FadeIn(arr2), FadeIn(b3, shift=UP * 0.2), run_time=0.9)
            self.play(Indicate(b3, color=RECUT, scale_factor=1.04), run_time=1.0)
        self.play(FadeOut(VGroup(chain, arr2, b3)), run_time=0.5)

        # ---- set_7: the created symmetry, seen in the (y, z) plane for p = 41
        with self.seg("set_7"):
            self.play(Sdef.animate.set_opacity(0.0), run_time=0.3)
            u = 0.47
            o = LEFT * 5.0 + DOWN * 2.45
            axes = VGroup(Arrow(o, o + RIGHT * 11 * u, buff=0, stroke_width=3, color=MUTED, tip_length=0.18),
                          Arrow(o, o + UP * 11 * u, buff=0, stroke_width=3, color=MUTED, tip_length=0.18))
            ly = M("y", 34, MUTED).next_to(axes[0], RIGHT, buff=0.1)
            lz = M("z", 34, MUTED).next_to(axes[1], UP, buff=0.1)
            diag = DashedLine(o, o + (RIGHT + UP) * 10.5 * u, color=FLIP, stroke_width=3)
            S41 = S_of(41)
            xcol = {1: ARM, 3: VIOLET, 5: SQ}
            pts = VGroup(*[Dot(o + RIGHT * y * u + UP * z * u, radius=0.11, color=xcol[x]) for x, y, z in S41])
            legend = VGroup(*[VGroup(Dot(radius=0.1, color=c), M(f"x={x}", 30, MUTED)).arrange(RIGHT, buff=0.15)
                              for x, c in xcol.items()]).arrange(DOWN, aligned_edge=LEFT, buff=0.2)
            legend.move_to(UP * 0.7)
            legend.shift(RIGHT * (1.0 - legend.get_left()[0]))
            ttl = M(r"x^2 + 4yz = 41", 40).next_to(legend, UP, buff=0.45).align_to(legend, LEFT)
            self.play(Create(axes), FadeIn(ly), FadeIn(lz), FadeIn(ttl), run_time=0.8)
            self.play(LaggedStart(*[GrowFromCenter(d) for d in pts], lag_ratio=0.08), FadeIn(legend), run_time=1.2)
            atl(self, 1, 2)
            self.play(Create(diag), run_time=0.8)
            mirror = pts.copy()
            self.play(Rotate(mirror, PI, axis=np.array([1, 1, 0]), about_point=o), run_time=1.6)
            self.remove(mirror)
            fixed = [d for d, (x, y, z) in zip(pts, S41) if y == z][0]
            self.play(fixed.animate.scale(1.6), Flash(fixed, color=SQ), run_time=0.8)
            ann = M(r"(5,2,2):\ 41 = 5^2 + 4^2", 38, SQ).next_to(legend, DOWN, buff=0.55).align_to(legend, LEFT)
            lead = DashedLine(fixed.get_center(), ann.get_left() + LEFT * 0.1, color=SQ, stroke_width=2)
            ann.add(lead)
            self.play(FadeIn(ann), run_time=0.6)
            atl(self, 2, 3)
            room = TL("问题变大了，反而有了对称", "a bigger problem, with a symmetry", 30, color=FLIP)
            room.next_to(ann, DOWN, buff=0.5).align_to(legend, LEFT)
            self.play(FadeIn(room, shift=UP * 0.2), run_time=0.8)
        self.play(FadeOut(VGroup(axes, ly, lz, diag, pts, legend, ttl, ann, room, plan, Sdef)), run_time=0.8)
