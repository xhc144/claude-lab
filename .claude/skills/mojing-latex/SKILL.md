---
name: mojing-latex
description: 使用“墨经 Mojing”原生 LaTeX 模板制作中文数学讲义、习题与解答、竞赛试卷、论文、书籍及翻译对照。用于用户指定墨经/mojing 模板、选择或初始化六种墨经文档类、生成学生版/答案版/解答附后/双栏等变体，以及修改和检查已有墨经项目；保留原始宏、字体及版式，使用 XeLaTeX/latexmk 并检查 PDF。
---

# 墨经 LaTeX 模板

## 工作流程

1. 尊重用户当前明确指定的模板。仅在采用墨经的任务中使用本技能；不要替代 Yii.I.、ElegantBook、王者版式或用户另行指定的模板。
2. 阅读 [模板选择与变体](references/template-selection.md)，按用途选择 `notes`、`exercise`、`exam`、`paper`、`book` 或 `translation`。先查看已有项目，避免重新初始化或覆盖用户文件。
3. 在新的、尚不存在的项目目录中运行初始化脚本；以本技能实际目录替换 `$SKILL_DIR`，不要假定安装路径固定：
   ```bash
   python3 "$SKILL_DIR/scripts/init_project.py" notes /existing/parent/new-project
   python3 "$SKILL_DIR/scripts/init_project.py" exercise /existing/parent/student-sheet --variant student
   ```
   脚本只复制已验证的资源，不编译、不联网、不上传；拒绝已有目录、文件及符号链接目标。父目录必须已存在。
4. 阅读 [类与宏接口](references/api.md) 中所选模板的部分。在项目副本中编辑 `main.tex`、章节、参考文献或数据；保留 `.cls`、`.sty`、字体方案及原生环境，优先使用公开选项。不要凭记忆重写类或随意改全局页边距、字体和定理样式。
5. 将中文、公式、定理与证明写成可编辑 TeX；不要用文字或公式截图代替正文。仅按授权使用真实作者、单位、引文、分值和版权信息；删除或替换示例中的虚构信息。译文段落与原文保持配对。
6. 按 [编译与质量检查](references/compilation.md) 先检查依赖，再在项目目录中用 XeLaTeX/latexmk 编译。论文/书籍按需调用 biber，书籍检查索引。缺工具、宏包或字体时报告具体缺项，不声称编译成功。
7. 渲染并查看 PDF，检查重叠、缺字、公式断行、图形、旁注、页码、参考文献和链接；检查所需变体的答案显隐与对照对齐。修复后重新编译、复查，并交付源码及用户需要的 PDF。

## 资源与边界

- `assets/templates/<类型>/`：由上游自包含 ZIP 提取的六套完整资源；保留书籍分章、论文数据和 bib 依赖，不包含重复 README 或预览 PDF。
- `scripts/init_project.py`：安全复制模板，支持版本选项，写入 `mojing-project.json` 记录来源与选择。
- `scripts/check_deps.py`：只读前置检查；实际编译与视觉检查仍不可省略。
- [来源与许可](references/provenance.md)：查看准确来源、版本及已发现的许可声明；`references/source-manifest.json` 保存 ZIP 与资产校验值。
- 不把此技能视为提交、上传、发布、共享、软件安装、权限变更或接受协议的授权。此类操作继续遵循当前任务和适用确认要求。
