// Generates human/AI-readable reference docs from the live catalogs, so documentation can never
// drift from what the software actually accepts.
import { guideMarkdown } from './guide.js';
import { COMPONENTS, CATEGORY_LABELS } from './components.js';
import { COMMON_BLOCK_PARAMS } from './spec.js';
import { LAYOUTS, TRANSITIONS, BACKGROUNDS, MOTIONS, CAMERAS, FORMATS } from './scene.js';
import { THEMES } from '../themes/index.js';
import { OPS } from '../ops.js';

function typeStr(p) {
  switch (p.type) {
    case 'enum': return p.values.map((v) => JSON.stringify(v)).join(' / ');
    case 'array': return `${p.item ? typeStr(p.item) : 'any'}[]`;
    case 'object': return p.fields ? `{ ${Object.keys(p.fields).join(', ')} }` : 'object';
    case 'richtext': return 'string (rich)';
    default: return p.type;
  }
}

export function paramTable(params) {
  const rows = Object.entries(params).map(([k, p]) => `| \`${k}\`${p.required ? ' **必填**' : ''} | ${typeStr(p)} | ${p.default !== undefined ? '`' + JSON.stringify(p.default) + '`' : ''} | ${(p.desc || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
  return ['| 参数 | 类型 | 默认 | 说明 |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

export function componentDoc(type, { examples = true } = {}) {
  const c = COMPONENTS[type];
  if (!c) return null;
  const lines = [`### \`${type}\` — ${c.label}`, '', `${c.summary}`, '', c.description, '', `类别：${CATEGORY_LABELS[c.category] || c.category}；性质：${c.nature}${Object.keys(c.aliases || {}).length ? `；别名：${Object.keys(c.aliases).map((a) => `\`${a}\``).join(' ')}` : ''}`, '', paramTable(c.params)];
  if (examples && c.examples?.length) {
    lines.push('', '示例：');
    for (const ex of c.examples) lines.push('```json', JSON.stringify(ex), '```');
  }
  return lines.join('\n');
}

export function catalogMarkdown() {
  const out = ['# 组件目录（自动生成）', '', '每个场景由若干块（block）组成。块写成 `{"type": "<类型>", ...参数}`。以下参数之外，所有块都接受通用参数（见文末）。', ''];
  const byCat = {};
  for (const [type, c] of Object.entries(COMPONENTS)) (byCat[c.category] ||= []).push(type);
  for (const [cat, types] of Object.entries(byCat)) {
    out.push(`## ${CATEGORY_LABELS[cat] || cat}`, '');
    for (const t of types) out.push(componentDoc(t), '');
  }
  out.push('## 所有块通用参数', '', paramTable(COMMON_BLOCK_PARAMS));
  return out.join('\n');
}

export function sceneMarkdown() {
  const lines = ['# 场景、版式、转场与动画（自动生成）', '', '## 场景字段', '',
    '| 字段 | 说明 |', '| --- | --- |',
    '| `layout` | 版式，默认 `auto`（见下表） |',
    '| `blocks` | 内容块数组。也可以用简写：把块类型作为字段名，如 `{"title":"…","bullets":[…],"chart":{…}}` |',
    '| `duration` | `"auto"`（按动画与阅读时间自动计算，推荐）或秒数 |',
    '| `transition` | 进入本场景的转场：`"auto"`、类型字符串或 `{type, duration, direction, color}` |',
    '| `tone` | `auto` / `base` / `inverse` / `accent`：场景色调，用于制造节奏 |',
    '| `background` | `auto` 或 `{type, …}`（见背景表），也可直接写颜色 |',
    '| `camera` | `auto` / `none` / `drift` / `push` / `pull` / `pan` |',
    '| `variant` | 版式变体：`{flip: true}` 左右交换，`{align: "center"}`，`{ratio: 0.45}` 文字栏比例 |',
    '| `notes` | 演讲者备注 |',
    '| `narration` | 旁白：字符串或 `{text, asset}`；开启 `style.captions` 时显示字幕 |',
    '| `guide` | 讲解指针：光标依次圈出/划线/指向内容的局部，配合每步讲解词（见下文） |',
    '', '## 版式 layout', '', '| ID | 名称 | 说明 |', '| --- | --- | --- |',
    ...Object.entries(LAYOUTS).map(([k, v]) => `| \`${k}\` | ${v.label} | ${v.description} |`),
    '', '## 转场 transition', '', '| ID | 名称 | 说明 |', '| --- | --- | --- |',
    ...Object.entries(TRANSITIONS).map(([k, v]) => `| \`${k}\` | ${v.label} | ${v.description} |`),
    '', '## 背景 background', '', '| type | 名称 | 参数 |', '| --- | --- | --- |',
    ...Object.entries(BACKGROUNDS).map(([k, v]) => `| \`${k}\` | ${v.label} | ${v.params ? Object.entries(v.params).map(([a, b]) => `${a}: ${b}`).join('；') : v.description || ''} |`),
    '', '## 入场动画 motion.enter', '', '| ID | 效果 |', '| --- | --- |',
    ...Object.entries(MOTIONS).map(([k, v]) => `| \`${k}\` | ${v} |`),
    '', '## 镜头 camera', '', ...Object.entries(CAMERAS).map(([k, v]) => `- \`${k}\`：${v}`),
    '', '## 画幅 format', '', ...Object.entries(FORMATS).map(([k, v]) => `- \`${k}\`：${v.width}×${v.height}，${v.label}`),
    '', guideMarkdown(),
  ];
  return lines.join('\n');
}

export function themesMarkdown() {
  const lines = ['# 主题（自动生成）', '', '主题是完整的设计系统：配色、字体角色、字号比例、卡片样式、背景生成器、图表风格和动画性格（缓动、节奏、入场词汇、镜头、转场）。切换主题即整体换风格；`accent` 可覆盖强调色。', ''];
  for (const t of Object.values(THEMES)) {
    lines.push(`## \`${t.id}\` — ${t.name}`, '', t.description, '',
      `- 色调：${t.scheme === 'dark' ? '深色' : '浅色'}；关键词：${t.mood.join('、')}`,
      `- 主色：背景 ${t.palette.bg}，文字 ${t.palette.ink}，强调 ${t.palette.accent}${t.palette.accent2 ? ` / ${t.palette.accent2}` : ''}`,
      `- 字体：标题 ${t.fonts.display.family[0].replace('Motif ', '')}，正文 ${t.fonts.text.family[0].replace('Motif ', '')}`,
      `- 动画性格：${t.motion.personality}（入场 ${t.motion.enter}，标题 ${t.motion.titleEnter}，转场 ${t.motion.transition.type}，镜头 ${t.motion.camera.type}）`, '');
  }
  return lines.join('\n');
}

export function opsMarkdown() {
  const lines = ['# 编辑操作 ops（自动生成）', '', '用 `motif apply <项目> ops.json` 或 MCP 工具 `motif_apply_ops` 提交一组操作；整组原子执行，任一失败则全部不生效并返回错误与提示。场景可用 ID（`s_xxxx`）或 1 起始序号引用；块用 ID（`b_xxxx`）引用。', ''];
  for (const [k, v] of Object.entries(OPS)) {
    lines.push(`### \`${k}\``, '', v.desc, '', ...Object.entries(v.params).map(([p, d]) => `- \`${p}\`：${d}`), '');
  }
  return lines.join('\n');
}
