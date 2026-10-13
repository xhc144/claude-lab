// 06 · Olympiad — Pascal's triangle coloured by C(n, k) mod p. Lucas' theorem,
// C(n, k) ≡ Π C(nᵢ, kᵢ) (mod p) over the base-p digits, explains the self-similar fractal.
import { Instrument, PAL, MONO } from './base.js';

export class Pascal extends Instrument {
  init() {
    this.get2d();
    this.p = 2; this.reveal = 0; this.hoverCell = null;
    this.build();
    this.controls([
      { type: 'chips', value: 2, items: [2, 3, 5, 7].map((p) => ({ label: `p = ${p}`, value: p })), onChange: (v) => { this.p = v; this.build(); } },
    ]);
    this.pointer({ hover: (x, y) => { this.hoverCell = this.cellAt(x, y); }, leave: () => { this.hoverCell = null; } });
  }
  build() {
    const p = this.p;
    let N = 1; while (N * p <= 130) N *= p; // a full power of p shows the self-similarity exactly
    this.N = N;
    this.rows = [];
    let row = [1];
    for (let n = 0; n < this.N; n++) {
      this.rows.push(row);
      const next = [1];
      for (let k = 1; k < row.length; k++) next.push((row[k - 1] + row[k]) % p);
      next.push(1);
      row = next;
    }
    this.reveal = 0;
  }
  geom() {
    const N = this.N, w = this.w, h = this.h;
    const cell = Math.min((w - 16) / N, (h - 40) / (N * 0.866));
    return { cell, x0: w / 2, y0: 30 };
  }
  cellAt(x, y) {
    const { cell, x0, y0 } = this.geom();
    const n = Math.floor((y - y0) / (cell * 0.866));
    if (n < 0 || n >= this.N) return null;
    const k = Math.round((x - x0) / cell + n / 2);
    if (k < 0 || k > n) return null;
    return [n, k];
  }
  frame(dt) {
    this.reveal = Math.min(this.N, this.reveal + dt * this.N * 0.45);
    const ctx = this.ctx, w = this.w, h = this.h, p = this.p;
    ctx.clearRect(0, 0, w, h);
    const { cell, x0, y0 } = this.geom();
    const rows = Math.floor(this.reveal);
    const hues = ['', '#ff5b1f', '#4fe3ff', '#9b7bff', '#d4ff3a', '#ffb38f', '#b9f5ff'];
    for (let n = 0; n < rows; n++) {
      const r = this.rows[n];
      const y = y0 + n * cell * 0.866;
      for (let k = 0; k <= n; k++) {
        const v = r[k];
        if (!v) continue;
        ctx.fillStyle = hues[v] || PAL.ink;
        ctx.fillRect(x0 + (k - n / 2) * cell - cell / 2, y, Math.max(1, cell * 0.92), Math.max(1, cell * 0.8));
      }
    }
    ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2;
    ctx.fillText(`前 ${this.N} 行 · 着色 = C(n,k) mod ${p}，黑色 = 被 ${p} 整除`, 12, 16);
    if (this.hoverCell) {
      const [n, k] = this.hoverCell;
      const digits = (x) => { const d = []; do { d.push(x % p); x = Math.floor(x / p); } while (x); return d; };
      const dn = digits(n), dk = digits(k);
      const L = dn.length;
      const fmt = (d) => d.concat(new Array(L - d.length).fill(0)).reverse().join('');
      ctx.fillStyle = PAL.ink;
      ctx.fillText(`C(${n}, ${k}) ≡ ${this.rows[n][k]} (mod ${p})   n = ${fmt(dn)}₍${p}₎  k = ${fmt(dk)}₍${p}₎`, 12, h - 12);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(x0 + (k - n / 2) * cell - cell / 2 - 1, y0 + n * cell * 0.866 - 1, cell + 2, cell * 0.8 + 2);
    }
  }
}
