'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, session, safeStorage } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const { Store, localDay, isDue } = require('./state.cjs');
const { Engine, MODE_NAMES, within } = require('./engine.cjs');
const { SearchIndex } = require('./search.cjs');
const { categorize, FALLBACK } = require('./classify.cjs');
const { Translator } = require('./translate.cjs');

const dataDirectory = process.env.FILENEST_TEST_DATA || path.join(process.platform === 'win32' ? (process.env.LOCALAPPDATA || app.getPath('appData')) : app.getPath('userData'), 'FileNest');
if (process.platform === 'win32') app.setAppUserModelId('com.filenest.desktop');
app.setPath('userData', path.join(dataDirectory, 'desktop'));
const html = path.join(__dirname, '../renderer/index.html'), appURL = pathToFileURL(html).href;
const assets = path.join(app.getAppPath(), 'assets');

let store, engine, translator, tray, timer, mainWindow = null, busy = false, busyText = '', quitting = false, ready = false;
const statuses = {}, lastAttempts = new Map();
const index = new SearchIndex();
let indexStale = true;

function log(message) {
  try {
    const file = path.join(dataDirectory, 'desktop.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 2 * 1024 * 1024) fs.renameSync(file, file + '.1');
    fs.appendFileSync(file, new Date().toISOString() + ' ' + message + '\n', 'utf8');
  } catch {}
}
function startupEnabled() { return process.platform === 'win32' && app.getLoginItemSettings({ path: process.execPath, args: ['--background'], name: 'FileNest2' }).openAtLogin; }
function getState() {
  const v = store.snapshot();
  return { version: app.getVersion(), rules: v.Rules, categories: v.Categories, fallback: FALLBACK, paused: v.Paused, startup: startupEnabled(), busy, busyText, statuses: JSON.parse(JSON.stringify(statuses)), dataDirectory, modeNames: MODE_NAMES };
}
function send(event) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('filenest:event', event); }
function broadcast() {
  if (!store) return;
  send({ type: 'state', state: getState() });
  if (tray) tray.setToolTip('文件管家' + (busy ? ' · ' + busyText : store.value.Paused ? ' · 自动整理已暂停' : ' · 正在守候'));
}
function toast(message, kind = 'info') { send({ type: 'toast', message, kind }); }
function ensureIdle() { if (busy || quitting) throw new Error('正在整理，请稍等片刻再操作。'); }
async function work(label, fn) {
  ensureIdle(); busy = true; busyText = label; broadcast();
  try { return await fn(); }
  catch (error) { log(label + ': ' + (error.stack || error)); throw error; }
  finally { busy = false; busyText = ''; broadcast(); if (quitting) void completeQuit(); }
}
function ruleById(ruleId) { const r = store.snapshot().Rules.find(x => x.Id === ruleId); if (!r) throw new Error('这个任务不存在或已被删除。'); return r; }

function showWindow() {
  if (quitting) return;
  if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); return; }
  mainWindow = new BrowserWindow({
    width: 1240, height: 860, minWidth: 960, minHeight: 640, title: '文件管家', backgroundColor: '#f5f7f8', show: false,
    icon: path.join(assets, 'app.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged || !!process.env.FILENEST_TEST_DATA }
  });
  mainWindow.setMenu(null);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== appURL) event.preventDefault(); });
  mainWindow.on('page-title-updated', event => event.preventDefault());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.once('ready-to-show', () => { mainWindow.show(); if (store.notice) { toast(store.notice); store.notice = ''; } });
  mainWindow.loadFile(html);
}

function senderOk(event) { if (!event.senderFrame || event.senderFrame.url !== appURL) throw new Error('页面来源无效。'); }
function handle(name, handler) {
  ipcMain.handle('filenest:' + name, async (event, arg) => {
    senderOk(event);
    try { return await handler(arg || {}, event); }
    catch (error) { log(name + ': ' + (error.stack || error)); throw new Error(error.message || String(error)); }
  });
}

