// 04 · Topology — a Möbius band (or, for contrast, a cylinder) with a normal vector carried once
// around the core circle. Faces are coloured by which side faces the viewer: on the Möbius band the
// two colours run into each other, because there is only one side.
import { Instrument, TAU, PAL, MONO } from './base.js';

const NU = 96, NV = 8, R = 1, W = 0.42;

export class Topo extends Instrument {
  init() {
    this.get2d();
    this.twist = 1; this.twistTarget = 1;
    this.u = 0; this.loops = 0;
    this.controls([
      { type: 'chips', value: 1, items: [{ label: 'Möbius 带', value: 1 }, { label: '圆柱面', value: 0 }], onChange: (v) => { this.twistTarget = v; this.loops = 0; this.u = 0; } },
    ]);
  }
  point(u, v, tw) {
    const a = (tw * u) / 2;
    const r = R + v * Math.cos(a);
    return [r * Math.cos(u), r * Math.sin(u), v * Math.sin(a)];
  }
  normal(u, tw) {
    const e = 1e-4;
    const p = this.point(u, 0, tw), pu = this.point(u + e, 0, tw), pv = this.point(u, e, tw);
    const a = [pu[0] - p[0], pu[1] - p[1], pu[2] - p[2]], b = [pv[0] - p[0], pv[1] - p[1], pv[2] - p[2]];
    const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const l = Math.hypot(...n);
    return [n[0] / l, n[1] / l, n[2] / l];
  }
  frame(dt, time) {
    this.twist += (this.twistTarget - this.twist) * Math.min(1, dt * 2.5);
    const tw = this.twist;
    const prevU = this.u;
    this.u = (this.u + dt * 0.55) % (TAU * 2);
    if (this.u < prevU) this.loops = 0;
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    const yaw = time * 0.25, pitch = 0.95;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const S = Math.min(w, h) * 0.3;
    const proj = ([x, y, z]) => {
      const x1 = cy * x - sy * y, y1 = sy * x + cy * y;
      const y2 = cp * y1 - sp * z, z2 = sp * y1 + cp * z;
      const k = 3.6 / (3.6 - y2 * 0.6);
      return [w / 2 + x1 * S * k, h * 0.52 - z2 * S * k, y2];
    };
    const view = (n) => { const x1 = cy * n[0] - sy * n[1], y1 = sy * n[0] + cy * n[1]; return cp * y1 - sp * n[2]; };
    // quads, painter-sorted
    const quads = [];
    for (let i = 0; i < NU; i++) {
      const u0 = (i / NU) * TAU, u1 = ((i + 1) / NU) * TAU;
      for (let j = 0; j < NV; j++) {
        const v0 = -W + (2 * W * j) / NV, v1 = -W + (2 * W * (j + 1)) / NV;
        const P = [this.point(u0, v0, tw), this.point(u1, v0, tw), this.point(u1, v1, tw), this.point(u0, v1, tw)].map(proj);
        const depth = (P[0][2] + P[1][2] + P[2][2] + P[3][2]) / 4;
        const n = this.normal((u0 + u1) / 2, tw);
        quads.push({ P, depth, facing: view(n), i });
      }
    }
    quads.sort((a, b) => a.depth - b.depth);
    for (const q of quads) {
      const front = q.facing < 0;
      ctx.fillStyle = front ? 'rgba(255,91,31,0.55)' : 'rgba(79,227,255,0.45)';
      ctx.strokeStyle = 'rgba(5,5,8,0.55)';
      ctx.beginPath(); q.P.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // the travelling normal
    const u = this.u;
    const p = this.point(u, 0, tw), n = this.normal(u, tw);
    const base = proj(p), tip = proj([p[0] + n[0] * 0.55, p[1] + n[1] * 0.55, p[2] + n[2] * 0.55]);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    ctx.beginPath(); ctx.arc(tip[0], tip[1], 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(base[0], base[1], 3, 0, TAU); ctx.fill();
    ctx.lineWidth = 1;
    // compare with the starting normal
    const n0 = this.normal(0, tw);
    const laps = u / TAU;
    ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2;
    ctx.fillText(`沿中线走了 ${laps.toFixed(2)} 圈`, 12, 20);
    if (Math.abs(laps - 1) < 0.08 || Math.abs(laps - 2) < 0.08) {
      const same = n[0] * n0[0] + n[1] * n0[1] + n[2] * n0[2] > 0;
      ctx.fillStyle = same ? PAL.acid : PAL.signal;
      ctx.fillText(same ? '法向量回到原样' : '法向量反过来了！', 12, 38);
    }
    ctx.fillStyle = PAL.ink3;
    ctx.fillText(tw > 0.5 ? '一个面 · 不可定向 · χ = 0' : '两个面 · 可定向 · χ = 0', 12, h - 14);
  }
}
