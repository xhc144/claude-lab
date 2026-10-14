"""Chapters 06-08: the windmill, the rigorous proof, the ideas behind it."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from manim import *  # noqa: F401,F403

from base import (NarratedScene, Windmill, below, card, chip, col, ease, ease_out, fit, mtx, triple_tex, tx,
                  windmill_icon, wrap)
from config import (BG, CORAL, FAINT, GOLD, INK, LANG, LIME, MUTED, PANEL, SKY, T, TEAL, VIOLET)
import geometry as G


def zeta_cases_tex(size=34):
    m = MathTex(
        r"\zeta(x,y,z)=\begin{cases}"
        r"(x+2z,\; z,\; y-x-z) & x<y-z\\"
        r"(2y-x,\; y,\; x-y+z) & y-z<x<2y\\"
        r"(x-2y,\; x-y+z,\; y) & x>2y"
        r"\end{cases}", font_size=size)
    m.set_color(INK)
    return m


class S06_Windmill(NarratedScene):
    number = 6

    def construct(self):
        self.chapter_intro()
        U = 0.40
        C = LEFT * 3.4 + UP * 0.25
        wm = Windmill(3, 2, 4, unit=U, grid=False, outline=False).move_to(C)

        # ---- w1: x^2 + 4yz is an area
        with self.say("w1") as d:
            area = col(mtx(r"x^2", r"+", r"4", r"y", r"z", r"=", r"p", size=60), 2.45)
            area[0].set_color(GOLD)
            area[3:5].set_color(TEAL)
            self.play(Write(area[:5]), run_time=1.0)
            self.play(GrowFromCenter(wm.square), run_time=0.8, rate_func=ease_out)
            xl = mtx("x", size=34, color=GOLD).next_to(wm.square, UP, 0.12).shift(RIGHT * 0.25)
            self.play(FadeIn(xl), run_time=0.3)
            dirs = [UP, LEFT, DOWN, RIGHT]
            self.play(LaggedStart(*[GrowFromEdge(b, dirs[k]) for k, b in enumerate(wm.blades)],
                                  lag_ratio=0.25, run_time=1.8, rate_func=ease_out))
            b0 = wm.blades[0]
            yl = mtx("y", size=32, color=TEAL).next_to(b0, DOWN, 0.1)
            zl = mtx("z", size=32, color=TEAL).next_to(b0, LEFT, 0.1)
            self.play(FadeIn(yl), FadeIn(zl), run_time=0.5)
            self.at(1, lead=0.3)
            self.play(Write(area[5:]), Indicate(wm, scale_factor=1.04, color=None), run_time=1.2)

        # ---- w2: concrete p = 41, (3,2,4); count the cells
        with self.say("w2") as d:
            ex = below(mtx(r"p=41,\quad (x,y,z)=(3,2,4)", size=40), area, 0.55)
            self.play(FadeIn(ex, shift=UP * 0.2), FadeOut(xl), run_time=0.7)
            wm.remove(wm.grid)
            self.play(Create(wm.attach_grid()), run_time=0.9)
            self.at(1, lead=0.2)
            count = below(Integer(0, font_size=72, color=INK), ex, 0.55)
            ghost = Integer(88, font_size=72).move_to(count, aligned_edge=LEFT)
            cells_lbl = tx(T("格", "cells"), size=30, color=MUTED).next_to(ghost, RIGHT, 0.2).align_to(ghost, DOWN)
            self.add(count, cells_lbl)
            sq_eq = mtx(r"9", size=44, color=GOLD)
            bl_eq = mtx(r"+\,4\times 8", size=44, color=TEAL)
            eq = below(VGroup(sq_eq, bl_eq, mtx(r"=41", size=44)).arrange(RIGHT, buff=0.15), count, 0.4)
            self.play(Flash(wm.square, color=GOLD, flash_radius=0.9), ChangeDecimalToValue(count, 9),
                      FadeIn(sq_eq), run_time=1.0)
            self.play(ChangeDecimalToValue(count, 41), FadeIn(bl_eq),
                      LaggedStart(*[Indicate(b, color=None, scale_factor=1.06) for b in wm.blades], lag_ratio=0.2),
                      run_time=1.8)
            self.play(FadeIn(eq[2]), run_time=0.4)
            note = below(fit(T("S 的每个元素 = 一架面积为 p 的风车", "every element of S = a windmill of area p"),
                             size=30, max_w=6.3), eq, 0.55)
            self.at(2, lead=0.2)
            self.play(FadeIn(note, shift=UP * 0.15), run_time=0.7)
        self.play(FadeOut(VGroup(count, cells_lbl, eq, note, ex)), run_time=0.5)

        # ---- w3: the swap flips every blade
        with self.say("w3") as d:
            tau_lbl = below(mtx(r"\tau:\ (x,y,z)\mapsto(x,z,y)", size=44, color=SKY), area, 0.6)
            self.play(FadeIn(tau_lbl, shift=UP * 0.2), FadeOut(yl), FadeOut(zl), FadeOut(wm.grid), run_time=0.7)
            wm.remove(wm.grid)
            diag = VGroup()
            for k in range(4):
                (cu, cv), (du, dv) = G.blade_anchor_axis(3, k)
                a = wm.point(cu, cv)
                dvec = np.array([du, dv, 0]) / np.sqrt(2)
                diag.add(DashedLine(a - dvec * 1.4, a + dvec * 1.4, stroke_color=SKY, stroke_width=2.5, dash_length=0.08))
            self.play(Create(diag), run_time=0.6)
            self.play(*wm.flip_blades(run_time=1.8))
            r1 = below(mtx(r"(3,2,4)\ \longrightarrow\ (3,4,2)", size=40), tau_lbl, 0.45)
            self.play(FadeIn(r1), FadeOut(diag), run_time=0.6)
            self.play(*wm.flip_blades(run_time=1.4))
            fixed = below(fit(T("不变  ⟺  风叶是正方形，y = z", "unchanged  ⟺  square blades, y = z"),
                              size=30, color=LIME, max_w=6.3), r1, 0.5)
            self.at(1, lead=0.2)
            self.play(FadeIn(fixed, shift=UP * 0.15), run_time=0.6)

        # ---- w4: square blades assemble into one square: 41 = 5^2 + 4^2
        with self.say("w4") as d:
            wm2 = Windmill(5, 2, 2, unit=U, grid=True, outline=False).move_to(C)
            self.play(FadeOut(VGroup(r1, fixed)), ReplacementTransform(wm, wm2), run_time=1.2)
            lab = triple_tex((5, 2, 2), size=38).next_to(wm2, DOWN, 0.3)
            self.play(FadeIn(lab), run_time=0.4)
            s2 = 2 * U
            corner = C + RIGHT * 1.7
            offs = [np.array([-0.5, -0.5, 0]), np.array([0.5, -0.5, 0]), np.array([0.5, 0.5, 0]), np.array([-0.5, 0.5, 0])]
            anims = [wm2.square.animate.move_to(C + LEFT * 1.4), FadeOut(lab), FadeOut(wm2.grid)]
            for k, b in enumerate(wm2.blades):
                anims.append(b.animate.move_to(corner + offs[k] * s2))
            self.play(*anims, run_time=1.8, rate_func=ease)
            big = Square(side_length=4 * U, stroke_color=INK, stroke_width=3).move_to(corner)
            l5 = mtx("5", size=38, color=GOLD).next_to(wm2.square, DOWN, 0.18)
            l4 = mtx("4", size=38, color=TEAL).next_to(big, DOWN, 0.18)
            self.play(Create(big), FadeIn(l5), FadeIn(l4), run_time=0.8)
            res = below(mtx(r"41", r"=", r"25", r"+", r"16", r"=", r"5^2", r"+", r"4^2", size=50), tau_lbl, 0.6)
            res[2].set_color(GOLD); res[6].set_color(GOLD); res[4].set_color(TEAL); res[8].set_color(TEAL)
            self.at(1, lead=0.2)
            self.play(Write(res), run_time=1.4)
        self.play(FadeOut(VGroup(wm2.square, wm2.blades, big, l5, l4, res, tau_lbl)), run_time=0.6)

        # ---- w5: back to (3,2,4); keep only the outline
        wm = Windmill(3, 2, 4, unit=U, grid=False, outline=True).move_to(C)
        wm.outline.set_stroke(opacity=0)
        with self.say("w5") as d:
            zl_lbl = below(mtx(r"\zeta\,:\ ?", size=48, color=VIOLET), area, 0.6)
            self.play(FadeIn(wm.square), FadeIn(wm.blades), FadeIn(zl_lbl), run_time=0.9)
            lab = triple_tex((3, 2, 4), size=38).next_to(wm, DOWN, 0.3)
            self.play(FadeIn(lab), run_time=0.4)
            sil = VGroup(wm.square, wm.blades)
            self.at_frac(0.45)
            self.play(sil.animate.set_fill(FAINT, 0.9).set_stroke(FAINT, 1),
                      wm.outline.animate.set_stroke(INK, opacity=1), run_time=1.6, rate_func=ease)

        # ---- w6: inward corners, two ways to extend
        opts = G.corner_options(wm.poly)
        sq0, bl0 = G.pieces(3, 2, 4)
        cuts0 = G.interior_segments([sq0] + bl0, wm.cells, 3)
        with self.say("w6") as d:
            dots = VGroup(*[Dot(wm.point(*pt), radius=0.09, color=CORAL) for pt, _, _ in opts])
            self.play(LaggedStart(*[GrowFromCenter(dt) for dt in dots], lag_ratio=0.2), run_time=0.9)
            self.play(LaggedStart(*[Flash(dt, color=CORAL, flash_radius=0.3) for dt in dots], lag_ratio=0.15), run_time=0.8)
            arrows_o, arrows_a = VGroup(), VGroup()
            for pt, din, dback in opts:
                p0 = wm.point(*pt)
                for dvec in (din, dback):
                    q = (pt[0] + 0.5 * dvec[0], pt[1] + 0.5 * dvec[1])
                    is_orig = G.on_segments(q, cuts0)
                    a = Arrow(p0, p0 + np.array([dvec[0], dvec[1], 0]) * 0.75, buff=0, stroke_width=5,
                              max_tip_length_to_length_ratio=0.35, color=GOLD if is_orig else VIOLET)
                    (arrows_o if is_orig else arrows_a).add(a)
            self.at(1, lead=0.2)
            self.play(LaggedStart(*[GrowArrow(a) for a in [*arrows_o, *arrows_a]], lag_ratio=0.08), run_time=1.0)
            orig_cuts = wm.cuts(color=GOLD, width=5)
            alt = Windmill(1, 2, 5, unit=U, hand=-1, grid=False, outline=False).move_to(C)
            alt_cuts = alt.cuts(color=VIOLET, width=5)
            o_dash = VGroup(*[DashedLine(l.get_start(), l.get_end(), stroke_color=GOLD, stroke_width=5, dash_length=0.1) for l in orig_cuts])
            a_dash = VGroup(*[DashedLine(l.get_start(), l.get_end(), stroke_color=VIOLET, stroke_width=5, dash_length=0.1) for l in alt_cuts])
            self.play(FadeOut(arrows_a), Create(o_dash), run_time=1.3)
            self.play(sil[0].animate.set_fill(GOLD, 0.85), sil[1].animate.set_fill(TEAL, 0.85), run_time=0.9)
            self.at(2, lead=0.2)
            self.play(sil.animate.set_fill(FAINT, 0.9), FadeOut(o_dash), FadeOut(arrows_o), FadeIn(arrows_a), run_time=0.7)
            self.play(Create(a_dash), run_time=1.3)
            self.play(FadeOut(arrows_a), run_time=0.4)

        # ---- w7: the new windmill (1,2,5), spinning the other way
        with self.say("w7") as d:
            alt.square.set_fill(GOLD, 0.0)
            alt.blades.set_fill(TEAL, 0.0)
            sil_copy = VGroup(*[r.copy().set_fill(FAINT, 0.9).set_stroke(FAINT, 1) for r in [alt.square, *alt.blades]])
            self.add(sil_copy, alt.square, alt.blades)
            self.remove(wm.square, wm.blades)
            self.bring_to_front(wm.outline, a_dash, dots)
            self.play(FadeOut(sil_copy), alt.square.animate.set_fill(GOLD, 0.88),
                      alt.blades.animate.set_fill(TEAL, 0.88), run_time=1.2)
            new_lab = triple_tex((1, 2, 5), size=38).move_to(lab)
            self.play(Transform(lab, new_lab), run_time=0.8)
            same = below(fit(T("同样的轮廓 · 同样的面积", "same outline · same area"), size=30, max_w=6.3), zl_lbl, 0.5)
            self.play(FadeIn(same, shift=UP * 0.15), run_time=0.6)
            self.at(1, lead=0.2)
            spin1 = Arc(radius=2.55, start_angle=PI * 0.12, angle=PI * 0.36, color=MUTED, stroke_width=3).move_arc_center_to(C)
            spin1.add_tip(tip_length=0.2)
            spin2 = Arc(radius=2.55, start_angle=PI * 0.48, angle=-PI * 0.36, color=VIOLET, stroke_width=3).move_arc_center_to(C)
            spin2.add_tip(tip_length=0.2)
            self.play(Create(spin1), run_time=0.7)
            self.play(ReplacementTransform(spin1, spin2), run_time=0.8)
            self.play(FadeOut(spin2), run_time=0.4)

        # ---- w8: one outline, exactly two cuts
        with self.say("w8") as d:
            self.play(FadeOut(dots), FadeOut(a_dash), FadeOut(zl_lbl), FadeOut(same), FadeOut(area), run_time=0.5)
            group = VGroup(alt.square, alt.blades, wm.outline, lab)
            self.play(group.animate.scale(0.7).move_to(RIGHT * 3.1 + DOWN * 0.1), run_time=1.0)
            left = Windmill(3, 2, 4, unit=U * 0.7, grid=False).move_to(LEFT * 3.1 + UP * 0.1)
            llab = triple_tex((3, 2, 4), size=34).next_to(left, DOWN, 0.25)
            self.play(FadeIn(left, shift=RIGHT * 0.3), FadeIn(llab), run_time=0.8)
            top = CurvedArrow(LEFT * 1.2 + UP * 1.3, RIGHT * 1.2 + UP * 1.3, angle=-PI / 3, color=VIOLET, stroke_width=5)
            bot = CurvedArrow(RIGHT * 1.2 + DOWN * 1.0, LEFT * 1.2 + DOWN * 1.0, angle=-PI / 3, color=VIOLET, stroke_width=5)
            zt = mtx(r"\zeta", size=44, color=VIOLET).next_to(top, UP, 0.08)
            zb = mtx(r"\zeta", size=44, color=VIOLET).next_to(bot, DOWN, 0.08)
            self.play(Create(top), FadeIn(zt), run_time=0.8)
            self.play(Create(bot), FadeIn(zb), run_time=0.8)
            msg = tx(T("同一个轮廓 · 恰好两种切法", "one outline · exactly two cuts"), size=38, color=INK).to_edge(UP, buff=0.95)
            self.play(FadeIn(msg, shift=DOWN * 0.15), run_time=0.6)
            inv = mtx(r"\zeta\circ\zeta=\mathrm{id}", size=44, color=VIOLET).move_to(UP * 0.15)
            self.at(1, lead=0.2)
            self.play(Write(inv), run_time=0.8)
        self.play(FadeOut(VGroup(group, left, llab, top, bot, zt, zb, msg, inv)), run_time=0.6)

        # ---- w9: the cross is the unique fixed point
        with self.say("w9") as d:
            cross = Windmill(1, 1, 10, unit=0.205, grid=True, outline=True).move_to(LEFT * 3.0 + UP * 0.3)
            self.play(FadeIn(cross.outline), run_time=0.6)
            self.play(GrowFromCenter(cross.square),
                      LaggedStart(*[GrowFromEdge(b, dd) for b, dd in zip(cross.blades, [UP, LEFT, DOWN, RIGHT])], lag_ratio=0.2),
                      run_time=1.4)
            self.add(cross.grid)
            cc = G.concave_corners(cross.poly)
            cdots = VGroup(*[Dot(cross.point(u, v), radius=0.06, color=CORAL) for u, v in cc])
            self.play(LaggedStart(*[GrowFromCenter(x) for x in cdots], lag_ratio=0.2), run_time=0.7)
            # zoomed inset of the centre
            inset = Windmill(1, 1, 2, unit=0.62, grid=False, outline=True).move_to(RIGHT * 0.9 + UP * 0.5)
            frame = Square(side_length=0.75, stroke_color=CORAL, stroke_width=2).move_to(cross.square)
            frame2 = Square(side_length=2.9, stroke_color=CORAL, stroke_width=2).move_to(inset)
            link = DashedLine(frame.get_corner(UR), frame2.get_corner(UL), stroke_color=CORAL, stroke_width=1.5)
            self.play(Create(frame), Create(link), FadeIn(frame2), FadeIn(inset), run_time=0.8)
            idots = VGroup(*[Dot(inset.point(u, v), radius=0.08, color=CORAL) for u, v in G.concave_corners(inset.poly)])
            both = VGroup(inset.cuts(color=GOLD, width=6), inset.cuts(color=VIOLET, width=3))
            self.play(FadeIn(idots), Create(both), run_time=0.9)
            self.at(1, lead=0.2)
            lab = col(mtx(r"(1,\ 1,\ \tfrac{p-1}{4})", size=48, color=LIME), 1.6, x=2.9)
            self.play(Write(lab), run_time=1.0)
            arm = below(VGroup(tx(T("臂长 =", "arm ="), size=32, color=TEAL), mtx(r"\tfrac{p-1}{4}", size=40, color=TEAL)
                               ).arrange(RIGHT, buff=0.15), lab, 0.45)
            self.play(FadeIn(arm), run_time=0.6)
            fp = below(tx(T("唯一的不动点", "the unique fixed point"), size=36, color=LIME), arm, 0.5)
            self.at(2, lead=0.2)
            self.play(FadeIn(fp, scale=1.2), Flash(cross.square, color=LIME, flash_radius=0.5), run_time=0.8)
        self.play(FadeOut(VGroup(cross, cdots, frame, frame2, link, inset, idots, both, lab, arm, fp)), run_time=0.6)

        # ---- w10: the three cases are bookkeeping
        with self.say("w10") as d:
            f = zeta_cases_tex(38).move_to(UP * 2.1)
            self.play(Write(f), run_time=1.4)
            rows = [(1, 10, 1), (3, 2, 4), (3, 1, 8)]
            words = [T("正方形变大", "square grows"), T("中间情形：2y − x", "middle case: 2y − x"), T("正方形变小", "square shrinks")]
            cols = VGroup()
            for k, t in enumerate(rows):
                u = G.zeta(t)
                a = windmill_icon(t, size=1.6)
                b = windmill_icon(u, size=1.6, hand=G.zeta_hand(t))
                arr = Arrow(LEFT * 0.35, RIGHT * 0.35, color=VIOLET, buff=0, stroke_width=4)
                pair = VGroup(a, arr, b).arrange(RIGHT, buff=0.2)
                labs = VGroup(triple_tex(t, 26), triple_tex(u, 26))
                labs[0].next_to(a, DOWN, 0.14)
                labs[1].next_to(b, DOWN, 0.14)
                w = tx(words[k], size=26, color=MUTED).next_to(labs, DOWN, 0.2)
                cols.add(VGroup(pair, labs, w))
            cols.arrange(RIGHT, buff=0.7).move_to(DOWN * 0.3)
            self.at(1, lead=0.4)
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in cols], lag_ratio=0.35), run_time=2.2)
            for k in range(3):
                self.play(Indicate(f[0], scale_factor=1.0, color=VIOLET), Circumscribe(cols[k], color=VIOLET, time_width=0.6), run_time=1.0)
        self.clear_stage(0.7)


def self_loop(point, color, radius=0.26, direction=UP):
    arc = Arc(radius=radius, start_angle=-PI * 0.2, angle=PI * 1.4, color=color, stroke_width=4)
    arc.add_tip(tip_length=0.13)
    arc.rotate(np.arctan2(direction[1], direction[0]) - PI / 2, about_point=ORIGIN)
    arc.move_to(point + direction * (radius + 0.1))
    return arc


# ===================================================================== 07
class S07_Proof(NarratedScene):
    number = 7

    def construct(self):
        self.chapter_intro()
        labels = [T("有限且非空", "finite, non-empty"), T("三种情形无遗漏", "the cases cover S"),
                  T("ζ 把 S 映到 S", "ζ maps S to S"), T("ζ 是对合", "ζ is an involution"),
                  T("恰好一个不动点", "exactly one fixed point")]
        items = VGroup()
        for k, l in enumerate(labels):
            c = Circle(radius=0.24, stroke_color=MUTED, stroke_width=2.5)
            n = tx(str(k + 1), size=24, color=MUTED, font="Inter").move_to(c)
            t = tx(l, size=26, color=MUTED)
            items.add(VGroup(VGroup(c, n), t).arrange(RIGHT, buff=0.22))
        items.arrange(DOWN, buff=0.38, aligned_edge=LEFT).move_to(LEFT * 4.75 + UP * 0.75)
        X0 = -1.7

        def activate(k):
            it = items[k]
            return [it[0][0].animate.set_stroke(GOLD, 3.5), it[0][1].animate.set_color(GOLD),
                    it[1].animate.set_color(INK)]

        def done(k):
            it = items[k]
            tick = tx("✓", size=28, color=LIME).next_to(it, RIGHT, 0.2)
            return [it[0][0].animate.set_stroke(LIME, 3).set_fill(LIME, 0.15), it[0][1].animate.set_color(LIME),
                    it[1].animate.set_color(MUTED), FadeIn(tick, scale=1.4)], tick

        ticks = VGroup()
        with self.say("r1") as d:
            self.play(LaggedStart(*[FadeIn(i, shift=RIGHT * 0.2) for i in items], lag_ratio=0.15), run_time=1.6)
            sep = Line(UP * 2.6, DOWN * 1.9, stroke_color=FAINT, stroke_width=2).set_x(-2.1)
            self.play(Create(sep), run_time=0.5)

        # 1 ---------------------------------------------------------------
        with self.say("r2") as d:
            self.play(*activate(0), run_time=0.5)
            b1 = col(mtx(r"x,y,z\ge 1,\ \ x^2+4yz=p\ \Rightarrow\ x<\sqrt p,\ \ yz<\tfrac p4", size=36), 1.9, x=X0)
            self.play(Write(b1), run_time=1.3)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.45)
            k1 = col(mtx(r"p=4k+1\ \Rightarrow\ (1,\,1,\,k)\in S", size=40, color=LIME), 0.6, x=X0)
            ic = windmill_icon((1, 1, 6), size=1.9).move_to(RIGHT * 4.6 + DOWN * 0.6)
            self.play(Write(k1), FadeIn(ic, scale=0.8), run_time=1.2)
            an, tk = done(0)
            self.play(*an, run_time=0.5)
            ticks.add(tk)
        self.play(FadeOut(VGroup(b1, k1, ic)), run_time=0.4)

        # 2 ---------------------------------------------------------------
        with self.say("r3") as d:
            self.play(*activate(1), run_time=0.5)
            nl = NumberLine(x_range=[0, 10, 1], length=7.6, include_ticks=False, stroke_width=3, color=FAINT)
            nl.move_to(RIGHT * 2.3 + UP * 1.4)
            pa, pb = nl.n2p(3.2), nl.n2p(6.8)
            ra = Line(nl.n2p(0), pa, stroke_width=12, color=CORAL, stroke_opacity=0.75)
            rb = Line(pa, pb, stroke_width=12, color=VIOLET, stroke_opacity=0.75)
            rc = Line(pb, nl.n2p(10), stroke_width=12, color=SKY, stroke_opacity=0.75)
            la = mtx(r"x<y-z", size=28, color=CORAL).next_to(ra, UP, 0.2)
            lb = mtx(r"y-z<x<2y", size=28, color=VIOLET).next_to(rb, UP, 0.2)
            lc = mtx(r"x>2y", size=28, color=SKY).next_to(rc, UP, 0.2)
            xlab = mtx("x", size=34).next_to(nl, RIGHT, 0.2)
            self.play(Create(nl), FadeIn(xlab), run_time=0.6)
            self.play(Create(ra), FadeIn(la), run_time=0.5)
            self.play(Create(rb), FadeIn(lb), run_time=0.5)
            self.play(Create(rc), FadeIn(lc), run_time=0.5)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.45)
            ta = VGroup(Line(pa + UP * 0.3, pa + DOWN * 0.3, color=INK, stroke_width=4), mtx(r"y-z", size=28).next_to(pa, DOWN, 0.35))
            tb = VGroup(Line(pb + UP * 0.3, pb + DOWN * 0.3, color=INK, stroke_width=4), mtx(r"2y", size=28).next_to(pb, DOWN, 0.35))
            self.play(FadeIn(ta), FadeIn(tb), run_time=0.6)
            self.play(Flash(pa, color=GOLD, flash_radius=0.4), Flash(pb, color=GOLD, flash_radius=0.4), run_time=0.8)
        with self.say("r4") as d:
            e1 = col(mtx(r"x=y-z", r"\ \Rightarrow\ ", r"p=(y-z)^2+4yz=(y+z)^2", size=34), 0.05, x=X0)
            e2 = col(mtx(r"x=2y", r"\ \Rightarrow\ ", r"p=4y^2+4yz=4y(y+z)", size=34), -0.75, x=X0)
            self.play(Write(e1), run_time=1.3)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.3)
            self.play(Write(e2), run_time=1.3)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.55)
            c1 = VGroup(SurroundingRectangle(e1[2], color=CORAL, buff=0.08, corner_radius=0.08),
                        tx("✗", size=30, color=CORAL).next_to(e1, RIGHT, 0.2))
            c2 = VGroup(SurroundingRectangle(e2[2], color=CORAL, buff=0.08, corner_radius=0.08),
                        tx("✗", size=30, color=CORAL).next_to(e2, RIGHT, 0.2))
            self.play(Create(c1), Create(c2), run_time=0.7)
            why = col(tx(T("素数既不是完全平方数，也不是 4 的倍数", "a prime is neither a square nor a multiple of 4"),
                         size=26, color=CORAL), -1.55, x=X0)
            self.play(FadeIn(why), run_time=0.6)
            self.at(3, lead=0.2) if LANG == "en" else self.at_frac(0.82)
            use1 = chip(T("用到素数 · 第 1 次", "primality · use #1"), color=GOLD, size=26).next_to(items, DOWN, 0.5).align_to(items, LEFT)
            self.play(FadeIn(use1, shift=UP * 0.15), run_time=0.6)
            an, tk = done(1)
            self.play(*an, run_time=0.5)
            ticks.add(tk)
        self.play(FadeOut(VGroup(nl, xlab, ra, rb, rc, la, lb, lc, ta, tb, e1, e2, c1, c2, why)), run_time=0.5)

        # 3 ---------------------------------------------------------------
        with self.say("r5") as d:
            self.play(*activate(2), run_time=0.5)
            cb = col(mtx(r"\text{(b)}\quad (x,y,z)\mapsto(2y-x,\ y,\ x-y+z)", size=34, color=VIOLET), 2.0, x=X0)
            l1 = col(mtx(r"(2y-x)^2+4y(x-y+z)", size=38), 1.1, x=X0)
            l2 = col(mtx(r"=", r"4y^2", r"-4xy", r"+x^2", r"+4xy", r"-4y^2", r"+4yz", size=38), 0.25, x=X0)
            l3 = col(mtx(r"=x^2+4yz", size=44, color=LIME), -0.65, x=X0)
            self.play(FadeIn(cb), run_time=0.5)
            self.play(Write(l1), run_time=1.0)
            self.play(Write(l2), run_time=1.3)
            s1 = VGroup(Line(l2[1].get_corner(DL), l2[1].get_corner(UR), color=CORAL, stroke_width=3),
                        Line(l2[5].get_corner(DL), l2[5].get_corner(UR), color=CORAL, stroke_width=3))
            s2 = VGroup(Line(l2[2].get_corner(DL), l2[2].get_corner(UR), color=SKY, stroke_width=3),
                        Line(l2[4].get_corner(DL), l2[4].get_corner(UR), color=SKY, stroke_width=3))
            self.play(Create(s1), run_time=0.5)
            self.play(Create(s2), run_time=0.5)
            self.play(Write(l3), run_time=0.8)
            self.at(1, lead=0.1) if LANG == "en" else self.at_frac(0.6)
            pos = col(mtx(r"2y-x>0,\quad x-y+z>0\quad\checkmark", size=34, color=TEAL), -1.45, x=X0)
            self.play(FadeIn(pos), run_time=0.7)
            an, tk = done(2)
            self.play(*an, run_time=0.5)
            ticks.add(tk)
        self.play(FadeOut(VGroup(cb, l1, l2, l3, s1, s2, pos)), run_time=0.5)

        # 4 ---------------------------------------------------------------
        with self.say("r6") as d:
            self.play(*activate(3), run_time=0.5)
            boxes = VGroup()
            for name, colr in (("a", CORAL), ("b", VIOLET), ("c", SKY)):
                b = RoundedRectangle(corner_radius=0.2, width=1.6, height=1.1, stroke_color=colr, stroke_width=3,
                                     fill_color=colr, fill_opacity=0.12)
                boxes.add(VGroup(b, mtx(r"\text{(%s)}" % name, size=40, color=colr).move_to(b)))
            boxes.arrange(RIGHT, buff=1.3).move_to(RIGHT * 2.4 + UP * 0.6)
            self.play(LaggedStart(*[GrowFromCenter(b) for b in boxes], lag_ratio=0.2), run_time=0.9)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.25)
            ac = CurvedDoubleArrow(boxes[0].get_top() + UP * 0.1, boxes[2].get_top() + UP * 0.1, angle=-PI / 2.5,
                                   color=GOLD, stroke_width=4, tip_length=0.2)
            bl = self_loop(boxes[1].get_bottom(), VIOLET, radius=0.32, direction=DOWN)
            self.play(Create(ac), run_time=0.9)
            self.play(Create(bl), run_time=0.7)
            inv = mtx(r"\zeta(\zeta(s))=s", size=44, color=VIOLET).next_to(boxes, DOWN, 1.0)
            self.play(Write(inv), run_time=0.9)
            an, tk = done(3)
            self.play(*an, run_time=0.5)
            ticks.add(tk)
        self.play(FadeOut(VGroup(boxes, ac, bl, inv)), run_time=0.5)

        # 5 ---------------------------------------------------------------
        with self.say("r7") as d:
            self.play(*activate(4), run_time=0.5)
            f1 = col(mtx(r"\zeta(s)=s\ \Rightarrow\ \text{case (b)},\ \ x=y", size=38), 2.0, x=X0)
            f2 = col(mtx(r"p=x^2+4xz=x(x+4z)", size=42), 1.1, x=X0)
            self.play(Write(f1), run_time=1.1)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.2)
            self.play(Write(f2), run_time=1.0)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.42)
            f3 = col(mtx(r"p\ \text{prime}\ \Rightarrow\ x=1,\quad z=\tfrac{p-1}{4}", size=42, color=LIME), 0.15, x=X0)
            self.play(Write(f3), run_time=1.1)
            use2 = chip(T("用到素数 · 第 2 次", "primality · use #2"), color=GOLD, size=26).next_to(use1, DOWN, 0.2).align_to(use1, LEFT)
            self.play(FadeIn(use2, shift=UP * 0.15), run_time=0.5)
            self.at(3, lead=0.2) if LANG == "en" else self.at_frac(0.66)
            f4 = col(VGroup(mtx(r"z\in\mathbb{Z}\iff p\equiv 1\pmod 4", size=38, color=GOLD),
                            tx(T("（唯一用到“模 4 余 1”的地方）", "(the only use of “1 mod 4”)"), size=24, color=MUTED)
                            ).arrange(DOWN, buff=0.18, aligned_edge=LEFT), -1.0, x=X0)
            self.play(FadeIn(f4, shift=UP * 0.15), run_time=0.9)
            an, tk = done(4)
            self.play(*an, run_time=0.5)
            ticks.add(tk)
        # conclusion -------------------------------------------------------
        with self.say("r8") as d:
            self.play(FadeOut(VGroup(f1, f2, f3, f4)), run_time=0.5)
            chain = VGroup(
                mtx(r"\#\mathrm{Fix}(\zeta)=1", size=40, color=VIOLET),
                mtx(r"\Rightarrow", size=40),
                mtx(r"|S|\ \text{odd}", size=40),
                mtx(r"\Rightarrow", size=40),
                mtx(r"\#\mathrm{Fix}(\tau)\ \text{odd}\ \ge 1", size=40, color=SKY),
            ).arrange(RIGHT, buff=0.22)
            fin = mtx(r"\Rightarrow\ p=x^2+(2y)^2\qquad\blacksquare", size=48, color=LIME)
            blk = VGroup(chain, fin).arrange(DOWN, buff=0.5)
            blk.scale_to_fit_width(min(blk.width, 8.2)).move_to(RIGHT * 2.45 + UP * 0.5)
            self.play(LaggedStart(*[FadeIn(c, shift=RIGHT * 0.15) for c in chain], lag_ratio=0.25), run_time=2.0)
            self.at_frac(0.62)
            self.play(Write(fin), run_time=1.2)
            if LANG == "en":
                self.at(1, lead=0.05)
            self.play(Circumscribe(fin, color=LIME, time_width=0.6), run_time=1.0)
        # Zagier's sentence -------------------------------------------------
        with self.say("r9") as d:
            self.play(FadeOut(VGroup(items, ticks, sep, use1, use2, blk)), run_time=0.6)
            lines = VGroup(
                tx("The involution on the finite set", size=26, color=INK, font="Inter"),
                mtx(r"S=\{(x,y,z)\in\mathbb{N}^3:\ x^2+4yz=p\}", size=34),
                tx("defined by", size=26, color=INK, font="Inter"),
                zeta_cases_tex(32).set_color(VIOLET),
                tx("has exactly one fixed point, so |S| is odd and the involution", size=26, color=INK, font="Inter"),
                mtx(r"(x,y,z)\mapsto(x,z,y)", size=34, color=SKY),
                tx("also has a fixed point.   □", size=26, color=INK, font="Inter"),
            ).arrange(DOWN, buff=0.14)
            lines.scale_to_fit_height(min(lines.height, 4.6))
            paper = card(lines.width + 0.9, lines.height + 0.7, color=GOLD, fill="#18203C", opacity=1)
            grp = VGroup(paper, lines).move_to(UP * 0.55)
            lines.move_to(paper)
            cite = tx("— D. Zagier, Amer. Math. Monthly, 1990", size=22, color=MUTED, font="Inter").next_to(paper, DOWN, 0.15).align_to(paper, RIGHT)
            self.play(FadeIn(paper, scale=0.92), run_time=0.7)
            self.play(LaggedStart(*[FadeIn(l, shift=UP * 0.08) for l in lines], lag_ratio=0.18), FadeIn(cite), run_time=2.6)
            self.play(Circumscribe(paper, color=GOLD, time_width=0.4), run_time=1.6)
        self.clear_stage(0.7)


# ===================================================================== 08
class S08_Insight(NarratedScene):
    number = 8

    def construct(self):
        self.chapter_intro()
        titles = [T("计数代替构造", "count, don't construct"), T("目标 = 对称的不动点", "target = fixed points"),
                  T("让几何发现公式", "let geometry find it")]
        colors = [GOLD, SKY, VIOLET]
        cards = VGroup()
        for k in range(3):
            c = card(3.9, 3.1, color=colors[k])
            num = tx(f"0{k + 1}", size=30, color=colors[k], weight="BOLD", font="Inter").move_to(c.get_corner(UL) + RIGHT * 0.45 + DOWN * 0.38)
            ttl = fit(titles[k], size=27, max_w=3.5).move_to(c.get_bottom() + UP * 0.48)
            cards.add(VGroup(c, num, ttl))
        cards.arrange(RIGHT, buff=0.4).move_to(UP * 0.55)
        # icons
        pts = VGroup(*[Dot(radius=0.09, color=INK) for _ in range(5)]).arrange(RIGHT, buff=0.42)
        prs = VGroup(ArcBetweenPoints(pts[0].get_center(), pts[1].get_center(), angle=-PI / 1.5, color=GOLD, stroke_width=3),
                     ArcBetweenPoints(pts[2].get_center(), pts[3].get_center(), angle=-PI / 1.5, color=GOLD, stroke_width=3))
        lone = pts[4].copy().set_color(LIME).scale(1.4)
        ic1 = VGroup(pts, prs, lone).move_to(cards[0][0].get_center() + UP * 0.2)
        mirror = DashedLine(UP * 0.8, DOWN * 0.8, color=SKY, stroke_width=3)
        pa = Dot(LEFT * 0.7 + UP * 0.35, radius=0.09, color=INK)
        pb = Dot(RIGHT * 0.7 + UP * 0.35, radius=0.09, color=INK)
        pm = Dot(DOWN * 0.35, radius=0.12, color=LIME)
        ab = CurvedDoubleArrow(pa.get_center(), pb.get_center(), angle=-PI / 3, color=SKY, stroke_width=3, tip_length=0.14)
        ic2 = VGroup(mirror, pa, pb, pm, ab).move_to(cards[1][0].get_center() + UP * 0.2)
        wm = windmill_icon((3, 2, 4), size=1.5)
        ic3 = VGroup(wm, wm.cuts(color=GOLD, width=3)).move_to(cards[2][0].get_center() + UP * 0.2)
        alt = Windmill(1, 2, 5, unit=wm.unit, hand=-1, grid=False, outline=False).move_to(wm)
        alt_c = alt.cuts(color=VIOLET, width=3)
        icons = [ic1, ic2, ic3]

        with self.say("i1") as d:
            self.play(LaggedStart(*[FadeIn(VGroup(c, ic), shift=UP * 0.3) for c, ic in zip(cards, icons)], lag_ratio=0.3),
                      run_time=1.8)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.55)
            q = tx(T("“你是怎么想到的？”", "“How would anyone think of this?”"), size=34, color=INK, slant=ITALIC).move_to(DOWN * 1.75)
            self.play(Write(q), run_time=1.0)

        def focus(k):
            return [c.animate.set_opacity(1.0 if j == k else 0.35) for j, c in enumerate(cards)] + \
                   [ic.animate.set_opacity(1.0 if j == k else 0.35) for j, ic in enumerate(icons)]

        with self.say("i2") as d:
            self.play(FadeOut(q), *focus(0), run_time=0.7)
            self.play(Indicate(lone, color=LIME, scale_factor=1.6), run_time=0.8)
            self.at(2, lead=0.2) if LANG == "en" else self.at_frac(0.6)
            rel = VGroup(chip(T("握手引理", "handshake lemma"), color=GOLD, size=26),
                         chip(T("斯潘纳引理", "Sperner's lemma"), color=GOLD, size=26)).arrange(RIGHT, buff=0.4)
            rel.move_to(DOWN * 1.75)
            self.play(LaggedStart(*[FadeIn(r, shift=UP * 0.2) for r in rel], lag_ratio=0.3), run_time=0.9)
        with self.say("i3") as d:
            self.play(FadeOut(rel), *focus(1), run_time=0.7)
            rx = mtx(r"y\cdot y", r"\ \longrightarrow\ ", r"y\cdot z", r"\qquad \tau:\ y\leftrightarrow z", size=40).move_to(DOWN * 1.75)
            rx[3].set_color(SKY)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.3)
            self.play(Write(rx), run_time=1.3)
            self.play(Indicate(pm, color=LIME, scale_factor=1.8), run_time=0.8)
        with self.say("i4") as d:
            self.play(FadeOut(rx), *focus(2), run_time=0.7)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.45)
            self.play(FadeOut(ic3[1]), Create(alt_c), run_time=1.0)
            self.play(FadeOut(alt_c), FadeIn(ic3[1]), run_time=0.8)
            msg = tx(T("同一轮廓的另一种切法", "the other cut of the same outline"), size=30, color=VIOLET).move_to(DOWN * 1.75)
            self.play(FadeIn(msg, shift=UP * 0.15), run_time=0.6)
        self.play(FadeOut(VGroup(cards, ic1, ic2, ic3, msg)), run_time=0.6)

        # path for p = 41
        seq, moves = G.path_from_cross(41)
        pos = [np.array([-5.6 + 2.24 * k, 1.35, 0]) for k in range(6)] + \
              [np.array([5.6 - 2.24 * (k + 0.5), -1.05, 0]) for k in range(5)]
        nodes = VGroup()
        for t, pnt in zip(seq, pos):
            ic = windmill_icon(t, size=1.25).move_to(pnt)
            lb = triple_tex(t, size=24).next_to(ic, DOWN, 0.1)
            nodes.add(VGroup(ic, lb))
        edges = VGroup()
        for k, mv in enumerate(moves):
            a, b = nodes[k][0], nodes[k + 1][0]
            colr = SKY if mv == "tau" else VIOLET
            if k == 5:
                ln = CurvedArrow(a.get_right() + RIGHT * 0.05, b.get_right() + RIGHT * 0.05, angle=-PI / 1.6, color=colr, stroke_width=4, tip_length=0.16)
            else:
                ln = Arrow(a.get_center(), b.get_center(), buff=0.72, color=colr, stroke_width=4, max_tip_length_to_length_ratio=0.18)
            sym = mtx(r"\tau" if mv == "tau" else r"\zeta", size=28, color=colr).move_to(ln.point_from_proportion(0.5) + UP * 0.25)
            edges.add(VGroup(ln, sym))
        start_loop = self_loop(nodes[0][0].get_left(), VIOLET, direction=LEFT)
        end_loop = self_loop(nodes[-1][0].get_left(), SKY, direction=LEFT)
        with self.say("i5") as d:
            self.play(LaggedStart(*[FadeIn(n, scale=0.85) for n in nodes], lag_ratio=0.06), run_time=1.6)
            self.play(Create(start_loop), Flash(nodes[0][0], color=VIOLET), run_time=0.8)
            self.at(1, lead=0.2) if LANG == "en" else self.at_frac(0.45)
            self.play(LaggedStart(*[Create(e[0]) for e in edges], lag_ratio=0.12), FadeIn(VGroup(*[e[1] for e in edges])), run_time=2.0)
        with self.say("i6") as d:
            token = Dot(nodes[0][0].get_center(), radius=0.16, color=LIME).set_z_index(10)
            glow = Circle(radius=0.75, color=LIME, stroke_width=3).move_to(nodes[0][0])
            self.play(GrowFromCenter(token), Create(glow), run_time=0.6)
            per = max(0.45, min(1.0, (d * 0.62) / len(moves)))
            for k in range(len(moves)):
                self.play(token.animate.move_to(nodes[k + 1][0].get_center()), glow.animate.move_to(nodes[k + 1][0]),
                          Indicate(edges[k][1], scale_factor=1.4), nodes[k][0].animate.set_opacity(0.45),
                          run_time=per, rate_func=ease)
            self.play(Create(end_loop), Flash(nodes[-1][0], color=LIME, flash_radius=0.9), run_time=0.8)
            res = mtx(r"41=5^2+(2\cdot 2)^2=25+16", size=40, color=LIME)
            alg = chip(T("存在性证明 → 算法", "existence proof → algorithm"), color=GOLD, size=28)
            VGroup(res, alg).arrange(RIGHT, buff=0.6).move_to(UP * 2.75)
            self.play(Write(res), run_time=0.9)
            self.play(FadeIn(alg, shift=LEFT * 0.2), run_time=0.6)
        self.clear_stage(0.7)
