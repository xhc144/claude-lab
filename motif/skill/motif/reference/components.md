# 组件目录（自动生成）

每个场景由若干块（block）组成。块写成 `{"type": "<类型>", ...参数}`。以下参数之外，所有块都接受通用参数（见文末）。

## 文字

### `title` — 标题

场景主标题，可带眉题（kicker）与副标题。

每个场景通常以一个 title 开头。text 支持轻量标记：**加粗**、==强调色==、*斜体*、`代码`、~~删除~~，以及行内公式 $a^2+b^2=c^2$（或 \(…\)）。标题宜短（中文 ≤ 20 字、英文 ≤ 8 词），系统会自动平衡换行、避头尾、按空间缩放字号。

类别：文字；性质：headline；别名：`heading` `headline` `h1` `header`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `text` **必填** | string (rich) |  | 标题文本 |
| `kicker` | string |  | 眉题：标题上方的小号分类/章节标签，如 "第一部分" "2025 Q3" |
| `subtitle` | string (rich) |  | 副标题/导语，一句话补充 |
| `size` | "auto" / "s" / "m" / "l" / "xl" | `"auto"` | 字号等级；auto 由布局决定（封面最大） |

示例：
```json
{"type":"title","kicker":"2025 年度报告","text":"用户增长 ==三倍== 的一年","subtitle":"从 120 万到 380 万，我们做对了什么"}
```

### `text` — 正文

段落文本，空行分段。

用于一两段说明文字。超过约 80 个汉字会显得拥挤——优先拆成 bullets 或下一个场景。size=l 适合作为导语（lead）。

类别：文字；性质：copy；别名：`paragraph` `body` `p` `description`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `text` **必填** | string (rich) |  | 正文，空行分段，支持轻量标记 |
| `size` | "auto" / "s" / "m" / "l" | `"auto"` | 字号；l 为导语大字 |
| `columns` | 1 / 2 | `1` | 分栏 |

示例：
```json
{"type":"text","text":"我们把复杂的渲染流程沉淀进软件本身，**AI 只需提供内容与数据**。"}
```

### `bullets` — 要点列表

3–6 条要点，可带图标/编号/勾选/卡片样式。

每条要点尽量一行（中文 ≤ 24 字）。可给每项 detail 作为补充说明。style=cards 时作为网格卡片（视觉块）展示；icons 时请给每项 icon，未给时系统会根据文本关键词自动选择图标。

类别：文字；性质：copy；别名：`list` `points` `checklist` `numbered`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` **必填** | { text, detail, icon }[] |  | 要点数组；也可以直接给字符串数组 |
| `style` | "auto" / "dots" / "numbers" / "icons" / "checks" / "dashes" / "cards" | `"auto"` | 列表样式 |
| `columns` | "auto" / 1 / 2 / 3 | `"auto"` | 列数 |

示例：
```json
{"type":"bullets","style":"icons","items":[{"text":"端到端加密","icon":"shield-check"},{"text":"毫秒级同步","icon":"zap"},{"text":"离线可用","icon":"wifi-off"}]}
```

### `quote` — 引言

大号引言 + 署名。

适合用户评价、名人名言、核心观点。引言宜 15–60 字。

类别：文字；性质：copy；别名：`testimonial` `blockquote`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `text` **必填** | string (rich) |  | 引言内容 |
| `author` | string |  | 署名 |
| `role` | string |  | 身份/出处 |
| `avatar` | asset |  | 头像图片资源 |

示例：
```json
{"type":"quote","text":"设计不只是外观和感觉，设计是它如何运作。","author":"Steve Jobs"}
```

### `callout` — 提示框

带图标的强调提示/结论框。

用于一句结论、注意事项或关键洞察。

类别：文字；性质：copy；别名：`note` `insight` `tip` `warning`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `text` **必填** | string (rich) |  | 内容 |
| `label` | string |  | 小标题，如 "关键结论" |
| `icon` | icon |  | Lucide 图标名（如 rocket, users, shield-check, trending-up, globe, cpu, leaf）。motif icons --search 查询。 |
| `tone` | "auto" / "accent" / "positive" / "negative" / "warning" / "neutral" | `"auto"` | 语气色 |

示例：
```json
{"type":"callout","label":"关键结论","text":"留存率提升主要来自新手引导的重构。","icon":"lightbulb"}
```

### `code` — 代码

代码块，带语法高亮与打字动画。

支持 js/ts/python/json/bash/sql/rust/go/java/c/cpp/html/css 的基础高亮。highlight 指定要强调的行号（从 1 开始）。

类别：文字；性质：visual；别名：`snippet`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `code` **必填** | string |  | 代码文本 |
| `language` | string |  | 语言 |
| `title` | string |  | 窗口标题/文件名 |
| `highlight` | integer[] |  | 强调行 |
| `typing` | boolean | `true` | 逐字打出 |

示例：
```json
{"type":"code","language":"python","title":"train.py","code":"model = Motif()\nmodel.render(\"intro.mp4\")"}
```

## 数据

### `stat` — 关键数字

一个大号数字（滚动计数）+ 标签 + 变化量。

value 可写数字或 "35%" "¥1.2亿" "3.8M" 这类字符串，系统自动解析前后缀并做计数动画。delta 显示涨跌（"+12%" 或数字），trend 给出一组数字时会画迷你走势线。

类别：数据；性质：visual；别名：`number` `kpi` `metric` `bignumber`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `value` **必填** | any |  | 数值（数字或带单位字符串） |
| `label` | string (rich) |  | 说明标签 |
| `prefix` | string |  | 前缀，如 ¥ $ |
| `suffix` | string |  | 后缀/单位，如 % 万 亿 x |
| `decimals` | integer |  | 小数位 |
| `delta` | any |  | 变化量，如 "+12%" 或 -3.2 |
| `deltaLabel` | string |  | 变化量说明，如 "同比" |
| `context` | string (rich) |  | 补充一句话 |
| `icon` | icon |  | Lucide 图标名（如 rocket, users, shield-check, trending-up, globe, cpu, leaf）。motif icons --search 查询。 |
| `trend` | number[] |  | 迷你走势数据 |
| `ring` | number |  | 0–100：在数字周围画进度环 |

示例：
```json
{"type":"stat","value":"3.8M","label":"月活跃用户","delta":"+212%","deltaLabel":"同比"}
```

### `stats` — 数字组

2–4 个关键数字并列成组。

每项同 stat 的字段（value/label/delta/prefix/suffix/icon）。超过 4 个会自动换行成网格。

类别：数据；性质：visual；别名：`kpis` `metrics` `numbers`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` **必填** | { value, label, delta, prefix, suffix, icon, decimals }[] |  | 数字项 |
| `style` | "auto" / "plain" / "cards" / "divided" | `"auto"` | 样式 |

