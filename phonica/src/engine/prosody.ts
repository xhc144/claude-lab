// Prosody measures: lexical stress placement, sentence rhythm (content vs.
// function word prominence, vowel-duration variability), pitch range and
// sentence-final intonation, all computed from measured pitch, energy and
// aligned durations.
import { HOP_SEC } from './dsp.ts';
import { PHONES, isVowel, stressOf, stripStress } from './phones.ts';

export interface ProsodyPhone {
  arpa: string; // stress-marked
  start: number;
  end: number;
}

export interface ProsodyWord {
  index: number;
  skipped: boolean;
  isFunction: boolean;
  phones: ProsodyPhone[];
  start: number;
  end: number;
}

export interface SyllableProminence {
  phoneIndex: number;
  expectedStress: number; // 0,1,2 from the dictionary
  energyDb: number;
  f0St: number | null;
  durNorm: number; // duration / typical duration
  prominence: number; // z-score combination
}

export interface WordStress {
  index: number;
  syllables: SyllableProminence[];
  expectedIndex: number; // syllable index carrying primary stress
  detectedIndex: number;
  correct: boolean;
  /** 0..100 confidence-weighted stress score */
  score: number;
}

export interface IntonationCheck {
  sentence: number;
  type: string;
  expected: 'fall' | 'rise' | 'any';
  detected: 'fall' | 'rise' | 'level' | 'unknown';
  slopeSt: number; // semitone change over the final stretch
  ok: boolean;
}

export interface ProsodyStats {
  f0MedianHz: number;
  pitchRangeSt: number;
  pitchSdSt: number;
  monotone: boolean;
  voicedRatio: number;
  nPVI: number;
  contentFunctionDiff: number; // mean prominence(content) - mean prominence(function)
  stress: WordStress[];
  stressAccuracy: number; // share of multi-syllable words with correct primary stress
  intonation: IntonationCheck[];
  wordProminence: Array<{ index: number; prominence: number }>;
}

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
}

function pct(a: number[], q: number): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))];
}

function zs(a: number[]): number[] {
  if (a.length < 2) return a.map(() => 0);
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1;
  return a.map((v) => (v - m) / sd);
}

export interface StressParams {
  /** weights of the energy, pitch and duration z-scores in syllable prominence */
  energy: number;
  pitch: number;
  duration: number;
  /** another syllable must be this much more prominent before stress is called wrong */
  margin: number;
}

// chosen on speechocean762 train word stress labels (tools/stress-eval.ts): on the test set
// ~9 % of correctly stressed words are flagged and ~34 % of misplaced stress is caught
export const STRESS_PARAMS: StressParams = { energy: 0.3, pitch: 0.5, duration: 0.2, margin: 0.9 };

