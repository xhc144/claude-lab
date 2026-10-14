// Project library on disk (Node only). Shared by the desktop app and the CLI, so a project made
// by an AI through the CLI opens in the editor, and a human's edits are visible to the AI.
//
// <library>/
//   projects/<slug>--<id>/project.json   the document (normalised, revisioned)
//                         assets/        imported media (content-hashed names)
//                         history/       gzip snapshots + index.json (author, message, revision)
//                         exports/       rendered outputs
//                         thumb.jpg      cover thumbnail (written by the app/worker)
//   templates/<id>/template.json (+ assets/, thumb.jpg)
//   components/<id>.json                 saved blocks / scenes for reuse
//   themes/<id>.json                     user themes (extend a built-in theme)
//   .trash/                              deleted projects (recoverable)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createDocument, normalizeDocument, validateDocument } from '../doc.js';
import { applyOps } from '../ops.js';
import { uid, slugify, clone } from '../util/misc.js';
import { BUILTIN_TEMPLATES } from '../templates/index.js';
import { probeMedia } from './media.js';

const HISTORY_KEEP = 300;

// ───────────────────────────── locations ─────────────────────────────
export function userDataDir() {
  if (process.env.MOTIF_USER_DATA) return process.env.MOTIF_USER_DATA;
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'), 'Motif');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library/Application Support/Motif');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Motif');
}

export function configPath() { return path.join(userDataDir(), 'config.json'); }

export function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; }
}

export function writeConfig(patch) {
  const cfg = { ...readConfig(), ...patch };
  fs.mkdirSync(userDataDir(), { recursive: true });
  atomicWrite(configPath(), JSON.stringify(cfg, null, 2));
  return cfg;
}

function documentsDir() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const up = process.env.USERPROFILE || home;
    return path.join(up, 'Documents');
  }
  const d = path.join(home, 'Documents');
  return fs.existsSync(d) ? d : home;
}

export function libraryRoot() {
  const root = process.env.MOTIF_HOME || readConfig().library || path.join(documentsDir(), 'Motif');
  for (const sub of ['projects', 'templates', 'components', 'themes', 'assets']) fs.mkdirSync(path.join(root, sub), { recursive: true });
  return root;
}

// ───────────────────────────── io helpers ─────────────────────────────
export function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/**
 * Recursive copy that merges into an existing destination. Deliberately not fs.cpSync: Node 22's
 * native implementation aborts the process on Windows in some directory cases.
 */
export function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else if (e.isFile()) fs.copyFileSync(a, b);
  }
}

export class StoreError extends Error {
  constructor(message, hint, code) { super(message); this.hint = hint; this.code = code; }
}

// ───────────────────────────── projects ─────────────────────────────
export function projectsDir() { return path.join(libraryRoot(), 'projects'); }

export function listProjects() {
  const dir = projectsDir();
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const f = path.join(dir, name, 'project.json');
    if (!fs.existsSync(f)) continue;
    try {
      const d = readJSON(f);
      const st = fs.statSync(f);
      out.push({
        id: d.id, title: d.title, path: path.join(dir, name), theme: d.theme?.id, aspect: d.format?.aspect,
        scenes: d.scenes?.length || 0, revision: d.meta?.revision || 0, updatedAt: d.meta?.updatedAt || st.mtime.toISOString(),
        lastAuthor: d.meta?.lastAuthor, thumb: fs.existsSync(path.join(dir, name, 'thumb.jpg')) ? path.join(dir, name, 'thumb.jpg') : null,
        description: d.meta?.description || '', tags: d.meta?.tags || [],
      });
    } catch { /* skip broken */ }
  }
  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** Resolve a project reference: path, id, id prefix, slug or (unique) title. */
