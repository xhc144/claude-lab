// Creature box models: parts in pixel units (16 = one block, forward = -Z), procedurally painted
// skins registered as extra texture layers, and a small pose/animation system.

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

const SKINS = {
  deer_fur: furPainter('#a8743e', { pattern: 'spots', accent: '#e8d4b0' }),
  deer_face: facePainter('#a8743e', { nose: '#2a1a12' }),
  antler: furPainter('#e6dcc2', { pattern: 'bone', dark: 0.85 }),
  sheep_wool: furPainter('#eef3fb', { pattern: 'wool', dark: 0.86, light: 1.04 }),
  sheep_face: facePainter('#7d88a6', { eyes: '#14121c', nose: '#4a5068' }),
  sheep_skin: furPainter('#c8b8a8', { dark: 0.9 }),
  horn_gold: furPainter('#d8b85a', { pattern: 'stripes' }),
  bird_body: furPainter('#f2c26a', { pattern: 'scales', light: 1.12 }),
  bird_face: facePainter('#f2c26a', { eyeY: 5, eyeGap: 4 }),
  beak: solidPainter('#e8862a'),
  boar_fur: furPainter('#5e3e2a', { pattern: 'fur', dark: 0.7 }),
  boar_face: facePainter('#5e3e2a', { eyeY: 4, eyes: '#e8c048' }),
  snout: solidPainter('#d8908a'),
  tusk: solidPainter('#f2ead8'),
  fox_fur: furPainter('#dfe6f2', { pattern: 'fur', glow: '#6ff0e0' }),
  fox_face: facePainter('#dfe6f2', { eyes: '#2ad8c8', eyeGlow: true, nose: '#2a3040', glowMarks: '#6ff0e0' }),
  fox_tail: furPainter('#c8e0f0', { light: 1.2, glow: '#8ff6ec' }),
  hare_fur: furPainter('#e6e4ea', { pattern: 'fur', dark: 0.82 }),
  hare_face: facePainter('#e6e4ea', { eyes: '#c83a4a', nose: '#e88a9a' }),
  fish_scales: furPainter('#9cc6de', { pattern: 'scales', light: 1.25 }),
  fish_face: facePainter('#9cc6de', { pattern: 'scales', eyeY: 5, eyeGap: 5 }),
  fin: solidPainter('#6a9ec8'),
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
const GLOWING_SKINS = new Set(['fox_fur', 'fox_face', 'fox_tail', 'jelly', 'jelly_core', 'gloom_face', 'bone_face', 'crystal', 'spider_face', 'ember', 'ember_core', 'warden_face', 'rune']);
export const SKIN = {};
for (const [k, fn] of Object.entries(SKINS)) SKIN[k] = registerTexture(`mob_${k}`, fn, { glow: GLOWING_SKINS.has(k) });

// ---------------------------------------------------------------- model definitions
// part: { box:[x0,y0,z0,x1,y1,z1], pivot:[x,y,z], skin: name | {front,back,top,bottom,side}, group, rot:[rx,ry,rz], color, fit, emissive }
const P = (box, skin, o = {}) => ({ box, skin, ...o });
const legs4 = (x, z0, z1, h, w, skin, groupA = 'legA', groupB = 'legB') => [
  P([-x - w / 2, 0, z0 - w / 2, -x + w / 2, h, z0 + w / 2], skin, { pivot: [-x, h, z0], group: groupA + 'FL' }),
  P([x - w / 2, 0, z0 - w / 2, x + w / 2, h, z0 + w / 2], skin, { pivot: [x, h, z0], group: groupB + 'FR' }),
  P([-x - w / 2, 0, z1 - w / 2, -x + w / 2, h, z1 + w / 2], skin, { pivot: [-x, h, z1], group: groupB + 'BL' }),
  P([x - w / 2, 0, z1 - w / 2, x + w / 2, h, z1 + w / 2], skin, { pivot: [x, h, z1], group: groupA + 'BR' }),
];

export const MODELS = {
  deer: {
    head: [0, 24, -10],
    parts: [
      P([-4, 11, -9, 4, 19, 8], 'deer_fur'),
      P([-2, 16, -12, 2, 25, -7], 'deer_fur', { group: 'head', pivot: [0, 18, -9] }),
      P([-2.5, 23, -16, 2.5, 28, -9], { front: 'deer_face', default: 'deer_fur' }, { group: 'head', fit: 'front' }),
      P([-1.5, 23, -18, 1.5, 26, -16], 'deer_fur', { group: 'head' }),
      P([-4.5, 26.5, -11, -2.5, 28, -10], 'deer_fur', { group: 'head' }),
      P([2.5, 26.5, -11, 4.5, 28, -10], 'deer_fur', { group: 'head' }),
      P([-2.5, 28, -11, -1.5, 33, -10], 'antler', { group: 'head', antler: true }),
      P([1.5, 28, -11, 2.5, 33, -10], 'antler', { group: 'head', antler: true }),
      P([-5, 31, -11, -2.5, 32, -10], 'antler', { group: 'head', antler: true }),
      P([2.5, 31, -11, 5, 32, -10], 'antler', { group: 'head', antler: true }),
      P([-1, 16, 8, 1, 19.5, 10], 'deer_fur', { group: 'tail', pivot: [0, 19, 8] }),
      ...legs4(2.5, -6.5, 5.5, 11, 2, 'deer_fur'),
    ],
  },
  sheep: {
    head: [0, 16, -7],
    parts: [
      P([-5, 8, -7, 5, 17, 7], 'sheep_wool', { wool: true }),
      P([-4, 9, -6, 4, 16, 6], 'sheep_skin', { shorn: true }),
      P([-3, 13, -12, 3, 19, -6], { front: 'sheep_face', default: 'sheep_face' }, { group: 'head', fit: 'all' }),
      P([-3.5, 18.5, -10, 3.5, 21, -6], 'sheep_wool', { group: 'head', wool: true }),
      P([-5.5, 16, -9, -3, 19, -7], 'horn_gold', { group: 'head' }),
      P([3, 16, -9, 5.5, 19, -7], 'horn_gold', { group: 'head' }),
      P([-5.5, 14, -10, -4, 16.5, -8], 'horn_gold', { group: 'head' }),
      P([4, 14, -10, 5.5, 16.5, -8], 'horn_gold', { group: 'head' }),
      ...legs4(3, -4.5, 4.5, 8, 2.5, 'sheep_skin'),
    ],
  },
  puffbird: {
    head: [0, 10, -2],
    parts: [
      P([-4, 3, -4, 4, 10, 4], 'bird_body'),
      P([-3, 8, -6, 3, 13.5, -1], { front: 'bird_face', default: 'bird_body' }, { group: 'head', fit: 'front' }),
      P([-1, 9, -8, 1, 11, -6], 'beak', { group: 'head' }),
      P([-0.5, 13.5, -4, 0.5, 16, -2], 'bird_body', { group: 'head' }),
      P([-5, 5, -3, -4, 9, 3], 'bird_body', { group: 'wingL', pivot: [-4, 9, 0] }),
      P([4, 5, -3, 5, 9, 3], 'bird_body', { group: 'wingR', pivot: [4, 9, 0] }),
      P([-2, 0, -1, -1, 3, 0], 'beak', { group: 'legAFL', pivot: [-1.5, 3, -0.5] }),
      P([1, 0, -1, 2, 3, 0], 'beak', { group: 'legBFR', pivot: [1.5, 3, -0.5] }),
      P([-2.5, 7, 4, 2.5, 11, 6], 'bird_body', { group: 'tail', pivot: [0, 9, 4] }),
    ],
  },
  boar: {
    head: [0, 12, -9],
    parts: [
      P([-5, 7, -9, 5, 16, 9], 'boar_fur'),
      P([-1, 16, -8, 1, 18, 6], 'boar_fur'),
      P([-4, 8, -15, 4, 15, -8], { front: 'boar_face', default: 'boar_fur' }, { group: 'head', fit: 'front' }),
      P([-2, 8, -17, 2, 11, -15], 'snout', { group: 'head' }),
      P([-3, 10, -17, -2, 13.5, -16], 'tusk', { group: 'head' }),
      P([2, 10, -17, 3, 13.5, -16], 'tusk', { group: 'head' }),
      P([-0.5, 12, 9, 0.5, 15, 10], 'boar_fur', { group: 'tail', pivot: [0, 14, 9] }),
      ...legs4(3, -6, 6, 7, 3, 'boar_fur'),
    ],
  },
  fox: {
    head: [0, 10, -7],
    parts: [
      P([-3, 6, -7, 3, 12, 6], 'fox_fur'),
      P([-3, 8, -12, 3, 13, -7], { front: 'fox_face', default: 'fox_fur' }, { group: 'head', fit: 'front' }),
      P([-1.5, 8, -14, 1.5, 10.5, -12], 'fox_fur', { group: 'head' }),
      P([-3, 13, -10, -1, 16.5, -9], 'fox_fur', { group: 'head' }),
      P([1, 13, -10, 3, 16.5, -9], 'fox_fur', { group: 'head' }),
      P([-2, 7, 6, 2, 11, 15], 'fox_tail', { group: 'tail', pivot: [0, 10, 6] }),
      ...legs4(2, -5, 4.5, 6, 2, 'fox_fur'),
    ],
  },
  hare: {
    head: [0, 6, -3],
    parts: [
      P([-2.5, 2, -4, 2.5, 7, 4], 'hare_fur'),
      P([-2, 5, -7, 2, 9, -3], { front: 'hare_face', default: 'hare_fur' }, { group: 'head', fit: 'front' }),
      P([-2, 9, -5, -1, 15, -4], 'hare_fur', { group: 'head' }),
      P([1, 9, -5, 2, 15, -4], 'hare_fur', { group: 'head' }),
      P([-1, 4, 4, 1, 6, 6], 'hare_fur'),
      ...legs4(1.5, -3, 3, 2, 1.5, 'hare_fur'),
    ],
  },
  fish: {
    head: [0, 2, -3],
    parts: [
      P([-1, 0, -4, 1, 4, 4], { front: 'fish_face', default: 'fish_scales' }, { fit: 'front' }),
      P([-0.25, 0, 4, 0.25, 4, 7.5], 'fin', { group: 'tail', pivot: [0, 2, 4] }),
      P([-0.25, 4, -1, 0.25, 6, 2], 'fin'),
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

function partMesh(renderer, part) {
  const mb = new MeshBuilder();
  const [x0, y0, z0, x1, y1, z1] = part.box;
  const pv = part.pivot || [0, 0, 0];
  const s = 1 / 16;
  const bx0 = (x0 - pv[0]) * s, by0 = (y0 - pv[1]) * s, bz0 = (z0 - pv[2]) * s;
  const bx1 = (x1 - pv[0]) * s, by1 = (y1 - pv[1]) * s, bz1 = (z1 - pv[2]) * s;
  const dims = [[z1 - z0, y1 - y0], [z1 - z0, y1 - y0], [x1 - x0, z1 - z0], [x1 - x0, z1 - z0], [x1 - x0, y1 - y0], [x1 - x0, y1 - y0]];
  const faces = [];
  const cols = [];
  for (let f = 0; f < 6; f++) {
    let skin = part.skin;
    if (skin && typeof skin === 'object') skin = skin[FACE_KEYS[f]] || skin.default;
    if (!skin) { faces.push(null); cols.push(part.color || [1, 1, 1, 1]); continue; }
    const alpha = part.translucent ? 0.62 : 1;
    const layer = SKIN[skin] !== undefined ? SKIN[skin] : texLayer(`mob_${skin}`);
    const fit = part.fit === 'all' || (part.fit === 'front' && f === 5);
    const [w, hgt] = dims[f];
    const u1 = fit ? 1 : w / 16, v1 = fit ? 1 : hgt / 16;
    const o = fit ? 0 : ((x0 * 7 + y0 * 3 + f * 5) % 16) / 16;
    faces.push({ layer, uv: [[o, o + v1], [o + u1, o + v1], [o + u1, o], [o, o]] });
    cols.push([1, 1, 1, alpha]);
  }
  mb.box(bx0, by0, bz0, bx1, by1, bz1, cols, faces);
  return mb.build(renderer);
}

const meshCache = new Map();
export function modelMeshes(renderer, kind) {
  let m = meshCache.get(kind);
  if (m) return m;
  const def = MODELS[kind];
  m = def.parts.map((p) => ({ part: p, mesh: partMesh(renderer, p) }));
  meshCache.set(kind, m);
  return m;
}

// ---------------------------------------------------------------- posing
// pose: { walk (phase), walkAmt (0..1), headYaw, headPitch, time, attack (0..1), flap, tail, dead (0..1), scale, inflate, sheared, lying }
const tmp = mat4(), base = mat4(), pm = mat4();
export function drawModel(r, kind, x, y, z, yaw, pose, light, overlay, emissiveBoost = 0) {
  const meshes = modelMeshes(r, kind);
  const def = MODELS[kind];
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
    const em = (part.skin === 'ember' || part.skin === 'ember_core' || part.skin === 'jelly_core' || part.skin === 'rune' || part.skin === 'crystal') ? 0.9 : emissiveBoost;
    if (part.translucent) { r.gl.enable(r.gl.BLEND); r.gl.blendFunc(r.gl.SRC_ALPHA, r.gl.ONE_MINUS_SRC_ALPHA); }
    r.setGlowMask(1);
    r.drawMesh(mesh, tmp, light, overlay, em);
    r.setGlowMask(0);
    if (part.translucent) r.gl.disable(r.gl.BLEND);
  }
  void def;
}
