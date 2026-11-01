"""题记 —— 题目、原图与想法的本地笔记本。

平时双击 题记.exe（由 build.ps1 打包）；改代码时可以直接  python app.py
数据都在 data/ 目录：notes.json 是全部题目，images/ 是原图，backup/ 是每天的自动备份。
"""
import base64
import io
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import uuid
import webbrowser
from datetime import datetime
from pathlib import Path

import requests
from flask import Flask, jsonify, request, send_file, send_from_directory
from PIL import Image, ImageOps

import texify

FROZEN = getattr(sys, "frozen", False)  # 打包成 题记.exe 运行时
ROOT = Path(sys._MEIPASS) if FROZEN else Path(__file__).resolve().parent  # 页面、模板在这里
# 数据和导出放在哪：exe 旁边；从源码运行时放在「源码」的上一级，和 exe 共用同一份数据
_default_home = Path(sys.executable).parent if FROZEN else (ROOT.parent if ROOT.name == "源码" else ROOT)
HOME = Path(os.environ.get("TIJI_HOME") or _default_home)
STATIC = ROOT / "static"
DATA = HOME / "data"
IMAGES = DATA / "images"
BACKUP = DATA / "backup"
EXPORTS = HOME / "exports"
NOTES_FILE = DATA / "notes.json"
SETTINGS_FILE = DATA / "settings.json"
DELETED_FILE = DATA / "deleted.json"
HOST, PORT = "127.0.0.1", int(os.environ.get("TIJI_PORT") or 5178)
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

DEFAULT_KEYWORDS = [
    "多项式", "特征值", "矩阵", "行列式", "线性方程组", "二次型", "向量空间", "线性变换",
    "极限", "连续", "导数", "积分", "级数", "微分方程", "不等式", "数列",
    "凸函数", "梯度下降", "线搜索", "牛顿法", "拉格朗日乘子", "KKT 条件",
    "概率", "组合计数", "几何",
]
DEFAULT_SETTINGS = {
    "api_key": "",
    "base_url": "https://api.deepseek.com",
    "vision_model": "deepseek-flash",
    "text_model": "deepseek-flash",
    "keywords": DEFAULT_KEYWORDS,
    "doc_title": "题记",
    "doc_subtitle": "一题一念：题目、原图与我的想法",
    "author": "",
}
SAFE_IMAGE = re.compile(r"[0-9a-f]{32}\.(?:png|jpg)")

# 前端用到的 TeX Live 字体（只读，按文件名白名单提供）
TEX_FONTS = {
    "STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoText-SemiBold.otf",
    "IBMPlexMono-Regular.otf", "IBMPlexMono-Medium.otf", "LXGWWenKaiGBLite-Regular.ttf",
}

app = Flask(__name__, static_folder=str(STATIC), static_url_path="/static")
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
_lock = threading.RLock()
_export_lock = threading.Lock()
_font_paths: dict[str, str | None] = {}


class UserError(Exception):
    """要原样展示给用户的错误。"""

    def __init__(self, message, status=400, **extra):
        super().__init__(message)
        self.status = status
        self.extra = extra


@app.errorhandler(UserError)
def _user_error(e):
    return jsonify({"error": str(e), **e.extra}), e.status


# ------------------------------------------------------------------ 存储

def _read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def _write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _clean_ideas(raw):
    """想法是一条一条的：[{id, text, by}]，by 是 me（自己写的）或 ai（AI 给的思路）。空的不存。"""
    out = []
    for it in raw or []:
        if isinstance(it, str):
            it = {"text": it}
        text = str(it.get("text") or "").replace("\r\n", "\n").strip()
        if not text:
            continue
        iid = str(it.get("id") or "")
        out.append({"id": iid if re.fullmatch(r"[0-9a-z]{1,16}", iid) else uuid.uuid4().hex[:8],
                    "text": text, "by": "ai" if it.get("by") == "ai" else "me"})
    return out


def normalize_note(n):
    if "ideas" not in n:  # 旧数据只有一条 idea 文本
        n["ideas"] = _clean_ideas([n.get("idea") or ""])
    n.pop("idea", None)
    return n


