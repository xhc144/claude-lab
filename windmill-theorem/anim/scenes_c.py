"""Chapters 09-11: generalizations and applications, mock interview, outro."""
import sys
from math import isqrt
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from manim import *  # noqa: F401,F403

from base import (NarratedScene, Windmill, below, card, chip, col, ease, ease_out, fit, mtx, triple_tex, tx,
                  windmill_icon, wrap)
from config import (BG, CORAL, FAINT, FONT_EN, GOLD, INK, LANG, LIME, MUTED, PANEL, SKY, T, TEAL, VIOLET)
from scenes_a import avatar, descent_icon, lattice_icon, speech_bubble
import geometry as G


def is_prime(n):
    return n > 1 and all(n % d for d in range(2, isqrt(n) + 1))


def is_sum2(n):
    return any(isqrt(n - a * a) ** 2 == n - a * a for a in range(0, isqrt(n) + 1))


def gaussian_prime(a, b):
    if a and b:
        return is_prime(a * a + b * b)
    m = abs(a or b)
    return is_prime(m) and m % 4 == 3


# ===================================================================== 09
class S09_Beyond(NarratedScene):
    number = 9

    def construct(self):
        self.chapter_intro()
        # g1: map of directions
        hub = mtx(r"p=a^2+b^2", size=50, color=GOLD).move_to(UP * 0.4)
        ring = Circle(radius=1.35, color=GOLD, stroke_width=2).move_to(hub)
        branches = [T("合数", "composites"), T("高斯整数", "Gaussian integers"), T("二次型", "quadratic forms"), T("应用", "applications")]
        cols4 = [TEAL, SKY, VIOLET, CORAL]
        dirs = [UL, UR, DR, DL]
        chips = VGroup()
        lines = VGroup()
        for k in range(4):
            c = chip(branches[k], color=cols4[k], size=30).move_to(hub.get_center() + np.array([4.0 * dirs[k][0], 1.75 * dirs[k][1], 0]))
            chips.add(c)
            lines.add(Line(ring.point_at_angle(np.arctan2(dirs[k][1], dirs[k][0])), c.get_center(), buff=0.0,
                           color=cols4[k], stroke_width=2.5).set_opacity(0.7))
        with self.say("g1") as d:
            self.play(Write(hub), Create(ring), run_time=1.0)
            self.play(LaggedStart(*[AnimationGroup(Create(l), FadeIn(c, scale=0.8)) for l, c in zip(lines, chips)], lag_ratio=0.25),
                      run_time=1.8)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.6)
            self.play(Indicate(chips[0], color=None, scale_factor=1.15), run_time=0.8)
        self.play(FadeOut(VGroup(hub, ring, lines, chips[1:])), chips[0].animate.scale(0.8).to_corner(UR, buff=0.5), run_time=0.7)
        tagc = chips[0]

        # g2: complex multiplication
        plane = NumberPlane(x_range=[-1, 8, 1], y_range=[-1, 8, 1], x_length=4.6, y_length=4.6,
                            background_line_style={"stroke_color": FAINT, "stroke_width": 1, "stroke_opacity": 0.6},
                            axis_config={"stroke_color": MUTED, "stroke_width": 2}).move_to(LEFT * 3.9 + DOWN * 0.1)
        z, w, zw = (2, 1), (3, 2), (4, 7)
        vz = Arrow(plane.c2p(0, 0), plane.c2p(*z), buff=0, color=TEAL, stroke_width=5)
        vw = Arrow(plane.c2p(0, 0), plane.c2p(*w), buff=0, color=SKY, stroke_width=5)
        vzw = Arrow(plane.c2p(0, 0), plane.c2p(*zw), buff=0, color=GOLD, stroke_width=5)
        lz = mtx(r"z=2+i", size=28, color=TEAL).next_to(plane.c2p(*z), DOWN + RIGHT, 0.05)
        lw = mtx(r"w=3+2i", size=28, color=SKY).next_to(plane.c2p(*w), RIGHT, 0.1)
        lzw = mtx(r"zw=4+7i", size=28, color=GOLD).next_to(plane.c2p(*zw), RIGHT, 0.1)
        with self.say("g2") as d:
            ident = col(mtx(r"(a^2+b^2)(c^2+d^2)", r"=", r"(ac-bd)^2+(ad+bc)^2", size=36), 1.9, x=-1.0)
            self.play(Write(ident), run_time=1.6)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.42)
            self.play(Create(plane), run_time=0.8)
            self.play(GrowArrow(vz), FadeIn(lz), GrowArrow(vw), FadeIn(lw), run_time=1.0)
            self.play(GrowArrow(vzw), FadeIn(lzw), run_time=0.9)
            mods = col(mtx(r"|z|^2\cdot|w|^2", r"=", r"|zw|^2", size=44), 0.75, x=0.4)
            mods[0].set_color(TEAL)
            mods[2].set_color(GOLD)
            nums = below(mtx(r"5\times 13=65=4^2+7^2", size=44), mods, 0.4)
            self.play(Write(mods), run_time=1.0)
            self.play(Write(nums), run_time=1.0)
        self.play(FadeOut(VGroup(plane, vz, vw, vzw, lz, lw, lzw, ident, mods, nums)), run_time=0.6)

        # g3: which integers?  1..100 grid + 2026 / 2027
        with self.say("g3") as d:
            cell = 0.43
            grid = VGroup()
            for n in range(1, 101):
                r, c = divmod(n - 1, 10)
                ok = is_sum2(n)
                sq = Square(cell * 0.92, stroke_width=0, fill_color=TEAL if ok else PANEL, fill_opacity=0.85 if ok else 0.9)
                sq.move_to(np.array([c * cell, -r * cell, 0]))
                t = tx(str(n), size=13, color=BG if ok else MUTED, font=FONT_EN).move_to(sq)
                grid.add(VGroup(sq, t))
            grid.move_to(LEFT * 4.2 + DOWN * 0.05)
            self.play(LaggedStart(*[FadeIn(g) for g in grid], lag_ratio=0.01), run_time=1.6)
            rule = col(VGroup(tx(T("n 是两平方和", "n is a sum of two squares"), size=28, color=TEAL),
                              mtx(r"\iff", size=36),
                              tx(T("模 4 余 3 的素因子都出现偶数次", "primes ≡ 3 (mod 4) appear to even powers"), size=28, color=INK)
                              ).arrange(DOWN, buff=0.18, aligned_edge=LEFT), 1.75, x=-1.4)
            self.play(FadeIn(rule, shift=UP * 0.15), run_time=1.0)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.38)
            ex1 = col(mtx(r"2026=2\times 1013,\ \ 1013\equiv 1\!\!\pmod 4", size=34), 0.05, x=-1.4)
            ex1b = below(mtx(r"2026=45^2+1^2\ \ \checkmark", size=40, color=LIME), ex1, 0.25)
            self.play(Write(ex1), run_time=1.2)
            self.play(Write(ex1b), run_time=0.9)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.78)
            ex2 = below(mtx(r"2027\ \text{prime},\ \ 2027\equiv 3\!\!\pmod 4\ \ \times", size=38, color=CORAL), ex1b, 0.45)
            self.play(Write(ex2), run_time=1.1)
        self.play(FadeOut(VGroup(grid, rule, ex1, ex1b, ex2)), run_time=0.6)

        # g4-g5: Gaussian integers
        newtag = chip(T("高斯整数", "Gaussian integers"), color=SKY, size=24).move_to(tagc)
        self.play(Transform(tagc, newtag), run_time=0.5)
        R = 7
        gp = NumberPlane(x_range=[-R, R, 1], y_range=[-R, R, 1], x_length=5.2, y_length=5.2,
                         background_line_style={"stroke_color": FAINT, "stroke_width": 0.8, "stroke_opacity": 0.5},
                         axis_config={"stroke_color": MUTED, "stroke_width": 2}).move_to(LEFT * 3.7 + DOWN * 0.15)
        primes = VGroup()
        for a in range(-R + 1, R):
            for b in range(-R + 1, R):
                if gaussian_prime(a, b):
                    primes.add(Dot(gp.c2p(a, b), radius=0.055, color=LIME))
        with self.say("g4") as d:
            self.play(Create(gp), run_time=0.9)
            self.play(LaggedStart(*[GrowFromCenter(p) for p in primes], lag_ratio=0.004), run_time=1.6)
            gl = tx(T("高斯素数", "Gaussian primes"), size=26, color=LIME).next_to(gp, UP, 0.1)
            self.play(FadeIn(gl), run_time=0.5)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.35)
            f = col(mtx(r"p=a^2+b^2", r"\iff", r"p=(a+bi)(a-bi)", size=40), 1.95, x=-0.4)
            self.play(Write(f), run_time=1.3)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.6)
            p1, p2 = gp.c2p(3, 2), gp.c2p(3, -2)
            v1 = Arrow(gp.c2p(0, 0), p1, buff=0, color=GOLD, stroke_width=4)
            v2 = Arrow(gp.c2p(0, 0), p2, buff=0, color=GOLD, stroke_width=4)
            s13 = below(mtx(r"13=(3+2i)(3-2i)", size=40, color=GOLD), f, 0.45)
            self.play(GrowArrow(v1), GrowArrow(v2), Write(s13), run_time=1.2)
            three = Circle(radius=0.16, color=CORAL, stroke_width=3).move_to(gp.c2p(3, 0))
            s3 = below(VGroup(mtx(r"3,\,7,\,11,\dots", size=36, color=CORAL), tx(T("仍是素数", "stay prime"), size=26, color=CORAL)
                              ).arrange(RIGHT, buff=0.2), s13, 0.35)
            self.play(Create(three), FadeIn(s3), run_time=0.9)
            s2 = below(mtx(r"2=-i\,(1+i)^2", size=36, color=SKY), s3, 0.35)
            two = Circle(radius=0.16, color=SKY, stroke_width=3).move_to(gp.c2p(1, 1))
            self.play(Create(two), FadeIn(s2), run_time=0.8)
        with self.say("g5") as d:
            uf = below(chip(T("唯一分解  ⟹  表示唯一", "unique factorization ⟹ unique representation"), color=LIME, size=24), s2, 0.5)
            self.play(FadeIn(uf, shift=UP * 0.15), run_time=0.8)
            self.play(Indicate(v1, color=LIME), Indicate(v2, color=LIME), run_time=1.0)
        self.play(FadeOut(VGroup(gp, primes, gl, f, v1, v2, s13, three, s3, two, s2, uf)), run_time=0.6)

        # g6: other quadratic forms
        newtag = chip(T("二次型", "quadratic forms"), color=VIOLET, size=24).move_to(tagc)
        self.play(Transform(tagc, newtag), run_time=0.5)
        rows = [
            (r"x^2+y^2", r"p\equiv 1\pmod 4", GOLD),
            (r"x^2+2y^2", r"p\equiv 1,3\pmod 8", TEAL),
            (r"x^2+3y^2", r"p\equiv 1\pmod 3", SKY),
            (r"x^2+ny^2", T(r"\text{二次互反律}\ \to\ \text{类域论}", r"\text{reciprocity}\ \to\ \text{class field theory}"), VIOLET),
            (r"a^2+b^2+c^2+d^2", T(r"\text{所有正整数（拉格朗日）}", r"\text{every } n\ \text{(Lagrange)}"), CORAL),
        ]
        table = VGroup()
        for lhs, rhs, colr in rows:
            l = mtx(lhs, size=40, color=colr)
            if LANG == "zh" and "text" in rhs:
                r_ = tx(rhs.replace(r"\text{", "").replace("}", "").replace(r"\ \to\ ", " → ").replace(r"\ ", " "), size=30, color=INK)
            else:
                r_ = mtx(rhs, size=38, color=INK)
            table.add(VGroup(l, r_))
        for row in table:
            row[0].move_to(np.array([-3.2, 0, 0]))
            row[1].move_to(np.array([0.6 + row[1].width / 2, 0, 0]))
        for k, row in enumerate(table):
            row.shift(UP * (1.9 - 0.82 * k))
        hdr = VGroup(tx(T("形式", "form"), size=26, color=MUTED).move_to(np.array([-3.2, 2.75, 0])),
                     tx(T("哪些素数？", "which primes?"), size=26, color=MUTED).move_to(np.array([1.6, 2.75, 0])))
        sepl = Line(np.array([-5.2, 2.4, 0]), np.array([5.6, 2.4, 0]), color=FAINT, stroke_width=2)
        arrows = VGroup(*[Arrow(np.array([-1.6, r.get_y(), 0]), np.array([0.3, r.get_y(), 0]), buff=0, color=FAINT, stroke_width=3,
                                max_tip_length_to_length_ratio=0.15) for r in table])
        with self.say("g6") as d:
            self.play(FadeIn(hdr), Create(sepl), FadeIn(table[0]), GrowArrow(arrows[0]), run_time=1.0)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.12)
            self.play(FadeIn(table[1], shift=UP * 0.1), GrowArrow(arrows[1]), run_time=0.8)
            self.at_frac(0.3) if LANG == "zh" else self.at_frac(0.36)
            self.play(FadeIn(table[2], shift=UP * 0.1), GrowArrow(arrows[2]), run_time=0.8)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.52)
            self.play(FadeIn(table[3], shift=UP * 0.1), GrowArrow(arrows[3]), run_time=0.9)
            self.at(3, lead=0.2) if LANG == "en" else self.at_frac(0.75)
            self.play(FadeIn(table[4], shift=UP * 0.1), GrowArrow(arrows[4]), run_time=0.9)
        self.play(FadeOut(VGroup(hdr, sepl, table, arrows)), run_time=0.6)

        # g7: Pythagorean triple 5-12-13
        newtag = chip(T("应用", "applications"), color=CORAL, size=24).move_to(tagc)
        self.play(Transform(tagc, newtag), run_time=0.5)
        with self.say("g7") as d:
            u = 0.3
            A = LEFT * 5.6 + DOWN * 1.6
            B = A + RIGHT * 12 * u
            Cc = A + UP * 5 * u
            tri = Polygon(A, B, Cc, stroke_color=INK, stroke_width=3, fill_color=TEAL, fill_opacity=0.2)
            ra = RightAngle(Line(A, B), Line(A, Cc), length=0.25, color=MUTED)
            l5 = mtx("5", size=34, color=TEAL).next_to(Line(A, Cc), LEFT, 0.12)
            l12 = mtx("12", size=34, color=TEAL).next_to(Line(A, B), DOWN, 0.12)
            l13 = mtx("13", size=36, color=GOLD).move_to((B + Cc) / 2 + UP * 0.32 + RIGHT * 0.18)
            self.play(Create(tri), Create(ra), run_time=1.0)
            self.play(FadeIn(l5), FadeIn(l12), FadeIn(l13), run_time=0.6)
            st = col(fit(T("素数 p 是整数直角三角形的斜边  ⟺  p ≡ 1 (mod 4)",
                           "prime p = hypotenuse of an integer right triangle  ⟺  p ≡ 1 (mod 4)"), size=28, max_w=6.6), 1.8, x=-0.2)
            self.play(FadeIn(st), run_time=0.8)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.55)
            m1 = col(mtx(r"13=3^2+2^2", size=42, color=GOLD), 0.55, x=-0.2)
            m2 = below(mtx(r"(3^2-2^2,\ 2\cdot3\cdot2,\ 3^2+2^2)", size=40), m1, 0.35)
            m3 = below(mtx(r"=(5,\ 12,\ 13)", size=44, color=TEAL), m2, 0.3)
            self.play(Write(m1), run_time=0.8)
            self.play(Write(m2), run_time=1.0)
            self.play(Write(m3), Indicate(tri, color=None, scale_factor=1.05), run_time=0.9)
        self.play(FadeOut(VGroup(tri, ra, l5, l12, l13, st, m1, m2, m3)), run_time=0.6)

        # g8: pi from lattice points
        with self.say("g8") as d:
            Rmax = 9
            pu = 0.26
            cen = LEFT * 3.7 + DOWN * 0.15
            pts = VGroup()
            for a in range(-Rmax, Rmax + 1):
                for b in range(-Rmax, Rmax + 1):
                    pts.add(Dot(cen + np.array([a * pu, b * pu, 0]), radius=0.03, color=FAINT))
            rad = ValueTracker(0.5)
            circ = always_redraw(lambda: Circle(radius=rad.get_value() * pu, color=GOLD, stroke_width=3).move_to(cen))

            def inside():
                r2 = rad.get_value() ** 2
                g = VGroup()
                for a in range(-Rmax, Rmax + 1):
                    for b in range(-Rmax, Rmax + 1):
                        if a * a + b * b <= r2:
                            g.add(Dot(cen + np.array([a * pu, b * pu, 0]), radius=0.045, color=TEAL))
                return g
            ins = always_redraw(inside)
            self.play(FadeIn(pts), run_time=0.6)
            self.add(circ, ins)
            self.play(rad.animate.set_value(Rmax), run_time=3.0, rate_func=ease)
            cnt = col(mtx(r"\#\{(a,b):a^2+b^2\le R^2\}\approx\pi R^2", size=36), 2.05, x=-0.4)
            self.play(Write(cnt), run_time=1.2)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.38)
            ser = below(mtx(r"\frac{\pi}{4}=1-\frac13+\frac15-\frac17+\cdots", size=46, color=GOLD), cnt, 0.4)
            self.play(Write(ser), run_time=1.4)
            # partial sums plot
            ax = Axes(x_range=[0, 30, 10], y_range=[0.6, 1.05, 0.2], x_length=5.6, y_length=1.9,
                      axis_config={"stroke_color": MUTED, "stroke_width": 2, "include_ticks": False}).next_to(ser, DOWN, 0.4).align_to(ser, LEFT)
            target = DashedLine(ax.c2p(0, np.pi / 4), ax.c2p(30, np.pi / 4), color=GOLD, stroke_width=2)
            psum, ptsS = 0.0, VGroup()
            for k in range(30):
                psum += (-1) ** k / (2 * k + 1)
                ptsS.add(Dot(ax.c2p(k + 1, psum), radius=0.04, color=TEAL))
            self.play(Create(ax), Create(target), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(p, scale=0.5) for p in ptsS], lag_ratio=0.05), run_time=1.8)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.82)
            self.play(Circumscribe(ser, color=GOLD, time_width=0.6), run_time=1.0)
            circ.clear_updaters()
            ins.clear_updaters()
        self.clear_stage(0.7)


