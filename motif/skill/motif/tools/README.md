# 工具定义（函数调用）

Motif 的全部能力以 20 个工具暴露，三种格式内容相同：

| 文件 | 用于 |
| --- | --- |
| `openai.json` | OpenAI 兼容的 function calling：OpenAI、DeepSeek、通义千问（DashScope 兼容模式）、Kimi、智谱 GLM、Ollama、LM Studio… |
| `anthropic.json` | Anthropic Messages API 的 `tools` 参数 |
| `mcp.json` | MCP `tools/list` 的结果（也可直接运行 `motif mcp` 启动 MCP 服务器） |

## 执行工具调用

模型返回工具调用后，用 CLI 执行并把输出作为工具结果返回给模型：

```bash
motif call <name> '<arguments JSON>' --json
```

渲染类工具（`motif_preview`、`motif_render_still`）的结果里有 `out` 图片路径；支持识图的模型可以把图片一并回传，用于自我检查。

## 工具一览

- `motif_list_projects`：列出素材库中的所有项目（ID、标题、主题、画幅、场景数、修订号）。
- `motif_list_templates`：列出内置与用户模板。用模板创建项目是最快得到高质量结构的方式。
- `motif_list_themes`：列出主题（设计系统）及其风格说明，用于选择 theme。
- `motif_catalog`：查询组件参考文档。不带参数返回组件列表；component 为类型名（如 chart、timeline、equation）返回详细参数；也可传 "scene"（版式/转场/动画）、"themes"、"ops"。
- `motif_create_project`：新建项目。可指定 template（模板 ID）或 document（完整文档对象）；theme、aspect（16:9/9:16/1:1/4:5）、accent（#hex）可选。返回项目 ID。
- `motif_get_project`：读取项目：默认返回摘要（场景与块的 ID、类型、要点）；full=true 返回完整 JSON 文档。修改前先读取以获得 ID。
- `motif_apply_ops`：对项目原子地应用一组编辑操作（add_scene / update_scene / remove_scene / move_scene / add_block / update_block / remove_block / set_theme / set_style / set_format / set …）。任一失败则全部不生效并返回错误与提示。用 motif_catalog("ops") 查看全部操作。
- `motif_write_document`：用完整文档替换项目内容（保留项目 ID 与资源）。适合一次写入整套场景。
- `motif_lint`：设计检查：结构校验 + 版面检查（文字溢出、重叠、文字密度、时长、对比度、节奏）。修改后务必运行。
- `motif_preview`：渲染所有场景的定格画面拼成一张联系表（PNG），用于目视检查整体设计。返回图片。
- `motif_render_still`：渲染单帧图片。scene 为场景序号或 ID，at 为 end（动画完成后，默认）/ start / mid / 秒数。返回图片。
- `motif_export`：导出成品：format 为 mp4 / webm / mov / gif / png（帧序列）/ pdf（讲义）/ html（可离线播放的交互演示）。返回文件路径。
- `motif_analyze_files`：分析素材文件（pptx/docx/xlsx/pdf/md/txt/csv/json/图片），返回结构化大纲：章节、要点、表格（含图表建议）、关键数字、图片。
- `motif_auto_create`：一步完成：分析素材 → 自动设计 → 新建项目。之后可用 motif_get_project / motif_apply_ops 精修。
- `motif_import_asset`：把本地文件（图片/视频/音频/3D 模型）导入项目，返回资源 ID，供 image.asset / video.asset / model.asset / audio.music.asset 引用。
- `motif_list_components`：列出用户保存的可复用组件（块或整场景）。
- `motif_insert_component`：把已保存的组件插入项目（块插入到 scene，场景插入到 position）。
- `motif_save_component`：把项目中的块或场景保存为可复用组件。
- `motif_history`：查看项目修订历史（谁在何时做了什么）。
- `motif_restore`：把项目恢复到某个修订（会生成新修订，不丢失历史）。

## 接入 MCP

```bash
claude mcp add motif -- motif mcp          # Claude Code
```

其他客户端（Codex、Claude Desktop、Cursor、Cherry Studio…）在 MCP 配置中添加命令 `motif mcp`。Motif 应用的「设置 → AI 集成」会给出本机的完整配置。
