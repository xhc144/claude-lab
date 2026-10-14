// Causal analyser for live input (system loopback / microphone). Produces the same frame
// structure as TrackAnalysis.sample(), with adaptive gain instead of whole-track statistics.
import { makeBandMap, bandPowers, NB } from './analysis.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class LiveAnalyzer {
  constructor(analyser, sampleRate) {
    this.an = analyser;
    this.n = analyser.fftSize;
    this.map = makeBandMap(this.n, sampleRate);
    this.db = new Float32Array(this.n / 2);
    this.time = new Float32Array(this.n);
    this.power = new Float64Array(this.n / 2 + 1);
    this.bands = new Float64Array(NB);
    this.macro = new Float64Array(6);
    this.bandHi = new Float32Array(NB).fill(-60);
    this.macroHi = new Float32Array(6).fill(-50);
    this.rmsHi = -30;
    this.spec = new Float32Array(NB);
    this.macroV = new Float32Array(6);
    this.prevLog = new Float32Array(this.n / 2 + 1);
    this.flux = { kick: 0, snare: 0, hat: 0, full: 0 };
    this.fluxMean = { kick: 0.05, snare: 0.05, hat: 0.05, full: 0.05 };
    this.fluxPeak = { kick: 0.2, snare: 0.2, hat: 0.2, full: 0.2 };
    this.lastOnset = { kick: -9, snare: -9, hat: -9, full: -9 };
    this.env = { kick: 0, snare: 0, hat: 0, full: 0 };
    this.kickTimes = [];
    this.iShort = 0; this.iLong = 0; this.lastDrop = -99; this.dropEnv = 0;
    this.rms = 0; this.intensity = 0; this.centroid = 0;
    this.time0 = performance.now() / 1000;
    this.events = [];
    const bin = sampleRate / this.n;
    this.ranges = {
      kick: [Math.max(1, Math.round(40 / bin)), Math.round(150 / bin)],
      snare: [Math.round(200 / bin), Math.round(5000 / bin)],
      hat: [Math.round(6000 / bin), Math.min(this.n / 2, Math.round(16000 / bin))],
      full: [1, Math.min(this.n / 2, Math.round(16000 / bin))]
    };
  }

  update(dt, out) {
    dt = Math.max(1 / 240, Math.min(0.1, dt));
    const now = performance.now() / 1000 - this.time0;
    this.events.length = 0;
    this.an.getFloatFrequencyData(this.db);
    this.an.getFloatTimeDomainData(this.time);
    const half = this.n / 2;
    for (let k = 0; k < half; k++) {
      const d = this.db[k];
      this.power[k] = d > -199 ? Math.pow(10, d / 10) : 0;
    }
    this.power[half] = 0;
    bandPowers(this.power, this.map, this.bands, this.macro);
    const decay = 3 * dt; // dB per frame the peak follower falls
    const att = 1 - Math.exp(-dt / 0.012), rel = 1 - Math.exp(-dt / 0.13);
    let gHi = -200;
    for (let b = 0; b < NB; b++) gHi = Math.max(gHi, this.bandHi[b]);
    for (let b = 0; b < NB; b++) {
      const db = 10 * Math.log10(this.bands[b] + 1e-14);
      this.bandHi[b] = Math.max(db, this.bandHi[b] - decay, -95);
      const rg = 40;
      const v = 0.62 * clamp01((db - (this.bandHi[b] - rg)) / rg) + 0.38 * clamp01((db - (gHi - 45)) / 45);
      const x = Math.pow(v, 1.5);
      this.spec[b] += (x - this.spec[b]) * (x > this.spec[b] ? att : rel);
      out.spectrum[b] = this.spec[b];
    }
    const keys = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble'];
    for (let m = 0; m < 6; m++) {
      const db = 10 * Math.log10(this.macro[m] + 1e-14);
      this.macroHi[m] = Math.max(db, this.macroHi[m] - decay * 0.8, -85);
      const x = Math.pow(clamp01((db - (this.macroHi[m] - 32)) / 32), 1.3);
      const r = m < 2 ? 1 - Math.exp(-dt / 0.18) : rel;
      this.macroV[m] += (x - this.macroV[m]) * (x > this.macroV[m] ? att : r);
      out[keys[m]] = this.macroV[m];
    }
    let s2 = 0;
    for (let i = this.n - 1024; i < this.n; i++) s2 += this.time[i] * this.time[i];
    const rdb = 10 * Math.log10(s2 / 1024 + 1e-12);
    this.rmsHi = Math.max(rdb, this.rmsHi - decay * 0.6, -70);
    const rv = clamp01((rdb - (this.rmsHi - 30)) / 30);
    this.rms += (rv - this.rms) * (rv > this.rms ? 1 - Math.exp(-dt / 0.02) : 1 - Math.exp(-dt / 0.3));
    out.rms = this.rms;
    // centroid
    let ps = 0, pf = 0;
    for (let k = 1; k < this.map.maxK; k++) { ps += this.power[k]; pf += this.power[k] * k; }
    const c = ps > 0 ? clamp01(Math.log2(((pf / ps) * this.map.binHz) / 250) / Math.log2(9000 / 250)) : 0;
    this.centroid += (c - this.centroid) * (1 - Math.exp(-dt / 0.3));
    out.centroid = this.centroid;
    // spectral flux onsets
    const fl = { kick: 0, snare: 0, hat: 0, full: 0 };
    for (let k = 1; k < half; k++) {
      const L = Math.log1p(Math.sqrt(this.power[k]) * 400);
      const d = L - this.prevLog[k];
      this.prevLog[k] = L;
      if (d <= 0) continue;
      for (const key in this.ranges) {
        const r = this.ranges[key];
        if (k >= r[0] && k <= r[1]) fl[key] += d;
      }
    }
    const gaps = { kick: 0.11, snare: 0.1, hat: 0.06, full: 0.07 };
    const taus = { kick: 0.15, snare: 0.13, hat: 0.07, full: 0.12 };
    for (const key in fl) {
      const v = fl[key];
      this.fluxPeak[key] = Math.max(v, this.fluxPeak[key] * Math.exp(-dt / 6));
      const nv = v / (this.fluxPeak[key] + 1e-9);
      const mean = this.fluxMean[key];
      this.fluxMean[key] += (nv - mean) * (1 - Math.exp(-dt / 0.3));
      this.env[key] *= Math.exp(-dt / taus[key]);
      const thr = mean * 1.6 + 0.12;
      const gate = key !== 'kick' || this.macroV[1] > 0.25 || this.macroV[0] > 0.25;
      if (nv > thr && gate && now - this.lastOnset[key] > gaps[key]) {
        const s = clamp01((nv - thr) * 1.6 + 0.35);
        this.env[key] = Math.max(this.env[key], s);
        this.lastOnset[key] = now;
        this.events.push({ type: key, strength: s });
        if (key === 'kick') {
          this.kickTimes.push(now);
          if (this.kickTimes.length > 24) this.kickTimes.shift();
        }
      }
    }
    out.kick = this.env.kick; out.snare = this.env.snare; out.hat = this.env.hat; out.onset = this.env.full;
    out.flux = clamp01(fl.full / (this.fluxPeak.full + 1e-9));
    // tempo from kick intervals
    let bpm = 120;
    if (this.kickTimes.length > 6) {
      const iv = [];
      for (let i = 1; i < this.kickTimes.length; i++) {
        let d = this.kickTimes[i] - this.kickTimes[i - 1];
        while (d < 0.33) d *= 2;
        while (d > 0.86) d /= 2;
        iv.push(d);
      }
      iv.sort((a, b) => a - b);
      bpm = 60 / iv[iv.length >> 1];
    }
    const lastK = this.kickTimes.length ? this.kickTimes[this.kickTimes.length - 1] : 0;
    const per = 60 / bpm;
    const ph = (now - lastK) / per;
    out.bpm = bpm;
    out.hasTempo = this.kickTimes.length > 6 && now - lastK < 4;
    out.beatPhase = ph % 1;
    out.beat = Math.floor(now / per);
    out.bar = Math.floor(out.beat / 4);
    out.barPhase = ((now / per) % 4) / 4;
    // intensity / drops
    const raw = 0.55 * this.rms + 0.3 * this.macroV[1] + 0.15 * this.macroV[5];
    this.iShort += (raw - this.iShort) * (1 - Math.exp(-dt / 0.6));
    this.iLong += (raw - this.iLong) * (1 - Math.exp(-dt / 6));
    this.intensity += (this.iShort - this.intensity) * (1 - Math.exp(-dt / 0.8));
    out.intensity = clamp01(this.intensity * 1.2);
    this.dropEnv *= Math.exp(-dt / 2.5);
    if (this.iShort - this.iLong > 0.18 && this.iShort > 0.5 && now - this.lastDrop > 16) {
      this.lastDrop = now; this.dropEnv = 1;
      this.events.push({ type: 'drop', strength: 1 });
    }
    out.drop = this.dropEnv;
    out.build = 0;
    for (let i = 0; i < 12; i++) out.chroma[i] = 0;
    out.t = now;
    out.active = this.rms > 0.02;
    return out;
  }
}
