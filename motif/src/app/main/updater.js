// Automatic updates from the GitHub release feed (electron-updater, generic provider configured in
// package.json → resources/app-update.yml). New versions download in the background; when one is
// ready the user is asked once whether to restart now, otherwise it installs when Motif quits.
// A signed build records its publisher in app-update.yml; electron-updater then accepts an installer
// signed by a certificate this computer trusts with that name, and update-signer.cjs also accepts one
// signed by exactly the same certificate as the running program (self-signed certificates are not
// trusted on other computers).
import { app, dialog } from 'electron';
import electronUpdater from 'electron-updater';
import updateSigner from './update-signer.cjs';
import fs from 'node:fs';
import path from 'node:path';

const CHECK_DELAY_MS = 20_000;
const CHECK_EVERY_MS = 6 * 3600_000;

let status = { state: 'disabled', current: app.getVersion() };
let updater = null;
let getWindow = () => null;
let prompted = false;

function log(level, msg) {
  try {
    const f = path.join(app.getPath('userData'), 'logs', 'updater.log');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    if (fs.existsSync(f) && fs.statSync(f).size > 512 * 1024) fs.renameSync(f, f + '.old');
    fs.appendFileSync(f, `${new Date().toISOString()} [${level}] ${typeof msg === 'string' ? msg : msg?.stack ?? JSON.stringify(msg)}\n`);
  } catch { /* logging must never break the app */ }
}

function set(next) {
  status = { ...status, ...next, current: app.getVersion() };
  getWindow()?.webContents.send('motif:event', 'update', status);
}

function explain(e) {
  const m = String(e?.message ?? e);
  if (/sign verification failed|not signed|signed with incorrect certificate/i.test(m)) return '新版本的签名与当前版本不一致，或这台电脑不信任它的证书，已拒绝安装。';
  if (/sha512 checksum mismatch|checksum/i.test(m)) return '下载的文件不完整或被改动过，已丢弃，稍后会重新下载。';
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|net::|socket hang up|timeout/i.test(m)) return '连不上更新服务器，请检查网络后重试。';
  if (/404|Cannot find latest\.yml|Cannot find channel/i.test(m)) return '更新服务器上暂时没有可用的版本信息。';
  return m.split('\n')[0].slice(0, 200);
}

function unavailableReason() {
  if (!app.isPackaged) return '开发版本不检查更新';
  if (process.platform !== 'win32') return '仅 Windows 安装版支持自动更新';
  if (!fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) return '此版本没有配置更新地址';
  // the installer leaves "Uninstall Motif.exe" next to the app; the portable zip has none, and
  // updating it would install a second copy elsewhere
  if (!fs.readdirSync(path.dirname(process.execPath)).some((f) => /^Uninstall .+\.exe$/i.test(f))) return '便携版不自动更新，请下载安装版';
  if (process.env.MOTIF_NO_UPDATE === '1') return '已通过 MOTIF_NO_UPDATE 关闭';
  return null;
}

export function initUpdater({ getWindow: gw }) {
  getWindow = gw;
  const reason = unavailableReason();
  if (reason) { status = { state: 'disabled', current: app.getVersion(), reason }; return; }
  const { autoUpdater } = electronUpdater;
  updater = autoUpdater;
  autoUpdater.logger = { info: (m) => log('info', m), warn: (m) => log('warn', m), error: (m) => log('error', m), debug: () => {} };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  updateSigner.installSameSignerFallback(autoUpdater, log);
  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: undefined }));
  autoUpdater.on('update-not-available', () => set({ state: 'none', version: undefined, percent: undefined, checkedAt: new Date().toISOString() }));
  autoUpdater.on('update-available', (i) => set({ state: 'downloading', version: i.version, percent: 0, checkedAt: new Date().toISOString() }));
  autoUpdater.on('download-progress', (p) => set({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => { set({ state: 'ready', version: i.version, percent: 100 }); void promptRestart(); });
  autoUpdater.on('error', (e) => { log('error', e); set({ state: 'error', error: explain(e), checkedAt: new Date().toISOString() }); });
  status = { state: 'idle', current: app.getVersion() };
  setTimeout(() => void checkForUpdates(), CHECK_DELAY_MS);
  setInterval(() => { if (status.state !== 'ready' && status.state !== 'downloading') void checkForUpdates(); }, CHECK_EVERY_MS);
}

async function promptRestart() {
  const win = getWindow();
  if (prompted || !win) return;
  prompted = true;
  const r = await dialog.showMessageBox(win, {
    type: 'info', title: 'Motif 更新', buttons: ['现在重启', '稍后'], defaultId: 0, cancelId: 1, noLink: true,
    message: `Motif ${status.version} 已下载好`,
    detail: '重启后就是新版本，作品不会丢失。选“稍后”的话，下次关闭 Motif 时会自动安装。',
  });
  if (r.response === 0) installNow();
}

export function updateStatus() { return status; }

export async function checkForUpdates() {
  if (!updater || ['checking', 'downloading', 'ready'].includes(status.state)) return status;
  try { await updater.checkForUpdates(); } catch (e) { if (status.state !== 'error') set({ state: 'error', error: explain(e) }); }
  return status;
}

export function installNow() {
  if (!updater || status.state !== 'ready') return false;
  setImmediate(() => updater.quitAndInstall(true, true));
  return true;
}
