// Creature models: parts in pixel units (16 = one block, forward = -Z), procedurally painted
// skins registered as extra texture layers, and a small skeletal pose/animation system.
//
// Animals are rigged: parts belong to groups (body, neck, head, ears, eyes, tail segments, legs,
// wings) that form a hierarchy with their own pivots, so a grazing deer lowers its neck and the
// head follows, ears flick, eyes blink, tails sway segment by segment and the body rises and
// breathes with the gait. Meshes carry a baked height gradient (darker towards the belly and
// legs, like light occluded by the body and the ground) and fur is painted at twice the block
// texel density so creatures read finer than the terrain around them.

import { registerTexture, hex, mix, mul, field } from '../render/textures.js';
import { texLayer } from '../world/blocks.js';
import { MeshBuilder } from '../render/itemmesh.js';
import { mat4, identity, translate, rotateX, rotateY, rotateZ, scale, multiply } from '../core/math.js';

// ---------------------------------------------------------------- skins
function furPainter(base, { dark = 0.78, light = 1.18, pattern = 'fur', accent = null, glow = null } = {}) {
  const B = hex(base), D = mul(B, dark), L = mul(B, light);
  return (img) => {
    const f = field(img, 8, 3);
    img.each((x, y) => {
      const v = f(x, y) * 0.6 + img.rng.next() * 0.4;
      let c = v < 0.33 ? D : v > 0.72 ? L : B;
      if (pattern === 'fur' && (x + y * 3) % 7 === 0) c = mix(c, D, 0.5);
      if (pattern === 'scales' && ((x + (y % 2) * 2) % 4 === 0)) c = mix(c, L, 0.6);
      if (pattern === 'stripes' && y % 5 < 1) c = mix(c, D, 0.7);
      if (pattern === 'bone' && x % 5 === 0) c = mix(c, D, 0.4);
      if (pattern === 'stone' && (x % 8 === 0 || y % 6 === 0)) c = mix(c, D, 0.6);
      img.set(x, y, c);
    });
    if (pattern === 'spots' && accent) for (let k = 0; k < 7; k++) { const x = img.rng.int(16), y = img.rng.int(16); img.set(x, y, hex(accent)); img.set(x + 1, y, hex(accent)); }
    if (pattern === 'wool') {
      for (let k = 0; k < 14; k++) { const x = img.rng.int(16), y = img.rng.int(16); img.set(x, y, L); img.set(x + 1, y + 1, D); }
    }
    if (glow) for (let k = 0; k < 6; k++) { const x = img.rng.int(16), y = img.rng.int(16); img.set(x, y, hex(glow)); img.glow(x, y, 1); }
  };
}
function facePainter(base, { eyes = '#16141c', eyeGlow = false, nose = null, mouth = null, eyeY = 6, eyeGap = 3, light = 1.12, pattern = 'fur', hood = null, glowMarks = null } = {}) {
  const fur = furPainter(base, { light, pattern });
  return (img) => {
    fur(img);
    if (hood) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (y < 3 || x < 2 || x > 13) img.set(x, y, mix(hex(hood), [0, 0, 0], (x + y) % 5 === 0 ? 0.15 : 0));
    const E = hex(eyes);
    for (const sx of [8 - eyeGap - 1, 8 + eyeGap - 1]) {
      img.set(sx, eyeY, E); img.set(sx + 1, eyeY, E); img.set(sx, eyeY + 1, E); img.set(sx + 1, eyeY + 1, E);
      if (eyeGlow) { img.glow(sx, eyeY, 1); img.glow(sx + 1, eyeY, 1); img.glow(sx, eyeY + 1, 1); img.glow(sx + 1, eyeY + 1, 1); }
      else img.set(sx + 1, eyeY, [255, 255, 255]);
    }
    if (nose) { img.set(7, eyeY + 4, hex(nose)); img.set(8, eyeY + 4, hex(nose)); }
    if (mouth) for (let x = 6; x <= 9; x++) img.set(x, eyeY + 6, hex(mouth));
    if (glowMarks) for (const [x, y] of [[3, 3], [12, 3], [2, 10], [13, 10]]) { img.set(x, y, hex(glowMarks)); img.glow(x, y, 1); }
  };
}
function solidPainter(c, { glow = false, alpha = 255, noise = 0.08 } = {}) {
  const C = hex(c);
  return (img) => img.each((x, y) => { img.set(x, y, mul(C, 1 - noise + img.rng.next() * noise * 2), alpha); if (glow) img.glow(x, y, 0.85); });
}

// --- animal coats (tile seamlessly: box faces sample windows of the texture at any offset)
const wrapD = (a, b) => { const d = Math.abs(a - b) % 16; return Math.min(d, 16 - d); };
// fleece: tight curls, each lit from above with a soft shadow below
function woolPainter(base, { light = 1.06, dark = 0.64, curls = 13, r = 2.4 } = {}) {
  const B = hex(base);
  return (img) => {
    const pts = [];
    for (let k = 0; k < curls; k++) pts.push([img.rng.next() * 16, img.rng.next() * 16, 0.8 + img.rng.next() * 0.45]);
    const n = field(img, 4, 11);
    img.each((x, y) => {
      let best = 99, by = 0;
      for (const [px, py, sz] of pts) {
        const dx = wrapD(x + 0.5, px), dy = wrapD(y + 0.5, py);
        const d = Math.hypot(dx, dy) / sz;
        if (d < best) { best = d; by = ((y + 0.5 - py + 24) % 16) - 8; }
      }
      const v = Math.max(0, 1 - best / r);
      const top = by < 0 ? 0.06 : -0.05; // upper half of a curl catches the light
      const f = dark + (light - dark) * Math.pow(v, 0.55) + top * v + (n(x, y) - 0.5) * 0.08 + (img.rng.next() - 0.5) * 0.035;
      img.set(x, y, mul(B, f));
    });
  };
}
// short hair: soft value noise with fine directional strands, optional spots and glints
function hairPainter(base, { dark = 0.8, light = 1.14, strands = 0.5, spots = null, nSpots = 6, glow = null, nGlow = 4, flecks = null } = {}) {
  const B = hex(base);
  return (img) => {
    const f = field(img, 4, 5), f2 = field(img, 8, 9);
    const col = [];
    for (let x = 0; x < 16; x++) col.push(img.rng.next());
    img.each((x, y) => {
      const n = f(x, y) * 0.55 + f2(x, y) * 0.3 + img.rng.next() * 0.15;
      const s = (col[x] - 0.5) * strands * Math.sin((y + col[x] * 9) * 0.8);
      const k = dark + (light - dark) * Math.min(1, Math.max(0, n + s));
      img.set(x, y, mul(B, k));
    });
    if (flecks) for (let k = 0; k < 10; k++) { const x = img.rng.int(16), y = img.rng.int(16); img.blend(x, y, hex(flecks), 0.55); }
    if (spots) for (let k = 0; k < nSpots; k++) {
      const x = img.rng.int(16), y = img.rng.int(16), c = hex(spots);
      img.blend(x, y, c, 0.9); img.blend(x + 1, y, c, 0.6); img.blend(x, y + 1, c, 0.5); img.blend(x + 1, y + 1, c, 0.3);
    }
    if (glow) for (let k = 0; k < nGlow; k++) { const x = img.rng.int(16), y = img.rng.int(16); img.set(x, y, hex(glow)); img.glow(x, y, 1); }
  };
}
// feathers: overlapping rows of rounded scales, darker at their trailing edge
function featherPainter(base, { tip = null, dark = 0.72, light = 1.15, rows = 4 } = {}) {
  const B = hex(base), T = tip ? hex(tip) : mul(B, dark);
  return (img) => {
    const h = 16 / rows;
    img.each((x, y) => {
      const row = Math.floor(y / h), off = (row % 2) * 2;
      const fx = ((x + off) % 4) / 4 - 0.5, fy = (y % h) / h;
      const edge = fy + Math.abs(fx) * 0.9;
      let c = mul(B, light - (light - 1) * fy * 2);
      if (edge > 0.86) c = mix(c, T, 0.45);
      img.set(x, y, mul(c, 0.96 + img.rng.next() * 0.08));
    });
  };
}
// a face texture for snouts and muzzles (fit to the front face): nostrils and a soft mouth line
function snoutPainter(base, { nostril = '#2a1a1a', nose = null, mouth = true } = {}) {
  const B = hex(base);
  return (img) => {
    img.each((x, y) => img.set(x, y, mul(B, 0.92 + img.rng.next() * 0.1 - (y > 11 ? 0.08 : 0))));
    if (nose) for (let y = 1; y < 8; y++) for (let x = 3; x < 13; x++) if (Math.hypot((x - 7.5) / 5, (y - 4) / 3.6) < 1) img.set(x, y, mul(hex(nose), 0.9 + img.rng.next() * 0.15));
    const N = hex(nostril);
    for (const cx of [4, 10]) for (let y = 3; y < 6; y++) for (let x = cx; x < cx + 2; x++) img.set(x, y, N);
    if (mouth) for (let x = 5; x < 11; x++) img.set(x, 12 + (x === 5 || x === 10 ? -1 : 0), mul(B, 0.55));
  };
}
// ear with a pale inner shell (fit to the front face)
function earPainter(base, inner) {
  const B = hex(base), I = hex(inner);
  return (img) => img.each((x, y) => {
    const d = Math.hypot((x - 7.5) / 5.2, (y - 9) / 7.5);
    img.set(x, y, d < 1 ? mix(I, mul(I, 0.85), d) : mul(B, 0.9 + img.rng.next() * 0.15));
  });
}
// a bushy tail tip / ruff that fades to white
function gradientPainter(a, b, { glow = false } = {}) {
  const A = hex(a), Bc = hex(b);
  return (img) => img.each((x, y) => { img.set(x, y, mul(mix(A, Bc, y / 15), 0.93 + img.rng.next() * 0.12)); if (glow && y > 9 && img.rng.next() < 0.15) img.glow(x, y, 0.8); });
}

