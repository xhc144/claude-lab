// Feature vectors and the calibrated regressors that turn acoustic evidence into
// scores on the speechocean762 human-rating scales (phone 0–2, word and
// sentence 0–10). The same code computes features for training
// (tools/features-so762.ts) and at run time, so the published accuracy figures
// describe exactly what the app does.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PHONE_LIST, PHONES, isVowel, stripStress } from './phones.ts';
import type { PhoneEvidence } from './gop.ts';
import type { FluencyStats } from './fluency.ts';
import type { ProsodyStats } from './prosody.ts';

export interface PhoneCtx {
  arpa: string;
  ev: PhoneEvidence;
  durSec: number;
  prevLpr: number | null;
  nextLpr: number | null;
  wordMeanLpr: number;
  wordMinLpr: number;
  /** speaking-rate factor (articulation rate / 4.0 syll/s), used to normalise durations */
  rateFactor: number;
  /** CTC verification (alignment-free GOP over the word region) */
  ctc: { gop: number; del: number; peak: number } | null;
  wordCtcLL: number | null;
}

const clip = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const PHONE_FEATURES = [
  'lpp', 'lpr', 'lprLow', 'segPost', 'frameAcc', 'silFrac', 'margin', 'logFrames', 'logDurRatio', 'isVowel',
  'prevLpr', 'nextLpr', 'wordMeanLpr', 'wordMinLpr', 'ctcGop', 'ctcDel', 'ctcPeak', 'ctcLogPeak', 'ctcGopNeg', 'wordCtcLL',
  ...PHONE_LIST.map((p) => 'ph_' + p),
];

export function phoneFeatures(c: PhoneCtx): number[] {
  const base = stripStress(c.arpa);
  const typ = (PHONES[base]?.meanDurMs ?? 80) / 1000;
  const v = [
    clip(c.ev.lpp, -20, 0), clip(c.ev.lpr, -20, 0), clip(c.ev.lprLow, -20, 0), clip(c.ev.segPost, -20, 0), c.ev.frameAcc, c.ev.silFrac,
    clip(c.ev.margin, -15, 15), Math.log(Math.max(1, c.ev.frames)), clip(Math.log(Math.max(0.005, c.durSec) * c.rateFactor / typ), -3, 3), isVowel(base) ? 1 : 0,
    clip(c.prevLpr ?? 0, -20, 0), clip(c.nextLpr ?? 0, -20, 0), clip(c.wordMeanLpr, -20, 0), clip(c.wordMinLpr, -20, 0),
    clip(c.ctc?.gop ?? 0, -15, 8), clip(c.ctc?.del ?? 0, -15, 15), c.ctc?.peak ?? 0, Math.log((c.ctc?.peak ?? 0) + 1e-3), Math.min(0, clip(c.ctc?.gop ?? 0, -15, 8)), clip(c.wordCtcLL ?? 0, -10, 0),
  ];
  for (const p of PHONE_LIST) v.push(p === base ? 1 : 0);
  return v;
}

export interface WordCtx {
  phoneScores: number[]; // predicted 0..2
  phoneLpr: number[];
  phoneFrameAcc: number[];
  skipped: boolean;
  isFunction: boolean;
  durSec: number;
  expectedSec: number;
}

export const WORD_FEATURES = ['meanPhone', 'minPhone', 'min2Phone', 'fracBad', 'fracWeak', 'nPhones', 'meanLpr', 'minLpr', 'meanFrameAcc', 'skipped', 'isFunction', 'logDurRatio'];

export function wordFeatures(c: WordCtx): number[] {
  const n = c.phoneScores.length;
  const s = [...c.phoneScores].sort((a, b) => a - b);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return [
    mean(c.phoneScores), s[0] ?? 0, s[1] ?? s[0] ?? 0,
    n ? c.phoneScores.filter((x) => x < 1).length / n : 0,
    n ? c.phoneScores.filter((x) => x < 1.6).length / n : 0,
    Math.log(Math.max(1, n)), clip(mean(c.phoneLpr), -20, 0), clip(Math.min(0, ...c.phoneLpr), -20, 0), mean(c.phoneFrameAcc),
    c.skipped ? 1 : 0, c.isFunction ? 1 : 0, clip(Math.log(Math.max(0.02, c.durSec) / Math.max(0.05, c.expectedSec)), -3, 3),
  ];
}

