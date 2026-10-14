# Motif 架构

## 总览

```
                 ┌──────────────── 人 ────────────────┐      ┌──────────── AI ─────────────┐
                 │  Electron 编辑器（React，src/app）   │      │ Skill · CLI · MCP（src/cli）│
                 │  ─ 画布 / 时间线 / 检查器 / AI 助手  │      │ Claude · Codex · DeepSeek… │
                 └───────────────┬────────────────────┘      └─────────────┬───────────────┘
                                 │  ops（原子编辑操作）                       │  ops
                 ┌───────────────▼─────────────────────────────────────────▼───────────────┐
                 │ 核心（src/core，同构 JS）：文档模型 · 组件目录 · 主题 · ops · 校验           │
                 │ 项目库（store，Node）：作品 / 修订快照 / 模板 / 组件 / 主题 / 资源           │
                 │ 导入（importers）+ 自动导演（director）                                     │
                 └───────────────┬──────────────────────────────────────────────────────────┘
                                 │  文档 JSON
                 ┌───────────────▼──────────────────────────────────────────────────────────┐
                 │ 渲染引擎（src/engine，浏览器）：排版 · 版式 · 编排 · 组件 · 转场 · 3D        │
                 │ render(doc, t) 是确定性的：编辑器预览 = AI 预览 = 导出成片                   │
                 └───────────────┬──────────────────────────────────────────────────────────┘
                                 │
           编辑器画布（实时） · 渲染 worker（隐藏窗口 → FFmpeg / PDF / HTML 播放器）
```

整个系统只有一种作品格式（文档 JSON），也只有一条写入路径（ops）。GUI、CLI、MCP 和内置 AI 助手都调用同一组函数，因此能力完全对等：AI 能设置的参数人都能编辑，反之亦然。

## 文档模型（src/core/doc.js）

- 结构：`{ title, format, theme, style, brand, audio, assets, scenes:[{ layout, transition, background, camera, tone, duration, blocks:[{ type, …params, motion, style, frame, key }] }] }`。
- **宽松归一化**：支持别名（`heading`→`title`、`slides`→`scenes`、`barchart`→`chart`）、场景简写（`{"title":"…","bullets":[…]}`）、多种数据写法（行数组、映射、CSV、`{labels, series}`）。无论是人还是哪家模型写的，存下来的都是规范形式。
- **校验**：参数类型、枚举（附「是否是…？」建议）、资源引用和区间。错误信息直接面向 AI 和人。
- **组件目录**（`catalog/components.js`）是唯一的事实来源。编辑器的检查器表单、文档校验、CLI 文档、MCP 工具说明，以及 Skill 的 `reference/components.md`，都由它生成。

## 编辑操作（src/core/ops.js）

`applyOps(doc, ops)` 支持 20 余种语义操作，例如 `add_scene`、`update_block`（深度合并，`null` 表示删除）、`move_block`、`set_theme`、`set_format`、`replace_document`。

- 一组操作是**原子的**：任何一个失败，整组都不生效，并返回原因和提示。
- **编辑器**先在本地应用操作，画布即时更新；之后把**同一组操作**发给主进程，在磁盘上的最新版本上重放。如果此时 AI 刚改过作品，双方的修改会按语义合并，不会整文件覆盖。新增的场景和块在本地就分配 ID，保证两边一致。
- **撤销/重做**在本地保存文档快照。外部（CLI、MCP、AI 助手）的修改通过文件监听实时出现在编辑器里，并作为一个可撤销的步骤。

## 项目库（src/core/store）

```
<素材库>/projects/<slug>--<id>/project.json · assets/ · history/*.json.gz · exports/ · thumb.jpg
         templates/<id>/template.json  · components/<id>.json · themes/<id>.json · .trash/
```

- 每次保存修订号加一，并生成 gzip 快照，同时记录作者和说明。可以给版本命名（命名版本永久保留），也可以恢复到任意修订。
- 写入前用 `expectRevision` 检测冲突。
- 导入资源时按内容哈希去重，并记录尺寸和时长。

## 渲染引擎（src/engine）

