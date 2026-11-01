"""把微信输入法的上下文日志整理成按天的输入记录（打字 + 语音输入转出的文字）。

用法:
    python wetype_daily.py              # 整理日志里的所有日期
    python wetype_daily.py 2026-10-22   # 只整理某一天

输出:
    输入记录/YYYY-MM-DD.md   每天一份，按时间排好、去掉重复，密码密钥等已隐藏

不保留原始日志的副本：原始日志里的密码、密钥都是明文，多存一份就多一处泄露。
"""

import os
import re
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit

LOG = Path(os.environ["USERPROFILE"]) / "AppData/LocalLow/Tencent/WeType/context_capture/refetch_sync_legacy.log"
HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / "输入记录"
CONFIG = HERE / "配置.txt"
BEIJING = timezone(timedelta(hours=8))

# 同一个软件里，间隔不超过这个时间的记录才会被当成同一段输入合并
MERGE_WINDOW = timedelta(minutes=15)

APP_NAMES = {
    "brave.exe": "Brave",
    "msedge.exe": "Edge",
    "chrome.exe": "Chrome",
    "librewolf.exe": "LibreWolf",
    "weixin.exe": "微信",
    "wechat.exe": "微信",
    "claude.exe": "Claude",
    "chatgpt.exe": "ChatGPT",
    "deepseek harness.exe": "DeepSeek Harness",
    "code.exe": "VS Code",
    "devcpp.exe": "Dev-C++",
    "explorer.exe": "文件资源管理器",
    "windowsterminal.exe": "终端",
    "wpspdf.exe": "WPS PDF",
    "potplayermini64.exe": "PotPlayer",
    "notion calendar.exe": "Notion Calendar",
    "qoder cn.exe": "Qoder",
}

# 这些软件里打的字整条不记录；配置.txt 里的「不记录的软件」可以改
DEFAULT_SKIP_APPS = "keepass.exe, keepassxc.exe, bitwarden.exe, 1password.exe, enpass.exe, dashlane.exe, lastpass.exe"


def load_config():
    """读 配置.txt 里的「名字=值」，# 开头的是说明。"""
    cfg = {}
    if CONFIG.exists():
        for line in CONFIG.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                cfg[key.strip()] = value.strip()
    return cfg


def skip_apps(cfg):
    raw = cfg.get("不记录的软件", DEFAULT_SKIP_APPS)
    return {a.strip().lower() for a in re.split(r"[,，、]", raw) if a.strip()}


def pc_utc_offset(cfg):
    """配置里「电脑时区」写数字（比如 -4）就按它算；写「跟随系统」或不写，就按电脑当前的时区（自动处理夏令时）。"""
    try:
        return float(cfg.get("电脑时区", ""))
    except ValueError:
        return None


def to_beijing(t, offset):
    """输入法按电脑时钟记时间，你的电脑时区改成了美东，这里统一换算成北京时间。"""
    if offset is None:
        return t.astimezone(BEIJING).replace(tzinfo=None)  # naive 时间按系统时区解释
    return t - timedelta(hours=offset) + timedelta(hours=8)


def beijing_now():
    return datetime.now(BEIJING).replace(tzinfo=None)


def beijing_today():
    return beijing_now().date()


def unescape(s):
    s = re.sub(r"[​-‍⁠﻿]", "", s)  # 微信里的零宽字符会把邮箱、密码隔断，打码规则就认不出来
    return re.sub(r"\\([nrt\\])", lambda m: {"n": "\n", "r": "", "t": "\t", "\\": "\\"}[m.group(1)], s)


def parse(path):
    records, cur = [], None
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if line.startswith("======== [REFETCH] capture"):
                cur = {}
            elif line.startswith("======== [REFETCH] end"):
                if cur is not None:
                    records.append(cur)
                cur = None
            elif cur is not None:
                key, sep, value = line.partition("=")
                if sep and re.fullmatch(r"[a-z_]+", key):
                    cur[key] = value
    return records


def to_entry(r, offset=None):
    if r.get("refetch_success") != "true":
        return None
    text = unescape(r.get("before_text", "") + r.get("selected_text", "") + r.get("after_text", "")).strip()
    if not text:
        return None
    try:
        t = to_beijing(datetime.strptime(r["time_local"][:19], "%Y-%m-%d %H:%M:%S"), offset)
    except (KeyError, ValueError):
        return None
    exe = r.get("host_exe", "").lower()
    return {"start": t, "end": t, "exe": exe, "app": APP_NAMES.get(exe, exe or "未知"), "text": text}


def part_of(short, long):
    """short 是不是 long 的一部分（开头、结尾，或者够长时出现在中间）。"""
    if len(short) > len(long):
        return False
    if len(short) >= 2 and (long.startswith(short) or long.endswith(short)):
        return True
    return len(short) >= 6 and short in long


