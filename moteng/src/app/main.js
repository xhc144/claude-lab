// 墨誊 Moteng — Electron main process: window, IPC around the converter,
// settings, and a headless self-test the Windows CI runs on the packaged app.
import { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeTheme, Menu } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { convert, prepare, readConversation, findEngines, detectFonts, safeName, writeHtmlExport, forEachDynamic } from '../core/convert.js';
import { expandInputs, INPUT_EXT } from '../core/load.js';
import { renderHtml, layoutCss } from '../core/html.js';
import { LAYOUT_DEFAULTS, normalizeLayout, normalizeOverrides } from '../core/layout.js';
import { initUpdater, updateStatus, checkForUpdates, installNow, updateConfigSummary } from './updater.js';
import { registerSnapshotScheme, snapshotConversation, svgToPdf } from './snapshot.js';

registerSnapshotScheme();

const selfTestIdx = process.argv.indexOf('--self-test');
const SELF_TEST = selfTestIdx >= 0;
const SELF_TEST_OUT = SELF_TEST ? process.argv[selfTestIdx + 1] : '';
const SHOTS_DIR = process.env.MOTENG_SHOTS_DIR || '';

if (!SELF_TEST && !app.requestSingleInstanceLock()) app.quit();

const resourcesDir = app.isPackaged ? process.resourcesPath : path.resolve(import.meta.dirname, '../..');
let win = null;
const pendingFiles = [];

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = () => ({
  style: 'chat',
  paper: 'a4',
  fontSize: 'normal',
  includeQuestions: true,
  includeThinking: false,
  fetchImages: true,
  openAfter: false,
  outRoot: path.join(app.getPath('documents'), '墨誊'),
  enginePath: '',
  autoUpdate: true,
  exportHtml: true,
  livePdf: true,
  layout: { ...LAYOUT_DEFAULTS },
});

function loadSettings() {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { /* defaults */ }
  const s = { ...DEFAULTS(), ...raw };
  // Settings from 1.1 (paper / fontSize only) carry over into the layout.
  s.layout = normalizeLayout(raw.layout, { paper: raw.paper, fontSize: raw.fontSize });
  return s;
}

function saveSettings(s) {
  const merged = { ...loadSettings(), ...s };
  if (s.layout) merged.layout = s.layout.__reset ? normalizeLayout({}) : normalizeLayout({ ...loadSettings().layout, ...s.layout });
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2));
  return merged;
}

function engines(settings = loadSettings()) {
  return findEngines({ resourcesDir, custom: settings.enginePath });
}

// ---------------------------------------------------------------------------
// Images the TeX engines cannot read (webp, gif, svg, avif, bmp): let Chromium
// decode them in the renderer and hand back a PNG.
// ---------------------------------------------------------------------------
async function convertImage(bytes, mime) {
  if (/svg/.test(mime)) {
    const v = await svgToPdf(bytes).catch(() => null);
    if (v) return v;
  }
  if (!win || win.isDestroyed()) return null;
  const b64 = Buffer.from(bytes).toString('base64');
  const out = await win.webContents.executeJavaScript(`window.__motengToPng(${JSON.stringify(b64)}, ${JSON.stringify(mime)})`, true);
  return out ? new Uint8Array(Buffer.from(out, 'base64')) : null;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
// Each conversation in the list has a session: the page read once, its images and snapshots in a
// work folder, then previewed and compiled as often as the layout changes.
const sessions = new Map(); // id → { input, prepared, workDir, queue, previewSeq }
const workRoot = () => path.join(app.getPath('userData'), 'work');

function snapshotFn(settings) {
  return ({ conv, loaded, workDir, warnings }) => snapshotConversation({ conv, loaded, workDir, warnings }, { allowNetwork: !!settings.fetchImages });
}

function info(prepared) {
  const { conv } = prepared;
  const turns = conv.messages.filter((m) => m.role === 'user').length || (conv.messages.length ? 1 : 0);
  let dynamic = 0;
  let captured = 0;
  forEachDynamic(conv, (b) => { dynamic++; if (b.file) captured++; });
  return {
    title: conv.title, platform: conv.platformName, generic: conv.generic, turns, messages: conv.messages.length, url: conv.url,
    warnings: prepared.warnings, dynamic, captured, pageColors: conv.pageColors || null,
  };
}

async function openSession(id, input, settings = loadSettings()) {
  const old = sessions.get(id);
  if (old && old.prepared) return old;
  const workDir = path.join(workRoot(), `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`);
  const prepared = await prepare(input, {
    workDir, includeThinking: settings.includeThinking, fetchImages: settings.fetchImages, convertImage, snapshot: snapshotFn(settings),
  });
  const sess = { input, prepared, workDir, queue: Promise.resolve(), previewSeq: 0 };
  sessions.set(id, sess);
  return sess;
}

function closeSession(id) {
  const s = sessions.get(id);
  sessions.delete(id);
  if (s) fs.rm(s.workDir, { recursive: true, force: true }, () => {});
}

function fileUrl(p) {
  const norm = String(p).replace(/\\/g, '/');
  return (norm.startsWith('/') ? 'file://' : 'file:///') + norm.split('/').map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg))).join('/');
}

