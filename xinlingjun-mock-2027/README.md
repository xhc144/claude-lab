# 2027 新领军学科能力一试 · 预测训练卷

按 2027 年新领军考纲（数学 1、数学 2、物理）编写的一份模拟训练卷，含完整答案与审核记录。它不是官方试题；官方尚未公布一试的题量、时长和分值，卷面安排均为训练设置。

| 文件 | 内容 |
| --- | --- |
| [paper.md](paper.md) · [PDF](dist/paper.pdf) | 学生版题面：数学 9 题、物理 3 题 |
| [solutions.md](solutions.md) · [PDF](dist/solutions.pdf) | 答案速查、逐题详解、评分要点 |
| [design-notes.md](design-notes.md) · [PDF](dist/design-notes.pdf) | 考纲覆盖、每题的关键观察与融合检验、与历年真题的关系、独立审核记录、使用建议 |

建议先只打印 `paper.pdf` 限时作答（数学 4.5 小时，物理 1.5 小时），再对照答案。

## 重新生成 PDF

需要 Node.js 22 和 Playwright 的 Chromium。

```bash
npm ci
npm run build            # 生成 dist/*.pdf
node build.mjs paper.md  # 只生成某一份
```

公式用 KaTeX 渲染，中文字体为 Noto Serif SC / Noto Sans SC（随 npm 依赖安装）。在源文件中写 `<!-- pagebreak -->` 可强制分页。
