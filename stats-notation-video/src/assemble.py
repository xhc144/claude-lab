"""把各段动画、配音、铺底音乐和字幕合成成片。

python assemble.py [hd|preview]
输入：build/media/<场景>/videos/*/<分辨率>/<场景>.mp4、build/timing/<场景>.json、build/voice/*.wav
输出：output/stats-notation.mp4 和同名 .srt

配音时长若是 tts.py --estimate 给的估计值，只能出 preview：没有人声，画面右上角标“未配音预览”。
"""
import glob
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "output")
SR = 48000

TITLE = "统计的符号与术语"
NAME = "stats-notation"

# (模块, 场景类, 章节名)；章节名为 None 的场景并入上一章
SCENES = [
    ("s00_opening", "Opening", "开场：论文里的一段记号"),
    ("s01_population", "Population", "一 · 总体与样本"),
    ("s02_describe", "Describe", "二 · 描述统计：集中与形状"),
    ("s02_describe", "Spread", "二 · 描述统计：分散程度"),
    ("s03_probability", "Probability", "三 · 概率：集合记号与条件概率"),
    ("s03_probability", "Bayes", "三 · 概率：贝叶斯公式与独立"),
    ("s04_random", "RandomVar", "四 · 随机变量"),
    ("s05_distributions", "Normal", "五 · 常见分布：正态"),
    ("s05_distributions", "Discrete", "五 · 常见分布：二项、泊松及其他"),
    ("s05_distributions", "SamplingDists", "五 · 常见分布：χ²、t、F"),
    ("s06_sampling", "Sampling", "六 · 抽样分布"),
    ("s07_estimation", "Estimation", "七 · 参数估计：偏差与最大似然"),
    ("s07_estimation", "Interval", "七 · 参数估计：置信区间"),
    ("s08_testing", "Testing", "八 · 假设检验：H₀、p 值与拒绝域"),
    ("s08_testing", "Errors", "八 · 假设检验：两类错误与报告"),
    ("s09_regression", "Regression", "九 · 回归"),
    ("s09_regression", "Models", "九 · 回归：方差分析表与逻辑回归"),
    ("s10_confusables", "Confusables", "十 · 容易混淆的记号"),
    ("s10_confusables", "Glossary", "十 · 贝叶斯、写法变体与缩写"),
    ("s11_finale", "Finale", "尾声"),
]


def probe_duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def timeline(res):
    """每段视频的起点，以及每句旁白在全片中的绝对时间。"""
    voice = json.load(open(os.path.join(BUILD, "voice", "durations.json"), encoding="utf-8"))
    t0, files, events, chapters, pauses = 0.0, [], [], [], []
    for mod, cls, title in SCENES:
        found = glob.glob(os.path.join(BUILD, "media", cls, "videos", "*", res, f"{cls}.mp4"))
        if not found:
            sys.exit(f"缺少 {cls} 的 {res} 渲染结果，先运行 render.sh")
        v = max(found, key=os.path.getmtime)
        d = probe_duration(v)
        log = json.load(open(os.path.join(BUILD, "timing", f"{cls}.json"), encoding="utf-8"))
        for ln in log["lines"]:
            if ln.get("estimate") and res == "1080p30":
                sys.exit(f"{cls} 渲染时 {ln['key']} 还没有配音（用的是估计时长）：合成配音后重新渲染这一段")
            if ln["key"] != "_pause" and abs(ln["dur"] - voice[ln["key"]]["dur"]) > 0.01:
                sys.exit(f"{cls} 渲染之后 {ln['key']} 的配音变了：重新渲染这一段")
            if ln["key"] == "_pause":
                pauses.append((t0 + ln["t"], t0 + ln["t"] + ln["dur"]))
            else:
                events.append({"t": t0 + ln["t"], "dur": ln["dur"], "key": ln["key"], "sub": voice[ln["key"]]["sub"]})
        chapters.append((t0, title))
        files.append(v)
        t0 += d
    return files, events, chapters, pauses, t0


