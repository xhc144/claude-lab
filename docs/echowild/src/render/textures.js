// Procedural 16×16 pixel art for every block texture. Nothing is loaded from disk: each texture
// is painted by a small program from a shared palette, seeded by its name, so the whole world has
// one consistent hand-made look. Gray pixels in tinted textures (grass, foliage, water) are later
// multiplied by the biome colour in the shader; alpha 128..250 marks glowing pixels (GLOW_TEX).

import { TEXTURE_NAMES, GLOW_TEX, COLORS, texLayer } from '../world/blocks.js';
import { RNG, hashString, tileNoise } from '../core/noise.js';

export const S = 16;

export const hex = (h) => {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const pal = (...hs) => hs.map(hex);
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const gray = (v) => [v, v, v];

export class Img {
  constructor(name, w = S, h = S) {
    this.w = w; this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
    this.rng = new RNG(hashString(name) + 7);
    this.seed = hashString(name);
  }
  i(x, y) { return (((y % this.h) + this.h) % this.h * this.w + (((x % this.w) + this.w) % this.w)) * 4; }
  set(x, y, c, a = 255) {
    const i = this.i(x, y);
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
  }
  get(x, y) { const i = this.i(x, y); return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
  alpha(x, y) { return this.d[this.i(x, y) + 3]; }
  setA(x, y, a) { this.d[this.i(x, y) + 3] = a; }
  fill(c, a = 255) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c, a); return this; }
  clear() { this.d.fill(0); return this; }
  each(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) fn(x, y); return this; }
  rect(x0, y0, x1, y1, c, a = 255) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c, a); return this; }
  shade(x, y, f) { const c = this.get(x, y); this.set(x, y, mul(c, f), this.alpha(x, y)); }
  blend(x, y, c, t) { const o = this.get(x, y); this.set(x, y, mix(o, c, t), this.alpha(x, y)); }
  glow(x, y, strength = 1) { this.setA(x, y, Math.round(250 - 122 * strength)); }
  copy(o) { this.d.set(o.d); return this; }
}

// tileable value-noise field on the 16×16 tile, `f` cells per tile
const field = (img, f, salt = 0) => {
  const n = tileNoise(img.seed + salt * 977, f);
  return (x, y) => n((x * f) / S, (y * f) / S);
};

function noisy(img, p, { f1 = 4, f2 = 8, w1 = 0.55, w2 = 0.3, w3 = 0.25, bias = 0 } = {}) {
  const a = field(img, f1, 1), b = field(img, f2, 2);
  img.each((x, y) => {
    let v = a(x, y) * w1 + b(x, y) * w2 + img.rng.next() * w3 + bias;
    v = Math.max(0, Math.min(0.999, (v - 0.1) / (w1 + w2 + w3 - 0.2)));
    img.set(x, y, p[Math.floor(v * p.length)]);
  });
  return img;
}

function speckle(img, c, n, a = 255) {
  for (let k = 0; k < n; k++) img.set(img.rng.int(S), img.rng.int(S), c, a);
  return img;
}

// Voronoi cells (cobbles, gravel, crystals). Returns { cell(x,y), edge(x,y) }
function voronoi(img, count, salt = 0) {
  const r = new RNG(img.seed + 31 * salt + 3);
  const pts = [];
  for (let i = 0; i < count; i++) pts.push([r.next() * S, r.next() * S, r.next()]);
  const info = new Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let i = 0; i < count; i++) {
      for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
        const dx = x + 0.5 - (pts[i][0] + ox), dy = y + 0.5 - (pts[i][1] + oy);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
      }
    }
    info[y * S + x] = { id, rnd: pts[id][2], edge: d2 - d1, d: d1, cx: pts[id][0], cy: pts[id][1] };
  }
  return (x, y) => info[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
}

// ---------------------------------------------------------------- palettes
const P = {
  stone: pal('#545b67', '#626a76', '#6f7884', '#7c8591', '#89929d', '#97a0aa'),
  deep: pal('#26242f', '#2f2c39', '#383443', '#423d4e', '#4c4659'),
  dirt: pal('#5a3d2a', '#684631', '#765139', '#845c41', '#93694b'),
  sand: pal('#cdb57f', '#d6c08b', '#dfca97', '#e7d4a3', '#eedcaf'),
  redsand: pal('#a8532e', '#b55e35', '#c16a3d', '#cc7746', '#d6844f'),
  gravel: pal('#5b5651', '#6b655f', '#7b746d', '#8b847c', '#9b948b', '#4a4541'),
  snow: pal('#dfe8f0', '#e7eef5', '#eef4f9', '#f6f9fc', '#ffffff'),
  ice: pal('#8fb8e8', '#9cc4ef', '#abd0f4', '#bcdcf8'),
  grass: [gray(130), gray(150), gray(165), gray(180), gray(196), gray(212)],
  oakBark: pal('#4a3322', '#563c27', '#62452d', '#6e4f34'),
  oakPlank: pal('#86592f', '#946437', '#a1703f', '#ad7c48', '#b88852'),
  birchBark: pal('#d9d4c6', '#e3dfd3', '#ece9df', '#f4f2ea'),
  birchPlank: pal('#c9b27f', '#d3bd8b', '#dcc797', '#e5d1a3'),
  pineBark: pal('#33241a', '#3d2b1f', '#473325', '#523b2b'),
  pinePlank: pal('#5f4027', '#6b4a2e', '#775436', '#835e3e'),
  blossomBark: pal('#5a3a3e', '#684448', '#764f53', '#845a5e'),
  blossomPlank: pal('#b77c7c', '#c48a88', '#cf9894', '#d9a6a0'),
  willowBark: pal('#3e3a28', '#48432f', '#524d36', '#5d573e'),
  willowPlank: pal('#8a8455', '#968f5f', '#a29a6a', '#ada575'),
  cloudBark: pal('#a9b9cf', '#b8c7db', '#c7d4e6', '#d6e1f0'),
  cloudPlank: pal('#c3d0e2', '#cfdaea', '#dae3f1', '#e5ecf7'),
  copper: pal('#b0613a', '#c8744a', '#db8a5c', '#eaa274', '#f5bb90'),
  patina: pal('#3f8f7d', '#4fa892', '#66c0a8'),
  iron: pal('#8a8f99', '#a0a6b0', '#b7bdc6', '#cdd2d9', '#e3e7ec'),
  gold: pal('#b88a1e', '#d4a52a', '#e9c03e', '#f6d867', '#fff09a'),
  crystal: pal('#1a8ea8', '#26b6cf', '#42d6ea', '#7cefff', '#c6fbff'),
  echo: pal('#4b2a7a', '#653a9c', '#8152c0', '#9e70dc', '#c19df0', '#e6d4ff'),
  star: pal('#6b8fd6', '#8fb4f0', '#b7d5ff', '#e1efff', '#ffffff'),
  meteor: pal('#2a1f22', '#3a2a2c', '#4a3436', '#5a3f40'),
  ember: pal('#ff6a1f', '#ff8c2a', '#ffb347', '#ffd77a'),
  lava: pal('#9a2a08', '#c43d0b', '#e2580f', '#f57a1c', '#ffa232', '#ffc95a'),
  ancient: pal('#3a5257', '#43606a', '#4d6e78', '#587c85', '#658a92'),
  teal: pal('#1d6b66', '#26877f', '#33a598', '#4cc4b3', '#8ae8d6'),
  obsidian: pal('#120d1c', '#1b1428', '#241b34', '#2e2342', '#3b2d55'),
  mycel: pal('#3a2f4a', '#463858', '#524266', '#5f4d75'),
  pale: pal('#9fa9ba', '#aab4c4', '#b5becd', '#c0c9d6'),
  mud: pal('#3b3026', '#45382c', '#4f4032', '#594838'),
  terracotta: pal('#93573f', '#9d5f45', '#a6674c', '#b07052'),
};

// ---------------------------------------------------------------- building blocks
function stoneTex(img, p = P.stone) {
  noisy(img, p, { f1: 4, f2: 8, w3: 0.22 });
  // soft cracks
  const r = img.rng;
  for (let k = 0; k < 3; k++) {
    let x = r.int(S), y = r.int(S);
    const len = 3 + r.int(4);
    for (let i = 0; i < len; i++) {
      img.blend(x, y, p[0], 0.55);
      x += r.int(3) - 1; y += 1;
    }
  }
  return img;
}

function cobbleTex(img, p = P.stone, n = 9) {
  const v = voronoi(img, n);
  img.each((x, y) => {
    const c = v(x, y);
    let idx = 1 + Math.floor(c.rnd * (p.length - 2));
    if (c.edge < 1.1) idx = 0;
    else {
      // light from top-left on each cobble
      const dx = x + 0.5 - c.cx, dy = y + 0.5 - c.cy;
      if (dx + dy < -2.2 && idx < p.length - 1) idx++;
      if (dx + dy > 2.6 && idx > 1) idx--;
    }
    img.set(x, y, p[idx]);
  });
  speckle(img, p[p.length - 1], 4);
  return img;
}

function bricksTex(img, brick, mortar, { bw = 8, bh = 4, offset = 4, bevel = true } = {}) {
  const r = img.rng;
  const shades = [];
  for (let k = 0; k < 64; k++) shades.push(r.next());
  img.each((x, y) => {
    const row = Math.floor(y / bh);
    const xo = (x + (row % 2) * offset) % S;
    const col = Math.floor(xo / bw);
    const inX = xo % bw, inY = y % bh;
    if (inY === bh - 1 || inX === bw - 1) { img.set(x, y, mortar); return; }
    const s = shades[(row * 7 + col * 3) % 64];
    let idx = Math.floor(s * (brick.length - 1));
    if (bevel && inY === 0 && idx < brick.length - 1) idx++;
    if (bevel && inX === bw - 2 && idx > 0) idx--;
    const c = brick[idx];
    img.set(x, y, mix(c, brick[Math.min(brick.length - 1, idx + 1)], r.next() * 0.35));
  });
  return img;
}

function planksTex(img, p, { rows = 4 } = {}) {
  const r = img.rng;
  const h = S / rows;
  const ends = [];
  for (let k = 0; k < rows; k++) ends.push(r.int(S));
  const grain = field(img, 8, 5);
  img.each((x, y) => {
    const row = Math.floor(y / h);
    const iy = y % h;
    let idx = 1 + Math.floor(grain(x * 0.25, y * 2) * (p.length - 2));
    if (iy === h - 1) idx = 0;
    else if (iy === 0) idx = Math.min(p.length - 1, idx + 1);
    if (x === ends[row] && iy !== h - 1) idx = 0;
    img.set(x, y, p[idx]);
  });
  // knots
  for (let k = 0; k < 2; k++) {
    const x = r.int(S), y = r.int(rows) * h + 1 + r.int(h - 2);
    img.set(x, y, p[0]);
  }
  return img;
}

function logSide(img, p, { streak = 0.6, spots = null } = {}) {
  const r = img.rng;
  const cols = [];
  for (let x = 0; x < S; x++) cols.push(r.next());
  const f = field(img, 4, 9);
  img.each((x, y) => {
    let v = cols[x] * streak + f(x, y) * (1 - streak);
    if ((x % 4 === 0) && r.next() < 0.6) v *= 0.6;
    img.set(x, y, p[Math.min(p.length - 1, Math.floor(v * p.length))]);
  });
  if (spots) {
    for (let k = 0; k < 7; k++) {
      const x = r.int(S), y = r.int(S), w = 1 + r.int(3);
      for (let i = 0; i < w; i++) img.set(x + i, y, spots);
    }
  }
  return img;
}

