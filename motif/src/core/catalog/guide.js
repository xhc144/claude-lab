// Explanation pointer ("讲解指针"): a scene-level track of steps. A virtual cursor glides to each
// target — a block, or a part of it such as one term of a formula, a phrase, a list item, a point
// on a plot — and draws a mark there (circle, underline, highlight…) while the narration for that
// step plays. It turns a long, static explanation into a guided walk through the content.
import { isPlainObject, suggest } from '../util/misc.js';

export const GUIDE_ACTIONS = {
  point: { label: '指向', desc: '光标移到目标处停留并轻点' },
  circle: { label: '圈出', desc: '手绘椭圆圈住目标' },
  underline: { label: '下划线', desc: '在目标下方手绘一道线' },
  highlight: { label: '荧光笔', desc: '用半透明荧光笔涂过目标' },
  box: { label: '框选', desc: '手绘圆角矩形框住目标' },
  arrow: { label: '箭头', desc: '从空白处画一支弧形箭头指向目标' },
  focus: { label: '聚光', desc: '压暗其余内容，只留目标' },
  cross: { label: '划掉', desc: '划掉目标（错误/排除）' },
  check: { label: '打勾', desc: '在目标旁打勾（正确/确认）' },
};

export const GUIDE_CURSORS = {
  arrow: { label: '鼠标箭头' },
  pen: { label: '画笔' },
  laser: { label: '激光点' },
  hand: { label: '手指' },
  none: { label: '不显示光标' },
};

const ACTION_ALIAS = { pointer: 'point', tap: 'point', click: 'point', hover: 'point', ring: 'circle', ellipse: 'circle', oval: 'circle', line: 'underline', 'under-line': 'underline', marker: 'highlight', mark: 'highlight', hl: 'highlight', rect: 'box', square: 'box', frame: 'box', spotlight: 'focus', dim: 'focus', strike: 'cross', strikethrough: 'cross', x: 'cross', tick: 'check', ok: 'check', 圈: 'circle', 圈出: 'circle', 下划线: 'underline', 划线: 'underline', 高亮: 'highlight', 荧光笔: 'highlight', 框: 'box', 框选: 'box', 箭头: 'arrow', 指向: 'point', 聚光: 'focus', 划掉: 'cross', 打勾: 'check' };

export function resolveAction(a) {
  if (a == null) return null;
  const k = String(a).trim();
  if (GUIDE_ACTIONS[k]) return k;
  if (GUIDE_ACTIONS[k.toLowerCase()]) return k.toLowerCase();
  return ACTION_ALIAS[k.toLowerCase()] || ACTION_ALIAS[k] || null;
}

const STEP_KEYS = new Set(['target', 'part', 'nth', 'do', 'note', 'say', 'at', 'hold', 'keep', 'color']);

/** Normalise one step. Accepts {do}, {action}, {type}, or the action itself as key: {circle: "b_x"}. */
export function normalizeStep(input, warnings = [], path = 'step') {
  let s = typeof input === 'string' ? { say: input } : isPlainObject(input) ? { ...input } : null;
  if (!s) return null;
  if (s.do == null) {
    const alt = s.action ?? s.type ?? s.mark;
    if (alt != null) s.do = alt;
    else {
      const k = Object.keys(s).find((key) => resolveAction(key) && !STEP_KEYS.has(key));
      if (k) { if (s.target == null && (typeof s[k] === 'string' || typeof s[k] === 'number')) s.target = s[k]; s.do = k; delete s[k]; }
    }
  }
  delete s.action; delete s.type; delete s.mark;
  if (s.target == null && (s.block ?? s.on) != null) s.target = s.block ?? s.on;
  delete s.block; delete s.on;
  if (s.text != null && s.say == null) s.say = s.text;
  delete s.text;
  const a = resolveAction(s.do ?? 'point');
  if (!a) {
    const sug = suggest(String(s.do), Object.keys(GUIDE_ACTIONS));
    warnings.push({ level: 'warning', path: `${path}.do`, message: `未知讲解动作 "${s.do}"，已改为 point`, hint: sug ? `是否是 "${sug}"？` : `可用：${Object.keys(GUIDE_ACTIONS).join(' / ')}` });
  }
  s.do = a || 'point';
  if (typeof s.at === 'string') s.at = s.at === 'auto' ? undefined : parseFloat(s.at);
  if (s.at != null && !Number.isFinite(s.at)) delete s.at;
  if (s.hold != null && !Number.isFinite(+s.hold)) delete s.hold; else if (s.hold != null) s.hold = +s.hold;
  for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
  return s;
}

/** Normalise scene.guide: an array of steps is shorthand for {steps}. */
export function normalizeGuide(input, warnings = [], path = 'guide') {
  if (input == null || input === false) return undefined;
  let g = Array.isArray(input) ? { steps: input } : isPlainObject(input) ? { ...input } : null;
  if (!g) { warnings.push({ level: 'warning', path, message: 'guide 应为对象 {cursor, steps} 或步骤数组，已忽略' }); return undefined; }
  if (!Array.isArray(g.steps)) g.steps = [];
  g.steps = g.steps.map((s, i) => normalizeStep(s, warnings, `${path}.steps[${i}]`)).filter(Boolean);
  if (g.cursor != null && !GUIDE_CURSORS[g.cursor]) {
    const sug = suggest(String(g.cursor), Object.keys(GUIDE_CURSORS));
    warnings.push({ level: 'warning', path: `${path}.cursor`, message: `未知光标 "${g.cursor}"，已改为 arrow`, hint: sug ? `是否是 "${sug}"？` : undefined });
    g.cursor = 'arrow';
  }
  if (!g.steps.length && !g.cursor) return undefined;
  return g;
}

