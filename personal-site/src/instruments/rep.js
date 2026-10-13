// 03 · Representation theory — S₃ acting on an equilateral triangle, with its character table.
// The standard 2-dimensional representation is literally the triangle's symmetry matrices; its
// character (the trace) is 2, 0, −1 on the classes e, (12), (123).
import { Instrument, TAU, PAL, MONO } from './base.js';

const S3 = Math.sqrt(3) / 2;
// kind: 'rot' (angle) or 'ref' (axis angle). perm acts on positions 0,1,2 (vertices at 90°, 210°, 330°).
const ELEMENTS = [
  { name: 'e', cyc: '(1)(2)(3)', kind: 'rot', a: 0, cls: 0, mat: [1, 0, 0, 1] },
  { name: 'r', cyc: '(1 2 3)', kind: 'rot', a: TAU / 3, cls: 2, mat: [-0.5, -S3, S3, -0.5] },
  { name: 'r²', cyc: '(1 3 2)', kind: 'rot', a: (2 * TAU) / 3, cls: 2, mat: [-0.5, S3, -S3, -0.5] },
  { name: 's₁', cyc: '(2 3)', kind: 'ref', a: Math.PI / 2, cls: 1, mat: [-1, 0, 0, 1] },
  { name: 's₂', cyc: '(1 3)', kind: 'ref', a: Math.PI / 2 + TAU / 3, cls: 1, mat: [0.5, S3, S3, -0.5] },
  { name: 's₃', cyc: '(1 2)', kind: 'ref', a: Math.PI / 2 + (2 * TAU) / 3, cls: 1, mat: [0.5, -S3, -S3, -0.5] },
];
const TABLE = { head: ['', 'e', '(12)', '(123)'], rows: [['χ_triv', 1, 1, 1], ['χ_sign', 1, -1, 1], ['χ_std', 2, 0, -1]], size: ['|C|', 1, 3, 2] };
const COLORS = [PAL.signal, PAL.ion, PAL.acid];

const apply = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];

