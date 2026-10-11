#!/usr/bin/env python3
"""Cut the film: grade each shot's HDR frames, join them, add the title and
the soundtrack, and encode the final video.

  python edit.py --out out/the_sea_above.mp4 --audio out/score.wav
  python edit.py --w 960 --out out/edit_preview.mp4      # from lower-res frames
"""
import argparse
import os
import subprocess
import sys
import time
from multiprocessing import Pool

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from engine import post                 # noqa: E402
from engine.camera import smoothstep    # noqa: E402
from shots.base import FPS              # noqa: E402

# shot, start time in the film (s); a shot may overlap the previous one to dissolve
EDIT = [
    dict(shot="s1_drop", at=0.0),
    dict(shot="s3_cross", at=24.0),
    dict(shot="s4_above", at=33.0),
    dict(shot="s5_return", at=56.0, dissolve=1.0),
]
TITLE_AT = 64.4          # title fades in over the last image
FADE_OUT = (65.6, 68.0)  # the picture fades to black under the title
TOTAL = 71.0

FONT_DIR = "/usr/share/fonts/opentype/noto"

_shots = {}


def shot_obj(name):
    if name not in _shots:
        import render
        _shots[name] = render.get_shot(name)
    return _shots[name]


def make_title(w=1920, h=1080):
    """Title card as two RGBA layers (Chinese title, English subtitle)."""
    zh = ImageFont.truetype(f"{FONT_DIR}/NotoSerifCJK-Light.ttc", 78, index=2)
    en = ImageFont.truetype(f"{FONT_DIR}/NotoSerifCJK-ExtraLight.ttc", 23, index=2)
    layers = []
    for text, font, spacing, y, col in (("倒悬之海", zh, 46, 486, (246, 238, 224)),
                                         ("THE  SEA  ABOVE", en, 11, 590, (214, 206, 192))):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        widths = [d.textbbox((0, 0), ch, font=font)[2] for ch in text]
        total = sum(widths) + spacing * (len(text) - 1)
        x = (w - total) / 2
        for ch, cw in zip(text, widths):
            d.text((x, y), ch, font=font, fill=col + (255,))
            x += cw + spacing
        # a faint glow behind the letters
        a = np.asarray(img).astype(np.float32) / 255.0
        glow = cv2.GaussianBlur(a[..., 3], (0, 0), 9) * 0.35
        layers.append((a[..., :3], np.maximum(a[..., 3], glow)))
    return layers


_title = None


def graded(entry, t_film, w):
    """Display-referred frame of one shot at a film time, or None if missing."""
    shot = shot_obj(entry["shot"])
    ts = t_film - entry["at"]
    f = int(round(ts * FPS))
    f = min(max(f, 0), shot.frame_count() - 1)
    path = os.path.join(ROOT, "cache", f"w{w}", entry["shot"], f"{f:05d}.png")
    if not os.path.exists(path):
        return None
    hdr = post.load_hdr(path)
    return post.finish(hdr, f, shot.post_at(f / FPS))


def frame_at(fi, w):
    global _title
    t = fi / FPS
    imgs = []
    for k, e in enumerate(EDIT):
        dur = shot_obj(e["shot"]).duration
        if e["at"] <= t < e["at"] + dur:
            imgs.append((k, e))
    out = None
    if imgs:
        if len(imgs) == 2:
            (ka, ea), (kb, eb) = imgs
            wgt = smoothstep(eb["at"], eb["at"] + eb.get("dissolve", 0.5), t)
            a = graded(ea, t, w)
            b = graded(eb, t, w)
            if a is not None and b is not None:
                # dissolve through a gentle bloom of light
                out = a * (1 - wgt) + b * wgt
                out = out + (1.0 - out) * 0.18 * np.sin(np.pi * wgt)
            else:
                out = a if a is not None else b
        else:
            out = graded(imgs[0][1], t, w)
    if out is None:
        out = np.zeros((int(round(w / (1920 / 816) / 2) * 2), w, 3), np.float32)
    # fade to black under the title
    out = out * (1.0 - smoothstep(*FADE_OUT, t))
    img8 = post.letterbox(post.to_uint8(out, fi))
    if t >= TITLE_AT:
        if _title is None:
            _title = make_title()
        res = img8.astype(np.float32) / 255.0
        for i, (rgb, alpha) in enumerate(_title):
            t0 = TITLE_AT + 0.9 * i
            a = smoothstep(t0, t0 + 1.6, t) * (1.0 - smoothstep(TOTAL - 2.2, TOTAL - 0.6, t))
            res = res * (1 - alpha[..., None] * a) + rgb * alpha[..., None] * a
        img8 = np.clip(res * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return img8


def _work(args):
    fi, w = args
    return fi, frame_at(fi, w).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--w", type=int, default=1920, help="width of the rendered frames to cut from")
    ap.add_argument("--out", default=os.path.join(ROOT, "out", "the_sea_above.mp4"))
    ap.add_argument("--audio", default=None)
    ap.add_argument("--crf", type=int, default=17)
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--t0", type=float, default=0.0)
    ap.add_argument("--t1", type=float, default=TOTAL)
    a = ap.parse_args()
    n0, n1 = int(round(a.t0 * FPS)), int(round(a.t1 * FPS))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1920x1080",
           "-r", str(FPS), "-i", "-"]
    if a.audio:
        cmd += ["-ss", f"{a.t0}", "-i", a.audio, "-c:a", "aac", "-b:a", "256k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf), "-tune", "film", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", a.out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    st = time.time()
    with Pool(a.jobs) as pool:
        for fi, buf in pool.imap(_work, [(f, a.w) for f in range(n0, n1)], chunksize=2):
            proc.stdin.write(buf)
            if fi % 24 == 0:
                print(f"\rframe {fi}/{n1}  {time.time() - st:.0f}s", end="", flush=True)
    proc.stdin.close()
    proc.wait()
    print(f"\nwrote {a.out}")


if __name__ == "__main__":
    main()
