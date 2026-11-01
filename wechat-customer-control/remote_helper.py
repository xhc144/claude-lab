"""Streamed over SSH. No daemon, public port, password, or messaging endpoint."""
from __future__ import annotations

from contextlib import contextmanager, redirect_stdout
from datetime import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import tempfile
import unicodedata
import uuid


ROOT = Path("/home/ubuntu/wx-ai-assistant")
SERVICE = "wx-ai-assistant.service"


class ControlFailure(RuntimeError):
    pass


def validate_group(value):
    if not isinstance(value, str):
        raise ControlFailure("请填写微信中显示的完整群名。")
    value = value.strip()
    if not value or len(value) > 100 or any(unicodedata.category(c).startswith("C") for c in value):
        raise ControlFailure("群名须为 1 到 100 个可显示字符，不能包含换行或控制字符。")
    return value


def safe_id(name):
    # Keep exactly the same identity rule as wxai.service.safe_id.
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "_", name).strip("_")[:80] or "unknown"


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def atomic_write(path, content, mode=0o600):
    path = Path(path)
    fd, temporary = tempfile.mkstemp(prefix=".desktop-control-", dir=str(path.parent))
    try:
        os.chmod(temporary, mode)
        with os.fdopen(fd, "wb") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class Manager:
    def __init__(self, root=ROOT, runner=None):
        self.root = Path(root)
        self.runner = runner or subprocess.run
        self.config_path = self.root / "config.json"
        sys.path.insert(0, str(self.root))
        os.environ.setdefault("DISPLAY", ":99")
        os.environ.setdefault("DBUS_SESSION_BUS_ADDRESS", "unix:path=/home/ubuntu/wxbot/run/bus")
        os.environ.setdefault("XDG_RUNTIME_DIR", "/run/user/1000")
        os.environ.setdefault("LANG", "C.UTF-8")

    def load(self):
        from wxai.config import load_config
        return load_config(str(self.config_path))

    def database(self, cfg, readonly=False):
        path = Path(cfg["paths"]["db"])
        if readonly:
            con = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=8)
        else:
            con = sqlite3.connect(str(path), timeout=8)
        con.row_factory = sqlite3.Row
        return con

    @contextmanager
    def connection(self, cfg, readonly=False):
        con = self.database(cfg, readonly=readonly)
        try:
            with con:
                yield con
        finally:
            con.close()

    def service_state(self, name=SERVICE):
        result = self.runner(["/usr/bin/systemctl", "is-active", name], capture_output=True, timeout=12)
        return result.stdout.decode("utf-8", "replace").strip() or "unknown"

    def service_command(self, action):
        if action not in {"start", "stop"}:
            raise ControlFailure("服务操作不正确。")
        result = self.runner(["/usr/bin/sudo", "-n", "/usr/bin/systemctl", action, SERVICE],
                             capture_output=True, timeout=105)
        if result.returncode:
            raise ControlFailure("无法管理客服服务，请检查 ubuntu 用户的 systemctl 权限。")
        state = self.service_state()
        if action == "stop" and state not in {"inactive", "failed"}:
            raise ControlFailure("客服服务尚未停止，未操作微信窗口。请刷新状态。")
        if action == "start" and state != "active":
            raise ControlFailure("客服服务未能启动，已保留暂停状态。")

    @staticmethod
    def kv(con, key, default=""):
        row = con.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
        return row[0] if row else default

    @staticmethod
    def set_kv(con, key, value):
        con.execute("INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
                    (key, value, now()))

    def set_paused(self, cfg, paused):
        with self.connection(cfg) as con:
            self.set_kv(con, "paused", "1" if paused else "0")

    @staticmethod
    def allowed(con, cfg):
        behavior = cfg.get("behavior", {})
        explicit = dict(con.execute("SELECT name,allowed FROM allowed").fetchall())
        names = set(behavior.get("allowed_contacts") or []) | {k for k, v in explicit.items() if v}
        return sorted(n for n in names if explicit.get(n, 1) and
                      not any(p and p in n for p in behavior.get("blocked_patterns", [])))

    def get_ui(self, cfg):
        from wxai.ui import X11
        return X11(cfg.get("ui", {}).get("display", ":99"))

    def status(self, title=None):
        cfg = self.load()
        state = self.service_state()
        wechat = self.service_state("wx-wechat.service")
        with self.connection(cfg, readonly=True) as con:
            targets = self.allowed(con, cfg)
            paused = self.kv(con, "paused") == "1"
            queue = {"pending": 0, "admin_pending": 0}
            for target in targets:
                cid = safe_id(target)
                key = "conversation_queue:v1:" + hashlib.sha256(cid.encode("utf-8")).hexdigest()[:24]
                raw = self.kv(con, key)
                if raw:
                    queue["pending"] += len(json.loads(raw).get("pending", []))
                admin = self.kv(con, "admin_deliveries:" + cid)
                if admin:
                    jobs = json.loads(admin)
                    if not isinstance(jobs, list):
                        raise ControlFailure("待投递任务格式异常，请先检查服务器。")
                    queue["admin_pending"] += len(jobs)
            data = {"service": state, "wechat_service": wechat, "paused": paused,
                    "targets": targets, "persona": cfg.get("persona", {}).get("name", ""),
                    "title": title or "", "last_tick": self.kv(con, "last_tick"),
                    "last_status": self.kv(con, "last_status"), "queue": queue,
                    "dry_run": bool(cfg.get("behavior", {}).get("dry_run", False))}
        # read_title only crops the title locally. It never activates or sends.
        if title is None and wechat == "active":
            try:
                data["title"] = self.get_ui(cfg).read_title()
            except Exception:
                data["title"] = ""
        return data

    def pause(self):
        cfg = self.load()
        self.set_paused(cfg, True)
        self.service_command("stop")
        data = self.status()
        data["message"] = "客服已暂停。微信继续在线。"
        return data

    def resume(self):
        cfg = self.load()
        # Do not manipulate a window while a live worker could be using it.
        with self.connection(cfg, readonly=True) as con:
            paused = self.kv(con, "paused") == "1"
            targets = self.allowed(con, cfg)
        if self.service_state() == "active" and not paused:
            data = self.status()
            data["message"] = "客服已经在运行。"
            return data
        if len(targets) != 1:
            raise ControlFailure("请先切换到一个服务群，再恢复回复。")
        self.set_paused(cfg, True)
        self.service_command("stop")
        ui = self.get_ui(cfg)
        try:
            ui.open_contact(targets[0])
            title = ui.read_title()
            if not ui.same_contact(title, targets[0]):
                raise ControlFailure("当前微信标题与服务群不一致，客服保持暂停。")
        except ControlFailure:
            raise
        except Exception:
            raise ControlFailure("未能打开并核实服务群，客服保持暂停。请检查微信登录或群名。") from None
        # Start with the persistent pause flag still set; only unpause after systemd confirms.
        self.service_command("start")
        self.set_paused(cfg, False)
        data = self.status(title=title)
        data["message"] = "客服已恢复，将在当前服务群回复。"
        return data

    def ensure_identity(self, cfg, target):
        behavior = cfg.get("behavior", {})
        if any(p and p in target for p in behavior.get("blocked_patterns", [])):
            raise ControlFailure("群名命中现有屏蔽规则，未切换。")
        if target in {"文件传输助手", "微信团队", "微信支付", "服务通知"}:
            raise ControlFailure("请填写群聊名称。")
        with self.connection(cfg, readonly=True) as con:
            known = set(behavior.get("allowed_contacts", [])) | set(behavior.get("group_contacts", []))
            known.update(row[0] for row in con.execute("SELECT name FROM allowed"))
            known.update(row[0] for row in con.execute("SELECT name FROM convs WHERE kind='group'"))
        if any(n != target and safe_id(n) == safe_id(target) for n in known):
            raise ControlFailure("该群名与已有群的记忆标识冲突，请先给微信群改一个有区别的名称。")

    def backup(self, cfg):
        folder = self.root / "deploy" / "desktop-control" / (datetime.now().strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8])
        folder.mkdir(parents=True, mode=0o700)
        os.chmod(folder, 0o700)
        atomic_write(folder / "config.before.json", self.config_path.read_bytes())
        db_path = folder / "memory.before.sqlite3"
        with self.connection(cfg, readonly=True) as source:
            dest = sqlite3.connect(str(db_path))
            try:
                source.backup(dest)
            finally:
                dest.close()
        os.chmod(db_path, 0o600)
        return folder

    def update_target(self, cfg, target):
        original = self.config_path.read_bytes()
        content = json.loads(original.decode("utf-8"))
        behavior = content.setdefault("behavior", {})
        old_groups = set(cfg.get("behavior", {}).get("group_contacts") or [])
        behavior.update(reply_mode="allowlist", allowed_contacts=[target], group_contacts=[target])
        # Carry the existing group's address policy to a newly selected service group.
        if old_groups & set(behavior.get("no_address_contacts") or []):
            behavior["no_address_contacts"] = sorted((set(behavior["no_address_contacts"]) - old_groups) | {target})
        encoded = (json.dumps(content, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        con = self.database(cfg)
        wrote_config = False
        try:
            con.execute("BEGIN IMMEDIATE")
            con.execute("UPDATE allowed SET allowed=0,updated_at=?", (now(),))
            con.execute("INSERT INTO allowed(name,allowed,created_at,updated_at) VALUES(?,1,?,?) "
                        "ON CONFLICT(name) DO UPDATE SET allowed=1,updated_at=excluded.updated_at",
                        (target, now(), now()))
            self.set_kv(con, "paused", "1")
            atomic_write(self.config_path, encoded)
            wrote_config = True
            con.commit()
        except Exception:
            con.rollback()
            if wrote_config:
                atomic_write(self.config_path, original)
            raise
        finally:
            con.close()

    def switch(self, group):
        target = validate_group(group)
        cfg = self.load()
        self.ensure_identity(cfg, target)
        self.set_paused(cfg, True)
        self.service_command("stop")
        ui = self.get_ui(cfg)
        try:
            ui.open_contact(target)
            title = ui.read_title()
            if not ui.same_contact(title, target):
                raise ControlFailure("打开的微信标题与群名不一致，原服务名单未修改，客服保持暂停。")
        except ControlFailure:
            raise
        except Exception:
            raise ControlFailure("未找到并核实目标群。原服务名单未修改，客服保持暂停。请核对完整群名和微信登录。") from None
        folder = self.backup(cfg)
        try:
            self.update_target(cfg, target)
        except Exception:
            raise ControlFailure("更新群目标失败。客服保持暂停，已保留服务器备份，请刷新状态。") from None
        data = self.status(title=title)
        data["backup"] = str(folder)
        data["message"] = "已切换服务群，保持暂停；点击“恢复回复”开始服务。"
        if data["queue"]["pending"] or data["queue"]["admin_pending"]:
            data["message"] += " 此群已有待处理任务，恢复后会继续处理。"
        return data

    def execute(self, request):
        if not isinstance(request, dict):
            raise ControlFailure("请求格式错误。")
        action = request.get("action")
        if not isinstance(action, str) or action not in {"status", "pause", "resume", "switch"}:
            raise ControlFailure("不支持的控制操作。")
        if request.keys() - ({"action", "group"} if action == "switch" else {"action"}):
            raise ControlFailure("控制参数不正确。")
        if action == "switch":
            return self.switch(validate_group(request.get("group")))
        return getattr(self, action)()


@contextmanager
def control_lock():
    import fcntl
    directory = ROOT / "data"
    with open(directory / "desktop-control.lock", "a", encoding="utf-8") as lock:
        os.chmod(lock.name, 0o600)
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ControlFailure("另一个控制操作正在进行，请稍后刷新状态。") from None
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def main(request):
    try:
        with redirect_stdout(io.StringIO()), control_lock():
            data = Manager().execute(request)
        result = {"ok": True, "data": data}
    except ControlFailure as exc:
        result = {"ok": False, "error": str(exc)}
    except subprocess.TimeoutExpired:
        result = {"ok": False, "error": "服务器操作超时。请先刷新状态，确认当前群与暂停状态。"}
    except Exception:
        result = {"ok": False, "error": "服务器控制操作未完成。请刷新状态，检查服务配置与数据库。"}
    print(json.dumps(result, ensure_ascii=False))
