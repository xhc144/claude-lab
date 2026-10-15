// Offline music analysis: turns a mono PCM signal into a per-frame feature track
// (normalised band energies, onset envelopes, 128-band spectrum, chroma) plus musical
// structure (beat grid, downbeats, drops, section boundaries).
// Runs inside a Web Worker; pure functions, no DOM.

import { RealFFT } from './fft.js';

export const DEBUG = { drops: [], phase: null };
export const NB = 128; // spectrum bands
export const NF = 16; // scalar features per frame
export const F = {
  rms: 0, sub: 1, bass: 2, lowMid: 3, mid: 4, highMid: 5, treble: 6,
  kick: 7, snare: 8, hat: 9, onset: 10, intensity: 11, centroid: 12, drop: 13, build: 14, flux: 15
};
export const MACRO = [[20, 60], [60, 250], [250, 500], [500, 2000], [2000, 6000], [6000, 16000]];
export const SPEC_MIN_HZ = 30;
export const SPEC_MAX_HZ = 16000;

export function bandEdges(nb = NB, fmin = SPEC_MIN_HZ, fmax = SPEC_MAX_HZ) {
  const e = new Float32Array(nb + 1);
  for (let i = 0; i <= nb; i++) e[i] = fmin * Math.pow(fmax / fmin, i / nb);
  return e;
}

// Precomputed mapping from FFT bins to log bands (shared with the live analyser).
export function makeBandMap(fftSize, sampleRate, nb = NB) {
  const binHz = sampleRate / fftSize;
  const half = fftSize / 2;
  const edges = bandEdges(nb);
  const k0 = new Int32Array(nb), k1 = new Int32Array(nb), kc = new Float32Array(nb);
  for (let b = 0; b < nb; b++) {
    const lo = edges[b], hi = edges[b + 1];
    k0[b] = Math.max(1, Math.ceil(lo / binHz));
    k1[b] = Math.min(half, Math.ceil(hi / binHz));
    kc[b] = Math.min(half - 1, Math.sqrt(lo * hi) / binHz);
  }
  const macro = MACRO.map(([lo, hi]) => [Math.max(1, Math.round(lo / binHz)), Math.min(half, Math.round(hi / binHz))]);
  // chroma: bins between 60 Hz and 5 kHz → pitch class
  const chromaBin = new Int8Array(half + 1).fill(-1);
  for (let k = 1; k <= half; k++) {
    const f = k * binHz;
    if (f < 60 || f > 5000) continue;
    const midi = 12 * Math.log2(f / 440) + 69;
    chromaBin[k] = ((Math.round(midi) % 12) + 12) % 12;
  }
  const maxK = Math.min(half, Math.round(16000 / binHz));
  return { binHz, k0, k1, kc, macro, chromaBin, maxK, nb };
}

// power: Float32/64 array of |X|^2 normalised so that a full-scale sine ≈ 1
export function bandPowers(power, map, outBands, outMacro) {
  const { k0, k1, kc, nb, macro } = map;
  for (let b = 0; b < nb; b++) {
    let p;
    if (k1[b] > k0[b]) {
      p = 0;
      for (let k = k0[b]; k < k1[b]; k++) p += power[k];
      p /= k1[b] - k0[b];
    } else {
      const x = kc[b], i = Math.floor(x), t = x - i;
      p = power[i] * (1 - t) + power[i + 1] * t;
    }
    outBands[b] = p;
  }
  if (outMacro) {
    for (let m = 0; m < macro.length; m++) {
      let p = 0;
      for (let k = macro[m][0]; k < macro[m][1]; k++) p += power[k];
      outMacro[m] = p;
    }
  }
}

const toDb = (p) => 10 * Math.log10(p + 1e-12);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// dB values are quantised to 0.5 dB steps in [-127.5, 0] → Uint8 to keep long tracks compact.
const qdb = (db) => {
  const v = Math.round((db + 127.5) * 2);
  return v < 0 ? 0 : v > 255 ? 255 : v;
};
const dqdb = (q) => q * 0.5 - 127.5;

