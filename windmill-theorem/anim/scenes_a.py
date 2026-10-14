"""Chapters 00-05: opening, history, statement, necessity, pairing, the set S."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from manim import *  # noqa: F401,F403

from base import (NarratedScene, Windmill, below, card, chip, col, ease, ease_out, fit, mtx,
                  triple_tex, tx, windmill_icon, wrap)
from config import (BG, CORAL, FAINT, FONT_EN, GOLD, INK, LANG, LIME, MUTED, PANEL, SKY, T, TEAL, VIOLET)
import geometry as G


def speech_bubble(text, color=SKY, width=None, size=44, font=FONT_EN, max_w=10.6):
    t = fit(text, size=size, max_w=max_w, color=INK, font=font)
    w = width or t.width + 1.0
    box = RoundedRectangle(corner_radius=0.35, width=w, height=t.height + 0.8, stroke_color=color,
                           stroke_width=3, fill_color=PANEL, fill_opacity=0.95)
    tail = Polygon(box.get_corner(DL) + RIGHT * 0.6 + UP * 0.02, box.get_corner(DL) + RIGHT * 1.2 + UP * 0.02,
                   box.get_corner(DL) + RIGHT * 0.35 + DOWN * 0.45, stroke_color=color, stroke_width=3,
                   fill_color=PANEL, fill_opacity=0.95)
    t.move_to(box)
    return VGroup(tail, box, t)


def avatar(letter, color):
    c = Circle(radius=0.42, stroke_color=color, stroke_width=3, fill_color=color, fill_opacity=0.15)
    l = tx(letter, size=36, color=color, weight="BOLD", font=FONT_EN).move_to(c)
    return VGroup(c, l)


def self_loop(point, color, radius=0.28, direction=UP):
    arc = Arc(radius=radius, start_angle=-PI * 0.2, angle=PI * 1.4, color=color, stroke_width=4)
    arc.add_tip(tip_length=0.14)
    ang = np.arctan2(direction[1], direction[0]) - PI / 2
    arc.rotate(ang, about_point=ORIGIN)
    arc.move_to(point + direction * (radius + 0.12))
    return arc


# ===================================================================== 00
class S00_Open(NarratedScene):
    number = 0

    def construct(self):
        # o1 ------------------------------------------------------------
        with self.say("o1"):
            q = avatar("Q", SKY).move_to(LEFT * 4.6 + UP * 0.6)
            bub = speech_bubble("What's your favorite theorem?", size=48).next_to(q, RIGHT, 0.35).shift(UP * 0.55)
            self.play(GrowFromCenter(q), run_time=0.5)
            self.play(FadeIn(bub[:2], shift=RIGHT * 0.2), run_time=0.5)
            self.play(AddTextLetterByLetter(bub[2], time_per_char=0.045))
            if LANG == "zh":
                cn = tx("你最喜欢的定理是什么？", size=30, color=MUTED).next_to(bub, DOWN, 0.35).align_to(bub, LEFT)
                self.play(FadeIn(cn, shift=UP * 0.1), run_time=0.6)
            else:
                cn = VGroup()
        # o2 ------------------------------------------------------------
        with self.say("o2") as d:
            head = VGroup(q, bub, cn)
            self.play(head.animate.scale(0.62).to_edge(UP, buff=0.55), run_time=0.8)
            labels = [T("陈述", "State it"), T("证明", "Prove it"), T("条件", "Conditions"),
                      T("推广", "Generalize"), T("意义", "Meaning")]
            colors = [INK, GOLD, CORAL, TEAL, VIOLET]
            chips = VGroup(*[chip(l, color=c, size=32) for l, c in zip(labels, colors)]).arrange(RIGHT, buff=0.75)
            chips.move_to(DOWN * 0.1)
            arrows = VGroup(*[Arrow(chips[k].get_right(), chips[k + 1].get_left(), buff=0.08, stroke_width=3,
                                    color=MUTED, max_tip_length_to_length_ratio=0.3) for k in range(4)])
            if LANG == "en":
                self.at(1, lead=0.1)
            span = max(0.4, (d - (self.renderer.time - self._line[1]) - 1.0) / 5)
            for k in range(5):
                anims = [FadeIn(chips[k], shift=UP * 0.25, scale=0.9)]
                if k:
                    anims.append(GrowArrow(arrows[k - 1]))
                self.play(*anims, run_time=min(0.7, span))
                if span > 0.7:
                    self.wait(span - 0.7)
        # o3 ------------------------------------------------------------
        with self.say("o3") as d:
            self.play(LaggedStart(*[Indicate(c, color=None, scale_factor=1.12) for c in chips], lag_ratio=0.15), run_time=1.4)
            self.at_frac(0.55)
            self.play(FadeOut(VGroup(head, chips, arrows), shift=UP * 0.4), run_time=0.8)
            exp = chip(T("一个小实验", "a small experiment"), color=GOLD, size=30).to_edge(UP, buff=0.6)
            self.play(FadeIn(exp, shift=DOWN * 0.2), run_time=0.6)

        # number line of odd primes
        ux = 0.27
        x0 = -6.1
        y_line = -1.25

        def X(n):
            return np.array([x0 + n * ux, y_line, 0])

        primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]
        axis = Arrow(X(0) + LEFT * 0.1, X(46), buff=0, stroke_width=3, color=FAINT, max_tip_length_to_length_ratio=0.02)
        dots = {p: Dot(X(p), radius=0.07, color=INK) for p in primes}
        nums = {p: tx(str(p), size=24, color=INK, font=FONT_EN).next_to(dots[p], DOWN, 0.18) for p in primes}
        reps = {5: (1, 2), 13: (2, 3), 17: (1, 4), 29: (2, 5), 37: (1, 6), 41: (4, 5)}
        cu = 0.15

        def tiles(p):
            a, b = reps[p]
            sa = Square(a * cu, stroke_width=1.5, stroke_color=BG, fill_color=GOLD, fill_opacity=0.95)
            sb = Square(b * cu, stroke_width=1.5, stroke_color=BG, fill_color=TEAL, fill_opacity=0.95)
            g = VGroup(sb, sa).arrange(UP, buff=0.04)
            g.next_to(dots[p], UP, 0.3)
            lab = mtx(r"%d^2+%d^2" % (a, b), size=26).next_to(g, UP, 0.12)
            return VGroup(g, lab)

        tile = {p: tiles(p) for p in reps}

        # o4 ------------------------------------------------------------
        with self.say("o4") as d:
            self.play(GrowArrow(axis), run_time=0.7)
            self.play(LaggedStart(*[AnimationGroup(GrowFromCenter(dots[p]), FadeIn(nums[p])) for p in primes],
                                  lag_ratio=0.08), run_time=1.4)
            order = [5, 13, 17, 29]
            if LANG == "en":
                self.at(1, lead=0.1)
            t_start = self.renderer.time - self._line[1]
            per = max(0.8, (d - t_start - 1.6) / 4)
            for p in order:
                self.play(Indicate(dots[p], color=GOLD), FadeIn(tile[p][0], shift=UP * 0.2), Write(tile[p][1]),
                          run_time=min(0.9, per))
                if per > 0.9:
                    self.wait(per - 0.9)
            self.play(*[FadeIn(tile[p], shift=UP * 0.2) for p in (37, 41)], run_time=0.8)
        # o5 ------------------------------------------------------------
        bad = [3, 7, 11, 19, 23, 31, 43]
        crosses = VGroup(*[Cross(dots[p], stroke_color=CORAL, stroke_width=4, scale_factor=2.2) for p in bad])
        qs = VGroup(*[tx("?", size=30, color=CORAL, font=FONT_EN).next_to(dots[p], UP, 0.35) for p in bad])
        with self.say("o5") as d:
            for p, qm in zip(bad[:5], qs[:5]):
                self.play(FadeIn(qm, shift=DOWN * 0.15), Wiggle(dots[p], scale_value=1.6), run_time=0.45)
            self.play(FadeIn(qs[5:]), run_time=0.3)
            self.play(Transform(qs, crosses), run_time=0.7)
        # o6 ------------------------------------------------------------
        with self.say("o6") as d:
            good = list(reps)
            mods = VGroup(*[mtx(str(p % 4), size=26, color=TEAL if p % 4 == 1 else CORAL).next_to(nums[p], DOWN, 0.12)
                            for p in primes])
            modlab = tx(T("除以 4 的余数", "remainder mod 4"), size=24, color=MUTED).next_to(mods, LEFT, 0.25).shift(LEFT * 0.1)
            modlab.move_to(np.array([x0 + 0.1 + modlab.width / 2, mods.get_y() - 0.45, 0]))
            self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.1) for m in mods], lag_ratio=0.05), FadeIn(modlab), run_time=1.2)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.35)
            self.play(*[dots[p].animate.set_color(TEAL).scale(1.3) for p in good],
                      *[dots[p].animate.set_color(CORAL) for p in bad], run_time=0.8)
            leg1 = chip(T("余 1：能拆开", "remainder 1: splits"), color=TEAL, size=28)
            leg3 = chip(T("余 3：拆不开", "remainder 3: never"), color=CORAL, size=28)
            legend = VGroup(leg1, leg3).arrange(RIGHT, buff=0.6).move_to(UP * 2.35)
            self.play(FadeIn(leg1, shift=DOWN * 0.15), run_time=0.6)
            self.play(FadeIn(leg3, shift=DOWN * 0.15), run_time=0.6)
        # o7 ------------------------------------------------------------
        with self.say("o7") as d:
            ask = fit(T("为什么只看除以 4 的余数就够了？", "Why is the remainder mod 4 enough?"), size=34, max_w=11)
            ask.move_to(UP * 2.35)
            self.play(FadeOut(VGroup(legend, exp)), FadeIn(ask, shift=DOWN * 0.15), run_time=0.8)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.42)
            everything = VGroup(axis, *dots.values(), *nums.values(), *tile.values(), qs, mods, modlab, ask)
            self.play(FadeOut(everything, shift=DOWN * 0.3), run_time=0.8)
            title = tx(T("费马平方和定理", "Fermat's Two-Square Theorem"), size=72 if LANG == "zh" else 64,
                       color=INK, weight="BOLD")
            stmt = mtx(r"p=a^2+b^2", r"\iff", r"p\equiv 1 \pmod 4", size=52)
            stmt[0].set_color(TEAL)
            stmt[2].set_color(GOLD)
            sub = tx(T("一句话的证明 · 一架风车", "a one-sentence proof · a windmill"), size=32, color=MUTED)
            block = VGroup(title, stmt, sub).arrange(DOWN, buff=0.45).move_to(UP * 0.55)
            self.play(Write(title), run_time=1.2)
            self.play(FadeIn(stmt, shift=UP * 0.2), run_time=0.9)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.72)
            mill = windmill_icon((3, 2, 4), size=1.1).next_to(sub, LEFT, 0.35)
            self.play(FadeIn(sub), GrowFromCenter(mill), run_time=0.8)
            self.play(Rotate(mill, angle=-2 * PI, rate_func=ease), run_time=2.2)
        self.clear_stage(0.8)


# ===================================================================== 01
def envelope_icon(color=GOLD):
    r = Rectangle(width=1.0, height=0.66, stroke_color=color, stroke_width=3)
    v = VMobject(stroke_color=color, stroke_width=3).set_points_as_corners(
        [r.get_corner(UL), r.get_center() + DOWN * 0.05, r.get_corner(UR)])
    star = Star(5, outer_radius=0.14, inner_radius=0.06, color=GOLD, fill_opacity=1, stroke_width=0)
    star.move_to(r.get_corner(UR) + UP * 0.12 + RIGHT * 0.1)
    return VGroup(r, v, star)


def descent_icon(color=TEAL):
    bars = VGroup(*[Rectangle(width=0.16, height=h, stroke_width=0, fill_color=color, fill_opacity=0.9)
                    for h in (0.8, 0.6, 0.42, 0.28, 0.16)]).arrange(RIGHT, buff=0.06, aligned_edge=DOWN)
    arr = Arrow(bars.get_corner(UL) + UP * 0.1, bars.get_corner(DR) + RIGHT * 0.1 + UP * 0.12, buff=0,
                stroke_width=3, color=CORAL, max_tip_length_to_length_ratio=0.2)
    return VGroup(bars, arr)


def lattice_icon(color=SKY, n=4, gap=0.24, ellipse=False, gauss=False):
    pts = VGroup(*[Dot(np.array([i * gap, j * gap, 0]), radius=0.035, color=color)
                   for i in range(n) for j in range(n)]).move_to(ORIGIN)
    g = VGroup(pts)
    if ellipse:
        g.add(Ellipse(width=0.9, height=0.5, color=GOLD, stroke_width=3).rotate(PI / 6).move_to(pts))
    if gauss:
        k = 2 * n + 2
        hi = pts[k].copy().set_color(GOLD).scale(1.8)
        g.add(Line(pts[0].get_center(), hi.get_center(), color=GOLD, stroke_width=2.5), hi)
    return g


def paper_icon(color=VIOLET, w=0.8, h=1.0):
    r = RoundedRectangle(corner_radius=0.06, width=w, height=h, stroke_color=color, stroke_width=3,
                         fill_color=PANEL, fill_opacity=1)
    ln = Line(r.get_left() + RIGHT * 0.14 + UP * 0.15, r.get_right() + LEFT * 0.14 + UP * 0.15,
              stroke_color=INK, stroke_width=3)
    return VGroup(r, ln)


class S01_History(NarratedScene):
    number = 1

    def construct(self):
        self.chapter_intro()
        y = -0.7
        xs = [-5.3, -3.2, -1.05, 1.05, 3.2, 5.3]
        years = ["1640", "1749", "1832", "1896", "1984", "1990"]
        names = [T("费马", "Fermat"), T("欧拉", "Euler"), T("高斯", "Gauss"), T("闵可夫斯基", "Minkowski"),
                 T("希思-布朗", "Heath-Brown"), T("扎吉尔", "Zagier")]
        icons = [envelope_icon(), descent_icon(), lattice_icon(gauss=True), lattice_icon(ellipse=True),
                 paper_icon(color=MUTED), paper_icon()]
        notes = [T("给梅森的信", "letter to Mersenne"), T("无穷递降", "infinite descent"), T("高斯整数", "Gaussian integers"),
                 T("格点几何", "geometry of numbers"), T("对合的证明", "involutions"), T("一句话证明", "one sentence")]
        nodes = []
        for k in range(6):
            d = Dot(np.array([xs[k], y, 0]), radius=0.09, color=GOLD)
            yr = tx(years[k], size=26, color=GOLD, weight="BOLD", font=FONT_EN).next_to(d, DOWN, 0.22)
            nm = tx(names[k], size=28, color=INK).next_to(d, UP, 0.3)
            ic = icons[k].scale(1.35).move_to(nm.get_center() + UP * 1.1)
            nt = tx(notes[k], size=21, color=MUTED).next_to(yr, DOWN, 0.15)
            nodes.append(VGroup(d, yr, nm, ic, nt))
        segs = [Line(np.array([-6.6 if k == 0 else xs[k - 1], y, 0]), np.array([xs[k], y, 0]), color=FAINT, stroke_width=3)
                for k in range(6)]

        def show(k, rt=1.0):
            self.play(Create(segs[k]), run_time=0.4)
            d, yr, nm, ic, nt = nodes[k]
            self.play(GrowFromCenter(d), FadeIn(yr, shift=UP * 0.1), run_time=0.4)
            self.play(FadeIn(nm, shift=UP * 0.15), Create(ic) if k != 2 and k != 3 else FadeIn(ic, scale=0.8),
                      FadeIn(nt), run_time=rt)

        with self.say("b1") as d:
            show(0)
            xmas = chip(T("费马圣诞定理", "Fermat's Christmas theorem"), color=GOLD, size=28).move_to(UP * 2.45 + LEFT * 2.6)
            date = tx("25 · XII · 1640", size=26, color=MUTED, font=FONT_EN).next_to(xmas, DOWN, 0.2)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.35)
            self.play(FadeIn(xmas, shift=DOWN * 0.15), FadeIn(date), Flash(nodes[0][3][2], color=GOLD), run_time=0.9)
            quote = tx(T("“我有一个证明……”", "“I have a proof...”"), size=28, color=INK, slant=ITALIC).next_to(date, DOWN, 0.35)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.72)
            self.play(Write(quote), run_time=0.9)
        with self.say("b2") as d:
            self.play(FadeOut(VGroup(xmas, date, quote)), run_time=0.4)
            show(1)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.45)
            self.play(Indicate(nodes[1][3], color=None, scale_factor=1.15), run_time=0.8)
        with self.say("b3") as d:
            show(2)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.45)
            show(3)
        with self.say("b4") as d:
            show(4, rt=0.6)
            show(5, rt=0.6)
            r1 = tx("Amer. Math. Monthly 97 (1990), p. 144", size=22, color=MUTED, font=FONT_EN)
            r2 = tx("A one-sentence proof that every prime", size=26, color=INK, font=FONT_EN)
            r3 = mtx(r"p\equiv 1 \pmod 4\ \text{is a sum of two squares}", size=30)
            txt = VGroup(r1, r2, r3).arrange(DOWN, buff=0.12)
            ref = card(txt.width + 0.6, txt.height + 0.5, color=VIOLET)
            VGroup(ref, txt).move_to(UP * 2.55 + RIGHT * 2.2)
            txt.move_to(ref)
            self.play(FadeIn(ref), FadeIn(VGroup(r1, r2, r3), shift=UP * 0.1), run_time=1.0)
            arrow = CurvedArrow(nodes[4][3].get_top() + UP * 0.05, nodes[5][3].get_top() + UP * 0.05, angle=-PI / 2.2,
                                color=VIOLET, stroke_width=3)
            self.play(Create(arrow), run_time=0.8)
        with self.say("b5") as d:
            others = VGroup(*nodes, *segs, ref, txt, arrow)
            sent = VGroup(
                tx("The involution on the finite set", size=24, color=INK, font=FONT_EN),
                mtx(r"S=\{(x,y,z)\in\mathbb{N}^3: x^2+4yz=p\}", size=30),
                tx("defined by ... has exactly one fixed point,", size=24, color=INK, font=FONT_EN),
                tx("so |S| is odd and the involution (x,y,z) ↦ (x,z,y)", size=24, color=INK, font=FONT_EN),
                tx("also has a fixed point.  □", size=24, color=INK, font=FONT_EN),
            ).arrange(DOWN, buff=0.16, aligned_edge=LEFT)
            paper = card(sent.width + 0.7, sent.height + 0.7, color=VIOLET, fill="#1A2240", opacity=1)
            VGroup(paper, sent).move_to(UP * 0.4)
            sent.move_to(paper)
            self.play(FadeOut(others), FadeIn(paper, scale=0.8), run_time=1.0)
            self.play(LaggedStart(*[FadeIn(l, shift=RIGHT * 0.1) for l in sent], lag_ratio=0.2), run_time=1.4)
            sparks = VGroup(*[Star(4, outer_radius=0.16, inner_radius=0.05, color=GOLD, fill_opacity=1, stroke_width=0)
                              .move_to(paper.get_center() + np.array([4.3 * np.cos(a), 1.9 * np.sin(a), 0]))
                              for a in np.linspace(0, 2 * PI, 9)[:-1]])
            self.play(LaggedStart(*[GrowFromCenter(s) for s in sparks], lag_ratio=0.08), run_time=0.8)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.45)
            qm = tx("?", size=96, color=CORAL, font=FONT_EN, weight="BOLD").next_to(paper, RIGHT, 0.4)
            self.play(FadeOut(sparks), FadeIn(qm, scale=1.5), run_time=0.7)
            self.at(2, lead=0.1) if LANG == "en" else self.at_frac(0.75)
            parts = VGroup(chip(T("集合 S", "a set S"), color=GOLD, size=32), chip(T("对合 τ", "involution τ"), color=SKY, size=32),
                           chip(T("对合 ζ", "involution ζ"), color=VIOLET, size=32), chip(T("奇偶性", "parity"), color=LIME, size=32))
            parts.arrange(RIGHT, buff=0.55).move_to(UP * 0.4)
            self.play(FadeOut(qm), FadeOut(sent), FadeOut(paper, scale=1.2),
                      LaggedStart(*[FadeIn(pc, shift=UP * 0.3, scale=0.7) for pc in parts], lag_ratio=0.2), run_time=1.4)
        self.clear_stage(0.7)


# ===================================================================== 02
class S02_Statement(NarratedScene):
    number = 2

    def construct(self):
        self.chapter_intro()
        box = card(12.6, 3.4, color=GOLD).move_to(UP * 1.15)
        head = tx(T("定理（费马）", "Theorem (Fermat)"), size=34, color=GOLD, weight="BOLD")
        line1 = tx(T("设 p 是奇素数，则", "Let p be an odd prime. Then"), size=32, color=INK)
        stmt = mtx(r"p=a^2+b^2\ \ (a,b\in\mathbb{Z})", r"\quad\iff\quad", r"p\equiv 1\pmod 4", size=50)
        stmt[0].set_color(TEAL)
        stmt[2].set_color(GOLD)
        content = VGroup(head, line1, stmt).arrange(DOWN, buff=0.32).move_to(box)
        head.align_to(box, LEFT).shift(RIGHT * 0.5)
        line1.align_to(head, LEFT)
        with self.say("st1") as d:
            self.play(Create(box), FadeIn(head, shift=RIGHT * 0.2), run_time=0.9)
            self.play(FadeIn(line1), run_time=0.6)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.25)
            self.play(Write(stmt[0]), run_time=1.2)
            self.play(Write(stmt[1]), run_time=0.6)
            self.play(Write(stmt[2]), run_time=1.0)
        with self.say("st2") as d:
            n1 = VGroup(tx(T("素数 2：", "the prime 2:"), size=32, color=MUTED), mtx(r"2=1^2+1^2", size=44))
            n1.arrange(RIGHT, buff=0.2)
            n2 = VGroup(tx(T("唯一性：", "uniqueness:"), size=32, color=MUTED),
                        mtx(r"13=2^2+3^2=3^2+2^2=(-2)^2+3^2=\cdots", size=42))
            n2.arrange(RIGHT, buff=0.2)
            notes = VGroup(n1, n2).arrange(DOWN, buff=0.35, aligned_edge=LEFT).move_to(DOWN * 1.35)
            self.play(FadeIn(n1, shift=UP * 0.15), run_time=0.7)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.45)
            self.play(FadeIn(n2, shift=UP * 0.15), run_time=0.8)
            up_to = tx(T("（不计顺序和正负号，只有一种）", "(only one, up to order and signs)"), size=30, color=TEAL)
            up_to.next_to(n2, DOWN, 0.2).align_to(n2[1], LEFT)
            self.play(FadeIn(up_to), run_time=0.6)
        with self.say("st3") as d:
            self.play(FadeOut(VGroup(notes, up_to)), Indicate(stmt[1], color=GOLD, scale_factor=1.3), run_time=0.9)
            easy = VGroup(mtx(r"\Longrightarrow", size=60, color=TEAL),
                          tx(T("必要性 · 容易", "necessary · easy"), size=32, color=TEAL)).arrange(RIGHT, buff=0.3)
            hard = VGroup(mtx(r"\Longleftarrow", size=60, color=CORAL),
                          tx(T("充分性 · 困难", "sufficient · hard"), size=32, color=CORAL)).arrange(RIGHT, buff=0.3)
            dirs = VGroup(easy, hard).arrange(RIGHT, buff=1.4).move_to(DOWN * 1.35)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.25)
            self.play(FadeIn(easy, shift=RIGHT * 0.3), run_time=0.8)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.55)
            self.play(FadeIn(hard, shift=LEFT * 0.3), run_time=0.8)
            self.play(Circumscribe(hard, color=CORAL, time_width=0.7), run_time=1.3)
        self.clear_stage(0.7)


# ===================================================================== 03
class S03_Necessity(NarratedScene):
    number = 3

    def construct(self):
        self.chapter_intro()
        C = LEFT * 3.4 + UP * 0.1
        R = 1.65
        pos = {r: C + R * np.array([np.sin(r * PI / 2), np.cos(r * PI / 2), 0]) for r in range(4)}
        ring = Circle(radius=R, stroke_color=FAINT, stroke_width=4).move_to(C)
        slots = VGroup(*[Circle(radius=0.34, stroke_color=MUTED, stroke_width=3, fill_color=PANEL, fill_opacity=1).move_to(pos[r])
                         for r in range(4)])
        digits = VGroup(*[mtx(str(r), size=40).move_to(pos[r]) for r in range(4)])
        mod_lbl = mtx(r"\bmod 4", size=36, color=MUTED).move_to(C)
        with self.say("n1") as d:
            self.play(Create(ring), LaggedStart(*[GrowFromCenter(s) for s in slots], lag_ratio=0.15),
                      FadeIn(digits), FadeIn(mod_lbl), run_time=1.2)
            sq = [1, 4, 9, 16, 25, 36, 49]
            toks = VGroup(*[mtx(r"%d" % v, size=36, color=TEAL if v % 2 else GOLD) for v in sq]).arrange(RIGHT, buff=0.42)
            col(toks, 2.2, x=0.7)
            top = VGroup(*[mtx(r"%d^2" % n, size=24, color=MUTED).next_to(toks[n - 1], UP, 0.12) for n in range(1, 8)])
            self.play(LaggedStart(*[FadeIn(t, shift=DOWN * 0.2) for t in toks], lag_ratio=0.1), FadeIn(top), run_time=1.2)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.18)
            rule_e = col(mtx(r"n=2k", r"\ \Rightarrow\ ", r"n^2=4k^2", r"\equiv 0", size=38), 0.75, x=0.2)
            rule_o = col(mtx(r"n=2k+1", r"\ \Rightarrow\ ", r"n^2=4(k^2+k)+1", r"\equiv 1", size=38), -0.25, x=0.2)
            rule_e[3].set_color(GOLD)
            rule_o[3].set_color(TEAL)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.35)
            self.play(Write(rule_e), run_time=1.0)
            self.play(Write(rule_o), run_time=1.2)
            landing = []
            stack = {0: 0, 1: 0}
            for t, v in zip(toks, sq):
                r = v % 4
                k = stack[r]
                stack[r] += 1
                outward = (pos[r] - C) / R
                landing.append(t.animate.scale(0.8).move_to(pos[r] + outward * (0.66 + 0.36 * k)))
            self.play(FadeOut(top), LaggedStart(*landing, lag_ratio=0.12), run_time=1.8)
            self.play(Indicate(slots[0], color=GOLD), Indicate(slots[1], color=TEAL), run_time=0.8)
        with self.say("n2") as d:
            self.play(FadeOut(VGroup(rule_e, rule_o)), run_time=0.4)
            tbl = MathTable([["0", "1"], ["1", "2"]], row_labels=[mtx("0"), mtx("1")], col_labels=[mtx("0"), mtx("1")],
                            top_left_entry=mtx("+"), include_outer_lines=False,
                            line_config={"stroke_color": FAINT, "stroke_width": 2}, element_to_mobject_config={"font_size": 40})
            tbl.scale(0.85)
            col(tbl, 0.6, x=1.0)
            self.play(Create(tbl), run_time=1.2)
            self.play(*[slots[r].animate.set_stroke(TEAL, 5) for r in (0, 1, 2)], run_time=0.6)
            x3 = Cross(slots[3], stroke_color=CORAL, stroke_width=6, scale_factor=0.9)
            never = tx(T("永远不会是 3", "never 3"), size=30, color=CORAL).next_to(slots[3], DOWN, 0.25)
            self.play(Create(x3), FadeIn(never), run_time=0.8)
        with self.say("n3") as d:
            self.play(FadeOut(tbl), run_time=0.4)
            ps3 = [3, 7, 11, 19, 23]
            ps1 = [5, 13, 17, 29]
            row3 = VGroup(*[mtx(str(p), size=36, color=CORAL) for p in ps3]).arrange(RIGHT, buff=0.4)
            row1 = VGroup(*[mtx(str(p), size=36, color=TEAL) for p in ps1]).arrange(RIGHT, buff=0.4)
            col(row1, 1.4, x=1.2)
            col(row3, 0.2, x=1.2)
            l1 = tx(T("余 1", "rem. 1"), size=26, color=TEAL).next_to(row1, RIGHT, 0.4)
            l3 = tx(T("余 3", "rem. 3"), size=26, color=CORAL).next_to(row3, RIGHT, 0.4)
            self.play(FadeIn(row1, shift=LEFT * 0.2), FadeIn(row3, shift=LEFT * 0.2), FadeIn(l1), FadeIn(l3), run_time=0.9)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.25)
            self.play(LaggedStart(*[t.animate.move_to(pos[3] + LEFT * 0.2 + DOWN * 0.1).set_opacity(0) for t in row3],
                                  lag_ratio=0.12), run_time=1.4)
            self.play(Wiggle(x3), FadeOut(l3), run_time=0.6)
            ok = tx(T("必要性 ✓", "necessary ✓"), size=34, color=TEAL)
            self.at(2, lead=0.1) if LANG == "en" else self.at_frac(0.6)
            col(ok, -1.0, x=1.2)
            self.play(FadeIn(ok, scale=1.2), run_time=0.6)
        with self.say("n4") as d:
            maybe = VGroup(*[tx("?", size=30, color=GOLD, font=FONT_EN).next_to(t, UP, 0.1) for t in row1])
            self.play(LaggedStart(*[FadeIn(m, shift=DOWN * 0.1) for m in maybe], lag_ratio=0.1), run_time=0.8)
            conv = col(mtx(r"p\equiv 1\pmod 4", r"\ \overset{?}{\Longrightarrow}\ ", r"p=a^2+b^2", size=42), -1.0, x=0.2)
            conv[1].set_color(CORAL)
            self.play(FadeOut(ok), Write(conv), run_time=1.3)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.55)
            idea = chip(T("需要一个全新的想法", "a completely different idea"), color=GOLD, size=30)
            idea.next_to(conv, DOWN, 0.45).align_to(conv, LEFT)
            self.play(FadeIn(idea, shift=UP * 0.2), Flash(idea.get_left() + RIGHT * 0.2, color=GOLD), run_time=0.9)
        self.clear_stage(0.7)


# ===================================================================== 04
class S04_Pairing(NarratedScene):
    number = 4

    def construct(self):
        self.chapter_intro()
        with self.say("k1") as d:
            left = VGroup(tx(T("构造 a, b", "construct a, b"), size=34, color=MUTED))
            grid = VGroup(*[Dot(np.array([i * 0.28, j * 0.28, 0]), radius=0.04, color=FAINT) for i in range(9) for j in range(6)])
            grid.next_to(left, DOWN, 0.35)
            left.add(grid)
            left.move_to(LEFT * 3.4 + UP * 0.4)
            lens = VGroup(Circle(radius=0.3, stroke_color=INK, stroke_width=4),
                          Line(ORIGIN, DR * 0.35, stroke_color=INK, stroke_width=5).shift(DR * 0.24))
            lens.move_to(grid.get_corner(UL))
            self.play(FadeIn(left), FadeIn(lens), run_time=0.7)
            self.play(lens.animate.move_to(grid.get_corner(DR)), run_time=1.0, rate_func=there_and_back_with_pause)
            self.play(lens.animate.move_to(grid.get_corner(UR)), run_time=0.8)
            xx = Cross(left, stroke_color=CORAL, stroke_width=5, scale_factor=0.8)
            self.play(Create(xx), run_time=0.5)
            right = VGroup(tx(T("只数奇偶", "count mod 2"), size=40, color=GOLD, weight="BOLD"),
                           mtx(r"\#\ \equiv\ ?\ \pmod 2", size=44, color=GOLD)).arrange(DOWN, buff=0.35)
            right.move_to(RIGHT * 3.3 + UP * 0.4)
            arr = Arrow(left.get_right(), right.get_left(), buff=0.4, color=GOLD, stroke_width=5)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.45)
            self.play(GrowArrow(arr), FadeIn(right, shift=LEFT * 0.2), run_time=1.0)
        self.play(FadeOut(VGroup(left, lens, xx, arr, right)), run_time=0.5)

        # k2: the dance
        C = LEFT * 2.6 + UP * 0.25
        n = 9
        ang = [PI / 2 + 2 * PI * k / n for k in range(n)]
        people = VGroup(*[Dot(C + 1.9 * np.array([np.cos(a), np.sin(a), 0]), radius=0.15, color=INK) for a in ang])
        pairs = [(0, 1), (2, 4), (3, 5), (6, 8)]
        alone = 7
        with self.say("k2") as d:
            self.play(LaggedStart(*[GrowFromCenter(p) for p in people], lag_ratio=0.08), run_time=1.0)
            links = VGroup()
            for i, j in pairs:
                links.add(Line(people[i].get_center(), people[j].get_center(), stroke_color=SKY, stroke_width=4))
            self.play(LaggedStart(*[Create(l) for l in links], lag_ratio=0.25),
                      *[people[i].animate.set_color(SKY) for pr in pairs for i in pr], run_time=1.6)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.5)
            odd = col(mtx(r"9\ \text{people}" if LANG == "en" else r"9", size=44), 1.6, x=1.0)
            if LANG == "zh":
                odd = col(VGroup(mtx("9", size=48), tx("个人：奇数", size=32)).arrange(RIGHT, buff=0.15), 1.6, x=1.0)
            self.play(FadeIn(odd), run_time=0.5)
            self.play(people[alone].animate.set_color(LIME).scale(1.5), Flash(people[alone], color=LIME), run_time=0.9)
            lone = tx(T("落单", "alone"), size=30, color=LIME).next_to(people[alone], LEFT, 0.25)
            self.play(FadeIn(lone), run_time=0.5)
        # k3: involution = pairing; fixed point
        with self.say("k3") as d:
            self.play(FadeOut(links), FadeOut(odd), run_time=0.4)
            arcs = VGroup()
            for i, j in pairs:
                arcs.add(CurvedDoubleArrow(people[i].get_center(), people[j].get_center(), angle=PI / 2.5,
                                           color=SKY, stroke_width=3.5, tip_length=0.16))
            loop = self_loop(people[alone].get_center(), LIME, direction=LEFT)
            self.play(LaggedStart(*[Create(a) for a in arcs], lag_ratio=0.2), run_time=1.2)
            f1 = col(mtx(r"f(f(s))=s", size=48, color=SKY), 1.6, x=1.0)
            self.play(Write(f1), run_time=0.9)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.5)
            self.play(FadeOut(lone), Create(loop), run_time=0.8)
            f2 = below(mtx(r"f(s)=s", size=48, color=LIME), f1, 0.4)
            f2t = tx(T("不动点", "fixed point"), size=30, color=LIME).next_to(f2, RIGHT, 0.35)
            self.play(Write(f2), FadeIn(f2t), run_time=0.9)
        # k4: parity identity
        with self.say("k4") as d:
            eq = below(mtx(r"|S|", r"\equiv", r"\#\{\text{fixed points}\}", r"\pmod 2", size=42), f2, 0.7)
            if LANG == "zh":
                eq = below(VGroup(mtx(r"|S|\ \equiv", size=44), tx("不动点个数", size=32, color=LIME),
                                  mtx(r"\pmod 2", size=44)).arrange(RIGHT, buff=0.18), f2, 0.7)
            eq.set_x(2.6)
            frame = SurroundingRectangle(eq, color=GOLD, buff=0.2, corner_radius=0.12)
            self.play(Write(eq), run_time=1.4)
            self.play(Create(frame), run_time=0.7)
        self.play(FadeOut(VGroup(people, arcs, loop, f1, f2, f2t)), VGroup(eq, frame).animate.move_to(UP * 2.75), run_time=0.8)

        # k5: two involutions on one set
        m = 7
        xs = np.linspace(-4.2, 4.2, m)
        S = VGroup(*[Dot(np.array([x, -0.2, 0]), radius=0.16, color=INK) for x in xs])
        zp = [(0, 1), (2, 3), (4, 5)]
        tp = [(1, 2), (3, 6), (4, 5)]
        with self.say("k5") as d:
            sl = tx("S", size=40, color=INK, font=FONT_EN).next_to(S, LEFT, 0.5)
            self.play(LaggedStart(*[GrowFromCenter(p) for p in S], lag_ratio=0.08), FadeIn(sl), run_time=1.0)
            za = VGroup(*[ArcBetweenPoints(S[i].get_center() + UP * 0.2, S[j].get_center() + UP * 0.2, angle=-PI / 1.6,
                                           color=VIOLET, stroke_width=4) for i, j in zp])
            zl = self_loop(S[6].get_center(), VIOLET, direction=UP)
            zlab = mtx(r"\zeta", size=44, color=VIOLET).next_to(za, UP, 0.15).align_to(sl, LEFT)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.3)
            self.play(Create(za), Create(zl), FadeIn(zlab), run_time=1.3)
            one = col(VGroup(tx(T("恰好 1 个不动点", "exactly 1 fixed point"), size=28, color=VIOLET),
                             mtx(r"\Rightarrow\ |S|\ \text{odd}", size=36, color=VIOLET)).arrange(RIGHT, buff=0.2), 1.2, x=-1.0)
            self.play(FadeIn(one, shift=UP * 0.1), Indicate(S[6], color=VIOLET, scale_factor=1.6), run_time=1.0)
            ta = VGroup(*[ArcBetweenPoints(S[i].get_center() + DOWN * 0.2, S[j].get_center() + DOWN * 0.2, angle=PI / 1.6,
                                           color=SKY, stroke_width=4) for i, j in tp])
            tl = self_loop(S[0].get_center(), SKY, direction=DOWN)
            tlab = mtx(r"\tau", size=44, color=SKY).next_to(ta, DOWN, 0.15).align_to(sl, LEFT)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.68)
            self.play(Create(ta), FadeIn(tlab), run_time=1.2)
            self.play(Create(tl), S[0].animate.set_color(LIME).scale(1.4), run_time=0.8)
            atl = tx(T("τ 的不动点个数也是奇数 ⟹ 至少一个", "τ also has an odd number ⟹ at least one"), size=28, color=SKY)
            atl.move_to(DOWN * 2.05)
            self.play(FadeIn(atl, shift=UP * 0.1), run_time=0.7)
        with self.say("k6") as d:
            star = mtx(r"=\ a^2+b^2\,!", size=40, color=LIME).next_to(S[0], DOWN, 0.75).shift(RIGHT * 0.4)
            self.play(FadeOut(atl), Write(star), run_time=1.0)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.5)
            qs = VGroup(chip("S = ?", color=INK, size=32), chip("τ = ?", color=SKY, size=32), chip("ζ = ?", color=VIOLET, size=32))
            qs.arrange(RIGHT, buff=0.6).move_to(DOWN * 2.05)
            self.play(LaggedStart(*[FadeIn(q, shift=UP * 0.2) for q in qs], lag_ratio=0.25), run_time=1.0)
        self.clear_stage(0.7)


# ===================================================================== 05
class S05_SetSwap(NarratedScene):
    number = 5

    def construct(self):
        self.chapter_intro()
        with self.say("s1") as d:
            e1 = mtx(r"p", r"=", r"x^2", r"+", r"(2y)^2", size=64).move_to(UP * 2.0)
            e2 = mtx(r"p", r"=", r"x^2", r"+", r"4", r"\,y", r"\cdot", r"y", size=64).move_to(UP * 2.0)
            e1[2].set_color(GOLD)
            e2[2].set_color(GOLD)
            self.play(Write(e1), run_time=1.2)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.45)
            self.play(TransformMatchingTex(e1, e2), run_time=1.2)
        with self.say("s2") as d:
            e3 = mtx(r"p", r"=", r"x^2", r"+", r"4", r"\,y", r"\cdot", r"z", size=64).move_to(UP * 2.0)
            e3[2].set_color(GOLD)
            e3[7].set_color(TEAL)
            e3[5].set_color(TEAL)
            relax = chip(T("放宽：y·y → y·z", "relax: y·y → y·z"), color=TEAL, size=28).next_to(e3, RIGHT, 0.5)
            self.play(Indicate(e2[7], color=CORAL), run_time=0.7)
            self.play(TransformMatchingTex(e2, e3), FadeIn(relax, shift=LEFT * 0.2), run_time=1.1)
            Sdef = mtx(r"S=\{(x,y,z)\in\mathbb{Z}_{>0}^3\ :\ x^2+4yz=p\}", size=50).move_to(UP * 0.7)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.5)
            self.play(Write(Sdef), run_time=1.6)
            self.play(Circumscribe(Sdef, color=GOLD, time_width=0.6), run_time=1.1)
        trip = [(1, 1, 3), (1, 3, 1), (3, 1, 1)]
        cards = VGroup()
        for t in trip:
            x, y, z = t
            c = card(3.3, 2.15)
            tt = triple_tex(t, size=46).move_to(c.get_top() + DOWN * 0.5)
            chk = mtx(r"%d+4\cdot%d\cdot%d=13" % (x * x, y, z), size=32, color=MUTED).next_to(tt, DOWN, 0.3)
            ic = windmill_icon(t, size=0.0001)  # placeholder (windmill appears later in chapter 06)
            cards.add(VGroup(c, tt, chk))
        cards.arrange(RIGHT, buff=0.55).move_to(DOWN * 1.15)
        with self.say("s3") as d:
            self.play(FadeOut(relax), VGroup(e3).animate.scale(0.8).to_edge(UP, buff=0.9),
                      Sdef.animate.scale(0.8).move_to(UP * 2.2 + RIGHT * 0.0), run_time=0.8)
            self.play(e3.animate.shift(LEFT * 3.6), Sdef.animate.shift(RIGHT * 2.2 + UP * 0.6), run_time=0.6)
            fin = tx(T("有限集", "finite"), size=30, color=GOLD).next_to(Sdef, DOWN, 0.3)
            self.play(FadeIn(fin), run_time=0.5)
            p13 = mtx(r"p=13", size=46, color=GOLD).move_to(UP * 0.75)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.35)
            self.play(FadeIn(p13), run_time=0.5)
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in cards], lag_ratio=0.3), run_time=1.6)
        with self.say("s4") as d:
            tau = mtx(r"\tau(x,y,z)=(x,z,y)", size=46, color=SKY).move_to(UP * 1.05)
            self.play(FadeOut(fin), ReplacementTransform(p13, tau), run_time=0.9)
            # swap the y and z entries of each card
            swaps = []
            for c, t in zip(cards, trip):
                new = triple_tex((t[0], t[2], t[1]), size=46).move_to(c[1])
                swaps.append(Transform(c[1], new))
            self.play(*swaps, run_time=1.2)
            arc = CurvedDoubleArrow(cards[0].get_top() + UP * 0.05, cards[1].get_top() + UP * 0.05, angle=-PI / 3,
                                    color=SKY, stroke_width=4, tip_length=0.18)
            loop = self_loop(cards[2].get_top(), SKY, radius=0.3, direction=UP)
            self.play(Create(arc), Create(loop), run_time=1.0)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.5)
            fx = mtx(r"y=z\ \Rightarrow\ p=x^2+(2y)^2", size=40, color=LIME).next_to(cards, DOWN, 0.3)
            self.play(cards[2][0].animate.set_stroke(LIME, 3), Write(fx), run_time=1.2)
        with self.say("s5") as d:
            res = mtx(r"13=3^2+(2\cdot 1)^2=9+4", size=44, color=LIME).move_to(fx)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.45)
            self.play(Transform(fx, res), Flash(cards[2], color=LIME, flash_radius=1.6), run_time=1.2)
        with self.say("s6") as d:
            self.play(FadeOut(VGroup(cards, arc, loop, fx, tau, e3)), Sdef.animate.move_to(UP * 2.3), run_time=0.8)
            f = MathTex(r"\zeta(x,y,z)=\begin{cases}"
                        r"(x+2z,\; z,\; y-x-z) & x<y-z\\"
                        r"(2y-x,\; y,\; x-y+z) & y-z<x<2y\\"
                        r"(x-2y,\; x-y+z,\; y) & x>2y\end{cases}", font_size=46).set_color(INK).move_to(DOWN * 0.1)
            f[0][0].set_color(VIOLET)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.35)
            self.play(Write(f), run_time=2.4)
            one = tx(T("恰好一个不动点", "exactly one fixed point"), size=30, color=VIOLET).next_to(f, DOWN, 0.4)
            self.play(FadeIn(one), run_time=0.6)
        with self.say("s7") as d:
            magic = VGroup(*[Star(4, outer_radius=0.14, inner_radius=0.04, color=GOLD, fill_opacity=1, stroke_width=0)
                             .move_to(f.get_center() + np.array([4.6 * np.cos(a), 1.75 * np.sin(a), 0]))
                             for a in np.linspace(0, 2 * PI, 9)[:-1]])
            self.play(LaggedStart(*[GrowFromCenter(s) for s in magic], lag_ratio=0.08), run_time=0.8)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.55)
            mill = Windmill(3, 2, 4, unit=0.3, grid=True).move_to(DOWN * 0.1)
            pic = tx(T("一幅图", "a picture"), size=34, color=GOLD).next_to(mill, RIGHT, 0.6)
            self.play(FadeOut(magic), FadeOut(one), FadeTransform(f, mill), run_time=1.4)
            self.play(FadeIn(pic, shift=LEFT * 0.2), run_time=0.5)
        self.clear_stage(0.7)
