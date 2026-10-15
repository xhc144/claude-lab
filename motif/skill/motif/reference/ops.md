# 编辑操作 ops（自动生成）

用 `motif apply <项目> ops.json` 或 MCP 工具 `motif_apply_ops` 提交一组操作；整组原子执行，任一失败则全部不生效并返回错误与提示。场景可用 ID（`s_xxxx`）或 1 起始序号引用；块用 ID（`b_xxxx`）引用。

### `set_title`

修改作品标题

- `title`：新标题

### `set_theme`

切换主题与强调色。theme 为主题 ID；accent 为 #hex 强调色；overrides 为主题令牌深度覆盖（高级）。

- `theme`：主题 ID（aurora/editorial/swiss/blueprint/lumen/ink/pop/corporate/noir/meadow 或用户主题）
- `accent`：可选强调色 #hex（null 清除）
- `overrides`：可选，主题令牌覆盖

### `set_style`

全局风格参数：energy 0–1（动画节奏与强度），density airy/normal/compact，camera，transition，captions/progress/pageNumbers 开关。

- `energy`：0–1
- `density`：airy | normal | compact
- `camera`：auto | none | drift | push | pull | pan
- `transition`：默认转场类型或 auto
- `captions`：boolean
- `progress`：boolean
- `pageNumbers`：boolean

### `set_format`

画幅：aspect 16:9 / 9:16 / 1:1 / 4:5 / 4:3 / 21:9，或 width/height；fps。版式会自动重排。

- `aspect`：画幅比例
- `width`：宽
- `height`：高
- `fps`：帧率

### `set_brand`

品牌信息：name、footer、logo（资源 ID）。

- `name`：品牌名
- `footer`：页脚文字
- `logo`：资源 ID

### `set_audio`

背景音乐：music {asset, volume 0–1, fadeIn, fadeOut, start}；传 null 移除。

- `music`：{asset, volume, fadeIn, fadeOut}

### `add_scene`

添加场景。scene 为场景对象（可用简写，如 {"title":"…","bullets":[…]}）；position 为 1 起始的位置，或用 after/before 指定相邻场景。

- `scene`：场景对象
- `position`：1 起始位置（可选）
- `after`：在此场景之后（可选）
- `before`：在此场景之前（可选）

### `update_scene`

修改场景属性（深度合并）。set 可含 layout/duration/transition/background/camera/tone/variant/notes/narration/name/guide（讲解指针，整体替换；null 删除）；若含 blocks 则整体替换块列表。

- `scene`：场景 ID 或序号
- `set`：要修改的字段

### `remove_scene`

删除场景。

- `scene`：场景 ID 或序号

### `move_scene`

移动场景到 position（1 起始）。

- `scene`：场景
- `position`：目标位置（1 起始）

### `duplicate_scene`

复制场景（新 ID），插入到原场景之后。

- `scene`：场景

### `add_block`

在场景中添加内容块。block 为块对象（type + 参数）；position 为 1 起始位置，或 after/before 块 ID。

- `scene`：场景
- `block`：块对象
- `position`：1 起始位置（可选）
- `after`：块 ID（可选）
- `before`：块 ID（可选）

### `update_block`

修改块参数（深度合并；数组整体替换；值为 null 删除该参数）。可改 type 以外的任何参数，包括 motion/style/frame。

- `block`：块 ID
- `scene`：可选：场景（配合序号定位）
- `set`：要修改的参数

### `replace_block`

用新块整体替换（保留 ID），可改变类型。

- `block`：块 ID
- `with`：新块对象

### `remove_block`

删除块。

- `block`：块 ID

### `move_block`

移动块：position 为目标位置（1 起始）；to_scene 可移到另一个场景。

- `block`：块 ID
- `position`：目标位置
- `to_scene`：目标场景（可选）

### `set`

按路径设置任意字段（JSON Pointer，如 /scenes/0/blocks/1/text 或 scenes.0.duration）。高级用法。

- `path`：路径
- `value`：新值

### `remove`

按路径删除字段或数组元素。

- `path`：路径

### `add_asset`

登记资源元数据（文件复制由 motif assets add 完成）。

- `asset`：{id, kind, file, name, width, height, duration}

### `remove_asset`

移除资源登记。

- `asset`：资源 ID

### `replace_document`

用完整文档替换（会保留项目 ID 与资源）。适合一次性写入整套场景。

- `document`：文档对象

