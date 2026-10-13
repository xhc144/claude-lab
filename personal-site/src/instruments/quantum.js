// EXP-04 · The time-dependent Schrödinger equation (ħ = m = 1) by the split-step Fourier method:
//   ψ ← e^{−iVΔt/2} · F⁻¹[ e^{−ik²Δt/2} · F[ e^{−iVΔt/2} ψ ] ]
// 1-D: a Gaussian packet meets a rectangular barrier (tunnelling). 2-D: a packet through a double slit.
// Smooth absorbing layers at the edges stop the periodic FFT from wrapping the wave around; whatever
// they absorb is booked as transmitted or reflected, so T + R stays a faithful account of the norm.
import { Instrument, TAU, PAL, MONO } from './base.js';
import { makeFFT } from './fft.js';

const N1 = 1024, L1 = 240;
const N2 = 128, L2 = 64;

function phaseColor(re, im) {
  const h = Math.atan2(im, re) / TAU;
  return [0.5 + 0.5 * Math.cos(TAU * h), 0.5 + 0.5 * Math.cos(TAU * (h + 0.667)), 0.5 + 0.5 * Math.cos(TAU * (h + 0.333))];
}

export class Quantum extends Instrument {
  init() {
    this.get2d();
    this.mode = '1d';
    this.V0 = 1.4; this.k0 = 1.6;
    this.fft1 = makeFFT(N1);
    this.fft2 = makeFFT(N2);
    this.reset();
    this.controls([
      { type: 'chips', value: '1d', items: [{ label: '一维 · 隧穿', value: '1d' }, { label: '二维 · 双缝', value: '2d' }], onChange: (v) => { this.mode = v; this.reset(); } },
      { type: 'range', label: 'V₀', min: 0.4, max: 2.6, step: 0.05, value: this.V0, format: (v) => v.toFixed(2), onInput: (v) => { this.V0 = v; if (this.mode === '1d') this.reset(); } },
      { type: 'button', label: '重新发射', onClick: () => this.reset() },
    ]);
    this.pointer({ down: () => { this.reset(); return false; } });
  }

  reset() {
    this.t = 0; this.absL = 0; this.absR = 0;
    if (this.mode === '1d') this.reset1d(); else this.reset2d();
  }

