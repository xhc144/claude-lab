// Things drawn on top of the terrain in screen space: creatures with procedural bodies read from
// their genomes, cities whose buildings change style with the era, armies, fleets, settlers and
// caravans, nation names, prayers, monsters, tornadoes and the player's strange works.

import { hash2 } from '../core/rng.js';
import { clamp, fmtNum } from '../core/util.js';
import { FORM, phenotype } from '../sim/life/genome.js';

const TAU = Math.PI * 2;
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// ---- creatures ----------------------------------------------------------------------------------

export function drawCreatures(ctx, R, view, game) {
  const w = R.world;
  const L = w.life;
  const z = view.z;
  if (z < 2.2) return;
  const cam = R.cam;
  const cols = new Array(w.species.length);
  const detail = z >= 7;
  const t = R.time;
  const sel = R.selection && R.selection.type === 'creature' ? R.selection.uid : -1;
  for (let i = 0; i < L.hi; i++) {
    if (!L.alive[i]) continue;
    const x = L.x[i], y = L.y[i];
    if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
    const s = L.sp[i];
    let col = cols[s];
    if (!col) col = cols[s] = w.species[s].color;
    const [sx, sy] = cam.toScreen(x, y);
    if (!detail) {
      const r = Math.max(1, z * (0.12 + L.pSize[i] * 0.08));
      ctx.fillStyle = rgb(col);
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      continue;
    }
    drawBody(ctx, sx, sy, z, L, i, col, t);
    if (L.uid[i] === sel) {
      ctx.strokeStyle = 'rgba(255,240,180,0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, z * (0.4 + L.pSize[i] * 0.3), 0, TAU); ctx.stroke();
    }
  }
}

function drawBody(ctx, sx, sy, z, L, i, col, t) {
  const size = L.pSize[i];
  const s = z * (0.18 + size * 0.2);
  const face = Math.cos(L.dir[i]) >= 0 ? 1 : -1;
  const form = L.pForm[i];
  const phase = t * 8 + i * 1.7;
  const dark = rgb(shade(col, 0.6));
  const body = rgb(col);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(face, 1);
  ctx.lineWidth = Math.max(1, s * 0.18);
  ctx.lineCap = 'round';
  switch (form) {
    case FORM.FISH: case FORM.SHARK: case FORM.WHALE: case FORM.SHRIMP: {
      const sw = Math.sin(phase) * 0.25;
      const big = form === FORM.WHALE ? 1.6 : form === FORM.SHARK ? 1.25 : form === FORM.SHRIMP ? 0.7 : 1;
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2 * big, s * 0.55 * big, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-s * 1.1 * big, 0);
      ctx.lineTo(-s * 1.8 * big, -s * (0.6 + sw) * big);
      ctx.lineTo(-s * 1.8 * big, s * (0.6 - sw) * big);
      ctx.closePath(); ctx.fill();
      if (form === FORM.SHARK) { ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.5); ctx.lineTo(s * 0.2, -s * 1.1); ctx.lineTo(s * 0.5, -s * 0.45); ctx.fill(); }
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(s * 0.75 * big, -s * 0.12 * big, Math.max(0.8, s * 0.12), 0, TAU); ctx.fill();
      break;
    }
    case FORM.BIRD: case FORM.RAPTOR: case FORM.MOTH: {
      const flap = Math.sin(phase * 1.6);
      const span = form === FORM.RAPTOR ? 1.6 : form === FORM.MOTH ? 0.9 : 1.2;
      ctx.strokeStyle = body;
      ctx.lineWidth = Math.max(1.2, s * 0.35);
      ctx.beginPath();
      ctx.moveTo(-s * span, -s * flap * 0.8);
      ctx.quadraticCurveTo(-s * 0.4, -s * 0.2, 0, 0);
      ctx.quadraticCurveTo(s * 0.4, -s * 0.2, s * span, -s * flap * 0.8);
      ctx.stroke();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.35, s * 0.22, 0, 0, TAU); ctx.fill();
      break;
    }
    case FORM.TURTLE: {
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(s * 0.9, s * 0.05, s * 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.95, s * 0.6, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = dark;
      ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.lineTo(-s * 0.5, s * 0.25); ctx.moveTo(s * 0.5, 0); ctx.lineTo(s * 0.5, s * 0.25); ctx.stroke();
      break;
    }
    case FORM.FROG: case FORM.NEWT: case FORM.CROC: case FORM.LIZARD: {
      const long = form === FORM.CROC ? 1.7 : form === FORM.FROG ? 0.8 : 1.2;
      ctx.strokeStyle = dark;
      const step = Math.sin(phase) * s * 0.25;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, 0); ctx.lineTo(-s * 0.7 - step, s * 0.45);
      ctx.moveTo(s * 0.4, 0); ctx.lineTo(s * 0.6 + step, s * 0.45);
      ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, s * long, s * (form === FORM.FROG ? 0.55 : 0.32), 0, 0, TAU); ctx.fill();
      if (form !== FORM.FROG) { ctx.beginPath(); ctx.moveTo(-s * long * 0.9, 0); ctx.lineTo(-s * long * 1.7, s * 0.1); ctx.lineTo(-s * long * 0.9, s * 0.15); ctx.fill(); }
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(s * long * 0.75, -s * 0.12, Math.max(0.8, s * 0.1), 0, TAU); ctx.fill();
      break;
    }
    case FORM.APE: {
      const step = Math.sin(phase) * s * 0.3;
      ctx.strokeStyle = dark;
      ctx.beginPath(); ctx.moveTo(0, s * 0.2); ctx.lineTo(-step, s * 0.9); ctx.moveTo(0, s * 0.2); ctx.lineTo(step, s * 0.9); ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.1, s * 0.35, s * 0.55, 0.15, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.15, -s * 0.8, s * 0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = body;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.55, s * 0.1 + step * 0.4); ctx.stroke();
      break;
    }
    default: {
      // quadrupeds: rodent, hare, deer, bovine, behemoth, mustelid, fox, wolf, tiger, dragon, boar
      const tall = form === FORM.DEER ? 1.25 : form === FORM.RODENT || form === FORM.MUSTELID ? 0.55 : form === FORM.BEHEMOTH ? 1.1 : 0.9;
      const len = form === FORM.MUSTELID ? 1.5 : form === FORM.BEHEMOTH || form === FORM.DRAGON ? 1.35 : 1.05;
      const step = Math.sin(phase) * s * 0.28;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, s * (form === FORM.BEHEMOTH ? 0.32 : 0.18));
      const legY = s * 0.25, legL = s * 0.65 * tall;
      ctx.beginPath();
      ctx.moveTo(-s * 0.55 * len, legY); ctx.lineTo(-s * 0.55 * len - step, legY + legL);
      ctx.moveTo(-s * 0.35 * len, legY); ctx.lineTo(-s * 0.35 * len + step, legY + legL);
      ctx.moveTo(s * 0.45 * len, legY); ctx.lineTo(s * 0.45 * len + step, legY + legL);
      ctx.moveTo(s * 0.65 * len, legY); ctx.lineTo(s * 0.65 * len - step, legY + legL);
      ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.85 * len, s * 0.42 * (form === FORM.BEHEMOTH ? 1.3 : 1), 0, 0, TAU); ctx.fill();
      // stripes / spots from the pattern gene
      if (L.pArmor[i] > 0.5 || form === FORM.TIGER) {
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(1, s * 0.12);
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * s * 0.35, -s * 0.38); ctx.lineTo(k * s * 0.3, s * 0.1); ctx.stroke(); }
      }
      // head
      ctx.fillStyle = body;
      const hx = s * 0.95 * len, hy = -s * 0.25 * tall;
      ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.32, s * 0.26, -0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(hx + s * 0.1, hy - s * 0.05, Math.max(0.8, s * 0.08), 0, TAU); ctx.fill();
      ctx.strokeStyle = dark;
      if (form === FORM.DEER || form === FORM.BOVINE || form === FORM.BEHEMOTH) {
        ctx.lineWidth = Math.max(1, s * 0.12);
        ctx.beginPath(); ctx.moveTo(hx - s * 0.05, hy - s * 0.2); ctx.lineTo(hx - s * 0.2, hy - s * 0.65); ctx.moveTo(hx - s * 0.15, hy - s * 0.48); ctx.lineTo(hx - s * 0.4, hy - s * 0.6); ctx.stroke();
      }
      if (form === FORM.DRAGON) {
        const flap = Math.sin(phase * 0.8);
        ctx.fillStyle = rgb(shade(col, 0.75), 0.9);
        ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.3); ctx.lineTo(-s * 0.9, -s * (1.3 + flap * 0.3)); ctx.lineTo(s * 0.3, -s * 0.35); ctx.closePath(); ctx.fill();
      }
      // tail
      ctx.lineWidth = Math.max(1, s * 0.14);
      ctx.beginPath(); ctx.moveTo(-s * 0.85 * len, -s * 0.05); ctx.quadraticCurveTo(-s * 1.25 * len, -s * 0.2 + step * 0.5, -s * 1.35 * len, s * 0.15); ctx.stroke();
    }
  }
  ctx.restore();
}

