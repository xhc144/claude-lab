// Automatic updates from the GitHub release feed (electron-updater, generic
// provider configured in package.json → resources/app-update.yml). Updates are
// downloaded in the background and installed when the app quits or when the
// user clicks "restart". A build signed with a certificate records its
// publisher in app-update.yml; electron-updater then accepts an installer
// signed by a certificate this computer trusts with that name, and
// update-signer.cjs also accepts one signed by exactly the same certificate as
// the running program (self-signed certificates are not trusted elsewhere).
import { app } from 'electron';
import electronUpdater from 'electron-updater';
import updateSigner from './update-signer.cjs';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CHECK_DELAY_MS = 15_000;
const CHECK_EVERY_MS = 6 * 3600_000;

/** @type {{state:'disabled'|'idle'|'checking'|'none'|'downloading'|'ready'|'error', current:string, version?:string, percent?:number, error?:string, reason?:string, checkedAt?:string}} */
let status = { state: 'disabled', current: app.getVersion() };
let updater = null;
let timer = null;
let getWin = () => null;

function logFile() {
  return join(app.getPath('userData'), 'logs', 'updater.log');
}

function log(level, msg) {
  try {
    const f = logFile();
    mkdirSync(join(f, '..'), { recursive: true });
    if (existsSync(f) && statSync(f).size > 512 * 1024) renameSync(f, f + '.old');
    appendFileSync(f, `${new Date().toISOString()} [${level}] ${typeof msg === 'string' ? msg : msg?.stack ?? JSON.stringify(msg)}\n`);
  } catch {
    /* logging must never break the app */
  }
}

function set(next) {
  status = { ...status, ...next, current: app.getVersion() };
  getWin()?.webContents.send('update:status', status);
}

/** Plain-language reason for a failed check or download. */
function explain(e) {
  const m = String(e?.message ?? e);
  if (/sign verification failed|not signed|signed with incorrect certificate/i.test(m)) return '新版本的签名与当前版本不一致，或这台电脑不信任它的证书，已拒绝安装。';
  if (/sha512 checksum mismatch|checksum/i.test(m)) return '下载的文件不完整或被改动过，已丢弃，稍后会重新下载。';
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|net::|socket hang up|timeout/i.test(m)) return '连不上更新服务器，请检查网络后重试。';
  if (/404|Cannot find latest\.yml|Cannot find channel/i.test(m)) return '更新服务器上暂时没有可用的版本信息。';
  return m.split('\n')[0].slice(0, 200);
}

/** The updater only runs in an installed Windows build with an update feed. */
function unavailableReason(selfTest) {
  if (selfTest) return '自检模式';
  if (!app.isPackaged) return '开发版本不检查更新';
  if (process.platform !== 'win32') return '仅 Windows 安装版支持自动更新';
  if (!existsSync(join(process.resourcesPath, 'app-update.yml'))) return '此版本没有配置更新地址';
  // the installer leaves "Uninstall <name>.exe" next to the app; an unzipped or copied folder has none
  // and updating it would install a second copy elsewhere
  if (!readdirSync(dirname(process.execPath)).some((f) => /^Uninstall .+\.exe$/i.test(f))) return '不是用安装包安装的副本，请下载安装包';
  return null;
}

export function initUpdater(opts) {
  getWin = opts.win;
  const reason = unavailableReason(opts.selfTest);
  if (reason) {
    status = { state: 'disabled', current: app.getVersion(), reason };
    return;
  }
  const { autoUpdater } = electronUpdater;
  updater = autoUpdater;
  autoUpdater.logger = { info: (m) => log('info', m), warn: (m) => log('warn', m), error: (m) => log('error', m), debug: () => undefined };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  updateSigner.installSameSignerFallback(autoUpdater, log);

  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: undefined }));
  autoUpdater.on('update-not-available', () => set({ state: 'none', checkedAt: new Date().toISOString(), version: undefined, percent: undefined }));
  autoUpdater.on('update-available', (i) => set({ state: 'downloading', version: i.version, percent: 0, checkedAt: new Date().toISOString() }));
  autoUpdater.on('download-progress', (p) => set({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => set({ state: 'ready', version: i.version, percent: 100 }));
  autoUpdater.on('error', (e) => {
    log('error', e);
    set({ state: 'error', error: explain(e), checkedAt: new Date().toISOString() });
  });

  status = { state: 'idle', current: app.getVersion() };
  setTimeout(() => {
    if (opts.enabled()) void checkForUpdates();
  }, CHECK_DELAY_MS);
  timer = setInterval(() => {
    if (opts.enabled() && status.state !== 'ready' && status.state !== 'downloading') void checkForUpdates();
  }, CHECK_EVERY_MS);
}

export function updateStatus() {
  return status;
}

export async function checkForUpdates() {
  if (!updater) return status;
  if (status.state === 'checking' || status.state === 'downloading' || status.state === 'ready') return status;
  try {
    await updater.checkForUpdates();
  } catch (e) {
    // also reported through the 'error' event; keep the friendlier message
    if (status.state !== 'error') set({ state: 'error', error: explain(e) });
  }
  return status;
}

/** Quit and run the downloaded installer silently, then start the new version. */
export function installNow() {
  if (!updater || status.state !== 'ready') return false;
  if (timer) clearInterval(timer);
  setImmediate(() => updater.quitAndInstall(true, true));
  return true;
}

/** Summary of the packaged update configuration, used by the self-test. */
export function updateConfigSummary() {
  const f = join(process.resourcesPath, 'app-update.yml');
  if (!existsSync(f)) throw new Error('resources/app-update.yml missing: the packaged app has no update feed');
  const text = readFileSync(f, 'utf8');
  const field = (k) => text.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null;
  const provider = field('provider');
  const url = field('url');
  if (provider !== 'generic' || !url?.startsWith('https://')) throw new Error(`unexpected update feed: provider=${provider} url=${url}`);
  const publisher = text.match(/^publisherName:\s*\n((?:\s+-\s*.+\n?)+)/m)?.[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) ?? null;
  return { provider, url, publisherName: publisher, signedBuild: !!publisher?.length };
}
