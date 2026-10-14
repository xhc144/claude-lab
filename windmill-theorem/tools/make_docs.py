"""Generate the bilingual transcript (docs/讲稿_中英对照.md) from content/script.py, so the
transcript always matches the narration in the videos."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from content.script import CHAPTERS, SCRIPT, shown  # noqa: E402

# which chapter each line belongs to (by id prefix / explicit lists)
PREFIX = {"o": "S00_Open", "b": "S01_History", "st": "S02_Statement", "n": "S03_Necessity", "k": "S04_Pairing",
          "s": "S05_SetSwap", "w": "S06_Windmill", "r": "S07_Proof", "i": "S08_Insight", "g": "S09_Beyond",
          "e": "S11_Outro"}
INTERVIEW = {"zi0", "zi_end", "ei0", "ei_end"} | {f"zq{k}" for k in range(1, 13)} | \
            {f"q{k}" for k in range(1, 13)} | {f"a{k}" for k in range(1, 13)}


def chapter_of(line_id):
    if line_id in INTERVIEW:
        return "S10_Interview"
    for p in sorted(PREFIX, key=len, reverse=True):
        if line_id.startswith(p) and line_id[len(p):].isdigit():
            return PREFIX[p]
    raise KeyError(line_id)


def esc(s):
    return s.replace("|", "\\|").replace("\n", " ")


def main():
    out = []
    out.append("# 费马平方和定理：一句话的证明，一架风车\n")
    out.append("**中英对照讲稿**　·　与视频旁白逐段对应（由 `content/script.py` 自动生成，修改讲稿请改该文件后运行 "
               "`python tools/make_docs.py`）\n")
    out.append("- 中文版视频：`output/windmill_theorem_zh.mp4`　·　英文版视频：`output/windmill_theorem_en.mp4`\n"
               "- 英文版旁白语速放慢；难词在画面右上角标注音标与中文，也汇总在本文末尾的词汇表中。\n"
               "- 第 10 章模拟面试：英文版为三人对话（旁白 / 考官 Q / 考生 A），中文版为中文讲解，因此两栏内容不逐句对应。\n")
    order = list(CHAPTERS)
    for n, ch in enumerate(order):
        zh_t, en_t = CHAPTERS[ch]
        out.append(f"\n## {n:02d}　{zh_t} · {en_t}\n")
        lines = [ln for ln in SCRIPT if chapter_of(ln.id) == ch]
        if ch == "S10_Interview":
            out.append("\n### 中文版：讲解\n")
            for ln in lines:
                if ln.zh:
                    out.append(f"- {shown(ln.zh)}\n")
            out.append("\n### English version: role-play（英文原文 + 逐句中文）\n")
            for ln in lines:
                if not ln.en:
                    continue
                who = {"interviewer": "**Q (考官)**", "candidate": "**A (考生)**"}.get(ln.spk, "*Narrator*")
                en = " ".join(shown(s) for s, _ in ln.en)
                zh = "".join(g for _, g in ln.en)
                out.append(f"\n{who}: {en}\n\n> {zh}\n")
            continue
        out.append("\n| 中文版旁白 | English narration |\n|---|---|\n")
        for ln in lines:
            zh = shown(ln.zh) if ln.zh else ""
            en = " ".join(shown(s) for s, _ in ln.en) if ln.en else ""
            out.append(f"| {esc(zh)} | {esc(en)} |\n")
        out.append("\n<details><summary>英文逐句释义（跟读用）</summary>\n\n")
        for ln in lines:
            for s, g in (ln.en or []):
                out.append(f"- {shown(s)}  \n  {g}\n")
        out.append("\n</details>\n")
    # vocabulary
    out.append("\n## 词汇表 · Vocabulary\n\n| 单词 / 短语 | 音标 | 中文 | 出处 |\n|---|---|---|---|\n")
    seen = set()
    for ln in SCRIPT:
        for w, ipa, zh in ln.vocab:
            if w.lower() in seen:
                continue
            seen.add(w.lower())
            out.append(f"| {esc(w)} | {ipa} | {esc(zh)} | {CHAPTERS[chapter_of(ln.id)][0]} |\n")
    p = ROOT / "docs" / "讲稿_中英对照.md"
    p.write_text("".join(out), encoding="utf-8")
    print("wrote", p, len(seen), "vocabulary items")


if __name__ == "__main__":
    main()
