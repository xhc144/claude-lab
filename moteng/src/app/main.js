// 墨誊 Moteng — Electron main process: window, IPC around the converter,
// settings, and a headless self-test the Windows CI runs on the packaged app.
import { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeTheme, Menu } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { convert, readConversation, findEngines, detectFonts } from '../core/convert.js';
import { initUpdater, updateStatus, checkForUpdates, installNow, updateConfigSummary } from './updater.js';

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
});

function loadSettings() {
  try { return { ...DEFAULTS(), ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { return DEFAULTS(); }
}

function saveSettings(s) {
  const merged = { ...loadSettings(), ...s };
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
  if (!win || win.isDestroyed()) return null;
  const b64 = Buffer.from(bytes).toString('base64');
  const out = await win.webContents.executeJavaScript(`window.__motengToPng(${JSON.stringify(b64)}, ${JSON.stringify(mime)})`, true);
  return out ? new Uint8Array(Buffer.from(out, 'base64')) : null;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
function inspect(input) {
  const { conv } = readConversation(input);
  const turns = conv.messages.filter((m) => m.role === 'user').length || (conv.messages.length ? 1 : 0);
  return {
    title: conv.title,
    platform: conv.platformName,
    generic: conv.generic,
    turns,
    messages: conv.messages.length,
    url: conv.url,
  };
}

async function runJob(job, settings, onProgress) {
  const list = engines(settings);
  const options = {
    style: job.style || settings.style,
    paper: settings.paper,
    fontSize: settings.fontSize,
    includeQuestions: settings.includeQuestions,
    includeThinking: settings.includeThinking,
    fetchImages: settings.fetchImages,
    outRoot: settings.outRoot,
    title: job.title || undefined,
    resourcesDir,
    engine: list[0],
    compile: job.compile !== false,
    convertImage,
    onProgress,
  };
  fs.mkdirSync(options.outRoot, { recursive: true });
  const input = job.html ? { html: job.html, name: job.name || '剪贴板', url: job.url } : job.path;
  return convert(input, options);
}

function registerIpc() {
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_, s) => saveSettings(s));
  ipcMain.handle('engines', () => engines().map((e) => ({ kind: e.kind, label: e.label, path: e.path })));
  ipcMain.handle('fonts', () => {
    const f = detectFonts();
    return { serif: f.serif?.file || null, sans: f.sans?.file || null, mono: f.mono?.file || null };
  });
  ipcMain.handle('pick:files', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '选择保存的对话网页',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '网页', extensions: ['html', 'htm', 'mhtml', 'mht', 'zip'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.handle('pick:folder', async (_, purpose) => {
    const r = await dialog.showOpenDialog(win, { title: purpose === 'out' ? '选择输出文件夹' : '选择网页所在文件夹', properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('pick:engine', async () => {
    const r = await dialog.showOpenDialog(win, { title: '选择 xelatex 或 tectonic 程序', properties: ['openFile'], filters: process.platform === 'win32' ? [{ name: '程序', extensions: ['exe'] }] : [] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('inspect', (_, input) => {
    try { return { ok: true, info: inspect(input) }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('clipboard:html', () => {
    const html = clipboard.readHTML();
    if (html && /<[a-z]/i.test(html)) return { html };
    return { html: '', text: clipboard.readText() };
  });
  ipcMain.handle('convert', async (event, job) => {
    const settings = loadSettings();
    try {
      const r = await runJob(job, settings, (stage, detail) => event.sender.send('progress', { id: job.id, stage, detail }));
      if (r.pdfPath && settings.openAfter) shell.openPath(r.pdfPath);
      return { ok: true, result: r };
    } catch (e) {
      return { ok: false, error: e.message, log: e.log ? e.log.slice(-6000) : '' };
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
  return argv.slice(1).filter((a) => !a.startsWith('-') && /\.(html?|mhtml?|zip)$/i.test(a) && fs.existsSync(a));
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
        } catch (e) {
          c.error = e.message;
          c.log = (e.log || '').slice(-3000);
        }
        c.seconds = Math.round((Date.now() - t0) / 100) / 10;
        report.cases.push(c);
      }
    }
    // UI: show the window with the last result and take screenshots.
    if (SHOTS_DIR) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      win.setSize(1280, 820);
      win.showInactive();
      const done = report.cases.filter((c) => c.ok);
      await win.webContents.executeJavaScript(`window.__motengSelfTestShow(${JSON.stringify(done.map((c) => ({ title: c.fixture + ' · ' + c.style, pdfPath: c.pdfPath, warnings: c.warnings || [] })))})`, true);
      await new Promise((r) => setTimeout(r, 2500));
      fs.writeFileSync(path.join(SHOTS_DIR, 'main-window.png'), (await win.webContents.capturePage()).toPNG());
    }
    report.ok = report.cases.length > 0 && report.cases.every((c) => c.ok);
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
