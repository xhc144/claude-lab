"""Modern native workspace for the WeChat assistant on tencent-ubuntu."""
from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import sys

from PySide6.QtCore import QObject, QRunnable, QThreadPool, QTimer, Qt, Signal, Slot, QSize, QRectF
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import (
    QApplication, QComboBox, QFrame, QHBoxLayout, QLabel, QLineEdit, QMainWindow,
    QPushButton, QScrollArea, QSizePolicy, QStackedWidget, QVBoxLayout, QWidget,
)


APP_TITLE = "微信客服"
DEFAULT_HOST = "tencent-ubuntu"
GREEN = "#07A86C"
RESOURCES = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def settings_path() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    return base / "WeChatCustomerControl" / "settings.json"


def load_settings() -> dict:
    try:
        value = json.loads(settings_path().read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            return {}
        groups = value.get("recent_groups", [])
        return {
            "host": value.get("host") if isinstance(value.get("host"), str) else DEFAULT_HOST,
            "recent_groups": [g for g in groups if isinstance(g, str) and g.strip()][:12]
            if isinstance(groups, list) else [],
        }
    except (OSError, ValueError, TypeError):
        return {}


def icon(name: str, color: str = "#6E827A", size: int = 20) -> QIcon:
    paths = {
        "grid": '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
        "chat": '<path d="M21 11.5a8.3 8.3 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.3 8.3 0 0 1-3.8-.9L3 21l1.9-5.7a8.3 8.3 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.3 8.3 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/><path d="M8 11h8M8 15h5"/>',
        "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        "settings": '<path d="m12 3 2 3 3 .5 1 3 3 2-1 3-3 1-1 3-4 2-3-2-3-.5-1-3-2-2 1-3 3-1 1-3 3-2z"/><circle cx="12" cy="12" r="3"/>',
        "refresh": '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 18 17"/>',
        "pause": '<path d="M9 5v14M15 5v14"/>',
        "play": '<path d="m8 5 11 7-11 7z"/>',
        "arrow": '<path d="M4 12h16m-6-6 6 6-6 6"/>',
        "check": '<path d="m5 12 4 4L19 6"/>',
        "inbox": '<path d="M4 4h16v16H4zM4 14h5l2 3h2l2-3h5M8 8h8"/>',
        "send": '<path d="m22 2-7 20-4-9-9-4L22 2zM22 2 11 13"/>',
        "cloud": '<path d="M7 18a5 5 0 0 1-.6-10 6 6 0 0 1 11.4-1A5.5 5.5 0 0 1 18 18H7z"/>',
        "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
    }
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
           f'<g fill="none" stroke="{color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
           + paths.get(name, paths["chat"]) + '</g></svg>')
    renderer = QSvgRenderer(svg.encode("utf-8"))
    result = QIcon()
    for ratio in (1, 2, 3):
        pixmap = QPixmap(size * ratio, size * ratio)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        renderer.render(painter, QRectF(0, 0, size * ratio, size * ratio))
        painter.end()
        pixmap.setDevicePixelRatio(ratio)
        result.addPixmap(pixmap)
    return result


def label(text: str, name: str = "", *, wrap: bool = False) -> QLabel:
    result = QLabel(text)
    if name:
        result.setObjectName(name)
    result.setWordWrap(wrap)
    return result


def card() -> QFrame:
    result = QFrame()
    result.setObjectName("Card")
    return result


def clear_layout(layout) -> None:
    while layout.count():
        item = layout.takeAt(0)
        if item.widget():
            item.widget().deleteLater()
        elif item.layout():
            clear_layout(item.layout())