/** draw a creature with the given genes (for the species designer) */
export function drawGenomePreview(ctx, x, y, z, genes, color, t) {
  const g = Float32Array.from(genes);
  const ph = phenotype(g, 0, {});
  const L = { pSize: [ph.size], dir: [0], pForm: [ph.form], pArmor: [ph.armor] };
  drawBody(ctx, x, y, z, L, 0, color, t);
}

// ---- markers: strange works, ruins, volcanoes, tornadoes, monsters ---------------------------------

export function drawMarkers(ctx, R, view, game) {
  const w = R.world;
  const cam = R.cam;
  const z = view.z;
  const t = R.time;
  const inView = (x, y, m = 4) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;

  // time bubbles
  for (const b of w.bubbles) {
    if (!inView(b.x, b.y, b.r)) continue;
    const [sx, sy] = cam.toScreen(b.x, b.y);
    const r = b.r * z;
    const g = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r);
    g.addColorStop(0, 'rgba(150,220,255,0.02)');
    g.addColorStop(1, `rgba(150,220,255,${0.22 + 0.08 * Math.sin(t * 3)})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,0.5)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU + t * 0.8;
      ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * r * 0.92, sy + Math.sin(a) * r * 0.92); ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(t * 4) * r * 0.25, sy + Math.sin(t * 4) * r * 0.25); ctx.stroke();
  }
  // portals
  for (const p of w.portals) {
    const a = cam.toScreen(p.ax, p.ay), b = cam.toScreen(p.bx, p.by);
    ctx.save();
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeStyle = 'rgba(190,120,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 80, b[0], b[1]);
    ctx.stroke();
    ctx.restore();
    for (const [sx, sy] of [a, b]) {
      const r = Math.max(6, z * 0.9);
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(${170 + k * 30},${90 + k * 40},255,${0.8 - k * 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(sx, sy, r * (1 - k * 0.25), r * 1.4 * (1 - k * 0.25), 0, t * (2 + k) % TAU, t * (2 + k) % TAU + Math.PI * 1.5); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(20,0,40,0.85)';
      ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.45, r * 0.7, 0, 0, TAU); ctx.fill();
    }
  }
  // monoliths
  for (const m of w.monoliths) {
    if (!inView(m.x, m.y, m.r)) continue;
    const [sx, sy] = cam.toScreen(m.x, m.y);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, m.r * z);
    g.addColorStop(0, 'rgba(120,255,240,0.12)');
    g.addColorStop(1, 'rgba(120,255,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, m.r * z, 0, TAU); ctx.fill();
    const h = Math.max(10, z * 2.4), ww = h * 0.28;
    ctx.fillStyle = '#07080c';
    ctx.fillRect(sx - ww / 2, sy - h, ww, h);
    ctx.fillStyle = `rgba(140,255,240,${0.3 + 0.3 * Math.sin(t * 1.5)})`;
    ctx.fillRect(sx - ww / 2, sy - h, 1.5, h);
  }
  // world trees
  for (const tr of w.trees || []) {
    if (!inView(tr.x, tr.y, tr.r)) continue;
    const [sx, sy] = cam.toScreen(tr.x, tr.y);
    const s = Math.max(14, z * 3.2);
    const g = ctx.createRadialGradient(sx, sy - s, 0, sx, sy - s, s * 2.2);
    g.addColorStop(0, 'rgba(255,240,170,0.25)');
    g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy - s, s * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3d24';
    ctx.beginPath(); ctx.moveTo(sx - s * 0.18, sy); ctx.lineTo(sx - s * 0.08, sy - s); ctx.lineTo(sx + s * 0.08, sy - s); ctx.lineTo(sx + s * 0.18, sy); ctx.fill();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      const bx = sx + Math.cos(a) * s * 0.55, by = sy - s * 1.15 + Math.sin(a) * s * 0.35;
      ctx.fillStyle = k % 2 ? '#3f8f4a' : '#58a85a';
      ctx.beginPath(); ctx.arc(bx, by, s * 0.45, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#6cc070';
    ctx.beginPath(); ctx.arc(sx, sy - s * 1.35, s * 0.5, 0, TAU); ctx.fill();
    for (let k = 0; k < 6; k++) {
      const a = t * 0.5 + k;
      ctx.fillStyle = `rgba(255,240,170,${0.5 + 0.5 * Math.sin(t * 2 + k)})`;
      ctx.fillRect(sx + Math.cos(a) * s * 0.8, sy - s * 1.2 + Math.sin(a * 1.3) * s * 0.4, 2, 2);
    }
  }
  // ruins
  if (z >= 4) {
    for (const r of w.ruins) {
      if (!inView(r.x, r.y)) continue;
      const [sx, sy] = cam.toScreen(r.x + 0.5, r.y + 0.5);
      const s = Math.max(3, z * 0.35);
      ctx.fillStyle = r.underwater ? 'rgba(170,200,210,0.6)' : 'rgba(186,178,164,0.9)';
      ctx.fillRect(sx - s, sy - s * 1.6, s * 0.5, s * 1.6);
      ctx.fillRect(sx + s * 0.4, sy - s * 0.9, s * 0.5, s * 0.9);
      ctx.fillRect(sx - s * 1.3, sy, s * 2.6, s * 0.35);
      if (z >= 9 && R.opts.labels) label(ctx, `${r.name}遗迹`, sx, sy + s + 9, 10, 'rgba(220,210,190,0.75)');
    }
  }
  // active volcanoes
  for (const v of w.volcanoes) {
    if (!inView(v.x, v.y) || (v.heat < 0.5 && !v.erupting)) continue;
    const [sx, sy] = cam.toScreen(v.x + 0.5, v.y + 0.5);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(6, z * 1.2));
    g.addColorStop(0, `rgba(255,${v.erupting ? 140 : 90},40,${v.erupting ? 0.8 : 0.35})`);
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(6, z * 1.2), 0, TAU); ctx.fill();
  }
  // tornadoes
  for (const tw of w.tornadoes) {
    if (!inView(tw.x, tw.y)) continue;
    const [sx, sy] = cam.toScreen(tw.x, tw.y);
    const s = Math.max(8, z * 1.6 * tw.power);
    for (let k = 0; k < 7; k++) {
      const u = k / 6;
      const rr = s * (0.15 + u * 0.7);
      const wob = Math.sin(t * 6 + k) * s * 0.12 * u;
      ctx.strokeStyle = `rgba(170,170,180,${0.75 - u * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx + wob, sy - u * s * 2.2, rr, rr * 0.3, 0, t * 8 + k, t * 8 + k + 4.5); ctx.stroke();
    }
  }
  // monsters
  for (const m of w.monsters) {
    if (!inView(m.x, m.y, 6)) continue;
    const [sx, sy] = cam.toScreen(m.x, m.y);
    const s = Math.max(10, z * 1.6 * m.size);
    const bob = Math.sin(t * 3) * s * 0.05;
    ctx.fillStyle = `hsl(${m.hue},35%,18%)`;
    ctx.beginPath(); ctx.ellipse(sx, sy - s * 0.6 + bob, s * 1.1, s * 0.75, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + s * 0.9, sy - s * 1.2 + bob, s * 0.45, s * 0.38, -0.4, 0, TAU); ctx.fill();
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(sx - s * 0.7 + k * s * 0.35, sy - s * 1.2 + bob); ctx.lineTo(sx - s * 0.55 + k * s * 0.35, sy - s * 1.7 + bob); ctx.lineTo(sx - s * 0.4 + k * s * 0.35, sy - s * 1.15 + bob); ctx.fill(); }
    ctx.lineWidth = s * 0.25;
    ctx.strokeStyle = ctx.fillStyle;
    for (const lx of [-0.6, -0.2, 0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(sx + lx * s, sy - s * 0.3); ctx.lineTo(sx + lx * s + Math.sin(t * 4 + lx * 5) * s * 0.15, sy); ctx.stroke(); }
    ctx.fillStyle = '#ff5030';
    ctx.beginPath(); ctx.arc(sx + s * 1.05, sy - s * 1.27 + bob, Math.max(1.5, s * 0.08), 0, TAU); ctx.fill();
    // health bar and name
    const bw = s * 2.4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - bw / 2, sy - s * 2.1, bw, 4);
    ctx.fillStyle = '#e04030'; ctx.fillRect(sx - bw / 2, sy - s * 2.1, bw * clamp(m.hp / m.maxHp, 0, 1), 4);
    label(ctx, `巨兽「${m.name}」`, sx, sy - s * 2.1 - 8, 12, '#ffb090');
  }
}

