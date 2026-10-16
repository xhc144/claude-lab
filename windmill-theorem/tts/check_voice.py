"""Listen back to the narration with speech recognition and compare it with the script.

    python tts/check_voice.py --lang zh [--all]

Every build/audio/<lang>/<line_id>.wav is transcribed with qwen3-asr-flash (inverse text
normalization off, so numbers come back as words) and compared with the spoken text of the line.
Lines are listed by error rate, worst first; results are cached in build/audio/<lang>/asr.json.
Errors in Chinese are counted per character, in English per word.  A wrong reading of a
polyphonic character is invisible here (it is transcribed as the same character): those are pinned
in tts/qwen.py PINYIN.
"""
import argparse
import base64
import json
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tts"))
from content.script import BY_ID, sentences, spoken  # noqa: E402
from qwen import BASE, api_key  # noqa: E402

_EN_NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six",
           "7": "seven", "8": "eight", "9": "nine"}


def asr(path, lang, key):
    data = base64.b64encode(path.read_bytes()).decode()
    body = {"model": "qwen3-asr-flash",
            "messages": [{"role": "user", "content": [
                {"type": "input_audio", "input_audio": {"data": "data:;base64," + data}}]}],
            "asr_options": {"language": lang, "enable_itn": False}}
    for _ in range(4):
        r = requests.post(f"{BASE}/compatible-mode/v1/chat/completions", json=body, timeout=180,
                          headers={"Authorization": f"Bearer {key}"})
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"]
    sys.exit(f"speech recognition failed: {r.status_code} {r.text[:300]}")


_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen " \
        "seventeen eighteen nineteen".split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def _words(n):
    """Small numbers as words, so that '13' heard by the recognizer matches 'thirteen' in the script."""
    n = int(n)
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + ("" if n % 10 == 0 else " " + _ONES[n % 10])
    return str(n)


def tokens(s, lang):
    if lang == "zh":
        return list(re.sub(r"[\s，。、：；！？“”‘’（）()《》·,.:;!?\"'—…\-]", "", s).lower())
    s = s.lower().replace("-", " ").replace("’", "'").replace("favourite", "favorite").replace("memorised", "memorized")
    s = re.sub(r"\b\d{1,2}\b", lambda m: _words(m.group()), s)
    return [w for w in re.findall(r"[a-z0-9']+", s)]


def wer(ref, hyp):
    d = list(range(len(hyp) + 1))
    for i in range(1, len(ref) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(hyp) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (ref[i - 1] != hyp[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(hyp)] / max(1, len(ref))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, choices=["zh", "en"])
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    key = api_key()
    d = ROOT / "build" / "audio" / a.lang
    manifest = json.loads((d / "manifest.json").read_text(encoding="utf-8"))
    cp = d / "asr.json"
    cache = json.loads(cp.read_text(encoding="utf-8")) if cp.exists() else {}
    rows = []
    for lid, m in manifest.items():
        tag = f"{m.get('hash')}|{m['dur']}"
        if cache.get(lid, {}).get("tag") != tag:
            cache[lid] = {"tag": tag, "asr": asr(d / f"{lid}.wav", a.lang, key)}
            cp.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
        ref = " ".join(spoken(t) for t, _ in sentences(BY_ID[lid], a.lang))
        rows.append((wer(tokens(ref, a.lang), tokens(cache[lid]["asr"], a.lang)), lid, ref))
    rows.sort(reverse=True)
    for e, lid, ref in (rows if a.all else [r for r in rows if r[0] > 0.03]):
        print(f"{lid}  {e:5.1%}\n  script: {ref}\n  heard : {cache[lid]['asr']}")
    print(f"{len(rows)} lines, {sum(1 for r in rows if r[0] > 0.05)} above 5%, "
          f"mean {sum(r[0] for r in rows) / len(rows):.2%}")


if __name__ == "__main__":
    main()
