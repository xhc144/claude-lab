#!/bin/bash
# 从零生成《统计的符号与术语》：安装依赖 → 合成配音 → 渲染动画 → 合成成片
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
    dvisvgm fonts-noto-cjk fonts-dejavu-core libpango1.0-dev libcairo2-dev pkg-config python3-venv python3-dev
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
# 长的场景先渲染
cat <<SCENES | xargs -P "$JOBS" -L 1 sh -c './render.sh "$0" "$1" '"$Q"
s08_testing.py Testing
s02_describe.py Spread
s07_estimation.py Estimation
s05_distributions.py Normal
s08_testing.py Errors
s01_population.py Population
s06_sampling.py Sampling
s04_random.py RandomVar
s09_regression.py Regression
s02_describe.py Describe
s05_distributions.py Discrete
s03_probability.py Probability
s03_probability.py Bayes
s05_distributions.py SamplingDists
s07_estimation.py Interval
s10_confusables.py Confusables
s09_regression.py Models
s10_confusables.py Glossary
s11_finale.py Finale
s00_opening.py Opening
SCENES
"$PYTHON" assemble.py $Q
