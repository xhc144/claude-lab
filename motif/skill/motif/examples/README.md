# 示例

完整作品文档（可直接 `motif new "标题" --from <文件> --json` 创建，然后 lint / preview / export）：

| 文件 | 作品 | 主题 · 画幅 | 场景 | 展示的能力 |
| --- | --- | --- | --- | --- |
| `01-product-launch.json` | Motif Cloud 发布 | aurora · 16:9 | 8 | 3D 主视觉、痛点数字、能力网格、增长图表、全球网络、证言 |
| `02-annual-report.json` | 星云科技 2025 年度报告 | editorial · 16:9 | 12 | 数据叙事：关键数字、折线与注释、构成、排名、表格、里程碑、对比 |
| `03-math-lesson.json` | 从勾股定理到傅里叶 | lumen · 16:9 | 8 | 公式书写与推导、几何作图、函数与积分面积、傅里叶级数、物理模拟 |
| `04-vertical-short.json` | 一年省下 1095 小时 | pop · 9:16 | 6 | 9:16 短视频节奏：钩子、大数字、三个要点、图表、行动号召 |
| `05-tech-architecture.json` | 实时数据管道重构 | blueprint · 16:9 | 8 | 技术讲解：流程图、层级结构、代码、矩阵、3D 柱状、步骤 |

编辑操作示例（`motif apply <项目> <文件>`）在 `ops/` 中，每个文件开头的 `//` 说明在 JSON 外的 README 里：

- `ops/refine.json`：精简文案、改版式、加章节页、调整节奏
- `ops/restyle.json`：换主题与强调色、改为竖屏、提高能量
- `ops/data-update.json`：更新图表数据、加注释、强调最新一期

典型流程：

```bash
motif new "Motif Cloud 发布" --from examples/01-product-launch.json --agent claude --json
motif lint "Motif Cloud 发布" --json
motif preview "Motif Cloud 发布" --out sheet.jpg
motif export "Motif Cloud 发布" --format mp4 --quality high --json
```
