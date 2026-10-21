# 第三方文件

- `katex/`：[KaTeX](https://katex.org/) 0.16.22（MIT 许可，见 `katex/LICENSE.txt`），取自 npm 包 `katex@0.16.22` 的 `dist/`。
  只保留 `katex.min.js`、`katex.min.css` 与 `fonts/*.woff2`；`katex.min.css` 删掉了 `.woff` / `.ttf` 两种后备字体的 `url(...)`，
  因为所有现代浏览器都支持 woff2，站点也只发布 woff2。构建脚本在 Node 里加载同一份 `katex.min.js` 来校验知识库中的每条公式。
