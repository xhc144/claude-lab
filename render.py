#!/usr/bin/env python3
"""Render the film (or parts of it).

Examples
--------
  python render.py stills --scene galois --times 1 5 9 13          # PNG stills
  python render.py video --scale 0.5 --out output/preview.mp4       # quick preview
  python render.py video --scale 1 --out output/final.mp4           # full quality
  python render.py video --from 50 --to 70 --scale 0.5              # a time range
"""
import argparse
import os
import subprocess
import sys
import time
from multiprocessing import Pool

import cv2
import numpy as np

from studio.core import FPS, H, W, finish
from studio import timeline

ROOT = os.path.dirname(os.path.abspath(__file__))


def punch(rgb, k):
    """Impact: brief zoom punch + chromatic aberration."""
    h, w = rgb.shape[:2]
    out = np.empty_like(rgb)
    for ch, extra in ((0, 0.006), (1, 0.0), (2, -0.006)):
        z = 1.0 + 0.035 * k + extra * k
        M = np.array([[z, 0, (1 - z) * w / 2], [0, z, (1 - z) * h / 2]], np.float32)
        out[..., ch] = cv2.warpAffine(rgb[..., ch], M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return out


def render_global(t, scale, fi):
    rgb, post = timeline.render_at(t, scale)
    k = timeline.impact(t)
    if k > 0.01:
        rgb = punch(rgb, k)
    return finish(rgb, fi, bloom_strength=post["bloom"], bloom_threshold=post["bloom_threshold"],
                  vignette=post["vignette"], grain=post["grain"])


def _worker(args):
    fi, scale = args
    t = fi / FPS
    return fi, render_global(t, scale, fi).tobytes()


def prepare():
    """Build the cached simulations once, in the main process, before any worker starts."""
    from studio.scenes.s01_symmetry import FLAKE_PARAMS
    from studio.sims.littlewood import density
    from studio.sims.snowflake import freeze_field
    freeze_field(**FLAKE_PARAMS)
    density(22)


def cmd_stills(a):
    prepare()
    out = os.path.join(ROOT, "output", "stills")
    os.makedirs(out, exist_ok=True)
    for tt in a.times:
        if a.scene:
            sc = timeline.scene_by_name(a.scene)
            start = timeline.start_of(a.scene)
            t = start + tt
        else:
            t = tt
        t0 = time.time()
        fi = int(round(t * FPS))
        img = render_global(t, a.scale, fi)
        name = f"{a.scene or 'global'}_{tt:07.2f}.png"
        cv2.imwrite(os.path.join(out, name), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        print(f"{name}  {time.time() - t0:.2f}s", flush=True)


def cmd_video(a):
    prepare()
    total = timeline.total_duration()
    t_from = a.t_from or 0.0
    t_to = min(a.t_to or total, total)
    f0, f1 = int(round(t_from * FPS)), int(round(t_to * FPS))
    if a.step > 1:
        frames = list(range(f0, f1, a.step))
    else:
        frames = list(range(f0, f1))
    w, h = int(round(W * a.scale)), int(round(H * a.scale))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    fps_out = FPS / a.step
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
           "-r", f"{fps_out}", "-i", "-"]
    if a.audio and os.path.exists(a.audio):
        cmd += ["-ss", f"{t_from}", "-i", a.audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "256k",
                "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", a.preset, "-crf", str(a.crf), "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", a.out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    jobs = [(fi, a.scale) for fi in frames]
    done = 0
    with Pool(a.jobs) as pool:
        for fi, data in pool.imap(_worker, jobs, chunksize=1):
            proc.stdin.write(data)
            done += 1
            if done % 30 == 0 or done == len(jobs):
                el = time.time() - t0
                eta = el / done * (len(jobs) - done)
                print(f"[{done}/{len(jobs)}] t={fi / FPS:7.2f}s  elapsed {el:6.0f}s  eta {eta:6.0f}s", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", a.out, f"in {time.time() - t0:.0f}s")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("stills")
    s.add_argument("--scene", default=None)
    s.add_argument("--times", type=float, nargs="+", required=True)
    s.add_argument("--scale", type=float, default=0.5)
    s.set_defaults(fn=cmd_stills)
    v = sub.add_parser("video")
    v.add_argument("--scale", type=float, default=0.5)
    v.add_argument("--out", default=os.path.join(ROOT, "output", "preview.mp4"))
    v.add_argument("--from", dest="t_from", type=float, default=None)
    v.add_argument("--to", dest="t_to", type=float, default=None)
    v.add_argument("--step", type=int, default=1)
    v.add_argument("--jobs", type=int, default=os.cpu_count())
    v.add_argument("--crf", type=int, default=20)
    v.add_argument("--preset", default="medium")
    v.add_argument("--audio", default=None)
    v.set_defaults(fn=cmd_video)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
