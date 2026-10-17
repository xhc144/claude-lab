// 星链: a living local graph. Start from one star; every click unfolds its neighbours (definitions,
// theorems, generalisations, examples, applications…), which can be unfolded again, without end.
// The selected star carries small moons — 内容 / 证明 / 例题 / 应用 / 动画 — that open those parts
// of its card.

import { Camera } from './camera.js';
import { RELATIONS } from '../config.js';
import { clamp, easeOut, rgba } from '../core/util.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
const MOONS = { s: '内容', i: '直观', p: '证明', e: '例题', a: '应用', n: '注记', anim: '动画' };

export class Explorer {
  constructor(graph, store, universe) {
    this.g = graph;
    this.store = store;
    this.u = universe;
    this.cam = new Camera({ minK: 0.12, maxK: 4 });
    this.cam.k = 1;
    this.items = new Map();
    this.sel = -1;
    this.hover = -1;
    this.hoverMoon = null;
    this.heat = 1;
    this.time = 0;
    this.dragging = -1;
    this.root = -1;
  }

  levelOn(n) { return this.store.data.settings.levels[n.lv] !== false; }
  relOn(t) { return this.store.data.settings.rels[t] !== false; }

  start(root) {
    this.items.clear();
    this.root = root;
    this.add(root, 0, 0, -1);
    this.cam.stop();
    this.cam.x = 0; this.cam.y = 0; this.cam.k = 1;
    this.expand(root);
    this.sel = root;
    this.heat = 1;
  }

  add(i, x, y, parent) {
    if (this.items.has(i)) return this.items.get(i);
    const it = { i, x, y, vx: 0, vy: 0, expanded: false, born: this.time, parent };
    this.items.set(i, it);
    return it;
  }

  hiddenNeighbors(i) {
    return this.g.neighbors(i, this.store.data.settings.rels).filter((j) => !this.items.has(j) && this.levelOn(this.g.nodes[j]));
  }

  expand(i) {
    const it = this.items.get(i);
    if (!it) return 0;
    it.expanded = true;
    const fresh = this.hiddenNeighbors(i);
    if (!fresh.length) return 0;
    // grow outwards: away from the parent, spread over an arc (a full circle for the root)
    let dir = Math.random() * Math.PI * 2, spread = Math.PI * 2;
    const p = it.parent >= 0 ? this.items.get(it.parent) : null;
    if (p) { dir = Math.atan2(it.y - p.y, it.x - p.x); spread = Math.min(Math.PI * 1.5, 0.5 + fresh.length * 0.32); }
    // order by relation type so that kinds of neighbours sit together
    const typeOf = (j) => {
      const e = this.g.nodes[i].out.find((x) => x.t === j) || this.g.nodes[i].in.find((x) => x.s === j);
      return e ? e.type : 'rel';
    };
    const order = ['pre', 'der', 'gen', 'eq', 'app', 'ex', 'rel'];
    fresh.sort((a, b) => order.indexOf(typeOf(a)) - order.indexOf(typeOf(b)));
    fresh.forEach((j, k) => {
      const a = spread >= Math.PI * 2 ? dir + (k / fresh.length) * Math.PI * 2 : dir - spread / 2 + (spread * (k + 0.5)) / fresh.length;
      const r = 130 + (k % 3) * 28;
      const n = this.add(j, it.x + Math.cos(a) * 20, it.y + Math.sin(a) * 20, i);
      n.vx = Math.cos(a) * r * 0.06; n.vy = Math.sin(a) * r * 0.06;
    });
    this.heat = 1;
    return fresh.length;
  }

  /** fold i: remove stars that only hang off i (not the root, not other unfolded stars) */
  collapse(i) {
    const it = this.items.get(i);
    if (!it) return;
    it.expanded = false;
    const keep = new Set([this.root]);
    for (const [j, x] of this.items) if (x.expanded) { keep.add(j); for (const m of this.g.neighbors(j, this.store.data.settings.rels)) keep.add(m); }
    for (const j of [...this.items.keys()]) if (!keep.has(j)) this.items.delete(j);
    this.heat = 0.6;
  }

