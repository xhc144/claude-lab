// Electron main process: window, custom protocol for local audio, IPC wiring,
// and a headless self-test used by CI on the packaged Windows build.
import { app, BrowserWindow, protocol, net, session, nativeTheme, Menu, ipcMain } from 'electron';
import { join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { EngineClient } from './engine-client.ts';
import { Store } from './store.ts';
import { registerIpc } from './ipc.ts';
import { loadSettings } from './settings.ts';
import { resourcePaths } from './paths.ts';
import { decodeWav } from '../engine/wav.ts';
import { buildExport } from './exporter.ts';
import { initUpdater, updateConfigSummary } from './updater.ts';

declare const __APP_VERSION__: string;

const selfTestIdx = process.argv.indexOf('--self-test');
const SELF_TEST = selfTestIdx >= 0;
const SELF_TEST_OUT = SELF_TEST ? process.argv[selfTestIdx + 1] : '';
const SELF_TEST_SHOTS = process.env.PHONICA_SHOTS_DIR ?? '';

if (!SELF_TEST && !app.requestSingleInstanceLock()) app.quit();
process.env.ORT_DISABLE_TELEMETRY = '1';

protocol.registerSchemesAsPrivileged([{ scheme: 'phonica', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

let win: BrowserWindow | null = null;
let store: Store | null = null;
let storeDir = '';
const engine = new EngineClient(typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : app.getVersion());

function getStore(): Store {
  const dir = loadSettings().dataDir;
  if (!store || storeDir !== dir) {
    store = new Store(dir);
    storeDir = dir;
  }
  return store;
}

function themeColors() {
  const dark = nativeTheme.shouldUseDarkColors;
  return { bg: dark ? '#14161c' : '#f5f6f8', symbol: dark ? '#e6e8ee' : '#1d2230' };
}

function createWindow() {
  const c = themeColors();
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    title: '声准 Phonica',
    backgroundColor: c.bg,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: '#00000000', symbolColor: c.symbol, height: 40 },
    ...(process.platform === 'win32' ? { backgroundMaterial: 'mica' as const } : {}),
    icon: join(resourcePaths().lexicon, '..', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: !SELF_TEST,
    },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => {
    if (SELF_TEST) win?.showInactive();
    else win?.show();
  });
  win.on('closed', () => (win = null));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win?.webContents.toggleDevTools();
    });
  }
  win.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
}

