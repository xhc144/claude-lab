"""05 方差能不能合并（F 检验）"""
from common import *


class FTest(VScene):
    header = "比较方差 · F 检验"

    def construct(self):
        self.add_ghost()

        q = tex(r"\sigma_1=\sigma_2\ ?", size=80).move_to(UP * 0.4)
        q[0][-1].set_color(GOLD)
        with self.say("e01") as d:
            self.play(FadeIn(q, scale=0.95), run_time=0.9)

        # 散得更开？
        ax = dist_axes(40, 110, 10, width=10, height=2.4, ymax=0.045, numbers=[50, 60, 70, 80, 90, 100]).move_to(DOWN * 0.9)
        sd = ValueTracker(9.6)
        cb = always_redraw(lambda: pdf_curve(ax, lambda x: stats.norm.pdf(x, 78.4, sd.get_value()), 40, 110, BLUE, 3.5))
        co = pdf_curve(ax, lambda x: stats.norm.pdf(x, 75.1, 10.8), 40, 110, ORANGE, 3.5)
        with self.say("e02") as d:
            self.play(q.animate.scale(0.6).move_to(UP * 2.4), run_time=0.7)
            self.play(Create(ax), Create(co), Create(cb), run_time=1.2)
        with self.say("e03") as d:
            self.play(sd.animate.set_value(15), run_time=d * 0.4)
            self.play(sd.animate.set_value(9.6), run_time=d * 0.4)

        # 相减还是相除
        self.play(FadeOut(VGroup(ax, co, cb, q)), run_time=0.7)
        sub = tex(r"S_1^2-S_2^2", "=", r"92.2-116.6", "=", r"-24.5", size=48)
        div = tex(r"S_1^2/S_2^2", "=", r"92.2/116.6", "=", r"0.79", size=48)
        VGroup(sub, div).arrange(DOWN, buff=0.9, aligned_edge=LEFT).move_to(UP * 0.9)
        unit = VGroup(zh("计分", 26, SOFT), tex(r"50\ \cdots\ 100", size=40, color=SOFT)).arrange(RIGHT, buff=0.3)
        unit.move_to(DOWN * 1.5)
        with self.say("e04") as d:
            self.play(Write(sub), run_time=1.4)
            self.play(FadeIn(div.set_opacity(0.35)), FadeIn(unit), run_time=0.7)
        sub2 = tex(r"S_1^2-S_2^2", "=", r"9216-11664", "=", r"-2448", size=48).move_to(sub, aligned_edge=LEFT)
        div2 = tex(r"S_1^2/S_2^2", "=", r"9216/11664", "=", r"0.79", size=48).move_to(div, aligned_edge=LEFT)
        div2.set_opacity(0.35)
        unit2 = VGroup(zh("计分", 26, SOFT), tex(r"500\ \cdots\ 1000", size=40, color=GOLD)).arrange(RIGHT, buff=0.3)
        unit2.move_to(unit)
        x100 = tex(r"\times 100", size=40, color=RED).next_to(sub2, RIGHT, buff=0.4)
        with self.say("e05") as d:
            self.wait(d * 0.3)
            self.play(Transform(unit, unit2), run_time=0.7)
            self.play(Transform(sub, sub2), Transform(div, div2), run_time=1.0)
            self.play(FadeIn(x100, shift=LEFT * 0.1), run_time=0.5)
        with self.say("e06") as d:
            self.play(sub.animate.set_opacity(0.35), x100.animate.set_opacity(0.35), run_time=0.8)
        same = tex(r"\text{不变}", size=36, color=GOLD).next_to(div, RIGHT, buff=0.4)
        with self.say("e07") as d:
            self.play(div.animate.set_opacity(1), FadeIn(same), run_time=0.7)
            self.play(Indicate(div[4], color=GOLD), run_time=0.8)

        # 比值让 σ 约掉
        self.play(FadeOut(VGroup(sub, x100, unit, same, div)), run_time=0.7)
        fl = tex(r"\dfrac{S_1^2/\sigma_1^2}{S_2^2/\sigma_2^2}", r"\sim F(n_1-1,\,n_2-1)", size=54).move_to(UP * 1.7 + LEFT * 2.0)
        sig = find_glyphs(fl[0], r"\sigma")
        with self.say("e08") as d:
            self.play(Write(fl), run_time=1.6)
            self.play(sig.animate.set_color(RED), run_time=0.5)
        h0 = VGroup(tex(r"H_0:\ \sigma_1^2=\sigma_2^2", size=40, color=SOFT),
                    tex(r"\Rightarrow\ F=\dfrac{S_1^2}{S_2^2}", size=54, color=GOLD)).arrange(RIGHT, buff=0.5)
        h0.next_to(fl, DOWN, buff=0.6).align_to(fl, LEFT)
        with self.say("e09") as d:
            strikes = VGroup(*[strike(g) for g in sig])
            self.play(Create(strikes), run_time=0.7)
            self.play(FadeIn(h0[0]), run_time=0.6)
            self.play(FadeIn(h0[1], shift=RIGHT * 0.1), run_time=0.7)

        top_f = VGroup(fl, strikes, sig, h0)
        chi = tex(r"\frac{(n-1)S^2}{\sigma^2}\sim\chi^2(n-1)", size=44)
        with self.say("e10") as d:
            self.play(top_f.animate.scale(0.75).to_edge(UP, buff=0.95).set_x(-2.6), run_time=0.8)
            chi.next_to(top_f, RIGHT, buff=0.8).align_to(top_f, UP)
            self.play(Write(chi), run_time=1.2)

        # 两个卡方相除 → F
        c_ax1 = dist_axes(0, 2.6, 0.5, width=4.2, height=1.1, ymax=2.0).move_to(LEFT * 3.4 + DOWN * 0.05)
        c_ax2 = dist_axes(0, 2.6, 0.5, width=4.2, height=1.1, ymax=2.0).move_to(LEFT * 3.4 + DOWN * 2.0)
        g = chi2_scaled_pdf(39)
        k1 = pdf_curve(c_ax1, g, 0.01, 2.6, BLUE, 3)
        k2 = pdf_curve(c_ax2, g, 0.01, 2.6, ORANGE, 3)
        bar = Line(LEFT * 2.3, RIGHT * 2.3, color=INK, stroke_width=2.5).move_to(LEFT * 3.4 + DOWN * 1.25)
        l1 = tex(r"\chi^2(39)/39", size=30, color=BLUE).next_to(c_ax1, RIGHT, buff=0.1).shift(UP * 0.4)
        l2 = tex(r"\chi^2(39)/39", size=30, color=ORANGE).next_to(c_ax2, RIGHT, buff=0.1).shift(UP * 0.4)
        fpdf = f_pdf(39, 39)
        ymax = 1.15 * max(fpdf(x) for x in np.linspace(0.3, 2, 200))
        f_ax = dist_axes(0, 2.6, 0.5, width=6.6, height=2.6, ymax=ymax, numbers=[0.53, 1, 1.89]).move_to(RIGHT * 3.2 + DOWN * 1.15)
        fcur = pdf_curve(f_ax, fpdf, 0.01, 2.6, INK, 3.5)
        flab = tex(r"F(39,39)", size=34, color=SOFT).next_to(f_ax.c2p(1.75, ymax * 0.8), RIGHT, buff=0.1)
        with self.say("e11") as d:
            self.play(Create(c_ax1), Create(k1), FadeIn(l1), run_time=0.8)
            self.play(Create(bar), Create(c_ax2), Create(k2), FadeIn(l2), run_time=0.8)
            self.play(Create(f_ax), ReplacementTransform(VGroup(k1.copy(), k2.copy()), fcur), FadeIn(flab), run_time=1.5)
        name = zh("F：斯内德克取名，纪念费希尔", 24, SOFT).next_to(f_ax, UP, buff=0.25).align_to(f_ax, RIGHT)
        with self.say("e12") as d:
            self.play(FadeIn(name), run_time=0.7)

        rej = reject_regions(f_ax, fpdf, 0.53, 1.89, 0.01, 2.6)
        mk = marker(f_ax, 0.79, GOLD)
        calc = tex(r"F=\frac{9.6^2}{10.8^2}\approx 0.79", size=44, color=INK).move_to(LEFT * 3.4 + DOWN * 1.0)
        with self.say("e13") as d:
            self.play(FadeOut(VGroup(c_ax1, c_ax2, k1, k2, bar, l1, l2)), run_time=0.6)
            self.play(Write(calc), run_time=0.9)
            self.play(FadeIn(rej), run_time=0.5)
            mk.shift(UP * 2)
            self.add(mk)
            self.play(mk.animate.shift(DOWN * 2), run_time=0.7, rate_func=rate_functions.ease_in_quad)
        self.line("e14")
        ok = zh("可以合并", 30, GOLD).next_to(calc, DOWN, buff=0.45)
        with self.say("e15") as d:
            self.play(FadeIn(ok, shift=UP * 0.1), run_time=0.6)
        tip = VGroup(tex(r"F_{1-\alpha/2}(m,n)=\dfrac{1}{F_{\alpha/2}(n,m)}", size=40),
                     tex(r"0.53=1/1.89", size=34, color=SOFT)).arrange(DOWN, buff=0.25)
        tip.move_to(LEFT * 3.4 + DOWN * 1.2)
        with self.say("e16") as d:
            self.play(FadeOut(VGroup(calc, ok)), run_time=0.5)
            self.play(Write(tip[0]), run_time=1.2)
            self.play(FadeIn(tip[1]), run_time=0.5)
        self.wait(0.6)
        self.play(FadeOut(VGroup(top_f, chi, f_ax, fcur, flab, name, rej, mk, tip)), run_time=1.0)
        self.wait(0.4)