export function prosodyStats(
  words: ProsodyWord[],
  energyDb: Float32Array,
  f0: Float32Array,
  sentences: Array<{ index: number; type: string; firstWord: number; lastWord: number }>,
  speechStart: number,
  speechEnd: number,
  sp: StressParams = STRESS_PARAMS,
): ProsodyStats {
  const fr = (t: number) => Math.max(0, Math.min(energyDb.length - 1, Math.round(t / HOP_SEC)));
  const a0 = fr(speechStart);
  const a1 = fr(speechEnd);
  const voicedHz: number[] = [];
  for (let i = a0; i <= a1; i++) if (f0[i] > 0) voicedHz.push(f0[i]);
  const f0Med = median(voicedHz) || 150;
  const st = (hz: number) => 12 * Math.log2(hz / f0Med);
  const stVals = voicedHz.map(st);
  const pitchRangeSt = pct(stVals, 0.9) - pct(stVals, 0.1);
  const mean = stVals.reduce((x, y) => x + y, 0) / Math.max(1, stVals.length);
  const pitchSdSt = Math.sqrt(stVals.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, stVals.length));
  const voicedRatio = voicedHz.length / Math.max(1, a1 - a0 + 1);

  // ---- per-vowel measurements ----
  type V = { w: number; p: number; e: number; f: number | null; d: number; dur: number; stress: number; fn: boolean };
  const vowels: V[] = [];
  for (const w of words) {
    if (w.skipped) continue;
    w.phones.forEach((ph, pi) => {
      if (!isVowel(ph.arpa)) return;
      const s = fr(ph.start);
      const e = Math.max(s + 1, fr(ph.end));
      let en = -Infinity;
      const fs: number[] = [];
      for (let i = s; i < e; i++) {
        if (energyDb[i] > en) en = energyDb[i];
        if (f0[i] > 0) fs.push(st(f0[i]));
      }
      const dur = ph.end - ph.start;
      const typ = (PHONES[stripStress(ph.arpa)]?.meanDurMs ?? 90) / 1000;
      vowels.push({ w: w.index, p: pi, e: en, f: fs.length ? Math.max(...fs) : null, d: Math.log(Math.max(0.02, dur) / typ), dur, stress: stressOf(ph.arpa) ?? 0, fn: w.isFunction });
    });
  }
  const ze = zs(vowels.map((v) => v.e));
  const fAvail = vowels.filter((v) => v.f !== null).map((v) => v.f as number);
  const fMean = fAvail.reduce((x, y) => x + y, 0) / Math.max(1, fAvail.length);
  const zf = zs(vowels.map((v) => (v.f === null ? fMean : v.f)));
  const zd = zs(vowels.map((v) => v.d));
  const prom = vowels.map((_, i) => sp.energy * ze[i] + sp.pitch * zf[i] + sp.duration * zd[i]);

  // ---- lexical stress for multi-syllable words ----
  const stress: WordStress[] = [];
  const byWord = new Map<number, number[]>();
  vowels.forEach((v, i) => {
    const l = byWord.get(v.w);
    if (l) l.push(i); else byWord.set(v.w, [i]);
  });
  for (const [wi, idx] of byWord) {
    if (idx.length < 2) continue;
    const exp = idx.findIndex((i) => vowels[i].stress === 1);
    if (exp < 0) continue;
    let det = 0;
    for (let k = 1; k < idx.length; k++) if (prom[idx[k]] > prom[idx[det]]) det = k;
    const sorted = idx.map((i) => prom[i]).sort((a, b) => b - a);
    const gap = sorted[0] - sorted[1];
    // only call it wrong when another syllable is clearly more prominent
    const correct = det === exp || prom[idx[det]] - prom[idx[exp]] < sp.margin;
    // margin of the expected syllable over its strongest rival, squashed to 0..100
    const rival = Math.max(...idx.filter((_, k) => k !== exp).map((i) => prom[i]));
    const marg = prom[idx[exp]] - rival;
    const score = Math.round(100 / (1 + Math.exp(-2.2 * (marg + 0.15))));
    stress.push({
      index: wi,
      expectedIndex: exp,
      detectedIndex: det,
      correct: correct || (vowels[idx[det]].stress === 2 && gap < 0.5),
      score,
      syllables: idx.map((i) => ({ phoneIndex: vowels[i].p, expectedStress: vowels[i].stress, energyDb: Math.round(vowels[i].e * 10) / 10, f0St: vowels[i].f === null ? null : Math.round((vowels[i].f as number) * 10) / 10, durNorm: Math.round(Math.exp(vowels[i].d) * 100) / 100, prominence: Math.round(prom[i] * 100) / 100 })),
    });
  }
  const stressAccuracy = stress.length ? stress.filter((s) => s.correct).length / stress.length : 1;

  // ---- rhythm ----
  let pvi = 0;
  let pn = 0;
  for (let i = 1; i < vowels.length; i++) {
    const a = vowels[i - 1].dur;
    const b = vowels[i].dur;
    if (a > 0 && b > 0) { pvi += Math.abs(a - b) / ((a + b) / 2); pn++; }
  }
  const nPVI = pn ? (100 * pvi) / pn : 0;
  const wordProm = new Map<number, number>();
  vowels.forEach((v, i) => wordProm.set(v.w, Math.max(wordProm.get(v.w) ?? -Infinity, prom[i])));
  const cont: number[] = [];
  const func: number[] = [];
  for (const w of words) {
    const p = wordProm.get(w.index);
    if (p === undefined) continue;
    (w.isFunction ? func : cont).push(p);
  }
  const contentFunctionDiff = cont.length && func.length ? cont.reduce((x, y) => x + y, 0) / cont.length - func.reduce((x, y) => x + y, 0) / func.length : 0;

  // ---- sentence-final intonation ----
  const intonation: IntonationCheck[] = [];
  for (const s of sentences) {
    const expected: IntonationCheck['expected'] = s.type === 'yes-no-question' ? 'rise' : s.type === 'fragment' ? 'any' : 'fall';
    const last = [...words].reverse().find((w) => w.index >= s.firstWord && w.index <= s.lastWord && !w.skipped);
    if (!last) continue;
    // final stretch: from the last stressed vowel of the sentence (or 400 ms) to the end of speech
    let from = Math.max(last.start, last.end - 0.45);
    for (const w of words) {
      if (w.index < s.firstWord || w.index > s.lastWord || w.skipped) continue;
      for (const ph of w.phones) if (isVowel(ph.arpa) && stressOf(ph.arpa) === 1 && !w.isFunction && ph.start >= last.end - 1.2) from = Math.min(from, ph.start);
    }
    const pts: Array<[number, number]> = [];
    for (let i = fr(from); i <= fr(last.end); i++) if (f0[i] > 0) pts.push([i * HOP_SEC, st(f0[i])]);
    let detected: IntonationCheck['detected'] = 'unknown';
    let slope = 0;
    if (pts.length >= 6) {
      // robust slope: compare the means of the first and last thirds of the voiced stretch
      const k = Math.max(2, Math.floor(pts.length / 3));
      const head = pts.slice(0, k).reduce((x, p) => x + p[1], 0) / k;
      const tail = pts.slice(-k).reduce((x, p) => x + p[1], 0) / k;
      const peak = Math.max(...pts.map((p) => p[1]));
      slope = tail - head;
      // a fall can also start from a peak inside the stretch
      if (slope > -1.5 && peak - tail > 3) slope = tail - peak;
      detected = slope >= 1.5 ? 'rise' : slope <= -1.5 ? 'fall' : 'level';
    }
    const ok = expected === 'any' || detected === 'unknown' || detected === expected || (expected === 'fall' && detected === 'level' && slope < -0.5);
    intonation.push({ sentence: s.index, type: s.type, expected, detected, slopeSt: Math.round(slope * 10) / 10, ok });
  }

  return {
    f0MedianHz: Math.round(f0Med),
    pitchRangeSt: Math.round(pitchRangeSt * 10) / 10,
    pitchSdSt: Math.round(pitchSdSt * 100) / 100,
    monotone: voicedHz.length > 30 && pitchRangeSt < 3.5,
    voicedRatio,
    nPVI: Math.round(nPVI * 10) / 10,
    contentFunctionDiff: Math.round(contentFunctionDiff * 100) / 100,
    stress,
    stressAccuracy,
    intonation,
    wordProminence: [...wordProm].map(([index, prominence]) => ({ index, prominence: Math.round(prominence * 100) / 100 })),
  };
}
