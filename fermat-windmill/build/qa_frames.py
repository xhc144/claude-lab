"""Contact sheet of frames from a finished film, sampled inside subtitle events.

    python build/qa_frames.py zh [n]      -> render/<lang>/qa_sheet.png
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
lang = sys.argv[1]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 12
ass = (ROOT / "render" / lang / "subs.ass").read_text(encoding="utf-8")
times = []
for line in ass.splitlines():
    m = re.match(r"Dialogue: \d,(\d+):(\d+):([\d.]+),(\d+):(\d+):([\d.]+),(Main|Q)", line)
    if m:
        a = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
        b = int(m[4]) * 3600 + int(m[5]) * 60 + float(m[6])
        times.append((a + b) / 2)
pick = [times[int(i * (len(times) - 1) / (n - 1))] for i in range(n)]
film = ROOT / "output" / f"fermat_windmill_{lang}.mp4"
out = ROOT / "render" / lang
frames = []
for i, t in enumerate(pick):
    fn = out / f"qa_{i:02d}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(film), "-frames:v", "1",
                    "-vf", "scale=960:-1", str(fn)], check=True)
    frames.append(fn)
cols = 3
args = []
for f in frames:
    args += ["-i", str(f)]
rows = (len(frames) + cols - 1) // cols
layout = "|".join(f"{(i % cols) * 960}_{(i // cols) * 540}" for i in range(len(frames)))
subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex",
                f"xstack=inputs={len(frames)}:layout={layout}", str(out / "qa_sheet.png")], check=True)
for f in frames:
    f.unlink()
print(out / "qa_sheet.png", [round(t, 1) for t in pick])
