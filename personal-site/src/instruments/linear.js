// 02 · Linear algebra — a 2×2 matrix acting on the plane. Drag the tips of î and ĵ to set it.
import { Instrument, TAU, PAL, MONO } from './base.js';

const PRESETS = [
  { m: [2, 1, 1, 2], note: '对称矩阵：两个正交的特征方向，λ = 3, 1' },
  { m: [0, 1, 1, 1], note: '斐波那契矩阵：λ = φ 与 −1/φ，Aⁿ 的元素是斐波那契数' },
  { m: [1, 1, 0, 1], note: '剪切：λ = 1 是二重根，却只有一个特征方向' },
  { m: [0.5, -0.866, 0.866, 0.5], note: '旋转 60°：特征值是复数，没有实特征向量' },
];

function eig([a, b, c, d]) {
  const tr = a + d, det = a * d - b * c, disc = (tr * tr) / 4 - det;
  if (disc < -1e-9) return { tr, det, complex: [tr / 2, Math.sqrt(-disc)] };
  const s = Math.sqrt(Math.max(0, disc));
  const vec = (l) => {
    let v = Math.abs(b) > 1e-9 ? [b, l - a] : Math.abs(c) > 1e-9 ? [l - d, c] : null;
    if (!v) return null;
    const n = Math.hypot(...v);
    return [v[0] / n, v[1] / n];
  };
  const ls = s < 1e-9 ? [tr / 2] : [tr / 2 + s, tr / 2 - s];
  const vs = ls.map((l) => ({ l, v: vec(l) }));
  if (Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9) return { tr, det, vs: [{ l: a, v: [1, 0] }, { l: d, v: [0, 1] }] };
  return { tr, det, vs: vs.filter((x) => x.v) };
}

export class Linear extends Instrument {
  init() {
    this.get2d();
    this.preset = 0; this.phase = 0; this.auto = true;
    this.A = PRESETS[0].m.slice();
    this.M = [1, 0, 0, 1];
    this.controls([
      { type: 'button', label: '下一个矩阵', onClick: () => { this.auto = true; this.preset = (this.preset + 1) % PRESETS.length; this.phase = 0; } },
      { type: 'button', label: '恢复自动', onClick: () => { this.auto = true; this.phase = 0; } },
    ]);
    let grab = null;
    this.pointer({
      down: (x, y) => {
        const [ix, iy] = this.toScreen(this.M[0], this.M[2]), [jx, jy] = this.toScreen(this.M[1], this.M[3]);
        if (Math.hypot(x - ix, y - iy) < 18) grab = 'i'; else if (Math.hypot(x - jx, y - jy) < 18) grab = 'j'; else return false;
        this.auto = false;
        return true;
      },
      move: (x, y) => {
        const [u, v] = this.fromScreen(x, y);
        const r = (q) => Math.round(q * 4) / 4;
        if (grab === 'i') { this.M[0] = r(u); this.M[2] = r(v); } else { this.M[1] = r(u); this.M[3] = r(v); }
        this.A = this.M.slice();
      },
      up: () => { grab = null; },
    });
  }
  get unit() { return Math.min(this.w, this.h) / 8.2; }
  toScreen(x, y) { return [this.w / 2 + x * this.unit, this.h / 2 - y * this.unit]; }
  fromScreen(x, y) { return [(x - this.w / 2) / this.unit, -(y - this.h / 2) / this.unit]; }

