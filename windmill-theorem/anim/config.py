"""Shared settings: language, paths, palette, fonts and narration timing."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from content.script import BY_ID, CHAPTERS as CHAPTER_KEYS, sentences, spoken  # noqa: E402,F401

LANG = os.environ.get("WT_LANG", "zh")
assert LANG in ("zh", "en"), LANG
BUILD = ROOT / "build"
CUES_DIR = BUILD / "cues" / LANG

# ---------------------------------------------------------------- palette
BG = "#0B1020"
INK = "#E9EDF5"        # main text
MUTED = "#8C96AE"      # secondary text
FAINT = "#3A4560"      # grid lines, guides
GOLD = "#F4B942"       # the central square
TEAL = "#3CC5B0"       # windmill blades
CORAL = "#FF7A6B"      # warnings, residue 3, highlights
SKY = "#5AA9F0"        # the swap involution (tau)
VIOLET = "#B488F0"     # Zagier's involution (zeta)
LIME = "#A8D86E"       # success / fixed points
PANEL = "#141B30"      # cards

FONT_ZH = "Noto Sans CJK SC"
FONT_EN = "Inter"
FONT_UI = FONT_ZH if LANG == "zh" else FONT_EN


def T(zh, en):
    """Pick the on-screen string for the current language."""
    return zh if LANG == "zh" else en


# ---------------------------------------------------------- narration timing
def _load_manifest():
    for p in (BUILD / "audio" / LANG / "manifest.json", BUILD / "estimate" / f"{LANG}.json"):
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8")), p.parent.name
    return {}, "none"


MANIFEST, TIMING_SOURCE = _load_manifest()


SENT_GAP = {"zh": 0.30, "en": 0.40}


def estimate_sentence(text, lang=LANG):
    t = spoken(text)
    if lang == "zh":
        import re
        cjk = len(re.findall(r"[\u4e00-\u9fff]", t))
        words = len(re.findall(r"[A-Za-z]+", t))
        digits = len(re.findall(r"[0-9]", t))
        return cjk / 4.5 + words * 0.32 + digits * 0.22 + 0.15
    return len(t.split()) / 2.2 + 0.2


def estimate_layout(line_id, lang=LANG):
    """[(start, end)] of each sentence within the line, estimated."""
    t, out = 0.0, []
    for s, _ in sentences(BY_ID[line_id], lang):
        d = estimate_sentence(s, lang)
        out.append((t, t + d))
        t += d + SENT_GAP[lang]
    return out


def estimate_duration(line_id, lang=LANG):
    lay = estimate_layout(line_id, lang)
    return lay[-1][1] if lay else 0.0


def line_duration(line_id):
    if line_id in MANIFEST:
        return float(MANIFEST[line_id]["dur"])
    return estimate_duration(line_id)


def sentence_offsets(line_id):
    if line_id in MANIFEST:
        return [a for a, _ in MANIFEST[line_id]["sents"]]
    return [a for a, _ in estimate_layout(line_id)]
