"""Bilingual transcript (中英对照讲稿): Markdown, HTML and PDF from script/script.yaml.

    python build/transcript.py            -> output/transcript_bilingual.{md,html,pdf}
"""
from __future__ import annotations

import html
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scriptlib as SL  # noqa: E402

ROOT = SL.ROOT
OUT = ROOT / "output"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

INTRO_ZH = """\
**选题：费马平方和定理（扎吉尔的“一句话证明”与风车图）。** 一个奇素数 p 能写成两个平方数之和，当且仅当 p 除以 4 余 1。

为什么选它：陈述一句话就能讲清，容易让考官进入话题；必要性一行可证，充分性却是纯存在性命题，正好展示
“怎样证明存在”的思想；扎吉尔的证明短到惊人，却能被一幅风车图完全解释；而且它连着奇偶论证、不动点、
算法、高斯整数、勾股数和 π，几乎每个方向都能接住考官的追问。它也和你已经讲过的布劳威尔不动点定理
（不动点）、斯潘纳引理（奇偶）自然相连，可以形成一条贯穿的“个人数学兴趣”主线。

**使用建议：** ① 先看中文版，弄懂每一步“为什么”；② 再看英文版（语速约每分钟 140 词），按字幕跟读，
注意黄色高亮的难词和音标；③ 熟读并背下“一分钟版本”和“三分钟版本”；④ 用“追问地图”自测：
遮住答案，看到问题能否用英文在 30–60 秒内答出要点。"""


def md_escape(s: str) -> str:
    return s.replace("|", "\\|")


def seg_text(seg, lang):
    return SL.display(seg.get(lang, "")).strip()


def build_md(data, durations):
    L = []
    m = data["meta"]
    L.append(f"# {m['title_zh']} · {m['title_en']}\n")
    L.append(f"**中英对照讲稿** · {m['subtitle_zh']} / {m['subtitle_en']}\n")
    if durations:
        L.append("视频：中文版约 {zh} 分钟，英文版约 {en} 分钟。\n".format(**durations))
    L.append("## 选题与使用说明\n")
    L.append(INTRO_ZH + "\n")

    L.append("## 面试速用：可以直接说的英文回答\n")
    for p in data["pitches"]:
        L.append(f"### {p['title_zh']}\n")
        L.append(f"*{p['title_en']}*\n")
        L.append("> " + p["en"].strip() + "\n")
        L.append(p["zh"].strip() + "\n")

    L.append("## 追问地图（12 层）\n")
    L.append("| # | 层次 | Examiner asks | 考官问 |")
    L.append("|---|---|---|---|")
    iv = next(sc for sc in data["scenes"] if sc["id"] == "S12_Interview")
    segs = {s["id"]: s for s in iv["segments"]}
    for k in range(1, 13):
        q = segs[f"q{k}"]
        L.append(f"| Q{k} | {q['level']['zh']} · {q['level']['en']} | {md_escape(q['en'])} | {md_escape(q['zh_tr'])} |")
    L.append("")

    L.append("## 逐段对照讲稿\n")
    chapters = {c["id"]: c for c in data["chapters"]}
    for n, sc in enumerate(data["scenes"], 1):
        ch = chapters[sc["chapter"]]
        L.append(f"### {n:02d} {ch['zh']} · {ch['en']}\n")
        for seg in sc["segments"]:
            sp = seg.get("speaker", "narrator")
            if sp == "examiner":
                L.append(f"**Q{seg['id'][1:]} · {seg['level']['zh']} / {seg['level']['en']}**\n")
                L.append(f"- **Examiner:** {seg['en']}")
                L.append(f"- **考官：** {seg['zh_tr']}\n")
            elif sp == "candidate":
                L.append(f"- **You:** {seg['en']}")
                L.append(f"- **你：** {seg['zh_tr']}")
                if seg.get("keys"):
                    L.append(f"- **Answer structure:** " + " → ".join(seg["keys"]))
                L.append(f"- **答题要点：** {seg['zh']}\n")
            else:
                L.append(f"{seg_text(seg, 'en')}\n")
                L.append(f"{seg_text(seg, 'zh')}\n")
            if seg.get("vocab"):
                g = data["glossary"]
                L.append("<sub>" + " · ".join(f"**{w}** {g[w][0]} {g[w][1]}" for w in seg["vocab"] if w in g) + "</sub>\n")

    L.append("## 难词表（美式音标）\n")
    L.append("| 词语 Word | 音标 IPA | 中文 |")
    L.append("|---|---|---|")
    for w, (ipa, zh) in sorted(data["glossary"].items(), key=lambda kv: kv[0].lower()):
        L.append(f"| {w} | {ipa} | {zh} |")
    L.append("")

    L.append("## 一页纸证明（复习用）\n")
    L.append(PROOF_PAGE)
    return "\n".join(L)


