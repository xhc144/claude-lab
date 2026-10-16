---
name: motif
description: 用 Motif（律影）创作和编辑专业动态视觉——动画演示、数据视频、动态图表、信息图、数学/科学动画、3D 场景、短视频。当用户要把内容（PPT、Word、Excel、PDF、Markdown、笔记、数据、想法）做成动态视觉/视频/演示，或要修改已有的 Motif 作品、模板、组件时使用。通过 motif CLI（或 MCP）操作用户本机的作品库；人可在 Motif 桌面编辑器中继续编辑同一作品。
---

# Motif（律影）动态视觉创作

Motif 是一套把动态设计经验沉淀为软件的创作系统。**分工很明确：**

- **你（AI）提供**：内容结构、文案、数据，以及少量设计意图（主题、画幅、节奏、强调哪里）。
- **Motif 完成**：版式、字号、配色、对齐、图表绘制、动画编排、转场、镜头、节奏、导出。

所以不要描述像素位置或逐帧动画——选对组件、写好内容、给对数据，设计系统会把它做成专业作品。你写入的每个作品都保存在用户的作品库里，用户打开 Motif 编辑器就能看到并继续手动修改；用户的修改你也能读到。

## 0. 调用 CLI

按顺序找到可用的命令，之后文中的 `motif` 都指它：

1. 本 Skill 目录下有 `motif-cli.json`（由 Motif 应用「设置 → AI 集成」安装时写入）：用其中的 `command` + `args` 调用（`env` 中的变量也要带上）。
2. `motif` 已在 PATH 中（Windows 安装版自带 `bin\motif.cmd`，安装时加入用户 PATH）。
3. 运行 `node <本 Skill 目录>/scripts/motif.mjs <参数>`：它会自动查找本机安装的 Motif。

先运行一次 `motif doctor`，确认渲染器与 FFmpeg 可用。所有命令都支持 `--json`（推荐：输出结构化结果）。退出码：0 成功，2 参数错误，3 操作/检查失败（项目保持不变），其他为运行错误；错误信息带有 `→ 提示`，照提示修正即可。

写操作请加 `--agent <你的名字>`（如 `--agent claude`），历史记录里会标明作者。

## 1. 工作流

### 第 1 步 · 素材分析

有文件时先分析，不要凭空猜测内容：

```bash
motif analyze 报告.pptx 数据.xlsx --json
```

输出结构化大纲：章节、要点、表格（含图表建议 `analysis.chart`）、关键数字（`numbers`）、图片、主题线索（`insights.topics`）。读懂后再规划。只有想法或一段文字时，自己整理大纲。

### 第 2 步 · 建立项目（三选一）

| 情况 | 做法 |
| --- | --- |
| 有素材文件，想快速得到好结果 | `motif auto 文件… --title "标题" [--theme ID] [--aspect 16:9] --json` → 自动设计出完整作品，再按第 3–5 步精修 |
| 题材与某个模板吻合 | `motif templates --json` 查看，`motif new "标题" --template <ID> --json`，再替换内容 |
| 需要完全掌控结构 | 写一个文档 JSON（见第 2 节），`motif new "标题" --from doc.json --json` |

继续修改已有作品：`motif list --json` 找到项目，`motif show <项目> --json` 读取摘要（含所有场景/块 ID）。

### 第 3 步 · 视觉设计（规划场景）

先在心里列出叙事结构，再写场景。原则：

- **一个场景只讲一件事。** 标题是结论，不是话题（「营收五年增长 7 倍」好于「营收情况」）。
- **能可视化就不要罗列。** 数字 → `stat`/`stats`；趋势/对比 → `chart`；流程 → `steps`/`flow`；历程 → `timeline`；对比 → `compare`；结构 → `hierarchy`/`matrix`/`pyramid`；公式 → `equation`；函数 → `plot`；地理 → `globe`；比例 → `pictogram`。
- **文字极简。** 标题中文 ≤ 20 字；要点 3–5 条、每条 ≤ 18 字；正文 ≤ 80 字。多了就拆成两个场景。
- **节奏有起伏。** 开场 `cover`，章节之间可用 `section`，重点数据用 `focus`，金句用 `quote`，结尾 `closing`。不要连续 3 个以上相同版式。
- **数据要真。** 只用素材里或用户给的数字；缺数据就用占位并告诉用户。

组件参数查 `reference/components.md`（或 `motif catalog <类型>`）；版式/转场/背景/动画查 `reference/scene.md`；主题风格查 `reference/themes.md`。设计判断（哪种内容用哪种组件、如何安排节奏）见 `reference/design-guide.md`。