function preview(sess, opts) {
  const base = sess.workDir;
  const r = renderHtml(sess.prepared.conv, {
    layout: opts.layout, overrides: opts.overrides, includeQuestions: opts.includeQuestions,
    imageUrl: (f) => {
      const png = f.replace(/\.pdf$/i, '.png');
      return fileUrl(path.join(base, /\.pdf$/i.test(f) && fs.existsSync(path.join(base, png)) ? png : f));
    },
  });
  return { html: r.html, css: layoutCss(opts.layout, { pageColors: sess.prepared.conv.pageColors }), stats: r.stats, layout: r.layout };
}

function jobOptions(settings, job) {
  const list = engines(settings);
  return {
    style: job.style || settings.style,
    layout: job.layout || settings.layout,
    overrides: normalizeOverrides(job.overrides),
    includeQuestions: settings.includeQuestions,
    includeThinking: settings.includeThinking,
    fetchImages: settings.fetchImages,
    title: job.title || undefined,
    resourcesDir,
    engine: list[0],
    compile: job.compile !== false,
    convertImage,
  };
}

// Keep the old one-shot path for the self-test and for jobs that were never previewed.
async function runJob(job, settings, onProgress) {
  const options = { ...jobOptions(settings, job), outRoot: settings.outRoot, onProgress, snapshot: snapshotFn(settings), exportHtml: job.exportHtml ?? settings.exportHtml };
  fs.mkdirSync(options.outRoot, { recursive: true });
  const input = job.html ? { html: job.html, name: job.name || '剪贴板', url: job.url } : job.input || job.path;
  return convert(input, options);
}

function queued(sess, fn) {
  const run = sess.queue.then(fn, fn);
  sess.queue = run.catch(() => {});
  return run;
}