function logTop(img, bark, inner) {
  img.each((x, y) => {
    const dx = x - 7.5, dy = y - 7.5;
    const d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.6 + Math.sqrt(dx * dx + dy * dy) * 0.4;
    if (d > 6.8) { img.set(x, y, bark[1 + (img.rng.int(bark.length - 1))]); return; }
    const ring = Math.floor(d + img.rng.next() * 0.6) % 3;
    img.set(x, y, inner[ring === 0 ? 0 : ring === 1 ? 2 : 1]);
  });
  img.set(7, 7, inner[0]); img.set(8, 8, inner[0]);
  return img;
}

function leavesTex(img, p, { holes = 0.2, berries = null, blossoms = null } = {}) {
  const f = field(img, 4, 3), g = field(img, 8, 4);
  img.each((x, y) => {
    const v = f(x, y) * 0.6 + g(x, y) * 0.4;
    const r = img.rng.next();
    if (r < holes * (1.2 - v)) { img.set(x, y, p[0], 0); return; }
    let idx = Math.floor((v * 0.7 + img.rng.next() * 0.3) * p.length);
    idx = Math.max(0, Math.min(p.length - 1, idx));
    img.set(x, y, p[idx]);
  });
  // leaf highlights in clusters (top-left lit)
  for (let k = 0; k < 10; k++) {
    const x = img.rng.int(S), y = img.rng.int(S);
    if (img.alpha(x, y)) img.set(x, y, p[p.length - 1]);
    if (img.alpha(x + 1, y + 1)) img.set(x + 1, y + 1, p[0]);
  }
  if (berries) for (let k = 0; k < 5; k++) { const x = img.rng.int(S), y = img.rng.int(S); img.set(x, y, berries); }
  if (blossoms) for (let k = 0; k < 12; k++) { const x = img.rng.int(S), y = img.rng.int(S); img.set(x, y, img.rng.pick(blossoms)); }
  return img;
}

function oreTex(img, base, gems, { n = 4, size = 3, glow = false, pattern = 'cluster' } = {}) {
  base(img);
  const r = img.rng;
  for (let k = 0; k < n; k++) {
    const cx = 2 + r.int(12), cy = 2 + r.int(12);
    const pts = pattern === 'shard' ? [[0, 0], [1, -1], [-1, 1], [0, 1], [1, 0]] : [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    const m = Math.min(pts.length, size + r.int(3));
    for (let i = 0; i < m; i++) {
      const [dx, dy] = pts[i];
      const shade = i === 0 ? gems.length - 1 : (dx + dy < 0 ? gems.length - 2 : r.int(gems.length - 1));
      img.set(cx + dx, cy + dy, gems[Math.max(0, shade)]);
      if (glow) img.glow(cx + dx, cy + dy, i === 0 ? 1 : 0.6);
    }
    // dark rim under the gem
    img.blend(cx + 1, cy + 2, [20, 20, 25], 0.35);
  }
  return img;
}

function metalBlock(img, p, { rivets = true, plates = 2 } = {}) {
  img.each((x, y) => {
    let idx = 2 + Math.floor(img.rng.next() * 1.4);
    const e = x === 0 || y === 0 ? 1 : x === S - 1 || y === S - 1 ? -1 : 0;
    idx += e;
    if (plates === 2 && (x === 7 || y === 7)) idx = 1;
    if (plates === 2 && (x === 8 || y === 8)) idx = Math.min(p.length - 1, idx + 1);
    img.set(x, y, p[Math.max(0, Math.min(p.length - 1, idx))]);
  });
  if (rivets) for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { img.set(x, y, p[p.length - 1]); img.set(x + 1, y + 1, p[0]); }
  // diagonal sheen
  for (let i = 0; i < 5; i++) img.blend(3 + i, 11 - i, p[p.length - 1], 0.5);
  return img;
}

function glassTex(img, tint, alphaCenter = 0, alphaFrame = 255) {
  const frame = mix(tint, [255, 255, 255], 0.35);
  img.each((x, y) => {
    const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
    if (edge) img.set(x, y, mix(frame, [40, 50, 60], (x + y) % 5 === 0 ? 0.25 : 0), alphaFrame);
    else img.set(x, y, tint, alphaCenter);
  });
  // highlight streaks
  for (const [x0, y0, len] of [[3, 3, 4], [4, 3, 2], [10, 9, 3]]) {
    for (let i = 0; i < len; i++) img.set(x0 + i, y0 + i, [255, 255, 255], Math.max(alphaCenter, 150));
  }
  return img;
}

function feltTex(img, c) {
  const base = hex(c);
  const f = field(img, 8, 2);
  img.each((x, y) => {
    const weave = ((x + y) % 4 === 0 ? -0.06 : 0) + ((x - y + 16) % 4 === 0 ? 0.04 : 0);
    const v = 0.88 + f(x, y) * 0.18 + weave + img.rng.next() * 0.05;
    img.set(x, y, mul(base, v));
  });
  return img;
}

function glazeTex(img, c) {
  const base = hex(c);
  const light = mix(base, [255, 255, 255], 0.45), dark = mul(base, 0.62);
  img.each((x, y) => {
    const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
    const d = dx + dy;
    let col = base;
    if (d > 11) col = light;
    else if (d > 9.5) col = dark;
    else if (d < 2.5) col = light;
    else if (Math.abs(d - 6) < 0.6) col = mix(base, light, 0.5);
    if (x === 0 || y === 0) col = mix(col, light, 0.3);
    if (x === S - 1 || y === S - 1) col = mix(col, dark, 0.4);
    img.set(x, y, mix(col, [255, 255, 255], img.rng.next() * 0.05));
  });
  return img;
}

// ---------------------------------------------------------------- sprite helpers (plants, items)
function sprite(img) { img.clear(); return img; }
function line(img, x0, y0, x1, y1, c, a = 255) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) img.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c, a);
}
function stem(img, x, y0, y1, c, sway = 0) {
  for (let y = y0; y <= y1; y++) img.set(x + Math.round(Math.sin((y1 - y) * 0.5) * sway), y, c);
}
function blob(img, cx, cy, rad, cols, a = 255) {
  for (let y = -Math.ceil(rad); y <= Math.ceil(rad); y++) for (let x = -Math.ceil(rad); x <= Math.ceil(rad); x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d <= rad) {
      const t = (x + y) / (2 * rad + 0.001);
      const idx = Math.max(0, Math.min(cols.length - 1, Math.floor((0.5 - t * 0.6) * cols.length)));
      img.set(cx + x, cy + y, cols[idx], a);
    }
  }
}

function grassBlades(img, cols, { n = 14, maxH = 13, tint = true } = {}) {
  sprite(img);
  const r = img.rng;
  for (let k = 0; k < n; k++) {
    const x = 1 + r.int(14);
    const h = 4 + r.int(maxH - 3);
    const lean = (r.next() - 0.5) * 0.5;
    for (let i = 0; i < h; i++) {
      const c = cols[Math.min(cols.length - 1, Math.floor((i / h) * cols.length))];
      img.set(Math.round(x + lean * i), 15 - i, tint ? c : c);
    }
  }
  return img;
}

