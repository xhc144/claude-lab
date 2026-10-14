// Context-reduced phone verification with a multilingual CTC phoneme
// recogniser (wav2vec2-lv-60-espeak-cv-ft). Each word is cut out of the
// recording and recognised on its own, so the model cannot "hear" the expected
// phone from the surrounding sentence. For every canonical phone we compute an
// alignment-free CTC goodness of pronunciation: the log-likelihood of the
// canonical phone string versus the best string in which that phone is
// replaced by another English phone or deleted.
import type { AcousticModel, Posteriors } from './acoustic.ts';
import { isVowel, stripStress } from './phones.ts';

// espeak tokens accepted for each ARPABET phone (US and UK realisations)
const GROUP_TOKENS: Record<string, string[]> = {
  IY: ['iː', 'i'], IH: ['ɪ', 'ᵻ'], EY: ['eɪ', 'e', 'eː'], EH: ['ɛ', 'e', 'ɛː'], AE: ['æ', 'a'],
  AA: ['ɑː', 'ɑ', 'ɒ', 'aː'], AO: ['ɔː', 'ɔ', 'oː'], OW: ['oʊ', 'əʊ', 'o', 'oː'], UH: ['ʊ'], UW: ['uː', 'u', 'ʉ'],
  AH: ['ʌ', 'ə', 'ɐ'], ER: ['ɚ', 'ɜː', 'ɜ'], AY: ['aɪ'], AW: ['aʊ'], OY: ['ɔɪ', 'oɪ'],
  P: ['p'], B: ['b'], T: ['t', 'ɾ', 'ʔ'], D: ['d', 'ɾ'], K: ['k'], G: ['ɡ'], CH: ['tʃ'], JH: ['dʒ'],
  F: ['f'], V: ['v'], TH: ['θ'], DH: ['ð'], S: ['s'], Z: ['z'], SH: ['ʃ'], ZH: ['ʒ'], HH: ['h'],
  M: ['m'], N: ['n', 'n̩'], NG: ['ŋ'], L: ['l', 'ɫ'], R: ['ɹ', 'r'], W: ['w'], Y: ['j'],
};
// r-coloured vowels / syllabic l that espeak writes as one token
const MERGED: Array<{ seq: string[]; tokens: string[] }> = [
  { seq: ['AA', 'R'], tokens: ['ɑːɹ'] }, { seq: ['AO', 'R'], tokens: ['ɔːɹ', 'oːɹ'] }, { seq: ['OW', 'R'], tokens: ['oːɹ', 'ɔːɹ'] },
  { seq: ['EH', 'R'], tokens: ['ɛɹ', 'eə'] }, { seq: ['IH', 'R'], tokens: ['ɪɹ', 'ɪə', 'iə'] }, { seq: ['IY', 'R'], tokens: ['ɪɹ', 'ɪə', 'iə'] },
  { seq: ['UH', 'R'], tokens: ['ʊɹ', 'ʊə'] }, { seq: ['UW', 'R'], tokens: ['ʊɹ', 'ʊə'] }, { seq: ['AY', 'ER'], tokens: ['aɪɚ', 'aɪə'] },
  { seq: ['AH', 'L'], tokens: ['əl'] },
];
// UK schwa for unstressed ER
const ER0_EXTRA = ['ə'];

export const ARPA_GROUPS = Object.keys(GROUP_TOKENS);

interface Position {
  tokens: number[]; // vocabulary ids
  phones: number[]; // indices into the word's phone list
  group: string; // ARPA label ("AA+R" for merged)
}

export interface CtcPhoneScore {
  /** log P(canonical) - log P(best alternative) (positive = canonical wins) */
  gop: number;
  /** log P(canonical) - log P(phone deleted) */
  delMargin: number;
  /** ARPA phone (or 'DEL') of the best alternative */
  alt: string;
  /** peak posterior of the canonical tokens inside the word (0..1) */
  peak: number;
}

export interface CtcWordResult {
  phones: CtcPhoneScore[];
  /** log-likelihood per frame of the canonical string */
  llPerFrame: number;
  /** greedy recognition of the isolated word, espeak IPA */
  heardIpa: string;
}

export class CtcVerifier {
  readonly model: AcousticModel;
  private blank: number;
  private groupIds = new Map<string, number[]>();
  private mergedIds: Array<{ seq: string[]; ids: number[] }>;
  private er0Extra: number[];