STYLES = """
QWidget { font-family: 'Segoe UI', 'Microsoft YaHei UI'; font-size: 13px; color: #20362E; }
QMainWindow, QWidget#Workspace, QWidget#ScrollPage { background: #F7F9FB; }
QFrame#Sidebar { background: #102E27; border: none; }
QLabel { background: transparent; border: none; }
QLabel#BrandTitle { color: #FFFFFF; font-size: 19px; font-weight: 700; }
QLabel#BrandSub { color: #86A59A; font-size: 11px; }
QLabel#NavSection { color: #648A7C; font-size: 10px; font-weight: 600; letter-spacing: 1px; }
QPushButton#Nav { background: transparent; color: #ABC0B7; border: none; border-radius: 10px; text-align: left; padding: 0 14px; font-size: 13px; }
QPushButton#Nav:hover { background: #1A3F33; color: #FFFFFF; }
QPushButton#Nav:checked { background: #1B4A39; color: #E2FFEF; font-weight: 600; }
QFrame#SidebarConnection { background: #17392E; border: 1px solid #244A3C; border-radius: 12px; }
QLabel#SidebarStatus { color: #D8EEE3; font-size: 11px; font-weight: 600; }
QLabel#SidebarHost { color: #7FA291; font-size: 10px; }
QLabel#SidebarFooter { color: #608674; font-size: 10px; }
QLabel#PageTitle { color: #163329; font-size: 25px; font-weight: 700; }
QLabel#Subtitle { color: #85938D; font-size: 11px; }
QLabel#SectionTitle { color: #294236; font-size: 15px; font-weight: 600; }
QLabel#Eyebrow { color: #89978E; font-size: 11px; }
QLabel#GroupName { color: #163B2B; font-size: 34px; font-weight: 700; }
QLabel#HeroSubtitle { color: #8A988F; font-size: 11px; }
QLabel#Hint { color: #93A198; font-size: 10px; }
QLabel#FieldLabel { color: #486250; font-size: 12px; font-weight: 600; }
QLabel#StatTitle { color: #8B9C90; font-size: 11px; }
QLabel#StatValue { color: #294E39; font-size: 19px; font-weight: 600; }
QLabel#ActivityText { color: #617368; font-size: 11px; }
QLabel#ActivityTime { color: #A2AEA5; font-size: 10px; }
QLabel#RecentName { color: #264A35; font-size: 17px; font-weight: 600; }
QLabel#EmptyTitle { color: #456451; font-size: 16px; font-weight: 600; }
QLabel#Feedback { color: #8B9C90; font-size: 10px; }
QFrame#Card { background: #FFFFFF; border: 1px solid #E7EDE9; border-radius: 16px; }
QFrame#Separator { border: none; background: #EEF2EF; min-height: 1px; max-height: 1px; }
QPushButton { background: #FFFFFF; color: #536D5C; border: 1px solid #DFE8E1; border-radius: 9px; min-height: 36px; padding: 0 14px; font-size: 11px; font-weight: 600; }
QPushButton:hover { background: #F2F8F4; border-color: #B9D6C2; }
QPushButton:pressed { background: #E9F3EC; }
QPushButton:disabled { color: #B6C2BA; background: #F6F8F6; border-color: #ECF0ED; }
QPushButton#Primary { color: #FFFFFF; background: #07A86C; border-color: #07A86C; }
QPushButton#Primary:hover { background: #07955F; border-color: #07955F; }
QPushButton#Primary:pressed { background: #078152; }
QPushButton#Primary:disabled { color: #EDF8F0; background: #AEDBC4; border-color: #AEDBC4; }
QPushButton#Refresh { background: #FFFFFF; border-color: #E4EBE6; color: #6B8071; padding: 0 13px; }
QComboBox, QLineEdit { background: #FAFCFA; border: 1px solid #E0E9E2; border-radius: 10px; padding: 0 13px; min-height: 40px; color: #315841; font-size: 12px; selection-background-color: #D9F1E2; }
QComboBox:focus, QLineEdit:focus { background: #FFFFFF; border-color: #07A86C; }
QComboBox:disabled, QLineEdit:disabled { color: #ABB9AE; background: #F3F6F3; }
QComboBox QLineEdit { border: none; border-radius: 0; padding: 0; background: transparent; min-height: 0; }
QComboBox::drop-down { width: 28px; border: none; background: transparent; }
QComboBox QAbstractItemView { background: #FFFFFF; color: #315841; selection-background-color: #E6F6EC; border: 1px solid #E0E9E2; padding: 6px; outline: none; }
QScrollArea { border: none; background: transparent; }
QScrollArea > QWidget > QWidget { background: #F7F9FB; }
QScrollBar:vertical { background: transparent; width: 6px; margin: 0; }
QScrollBar::handle:vertical { background: #D8E4DC; border-radius: 3px; min-height: 30px; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: transparent; }
QToolTip { color: #315841; background: #FFFFFF; border: 1px solid #D8E5DC; padding: 7px; }
"""