示例：
```json
{"type":"stats","items":[{"value":98.6,"suffix":"%","label":"可用性"},{"value":"12ms","label":"P50 延迟"},{"value":4.9,"decimals":1,"label":"用户评分"}]}
```

### `chart` — 图表

动态数据图表：柱/条/折线/面积/饼/环/散点/堆叠/瀑布/漏斗/雷达/仪表/进度/排名动画。

kind 选择图表类型：bar 柱状、hbar 横向条形（排名）、line 折线、area 面积、pie 饼图、donut 环图、scatter 散点/气泡、stacked 堆叠柱、waterfall 瀑布、funnel 漏斗、radar 雷达、gauge 仪表盘、progress 进度条组、race 动态排名（每列一期，条形排序动画）。
data 接受多种写法：{labels:[...], series:[{name, values:[...]}]}；[{label, value}] 行数组；{"A":1,"B":2} 映射；[["A",1],["B",2]]；{columns:[...], rows:[[...]]}；CSV 字符串；散点用 {points:[[x,y],...]}。
highlight 指定要强调的类别（标签或序号），其余变灰；annotate 在某个类别上加注释气泡。单位用 suffix/prefix。动画由主题自动编排（坐标轴→数据→标签→注释）。

类别：数据；性质：visual；别名：`barchart` `bar` `column` `columns` `hbar` `ranking` `linechart` `line` `area` `areachart` `pie` `piechart` `donut` `doughnut` `scatter` `bubble` `stacked` `waterfall` `funnel` `radar` `gauge` `progress` `barrace` `race` `graph` `plotdata`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `kind` | "bar" / "hbar" / "line" / "area" / "pie" / "donut" / "scatter" / "stacked" / "waterfall" / "funnel" / "radar" / "gauge" / "progress" / "race" | `"bar"` | 图表类型 |
| `data` **必填** | data |  | 数据（多种写法，见描述） |
| `title` | string |  | 图表小标题（场景已有标题时可省略） |
| `prefix` | string |  | 数值前缀 |
| `suffix` | string |  | 数值后缀/单位 |
| `decimals` | integer |  | 数值小数位 |
| `highlight` | any |  | 强调的类别：标签字符串、序号或数组 |
| `annotate` | { at, text, series }[] |  | 注释气泡 |
| `legend` | "auto" / "top" / "bottom" / "none" | `"auto"` | 图例 |
| `labels` | "auto" / "all" / "end" / "none" | `"auto"` | 数值标签 |
| `smooth` | boolean | `true` | 折线平滑 |
| `sort` | "none" / "asc" / "desc" | `"none"` | 排序 |
| `min` | number |  | 坐标轴最小值 |
| `max` | number |  | 坐标轴最大值（gauge/progress 的满值） |
| `colors` | color[] |  | 自定义系列颜色（默认取主题数据色板） |
| `axis` | { x, y } |  | 轴标题 |

