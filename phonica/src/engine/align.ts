// Viterbi forced alignment of a word sequence against frame-level phone
// posteriors. The graph allows optional silence and a garbage ("filler") model
// between words, alternative pronunciations per word, and skipping words, so
// omissions, insertions and hesitations do not corrupt the alignment of the
// rest of the utterance.

export interface AlignVariant {
  classIds: number[];
  /** log-domain penalty for choosing this variant (accent / source preference) */
  penalty: number;
}

export interface AlignWordSpec {
  variants: AlignVariant[];
}

export interface AlignOptions {
  silId: number;
  /** ids excluded from the filler model (silence, specials) */
  nonPhoneIds: number[];
  minFrames: (classId: number) => number;
  skipPenalty: number;
  maxSkip: number;
  fillerEntry: number;
  fillerFrame: number;
  silEntry: number;
  beam: number;
}

export interface AlignedPhone {
  start: number;
  end: number; // exclusive, frames
}

export interface AlignedWord {
  skipped: boolean;
  variant: number;
  start: number;
  end: number;
  phones: AlignedPhone[];
}

export interface AlignedGap {
  kind: 'sil' | 'filler';
  /** gap index k sits before word k (k = words.length: after the last word) */
  gap: number;
  start: number;
  end: number;
}

export interface Alignment {
  words: AlignedWord[];
  gaps: AlignedGap[];
  score: number;
}

const T_PHONE = 0;
const T_SIL = 1;
const T_FILL = 2;

