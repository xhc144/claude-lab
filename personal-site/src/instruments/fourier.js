// 01 · Analysis — Fourier epicycles. γ(t) = Σ c_n e^{int}; the circles are sorted by |c_n| and the
// L² error of the truncation is computed exactly from Parseval: ‖γ − γ_N‖² = Σ_{dropped} |c_n|².
import { Instrument, TAU, PAL, MONO } from './base.js';

const M = 1024;

function polygon(verts) {
  const segs = verts.map((v, i) => [v, verts[(i + 1) % verts.length]]);
  const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const total = lens.reduce((s, l) => s + l, 0);
  const pts = [];
  for (let k = 0; k < M; k++) {
    let d = (k / M) * total, i = 0;
    while (d > lens[i]) { d -= lens[i]; i++; }
    const [a, b] = segs[i], t = d / lens[i];
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

const SHAPES = {
  trefoil: () => Array.from({ length: M }, (_, k) => { const t = (k / M) * TAU; return [Math.sin(t) + 2 * Math.sin(2 * t), -(Math.cos(t) - 2 * Math.cos(2 * t))]; }),
  square: () => polygon([[-1, -1], [1, -1], [1, 1], [-1, 1]]),
  star: () => polygon(Array.from({ length: 7 }, (_, k) => { const a = (k * 3 / 7) * TAU - Math.PI / 2; return [Math.cos(a), Math.sin(a)]; })),
};

function dft(pts) {
  const out = [];
  for (let n = -M / 2; n < M / 2; n++) {
    let re = 0, im = 0;
    for (let k = 0; k < M; k++) {
      const a = (-TAU * n * k) / M;
      const c = Math.cos(a), s = Math.sin(a);
      re += pts[k][0] * c - pts[k][1] * s;
      im += pts[k][0] * s + pts[k][1] * c;
    }
    out.push({ n, re: re / M, im: im / M, amp: Math.hypot(re, im) / M });
  }
  return out;
}

export class Fourier extends Instrument {
  init() {
    this.get2d();
    this.N = 24;
    this.cache = {};
    this.setShape('trefoil');
    this.controls([
      { type: 'chips', value: 'trefoil', items: [{ label: '三叶结投影', value: 'trefoil' }, { label: '正方形', value: 'square' }, { label: '七角星', value: 'star' }], onChange: (v) => this.setShape(v) },
      { type: 'range', label: 'N', min: 1, max: 160, step: 1, value: this.N, onInput: (v) => { this.N = v; this.build(); } },
    ]);
  }
  setShape(name) {
    this.shapeName = name;
    if (!this.cache[name]) {
      const pts = SHAPES[name]();
      const coef = dft(pts);
      const c0 = coef.find((c) => c.n === 0);
      const rest = coef.filter((c) => c.n !== 0).sort((a, b) => b.amp - a.amp);
      this.cache[name] = { pts, c0, rest, energy: rest.reduce((s, c) => s + c.amp * c.amp, 0) };
    }
    this.data = this.cache[name];
    this.trail = [];
    this.build();
  }
  build() {
    const { rest, energy } = this.data;
    const used = rest.slice(0, this.N);
    const kept = used.reduce((s, c) => s + c.amp * c.amp, 0);
    this.err = Math.sqrt(Math.max(0, energy - kept));
    this.terms = used.filter((c) => c.amp > 1e-9).length;
    this.approx = Array.from({ length: 400 }, (_, k) => this.eval((k / 400) * TAU, used));
  }
  eval(t, terms) {
    let x = this.data.c0.re, y = this.data.c0.im;
    for (const c of terms) { const a = c.n * t; x += c.re * Math.cos(a) - c.im * Math.sin(a); y += c.re * Math.sin(a) + c.im * Math.cos(a); }
    return [x, y];
  }
  frame(dt, time) {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    const { pts } = this.data;
    let ext = 0;
    for (const p of pts) ext = Math.max(ext, Math.abs(p[0]), Math.abs(p[1]));
    const S = (Math.min(w, h) * 0.38) / ext;
    const cx = w / 2, cy = h / 2 + 6;
    const X = (p) => [cx + p[0] * S, cy + p[1] * S];
    // target
    ctx.strokeStyle = PAL.line; ctx.lineWidth = 1;
    ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = X(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
    // approximation
    ctx.strokeStyle = 'rgba(255,91,31,0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); this.approx.forEach((p, i) => { const [x, y] = X(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
    // epicycles
    const t = (time * TAU) / 9;
    let x = this.data.c0.re, y = this.data.c0.im;
    const used = this.data.rest.slice(0, this.N);
    ctx.lineWidth = 1;
    for (let k = 0; k < used.length; k++) {
      const c = used[k];
      const [px, py] = X([x, y]);
      const r = c.amp * S;
      if (r > 0.6) {
        ctx.strokeStyle = `rgba(79,227,255,${0.08 + 0.3 * Math.exp(-k / 8)})`;
        ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke();
      }
      const a = c.n * t;
      x += c.re * Math.cos(a) - c.im * Math.sin(a); y += c.re * Math.sin(a) + c.im * Math.cos(a);
      const [qx, qy] = X([x, y]);
      ctx.strokeStyle = `rgba(236,232,225,${0.25 + 0.5 * Math.exp(-k / 6)})`;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
    }
    const tip = X([x, y]);
    this.trail.push(tip);
    if (this.trail.length > 160) this.trail.shift();
    for (let i = 1; i < this.trail.length; i++) {
      ctx.strokeStyle = `rgba(255,190,150,${i / this.trail.length})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(...this.trail[i - 1]); ctx.lineTo(...this.trail[i]); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tip[0], tip[1], 3, 0, TAU); ctx.fill();
    ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2;
    ctx.fillText(`非零项 ${this.terms}   L² 误差 ${this.err < 1e-6 ? '0（精确）' : this.err.toFixed(4)}`, 12, 20);
  }
}