function flowerTex(img, petal, center, { stemC = hex('#4e8a3a'), y = 6, shape = 'round', leaves = true } = {}) {
  sprite(img);
  stem(img, 8, y + 2, 15, stemC);
  if (leaves) { img.set(7, 12, stemC); img.set(6, 11, stemC); img.set(9, 10, stemC); img.set(10, 9, mul(stemC, 1.15)); }
  const pl = mix(petal, [255, 255, 255], 0.35), pd = mul(petal, 0.75);
  if (shape === 'round') {
    for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [-1, 0], [1, 0], [0, 1]]) {
      img.set(8 + dx, y + dy, (dx + dy < 0 ? pl : dx + dy > 0 ? pd : petal));
    }
    img.set(8, y, center);
  } else if (shape === 'bell') {
    for (const [cx, cy] of [[6, y], [10, y + 1], [8, y - 2]]) {
      img.set(cx, cy, pl); img.set(cx - 1, cy + 1, petal); img.set(cx, cy + 1, petal); img.set(cx + 1, cy + 1, pd);
      img.set(cx - 1, cy + 2, pd); img.set(cx + 1, cy + 2, pd); img.set(cx, cy + 2, center);
    }
    line(img, 8, y - 1, 8, y + 2, stemC); line(img, 6, y - 1, 8, y - 2, stemC); line(img, 10, y, 8, y - 1, stemC);
  } else if (shape === 'star') {
    for (const [dx, dy] of [[0, -3], [0, -2], [-3, 0], [-2, 0], [3, 0], [2, 0], [0, 2], [-2, 2], [2, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) img.set(8 + dx, y + dy, Math.abs(dx) + Math.abs(dy) > 2 ? pl : petal);
    img.set(8, y, center);
  } else if (shape === 'tuft') {
    for (let k = 0; k < 9; k++) { const dx = img.rng.int(5) - 2, dy = img.rng.int(4) - 2; img.set(8 + dx, y + dy, img.rng.chance(0.5) ? petal : pl); }
    img.set(8, y + 2, center); img.set(7, y + 1, pd); img.set(9, y + 1, pd);
  } else if (shape === 'lily') {
    for (const [dx, dy, c] of [[0, -3, pl], [0, -2, petal], [-1, -1, petal], [1, -1, petal], [-2, 0, pl], [2, 0, pl], [-1, 0, petal], [1, 0, petal], [0, -1, petal], [-3, -1, pl], [3, -1, pl]]) img.set(8 + dx, y + dy, c);
    img.set(8, y, center); img.set(8, y - 1, center);
  }
  return img;
}

function cropTex(img, stage, { stalk, ripe, kind }) {
  sprite(img);
  const r = img.rng;
  const h = [4, 7, 10, 13][stage];
  for (let k = 0; k < 6; k++) {
    const x = 1 + k * 2.5 + r.next();
    const hh = h - r.int(3);
    for (let i = 0; i < hh; i++) img.set(Math.round(x + Math.sin(i * 0.4 + k) * 0.6), 15 - i, mix(stalk[0], stalk[1], i / hh));
    if (stage === 3 && kind === 'wheat') for (let i = 0; i < 4; i++) { img.set(Math.round(x), 15 - hh + i, ripe[i % ripe.length]); img.set(Math.round(x) + 1, 15 - hh + i + 1, ripe[(i + 1) % ripe.length]); }
    if (kind === 'radish' && stage >= 1) { img.set(Math.round(x) - 1, 15 - hh + 1, stalk[1]); img.set(Math.round(x) + 1, 15 - hh + 2, stalk[1]); }
  }
  if (kind === 'radish' && stage === 3) { blob(img, 5, 14, 1.6, ripe); blob(img, 11, 14, 1.6, ripe); }
  if (kind === 'sunroot' && stage === 3) { blob(img, 8, 14, 1.8, ripe); img.set(4, 14, ripe[1]); img.set(12, 15, ripe[1]); }
  if (kind === 'melon' && stage >= 2) { for (let i = 0; i < 5; i++) img.set(3 + i * 2, 10 - (i % 2), hex('#4f8a2f')); }
  if (kind === 'melon' && stage === 3) { img.set(13, 9, hex('#f5c242')); img.set(12, 10, hex('#e8a030')); }
  return img;
}

// ---------------------------------------------------------------- texture table
const TEX = Object.create(null);
const def = (name, fn) => { TEX[name] = fn; };

def('bedrock', (i) => {
  noisy(i, pal('#1d1b22', '#29262f', '#36323d', '#45404c', '#56505e'), { f1: 8, f2: 16, w3: 0.4 });
  speckle(i, hex('#6b6375'), 6);
});
def('stone', (i) => stoneTex(i));
def('cobblestone', (i) => cobbleTex(i, pal('#4a5059', '#5b626c', '#69717c', '#77808a', '#868e98', '#959ea8'), 10));
def('deepstone', (i) => {
  noisy(i, P.deep, { f1: 4, f2: 16, w3: 0.3 });
  for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x++) if (i.rng.next() < 0.5) i.blend(x, y + (x >> 3), P.deep[0], 0.5);
});
def('deep_cobble', (i) => cobbleTex(i, pal('#1f1d27', '#2a2733', '#34303f', '#3e394b', '#4a4458', '#575168'), 11));
def('dirt', (i) => { noisy(i, P.dirt, { f1: 4, f2: 16, w3: 0.35 }); speckle(i, hex('#a07a58'), 5); speckle(i, hex('#4a3122'), 6); });
def('grass_top', (i) => {
  noisy(i, P.grass, { f1: 4, f2: 16, w3: 0.4 });
  for (let k = 0; k < 18; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, gray(222)); i.set(x, y + 1, gray(150)); }
});
def('grass_side', (i) => {
  TEX.dirt(i);
  const r = i.rng;
  for (let x = 0; x < S; x++) {
    const h = 3 + r.int(3) + (x % 5 === 0 ? 1 : 0);
    for (let y = 0; y < h; y++) i.set(x, y, gray(y === h - 1 ? 128 : 150 + r.int(60)));
  }
});
def('sand', (i) => { noisy(i, P.sand, { f1: 4, f2: 16, w3: 0.4 }); speckle(i, hex('#b89f6b'), 8); speckle(i, hex('#fff2c8'), 4); });
def('redsand', (i) => { noisy(i, P.redsand, { f1: 4, f2: 16, w3: 0.4 }); speckle(i, hex('#8c4225'), 8); });
def('gravel', (i) => cobbleTex(i, P.gravel, 18));
def('clay', (i) => { noisy(i, pal('#8f98a8', '#99a2b2', '#a3acbc', '#adb6c5'), { f1: 2, f2: 8, w3: 0.2 }); for (let y = 3; y < S; y += 5) for (let x = 0; x < S; x++) i.blend(x, y, hex('#7f8898'), 0.3); });
def('sandstone', (i) => {
  noisy(i, P.sand, { f1: 2, f2: 8, w3: 0.2 });
  for (let x = 0; x < S; x++) { i.blend(x, 0, hex('#f2e2b6'), 0.6); i.blend(x, 4, hex('#bda270'), 0.5); i.blend(x, 11, hex('#bda270'), 0.4); i.blend(x, 15, hex('#a88c5c'), 0.6); }
});
def('sandstone_top', (i) => { noisy(i, P.sand, { f1: 2, f2: 4, w3: 0.15 }); });
def('cut_sandstone', (i) => {
  TEX.sandstone_top(i);
  i.rect(0, 0, 15, 1, hex('#bda270')); i.rect(0, 14, 15, 15, hex('#bda270'));
  for (const [x, y] of [[3, 5], [4, 6], [5, 7], [6, 8], [7, 7], [8, 6], [9, 7], [10, 8], [11, 7], [12, 6]]) { i.set(x, y, hex('#a88c5c')); i.set(x, y + 3, hex('#a88c5c')); }
});
def('redrock', (i) => {
  noisy(i, P.redsand, { f1: 2, f2: 8, w3: 0.2 });
  for (let x = 0; x < S; x++) { i.blend(x, 3, hex('#8c4225'), 0.5); i.blend(x, 9, hex('#e09060'), 0.4); i.blend(x, 14, hex('#8c4225'), 0.6); }
});
def('redrock_top', (i) => noisy(i, P.redsand, { f1: 2, f2: 4, w3: 0.15 }));
def('terracotta', (i) => noisy(i, P.terracotta, { f1: 2, f2: 8, w3: 0.2 }));
const terra = (c) => (i) => { const b = hex(c); noisy(i, [mul(b, 0.88), mul(b, 0.94), b, mul(b, 1.05)], { f1: 2, f2: 8, w3: 0.25 }); };
def('terra_orange', terra('#c27a3a'));
def('terra_cream', terra('#d9bf9a'));
def('terra_rust', terra('#8f3a2c'));
def('terra_umber', terra('#5c4033'));
def('snow', (i) => { noisy(i, P.snow, { f1: 4, f2: 8, w3: 0.3 }); speckle(i, hex('#cfdbe8'), 6); });
def('snow_side', (i) => {
  TEX.dirt(i);
  for (let x = 0; x < S; x++) { const h = 4 + i.rng.int(3); for (let y = 0; y < h; y++) i.set(x, y, P.snow[1 + i.rng.int(4)]); i.set(x, h, hex('#c9d6e4')); }
});
def('ice', (i) => {
  noisy(i, P.ice, { f1: 2, f2: 8, w3: 0.15 });
  i.each((x, y) => i.setA(x, y, 190));
  for (const [x0, y0, len] of [[2, 3, 6], [9, 1, 5], [4, 10, 7]]) for (let k = 0; k < len; k++) i.set(x0 + k, y0 + (k >> 1), hex('#e8f4ff'), 220);
});
def('packed_ice', (i) => { noisy(i, pal('#7aa6dd', '#86b1e5', '#93bdeb', '#a1c8f0'), { f1: 4, f2: 8, w3: 0.2 }); for (let k = 0; k < 4; k++) line(i, i.rng.int(S), i.rng.int(S), i.rng.int(S), i.rng.int(S), hex('#c2dcf7')); });
def('obsidian', (i) => { noisy(i, P.obsidian, { f1: 4, f2: 8, w3: 0.3 }); for (let k = 0; k < 6; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#6a4c9c')); } });
def('magma', (i) => {
  const v = voronoi(i, 8);
  i.each((x, y) => {
    const c = v(x, y);
    if (c.edge < 1.3) { i.set(x, y, P.lava[3 + (c.edge < 0.6 ? 1 : 0)]); i.glow(x, y, 1 - c.edge / 1.3); }
    else i.set(x, y, mix(hex('#3a1a12'), hex('#5a2a1a'), c.rnd));
  });
});
def('mycel_top', (i) => {
  noisy(i, P.mycel, { f1: 4, f2: 16, w3: 0.4 });
  for (let k = 0; k < 9; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#7ef0d8')); i.glow(x, y, 0.8); }
});
def('mycel_side', (i) => {
  TEX.deepstone(i);
  for (let x = 0; x < S; x++) { const h = 2 + i.rng.int(3); for (let y = 0; y < h; y++) i.set(x, y, P.mycel[i.rng.int(4)]); }
});
def('moss', (i) => { noisy(i, pal('#3f6a2f', '#4a7a36', '#56893e', '#629846', '#70a650'), { f1: 4, f2: 16, w3: 0.4 }); });
def('pale_soil', (i) => noisy(i, P.pale, { f1: 4, f2: 16, w3: 0.35 }));
def('pale_top', (i) => {
  noisy(i, P.pale, { f1: 4, f2: 16, w3: 0.35 });
  for (let k = 0; k < 6; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#a6e7ff')); i.glow(x, y, 0.7); }
});
def('pale_side', (i) => { TEX.pale_soil(i); for (let x = 0; x < S; x++) i.blend(x, 0, hex('#ffffff'), 0.5); });
def('mud', (i) => { noisy(i, P.mud, { f1: 4, f2: 8, w3: 0.3 }); for (let k = 0; k < 5; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#6a5a48')); } });

// ores
const stoneBase = (i) => stoneTex(i);
const deepBase = (i) => TEX.deepstone(i);
def('coal_ore', (i) => oreTex(i, stoneBase, pal('#141416', '#1f1f23', '#2c2c31', '#4a4a52'), { n: 5 }));
def('copper_ore', (i) => { oreTex(i, stoneBase, P.copper, { n: 4 }); speckle(i, P.patina[1], 3); });
def('iron_ore', (i) => oreTex(i, stoneBase, pal('#a88570', '#c29e86', '#d8b59a', '#ecd0b8'), { n: 5 }));
def('deep_gold_ore', (i) => oreTex(i, stoneBase, P.gold, { n: 4 }));
def('crystal_ore', (i) => oreTex(i, stoneBase, P.crystal, { n: 5, glow: true, pattern: 'shard' }));
def('deep_crystal_ore', (i) => oreTex(i, deepBase, P.crystal, { n: 6, glow: true, pattern: 'shard' }));
def('star_ore', (i) => oreTex(i, deepBase, P.star, { n: 4, glow: true, pattern: 'shard' }));
def('deep_iron_ore', (i) => oreTex(i, deepBase, pal('#a88570', '#c29e86', '#d8b59a', '#ecd0b8'), { n: 5 }));
def('meteor_rock', (i) => {
  noisy(i, P.meteor, { f1: 4, f2: 8, w3: 0.35 });
  for (let k = 0; k < 6; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#1a1214')); i.set(x + 1, y, hex('#6a4c48')); }
});
def('meteor_ore', (i) => oreTex(i, TEX.meteor_rock, pal('#a33a1c', '#d4562a', '#ff7a3a', '#ffb070'), { n: 5, glow: true }));
def('star_core', (i) => {
  i.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    const c = mix(hex('#ffffff'), hex('#7aa8ff'), Math.min(1, d / 9));
    i.set(x, y, mix(c, hex('#c8a8ff'), i.rng.next() * 0.3));
    i.glow(x, y, 1 - d / 14);
  });
});

// liquids (gray -> tinted per biome)
def('water_still', (i) => {
  const f = field(i, 4, 1), g = field(i, 8, 2);
  i.each((x, y) => { const v = f(x, y) * 0.6 + g(x, y) * 0.4; i.set(x, y, gray(150 + v * 70), 175); });
  for (let k = 0; k < 8; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, gray(235), 190); i.set(x + 1, y, gray(225), 185); }
});
def('water_flow', (i) => {
  const f = field(i, 4, 3);
  i.each((x, y) => { const v = f(x * 0.5, y * 2); i.set(x, y, gray(145 + v * 80), 180); });
});
def('lava_still', (i) => {
  const f = field(i, 4, 1), g = field(i, 8, 2);
  i.each((x, y) => {
    const v = f(x, y) * 0.65 + g(x, y) * 0.35;
    i.set(x, y, P.lava[Math.min(P.lava.length - 1, Math.floor(v * P.lava.length * 1.1))]);
    i.glow(x, y, 0.5 + v * 0.5);
  });
});
def('lava_flow', (i) => {
  const f = field(i, 4, 5);
  i.each((x, y) => { const v = f(x * 0.5, y * 2); i.set(x, y, P.lava[Math.min(5, Math.floor(v * 6.5))]); i.glow(x, y, 0.5 + v * 0.5); });
});

// woods
const WOODTEX = {
  oak: { bark: P.oakBark, plank: P.oakPlank, leaves: [gray(110), gray(130), gray(150), gray(170), gray(190)], sap: ['#3d6b2a', '#5a8f3a'] },
  birch: { bark: P.birchBark, plank: P.birchPlank, leaves: pal('#7fae4a', '#8fbd55', '#a0cb62', '#b2d872', '#c5e388'), sap: ['#6f9a3c', '#a8c86a'], spots: hex('#2f2b27') },
  pine: { bark: P.pineBark, plank: P.pinePlank, leaves: pal('#1f4a35', '#265640', '#2e634a', '#376f54', '#437d60'), sap: ['#244a33', '#3a6e4e'] },
  blossom: { bark: P.blossomBark, plank: P.blossomPlank, leaves: pal('#d77199', '#e48aae', '#ee9fbe', '#f5b8cf', '#fbd3e2'), sap: ['#7b5a3a', '#f0a0c0'] },
  willow: { bark: P.willowBark, plank: P.willowPlank, leaves: [gray(100), gray(120), gray(140), gray(160), gray(176)], sap: ['#4a5e2a', '#7a8f45'] },
  cloud: { bark: P.cloudBark, plank: P.cloudPlank, leaves: pal('#bcd8f2', '#cbe2f6', '#d9ebfa', '#e7f3fd', '#f5faff'), sap: ['#9fb7d6', '#e7f3fd'] },
};
for (const [w, t] of Object.entries(WOODTEX)) {
  def(`${w}_log`, (i) => logSide(i, t.bark, { streak: w === 'birch' ? 0.2 : 0.65, spots: t.spots }));
  def(`${w}_log_top`, (i) => logTop(i, t.bark, [mul(t.plank[0], 0.85), t.plank[1], t.plank[3]]));
  def(`${w}_planks`, (i) => planksTex(i, t.plank));
  def(`${w}_leaves`, (i) => leavesTex(i, t.leaves, {
    holes: w === 'pine' ? 0.12 : 0.22,
    blossoms: w === 'cloud' ? [hex('#ffffff'), hex('#bfe3ff')] : w === 'blossom' ? [hex('#ffffff'), hex('#fff0f6')] : null,
    berries: null,
  }));
  def(`${w}_sapling`, (i) => {
    sprite(i);
    const stemC = hex(t.sap[0]);
    stem(i, 8, 7, 15, mul(hex(WOODTEX[w].bark[2].map ? '#000000' : '#000000'), 1));
    stem(i, 8, 8, 15, t.bark[1]);
    blob(i, 8, 6, 3.2, [hex(t.sap[1]), stemC, mul(stemC, 0.8)]);
    blob(i, 5, 9, 1.8, [hex(t.sap[1]), stemC]);
    blob(i, 11, 8, 1.8, [hex(t.sap[1]), stemC]);
  });
}
def('mush_stem', (i) => { noisy(i, pal('#cfc6b8', '#d9d1c4', '#e3dccf', '#ece6da'), { f1: 2, f2: 8, w3: 0.2 }); for (let x = 1; x < S; x += 3) for (let y = 0; y < S; y++) if (i.rng.next() < 0.5) i.blend(x, y, hex('#b0a694'), 0.4); });
def('mush_stem_top', (i) => { TEX.mush_stem(i); blob(i, 8, 8, 4.5, pal('#a89d8a', '#bdb3a1')); });
def('glowcap', (i) => {
  noisy(i, pal('#165e70', '#1c7489', '#2389a1', '#2da0b9'), { f1: 4, f2: 8, w3: 0.3 });
  for (let k = 0; k < 10; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#9ff6ff')); i.set(x + 1, y, hex('#62dff2')); }
});
def('ambercap', (i) => {
  noisy(i, pal('#8f3f12', '#a84d16', '#c05e1c', '#d77224'), { f1: 4, f2: 8, w3: 0.3 });
  for (let k = 0; k < 10; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#ffd38a')); }
});

// plants
def('tall_grass', (i) => grassBlades(i, [gray(120), gray(150), gray(180), gray(205)]));
def('fern', (i) => {
  sprite(i);
  for (const [x0, lean, h] of [[8, 0, 13], [5, -0.4, 10], [11, 0.4, 10], [3, -0.7, 7], [13, 0.7, 7]]) {
    for (let k = 0; k < h; k++) {
      const x = Math.round(x0 + lean * k), y = 15 - k;
      i.set(x, y, gray(130 + k * 5));
      if (k > 2 && k % 2 === 0) { i.set(x - 1, y, gray(170)); i.set(x + 1, y, gray(160)); }
    }
  }
});
def('dawnflower', (i) => flowerTex(i, hex('#f6c544'), hex('#e0702a'), { shape: 'round' }));
def('bellbloom', (i) => flowerTex(i, hex('#f08ab0'), hex('#fff1f6'), { shape: 'bell', y: 5 }));
def('bluestar', (i) => flowerTex(i, hex('#5a8cf0'), hex('#fff6b0'), { shape: 'star', y: 6 }));
def('emberbloom', (i) => flowerTex(i, hex('#e5432f'), hex('#3a1a12'), { shape: 'tuft', y: 6 }));
def('moonlily', (i) => flowerTex(i, hex('#dfe7ff'), hex('#9fd4ff'), { shape: 'lily', y: 7, stemC: hex('#4f7a6a') }));
def('dead_bush', (i) => {
  sprite(i);
  const c = hex('#7a5a36');
  line(i, 8, 15, 8, 9, c); line(i, 8, 11, 4, 6, c); line(i, 8, 10, 12, 5, c); line(i, 5, 8, 3, 9, c); line(i, 11, 7, 13, 8, c); line(i, 8, 9, 7, 4, c);
});
def('reeds', (i) => {
  sprite(i);
  for (const x of [3, 7, 11, 13]) {
    for (let y = 0; y < S; y++) i.set(x, y, y % 5 === 0 ? hex('#7fae5a') : hex('#9cca6e'));
    i.set(x + 1, 3 + (x % 4), hex('#6f9a48'));
  }
});
def('glowshroom', (i) => {
  sprite(i);
  for (const [cx, cy, r] of [[6, 9, 2.6], [11, 11, 1.8]]) {
    line(i, cx, cy + 1, cx, 15, hex('#cfe9e0'));
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) for (let y = -2; y <= 0; y++) if (Math.abs(x) <= r + y * 0.8) i.set(cx + x, cy + y, y === -2 ? hex('#c8fff2') : hex('#57e0c4'));
  }
});
def('red_mushroom', (i) => {
  sprite(i);
  line(i, 8, 9, 8, 15, hex('#e8dcc8'));
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 0; y++) if (Math.abs(x) <= 3 + y * 0.6) i.set(8 + x, 9 + y, hex('#c8322a'));
  i.set(7, 7, hex('#ffffff')); i.set(9, 8, hex('#ffffff')); i.set(6, 8, hex('#ffffff'));
});
const bush = (i, ripe) => {
  sprite(i);
  blob(i, 8, 10, 5.5, pal('#5f9a52', '#4a8442', '#3a6e36'));
  blob(i, 5, 7, 3, pal('#6aa85c', '#4a8442'));
  blob(i, 11, 7, 3, pal('#6aa85c', '#4a8442'));
  for (let k = 0; k < 18; k++) { const x = i.rng.int(S), y = 3 + i.rng.int(13); if (i.alpha(x, y) && i.rng.chance(0.3)) i.setA(x, y, 0); }
  if (ripe) for (const [x, y] of [[5, 8], [10, 6], [8, 11], [12, 10], [4, 12], [9, 8]]) { i.set(x, y, hex('#8fc6ff')); i.set(x + 1, y, hex('#4a7ad8')); }
};
def('berry_bush', (i) => bush(i, false));
def('berry_bush_ripe', (i) => bush(i, true));
def('cactus_side', (i) => {
  noisy(i, pal('#2f6a3a', '#377a43', '#3f894b', '#4a9856'), { f1: 2, f2: 8, w3: 0.2 });
  for (let y = 0; y < S; y++) { i.set(0, y, hex('#245a30'), 0); i.set(15, y, hex('#245a30'), 0); }
  for (let y = 0; y < S; y++) { i.set(1, y, hex('#245a30')); i.set(14, y, hex('#245a30')); }
  for (let y = 1; y < S; y += 4) for (const x of [4, 8, 11]) i.set(x, y + (x % 3), hex('#e8e0b8'));
});
def('cactus_top', (i) => { noisy(i, pal('#377a43', '#3f894b', '#4a9856'), { f1: 2, f2: 4, w3: 0.2 }); blob(i, 8, 8, 2.5, pal('#6ab06a', '#4a9856')); for (let x = 0; x < S; x++) { i.set(x, 0, hex('#245a30')); i.set(x, 15, hex('#245a30')); i.set(0, x, hex('#245a30')); i.set(15, x, hex('#245a30')); } });
def('lily_pad', (i) => {
  sprite(i);
  i.each((x, y) => {
    const dx = x - 7.5, dy = y - 7.5;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    if (d < 7.2 && !(ang > 0.2 && ang < 0.7)) i.set(x, y, gray(d < 2 ? 190 : (Math.abs(Math.sin(ang * 5)) < 0.15 ? 150 : 170)));
  });
});
def('seagrass', (i) => {
  sprite(i);
  for (const [x0, h, ph] of [[4, 14, 0], [8, 16, 1], [12, 12, 2], [6, 9, 3], [10, 11, 4]]) for (let k = 0; k < h; k++) i.set(Math.round(x0 + Math.sin(k * 0.5 + ph) * 1.2), 15 - k, mix(hex('#2f6a3a'), hex('#6ab06a'), k / h));
});
def('vines', (i) => {
  sprite(i);
  for (const x0 of [2, 6, 10, 13]) {
    let x = x0;
    const len = 8 + i.rng.int(8);
    for (let y = 0; y < len; y++) {
      i.set(x, y, gray(120 + i.rng.int(60)));
      if (i.rng.chance(0.4)) i.set(x + 1, y, gray(170));
      if (i.rng.chance(0.25)) x += i.rng.chance(0.5) ? 1 : -1;
    }
  }
});
def('crystal_cluster', (i) => {
  sprite(i);
  const p = P.echo;
  for (const [x0, h, lean] of [[8, 13, 0], [5, 9, -0.25], [11, 10, 0.3], [3, 5, -0.4], [13, 6, 0.4]]) {
    for (let k = 0; k < h; k++) {
      const x = Math.round(x0 + lean * k), y = 15 - k;
      const w = k < h - 2 ? 1 : 0;
      i.set(x, y, p[3 + (k > h - 3 ? 2 : 0)]);
      if (w) { i.set(x - 1, y, p[1]); i.set(x + 1, y, p[4]); }
    }
  }
});
def('crystal_bud', (i) => {
  sprite(i);
  const p = P.echo;
  for (const [x0, h] of [[7, 6], [10, 4], [5, 3]]) for (let k = 0; k < h; k++) { i.set(x0, 15 - k, p[k === h - 1 ? 5 : 3]); if (k < h - 1) i.set(x0 + 1, 15 - k, p[1]); }
});
def('echo_block', (i) => {
  const v = voronoi(i, 7);
  i.each((x, y) => { const c = v(x, y); const idx = c.edge < 0.8 ? 1 : 2 + Math.floor(c.rnd * 3); i.set(x, y, P.echo[idx]); });
  for (let k = 0; k < 5; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, P.echo[5]); i.glow(x, y, 1); }
});
def('budding_echo', (i) => {
  TEX.echo_block(i);
  for (let k = 0; k < 6; k++) { const x = 2 + i.rng.int(12), y = 2 + i.rng.int(12); i.set(x, y, P.echo[0]); i.set(x + 1, y, P.echo[5]); i.glow(x + 1, y, 1); }
});
def('cobweb', (i) => {
  sprite(i);
  const c = [230, 232, 238];
  for (let k = 0; k < S; k++) { i.set(k, k, c, 200); i.set(15 - k, k, c, 200); i.set(8, k, c, 170); i.set(k, 8, c, 170); }
  for (const r of [3, 6]) for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; i.set(Math.round(8 + Math.cos(t) * r), Math.round(8 + Math.sin(t) * r), c, 150); }
});
def('pale_crystal', (i) => {
  i.each((x, y) => {
    const v = ((x * 3 + y * 5) % 7) / 7;
    i.set(x, y, mix(hex('#bfe6ff'), hex('#f0fbff'), v), 200);
  });
  for (let y = 0; y < S; y++) { i.set(3, y, hex('#ffffff'), 230); i.set(11, y, hex('#9fd4f5'), 220); }
});
def('levistone', (i) => {
  const v = voronoi(i, 6, 2);
  i.each((x, y) => { const c = v(x, y); i.set(x, y, c.edge < 0.9 ? hex('#5a6fb0') : mix(hex('#8fa8e8'), hex('#c4d4ff'), c.rnd)); });
  for (let k = 0; k < 5; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#ffffff')); i.glow(x, y, 1); i.set(x, y + 1, hex('#e0e8ff')); i.glow(x, y + 1, 0.6); }
});
def('cloud', (i) => { const f = field(i, 4, 1); i.each((x, y) => i.set(x, y, gray(235 + f(x, y) * 20), 220)); });
def('skygrass_top', (i) => {
  noisy(i, pal('#4fbf9a', '#5acaa5', '#66d4b0', '#74dcba', '#84e4c6'), { f1: 4, f2: 16, w3: 0.4 });
  for (let k = 0; k < 7; k++) { const x = i.rng.int(S), y = i.rng.int(S); i.set(x, y, hex('#e8fff8')); i.glow(x, y, 0.5); }
});
def('skygrass_side', (i) => {
  TEX.dirt(i);
  for (let x = 0; x < S; x++) { const h = 3 + i.rng.int(3); for (let y = 0; y < h; y++) i.set(x, y, pal('#4fbf9a', '#5acaa5', '#66d4b0')[i.rng.int(3)]); }
});

// crops
def('farmland', (i) => { noisy(i, P.dirt, { f1: 4, f2: 8, w3: 0.3 }); for (let y = 1; y < S; y += 4) for (let x = 0; x < S; x++) i.blend(x, y, hex('#3e2a1c'), 0.6); });
def('farmland_wet', (i) => { noisy(i, pal('#3a281c', '#432f21', '#4c3626', '#553d2b'), { f1: 4, f2: 8, w3: 0.3 }); for (let y = 1; y < S; y += 4) for (let x = 0; x < S; x++) i.blend(x, y, hex('#24180f'), 0.6); });
for (let s = 0; s < 4; s++) {
  def(`wheat_${s}`, (i) => cropTex(i, s, { stalk: s === 3 ? pal('#a88a3a', '#d8b850') : pal('#3f7a2f', '#6aa848'), ripe: pal('#f0d060', '#d8a838', '#fff0a0'), kind: 'wheat' }));
  def(`radish_${s}`, (i) => cropTex(i, s, { stalk: pal('#3f7a2f', '#7ac05a'), ripe: pal('#f0f4ff', '#c8d8f8', '#a0b8e8'), kind: 'radish' }));
  def(`melon_stem_${s}`, (i) => cropTex(i, s, { stalk: pal('#3f7a2f', '#7ac05a'), ripe: [], kind: 'melon' }));
  def(`sunroot_${s}`, (i) => cropTex(i, s, { stalk: pal('#4a7a2a', '#9ac04a'), ripe: pal('#e8a83a', '#f0c860', '#c88a28'), kind: 'sunroot' }));
}
def('melon_side', (i) => {
  i.each((x, y) => {
    const stripe = Math.abs(((x + 2) % 5) - 2) < 1;
    i.set(x, y, stripe ? hex('#f7b23a') : mix(hex('#e8742a'), hex('#d45a1e'), i.rng.next() * 0.6));
    if (stripe) i.glow(x, y, 0.5);
  });
});
def('melon_top', (i) => { i.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); i.set(x, y, d < 2 ? hex('#5a8a2a') : mix(hex('#e8742a'), hex('#f7b23a'), (Math.sin(Math.atan2(y - 7.5, x - 7.5) * 6) + 1) / 2 * 0.6)); }); });

// building
def('stone_bricks', (i) => bricksTex(i, pal('#6a7380', '#757e8b', '#808996', '#8b94a0'), hex('#4a515b'), { bw: 8, bh: 8, offset: 4 }));
def('mossy_bricks', (i) => {
  TEX.stone_bricks(i);
  const f = field(i, 4, 7);
  i.each((x, y) => { if (f(x, y) > 0.55 && i.rng.chance(0.8)) i.set(x, y, pal('#4a7a36', '#56893e', '#629846')[i.rng.int(3)]); });
});
def('cracked_bricks', (i) => {
  TEX.stone_bricks(i);
  line(i, 2, 1, 6, 6, hex('#3e444d')); line(i, 6, 6, 5, 11, hex('#3e444d')); line(i, 11, 9, 14, 14, hex('#3e444d'));
});
def('chiseled_stone', (i) => {
  i.fill(P.stone[3]);
  i.each((x, y) => { if (x === 0 || y === 0) i.set(x, y, P.stone[5]); if (x === 15 || y === 15) i.set(x, y, P.stone[0]); });
  for (let k = 3; k <= 12; k++) { i.set(k, 3, P.stone[1]); i.set(k, 12, P.stone[4]); i.set(3, k, P.stone[1]); i.set(12, k, P.stone[4]); }
  blob(i, 8, 8, 2, [P.stone[5], P.stone[2]]);
});
def('deep_bricks', (i) => bricksTex(i, pal('#34303f', '#3c3748', '#443f51', '#4d475b'), hex('#1d1b24'), { bw: 8, bh: 4, offset: 4 }));
def('deep_tiles', (i) => bricksTex(i, pal('#2f2c39', '#383443', '#423d4e'), hex('#1a1820'), { bw: 8, bh: 8, offset: 0 }));
def('polished_stone', (i) => {
  noisy(i, pal('#7c8591', '#838c98', '#89929d'), { f1: 2, f2: 4, w3: 0.15 });
  i.each((x, y) => { if (x === 0 || y === 0) i.set(x, y, hex('#a3acb6')); if (x === 15 || y === 15) i.set(x, y, hex('#5d6470')); });
});
def('bricks', (i) => bricksTex(i, pal('#8f3f2f', '#a14a37', '#b0543e', '#bd6047'), hex('#c9b8a6'), { bw: 8, bh: 4, offset: 4 }));
def('glass', (i) => glassTex(i, hex('#cfe7f2'), 0, 255));
def('bookshelf', (i) => {
  TEX.oak_planks(i);
  const books = pal('#8f2f2f', '#2f5f8f', '#3f7a3f', '#8f7a2f', '#6a3f8f', '#2f7a7a', '#a35a2a');
  for (const y0 of [1, 9]) {
    i.rect(1, y0, 14, y0 + 5, hex('#3a2616'));
    let x = 1;
    while (x < 15) {
      const w = 1 + i.rng.int(2), h = 4 + i.rng.int(2);
      const c = i.rng.pick(books);
      for (let xx = x; xx < Math.min(15, x + w); xx++) for (let y = y0 + 6 - h; y < y0 + 6; y++) i.set(xx, y, y === y0 + 6 - h ? mix(c, [255, 255, 255], 0.3) : c);
      x += w;
    }
  }
});
def('thatch', (i) => { i.each((x, y) => i.set(x, y, mix(hex('#c8a24a'), hex('#e0c060'), ((x * 7 + y * 3) % 5) / 5 * 0.6 + i.rng.next() * 0.3))); for (let y = 3; y < S; y += 5) for (let x = 0; x < S; x++) i.blend(x, y, hex('#8a6a2a'), 0.6); });
def('thatch_top', (i) => { i.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); i.set(x, y, mix(hex('#b08a3a'), hex('#e0c060'), (Math.sin(d * 2) + 1) / 2 * 0.6 + i.rng.next() * 0.2)); }); });
def('copper_block', (i) => { metalBlock(i, P.copper); speckle(i, P.patina[1], 5); });
def('iron_block', (i) => metalBlock(i, P.iron));
def('gold_block', (i) => metalBlock(i, P.gold));
def('stargem_block', (i) => {
  const v = voronoi(i, 6);
  i.each((x, y) => { const c = v(x, y); i.set(x, y, P.star[c.edge < 0.8 ? 0 : 1 + Math.floor(c.rnd * 3)]); if (c.edge > 2) i.glow(x, y, 0.5); });
});
def('meteor_block', (i) => {
  metalBlock(i, pal('#3a2a2c', '#4a3436', '#5a3f40', '#6a4c4c', '#8a6464'));
  for (let k = 0; k < 6; k++) { const x = 1 + i.rng.int(14), y = 1 + i.rng.int(14); i.set(x, y, hex('#ff8a4a')); i.glow(x, y, 1); }
});
def('copper_tiles', (i) => { bricksTex(i, P.copper, hex('#7a3f22'), { bw: 4, bh: 4, offset: 2 }); speckle(i, P.patina[0], 6); speckle(i, P.patina[2], 4); });
def('lamp_stone', (i) => {
  const v = voronoi(i, 8);
  i.each((x, y) => { const c = v(x, y); i.set(x, y, c.edge < 0.9 ? hex('#c8a45a') : mix(hex('#fff2c0'), hex('#ffe08a'), c.rnd)); });
});
for (const [c, , h] of COLORS) {
  def(`felt_${c}`, (i) => feltTex(i, h));
  def(`glaze_${c}`, (i) => glazeTex(i, h));
  def(`glass_${c}`, (i) => glassTex(i, hex(h), 120, 230));
}

