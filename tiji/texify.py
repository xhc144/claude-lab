"""把题目和想法排成 LaTeX：公式识别、转义、按关键词分章、编译出错时定位到具体哪道题。"""
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from PIL import Image

TEX_DIR = Path(__file__).resolve().parent / "tex"
_env = Environment(
    loader=FileSystemLoader(TEX_DIR),
    block_start_string="<%", block_end_string="%>",
    variable_start_string="<<", variable_end_string=">>",
    comment_start_string="<#", comment_end_string="#>",
    trim_blocks=True, lstrip_blocks=True, autoescape=False, keep_trailing_newline=True,
)

UNCATEGORIZED = "未归类"


@dataclass
class ExportOptions:
    title: str = "题记"
    subtitle: str = ""
    author: str = ""
    group: bool = True          # 按关键词分章
    focus: str = ""             # 只导出某个关键词时，全部归到这一章
    layout: str = "compact"     # compact | chapter（每章新页）| single（每题一页）
    images: bool = True         # 附上原图
    keyword_order: list = field(default_factory=list)


# ------------------------------------------------------------------ 文本 → LaTeX

_ENVS = (r"(?:equation|align|alignat|gather|multline|flalign|aligned|gathered|alignedat|split"
         r"|cases|dcases|array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix)\*?")
_SEG = re.compile(
    r"(?P<dd>\$\$(?P<dd_b>.+?)\$\$)"
    r"|(?P<br>\\\[(?P<br_b>.+?)\\\])"
    r"|(?P<pa>\\\((?P<pa_b>.+?)\\\))"
    r"|(?P<env>\\begin\{(?P<env_n>" + _ENVS + r")\}.*?\\end\{(?P=env_n)\})"
    r"|(?P<d>(?<!\\)\$(?P<d_b>(?:\\.|[^$\\])+?)\$)",
    re.S,
)
_TOPLEVEL_ENVS = {"equation", "align", "alignat", "gather", "multline", "flalign"}


def segments(text):
    """切成 ('text'|'inline'|'display'|'env', 内容)。和前端 app.js 里的 segments 保持一致。"""
    out, pos = [], 0
    for m in _SEG.finditer(text):
        if m.start() > pos:
            out.append(("text", text[pos:m.start()]))
        if m.group("dd") is not None:
            out.append(("display", m.group("dd_b")))
        elif m.group("br") is not None:
            out.append(("display", m.group("br_b")))
        elif m.group("pa") is not None:
            out.append(("inline", m.group("pa_b")))
        elif m.group("env") is not None:
            out.append(("env", m.group("env")))
        else:
            out.append(("inline", m.group("d_b")))
        pos = m.end()
    if pos < len(text):
        out.append(("text", text[pos:]))
    return out


def _math(body):
    return re.sub(r"\n\s*\n", "\n", body).strip()


def _env_to_tex(src):
    name = re.match(r"\\begin\{([a-zA-Z]+)\*?\}", src).group(1)
    src = _math(src)
    if name in _TOPLEVEL_ENVS:  # 不要公式编号
        src = re.sub(r"\\(begin|end)\{" + name + r"\}", r"\\\1{" + name + "*}", src)
        return "\n" + src + "\n"
    return "\n\\[\n" + src + "\n\\]\n"