# ===================================================================== 10
LAYERS = [T("陈述", "Statement"), T("证明", "Proof"), T("条件", "Conditions"), T("延伸", "Beyond")]
QA = [
    # (layer, question, focus (zh), bullets)
    (0, "So, what's your favorite theorem?", "开场表达",
     [r"\text{Fermat's two-square theorem}", r"p=a^2+b^2\iff p\equiv1\pmod 4",
      r"\text{simple statement; proofs touch NT, geometry, combinatorics}"]),
    (0, "Can you state it precisely? What about 2, or composites?", "准确性",
     [r"p\ \text{odd prime}:\ p=a^2+b^2\iff p\equiv1\pmod4", r"2=1^2+1^2",
      r"n:\ \text{primes}\equiv3\!\!\pmod4\ \text{to even powers}", r"45=6^2+3^2\ \checkmark\qquad 21\ \times"]),
    (1, "Why is 'one mod four' necessary?", "基本功",
     [r"n^2\equiv0,1\pmod4", r"a^2+b^2\not\equiv3\pmod4", r"\text{the converse is the interesting part}"]),
    (1, "Can you sketch a proof of the converse in a minute?", "证明结构",
     [r"S=\{(x,y,z):x^2+4yz=p\}\ \text{finite}", r"\tau:\,y\leftrightarrow z,\ \ \mathrm{Fix}(\tau)\Rightarrow p=x^2+(2y)^2",
      r"\zeta:\ \text{exactly one fixed point }(1,1,\tfrac{p-1}{4})", r"\text{parity}\Rightarrow|S|\ \text{odd}\Rightarrow\mathrm{Fix}(\tau)\neq\varnothing"]),
    (2, "Where exactly did you use that p is prime?", "条件的作用",
     [r"\text{1. boundary: }p=(y+z)^2\ \text{or}\ 4y(y+z)", r"\text{2. fixed point: }p=x(x+4z)\Rightarrow x=1",
      r"21:\ \text{two fixed points }(1,1,5),(3,3,1)", r"\text{parity argument fails; }21\ne a^2+b^2"]),
    (2, "That map looks like a trick. How would anyone come up with it?", "理解深度",
     [r"x^2+4yz=\text{area of a windmill}", r"\text{one outline, exactly two cuts}", r"\zeta\ \text{switches the cuts}"]),
    (2, "How would you actually find a and b for a large prime?", "构造性",
     [r"\text{walk the path: cross}\to\cdots\to\mathrm{Fix}(\tau)", r"\text{fast: } r^2\equiv-1\!\!\pmod p,\ \text{then Euclid}",
      r"13:\ 5^2\equiv-1;\ \ 13,5,\mathbf{3}\ \Rightarrow\ 13=3^2+2^2"]),
    (2, "Is the representation unique?", "唯一性",
     [r"\text{unique up to order and signs}", r"\mathbb{Z}[i]\ \text{has unique factorization}", r"p=(a+bi)(a-bi)"]),
    (3, "How would you generalize the theorem?", "推广视野",
     [r"(a^2+b^2)(c^2+d^2)=(ac-bd)^2+(ad+bc)^2", r"x^2+2y^2:\ p\equiv1,3\pmod8", r"\text{four squares (Lagrange)}",
      r"x^2+ny^2\ \to\ \text{class field theory}"]),
    (3, "Is the theorem useful beyond itself?", "应用联系",
     [r"\text{Pythagorean triples: }13\to(5,12,13)", r"\tfrac{\pi}{4}=1-\tfrac13+\tfrac15-\cdots"]),
    (3, "If you could keep only one idea, what would it be?", "个人思考",
     [r"\text{odd count}\Rightarrow\text{existence}", r"\text{handshake lemma}\ \cdot\ \text{Sperner's lemma}",
      r"\text{follow the pairs}\Rightarrow\text{algorithm}"]),
    (3, "Quick one: is 2027 a sum of two squares?", "临场反应",
     [r"2027\ \text{prime},\ \equiv3\pmod4\ \Rightarrow\ \text{no}", r"2026=45^2+1^2\ \checkmark"]),
]


