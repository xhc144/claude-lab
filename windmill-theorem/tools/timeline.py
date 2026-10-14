"""Scene order and global timing shared by the subtitle, audio and assembly steps."""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "anim"))

SCENES = [
    ("scenes_a", "S00_Open"), ("scenes_a", "S01_History"), ("scenes_a", "S02_Statement"),
    ("scenes_a", "S03_Necessity"), ("scenes_a", "S04_Pairing"), ("scenes_a", "S05_SetSwap"),
    ("scenes_b", "S06_Windmill"), ("scenes_b", "S07_Proof"), ("scenes_b", "S08_Insight"),
    ("scenes_c", "S09_Beyond"), ("scenes_c", "S10_Interview"), ("scenes_c", "S11_Outro"),
]


def lang_config(lang):
    """Import anim/config.py for a given language (it reads WT_LANG at import time)."""
    os.environ["WT_LANG"] = lang
    for m in ("config",):
        sys.modules.pop(m, None)
    import config  # noqa: E402
    return config


def media_dir(lang):
    return ROOT / "build" / f"media_{lang}"


def scene_video(lang, module, scene, quality="1080p30"):
    # every scene renders into its own media dir so parallel jobs never share manim's Tex cache
    return media_dir(lang) / scene / "videos" / module / quality / f"{scene}.mp4"


def probe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def global_cues(lang, quality="1080p30"):
    """[(line_id, global_start, duration, scene)] plus total length and scene offsets."""
    cues, offsets, t = [], [], 0.0
    for module, scene in SCENES:
        cj = ROOT / "build" / "cues" / lang / f"{scene}.json"
        data = json.loads(cj.read_text(encoding="utf-8"))
        vid = scene_video(lang, module, scene, quality)
        dur = probe_duration(vid) if vid.exists() else data["duration"]
        offsets.append((scene, t, dur))
        for c in data["cues"]:
            cues.append((c["id"], t + c["t"], c["dur"], scene))
        t += dur
    return cues, t, offsets