class WorkerSignals(QObject):
    finished = Signal(dict)


class RequestWorker(QRunnable):
    def __init__(self, action: str, host: str, group: str):
        super().__init__()
        self.action, self.host, self.group = action, host, group
        self.signals = WorkerSignals()

    @Slot()
    def run(self):
        result = {"action": self.action, "host": self.host, "group": self.group}
        try:
            from controller import Controller, ControlError

            data = Controller(host=self.host).request(self.action, **({"group": self.group} if self.action == "switch" else {}))
            if not isinstance(data, dict):
                raise ControlError("服务器返回了无法识别的状态。")
            result.update(ok=True, data=data)
        except Exception as error:
            result.update(ok=False, error=str(error) or type(error).__name__)
        self.signals.finished.emit(result)


class App(QMainWindow):
    request_completed = Signal(bool)

    def __init__(self, *, connect: bool = True):
        super().__init__()
        self.saved = load_settings()
        self.host = self.saved.get("host") or DEFAULT_HOST
        self.recent_groups = self.saved.get("recent_groups", [])
        self.status_data: dict = {}
        self.busy = False
        self.needs_refresh = True
        self.connected = False
        self.activity: list[dict] = []
        self.recent_buttons: list[QPushButton] = []
        self.pool = QThreadPool(self)
        self.pool.setMaxThreadCount(1)
        self._worker = None
        self._build()
        self._update_actions()
        if connect:
            QTimer.singleShot(100, lambda: self.perform("status"))

    def _build(self):
        self.setWindowTitle(APP_TITLE + " · 群聊工作台")
        asset_icon = RESOURCES / "assets" / "app.svg"
        self.setWindowIcon(QIcon(str(asset_icon)) if asset_icon.exists() else icon("chat", GREEN, 32))
        available = QApplication.primaryScreen().availableGeometry()
        self.resize(min(1120, available.width() - 48), min(700, available.height() - 60))
        self.setMinimumSize(min(960, available.width() - 48), min(600, available.height() - 60))
        self.move(available.x() + (available.width() - self.width()) // 2,
                  available.y() + max(8, (available.height() - self.height() - 30) // 2))
        self.setStyleSheet(STYLES)
        workspace = QWidget()
        workspace.setObjectName("Workspace")
        self.setCentralWidget(workspace)
        shell = QHBoxLayout(workspace)
        shell.setContentsMargins(0, 0, 0, 0)
        shell.setSpacing(0)

        sidebar = QFrame()
        sidebar.setObjectName("Sidebar")
        sidebar.setFixedWidth(200)
        side = QVBoxLayout(sidebar)
        side.setContentsMargins(18, 28, 18, 19)
        side.setSpacing(8)
        brand = QHBoxLayout()
        brand.setSpacing(10)
        brand_icon = QLabel()
        brand_icon.setPixmap(self.windowIcon().pixmap(QSize(38, 38)))
        brand.addWidget(brand_icon)
        brand_words = QVBoxLayout()
        brand_words.setSpacing(2)
        brand_words.addWidget(label("微信客服", "BrandTitle"))
        brand_words.addWidget(label("你的群聊工作区", "BrandSub"))
        brand.addLayout(brand_words)
        brand.addStretch()
        side.addLayout(brand)
        side.addSpacing(39)
        side.addWidget(label("工作区", "NavSection"))
        side.addSpacing(6)
        self.nav_buttons = []
        for index, (text, glyph) in enumerate((("概览", "grid"), ("最近群聊", "clock"), ("连接设置", "settings"))):
            button = QPushButton("  " + text)
            button.setObjectName("Nav")
            button.setIcon(icon(glyph, "#A5C2B2", 18))
            button.setIconSize(QSize(18, 18))
            button.setFixedHeight(43)
            button.setCheckable(True)
            button.setAutoExclusive(True)
            button.clicked.connect(lambda _checked=False, i=index: self.show_page(i))
            self.nav_buttons.append(button)
            side.addWidget(button)
        self.nav_buttons[0].setChecked(True)
        side.addStretch()
        connection = QFrame()
        connection.setObjectName("SidebarConnection")
        connection_box = QVBoxLayout(connection)
        connection_box.setContentsMargins(13, 14, 13, 14)
        connection_box.setSpacing(5)
        self.connection_label = label("●  等待连接", "SidebarStatus")
        self.connection_host = label(self.host, "SidebarHost", wrap=True)
        connection_box.addWidget(self.connection_label)
        connection_box.addWidget(self.connection_host)
        side.addWidget(connection)
        side.addSpacing(10)
        side.addWidget(label("腾讯云 · Ubuntu", "SidebarFooter"))
        shell.addWidget(sidebar)

        content = QWidget()
        content_box = QVBoxLayout(content)
        content_box.setContentsMargins(28, 25, 28, 16)
        content_box.setSpacing(10)
        self.pages = QStackedWidget()
        content_box.addWidget(self.pages, 1)
        self.feedback = label("准备连接客服服务器。", "Feedback", wrap=True)
        self.feedback.setMinimumHeight(18)
        self.feedback.setMaximumHeight(34)
        content_box.addWidget(self.feedback)
        shell.addWidget(content, 1)
        self._build_overview()
        self._build_recent()
        self._build_settings()

    def _page_header(self, title: str, subtitle: str, refresh=False):
        row = QHBoxLayout()
        row.setContentsMargins(0, 0, 0, 0)
        words = QVBoxLayout()
        words.setSpacing(6)
        words.addWidget(label(title, "PageTitle"))
        words.addWidget(label(subtitle, "Subtitle"))
        row.addLayout(words, 1)
        if refresh:
            self.refresh_button = QPushButton(" 刷新状态")
            self.refresh_button.setObjectName("Refresh")
            self.refresh_button.setIcon(icon("refresh", "#6C8575", 16))
            self.refresh_button.clicked.connect(lambda: self.perform("status"))
            row.addWidget(self.refresh_button, 0, Qt.AlignmentFlag.AlignTop)
        return row

    def _build_overview(self):
        page = QWidget()
        page_box = QVBoxLayout(page)
        page_box.setContentsMargins(0, 0, 0, 0)
        page_box.setSpacing(0)
        page_box.addLayout(self._page_header("群聊工作台", "切换服务群，管理微信客服的自动回复。", refresh=True))
        page_box.addSpacing(22)
        self.overview_scroll = QScrollArea()
        self.overview_scroll.setWidgetResizable(True)
        self.overview_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        body = QWidget()
        body.setObjectName("ScrollPage")
        body_box = QVBoxLayout(body)
        body_box.setContentsMargins(0, 0, 5, 0)
        body_box.setSpacing(16)

        hero = card()
        hero_box = QVBoxLayout(hero)
        hero_box.setContentsMargins(22, 18, 22, 18)
        hero_box.setSpacing(8)
        hero_top = QHBoxLayout()
        hero_top.addWidget(label("当前服务群", "Eyebrow"))
        hero_top.addStretch()
        self.status_pill = label("等待连接")
        self.status_pill.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.status_pill.setContentsMargins(10, 4, 10, 4)
        self._set_pill("等待连接", "neutral")
        hero_top.addWidget(self.status_pill)
        hero_box.addLayout(hero_top)
        hero_main = QHBoxLayout()
        hero_main.setSpacing(13)
        group_symbol = QLabel()
        group_symbol.setFixedSize(48, 48)
        group_symbol.setAlignment(Qt.AlignmentFlag.AlignCenter)
        group_symbol.setStyleSheet("background:#EAF8EF; border-radius:14px;")
        group_symbol.setPixmap(icon("chat", GREEN, 25).pixmap(QSize(25, 25)))
        hero_main.addWidget(group_symbol)
        self.target_label = label("等待连接", "GroupName")
        self.target_label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.target_label.setToolTip("当前客服服务的群聊")
        hero_main.addWidget(self.target_label, 1)
        self.pause_button = QPushButton(" 暂停回复")
        self.pause_button.setIcon(icon("pause", "#718A79", 15))
        self.pause_button.clicked.connect(lambda: self.perform("pause"))
        hero_main.addWidget(self.pause_button)
        self.resume_button = QPushButton(" 恢复回复")
        self.resume_button.setObjectName("Primary")
        self.resume_button.setIcon(icon("play", "#FFFFFF", 14))
        self.resume_button.clicked.connect(lambda: self.perform("resume"))
        hero_main.addWidget(self.resume_button)
        hero_box.addLayout(hero_main)
        self.hero_subtitle = label("连接后可查看服务群与运行情况。", "HeroSubtitle")
        hero_box.addWidget(self.hero_subtitle)
        body_box.addWidget(hero)

        switch = card()
        switch_box = QVBoxLayout(switch)
        switch_box.setContentsMargins(22, 17, 22, 16)
        switch_box.setSpacing(11)
        switch_box.addWidget(label("切换服务群", "SectionTitle"))
        switch_row = QHBoxLayout()
        switch_row.setSpacing(12)
        self.group_input = QComboBox()
        self.group_input.setEditable(True)
        self.group_input.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        self.group_input.addItems(self.recent_groups)
        self.group_input.setCurrentIndex(-1)
        self.group_input.lineEdit().setPlaceholderText("输入微信中的完整群名，或选择最近使用的群")
        self.group_input.lineEdit().returnPressed.connect(lambda: self.perform("switch"))
        switch_row.addWidget(self.group_input, 1)
        self.switch_button = QPushButton("切换服务群  ")
        self.switch_button.setObjectName("Primary")
        self.switch_button.setMinimumHeight(42)
        self.switch_button.setMinimumWidth(132)
        self.switch_button.setIcon(icon("arrow", "#FFFFFF", 17))
        self.switch_button.clicked.connect(lambda: self.perform("switch"))
        switch_row.addWidget(self.switch_button)
        switch_box.addLayout(switch_row)
        switch_box.addWidget(label("切换后旧群停止服务，新群先保持暂停；点击「恢复回复」开始服务。", "Hint", wrap=True))
        body_box.addWidget(switch)

        stats = QHBoxLayout()
        stats.setSpacing(12)
        self.stat_values = {}
        for key, title, glyph in (("wechat", "微信状态", "chat"), ("pending", "待回复", "inbox"), ("admin_pending", "待投递", "send")):
            item = card()
            item_box = QHBoxLayout(item)
            item_box.setContentsMargins(17, 15, 17, 15)
            item_box.setSpacing(12)
            symbol = QLabel()
            symbol.setFixedSize(34, 34)
            symbol.setAlignment(Qt.AlignmentFlag.AlignCenter)
            symbol.setStyleSheet("background:#EFF8F2; border-radius:10px;")
            symbol.setPixmap(icon(glyph, "#62A77F", 19).pixmap(QSize(19, 19)))
            item_box.addWidget(symbol)
            words = QVBoxLayout()
            words.setSpacing(4)
            words.addWidget(label(title, "StatTitle"))
            value = label("—", "StatValue")
            self.stat_values[key] = value
            words.addWidget(value)
            item_box.addLayout(words)
            item_box.addStretch()
            stats.addWidget(item, 1)
        body_box.addLayout(stats)

        activity_frame = card()
        activity_box = QVBoxLayout(activity_frame)
        activity_box.setContentsMargins(20, 15, 20, 13)
        activity_box.setSpacing(9)
        activity_header = QHBoxLayout()
        activity_header.addWidget(label("最近操作", "SectionTitle"))
        activity_header.addStretch()
        self.last_updated = label("本机操作记录", "Hint")
        activity_header.addWidget(self.last_updated)
        activity_box.addLayout(activity_header)
        self.activity_box = QVBoxLayout()
        self.activity_box.setSpacing(8)
        activity_box.addLayout(self.activity_box)
        self._render_activity()
        body_box.addWidget(activity_frame)
        body_box.addStretch(1)
        self.overview_scroll.setWidget(body)
        page_box.addWidget(self.overview_scroll, 1)
        self.pages.addWidget(page)

    def _build_recent(self):
        page = QWidget()
        box = QVBoxLayout(page)
        box.setContentsMargins(0, 0, 0, 0)
        box.setSpacing(22)
        box.addLayout(self._page_header("最近群聊", "最近切换成功的服务群，都在这里。"))
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        inner = QWidget()
        inner.setObjectName("ScrollPage")
        self.recent_box = QVBoxLayout(inner)
        self.recent_box.setContentsMargins(0, 0, 5, 0)
        self.recent_box.setSpacing(12)
        scroll.setWidget(inner)
        box.addWidget(scroll, 1)
        self.pages.addWidget(page)
        self._render_recent()

    def _build_settings(self):
        page = QWidget()
        box = QVBoxLayout(page)
        box.setContentsMargins(0, 0, 0, 0)
        box.setSpacing(22)
        box.addLayout(self._page_header("连接设置", "管理这台电脑连接的客服服务器。"))
        settings_card = card()
        form = QVBoxLayout(settings_card)
        form.setContentsMargins(25, 24, 25, 25)
        form.setSpacing(15)
        form.addWidget(label("服务器连接", "SectionTitle"))
        form.addWidget(label("使用本机已配置的服务器别名连接，无需在应用中保存密码。", "Subtitle", wrap=True))
        form.addSpacing(5)
        form.addWidget(label("SSH 主机别名", "FieldLabel"))
        row = QHBoxLayout()
        row.setSpacing(12)
        self.host_input = QLineEdit(self.host)
        self.host_input.setPlaceholderText(DEFAULT_HOST)
        self.host_input.returnPressed.connect(self.save_host)
        row.addWidget(self.host_input, 1)
        self.save_host_button = QPushButton("保存并连接")
        self.save_host_button.setObjectName("Primary")
        self.save_host_button.setMinimumHeight(42)
        self.save_host_button.clicked.connect(self.save_host)
        row.addWidget(self.save_host_button)
        form.addLayout(row)
        form.addWidget(label("默认：tencent-ubuntu。别名支持字母、数字、点、横线和下划线。", "Hint", wrap=True))
        box.addWidget(settings_card)
        info_card = card()
        info = QVBoxLayout(info_card)
        info.setContentsMargins(25, 22, 25, 22)
        info.setSpacing(10)
        info.addWidget(label("在本机管理，服务留在云端", "SectionTitle"))
        info.addWidget(label("关闭这个窗口后，服务器上的微信与客服会继续保持原有运行状态。", "Subtitle", wrap=True))
        box.addWidget(info_card)
        box.addStretch()
        self.pages.addWidget(page)

    def _set_pill(self, text: str, tone: str):
        colors = {
            "good": ("#E9F8EF", "#17965D"), "paused": ("#FFF6E4", "#B78729"),
            "error": ("#FFF0ED", "#C46A58"), "neutral": ("#F0F4F1", "#8B9C90"),
        }
        background, foreground = colors.get(tone, colors["neutral"])
        self.status_pill.setText("●  " + text)
        self.status_pill.setStyleSheet(f"background:{background}; color:{foreground}; border-radius:11px; font-size:10px; font-weight:600;")

    def show_page(self, index: int):
        self.pages.setCurrentIndex(index)
        self.nav_buttons[index].setChecked(True)
        if index == 1:
            self._render_recent()

    def _render_recent(self):
        clear_layout(self.recent_box)
        self.recent_buttons = []
        if not self.recent_groups:
            empty = card()
            layout = QVBoxLayout(empty)
            layout.setContentsMargins(30, 50, 30, 50)
            layout.setSpacing(13)
            symbol = QLabel()
            symbol.setPixmap(icon("clock", "#9EC4AA", 44).pixmap(QSize(44, 44)))
            symbol.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(symbol)
            title = label("还没有切换记录", "EmptyTitle")
            title.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(title)
            subtitle = label("成功切换后，群聊会出现在这里。", "Subtitle")
            subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(subtitle)
            self.recent_box.addWidget(empty)
        for group in self.recent_groups:
            entry = card()
            row = QHBoxLayout(entry)
            row.setContentsMargins(22, 19, 22, 19)
            words = QVBoxLayout()
            words.setSpacing(6)
            words.addWidget(label(group, "RecentName", wrap=True))
            words.addWidget(label("当前服务群" if group in self.status_data.get("targets", []) else "最近使用的服务群", "Subtitle"))
            row.addLayout(words, 1)
            button = QPushButton("切换到此群")
            button.clicked.connect(lambda _checked=False, target=group: self.perform("switch", group=target))
            button.setEnabled(not self.busy and not self.needs_refresh)
            self.recent_buttons.append(button)
            row.addWidget(button)
            self.recent_box.addWidget(entry)
        self.recent_box.addStretch()

    def _render_activity(self):
        clear_layout(self.activity_box)
        if not self.activity:
            self.activity_box.addWidget(label("连接后会显示最近的操作记录。", "ActivityText"))
            return
        for item in self.activity[:3]:
            row = QHBoxLayout()
            row.setSpacing(9)
            dot = label("●")
            dot.setStyleSheet("color:#E7AB77; font-size:7px;" if item["error"] else "color:#77C29A; font-size:7px;")
            row.addWidget(dot)
            message = label(item["message"], "ActivityText")
            message.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
            message.setToolTip(item["message"])
            row.addWidget(message, 1)
            row.addWidget(label(item["time"], "ActivityTime"))
            self.activity_box.addLayout(row)

    def _append_activity(self, message: str, *, error=False):
        self.activity.insert(0, {"message": message, "time": datetime.now().strftime("%H:%M"), "error": error})
        self.activity = self.activity[:20]
        self._render_activity()

    def _feedback(self, message: str, *, error=False):
        self.feedback.setText(message)
        self.feedback.setToolTip(message)
        self.feedback.setStyleSheet("color:#BD765F;" if error else "color:#7C9685;")

    def _update_actions(self):
        ready = not self.busy and not self.needs_refresh
        self.refresh_button.setEnabled(not self.busy)
        self.switch_button.setEnabled(ready)
        self.group_input.setEnabled(not self.busy)
        self.host_input.setEnabled(not self.busy)
        self.save_host_button.setEnabled(not self.busy)
        paused = self.status_data.get("paused")
        self.pause_button.setEnabled(ready and paused is not True)
        self.resume_button.setEnabled(ready and (paused is not False or self.status_data.get("service") != "active"))
        for button in self.recent_buttons:
            button.setEnabled(ready)
        self.refresh_button.setText(" 连接中…" if self.busy else " 刷新状态")

    def perform(self, action: str, group: str | None = None):
        if self.busy:
            return
        if action not in {"status", "pause", "resume", "switch"}:
            self._feedback("不支持的控制操作。", error=True)
            return
        if action != "status" and self.needs_refresh:
            self._feedback("请先刷新状态，确认服务器当前的服务群与运行情况。", error=True)
            return
        target = (group if group is not None else self.group_input.currentText()).strip()
        if action == "switch" and not target:
            self._feedback("请填写要切换到的完整群名。", error=True)
            self.group_input.setFocus()
            return
        self.busy = True
        messages = {"status": "正在连接服务器，读取客服状态…", "pause": "正在暂停客服…",
                    "resume": "正在恢复回复…", "switch": f"正在切换到「{target}」…"}
        self._feedback(messages[action])
        self._update_actions()
        worker = RequestWorker(action, self.host, target)
        worker.signals.finished.connect(self._finish_request, Qt.ConnectionType.QueuedConnection)
        self._worker = worker
        self.pool.start(worker)

    @Slot(dict)
    def _finish_request(self, result: dict):
        self.busy = False
        self._worker = None
        action = result.get("action", "status")
        if result.get("ok"):
            data = result["data"]
            self.needs_refresh = False
            self.connected = True
            self._apply_status(data)
            if action == "switch":
                group = result["group"]
                self.recent_groups = ([group] + [g for g in self.recent_groups if g != group])[:12]
                self.group_input.clear()
                self.group_input.addItems(self.recent_groups)
                self.group_input.setEditText(group)
                message = data.get("message") or f"已切换到「{group}」，保持暂停；点击「恢复回复」开始服务。"
            elif action == "pause":
                message = data.get("message") or "客服已暂停，微信继续在线。"
            elif action == "resume":
                message = data.get("message") or "客服已恢复，将在当前服务群回复。"
            else:
                targets = "、".join(str(g) for g in data.get("targets", [])) or "尚未设置"
                message = f"服务器已连接 · 当前服务群「{targets}」"
            self._feedback(message)
            self._append_activity(message)
            self.last_updated.setText("刚刚更新")
            self._save_settings(result.get("host") or self.host)
            self._render_recent()
        else:
            self.needs_refresh = True
            self._set_pill("待刷新", "paused")
            self.connection_label.setText("●  状态待核实")
            self.connection_label.setStyleSheet("color:#D7BE8E;")
            message = str(result.get("error") or "服务器操作未完成。") + " 请先刷新状态。"
            self._feedback(message, error=True)
            self._append_activity(message, error=True)
        self._update_actions()
        self.request_completed.emit(bool(result.get("ok")))

    def _apply_status(self, data: dict):
        self.status_data = data
        targets = data.get("targets") or []
        if isinstance(targets, str):
            targets = [targets]
        group_name = "、".join(str(g) for g in targets) or "尚未设置"
        self.target_label.setText(group_name)
        self.target_label.setToolTip(group_name)
        if not self.group_input.currentText().strip() and targets:
            self.group_input.setEditText(str(targets[0]))
        state, paused = data.get("service"), data.get("paused")
        if paused is True and state in {"active", "inactive"}:
            self._set_pill("已暂停", "paused")
        elif state != "active":
            self._set_pill("服务异常" if state == "failed" else "服务已停止", "error")
        elif data.get("dry_run"):
            self._set_pill("演练模式", "neutral")
        else:
            self._set_pill("回复已开启", "good")
        persona = str(data.get("persona") or "微信客服")
        self.hero_subtitle.setText(f"机器人 {persona}  ·  服务目标以当前群为准")
        self.stat_values["wechat"].setText({"active": "运行中", "inactive": "已停止", "failed": "异常"}.get(data.get("wechat_service"), "未知"))
        queue = data.get("queue") or {}
        self.stat_values["pending"].setText(str(queue.get("pending", 0)))
        self.stat_values["admin_pending"].setText(str(queue.get("admin_pending", 0)))
        self.connection_label.setText("●  腾讯云已连接")
        self.connection_label.setStyleSheet("color:#9BDFC0;")
        self.connection_host.setText(self.host)

    @Slot()
    def save_host(self):
        if self.busy:
            return
        candidate = self.host_input.text().strip()
        try:
            from controller import Controller

            Controller(host=candidate)
        except Exception as error:
            self._feedback(str(error), error=True)
            return
        self.host = candidate
        self.needs_refresh = True
        self.connected = False
        self._set_pill("等待连接", "neutral")
        self.connection_host.setText(candidate)
        self.connection_label.setText("●  正在连接")
        self.perform("status")

    def _save_settings(self, host: str):
        path = settings_path()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".tmp")
            temporary.write_text(json.dumps({"host": host, "recent_groups": self.recent_groups}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            temporary.replace(path)
        except OSError:
            self._append_activity("最近使用的群未能保存，本次服务器操作已完成。", error=True)

    def closeEvent(self, event):
        if self.busy:
            self._feedback("服务器操作进行中，请等待完成后关闭窗口。")
            event.ignore()
            return
        event.accept()


def main():
    parser = argparse.ArgumentParser(description=APP_TITLE)
    parser.add_argument("--smoke-test", action="store_true", help="离屏检查界面，不连接服务器")
    parser.add_argument("--preview", nargs="?", const="build/desktop-preview.png", metavar="PNG", help="只读连接服务器，保存界面截图后退出")
    args = parser.parse_args()
    if args.smoke_test:
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    app = QApplication(sys.argv[:1])
    app.setStyle("Fusion")
    app.setFont(QFont("Microsoft YaHei UI", 10))
    app.setApplicationName(APP_TITLE)
    window = App(connect=not args.smoke_test)
    if args.smoke_test:
        window.show()
        QTimer.singleShot(100, app.quit)
    elif args.preview:
        def capture(_success=True):
            def save():
                destination = Path(args.preview)
                destination.parent.mkdir(parents=True, exist_ok=True)
                window.grab().save(str(destination))
                print("Preview saved:", destination)
                app.quit()
            QTimer.singleShot(250, save)
        window.request_completed.connect(capture)
        window.show()
    else:
        window.show()
    result = app.exec()
    window.pool.waitForDone(200)
    if args.smoke_test:
        print("Qt UI smoke test passed")
    return result


if __name__ == "__main__":
    raise SystemExit(main())