# ------------------------------------------------------------------ 声音
def narration(events, total, silent=False):
    out = np.zeros(int(total * SR) + SR)
    if silent:
        return out
    for e in events:
        w, sr = sf.read(os.path.join(BUILD, "voice", f"{e['key']}.wav"), dtype="float64")
        w = resample_poly(w, SR, sr)
        i = int(e["t"] * SR)
        out[i:i + len(w)] += w[: len(out) - i]
    return out


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pad_music(total, seed=4):
    """很轻的铺底：四个和弦缓慢循环，加稀疏的高音。"""
    rng = np.random.default_rng(seed)
    n = int(total * SR) + SR
    t = np.arange(n) / SR
    out = np.zeros(n)
    chords = [[41, 53, 57, 60, 64], [45, 52, 55, 60, 64], [46, 53, 57, 62, 65], [48, 55, 60, 62, 67]]
    span = 8.0
    k = 0
    start = 0.0
    while start < total:
        notes = chords[k % 4]
        a, b = int(start * SR), min(n, int((start + span + 4.0) * SR))
        tt = t[a:b] - start
        env = np.minimum(1, tt / 2.5) * np.clip((span + 4.0 - tt) / 4.0, 0, 1)
        for j, m in enumerate(notes):
            f = mtof(m)
            amp = 0.5 if j == 0 else 0.32
            for det in (-0.0018, 0.0018):
                ph = rng.uniform(0, 2 * np.pi)
                s = np.sin(2 * np.pi * f * (1 + det) * tt + ph) + 0.18 * np.sin(4 * np.pi * f * (1 + det) * tt + ph)
                out[a:b] += amp * env * s * (0.85 + 0.15 * np.sin(2 * np.pi * 0.07 * tt + j))
        # 稀疏高音：每个和弦里两三个轻轻的音
        for _ in range(rng.integers(2, 4)):
            m = rng.choice(notes[2:]) + 12
            s0 = start + rng.uniform(0.5, span - 1)
            i0, i1 = int(s0 * SR), min(n, int((s0 + 4) * SR))
            tb = t[i0:i1] - s0
            out[i0:i1] += 0.22 * np.exp(-tb / 1.3) * np.minimum(1, tb / 0.01) * np.sin(2 * np.pi * mtof(m) * tb)
        start += span
        k += 1
    out = sosfilt(butter(2, 2600, "low", fs=SR, output="sos"), out)
    ir_t = np.arange(int(2.8 * SR)) / SR
    ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t / 0.9)
    ir = sosfilt(butter(2, 3500, "low", fs=SR, output="sos"), ir)
    ir /= np.sqrt((ir ** 2).sum())
    wet = fftconvolve(out, ir)[:n]
    out = 0.6 * out + 0.4 * wet
    return out / np.abs(out).max()


def smooth_env(x, attack, release):
    y = np.zeros_like(x)
    a = np.exp(-1 / (attack * SR)); r = np.exp(-1 / (release * SR))
    v = 0.0
    for i in range(0, len(x), 64):  # 64 采样一步，足够平滑
        target = x[i]
        c = a if target > v else r
        v = target + (v - target) * c ** 64
        y[i:i + 64] = v
    return y


def mix(events, pauses, total, silent=False):
    voice = narration(events, total, silent)
    music = pad_music(total)
    n = len(voice)
    active = np.zeros(n)
    for e in events:
        active[int(e["t"] * SR): int((e["t"] + e["dur"]) * SR)] = 1
    duck = 1 - 0.55 * smooth_env(active, 0.25, 0.9)
    silent = np.zeros(n)
    for a, b in pauses:
        silent[int((a - 0.4) * SR): int((b + 0.2) * SR)] = 1
    gate = 1 - smooth_env(silent, 0.5, 0.8)
    fade = np.clip(np.arange(n) / (2.5 * SR), 0, 1) * np.clip((total * SR - np.arange(n)) / (4 * SR), 0, 1)
    bed = music * duck * gate * fade * 0.095
    stereo = np.stack([voice * 0.92 + bed, voice * 0.92 + bed], axis=1)
    stereo = stereo[: int(total * SR)]
    peak = np.abs(stereo).max()
    if peak > 0.98:
        stereo *= 0.98 / peak
    return stereo


# ------------------------------------------------------------------ 字幕
def split_sub(text, limit=22):
    text = text.strip().rstrip("。，；：")
    if len(text) <= limit:
        return [text]
    cut = [m.end() for m in re.finditer(r"[，；：。？！]", text) if 4 < m.end() < len(text) - 2]
    if not cut:
        return [text]
    mid = len(text) / 2
    c = min(cut, key=lambda x: abs(x - mid))
    return split_sub(text[:c], limit) + split_sub(text[c:], limit)