function summarize(result) {
  const parts = [];
  if (result.Moved) parts.push('整理了 ' + result.Moved + ' 项');
  if (result.Waiting) parts.push(result.Waiting + ' 项等待稳定');
  if (result.Failed) parts.push(result.Failed + ' 项失败');
  return parts.length ? parts.join(' · ') : '没有需要整理的新文件';
}
// 任务文件夹里如果有「★最近使用\refresh-recent.ps1」，整理后（以及定时）运行它，重建最近 7 天的快捷方式。
function refreshRecent(root) {
  const script = path.join(root, '★最近使用', 'refresh-recent.ps1');
  if (process.platform !== 'win32' || !fs.existsSync(script)) return;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true, timeout: 180000 },
    error => { if (error) log('刷新最近使用失败：' + error.message); });
}
function refreshAllRecent() { if (store) for (const r of store.snapshot().Rules) if (r.Enabled) refreshRecent(r.Root); }
// 打开文件时 Windows 会写“最近打开”记录：盯着它，几秒后刷新，让“未看”及时变成看过。
let recentTimer = null;
function watchRecentOpens() {
  if (process.platform !== 'win32') return;
  const dir = path.join(process.env.APPDATA || app.getPath('appData'), 'Microsoft', 'Windows', 'Recent');
  try {
    fs.watch(dir, { persistent: false }, () => { clearTimeout(recentTimer); recentTimer = setTimeout(refreshAllRecent, 5000); })
      .on('error', error => log('监视最近打开记录失败：' + error.message));
  } catch (error) { log('监视最近打开记录失败：' + error.message); }
}

// 机器翻译：整理前把要翻的英文名先翻好放进缓存，整理时同步查缓存。失败不影响整理。
const translateOptions = () => ({ translate: translator && translator.enabled() ? s => translator.lookup(s) : null });
async function runOrganize(rule) {
  if (translator && translator.enabled()) { try { await translator.ensure(engine.translationCandidates(rule)); } catch (e) { log('机器翻译：' + e.message); } }
  const plan = engine.plan(rule, store.value.Categories, translateOptions());
  const result = engine.execute(rule, plan);
  result.Kept = plan.Kept; result.Notes = plan.Notes;
  statuses[rule.Id] = { text: summarize(result), lastRun: new Date().toISOString(), moved: result.Moved };
  if (result.Moved) refreshRecent(rule.Root);
  if (result.Moved || result.Failed) { log(rule.Name + ': ' + JSON.stringify({ Moved: result.Moved, Failed: result.Failed, Messages: result.Messages.slice(0, 20) })); indexStale = true; }
  if (result.Moved) send({ type: 'activity' });
  broadcast();
  return result;
}
async function tick() {
  if (busy || quitting || !store || store.value.Paused) return;
  for (const rule of store.snapshot().Rules) {
    const now = new Date();
    if (!isDue(rule, { paused: store.value.Paused, now, lastAttempt: lastAttempts.get(rule.Id) || 0 })) continue;
    lastAttempts.set(rule.Id, now.getTime());
    try {
      const result = await work('正在整理 ' + rule.Name, () => runOrganize(rule));
      if (rule.Schedule === 1 && result.Failed === 0 && result.Waiting === 0) store.markDate(rule.Id, localDay(now));
      if (result.Moved && (!mainWindow || !mainWindow.isFocused())) log('自动整理 ' + rule.Name + '：' + summarize(result));
    } catch (error) {
      statuses[rule.Id] = { text: '未完成：' + error.message, lastRun: new Date().toISOString(), error: true };
      broadcast();
    }
    if (busy || quitting || store.value.Paused) break;
  }
}

function allowedPath(p) {
  if (typeof p !== 'string' || !p) throw new Error('路径无效。');
  const full = path.resolve(p);
  if (!store.value.Rules.some(r => within(full, r.Root))) throw new Error('只能打开任务文件夹里的文件。');
  return full;
}

async function ensureIndex() { if (indexStale || !index.builtAt) { indexStale = false; await index.build(store.snapshot().Rules); } }