export function resolveProject(ref) {
  if (!ref) throw new StoreError('缺少项目参数', '用项目 ID、标题或路径；motif list 查看全部', 'NO_PROJECT');
  const r = String(ref);
  if (fs.existsSync(r)) {
    const st = fs.statSync(r);
    if (st.isDirectory() && fs.existsSync(path.join(r, 'project.json'))) return path.resolve(r);
    if (st.isFile() && r.endsWith('.json')) return path.dirname(path.resolve(r));
  }
  const all = listProjects();
  const hit = all.find((p) => p.id === r) || all.find((p) => path.basename(p.path) === r)
    || all.filter((p) => p.id.startsWith(r) || p.id.replace(/^prj_/, '').startsWith(r)).sort((a, b) => a.id.length - b.id.length)[0]
    || all.find((p) => p.title === r) || all.find((p) => p.title.toLowerCase().includes(r.toLowerCase()));
  if (!hit) throw new StoreError(`找不到项目 "${r}"`, `现有项目：${all.slice(0, 8).map((p) => `${p.id}「${p.title}」`).join('，') || '（无）'}`, 'NOT_FOUND');
  return hit.path;
}

export function loadProject(ref) {
  const dir = resolveProject(ref);
  const doc = readJSON(path.join(dir, 'project.json'));
  return { dir, doc };
}

export function createProject({ title, theme, aspect, accent, template, document: initial, author = 'human' } = {}) {
  let doc;
  let templateDir = null;
  if (template) {
    const t = getTemplate(template);
    templateDir = t.dir;
    doc = clone(t.doc);
    doc.id = uid('prj');
    if (title) doc.title = title;
    if (theme) doc.theme = { ...doc.theme, id: theme };
    if (accent) doc.theme = { ...doc.theme, accent };
    doc.meta = { ...doc.meta, template: t.id, createdAt: new Date().toISOString() };
    for (const s of doc.scenes) { s.id = uid('s', 6); s.blocks.forEach((b) => { b.id = uid('b', 6); }); }
  } else if (initial) {
    doc = normalizeDocument({ ...initial, id: undefined }).doc;
    if (title) doc.title = title;
    if (theme) doc.theme = { ...doc.theme, id: theme };
    if (accent) doc.theme.accent = accent;
  } else {
    doc = createDocument({ title: title || '未命名作品', theme, aspect, accent });
  }
  if (aspect && (template || initial)) doc = applyOps(doc, [{ op: 'set_format', aspect }]).doc;
  doc = normalizeDocument(doc).doc;
  doc.meta.revision = 0;
  const dir = path.join(projectsDir(), `${slugify(doc.title)}--${doc.id.replace(/^prj_/, '')}`);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  if (templateDir && fs.existsSync(path.join(templateDir, 'assets'))) copyDir(path.join(templateDir, 'assets'), path.join(dir, 'assets'));
  return saveProject(dir, doc, { message: template ? `从模板 ${template} 创建` : '创建项目', author });
}

/**
 * Write a document. Increments revision, snapshots history.
 * expectRevision guards against clobbering a concurrent writer (GUI vs CLI).
 */
export function saveProject(dir, doc, { message = '保存', author = 'human', expectRevision, snapshot = true } = {}) {
  const file = path.join(dir, 'project.json');
  let current = null;
  if (fs.existsSync(file)) { try { current = readJSON(file); } catch { current = null; } }
  const curRev = current?.meta?.revision ?? -1;
  if (expectRevision != null && current && curRev !== expectRevision) {
    throw new StoreError(`项目已被其他程序修改（当前修订 ${curRev}，预期 ${expectRevision}）`, '重新加载后再修改', 'CONFLICT');
  }
  const out = clone(doc);
  out.meta = { ...out.meta, revision: curRev + 1, updatedAt: new Date().toISOString(), lastAuthor: author };
  atomicWrite(file, JSON.stringify(out, null, 2));
  if (snapshot) writeSnapshot(dir, out, { message, author });
  return { dir, doc: out, id: out.id, revision: out.meta.revision };
}

/** Load → apply ops → validate → save. The workhorse for CLI/MCP edits. */
export function editProject(ref, ops, { author = 'ai', message, partial = false, dryRun = false } = {}) {
  const { dir, doc } = loadProject(ref);
  const res = applyOps(doc, ops, { partial, author });
  if (!res.ok && !partial) return { ...res, dir, saved: false };
  if (dryRun) return { ...res, dir, saved: false };
  const msg = message || summarizeOps(ops);
  const saved = saveProject(dir, res.doc, { message: msg, author, expectRevision: doc.meta?.revision });
  return { ...res, doc: saved.doc, dir, saved: true, revision: saved.revision };
}

