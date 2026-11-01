"""输入日报看板：本机打开一个窗口，看图表、翻日报，一键让 DeepSeek 补齐没写的日报。

用法: 点桌面或开始菜单的「输入日报」（pythonw dashboard.py，不弹黑框）。
只监听 127.0.0.1，数据不出本机。窗口关掉一分钟后自动退出（DeepSeek 在写的话等写完）。
"""

import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
RECORD_DIR = HERE / "输入记录"
REPORT_DIR = HERE / "日报"
PAGE = HERE / "看板.html"
PORTS = range(47815, 47835)  # 挑冷门端口；被别的程序占了就往后试
APP_ID = "输入日报看板"
IDLE_EXIT = 60  # 秒：网页这么久没报平安（窗口关了），就退出
EDGE = [Path(os.environ.get(v, "")) / "Microsoft/Edge/Application/msedge.exe" for v in ("ProgramFiles(x86)", "ProgramFiles")]
last_ping = time.time()

ENTRY = re.compile(r"^### (\d{2}):(\d{2}) · (.+)$")
# 「烦躁信号」：骂人、抱怨的词，按天计数
ANNOYED = re.compile(r"卧槽|我靠|妈的|他妈|艹|傻逼|垃圾|烦死|好烦|气死|无语|服了|什么鬼|搞什么|太拉|离谱|崩溃|受不了|破玩意")
DAY_FILE = re.compile(r"^\d{4}-\d{2}-\d{2}\.md$")


# ---------- 读数据 ----------

def read_record(path):
    """一天的输入记录 → 段数、字数、每小时段数、各软件段数、烦躁词次数。"""
    hours, apps = [0] * 24, Counter()
    chars = annoyed = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        m = ENTRY.match(line)
        if m:
            hours[int(m.group(1))] += 1
            apps[m.group(3).strip()] += 1
        elif line and not line.startswith(("# ", "共 ")):
            chars += len(line.strip())
            annoyed += len(ANNOYED.findall(line))
    return {"segments": sum(hours), "chars": chars, "hours": hours, "apps": dict(apps), "annoyed": annoyed}


def read_report(path):
    """一天的日报 → 谁写的、一句话、主题、待办。"""
    text = path.read_text(encoding="utf-8")
    author = "Claude" if "由 Claude" in text[:400] else "DeepSeek" if "由 DeepSeek" in text[:400] else "其他"
    one = re.search(r"\*\*一句话：\*\*\s*(.+)", text)
    topics, todos, section = [], [], ""
    for line in text.splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
        elif line.startswith("### ") and "按事情分" in section:
            topics.append(re.sub(r"[（(].*?[)）]", "", line[4:]).strip())
        elif line.startswith("- [ ]"):
            todos.append(line[5:].strip())
    return {"author": author, "summary": one.group(1).strip() if one else "", "topics": topics, "todos": todos}


def collect():
    days = {}
    for path in sorted(RECORD_DIR.glob("*.md")):
        if DAY_FILE.match(path.name):
            days[path.stem] = {"day": path.stem, **read_record(path), "report": None}
    for path in sorted(REPORT_DIR.glob("*.md")):
        # 只有标题没正文的空日报当作没写
        if DAY_FILE.match(path.name) and "\n## " in path.read_text(encoding="utf-8"):
            days.setdefault(path.stem, {"day": path.stem, "segments": 0, "chars": 0, "hours": [0] * 24,
                                        "apps": {}, "annoyed": 0})["report"] = read_report(path)
    return [days[d] for d in sorted(days)]


# ---------- 调用 daily_report.py（DeepSeek 写日报） ----------

