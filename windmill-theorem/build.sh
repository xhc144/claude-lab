#!/usr/bin/env bash
# Build the videos.
#   bash build.sh [zh|en|all] [preview|final] [render|assemble|both]
# Environment:
#   PY=python  MANIM=manim  JOBS=4  PRESET=slow  CRF=24
#   ONLY="S06_Windmill S07_Proof"   render only these scenes
#   TTS_ZH=<dir of vits-melo-tts-zh_en>  TTS_EN=<dir of kokoro-en-v0_19>   (optional; without them the
#   timing is estimated and the video carries music + subtitles only)
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-python3}
MANIM=${MANIM:-manim}
JOBS=${JOBS:-4}
WHICH=${1:-all}
MODE=${2:-final}
STEP=${3:-both}
if [ "$MODE" = preview ]; then QFLAG="-ql"; QDIR="480p15"; else QFLAG="-qh --fps 30"; QDIR="1080p30"; fi
LANGS=$([ "$WHICH" = all ] && echo "zh en" || echo "$WHICH")

$PY tools/make_bg.py build/bg.png >/dev/null
mkdir -p build/logs

for L in $LANGS; do
  if [ "$STEP" != assemble ]; then
    if [ "$L" = zh ] && [ -n "${TTS_ZH:-}" ]; then $PY tts/synth.py --lang zh --model-dir "$TTS_ZH"; fi
    if [ "$L" = en ] && [ -n "${TTS_EN:-}" ]; then $PY tts/synth.py --lang en --model-dir "$TTS_EN"; fi
    echo "== rendering $L ($QDIR) with $JOBS jobs"
    ONLY="${ONLY:-}" $PY - <<PYEOF | xargs -P "$JOBS" -L1 sh -c "WT_LANG=$L $MANIM $QFLAG --media_dir build/media_$L/\$1 anim/\$0.py \$1 > build/logs/${L}_\$1.txt 2>&1 && echo rendered \$1 || echo FAILED: \$1"
import os, sys; sys.path.insert(0, 'tools')
from timeline import SCENES
# longest scenes first so the parallel jobs finish together
order = ["S10_Interview", "S09_Beyond", "S06_Windmill", "S07_Proof", "S04_Pairing", "S05_SetSwap",
         "S08_Insight", "S00_Open", "S01_History", "S11_Outro", "S03_Necessity", "S02_Statement"]
only = os.environ.get("ONLY", "").split()
mod = dict((s, m) for m, s in SCENES)
for s in order:
    if not only or s in only:
        print(mod[s], s)
PYEOF
  fi
  if [ "$STEP" != render ]; then
    $PY tools/assemble.py --lang "$L" --quality "$QDIR" --preset "${PRESET:-slow}" --crf "${CRF:-24}"
  fi
done
