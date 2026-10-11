"""Film finishing: bloom, AgX tone mapping, grading, lens effects, grain."""
import cv2
import numpy as np

# ---------------------------------------------------------------- HDR storage
# Scene-linear HDR is stored losslessly enough in 16-bit PNGs with a log curve
# (about 2500 code values per stop over 26 stops).
_LOG_MIN, _LOG_SPAN = -14.0, 26.0


def encode_hdr(rgb):
    v = (np.log2(np.maximum(rgb, 2.0 ** _LOG_MIN)) - _LOG_MIN) / _LOG_SPAN
    return np.clip(np.round(v * 65535.0), 0, 65535).astype(np.uint16)[..., ::-1]


def decode_hdr(png16):
    v = png16[..., ::-1].astype(np.float32) / 65535.0
    x = np.exp2(v * _LOG_SPAN + _LOG_MIN)
    x[png16[..., ::-1] == 0] = 0.0
    return x


def save_hdr(path, rgb):
    cv2.imwrite(path, encode_hdr(rgb), [cv2.IMWRITE_PNG_COMPRESSION, 1])


def load_hdr(path):
    return decode_hdr(cv2.imread(path, cv2.IMREAD_UNCHANGED))


# ---------------------------------------------------------------- AgX
_AGX = np.array([[0.842479062253094, 0.0423282422610123, 0.0423756549057051],
                 [0.0784335999999992, 0.878468636469772, 0.0784336],
                 [0.0792237451477643, 0.0791661274605434, 0.879142973793104]], np.float32)
_AGX_INV = np.array([[1.19687900512017, -0.0528968517574562, -0.0529716355144438],
                     [-0.0980208811401368, 1.15190312990417, -0.0980434501171241],
                     [-0.0990297440797205, -0.0989611768448433, 1.15107367264116]], np.float32)
_MIN_EV, _MAX_EV = -12.47393, 4.026069


def agx(rgb, punch=0.0):
    v = rgb.reshape(-1, 3) @ _AGX
    v = np.log2(np.maximum(v, 1e-10))
    v = np.clip((v - _MIN_EV) / (_MAX_EV - _MIN_EV), 0.0, 1.0)
    x2 = v * v
    x4 = x2 * x2
    v = (15.5 * x4 * x2 - 40.14 * x4 * v + 31.96 * x4 - 6.868 * x2 * v + 0.4298 * x2 + 0.1191 * v - 0.00232)
    if punch:
        # AgX "punchy"-style look: slight extra contrast and saturation
        v = np.maximum(v, 0.0) ** (1.0 + 0.35 * punch)
        lum = v @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        v = lum[:, None] + (v - lum[:, None]) * (1.0 + 0.4 * punch)
    v = v @ _AGX_INV
    return np.clip(v, 0.0, 1.0).reshape(rgb.shape)


# ---------------------------------------------------------------- bloom
def bloom(rgb, levels=7, base_sigma=1.2):
    """Multi-scale glow: a sum of increasingly blurred copies."""
    h, w = rgb.shape[:2]
    acc = np.zeros_like(rgb)
    cur = rgb
    wsum = 0.0
    for i in range(levels):
        cur = cv2.pyrDown(cur)
        b = cv2.GaussianBlur(cur, (0, 0), base_sigma)
        wgt = 1.0 / (1.0 + 0.35 * i)
        acc += cv2.resize(b, (w, h), interpolation=cv2.INTER_LINEAR) * wgt
        wsum += wgt
    return acc / wsum


# ---------------------------------------------------------------- grading
def _smooth(x):
    return x * x * (3 - 2 * x)


def grade(img, g):
    """img: display-referred 0..1. g: dict of grading parameters."""
    lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lum = lum[..., None]
    sat = g.get("saturation", 1.0)
    if sat != 1.0:
        img = lum + (img - lum) * sat
    con = g.get("contrast", 0.0)
    if con:
        s = _smooth(np.clip(img, 0, 1))
        img = img + (s - img) * con
    lift = np.array(g.get("lift", (0, 0, 0)), np.float32)
    gamma = np.array(g.get("gamma", (1, 1, 1)), np.float32)
    gain = np.array(g.get("gain", (1, 1, 1)), np.float32)
    img = np.clip(img * gain + lift * (1 - img), 0, 1) ** (1.0 / gamma)
    sh = g.get("shadow_tint")
    hi = g.get("highlight_tint")
    if sh is not None or hi is not None:
        lum = (img @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
        if sh is not None:
            img = img + np.array(sh, np.float32) * (1 - lum) ** 2
        if hi is not None:
            img = img + np.array(hi, np.float32) * lum ** 2
    return np.clip(img, 0, 1)


def chroma_shift(img, amount):
    if amount <= 0:
        return img
    h, w = img.shape[:2]
    out = img.copy()
    for ch, k in ((0, amount), (2, -amount)):
        z = 1.0 + k
        M = np.array([[z, 0, (1 - z) * w / 2], [0, z, (1 - z) * h / 2]], np.float32)
        out[..., ch] = cv2.warpAffine(img[..., ch], M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return out


def vignette(img, strength, roundness=1.0):
    h, w = img.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    x = (x / w - 0.5) * 2
    y = (y / h - 0.5) * 2 * (h / w) * roundness * 1.6
    r2 = x * x + y * y
    v = 1.0 - strength * np.clip(r2 * 0.6, 0, 1) ** 1.3
    return img * v[..., None]


_grain_cache = {}


def grain(img, amount, frame, size=1.1):
    if amount <= 0:
        return img
    h, w = img.shape[:2]
    rng = np.random.default_rng(1234 + frame)
    n = rng.standard_normal((h, w)).astype(np.float32)
    n = cv2.GaussianBlur(n, (0, 0), size * 0.6)
    n /= max(n.std(), 1e-6)
    lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    # grain is strongest in the mid-tones, like film
    k = amount * (0.35 + 1.3 * lum * (1 - lum))
    return np.clip(img + (n * k)[..., None], 0, 1)


DEFAULT = dict(exposure=0.0, bloom=0.06, bloom_threshold=0.0, punch=0.4,
               saturation=1.0, contrast=0.0, vignette=0.25, chroma=0.0012, grain=0.018)


def finish(hdr, frame, params=None):
    p = dict(DEFAULT)
    if params:
        p.update(params)
    x = hdr * (2.0 ** p["exposure"])
    if p["bloom"] > 0:
        src = x if p["bloom_threshold"] <= 0 else np.maximum(x - p["bloom_threshold"], 0)
        b = bloom(src)
        tint = np.array(p.get("bloom_tint", (1, 1, 1)), np.float32)
        x = x * (1 - p["bloom"]) + b * p["bloom"] * tint
    img = agx(x, p["punch"])
    img = grade(img, p)
    img = chroma_shift(img, p["chroma"])
    img = vignette(img, p["vignette"])
    img = grain(img, p["grain"], frame)
    return img


def to_uint8(img, frame=0):
    rng = np.random.default_rng(99 + frame)
    d = rng.random(img.shape[:2], dtype=np.float32)[..., None] - 0.5
    return np.clip(img * 255.0 + d, 0, 255).astype(np.uint8)


def letterbox(img8, out_w=1920, out_h=1080):
    h, w = img8.shape[:2]
    if (w, h) != (out_w, int(round(out_w * h / w))):
        img8 = cv2.resize(img8, (out_w, int(round(out_w * h / w))), interpolation=cv2.INTER_AREA)
        h, w = img8.shape[:2]
    out = np.zeros((out_h, out_w, 3), np.uint8)
    y0 = (out_h - h) // 2
    out[y0:y0 + h] = img8
    return out