// woven cloth: a fine twill with soft vertical folds
function clothPainter(base, { dark = 0.84, light = 1.08, trim = null } = {}) {
  const B = hex(base);
  return (img) => {
    const f = field(img, 4, 21);
    img.each((x, y) => {
      const fold = Math.sin((x + f(x, y) * 3) * 1.3) * 0.06;
      const tw = ((x + y) % 4 < 2 ? 0.03 : -0.03);
      img.set(x, y, mul(B, Math.min(light, Math.max(dark, 1 + fold + tw + (img.rng.next() - 0.5) * 0.04))));
    });
    if (trim) for (let x = 0; x < 16; x++) { img.set(x, 0, hex(trim)); img.set(x, 15, mul(hex(trim), 0.85)); }
  };
}
function strawPainter(base) {
  const B = hex(base);
  return (img) => img.each((x, y) => img.set(x, y, mul(B, ((x + (y >> 1)) % 3 === 0 ? 0.82 : 1.04) + (img.rng.next() - 0.5) * 0.08)));
}
function villagerFace(skin) {
  const S = hex(skin);
  return (img) => {
    img.each((x, y) => img.set(x, y, mul(S, 0.96 + img.rng.next() * 0.06)));
    for (const x of [3, 12]) { img.blend(x, 10, [230, 120, 110], 0.35); img.blend(x - (x > 8 ? 1 : -1), 10, [230, 120, 110], 0.2); }
    for (let x = 6; x <= 9; x++) img.set(x, 13, mul(S, 0.62));
    for (const x of [3, 4, 5, 10, 11, 12]) img.set(x, 5, mul(S, 0.55));
  };
}

const SKINS = {
  // villagers
  v_skin: hairPainter('#dcae84', { dark: 0.92, light: 1.04, strands: 0.08 }),
  v_face: villagerFace('#dcae84'),
  v_hair: hairPainter('#4a3424', { dark: 0.72, light: 1.2, strands: 1.3 }),
  v_robe: clothPainter('#7a6a3a', { trim: '#b8a060' }),
  v_robe_shepherd: clothPainter('#c9d6e2', { trim: '#7aa0c8' }),
  v_robe_smith: clothPainter('#4a4a54', { trim: '#7a5a3a' }),
  v_robe_carto: clothPainter('#2e4a7a', { trim: '#e3c06e' }),
  v_robe_scholar: clothPainter('#5e44b0', { trim: '#e3c06e' }),
  v_pants: clothPainter('#3e3a34'),
  v_belt: hairPainter('#5a3a22', { strands: 0.3 }),
  v_apron: hairPainter('#6e4a30', { strands: 0.6, dark: 0.75 }),
  v_straw: strawPainter('#e2c46a'),
  v_band: clothPainter('#b8423a'),
  v_beret: clothPainter('#a83a4a'),
  // grazing animals
  deer_fur: hairPainter('#9c6a3a', { spots: '#ead8b4', nSpots: 4, strands: 0.45 }),
  deer_coat: hairPainter('#9c6a3a', { strands: 0.45 }),
  deer_belly: hairPainter('#e4d3b2', { dark: 0.9, light: 1.04, strands: 0.2 }),
  deer_leg: hairPainter('#7e5430', { strands: 0.6 }),
  deer_nose: snoutPainter('#8a6038', { nose: '#2a1d16', nostril: '#120c0a' }),
  deer_face: facePainter('#a8743e', { nose: '#2a1a12' }),
  deer_ear: earPainter('#9c6a3a', '#e9c7b0'),
  antler: hairPainter('#e2d6b8', { dark: 0.82, light: 1.06, strands: 0.9 }),
  sheep_wool: woolPainter('#f2f5fb'),
  sheep_wool_cream: woolPainter('#efe1c4'),
  sheep_wool_gray: woolPainter('#a9adb8', { dark: 0.72 }),
  sheep_wool_brown: woolPainter('#6e5444', { dark: 0.7, light: 1.12 }),
  sheep_face: hairPainter('#5d6684', { strands: 0.35, dark: 0.85 }),
  sheep_muzzle: snoutPainter('#76809c', { nose: '#3c4258', nostril: '#191b26' }),
  sheep_skin: hairPainter('#d6c3b3', { dark: 0.88, strands: 0.25 }),
  horn_gold: (img) => img.each((x, y) => img.set(x, y, mul(hex('#d9b65a'), (y % 3 === 0 ? 0.74 : 1.02) + img.rng.next() * 0.08))),
  // fowl
  bird_body: featherPainter('#f2c26a', { tip: '#c88a3c' }),
  bird_breast: featherPainter('#fbe6b0', { tip: '#e8c88a', rows: 5 }),
  bird_wing: featherPainter('#e3a24a', { tip: '#8a4f22', rows: 3 }),
  bird_face: facePainter('#f2c26a', { eyeY: 5, eyeGap: 4 }),
  crest: gradientPainter('#ff8a4a', '#e8402e'),
  beak: solidPainter('#e8862a'),
  // boar
  boar_fur: hairPainter('#5a3b28', { dark: 0.72, light: 1.18, strands: 1.1, flecks: '#8a6a50' }),
  boar_mane: hairPainter('#2e211a', { dark: 0.7, light: 1.3, strands: 1.4 }),
  boar_face: facePainter('#5e3e2a', { eyeY: 4, eyes: '#e8c048' }),
  snout: snoutPainter('#d48e86', { nostril: '#5a2a2a', mouth: false }),
  tusk: solidPainter('#f2ead8'),
  // spirit fox
  fox_fur: hairPainter('#dfe7f3', { dark: 0.82, light: 1.08, strands: 0.7, glow: '#6ff0e0', nGlow: 3 }),
  fox_back: hairPainter('#b8cbe2', { dark: 0.8, light: 1.1, strands: 0.8 }),
  fox_chest: hairPainter('#ffffff', { dark: 0.9, light: 1.0, strands: 0.3 }),
  fox_ear: earPainter('#c3d5ea', '#2a3a52'),
  fox_nose: snoutPainter('#e6edf6', { nose: '#22303e', nostril: '#0c1218', mouth: false }),
  fox_face: facePainter('#dfe6f2', { eyes: '#2ad8c8', eyeGlow: true, nose: '#2a3040', glowMarks: '#6ff0e0' }),
  fox_tail: hairPainter('#d4e2f2', { dark: 0.84, light: 1.1, strands: 1.0, glow: '#8ff6ec', nGlow: 3 }),
  fox_tip: gradientPainter('#e8f4ff', '#ffffff', { glow: true }),
  // hare
  hare_fur: hairPainter('#e4e2ea', { dark: 0.84, light: 1.06, strands: 0.5, flecks: '#c8c2d0' }),
  hare_ear: earPainter('#e4e2ea', '#f2b8c4'),
  hare_face: facePainter('#e6e4ea', { eyes: '#c83a4a', nose: '#e88a9a' }),
  hare_tail: hairPainter('#ffffff', { dark: 0.92, light: 1.0 }),
  // fish
  fish_scales: featherPainter('#9cc6de', { tip: '#5a86a8', rows: 5, light: 1.2 }),
  fish_face: facePainter('#9cc6de', { pattern: 'scales', eyeY: 5, eyeGap: 5 }),
  fin: gradientPainter('#8ab8dc', '#4f7ea8'),
  // the rest of the bestiary
  jelly: solidPainter('#e8a8f0', { glow: true, alpha: 170, noise: 0.12 }),
  jelly_core: solidPainter('#fff0ff', { glow: true }),
  gloom: furPainter('#1c1630', { pattern: 'fur', dark: 0.6, light: 1.5 }),
  gloom_face: facePainter('#1c1630', { eyes: '#c86aff', eyeGlow: true, eyeY: 7, eyeGap: 3 }),
  cap_red: furPainter('#c8402e', { pattern: 'spots', accent: '#f6efe0', dark: 0.8 }),
  stem: furPainter('#e6dcc6', { pattern: 'fur', dark: 0.88 }),
  stem_face: facePainter('#e6dcc6', { eyes: '#2a1810', eyeY: 4, mouth: '#5a2a1a' }),
  bone: furPainter('#e8e2d2', { pattern: 'bone', dark: 0.8 }),
  bone_face: facePainter('#e8e2d2', { eyes: '#42d6ea', eyeGlow: true, eyeY: 6, mouth: '#3a3a40', pattern: 'bone' }),
  crystal: solidPainter('#7cefff', { glow: true }),
  spider: furPainter('#1e2a2e', { pattern: 'stripes', dark: 0.7, light: 1.4 }),
  spider_face: facePainter('#1e2a2e', { eyes: '#ff5a8a', eyeGlow: true, eyeY: 5, eyeGap: 2 }),
  spider_abd: furPainter('#2a2440', { pattern: 'spots', accent: '#9a6ad8' }),
  ember: solidPainter('#ff8a2a', { glow: true, noise: 0.2 }),
  ember_core: solidPainter('#ffe8a0', { glow: true }),
  gloop: solidPainter('#6ad87a', { alpha: 175, noise: 0.15 }),
  gloop_core: solidPainter('#2a7a3a'),
  warden_stone: furPainter('#4d6e78', { pattern: 'stone', dark: 0.7 }),
  warden_face: facePainter('#4d6e78', { eyes: '#6ff0e0', eyeGlow: true, eyeY: 7, eyeGap: 4, pattern: 'stone' }),
  rune: solidPainter('#6ff0e0', { glow: true }),
  // the traveller
  p_face: facePainter('#f0c8a4', { eyes: '#2a3a4a', hood: '#2a8a90', eyeY: 8, mouth: null, light: 1.04, pattern: 'plain' }),
  p_hood: furPainter('#2a8a90', { pattern: 'plain', dark: 0.82, light: 1.08 }),
  p_cloak: furPainter('#2a7f86', { pattern: 'stripes', dark: 0.75, light: 1.1 }),
  p_scarf: furPainter('#e3c06e', { pattern: 'stripes', dark: 0.8 }),
  p_pants: furPainter('#3a3a52', { pattern: 'plain', dark: 0.85 }),
  p_skin: furPainter('#f0c8a4', { pattern: 'plain', dark: 0.94, light: 1.03 }),
  p_boot: furPainter('#5a3a26', { pattern: 'plain' }),
  trader_robe: furPainter('#7a4fc4', { pattern: 'stripes', dark: 0.75 }),
  trader_face: facePainter('#d8a882', { eyes: '#2a2a3a', hood: '#7a4fc4', eyeY: 8 }),
};
const GLOWING_SKINS = new Set(['fox_fur', 'fox_face', 'fox_tail', 'fox_tip', 'jelly', 'jelly_core', 'gloom_face', 'bone_face', 'crystal', 'spider_face', 'ember', 'ember_core', 'warden_face', 'rune']);
export const SKIN = {};
for (const [k, fn] of Object.entries(SKINS)) SKIN[k] = registerTexture(`mob_${k}`, fn, { glow: GLOWING_SKINS.has(k) });

