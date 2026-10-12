// EXP-02 · The chaos fan: N double pendulums released together, their initial angles differing by δ.
// RK4 on the exact equations of motion (m₁ = m₂ = 1, ℓ₁ = ℓ₂ = 1, g = 9.81); energy drift is reported.
import { Instrument, TAU, PAL, MONO } from './base.js';

const G = 9.81;
function deriv(s, o, d) {
  const t1 = s[o], t2 = s[o + 1], w1 = s[o + 2], w2 = s[o + 3];
  const D = t2 - t1, cD = Math.cos(D), sD = Math.sin(D);
  const den1 = 2 - cD * cD; // (m1+m2)ℓ1 − m2ℓ1cos²Δ with unit masses/lengths
  d[0] = w1;
  d[1] = w2;
  d[2] = (w1 * w1 * sD * cD + G * Math.sin(t2) * cD + w2 * w2 * sD - 2 * G * Math.sin(t1)) / den1;
  d[3] = (-w2 * w2 * sD * cD + 2 * (G * Math.sin(t1) * cD - w1 * w1 * sD - G * Math.sin(t2))) / den1;
}
const energy = (t1, t2, w1, w2) => w1 * w1 + 0.5 * w2 * w2 + w1 * w2 * Math.cos(t1 - t2) - 2 * G * Math.cos(t1) - G * Math.cos(t2);

export class Pendulum extends Instrument {
  init() {
    this.get2d();
    this.n = 200; this.delta = 1e-4;
    this.reset();
    this.controls([
      { type: 'chips', value: 200, items: [{ label: '50 个', value: 50 }, { label: '200 个', value: 200 }, { label: '600 个', value: 600 }], onChange: (v) => { this.n = v; this.reset(); } },
      { type: 'chips', value: 1e-4, items: [{ label: 'δ = 10⁻⁴', value: 1e-4 }, { label: 'δ = 10⁻⁷', value: 1e-7 }], onChange: (v) => { this.delta = v; this.reset(); } },
      { type: 'button', label: '重新释放', onClick: () => this.reset() },
    ]);
  }
  reset() {
    const n = this.n;
    this.s = new Float64Array(n * 4);
    this.e0 = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t1 = 2.2 + i * this.delta, t2 = 2.2 + i * this.delta;
      this.s.set([t1, t2, 0, 0], i * 4);
      this.e0[i] = energy(t1, t2, 0, 0);
    }
    this.t = 0;
    this.k = [new Float64Array(4), new Float64Array(4), new Float64Array(4), new Float64Array(4)];
    this.tmp = new Float64Array(4);
    this.clear = true;
    this.readout('n', String(n));
  }
  step(h) {
    const s = this.s, [k1, k2, k3, k4] = this.k, tmp = this.tmp;
    for (let i = 0; i < this.n; i++) {
      const o = i * 4;
      deriv(s, o, k1);
      for (let j = 0; j < 4; j++) tmp[j] = s[o + j] + (h / 2) * k1[j];
      deriv(tmp, 0, k2);
      for (let j = 0; j < 4; j++) tmp[j] = s[o + j] + (h / 2) * k2[j];
      deriv(tmp, 0, k3);
      for (let j = 0; j < 4; j++) tmp[j] = s[o + j] + h * k3[j];
      deriv(tmp, 0, k4);
      for (let j = 0; j < 4; j++) s[o + j] += (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
    }
    this.t += h;
  }
  frame(dt) {
    const sub = 6, h = Math.min(dt, 1 / 30) / sub;
    for (let k = 0; k < sub; k++) this.step(h);
    const ctx = this.ctx, w = this.w, hh = this.h;
    if (this.clear) { ctx.clearRect(0, 0, w, hh); this.clear = false; }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, 0, w, hh);
    ctx.globalCompositeOperation = 'lighter';
    const L = Math.min(w, hh) * 0.22, cx = w / 2, cy = hh * 0.44;
    const s = this.s, n = this.n;
    const alpha = Math.min(0.5, 30 / n + 0.05);
    let spread = 0, eErr = 0;
    for (let i = 0; i < n; i++) {
      const t1 = s[i * 4], t2 = s[i * 4 + 1];
      const x1 = cx + L * Math.sin(t1), y1 = cy + L * Math.cos(t1);
      const x2 = x1 + L * Math.sin(t2), y2 = y1 + L * Math.cos(t2);
      const hue = 18 + (i / n) * 200;
      ctx.strokeStyle = `hsla(${hue}, 95%, 60%, ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const d = Math.abs(Math.atan2(Math.sin(t2 - s[1]), Math.cos(t2 - s[1])));
      if (d > spread) spread = d;
      const e = Math.abs(energy(t1, t2, s[i * 4 + 2], s[i * 4 + 3]) - this.e0[i]) / Math.abs(this.e0[i] || 1);
      if (e > eErr) eErr = e;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
    ctx.clearRect(8, 6, 230, 18);
    ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2;
    ctx.fillText(`t = ${this.t.toFixed(2)} s   N = ${n}   δ = ${this.delta.toExponential(0)} rad`, 12, 19);
    if (Math.floor(this.t * 10) !== this._lastR) {
      this._lastR = Math.floor(this.t * 10);
      this.readout('t', `${this.t.toFixed(1)} s`);
      this.readout('spread', `${((spread * 180) / Math.PI).toFixed(1)}°`);
      this.readout('energy', eErr.toExponential(1));
    }
    if (this.t > 40) this.reset();
  }
}