def load_db():
    db = _read_json(NOTES_FILE, {"next_seq": 1, "notes": []})
    for n in db["notes"]:
        normalize_note(n)
    return db


def ideas_text(n):
    return "\n\n".join(i["text"] for i in n.get("ideas") or [])


def save_db(db):
    _write_json(NOTES_FILE, db)
    daily = BACKUP / f"notes-{datetime.now():%Y%m%d}.json"
    if not daily.exists():
        BACKUP.mkdir(parents=True, exist_ok=True)
        shutil.copy2(NOTES_FILE, daily)


def load_settings():
    s = dict(DEFAULT_SETTINGS)
    s.update(_read_json(SETTINGS_FILE, {}))
    return s


def public_settings(s=None):
    s = s or load_settings()
    key = s.get("api_key") or ""
    out = {k: v for k, v in s.items() if k != "api_key"}
    out["has_key"] = bool(key)
    out["key_hint"] = f"{key[:3]}…{key[-4:]}" if len(key) > 8 else ""
    out["xelatex"] = bool(shutil.which("xelatex"))
    return out


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def _clean_keywords(raw):
    out = []
    for k in raw or []:
        k = re.sub(r"\s+", " ", str(k)).strip(" #，,、;；")
        if k and k not in out:
            out.append(k[:24])
    return out


def _apply_fields(note, payload):
    for k in ("problem", "source"):
        if k in payload:
            note[k] = str(payload.get(k) or "").replace("\r\n", "\n").strip()
    if "ideas" in payload:
        note["ideas"] = _clean_ideas(payload.get("ideas"))
    elif "idea" in payload:
        note["ideas"] = _clean_ideas([payload.get("idea") or ""])
    if "keywords" in payload:
        note["keywords"] = _clean_keywords(payload.get("keywords"))
    if "image" in payload:
        img = payload.get("image") or ""
        note["image"] = img if SAFE_IMAGE.fullmatch(img) and (IMAGES / img).is_file() else ""
    return note


# ------------------------------------------------------------------ 页面与静态文件

@app.get("/")
def index():
    return send_from_directory(STATIC, "index.html")


@app.get("/images/<name>")
def image_file(name):
    if not SAFE_IMAGE.fullmatch(name):
        raise UserError("图片名不对", 404)
    return send_from_directory(IMAGES, name)


@app.get("/texfont/<name>")
def tex_font(name):
    if name not in TEX_FONTS:
        raise UserError("没有这个字体", 404)
    if name not in _font_paths:
        try:
            out = subprocess.run(["kpsewhich", name], capture_output=True, text=True,
                                 timeout=20, creationflags=NO_WINDOW).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            out = ""
        _font_paths[name] = out if out and os.path.isfile(out) else None
    path = _font_paths[name]
    if not path:
        raise UserError("本机 TeX Live 里没有这个字体", 404)
    resp = send_file(path, max_age=86400 * 30)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


# ------------------------------------------------------------------ 题目 CRUD

@app.get("/api/state")
def state():
    with _lock:
        db = load_db()
    return jsonify({"notes": db["notes"], "settings": public_settings()})


@app.post("/api/notes")
def create_note():
    payload = request.get_json(force=True) or {}
    with _lock:
        db = load_db()
        note = _apply_fields({"id": uuid.uuid4().hex[:12], "seq": db["next_seq"],
                              "problem": "", "ideas": [], "source": "", "keywords": [], "image": "",
                              "created": now_iso()}, payload)
        note["updated"] = note["created"]
        db["next_seq"] += 1
        db["notes"].append(note)
        save_db(db)
    return jsonify(note)


@app.put("/api/notes/<nid>")
def update_note(nid):
    payload = request.get_json(force=True) or {}
    with _lock:
        db = load_db()
        note = next((n for n in db["notes"] if n["id"] == nid), None)
        if note is None:
            raise UserError("这道题已经不存在了", 404)
        _apply_fields(note, payload)
        note["updated"] = now_iso()
        save_db(db)
    return jsonify(note)


