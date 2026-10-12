// Block models: every block state compiles to a list of quads (positions in 1/16 block units,
// texture layer, normal, culling face, shading mode). The mesher, the selection outline, the
// collision code and the 2D icon renderer all read from here.
//
// Metadata conventions (6 bits):
//   axis:     0 y, 1 x, 2 z                       (logs, pillars, thatch)
//   facing4:  0 north(-Z) 1 west(-X) 2 south(+Z) 3 east(+X)   [+4 = state bit, e.g. lit furnace]
//   facing6:  face index 0 +X 1 -X 2 +Y 3 -Y 4 +Z 5 -Z         [+8 = powered/extended]
//   slab:     0 bottom 1 top 2 double
//   stairs:   facing4 | upside<<2
//   door:     facing4 | open<<2 | upper<<3 | hinge<<4
//   trapdoor: facing4 | open<<2 | top<<3
//   torch:    0 floor, 1..4 wall facing4+1 (attached to the block behind)   [+8 = off for inverters]
//   attach:   face index of the block it hangs on (0..5) | powered<<3        (lever, button)
//   wire:     power 0..15
//   repeater: facing4 | (delay-1)<<2 | powered<<4
//   rail:     shape 0..9 | powered<<4
//   liquid:   level 0..7 (0 = source) | falling<<3
//   crop:     stage 0..7
//   layer:    height-1 (0..7)
//   vines:    bit per side attached (n w s e)
//   lamp/observer/sensor/pedestal/waystone: bit 0 = on

import {
  BLOCKS, B, FACE_DX, FACE_DY, FACE_DZ, ID_BITS, ID_MASK, texLayer, OPAQUE,
} from './blocks.js';

export const SHADE_AO = 1;      // smooth light + AO from the neighbourhood (face on block boundary)
export const SHADE_FLAT = 0;    // uses the block's own cell light

export const F_SWAY = 1, F_EMISSIVE = 2, F_SCROLL = 4, F_WATER = 8, F_LAVA = 16, F_TINTPOWER = 32;

