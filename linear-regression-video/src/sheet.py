"""把一个场景每句旁白快结束时的画面拼成一张缩略图，检查构图。

python sheet.py 场景名 [pv|preview|hd] → build/sheets/<场景>.png
"""
import glob, json, os, subprocess, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(os.path.dirname(HERE), "build")
cls = sys.argv[1]
res = {"pv": "270p30", "fast": "270p6", "preview": "540p30", "hd": "1080p30"}[sys.argv[2] if len(sys.argv) > 2 else "pv"]
mp4 = max(glob.glob(os.path.join(BUILD, "media", cls, "videos", "*", res, f"{cls}.mp4")), key=os.path.getmtime)
log = json.load(open(os.path.join(BUILD, "timing", f"{cls}.json")))
shots = [(ln["key"], ln["t"] + ln["dur"] * 0.92) for ln in log["lines"]] + [("end", log["duration"] - 0.05)]
tiles = []
for key, t in shots:
    out = f"/tmp/_sheet_{cls}_{key}.png"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", mp4, "-frames:v", "1", out], check=True)
    im = Image.open(out).convert("RGB")
    ImageDraw.Draw(im).text((6, 4), key, fill=(200, 0, 0))
    tiles.append(im)
w, h = tiles[0].size
cols = 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "white")
for i, im in enumerate(tiles):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
os.makedirs(os.path.join(BUILD, "sheets"), exist_ok=True)
path = os.path.join(BUILD, "sheets", f"{cls}.png")
sheet.save(path)
print(path)