@app.delete("/api/notes/<nid>")
def delete_note(nid):
    with _lock:
        db = load_db()
        note = next((n for n in db["notes"] if n["id"] == nid), None)
        if note is None:
            raise UserError("这道题已经不存在了", 404)
        db["notes"].remove(note)
        save_db(db)
        # 删除的题目和原图都留着，放进 deleted.json，万一删错还能找回
        trash = _read_json(DELETED_FILE, [])
        trash.append({**note, "deleted": now_iso()})
        _write_json(DELETED_FILE, trash)
    return jsonify({"ok": True})


@app.post("/api/image")
def upload_image():
    f = request.files.get("file")
    if not f:
        raise UserError("没有收到图片")
    try:
        im = Image.open(f.stream)
        fmt = im.format
        im.load()
    except Exception:
        raise UserError("这个文件不是能识别的图片")
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.getchannel("A"))
        im = bg
    elif im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    if max(im.size) > 3200:
        im.thumbnail((3200, 3200), Image.LANCZOS)
    IMAGES.mkdir(parents=True, exist_ok=True)
    if fmt == "JPEG":  # 照片用 JPEG 存，截图用 PNG 保证文字清晰
        name = uuid.uuid4().hex + ".jpg"
        im.convert("RGB").save(IMAGES / name, "JPEG", quality=92)
    else:
        name = uuid.uuid4().hex + ".png"
        im.save(IMAGES / name, "PNG", optimize=True)
    return jsonify({"image": name, "w": im.width, "h": im.height})


# ------------------------------------------------------------------ DeepSeek