def edited_from(a, b):
    """b 是不是 a 改了几个字之后的版本。"""
    if min(len(a), len(b)) < 8 or max(len(a), len(b)) > 2000:
        return False
    if not 0.6 <= len(a) / len(b) <= 1.67:
        return False
    m = SequenceMatcher(None, a, b, autojunk=False)
    return m.quick_ratio() >= 0.8 and m.ratio() >= 0.8


def dedupe(entries):
    """输入框里的字是一点点变长、改来改去的，同一段话会被记好几次；只保留最后最完整的那一版。"""
    kept = []
    for e in sorted(entries, key=lambda e: e["start"]):
        recent = [k for k in kept[-30:] if k["app"] == e["app"] and e["start"] - k["end"] <= MERGE_WINDOW]
        absorbed = next((k for k in recent if part_of(e["text"], k["text"])), None)
        if absorbed:
            absorbed["end"] = e["start"]
            continue
        replaced = [k for k in recent if part_of(k["text"], e["text"]) or edited_from(k["text"], e["text"])]
        if replaced:
            e["start"] = min(k["start"] for k in replaced)
            kept = [k for k in kept if not any(k is r for r in replaced)]
        kept.append(e)
    return kept


# ---------- 隐藏敏感信息 ----------

def luhn_ok(digits):
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def mask_card(m):
    digits = re.sub(r"\D", "", m.group(0))
    return f"{digits[:4]} **** **** {digits[-4:]}" if luhn_ok(digits) else m.group(0)


def short_url(m):
    """网址只留域名和路径：查询参数里经常带着登录凭证。"""
    try:
        p = urlsplit(m.group(0))
    except ValueError:
        return "[链接]"
    host = p.netloc.rsplit("@", 1)[-1]  # 去掉 user:pass@
    path = p.path if len(p.path) <= 60 else p.path[:60] + "…"
    return f"{p.scheme}://{host}{path}{'?…' if p.query else ''}"


def mask_email(m):
    return f"{m.group(1)[:2]}***@{m.group(2)}"


def mask_ip(m):
    """公网 IP 遮掉；内网、本机地址留着。第一段小于 11 的多半是版本号（3.0.0.38），也留着。"""
    parts = [int(x) for x in m.group(0).split(".")]
    if any(x > 255 for x in parts) or parts[0] < 11 or parts[0] == 127:
        return m.group(0)
    if parts[0] == 192 and parts[1] == 168 or parts[0] == 172 and 16 <= parts[1] <= 31 or parts[0] == 169 and parts[1] == 254:
        return m.group(0)
    return "[已隐藏IP]"