/** Find the block a step targets: block id, 1-based index, block type, or (none) the main visual. */
export function guideTarget(scene, target) {
  const blocks = (scene.blocks || []).filter((b) => !b.hidden);
  if (target == null || target === '') return blocks.find((b) => b.type !== 'title') || blocks[0] || null;
  const byId = blocks.find((b) => b.id === target);
  if (byId) return byId;
  if (typeof target === 'number' || /^\d+$/.test(String(target))) return blocks[Number(target) - 1] || null;
  return blocks.find((b) => b.type === target) || blocks.find((b) => b.key === target) || null;
}

/** Seconds a step lingers: narration length at ~4.5 CJK characters (≈2.6 English words) per second. */
export function sayDuration(say) {
  const s = String(say || '').replace(/[*=~`]/g, '');
  if (!s.trim()) return 0;
  const cjk = (s.match(/[㐀-鿿豈-﫿]/g) || []).length;
  const words = (s.replace(/[㐀-鿿豈-﫿]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return cjk / 4.5 + words / 2.6 + 0.35;
}

export function validateGuide(scene, path, issues = []) {
  const g = scene.guide;
  if (g == null) return issues;
  if (!isPlainObject(g) || !Array.isArray(g.steps)) { issues.push({ level: 'error', path, message: 'guide 应为 {cursor, steps: [...]}' }); return issues; }
  if (g.cursor != null && !GUIDE_CURSORS[g.cursor]) issues.push({ level: 'warning', path: `${path}.cursor`, message: `未知光标 ${g.cursor}`, hint: `可用：${Object.keys(GUIDE_CURSORS).join(' / ')}` });
  g.steps.forEach((s, i) => {
    const p = `${path}.steps[${i}]`;
    if (!GUIDE_ACTIONS[s.do]) issues.push({ level: 'error', path: `${p}.do`, message: `未知讲解动作 ${s.do}`, hint: `可用：${Object.keys(GUIDE_ACTIONS).join(' / ')}` });
    if (!guideTarget(scene, s.target)) issues.push({ level: 'error', path: `${p}.target`, message: s.target == null ? '场景没有可指向的内容块' : `讲解目标 "${s.target}" 不在本场景中`, hint: '用本场景中块的 ID（motif_get_project 可查）、序号（1 起）或类型名' });
    if (s.at != null && !(typeof s.at === 'number' && s.at >= 0)) issues.push({ level: 'error', path: `${p}.at`, message: 'at 应为场景内秒数（≥0）或省略（自动）' });
    if (s.part != null && !(typeof s.part === 'string' || typeof s.part === 'number' || (Array.isArray(s.part) && s.part.length === 2 && s.part.every((v) => typeof v === 'number')))) issues.push({ level: 'warning', path: `${p}.part`, message: 'part 应为文字片段、LaTeX 片段、条目序号或 [x, y] 坐标' });
  });
  return issues;
}

export function guideMarkdown() {
  return [
    '## 讲解指针 guide（场景级）',
    '',
    '讲公式、图表、步骤时，不要让一页静止很久：给场景加 `guide`，一支虚拟光标会依次移到目标处并画出标注（圈、下划线、荧光笔…），节奏跟着每步的 `say`（旁白）走。场景时长会自动延长以容纳全部步骤。',
    '',
    '```json',
    '"guide": {',
    '  "cursor": "arrow",',
    '  "steps": [',
    '    { "target": "b_eq", "part": "a^2", "do": "underline", "say": "先看第一项，a 的平方" },',
    '    { "target": "b_eq", "part": "c^2", "do": "circle", "note": "斜边", "say": "等号右边是斜边 c 的平方" },',
    '    { "target": "b_plot", "part": [3, 4], "do": "point", "say": "代入 3 和 4 正好落在这里" }',
    '  ]',
    '}',
    '```',
    '',
    '| 字段 | 说明 |',
    '|---|---|',
    `| \`cursor\` | ${Object.entries(GUIDE_CURSORS).map(([k, v]) => `\`${k}\` ${v.label}`).join(' · ')}（默认 arrow） |`,
    '| `steps[].target` | 目标块：块 ID、序号（1 起）或类型名（如 `"equation"`）；省略时指向场景主体 |',
    '| `steps[].part` | 目标的局部：公式中的 LaTeX 片段（`"c^2"`、`"\\\\frac{a}{b}"`）、文字片段（`"关键词"`）、条目序号（`2`）、图表分类名或序号、函数图上的坐标 `[x, y]`、几何图中的点名（`"A"`）或两点（`"AB"`）；省略则为整个块 |',
    '| `steps[].nth` | part 出现多次时取第几处（1 起，默认 1） |',
    `| \`steps[].do\` | ${Object.entries(GUIDE_ACTIONS).map(([k, v]) => `\`${k}\` ${v.label}`).join(' · ')} |`,
    '| `steps[].say` | 这一步的讲解词：决定停留时长（约每秒 4.5 字）；开启 `style.captions` 时作为字幕显示 |',
    '| `steps[].note` | 标注旁的小标签（≤ 8 字最佳） |',
    '| `steps[].at` | 指定开始时间（场景内秒数）；默认紧接上一步 |',
    '| `steps[].hold` | 停留秒数（覆盖按 say 估算的时长） |',
    '| `steps[].keep` | true：标注保留到场景结束（默认下一步开始时淡出） |',
    '| `steps[].color` | 标注颜色（默认主题强调色；cross 用 negative，check 用 positive） |',
    '',
    '要点：每步只讲一个点；`say` 写成口语短句；同一场景 3–6 步为宜。公式的 part 要与 latex 中的写法一致（如 latex 是 `a^2 + b^2 = c^2`，part 用 `"b^2"`）。',
  ].join('\n');
}
