// The explorer's map: every chunk the player has loaded is sampled into a 16×16 colour tile
// (top block colour × biome tint, relief shading, water depth). Tiles are packed into 256×256
// region canvases for cheap drawing, persisted with the world, and shown both as a HUD
// minimap and as a full-screen pannable/zoomable map with markers.

import { BLOCKS, B, ID_MASK, TINT, LIQUID, OPAQUE } from '../world/blocks.js';
import { buildBlockTextures } from '../render/textures.js';
import { STRUCTURE_INFO, locateStructures } from '../world/gen/structures.js';
import { h, Screen } from '../ui/ui.js';

let MAPCOL = null; // rgb + visible flag per block id
function mapColors() {
  if (MAPCOL) return MAPCOL;
  const tex = buildBlockTextures();
  MAPCOL = new Uint8Array(1024 * 4);
  for (let id = 1; id < BLOCKS.length; id++) {
    const d = BLOCKS[id];
    if (!d || !d.faces || d.invisible) continue;
    const base = d.faces[2] * 256 * 4;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < 256; i++) {
      if (tex.data[base + i * 4 + 3] < 100) continue;
      r += tex.data[base + i * 4]; g += tex.data[base + i * 4 + 1]; b += tex.data[base + i * 4 + 2]; n++;
    }
    if (!n) continue;
    MAPCOL[id * 4] = r / n; MAPCOL[id * 4 + 1] = g / n; MAPCOL[id * 4 + 2] = b / n;
    // sparse cut-outs (flowers, torches, tall grass) let the ground show through
    MAPCOL[id * 4 + 3] = n > 110 || d.leaves || LIQUID[id] || OPAQUE[id] ? 1 : 0;
  }
  for (const n of ['glow_air', 'glow_air_cool']) if (B[n] !== undefined) MAPCOL[B[n] * 4 + 3] = 0;
  return MAPCOL;
}

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const unb64 = (s) => { const t = atob(s); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };

function sampleChunk(c) {
  const C = mapColors();
  const out = new Uint8Array(256 * 3);
  const hts = new Int16Array(256);
  const bl = c.blocks, tints = c.tints;
  for (let i = 0; i < 256; i++) {
    let y = Math.min(255, c.heights ? c.heights[i] + 1 : 255), id = 0;
    while (y > 0) { id = bl[(y << 8) | i] & ID_MASK; if (id && C[id * 4 + 3]) break; y--; }
    let r = C[id * 4], g = C[id * 4 + 1], b = C[id * 4 + 2];
    const t = TINT[id];
    if (t && tints) {
      const tv = tints[(t - 1) * 256 + i];
      r = r * ((tv >> 16) & 255) / 255; g = g * ((tv >> 8) & 255) / 255; b = b * (tv & 255) / 255;
    }
    if (LIQUID[id] === 1) {
      // water: tint by depth, let shallow floors show through
      let d = 0, fy = y - 1, fid = 0;
      while (fy > 0 && d < 12) { fid = bl[(fy << 8) | i] & ID_MASK; if (!LIQUID[fid]) break; d++; fy--; }
      const wt = tints ? tints[512 + i] : 0x3f76e4;
      const wr = (wt >> 16) & 255, wg = (wt >> 8) & 255, wb = wt & 255;
      const k = Math.min(1, 0.45 + d * 0.06);
      const fr = C[fid * 4], fg = C[fid * 4 + 1], fb = C[fid * 4 + 2];
      r = (fr * (1 - k) + wr * k) * (1 - d * 0.025); g = (fg * (1 - k) + wg * k) * (1 - d * 0.025); b = (fb * (1 - k) + wb * k) * (1 - d * 0.02);
      hts[i] = -1;
    } else hts[i] = y;
    out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
  }
  // relief: light from the north-west
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const i = (z << 4) | x;
    if (hts[i] < 0) continue;
    const n = z > 0 ? hts[i - 16] : hts[i], wv = x > 0 ? hts[i - 1] : hts[i];
    const ref = Math.max(n < 0 ? hts[i] : n, wv < 0 ? hts[i] : wv);
    const f = 1 + Math.max(-0.3, Math.min(0.25, (hts[i] - ref) * 0.09));
    const alt = 0.9 + Math.min(0.2, Math.max(0, (hts[i] - 62) / 400));
    for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.min(255, out[i * 3 + k] * f * alt);
  }
  return out;
}

