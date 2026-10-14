"""Shared helpers: load script.yaml, resolve markup, split sentences, resolve voices.

Markup: [[display|spoken]]. Text outside markup is both displayed and spoken.
"""
from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "script" / "script.yaml"

_MARK = re.compile(r"\[\[(.+?)\]\]")


def load():
    with open(SCRIPT, encoding="utf-8") as f:
        return yaml.safe_load(f)


def display(text: str) -> str:
    return _MARK.sub(lambda m: m.group(1).split("|", 1)[0], text)


def spoken(text: str) -> str:
    def rep(m):
        parts = m.group(1).split("|", 1)
        return parts[1] if len(parts) == 2 else parts[0]
    return _MARK.sub(rep, text)


def _protect(text: str):
    """Replace markup by placeholders so sentence splitting never cuts inside it."""
    saved = []

    def rep(m):
        saved.append(m.group(0))
        return f"\x00{len(saved) - 1}\x00"
    return _MARK.sub(rep, text), saved


def _restore(text: str, saved) -> str:
    return re.sub(r"\x00(\d+)\x00", lambda m: saved[int(m.group(1))], text)


def sentences(text: str, lang: str) -> list[str]:
    """Split a paragraph into sentences (markup kept intact)."""
    body, saved = _protect(text.strip())
    if lang == "zh":
        parts = re.split(r"(?<=[。！？；])", body)
    else:
        parts = re.split(r'(?<=[.?!])"?\s+(?=["A-Z0-9])', body)
    return [_restore(p.strip(), saved) for p in parts if p.strip()]


def segment_plan(seg: dict, lang: str):
    """What is spoken for this segment in this language version.

    Returns (voice_key, text_lang, text) or None if the segment is silent.
    text_lang is the language of the spoken text (the Chinese version speaks the
    examiner's questions in English).
    """
    speaker = seg.get("speaker", "narrator")
    if lang == "zh":
        if speaker == "examiner":
            return ("en_examiner", "en", seg["en"])
        if "zh" in seg:
            return ("zh_narrator", "zh", seg["zh"])
        return None
    if speaker == "examiner":
        return ("en_examiner", "en", seg["en"])
    if speaker == "candidate":
        return ("en_candidate", "en", seg["en"])
    return ("en_narrator", "en", seg["en"])


def all_segments(data):
    for sc in data["scenes"]:
        for seg in sc["segments"]:
            yield sc, seg