// doors, ladders, lights
def('oak_door', (i) => {
  planksTex(i, P.oakPlank, { rows: 4 });
  i.each((x, y) => { if (x === 0 || x === 15 || y === 15) i.set(x, y, P.oakBark[1]); });
  i.set(12, 2, hex('#2a2a2a')); i.set(12, 3, hex('#d8c060'));
});
def('oak_door_top', (i) => {
  planksTex(i, P.oakPlank, { rows: 4 });
  i.each((x, y) => { if (x === 0 || x === 15 || y === 0) i.set(x, y, P.oakBark[1]); });
  for (const [x0, y0] of [[3, 3], [9, 3]]) for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 4; x++) i.set(x, y, hex('#bfe2f0'), 0);
  for (let x = 3; x < 13; x++) i.set(x, 9, P.oakBark[1]);
});
def('iron_door', (i) => { metalBlock(i, P.iron, { rivets: false, plates: 0 }); for (let y = 2; y < 14; y += 4) for (let x = 2; x < 14; x++) i.set(x, y, P.iron[1]); i.set(12, 2, hex('#555')); });
def('iron_door_top', (i) => { metalBlock(i, P.iron, { rivets: false, plates: 0 }); for (const [x0, y0] of [[3, 3], [9, 3]]) for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 3; x++) i.set(x, y, hex('#9fd0e8'), 0); });
def('trapdoor', (i) => {
  planksTex(i, P.oakPlank, { rows: 4 });
  for (const [x0, y0] of [[2, 2], [9, 2], [2, 9], [9, 9]]) for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 5; x++) i.set(x, y, P.oakPlank[0], 0);
  i.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) i.set(x, y, P.oakBark[1]); });
});
def('ladder', (i) => {
  sprite(i);
  for (let y = 0; y < S; y++) { i.set(2, y, P.oakPlank[1]); i.set(3, y, P.oakPlank[3]); i.set(12, y, P.oakPlank[1]); i.set(13, y, P.oakPlank[3]); }
  for (const y of [2, 6, 10, 14]) for (let x = 4; x < 12; x++) i.set(x, y, x % 3 === 0 ? P.oakPlank[0] : P.oakPlank[2]);
});
def('torch', (i) => {
  sprite(i);
  for (let y = 9; y < 16; y++) { i.set(7, y, hex('#6e4f34')); i.set(8, y, hex('#8a6440')); }
  i.set(7, 6, hex('#ffe08a')); i.set(8, 6, hex('#fff6c8')); i.set(7, 7, hex('#ffb347')); i.set(8, 7, hex('#ffd77a'));
  i.set(7, 8, hex('#ff8c2a')); i.set(8, 8, hex('#ffb347'));
});
const lanternTex = (glass, frame) => (i) => {
  sprite(i);
  for (let y = 7; y < 16; y++) for (let x = 5; x < 11; x++) {
    const edge = x === 5 || x === 10 || y === 7 || y === 15;
    i.set(x, y, edge ? frame : mix(glass, [255, 255, 255], (y === 9 ? 0.4 : 0)));
  }
  for (let y = 0; y < 6; y++) for (let x = 5; x < 11; x++) i.set(x, y, x === 5 || x === 10 || y === 0 ? frame : mul(frame, 1.3));
  for (let y = 2; y < 6; y++) { i.set(11, y, frame); i.set(12, y, mul(frame, 0.8)); }
};
def('lantern', lanternTex(hex('#ffc860'), hex('#3a3f4a')));
def('crystal_lantern', lanternTex(hex('#7cefff'), hex('#4a3f2a')));
def('campfire_log', (i) => {
  logSide(i, P.oakBark);
  for (let k = 0; k < 6; k++) { const x = i.rng.int(S), y = 12 + i.rng.int(4); i.set(x, y, hex('#ff8a3a')); i.glow(x, y, 0.8); }
});
def('fire', (i) => {
  sprite(i);
  const f = field(i, 4, 3);
  i.each((x, y) => {
    const h = 15 - y;
    const w = 7 - Math.abs(x - 7.5);
    const v = f(x, y * 0.7) * 6 + w * 0.9 - h * 0.62;
    if (v > 1.3) {
      const t = Math.min(1, (v - 1.3) / 4);
      i.set(x, y, mix(hex('#ff5a1a'), hex('#fff0a0'), t), 255);
    }
  });
});
def('flower_pot', (i) => { i.fill(hex('#9a4f32')); for (let x = 0; x < S; x++) { i.set(x, 10, hex('#7a3a22')); i.set(x, 11, hex('#b0603c')); } });