export class MapData {
  constructor(saved) {
    this.tiles = new Map();   // "cx,cz" -> { px: Uint8Array(768), s: base64 | null }
    this.regions = new Map(); // "rx,rz" -> { canvas, ctx, img, dirty }
    this.pins = saved && saved.pins ? saved.pins : [];
    this.meteors = saved && saved.meteors ? saved.meteors : [];
    this.minimap = saved && saved.minimap !== undefined ? saved.minimap : true;
    if (saved && saved.tiles) for (const k in saved.tiles) this.put(k, unb64(saved.tiles[k]), saved.tiles[k]);
  }
  put(key, px, s = null) {
    this.tiles.set(key, { px, s });
    const [cx, cz] = key.split(',').map(Number);
    const rk = `${cx >> 4},${cz >> 4}`;
    let R = this.regions.get(rk);
    if (!R) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      R = { canvas, ctx, img: ctx.createImageData(256, 256), dirty: true, rx: cx >> 4, rz: cz >> 4 };
      this.regions.set(rk, R);
    }
    const ox = (cx & 15) * 16, oz = (cz & 15) * 16, d = R.img.data;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const o = ((oz + z) * 256 + ox + x) * 4, i = (z * 16 + x) * 3;
      d[o] = px[i]; d[o + 1] = px[i + 1]; d[o + 2] = px[i + 2]; d[o + 3] = 255;
    }
    R.dirty = true;
  }
  sample(c) { if (c.blocks && c.heights) this.put(`${c.cx},${c.cz}`, sampleChunk(c)); }
  region(R) { if (R.dirty) { R.ctx.putImageData(R.img, 0, 0); R.dirty = false; } return R.canvas; }
  serialize() {
    const tiles = {};
    for (const [k, t] of this.tiles) tiles[k] = t.s || (t.s = b64(t.px));
    return { tiles, pins: this.pins, meteors: this.meteors, minimap: this.minimap };
  }
  // draw the explored world: world point (wx,wz) at canvas centre, `scale` px per block
  draw(ctx, W, H, wx, wz, scale) {
    ctx.imageSmoothingEnabled = false;
    const x0 = wx - W / 2 / scale, z0 = wz - H / 2 / scale, x1 = wx + W / 2 / scale, z1 = wz + H / 2 / scale;
    for (const R of this.regions.values()) {
      const rx = R.rx * 256, rz = R.rz * 256;
      if (rx > x1 || rz > z1 || rx + 256 < x0 || rz + 256 < z0) continue;
      ctx.drawImage(this.region(R), (rx - x0) * scale, (rz - z0) * scale, 256 * scale, 256 * scale);
    }
  }
}

export function installWorldMap(game, state) {
  const md = game.map = new MapData(state && state.map);
  game.stateSavers.push((s) => { s.map = md.serialize(); });
  game.chunks.onChunkLoaded.push((c) => md.sample(c));
  game.chunks.onChunkUnload.push((c) => { if (c.modified) md.sample(c); });
  game.on('meteorLanded', (x, y, z) => { md.meteors.push({ x: Math.round(x), z: Math.round(z), day: game.day }); if (md.meteors.length > 12) md.meteors.shift(); });

  // re-sample the chunks around the player now and then, so building and digging show up
  let t = 0, ring = 0;
  const minimap = h('div', { class: 'minimap' }, h('canvas', { width: 150, height: 150 }), h('div', { class: 'mm-n' }, 'N'), h('div', { class: 'mm-coords' }));
  game.hud.root.appendChild(minimap);
  const mctx = minimap.firstChild.getContext('2d');
  let mmT = 0;
  game.addSystem({
    frame(g, dt) {
      t += dt;
      if (t > 1.5) {
        t = 0;
        const pcx = Math.floor(g.player.x) >> 4, pcz = Math.floor(g.player.z) >> 4;
        const dx = (ring % 3) - 1, dz = Math.floor(ring / 3) - 1;
        ring = (ring + 1) % 9;
        const c = g.world.getChunk(pcx + dx, pcz + dz);
        if (c && c.blocks) md.sample(c);
      }
      minimap.style.display = md.minimap && g.hud.visible ? '' : 'none';
      if (!md.minimap) return;
      mmT += dt;
      if (mmT < 0.12) return;
      mmT = 0;
      const p = g.player;
      mctx.fillStyle = '#0b0f17';
      mctx.fillRect(0, 0, 150, 150);
      md.draw(mctx, 150, 150, p.x, p.z, 1.5);
      drawMarkers(g, mctx, 150, 150, p.x, p.z, 1.5, true);
      minimap.lastChild.textContent = `${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}`;
    },
  });
  game.openMap = () => { if (!game.ui.open) game.app.ui.push(new MapScreen(game)); };
}

