"""先整理输入记录，再用 DeepSeek 把每天的记录写成日报；缺哪天补哪天。

用法:
    python daily_report.py              # 平时用这个：补齐所有没写过、或记录有更新的日报
    python daily_report.py 2026-10-22   # 重新生成某一天

每晚由 Windows 任务计划程序「输入日报-每晚生成」自动运行（用 pythonw，不弹窗），
运行情况写在 运行日志.txt。
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime

import wetype_daily as wd

REPORT_DIR = wd.HERE / "日报"
RUN_LOG = wd.HERE / "运行日志.txt"
API_URL = "https://api.deepseek.com/chat/completions"
WEEKDAYS = "一二三四五六日"

SYSTEM_PROMPT = """你是用户的私人助理。用户会给你某一天在电脑上用微信输入法打出去的全部文字（打字和语音输入混在一起），按时间排列，每段标了时间（北京时间）和所在软件。请据此写一份中文日报，帮用户回顾这一天在干什么。日报里用「你」称呼用户，不要用「他」或「她」。

要求：
1. 只根据记录写，不要编造。记录里只有用户自己发出去的话，看不到对方的回复；推测的地方注明「推测」。
2. 语音输入会有同音错字（比如「迪普斯内克」其实是 DeepSeek、「方样本」其实是「双样本」），按意思理解，写正确的词。
3. 标着「已折叠」的多半是从别处粘贴来的长文，不是用户自己的话，只用来理解上下文。
4. 很零碎的输入（单个问号、数字、网址、「好的」）不用单独列，除非能说明用户在干什么。
5. 语气客观平实，不复述脏话。
6. 绝对不要写出任何密码、密钥、令牌、验证码、身份证号、银行卡号。记录里的「[已隐藏…]」表示用户当天在那里发过这类敏感信息：在「提醒」里写明大概时间和软件，建议更换，不要猜内容。

直接从下面的格式开始输出（不要写标题，不要开场白和结尾）：

**一句话：** 用一两句话概括这一天。

## 时间线
| 时段 | 在干什么 | 主要用的软件 |
|---|---|---|
（相邻的同一件事合并成一个时段；超过两小时没有记录的空档也单独写一行「（没有输入记录）」）

## 按事情分
### 小标题（按当天实际内容分组取名，比如 某个项目名、工作、学习、AI 工具、生活娱乐）
- 要点：具体做了什么、遇到什么问题、提了什么要求

## 还没收尾的事
- [ ] 记录里提到、但看不出已经完成的事