// ---- quad construction --------------------------------------------------------------------
// corner order per face: BL BR TR TL (counter-clockwise seen from outside)
function faceVerts(f, x0, y0, z0, x1, y1, z1) {
  switch (f) {
    case 0: return [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1];
    case 1: return [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0];
    case 2: return [x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0];
    case 3: return [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1];
    case 4: return [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
    default: return [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0];
  }
}
// automatic UVs (u right, v down), in texels
function faceUV(f, x0, y0, z0, x1, y1, z1) {
  switch (f) {
    case 0: return [16 - z1, 16 - y0, 16 - z0, 16 - y0, 16 - z0, 16 - y1, 16 - z1, 16 - y1];
    case 1: return [z0, 16 - y0, z1, 16 - y0, z1, 16 - y1, z0, 16 - y1];
    case 2: return [x0, z1, x1, z1, x1, z0, x0, z0];
    case 3: return [x0, 16 - z0, x1, 16 - z0, x1, 16 - z1, x0, 16 - z1];
    case 4: return [x0, 16 - y0, x1, 16 - y0, x1, 16 - y1, x0, 16 - y1];
    default: return [16 - x1, 16 - y0, 16 - x0, 16 - y0, 16 - x0, 16 - y1, 16 - x1, 16 - y1];
  }
}

const BOUNDARY = (f, x0, y0, z0, x1, y1, z1) => (
  f === 0 ? x1 === 16 : f === 1 ? x0 === 0 : f === 2 ? y1 === 16 : f === 3 ? y0 === 0 : f === 4 ? z1 === 16 : z0 === 0
);
const FULLFACE = (f, x0, y0, z0, x1, y1, z1) => (
  f < 2 ? (y0 === 0 && y1 === 16 && z0 === 0 && z1 === 16)
    : f < 4 ? (x0 === 0 && x1 === 16 && z0 === 0 && z1 === 16)
      : (x0 === 0 && x1 === 16 && y0 === 0 && y1 === 16)
);

// tex: layer | [6 layers or null]; opts: { flags, uv:{face:[u0,v0,u1,v1]}, noCull, inset }
export function box(x0, y0, z0, x1, y1, z1, tex, opts = {}) {
  const quads = [];
  for (let f = 0; f < 6; f++) {
    const t = Array.isArray(tex) ? tex[f] : tex;
    if (t === null || t === undefined || t < 0) continue;
    const pos = faceVerts(f, x0, y0, z0, x1, y1, z1);
    let uv = faceUV(f, x0, y0, z0, x1, y1, z1);
    const cu = opts.uv && opts.uv[f];
    if (cu) uv = [cu[0], cu[3], cu[2], cu[3], cu[2], cu[1], cu[0], cu[1]];
    const onEdge = BOUNDARY(f, x0, y0, z0, x1, y1, z1);
    quads.push({
      pos, uv, tex: t, face: f,
      cull: onEdge && !opts.noCull ? f : -1,
      full: onEdge && FULLFACE(f, x0, y0, z0, x1, y1, z1),
      shade: onEdge ? SHADE_AO : SHADE_FLAT,
      flags: opts.flags || 0,
    });
  }
  return quads;
}

// A free quad given 4 corners (BL BR TR TL) with full-texture UVs.
function quad(p, tex, face, flags = 0, uv = [0, 16, 16, 16, 16, 0, 0, 0]) {
  return { pos: p, uv, tex, face, cull: -1, full: false, shade: SHADE_FLAT, flags };
}
function doubleSided(q) {
  // the back side: BL'=BR, BR'=BL, TR'=TL, TL'=TR
  const p = q.pos, u = q.uv;
  const back = {
    ...q,
    pos: [p[3], p[4], p[5], p[0], p[1], p[2], p[9], p[10], p[11], p[6], p[7], p[8]],
    uv: [u[2], u[3], u[0], u[1], u[6], u[7], u[4], u[5]],
    face: q.face < 6 ? (q.face ^ 1) : q.face,
  };
  return [q, back];
}

function cross(tex, flags, inset = 1.2, h = 16) {
  const a = inset, b = 16 - inset;
  return [
    ...doubleSided(quad([a, 0, a, b, 0, b, b, h, b, a, h, a], tex, 6, flags)),
    ...doubleSided(quad([a, 0, b, b, 0, a, b, h, a, a, h, b], tex, 6, flags)),
  ];
}

function hashPlanes(tex, flags, h = 16) {
  const q = [];
  for (const o of [4, 12]) {
    q.push(...doubleSided(quad([0, 0, o, 16, 0, o, 16, h, o, 0, h, o], tex, 6, flags)));
    q.push(...doubleSided(quad([o, 0, 16, o, 0, 0, o, h, 0, o, h, 16], tex, 6, flags)));
  }
  return q;
}

// ---- rotations ----------------------------------------------------------------------------
const ROTY_FACE = [5, 4, 2, 3, 0, 1]; // face mapping for one 90° yaw step (+X -> -Z -> -X -> +Z)
function rotYPoint(x, z, k) {
  for (let i = 0; i < k; i++) { const nx = z; z = 16 - x; x = nx; }
  return [x, z];
}
export function rotateY(quads, k) {
  k = ((k % 4) + 4) % 4;
  if (!k) return quads;
  return quads.map((q) => {
    const p = q.pos.slice();
    for (let i = 0; i < 12; i += 3) {
      const [x, z] = rotYPoint(p[i], p[i + 2], k);
      p[i] = x; p[i + 2] = z;
    }
    let f = q.face, c = q.cull;
    for (let i = 0; i < k; i++) {
      if (f < 6) f = ROTY_FACE[f];
      if (c >= 0) c = ROTY_FACE[c];
    }
    return { ...q, pos: p, face: f, cull: c };
  });
}

// Rotate a model authored pointing +Y so that it points toward face `to`.
const ROT6 = {
  2: (x, y, z) => [x, y, z],
  3: (x, y, z) => [x, 16 - y, 16 - z],
  0: (x, y, z) => [y, 16 - x, z],
  1: (x, y, z) => [16 - y, x, z],
  4: (x, y, z) => [x, 16 - z, y],
  5: (x, y, z) => [x, z, 16 - y],
};
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function normalToFace(n) {
  for (let f = 0; f < 6; f++) {
    const m = NORMALS[f];
    if (Math.abs(m[0] - n[0]) < 0.01 && Math.abs(m[1] - n[1]) < 0.01 && Math.abs(m[2] - n[2]) < 0.01) return f;
  }
  return 6;
}
export function rotate6(quads, to) {
  if (to === 2) return quads;
  const r = ROT6[to];
  const rf = (f) => {
    if (f < 0 || f > 5) return f;
    const n = NORMALS[f];
    const a = r(8 + n[0] * 8, 8 + n[1] * 8, 8 + n[2] * 8);
    return normalToFace([(a[0] - 8) / 8, (a[1] - 8) / 8, (a[2] - 8) / 8]);
  };
  return quads.map((q) => {
    const p = q.pos.slice();
    for (let i = 0; i < 12; i += 3) {
      const v = r(p[i], p[i + 1], p[i + 2]);
      p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2];
    }
    return { ...q, pos: p, face: rf(q.face), cull: rf(q.cull) };
  });
}

// ---- per-shape builders --------------------------------------------------------------------
const T = (name) => texLayer(name);

function cubeFacesFor(d, meta) {
  let faces = d.faces;
  if (d.facesAlt) {
    const on = d.name === 'furnace' ? (meta & 4) : d.orient === 'facing6' ? (meta & 8) : (meta & 1);
    if (on) faces = d.facesAlt;
  }
  return faces;
}

