#!/usr/bin/env bash
# One-shot build: narration -> scenes -> films -> transcript.
#   bash build/make.sh            # both languages
#   bash build/make.sh zh         # one language
# Needs: python env from README (manim, sherpa-onnx, ...), ffmpeg with libass, models/ (see README).
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-python}
LANGS=${*:-zh en}

$PY tts/synth.py $LANGS
for l in $LANGS; do
  $PY build/render_all.py "$l" --jobs "${JOBS:-4}"
  $PY build/assemble.py "$l"
done
$PY build/transcript.py
