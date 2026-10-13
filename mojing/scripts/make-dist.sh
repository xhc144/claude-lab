#!/usr/bin/env bash
# =============================================================================
#  墨经 Mojing —— 打包“下载即用”的模板压缩包
#
#  每个模板打成一个自包含的 zip：示例源文件 + 所需的 .cls/.sty + latexmkrc + 说明。
#  解压后直接编译（latexmk main.tex），或上传到 Overleaf（编译器选 XeLaTeX）。
#
#  用法：scripts/make-dist.sh [--check]   （--check：解压到临时目录并实际编译验证）
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DIST="$ROOT/dist"
check=0; [ "${1:-}" = "--check" ] && check=1
mkdir -p "$DIST"
rm -f "$DIST"/*.zip

declare -A TITLE=(
  [notes]="数学讲义" [exercise]="习题与解答" [exam]="竞赛试卷"
  [paper]="数学论文" [book]="数学书籍" [translation]="翻译对照"
)

for t in notes exercise exam paper book translation; do
  stage=$(mktemp -d)
  dir="$stage/mojing-$t"
  mkdir -p "$dir"
  # 示例源文件（不含中间文件与编译结果）
  (cd "templates/$t" && find . -type f \
      \( -name '*.tex' -o -name '*.bib' -o -name '*.dat' -o -name '*.py' \) \
      -exec cp --parents {} "$dir/" \;)
  # 模板文件
  cp tex/mojing-core.sty tex/mojing-theorem.sty tex/mojing-math.sty tex/mojing-tikz.sty \
     "tex/mojing-$t.cls" "$dir/"
  cat > "$dir/latexmkrc" <<'RC'
# XeLaTeX 编译；latexmk 会自动调用 biber / makeindex
$pdf_mode = 5;
$xelatex = 'xelatex -interaction=nonstopmode -file-line-error -synctex=1 %O %S';
RC
  cat > "$dir/使用说明.txt" <<TXT
墨经 Mojing · ${TITLE[$t]}模板

本压缩包是自包含的：main.tex 为示例文档，mojing-*.cls / mojing-*.sty 为模板文件。

【本地编译】需要 TeX Live 2023 或更新版本（或 MiKTeX、MacTeX）：
    latexmk main.tex
  或者手动：xelatex main.tex（有参考文献时再运行 biber main，然后 xelatex 两遍）。

【Overleaf】新建项目 → Upload Project → 选择本 zip；
  然后在 Menu → Compiler 中选择 XeLaTeX，点 Recompile。

【字体】模板会自动选择中文字体：思源宋体 / Noto Serif CJK → macOS 宋体 → Windows 宋体 →
  TeX Live 自带的 Fandol。也可以用类选项强制指定，例如 \documentclass[cjk=fandol]{mojing-$t}。

完整文档：https://github.com/xhc144/claude-lab/tree/main/mojing
TXT
  (cd "$stage" && zip -qr "$DIST/mojing-$t.zip" "mojing-$t")
  printf '  dist/mojing-%-12s %6s\n' "$t.zip" "$(du -h "$DIST/mojing-$t.zip" | cut -f1)"

  if [ "$check" -eq 1 ]; then
    tdir=$(mktemp -d)
    (cd "$tdir" && unzip -q "$DIST/mojing-$t.zip" && cd "mojing-$t" \
      && env -u TEXINPUTS latexmk -interaction=nonstopmode main.tex >/dev/null 2>&1 \
      && echo "    验证通过：$(pdfinfo main.pdf | awk '/^Pages/{print $2}') 页") \
      || { echo "    验证失败：$t"; exit 1; }
    rm -rf "$tdir"
  fi
  rm -rf "$stage"
done