// stations
def('workbench_top', (i) => {
  planksTex(i, P.oakPlank, { rows: 2 });
  i.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) i.set(x, y, P.oakBark[1]); });
  line(i, 3, 3, 9, 9, hex('#9aa3ad')); line(i, 3, 4, 8, 9, hex('#6e7682'));
  i.rect(10, 9, 12, 12, hex('#5a3d2a')); i.set(11, 10, hex('#8a6440'));
});
def('workbench_side', (i) => {
  planksTex(i, P.oakPlank);
  i.rect(0, 0, 15, 2, P.oakBark[1]);
  i.rect(2, 5, 5, 7, hex('#9aa3ad')); i.set(3, 8, hex('#6e4f34')); i.set(3, 9, hex('#6e4f34')); i.set(3, 10, hex('#6e4f34'));
  i.rect(10, 5, 11, 11, hex('#6e4f34')); i.rect(9, 4, 12, 5, hex('#6e7682'));
});
def('workbench_front', (i) => {
  TEX.workbench_side(i);
  i.rect(4, 8, 11, 12, hex('#3a2616')); for (let x = 5; x < 11; x += 2) i.set(x, 10, hex('#c8a24a'));
});
def('furnace_side', (i) => {
  cobbleTex(i, pal('#4a5059', '#5b626c', '#69717c', '#77808a', '#868e98'), 12);
  i.rect(0, 0, 15, 1, hex('#3e444d'));
});
def('furnace_top', (i) => { TEX.polished_stone(i); blob(i, 8, 8, 3.5, pal('#4a5059', '#3a3f47')); });
def('furnace_front', (i) => {
  TEX.furnace_side(i);
  i.rect(3, 7, 12, 13, hex('#1a1c20'));
  for (let x = 3; x <= 12; x++) i.set(x, 6, hex('#9aa3ad'));
  i.rect(4, 2, 11, 3, hex('#3e444d'));
});
def('furnace_front_lit', (i) => {
  TEX.furnace_front(i);
  for (let y = 9; y <= 13; y++) for (let x = 3; x <= 12; x++) {
    const v = i.rng.next() + (y - 9) * 0.2;
    if (v > 0.5) { i.set(x, y, v > 1.1 ? hex('#ffd77a') : hex('#ff8c2a')); i.glow(x, y, 0.9); }
  }
});
def('chest_side', (i) => {
  planksTex(i, pal('#7a4f2a', '#8a5a30', '#9a6638', '#a87240'), { rows: 4 });
  i.each((x, y) => { if (x === 0 || x === 15 || y === 0 || y === 15) i.set(x, y, hex('#4a2f1a')); });
  for (let x = 0; x < S; x++) i.set(x, 6, hex('#4a2f1a'));
});
def('chest_top', (i) => { TEX.chest_side(i); for (let x = 0; x < S; x++) i.set(x, 6, hex('#8a5a30')); });
def('chest_front', (i) => { TEX.chest_side(i); i.rect(7, 5, 8, 8, hex('#d8c060')); i.set(7, 7, hex('#3a2a10')); });
def('resonator_top', (i) => {
  TEX.deep_tiles(i);
  for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; const x = Math.round(7.5 + Math.cos(t) * 5), y = Math.round(7.5 + Math.sin(t) * 5); i.set(x, y, P.crystal[3]); i.glow(x, y, 0.8); }
  blob(i, 8, 8, 2.2, [P.crystal[4], P.crystal[2]]); i.glow(8, 8, 1); i.glow(7, 7, 1);
});
def('resonator_side', (i) => {
  TEX.deep_bricks(i);
  for (let x = 2; x < 14; x++) { i.set(x, 3, P.crystal[2]); i.glow(x, 3, 0.6); }
  for (const x of [4, 8, 12]) { i.set(x, 7, P.crystal[3]); i.set(x, 8, P.crystal[3]); i.glow(x, 7, 1); i.glow(x, 8, 1); }
});
def('forge_top', (i) => { metalBlock(i, pal('#3a3f47', '#4a5059', '#5b626c', '#69717c'), { rivets: false }); });
def('forge_side', (i) => { TEX.deep_bricks(i); i.rect(3, 4, 12, 8, hex('#2a2e34')); for (let x = 4; x < 12; x++) i.set(x, 5, hex('#ff8a3a')); });
def('bed_top', (i) => {
  feltTex(i, '#3a6f9a');
  i.rect(0, 0, 15, 4, hex('#e9ecef'));
  for (let x = 0; x < S; x++) { i.set(x, 5, hex('#2a5070')); }
  for (let y = 7; y < S; y += 3) for (let x = 1; x < 15; x++) if ((x + y) % 4 === 0) i.set(x, y, hex('#4f8ab8'));
});
def('bed_side', (i) => { feltTex(i, '#3a6f9a'); for (let x = 0; x < S; x++) { i.set(x, 9, hex('#6e4f34')); for (let y = 10; y < S; y++) i.set(x, y, P.oakPlank[1 + ((x + y) % 2)]); } });
def('cauldron', (i) => { metalBlock(i, pal('#2f3238', '#3a3e45', '#454a52', '#50565f', '#6a717b'), { rivets: false, plates: 0 }); });

