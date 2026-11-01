"""Move whole Claude profiles through its native default directory.

This module never launches applications, logs out, reads credential contents,
or copies profile files. The caller must supply a guard that rejects running
Claude processes. Failed/interrupted moves leave a recoverable journal.
"""
from __future__ import annotations

from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import stat
import tempfile
from typing import Callable, Iterator
import uuid


class ProfileSwitcherError(RuntimeError):
    pass


class PendingTransactionError(ProfileSwitcherError):
    pass


class ProfileSwitcher:
    def __init__(self, base_dir: Path, live_dir: Path,
                 process_guard: Callable[[], None]):
        self.base = Path(os.path.abspath(os.path.expanduser(str(base_dir))))
        self.live = Path(os.path.abspath(os.path.expanduser(str(live_dir))))
        self.guard = process_guard
        self.registry_path = self.base / "switcher.json"
        self.journal_path = self.base / "transaction.json"
        self.stored = self.base / "stored"
        self._validate_roots()

    @staticmethod
    def _exists(path: Path) -> bool:
        return os.path.lexists(path)

    @staticmethod
    def _label(label: str) -> str:
        if not isinstance(label, str):
            raise ProfileSwitcherError("账号名称必须是文字")
        label = label.strip()
        if (not label or len(label) > 64 or label in {".", ".."}
                or any(ord(c) < 32 or ord(c) == 127 or c in '/\\:*?"<>|' for c in label)):
            raise ProfileSwitcherError("账号名称须为 1–64 个字符，不能包含路径分隔符或控制字符")
        return label

    @staticmethod
    def _id(value: str) -> str:
        if not isinstance(value, str) or not re.fullmatch(r"default|[0-9a-f]{32}", value):
            raise ProfileSwitcherError("账号编号无效")
        return value

    @staticmethod
    def _check_path(path: Path) -> None:
        # lstat every existing component; resolve() would hide a junction/link.
        for part in reversed((path, *path.parents)):
            try:
                info = part.lstat()
            except FileNotFoundError:
                continue
            if (stat.S_ISLNK(info.st_mode)
                    or getattr(info, "st_file_attributes", 0) & 0x400):
                raise ProfileSwitcherError(f"账号目录及其父目录不能使用符号链接或重解析点：{part}")

    @classmethod
    def _check_tree(cls, path: Path) -> None:
        # A directory rename does not dereference its descendants. Preserve
        # nested links and all other profile entries as opaque native state.
        cls._check_path(path)
        if not cls._exists(path):
            return
        if not path.is_dir():
            raise ProfileSwitcherError(f"此路径应为文件夹：{path}")

    @staticmethod
    def _device(path: Path) -> int:
        while not path.exists():
            if path.parent == path:
                raise ProfileSwitcherError(f"找不到现有父目录：{path}")
            path = path.parent
        return path.stat().st_dev

    def _validate_roots(self) -> None:
        for path in (self.base, self.live):
            self._check_path(path)
        left, right = (os.path.normcase(str(p)) for p in (self.base, self.live))
        try:
            common = os.path.commonpath((left, right))
        except ValueError as exc:
            raise ProfileSwitcherError("账号存储与 Claude 数据必须位于同一磁盘卷") from exc
        if common in (left, right):
            raise ProfileSwitcherError("账号存储与 Claude 数据必须使用彼此独立的目录，不能互相包含")
        if self._device(self.base) != self._device(self.live):
            raise ProfileSwitcherError("账号存储与 Claude 数据必须位于同一磁盘卷")

    @contextmanager
    def _locked(self, create: bool = False) -> Iterator[None]:
        self._validate_roots()
        if not self.base.exists():
            if not create:
                raise ProfileSwitcherError("账号存储尚未初始化")
            self.guard()
            self.base.mkdir(parents=True)
        lock = self.base / "switcher.lock"
        self._check_path(lock)
        if lock.exists() and not lock.is_file():
            raise ProfileSwitcherError(f"操作锁路径不是普通文件：{lock}")
        with lock.open("a+b") as handle:
            handle.seek(0, os.SEEK_END)
            if handle.tell() == 0:
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
            except OSError as exc:
                raise ProfileSwitcherError("另一个账号操作正在进行，请稍后重试") from exc
            try:
                self._check_path(self.stored)
                yield
            finally:
                handle.seek(0)
                if os.name == "nt":
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    @staticmethod
    def _sync_dir(path: Path) -> None:
        if os.name != "nt":
            descriptor = os.open(path, os.O_RDONLY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)

    def _write_json(self, path: Path, data: dict) -> None:
        self._check_path(path)
        if path.exists() and not path.is_file():
            raise ProfileSwitcherError(f"管理数据路径不是普通文件：{path}")
        descriptor, temporary = tempfile.mkstemp(prefix=".pending-", dir=self.base)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
                json.dump(data, handle, ensure_ascii=False, indent=2)
                handle.flush()
                os.fsync(handle.fileno())
            self._check_path(path)
            os.replace(temporary, path)
            self._sync_dir(self.base)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def _read_json(self, path: Path) -> dict:
        self._check_path(path)
        if not path.is_file() or path.stat().st_size > 1024 * 1024:
            raise ProfileSwitcherError(f"管理数据缺失或无效：{path}")
        try:
            with path.open(encoding="utf-8") as handle:
                value = json.load(handle)
        except (OSError, ValueError) as exc:
            raise ProfileSwitcherError(f"无法读取管理数据：{path}") from exc
        if not isinstance(value, dict):
            raise ProfileSwitcherError(f"管理数据格式无效：{path}")
        return value

    def _validate_registry(self, data: dict) -> dict:
        if (not isinstance(data, dict) or type(data.get("schema")) is not int
                or data.get("schema") != 1 or data.get("live_dir") != str(self.live)
                or not isinstance(data.get("profiles"), list) or not data["profiles"]):
            raise ProfileSwitcherError("账号清单格式无效，或 Claude 数据目录与初始化时不同")
        ids, labels = set(), set()
        for profile in data["profiles"]:
            if not isinstance(profile, dict):
                raise ProfileSwitcherError("账号记录无效")
            ident, label = self._id(profile.get("id")), self._label(profile.get("label"))
            if ident in ids or label.casefold() in labels or profile["label"] != label:
                raise ProfileSwitcherError("账号记录重复或无效")
            ids.add(ident)
            labels.add(label.casefold())
        if self._id(data.get("active")) not in ids:
            raise ProfileSwitcherError("当前账号不在账号清单中")
        return data

    def _registry(self) -> dict:
        return self._validate_registry(self._read_json(self.registry_path))

    def _data(self, ident: str) -> Path:
        return self.stored / self._id(ident) / "data"

    @staticmethod
    def _identity(path: Path) -> list[int]:
        info = path.stat()
        if not info.st_ino:
            raise ProfileSwitcherError(f"此文件系统无法提供稳定的目录标识：{path}")
        return [info.st_dev, info.st_ino]

    def _no_pending(self) -> None:
        self._check_path(self.journal_path)
        if self._exists(self.journal_path):
            raise PendingTransactionError(f"上次操作未完成，请先执行恢复：{self.journal_path}")

    def _layout(self, data: dict) -> None:
        self._check_tree(self.base)
        self._check_tree(self.live)
        if not self.live.is_dir():
            raise ProfileSwitcherError(f"Claude 数据目录缺失：{self.live}")
        for item in data["profiles"]:
            path = self._data(item["id"])
            self._check_tree(path)
            if self._exists(path) == (item["id"] == data["active"]):
                raise ProfileSwitcherError(f"账号目录状态与清单冲突：{path}")
            if self._exists(path) and not path.is_dir():
                raise ProfileSwitcherError(f"账号路径不是文件夹：{path}")

    def initialize(self, label: str = "原有账号") -> dict:
        label = self._label(label)
        with self._locked(create=True):
            if self.registry_path.exists():
                return self._registry()
            self._no_pending()
            self.guard()
            self._check_tree(self.live)
            if not self.live.is_dir():
                raise ProfileSwitcherError(f"Claude 数据目录不存在：{self.live}")
            if self._exists(self.stored):
                raise ProfileSwitcherError(f"此处已有未登记的账号存储，请勿覆盖：{self.stored}")
            self.stored.mkdir()
            data = {"schema": 1, "live_dir": str(self.live), "active": "default",
                    "profiles": [{"id": "default", "label": label}]}
            self._write_json(self.registry_path, data)
            return data

    def _profiles(self, data: dict) -> list[dict]:
        return [{**item, "active": item["id"] == data["active"],
                 "path": str(self.live if item["id"] == data["active"] else self._data(item["id"]))}
                for item in data["profiles"]]

    def list_profiles(self) -> list[dict]:
        with self._locked():
            return self._profiles(self._registry())

    def add_profile(self, label: str) -> dict:
        label = self._label(label)
        with self._locked():
            self._no_pending()
            data = self._registry()
            self._layout(data)
            if any(item["label"].casefold() == label.casefold() for item in data["profiles"]):
                raise ProfileSwitcherError("已有同名账号")
            self.guard()
            ident = uuid.uuid4().hex
            directory = self._data(ident)
            directory.parent.mkdir()  # Never exist_ok: no existing profile is overwritten.
            try:
                directory.mkdir()
                item = {"id": ident, "label": label}
                data["profiles"].append(item)
                self._write_json(self.registry_path, data)
            except Exception:
                # These directories were created above and may only be removed if empty.
                try:
                    directory.rmdir()
                    directory.parent.rmdir()
                except OSError:
                    pass
                raise
            return {**item, "active": False, "path": str(directory)}

    def _move(self, source: Path, destination: Path) -> None:
        self.guard()
        self._validate_roots()
        self._check_tree(source)
        self._check_path(destination)
        if not source.is_dir() or self._exists(destination):
            raise ProfileSwitcherError(f"为保护数据，已拒绝移动：{source} -> {destination}")
        if not destination.parent.is_dir():
            raise ProfileSwitcherError(f"目标父目录缺失：{destination.parent}")
        os.rename(source, destination)
        self._sync_dir(source.parent)
        if source.parent != destination.parent:
            self._sync_dir(destination.parent)

    def switch_to(self, ident: str) -> dict:
        ident = self._id(ident)
        with self._locked():
            self._no_pending()
            before = self._registry()
            self._layout(before)
            target = next((item for item in before["profiles"] if item["id"] == ident), None)
            if target is None:
                raise ProfileSwitcherError("找不到该账号")
            if ident == before["active"]:
                return {"active": ident, "label": target["label"], "live_dir": str(self.live),
                        "changed": False, "pending_transaction": False}
            self.guard()
            old = self._data(before["active"])
            self._check_path(old)
            old.parent.mkdir(exist_ok=True)
            journal = {"schema": 1, "transaction": uuid.uuid4().hex,
                       "from": before["active"], "to": ident, "registry_before": before,
                       "outgoing_identity": self._identity(self.live),
                       "target_identity": self._identity(self._data(ident))}
            self._write_json(self.journal_path, journal)
            try:
                self._move(self.live, old)
                self._move(self._data(ident), self.live)
                self.guard()
                after = {**before, "active": ident}
                self._write_json(self.registry_path, after)
                self._clear_journal()
            except Exception as exc:
                try:
                    self._recover_locked()
                except Exception as recovery:
                    raise PendingTransactionError(
                        f"切换中断，需要恢复。{exc}；{recovery}。"
                        f"当前目录：{self.live}；原账号目录：{old}；目标账号目录：{self._data(ident)}；"
                        f"事务记录：{self.journal_path}") from exc
                raise ProfileSwitcherError(f"切换未完成，账号目录已恢复：{exc}") from exc
            return {"active": ident, "label": target["label"], "live_dir": str(self.live),
                    "changed": True, "pending_transaction": False}

    def _clear_journal(self) -> None:
        self.guard()
        self._check_path(self.journal_path)
        self.journal_path.unlink()
        self._sync_dir(self.base)

    def _recover_locked(self) -> bool:
        if not self._exists(self.journal_path):
            return False
        self.guard()
        journal = self._read_json(self.journal_path)
        before = self._validate_registry(journal.get("registry_before", {}))
        current = self._registry()
        old_id, new_id = self._id(journal.get("from")), self._id(journal.get("to"))
        if (journal.get("schema") != 1 or old_id == new_id or before["active"] != old_id
                or not any(p["id"] == new_id for p in before["profiles"])
                or current not in (before, {**before, "active": new_id})):
            raise PendingTransactionError("事务记录与账号清单不一致，已停止恢复")
        self._check_tree(self.base)
        self._check_tree(self.live)
        old, target = self._data(old_id), self._data(new_id)
        self._check_tree(old)
        self._check_tree(target)
        topology = tuple(self._exists(path) for path in (self.live, old, target))
        expected_old, expected_target = journal.get("outgoing_identity"), journal.get("target_identity")
        for identity in (expected_old, expected_target):
            if (not isinstance(identity, list) or len(identity) != 2
                    or not all(type(number) is int and number >= 0 for number in identity)
                    or not identity[1]):
                raise PendingTransactionError("事务记录缺少有效的目录标识，已停止恢复")
        locations = {(True, False, True): ((self.live, expected_old), (target, expected_target)),
                     (False, True, True): ((old, expected_old), (target, expected_target)),
                     (True, True, False): ((old, expected_old), (self.live, expected_target))}
        if topology not in locations or any(self._identity(path) != expected for path, expected in locations[topology]):
            raise PendingTransactionError("目录标识已改变或位置不明确，未执行恢复移动")
        if current["active"] == new_id:
            if topology != (True, True, False):
                raise PendingTransactionError("已提交事务的目录位置不明确，已停止恢复")
        elif topology == (True, False, True):
            pass  # No move happened, or rollback already finished.
        elif topology == (False, True, True):
            self._move(old, self.live)
        elif topology == (True, True, False):
            self._move(self.live, target)
            self._move(old, self.live)
        else:
            raise PendingTransactionError(
                f"账号目录位置不明确，未移动任何数据。当前目录={self.live}；原账号目录={old}；目标账号目录={target}")
        self._clear_journal()
        return True

    def recover(self) -> dict:
        with self._locked():
            recovered = self._recover_locked()
            result = self._status_locked()
            result["recovered"] = recovered
            return result

    def _status_locked(self) -> dict:
        data = self._registry()
        self._check_path(self.journal_path)
        return {"initialized": True, "active": data["active"], "live_dir": str(self.live),
                "profiles": self._profiles(data),
                "pending_transaction": self._exists(self.journal_path),
                "journal": str(self.journal_path) if self._exists(self.journal_path) else None}

    def status(self) -> dict:
        if not self.base.exists():
            return {"initialized": False, "active": None, "live_dir": str(self.live),
                    "profiles": [], "pending_transaction": False, "journal": None}
        with self._locked():
            if not self.registry_path.exists():
                return {"initialized": False, "active": None, "live_dir": str(self.live),
                        "profiles": [], "pending_transaction": self._exists(self.journal_path),
                        "journal": str(self.journal_path) if self._exists(self.journal_path) else None}
            return self._status_locked()