PROOF_PAGE = r"""
**定理.** 奇素数 $p$ 满足 $p=x^2+y^2$（$x,y\in\mathbb Z$）当且仅当 $p\equiv1\pmod 4$。

**必要性.** $n^2\equiv0$ 或 $1\pmod4$，所以 $x^2+y^2\not\equiv3\pmod4$。

**充分性（扎吉尔, 1990）.** 设 $S=\{(x,y,z)\in\mathbb Z_{>0}^3: x^2+4yz=p\}$，有限。

1. $g(x,y,z)=(x,z,y)$ 是对合；$g$ 的不动点 $\Leftrightarrow y=z \Leftrightarrow p=x^2+(2y)^2$。
2. 对合把非不动点两两配对，所以 $|S|\equiv\#\mathrm{Fix}(g)\pmod2$。只需证 $|S|$ 为奇数。
3. 扎吉尔对合
   $f(x,y,z)=(x+2z,\,z,\,y-x-z)$ 若 $x<y-z$；$(2y-x,\,y,\,x-y+z)$ 若 $y-z<x<2y$；$(x-2y,\,x-y+z,\,y)$ 若 $x>2y$。
   边界 $x=y-z$ 推出 $p=(y+z)^2$，$x=2y$ 推出 $p=4y(y+z)$，对奇素数都不可能，所以 $f$ 处处有定义，且 $f\circ f=\mathrm{id}$。
4. $f$ 的不动点满足 $x=y$，于是 $p=x(x+4z)$，素数性给出 $x=1$：唯一不动点 $(1,1,\tfrac{p-1}{4})$。
5. 所以 $|S|$ 为奇数，$g$ 至少有一个不动点。$\blacksquare$

**几何图像.** $x^2+4yz$ 是“风车”的面积：边长 $x$ 的正方形 + 四片 $y\times z$ 风叶。$g$ = 翻转每片风叶；
$f$ = 擦去内部分割线，用另一个中心正方形重新切割同一个轮廓（过四个叶尖的正方形能放进轮廓就用它，否则用过风叶外侧边的正方形）。

**条件检验.** $n=21$：$S$ 有 4 个元素，$f$ 有两个不动点 $(1,1,5)$ 与 $(3,3,1)$，论证失效；$21$ 确实不是平方和。

**算法.** 从十字 $(1,1,k)$ 出发交替作用 $g, f, g, \dots$，每个元素至多两个“邻居”，路径不会重复，终点是 $g$ 的不动点。
$p=41$：$(1,1,10)\to(1,10,1)\to(3,1,8)\to(3,8,1)\to(5,1,4)\to(5,4,1)\to(3,4,2)\to(3,2,4)\to(1,2,5)\to(1,5,2)\to(5,2,2)$，得 $41=5^2+4^2$。

**推广.** $n=a^2+b^2 \iff n$ 的每个 $4k+3$ 型素因子都出现偶数次；在 $\mathbb Z[i]$ 中 $p\equiv1\ (4)$ 分裂为 $(a+bi)(a-bi)$，表示唯一；
$x^2+2y^2$：$p=2$ 或 $p\equiv1,3\pmod8$；$x^2+3y^2$：$p=3$ 或 $p\equiv1\pmod3$；四平方和定理（拉格朗日）；三平方和定理（勒让德）。

**应用.** $(a+bi)^2=(a^2-b^2)+2abi$ 给出斜边为 $p$ 的勾股三角形；圆内格点计数 $\Rightarrow \frac{\pi}{4}=1-\frac13+\frac15-\cdots$。
"""