function buildCube(d, meta) {
  const faces = cubeFacesFor(d, meta);
  if (d.orient === 'facing4') {
    // authored with the front on north (-Z); rotate by facing
    return rotateY(box(0, 0, 0, 16, 16, 16, faces), meta & 3);
  }
  if (d.orient === 'facing6') {
    // authored with the front (top texture) on +Y
    const q = box(0, 0, 0, 16, 16, 16, [faces[0], faces[1], faces[2], faces[3], faces[4], faces[5]]);
    return rotate6(q, meta & 7);
  }
  if (d.orient === 'axis' && (meta & 3)) {
    const q = box(0, 0, 0, 16, 16, 16, faces);
    return rotate6(q, (meta & 3) === 1 ? 0 : 4);
  }
  let flags = EMISSIVE_CUBES.has(d.name) ? F_EMISSIVE : 0;
  if (d.name === 'crystal_lamp' && (meta & 1)) flags = F_EMISSIVE;
  return box(0, 0, 0, 16, 16, 16, faces, { flags });
}
const EMISSIVE_CUBES = new Set(['lamp_stone', 'ancient_lamp', 'star_core', 'glowcap', 'ambercap', 'lantern_melon', 'power_block', 'echo_block', 'levistone', 'stargem_block']);

const SHAPES = {
  none: () => [],
  cube: buildCube,
  cross(d, meta) {
    const flags = (SWAYING.has(d.name) ? F_SWAY : 0) | (d.light ? F_EMISSIVE : 0);
    let tex = d.faces[0];
    if (d.facesAlt && (meta & 1)) tex = d.facesAlt[0];
    if (d.name === 'crystal_cluster' || d.name === 'crystal_bud') return rotate6(cross(tex, flags, 1.5, d.name === 'crystal_bud' ? 9 : 14), meta & 7);
    return cross(tex, flags, d.name === 'tall_grass' || d.name === 'fern' ? 0.5 : 1.8);
  },
  crop(d, meta) {
    const stages = d.crop.stages;
    const st = Math.min(stages - 1, Math.floor((meta & 7) * stages / 8));
    const names = [d.faces[0], ...d.extraTex.map(T)];
    return hashPlanes(names[st], F_SWAY, 16).map((q) => ({ ...q, pos: q.pos.map((v, i) => (i % 3 === 1 ? v - 1 : v)) }));
  },
  layer(d, meta) { return box(0, 0, 0, 16, ((meta & 7) + 1) * 2, 16, d.faces[0]); },
  slab(d, meta) {
    if ((meta & 3) === 2) return box(0, 0, 0, 16, 16, 16, d.faces);
    return (meta & 3) === 1 ? box(0, 8, 0, 16, 16, 16, d.faces) : box(0, 0, 0, 16, 8, 16, d.faces);
  },
  stairs(d, meta) {
    const up = meta & 4;
    let q = up ? box(0, 8, 0, 16, 16, 16, d.faces) : box(0, 0, 0, 16, 8, 16, d.faces);
    // the step: authored facing north = tall part on the north (-Z) half, open side toward the player (south)
    q = q.concat(rotateY(up ? box(0, 0, 0, 16, 8, 8, d.faces) : box(0, 8, 0, 16, 16, 8, d.faces), meta & 3));
    return q;
  },
  fence(d, meta, conn) {
    const t = d.faces[0];
    if (d.wall) {
      const q = box(4, 0, 4, 12, 16, 12, t);
      if (conn & 1) q.push(...box(5, 0, 0, 11, 13, 4, t));
      if (conn & 2) q.push(...box(0, 0, 5, 4, 13, 11, t));
      if (conn & 4) q.push(...box(5, 0, 12, 11, 13, 16, t));
      if (conn & 8) q.push(...box(12, 0, 5, 16, 13, 11, t));
      return q;
    }
    const q = box(6, 0, 6, 10, 16, 10, t);
    for (const [bit, x0, z0, x1, z1] of [[1, 7, 0, 9, 6], [2, 0, 7, 6, 9], [4, 7, 10, 9, 16], [8, 10, 7, 16, 9]]) {
      if (conn & bit) { q.push(...box(x0, 12, z0, x1, 15, z1, t)); q.push(...box(x0, 6, z0, x1, 9, z1, t)); }
    }
    return q;
  },
  gate(d, meta) {
    const t = d.faces[0];
    const open = meta & 4;
    let q = [...box(0, 5, 7, 2, 16, 9, t), ...box(14, 5, 7, 16, 16, 9, t)];
    if (!open) {
      q.push(...box(2, 6, 7, 14, 9, 9, t), ...box(2, 12, 7, 14, 15, 9, t), ...box(6, 9, 7, 10, 12, 9, t));
    } else {
      q.push(...box(0, 6, 9, 2, 9, 15, t), ...box(0, 12, 9, 2, 15, 15, t), ...box(14, 6, 9, 16, 9, 15, t), ...box(14, 12, 9, 16, 15, 15, t));
    }
    return rotateY(q, meta & 3);
  },
  door(d, meta) {
    const upper = meta & 8, open = meta & 4, hinge = (meta >> 4) & 1;
    const tex = upper ? T(d.extraTex[0]) : d.faces[0];
    const frame = T(d.name === 'iron_door' ? 'iron_block' : 'oak_planks');
    // closed door authored facing north: slab on the south edge of the cell
    let q = box(0, 0, 13, 16, 16, 16, [frame, frame, upper ? frame : -1, upper ? -1 : frame, tex, tex], { uv: { 5: [16, 0, 0, 16] } });
    let k = meta & 3;
    if (open) k += hinge ? 3 : 1;
    q = rotateY(q, k);
    return q;
  },
  trapdoor(d, meta) {
    const t = d.faces[0];
    const open = meta & 4, top = meta & 8;
    if (!open) return top ? box(0, 13, 0, 16, 16, 16, t) : box(0, 0, 0, 16, 3, 16, t);
    return rotateY(box(0, 0, 13, 16, 16, 16, t), meta & 3);
  },
  wallflat(d, meta) {
    // ladder: authored against the north wall of the cell; meta = facing4 toward the supporting wall
    const q = doubleSided(quad([0, 0, 0.8, 16, 0, 0.8, 16, 16, 0.8, 0, 16, 0.8], d.faces[0], 4));
    return rotateY(q, meta & 3);
  },
  torch(d, meta) {
    const off = d.name === 'inverter' && (meta & 8);
    const tex = d.name === 'inverter' ? T(off ? 'inverter_off' : 'inverter_on') : d.faces[0];
    const flags = off ? 0 : F_EMISSIVE;
    const uv = { 0: [7, 6, 9, 16], 1: [7, 6, 9, 16], 4: [7, 6, 9, 16], 5: [7, 6, 9, 16], 2: [7, 6, 9, 8], 3: [7, 14, 9, 16] };
    let q = box(7, 0, 7, 9, 10, 9, tex, { uv, flags, noCull: true });
    const att = meta & 7;
    if (att >= 1 && att <= 4) {
      // lean against the wall behind: shift toward the attached side and raise
      const dir = att - 1; // facing4 of the wall the torch is attached to
      const shift = [[0, -5], [-5, 0], [0, 5], [5, 0]][dir];
      q = q.map((qq) => {
        const p = qq.pos.slice();
        for (let i = 0; i < 12; i += 3) {
          const h = p[i + 1] / 10;
          p[i] += shift[0] * (1 - h * 0.45);
          p[i + 2] += shift[1] * (1 - h * 0.45);
          p[i + 1] += 3.5;
        }
        return { ...qq, pos: p };
      });
    }
    return q;
  },
  lantern(d, meta) {
    const t = d.faces[0];
    const hang = meta & 1;
    const y = hang ? 3 : 0;
    const uvSide = { 0: [5, 7, 11, 16], 1: [5, 7, 11, 16], 4: [5, 7, 11, 16], 5: [5, 7, 11, 16], 2: [5, 0, 11, 6], 3: [5, 0, 11, 6] };
    const q = box(5, y, 5, 11, y + 9, 11, t, { uv: uvSide, flags: F_EMISSIVE, noCull: true });
    q.push(...box(6, y + 9, 6, 10, y + 11, 10, t, { uv: { 0: [6, 2, 10, 4], 1: [6, 2, 10, 4], 4: [6, 2, 10, 4], 5: [6, 2, 10, 4], 2: [6, 0, 10, 4], 3: [6, 0, 10, 4] }, noCull: true }));
    if (hang) q.push(...cross(T('lantern'), 0, 7.4, 4).map((qq) => ({ ...qq, pos: qq.pos.map((v, i) => (i % 3 === 1 ? v + 12 : v)), uv: [11, 6, 13, 6, 13, 2, 11, 2] })));
    return q;
  },
  campfire(d, meta) {
    const log = d.faces[0];
    const lit = !(meta & 8);
    const q = [
      ...box(1, 0, 3, 15, 4, 7, log), ...box(1, 0, 9, 15, 4, 13, log),
      ...box(3, 3, 1, 7, 7, 15, log), ...box(9, 3, 1, 13, 7, 15, log),
    ];
    if (lit) q.push(...cross(T('fire'), F_EMISSIVE | F_SWAY, 3, 14).map((qq) => ({ ...qq, pos: qq.pos.map((v, i) => (i % 3 === 1 ? v + 1 : v)) })));
    return q;
  },
  fire() {
    const t = T('fire');
    const q = cross(t, F_EMISSIVE, 1, 16);
    for (let k = 0; k < 4; k++) q.push(...rotateY(doubleSided(quad([16, 0, 1, 0, 0, 1, 0, 16, 3, 16, 16, 3], t, 6, F_EMISSIVE)), k));
    return q;
  },
  carpet(d) { return box(0, 0, 0, 16, 1, 16, d.faces[0]); },
  pot(d) {
    const t = d.faces[0];
    return [...box(5, 0, 5, 11, 6, 11, t, { uv: { 0: [5, 10, 11, 16], 1: [5, 10, 11, 16], 4: [5, 10, 11, 16], 5: [5, 10, 11, 16] } })];
  },
  chest(d, meta) { return rotateY(box(1, 0, 1, 15, 14, 15, d.faces), meta & 3); },
  bed(d, meta) {
    const top = d.faces[0], side = T('bed_side');
    return rotateY(box(0, 0, 0, 16, 7, 16, [side, side, top, T('oak_planks'), side, side]), meta & 3);
  },
  cauldron(d, meta) {
    const t = d.faces[0];
    const q = [
      ...box(0, 3, 0, 16, 16, 2, t), ...box(0, 3, 14, 16, 16, 16, t),
      ...box(0, 3, 2, 2, 16, 14, t), ...box(14, 3, 2, 16, 16, 14, t),
      ...box(0, 0, 0, 4, 3, 4, t), ...box(12, 0, 0, 16, 3, 4, t), ...box(0, 0, 12, 4, 3, 16, t), ...box(12, 0, 12, 16, 3, 16, t),
      ...box(2, 3, 2, 14, 4, 14, t),
    ];
    const level = meta & 3;
    if (level) {
      const h = 4 + level * 3.5;
      q.push({ pos: [2, h, 14, 14, h, 14, 14, h, 2, 2, h, 2], uv: [2, 14, 14, 14, 14, 2, 2, 2], tex: T('water_still'), face: 2, cull: -1, full: false, shade: SHADE_FLAT, flags: F_WATER, translucent: true });
    }
    return q;
  },
  wire(d, meta, conn) {
    // conn bits: 1 north, 2 west, 4 south, 8 east, 16.. up variants (n w s e) at 16,32,64,128
    const t = d.faces[0];
    const y = 0.25;
    const q = [];
    const flags = F_TINTPOWER;
    const horiz = conn & 15;
    const seg = (x0, z0, x1, z1, uv) => q.push({ pos: [x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0], uv, tex: t, face: 2, cull: -1, full: false, shade: SHADE_FLAT, flags });
    if (!horiz || (horiz !== 5 && horiz !== 10)) seg(5, 5, 11, 11, [5, 11, 11, 11, 11, 5, 5, 5]);
    if (horiz === 5 || horiz === 10) {
      if (horiz === 5) seg(5, 0, 11, 16, [5, 16, 11, 16, 11, 0, 5, 0]);
      else seg(0, 5, 16, 11, [0, 11, 16, 11, 16, 5, 0, 5]);
    } else {
      if (conn & 1) seg(5, 0, 11, 5, [5, 5, 11, 5, 11, 0, 5, 0]);
      if (conn & 4) seg(5, 11, 11, 16, [5, 16, 11, 16, 11, 11, 5, 11]);
      if (conn & 2) seg(0, 5, 5, 11, [0, 11, 5, 11, 5, 5, 0, 5]);
      if (conn & 8) seg(11, 5, 16, 11, [11, 11, 16, 11, 16, 5, 11, 5]);
    }
    // climbing segments on the side faces of neighbouring blocks
    const ups = [[16, 1], [32, 2], [64, 4], [128, 8]];
    for (const [bit] of ups) {
      if (!(conn & bit)) continue;
      const k = bit === 16 ? 0 : bit === 32 ? 1 : bit === 64 ? 2 : 3; // facing4 order n w s e
      const base = [{ pos: [5, 0, 0.25, 11, 0, 0.25, 11, 16, 0.25, 5, 16, 0.25], uv: [5, 16, 11, 16, 11, 0, 5, 0], tex: t, face: 4, cull: -1, full: false, shade: SHADE_FLAT, flags }];
      q.push(...rotateY(base, k));
    }
    return q;
  },
  lever(d, meta) {
    const base = T('cobblestone');
    const on = meta & 8;
    let q = box(5, 0, 4, 11, 3, 12, base, { noCull: true });
    // stick: thin box tilted toward ±z
    const s = box(7, 1, 7, 9, 10, 9, d.faces[0], { noCull: true, uv: { 0: [7, 6, 9, 16], 1: [7, 6, 9, 16], 4: [7, 6, 9, 16], 5: [7, 6, 9, 16], 2: [7, 6, 9, 8], 3: [7, 6, 9, 8] } });
    const a = on ? -0.7 : 0.7;
    q = q.concat(s.map((qq) => {
      const p = qq.pos.slice();
      for (let i = 0; i < 12; i += 3) {
        const y = p[i + 1] - 1, z = p[i + 2] - 8;
        p[i + 1] = 1 + y * Math.cos(a) - z * Math.sin(a);
        p[i + 2] = 8 + y * Math.sin(a) + z * Math.cos(a);
      }
      return { ...qq, pos: p };
    }));
    return attachRotate(q, meta & 7);
  },
  button(d, meta) {
    const h = (meta & 8) ? 1 : 2;
    return attachRotate(box(5, 0, 6, 11, h, 10, d.faces[0], { noCull: true }), meta & 7);
  },
  plate(d, meta) { return box(1, 0, 1, 15, (meta & 1) ? 0.5 : 1, 15, d.faces[0]); },
  plate_thick(d) { return box(0, 0, 0, 16, 4, 16, d.faces); },
  sensor(d) { return box(0, 0, 0, 16, 6, 16, d.faces); },
  repeater(d, meta) {
    const on = meta & 16;
    const top = on ? T('repeater_on') : d.faces[0];
    const slab = T('polished_stone');
    let q = box(0, 0, 0, 16, 2, 16, [slab, slab, top, slab, slab, slab]);
    const delay = (meta >> 2) & 3;
    const tt = T(on ? 'inverter_on' : 'inverter_off');
    const uv = { 0: [7, 10, 9, 16], 1: [7, 10, 9, 16], 4: [7, 10, 9, 16], 5: [7, 10, 9, 16], 2: [7, 6, 9, 8] };
    q.push(...box(7, 2, 2, 9, 7, 4, tt, { uv, noCull: true, flags: on ? F_EMISSIVE : 0 }));
    const z = 6 + delay * 2;
    q.push(...box(7, 2, z, 9, 7, z + 2, tt, { uv, noCull: true, flags: on ? F_EMISSIVE : 0 }));
    // authored pointing north (output toward -Z)
    return rotateY(q, meta & 3);
  },
  piston(d, meta) {
    const ext = meta & 8;
    const faces = d.faces;
    if (!ext) return rotate6(box(0, 0, 0, 16, 16, 16, faces), meta & 7);
    const inner = T('piston_inner');
    const q = box(0, 0, 0, 16, 12, 16, [faces[0], faces[1], inner, faces[3], faces[4], faces[5]], { uv: { 0: [0, 4, 16, 16], 1: [0, 4, 16, 16], 4: [0, 4, 16, 16], 5: [0, 4, 16, 16] } });
    return rotate6(q, meta & 7);
  },
  piston_head(d, meta) {
    const sticky = meta & 8;
    const face = sticky ? T('piston_top_sticky') : d.faces[0];
    const side = T('piston_side');
    const q = box(0, 12, 0, 16, 16, 16, [side, side, face, face, side, side], { uv: { 0: [0, 0, 16, 4], 1: [0, 0, 16, 4], 4: [0, 0, 16, 4], 5: [0, 0, 16, 4] } });
    q.push(...box(6, -4, 6, 10, 12, 10, side, { uv: { 0: [0, 0, 16, 4], 1: [0, 0, 16, 4], 4: [0, 0, 16, 4], 5: [0, 0, 16, 4] }, noCull: true }));
    return rotate6(q, meta & 7);
  },
  conveyor(d, meta) {
    const t = d.faces[0];
    const side = T('conveyor_side');
    const q = box(0, 0, 0, 16, 4, 16, [side, side, t, side, side, side]);
    for (const qq of q) if (qq.face === 2) qq.flags |= F_SCROLL;
    return rotateY(q, meta & 3);
  },
  hopper(d) {
    const t = d.faces[0], inside = T('hopper_inside');
    return [
      ...box(0, 10, 0, 16, 16, 16, [t, t, inside, t, t, t]),
      ...box(4, 4, 4, 12, 10, 12, t),
      ...box(6, 0, 6, 10, 4, 10, t),
    ];
  },
  rail(d, meta) {
    const shape = meta & 15;
    const powered = meta & 16;
    let tex = d.faces[0];
    if (d.name === 'power_rail' && powered) tex = T('power_rail_on');
    const flags = d.name === 'power_rail' && powered ? F_EMISSIVE : 0;
    const y = 1;
    const flat = (k, tx) => rotateY([{ pos: [0, y, 16, 16, y, 16, 16, y, 0, 0, y, 0], uv: [0, 16, 16, 16, 16, 0, 0, 0], tex: tx, face: 2, cull: -1, full: false, shade: SHADE_FLAT, flags }], k);
    if (shape === 0) return flat(0, tex);
    if (shape === 1) return flat(1, tex);
    if (shape >= 2 && shape <= 5) {
      // ascending toward east, west, north, south
      const k = shape === 2 ? 3 : shape === 3 ? 1 : shape === 4 ? 0 : 2;
      // authored ascending north: high edge at z=0
      const q = [{ pos: [0, y, 16, 16, y, 16, 16, 16 + y, 0, 0, 16 + y, 0], uv: [0, 16, 16, 16, 16, 0, 0, 0], tex, face: 2, cull: -1, full: false, shade: SHADE_FLAT, flags }];
      return rotateY(q, k);
    }
    // curves 6..9: SE, SW, NW, NE (connecting south+east etc.)
    const ct = T('rail_curve');
    const k = shape === 6 ? 0 : shape === 7 ? 1 : shape === 8 ? 2 : 3;
    return flat(k, ct);
  },
  vine(d, meta) {
    const q = [];
    const t = d.faces[0];
    for (let k = 0; k < 4; k++) {
      if (!(meta & (1 << k))) continue;
      // authored attached to the north wall (z=0)
      q.push(...rotateY(doubleSided(quad([0, 0, 0.8, 16, 0, 0.8, 16, 16, 0.8, 0, 16, 0.8], t, 4, F_SWAY)), k));
    }
    if (!q.length) q.push(...doubleSided(quad([0, 15.2, 16, 16, 15.2, 16, 16, 15.2, 0, 0, 15.2, 0], t, 3)));
    return q;
  },
  cactus(d) {
    const f = d.faces;
    return [...box(1, 0, 1, 15, 16, 15, [f[0], f[1], -1, -1, f[4], f[5]]), ...box(0, 0, 0, 16, 16, 16, [-1, -1, f[2], f[3], -1, -1])];
  },
  flat(d) {
    return [{ pos: [0, 0.6, 16, 16, 0.6, 16, 16, 0.6, 0, 0, 0.6, 0], uv: [0, 16, 16, 16, 16, 0, 0, 0], tex: d.faces[0], face: 2, cull: -1, full: false, shade: SHADE_FLAT, flags: 0 },
      { pos: [0, 0.4, 0, 16, 0.4, 0, 16, 0.4, 16, 0, 0.4, 16], uv: [0, 0, 16, 0, 16, 16, 0, 16], tex: d.faces[0], face: 3, cull: -1, full: false, shade: SHADE_FLAT, flags: 0 }];
  },
  farmland(d, meta) { return box(0, 0, 0, 16, 15, 16, (meta & 1) && d.facesAlt ? d.facesAlt : d.faces); },
  pedestal(d, meta) {
    const f = (meta & 1) ? d.facesAlt : d.faces;
    const q = [...box(2, 0, 2, 14, 2, 14, f), ...box(4, 2, 4, 12, 11, 12, f), ...box(2, 11, 2, 14, 13, 14, f)];
    if (meta & 1) q.push(...box(6, 14, 6, 10, 18, 10, T('echo_block'), { flags: F_EMISSIVE, noCull: true }).map((qq) => ({ ...qq, flags: F_EMISSIVE | F_SWAY })));
    return q;
  },
  waystone(d, meta) {
    const f = (meta & 1) ? d.facesAlt : d.faces;
    return [...box(2, 0, 2, 14, 3, 14, T('ancient_bricks')), ...box(4, 3, 4, 12, 16, 12, f, { flags: (meta & 1) ? F_EMISSIVE : 0 })];
  },
  altar(d) {
    const f = d.faces;
    return [...box(0, 0, 0, 16, 4, 16, f), ...box(2, 4, 2, 14, 10, 14, f), ...box(1, 10, 1, 15, 12, 15, f, { flags: F_EMISSIVE })];
  },
  urn(d) {
    const f = d.faces;
    return [...box(4, 0, 4, 12, 9, 12, f), ...box(5, 9, 5, 11, 12, 11, f, { uv: { 2: [5, 5, 11, 11] } })];
  },
};