// ---------------------------------------------------------------- model definitions
// part: { box:[x0,y0,z0,x1,y1,z1], pivot:[x,y,z], skin: name | {front,back,top,bottom,side,default},
//         group, rot:[rx,ry,rz], color, fit ('front' | 'all'), emissive, wool, shorn, antler, translucent }
// model.groups (rigged models): { name: { pivot, parent, rot } } — parts take their group's pivot
const P = (box, skin, o = {}) => ({ box, skin, ...o });
const legs4 = (x, z0, z1, h, w, skin, groupA = 'legA', groupB = 'legB') => [
  P([-x - w / 2, 0, z0 - w / 2, -x + w / 2, h, z0 + w / 2], skin, { pivot: [-x, h, z0], group: groupA + 'FL' }),
  P([x - w / 2, 0, z0 - w / 2, x + w / 2, h, z0 + w / 2], skin, { pivot: [x, h, z0], group: groupB + 'FR' }),
  P([-x - w / 2, 0, z1 - w / 2, -x + w / 2, h, z1 + w / 2], skin, { pivot: [-x, h, z1], group: groupB + 'BL' }),
  P([x - w / 2, 0, z1 - w / 2, x + w / 2, h, z1 + w / 2], skin, { pivot: [x, h, z1], group: groupA + 'BR' }),
];
const EYE = [0.05, 0.045, 0.06, 1], GLINT = [0.95, 0.95, 1, 1], HOOF = [0.16, 0.13, 0.12, 1];
// mirror a part across x = 0 (L ↔ R groups)
const mirror = (p) => ({ ...p, box: [-p.box[3], p.box[1], p.box[2], -p.box[0], p.box[4], p.box[5]], group: p.group && p.group.replace(/L$/, '\u0000').replace(/R$/, 'L').replace('\u0000', 'R'), rot: p.rot && [p.rot[0], -p.rot[1], -p.rot[2]] });
const both = (...parts) => [...parts, ...parts.map(mirror)];
const mirrorGroups = (gs) => {
  const out = { ...gs };
  for (const [k, g] of Object.entries(gs)) if (/L$/.test(k)) out[k.replace(/L$/, 'R')] = { ...g, pivot: [-g.pivot[0], g.pivot[1], g.pivot[2]], parent: g.parent && g.parent.replace(/L$/, 'R'), rot: g.rot && [g.rot[0], -g.rot[1], -g.rot[2]] };
  return out;
};
// a leg: thigh, shank and hoof (or paw), pivoting at the hip
const leg = (group, x, z, len, w, skin, { lower = null, foot = HOOF, footH = 1, taper = 0.2 } = {}) => {
  const k = len * 0.42;
  return [
    P([x - w / 2, k, z - w / 2, x + w / 2, len, z + w / 2], skin, { group }),
    P([x - w / 2 + taper, footH, z - w / 2 + taper, x + w / 2 - taper, k, z + w / 2 - taper], lower || skin, { group }),
    P([x - w / 2 - 0.1 + taper, 0, z - w / 2 - 0.1 + taper, x + w / 2 + 0.1 - taper, footH, z + w / 2 + 0.1 - taper], null, { group, color: foot }),
  ];
};
// eyes: a dark lens with a glint, sitting just proud of a face (side = 'front' or 'side')
const eyesFront = (group, x, y, z, w = 1.2, h = 1.2) => both(
  P([x - w / 2, y - h / 2, z - 0.12, x + w / 2, y + h / 2, z + 0.08], null, { group: `${group}L`, color: EYE }),
  P([x - w / 2 + 0.25, y + h / 2 - 0.55, z - 0.16, x - w / 2 + 0.6, y + h / 2 - 0.2, z - 0.1], null, { group: `${group}L`, color: GLINT }),
);
const eyesSide = (group, x, y, z, w = 1.1, h = 1.1) => both(
  P([x - 0.12, y - h / 2, z - w / 2, x + 0.08, y + h / 2, z + w / 2], null, { group: `${group}L`, color: EYE }),
  P([x - 0.16, y + h / 2 - 0.5, z - w / 2 + 0.2, x - 0.1, y + h / 2 - 0.15, z - w / 2 + 0.55], null, { group: `${group}L`, color: GLINT }),
);