1. **主题解析与环境**（`env.js`）：画幅 → 单位尺寸；主题令牌 → 各色调调色板（自动保证对比度）、字号比例、网格、动画参数（由 `energy` 缩放）。
2. **版式**（`layout.js`）：自动选择版式，在主题网格上划分区域，再按内容排布块。区域由画幅推导，不是写死的坐标，所以同一文档能在 16:9、9:16、1:1 之间自动适配。可伸缩的组件（步骤、时间线、统计等）会长进空余空间；竖屏时内容作为一个整体居中。
3. **编译**（`compile.js`）：每个块构建出绘制实例；编排器根据内容性质（标题、文字、视觉）和主题节奏排出入场时间；场景时长由动画完成时间加阅读停留计算；转场与相邻场景重叠。编译结果按场景缓存，编辑时只重算改动的场景。
4. **绘制**（`render.js`）：背景生成器（低分辨率平滑层 + 细节层 + 预烘焙颗粒）、镜头运动、14 种转场合成，以及进度条、页码、字幕、品牌等画面元素。
5. **排版**（`text/text.js`）：富文本标记、CJK 与拉丁文混排间距、避头尾、平衡换行（优先在标点处断行）、数字与单位不拆行、自适应字号、按字或按行的动画单元。
6. **组件**：文字、数据（14 种图表）、信息图、媒体、数学（MathJax 字形 → Path2D）、3D（three.js 共享离屏 WebGL，合成进 2D 帧）。

## 应用（src/app）

- **主进程**（`main/`）：
  - 编辑器窗口；
  - `motif://` 协议，把应用文件和已授权的项目文件放在同一个源下，因此画布可以回读像素；
  - IPC（`ipc.js`，统一的 `call(method, args)`）；
  - 文件监听；
  - 导出任务（进度、取消、多进程分段并行 + 无损拼接）；
  - AI 助手（`ai.js`：Anthropic Messages 与 OpenAI 兼容 chat/completions 两种协议，多轮工具调用，Key 用 `safeStorage` 加密）。
- **渲染 worker**：同一个可执行文件加 `--motif-worker=<管道>` 参数运行时，就是无界面渲染进程。CLI 通过本地套接字或命名管道驱动它；FFmpeg 编码在隐藏窗口的 preload 中直接接收帧，不经过 IPC。
- **编辑器 UI**（`renderer/`，React）：
  - 素材库：模板画廊、导入向导、AI 创作；
  - 编辑器：场景列表、画布与叠加交互、时间线、检查器、主题库、导出、历史、演示、设置。

## CLI 与 MCP（src/cli）

- `commands.js` 是 CLI 和 MCP 共用的命令实现，`tools.js` 定义 20 个工具（可输出 MCP、OpenAI、Anthropic 三种格式），`mcp.js` 是 stdio JSON-RPC 服务器。
- 在桌面应用内，AI 助手调用同一批工具，渲染类工具直接在应用进程内完成（`setJobRunner`）。

## 导入与自动导演（src/core/importers, director.js）

- **导入**：PPTX（文本框层级、原生图表缓存、表格、图片、备注）、DOCX（标题样式、列表、表格、引用）、XLSX（共享字符串、数字格式）、PDF（pdf.js：按字号识别标题，按制表间距识别表格）、Markdown、CSV 和 JSON，统一转成大纲。分析阶段会给表格推荐图表类型、抽取关键数字、判断主题方向。
- **自动导演**：根据大纲选择主题，再决定每节用什么视觉形式：数字 → 统计，表格 → 图表，历程 → 时间线，步骤 → 流程，公式 → 推导，图片 → 分栏或全屏。同时安排章节页、色调节奏和收尾。

## 打包（Windows）

- 用 electron-builder 生成 NSIS 安装包和绿色版 zip。
- `app.asar` 内放应用代码；`app.asar.unpacked/dist/cli.mjs` 和 pdf.js 解包在外，供 `bin\motif.cmd` 用 `ELECTRON_RUN_AS_NODE` 运行；`resources/ffmpeg/ffmpeg.exe` 是固定版本的静态构建；`resources/skill/motif` 是 Skill 包。
- 安装程序会把安装目录加入用户 PATH。
- 在非 Windows 主机上，exe 的图标和版本资源由 `scripts/after-pack.cjs`（resedit，纯 JS）写入。CI 在 `windows-latest` 上构建，并对打包结果做 CLI、渲染、导入和导出的冒烟测试。

## 测试

- `npm test`：核心单元测试，覆盖文档、ops、项目库、导入与导演、排版、表达式，以及 CLI 代理工作流。
- `npm run test:e2e`：启动真实 Electron 窗口，覆盖新建、编辑、撤销、外部修改实时同步、组件面板、主题、导出 PDF、历史；AI 助手部分用模拟的 OpenAI 和 Anthropic 服务端，跑完多轮工具调用。
- `node tests/render/snap.mjs`：按主题和画幅生成渲染联系表，用于目视回归。