class S10_Interview(NarratedScene):
    number = 10

    def construct(self):
        self.chapter_intro()
        pills = VGroup(*[chip(l, color=MUTED, size=26, fill=0.05) for l in LAYERS]).arrange(RIGHT, buff=0.25)
        pills.move_to(np.array([-2.7 + pills.width / 2, 3.42, 0]))
        intro_key = "zi0" if LANG == "zh" else "ei0"
        with self.say(intro_key) as d:
            self.play(LaggedStart(*[FadeIn(p, shift=DOWN * 0.2) for p in pills], lag_ratio=0.2), run_time=1.2)
            qa_av = avatar("Q", SKY).move_to(LEFT * 5.9 + UP * 1.9)
            aa_av = avatar("A", GOLD).move_to(LEFT * 5.9 + DOWN * 0.15)
            self.play(GrowFromCenter(qa_av), GrowFromCenter(aa_av), run_time=0.7)
            if LANG == "en":
                self.at(2, lead=0.2)
            else:
                self.at_frac(0.5)
            formula = VGroup(chip(T("结论", "conclusion"), color=GOLD, size=30), tx("→", size=34, color=MUTED),
                             chip(T("理由", "reason"), color=TEAL, size=30), tx("→", size=34, color=MUTED),
                             chip(T("钩子", "hook"), color=VIOLET, size=30)).arrange(RIGHT, buff=0.25).move_to(DOWN * 0.15 + RIGHT * 0.6)
            self.play(LaggedStart(*[FadeIn(f, shift=UP * 0.15) for f in formula], lag_ratio=0.2), run_time=1.2)
        self.play(FadeOut(formula), run_time=0.4)

        cur_layer = -1
        prev = VGroup()
        for i, (layer, q, focus, bullets) in enumerate(QA):
            k = i + 1
            if layer != cur_layer:
                anims = [p[0].animate.set_stroke(MUTED).set_fill(MUTED, 0.05) for p in pills] + \
                        [p[1].animate.set_color(MUTED) for p in pills]
                anims += [pills[layer][0].animate.set_stroke(GOLD).set_fill(GOLD, 0.18), pills[layer][1].animate.set_color(GOLD)]
                cur_layer = layer
            else:
                anims = []
            qb = speech_bubble(q, color=SKY, size=32)
            qb.next_to(qa_av, RIGHT, 0.3)
            qb.shift(UP * (2.85 - qb.get_top()[1]))
            qn = tx(f"Q{k}", size=22, color=SKY, weight="BOLD", font=FONT_EN).next_to(qa_av, UP, 0.12)
            tag = chip(T("考察点：", "") + focus, color=CORAL, size=24) if LANG == "zh" else VGroup()
            if LANG == "zh":
                tag.next_to(qb, RIGHT, 0.3)
                if tag.get_right()[0] > 6.9:
                    tag.next_to(qb, DOWN, 0.15).align_to(qb, RIGHT)
            panel_items = VGroup(*[mtx(r"\bullet\ \ " + b, size=34) for b in bullets]).arrange(DOWN, buff=0.28, aligned_edge=LEFT)
            if panel_items.width > 11.6:
                panel_items.scale_to_fit_width(11.6)
            panel_items.next_to(aa_av, RIGHT, 0.45).align_to(aa_av, UP).shift(DOWN * 0.05)
            group_now = VGroup(qb, qn, tag, panel_items)

            def show_q(rt=0.8):
                self.play(FadeOut(prev), *anims, run_time=0.4) if len(prev) or anims else None
                self.play(FadeIn(qb, shift=RIGHT * 0.15), FadeIn(qn), run_time=rt)
                if LANG == "zh":
                    self.play(FadeIn(tag, shift=LEFT * 0.1), run_time=0.4)

            if LANG == "en":
                with self.say(f"q{k}") as d:
                    show_q()
                with self.say(f"a{k}") as d:
                    nb, ns = len(panel_items), len(self.sent_offsets(f"a{k}"))
                    for j, it in enumerate(panel_items):
                        self.at(min(ns - 1, (j * ns) // nb), lead=0.05)
                        self.play(FadeIn(it, shift=RIGHT * 0.15), run_time=0.6)
            else:
                with self.say(f"zq{k}") as d:
                    show_q()
                    nb = len(panel_items)
                    for j, it in enumerate(panel_items):
                        self.at_frac(0.18 + 0.62 * j / max(1, nb))
                        self.play(FadeIn(it, shift=RIGHT * 0.15), run_time=0.6)
            prev = group_now

        end_key = "zi_end" if LANG == "zh" else "ei_end"
        with self.say(end_key) as d:
            self.play(FadeOut(prev), run_time=0.5)
            formula = VGroup(chip(T("结论", "conclusion"), color=GOLD, size=34), tx("→", size=38, color=MUTED),
                             chip(T("理由", "reason"), color=TEAL, size=34), tx("→", size=38, color=MUTED),
                             chip(T("钩子", "hook"), color=VIOLET, size=34)).arrange(RIGHT, buff=0.3).move_to(UP * 0.6)
            self.play(LaggedStart(*[FadeIn(f, shift=UP * 0.15) for f in formula], lag_ratio=0.2), run_time=1.2)
            self.play(*[Indicate(p, color=None, scale_factor=1.1) for p in pills], run_time=1.0)
        self.clear_stage(0.7)

    def sent_offsets(self, key):
        from config import sentence_offsets
        return sentence_offsets(key)


# ===================================================================== 11
class S11_Outro(NarratedScene):
    number = 11

    def construct(self):
        self.chapter_intro()
        hub = mtx(r"p=a^2+b^2", size=56, color=GOLD).move_to(UP * 0.35)
        pair_icon = VGroup(*[Dot(radius=0.08, color=INK) for _ in range(5)]).arrange(RIGHT, buff=0.32)
        pair_icon = VGroup(pair_icon,
                           ArcBetweenPoints(pair_icon[0].get_center(), pair_icon[1].get_center(), angle=-PI / 1.5, color=VIOLET, stroke_width=3),
                           ArcBetweenPoints(pair_icon[2].get_center(), pair_icon[3].get_center(), angle=-PI / 1.5, color=VIOLET, stroke_width=3))
        lens = [(descent_icon(), T("费马 · 欧拉：递降", "Fermat · Euler: descent"), UL),
                (lattice_icon(gauss=True).scale(1.5), T("高斯：复数分解", "Gauss: factorization"), UR),
                (lattice_icon(ellipse=True).scale(1.5), T("闵可夫斯基：格点", "Minkowski: lattices"), DL),
                (pair_icon, T("扎吉尔：配对", "Zagier: pairing"), DR)]
        groups = VGroup()
        for ic, label, dvec in lens:
            l = tx(label, size=26, color=INK)
            g = VGroup(ic.copy(), l).arrange(DOWN, buff=0.25)
            g.move_to(hub.get_center() + np.array([4.2 * dvec[0], 1.7 * dvec[1], 0]))
            groups.add(g)
        with self.say("e1") as d:
            self.play(Write(hub), run_time=1.0)
            if LANG == "en":
                self.at(2, lead=0.2)
            else:
                self.at_frac(0.42)
            for g in groups:
                ln = DashedLine(g.get_center(), hub.get_center(), color=FAINT, stroke_width=2).scale(0.55)
                self.play(FadeIn(g, shift=(hub.get_center() - g.get_center()) * -0.08), Create(ln), run_time=0.7)
        self.clear_stage(0.6)

        with self.say("e2") as d:
            paper = card(3.6, 2.4, color=VIOLET, fill="#18203C", opacity=1)
            lines = VGroup(*[Line(LEFT * 1.3, RIGHT * (1.3 - 0.5 * (k == 3)), stroke_color=MUTED, stroke_width=4) for k in range(4)]
                           ).arrange(DOWN, buff=0.3)
            p_grp = VGroup(paper, lines.move_to(paper)).move_to(LEFT * 3.4 + UP * 0.35)
            mill = Windmill(3, 2, 4, unit=0.3, grid=True).move_to(RIGHT * 3.4 + UP * 0.35)
            lb1 = tx(T("验证：相信它", "verify: believe it"), size=30, color=VIOLET).next_to(p_grp, DOWN, 0.35)
            lb2 = tx(T("解释：理解它", "explain: understand it"), size=30, color=GOLD).next_to(mill, DOWN, 0.35)
            arr = Arrow(p_grp.get_right(), mill.get_left(), buff=0.5, color=MUTED, stroke_width=4)
            self.play(FadeIn(p_grp, shift=UP * 0.2), FadeIn(lb1), run_time=0.9)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.45)
            self.play(GrowArrow(arr), run_time=0.6)
            self.play(LaggedStart(GrowFromCenter(mill.square), *[GrowFromCenter(b) for b in mill.blades], lag_ratio=0.15),
                      FadeIn(mill.grid), FadeIn(mill.outline), FadeIn(lb2), run_time=1.4)
        self.clear_stage(0.6)

        with self.say("e3") as d:
            ph = [T("你看见了什么", "what you saw"), T("在哪里卡住过", "where you got stuck"), T("还想追问什么", "what you still want to ask")]
            cols3 = [TEAL, CORAL, VIOLET]
            items = VGroup(*[chip(p, color=c, size=36) for p, c in zip(ph, cols3)]).arrange(DOWN, buff=0.35).move_to(DOWN * 0.1)
            bad = tx(T("背出一个证明", "a memorized proof"), size=34, color=MUTED).move_to(UP * 1.9)
            strike = Line(bad.get_left(), bad.get_right(), color=CORAL, stroke_width=4)
            self.play(FadeIn(bad), run_time=0.6)
            self.play(Create(strike), run_time=0.5)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.45)
            self.play(LaggedStart(*[FadeIn(i, shift=UP * 0.2) for i in items], lag_ratio=0.35), run_time=1.6)
        self.clear_stage(0.6)

        with self.say("e4") as d:
            ts = [(3, 1, 1), (5, 1, 1), (5, 2, 2)]
            ps = [13, 29, 41]
            eqs = [r"13=3^2+2^2", r"29=5^2+2^2", r"41=5^2+4^2"]
            mills = VGroup(*[Windmill(*t, unit=0.27, grid=True) for t in ts]).arrange(RIGHT, buff=1.6).move_to(UP * 0.6)
            labs = VGroup(*[mtx(e, size=36, color=INK).next_to(m, DOWN, 0.45) for e, m in zip(eqs, mills)])
            st = mtx(r"p\equiv 1\pmod 4\ \Longrightarrow\ p=a^2+b^2", size=46, color=GOLD).move_to(UP * 2.75)
            self.play(Write(st), run_time=1.2)
            self.play(LaggedStart(*[GrowFromCenter(m) for m in mills], lag_ratio=0.25), run_time=1.2)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.45)
            self.play(*[Rotate(m, angle=-2 * PI) for m in mills], FadeIn(labs, shift=UP * 0.15), run_time=2.4, rate_func=ease)
            self.play(*[Rotate(m, angle=-PI) for m in mills], run_time=1.6, rate_func=ease_out)
        end = VGroup(tx(T("费马平方和定理", "Fermat's Two-Square Theorem"), size=54, color=INK, weight="BOLD"),
                     tx(T("一句话的证明 · 一架风车", "a one-sentence proof · a windmill"), size=30, color=MUTED),
                     tx(T("动画：Manim · 讲稿与工程见仓库 windmill-theorem/", "Animation: Manim · script & project: windmill-theorem/"),
                        size=22, color=FAINT)).arrange(DOWN, buff=0.35).move_to(DOWN * 0.1)
        self.play(FadeOut(VGroup(st, labs)), mills.animate.scale(0.5).move_to(UP * 2.0), run_time=0.9)
        self.play(FadeIn(end, shift=UP * 0.2), run_time=1.0)
        self.wait(2.5)
        self.play(*[FadeOut(m) for m in self.mobjects if not isinstance(m, ImageMobject)], run_time=1.2)