function summarizeOps(ops) {
  const list = Array.isArray(ops) ? ops : ops?.ops || [ops];
  const counts = {};
  for (const o of list) counts[o.op] = (counts[o.op] || 0) + 1;
  return Object.entries(counts).map(([k, v]) => (v > 1 ? `${k}×${v}` : k)).join(', ');
}

export function deleteProject(ref) {
  const dir = resolveProject(ref);
  const trash = path.join(libraryRoot(), '.trash');
  fs.mkdirSync(trash, { recursive: true });
  const dest = path.join(trash, `${path.basename(dir)}--${Date.now()}`);
  fs.renameSync(dir, dest);
  return dest;
}

export function duplicateProject(ref, title) {
  const { dir, doc } = loadProject(ref);
  const copy = clone(doc);
  copy.id = uid('prj');
  copy.title = title || `${doc.title}（副本）`;
  const ndir = path.join(projectsDir(), `${slugify(copy.title)}--${copy.id.replace(/^prj_/, '')}`);
  fs.mkdirSync(ndir, { recursive: true });
  if (fs.existsSync(path.join(dir, 'assets'))) copyDir(path.join(dir, 'assets'), path.join(ndir, 'assets'));
  return saveProject(ndir, copy, { message: `复制自 ${doc.id}` });
}

// ───────────────────────────── history ─────────────────────────────
function historyDir(dir) { return path.join(dir, 'history'); }

function writeSnapshot(dir, doc, { message, author }) {
  const hd = historyDir(dir);
  fs.mkdirSync(hd, { recursive: true });
  const rev = doc.meta.revision;
  const name = `${String(rev).padStart(6, '0')}.json.gz`;
  fs.writeFileSync(path.join(hd, name), zlib.gzipSync(JSON.stringify(doc)));
  const idxFile = path.join(hd, 'index.json');
  let idx = [];
  try { idx = readJSON(idxFile); } catch { idx = []; }
  idx.push({ revision: rev, time: new Date().toISOString(), author, message, file: name, scenes: doc.scenes.length });
  // retention: keep named versions and the most recent HISTORY_KEEP
  if (idx.length > HISTORY_KEEP) {
    const drop = idx.slice(0, idx.length - HISTORY_KEEP).filter((h) => !h.named);
    for (const h of drop) { try { fs.rmSync(path.join(hd, h.file)); } catch { /* ignore */ } }
    idx = idx.filter((h) => h.named || !drop.includes(h));
  }
  atomicWrite(idxFile, JSON.stringify(idx, null, 1));
}

export function listHistory(ref) {
  const dir = resolveProject(ref);
  try { return readJSON(path.join(historyDir(dir), 'index.json')).slice().reverse(); } catch { return []; }
}

export function readSnapshot(ref, revision) {
  const dir = resolveProject(ref);
  const h = listHistory(dir).find((x) => x.revision === Number(revision));
  if (!h) throw new StoreError(`没有修订 ${revision}`, 'motif history <项目> 查看可用修订', 'NO_REVISION');
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(historyDir(dir), h.file))).toString('utf8'));
}

export function restoreRevision(ref, revision, { author = 'human' } = {}) {
  const dir = resolveProject(ref);
  const old = readSnapshot(dir, revision);
  return saveProject(dir, old, { message: `恢复到修订 ${revision}`, author });
}

/** Mark the current revision as a named version (kept forever). */
export function nameVersion(ref, label) {
  const dir = resolveProject(ref);
  const file = path.join(historyDir(dir), 'index.json');
  const idx = readJSON(file);
  const last = idx[idx.length - 1];
  if (last) { last.named = label || `版本 ${last.revision}`; atomicWrite(file, JSON.stringify(idx, null, 1)); }
  return last;
}

// ───────────────────────────── assets ─────────────────────────────
const KIND_BY_EXT = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'mkv'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
  model: ['glb', 'gltf'],
  font: ['ttf', 'otf', 'woff', 'woff2'],
  data: ['csv', 'tsv', 'json', 'xlsx', 'xls'],
  document: ['pdf', 'pptx', 'docx', 'md', 'txt'],
};
export function kindOf(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  for (const [k, list] of Object.entries(KIND_BY_EXT)) if (list.includes(ext)) return k;
  return 'file';
}

