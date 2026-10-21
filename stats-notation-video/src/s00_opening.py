"""开场：论文里的一段统计记号。尾声会回到同一段。"""
from common import *


def paper_lines(size=40):
    """开场与尾声共用的那一段。返回五行，每行按记号拆开，方便逐个圈出。"""
    l1 = tex(r"\text{设 }", r"X_1,\dots,X_{16}", r"\iid", r"N(", r"\mu", r",\,", r"\sigma^2", r")", r"\text{。}", size=size)
    l2 = tex(r"\text{检验 }", r"H_0", r":\ \mu=500", r"\quad\text{对}\quad", r"H_1", r":\ \mu\neq 500", r"\text{。}", size=size)
    l3 = tex(r"\hat\mu=", r"\bar x", r"=494,\ ", r"s=10,\ ", r"t=\frac{\bar x-\mu_0}{s/\sqrt{n}}", r"=-2.40", r"\sim",
             r"t(15)", r"\text{，}", size=size)
    l4 = tex(r"p", r"=.030<", r"\alpha", r"=0.05", r"\text{，拒绝 }", r"H_0", r"\text{；}", size=size)
    l5 = tex(r"95\%\ \text{CI}", r":\ [488.7,\ 499.3]", r"\text{，}", r"\text{效应量 }d=0.6", r"\text{。}", size=size)
    return VGroup(l1, l2, l3, l4, l5).arrange(DOWN, buff=0.34, aligned_edge=LEFT)


def paper(size=40):
    body = paper_lines(size)
    page = Rectangle(width=body.width + 1.4, height=body.height + 1.1, stroke_color=LINE, stroke_width=1.5,
                     fill_color=PAPER, fill_opacity=1).move_to(body)
    rule = Line(page.get_corner(UL) + RIGHT * 0.5 + DOWN * 0.35, page.get_corner(UR) + LEFT * 0.5 + DOWN * 0.35,
                color=LINE, stroke_width=1)
    return VGroup(page, rule, body)


class Opening(VScene):
    def construct(self):
        pg = paper().move_to(UP * 0.35)
        page, rule, body = pg
        with self.say("o01") as d:
            self.play(FadeIn(page, shift=UP * 0.2), Create(rule), run_time=0.9)
            self.play(LaggedStart(*[Write(l) for l in body], lag_ratio=0.35), run_time=min(4.0, d))
        l1, l2, l3, l4, l5 = body
        groups = [
            ([l1[4], l1[6], l4[2]], BLUE),                 # 希腊字母
            ([l1[1], l2[1], l2[4], l1[6]], ORANGE),        # 上下标
            ([l3[0]], GOLD),                               # 帽子
            ([l3[1]], GOLD),                               # 横线
            ([l1[2], l3[6]], GREEN),                       # 波浪号
            ([l5[0]], RED),                                # 缩写
        ]
        with self.say("o02") as d:
            step = d / (len(groups) + 0.5)
            shown = []
            for mobs, c in groups:
                bx = VGroup(*[boxed(m, c, buff=0.06) for m in mobs])
                self.play(Create(bx), run_time=min(0.5, step * 0.6))
                self.wait(max(0, step - 0.5))
                shown.append(bx)
        allb = VGroup(*shown)
        rules = VGroup(
            pill("字母的种类 → 对象的种类", BLUE, 24),
            pill("头上的帽子 → 估计", GOLD, 24),
            pill("竖线、波浪线 → 固定的读法", GREEN, 24),
        ).arrange(RIGHT, buff=0.35).to_edge(DOWN, buff=1.05)
        with self.say("o03") as d:
            self.play(FadeOut(allb), pg.animate.shift(UP * 0.45), run_time=0.7)
            self.play(LaggedStart(*[FadeIn(r, shift=UP * 0.1) for r in rules], lag_ratio=0.5), run_time=min(2.4, d - 1))

        names = ["总体与样本", "描述统计", "概率", "随机变量", "常见分布", "抽样分布", "参数估计", "假设检验", "回归",
                 "容易混淆的记号"]
        nums = "一二三四五六七八九十"
        items = VGroup(*[VGroup(zh(nums[i], 26, GOLD), zh(n, 30)).arrange(RIGHT, buff=0.28) for i, n in enumerate(names)])
        col1 = VGroup(*items[:5]).arrange(DOWN, buff=0.36, aligned_edge=LEFT)
        col2 = VGroup(*items[5:]).arrange(DOWN, buff=0.36, aligned_edge=LEFT)
        road = VGroup(col1, col2).arrange(RIGHT, buff=2.2, aligned_edge=UP).move_to(DOWN * 0.15)
        with self.say("o04") as d:
            self.play(FadeOut(rules), pg.animate.scale(0.42).to_corner(UR, buff=0.35), run_time=0.8)
            self.play(LaggedStart(*[FadeIn(it, shift=RIGHT * 0.15) for it in items], lag_ratio=0.55),
                      run_time=min(d - 1.2, 9))

        three = VGroup(pill("怎么读", BLUE, 32), pill("是什么意思", ORANGE, 32), pill("为什么这样写", GOLD, 32)) \
            .arrange(RIGHT, buff=0.6).move_to(DOWN * 0.2)
        with self.say("o05") as d:
            self.play(FadeOut(road), run_time=0.6)
            self.play(LaggedStart(*[GrowFromCenter(t) for t in three], lag_ratio=0.45), run_time=min(2.0, d - 0.7))

        title = serif("统计的符号与术语", 72).move_to(UP * 0.55)
        sub = tex(r"\mu\text{、}\sigma\text{、}\bar x\text{、}\hat\theta\text{、}H_0\text{、}p\text{ 值……都在说什么}",
                  size=36, color=SOFT).next_to(title, DOWN, buff=0.45)
        bar = Line(LEFT * 1.8, RIGHT * 1.8, color=GOLD, stroke_width=3).next_to(sub, DOWN, buff=0.4)
        with self.say("o06") as d:
            self.play(FadeOut(three), pg.animate.scale(1 / 0.42).move_to(UP * 0.35).set_opacity(0.0), run_time=0.8)
            self.remove(pg)
            self.play(Write(title), run_time=1.2)
            self.play(FadeIn(sub, shift=UP * 0.1), Create(bar), run_time=0.8)
        self.wait(1.4)
        self.play(FadeOut(VGroup(title, sub, bar)), run_time=0.8)
