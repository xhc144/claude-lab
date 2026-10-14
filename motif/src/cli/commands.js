// Command implementations shared by the CLI and the MCP server. Each returns plain data.
import fs from 'node:fs';
import path from 'node:path';
import * as store from '../core/store/index.js';
import { summarizeDocument, validateDocument, normalizeDocument, describeBlock } from '../core/doc.js';
import { applyOps, opsSchema } from '../core/ops.js';
import { COMPONENTS, COMPONENT_TYPES } from '../core/catalog/components.js';
import { componentDoc, catalogMarkdown, sceneMarkdown, themesMarkdown, opsMarkdown } from '../core/catalog/docs.js';
import { THEMES, themeSummaries } from '../core/themes/index.js';
import { findTool } from '../core/store/media.js';
import { runJob, electronCommand } from './worker.js';
import { analyzeFiles } from '../core/importers/index.js';
import { direct } from '../core/director.js';
import ICONS from '../generated/icons.json';

export class CliError extends Error {
  constructor(message, hint, code = 1) { super(message); this.hint = hint; this.exit = code; }
}

const author = (o) => o.agent || process.env.MOTIF_AGENT || 'ai';

export function list() {
  return store.listProjects().map(({ thumb, ...p }) => ({ ...p, hasThumb: !!thumb }));
}

export function create(o) {
  let initial = null;
  if (o.from) initial = readJsonArg(o.from);
  const r = store.createProject({ title: o.title, theme: o.theme, aspect: o.aspect, accent: o.accent, template: o.template, document: initial, author: author(o) });
  return { id: r.id, path: r.dir, revision: r.revision, scenes: r.doc.scenes.length, title: r.doc.title, theme: r.doc.theme.id };
}

export function show(ref, o = {}) {
  const { dir, doc } = store.loadProject(ref);
  if (o.full) return { path: dir, document: doc };
  return { id: doc.id, path: dir, title: doc.title, revision: doc.meta?.revision, theme: doc.theme, format: doc.format, style: doc.style, summary: summarizeDocument(doc), scenes: doc.scenes.map((s, i) => ({ index: i + 1, id: s.id, layout: s.layout, duration: s.duration, tone: s.tone, transition: s.transition, blocks: s.blocks.map((b) => ({ id: b.id, type: b.type, describe: describeBlock(b) })) })), assets: Object.values(doc.assets || {}) };
}

export function readJsonArg(arg) {
  let text;
  if (arg === '-' ) text = fs.readFileSync(0, 'utf8');
  else if (typeof arg === 'string' && fs.existsSync(arg)) text = fs.readFileSync(arg, 'utf8');
  else if (typeof arg === 'string') text = arg;
  else return arg;
  try { return JSON.parse(text); } catch (e) { throw new CliError(`JSON 解析失败：${e.message}`, '检查 JSON 语法（可用 - 从标准输入读取）', 2); }
}

export async function apply(ref, opsArg, o = {}) {
  const ops = readJsonArg(opsArg);
  const r = store.editProject(ref, ops, { author: author(o), message: o.message, partial: !!o.partial, dryRun: !!o.dryRun });
  if (r.saved && o.internalize !== false) await store.internalizeSources(r.dir, { author: author(o) }).catch(() => []);
  return {
    ok: r.ok, saved: r.saved, revision: r.revision, path: r.dir,
    results: r.results, warnings: r.warnings, issues: (r.issues || []).filter((i) => i.level !== 'info'),
  };
}

export async function write(ref, docArg, o = {}) {
  const doc = readJsonArg(docArg);
  return apply(ref, [{ op: 'replace_document', document: doc }], { ...o, message: o.message || '写入完整文档' });
}

export function validate(target) {
  let doc;
  if (typeof target === 'string' && target.endsWith('.json') && fs.existsSync(target) && !fs.existsSync(path.join(path.dirname(target), 'history'))) {
    const n = normalizeDocument(readJsonArg(target));
    doc = n.doc;
    return { issues: [...n.warnings, ...validateDocument(doc)] };
  }
  doc = store.loadProject(target).doc;
  return { issues: validateDocument(doc) };
}

// The CLI renders through a spawned Electron worker; the desktop app swaps in its in-process runner.
let jobRunner = runJob;
export function setJobRunner(fn) { jobRunner = fn || runJob; }

async function worker(job, o = {}) {
  const r = await jobRunner(job, { onProgress: o.onProgress, onLog: o.verbose ? (s) => process.stderr.write(s + '\n') : undefined });
  if (!r.ok) throw new CliError(`渲染失败：${r.error}`, r.stack ? r.stack.split('\n').slice(0, 3).join('\n') : undefined);
  return r;
}

