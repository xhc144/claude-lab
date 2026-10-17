// 星图: the whole universe on one canvas — parallax starfield, galaxy nebulae, relation lines,
// glowing stars (shape by kind, size by weight), semantic-zoom labels, selection, routes, and
// elastic dragging of stars.

import { Camera } from './camera.js';
import { makeGlow, makeSpikes, makeStarTile, makeNebula } from './sky.js';
import { RELATIONS } from '../config.js';
import { clamp, smoothstep, rgba, hashString } from '../core/util.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC","Source Han Sans SC",system-ui,sans-serif';
const SERIF = '"Noto Serif SC","Songti SC","STSong","Source Han Serif SC",serif';
const GOLD = [255, 214, 120];

export class Universe {
  constructor(graph, store) {
    this.g = graph;
    this.store = store;
    this.cam = new Camera({ minK: 0.03, maxK: 7 });
    this.sel = -1;
    this.hover = -1;
    this.focus = null;       // Set of indices emphasised around the selection
    this.hits = null;        // search hits
    this.path = null;        // { nodes: [...], kind: 'learn' | 'route' | 'tour' }
    this.time = 0;
    this.dim = 0;            // 0..1, fades the universe behind the explore view
    const N = graph.nodes.length;
    this.off = new Float32Array(N * 2);
    this.vel = new Float32Array(N * 2);
    this.tgt = new Float32Array(N * 2);
    this.springing = false;
    this.phase = new Float32Array(N);
    this.freq = new Float32Array(N);
    graph.nodes.forEach((n, k) => { const h = hashString(n.id); this.phase[k] = (h % 6283) / 1000; this.freq[k] = 0.6 + ((h >> 8) % 1000) / 1000; });
    // per-edge curvature, so parallel lines fan out a little
    this.curve = graph.edges.map((e) => {
      const inter = graph.nodes[e.s].g !== graph.nodes[e.t].g;
      return (((e.s * 7 + e.t * 13) % 2) ? 1 : -1) * (inter ? 0.2 : 0.1);
    });
    this.glows = graph.galaxies.map((g) => makeGlow(g.rgb));
    this.spikes = graph.galaxies.map((g) => makeSpikes(g.rgb));
    this.goldGlow = makeGlow(GOLD);
    this.tiles = [makeStarTile(11, 1024, 900, 0.9, 0.2), makeStarTile(23, 1024, 260, 1.5, 0.3), makeStarTile(37, 1024, 70, 2.2, 0.35)];
    this.nebulae = new Array(graph.galaxies.length).fill(null);
    this.nebulaQueue = graph.galaxies.map((_, k) => k);
    this.labelWidth = new Map();
    this.buildGrid();
  }

  buildGrid() {
    this.cell = 140;
    this.grid = new Map();
    for (const n of this.g.nodes) {
      const key = `${Math.floor(n.x / this.cell)},${Math.floor(n.y / this.cell)}`;
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(n.index);
    }
  }

  // ---- state
  levelOn(n) { return this.store.data.settings.levels[n.lv] !== false; }
  relOn(type) { return this.store.data.settings.rels[type] !== false; }
  pos(i) { const n = this.g.nodes[i]; return [n.x + this.off[i * 2], n.y + this.off[i * 2 + 1]]; }
  screenRadius(n) { return Math.max(0.7, n.r * Math.pow(this.cam.k, 0.56)); }

  select(i) {
    this.sel = i;
    if (i < 0) { this.focus = null; return; }
    this.focus = new Set([i, ...this.g.neighbors(i, this.store.data.settings.rels)]);
  }

