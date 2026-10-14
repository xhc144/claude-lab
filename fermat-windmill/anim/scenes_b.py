"""Chapters 6-9: windmills, Zagier's re-cutting, why the proof works, path-following."""
from common import *  # noqa: F401,F403


def atl(scene: FScene, zh_k: int, en_k: int, offset: float = 0.0):
    scene.at(zh_k if ZH else en_k, offset)


def fit_unit(t, box_w, box_h):
    pts = np.array(windmill_outline(*t))
    w = pts[:, 0].max() - pts[:, 0].min()
    h = pts[:, 1].max() - pts[:, 1].min()
    return min(box_w / w, box_h / h)


def squares_to_sum(scene, wm: Windmill, target_centre, run_time=1.6):
    """Slide the four square blades of a swap-fixed windmill into one big square."""
    x, y, z = wm.xyz
    u = wm.unit
    big = 2 * y * u
    tc = np.array(target_centre)
    offs = [UL, UR, DL, DR]
    anims = [wm.square.animate.move_to(tc + LEFT * (big / 2 + 0.35 + x * u / 2) + DOWN * (big - x * u) / 2 * 0)]
    sq_c = tc + RIGHT * (x * u / 2 + 0.35) * 0
    for k, b in enumerate(wm.blades):
        anims.append(b.animate.move_to(tc + RIGHT * 0.0 + offs[k] * (y * u / 2)))
    scene.play(*anims, run_time=run_time)