_CUT = re.compile(r"[，；：。？！]")
_MARKS = set("，。、：；！？")
_SKIP = re.compile(r"[\s“”‘’（）()·\"'—…\-\[\]]")


def _events(s, tokens=False):
    """把文字拆成 'm'（标点）/'c'（字）序列。时间戳里热修复的拼音块（如 [ch][ā]）算一个字；
    稿子里两个汉字之间的空格，引擎会读成停顿并在时间戳里记成“、”，这里也照样算。"""
    if tokens:
        s = re.sub(r"(\[[^\]]*\])+", "#", s)
    else:
        s = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "、", s)
    return ["m" if ch in _MARKS else "c" for ch in s if not _SKIP.match(ch)]


def boundary_time(prefix, full, words):
    """配音文字 full 里，前缀 prefix 之后第一个字的开口时间（秒）。

    逐字时间戳的文字是引擎展开数字之后的念法，字数和稿子未必一样，标点却一一保留：
    先数到第 k 个标点，再往后数 r 个字。标点个数对不上时退回按字数比例。"""
    pre, tot = _events(prefix), _events(full)
    seq = [(e, i) for i, w in enumerate(words) for e in _events(w[0], tokens=True)]
    if not seq:
        return None
    if tot.count("m") == sum(e == "m" for e, _ in seq):
        k = pre.count("m")
        r = pre[len(pre) - pre[::-1].index("m"):].count("c") if k else pre.count("c")
        seen_m = seen_c = 0
        for e, i in seq:
            if seen_m < k:
                seen_m += e == "m"
            elif e == "c":
                if seen_c == r:
                    return words[i][1]
                seen_c += 1
        return words[-1][2]
    cs = [i for e, i in seq if e == "c"]
    f = pre.count("c") / max(1, tot.count("c"))
    return words[cs[min(len(cs) - 1, round(f * len(cs)))]][1]


def part_starts(sub, say, parts, words, dur):
    """每段字幕在这句配音里的起始秒数。

    字幕断在标点处；配音文字和字幕的句读一一对应（只是数字、记号写法不同），
    所以第 k 个标点之后的字幕，对应配音文字第 k 个标点之后的内容，再按逐字时间戳找到开口时间。
    没有时间戳时（旧缓存）按字数比例分。
    """
    pos, prefixes = 0, []
    say_marks = [m.end() for m in _CUT.finditer(say)]
    same = len(say_marks) == len(_CUT.findall(sub))
    for p in parts:
        i = sub.find(p, pos)
        i = pos if i < 0 else i
        k = len(_CUT.findall(sub[:i]))
        if same:
            prefixes.append(say[:say_marks[k - 1]] if k else "")
        else:
            prefixes.append(say[:round(len(say) * i / max(1, len(sub)))])
        pos = i + len(p)
    out = []
    for pre in prefixes:
        t = boundary_time(pre, say, words) if (pre and words) else None
        if t is None:
            t = dur * len(pre) / max(1, len(say))
        out.append(0.0 if not out else max(out[-1], t))
    return out


def subtitle_events(events):
    voice = json.load(open(os.path.join(BUILD, "voice", "durations.json"), encoding="utf-8"))
    out = []
    for e in events:
        v = voice[e["key"]]
        parts = split_sub(e["sub"])
        st = part_starts(e["sub"], v["say"], parts, v.get("words"), e["dur"]) + [e["dur"]]
        for i, p in enumerate(parts):
            out.append((e["t"] + st[i], e["t"] + st[i + 1], p.rstrip("。，；：")))
    # 相邻两条之间留空不足 0.3 秒就接上，避免闪烁
    fixed = []
    for i, (a, b, s) in enumerate(out):
        if i + 1 < len(out) and out[i + 1][0] - b < 0.3:
            b = out[i + 1][0]
        fixed.append((a, b, s))
    return fixed


_MARKED = re.compile(r"([A-Za-z\u0391-\u03c9][\u0300-\u036f]+[\u2080-\u2089]*|\u0100)")


