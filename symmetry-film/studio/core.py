"""Core helpers: canvas, easing, colour, typography, post-processing.

All scenes draw in a 1920x1080 *design space*.  The actual output resolution is
``1920*scale x 1080*scale``; skia drawing is scaled automatically and per-pixel
shaders receive the pixel grid together with the scale factor.
"""
from __future__ import annotations

import functools
import math
import os

import cv2
import numpy as np
import skia

W, H = 1920, 1080
FPS = 30
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "cache")
os.makedirs(CACHE, exist_ok=True)


# --------------------------------------------------------------------------
# Easing / timing
# --------------------------------------------------------------------------
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def seg(t, a, b):
    """Linear progress of t through [a, b] clamped to [0, 1]."""
    if b <= a:
        return 1.0 if t >= b else 0.0
    return clamp((t - a) / (b - a))


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def smoother(x):
    x = clamp(x)
    return x * x * x * (x * (6 * x - 15) + 10)


def ease_out_cubic(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in_cubic(x):
    x = clamp(x)
    return x ** 3


def ease_in_out(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out_expo(x):
    x = clamp(x)
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def ease_in_expo(x):
    x = clamp(x)
    return 0.0 if x <= 0 else 2 ** (10 * x - 10)


def ease_out_back(x, s=1.70158):
    x = clamp(x)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


def envelope(t, a, b, fin=0.5, fout=0.5):
    """1 inside [a, b] with smooth ramps of length fin / fout."""
    if t < a or t > b:
        return 0.0
    return smooth(seg(t, a, a + fin)) * (1 - smooth(seg(t, b - fout, b)))


def lerp(a, b, x):
    return a + (b - a) * x


def hash01(i, salt=0):
    """Deterministic pseudo random number in [0, 1)."""
    x = math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
    return x - math.floor(x)


# --------------------------------------------------------------------------
# Colour
# --------------------------------------------------------------------------
def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def c4(color, a=1.0):
    """Make a skia.Color4f from '#rrggbb' or an (r,g,b) tuple in 0..1."""
    if isinstance(color, str):
        color = hexrgb(color)
    return skia.Color4f(float(color[0]), float(color[1]), float(color[2]), float(clamp(a)))


def mix(c1, c2, x):
    if isinstance(c1, str):
        c1 = hexrgb(c1)
    if isinstance(c2, str):
        c2 = hexrgb(c2)
    return tuple(lerp(a, b, x) for a, b in zip(c1, c2))


def hsv(h, s, v):
    h = (h % 1.0) * 6
    i = int(h)
    f = h - i
    p, q, r = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    return [(v, r, p), (q, v, p), (p, v, r), (p, q, v), (r, p, v), (v, p, q)][i % 6]


# House palette
GOLD = "#f1c97a"
GOLD_DEEP = "#c8913a"
CREAM = "#f6ead2"
ICE = "#bfe8ff"
CYAN = "#58d6ff"
MAGENTA = "#ff4fa3"
VIOLET = "#9b7bff"
WHITE = "#ffffff"
INK = "#05070d"


# --------------------------------------------------------------------------
# Fonts
# --------------------------------------------------------------------------
_FONT_FILES = {
    "serif_cn_black": ("/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc", 2),
    "serif_cn_bold": ("/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc", 2),
    "serif_cn_semibold": ("/usr/share/fonts/opentype/noto/NotoSerifCJK-SemiBold.ttc", 2),
    "serif_cn": ("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc", 2),
    "serif_cn_light": ("/usr/share/fonts/opentype/noto/NotoSerifCJK-Light.ttc", 2),
    "sans_cn": ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 2),
    "sans_cn_light": ("/usr/share/fonts/opentype/noto/NotoSansCJK-Light.ttc", 2),
    "sans_cn_thin": ("/usr/share/fonts/opentype/noto/NotoSansCJK-Thin.ttc", 2),
    "sans_cn_bold": ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 2),
    "garamond": ("/usr/share/fonts/opentype/ebgaramond/EBGaramond12-Regular.otf", 0),
    "garamond_it": ("/usr/share/fonts/opentype/ebgaramond/EBGaramond12-Italic.otf", 0),
    "garamond_bold": ("/usr/share/fonts/opentype/ebgaramond/EBGaramond12-Bold.otf", 0),
    "script": ("/usr/share/fonts/opentype/dancingscript/DancingScript-Regular.otf", 0),
    "math": ("/usr/share/texmf/fonts/opentype/public/lm/lmroman10-regular.otf", 0),
    "math_it": ("/usr/share/texmf/fonts/opentype/public/lm/lmroman10-italic.otf", 0),
    "inter_light": ("/usr/share/fonts/opentype/inter/Inter-Light.otf", 0),
    "inter": ("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 0),
    "inter_thin": ("/usr/share/fonts/opentype/inter/InterDisplay-Thin.otf", 0),
    "inter_display_light": ("/usr/share/fonts/opentype/inter/InterDisplay-Light.otf", 0),
    "inter_bold": ("/usr/share/fonts/opentype/inter/Inter-Bold.otf", 0),
    "mono": ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 0),
    "dejavu": ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0),
    "dejavu_serif": ("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 0),
}