// mechanisms
def('wire', (i) => {
  sprite(i);
  for (let y = 5; y <= 10; y++) for (let x = 0; x < S; x++) if (Math.abs(y - 7.5) < 1.6) i.set(x, y, gray(y === 7 || y === 8 ? 255 : 200));
  for (let x = 5; x <= 10; x++) for (let y = 0; y < S; y++) if (Math.abs(x - 7.5) < 1.6) i.set(x, y, gray(x === 7 || x === 8 ? 255 : 200));
  blob(i, 8, 8, 2.6, [gray(255), gray(230)]);
});
def('lever', (i) => { sprite(i); for (let y = 6; y < 16; y++) { i.set(7, y, hex('#8a6440')); i.set(8, y, hex('#6e4f34')); } i.set(7, 6, hex('#5fe6ff')); i.set(8, 6, hex('#2ac4dc')); i.set(7, 7, hex('#2ac4dc')); });
def('power_block', (i) => {
  metalBlock(i, pal('#1a5a6a', '#1f7385', '#26889c', '#2fa3ba', '#7cefff'), { rivets: false, plates: 0 });
  for (let k = 0; k < 4; k++) { line(i, 8, 8, i.rng.int(S), i.rng.int(S), hex('#9ff6ff')); }
  i.each((x, y) => { const c = i.get(x, y); if (c[2] > 230) i.glow(x, y, 0.9); });
  blob(i, 8, 8, 1.6, [hex('#ffffff')]); i.glow(8, 8, 1);
});
def('inverter_on', (i) => { TEX.torch(i); for (const [x, y] of [[7, 6], [8, 6], [7, 7], [8, 7], [7, 8], [8, 8]]) i.set(x, y, (x + y) % 2 ? hex('#9ff6ff') : hex('#2ac4dc')); for (let y = 9; y < 16; y++) { i.set(7, y, hex('#3a3f4a')); i.set(8, y, hex('#4a5059')); } });
def('inverter_off', (i) => { TEX.inverter_on(i); for (const [x, y] of [[7, 6], [8, 6], [7, 7], [8, 7], [7, 8], [8, 8]]) i.set(x, y, hex('#1a4a55')); });
def('repeater', (i) => {
  TEX.polished_stone(i);
  for (let y = 2; y < 14; y++) i.set(8, y, hex('#1a4a55'));
  line(i, 8, 2, 5, 5, hex('#1a4a55')); line(i, 8, 2, 11, 5, hex('#1a4a55'));
});
def('repeater_on', (i) => {
  TEX.polished_stone(i);
  for (let y = 2; y < 14; y++) i.set(8, y, hex('#7cefff'));
  line(i, 8, 2, 5, 5, hex('#7cefff')); line(i, 8, 2, 11, 5, hex('#7cefff'));
});
def('lamp_off', (i) => {
  const v = voronoi(i, 7);
  i.each((x, y) => { const c = v(x, y); i.set(x, y, c.edge < 0.9 ? hex('#3a3f4a') : mix(hex('#2a4a5a'), hex('#3a5a6a'), c.rnd)); });
});
def('lamp_on', (i) => {
  const v = voronoi(i, 7);
  i.each((x, y) => { const c = v(x, y); i.set(x, y, c.edge < 0.9 ? hex('#4a8a9a') : mix(hex('#bff8ff'), hex('#eaffff'), c.rnd)); i.glow(x, y, c.edge < 0.9 ? 0.4 : 1); });
});
def('piston_side', (i) => {
  cobbleTex(i, pal('#4a5059', '#5b626c', '#69717c', '#77808a', '#868e98'), 12);
  planksTexStrip(i, 0, 4);
});
function planksTexStrip(i, y0, y1) {
  for (let y = y0; y < y1; y++) for (let x = 0; x < S; x++) i.set(x, y, P.oakPlank[1 + ((x * 3 + y) % 3)]);
  for (let x = 0; x < S; x++) i.set(x, y1 - 1, P.oakPlank[0]);
}
def('piston_top', (i) => {
  planksTex(i, P.oakPlank);
  i.each((x, y) => { if (x < 1 || y < 1 || x > 14 || y > 14) i.set(x, y, hex('#5b626c')); });
  i.rect(6, 6, 9, 9, hex('#9aa3ad'));
});
def('piston_top_sticky', (i) => { TEX.piston_top(i); const f = field(i, 4, 3); i.each((x, y) => { if (f(x, y) > 0.35 && x > 0 && y > 0 && x < 15 && y < 15) i.set(x, y, mix(hex('#5fd06a'), hex('#9ff0a0'), f(x, y))); }); });
def('piston_bottom', (i) => { cobbleTex(i, pal('#4a5059', '#5b626c', '#69717c', '#77808a'), 10); i.rect(5, 5, 10, 10, hex('#3a3f47')); });
def('piston_inner', (i) => { TEX.piston_bottom(i); i.rect(6, 6, 9, 9, hex('#9aa3ad')); });
def('observer_side', (i) => { TEX.deep_tiles(i); for (let x = 0; x < S; x++) i.set(x, 7, hex('#1a1820')); });
def('observer_top', (i) => { TEX.deep_tiles(i); for (let y = 0; y < S; y++) i.set(7, y, hex('#1a1820')); line(i, 7, 3, 4, 6, hex('#5fe6ff')); line(i, 8, 3, 11, 6, hex('#5fe6ff')); });
def('observer_face', (i) => {
  TEX.deep_tiles(i);
  for (const cx of [4, 11]) { blob(i, cx, 8, 2.4, [hex('#0a0a0e')]); i.set(cx, 8, hex('#7cefff')); i.set(cx - 1, 7, hex('#9ff6ff')); }
  for (let x = 2; x < 14; x++) i.set(x, 12, hex('#1a1820'));
});
def('observer_back', (i) => { TEX.deep_tiles(i); blob(i, 8, 8, 2, [hex('#1a4a55')]); });
def('observer_back_on', (i) => { TEX.deep_tiles(i); blob(i, 8, 8, 2, [hex('#9ff6ff'), hex('#2ac4dc')]); for (let y = 6; y <= 10; y++) for (let x = 6; x <= 10; x++) if (i.get(x, y)[2] > 200) i.glow(x, y, 1); });
def('daylight_top', (i) => {
  i.fill(hex('#2a3a4a'));
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) if ((x % 5 !== 0) && (y % 5 !== 0)) { i.set(x, y, mix(hex('#4a8aaa'), hex('#9fd8f0'), (x + y) / 30)); }
  for (let x = 0; x < S; x++) { i.set(x, 0, P.oakPlank[2]); i.set(x, 15, P.oakPlank[1]); i.set(0, x, P.oakPlank[2]); i.set(15, x, P.oakPlank[1]); }
});
def('daylight_side', (i) => { planksTex(i, P.oakPlank); for (let x = 0; x < S; x++) for (let y = 0; y < 10; y++) i.setA(x, y, 255); });
def('note_block', (i) => {
  planksTex(i, pal('#5a3a2a', '#6a4432', '#7a4e3a', '#8a5842'));
  blob(i, 8, 8, 4, [hex('#1a1210')]);
  for (const [x, y] of [[6, 6], [7, 5], [8, 4], [9, 4], [9, 5], [9, 6], [9, 7], [9, 8], [8, 9], [7, 9], [6, 8], [6, 7]]) i.set(x, y, hex('#7cefff'));
});
def('barrel_side', (i) => {
  planksTex(i, pal('#8f2f22', '#a3382a', '#b74232', '#c84e3a'), { rows: 1 });
  for (let x = 0; x < S; x += 4) for (let y = 0; y < S; y++) i.set(x, y, hex('#6a2018'));
  for (const y of [2, 13]) for (let x = 0; x < S; x++) i.set(x, y, hex('#3a3f47'));
  i.rect(4, 6, 11, 9, hex('#e8e0c8')); i.set(6, 7, hex('#3a1a12')); i.set(8, 7, hex('#3a1a12')); i.set(7, 8, hex('#3a1a12')); i.set(9, 8, hex('#3a1a12'));
});
def('barrel_top', (i) => { planksTex(i, pal('#8f2f22', '#a3382a', '#b74232')); blob(i, 8, 8, 2, [hex('#2a1a12')]); i.set(8, 5, hex('#e8e0c8')); i.set(8, 4, hex('#ffb347')); });
def('dispenser_front', (i) => { TEX.furnace_side(i); blob(i, 8, 8, 3.2, [hex('#0f1012'), hex('#1a1c20')]); for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; i.set(Math.round(7.5 + Math.cos(t) * 4), Math.round(7.5 + Math.sin(t) * 4), hex('#9aa3ad')); } });
def('fan_face', (i) => {
  metalBlock(i, pal('#3a3f47', '#4a5059', '#5b626c', '#69717c', '#868e98'), { rivets: true, plates: 0 });
  blob(i, 8, 8, 6, [hex('#1a1c20')]);
  for (let k = 0; k < 4; k++) { const t = k * Math.PI / 2 + 0.4; for (let r = 1; r < 6; r++) { i.set(Math.round(7.5 + Math.cos(t + r * 0.15) * r), Math.round(7.5 + Math.sin(t + r * 0.15) * r), hex('#b7bdc6')); i.set(Math.round(7.5 + Math.cos(t + 0.3 + r * 0.15) * r), Math.round(7.5 + Math.sin(t + 0.3 + r * 0.15) * r), hex('#8a8f99')); } }
  blob(i, 8, 8, 1.2, [hex('#e3e7ec')]);
});
def('fan_side', (i) => { metalBlock(i, pal('#3a3f47', '#4a5059', '#5b626c', '#69717c', '#868e98'), { rivets: false, plates: 0 }); for (let y = 3; y < 14; y += 2) for (let x = 3; x < 13; x++) i.set(x, y, hex('#2a2e34')); });
def('fan_back', (i) => { TEX.fan_side(i); i.rect(6, 6, 9, 9, hex('#2fa3ba')); });
def('launch_top', (i) => {
  metalBlock(i, pal('#2a3a4a', '#344656', '#3e5262', '#4a5e6e', '#6a8090'), { rivets: true, plates: 0 });
  for (let k = 0; k < 3; k++) { const y = 3 + k * 4; line(i, 4, y + 3, 8, y, hex('#ffd34a')); line(i, 8, y, 12, y + 3, hex('#ffd34a')); }
  i.each((x, y) => { if (i.get(x, y)[0] > 240) i.glow(x, y, 0.8); });
});
def('launch_side', (i) => { metalBlock(i, pal('#2a3a4a', '#344656', '#3e5262', '#4a5e6e'), { rivets: false, plates: 0 }); for (let x = 0; x < S; x += 2) i.set(x, 3, hex('#ffd34a')); });
def('drill_face', (i) => {
  TEX.fan_side(i);
  for (let r = 6; r > 0; r--) for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2 + r; i.set(Math.round(7.5 + Math.cos(t) * r), Math.round(7.5 + Math.sin(t) * r), r % 2 ? hex('#cdd2d9') : hex('#8a8f99')); }
  i.set(7, 7, hex('#ff8a3a')); i.set(8, 8, hex('#ff8a3a')); i.glow(7, 7, 1); i.glow(8, 8, 1);
});
def('drill_side', (i) => { TEX.fan_side(i); for (let x = 0; x < S; x++) i.set(x, 0, hex('#ffd34a')); for (let x = 0; x < S; x += 3) i.set(x, 1, hex('#1a1c20')); });
def('placer_face', (i) => { TEX.fan_side(i); i.rect(4, 4, 11, 11, hex('#1a1c20')); i.rect(6, 6, 9, 9, hex('#3fbf6a')); });
def('conveyor', (i) => {
  i.fill(hex('#2a2e34'));
  for (let y = 0; y < S; y++) for (let x = 1; x < 15; x++) {
    const ch = ((y + Math.abs(x - 7.5) * 0.8) % 4) < 1.5;
    i.set(x, y, ch ? hex('#4a5059') : hex('#33373e'));
  }
  for (let y = 0; y < S; y++) { i.set(0, y, hex('#ffd34a')); i.set(15, y, hex('#ffd34a')); }
});
def('conveyor_side', (i) => { metalBlock(i, pal('#3a3f47', '#4a5059', '#5b626c', '#69717c'), { rivets: false, plates: 0 }); for (let x = 1; x < S; x += 4) { i.set(x, 13, hex('#1a1c20')); i.set(x + 1, 13, hex('#9aa3ad')); } });
def('hopper', (i) => { metalBlock(i, pal('#2f3238', '#3a3e45', '#454a52', '#50565f', '#6a717b'), { rivets: false, plates: 0 }); });
def('hopper_inside', (i) => { TEX.hopper(i); i.rect(2, 2, 13, 13, hex('#1a1c20')); i.rect(6, 6, 9, 9, hex('#0f1012')); });
const railTex = (tie, metal, curve = false) => (i) => {
  sprite(i);
  if (!curve) {
    for (let y = 1; y < S; y += 3) for (let x = 2; x < 14; x++) i.set(x, y, tie[(x + y) % tie.length]);
    for (let y = 0; y < S; y++) { i.set(3, y, metal[0]); i.set(4, y, metal[1]); i.set(11, y, metal[0]); i.set(12, y, metal[1]); }
  } else {
    for (let k = 0; k < 6; k++) { const t = k / 5 * Math.PI / 2; const cx = 16, cy = 16; for (let r = 2; r < 13; r++) i.set(Math.round(cx - Math.cos(t) * r), Math.round(cy - Math.sin(t) * r), tie[r % tie.length]); }
    for (const R of [4, 12]) for (let a = 0; a < 40; a++) { const t = a / 39 * Math.PI / 2; i.set(Math.round(16 - Math.cos(t) * R), Math.round(16 - Math.sin(t) * R), metal[a % 2]); i.set(Math.round(16 - Math.cos(t) * (R + 0.8)), Math.round(16 - Math.sin(t) * (R + 0.8)), metal[1]); }
  }
};
const TIE = pal('#6e4f34', '#7b5838', '#5e4128');
def('rail', railTex(TIE, pal('#9aa3ad', '#cdd2d9')));
def('rail_curve', railTex(TIE, pal('#9aa3ad', '#cdd2d9'), true));
def('power_rail', (i) => { railTex(TIE, pal('#b88a1e', '#e9c03e'))(i); for (let y = 2; y < S; y += 4) { i.set(7, y, hex('#1a4a55')); i.set(8, y, hex('#1a4a55')); } });
def('power_rail_on', (i) => { railTex(TIE, pal('#b88a1e', '#e9c03e'))(i); for (let y = 2; y < S; y += 4) { i.set(7, y, hex('#7cefff')); i.set(8, y, hex('#7cefff')); } });
def('speed_rail', (i) => { railTex(pal('#2a3a4a', '#344656'), pal('#5fe6ff', '#c6fbff'))(i); });
def('bounce_gel', (i) => {
  const f = field(i, 4, 1);
  i.each((x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    i.set(x, y, edge ? hex('#2f9a5a') : mix(hex('#5fd08a'), hex('#a8f0c0'), f(x, y)), edge ? 230 : 170);
  });
  blob(i, 5, 5, 1.6, [hex('#e8fff0')], 220);
});

