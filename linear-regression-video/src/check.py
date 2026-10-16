"""用语音识别回听配音，逐句和配音文字对照：python check.py [--all]

每句 build/voice/<键>.wav 送进通义千问语音识别（qwen3-asr-flash，关掉数字规整，数字按汉字输出），
识别结果与配音文字去掉标点、空格后算字错误率，按错误率从高到低列出可疑的句子。
结果缓存在 build/voice/asr.json，配音没变的句子不重复识别；--all 列出全部句子。
多音字识别不出来（读错了也会写成同一个字），由 narration.PINYIN 固定读音。
"""
import base64
import json
import os
import re
import sys

import requests

from tts import OUT, settings

ASR_MODEL = os.environ.get("QWEN_ASR_MODEL", "qwen3-asr-flash")


def asr(path, cfg):
    data = base64.b64encode(open(path, "rb").read()).decode()
    body = {"model": ASR_MODEL,
            "messages": [{"role": "user", "content": [
                {"type": "input_audio", "input_audio": {"data": "data:;base64," + data}}]}],
            "asr_options": {"language": "zh", "enable_itn": False}}
    for _ in range(4):
        r = requests.post(f"{cfg['base']}/compatible-mode/v1/chat/completions", json=body, timeout=180,
                          headers={"Authorization": f"Bearer {cfg['key']}"})
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"]
    sys.exit(f"语音识别失败：{r.status_code} {r.text[:300]}")


def plain(s):
    return re.sub(r"[\s，。、：；！？“”‘’（）()·,.:;!?\"'—…-]", "", s).lower()


def cer(ref, hyp):
    a, b = plain(ref), plain(hyp)
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(b)] / max(1, len(a))


def main():
    cfg = settings()
    meta = json.load(open(os.path.join(OUT, "durations.json"), encoding="utf-8"))
    if any(m.get("estimate") for m in meta.values()):
        sys.exit("durations.json 是估计值，先运行 tts.py 合成配音")
    path = os.path.join(OUT, "asr.json")
    cache = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    for key, m in meta.items():
        tag = f"{m['hash']}|{m['dur']}"          # 文字没变但重新合成过，也要重新识别
        if cache.get(key, {}).get("hash") != tag:
            cache[key] = {"hash": tag, "asr": asr(os.path.join(OUT, f"{key}.wav"), cfg)}
            json.dump(cache, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    rows = sorted(((cer(m["say"], cache[k]["asr"]), k) for k, m in meta.items()), reverse=True)
    show = rows if "--all" in sys.argv else [r for r in rows if r[0] > 0]
    for e, k in show:
        print(f"{k}  {e:5.1%}\n  稿：{meta[k]['say']}\n  听：{cache[k]['asr']}")
    bad = sum(1 for e, _ in rows if e > 0.05)
    print(f"{len(rows)} 句，字错误率超过 5% 的 {bad} 句，平均 {sum(e for e, _ in rows) / len(rows):.2%}")


if __name__ == "__main__":
    main()
