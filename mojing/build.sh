#!/usr/bin/env bash
# =============================================================================
#  墨经 Mojing —— 一键编译全部模板
#
#  用法：
#    ./build.sh            编译全部模板及其各种版本，PDF 输出到 previews/
#    ./build.sh notes      只编译某一个模板（notes / exercise / exam / paper / book / translation）
#    ./build.sh --png      同时生成 previews/png/ 下的预览图（需要 pdftoppm 与 ImageMagick）
#    ./build.sh --clean    清除各模板目录中的中间文件
#
#  依赖：TeX Live 2023 或更新版本（含 XeLaTeX、latexmk、biber），
#        字体见 README。
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(pwd)
OUT="$ROOT/previews"
export TEXINPUTS="$ROOT/tex//:${TEXINPUTS:-}"

want_png=0
targets=()
for arg in "$@"; do
  case "$arg" in
    --png)   want_png=1 ;;
    --clean)
      for d in templates/*/; do (cd "$d" && latexmk -C -silent >/dev/null 2>&1 || true); done
      find templates -name 'missfont.log' -delete
      find templates -name '*.ist' -delete
      echo "已清除中间文件。"; exit 0 ;;
    *)       targets+=("$arg") ;;
  esac
done
[ ${#targets[@]} -eq 0 ] && targets=(notes exercise exam paper book translation)

mkdir -p "$OUT"

# build <模板目录> <输出名> [预先执行的 TeX 代码]
build() {
  local dir=$1 name=$2 pre=${3:-}
  local args=(-xelatex -interaction=nonstopmode -file-line-error -halt-on-error
              -jobname="$name")
  [ -n "$pre" ] && args+=(-usepretex="$pre")
  printf '  %-26s' "$name.pdf"
  if (cd "templates/$dir" && latexmk "${args[@]}" main.tex >/dev/null 2>&1); then
    cp "templates/$dir/$name.pdf" "$OUT/$name.pdf"
    printf '%3s 页\n' "$(pdfinfo "$OUT/$name.pdf" 2>/dev/null | awk '/^Pages/{print $2}')"
  else
    echo "失败，详见 templates/$dir/$name.log"
    exit 1
  fi
}

for t in "${targets[@]}"; do
  echo "[$t]"
  case "$t" in
    notes)       build notes notes ;;
    exercise)    build exercise exercise
                 build exercise exercise-student '\def\MojingAnswers{none}'
                 build exercise exercise-key     '\def\MojingAnswers{end}' ;;
    exam)        build exam exam
                 build exam exam-answers '\def\MojingAnswers{true}' ;;
    paper)       build paper paper ;;
    book)        build book book ;;
    translation) build translation translation
                 build translation translation-columns '\def\MojingLayout{columns}' ;;
    *) echo "未知模板：$t"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# 预览图：每个模板挑选若干页并排拼成一张图
# ---------------------------------------------------------------------------
if [ "$want_png" -eq 1 ]; then
  command -v pdftoppm >/dev/null && command -v montage >/dev/null || {
    echo "生成预览图需要 pdftoppm（poppler）与 montage（ImageMagick）"; exit 1; }
  mkdir -p "$OUT/png"
  tmp=$(mktemp -d)
  # strip <pdf 名> <输出名> <页码…>
  strip() {
    local pdf=$1 name=$2; shift 2
    local files=()
    for p in "$@"; do
      pdftoppm -r 72 -png -f "$p" -l "$p" -singlefile "$OUT/$pdf.pdf" "$tmp/$name-$p"
      files+=("$tmp/$name-$p.png")
    done
    montage "${files[@]}" -tile "${#files[@]}x1" -geometry +10+10 \
      -background '#e9e6df' "$OUT/png/$name.png"
    echo "  png/$name.png"
  }
  echo "[预览图]"
  [ -f "$OUT/notes.pdf" ]               && strip notes notes 1 2 3 7
  [ -f "$OUT/exercise.pdf" ]            && strip exercise exercise 1 3
  [ -f "$OUT/exercise-student.pdf" ]    && strip exercise-student exercise-student 1
  [ -f "$OUT/exam.pdf" ]                && strip exam exam 1 2 4
  [ -f "$OUT/exam-answers.pdf" ]        && strip exam-answers exam-answers 3
  [ -f "$OUT/paper.pdf" ]               && strip paper paper 1 3 4
  [ -f "$OUT/book.pdf" ]                && strip book book 3 7 13 14
  [ -f "$OUT/translation.pdf" ]         && strip translation translation 1 8 9
  [ -f "$OUT/translation-columns.pdf" ] && strip translation-columns translation-columns 6
  rm -rf "$tmp"
fi
echo "完成。PDF 位于 previews/。"
