#!/usr/bin/env bash
# 一键生成《对称的语言》抽象代数宣传片
#
#   bash build.sh            # 正式版：1920x1080 30fps，约 30 分钟（4 核）
#   bash build.sh preview    # 预览版：960x540 15fps，约 5 分钟
#
# 环境变量：
#   SKIP_INSTALL=1   跳过 apt / pip 安装（依赖已装好时用）
#   PYTHON=python3   指定 Python 解释器
#   JOBS=4           并行渲染进程数（默认 = CPU 核数）
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-final}"
PY="${PYTHON:-python3}"
JOBS="${JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}"

step() { printf '\n==> %s\n' "$*"; }

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  if command -v apt-get >/dev/null 2>&1; then
    step "安装系统依赖（ffmpeg、libEGL、字体）"
    SUDO=""
    if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq ffmpeg libegl1 fontconfig \
      fonts-noto-cjk fonts-ebgaramond fonts-lmodern fonts-dancingscript fonts-inter fonts-dejavu-core
  elif command -v brew >/dev/null 2>&1; then
    step "安装 ffmpeg（Homebrew）；字体请按 使用说明.md 手动安装，缺失时会自动用替代字体"
    brew install ffmpeg || true
  else
    echo "未找到 apt-get / brew：请自行安装 ffmpeg 和 使用说明.md 中列出的字体" >&2
  fi
  step "安装 Python 依赖"
  "$PY" -m pip install -q -r requirements.txt
fi

command -v ffmpeg >/dev/null 2>&1 || { echo "错误：找不到 ffmpeg" >&2; exit 1; }
mkdir -p output cache

step "1/3 预计算（雪花生长模拟 + 约 1.7 亿个多项式根），首次约 4–5 分钟，结果缓存在 cache/"
"$PY" -c "import render; render.prepare()"

step "2/3 合成配乐 -> output/soundtrack.wav（约 15 秒）"
"$PY" -m studio.audio output/soundtrack.wav

if [ "$MODE" = "preview" ]; then
  OUT=output/preview.mp4
  step "3/3 渲染预览版 -> $OUT"
  "$PY" render.py video --scale 0.5 --step 2 --crf 24 --preset veryfast --jobs "$JOBS" \
    --audio output/soundtrack.wav --out "$OUT"
else
  OUT=output/abstract_algebra_promo_1080p.mp4
  step "3/3 渲染正式版 -> $OUT"
  "$PY" render.py video --scale 1 --crf 19 --preset slow --jobs "$JOBS" \
    --audio output/soundtrack.wav --out "$OUT"
fi

step "完成"
if command -v ffprobe >/dev/null 2>&1; then
  ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of compact "$OUT"
fi
ls -lh "$OUT"
