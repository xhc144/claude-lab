// 05 · Probability — a Galton board. Each ball goes left or right with probability 1/2 at each of
// n rows; bins fill as Binomial(n, 1/2), which the normal curve N(n/2, n/4) approximates.
import { Instrument, TAU, PAL, MONO } from './base.js';

const ROWS = 12;

export class Galton extends Instrument {
  init() {
    this.get2d();
    this.rate = 14;
    this.reset();
    this.controls([
      { type: 'range', label: '速率', min: 2, max: 60, step: 1, value: this.rate, onInput: (v) => { this.rate = v; } },
      { type: 'button', label: '清空', onClick: () => this.reset() },
    ]);
  }
  reset() { this.balls = []; this.bins = new Array(ROWS + 1).fill(0); this.total = 0; this.acc = 0; this.sum = 0; this.sum2 = 0; }
  frame(dt) {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    const top = 26, pegH = (h * 0.5) / ROWS, dx = Math.min(w / (ROWS + 3), pegH * 1.25);
    const cx = w / 2;
    const binTop = top + pegH * (ROWS + 0.6), binBot = h - 18;
    // spawn
    this.acc += dt * this.rate;
    while (this.acc > 1 && this.balls.length < 400) { this.acc -= 1; this.balls.push({ row: 0, k: 0, t: 0, dir: Math.random() < 0.5 ? 0 : 1, speed: 3.2 + Math.random() * 0.8 }); }
    // pegs
    ctx.fillStyle = PAL.ink3;
    for (let r = 0; r < ROWS; r++) for (let j = 0; j <= r; j++) { ctx.beginPath(); ctx.arc(cx + (j - r / 2) * dx, top + (r + 0.5) * pegH, 1.8, 0, TAU); ctx.fill(); }
    // bins
    const maxBin = Math.max(8, ...this.bins);
    const bw = dx * 0.86;
    for (let k = 0; k <= ROWS; k++) {
      const x = cx + (k - ROWS / 2) * dx;
      const hh = (this.bins[k] / maxBin) * (binBot - binTop);
      ctx.fillStyle = 'rgba(255,91,31,0.7)';
      ctx.fillRect(x - bw / 2, binBot - hh, bw, hh);
    }
    // binomial expectation (exact) and its normal approximation
    if (this.total > 0) {
      const C = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - i + 1)) / i; return c; };
      ctx.strokeStyle = PAL.acid; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let s = 0; s <= 200; s++) {
        const kx = (s / 200) * ROWS;
        const dens = Math.exp(-((kx - ROWS / 2) ** 2) / (2 * (ROWS / 4))) / Math.sqrt(TAU * (ROWS / 4));
        const y = binBot - ((dens * this.total) / maxBin) * (binBot - binTop);
        const x = cx + (kx - ROWS / 2) * dx;
        s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = PAL.ion;
      for (let k = 0; k <= ROWS; k++) {
        const e = (C(ROWS, k) / 4096) * this.total;
        const y = binBot - (e / maxBin) * (binBot - binTop);
        ctx.fillRect(cx + (k - ROWS / 2) * dx - bw / 2, y - 1, bw, 2);
      }
      ctx.lineWidth = 1;
    }
    // balls
    ctx.fillStyle = '#fff';
    const keep = [];
    for (const b of this.balls) {
      b.t += dt * b.speed;
      while (b.t >= 1 && b.row < ROWS) { b.t -= 1; b.k += b.dir; b.row++; b.dir = Math.random() < 0.5 ? 0 : 1; }
      if (b.row >= ROWS) {
        this.bins[b.k]++; this.total++; this.sum += b.k; this.sum2 += b.k * b.k;
        continue;
      }
      const x0 = cx + (b.k - b.row / 2) * dx, x1 = cx + (b.k + b.dir - (b.row + 1) / 2) * dx;
      const x = x0 + (x1 - x0) * b.t;
      const y = top + (b.row + 0.5) * pegH + pegH * b.t - Math.sin(Math.PI * b.t) * pegH * 0.45;
      ctx.beginPath(); ctx.arc(x, y - 5, 2.6, 0, TAU); ctx.fill();
      keep.push(b);
    }
    this.balls = keep;
    const n = this.total, mean = n ? this.sum / n : 0, varc = n ? this.sum2 / n - mean * mean : 0;
    ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2;
    ctx.fillText(`N = ${n}   均值 ${mean.toFixed(2)} (理论 ${ROWS / 2})   方差 ${varc.toFixed(2)} (理论 ${ROWS / 4})`, 12, 16);
  }
}
