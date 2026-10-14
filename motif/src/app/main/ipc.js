// IPC surface of the editor. One request channel ("motif:call", method + args) keeps the preload
// tiny; errors travel back as {error, hint, code} so the UI can show the same friendly messages the
// CLI prints. Events (export progress, AI steps, external project changes) use "motif:event".
import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as store from '../../core/store/index.js';
import * as cmd from '../../cli/commands.js';
import { findTool } from '../../core/store/media.js';
import { themeSummaries, THEMES } from '../../core/themes/index.js';
import { BUILTIN_TEMPLATES } from '../../core/templates/index.js';
import { normalizeDocument } from '../../core/doc.js';
import { uid } from '../../core/util/misc.js';
import { allowRoot, fileUrl } from './protocol.js';
import { runRenderJob } from './render-job.js';
import * as ai from './ai.js';

export function registerIpc({ distDir, getWindow, takePendingOpen }) {
  const send = (channel, payload) => { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed() && w.webContents.getURL().includes('editor.html')) w.webContents.send('motif:event', channel, payload); };
  const hooksBase = { distDir, preload: path.join(distDir, 'worker-preload.cjs') };

  // AI tools and lint run renders in-process instead of spawning a second Electron.
  cmd.setJobRunner((job, o = {}) => runRenderJob(job, { ...hooksBase, onProgress: o.onProgress, onLog: o.onLog }));

  // ── external change detection: CLI / MCP / in-app AI write project.json; the editor follows ──
  const watchers = new Map(); // dir → { watcher, revision }
  const known = new Map(); // dir → last revision this process wrote or delivered
  function watchProject(dir) {
    if (watchers.has(dir)) return;
    let timer = null;
    const check = () => {
      timer = null;
      let doc;
      try { doc = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')); } catch { return; }
      const rev = doc.meta?.revision ?? 0;
      if (known.get(dir) === rev) return;
      known.set(dir, rev);
      send('project-changed', { id: doc.id, dir, revision: rev, author: doc.meta?.lastAuthor, doc });
    };
    try {
      const w = fs.watch(dir, (_ev, name) => { if (name && !String(name).startsWith('project.json')) return; clearTimeout(timer); timer = setTimeout(check, 150); });
      watchers.set(dir, w);
    } catch { /* unsupported fs */ }
  }
  function unwatchAll(except) { for (const [d, w] of watchers) if (d !== except) { w.close(); watchers.delete(d); } }

  const thumbUrl = (file) => { if (!file || !fs.existsSync(file)) return null; return fileUrl(file) + '?v=' + Math.round(fs.statSync(file).mtimeMs); };
  const saved = (r) => { known.set(r.dir, r.revision ?? r.doc?.meta?.revision); return r; };

  const jobs = new Map();
  const chats = new Map();

  const api = {
    // ── app ──
    'app.info': () => ({
      version: app.getVersion(), platform: process.platform, arch: process.arch, packaged: app.isPackaged,
      library: store.libraryRoot(), userData: store.userDataDir(), ffmpeg: findTool('ffmpeg', store.readConfig()),
      cli: cliInfo(), electron: process.versions.electron, cpus: os.cpus().length,
    }),
    'app.pendingOpen': () => takePendingOpen(),
    'app.quit': () => app.quit(),
    'window.fullscreen': (on) => { const w = getWindow(); if (w) w.setFullScreen(on == null ? !w.isFullScreen() : !!on); return w?.isFullScreen(); },
    'window.titleBarOverlay': (o) => { try { getWindow()?.setTitleBarOverlay?.(o); } catch { /* mac */ } },
    'config.get': () => { const { ai: _a, ...rest } = store.readConfig(); return { ...rest, library: store.libraryRoot() }; },
    'config.set': (patch) => {
      const { ai: _a, ...safe } = patch || {};
      const r = store.writeConfig(safe);
      if (safe.library) allowRoot(store.libraryRoot());
      return r;
    },

    // ── dialogs & shell ──
    'dialog.open': async (o = {}) => {
      const r = await dialog.showOpenDialog(getWindow(), { title: o.title, defaultPath: o.defaultPath, filters: o.filters, properties: [o.directory ? 'openDirectory' : 'openFile', ...(o.multi ? ['multiSelections'] : []), 'createDirectory'] });
      return r.canceled ? [] : r.filePaths;
    },
    'dialog.save': async (o = {}) => {
      const r = await dialog.showSaveDialog(getWindow(), { title: o.title, defaultPath: o.defaultPath, filters: o.filters });
      return r.canceled ? null : r.filePath;
    },
    'shell.open': (p) => shell.openPath(p),
    'shell.reveal': (p) => shell.showItemInFolder(p),
    'shell.external': (url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); },

    // ── library ──
    'library.list': () => store.listProjects().map((p) => ({ ...p, thumbUrl: thumbUrl(p.thumb) })),
    'library.setRoot': (dir) => { store.writeConfig({ library: dir }); allowRoot(store.libraryRoot()); return store.libraryRoot(); },

    // ── projects ──
    'project.create': (o = {}) => { const r = saved(store.createProject({ ...o, author: 'human' })); return { id: r.id, dir: r.dir }; },
    'project.open': (id) => {
      const { dir, doc } = store.loadProject(id);
      allowRoot(dir);
      unwatchAll(dir);
      known.set(dir, doc.meta?.revision);
      watchProject(dir);
      return { id: doc.id, dir, doc, assetBase: fileUrl(dir) + '/', userThemes: store.listUserThemes() };
    },
    'project.close': () => { unwatchAll(null); return true; },
    'project.apply': (id, ops, o = {}) => {
      const r = store.editProject(id, ops, { author: o.author || 'human', message: o.message });
      if (r.saved) saved(r);
      return { ok: r.ok, saved: r.saved, doc: r.saved ? r.doc : undefined, revision: r.revision, results: r.results, warnings: r.warnings, issues: r.issues };
    },
    'project.replace': (id, doc, o = {}) => {
      const { dir, doc: cur } = store.loadProject(id);
      const next = normalizeDocument({ ...doc, id: cur.id, meta: cur.meta }).doc;
      return saved(store.saveProject(dir, next, { message: o.message || '撤销/重做', author: 'human' }));
    },
    'project.duplicate': (id) => { const r = saved(store.duplicateProject(id)); const src = store.loadProject(id).dir; if (fs.existsSync(path.join(src, 'thumb.jpg'))) fs.copyFileSync(path.join(src, 'thumb.jpg'), path.join(r.dir, 'thumb.jpg')); return { id: r.id }; },
    'project.delete': (id) => { const d = store.deleteProject(id); return { trashed: d }; },
    'project.thumb': (id, dataUrl) => {
      const { dir } = store.loadProject(id);
      const b64 = String(dataUrl).replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(dir, 'thumb.jpg'), Buffer.from(b64, 'base64'));
      return true;
    },
    'project.saveAsTemplate': (id, o) => store.saveAsTemplate(id, o),
    'project.exportsDir': (id) => { const { dir } = store.loadProject(id); const d = path.join(dir, 'exports'); fs.mkdirSync(d, { recursive: true }); return d; },
    'project.lint': (id) => cmd.lint(id),

    // ── history ──
    'history.list': (id) => store.listHistory(id),
    'history.get': (id, rev) => store.readSnapshot(id, rev),
    'history.restore': (id, rev) => saved(store.restoreRevision(id, rev, { author: 'human' })).doc,
    'history.name': (id, label) => store.nameVersion(id, label),

    // ── templates / components / themes ──
    'templates.list': () => store.listTemplates().map((t) => ({ ...t, thumbUrl: t.path ? thumbUrl(path.join(t.path, 'thumb.jpg')) : null })),
    'templates.get': (id) => { const t = store.getTemplate(id); return { id: t.id, name: t.name, doc: t.doc, assetBase: t.dir ? fileUrl(t.dir) + '/' : null }; },
    'templates.delete': (id) => { store.deleteTemplate(id); return true; },
    'components.list': () => store.listComponents(),
    'components.get': (id) => store.getComponent(id),
    'components.save': (o) => store.saveComponent(o),
    'components.delete': (id) => { store.deleteComponent(id); return true; },
    'themes.list': () => ({ builtin: themeSummaries(), user: Object.values(store.listUserThemes()), tokens: THEMES }),
    'themes.save': (t) => store.saveUserTheme(t),
    'themes.delete': (id) => { fs.rmSync(path.join(store.libraryRoot(), 'themes', `${id}.json`), { force: true }); return true; },

    // ── assets ──
    'assets.import': async (id, files) => {
      let list = files;
      if (!list?.length) list = await api['dialog.open']({ title: '导入资源', multi: true, filters: [{ name: '媒体', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'ogg', 'glb', 'gltf'] }] });
      const out = [];
      for (const f of list) out.push(await store.importAsset(id, f, { author: 'human' }));
      const { dir, doc } = store.loadProject(id);
      known.set(dir, doc.meta?.revision);
      return { assets: out, doc };
    },

    // ── import & auto-design ──
    'import.analyze': (files) => cmd.analyze(files),
    'import.auto': async (files, o = {}) => {
      const r = await cmd.auto(files, { ...o, agent: 'human' });
      return { id: r.id, title: r.title, scenes: r.scenes };
    },
    'import.supported': () => ['pptx', 'docx', 'xlsx', 'xlsm', 'pdf', 'md', 'markdown', 'txt', 'csv', 'tsv', 'json', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],

    // ── export (in-process render jobs with progress + cancel) ──
    'export.start': async (id, o = {}) => {
      const { dir, doc } = store.loadProject(id);
      const jobId = uid('job', 6);
      const ac = new AbortController();
      jobs.set(jobId, ac);
      const format = o.format || 'mp4';
      const job = {
        type: ['mp4', 'webm', 'mov', 'gif'].includes(format) ? 'video' : format === 'png' ? 'frames' : format,
        format, doc, projectDir: dir, out: o.out, fps: o.fps || doc.format.fps, width: o.width || undefined,
        quality: o.quality || 'high', range: o.range || undefined, mute: !!o.mute, parallel: o.parallel,
      };
      if (job.type === 'pdf') job.width = o.width || 1600;
      const t0 = Date.now();
      runRenderJob(job, { ...hooksBase, signal: ac.signal, onProgress: (p) => send('export', { jobId, ...p }), onLog: () => {} })
        .then((r) => send('export', { jobId, finished: true, ...r, seconds: (Date.now() - t0) / 1000 }))
        .catch((e) => send('export', { jobId, finished: true, ok: false, error: e.message }))
        .finally(() => jobs.delete(jobId));
      return { jobId };
    },
    'export.cancel': (jobId) => { jobs.get(jobId)?.abort(); return true; },

    // ── AI assistant ──
    'ai.providers': () => ai.listProviders(),
    'ai.saveProvider': (p) => ai.saveProvider(p),
    'ai.deleteProvider': (id) => ai.deleteProvider(id),
    'ai.setActive': (id) => ai.setActiveProvider(id),
    'ai.test': (id) => ai.testProvider(id),
    'ai.chat': (req) => {
      const chatId = req.chatId || uid('chat', 6);
      chats.set(chatId, true);
      ai.chat({ ...req, chatId }, (ev) => send('ai', { chatId, ...ev }))
        .catch((e) => send('ai', { chatId, type: 'error', message: e.message, hint: e.hint }))
        .finally(() => chats.delete(chatId));
      return { chatId };
    },
    'ai.cancel': (chatId) => { ai.cancel(chatId); return true; },

    // ── integrations: let external agents (Claude Code, Codex, …) drive the same library ──
    'integrations.info': () => integrationInfo(),
    'integrations.installSkill': (target) => installSkill(target),
  };

  ipcMain.handle('motif:call', async (_e, method, args) => {
    const fn = api[method];
    if (!fn) return { error: `未知方法 ${method}` };
    try { return { result: await fn(...(args || [])) }; }
    catch (e) { return { error: e.message, hint: e.hint, code: e.code }; }
  });

  function cliInfo() {
    // Packaged: Motif.exe runs the bundled CLI as Node (ELECTRON_RUN_AS_NODE); dev: node bin/motif.mjs.
    if (app.isPackaged) {
      const shim = path.join(path.dirname(process.execPath), process.platform === 'win32' ? 'motif.cmd' : 'motif');
      const cli = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'cli.mjs');
      return { command: fs.existsSync(shim) ? shim : process.execPath, args: fs.existsSync(shim) ? [] : [cli], env: fs.existsSync(shim) ? {} : { ELECTRON_RUN_AS_NODE: '1' }, shim: fs.existsSync(shim) ? shim : null };
    }
    const bin = path.resolve(distDir, '..', 'bin', 'motif.mjs');
    return { command: 'node', args: [bin], env: {}, shim: null };
  }

  function integrationInfo() {
    const c = cliInfo();
    const quote = (s) => (/\s/.test(s) ? `"${s}"` : s);
    const cmdline = [c.command, ...c.args].map(quote).join(' ');
    const mcpJson = { mcpServers: { motif: { command: c.command, args: [...c.args, 'mcp'], ...(Object.keys(c.env).length ? { env: c.env } : {}) } } };
    const skillSrc = skillSource();
    return {
      cli: cmdline,
      mcpJson,
      claudeCode: `claude mcp add motif -- ${cmdline} mcp`,
      codex: `[mcp_servers.motif]\ncommand = ${JSON.stringify(c.command)}\nargs = ${JSON.stringify([...c.args, 'mcp'])}${Object.keys(c.env).length ? `\nenv = { ELECTRON_RUN_AS_NODE = "1" }` : ''}`,
      skill: skillSrc,
      skillTargets: [
        { id: 'claude', label: 'Claude Code（~/.claude/skills/motif）', dir: path.join(os.homedir(), '.claude', 'skills', 'motif') },
        { id: 'codex', label: 'Codex（~/.codex/skills/motif）', dir: path.join(os.homedir(), '.codex', 'skills', 'motif') },
        { id: 'agents', label: '通用（~/.agents/skills/motif）', dir: path.join(os.homedir(), '.agents', 'skills', 'motif') },
      ],
      library: store.libraryRoot(),
    };
  }

  function skillSource() {
    const cands = [path.join(process.resourcesPath || '', 'skill', 'motif'), path.resolve(distDir, '..', 'skill', 'motif')];
    return cands.find((d) => fs.existsSync(path.join(d, 'SKILL.md'))) || null;
  }

  function installSkill(targetId) {
    const src = skillSource();
    if (!src) throw Object.assign(new Error('找不到随附的 Skill 包'), { hint: '开发模式下请先运行 npm run docs 生成 skill/motif' });
    const t = integrationInfo().skillTargets.find((x) => x.id === targetId) || { dir: targetId };
    fs.mkdirSync(t.dir, { recursive: true });
    fs.cpSync(src, t.dir, { recursive: true });
    // record the exact CLI invocation so the agent can call this installation
    const c = cliInfo();
    fs.writeFileSync(path.join(t.dir, 'motif-cli.json'), JSON.stringify({ command: c.command, args: c.args, env: c.env, library: store.libraryRoot() }, null, 2));
    return { installed: t.dir };
  }
}