def ds_chat(messages, model_key="text_model", timeout=150):
    s = load_settings()
    key = (s.get("api_key") or "").strip()
    if not key:
        raise UserError("还没有填 DeepSeek API Key：点右上角「设置」填一下就能用了。", need_key=True)
    url = (s.get("base_url") or DEFAULT_SETTINGS["base_url"]).rstrip("/") + "/chat/completions"
    body = {"model": s.get(model_key) or "deepseek-flash", "messages": messages, "stream": False}
    try:
        r = requests.post(url, json=body, timeout=timeout,
                          headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    except requests.Timeout:
        raise UserError("DeepSeek 响应超时了，稍后再试一次。")
    except requests.RequestException as e:
        raise UserError(f"连不上 DeepSeek：{e.__class__.__name__}。检查一下网络或「设置」里的接口地址。")
    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message") or r.text
        except ValueError:
            msg = r.text
        hint = {401: "API Key 不对或已失效。", 402: "账户余额不足。", 429: "请求太频繁，等一会儿再试。"}.get(r.status_code, "")
        raise UserError(f"DeepSeek 返回 {r.status_code}：{hint}{msg[:300]}")
    try:
        content = r.json()["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError):
        raise UserError("DeepSeek 返回的内容看不懂，换个模型试试。")
    return _strip_fences(content)


def _strip_fences(text):
    text = text.strip()
    m = re.fullmatch(r"```[a-zA-Z]*\n(.*?)\n?```", text, re.S)
    return m.group(1).strip() if m else text


def _keyword_list():
    return "、".join(load_settings().get("keywords") or DEFAULT_KEYWORDS)


RECOGNIZE_PROMPT = """请把图片里的题目完整转写成文字。

要求：
1. 只转写题目本身，不要解答、不要提示、不要评论。
2. 文字照原样；数学式一律写成 LaTeX：行内用 $...$，单独成行的公式用 $$...$$。
3. 保留题号、小问编号 (1)(2)… 和原有的分行。
4. 题目里的插图用「[图]」占位；看不清的地方写「[?]」，不要猜。
5. 从这些关键词里选 1 到 3 个最贴切的；都不合适时可以给一个新的短词：{keywords}
6. 如果图里能看出出处（例如「习题 5.8」「2023 数一」），写在出处一栏，否则留空。

严格按下面的格式输出，不要加代码块：
【题目】
（题目内容）
【关键词】
（用顿号分隔）
【出处】
（出处，没有就留空）"""

POLISH_PROMPT = """下面是一道题目的文字，可能来自识别或手打，有错字、公式格式混乱等问题。请整理成规范文本：
- 修正明显的识别错误，但不要改变题意，不要解答。
- 数学式写成 LaTeX：行内用 $...$，单独成行的公式用 $$...$$。
- 保留题号和小问的分行。
只输出整理后的题目，不要任何解释，不要代码块。

{text}"""

IDEA_TIDY_PROMPT = """下面是我做题时随手记的一条想法（可能很口语，也可能只是几个关键词）。请帮我整理：
- 数学内容一律写成 LaTeX：行内用 $...$，单独成行的公式用 $$...$$。比如「x平方加1」写成 $x^2+1$，「A的特征值」写成 $A$ 的特征值。
- 修正明显的错字、漏字，让句子通顺，但保持我的原意和口吻。
- 不要补充我没写的推理步骤，不要解题，不要评价；只有几个关键词时，就整理成几个关键词。
- 原来分了几段、几条，就还是几段、几条。
只输出整理后的想法，不要任何解释，不要代码块。
{context}
我的想法：
{text}"""

IDEA_HINT_PROMPT = """下面是一道题。请给出一条简短的解题思路（不是完整解答）：
- 说清楚突破口和关键一步，3 到 6 句话。
- 数学内容写成 LaTeX：行内用 $...$，单独成行的公式用 $$...$$。
- 如果下面已经列出了一些想法，请给一个不同的角度，或者在它们卡住的地方往前推一步。
只输出思路本身，不要标题，不要代码块。

题目：
{problem}
{ideas}"""

SUGGEST_PROMPT = """根据下面的题目和想法，从关键词表里挑 1 到 3 个最贴切的；都不合适时可以给一个新的短词。
只输出关键词，用顿号分隔，不要别的内容。

关键词表：{keywords}

题目：
{problem}

想法：
{idea}"""


def _split_keywords(text):
    text = re.sub(r"^[（(]?(无|空|没有)[)）]?$", "", text.strip())
    return _clean_keywords(re.split(r"[、,，;；\n]+", text))


def parse_recognition(text):
    parts = re.split(r"【(题目|关键词|出处)】", text)
    if len(parts) < 3:
        return {"problem": text.strip(), "keywords": [], "source": ""}
    sec = {parts[i]: parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}
    source = sec.get("出处", "").strip()
    if re.fullmatch(r"[（(]?(无|空|没有|留空|未知)[)）]?|（出处.*）", source):
        source = ""
    return {"problem": sec.get("题目", ""), "keywords": _split_keywords(sec.get("关键词", "")),
            "source": source.splitlines()[0].strip() if source else ""}


def _image_data_url(name):
    path = IMAGES / name
    im = Image.open(path)
    if max(im.size) > 2400:  # 太大的图先缩一下再发
        im.thumbnail((2400, 2400), Image.LANCZOS)
        buf = io.BytesIO()
        im.convert("RGB").save(buf, "PNG")
        raw, mime = buf.getvalue(), "image/png"
    else:
        raw, mime = path.read_bytes(), "image/jpeg" if name.endswith(".jpg") else "image/png"
    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"


@app.post("/api/recognize")
def recognize():
    name = (request.get_json(force=True) or {}).get("image", "")
    if not SAFE_IMAGE.fullmatch(name) or not (IMAGES / name).is_file():
        raise UserError("找不到这张图片")
    content = ds_chat([{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": _image_data_url(name)}},
        {"type": "text", "text": RECOGNIZE_PROMPT.format(keywords=_keyword_list())},
    ]}], model_key="vision_model")
    return jsonify(parse_recognition(content))


@app.post("/api/polish")
def polish():
    p = request.get_json(force=True) or {}
    text = (p.get("text") or "").strip()
    if p.get("kind") == "idea":
        if not text:
            raise UserError("这条想法是空的，没什么可整理的。")
        problem = (p.get("problem") or "").strip()
        context = f"\n（供参考，这是对应的题目，不要输出它）\n{problem[:1500]}\n" if problem else ""
        prompt = IDEA_TIDY_PROMPT.format(text=text, context=context)
    else:
        if not text:
            raise UserError("题目是空的，没什么可整理的。")
        prompt = POLISH_PROMPT.format(text=text)
    return jsonify({"text": ds_chat([{"role": "user", "content": prompt}])})


@app.post("/api/hint")
def hint():
    p = request.get_json(force=True) or {}
    problem = (p.get("problem") or "").strip()
    if not problem:
        raise UserError("先把题目文字填上，AI 才能给思路。")
    ideas = [str(t).strip() for t in p.get("ideas") or [] if str(t).strip()]
    listed = "\n已有的想法：\n" + "\n".join(f"{i}. {t}" for i, t in enumerate(ideas, 1)) if ideas else ""
    out = ds_chat([{"role": "user", "content": IDEA_HINT_PROMPT.format(problem=problem, ideas=listed)}])
    return jsonify({"text": out})


@app.post("/api/suggest")
def suggest():
    p = request.get_json(force=True) or {}
    problem = (p.get("problem") or "").strip()
    idea = "\n".join(str(t).strip() for t in p.get("ideas") or [] if str(t).strip()) or (p.get("idea") or "").strip()
    if not problem and not idea:
        raise UserError("先写点题目或想法，AI 才知道推荐什么。")
    out = ds_chat([{"role": "user", "content": SUGGEST_PROMPT.format(
        keywords=_keyword_list(), problem=problem or "（无）", idea=idea or "（无）")}])
    return jsonify({"keywords": _split_keywords(out)})


# ------------------------------------------------------------------ 设置

@app.get("/api/settings")
def get_settings():
    return jsonify(public_settings())


@app.post("/api/settings")
def set_settings():
    p = request.get_json(force=True) or {}
    with _lock:
        s = load_settings()
        for k in ("base_url", "vision_model", "text_model", "doc_title", "doc_subtitle", "author"):
            if k in p:
                s[k] = str(p[k] or "").strip() or DEFAULT_SETTINGS[k]
        if p.get("api_key"):
            s["api_key"] = str(p["api_key"]).strip()
        if p.get("clear_key"):
            s["api_key"] = ""
        if "keywords" in p:
            s["keywords"] = _clean_keywords(p["keywords"]) or DEFAULT_KEYWORDS
        _write_json(SETTINGS_FILE, s)
    return jsonify(public_settings(s))


@app.post("/api/settings/test")
def test_settings():
    t = time.time()
    reply = ds_chat([{"role": "user", "content": "只回复两个字：收到"}], timeout=40)
    return jsonify({"reply": reply[:40], "ms": int((time.time() - t) * 1000)})


# ------------------------------------------------------------------ 导出

def _safe_filename(s):
    return re.sub(r'[\\/:*?"<>|\s]+', "-", s).strip("-") or "题记"


@app.post("/api/export")
def export():
    p = request.get_json(force=True) or {}
    fmt = p.get("format", "pdf")
    with _lock:
        notes = load_db()["notes"]
        settings = load_settings()
    ids = p.get("ids")
    if ids is not None:
        wanted = set(ids)
        notes = [n for n in notes if n["id"] in wanted]
    if not notes:
        raise UserError("没有可导出的题目。")
    problem = texify.preflight(notes)
    if problem:
        raise UserError(**problem, status=422)
    opts = texify.ExportOptions(
        title=(p.get("title") or settings["doc_title"]).strip(),
        subtitle=(p.get("subtitle") if p.get("subtitle") is not None else settings["doc_subtitle"]).strip(),
        author=settings.get("author", ""),
        group=bool(p.get("group", True)),
        focus=(p.get("focus") or "").strip(),
        layout=p.get("layout", "compact"),
        images=bool(p.get("images", True)),
        keyword_order=settings.get("keywords") or DEFAULT_KEYWORDS,
    )
    tex, used_images = texify.render(notes, opts, IMAGES)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = f"{_safe_filename(opts.title)}-{stamp}"
    EXPORTS.mkdir(exist_ok=True)

    if fmt == "tex":
        out_dir = EXPORTS / base
        (out_dir / "img").mkdir(parents=True, exist_ok=True)
        (out_dir / "main.tex").write_text(tex, encoding="utf-8")
        for name in used_images:
            shutil.copy2(IMAGES / name, out_dir / "img" / name)
        if not used_images:
            (out_dir / "img").rmdir()
        return jsonify({"path": str(out_dir), "name": out_dir.name, "kind": "folder"})

    if not shutil.which("xelatex"):
        raise UserError("这台电脑上没找到 xelatex，可以先「导出 LaTeX」再到 Overleaf 编译。")
    if not _export_lock.acquire(timeout=1):
        raise UserError("上一份 PDF 还在生成，稍等一下。")
    build = Path(tempfile.mkdtemp(prefix="tiji-"))  # 短路径，避开 Windows 的路径长度限制
    try:
        (build / "img").mkdir()
        (build / "main.tex").write_text(tex, encoding="utf-8")
        for name in used_images:
            shutil.copy2(IMAGES / name, build / "img" / name)
        for _ in range(2):  # 第二遍让目录里的页码对上
            try:
                r = subprocess.run(["xelatex", "-interaction=nonstopmode", "-halt-on-error",
                                    "-file-line-error", "main.tex"],
                                   cwd=build, capture_output=True, timeout=300, creationflags=NO_WINDOW)
            except subprocess.TimeoutExpired:
                raise UserError("LaTeX 编译超时了。")
            if r.returncode != 0:
                log = (build / "main.log").read_text(encoding="utf-8", errors="replace") \
                    if (build / "main.log").exists() else r.stdout.decode("utf-8", "replace")
                raise UserError(**texify.explain_error(log, tex), status=422)
        pdf = EXPORTS / f"{base}.pdf"
        shutil.copy2(build / "main.pdf", pdf)
    finally:
        _export_lock.release()
        shutil.rmtree(build, ignore_errors=True)
    if p.get("open", True):
        _open_path(pdf)
    return jsonify({"path": str(pdf), "name": pdf.name, "kind": "pdf"})


def _open_path(path, reveal=False):
    path = Path(path)
    if sys.platform == "win32":
        if reveal:
            subprocess.Popen(["explorer", "/select,", str(path)])
        else:
            os.startfile(str(path))  # noqa: S606 —— 打开的是 exports 里自己生成的文件
    else:
        webbrowser.open(path.as_uri())


@app.post("/api/open")
def open_export():
    p = request.get_json(force=True) or {}
    target = Path(p.get("path") or "").resolve()
    if EXPORTS.resolve() not in target.parents or not target.exists():
        raise UserError("只能打开 exports 里导出的文件。")
    _open_path(target, reveal=bool(p.get("reveal")))
    return jsonify({"ok": True})


# ------------------------------------------------------------------ 启动

def _port_busy():
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex((HOST, PORT)) == 0


def _serve():
    from werkzeug.serving import make_server
    make_server(HOST, PORT, app, threaded=True).serve_forever()


def main():
    url = f"http://{HOST}:{PORT}/"
    for d in (DATA, IMAGES, EXPORTS):
        d.mkdir(parents=True, exist_ok=True)
    if FROZEN:  # 没有控制台：把输出记到 data/app.log，出问题时可以看
        log = open(DATA / "app.log", "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = log
    if "--no-browser" in sys.argv:  # 只开服务（调试用）
        app.run(host=HOST, port=PORT, debug=False, threaded=True)
        return
    if not _port_busy():  # 已经开着一个题记时，新窗口直接连过去
        threading.Thread(target=_serve, daemon=True).start()
        for _ in range(50):
            if _port_busy():
                break
            time.sleep(0.05)
    if sys.platform == "win32":  # 任务栏上用题记自己的图标，不和 Python 混在一起
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Tiji.ProblemNotebook")
    import webview
    webview.create_window("题记", url, width=1440, height=920, min_size=(980, 640),
                          background_color="#F2F4F7", text_select=True)
    webview.start(icon=str(STATIC / "tiji.ico"))


if __name__ == "__main__":
    main()
