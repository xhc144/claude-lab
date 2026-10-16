"""Build burn-in ASS subtitles (with vocabulary cards for the English version) and SRT files.

    python tools/subtitles.py --lang en --out build/en
"""
import argparse
import re
from pathlib import Path

from timeline import ROOT, global_cues, lang_config
from content.script import BY_ID, _MARK, sentences, shown, spoken

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
    for c in out:                      # wrap anything still too long, never inside a formula
        while len(c) > maxlen + 6:
            cut = _formula_cut(c, maxlen)
            res.append(c[:cut].rstrip())
            c = c[cut:].lstrip()
        res.append(c)
    return [re.sub(r"[，、：]$", "", c) for c in res]


def _formula_cut(c, maxlen):
    """Where to break an over-long Chinese chunk: at a space, preferably one before an operator
    (= + − ×), so that "(a + bi)(a − bi)" or "1 − 1/3 + 1/5" is never split inside a term."""
    depth, outside = 0, set()
    for i, ch in enumerate(c):
        depth += ch in "([" and 1 or (ch in ")]" and -1 or 0)
        if depth == 0:
            outside.add(i)
    spaces = [m.start() for m in re.finditer(r" ", c) if 6 <= m.start() <= maxlen + 6 and m.start() in outside]
    ops = [i for i in spaces if c[i + 1:i + 2] in "=+−×≡"]
    for cands in (ops, spaces):
        if cands:
            return min(cands, key=lambda i: abs(i - maxlen * 0.75))
    return maxlen


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
            # no good punctuation: break at the space nearest the balanced length (no orphans)
            spaces = [m.end() for m in re.finditer(r" ", rest) if maxlen * 0.3 <= m.end() <= maxlen]
            cut = min(spaces, key=lambda c: abs(c - target)) if spaces else maxlen
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


_MARKS = set("，。、：；！？,.;:!?")
_SKIP = re.compile(r"[\s“”‘’（）()《》·\"'—…\-\[\]]")


def _events(s, tokens=False):
    """'m' (punctuation) / 'c' (character) sequence.  In the engine's word timestamps a hot_fix
    pinyin block such as [ch][ā] stands for one character; in the script, a space between two
    Chinese characters is read as a pause and shows up in the timestamps as "、"."""
    if tokens:
        s = re.sub(r"(\[[^\]]*\])+", "#", s)
    else:
        s = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "、", s)
    return ["m" if ch in _MARKS else "c" for ch in s if not _SKIP.match(ch)]


def boundary_time(prefix, full, words):
    """Start time of the first word after `prefix` in the spoken sentence `full`.

    The timestamps are on the engine's normalized text (numbers expanded), so characters don't
    line up with the script, but punctuation does: count to the k-th mark, then r characters on.
    Falls back to the character ratio when the punctuation doesn't match."""
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


def spoken_prefix(raw, pos):
    """Spoken text of the part of `raw` whose shown text is shown(raw)[:pos]."""
    out, last = "", 0
    for m in list(_MARK.finditer(raw)) + [None]:
        plain = raw[last:m.start()] if m else raw[last:]
        if pos <= len(plain):
            return out + plain[:pos]
        out, pos = out + plain, pos - len(plain)
        if m is None:
            return out
        sh, sp = m.group(1), m.group(2)
        if pos < len(sh):                # inside a formula: proportional
            return out + sp[:round(len(sp) * pos / max(1, len(sh)))]
        out, pos, last = out + sp, pos - len(sh), m.end()
    return out


def chunk_times(raw, parts, words, a, b):
    """Start time of every subtitle chunk of one sentence, from the engine's word timestamps,
    so each chunk appears when the voice starts saying it."""
    txt, full = shown(raw), spoken(raw)
    pos, starts = 0, []
    for p in parts:
        i = txt.find(p, pos)
        i = pos if i < 0 else i
        pos = i + len(p)
        if not starts:
            starts.append(a)
            continue
        pre = spoken_prefix(raw, i)
        t = boundary_time(pre, full, words)
        if t is None:
            t = a + (b - a) * len(pre) / max(1, len(full))
        starts.append(min(b, max(starts[-1], t)))
    return starts


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
            words = (cfg.MANIFEST.get(line_id, {}).get("words") or [None] * len(sents))[k]
            if words:
                rel = chunk_times(raw, parts, words, a, b) + [b]
                times = [(t0 + rel[i], t0 + rel[i + 1]) for i in range(len(parts))]
            else:                      # no word timestamps (offline engines): split by length
                ws = [weight(p, lang) for p in parts]
                acc = [a + (b - a) * sum(ws[:i]) / sum(ws) for i in range(len(ws) + 1)]
                times = [(t0 + acc[i], t0 + acc[i + 1]) for i in range(len(parts))]
            for i, p in enumerate(parts):
                start, end = times[i][0], times[i][1] + (0.25 if i == len(parts) - 1 else 0.0)
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