const SWAYING = new Set(['tall_grass', 'fern', 'dawnflower', 'bellbloom', 'bluestar', 'emberbloom', 'moonlily', 'reeds', 'seagrass', 'oak_sapling', 'birch_sapling', 'pine_sapling', 'blossom_sapling', 'willow_sapling', 'cloud_sapling', 'berry_bush']);

// attach (lever/button): authored on the floor (hanging on the block below = face 3 / down)
function attachRotate(q, face) {
  // face = direction from this cell toward the supporting block
  if (face === 3) return q;
  if (face === 2) return rotate6(q, 3);
  // walls: tip the floor model so it hangs on the wall in direction `face`
  const to = face; // supporting block at +X etc. -> model's -Y must point toward that face
  const map = { 0: 1, 1: 0, 4: 5, 5: 4 };
  return rotate6(q, map[to]);
}

// ---- cache -------------------------------------------------------------------------------
const cache = new Map();
export const CONNECTS = new Uint8Array(BLOCKS.length); // shapes whose model depends on neighbours
for (const d of BLOCKS) if (d.shape === 'fence' || d.shape === 'wire') CONNECTS[d.id] = 1;

export function modelQuads(v, conn = 0) {
  const key = v * 256 + conn;
  let m = cache.get(key);
  if (m) return m;
  const id = v & ID_MASK, meta = v >>> ID_BITS;
  const d = BLOCKS[id];
  const fn = SHAPES[d.shape];
  if (!fn) throw new Error(`no model for shape ${d.shape} (${d.name})`);
  m = fn(d, meta, conn);
  cache.set(key, m);
  return m;
}