CSS = """
@page { size: A4; margin: 16mm 14mm; }
:root { --ink:#1b1f2a; --muted:#5b6475; --gold:#b8860b; --teal:#178f89; --line:#e3e6ee; --bg:#ffffff; }
body { font-family: "Inter","Noto Sans CJK SC",sans-serif; color: var(--ink); background: var(--bg);
       max-width: 900px; margin: 24px auto; padding: 0 16px; line-height: 1.62; font-size: 14.5px; }
h1 { font-size: 28px; margin: 0 0 6px; }
h2 { font-size: 20px; border-bottom: 2px solid var(--gold); padding-bottom: 4px; margin-top: 34px; }
h3 { font-size: 16.5px; color: var(--teal); margin-top: 26px; }
.sub { color: var(--muted); margin-bottom: 18px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 9px 0; border-top: 1px solid var(--line);
        break-inside: avoid; }
.pair .en { font-family: "Inter", sans-serif; }
.pair .zh { font-family: "Noto Sans CJK SC", sans-serif; color: #2b3242; }
.vocab { grid-column: 1 / span 2; font-size: 12.5px; color: var(--muted); }
.vocab b { color: var(--gold); }
.ipa { font-family: "Charis SIL", "DejaVu Sans", serif; }
.q { background: #eef5ff; border-left: 4px solid #3d7fd6; padding: 8px 12px; margin-top: 14px; break-inside: avoid; }
.a { background: #fbf7ea; border-left: 4px solid var(--gold); padding: 8px 12px; margin: 6px 0 4px; break-inside: avoid; }
.tip { font-size: 13.5px; color: #3a4252; padding: 4px 12px 10px; }
.tag { display:inline-block; font-size: 12px; background: var(--teal); color: #fff; border-radius: 4px; padding: 0 6px; margin-right: 6px; }
.keys { font-size: 13px; color: var(--muted); }
blockquote { margin: 8px 0; padding: 10px 14px; background: #f5f6fa; border-left: 4px solid var(--teal); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
td, th { border: 1px solid var(--line); padding: 5px 7px; vertical-align: top; }
th { background: #f5f6fa; }
.proof { font-size: 14px; }
@media print { body { margin: 0; max-width: none; } }
"""


def h(s):
    return html.escape(s)


def tex_to_html(s: str) -> str:
    """Very small TeX -> HTML for the proof page (rendered by KaTeX when online; readable as text when not)."""
    return h(s)