// ---------------------------------------------------------------- markers
function markerList(g) {
  const out = [];
  const heart = locateStructures(g.gen, 'heart', 0, 0)[0];
  if (heart) out.push({ x: heart.x, z: heart.z, icon: '◎', color: '#d9b8ff', label: g.quest && g.quest.done ? '织心祭坛（已重织）' : `织心祭坛 · 出生点（碎片 ${g.quest ? g.quest.count() : 0}/5）`, big: true });
  if (g.structures) for (const s of g.structures.values()) if (s.kind !== 'heart') out.push({ x: s.x, z: s.z, icon: STRUCTURE_INFO[s.kind].icon, color: STRUCTURE_INFO[s.kind].shard ? '#ffd76a' : '#e8e0c8', label: STRUCTURE_INFO[s.kind].zh, big: !!STRUCTURE_INFO[s.kind].shard });
  if (g.chartMarks) for (const m of g.chartMarks) {
    if (m.kind === 'treasure') { const t = g.treasures && g.treasures.find((q) => q.x === m.x && q.z === m.z); if (!t || !t.found) out.push({ x: m.x, z: m.z, icon: '✕', color: '#ff4a3a', label: '藏宝图：宝藏埋在这里', big: true }); continue; }
    if (!g.structures || ![...g.structures.values()].some((s) => s.x === m.x && s.z === m.z)) out.push({ x: m.x, z: m.z, icon: '✕', color: '#ff7a6a', label: `残图标记：${STRUCTURE_INFO[m.kind].zh}`, big: true });
  }
  if (g.waystones) for (const s of g.waystones) out.push({ x: s.x, z: s.z, icon: '◆', color: '#6fe8ff', label: `回响石碑「${s.name}」` });
  if (g.map) for (const m of g.map.meteors) out.push({ x: m.x, z: m.z, icon: '☄', color: '#ffa060', label: `流星坠落点（第 ${m.day} 天）` });
  if (g.map) g.map.pins.forEach((m, i) => out.push({ x: m.x, z: m.z, icon: '⚑', color: m.color || '#9cff8a', label: m.name || `标记 ${i + 1}`, pin: i }));
  if (g.deathPoint) out.push({ x: g.deathPoint.x, z: g.deathPoint.z, icon: '✝', color: '#ff6a6a', label: `死亡地点（第 ${g.deathPoint.day} 天）` });
  if (g.ping && g.ping.target && g.time - g.ping.t < 60) out.push({ x: g.ping.target.x, z: g.ping.target.z, icon: '❖', color: '#c9a0ff', label: `回响指向：${STRUCTURE_INFO[g.ping.target.kind].zh}`, big: true });
  return out;
}