export class Rep extends Instrument {
  init() {
    this.get2d();
    // label of the vertex currently sitting at each base position
    this.base = [0, 1, 2].map((k) => [Math.cos(Math.PI / 2 + (k * TAU) / 3), Math.sin(Math.PI / 2 + (k * TAU) / 3)]);
    this.labels = [0, 1, 2];
    this.current = ELEMENTS[0];
    this.anim = null;
    this.auto = true; this.timer = 0; this.seq = 0;
    this.controls([
      { type: 'button', label: '旋转 r', onClick: () => { this.auto = false; this.play(ELEMENTS[1]); } },
      { type: 'button', label: '翻转 s₁', onClick: () => { this.auto = false; this.play(ELEMENTS[3]); } },
      { type: 'button', label: '自动', onClick: () => { this.auto = true; } },
    ]);
  }
  play(g) {
    if (this.anim) return;
    this.anim = { g, t: 0 };
  }
  finish(g) {
    // vertex at base position k moves to the position of g·base[k]
    const next = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const p = apply(g.mat, this.base[k]);
      const j = this.base.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6);
      next[j] = this.labels[k];
    }
    this.labels = next;
    this.current = g;
  }
  frame(dt) {
    if (this.anim) {
      this.anim.t += dt / 1.1;
      if (this.anim.t >= 1) { this.finish(this.anim.g); this.anim = null; }
    } else if (this.auto) {
      this.timer += dt;
      if (this.timer > 1.4) { this.timer = 0; this.seq = (this.seq + 1) % ELEMENTS.length; this.play(ELEMENTS[[1, 3, 2, 4, 1, 5][this.seq]]); }
    }
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    const wide = w > h * 1.05;
    const R = Math.min(wide ? w * 0.22 : w * 0.3, h * 0.3);
    const cx = wide ? w * 0.28 : w / 2, cy = wide ? h * 0.52 : h * 0.34;
    // current transform during animation
    let tf = (p) => p;
    const g = this.anim?.g;
    if (g) {
      const e = this.anim.t < 0.5 ? 2 * this.anim.t ** 2 : 1 - (-2 * this.anim.t + 2) ** 2 / 2;
      if (g.kind === 'rot') { const a = g.a * e, c = Math.cos(a), s = Math.sin(a); tf = ([x, y]) => [c * x - s * y, s * x + c * y]; }
      else {
        const ax = [Math.cos(g.a), Math.sin(g.a)], k = Math.cos(Math.PI * e);
        tf = ([x, y]) => { const d = x * ax[0] + y * ax[1]; const px = x - d * ax[0], py = y - d * ax[1]; return [d * ax[0] + k * px, d * ax[1] + k * py]; };
      }
    }
    const S = (p) => { const q = tf(p); return [cx + q[0] * R, cy - q[1] * R]; };
    // symmetry axes
    ctx.strokeStyle = PAL.line; ctx.setLineDash([3, 5]);
    for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k * TAU) / 3; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * R * 1.35, cy + Math.sin(a) * R * 1.35); ctx.lineTo(cx + Math.cos(a) * R * 1.35, cy - Math.sin(a) * R * 1.35); ctx.stroke(); }
    ctx.setLineDash([]);
    if (g && g.kind === 'ref') { ctx.strokeStyle = PAL.signal; ctx.beginPath(); ctx.moveTo(cx - Math.cos(g.a) * R * 1.4, cy + Math.sin(g.a) * R * 1.4); ctx.lineTo(cx + Math.cos(g.a) * R * 1.4, cy - Math.sin(g.a) * R * 1.4); ctx.stroke(); }
    // triangle
    const P = this.base.map(S);
    ctx.fillStyle = 'rgba(155,123,255,0.16)'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.6;
    ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.font = `bold 13px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    P.forEach((p, k) => {
      const lab = this.labels[k];
      ctx.fillStyle = COLORS[lab]; ctx.beginPath(); ctx.arc(p[0], p[1], 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillText(String(lab + 1), p[0], p[1] + 0.5);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // current element + matrix
    const cur = this.current;
    ctx.font = `12px ${MONO}`; ctx.fillStyle = PAL.ink;
    ctx.fillText(`g = ${g ? g.name + '  ' + g.cyc : cur.name + '  ' + cur.cyc}`, 12, 20);
    const m = (g || cur).mat, f = (v) => (v >= 0 ? ' ' : '') + v.toFixed(2);
    ctx.fillStyle = PAL.ink2;
    ctx.fillText(`ρ(g) = [${f(m[0])} ${f(m[1])}]`, 12, 38);
    ctx.fillText(`       [${f(m[2])} ${f(m[3])}]   tr = ${(m[0] + m[3]).toFixed(0)}`, 12, 54);
    // character table
    const cls = (g || cur).cls;
    const tx = wide ? w * 0.55 : 14, ty = wide ? h * 0.3 : h * 0.68;
    const lw = 56, cw = wide ? Math.min(52, (w - tx - lw - 10) / 3) : (w - 28 - lw) / 3, rh = 20;
    const colX = (c) => (c === 0 ? tx : tx + lw + cw * (c - 1));
    ctx.fillStyle = 'rgba(255,91,31,0.16)';
    ctx.fillRect(colX(cls + 1) - 6, ty - 15, cw, rh * 5 + 6);
    ctx.font = `11px ${MONO}`;
    const rows = [TABLE.head, ...TABLE.rows, TABLE.size];
    rows.forEach((row, r) => row.forEach((v, c) => {
      ctx.fillStyle = r === 0 || c === 0 ? PAL.ink3 : r === 3 && c === cls + 1 ? PAL.signal : PAL.ink;
      ctx.fillText(String(v).replace('-', '−'), colX(c), ty + rh * r);
    }));
    ctx.fillStyle = PAL.ink3;
    ctx.fillText('6 = 1² + 1² + 2²', tx, ty + rh * 5 + 8);
  }
}
