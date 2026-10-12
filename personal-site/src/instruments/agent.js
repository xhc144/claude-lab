// EXP-07 · A schematic of an agent pipeline for LaTeX lecture notes: draft → compile → review, with a
// revise loop until the review passes. Purely illustrative — not a log of any real run.
import { Instrument, TAU, PAL, MONO } from './base.js';

const NODES = [
  { id: 'spec', label: '需求', sub: 'SPEC', x: 0.08, y: 0.3 },
  { id: 'plan', label: '规划大纲', sub: 'PLAN', x: 0.26, y: 0.3 },
  { id: 'draft', label: '起草 LaTeX', sub: 'DRAFT', x: 0.44, y: 0.3 },
  { id: 'compile', label: '编译', sub: 'XELATEX', x: 0.62, y: 0.3 },
  { id: 'review', label: '审校', sub: 'REVIEW', x: 0.8, y: 0.3 },
  { id: 'ship', label: '交付 PDF', sub: 'DELIVER', x: 0.93, y: 0.62 },
  { id: 'revise', label: '修订', sub: 'REVISE', x: 0.62, y: 0.62 },
];
const LOG = {
  spec: '[spec]    明确主题、读者与讲义规范',
  plan: '[plan]    拆分章节，理清定义与定理的依赖',
  draft: '[draft]   生成 LaTeX 草稿与习题',
  compile: '[compile] xelatex 编译通过',
  pass: '[review]  ✓ 定义、推导、记号与排版一致',
  fail: '[review]  ✗ 发现问题，退回修订',
  revise: '[revise]  按审校意见逐条修改',
  ship: '[deliver] 输出 PDF 与源码',
};

export class Agent extends Instrument {
  init() {
    this.get2d();
    this.doc = 1; this.iter = 0;
    this.lines = [];
    this.path = ['spec', 'plan'];
    this.at = 'spec'; this.to = 'plan'; this.t = 0;
    this.log('spec');
  }
  log(key) { this.lines.push(`${LOG[key]}${key === 'fail' || key === 'pass' ? `（第 ${this.iter} 轮）` : ''}`); if (this.lines.length > 6) this.lines.shift(); }
  next(from) {
    switch (from) {
      case 'spec': return 'plan';
      case 'plan': return 'draft';
      case 'draft': return 'compile';
      case 'compile': return 'review';
      case 'review': { this.iter++; const pass = Math.random() < 0.3 + 0.25 * this.iter; this.log(pass ? 'pass' : 'fail'); return pass ? 'ship' : 'revise'; }
      case 'revise': return 'compile';
      case 'ship': this.doc++; this.iter = 0; return 'spec';
    }
    return 'spec';
  }
  frame(dt, time) {
    this.t += dt * 1.1;
    if (this.t >= 1) {
      this.t = 0;
      this.at = this.to;
      if (this.at !== 'review') this.log(this.at);
      this.to = this.next(this.at);
    }
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    const P = (id) => { const n = NODES.find((m) => m.id === id); return [n.x * w, n.y * h]; };
    const edges = [['spec', 'plan'], ['plan', 'draft'], ['draft', 'compile'], ['compile', 'review'], ['review', 'ship'], ['review', 'revise'], ['revise', 'compile'], ['ship', 'spec']];
    for (const [a, b] of edges) {
      const [x1, y1] = P(a), [x2, y2] = P(b);
      const active = a === this.at && b === this.to;
      ctx.strokeStyle = active ? PAL.signal : PAL.line; ctx.lineWidth = active ? 1.6 : 1;
      ctx.setLineDash(b === 'revise' || a === 'revise' ? [4, 4] : a === 'ship' ? [2, 6] : []);
      ctx.beginPath();
      if (a === 'ship') { ctx.moveTo(x1, y1); ctx.quadraticCurveTo(w * 0.5, h * 0.98, x2, y2); }
      else { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.lineWidth = 1;
    // packet
    const [x1, y1] = P(this.at), [x2, y2] = P(this.to);
    const e = this.t * this.t * (3 - 2 * this.t);
    let px = x1 + (x2 - x1) * e, py = y1 + (y2 - y1) * e;
    if (this.at === 'ship') { const u = e; px = (1 - u) ** 2 * x1 + 2 * (1 - u) * u * w * 0.5 + u * u * x2; py = (1 - u) ** 2 * y1 + 2 * (1 - u) * u * h * 0.98 + u * u * y2; }
    const g = ctx.createRadialGradient(px, py, 0, px, py, 14);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, 'rgba(255,91,31,0.8)'); g.addColorStop(1, 'rgba(255,91,31,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 14, 0, TAU); ctx.fill();
    // nodes
    for (const n of NODES) {
      const [x, y] = [n.x * w, n.y * h];
      const on = n.id === this.at;
      const bw = Math.min(104, w * 0.15), bh = 42;
      ctx.fillStyle = on ? 'rgba(255,91,31,0.18)' : 'rgba(9,9,15,0.92)';
      ctx.strokeStyle = on ? PAL.signal : PAL.ink3;
      ctx.beginPath(); ctx.rect(x - bw / 2, y - bh / 2, bw, bh); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `9px ${MONO}`; ctx.fillStyle = on ? PAL.signal : PAL.ink3; ctx.fillText(n.sub, x, y - 5);
      ctx.font = `12px ${MONO}`; ctx.fillStyle = PAL.ink; ctx.fillText(n.label, x, y + 12);
      ctx.textAlign = 'left';
      if (on) { ctx.fillStyle = PAL.acid; ctx.beginPath(); ctx.arc(x + bw / 2 - 6, y - bh / 2 + 6, 2.5 + Math.sin(time * 8), 0, TAU); ctx.fill(); }
    }
    // log
    ctx.font = `10.5px ${MONO}`;
    const ly = h * 0.78;
    this.lines.forEach((l, i) => { ctx.fillStyle = i === this.lines.length - 1 ? PAL.ink : PAL.ink3; ctx.fillText(l, 14, ly + i * 15 - (this.lines.length - 1) * 15 + 30); });
    ctx.fillStyle = PAL.ink3; ctx.font = `10px ${MONO}`;
    ctx.fillText(`SCHEMATIC · 示意动画 · 讲义 #${this.doc} · 审校第 ${this.iter} 轮`, 14, 18);
  }
}
