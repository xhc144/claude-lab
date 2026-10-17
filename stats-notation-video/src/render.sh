#!/bin/bash
# render.sh 文件 场景 [hd|pv]：默认 960×540 预览，hd 为 1920×1080 成片，pv 为 480×270 快速检查
# 每个场景用自己的 media 目录，几个场景并行渲染时 LaTeX 缓存不会互相覆盖
cd "$(dirname "$0")"
res=960,540; [ "$3" = hd ] && res=1920,1080; [ "$3" = pv ] && res=480,270
PY=${PYTHON:-python3}
"$PY" -m manim -r $res --media_dir "../build/media/$2" --disable_caching "$1" "$2" 2>&1 | grep -E "Error|error|Traceback|File ready|line [0-9]+" | tail -12
