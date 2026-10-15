"""用 SenseVoice 语音识别回听每段配音，按字错误率排序，找出读错或含糊的段落。

    bash tools/fetch_models.sh asr && python tools/asr_check.py
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import sherpa_onnx
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[1]
M = ROOT / "build" / "models" / "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"
meta = json.loads((ROOT / "build" / "audio" / "durations.json").read_text())
rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(
    model=str(M / "model.int8.onnx"), tokens=str(M / "tokens.txt"), language="zh", use_itn=False, num_threads=4)
han = lambda s: re.sub(r"[^一-鿿]", "", s)


def cer(ref, hyp):
    d = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        prev, d[0] = d[0], i
        for j, h in enumerate(hyp, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (r != h))
    return d[-1] / max(len(ref), 1)


rows = []
for sid, m in meta.items():
    x, sr = sf.read(ROOT / "build" / "audio" / f"{sid}.wav", dtype="float32")
    s = rec.create_stream()
    s.accept_waveform(16000, resample_poly(x, 16000, sr).astype(np.float32))
    rec.decode_stream(s)
    hyp = han(s.result.text)
    rows.append((cer(han(m["text"]), hyp), sid, han(m["text"]), hyp))
rows.sort(reverse=True)
for e, sid, ref, hyp in rows[: int(sys.argv[1]) if len(sys.argv) > 1 else 15]:
    print(f"{sid} CER={e:.3f}\n  原文 {ref}\n  识别 {hyp}")
print("mean CER", round(float(np.mean([r[0] for r in rows])), 4))
