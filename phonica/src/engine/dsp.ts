// Signal analysis: frame energy, YIN pitch tracking with octave-error repair,
// FFT and LPC formant estimation.

export const HOP_SEC = 0.01;

/** RMS level per 10 ms frame (25 ms window) in dBFS. */
export function frameEnergyDb(x: Float32Array, sr: number, hop = HOP_SEC, win = 0.025): Float32Array {
  const h = Math.round(hop * sr);
  const w = Math.round(win * sr);
  const n = Math.max(1, Math.ceil(x.length / h));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = i * h + (h >> 1);
    const a = Math.max(0, c - (w >> 1));
    const b = Math.min(x.length, c + (w >> 1));
    let s = 0;
    for (let k = a; k < b; k++) s += x[k] * x[k];
    out[i] = 10 * Math.log10(s / Math.max(1, b - a) + 1e-10);
  }
  return out;
}

export interface PitchTrack {
  /** Hz, 0 where unvoiced; one value per 10 ms */
  f0: Float32Array;
  /** periodicity confidence 0..1 */
  conf: Float32Array;
}

/** YIN pitch tracker on a 8 kHz copy of the signal. */
export function pitchYin(x16k: Float32Array, energyDb: Float32Array, fmin = 65, fmax = 480): PitchTrack {
  // decimate 16k -> 8k with a short half-band low-pass
  const sr = 8000;
  const lp = [0.0153, 0, -0.0461, 0, 0.2933, 0.5, 0.2933, 0, -0.0461, 0, 0.0153];
  const n8 = Math.floor(x16k.length / 2);
  const y = new Float32Array(n8);
  for (let i = 0; i < n8; i++) {
    let acc = 0;
    for (let k = 0; k < lp.length; k++) {
      const j = 2 * i + k - 5;
      if (j >= 0 && j < x16k.length) acc += lp[k] * x16k[j];
    }
    y[i] = acc;
  }
  const hop = 80; // 10 ms
  const W = 320; // 40 ms integration window
  const tauMin = Math.floor(sr / fmax);
  const tauMax = Math.ceil(sr / fmin);
  const frames = energyDb.length;
  const f0 = new Float32Array(frames);
  const conf = new Float32Array(frames);
  const d = new Float32Array(tauMax + 2);
  let maxDb = -Infinity;
  for (let i = 0; i < frames; i++) maxDb = Math.max(maxDb, energyDb[i]);
  const gate = maxDb - 45;
  for (let i = 0; i < frames; i++) {
    if (energyDb[i] < gate) continue;
    const start = i * hop + hop / 2 - (W + tauMax) / 2;
    const a = Math.round(start);
    if (a < 0 || a + W + tauMax >= n8) continue;
    // difference function
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) {
        const df = y[a + j] - y[a + j + tau];
        s += df * df;
      }
      d[tau] = s;
    }
    // cumulative mean normalised difference
    let run = 0;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      run += d[tau];
      d[tau] = run > 0 ? (d[tau] * tau) / run : 1;
    }
    let tauBest = -1;
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (d[tau] < 0.15) {
        while (tau + 1 < tauMax && d[tau + 1] < d[tau]) tau++;
        tauBest = tau;
        break;
      }
    }
    if (tauBest < 0) {
      // no dip under the threshold: take the global minimum if it is reasonably periodic
      let mv = 1;
      for (let tau = tauMin; tau < tauMax; tau++) if (d[tau] < mv) { mv = d[tau]; tauBest = tau; }
      if (mv > 0.35) continue;
    }
    // parabolic interpolation
    const t0 = tauBest;
    let tf = t0;
    if (t0 > 1 && t0 < tauMax) {
      const s0 = d[t0 - 1];
      const s1 = d[t0];
      const s2 = d[t0 + 1];
      const den = s0 + s2 - 2 * s1;
      if (den !== 0) tf = t0 + (s0 - s2) / (2 * den);
    }
    if (!(tf > 0) || Math.abs(tf - t0) > 1) tf = t0;
    const hz = sr / tf;
    if (!Number.isFinite(hz) || hz < fmin * 0.9 || hz > fmax * 1.1) continue;
    f0[i] = hz;
    conf[i] = Math.max(0, 1 - d[t0]);
  }
  repairPitch(f0, conf);
  return { f0, conf };
}