# Fallback chain used when a glyph is missing in the requested font.
_FALLBACK = ["serif_cn", "math", "dejavu_serif", "dejavu"]


# When a font file above is missing (e.g. on macOS / Windows), look the font up
# by family name instead: (candidate families, weight, italic).
_SERIF_CN = ["Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun"]
_SANS_CN = ["Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", "SimHei"]
_GARAMOND = ["EB Garamond", "EB Garamond 12", "Garamond", "Georgia", "Times New Roman"]
_LMODERN = ["Latin Modern Roman", "LM Roman 10", "CMU Serif", "Times New Roman"]
_INTER = ["Inter", "Inter Display", "Helvetica Neue", "Helvetica", "Arial"]
_FONT_FAMILIES = {
    "serif_cn_black": (_SERIF_CN, 900, False), "serif_cn_bold": (_SERIF_CN, 700, False),
    "serif_cn_semibold": (_SERIF_CN, 600, False), "serif_cn": (_SERIF_CN, 400, False),
    "serif_cn_light": (_SERIF_CN, 300, False), "sans_cn": (_SANS_CN, 400, False),
    "sans_cn_light": (_SANS_CN, 300, False), "sans_cn_thin": (_SANS_CN, 100, False),
    "sans_cn_bold": (_SANS_CN, 700, False), "garamond": (_GARAMOND, 400, False),
    "garamond_it": (_GARAMOND, 400, True), "garamond_bold": (_GARAMOND, 700, False),
    "script": (["Dancing Script", "Apple Chancery", "Brush Script MT", "Segoe Script"], 400, False),
    "math": (_LMODERN, 400, False), "math_it": (_LMODERN, 400, True),
    "inter_light": (_INTER, 300, False), "inter": (_INTER, 400, False), "inter_thin": (_INTER, 100, False),
    "inter_display_light": (_INTER, 300, False), "inter_bold": (_INTER, 700, False),
    "mono": (["DejaVu Sans Mono", "Menlo", "Consolas", "Courier New"], 400, False),
    "dejavu": (["DejaVu Sans", "Arial Unicode MS", "Arial"], 400, False),
    "dejavu_serif": (["DejaVu Serif", "Times New Roman"], 400, False),
}


@functools.lru_cache(maxsize=None)
def typeface(key):
    path, idx = _FONT_FILES[key]
    tf = skia.Typeface.MakeFromFile(path, idx) if os.path.exists(path) else None
    if tf is None:
        families, weight, italic = _FONT_FAMILIES[key]
        slant = skia.FontStyle.kItalic_Slant if italic else skia.FontStyle.kUpright_Slant
        style = skia.FontStyle(weight, 5, slant)
        mgr = skia.FontMgr()
        for fam in families:
            tf = mgr.matchFamilyStyle(fam, style)
            if tf is not None:
                break
        if tf is None:
            tf = mgr.legacyMakeTypeface("", style)
        if tf is None:
            raise RuntimeError(f"cannot load font {key}: install the fonts listed in 使用说明.md")
        print(f"[font] {path} not found; using '{tf.getFamilyName()}' for {key}", flush=True)
    return tf