def ass_text(s):
    """x̄、θ̂、p̂ 这类“字母 + 组合附加符号”在中文字体里会排歪，单独换成 DejaVu Sans。"""
    return _MARKED.sub(lambda m: "{\\fnDejaVu Sans}" + m.group(1) + "{\\fnNoto Sans CJK SC}", s)


def ts_ass(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def ts_srt(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"


def write_subs(subs, ass_path, srt_path, scale):
    # 底色框（BorderStyle 3）：字幕落在坐标轴标签上时也看得清
    fs = int(52 * scale); pad = max(2, round(10 * scale)); mv = int(34 * scale)
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {int(1920 * scale)}
PlayResY: {int(1080 * scale)}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK SC,{fs},&H00282A2B,&H000000FF,&H1AE8F1F5,&H00000000,0,0,0,0,100,100,1,0,3,{pad},0,2,60,60,{mv},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(head)
        for a, b, s in subs:
            f.write(f"Dialogue: 0,{ts_ass(a)},{ts_ass(b)},Default,,0,0,0,,{ass_text(s)}\n")
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, (a, b, s) in enumerate(subs, 1):
            f.write(f"{i}\n{ts_srt(a)} --> {ts_srt(b)}\n{s}\n\n")


def loudnorm(src, dst, target="I=-16:TP=-1.5:LRA=11"):
    """两遍 loudnorm，第二遍用线性增益，整片音量一致又不抽吸。"""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", f"loudnorm={target}:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, check=True)
    m = json.loads(r.stderr[r.stderr.rindex("{"):])
    af = (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-ar", str(SR), dst], check=True)


def write_chapters(chapters, total, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(f";FFMETADATA1\ntitle={TITLE}\n")
        for i, (t, name) in enumerate(chapters):
            end = chapters[i + 1][0] if i + 1 < len(chapters) else total
            f.write(f"\n[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(t * 1000)}\nEND={int(end * 1000)}\ntitle={name}\n")


def main():
    hd = (sys.argv[1] if len(sys.argv) > 1 else "hd") == "hd"
    res = "1080p30" if hd else "540p30"
    scale = 1.0 if hd else 0.5
    os.makedirs(OUT, exist_ok=True)
    work = os.path.join(BUILD, "assemble")
    os.makedirs(work, exist_ok=True)

    files, events, chapters, pauses, total = timeline(res)
    print(f"{len(files)} 段，{len(events)} 句旁白，全片 {total / 60:.2f} 分钟")
    voice = json.load(open(os.path.join(BUILD, "voice", "durations.json"), encoding="utf-8"))
    estimated = any(v.get("estimate") for v in voice.values())
    if estimated and hd:
        sys.exit("配音时长还是估计值：先运行 tts.py 合成真实配音，再渲染、合成成片")

    audio = mix(events, pauses, total, silent=estimated)
    raw = os.path.join(work, "mix_raw.wav")
    sf.write(raw, audio, SR, subtype="PCM_24")
    wav = os.path.join(work, "mix.wav")
    loudnorm(raw, wav)

    subs = subtitle_events(events)
    name = NAME if hd else (f"{NAME}-preview-silent" if estimated else f"{NAME}-preview")
    ass = os.path.join(work, f"{name}.ass")
    srt = os.path.join(OUT, f"{name}.srt")
    write_subs(subs, ass, srt, scale)
    meta = os.path.join(work, "chapters.txt")
    write_chapters(chapters, total, meta)
    lst = os.path.join(work, "list.txt")
    with open(lst, "w") as f:
        for v in files:
            f.write(f"file '{v}'\n")

    mp4 = os.path.join(OUT, f"{name}.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-stats",
           "-f", "concat", "-safe", "0", "-i", lst, "-i", wav, "-i", meta,
           "-map", "0:v", "-map", "1:a", "-map_metadata", "2", "-map_chapters", "2",
           "-vf", f"ass={ass}" + (",drawtext=text='未配音预览':fontfile=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc:fontsize=22:fontcolor=0xC0504D:x=w-tw-20:y=16" if estimated else ""), "-c:v", "libx264", "-preset", "medium", "-crf", "21" if hd else "26",
           "-tune", "animation", "-pix_fmt", "yuv420p", "-r", "30",
           "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
           "-movflags", "+faststart", "-shortest", mp4]
    subprocess.run(cmd, check=True)
    print("成片：", mp4, f"{os.path.getsize(mp4) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
