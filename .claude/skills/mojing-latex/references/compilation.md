# 编译与质量检查

## 前置检查

上游要求 TeX Live 2023 或更新版本、XeLaTeX、latexmk；论文和书籍还需 biber，书籍需 makeindex。上游推荐 scheme-full；MacTeX/MiKTeX 可在安装等价宏包及字体后使用。不得仅因有 `xelatex` 就判断环境完整。

```bash
python3 "$SKILL_DIR/scripts/check_deps.py" notes
python3 "$SKILL_DIR/scripts/check_deps.py" book
# 修改字体方案后对照相同配置检查
python3 "$SKILL_DIR/scripts/check_deps.py" paper --latin termes --cjk fandol
```

检查脚本逐项检测工具、XeLaTeX 格式文件、模板声明的宏包、默认/所选西文字体文件及 bibliography 样式。`cjk=auto` 的系统字体检测要在实际编译时确认；`--cjk fandol` 强制检查所有回退字体文件。脚本不分析用户后续追加的包和字体，也不安装软件。返回 1 表示缺依赖，返回 2 表示检测运行失败；0 仅表示所检查的基础依赖存在。

主要依赖：ctex/fontspec/xeCJK、unicode-math、amsmath/mathtools/amsthm、tcolorbox、TikZ/pgfplots、geometry、enumitem、booktabs、caption、hyperref/cleveref；论文/书籍用 biblatex-gb7714-2015，book 用 imakeidx，translation 用 paracol。详细缺项以检查输出和编译日志为准。

缺依赖时报告工具/包/字体的实际名字和阻塞步骤；可交付已准备好的源项目，并说明 PDF 尚未验证。不要自动安装系统软件或把上游预览 PDF 当成本次编译结果。

## 正常编译

每个资产目录已自包含所需 `.cls`/`.sty`，其 `latexmkrc` 设置 `$pdf_mode = 5`。无需原仓库的 `../../tex` 或全局 TEXINPUTS，也不必安装类到全局 texmf。

在项目目录执行：

```bash
latexmk -xelatex -interaction=nonstopmode -file-line-error -halt-on-error main.tex
```

由 latexmk 处理交叉引用及 biber/makeindex 的多轮编译。若书籍索引仍未生成，检查 `.idx`、`.ist`、`.ind` 和日志，再执行：

```bash
makeindex -s mojing-book.ist main.idx
latexmk -xelatex -interaction=nonstopmode -file-line-error -halt-on-error main.tex
```

若使用不同 jobname，索引输入同样改为该 jobname 的 `.idx`。biber 手工运行时使用输出主名，如 `biber main`，之后重编译。不要对所有类型盲目运行 biber，也不要为解决宏包缺失开启 `-shell-escape`。已有编译产物保持版本区分，必要时将各版本放不同目录。

## 检查日志与 PDF

1. 确认命令退出码为 0，输出 PDF 真实存在且与当前源码/变体匹配。
2. 检查 `.log`、`.blg`、索引日志中的错误、missing characters、字体替换、undefined references/citations、overfull hbox/vbox 等。消除错误和明显布局问题；必要的警告应如实解释。
3. 使用 `pdfinfo` 核对页数/尺寸，`pdffonts` 查看中文、数学及西文字体和嵌入；用 `pdftotext` 辅助确认题目、答案显隐、页码及文献。
4. 用 `pdftoppm` 等工具渲染为图像；实际打开检查图像，而不是把“成功渲染”当成“已视觉检查”。查看封面、目录、普通正文、密集公式、跨页定理、图表、答案、参考文献及特殊版式页；短文档检查全部页，长文档检查所有含特殊元素或日志警告的页并适当抽查正文。
5. 检查文字和公式有无重叠、裁切、缺字、异常基线、过宽公式及字体替换；图表、旁注、页眉页脚是否冲突；检查目录/交叉引用/URL/DOI链接确实指向正确对象。
6. 习题学生版确认解答不泄露（提示按原设计仍可显示），key 版确认文末解答完整；试卷答案版检查选择填空、解析、分值及总页数；书籍检查章起页、索引排序和页码；翻译检查段落配对、页边编号、原注与译注。
7. 修复后重编译，再次检查受影响页。最终分别说明“初始化”“依赖检查”“编译”“视觉/字体/链接检查”哪些已完成，哪些仍受阻。

示例渲染命令：`pdftoppm -r 120 -png main.pdf /existing/output/main`。渲染图片用于审查；交付正文保留 TeX 和 PDF，不把内容转换成截图式文档。