export async function lint(ref, o = {}) {
  const { dir, doc } = store.loadProject(ref);
  const statics = validateDocument(doc);
  const r = await worker({ type: 'info', doc, projectDir: dir }, o);
  const issues = [...statics, ...(r.info.lint || [])];
  const seen = new Set();
  const uniq = issues.filter((i) => { const k = `${i.level}|${i.scene}|${i.block}|${i.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { duration: r.info.duration, scenes: r.info.scenes.map((s, i) => ({ index: i + 1, id: s.id, layout: s.layout, tone: s.tone, start: +s.start.toFixed(2), duration: +s.duration.toFixed(2), transition: s.transition?.type })), issues: uniq, counts: { error: uniq.filter((i) => i.level === 'error').length, warning: uniq.filter((i) => i.level === 'warning').length, info: uniq.filter((i) => i.level === 'info').length } };
}

function defaultOut(dir, name) { const d = path.join(dir, 'exports'); fs.mkdirSync(d, { recursive: true }); return path.join(d, name); }

export async function preview(ref, o = {}) {
  const { dir, doc } = store.loadProject(ref);
  const out = path.resolve(o.out || defaultOut(dir, 'preview-sheet.png'));
  const r = await worker({ type: 'sheet', doc, projectDir: dir, out, scale: Number(o.scale) || 0.5, cols: o.cols ? Number(o.cols) : undefined, maxWidth: Number(o.maxWidth) || 2400, jpeg: /\.jpe?g$/i.test(out) }, o);
  // keep a cover thumbnail in sync for the library view
  return { out, scenes: r.scenes, duration: r.duration };
}

export async function still(ref, o = {}) {
  const { dir, doc } = store.loadProject(ref);
  const times = [];
  if (o.t != null) times.push(Number(o.t));
  else if (o.scene != null) times.push(`${o.scene}@${o.at || 'end'}`);
  else times.push('1@end');
  const outFile = path.resolve(o.out || defaultOut(dir, `still-${String(o.scene ?? 't' + o.t).replace(/[^\w.-]/g, '')}.png`));
  const r = await worker({ type: 'stills', doc, projectDir: dir, out: path.dirname(outFile), names: [path.basename(outFile)], times, scale: Number(o.scale) || 1, jpeg: /\.jpe?g$/i.test(outFile) }, o);
  return { out: outFile, t: r.files?.[0] ? undefined : undefined };
}

export async function thumb(ref, o = {}) {
  const { dir, doc } = store.loadProject(ref);
  await worker({ type: 'stills', doc, projectDir: dir, out: dir, names: ['thumb.jpg'], times: ['1@end'], scale: 0.25, jpeg: true }, o);
  return { out: path.join(dir, 'thumb.jpg') };
}

export async function exportProject(ref, o = {}) {
  const { dir, doc } = store.loadProject(ref);
  const format = (o.format || (o.out ? path.extname(o.out).slice(1) : 'mp4') || 'mp4').toLowerCase();
  const ext = { png: '', frames: '', pdf: 'pdf', html: 'html', gif: 'gif', webm: 'webm', mov: 'mov', mp4: 'mp4' }[format];
  if (ext === undefined) throw new CliError(`不支持的格式 ${format}`, '可用：mp4 webm mov gif png pdf html', 2);
  const base = `${store.listProjects().find((p) => p.path === dir)?.title || doc.title}`.replace(/[\\/:*?"<>|]+/g, '_');
  const out = path.resolve(o.out || defaultOut(dir, ext ? `${base}.${ext}` : `${base}-frames`));
  const range = o.range ? String(o.range).split(/[,:]/).map(Number) : undefined;
  const t0 = Date.now();
  let r;
  if (['mp4', 'webm', 'mov', 'gif'].includes(format)) {
    if (!findTool('ffmpeg', store.readConfig())) throw new CliError('找不到 FFmpeg', '安装 ffmpeg 或设置 MOTIF_FFMPEG / motif config ffmpegPath <路径>');
    r = await worker({ type: 'video', format, doc, projectDir: dir, out, fps: Number(o.fps) || doc.format.fps, width: o.width ? Number(o.width) : undefined, quality: o.quality || 'standard', range, mute: !!o.mute }, o);
  } else if (format === 'png' || format === 'frames') {
    r = await worker({ type: 'frames', doc, projectDir: dir, out, fps: Number(o.fps) || doc.format.fps, width: o.width ? Number(o.width) : undefined, range }, o);
  } else if (format === 'pdf') {
    r = await worker({ type: 'pdf', doc, projectDir: dir, out, width: Number(o.width) || 1600 }, o);
  } else if (format === 'html') {
    r = await worker({ type: 'html', doc, projectDir: dir, out }, o);
  }
  return { out, format, seconds: +((Date.now() - t0) / 1000).toFixed(1), ...(r.bytes ? { bytes: r.bytes } : {}), ...(r.frames ? { frames: r.frames } : {}), ...(r.pages ? { pages: r.pages } : {}), duration: r.duration };
}

export async function assets(ref, action = 'list', files = [], o = {}) {
  if (action === 'list') { const { doc } = store.loadProject(ref); return Object.values(doc.assets || {}); }
  if (action === 'add') { const out = []; for (const f of files) out.push(await store.importAsset(ref, path.resolve(f), { name: o.name, author: author(o) })); return out; }
  if (action === 'remove') return apply(ref, files.map((id) => ({ op: 'remove_asset', asset: id })), o);
  throw new CliError(`未知操作 assets ${action}`, 'list | add <文件…> | remove <ID…>', 2);
}

export function history(ref, action = 'list', arg, o = {}) {
  if (action === 'list') return store.listHistory(ref).slice(0, Number(o.limit) || 50);
  if (action === 'restore') { const r = store.restoreRevision(ref, Number(arg), { author: author(o) }); return { revision: r.revision, restoredFrom: Number(arg) }; }
  if (action === 'name') return store.nameVersion(ref, arg);
  if (action === 'show') return store.readSnapshot(ref, Number(arg));
  throw new CliError(`未知操作 history ${action}`, 'list | restore <修订> | name <标签> | show <修订>', 2);
}

export function templates(action = 'list', arg, o = {}) {
  if (action === 'list') return store.listTemplates();
  if (action === 'show') { const t = store.getTemplate(arg); return { id: t.id, name: t.name, summary: summarizeDocument(t.doc), document: o.full ? t.doc : undefined }; }
  if (action === 'save') return store.saveAsTemplate(arg, { name: o.name, description: o.description, tags: o.tags ? String(o.tags).split(',') : [] });
  if (action === 'delete') { store.deleteTemplate(arg); return { deleted: arg }; }
  throw new CliError(`未知操作 templates ${action}`, 'list | show <ID> | save <项目> --name | delete <ID>', 2);
}

export async function components(action = 'list', arg, o = {}) {
  if (action === 'list') return store.listComponents();
  if (action === 'show') return store.getComponent(arg);
  if (action === 'save') return store.saveComponent({ name: o.name, project: arg || o.project, block: o.block, scene: o.scene, tags: o.tags ? String(o.tags).split(',') : [], description: o.description });
  if (action === 'insert') {
    const comp = store.getComponent(o.component || o.id);
    const ops = comp.kind === 'scene' ? [{ op: 'add_scene', scene: comp.data, position: o.position ? Number(o.position) : undefined }] : [{ op: 'add_block', scene: o.scene || 1, block: comp.data, position: o.position ? Number(o.position) : undefined }];
    return apply(arg, ops, { ...o, message: `插入组件 ${comp.name}` });
  }
  if (action === 'delete') { store.deleteComponent(arg); return { deleted: arg }; }
  throw new CliError(`未知操作 components ${action}`, 'list | show <ID> | save <项目> --block/--scene --name | insert <项目> --component <ID> [--scene] | delete <ID>', 2);
}

export function themes(action = 'list', arg) {
  if (action === 'list') return [...themeSummaries(), ...Object.values(store.listUserThemes()).map((t) => ({ id: t.id, name: t.name, extends: t.extends, user: true, description: t.description || '' }))];
  if (action === 'show') return THEMES[arg] || store.listUserThemes()[arg] || (() => { throw new CliError(`没有主题 ${arg}`); })();
  if (action === 'save') return store.saveUserTheme(readJsonArg(arg));
  throw new CliError(`未知操作 themes ${action}`, 'list | show <ID> | save <theme.json>', 2);
}

export function catalog(topic, o = {}) {
  if (!topic) return o.json ? { components: COMPONENT_TYPES.map((t) => ({ type: t, label: COMPONENTS[t].label, category: COMPONENTS[t].category, summary: COMPONENTS[t].summary })) } : catalogMarkdown();
  if (topic === 'scene' || topic === 'layouts' || topic === 'transitions') return sceneMarkdown();
  if (topic === 'themes') return themesMarkdown();
  if (topic === 'ops') return o.json ? opsSchema() : opsMarkdown();
  const doc = componentDoc(topic);
  if (!doc) throw new CliError(`没有组件 ${topic}`, `可用：${COMPONENT_TYPES.join(', ')}`, 2);
  return o.json ? { type: topic, ...COMPONENTS[topic], normalize: undefined } : doc;
}

export function icons(o = {}) {
  const names = Object.keys(ICONS);
  const q = (o.search || '').toLowerCase();
  const hits = q ? names.filter((n) => n.includes(q)) : names;
  return hits.slice(0, Number(o.limit) || (q ? 200 : 2000));
}

export async function analyze(files, o = {}) {
  const r = await analyzeFiles(files.map((f) => path.resolve(f)), o);
  return r;
}

export async function auto(files, o = {}) {
  const outline = await analyzeFiles(files.map((f) => path.resolve(f)), o);
  const doc = direct(outline, { title: o.title, theme: o.theme, aspect: o.aspect, energy: o.energy != null ? Number(o.energy) : undefined, maxScenes: o.maxScenes ? Number(o.maxScenes) : undefined });
  const r = store.createProject({ document: doc, title: o.title || doc.title, theme: o.theme || doc.theme?.id, author: author(o) });
  // bring in extracted media (images from PPTX/DOCX/PDF)
  const imported = {};
  for (const m of outline.media || []) {
    if (!m.file || !fs.existsSync(m.file)) continue;
    const a = await store.importAsset(r.dir, m.file, { name: m.name, author: author(o) });
    imported[m.ref] = a.id;
  }
  if (Object.keys(imported).length) {
    const { doc: cur } = store.loadProject(r.dir);
    const ops = [];
    for (const s of cur.scenes) for (const b of s.blocks) {
      if (b.type === 'image' && b.src && imported[b.src]) ops.push({ op: 'update_block', block: b.id, set: { asset: imported[b.src], src: null } });
    }
    if (ops.length) store.editProject(r.dir, ops, { author: author(o), message: '关联导入的图片' });
  }
  const { doc: final } = store.loadProject(r.dir);
  return { id: final.id, path: r.dir, title: final.title, theme: final.theme.id, scenes: final.scenes.length, sources: outline.sources, summary: summarizeDocument(final) };
}

export function config(key, value) {
  if (key == null) return { configPath: store.configPath(), library: store.libraryRoot(), ffmpeg: findTool('ffmpeg', store.readConfig()), ...store.readConfig() };
  if (value === undefined) return { [key]: store.readConfig()[key] };
  const v = value === 'null' ? undefined : value;
  return store.writeConfig({ [key]: v });
}

export function doctor() {
  const checks = [];
  const ok = (name, pass, detail, fix) => checks.push({ name, ok: !!pass, detail, fix });
  ok('Node/Electron 运行时', true, process.versions.electron ? `Electron ${process.versions.electron}` : `Node ${process.versions.node}`);
  let lib;
  try { lib = store.libraryRoot(); ok('素材库目录', fs.existsSync(lib), lib); } catch (e) { ok('素材库目录', false, e.message, 'motif config library <目录>'); }
  const ff = findTool('ffmpeg', store.readConfig());
  ok('FFmpeg（视频导出）', ff, ff || '未找到', '安装 ffmpeg，或 motif config ffmpegPath <ffmpeg 路径>');
  try { const c = electronCommand(); ok('渲染器（Electron）', fs.existsSync(c.exe), c.exe); } catch (e) { ok('渲染器（Electron）', false, e.message); }
  ok('项目数量', true, String(store.listProjects().length));
  return checks;
}

export function schema() {
  return { document: DOC_SCHEMA_HINT, ops: opsSchema(), components: Object.fromEntries(COMPONENT_TYPES.map((t) => [t, Object.fromEntries(Object.entries(COMPONENTS[t].params).map(([k, p]) => [k, { type: p.type, required: !!p.required, values: p.values, desc: p.desc }]))])) };
}

export const DOC_SCHEMA_HINT = {
  title: 'string',
  theme: '{ id: aurora|editorial|swiss|blueprint|lumen|ink|pop|corporate|noir|meadow, accent?: "#hex" }  或直接写主题 ID 字符串',
  format: '"16:9" | "9:16" | "1:1" | "4:5" 或 { width, height, fps }',
  style: '{ energy: 0..1, density: airy|normal|compact, captions, progress, pageNumbers, camera, transition }',
  brand: '{ name, footer, logo }',
  audio: '{ music: { asset, volume, fadeIn, fadeOut } }',
  scenes: '[ { layout, blocks:[{type, ...}], duration, transition, tone, background, camera, variant, notes, narration } ] —— 也可用简写 { "title": "…", "bullets": [...] }',
};
