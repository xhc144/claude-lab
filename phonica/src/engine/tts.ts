// Offline neural text-to-speech (Kokoro-82M, Apache-2.0) for standard British
// and American reference pronunciations. Phonemisation follows kokoro-js:
// espeak-ng ("en-us" / "en" = British) with the same post-processing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InferenceSession as OrtSession } from 'onnxruntime-node';
import { normalizeApostrophes } from './text.ts';
import { loadPhonemizer } from './espeak.ts';

type Ort = typeof import('onnxruntime-node');
type Phonemize = (text: string, lang: string) => Promise<string[]>;

export interface VoiceInfo {
  id: string;
  name: string;
  accent: 'us' | 'uk';
  gender: 'female' | 'male';
}

export const VOICES: VoiceInfo[] = [
  { id: 'af_heart', name: 'Heart（美·女）', accent: 'us', gender: 'female' },
  { id: 'af_bella', name: 'Bella（美·女）', accent: 'us', gender: 'female' },
  { id: 'am_michael', name: 'Michael（美·男）', accent: 'us', gender: 'male' },
  { id: 'am_fenrir', name: 'Fenrir（美·男）', accent: 'us', gender: 'male' },
  { id: 'bf_emma', name: 'Emma（英·女）', accent: 'uk', gender: 'female' },
  { id: 'bf_isabella', name: 'Isabella（英·女）', accent: 'uk', gender: 'female' },
  { id: 'bm_george', name: 'George（英·男）', accent: 'uk', gender: 'male' },
  { id: 'bm_fable', name: 'Fable（英·男）', accent: 'uk', gender: 'male' },
];

export const TTS_SAMPLE_RATE = 24000;
const MAX_TOKENS = 510;
const PUNCT = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCT_RE = new RegExp(`(\\s*[${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+\\s*)+`, 'g');

export class Tts {
  private session: OrtSession | null = null;
  private vocab: Record<string, number>;
  private voices = new Map<string, Float32Array>();
  private phonemize: Phonemize | null = null;
  private ort: Ort;
  private modelPath: string;
  private dir: string;

  constructor(ort: Ort, modelPath: string, dir: string) {
    this.ort = ort;
    this.modelPath = modelPath;
    this.dir = dir;
    this.vocab = JSON.parse(readFileSync(join(dir, 'vocab.json'), 'utf8'));
  }

  async load(): Promise<void> {
    if (!this.session) this.session = await this.ort.InferenceSession.create(this.modelPath, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' });
    if (!this.phonemize) this.phonemize = await loadPhonemizer();
  }

  private voice(id: string): Float32Array {
    let v = this.voices.get(id);
    if (!v) {
      const b = readFileSync(join(this.dir, `${id}.bin`));
      v = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
      this.voices.set(id, v);
    }
    return v;
  }

  /** espeak phonemes in Kokoro's conventions. */
  async phonemes(text: string, accent: 'us' | 'uk'): Promise<string> {
    await this.load();
    const t = normalizeApostrophes(text)
      .replace(/\b(?:Mr\.)/g, 'Mister').replace(/\bMrs\./g, 'Mrs').replace(/\bMs\./g, 'Miss').replace(/\bDr\.(?= [A-Z])/g, 'Doctor')
      .replace(/(?<=\d),(?=\d)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const parts: Array<{ match: boolean; text: string }> = [];
    let last = 0;
    for (const m of t.matchAll(PUNCT_RE)) {
      if (last < (m.index ?? 0)) parts.push({ match: false, text: t.slice(last, m.index) });
      if (m[0].length) parts.push({ match: true, text: m[0] });
      last = (m.index ?? 0) + m[0].length;
    }
    if (last < t.length) parts.push({ match: false, text: t.slice(last) });
    const lang = accent === 'us' ? 'en-us' : 'en';
    const out: string[] = [];
    for (const p of parts) out.push(p.match ? p.text : (await this.phonemize!(p.text, lang)).join(' '));
    let s = out.join('')
      .replace(/ʲ/g, 'j').replace(/r/g, 'ɹ').replace(/x/g, 'k').replace(/ɬ/g, 'l')
      .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
      .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z');
    if (accent === 'us') s = s.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
    return s.trim();
  }

  /** Synthesise text. speed 0.5–2.0 (Kokoro's duration scaling, pitch preserved). */
  async synthesize(text: string, voiceId: string, speed = 1, transform?: (phonemes: string) => string): Promise<Float32Array> {
    await this.load();
    const accent = voiceId.startsWith('b') ? 'uk' : 'us';
    let ph = await this.phonemes(text, accent);
    if (transform) ph = transform(ph);
    const batches = splitPhonemes(ph);
    const chunks: Float32Array[] = [];
    const style = this.voice(voiceId);
    for (const b of batches) {
      const ids = [...b].map((c) => this.vocab[c]).filter((v) => v !== undefined);
      if (!ids.length) continue;
      const n = Math.min(ids.length, MAX_TOKENS - 2);
      const tokens = new BigInt64Array(n + 2);
      for (let i = 0; i < n; i++) tokens[i + 1] = BigInt(ids[i]);
      const s = style.subarray(n * 256, n * 256 + 256);
      const out = await this.session!.run({
        tokens: new this.ort.Tensor('int64', tokens, [1, n + 2]),
        style: new this.ort.Tensor('float32', Float32Array.from(s), [1, 256]),
        speed: new this.ort.Tensor('float32', Float32Array.from([Math.max(0.5, Math.min(2, speed))]), [1]),
      });
      chunks.push(trimSilence(out.audio.data as Float32Array));
    }
    const gap = Math.round(0.12 * TTS_SAMPLE_RATE);
    const total = chunks.reduce((s, c) => s + c.length, 0) + gap * Math.max(0, chunks.length - 1) + Math.round(0.3 * TTS_SAMPLE_RATE);
    const res = new Float32Array(total);
    let o = Math.round(0.15 * TTS_SAMPLE_RATE);
    for (const c of chunks) {
      res.set(c, o);
      o += c.length + gap;
    }
    return res;
  }
}

function splitPhonemes(ph: string): string[] {
  const parts = ph.split(/([.,!?;])/);
  const out: string[] = [];
  let cur = '';
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    if (cur.length + p.length + 1 >= MAX_TOKENS - 2) {
      if (cur) out.push(cur.trim());
      cur = p;
    } else if ('.,!?;'.includes(p)) cur += p;
    else cur += (cur ? ' ' : '') + p;
  }
  if (cur) out.push(cur.trim());
  // hard-split anything still too long at spaces
  return out.flatMap((s) => {
    if (s.length < MAX_TOKENS - 2) return [s];
    const words = s.split(' ');
    const r: string[] = [];
    let c = '';
    for (const w of words) {
      if (c.length + w.length + 1 >= MAX_TOKENS - 2) { r.push(c); c = w; } else c += (c ? ' ' : '') + w;
    }
    if (c) r.push(c);
    return r;
  });
}

/** Trim leading/trailing near-silence (keeps 40 ms margins). */
function trimSilence(x: Float32Array): Float32Array {
  const thr = 0.005;
  let a = 0;
  let b = x.length - 1;
  while (a < x.length && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  const m = Math.round(0.04 * TTS_SAMPLE_RATE);
  return x.subarray(Math.max(0, a - m), Math.min(x.length, b + m));
}