const SHOE = [0.22, 0.15, 0.1, 1];
export const MODELS = {
  villager: {
    texScale: 2,
    // variant = profession: farmer, shepherd, smith, cartographer, scholar
    variants: [[1, {}], [0, { v_robe: 'v_robe_shepherd' }], [0, { v_robe: 'v_robe_smith' }], [0, { v_robe: 'v_robe_carto' }], [0, { v_robe: 'v_robe_scholar' }]],
    groups: mirrorGroups({
      body: { pivot: [0, 12, 0] },
      head: { pivot: [0, 24.5, 0], parent: 'body' },
      eyeL: { pivot: [-1.8, 28.2, -4], parent: 'head' },
      armL: { pivot: [-5.3, 23, 0], parent: 'body', rot: [0, 0, -0.06] },
      legL: { pivot: [-2, 12, 0] },
    }),
    parts: [
      ...both(
        P([-3.7, 1.4, -1.8, -0.3, 12, 1.8], 'v_pants', { group: 'legL' }),
        P([-3.9, 0, -2.4, -0.1, 1.5, 1.9], null, { group: 'legL', color: SHOE }),
        P([-6.6, 13.2, -1.6, -4, 24, 1.6], 'v_robe', { group: 'armL' }),
        P([-6.4, 11.9, -1.4, -4.2, 13.3, 1.4], 'v_skin', { group: 'armL' }),
      ),
      P([-4, 12, -2.4, 4, 24.6, 2.4], 'v_robe', { group: 'body' }),
      P([-4.4, 9.4, -2.8, 4.4, 13.2, 2.8], 'v_robe', { group: 'body' }),
      P([-4.2, 14.6, -2.6, 4.2, 15.7, 2.6], 'v_belt', { group: 'body' }),
      P([-3.2, 10, -2.75, 3.2, 21.5, -2.5], 'v_apron', { group: 'body', only: [2] }),
      P([2.8, 12.4, -1.6, 4.9, 16.2, 1.6], 'v_belt', { group: 'body', only: [3] }),
      P([-4, 24.5, -4, 4, 32.5, 4], { front: 'v_face', default: 'v_skin' }, { group: 'head', fit: 'front' }),
      P([-4.25, 30.2, -4.25, 4.25, 32.9, 4.25], 'v_hair', { group: 'head' }),
      P([-4.25, 25.5, 2.5, 4.25, 30.2, 4.25], 'v_hair', { group: 'head' }),
      P([-0.9, 25.8, -5.3, 0.9, 29, -4], 'v_skin', { group: 'head' }),
      ...eyesFront('eye', -1.8, 28.2, -4, 1.3, 1.2),
      // hats by trade
      P([-6.6, 32.2, -6.6, 6.6, 32.9, 6.6], 'v_straw', { group: 'head', only: [0] }),
      P([-4.4, 32.6, -4.4, 4.4, 35.2, 4.4], 'v_straw', { group: 'head', only: [0] }),
      P([-4.5, 32.9, -4.5, 4.5, 33.7, 4.5], 'v_band', { group: 'head', only: [0] }),
      P([-4.6, 31.4, -4.6, 4.6, 34.2, 4.6], 'sheep_wool', { group: 'head', only: [1] }),
      P([-1.1, 34.1, -1.1, 1.1, 35.8, 1.1], 'sheep_wool', { group: 'head', only: [1] }),
      P([-4.35, 29.4, -4.35, 4.35, 30.5, 4.35], 'v_band', { group: 'head', only: [2] }),
      P([-4.7, 32.1, -4.9, 4.3, 33.8, 4.7], 'v_beret', { group: 'head', only: [3] }),
      P([-0.5, 33.8, -0.5, 0.5, 34.6, 0.5], 'v_beret', { group: 'head', only: [3] }),
      P([-4.7, 24.8, -3.4, 4.7, 33.4, 4.7], 'v_robe', { group: 'head', only: [4] }),
      P([-2.2, 23.2, -4.4, 2.2, 26.2, -3.6], 'v_hair', { group: 'head', only: [4] }),
    ],
  },
  sheep: {
    texScale: 2,
    variants: [[0.62, {}], [0.14, { sheep_wool: 'sheep_wool_cream' }], [0.14, { sheep_wool: 'sheep_wool_gray' }], [0.1, { sheep_wool: 'sheep_wool_brown' }]],
    groups: mirrorGroups({
      body: { pivot: [0, 9, 0] },
      head: { pivot: [0, 14.5, -6.5], parent: 'body' },
      earL: { pivot: [-2.4, 16.2, -9], parent: 'head', rot: [0, 0.2, 0.55] },
      eyeL: { pivot: [-1.3, 15.6, -11.5], parent: 'head' },
      tail: { pivot: [0, 14.5, 7.8], parent: 'body' },
      legFL: { pivot: [-2.8, 9, -4.4] }, legBL: { pivot: [-2.8, 9, 4.4] },
    }),
    parts: [
      // fleece: a main body with puffs that round off the silhouette
      P([-5.5, 8, -7, 5.5, 17, 7], 'sheep_wool', { group: 'body', wool: true }),
      P([-4.5, 16, -5.5, 4.5, 18.6, 5.8], 'sheep_wool', { group: 'body', wool: true }),
      P([-4.6, 9.2, -8.6, 4.6, 15.6, -6.4], 'sheep_wool', { group: 'body', wool: true }),
      P([-4.6, 9.6, 6.4, 4.6, 16.2, 8.6], 'sheep_wool', { group: 'body', wool: true }),
      P([-4.5, 7, -5.6, 4.5, 8.4, 5.6], 'sheep_wool', { group: 'body', wool: true }),
      ...both(P([-6.6, 10.2, -5.4, -5.2, 15.6, 4.6], 'sheep_wool', { group: 'body', wool: true })),
      // shorn
      P([-4.4, 8.6, -6.4, 4.4, 15.4, 6.4], 'sheep_skin', { group: 'body', shorn: true }),
      P([-0.9, 12.6, 6.4, 0.9, 14.6, 8.2], 'sheep_skin', { group: 'tail', shorn: true }),
      // head
      P([-2.5, 12.5, -11.5, 2.5, 17.4, -6.4], 'sheep_face', { group: 'head' }),
      P([-1.8, 12.4, -13.1, 1.8, 15, -11.3], { front: 'sheep_muzzle', default: 'sheep_face' }, { group: 'head', fit: 'front' }),
      P([-3, 16.6, -10.6, 3, 19.4, -7], 'sheep_wool', { group: 'head', wool: true }),
      ...both(
        P([-4.3, 16.4, -9.1, -2.5, 18.4, -7.5], 'horn_gold', { group: 'head' }),
        P([-5.1, 14.7, -8.3, -3.5, 17.2, -6.7], 'horn_gold', { group: 'head' }),
        P([-4.7, 13.5, -9.7, -3.5, 15, -8.2], 'horn_gold', { group: 'head' }),
        P([-5.3, 15.7, -9.7, -2.4, 16.8, -8.4], { front: 'sheep_face', default: 'sheep_face' }, { group: 'earL' }),
      ),
      ...eyesFront('eye', -1.3, 15.6, -11.5),
      P([-1.6, 11.4, 7.6, 1.6, 15, 10.2], 'sheep_wool', { group: 'tail', wool: true }),
      // legs with woolly tops
      ...['FL', 'BL'].flatMap((k) => {
        const z = k === 'FL' ? -4.4 : 4.4;
        return both(...leg(`leg${k}`, -2.8, z, 9, 2.4, 'sheep_skin', { footH: 1.3, taper: 0.15 }),
          P([-4.3, 6.4, z - 1.6, -1.3, 9, z + 1.6], 'sheep_wool', { group: `leg${k}`, wool: true }));
      }),
    ],
  },
  deer: {
    texScale: 2,
    groups: mirrorGroups({
      body: { pivot: [0, 13, 0] },
      neck: { pivot: [0, 16.5, -7.2], parent: 'body', rot: [-0.32, 0, 0] },
      head: { pivot: [0, 23.6, -7.6], parent: 'neck', rot: [0.32, 0, 0] },
      earL: { pivot: [-1.8, 25, -8.2], parent: 'head', rot: [0, 0.35, 0.3] },
      eyeL: { pivot: [-2.2, 23.9, -9.6], parent: 'head' },
      antlers: { pivot: [0, 25.5, -7.9], parent: 'head' },
      tail: { pivot: [0, 17.6, 7.8], parent: 'body', rot: [0.35, 0, 0] },
      legFL: { pivot: [-2.2, 11.5, -6] }, legBL: { pivot: [-2.2, 11.5, 5.2] },
    }),
    parts: [
      P([-3.5, 11, -7.5, 3.5, 18, 6.5], { bottom: 'deer_belly', default: 'deer_fur' }, { group: 'body' }),
      P([-3, 11.6, -9.2, 3, 17.6, -7], { bottom: 'deer_belly', default: 'deer_coat' }, { group: 'body' }),
      P([-3.2, 11.6, 6, 3.2, 17.8, 8.2], { back: 'deer_belly', bottom: 'deer_belly', default: 'deer_coat' }, { group: 'body' }),
      P([-1.6, 15, -9, 1.6, 24.4, -5.8], { front: 'deer_belly', default: 'deer_coat' }, { group: 'neck' }),
      P([-2.2, 21.6, -11.5, 2.2, 25.6, -6.8], 'deer_coat', { group: 'head' }),
      P([-1.5, 21.6, -14.6, 1.5, 24.1, -11.2], { front: 'deer_nose', default: 'deer_coat' }, { group: 'head', fit: 'front' }),
      ...eyesSide('eye', -2.2, 23.9, -9.6),
      ...both(P([-5.4, 24.4, -8.7, -1.8, 26.2, -7.7], { front: 'deer_ear', default: 'deer_coat' }, { group: 'earL', fit: 'front' })),
      // antlers: beam, brow tine, back tine and a forked crown
      ...both(
        P([-2.2, 25.5, -8.4, -1.2, 30.6, -7.4], 'antler', { group: 'antlers', antler: true }),
        P([-2.2, 26.8, -10.6, -1.2, 27.8, -8.4], 'antler', { group: 'antlers', antler: true }),
        P([-4.6, 28, -8.4, -2.2, 29, -7.4], 'antler', { group: 'antlers', antler: true }),
        P([-3.6, 30.6, -8.4, -2.4, 33, -7.4], 'antler', { group: 'antlers', antler: true }),
        P([-1.6, 30.6, -8.9, -0.6, 32.4, -7.9], 'antler', { group: 'antlers', antler: true }),
      ),
      P([-1.1, 15.2, 7.8, 1.1, 18, 9.4], { back: 'deer_belly', bottom: 'deer_belly', default: 'deer_coat' }, { group: 'tail' }),
      ...['FL', 'BL'].flatMap((k) => both(...leg(`leg${k}`, -2.2, k === 'FL' ? -6 : 5.2, 11.5, 1.8, 'deer_leg', { taper: 0.25 }))),
    ],
  },
  boar: {
    texScale: 2,
    groups: mirrorGroups({
      body: { pivot: [0, 10, 0] },
      head: { pivot: [0, 10.5, -8.4], parent: 'body' },
      earL: { pivot: [-2.6, 13, -10], parent: 'head', rot: [0.3, 0, 0.35] },
      eyeL: { pivot: [-3.5, 11, -12], parent: 'head' },
      tail: { pivot: [0, 12.4, 8], parent: 'body' },
      legFL: { pivot: [-3, 7, -5.4] }, legBL: { pivot: [-3, 7, 5.4] },
    }),
    parts: [
      P([-4.5, 5.6, -8, 4.5, 14, 8.2], 'boar_fur', { group: 'body' }),
      P([-5, 7, -8.6, 5, 15.6, -1.4], 'boar_fur', { group: 'body' }),
      P([-1.1, 14, -8.6, 1.1, 17.2, 5], 'boar_mane', { group: 'body' }),
      P([-0.8, 15.6, -9.2, 0.8, 16.6, -6], 'boar_mane', { group: 'body' }),
      P([-3.6, 6, -14, 3.6, 13.2, -8], 'boar_fur', { group: 'head' }),
      P([-2.3, 6.4, -16.6, 2.3, 10.2, -14], { front: 'snout', default: 'boar_fur' }, { group: 'head', fit: 'front' }),
      P([-1.6, 12.6, -13.6, 1.6, 14.6, -8.6], 'boar_mane', { group: 'head' }),
      ...both(
        P([-3.1, 8.6, -16.3, -2.1, 11.6, -15.3], 'tusk', { group: 'head' }),
        P([-3.1, 11.1, -15.5, -2.1, 12.6, -14.3], 'tusk', { group: 'head' }),
        P([-4.6, 12.5, -10.6, -2.4, 15.2, -9.4], 'boar_mane', { group: 'earL' }),
      ),
      ...eyesSide('eye', -3.62, 11, -12, 1, 0.9),
      P([-0.5, 9.6, 8, 0.5, 12.6, 9], 'boar_fur', { group: 'tail' }),
      P([-0.9, 8.4, 8.1, 0.9, 9.8, 9.3], 'boar_mane', { group: 'tail' }),
      ...['FL', 'BL'].flatMap((k) => both(...leg(`leg${k}`, -3, k === 'FL' ? -5.4 : 5.4, 7, 2.8, 'boar_fur', { taper: 0.2 }))),
    ],
  },
  puffbird: {
    texScale: 2,
    groups: mirrorGroups({
      body: { pivot: [0, 5.5, 0] },
      head: { pivot: [0, 9.2, -2.8], parent: 'body' },
      eyeL: { pivot: [-2.5, 11.4, -4.2], parent: 'head' },
      wingL: { pivot: [-3.5, 8.6, -1] , parent: 'body' },
      tail: { pivot: [0, 7.2, 4.2], parent: 'body', rot: [-0.35, 0, 0] },
      legL: { pivot: [-1.3, 3.2, 0] },
    }),
    parts: [
      P([-3.5, 3, -4, 3.5, 9.6, 4.6], { front: 'bird_breast', bottom: 'bird_breast', default: 'bird_body' }, { group: 'body' }),
      P([-3, 3.4, -5.1, 3, 8.6, -3.6], { default: 'bird_breast' }, { group: 'body' }),
      P([-2.5, 8.4, -6, 2.5, 13, -1.4], { front: 'bird_breast', default: 'bird_body' }, { group: 'head' }),
      P([-0.8, 9.9, -7.6, 0.8, 11.2, -6], 'beak', { group: 'head' }),
      P([-0.6, 9.4, -7, 0.6, 9.9, -6], 'beak', { group: 'head' }),
      ...both(P([-3, 8.6, -5.5, -2.4, 10.6, -2.2], 'bird_breast', { group: 'head' })),
      P([-2, 12.9, -5.5, 2, 13.5, -2], 'bird_body', { group: 'head' }),
      P([-0.4, 13, -4.6, 0.4, 15.6, -2.2], 'crest', { group: 'head' }),
      P([-0.4, 12.6, -2.6, 0.4, 14.6, -1], 'crest', { group: 'head' }),
      ...eyesSide('eye', -2.5, 11.4, -4.2, 1, 1),
      ...both(P([-4.3, 4.4, -3, -3.4, 8.6, 3.8], 'bird_wing', { group: 'wingL' })),
      P([-2.6, 6.4, 4.2, 2.6, 7.6, 7.4], 'bird_wing', { group: 'tail' }),
      P([-2, 7.4, 5.8, 2, 10.4, 6.8], 'bird_wing', { group: 'tail' }),
      ...both(
        P([-1.6, 0.4, -0.3, -1, 3.2, 0.3], 'beak', { group: 'legL' }),
        P([-2, 0, -1.4, -0.6, 0.4, 0.4], 'beak', { group: 'legL' }),
      ),
    ],
  },
  fox: {
    texScale: 2,
    groups: mirrorGroups({
      body: { pivot: [0, 8, 0] },
      head: { pivot: [0, 9.6, -6.4], parent: 'body' },
      earL: { pivot: [-1.7, 12, -8.4], parent: 'head', rot: [0, 0, -0.12] },
      eyeL: { pivot: [-1.45, 10.5, -10.5], parent: 'head' },
      tail: { pivot: [0, 9.4, 5], parent: 'body', rot: [0.55, 0, 0] },
      tail2: { pivot: [0, 9.6, 9.4], parent: 'tail', rot: [-0.25, 0, 0] },
      tail3: { pivot: [0, 9.6, 13.4], parent: 'tail2', rot: [-0.2, 0, 0] },
      legFL: { pivot: [-1.6, 6.2, -4.4] }, legBL: { pivot: [-1.6, 6.2, 3.8] },
    }),
    parts: [
      P([-2.5, 6, -6, 2.5, 10.6, 5.2], { top: 'fox_back', bottom: 'fox_chest', default: 'fox_fur' }, { group: 'body' }),
      P([-2.1, 5.4, -7.2, 2.1, 10.2, -5.6], 'fox_chest', { group: 'body' }),
      P([-2.6, 7.6, -10.6, 2.6, 12, -6.4], { top: 'fox_back', default: 'fox_fur' }, { group: 'head' }),
      P([-1.3, 7.6, -13.2, 1.3, 9.7, -10.4], { front: 'fox_nose', default: 'fox_fur' }, { group: 'head', fit: 'front' }),
      P([-3.3, 7.2, -9.4, 3.3, 10, -7], 'fox_chest', { group: 'head' }),
      ...both(P([-2.6, 11.6, -9, -0.8, 15.6, -8], { front: 'fox_ear', default: 'fox_back' }, { group: 'earL', fit: 'front' })),
      ...both(P([-2, 10.15, -10.72, -0.9, 10.85, -10.52], null, { group: 'eyeL', color: [0.35, 1, 0.92, 1], glowPart: true })),
      P([-1.5, 8, 5, 1.5, 11, 9.6], 'fox_tail', { group: 'tail' }),
      P([-2.1, 7.5, 9.4, 2.1, 11.7, 13.6], 'fox_tail', { group: 'tail2' }),
      P([-1.6, 8, 13.4, 1.6, 11.2, 16.4], 'fox_tip', { group: 'tail3' }),
      ...['FL', 'BL'].flatMap((k) => both(...leg(`leg${k}`, -1.6, k === 'FL' ? -4.4 : 3.8, 6.2, 1.6, 'fox_back', { lower: 'fox_fur', foot: [0.2, 0.26, 0.34, 1], footH: 0.9, taper: 0.15 }))),
    ],
  },
  hare: {
    texScale: 2,
    groups: mirrorGroups({
      body: { pivot: [0, 3.6, 0] },
      head: { pivot: [0, 6, -3.4], parent: 'body' },
      earL: { pivot: [-1.1, 8, -4.6], parent: 'head', rot: [0.3, 0, 0.12] },
      eyeL: { pivot: [-2, 6.9, -5.6], parent: 'head' },
      tail: { pivot: [0, 5, 3.8], parent: 'body' },
      legFL: { pivot: [-1.2, 2.6, -2.6] }, legBL: { pivot: [-1.6, 3.6, 1.8] },
    }),
    parts: [
      P([-2.5, 2, -3.6, 2.5, 6.6, 3.4], 'hare_fur', { group: 'body' }),
      P([-2.8, 1.4, 0.4, 2.8, 6, 3.9], 'hare_fur', { group: 'body' }),
      P([-2, 4.5, -7, 2, 8.1, -3.4], 'hare_fur', { group: 'head' }),
      P([-0.5, 5.4, -7.15, 0.5, 6.1, -6.95], null, { group: 'head', color: [0.9, 0.5, 0.58, 1] }),
      ...eyesSide('eye', -2, 6.9, -5.6, 0.9, 0.9),
      ...both(P([-1.7, 8, -5.1, -0.5, 13.2, -4.1], { front: 'hare_ear', default: 'hare_fur' }, { group: 'earL', fit: 'front' })),
      P([-1.2, 4, 3.6, 1.2, 6.2, 5.1], 'hare_tail', { group: 'tail' }),
      ...both(
        P([-1.6, 0.5, -3.2, -0.8, 2.6, -2.2], 'hare_fur', { group: 'legFL' }),
        P([-1.7, 0, -3.6, -0.7, 0.5, -2.2], 'hare_fur', { group: 'legFL' }),
        P([-2.4, 0, -0.6, -0.8, 1.2, 3.6], 'hare_fur', { group: 'legBL' }),
      ),
    ],
  },
  fish: {
    texScale: 2,
    groups: mirrorGroups({
      body: { pivot: [0, 2, 0] },
      tail: { pivot: [0, 2.2, 3.2], parent: 'body' },
      finL: { pivot: [-1, 1.4, -1.6], parent: 'body', rot: [0, -0.5, 0.4] },
    }),
    parts: [
      P([-1, 0.4, -4, 1, 4, 3.4], { front: 'fish_scales', default: 'fish_scales' }, { group: 'body' }),
      P([-0.75, 0.9, -5.2, 0.75, 3.5, -4], 'fish_scales', { group: 'body' }),
      P([-0.6, 1.2, 3.2, 0.6, 3.4, 4.6], 'fish_scales', { group: 'tail' }),
      P([-0.2, -0.2, 4.4, 0.2, 4.8, 7.4], 'fin', { group: 'tail' }),
      P([-0.2, 4, -1.8, 0.2, 5.6, 1.8], 'fin', { group: 'body' }),
      ...both(P([-1.8, 1.2, -2, -1, 1.5, -0.4], 'fin', { group: 'finL' })),
      ...eyesSide('eye', -1, 2.7, -3.2, 0.8, 0.8).map((p) => ({ ...p, group: 'body' })),
    ],
  },
  jelly: {
    head: [0, 12, 0],
    parts: [
      P([-5, 8, -5, 5, 14, 5], 'jelly', { translucent: true }),
      P([-3, 9, -3, 3, 13, 3], 'jelly_core'),
      ...[[-3, -3], [2, -3], [-3, 2], [2, 2]].map(([x, z], i) => P([x, 0, z, x + 1, 8, z + 1], 'jelly', { group: `tent${i}`, pivot: [x + 0.5, 8, z + 0.5] })),
    ],
  },
  gloom: {
    head: [0, 24, 0],
    parts: [
      P([-4, 24, -4, 4, 32, 4], { front: 'gloom_face', default: 'gloom' }, { group: 'head', pivot: [0, 24, 0], fit: 'front' }),
      P([-4, 12, -2, 4, 24, 2], 'gloom'),
      P([-7, 12, -2, -4, 24, 1], 'gloom', { group: 'armL', pivot: [-5.5, 23, 0] }),
      P([4, 12, -2, 7, 24, 1], 'gloom', { group: 'armR', pivot: [5.5, 23, 0] }),
      P([-4, 0, -2, 0, 12, 2], 'gloom', { group: 'legAFL', pivot: [-2, 12, 0] }),
      P([0, 0, -2, 4, 12, 2], 'gloom', { group: 'legBFR', pivot: [2, 12, 0] }),
    ],
  },
  boomshroom: {
    head: [0, 12, 0],
    parts: [
      P([-3, 2, -3, 3, 10, 3], { front: 'stem_face', default: 'stem' }, { fit: 'front' }),
      P([-6.5, 9, -6.5, 6.5, 14, 6.5], 'cap_red', { group: 'cap', pivot: [0, 10, 0] }),
      P([-4.5, 14, -4.5, 4.5, 16, 4.5], 'cap_red', { group: 'cap', pivot: [0, 10, 0] }),
      P([-2.5, 0, -1, -0.5, 2, 1], 'stem', { group: 'legAFL', pivot: [-1.5, 2, 0] }),
      P([0.5, 0, -1, 2.5, 2, 1], 'stem', { group: 'legBFR', pivot: [1.5, 2, 0] }),
    ],
  },
  archer: {
    head: [0, 24, 0],
    parts: [
      P([-4, 24, -4, 4, 32, 4], { front: 'bone_face', default: 'bone' }, { group: 'head', pivot: [0, 24, 0], fit: 'front' }),
      P([-3, 12, -1.5, 3, 24, 1.5], 'bone'),
      P([-5, 12, -1, -3, 24, 1], 'bone', { group: 'armL', pivot: [-4, 23, 0] }),
      P([3, 12, -1, 5, 24, 1], 'bone', { group: 'armR', pivot: [4, 23, 0] }),
      P([-3, 0, -1, -1, 12, 1], 'bone', { group: 'legAFL', pivot: [-2, 12, 0] }),
      P([1, 0, -1, 3, 12, 1], 'bone', { group: 'legBFR', pivot: [2, 12, 0] }),
      P([-6, 22, -1, -4, 26, 1], 'crystal'),
      P([4, 21, 0, 6, 25, 2], 'crystal'),
      P([-1, 30, -1, 1, 34, 1], 'crystal', { group: 'head', pivot: [0, 24, 0] }),
      P([4.5, 8, -6, 5.5, 22, -5], 'bone', { group: 'armR', pivot: [4, 23, 0] }),
    ],
  },
  spider: {
    head: [0, 6, -4],
    parts: [
      P([-3.5, 3, -3, 3.5, 8, 4], 'spider'),
      P([-5, 3, 4, 5, 10, 13], 'spider_abd'),
      P([-3, 3, -8, 3, 8, -3], { front: 'spider_face', default: 'spider' }, { group: 'head', pivot: [0, 5, -3], fit: 'front' }),
      ...[0, 1, 2, 3].flatMap((i) => {
        const z = -2 + i * 2;
        return [
          P([3.5, 5, z - 0.5, 13.5, 6, z + 0.5], 'spider', { pivot: [3.5, 5.5, z], group: `sleg${i}R`, rot: [0, -0.5 + i * 0.33, -0.55] }),
          P([-13.5, 5, z - 0.5, -3.5, 6, z + 0.5], 'spider', { pivot: [-3.5, 5.5, z], group: `sleg${i}L`, rot: [0, 0.5 - i * 0.33, 0.55] }),
        ];
      }),
    ],
  },
  emberling: {
    head: [0, 9, 0],
    parts: [
      P([-3, 6, -3, 3, 12, 3], 'ember_core', { group: 'body', pivot: [0, 9, 0] }),
      P([-4, 5, -4, 4, 7, 4], 'ember', { group: 'ring', pivot: [0, 6, 0] }),
      P([-2, 12, -2, 2, 15, 2], 'ember', { group: 'body', pivot: [0, 9, 0] }),
      P([-1, 15, -1, 1, 17, 1], 'ember', { group: 'body', pivot: [0, 9, 0] }),
      P([-2, 9, -3.2, -1, 10, -3], null, { color: [0.1, 0.05, 0.02, 1], group: 'body', pivot: [0, 9, 0] }),
      P([1, 9, -3.2, 2, 10, -3], null, { color: [0.1, 0.05, 0.02, 1], group: 'body', pivot: [0, 9, 0] }),
      ...[0, 1, 2].map((i) => P([-0.75, -0.75, -0.75, 0.75, 0.75, 0.75], 'ember', { group: `orbit${i}`, pivot: [0, 9, 0], offset: [6, 0, 0] })),
    ],
  },
  gloop: {
    head: [0, 5, 0],
    parts: [
      P([-5, 0, -5, 5, 9, 5], 'gloop', { group: 'body', pivot: [0, 0, 0], translucent: true }),
      P([-2, 2, -2, 2, 6, 2], 'gloop_core', { group: 'body', pivot: [0, 0, 0] }),
      P([-3, 5, -5.2, -1.5, 6.5, -5], null, { color: [0.05, 0.1, 0.05, 1], group: 'body', pivot: [0, 0, 0] }),
      P([1.5, 5, -5.2, 3, 6.5, -5], null, { color: [0.05, 0.1, 0.05, 1], group: 'body', pivot: [0, 0, 0] }),
    ],
  },
  warden: {
    head: [0, 36, 0],
    parts: [
      P([-8, 16, -5, 8, 34, 5], 'warden_stone'),
      P([-5, 34, -5, 5, 43, 5], { front: 'warden_face', default: 'warden_stone' }, { group: 'head', pivot: [0, 34, 0], fit: 'front' }),
      P([-13, 13, -3, -8, 34, 3], 'warden_stone', { group: 'armL', pivot: [-10.5, 32, 0] }),
      P([8, 13, -3, 13, 34, 3], 'warden_stone', { group: 'armR', pivot: [10.5, 32, 0] }),
      P([-7, 0, -4, -1, 16, 4], 'warden_stone', { group: 'legAFL', pivot: [-4, 16, 0] }),
      P([1, 0, -4, 7, 16, 4], 'warden_stone', { group: 'legBFR', pivot: [4, 16, 0] }),
      P([-2, 24, -5.5, 2, 30, -5], 'rune'),
      ...[0, 1, 2, 3].map((i) => P([-1, -1, -1, 1, 1, 1], 'rune', { group: `orbit${i}`, pivot: [0, 40, 0], offset: [12, 0, 0] })),
    ],
  },
  player: {
    head: [0, 24, 0],
    parts: [
      P([-4, 24, -4, 4, 32, 4], { front: 'p_face', default: 'p_hood' }, { group: 'head', pivot: [0, 24, 0], fit: 'front' }),
      P([-4.5, 30, -4.5, 4.5, 33, 4.5], 'p_hood', { group: 'head', pivot: [0, 24, 0] }),
      P([-4, 12, -2, 4, 24, 2], 'p_cloak'),
      P([-4.5, 21, -2.5, 4.5, 24, 2.5], 'p_scarf'),
      P([-1.5, 14, 2, 1.5, 22, 3], 'p_scarf', { group: 'cape', pivot: [0, 22, 2] }),
      P([-8, 12, -2, -4, 24, 2], { bottom: 'p_skin', default: 'p_cloak' }, { group: 'armL', pivot: [-6, 22, 0] }),
      P([4, 12, -2, 8, 24, 2], { bottom: 'p_skin', default: 'p_cloak' }, { group: 'armR', pivot: [6, 22, 0] }),
      P([-4, 0, -2, 0, 12, 2], { bottom: 'p_boot', default: 'p_pants' }, { group: 'legAFL', pivot: [-2, 12, 0] }),
      P([0, 0, -2, 4, 12, 2], { bottom: 'p_boot', default: 'p_pants' }, { group: 'legBFR', pivot: [2, 12, 0] }),
      P([-4.2, 0, -2.2, -0.2, 3, 2.2], 'p_boot', { group: 'legAFL', pivot: [-2, 12, 0] }),
      P([0.2, 0, -2.2, 4.2, 3, 2.2], 'p_boot', { group: 'legBFR', pivot: [2, 12, 0] }),
      P([3, 11, -3, 6, 15, 3], 'p_boot'),
    ],
  },
  trader: {
    head: [0, 24, 0],
    parts: [
      P([-4, 24, -4, 4, 32, 4], { front: 'trader_face', default: 'trader_robe' }, { group: 'head', pivot: [0, 24, 0], fit: 'front' }),
      P([-5, 0, -3, 5, 24, 3], 'trader_robe'),
      P([-8, 12, -2, -5, 24, 2], 'trader_robe', { group: 'armL', pivot: [-6.5, 22, 0] }),
      P([5, 12, -2, 8, 24, 2], 'trader_robe', { group: 'armR', pivot: [6.5, 22, 0] }),
      P([-4, 14, 3, 4, 26, 8], 'p_boot'),
      P([-1, 30, -1, 1, 36, 1], 'crystal'),
    ],
  },
};