# ------------------------------------------------------------------ 06
class S06_Windmill(FScene):
    def construct(self):
        self.chapter_card(6, "风车", "Windmills")
        u = 0.47
        # ---- wm_1: draw x² + 4yz
        with self.seg("wm_1"):
            eq = M(r"x^2", r"+", r"4yz", r"=", r"p", font_size=56).to_edge(UP, buff=1.0)
            eq[0].set_color(SQ)
            eq[2].set_color(ARM)
            self.play(Write(eq), run_time=1.0)
            wm = Windmill(3, 4, 2, unit=u).move_to(LEFT * 1.6 + DOWN * 0.45)
            self.at(1)
            bx = Brace(wm.square, DOWN, buff=0.08, color=MUTED)
            bxl = M("x", 34, SQ).next_to(bx, DOWN, buff=0.08)
            self.play(DrawBorderThenFill(wm.square), run_time=0.9)
            self.play(GrowFromCenter(bx), FadeIn(bxl), run_time=0.6)
            self.at(2)
            # a loose blade on the right, with its dimensions
            stage = wm.blades[0].copy().move_to(RIGHT * 4.3 + UP * 0.6)
            by = Brace(stage, DOWN, buff=0.08, color=MUTED)
            byl = M("y", 34, ARM).next_to(by, DOWN, buff=0.06)
            bz = Brace(stage, RIGHT, buff=0.08, color=MUTED)
            bzl = M("z", 34, ARM).next_to(bz, RIGHT, buff=0.06)
            self.play(FadeOut(VGroup(bx, bxl)), FadeIn(stage, shift=LEFT * 0.3), run_time=0.7)
            self.play(GrowFromCenter(by), FadeIn(byl), GrowFromCenter(bz), FadeIn(bzl), run_time=0.7)
            x4 = M(r"\times 4", 44, ARM).next_to(stage, DOWN, buff=0.9)
            self.play(FadeIn(x4, scale=1.3), run_time=0.5)
            self.at(3)
            copies = VGroup(*[stage.copy() for _ in range(4)])
            self.add(copies)
            self.remove(stage)
            self.play(FadeOut(VGroup(by, byl, bz, bzl, x4)), run_time=0.4)
            self.play(LaggedStart(*[Transform(copies[k], wm.blades[k], path_arc=-k * PI / 2) for k in range(4)],
                                  lag_ratio=0.25), run_time=2.2)
            self.remove(copies, *copies)
            self.add(wm)
            area = M(r"3^2 + 4\cdot 4\cdot 2 = 9 + 32 = 41", 40).next_to(wm, RIGHT, buff=0.8).shift(UP * 0.3)
            pl = M(r"= p", 44, SQ).next_to(area, DOWN, buff=0.3).align_to(area, LEFT)
            self.play(Write(area), run_time=1.2)
            self.play(FadeIn(pl), Circumscribe(wm, color=SQ, buff=0.1), run_time=1.0)

        # ---- wm_2: all eleven windmills of area 41
        with self.seg("wm_2"):
            self.play(FadeOut(VGroup(area, pl)), wm.animate.set_opacity(1), run_time=0.5)
            rows = {1: [(1, 1, 10), (1, 2, 5), (1, 5, 2), (1, 10, 1)],
                    3: [(3, 1, 8), (3, 2, 4), (3, 4, 2), (3, 8, 1)],
                    5: [(5, 1, 4), (5, 2, 2), (5, 4, 1)]}
            grid = VGroup()
            labels = VGroup()
            row_y = {1: 1.75, 3: -0.05, 5: -1.85}
            for x, ts in rows.items():
                for j, t in enumerate(ts):
                    cx = -4.5 + j * 3.15 + (1.6 if x == 5 else 0)
                    un = min(0.24, fit_unit(t, 2.4, 1.45))
                    w = Windmill(*t, unit=un, cells=False, stroke_width=1.5).move_to([cx, row_y[x] + 0.1, 0])
                    w.shift(np.array([cx, row_y[x] + 0.1, 0]) - w.centre())
                    grid.add(w)
                    labels.add(M(f"({t[0]},{t[1]},{t[2]})", 24, MUTED).move_to([cx + 1.3, row_y[x] - 0.5, 0]))
            xlab = VGroup(*[M(f"x={x}", 28, SQ).move_to([-6.6, row_y[x] + 0.1, 0]) for x in rows])
            self.play(FadeOut(eq), wm.animate.scale(0.0001).move_to(grid[10].get_center()), run_time=0.7)
            self.remove(wm)
            self.at(1)
            self.play(LaggedStart(*[FadeIn(w, scale=0.6) for w in grid], lag_ratio=0.08),
                      LaggedStart(*[FadeIn(l) for l in labels], lag_ratio=0.08), FadeIn(xlab), run_time=2.4)
            cnt = TL("|S| = 11 个风车", "|S| = 11 windmills", 30, color=SQ).to_edge(UP, buff=0.95)
            self.play(FadeIn(cnt), run_time=0.5)

        # ---- wm_3: swapping y and z flips the blades
        with self.seg("wm_3"):
            self.play(FadeOut(VGroup(grid, labels, xlab, cnt)), run_time=0.6)
            w = Windmill(3, 4, 2, unit=u).move_to(LEFT * 2.3 + DOWN * 0.3)
            w.shift(LEFT * 2.3 + DOWN * 0.3 - w.centre())
            lab = M("(3,4,2)", 44).move_to(RIGHT * 3.4 + UP * 0.9)
            gm = M(r"g:\ (x,y,z)\mapsto(x,z,y)", 40, FLIP).move_to(RIGHT * 3.4 + DOWN * 0.4)
            self.play(FadeIn(w), FadeIn(lab), Write(gm), run_time=1.0)
            axes = VGroup(*[DashedLine(w.anchor_point(k) - w.flip_axis(k) * 0.3, w.anchor_point(k) + w.flip_axis(k) * 1.5,
                                       color=FLIP, stroke_width=2.5) for k in range(4)])
            self.play(Create(axes), run_time=0.7)
            w = do_flip(self, w, 1.6)
            lab2 = M("(3,2,4)", 44, FLIP).move_to(lab)
            self.play(Transform(lab, lab2), FadeOut(axes), run_time=0.6)
            self.hold(0.4)
            w = do_flip(self, w, 1.2)
            self.play(Transform(lab, M("(3,4,2)", 44).move_to(lab)), run_time=0.5)

        # ---- wm_4: square blades, and p as a sum of two squares
        with self.seg("wm_4"):
            self.play(FadeOut(VGroup(w, lab, gm)), run_time=0.5)
            w = Windmill(5, 2, 2, unit=u)
            w.shift(LEFT * 2.3 + DOWN * 0.3 - w.centre())
            lab = M("(5,2,2)", 44).move_to(RIGHT * 3.4 + UP * 0.9)
            self.play(FadeIn(w), FadeIn(lab), run_time=0.7)
            w = do_flip(self, w, 1.3)
            same = TL("翻转后不变", "unchanged by the flip", 30, color=FLIP).next_to(lab, DOWN, buff=0.35)
            self.play(FadeIn(same), Indicate(w.blades, color=FLIP, scale_factor=1.03), run_time=1.0)
            atl(self, 1, 2)
            # four 2x2 blades become one 4x4 square
            tgt = RIGHT * 0.9 + DOWN * 0.3
            yy = 2 * u
            self.play(FadeOut(same), FadeOut(lab), run_time=0.3)
            moves = [w.square.animate.move_to(LEFT * 2.6 + DOWN * 0.3)]
            for k, d in enumerate([DL, DR, UR, UL]):
                moves.append(w.blades[k].animate.move_to(tgt + d * yy / 2))
            self.play(*moves, run_time=1.8)
            bigsq = Square(4 * u, stroke_color=ARM, stroke_width=4).move_to(tgt)
            self.play(Create(bigsq), run_time=0.5)
            lab_a = M("5^2", 48, SQ).next_to(w.square, DOWN, buff=0.3)
            lab_b = M("(2y)^2 = 4^2", 48, ARM).next_to(bigsq, DOWN, buff=0.3)
            plus = M("+", 60, MUTED).move_to((w.square.get_right() + bigsq.get_left()) / 2)
            res = M(r"41 = 5^2 + 4^2", 60, GOOD).move_to(RIGHT * 4.6 + DOWN * 0.3)
            self.play(FadeIn(lab_a), FadeIn(lab_b), FadeIn(plus), run_time=0.7)
            atl(self, 2, 3)
            self.play(Write(res), run_time=1.0)
        self.play(FadeOut(VGroup(w, bigsq, lab_a, lab_b, plus, res)), run_time=0.7)