class Job:
    lock = threading.Lock()
    proc = None
    lines = []
    label = ""
    progress = {}
    started = 0.0

    @classmethod
    def start(cls, day=None):
        with cls.lock:
            if cls.proc and cls.proc.poll() is None:
                return False
            py = Path(sys.executable)
            if py.name.lower() == "pythonw.exe":  # pythonw 的子进程拿不到输出，换成同目录的 python.exe（不弹窗）
                py = py.with_name("python.exe")
            cmd = [str(py), str(HERE / "daily_report.py")] + ([day] if day else [])
            env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
            cls.lines = []
            cls.progress = {}
            cls.started = time.time()
            cls.label = f"重写 {day}" if day else "补齐没写的日报"
            cls.proc = subprocess.Popen(cmd, cwd=HERE, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            threading.Thread(target=cls._read, args=(cls.proc,), daemon=True).start()
            return True

    @classmethod
    def _read(cls, proc):
        for raw in proc.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip()
            m = re.match(r"进度 (\S+) 思考 (\d+) 写出 (\d+)", line)
            if m:  # 实时进度只更新数字，不进日志
                cls.progress = {"day": m.group(1), "thought": int(m.group(2)), "written": int(m.group(3))}
            elif line:
                cls.lines.append(line)

    @classmethod
    def status(cls):
        running = bool(cls.proc and cls.proc.poll() is None)
        total = done = 0
        current, failed = "", []
        for line in cls.lines:
            m = re.search(r"要写 (\d+) 天", line)
            if m:
                total = int(m.group(1))
            m = re.match(r"正在写 (\S+)", line)
            if m:
                current = m.group(1)
            m = re.match(r"日报 (\S+) (写好了|失败)", line)
            if m:
                done += 1
                if m.group(2) == "失败":
                    failed.append(m.group(1))
        prog = cls.progress if cls.progress.get("day") == current else {}
        return {"running": running, "label": cls.label, "total": total, "done": done, "current": current if running else "",
                "thought": prog.get("thought", 0), "written": prog.get("written", 0), "failed": failed,
                "elapsed": int(time.time() - cls.started) if cls.proc else 0, "log": cls.lines[-40:]}


# ---------- 网页 ----------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, body, ctype="application/json; charset=utf-8", code=200):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False)
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        q = parse_qs(url.query)
        if url.path == "/":
            self.send(PAGE.read_bytes(), "text/html; charset=utf-8")
        elif url.path == "/favicon.ico":  # 窗口标题栏和任务栏用的图标
            self.send((HERE / "输入日报.ico").read_bytes(), "image/x-icon")
        elif re.fullmatch(r"/icons/icon-\d+\.png", url.path) and (HERE / url.path[1:]).exists():
            self.send((HERE / url.path[1:]).read_bytes(), "image/png")
        elif url.path == "/manifest.webmanifest":  # 高缩放屏幕上 Edge 按这里挑大图，任务栏才清晰
            sizes = sorted(int(p.stem.split("-")[1]) for p in (HERE / "icons").glob("icon-*.png"))
            self.send({"name": "输入日报", "short_name": "输入日报", "start_url": "/", "display": "standalone",
                       "background_color": "#f6f5f2", "theme_color": "#c2603a",
                       "icons": [{"src": f"/icons/icon-{n}.png", "sizes": f"{n}x{n}", "type": "image/png"} for n in sizes]},
                      "application/manifest+json; charset=utf-8")
        elif url.path == "/api/data":
            self.send(collect())
        elif url.path == "/api/report":
            day = q.get("day", [""])[0]
            path = REPORT_DIR / f"{day}.md"
            ok = re.fullmatch(r"\d{4}-\d{2}-\d{2}", day) and path.exists()
            self.send({"text": path.read_text(encoding="utf-8") if ok else ""})
        elif url.path == "/api/status":
            self.send(Job.status())
        elif url.path == "/api/ping":
            global last_ping
            last_ping = time.time()
            self.send({"ok": True, "app": APP_ID})
        else:
            self.send({"error": "not found"}, code=404)

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/api/generate":
            return self.send({"error": "not found"}, code=404)
        day = parse_qs(url.query).get("day", [None])[0]
        if day and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            return self.send({"error": "日期不对"}, code=400)
        self.send({"started": Job.start(day)})


def open_window(url):
    """用 Edge 的应用模式开一个独立窗口（没有地址栏，像个软件）；没有 Edge 就用默认浏览器。"""
    for edge in EDGE:
        if edge.exists():
            subprocess.Popen([str(edge), f"--app={url}", "--window-size=1280,900"])
            return
    webbrowser.open(url)


def fix_window_icons():
    """Edge 的应用窗口拿网页的小图标放大，高缩放屏幕上任务栏发糊。
    这里直接找到标题是「输入日报」的 Edge 窗口，按它的缩放比例换上清晰的图标；Edge 改回去就再换。"""
    if os.name != "nt":
        return
    import ctypes
    from ctypes import wintypes

    user32, kernel32 = ctypes.windll.user32, ctypes.windll.kernel32
    user32.LoadImageW.restype = wintypes.HANDLE
    user32.SendMessageW.restype = ctypes.c_ssize_t
    user32.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    ico = str(HERE / "输入日报.ico")
    icons = {}  # (dpi, 大/小) -> 图标句柄

    def load(dpi, big):
        if (dpi, big) not in icons:
            n = round((32 if big else 16) * dpi / 96)
            icons[dpi, big] = user32.LoadImageW(None, ico, 1, n, n, 0x10)  # IMAGE_ICON, LR_LOADFROMFILE
        return icons[dpi, big]

    def is_edge(hwnd):
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        h = kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        buf, size = ctypes.create_unicode_buffer(260), wintypes.DWORD(260)
        ok = kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size))
        kernel32.CloseHandle(h)
        return ok and buf.value.lower().endswith("msedge.exe")

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def each(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        title = ctypes.create_unicode_buffer(64)
        user32.GetWindowTextW(hwnd, title, 64)
        if title.value == "输入日报" and is_edge(hwnd):
            dpi = user32.GetDpiForWindow(hwnd) or 96
            for big in (True, False):
                icon = load(dpi, big)
                if icon and user32.SendMessageW(hwnd, 0x7F, int(big), 0) != icon:  # WM_GETICON
                    user32.SendMessageW(hwnd, 0x80, int(big), icon)  # WM_SETICON
        return True

    while True:
        user32.EnumWindows(each, 0)
        time.sleep(3)


def exit_when_idle(server):
    while True:
        time.sleep(10)
        if time.time() - last_ping > IDLE_EXIT and not Job.status()["running"]:
            server.shutdown()
            return


class Server(ThreadingHTTPServer):
    # HTTPServer 默认允许端口复用，Windows 上会和占着同一端口的别的程序撞车；这里独占
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def is_ours(port):
    """这个端口上跑的是不是已经开着的输入日报。"""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=2) as resp:
            return json.load(resp).get("app") == APP_ID
    except Exception:
        return False


def main():
    for port in PORTS:
        url = f"http://127.0.0.1:{port}/"
        if is_ours(port):  # 已经开着一个了，再开一个窗口就行
            open_window(url)
            return
        try:
            server = Server(("127.0.0.1", port), Handler)
            break
        except OSError:  # 被别的程序占了，试下一个
            continue
    else:
        return
    open_window(url)
    threading.Thread(target=exit_when_idle, args=(server,), daemon=True).start()
    threading.Thread(target=fix_window_icons, daemon=True).start()
    server.serve_forever()


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
