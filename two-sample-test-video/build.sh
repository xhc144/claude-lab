#!/bin/bash
# 从零生成《差了 3.3 分，算不算数》：安装依赖 → 下载语音模型 → 合成配音 → 渲染动画 → 合成成片
# 用法：bash build.sh            1080p 成片
#       JOBS=4 bash build.sh     并行渲染的场景数（默认 2）
#       SKIP_INSTALL=1 bash build.sh
set -e
cd "$(dirname "$0")"
JOBS=${JOBS:-2}
VENV=${VENV:-.venv}

if [ -z "$SKIP_INSTALL" ]; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends ffmpeg texlive-latex-base texlive-latex-extra \
    texlive-latex-recommended texlive-fonts-recommended texlive-science texlive-xetex texlive-lang-chinese \
    dvisvgm fonts-noto-cjk fonts-noto-cjk-extra libpango1.0-dev libcairo2-dev pkg-config
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -r requirements.txt
fi
export PYTHON="$PWD/$VENV/bin/python"

M=build/models
mkdir -p $M
R=https://github.com/k2-fsa/sherpa-onnx/releases/download
[ -d $M/kokoro-multi-lang-v1_1 ] || curl -L $R/tts-models/kokoro-multi-lang-v1_1.tar.bz2 | tar xj -C $M
if [ -n "$CHECK_VOICE" ] && [ ! -d $M/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 ]; then
  curl -L $R/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2 | tar xj -C $M
fi

cd src
"$PYTHON" tts.py
[ -n "$CHECK_VOICE" ] && "$PYTHON" tts.py --check
printf "s04_pooled.py PooledT\ns07_paired.py Paired\ns00_opening.py Opening\ns03_vardiff.py VarDiff\ns05_ftest.py FTest\ns08_prop.py Proportion\ns09_finale.py Finale\ns06_welch.py Welch\n" \
  | xargs -P "$JOBS" -L 1 sh -c './render.sh "$0" "$1" hd'
"$PYTHON" assemble.py hd