  /** frame a set of stars (or the whole sky) */
  fitView(indices, { padding = 120, maxK = 1.6, duration } = {}) {
    const list = indices && indices.length ? indices : this.g.nodes.map((n) => n.index);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of list) { const [x, y] = this.pos(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = Math.max(x1 - x0, 200), h = Math.max(y1 - y0, 200);
    const k = Math.min((this.cam.w - padding * 2) / w, (this.cam.h - padding * 2) / h, maxK);
    this.cam.flyTo((x0 + x1) / 2, (y0 + y1) / 2, k, { duration });
  }
  fitGalaxy(gi) {
    const G = this.g.galaxies[gi];
    const k = Math.min(this.cam.w, this.cam.h) / (G.r * 2.25);
    this.cam.flyTo(G.x, G.y, k);
  }
  flyToNode(i, k) {
    const [x, y] = this.pos(i);
    const target = k ?? Math.max(this.cam.k, 1.15);
    // keep the star clear of the card on the right
    const shift = this.panelShift ? this.panelShift() / target / 2 : 0;
    const lift = this.sheetCover ? this.sheetCover() / target / 2 : 0;
    this.cam.flyTo(x + shift, y + lift, target);
  }

  // ---- picking
  pick(sx, sy) {
    const [wx, wy] = this.cam.toWorld(sx, sy);
    const gx = Math.floor(wx / this.cell), gy = Math.floor(wy / this.cell);
    let best = -1, bestD = Infinity;
    const reach = Math.ceil(30 / (this.cam.k * this.cell)) + 1;
    for (let ox = -reach; ox <= reach; ox++) for (let oy = -reach; oy <= reach; oy++) {
      const list = this.grid.get(`${gx + ox},${gy + oy}`);
      if (!list) continue;
      for (const i of list) {
        const n = this.g.nodes[i];
        if (!this.levelOn(n)) continue;
        const [x, y] = this.pos(i);
        const [px, py] = this.cam.toScreen(x, y);
        const d = Math.hypot(px - sx, py - sy);
        const rs = this.screenRadius(n);
        if (d < Math.max(rs * 2, 9) && d < bestD) { best = i; bestD = d; }
      }
    }
    return best;
  }

  // ---- elastic dragging: the star follows the pointer, its neighbours are tugged along
  drag(i, wx, wy) {
    const n = this.g.nodes[i];
    const dx = wx - n.x, dy = wy - n.y;
    this.tgt.fill(0);
    this.tgt[i * 2] = dx; this.tgt[i * 2 + 1] = dy;
    this.off[i * 2] = dx; this.off[i * 2 + 1] = dy;
    const ring1 = this.g.neighbors(i);
    const seen = new Set([i, ...ring1]);
    for (const j of ring1) { this.tgt[j * 2] = dx * 0.32; this.tgt[j * 2 + 1] = dy * 0.32; }
    for (const j of ring1) for (const m of this.g.neighbors(j)) {
      if (seen.has(m)) continue;
      seen.add(m);
      this.tgt[m * 2] = dx * 0.1; this.tgt[m * 2 + 1] = dy * 0.1;
    }
    this.dragging = i;
    this.springing = true;
  }
  release() { this.tgt.fill(0); this.dragging = -1; this.springing = true; }
  stepSprings(dt) {
    if (!this.springing) return;
    const h = Math.min(dt, 32) / 16;
    let energy = 0;
    for (let k = 0; k < this.off.length; k++) {
      if (k >> 1 === this.dragging) continue;
      const a = (this.tgt[k] - this.off[k]) * 0.09 - this.vel[k] * 0.16;
      this.vel[k] += a * h;
      this.off[k] += this.vel[k] * h;
      energy += Math.abs(this.vel[k]) + Math.abs(this.tgt[k] - this.off[k]);
    }
    if (energy < 0.05 && this.dragging < 0) { this.off.fill(0); this.vel.fill(0); this.springing = false; }
  }

  // ---- frame
  render(ctx, w, h, dt) {
    this.time += dt;
    const cam = this.cam;
    cam.resize(w, h);
    cam.update(dt);
    this.stepSprings(dt);
    if (this.nebulaQueue.length) this.buildNebula(this.nebulaQueue.shift());

    ctx.fillStyle = '#03040b';
    ctx.fillRect(0, 0, w, h);
    this.drawStarfield(ctx, w, h);
    this.drawNebulae(ctx);
    if (this.dim >= 0.999) { this.vignette(ctx, w, h); return; }
    ctx.globalAlpha = 1 - this.dim * 0.9;
    this.drawEdges(ctx, w, h);
    if (this.path) this.drawPath(ctx);
    this.drawNodes(ctx, w, h);
    this.drawLabels(ctx, w, h);
    ctx.globalAlpha = 1;
    this.vignette(ctx, w, h);
  }

  vignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,6,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawStarfield(ctx, w, h) {
    const cam = this.cam;
    const zoomPar = Math.log(cam.k / 0.2);
    [0.015, 0.04, 0.09].forEach((par, k) => {
      const tile = this.tiles[k];
      const scale = 1 + clamp(zoomPar * (0.03 + k * 0.03), -0.25, 0.6);
      const size = 1024 * scale;
      const ox = -((cam.x * cam.k * par) % size + size) % size;
      const oy = -((cam.y * cam.k * par) % size + size) % size;
      ctx.globalAlpha = k === 0 ? 0.9 : 0.85 + 0.15 * Math.sin(this.time * 0.0007 + k);
      for (let x = ox - size; x < w; x += size) for (let y = oy - size; y < h; y += size) {
        if (x + size < 0 || y + size < 0) continue;
        ctx.drawImage(tile, x, y, size, size);
      }
    });
    ctx.globalAlpha = 1;
  }

  buildNebula(gi) {
    const G = this.g.galaxies[gi];
    const R = G.r * 1.25;
    const blobs = this.g.clusters.filter((c) => c.g === gi && c.members.length).map((c) => ({ x: c.x, y: c.y, r: Math.max(c.r, 120), m: 0.55 + Math.min(0.9, c.members.length / 30) }));
    this.nebulae[gi] = { img: makeNebula({ hue: G.hue, seed: 101 + gi * 17, cx: G.x, cy: G.y, R, blobs, size: 224 }), x: G.x - R, y: G.y - R, s: R * 2 };
  }
  drawNebulae(ctx) {
    const cam = this.cam;
    const a = 0.95 - smoothstep(0.25, 2.2, cam.k) * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    for (const neb of this.nebulae) {
      if (!neb) continue;
      const [sx, sy] = cam.toScreen(neb.x, neb.y);
      const s = neb.s * cam.k;
      if (sx > cam.w || sy > cam.h || sx + s < 0 || sy + s < 0) continue;
      ctx.globalAlpha = a * 0.55;
      ctx.drawImage(neb.img, sx, sy, s, s);
    }
    // a faint core glow for each galaxy
    for (const G of this.g.galaxies) {
      const [sx, sy] = cam.toScreen(G.x, G.y);
      const r = G.r * cam.k * 0.55;
      if (sx + r < 0 || sy + r < 0 || sx - r > cam.w || sy - r > cam.h) continue;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, rgba(G.rgb, 0.13 * a));
      grad.addColorStop(1, rgba(G.rgb, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  edgeGeometry(e) {
    const [x1, y1] = this.cam.toScreen(...this.pos(e.s));
    const [x2, y2] = this.cam.toScreen(...this.pos(e.t));
    const dx = x2 - x1, dy = y2 - y1;
    const c = this.curve[e.index];
    return { x1, y1, x2, y2, cx: (x1 + x2) / 2 - dy * c, cy: (y1 + y2) / 2 + dx * c, len: Math.hypot(dx, dy) };
  }

  drawEdges(ctx, w, h) {
    const cam = this.cam;
    const nodes = this.g.nodes;
    const focus = this.focus;
    const zoomA = 0.55 + smoothstep(0.08, 1.2, cam.k) * 0.7;
    const groups = new Map();
    const hl = [];
    const margin = 40;
    for (const e of this.g.edges) {
      if (!this.relOn(e.type)) continue;
      const a = nodes[e.s], b = nodes[e.t];
      if (!this.levelOn(a) || !this.levelOn(b)) continue;
      const G = this.edgeGeometry(e);
      const minX = Math.min(G.x1, G.x2, G.cx), maxX = Math.max(G.x1, G.x2, G.cx), minY = Math.min(G.y1, G.y2, G.cy), maxY = Math.max(G.y1, G.y2, G.cy);
      if (maxX < -margin || minX > w + margin || maxY < -margin || minY > h + margin) continue;
      if (G.len < 1.5) continue;
      if (this.sel >= 0 && (e.s === this.sel || e.t === this.sel)) { hl.push([e, G]); continue; }
      const inter = a.g !== b.g;
      let alpha = inter ? 0.05 : 0.15;
      if (focus) alpha *= focus.has(e.s) && focus.has(e.t) ? 1.4 : 0.18;
      else if (this.hits) alpha *= this.hits.has(e.s) || this.hits.has(e.t) ? 1.3 : 0.4;
      alpha *= zoomA;
      const key = inter ? 'i' : `g${a.g}`;
      const bucket = `${key}:${Math.round(alpha * 50)}`;
      if (!groups.has(bucket)) groups.set(bucket, { color: inter ? [190, 205, 255] : a.galaxy.rgb, alpha, list: [] });
      groups.get(bucket).list.push(G);
    }
    ctx.lineWidth = clamp(0.6 + cam.k * 0.4, 0.6, 1.3);
    ctx.lineCap = 'round';
    for (const grp of groups.values()) {
      ctx.strokeStyle = rgba(grp.color, grp.alpha);
      ctx.beginPath();
      for (const G of grp.list) { ctx.moveTo(G.x1, G.y1); ctx.quadraticCurveTo(G.cx, G.cy, G.x2, G.y2); }
      ctx.stroke();
    }
    // the selected star's relations: colour and line style by type, arrows, flowing light
    for (const [e, G] of hl) this.drawRelation(ctx, e, G, 1);
  }

  drawRelation(ctx, e, G, alpha, { width = 1.7, particles = true } = {}) {
    const R = RELATIONS[e.type];
    const col = R.color;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.setLineDash(R.dash || []);
    ctx.lineDashOffset = R.dash && R.dash.length ? -this.time * 0.02 : 0;
    if (R.double) {
      const nx = -(G.y2 - G.y1) / (G.len || 1), ny = (G.x2 - G.x1) / (G.len || 1);
      for (const s of [-1.6, 1.6]) {
        ctx.beginPath();
        ctx.moveTo(G.x1 + nx * s, G.y1 + ny * s);
        ctx.quadraticCurveTo(G.cx + nx * s, G.cy + ny * s, G.x2 + nx * s, G.y2 + ny * s);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(G.x1, G.y1);
      ctx.quadraticCurveTo(G.cx, G.cy, G.x2, G.y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const bez = (u) => [(1 - u) * (1 - u) * G.x1 + 2 * (1 - u) * u * G.cx + u * u * G.x2, (1 - u) * (1 - u) * G.y1 + 2 * (1 - u) * u * G.cy + u * u * G.y2];
    if (R.arrow && G.len > 30) {
      const rt = this.screenRadius(this.g.nodes[e.t]);
      const u = clamp(1 - (rt * 1.6 + 7) / G.len, 0.5, 0.97);
      const [ax, ay] = bez(u);
      const [bx, by] = bez(u - 0.02);
      const ang = Math.atan2(ay - by, ax - bx);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(ang) * 6, ay + Math.sin(ang) * 6);
      ctx.lineTo(ax + Math.cos(ang + 2.5) * 6, ay + Math.sin(ang + 2.5) * 6);
      ctx.lineTo(ax + Math.cos(ang - 2.5) * 6, ay + Math.sin(ang - 2.5) * 6);
      ctx.closePath();
      ctx.fill();
    }
    if (particles && this.store.data.settings.motion && G.len > 40) {
      const count = Math.min(4, 1 + Math.floor(G.len / 160));
      const speed = (R.flow ? 0.00042 : 0.00025) * (300 / Math.max(120, G.len));
      for (let p = 0; p < count; p++) {
        const u = (this.time * speed + p / count + (e.index % 7) / 7) % 1;
        const [px, py] = bez(u);
        ctx.globalAlpha = alpha * Math.sin(u * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.globalAlpha *= 0.35;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawPath(ctx) {
    if (this.path.kind === 'learn') { this.drawPrerequisites(ctx); return; }
    const pts = this.path.nodes.map((i) => this.cam.toScreen(...this.pos(i)));
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,209,102,0.16)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,224,150,0.95)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -this.time * 0.03;
    ctx.stroke();
    ctx.setLineDash([]);
    // a comet running along the route
    if (this.store.data.settings.motion) {
      const segs = pts.length - 1;
      const u = (this.time * 0.00012) % 1 * segs;
      const k = Math.floor(u), f = u - k;
      const [x1, y1] = pts[k], [x2, y2] = pts[Math.min(k + 1, segs)];
      const x = x1 + (x2 - x1) * f, y = y1 + (y2 - y1) * f;
      ctx.drawImage(this.goldGlow, x - 18, y - 18, 36, 36);
    }
    ctx.restore();
  }

  // a learning path is a set of stars ordered by 前置 / 推导: draw those relations, not a polyline
  drawPrerequisites(ctx) {
    const set = new Set(this.path.nodes);
    const segs = [];
    for (const i of this.path.nodes) for (const e of this.g.nodes[i].out) {
      if (set.has(e.t) && this.g.orders(e)) segs.push([this.cam.toScreen(...this.pos(e.s)), this.cam.toScreen(...this.pos(e.t))]);
    }
    ctx.save();
    ctx.lineCap = 'round';
    const stroke = (style, width, dash) => {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath();
      for (const [[x1, y1], [x2, y2]] of segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
      ctx.stroke();
    };
    stroke('rgba(255,209,102,0.1)', 7, []);
    ctx.lineDashOffset = -this.time * 0.03;
    stroke('rgba(255,224,150,0.75)', 1.3, [6, 6]);
    ctx.setLineDash([]);
    // arrowheads in the middle of each relation: from prerequisite to what it unlocks
    ctx.fillStyle = 'rgba(255,224,150,0.85)';
    for (const [[x1, y1], [x2, y2]] of segs) {
      const L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 30) continue;
      const a = Math.atan2(y2 - y1, x2 - x1), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.moveTo(mx + Math.cos(a) * 5, my + Math.sin(a) * 5);
      ctx.lineTo(mx + Math.cos(a + 2.5) * 5, my + Math.sin(a + 2.5) * 5);
      ctx.lineTo(mx + Math.cos(a - 2.5) * 5, my + Math.sin(a - 2.5) * 5);
      ctx.fill();
    }
    ctx.restore();
  }

  drawNodes(ctx, w, h) {
    const cam = this.cam;
    const nodes = this.g.nodes;
    const focus = this.focus, hits = this.hits;
    const pathSet = this.path ? new Set(this.path.nodes) : null;
    const status = this.store.data.progress;
    const fav = new Set(this.store.data.fav);
    const motion = this.store.data.settings.motion;
    const t = this.time * 0.0016;
    const b = cam.bounds(60);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const base = ctx.globalAlpha;
    this.visible = [];
    for (const n of nodes) {
      const i = n.index;
      const [x, y] = this.pos(i);
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
      const [sx, sy] = cam.toScreen(x, y);
      const rs = this.screenRadius(n);
      let a = 1;
      if (!this.levelOn(n)) a = 0.07;
      else if (focus) a = focus.has(i) ? 1 : 0.16;
      else if (pathSet) a = pathSet.has(i) ? 1 : 0.25;
      else if (hits) a = hits.has(i) ? 1 : 0.32;
      if (n.lv === 'ext') a *= 0.82;
      const tw = motion ? 0.84 + 0.16 * Math.sin(t * this.freq[i] + this.phase[i]) : 1;
      const st = status[n.id] || 0;
      const glowSize = rs * (st === 2 ? 8.5 : 7) * (0.92 + 0.08 * tw);
      ctx.globalAlpha = base * a * tw;
      ctx.drawImage(st === 2 ? this.goldGlow : this.glows[n.g], sx - glowSize / 2, sy - glowSize / 2, glowSize, glowSize);
      if (st === 2) { ctx.globalAlpha = base * a * 0.7; const gs = glowSize * 0.75; ctx.drawImage(this.glows[n.g], sx - gs / 2, sy - gs / 2, gs, gs); }
      if (n.k === 'thm' && n.w >= 3 && rs > 2.4) {
        const s = rs * (6 + n.w) * (0.85 + 0.15 * tw);
        ctx.globalAlpha = base * a * 0.75;
        ctx.drawImage(this.spikes[n.g], sx - s / 2, sy - s / 2, s, s);
      }
      this.visible.push([i, sx, sy, rs, a]);
    }
    ctx.globalCompositeOperation = 'source-over';
    // cores, kind shapes, status rings
    for (const [i, sx, sy, rs, a] of this.visible) {
      const n = nodes[i];
      if (rs < 2.2) continue;
      ctx.globalAlpha = base * a;
      const [r, g, bb] = n.galaxy.rgb;
      ctx.fillStyle = `rgb(${(r + 255 * 2) / 3 | 0},${(g + 255 * 2) / 3 | 0},${(bb + 255 * 2) / 3 | 0})`;
      ctx.strokeStyle = ctx.fillStyle;
      const cr = rs * 0.55;
      ctx.beginPath();
      if (n.k === 'method') { ctx.moveTo(sx, sy - cr * 1.3); ctx.lineTo(sx + cr * 1.3, sy); ctx.lineTo(sx, sy + cr * 1.3); ctx.lineTo(sx - cr * 1.3, sy); ctx.closePath(); ctx.fill(); }
      else if (n.k === 'example') { ctx.lineWidth = Math.max(1, rs * 0.25); ctx.arc(sx, sy, cr * 1.05, 0, Math.PI * 2); ctx.stroke(); }
      else if (n.k === 'app') { for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + (k * Math.PI) / 3; const px = sx + Math.cos(an) * cr * 1.2, py = sy + Math.sin(an) * cr * 1.2; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); }
      else { ctx.arc(sx, sy, cr, 0, Math.PI * 2); ctx.fill(); }
      const st = status[n.id] || 0;
      if (st && rs > 2.8) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = st === 2 ? 'rgba(255,214,120,0.95)' : 'rgba(126,232,255,0.85)';
        ctx.setLineDash(st === 1 ? [2.5, 3] : []);
        ctx.beginPath();
        ctx.arc(sx, sy, rs * 1.7 + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (fav.has(n.id) && rs > 3) this.drawSparkle(ctx, sx + rs * 1.5 + 4, sy - rs * 1.5 - 4, 4.5, 'rgba(255,214,120,0.95)');
      if (pathSet && this.path.numbered && pathSet.has(i)) {
        const k = this.path.nodes.indexOf(i) + 1;
        ctx.fillStyle = 'rgba(255,214,120,0.95)';
        ctx.font = `600 10px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(String(k), sx - rs * 1.4 - 3, sy - rs * 1.2);
      }
    }
    ctx.globalAlpha = base;
    // hover / selection / search pulses
    const ring = (i, r0, alpha, dash, spin) => {
      const v = this.visible.find((x) => x[0] === i);
      if (!v) return;
      const [, sx, sy, rs] = v;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 1.3;
      ctx.setLineDash(dash);
      ctx.lineDashOffset = spin ? -this.time * 0.02 : 0;
      ctx.beginPath();
      ctx.arc(sx, sy, rs * 2 + r0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (hits && hits.size < 80) for (const i of hits) {
      const pulse = (this.time * 0.0012) % 1;
      ring(i, 4 + pulse * 18, 0.6 * (1 - pulse), [], false);
    }
    if (this.hover >= 0 && this.hover !== this.sel) ring(this.hover, 4, 0.55, [], false);
    if (this.sel >= 0) { ring(this.sel, 7, 0.9, [5, 5], true); const p = (this.time * 0.0009) % 1; ring(this.sel, 7 + p * 26, 0.5 * (1 - p), [], false); }
    ctx.restore();
  }

  drawSparkle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const an = (k * Math.PI) / 4 - Math.PI / 2;
      const rr = k % 2 ? r * 0.38 : r;
      const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  labelFont(n) {
    const k = this.cam.k;
    return Math.round((11 + n.w * 0.95) * clamp(Math.pow(k, 0.16), 0.86, 1.22));
  }
  measure(ctx, n, px) {
    const key = `${n.index}:${px}`;
    let wd = this.labelWidth.get(key);
    if (wd == null) { ctx.font = `${n.w >= 4 ? 600 : 500} ${px}px ${FONT}`; wd = ctx.measureText(n.t).width; this.labelWidth.set(key, wd); }
    return wd;
  }

  drawLabels(ctx, w, h) {
    const cam = this.cam;
    const nodes = this.g.nodes;
    const k = cam.k;
    const settings = this.store.data.settings;
    // galaxy names when zoomed far out; while they are clearly visible other labels keep off them
    const ga = 1 - smoothstep(0.19, 0.34, k);
    const placed = [];
    const overlaps = (x0, y0, x1, y1) => placed.some((r) => !(x1 < r[0] || x0 > r[2] || y1 < r[1] || y0 > r[3]));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (ga > 0.01) {
      for (const G of this.g.galaxies) {
        const [sx, sy] = cam.toScreen(G.x, G.y);
        ctx.globalAlpha = ga * (1 - this.dim);
        const size = Math.round(clamp(G.r * k * 0.16, 18, 34));
        ctx.font = `600 ${size}px ${SERIF}`;
        if (ga > 0.3 && !this.focus) {
          const tw = ctx.measureText(G.name).width;
          placed.push([sx - tw / 2 - 8, sy - 6 - size * 0.7, sx + tw / 2 + 8, sy + 26]);
        }
        ctx.fillStyle = rgba(G.rgb, 0.95);
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 12;
        ctx.fillText(G.name, sx, sy - 6);
        ctx.shadowBlur = 0;
        ctx.font = `500 10px ${FONT}`;
        ctx.fillStyle = 'rgba(220,228,255,0.6)';
        ctx.fillText(G.en.toUpperCase(), sx, sy + 18);
      }
    }
    // cluster names in the middle range
    const ca = smoothstep(0.1, 0.17, k) * (1 - smoothstep(0.42, 0.75, k));
    if (ca > 0.01 && !this.focus) {
      for (const c of this.g.clusters) {
        if (!c.members.length) continue;
        const [sx, sy] = cam.toScreen(c.x, c.y);
        if (sx < -100 || sx > w + 100 || sy < -40 || sy > h + 40) continue;
        ctx.font = `600 ${Math.round(clamp(12 + c.members.length * 0.12, 12, 16))}px ${FONT}`;
        const tw = ctx.measureText(c.name).width;
        if (overlaps(sx - tw / 2 - 6, sy - 12, sx + tw / 2 + 6, sy + 12)) continue;
        placed.push([sx - tw / 2 - 6, sy - 12, sx + tw / 2 + 6, sy + 12]);
        ctx.globalAlpha = ca * 0.85 * (1 - this.dim);
        ctx.fillStyle = rgba(c.galaxy.rgb, 1);
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText(c.name, sx, sy);
        ctx.shadowBlur = 0;
      }
    }
    if (!settings.labels && this.sel < 0 && this.hover < 0) return;
    // star names: priority order, skip collisions
    const focus = this.focus, hits = this.hits, pathSet = this.path ? new Set(this.path.nodes) : null;
    const vis = this.visible || [];
    const prio = (i) => {
      if (i === this.sel) return 1e6;
      if (i === this.hover) return 9e5;
      if (pathSet && pathSet.has(i)) return 5e5 + nodes[i].w;
      if (focus && focus.has(i)) return 4e5 + nodes[i].w * 10 + nodes[i].degree;
      if (hits && hits.has(i)) return 3e5 + nodes[i].w;
      return nodes[i].w * 100 + Math.min(nodes[i].degree, 40);
    };
    const cand = [];
    for (const v of vis) {
      const i = v[0];
      const n = nodes[i];
      if (v[4] < 0.1) continue;
      const p = prio(i);
      if (p < 1e5) {
        if (!settings.labels || focus) { if (!(n.w >= 5 && k > 0.2)) continue; }
        const eff = n.w + Math.min(1.4, n.degree / 14);
        const need = 1.15 / Math.pow(eff, 1.45) * (n.lv === 'ext' ? 1.25 : 1);
        if (k < need) continue;
      }
      cand.push([p, v]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    let drawn = 0;
    ctx.textBaseline = 'alphabetic';
    for (const [p, [i, sx, sy, rs, a]] of cand) {
      if (drawn > 260) break;
      const n = nodes[i];
      const px = this.labelFont(n);
      const tw = this.measure(ctx, n, px);
      const y = sy + rs * 1.15 + px + 2;
      const box = [sx - tw / 2 - 3, y - px, sx + tw / 2 + 3, y + 4];
      if (p < 1e6 && overlaps(...box)) continue;
      placed.push(box);
      drawn++;
      ctx.font = `${n.w >= 4 || p >= 9e5 ? 600 : 500} ${px}px ${FONT}`;
      const strong = p >= 3e5;
      ctx.globalAlpha = (strong ? 1 : clamp(a, 0.25, 0.92)) * (1 - this.dim);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(3,4,12,0.85)';
      ctx.strokeText(n.t, sx, y);
      ctx.fillStyle = i === this.sel ? '#ffffff' : strong ? 'rgba(240,244,255,0.98)' : `rgba(${(n.galaxy.rgb[0] + 230 * 3) / 4 | 0},${(n.galaxy.rgb[1] + 236 * 3) / 4 | 0},${(n.galaxy.rgb[2] + 255 * 3) / 4 | 0},0.86)`;
      ctx.fillText(n.t, sx, y);
    }
    ctx.globalAlpha = 1;
  }

  /** small overview map: galaxies, the viewport and the selection */
  drawMinimap(ctx, w, h) {
    const gs = this.g.galaxies;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const G of gs) { x0 = Math.min(x0, G.x - G.r); x1 = Math.max(x1, G.x + G.r); y0 = Math.min(y0, G.y - G.r); y1 = Math.max(y1, G.y + G.r); }
    const s = Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.92;
    const ox = w / 2 - ((x0 + x1) / 2) * s, oy = h / 2 - ((y0 + y1) / 2) * s;
    this.mini = { s, ox, oy };
    ctx.clearRect(0, 0, w, h);
    for (const n of this.g.nodes) {
      ctx.fillStyle = rgba(n.galaxy.rgb, this.store.data.progress[n.id] === 2 ? 1 : 0.55);
      ctx.fillRect(n.x * s + ox, n.y * s + oy, 1.2, 1.2);
    }
    const b = this.cam.bounds();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    const rx = b.x0 * s + ox, ry = b.y0 * s + oy, rw = (b.x1 - b.x0) * s, rh = (b.y1 - b.y0) * s;
    ctx.strokeRect(Math.max(0.5, rx), Math.max(0.5, ry), Math.min(w - 1, rw), Math.min(h - 1, rh));
    if (this.sel >= 0) {
      const n = this.g.nodes[this.sel];
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(n.x * s + ox, n.y * s + oy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  minimapToWorld(mx, my) {
    const m = this.mini;
    return m ? [(mx - m.ox) / m.s, (my - m.oy) / m.s] : [0, 0];
  }
}
