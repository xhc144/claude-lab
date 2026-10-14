// wav2vec2 phone posteriors via onnxruntime-node. Long recordings are processed
// in overlapping chunks and stitched so memory stays bounded.
import { readFileSync } from 'node:fs';
import type { InferenceSession as OrtSession } from 'onnxruntime-node';

export interface ModelMeta {
  model_id: string;
  revision: string | null;
  vocab: string[];
  feature_extractor: { sampling_rate: number; do_normalize: boolean };
  frames_for_3s: number;
}

export interface Posteriors {
  frames: number;
  vocab: number;
  /** log-softmax, row-major frames × vocab */
  logp: Float32Array;
  /** seconds per frame */
  hop: number;
}

type Ort = typeof import('onnxruntime-node');

export class AcousticModel {
  readonly meta: ModelMeta;
  readonly hop: number;
  readonly labels: string[];
  private session: OrtSession | null = null;

  constructor(private ort: Ort, private onnxPath: string, metaPath: string, readonly name: string) {
    this.meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    this.labels = this.meta.vocab;
    // 3 s of audio -> frames_for_3s frames (charsiu fc: 298 @ 10 ms, CTC: 149 @ 20 ms)
    this.hop = this.meta.frames_for_3s > 200 ? 0.01 : 0.02;
  }

  async load(threads = 0): Promise<void> {
    if (this.session) return;
    const opts: OrtSession.SessionOptions = {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    };
    if (threads > 0) opts.intraOpNumThreads = threads;
    this.session = await this.ort.InferenceSession.create(this.onnxPath, opts);
  }

  index(label: string): number {
    return this.labels.indexOf(label);
  }

  private async runChunk(x: Float32Array): Promise<{ frames: number; vocab: number; data: Float32Array }> {
    const t = new this.ort.Tensor('float32', x, [1, x.length]);
    const out = await this.session!.run({ input_values: t });
    const logits = out.logits;
    const [, frames, vocab] = logits.dims as number[];
    return { frames, vocab, data: logits.data as Float32Array };
  }

  /** Log posteriors for 16 kHz mono audio. */
  async posteriors(audio: Float32Array): Promise<Posteriors> {
    if (!this.session) await this.load();
    const sr = 16000;
    // global zero-mean / unit-variance normalisation (wav2vec2 feature extractor)
    let mean = 0;
    for (let i = 0; i < audio.length; i++) mean += audio[i];
    mean /= Math.max(1, audio.length);
    let v = 0;
    for (let i = 0; i < audio.length; i++) v += (audio[i] - mean) ** 2;
    const std = Math.sqrt(v / Math.max(1, audio.length) + 1e-7);
    const minLen = Math.max(audio.length, Math.round(0.2 * sr));
    const x = new Float32Array(minLen);
    for (let i = 0; i < audio.length; i++) x[i] = (audio[i] - mean) / std;

    const hopSamples = Math.round(this.hop * sr);
    const chunk = 24 * sr;
    const ctx = 2 * sr;
    let logits: Float32Array;
    let frames: number;
    let vocab: number;
    if (x.length <= chunk + 2 * ctx) {
      const r = await this.runChunk(x);
      logits = r.data;
      frames = r.frames;
      vocab = r.vocab;
    } else {
      frames = Math.floor(x.length / hopSamples);
      vocab = this.labels.length;
      logits = new Float32Array(frames * vocab);
      let filled = 0;
      for (let start = 0; start < x.length; start += chunk) {
        const a = Math.max(0, start - ctx);
        const b = Math.min(x.length, start + chunk + ctx);
        const r = await this.runChunk(x.subarray(a, b));
        vocab = r.vocab;
        const off = Math.round((start - a) / hopSamples);
        const want = Math.min(Math.round(chunk / hopSamples), frames - filled);
        for (let f = 0; f < want; f++) {
          const src = Math.min(r.frames - 1, off + f);
          logits.set(r.data.subarray(src * vocab, src * vocab + vocab), (filled + f) * vocab);
        }
        filled += want;
        if (filled >= frames) break;
      }
      frames = filled;
    }
    // log-softmax per frame
    const logp = new Float32Array(frames * vocab);
    for (let f = 0; f < frames; f++) {
      const o = f * vocab;
      let mx = -Infinity;
      for (let c = 0; c < vocab; c++) if (logits[o + c] > mx) mx = logits[o + c];
      let s = 0;
      for (let c = 0; c < vocab; c++) s += Math.exp(logits[o + c] - mx);
      const lse = mx + Math.log(s);
      for (let c = 0; c < vocab; c++) logp[o + c] = logits[o + c] - lse;
    }
    return { frames, vocab, logp, hop: this.hop };
  }
}
