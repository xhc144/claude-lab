"""Chapters 10-13: generalizations, applications, mock interview, what I learned."""
import textwrap
from math import gcd, isqrt

from common import *  # noqa: F401,F403
import yaml


def atl(scene: FScene, zh_k: int, en_k: int, offset: float = 0.0):
    scene.at(zh_k if ZH else en_k, offset)


def is_prime(n):
    return n > 1 and all(n % d for d in range(2, isqrt(n) + 1))


def is_sum2(n):
    return any(isqrt(n - a * a) ** 2 == n - a * a for a in range(0, isqrt(n) + 1))


def plane(origin, unit, xr, yr, color=GRID):
    o = np.array(origin)
    ax = VGroup(Line(o + RIGHT * xr[0] * unit, o + RIGHT * xr[1] * unit, color=color, stroke_width=2),
                Line(o + UP * yr[0] * unit, o + UP * yr[1] * unit, color=color, stroke_width=2))
    return ax


# ------------------------------------------------------------------ 10
class S10_General(FScene):
    def construct(self):
        self.chapter_card(10, "推广", "Generalizations")
        # ---- gen_1
        with self.seg("gen_1"):
            cells = VGroup()
            for n in range(1, 51):
                ok = is_sum2(n)
                sq = RoundedRectangle(corner_radius=0.08, width=1.05, height=0.78,
                                      fill_color=ARM if ok else PANEL2, fill_opacity=0.9 if ok else 1,
                                      stroke_width=0)
                t = T(str(n), 26, BG if ok else MUTED, weight=BOLD if ok else NORMAL, font=LAT_FONT).move_to(sq)
                cells.add(VGroup(sq, t))
            cells.arrange_in_grid(rows=5, cols=10, buff=0.1).move_to(DOWN * 0.15)
            for c in cells:
                c[0].set_fill(PANEL2, 1)
                c[1].set_color(MUTED)
            self.play(LaggedStart(*[FadeIn(c) for c in cells], lag_ratio=0.01), run_time=1.0)
            self.at(1)
            hits = [c for n, c in zip(range(1, 51), cells) if is_sum2(n)]
            self.play(LaggedStart(*[AnimationGroup(c[0].animate.set_fill(ARM, 0.9), c[1].animate.set_color(BG))
                                    for c in hits], lag_ratio=0.05), run_time=2.0)
            lab = M(r"n = a^2 + b^2", 40, ARM).to_edge(UP, buff=0.95)
            self.play(FadeIn(lab), run_time=0.5)
        self.play(FadeOut(VGroup(cells, lab)), run_time=0.6)

        # ---- gen_2: multiplication rule
        with self.seg("gen_2"):
            idt = M(r"(a^2+b^2)(c^2+d^2) = (ac-bd)^2 + (ad+bc)^2", 44).move_to(UP * 1.9)
            self.play(Write(idt), run_time=1.6)
            ex = M(r"5 \times 13 = 65 = 4^2 + 7^2", 44, SQ).next_to(idt, DOWN, buff=0.45).align_to(idt, LEFT)
            atl(self, 0, 1)
            self.play(FadeIn(ex, shift=UP * 0.15), run_time=0.8)
            atl(self, 1, 2)
            o = np.array([0.6, -2.5, 0])
            un = 0.66
            ax = plane(o, un, (-0.5, 9.0), (-0.3, 7.8))
            ax.set_z_index(-1)

            def vec(a, b, col, lab, d=RIGHT):
                v = Arrow(o, o + np.array([a * un, b * un, 0]), buff=0, color=col, stroke_width=5,
                          max_tip_length_to_length_ratio=0.12)
                l = M(lab, 34, col).next_to(v.get_end(), d, buff=0.12)
                return VGroup(v, l)
            z = vec(2, 1, FLIP, "z = 2+i", DR)
            w = vec(3, 2, VIOLET, "w = 3+2i", RIGHT)
            zw = vec(4, 7, SQ, "zw = 4+7i", RIGHT)
            self.play(FadeOut(idt), ex.animate.to_edge(LEFT, buff=0.7).set_y(1.9), Create(ax), run_time=0.7)
            self.play(GrowArrow(z[0]), FadeIn(z[1]), run_time=0.6)
            self.play(GrowArrow(w[0]), FadeIn(w[1]), run_time=0.6)
            self.play(TransformFromCopy(VGroup(z[0], w[0]), zw[0]), FadeIn(zw[1]), run_time=1.0)
            lens = M(r"|z|\,|w| = |zw|", 46, TEXT).next_to(ex, DOWN, buff=0.7).align_to(ex, LEFT)
            lens2 = M(r"\sqrt5 \cdot \sqrt{13} = \sqrt{65}", 40, MUTED).next_to(lens, DOWN, buff=0.35).align_to(ex, LEFT)
            self.play(Write(lens), run_time=0.8)
            self.play(FadeIn(lens2), run_time=0.6)
        self.play(FadeOut(VGroup(ex, ax, z, w, zw, lens, lens2)), run_time=0.6)

        # ---- gen_3: the general criterion
        with self.seg("gen_3"):
            crit = VGroup(M(r"n = a^2 + b^2", 48),
                          M(r"\iff", 48, MUTED),
                          TL("n 的每个 4k+3 型素因子都出现偶数次",
                             "every prime factor 4k+3 of n appears an even number of times", 32, color=SQ))
            crit.arrange(DOWN, buff=0.3).move_to(UP * 1.2)
            atl(self, 0, 1)
            self.play(Write(crit[0]), run_time=0.7)
            self.play(FadeIn(crit[1]), FadeIn(crit[2], shift=UP * 0.15), run_time=1.0)
            exs = VGroup(
                VGroup(M(r"45 = 3^2\cdot 5", 38), check_mark(GOOD, 0.3), M(r"= 6^2 + 3^2", 38, GOOD)),
                VGroup(M(r"21 = 3\cdot 7", 38), cross_mark(BAD, 0.15), M(r"\ne a^2+b^2", 38, BAD)),
                VGroup(M(r"90 = 2\cdot 3^2\cdot 5", 38), check_mark(GOOD, 0.3), M(r"= 9^2 + 3^2", 38, GOOD)),
            )
            for e in exs:
                e.arrange(RIGHT, buff=0.3)
            exs.arrange(DOWN, buff=0.3, aligned_edge=LEFT).next_to(crit, DOWN, buff=0.6)
            self.play(LaggedStart(*[FadeIn(e, shift=RIGHT * 0.2) for e in exs], lag_ratio=0.4), run_time=2.2)
        self.play(FadeOut(VGroup(crit, exs)), run_time=0.6)

        # ---- gen_4: Gaussian primes
        with self.seg("gen_4"):
            N = 13
            un = 0.205
            o = RIGHT * 2.9 + DOWN * 0.05
            ax = plane(o, un, (-N - 0.6, N + 0.6), (-N - 0.6, N + 0.6))
            gp = VGroup()
            for a in range(-N, N + 1):
                for b in range(-N, N + 1):
                    n = a * a + b * b
                    if a and b:
                        ok = is_prime(n)
                    else:
                        m = abs(a) + abs(b)
                        ok = is_prime(m) and m % 4 == 3
                    if ok:
                        gp.add(Square(un * 0.86, fill_color=ARM, fill_opacity=0.85, stroke_width=0)
                               .move_to(o + np.array([a * un, b * un, 0])))
            zt = VGroup(TL("高斯整数", "Gaussian integers", 36, weight=BOLD), M(r"\mathbb{Z}[i] = \{a+bi\}", 40))
            zt.arrange(DOWN, buff=0.25, aligned_edge=LEFT).move_to(LEFT * 3.6 + UP * 1.6)
            self.play(FadeIn(zt), Create(ax), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(s) for s in gp], lag_ratio=0.004), run_time=1.6)
            gl = TL("高斯素数", "Gaussian primes", 24, color=ARM).next_to(ax, UP, buff=0.05)
            self.play(FadeIn(gl), run_time=0.4)
            self.at(1)
            p1 = Square(un * 1.1, stroke_color=SQ, stroke_width=4).move_to(o + np.array([2 * un, un, 0]))
            p2 = Square(un * 1.1, stroke_color=SQ, stroke_width=4).move_to(o + np.array([2 * un, -un, 0]))
            five = M(r"5 = (2+i)(2-i)", 44, SQ).next_to(zt, DOWN, buff=0.6).align_to(zt, LEFT)
            five_dot = Dot(o + np.array([5 * un, 0, 0]), radius=0.08, color=SQ)
            self.play(Create(p1), Create(p2), FadeIn(five_dot), Write(five), run_time=1.2)
            atl(self, 2, 2)
            three = Square(un * 1.1, stroke_color=BAD, stroke_width=4).move_to(o + np.array([3 * un, 0, 0]))
            t3 = VGroup(M("3", 44, BAD), TL("仍是素数", "stays prime", 32, color=BAD)).arrange(RIGHT, buff=0.3)
            t3.next_to(five, DOWN, buff=0.4).align_to(five, LEFT)
            self.play(Create(three), FadeIn(t3), run_time=0.9)
        self.play(FadeOut(VGroup(ax, gp, gl, p1, p2, three, five_dot, zt, five, t3)), run_time=0.6)

        # ---- gen_5: uniqueness
        with self.seg("gen_5"):
            un = 0.45
            o = RIGHT * 2.8 + DOWN * 0.1
            dots = lattice_dots(4, un, o, DIM, 0.03)
            circ = Circle(radius=np.sqrt(13) * un, stroke_color=GOOD, stroke_width=3).move_to(o)
            pts = VGroup(*[Dot(o + np.array([a * un, b * un, 0]), radius=0.09, color=SQ)
                           for a in range(-4, 5) for b in range(-4, 5) if a * a + b * b == 13])
            self.play(FadeIn(dots), Create(circ), run_time=0.8)
            self.play(LaggedStart(*[GrowFromCenter(p) for p in pts], lag_ratio=0.1), run_time=0.9)
            atl(self, 0, 1)
            u1 = M(r"13 = 2^2 + 3^2", 48, SQ).move_to(LEFT * 3.4 + UP * 0.9)
            u2 = TL("8 个点，只是一种写法", "8 points, one representation", 30, color=MUTED).next_to(u1, DOWN, buff=0.35)
            u3 = TL("（不计顺序和正负号）", "(up to order and signs)", 28, color=MUTED).next_to(u2, DOWN, buff=0.2)
            self.play(Write(u1), run_time=0.8)
            self.play(FadeIn(u2), FadeIn(u3), run_time=0.8)
            sq = Polygon(*[o + np.array([a * un, b * un, 0]) for a, b in [(2, 3), (-3, 2), (-2, -3), (3, -2)]],
                         stroke_color=SQ, stroke_width=2.5)
            sq2 = Polygon(*[o + np.array([a * un, b * un, 0]) for a, b in [(3, 2), (-2, 3), (-3, -2), (2, -3)]],
                          stroke_color=SQ, stroke_width=2.5)
            self.play(Create(sq), Create(sq2), run_time=1.2)
        self.play(FadeOut(VGroup(dots, circ, pts, u1, u2, u3, sq, sq2)), run_time=0.6)

        # ---- gen_6: the story continues
        with self.seg("gen_6"):
            rows = [
                (r"x^2 + y^2", r"p = 2 \ \text{or}\ p \equiv 1 \pmod 4", ARM),
                (r"x^2 + 2y^2", r"p = 2 \ \text{or}\ p \equiv 1, 3 \pmod 8", VIOLET),
                (r"x^2 + 3y^2", r"p = 3 \ \text{or}\ p \equiv 1 \pmod 3", RECUT),
            ]
            tbl = VGroup()
            for lhs, rhs, col in rows:
                r = VGroup(M(r"p = " + lhs, 42, col), M(r"\iff", 42, MUTED), M(rhs, 40))
                r.arrange(RIGHT, buff=0.4)
                tbl.add(r)
            tbl.arrange(DOWN, buff=0.45, aligned_edge=LEFT).move_to(UP * 1.0)
            xr = max(r[0].get_right()[0] for r in tbl)
            for r in tbl:
                r[1].next_to(np.array([xr, r[0].get_y(), 0]), RIGHT, buff=0.4)
                r[2].next_to(r[1], RIGHT, buff=0.4)
            tbl.move_to(UP * 1.0)
            self.play(FadeIn(tbl[0]), run_time=0.6)
            self.at(1)
            self.play(FadeIn(tbl[1][0]), run_time=0.6)
            self.at(2)
            self.play(FadeIn(tbl[1][1:]), run_time=0.6)
            self.at(3)
            self.play(FadeIn(tbl[2][0]), run_time=0.6)
            self.at(4)
            self.play(FadeIn(tbl[2][1:]), run_time=0.6)
            self.at(5)
            chain = VGroup(TL("二次互反律", "quadratic reciprocity", 32, color=SQ), M(r"\longrightarrow", 40, MUTED),
                           TL("类域论", "class field theory", 32, color=SQ)).arrange(RIGHT, buff=0.35)
            chain.next_to(tbl, DOWN, buff=0.55)
            self.play(FadeIn(chain[0]), run_time=0.6)
            self.play(FadeIn(chain[1]), FadeIn(chain[2]), run_time=0.8)
            self.at(6)
            lag = VGroup(M(r"n = a^2 + b^2 + c^2 + d^2", 42, GOOD),
                         TL("对所有正整数成立（拉格朗日，1770）", "for every n ≥ 1 (Lagrange, 1770)", 28, color=MUTED))
            lag.arrange(RIGHT, buff=0.45).next_to(chain, DOWN, buff=0.5)
            self.play(FadeIn(lag, shift=UP * 0.2), run_time=0.9)
        self.play(FadeOut(VGroup(tbl, chain, lag)), run_time=0.6)


