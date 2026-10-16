// GUI mode: the editor window, app lifecycle, and the bridge between the renderer and the shared
// core (project library, ops, render jobs, importers, AI assistant).
import { app, BrowserWindow, Menu, shell, screen, nativeTheme } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { handleProtocol, allowRoot } from './protocol.js';
import { registerIpc } from './ipc.js';
import * as store from '../../core/store/index.js';
import { initUpdater } from './updater.js';

let mainWindow = null;
const pendingOpen = [];

function windowStateFile() { return path.join(store.userDataDir(), 'window.json'); }
function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
    const area = screen.getDisplayMatching(s).workArea;
    if (s.x < area.x - 50 || s.y < area.y - 50 || s.x > area.x + area.width - 100) return { width: s.width, height: s.height, maximized: s.maximized };
    return s;
  } catch { return { width: 1520, height: 940 }; }
}
function saveWindowState(win) {
  try {
    const b = win.getNormalBounds();
    fs.mkdirSync(store.userDataDir(), { recursive: true });
    fs.writeFileSync(windowStateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch { /* ignore */ }
}

/** Files or folders passed on the command line (double-clicked .pptx, a project folder…). */
function filesFromArgv(argv) {
  const explicit = argv.filter((a) => a.startsWith('--open=')).map((a) => a.slice(7)).filter((f) => fs.existsSync(f));
  if (explicit.length) return explicit;
  return argv.slice(1).filter((a) => !a.startsWith('-') && a !== '.' && fs.existsSync(a) && path.resolve(a) !== path.resolve(process.cwd()) && !/\.(asar|cjs|js)$/.test(a) && !/electron(\.exe)?$/i.test(a));
}

export function runApp({ distDir }) {
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  app.setAppUserModelId('app.motif.studio');
  const look = store.readConfig().appearance;
  nativeTheme.themeSource = look === 'light' || look === 'system' ? look : 'dark';

  app.on('second-instance', (_e, argv) => {
    const files = filesFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (files.length) mainWindow.webContents.send('motif:open-files', files);
    }
  });

  pendingOpen.push(...filesFromArgv(process.argv));

  app.whenReady().then(() => {
    handleProtocol(distDir);
    try { allowRoot(store.libraryRoot()); } catch (e) { console.error('library', e); }
    registerIpc({ distDir, getWindow: () => mainWindow, takePendingOpen: () => pendingOpen.splice(0) });
    Menu.setApplicationMenu(buildMenu());
    createWindow();
    initUpdater({ getWindow: () => mainWindow });
  });
  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}

function createWindow() {
  const st = loadWindowState();
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: st.width || 1520, height: st.height || 940, x: st.x, y: st.y,
    minWidth: 1100, minHeight: 680,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1014' : '#eef0f4',
    title: 'Motif',
    show: false,
    titleBarStyle: 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 13 } } : { titleBarOverlay: { color: '#00000000', symbolColor: nativeTheme.shouldUseDarkColors ? '#c9cbd6' : '#3a3f4b', height: 44 } }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: false, nodeIntegration: false,
      backgroundThrottling: false, spellcheck: false,
    },
  });
  if (st.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => { mainWindow = null; });
  // links open in the system browser, never inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('motif://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') mainWindow.webContents.toggleDevTools();
  });
  mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('motif:fullscreen', true));
  mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('motif:fullscreen', false));
  mainWindow.loadURL('motif://app/editor.html');
}

function buildMenu() {
  // The editor draws its own chrome; the native menu exists for macOS conventions and shortcuts
  // that must work even when focus is inside a text field.
  const send = (cmd) => () => mainWindow?.webContents.send('motif:command', cmd);
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: '文件', submenu: [
      { label: '素材库', accelerator: 'CmdOrCtrl+Shift+H', click: send('home') },
      { label: '新建作品…', accelerator: 'CmdOrCtrl+N', click: send('new') },
      { label: '导入素材…', accelerator: 'CmdOrCtrl+I', click: send('import') },
      { type: 'separator' },
      { label: '导出…', accelerator: 'CmdOrCtrl+E', click: send('export') },
      { type: 'separator' },
      process.platform === 'darwin' ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' },
    ] },
    { label: '编辑', submenu: [
      { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: send('undo') },
      { label: '重做', accelerator: process.platform === 'darwin' ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: send('redo') },
      { type: 'separator' },
      { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' },
    ] },
    { label: '视图', submenu: [
      { label: '播放 / 暂停', accelerator: 'Space', registerAccelerator: false, click: send('play') },
      { label: '演示', accelerator: 'F5', click: send('present') },
      { type: 'separator' },
      { role: 'togglefullscreen', label: '全屏' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { role: 'reload', label: '重新载入' },
    ] },
    { label: '帮助', submenu: [
      { label: '快捷键', click: send('shortcuts') },
      { label: 'AI 集成（Skill / CLI / MCP）', click: send('integrations') },
    ] },
  ];
  return Menu.buildFromTemplate(template);
}