@functools.lru_cache(maxsize=4096)
def font(key, size):
    f = skia.Font(typeface(key), float(size))
    f.setEdging(skia.Font.Edging.kSubpixelAntiAlias)
    f.setSubpixel(True)
    f.setHinting(skia.FontHinting.kNone)
    return f


@functools.lru_cache(maxsize=65536)
def _has_glyph(key, ch):
    return typeface(key).unicharToGlyph(ord(ch)) != 0


def _font_for_char(key, ch):
    if ch == " " or _has_glyph(key, ch):
        return key
    for fb in _FALLBACK:
        if _has_glyph(fb, ch):
            return fb
    return key


@functools.lru_cache(maxsize=65536)
def char_advance(key, size, ch):
    k = _font_for_char(key, ch)
    return font(k, size).measureText(ch)


def text_width(text, key, size, tracking=0.0):
    """Width of text in design pixels.  tracking is in em units."""
    if not text:
        return 0.0
    return sum(char_advance(key, size, ch) for ch in text) + tracking * size * (len(text) - 1)


# --------------------------------------------------------------------------
# Canvas / frame
# --------------------------------------------------------------------------
class Frame:
    """An RGBA uint8 framebuffer wrapped by a skia canvas in design space."""

    def __init__(self, scale=1.0, clear=INK):
        self.scale = scale
        self.w = int(round(W * scale))
        self.h = int(round(H * scale))
        self.buf = np.zeros((self.h, self.w, 4), np.uint8)
        self.surface = skia.Surface(self.buf)
        self.canvas = self.surface.getCanvas()
        self.canvas.scale(scale, scale)
        if clear is not None:
            self.canvas.clear(c4(clear))

    def set_rgb(self, rgb):
        """Replace contents with a float RGB image (h, w, 3) in 0..1."""
        self.buf[..., :3] = np.clip(rgb * 255.0 + 0.5, 0, 255).astype(np.uint8)
        self.buf[..., 3] = 255

    def rgb(self):
        return self.buf[..., :3].astype(np.float32) * (1.0 / 255.0)

    # convenience --------------------------------------------------------
    @property
    def c(self):
        return self.canvas


def pixel_grid(scale):
    """Design-space coordinates of pixel centres: (X, Y) arrays of shape (h, w)."""
    w, h = int(round(W * scale)), int(round(H * scale))
    xs = (np.arange(w, dtype=np.float32) + 0.5) / scale
    ys = (np.arange(h, dtype=np.float32) + 0.5) / scale
    return np.meshgrid(xs, ys)


# --------------------------------------------------------------------------
# Paint helpers
# --------------------------------------------------------------------------
def paint(color=WHITE, a=1.0, stroke=None, blur=0.0, blend=None, cap="round", aa=True):
    p = skia.Paint(AntiAlias=aa, Color4f=c4(color, a))
    if stroke is not None:
        p.setStyle(skia.Paint.kStroke_Style)
        p.setStrokeWidth(float(stroke))
        p.setStrokeCap({"round": skia.Paint.kRound_Cap, "butt": skia.Paint.kButt_Cap,
                        "square": skia.Paint.kSquare_Cap}[cap])
        p.setStrokeJoin(skia.Paint.kRound_Join)
    if blur > 0:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, float(blur)))
    if blend == "add":
        p.setBlendMode(skia.BlendMode.kPlus)
    elif blend == "screen":
        p.setBlendMode(skia.BlendMode.kScreen)
    elif blend == "multiply":
        p.setBlendMode(skia.BlendMode.kMultiply)
    return p


