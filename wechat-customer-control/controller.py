"""Transport for the desktop app: fixed SSH command, JSON through stdin."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys


class ControlError(RuntimeError):
    pass


class Controller:
    def __init__(self, host: str = "tencent-ubuntu"):
        if not isinstance(host, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", host):
            raise ControlError("SSH 别名只允许字母、数字、点、横线和下划线。")
        self.host = host

    def request(self, action: str, **kwargs) -> dict:
        if not isinstance(action, str) or action not in {"status", "pause", "resume", "switch"}:
            raise ControlError("不支持的控制操作。")
        if kwargs.keys() - {"group"} or (action != "switch" and kwargs):
            raise ControlError("控制参数不正确。")
        if action == "switch":
            from remote_helper import validate_group, ControlFailure
            try:
                kwargs["group"] = validate_group(kwargs.get("group"))
            except ControlFailure as exc:
                raise ControlError(str(exc)) from None
        ssh = shutil.which("ssh")
        if not ssh:
            raise ControlError("未找到 Windows OpenSSH 客户端，请安装系统可选功能 OpenSSH 客户端。")
        resources = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
        source = (resources / "remote_helper.py").read_text(encoding="utf-8")
        bootstrap = (
            'import json,sys; p=json.load(sys.stdin); n={"__name__":"wx_control_remote"}; '
            'exec(compile(p["source"],"wx_control_remote","exec"),n); n["main"](p["request"])'
        )
        remote = shlex.join(["/home/ubuntu/wx-ai-assistant/venv/bin/python", "-c", bootstrap])
        command = [ssh, "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=12",
                   "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2",
                   "-o", "LogLevel=ERROR", self.host, remote]
        payload = json.dumps({"source": source, "request": {"action": action, **kwargs}}, ensure_ascii=False)
        try:
            proc = subprocess.run(command, input=payload.encode("utf-8"), capture_output=True,
                                  timeout=150, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except subprocess.TimeoutExpired:
            raise ControlError("服务器操作超时。切群或暂停可能已生效，请先刷新状态再操作。") from None
        except OSError:
            raise ControlError("无法启动 SSH，请检查系统 OpenSSH 客户端。") from None
        if proc.returncode:
            detail = proc.stderr.decode("utf-8", "replace").lower()
            if "permission denied" in detail:
                message = "SSH 密钥认证失败。请先用终端确认 ssh tencent-ubuntu 能免密登录。"
            elif "host key verification failed" in detail:
                message = "服务器主机密钥校验失败，请先在终端检查 SSH 连接。"
            else:
                message = "SSH 连接中断或服务器命令未完成，请检查网络后刷新状态。"
            raise ControlError(message)
        try:
            result = json.loads(proc.stdout.decode("utf-8"))
        except (UnicodeError, ValueError):
            raise ControlError("服务器返回格式异常。操作可能已生效，请先刷新状态。") from None
        if not isinstance(result, dict) or not isinstance(result.get("ok"), bool):
            raise ControlError("服务器返回格式异常，请先刷新状态。")
        if not result["ok"]:
            raise ControlError(str(result.get("error") or "服务器操作失败。"))
        if not isinstance(result.get("data"), dict):
            raise ControlError("服务器状态格式异常。")
        return result["data"]
