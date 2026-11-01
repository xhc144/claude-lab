"""Hermetic profile-rotation tests; no real Claude data or processes."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from profile_switcher import PendingTransactionError, ProfileSwitcher, ProfileSwitcherError


class Crash(BaseException):
    """A process death bypasses the normal Exception rollback path."""


class SwitcherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="claude-profile-test-")
        self.root = Path(self.temp.name)
        self.live = self.root / "native-default"
        self.base = self.root / "manager"
        self.live.mkdir()
        (self.live / "config.json").write_text("opaque-original", encoding="utf-8")
        (self.live / "Network").mkdir()
        (self.live / "Network" / "Cookies").write_bytes(b"opaque-cookie-database")
        self.running = False
        self.guard_calls = 0
        self.switcher = ProfileSwitcher(self.base, self.live, self.guard)

    def tearDown(self):
        self.temp.cleanup()

    def guard(self):
        self.guard_calls += 1
        if self.running:
            raise ProfileSwitcherError("Claude is running")

    def setup_two(self):
        self.switcher.initialize()
        return self.switcher.add_profile("工作账号")

    def crash_after_move(self, number, target):
        original = self.switcher._move
        calls = 0

        def move(source, destination):
            nonlocal calls
            original(source, destination)
            calls += 1
            if calls == number:
                raise Crash()

        with patch.object(self.switcher, "_move", side_effect=move):
            with self.assertRaises(Crash):
                self.switcher.switch_to(target["id"])

    def test_constructor_does_not_read_or_modify_profile(self):
        with patch.object(Path, "open", side_effect=AssertionError("opened a file")):
            ProfileSwitcher(self.base, self.live, self.guard)
        self.assertFalse(self.base.exists())
        self.assertEqual(self.guard_calls, 0)

    def test_round_trip_moves_whole_profile_and_latest_state(self):
        original_inode = self.live.stat().st_ino
        target = self.setup_two()
        target_inode = Path(target["path"]).stat().st_ino
        self.switcher.switch_to(target["id"])
        self.assertEqual(self.live.stat().st_ino, target_inode)
        self.assertEqual(list(self.live.iterdir()), [])
        self.assertFalse(Path(target["path"]).exists())
        parked = self.base / "stored" / "default" / "data"
        self.assertEqual(parked.stat().st_ino, original_inode)
        self.assertEqual((parked / "Network" / "Cookies").read_bytes(), b"opaque-cookie-database")
        (self.live / "config.json").write_text("latest-work-state", encoding="utf-8")
        self.switcher.switch_to("default")
        self.assertEqual(self.live.stat().st_ino, original_inode)
        self.assertEqual((self.live / "config.json").read_text(), "opaque-original")
        self.switcher.switch_to(target["id"])
        self.assertEqual((self.live / "config.json").read_text(), "latest-work-state")
        status = self.switcher.status()
        self.assertEqual(status["active"], target["id"])
        self.assertFalse(status["pending_transaction"])
        self.assertEqual(sum(p["active"] for p in status["profiles"]), 1)

    def test_running_guard_prevents_initialization_or_move(self):
        self.running = True
        with self.assertRaises(ProfileSwitcherError):
            self.switcher.initialize()
        self.assertFalse(self.base.exists())
        self.running = False
        target = self.setup_two()
        self.running = True
        with self.assertRaises(ProfileSwitcherError):
            self.switcher.switch_to(target["id"])
        self.assertEqual((self.live / "config.json").read_text(), "opaque-original")
        self.assertFalse(self.switcher.status()["pending_transaction"])

    def test_exception_before_second_move_rolls_back(self):
        target = self.setup_two()
        original = self.switcher._move
        calls = 0

        def move(source, destination):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("injected disk failure")
            original(source, destination)

        with patch.object(self.switcher, "_move", side_effect=move):
            with self.assertRaisesRegex(ProfileSwitcherError, "已恢复"):
                self.switcher.switch_to(target["id"])
        self.assertEqual(self.switcher.status()["active"], "default")
        self.assertEqual((self.live / "config.json").read_text(), "opaque-original")
        self.assertTrue(Path(target["path"]).is_dir())
        self.assertFalse(self.switcher.journal_path.exists())

    def test_crash_after_first_move_recovers_after_new_instance(self):
        target = self.setup_two()
        self.crash_after_move(1, target)
        self.assertFalse(self.live.exists())
        reopened = ProfileSwitcher(self.base, self.live, self.guard)
        self.assertTrue(reopened.status()["pending_transaction"])
        with self.assertRaises(PendingTransactionError):
            reopened.add_profile("blocked")
        result = reopened.recover()
        self.assertTrue(result["recovered"])
        self.assertEqual(result["active"], "default")
        self.assertEqual((self.live / "config.json").read_text(), "opaque-original")
        self.assertTrue(Path(target["path"]).exists())

    def test_crash_after_second_move_rolls_back_target_then_original(self):
        target = self.setup_two()
        self.crash_after_move(2, target)
        self.assertEqual(list(self.live.iterdir()), [])
        self.assertFalse(Path(target["path"]).exists())
        self.switcher.recover()
        self.assertEqual((self.live / "config.json").read_text(), "opaque-original")
        self.assertTrue(Path(target["path"]).exists())
        self.assertFalse(self.switcher.journal_path.exists())

    def test_crash_after_registry_commit_finalizes_without_undo(self):
        target = self.setup_two()
        with patch.object(self.switcher, "_clear_journal", side_effect=Crash()):
            with self.assertRaises(Crash):
                self.switcher.switch_to(target["id"])
        self.assertEqual(self.switcher.status()["active"], target["id"])
        result = self.switcher.recover()
        self.assertEqual(result["active"], target["id"])
        self.assertFalse(result["pending_transaction"])
        self.assertEqual(list(self.live.iterdir()), [])

    def test_guard_change_leaves_recovery_pending_until_idle(self):
        target = self.setup_two()
        original = self.switcher._move

        def move(source, destination):
            original(source, destination)
            self.running = True

        with patch.object(self.switcher, "_move", side_effect=move):
            with self.assertRaises(PendingTransactionError):
                self.switcher.switch_to(target["id"])
        self.assertTrue(self.switcher.journal_path.exists())
        with self.assertRaises(ProfileSwitcherError):
            self.switcher.recover()
        self.running = False
        self.switcher.recover()
        self.assertEqual((self.live / "config.json").read_text(), "opaque-original")

    def test_recovery_refuses_collision_without_moving_anything(self):
        target = self.setup_two()
        self.crash_after_move(1, target)
        self.live.mkdir()
        (self.live / "unrelated.txt").write_text("must remain")
        with self.assertRaises(PendingTransactionError):
            self.switcher.recover()
        self.assertEqual((self.live / "unrelated.txt").read_text(), "must remain")
        self.assertTrue(self.switcher.journal_path.exists())
        self.assertTrue(Path(target["path"]).exists())

    def test_recovery_checks_directory_identity_not_just_path(self):
        target = self.setup_two()
        self.crash_after_move(2, target)
        genuine_target = self.root / "moved-externally"
        self.live.rename(genuine_target)
        self.live.mkdir()
        (self.live / "unrelated.txt").write_text("must remain")
        with self.assertRaisesRegex(PendingTransactionError, "标识"):
            self.switcher.recover()
        self.assertTrue(genuine_target.is_dir())
        self.assertEqual((self.live / "unrelated.txt").read_text(), "must remain")

    def test_malformed_journal_is_never_deleted(self):
        self.setup_two()
        self.switcher.journal_path.write_text('{"registry_before": {}}')
        with self.assertRaises(ProfileSwitcherError):
            self.switcher.recover()
        self.assertTrue(self.switcher.journal_path.exists())
        self.assertEqual((self.live / "config.json").read_text(), "opaque-original")

    def test_registry_failure_after_moves_rolls_back(self):
        target = self.setup_two()
        write = self.switcher._write_json

        def fail_registry(path, data):
            if path == self.switcher.registry_path:
                raise OSError("cannot commit registry")
            write(path, data)

        with patch.object(self.switcher, "_write_json", side_effect=fail_registry):
            with self.assertRaisesRegex(ProfileSwitcherError, "已恢复"):
                self.switcher.switch_to(target["id"])
        self.assertEqual(self.switcher.status()["active"], "default")
        self.assertEqual((self.live / "config.json").read_text(), "opaque-original")

    def test_ids_labels_and_disjoint_roots_are_validated(self):
        self.setup_two()
        for label in ("", "../account", "..", "a\nname", "x" * 65):
            with self.subTest(label=label), self.assertRaises(ProfileSwitcherError):
                self.switcher.add_profile(label)
        for ident in ("../default", "a/b", "C:\\other", "unknown", None):
            with self.subTest(ident=ident), self.assertRaises(ProfileSwitcherError):
                self.switcher.switch_to(ident)
        for base, live in ((self.live, self.live), (self.live / "manager", self.live),
                           (self.root, self.live)):
            with self.assertRaises(ProfileSwitcherError):
                ProfileSwitcher(base, live, self.guard)

    def test_duplicate_account_names_are_rejected(self):
        self.switcher.initialize("Main")
        with self.assertRaises(ProfileSwitcherError):
            self.switcher.add_profile("main")

    def test_cross_process_lock_rejects_another_handle(self):
        self.switcher.initialize()
        another = ProfileSwitcher(self.base, self.live, self.guard)
        with self.switcher._locked():
            with self.assertRaisesRegex(ProfileSwitcherError, "正在进行"):
                another.status()

    def test_nested_symlink_is_preserved_without_traversal(self):
        target = self.setup_two()
        outside = self.root / "outside"
        outside.mkdir()
        link = self.live / "linked-dir"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("Symlink creation unavailable on this Windows account")
        (outside / "must-stay.txt").write_text("external data")
        self.switcher.switch_to(target["id"])
        parked_link = self.base / "stored" / "default" / "data" / "linked-dir"
        self.assertTrue(parked_link.is_symlink())
        self.assertEqual((outside / "must-stay.txt").read_text(), "external data")
        self.switcher.switch_to("default")
        self.assertTrue(link.is_symlink())

    def test_profile_root_symlink_is_rejected(self):
        target = self.setup_two()
        path = Path(target["path"])
        path.rmdir()
        try:
            path.symlink_to(self.live, target_is_directory=True)
        except OSError:
            path.mkdir()
            self.skipTest("Symlink creation unavailable on this Windows account")
        with self.assertRaisesRegex(ProfileSwitcherError, "重解析"):
            self.switcher.switch_to(target["id"])
        self.assertTrue(path.is_symlink())

    def test_windows_reparse_attribute_is_rejected(self):
        info = type("Info", (), {"st_mode": 0o100600, "st_file_attributes": 0x400})()
        with patch.object(Path, "lstat", return_value=info):
            with self.assertRaisesRegex(ProfileSwitcherError, "重解析"):
                self.switcher._check_path(self.live / "junction")

    def test_repeated_initialize_preserves_registry(self):
        target = self.setup_two()
        self.switcher.switch_to(target["id"])
        result = self.switcher.initialize("Another name")
        self.assertEqual(result["active"], target["id"])
        self.assertEqual(len(result["profiles"]), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