// ---- collision / selection boxes (in block units) ----------------------------------------
const FULL = [[0, 0, 0, 1, 1, 1]];
const boxCache = new Map();
function quadsBounds(quads) {
  let x0 = 16, y0 = 16, z0 = 16, x1 = 0, y1 = 0, z1 = 0;
  for (const q of quads) for (let i = 0; i < 12; i += 3) {
    x0 = Math.min(x0, q.pos[i]); x1 = Math.max(x1, q.pos[i]);
    y0 = Math.min(y0, q.pos[i + 1]); y1 = Math.max(y1, q.pos[i + 1]);
    z0 = Math.min(z0, q.pos[i + 2]); z1 = Math.max(z1, q.pos[i + 2]);
  }
  return [x0 / 16, y0 / 16, z0 / 16, x1 / 16, y1 / 16, z1 / 16];
}

export function selectionBoxes(v, conn = 0) {
  const id = v & ID_MASK;
  const d = BLOCKS[id];
  if (d.shape === 'cube') return FULL;
  if (d.shape === 'none' || d.liquid) return [];
  const key = v * 256 + conn;
  let b = boxCache.get('s' + key);
  if (b) return b;
  const shape = d.shape;
  if (shape === 'cross' || shape === 'crop') b = [[0.15, 0, 0.15, 0.85, shape === 'crop' ? 0.5 : 0.8, 0.85]];
  else if (shape === 'slab' || shape === 'stairs' || shape === 'fence' || shape === 'door' || shape === 'gate' || shape === 'trapdoor') b = groupBoxes(d, v >>> ID_BITS, conn);
  else if (shape === 'wire' || shape === 'rail') b = [[0, 0, 0, 1, 0.1, 1]];
  else b = [quadsBounds(modelQuads(v, conn))];
  boxCache.set('s' + key, b);
  return b;
}

