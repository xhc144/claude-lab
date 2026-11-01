"""Exercise the real Qt window with an isolated, asynchronous controller."""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtCore import QCoreApplication
from PySide6.QtWidgets import QApplication

PROJECT = Path(__file__).resolve().parents[1]
if str(PROJECT) not in sys.path:
    sys.path.insert(0, str(PROJECT))

import app as desktop
from controller import ControlError


class WindowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.qt = QApplication.instance() or QApplication(["ui-tests"])
        cls.qt.setQuitOnLastWindowClosed(False)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="wx-control-ui-tests-")
        self.addCleanup(self.temporary.cleanup)
        self.settings = Path(self.temporary.name) / "settings.json"
        self.settings_patch = patch.object(desktop, "settings_path", return_value=self.settings)
        self.settings_patch.start()
        self.addCleanup(self.settings_patch.stop)
        self.calls = []
        self.request_threads = []
        self.release = threading.Event()
        self.release.set()
        self.started = threading.Event()
        self.error = None
        self.data = {
            "service": "active", "wechat_service": "active", "paused": False,
            "targets": ["原服务群"], "persona": "测试助手", "title": "原服务群",
            "queue": {"pending": 2, "admin_pending": 1}, "dry_run": False,
        }
        test = self

        class FakeController:
            def __init__(self, host="tencent-ubuntu"):
                self.host = host

            def request(self, action, **kwargs):
                test.calls.append((self.host, action, dict(kwargs)))
                test.request_threads.append(threading.get_ident())
                test.started.set()
                if not test.release.wait(4):
                    raise ControlError("synthetic test blocker timed out")
                if test.error is not None:
                    raise test.error
                data = copy.deepcopy(test.data)
                if action in ("pause", "switch"):
                    data.update(service="inactive", paused=True)
                elif action == "resume":
                    data.update(service="active", paused=False)
                if action == "switch":
                    data.update(targets=[kwargs["group"]], title=kwargs["group"])
                return data

        self.controller_patch = patch("controller.Controller", FakeController)
        self.controller_patch.start()
        self.addCleanup(self.controller_patch.stop)
        self.window = desktop.App(connect=False)
        self.window.show()
        self.addCleanup(self.cleanup_window)
        self.window.perform("status")
        self.wait_until(lambda: not self.window.busy)
        self.calls.clear()
        self.request_threads.clear()
        self.started.clear()

    def cleanup_window(self):
        self.release.set()
        self.window.pool.waitForDone(5000)
        for _ in range(3):
            self.qt.processEvents()
        self.window.close()
        self.window.deleteLater()
        QCoreApplication.sendPostedEvents()
        self.qt.processEvents()

    def wait_until(self, predicate, timeout=4):
        deadline = time.monotonic() + timeout
        while not predicate():
            if time.monotonic() >= deadline:
                self.fail("Qt operation did not complete before test deadline")
            self.qt.processEvents()
            time.sleep(0.005)
        self.qt.processEvents()

    def test_worker_results_are_applied_on_the_gui_thread(self):
        applied_threads = []
        original = self.window._apply_status

        def apply(data):
            applied_threads.append(threading.get_ident())
            original(data)

        with patch.object(self.window, "_apply_status", side_effect=apply):
            self.window.refresh_button.click()
            self.wait_until(lambda: not self.window.busy)
        self.assertEqual(applied_threads, [threading.get_ident()])
        self.assertEqual(len(self.request_threads), 1)
        self.assertNotEqual(self.request_threads[0], threading.get_ident())
        self.assertEqual(self.window.target_label.text(), "原服务群")
        self.assertEqual(self.window.stat_values["pending"].text(), "2")

    def test_action_buttons_dispatch_pause_resume_and_switch_and_save_history(self):
        self.window.pause_button.click()
        self.wait_until(lambda: not self.window.busy)
        self.assertTrue(self.window.status_data["paused"])
        self.window.resume_button.click()
        self.wait_until(lambda: not self.window.busy)
        self.assertFalse(self.window.status_data["paused"])
        self.window.group_input.setEditText("另一个服务群")
        self.window.switch_button.click()
        self.wait_until(lambda: not self.window.busy)
        self.assertEqual([action for _, action, _ in self.calls], ["pause", "resume", "switch"])
        self.assertEqual(self.calls[-1][2], {"group": "另一个服务群"})
        self.assertEqual(self.window.target_label.text(), "另一个服务群")
        self.assertTrue(self.window.status_data["paused"])
        saved = json.loads(self.settings.read_text(encoding="utf-8"))
        self.assertEqual(saved["recent_groups"][0], "另一个服务群")
        self.assertEqual(saved["host"], "tencent-ubuntu")

    def test_busy_window_rejects_concurrent_requests_and_close(self):
        self.release.clear()
        self.window.pause_button.click()
        self.wait_until(self.started.is_set)
        self.assertTrue(self.window.busy)
        for control in (self.window.pause_button, self.window.resume_button,
                        self.window.switch_button, self.window.refresh_button,
                        self.window.host_input, self.window.save_host_button):
            self.assertFalse(control.isEnabled())
        self.window.perform("resume")
        self.window.refresh_button.click()
        self.assertFalse(self.window.close())
        self.assertTrue(self.window.isVisible())
        self.assertEqual(len(self.calls), 1)
        self.release.set()
        self.wait_until(lambda: not self.window.busy)
        self.assertTrue(self.window.close())

    def test_failed_mutation_requires_successful_refresh_before_more_actions(self):
        self.error = ControlError("synthetic interrupted operation")
        self.window.pause_button.click()
        self.wait_until(lambda: not self.window.busy)
        self.assertTrue(self.window.needs_refresh)
        for button in (self.window.pause_button, self.window.resume_button, self.window.switch_button):
            self.assertFalse(button.isEnabled())
        self.assertTrue(self.window.refresh_button.isEnabled())
        self.window.perform("resume")
        self.assertEqual(len(self.calls), 1)
        self.error = None
        self.window.refresh_button.click()
        self.wait_until(lambda: not self.window.busy)
        self.assertFalse(self.window.needs_refresh)
        self.assertTrue(self.window.pause_button.isEnabled())
        self.assertEqual([action for _, action, _ in self.calls], ["pause", "status"])

    def test_saving_another_host_reads_status_before_allowing_mutation(self):
        self.release.clear()
        self.window.host_input.setText("isolated-test-server")
        self.window.save_host_button.click()
        self.wait_until(self.started.is_set)
        self.assertEqual(self.window.host, "isolated-test-server")
        self.assertTrue(self.window.needs_refresh)
        self.assertTrue(self.window.busy)
        self.assertFalse(self.window.switch_button.isEnabled())
        self.window.perform("pause")
        self.assertEqual(self.calls, [("isolated-test-server", "status", {})])
        self.release.set()
        self.wait_until(lambda: not self.window.busy)
        self.assertFalse(self.window.needs_refresh)
        saved = json.loads(self.settings.read_text(encoding="utf-8"))
        self.assertEqual(saved["host"], "isolated-test-server")

    def test_empty_group_never_reaches_controller(self):
        self.window.group_input.setEditText("  ")
        self.window.switch_button.click()
        self.qt.processEvents()
        self.assertFalse(self.window.busy)
        self.assertEqual(self.calls, [])

    def test_saved_host_and_group_history_are_loaded_in_new_window(self):
        self.settings.write_text(json.dumps({"host": "saved-test-server",
                                             "recent_groups": ["最近群", "另一个群"]},
                                            ensure_ascii=False), encoding="utf-8")
        other = desktop.App(connect=False)
        try:
            self.assertEqual(other.host, "saved-test-server")
            self.assertEqual(other.host_input.text(), "saved-test-server")
            self.assertEqual(other.recent_groups, ["最近群", "另一个群"])
            self.assertTrue(other.needs_refresh)
            self.assertFalse(other.switch_button.isEnabled())
            self.assertFalse(other.resume_button.isEnabled())
        finally:
            other.close()
            other.deleteLater()
            self.qt.processEvents()


if __name__ == "__main__":
    unittest.main()
