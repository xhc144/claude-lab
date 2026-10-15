// Tool definitions for LLM function calling (MCP, OpenAI, Anthropic). One source of truth: each
// tool maps onto a command implementation in commands.js.
import * as cmd from './commands.js';
import fs from 'node:fs';

const S = (props, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });
const str = (description, extra) => ({ type: 'string', description, ...extra });
const num = (description) => ({ type: 'number', description });
const bool = (description) => ({ type: 'boolean', description });
const PROJECT = str('项目 ID（如 prj_ab12cd34）、标题或项目目录路径');

export const TOOLS = [
  { name: 'motif_list_projects', description: '列出素材库中的所有项目（ID、标题、主题、画幅、场景数、修订号）。', input: S({}), run: () => cmd.list() },
  { name: 'motif_list_templates', description: '列出内置与用户模板。用模板创建项目是最快得到高质量结构的方式。', input: S({}), run: () => cmd.templates('list') },
  { name: 'motif_list_themes', description: '列出主题（设计系统）及其风格说明，用于选择 theme。', input: S({}), run: () => cmd.themes('list') },
  { name: 'motif_catalog', description: '查询组件参考文档。不带参数返回组件列表；component 为类型名（如 chart、timeline、equation）返回详细参数；也可传 "scene"（版式/转场/动画）、"themes"、"ops"。', input: S({ component: str('组件类型或 scene / themes / ops') }), run: (a) => cmd.catalog(a.component, { json: false }) },
  { name: 'motif_create_project', description: '新建项目。可指定 template（模板 ID）或 document（完整文档对象）；theme、aspect（16:9/9:16/1:1/4:5）、accent（#hex）可选。返回项目 ID。', input: S({ title: str('标题'), template: str('模板 ID'), theme: str('主题 ID'), aspect: str('画幅'), accent: str('强调色 #hex'), document: { type: 'object', description: '完整文档（可用场景简写）' } }), run: (a) => cmd.create({ ...a, from: a.document }) },
  { name: 'motif_get_project', description: '读取项目：默认返回摘要（场景与块的 ID、类型、要点）；full=true 返回完整 JSON 文档。修改前先读取以获得 ID。', input: S({ project: PROJECT, full: bool('返回完整文档') }, ['project']), run: (a) => cmd.show(a.project, { full: a.full }) },
  { name: 'motif_apply_ops', description: '对项目原子地应用一组编辑操作（add_scene / update_scene / remove_scene / move_scene / add_block / update_block / remove_block / set_theme / set_style / set_format / set …）。任一失败则全部不生效并返回错误与提示。用 motif_catalog("ops") 查看全部操作。', input: S({ project: PROJECT, ops: { type: 'array', items: { type: 'object' }, description: '操作数组，如 [{"op":"update_block","block":"b_x","set":{"text":"…"}}]' }, message: str('写入历史的说明') }, ['project', 'ops']), run: (a) => cmd.apply(a.project, a.ops, { message: a.message }) },
  { name: 'motif_write_document', description: '用完整文档替换项目内容（保留项目 ID 与资源）。适合一次写入整套场景。', input: S({ project: PROJECT, document: { type: 'object', description: '文档对象' } }, ['project', 'document']), run: (a) => cmd.write(a.project, a.document) },
  { name: 'motif_lint', description: '设计检查：结构校验 + 版面检查（文字溢出、重叠、文字密度、时长、对比度、节奏）。修改后务必运行。', input: S({ project: PROJECT }, ['project']), run: (a) => cmd.lint(a.project) },
  { name: 'motif_preview', description: '渲染所有场景的定格画面拼成一张联系表（PNG），用于目视检查整体设计。返回图片。', input: S({ project: PROJECT }, ['project']), image: true, run: async (a) => { const { dir } = (await import('../core/store/index.js')).loadProject(a.project); return cmd.preview(a.project, { scale: 0.3, maxWidth: 1600, out: `${dir}/exports/preview-sheet.jpg` }); } },
  { name: 'motif_render_still', description: '渲染单帧图片。scene 为场景序号或 ID，at 为 end（动画完成后，默认）/ start / mid / 秒数。返回图片。', input: S({ project: PROJECT, scene: str('场景序号或 ID'), at: str('end | start | mid | 场景内秒数') }, ['project']), image: true, run: async (a) => { const { dir } = (await import('../core/store/index.js')).loadProject(a.project); return cmd.still(a.project, { scene: a.scene || 1, at: a.at, scale: 0.5, out: `${dir}/exports/still-${String(a.scene || 1).replace(/[^\w]/g, '')}.jpg` }); } },
  { name: 'motif_export', description: '导出成品：format 为 mp4 / webm / mov / gif / png（帧序列）/ pdf（讲义）/ html（可离线播放的交互演示）。返回文件路径。', input: S({ project: PROJECT, format: str('格式', { enum: ['mp4', 'webm', 'mov', 'gif', 'png', 'pdf', 'html'] }), out: str('输出路径（可选）'), quality: str('high | standard | small'), width: num('输出宽度（可选）') }, ['project']), run: (a) => cmd.exportProject(a.project, a) },
  { name: 'motif_analyze_files', description: '分析素材文件（pptx/docx/xlsx/pdf/md/txt/csv/json/图片），返回结构化大纲：章节、要点、表格（含图表建议）、关键数字、图片。', input: S({ files: { type: 'array', items: { type: 'string' }, description: '文件路径' } }, ['files']), run: (a) => cmd.analyze(a.files) },
  { name: 'motif_auto_create', description: '一步完成：分析素材 → 自动设计 → 新建项目。之后可用 motif_get_project / motif_apply_ops 精修。', input: S({ files: { type: 'array', items: { type: 'string' } }, title: str('标题'), theme: str('主题'), aspect: str('画幅') }, ['files']), run: (a) => cmd.auto(a.files, a) },
  { name: 'motif_import_asset', description: '把本地文件（图片/视频/音频/3D 模型）导入项目，返回资源 ID，供 image.asset / video.asset / model.asset / audio.music.asset 引用。', input: S({ project: PROJECT, file: str('文件路径') }, ['project', 'file']), run: (a) => cmd.assets(a.project, 'add', [a.file]) },
  { name: 'motif_list_components', description: '列出用户保存的可复用组件（块或整场景）。', input: S({}), run: () => cmd.components('list') },
  { name: 'motif_insert_component', description: '把已保存的组件插入项目（块插入到 scene，场景插入到 position）。', input: S({ project: PROJECT, component: str('组件 ID'), scene: str('目标场景（块组件）'), position: num('位置（1 起始）') }, ['project', 'component']), run: (a) => cmd.components('insert', a.project, a) },
  { name: 'motif_save_component', description: '把项目中的块或场景保存为可复用组件。', input: S({ project: PROJECT, block: str('块 ID'), scene: str('场景 ID 或序号'), name: str('名称') }, ['project', 'name']), run: (a) => cmd.components('save', a.project, a) },
  { name: 'motif_history', description: '查看项目修订历史（谁在何时做了什么）。', input: S({ project: PROJECT }, ['project']), run: (a) => cmd.history(a.project, 'list') },
  { name: 'motif_restore', description: '把项目恢复到某个修订（会生成新修订，不丢失历史）。', input: S({ project: PROJECT, revision: num('修订号') }, ['project', 'revision']), run: (a) => cmd.history(a.project, 'restore', a.revision) },
];

export function toolSchemas(format = 'mcp') {
  if (format === 'openai') return TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input } }));
  if (format === 'anthropic') return TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input }));
  return TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input }));
}

/** Run a tool and shape its output as MCP content (text + optional image). */
export async function callTool(name, args = {}) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`未知工具 ${name}`);
  const result = await t.run(args || {});
  const content = [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 1) }];
  if (t.image && result?.out && fs.existsSync(result.out)) content.push({ type: 'image', data: fs.readFileSync(result.out).toString('base64'), mimeType: /\.jpe?g$/i.test(result.out) ? 'image/jpeg' : 'image/png' });
  return { content, result };
}
