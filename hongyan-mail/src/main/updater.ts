// Automatic updates from the GitHub release feed (electron-updater, generic provider configured in
// electron-builder.yml → resources/app-update.yml). Only the installed copy updates; the portable zip
// has no feed. New versions download in the background; when one is ready the user is asked once
// whether to restart now, otherwise it installs when the app exits.
// A signed build records its publisher in app-update.yml; electron-updater then accepts an installer
// signed by a certificate this computer trusts with that name, and update-signer.cjs also accepts one
// signed by exactly the same certificate as the running program (self-signed certificates are not
// trusted on other computers).
import { app, dialog, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import { installSameSignerFallback } from './update-signer.cjs';
import type { Logger } from './core/logger';

const CHECK_DELAY_MS = 30_000;
const CHECK_EVERY_MS = 6 * 3600_000;

type State = 'disabled' | 'idle' | 'checking' | 'none' | 'downloading' | 'ready' | 'error';
let state: State = 'disabled';
let readyVersion = '';
let started = false;
let prompted = false;

function unavailableReason(): string | null {
  if (!app.isPackaged) return 'development build';
  if (process.platform !== 'win32') return 'not Windows';
  if (process.env.HY_NO_UPDATE === '1') return 'HY_NO_UPDATE=1';
  if (!fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) return 'no update feed in this build';
  // the installer leaves "Uninstall Hongyan Mail.exe" next to the app; a portable or copied folder has
  // none, and updating it would install a second copy elsewhere
  if (!fs.readdirSync(path.dirname(process.execPath)).some((f) => /^Uninstall .+\.exe$/i.test(f))) return 'not an installed copy';
  return null;
}

export function initUpdater(opts: { log: Logger; window: () => BrowserWindow | null }) {
  const reason = unavailableReason();
  if (reason) { opts.log.info(`auto-update off: ${reason}`); return; }
  const log = (level: string, m: unknown) => {
    const text = typeof m === 'string' ? m : (m as Error)?.stack ?? JSON.stringify(m);
    if (level === 'error') opts.log.error(`updater: ${text}`);
    else if (level === 'warn') opts.log.warn(`updater: ${text}`);
    else opts.log.info(`updater: ${text}`);
  };
  autoUpdater.logger = { info: (m: unknown) => log('info', m), warn: (m: unknown) => log('warn', m), error: (m: unknown) => log('error', m), debug: () => undefined };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  installSameSignerFallback(autoUpdater, log);
  autoUpdater.on('checking-for-update', () => { state = 'checking'; });
  autoUpdater.on('update-not-available', () => { state = 'none'; });
  autoUpdater.on('update-available', () => { state = 'downloading'; });
  autoUpdater.on('update-downloaded', (i) => {
    state = 'ready';
    readyVersion = i.version;
    void promptRestart(opts.window());
  });
  autoUpdater.on('error', (e) => { state = 'error'; log('error', e); });
  state = 'idle';
  started = true;
  const check = () => {
    if (state === 'checking' || state === 'downloading' || state === 'ready') return;
    autoUpdater.checkForUpdates().catch((e) => log('warn', e));
  };
  setTimeout(check, CHECK_DELAY_MS);
  setInterval(check, CHECK_EVERY_MS);
}

async function promptRestart(win: BrowserWindow | null) {
  if (prompted || !win || win.isDestroyed() || !win.isVisible()) return;
  prompted = true;
  const r = await dialog.showMessageBox(win, {
    type: 'info', title: '鸿雁邮箱 · 更新', buttons: ['现在重启', '稍后'], defaultId: 0, cancelId: 1, noLink: true,
    message: `鸿雁邮箱 ${readyVersion} 已下载好`,
    detail: '重启后就是新版本，账户、邮件和设置都会保留。选“稍后”的话，下次退出鸿雁邮箱时会自动安装。'
  });
  if (r.response === 0) setImmediate(() => autoUpdater.quitAndInstall(true, true));
}

/**
 * The app leaves through app.exit() after shutting MailCore down, which skips the 'quit' event that
 * electron-updater installs on; start the downloaded installer here instead.
 */
export function installPendingUpdateOnExit() {
  if (!started || state !== 'ready') return;
  // install() lives on the Windows (NSIS) updater, not on the AppUpdater type
  try { (autoUpdater as unknown as { install(silent: boolean, runAfter: boolean): boolean }).install(true, false); } catch { /* the next start retries */ }
}