/** Copy a file into the project and register it. Returns the asset entry. */
export async function importAsset(ref, file, { name, id, author = 'human' } = {}) {
  const dir = resolveProject(ref);
  if (!fs.existsSync(file)) throw new StoreError(`文件不存在：${file}`, null, 'NO_FILE');
  const buf = fs.readFileSync(file);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  const base = path.basename(file).replace(/[^\p{L}\p{N}._-]+/gu, '_');
  const rel = `assets/${hash}-${base}`;
  const dest = path.join(dir, rel);
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, buf);
  const kind = kindOf(file);
  const meta = await probeMedia(dest, kind);
  const { doc } = loadProject(dir);
  const existing = Object.values(doc.assets || {}).find((a) => a.file === rel);
  if (existing) return existing;
  const asset = { id: id || uid('ast', 6), kind, file: rel, name: name || path.basename(file), size: buf.length, ...meta };
  const res = applyOps(doc, [{ op: 'add_asset', asset }]);
  saveProject(dir, res.doc, { message: `导入资源 ${asset.name}`, author });
  return asset;
}

/** Copy every `src` path referenced by blocks into the project as assets (used after AI writes). */
export async function internalizeSources(ref, { author = 'ai' } = {}) {
  const dir = resolveProject(ref);
  const { doc } = loadProject(dir);
  const ops = [];
  const added = [];
  for (const s of doc.scenes) for (const b of s.blocks) {
    const refs = b.type === 'gallery' ? (b.images || []).map((im, i) => ({ im, i })) : [{ im: b, i: -1 }];
    for (const { im, i } of refs) {
      if (!im || im.asset || !im.src || /^(https?:|data:)/.test(im.src)) continue;
      const f = path.isAbsolute(im.src) ? im.src : path.resolve(process.cwd(), im.src);
      if (!fs.existsSync(f)) continue;
      const a = await importAsset(dir, f, { author });
      added.push(a);
      if (i < 0) ops.push({ op: 'update_block', block: b.id, set: { asset: a.id, src: null } });
      else { const images = [...b.images]; images[i] = { ...images[i], asset: a.id, src: undefined }; ops.push({ op: 'update_block', block: b.id, set: { images } }); }
    }
  }
  if (ops.length) editProject(dir, ops, { author, message: '导入引用的本地文件' });
  return added;
}

export function assetPath(dir, asset) { return path.join(dir, asset.file); }

// ───────────────────────────── templates ─────────────────────────────
export function listTemplates() {
  const out = BUILTIN_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, tags: t.tags || [], builtin: true, theme: t.doc.theme?.id, aspect: t.doc.format?.aspect || '16:9', scenes: t.doc.scenes.length }));
  const dir = path.join(libraryRoot(), 'templates');
  for (const id of fs.readdirSync(dir)) {
    const f = path.join(dir, id, 'template.json');
    if (!fs.existsSync(f)) continue;
    try { const t = readJSON(f); out.push({ id, name: t.name, description: t.description || '', tags: t.tags || [], builtin: false, theme: t.doc?.theme?.id, aspect: t.doc?.format?.aspect, scenes: t.doc?.scenes?.length || 0, path: path.join(dir, id) }); } catch { /* skip */ }
  }
  return out;
}

export function getTemplate(id) {
  const b = BUILTIN_TEMPLATES.find((t) => t.id === id);
  if (b) return { id: b.id, name: b.name, doc: normalizeDocument(b.doc).doc, dir: null };
  const dir = path.join(libraryRoot(), 'templates', id);
  const f = path.join(dir, 'template.json');
  if (!fs.existsSync(f)) {
    const all = listTemplates();
    const hit = all.find((t) => t.name === id || t.name?.includes(id));
    if (hit) return getTemplate(hit.id);
    throw new StoreError(`找不到模板 "${id}"`, `可用模板：${all.map((t) => t.id).join(', ')}`, 'NOT_FOUND');
  }
  const t = readJSON(f);
  return { id, name: t.name, doc: normalizeDocument(t.doc).doc, dir };
}

