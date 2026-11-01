import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from controller import Controller, ControlError


class TransportTests(unittest.TestCase):
    def test_host_options_and_shell_characters_rejected(self):
        for host in ("-oProxyCommand=x", "host;id", "host name", "", None):
            with self.subTest(host=host), self.assertRaises(ControlError):
                Controller(host)

    def test_unknown_actions_and_parameters_never_launch_ssh(self):
        with patch("controller.subprocess.run") as run:
            for action in ("say", None, [], {}):
                with self.subTest(action=action), self.assertRaises(ControlError):
                    Controller().request(action)
            with self.assertRaises(ControlError):
                Controller().request("status", group="another")
            with self.assertRaises(ControlError):
                Controller().request("switch", group="bad\nname")
            run.assert_not_called()

    def test_group_is_only_in_utf8_stdin_and_never_command(self):
        name = "测试群'; $(touch should-never-exist) `id`"
        output = {"ok": True, "data": {"targets": [name], "paused": True}}
        process = subprocess.CompletedProcess([], 0, json.dumps(output).encode(), b"")
        with patch("controller.shutil.which", return_value="ssh.exe"), patch(
                "controller.subprocess.run", return_value=process) as run:
            result = Controller().request("switch", group=name)
        args, options = run.call_args
        self.assertNotIn(name, " ".join(args[0]))
        packet = json.loads(options["input"].decode("utf-8"))
        self.assertEqual(packet["request"], {"action": "switch", "group": name})
        self.assertIn("class Manager", packet["source"])
        self.assertTrue(result["paused"])

    def test_helper_errors_are_presented_to_user(self):
        process = subprocess.CompletedProcess([], 0, b'{"ok":false,"error":"paused safely"}', b"")
        with patch("controller.shutil.which", return_value="ssh.exe"), patch(
                "controller.subprocess.run", return_value=process):
            with self.assertRaisesRegex(ControlError, "paused safely"):
                Controller().request("status")

    def test_timeout_requires_refresh_instead_of_claiming_failure(self):
        with patch("controller.shutil.which", return_value="ssh.exe"), patch(
                "controller.subprocess.run", side_effect=subprocess.TimeoutExpired("ssh", 150)):
            with self.assertRaisesRegex(ControlError, "刷新状态"):
                Controller().request("switch", group="test")


if __name__ == "__main__":
    unittest.main()