function drawMarkers(g, ctx, W, H, wx, wz, scale, clampEdge) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const m of markerList(g)) {
    let sx = W / 2 + (m.x + 0.5 - wx) * scale, sy = H / 2 + (m.z + 0.5 - wz) * scale;
    const off = sx < 6 || sy < 6 || sx > W - 6 || sy > H - 6;
    if (off) {
      if (!clampEdge || !m.big) continue;
      sx = Math.max(7, Math.min(W - 7, sx)); sy = Math.max(7, Math.min(H - 7, sy));
    }
    ctx.font = `${m.big ? 15 : 12}px sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(m.icon, sx + 1, sy + 1);
    ctx.fillStyle = m.color;
    ctx.globalAlpha = off ? 0.6 : 1;
    ctx.fillText(m.icon, sx, sy);
    ctx.globalAlpha = 1;
    m.sx = sx; m.sy = sy;
  }
  // the player
  const p = g.player;
  const px = W / 2 + (p.x - wx) * scale, py = H / 2 + (p.z - wz) * scale;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(fz, fx) + Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#123'; ctx.lineWidth = 1.5;
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

class MapScreen extends Screen {
  constructor(game) { super(); this.game = game; this.cx = game.player.x; this.cz = game.player.z; this.scale = 2; this.pauses = false; }
  build() {
    const g = this.game, md = g.map;
    this.canvas = h('canvas', { class: 'map-canvas' });
    this.info = h('div', { class: 'map-info' });
    this.tip = h('div', { class: 'map-tip' });
    const legend = h('div', { class: 'map-legend' },
      ...[['◎', '#d9b8ff', '织心祭坛'], ['◆', '#6fe8ff', '回响石碑'], ['☁▲❄≈', '#ffd76a', '碎片神殿'], ['⌂⛏☠', '#e8e0c8', '遗迹 / 矿道 / 巢穴'], ['✕', '#ff7a6a', '残图标记'], ['☄', '#ffa060', '流星'], ['⚑', '#9cff8a', '自定义标记'], ['✝', '#ff6a6a', '死亡地点']]
        .map(([i, c, t]) => h('div', {}, h('span', { style: { color: c } }, i), ' ', t)));
    const root = h('div', { class: 'screen map-screen' },
      this.canvas, this.tip,
      h('div', { class: 'map-top' }, h('div', { class: 'title' }, '探索地图'), this.info),
      h('div', { class: 'map-side' }, legend,
        h('div', { class: 'map-help' }, '拖动平移 · 滚轮缩放 · 双击放置标记 · 右键删除标记'),
        h('button', { class: 'btn small', onclick: () => { this.cx = g.player.x; this.cz = g.player.z; } }, '回到当前位置'),
        h('button', { class: 'btn small', onclick: (e) => { md.minimap = !md.minimap; e.target.textContent = md.minimap ? '隐藏小地图' : '显示小地图'; } }, md.minimap ? '隐藏小地图' : '显示小地图'),
        h('button', { class: 'btn small', onclick: () => this.close() }, '关闭（M）')));
    let drag = null;
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => { if (e.button === 0) drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz }; });
    window.addEventListener('mouseup', this._up = () => { drag = null; });
    c.addEventListener('mousemove', (e) => {
      if (drag) { this.cx = drag.cx - (e.clientX - drag.x) / this.scale; this.cz = drag.cz - (e.clientY - drag.y) / this.scale; }
      this.mouse = [e.offsetX, e.offsetY];
    });
    c.addEventListener('mouseleave', () => { this.mouse = null; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.25 : 0.8;
      const ns = Math.max(0.25, Math.min(10, this.scale * f));
      const mx = e.offsetX - c.width / 2, my = e.offsetY - c.height / 2;
      this.cx += mx / this.scale - mx / ns; this.cz += my / this.scale - my / ns;
      this.scale = ns;
    }, { passive: false });
    c.addEventListener('dblclick', (e) => {
      const wx = Math.floor(this.cx + (e.offsetX - c.width / 2) / this.scale), wz = Math.floor(this.cz + (e.offsetY - c.height / 2) / this.scale);
      md.pins.push({ x: wx, z: wz, name: `标记 ${md.pins.length + 1}`, color: ['#9cff8a', '#ffd76a', '#ff9ad5', '#8ad0ff'][md.pins.length % 4] });
    });
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const hit = this.hover;
      if (hit && hit.pin !== undefined) md.pins.splice(hit.pin, 1);
    });
    this.raf = requestAnimationFrame(this.loop = () => { this.draw(); this.raf = requestAnimationFrame(this.loop); });
    return root;
  }
  draw() {
    const g = this.game, c = this.canvas;
    if (!c.isConnected) return;
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b0f17'; ctx.fillRect(0, 0, W, H);
    // faint grid every 16 chunks
    g.map.draw(ctx, W, H, this.cx, this.cz, this.scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    const step = 256 * this.scale;
    const ox = (W / 2 - this.cx * this.scale) % step, oz = (H / 2 - this.cz * this.scale) % step;
    for (let x = ox; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = oz; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    drawMarkers(g, ctx, W, H, this.cx, this.cz, this.scale, true);
    // hover
    this.hover = null;
    if (this.mouse) {
      const [mx, my] = this.mouse;
      let best = null, bd = 12;
      for (const m of markerList(g)) {
        const sx = W / 2 + (m.x + 0.5 - this.cx) * this.scale, sy = H / 2 + (m.z + 0.5 - this.cz) * this.scale;
        const d = Math.hypot(sx - mx, sy - my);
        if (d < bd) { bd = d; best = m; }
      }
      this.hover = best;
      const wx = Math.floor(this.cx + (mx - W / 2) / this.scale), wz = Math.floor(this.cz + (my - H / 2) / this.scale);
      this.tip.style.display = '';
      this.tip.style.left = `${mx + 14}px`; this.tip.style.top = `${my + 10}px`;
      this.tip.textContent = best ? `${best.label} · ${best.x}, ${best.z}` : `${wx}, ${wz}`;
    } else this.tip.style.display = 'none';
    const p = g.player;
    this.info.textContent = `已探索 ${g.map.tiles.size} 个区块 · 当前位置 ${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)} · 第 ${g.day} 天`;
  }
  close() { cancelAnimationFrame(this.raf); window.removeEventListener('mouseup', this._up); super.close(); }
  onKey(e) { if (e.code === 'Escape' || e.code === 'KeyM') { this.close(); return true; } return true; }
}