// ---------------------------------------------------------------- mesh building
const FACE_KEYS = ['side', 'side', 'top', 'bottom', 'back', 'front'];
for (const def of Object.values(MODELS)) {
  // rigged parts default to their group's pivot; the model's height drives the baked shading
  if (def.groups) for (const p of def.parts) if (!p.pivot && p.group && def.groups[p.group]) p.pivot = def.groups[p.group].pivot;
  def.height = Math.max(...def.parts.filter((p) => !p.antler).map((p) => p.box[4]));
}

// light falls off towards the belly and the ground, a cheap stand-in for occlusion by the body
function shadeAt(def, y, f) {
  const t = Math.min(1, Math.max(0, y / (def.height * 0.8)));
  const k = 0.6 + 0.4 * t * t * (3 - 2 * t);
  return f === 3 ? k * 0.78 : k;
}

function partMesh(renderer, def, part, swap) {
  const mb = new MeshBuilder();
  const [x0, y0, z0, x1, y1, z1] = part.box;
  const pv = part.pivot || [0, 0, 0];
  const s = 1 / 16;
  const bx0 = (x0 - pv[0]) * s, by0 = (y0 - pv[1]) * s, bz0 = (z0 - pv[2]) * s;
  const bx1 = (x1 - pv[0]) * s, by1 = (y1 - pv[1]) * s, bz1 = (z1 - pv[2]) * s;
  const dims = [[z1 - z0, y1 - y0], [z1 - z0, y1 - y0], [x1 - x0, z1 - z0], [x1 - x0, z1 - z0], [x1 - x0, y1 - y0], [x1 - x0, y1 - y0]];
  const ts = def.texScale || 1;
  const faces = [];
  const cols = [];
  const rig = !part.offset && !part.glowPart;
  for (let f = 0; f < 6; f++) {
    let skin = part.skin;
    if (skin && typeof skin === 'object') skin = skin[FACE_KEYS[f]] || skin.default;
    if (skin && swap && swap[skin]) skin = swap[skin];
    const base = skin ? [1, 1, 1, part.translucent ? 0.62 : 1] : (part.color || [1, 1, 1, 1]);
    // per-vertex baked shading (rigged models): corners at the bottom of the face are darker
    if (rig) {
      const yLo = shadeAt(def, y0, f), yHi = shadeAt(def, y1, f);
      const c = (k) => [base[0] * k, base[1] * k, base[2] * k, base[3]];
      cols.push(f === 2 ? c(yHi) : f === 3 ? c(yLo) : [c(yLo), c(yLo), c(yHi), c(yHi)]);
    } else cols.push(base);
    if (!skin) { faces.push(null); continue; }
    const layer = SKIN[skin] !== undefined ? SKIN[skin] : texLayer(`mob_${skin}`);
    const fit = part.fit === 'all' || (part.fit === 'front' && f === 5);
    const [w, hgt] = dims[f];
    const u1 = fit ? 1 : (w * ts) / 16, v1 = fit ? 1 : (hgt * ts) / 16;
    const o = fit ? 0 : ((x0 * 7 + y0 * 3 + z0 * 5 + f * 5) % 16 + 16) % 16 / 16;
    faces.push({ layer, uv: [[o, o + v1], [o + u1, o + v1], [o + u1, o], [o, o]] });
  }
  mb.box(bx0, by0, bz0, bx1, by1, bz1, cols, faces);
  return mb.build(renderer);
}

