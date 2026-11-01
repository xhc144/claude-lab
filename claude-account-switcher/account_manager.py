"""Claude Desktop 独立配置目录管理器；不读取或复制登录凭据。

命名配置的浏览器登录回调仍需在官方应用中验证。启动成功只表示已提交
应用启动请求，不表示登录成功，也不表示已有进程切换了账号。
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
import unicodedata
import uuid


class ManagerError(Exception):
    """可以直接向用户显示的操作错误。"""


_PROFILE_ID = re.compile(r"[a-z0-9_-]{1,40}\Z")
_REPARSE_POINT = 0x400
_MAX_REGISTRY_BYTES = 1024 * 1024
_PACKAGE_QUERY = (
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); "
    "Get-AppxPackage -Name Claude | "
    "Select-Object Name, Version, InstallLocation | ConvertTo-Json -Compress"
)
_PROCESS_QUERY = (
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); "
    "$target = [Environment]::GetEnvironmentVariable('CLAUDE_SWITCHER_APP'); "
    "Get-CimInstance Win32_Process -Filter \"Name='Claude.exe'\" -ErrorAction Stop | "
    "Where-Object { $_.ExecutablePath -and "
    "([String]::Equals($_.ExecutablePath, $target, [StringComparison]::OrdinalIgnoreCase) -or "
    "$_.ExecutablePath -match '\\\\WindowsApps\\\\Claude_[^\\\\]+\\\\app\\\\Claude\\.exe$') } | "
    "Select-Object ProcessId, ParentProcessId | ConvertTo-Json -Compress"
)


def _absolute(path: Path) -> Path:
    # 不先 resolve()：它会隐藏调用者传入路径中的符号链接或 junction。
    return Path(os.path.abspath(os.path.expanduser(os.fspath(path))))


def _check_chain(path: Path) -> None:
    """拒绝现有路径链中的链接、junction 和其他重解析点。"""
    for part in reversed((path, *path.parents)):
        try:
            info = part.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or (
            getattr(info, "st_file_attributes", 0) & _REPARSE_POINT
        ):
            raise ManagerError(f"为防止访问其他目录，拒绝链接或重解析点：{part}")
        if part != path and not stat.S_ISDIR(info.st_mode):
            raise ManagerError(f"路径的上级不是目录：{part}")


def _within(path: Path, root: Path) -> bool:
    try:
        return os.path.normcase(os.path.commonpath((str(path), str(root)))) == os.path.normcase(str(root))
    except ValueError:
        return False


def _label(value: str) -> str:
    if not isinstance(value, str):
        raise ManagerError("账号名称必须是文字。")
    value = unicodedata.normalize("NFC", value.strip())
    if not value or len(value) > 80 or any(unicodedata.category(c).startswith("C") for c in value):
        raise ManagerError("账号名称应为 1 到 80 个字符，不能包含控制字符。")
    return value


def _system32() -> Path:
    return Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32"


def secure_directory(path: Path) -> Path:
    """创建一个私有目录；既有目录仅检查，不重写其权限、不创建父目录。"""
    path = _absolute(path)
    if path == Path(path.anchor):
        raise ManagerError("不能将磁盘根目录用作私有目录。")
    _check_chain(path)
    try:
        path.mkdir(mode=0o700)
    except FileExistsError:
        _check_chain(path)
        if not path.is_dir():
            raise ManagerError(f"需要的目录被其他文件占用：{path}")
        return path
    try:
        if os.name != "nt":
            path.chmod(0o700)
            return path
        result = subprocess.run(
            [str(_system32() / "whoami.exe"), "/user", "/fo", "csv", "/nh"],
            capture_output=True, text=True, errors="replace", timeout=10, check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        found = re.findall(r"S-1-\d+(?:-\d+)+", result.stdout)
        if result.returncode or len(found) != 1:
            raise ManagerError("无法确认当前 Windows 用户，未继续初始化账号目录。")
        result = subprocess.run(
            [str(_system32() / "icacls.exe"), str(path), "/inheritance:r", "/grant:r",
             f"*{found[0]}:(OI)(CI)F", "*S-1-5-18:(OI)(CI)F"],
            capture_output=True, text=True, errors="replace", timeout=10, check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if result.returncode:
            raise ManagerError(f"无法限制新建目录的访问权限，未继续操作：{path}")
        return path
    except (OSError, subprocess.TimeoutExpired, ManagerError) as error:
        # 只撤回自己刚建且仍为空的目录；不会递归删除或触碰已有资料。
        try:
            _check_chain(path)
            path.rmdir()
        except (OSError, ManagerError):
            pass
        if isinstance(error, ManagerError):
            raise
        raise ManagerError(f"无法安全创建账号目录：{error}") from error


def list_desktop_processes(app_path: Path | str) -> list[dict]:
    """只匹配指定桌面可执行文件的进程，输出不含可能带登录码的命令行。"""
    if sys.platform != "win32":
        raise ManagerError("Claude Desktop 进程检查目前仅支持 Windows。")
    executable = _absolute(Path(app_path))
    environment = os.environ.copy()
    environment["CLAUDE_SWITCHER_APP"] = str(executable)
    try:
        result = subprocess.run(
            [str(_system32() / "WindowsPowerShell/v1.0/powershell.exe"),
             "-NoProfile", "-NonInteractive", "-Command", _PROCESS_QUERY],
            env=environment, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=20, check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if result.returncode:
            raise ManagerError("无法确认 Claude Desktop 是否完全退出，未继续操作。")
        rows = json.loads(result.stdout.lstrip("\ufeff").strip() or "[]")
        if isinstance(rows, dict):
            rows = [rows]
        if not isinstance(rows, list):
            raise ValueError("进程列表格式不正确")
        processes = []
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError("进程记录格式不正确")
            pid, parent = row.get("ProcessId"), row.get("ParentProcessId")
            if type(pid) is not int or pid <= 0 or type(parent) is not int or parent < 0:
                raise ValueError("进程编号不正确")
            processes.append({"pid": pid, "parent_pid": parent})
        return sorted(processes, key=lambda process: process["pid"])
    except (OSError, subprocess.TimeoutExpired, ValueError) as error:
        raise ManagerError(f"无法安全检查 Claude Desktop 进程：{error}") from error


def ensure_desktop_stopped(app_path: Path | str) -> None:
    processes = list_desktop_processes(app_path)
    if processes:
        pids = ", ".join(str(process["pid"]) for process in processes)
        raise ManagerError(f"Claude Desktop 仍在运行（PID：{pids}）。请从托盘完全退出后重试。")


class AccountManager:
    def __init__(self, base_dir: Path | None = None, *, process_factory=None):
        self.base_dir = _absolute(base_dir if base_dir is not None else Path.home() / ".claude-desktop-accounts")
        if self.base_dir == Path(self.base_dir.anchor):
            raise ManagerError("不能把磁盘根目录用作账号目录。")
        self.registry_path = self.base_dir / "profiles.json"
        self.profiles_dir = self.base_dir / "profiles"
        self._process_factory = process_factory
        _check_chain(self.base_dir)
        if self.base_dir.exists() and not self.base_dir.is_dir():
            raise ManagerError(f"账号根路径不是目录：{self.base_dir}")

    def _owned(self, path: Path) -> Path:
        if not _within(path, self.base_dir):
            raise ManagerError("账号路径超出了管理目录。")
        _check_chain(path)
        return path

    def _private_dir(self, path: Path) -> None:
        self._owned(path)
        secure_directory(path)

    def _layout(self) -> None:
        # base 的已有父目录由用户选择；不擅自创建或更改它们的权限。
        if not self.base_dir.parent.is_dir():
            raise ManagerError(f"账号目录的上级不存在：{self.base_dir.parent}")
        self._private_dir(self.base_dir)
        self._private_dir(self.profiles_dir)

    @contextmanager
    def _locked(self):
        lock_path = self._owned(self.base_dir / ".profiles.lock")
        flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
        try:
            descriptor = os.open(lock_path, flags, 0o600)
        except OSError as error:
            raise ManagerError(f"无法打开账号目录锁：{error}") from error
        acquired = False
        try:
            if not stat.S_ISREG(os.fstat(descriptor).st_mode):
                raise ManagerError("账号锁路径不是普通文件。")
            self._owned(lock_path)
            if os.fstat(descriptor).st_size == 0:
                os.write(descriptor, b"\0")
            deadline = time.monotonic() + 10
            while not acquired:
                os.lseek(descriptor, 0, os.SEEK_SET)
                try:
                    if os.name == "nt":
                        import msvcrt
                        msvcrt.locking(descriptor, msvcrt.LK_NBLCK, 1)
                    else:
                        import fcntl
                        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    acquired = True
                except OSError:
                    if time.monotonic() >= deadline:
                        raise ManagerError("其他管理器正在操作账号目录，请稍后重试。")
                    time.sleep(0.05)
            yield
        finally:
            try:
                if acquired:
                    os.lseek(descriptor, 0, os.SEEK_SET)
                    if os.name == "nt":
                        import msvcrt
                        msvcrt.locking(descriptor, msvcrt.LK_UNLCK, 1)
                    else:
                        import fcntl
                        fcntl.flock(descriptor, fcntl.LOCK_UN)
            finally:
                os.close(descriptor)

    def _read(self) -> list[dict]:
        self._owned(self.registry_path)
        try:
            descriptor = os.open(self.registry_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        except FileNotFoundError:
            return []
        try:
            with os.fdopen(descriptor, "rb") as stream:
                if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                    raise ManagerError("账号清单不是普通文件。")
                raw = stream.read(_MAX_REGISTRY_BYTES + 1)
            if len(raw) > _MAX_REGISTRY_BYTES:
                raise ValueError("清单过大")
            document = json.loads(raw.decode("utf-8"))
            if (not isinstance(document, dict) or type(document.get("schema")) is not int
                    or document["schema"] != 1):
                raise ValueError("未知的清单版本")
            records = document.get("profiles")
            if not isinstance(records, list):
                raise ValueError("缺少 profiles 列表")
            ids, labels = set(), {"原有账号"}
            for record in records:
                if not isinstance(record, dict) or set(record) != {"id", "label"}:
                    raise ValueError("账号记录格式不正确")
                identifier = record["id"]
                if not isinstance(identifier, str) or not _PROFILE_ID.fullmatch(identifier) or identifier == "default":
                    raise ValueError("账号标识不正确")
                label = _label(record["label"])
                if label != record["label"] or identifier in ids or label.casefold() in labels:
                    raise ValueError("账号名称或标识重复")
                ids.add(identifier)
                labels.add(label.casefold())
                root = self._owned(self.profiles_dir / identifier)
                data = self._owned(root / "user-data")
                if not root.is_dir() or not data.is_dir():
                    raise ValueError(f"账号 {label} 的目录缺失")
            return records
        except (ValueError, UnicodeError, TypeError, ManagerError) as error:
            raise ManagerError(f"账号清单或目录已损坏，未覆盖任何资料：{error}") from error

    def _write(self, records: list[dict]) -> None:
        self._owned(self.registry_path)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=self.base_dir,
                                             prefix=".profiles-", suffix=".tmp", delete=False) as stream:
                temporary = Path(stream.name)
                json.dump({"schema": 1, "profiles": records}, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
            self._owned(self.registry_path)
            os.replace(temporary, self.registry_path)
            temporary = None
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def _public(self, record: dict) -> dict:
        return {"id": record["id"], "label": record["label"], "is_default": False,
                "path": str(self.profiles_dir / record["id"] / "user-data")}

    def list_profiles(self) -> list[dict]:
        default = {"id": "default", "label": "原有账号", "is_default": True, "path": None}
        self._owned(self.base_dir)
        if not self.base_dir.exists():
            return [default]
        with self._locked():
            return [default, *(self._public(record) for record in self._read())]

    def create_profile(self, label: str) -> dict:
        label = _label(label)
        if label == "default":
            raise ManagerError("default 是原有账号的保留标识，请换一个名称。")
        self._layout()
        with self._locked():
            records = self._read()
            if label.casefold() in {"原有账号", *(r["label"].casefold() for r in records)}:
                raise ManagerError("已经有同名账号，请换一个名称。")
            identifier = label if _PROFILE_ID.fullmatch(label) else uuid.uuid4().hex
            root = self._owned(self.profiles_dir / identifier)
            if root.exists():
                raise ManagerError(f"目标目录已经存在，未覆盖：{root}")
            self._private_dir(root)
            self._private_dir(root / "user-data")
            record = {"id": identifier, "label": label}
            self._write([*records, record])
            return self._public(record)

    @staticmethod
    def resolve_app() -> dict:
        if sys.platform != "win32":
            raise ManagerError("此启动器目前仅支持 Windows 版 Claude Desktop。")
        powershell = _system32() / "WindowsPowerShell/v1.0/powershell.exe"
        try:
            result = subprocess.run(
                [str(powershell), "-NoProfile", "-NonInteractive", "-Command", _PACKAGE_QUERY],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20, check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            if result.returncode:
                raise ManagerError("Windows 未能查询 Claude Desktop 安装包。")
            packages = json.loads(result.stdout.lstrip("\ufeff").strip() or "[]")
        except (OSError, subprocess.TimeoutExpired, ValueError) as error:
            raise ManagerError(f"无法查询 Claude Desktop 安装位置：{error}") from error
        if isinstance(packages, dict):
            packages = [packages]
        if not isinstance(packages, list):
            raise ManagerError("Windows 返回的 Claude 安装包信息格式不正确。")
        candidates = []
        for package in packages:
            if not isinstance(package, dict) or package.get("Name") != "Claude":
                continue
            location, version = package.get("InstallLocation"), package.get("Version")
            if not isinstance(location, str) or not Path(location).is_absolute() or not isinstance(version, str):
                continue
            if not re.fullmatch(r"\d+(?:\.\d+){1,3}", version):
                continue
            executable = Path(location) / "app" / "Claude.exe"
            if executable.is_file():
                candidates.append((tuple(int(v) for v in version.split(".")), executable, version))
        if not candidates:
            raise ManagerError("没有找到已安装的官方 Claude Desktop（MSIX）；请先安装桌面应用。")
        _, executable, version = max(candidates, key=lambda candidate: candidate[0])
        return {"path": str(executable), "version": version, "kind": "msix"}

    def launch(self, profile_id: str) -> dict:
        if sys.platform != "win32":
            raise ManagerError("此启动器目前仅支持 Windows 版 Claude Desktop。")
        profile = next((item for item in self.list_profiles() if item["id"] == profile_id), None)
        if profile is None:
            raise ManagerError("找不到这个账号配置，请刷新账号列表。")
        app = self.resolve_app()
        arguments = [app["path"]]
        if not profile["is_default"]:
            path = self._owned(Path(profile["path"]))
            if not path.is_dir():
                raise ManagerError("账号配置目录不存在，未启动应用。")
            arguments.append("--user-data-dir=" + str(path))
        factory = self._process_factory or subprocess.Popen
        try:
            process = factory(arguments, shell=False, close_fds=True, cwd=str(Path(app["path"]).parent))
        except OSError as error:
            raise ManagerError(f"Claude Desktop 启动失败：{error}") from error
        return {"pid": process.pid, "profile": profile, "app": app}

    def inspect(self) -> dict:
        report = {"platform": sys.platform, "base_dir": str(self.base_dir),
                  "profiles": self.list_profiles(), "app": None, "reads_credentials": False}
        try:
            report["app"] = self.resolve_app()
        except ManagerError as error:
            report["app_error"] = str(error)
        return report


def resolve_desktop_app() -> dict:
    """查询官方 MSIX 安装位置，不初始化账号目录。"""
    return AccountManager.resolve_app()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Claude Desktop 独立配置启动器（实验性）")
    parser.add_argument("--base-dir", type=Path, help="独立配置的管理目录")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="列出配置")
    add = commands.add_parser("add", help="创建新的空配置；之后在官方应用登录")
    add.add_argument("label")
    launch = commands.add_parser("open", help="启动或激活指定配置")
    launch.add_argument("id")
    commands.add_parser("doctor", help="检查安装位置和配置清单，不读取登录资料")
    args = parser.parse_args(argv)
    try:
        manager = AccountManager(args.base_dir)
        if args.command == "list":
            result = manager.list_profiles()
        elif args.command == "add":
            result = manager.create_profile(args.label)
        elif args.command == "open":
            result = manager.launch(args.id)
        else:
            result = manager.inspect()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ManagerError, OSError) as error:
        print(f"错误：{error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
