// The Motif document model: creation, lenient normalisation, validation and summaries.
// Normalisation is deliberately forgiving (aliases, shorthand scenes, loose data shapes) so that
// any model — Claude, DeepSeek, Qwen, Codex — or a human pasting JSON gets a working document.
// What we store is always the canonical, normalised form.
import { COMPONENTS, resolveType, COMPONENT_TYPES } from './catalog/components.js';
import { COMMON_BLOCK_PARAMS } from './catalog/spec.js';
import { LAYOUTS, TRANSITIONS, BACKGROUNDS, MOTIONS, FORMATS, formatFromAspect, CAMERAS } from './catalog/scene.js';
import { THEMES, DEFAULT_THEME } from './themes/index.js';
import { uid, clone, isPlainObject, suggest } from './util/misc.js';
import { isColor } from './util/color.js';

export const DOC_VERSION = 1;

const SCENE_KEYS = new Set(['id', 'name', 'layout', 'variant', 'duration', 'hold', 'transition', 'background', 'camera', 'tone', 'blocks', 'notes', 'narration', 'section', 'hidden']);
const MAIN_PARAM = { title: 'text', text: 'text', quote: 'text', callout: 'text', equation: 'latex', code: 'code', icon: 'name', image: 'asset', stat: 'value', model: 'asset', video: 'asset', particles: 'text' };
const LIST_PARAM = { bullets: 'items', stats: 'items', timeline: 'items', steps: 'items', features: 'items', gallery: 'images', pyramid: 'items', chart: 'data', compare: 'columns', table: 'rows', plot: 'functions' };

export function createDocument({ title = '未命名作品', theme = DEFAULT_THEME, aspect = '16:9', fps = 30, accent, scenes } = {}) {
  const fmt = formatFromAspect(aspect) || { ...FORMATS['16:9'], aspect: '16:9' };
  const now = new Date().toISOString();
  const doc = {
    motif: DOC_VERSION,
    id: uid('prj'),
    title,
    meta: { createdAt: now, updatedAt: now, revision: 0, description: '', tags: [] },
    format: { width: fmt.width, height: fmt.height, fps, aspect: fmt.aspect },
    theme: { id: THEMES[theme] ? theme : DEFAULT_THEME, ...(accent ? { accent } : {}) },
    style: { energy: 0.6, density: 'normal', camera: 'auto', transition: 'auto', captions: false, progress: false, pageNumbers: false },
    brand: {},
    audio: {},
    assets: {},
    scenes: [],
  };
  if (scenes) doc.scenes = scenes;
  return normalizeDocument(doc).doc;
}

/** Normalise a single block (alias resolution, shorthand, per-type normaliser, ids). */
export function normalizeBlock(input, warnings = [], path = 'block') {
  if (input == null) return null;
  let b = typeof input === 'string' ? { type: 'text', text: input } : clone(input);
  if (!isPlainObject(b)) return null;
  if (!b.type && b.component) { b.type = b.component; delete b.component; }
  if (!b.type && b.kind && resolveType(b.kind)) { b.type = b.kind; }
  if (!b.type) {
    const guess = Object.keys(b).find((k) => resolveType(k) && !COMMON_BLOCK_PARAMS[k]);
    if (guess) b = shorthandToBlock(guess, b[guess]) || b;
  }
  const resolved = resolveType(b.type);
  if (!resolved) {
    const s = suggest(b.type, COMPONENT_TYPES);
    warnings.push({ level: 'error', path, message: `未知的块类型 "${b.type}"`, hint: s ? `是否是 "${s}"？` : `可用类型：${COMPONENT_TYPES.join(', ')}` });
    b.type = b.type || 'text';
    if (!b.id) b.id = uid('b', 6);
    return b;
  }
  if (resolved.type !== b.type) {
    for (const [k, v] of Object.entries(resolved.preset)) if (b[k] == null) b[k] = v;
    b.type = resolved.type;
  }
  const spec = COMPONENTS[b.type];
  if (spec.normalize) b = spec.normalize(b) || b;
  if (!b.id) b.id = uid('b', 6);
  b.id = String(b.id);
  // Fill enum defaults lazily: we keep documents small and let the engine apply defaults.
  return b;
}