def build_html(data, durations):
    m = data["meta"]
    g = data["glossary"]
    P = []
    P.append(f"<h1>{h(m['title_zh'])} · {h(m['title_en'])}</h1>")
    P.append(f"<div class='sub'>中英对照讲稿 · {h(m['subtitle_zh'])} / {h(m['subtitle_en'])}"
             + (f"<br>视频：中文版约 {durations['zh']} 分钟，英文版约 {durations['en']} 分钟" if durations else "")
             + "</div>")
    P.append("<h2>选题与使用说明</h2>")
    for para in INTRO_ZH.split("\n\n"):
        P.append("<p>" + re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", h(para.replace("\n", ""))) + "</p>")
    P.append("<h2>面试速用：可以直接说的英文回答</h2>")
    for p in data["pitches"]:
        P.append(f"<h3>{h(p['title_zh'])}</h3><div class='sub'>{h(p['title_en'])}</div>")
        P.append(f"<blockquote>{h(p['en'].strip())}</blockquote><p>{h(p['zh'].strip())}</p>")
    iv = next(sc for sc in data["scenes"] if sc["id"] == "S12_Interview")
    segs = {s["id"]: s for s in iv["segments"]}
    P.append("<h2>追问地图（12 层）</h2><table><tr><th>#</th><th>层次</th><th>Examiner asks</th><th>考官问</th></tr>")
    for k in range(1, 13):
        q = segs[f"q{k}"]
        P.append(f"<tr><td>Q{k}</td><td>{h(q['level']['zh'])}<br><span class='keys'>{h(q['level']['en'])}</span></td>"
                 f"<td>{h(q['en'])}</td><td>{h(q['zh_tr'])}</td></tr>")
    P.append("</table>")
    P.append("<h2>逐段对照讲稿</h2>")
    chapters = {c["id"]: c for c in data["chapters"]}

    def vocab_html(seg):
        if not seg.get("vocab"):
            return ""
        items = [f"<b>{h(w)}</b> <span class='ipa'>{h(g[w][0])}</span> {h(g[w][1])}" for w in seg["vocab"] if w in g]
        return "<div class='vocab'>" + " · ".join(items) + "</div>"

    for n, sc in enumerate(data["scenes"], 1):
        ch = chapters[sc["chapter"]]
        P.append(f"<h3>{n:02d} {h(ch['zh'])} · {h(ch['en'])}</h3>")
        for seg in sc["segments"]:
            sp = seg.get("speaker", "narrator")
            if sp == "examiner":
                P.append(f"<div class='q'><span class='tag'>Q{seg['id'][1:]} · {h(seg['level']['zh'])}</span>"
                         f"<b>Examiner:</b> {h(seg['en'])}<br><b>考官：</b>{h(seg['zh_tr'])}</div>")
            elif sp == "candidate":
                P.append(f"<div class='a'><b>You:</b> {h(seg['en'])}<br><b>你：</b>{h(seg['zh_tr'])}"
                         + (f"<div class='keys'>Answer structure: {' → '.join(h(k) for k in seg.get('keys', []))}</div>"
                            if seg.get("keys") else "") + "</div>")
                P.append(f"<div class='tip'><b>答题要点：</b>{h(seg['zh'])}</div>")
                if seg.get("vocab"):
                    P.append(vocab_html(seg))
            else:
                P.append(f"<div class='pair'><div class='en'>{h(seg_text(seg, 'en'))}</div>"
                         f"<div class='zh'>{h(seg_text(seg, 'zh'))}</div>{vocab_html(seg)}</div>")
    P.append("<h2>难词表（美式音标）</h2><table><tr><th>词语 Word</th><th>音标 IPA</th><th>中文</th></tr>")
    for w, (ipa, zh) in sorted(g.items(), key=lambda kv: kv[0].lower()):
        P.append(f"<tr><td>{h(w)}</td><td class='ipa'>{h(ipa)}</td><td>{h(zh)}</td></tr>")
    P.append("</table>")
    P.append("<h2>一页纸证明（复习用）</h2><div class='proof'>" + proof_html() + "</div>")
    return ("<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width, initial-scale=1'>"
            f"<title>{h(m['title_zh'])} 中英对照讲稿</title><style>{CSS}</style></head><body>"
            + "\n".join(P) + "</body></html>")


def proof_html():
    """The proof page with math written in plain Unicode (no JS needed, prints cleanly)."""
    t = """
<p><b>定理.</b> 奇素数 p 满足 p = x² + y²（x, y 为整数）当且仅当 p ≡ 1 (mod 4)。</p>
<p><b>必要性.</b> n² ≡ 0 或 1 (mod 4)，所以 x² + y² ≢ 3 (mod 4)。</p>
<p><b>充分性（扎吉尔, 1990）.</b> 设 S = {(x, y, z) 为正整数 : x² + 4yz = p}，S 有限。</p>
<ol>
<li>g(x, y, z) = (x, z, y) 是对合；g 的不动点 ⇔ y = z ⇔ p = x² + (2y)²。</li>
<li>对合把非不动点两两配对，所以 |S| ≡ #Fix(g) (mod 2)。只需证明 |S| 为奇数。</li>
<li>扎吉尔对合：f(x, y, z) = (x + 2z, z, y − x − z) 若 x &lt; y − z；(2y − x, y, x − y + z) 若 y − z &lt; x &lt; 2y；
(x − 2y, x − y + z, y) 若 x &gt; 2y。边界 x = y − z 推出 p = (y + z)²，x = 2y 推出 p = 4y(y + z)，对奇素数都不可能，
所以 f 处处有定义，且 f∘f = id。</li>
<li>f 的不动点满足 x = y，于是 p = x(x + 4z)；p 是素数，所以 x = 1：唯一不动点是 (1, 1, (p − 1)/4)。</li>
<li>所以 |S| 为奇数，g 至少有一个不动点。∎</li>
</ol>
<p><b>几何图像.</b> x² + 4yz 是“风车”的面积：边长 x 的正方形加四片 y × z 的风叶。g 就是翻转每片风叶；f 就是擦去内部分割线，
用另一个中心正方形重新切割同一个轮廓：经过四个叶尖的正方形若能放进轮廓就用它，否则用经过风叶外侧边的正方形。</p>
<p><b>条件检验.</b> n = 21：S = {(1,1,5), (1,5,1), (3,1,3), (3,3,1)}，f 有两个不动点 (1,1,5) 与 (3,3,1)，论证失效；21 确实不是平方和。</p>
<p><b>算法.</b> 从十字 (1, 1, k) 出发交替作用 g, f, g, …；每个元素至多两个“邻居”，路径不会重复，终点是 g 的不动点。
p = 41：(1,1,10) → (1,10,1) → (3,1,8) → (3,8,1) → (5,1,4) → (5,4,1) → (3,4,2) → (3,2,4) → (1,2,5) → (1,5,2) → (5,2,2)，
得 41 = 5² + 4²。</p>
<p><b>推广.</b> n = a² + b² ⇔ n 的每个 4k + 3 型素因子都出现偶数次；在 ℤ[i] 中 p ≡ 1 (mod 4) 分裂为 (a + bi)(a − bi)，表示法唯一；
x² + 2y²：p = 2 或 p ≡ 1, 3 (mod 8)；x² + 3y²：p = 3 或 p ≡ 1 (mod 3)；四平方和定理（拉格朗日）；三平方和定理（勒让德）。</p>
<p><b>应用.</b> (a + bi)² = (a² − b²) + 2ab·i 给出斜边为 p 的整数直角三角形；圆内格点计数推出 π/4 = 1 − 1/3 + 1/5 − 1/7 + …</p>
"""
    return t


def main():
    data = SL.load()
    durations = {}
    for lang in ("zh", "en"):
        fn = ROOT / "output" / f"fermat_windmill_{lang}.mp4"
        if fn.exists():
            d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                               "-of", "csv=p=0", str(fn)]).decode())
            durations[lang] = f"{d / 60:.0f}"
    if len(durations) < 2:
        durations = {}
    OUT.mkdir(exist_ok=True)
    md = build_md(data, durations)
    (OUT / "transcript_bilingual.md").write_text(md, encoding="utf-8")
    page = build_html(data, durations)
    (OUT / "transcript_bilingual.html").write_text(page, encoding="utf-8")
    subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={OUT / 'transcript_bilingual.pdf'}",
                    (OUT / "transcript_bilingual.html").as_uri()], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("wrote transcript_bilingual.md/.html/.pdf")


if __name__ == "__main__":
    main()