  constructor(model: AcousticModel) {
    this.model = model;
    this.blank = model.index('<pad>');
    for (const [g, toks] of Object.entries(GROUP_TOKENS)) this.groupIds.set(g, toks.map((t) => model.index(t)).filter((i) => i >= 0));
    this.mergedIds = MERGED.map((m) => ({ seq: m.seq, ids: m.tokens.map((t) => model.index(t)).filter((i) => i >= 0) }));
    this.er0Extra = ER0_EXTRA.map((t) => model.index(t)).filter((i) => i >= 0);
  }

  /** Cut [start, end] (s) out of 16 kHz audio with silence padding. */
  static crop(audio: Float32Array, start: number, end: number, margin = 0.05, pad = 0.15): Float32Array {
    const a = Math.max(0, Math.floor((start - margin) * 16000));
    const b = Math.min(audio.length, Math.ceil((end + margin) * 16000));
    const p = Math.round(pad * 16000);
    const out = new Float32Array(Math.max(0, b - a) + 2 * p);
    out.set(audio.subarray(a, b), p);
    // fade the edges so the cut does not create clicks
    const f = Math.min(80, (b - a) >> 2);
    for (let i = 0; i < f; i++) {
      out[p + i] *= i / f;
      out[p + (b - a) - 1 - i] *= i / f;
    }
    return out;
  }

  /** Canonical position strings for a word (variants for merged tokens). */
  private variants(phones: string[]): Position[][] {
    const base = phones.map(stripStress);
    const out: Position[][] = [];
    const build = (useMerge: boolean): Position[] => {
      const pos: Position[] = [];
      for (let i = 0; i < base.length; i++) {
        if (useMerge && i + 1 < base.length) {
          const m = this.mergedIds.find((x) => x.seq[0] === base[i] && x.seq[1] === base[i + 1]);
          const nextIsVowel = i + 2 < base.length && isVowel(base[i + 2]);
          if (m && m.ids.length && !nextIsVowel) {
            const own = this.groupIds.get(base[i]) ?? [];
            pos.push({ tokens: [...m.ids, ...own], phones: [i, i + 1], group: base[i] + '+' + base[i + 1] });
            i++;
            continue;
          }
        }
        let toks = this.groupIds.get(base[i]) ?? [];
        if (base[i] === 'ER' && phones[i].endsWith('0')) toks = [...toks, ...this.er0Extra];
        pos.push({ tokens: toks, phones: [i], group: base[i] });
      }
      return pos;
    };
    out.push(build(true));
    const plain = build(false);
    if (plain.length !== out[0].length) out.push(plain);
    return out;
  }

  /**
   * CTC log-likelihood of a position string given log posteriors (frames × vocab).
   * Frames before `lo` / from `hi` on may be absorbed by free edge states, so the
   * word can be scored inside a longer context window.
   */
  private ctcLL(logp: Float32Array, frames: number, vocab: number, seq: number[][], lo = 0, hi = frames): number {
    const L = seq.length;
    const S = 2 * L + 1;
    const em = new Float64Array(frames * Math.max(1, L));
    for (let t = 0; t < frames; t++) {
      const o = t * vocab;
      for (let k = 0; k < L; k++) {
        const ids = seq[k];
        let mx = -Infinity;
        for (const id of ids) if (logp[o + id] > mx) mx = logp[o + id];
        let s = 0;
        for (const id of ids) s += Math.exp(logp[o + id] - mx);
        em[t * L + k] = mx + Math.log(s);
      }
    }
    // states: 0 = pre-edge, 1..S = CTC states, S+1 = post-edge
    let prev = new Float64Array(S + 2).fill(-Infinity);
    let cur = new Float64Array(S + 2);
    const emit = (t: number, st: number): number => {
      if (st === 0) return t < lo ? 0 : -Infinity;
      if (st === S + 1) return t >= hi ? 0 : -Infinity;
      const s = st - 1;
      return s % 2 === 0 ? logp[t * vocab + this.blank] : em[t * L + (s - 1) / 2];
    };
    prev[0] = emit(0, 0);
    prev[1] = emit(0, 1);
    if (L > 0) prev[2] = emit(0, 2);
    for (let t = 1; t < frames; t++) {
      for (let st = 0; st < S + 2; st++) {
        let a = prev[st];
        if (st === 0) { cur[0] = a + emit(t, 0); continue; }
        if (st === S + 1) {
          a = lse(a, prev[S]);
          if (L > 0) a = lse(a, prev[S - 1]);
          cur[st] = a + emit(t, st);
          continue;
        }
        const s = st - 1;
        if (s === 0 || s === 1) a = lse(a, prev[0]);
        if (s >= 1) a = lse(a, prev[st - 1]);
        if (s >= 2 && s % 2 === 1) {
          const k = (s - 1) / 2;
          if (!sameTokens(seq[k], seq[k - 1])) a = lse(a, prev[st - 2]);
        }
        cur[st] = a + emit(t, st);
      }
      const tmp = prev; prev = cur; cur = tmp;
    }
    let end = lse(prev[S + 1], prev[S]);
    if (L > 0) end = lse(end, prev[S - 1]);
    return end;
  }

