# 墨誊 Moteng · AI 对话网页 → LaTeX / PDF

墨誊 Moteng 是一个 Windows 桌面软件。它读入浏览器保存的 AI 对话网页，生成 LaTeX 源码 `main.tex`，再编译成 PDF。支持 ChatGPT、Claude、Gemini、DeepSeek 等十四个网站。“誊”是誊写：把网页上的对话誊成一份能编辑、能打印的 TeX 文档。

公式不经过截图或 OCR。KaTeX、MathJax 渲染网页公式时，会在页面里保留原始 TeX 源码（`<annotation encoding="application/x-tex">`、`data-math` 等）；墨誊直接读这些源码，再改写成 XeLaTeX 能编译的形式。

## 使用

1. 在浏览器里打开对话，先滚动到最上面，让整段对话都加载出来。
2. 按 <kbd>Ctrl</kbd>+<kbd>S</kbd> 保存网页。保存类型可以选“网页，全部”，得到 `.html` 和同名 `_files` 文件夹；也可以选“网页，单个文件”，得到 `.mhtml`。保存后的文件也可以打包成 `.zip`。
3. 把文件拖进墨誊窗口，选择版式，点“开始转换”。

也可以在聊天页面里选中对话内容，按 <kbd>Ctrl</kbd>+<kbd>C</kbd> 复制，再在墨誊里点“从剪贴板粘贴”。

每次转换会在输出目录（默认是“文档\墨誊”）下建一个以对话标题命名的文件夹，里面有：

| 文件 | 说明 |
| --- | --- |
| `<标题>.pdf` | 编译好的 PDF |
| `main.tex` | LaTeX 源码，可以继续修改 |
| `moteng.sty` | 墨誊的环境与宏 |
| `mojing-*.cls/.sty` | 讲义体所用的[墨经模板](../mojing/)（只在讲义体输出） |
| `images/` | 对话里的图片 |

整个文件夹可以直接上传到 Overleaf，编译器选 XeLaTeX 即可编译。

## 两种版式

- **对话体**（`ctexart`）：提问放在浅色框里，回答随后排出，保留原来的对话结构。
- **讲义体**（[墨经 `mojing-notes`](../mojing/)）：每个问题一讲，问题排成“问题”环境，回答里的标题变成节。如果对话很长但每轮都很短，会改成一讲里的若干节。

回答里如果已有“一、”“1.”“第三步”这类编号，标题就不再另加编号。

## 支持的网站

| 网站 | 识别方式 | 测试样本 |
| --- | --- | --- |
| ChatGPT | 2026 年的 DIL 渲染界面（`data-chatgpt-search-unit-key`），以及更早的 `data-message-author-role` 界面 | 真实页面（用户提供，已去除侧栏和账号信息）+ 第三方样本 |
| Claude | `data-testid="user-message"`、`.font-claude-response` | 第三方样本 |
| Gemini | `user-query` / `model-response`，公式取 `data-math` | 第三方样本 |
| DeepSeek | `.ds-message`、`.ds-markdown`，思考过程 `.ds-think-content` | 按选择器构造的样本 |
| Grok | `div[id^=response-]` | 第三方样本 |
| Copilot | `.group/user-message`、`.group/ai-message` | 第三方样本 |
| Kimi、豆包、通义千问、腾讯元宝、智谱清言、Perplexity、Poe、Le Chat | 各站的消息选择器 | 没有真实样本 |

选择器参考了几个开源导出工具当前的实现：DeepShare（2026-10）、chatgpt-chat-exporter（2026-09）、ai-chat-exporter 和 AI Chat Exporter。这些网站的页面结构经常变，所以识别分三层：

1. 先用网站专属的选择器；
2. 不匹配时，换用页面里出现的其他网站的特征；
3. 再不行，按通用规则提取：先找带角色标记的元素，再找 Markdown 正文容器和“用户消息”类名。

用通用规则提取时，软件会给出提示，请核对问答是否完整。

