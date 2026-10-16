# 场景、版式、转场与动画（自动生成）

## 场景字段

| 字段 | 说明 |
| --- | --- |
| `layout` | 版式，默认 `auto`（见下表） |
| `blocks` | 内容块数组。也可以用简写：把块类型作为字段名，如 `{"title":"…","bullets":[…],"chart":{…}}` |
| `duration` | `"auto"`（按动画与阅读时间自动计算，推荐）或秒数 |
| `transition` | 进入本场景的转场：`"auto"`、类型字符串或 `{type, duration, direction, color}` |
| `tone` | `auto` / `base` / `inverse` / `accent`：场景色调，用于制造节奏 |
| `background` | `auto` 或 `{type, …}`（见背景表），也可直接写颜色 |
| `camera` | `auto` / `none` / `drift` / `push` / `pull` / `pan` |
| `variant` | 版式变体：`{flip: true}` 左右交换，`{align: "center"}`，`{ratio: 0.45}` 文字栏比例 |
| `notes` | 演讲者备注 |
| `narration` | 旁白：字符串或 `{text, asset}`；开启 `style.captions` 时显示字幕 |
| `guide` | 讲解指针：光标依次圈出/划线/指向内容的局部，配合每步讲解词（见下文） |

## 版式 layout

| ID | 名称 | 说明 |
| --- | --- | --- |
| `auto` | 自动 | 根据块的组合自动选择版式（推荐）。 |
| `cover` | 封面 | 大标题 + 副标题，开场或结尾。可放一个视觉块作背景或侧图（3D 主视觉、图片）。 |
| `section` | 章节页 | 章节编号 + 标题，用于段落之间的节奏停顿。 |
| `split` | 左右分栏 | 一侧文字（标题/要点），一侧视觉（图表/图片/3D）。variant.flip 交换左右。竖屏自动变为上下。 |
| `focus` | 视觉聚焦 | 小标题在上，视觉块占据大部分画面。适合重点图表、公式、3D。 |
| `stack` | 上下堆叠 | 标题在上，内容全宽依次排列。适合要点、表格、时间线。 |
| `grid` | 网格 | 标题 + 多个同类块等分网格（多个数字、多张图）。 |
| `full` | 全屏 | 视觉块铺满画面（图片/3D/模拟），标题叠加在角落，自动加暗化以保证可读。 |
| `quote` | 引言 | 居中大号引言。 |
| `closing` | 结尾 | 致谢/行动号召 + 联系方式。 |
| `free` | 自由 | 所有块按 frame 手动定位（编辑器中拖拽）。 |

## 转场 transition

| ID | 名称 | 说明 |
| --- | --- | --- |
| `auto` | 自动 | 由主题与内容关系决定（同章节柔和、跨章节更强）。 |
| `cut` | 硬切 | 直接切换。 |
| `fade` | 交叉溶解 | 两场景交叉淡化。 |
| `dip` | 黑场/色场 | 先淡入纯色（color，默认背景色）再淡出。 |
| `push` | 推移 | 新场景把旧场景推出画面。direction: left/right/up/down。 |
| `slide` | 覆盖滑入 | 新场景从一侧滑入覆盖旧场景，旧场景轻微后退变暗。 |
| `wipe` | 擦除 | 柔边擦除。direction 指定方向。 |
| `band` | 色带扫过 | 一条主题强调色带扫过画面完成切换（动态设计常用）。 |
| `stripes` | 条纹 | 多条彩色条纹依次扫过。 |
| `iris` | 圆形展开 | 圆形从中心（或 origin）展开新场景。 |
| `zoom` | 穿梭缩放 | 旧场景放大淡出，新场景从稍小处浮现。 |
| `blur` | 失焦 | 旧场景失焦淡出，新场景由模糊变清晰。 |
| `scan` | 扫描 | 一条亮线扫过并揭示新场景（科技/蓝图风格）。 |
| `ink` | 墨晕 | 以噪声纹理溶解，如墨在宣纸上晕开（水墨风格）。 |
| `morph` | 变形 | key 相同的块在两场景间平滑变形（位置、尺寸、颜色），其余内容交叉溶解。 |

## 背景 background

| type | 名称 | 参数 |
| --- | --- | --- |
| `auto` | 主题默认 | 使用主题背景。 |
| `solid` | 纯色 | color: 颜色 |
| `gradient` | 渐变 | colors: 颜色数组；angle: 角度 |
| `aurora` | 极光辉光 | colors: 光斑颜色；intensity: 强度 0–1 |
| `paper` | 纸张 | grain: 颗粒；fibers: 纤维 |
| `grid` | 网格线 | columns: 列数 |
| `blueprint` | 蓝图网格 |  |
| `vignette` | 暗角 |  |
| `ink` | 水墨 | mountains: 远山浓度 |
| `pop` | 波普几何 |  |
| `soft` | 柔和渐变 |  |
| `noir` | 电影暗场 |  |
| `blobs` | 有机色块 | colors: 颜色 |
| `image` | 图片 | asset: 图片资源；overlay: 暗化 0–1；blur: 模糊 px |