# ------------------------------------------------------------------ 07
class S07_Zagier(FScene):
    def construct(self):
        self.chapter_card(7, "扎吉尔的重新切割", "Zagier's re-cutting")
        u = 0.62
        C = LEFT * 2.6 + DOWN * 0.15
        # ---- zg_1
        with self.seg("zg_1"):
            w = Windmill(1, 3, 1, unit=u)
            w.shift(C - w.centre())
            lab = M("(1,3,1)", 44).move_to(RIGHT * 3.3 + UP * 1.2)
            p13 = M("p = 13", 36, MUTED).next_to(lab, DOWN, buff=0.3)
            self.play(FadeIn(w, scale=0.9), FadeIn(lab), FadeIn(p13), run_time=0.9)
            self.at(1)
            sil = w.silhouette()
            self.play(FadeIn(sil), FadeOut(w), run_time=1.2)
            self.at(2)
            q = T("?", 90, MUTED, weight=BOLD, font=LAT_FONT).next_to(sil, RIGHT, buff=0.6).shift(UP * 0.4)
            self.play(FadeIn(q, scale=0.6), Transform(lab, M("(?,?,?)", 44, MUTED).move_to(lab)), run_time=0.8)

        # ---- zg_2: another cut
        with self.seg("zg_2"):
            sq = Square(3 * u, stroke_color=RECUT, stroke_width=6).move_to(C)
            self.play(FadeOut(q), Create(sq), run_time=1.0)
            w2 = Windmill(3, 1, 1, unit=u)
            w2.shift(C - w2.centre())
            self.play(FadeIn(w2), FadeOut(sil), run_time=0.8)
            self.play(FadeOut(sq), Transform(lab, M("(3,1,1)", 44, RECUT).move_to(lab)), run_time=0.6)
            pair = M(r"(1,3,1)\ \longleftrightarrow\ (3,1,1)", 36, RECUT).next_to(p13, DOWN, buff=0.5)
            self.play(Write(pair), run_time=0.9)
        self.play(FadeOut(VGroup(w2, lab, p13, pair)), run_time=0.5)

        # ---- zg_3: the rule, on two examples
        uL, uR = 0.52, 0.46
        CL, CR = LEFT * 3.4 + DOWN * 0.35, RIGHT * 3.4 + DOWN * 0.35
        with self.seg("zg_3"):
            a = Windmill(3, 2, 1, unit=uL)
            a.shift(CL - a.centre())
            b = Windmill(1, 3, 1, unit=uR)
            b.shift(CR - b.centre())
            la = M("(3,2,1)", 34, MUTED).next_to(a, UP, buff=0.35)
            lb = M("(1,3,1)", 34, MUTED).next_to(b, UP, buff=0.35)
            self.play(FadeIn(a), FadeIn(b), FadeIn(la), FadeIn(lb), run_time=0.8)
            self.at(1)
            ea, eb = tip_edges(a), tip_edges(b)
            self.play(Create(ea), Create(eb), run_time=0.8)
            la_, lb_ = tip_lines(a), tip_lines(b)
            self.play(Create(la_), Create(lb_), run_time=1.0)
            tsa = Square(abs(2 * 2 - 3) * uL, stroke_color=RECUT, stroke_width=6).move_to(a.centre())
            tsb = Square(abs(2 * 3 - 1) * uR, stroke_color=RECUT, stroke_width=6).move_to(b.centre())
            self.play(Create(tsa), Create(tsb), run_time=0.8)
            self.at(2)
            ok = check_mark(GOOD, 0.45).next_to(la, RIGHT, buff=0.3)
            fits = TL("放得进", "fits", 28, color=GOOD).next_to(ok, RIGHT, buff=0.15)
            self.play(Create(ok), FadeIn(fits), tsa.animate.set_stroke(GOOD), run_time=0.6)
            sila = a.silhouette()
            self.play(FadeIn(sila), FadeOut(VGroup(a, ea, la_)), run_time=0.6)
            a2 = Windmill(1, 2, 2, unit=uL, chir=-1)
            a2.shift(CL - a2.centre())
            self.play(FadeIn(a2), FadeOut(sila), FadeOut(tsa), Transform(la, M("(1,2,2)", 34, RECUT).move_to(la)),
                      run_time=0.9)
            self.at(3)
            no = cross_mark(BAD, 0.2).next_to(lb, RIGHT, buff=0.3)
            nofit = TL("放不进", "doesn't fit", 28, color=BAD).next_to(no, RIGHT, buff=0.15)
            outside = Difference(Square(5 * uR).move_to(b.centre()), b.outline_mob(), fill_color=BAD,
                                 fill_opacity=0.35, stroke_width=0)
            self.play(Create(no), FadeIn(nofit), tsb.animate.set_stroke(BAD), FadeIn(outside), run_time=0.8)
            osq = Square(3 * uR, stroke_color=RECUT, stroke_width=6).move_to(b.centre())
            oe = TL("外侧边", "outer edges", 26, color=RECUT).next_to(b, DOWN, buff=0.2)
            self.play(FadeOut(VGroup(outside, tsb, lb_)), Create(osq), FadeIn(oe), run_time=0.9)
            silb = b.silhouette()
            self.play(FadeIn(silb), FadeOut(VGroup(b, eb)), run_time=0.5)
            b2 = Windmill(3, 1, 1, unit=uR)
            b2.shift(CR - b2.centre())
            self.play(FadeIn(b2), FadeOut(silb), FadeOut(osq), Transform(lb, M("(3,1,1)", 34, RECUT).move_to(lb)),
                      run_time=0.9)
        self.play(FadeOut(VGroup(a2, b2, la, lb, ok, fits, no, nofit, oe)), run_time=0.6)

        # ---- zg_4: three cases -> formula
        with self.seg("zg_4"):
            panels = VGroup()
            specs = [((1, 3, 1), L("变大", "larger"), 0.3), ((3, 2, 1), L("镜像", "mirrored"), 0.34),
                     ((3, 1, 1), L("变小", "smaller"), 0.3)]
            for t, name, un in specs:
                w1 = Windmill(*t, unit=un, cells=False, stroke_width=1.5)
                t2, case = zagier(t)
                w2 = Windmill(*t2, unit=un, chir=-1 if case == "B" else 1, cells=False, stroke_width=1.5)
                arr = M(r"\to", 40, RECUT)
                row = VGroup(w1, arr, w2).arrange(RIGHT, buff=0.3)
                nm = T(name, 28, RECUT).next_to(row, UP, buff=0.2)
                panels.add(VGroup(nm, row))
            panels.arrange(RIGHT, buff=0.7)
            if panels.width > 13.0:
                panels.scale_to_fit_width(13.0)
            panels.move_to(UP * 1.3)
            for k, pnl in enumerate(panels):
                self.play(FadeIn(pnl, shift=UP * 0.2), run_time=0.7)
            atl(self, 1, 1)
            f = M(r"f(x,y,z)=\begin{cases}(x+2z,\ z,\ y-x-z) & x<y-z\\"
                  r"(2y-x,\ y,\ x-y+z) & y-z<x<2y\\(x-2y,\ x-y+z,\ y) & x>2y\end{cases}", 42)
            f.move_to(DOWN * 1.35)
            self.play(Write(f), run_time=2.4)
            tags = VGroup(*[T(n, 24, RECUT) for n in [L("变大", "larger"), L("镜像", "mirror"), L("变小", "smaller")]])
            for k, tg in enumerate(tags):
                tg.next_to(f, RIGHT, buff=0.35).set_y(f.get_top()[1] - 0.42 - k * 0.6)
            self.play(LaggedStart(*[FadeIn(tg, shift=LEFT * 0.2) for tg in tags], lag_ratio=0.3), run_time=1.0)

        # ---- zg_5: involution
        with self.seg("zg_5"):
            self.play(FadeOut(panels), VGroup(f, tags).animate.scale(0.72).to_edge(UP, buff=0.95), run_time=0.8)
            w = Windmill(1, 3, 1, unit=0.46)
            w.shift(LEFT * 2.8 + DOWN * 0.6 - w.centre())
            lab = M("(1,3,1)", 40).move_to(RIGHT * 3.2 + DOWN * 0.1)
            self.play(FadeIn(w), FadeIn(lab), run_time=0.6)
            for k in range(4):
                w = do_recut(self, w, 1.2)
                self.play(Transform(lab, M("({},{},{})".format(*w.xyz), 40, RECUT if k % 2 == 0 else TEXT).move_to(lab)),
                          run_time=0.3)
                if k == 1:
                    inv = M(r"f(f(w)) = w", 44, RECUT).next_to(lab, DOWN, buff=0.45)
                    self.play(Write(inv), run_time=0.7)
                    atl(self, 1, 1)
        self.play(FadeOut(VGroup(w, lab, inv)), run_time=0.5)

        # ---- zg_6: fixed windmills: x = y
        with self.seg("zg_6"):
            c = Windmill(1, 1, 3, unit=0.5)
            c.shift(LEFT * 2.6 + DOWN * 0.6 - c.centre())
            lab = M("(1,1,3)", 40).move_to(RIGHT * 3.2 + DOWN * 0.1)
            self.play(FadeIn(c), FadeIn(lab), run_time=0.7)
            self.at(1)
            tl = tip_lines(c, length=2.2)
            te = tip_edges(c)
            self.play(Create(te), run_time=0.6)
            self.play(Create(tl), run_time=0.9)
            same = Square(1 * 0.5, stroke_color=RECUT, stroke_width=6).move_to(c.centre())
            self.play(Create(same), Flash(c.centre(), color=RECUT, flash_radius=0.5), run_time=0.8)
            xy = M("x = y", 54, RECUT).next_to(lab, DOWN, buff=0.45)
            self.play(Write(xy), run_time=0.7)
        self.play(FadeOut(VGroup(tl, te, same, lab)), xy.animate.move_to(RIGHT * 3.4 + UP * 0.95), run_time=0.6)

        # ---- zg_7: primality -> the cross
        with self.seg("zg_7"):
            self.at(1)
            e1 = M(r"p = x^2 + 4xz = x\,(x + 4z)", 46).next_to(xy, DOWN, buff=0.5).align_to(xy, RIGHT)
            self.play(Write(e1), run_time=1.3)
            atl(self, 2, 2)
            e2 = VGroup(TL("p 是素数", "p prime", 34, color=SQ), M(r"\Rightarrow\ x = 1", 46, SQ)).arrange(RIGHT, buff=0.25)
            e2.next_to(e1, DOWN, buff=0.45).align_to(e1, RIGHT)
            self.play(FadeIn(e2, shift=UP * 0.2), run_time=0.9)
            atl(self, 3, 3)
            e3 = M(r"(1,\,1,\,\tfrac{p-1}{4})", 46, RECUT).next_to(e2, DOWN, buff=0.45).align_to(e1, RIGHT)
            self.play(Write(e3), run_time=0.8)
            c.add_updater(lambda m, dt: m.rotate(-0.6 * dt, about_point=m.centre()))
            cl = TL("唯一的不动点：十字", "the unique fixed point: a cross", 30, color=RECUT)
            cl.next_to(c, DOWN, buff=0.35)
            self.play(FadeIn(cl), run_time=0.6)
        self.hold(0.4)
        c.clear_updaters()
        self.play(FadeOut(VGroup(c, cl, xy, e1, e2, e3)), run_time=0.6)

        # ---- zg_8: boundary cases
        with self.seg("zg_8"):
            b1 = VGroup(M(r"x = y - z", 40, MUTED), M(r"\Rightarrow\ p = (y+z)^2", 40),
                        TL("不是平方数", "not a square", 28, color=BAD)).arrange(RIGHT, buff=0.35)
            b2 = VGroup(M(r"x = 2y", 40, MUTED), M(r"\Rightarrow\ p = 4y(y+z)", 40),
                        TL("不是偶数", "not even", 28, color=BAD)).arrange(RIGHT, buff=0.35)
            bb = VGroup(b1, b2).arrange(DOWN, buff=0.6, aligned_edge=LEFT).move_to(DOWN * 0.1)
            hd = TL("边界情形", "boundary cases", 34, color=MUTED, weight=BOLD).next_to(bb, UP, buff=0.6)
            self.play(FadeIn(hd), run_time=0.5)
            atl(self, 1, 2)
            self.play(Write(b1[:2]), run_time=1.0)
            self.play(FadeIn(b1[2]), run_time=0.4)
            self.play(Write(b2[:2]), run_time=1.0)
            self.play(FadeIn(b2[2]), run_time=0.4)
        self.play(FadeOut(VGroup(bb, hd, f, tags)), run_time=0.5)

        # ---- zg_9: put together, p = 17
        with self.seg("zg_9"):
            order = [(1, 1, 4), (1, 4, 1), (3, 1, 2), (3, 2, 1), (1, 2, 2)]
            ws = VGroup()
            xs = [-5.2, -2.6, 0.0, 2.6, 5.2]
            for t, x in zip(order, xs):
                un = min(0.3, fit_unit(t, 2.35, 2.35))
                w = Windmill(*t, unit=un, cells=True, stroke_width=1.5)
                w.shift(np.array([x, 0.2, 0]) - w.centre())
                ws.add(w)
            labs = VGroup(*[M("({},{},{})".format(*t), 26, MUTED).move_to([x, -1.55, 0]) for t, x in zip(order, xs)])
            p17 = M("p = 17", 36, SQ).move_to(LEFT * 4.6 + UP * 2.85)
            self.play(FadeIn(p17), LaggedStart(*[FadeIn(w, scale=0.7) for w in ws], lag_ratio=0.12),
                      LaggedStart(*[FadeIn(l) for l in labs], lag_ratio=0.12), run_time=1.6)
            self.at(1)
            fy = -1.85
            f_arcs = VGroup(ArcBetweenPoints(np.array([xs[1], fy, 0]), np.array([xs[2], fy, 0]), angle=PI / 1.7,
                                             stroke_color=RECUT, stroke_width=5),
                            ArcBetweenPoints(np.array([xs[3], fy, 0]), np.array([xs[4], fy, 0]), angle=PI / 1.7,
                                             stroke_color=RECUT, stroke_width=5))
            f_loop = Circle(radius=0.22, stroke_color=RECUT, stroke_width=5).move_to([xs[0], fy - 0.25, 0])
            self.play(LaggedStart(Create(f_loop), *[Create(a) for a in f_arcs], lag_ratio=0.3), run_time=1.3)
            odd = M(r"|S| = 5", 44, SQ).next_to(p17, RIGHT, buff=0.7)
            self.play(FadeIn(odd), run_time=0.5)
            atl(self, 2, 2)
            gy = 1.55
            g_arcs = VGroup(ArcBetweenPoints(np.array([xs[0], gy, 0]), np.array([xs[1], gy, 0]), angle=-PI / 1.7,
                                             stroke_color=FLIP, stroke_width=5),
                            ArcBetweenPoints(np.array([xs[2], gy, 0]), np.array([xs[3], gy, 0]), angle=-PI / 1.7,
                                             stroke_color=FLIP, stroke_width=5))
            g_loop = Circle(radius=0.22, stroke_color=FLIP, stroke_width=5).move_to([xs[4], gy + 0.25, 0])
            self.play(LaggedStart(*[Create(a) for a in g_arcs], lag_ratio=0.3), run_time=1.0)
            self.play(Create(g_loop), Flash(ws[4].centre(), color=FLIP, flash_radius=0.9), run_time=0.9)
            atl(self, 3, 3)
            res = M(r"17 = 1^2 + 4^2", 54, GOOD).move_to(RIGHT * 3.2 + UP * 2.85)
            self.play(Write(res), Indicate(ws[4], color=GOOD, scale_factor=1.06), run_time=1.2)
            qed = M(r"\blacksquare", 44, GOOD).next_to(res, RIGHT, buff=0.3)
            atl(self, 4, 3, 1.4)
            self.play(FadeIn(qed, scale=0.5), run_time=0.5)
        self.play(FadeOut(VGroup(ws, labs, f_arcs, f_loop, g_arcs, g_loop, p17, odd, res, qed)), run_time=0.7)

        # ---- zg_10: the sentence
        with self.seg("zg_10"):
            l1 = Tex(r"The involution on the finite set $S=\{(x,y,z)\in\mathbb{N}^3:\ x^2+4yz=p\}$ defined by",
                     font_size=34, color=TEXT)
            l2 = M(r"(x,y,z)\mapsto\begin{cases}(x+2z,\ z,\ y-x-z) & \text{if } x<y-z\\"
                   r"(2y-x,\ y,\ x-y+z) & \text{if } y-z<x<2y\\(x-2y,\ x-y+z,\ y) & \text{if } x>2y\end{cases}",
                   34, RECUT)
            l3 = Tex(r"has exactly one fixed point, so $|S|$ is odd and the involution defined by",
                     font_size=34, color=TEXT)
            l4 = Tex(r"$(x,y,z)\mapsto(x,z,y)$ also has a fixed point. \quad --- D.~Zagier, 1990",
                     font_size=34, color=TEXT)
            l4[0].set_color(TEXT)
            body = VGroup(l1, l2, l3, l4).arrange(DOWN, buff=0.22)
            if ZH:
                zh = T("（上述集合上的这个对合恰有一个不动点，所以 |S| 是奇数，于是交换 y、z 的对合也有不动点。）",
                       22, MUTED)
                body.add(zh)
                body.arrange(DOWN, buff=0.22)
            box = card(body, pad=0.35, color=PANEL, stroke=GRID).move_to(DOWN * 0.05)
            if box.width > 13.4:
                box.scale_to_fit_width(13.4)
            self.play(FadeIn(box[0]), run_time=0.4)
            self.play(Write(body, run_time=3.2))
            one = TL("一句话", "one sentence", 30, color=SQ, weight=BOLD).next_to(box, UP, buff=0.18)
            self.play(FadeIn(one, shift=DOWN * 0.15), run_time=0.5)
        self.hold(0.6)
        self.play(FadeOut(VGroup(box, one)), run_time=0.7)