// ancient
def('ancient_bricks', (i) => bricksTex(i, P.ancient, hex('#24343a'), { bw: 8, bh: 4, offset: 4 }));
def('ancient_carved', (i) => {
  TEX.ancient_bricks(i);
  i.rect(2, 2, 13, 13, P.ancient[1]);
  // the loom-knot motif
  const glyph = ['..####..', '.#....#.', '#..##..#', '#.#..#.#', '#.#..#.#', '#..##..#', '.#....#.', '..####..'];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (glyph[y][x] === '#') { i.set(4 + x, 4 + y, P.teal[3]); i.glow(4 + x, 4 + y, 0.55); }
});
def('ancient_gold', (i) => { TEX.ancient_bricks(i); i.each((x, y) => { if (y % 4 === 3) i.set(x, y, P.gold[(x % 3) + 1]); }); });
def('ancient_lamp', (i) => {
  TEX.ancient_bricks(i);
  i.rect(3, 3, 12, 12, hex('#24343a'));
  i.rect(4, 4, 11, 11, P.teal[4]);
  i.rect(6, 6, 9, 9, hex('#e8fff8'));
});
def('ancient_pillar', (i) => {
  i.each((x, y) => i.set(x, y, P.ancient[Math.min(4, 1 + Math.floor(Math.abs(Math.sin((x + 0.5) / 16 * Math.PI)) * 3 + i.rng.next() * 0.6))]));
  for (let x = 0; x < S; x++) { i.set(x, 0, P.ancient[4]); i.set(x, 1, P.ancient[0]); i.set(x, 14, P.ancient[0]); i.set(x, 15, P.ancient[4]); }
  for (const x of [3, 7, 11]) for (let y = 3; y < 13; y++) i.blend(x, y, P.ancient[0], 0.6);
});
def('ancient_pillar_top', (i) => { TEX.ancient_bricks(i); blob(i, 8, 8, 5, [P.ancient[4], P.ancient[2]]); blob(i, 8, 8, 2, [P.teal[3]]); });
def('seal_door', (i) => {
  i.fill(P.ancient[1]);
  for (let y = 0; y < S; y++) { i.set(7, y, hex('#1a2a2e')); i.set(8, y, hex('#1a2a2e')); }
  for (let a = 0; a < 48; a++) { const t = a / 48 * Math.PI * 2; const x = Math.round(7.5 + Math.cos(t) * 5.5), y = Math.round(7.5 + Math.sin(t) * 5.5); i.set(x, y, P.teal[3]); i.glow(x, y, 0.7); }
  for (const [x, y] of [[7, 3], [8, 3], [7, 12], [8, 12], [3, 7], [12, 8]]) { i.set(x, y, P.teal[4]); i.glow(x, y, 1); }
  i.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) i.set(x, y, P.ancient[4]); });
});
def('pedestal_side', (i) => { TEX.ancient_bricks(i); for (let x = 0; x < S; x++) { i.set(x, 1, P.gold[2]); i.set(x, 14, P.gold[1]); } });
def('pedestal_top', (i) => { TEX.ancient_bricks(i); blob(i, 8, 8, 4, [hex('#1a2a2e')]); blob(i, 8, 8, 2, [P.ancient[3]]); });
def('pedestal_top_on', (i) => { TEX.pedestal_top(i); blob(i, 8, 8, 3, [P.echo[5], P.echo[3]]); for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) if (i.get(x, y)[2] > 200) i.glow(x, y, 1); });
def('waystone', (i) => {
  TEX.ancient_bricks(i);
  for (let y = 2; y < 14; y += 3) for (let x = 5; x < 11; x++) if ((x + y) % 3) i.set(x, y, P.ancient[0]);
});
def('waystone_on', (i) => {
  TEX.ancient_bricks(i);
  for (let y = 2; y < 14; y += 3) for (let x = 5; x < 11; x++) if ((x + y) % 3) { i.set(x, y, P.crystal[3]); i.glow(x, y, 1); }
});
def('waystone_top', (i) => { TEX.ancient_bricks(i); blob(i, 8, 8, 3, [P.crystal[2], P.crystal[1]]); });
def('altar_top', (i) => {
  TEX.ancient_bricks(i);
  for (let a = 0; a < 5; a++) { const t = a / 5 * Math.PI * 2 - Math.PI / 2; const x = Math.round(7.5 + Math.cos(t) * 5), y = Math.round(7.5 + Math.sin(t) * 5); blob(i, x, y, 1.2, [P.echo[4]]); i.glow(x, y, 1); }
  blob(i, 8, 8, 2, [P.gold[3], P.gold[1]]);
});
def('altar_side', (i) => {
  TEX.ancient_gold(i);
  for (let x = 1; x < 15; x++) { i.set(x, 7, P.echo[3]); i.glow(x, 7, 0.7); }
});
def('gloom_nest', (i) => {
  i.each((x, y) => {
    const bar = x % 4 === 0 || y % 4 === 0;
    if (bar) i.set(x, y, mix(hex('#1a1424'), hex('#2a2238'), i.rng.next()));
    else i.set(x, y, hex('#0a0810'), 0);
  });
  for (const [x, y] of [[5, 6], [7, 6], [10, 10], [12, 10]]) { i.set(x, y, hex('#c86aff')); i.glow(x, y, 1); }
});
def('urn_side', (i) => {
  i.each((x, y) => i.set(x, y, mix(hex('#b0603c'), hex('#c87a4a'), Math.sin(x / 16 * Math.PI) * 0.6 + i.rng.next() * 0.2)));
  for (let x = 0; x < S; x++) { i.set(x, 3, hex('#2a1a12')); i.set(x, 9, hex('#e8d8a8')); if (x % 3 === 0) i.set(x, 6, hex('#2a1a12')); }
});
def('urn_top', (i) => { i.fill(hex('#a3583a')); blob(i, 8, 8, 3, [hex('#2a1a12')]); });