def glow_line(canvas, pts, color, width=2.0, glow=10.0, a=1.0, closed=False, core=True, blend="add"):
    """Draw a polyline with a soft additive glow and a bright core."""
    if len(pts) < 2 or a <= 0.003:
        return
    path = skia.Path()
    path.moveTo(*pts[0])
    for p in pts[1:]:
        path.lineTo(*p)
    if closed:
        path.close()
    if glow > 0:
        canvas.drawPath(path, paint(color, 0.55 * a, stroke=width * 3, blur=glow, blend=blend))
    canvas.drawPath(path, paint(color, a, stroke=width, blend=blend))
    if core:
        canvas.drawPath(path, paint(mix(color, WHITE, 0.7), 0.8 * a, stroke=max(width * 0.4, 0.6), blend=blend))


def glow_dot(canvas, x, y, r, color, a=1.0, glow=3.0, blend="add"):
    if a <= 0.003:
        return
    canvas.drawCircle(x, y, r * glow, paint(color, 0.35 * a, blur=r * glow * 0.6, blend=blend))
    canvas.drawCircle(x, y, r, paint(color, a, blend=blend))
    canvas.drawCircle(x, y, r * 0.45, paint(mix(color, WHITE, 0.8), a, blend=blend))


def radial_bg(canvas, inner, outer, cx=W / 2, cy=H / 2, r=1200, a=1.0):
    shader = skia.GradientShader.MakeRadial(
        skia.Point(cx, cy), r, [c4(inner, a).toColor(), c4(outer, a).toColor()])
    p = skia.Paint(Shader=shader)
    canvas.drawRect(skia.Rect(0, 0, W, H), p)


# --------------------------------------------------------------------------
# Typography
# --------------------------------------------------------------------------
def draw_text(canvas, text, x, y, size, key="serif_cn", color=WHITE, a=1.0, align="center",
              tracking=0.0, blur=0.0, glow=0.0, glow_color=None, per_char=None, blend=None,
              stroke=None):
    """Draw a single line of text with per-character fallback fonts.

    per_char(i, n) -> (alpha, dx, dy, blur, scale) lets callers animate glyphs.
    Returns the drawn width.
    """
    if a <= 0.003 or not text:
        return 0.0
    n = len(text)
    advs = [char_advance(key, size, ch) for ch in text]
    total = sum(advs) + tracking * size * (n - 1)
    if align == "center":
        x0 = x - total / 2
    elif align == "right":
        x0 = x - total
    else:
        x0 = x
    cx = x0
    gcol = glow_color if glow_color is not None else color
    for i, ch in enumerate(text):
        adv = advs[i]
        if ch != " ":
            ca, dx, dy, cb, cs = a, 0.0, 0.0, blur, 1.0
            if per_char is not None:
                pa, dx, dy, pb, cs = per_char(i, n)
                ca = a * pa
                cb = blur + pb
            if ca > 0.003:
                k = _font_for_char(key, ch)
                f = font(k, size * cs) if cs != 1.0 else font(k, size)
                px = cx + dx + adv * (1 - cs) / 2
                py = y + dy
                if glow > 0:
                    canvas.drawString(ch, px, py, f, paint(gcol, 0.6 * ca, blur=glow, blend="add"))
                p = paint(color, ca, blur=cb, blend=blend, stroke=stroke)
                canvas.drawString(ch, px, py, f, p)
        cx += adv + tracking * size
    return total


def reveal_chars(t, t0, dur=0.6, stagger=0.05, rise=18.0, blur0=10.0, order=None):
    """Factory for a per_char animator that reveals glyphs one after another."""

    def fn(i, n):
        k = i if order is None else order(i, n)
        x = seg(t, t0 + k * stagger, t0 + k * stagger + dur)
        e = ease_out_cubic(x)
        return (smooth(x), 0.0, (1 - e) * rise, (1 - e) * blur0, 1.0)

    return fn


SUPPRESS_CAPTIONS = False  # set by the finale montage when re-rendering earlier scenes