function shorthandToBlock(key, value) {
  const r = resolveType(key);
  if (!r) return null;
  const type = r.type;
  let block;
  if (isPlainObject(value)) block = { type: key, ...value };
  else if (Array.isArray(value)) block = { type: key, [LIST_PARAM[type] || 'items']: value };
  else block = { type: key, [MAIN_PARAM[type] || 'text']: value };
  if (block.type === key && r.type !== key) { /* alias: keep, normalizeBlock resolves */ }
  return block;
}

/** Convert scene shorthand ({title, subtitle, bullets, chart …}) into blocks. */
function sceneShorthand(scene) {
  const blocks = [];
  const consumed = new Set();
  const titleParts = {};
  for (const k of ['kicker', 'subtitle', 'eyebrow', 'subheading']) if (typeof scene[k] === 'string') { titleParts[k === 'eyebrow' ? 'kicker' : k === 'subheading' ? 'subtitle' : k] = scene[k]; consumed.add(k); }
  for (const [k, v] of Object.entries(scene)) {
    if (SCENE_KEYS.has(k) || consumed.has(k)) continue;
    if (k === 'title' || k === 'heading' || k === 'headline') {
      blocks.push(isPlainObject(v) ? { type: 'title', ...v, ...titleParts } : { type: 'title', text: v, ...titleParts });
      consumed.add(k);
      continue;
    }
    const blk = shorthandToBlock(k, v);
    if (blk) { blocks.push(blk); consumed.add(k); }
  }
  if (!blocks.some((b) => b.type === 'title') && (titleParts.kicker || titleParts.subtitle)) blocks.unshift({ type: 'title', text: titleParts.subtitle || titleParts.kicker });
  for (const k of consumed) delete scene[k];
  return blocks;
}

export function normalizeScene(input, warnings = [], path = 'scene') {
  let s = typeof input === 'string' ? { blocks: [{ type: 'title', text: input }] } : clone(input || {});
  if (!Array.isArray(s.blocks)) {
    const extra = sceneShorthand(s);
    s.blocks = extra;
  } else {
    const extra = sceneShorthand(s);
    if (extra.length) s.blocks = [...extra, ...s.blocks];
  }
  s.blocks = s.blocks.map((b, i) => normalizeBlock(b, warnings, `${path}.blocks[${i}]`)).filter(Boolean);
  if (!s.id) s.id = uid('s', 6);
  s.id = String(s.id);
  if (s.layout == null) s.layout = 'auto';
  if (!LAYOUTS[s.layout]) {
    const alias = { title: 'cover', hero: 'cover', intro: 'cover', divider: 'section', chapter: 'section', twocolumn: 'split', 'two-column': 'split', sidebyside: 'split', center: 'focus', centered: 'focus', visual: 'focus', list: 'stack', column: 'stack', fullscreen: 'full', fullbleed: 'full', bleed: 'full', outro: 'closing', end: 'closing', thanks: 'closing', compare: 'split', comparison: 'stack' }[String(s.layout).toLowerCase()];
    if (alias) s.layout = alias;
    else {
      warnings.push({ level: 'warning', path: `${path}.layout`, message: `未知版式 "${s.layout}"，已改为 auto`, hint: `可用：${Object.keys(LAYOUTS).join(', ')}` });
      s.layout = 'auto';
    }
  }
  if (s.duration == null || s.duration === 'auto') s.duration = 'auto';
  else if (typeof s.duration === 'string') s.duration = parseFloat(s.duration) || 'auto';
  if (typeof s.transition === 'string') s.transition = s.transition === 'auto' ? 'auto' : { type: s.transition };
  if (s.transition == null) s.transition = 'auto';
  if (isPlainObject(s.transition) && !TRANSITIONS[s.transition.type]) {
    const t = suggest(s.transition.type, Object.keys(TRANSITIONS));
    warnings.push({ level: 'warning', path: `${path}.transition`, message: `未知转场 "${s.transition.type}"，已改为 ${t || 'auto'}` });
    s.transition = t ? { ...s.transition, type: t } : 'auto';
  }
  if (typeof s.background === 'string') s.background = s.background === 'auto' ? 'auto' : isColor(s.background) ? { type: 'solid', color: s.background } : { type: s.background };
  if (s.background == null) s.background = 'auto';
  if (typeof s.camera === 'string' && s.camera !== 'auto') s.camera = { type: s.camera };
  if (s.camera == null) s.camera = 'auto';
  if (s.tone == null) s.tone = 'auto';
  if (typeof s.narration === 'string') s.narration = { text: s.narration };
  return s;
}

