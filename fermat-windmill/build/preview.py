"""Low-quality render of one scene plus a contact sheet of frames, for quick checks.

    python build/preview.py scenes_a S01_Hook zh [every_seconds]
Writes render/preview/<lang>/<Scene>.mp4 and <Scene>_sheet.png
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
mod, scene = sys.argv[1], sys.argv[2]
lang = sys.argv[3] if len(sys.argv) > 3 else "zh"
every = float(sys.argv[4]) if len(sys.argv) > 4 else 4.0
out = ROOT / "render" / "preview" / lang
out.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, FW_LANG=lang, FW_FPS="15")
media = ROOT / "render" / f"media_preview_{lang}"
cmd = [sys.executable, "-m", "manim", "-ql", "--fps", "15", "--disable_caching", "--media_dir", str(media),
       "-o", scene, str(ROOT / "anim" / f"{mod}.py"), scene]
r = subprocess.run(cmd, env=env, cwd=ROOT / "anim", capture_output=True, text=True)
if r.returncode:
    print(r.stdout[-4000:], r.stderr[-6000:])
    sys.exit(1)
mp4 = next(media.glob(f"videos/{mod}/*/{scene}.mp4"))
dst = out / f"{scene}.mp4"
dst.write_bytes(mp4.read_bytes())
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                                     "csv=p=0", str(dst)]).decode())
n = max(1, int(dur // every))
cols = 4
rows = (n + cols - 1) // cols
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(dst), "-vf",
                f"fps=1/{every},scale=480:-1,drawtext=text='%{{pts\\:hms}}':x=6:y=6:fontsize=16:fontcolor=white,"
                f"tile={cols}x{rows}", "-frames:v", "1", str(out / f"{scene}_sheet.png")], check=True)
print(f"{scene}: {dur:.1f}s -> {out / (scene + '_sheet.png')}")