# ------------------------------------------------------------------ 11
class S11_Apps(FScene):
    def construct(self):
        self.chapter_card(11, "应用", "Applications")
        with self.seg("app_1"):
            c1 = card(TL("① 直角三角形", "① right triangles", 36), pad=0.35, stroke=ARM)
            c2 = card(TL("② π", "② π", 36), pad=0.35, stroke=SQ)
            cc = VGroup(c1, c2).arrange(RIGHT, buff=1.0).move_to(UP * 0.3)
            self.at(1)
            self.play(LaggedStart(FadeIn(c1, shift=UP * 0.2), FadeIn(c2, shift=UP * 0.2), lag_ratio=0.4), run_time=1.0)
        self.play(FadeOut(cc), run_time=0.5)

        # ---- app_2: Pythagorean triples
        with self.seg("app_2"):
            un = 0.38
            o = np.array([-6.3, -2.5, 0])
            ax = plane(o, un, (-0.3, 13), (-0.3, 13.0))
            f1 = M(r"(a+bi)^2 = (a^2-b^2) + 2ab\,i", 44).move_to(RIGHT * 2.3 + UP * 2.2)
            f2 = M(r"|(a+bi)^2| = a^2+b^2 = p", 40, MUTED).next_to(f1, DOWN, buff=0.35)
            self.play(Create(ax), run_time=0.6)
            self.at(1)
            self.play(Write(f1), run_time=1.4)
            self.play(FadeIn(f2), run_time=0.6)

            def tri(a, b, p, col):
                A, B = a * a - b * b, 2 * a * b
                P0, P1, P2 = o, o + RIGHT * A * un, o + RIGHT * A * un + UP * B * un
                poly = Polygon(P0, P1, P2, stroke_color=col, stroke_width=4, fill_color=col, fill_opacity=0.18)
                la = M(str(A), 32, col).next_to(Line(P0, P1), DOWN, buff=0.1)
                lb = M(str(B), 32, col).next_to(Line(P1, P2), RIGHT, buff=0.1)
                lc = M(str(p), 32, col).move_to((P0 + P2) / 2 + np.array([-0.25, 0.25, 0]))
                return VGroup(poly, la, lb, lc)
            self.at(2)
            t5 = tri(2, 1, 5, ARM)
            e5 = M(r"(2+i)^2 = 3+4i", 38, ARM).next_to(f2, DOWN, buff=0.5).align_to(f1, LEFT)
            self.play(Create(t5[0]), FadeIn(t5[1:]), Write(e5), run_time=1.2)
            self.at(3)
            self.play(Indicate(t5, color=ARM), run_time=0.8)
            self.at(4)
            t13 = tri(3, 2, 13, SQ)
            e13 = M(r"(3+2i)^2 = 5+12i", 38, SQ).next_to(e5, DOWN, buff=0.3).align_to(e5, LEFT)
            self.play(Create(t13[0]), FadeIn(t13[1:]), Write(e13), run_time=1.2)
            self.at(5)
            more = VGroup(M(r"17:\ 8,\ 15,\ 17", 34, MUTED), M(r"29:\ 20,\ 21,\ 29", 34, MUTED),
                          M(r"37:\ 12,\ 35,\ 37", 34, MUTED), M(r"41:\ 9,\ 40,\ 41", 34, MUTED))
            more.arrange_in_grid(rows=2, cols=2, buff=(0.6, 0.18), col_alignments="ll")
            more.next_to(e13, DOWN, buff=0.4).align_to(e5, LEFT)
            self.play(LaggedStart(*[FadeIn(m, shift=RIGHT * 0.2) for m in more], lag_ratio=0.25), run_time=1.4)
            hyp = TL("斜边为素数 ⇔ 素数除以 4 余 1", "prime hypotenuse ⇔ prime ≡ 1 (mod 4)", 30, color=GOOD)
            hyp.next_to(more, DOWN, buff=0.35).align_to(more, LEFT)
            if hyp.get_right()[0] > 6.8:
                hyp.scale_to_fit_width(6.8 - hyp.get_left()[0]).align_to(more, LEFT)
            self.play(FadeIn(hyp), run_time=0.7)
        self.play(FadeOut(VGroup(ax, f1, f2, t5, t13, e5, e13, more, hyp)), run_time=0.6)

        # ---- app_3: pi from lattice points
        with self.seg("app_3"):
            R = 7
            un = 0.34
            o = LEFT * 3.6 + DOWN * 0.15
            allpts = VGroup()
            inpts = []
            for a in range(-R - 1, R + 2):
                for b in range(-R - 1, R + 2):
                    d = Dot(o + np.array([a * un, b * un, 0]), radius=0.045, color=DIM)
                    allpts.add(d)
                    if a * a + b * b <= R * R:
                        inpts.append(d)
            circ = Circle(radius=R * un, stroke_color=SQ, stroke_width=3).move_to(o)
            self.play(FadeIn(allpts), run_time=0.6)
            atl(self, 1, 1)
            self.play(Create(circ), run_time=0.9)
            self.play(LaggedStart(*[d.animate.set_color(SQ).scale(1.5) for d in inpts], lag_ratio=0.004), run_time=1.5)
            cnt = M(rf"\#\{{x^2+y^2 \le {R*R}\}} = {len(inpts)}", 36).move_to(RIGHT * 3.0 + UP * 2.2)
            approx = M(rf"\approx \pi R^2 = {np.pi*R*R:.1f}", 36, SQ).next_to(cnt, DOWN, buff=0.25)
            self.play(Write(cnt), run_time=0.8)
            atl(self, 1, 2)
            self.play(FadeIn(approx), run_time=0.6)
            atl(self, 2, 3)
            r2 = M(r"r_2(n) = 4\,\big(d_1(n) - d_3(n)\big)", 36, ARM).next_to(approx, DOWN, buff=0.45)
            r2c = TL("（数 n 的 4k+1 型与 4k+3 型因数）", "(count divisors of n of type 4k+1 and 4k+3)", 22,
                     color=MUTED).next_to(r2, DOWN, buff=0.15)
            if r2c.width > 6.4:
                r2c.scale_to_fit_width(6.4)
            self.play(Write(r2), FadeIn(r2c), run_time=1.2)
            atl(self, 3, 5)
            lz = M(r"\frac{\pi}{4} = 1 - \frac13 + \frac15 - \frac17 + \cdots", 44, GOOD).next_to(r2c, DOWN, buff=0.45)
            self.play(Write(lz), run_time=1.4)
            # partial sums
            base = lz.get_bottom() + DOWN * 0.45
            x0 = r2c.get_left()[0]
            target = Line(np.array([x0, base[1] - 0.4, 0]), np.array([x0 + 5.6, base[1] - 0.4, 0]),
                          color=GOOD, stroke_width=2)
            s, seq = 0.0, []
            for k in range(14):
                s += (-1) ** k / (2 * k + 1)
                seq.append(s)
            sc = 2.4
            dots = VGroup(*[Dot(np.array([x0 + 0.4 * k, base[1] - 0.4 + (v - np.pi / 4) * sc, 0]), radius=0.05,
                                color=TEXT) for k, v in enumerate(seq)])
            self.play(Create(target), LaggedStart(*[FadeIn(d) for d in dots], lag_ratio=0.12), run_time=1.4)
        self.play(FadeOut(VGroup(allpts, circ, cnt, approx, r2, r2c, lz, target, dots)), run_time=0.6)

        # ---- app_4: the web of connections
        with self.seg("app_4"):
            centre = card(M(r"p = x^2 + y^2", 44, SQ), pad=0.3, stroke=SQ)
            names = [L("几何 · 格点", "geometry · lattices"), L("复数 · ℤ[i]", "complex numbers · ℤ[i]"),
                     L("π · 莱布尼茨", "π · Leibniz"), L("勾股数", "Pythagorean triples"),
                     L("奇偶 · 对合", "parity · involutions"), L("算法", "algorithms")]
            nodes = VGroup()
            for k, nm in enumerate(names):
                ang = PI / 2 + k * TAU / len(names)
                n = card(T(nm, 28), pad=0.22, stroke=GRID, color=PANEL2).move_to(
                    np.array([4.4 * np.cos(ang), 2.0 * np.sin(ang) + 0.2, 0]))
                nodes.add(n)
            centre.move_to(UP * 0.2)
            edges = VGroup(*[Line(centre.get_center(), n.get_center(), color=GRID, stroke_width=2) for n in nodes])
            edges.set_z_index(-1)
            self.play(FadeIn(centre, scale=0.9), run_time=0.6)
            self.play(LaggedStart(*[AnimationGroup(Create(e), FadeIn(n)) for e, n in zip(edges, nodes)],
                                  lag_ratio=0.2), run_time=2.2)
            self.at(1)
            self.play(edges.animate.set_color(SQ), run_time=0.8)
        self.play(FadeOut(VGroup(centre, nodes, edges)), run_time=0.7)