## 入场动画 motion.enter

| ID | 效果 |
| --- | --- |
| `auto` | 由主题决定 |
| `none` | 无动画（直接出现） |
| `fade` | 淡入 |
| `rise` | 上浮淡入 |
| `rise-blur` | 上浮 + 去模糊 |
| `drop` | 下落淡入 |
| `slide-left` | 自右向左滑入 |
| `slide-right` | 自左向右滑入 |
| `mask-up` | 遮罩内上移揭示（逐行） |
| `mask-left` | 遮罩内横移揭示 |
| `wipe` | 柔边擦除 |
| `scale` | 缩放淡入 |
| `pop` | 弹性弹出 |
| `pop-soft` | 柔和弹出 |
| `slam` | 放大砸入（带回弹） |
| `focus` | 失焦到清晰（电影感） |
| `blur` | 去模糊 |
| `type` | 打字机 |
| `write` | 书写（逐字淡入 + 微模糊） |
| `ink` | 墨晕显现 |
| `brush` | 笔刷扫出 |
| `draw` | 描线绘制（图形/图标） |

## 镜头 camera

- `auto`：主题默认
- `none`：固定
- `drift`：缓慢漂移（视差）
- `push`：缓慢推近
- `pull`：缓慢拉远
- `pan`：横向平移

## 画幅 format

- `16:9`：1920×1080，横屏 16:9（视频/演示）
- `9:16`：1080×1920，竖屏 9:16（短视频）
- `1:1`：1080×1080，方形 1:1（社交）
- `4:5`：1080×1350，竖版 4:5（信息流）
- `4:3`：1440×1080，传统 4:3
- `21:9`：2520×1080，超宽 21:9（电影）

## 讲解指针 guide（场景级）

讲公式、图表、步骤时，不要让一页静止很久：给场景加 `guide`，一支虚拟光标会依次移到目标处并画出标注（圈、下划线、荧光笔…），节奏跟着每步的 `say`（旁白）走。场景时长会自动延长以容纳全部步骤。

```json
"guide": {
  "cursor": "arrow",
  "steps": [
    { "target": "b_eq", "part": "a^2", "do": "underline", "say": "先看第一项，a 的平方" },
    { "target": "b_eq", "part": "c^2", "do": "circle", "note": "斜边", "say": "等号右边是斜边 c 的平方" },
    { "target": "b_plot", "part": [3, 4], "do": "point", "say": "代入 3 和 4 正好落在这里" }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `cursor` | `arrow` 鼠标箭头 · `pen` 画笔 · `laser` 激光点 · `hand` 手指 · `none` 不显示光标（默认 arrow） |
| `steps[].target` | 目标块：块 ID、序号（1 起）或类型名（如 `"equation"`）；省略时指向场景主体 |
| `steps[].part` | 目标的局部：公式中的 LaTeX 片段（`"c^2"`、`"\\frac{a}{b}"`）、文字片段（`"关键词"`）、条目序号（`2`）、图表分类名或序号、函数图上的坐标 `[x, y]`、几何图中的点名（`"A"`）或两点（`"AB"`）；省略则为整个块 |
| `steps[].nth` | part 出现多次时取第几处（1 起，默认 1） |
| `steps[].do` | `point` 指向 · `circle` 圈出 · `underline` 下划线 · `highlight` 荧光笔 · `box` 框选 · `arrow` 箭头 · `focus` 聚光 · `cross` 划掉 · `check` 打勾 |
| `steps[].say` | 这一步的讲解词：决定停留时长（约每秒 4.5 字）；开启 `style.captions` 时作为字幕显示 |
| `steps[].note` | 标注旁的小标签（≤ 8 字最佳） |
| `steps[].at` | 指定开始时间（场景内秒数）；默认紧接上一步 |
| `steps[].hold` | 停留秒数（覆盖按 say 估算的时长） |
| `steps[].keep` | true：标注保留到场景结束（默认下一步开始时淡出） |
| `steps[].color` | 标注颜色（默认主题强调色；cross 用 negative，check 用 positive） |

要点：每步只讲一个点；`say` 写成口语短句；同一场景 3–6 步为宜。公式的 part 要与 latex 中的写法一致（如 latex 是 `a^2 + b^2 = c^2`，part 用 `"b^2"`）。