  expandAll() {
    let added = 0;
    for (const [j, it] of [...this.items]) if (!it.expanded && this.items.size < 320) added += this.expand(j);
    return added;
  }

  edges() {
    const out = [];
    for (const [i] of this.items) for (const e of this.g.nodes[i].out) if (this.items.has(e.t) && this.relOn(e.type)) out.push(e);
    return out;
  }

  step(dt) {
    if (this.heat < 0.004) return;
    const h = Math.min(dt, 34) / 16;
    const list = [...this.items.values()];
    const n = list.length;
    for (let a = 0; a < n; a++) {
      const A = list[a];
      for (let b = a + 1; b < n; b++) {
        const B = list[b];
        let dx = B.x - A.x, dy = B.y - A.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        if (d2 > 640000) continue;
        const f = (5200 / d2) * this.heat;
        const d = Math.sqrt(d2);
        A.vx -= (dx / d) * f; A.vy -= (dy / d) * f;
        B.vx += (dx / d) * f; B.vy += (dy / d) * f;
      }
    }
    for (const e of this.edges()) {
      const A = this.items.get(e.s), B = this.items.get(e.t);
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || 1;
      const rest = 120 + (this.g.nodes[e.s].w + this.g.nodes[e.t].w) * 7;
      const f = (d - rest) * 0.012 * this.heat;
      A.vx += (dx / d) * f; A.vy += (dy / d) * f;
      B.vx -= (dx / d) * f; B.vy -= (dy / d) * f;
    }
    for (const it of list) {
      if (it.i === this.dragging) { it.vx = it.vy = 0; continue; }
      it.vx -= it.x * 0.0009 * this.heat; it.vy -= it.y * 0.0009 * this.heat;
      it.vx *= 0.82; it.vy *= 0.82;
      it.x += it.vx * h; it.y += it.vy * h;
    }
    if (this.dragging < 0) this.heat *= Math.pow(0.994, h);
  }