function groupBoxes(d, meta, conn) {
  const s = d.shape;
  if (s === 'slab') return (meta & 3) === 2 ? FULL : (meta & 3) === 1 ? [[0, 0.5, 0, 1, 1, 1]] : [[0, 0, 0, 1, 0.5, 1]];
  if (s === 'stairs') {
    const up = meta & 4;
    const k = meta & 3;
    const half = up ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
    const y0 = up ? 0 : 0.5, y1 = up ? 0.5 : 1;
    const step = [[0, y0, 0, 1, y1, 0.5], [0, y0, 0, 0.5, y1, 1], [0, y0, 0.5, 1, y1, 1], [0.5, y0, 0, 1, y1, 1]][k];
    return [half, step];
  }
  if (s === 'fence') {
    const w = d.wall ? 0.25 : 0.375, w1 = 1 - w;
    const out = [[w, 0, w, w1, 1, w1]];
    if (conn & 1) out.push([w, 0, 0, w1, 1, w]);
    if (conn & 2) out.push([0, 0, w, w, 1, w1]);
    if (conn & 4) out.push([w, 0, w1, w1, 1, 1]);
    if (conn & 8) out.push([w1, 0, w, 1, 1, w1]);
    return out;
  }
  return [quadsBounds(modelQuads(pack2(d.id, meta), conn))];
}
const pack2 = (id, meta) => id | (meta << ID_BITS);

