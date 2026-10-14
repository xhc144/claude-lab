// Operations API — the single way documents change. The editor, the CLI, the MCP server and the
// in-app AI assistant all express edits as ops, so every change is validated, atomic, undoable
// and recorded in history with its author.
import { normalizeDocument, normalizeScene, normalizeBlock, validateDocument, findScene } from './doc.js';
import { THEMES } from './themes/index.js';
import { formatFromAspect } from './catalog/scene.js';
import { clone, deepMerge, setPath, getPath, isPlainObject, uid, suggest } from './util/misc.js';

class OpError extends Error {
  constructor(message, hint) { super(message); this.hint = hint; }
}

function sceneIndex(doc, ref, name = 'scene') {
  if (ref == null) throw new OpError(`缺少 ${name}`, '用场景 ID（如 s_ab12cd）或 1 起始的序号');
  const s = findScene(doc, ref);
  if (!s) throw new OpError(`找不到场景 ${JSON.stringify(ref)}`, `现有场景：${doc.scenes.map((x, i) => `${i + 1}:${x.id}`).join(', ') || '（无）'}`);
  return doc.scenes.indexOf(s);
}

function locateBlock(doc, ref, sceneRef) {
  const scenes = sceneRef != null ? [doc.scenes[sceneIndex(doc, sceneRef)]] : doc.scenes;
  for (const s of scenes) {
    let i = -1;
    if (typeof ref === 'number' || /^\d+$/.test(String(ref))) { if (sceneRef != null) i = Number(ref) - 1; }
    else i = s.blocks.findIndex((b) => b.id === ref || (b.key && b.key === ref));
    if (i >= 0 && s.blocks[i]) return { scene: s, index: i, block: s.blocks[i] };
  }
  const all = doc.scenes.flatMap((s) => s.blocks.map((b) => b.id));
  const sg = suggest(String(ref), all);
  throw new OpError(`找不到块 ${JSON.stringify(ref)}`, sg ? `是否是 ${sg}？` : '用 motif show <项目> 查看块 ID');
}

function insertIndex(list, op, doc, isScene) {
  if (op.position != null) return Math.max(0, Math.min(list.length, Number(op.position) - 1));
  if (op.at != null) return Math.max(0, Math.min(list.length, Number(op.at)));
  if (op.after != null) {
    const i = isScene ? sceneIndex(doc, op.after, 'after') : list.findIndex((b) => b.id === op.after);
    if (i < 0) throw new OpError(`找不到 after=${op.after}`);
    return i + 1;
  }
  if (op.before != null) {
    const i = isScene ? sceneIndex(doc, op.before, 'before') : list.findIndex((b) => b.id === op.before);
    if (i < 0) throw new OpError(`找不到 before=${op.before}`);
    return i;
  }
  return list.length;
}

