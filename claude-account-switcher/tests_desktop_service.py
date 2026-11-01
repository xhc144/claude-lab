import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

from account_manager import ManagerError
from desktop_service import DesktopService
from profile_switcher import ProfileSwitcherError


class DesktopServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.live = self.root / "Claude"
        self.live.mkdir()
        (self.live / "config.json").write_bytes(b'opaque-first-account-state')
        (self.live / "claude_desktop_config.json").write_text('{}', encoding="utf-8")
        self.base = self.root / "accounts"
        self.app = {"path": str(self.root / "Claude.exe"), "version": "4.29.0.0", "kind": "msix"}
        self.running = False
        self.launches = []

        def guard():
            if self.running:
                raise ManagerError("Claude Desktop 仍在运行")

        def launch(args, **kwargs):
            self.launches.append((args, kwargs))
            return SimpleNamespace(pid=1234)

        self.service = DesktopService(self.base, app_resolver=lambda: self.app,
                                      process_guard=guard, process_factory=launch)
        self.service.candidates = lambda: [self.live] if (self.live / "config.json").is_file() else []

    def tearDown(self):
        self.temp.cleanup()

    def initialize(self):
        self.service.initialize(self.live)

    def test_inspection_does_not_initialize_or_read_credentials(self):
        self.assertFalse(self.service.inspect()["initialized"])
        self.assertFalse(self.base.exists())
        self.assertEqual((self.live / "config.json").read_bytes(), b'opaque-first-account-state')

    def test_initialization_preserves_current_login_in_place(self):
        self.initialize()
        self.assertEqual(self.service.inspect()["active"], "default")
        self.assertEqual((self.live / "config.json").read_bytes(), b'opaque-first-account-state')
        self.assertFalse((self.base / "stored/default/data").exists())

    def test_switch_launch_uses_native_default_with_no_profile_or_auth_arguments(self):
        self.initialize()
        new = self.service.add_profile("账号 B")
        opened = self.service.open_profile(new["id"])
        self.assertEqual(opened["pid"], 1234)
        self.assertEqual(self.launches[0][0], [self.app["path"]])
        self.assertFalse(self.launches[0][1]["shell"])
        self.assertFalse((self.live / "config.json").exists())
        self.assertEqual((self.base / "stored/default/data/config.json").read_bytes(), b'opaque-first-account-state')
        (self.live / "config.json").write_bytes(b'opaque-second-account-state')
        self.service.open_profile("default")
        self.assertEqual((self.live / "config.json").read_bytes(), b'opaque-first-account-state')

    def test_running_client_blocks_account_change_without_launch_or_directory_change(self):
        self.initialize()
        new = self.service.add_profile("B")
        self.running = True
        with self.assertRaises(ManagerError):
            self.service.open_profile(new["id"])
        self.assertEqual(self.service.inspect()["active"], "default")
        self.assertEqual((self.live / "config.json").read_bytes(), b'opaque-first-account-state')
        self.assertEqual(self.launches, [])

    def test_current_account_can_be_activated_while_running(self):
        self.initialize()
        self.running = True
        self.service.open_profile("default")
        self.assertEqual(len(self.launches), 1)

    def test_pending_operation_blocks_even_current_account_launch(self):
        self.initialize()
        (self.base / "transaction.json").write_text('{}', encoding="utf-8")
        with self.assertRaises(ProfileSwitcherError):
            self.service.open_profile("default")
        self.assertEqual(self.launches, [])

    def test_missing_active_directory_is_not_replaced_by_a_fresh_launch(self):
        self.initialize()
        self.live.rename(self.root / "unexpected-migration")
        with self.assertRaises(ProfileSwitcherError):
            self.service.open_profile("default")
        self.assertFalse(self.live.exists())
        self.assertEqual(self.launches, [])

    def test_app_resolution_failure_happens_before_directory_switch(self):
        self.initialize()
        new = self.service.add_profile("B")
        self.service.app_resolver = lambda: (_ for _ in ()).throw(ManagerError("app not found"))
        with self.assertRaises(ManagerError):
            self.service.open_profile(new["id"])
        self.assertEqual(self.service.engine().status()["active"], "default")

    def test_corrupt_registry_does_not_reinitialize_or_overwrite(self):
        self.initialize()
        registry = self.base / "switcher.json"
        registry.write_text('not-json', encoding="utf-8")
        with self.assertRaises(ManagerError):
            self.service.initialize(self.live)
        self.assertEqual(registry.read_text(encoding="utf-8"), 'not-json')

    def test_launch_failure_reports_committed_selection_and_keeps_both_profiles(self):
        self.initialize()
        new = self.service.add_profile("B")
        self.service.process_factory = lambda *a, **k: (_ for _ in ()).throw(OSError("test"))
        with self.assertRaisesRegex(ManagerError, "启动失败"):
            self.service.open_profile(new["id"])
        self.assertEqual(self.service.inspect()["active"], new["id"])
        self.assertTrue((self.base / "stored/default/data/config.json").is_file())

    def test_open_operation_lock_prevents_interleaved_launches(self):
        self.initialize()
        with self.service.operation():
            with self.assertRaises(ManagerError):
                self.service.open_profile("default")
        self.assertEqual(self.launches, [])

    def test_unrelated_folder_cannot_be_registered_as_the_native_profile(self):
        unrelated = self.root / "Documents"
        unrelated.mkdir()
        with self.assertRaises(ManagerError):
            self.service.initialize(unrelated)
        self.assertFalse(self.base.exists())

    def test_migrated_native_data_blocks_rotation_of_a_stale_folder(self):
        self.initialize()
        new = self.service.add_profile("B")
        migrated = self.root / "Claude-Data" / "claude_packagefamily"
        migrated.mkdir(parents=True)
        (migrated / "config.json").write_bytes(b'new-native-state')
        self.service.candidates = lambda: [self.live, migrated]
        with self.assertRaisesRegex(ManagerError, "迁移"):
            self.service.open_profile(new["id"])
        self.assertEqual(self.service.engine().status()["active"], "default")
        self.assertEqual(self.launches, [])


if __name__ == "__main__":
    unittest.main()
