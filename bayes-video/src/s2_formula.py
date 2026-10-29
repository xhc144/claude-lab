from common import *
from data import AGAIN_FP, AGAIN_TP, FALSE_POS, POST1, POST2, POST3, PREV, TRUE_POS


def node(label, color, size=30):
    t = zh(label, size, color)
    return on_panel(t, pad=0.18, color=color, r=0.14)


def edge(a, b, label, color=SOFT):
    ln = Line(a.get_right(), b.get_left(), color=DIM, stroke_width=2.5, buff=0.08)
    lab = tex(label, size=28, color=color).move_to(ln.get_center() + ln.copy().rotate(PI / 2).get_unit_vector() * 0.28)
    return VGroup(ln, lab)


class Formula(VScene):
    header = "02 · 公式从哪里来"

    def construct(self):
        # 记号
        hdef = VGroup(tex("H", size=44, color=RED), zh("：有病（假设）", 28)).arrange(RIGHT, buff=0.1)
        edef = VGroup(tex("E", size=44, color=MAGENTA), zh("：阳性（证据）", 28)).arrange(RIGHT, buff=0.1)
        defs = VGroup(hdef, edef).arrange(RIGHT, buff=0.8).to_edge(UP, buff=1.05).shift(RIGHT * 2.6)

        # 概率树
        root = node("一个人", SOFT)
        sick = node("有病", RED)
        well = node("健康", GREEN)
        sp, sn = node("阳性", MAGENTA, 26), node("阴性", SOFT, 26)
        wp, wn = node("阳性", MAGENTA, 26), node("阴性", SOFT, 26)
        root.move_to(LEFT * 5.7 + DOWN * 0.3)
        sick.move_to(LEFT * 3.6 + UP * 1.25)
        well.move_to(LEFT * 3.6 + DOWN * 1.85)
        sp.move_to(LEFT * 1.4 + UP * 2.0)
        sn.move_to(LEFT * 1.4 + UP * 0.6)
        wp.move_to(LEFT * 1.4 + DOWN * 1.1)
        wn.move_to(LEFT * 1.4 + DOWN * 2.5)
        e1, e2 = edge(root, sick, "0.01", RED), edge(root, well, "0.99", GREEN)
        e3, e4 = edge(sick, sp, "0.9", MAGENTA), edge(sick, sn, "0.1")
        e5, e6 = edge(well, wp, "0.09", MAGENTA), edge(well, wn, "0.91")
        tree = VGroup(e1, e2, e3, e4, e5, e6, root, sick, well, sp, sn, wp, wn)

        with self.say("f01") as d:
            self.play(FadeIn(hdef, shift=DOWN * 0.15), run_time=0.6)
            self.play(FadeIn(edef, shift=DOWN * 0.15), run_time=0.6)
            self.play(FadeIn(root), run_time=0.4)
            self.play(Create(e1[0]), Create(e2[0]), FadeIn(sick), FadeIn(well), FadeIn(e1[1]), FadeIn(e2[1]), run_time=0.8)
            self.play(*[Create(e[0]) for e in (e3, e4, e5, e6)], *[FadeIn(e[1]) for e in (e3, e4, e5, e6)],
                      FadeIn(VGroup(sp, sn, wp, wn)), run_time=0.9)

        # 交集的两种写法
        path = VGroup(e1[0].copy(), e3[0].copy()).set_stroke(AMBER, 5)
        eq1 = tex(r"P(H\cap E)", "=", "P(H)", r"\,", r"P(E\mid H)", size=46)
        eq2 = tex(r"P(H\cap E)", "=", "P(E)", r"\,", r"P(H\mid E)", size=46)
        eq1[2].set_color(CYAN)
        eq1[4].set_color(MAGENTA)
        eq2[2].set_color(VIOLET)
        eq2[4].set_color(AMBER)
        eqs = VGroup(eq1, eq2).arrange(DOWN, buff=0.55, aligned_edge=LEFT).move_to(RIGHT * 3.3 + UP * 0.6)
        with self.say("f02") as d:
            self.play(Create(glow(path, AMBER, layers=3)), run_time=1.0)
            self.play(Write(eq1[:2]), run_time=0.6)
            self.wait(max(0.1, d * 0.3))
            self.play(Write(eq1[2]), run_time=0.5)
            self.play(Write(eq1[3:]), run_time=0.6)
        both = VGroup(sp.copy(), wp.copy())
        with self.say("f03") as d:
            self.play(*[Indicate(m, color=MAGENTA) for m in (sp, wp)], run_time=0.9)
            self.play(Write(eq2), run_time=1.1)
            same = Brace(VGroup(eq1[0], eq2[0]), LEFT, color=AMBER)
            self.play(GrowFromCenter(same), run_time=0.5)

        bayes = tex(r"P(H\mid E)", "=", r"{P(E\mid H)", r"\,", r"P(H)", r"\over", r"P(E)}", size=60)
        bayes[0].set_color(AMBER)
        bayes[2].set_color(MAGENTA)
        bayes[4].set_color(CYAN)
        bayes[6].set_color(VIOLET)
        bayes.move_to(RIGHT * 3.5 + DOWN * 1.75)
        with self.say("f04") as d:
            self.play(Indicate(eq2[2], color=VIOLET), run_time=0.7)
            self.play(TransformMatchingTex(VGroup(eq1.copy(), eq2.copy()), bayes), run_time=1.6)
            self.add(glow(bayes.copy(), layers=2, spread=1.4, strength=0.1))
        with self.say("f05") as d:
            p = pill("同一个交集，两种写法", AMBER, 26).move_to(defs)
            self.play(FadeOut(defs), FadeIn(p, scale=0.9), run_time=0.6)

        # 给每一项起名字：把公式放到正中，树收起来
        self.play(FadeOut(VGroup(eqs, same, p, defs, path)), *[m.animate.set_opacity(0.0) for m in self.mobjects
                                                                if m in (tree,)],
                  run_time=0.6)
        self.remove(tree)
        glows = [m for m in self.mobjects if m is not self.hdr and m is not bayes]
        self.play(*[FadeOut(m) for m in glows], bayes.animate.scale(1.2).move_to(UP * 0.8), run_time=0.8)

        def tag(part, text, color, direction=DOWN, sub=None):
            b = Brace(part, direction, color=color, buff=0.12)
            t = VGroup(neon(text, 32, color))
            if sub:
                t.add(zh(sub, 22, SOFT))
                t.arrange(DOWN, buff=0.12)
            t.next_to(b, direction, buff=0.12)
            return VGroup(b, t)

        t_prior = tag(bayes[4], "先验", CYAN, UP, "看到证据之前")
        t_like = tag(bayes[2], "似然", MAGENTA, UP, "假设成立时，证据有多容易出现")
        t_post = tag(bayes[0], "后验", AMBER, DOWN, "看到证据之后")
        t_ev = tag(bayes[6], "分母", VIOLET, DOWN, "所有阳性的人占多少")
        t_like[1].shift(LEFT * 1.1)
        t_prior[1].shift(RIGHT * 0.9)
        with self.say("f06") as d:
            self.play(GrowFromCenter(t_prior[0]), FadeIn(t_prior[1], shift=DOWN * 0.1), run_time=0.8)
        bar = VGroup(zh("竖线", 24, SOFT), tex(r"\mid", size=40), zh("读作“给定”", 24, SOFT)).arrange(RIGHT, buff=0.15)
        bar.to_edge(DOWN, buff=1.6).shift(RIGHT * 3.5)
        with self.say("f07") as d:
            self.play(GrowFromCenter(t_like[0]), FadeIn(t_like[1], shift=DOWN * 0.1), run_time=0.8)
            self.play(FadeIn(bar), run_time=0.5)
        with self.say("f08") as d:
            self.play(FadeOut(bar), GrowFromCenter(t_post[0]), FadeIn(t_post[1], shift=UP * 0.1), run_time=0.8)

        expand = tex(r"P(E)", "=", r"P(E\mid H)\,P(H)", "+", r"P(E\mid \text{健康})\,P(\text{健康})", size=40)
        expand[0].set_color(VIOLET)
        expand[2].set_color(RED)
        expand[4].set_color(GREEN)
        expand.to_edge(DOWN, buff=1.35)
        with self.say("f09") as d:
            self.play(GrowFromCenter(t_ev[0]), FadeIn(t_ev[1], shift=UP * 0.1), run_time=0.8)
            self.play(Write(expand), run_time=1.4)
            lab2 = VGroup(zh("病人里的阳性", 22, RED).next_to(expand[2], DOWN, buff=0.15),
                          zh("误报", 22, GREEN).next_to(expand[4], DOWN, buff=0.15))
            self.play(FadeIn(lab2), run_time=0.5)

        num = tex(r"{0.01\times 0.9", r"\over", r"0.01\times 0.9", "+", r"0.99\times 0.09}", r"\approx", r"9.2\%", size=52)
        num[0].set_color(MAGENTA)
        num[2].set_color(RED)
        num[4].set_color(GREEN)
        num[6].set_color(AMBER)
        num.move_to(DOWN * 0.3)
        with self.say("f10") as d:
            self.play(FadeOut(VGroup(t_prior, t_like, t_ev, expand, lab2)),
                      VGroup(bayes, t_post).animate.scale(0.75).to_edge(UP, buff=1.05), run_time=0.8)
            self.play(Write(num[:5]), run_time=1.6)
            self.play(Write(num[5:]), run_time=0.8)
            self.add(glow(num[6].copy(), AMBER, layers=3))
        self.clear(run_time=0.8)


