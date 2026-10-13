// EXP-05 · A 2 → 16 → 16 → 1 multilayer perceptron (tanh, sigmoid output, binary cross-entropy),
// trained in the browser with full-batch Adam. Hand-written forward and backward passes — no library.
import { Instrument, TAU, PAL, MONO } from './base.js';
import { mulberry32, gaussian } from '../core/rng.js';

const H = 16;

function dataset(name, rand) {
  const pts = [];
  const n = 150;
  for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) {
    let x, y;
    if (name === 'spiral') {
      const t = 0.08 + (i / n) * 0.92, a = t * 2.6 * Math.PI + c * Math.PI;
      x = t * Math.cos(a) * 0.95 + gaussian(rand) * 0.035; y = t * Math.sin(a) * 0.95 + gaussian(rand) * 0.035;
    } else if (name === 'circle') {
      const r = c ? Math.sqrt(rand()) * 0.42 : 0.6 + rand() * 0.35, a = rand() * TAU;
      x = r * Math.cos(a); y = r * Math.sin(a);
    } else if (name === 'xor') {
      x = (rand() * 0.85 + 0.08) * (rand() < 0.5 ? -1 : 1); y = (rand() * 0.85 + 0.08) * (rand() < 0.5 ? -1 : 1);
      pts.push([x, y, x * y > 0 ? 1 : 0]);
      continue;
    } else {
      const a = (i / n) * Math.PI;
      x = c ? Math.cos(a) * 0.6 - 0.3 : 0.3 - Math.cos(a) * 0.6; y = c ? Math.sin(a) * 0.6 - 0.15 : 0.15 - Math.sin(a) * 0.6;
      x += gaussian(rand) * 0.06; y += gaussian(rand) * 0.06;
    }
    pts.push([x, y, c]);
  }
  return pts;
}

class Net {
  constructor(seed) {
    const rand = mulberry32(seed);
    const init = (n, fanIn, fanOut) => Float64Array.from({ length: n }, () => gaussian(rand) * Math.sqrt(2 / (fanIn + fanOut)));
    this.p = { W1: init(H * 2, 2, H), b1: new Float64Array(H), W2: init(H * H, H, H), b2: new Float64Array(H), W3: init(H, H, 1), b3: new Float64Array(1) };
    this.m = {}; this.v = {};
    for (const k in this.p) { this.m[k] = new Float64Array(this.p[k].length); this.v[k] = new Float64Array(this.p[k].length); }
    this.t = 0;
    this.a1 = new Float64Array(H); this.a2 = new Float64Array(H);
  }
  forward(x, y, keep) {
    const { W1, b1, W2, b2, W3, b3 } = this.p;
    const a1 = keep ? keep.a1 : this.a1, a2 = keep ? keep.a2 : this.a2;
    for (let i = 0; i < H; i++) a1[i] = Math.tanh(W1[i * 2] * x + W1[i * 2 + 1] * y + b1[i]);
    for (let i = 0; i < H; i++) { let s = b2[i]; for (let j = 0; j < H; j++) s += W2[i * H + j] * a1[j]; a2[i] = Math.tanh(s); }
    let z = b3[0];
    for (let j = 0; j < H; j++) z += W3[j] * a2[j];
    return 1 / (1 + Math.exp(-z));
  }
  step(data, lr = 0.02) {
    const { W2, W3 } = this.p;
    const g = {}; for (const k in this.p) g[k] = new Float64Array(this.p[k].length);
    const a1 = new Float64Array(H), a2 = new Float64Array(H), d2 = new Float64Array(H), d1 = new Float64Array(H);
    let loss = 0, correct = 0;
    const P = data.length;
    for (const [x, y, c] of data) {
      const out = this.forward(x, y, { a1, a2 });
      loss += -(c * Math.log(out + 1e-12) + (1 - c) * Math.log(1 - out + 1e-12));
      if ((out > 0.5 ? 1 : 0) === c) correct++;
      const dz3 = (out - c) / P;
      g.b3[0] += dz3;
      for (let j = 0; j < H; j++) { g.W3[j] += dz3 * a2[j]; d2[j] = dz3 * W3[j] * (1 - a2[j] * a2[j]); }
      for (let i = 0; i < H; i++) { g.b2[i] += d2[i]; for (let j = 0; j < H; j++) g.W2[i * H + j] += d2[i] * a1[j]; }
      for (let j = 0; j < H; j++) { let s = 0; for (let i = 0; i < H; i++) s += W2[i * H + j] * d2[i]; d1[j] = s * (1 - a1[j] * a1[j]); }
      for (let i = 0; i < H; i++) { g.W1[i * 2] += d1[i] * x; g.W1[i * 2 + 1] += d1[i] * y; g.b1[i] += d1[i]; }
    }
    this.t++;
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    for (const k in this.p) {
      const p = this.p[k], m = this.m[k], v = this.v[k], gk = g[k];
      for (let i = 0; i < p.length; i++) {
        m[i] = b1 * m[i] + (1 - b1) * gk[i];
        v[i] = b2 * v[i] + (1 - b2) * gk[i] * gk[i];
        const mh = m[i] / (1 - b1 ** this.t), vh = v[i] / (1 - b2 ** this.t);
        p[i] -= (lr * mh) / (Math.sqrt(vh) + eps);
      }
    }
    return { loss: loss / P, acc: correct / P };
  }
}