## 提醒
（敏感信息、明显的风险或需要注意的事；没有就写「无」）
"""


class Tee:
    """同时写到屏幕（如果有）和运行日志。"""

    def __init__(self, *streams):
        self.streams = [s for s in streams if s is not None]

    def write(self, s):
        for st in self.streams:
            st.write(s)
            st.flush()

    def flush(self):
        for st in self.streams:
            st.flush()


class StopAll(Exception):
    """key 不对、没余额、没网：后面的天也不用试了。"""


def progress(msg):
    """实时进度只给看板看（不进运行日志）；pythonw 下没有输出就算了。"""
    if sys.__stdout__ is not None:
        sys.__stdout__.write(msg + "\n")
        sys.__stdout__.flush()


def read_stream(resp, day):
    """边收边数：思考了多少字、写出了多少字。返回 (正文, 结束原因)。"""
    content, thought, finish, last = [], 0, None, 0.0
    for raw in resp:
        line = raw.decode("utf-8", errors="replace").strip()
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            break
        choices = json.loads(data).get("choices") or []
        if not choices:
            continue
        delta = choices[0].get("delta") or {}
        thought += len(delta.get("reasoning_content") or "")
        content.append(delta.get("content") or "")
        finish = choices[0].get("finish_reason") or finish
        if time.time() - last > 1:
            progress(f"进度 {day} 思考 {thought} 写出 {sum(map(len, content))}")
            last = time.time()
    progress(f"进度 {day} 思考 {thought} 写出 {sum(map(len, content))}")
    return "".join(content).strip(), finish


def ask_deepseek(key, model, user_text, day=""):
    # deepseek-flash 这类模型会先「思考」，思考也算在 max_tokens 里，给少了正文就是空的
    body = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_text}],
        "temperature": 0.3,
        "max_tokens": 32000,
        "stream": True,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                answer, finish = read_stream(resp, day)
            if finish == "length":
                raise RuntimeError("DeepSeek 写到一半被截断了（想得太多，超出长度上限），这天没保存")
            if not answer:
                raise RuntimeError("DeepSeek 返回了空内容，这天没保存")
            return answer
        except urllib.error.HTTPError as e:
            if e.code == 401:
                raise StopAll("DeepSeek API key 不对，检查一下 配置.txt") from e
            if e.code == 402:
                raise StopAll("DeepSeek 账户余额不足，充值后会自动补上") from e
            if e.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(30 * (attempt + 1))
                continue
            raise
        except urllib.error.URLError as e:
            raise StopAll(f"连不上 DeepSeek（{e.reason}），下次运行会自动补上") from e


def needs_report(record, report):
    if not report.exists():
        return True
    text = report.read_text(encoding="utf-8")
    if "\n## " not in text:  # 只有标题没有正文（以前 DeepSeek 回了空内容）
        return True
    # Claude 手写的日报不自动覆盖；想让 DeepSeek 重写，删掉那天的日报再运行
    if "由 Claude" in text[:300]:
        return False
    return record.stat().st_mtime > report.stat().st_mtime


def write_report(day, record, report, key, model):
    d = date.fromisoformat(day)
    text = wd.mask(record.read_text(encoding="utf-8"))  # 发出去之前再打一遍码
    segments = re.search(r"共 (\d+) 段", text)

    answer = ask_deepseek(key, model, f"这是 {day}（周{WEEKDAYS[d.weekday()]}）的输入记录：\n\n{text}", day)
    answer = re.sub(r"^```(?:markdown|md)?\s*|\s*```$", "", answer.strip())
    answer = re.sub(r"^#\s.*\n+", "", answer)  # 标题由这里统一加
    answer = wd.mask(answer)  # 万一模型把什么敏感信息写回来了

    now = wd.beijing_now()
    title = f"# {day}（周{WEEKDAYS[d.weekday()]}）日报" + (f"（截至 {now:%H:%M}）" if d == wd.beijing_today() else "")
    note = (
        f"> 由 DeepSeek（{model}）根据 {segments.group(1) if segments else '?'} 段输入整理，生成于 {now:%m-%d %H:%M}。"
        "只看得到你发出去的话，推测的地方已注明。"
    )
    report.write_text(f"{title}\n\n{note}\n\n{answer.strip()}\n", encoding="utf-8")


def main():
    console = sys.stdout  # 用 pythonw 运行时是 None
    if console is not None and hasattr(console, "reconfigure"):
        console.reconfigure(encoding="utf-8", errors="replace")
    log = open(RUN_LOG, "a", encoding="utf-8")
    sys.stdout = sys.stderr = Tee(console, log)
    print(f"\n===== 北京时间 {wd.beijing_now():%Y-%m-%d %H:%M:%S} 开始 =====")

    only_day = sys.argv[1] if len(sys.argv) > 1 else None
    wd.main()

    cfg = wd.load_config()
    key = cfg.get("DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API_KEY", "")
    model = cfg.get("模型") or "deepseek-chat"
    if not key:
        print("还没填 DeepSeek API key：打开 配置.txt，把 key 粘贴在 DEEPSEEK_API_KEY= 后面。输入记录已经照常整理好了。")
        return

    REPORT_DIR.mkdir(exist_ok=True)
    todo = []
    for record in sorted(wd.OUT_DIR.glob("????-??-??.md")):
        report = REPORT_DIR / record.name
        if (only_day and record.stem == only_day) or (not only_day and needs_report(record, report)):
            todo.append((record.stem, record, report))
    if not todo:
        print("日报都是最新的")
        return

    print(f"要写 {len(todo)} 天的日报：{todo[0][0]} … {todo[-1][0]}")
    done = 0
    for day, record, report in todo:
        print(f"正在写 {day}")
        try:
            write_report(day, record, report, key, model)
            done += 1
            print(f"日报 {day} 写好了")
        except StopAll as e:
            print(f"停下了：{e}")
            break
        except Exception as e:  # 某一天失败不影响其他天，下次运行会重试
            print(f"日报 {day} 失败：{e!r}")
    print(f"本次写了 {done}/{len(todo)} 天")


if __name__ == "__main__":
    main()