// ---------------------------------------------------------------- build
function buildLayer(name) {
  const fn = TEX[name];
  if (!fn) throw new Error(`texture "${name}" has no generator`);
  const img = new Img(name);
  img.fill([255, 0, 255]);
  fn(img);
  // Non-glow textures: clamp any accidental "glow" alpha to opaque so it is not misread
  if (!GLOW_TEX.has(name)) {
    for (let k = 3; k < img.d.length; k += 4) if (img.d[k] >= 128 && img.d[k] < 255 && !TRANSLUCENT_TEX.has(name)) img.d[k] = 255;
  }
  return img;
}
const TRANSLUCENT_TEX = new Set(['ice', 'water_still', 'water_flow', 'cloud', 'bounce_gel', 'pale_crystal', 'cobweb', ...COLORS.map((c) => `glass_${c[0]}`)]);

let built = null;
export function buildBlockTextures() {
  if (built) return built;
  const n = TEXTURE_NAMES.length;
  const data = new Uint8Array(n * S * S * 4);
  const images = [];
  for (let k = 0; k < n; k++) {
    const img = buildLayer(TEXTURE_NAMES[k]);
    data.set(img.d, k * S * S * 4);
    images.push(img);
  }
  built = { size: S, layers: n, data, images, names: TEXTURE_NAMES };
  return built;
}

// Mip chain with alpha-coverage preservation for cut-out foliage.
export function buildMips(data, layers, size) {
  const levels = [data];
  let s = size, cur = data;
  while (s > 1) {
    const h = s >> 1;
    const out = new Uint8Array(layers * h * h * 4);
    for (let l = 0; l < layers; l++) {
      const src = l * s * s * 4, dst = l * h * h * 4;
      for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) {
        let r = 0, g = 0, b = 0, aw = 0, amax = 0, cnt = 0, asum = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const i = src + (((y * 2 + dy) * s) + x * 2 + dx) * 4;
          const a = cur[i + 3];
          const w = a > 0 ? 1 : 0.001;
          r += cur[i] * w; g += cur[i + 1] * w; b += cur[i + 2] * w; aw += w;
          amax = Math.max(amax, a); asum += a;
          if (a >= 77) cnt++;
        }
        const o = dst + (y * h + x) * 4;
        out[o] = r / aw; out[o + 1] = g / aw; out[o + 2] = b / aw;
        // keep translucency averages, but cut-outs stay binary-ish so distant leaves don't dissolve
        out[o + 3] = asum / 4 > 100 && asum / 4 < 250 && amax < 255 ? asum / 4 : (cnt >= 2 ? amax : (cnt === 1 ? Math.min(amax, asum / 4 * 1.6) : 0));
      }
    }
    levels.push(out);
    cur = out; s = h;
  }
  return levels;
}

export { TEX as TEXTURE_PAINTERS };

// Extra (non-block) texture layers, e.g. creature skins. Must be registered before the renderer
// builds the texture array. Returns the layer index.
export function registerTexture(name, painter, { glow = false } = {}) {
  if (built) throw new Error(`registerTexture(${name}) after textures were built`);
  TEX[name] = painter;
  if (glow) GLOW_TEX.add(name);
  return texLayer(name);
}
export { field, noisy, speckle, voronoi, blob, line, P as PALETTE };