export function normalizeDocument(input) {
  const warnings = [];
  let d = clone(input || {});
  if (Array.isArray(d)) d = { scenes: d };
  if (!d.motif) d.motif = DOC_VERSION;
  if (!d.id) d.id = uid('prj');
  if (!d.title) d.title = d.name || '未命名作品';
  delete d.name;
  const now = new Date().toISOString();
  d.meta = { createdAt: now, updatedAt: now, revision: 0, description: '', tags: [], ...(d.meta || {}) };
  // format
  let fmt = d.format;
  if (typeof fmt === 'string') fmt = formatFromAspect(fmt) || null;
  if (!fmt && d.aspect) fmt = formatFromAspect(d.aspect);
  fmt = { ...FORMATS['16:9'], aspect: '16:9', fps: 30, ...(fmt || {}) };
  if (fmt.aspect && !fmt.width) Object.assign(fmt, formatFromAspect(fmt.aspect) || {});
  delete fmt.label;
  if (!fmt.aspect || (fmt.width && fmt.height && formatFromAspect(fmt.aspect)?.width / formatFromAspect(fmt.aspect)?.height !== fmt.width / fmt.height)) {
    const r = fmt.width / fmt.height;
    const k = Object.entries(FORMATS).find(([, f]) => Math.abs(f.width / f.height - r) < 0.01);
    fmt.aspect = k ? k[0] : `${fmt.width}:${fmt.height}`;
  }
  d.format = { width: Math.round(fmt.width), height: Math.round(fmt.height), fps: Math.round(fmt.fps || 30), aspect: fmt.aspect };
  delete d.aspect;
  // theme
  if (typeof d.theme === 'string') d.theme = { id: d.theme };
  d.theme = { id: DEFAULT_THEME, ...(d.theme || {}) };
  if (!THEMES[d.theme.id] && !d.theme.custom) {
    const s = suggest(d.theme.id, Object.keys(THEMES));
    if (!d.theme.extends) warnings.push({ level: 'warning', path: 'theme.id', message: `主题 "${d.theme.id}" 不是内置主题`, hint: s ? `是否是 "${s}"？（用户主题需存在于素材库 themes/ 目录）` : `内置主题：${Object.keys(THEMES).join(', ')}` });
  }
  d.style = { energy: 0.6, density: 'normal', camera: 'auto', transition: 'auto', captions: false, progress: false, pageNumbers: false, ...(d.style || {}) };
  if (typeof d.style.energy === 'string') d.style.energy = { low: 0.3, calm: 0.3, medium: 0.6, normal: 0.6, high: 0.85, energetic: 0.85 }[d.style.energy] ?? 0.6;
  d.style.energy = Math.min(1, Math.max(0, Number(d.style.energy)));
  d.brand = d.brand || {};
  d.audio = d.audio || {};
  d.assets = d.assets || {};
  const scenes = Array.isArray(d.scenes) ? d.scenes : Array.isArray(d.slides) ? d.slides : [];
  delete d.slides;
  d.scenes = scenes.map((s, i) => normalizeScene(s, warnings, `scenes[${i}]`));
  // Ensure ids are unique across the document (copy-paste between scenes is common).
  const seen = new Set();
  for (const s of d.scenes) {
    if (seen.has(s.id)) s.id = uid('s', 6);
    seen.add(s.id);
    for (const b of s.blocks) {
      if (seen.has(b.id)) b.id = uid('b', 6);
      seen.add(b.id);
    }
  }
  return { doc: d, warnings };
}

