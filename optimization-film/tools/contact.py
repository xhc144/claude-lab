"""把某个场景视频在每段旁白结尾处的画面拼成一张缩略图，用来快速检查构图。

    python tools/contact.py S0 build/media/videos/s0_intro/480p15/S0.mp4 [frac]
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
name, video = sys.argv[1], sys.argv[2]
frac = float(sys.argv[3]) if len(sys.argv) > 3 else 0.97
segs = json.loads((ROOT / "build" / "timing" / f"{name}.json").read_text())["segments"]
tiles = []
with tempfile.TemporaryDirectory() as td:
    for s in segs:
        t = s["start"] + s["dur"] * frac
        out = Path(td) / f"{s['id']}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1",
                        "-vf", "scale=640:-1", str(out)], check=True)
        im = Image.open(out).convert("RGB")
        ImageDraw.Draw(im).text((8, 6), f"{s['id']} @{t:.1f}s", fill=(255, 80, 80))
        tiles.append(im)
cols = 3
w, h = tiles[0].size
sheet = Image.new("RGB", (cols * w, ((len(tiles) + cols - 1) // cols) * h), (40, 40, 40))
for i, im in enumerate(tiles):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
dst = ROOT / "build" / f"contact_{name}.png"
sheet.save(dst)
print(dst)