export class Mlp extends Instrument {
  init() {
    this.get2d();
    this.name = 'spiral'; this.seed = 1; this.paused = false;
    this.reset();
    this.controls([
      { type: 'chips', value: 'spiral', items: [{ label: '双螺旋', value: 'spiral' }, { label: '同心圆', value: 'circle' }, { label: '异或', value: 'xor' }, { label: '双月', value: 'moons' }], onChange: (v) => { this.name = v; this.reset(); } },
      { type: 'button', label: '重新初始化', onClick: () => { this.seed++; this.reset(); } },
      { type: 'button', label: '暂停 / 继续', onClick: () => { this.paused = !this.paused; } },
    ]);
    this.probe = null;
    this.pointer({ hover: (x, y) => { this.probe = this.toData(x, y); }, leave: () => { this.probe = null; } });
  }
  reset() {
    this.data = dataset(this.name, mulberry32(7 + this.name.length));
    this.net = new Net(this.seed * 97 + this.name.length);
    this.hist = []; this.stats = { loss: NaN, acc: 0 }; this.frameN = 0;
    this.grid = 46;
    this.heat = new ImageData(this.grid, this.grid);
    this.off = document.createElement('canvas'); this.off.width = this.off.height = this.grid;
  }
  layout() {
    const wide = this.w > this.h * 1.25;
    const side = wide ? this.h - 24 : Math.min(this.w, this.h) - 24;
    return { wide, side, x0: 12, y0: 12 };
  }
  toData(x, y) {
    const { side, x0, y0 } = this.layout();
    const u = ((x - x0) / side) * 2 - 1, v = -(((y - y0) / side) * 2 - 1);
    return Math.abs(u) <= 1 && Math.abs(v) <= 1 ? [u, v] : null;
  }
  frame() {
    if (!this.paused && this.net.t < 6000) {
      for (let k = 0; k < 8; k++) this.stats = this.net.step(this.data);
      if (this.net.t % 16 === 0) this.hist.push(this.stats.loss);
    }
    this.frameN++;
    const ctx = this.ctx, w = this.w, h = this.h;
    const { wide, side, x0, y0 } = this.layout();
    ctx.clearRect(0, 0, w, h);
    if (this.frameN % 3 === 1) {
      const G = this.grid, d = this.heat.data;
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const p = this.net.forward((i / (G - 1)) * 2 - 1, -((j / (G - 1)) * 2 - 1));
        const k = (j * G + i) * 4, a = Math.abs(p - 0.5) * 2;
        d[k] = 20 + (p > 0.5 ? 235 * a : 59 * a); d[k + 1] = 20 + (p > 0.5 ? 71 * a : 207 * a); d[k + 2] = 26 + (p > 0.5 ? 11 * a : 229 * a); d[k + 3] = 255;
      }
      this.off.getContext('2d').putImageData(this.heat, 0, 0);
    }
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.off, x0, y0, side, side);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PAL.line; ctx.strokeRect(x0 + 0.5, y0 + 0.5, side, side);
    for (const [x, y, c] of this.data) {
      const px = x0 + ((x + 1) / 2) * side, py = y0 + ((1 - y) / 2) * side;
      ctx.fillStyle = c ? PAL.signal : PAL.ion;
      ctx.beginPath(); ctx.arc(px, py, 2.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
    }
    // network diagram
    if (wide) {
      const nx = x0 + side + 26, nw = w - nx - 16;
      const probe = this.probe || [Math.cos(this.time * 0.6) * 0.6, Math.sin(this.time * 0.6) * 0.6];
      const a1 = new Float64Array(H), a2 = new Float64Array(H);
      const out = this.net.forward(probe[0], probe[1], { a1, a2 });
      const ppx = x0 + ((probe[0] + 1) / 2) * side, ppy = y0 + ((1 - probe[1]) / 2) * side;
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(ppx, ppy, 6, 0, TAU); ctx.stroke();
      const cols = [2, H, H, 1].map((n, c) => Array.from({ length: n }, (_, i) => [nx + (c / 3) * nw, y0 + 20 + ((i + 0.5) / n) * (side - 40)]));
      const acts = [[probe[0], probe[1]], a1, a2, [out * 2 - 1]];
      const { W1, W2, W3 } = this.net.p;
      const Ws = [(i, j) => W1[i * 2 + j], (i, j) => W2[i * H + j], (i, j) => W3[j]];
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < cols[c + 1].length; i++) for (let j = 0; j < cols[c].length; j++) {
          const wv = Ws[c](i, j);
          ctx.strokeStyle = wv > 0 ? `rgba(255,91,31,${Math.min(0.7, Math.abs(wv) * 0.35)})` : `rgba(79,227,255,${Math.min(0.7, Math.abs(wv) * 0.35)})`;
          ctx.beginPath(); ctx.moveTo(...cols[c][j]); ctx.lineTo(...cols[c + 1][i]); ctx.stroke();
        }
      }
      cols.forEach((col, c) => col.forEach(([x, y], i) => {
        const a = acts[c][i];
        ctx.fillStyle = a > 0 ? `rgba(255,91,31,${0.25 + 0.75 * Math.min(1, Math.abs(a))})` : `rgba(79,227,255,${0.25 + 0.75 * Math.min(1, Math.abs(a))})`;
        ctx.beginPath(); ctx.arc(x, y, c === 0 || c === 3 ? 6 : 4.2, 0, TAU); ctx.fill();
      }));
      ctx.font = `10px ${MONO}`; ctx.fillStyle = PAL.ink3;
      ['x, y', 'tanh ×16', 'tanh ×16', 'σ'].forEach((t, c) => ctx.fillText(t, cols[c][0][0] - 14, y0 + 10));
      ctx.fillText(`p(橙) = ${out.toFixed(3)}`, nx, y0 + side - 4);
    }
    // loss sparkline
    if (this.hist.length > 1) {
      const lx = wide ? x0 + side + 26 : x0, lw = wide ? w - lx - 16 : side, ly = h - 18, lh = 0;
      const max = Math.max(...this.hist), min = Math.min(...this.hist);
      ctx.strokeStyle = PAL.acid; ctx.beginPath();
      this.hist.forEach((v, i) => { const x = lx + (i / (this.hist.length - 1)) * lw, y = ly - 26 * ((v - min) / (max - min || 1)) - lh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    if (this.frameN % 6 === 0) {
      this.readout('step', String(this.net.t));
      this.readout('loss', Number.isFinite(this.stats.loss) ? this.stats.loss.toFixed(4) : '—');
      this.readout('acc', `${(this.stats.acc * 100).toFixed(1)}%`);
    }
    if (!wide) { ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2; ctx.fillText(`step ${this.net.t} · loss ${Number.isFinite(this.stats.loss) ? this.stats.loss.toFixed(3) : '—'} · acc ${(this.stats.acc * 100).toFixed(0)}%`, x0 + 6, y0 + 16); }
  }
}
