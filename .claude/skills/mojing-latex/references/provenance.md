# 来源与许可

- 来源仓库：[xhc144/claude-lab](https://github.com/xhc144/claude-lab)
- 固定来源版本：`35a5afc2524a4162e28a9cd9de3b9e1d32f61a0a`
- 来源子目录：[mojing](https://github.com/xhc144/claude-lab/tree/35a5afc2524a4162e28a9cd9de3b9e1d32f61a0a/mojing)
- 取材日期：2026-10-13 UTC
- 资源：该版本 `mojing/dist/mojing-{notes,exercise,exam,paper,book,translation}.zip`；六份 ZIP 的源文件均按原始字节保留。
- 接口与版本依据：该版本的 [README.md](https://github.com/xhc144/claude-lab/blob/35a5afc2524a4162e28a9cd9de3b9e1d32f61a0a/mojing/README.md)、[build.sh](https://github.com/xhc144/claude-lab/blob/35a5afc2524a4162e28a9cd9de3b9e1d32f61a0a/mojing/build.sh) 以及类/包实际代码。

## 已观察到的许可状态

上游 README 的“许可”节声明 `tex/` 模板文件以 [LPPL 1.3c](https://www.latex-project.org/lppl/lppl-1-3c/) 发布；六个类和四个公共包的头部同样明确声明 LPPL 1.3c。本技能保留这些原始声明，不擅自改变模板许可证。

README 另称“示例文档可以自由使用”，但所检查版本的仓库树没有独立 LICENSE/COPYING/NOTICE 文件，也未找到将示例文档明确归为某个命名许可证的声明。不要因此推定整个仓库或示例均采用 MIT、Apache、CC 或 LPPL。再分发、公开发布或修改模板时应遵守可核实的上游条款；如需要未声明的权利，应向权利人确认。

上游说明示例的作者、单位、期刊名、出版社、书号和基金编号虚构，替换后再交付正式文档。上游称翻译示例的英文来自 M. W. Newson 1902 年英译本、属于公有领域；中文译文与译注是上游为示例所作。此处记录上游说明，不扩大到所有翻译素材或用户资料。

## 资产完整性

`source-manifest.json` 记录六份原 ZIP 的 SHA-256 和每个保留文件的 SHA-256。初始化脚本在写目标前核验文件集合及校验值。移除重复 `README.txt`，不加入上游 PDF/PNG 预览、构建中间文件或全仓库构建脚本；保留每类必需类/包、`main.tex`、自包含 `latexmkrc`，以及 paper 的 bib/data 和 book 的 bib/chapters。

更新上游资产时重新核实版本、许可和变体，更新清单，并重新执行初始化、依赖和编译检查。不要只替换类文件而漏掉公共包或章节/数据依赖。