  // ---------- 1-D ----------
  reset1d() {
    const dx = L1 / N1;
    this.re = new Float64Array(N1); this.im = new Float64Array(N1);
    this.V = new Float64Array(N1); this.mask = new Float64Array(N1);
    const x0 = 70, s = 6, k0 = this.k0;
    this.bx0 = 118; this.bx1 = 120;
    let norm = 0;
    for (let j = 0; j < N1; j++) {
      const x = j * dx;
      const g = Math.exp(-((x - x0) ** 2) / (4 * s * s));
      this.re[j] = g * Math.cos(k0 * x); this.im[j] = g * Math.sin(k0 * x);
      norm += g * g * dx;
      this.V[j] = x >= this.bx0 && x < this.bx1 ? this.V0 : 0;
      const edge = Math.min(x, L1 - x);
      this.mask[j] = edge < 22 ? Math.pow(Math.sin((Math.PI / 2) * (edge / 22)), 0.12) : 1;
    }
    const k = 1 / Math.sqrt(norm);
    for (let j = 0; j < N1; j++) { this.re[j] *= k; this.im[j] *= k; }
    this.kk = new Float64Array(N1);
    for (let j = 0; j < N1; j++) { const m = j < N1 / 2 ? j : j - N1; this.kk[j] = (TAU * m) / L1; }
    this.dt = 0.06;
    this.prep1d();
  }
  prep1d() {
    const dt = this.dt;
    this.vr = Float64Array.from(this.V, (v) => Math.cos(-v * dt / 2)); this.vi = Float64Array.from(this.V, (v) => Math.sin(-v * dt / 2));
    this.kr = Float64Array.from(this.kk, (k) => Math.cos(-k * k * dt / 2)); this.ki = Float64Array.from(this.kk, (k) => Math.sin(-k * k * dt / 2));
  }
  step1d() {
    const re = this.re, im = this.im, n = N1, dx = L1 / N1;
    for (let j = 0; j < n; j++) { const a = re[j], b = im[j]; re[j] = a * this.vr[j] - b * this.vi[j]; im[j] = a * this.vi[j] + b * this.vr[j]; }
    this.fft1(re, im, false);
    for (let j = 0; j < n; j++) { const a = re[j], b = im[j]; re[j] = a * this.kr[j] - b * this.ki[j]; im[j] = a * this.ki[j] + b * this.kr[j]; }
    this.fft1(re, im, true);
    for (let j = 0; j < n; j++) { const a = re[j], b = im[j]; re[j] = a * this.vr[j] - b * this.vi[j]; im[j] = a * this.vi[j] + b * this.vr[j]; }
    for (let j = 0; j < n; j++) {
      const m = this.mask[j];
      if (m < 1) {
        const p = (re[j] * re[j] + im[j] * im[j]) * dx;
        const lost = p * (1 - m * m);
        if (j * dx < L1 / 2) this.absL += lost; else this.absR += lost;
        re[j] *= m; im[j] *= m;
      }
    }
    this.t += this.dt;
  }
  draw1d() {
    const ctx = this.ctx, w = this.w, h = this.h, dx = L1 / N1;
    ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, w, h);
    const base = h * 0.78, amp = h * 2.6;
    const X = (x) => (x / L1) * w;
    // barrier
    const bh = (this.V0 / (this.k0 * this.k0 / 2)) * h * 0.22;
    ctx.fillStyle = 'rgba(255,91,31,0.22)'; ctx.strokeStyle = PAL.signal;
    ctx.fillRect(X(this.bx0), base - bh, X(this.bx1) - X(this.bx0), bh); ctx.strokeRect(X(this.bx0), base - bh, X(this.bx1) - X(this.bx0), bh);
    // E line
    const eh = h * 0.22;
    ctx.strokeStyle = PAL.ink3; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(0, base - eh); ctx.lineTo(w, base - eh); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `10px ${MONO}`; ctx.fillStyle = PAL.ink3; ctx.fillText('⟨E⟩ = k₀²/2', 8, base - eh - 5);
    ctx.fillStyle = PAL.signal; ctx.fillText(`V₀ = ${this.V0.toFixed(2)}`, X(this.bx1) + 6, base - bh + 10);
    // |ψ|² coloured by phase
    const step = Math.max(1, Math.floor(N1 / w));
    for (let j = 0; j < N1; j += step) {
      const p = this.re[j] ** 2 + this.im[j] ** 2;
      const [r, g, b] = phaseColor(this.re[j], this.im[j]);
      ctx.fillStyle = `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`;
      const x = X(j * dx), hh = p * amp;
      ctx.fillRect(x, base - hh, Math.max(1, (w / N1) * step + 0.5), hh);
    }
    ctx.strokeStyle = 'rgba(236,232,225,0.55)'; ctx.beginPath();
    for (let j = 0; j < N1; j += step) { const x = X(j * dx), y = base - this.re[j] * Math.sqrt(amp) * 3.2; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = PAL.line; ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(w, base); ctx.stroke();
    // T and R
    let left = 0, right = 0;
    const mid = (this.bx0 + this.bx1) / 2;
    for (let j = 0; j < N1; j++) { const p = (this.re[j] ** 2 + this.im[j] ** 2) * dx; if (j * dx < mid) left += p; else right += p; }
    const T = right + this.absR, R = left + this.absL;
    ctx.fillStyle = PAL.ink2; ctx.font = `11px ${MONO}`;
    ctx.fillText(`t = ${this.t.toFixed(1)}   k₀ = ${this.k0}   点击画面重新发射`, 12, 18);
    if (this.t > 0.5) { this.readout('T', `${(T * 100).toFixed(1)}%`); this.readout('R', `${(R * 100).toFixed(1)}%`); this.readout('norm', (T + R).toFixed(4)); }
    if (this.t > 110) this.reset();
  }