class Again(VScene):
    header = "02 · 再测一次"

    def construct(self):
        # 仪表盘：有病的概率
        R = 1.75
        center = LEFT * 3.4 + DOWN * 0.35
        track = Arc(radius=R, start_angle=225 * DEGREES, angle=-270 * DEGREES, color=DIM, stroke_width=14).move_arc_center_to(center)
        p = ValueTracker(POST1)

        def val_arc():
            a = Arc(radius=R, start_angle=225 * DEGREES, angle=-270 * DEGREES * max(0.002, p.get_value()),
                    color=AMBER, stroke_width=14).move_arc_center_to(center)
            return glow(a, AMBER, layers=3, spread=1.2, strength=0.18)

        arc = always_redraw(val_arc)
        num = always_redraw(lambda: VGroup(
            DecimalNumber(p.get_value() * 100, num_decimal_places=1, font_size=64, color=AMBER),
            tex(r"\%", size=48, color=AMBER)).arrange(RIGHT, buff=0.08).move_to(center + UP * 0.1))
        cap = zh("有病的概率", 26, SOFT).move_to(center + DOWN * 0.75)
        plus = VGroup(zh("第二次检测", 28, INK), zh("阳性", 28, MAGENTA)).arrange(RIGHT, buff=0.25)
        plus.next_to(track, UP, buff=0.35)
        with self.say("g01") as d:
            self.play(Create(track), FadeIn(arc), FadeIn(num), FadeIn(cap), run_time=1.0)
            self.play(FadeIn(plus, shift=DOWN * 0.15), run_time=0.6)

        # 后验变成先验
        old = VGroup(zh("先验", 28, CYAN), tex(r"1\%", size=40, color=CYAN)).arrange(RIGHT, buff=0.25)
        post = VGroup(zh("后验", 28, AMBER), tex(r"9.2\%", size=40, color=AMBER)).arrange(RIGHT, buff=0.25)
        row = VGroup(old, Arrow(LEFT, RIGHT, color=SOFT, stroke_width=3).scale(0.5), post).arrange(RIGHT, buff=0.3)
        row.move_to(RIGHT * 3.2 + UP * 1.9)
        new_prior = VGroup(zh("新的先验", 28, CYAN), tex(r"9.2\%", size=40, color=CYAN)).arrange(RIGHT, buff=0.25)
        new_prior.next_to(row, DOWN, buff=0.55).align_to(post, LEFT)
        with self.say("g02") as d:
            self.play(FadeIn(row, shift=LEFT * 0.2), run_time=0.8)
            self.wait(max(0.1, d * 0.3))
            self.play(TransformFromCopy(post, new_prior), run_time=1.0)
            self.play(Indicate(new_prior, color=CYAN), run_time=0.7)

        # 九十八个阳性的人再测一次
        cols = 14
        dots = VGroup()
        for k in range(TRUE_POS + FALSE_POS):
            r, c = divmod(k, cols)
            dots.add(Dot([c * 0.25, -r * 0.25, 0], radius=0.07, color=RED if k < TRUE_POS else GREEN))
        dots.move_to(RIGHT * 3.2 + DOWN * 1.15)
        again = [0, 1, 2, 3, 4, 5, 6, 7] + [TRUE_POS + j for j in (3, 14, 25, 33, 46, 58, 71, 84)]
        rings = VGroup(*[Circle(radius=0.12, stroke_color=MAGENTA, stroke_width=2.5).move_to(dots[k]) for k in again])
        n1 = tex(r"9\times 90\%\approx 8.1", size=32, color=RED)
        n2 = tex(r"89\times 9\%\approx 8.0", size=32, color=GREEN)
        ns = VGroup(n1, n2).arrange(RIGHT, buff=0.6).next_to(dots, DOWN, buff=0.3)
        with self.say("g03") as d:
            self.play(FadeOut(row), new_prior.animate.next_to(plus, UP, buff=0.3).shift(RIGHT * 0.0), run_time=0.6)
            self.play(LaggedStart(*[FadeIn(x, scale=0.4) for x in dots], lag_ratio=0.01), run_time=1.2)
            self.play(LaggedStart(*[Create(r) for r in rings], lag_ratio=0.05),
                      VGroup(*[dots[k] for k in range(len(dots)) if k not in again]).animate.set_opacity(0.15),
                      run_time=min(2.5, d * 0.45))
            self.play(FadeIn(n1), run_time=0.5)
            self.play(FadeIn(n2), run_time=0.5)

        chips = VGroup(*[tex(s, size=36, color=c) for s, c in
                         ((r"1\%", CYAN), (r"9.2\%", AMBER), (r"50.3\%", AMBER), (r"91.0\%", AMBER))])
        arrows = VGroup(*[Arrow(LEFT, RIGHT, color=SOFT, stroke_width=3).scale(0.35) for _ in range(3)])
        chain = VGroup(chips[0], arrows[0], chips[1], arrows[1], chips[2], arrows[2], chips[3]).arrange(RIGHT, buff=0.2)
        chain.to_edge(DOWN, buff=1.35).shift(LEFT * 2.6)
        with self.say("g04") as d:
            self.play(p.animate.set_value(POST2), run_time=1.6)
            self.play(FadeIn(chain[:5]), run_time=0.6)
            self.wait(max(0.1, d * 0.25))
            self.play(p.animate.set_value(POST3), run_time=1.4)
            self.play(FadeIn(chain[5:]), run_time=0.5)
        with self.say("g05") as d:
            rule = pill("先验 × 似然 → 后验", AMBER, 28).move_to(RIGHT * 3.2 + UP * 1.9)
            self.play(FadeIn(rule, scale=0.9), run_time=0.6)

        # 历史
        self.clear(run_time=0.8)
        line = Line(LEFT * 5.5, RIGHT * 5.5, color=CYAN, stroke_width=3).shift(DOWN * 0.2)
        yrs = {1763: -2.6, 1774: 2.6}
        pts = {y: line.point_from_proportion((x + 5.5) / 11) for y, x in yrs.items()}
        y1 = VGroup(halo_dot(pts[1763], AMBER, r=0.09), tex("1763", size=40, color=AMBER).next_to(pts[1763], DOWN, buff=0.35))
        y2 = VGroup(halo_dot(pts[1774], VIOLET, r=0.09), tex("1774", size=40, color=VIOLET).next_to(pts[1774], DOWN, buff=0.35))
        c1 = on_panel(VGroup(zh("托马斯·贝叶斯", 32, AMBER), zh("英国牧师，1761 年去世", 22, SOFT),
                             zh("遗稿由普莱斯整理发表", 22, SOFT)).arrange(DOWN, buff=0.16), color=AMBER, pad=0.3)
        c1.next_to(pts[1763], UP, buff=0.5)
        c2 = on_panel(VGroup(zh("拉普拉斯", 32, VIOLET), zh("独立提出同样的想法", 22, SOFT),
                             zh("用于天文观测与人口统计", 22, SOFT)).arrange(DOWN, buff=0.16), color=VIOLET, pad=0.3)
        c2.next_to(pts[1774], UP, buff=0.5)
        with self.say("g06") as d:
            self.play(Create(glow(line, CYAN, layers=3)), run_time=1.0)
            self.play(FadeIn(y1, scale=0.8), FadeIn(c1, shift=UP * 0.2), run_time=0.9)
        with self.say("g07") as d:
            self.play(FadeIn(y2, scale=0.8), FadeIn(c2, shift=UP * 0.2), run_time=0.9)
        self.clear(run_time=0.8)