示例：
```json
{"type":"chart","kind":"bar","data":{"labels":["2021","2022","2023","2024","2025"],"series":[{"name":"营收","values":[12,19,31,52,86]}]},"suffix":"亿","highlight":"2025","annotate":[{"at":"2025","text":"同比 +65%"}]}
```
```json
{"type":"chart","kind":"donut","data":[{"label":"移动端","value":62},{"label":"桌面端","value":28},{"label":"平板","value":10}],"suffix":"%"}
```

### `table` — 表格

精排表格：逐行入场、强调行/列、数字右对齐。

用于少量结构化对比（≤ 7 行 × 5 列为佳）。columns 为表头，rows 为二维数组。highlight 可指定强调的行号或列号（从 0 开始，不含表头）。

类别：数据；性质：visual；别名：`grid` `datatable`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `columns` **必填** | any[] |  | 表头 |
| `rows` **必填** | any[][] |  | 数据行 |
| `highlight` | { row, col } |  | 强调 |
| `title` | string |  | 表格标题 |

示例：
```json
{"type":"table","columns":["方案","成本","周期","风险"],"rows":[["自研","高","9 个月","中"],["采购","中","2 个月","低"],["合作","低","4 个月","中"]],"highlight":{"row":1}}
```

### `pictogram` — 象形图

用图标阵列表达比例，如 "10 人中有 7 人"。

value/total 为高亮数量与总数（total 默认 10，最多 100）。icon 默认 user。

类别：数据；性质：visual；别名：`isotype` `iconarray`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `value` **必填** | number |  | 高亮数量 |
| `total` | integer | `10` | 总数 |
| `icon` | icon |  | Lucide 图标名（如 rocket, users, shield-check, trending-up, globe, cpu, leaf）。motif icons --search 查询。 |
| `label` | string (rich) |  | 说明 |
| `columns` | integer |  | 每行个数 |

示例：
```json
{"type":"pictogram","value":7,"total":10,"icon":"user","label":"**7/10** 的用户每天都会打开应用"}
```

## 信息图

### `timeline` — 时间线

里程碑时间线，线条生长、节点依次点亮。

items 每项 {date, title, text?, icon?}。3–7 项最佳。highlight 指定强调项序号（如当前阶段）。

类别：信息图；性质：visual；别名：`milestones` `roadmap` `history`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` **必填** | { date, title, text, icon }[] |  | 事件 |
| `orientation` | "auto" / "horizontal" / "vertical" | `"auto"` | 方向（auto：横屏水平、竖屏垂直） |
| `highlight` | integer |  | 强调项序号 |

示例：
```json
{"type":"timeline","items":[{"date":"2019","title":"创立"},{"date":"2021","title":"A 轮融资"},{"date":"2023","title":"用户破百万"},{"date":"2025","title":"全球化"}],"highlight":3}
```

### `steps` — 流程步骤

有序流程：编号节点 + 连接箭头；circle 样式为循环。

items 每项 {title, text?, icon?}，3–6 步最佳。style: arrows 箭头链、numbers 大编号、cards 卡片、circle 循环图。

类别：信息图；性质：visual；别名：`process` `workflow` `cycle` `stages`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` **必填** | { title, text, icon }[] |  | 步骤 |
| `style` | "auto" / "arrows" / "numbers" / "cards" / "circle" | `"auto"` | 样式 |
| `highlight` | integer |  | 强调步骤序号 |

示例：
```json
{"type":"steps","items":[{"title":"导入素材","icon":"file-up"},{"title":"自动设计","icon":"wand-sparkles"},{"title":"精修","icon":"sliders-horizontal"},{"title":"导出","icon":"film"}]}
```

### `features` — 图标网格

图标 + 标题 + 说明的特性网格。

items 每项 {icon, title, text?}。2–6 项。未给 icon 时按关键词自动匹配。