/** Remove isolated voiced frames, fix octave jumps against a running median, smooth. */
function repairPitch(f0: Float32Array, conf: Float32Array) {
  const n = f0.length;
  // drop voiced runs shorter than 3 frames
  for (let i = 0; i < n; ) {
    if (!(f0[i] > 0)) { f0[i] = 0; i++; continue; }
    let j = i;
    while (j < n && f0[j] > 0) j++;
    if (j - i < 3) for (let k = i; k < j; k++) { f0[k] = 0; conf[k] = 0; }
    i = j;
  }
  // utterance median as an anchor
  const voiced = Array.from(f0).filter((v) => v > 0).sort((a, b) => a - b);
  if (!voiced.length) return;
  const med = voiced[Math.floor(voiced.length / 2)];
  for (let i = 0; i < n; i++) {
    if (f0[i] === 0) continue;
    // local median over ±15 frames
    const loc: number[] = [];
    for (let k = Math.max(0, i - 15); k <= Math.min(n - 1, i + 15); k++) if (f0[k] > 0) loc.push(f0[k]);
    loc.sort((a, b) => a - b);
    const ref = loc.length >= 5 ? loc[Math.floor(loc.length / 2)] : med;
    let v = f0[i];
    if (v > 1.7 * ref && v / 2 > 50) v /= 2;
    else if (v < 0.6 * ref && v * 2 < 600) v *= 2;
    f0[i] = v;
  }
  // 5-point median smoothing inside voiced runs
  const copy = f0.slice();
  for (let i = 2; i < n - 2; i++) {
    if (copy[i] === 0) continue;
    const w = [copy[i - 2], copy[i - 1], copy[i], copy[i + 1], copy[i + 2]].filter((v) => v > 0).sort((a, b) => a - b);
    if (w.length >= 3) f0[i] = w[Math.floor(w.length / 2)];
  }
}

export function hzToSemitones(hz: number, ref: number): number {
  return 12 * Math.log2(hz / ref);
}

// ---------------- FFT (radix-2, in place) ----------------
export function fft(re: Float32Array | Float64Array, im: Float32Array | Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// ---------------- LPC formants ----------------
/** Estimate F1/F2 (Hz) of a vowel segment with autocorrelation LPC (order 10 at 10 kHz). */
export function formants(x16k: Float32Array, startSec: number, endSec: number): { f1: number; f2: number } | null {
  const sr0 = 16000;
  const a = Math.max(0, Math.floor(startSec * sr0));
  const b = Math.min(x16k.length, Math.floor(endSec * sr0));
  if (b - a < 0.03 * sr0) return null;
  // analyse the middle 50% of the vowel, several 25 ms frames, take medians
  const mid0 = a + Math.floor((b - a) * 0.25);
  const mid1 = a + Math.floor((b - a) * 0.75);
  const f1s: number[] = [];
  const f2s: number[] = [];
  const win = 400;
  for (let s = mid0; s + win <= Math.max(mid1, mid0 + win) && s + win <= x16k.length; s += 160) {
    const r = lpcFormants(x16k.subarray(s, s + win), sr0);
    if (r) { f1s.push(r.f1); f2s.push(r.f2); }
  }
  if (!f1s.length) return null;
  f1s.sort((p, q) => p - q);
  f2s.sort((p, q) => p - q);
  return { f1: f1s[f1s.length >> 1], f2: f2s[f2s.length >> 1] };
}

function lpcFormants(seg: Float32Array, sr: number): { f1: number; f2: number } | null {
  const n = seg.length;
  const order = 12;
  const x = new Float64Array(n);
  // pre-emphasis + Hamming
  for (let i = 0; i < n; i++) {
    const v = seg[i] - (i > 0 ? 0.97 * seg[i - 1] : 0);
    x[i] = v * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  const r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) {
    let s = 0;
    for (let i = k; i < n; i++) s += x[i] * x[i - k];
    r[k] = s;
  }
  if (r[0] <= 1e-9) return null;
  r[0] *= 1.0001;
  // Levinson-Durbin
  const aC = new Float64Array(order + 1);
  aC[0] = 1;
  let e = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += aC[j] * r[i - j];
    const k = -acc / e;
    const prev = aC.slice();
    for (let j = 1; j < i; j++) aC[j] = prev[j] + k * prev[i - j];
    aC[i] = k;
    e *= 1 - k * k;
    if (e <= 0) return null;
  }
  // evaluate the LPC envelope on a fine grid and pick spectral peaks (robust vs root finding)
  const N = 512;
  const peaks: Array<{ f: number; m: number }> = [];
  let prevM = -Infinity;
  let prev2 = -Infinity;
  for (let k = 0; k <= N; k++) {
    const w = (Math.PI * k) / N;
    let re = 0;
    let im = 0;
    for (let j = 0; j <= order; j++) {
      re += aC[j] * Math.cos(w * j);
      im -= aC[j] * Math.sin(w * j);
    }
    const m = -10 * Math.log10(re * re + im * im + 1e-12);
    if (k >= 2 && prevM > prev2 && prevM >= m) peaks.push({ f: ((k - 1) * sr) / (2 * N), m: prevM });
    prev2 = prevM;
    prevM = m;
  }
  const cand = peaks.filter((p) => p.f > 200 && p.f < 4000);
  if (cand.length < 2) return null;
  const f1 = cand[0].f;
  const f2 = cand.find((p) => p.f > f1 + 250)?.f;
  if (!f2 || f1 > 1200) return null;
  return { f1, f2 };
}