def caption(canvas, t, t0, t1, cn, en=None, y=930, size=46, key="serif_cn_semibold",
            color=CREAM, en_color=None, fade=0.45, stagger=0.035, glow=0.0, en_size=21, shadow=True):
    """Cinematic caption: Chinese line with per-character reveal + English sub-line."""
    if SUPPRESS_CAPTIONS or t < t0 - 0.01 or t > t1 + 0.01:
        return
    out = 1 - smooth(seg(t, t1 - fade, t1))
    if out <= 0:
        return
    if shadow:
        draw_text(canvas, cn, W / 2, y + 2, size, key, "#000000", a=out * 0.75, tracking=0.08, blur=7,
                  per_char=reveal_chars(t, t0, dur=0.55, stagger=stagger, rise=12, blur0=8))
    draw_text(canvas, cn, W / 2, y, size, key, color, a=out, tracking=0.08,
              per_char=reveal_chars(t, t0, dur=0.55, stagger=stagger, rise=12, blur0=8), glow=glow)
    if en:
        ea = smooth(seg(t, t0 + 0.25, t0 + 0.9)) * out
        draw_text(canvas, en.upper(), W / 2, y + size * 0.95 + 12, en_size, "inter_light",
                  en_color or mix(color, INK, 0.2), a=ea * 0.9, tracking=0.28)


def title_block(canvas, t, t0, t1, cn, en=None, y=H / 2, size=120, key="serif_cn_bold",
                color=CREAM, glow=18.0, tracking=0.35, en_size=26, fade=0.6, en_gap=None):
    if t < t0 - 0.01 or t > t1 + 0.01:
        return
    out = 1 - smooth(seg(t, t1 - fade, t1))
    p = seg(t, t0, t0 + 1.2)
    spread = lerp(0.6, 0.0, ease_out_cubic(p))
    draw_text(canvas, cn, W / 2, y, size, key, color, a=out, tracking=tracking + spread,
              per_char=reveal_chars(t, t0, dur=0.9, stagger=0.09, rise=0, blur0=24), glow=glow)
    if en:
        ea = smooth(seg(t, t0 + 0.5, t0 + 1.4)) * out
        gap = en_gap if en_gap is not None else size * 0.55 + 20
        draw_text(canvas, en.upper(), W / 2, y + gap, en_size, "inter_light",
                  mix(color, INK, 0.25), a=ea * 0.9, tracking=0.5)


