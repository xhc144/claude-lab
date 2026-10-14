'use strict';
// 音乐粒子宇宙 — Electron main process.
// Serves the renderer from a privileged app:// scheme (secure context for WebCodecs / workers),
// exposes a narrow file API over IPC, and routes getDisplayMedia to system-audio loopback.

const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, session, desktopCapturer, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const isSmoke = process.argv.includes('--smoke') || process.env.PU_SMOKE === '1';
const devUrl = process.env.PU_DEV_URL || '';
const rendererRoot = path.join(__dirname, '..', '..', 'dist', 'renderer');

// --- GPU / runtime switches ------------------------------------------------------------------
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
// Keep rendering while the window is covered by other windows (Windows occlusion tracking).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
if (process.env.PU_SWIFTSHADER === '1') {
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }
]);

if (!isSmoke && !app.requestSingleInstanceLock()) {
  app.quit();
}

const AUDIO_EXT = ['mp3', 'flac', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'mp4', 'webm', 'weba', 'wma'];
const audioArgs = (argv) => argv.slice(1).filter((a) => !a.startsWith('-') && AUDIO_EXT.includes(path.extname(a).slice(1).toLowerCase()) && fs.existsSync(a));

let win = null;
const pendingFiles = audioArgs(process.argv);

// --- window state ---------------------------------------------------------------------------
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const area = screen.getDisplayMatching(s.bounds).workArea;
    const visible = s.bounds.x < area.x + area.width - 80 && s.bounds.y < area.y + area.height - 80 &&
      s.bounds.x + s.bounds.width > area.x + 80 && s.bounds.y > area.y - 20;
    return visible ? s : null;
  } catch { return null; }
}
function saveWindowState() {
  if (!win || win.isDestroyed() || win.isFullScreen()) return;
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch { /* ignore */ }
}

function createWindow() {
  const saved = isSmoke ? null : loadWindowState();
  const work = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1600, Math.round(work.width * 0.86));
  const height = Math.min(960, Math.round(work.height * 0.86));
  win = new BrowserWindow({
    width: saved ? saved.bounds.width : width,
    height: saved ? saved.bounds.height : height,
    x: saved ? saved.bounds.x : undefined,
    y: saved ? saved.bounds.y : undefined,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#04050a',
    title: '音乐粒子宇宙',
    icon: path.join(__dirname, '..', '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#c9d2e6', height: 40 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
      devTools: !app.isPackaged || process.env.PU_DEVTOOLS === '1'
    }
  });
  win.setMenu(null);
  if (saved && saved.maximized) win.maximize();

  win.once('ready-to-show', () => { if (!isSmoke || process.env.PU_SHOW === '1') win.show(); });
  if (isSmoke) win.showInactive();
  win.on('resize', debounce(saveWindowState, 400));
  win.on('move', debounce(saveWindowState, 400));
  win.on('close', saveWindowState);
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12' && (!app.isPackaged || process.env.PU_DEVTOOLS === '1')) {
      win.webContents.toggleDevTools();
    }
  });
  // Never navigate away from the app or open new windows.
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://') && !url.startsWith(devUrl || '\0')) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('render-process-gone', (e, details) => {
    console.error('renderer gone', details);
    if (isSmoke) finishSmoke({ ok: false, error: 'renderer-gone:' + details.reason });
  });

  const query = isSmoke ? '?smoke=1' : '';
  if (devUrl) win.loadURL(devUrl + query);
  else win.loadURL('app://bundle/index.html' + query);
}