def escape_text(s):
    """普通文字里的特殊字符转义；已经写成 \\命令 的保留。"""
    s = re.sub(r"(?<!\\)([#%&$])", r"\\\1", s)
    s = re.sub(r"(?<!\\)_", r"\\_", s)
    s = re.sub(r"(?<!\\)\^", r"\\^{}", s)
    s = re.sub(r"(?<!\\)~", r"\\textasciitilde{}", s)
    if s.count("{") != s.count("}"):
        s = re.sub(r"(?<!\\)([{}])", r"\\\1", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", s)
    s = re.sub(r'"([^"\n]+?)"', "\u201c\\1\u201d", s)  # 直引号换成弯引号
    return s


def escape_plain(s):
    """出处、关键词、标题这类纯文字：全部转义。"""
    rep = {"\\": r"\textbackslash{}", "{": r"\{", "}": r"\}", "#": r"\#", "%": r"\%", "&": r"\&",
           "$": r"\$", "_": r"\_", "^": r"\^{}", "~": r"\textasciitilde{}"}
    return "".join(rep.get(c, c) for c in str(s))


def to_latex(text):
    segs = segments((text or "").replace("\r\n", "\n").strip())
    out = []
    for i, (kind, s) in enumerate(segs):
        if kind == "text":
            if i + 1 < len(segs) and segs[i + 1][0] in ("display", "env"):
                s = s.rstrip()
            if i > 0 and segs[i - 1][0] in ("display", "env"):
                s = s.lstrip()
            s = re.sub(r"\n\s*\n+", "\n", s)
            out.append("\\par\n".join(escape_text(line) for line in s.split("\n")))
        elif kind == "inline":
            out.append("$" + _math(s) + "$")
        elif kind == "display":
            out.append("\n\\[\n" + _math(s) + "\n\\]\n")
        else:
            out.append(_env_to_tex(s))
    return "".join(out).strip()


def excerpt(text, limit=30):
    """一行摘要（目录、另见里用）：截断文字，公式整段保留，太长的公式省略。"""
    parts, n, cut = [], 0, False
    for kind, s in segments((text or "").strip()):
        if n >= limit:
            cut = True
            break
        if kind == "text":
            s = re.sub(r"\s+", " ", s)
            take = s[: limit - n]
            parts.append(escape_text(take))
            n += len(take)
            if len(take) < len(s):
                cut = True
                break
        elif kind in ("inline", "display") and len(s) <= 48 and "\\\\" not in s and "\\begin" not in s:
            s = re.sub(r"\\(?:displaystyle|limits)(?![a-zA-Z])", "", s).replace("\\dfrac", "\\tfrac")
            parts.append("$" + _math(s).replace("\n", " ") + "$")
            n += max(2, len(s) // 3)
        else:
            cut = True
            break
    out = "".join(parts).strip()
    return out + ("…" if cut and out else "")


# ------------------------------------------------------------------ 组装

def _image_width(path):
    """按像素宽度换算成版心宽度的比例：小截图不硬拉满，大图最多占 92%。"""
    try:
        with Image.open(path) as im:
            w = im.width
    except OSError:
        return 0.9
    return round(max(0.35, min(0.92, w / 1100)), 3)


def _entry(n, images_dir, with_images):
    date = (n.get("created") or "")[:10]
    image = n.get("image") or ""
    has_image = with_images and image and (images_dir / image).is_file()
    return {
        "seq": n["seq"],
        "no": f"{n['seq']:02d}",
        "label": f"tj-note-{n['seq']}",
        "source": escape_plain(n.get("source") or ""),
        "date": date.replace("-", ".") if date else "",
        "problem": to_latex(n.get("problem") or ""),
        "ideas": _ideas(n),
        "keywords_raw": list(n.get("keywords") or []),
        "keywords": [escape_plain(k) for k in n.get("keywords") or []],
        "image": f"img/{image}" if has_image else "",
        "image_width": _image_width(images_dir / image) if has_image else 0,
        "excerpt": excerpt(_mine(n)[0]["text"] if _mine(n) else "") or excerpt(n.get("problem") or ""),
    }


def note_ideas(n):
    """兼容旧数据：只有一段 idea 文本时当成一条自己的想法。"""
    if "ideas" in n:
        return [i for i in n["ideas"] if (i.get("text") or "").strip()]
    return [{"text": n["idea"], "by": "me"}] if (n.get("idea") or "").strip() else []


def _mine(n):
    return [i for i in note_ideas(n) if i.get("by") != "ai"]


def _ideas(n):
    """PDF 里的标签：一条就叫「我的想法」，多条编号「想法 1/2…」，AI 给的叫「AI 思路」。"""
    items, mine_total, k = [], len(_mine(n)), 0
    for i in note_ideas(n):
        if i.get("by") == "ai":
            label, ai = "AI 思路", True
        else:
            k += 1
            label, ai = ("我的想法" if mine_total == 1 else f"想法 {k}"), False
        items.append({"label": label, "ai": ai, "text": to_latex(i["text"])})
    return items


def _date_span(notes):
    days = sorted((n.get("created") or "")[:10] for n in notes if n.get("created"))
    if not days:
        return ""
    a, b = days[0].replace("-", "."), days[-1].replace("-", ".")
    if a == b:
        return a
    return f"{a} - {b[5:]}" if a[:4] == b[:4] else f"{a} - {b}"


def build_groups(entries, opts):
    if not opts.group:
        return [{"name": "", "items": entries, "see": []}]
    if opts.focus:
        return [{"name": escape_plain(opts.focus), "items": entries, "see": []}]
    used = []
    for e in entries:
        for k in e["keywords_raw"]:
            if k not in used:
                used.append(k)
    order = [k for k in opts.keyword_order if k in used] + sorted(k for k in used if k not in opts.keyword_order)
    groups = []
    for k in order:
        items = [e for e in entries if e["keywords_raw"] and e["keywords_raw"][0] == k]
        see = [e for e in entries if k in e["keywords_raw"][1:]]
        groups.append({"name": escape_plain(k), "raw": k, "items": items, "see": see})
    rest = [e for e in entries if not e["keywords_raw"]]
    if rest:
        groups.append({"name": UNCATEGORIZED, "raw": UNCATEGORIZED, "items": rest, "see": []})
    return groups


def render(notes, opts, images_dir):
    notes = sorted(notes, key=lambda n: n["seq"])
    entries = [_entry(n, Path(images_dir), opts.images) for n in notes]
    groups = build_groups(entries, opts)
    for i, g in enumerate(groups, 1):
        g["index"] = i
        g["anchor"] = f"tj-kw-{i}"
        g["count"] = len(g["items"]) + len(g["see"])
        # 目录：该关键词下的全部题目（主条目 + 另见），按编号排
        g["toc"] = sorted(g["items"] + g["see"], key=lambda e: e["seq"])
    keywords = []
    for e in entries:
        for k in e["keywords_raw"]:
            if k not in keywords:
                keywords.append(k)
    kw_counts = [(escape_plain(k), sum(k in e["keywords_raw"] for e in entries)) for k in keywords]
    ctx = {
        "title": escape_plain(opts.title or "题记"),
        "subtitle": escape_plain(opts.subtitle),
        "author": escape_plain(opts.author),
        "now": datetime.now().strftime("%Y.%m.%d"),
        "year": datetime.now().strftime("%Y"),
        "count": len(entries),
        "kw_count": len(keywords),
        "kw_counts": kw_counts,
        "span": _date_span(notes),
        "groups": groups,
        "grouped": opts.group,
        "layout": opts.layout if opts.layout in ("compact", "chapter", "single") else "compact",
    }
    tex = _env.get_template("notebook.tex").render(**ctx)
    used = [e["image"][4:] for e in entries if e["image"]]
    return tex, used


# ------------------------------------------------------------------ 编译前先查一遍最常见的错

def _math_problem(tex):
    body = re.sub(r"\\[{}]", "", tex)
    if body.count("{") != body.count("}"):
        return "花括号 { } 没配对"
    if len(re.findall(r"\\left(?![a-zA-Z])", tex)) != len(re.findall(r"\\right(?![a-zA-Z])", tex)):
        return "\\left 和 \\right 数量不一致"
    if tex.count("\\begin{") != tex.count("\\end{"):
        return "\\begin 和 \\end 没配对"
    return ""


def preflight(notes):
    """发现会让整份文档编不过的公式，直接指出是哪道题、哪段公式。"""
    for n in sorted(notes, key=lambda x: x["seq"]):
        fields = [("题目", n.get("problem") or "")] + [
            ("AI 思路" if i.get("by") == "ai" else "想法", i["text"]) for i in note_ideas(n)]
        for label, text in fields:
            for kind, s in segments(text):
                if kind == "text":
                    continue
                why = _math_problem(s)
                if why:
                    shown = s if len(s) <= 80 else s[:77] + "…"
                    return {"message": f"No.{n['seq']:02d} 的{label}里有一段公式{why}。",
                            "seq": n["seq"], "detail": why, "snippet": shown}
    return None


# ------------------------------------------------------------------ 出错时说人话

_HINTS = [
    (r"Undefined control sequence", "有一个 LaTeX 命令不认识，可能拼错了，或者是 KaTeX 才有的写法。"),
    (r"Missing \$ inserted", "公式的 $ 没配对，或者把数学符号（如 \\alpha、^、_）写在了公式外面。"),
    (r"Extra \}, or forgotten|Missing \} inserted|Extra \\right|Missing \\right", "括号没配对：检查 { }、\\left \\right。"),
    (r"Misplaced alignment tab character &", "& 只能用在矩阵或对齐环境里。"),
    (r"Display math should end with \$\$|Bad math environment delimiter", "独立公式的 $$ 没配对。"),
    (r"File `.*' not found", "缺少 LaTeX 宏包或图片文件。"),
    (r"fontspec", "字体加载失败，检查 TeX Live 是否完整。"),
]


def explain_error(log, tex):
    m = re.search(r"^\./main\.tex:(\d+): (.+)$", log, re.M) or re.search(r"^.*?:(\d+): (.+)$", log, re.M)
    if m:
        line, msg = int(m.group(1)), m.group(2).strip()
    else:
        m2 = re.search(r"^! (.+)$", log, re.M)
        line, msg = None, (m2.group(1).strip() if m2 else "LaTeX 编译失败")
    hint = next((h for pat, h in _HINTS if re.search(pat, msg)), "")
    seq = None
    lines = tex.split("\n")
    if line:
        for i in range(min(line, len(lines)) - 1, -1, -1):
            mm = re.match(r"% @@note (\d+)", lines[i])
            if mm:
                seq = int(mm.group(1))
                break
            if lines[i].startswith("% @@end"):
                break
    snippet = lines[line - 1].strip()[:160] if line and line <= len(lines) else ""
    where = f"No.{seq:02d} 这道题" if seq else "文档"
    return {"message": f"{where}排版出错：{hint or msg}", "seq": seq, "detail": msg, "snippet": snippet}
