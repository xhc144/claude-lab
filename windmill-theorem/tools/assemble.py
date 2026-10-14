"""Concatenate the rendered scenes, place narration by the cue sheets, add the music bed and
burn in subtitles.

    python tools/assemble.py --lang zh [--crf 23] [--name windmill_zh]

Inputs : build/media_<lang>/videos/*/1080p30/S??_*.mp4, build/cues/<lang>/*.json,
         build/audio/<lang>/*.wav + manifest.json (optional: without it the video is music-only)
Outputs: output/<name>.mp4, output/<name>.srt (+ bilingual srt for en), build/<lang>/subs.ass
"""
import argparse
import json
import shutil
import subprocess

import numpy as np

from timeline import ROOT, SCENES, global_cues, scene_video
from music import SR, make_music
import subtitles


def run(cmd):
    print("$", " ".join(str(c) for c in cmd)[:220])
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, choices=["zh", "en"])
    ap.add_argument("--crf", type=int, default=24)
    ap.add_argument("--preset", default="slow")
    ap.add_argument("--name", default=None)
    ap.add_argument("--quality", default="1080p30", help="manim quality folder, e.g. 1080p30 or 480p15")
    a = ap.parse_args()
    import soundfile as sf

    lang = a.lang
    name = a.name or f"windmill_theorem_{lang}"
    work = ROOT / "build" / lang
    work.mkdir(parents=True, exist_ok=True)
    out = ROOT / "output"
    out.mkdir(exist_ok=True)

    # 1. concat scenes (stream copy)
    lst = work / "concat.txt"
    lst.write_text("".join(f"file '{scene_video(lang, m, s, a.quality)}'\n" for m, s in SCENES))
    vid = work / "video.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", vid])

    # 2. narration track
    cues, total, offsets = global_cues(lang, a.quality)
    audio_dir = ROOT / "build" / "audio" / lang
    man_p = audio_dir / "manifest.json"
    manifest = json.loads(man_p.read_text()) if man_p.exists() else {}
    voice = np.zeros(int(total * SR) + SR, np.float32)
    speech = []
    for line_id, t0, dur, scene in cues:
        wav = audio_dir / f"{line_id}.wav"
        if line_id in manifest and wav.exists():
            x, sr = sf.read(wav, dtype="float32")
            assert sr == SR, (wav, sr)
            s = int(t0 * SR)
            voice[s:s + len(x)] += x[: len(voice) - s]
            speech.append((t0, t0 + len(x) / SR))
        else:
            speech.append((t0, t0 + dur))
    has_voice = bool(manifest)
    voice = voice[: int(total * SR)]

    # 3. music bed, ducked under speech
    chapter_starts = [t for _, t, _ in offsets]
    mus = work / "music.wav"
    make_music(total, chapter_starts, speech, mus)
    m, _ = sf.read(mus, dtype="float32")
    if not has_voice:
        m = m * 1.6          # no narration yet: let the bed carry a little more
    mix = m.copy()
    mix[:, 0] += voice[: len(mix)]
    mix[:, 1] += voice[: len(mix)]
    peak = np.abs(mix).max()
    if peak > 0.98:
        mix *= 0.98 / peak
    mixp = work / "mix.wav"
    sf.write(mixp, mix, SR, subtype="PCM_16")

    # 4. subtitles
    subtitles.build(lang, work, a.quality)
    shutil.copy(work / f"subs_{lang}.srt", out / f"{name}.srt")
    if lang == "en":
        shutil.copy(work / "subs_en_zh.srt", out / f"{name}.en-zh.srt")

    # 5. final encode with burned-in subtitles
    final = out / f"{name}.mp4"
    tmp = work / f"{name}.encoding.mp4"     # encode outside output/, move when complete
    ass = str(work / "subs.ass").replace(":", r"\:")
    run(["ffmpeg", "-v", "error", "-y", "-i", vid, "-i", mixp,
         "-vf", f"ass={ass}", "-map", "0:v", "-map", "1:a",
         "-c:v", "libx264", "-preset", a.preset, "-crf", str(a.crf), "-tune", "animation", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", tmp])
    shutil.move(tmp, final)
    print(f"wrote {final}  ({total / 60:.1f} min, narration: {'yes' if has_voice else 'NO (music + subtitles only)'})")


if __name__ == "__main__":
    main()
