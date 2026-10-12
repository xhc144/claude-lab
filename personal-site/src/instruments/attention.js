// EXP-06 · Scaled dot-product attention with a causal mask, computed for real on small random vectors
// (seeded; no trained model): S = QKᵀ/√d, mask j > i, softmax(S/τ) row by row, output = A·V.
import { Instrument, TAU, PAL, MONO } from './base.js';
import { mulberry32, gaussian } from '../core/rng.js';

const TOKENS = [...'把好奇心编译成可运行的数学'];
const D = 8;

export class Attention extends Instrument {
  init() {
    this.get2d();
    this.tau = 1;
    const rand = mulberry32(2027);
    const mk = () => TOKENS.map(() => Float64Array.from({ length: D }, () => gaussian(rand)));
    this.Q = mk(); this.K = mk(); this.V = mk();
    this.compute();
    this.row = 0; this.phase = 0; this.hover = null;
    this.controls([
      { type: 'range', label: '温度 τ', min: 0.2, max: 3, step: 0.05, value: 1, format: (v) => v.toFixed(2), onInput: (v) => { this.tau = v; this.compute(); } },
    ]);
    this.pointer({ hover: (x, y) => { this.hover = this.cellAt(x, y); }, leave: () => { this.hover = null; } });
  }
  compute() {
    const n = TOKENS.length;
    this.S = []; this.A = []; this.O = [];
    for (let i = 0; i < n; i++) {
      const s = [], a = [];
      let max = -Infinity;
      for (let j = 0; j < n; j++) {
        let dot = 0;
        for (let k = 0; k < D; k++) dot += this.Q[i][k] * this.K[j][k];
        s.push(j <= i ? dot / Math.sqrt(D) : -Infinity);
        if (j <= i) max = Math.max(max, s[j] / this.tau);
      }
      let z = 0;
      for (let j = 0; j < n; j++) { const e = j <= i ? Math.exp(s[j] / this.tau - max) : 0; a.push(e); z += e; }
      for (let j = 0; j < n; j++) a[j] /= z;
      const o = new Float64Array(D);
      for (let j = 0; j <= i; j++) for (let k = 0; k < D; k++) o[k] += a[j] * this.V[j][k];
      this.S.push(s); this.A.push(a); this.O.push(o);
    }
  }
  geom() {
    const n = TOKENS.length, w = this.w, h = this.h;
    const cell = Math.min((h * 0.58) / n, (w * 0.55) / n);
    return { n, cell, mx: 34, my: h * 0.36, tokY: h * 0.22 };
  }
  cellAt(x, y) {
    const { n, cell, mx, my } = this.geom();
    const i = Math.floor((y - my) / cell), j = Math.floor((x - mx) / cell);
    return i >= 0 && i < n && j >= 0 && j < n ? [i, j] : null;
  }
  frame(dt) {
    this.phase += dt;
    if (this.phase > 1.5) { this.phase = 0; this.row = (this.row + 1) % TOKENS.length; }
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    const { n, cell, mx, my, tokY } = this.geom();
    const qi = this.hover ? this.hover[0] : this.row;
    // tokens + arcs
    const tw = (w - 40) / n;
    const tx = (k) => 20 + (k + 0.5) * tw;
    ctx.font = `15px ${MONO}`; ctx.textAlign = 'center';
    for (let j = 0; j <= qi; j++) {
      const a = this.A[qi][j];
      if (a < 0.01) continue;
      ctx.strokeStyle = `rgba(255,91,31,${Math.min(1, 0.15 + a * 1.4)})`;
      ctx.lineWidth = 0.5 + a * 9;
      const x1 = tx(qi), x2 = tx(j);
      ctx.beginPath(); ctx.moveTo(x1, tokY - 12);
      ctx.quadraticCurveTo((x1 + x2) / 2, tokY - 18 - Math.abs(x1 - x2) * 0.35, x2, tokY - 12); ctx.stroke();
    }
    ctx.lineWidth = 1;
    TOKENS.forEach((t, k) => {
      ctx.fillStyle = k === qi ? PAL.signal : k < qi ? PAL.ink : PAL.ink3;
      ctx.fillText(t, tx(k), tokY + 6);
    });
    ctx.textAlign = 'left';
    // matrix
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = mx + j * cell, y = my + i * cell;
      if (j > i) { ctx.fillStyle = 'rgba(236,232,225,0.035)'; ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2); continue; }
      const shown = i < qi || (i === qi && j <= Math.floor((this.phase / 0.9) * (i + 1)));
      if (!shown && !this.hover) { ctx.strokeStyle = PAL.line; ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3); continue; }
      const a = this.A[i][j];
      ctx.fillStyle = `rgba(255,91,31,${0.08 + 0.92 * Math.pow(a, 0.7)})`;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    }
    ctx.strokeStyle = PAL.ink2; ctx.strokeRect(mx, my + qi * cell, (qi + 1) * cell, cell);
    ctx.font = `10px ${MONO}`; ctx.fillStyle = PAL.ink3;
    ctx.fillText('A = softmax(QKᵀ/√d + M)', mx, my - 8);
    ctx.fillText('−∞', mx + (n - 2) * cell, my + cell * 1.6);
    // output vector for the query row
    const ox = mx + n * cell + 24, ow = w - ox - 16;
    if (ow > 60) {
      ctx.fillStyle = PAL.ink3; ctx.fillText(`o_${qi + 1} = Σ A·V`, ox, my - 8);
      const o = this.O[qi];
      const bh = (n * cell) / D;
      for (let k = 0; k < D; k++) {
        const v = Math.max(-2, Math.min(2, o[k]));
        ctx.fillStyle = v > 0 ? PAL.signal : PAL.ion;
        const cx = ox + ow / 2;
        ctx.fillRect(v > 0 ? cx : cx + (v / 2) * (ow / 2), my + k * bh + 3, Math.abs(v / 2) * (ow / 2), bh - 6);
      }
      ctx.strokeStyle = PAL.line; ctx.beginPath(); ctx.moveTo(ox + ow / 2, my); ctx.lineTo(ox + ow / 2, my + n * cell); ctx.stroke();
    }
    ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2;
    const hv = this.hover;
    if (hv && hv[1] <= hv[0]) ctx.fillText(`S[${hv[0] + 1},${hv[1] + 1}] = ${this.S[hv[0]][hv[1]].toFixed(3)}   A = ${this.A[hv[0]][hv[1]].toFixed(3)}`, 12, h - 12);
    else ctx.fillText(`查询 “${TOKENS[qi]}” 只能看见自己和前面的词 · τ = ${this.tau.toFixed(2)} · 随机向量演示`, 12, h - 12);
  }
}
