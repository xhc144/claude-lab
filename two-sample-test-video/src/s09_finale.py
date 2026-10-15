"""09 一棵树"""
from common import *


class Finale(VScene):
    def node(self, text, pos, size=26, color=INK):
        return zh(text, size, color).move_to(pos)

    def leaf(self, s, pos, size=36, note=None):
        m = tex(s, size=size, color=GOLD)
        if note:
            lab = tex(note, size=28, color=GOLD) if "\\" in note else zh(note, 22, GOLD)
            m = VGroup(lab, m).arrange(DOWN, buff=0.08)
        return m.move_to(pos)

    def construct(self):
        icon = VGroup(Line(LEFT * 0.45, RIGHT * 0.45, color=GOLD, stroke_width=6),
                      Line(LEFT * 0.7, RIGHT * 0.7, color=INK, stroke_width=2.5),
                      wave(1.1, 0.06, 2.5, stroke=3)).arrange(DOWN, buff=0.12).move_to(UP * 3.0)
        n = {
            "q1": self.node("数据一一配对吗？", [0, 2.1, 0]),
            "pair": self.leaf(r"t(n-1)", [-4.6, 1.15, 0], note="差值的单样本 t"),
            "q2": self.node("比什么？", [1.7, 1.2, 0]),
            "mean": self.node("均值", [-1.3, 0.3, 0]),
            "var": self.node("方差", [2.1, 0.3, 0]),
            "prop": self.node("比例", [5.1, 0.3, 0]),
            "q3": self.node("σ 已知吗？", [-1.3, -0.6, 0]),
            "F": self.leaf(r"F=S_1^2/S_2^2", [2.1, -0.65, 0]),
            "P": self.leaf(r"Z", [5.1, -0.7, 0], note=r"\text{合并 }\hat p"),
            "Z": self.leaf(r"Z", [-3.6, -1.55, 0]),
            "q4": self.node("方差相等吗？", [0.6, -1.5, 0]),
            "pool": self.leaf(r"t(n_1+n_2-2)", [-0.9, -2.5, 0], note="合并方差"),
            "welch": self.leaf(r"\text{Welch}", [2.3, -2.45, 0]),
        }
        edges = [("root", "q1", None), ("q1", "pair", "是"), ("q1", "q2", "否"), ("q2", "mean", None),
                 ("q2", "var", None), ("q2", "prop", None), ("mean", "q3", None), ("var", "F", None),
                 ("prop", "P", None), ("q3", "Z", "已知"), ("q3", "q4", "未知"), ("q4", "pool", "相等"),
                 ("q4", "welch", "不等")]
        get = lambda k: icon if k == "root" else n[k]
        lines = {}
        for a, b, lab in edges:
            A, B = get(a), get(b)
            ln = Line(A.get_bottom() + DOWN * 0.08, B.get_top() + UP * 0.08, color=LINE, stroke_width=2)
            g = VGroup(ln)
            if lab:
                g.add(zh(lab, 20, SOFT).move_to(ln.get_center()).shift(LEFT * 0.3 if B.get_x() < A.get_x() else RIGHT * 0.3))
            lines[b] = g
        levels = [["q1"], ["pair", "q2"], ["mean", "var", "prop"], ["q3", "F", "P"], ["Z", "q4"], ["pool", "welch"]]

        self.play(FadeIn(icon, shift=DOWN * 0.1), run_time=0.8)
        for lv in levels:
            self.play(*[Create(lines[k]) for k in lv], run_time=0.45)
            self.play(*[FadeIn(n[k], shift=DOWN * 0.08) for k in lv], run_time=0.45)
        self.line("i01")

        hl = None

        def show(keys, d):
            nonlocal hl
            box = VGroup(*[SurroundingRectangle(n[k], color=GOLD, buff=0.12, corner_radius=0.08, stroke_width=2.5)
                           for k in keys])
            if hl is None:
                self.play(Create(box), run_time=0.7)
            else:
                self.play(ReplacementTransform(hl, box), run_time=0.7)
            hl = box

        for key, ks in (("i02", ["Z"]), ("i03", ["pair"]), ("i04", ["Z", "pool"]), ("i05", ["F"]), ("i06", ["pool", "P"])):
            with self.say(key, gap=0.5) as d:
                show(ks, d)
        tree = VGroup(icon, *n.values(), *lines.values(), hl)
        self.play(FadeOut(tree), run_time=1.0)

        # 结尾：3.3 落在抖动带里
        ax = NumberLine(x_range=[-8, 8, 2], length=11, color=LINE, include_tip=False, stroke_width=2).move_to(DOWN * 0.4)
        nums = VGroup(*[tex(str(v), size=28, color=SOFT).next_to(ax.n2p(v), DOWN, buff=0.15) for v in (-8, -4, 0, 4, 8)])
        band = Rectangle(width=ax.n2p(4.38)[0] - ax.n2p(-4.38)[0], height=1.3, stroke_width=0,
                         fill_color=GRAY, fill_opacity=0.18).move_to(ax.n2p(0) + UP * 0.65)
        blab = zh("差平常抖动的范围", 24, SOFT).next_to(band, UP, buff=0.15)
        arr = Arrow(ax.n2p(0) + UP * 0.45, ax.n2p(3.3) + UP * 0.45, buff=0, color=GOLD, stroke_width=6, tip_length=0.2)
        alab = tex("3.3", size=44, color=GOLD).next_to(arr, UP, buff=0.12)
        with self.say("i07", gap=0.5) as d:
            self.play(Create(ax), FadeIn(nums), run_time=0.8)
            self.play(GrowArrow(arr), FadeIn(alab), run_time=0.8)
        with self.say("i08", gap=0.6) as d:
            self.play(FadeIn(band), FadeIn(blab), run_time=1.2)
        self.wait(2.0)
        self.play(FadeOut(VGroup(ax, nums, band, blab, arr, alab)), run_time=1.6)
        self.wait(1.0)