/** Op catalog: params are documented for the CLI/MCP tool schema and the Skill reference. */
export const OPS = {
  set_title: {
    desc: '修改作品标题', params: { title: '新标题' },
    apply(d, op) { if (!op.title) throw new OpError('title 不能为空'); d.title = String(op.title); },
  },
  set_theme: {
    desc: '切换主题与强调色。theme 为主题 ID；accent 为 #hex 强调色；overrides 为主题令牌深度覆盖（高级）。',
    params: { theme: '主题 ID（aurora/editorial/swiss/blueprint/lumen/ink/pop/corporate/noir/meadow 或用户主题）', accent: '可选强调色 #hex（null 清除）', overrides: '可选，主题令牌覆盖' },
    apply(d, op) {
      if (op.theme) d.theme.id = op.theme;
      if (op.accent !== undefined) { if (op.accent === null) delete d.theme.accent; else d.theme.accent = op.accent; }
      if (op.overrides !== undefined) d.theme.overrides = op.overrides === null ? undefined : deepMerge(d.theme.overrides || {}, op.overrides);
      if (op.theme && !THEMES[op.theme] && !op.allowUserTheme) d.theme.id = op.theme; // user themes are resolved by the store
    },
  },
  set_style: {
    desc: '全局风格参数：energy 0–1（动画节奏与强度），density airy/normal/compact，camera，transition，captions/progress/pageNumbers 开关。',
    params: { energy: '0–1', density: 'airy | normal | compact', camera: 'auto | none | drift | push | pull | pan', transition: '默认转场类型或 auto', captions: 'boolean', progress: 'boolean', pageNumbers: 'boolean' },
    apply(d, op) { const { op: _o, ...rest } = op; d.style = { ...d.style, ...rest }; },
  },
  set_format: {
    desc: '画幅：aspect 16:9 / 9:16 / 1:1 / 4:5 / 4:3 / 21:9，或 width/height；fps。版式会自动重排。',
    params: { aspect: '画幅比例', width: '宽', height: '高', fps: '帧率' },
    apply(d, op) {
      if (op.aspect) { const f = formatFromAspect(op.aspect); if (!f) throw new OpError(`不支持的画幅 ${op.aspect}`, '可用：16:9, 9:16, 1:1, 4:5, 4:3, 21:9'); d.format = { ...d.format, width: f.width, height: f.height, aspect: f.aspect }; }
      if (op.width) d.format.width = Number(op.width);
      if (op.height) d.format.height = Number(op.height);
      if (op.fps) d.format.fps = Number(op.fps);
      if (op.width || op.height) delete d.format.aspect;
    },
  },
  set_brand: {
    desc: '品牌信息：name、footer、logo（资源 ID）。', params: { name: '品牌名', footer: '页脚文字', logo: '资源 ID' },
    apply(d, op) { const { op: _o, ...rest } = op; d.brand = { ...d.brand, ...rest }; },
  },
  set_audio: {
    desc: '背景音乐：music {asset, volume 0–1, fadeIn, fadeOut, start}；传 null 移除。', params: { music: '{asset, volume, fadeIn, fadeOut}' },
    apply(d, op) { if (op.music === null) delete d.audio.music; else d.audio.music = { volume: 0.7, fadeIn: 1, fadeOut: 2, ...(d.audio.music || {}), ...op.music }; },
  },
  add_scene: {
    desc: '添加场景。scene 为场景对象（可用简写，如 {"title":"…","bullets":[…]}）；position 为 1 起始的位置，或用 after/before 指定相邻场景。',
    params: { scene: '场景对象', position: '1 起始位置（可选）', after: '在此场景之后（可选）', before: '在此场景之前（可选）' },
    apply(d, op, res) {
      const s = normalizeScene(op.scene ?? {}, res.warnings, 'scene');
      if (d.scenes.some((x) => x.id === s.id)) s.id = uid('s', 6);
      d.scenes.splice(insertIndex(d.scenes, op, d, true), 0, s);
      res.id = s.id;
    },
  },
  update_scene: {
    desc: '修改场景属性（深度合并）。set 可含 layout/duration/transition/background/camera/tone/variant/notes/narration/name；若含 blocks 则整体替换块列表。',
    params: { scene: '场景 ID 或序号', set: '要修改的字段' },
    apply(d, op, res) {
      const i = sceneIndex(d, op.scene);
      const set = op.set || {};
      const merged = { ...deepMerge(d.scenes[i], { ...set, blocks: undefined }), blocks: set.blocks ?? d.scenes[i].blocks };
      for (const k of Object.keys(set)) if (set[k] === null) delete merged[k];
      d.scenes[i] = normalizeScene(merged, res.warnings, `scenes[${i}]`);
      res.id = d.scenes[i].id;
    },
  },
  remove_scene: {
    desc: '删除场景。', params: { scene: '场景 ID 或序号' },
    apply(d, op, res) { const i = sceneIndex(d, op.scene); res.id = d.scenes[i].id; d.scenes.splice(i, 1); },
  },
  move_scene: {
    desc: '移动场景到 position（1 起始）。', params: { scene: '场景', position: '目标位置（1 起始）' },
    apply(d, op, res) {
      const i = sceneIndex(d, op.scene);
      const [s] = d.scenes.splice(i, 1);
      const to = Math.max(0, Math.min(d.scenes.length, Number(op.position ?? op.to ?? 1) - 1));
      d.scenes.splice(to, 0, s);
      res.id = s.id;
    },
  },
  duplicate_scene: {
    desc: '复制场景（新 ID），插入到原场景之后。', params: { scene: '场景' },
    apply(d, op, res) {
      const i = sceneIndex(d, op.scene);
      const s = clone(d.scenes[i]);
      s.id = uid('s', 6);
      s.blocks.forEach((b) => { b.id = uid('b', 6); });
      d.scenes.splice(i + 1, 0, s);
      res.id = s.id;
    },
  },
  add_block: {
    desc: '在场景中添加内容块。block 为块对象（type + 参数）；position 为 1 起始位置，或 after/before 块 ID。',
    params: { scene: '场景', block: '块对象', position: '1 起始位置（可选）', after: '块 ID（可选）', before: '块 ID（可选）' },
    apply(d, op, res) {
      const s = d.scenes[sceneIndex(d, op.scene)];
      const b = normalizeBlock(op.block, res.warnings, 'block');
      if (!b) throw new OpError('block 无效');
      if (d.scenes.some((x) => x.blocks.some((y) => y.id === b.id))) b.id = uid('b', 6);
      s.blocks.splice(insertIndex(s.blocks, op, d, false), 0, b);
      res.id = b.id;
    },
  },
  update_block: {
    desc: '修改块参数（深度合并；数组整体替换；值为 null 删除该参数）。可改 type 以外的任何参数，包括 motion/style/frame。',
    params: { block: '块 ID', scene: '可选：场景（配合序号定位）', set: '要修改的参数' },
    apply(d, op, res) {
      const loc = locateBlock(d, op.block, op.scene);
      const merged = deepMerge(loc.block, op.set || {});
      if (op.set?.type && op.set.type !== loc.block.type) merged.type = op.set.type;
      loc.scene.blocks[loc.index] = normalizeBlock(merged, res.warnings, 'block');
      loc.scene.blocks[loc.index].id = loc.block.id;
      res.id = loc.block.id;
    },
  },
  replace_block: {
    desc: '用新块整体替换（保留 ID），可改变类型。', params: { block: '块 ID', with: '新块对象' },
    apply(d, op, res) {
      const loc = locateBlock(d, op.block, op.scene);
      const b = normalizeBlock({ ...(op.with || {}), id: loc.block.id }, res.warnings, 'block');
      loc.scene.blocks[loc.index] = b;
      res.id = b.id;
    },
  },
  remove_block: {
    desc: '删除块。', params: { block: '块 ID' },
    apply(d, op, res) { const loc = locateBlock(d, op.block, op.scene); loc.scene.blocks.splice(loc.index, 1); res.id = loc.block.id; },
  },
  move_block: {
    desc: '移动块：position 为目标位置（1 起始）；to_scene 可移到另一个场景。', params: { block: '块 ID', position: '目标位置', to_scene: '目标场景（可选）' },
    apply(d, op, res) {
      const loc = locateBlock(d, op.block, op.scene);
      loc.scene.blocks.splice(loc.index, 1);
      const target = op.to_scene != null ? d.scenes[sceneIndex(d, op.to_scene, 'to_scene')] : loc.scene;
      const to = op.position != null ? Math.max(0, Math.min(target.blocks.length, Number(op.position) - 1)) : target.blocks.length;
      target.blocks.splice(to, 0, loc.block);
      res.id = loc.block.id;
    },
  },
  set: {
    desc: '按路径设置任意字段（JSON Pointer，如 /scenes/0/blocks/1/text 或 scenes.0.duration）。高级用法。', params: { path: '路径', value: '新值' },
    apply(d, op) { if (!op.path) throw new OpError('缺少 path'); Object.assign(d, setPath(d, op.path, op.value)); },
  },
  remove: {
    desc: '按路径删除字段或数组元素。', params: { path: '路径' },
    apply(d, op) { if (getPath(d, op.path) === undefined) throw new OpError(`路径 ${op.path} 不存在`); Object.assign(d, setPath(d, op.path, undefined)); },
  },
  add_asset: {
    desc: '登记资源元数据（文件复制由 motif assets add 完成）。', params: { asset: '{id, kind, file, name, width, height, duration}' },
    apply(d, op, res) {
      const a = { ...(op.asset || {}) };
      if (!a.file) throw new OpError('asset.file 必填');
      a.id = a.id || uid('ast', 6);
      d.assets[a.id] = a;
      res.id = a.id;
    },
  },
  remove_asset: {
    desc: '移除资源登记。', params: { asset: '资源 ID' },
    apply(d, op, res) { if (!d.assets[op.asset]) throw new OpError(`资源 ${op.asset} 不存在`); delete d.assets[op.asset]; res.id = op.asset; },
  },
  replace_document: {
    desc: '用完整文档替换（会保留项目 ID 与资源）。适合一次性写入整套场景。', params: { document: '文档对象' },
    apply(d, op, res) {
      const n = normalizeDocument(op.document || {});
      res.warnings.push(...n.warnings);
      const keep = { id: d.id, meta: d.meta, assets: { ...d.assets, ...(n.doc.assets || {}) } };
      for (const k of Object.keys(d)) delete d[k];
      Object.assign(d, n.doc, keep);
    },
  },
};

