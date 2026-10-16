# CLI 参考（自动生成）

```
律影 Motif 0.10.0 — 动态视觉创作 CLI（人类与 AI 共用）

用法: motif <命令> [参数] [--json]

项目
  list                                 列出素材库中的项目
  new [标题] [--template ID] [--theme ID] [--aspect 16:9] [--accent #hex] [--from doc.json]
  show <项目> [--full]                  查看摘要（--full 输出完整 JSON）
  apply <项目> <ops.json | ->           应用编辑操作（原子；- 表示从标准输入读取）
  write <项目> <doc.json | ->           用完整文档替换内容
  validate <项目 | doc.json>            结构校验
  open <项目>                           在编辑器中打开
  delete <项目>                         移入回收站
  duplicate <项目> [--title]

检查与渲染
  lint <项目>                           设计检查（溢出/重叠/密度/时长/对比度/节奏）
  preview <项目> [--out sheet.png]      渲染全部场景联系表
  still <项目> [--scene N] [--at end|start|mid|秒] [--out f.png] [--scale 1]
  export <项目> [--format mp4|webm|mov|gif|png|pdf|html] [--out 路径] [--quality high|standard|small]
                [--fps 30] [--width 1920] [--range 0,10] [--mute]
  thumb <项目>                          更新库缩略图

素材与智能设计
  analyze <文件…>                       分析 pptx/docx/xlsx/pdf/md/txt/csv/json/图片 → 结构化大纲
  auto <文件…> [--title] [--theme] [--aspect]   分析 + 自动设计 → 新项目
  assets <项目> [list | add <文件…> | remove <ID…>]

复用与历史
  templates [list | show <ID> | save <项目> --name 名称 | delete <ID>]
  components [list | show <ID> | save <项目> --block <ID>|--scene <N> --name 名称 | insert <项目> --component <ID> [--scene N] | delete <ID>]
  themes [list | show <ID> | save <theme.json>]
  history <项目> [list | restore <修订> | name <标签> | show <修订>]

参考与集成
  catalog [组件类型 | scene | themes | ops]   组件/版式/主题/操作参考文档
  icons [--search 关键词]               可用图标名
  schema                               文档与操作的结构说明（JSON）
  tools [--format mcp|openai|anthropic] 输出工具定义（函数调用）
  call <工具名> <参数JSON>               直接调用一个工具（与 MCP 相同）
  mcp                                  启动 MCP 服务器（stdio）
  config [键] [值]                      查看/设置配置（library、ffmpegPath）
  doctor                               环境检查

全局参数
  --json            输出 JSON
  --library <目录>  指定素材库（等同环境变量 MOTIF_HOME）
  --agent <名称>    写入历史的作者名（默认 ai；环境变量 MOTIF_AGENT）
  -m, --message     写入历史的说明

示例
  motif new "季度复盘" --template annual-report --theme editorial
  echo '[{"op":"set_theme","theme":"swiss"}]' | motif apply 季度复盘 -
  motif lint 季度复盘 && motif preview 季度复盘 --out sheet.png
  motif export 季度复盘 --format mp4 --quality high
```

## 机器可读输出

- 任何命令加 `--json` 输出 JSON；失败时输出 `{"ok": false, "error": "…", "hint": "…"}`。
- 退出码：`0` 成功；`2` 参数/用法错误；`3` 操作失败或检查有 error（项目保持不变）；其他为运行错误。
- `apply` / `write` 的结果：`{ ok, saved, revision, results: [{op, ok, id, error, hint}], warnings, issues }`。`results[i].id` 是新建或修改的场景/块 ID。
- `lint` 的结果：`{ duration, scenes: [...], issues: [{level, scene, sceneIndex, block, message, hint}], counts }`。
- `show --json` 返回摘要与全部 ID；`show --full --json` 返回完整文档。

## 直接调用工具

`motif call <工具名> '<参数 JSON>'` 与 MCP 工具完全相同，例如：

```bash
motif call motif_apply_ops '{"project":"季度复盘","ops":[{"op":"set_theme","theme":"swiss"}]}'
```

工具清单见 `tools/`。