类别：信息图；性质：visual；别名：`iconGrid` `icongrid` `cards` `grid_features` `benefits`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` **必填** | { icon, title, text }[] |  | 特性 |
| `columns` | "auto" / 2 / 3 / 4 | `"auto"` | 列数 |
| `style` | "auto" / "cards" / "plain" | `"auto"` | 样式 |

示例：
```json
{"type":"features","items":[{"icon":"gauge","title":"更快","text":"渲染速度提升 4 倍"},{"icon":"palette","title":"更美","text":"10 套专业主题"},{"icon":"bot","title":"更智能","text":"AI 一键成片"}]}
```

### `compare` — 对比

两栏（或多栏）对比：之前/之后、方案 A/B、优/劣。

columns 为 2–3 个 {title, items[], value?, icon?, tone?}。winner 指定胜出栏序号以强调。也可用 left/right 两个字段。

类别：信息图；性质：visual；别名：`comparison` `versus` `vs` `beforeafter` `proscons`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `columns` **必填** | { title, items, value, icon, tone }[] |  | 对比栏 |
| `winner` | integer |  | 胜出栏序号 |
| `vs` | boolean | `true` | 中间显示 VS |

示例：
```json
{"type":"compare","columns":[{"title":"过去","items":["手动排版 3 天","图表靠截图"]},{"title":"现在","items":["自动成片 3 分钟","数据驱动动画"]}],"winner":1}
```

### `flow` — 流程图

节点-连线图（自动分层布局），连线流动动画。

nodes: [{id, label, icon?, tone?}]；edges: [["a","b","可选标签"], …] 或 {from,to,label}。direction right（左→右）或 down（上→下）。适合架构图、数据流、决策流程。

类别：信息图；性质：visual；别名：`diagram` `architecture` `graph_diagram` `dataflow`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `nodes` **必填** | { id, label, icon, tone }[] |  | 节点 |
| `edges` | any[] |  | 连线 |
| `direction` | "auto" / "right" / "down" | `"auto"` | 方向 |

示例：
```json
{"type":"flow","nodes":[{"id":"in","label":"素材","icon":"files"},{"id":"ai","label":"AI 分析","icon":"brain"},{"id":"eng","label":"渲染引擎","icon":"cpu"},{"id":"out","label":"成片","icon":"clapperboard"}],"edges":[["in","ai"],["ai","eng"],["eng","out"]]}
```

### `hierarchy` — 层级图

树状层级 / 组织架构 / 思维导图。

root: {label, children:[{label, children:[…]}]}。style tree 自上而下，mindmap 自中心向两侧。建议 ≤ 3 层、≤ 15 个节点。

类别：信息图；性质：visual；别名：`tree` `orgchart` `mindmap`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `root` **必填** | any |  | 根节点 {label, icon?, children:[…]} |
| `style` | "auto" / "tree" / "mindmap" | `"auto"` | 样式 |

示例：
```json
{"type":"hierarchy","root":{"label":"律影","children":[{"label":"引擎","children":[{"label":"排版"},{"label":"动画"}]},{"label":"接口","children":[{"label":"CLI"},{"label":"MCP"}]}]}}
```

### `matrix` — 四象限

2×2 矩阵：坐标轴 + 象限 + 散布的条目。

axes: {x:["低","高"], y:["低","高"], xLabel, yLabel}；quadrants: 4 个象限标题（左上、右上、左下、右下）；items: [{label, x:0–1, y:0–1}]。

类别：信息图；性质：visual；别名：`quadrant` `swot` `2x2`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `axes` | { x, y, xLabel, yLabel } |  | 坐标轴 |
| `quadrants` | string[] |  | 左上、右上、左下、右下 |
| `items` | { label, x, y }[] |  | 条目 |
| `highlight` | integer |  | 强调象限 0–3 |

示例：
```json
{"type":"matrix","axes":{"xLabel":"投入","yLabel":"价值"},"quadrants":["重点投入","战略项目","快速见效","暂缓"],"items":[{"label":"自动成片","x":0.3,"y":0.85}]}
```

### `pyramid` — 金字塔

分层金字塔（自上而下）。

items 自顶到底，每项 {title, text?}。3–5 层。

类别：信息图；性质：visual；别名：`layers`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` **必填** | { title, text }[] |  | 层级 |
| `invert` | boolean | `false` | 倒金字塔（漏斗形） |

示例：
```json
{"type":"pyramid","items":[{"title":"愿景"},{"title":"战略"},{"title":"执行"}]}
```

## 媒体

### `image` — 图片

图片：智能裁切、缓慢推拉（Ken Burns）、蒙版与相框。

asset 为项目资源 ID（motif assets add 导入后获得）；也可写 src 为本地路径或 URL（导入时会复制进项目）。mount 外框: rounded 圆角、circle 圆形、arch 拱形、phone 手机样机、laptop 笔记本样机、browser 浏览器窗口、polaroid 相纸。move 画面运动: kenburns 慢推、parallax 视差、none。