# 按顺序替换；替换后的占位符都是汉字，再跑一遍不会重复替换
MASKS = [
    (re.compile(r"[​-‍⁠﻿]"), ""),  # 先去零宽字符，旧记录重新打码时也要用到
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?(?:-----END [A-Z ]*PRIVATE KEY-----|\Z)", re.S), "[已隐藏私钥]"),
    (re.compile(r"https?://[^\s\"'<>，。、）)一-鿿]+"), short_url),
    # 常见平台的密钥格式。用 (?<![A-Za-z0-9]) 而不是 \b：汉字也算单词字符，紧挨着汉字的密钥 \b 匹配不到
    (re.compile(
        r"(?<![A-Za-z0-9])(?:sk-[A-Za-z0-9._\-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}"
        r"|glpat-[A-Za-z0-9_\-]{16,}|hf_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9\-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{30,})"
    ), "[已隐藏密钥]"),
    (re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"), "[已隐藏令牌]"),
    (re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-~+/=]{16,}"), r"\1[已隐藏令牌]"),
    # 「名字=值」：DASHSCOPE_API_KEY=…、password: …
    (re.compile(
        r"(?i)(?<![A-Za-z0-9])((?:[a-z]+_)*(?:api_?key|access_?key|secret(?:_?key)?|client_?secret|private_?key"
        r"|(?:access_|refresh_)?token|password|passwd|pwd|authorization))([ \t]*[:=：][ \t]*)[^\s，。,；;]+"
    ), r"\1\2[已隐藏]"),
    # 中文说法：密码是 abc123、验证码 482913（后面跟的是汉字就不算，比如「密码忘了」；不跨行）
    (re.compile(r"(密码|口令|密钥|秘钥|验证码|校验码|动态码|PIN码|pin码)([ \t]*(?:是|为|:|：|=)?[ \t]*)[A-Za-z0-9!@#$%^&*._\-+=/~]{3,}"), r"\1\2[已隐藏]"),
    (re.compile(r"(?<![0-9])[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?![0-9A-Za-z])"), "[已隐藏身份证号]"),
    (re.compile(r"(?<![0-9])(?:\d{4}[ -]?){3}\d{1,7}(?![0-9])"), mask_card),  # 银行卡号，过了 Luhn 校验才算
    (re.compile(r"(?<![0-9])(1[3-9]\d)\d{4}(\d{4})(?![0-9])"), r"\1****\2"),  # 手机号只留前三后四
    # 像强密码的串：同时有大写、小写、数字和符号（要放在邮箱规则前面，密码常紧贴在邮箱后面）
    (re.compile(
        r"(?<![A-Za-z0-9!@#$%^&*?~+=_\-.])(?=[A-Za-z0-9!@#$%^&*?~+=_\-.]*[A-Z])(?=[A-Za-z0-9!@#$%^&*?~+=_\-.]*[a-z])"
        r"(?=[A-Za-z0-9!@#$%^&*?~+=_\-.]*\d)(?=[A-Za-z0-9!@#$%^&*?~+=_\-.]*[!@#$%^&*?~+=_\-])[A-Za-z0-9!@#$%^&*?~+=_\-.]{8,40}"
    ), "[已隐藏密码]"),
    (re.compile(r"(?<![A-Za-z0-9._%+-])([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})"), mask_email),
    (re.compile(r"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])"), mask_ip),
    (re.compile(r"(?<![0-9])\d{10,}(?![0-9])"), "[已隐藏数字串]"),  # 证件号的前半段、账号之类的长数字
    # 其他看着像随机串的长字符串（32 位以上、字母数字混合）；前面是「.」的不算，免得把 github.com/用户/仓库 这种路径遮掉
    (re.compile(r"(?<![A-Za-z0-9_\-+/=.])(?=[A-Za-z0-9_\-+/=]*\d)(?=[A-Za-z0-9_\-+/=]*[A-Za-z])[A-Za-z0-9_\-+/=]{32,}"), "[已隐藏长串]"),
]
FOLD_OVER = 600


def mask(text):
    for pattern, repl in MASKS:
        text = pattern.sub(repl, text)
    return text


SECRET_WORDS = re.compile(r"密码|口令|密钥|秘钥|password|passwd|2fa", re.I)
LONE_PASSWORD = re.compile(r"(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z0-9!@#$%^&*._\-]{6,32}")


def clean(text):
    # 一段里出现两次以上「密码 / 密钥」，多半是密码清单，整段不留
    if len(SECRET_WORDS.findall(text)) >= 2:
        return "[这一段里有多处密码或密钥，已整段隐藏]"
    # 整段只有一个大小写字母加数字的词，多半是在登录框里打的密码
    if LONE_PASSWORD.fullmatch(text.strip()):
        return "[疑似密码，已隐藏]"
    text = mask(text)
    if len(text) > FOLD_OVER:
        text = text[:200].rstrip() + f"\n\n…（这段共 {len(text)} 字，多半是粘贴的长文，已折叠）"
    elif "...(truncated)" in text:  # 输入法自己截断过的，也是长文
        text = text[:200].rstrip() + "\n\n…（这段被输入法截断过，多半是粘贴的长文，已折叠）"
    return text


# ---------- 输出 ----------

def write_day(day, entries):
    """写当天的记录；内容没变就不动文件（日报靠文件修改时间判断要不要重写）。"""
    counts = Counter(e["app"] for e in entries)
    lines = [
        f"# {day} 输入记录（北京时间）",
        "",
        f"共 {len(entries)} 段，" + " · ".join(f"{app} {n}" for app, n in counts.most_common()),
        "",
    ]
    for e in entries:
        lines += [f"### {e['start']:%H:%M} · {e['app']}", "", clean(e["text"]), ""]
    content = "\n".join(lines)

    path = OUT_DIR / f"{day}.md"
    if path.exists():
        old = path.read_text(encoding="utf-8")
        if old == content:
            return False
        # 输入法的日志会滚动删掉旧内容；两天前的记录如果段数变少了，说明是被删了，保留原来的，
        # 但用最新的打码规则再过一遍（打码只会让文字变短，不会让段数变少）
        old_count = re.search(r"共 (\d+) 段", old)
        if date.fromisoformat(day) < beijing_today() - timedelta(days=1) and old_count and len(entries) < int(old_count.group(1)):
            content = mask(old)
            if content == old:
                return False
    path.write_text(content, encoding="utf-8")
    return True


def main(only_day=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if not LOG.exists():
        print(f"找不到微信输入法的日志：{LOG}（输入法卸载了，或者新版本换了位置）")
        return []

    cfg = load_config()
    skip, offset = skip_apps(cfg), pc_utc_offset(cfg)
    by_day = {}
    for r in parse(LOG):
        e = to_entry(r, offset)
        if e and e["exe"] not in skip:
            by_day.setdefault(f"{e['start']:%Y-%m-%d}", []).append(e)

    OUT_DIR.mkdir(exist_ok=True)
    changed = []
    for day in sorted(by_day):
        if only_day and day != only_day:
            continue
        entries = dedupe(by_day[day])
        if write_day(day, entries):
            changed.append(day)
            print(f"输入记录 {day}：{len(entries)} 段")
    if not changed:
        print("输入记录没有变化")
    return changed


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
