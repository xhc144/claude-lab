#!/bin/bash
# Build the whole film from source: frames, soundtrack, edit + encode.
set -e
cd "$(dirname "$0")"
./render_all.sh                                   # HDR frames (resumable)
python3 -m audio.score out/score.wav              # music + sound design
python3 edit.py --audio out/score.wav --out out/the_sea_above.mp4