# ------------------------------------------------------------------ 08
class S08_Why(FScene):
    def construct(self):
        self.chapter_card(8, "为什么会想到它", "Why this proof")
        with self.seg("why_1"):
            f = M(r"f(x,y,z)=\begin{cases}(x+2z,\ z,\ y-x-z)\\(2y-x,\ y,\ x-y+z)\\(x-2y,\ x-y+z,\ y)\end{cases}",
                  42, MUTED).move_to(UP * 0.4)
            self.play(FadeIn(f), run_time=0.8)
            magic = TL("魔术？", "magic?", 44, color=VIOLET, weight=BOLD, slant=ITALIC).next_to(f, RIGHT, buff=0.6)
            self.play(FadeIn(magic, scale=1.4), run_time=0.6)
            self.at(1)
            why = TL("每一步都有理由", "every step has a reason", 40, color=SQ, weight=BOLD).next_to(f, DOWN, buff=0.6)
            self.play(FadeOut(magic), FadeIn(why, shift=UP * 0.2), run_time=0.8)
        self.play(FadeOut(VGroup(f, why)), run_time=0.5)

        steps = [
            ("why_2", "①", L("存在 ⇐ 个数为奇数 ⇐ 配对", "existence ⇐ odd count ⇐ pairing"), FLIP),
            ("why_3", "②", L("解 = 不动点 ⇐ 把 y·y 拆成 y·z", "solutions = fixed points ⇐ split y·y into y·z"), VIOLET),
            ("why_4", "③", L("第二个对合 ⇐ 风车：一块面积，两种切法", "a 2nd involution ⇐ one shape, two cuts"), RECUT),
            ("why_5", "④", L("素数 ⇒ 不动点唯一", "prime ⇒ a unique fixed point"), SQ),
        ]
        rows = VGroup()
        for _, n, s_, col in steps:
            r = VGroup(T(n, 40, col, weight=BOLD), T(s_, 32, TEXT)).arrange(RIGHT, buff=0.35)
            rows.add(r)
        rows.arrange(DOWN, buff=0.55, aligned_edge=LEFT)
        if rows.width > 10.2:
            rows.scale_to_fit_width(10.2)
        rows.move_to(LEFT * 0.9 + DOWN * 0.1)
        icons = self.icons()
        for ic, r in zip(icons, rows):
            ic.move_to([5.6, r.get_y(), 0])
        for (sid, _, _, col), r, ic in zip(steps[:3], rows[:3], icons):
            with self.seg(sid):
                self.play(FadeIn(r, shift=RIGHT * 0.25), FadeIn(ic, scale=0.8), run_time=0.9)
                self.play(Indicate(r[0], color=col), run_time=0.8)

        # ---- why_5: primality, tested on 21
        with self.seg("why_5"):
            ic = icons[3]
            self.play(FadeIn(rows[3], shift=RIGHT * 0.25), FadeIn(ic, scale=0.8), run_time=0.9)
            self.at(1)
            keep = VGroup(rows, *icons)
            self.play(FadeOut(keep, shift=UP * 0.3), run_time=0.6)
            order = [(1, 1, 5), (1, 5, 1), (3, 1, 3), (3, 3, 1)]
            xs = [-4.6, -1.55, 1.55, 4.6]
            ws = VGroup()
            for t, x in zip(order, xs):
                un = min(0.3, fit_unit(t, 2.5, 2.3))
                w = Windmill(*t, unit=un, stroke_width=1.5)
                w.shift(np.array([x, 0.05, 0]) - w.centre())
                ws.add(w)
            labs = VGroup(*[M("({},{},{})".format(*t), 26, MUTED).move_to([x, -1.45, 0]) for t, x in zip(order, xs)])
            n21 = VGroup(M("p = 21", 44, BAD), M(r"= 3\times 7", 40, MUTED)).arrange(RIGHT, buff=0.25)
            n21.to_edge(UP, buff=0.95)
            self.play(FadeIn(n21), LaggedStart(*[FadeIn(w, scale=0.7) for w in ws], lag_ratio=0.15),
                      FadeIn(labs), run_time=1.3)
            self.at(2)
            loops = VGroup(*[Circle(radius=0.22, stroke_color=RECUT, stroke_width=5).move_to([xs[i], 1.6, 0])
                             for i in (0, 3)])
            farc = ArcBetweenPoints(np.array([xs[1], 1.45, 0]), np.array([xs[2], 1.45, 0]), angle=-PI / 2.2,
                                    stroke_color=RECUT, stroke_width=5)
            self.play(Create(farc), run_time=0.6)
            self.play(LaggedStart(*[Create(l) for l in loops], lag_ratio=0.4),
                      Indicate(ws[0], color=RECUT), Indicate(ws[3], color=RECUT), run_time=1.4)
            self.at(3)
            two = TL("2 个不动点 ⇒ |S| = 4 是偶数 ⇒ 推不出结论", "2 fixed points ⇒ |S| = 4 is even ⇒ no conclusion",
                     30, color=RECUT).move_to(DOWN * 2.05)
            self.play(FadeIn(two, shift=UP * 0.15), run_time=0.8)
            self.at(4)
            no = M(r"21 \ne a^2 + b^2", 48, BAD).next_to(n21, RIGHT, buff=0.8)
            self.play(FadeIn(no, scale=1.2), run_time=0.6)
        self.play(FadeOut(VGroup(ws, labs, n21, loops, farc, two, no)), run_time=0.6)

        # ---- why_6: where is each hypothesis used?
        with self.seg("why_6"):
            self.play(FadeIn(keep, shift=DOWN * 0.3), run_time=0.8)
            atl(self, 1, 1)
            hl = SurroundingRectangle(rows[3], color=SQ, buff=0.15, corner_radius=0.1)
            ask = TL("这个条件用在哪里？去掉它，哪里会断？", "where is it used? what breaks without it?", 32,
                     color=SQ).next_to(rows, DOWN, buff=0.5)
            self.play(Create(hl), FadeIn(ask, shift=UP * 0.2), run_time=0.9)
        self.play(FadeOut(VGroup(keep, hl, ask)), run_time=0.6)

    def icons(self):
        a = VGroup(*[Dot(np.array([i * 0.45, 0, 0]), radius=0.09, color=FLIP) for i in range(5)])
        a.add(ArcBetweenPoints(a[0].get_center(), a[1].get_center(), angle=-PI / 1.5, stroke_color=FLIP),
              ArcBetweenPoints(a[2].get_center(), a[3].get_center(), angle=-PI / 1.5, stroke_color=FLIP))
        a[4].set_color(SQ)
        b = VGroup(Line(DL * 0.5, UR * 0.5, color=VIOLET, stroke_width=3), Dot(np.array([0.3, -0.25, 0]), 0.08, color=TEXT),
                   Dot(np.array([-0.25, 0.3, 0]), 0.08, color=TEXT), Dot(ORIGIN, 0.1, color=SQ))
        c = Windmill(1, 3, 1, unit=0.17, cells=False, stroke_width=1)
        d = Windmill(1, 1, 3, unit=0.14, cells=False, stroke_width=1, arm_color=RECUT)
        return [a, b, c, d]


