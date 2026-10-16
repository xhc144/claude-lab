// Electron entry point: window, tray, notifications, protocols and the IPC bridge to MailCore.
import {
  app, clipboard, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, nativeImage, nativeTheme, net, powerMonitor, protocol,
  screen, session, shell, type MenuItemConstructorOptions
} from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MailApi } from '../shared/api';
import { API_CHANNEL, EVENT_CHANNEL } from '../shared/api';
import type { AppEvent, AppInfo, IpcError, Settings } from '../shared/types';
import { MailCore } from './core/mail-core';
import { createFileLogger, type Logger } from './core/logger';
import { createSecretBox } from './secrets';
import { initUpdater, installPendingUpdateOnExit } from './updater';

const APP_ID = 'com.hongyan.mail';
const IS_DEV = !!process.env.HY_DEV;
const RENDERER_URL = process.env.HY_RENDERER_URL;

app.setName('Hongyan Mail');
// Portable mode: a "portable.txt" next to the executable keeps all data in ./data beside it.
const PORTABLE = app.isPackaged && fs.existsSync(path.join(path.dirname(process.execPath), 'portable.txt'));
if (PORTABLE) app.setPath('userData', path.join(path.dirname(process.execPath), 'data'));
// Optional override used by the end-to-end tests.
if (process.env.HY_USER_DATA) app.setPath('userData', process.env.HY_USER_DATA);
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

// The app never uses WebGPU; the Windows package omits its shader compiler (dxcompiler.dll).
app.commandLine.appendSwitch('disable-features', 'WebGPUService,WebGPU');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'hy-att', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let core: MailCore | null = null;
let log: Logger;
let quitting = false;
let unread = 0;
const pendingEvents: AppEvent[] = [];
let rendererReady = false;

const resourcesDir = () => (app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../build'));
const assetPath = (name: string) => {
  const candidates = [path.join(resourcesDir(), name), path.join(__dirname, '../../build', name)];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
};

function emit(e: AppEvent) {
  if (!win || win.isDestroyed() || !rendererReady) {
    if (e.type !== 'diagnose-progress' && pendingEvents.length < 200) pendingEvents.push(e);
    return;
  }
  win.webContents.send(EVENT_CHANNEL, e);
}

function settings(): Settings {
  return core!.getSettings();
}

function themeColors() {
  const st = core ? settings() : null;
  const dark = st?.theme === 'dark' || (st?.theme !== 'light' && nativeTheme.shouldUseDarkColors);
  return dark ? { bg: '#161514', color: '#00000000', symbolColor: '#EDEAE4' } : { bg: '#FBFAF7', color: '#00000000', symbolColor: '#1D1B17' };
}

// ------------------------------------------------------------------ window

function restoreBounds(): Partial<Electron.Rectangle> | null {
  const b = core?.settings.getValue<Electron.Rectangle | null>('windowBounds', null);
  if (!b || b.width < 600 || b.height < 400) return null;
  // Ignore saved positions on a monitor that is no longer connected.
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x + 120 > a.x && b.x < a.x + a.width - 120 && b.y + 40 > a.y && b.y < a.y + a.height - 40;
  });
  return visible ? b : { width: b.width, height: b.height };
}