// ───────────────────────────── validation ─────────────────────────────

function checkValue(spec, v, path, issues, doc) {
  if (v == null) return;
  switch (spec.type) {
    case 'string': case 'richtext': case 'latex': case 'expr':
      if (typeof v !== 'string' && typeof v !== 'number') issues.push({ level: 'error', path, message: '应为字符串' });
      break;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) issues.push({ level: 'error', path, message: `应为数字（收到 ${JSON.stringify(v)}）` });
      break;
    case 'integer':
      if (!Number.isInteger(v)) issues.push({ level: 'error', path, message: '应为整数' });
      break;
    case 'boolean':
      if (typeof v !== 'boolean') issues.push({ level: 'warning', path, message: '应为 true/false' });
      break;
    case 'enum':
      if (!spec.values.includes(v)) {
        const s = suggest(v, spec.values.map(String));
        issues.push({ level: 'error', path, message: `取值 ${JSON.stringify(v)} 无效`, hint: s ? `是否是 "${s}"？可选：${spec.values.join(' | ')}` : `可选：${spec.values.join(' | ')}` });
      }
      break;
    case 'color':
      if (typeof v !== 'string' || (!isColor(v) && !/^(accent\d?|ink|muted|faint|bg2?|surface2?|line|positive|negative|warning|data\d)$/.test(v))) issues.push({ level: 'warning', path, message: `颜色 "${v}" 无法识别`, hint: '使用 #hex、rgb()、oklch() 或主题色名 accent/accent2/ink/muted/positive/negative/data0…' });
      break;
    case 'asset':
      if (typeof v === 'string' && doc && !doc.assets?.[v]) issues.push({ level: 'error', path, message: `资源 "${v}" 不存在于项目中`, hint: '先用 motif assets add 导入，或改用 src 写文件路径' });
      break;
    case 'array':
      if (!Array.isArray(v)) { issues.push({ level: 'error', path, message: '应为数组' }); break; }
      if (spec.item && spec.item.type !== 'any') v.forEach((it, i) => {
        if (spec.item.type === 'object' && typeof it === 'string') return; // tolerated shorthand
        checkValue(spec.item, it, `${path}[${i}]`, issues, doc);
      });
      break;
    case 'object':
      if (!isPlainObject(v)) { issues.push({ level: 'error', path, message: '应为对象' }); break; }
      if (spec.fields) for (const [k, fs] of Object.entries(spec.fields)) checkValue(fs, v[k], `${path}.${k}`, issues, doc);
      break;
    case 'range':
      if (!Array.isArray(v) || v.length !== 2 || v.some((x) => typeof x !== 'number')) issues.push({ level: 'error', path, message: '应为 [min, max] 数字区间' });
      else if (v[0] >= v[1]) issues.push({ level: 'error', path, message: '区间 min 应小于 max' });
      break;
    default:
  }
}

