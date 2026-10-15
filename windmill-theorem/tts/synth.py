"""Synthesize the narration with sherpa-onnx (offline neural TTS).

    zh : MeloTTS  (sherpa-onnx "vits-melo-tts-zh_en": model.onnx, lexicon.txt, tokens.txt, *.fst)
    en : Kokoro   (sherpa-onnx "kokoro-en-v0_19" or "kokoro-multi-lang-v1_*": model.onnx, voices.bin,
                   tokens.txt, espeak-ng-data/ [, lexicon-*.txt])

Usage
    python tts/synth.py --lang zh --model-dir models/vits-melo-tts-zh_en
    python tts/synth.py --lang en --model-dir models/kokoro-en-v0_19 --speed 0.86

Writes build/audio/<lang>/<line_id>.wav (48 kHz mono) and build/audio/<lang>/manifest.json:
    {line_id: {"dur": seconds, "sents": [[start, end], ...], "spk": speaker}}
The animation reads the manifest, so every animation beat follows the real speech.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from content.script import lines_for, sentences, spoken  # noqa: E402

GAP = {"zh": 0.28, "en": 0.40}           # pause between sentences of one line
SR = 48000
# Kokoro speaker ids (kokoro-en-v0_19 order). Override with --voices '{"narrator": 6, ...}'.
KOKORO_EN = {"narrator": 6,     # am_michael
             "interviewer": 9,  # bm_george
             "candidate": 3}    # af_sarah


def build_tts(lang, d, threads):
    import sherpa_onnx as so
    d = Path(d)
    if lang == "zh":
        fsts = ",".join(str(d / f) for f in ("phone.fst", "date.fst", "number.fst") if (d / f).exists())
        model = so.OfflineTtsModelConfig(
            vits=so.OfflineTtsVitsModelConfig(model=str(d / "model.onnx"), lexicon=str(d / "lexicon.txt"),
                                              tokens=str(d / "tokens.txt")),
            num_threads=threads)
        cfg = so.OfflineTtsConfig(model=model, rule_fsts=fsts, max_num_sentences=1)
    else:
        lex = ",".join(str(p) for p in sorted(d.glob("lexicon*.txt")))
        kk = so.OfflineTtsKokoroModelConfig(model=str(d / "model.onnx"), voices=str(d / "voices.bin"),
                                            tokens=str(d / "tokens.txt"), data_dir=str(d / "espeak-ng-data"),
                                            lexicon=lex)
        model = so.OfflineTtsModelConfig(kokoro=kk, num_threads=threads)
        cfg = so.OfflineTtsConfig(model=model, max_num_sentences=1)
    return so.OfflineTts(cfg)


def trim(x, sr, thr=0.012, keep=0.04):
    a = np.abs(x)
    idx = np.where(a > thr * max(1e-9, a.max()))[0]
    if len(idx) == 0:
        return x
    k = int(keep * sr)
    return x[max(0, idx[0] - k): min(len(x), idx[-1] + k)]


def resample(x, sr):
    if sr == SR:
        return x.astype(np.float32)
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
                        "-af", "aresample=resampler=soxr" if _has_soxr() else "aresample",
                        "-ar", str(SR), "-f", "f32le", "pipe:1"], input=x.astype(np.float32).tobytes(),
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32)


_SOXR = None


def _has_soxr():
    global _SOXR
    if _SOXR is None:
        out = subprocess.run(["ffmpeg", "-hide_banner", "-buildconf"], capture_output=True, text=True).stdout
        _SOXR = "--enable-libsoxr" in out
    return _SOXR


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, choices=["zh", "en"])
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--speed", type=float, default=None, help="zh default 1.0, en default 0.86 (slower for shadowing)")
    ap.add_argument("--voices", default=None, help="JSON speaker->sid map for Kokoro")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--only", nargs="*", default=None, help="line ids to (re)synthesize")
    a = ap.parse_args()
    speed = a.speed or (1.0 if a.lang == "zh" else 0.86)
    voices = json.loads(a.voices) if a.voices else KOKORO_EN
    out = ROOT / "build" / "audio" / a.lang
    out.mkdir(parents=True, exist_ok=True)
    man_p = out / "manifest.json"
    manifest = json.loads(man_p.read_text()) if man_p.exists() else {}
    tts = build_tts(a.lang, a.model_dir, a.threads)
    import soundfile as sf
    for line in lines_for(a.lang):
        if a.only and line.id not in a.only:
            continue
        sid = 0 if a.lang == "zh" else voices.get(line.spk, voices["narrator"])
        pieces, sents, t = [], [], 0.0
        for k, (txt, _) in enumerate(sentences(line, a.lang)):
            audio = tts.generate(spoken(txt), sid=sid, speed=speed)
            x = trim(np.asarray(audio.samples, dtype=np.float32), audio.sample_rate)
            x = resample(x, audio.sample_rate)
            if k:
                pieces.append(np.zeros(int(GAP[a.lang] * SR), np.float32))
                t += GAP[a.lang]
            pieces.append(x)
            sents.append([round(t, 3), round(t + len(x) / SR, 3)])
            t += len(x) / SR
        y = np.concatenate(pieces)
        rms = np.sqrt(np.mean(y ** 2)) + 1e-9
        y = y * (0.1 / rms)                       # about -20 dBFS RMS
        peak = np.abs(y).max()
        if peak > 0.95:
            y *= 0.95 / peak
        sf.write(out / f"{line.id}.wav", y, SR, subtype="PCM_16")
        manifest[line.id] = {"dur": round(len(y) / SR, 3), "sents": sents, "spk": line.spk}
        print(f"{line.id:8s} {len(y) / SR:6.2f}s  {len(sents)} sentence(s)")
        man_p.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    total = sum(v["dur"] for v in manifest.values())
    print(f"total narration {total / 60:.1f} min -> {man_p}")


if __name__ == "__main__":
    main()
