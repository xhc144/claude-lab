// Runtime view of an analysed track: interpolated per-frame features + musical events.
import { NB, NF, F } from './analysis.js';

export function createFrame() {
  return {
    t: 0, rms: 0, sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0,
    kick: 0, snare: 0, hat: 0, onset: 0, intensity: 0, centroid: 0, drop: 0, build: 0, flux: 0,
    beatPhase: 0, barPhase: 0, beat: 0, bar: 0, bpm: 120, hasTempo: false,
    spectrum: new Float32Array(NB), chroma: new Float32Array(12),
    active: false
  };
}

const KEYS = ['rms', 'sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'kick', 'snare', 'hat', 'onset', 'intensity', 'centroid', 'drop', 'build', 'flux'];

// Largest index i with arr[i] <= t (arr sorted ascending, optionally strided).
export function lowerIndex(arr, t, stride = 1) {
  let lo = 0, hi = arr.length / stride - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid * stride] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export class TrackAnalysis {
  constructor(r) {
    Object.assign(this, r);
    this.hasTempo = r.tempoConf > 1.15 && r.beats.length > 8;
  }

  sample(t, out) {
    const fi = Math.max(0, Math.min(this.frames - 1.001, t * this.fps));
    const i0 = Math.floor(fi), i1 = Math.min(this.frames - 1, i0 + 1), w = fi - i0;
    const f = this.feat, a = i0 * NF, b = i1 * NF;
    for (let k = 0; k < NF; k++) out[KEYS[k]] = f[a + k] * (1 - w) + f[b + k] * w;
    const s = this.spec, sa = i0 * NB, sb = i1 * NB, inv = 1 / 255;
    for (let k = 0; k < NB; k++) out.spectrum[k] = (s[sa + k] * (1 - w) + s[sb + k] * w) * inv;
    const c = this.chroma, ca = i0 * 12, cb = i1 * 12;
    for (let k = 0; k < 12; k++) out.chroma[k] = (c[ca + k] * (1 - w) + c[cb + k] * w) * inv;
    out.t = t;
    out.bpm = this.bpm;
    out.hasTempo = this.hasTempo;
    const bi = lowerIndex(this.beats, t);
    if (bi >= 0 && bi < this.beats.length - 1) {
      out.beat = bi;
      out.beatPhase = (t - this.beats[bi]) / Math.max(1e-3, this.beats[bi + 1] - this.beats[bi]);
    } else {
      const p = 60 / this.bpm;
      out.beat = Math.floor(t / p);
      out.beatPhase = (t / p) % 1;
    }
    const di = lowerIndex(this.downbeats, t);
    if (di >= 0 && di < this.downbeats.length - 1) {
      out.bar = di;
      out.barPhase = (t - this.downbeats[di]) / Math.max(1e-3, this.downbeats[di + 1] - this.downbeats[di]);
    } else {
      const p = 240 / this.bpm;
      out.bar = Math.floor(t / p);
      out.barPhase = (t / p) % 1;
    }
    out.active = true;
    return out;
  }

  // Events with t0 < time <= t1. pairs = [time, strength] interleaved arrays.
  eventsBetween(pairs, t0, t1, cb) {
    if (t1 <= t0) return;
    let i = lowerIndex(pairs, t0, 2) + 1;
    for (; i < pairs.length / 2 && pairs[i * 2] <= t1; i++) cb(pairs[i * 2], pairs[i * 2 + 1]);
  }

  timesBetween(times, t0, t1, cb) {
    if (t1 <= t0) return;
    let i = lowerIndex(times, t0) + 1;
    for (; i < times.length && times[i] <= t1; i++) cb(times[i], i);
  }

  nextTime(times, t) {
    const i = lowerIndex(times, t) + 1;
    return i < times.length ? times[i] : Infinity;
  }
}