export interface SentenceCtx {
  phoneScores: number[];
  wordScores: number[];
  phoneLpr: number[];
  skippedFrac: number;
  wordCount: number;
  recognizedRatio: number; // recognised phones / canonical phones
  fluency: FluencyStats;
  prosody: ProsodyStats;
  leadSilence: number;
}

export const SENTENCE_FEATURES = [
  'meanPhone', 'meanWord', 'minWord', 'fracBadWords', 'fracBadPhones', 'meanLpr', 'skippedFrac', 'logWords', 'recognizedRatio',
  'syllPerSec', 'articRate', 'pausesPerWord', 'disfluentPerWord', 'pauseRatio', 'fillerRatio', 'longestPause', 'mlr', 'leadSilence',
  'pitchRange', 'pitchSd', 'voicedRatio', 'nPVI', 'contentFunction', 'stressAcc', 'intonationOk',
];

export function sentenceFeatures(c: SentenceCtx): number[] {
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const f = c.fluency;
  const p = c.prosody;
  const w = Math.max(1, c.wordCount);
  const into = p.intonation.length ? p.intonation.filter((i) => i.ok).length / p.intonation.length : 1;
  return [
    mean(c.phoneScores), mean(c.wordScores), c.wordScores.length ? Math.min(...c.wordScores) : 0,
    c.wordScores.length ? c.wordScores.filter((x) => x < 6).length / c.wordScores.length : 0,
    c.phoneScores.length ? c.phoneScores.filter((x) => x < 1).length / c.phoneScores.length : 0,
    clip(mean(c.phoneLpr), -20, 0), c.skippedFrac, Math.log(w), clip(c.recognizedRatio, 0, 3),
    clip(f.syllablesPerSecond, 0, 10), clip(f.articulationRate, 0, 12), f.pauseCount / w, f.disfluentPauseCount / w, clip(f.pauseRatio, 0, 1),
    clip(f.fillerTime / Math.max(0.1, f.speakingTime), 0, 1), clip(f.longestPause, 0, 5), clip(f.meanLengthOfRun, 0, 40), clip(c.leadSilence, 0, 5),
    clip(p.pitchRangeSt, 0, 30), clip(p.pitchSdSt, 0, 10), p.voicedRatio, clip(p.nPVI, 0, 150) / 100, clip(p.contentFunctionDiff, -3, 3), p.stressAccuracy, into,
  ];
}

// ---------------- regressors ----------------

export interface MlpJson {
  type: 'mlp';
  features: string[];
  mean: number[];
  scale: number[];
  layers: Array<{ W: number[][]; b: number[]; act: 'relu' | 'tanh' | 'identity' }>;
  min: number;
  max: number;
  /** optional range-matching map applied to the raw output: y' = a·y + b */
  affine?: [number, number];
}

export class Mlp {
  readonly spec: MlpJson;
  constructor(spec: MlpJson) {
    this.spec = spec;
  }
  predict(x: number[]): number {
    const s = this.spec;
    let h = x.map((v, i) => (v - s.mean[i]) / (s.scale[i] || 1));
    for (const L of s.layers) {
      const out = new Array(L.b.length);
      for (let j = 0; j < L.b.length; j++) {
        let acc = L.b[j];
        const row = L.W[j];
        for (let i = 0; i < h.length; i++) acc += row[i] * h[i];
        out[j] = L.act === 'relu' ? Math.max(0, acc) : L.act === 'tanh' ? Math.tanh(acc) : acc;
      }
      h = out;
    }
    const y = s.affine ? s.affine[0] * h[0] + s.affine[1] : h[0];
    return Math.max(s.min, Math.min(s.max, y));
  }
}

export interface ScoringModels {
  phone: Mlp;
  word: Mlp;
  sentence: Record<'accuracy' | 'fluency' | 'prosody' | 'completeness' | 'total', Mlp>;
  meta: { trainedOn: string; metrics: Record<string, number>; model: string };
}

export function loadScoring(dir: string): ScoringModels | null {
  const f = join(dir, 'scoring.json');
  if (!existsSync(f)) return null;
  const j = JSON.parse(readFileSync(f, 'utf8'));
  return {
    phone: new Mlp(j.phone),
    word: new Mlp(j.word),
    sentence: {
      accuracy: new Mlp(j.sentence.accuracy),
      fluency: new Mlp(j.sentence.fluency),
      prosody: new Mlp(j.sentence.prosody),
      completeness: new Mlp(j.sentence.completeness),
      total: new Mlp(j.sentence.total),
    },
    meta: j.meta,
  };
}
