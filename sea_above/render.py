#!/usr/bin/env python3
"""Render stills, shot frames, or the finished film.

  python render.py still s2_sea --t 3 5 8 --w 960 --spp 2
  python render.py frames s2_sea --w 1920 --spp 4            # HDR frames -> cache/
  python render.py film --out out/the_sea_above.mp4          # grade, edit, mux audio
"""
import argparse
import importlib
import os
import sys
import time

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from engine.gl import Renderer          # noqa: E402
from engine import post                 # noqa: E402
from shots.base import FPS              # noqa: E402

ASPECT = 1920 / 816                     # 2.35:1 scope


def get_shot(name):
    from shots import REGISTRY
    mod, cls = REGISTRY[name]
    return getattr(importlib.import_module(f"shots.{mod}"), cls)()


def size_for(w):
    w = int(w)
    return w, int(round(w / ASPECT / 2) * 2)


_renderers = {}


def renderer(w, h):
    if (w, h) not in _renderers:
        _renderers.clear()
        _renderers[(w, h)] = Renderer(w, h, tile_h=min(h, 272))
        _renderers[(w, h)].use_terrain()
    return _renderers[(w, h)]


def render_frame(shot, frame, w, spp=None):
    W, H = size_for(w)
    r = renderer(W, H)
    aa = W / 1920.0
    samples = shot.samples(frame, spp or shot.spp_for(frame), aa=1.0)
    rgb, invd = r.render(shot.shader, samples, defines=shot.defines)
    d = shot.dof(frame / FPS) if hasattr(shot, "dof") else None
    if d:
        scale = W / 1920.0
        rgb = r.dof(rgb, invd, d["focus"], d["k_px"] * scale, d.get("max_px", 64.0) * scale, d.get("taps", 192))
    return rgb, invd


def cmd_still(a):
    shot = get_shot(a.shot)
    if a.cam:
        from engine.camera import look_at
        c = a.cam
        shot.camera = lambda t: dict(pos=c[:3], rot=look_at(c[:3], c[3:6]), tanfov=a.fov)
    os.makedirs(os.path.join(ROOT, "out", "stills"), exist_ok=True)
    for t in a.t:
        frame = int(round(t * FPS))
        t0 = time.time()
        rgb, _ = render_frame(shot, frame, a.w, a.spp)
        dt = time.time() - t0
        img = post.finish(rgb, frame, shot.post_at(frame / FPS))
        name = os.path.join(ROOT, "out", "stills", f"{a.shot}_{t:06.2f}{a.tag}.png")
        post.save_hdr(name.replace(".png", ".hdr16.png"), rgb)
        cv2.imwrite(name, cv2.cvtColor(post.to_uint8(img, frame), cv2.COLOR_RGB2BGR))
        print(f"{name}  render {dt:.1f}s  (mean {rgb.mean():.3f}, max {rgb.max():.1f})", flush=True)


def cmd_frames(a):
    shot = get_shot(a.shot)
    d = os.path.join(ROOT, "cache", f"w{a.w}", a.shot)
    os.makedirs(d, exist_ok=True)
    n = shot.frame_count()
    f0 = a.start or 0
    f1 = min(a.end if a.end is not None else n, n)
    frames = list(range(f0, f1, a.step))
    if a.shard is not None:
        k, m = a.shard
        frames = frames[k::m]
    t_start = time.time()
    done = 0
    for f in frames:
        path = os.path.join(d, f"{f:05d}.png")
        if os.path.exists(path) and not a.force:
            continue
        t0 = time.time()
        rgb, _ = render_frame(shot, f, a.w, a.spp)
        post.save_hdr(path + ".tmp.png", rgb)
        os.replace(path + ".tmp.png", path)
        done += 1
        el = time.time() - t_start
        print(f"{a.shot} {f}/{n}  {time.time() - t0:.1f}s  (avg {el / done:.1f}s)", flush=True)


def cmd_preview(a):
    """Quick low-resolution motion check written straight to an mp4."""
    import subprocess
    shot = get_shot(a.shot)
    W, H = size_for(a.w)
    t0 = a.t0 or 0.0
    t1 = min(a.t1 or shot.duration, shot.duration)
    out = a.out or os.path.join(ROOT, "out", f"preview_{a.shot}.mp4")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fps = FPS / a.step
    proc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                             "-s", f"{W}x{H}", "-r", f"{fps}", "-i", "-", "-c:v", "libx264", "-crf", "20",
                             "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    f0, f1 = int(round(t0 * FPS)), int(round(t1 * FPS))
    st = time.time()
    for f in range(f0, f1, a.step):
        rgb, _ = render_frame(shot, f, a.w, a.spp)
        img = post.finish(rgb, f, shot.post_at(f / FPS))
        proc.stdin.write(post.to_uint8(img, f).tobytes())
        print(f"\r{a.shot} frame {f}/{f1}  {time.time() - st:.0f}s", end="", flush=True)
    proc.stdin.close()
    proc.wait()
    print(f"\nwrote {out}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("still")
    s.add_argument("shot")
    s.add_argument("--t", type=float, nargs="+", default=[0.0])
    s.add_argument("--w", type=int, default=960)
    s.add_argument("--spp", type=int, default=None)
    s.add_argument("--tag", default="")
    s.add_argument("--cam", type=float, nargs=6, default=None, help="x y z tx ty tz")
    s.add_argument("--fov", type=float, default=0.4, help="tan(vfov/2) with --cam")
    s.set_defaults(fn=cmd_still)
    f = sub.add_parser("frames")
    f.add_argument("shot")
    f.add_argument("--w", type=int, default=1920)
    f.add_argument("--spp", type=int, default=None)
    f.add_argument("--start", type=int, default=None)
    f.add_argument("--end", type=int, default=None)
    f.add_argument("--step", type=int, default=1)
    f.add_argument("--shard", type=int, nargs=2, default=None)
    f.add_argument("--force", action="store_true")
    f.set_defaults(fn=cmd_frames)
    v = sub.add_parser("preview")
    v.add_argument("shot")
    v.add_argument("--w", type=int, default=480)
    v.add_argument("--spp", type=int, default=1)
    v.add_argument("--step", type=int, default=2)
    v.add_argument("--t0", type=float, default=None)
    v.add_argument("--t1", type=float, default=None)
    v.add_argument("--out", default=None)
    v.set_defaults(fn=cmd_preview)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