function histPercentiles(hist, total, qs) {
  const out = [];
  let acc = 0, qi = 0;
  for (let i = 0; i < hist.length && qi < qs.length; i++) {
    acc += hist[i];
    while (qi < qs.length && acc >= qs[qi] * total) { out.push(i); qi++; }
  }
  while (out.length < qs.length) out.push(hist.length - 1);
  return out;
}

function percentile(arr, q, stride = 1) {
  const n = Math.ceil(arr.length / stride);
  const tmp = new Float32Array(n);
  for (let i = 0, j = 0; i < arr.length; i += stride, j++) tmp[j] = arr[i];
  tmp.sort();
  return tmp[Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))))];
}

function smoothAR(src, dst, fps, attack, release, stride = 1, offset = 0, count = src.length) {
  const a = 1 - Math.exp(-1 / (fps * attack));
  const r = 1 - Math.exp(-1 / (fps * release));
  let y = src[offset];
  for (let i = 0; i < count; i++) {
    const x = src[offset + i * stride];
    y += (x - y) * (x > y ? a : r);
    dst[offset + i * stride] = y;
  }
}

function boxSmooth(src, radius) {
  const n = src.length;
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + src[i];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius), b = Math.min(n, i + radius + 1);
    out[i] = (pre[b] - pre[a]) / (b - a);
  }
  return out;
}

function rangeMean(pre, a, b) {
  const n = pre.length - 1;
  a = Math.max(0, Math.min(n, a)); b = Math.max(0, Math.min(n, b));
  return b > a ? (pre[b] - pre[a]) / (b - a) : 0;
}

function prefix(arr) {
  const pre = new Float64Array(arr.length + 1);
  for (let i = 0; i < arr.length; i++) pre[i + 1] = pre[i] + arr[i];
  return pre;
}

// Peak picking with adaptive threshold (non-causal: offline).
function pickOnsets(odf, fps, { minGap, k = 1.3, delta = 0.07, gate = null, gateMin = 0 }) {
  const n = odf.length;
  const pre = prefix(odf);
  const wb = Math.round(0.16 * fps), wf = Math.round(0.07 * fps);
  const gapF = Math.max(1, Math.round(minGap * fps));
  const times = [], strengths = [];
  let last = -1e9;
  for (let i = 2; i < n - 2; i++) {
    const v = odf[i];
    if (v < odf[i - 1] || v < odf[i - 2] || v <= odf[i + 1] || v < odf[i + 2]) continue;
    const thr = rangeMean(pre, i - wb, i + wf + 1) * k + delta;
    if (v <= thr) continue;
    if (gate && gate[i] < gateMin) continue;
    const s = clamp01((v - thr) * 1.4 + 0.3);
    if (i - last < gapF) {
      if (s > strengths[strengths.length - 1]) { strengths[strengths.length - 1] = s; times[times.length - 1] = i; last = i; }
      continue;
    }
    times.push(i); strengths.push(s); last = i;
  }
  return { frames: times, strengths };
}

function envelope(n, onsets, fps, tau) {
  const env = new Float32Array(n);
  const d = Math.exp(-1 / (fps * tau));
  let e = 0, j = 0;
  for (let i = 0; i < n; i++) {
    e *= d;
    while (j < onsets.frames.length && onsets.frames[j] === i) { e = Math.max(e, onsets.strengths[j]); j++; }
    env[i] = e;
  }
  return env;
}

