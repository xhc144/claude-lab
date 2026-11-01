"""Claude 桌面版账号切换器：中文窗口和命令行入口。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import threading

from account_manager import ManagerError
from desktop_service import DesktopService
from profile_switcher import ProfileSwitcherError


def run_gui(service: DesktopService) -> None:
    import tkinter as tk
    from tkinter import filedialog, messagebox, simpledialog, ttk

    window = tk.Tk()
    window.title("Claude 桌面版账号切换器")
    window.geometry("710x490")
    window.minsize(660, 450)
    window.configure(background="#f5f3ee")
    style = ttk.Style(window)
    if "vista" in style.theme_names():
        style.theme_use("vista")
    style.configure("Treeview", rowheight=34, font=("Microsoft YaHei UI", 10))
    style.configure("Treeview.Heading", font=("Microsoft YaHei UI", 10))
    panel = ttk.Frame(window, padding=22)
    panel.pack(fill="both", expand=True)
    ttk.Label(panel, text="Claude 桌面版 · 多账号", font=("Microsoft YaHei UI", 18, "bold")).pack(anchor="w")
    ttk.Label(panel, text="每个账号首次登录一次，之后保存并切换完整登录状态。",
              font=("Microsoft YaHei UI", 10)).pack(anchor="w", pady=(8, 16))
    info = tk.StringVar(value="正在检查安装和账号目录…")
    ttk.Label(panel, textvariable=info, wraplength=650).pack(anchor="w", pady=(0, 10))
    table = ttk.Treeview(panel, columns=("name", "state"), show="headings", selectmode="browse", height=6)
    table.heading("name", text="账号名称")
    table.heading("state", text="状态")
    table.column("name", width=390)
    table.column("state", width=175)
    table.pack(fill="both", expand=True)
    controls = ttk.Frame(panel)
    controls.pack(fill="x", pady=(16, 10))
    status = tk.StringVar(value="")
    ttk.Label(panel, text="切到其他账号前，请右键 Claude 托盘图标选择 Exit／退出；只关窗口不够。",
              wraplength=650).pack(anchor="w", pady=(2, 6))
    ttk.Label(panel, textvariable=status, wraplength=650).pack(anchor="w")
    buttons = []
    state = {"busy": False, "initialized": False, "report": None}

    def busy(value: bool) -> None:
        state["busy"] = value
        for button in buttons:
            button.configure(state="disabled" if value else "normal")

    def show_report(report: dict) -> None:
        selected = table.selection()
        keep = selected[0] if selected else None
        table.delete(*table.get_children())
        state["initialized"] = report["initialized"]
        state["report"] = report
        version = report["app"]["version"]
        if report["initialized"]:
            info.set(f"已找到官方 Claude {version}。选择账号后点击“切换并打开”。")
            for profile in report["profiles"]:
                table.insert("", "end", iid=profile["id"], values=(profile["label"], "当前账号" if profile["active"] else "已保存"))
            if report.get("pending_transaction"):
                status.set("上一次切换未完成。请完全退出 Claude，然后点击“恢复上次操作”。")
            elif not state["busy"]:
                status.set("登录授权失效时，仍需在官方窗口重新认证。")
        else:
            info.set(f"已找到官方 Claude {version}。首次使用请先完全退出 Claude，再保留原有账号。")
            status.set("初始化只登记当前目录；新增账号会使用全新的桌面配置。")
        if keep and table.exists(keep):
            table.selection_set(keep)
        elif table.get_children():
            table.selection_set(table.get_children()[0])

    def work(action, success=None, refresh_error=False) -> None:
        if state["busy"]:
            return
        busy(True)
        status.set("正在处理，请稍候…")

        def completed(result=None, error=None):
            busy(False)
            if error:
                status.set("操作停止；请阅读提示后重试。")
                messagebox.showerror("未完成操作", str(error), parent=window)
                if refresh_error:
                    window.after(50, refresh)
            elif success:
                success(result)

        def worker():
            try:
                result = action()
            except Exception as error:
                window.after(0, lambda error=error: completed(error=error))
            else:
                window.after(0, lambda result=result: completed(result=result))

        threading.Thread(target=worker, daemon=True).start()

    def refresh():
        work(service.inspect, show_report)

    def initialize():
        if state["initialized"]:
            messagebox.showinfo("已经初始化", "原有账号已保留，可以新增账号。", parent=window)
            return
        report = state["report"] or {}
        options = report.get("candidates", [])
        chosen = options[0] if len(options) == 1 else filedialog.askdirectory(title="选择 Claude 桌面版的数据目录", parent=window)
        if not chosen:
            return
        work(lambda: service.initialize(Path(chosen)), show_report, refresh_error=True)

    def add():
        if not state["initialized"]:
            messagebox.showinfo("先保留原有账号", "请先点击“保留原有账号”。", parent=window)
            return
        label = simpledialog.askstring("新增账号", "给新账号起个名字，例如：工作、个人、账号 B。", parent=window)
        if not label:
            return

        def added(profile):
            refresh()
            messagebox.showinfo("账号已添加", f"“{profile['label']}”已建立。\n完全退出 Claude 后，选择它并点击“切换并打开”，然后完成首次登录。", parent=window)

        work(lambda: service.add_profile(label), added, refresh_error=True)

    def open_selected():
        selection = table.selection()
        if not selection:
            messagebox.showinfo("请选择账号", "先保留原有账号，再从列表选择账号。", parent=window)
            return

        def opened(result):
            refresh()
            status.set(f"已请求打开“{result['label']}”。首次使用这个账号时，请在 Claude 中完成登录。")

        work(lambda: service.open_profile(selection[0]), opened, refresh_error=True)

    def recover():
        work(lambda: (service.recover(), service.inspect())[1], show_report, refresh_error=True)

    for label, callback in [("保留原有账号", initialize), ("新增账号", add), ("切换并打开", open_selected),
                            ("刷新", refresh), ("恢复上次操作", recover)]:
        button = ttk.Button(controls, text=label, command=callback)
        button.pack(side="left", padx=(0, 8))
        buttons.append(button)
    table.bind("<Double-1>", lambda event: open_selected())

    def close():
        if state["busy"]:
            messagebox.showinfo("正在处理", "当前操作完成后再关闭窗口。", parent=window)
        else:
            window.destroy()

    window.protocol("WM_DELETE_WINDOW", close)
    window.after(150, refresh)
    window.mainloop()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Windows Claude 桌面版账号切换器")
    parser.add_argument("--base-dir", type=Path)
    commands = parser.add_subparsers(dest="command")
    commands.add_parser("gui")
    commands.add_parser("doctor")
    initialize = commands.add_parser("init")
    initialize.add_argument("--live-dir", type=Path)
    add = commands.add_parser("add")
    add.add_argument("label")
    launch = commands.add_parser("open")
    launch.add_argument("id")
    commands.add_parser("list")
    commands.add_parser("recover")
    args = parser.parse_args(argv)
    service = DesktopService(args.base_dir)
    try:
        if args.command in (None, "gui"):
            run_gui(service)
            return 0
        if args.command == "init":
            result = service.initialize(args.live_dir)
        elif args.command == "add":
            result = service.add_profile(args.label)
        elif args.command == "open":
            result = service.open_profile(args.id)
        elif args.command == "recover":
            result = service.recover()
        else:
            result = service.inspect()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ManagerError, ProfileSwitcherError, OSError) as error:
        print(f"错误：{error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