类别：媒体；性质：visual；别名：`photo` `picture` `img` `screenshot`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `asset` | asset |  | 图片资源 ID |
| `src` | string |  | 图片路径或 URL（未导入时） |
| `fit` | "cover" / "contain" | `"cover"` | 填充方式 |
| `focus` | number[] |  | 焦点 [x,y]（0–1），裁切时保留 |
| `mount` | "auto" / "none" / "rounded" / "circle" / "arch" / "phone" / "laptop" / "browser" / "polaroid" | `"auto"` | 外框 / 样机 |
| `move` | "auto" / "kenburns" / "parallax" / "none" | `"auto"` | 画面运动 |
| `caption` | string (rich) |  | 图注 |
| `overlay` | number |  | 暗化遮罩 0–1（全屏图上叠字时使用） |

示例：
```json
{"type":"image","asset":"ast_hero","mount":"rounded","caption":"新版编辑器"}
```

### `gallery` — 图集

多张图片的网格/拼贴，依次入场。

images 为资源 ID 或 {asset, caption} 数组，2–6 张。

类别：媒体；性质：visual；别名：`photos` `collage`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `images` **必填** | any[] |  | 图片 |
| `layout` | "auto" / "grid" / "mosaic" / "row" | `"auto"` | 排列 |

示例：
```json
{"type":"gallery","images":["ast_a","ast_b","ast_c"]}
```

### `icon` — 图标

单个大图标（描线绘制动画），可带标签。

用于强调一个概念。name 为 Lucide 图标名。

类别：媒体；性质：visual；别名：`symbol`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `name` **必填** | icon |  | Lucide 图标名（如 rocket, users, shield-check, trending-up, globe, cpu, leaf）。motif icons --search 查询。 |
| `label` | string (rich) |  | 标签 |
| `badge` | "auto" / "none" / "circle" / "square" | `"auto"` | 底座 |

示例：
```json
{"type":"icon","name":"sparkles","label":"自动设计"}
```

### `video` — 视频

嵌入视频片段（逐帧精确同步）。

asset 为视频资源 ID。trim: [开始秒, 结束秒]。导出时逐帧解码，保证与动画同步。

类别：媒体；性质：visual；别名：`clip` `footage`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `asset` **必填** | asset |  | 视频资源 ID |
| `trim` | number[] |  | [开始, 结束] 秒 |
| `fit` | "cover" / "contain" | `"cover"` | 填充 |
| `mount` | "auto" / "none" / "rounded" / "phone" / "laptop" / "browser" | `"auto"` | 外框 / 样机 |
| `volume` | number |  | 音量 0–1（导出时混入） |

示例：
```json
{"type":"video","asset":"ast_demo","trim":[2,8],"mount":"laptop"}
```

### `screen` — 录屏

屏幕录像：自动运镜、光标美化、点击特效、背景与外框、摄像头画中画，逐帧精确导出。

由录屏功能生成，也可以把已有的屏幕录像设为 asset。clips 是对源视频的剪辑（源时间秒，可变速）；zooms 是缩放片段（源时间秒）：mode=auto 时镜头跟随光标，manual 时看向 focus。pointer 为录制时的光标轨迹（JSON 资源），没有它时光标特效与自动运镜不可用。通常让它独占一个场景并铺满画面（frame {x:0,y:0,w:1,h:1}）。

类别：媒体；性质：visual；别名：`recording` `screencast` `screenrecord`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `asset` **必填** | asset |  | 屏幕录像资源 ID |
| `pointer` | asset |  | 光标轨迹资源 ID（JSON：位置、点击、光标形状） |
| `camera` | asset |  | 摄像头录像资源 ID |
| `mic` | asset |  | 麦克风录音资源 ID |
| `system` | asset |  | 系统声音资源 ID |
| `source` | { width, height, duration, fps, cursorInVideo } |  | 源录像信息（录制时写入） |
| `clips` | { from, to, speed, muted }[] |  | 剪辑片段，按播放顺序；空表示整段 |
| `zooms` | { start, end, scale, focus, mode, easing, enter, exit }[] |  | 缩放片段（自动运镜） |
| `background` | { type, preset, color, image, blur } |  | 背景 |
| `padding` | number |  | 留白，占画面短边比例 0–0.3 |
| `radius` | number |  | 圆角（1080p 下的像素） |
| `shadow` | number |  | 阴影 0–1 |
| `window` | "none" / "mac" / "browser" | `"none"` | 窗口外框 |
| `cursor` | { show, size, smooth, hideIdle, idleDelay, click, clickColor, highlight, tilt } |  | 光标 |
| `camera_layout` | { show, position, size, shape, border, shadow, mirror, shrinkOnZoom } |  | 摄像头画中画 |
| `audio` | { mic, system } |  | 音量 |
| `zoomDefaults` | { scale, easing, enter, exit } |  | 新建缩放片段的默认值 |