# ------------------------------------------------------------------ 09
class S09_Path(FScene):
    def construct(self):
        self.chapter_card(9, "从存在到算法", "From existence to an algorithm")
        with self.seg("path_1"):
            a = TL("存在", "existence", 52, weight=BOLD)
            arr = M(r"\longrightarrow", 64, MUTED)
            b = TL("算法", "an algorithm", 52, color=SQ, weight=BOLD)
            g = VGroup(a, arr, b).arrange(RIGHT, buff=0.5).move_to(UP * 0.3)
            self.play(FadeIn(a), run_time=0.6)
            self.at(1)
            self.play(GrowArrow(arr) if False else FadeIn(arr, shift=RIGHT * 0.3), FadeIn(b, shift=LEFT * 0.3),
                      run_time=1.0)
        self.play(FadeOut(g), run_time=0.5)

        path = [(1, 1, 10), (1, 10, 1), (3, 1, 8), (3, 8, 1), (5, 1, 4), (5, 4, 1), (3, 4, 2), (3, 2, 4),
                (1, 2, 5), (1, 5, 2), (5, 2, 2)]
        un = 0.225
        C = DOWN * 0.3
        trail = VGroup()
        tx = np.linspace(-6.25, 6.25, len(path))

        def trail_item(i, t, col):
            m = M("({},{},{})".format(*t), 23, col).move_to([tx[i], 2.62 if i % 2 == 0 else 2.28, 0])
            return m

        step_lab = VGroup()
        with self.seg("path_2"):
            w = Windmill(*path[0], unit=un)
            w.shift(C - w.centre())
            t0 = trail_item(0, path[0], RECUT)
            cross_l = TL("十字：重切的不动点", "the cross: fixed by re-cutting", 28, color=RECUT).move_to(RIGHT * 4.3 + DOWN * 0.4)
            self.play(FadeIn(w, scale=0.8), FadeIn(t0), FadeIn(cross_l), run_time=1.0)
            trail.add(t0)
            n_first = 4
            for i in range(1, n_first + 1):
                flip = i % 2 == 1
                self.at({1: 1, 2: 2, 3: 3, 4: 3}[i] if ZH else {1: 1, 2: 2, 3: 3, 4: 4}[i])
                nm = TL("翻转" if flip else "重切", "flip" if flip else "re-cut", 34,
                        color=FLIP if flip else RECUT, weight=BOLD).move_to(RIGHT * 4.3 + DOWN * 0.4)
                self.play(FadeOut(cross_l) if i == 1 else FadeOut(step_lab), FadeIn(nm), run_time=0.3)
                step_lab = nm
                w = do_flip(self, w, 0.9) if flip else do_recut(self, w, 1.0)
                ti = trail_item(i, path[i], FLIP if flip else RECUT)
                self.play(FadeIn(ti, shift=DOWN * 0.1), run_time=0.25)
                trail.add(ti)
            atl(self, 4, 5)
            nr = TL("不会走回头路", "no going back", 30, color=MUTED).move_to(RIGHT * 4.3 + DOWN * 1.2)
            self.play(FadeIn(nr), run_time=0.5)
        with self.seg("path_3"):
            self.play(FadeOut(nr), run_time=0.3)
            for i in range(n_first + 1, len(path)):
                flip = i % 2 == 1
                nm = TL("翻转" if flip else "重切", "flip" if flip else "re-cut", 34,
                        color=FLIP if flip else RECUT, weight=BOLD).move_to(RIGHT * 4.3 + DOWN * 0.4)
                self.play(FadeOut(step_lab), FadeIn(nm), run_time=0.2)
                step_lab = nm
                w = do_flip(self, w, 0.7) if flip else do_recut(self, w, 0.8)
                ti = trail_item(i, path[i], FLIP if flip else RECUT)
                self.play(FadeIn(ti, shift=DOWN * 0.1), run_time=0.2)
                trail.add(ti)
            stop = TL("翻转后不变：停！", "unchanged by flipping: stop", 30, color=GOOD).move_to(RIGHT * 4.3 + DOWN * 0.4)
            self.play(FadeOut(step_lab), FadeIn(stop), trail[-1].animate.set_color(GOOD), run_time=0.5)
            w = do_flip(self, w, 0.8)
            self.at(1)
            self.play(FadeOut(stop), run_time=0.3)
            u = w.unit
            tgt = RIGHT * 1.4 + C
            moves = [w.square.animate.move_to(LEFT * 1.4 + C)]
            for k, d in enumerate([DL, DR, UR, UL]):
                moves.append(w.blades[k].animate.move_to(tgt + d * 2 * u / 2))
            self.play(*moves, run_time=1.4)
            res = M(r"41 = 5^2 + 4^2", 56, GOOD).move_to(RIGHT * 4.6 + C)
            steps = TL("10 步", "10 steps", 30, color=MUTED).next_to(res, DOWN, buff=0.3)
            self.play(Write(res), FadeIn(steps), run_time=1.0)
        self.play(FadeOut(VGroup(w, res, steps)), run_time=0.5)

        # ---- path_4: the graph is a path
        with self.seg("path_4"):
            self.play(trail.animate.set_opacity(0.4), run_time=0.4)
            self.at(1)
            P = [np.array([-5.6 + 1.12 * i, 0.55 if i % 2 == 0 else -0.55, 0]) + DOWN * 0.1 for i in range(len(path))]
            dots = VGroup(*[Dot(p, radius=0.14, color=TEXT) for p in P])
            self.play(LaggedStart(*[GrowFromCenter(d) for d in dots], lag_ratio=0.05), run_time=0.9)
            edges = VGroup(*[Line(P[i], P[i + 1], color=FLIP if i % 2 == 0 else RECUT, stroke_width=5)
                             for i in range(len(path) - 1)])
            self.play(LaggedStart(*[Create(e) for e in edges], lag_ratio=0.1), run_time=1.4)
            self.at(2)
            deg = TL("每个点至多两条边：蓝一条、橙一条", "at most two lines per dot: one blue, one orange", 28,
                     color=MUTED).move_to(DOWN * 1.75)
            self.play(FadeIn(deg), run_time=0.6)
            # small abstract loop component on the right
            loopc = VGroup()
            R0 = RIGHT * 0.0
            self.at(3)
            l0 = self_loop(P[0], RECUT, up=True, r=0.2)
            l1 = self_loop(P[-1], FLIP, up=True, r=0.2)
            self.play(Create(l0), dots[0].animate.set_color(RECUT).scale(1.3), run_time=0.6)
            self.play(Create(l1), dots[-1].animate.set_color(GOOD).scale(1.3), Flash(dots[-1], color=GOOD), run_time=0.8)
            ends = VGroup(TL("十字", "cross", 26, color=RECUT).next_to(dots[0], DOWN, buff=0.25),
                          TL("解", "solution", 26, color=GOOD).next_to(dots[-1], DOWN, buff=0.25))
            self.play(FadeIn(ends), run_time=0.5)
        self.play(FadeOut(VGroup(dots, edges, deg, l0, l1, ends, trail)), run_time=0.6)

        # ---- path_5: Sperner and Euclid
        with self.seg("path_5"):
            from scenes_a import S04_Parity
            tri = S04_Parity.sperner_icon(self).scale(0.8).move_to(LEFT * 3.6 + DOWN * 0.1)
            sl = TL("斯潘纳：穿过房间和门", "Sperner: rooms and doors", 28, color=MUTED).next_to(tri, DOWN, buff=0.3)
            self.play(FadeIn(tri), FadeIn(sl), run_time=1.0)
            self.at(1)
            slow = TL("对大素数很慢", "slow for large primes", 28, color=BAD).move_to(RIGHT * 3.3 + UP * 1.6)
            self.play(FadeIn(slow), run_time=0.6)
            self.at(2)
            eu = VGroup(M(r"9^2 = 81 \equiv -1 \pmod{41}", 36),
                        M(r"41 = 4\cdot 9 + \mathbf{5}", 36),
                        M(r"9 = 1\cdot 5 + \mathbf{4}", 36),
                        M(r"41 = 5^2 + 4^2", 42, GOOD)).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            eu.next_to(slow, DOWN, buff=0.45)
            hd = TL("欧几里得算法", "Euclidean algorithm", 28, color=SQ).next_to(eu, UP, buff=0.2).align_to(eu, LEFT)
            self.play(FadeOut(slow), FadeIn(hd), run_time=0.4)
            for e in eu:
                self.play(FadeIn(e, shift=RIGHT * 0.2), run_time=0.55)
        self.hold(0.4)
        self.play(FadeOut(VGroup(tri, sl, hd, eu)), run_time=0.6)