export function forceAlign(logp: Float32Array, frames: number, vocab: number, words: AlignWordSpec[], o: AlignOptions): Alignment {
  // ---------- build the state graph (states are in topological order) ----------
  const type: number[] = [];
  const cls: number[] = [];
  const selfLoop: boolean[] = [];
  const wordOf: number[] = [];
  const varOf: number[] = [];
  const phoneOf: number[] = [];
  const gapOf: number[] = [];
  const preds: Array<Array<[number, number]>> = [];
  const add = (t: number, c: number, self: boolean, w: number, v: number, p: number, g: number) => {
    type.push(t); cls.push(c); selfLoop.push(self); wordOf.push(w); varOf.push(v); phoneOf.push(p); gapOf.push(g); preds.push([]);
    return type.length - 1;
  };
  const W = words.length;
  const silState: number[] = [];
  const fillState: number[] = [];
  const entries: Array<Array<[number, number]>> = []; // per word: [state, penalty]
  const exits: number[][] = [];

  for (let k = 0; k <= W; k++) {
    silState.push(add(T_SIL, o.silId, true, -1, -1, -1, k));
    fillState.push(add(T_FILL, -1, true, -1, -1, -1, k));
    if (k === W) break;
    const ent: Array<[number, number]> = [];
    const ex: number[] = [];
    words[k].variants.forEach((v, vi) => {
      let prev = -1;
      v.classIds.forEach((c, pi) => {
        const m = Math.max(1, o.minFrames(c));
        for (let j = 0; j < m; j++) {
          const s = add(T_PHONE, c, j === m - 1, k, vi, pi, -1);
          if (prev >= 0) preds[s].push([prev, 0]);
          else ent.push([s, v.penalty]);
          prev = s;
        }
      });
      if (prev >= 0) ex.push(prev);
    });
    entries.push(ent);
    exits.push(ex);
  }
  const S = type.length;

  // gap k "sources": exits of word k-1, sil_k, fill_k
  const gapSources = (k: number): number[] => [...(k > 0 ? exits[k - 1] : []), silState[k], fillState[k]];
  const startPen = new Float32Array(S).fill(-Infinity);
  const endPen = new Float32Array(S).fill(-Infinity);
  for (let k = 0; k <= W; k++) {
    const src = gapSources(k);
    // into the gap's own silence / filler
    for (const s of src) {
      if (s !== silState[k]) preds[silState[k]].push([s, -o.silEntry]);
      if (s !== fillState[k]) preds[fillState[k]].push([s, -o.fillerEntry]);
    }
    // into the next word, or skip up to maxSkip words
    for (let j = 0; j <= o.maxSkip && k + j < W; j++) {
      for (const [e, pen] of entries[k + j]) for (const s of src) preds[e].push([s, pen - j * o.skipPenalty]);
    }
    // starting / ending inside this gap (words before / after are skipped)
    startPen[silState[k]] = -k * o.skipPenalty;
    startPen[fillState[k]] = -k * o.skipPenalty - o.fillerEntry;
    for (const s of src) endPen[s] = Math.max(endPen[s], -(W - k) * o.skipPenalty);
  }
  for (let k = 0; k < W; k++) for (const [e, pen] of entries[k]) startPen[e] = Math.max(startPen[e], pen - k * o.skipPenalty);

  const maxSucc = new Int32Array(S);
  for (let s = 0; s < S; s++) maxSucc[s] = s;
  for (let s = 0; s < S; s++) for (const [p] of preds[s]) if (s > maxSucc[p]) maxSucc[p] = s;

  // ---------- Viterbi with a forward-moving beam ----------
  const nonPhone = new Set(o.nonPhoneIds);
  const fillerEm = new Float32Array(frames);
  for (let t = 0; t < frames; t++) {
    let mx = -Infinity;
    const off = t * vocab;
    for (let c = 0; c < vocab; c++) if (!nonPhone.has(c) && logp[off + c] > mx) mx = logp[off + c];
    fillerEm[t] = mx - o.fillerFrame;
  }
  const em = (t: number, s: number) => (type[s] === T_FILL ? fillerEm[t] : logp[t * vocab + cls[s]]);

  let prev = new Float32Array(S).fill(-Infinity);
  let cur = new Float32Array(S).fill(-Infinity);
  const bpLo = new Int32Array(frames);
  const bps: Int32Array[] = [];
  let lo = 0;
  let hi = S - 1;
  for (let s = 0; s < S; s++) if (startPen[s] > -Infinity) prev[s] = startPen[s] + em(0, s);
  bps.push(new Int32Array(0));
  // beam over frame 0
  ({ lo, hi } = band(prev, 0, S - 1, o.beam, maxSucc));
  for (let t = 1; t < frames; t++) {
    const bp = new Int32Array(hi - lo + 1).fill(-1);
    bpLo[t] = lo;
    cur.fill(-Infinity);
    for (let s = lo; s <= hi; s++) {
      let best = selfLoop[s] ? prev[s] : -Infinity;
      let arg = selfLoop[s] ? s : -1;
      const pl = preds[s];
      for (let i = 0; i < pl.length; i++) {
        const v = prev[pl[i][0]] + pl[i][1];
        if (v > best) { best = v; arg = pl[i][0]; }
      }
      if (arg >= 0 && best > -Infinity) {
        cur[s] = best + em(t, s);
        bp[s - lo] = arg;
      }
    }
    bps.push(bp);
    const tmp = prev; prev = cur; cur = tmp;
    ({ lo, hi } = band(prev, lo, hi, o.beam, maxSucc));
  }

  // ---------- backtrace ----------
  let bestS = -1;
  let bestV = -Infinity;
  for (let s = 0; s < S; s++) {
    if (endPen[s] === -Infinity) continue;
    const v = prev[s] + endPen[s];
    if (v > bestV) { bestV = v; bestS = s; }
  }
  if (bestS < 0) {
    // nothing reached an end state (should not happen); fall back to best state
    for (let s = 0; s < S; s++) if (prev[s] > bestV) { bestV = prev[s]; bestS = s; }
  }
  const path = new Int32Array(frames);
  let s = bestS;
  for (let t = frames - 1; t >= 0; t--) {
    path[t] = s;
    if (t > 0) {
      const bp = bps[t];
      const idx = s - bpLo[t];
      s = idx >= 0 && idx < bp.length && bp[idx] >= 0 ? bp[idx] : s;
    }
  }

  // ---------- segments ----------
  const outWords: AlignedWord[] = words.map(() => ({ skipped: true, variant: 0, start: -1, end: -1, phones: [] }));
  const gaps: AlignedGap[] = [];
  let t = 0;
  while (t < frames) {
    const st = path[t];
    let u = t + 1;
    if (type[st] === T_PHONE) {
      const w = wordOf[st];
      const v = varOf[st];
      const p = phoneOf[st];
      while (u < frames && type[path[u]] === T_PHONE && wordOf[path[u]] === w && varOf[path[u]] === v && phoneOf[path[u]] === p) u++;
      const ow = outWords[w];
      if (ow.skipped || ow.variant !== v) {
        ow.skipped = false;
        ow.variant = v;
        ow.phones = [];
        ow.start = t;
      }
      ow.phones[p] = { start: t, end: u };
      ow.end = u;
    } else {
      const k = gapOf[st];
      const kind = type[st] === T_SIL ? 'sil' : 'filler';
      while (u < frames && path[u] === st) u++;
      const last = gaps[gaps.length - 1];
      if (last && last.kind === kind && last.gap === k && last.end === t) last.end = u;
      else gaps.push({ kind, gap: k, start: t, end: u });
    }
    t = u;
  }
  // a word whose path was only partially traversed cannot happen (graph is linear per variant)
  return { words: outWords, gaps, score: bestV };
}

function band(score: Float32Array, lo: number, hi: number, beam: number, maxSucc: Int32Array): { lo: number; hi: number } {
  let mx = -Infinity;
  for (let s = lo; s <= hi; s++) if (score[s] > mx) mx = score[s];
  const thr = mx - beam;
  let nlo = -1;
  let nhi = lo;
  for (let s = lo; s <= hi; s++) {
    if (score[s] >= thr && score[s] > -Infinity) {
      if (nlo < 0) nlo = s;
      if (maxSucc[s] > nhi) nhi = maxSucc[s];
    } else if (score[s] < thr) {
      score[s] = -Infinity;
    }
  }
  if (nlo < 0) return { lo, hi };
  return { lo: nlo, hi: nhi };
}