# --------------------------------------------------------------------------
# Math typesetting (matplotlib mathtext -> skia image)
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=256)
def math_image(tex, size=48, scale=1.0):
    """Render a mathtext string to a white-on-transparent skia.Image.

    ``size`` is the font size in design pixels; the image is produced at the
    output scale so it stays crisp.  Returns (image, width, height) where width
    and height are in design pixels.
    """
    import matplotlib
    matplotlib.use("Agg")
    from matplotlib import mathtext
    from matplotlib.font_manager import FontProperties
    import io

    matplotlib.rcParams["mathtext.fontset"] = "cm"
    dpi = 72 * scale * 2  # supersample x2 for quality
    prop = FontProperties(size=size)
    buf = io.BytesIO()
    mathtext.math_to_image(tex, buf, prop=prop, dpi=dpi, format="png", color="black")
    buf.seek(0)
    arr = cv2.imdecode(np.frombuffer(buf.getvalue(), np.uint8), cv2.IMREAD_COLOR)
    # black ink on white paper -> coverage mask
    a = 255 - arr.min(axis=2)
    a = cv2.resize(a, (max(1, a.shape[1] // 2), max(1, a.shape[0] // 2)), interpolation=cv2.INTER_AREA)
    rgba = np.zeros(a.shape + (4,), np.uint8)
    rgba[..., 0] = a
    rgba[..., 1] = a
    rgba[..., 2] = a
    rgba[..., 3] = a  # premultiplied white
    img = skia.Image.fromarray(np.ascontiguousarray(rgba), colorType=skia.kRGBA_8888_ColorType,
                               alphaType=skia.kPremul_AlphaType)
    return img, a.shape[1] / scale, a.shape[0] / scale


def draw_math(canvas, tex, x, y, size=48, color=WHITE, a=1.0, align="center", glow=0.0, frame_scale=1.0,
              blur=0.0, valign="center"):
    """Draw a mathtext formula; (x, y) is the anchor (centre by default)."""
    if a <= 0.003:
        return 0, 0
    img, w, h = math_image(tex, size, frame_scale)
    if align == "center":
        x0 = x - w / 2
    elif align == "right":
        x0 = x - w
    else:
        x0 = x
    y0 = y - h / 2 if valign == "center" else y
    rect = skia.Rect.MakeXYWH(x0, y0, w, h)
    cf = skia.ColorFilters.Blend(c4(color, 1.0).toColor(), skia.BlendMode.kModulate)
    if glow > 0:
        p = skia.Paint(ColorFilter=cf, AntiAlias=True)
        p.setAlphaf(0.6 * a)
        p.setImageFilter(skia.ImageFilters.Blur(glow, glow))
        p.setBlendMode(skia.BlendMode.kPlus)
        canvas.drawImageRect(img, rect, skia.SamplingOptions(skia.FilterMode.kLinear), p)
    p = skia.Paint(ColorFilter=cf, AntiAlias=True)
    p.setAlphaf(a)
    if blur > 0:
        p.setImageFilter(skia.ImageFilters.Blur(blur, blur))
    canvas.drawImageRect(img, rect, skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear), p)
    return w, h


# --------------------------------------------------------------------------
# Post processing
# --------------------------------------------------------------------------
def bloom(rgb, strength=0.6, threshold=0.55, radius=1.0):
    """Multi-scale bloom on a float RGB image."""
    h, w = rgb.shape[:2]
    bright = np.maximum(rgb - threshold, 0.0)
    acc = np.zeros_like(rgb)
    small = cv2.resize(bright, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    weights = (0.35, 0.3, 0.22, 0.13)
    lvl = small
    for i, wgt in enumerate(weights):
        sig = 2.0 * radius * (2 ** i) * (w / 1920.0) + 0.5
        lvl = cv2.resize(lvl, (max(1, lvl.shape[1] // 2), max(1, lvl.shape[0] // 2)),
                         interpolation=cv2.INTER_AREA) if i > 0 else lvl
        b = cv2.GaussianBlur(lvl, (0, 0), sig)
        acc += wgt * cv2.resize(b, (w, h), interpolation=cv2.INTER_LINEAR)
    return rgb + strength * acc * 2.2


@functools.lru_cache(maxsize=4)
def _vignette(w, h, strength):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (x / w - 0.5) * 2
    ny = (y / h - 0.5) * 2
    r2 = nx * nx * 0.8 + ny * ny * 1.0
    v = 1.0 - strength * np.clip(r2, 0, 2) ** 1.4 * 0.5
    return v[..., None].astype(np.float32)


def finish(rgb, frame_index=0, bloom_strength=0.5, bloom_threshold=0.6, vignette=0.55, grain=0.012):
    """Bloom + vignette + grain + dither, returns uint8 RGB."""
    if bloom_strength > 0:
        rgb = bloom(rgb, bloom_strength, bloom_threshold)
    h, w = rgb.shape[:2]
    if vignette > 0:
        rgb = rgb * _vignette(w, h, vignette)
    # soft shoulder tone map to keep highlights from clipping harshly
    rgb = np.where(rgb > 0.8, 0.8 + (1 - np.exp(-(rgb - 0.8) * 5)) * 0.2, rgb)
    if grain > 0:
        rng = np.random.default_rng(frame_index * 7919 + 17)
        n = rng.standard_normal((h, w, 1), dtype=np.float32) * (grain * 0.6)
        rgb = rgb + n
    rgb = rgb * 255.0 + np.random.default_rng(frame_index).random((h, w, 1), dtype=np.float32) - 0.5
    return np.clip(rgb, 0, 255).astype(np.uint8)