const meshCache = new Map();
export function modelMeshes(renderer, kind, variant = 0) {
  const key = `${kind}:${variant}`;
  let m = meshCache.get(key);
  if (m) return m;
  const def = MODELS[kind];
  const swap = def.variants && def.variants[variant] ? def.variants[variant][1] : null;
  m = def.parts.map((p) => ({ part: p, mesh: partMesh(renderer, def, p, swap) }));
  meshCache.set(key, m);
  return m;
}
// pick a coat for a creature from a stable number (its id)
export function modelVariant(kind, seed) {
  const vs = MODELS[kind] && MODELS[kind].variants;
  if (!vs) return 0;
  let r = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < vs.length; i++) { r -= vs[i][0]; if (r < 0) return i; }
  return 0;
}

// ---------------------------------------------------------------- posing
// pose: { walk (phase), walkAmt (0..1), headYaw, headPitch, time, attack (0..1), flap, tail, dead (0..1), scale,
//         inflate, sheared, graze, flee, air, seed, baby, variant, swim }
const tmp = mat4(), base = mat4(), pm = mat4();
const GM = new Map(); // group name -> matrix, reused between draws

function emissiveOf(part, boost) {
  if (part.glowPart) return 0.9;
  return (part.skin === 'ember' || part.skin === 'ember_core' || part.skin === 'jelly_core' || part.skin === 'rune' || part.skin === 'crystal') ? 0.9 : boost;
}

