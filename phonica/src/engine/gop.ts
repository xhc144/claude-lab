// Goodness-of-pronunciation features computed from frame-level phone posteriors
// over a force-aligned phone segment, plus free (text-independent) phone
// recognition used to show what was actually heard.

export interface PhoneEvidence {
  /** mean log posterior of the canonical phone */
  lpp: number;
  /** mean log posterior ratio canonical vs best phone per frame (≤ 0) */
  lpr: number;
  /** 25th percentile of the per-frame log ratio (captures partially wrong segments) */
  lprLow: number;
  /** log of the mean posterior probability */
  segPost: number;
  /** fraction of frames where the canonical phone is the arg-max */
  frameAcc: number;
  /** fraction of frames classified as silence */
  silFrac: number;
  /** best competing phone (by mean log posterior over the segment) */
  competitor: number;
  /** lpp(canonical) - lpp(competitor); negative = competitor fits better */
  margin: number;
  frames: number;
}

export function phoneEvidence(logp: Float32Array, vocab: number, start: number, end: number, cls: number, phoneIds: number[], silId: number): PhoneEvidence {
  const n = Math.max(1, end - start);
  const sums = new Float64Array(vocab);
  let lpp = 0;
  let lpr = 0;
  let post = 0;
  let acc = 0;
  let sil = 0;
  const ratios: number[] = [];
  for (let t = start; t < end; t++) {
    const o = t * vocab;
    let mx = -Infinity;
    let arg = 0;
    for (const c of phoneIds) {
      const v = logp[o + c];
      sums[c] += v;
      if (v > mx) { mx = v; arg = c; }
    }
    const ls = logp[o + silId];
    if (ls > mx) sil++;
    const v = logp[o + cls];
    lpp += v;
    const r = v - Math.max(mx, ls);
    lpr += r;
    ratios.push(r);
    post += Math.exp(v);
    if (arg === cls && ls <= mx) acc++;
  }
  ratios.sort((a, b) => a - b);
  let comp = -1;
  let compV = -Infinity;
  for (const c of phoneIds) {
    if (c === cls) continue;
    if (sums[c] > compV) { compV = sums[c]; comp = c; }
  }
  return {
    lpp: lpp / n,
    lpr: lpr / n,
    lprLow: ratios[Math.floor((ratios.length - 1) * 0.25)] ?? 0,
    segPost: Math.log(Math.max(1e-12, post / n)),
    frameAcc: acc / n,
    silFrac: sil / n,
    competitor: comp,
    margin: (lpp - compV) / n,
    frames: n,
  };
}

export interface RecognizedPhone {
  cls: number;
  start: number;
  end: number;
  /** mean posterior over the run */
  conf: number;
}

/** Text-independent phone recognition: smoothed per-frame arg-max runs. */
export function recognizePhones(logp: Float32Array, frames: number, vocab: number, validIds: number[], silId: number, minRun = 3): RecognizedPhone[] {
  const arg = new Int32Array(frames);
  for (let t = 0; t < frames; t++) {
    const o = t * vocab;
    let best = silId;
    let bv = logp[o + silId];
    for (const c of validIds) if (logp[o + c] > bv) { bv = logp[o + c]; best = c; }
    arg[t] = best;
  }
  // median-of-3 smoothing removes single-frame flickers
  const sm = arg.slice();
  for (let t = 1; t < frames - 1; t++) {
    if (arg[t - 1] === arg[t + 1] && arg[t] !== arg[t - 1]) sm[t] = arg[t - 1];
  }
  const runs: RecognizedPhone[] = [];
  let t = 0;
  while (t < frames) {
    let u = t + 1;
    while (u < frames && sm[u] === sm[t]) u++;
    let conf = 0;
    for (let k = t; k < u; k++) conf += Math.exp(logp[k * vocab + sm[t]]);
    runs.push({ cls: sm[t], start: t, end: u, conf: conf / (u - t) });
    t = u;
  }
  // absorb very short runs into the stronger neighbour, then merge equal neighbours
  const kept: RecognizedPhone[] = [];
  for (const r of runs) {
    if (r.end - r.start < minRun && r.cls !== silId && r.conf < 0.6) {
      const prev = kept[kept.length - 1];
      if (prev) { prev.end = r.end; continue; }
    }
    const prev = kept[kept.length - 1];
    if (prev && prev.cls === r.cls) { prev.end = r.end; prev.conf = Math.max(prev.conf, r.conf); continue; }
    kept.push({ ...r });
  }
  return kept.filter((r) => r.cls !== silId);
}