function selfTest() {
  const lines = [];
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'filenest-selftest-'));
  try {
    const root = path.join(base, '下载'), data = path.join(base, 'data');
    fs.mkdirSync(root); fs.mkdirSync(data);
    const old = new Date(Date.now() - 3600 * 1000);
    for (const n of ['微分几何讲义.pdf', '量子力学.pdf', '英语单词.pdf', '未知文件.bin']) { const f = path.join(root, n); fs.writeFileSync(f, 'test'); fs.utimesSync(f, old, old); }
    const e = new Engine({ dataDirectory: data, now: () => new Date(Date.now() + 86400000) });
    const rule = { Id: 'f'.repeat(32), Name: '自检', Root: root, Mode: 4, DateGranularity: 'month', DateSource: 1, IncludeFolders: true, StableSeconds: 30, Excludes: [] };
    const plan = e.plan(rule, store.value.Categories);
    lines.push('✓ 预览：' + plan.Moves.length + ' 项将被整理');
    for (const m of plan.Moves) lines.push('    ' + path.basename(m.Source) + ' → ' + m.Relative);
    const r = e.execute(rule, plan);
    lines.push((r.Moved === plan.Moves.length ? '✓' : '✗') + ' 移动：成功 ' + r.Moved + ' 项，失败 ' + r.Failed + ' 项');
    const u = e.undo();
    lines.push((u.Moved === r.Moved ? '✓' : '✗') + ' 撤销：移回 ' + u.Moved + ' 项');
    fs.accessSync(dataDirectory, fs.constants.W_OK);
    lines.push('✓ 数据文件夹可写入：' + dataDirectory);
    for (const rr of store.value.Rules) {
      try { const p = engine.plan(rr, store.value.Categories); lines.push('✓ 任务“' + rr.Name + '”可访问，当前待整理 ' + p.Moves.length + ' 项'); }
      catch (err) { lines.push('✗ 任务“' + rr.Name + '”：' + err.message); }
    }
  } catch (err) { lines.push('✗ 自检出错：' + err.message); }
  finally { try { fs.rmSync(base, { recursive: true, force: true }); } catch {} }
  return lines.join('\n');
}