export function validateBlock(b, path, doc, issues = []) {
  const spec = COMPONENTS[b.type];
  if (!spec) {
    const s = suggest(b.type, COMPONENT_TYPES);
    issues.push({ level: 'error', path, message: `未知块类型 "${b.type}"`, hint: s ? `是否是 "${s}"？` : undefined });
    return issues;
  }
  for (const [k, ps] of Object.entries(spec.params)) {
    if (ps.required && (b[k] == null || (Array.isArray(b[k]) && !b[k].length && k !== 'edges'))) {
      if (k === 'asset' && (b.src || b.url)) continue;
      issues.push({ level: 'error', path: `${path}.${k}`, message: `${b.type} 缺少必填参数 "${k}"`, hint: ps.desc });
    }
    checkValue(ps, b[k], `${path}.${k}`, issues, doc);
  }
  for (const k of Object.keys(b)) {
    if (k === 'type' || spec.params[k] || COMMON_BLOCK_PARAMS[k]) continue;
    const s = suggest(k, Object.keys(spec.params));
    issues.push({ level: 'warning', path: `${path}.${k}`, message: `${b.type} 不认识参数 "${k}"（将被忽略）`, hint: s ? `是否是 "${s}"？` : `可用参数：${Object.keys(spec.params).join(', ')}` });
  }
  if (b.motion?.enter && !MOTIONS[b.motion.enter]) issues.push({ level: 'warning', path: `${path}.motion.enter`, message: `未知入场动画 "${b.motion.enter}"`, hint: `可用：${Object.keys(MOTIONS).join(', ')}` });
  if (b.type === 'chart') {
    const d = b.data || {};
    if (!d.series?.length || !d.series.some((s) => s.values?.some((v) => v != null) || s.points?.length)) issues.push({ level: 'error', path: `${path}.data`, message: '图表没有可用的数值数据' });
    const n = d.labels?.length || 0;
    if (['pie', 'donut'].includes(b.kind) && n > 8) issues.push({ level: 'warning', path: `${path}.data`, message: `饼/环图有 ${n} 个分类，超过 8 个会难以辨认`, hint: '合并小类为「其他」，或改用 hbar' });
    if (['bar', 'stacked'].includes(b.kind) && n > 16) issues.push({ level: 'warning', path: `${path}.data`, message: `柱状图分类较多（${n}）`, hint: '考虑 line 折线或 hbar 横向条形' });
  }
  return issues;
}

export function validateDocument(doc) {
  const issues = [];
  if (!doc || typeof doc !== 'object') return [{ level: 'error', path: '', message: '文档不是对象' }];
  if (!Array.isArray(doc.scenes)) issues.push({ level: 'error', path: 'scenes', message: 'scenes 应为数组' });
  if (!doc.scenes?.length) issues.push({ level: 'warning', path: 'scenes', message: '作品还没有任何场景' });
  const ids = new Set();
  (doc.scenes || []).forEach((s, i) => {
    const p = `scenes[${i}]`;
    if (ids.has(s.id)) issues.push({ level: 'error', path: `${p}.id`, message: `场景 ID 重复：${s.id}` });
    ids.add(s.id);
    if (!LAYOUTS[s.layout]) issues.push({ level: 'error', path: `${p}.layout`, message: `未知版式 ${s.layout}` });
    if (s.duration !== 'auto' && !(typeof s.duration === 'number' && s.duration > 0 && s.duration < 600)) issues.push({ level: 'error', path: `${p}.duration`, message: 'duration 应为 "auto" 或 0–600 秒的数字' });
    if (isPlainObject(s.transition) && !TRANSITIONS[s.transition.type]) issues.push({ level: 'error', path: `${p}.transition`, message: `未知转场 ${s.transition.type}` });
    if (isPlainObject(s.background) && !BACKGROUNDS[s.background.type]) issues.push({ level: 'warning', path: `${p}.background`, message: `未知背景 ${s.background.type}` });
    if (isPlainObject(s.camera) && !CAMERAS[s.camera.type]) issues.push({ level: 'warning', path: `${p}.camera`, message: `未知镜头 ${s.camera.type}` });
    if (!s.blocks.length) issues.push({ level: 'warning', path: `${p}.blocks`, message: '场景没有内容块' });
    s.blocks.forEach((b, j) => {
      if (ids.has(b.id)) issues.push({ level: 'error', path: `${p}.blocks[${j}].id`, message: `块 ID 重复：${b.id}` });
      ids.add(b.id);
      validateBlock(b, `${p}.blocks[${j}]`, doc, issues);
    });
  });
  if (doc.audio?.music?.asset && !doc.assets?.[doc.audio.music.asset]) issues.push({ level: 'error', path: 'audio.music.asset', message: '背景音乐资源不存在' });
  return issues;
}

// ───────────────────────────── summaries ─────────────────────────────