export function saveAsTemplate(ref, { name, description = '', tags = [], id } = {}) {
  const { dir, doc } = loadProject(ref);
  const tid = id || slugify(name || doc.title) + '-' + uid('', 4);
  const tdir = path.join(libraryRoot(), 'templates', tid);
  fs.mkdirSync(tdir, { recursive: true });
  if (fs.existsSync(path.join(dir, 'assets'))) copyDir(path.join(dir, 'assets'), path.join(tdir, 'assets'));
  if (fs.existsSync(path.join(dir, 'thumb.jpg'))) fs.copyFileSync(path.join(dir, 'thumb.jpg'), path.join(tdir, 'thumb.jpg'));
  const tdoc = clone(doc);
  delete tdoc.meta?.revision;
  atomicWrite(path.join(tdir, 'template.json'), JSON.stringify({ id: tid, name: name || doc.title, description, tags, createdAt: new Date().toISOString(), doc: tdoc }, null, 2));
  return { id: tid, dir: tdir };
}

export function deleteTemplate(id) {
  const tdir = path.join(libraryRoot(), 'templates', id);
  if (!fs.existsSync(tdir)) throw new StoreError(`找不到用户模板 ${id}`, null, 'NOT_FOUND');
  fs.rmSync(tdir, { recursive: true, force: true });
}

// ───────────────────────────── reusable components ─────────────────────────────
export function listComponents() {
  const dir = path.join(libraryRoot(), 'components');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => { try { const c = readJSON(path.join(dir, f)); return { id: c.id, name: c.name, kind: c.kind, tags: c.tags || [], description: c.description || '', type: c.kind === 'block' ? c.data?.type : `${c.data?.blocks?.length || 0} blocks`, createdAt: c.createdAt }; } catch { return null; } }).filter(Boolean);
}

export function getComponent(id) {
  const f = path.join(libraryRoot(), 'components', `${id}.json`);
  if (!fs.existsSync(f)) {
    const hit = listComponents().find((c) => c.name === id);
    if (hit) return getComponent(hit.id);
    throw new StoreError(`找不到组件 "${id}"`, 'motif components list 查看已保存组件', 'NOT_FOUND');
  }
  return readJSON(f);
}

/** Save a block or a scene from a project (or raw data) as a reusable component. */
export function saveComponent({ name, kind, data, project, block, scene, tags = [], description = '' }) {
  let payload = data;
  let k = kind;
  if (!payload && project) {
    const { doc } = loadProject(project);
    if (block) { for (const s of doc.scenes) { const b = s.blocks.find((x) => x.id === block); if (b) { payload = clone(b); k = 'block'; } } }
    else if (scene != null) { const s = doc.scenes.find((x) => x.id === scene) || doc.scenes[Number(scene) - 1]; if (s) { payload = clone(s); k = 'scene'; } }
  }
  if (!payload) throw new StoreError('没有可保存的内容', '提供 --block <ID> 或 --scene <ID>', 'EMPTY');
  if (!k) k = payload.blocks ? 'scene' : 'block';
  delete payload.id;
  if (payload.blocks) payload.blocks.forEach((b) => delete b.id);
  const id = slugify(name || payload.type || 'component') + '-' + uid('', 4);
  const comp = { id, name: name || id, kind: k, tags, description, createdAt: new Date().toISOString(), data: payload };
  atomicWrite(path.join(libraryRoot(), 'components', `${id}.json`), JSON.stringify(comp, null, 2));
  return comp;
}

export function deleteComponent(id) { fs.rmSync(path.join(libraryRoot(), 'components', `${id}.json`), { force: true }); }

// ───────────────────────────── user themes ─────────────────────────────
export function listUserThemes() {
  const dir = path.join(libraryRoot(), 'themes');
  const out = {};
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) { try { const t = readJSON(path.join(dir, f)); out[t.id] = t; } catch { /* skip */ } }
  return out;
}

export function saveUserTheme(theme) {
  if (!theme.id) theme.id = slugify(theme.name || 'theme') + '-' + uid('', 4);
  if (!theme.extends) theme.extends = 'aurora';
  atomicWrite(path.join(libraryRoot(), 'themes', `${theme.id}.json`), JSON.stringify(theme, null, 2));
  return theme;
}

export function projectIssues(ref) {
  const { doc } = loadProject(ref);
  return validateDocument(doc);
}