function createWindow(showOnReady = true) {
  const colors = themeColors();
  const bounds = restoreBounds();
  win = new BrowserWindow({
    width: bounds?.width || 1320,
    height: bounds?.height || 840,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 940,
    minHeight: 580,
    show: false,
    title: '鸿雁邮箱',
    backgroundColor: colors.bg,
    icon: assetPath(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: colors.color, symbolColor: colors.symbolColor, height: 46 },
    backgroundMaterial: process.platform === 'win32' && settings().mica ? 'mica' : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true,
      devTools: IS_DEV || !!process.env.HY_DEVTOOLS
    }
  });
  if (core?.settings.getValue('windowMaximized', false)) win.maximize();

  win.once('ready-to-show', () => {
    if (showOnReady) win?.show();
  });
  win.on('close', (e) => {
    if (!win) return;
    const st = settings();
    core?.settings.setValue('windowMaximized', win.isMaximized());
    if (!win.isMaximized() && !win.isMinimized()) core?.settings.setValue('windowBounds', win.getBounds());
    if (!quitting && st.closeToTray && tray) {
      e.preventDefault();
      win.hide();
      if (!st.trayHintShown) {
        core?.updateSettings({ trayHintShown: true });
        showNotification('鸿雁邮箱仍在后台运行', '新邮件到达时会提醒你。可在设置中关闭「关闭窗口时最小化到托盘」。');
      }
    }
  });
  win.on('closed', () => { win = null; rendererReady = false; });
  // Never hold up Windows shutdown / sign-out by hiding to the tray.
  win.on('query-session-end', () => { quitting = true; });
  win.on('session-end', () => { quitting = true; app.quit(); });
  const sendState = () => emit({ type: 'window-state', maximized: !!win?.isMaximized(), focused: !!win?.isFocused() });
  win.on('maximize', sendState);
  win.on('unmaximize', sendState);
  win.on('focus', sendState);
  win.on('blur', sendState);

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    openLink(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (RENDERER_URL && url.startsWith(RENDERER_URL)) return;
    if (url.startsWith('app://local/')) return;
    e.preventDefault();
    openLink(url);
  });
  // Only a reload of the whole page resets the bridge (e-mail iframes also start loads).
  wc.on('did-start-navigation', (details: any) => {
    if (details?.isMainFrame && !details?.isSameDocument) rendererReady = false;
  });
  wc.on('render-process-gone', (_e, d) => log.error(`renderer gone: ${d.reason}`));
  wc.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12' && (IS_DEV || process.env.HY_DEVTOOLS)) wc.toggleDevTools();
  });

  if (RENDERER_URL) win.loadURL(RENDERER_URL);
  else win.loadURL('app://local/index.html');
}

function showWindow() {
  if (!win) createWindow();
  else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

function openLink(url: string) {
  if (/^mailto:/i.test(url)) {
    handleMailto(url);
    return;
  }
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
}

function handleMailto(url: string) {
  try {
    const u = new URL(url);
    const to = decodeURIComponent(u.pathname).split(',').filter(Boolean).map((a) => ({ name: '', address: a.trim() }));
    const cc = (u.searchParams.get('cc') || '').split(',').filter(Boolean).map((a) => ({ name: '', address: a.trim() }));
    const body = u.searchParams.get('body') || '';
    showWindow();
    emit({ type: 'compose', prefill: { to, cc, subject: u.searchParams.get('subject') || '', html: body ? `<p>${body.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/\n/g, '<br>')}</p>` : '' } });
  } catch { /* malformed */ }
}

// ------------------------------------------------------------------ tray, badge, notifications

function trayImage() {
  const img = nativeImage.createFromPath(assetPath(process.platform === 'win32' ? 'tray.ico' : 'tray.png'));
  return img.isEmpty() ? nativeImage.createFromPath(assetPath('icon.png')).resize({ width: 16, height: 16 }) : img;
}

function createTray() {
  if (tray) return;
  try {
    tray = new Tray(trayImage());
  } catch (e) {
    log.warn(`tray unavailable: ${(e as Error).message}`);
    return;
  }
  tray.setToolTip('鸿雁邮箱');
  const menu: MenuItemConstructorOptions[] = [
    { label: '打开鸿雁邮箱', click: () => showWindow() },
    { label: '写邮件', click: () => { showWindow(); emit({ type: 'compose', prefill: {} }); } },
    { label: '立即收取', click: () => core?.syncNow() },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(menu));
  tray.on('click', () => showWindow());
}

function showNotification(title: string, body: string, onClick?: () => void) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: assetPath('icon.png'), silent: !settings().notificationSound });
  n.on('click', () => { showWindow(); onClick?.(); });
  n.show();
}

function notifyNewMail(items: Array<{ accountId: number; id: number; from: string; subject: string; snippet: string }>) {
  if (win && win.isFocused()) return;
  if (items.length > 3) {
    showNotification(`${items.length} 封新邮件`, items.slice(0, 3).map((i) => `${i.from}：${i.subject}`).join('\n'),
      () => emit({ type: 'navigate', view: { kind: 'unified', box: 'inbox' } }));
    return;
  }
  for (const it of items) showNotification(it.from, `${it.subject}${it.snippet ? `\n${it.snippet.slice(0, 80)}` : ''}`, () => emit({ type: 'open-message', messageId: it.id }));
}