  /** Score one isolated word. `phones` are stress-marked ARPABET. */
  scoreWord(post: Posteriors, phones: string[], region?: { start: number; end: number }): CtcWordResult {
    const { logp, frames, vocab } = post;
    const lo = region ? Math.max(0, Math.floor(region.start / post.hop)) : 0;
    const hi = region ? Math.min(frames, Math.ceil(region.end / post.hop)) : frames;
    const LL = (seq: number[][]) => this.ctcLL(logp, frames, vocab, seq, lo, hi);
    const vars = this.variants(phones);
    const n = phones.length;
    let best = -Infinity;
    for (const v of vars) best = Math.max(best, LL(v.map((p) => p.tokens)));
    const res: CtcPhoneScore[] = phones.map(() => ({ gop: 0, delMargin: 0, alt: '', peak: 0 }));
    const altBest = new Array(n).fill(-Infinity);
    const altLab = new Array(n).fill('');
    const delBest = new Array(n).fill(-Infinity);
    for (const v of vars) {
      const toks = v.map((p) => p.tokens);
      for (let k = 0; k < v.length; k++) {
        const pos = v[k];
        // deletion
        const del = LL([...toks.slice(0, k), ...toks.slice(k + 1)]);
        for (const pi of pos.phones) {
          if (del > delBest[pi]) delBest[pi] = del;
          if (del > altBest[pi]) { altBest[pi] = del; altLab[pi] = 'DEL'; }
        }
        // substitutions by every other English phone
        for (const g of ARPA_GROUPS) {
          if (g === pos.group || pos.group.startsWith(g + '+')) continue;
          const ids = this.groupIds.get(g)!;
          if (!ids.length || ids.every((id) => pos.tokens.includes(id))) continue;
          const alt = toks.slice();
          alt[k] = ids.filter((id) => !pos.tokens.includes(id));
          if (!alt[k].length) continue;
          const ll = LL(alt);
          for (const pi of pos.phones) if (ll > altBest[pi]) { altBest[pi] = ll; altLab[pi] = g; }
        }
      }
    }
    // peak posterior of each phone's own tokens anywhere in the word
    const v0 = vars[0];
    for (const pos of v0) {
      let pk = 0;
      for (let t = lo; t < hi; t++) {
        let s = 0;
        for (const id of pos.tokens) s += Math.exp(logp[t * vocab + id]);
        if (s > pk) pk = s;
      }
      for (const pi of pos.phones) res[pi].peak = Math.min(1, pk);
    }
    for (let i = 0; i < n; i++) {
      res[i].gop = clampFinite(best - altBest[i], -30, 30);
      res[i].delMargin = clampFinite(best - delBest[i], -30, 30);
      res[i].alt = altLab[i];
    }
    return { phones: res, llPerFrame: best / Math.max(1, hi - lo), heardIpa: this.greedy(post, lo, hi) };
  }

  greedy(post: Posteriors, lo = 0, hi = post.frames): string {
    const { logp, vocab } = post;
    const out: string[] = [];
    let prev = -1;
    for (let t = lo; t < hi; t++) {
      let arg = 0;
      for (let c = 1; c < vocab; c++) if (logp[t * vocab + c] > logp[t * vocab + arg]) arg = c;
      if (arg !== prev && arg !== this.blank && !this.model.labels[arg].startsWith('<')) out.push(this.model.labels[arg]);
      prev = arg;
    }
    return out.join('');
  }
}

function lse(a: number, b: number): number {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  return a > b ? a + Math.log1p(Math.exp(b - a)) : b + Math.log1p(Math.exp(a - b));
}

function sameTokens(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function clampFinite(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return v > 0 ? hi : lo;
  return Math.max(lo, Math.min(hi, v));
}