function debounce(fn, ms) {
  let t = null;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

// --- smoke test plumbing --------------------------------------------------------------------
let smokeTimer = null;
function finishSmoke(result) {
  const out = process.env.PU_SMOKE_OUT || path.join(app.getPath('temp'), 'particle-universe-smoke.json');
  try { fs.writeFileSync(out, JSON.stringify(result, null, 2)); } catch (e) { console.error(e); }
  console.log('SMOKE_RESULT ' + JSON.stringify(result));
  clearTimeout(smokeTimer);
  app.exit(result.ok ? 0 : 1);
}

// --- IPC ------------------------------------------------------------------------------------
const openFiles = new Map();
let nextFileId = 1;

function registerIpc() {
  ipcMain.handle('dialog:openAudio', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '导入音乐',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '音频文件', extensions: AUDIO_EXT },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('dialog:saveVideo', async (e, { defaultName, ext }) => {
    const r = await dialog.showSaveDialog(win, {
      title: '导出视频',
      defaultPath: path.join(app.getPath('videos'), defaultName),
      filters: [{ name: ext === 'webm' ? 'WebM 视频' : 'MP4 视频', extensions: [ext] }]
    });
    return r.canceled ? null : r.filePath;
  });

  ipcMain.handle('file:read', async (e, p) => {
    const buf = await fsp.readFile(p);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  });
  ipcMain.handle('file:stat', async (e, p) => {
    try { const s = await fsp.stat(p); return { size: s.size, mtime: s.mtimeMs }; } catch { return null; }
  });
  ipcMain.handle('file:open', async (e, p) => {
    await fsp.mkdir(path.dirname(p), { recursive: true });
    const fh = await fsp.open(p, 'w');
    const id = nextFileId++;
    openFiles.set(id, { fh, path: p });
    return id;
  });
  ipcMain.handle('file:write', async (e, id, data, position) => {
    const f = openFiles.get(id);
    if (!f) throw new Error('file not open');
    await f.fh.write(data, 0, data.byteLength, position);
    return true;
  });
  ipcMain.handle('file:close', async (e, id) => {
    const f = openFiles.get(id);
    if (!f) return false;
    openFiles.delete(id);
    await f.fh.close();
    return true;
  });
  ipcMain.handle('file:remove', async (e, p) => { try { await fsp.rm(p, { force: true }); } catch { /* ignore */ } return true; });
  ipcMain.handle('file:writeWhole', async (e, p, data) => {
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, data);
    return p;
  });

  ipcMain.handle('app:paths', () => ({
    pictures: path.join(app.getPath('pictures'), '音乐粒子宇宙'),
    videos: app.getPath('videos'),
    temp: app.getPath('temp'),
    userData: app.getPath('userData')
  }));
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), packaged: app.isPackaged, platform: process.platform, smoke: isSmoke, smokeDir: process.env.PU_SMOKE_DIR || app.getPath('temp'), electron: process.versions.electron, chrome: process.versions.chrome }));
  ipcMain.handle('app:gpu', async () => {
    try { return { status: app.getGPUFeatureStatus(), info: await app.getGPUInfo('basic') }; } catch (err) { return { error: String(err) }; }
  });
  ipcMain.handle('app:pendingFiles', () => pendingFiles.splice(0));

  ipcMain.handle('shell:showItem', (e, p) => { shell.showItemInFolder(p); return true; });
  ipcMain.handle('shell:openPath', (e, p) => shell.openPath(p));

  ipcMain.handle('win:toggleFullscreen', () => { win.setFullScreen(!win.isFullScreen()); return win.isFullScreen(); });
  ipcMain.handle('win:setFullscreen', (e, v) => { win.setFullScreen(!!v); return win.isFullScreen(); });
  ipcMain.handle('win:isFullscreen', () => win.isFullScreen());
  ipcMain.handle('win:overlay', (e, opts) => { try { win.setTitleBarOverlay(opts); } catch { /* not supported */ } return true; });
  ipcMain.handle('win:setProgress', (e, v) => { win.setProgressBar(v); return true; });
  ipcMain.handle('win:preventSleep', (e, on) => {
    const { powerSaveBlocker } = require('electron');
    if (on && !global.__psb) global.__psb = powerSaveBlocker.start('prevent-display-sleep');
    if (!on && global.__psb != null) { powerSaveBlocker.stop(global.__psb); global.__psb = null; }
    return true;
  });

  ipcMain.on('smoke:log', (e, msg) => console.log('[smoke]', msg));
  ipcMain.on('smoke:result', (e, result) => finishSmoke(result));
}

// --- app lifecycle --------------------------------------------------------------------------
app.on('second-instance', (e, argv) => {
  const files = audioArgs(argv);
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
    if (files.length) win.webContents.send('open-files', files);
  }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.particleuniverse.app');

  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!rel) rel = 'index.html';
    const file = path.normalize(path.join(rendererRoot, rel));
    if (!file.startsWith(rendererRoot)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // getDisplayMedia → capture system audio (Windows loopback). Video track is discarded by the renderer.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (!sources.length) return callback({});
      callback({ video: sources[0], audio: process.platform === 'win32' ? 'loopback' : undefined });
    }).catch(() => callback({}));
  });
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'display-capture', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
  });

  registerIpc();
  createWindow();
  if (isSmoke) smokeTimer = setTimeout(() => finishSmoke({ ok: false, error: 'timeout' }), Number(process.env.PU_SMOKE_TIMEOUT || 600000));
});

app.on('window-all-closed', () => app.quit());