function wireIPC() {
  handle('getState', () => getState());
  handle('pickFolder', async () => { const r = await dialog.showOpenDialog(mainWindow, { title: '选择要整理的文件夹', properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
  handle('saveRule', arg => { ensureIdle(); store.saveRule(arg); lastAttempts.delete(arg.Id); indexStale = true; broadcast(); return getState(); });
  handle('deleteRule', arg => { ensureIdle(); store.deleteRule(arg.id); delete statuses[arg.id]; indexStale = true; broadcast(); return getState(); });
  handle('excludeItem', arg => { store.addExclude(arg.ruleId, arg.name); broadcast(); return getState(); });
  handle('previewRule', arg => { const rule = ruleById(arg.id); return work('正在预览', async () => engine.plan(rule, store.value.Categories, translateOptions())); });
  handle('runRule', arg => { const rule = ruleById(arg.id); return work('正在整理 ' + rule.Name, () => runOrganize(rule)); });
  handle('activity', () => engine.activity(40));
  handle('undoBatch', arg => work('正在撤销', async () => {
    const result = engine.undo(arg.id || undefined);
    if (result.Moved && !store.value.Paused) { store.setPaused(true); result.Paused = true; }
    indexStale = true; send({ type: 'activity' });
    return result;
  }));
  handle('setPaused', arg => { store.setPaused(arg.paused); broadcast(); return getState(); });
  handle('setStartup', arg => {
    if (process.platform !== 'win32') throw new Error('开机自启仅适用于 Windows。');
    app.setLoginItemSettings({ openAtLogin: arg.enabled === true, path: process.execPath, args: ['--background'], name: 'FileNest2' });
    broadcast(); return getState();
  });
  handle('search', async arg => { await ensureIndex(); return index.query(arg); });
  handle('searchTops', async arg => { await ensureIndex(); return index.tops(arg.ruleId); });
  handle('rebuildIndex', async () => { indexStale = true; await ensureIndex(); return index.summary(); });
  handle('openPath', async arg => { const p = allowedPath(arg.path); const err = await shell.openPath(p); if (err) throw new Error('无法打开：' + err); });
  handle('showInFolder', arg => { shell.showItemInFolder(allowedPath(arg.path)); });
  handle('saveCategories', arg => { store.saveCategories(arg.categories); broadcast(); return getState(); });
  handle('resetCategories', () => { store.resetCategories(); broadcast(); return getState(); });
  handle('testCategory', arg => {
    const name = String(arg.name || '').trim();
    if (!name) return null;
    return categorize(name, { categories: Array.isArray(arg.categories) ? arg.categories : store.value.Categories, probe: false, isDirectory: !/\.[a-z0-9]{1,6}$/i.test(name) });
  });
  handle('openDataFolder', async () => { const err = await shell.openPath(dataDirectory); if (err) throw new Error(err); });
  handle('exportSettings', async () => {
    const r = await dialog.showSaveDialog(mainWindow, { title: '导出设置', defaultPath: '文件管家设置.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return null; store.exportFile(r.filePath); return r.filePath;
  });
  handle('importSettings', async () => {
    ensureIdle();
    const r = await dialog.showOpenDialog(mainWindow, { title: '导入设置', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled) return null; store.importFile(r.filePaths[0]); lastAttempts.clear(); indexStale = true; broadcast(); return getState();
  });
  handle('runDiagnostics', () => work('正在自检', async () => selfTest()));
  handle('quit', () => { requestQuit(); });
  handle('getTranslate', () => translator.publicConfig());
  handle('saveTranslate', arg => translator.save(arg));
  handle('testTranslate', async arg => ({ sample: 'shifted_path_distance_spectra', result: await translator.test(arg) }));
}

function requestQuit() { quitting = true; if (timer) clearInterval(timer); if (busy) { busyText = '正在收尾，随后退出…'; broadcast(); return; } void completeQuit(); }
async function completeQuit() { if (!quitting) return; tray?.destroy(); tray = null; if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy(); app.exit(0); }

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (ready) showWindow(); });
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => { event.preventDefault(); requestQuit(); });
  app.whenReady().then(() => {
    store = new Store(dataDirectory, app.getAppPath());
    engine = new Engine({ dataDirectory });
    // 密钥用 Windows 账户加密保存（safeStorage），不存明文
    const canEncrypt = () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } };
    translator = new Translator({
      dataDirectory, log,
      encrypt: s => canEncrypt() ? 'enc:' + safeStorage.encryptString(s).toString('base64') : (() => { throw new Error('这台电脑上无法加密保存密钥。'); })(),
      decrypt: s => s.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(s.slice(4), 'base64')) : ''
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
    session.defaultSession.webRequest.onBeforeRequest((details, cb) => cb({ cancel: /^https?:|^wss?:|^ftp:/i.test(details.url) }));
    wireIPC();
    tray = new Tray(nativeImage.createFromPath(path.join(assets, 'tray.png')));
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开文件管家', click: () => showWindow() },
      { label: '暂停 / 恢复自动整理', click: () => { try { store.setPaused(!store.value.Paused); broadcast(); } catch (e) { dialog.showErrorBox('设置未保存', e.message); } } },
      { type: 'separator' }, { label: '退出', click: requestQuit }
    ]));
    tray.on('click', () => showWindow());
    ready = true;
    if (!process.argv.includes('--background')) showWindow();
    timer = setInterval(() => void tick(), 15000);
    setTimeout(() => void tick(), 3000);
    setTimeout(refreshAllRecent, 20000);
    setInterval(refreshAllRecent, 10 * 60000);   // 兜底；“今天/昨天”标签也随日期变化
    watchRecentOpens();
    broadcast();
  }).catch(error => { dialog.showErrorBox('文件管家启动失败', error.message); log(error.stack || String(error)); app.exit(1); });
}