function registerProtocol() {
  protocol.handle('phonica', async (req) => {
    const u = new URL(req.url);
    let file = '';
    const s = getStore();
    if (u.host === 'record') {
      const [, id, name] = u.pathname.split('/');
      if (name === 'recording.wav') file = s.audioPath(id);
    } else if (u.host === 'tts') {
      const name = u.pathname.slice(1);
      if (/^[0-9a-f]{20}\.wav$/.test(name)) file = join(s.dir, 'cache', 'tts', name);
    }
    file = normalize(file);
    if (!file || !existsSync(file)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

ipcMain.on('theme:changed', (_e, mode: 'light' | 'dark' | 'system') => {
  nativeTheme.themeSource = mode;
  if (win && process.platform !== 'darwin') {
    const c = themeColors();
    try {
      win.setTitleBarOverlay({ color: '#00000000', symbolColor: c.symbol, height: 40 });
    } catch {
      /* not supported */
    }
  }
});

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(async () => {
  nativeTheme.themeSource = loadSettings().theme;
  registerProtocol();
  // microphone and clipboard-write for our own pages only; everything else is denied
  const allowed = new Set(['media', 'clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(allowed.has(permission) && wc.getURL().startsWith('file://')));
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => allowed.has(permission) && ((origin ?? wc?.getURL() ?? '').startsWith('file://')));
  registerIpc({ engine, store: getStore, win: () => win });
  initUpdater({ win: () => win, enabled: () => loadSettings().autoUpdate !== false, selfTest: SELF_TEST });
  engine.onStatus = (s) => win?.webContents.send('engine:status', s);
  if (SELF_TEST) {
    await runSelfTest();
    return;
  }
  createWindow();
  engine.start().catch(() => undefined);
});

app.on('window-all-closed', () => {
  engine.stop();
  app.quit();
});

/** Headless end-to-end check of the packaged app (models, espeak, TTS, export, UI). */
async function runSelfTest() {
  const out: Record<string, unknown> = { version: app.getVersion(), platform: process.platform, arch: process.arch, started: new Date().toISOString() };
  let ok = true;
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      out[name] = { ok: true, ms: 0, ...((await fn()) as object) };
    } catch (e) {
      ok = false;
      out[name] = { ok: false, error: (e as Error).stack ?? String(e) };
    }
    (out[name] as any).ms = Date.now() - t0;
  };
  const tmp = join(app.getPath('temp'), `phonica-selftest-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  store = new Store(tmp);
  storeDir = loadSettings().dataDir;
  await step('engine', async () => ({ info: await engine.start() }));
  await step('updater', async () => updateConfigSummary());
  const sample = join(resourcePaths().lexicon, '..', 'selftest', 'think.wav');
  let result: any = null;
  await step('assess', async () => {
    const w = decodeWav(readFileSync(sample));
    result = await engine.request('assess', { text: 'I think the weather is very nice today.', accent: 'us', mode: 'sentence', samples: w.samples, sampleRate: w.sampleRate });
    store!.save(result, w.samples, w.sampleRate);
    return { scores: result.scores, words: result.words.map((x: any) => `${x.text}:${x.score}`).join(' '), analysisMs: result.engine.analysisMs, issues: result.issues.map((i: any) => i.title) };
  });
  await step('mispronounced', async () => {
    const w = decodeWav(readFileSync(join(resourcePaths().lexicon, '..', 'selftest', 'sink.wav')));
    const r: any = await engine.request('assess', { text: 'I think the weather is very nice today.', accent: 'us', mode: 'sentence', samples: w.samples, sampleRate: w.sampleRate });
    store!.save(r, w.samples, w.sampleRate);
    const think = r.words.find((x: any) => x.spoken === 'think');
    const very = r.words.find((x: any) => x.spoken === 'very');
    if (very?.phones[0]?.error?.heard !== 'W') throw new Error(`/v/→/w/ in "very" not reported: ${JSON.stringify(very?.phones[0])}`);
    return { thinkScore: think?.score, thPhone: think?.phones[0], veryScore: very?.score, vPhone: very?.phones[0], scores: r.scores };
  });
  await step('tts', async () => {
    const r: any = await engine.request('tts', { text: 'Hello, how are you today?', voice: 'bf_emma', speed: 1, align: true });
    if (!(r.samples.length > 24000 * 0.5)) throw new Error('TTS produced too little audio');
    return { seconds: r.samples.length / r.sampleRate, words: r.words.length };
  });
  await step('export', async () => {
    if (!result) throw new Error('no result');
    const w = decodeWav(readFileSync(sample));
    const zip = buildExport(result, w.samples, w.sampleRate, { kind: 'zip', bitrate: 64, sampleRate: 24000, includeReference: false });
    const audio = buildExport(result, w.samples, w.sampleRate, { kind: 'audio', bitrate: 64, sampleRate: 24000, includeReference: false });
    writeFileSync(join(tmp, zip.files[0].name), zip.files[0].data);
    return { zipBytes: zip.files[0].data.length, mp3Bytes: audio.files[0].data.length, mp3: audio.audio };
  });
  await step('ui', async () => {
    createWindow();
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('renderer did not become ready')), 60000);
      ipcMain.once('renderer:ready', () => {
        clearTimeout(t);
        resolve();
      });
    });
    const shots: string[] = [];
    const snap = async (name: string, route: Record<string, unknown> | null, wait = 1500) => {
      if (route) win!.webContents.send('app:navigate', route);
      await new Promise((r) => setTimeout(r, wait));
      const img = await win!.webContents.capturePage();
      const png = join(SELF_TEST_SHOTS || tmp, `ui-${name}.png`);
      writeFileSync(png, img.toPNG());
      shots.push(png);
    };
    await snap('practice', null);
    if (result) {
      await snap('result', { page: 'history', recordId: result.id }, 3000);
      await win!.webContents.executeJavaScript(`(() => { const b = [...document.querySelectorAll('.annot .w')].find((x) => x.textContent.startsWith('think')); b && b.click(); })()`);
      await snap('word', null, 1500);
      await win!.webContents.executeJavaScript(`document.querySelector('.drawer .btn.ghost.icon.sm:last-child')?.click()`);
    }
    await snap('history', { page: 'history' });
    await snap('weak', { page: 'weak' });
    await snap('materials', { page: 'materials' });
    await snap('settings', { page: 'settings' });
    return { screenshots: shots };
  });
  out.ok = ok;
  out.dataDir = tmp;
  const text = JSON.stringify(out, null, 1);
  if (SELF_TEST_OUT) writeFileSync(SELF_TEST_OUT, text);
  console.log(text);
  engine.stop();
  app.exit(ok ? 0 : 1);
}