  // ---------- 2-D ----------
  reset2d() {
    const n = N2, dx = L2 / n;
    this.re = new Float64Array(n * n); this.im = new Float64Array(n * n);
    this.V = new Float64Array(n * n); this.mask = new Float64Array(n * n);
    const x0 = 14, y0 = L2 / 2, s = 3.2, k0 = 2.4;
    this.wall = 26; this.wallW = 1.2; this.slitHalf = 1.1; this.sep = 7;
    let norm = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * dx, y = j * dx, id = j * n + i;
      const g = Math.exp(-((x - x0) ** 2 + (y - y0) ** 2) / (4 * s * s));
      this.re[id] = g * Math.cos(k0 * x); this.im[id] = g * Math.sin(k0 * x);
      norm += g * g * dx * dx;
      const inWall = x >= this.wall && x < this.wall + this.wallW;
      const inSlit = Math.abs(Math.abs(y - y0) - this.sep / 2) < this.slitHalf;
      this.V[id] = inWall && !inSlit ? 60 : 0;
      const e = Math.min(x, L2 - x, y, L2 - y);
      this.mask[id] = e < 7 ? Math.pow(Math.sin((Math.PI / 2) * (e / 7)), 0.2) : 1;
    }
    const k = 1 / Math.sqrt(norm);
    for (let id = 0; id < n * n; id++) { this.re[id] *= k; this.im[id] *= k; }
    this.dt = 0.05;
    const kk = new Float64Array(n);
    for (let j = 0; j < n; j++) { const m = j < n / 2 ? j : j - n; kk[j] = (TAU * m) / L2; }
    this.vr = Float64Array.from(this.V, (v) => Math.cos(-v * this.dt / 2)); this.vi = Float64Array.from(this.V, (v) => Math.sin(-v * this.dt / 2));
    this.kr = new Float64Array(n * n); this.ki = new Float64Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const e = (kk[i] ** 2 + kk[j] ** 2) / 2; this.kr[j * n + i] = Math.cos(-e * this.dt); this.ki[j * n + i] = Math.sin(-e * this.dt); }
    this.img = new ImageData(n, n);
    this.off = document.createElement('canvas'); this.off.width = n; this.off.height = n;
  }
  fft2d(inverse) {
    const n = N2;
    for (let j = 0; j < n; j++) this.fft2(this.re, this.im, inverse, j * n, 1);
    for (let i = 0; i < n; i++) this.fft2(this.re, this.im, inverse, i, n);
  }
  step2d() {
    const re = this.re, im = this.im, n2 = N2 * N2, dA = (L2 / N2) ** 2;
    const mulV = () => { for (let id = 0; id < n2; id++) { const a = re[id], b = im[id]; re[id] = a * this.vr[id] - b * this.vi[id]; im[id] = a * this.vi[id] + b * this.vr[id]; } };
    mulV();
    this.fft2d(false);
    for (let id = 0; id < n2; id++) { const a = re[id], b = im[id]; re[id] = a * this.kr[id] - b * this.ki[id]; im[id] = a * this.ki[id] + b * this.kr[id]; }
    this.fft2d(true);
    mulV();
    for (let id = 0; id < n2; id++) {
      const m = this.mask[id];
      if (m < 1) {
        const lost = (re[id] ** 2 + im[id] ** 2) * dA * (1 - m * m);
        if ((id % N2) * (L2 / N2) > this.wall) this.absR += lost; else this.absL += lost;
        re[id] *= m; im[id] *= m;
      }
    }
    this.t += this.dt;
  }
  draw2d() {
    const ctx = this.ctx, w = this.w, h = this.h, n = N2, d = this.img.data;
    let max = 1e-9;
    for (let id = 0; id < n * n; id++) max = Math.max(max, this.re[id] ** 2 + this.im[id] ** 2);
    for (let id = 0; id < n * n; id++) {
      const p = (this.re[id] ** 2 + this.im[id] ** 2) / max;
      const b = Math.pow(p, 0.42);
      const [r, g, bl] = phaseColor(this.re[id], this.im[id]);
      const k = id * 4;
      const wall = this.V[id] > 0;
      d[k] = wall ? 120 : r * b * 255; d[k + 1] = wall ? 40 : g * b * 255; d[k + 2] = wall ? 20 : bl * b * 255; d[k + 3] = 255;
    }
    this.off.getContext('2d').putImageData(this.img, 0, 0);
    ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, w, h);
    const side = Math.min(w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.off, (w - side) / 2, (h - side) / 2, side, side);
    ctx.strokeStyle = PAL.line; ctx.strokeRect((w - side) / 2 + 0.5, (h - side) / 2 + 0.5, side - 1, side - 1);
    let right = 0;
    const dA = (L2 / n) ** 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (i * (L2 / n) > this.wall) right += (this.re[j * n + i] ** 2 + this.im[j * n + i] ** 2) * dA;
    ctx.fillStyle = PAL.ink2; ctx.font = `11px ${MONO}`;
    ctx.fillText(`t = ${this.t.toFixed(1)}   128×128 网格 · 双缝间距 7 · 点击重新发射`, 12, 18);
    if (this.t > 0.5) { this.readout('T', `${((right + this.absR) * 100).toFixed(1)}%`); this.readout('R', '—'); this.readout('norm', '—'); }
    if (this.t > 34) this.reset();
  }

  frame() {
    if (this.mode === '1d') { for (let k = 0; k < 3; k++) this.step1d(); this.draw1d(); }
    else { for (let k = 0; k < 2; k++) this.step2d(); this.draw2d(); }
  }
}