示例：
```json
{"type":"screen","asset":"ast_rec","pointer":"ast_ptr","frame":{"x":0,"y":0,"w":1,"h":1},"zooms":[{"start":3.2,"end":6,"scale":1.8,"mode":"auto"}],"background":{"type":"gradient","preset":"ocean"}}
```

### `shape` — 形状

装饰与标注形状：矩形、圆、线、箭头、高亮框。

通常配合 frame 手动定位使用（编辑器中绘制）。kind: rect/circle/line/arrow/highlight/brace。

类别：媒体；性质：visual；别名：`arrow` `box` `circle`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `kind` | "rect" / "circle" / "line" / "arrow" / "highlight" / "brace" | `"rect"` | 形状 |
| `color` | color |  | 颜色 |
| `fill` | boolean | `false` | 填充 |
| `text` | string (rich) |  | 附带文字 |

示例：
```json
{"type":"shape","kind":"arrow","color":"accent","frame":{"x":0.5,"y":0.5,"w":0.2,"h":0.05}}
```

## 数学与科学

### `equation` — 公式

LaTeX 公式，逐笔书写动画；steps 可展示推导步骤（逐步变换）。

latex 为公式（不需要 $ 包围）。steps 为后续推导式数组，按时间依次变换（相同符号保持、变化部分淡入淡出）。可用 \color{accent}{…} 或 \hl{…} 强调部分（accent 等主题色名有效）。label 为右侧编号/说明。

类别：数学与科学；性质：visual；别名：`formula` `math` `latex` `tex`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `latex` **必填** | latex |  | LaTeX 公式 |
| `steps` | latex[] |  | 推导步骤 |
| `size` | "auto" / "s" / "m" / "l" / "xl" | `"auto"` | 字号 |
| `label` | string (rich) |  | 说明/编号 |

示例：
```json
{"type":"equation","latex":"e^{i\\pi} + 1 = 0","label":"欧拉恒等式"}
```
```json
{"type":"equation","latex":"(a+b)^2","steps":["a^2 + 2ab + b^2"]}
```

### `plot` — 函数图像

坐标系 + 函数曲线（描绘动画），可加点、面积、切线、参数动画。

functions: [{expr:"sin(x)", label?, color?, dashed?}]，表达式支持 + - * / ^、sin cos tan exp log ln sqrt abs floor pi e 等；也可 {x:"cos(t)", y:"sin(t)", t:[0, 6.28]} 参数方程。
x/y 为范围 [min,max]（y 可省略自动）。points: [{x, y, label}]。area: {expr, from, to} 阴影积分面积。tangent: {expr, from, to} 切点沿 x 移动的切线。
param: {name:"a", from:0, to:2} 让表达式中的参数随时间变化（表达式中写 a）。

类别：数学与科学；性质：visual；别名：`function` `graph2d` `functionplot` `curve`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `functions` **必填** | { expr, x, y, t, label, color, dashed }[] |  | 函数 |
| `x` | range |  | x 范围 [min,max] |
| `y` | range |  | y 范围 [min,max]，省略则自动 |
| `points` | { x, y, label }[] |  | 标注点 |
| `area` | { expr, from, to, label } |  | 面积阴影 |
| `tangent` | { expr, from, to } |  | 移动切线 |
| `param` | { name, from, to } |  | 随时间变化的参数 |
| `grid` | boolean | `true` | 网格 |
| `axes` | { x, y } |  | 轴标签 |

示例：
```json
{"type":"plot","functions":[{"expr":"sin(x)","label":"\\sin x"},{"expr":"cos(x)","label":"\\cos x","dashed":true}],"x":[-6.3,6.3],"y":[-1.5,1.5]}
```

### `geometry` — 几何作图

尺规式几何构造：点、线段、圆、多边形、角、标签，按顺序绘制。

points: {A:[x,y], B:[x,y]…}；shapes 按顺序绘制：{type:"segment", from:"A", to:"B"} / {type:"polygon", points:["A","B","C"], fill?} / {type:"circle", center:"O", radius:2 | through:"A"} / {type:"angle", at:"B", from:"A", to:"C", label:"θ"} / {type:"line", through:["A","B"]} / {type:"label", at:"A", text:"…"} / {type:"right-angle", at, from, to}。坐标范围由 view [xmin,xmax,ymin,ymax] 指定，省略自动。

