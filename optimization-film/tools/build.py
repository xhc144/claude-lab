"""渲染全部场景并合成成片：画面 + 旁白 + 背景音乐 + 字幕。

    python tools/build.py            # 1080p60 正式版
    python tools/build.py --preview  # 480p15 预览版
    python tools/build.py --mux-only # 只重新合成（场景视频已渲染好）
"""
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
MANIM = os.environ.get("MANIM", str(Path(sys.executable).with_name("manim")))
PY = sys.executable

# 成片顺序：(场景文件, 场景类)
EDIT = [("s0_intro", "S0"), ("s1_extrema", "S1A"), ("s1_extrema", "S1B"), ("s1_extrema", "S1C"),
        ("s2_convex", "S2"), ("s3_gradient", "S3"), ("s4_lp", "S4"), ("s5_outro", "S5")]


def run(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def render(item, quality):
    mod, cls = item
    log = BUILD / f"render_{cls}.log"
    env = dict(os.environ, PYTHONPATH=str(ROOT / "scenes"))
    with open(log, "w") as f:
        subprocess.run([MANIM, f"-q{quality}", "--disable_caching", "--media_dir", str(BUILD / "media"),
                        str(ROOT / "scenes" / f"{mod}.py"), cls], check=True, stdout=f, stderr=subprocess.STDOUT,
                       env=env, cwd=ROOT)
    print(f"rendered {cls}", flush=True)


def video_path(item, quality):
    mod, cls = item
    sub = {"h": "1080p60", "l": "480p15", "m": "720p30"}[quality]
    return BUILD / "media" / "videos" / mod / sub / f"{cls}.mp4"


def duration(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


def chunks(text, limit=19):
    """按标点把一段旁白切成适合一行显示的小句。"""
    parts = re.findall(r"[^，。；：？！]+[，。；：？！]?", text)
    out, cur = [], ""
    for p in parts:
        if cur and len(cur) + len(p) > limit:
            out.append(cur)
            cur = p
        else:
            cur += p
    if cur:
        out.append(cur)
    res = []
    for c in out:                                   # 仍然过长的句子再硬切
        while len(c) > limit + 4:
            res.append(c[:limit])
            c = c[limit:]
        res.append(c)
    return [c.rstrip("，。；：") for c in res if c.strip("，。；：")]


def ass_time(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def write_subs(items, quality):
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK SC,50,&H00F5EDE9,&H00F5EDE9,&H00201310,&H96000000,0,0,0,0,100,100,1,0,1,2.8,0.8,2,80,80,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines, srt = [], []
    offset = 0.0
    n = 1
    for item in items:
        cls = item[1]
        timing = json.loads((BUILD / "timing" / f"{cls}.json").read_text())
        for seg in timing["segments"]:
            cs = chunks(seg["text"])
            total = sum(len(c) for c in cs)
            t = offset + seg["start"]
            for c in cs:
                dt = seg["dur"] * len(c) / total
                a, b = t, t + dt
                lines.append(f"Dialogue: 0,{ass_time(a)},{ass_time(b - 0.02)},Default,,0,0,0,,{c}")
                srt.append(f"{n}\n{srt_time(a)} --> {srt_time(b - 0.02)}\n{c}\n")
                n += 1
                t = b
        offset += duration(video_path(item, quality))
    (BUILD / "subs.ass").write_text(head + "\n".join(lines) + "\n")
    (BUILD / "subs.srt").write_text("\n".join(srt))
    return offset


def build_narration(items, quality, total, dst):
    """按各场景记录的帧精确时间，把每段旁白铺到整片的时间轴上。"""
    import numpy as np
    import soundfile as sf
    sr = 48000
    track = np.zeros(int((total + 1) * sr), dtype=np.float32)
    offset = 0.0
    for item in items:
        timing = json.loads((BUILD / "timing" / f"{item[1]}.json").read_text())
        for seg in timing["segments"]:
            x, r = sf.read(BUILD / "audio" / f"{seg['id']}.wav", dtype="float32")
            assert r == sr
            a = int(round((offset + seg["start"]) * sr))
            track[a:a + len(x)] += x
        offset += duration(video_path(item, quality))
    sf.write(dst, track, sr, subtype="PCM_16")


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    preview = "--preview" in sys.argv
    quality = "l" if preview else "h"
    BUILD.mkdir(exist_ok=True)
    if "--mux-only" not in sys.argv:
        run([PY, str(ROOT / "tools" / "tts.py")])
        with ThreadPoolExecutor(max_workers=int(os.environ.get("JOBS", "4"))) as ex:
            # 先提交最慢的三维场景和长场景
            order = sorted(EDIT, key=lambda it: {"S1B": 0, "S3": 1, "S2": 2, "S4": 3}.get(it[1], 9))
            list(ex.map(lambda it: render(it, quality), order))
    total = write_subs(EDIT, quality)
    lst = BUILD / "concat.txt"
    lst.write_text("".join(f"file '{video_path(it, quality)}'\n" for it in EDIT))
    narration = BUILD / "narration.wav"
    build_narration(EDIT, quality, total, narration)
    music = BUILD / "music.wav"
    run([PY, str(ROOT / "tools" / "music.py"), f"{total + 2:.1f}", str(music)])
    out_dir = ROOT / "output"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / ("preview.mp4" if preview else "optimization_essence_1080p.mp4")
    subs = str(BUILD / "subs.ass").replace(":", r"\:")
    scale = "scale=1920:1080:flags=bicubic," if preview else ""
    graph = (f"[0:v]{scale}subtitles='{subs}'[v];"
             "[1:a]asplit=2[nar][key];"
             "[2:a]volume=0.32[mus];"
             "[mus][key]sidechaincompress=threshold=0.015:ratio=5:attack=60:release=900[duck];"
             "[nar][duck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]")
    run(["ffmpeg", "-y", "-v", "error", "-stats", "-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(narration),
         "-i", str(music), "-filter_complex", graph, "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-preset", "slow", "-crf", "21" if not preview else "28", "-pix_fmt", "yuv420p",
         "-tune", "animation", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", str(out)])
    run(["cp", str(BUILD / "subs.srt"), str(out.with_suffix(".srt"))])
    print(f"done: {out}  ({duration(out) / 60:.1f} min, {out.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
