"""Exercise remote control with isolated files and a fake service/UI boundary."""
from __future__ import annotations

import copy
from contextlib import closing, contextmanager
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


PROJECT = Path(__file__).resolve().parents[1]
if str(PROJECT) not in sys.path:
    sys.path.insert(0, str(PROJECT))

import remote_helper as helper


@contextmanager
def fixture_database(path):
    with closing(sqlite3.connect(path)) as con, con:
        yield con


class FakeDesktop:
    def __init__(self, events):
        self.events = events
        self.title = "旧服务群"
        self.missing = False
        self.wrong_title = False

    def open_contact(self, name):
        self.events.append("ui.open")
        if self.missing:
            raise RuntimeError("synthetic missing search result")
        self.title = "其他会话" if self.wrong_title else name

    def read_title(self):
        self.events.append("ui.title")
        return self.title

    def same_contact(self, actual, expected):
        self.events.append("ui.verify")
        return actual == expected


class CommitFailure(sqlite3.Connection):
    def commit(self):
        raise sqlite3.OperationalError("synthetic commit failure")


class RemoteHelperTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="wx-control-tests-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.config_path = self.root / "config.json"
        self.db_path = self.root / "memory.sqlite3"
        self.cfg = {
            "behavior": {
                "reply_mode": "allowlist",
                "allowed_contacts": ["旧服务群"],
                "group_contacts": ["旧服务群"],
                "blocked_patterns": ["公众号"],
                "no_address_contacts": ["旧服务群"],
                "group_queue_enabled": True,
                "dry_run": False,
            },
            "paths": {"db": str(self.db_path)},
            "persona": {"name": "测试助手"},
            "ui": {"display": ":99"},
            "unrelated": {"preserve": "unchanged"},
        }
        self.config_path.write_text(json.dumps(self.cfg, ensure_ascii=False), encoding="utf-8")
        self.original_config = self.config_path.read_bytes()
        with fixture_database(self.db_path) as con:
            con.executescript(
                "CREATE TABLE allowed(name TEXT PRIMARY KEY, allowed INTEGER, "
                "created_at TEXT, updated_at TEXT);"
                "CREATE TABLE kv(key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);"
                "CREATE TABLE convs(conv_id TEXT PRIMARY KEY, name TEXT, kind TEXT);"
            )
            con.execute("INSERT INTO allowed VALUES(?,1,'before','before')", ("旧服务群",))
            con.execute("INSERT INTO allowed VALUES(?,1,'before','before')", ("旧私聊",))
            con.execute("INSERT INTO kv VALUES('paused','0','before')")
            con.execute("INSERT INTO convs VALUES('old','旧服务群','group')")
        self.events = []
        self.service = "active"
        self.ui = FakeDesktop(self.events)
        self.runner_calls = []
        self.addCleanup(patch.stopall)
        patch.dict(os.environ).start()
        patch.object(sys, "path", list(sys.path)).start()
        self.manager = helper.Manager(root=self.root, runner=self.run_command)
        patch.object(self.manager, "load", side_effect=self.load_fixture).start()
        self.get_ui = patch.object(self.manager, "get_ui", return_value=self.ui).start()

    def load_fixture(self):
        return json.loads(self.config_path.read_text(encoding="utf-8"))

    def run_command(self, argv, **kwargs):
        self.runner_calls.append(list(argv))
        if "is-active" in argv:
            state = "active" if argv[-1] == "wx-wechat.service" else self.service
            return subprocess.CompletedProcess(argv, 0 if state == "active" else 3,
                                               (state + "\n").encode(), b"")
        if "stop" in argv:
            self.events.append("service.stop")
            self.service = "inactive"
        elif "start" in argv:
            self.events.append("service.start")
            self.service = "active"
        else:
            raise AssertionError("Unexpected subprocess: " + repr(argv))
        return subprocess.CompletedProcess(argv, 0, b"", b"")

    def database_snapshot(self):
        with fixture_database(self.db_path) as con:
            return {
                "allowed": con.execute("SELECT * FROM allowed ORDER BY name").fetchall(),
                "kv": con.execute("SELECT * FROM kv ORDER BY key").fetchall(),
                "convs": con.execute("SELECT * FROM convs ORDER BY conv_id").fetchall(),
            }

    def paused(self):
        with fixture_database(self.db_path) as con:
            return con.execute("SELECT value FROM kv WHERE key='paused'").fetchone()[0]

    def prepare_paused_single_target(self):
        self.service = "inactive"
        with fixture_database(self.db_path) as con:
            con.execute("UPDATE allowed SET allowed=0 WHERE name='旧私聊'")
            con.execute("UPDATE kv SET value='1' WHERE key='paused'")

    def test_invalid_requests_have_no_external_or_persistent_effect(self):
        before = self.database_snapshot()
        invalid = [None, [], "status", {}, {"action": "delete"},
                   {"action": []}, {"action": {}}, {"action": True},
                   {"action": "status", "group": "unexpected"},
                   {"action": "pause", "command": "unexpected"}]
        for request in invalid:
            with self.subTest(request=request):
                with self.assertRaises(helper.ControlFailure):
                    self.manager.execute(request)
                self.assertEqual(self.config_path.read_bytes(), self.original_config)
                self.assertEqual(self.database_snapshot(), before)
                self.assertEqual(self.runner_calls, [])
                self.get_ui.assert_not_called()

    def test_invalid_group_names_have_no_external_or_persistent_effect(self):
        before = self.database_snapshot()
        for group in [None, [], {}, "", "  ", "群" * 101, "群\n二", "群\x00二", "群\u200b二"]:
            with self.subTest(group=group):
                with self.assertRaises(helper.ControlFailure):
                    self.manager.execute({"action": "switch", "group": group})
                self.assertEqual(self.config_path.read_bytes(), self.original_config)
                self.assertEqual(self.database_snapshot(), before)
                self.assertEqual(self.runner_calls, [])
                self.get_ui.assert_not_called()

    def test_switch_stops_and_verifies_before_backing_up_and_updating(self):
        real_pause = self.manager.set_paused
        real_backup = self.manager.backup
        real_update = self.manager.update_target
        old_allowed = self.database_snapshot()["allowed"]

        def pause(cfg, value):
            self.events.append("pause.persist")
            return real_pause(cfg, value)

        def backup(cfg):
            self.events.append("backup")
            self.assertEqual(self.service, "inactive")
            self.assertEqual(self.paused(), "1")
            self.assertEqual(self.config_path.read_bytes(), self.original_config)
            self.assertEqual(self.database_snapshot()["allowed"], old_allowed)
            return real_backup(cfg)

        def update(cfg, target):
            self.events.append("targets.update")
            return real_update(cfg, target)

        with patch.object(self.manager, "set_paused", side_effect=pause), \
                patch.object(self.manager, "backup", side_effect=backup), \
                patch.object(self.manager, "update_target", side_effect=update):
            result = self.manager.execute({"action": "switch", "group": "新服务群"})
        expected = ["pause.persist", "service.stop", "ui.open", "ui.title", "ui.verify", "backup", "targets.update"]
        self.assertEqual(self.events, expected)
        self.assertEqual(result["targets"], ["新服务群"])
        self.assertTrue(result["paused"])
        self.assertEqual(result["service"], "inactive")
        self.assertNotIn("service.start", self.events)
        updated = self.load_fixture()
        self.assertEqual(updated["behavior"]["group_contacts"], ["新服务群"])
        self.assertEqual(updated["behavior"]["allowed_contacts"], ["新服务群"])
        self.assertEqual(updated["behavior"]["no_address_contacts"], ["新服务群"])
        self.assertEqual(updated["unrelated"], self.cfg["unrelated"])
        with fixture_database(self.db_path) as con:
            self.assertEqual(dict(con.execute("SELECT name,allowed FROM allowed")),
                             {"旧服务群": 0, "旧私聊": 0, "新服务群": 1})
        folder = Path(result["backup"])
        self.assertEqual((folder / "config.before.json").read_bytes(), self.original_config)
        with fixture_database(folder / "memory.before.sqlite3") as con:
            self.assertEqual(con.execute("SELECT * FROM allowed ORDER BY name").fetchall(), old_allowed)

    def test_unverified_group_preserves_target_and_stays_paused(self):
        for missing in (True, False):
            with self.subTest(missing=missing):
                self.ui.missing = missing
                self.ui.wrong_title = not missing
                old_allowed = self.database_snapshot()["allowed"]
                with patch.object(self.manager, "backup") as backup, \
                        patch.object(self.manager, "update_target") as update:
                    with self.assertRaises(helper.ControlFailure):
                        self.manager.switch("找不到的群")
                    backup.assert_not_called()
                    update.assert_not_called()
                self.assertEqual(self.config_path.read_bytes(), self.original_config)
                self.assertEqual(self.database_snapshot()["allowed"], old_allowed)
                self.assertEqual(self.paused(), "1")
                self.assertEqual(self.service, "inactive")
                self.assertNotIn("service.start", self.events)

    def test_safe_id_collision_with_historic_group_is_rejected_before_pause(self):
        with fixture_database(self.db_path) as con:
            con.execute("INSERT INTO convs VALUES('historic','资料-群','group')")
        before = self.database_snapshot()
        with self.assertRaises(helper.ControlFailure):
            self.manager.switch("资料_群")
        self.assertEqual(self.database_snapshot(), before)
        self.assertEqual(self.config_path.read_bytes(), self.original_config)
        self.assertEqual(self.runner_calls, [])
        self.get_ui.assert_not_called()

    def test_blocked_or_special_targets_are_rejected_without_stopping(self):
        before = self.database_snapshot()
        for group in ("公众号服务群", "文件传输助手", "微信团队", "微信支付", "服务通知"):
            with self.subTest(group=group):
                with self.assertRaises(helper.ControlFailure):
                    self.manager.switch(group)
        self.assertEqual(self.database_snapshot(), before)
        self.assertEqual(self.config_path.read_bytes(), self.original_config)
        self.assertEqual(self.runner_calls, [])
        self.get_ui.assert_not_called()

    def test_database_commit_failure_restores_exact_config_and_authorization(self):
        before = self.database_snapshot()
        failed = sqlite3.connect(self.db_path, factory=CommitFailure)
        with patch.object(self.manager, "database", return_value=failed):
            with self.assertRaises(sqlite3.OperationalError):
                self.manager.update_target(copy.deepcopy(self.cfg), "新服务群")
        self.assertEqual(self.config_path.read_bytes(), self.original_config)
        self.assertEqual(self.database_snapshot(), before)
        self.assertEqual(self.runner_calls, [])

    def test_config_write_failure_rolls_back_database_authorization(self):
        before = self.database_snapshot()
        with patch.object(helper, "atomic_write", side_effect=OSError("synthetic write failure")):
            with self.assertRaises(OSError):
                self.manager.update_target(copy.deepcopy(self.cfg), "新服务群")
        self.assertEqual(self.config_path.read_bytes(), self.original_config)
        self.assertEqual(self.database_snapshot(), before)

    def test_worker_that_does_not_stop_cannot_open_or_update_a_group(self):
        old_allowed = self.database_snapshot()["allowed"]
        with patch.object(self.manager, "service_state", return_value="deactivating"):
            with self.assertRaises(helper.ControlFailure):
                self.manager.switch("新服务群")
        self.get_ui.assert_not_called()
        self.assertEqual(self.config_path.read_bytes(), self.original_config)
        self.assertEqual(self.database_snapshot()["allowed"], old_allowed)
        self.assertEqual(self.paused(), "1")

    def test_resume_is_idempotent_when_unpaused_and_already_active(self):
        before = self.database_snapshot()
        with patch.object(self.manager, "status", return_value={"paused": False}) as status:
            result = self.manager.resume()
        status.assert_called_once_with()
        self.get_ui.assert_not_called()
        self.assertFalse(result["paused"])
        self.assertEqual(self.database_snapshot(), before)
        self.assertEqual(self.events, [])
        self.assertTrue(all("is-active" in cmd for cmd in self.runner_calls))

    def test_resume_validates_and_starts_while_still_paused_then_unpauses(self):
        self.prepare_paused_single_target()
        real_pause = self.manager.set_paused
        real_runner = self.manager.runner

        def pause(cfg, value):
            self.events.append("pause.persist." + str(int(value)))
            return real_pause(cfg, value)

        def runner(argv, **kwargs):
            if "start" in argv:
                self.assertEqual(self.paused(), "1")
                self.assertEqual(self.ui.title, "旧服务群")
            return real_runner(argv, **kwargs)

        with patch.object(self.manager, "set_paused", side_effect=pause), \
                patch.object(self.manager, "runner", side_effect=runner):
            result = self.manager.resume()
        self.assertEqual(self.events, ["pause.persist.1", "service.stop", "ui.open", "ui.title",
                                       "ui.verify", "service.start", "pause.persist.0"])
        self.assertEqual(self.paused(), "0")
        self.assertFalse(result["paused"])
        self.assertEqual(result["service"], "active")
        self.assertEqual(result["targets"], ["旧服务群"])
        self.assertEqual(self.config_path.read_bytes(), self.original_config)

    def test_resume_with_missing_or_wrong_group_never_starts(self):
        for missing in (True, False):
            with self.subTest(missing=missing):
                self.prepare_paused_single_target()
                self.ui.missing = missing
                self.ui.wrong_title = not missing
                self.events.clear()
                with self.assertRaises(helper.ControlFailure):
                    self.manager.resume()
                self.assertEqual(self.paused(), "1")
                self.assertEqual(self.service, "inactive")
                self.assertNotIn("service.start", self.events)
                self.assertEqual(self.config_path.read_bytes(), self.original_config)

    def test_resume_start_failure_keeps_persistent_pause(self):
        self.prepare_paused_single_target()
        real_runner = self.manager.runner

        def runner(argv, **kwargs):
            if "start" in argv:
                self.events.append("service.start.failed")
                self.assertEqual(self.paused(), "1")
                return subprocess.CompletedProcess(argv, 1, b"", b"synthetic start failure")
            return real_runner(argv, **kwargs)

        with patch.object(self.manager, "runner", side_effect=runner):
            with self.assertRaises(helper.ControlFailure):
                self.manager.resume()
        self.assertEqual(self.paused(), "1")
        self.assertEqual(self.service, "inactive")
        self.assertIn("service.start.failed", self.events)
        self.assertEqual(self.config_path.read_bytes(), self.original_config)

    def test_resume_rejects_multiple_authorized_targets_without_ui_or_mutation(self):
        self.service = "inactive"
        before = self.database_snapshot()
        with self.assertRaises(helper.ControlFailure):
            self.manager.resume()
        self.get_ui.assert_not_called()
        self.assertEqual(self.database_snapshot(), before)
        self.assertEqual(self.events, [])
        self.assertTrue(all("is-active" in cmd for cmd in self.runner_calls))

    def test_status_excludes_message_content_and_credentials_and_cannot_mutate_service(self):
        config = self.load_fixture()
        config["ai"] = {"api_key": "synthetic-test-secret"}
        self.config_path.write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")
        with fixture_database(self.db_path) as con:
            con.execute("INSERT INTO kv VALUES(?,?,'before')",
                        ("last_pending_reply:旧服务群", "synthetic-private-body"))
            con.execute("INSERT INTO kv VALUES(?,?,'before')",
                        ("admin_deliveries:旧服务群", '[{"id":"test-job","text":"synthetic-private-job"}]'))
        before = self.database_snapshot()
        result = self.manager.execute({"action": "status"})
        encoded = json.dumps(result)
        self.assertNotIn("synthetic-test-secret", encoded)
        self.assertNotIn("synthetic-private-body", encoded)
        self.assertNotIn("synthetic-private-job", encoded)
        self.assertEqual(result["queue"]["admin_pending"], 1)
        self.assertEqual(self.database_snapshot(), before)
        self.assertEqual(self.events, ["ui.title"])
        self.assertTrue(all("is-active" in cmd for cmd in self.runner_calls))


if __name__ == "__main__":
    unittest.main()