类别：数学与科学；性质：visual；别名：`construction` `geo`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `points` **必填** | any |  | 命名点 {A:[x,y], …} |
| `shapes` **必填** | any[] |  | 按顺序绘制的图元 |
| `view` | number[] |  | [xmin, xmax, ymin, ymax] |
| `showPoints` | boolean | `true` | 显示点与点名 |

示例：
```json
{"type":"geometry","points":{"A":[0,0],"B":[4,0],"C":[0,3]},"shapes":[{"type":"polygon","points":["A","B","C"]},{"type":"right-angle","at":"A","from":"B","to":"C"},{"type":"label","between":["B","C"],"text":"c"}]}
```

### `transform` — 线性变换

平面网格在 2×2 矩阵作用下连续变形（基向量、单位面积随之变化）。

matrix: [[a,b],[c,d]]。vectors: [[x,y]…] 额外向量。showDet 显示行列式面积。

类别：数学与科学；性质：visual；别名：`lineartransform` `matrixtransform`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `matrix` **必填** | number[][] |  | 2×2 矩阵 |
| `vectors` | number[][] |  | 额外向量 |
| `showDet` | boolean | `true` | 显示单位方格面积（行列式） |
| `range` | integer | `6` | 网格半宽 |

示例：
```json
{"type":"transform","matrix":[[1,1],[0,1]]}
```

### `vectorfield` — 向量场

二维向量场箭头 + 流线粒子。

fx, fy 为分量表达式（变量 x, y）。range 为 [xmin,xmax,ymin,ymax]。

类别：数学与科学；性质：visual；别名：`field` `flowfield`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `fx` **必填** | expr |  | x 分量 |
| `fy` **必填** | expr |  | y 分量 |
| `range` | number[] |  | [xmin,xmax,ymin,ymax] |
| `particles` | boolean | `true` | 流线粒子 |

示例：
```json
{"type":"vectorfield","fx":"-y","fy":"x"}
```

### `fourier` — 傅里叶圆

旋转圆（周转圆）叠加描绘图形，展示傅里叶级数。

shape: heart 心形 / square 方波 / star 星 / infinity 无穷 / note 音符 / custom（配合 path SVG 路径）。terms 为圆的数量（5–200）。

类别：数学与科学；性质：visual；别名：`epicycles`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `shape` | "heart" / "square" / "star" / "infinity" / "note" / "custom" | `"heart"` | 目标图形 |
| `path` | string |  | 自定义 SVG path（shape=custom） |
| `terms` | integer | `40` | 项数 |
| `cycles` | number | `1` | 绘制圈数 |

示例：
```json
{"type":"fourier","shape":"heart","terms":60}
```

### `simulation` — 物理模拟

确定性物理模拟：单摆、双摆、抛体、轨道、弹簧、波、干涉、随机游走。

preset 选择模型，params 微调（如 pendulum: {length, angle, damping}；projectile: {speed, angle, g}；orbit: {bodies}；wave: {frequency, amplitude}）。同一时间点总是渲染同一画面，可精确导出。

类别：数学与科学；性质：visual；别名：`physics` `pendulum` `orbit` `wave` `projectile`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `preset` | "pendulum" / "double-pendulum" / "projectile" / "orbit" / "spring" / "wave" / "interference" / "random-walk" | `"pendulum"` | 模型 |
| `params` | any |  | 模型参数 |
| `trail` | boolean | `true` | 轨迹 |
| `labels` | boolean | `true` | 显示物理量标注 |

示例：
```json
{"type":"simulation","preset":"double-pendulum"}
```

## 3D

### `globe` — 地球

3D 地球：点阵大陆、城市标记、飞线弧，缓慢转向焦点。

points: [{lat, lon, label?, value?}]；arcs: [{from:[lat,lon], to:[lat,lon]}] 或 {from:"城市名", to:"城市名"}（内置约 80 个主要城市坐标）；focus: [lat, lon] 或城市名。style: dots 点阵、solid 实体、wire 线框。

类别：3D；性质：visual；别名：`earth` `world` `map3d`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `points` | any[] |  | 标记点 |
| `arcs` | any[] |  | 飞线 |
| `focus` | any |  | 镜头焦点 [lat, lon] 或城市名 |
| `style` | "auto" / "dots" / "solid" / "wire" | `"auto"` | 样式 |
| `spin` | number | `1` | 自转速度倍率 |

示例：
```json
{"type":"globe","points":["北京","纽约","伦敦","新加坡"],"arcs":[{"from":"北京","to":"纽约"},{"from":"北京","to":"伦敦"}],"focus":"北京"}
```

### `bars3d` — 3D 柱状

3D 柱状矩阵，镜头环绕，柱体逐个升起。

data 同 chart（labels × series 构成网格），或一维数据单行显示。