`fixtures/third-party/` 中的 DOM 样本来自 [revivalstack/ai-chat-exporter](https://github.com/revivalstack/ai-chat-exporter)（MIT 许可，见同目录的 LICENSE 文件），只用于测试。

## 转换的内容

- **公式**：TeX 源码的来源依次是 KaTeX 的 annotation、`data-math` / `data-latex` / `copy-text` 等属性、MathJax 2 的 `<script type="math/tex">`、MathJax 3 的辅助 MathML（转换回 TeX）。转换时会做以下改写：
  - 删除 `%` 注释和空行；
  - 把数学模式里的中文放进 `\text{}`；
  - KaTeX 允许在 `$$` 里写 `align` 环境，转换后改为 `align*`；
  - 带 `\\` 和 `&` 的多行公式改用 `align*` 或 `gather*`；
  - 补齐 `\R`、`\bm`、`\ce` 等 KaTeX 或 MathJax 才有的命令。
- **代码**：识别语言并用 highlight.js 着色，长行自动折行，中文注释对齐。
- **表格**：列宽按内容长度分配，可以跨页；ChatGPT 的卡片网格转成无框表格。
- **其他**：列表（含任务列表与编号起点）、引用、标题、链接、上下标、删除线和图片都会转换。webp、gif、svg 图片由内置的 Chromium 转成 PNG 后放入 PDF。
- **交互组件**：ChatGPT 回答里的步进器、滑块等组件，按保存时的状态排成静态快照，并加框注明。
- **用户提问**：保留换行。提问里手打的 `$...$`、`\(...\)` 会排成公式，“$5 和 $10”这类金额不会被当成公式。
- **思考过程**：默认不输出，勾选“包含思考过程”后以灰色框保留。

## 编译与自动修复

墨誊按以下顺序使用排版引擎：

1. 安装包内置的 [Tectonic](https://tectonic-typesetting.github.io/) 0.17.0，带离线 TeX 文件缓存，离线也能编译；
2. 电脑上已装的 TeX Live 或 MiKTeX；
3. 用户在界面里指定的 `xelatex`。

如果一个引擎都找不到，就只输出 `.tex`。

生成 `.tex` 时，每个公式、表格、代码块都记下了所在的行号。编译出错时，软件用日志里的行号找到出错的那一段，只把这一段换成源码显示（红色等宽字体或代码框），然后重新编译。同一轮里出错的独立公式会一次全部修复。修复后，PDF 旁会提示有几处公式改为源码显示，其余内容照常排版。

导言区出错时（通常是字体问题），先改用 TeX 自带的 Latin Modern 和 Fandol 字体重试；讲义体仍然失败时，改用对话体。

软件先在本机字体目录里找到中文字体文件，Windows 上依次尝试：

- 宋体：思源宋体，然后是 SimSun；
- 黑体：微软雅黑；
- 楷体：KaiTi；
- 仿宋：FangSong；
- 等宽：Consolas。

生成的 `main.tex` 先按字体名加载（`\IfFontExistsTF{SimSun}`），找不到再按文件路径加载（`\IfFileExists`）。内置的 Tectonic 在 Windows 上只能按字体名找到系统字体，TeX Live 和 MiKTeX 两种方式都可以。`main.tex` 拿到别的电脑上编译时，两种方式都找不到就保留 Fandol。

## 开发

```sh
cd moteng
npm ci
npm test                         # 抽取、TeX 生成、端到端编译（需要 TeX 引擎，没有则跳过）
npm start                        # 启动桌面程序
node bin/moteng.js 网页.html -s notes   # 命令行转换
node bin/moteng.js --engines     # 列出找到的 TeX 引擎
```

命令行选项见 `node bin/moteng.js --help`。

打包 Windows 安装包：

```sh
node scripts/fetch-tectonic.js   # 下载 Tectonic 到 vendor/tectonic/
node scripts/warm-tectonic.js    # 预热离线缓存（需要联网），并离线复核一遍
npm run dist:win                 # electron-builder 生成 NSIS 安装包
```

GitHub Actions 的「moteng · Windows build」在 Windows 上完成全部步骤：

1. 下载并预热 Tectonic；
2. 运行测试，其中包括用 Tectonic 实际编译；
3. 生成安装包；
4. 对未安装版和静默安装后的程序各运行一次 `--self-test`，检查两种版式、中文输出路径、PDF 结构、中文字体是否用上了系统字体，并截取窗口。

手动触发工作流时勾选 release，或在提交信息里写 `[release]`，会把安装包发布到 Releases（标签 `moteng-v*`），并刷新 `moteng-latest` 里的自动更新信息。从 1.1.0 起，装好的软件会自己检查并安装新版本（左侧“软件更新”，可以关掉）。默认不做代码签名；设置 `WIN_CSC_LINK` 后工作流会给软件签名，做法见 [scripts/windows-release/](../scripts/windows-release/README.md)。

### 目录

```text
src/core/load.js        读入 .html / .mhtml / .zip / 文件夹 / 剪贴板
src/core/platforms.js   各网站的消息选择器
src/core/extract.js     拆分问答、判断角色与标题
src/core/ir.js          HTML → 文档结构（段落、公式、代码、表格……）
src/core/math.js        取回 TeX 源码、MathML → TeX、公式改写
src/core/latex/         TeX 生成（转义、代码高亮、字体、两种版式）
src/core/compile.js     查找并运行 TeX 引擎、解析日志
src/core/convert.js     全流程与自动修复循环
src/app/                Electron 主进程、预加载脚本与界面
tex/moteng.sty          生成的 TeX 所用的环境与宏
fixtures/               测试样本（selftest/ 也随安装包提供给 --self-test）
```
