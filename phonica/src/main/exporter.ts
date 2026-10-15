// Export: compressed MP3, Markdown report, structured JSON, analysis prompt,
// all optionally packed into one ZIP. Works without any AI service.
import { Mp3Encoder } from '@breezystack/lamejs';
import { zipSync, strToU8 } from 'fflate';
import { resample } from '../engine/wav.ts';
import { textReport, analysisPrompt, SCHEMA_NOTES } from '../shared/report.ts';
import type { AssessmentResult, ExportOptions } from '../shared/types.ts';

export const MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

/** Bit-rates valid for a given MP3 sample rate (MPEG-1 ≥ 32 kHz, MPEG-2/2.5 below). */
export function validBitrate(sampleRate: number, kbps: number): number {
  const allowed = sampleRate >= 32000 ? [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  return allowed.reduce((b, v) => (Math.abs(v - kbps) < Math.abs(b - kbps) ? v : b), allowed[0]);
}

export function encodeMp3(samples: Float32Array, sampleRate: number, kbps: number, targetRate: number): { data: Uint8Array; sampleRate: number; kbps: number } {
  const sr = MP3_RATES.includes(targetRate) ? targetRate : 24000;
  const x = sampleRate === sr ? samples : resample(samples, sampleRate, sr);
  const br = validBitrate(sr, kbps);
  const enc = new Mp3Encoder(1, sr, br);
  const pcm = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const v = Math.max(-1, Math.min(1, x[i]));
    pcm[i] = v < 0 ? v * 32768 : v * 32767;
  }
  const parts: Uint8Array[] = [];
  const block = 1152 * 8;
  for (let i = 0; i < pcm.length; i += block) {
    const b = enc.encodeBuffer(pcm.subarray(i, i + block));
    if (b.length) parts.push(new Uint8Array(b));
  }
  const tail = enc.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return { data: out, sampleRate: sr, kbps: br };
}

export function estimateMp3Bytes(durationSec: number, kbps: number, sampleRate: number): number {
  return Math.round((validBitrate(sampleRate, kbps) * 1000 * durationSec) / 8 + 1200);
}

export interface ExportFile {
  name: string;
  data: Uint8Array;
}

export function buildExport(
  result: AssessmentResult,
  samples: Float32Array,
  sampleRate: number,
  opts: ExportOptions,
  reference?: { samples: Float32Array; sampleRate: number; voice: string } | null,
): { files: ExportFile[]; audio: { bytes: number; kbps: number; sampleRate: number } | null } {
  const base = `phonica-${result.createdAt.slice(0, 19).replace(/[:T]/g, '-')}`;
  const files: ExportFile[] = [];
  let audioInfo: { bytes: number; kbps: number; sampleRate: number } | null = null;
  const wantAudio = opts.kind === 'zip' || opts.kind === 'audio';
  if (wantAudio) {
    const mp3 = encodeMp3(samples, sampleRate, opts.bitrate, opts.sampleRate);
    files.push({ name: opts.kind === 'zip' ? 'recording.mp3' : `${base}.mp3`, data: mp3.data });
    audioInfo = { bytes: mp3.data.length, kbps: mp3.kbps, sampleRate: mp3.sampleRate };
  }
  const audioName = opts.kind === 'zip' ? 'recording.mp3' : undefined;
  const audioMeta = audioInfo ? { file: audioName ?? `${base}.mp3`, codec: 'MP3 (MPEG audio layer III, CBR, mono)', bitrate: audioInfo.kbps, sampleRate: audioInfo.sampleRate, bytes: audioInfo.bytes } : undefined;
  if (opts.kind === 'zip' || opts.kind === 'report') {
    files.push({ name: opts.kind === 'zip' ? 'report.md' : `${base}-report.md`, data: strToU8(textReport(result, audioMeta)) });
  }
  if (opts.kind === 'zip' || opts.kind === 'json') {
    const json = {
      schema: result.schema,
      exported_at: new Date().toISOString(),
      schema_notes: SCHEMA_NOTES,
      audio: audioMeta ?? null,
      original_recording: { sampleRate, durationSec: result.audio.durationSec, format: 'PCM 16-bit WAV (kept locally)' },
      reference_audio: reference ? { file: 'reference.mp3', voice: reference.voice, note: 'Kokoro-82M offline TTS, standard pronunciation for comparison' } : null,
      assessment: result,
    };
    files.push({ name: opts.kind === 'zip' ? 'analysis.json' : `${base}-analysis.json`, data: strToU8(JSON.stringify(json, null, 1)) });
  }
  if (opts.kind === 'zip' || opts.kind === 'prompt') {
    const prompt = analysisPrompt(result, { withAudio: opts.kind === 'zip', audioFile: audioName, language: 'zh', forExport: true });
    files.push({ name: opts.kind === 'zip' ? 'prompt.md' : `${base}-prompt.md`, data: strToU8(prompt) });
  }
  if (opts.kind === 'zip') {
    files.push({ name: 'reference.txt', data: strToU8(result.text) });
    if (reference) {
      const ref = encodeMp3(reference.samples, reference.sampleRate, Math.min(opts.bitrate, 64), Math.min(opts.sampleRate, 24000));
      files.push({ name: 'reference.mp3', data: ref.data });
    }
    files.push({
      name: 'README.txt',
      data: strToU8(
        [
          'Phonica export package / 声准导出包',
          '',
          'recording.mp3   learner recording (compressed for upload) / 学习者录音（压缩）',
          'reference.txt   reference text / 朗读原文',
          'report.md       readable report with all measurements / 可读报告（含全部指标）',
          'analysis.json   complete structured assessment data / 完整结构化评测数据',
          'prompt.md       ready-to-use prompt for ChatGPT, Claude, Gemini ... / 可直接使用的分析提示词',
          reference ? 'reference.mp3   standard pronunciation (TTS) / 标准发音（合成）' : '',
          '',
          'Upload the files (or the whole ZIP) to an AI assistant and paste prompt.md.',
          '将文件（或整个 ZIP）上传给 AI，并粘贴 prompt.md 的内容。',
        ].filter((l) => l !== null).join('\r\n'),
      ),
    });
    const zip = zipSync(Object.fromEntries(files.map((f) => [f.name, [f.data, { level: f.name.endsWith('.mp3') ? 0 : 6 }]])) as any);
    return { files: [{ name: `${base}.zip`, data: zip }], audio: audioInfo };
  }
  return { files, audio: audioInfo };
}