// collision boxes: like selection but fences are 1.5 tall, non-solid blocks have none
export function collisionBoxes(v, conn = 0) {
  const id = v & ID_MASK;
  const d = BLOCKS[id];
  if (!d.solid) return [];
  if (d.shape === 'cube') return FULL;
  const meta = v >>> ID_BITS;
  const key = 'c' + (v * 256 + conn);
  let b = boxCache.get(key);
  if (b) return b;
  const s = d.shape;
  if (s === 'fence') b = groupBoxes(d, meta, conn).map((x) => [x[0], x[1], x[2], x[3], 1.5, x[5]]);
  else if (s === 'gate') b = (meta & 4) ? [] : [((meta & 1) ? [0.375, 0, 0, 0.625, 1.5, 1] : [0, 0, 0.375, 1, 1.5, 0.625])];
  else if (s === 'door' || s === 'trapdoor' || s === 'slab' || s === 'stairs') b = selectionBoxes(v, conn);
  else if (s === 'layer') b = (meta & 7) === 0 ? [] : [[0, 0, 0, 1, ((meta & 7)) * 2 / 16, 1]];
  else if (s === 'cactus') b = [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
  else if (s === 'flat') b = [[0, 0, 0, 1, 0.05, 1]];
  else b = selectionBoxes(v, conn);
  boxCache.set(key, b);
  return b;
}

// Which neighbours does a connecting block (fence/wire) link to? get(dx,dy,dz) returns a cell value.
export function connectionMask(v, get) {
  const id = v & ID_MASK;
  const d = BLOCKS[id];
  // n w s e as facing4 0..3
  const dirs = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  let m = 0;
  if (d.shape === 'fence') {
    for (let k = 0; k < 4; k++) {
      const n = get(dirs[k][0], 0, dirs[k][1]);
      const ni = n & ID_MASK;
      const nd = BLOCKS[ni];
      if (nd.shape === 'fence' || nd.shape === 'gate' || OPAQUE[ni]) m |= 1 << k;
    }
    return m;
  }
  if (d.shape === 'wire') {
    const above = get(0, 1, 0);
    const aboveOpen = !OPAQUE[above & ID_MASK];
    for (let k = 0; k < 4; k++) {
      const [dx, dz] = dirs[k];
      const n = get(dx, 0, dz);
      const ni = n & ID_MASK;
      if (connectsWire(ni, k)) { m |= 1 << k; continue; }
      if (aboveOpen && OPAQUE[ni] && ((get(dx, 1, dz) & ID_MASK) === B.wire)) { m |= (1 << k) | (16 << k); continue; }
      if (!OPAQUE[ni] && ((get(dx, -1, dz) & ID_MASK) === B.wire)) m |= 1 << k;
    }
    return m;
  }
  return 0;
}

function connectsWire(id, k) {
  if (id === B.wire) return true;
  const d = BLOCKS[id];
  return id === B.lever || id === B.button || id === B.pressure_plate || id === B.power_block || id === B.inverter ||
    id === B.repeater || id === B.observer || id === B.daylight_sensor || id === B.crystal_lamp || id === B.piston ||
    id === B.sticky_piston || id === B.note_block || id === B.fan || id === B.drill || id === B.placer || id === B.dispenser ||
    id === B.blast_barrel || id === B.launch_pad || id === B.conveyor || id === B.iron_door || d.shape === 'door' || id === B.trapdoor || (k < 0);
}

export { FACE_DX, FACE_DY, FACE_DZ };
