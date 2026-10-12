// Item icons. Block items are drawn isometrically from their real model and textures (2D canvas
// with affine-mapped faces); other items are pixel sprites painted by small programs. The same
// 16×16 sprite pixels are extruded into 3D for held and dropped items.

import { BLOCKS, B, TEXTURE_NAMES, texLayer } from '../world/blocks.js';
import { ITEMS, I, TIERS } from '../world/items.js';
import { modelQuads } from '../world/models.js';
import { buildBlockTextures, Img, hex, mix, mul } from './textures.js';
import { BIOMES } from '../world/biomes.js';

const SPRITE = 16;
const ICON = 64;
const cache = new Map();
let texCanvases = null;

function layerCanvas(layer, tint) {
  if (!texCanvases) texCanvases = new Map();
  const key = layer + ':' + (tint || '');
  if (texCanvases.has(key)) return texCanvases.get(key);
  const t = buildBlockTextures();
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(16, 16);
  const src = t.data.subarray(layer * 1024, layer * 1024 + 1024);
  for (let i = 0; i < 1024; i += 4) {
    let r = src[i], g = src[i + 1], b = src[i + 2], a = src[i + 3];
    if (tint) {
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (sat < 7) { r = r * tint[0] / 255; g = g * tint[1] / 255; b = b * tint[2] / 255; }
    }
    if (a >= 128 && a < 251) a = 255;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  texCanvases.set(key, c);
  return c;
}

const DEFAULT_TINTS = { 1: BIOMES[2].grassRGB, 2: BIOMES[2].foliageRGB, 3: BIOMES[0].waterRGB };

// ---------------------------------------------------------------- isometric block icons
function isoBlock(v, size = ICON) {
  const id = v & 1023;
  const d = BLOCKS[id];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let quads;
  try { quads = modelQuads(v, d.shape === 'fence' ? (d.wall ? 5 : 5) : d.shape === 'wire' ? 15 : 0); } catch { quads = []; }
  const tint = DEFAULT_TINTS[d.tint] || null;
  // view: yaw 45°, pitch 30°
  const ya = Math.PI / 4, pa = Math.atan(1 / Math.sqrt(2)) * 0.95;
  const cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
  const s = size / 16 / 1.62;
  const proj = (x, y, z) => {
    x -= 8; y -= 8; z -= 8;
    const rx = x * cy - z * sy;
    const rz = x * sy + z * cy;
    const ry = y * cp - rz * sp;
    const depth = y * sp + rz * cp;
    return [size / 2 + rx * s, size / 2 - ry * s + size * 0.02, depth];
  };
  const viewDir = [-sy * cp, sp, cy * cp]; // toward viewer, approx
  const items = [];
  for (const q of quads) {
    if (q.translucent) continue;
    const p = q.pos;
    const pts = [proj(p[0], p[1], p[2]), proj(p[3], p[4], p[5]), proj(p[6], p[7], p[8]), proj(p[9], p[10], p[11])];
    // screen-space winding decides visibility (front faces are counter-clockwise in math coords)
    const area = (pts[1][0] - pts[0][0]) * (pts[3][1] - pts[0][1]) - (pts[3][0] - pts[0][0]) * (pts[1][1] - pts[0][1]);
    const double = q.face === 6 || d.shape === 'cross' || d.shape === 'crop';
    if (area >= 0 && !double) continue;
    const depth = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
    items.push({ q, pts, depth });
  }
  items.sort((a, b) => a.depth - b.depth);
  void viewDir;
  for (const { q, pts } of items) {
    const tc = layerCanvas(q.tex, d.tint ? tint : (q.flags & 32 ? [120, 240, 255] : null));
    const uv = q.uv;
    // affine map from (u,v) texels to screen using corners 0,1,3
    const u0 = uv[0], v0 = uv[1], u1 = uv[2], v1 = uv[3], u3 = uv[6], v3 = uv[7];
    const du1 = u1 - u0, dv1 = v1 - v0, du3 = u3 - u0, dv3 = v3 - v0;
    const det = du1 * dv3 - du3 * dv1;
    if (Math.abs(det) < 1e-6) continue;
    const X1 = pts[1][0] - pts[0][0], Y1 = pts[1][1] - pts[0][1], X3 = pts[3][0] - pts[0][0], Y3 = pts[3][1] - pts[0][1];
    const a = (X1 * dv3 - X3 * dv1) / det, cc = (X3 * du1 - X1 * du3) / det;
    const b = (Y1 * dv3 - Y3 * dv1) / det, dd = (Y3 * du1 - Y1 * du3) / det;
    const e = pts[0][0] - a * u0 - cc * v0, f = pts[0][1] - b * u0 - dd * v0;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < 4; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a, b, cc, dd, e, f);
    ctx.drawImage(tc, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const shade = q.face === 2 ? 0 : q.face === 3 ? 0.5 : q.face === 0 || q.face === 1 ? 0.18 : q.face === 6 ? 0.05 : 0.34;
    if (shade > 0 && !(q.flags & 2)) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(10,12,24,${shade})`;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
  return c;
}

// Some blocks read better as flat sprites (plants, torches, rails, doors…)
const FLAT_SHAPES = new Set(['cross', 'crop', 'torch', 'wallflat', 'rail', 'vine', 'flat', 'wire', 'lever', 'fire']);
function flatBlock(d) {
  const c = document.createElement('canvas');
  c.width = c.height = ICON;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (d.shape === 'door') {
    const top = layerCanvas(texLayer(d.extraTex[0])), bot = layerCanvas(d.faces[0]);
    ctx.drawImage(top, 0, 0, 16, 16, ICON * 0.25, 0, ICON * 0.5, ICON * 0.5);
    ctx.drawImage(bot, 0, 0, 16, 16, ICON * 0.25, ICON * 0.5, ICON * 0.5, ICON * 0.5);
    return c;
  }
  const tint = DEFAULT_TINTS[d.tint] || null;
  const layer = d.name === 'inverter' ? texLayer('inverter_on') : d.faces[d.shape === 'rail' || d.shape === 'flat' ? 2 : 0];
  ctx.drawImage(layerCanvas(layer, tint), 0, 0, 16, 16, 0, 0, ICON, ICON);
  return c;
}

// ---------------------------------------------------------------- sprite painting
function outline(img, col = [24, 22, 30]) {
  const a = (x, y) => (x >= 0 && y >= 0 && x < 16 && y < 16 ? img.alpha(x, y) : 0);
  const add = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (a(x, y)) continue;
    if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) add.push([x, y]);
  }
  for (const [x, y] of add) img.set(x, y, col, 255);
}
function px(img, x, y, c) { if (x >= 0 && y >= 0 && x < 16 && y < 16) img.set(x, y, c, 255); }
function lineP(img, x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) px(img, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), typeof c === 'function' ? c(i / n) : c);
}
function disc(img, cx, cy, r, c, shadeHi = true) {
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
    if (x * x + y * y > r * r + 0.3) continue;
    let col = c;
    if (shadeHi) { const t = (x + y) / (2 * r + 0.01); col = t < -0.35 ? mix(c, [255, 255, 255], 0.35) : t > 0.35 ? mul(c, 0.72) : c; }
    px(img, cx + x, cy + y, col);
  }
}
const WOOD = [hex('#6e4f34'), hex('#8a6440'), hex('#a1703f')];

function handle(img, x0, y0, x1, y1) {
  lineP(img, x0, y0, x1, y1, (t) => (t < 0.5 ? WOOD[1] : WOOD[2]));
  lineP(img, x0 + 1, y0, x1 + 1, y1, WOOD[0]);
}

function toolSprite(img, type, color) {
  const c = hex(color), lt = mix(c, [255, 255, 255], 0.4), dk = mul(c, 0.66);
  if (type === 'sword') {
    lineP(img, 3, 12, 13, 2, lt); lineP(img, 4, 12, 13, 3, c); lineP(img, 4, 13, 14, 3, dk);
    lineP(img, 2, 10, 6, 14, hex('#5a4a3a')); lineP(img, 2, 11, 5, 14, hex('#8a7050'));
    px(img, 1, 14, WOOD[0]); px(img, 2, 13, WOOD[1]); px(img, 1, 15, hex('#c8a24a'));
  } else {
    handle(img, 3, 13, 10, 6);
    if (type === 'pickaxe') {
      const pts = [[3, 4], [4, 3], [5, 2], [6, 2], [7, 2], [8, 2], [9, 3], [10, 4], [11, 5], [12, 6], [13, 8], [14, 9]];
      pts.forEach(([x, y], i) => { px(img, x, y, i < 6 ? lt : c); px(img, x, y + 1, dk); });
      px(img, 2, 5, dk); px(img, 14, 10, dk);
    } else if (type === 'axe') {
      for (let y = 2; y <= 8; y++) for (let x = 8; x <= 13; x++) {
        const dx = x - 8, dy = y - 5;
        if (dx * dx * 0.5 + dy * dy < 9 + dx) px(img, x, y, dx < 2 ? dk : y < 4 ? lt : c);
      }
      lineP(img, 13, 3, 13, 8, lt);
    } else if (type === 'shovel') {
      for (let y = 1; y <= 7; y++) for (let x = 9; x <= 15; x++) {
        const dx = x - 12, dy = y - 4;
        if (Math.abs(dx + dy) <= 2 && Math.abs(dx - dy) <= 4) px(img, x, y, dx - dy < -1 ? lt : dx - dy > 2 ? dk : c);
      }
    } else if (type === 'hoe') {
      lineP(img, 8, 3, 13, 3, lt); lineP(img, 8, 4, 12, 4, c); lineP(img, 12, 5, 13, 6, dk); px(img, 13, 4, c); px(img, 14, 5, dk);
    }
  }
}

function ingot(img, c) {
  const C = hex(c), L = mix(C, [255, 255, 255], 0.45), D = mul(C, 0.65);
  for (let y = 6; y <= 11; y++) for (let x = 2 + (11 - y) * 0 + (y < 8 ? 2 : 0); x <= 13 - (y < 8 ? 2 : 0); x++) px(img, x, y, y === 6 ? L : y >= 10 ? D : C);
  lineP(img, 4, 7, 9, 7, L);
}
function gem(img, c, big = false) {
  const C = hex(c), L = mix(C, [255, 255, 255], 0.55), D = mul(C, 0.62);
  const r = big ? 6 : 5;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (Math.abs(x) + Math.abs(y) * 1.1 > r) continue;
    px(img, 8 + x, 8 + y, y < -1 ? L : x > 1 ? D : C);
  }
  px(img, 6, 5, [255, 255, 255]); px(img, 7, 5, [255, 255, 255]);
}
function lump(img, c, seed = 1) {
  const C = hex(c);
  disc(img, 7, 9, 4.5, C); disc(img, 10, 7, 3, mix(C, [255, 255, 255], 0.1));
  px(img, 6 + (seed % 3), 7, mix(C, [255, 255, 255], 0.5));
}
function dust(img, c) {
  const C = hex(c);
  for (let y = 0; y < 5; y++) for (let x = -y - 1; x <= y + 1; x++) px(img, 8 + x, 9 + y, y === 0 ? mix(C, [255, 255, 255], 0.5) : (x + y) % 3 === 0 ? mul(C, 0.7) : C);
  px(img, 4, 7, C); px(img, 12, 8, C); px(img, 10, 5, mix(C, [255, 255, 255], 0.6));
}
function stickSprite(img) { lineP(img, 4, 13, 12, 3, WOOD[2]); lineP(img, 5, 13, 13, 3, WOOD[0]); }
function meat(img, cooked, kind) {
  const C = cooked ? hex('#9a5a2a') : hex('#d8606a'), L = cooked ? hex('#c8803a') : hex('#f09aa0');
  if (kind === 'fish') {
    const B2 = cooked ? hex('#b07a40') : hex('#9fc8e0');
    for (let x = 2; x <= 11; x++) { const h = Math.round(Math.sin((x - 2) / 9 * Math.PI) * 3); for (let y = 8 - h; y <= 8 + h; y++) px(img, x, y, y < 8 - h + 1 ? mix(B2, [255, 255, 255], 0.4) : B2); }
    lineP(img, 12, 6, 14, 4, B2); lineP(img, 12, 10, 14, 12, B2); px(img, 12, 8, B2); px(img, 4, 7, [20, 20, 30]);
    return;
  }
  disc(img, 9, 7, 4.5, C); disc(img, 8, 6, 2, L, false);
  lineP(img, 3, 13, 6, 10, hex('#efe6d6')); px(img, 2, 14, hex('#efe6d6')); px(img, 3, 14, hex('#efe6d6'));
}
function bread(img, c = '#c8903a') { const C = hex(c); for (let y = 6; y <= 11; y++) for (let x = 2; x <= 13; x++) if ((x - 7.5) ** 2 / 36 + (y - 8.5) ** 2 / 9 < 1) px(img, x, y, y < 8 ? mix(C, [255, 230, 180], 0.35) : C); for (const x of [5, 8, 11]) px(img, x, 7, mul(C, 0.7)); }
function berries(img, c) { const C = hex(c); for (const [x, y] of [[6, 8], [10, 7], [8, 11], [11, 11], [5, 12]]) disc(img, x, y, 1.8, C); lineP(img, 8, 3, 8, 6, hex('#4e8a3a')); px(img, 9, 3, hex('#6aa848')); }
function seeds(img, c) { const C = hex(c); for (const [x, y] of [[5, 7], [9, 6], [7, 10], [11, 10], [4, 12], [12, 13], [8, 13]]) { px(img, x, y, C); px(img, x + 1, y, mul(C, 0.7)); } }
function bucket(img, fill) {
  const M = hex('#9aa3ad'), D = hex('#5d6470');
  for (let y = 5; y <= 13; y++) { const w = 4 - Math.floor((y - 5) / 4); for (let x = 8 - w - 1; x <= 8 + w; x++) px(img, x, y, x === 8 - w - 1 ? D : x === 8 + w ? D : M); }
  lineP(img, 4, 5, 11, 5, D);
  if (fill) for (let x = 4; x <= 11; x++) px(img, x, 5, hex(fill)), px(img, x, 6, mul(hex(fill), 0.85));
  lineP(img, 4, 4, 6, 1, D); lineP(img, 6, 1, 9, 1, D); lineP(img, 9, 1, 11, 4, D);
}
function bowSprite(img) {
  for (let k = 0; k < 12; k++) { const t = k / 11; const x = Math.round(3 + Math.sin(t * Math.PI) * 6 + t * 7); const y = Math.round(2 + t * 11); px(img, x, y, WOOD[k % 2 + 1]); }
  lineP(img, 3, 2, 10, 13, hex('#e8e0c8'));
}
function arrowSprite(img, glow) {
  lineP(img, 3, 12, 12, 3, WOOD[1]);
  px(img, 12, 3, hex('#cdd2d9')); px(img, 13, 2, hex('#cdd2d9')); px(img, 11, 3, hex('#9aa3ad')); px(img, 12, 4, hex('#9aa3ad'));
  const F = glow ? hex('#7ef0d8') : hex('#e9ecef');
  px(img, 2, 12, F); px(img, 3, 13, F); px(img, 2, 13, F); px(img, 4, 13, F); px(img, 2, 11, F);
}
function wingSprite(img, c1, c2) {
  const A = hex(c1), Bc = hex(c2);
  for (let x = 1; x <= 14; x++) { const h = Math.round(5 - Math.abs(x - 7.5) * 0.55); for (let y = 6 - h; y <= 7; y++) px(img, x, y, y === 6 - h ? mix(A, [255, 255, 255], 0.4) : (x % 3 === 0 ? Bc : A)); }
  lineP(img, 2, 8, 13, 8, hex('#6e4f34')); lineP(img, 7, 8, 7, 13, hex('#6e4f34')); lineP(img, 8, 8, 8, 13, hex('#8a6440'));
}
function hookSprite(img) {
  lineP(img, 3, 13, 9, 7, hex('#c8b090'));
  const M = hex('#cdd2d9'), D = hex('#6e7682');
  lineP(img, 9, 7, 12, 4, M); lineP(img, 12, 4, 12, 2, M); lineP(img, 9, 7, 9, 4, D); lineP(img, 9, 7, 12, 7, D); px(img, 13, 2, M); px(img, 8, 3, D); px(img, 13, 8, D);
}
function compassSprite(img) {
  disc(img, 8, 8, 6, hex('#b88a1e')); disc(img, 8, 8, 4.5, hex('#1a2a3a'), false);
  lineP(img, 8, 8, 10, 4, hex('#7cefff')); lineP(img, 8, 8, 6, 12, hex('#e9ecef'));
  px(img, 8, 8, [255, 255, 255]);
}
function spyglassSprite(img) { lineP(img, 3, 12, 11, 4, hex('#b88a1e')); lineP(img, 4, 12, 12, 4, hex('#8a6a1a')); lineP(img, 4, 13, 12, 5, hex('#6a4a12')); disc(img, 12, 3, 1.6, hex('#9fd8f0'), false); }
function cartSprite(img) { for (let y = 6; y <= 11; y++) for (let x = 2; x <= 13; x++) px(img, x, y, y === 6 ? hex('#cdd2d9') : x === 2 || x === 13 ? hex('#5d6470') : hex('#8a8f99')); disc(img, 5, 12, 1.6, hex('#2a2e34'), false); disc(img, 11, 12, 1.6, hex('#2a2e34'), false); }
function shardSprite(img, c1, c2) {
  const A = hex(c1), Bc = hex(c2);
  for (let y = 1; y <= 14; y++) { const w = Math.round((y < 6 ? (y - 1) * 0.8 : (14 - y) * 0.45)); for (let x = 8 - w; x <= 8 + w; x++) px(img, x, y, x < 8 ? mix(A, [255, 255, 255], 0.35) : x > 8 ? Bc : A); }
  px(img, 7, 4, [255, 255, 255]); px(img, 6, 6, [255, 255, 255]);
}
function armorSprite(img, slot, c) {
  const C = hex(c), L = mix(C, [255, 255, 255], 0.4), D = mul(C, 0.65);
  const shapes = [
    ['....######....', '...#LLLLLL#...', '..#LCCCCCCD#..', '..#CCCCCCCD#..', '..#CC....CD#..', '..#C......D#..'],
    ['.##........##.', '#LL#......#LD#', '#LCC######CCD#', '.#CCCCCCCCCD#.', '..#CCCCCCCD#..', '..#CCCCCCCD#..', '..#CCCCCCCD#..', '..#CCCCCCCD#..', '..##########..'],
    ['..##########..', '..#LCCCCCCD#..', '..#CCC##CCD#..', '..#CC#..#CD#..', '..#CC#..#CD#..', '..#CC#..#CD#..', '..#CC#..#CD#..', '..###....###..'],
    ['..###....###..', '..#L#....#L#..', '..#C#....#C#..', '.#CC#...#CCD#.', '#CCCD#..#CCCD#', '######..######'],
  ];
  const sh = shapes[slot];
  const oy = Math.floor((16 - sh.length) / 2);
  sh.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    px(img, x + 1, y + oy, ch === '#' ? D : ch === 'L' ? L : ch === 'D' ? D : C);
  }));
}
function bowl(img, fill) { for (let y = 8; y <= 12; y++) { const w = 6 - (y - 8); for (let x = 8 - w; x < 8 + w; x++) px(img, x, y, y === 8 ? (fill ? hex(fill) : hex('#5a3d2a')) : WOOD[(x + y) % 2 + 1]); } }
function orbSprite(img, c) { disc(img, 8, 8, 5, hex(c)); px(img, 6, 6, [255, 255, 255]); }

const SPRITES = {
  stick: stickSprite,
  coal: (i) => lump(i, '#2a2a30'), charcoal: (i) => lump(i, '#3a2a22', 2),
  raw_copper: (i) => lump(i, '#c8744a'), raw_iron: (i) => lump(i, '#c29e86'), raw_gold: (i) => lump(i, '#e9c03e'), raw_meteor: (i) => { lump(i, '#5a3f40'); px(i, 8, 9, hex('#ff8a4a')); px(i, 10, 8, hex('#ff8a4a')); },
  copper_ingot: (i) => ingot(i, '#db8a5c'), iron_ingot: (i) => ingot(i, '#cdd2d9'), gold_ingot: (i) => ingot(i, '#f2cf4a'), meteor_ingot: (i) => ingot(i, '#e8673a'),
  crystal_dust: (i) => dust(i, '#42d6ea'), stargem: (i) => gem(i, '#a8c8ff'), echo_crystal: (i) => gem(i, '#9e70dc'), star_shard: (i) => { gem(i, '#e1efff'); px(i, 12, 3, [255, 255, 255]); px(i, 3, 12, [255, 255, 255]); },
  flint: (i) => lump(i, '#4a4a52', 3), leather: (i) => { for (let y = 3; y <= 13; y++) for (let x = 3; x <= 12; x++) if (!((x === 3 || x === 12) && (y === 3 || y === 13))) px(i, x, y, (x + y) % 4 ? hex('#8a5a30') : hex('#a06a3a')); },
  fluff: (i) => { disc(i, 6, 9, 3.5, hex('#eef4ff')); disc(i, 10, 8, 3.5, hex('#ffffff')); disc(i, 8, 11, 3, hex('#dce6f5')); },
  string: (i) => { for (let k = 0; k < 14; k++) px(i, 2 + k, 8 + Math.round(Math.sin(k * 0.9) * 3), hex('#e8e8f0')); },
  feather: (i) => { lineP(i, 4, 13, 12, 3, hex('#d8d8e0')); for (let k = 0; k < 7; k++) { px(i, 6 + k, 9 - k, hex('#ffffff')); px(i, 7 + k, 11 - k, hex('#c8c8d8')); } },
  bone: (i) => { lineP(i, 4, 12, 11, 5, hex('#efe6d6')); for (const [x, y] of [[3, 12], [4, 13], [11, 4], [12, 5]]) disc(i, x, y, 1.2, hex('#e0d6c4'), false); },
  bone_meal: (i) => dust(i, '#efe6d6'), glow_spore: (i) => { for (const [x, y] of [[5, 6], [9, 5], [7, 9], [11, 10], [5, 12], [10, 13]]) disc(i, x, y, 1.3, hex('#7ef0d8'), false); },
  gel: (i) => { disc(i, 8, 9, 5, hex('#5fd08a')); disc(i, 6, 7, 1.5, hex('#c8ffd8'), false); },
  clay_ball: (i) => disc(i, 8, 8, 4.5, hex('#a3acbc')), brick: (i) => ingot(i, '#b0543e'), snowball: (i) => disc(i, 8, 8, 4.5, hex('#f6f9fc')),
  book: (i) => { for (let y = 3; y <= 13; y++) for (let x = 3; x <= 12; x++) px(i, x, y, x === 3 ? hex('#5a2020') : y === 13 ? hex('#efe6d6') : hex('#8f2f2f')); lineP(i, 6, 6, 10, 6, hex('#d8c060')); },
  paper: (i) => { for (let y = 3; y <= 13; y++) for (let x = 4; x <= 12; x++) px(i, x, y, hex('#f4f0e6')); for (let y = 5; y <= 11; y += 2) lineP(i, 5, y, 11, y, hex('#c8c0b0')); },
  blast_powder: (i) => dust(i, '#5a4a52'), wheat_seeds: (i) => seeds(i, '#c8b060'), melon_seeds: (i) => seeds(i, '#3a2a1a'),
  loom_thread: (i) => { for (let k = 0; k < 14; k++) { px(i, 2 + k, 8 + Math.round(Math.sin(k * 0.7) * 3), hex('#c19df0')); px(i, 2 + k, 8 + Math.round(Math.cos(k * 0.7) * 3), hex('#7cefff')); } },
  gear: (i) => { disc(i, 8, 8, 5.5, hex('#db8a5c')); for (let a = 0; a < 8; a++) px(i, Math.round(8 + Math.cos(a * Math.PI / 4) * 7), Math.round(8 + Math.sin(a * Math.PI / 4) * 7), hex('#b0613a')); disc(i, 8, 8, 1.8, hex('#5a3020'), false); },
  lens: (i) => { disc(i, 8, 8, 5.5, hex('#c6fbff')); disc(i, 8, 8, 3.5, hex('#7cefff'), false); px(i, 6, 6, [255, 255, 255]); },
  berries: (i) => berries(i, '#5a8ad8'), crabapple: (i) => { disc(i, 8, 9, 4.8, hex('#d84a3a')); lineP(i, 8, 3, 9, 5, hex('#6e4f34')); px(i, 10, 4, hex('#5aa848')); },
  wheat: (i) => { for (const x of [5, 8, 11]) { lineP(i, x, 14, x + 1, 4, hex('#c8a24a')); px(i, x + 1, 4, hex('#f0d060')); px(i, x, 5, hex('#f0d060')); px(i, x + 2, 6, hex('#f0d060')); } },
  bread: (i) => bread(i), honey_bread: (i) => { bread(i, '#d8a040'); lineP(i, 4, 7, 11, 7, hex('#ffd34a')); },
  radish: (i) => { disc(i, 8, 10, 4, hex('#eef2ff')); lineP(i, 8, 2, 8, 6, hex('#5aa848')); lineP(i, 6, 3, 7, 6, hex('#7ac05a')); lineP(i, 10, 3, 9, 6, hex('#7ac05a')); px(i, 8, 14, hex('#c8d8f8')); },
  melon_slice: (i) => { for (let y = 5; y <= 13; y++) for (let x = 3; x <= 13; x++) { const d = Math.hypot(x - 8, y - 4); if (d < 9 && y > 5 + Math.abs(x - 8) * 0.2) px(i, x, y, d > 7.5 ? hex('#5a8a2a') : d > 6.5 ? hex('#f0e0a0') : hex('#f5a23a')); } },
  sunroot: (i) => { disc(i, 8, 9, 4.2, hex('#d8983a')); px(i, 6, 7, hex('#f0c860')); px(i, 10, 11, hex('#a8682a')); },
  baked_sunroot: (i) => { disc(i, 8, 9, 4.2, hex('#a8682a')); px(i, 6, 7, hex('#f0c860')); px(i, 7, 8, hex('#ffe0a0')); },
  raw_venison: (i) => meat(i, false), venison: (i) => meat(i, true), raw_boar: (i) => meat(i, false), boar: (i) => meat(i, true),
  raw_fowl: (i) => meat(i, false), fowl: (i) => meat(i, true), raw_fish: (i) => meat(i, false, 'fish'), fish: (i) => meat(i, true, 'fish'),
  egg: (i) => { disc(i, 8, 9, 4.3, hex('#f2e6c8')); px(i, 6, 6, hex('#ffffff')); px(i, 9, 11, hex('#c8b08a')); },
  fried_egg: (i) => { disc(i, 8, 8, 5.5, hex('#f8f4ec')); disc(i, 8, 8, 2.2, hex('#f5b82a'), false); },
  mushroom_stew: (i) => bowl(i, '#a85a3a'), bowl: (i) => bowl(i, null),
  star_candy: (i) => { gem(i, '#ffb3d9'); px(i, 3, 3, hex('#fff6b0')); px(i, 13, 12, hex('#fff6b0')); },
  bucket: (i) => bucket(i, null), water_bucket: (i) => bucket(i, '#3f86c8'), lava_bucket: (i) => bucket(i, '#f57a1c'),
  flint_steel: (i) => { lineP(i, 3, 12, 9, 6, hex('#9aa3ad')); lineP(i, 9, 6, 11, 8, hex('#9aa3ad')); lump(i, '#4a4a52'); },
  shears: (i) => { lineP(i, 3, 3, 10, 10, hex('#cdd2d9')); lineP(i, 3, 10, 10, 3, hex('#9aa3ad')); disc(i, 12, 12, 2, hex('#c84a3a'), false); disc(i, 12, 3, 1.5, hex('#c84a3a'), false); },
  fishing_rod: (i) => { lineP(i, 2, 14, 13, 2, WOOD[1]); lineP(i, 13, 2, 13, 11, hex('#e8e8f0')); px(i, 13, 12, hex('#c84a3a')); },
  bow: bowSprite, arrow: (i) => arrowSprite(i, false), glow_arrow: (i) => arrowSprite(i, true),
  glider: (i) => wingSprite(i, '#e8f0ff', '#9fc8e8'), star_wings: (i) => wingSprite(i, '#c19df0', '#7cefff'),
  grapple: hookSprite, echo_compass: compassSprite, spyglass: spyglassSprite, cart: cartSprite,
  waystone_key: (i) => { disc(i, 8, 8, 5, hex('#4d6e78')); for (let a = 0; a < 6; a++) px(i, Math.round(8 + Math.cos(a) * 3), Math.round(8 + Math.sin(a) * 3), hex('#7cefff')); },
  feather_charm: (i) => { disc(i, 8, 10, 4, hex('#c8a24a')); lineP(i, 8, 2, 8, 6, hex('#e8e0c8')); px(i, 8, 10, hex('#e8f0ff')); },
  lantern_staff: (i) => { lineP(i, 3, 14, 10, 5, WOOD[1]); disc(i, 11, 4, 2.5, hex('#7ef0d8')); },
  shard_sky: (i) => shardSprite(i, '#e8f4ff', '#8fc6ff'), shard_abyss: (i) => shardSprite(i, '#7cefff', '#1a6a8a'),
  shard_sand: (i) => shardSprite(i, '#ffe08a', '#c88a28'), shard_frost: (i) => shardSprite(i, '#e0fbff', '#7ab8e8'), shard_tide: (i) => shardSprite(i, '#8af0d8', '#2a7a9a'),
};
for (let t = 0; t < TIERS.length; t++) for (const type of ['pickaxe', 'axe', 'shovel', 'hoe', 'sword']) SPRITES[`${TIERS[t].key}_${type}`] = (i) => toolSprite(i, type, TIERS[t].color);
for (const id of Object.keys(I)) {
  const d = ITEMS[I[id]];
  if (d && d.armor) SPRITES[d.name] = (i) => armorSprite(i, d.armor.slot, d.armor.color);
}

const GLOWING_ITEMS = new Set(['star_shard', 'echo_crystal', 'glow_spore', 'shard_sky', 'shard_abyss', 'shard_sand', 'shard_frost', 'shard_tide', 'star_wings', 'lantern_staff', 'star_candy', 'loom_thread']);

const spriteCache = new Map();
// 16×16 RGBA pixels for an item (used for icons and 3D extrusion)
export function itemSprite(id) {
  if (spriteCache.has(id)) return spriteCache.get(id);
  const d = ITEMS[id];
  const img = new Img('item:' + (d ? d.name : id));
  img.clear();
  const fn = d && SPRITES[d.name];
  if (fn) { fn(img); outline(img); } else {
    // unknown: magenta question mark
    img.rect(4, 4, 11, 11, [255, 0, 255]);
  }
  spriteCache.set(id, img);
  return img;
}
export const itemGlows = (id) => ITEMS[id] && GLOWING_ITEMS.has(ITEMS[id].name);

function spriteCanvas(img, size = ICON) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const t = document.createElement('canvas');
  t.width = t.height = 16;
  const tctx = t.getContext('2d');
  const id = tctx.createImageData(16, 16);
  id.data.set(img.d);
  tctx.putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(t, 0, 0, size, size);
  return c;
}

// Icon as a data URL (cached). For blocks `v` may carry metadata.
export function iconURL(id) {
  if (cache.has(id)) return cache.get(id);
  let c;
  const d = ITEMS[id];
  if (!d) c = spriteCanvas(itemSprite(id));
  else if (d.block !== undefined) {
    const bd = BLOCKS[d.block];
    if (FLAT_SHAPES.has(bd.shape) || bd.shape === 'door') c = flatBlock(bd);
    else c = isoBlock(defaultState(d.block));
  } else c = spriteCanvas(itemSprite(id));
  const url = c.toDataURL();
  cache.set(id, url);
  return url;
}

// The state a block item shows in icons and in the hand.
export function defaultState(id) {
  const d = BLOCKS[id];
  if (d.shape === 'stairs') return id | (2 << 10);
  if (d.orient === 'facing4' || d.orient === 'door') return id | (2 << 10);
  if (d.orient === 'facing6') return id | (2 << 10);
  if (d.name === 'lantern' || d.name === 'crystal_lantern') return id;
  if (d.shape === 'crop') return id | (7 << 10);
  if (d.name === 'snow_layer') return id | (1 << 10);
  return id;
}

export { TEXTURE_NAMES, B };
