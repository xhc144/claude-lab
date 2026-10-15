#!/bin/bash
# 从零生成《线性回归：从一条直线，到一次投影》：安装依赖 → 合成配音 → 渲染动画 → 合成成片
# 用法：bash build.sh                1080p 成片（需要配音接口，见 README）
#       JOBS=4 bash build.sh         并行渲染的场景数（默认 2）
#       SKIP_INSTALL=1 bash build.sh
#       PREVIEW=1 bash build.sh      不调接口，按字数估计时长，出 540p 无人声预览
set -e
cd "$(dirname "$0")"
JOBS=${JOBS:-2}
VENV=${VENV:-.venv}

if [ -z "$SKIP_INSTALL" ]; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends ffmpeg texlive-latex-base texlive-latex-extra \
    texlive-latex-recommended texlive-fonts-recommended texlive-science texlive-xetex texlive-lang-chinese \
    dvisvgm fonts-noto-cjk libpango1.0-dev libcairo2-dev pkg-config python3-venv python3-dev
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -r requirements.txt
fi
export PYTHON="$PWD/$VENV/bin/python"

cd src
if [ -n "$PREVIEW" ]; then
  "$PYTHON" tts.py --estimate
  Q=preview
else
  "$PYTHON" tts.py
  Q=hd
fi
printf "s4_projection.py Space\ns2_residual.py Residual\ns3_calculus.py Calculus\ns5_rest.py Galton\ns5_rest.py Beyond\ns4_projection.py Vectors\ns5_rest.py Pythagoras\ns5_rest.py Finale\ns1_opening.py Opening\n" \
  | xargs -P "$JOBS" -L 1 sh -c './render.sh "$0" "$1" '"$Q"
"$PYTHON" assemble.py $Q