# ------------------------------------------------------------------ 12
def _script():
    with open(ROOT / "script" / "script.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def wrap_lines(s, width, size, color=TEXT, buff=0.14):
    lines = textwrap.wrap(s, width)
    return VGroup(*[T(l, size, color) for l in lines]).arrange(DOWN, aligned_edge=LEFT, buff=buff)


class S12_Interview(FScene):
    def construct(self):
        self.chapter_card(12, "模拟面试", "Mock interview")
        data = _script()
        segs = {s["id"]: s for s in next(sc for sc in data["scenes"] if sc["id"] == "S12_Interview")["segments"]}
        n = 12

        # ---- intro: the ladder of questions
        with self.seg("iv_intro"):
            levels = [segs[f"q{k}"]["level"]["zh" if ZH else "en"] for k in range(1, n + 1)]
            chips = VGroup()
            for k, lv in enumerate(levels):
                c = VGroup(T(f"Q{k+1}", 24, SQ, weight=BOLD, font=LAT_FONT), T(lv, 26, TEXT)).arrange(RIGHT, buff=0.2)
                chips.add(c)
            chips.arrange_in_grid(rows=6, cols=2, buff=(1.6, 0.32), flow_order="dr", col_alignments="ll")
            chips.move_to(DOWN * 0.1)
            ttl = TL("一层一层往下追问", "the questions go deeper and deeper", 32, color=MUTED).next_to(chips, UP, buff=0.4)
            self.play(FadeIn(ttl), run_time=0.6)
            self.play(LaggedStart(*[FadeIn(c, shift=RIGHT * 0.2) for c in chips], lag_ratio=0.12), run_time=2.6)
            depth = Arrow(chips.get_corner(UR) + RIGHT * 0.5, chips.get_corner(DR) + RIGHT * 0.5, color=SQ,
                          stroke_width=5, buff=0)
            dl = TL("深度", "depth", 26, color=SQ).next_to(depth, RIGHT, buff=0.15)
            self.play(GrowArrow(depth), FadeIn(dl), run_time=0.8)
        self.play(FadeOut(VGroup(ttl, chips, depth, dl)), run_time=0.6)

        # persistent progress bar
        bar = VGroup(*[RoundedRectangle(corner_radius=0.04, width=0.42, height=0.12, fill_color=PANEL2,
                                        fill_opacity=1, stroke_width=0) for _ in range(n)]).arrange(RIGHT, buff=0.07)
        bar.to_corner(UR, buff=0.42)
        self.play(FadeIn(bar), run_time=0.4)

        def person(col):
            g = VGroup(Circle(0.27, fill_color=col, fill_opacity=1, stroke_width=0),
                       Arc(radius=0.44, start_angle=0, angle=PI, fill_color=col, fill_opacity=1, stroke_width=0))
            g[1].next_to(g[0], DOWN, buff=0.07)
            return g
        prof = person(FLIP).move_to(LEFT * 6.25 + UP * 2.2)
        me = person(SQ).move_to(LEFT * 6.25 + DOWN * 0.8)
        self.play(FadeIn(prof), FadeIn(me), run_time=0.4)
        X0, W = -5.55, 12.1          # left edge and width of bubble / panel

        def fit_lines(text, size, width, color=TEXT, buff=0.12):
            cpl = max(20, int(width / (0.0066 * size * FS)))
            g = wrap_lines(text, cpl, size, color, buff)
            if g.width > width:
                g.scale_to_fit_width(width)
            return g

        prev = VGroup()
        for k in range(1, n + 1):
            q, a = segs[f"q{k}"], segs[f"a{k}"]
            lv = q["level"]["zh" if ZH else "en"]
            with self.seg(f"q{k}"):
                self.play(FadeOut(prev), bar[k - 1].animate.set_fill(SQ, 1), run_time=0.4)
                head = VGroup(T(f"Q{k}", 28, SQ, weight=BOLD, font=LAT_FONT), tag(lv, FLIP, 20)).arrange(RIGHT, buff=0.25)
                head.move_to([-0.9, 3.55, 0])
                qt = fit_lines(q["en"], 30, W - 0.7)
                if ZH:
                    qt.add(T(q["zh_tr"], 25, MUTED))
                    qt.arrange(DOWN, aligned_edge=LEFT, buff=0.14)
                    if qt.width > W - 0.7:
                        qt.scale_to_fit_width(W - 0.7)
                bub = RoundedRectangle(corner_radius=0.2, width=W, height=qt.height + 0.45,
                                       fill_color=PANEL2, fill_opacity=1, stroke_color=FLIP, stroke_width=2)
                bub.move_to([X0 + W / 2, 3.05 - bub.height / 2, 0])
                qt.move_to(bub).align_to(bub, LEFT).shift(RIGHT * 0.35)
                qb = VGroup(bub, qt)
                prof.set_y(bub.get_y())
                self.play(FadeIn(head, shift=RIGHT * 0.2), FadeIn(bub, scale=0.97), run_time=0.45)
                self.play(FadeIn(qt, lag_ratio=0.15), run_time=min(1.2, max(0.5, self.left() - 0.3)))
            with self.seg(f"a{k}"):
                top_y = bub.get_bottom()[1] - 0.25
                avail = top_y - (SUB_Y + 0.08)
                if ZH:
                    hdr = VGroup(T("参考回答", 24, SQ, weight=BOLD), T("Model answer", 22, MUTED)).arrange(RIGHT, buff=0.25)
                    body = fit_lines(a["en"], 22, W - 0.7, TEXT, 0.1)
                    panel_body = VGroup(hdr, body).arrange(DOWN, aligned_edge=LEFT, buff=0.18)
                else:
                    hdr = T("Answer structure", 24, SQ, weight=BOLD)
                    keys = VGroup()
                    for i, kx in enumerate(a.get("keys", [])):
                        num = VGroup(Circle(0.19, fill_color=SQ, fill_opacity=1, stroke_width=0),
                                     T(f"{i+1}", 21, BG, weight=BOLD, font=LAT_FONT))
                        num[1].move_to(num[0])
                        keys.add(VGroup(num, T(kx, 28, TEXT)).arrange(RIGHT, buff=0.25))
                    keys.arrange(DOWN, aligned_edge=LEFT, buff=0.2)
                    panel_body = VGroup(hdr, keys).arrange(DOWN, aligned_edge=LEFT, buff=0.26)
                if panel_body.height > avail - 0.45:
                    panel_body.scale_to_fit_height(avail - 0.45)
                panel = RoundedRectangle(corner_radius=0.2, width=W, height=panel_body.height + 0.45,
                                         fill_color=PANEL, fill_opacity=1, stroke_color=SQ, stroke_width=1.5)
                panel.move_to([X0 + W / 2, top_y - panel.height / 2, 0])
                panel_body.move_to(panel).align_to(panel, LEFT).shift(RIGHT * 0.35)
                me.set_y(panel.get_y())
                self.play(FadeIn(panel), FadeIn(hdr), run_time=0.45)
                if ZH:
                    self.play(LaggedStart(*[FadeIn(l, shift=UP * 0.06) for l in body], lag_ratio=0.35),
                              run_time=min(3.0, max(1.0, self.left() - 1.0)))
                else:
                    m = len(keys)
                    ns = self.nsent()
                    for i, kk in enumerate(keys):
                        self.at(min(ns - 1, round(i * ns / m)))
                        self.play(FadeIn(kk, shift=RIGHT * 0.2), run_time=0.45)
            prev = VGroup(head, qb, panel, panel_body)
        self.play(FadeOut(VGroup(prev, bar, prof, me)), run_time=0.6)


# ------------------------------------------------------------------ 13
class S13_Outro(FScene):
    def construct(self):
        self.chapter_card(13, "我的思考", "What I learned")
        with self.seg("out_1"):
            big = TL("这个定理教会我的", "What this theorem taught me", 52, weight=BOLD)
            self.play(Write(big), run_time=1.0)
        self.play(FadeOut(big, shift=UP * 0.3), run_time=0.5)
        with self.seg("out_2"):
            items = [(L("① 数一数：有时只看奇偶", "① count it, sometimes just mod 2"), FLIP),
                     (L("② 对称可以自己创造", "② a symmetry can be created"), VIOLET),
                     (L("③ 好的图让魔术变得自然", "③ a picture turns magic into sense"), RECUT)]
            cards = VGroup(*[card(T(s, 34), pad=0.3, stroke=c) for s, c in items])
            cards.arrange(DOWN, buff=0.4, aligned_edge=LEFT).move_to(UP * 0.2)
            idx = [0, 1, 2] if ZH else [0, 1, 3]
            for i, c in zip(idx, cards):
                self.at(i)
                self.play(FadeIn(c, shift=RIGHT * 0.3), run_time=0.7)
        self.play(FadeOut(cards), run_time=0.6)

        with self.seg("out_3"):
            cl = Circle(radius=2.35, stroke_color=FLIP, stroke_width=4, fill_color=FLIP, fill_opacity=0.08)
            cr = Circle(radius=2.35, stroke_color=RECUT, stroke_width=4, fill_color=RECUT, fill_opacity=0.08)
            cl.move_to(LEFT * 1.55 + DOWN * 0.1)
            cr.move_to(RIGHT * 1.55 + DOWN * 0.1)
            tl = TL("不动点", "fixed points", 32, color=FLIP, weight=BOLD).next_to(cl, UP, buff=0.12).shift(LEFT * 0.9)
            tr = TL("奇偶", "parity", 32, color=RECUT, weight=BOLD).next_to(cr, UP, buff=0.12).shift(RIGHT * 0.9)
            br = VGroup(T(L("布劳威尔", "Brouwer"), 30, TEXT, weight=BOLD)).move_to(cl.get_center() + LEFT * 1.15)
            sp = VGroup(T(L("斯潘纳", "Sperner"), 30, TEXT, weight=BOLD)).move_to(cr.get_center() + RIGHT * 1.15)
            wm = Windmill(1, 1, 3, unit=0.24, cells=False, stroke_width=1)
            wm.shift(UP * 0.25 - wm.centre())
            zg = T(L("扎吉尔", "Zagier"), 28, SQ, weight=BOLD).next_to(wm, DOWN, buff=0.15)
            self.play(Create(cl), FadeIn(tl), FadeIn(br), run_time=0.9)
            self.at(1)
            self.play(Create(cr), FadeIn(tr), FadeIn(sp), run_time=0.9)
            self.at(2)
            self.play(FadeIn(wm, scale=0.5), FadeIn(zg), run_time=0.9)
            wm.add_updater(lambda m, dt: m.rotate(-0.8 * dt, about_point=m.centre()))
            atl(self, 3, 3)
            self.play(Indicate(zg, color=SQ), run_time=1.0)
        self.hold(0.3)
        wm.clear_updaters()
        self.play(FadeOut(VGroup(cl, cr, tl, tr, br, sp, wm, zg)), run_time=0.6)

        with self.seg("out_4", tail=1.6):
            w = Windmill(3, 1, 1, unit=0.42)
            w.shift(UP * 1.2 - w.centre())
            title = TL("风车里的素数", "Primes in a Windmill", 64, weight=BOLD).next_to(w, DOWN, buff=0.5)
            ty = TL("感谢观看", "Thank you for watching", 34, color=MUTED).next_to(title, DOWN, buff=0.3)
            self.play(FadeIn(w, scale=0.8), Write(title), run_time=1.2)
            w.add_updater(lambda m, dt: m.rotate(-0.5 * dt, about_point=m.centre()))
            self.play(FadeIn(ty), run_time=0.6)
        self.hold(1.0)
        w.clear_updaters()
        self.play(FadeOut(VGroup(w, title, ty)), run_time=1.0)
