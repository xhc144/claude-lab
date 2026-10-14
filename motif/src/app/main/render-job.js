// Runs a render job in a hidden window: stills, contact sheet, info/lint, video (FFmpeg),
// PNG sequence, PDF handout, HTML player. Used by the CLI worker mode and the editor's export.
import { BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { allowRoot, fileUrl } from './protocol.js';
import { buildArgs, audioTracks, parseProgress, EXPORT_FORMATS } from './ffmpeg.js';
import { findTool } from '../../core/store/media.js';
import { readConfig, libraryRoot, listUserThemes } from '../../core/store/index.js';
import { jpegsToPdf } from '../../core/pdfwriter.js';
import { normalizeDocument } from '../../core/doc.js';
import { exportHtml } from './html-export.js';

let jobSeq = 0;

/**
 * job: { type: 'info'|'stills'|'sheet'|'video'|'frames'|'pdf'|'html', doc, projectDir, out, format, fps, scale,
 *        width, times, names, range, quality, jpeg, cols, maxWidth }
 * hooks: { onProgress(p), onLog(s), preload, distDir }
 */
export async function runRenderJob(job, hooks) {
  const fmt = job.format || 'mp4';
  if (job.type === 'video' && ['mp4', 'webm', 'mov'].includes(fmt) && !job.frameRange && !job.range && (job.parallel ?? 0) !== 1) {
    const cpus = os.cpus().length;
    const k = Math.max(1, Math.min(job.parallel || Math.max(1, cpus - 1), 6));
    if (k > 1) return runParallel(job, hooks, k);
  }
  return runSingleJob(job, hooks);
}

/** Render frame ranges in parallel windows, encode segments, then concat losslessly and mux audio. */
async function runParallel(job, hooks, k) {
  const fmt = job.format || 'mp4';
  const info = await runSingleJob({ ...job, type: 'info', scale: 0.1 }, { ...hooks, onProgress: null });
  if (!info.ok) return info;
  const doc = normalizeDocument(job.doc).doc;
  const fps = job.fps || doc.format.fps || 30;
  const total = Math.max(1, Math.round(info.info.duration * fps));
  if (total < 240) return runSingleJob(job, hooks);
  const out = path.resolve(job.out);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-seg-'));
  const ext = path.extname(out) || '.mp4';
  const per = Math.ceil(total / k);
  const done = new Array(k).fill(0);
  const segs = [];
  for (let i = 0; i < k; i++) {
    const f0 = i * per, f1 = Math.min(total, f0 + per);
    if (f1 > f0) segs.push({ f0, f1, file: path.join(tmp, `seg${i}${ext}`), i });
  }
  const t0 = Date.now();
  const results = await Promise.all(segs.map((sg) => runSingleJob({ ...job, frameRange: [sg.f0, sg.f1], out: sg.file, mute: true }, {
    ...hooks,
    onProgress: (p) => { if (p.done != null) { done[sg.i] = p.done; hooks.onProgress?.({ done: done.reduce((a, b) => a + b, 0), total }); } },
  })));
  const bad = results.find((r) => !r.ok);
  if (bad) { fs.rmSync(tmp, { recursive: true, force: true }); return bad; }
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map((sg) => `file '${sg.file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const ff = job.ffmpeg || findTool('ffmpeg', readConfig());
  const projectDir = job.projectDir ? path.resolve(job.projectDir) : '.';
  const audio = job.mute ? [] : audioTracks(doc, projectDir, info.info.scenes);
  const duration = total / fps;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  audio.forEach((a) => args.push('-i', a.file));
  args.push('-map', '0:v', '-c:v', 'copy');
  if (audio.length) {
    const parts = audio.map((a, i) => {
      const f = [];
      if (a.trim) f.push(`atrim=${a.trim[0] || 0}${a.trim[1] != null ? ':' + a.trim[1] : ''}`, 'asetpts=PTS-STARTPTS');
      f.push(`volume=${a.volume ?? 1}`);
      if (a.fadeIn) f.push(`afade=t=in:st=0:d=${a.fadeIn}`);
      if (a.start) f.push(`adelay=${Math.round(a.start * 1000)}|${Math.round(a.start * 1000)}`);
      if (a.fadeOut && a.loopToEnd !== false) f.push(`afade=t=out:st=${Math.max(0, duration - a.fadeOut)}:d=${a.fadeOut}`);
      return `[${i + 1}:a]${f.join(',')}[a${i}]`;
    });
    parts.push(audio.length > 1 ? `${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0[aout]` : '[a0]anull[aout]');
    const codec = fmt === 'webm' ? ['-c:a', 'libopus', '-b:a', '160k'] : fmt === 'mov' ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'aac', '-b:a', '192k'];
    args.push('-filter_complex', parts.join(';'), '-map', '[aout]', ...codec, '-t', String(duration));
  }
  if (fmt === 'mp4') args.push('-movflags', '+faststart');
  args.push(out);
  const code = await new Promise((res) => { const p = spawn(ff, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', (d) => { e += d; }); p.on('close', (c) => { if (c) hooks.onLog?.(e); res(c); }); });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (code !== 0) return { ok: false, error: `FFmpeg 拼接失败（${code}）` };
  return { ok: true, out, frames: total, duration, bytes: fs.statSync(out).size, parallel: segs.length, seconds: (Date.now() - t0) / 1000 };
}

async function runSingleJob(job, hooks) {
  const { distDir, preload } = hooks;
  const doc = normalizeDocument(job.doc).doc;
  const projectDir = job.projectDir ? path.resolve(job.projectDir) : null;
  if (projectDir) allowRoot(projectDir);
  try { allowRoot(libraryRoot()); } catch { /* library optional */ }
  if (job.type === 'html') return exportHtml({ doc, projectDir, out: job.out, distDir, onProgress: hooks.onProgress });
  const userThemes = job.userThemes || safe(() => listUserThemes(), {});
  let scale = job.scale;
  if (!scale && job.width) scale = job.width / doc.format.width;
  if (!scale) scale = job.type === 'sheet' ? 0.5 : job.type === 'info' ? 0.25 : 1;
  const renderJob = { ...job, doc, scale, userThemes, assetBase: projectDir ? fileUrl(projectDir) + '/' : undefined };
  if (job.type === 'pdf') { renderJob.type = 'stills'; renderJob.jpeg = true; }

  const outDir = job.type === 'video' ? path.dirname(path.resolve(job.out)) : job.type === 'frames' || job.type === 'stills' ? path.resolve(job.out) : path.dirname(path.resolve(job.out || '.'));
  fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({
    show: false, width: 640, height: 400, paintWhenInitiallyHidden: true,
    webPreferences: { preload, backgroundThrottling: false, contextIsolation: true, sandbox: false, offscreen: false },
  });
  const id = ++jobSeq;
  const ipc = win.webContents.ipc;
  let ffmpeg = null, ffErr = '', ffDone = null;
  const files = [];
  const pdfPages = [];
  const result = new Promise((resolve) => {
    ipc.handle('motif:job', () => renderJob);
    ipc.on('motif:progress', (_e, p) => hooks.onProgress?.(p));
    ipc.handle('motif:file', (_e, name, buf) => {
      const data = Buffer.from(buf);
      if (job.type === 'pdf') { pdfPages.push(data); return true; }
      const file = job.type === 'sheet' ? path.resolve(job.out) : path.join(outDir, name);
      fs.writeFileSync(file, data);
      files.push(file);
      return true;
    });
    ipc.handle('motif:frame', async (_e, data) => {
      if (data && data.begin) {
        const ff = job.ffmpeg || findTool('ffmpeg', readConfig());
        if (!ff) throw new Error('找不到 FFmpeg。请在设置中指定 ffmpeg 路径，或设置环境变量 MOTIF_FFMPEG');
        const audio = job.mute ? [] : audioTracks(doc, projectDir || '.', data.scenes).map((a) => ({ ...a, start: Math.max(0, (a.start || 0) - (data.start || 0)) }));
        const args = buildArgs({ out: path.resolve(job.out), format: job.format || 'mp4', width: data.width, height: data.height, fps: data.fps, duration: data.duration, quality: job.quality, audio, gifWidth: job.gifWidth, gifFps: job.gifFps });
        hooks.onLog?.(`ffmpeg ${args.join(' ')}`);
        if (job.type === 'video' && job.encodeInRenderer !== false) return { exe: ff, args };
        ffmpeg = spawn(ff, args, { stdio: ['pipe', 'ignore', 'pipe'] });
        ffmpeg.stderr.on('data', (d) => { const s = d.toString(); ffErr += s; if (ffErr.length > 20000) ffErr = ffErr.slice(-10000); const pr = parseProgress(s); if (pr.frame) hooks.onProgress?.({ encoded: pr.frame }); });
        ffDone = new Promise((res) => ffmpeg.on('close', (code) => res(code)));
        ffmpeg.stdin.on('error', () => {});
        return true;
      }
      if (!ffmpeg) throw new Error('ffmpeg not started');
      const buf = Buffer.from(data.buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : data);
      if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
      return true;
    });
    ipc.handle('motif:done', async (_e, r) => { resolve(r); return true; });
    win.webContents.on('render-process-gone', (_e, d) => resolve({ ok: false, error: `渲染进程退出：${d.reason}` }));
    win.webContents.on('console-message', (e) => { const lvl = e.level ?? e; if (lvl === 'error' || lvl === 3) hooks.onLog?.(`[renderer] ${e.message ?? ''}`); });
  });
  await win.loadURL('motif://app/worker.html');
  let r = await result;
  if (r.ok && r.encodedInRenderer && job.out && fs.existsSync(job.out)) r = { ...r, out: path.resolve(job.out), bytes: fs.statSync(job.out).size };
  if (ffmpeg) {
    ffmpeg.stdin.end();
    const code = await ffDone;
    if (code !== 0) r = { ok: false, error: `FFmpeg 退出码 ${code}：${ffErr.split('\n').filter((l) => l && !/=/.test(l)).slice(-5).join(' ')}` };
    else r = { ...r, out: path.resolve(job.out), bytes: fs.statSync(job.out).size };
  }
  if (job.type === 'pdf' && r.ok) {
    fs.writeFileSync(job.out, jpegsToPdf(pdfPages, { title: doc.title }));
    r = { ...r, out: path.resolve(job.out), pages: pdfPages.length };
  }
  if (files.length) r.files = files;
  win.destroy();
  void id; void EXPORT_FORMATS;
  return r;
}

function safe(fn, d) { try { return fn(); } catch { return d; } }