### 第 4 步 · 动画与节奏

默认全部交给主题（`auto`）。只在有明确意图时调整：

- 整体快慢/力度：`set_style` 的 `energy`（0 沉稳 – 1 活力；短视频 0.75–0.9，汇报 0.4–0.6）。
- 场景色调制造节奏：`tone: "inverse"` / `"accent"` 用在章节页、金句、关键数字页。
- 某个转场需要强调：`transition: {"type":"band"}`、`"iris"`、`"zoom"` 等；相邻场景同一元素平滑变形用 `morph` + 块的 `key`。
- 个别元素的入场：块的 `motion: {"enter":"slam","delay":0.2}`；强调动画 `emphasis: "pulse"`。
- 竖屏短视频：`set_format` 为 `9:16`，版式会自动重排，不需要改内容结构。
- **讲解类内容不要让一页静止很久**：讲公式、图表、流程、代码思路时，给场景加 `guide`（讲解指针）。一支光标会按步骤移到要讲的局部——公式里的某一项、文字里的关键词、第 2 个步骤、函数图上的点——画圈、划线、荧光笔或指向，每步配一句 `say`（讲解词，决定停留时长，开字幕时显示）。场景时长自动延长到讲完。

```json
{ "title": "勾股定理", "blocks": [{ "id": "b_eq", "type": "equation", "latex": "a^2 + b^2 = c^2" }],
  "guide": { "cursor": "arrow", "steps": [
    { "target": "b_eq", "part": "a^2", "do": "underline", "say": "先看一条直角边的平方" },
    { "target": "b_eq", "part": "b^2", "do": "underline", "say": "再加上另一条直角边的平方" },
    { "target": "b_eq", "part": "c^2", "do": "circle", "note": "斜边", "say": "正好等于斜边的平方" } ] } }
```

  动作：`point` 指向 · `circle` 圈出 · `underline` 下划线 · `highlight` 荧光笔 · `box` 框选 · `arrow` 箭头 · `focus` 聚光 · `cross` 划掉 · `check` 打勾。`part` 的写法见 `reference/scene.md`「讲解指针」；公式片段要与 latex 原文一致。改已有作品时用 `update_scene` 的 `set: {"guide": {...}}` 整体写入。lint 会报出找不到的 part。

### 第 5 步 · 检查（必做）

```bash
motif lint <项目> --json          # 文字溢出、重叠、密度、时长、对比度、节奏
motif preview <项目> --out sheet.jpg   # 所有场景定格拼图，能看图就打开看
motif still <项目> --scene 3 --out s3.jpg   # 单个场景细看
```

修正所有 `error` 和重要的 `warning`（通常是：缩短文字、拆分场景、换更合适的组件），再次 lint 直到干净。能看图时务必看一眼 preview：检查层级是否清晰、是否拥挤、数据是否正确。

### 第 6 步 · 导出

```bash
motif export <项目> --format mp4 --quality high --json   # 视频（还有 webm / mov / gif）
motif export <项目> --format html                         # 单文件交互演示（可翻页）
motif export <项目> --format pdf                          # 讲义
```

告诉用户输出文件路径，并说明可在 Motif 编辑器中继续修改（`motif open <项目>`）。

## 2. 文档结构速查

```json
{
  "title": "作品标题",
  "theme": "aurora",
  "aspect": "16:9",
  "style": { "energy": 0.6 },
  "scenes": [
    { "layout": "cover", "title": "让数据自己讲故事", "subtitle": "2026 产品发布" },
    { "title": "效率提升 ==3 倍==", "stats": [{ "value": 120, "suffix": "家", "label": "内测企业" }, { "value": 3, "suffix": "倍", "label": "效率提升" }] },
    { "layout": "focus", "title": "营收五年增长 7 倍", "chart": { "kind": "bar", "suffix": "亿", "data": { "labels": ["2021","2022","2023","2024","2025"], "series": [{ "name": "营收", "values": [12,19,31,52,86] }] }, "highlight": "2025" } },
    { "layout": "closing", "title": "谢谢", "subtitle": "hello@example.com" }
  ]
}
```