  frame(dt) {
    if (this.auto) {
      this.phase += dt;
      const A = PRESETS[this.preset].m;
      const k = this.phase < 0.6 ? 0 : this.phase < 2.4 ? (this.phase - 0.6) / 1.8 : this.phase < 6 ? 1 : this.phase < 7.2 ? 1 - (this.phase - 6) / 1.2 : 0;
      const e = k * k * (3 - 2 * k);
      this.M = [1 + (A[0] - 1) * e, A[1] * e, A[2] * e, 1 + (A[3] - 1) * e];
      this.A = A;
      if (this.phase > 7.6) { this.phase = 0; this.preset = (this.preset + 1) % PRESETS.length; }
    }
    const ctx = this.ctx, w = this.w, h = this.h, M = this.M;
    ctx.clearRect(0, 0, w, h);
    const T = (x, y) => this.toScreen(M[0] * x + M[1] * y, M[2] * x + M[3] * y);
    // base grid
    ctx.strokeStyle = 'rgba(236,232,225,0.06)'; ctx.lineWidth = 1;
    for (let k = -8; k <= 8; k++) {
      const [a, b] = this.toScreen(k, -8), [c, d] = this.toScreen(k, 8); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
      const [e, f] = this.toScreen(-8, k), [g, hh] = this.toScreen(8, k); ctx.beginPath(); ctx.moveTo(e, f); ctx.lineTo(g, hh); ctx.stroke();
    }
    // transformed grid
    for (let k = -8; k <= 8; k++) {
      ctx.strokeStyle = k === 0 ? 'rgba(236,232,225,0.55)' : 'rgba(155,123,255,0.28)';
      let [a, b] = T(k, -8), [c, d] = T(k, 8); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
      [a, b] = T(-8, k); [c, d] = T(8, k); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
    }
    // det parallelogram
    const det = M[0] * M[3] - M[1] * M[2];
    ctx.fillStyle = det >= 0 ? 'rgba(255,91,31,0.16)' : 'rgba(79,227,255,0.16)';
    ctx.beginPath(); ctx.moveTo(...T(0, 0)); ctx.lineTo(...T(1, 0)); ctx.lineTo(...T(1, 1)); ctx.lineTo(...T(0, 1)); ctx.closePath(); ctx.fill();
    // unit circle image
    ctx.strokeStyle = 'rgba(212,255,58,0.6)'; ctx.setLineDash([3, 4]);
    ctx.beginPath(); for (let k = 0; k <= 96; k++) { const a = (k / 96) * TAU; const [x, y] = T(Math.cos(a), Math.sin(a)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.setLineDash([]);
    // eigen-directions of the current matrix
    const E = eig(M);
    ctx.font = `11px ${MONO}`;
    if (E.vs) for (const { l, v } of E.vs) {
      const [a, b] = this.toScreen(-v[0] * 9, -v[1] * 9), [c, d] = this.toScreen(v[0] * 9, v[1] * 9);
      ctx.strokeStyle = 'rgba(212,255,58,0.5)'; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.setLineDash([]);
      const [lx, ly] = this.toScreen(v[0] * 2.6, v[1] * 2.6);
      ctx.fillStyle = PAL.acid; ctx.fillText(`λ=${l.toFixed(2)}`, lx + 6, ly - 6);
    }
    // basis vectors
    const arrow = (x, y, col, label) => {
      const [ox, oy] = this.toScreen(0, 0), [tx, ty] = this.toScreen(x, y);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      const a = Math.atan2(ty - oy, tx - ox);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 10 * Math.cos(a - 0.4), ty - 10 * Math.sin(a - 0.4)); ctx.lineTo(tx - 10 * Math.cos(a + 0.4), ty - 10 * Math.sin(a + 0.4)); ctx.fill();
      ctx.beginPath(); ctx.arc(tx, ty, 7, 0, TAU); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillText(label, tx + 10, ty + 14);
      ctx.lineWidth = 1;
    };
    arrow(M[0], M[2], PAL.signal, 'Aî');
    arrow(M[1], M[3], PAL.ion, 'Aĵ');
    // panel
    ctx.fillStyle = PAL.ink;
    ctx.font = `12px ${MONO}`;
    const f = (v) => (v >= 0 ? ' ' : '') + v.toFixed(2);
    ctx.fillText(`A = [${f(M[0])} ${f(M[1])} ]`, 12, 20);
    ctx.fillText(`    [${f(M[2])} ${f(M[3])} ]`, 12, 36);
    ctx.fillStyle = PAL.ink2;
    ctx.fillText(`det A = ${det.toFixed(3)}   tr A = ${(M[0] + M[3]).toFixed(2)}`, 12, 56);
    if (E.complex) ctx.fillText(`λ = ${E.complex[0].toFixed(2)} ± ${E.complex[1].toFixed(2)}i`, 12, 72);
    if (this.auto) { ctx.fillStyle = PAL.ink3; ctx.fillText(PRESETS[this.preset].note, 12, h - 14); }
    else { ctx.fillStyle = PAL.ink3; ctx.fillText('手动模式：拖动 Aî / Aĵ 的端点', 12, h - 14); }
  }
}
