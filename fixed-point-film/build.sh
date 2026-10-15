#!/usr/bin/env bash
# Full pipeline: narration -> music/mix -> frames -> final mp4 + srt.
#   bash build.sh            # both languages
#   bash build.sh en         # one language
# PYTHON must have kokoro-onnx + misaki[en,zh] (Python 3.12, see README).
set -euo pipefail
cd "$(dirname "$0")"
PY=${PYTHON:-python3}
for lang in ${@:-en zh}; do
  "$PY" tts.py "$lang"
  python3 music.py "$lang"
  node scripts/render.mjs "$lang"
  node scripts/finish.mjs "$lang"
done
