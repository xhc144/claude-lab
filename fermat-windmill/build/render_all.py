"""Render every scene of one language version with manim, several scenes in parallel.

    python build/render_all.py zh [--jobs 4] [--quality h] [--only S07_Zagier S09_Path]

Output: render/media_<lang>/videos/<module>/1080p30/<Scene>.mp4 and render/<lang>/timeline/<Scene>.json
"""
import argparse
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build"))
from assemble import SCENES  # noqa: E402


def render(lang, mod, scene, quality):
    env = dict(os.environ, FW_LANG=lang, FW_FPS="30", OMP_NUM_THREADS="1")
    log = ROOT / "render" / lang / "logs"
    log.mkdir(parents=True, exist_ok=True)
    # each scene gets its own LaTeX directory: parallel renders sharing one would delete each other's files
    tex = ROOT / "render" / "tex" / lang / scene
    tex.mkdir(parents=True, exist_ok=True)
    cfg = tex / "manim.cfg"
    cfg.write_text(f"[CLI]\ntex_dir = {tex}\n")
    t = time.time()
    with open(log / f"{scene}.log", "w") as f:
        r = subprocess.run([sys.executable, "-m", "manim", f"-q{quality}", "--disable_caching", "-c", str(cfg),
                            "--media_dir", str(ROOT / "render" / f"media_{lang}"), str(ROOT / "anim" / f"{mod}.py"),
                            scene], env=env, cwd=ROOT / "anim", stdout=f, stderr=subprocess.STDOUT)
    status = "ok" if r.returncode == 0 else f"FAILED ({log / (scene + '.log')})"
    print(f"[{lang}] {scene}: {status} in {time.time() - t:.0f}s", flush=True)
    return r.returncode


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lang")
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--quality", default="h")
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    todo = [(m, s) for m, s in SCENES if not a.only or s in a.only]
    # longest scenes first so the pool finishes evenly
    order = {"S12_Interview": 0, "S07_Zagier": 1, "S10_General": 2, "S05_Set": 3}
    todo.sort(key=lambda ms: order.get(ms[1], 9))
    with ThreadPoolExecutor(a.jobs) as ex:
        codes = list(ex.map(lambda ms: render(a.lang, ms[0], ms[1], a.quality), todo))
    sys.exit(1 if any(codes) else 0)


if __name__ == "__main__":
    main()
