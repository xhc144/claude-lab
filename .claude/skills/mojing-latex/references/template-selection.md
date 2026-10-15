# 模板选择与变体

以用户的文档用途及现有项目为准；若已指定类型或模板，不再替换。下表的版式和 API 来自绑定版本的 README、build.sh 及类文件。

| 类型 | 类名 | 首选用途 | 原生版式与默认值 |
| --- | --- | --- | --- |
| `notes` | `mojing-notes` | 课程讲义、读书笔记、讨论班记录 | A4 单面；134 mm 正文及 38 mm 旁注栏；按“讲”编号；黛蓝 |
| `exercise` | `mojing-exercise` | 习题课、作业、题解 | A4 单面；左侧悬挂题号、难度星级；松绿；解答随题 |
| `exam` | `mojing-exam` | 竞赛、考试、模拟卷 | A4 单面；密封线、得分栏、独立试卷页码；试题全黑 |
| `paper` | `mojing-paper` | 数学论文、预印本 | A4 双面；期刊式首页；定理正文楷体；GB/T 7714 文献 |
| `book` | `mojing-book` | 教材、专著 | 16 开 185 × 260 mm 双面；奇数页起章；朱砂；西文 Pagella |
| `translation` | `mojing-translation` | 译著、英汉对照读本 | 170 × 240 mm 双面；左页原文、右页译文；赭石；西文 Pagella |

## 初始化脚本选项

```bash
python3 "$SKILL_DIR/scripts/init_project.py" <类型> <新目录> [--variant <版本>]
```

| 类型 | `--variant` 值 | 实际配置 |
| --- | --- | --- |
| notes/paper/book | `default`（默认） | 原示例不作版本更改 |
| exercise | `teacher`（默认） | `answers=inline`，解答随题 |
| exercise | `student` | 在源文件前设置 `\MojingAnswers{none}`，保留题目、提示及设定的作答空间 |
| exercise | `key` | 设置 `\MojingAnswers{end}`；正文末须保留 `\printsolutions` |
| exam | `questions`（默认） | 原试题卷，隐藏解析与评分说明 |
| exam | `answers` | 设置 `\MojingAnswers{true}`，显示答案、解析与评分点 |
| translation | `facing`（默认） | 左右对页 |
| translation | `columns` | 设置 `\MojingLayout{columns}`，A4 同页双栏 |
| translation | `interleave` | 设置 `\MojingLayout{interleave}`，逐段上下对照 |
| translation | `target` | 设置 `\MojingLayout{target}`，仅译文 |

上表“设置”通过在 `main.tex` 前置固定的 `\def` 完成，不修改模板类。要改同一项目的默认版本，编辑这条前置定义；不要再在命令行重复定义并期待覆盖，因为源文件中的定义会后执行。

## 同一源文件生成多个版本

对未前置版本定义的默认项目，可使用上游真实覆盖接口和不同 `jobname`，避免各版互相覆盖：

```bash
# exercise
latexmk -xelatex -jobname=main-student -usepretex='\def\MojingAnswers{none}' main.tex
latexmk -xelatex -jobname=main-key -usepretex='\def\MojingAnswers{end}' main.tex
# exam
latexmk -xelatex -jobname=main-answers -usepretex='\def\MojingAnswers{true}' main.tex
# translation
latexmk -xelatex -jobname=main-columns -usepretex='\def\MojingLayout{columns}' main.tex
```

绑定版本的 `build.sh` 默认生成六类、十份 PDF：notes；exercise 三版；exam 两版；paper；book；translation 的 facing/columns 两版。`interleave` 与 `target` 由 README 和类文件支持，但不在上游默认批量构建列表中；本技能不据此声称这两版已在当前环境编译通过。

## 更多类选项

在项目的 `\documentclass[...]` 中配置：notes 的 `twoside`/`nomargin`，exam 的 `seal=odd|all|first|none`，paper 的 `thmstyle=kai|song`、`preprint`、`enabstract=front|end`、`oneside`，book 的 `openany`。通用 `cjk`/`latin`/`zihao`/`accent`/`print` 等见 [接口](api.md)。初始化脚本只接受真实的模板及版本名，不接受任意代码或任意类选项。