function estimateTempo(odf, fps) {
  const n = odf.length;
  const lagMin = Math.max(2, Math.floor((fps * 60) / 200));
  const lagMax = Math.ceil((fps * 60) / 60);
  const tau0 = (fps * 60) / 120;
  const ac = new Float64Array(lagMax + 2);
  for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += odf[i] * odf[i + lag];
    ac[lag] = s / Math.max(1, n - lag);
  }
  let best = -1, bestLag = tau0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const w = Math.exp(-0.5 * Math.pow(Math.log2(lag / tau0) / 0.9, 2));
    const harmonic = lag * 2 <= lagMax + 1 ? ac[Math.min(lagMax + 1, lag * 2)] * 0.35 : 0;
    const score = (ac[lag] + harmonic) * w;
    if (score > best) { best = score; bestLag = lag; }
  }
  // parabolic refinement
  const a = ac[bestLag - 1], b = ac[bestLag], c = ac[bestLag + 1];
  const den = a - 2 * b + c;
  const off = Math.abs(den) > 1e-12 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
  let period = bestLag + off;
  let bpm = (60 * fps) / period;
  while (bpm < 70) { bpm *= 2; period /= 2; }
  while (bpm > 180) { bpm /= 2; period *= 2; }
  return { bpm, period };
}

// Dynamic-programming beat tracker (Ellis 2007).
function trackBeats(odf, period, tightness = 300) {
  const n = odf.length;
  const score = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period * 0.5), hi = Math.round(period * 2);
  const penalty = new Float32Array(hi + 1);
  for (let d = lo; d <= hi; d++) penalty[d] = -tightness * Math.pow(Math.log(d / period), 2);
  for (let t = 0; t < n; t++) {
    let best = -Infinity, bi = -1;
    for (let d = lo; d <= hi; d++) {
      const tau = t - d;
      if (tau < 0) break;
      const v = score[tau] + penalty[d];
      if (v > best) { best = v; bi = tau; }
    }
    score[t] = odf[t] + (bi >= 0 ? Math.max(0, best) : 0);
    back[t] = bi >= 0 && best > 0 ? bi : -1;
  }
  let end = n - 1, bestEnd = -Infinity;
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++) if (score[t] > bestEnd) { bestEnd = score[t]; end = t; }
  const beats = [];
  for (let t = end; t >= 0; t = back[t]) {
    beats.push(t);
    if (back[t] < 0) break;
  }
  beats.reverse();
  // extend the grid backwards / forwards across silent edges so beat phase is always defined
  if (beats.length) {
    let first = beats[0];
    while (first - period >= 0) { first -= period; beats.unshift(Math.round(first)); }
    let last = beats[beats.length - 1];
    while (last + period < n) { last += period; beats.push(Math.round(last)); }
  }
  return beats;
}