// animation of one rig group (applied at its pivot, after its rest rotation)
function animateGroup(m, name, pose, walkSw, legSw) {
  const t = pose.time || 0, amt = pose.walkAmt || 0, seed = pose.seed || 0;
  const graze = pose.graze || 0;
  if (name === 'body') {
    // the body rises twice per stride and breathes when idle
    const bob = Math.abs(Math.sin(pose.walk || 0)) * 0.045 * amt;
    translate(m, m, 0, bob, 0);
    rotateZ(m, m, Math.sin(pose.walk || 0) * 0.03 * amt);
    if (pose.swim) rotateY(m, m, Math.sin(t * 7 + seed) * 0.12);
    const br = 1 + Math.sin(t * 2.1 + seed) * 0.012 * (1 - amt);
    scale(m, m, br, br, 1);
  } else if (name === 'neck') {
    rotateX(m, m, -0.95 * graze + Math.sin((pose.walk || 0) * 2) * 0.04 * amt + (pose.headPitch || 0) * 0.5);
    rotateY(m, m, (pose.headYaw || 0) * 0.5);
  } else if (name === 'head') {
    const neck = !!pose.hasNeck;
    rotateY(m, m, (pose.headYaw || 0) * (neck ? 0.5 : 1));
    rotateX(m, m, (pose.headPitch || 0) * (neck ? 0.5 : 1) - (neck ? 0.35 : 0.9) * graze + Math.sin(t * 13) * 0.05 * graze - Math.sin((pose.walk || 0) * 2) * 0.05 * amt);
    if (pose.baby) { const b = 1.3; scale(m, m, b, b, b); }
  } else if (name === 'earL' || name === 'earR') {
    const side = name === 'earL' ? 1 : -1;
    const twitch = Math.pow(Math.max(0, Math.sin(t * 0.83 + seed * 1.7 + side)), 40);
    rotateZ(m, m, side * twitch * 0.45);
    if (pose.flee) rotateX(m, m, 0.55);
  } else if (name === 'eyeL' || name === 'eyeR') {
    const ph = (t + seed * 0.37) % 4.1;
    if (ph < 0.13 || pose.dead) scale(m, m, 1, 0.12, 1);
  } else if (name === 'tail' || name === 'tail2' || name === 'tail3') {
    const d = name === 'tail' ? 0 : name === 'tail2' ? 1 : 2;
    const sp = pose.tailSpeed || 4;
    rotateY(m, m, Math.sin(t * sp - d * 0.9) * (pose.swim ? 0.5 : 0.28) * (1 + d * 0.2));
    if (d === 0) rotateX(m, m, (pose.flee ? 0.5 : 0) + (pose.tailUp || 0) + Math.sin((pose.walk || 0) * 2) * 0.08 * amt);
  } else if (name.startsWith('leg')) {
    // diagonal pairs move together (front-left with back-right); birds alternate L / R
    const a = name === 'legFL' || name === 'legBR' || name === 'legL' ? walkSw : -walkSw;
    let r = a * legSw;
    if (pose.air) r = name.startsWith('legF') ? -0.7 : name.startsWith('legB') ? 0.9 : r;
    if (pose.dead || pose.lying) r = 0;
    rotateX(m, m, r);
  } else if (name === 'wingL' || name === 'wingR') {
    const side = name === 'wingL' ? -1 : 1;
    const f = pose.flap ? Math.abs(Math.sin(t * 22)) * 1.2 : 0.05 + Math.max(0, Math.sin(t * 0.7 + seed)) ** 20 * 0.5;
    rotateZ(m, m, side * f);
  } else if (name === 'armL' || name === 'armR') {
    const side = name === 'armL' ? 1 : -1;
    rotateX(m, m, -walkSw * legSw * side * 0.9 + Math.sin(t * 1.3 + seed) * 0.03);
  } else if (name === 'finL' || name === 'finR') {
    rotateY(m, m, Math.sin(t * 6 + (name === 'finL' ? 0 : 1.5)) * 0.3);
  }
}