类别：3D；性质：visual；别名：`chart3d` `bar3d`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `data` **必填** | data |  | 数据 |
| `suffix` | string |  | 单位 |
| `highlight` | any |  | 强调 |

示例：
```json
{"type":"bars3d","data":{"labels":["Q1","Q2","Q3","Q4"],"series":[{"name":"华东","values":[3,5,6,9]},{"name":"华南","values":[2,4,7,8]}]}}
```

### `surface` — 曲面

3D 函数曲面 z=f(x,y)，色带映射，镜头环绕。

expr 用变量 x, y（可含随时间变化的 t 产生波动）。range: [min,max] 同时作用于 x 与 y。

类别：3D；性质：visual；别名：`surface3d` `plot3d`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `expr` **必填** | expr |  | z = f(x, y) |
| `range` | range |  | 定义域 |
| `animate` | boolean | `false` | 随时间波动（表达式含 t） |

示例：
```json
{"type":"surface","expr":"sin(sqrt(x^2+y^2)*2)/ (1+0.3*(x^2+y^2))","range":[-4,4]}
```

### `particles` — 粒子

3D 粒子场：星系、球体、波浪，或聚合成文字。

shape: galaxy 星系 / sphere 球壳 / wave 波浪 / text（聚合成 text 文字）/ network 网络连线。

类别：3D；性质：visual；别名：`starfield` `galaxy`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `shape` | "galaxy" / "sphere" / "wave" / "text" / "network" | `"galaxy"` | 形态 |
| `text` | string |  | shape=text 时的文字 |
| `count` | integer | `6000` | 粒子数 |

示例：
```json
{"type":"particles","shape":"text","text":"MOTIF"}
```

### `shape3d` — 3D 主视觉

抽象 3D 主视觉物体（扭结、二十面体、玻璃球、圆环），主题材质与灯光。

用于封面或章节页的视觉焦点。material: glass 玻璃、metal 金属、matte 哑光、wire 线框、glow 发光。

类别：3D；性质：visual；别名：`hero3d` `object3d`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `shape` | "torusknot" / "icosahedron" / "sphere" / "torus" / "blob" / "cube" / "rings" | `"torusknot"` | 形状 |
| `material` | "auto" / "glass" / "metal" / "matte" / "wire" / "glow" | `"auto"` | 材质 |
| `color` | color |  | 主色 |

示例：
```json
{"type":"shape3d","shape":"torusknot","material":"glass"}
```

### `model` — 3D 模型

导入 glTF/GLB 模型，影棚灯光转台展示。

asset 为 .glb/.gltf 资源。rotate 自动转台。

类别：3D；性质：visual；别名：`gltf` `glb` `product3d`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `asset` **必填** | asset |  | 模型资源 ID |
| `rotate` | boolean | `true` | 转台 |
| `angle` | number |  | 初始角度（度） |

示例：
```json
{"type":"model","asset":"ast_product"}
```

### `molecule` — 分子

3D 球棍分子模型。

preset: water 水、co2 二氧化碳、methane 甲烷、ethanol 乙醇、benzene 苯、caffeine 咖啡因、glucose 葡萄糖、dna 双螺旋片段；或 atoms: [{el:"C", x,y,z}] + bonds: [[i,j,order]]。

类别：3D；性质：visual；别名：`chemistry` `atom`

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `preset` | "water" / "co2" / "methane" / "ethanol" / "benzene" / "caffeine" / "glucose" / "dna" | `"caffeine"` | 预设分子 |
| `atoms` | any[] |  | 自定义原子 |
| `bonds` | any[] |  | 自定义化学键 |
| `labels` | boolean | `true` | 显示元素符号 |

示例：
```json
{"type":"molecule","preset":"caffeine"}
```

## 所有块通用参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `id` | string |  | 稳定的块 ID（自动生成）。用于操作与动画覆盖。 |
| `slot` | "auto" / "main" / "media" / "aside" / "header" / "footer" | `"auto"` | 放入布局的哪个区域。auto 时按块类型自动分配（文字→main，视觉→media）。 |
| `frame` | { x, y, w, h } |  | 手动定位（覆盖自动布局）。人在编辑器里拖动元素时写入。 |
| `motion` | { enter, delay, at, speed, emphasis, exit } |  | 动画覆盖。通常留空，交给主题的动画语言。 |
| `style` | { color, scale, align, card } |  | 局部样式覆盖。 |
| `key` | string |  | 变形（morph）键：相邻场景中 key 相同的块会在 morph 转场中平滑过渡。 |
| `hidden` | boolean | `false` | 隐藏该块 |
| `locked` | boolean | `false` | 在编辑器中锁定 |
