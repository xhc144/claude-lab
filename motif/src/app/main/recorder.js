// Screen recorder (main process). The capture itself runs in the small floating control bar
// (a renderer can use getDisplayMedia / MediaRecorder); this side picks the source, samples the
// pointer, writes the streamed chunks to disk, converts them with FFmpeg into seekable files and
// turns the result into a project with one `screen` scene.
//
//   recorder.sources()        screens and windows with thumbnails
//   recorder.pickArea(id)     drag a rectangle on a display
//   recorder.start(opts)      → bar window; the bar calls recorder.session / started / chunk /
//                               pause / resume / finish / cancel
import { BrowserWindow, desktopCapturer, screen, session, globalShortcut, systemPreferences } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as store from '../../core/store/index.js';
import { findTool, probeMedia } from '../../core/store/media.js';
import { applyOps } from '../../core/ops.js';
import { normalizeDocument } from '../../core/doc.js';
import { uid } from '../../core/util/misc.js';
import { recordingScene } from '../../core/screen/index.js';
import { startPointer, pointerCapabilities } from './pointer.js';
import { allowRoot } from './protocol.js';

const STOP_KEY = 'CommandOrControl+Shift+F10';
const PAUSE_KEY = 'CommandOrControl+Shift+F9';

export function recorderApi({ getWindow, send, preload }) {
  const sources = new Map();
  let S = null; // current session

  const barSend = (payload) => { if (S?.bar && !S.bar.isDestroyed()) S.bar.webContents.send('motif:event', 'recorder-bar', payload); };
  const status = (payload) => send('recorder', payload);

  function cleanupSession({ keepFiles = false } = {}) {
    if (!S) return;
    try { globalShortcut.unregister(STOP_KEY); globalShortcut.unregister(PAUSE_KEY); } catch { /* ignore */ }
    try { S.pointer?.stop(); } catch { /* ignore */ }
    for (const w of Object.values(S.files)) { try { w.stream.end(); } catch { /* ignore */ } }
    if (S.bar && !S.bar.isDestroyed()) S.bar.destroy();
    try { session.defaultSession.setDisplayMediaRequestHandler(null); } catch { /* ignore */ }
    const win = getWindow();
    if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
    if (!keepFiles) { try { fs.rmSync(S.dir, { recursive: true, force: true }); } catch { /* ignore */ } }
    S = null;
  }

  function sourceInfo(src) {
    const kind = src.id.startsWith('screen:') ? 'screen' : 'window';
    const display = kind === 'screen' ? (screen.getAllDisplays().find((d) => String(d.id) === String(src.display_id)) || null) : null;
    return {
      id: src.id, name: src.name, kind,
      thumb: src.thumbnail && !src.thumbnail.isEmpty() ? src.thumbnail.toDataURL() : null,
      icon: src.appIcon && !src.appIcon.isEmpty() ? src.appIcon.toDataURL() : null,
      display: display ? { id: display.id, bounds: display.bounds, scaleFactor: display.scaleFactor, primary: display.id === screen.getPrimaryDisplay().id } : null,
    };
  }

  function writeFile(kind) {
    if (!S.files[kind]) {
      const ext = kind === 'pointer' ? 'json' : 'webm';
      const file = path.join(S.dir, `${kind}.${ext}`);
      S.files[kind] = { file, stream: fs.createWriteStream(file), bytes: 0 };
    }
    return S.files[kind];
  }

  function ffmpeg(args, { duration, onProgress } = {}) {
    const ff = findTool('ffmpeg', store.readConfig());
    if (!ff) throw Object.assign(new Error('找不到 FFmpeg，无法处理录像'), { hint: '在设置中指定 ffmpeg 路径' });
    return new Promise((resolve, reject) => {
      const p = spawn(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-stats', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => {
        const s = d.toString();
        err = (err + s).slice(-6000);
        const m = /time=(\d+):(\d+):([\d.]+)/.exec(s);
        if (m && duration && onProgress) onProgress(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / duration));
      });
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg 处理录像失败（${code}）：${err.split('\n').filter(Boolean).slice(-3).join(' ')}`))));
    });
  }

  /** Convert the raw recordings into seekable files, then build or extend the project. */
  async function finalize(sess, info) {
    const dir = sess.dir;
    const out = {};
    const active = info.duration || 0;
    const steps = ['screen', 'camera', 'mic', 'system'].filter((k) => sess.files[k]?.bytes > 0);
    let done = 0;
    const prog = (k) => (p) => status({ id: sess.id, status: 'processing', step: k, progress: (done + p) / Math.max(1, steps.length) });
    const t0 = sess.starts.screen;
    if (!t0 || !sess.files.screen?.bytes) throw new Error('没有录到画面');
    const fps = Math.max(10, Math.min(60, Number(info.fps) || sess.opts.fps || 30));

    // screen → H.264 MP4, constant frame rate, a keyframe every half second (fast exact seeks)
    {
      const src = sess.files.screen.file;
      const meta = await probeMedia(src, 'video');
      const vf = [];
      const a = sess.opts.area;
      const disp = sess.display;
      if (a && disp && meta.width && meta.height) {
        const kx = meta.width / disp.bounds.width, ky = meta.height / disp.bounds.height;
        const even = (v) => Math.max(2, Math.floor(v / 2) * 2);
        vf.push(`crop=${even(a.w * kx)}:${even(a.h * ky)}:${Math.round(a.x * kx)}:${Math.round(a.y * ky)}`);
      }
      vf.push(`fps=${fps}`, 'scale=trunc(iw/2)*2:trunc(ih/2)*2', 'format=yuv420p');
      out.screen = path.join(dir, 'screen.mp4');
      await ffmpeg(['-i', src, '-vf', vf.join(','), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-g', String(Math.round(fps / 2)), '-bf', '0', '-movflags', '+faststart', out.screen], { duration: active, onProgress: prog('screen') });
      done++;
    }
    if (sess.files.camera?.bytes) {
      out.camera = path.join(dir, 'camera.mp4');
      await ffmpeg(['-i', sess.files.camera.file, '-an', '-vf', `fps=30,scale=-2:'min(720,ih)',format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-g', '15', '-bf', '0', '-movflags', '+faststart', out.camera], { duration: active, onProgress: prog('camera') });
      done++;
    }
    for (const k of ['mic', 'system']) {
      if (!sess.files[k]?.bytes) continue;
      out[k] = path.join(dir, `${k}.m4a`);
      // align with the picture: a track that started after the screen is delayed, one that
      // started before it is trimmed
      const off = sess.starts[k] ? (sess.starts[k] - t0) / 1000 : 0;
      const pre = off < 0 ? ['-ss', (-off).toFixed(3)] : [];
      const af = off > 0.005 ? ['-af', `adelay=${Math.round(off * 1000)}:all=1`] : [];
      await ffmpeg([...pre, '-i', sess.files[k].file, '-vn', ...af, '-c:a', 'aac', '-b:a', '192k', out[k]], { duration: active, onProgress: prog(k) });
      done++;
    }
    const smeta = await probeMedia(out.screen, 'video');
    const duration = smeta.duration || active;
    const track = sess.track;
    if (track) fs.writeFileSync(path.join(dir, 'pointer.json'), JSON.stringify(track));

    // into the project
    const stamp = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const label = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;
    let projDir, doc;
    if (sess.opts.projectId) ({ dir: projDir, doc } = store.loadProject(sess.opts.projectId));
    else {
      const r = store.createProject({ title: `录屏 ${label}`, author: 'human' });
      projDir = r.dir; doc = r.doc;
      doc.scenes = [];
      doc.meta = { ...doc.meta, kind: 'recording' };
      doc.style = { ...doc.style, camera: 'none', transition: 'cut' };
      doc.format = { ...doc.format, fps: fps >= 50 ? 60 : 30 };
    }
    const key = `${stamp.getTime().toString(36)}`;
    const ids = {};
    const assets = [];
    const add = async (k, file, kind) => {
      if (!file || !fs.existsSync(file)) return;
      const rel = `assets/rec-${key}-${path.basename(file)}`;
      const dest = path.join(projDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try { fs.renameSync(file, dest); } catch { fs.copyFileSync(file, dest); fs.rmSync(file, { force: true }); }
      const meta = kind === 'data' ? {} : await probeMedia(dest, kind);
      const id = uid('ast', 6);
      ids[k] = id;
      assets.push({ id, kind, file: rel, name: `${{ screen: '录屏画面', camera: '摄像头', mic: '麦克风', system: '系统声音', pointer: '光标轨迹' }[k]} ${label}${path.extname(file)}`, size: fs.statSync(dest).size, ...meta });
    };
    await add('screen', out.screen, 'video');
    await add('camera', out.camera, 'video');
    await add('mic', out.mic, 'audio');
    await add('system', out.system, 'audio');
    if (track) await add('pointer', path.join(dir, 'pointer.json'), 'data');
    const scene = recordingScene({
      asset: ids.screen, pointer: ids.pointer, camera: ids.camera, mic: ids.mic, system: ids.system,
      width: smeta.width, height: smeta.height, duration, fps,
      cursorInVideo: info.cursorInVideo !== false,
      cameraOffset: sess.starts.camera ? Math.max(0, (sess.starts.camera - t0) / 1000) : 0,
      track, autoZoom: sess.opts.autoZoom !== false,
      name: `录屏 ${label}`,
    }, { id: uid('s', 6), blockId: uid('b', 6) });
    if (!track?.clicks && scene.blocks[0].cursor == null && info.cursorInVideo !== false) scene.blocks[0].cursor = { show: 'recorded' };
    const ops = [...assets.map((a) => ({ op: 'add_asset', asset: a })), { op: 'add_scene', scene }];
    const res = applyOps(doc, ops);
    if (!res.ok) throw new Error(res.results.filter((x) => !x.ok).map((x) => x.error).join('；') || '无法写入项目');
    const saved = store.saveProject(projDir, normalizeDocument(res.doc).doc, { message: '录屏', author: 'human' });
    allowRoot(projDir);
    return { projectId: saved.id, sceneId: scene.id, duration };
  }

  return {
    'recorder.capabilities': () => ({
      platform: process.platform,
      pointer: pointerCapabilities(),
      systemAudio: process.platform === 'win32',
      ffmpeg: !!findTool('ffmpeg', store.readConfig()),
      screenAccess: process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
      shortcuts: { stop: STOP_KEY, pause: PAUSE_KEY },
      busy: !!S,
    }),
    'recorder.sources': async () => {
      const list = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 400, height: 250 }, fetchWindowIcons: true });
      const own = new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId?.()).filter(Boolean));
      sources.clear();
      const out = [];
      for (const s of list) {
        if (own.has(s.id) || /^Motif( Recorder)?$/.test(s.name)) continue;
        sources.set(s.id, s);
        out.push(sourceInfo(s));
      }
      return out;
    },
    'recorder.pickArea': (displayId) => new Promise((resolve) => {
      const d = screen.getAllDisplays().find((x) => String(x.id) === String(displayId)) || screen.getPrimaryDisplay();
      const w = new BrowserWindow({
        x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
        frame: false, transparent: true, resizable: false, movable: false, alwaysOnTop: true, skipTaskbar: true, fullscreenable: false, hasShadow: false,
        enableLargerThanScreen: true, show: false, backgroundColor: '#00000000',
        webPreferences: { preload, contextIsolation: true, sandbox: false },
      });
      w.setAlwaysOnTop(true, 'screen-saver');
      let result = null;
      const done = (r) => { result = r; if (!w.isDestroyed()) w.close(); };
      w.on('closed', () => { pickResolve = null; resolve(result); });
      pickResolve = done;
      w.loadURL(`motif://app/recorder.html#area`);
      w.once('ready-to-show', () => { w.show(); w.focus(); });
    }),
    'recorder.areaDone': (rect) => { pickResolve?.(rect && rect.w > 8 && rect.h > 8 ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) } : null); return true; },

    'recorder.start': async (opts = {}) => {
      if (S) throw new Error('已经在录制中');
      let src = sources.get(opts.sourceId);
      if (!src) {
        const list = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1, height: 1 } });
        src = list.find((s) => s.id === opts.sourceId) || (opts.sourceId ? null : list.find((s) => s.id.startsWith('screen:')));
      }
      // Automated tests (no desktop capture in a virtual display): record the editor window itself.
      const testFrame = process.env.MOTIF_RECORDER_TEST === '1' && opts.sourceId === 'test:frame' ? getWindow()?.webContents.mainFrame : null;
      if (testFrame) src = { id: 'test:frame', name: 'Motif 测试画面', display_id: String(screen.getPrimaryDisplay().id), thumbnail: null, appIcon: null };
      if (!src) throw Object.assign(new Error('找不到要录制的屏幕或窗口'), { hint: '刷新列表后重新选择' });
      const info = testFrame ? { ...sourceInfo({ ...src, id: 'screen:test' }), id: src.id } : sourceInfo(src);
      const root = path.join(store.libraryRoot(), '.recordings');
      const id = uid('rec', 6);
      const dir = path.join(root, id);
      fs.mkdirSync(dir, { recursive: true });
      const display = (info.display && screen.getAllDisplays().find((d) => d.id === info.display.id)) || screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      S = { id, dir, opts: { fps: 30, countdown: 3, autoZoom: true, ...opts, sourceId: src.id }, source: info, display: info.kind === 'screen' ? display : null, files: {}, starts: {}, status: 'starting', bar: null, pointer: null, track: null };
      try {
        const wantSystem = !!opts.system && process.platform === 'win32';
        session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
          const video = testFrame || src;
          cb(wantSystem ? { video, audio: 'loopback' } : { video });
        });
        // pointer sampling starts now; times count from the moment the picture starts recording
        const hwnd = info.kind === 'window' ? (/^window:(\d+):/.exec(src.id) || [])[1] : null;
        S.pointer = startPointer(info.kind === 'screen' ? { kind: 'screen', displayId: display.id, area: opts.area || null } : { kind: 'window', hwnd });
        // floating control bar, excluded from the capture
        const wa = (info.kind === 'screen' ? display : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())).workArea;
        const W = 360, H = 64;
        const bar = new BrowserWindow({
          width: W, height: H, x: Math.round(wa.x + (wa.width - W) / 2), y: Math.round(wa.y + wa.height - H - 24),
          frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: false,
          hasShadow: false, show: false, title: 'Motif Recorder', backgroundColor: '#00000000',
          webPreferences: { preload, contextIsolation: true, sandbox: false, backgroundThrottling: false },
        });
        bar.setAlwaysOnTop(true, 'screen-saver');
        bar.setContentProtection(true);
        bar.setVisibleOnAllWorkspaces?.(true);
        S.bar = bar;
        bar.on('closed', () => { if (S && S.bar === bar && S.status !== 'finishing') { const sid = S.id; cleanupSession(); status({ id: sid, status: 'cancelled' }); } });
        bar.loadURL(`motif://app/recorder.html#bar`);
        bar.once('ready-to-show', () => bar.showInactive());
        try {
          globalShortcut.register(STOP_KEY, () => barSend({ type: 'stop' }));
          globalShortcut.register(PAUSE_KEY, () => barSend({ type: 'toggle-pause' }));
        } catch { /* taken by another app */ }
        const win = getWindow();
        if (win && !opts.keepWindow) win.minimize();
        status({ id, status: 'starting' });
      } catch (e) {
        cleanupSession();
        throw e;
      }
      return { id, source: info };
    },
    'recorder.session': () => (S ? { id: S.id, opts: S.opts, source: S.source, shortcuts: { stop: STOP_KEY, pause: PAUSE_KEY }, platform: process.platform } : null),
    'recorder.started': (kind, epochMs) => {
      if (!S) return false;
      S.starts[kind] = epochMs;
      if (kind === 'screen') { S.pointer.setStart(epochMs); S.status = 'recording'; status({ id: S.id, status: 'recording' }); }
      return true;
    },
    'recorder.chunk': (kind, buf) => {
      if (!S || !buf) return false;
      const w = writeFile(kind);
      const b = Buffer.from(buf);
      w.bytes += b.length;
      w.stream.write(b);
      return true;
    },
    'recorder.pause': () => { S?.pointer?.pause(); if (S) { S.status = 'paused'; status({ id: S.id, status: 'paused' }); } return true; },
    'recorder.resume': () => { S?.pointer?.resume(); if (S) { S.status = 'recording'; status({ id: S.id, status: 'recording' }); } return true; },
    'recorder.stop': () => { barSend({ type: 'stop' }); return true; },
    'recorder.fail': (message) => { const sid = S?.id; cleanupSession(); status({ id: sid, status: 'error', error: message || '录制失败' }); return true; },
    'recorder.cancel': () => { const sid = S?.id; cleanupSession(); status({ id: sid, status: 'cancelled' }); return true; },
    'recorder.finish': async (info = {}) => {
      if (!S) throw new Error('没有正在进行的录制');
      const sess = S;
      sess.status = 'finishing';
      sess.track = sess.pointer.stop();
      sess.pointer = null;
      await Promise.all(Object.values(sess.files).map((w) => new Promise((r) => w.stream.end(r))));
      cleanupSession({ keepFiles: true });
      status({ id: sess.id, status: 'processing', progress: 0 });
      try {
        const r = await finalize(sess, info);
        fs.rmSync(sess.dir, { recursive: true, force: true });
        status({ id: sess.id, status: 'done', ...r });
        return r;
      } catch (e) {
        status({ id: sess.id, status: 'error', error: e.message, hint: e.hint, dir: sess.dir });
        throw e;
      }
    },
    /** Use an existing video file as a recording (no pointer track: zooms are added by hand). */
    'recorder.importVideo': async (file, o = {}) => {
      if (!file || !fs.existsSync(file)) throw new Error('文件不存在');
      const meta = await probeMedia(file, 'video');
      if (!meta.width) throw new Error('无法读取这个视频');
      let projDir, doc;
      if (o.projectId) ({ dir: projDir, doc } = store.loadProject(o.projectId));
      else {
        const r = store.createProject({ title: path.basename(file).replace(/\.[^.]+$/, ''), author: 'human' });
        projDir = r.dir; doc = r.doc; doc.scenes = []; doc.meta = { ...doc.meta, kind: 'recording' };
        doc.style = { ...doc.style, camera: 'none', transition: 'cut' };
      }
      const asset = await store.importAsset(projDir, file, { author: 'human' });
      ({ doc } = store.loadProject(projDir));
      if (!o.projectId) { doc.scenes = []; doc.meta = { ...doc.meta, kind: 'recording' }; doc.style = { ...doc.style, camera: 'none', transition: 'cut' }; }
      const scene = recordingScene({ asset: asset.id, width: meta.width, height: meta.height, duration: meta.duration || 5, fps: 30, cursorInVideo: true, name: asset.name }, { id: uid('s', 6), blockId: uid('b', 6) });
      scene.blocks[0].cursor = { show: 'recorded' };
      const res = applyOps(doc, [{ op: 'add_scene', scene }]);
      if (!res.ok) throw new Error(res.results.filter((x) => !x.ok).map((x) => x.error).join('；') || '无法写入项目');
      const saved = store.saveProject(projDir, normalizeDocument(res.doc).doc, { message: '导入录像', author: 'human' });
      return { projectId: saved.id, sceneId: scene.id };
    },
  };
}

let pickResolve = null;