// ---- civilisation -------------------------------------------------------------------------------

export function drawCivilization(ctx, R, view, game) {
  const w = R.world;
  if (!w.nations.length) return;
  const cam = R.cam;
  const z = view.z;
  const t = R.time;
  const inView = (x, y, m = 3) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;

  // trade routes and caravans
  if (z >= 2.5) {
    for (const r of w.routes) {
      const p = r.path;
      if (!p || p.length < 2) continue;
      const A = w.cities[r.a];
      const B = w.cities[r.b];
      if (!inView(A.x, A.y, 40) && !inView(B.x, B.y, 40)) continue;
      ctx.save();
      ctx.strokeStyle = r.sea ? 'rgba(170,215,255,0.35)' : 'rgba(255,220,150,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash(r.sea ? [2, 5] : [4, 4]);
      ctx.beginPath();
      for (let k = 0; k < p.length; k++) {
        const c = p[k];
        const [sx, sy] = cam.toScreen((c % w.W) + 0.5, Math.floor(c / w.W) + 0.5);
        if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();
      // moving caravans / ships
      const n = Math.min(3, 1 + Math.floor(p.length / 25));
      for (let k = 0; k < n; k++) {
        let u = ((t * 2.5) / p.length + k / n + hash2(r.id, 3, 1)) % 1;
        const fwd = k % 2 === 0;
        if (!fwd) u = 1 - u;
        const fi = u * (p.length - 1);
        const i0 = Math.floor(fi), i1 = Math.min(p.length - 1, i0 + 1), f = fi - i0;
        const x = ((p[i0] % w.W) + 0.5) * (1 - f) + ((p[i1] % w.W) + 0.5) * f;
        const y = (Math.floor(p[i0] / w.W) + 0.5) * (1 - f) + (Math.floor(p[i1] / w.W) + 0.5) * f;
        if (!inView(x, y, 1)) continue;
        const [sx, sy] = cam.toScreen(x, y);
        const water = w.elev[Math.floor(y) * w.W + Math.floor(x)] < w.seaLevel;
        if (z >= 6) {
          if (water) drawBoat(ctx, sx, sy, z * 0.5, [240, 230, 210], w.nations[A.nation].era >= 6);
          else { ctx.fillStyle = '#8a6a44'; ctx.fillRect(sx - z * 0.2, sy - z * 0.12, z * 0.4, z * 0.24); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(sx - z * 0.18, sy - z * 0.26, z * 0.3, z * 0.14); }
        } else {
          ctx.fillStyle = water ? '#e6f2ff' : '#ffe2a0';
          ctx.fillRect(sx - 1, sy - 1, 2.5, 2.5);
        }
      }
    }
  }

  // nation names over their lands
  if (R.opts.labels && z < 7 && R.overlay.labels.length) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of R.overlay.labels) {
      const n = w.nations[l.id];
      if (!n || !n.alive || !inView(l.x, l.y, 10)) continue;
      const size = clamp(Math.sqrt(l.cells) * z * 0.22, 11, 38);
      if (size < 11.5 && l.cells < 60) continue;
      const [sx, sy] = cam.toScreen(l.x, l.y);
      ctx.font = `600 ${size}px "Noto Serif SC","Songti SC","STSong",serif`;
      ctx.lineWidth = Math.max(2, size * 0.14);
      ctx.strokeStyle = 'rgba(10,12,20,0.55)';
      ctx.globalAlpha = 0.85;
      const text = spaced(n.name);
      ctx.strokeText(text, sx, sy);
      ctx.fillStyle = rgb(n.color.map((v) => Math.min(255, v * 0.6 + 110)));
      ctx.fillText(text, sx, sy);
    }
    ctx.restore();
  }

  // settlers
  for (const s of w.settlers) {
    if (!inView(s.x, s.y)) continue;
    const [sx, sy] = cam.toScreen(s.x, s.y);
    const n = w.nations[s.nation];
    if (z < 4) { ctx.fillStyle = rgb(n.color); ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3); continue; }
    if (s.naval) drawBoat(ctx, sx, sy, z * 0.55, n.color, n.era >= 6);
    else {
      const q = z * 0.3;
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(sx - q, sy - q * 0.4, q * 2, q * 0.8);
      ctx.fillStyle = '#efe6d0'; ctx.beginPath(); ctx.ellipse(sx, sy - q * 0.5, q * 0.9, q * 0.6, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(sx - q * 0.6, sy + q * 0.45, q * 0.3, 0, TAU); ctx.arc(sx + q * 0.6, sy + q * 0.45, q * 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = rgb(n.color); ctx.fillRect(sx + q * 0.8, sy - q * 1.6, q * 0.6, q * 0.4);
    }
  }

  // cities
  const night = R.opts.daynight ? R.nightCenter : null;
  const sel = R.selection && R.selection.type === 'city' ? R.selection.id : -1;
  const list = w.cities.filter((c) => c.alive && inView(c.x, c.y, 4));
  list.sort((a, b) => a.y - b.y);
  // decide which labels fit: capitals and big cities claim space first
  const placed = [];
  const labelOK = new Set();
  if (R.opts.labels) {
    for (const c of list.slice().sort((a, b) => (b.capital - a.capital) || b.pop - a.pop)) {
      const [sx, sy] = cam.toScreen(c.x + 0.5, c.y + 0.5);
      const fs = clamp(9 + c.tier * 1.2 + (z - 4) * 0.4, 9, 15);
      const ly = sy + Math.max(7, z * (0.45 + c.tier * 0.12)) + fs * 0.7;
      const wdt = (c.name.z.length + (z >= 6.5 ? 4 : 0)) * fs * 0.9 + 14;
      const box = [sx - wdt / 2, ly - fs * 0.75, sx + wdt / 2, ly + fs * 0.75];
      if (placed.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3])) continue;
      placed.push(box);
      labelOK.add(c.id);
    }
  }
  for (const c of list) {
    const n = w.nations[c.nation];
    const [sx, sy] = cam.toScreen(c.x + 0.5, c.y + 0.5);
    if (z < 3.2) drawCityDot(ctx, c, n, sx, sy, z);
    else if (z < 8) drawCityIcon(ctx, c, n, sx, sy, z, t);
    else drawCityDetail(ctx, c, n, sx, sy, z, t, w);
    if (night != null && Math.abs(sx - night) < cam.vw * 0.3) drawLights(ctx, c, n, sx, sy, z);
    if (c.id === sel) {
      ctx.strokeStyle = 'rgba(255,240,180,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -t * 15;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(8, z * (0.9 + c.tier * 0.35)), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    // status badges
    if (z >= 3.2) {
      let bx = sx + Math.max(6, z * 0.7);
      if (w.tick - c.siege < 3) { badge(ctx, bx, sy - z * 0.6, '#e04a3a', '⚔'); bx += 12; }
      if (c.disease > 0.08) { badge(ctx, bx, sy - z * 0.6, '#5aa040', '☣'); bx += 12; }
      if (c.prayer) drawPrayer(ctx, c, sx, sy - Math.max(14, z * 1.4), t);
    }
    if (labelOK.has(c.id) && (z >= 4.2 || (z >= 2.6 && c.tier >= 3) || c.capital && z >= 2.2)) {
      const fs = clamp(9 + c.tier * 1.2 + (z - 4) * 0.4, 9, 15);
      const ly = sy + Math.max(7, z * (0.45 + c.tier * 0.12)) + fs * 0.7;
      cityLabel(ctx, c, n, sx, ly, fs, z >= 6.5);
    }
  }

  // armies and fleets
  const selA = R.selection && R.selection.type === 'army' ? R.selection.id : -1;
  for (const a of w.armies) {
    if (!a.alive || !inView(a.x, a.y)) continue;
    const n = w.nations[a.nation];
    const [sx, sy] = cam.toScreen(a.x, a.y);
    drawArmy(ctx, a, n, sx, sy, z, t);
    if (a.id === selA) {
      ctx.strokeStyle = 'rgba(255,240,180,0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(8, z * 0.8), 0, TAU); ctx.stroke();
      if (a.path && a.pi < a.path.length) {
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(255,240,180,0.6)';
        ctx.beginPath(); ctx.moveTo(sx, sy);
        for (let k = a.pi; k < a.path.length; k += 2) { const c = a.path[k]; const [px, py] = cam.toScreen((c % w.W) + 0.5, Math.floor(c / w.W) + 0.5); ctx.lineTo(px, py); }
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function spaced(s) {
  return s.length <= 6 ? s.split('').join(' ') : s;
}

function label(ctx, text, x, y, size, color) {
  ctx.save();
  ctx.font = `${size}px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8,10,18,0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function badge(ctx, x, y, color, glyph) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x, y + 0.5);
}

const PRAYER_GLYPH = { smite: '战', heal: '医', rain: '雨', bless: '丰', peace: '安' };
function drawPrayer(ctx, c, x, y, t) {
  const bob = Math.sin(t * 3 + c.id) * 2;
  const g = ctx.createRadialGradient(x, y + bob, 0, x, y + bob, 12);
  g.addColorStop(0, 'rgba(255,236,160,0.95)');
  g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y + bob, 12, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5a3a00';
  ctx.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(PRAYER_GLYPH[c.prayer.need] || '?', x, y + bob + 0.5);
}

function cityLabel(ctx, c, n, x, y, fs, showPop) {
  ctx.save();
  ctx.font = `${c.capital ? '600 ' : ''}${fs}px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = c.name.z + (showPop ? `  ${fmtNum(c.pop)}` : '');
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(10,12,22,0.62)';
  const pad = 4;
  roundRect(ctx, x - tw / 2 - pad - 5, y - fs * 0.7, tw + pad * 2 + 5, fs * 1.4, 4);
  ctx.fill();
  ctx.fillStyle = rgb(n.color);
  ctx.fillRect(x - tw / 2 - pad - 5, y - fs * 0.7, 4, fs * 1.4);
  ctx.fillStyle = c.capital ? '#ffe9b0' : '#eef2fa';
  ctx.fillText(text, x + 2, y + 0.5);
  if (c.capital) {
    // a small crown
    const cx = x - tw / 2 - 2, cy = y - fs * 0.95;
    ctx.fillStyle = '#ffd56a';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 3); ctx.lineTo(cx - 4, cy - 1); ctx.lineTo(cx - 2, cy + 1); ctx.lineTo(cx, cy - 2); ctx.lineTo(cx + 2, cy + 1); ctx.lineTo(cx + 4, cy - 1); ctx.lineTo(cx + 4, cy + 3);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCityDot(ctx, c, n, sx, sy, z) {
  const r = 1.6 + c.tier * 0.8;
  ctx.fillStyle = 'rgba(10,10,16,0.75)';
  ctx.beginPath(); ctx.arc(sx, sy, r + 1.2, 0, TAU); ctx.fill();
  ctx.fillStyle = c.capital ? '#ffe9b0' : rgb(n.color.map((v) => Math.min(255, v + 60)));
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
}

const ROOFS = [[150, 110, 70], [176, 82, 56], [130, 70, 52], [96, 104, 120], [70, 90, 130]];

function drawCityIcon(ctx, c, n, sx, sy, z, t) {
  const era = n.era;
  const k = Math.min(7, 1 + c.tier * 1.4);
  const s = z * 0.32;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(sx, sy + s * 0.6, s * (1.6 + c.tier * 0.5), s * 0.6, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < k; i++) {
    const a = hash2(c.id, i, 3) * TAU, d = i === 0 ? 0 : (0.4 + hash2(c.id, i, 4) * 0.8) * s * (1 + c.tier * 0.35);
    drawBuilding(ctx, sx + Math.cos(a) * d * 1.3, sy + Math.sin(a) * d * 0.7, s * (i === 0 ? 1.15 : 0.85), era, hash2(c.id, i, 5), n);
  }
  if (c.buildings.includes('walls') && c.tier >= 1) {
    ctx.strokeStyle = 'rgba(190,180,160,0.85)';
    ctx.lineWidth = Math.max(1, s * 0.25);
    ctx.beginPath(); ctx.ellipse(sx, sy, s * (2 + c.tier * 0.6), s * (1.2 + c.tier * 0.35), 0, 0, TAU); ctx.stroke();
  }
}

function drawCityDetail(ctx, c, n, sx, sy, z, t, w) {
  const era = n.era;
  const count = Math.min(30, 3 + c.tier * 5);
  const rad = (0.55 + c.tier * 0.42) * z;
  const s = z * 0.26;
  const items = [];
  for (let i = 0; i < count; i++) {
    const a = hash2(c.id, i, 3) * TAU, d = i === 0 ? 0 : Math.sqrt(hash2(c.id, i, 4)) * rad;
    items.push([sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.75, i, d / Math.max(1, rad)]);
  }
  items.sort((a, b) => a[1] - b[1]);
  // plaza / ground
  ctx.fillStyle = 'rgba(70,60,52,0.28)';
  ctx.beginPath(); ctx.ellipse(sx, sy + s * 0.4, rad + s, rad * 0.75 + s, 0, 0, TAU); ctx.fill();
  for (const [bx, by, i, dn] of items) {
    const big = i === 0 ? 1.5 : 1.15 - dn * 0.4;
    drawBuilding(ctx, bx, by, s * big * (c.tier >= 4 ? 1.2 : 1), era, hash2(c.id, i, 5), n, c.capital && i === 0);
  }
  if (c.buildings.includes('walls')) {
    ctx.strokeStyle = 'rgba(196,186,166,0.9)';
    ctx.lineWidth = Math.max(1.5, s * 0.35);
    ctx.beginPath(); ctx.ellipse(sx, sy + s * 0.2, rad + s * 1.6, (rad + s * 1.6) * 0.75, 0, 0, TAU); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const tx = sx + Math.cos(a) * (rad + s * 1.6), ty = sy + s * 0.2 + Math.sin(a) * (rad + s * 1.6) * 0.75;
      ctx.fillStyle = '#b8ac94'; ctx.fillRect(tx - s * 0.35, ty - s * 0.9, s * 0.7, s * 0.9);
    }
  }
  // wonders stand beside the city
  c.wonders.forEach((id, k) => {
    const a = 0.6 + k * 1.1;
    drawWonder(ctx, id, sx + Math.cos(a) * (rad + s * 3), sy + Math.sin(a) * (rad + s * 3) * 0.6, s * 2.2, t);
  });
}

function drawBuilding(ctx, x, y, s, era, h, n, palace = false) {
  if (era <= 1) {
    // huts and tents
    ctx.fillStyle = h > 0.5 ? '#8a6a48' : '#a08058';
    ctx.beginPath(); ctx.moveTo(x - s * 0.7, y + s * 0.3); ctx.lineTo(x, y - s * 0.8); ctx.lineTo(x + s * 0.7, y + s * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(x - s * 0.12, y - s * 0.05, s * 0.24, s * 0.35);
    return;
  }
  if (era >= 8 && h > 0.35) {
    // towers
    const hh = s * (1.4 + h * 2.2) * (era >= 10 ? 1.15 : 1);
    const ww = s * (0.7 + (h * 7 % 1) * 0.35);
    const base = era >= 10 ? (h > 0.75 ? [150, 190, 210] : [176, 196, 214]) : h > 0.7 ? [112, 124, 144] : [146, 154, 170];
    ctx.fillStyle = rgb(base);
    ctx.fillRect(x - ww / 2, y - hh, ww, hh);
    ctx.fillStyle = rgb(shade(base, 0.72));
    ctx.fillRect(x + ww * 0.1, y - hh, ww * 0.4, hh);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x - ww / 2, y - hh, ww * 0.18, hh);
    if (era >= 9 && h > 0.85) { ctx.fillStyle = '#5aa86a'; ctx.beginPath(); ctx.ellipse(x, y - hh, ww * 0.55, s * 0.25, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,236,160,0.75)';
    for (let k = 0; k < 4; k++) if (hash2(h * 100, k, 7) > 0.45) ctx.fillRect(x - ww * 0.3 + (k % 2) * ww * 0.35, y - hh * (0.25 + 0.18 * k), ww * 0.18, s * 0.12);
    if (era >= 10 && h < 0.6) { ctx.fillStyle = 'rgba(190,230,255,0.9)'; ctx.beginPath(); ctx.moveTo(x - ww * 0.3, y - hh); ctx.lineTo(x, y - hh - s * 0.8); ctx.lineTo(x + ww * 0.3, y - hh); ctx.fill(); }
    return;
  }
  if (era >= 6 && h < 0.25) {
    // factory with chimney
    ctx.fillStyle = '#8a5a44';
    ctx.fillRect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 0.8);
    ctx.fillStyle = '#5a5050';
    ctx.fillRect(x + s * 0.35, y - s * 1.5, s * 0.25, s * 1.0);
    ctx.fillStyle = '#6a4232';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x - s * 0.8 + k * s * 0.4, y - s * 0.6); ctx.lineTo(x - s * 0.6 + k * s * 0.4, y - s * 0.85); ctx.lineTo(x - s * 0.4 + k * s * 0.4, y - s * 0.6); ctx.fill(); }
    return;
  }
  // houses with pitched roofs
  const wall = era >= 6 ? [176, 110, 84] : era >= 4 ? [214, 200, 176] : [200, 180, 140];
  const roof = ROOFS[Math.floor(h * ROOFS.length)];
  const ww = s * (palace ? 1.5 : 0.95), hh = s * (palace ? 0.95 : 0.6);
  ctx.fillStyle = rgb(wall);
  ctx.fillRect(x - ww / 2, y - hh, ww, hh);
  ctx.fillStyle = rgb(shade(wall, 0.75));
  ctx.fillRect(x + ww * 0.1, y - hh, ww * 0.4, hh);
  ctx.fillStyle = rgb(roof);
  ctx.beginPath(); ctx.moveTo(x - ww * 0.62, y - hh); ctx.lineTo(x, y - hh - s * 0.55); ctx.lineTo(x + ww * 0.62, y - hh); ctx.closePath(); ctx.fill();
  if (palace) {
    ctx.fillStyle = rgb(n.color);
    ctx.fillRect(x - s * 0.05, y - hh - s * 1.3, s * 0.08, s * 0.8);
    ctx.fillRect(x + s * 0.03, y - hh - s * 1.3, s * 0.4, s * 0.25);
  }
  if (era === 5 && h > 0.85) { ctx.fillStyle = '#c8b890'; ctx.beginPath(); ctx.arc(x, y - hh - s * 0.3, s * 0.4, Math.PI, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(40,28,20,0.8)';
  ctx.fillRect(x - s * 0.08, y - s * 0.28, s * 0.16, s * 0.28);
}

function drawWonder(ctx, id, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  const gold = '#e8c870';
  switch (id) {
    case 'stonecircle':
      ctx.fillStyle = '#9a948a';
      for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; ctx.fillRect(Math.cos(a) * s * 0.6 - s * 0.08, Math.sin(a) * s * 0.3 - s * 0.35, s * 0.16, s * 0.35); }
      break;
    case 'skystair':
      ctx.fillStyle = '#c8b48c';
      for (let k = 0; k < 5; k++) ctx.fillRect(-s * (0.8 - k * 0.16), -s * 0.2 * (k + 1), s * (1.6 - k * 0.32), s * 0.2);
      break;
    case 'scrollhall': case 'archive':
      ctx.fillStyle = '#d8d0c0'; ctx.fillRect(-s * 0.7, -s * 0.5, s * 1.4, s * 0.5);
      ctx.fillStyle = '#b8b0a0'; for (let k = 0; k < 5; k++) ctx.fillRect(-s * 0.6 + k * s * 0.28, -s * 0.5, s * 0.08, s * 0.5);
      ctx.fillStyle = id === 'archive' ? '#7090c0' : '#a05040'; ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 0.5); ctx.lineTo(0, -s * 0.85); ctx.lineTo(s * 0.8, -s * 0.5); ctx.fill();
      break;
    case 'bronzegiant':
      ctx.fillStyle = '#b08040'; ctx.fillRect(-s * 0.12, -s * 1.3, s * 0.24, s * 0.9); ctx.beginPath(); ctx.arc(0, -s * 1.4, s * 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b08040'; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.moveTo(0, -s * 1.1); ctx.lineTo(s * 0.4, -s * 1.6); ctx.stroke();
      ctx.fillStyle = '#ffd070'; ctx.beginPath(); ctx.arc(s * 0.42, -s * 1.65, s * 0.08 + Math.sin(t * 4) * s * 0.02, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a8070'; ctx.fillRect(-s * 0.3, -s * 0.4, s * 0.6, s * 0.4);
      break;
    case 'rampart':
      ctx.fillStyle = '#b0a48c'; ctx.fillRect(-s, -s * 0.3, s * 2, s * 0.3);
      for (let k = 0; k < 5; k++) ctx.fillRect(-s + k * s * 0.45, -s * 0.45, s * 0.2, s * 0.15);
      break;
    case 'beacon': case 'tether':
      ctx.fillStyle = id === 'tether' ? '#c8d0e0' : '#d8ccb0';
      ctx.beginPath(); ctx.moveTo(-s * 0.25, 0); ctx.lineTo(-s * 0.12, -s * 1.6); ctx.lineTo(s * 0.12, -s * 1.6); ctx.lineTo(s * 0.25, 0); ctx.fill();
      if (id === 'tether') { ctx.strokeStyle = 'rgba(200,220,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.lineTo(0, -s * 6); ctx.stroke(); }
      else { const g = ctx.createRadialGradient(0, -s * 1.7, 0, 0, -s * 1.7, s * 0.8); g.addColorStop(0, 'rgba(255,240,180,0.9)'); g.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -s * 1.7, s * 0.8, 0, TAU); ctx.fill(); }
      break;
    case 'dome': case 'expo': case 'parliament':
      ctx.fillStyle = '#d8d0c4'; ctx.fillRect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.45);
      ctx.fillStyle = id === 'expo' ? '#a8c8e8' : id === 'parliament' ? '#e0e0e8' : gold;
      ctx.beginPath(); ctx.arc(0, -s * 0.45, s * 0.5, Math.PI, TAU); ctx.fill();
      ctx.fillRect(-s * 0.03, -s * 1.15, s * 0.06, s * 0.25);
      break;
    case 'canal':
      ctx.strokeStyle = '#4a90c8'; ctx.lineWidth = s * 0.25; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.4, s, 0); ctx.stroke();
      ctx.fillStyle = '#b0a080'; ctx.fillRect(-s * 0.15, -s * 0.5, s * 0.3, s * 0.35);
      break;
    case 'observatory': case 'skymirror':
      ctx.fillStyle = '#d0ccc4'; ctx.fillRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.5);
      ctx.fillStyle = id === 'skymirror' ? '#c0d8f0' : '#b0a890';
      ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.45, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = '#606878'; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(s * 0.5, -s * 1.2); ctx.stroke();
      break;
    case 'ark':
      ctx.fillStyle = '#e8ecf4'; ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(-s * 0.2, -s * 1.4); ctx.lineTo(0, -s * 1.9); ctx.lineTo(s * 0.2, -s * 1.4); ctx.lineTo(s * 0.2, 0); ctx.fill();
      ctx.fillStyle = '#c04040'; ctx.fillRect(-s * 0.35, -s * 0.3, s * 0.15, s * 0.3); ctx.fillRect(s * 0.2, -s * 0.3, s * 0.15, s * 0.3);
      break;
    default:
      ctx.fillStyle = gold; ctx.beginPath(); ctx.moveTo(-s * 0.6, 0); ctx.lineTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.fill();
  }
  ctx.restore();
}

function drawLights(ctx, c, n, sx, sy, z) {
  if (n.era < 2) return;
  const r = Math.max(4, z * (0.6 + c.tier * 0.5)) * (n.tf.electricity ? 1.6 : 1);
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
  const a = n.tf.electricity ? 0.75 : 0.4;
  g.addColorStop(0, `rgba(255,220,140,${a})`);
  g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function drawBoat(ctx, x, y, s, col, steam) {
  ctx.fillStyle = steam ? '#5a5e66' : '#7a5232';
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.6, y + s * 0.4); ctx.lineTo(x - s * 0.6, y + s * 0.4); ctx.closePath(); ctx.fill();
  if (steam) { ctx.fillStyle = rgb(col); ctx.fillRect(x - s * 0.1, y - s * 0.7, s * 0.25, s * 0.7); }
  else {
    ctx.fillStyle = '#f2ece0';
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.2); ctx.lineTo(x + s * 0.7, y - s * 0.1); ctx.lineTo(x, y - s * 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgb(col); ctx.fillRect(x - s * 0.04, y - s * 1.4, s * 0.35, s * 0.2);
  }
}

function drawArmy(ctx, a, n, sx, sy, z, t) {
  const col = n.color;
  if (a.naval) { drawBoat(ctx, sx, sy, Math.max(4, z * 0.6), col, n.era >= 6); }
  else if (z >= 7) {
    const k = clamp(Math.round(a.str / 400), 2, 9);
    const s = z * 0.16;
    for (let i = 0; i < k; i++) {
      const fx = sx + ((i % 3) - 1) * s * 2.2, fy = sy + (Math.floor(i / 3) - 1) * s * 1.6;
      if (n.era >= 7) {
        ctx.fillStyle = rgb(shade(col, 0.7)); ctx.fillRect(fx - s, fy - s * 0.5, s * 2, s);
        ctx.fillStyle = '#333'; ctx.fillRect(fx - s * 0.2, fy - s * 0.9, s * 1.3, s * 0.25);
      } else {
        ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(fx, fy - s * 1.3, s * 0.45, 0, TAU); ctx.fill();
        ctx.fillStyle = rgb(col); ctx.fillRect(fx - s * 0.4, fy - s * 0.9, s * 0.8, s * 1.1);
        ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx + s * 0.6, fy + s * 0.2); ctx.lineTo(fx + s * 0.6, fy - s * (n.era >= 5 ? 1.6 : 2.2)); ctx.stroke();
      }
    }
  }
  // banner
  const h = Math.max(9, z * 1.1);
  const bx = sx - (z >= 7 ? z * 0.6 : 0), by = sy;
  ctx.strokeStyle = '#d8d0c0';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - h); ctx.stroke();
  const wave = Math.sin(t * 5 + a.id) * 1.5;
  ctx.fillStyle = rgb(col);
  ctx.beginPath(); ctx.moveTo(bx, by - h); ctx.lineTo(bx + h * 0.75, by - h * 0.82 + wave); ctx.lineTo(bx, by - h * 0.6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
  if (z >= 3.5) {
    ctx.font = '600 9px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    const txt = fmtNum(a.str);
    ctx.strokeText(txt, bx + 3, by - h - 5);
    ctx.fillStyle = a.battle ? '#ffb0a0' : '#fff';
    ctx.fillText(txt, bx + 3, by - h - 5);
  }
}

