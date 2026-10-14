"""Assemble a finished film: scene videos + narration + music bed + subtitles.

    python build/assemble.py zh|en [--crf 24]

Reads   render/media_<lang>/videos/<module>/1080p30/<Scene>.mp4   (manim output)
        render/<lang>/timeline/<Scene>.json                       (segment start times)
        audio/<lang>/<segment>.wav, audio/<lang>/timing.json      (narration)
Writes  output/<name>_<lang>.mp4, output/<name>_<lang>.srt, render/<lang>/subs.ass
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scriptlib as SL  # noqa: E402

ROOT = SL.ROOT
SR = 48000
NAME = "fermat_windmill"
SCENES = [("scenes_a", "S01_Hook"), ("scenes_a", "S02_Statement"), ("scenes_a", "S03_Easy"),
          ("scenes_a", "S04_Parity"), ("scenes_a", "S05_Set"), ("scenes_b", "S06_Windmill"),
          ("scenes_b", "S07_Zagier"), ("scenes_b", "S08_Why"), ("scenes_b", "S09_Path"),
          ("scenes_c", "S10_General"), ("scenes_c", "S11_Apps"), ("scenes_c", "S12_Interview"),
          ("scenes_c", "S13_Outro")]


def probe_duration(fn: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(fn)]).decode())


def scene_video(lang, mod, scene, quality):
    d = ROOT / "render" / f"media_{lang}" / "videos" / mod / quality
    return d / f"{scene}.mp4"


# ------------------------------------------------------------------ audio
def load_wav(fn: Path) -> np.ndarray:
    x, sr = sf.read(fn, dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        from scipy.signal import resample_poly
        x = resample_poly(x, SR, sr).astype(np.float32)
    return x


def music_bed(total: float, seed=3) -> np.ndarray:
    """A quiet evolving pad: Am - F - C - G, slow attacks, low-passed, plus rare soft bells."""
    n = int(total * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)
    chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
    bar = 8.0
    f = lambda m: 440.0 * 2 ** ((m - 69) / 12)  # noqa: E731
    k = 0
    start = 0.0
    while start < total:
        ch = chords[k % 4]
        a, b = int(start * SR), min(n, int((start + bar + 3.0) * SR))
        tt = t[a:b] - start
        env = np.minimum(1, tt / 2.5) * np.minimum(1, np.maximum(0, (bar + 3.0 - tt) / 3.0))
        sig = np.zeros(b - a, np.float32)
        for m in ch:
            for det in (-0.12, 0.0, 0.11):
                fr = f(m - 12) * (1 + det / 100)
                ph = (2 * np.pi * fr * tt).astype(np.float32)
                sig += np.sin(ph + det * 7) * 0.5 + 0.18 * np.sin(2 * ph)
        out[a:b] += (sig * env).astype(np.float32)
        start += bar
        k += 1
    rng = np.random.default_rng(seed)
    for s in np.arange(4.0, total - 3, 11.0):
        m = rng.choice([76, 79, 81, 84, 88])
        a = int(s * SR)
        b = min(n, a + int(3.5 * SR))
        tt = t[a:b] - s
        out[a:b] += (0.6 * np.sin(2 * np.pi * f(m) * tt) * np.exp(-tt * 1.6)).astype(np.float32)
    sos = butter(4, 1800, "lowpass", fs=SR, output="sos")
    out = sosfilt(sos, out).astype(np.float32)
    return out / (np.abs(out).max() + 1e-9)


def chime(dur=2.2) -> np.ndarray:
    t = np.arange(int(dur * SR)) / SR
    x = sum(np.sin(2 * np.pi * fr * t) * w for fr, w in [(659.25, 0.6), (987.77, 0.35), (1318.5, 0.2)])
    return (x * np.exp(-t * 2.4) * np.minimum(1, t / 0.01)).astype(np.float32)


def moving_average(x: np.ndarray, k: int) -> np.ndarray:
    c = np.concatenate([[0.0], np.cumsum(x, dtype=np.float64)])
    h = k // 2
    i = np.arange(len(x))
    a = np.clip(i - h, 0, len(x))
    b = np.clip(i + k - h, 0, len(x))
    return ((c[b] - c[a]) / k).astype(np.float32)


def build_audio(lang, placements, total, chimes) -> np.ndarray:
    n = int((total + 1.0) * SR)
    voice = np.zeros(n, np.float32)
    for start, fn in placements:
        x = load_wav(fn)
        a = int(start * SR)
        b = min(n, a + len(x))
        voice[a:b] += x[: b - a]
    # loudness: bring active speech to about -19 dBFS RMS, then soft-limit the peaks
    active = np.abs(voice) > 0.02
    rms = np.sqrt(np.mean(voice[active] ** 2)) if active.any() else 0.0
    if rms > 0:
        voice *= 10 ** (-19 / 20) / rms
    voice = np.where(np.abs(voice) > 0.8, np.sign(voice) * (0.8 + 0.2 * np.tanh((np.abs(voice) - 0.8) / 0.2)), voice)
    # ducking envelope from narration activity (moving averages via cumulative sums: O(n))
    act = (moving_average(np.abs(voice), int(0.05 * SR)) > 0.01).astype(np.float32)
    env = np.clip(moving_average(act, int(0.6 * SR)) * 1.6, 0, 1)
    mus = music_bed(total + 1.0)[:n]
    level = 10 ** (-29 / 20) * (1 - env) + 10 ** (-37 / 20) * env
    mix = voice + mus * level
    ch = chime()
    for s in chimes:
        a = int(s * SR)
        b = min(n, a + len(ch))
        mix[a:b] += ch[: b - a] * 10 ** (-27 / 20)
    pk = np.abs(mix).max()
    if pk > 0.97:
        mix *= 0.97 / pk
    return mix


# ------------------------------------------------------------------ subtitles
def ass_time(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def srt_time(t: float) -> str:
    t = max(0.0, t)
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def weight(s: str, lang: str) -> float:
    if lang == "zh":
        return sum(1.0 if re.match(r"[一-鿿0-9]", c) else (0.5 if c.isalpha() else 0.0) for c in s) + 0.5
    return len(re.findall(r"[A-Za-z0-9]", s)) + 1.0


def chunk_zh(s: str, maxlen=21):
    parts = re.split(r"(?<=[，、：；,])", s)
    out, cur = [], ""
    for p in parts:
        if len(cur) + len(p) <= maxlen or not cur:
            cur += p
        else:
            out.append(cur)
            cur = p
    if cur:
        out.append(cur)
    res = []
    for c in out:
        while len(c) > maxlen + 4:
            cut = len(c) // 2
            res.append(c[:cut])
            c = c[cut:]
        res.append(c)
    return [r.rstrip("，、；,") if r.endswith(("，", "、", "；")) else r for r in res]


def chunk_en(s: str, maxlen=88):
    if len(s) <= maxlen:
        return [s]
    parts = re.split(r"(?<=[,;:])\s+", s)
    out, cur = [], ""
    for p in parts:
        if not cur:
            cur = p
        elif len(cur) + 1 + len(p) <= maxlen:
            cur += " " + p
        else:
            out.append(cur)
            cur = p
    if cur:
        out.append(cur)
    res = []
    for c in out:
        while len(c) > maxlen + 10:
            words = c.split()
            half, acc = [], 0
            for w in words:
                if acc + len(w) > len(c) / 2 and half:
                    break
                half.append(w)
                acc += len(w) + 1
            res.append(" ".join(half))
            c = " ".join(words[len(half):])
        res.append(c)
    return res


def ass_escape(s: str) -> str:
    return s.replace("{", "(").replace("}", ")").replace("\n", " ")


SQ_ASS = "&H0052C1F4&"
FLIP_ASS = "&H00F8A95A&"


def highlight(text: str, words) -> str:
    out = ass_escape(text)
    for w in sorted(words, key=len, reverse=True):
        pat = re.compile(r"(?<![A-Za-z])(" + re.escape(w).replace(r"\ ", r"\s+") + r"(?:s|es|'s)?)(?![A-Za-z])", re.I)
        out = pat.sub(lambda m: "{\\c" + SQ_ASS + "}" + m.group(1) + "{\\c&H00FFFFFF&}", out, count=1)
    return out


def gloss_line(words, glossary):
    items = []
    for w in words:
        if w not in glossary:
            continue
        ipa, zh = glossary[w]
        items.append("{\\fnInter\\b1}" + ass_escape(w) + "{\\b0}  {\\fnCharis SIL}" + ipa +
                     "  {\\fnNoto Sans CJK SC}" + zh)
    return "{\\fnInter}    ·    ".join(items)


def build_subs(lang, data, seg_starts, timing):
    glossary = data["glossary"]
    segs = {seg["id"]: seg for _, seg in SL.all_segments(data)}
    main_font = "Noto Sans CJK SC" if lang == "zh" else "Inter"
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{main_font},{50 if lang == 'zh' else 46},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,{1 if lang == 'zh' else 0},0,1,3,0,2,140,140,{58 if lang == 'en' else 46},1
Style: Q,Inter,44,{FLIP_ASS},&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,140,140,96,1
Style: QZ,Noto Sans CJK SC,40,&H00E6E6E6,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,140,140,40,1
Style: Vocab,Inter,31,{SQ_ASS},&H00FFFFFF,&H00101010,&H90000000,0,0,0,0,100,100,0,0,1,2.4,0,2,80,80,14,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev, srt = [], []

    def add(start, end, style, text, layer=0):
        ev.append(f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{text}")

    for sid, t0 in seg_starts:
        tm = timing[sid]
        seg = segs[sid]
        speaker = seg.get("speaker", "narrator")
        vocab = seg.get("vocab", []) if lang == "en" else []
        shown_vocab = set()
        events = []
        for s in tm["sentences"]:
            text, tl = s["text"], s["lang"]
            chunks = chunk_zh(text) if tl == "zh" else chunk_en(text)
            ws = [weight(c, tl) for c in chunks]
            tot = sum(ws)
            a = t0 + s["start"]
            span = s["end"] - s["start"]
            for c, w in zip(chunks, ws):
                b = a + span * w / tot
                events.append((a, b, c, tl))
                a = b
        # extend each event to the next one (no flicker between sentences), cap the gap
        for i, (a, b, c, tl) in enumerate(events):
            nxt = events[i + 1][0] if i + 1 < len(events) else b + 0.5
            end = min(nxt, b + 0.6) if nxt - b < 1.2 else b + 0.4
            if lang == "zh" and speaker == "examiner":
                add(a, end, "Q", ass_escape(c))
                srt.append((a, end, c + "\n" + seg.get("zh_tr", "")))
            elif speaker == "examiner":
                add(a, end, "Q", highlight(c, vocab))
                srt.append((a, end, "Examiner: " + c))
            else:
                add(a, end, "Main", highlight(c, vocab) if lang == "en" else ass_escape(c))
                srt.append((a, end, c if not (lang == "en" and speaker == "candidate") else c))
            if vocab:
                here = [w for w in vocab if re.search(r"(?<![A-Za-z])" + re.escape(w), c, re.I)]
                if here:
                    shown_vocab.update(here)
                    add(a, end, "Vocab", gloss_line(here, glossary), layer=1)
        if lang == "zh" and speaker == "examiner" and events:
            add(events[0][0], events[-1][1] + 0.6, "QZ", ass_escape(seg.get("zh_tr", "")))
        missing = [w for w in vocab if w not in shown_vocab]
        if missing and events:
            add(events[0][0], events[-1][1] + 0.4, "Vocab", gloss_line(missing, glossary), layer=2)
    return header + "\n".join(ev) + "\n", srt


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lang")
    ap.add_argument("--crf", type=int, default=24)
    ap.add_argument("--quality", default="1080p30")
    ap.add_argument("--preset", default="slow")
    args = ap.parse_args()
    lang = args.lang
    data = SL.load()
    timing = json.loads((ROOT / "audio" / lang / "timing.json").read_text(encoding="utf-8"))
    work = ROOT / "render" / lang
    work.mkdir(parents=True, exist_ok=True)

    offset = 0.0
    placements, seg_starts, chimes, lst, chapter_marks = [], [], [], [], []
    for mod, scene in SCENES:
        chapter_marks.append((scene, offset))
        vid = scene_video(lang, mod, scene, args.quality)
        tl = json.loads((work / "timeline" / f"{scene}.json").read_text())
        d = probe_duration(vid)
        if abs(d - tl["duration"]) > 0.2:
            print(f"warning: {scene} video {d:.2f}s vs timeline {tl['duration']:.2f}s")
        if scene != "S01_Hook":
            chimes.append(offset + 0.05)
        for s in tl["segments"]:
            placements.append((offset + s["start"], ROOT / "audio" / lang / f"{s['seg']}.wav"))
            seg_starts.append((s["seg"], offset + s["start"]))
        lst.append(f"file '{vid}'")
        offset += d
    total = offset
    print(f"[{lang}] total {total/60:.2f} min, {len(placements)} narration segments")

    (work / "concat.txt").write_text("\n".join(lst) + "\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(work / "concat.txt"),
                    "-c", "copy", "-an", str(work / "video.mp4")], check=True)

    mix = build_audio(lang, placements, total, chimes)
    sf.write(work / "mix.wav", mix, SR, subtype="PCM_16")

    ass, srt = build_subs(lang, data, seg_starts, timing)
    (work / "subs.ass").write_text(ass, encoding="utf-8")
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    with open(out / f"{NAME}_{lang}.srt", "w", encoding="utf-8") as f:
        for i, (a, b, t) in enumerate(srt, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{t}\n\n")
    (out / f"{NAME}_{lang}.ass").write_text(ass, encoding="utf-8")

    # chapter markers (shown by most players) + a plain-text chapter list
    chapters = {c["id"]: c for c in data["chapters"]}
    scene_ch = {sc["id"]: chapters[sc["chapter"]] for sc in data["scenes"]}
    meta = [";FFMETADATA1", f"title={data['meta']['title_' + lang]}"]
    lines = []
    for i, (scene, t0) in enumerate(chapter_marks):
        t1 = chapter_marks[i + 1][1] if i + 1 < len(chapter_marks) else total
        name = f"{i + 1:02d} {scene_ch[scene][lang]}"
        meta += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={int(t0 * 1000)}", f"END={int(t1 * 1000)}", f"title={name}"]
        lines.append(f"{int(t0 // 60):02d}:{int(t0 % 60):02d}  {name}")
    (work / "chapters.ffmeta").write_text("\n".join(meta) + "\n", encoding="utf-8")
    (out / f"{NAME}_{lang}_chapters.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    ass_path = str(work / "subs.ass").replace(":", r"\:")
    subprocess.run(["ffmpeg", "-v", "error", "-stats", "-y", "-i", str(work / "video.mp4"), "-i", str(work / "mix.wav"),
                    "-i", str(work / "chapters.ffmeta"), "-map_metadata", "2", "-map_chapters", "2",
                    "-vf", f"ass={ass_path}", "-map", "0:v", "-map", "1:a",
                    "-c:v", "libx264", "-preset", args.preset, "-crf", str(args.crf), "-tune", "animation",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
                    str(out / f"{NAME}_{lang}.mp4")], check=True)
    print("wrote", out / f"{NAME}_{lang}.mp4")


if __name__ == "__main__":
    main()
