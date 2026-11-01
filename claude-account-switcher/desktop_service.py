"""Windows Claude Desktop 原生数据目录切换；不解析登录令牌。"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
from contextlib import contextmanager
import stat
from typing import Callable

from account_manager import ManagerError, ensure_desktop_stopped, resolve_desktop_app, secure_directory
from profile_switcher import ProfileSwitcher, ProfileSwitcherError


class DesktopService:
    def __init__(self, base_dir: Path | None = None, *, app_resolver: Callable = resolve_desktop_app,
                 process_guard: Callable | None = None, process_factory: Callable = subprocess.Popen):
        self.base_dir = Path(base_dir or Path.home() / ".claude-desktop-switcher").absolute()
        self.app_resolver = app_resolver
        self.custom_guard = process_guard
        self.process_factory = process_factory

    def candidates(self) -> list[Path]:
        roaming = Path(os.environ.get("APPDATA", str(Path.home() / "AppData/Roaming")))
        local = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData/Local")))
        roots = [roaming / "Claude", local / "Claude-Data"]
        migrated = local / "Claude-Data"
        if migrated.is_dir():
            roots.extend(p for p in migrated.iterdir() if p.is_dir())
        packages = local / "Packages"
        if packages.is_dir():
            roots.extend(p / "LocalCache/Roaming/Claude" for p in packages.glob("Claude_*/") if p.is_dir())
        return list(dict.fromkeys(p for p in roots if p.is_dir() and (p / "config.json").is_file()))

    @contextmanager
    def operation(self):
        """把目录切换和原生进程启动作为同一管理器操作串行化。"""
        lock = self.base_dir / "launch.lock"
        if not self.base_dir.is_dir():
            raise ManagerError("请先保留原有账号。")
        for part in (self.base_dir, *self.base_dir.parents, lock):
            if part.exists() or part.is_symlink():
                info = part.lstat()
                if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                    raise ManagerError("账号操作路径不能是链接或重解析点。")
        with lock.open("a+b") as handle:
            if not stat.S_ISREG(os.fstat(handle.fileno()).st_mode):
                raise ManagerError("账号操作锁不是普通文件。")
            if handle.seek(0, 2) == 0:
                handle.write(b"\0")
                handle.flush()
            handle.seek(0)
            try:
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as error:
                raise ManagerError("另一个窗口正在操作账号，请稍后重试。") from error
            try:
                yield
            finally:
                handle.seek(0)
                if os.name == "nt":
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def configured_root(self) -> Path | None:
        registry = self.base_dir / "switcher.json"
        if not registry.exists():
            return None
        # 清单只有目录、账号名称和事务元数据；不读取 Claude 的 config.json。
        if registry.is_symlink() or getattr(registry.lstat(), "st_file_attributes", 0) & 0x400:
            raise ManagerError("账号清单不能是链接或重解析点。")
        if registry.stat().st_size > 1024 * 1024:
            raise ManagerError("账号清单异常，未继续操作。")
        try:
            data = json.loads(registry.read_text(encoding="utf-8"))
            value = data["live_dir"]
            if not isinstance(value, str) or not Path(value).is_absolute():
                raise ValueError("live_dir")
            return Path(value)
        except (ValueError, KeyError, TypeError) as error:
            raise ManagerError("账号清单无法读取，请使用恢复操作，不要重新初始化。") from error

    def assert_native_binding(self, expected: Path) -> None:
        # 更新可能把原生目录迁往 Claude-Data/<包系列>；不在旧路径继续写入。
        others = [path for path in self.candidates()
                  if os.path.normcase(str(path.absolute())) != os.path.normcase(str(expected.absolute()))]
        if others:
            raise ManagerError("发现多个或已迁移的 Claude 数据目录，已停止切换，避免操作错误账号。请保留现有目录和管理器数据，先核对客户端实际使用的位置。")

    def guard(self) -> None:
        if self.custom_guard:
            self.custom_guard()
        else:
            app = self.app_resolver()
            ensure_desktop_stopped(app["path"])

    def engine(self, live_dir: Path | None = None) -> ProfileSwitcher:
        root = live_dir or self.configured_root()
        if root is None:
            raise ManagerError("请先保留当前账号并初始化。")
        return ProfileSwitcher(self.base_dir, root, self.guard)

    def inspect(self) -> dict:
        app = self.app_resolver()
        root = self.configured_root()
        result = {"app": app, "base_dir": str(self.base_dir), "initialized": root is not None,
                  "candidates": [str(p) for p in self.candidates()], "profiles": []}
        if root is not None:
            status = self.engine(root).status()
            result.update(status)
            result["profiles"] = self.engine(root).list_profiles()
            result["live_dir"] = str(root)
        return result

    def initialize(self, live_dir: Path | None = None) -> dict:
        self.guard()
        if self.configured_root() is not None:
            return self.inspect()
        if live_dir is None:
            options = self.candidates()
            if len(options) != 1:
                raise ManagerError("无法唯一确定 Claude 桌面数据目录，请在窗口中选择正确目录。")
            live_dir = options[0]
        live_dir = Path(live_dir).absolute()
        if not any(os.path.normcase(str(p.absolute())) == os.path.normcase(str(live_dir)) for p in self.candidates()):
            raise ManagerError("所选目录不是检测到的 Claude 桌面版数据目录，未登记任何资料。")
        if not (live_dir / "claude_desktop_config.json").is_file():
            raise ManagerError("所选目录缺少桌面版配置标记，未继续操作。")
        self.assert_native_binding(live_dir)
        secure_directory(self.base_dir)
        self.engine(Path(live_dir)).initialize("原有账号")
        return self.inspect()

    def add_profile(self, label: str) -> dict:
        root = self.configured_root()
        if root:
            self.assert_native_binding(root)
        return self.engine().add_profile(label)

    def open_profile(self, identifier: str) -> dict:
        with self.operation():
            return self._open_locked(identifier)

    def _open_locked(self, identifier: str) -> dict:
        app = self.app_resolver()
        engine = self.engine()
        self.assert_native_binding(engine.live)
        profiles = engine.list_profiles()
        profile = next((p for p in profiles if p["id"] == identifier), None)
        if profile is None:
            raise ManagerError("找不到所选账号。")
        # 同一账号只验证布局并唤起；切到不同账号必须通过完整退出检查。
        engine.switch_to(identifier)
        try:
            process = self.process_factory([app["path"]], shell=False, close_fds=True,
                                           cwd=str(Path(app["path"]).parent))
        except OSError as error:
            raise ManagerError(f"已选择“{profile['label']}”，但 Claude 启动失败。账号数据仍完整，请重试打开。{error}") from error
        return {"pid": process.pid, "label": profile["label"], "app": app}

    def recover(self) -> dict:
        with self.operation():
            return self.engine().recover()