function setUnreadBadge(count: number, pngDataUrl: string | null) {
  unread = count;
  tray?.setToolTip(count ? `鸿雁邮箱 · ${count} 封未读` : '鸿雁邮箱');
  if (process.platform === 'win32' && win) {
    win.setOverlayIcon(count && pngDataUrl ? nativeImage.createFromDataURL(pngDataUrl) : null, count ? `${count} 封未读邮件` : '');
  } else {
    app.setBadgeCount(count);
  }
}

/** Windows toast notifications need a Start-menu shortcut carrying our AppUserModelID. */
function ensureShortcutAumid() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  try {
    const dir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const lnk = path.join(dir, '鸿雁邮箱.lnk');
    const opts = { target: process.execPath, appUserModelId: APP_ID, description: '鸿雁邮箱', icon: process.execPath, iconIndex: 0 };
    if (fs.existsSync(lnk)) shell.writeShortcutLink(lnk, 'update', opts);
    else if (PORTABLE) return;
    else if (!fs.existsSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs', '鸿雁邮箱.lnk'))) shell.writeShortcutLink(lnk, 'create', opts);
  } catch (e) {
    log.warn(`shortcut update failed: ${(e as Error).message}`);
  }
}

// ------------------------------------------------------------------ protocols & session

function registerProtocols() {
  const rendererDir = path.join(__dirname, '../renderer');
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    'img-src \'self\' data: blob: hy-att: https: http:',
    "font-src 'self' data: https:",
    "media-src 'self' hy-att: blob: data:",
    "connect-src 'self'",
    "frame-src 'self' about:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
  ].join('; ');
  protocol.handle('app', async (req) => {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    if (p === '/' || !p) p = '/index.html';
    const file = path.normalize(path.join(rendererDir, p));
    if (!file.startsWith(rendererDir)) return new Response('forbidden', { status: 403 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    if (file.endsWith('.html')) headers.set('Content-Security-Policy', CSP);
    return new Response(res.body, { status: res.status, headers });
  });
  protocol.handle('hy-att', async (req) => {
    // hy-att://m/<messageId>/<index>?t=<token>
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split('/').filter(Boolean);
      if (!core!.verifyAttachmentToken(Number(parts[0]), url.searchParams.get('t'))) return new Response('forbidden', { status: 403 });
      const att = await core!.attachment(Number(parts[0]), Number(parts[1]));
      return new Response(att.content as any, { headers: { 'Content-Type': att.contentType, 'Cache-Control': 'max-age=3600' } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

function hardenSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write'));
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'clipboard-sanitized-write');
  // Remote content from e-mails may only be images or fonts (and only when the user allowed them in the reader).
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, cb) => {
    if (RENDERER_URL && details.url.startsWith(RENDERER_URL)) return cb({});
    const allowed = ['image', 'font'].includes(details.resourceType);
    cb({ cancel: !allowed });
  });
}

// ------------------------------------------------------------------ IPC

async function fileDialogSave(defaultName: string, data: Buffer): Promise<string | null> {
  const res = await dialog.showSaveDialog(win!, { defaultPath: path.join(app.getPath('downloads'), defaultName) });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, data);
  return res.filePath;
}

const RISKY_EXT = /\.(exe|com|bat|cmd|msi|msp|scr|pif|vbs|vbe|js|jse|wsf|wsh|ps1|psm1|hta|cpl|lnk|reg|jar|scf|inf|iso|img|vhd|vhdx|appx|msix)$/i;

function buildHandlers(): MailApi {
  const c = core!;
  return {
    async getAppInfo(): Promise<AppInfo> {
      const rel = os.release();
      const build = Number(rel.split('.')[2] || 0);
      return {
        version: app.getVersion(),
        platform: process.platform,
        osRelease: rel,
        isWindows11: process.platform === 'win32' && build >= 22000,
        dataDir: app.getPath('userData'),
        encryptionAvailable: secretsBackend.available,
        encryptionBackend: secretsBackend.backend,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        dev: IS_DEV
      };
    },
    async openDataDir() { await shell.openPath(app.getPath('userData')); },
    async openLogsDir() { await shell.openPath(path.join(app.getPath('userData'), 'logs')); },
    async openExternal(url) { if (/^(https?|mailto):/i.test(url)) openLink(url); },
    async setUnreadBadge(count, png) { setUnreadBadge(count, png); },
    async setTitleBarColors(colors) {
      if (win && process.platform !== 'darwin') {
        try { win.setTitleBarOverlay({ color: colors.color, symbolColor: colors.symbolColor, height: 46 }); } catch { /* unsupported */ }
        win.setBackgroundColor(colors.color === '#00000000' ? themeColors().bg : colors.color);
      }
    },
    async windowControl(action) {
      if (!win) return;
      if (action === 'minimize') win.minimize();
      else if (action === 'maximize') (win.isMaximized() ? win.unmaximize() : win.maximize());
      else win.close();
    },
    async setNetworkOnline(online) { c.setOnline(online); },
    async copyText(text) { await clipboard.writeText(String(text)); },
    async copyImageAt(x, y) { win?.webContents.copyImageAt(Math.round(x), Math.round(y)); },
    async editCommand(cmd) {
      const wc = win?.webContents;
      if (!wc) return;
      const allowed = { undo: () => wc.undo(), redo: () => wc.redo(), cut: () => wc.cut(), copy: () => wc.copy(), paste: () => wc.paste(), pasteAndMatchStyle: () => wc.pasteAndMatchStyle(), selectAll: () => wc.selectAll(), delete: () => wc.delete() } as const;
      allowed[cmd]?.();
    },
    async setDefaultMailClient() {
      const ok = app.setAsDefaultProtocolClient('mailto');
      if (ok && process.platform === 'win32') await shell.openExternal('ms-settings:defaultapps');
      return ok;
    },

    async getSettings() { return c.getSettings(); },
    async updateSettings(patch) {
      const next = c.updateSettings(patch);
      if (patch.launchAtLogin !== undefined && (process.platform === 'win32' || process.platform === 'darwin')) {
        app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ['--hidden'], name: 'HongyanMail' });
      }
      if (patch.theme !== undefined) nativeTheme.themeSource = next.theme;
      return next;
    },

    async listAccounts() { return c.listAccounts(); },
    async discover(email) { return c.discover(email); },
    async testConnection(input, runId) { return c.testConnection(input, runId); },
    async addAccount(input) { return c.addAccount(input); },
    async updateAccount(id, patch) { return c.updateAccount(id, patch); },
    async removeAccount(id) { await c.removeAccount(id); },
    async reorderAccounts(ids) { c.reorderAccounts(ids); },
    async diagnoseAccount(id, runId, override) { return c.diagnoseAccount(id, runId, override); },
    async startOAuth(provider, hint) {
      const r = await c.startOAuth(provider, hint);
      showWindow();
      return r;
    },
    async cancelOAuth() { c.cancelOAuth(); },

    async listFolders() { return c.listFolders(); },
    async createFolder(accountId, name, parent) { await c.createFolder(accountId, name, parent); },
    async renameFolder(id, name) { await c.renameFolder(id, name); },
    async deleteFolder(id) { await c.deleteFolder(id); },
    async setActiveFolder(id) { c.setActiveFolder(id); },

    async listMessages(q, start, count) { return c.listMessages(q, start, count); },
    async categoryCounts(q) { return c.categoryCounts(q); },
    async unifiedCounts() { return c.unifiedCounts(); },
    async getMessage(id) { return c.getMessage(id); },
    async getThread(id) { return c.getThread(id); },
    async ensurePreviews(ids) { c.ensurePreviews(ids); },
    async setSeen(ids, seen) { c.setSeen(ids, seen); },
    async setFlagged(ids, flagged) { c.setFlagged(ids, flagged); },
    async moveMessages(ids, dest) { return c.moveMessages(ids, dest); },
    async archiveMessages(ids) { return c.archiveMessages(ids); },
    async trashMessages(ids) { return c.trashMessages(ids); },
    async deletePermanently(ids) { await c.deletePermanently(ids); },
    async markSpam(ids, spam) { return c.markSpam(ids, spam); },
    async undo(token) { await c.undo(token); },
    async setCategory(ids, cat, all) { c.setCategory(ids, cat, all); },
    async markFolderRead(id) { return c.markFolderRead(id); },
    async markViewRead(q) { return c.markViewRead(q); },
    async queryIds(q) { return c.queryIds(q); },
    async emptyFolder(id) { return c.emptyFolder(id); },
    async listBlockedSenders() { return c.listBlockedSenders(); },
    async blockSenders(patterns) { return c.blockSenders(patterns); },
    async unblockSender(pattern) { c.unblockSender(pattern); },
    async messagesFromSender(address) { return c.messagesFromSender(address); },
    async trustSender(address) { c.trustSender(address); },
    async saveAttachment(messageId, index) {
      const a = await c.attachment(messageId, index);
      return fileDialogSave(a.filename, a.content);
    },
    async saveAllAttachments(messageId) {
      const list = (await c.allAttachments(messageId)).filter((a) => !a.inline);
      if (!list.length) return null;
      const res = await dialog.showOpenDialog(win!, { title: '选择保存位置', defaultPath: app.getPath('downloads'), properties: ['openDirectory', 'createDirectory'] });
      if (res.canceled || !res.filePaths[0]) return null;
      const dir = res.filePaths[0];
      for (const a of list) {
        let target = path.join(dir, a.filename);
        let n = 1;
        while (fs.existsSync(target)) {
          const ext = path.extname(a.filename);
          target = path.join(dir, `${path.basename(a.filename, ext)} (${n++})${ext}`);
        }
        fs.writeFileSync(target, a.content);
      }
      shell.openPath(dir);
      return dir;
    },
    async openAttachment(messageId, index) {
      const a = await c.attachment(messageId, index);
      if (RISKY_EXT.test(a.filename)) {
        const r = await dialog.showMessageBox(win!, {
          type: 'warning',
          buttons: ['取消', '仍然打开'],
          defaultId: 0,
          cancelId: 0,
          title: '可能存在风险的附件',
          message: `「${a.filename}」是可执行或脚本类文件`,
          detail: '来自陌生人的此类附件可能包含病毒。只有在你确认发件人可信时才打开。'
        });
        if (r.response !== 1) return;
      }
      const dir = path.join(app.getPath('temp'), 'hongyan-mail', String(messageId));
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, a.filename);
      fs.writeFileSync(file, a.content);
      const err = await shell.openPath(file);
      if (err) throw new Error(`无法打开附件：${err}`);
    },
    async exportEml(messageId) {
      const { raw, subject } = await c.getSource(messageId);
      return fileDialogSave(`${(subject || 'message').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)}.eml`, raw);
    },
    async getSource(messageId) {
      const { raw } = await c.getSource(messageId);
      return raw.toString('utf8');
    },
    async printMessage(messageId) {
      const d = await c.getMessage(messageId);
      const { mail } = await c.parsed(messageId);
      const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
      let body = d.html ?? `<pre style="white-space:pre-wrap;font:inherit">${esc(d.text || '')}</pre>`;
      body = body.replace(/(["'(])cid:([^"')\s]+)/gi, (m0, q, cid) => {
        const a = mail.attachments.find((x) => (x.cid || '') === cid);
        return a ? `${q}data:${a.contentType};base64,${(a.content as Buffer).toString('base64')}` : m0;
      });
      const fmt = (l: { name: string; address: string }[]) => esc(l.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', '));
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.subject)}</title>
        <style>body{font-family:"Segoe UI","Microsoft YaHei UI",sans-serif;font-size:13px;color:#111;margin:24px}
        .h{border-bottom:1px solid #ccc;padding-bottom:10px;margin-bottom:16px}.h h1{font-size:18px;margin:0 0 8px}
        .h div{color:#444;margin:2px 0}img{max-width:100%}</style></head><body>
        <div class="h"><h1>${esc(d.subject || '（无主题）')}</h1>
        <div>发件人：${d.from ? fmt([d.from]) : ''}</div><div>收件人：${fmt(d.to)}</div>${d.cc.length ? `<div>抄送：${fmt(d.cc)}</div>` : ''}
        <div>时间：${esc(new Date(d.date).toLocaleString('zh-CN'))}</div></div>${body}</body></html>`;
      const file = path.join(app.getPath('temp'), `hongyan-print-${messageId}.html`);
      fs.writeFileSync(file, html);
      const pw = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
      await pw.loadFile(file);
      pw.webContents.print({}, () => { pw.close(); fs.rmSync(file, { force: true }); });
    },
    async unsubscribe(messageId) { return c.unsubscribe(messageId); },

    async searchServer(query, accountId) { return c.searchServer(query, accountId); },

    async suggestContacts(prefix) { return c.suggestContacts(prefix); },
    async composePrefill(mode, id) { return c.composePrefill(mode, id); },
    async pickAttachments() {
      const res = await dialog.showOpenDialog(win!, { title: '添加附件', properties: ['openFile', 'multiSelections'] });
      if (res.canceled) return [];
      return c.statFiles(res.filePaths);
    },
    async statFiles(paths) { return c.statFiles(paths); },
    async send(payload, sendAt) { return c.send(payload, sendAt); },
    async cancelSend(id) { return c.cancelSend(id); },
    async listOutbox() { return c.listOutbox(); },
    async retryOutbox(id) { c.retryOutbox(id); },
    async deleteOutbox(id) { c.deleteOutbox(id); },
    async editOutbox(id) { return c.editOutbox(id); },
    async saveDraft(payload, upload) { return c.saveDraft(payload, upload); },
    async deleteDraft(id) { c.deleteDraft(id); },
    async listDrafts() { return c.listDrafts(); },

    async syncNow(accountId) { c.syncNow(accountId); }
  };
}

let secretsBackend: { available: boolean; backend: string } = { available: false, backend: '' };

function registerIpc() {
  const handlers = buildHandlers() as unknown as Record<string, (...args: any[]) => Promise<any>>;
  ipcMain.handle(API_CHANNEL, async (event, method: string, args: any[]) => {
    if (!win || event.sender !== win.webContents) return { ok: false, error: { message: 'forbidden' } };
    const fn = handlers[method];
    if (!fn) return { ok: false, error: { message: `unknown method ${method}` } };
    try {
      return { ok: true, value: await fn(...(args || [])) };
    } catch (e: any) {
      const err: IpcError = { message: e?.message || String(e), code: e?.code, diagnosis: e?.diagnosis || null };
      if (!e?.diagnosis) log.warn(`ipc ${method} failed: ${e?.stack || e}`);
      return { ok: false, error: err };
    }
  });
  ipcMain.on('hy:renderer-ready', (event) => {
    if (!win || event.sender !== win.webContents) return;
    rendererReady = true;
    for (const e of pendingEvents.splice(0)) win.webContents.send(EVENT_CHANNEL, e);
  });
}

// ------------------------------------------------------------------ boot

app.on('second-instance', (_e, argv) => {
  const mailto = argv.find((a) => /^mailto:/i.test(a));
  if (mailto) handleMailto(mailto);
  else showWindow();
});

app.on('before-quit', () => { quitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && (!tray || !settings().closeToTray)) app.quit();
});

app.whenReady().then(async () => {
  const dataDir = app.getPath('userData');
  log = createFileLogger(path.join(dataDir, 'logs'), IS_DEV);
  log.info(`starting Hongyan Mail ${app.getVersion()} (electron ${process.versions.electron}, ${process.platform} ${os.release()})`);
  Menu.setApplicationMenu(null);
  const secrets = createSecretBox(dataDir);
  secretsBackend = { available: secrets.available, backend: secrets.backend };
  core = new MailCore({
    dataDir,
    secrets,
    log,
    fetch: (url, init) => net.fetch(url, { signal: init?.signal }),
    httpPost: async (url, form) => {
      const res = await net.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(form).toString() });
      let json: any = {};
      try { json = await res.json(); } catch { /* non-JSON */ }
      return { status: res.status, json };
    },
    openExternal: (url) => shell.openExternal(url),
    emit,
    notifyNewMail
  });
  nativeTheme.themeSource = settings().theme;
  nativeTheme.on('updated', () => emit({ type: 'settings-changed', settings: settings() }));
  registerProtocols();
  hardenSession();
  registerIpc();
  ensureShortcutAumid();
  core.start();
  const hidden = process.argv.includes('--hidden') || settings().startMinimized;
  createTray();
  createWindow(!hidden);
  initUpdater({ log, window: () => win });
  const mailto = process.argv.find((a) => /^mailto:/i.test(a));
  if (mailto) setTimeout(() => handleMailto(mailto), 1500);
  powerMonitor.on('resume', () => { log.info('system resumed'); core?.syncNow(); });
  void unread;
}).catch((e) => {
  console.error(e);
  try { log?.error('startup failed', e); } catch { /* ignore */ }
  dialog.showErrorBox('鸿雁邮箱无法启动', String(e?.stack || e));
  app.exit(1);
});

let shuttingDown = false;
app.on('will-quit', (e) => {
  if (shuttingDown || !core) return;
  e.preventDefault();
  shuttingDown = true;
  tray?.destroy();
  const c = core;
  core = null;
  Promise.race([c.shutdown(), new Promise((r) => setTimeout(r, 3000))]).finally(() => {
    installPendingUpdateOnExit();
    app.exit(0);
  });
});
