#!/usr/bin/env bash
# 低清预览某个场景文件里的若干场景，并为每个场景生成缩略图：tools/preview.sh scenes/s1_extrema.py S1A S1B
set -u
cd "$(dirname "$0")/.."
file=$1; shift
mod=$(basename "$file" .py)
for sc in "$@"; do
  ( PYTHONPATH=scenes /root/mvenv/bin/manim -ql --disable_caching --media_dir build/media "$file" "$sc" > "build/render_$sc.log" 2>&1 \
    && /root/mvenv/bin/python tools/contact.py "$sc" "build/media/videos/$mod/480p15/$sc.mp4" > /dev/null \
    && echo "$sc ok" || { echo "$sc FAILED"; grep -E "Error|Exception" "build/render_$sc.log" | tail -3; } ) &
done
wait
