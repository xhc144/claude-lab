#!/usr/bin/env bash
# 编译全部试卷：每份试卷生成试题卷与“参考答案及评分标准”两个版本，复制到 ../dist/；
# 不带参数时还编译设计说明（notes）和经济与社科速成讲义（lecture-econ-social）。
# 用法：bash build.sh            编译全部
#       bash build.sh r1-math1   只编译指定试卷
# 依赖：TeX Live 2023+（XeLaTeX、latexmk、ctex），中文字体 Noto CJK。
set -euo pipefail
cd "$(dirname "$0")"
out=../dist
mkdir -p "$out/questions" "$out/answers"

papers=("$@")
if [ ${#papers[@]} -eq 0 ]; then
  papers=(r1-math1 r1-math2 r1-physics
          r2-chinese r2-english r2-physics-plus r2-chemistry r2-biology r2-cs r2-economics r2-social
          r3-open)
fi

for p in "${papers[@]}"; do
  [ -f "$p.tex" ] || { echo "skip $p (no source)"; continue; }
  latexmk -xelatex -interaction=nonstopmode -halt-on-error "$p.tex" > "build-$p.log" 2>&1
  latexmk -xelatex -interaction=nonstopmode -halt-on-error -jobname="$p-answers" \
    -usepretex='\def\MojingAnswers{true}' "$p.tex" > "build-$p-answers.log" 2>&1
  cp "$p.pdf" "$out/questions/$p.pdf"
  cp "$p-answers.pdf" "$out/answers/$p-answers.pdf"
  echo "$p: $(pdfinfo "$p.pdf" | awk '/Pages/{print $2}') + $(pdfinfo "$p-answers.pdf" | awk '/Pages/{print $2}') pages"
done

if [ $# -eq 0 ]; then
  for n in notes lecture-econ-social; do
    [ -f "$n.tex" ] || continue
    latexmk -xelatex -interaction=nonstopmode -halt-on-error "$n.tex" > "build-$n.log" 2>&1
    cp "$n.pdf" "$out/$n.pdf"
    echo "$n: $(pdfinfo "$n.pdf" | awk '/Pages/{print $2}') pages"
  done
fi