const OP_ALIASES = { add_slide: 'add_scene', update_slide: 'update_scene', remove_scene: 'remove_scene', delete_scene: 'remove_scene', delete_block: 'remove_block', edit_block: 'update_block', set_block: 'update_block', modify_block: 'update_block', insert_block: 'add_block', insert_scene: 'add_scene', theme: 'set_theme', style: 'set_style', format: 'set_format', aspect: 'set_format', title: 'set_title', rename: 'set_title' };

/**
 * Apply a batch of ops atomically.
 * @returns {{ ok, doc, results:[{op, ok, id?, error?, hint?}], warnings, issues }}
 */
export function applyOps(doc, ops, { partial = false, author } = {}) {
  const list = Array.isArray(ops) ? ops : ops?.ops ? ops.ops : [ops];
  const d = clone(doc);
  const results = [];
  const warnings = [];
  let failed = false;
  for (const raw of list) {
    let op = raw;
    if (typeof op === 'string') { try { op = JSON.parse(op); } catch { op = { op: '?' }; } }
    const name = OP_ALIASES[op?.op] || op?.op;
    const def = OPS[name];
    const res = { op: name || op?.op, ok: true, warnings: [] };
    if (!def) {
      const sg = suggest(String(op?.op), Object.keys(OPS));
      Object.assign(res, { ok: false, error: `未知操作 "${op?.op}"`, hint: sg ? `是否是 "${sg}"？` : `可用：${Object.keys(OPS).join(', ')}` });
      failed = true;
    } else {
      const snapshot = partial ? clone(d) : null;
      try { def.apply(d, op, res); }
      catch (e) {
        Object.assign(res, { ok: false, error: e.message, hint: e.hint });
        failed = true;
        if (partial && snapshot) { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, snapshot); }
      }
    }
    warnings.push(...res.warnings);
    delete res.warnings;
    results.push(res);
    if (failed && !partial) break;
  }
  if (failed && !partial) return { ok: false, doc, results, warnings, issues: [] };
  const n = normalizeDocument(d);
  const out = n.doc;
  out.meta = { ...out.meta, updatedAt: new Date().toISOString(), ...(author ? { lastAuthor: author } : {}) };
  const issues = validateDocument(out);
  return { ok: !failed, doc: out, results, warnings: [...warnings, ...n.warnings], issues };
}

/** Machine-readable op schema (for tool definitions). */
export function opsSchema() {
  return Object.entries(OPS).map(([name, d]) => ({ op: name, description: d.desc, params: d.params }));
}