const strip = (s) => String(s ?? '').replace(/[*=_~`]/g, '').replace(/\s+/g, ' ').trim();
const clip = (s, n = 40) => { const t = strip(s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

export function describeBlock(b) {
  switch (b.type) {
    case 'title': return `title "${clip(b.text)}"${b.kicker ? ` kicker="${clip(b.kicker, 20)}"` : ''}${b.subtitle ? ` sub="${clip(b.subtitle, 30)}"` : ''}`;
    case 'text': case 'quote': case 'callout': return `${b.type} "${clip(b.text, 50)}"`;
    case 'bullets': case 'steps': case 'timeline': case 'features': case 'pyramid':
      return `${b.type}${b.style && b.style !== 'auto' ? `(${b.style})` : ''} ×${b.items?.length || 0}: ${(b.items || []).slice(0, 4).map((i) => clip(i.text ?? i.title ?? i.date, 14)).join(' | ')}`;
    case 'stat': return `stat ${b.prefix || ''}${b.value}${b.suffix || ''} "${clip(b.label, 20)}"`;
    case 'stats': return `stats: ${(b.items || []).map((i) => `${i.prefix || ''}${i.value}${i.suffix || ''}`).join(', ')}`;
    case 'chart': return `chart(${b.kind || 'bar'}) ${b.data?.labels?.length || 0} labels × ${b.data?.series?.length || 0} series`;
    case 'table': return `table ${b.rows?.length || 0}×${b.columns?.length || 0}`;
    case 'image': return `image ${b.asset || b.src || ''}`;
    case 'equation': return `equation ${clip(b.latex, 40)}${b.steps?.length ? ` (+${b.steps.length} steps)` : ''}`;
    case 'plot': return `plot ${(b.functions || []).map((f) => f.expr || `(${f.x},${f.y})`).join('; ')}`;
    default: return b.type;
  }
}

export function summarizeDocument(doc, { blocks = true } = {}) {
  const lines = [`# ${doc.title}  (${doc.id})`, `format ${doc.format.width}×${doc.format.height} ${doc.format.aspect} @${doc.format.fps}fps · theme ${doc.theme.id}${doc.theme.accent ? ` accent ${doc.theme.accent}` : ''} · energy ${doc.style.energy} · ${doc.scenes.length} scenes · rev ${doc.meta.revision}`];
  doc.scenes.forEach((s, i) => {
    lines.push(`${i + 1}. [${s.id}] layout=${s.layout}${s.tone !== 'auto' ? ` tone=${s.tone}` : ''} duration=${s.duration}${s.transition !== 'auto' ? ` transition=${s.transition.type}` : ''}${s.name ? ` "${s.name}"` : ''}`);
    if (blocks) for (const b of s.blocks) lines.push(`     - [${b.id}] ${describeBlock(b)}`);
  });
  const assets = Object.values(doc.assets || {});
  if (assets.length) lines.push(`assets: ${assets.map((a) => `${a.id}(${a.kind}:${a.name || a.file})`).join(', ')}`);
  return lines.join('\n');
}

export function findScene(doc, ref) {
  if (ref == null) return null;
  if (typeof ref === 'number' || /^\d+$/.test(String(ref))) {
    const n = Number(ref);
    // 1-based for humans/CLI; 0 also accepted
    return doc.scenes[n === 0 ? 0 : n - 1] || null;
  }
  return doc.scenes.find((s) => s.id === ref || s.name === ref) || null;
}

export function findBlock(doc, ref, sceneRef) {
  const scenes = sceneRef != null ? [findScene(doc, sceneRef)].filter(Boolean) : doc.scenes;
  for (const s of scenes) {
    if (typeof ref === 'number' || /^\d+$/.test(String(ref))) { if (sceneRef != null) return { scene: s, block: s.blocks[Number(ref)] || null }; continue; }
    const b = s.blocks.find((x) => x.id === ref || (x.key && x.key === ref));
    if (b) return { scene: s, block: b };
  }
  return { scene: null, block: null };
}
