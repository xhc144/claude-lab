"""全片共用的配色、字体、文字工具和"边讲边播"的场景基类。"""
import json
import sys
from contextlib import contextmanager
from pathlib import Path

import numpy as np
from manim import *  # noqa: F401,F403

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
AUDIO = ROOT / "build" / "audio"
TIMING = ROOT / "build" / "timing"
DUR = json.loads((AUDIO / "durations.json").read_text())

# ---------- 配色：深蓝底，冷色表示函数与区域，暖色表示点、方向和强调 ----------
BG = "#0E1320"
INK = "#E9EDF5"
DIM = "#8B95AA"
FAINT = "#3A4358"
BLUE = "#5DB7F2"
TEAL = "#45C9A9"
YELLOW = "#FFD166"
ORANGE = "#F4A261"
RED = "#EF6F6C"
PURPLE = "#B794FF"
GREEN = "#8FD47F"

config.background_color = BG
SANS = "Noto Sans CJK SC"
SERIF = "Noto Serif CJK SC"

MathTex.set_default(color=INK)
Tex.set_default(color=INK)


def T(s, size=32, color=INK, font=SANS, weight=NORMAL, **kw):
    """中文文字。size 是字号（像素意义上的近似值）。"""
    return Text(s, font=font, font_size=size, color=color, weight=weight, **kw)


def M(*s, size=40, color=INK, **kw):
    return MathTex(*s, font_size=size, color=color, **kw)


def label_box(mob, color=FAINT, buff=0.25, radius=0.15, opacity=0.85):
    """给一组对象垫一块圆角底板，让文字在复杂背景上也清楚。"""
    r = RoundedRectangle(corner_radius=radius, width=mob.width + 2 * buff, height=mob.height + 2 * buff,
                         stroke_width=0, fill_color=BG, fill_opacity=opacity)
    r.move_to(mob)
    return VGroup(r, mob)


def fog_image(width_units, height_units, alpha_fn, px_per_unit=48):
    """一张背景色的 RGBA 图，透明度由 alpha_fn(x, y)（以图中心为原点的画面单位坐标）给出。
    用图片做雾，渐变是连续的，不会出现矩形拼接的接缝。"""
    w, h = int(width_units * px_per_unit), int(height_units * px_per_unit)
    xs = (np.arange(w) + 0.5) / px_per_unit - width_units / 2
    ys = height_units / 2 - (np.arange(h) + 0.5) / px_per_unit
    X, Y = np.meshgrid(xs, ys)
    a = np.clip(alpha_fn(X, Y), 0, 1)
    c = ManimColor(BG).to_rgb()
    img = np.zeros((h, w, 4), dtype=np.uint8)
    img[..., :3] = (np.array(c) * 255).astype(np.uint8)
    img[..., 3] = (a * 255).astype(np.uint8)
    m = ImageMobject(img)
    m.set_resampling_algorithm(RESAMPLING_ALGORITHMS["bilinear"])
    m.stretch_to_fit_width(width_units).stretch_to_fit_height(height_units)
    return m


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def dimmed(mob, factor):
    """返回一个整体变暗的副本：只按比例降低已有的描边与填充透明度，不会给线条凭空加上填充。"""
    m = mob.copy()
    for sm in m.family_members_with_points():
        if isinstance(sm, VMobject):
            sm.set_stroke(opacity=sm.get_stroke_opacity() * factor, family=False)
            sm.set_fill(opacity=sm.get_fill_opacity() * factor, family=False)
    return m


class VScene(Scene):
    """按旁白段落推进的场景：with self.say(编号) 内播放的动画与该段语音同时开始，
    段落结束时自动补足等待，保证下一段语音不会和这一段重叠。"""

    def setup(self):
        self._log = []

    @contextmanager
    def say(self, sid, tail=0.35):
        dur = DUR[sid]["duration"]
        t0 = self.renderer.time
        self.add_sound(str(AUDIO / f"{sid}.wav"))
        self._log.append({"id": sid, "start": round(t0, 3), "dur": dur, "text": DUR[sid]["text"]})
        yield dur
        rest = t0 + dur + tail - self.renderer.time
        if rest > 1 / 60:
            self.wait(rest)

    def tear_down(self):
        TIMING.mkdir(parents=True, exist_ok=True)
        (TIMING / f"{type(self).__name__}.json").write_text(
            json.dumps({"segments": self._log, "end": round(self.renderer.time, 3)}, ensure_ascii=False, indent=1))

    # ---------- 共用的小动画 ----------
    def chapter(self, sid, num, title, subtitle):
        """章节标题卡：编号、标题、一句话点题，配合本章第一段旁白。"""
        n = T(num, 30, DIM, font=SERIF)
        t = T(title, 64, INK, font=SERIF, weight=BOLD)
        s = T(subtitle, 30, DIM)
        g = VGroup(n, t, s).arrange(DOWN, buff=0.35)
        line = Line(LEFT * 2.2, RIGHT * 2.2, stroke_width=1.5, color=YELLOW).next_to(t, DOWN, buff=0.18)
        s.next_to(line, DOWN, buff=0.35)
        with self.say(sid, tail=0.9):
            self.play(FadeIn(n, shift=DOWN * 0.2), Write(t), run_time=1.2)
            self.play(Create(line), FadeIn(s, shift=UP * 0.15), run_time=0.9)
        self.play(FadeOut(VGroup(n, t, s, line)), run_time=0.6)

    def clear_all(self, run_time=0.7):
        if self.mobjects:
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=run_time)