function registerIpc() {
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_, s) => saveSettings(s));
  ipcMain.handle('engines', () => engines().map((e) => ({ kind: e.kind, label: e.label, path: e.path })));
  ipcMain.handle('fonts', () => {
    const f = detectFonts();
    return { serif: f.serif?.file || null, sans: f.sans?.file || null, mono: f.mono?.file || null };
  });
  // Windows cannot show files and folders in one dialog (asking for both shows folders only),
  // so files and folders have a dialog each.
  ipcMain.handle('pick:files', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '选择对话文件（可多选）',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '对话网页与导出文件', extensions: ['html', 'htm', 'mhtml', 'mht', 'zip', 'md', 'markdown', 'txt', 'json'] },
        { name: '网页', extensions: ['html', 'htm', 'mhtml', 'mht'] },
        { name: '压缩包', extensions: ['zip'] },
        { name: 'Markdown / 文本', extensions: ['md', 'markdown', 'txt'] },
        { name: 'ChatGPT / Claude 导出数据', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.handle('pick:folders', async () => {
    const r = await dialog.showOpenDialog(win, { title: '选择包含对话的文件夹（可多选）', properties: ['openDirectory', 'multiSelections'] });
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.handle('expand', (_, paths) => {
    try { return { ok: true, items: expandInputs(paths) }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('job:prepare', async (event, { id, input, html, name, url }) => {
    try {
      const src = html ? { html, name: name || '剪贴板', url } : input;
      const sess = await openSession(id, src);
      return { ok: true, info: info(sess.prepared) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('job:preview', (_, { id, layout, overrides, includeQuestions }) => {
    const sess = sessions.get(id);
    if (!sess) return { ok: false, error: '请先读取这个对话' };
    try { return { ok: true, ...preview(sess, { layout, overrides, includeQuestions: includeQuestions ?? loadSettings().includeQuestions }) }; } catch (e) { return { ok: false, error: e.message }; }
  });
  // Live PDF: compile into the session's work folder; the newest request wins.
  ipcMain.handle('job:livepdf', (event, job) => {
    const sess = sessions.get(job.id);
    if (!sess) return { ok: false, error: '请先读取这个对话' };
    const seq = ++sess.previewSeq;
    return queued(sess, async () => {
      if (seq !== sess.previewSeq) return { ok: false, stale: true };
      const settings = loadSettings();
      const outDir = path.join(sess.workDir, 'preview');
      fs.rmSync(outDir, { recursive: true, force: true });
      try {
        const r = await convert(sess.input, { ...jobOptions(settings, job), prepared: sess.prepared, outDir, title: 'preview', exportHtml: false, onProgress: (stage, detail) => event.sender.send('progress', { id: job.id, stage, detail, live: true }) });
        return { ok: true, result: r, stale: seq !== sess.previewSeq };
      } catch (e) {
        return { ok: false, error: e.message, log: e.log ? e.log.slice(-6000) : '' };
      }
    });
  });
  ipcMain.handle('job:close', (_, id) => { closeSession(id); return true; });
  ipcMain.handle('pick:folder', async (_, purpose) => {
    const r = await dialog.showOpenDialog(win, { title: purpose === 'out' ? '选择输出文件夹' : '选择网页所在文件夹', properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('pick:engine', async () => {
    const r = await dialog.showOpenDialog(win, { title: '选择 xelatex 或 tectonic 程序', properties: ['openFile'], filters: process.platform === 'win32' ? [{ name: '程序', extensions: ['exe'] }] : [] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('clipboard:html', () => {
    const html = clipboard.readHTML();
    if (html && /<[a-z]/i.test(html)) return { html };
    return { html: '', text: clipboard.readText() };
  });
  ipcMain.handle('convert', async (event, job) => {
    const settings = loadSettings();
    const onProgress = (stage, detail) => event.sender.send('progress', { id: job.id, stage, detail });
    try {
      let r;
      const sess = sessions.get(job.id);
      if (sess) {
        r = await queued(sess, () => convert(sess.input, { ...jobOptions(settings, job), prepared: sess.prepared, outRoot: settings.outRoot, exportHtml: job.exportHtml ?? settings.exportHtml, onProgress }));
      } else {
        r = await runJob(job, settings, onProgress);
      }
      if (r.pdfPath && settings.openAfter) shell.openPath(r.pdfPath);
      return { ok: true, result: r };
    } catch (e) {
      return { ok: false, error: e.message, log: e.log ? e.log.slice(-6000) : '' };
    }
  });
  ipcMain.handle('export:html', async (_, job) => {
    const sess = sessions.get(job.id);
    if (!sess) return { ok: false, error: '请先读取这个对话' };
    const settings = loadSettings();
    const def = path.join(settings.outRoot, `${safeName(sess.prepared.conv.title)}.html`);
    const r = await dialog.showSaveDialog(win, { title: '导出可交互的 HTML', defaultPath: def, filters: [{ name: '网页', extensions: ['html'] }] });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try {
      writeHtmlExport(sess.prepared, r.filePath, { layout: job.layout || settings.layout, overrides: job.overrides, includeQuestions: settings.includeQuestions });
      return { ok: true, path: r.filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('open:path', (_, p) => shell.openPath(p));
  ipcMain.handle('open:folder', (_, p) => shell.showItemInFolder(p));
  ipcMain.handle('open:url', (_, u) => (/^https:\/\//.test(u) ? shell.openExternal(u) : null));
  ipcMain.handle('pending-files', () => pendingFiles.splice(0));
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
  ipcMain.handle('update:status', () => updateStatus());
  ipcMain.handle('update:check', () => checkForUpdates());
  ipcMain.handle('update:install', () => installNow());
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function filesFromArgv(argv) {
  return argv.slice(1).filter((a) => !a.startsWith('-') && INPUT_EXT.test(a) && fs.existsSync(a));
}

function createWindow() {
  const dark = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: '墨誊 Moteng',
    backgroundColor: dark ? '#16181d' : '#f4f3ef',
    icon: path.join(resourcesDir, app.isPackaged ? '' : 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      plugins: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(import.meta.dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!SELF_TEST) win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

app.on('second-instance', (_, argv) => {
  const files = filesFromArgv(argv);
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
    if (files.length) win.webContents.send('add-files', files);
  }
});

// ---------------------------------------------------------------------------
// Self-test: convert the bundled fixtures in both styles, check the PDFs,
// screenshot the window, write a JSON report, exit non-zero on failure.
// ---------------------------------------------------------------------------
async function selfTest() {
  const report = { version: app.getVersion(), platform: process.platform, engines: [], fonts: null, cases: [], ok: false };
  const started = Date.now();
  try {
    // the packaged app must carry its update feed (resources/app-update.yml)
    if (app.isPackaged) report.updater = updateConfigSummary();
    report.engines = engines().map((e) => e.label + ' ' + e.path);
    const f = detectFonts();
    report.fonts = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v ? v.dir + v.file : null]));
    const fixtureDir = app.isPackaged ? path.join(process.resourcesPath, 'selftest') : path.resolve(import.meta.dirname, '../../fixtures/selftest');
    const fixtures = fs.readdirSync(fixtureDir).filter((n) => /\.html$/.test(n));
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-selftest-'));
    for (const name of fixtures) {
      for (const style of ['chat', 'notes']) {
        const t0 = Date.now();
        const c = { fixture: name, style, ok: false };
        try {
          // A Chinese title puts the output in a non-ASCII folder, as real use does.
          const r = await runJob({ path: path.join(fixtureDir, name), style, title: `自检 ${name.replace(/\.html$/, '')} ${style === 'notes' ? '讲义' : '对话'}` }, { ...loadSettings(), outRoot, fetchImages: false }, () => {});
          const pdf = r.pdfPath && fs.readFileSync(r.pdfPath);
          const tail = pdf ? pdf.subarray(-1024).toString('latin1') : '';
          const count = pdf ? pdf.toString('latin1').match(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/) : null;
          const pages = count ? +(count[1] || count[2]) : null;
          const valid = !!pdf && pdf.subarray(0, 5).toString() === '%PDF-' && tail.includes('%%EOF') && pdf.length > 8000;
          Object.assign(c, { ok: valid, pages, bytes: pdf ? pdf.length : 0, engine: r.engine, warnings: r.warnings, repaired: r.repaired, turns: r.turns, styleUsed: r.style, cjkFont: r.cjkFont, fontError: r.fontError, pdfPath: r.pdfPath });
          // On Windows the system fonts (SimSun / YaHei) must load; Fandol means the font block failed.
          if (process.platform === 'win32' && report.fonts.serif && !/sim|msyh|yahei|deng|source|noto/i.test(r.cjkFont || '')) { c.ok = false; c.error = `CJK font fell back to ${r.cjkFont || 'unknown'}`; }
          // The ChatGPT fixture has no deliberately broken TeX; nothing may fall back there.
          if (/chatgpt/.test(name) && r.repaired) { c.ok = false; c.error = `unexpected fallbacks: ${r.repaired}`; }
          if (r.style !== style) { c.ok = false; c.error = `style fell back to ${r.style}`; }
          // The interactive HTML is written next to the PDF.
          c.html = r.htmlPath ? fs.statSync(r.htmlPath).size : 0;
          if (!c.html || c.html < 20000) { c.ok = false; c.error = 'HTML export missing'; }
          // Charts and widgets are captured as pictures (the DIL fixture has a chart and a slider card).
          c.dynamic = r.dynamic;
          if (r.dynamic && r.dynamic.captured < r.dynamic.total) { c.ok = false; c.error = `snapshots: ${r.dynamic.captured}/${r.dynamic.total}`; }
        } catch (e) {
          c.error = e.message;
          c.log = (e.log || '').slice(-3000);
        }
        c.seconds = Math.round((Date.now() - t0) / 100) / 10;
        report.cases.push(c);
      }
    }
    // UI: load a conversation into the window, render the live preview, take a screenshot.
    win.setSize(1440, 900);
    if (SHOTS_DIR) win.showInactive();
    const uiInput = path.join(fixtureDir, fixtures.find((n) => /dil/.test(n)) || fixtures[0]);
    report.ui = await win.webContents.executeJavaScript(`window.__motengSelfTestShow(${JSON.stringify([{ input: uiInput }])})`, true).catch((e) => ({ error: e.message }));
    if (!report.ui || !(report.ui.maths > 0)) report.uiError = 'live preview did not render';
    if (SHOTS_DIR) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      await new Promise((r) => setTimeout(r, 1500));
      fs.writeFileSync(path.join(SHOTS_DIR, 'main-window.png'), (await win.webContents.capturePage()).toPNG());
    }
    report.ok = report.cases.length > 0 && report.cases.every((c) => c.ok) && !report.uiError;
  } catch (e) {
    report.error = e.stack || e.message;
  }
  report.seconds = Math.round((Date.now() - started) / 1000);
  if (SELF_TEST_OUT) fs.writeFileSync(SELF_TEST_OUT, JSON.stringify(report, null, 2));
  else console.log(JSON.stringify(report, null, 2));
  app.exit(report.ok ? 0 : 1);
}

app.whenReady().then(async () => {
  registerIpc();
  pendingFiles.push(...filesFromArgv(process.argv));
  createWindow();
  initUpdater({ win: () => win, enabled: () => loadSettings().autoUpdate !== false, selfTest: SELF_TEST });
  if (SELF_TEST) {
    await new Promise((r) => win.webContents.once('did-finish-load', r));
    await selfTest();
  }
});

app.on('open-file', (e, p) => {
  e.preventDefault();
  if (win) win.webContents.send('add-files', [p]);
  else pendingFiles.push(p);
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { try { fs.rmSync(workRoot(), { recursive: true, force: true }); } catch { /* in use */ } });