  fit(duration = 700) {
    if (!this.items.size) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of this.items.values()) { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); y0 = Math.min(y0, it.y); y1 = Math.max(y1, it.y); }
    const pad = 110;
    const shift = this.u.panelShift ? this.u.panelShift() : 0;
    const k = clamp(Math.min((this.cam.w - shift - pad * 2) / Math.max(x1 - x0, 1), (this.cam.h - pad * 2) / Math.max(y1 - y0, 1)), 0.25, 1.4);
    this.cam.flyTo((x0 + x1) / 2 + shift / 2 / k, (y0 + y1) / 2, k, { duration });
  }

  screenRadius(n) { return clamp((5 + n.w * 2.4) * Math.pow(this.cam.k, 0.5), 3, 30); }

  moons(i) {
    const n = this.g.nodes[i];
    const codes = [...(n.sec || '')];
    if (n.an) codes.push('anim');
    return codes.map((c) => ({ code: c, label: MOONS[c] || c }));
  }
  moonPositions(i) {
    const it = this.items.get(i);
    if (!it) return [];
    const n = this.g.nodes[i];
    const [sx, sy] = this.cam.toScreen(it.x, it.y);
    const rs = this.screenRadius(n);
    const ms = this.moons(i);
    const R = rs * 2.2 + 30;
    const spin = this.store.data.settings.motion ? this.time * 0.00012 : 0;
    return ms.map((m, k) => {
      const a = -Math.PI / 2 + spin + (k / ms.length) * Math.PI * 2;
      return { ...m, x: sx + Math.cos(a) * R, y: sy + Math.sin(a) * R, cx: sx, cy: sy };
    });
  }

  pick(sx, sy) {
    if (this.sel >= 0) for (const m of this.moonPositions(this.sel)) if (Math.hypot(m.x - sx, m.y - sy) < 18) return { moon: m.code };
    let best = -1, bd = Infinity;
    for (const it of this.items.values()) {
      const [px, py] = this.cam.toScreen(it.x, it.y);
      const d = Math.hypot(px - sx, py - sy);
      const rs = this.screenRadius(this.g.nodes[it.i]);
      if (d < Math.max(rs * 1.6, 14) && d < bd) { bd = d; best = it.i; }
    }
    return best >= 0 ? { node: best } : null;
  }

  drag(i, wx, wy) { const it = this.items.get(i); if (!it) return; it.x = wx; it.y = wy; this.dragging = i; this.heat = Math.max(this.heat, 0.5); }
  release() { this.dragging = -1; }

  render(ctx, w, h, dt) {
    this.time += dt;
    const cam = this.cam;
    cam.resize(w, h);
    cam.update(dt);
    this.step(dt);
    const nodes = this.g.nodes;
    const edges = this.edges();
    const focusId = this.hover >= 0 ? this.hover : this.sel;
    // relations
    for (const e of edges) {
      const A = this.items.get(e.s), B = this.items.get(e.t);
      const [x1, y1] = cam.toScreen(A.x, A.y), [x2, y2] = cam.toScreen(B.x, B.y);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      const c = ((e.s + e.t) % 2 ? 1 : -1) * 0.08;
      const G = { x1, y1, x2, y2, cx: (x1 + x2) / 2 - dy * c, cy: (y1 + y2) / 2 + dx * c, len };
      const touches = focusId >= 0 && (e.s === focusId || e.t === focusId);
      const age = Math.min(1, (this.time - Math.max(A.born, B.born)) / 500);
      ctx.globalAlpha = (touches ? 1 : focusId >= 0 ? 0.42 : 0.7) * age;
      this.u.drawRelation(ctx, { ...e, index: e.index }, G, 1, { width: touches ? 2 : 1.2, particles: touches });
      if (touches && len > 90) {
        ctx.globalAlpha = age;
        ctx.font = `500 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const mx = 0.25 * x1 + 0.5 * G.cx + 0.25 * x2, my = 0.25 * y1 + 0.5 * G.cy + 0.25 * y2;
        const label = RELATIONS[e.type].name;
        const tw = ctx.measureText(label).width + 10;
        ctx.fillStyle = 'rgba(6,9,20,0.85)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(mx - tw / 2, my - 9, tw, 18, 9) : ctx.rect(mx - tw / 2, my - 9, tw, 18);
        ctx.fill();
        ctx.fillStyle = RELATIONS[e.type].color;
        ctx.fillText(label, mx, my + 0.5);
      }
    }
    ctx.globalAlpha = 1;
    // stars
    const status = this.store.data.progress;
    const drawn = [];
    ctx.save();
    for (const it of this.items.values()) {
      const n = nodes[it.i];
      const age = easeOut(Math.min(1, (this.time - it.born) / 450));
      const [sx, sy] = cam.toScreen(it.x, it.y);
      if (sx < -80 || sy < -80 || sx > w + 80 || sy > h + 80) continue;
      const rs = this.screenRadius(n) * (0.4 + 0.6 * age);
      const dimmed = focusId >= 0 && focusId !== it.i && !this.g.neighbors(focusId).includes(it.i);
      const a = (dimmed ? 0.45 : 1) * age;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      const gl = rs * 5.5;
      ctx.drawImage(status[n.id] === 2 ? this.u.goldGlow : this.u.glows[n.g], sx - gl / 2, sy - gl / 2, gl, gl);
      if (n.k === 'thm') { const s = rs * 9; ctx.globalAlpha = a * 0.7; ctx.drawImage(this.u.spikes[n.g], sx - s / 2, sy - s / 2, s, s); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      const [r, g, b] = n.galaxy.rgb;
      ctx.fillStyle = `rgb(${(r + 510) / 3 | 0},${(g + 510) / 3 | 0},${(b + 510) / 3 | 0})`;
      ctx.strokeStyle = ctx.fillStyle;
      const cr = rs * 0.5;
      ctx.beginPath();
      if (n.k === 'method') { ctx.moveTo(sx, sy - cr * 1.3); ctx.lineTo(sx + cr * 1.3, sy); ctx.lineTo(sx, sy + cr * 1.3); ctx.lineTo(sx - cr * 1.3, sy); ctx.closePath(); ctx.fill(); }
      else if (n.k === 'example') { ctx.lineWidth = Math.max(1.2, rs * 0.2); ctx.arc(sx, sy, cr, 0, Math.PI * 2); ctx.stroke(); }
      else if (n.k === 'app') { for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + (k * Math.PI) / 3; const px = sx + Math.cos(an) * cr * 1.2, py = sy + Math.sin(an) * cr * 1.2; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); }
      else { ctx.arc(sx, sy, cr, 0, Math.PI * 2); ctx.fill(); }
      // unfolded stars wear a ring; folded ones show how many neighbours are waiting
      if (it.expanded) {
        ctx.strokeStyle = rgba(n.galaxy.rgb, 0.7 * a);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(sx, sy, rs * 1.25 + 4, 0, Math.PI * 2); ctx.stroke();
      }
      drawn.push([it, n, sx, sy, rs, a]);
    }
    ctx.restore();
    // labels and badges
    ctx.textAlign = 'center';
    for (const [it, n, sx, sy, rs, a] of drawn) {
      const px = clamp(Math.round((12 + n.w) * Math.pow(cam.k, 0.2)), 11, 18);
      ctx.font = `${it.i === this.sel || n.w >= 4 ? 600 : 500} ${px}px ${FONT}`;
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = a;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(3,4,12,0.9)';
      const moonR = it.i === this.sel && this.moons(it.i).length ? rs * 2.2 + 30 + 18 : 0;
      const y = sy + Math.max(rs * 1.25 + px + 4, moonR + px * 0.4);
      ctx.strokeText(n.t, sx, y);
      ctx.fillStyle = it.i === this.sel ? '#fff' : 'rgba(232,238,255,0.92)';
      ctx.fillText(n.t, sx, y);
      if (!it.expanded) {
        const hidden = this.hiddenNeighbors(it.i).length;
        if (hidden) {
          const bx = sx + rs * 1.1 + 6, by = sy - rs * 1.1 - 4;
          ctx.font = `600 10px ${FONT}`;
          const t = `+${hidden}`;
          const tw = ctx.measureText(t).width + 8;
          ctx.fillStyle = rgba(n.galaxy.rgb, 0.9 * a);
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(bx - tw / 2, by - 8, tw, 16, 8) : ctx.rect(bx - tw / 2, by - 8, tw, 16);
          ctx.fill();
          ctx.fillStyle = '#060814';
          ctx.textBaseline = 'middle';
          ctx.fillText(t, bx, by + 0.5);
        }
      }
    }
    // selection ring and moons
    if (this.sel >= 0 && this.items.has(this.sel)) {
      const it = this.items.get(this.sel);
      const n = nodes[this.sel];
      const [sx, sy] = cam.toScreen(it.x, it.y);
      const rs = this.screenRadius(n);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#fff';
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -this.time * 0.02;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(sx, sy, rs * 1.25 + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      const moons = this.moonPositions(this.sel);
      if (moons.length) {
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = rgba(n.galaxy.rgb, 1);
        ctx.beginPath(); ctx.arc(sx, sy, Math.hypot(moons[0].x - sx, moons[0].y - sy), 0, Math.PI * 2); ctx.stroke();
      }
      for (const m of moons) {
        const hot = this.hoverMoon === m.code;
        ctx.globalAlpha = 1;
        ctx.fillStyle = hot ? rgba(n.galaxy.rgb, 1) : 'rgba(10,14,30,0.92)';
        ctx.strokeStyle = rgba(n.galaxy.rgb, 0.95);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(m.x, m.y, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = `600 10.5px ${FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = hot ? '#060814' : '#e8eeff';
        ctx.fillText(m.label, m.x, m.y + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }
}
