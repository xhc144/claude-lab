"""Build burn-in ASS subtitles (with vocabulary cards for the English version) and SRT files.

    python tools/subtitles.py --lang en --out build/en
"""
import argparse
import re
from pathlib import Path

from timeline import ROOT, global_cues, lang_config
from content.script import BY_ID, sentences, shown

COL = {  # ASS colours are &HAABBGGRR
    "white": "&H00F5EDE9", "gloss": "&H00A8C6E8", "sky": "&H00F0A95A", "gold": "&H0042B9F4",
    "outline": "&H00201008", "shadow": "&H96000000", "card": "&H1A301B14", "ipa": "&H00C8C0B4",
}


def ts_ass(t):
    t = max(0.0, t)
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def ts_srt(t):
    t = max(0.0, t)
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ------------------------------------------------------------------ chunking
def chunks_zh(s, maxlen=22):
    s = s.strip()
    s = re.sub(r"[。；]$", "", s)
    if len(s) <= maxlen:
        return [s]
    parts = re.split(r"(?<=[，、：])", s)
    out, cur = [], ""
    for p in parts:
        if cur and len(cur) + len(p) > maxlen:
            out.append(cur)
            cur = p
        else:
            cur += p
    if cur:
        out.append(cur)
    res = []
    for c in out:                      # hard wrap anything still too long
        while len(c) > maxlen + 6:
            res.append(c[:maxlen])
            c = c[maxlen:]
        res.append(c)
    return [re.sub(r"[，、]$", "", c) for c in res]


def chunks_en(s, maxlen=74):
    s = s.strip()
    if len(s) <= maxlen:
        return [s]
    n = max(2, -(-len(s) // maxlen))
    target = len(s) / n
    out, rest = [], s
    while len(rest) > maxlen:
        cut = None
        for m in re.finditer(r"[,;:—] |\. |\? ", rest):
            if m.end() <= maxlen and (cut is None or abs(m.end() - target) < abs(cut - target)):
                cut = m.end()
        if cut is None or cut < maxlen * 0.35:
            cut = rest.rfind(" ", 0, maxlen)
            cut = cut + 1 if cut > 0 else maxlen
        out.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    if rest:
        out.append(rest)
    return out


def wrap_gloss(g, width=34):
    """Split a long Chinese gloss into balanced lines, preferring punctuation breaks."""
    if len(g) <= width:
        return [g]
    k = -(-len(g) // width)
    out, rest = [], g
    for j in range(k - 1, 0, -1):
        target = len(rest) / (j + 1)
        cands = [m.end() for m in re.finditer(r"[，、：；]", rest) if 0.45 * target < m.end() < min(width, 1.6 * target)]
        cut = min(cands, key=lambda c: abs(c - target)) if cands else int(round(target))
        out.append(rest[:cut])
        rest = rest[cut:]
    out.append(rest)
    return out


def weight(s, lang):
    return max(1, len(s)) if lang == "zh" else max(1, len(s.split()))


# ------------------------------------------------------------------ main
def build(lang, outdir, quality="1080p30"):
    cfg = lang_config(lang)
    cues, total, _ = global_cues(lang, quality)
    events, srt_main, srt_bi, vocab_events = [], [], [], []
    slots_busy = []  # (end_time, slot)
    for line_id, t0, dur, scene in cues:
        line = BY_ID[line_id]
        sents = sentences(line, lang)
        lay = cfg.MANIFEST[line_id]["sents"] if line_id in cfg.MANIFEST else cfg.estimate_layout(line_id, lang)
        spk = line.spk
        for k, ((raw, gloss), (a, b)) in enumerate(zip(sents, lay)):
            txt = shown(raw)
            parts = chunks_zh(txt) if lang == "zh" else chunks_en(txt)
            ws = [weight(p, lang) for p in parts]
            tt = t0 + a
            span = (b - a)
            for p, w in zip(parts, ws):
                d = span * w / sum(ws)
                start, end = tt, tt + d + (0.25 if p is parts[-1] else 0.0)
                tt += d
                if lang == "zh":
                    events.append(("Main", start, end, p))
                    srt_main.append((start, end, p))
                else:
                    colr = COL["sky"] if spk == "interviewer" else COL["gold"] if spk == "candidate" else COL["white"]
                    prefix = "Q: " if spk == "interviewer" else "A: " if spk == "candidate" else ""
                    g = "\\N".join(wrap_gloss(gloss)) if gloss else ""
                    body = f"{{\\c{colr}}}{prefix}{p}"
                    if g:
                        body += f"\\N{{\\fnNoto Sans CJK SC\\fs34\\c{COL['gloss']}\\bord2}}{g}"
                    events.append(("Main", start, end, body))
                    srt_main.append((start, end, prefix + p))
                    srt_bi.append((start, end, prefix + p + ("\n" + (gloss or "") if gloss else "")))
        # vocabulary cards (English version only)
        if lang == "en":
            for word, ipa, zh in line.vocab:
                key = re.sub(r"\s*\(.*?\)", "", word).split("/")[0].strip().lower()
                key = key.replace("q.e.d.", "q.e.d")
                hit = 0
                for k, (raw, _) in enumerate(sents):
                    if key.split()[0] in shown(raw).lower():
                        hit = k
                        break
                a, b = lay[hit]
                start = t0 + a
                end = max(start + 4.5, min(t0 + b + 0.8, start + 9.0))
                slots_busy = [(e, s_) for e, s_ in slots_busy if e > start]
                used = {s_ for _, s_ in slots_busy}
                slot = next(i for i in range(10) if i not in used)
                slots_busy.append((end, slot))
                y = 96 + slot * 128
                body = (f"{{\\an9\\pos(1872,{y})}}{{\\b1}}{word}{{\\b0}}  {{\\fnNoto Sans\\fs32\\c{COL['ipa']}}}{ipa}"
                        f"\\N{{\\fnNoto Sans CJK SC\\fs32\\c{COL['gloss']}}}{zh}")
                vocab_events.append(("Vocab", start, end, body))
    outdir.mkdir(parents=True, exist_ok=True)
    main_font = "Noto Sans CJK SC" if lang == "zh" else "Inter"
    main_size = 50 if lang == "zh" else 44
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{main_font},{main_size},{COL['white']},&H000000FF,{COL['outline']},{COL['shadow']},0,0,0,0,100,100,0,0,1,3.2,1.2,2,120,120,44,1
Style: Vocab,Inter,36,{COL['white']},&H000000FF,{COL['card']},{COL['card']},0,0,0,0,100,100,0,0,3,10,0,9,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    for style, s, e, body in events + vocab_events:
        layer = 1 if style == "Vocab" else 0
        lines.append(f"Dialogue: {layer},{ts_ass(s)},{ts_ass(e)},{style},,0,0,0,,{body}\n")
    (outdir / "subs.ass").write_text("".join(lines), encoding="utf-8")

    def write_srt(items, path):
        out = []
        for i, (s, e, t) in enumerate(items, 1):
            out.append(f"{i}\n{ts_srt(s)} --> {ts_srt(e)}\n{t}\n")
        path.write_text("\n".join(out), encoding="utf-8")

    write_srt(srt_main, outdir / f"subs_{lang}.srt")
    if lang == "en":
        write_srt(srt_bi, outdir / "subs_en_zh.srt")
    print(f"{lang}: {len(events)} subtitle events, {len(vocab_events)} vocab cards, total {total / 60:.1f} min")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    build(a.lang, Path(a.out) if a.out else ROOT / "build" / a.lang)