export function analyze(samples, sampleRate, progress = () => {}) {
  DEBUG.drops = [];
  DEBUG.phase = null;
  const hop = Math.round(sampleRate / 100);
  const fps = sampleRate / hop;
  const n = Math.max(8, Math.ceil(samples.length / hop));
  const N = 4096, NO = 1024;
  const fft = new RealFFT(N), fftO = new RealFFT(NO);
  const map = makeBandMap(N, sampleRate);
  const binHzO = sampleRate / NO;
  const norm = 1 / ((N / 4) * (N / 4));
  const normO = 100 / (NO / 4);

  const specQ = new Uint8Array(n * NB);
  const macroDb = new Float32Array(n * 6);
  const rmsDb = new Float32Array(n);
  const lowDb = new Float32Array(n);
  const kLow0 = Math.max(1, Math.round(30 / map.binHz)), kLow1 = Math.round(110 / map.binHz);
  const cent = new Float32Array(n);
  const chroma = new Float32Array(n * 12);
  const odfK = new Float32Array(n), odfS = new Float32Array(n), odfH = new Float32Array(n), odfF = new Float32Array(n);
  const power = new Float64Array(N / 2 + 1);
  const bands = new Float64Array(NB), macro = new Float64Array(6);
  const prevL = new Float32Array(NO / 2 + 1);
  const kK = [Math.max(1, Math.round(40 / binHzO)), Math.max(2, Math.round(160 / binHzO))];
  const kS = [Math.round(200 / binHzO), Math.round(5000 / binHzO)];
  const kH = [Math.round(6000 / binHzO), Math.min(NO / 2, Math.round(16000 / binHzO))];
  const kF = [1, Math.min(NO / 2, Math.round(16000 / binHzO))];
  const histBand = new Uint32Array(NB * 256);

  for (let f = 0; f < n; f++) {
    const center = f * hop;
    const mags = fft.magnitudes(samples, center - N / 2);
    let pSum = 0, pfSum = 0;
    for (let k = 0; k <= N / 2; k++) {
      const p = mags[k] * mags[k] * norm;
      power[k] = p;
      if (k <= map.maxK) { pSum += p; pfSum += p * k; }
    }
    bandPowers(power, map, bands, macro);
    for (let b = 0; b < NB; b++) {
      const q = qdb(toDb(bands[b]));
      specQ[f * NB + b] = q;
      histBand[b * 256 + q]++;
    }
    for (let m = 0; m < 6; m++) macroDb[f * 6 + m] = toDb(macro[m]);
    { let pl = 0; for (let k = kLow0; k <= kLow1; k++) pl += power[k]; lowDb[f] = toDb(pl); }
    cent[f] = pSum > 1e-10 ? (pfSum / pSum) * map.binHz : 0;
    // chroma (magnitude-weighted)
    const cbase = f * 12;
    let cmax = 0;
    for (let k = 1; k <= N / 2; k++) {
      const pc = map.chromaBin[k];
      if (pc >= 0) chroma[cbase + pc] += mags[k];
    }
    for (let c = 0; c < 12; c++) cmax = Math.max(cmax, chroma[cbase + c]);
    if (cmax > 0) for (let c = 0; c < 12; c++) chroma[cbase + c] /= cmax;
    // rms over one hop-centred 1024 window
    let s2 = 0;
    const r0 = Math.max(0, center - 512), r1 = Math.min(samples.length, center + 512);
    for (let i = r0; i < r1; i++) s2 += samples[i] * samples[i];
    rmsDb[f] = toDb(r1 > r0 ? s2 / (r1 - r0) : 0);
    // onset detection functions (spectral flux on log-compressed 1024 spectrum)
    const mo = fftO.magnitudes(samples, center - NO / 2);
    let fk = 0, fs = 0, fh = 0, ff = 0;
    for (let k = 1; k <= NO / 2; k++) {
      const L = Math.log1p(mo[k] * normO);
      const d = L - prevL[k];
      prevL[k] = L;
      if (d <= 0) continue;
      if (k >= kF[0] && k <= kF[1]) ff += d;
      if (k >= kK[0] && k <= kK[1]) fk += d;
      if (k >= kS[0] && k <= kS[1]) fs += d;
      if (k >= kH[0] && k <= kH[1]) fh += d;
    }
    odfK[f] = fk; odfS[f] = fs; odfH[f] = fh; odfF[f] = ff;
    if ((f & 511) === 0) progress(0.05 + 0.75 * (f / n));
  }
  progress(0.8);

  // ---- normalisation -------------------------------------------------------------------
  const feat = new Float32Array(n * NF);
  const spec = new Uint8Array(n * NB);
  {
    const hiB = new Float32Array(NB), loB = new Float32Array(NB), rgB = new Float32Array(NB);
    const gHist = new Uint32Array(256);
    for (let b = 0; b < NB; b++) {
      const h = histBand.subarray(b * 256, b * 256 + 256);
      for (let i = 0; i < 256; i++) gHist[i] += h[i];
      const [p05, p98] = histPercentiles(h, n, [0.05, 0.985]);
      const hi = dqdb(p98), lo = dqdb(p05);
      const rg = Math.min(48, Math.max(24, hi - lo));
      hiB[b] = hi; rgB[b] = rg; loB[b] = hi - rg;
    }
    const [g98] = histPercentiles(gHist, n * NB, [0.985]);
    const gHi = Math.max(dqdb(g98), -90), gRg = 45, gLo = gHi - gRg;
    const tmp = new Float32Array(n);
    const sm = new Float32Array(n);
    for (let b = 0; b < NB; b++) {
      for (let f = 0; f < n; f++) {
        const db = dqdb(specQ[f * NB + b]);
        const v = 0.62 * clamp01((db - loB[b]) / rgB[b]) + 0.38 * clamp01((db - gLo) / gRg);
        tmp[f] = Math.pow(v, 1.35);
      }
      smoothAR(tmp, sm, fps, 0.012, 0.13);
      for (let f = 0; f < n; f++) spec[f * NB + b] = Math.round(clamp01(sm[f]) * 255);
    }
  }
  const macroN = new Float32Array(n * 6);
  for (let m = 0; m < 6; m++) {
    const col = new Float32Array(n);
    for (let f = 0; f < n; f++) col[f] = macroDb[f * 6 + m];
    const hi = percentile(col, 0.985, 3), lo = percentile(col, 0.05, 3);
    const rg = Math.min(42, Math.max(20, hi - lo));
    const raw = new Float32Array(n), sm = new Float32Array(n);
    for (let f = 0; f < n; f++) raw[f] = Math.pow(clamp01((col[f] - (hi - rg)) / rg), 1.25);
    for (let f = 0; f < n; f++) macroN[f * 6 + m] = raw[f];
    smoothAR(raw, sm, fps, 0.012, m < 2 ? 0.18 : 0.14);
    for (let f = 0; f < n; f++) feat[f * NF + 1 + m] = sm[f];
  }
  const rmsN = new Float32Array(n);
  {
    const hi = percentile(rmsDb, 0.985, 3), lo = percentile(rmsDb, 0.05, 3);
    const rg = Math.min(40, Math.max(18, hi - lo));
    for (let f = 0; f < n; f++) rmsN[f] = clamp01((rmsDb[f] - (hi - rg)) / rg);
    const sm = new Float32Array(n);
    smoothAR(rmsN, sm, fps, 0.02, 0.3);
    for (let f = 0; f < n; f++) feat[f * NF + F.rms] = sm[f];
  }
  {
    const sm = new Float32Array(n), raw = new Float32Array(n);
    for (let f = 0; f < n; f++) raw[f] = cent[f] > 0 ? clamp01(Math.log2(cent[f] / 250) / Math.log2(9000 / 250)) : 0;
    smoothAR(raw, sm, fps, 0.1, 0.4);
    for (let f = 0; f < n; f++) feat[f * NF + F.centroid] = sm[f];
  }
  const chromaQ = new Uint8Array(n * 12);
  {
    const sm = new Float32Array(n * 12);
    for (let c = 0; c < 12; c++) smoothAR(chroma, sm, fps, 0.15, 0.35, 12, c, n);
    for (let i = 0; i < n * 12; i++) chromaQ[i] = Math.round(clamp01(sm[i]) * 255);
  }
  progress(0.85);

  // ---- onsets ------------------------------------------------------------------------------
  const normOdf = (o, floor = 0) => {
    const p = Math.max(percentile(o, 0.99, 2), floor, 1e-6);
    for (let i = 0; i < o.length; i++) o[i] = Math.min(1.5, o[i] / p);
    return o;
  };
  // absolute floors keep steady tones / silence from producing spurious onsets
  normOdf(odfK, 0.8); normOdf(odfS, 4); normOdf(odfH, 4); normOdf(odfF, 6);
  const bassGate = new Float32Array(n);
  for (let f = 0; f < n; f++) bassGate[f] = Math.max(macroN[f * 6], macroN[f * 6 + 1]);
  const kicks = pickOnsets(odfK, fps, { minGap: 0.1, k: 1.35, delta: 0.1, gate: bassGate, gateMin: 0.3 });
  const snares = pickOnsets(odfS, fps, { minGap: 0.1, k: 1.35, delta: 0.08 });
  const hats = pickOnsets(odfH, fps, { minGap: 0.06, k: 1.3, delta: 0.06 });
  const onsets = pickOnsets(odfF, fps, { minGap: 0.07, k: 1.3, delta: 0.06 });
  const envK = envelope(n, kicks, fps, 0.15);
  const envS = envelope(n, snares, fps, 0.13);
  const envH = envelope(n, hats, fps, 0.07);
  const envO = envelope(n, onsets, fps, 0.12);
  for (let f = 0; f < n; f++) {
    feat[f * NF + F.kick] = envK[f];
    feat[f * NF + F.snare] = envS[f];
    feat[f * NF + F.hat] = envH[f];
    feat[f * NF + F.onset] = envO[f];
    feat[f * NF + F.flux] = Math.min(1, odfF[f]);
  }
  progress(0.88);

  // ---- tempo & beats -------------------------------------------------------------------------
  const odfB = new Float32Array(n);
  for (let f = 0; f < n; f++) odfB[f] = 0.55 * odfK[f] + 0.3 * odfF[f] + 0.15 * odfS[f];
  {
    const local = boxSmooth(odfB, Math.round(fps * 0.5));
    let s = 0;
    for (let f = 0; f < n; f++) { odfB[f] = Math.max(0, odfB[f] - local[f]); s += odfB[f] * odfB[f]; }
    const sd = Math.sqrt(s / n) || 1;
    for (let f = 0; f < n; f++) odfB[f] /= sd;
  }
  const { bpm, period } = estimateTempo(odfB, fps);
  let beatFrames = trackBeats(odfB, period, 1400);
  {
    // The tracker can lock onto off-beats (hi-hats, off-beat bass). Kick+snare salience minus
    // hi-hat salience decides which of the two phases is the real beat.
    const half = Math.round(period / 2);
    let onG = 0, offG = 0;
    const sal = (f) => (f >= 0 && f < n ? odfK[f] * odfF[f] * 2 + odfS[f] * 0.6 - odfH[f] * 0.5 : 0);
    const at = (f) => Math.max(sal(f), sal(f - 1), sal(f + 1));
    for (const bf of beatFrames) { onG += at(bf); offG += at(bf + half); }
    DEBUG.phase = { onG, offG };
    if (offG > onG * 1.1 + 0.5) beatFrames = beatFrames.map((f) => f + half).filter((f) => f < n);
  }
  let tempoConf = 0;
  {
    let a = 0, b = 0;
    for (const bf of beatFrames) a += Math.max(odfB[bf] || 0, odfB[bf - 1] || 0, odfB[bf + 1] || 0);
    for (let f = 0; f < n; f++) b += odfB[f];
    tempoConf = beatFrames.length ? (a / beatFrames.length) / ((b / n) + 1e-6) : 0;
  }
  // downbeat phase: chroma/bass novelty + kick strength at each beat
  let downPhase = 0;
  if (beatFrames.length > 8) {
    const nov = new Float32Array(beatFrames.length);
    const avgChroma = (a, b, out) => {
      out.fill(0);
      const cnt = Math.max(1, b - a);
      for (let f = a; f < b; f++) for (let c = 0; c < 12; c++) out[c] += chromaQ[f * 12 + c] / 255;
      for (let c = 0; c < 12; c++) out[c] /= cnt;
    };
    const A = new Float32Array(12), B = new Float32Array(12);
    for (let i = 1; i < beatFrames.length - 1; i++) {
      avgChroma(beatFrames[i - 1], beatFrames[i], A);
      avgChroma(beatFrames[i], beatFrames[i + 1], B);
      let d = 0;
      for (let c = 0; c < 12; c++) d += Math.max(0, B[c] - A[c]);
      const bassJump = Math.max(0, macroN[beatFrames[i] * 6 + 1] - macroN[Math.max(0, beatFrames[i] - 2) * 6 + 1]);
      nov[i] = d + 0.6 * bassJump + 0.25 * envK[beatFrames[i]];
    }
    let best = -1;
    for (let p = 0; p < 4; p++) {
      let s = 0, c = 0;
      for (let i = p; i < beatFrames.length; i += 4) { s += nov[i]; c++; }
      s /= Math.max(1, c);
      if (s > best) { best = s; downPhase = p; }
    }
  }
  const beats = Float32Array.from(beatFrames, (f) => f / fps);
  const downbeats = Float32Array.from(beatFrames.filter((_, i) => (i - downPhase) % 4 === 0 && i >= downPhase), (f) => f / fps);
  progress(0.92);

  // ---- intensity, drops, build-ups, sections -----------------------------------------------
  const rawI = new Float32Array(n);
  for (let f = 0; f < n; f++) rawI[f] = 0.55 * rmsN[f] + 0.3 * macroN[f * 6 + 1] + 0.15 * macroN[f * 6 + 5];
  let inten = boxSmooth(rawI, Math.round(fps * 1.5));
  {
    const hi = percentile(inten, 0.98, 3), lo = percentile(inten, 0.04, 3);
    const rg = Math.max(0.05, hi - lo);
    for (let f = 0; f < n; f++) inten[f] = clamp01((inten[f] - lo) / rg);
    const sm = new Float32Array(n);
    smoothAR(inten, sm, fps, 0.4, 0.8);
    inten = sm;
  }
  for (let f = 0; f < n; f++) feat[f * NF + F.intensity] = inten[f];

  const duration = samples.length / sampleRate;
  // drop detector: jumps of the low end (30–110 Hz, in dB) that are sustained afterwards
  const lowS = boxSmooth(lowDb, Math.round(fps * 0.25));
  const preI = prefix(lowS);
  const p70 = percentile(lowS, 0.7, 3);
  const candT = downbeats.length > 4 && tempoConf > 1.2 ? Array.from(downbeats) : Array.from({ length: Math.floor(duration * 2) }, (_, i) => i * 0.5);
  const cands = [];
  for (const t of candT) {
    const fi = Math.round(t * fps);
    const pre = rangeMean(preI, fi - Math.round(3 * fps), fi - Math.round(0.25 * fps));
    const post = rangeMean(preI, fi + Math.round(0.05 * fps), fi + Math.round(2.5 * fps));
    const longPost = rangeMean(preI, fi, fi + Math.round(8 * fps));
    const jump = post - pre, sustain = longPost - pre;
    const score = jump + 0.5 * sustain;
    DEBUG.drops.push({ t, pre, post, longPost, score, p70 });
    let kicksAfter = 0;
    for (const kf of kicks.frames) if (kf >= fi && kf < fi + 4 * fps) kicksAfter++;
    if (t > 3 && t < duration - 4 && jump > 4.5 && sustain > 3.5 && post > p70 - 3 && kicksAfter >= 4) cands.push({ t, score });
  }
  cands.sort((a, b) => b.score - a.score);
  const dropList = [];
  const maxDrops = Math.floor(duration / 45) + 1;
  const best = cands.length ? cands[0].score : 0;
  for (const c of cands) if (c.score >= best * 0.35 && dropList.length < maxDrops && dropList.every((d) => Math.abs(d - c.t) > 16)) dropList.push(c.t);
  dropList.sort((a, b) => a - b);
  const barLen = bpm > 0 ? (240 / bpm) : 2;
  {
    const dDecay = Math.exp(-1 / (fps * 2.5));
    let e = 0, di = 0;
    for (let f = 0; f < n; f++) {
      const t = f / fps;
      e *= dDecay;
      while (di < dropList.length && dropList[di] <= t) { e = 1; di++; }
      feat[f * NF + F.drop] = e;
    }
    for (let k = 0; k < dropList.length; k++) {
      const td = dropList[k];
      const prev = k > 0 ? dropList[k - 1] + 4 : 0;
      const L = Math.max(2, Math.min(8 * barLen, 16, td - prev));
      const f0 = Math.max(0, Math.floor((td - L) * fps)), f1 = Math.min(n, Math.floor(td * fps));
      for (let f = f0; f < f1; f++) {
        const x = (f / fps - (td - L)) / L;
        feat[f * NF + F.build] = Math.max(feat[f * NF + F.build], x * x * (3 - 2 * x));
      }
    }
  }
  // section boundaries from bar-level novelty
  const sectionList = [0];
  {
    const bars = downbeats.length > 8 && tempoConf > 1.2 ? Array.from(downbeats) : Array.from({ length: Math.floor(duration / 2) }, (_, i) => i * 2);
    const nb = bars.length;
    if (nb > 12) {
      const dim = 7 + 12;
      const fv = new Float32Array(nb * dim);
      for (let i = 0; i < nb; i++) {
        const a = Math.round(bars[i] * fps), b = Math.max(a + 1, Math.round((i + 1 < nb ? bars[i + 1] : duration) * fps));
        for (let f = a; f < Math.min(b, n); f++) {
          for (let m = 0; m < 6; m++) fv[i * dim + m] += macroN[f * 6 + m];
          fv[i * dim + 6] += inten[f] * 2;
          for (let c = 0; c < 12; c++) fv[i * dim + 7 + c] += (chromaQ[f * 12 + c] / 255) * 0.5;
        }
        const cnt = Math.max(1, Math.min(b, n) - a);
        for (let d = 0; d < dim; d++) fv[i * dim + d] /= cnt;
      }
      const nov = new Float32Array(nb);
      for (let k = 4; k < nb - 4; k++) {
        let d2 = 0;
        for (let d = 0; d < dim; d++) {
          let A = 0, B = 0;
          for (let j = 0; j < 4; j++) { A += fv[(k - 1 - j) * dim + d]; B += fv[(k + j) * dim + d]; }
          d2 += Math.pow((B - A) / 4, 2);
        }
        nov[k] = Math.sqrt(d2);
      }
      let mean = 0, sd = 0;
      for (let k = 0; k < nb; k++) mean += nov[k];
      mean /= nb;
      for (let k = 0; k < nb; k++) sd += Math.pow(nov[k] - mean, 2);
      sd = Math.sqrt(sd / nb);
      let last = -100;
      for (let k = 4; k < nb - 4; k++) {
        if (nov[k] > mean + 0.8 * sd && nov[k] >= nov[k - 1] && nov[k] >= nov[k + 1] && nov[k] >= nov[k - 2] && nov[k] >= nov[k + 2] && k - last >= 8) {
          sectionList.push(bars[k]); last = k;
        }
      }
    }
    for (const d of dropList) if (sectionList.every((s) => Math.abs(s - d) > 4)) sectionList.push(d);
    sectionList.sort((a, b) => a - b);
  }
  progress(0.97);

  // ---- waveform overview for the UI -----------------------------------------------------------
  const W = 1600;
  const overview = new Float32Array(W * 2);
  {
    const per = samples.length / W;
    let gmax = 1e-6;
    for (let i = 0; i < W; i++) {
      const a = Math.floor(i * per), b = Math.min(samples.length, Math.floor((i + 1) * per));
      let pk = 0, s2 = 0;
      for (let j = a; j < b; j += 2) { const v = Math.abs(samples[j]); if (v > pk) pk = v; s2 += v * v; }
      overview[i * 2] = pk;
      overview[i * 2 + 1] = Math.sqrt(s2 / Math.max(1, (b - a) / 2));
      gmax = Math.max(gmax, pk);
    }
    for (let i = 0; i < W * 2; i++) overview[i] /= gmax;
  }

  const pack = (o) => {
    const a = new Float32Array(o.frames.length * 2);
    o.frames.forEach((f, i) => { a[i * 2] = f / fps; a[i * 2 + 1] = o.strengths[i]; });
    return a;
  };
  progress(1);
  return {
    version: 2, fps, frames: n, duration, sampleRate,
    feat, spec, chroma: chromaQ,
    kicks: pack(kicks), snares: pack(snares), hats: pack(hats), onsets: pack(onsets),
    beats, downbeats, bpm, tempoConf,
    drops: Float32Array.from(dropList), sections: Float32Array.from(sectionList),
    overview
  };
}

export const transferList = (r) => [r.feat.buffer, r.spec.buffer, r.chroma.buffer, r.kicks.buffer, r.snares.buffer, r.hats.buffer, r.onsets.buffer, r.beats.buffer, r.downbeats.buffer, r.drops.buffer, r.sections.buffer, r.overview.buffer];