- 场景**简写**：把块类型当字段名（`"title"`、`"bullets"`、`"chart"`、`"stats"`…），软件会转换成 `blocks` 数组；完整写法是 `"blocks": [{"type":"chart", ...}]`，可精确控制顺序与参数。
- 文本支持轻量标记：`**加粗**`、`==强调色==`、`*斜体*`、`` `代码` ``。
- 所有文字（正文、列表、小字、图表与坐标轴标签、字幕）都支持行内 TeX：`$\\frac{a}{b}$` 或 `\\(…\\)`，在 JSON 里反斜杠写两次。金额 `$5`、`$10` 不会被当成公式。独立的大公式与推导仍用 `equation`。
- 写法宽松：常见别名（`heading`→`title`、`slides`→`scenes`、`barchart`→`chart` 等）会被自动纠正，并给出警告。
- 本地图片可写 `"src": "D:/图片/a.png"`，写入时自动复制进项目；也可先 `motif assets <项目> add 文件` 拿到资源 ID 用 `"asset"`。

## 3. 修改已有作品（ops）

先 `motif show <项目> --json` 拿 ID，再提交一组原子操作（任一失败则全部不生效，并返回原因与提示）：

```bash
motif apply <项目> - --agent claude -m "精简第 3 页" <<'EOF'
[
  { "op": "update_block", "block": "b_k2x9aa", "set": { "text": "三项核心能力" } },
  { "op": "add_scene", "after": 3, "scene": { "layout": "quote", "quote": { "text": "简单是最终的复杂。", "author": "达·芬奇" } } },
  { "op": "update_scene", "scene": 5, "set": { "tone": "inverse", "transition": "band" } },
  { "op": "set_theme", "theme": "editorial", "accent": "#C8102E" }
]
EOF
```

注意：一组操作按顺序执行，场景/块的**序号**指当时的状态——插入或删除场景后，后面的序号会变。优先用 ID（`s_…`、`b_…`）引用；必须用序号时，把增删场景的操作放在最后。

常用操作：`add_scene` `update_scene` `remove_scene` `move_scene` `duplicate_scene` `add_block` `update_block`（深度合并；值为 `null` 删除该参数）`replace_block` `remove_block` `move_block` `set_title` `set_theme` `set_style` `set_format` `set_brand` `set_audio`。全部操作见 `reference/ops.md`。整套重写用 `motif write <项目> doc.json`（保留 ID、资源与历史）。

用户可能同时在编辑器里修改同一作品——每次修改前重新 `show` 一次，基于最新状态操作；ops 按语义合并，不会覆盖用户刚做的其他修改。

## 4. 模板、组件与主题复用

- 模板：`motif templates` 列出内置与用户模板；`motif templates save <项目> --name "季度汇报"` 把作品存为模板。
- 组件：`motif components list` 查看用户保存的可复用块/场景；`motif components insert <项目> --component <ID> --scene 3` 插入；`motif components save <项目> --block <ID> --name 名称` 保存。用户在编辑器里保存的组件你都能用——优先复用用户的组件以保持其风格一致。
- 主题：`motif themes` 列出（含用户自定义主题）。用户主题用 `{"id":"…","extends":"aurora","palette":{…}}` 定义，`motif themes save theme.json` 保存。

## 5. 硬性规则

1. 不编造数据、引言或人名。不确定就问，或用明显的占位并说明。
2. 每次修改后运行 `motif lint`；有 error 不交付。
3. 不手写坐标（`frame`）除非用户明确要求某元素的位置——自动布局在所有画幅下都正确。
4. 不要一次塞满：场景数量按时长估算（每场景 3–7 秒；60 秒视频约 10–14 个场景）。
5. 修改用户已有作品时，只改用户要求的部分；大改前先说明计划。
6. 交付时告诉用户：作品名称与 ID、做了什么、导出文件路径、可在编辑器里继续修改。

## 参考文件

| 文件 | 内容 |
| --- | --- |
| `reference/design-guide.md` | 设计判断：内容 → 组件选择、叙事结构、节奏、各画幅与场合的经验 |
| `reference/components.md` | 全部组件与参数（由软件目录自动生成，始终与软件一致） |
| `reference/scene.md` | 版式、转场、背景、入场动画、镜头、画幅 |
| `reference/themes.md` | 10 套主题的风格、配色、字体与动画性格 |
| `reference/ops.md` | 全部编辑操作 |
| `reference/cli.md` | CLI 命令全集与 JSON 输出说明 |
| `examples/` | 完整作品示例（发布会、数据报告、数学课、竖屏短视频）与 ops 示例 |
| `tools/` | 函数调用工具定义（OpenAI / Anthropic / MCP 格式），供 DeepSeek、Qwen 等通过函数调用接入 |