export function drawModel(r, kind, x, y, z, yaw, pose, light, overlay, emissiveBoost = 0) {
  const def = MODELS[kind];
  const meshes = modelMeshes(r, kind, pose.variant || 0);
  const sc = pose.scale || 1;
  identity(base);
  translate(base, base, x, y, z);
  rotateY(base, base, yaw);
  if (pose.dead) {
    const d = Math.min(1, pose.dead);
    rotateZ(base, base, d * Math.PI / 2);
    translate(base, base, 0, d * 0.25, 0);
  }
  if (pose.bob) translate(base, base, 0, pose.bob, 0);
  scale(base, base, sc, sc * (pose.squash || 1), sc);
  const walk = pose.walk || 0, amt = pose.walkAmt || 0;
  const sw = Math.sin(walk) * 0.75 * amt;
  const t = pose.time || 0;

  if (def.groups) {
    // rigged: build each group's matrix from its parent's
    pose.hasNeck = !!def.groups.neck;
    for (const [name, g] of Object.entries(def.groups)) {
      let m = GM.get(name);
      if (!m) { m = mat4(); GM.set(name, m); }
      const parent = g.parent ? def.groups[g.parent] : null;
      if (parent) {
        m.set(GM.get(g.parent));
        translate(m, m, (g.pivot[0] - parent.pivot[0]) / 16, (g.pivot[1] - parent.pivot[1]) / 16, (g.pivot[2] - parent.pivot[2]) / 16);
      } else {
        m.set(base);
        translate(m, m, g.pivot[0] / 16, g.pivot[1] / 16, g.pivot[2] / 16);
      }
      if (g.rot) { rotateY(m, m, g.rot[1]); rotateZ(m, m, g.rot[2]); rotateX(m, m, g.rot[0]); }
      animateGroup(m, name, pose, Math.sin(walk), 0.75 * amt);
    }
    for (const { part, mesh } of meshes) {
      if (part.antler && pose.noAntlers) continue;
      if (part.wool && pose.sheared) continue;
      if (part.shorn && !pose.sheared) continue;
      if (part.only && !part.only.includes(pose.variant || 0)) continue;
      const g = def.groups[part.group];
      const gm = GM.get(part.group);
      if (g && gm) {
        tmp.set(gm);
        const pv = part.pivot;
        if (pv !== g.pivot) translate(tmp, tmp, (pv[0] - g.pivot[0]) / 16, (pv[1] - g.pivot[1]) / 16, (pv[2] - g.pivot[2]) / 16);
      } else {
        const pv = part.pivot || [0, 0, 0];
        tmp.set(base);
        translate(tmp, tmp, pv[0] / 16, pv[1] / 16, pv[2] / 16);
      }
      if (part.rot) { rotateY(tmp, tmp, part.rot[1]); rotateZ(tmp, tmp, part.rot[2]); rotateX(tmp, tmp, part.rot[0]); }
      drawPart(r, part, mesh, tmp, light, overlay, emissiveOf(part, emissiveBoost));
    }
    return;
  }

  for (const { part, mesh } of meshes) {
    if (part.antler && pose.noAntlers) continue;
    if (part.wool && pose.sheared) continue;
    if (part.shorn && !pose.sheared) continue;
    const g = part.group || '';
    const pv = part.pivot || [0, 0, 0];
    identity(pm);
    translate(pm, pm, pv[0] / 16, pv[1] / 16, pv[2] / 16);
    if (g.startsWith('legA')) rotateX(pm, pm, sw);
    else if (g.startsWith('legB')) rotateX(pm, pm, -sw);
    else if (g === 'head') { rotateY(pm, pm, pose.headYaw || 0); rotateX(pm, pm, pose.headPitch || 0); if (pose.graze) rotateX(pm, pm, -0.9 * pose.graze); }
    else if (g === 'tail') { rotateY(pm, pm, Math.sin(t * (pose.tailSpeed || 4)) * 0.35); rotateX(pm, pm, pose.tailUp || 0); }
    else if (g === 'wingL') rotateZ(pm, pm, -(pose.flap ? Math.abs(Math.sin(t * 22)) * 1.1 : 0.05));
    else if (g === 'wingR') rotateZ(pm, pm, (pose.flap ? Math.abs(Math.sin(t * 22)) * 1.1 : 0.05));
    else if (g === 'armL' || g === 'armR') {
      const sgn = g === 'armL' ? 1 : -1;
      const reach = pose.reach || 0;
      rotateX(pm, pm, -sw * sgn * 0.8 - reach * 1.4 - (g === 'armR' ? (pose.attack || 0) * 1.6 : 0));
      if (pose.aim && g === 'armR') rotateX(pm, pm, -1.4);
      if (pose.aim && g === 'armL') rotateX(pm, pm, -1.3);
    } else if (g === 'cape') rotateX(pm, pm, 0.15 + amt * 0.5 + Math.sin(t * 3) * 0.05);
    else if (g === 'cap') { const inf = 1 + (pose.inflate || 0) * 0.35; scale(pm, pm, inf, inf, inf); }
    else if (g.startsWith('tent')) rotateX(pm, pm, Math.sin(t * 2 + Number(g.slice(4)) * 1.7) * 0.35);
    else if (g === 'body') { rotateY(pm, pm, pose.spin || 0); }
    else if (g === 'ring') { rotateY(pm, pm, t * 3); }
    else if (g.startsWith('orbit')) { const i = Number(g.slice(5)); rotateY(pm, pm, t * 2 + i * 2.1); translate(pm, pm, (part.offset[0]) / 16, Math.sin(t * 3 + i) * 0.1, 0); }
    else if (g.startsWith('sleg')) { const i = Number(g[4]); const side = g.endsWith('R') ? 1 : -1; rotateY(pm, pm, Math.sin(walk + i * 1.6) * 0.35 * amt * side); }
    if (part.rot) { rotateY(pm, pm, part.rot[1]); rotateZ(pm, pm, part.rot[2]); rotateX(pm, pm, part.rot[0]); }
    multiply(tmp, base, pm);
    drawPart(r, part, mesh, tmp, light, overlay, emissiveOf(part, emissiveBoost));
  }
}

function drawPart(r, part, mesh, m, light, overlay, em) {
  if (part.translucent) { r.gl.enable(r.gl.BLEND); r.gl.blendFunc(r.gl.SRC_ALPHA, r.gl.ONE_MINUS_SRC_ALPHA); }
  r.setGlowMask(1);
  r.drawMesh(mesh, m, light, overlay, em);
  r.setGlowMask(0);
  if (part.translucent) r.gl.disable(r.gl.BLEND);
}
