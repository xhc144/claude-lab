// IPC handlers: the renderer's only gateway to the engine, storage, export and AI.
import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join, extname, basename } from 'node:path';
import { EngineClient } from './engine-client.ts';
import { Store } from './store.ts';
import { loadSettings, saveSettings, publicSettings, mergeFromRenderer } from './settings.ts';
import { buildExport, estimateMp3Bytes, encodeMp3 } from './exporter.ts';
import { analyse, testProvider, providerAcceptsAudio } from './ai/index.ts';
import { decodeWav, encodeWav } from '../engine/wav.ts';
import { textReport } from '../shared/report.ts';
import { updateStatus, checkForUpdates, installNow } from './updater.ts';
import { BUILTIN_MATERIALS } from '../shared/materials.ts';
import type { AssessmentResult, ExportOptions, Settings, AiAnalysis, Material } from '../shared/types.ts';

export interface AppContext {
  engine: EngineClient;
  store: () => Store;
  win: () => BrowserWindow | null;
}

const aiControllers = new Map<string, AbortController>();

export function registerIpc(ctx: AppContext) {
  const h = (ch: string, fn: (...a: any[]) => any) =>
    ipcMain.handle(ch, async (_e, ...args) => {
      try {
        return { ok: true, value: await fn(...args) };
      } catch (e) {
        return { ok: false, error: (e as Error).message, code: (e as any).code };
      }
    });

  // ---------------- engine ----------------
  h('engine:status', () => ctx.engine.status);
  h('engine:assess', async (req: { text: string; accent: 'us' | 'uk'; mode: string; samples: Float32Array; sampleRate: number; materialId?: string }) => {
    const samples = new Float32Array(req.samples);
    const result = (await ctx.engine.request<AssessmentResult>('assess', { text: req.text, accent: req.accent, mode: req.mode, samples, sampleRate: req.sampleRate }, [], (p) => ctx.win()?.webContents.send('engine:progress', p))) as AssessmentResult;
    const entry = ctx.store().save(result, samples, req.sampleRate, req.materialId);
    return { entry, result };
  });
  h('engine:lookup', (word: string) => ctx.engine.request('lookup', { word }));
  h('engine:textIpa', (text: string, accent: 'us' | 'uk') => ctx.engine.request('textIpa', { text, accent }));
  h('engine:tts', async (text: string, voice: string, speed: number) => {
    const key = createHash('sha1').update(`${voice}|${speed}|${text}`).digest('hex').slice(0, 20);
    const dir = join(ctx.store().dir, 'cache', 'tts');
    mkdirSync(dir, { recursive: true });
    const wav = join(dir, `${key}.wav`);
    const meta = join(dir, `${key}.json`);
    if (!existsSync(wav) || !existsSync(meta)) {
      const r = await ctx.engine.request<{ samples: Float32Array; sampleRate: number; words: unknown[] }>('tts', { text, voice, speed, align: true });
      writeFileSync(wav, encodeWav(new Float32Array(r.samples), r.sampleRate, 16));
      writeFileSync(meta, JSON.stringify({ words: r.words, sampleRate: r.sampleRate, duration: r.samples.length / r.sampleRate }));
    }
    const m = JSON.parse(readFileSync(meta, 'utf8'));
    return { url: `phonica://tts/${key}.wav`, ...m };
  });

  // ---------------- records ----------------
  h('records:list', () => ctx.store().list());
  h('records:get', (id: string) => {
    const r = ctx.store().get(id);
    if (!r) throw new Error('记录不存在或已被删除');
    return { ...r, audioUrl: `phonica://record/${id}/recording.wav` };
  });
  h('records:delete', (id: string) => ctx.store().remove(id));
  h('records:favorite', (id: string, fav: boolean) => ctx.store().setFavorite(id, fav));
  h('records:stats', () => ctx.store().weakStats());
  h('records:rebuild', () => ctx.store().rebuildIndex());

  // ---------------- materials ----------------
  h('materials:list', () => [...BUILTIN_MATERIALS, ...ctx.store().listMaterials()]);
  h('materials:save', (m: Material) => ctx.store().saveMaterial({ ...m, id: m.id || randomUUID() }));
  h('materials:delete', (id: string) => ctx.store().deleteMaterial(id));
  h('materials:import', async () => {
    const win = ctx.win();
    const r = await dialog.showOpenDialog(win!, { title: '导入文章', properties: ['openFile'], filters: [{ name: '文本', extensions: ['txt', 'md', 'srt', 'vtt', 'docx'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    return importText(r.filePaths[0]);
  });

  // ---------------- export ----------------
  h('export:estimate', (id: string, o: ExportOptions) => {
    const rec = ctx.store().get(id);
    if (!rec) throw new Error('记录不存在');
    const wavBytes = existsSync(ctx.store().audioPath(id)) ? readFileSync(ctx.store().audioPath(id)).length : 0;
    return { mp3Bytes: estimateMp3Bytes(rec.result.audio.durationSec, o.bitrate, o.sampleRate), wavBytes, durationSec: rec.result.audio.durationSec };
  });
  h('export:run', async (id: string, o: ExportOptions, voice?: string) => {
    const rec = ctx.store().get(id);
    if (!rec) throw new Error('记录不存在');
    const wav = decodeWav(readFileSync(ctx.store().audioPath(id)));
    let reference = null;
    if (o.kind === 'zip' && o.includeReference && voice) {
      try {
        const r = await ctx.engine.request<{ samples: Float32Array; sampleRate: number }>('tts', { text: rec.result.text, voice, speed: 1, align: false });
        reference = { samples: new Float32Array(r.samples), sampleRate: r.sampleRate, voice };
      } catch {
        reference = null;
      }
    }
    const out = buildExport(rec.result, wav.samples, wav.sampleRate, o, reference);
    const win = ctx.win();
    if (out.files.length === 1) {
      const f = out.files[0];
      const ext = extname(f.name).slice(1);
      const r = await dialog.showSaveDialog(win!, { title: '导出', defaultPath: join(app.getPath('downloads'), f.name), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if (r.canceled || !r.filePath) return null;
      writeFileSync(r.filePath, f.data);
      return { paths: [r.filePath], bytes: f.data.length, audio: out.audio };
    }
    const r = await dialog.showOpenDialog(win!, { title: '选择导出文件夹', defaultPath: app.getPath('downloads'), properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const paths = out.files.map((f) => {
      const p = join(r.filePaths[0], f.name);
      writeFileSync(p, f.data);
      return p;
    });
    return { paths, bytes: out.files.reduce((s, f) => s + f.data.length, 0), audio: out.audio };
  });
  h('export:copyPrompt', (id: string) => {
    const rec = ctx.store().get(id);
    if (!rec) throw new Error('记录不存在');
    return textReport(rec.result);
  });
  h('shell:showItem', (p: string) => shell.showItemInFolder(p));

  // ---------------- AI ----------------
  h('ai:run', async (recordId: string, providerId: string, requestId: string) => {
    const s = loadSettings();
    const p = s.aiProviders.find((x) => x.id === providerId);
    if (!p) throw new Error('未找到该 AI 服务配置');
    const rec = ctx.store().get(recordId);
    if (!rec) throw new Error('记录不存在');
    let mp3: Uint8Array | null = null;
    if (providerAcceptsAudio(p)) {
      const wav = decodeWav(readFileSync(ctx.store().audioPath(recordId)));
      mp3 = encodeMp3(wav.samples, wav.sampleRate, s.exportBitrate, s.exportSampleRate).data;
    }
    const ac = new AbortController();
    aiControllers.set(requestId, ac);
    const created = new Date().toISOString();
    try {
      const r = await analyse(p, rec.result, mp3, s.aiLanguage, (t) => ctx.win()?.webContents.send('ai:delta', { requestId, text: t }), ac.signal);
      const a: AiAnalysis = { id: randomUUID(), createdAt: created, provider: p.name, model: r.model, withAudio: r.withAudio, content: r.content + (r.truncated ? '\n\n（输出达到长度上限被截断，可在设置中提高“最大输出长度”。）' : ''), usage: r.usage };
      ctx.store().saveAi(recordId, a);
      return a;
    } finally {
      aiControllers.delete(requestId);
    }
  });
  h('ai:cancel', (requestId: string) => aiControllers.get(requestId)?.abort());
  h('ai:test', async (providerId: string, draft?: Settings['aiProviders'][number]) => {
    const s = loadSettings();
    let p = s.aiProviders.find((x) => x.id === providerId);
    if (draft) p = mergeFromRenderer(s, { ...s, aiProviders: [draft] }).aiProviders[0];
    if (!p) throw new Error('未找到该 AI 服务配置');
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60000);
    try {
      return await testProvider(p, ac.signal);
    } finally {
      clearTimeout(t);
    }
  });
  h('ai:delete', (recordId: string, aiId: string) => ctx.store().deleteAi(recordId, aiId));

  // ---------------- settings ----------------
  h('settings:get', () => publicSettings(loadSettings()));
  h('settings:save', (s: Settings) => {
    const merged = mergeFromRenderer(loadSettings(), s);
    const saved = saveSettings(merged);
    return publicSettings(saved);
  });
  h('settings:chooseDataDir', async () => {
    const r = await dialog.showOpenDialog(ctx.win()!, { title: '选择数据文件夹', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return r.filePaths[0];
  });
  h('settings:openDataDir', () => shell.openPath(ctx.store().dir));
  h('update:status', () => updateStatus());
  h('update:check', () => checkForUpdates());
  h('update:install', () => installNow());
  h('app:info', () => ({ version: app.getVersion(), dataDir: ctx.store().dir, engine: ctx.engine.status }));
  h('shell:openExternal', (url: string) => {
    if (/^https?:\/\//.test(url)) return shell.openExternal(url);
  });
}

function importText(path: string): { title: string; text: string } {
  const ext = extname(path).toLowerCase();
  let text = '';
  if (ext === '.docx') text = docxText(readFileSync(path));
  else {
    text = readFileSync(path, 'utf8').replace(/^﻿/, '');
    if (ext === '.srt' || ext === '.vtt') {
      text = text
        .split(/\r?\n/)
        .filter((l) => l.trim() && !/^\d+$/.test(l.trim()) && !/-->/.test(l) && !/^WEBVTT/.test(l))
        .join(' ');
    }
    if (ext === '.md') text = text.replace(/^#+\s*/gm, '').replace(/[*_`>]/g, '');
  }
  text = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { title: basename(path, ext), text };
}

/** Minimal .docx text extraction (paragraphs of word/document.xml). */
function docxText(buf: Buffer): string {
  const { unzipSync, strFromU8 } = require('fflate') as typeof import('fflate');
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : '';
  return xml
    .split(/<\/w:p>/)
    .map((p) => (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))
    .map((p) => p.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
    .filter(Boolean)
    .join('\n');
}
