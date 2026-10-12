// Section mesher (runs in workers). Input is an 18³ padded copy of the section's cells and light
// plus 18² biome tints; output is two vertex buffers (opaque+cutout, translucent).
//
// Vertex layout, 20 bytes:
//   0  int16 x, y, z (1/16 block, section-relative), int16 texture layer
//   8  uint8 u, v (texels), face | ao<<3, flags
//   12 uint8 light sky, r, g, b (0..255)
//   16 uint8 tint r, g, b, sway weight

import { BLOCKS, OPAQUE, LAYER, L_TRANS, L_NONE, TINT, ID_MASK, ID_BITS, B, TEXTURE_NAMES, GLOW_TEX, LIQUID } from '../world/blocks.js';
import { modelQuads, CONNECTS, connectionMask, F_SWAY, F_TINTPOWER, F_WATER } from '../world/models.js';

export const VERTEX_BYTES = 20;
export const P = 18;
export const pidx = (x, y, z) => ((y + 1) * P + (z + 1)) * P + (x + 1);

const GLOW_LAYER = new Uint8Array(TEXTURE_NAMES.length + 64);
TEXTURE_NAMES.forEach((n, i) => { if (GLOW_TEX.has(n)) GLOW_LAYER[i] = 1; });
export const F_GLOWMASK = 64;

class VBuf {
  constructor(cap = 4096) { this.alloc(cap); this.n = 0; }
  alloc(cap) {
    const buf = new ArrayBuffer(cap * VERTEX_BYTES);
    const old = this.u8;
    this.buf = buf; this.cap = cap;
    this.i16 = new Int16Array(buf);
    this.u8 = new Uint8Array(buf);
    if (old) this.u8.set(old.subarray(0, this.n * VERTEX_BYTES));
  }
  ensure(k) { if (this.n + k > this.cap) this.alloc(Math.max(this.cap * 2, this.n + k)); }
  result() { return { buf: this.buf.slice(0, this.n * VERTEX_BYTES), count: this.n }; }
}

const NX = [1, -1, 0, 0, 0, 0], NY = [0, 0, 1, -1, 0, 0], NZ = [0, 0, 0, 0, 1, -1];
const AXIS = [0, 0, 1, 1, 2, 2]; // normal axis per face

const WIRE_DARK = [16, 62, 72], WIRE_LIT = [140, 250, 255];

export function meshSection(blocks, light, tints, sy) {
  const opaque = new VBuf(8192), trans = new VBuf(1024);
  const baseY = sy * 16;
  const lightAt = new Float32Array(4);
  const tmpL = [0, 0, 0, 0];

  const cellOpaque = (x, y, z) => OPAQUE[blocks[pidx(x, y, z)] & ID_MASK];

  function sampleLight(x, y, z, out, w) {
    const l = light[pidx(x, y, z)];
    out[0] += (l & 15) * w; out[1] += ((l >> 4) & 15) * w; out[2] += ((l >> 8) & 15) * w; out[3] += ((l >> 12) & 15) * w;
  }

  function flatLight(x, y, z, face, out) {
    out[0] = out[1] = out[2] = out[3] = 0;
    let sx = x, sy2 = y, sz = z;
    if (face < 6) { sx += NX[face]; sy2 += NY[face]; sz += NZ[face]; }
    if (cellOpaque(sx, sy2, sz)) { sx = x; sy2 = y; sz = z; }
    if (cellOpaque(sx, sy2, sz)) {
      // fully enclosed (e.g. an opaque machine with inner faces): brightest neighbour
      let best = 0;
      for (let f = 0; f < 6; f++) {
        const l = light[pidx(x + NX[f], y + NY[f], z + NZ[f])];
        const s = (l & 15) + ((l >> 4) & 15) + ((l >> 8) & 15) + ((l >> 12) & 15);
        if (s > best) { best = s; sampleZero(out); sampleLight(x + NX[f], y + NY[f], z + NZ[f], out, 1); }
      }
      return;
    }
    sampleLight(sx, sy2, sz, out, 1);
  }
  const sampleZero = (o) => { o[0] = o[1] = o[2] = o[3] = 0; };

  function tintFor(id, meta, x, z, flags, out) {
    if (flags & F_TINTPOWER) {
      const t = meta / 15;
      out[0] = WIRE_DARK[0] + (WIRE_LIT[0] - WIRE_DARK[0]) * t;
      out[1] = WIRE_DARK[1] + (WIRE_LIT[1] - WIRE_DARK[1]) * t;
      out[2] = WIRE_DARK[2] + (WIRE_LIT[2] - WIRE_DARK[2]) * t;
      return;
    }
    const tt = TINT[id];
    if (!tt) { out[0] = out[1] = out[2] = 255; return; }
    const t = tints[(tt - 1) * P * P + (z + 1) * P + (x + 1)];
    out[0] = (t >> 16) & 255; out[1] = (t >> 8) & 255; out[2] = t & 255;
  }
  const tintOut = [255, 255, 255];

  function emit(vb, x, y, z, q, ao, lights, tint, flagsExtra, yOff) {
    vb.ensure(4);
    const p = q.pos, uv = q.uv;
    let order = 0;
    // flip the triangulation to follow the brighter diagonal (smooth AO)
    if (ao && (ao[0] + ao[2] < ao[1] + ao[3])) order = 1;
    const flags = q.flags | flagsExtra | (GLOW_LAYER[q.tex] ? F_GLOWMASK : 0);
    const sway = (q.flags & F_SWAY);
    for (let k = 0; k < 4; k++) {
      const c = (k + order) & 3;
      const n = vb.n++;
      const s = n * 10, b = n * VERTEX_BYTES;
      vb.i16[s] = x * 16 + p[c * 3];
      vb.i16[s + 1] = y * 16 + p[c * 3 + 1] + (yOff ? yOff[c] : 0);
      vb.i16[s + 2] = z * 16 + p[c * 3 + 2];
      vb.i16[s + 3] = q.tex;
      const u8 = vb.u8;
      u8[b + 8] = uv[c * 2]; u8[b + 9] = uv[c * 2 + 1];
      u8[b + 10] = (q.face & 7) | ((ao ? ao[c] : 3) << 3);
      u8[b + 11] = flags;
      const L = lights[c];
      u8[b + 12] = L[0]; u8[b + 13] = L[1]; u8[b + 14] = L[2]; u8[b + 15] = L[3];
      u8[b + 16] = tint[0]; u8[b + 17] = tint[1]; u8[b + 18] = tint[2];
      u8[b + 19] = sway ? Math.min(255, Math.max(0, p[c * 3 + 1] * 16)) : 0;
    }
  }

  const lights4 = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const ao4 = [3, 3, 3, 3];

  // Smooth light + AO for a quad lying on the face plane of the cell.
  function smooth(x, y, z, q) {
    const f = q.face;
    const fx = x + NX[f], fy = y + NY[f], fz = z + NZ[f];
    const ax = AXIS[f];
    for (let k = 0; k < 4; k++) {
      const px = q.pos[k * 3], py = q.pos[k * 3 + 1], pz = q.pos[k * 3 + 2];
      // tangent offsets toward this corner
      let t1x = 0, t1y = 0, t1z = 0, t2x = 0, t2y = 0, t2z = 0;
      if (ax === 0) { t1y = py >= 8 ? 1 : -1; t2z = pz >= 8 ? 1 : -1; }
      else if (ax === 1) { t1x = px >= 8 ? 1 : -1; t2z = pz >= 8 ? 1 : -1; }
      else { t1x = px >= 8 ? 1 : -1; t2y = py >= 8 ? 1 : -1; }
      const s1 = cellOpaque(fx + t1x, fy + t1y, fz + t1z);
      const s2 = cellOpaque(fx + t2x, fy + t2y, fz + t2z);
      const cr = (s1 && s2) ? 1 : cellOpaque(fx + t1x + t2x, fy + t1y + t2y, fz + t1z + t2z);
      ao4[k] = (s1 && s2) ? 0 : 3 - (s1 + s2 + cr);
      const L = lightAt; L[0] = L[1] = L[2] = L[3] = 0;
      let cnt = 1;
      sampleLight(fx, fy, fz, L, 1);
      if (!s1) { sampleLight(fx + t1x, fy + t1y, fz + t1z, L, 1); cnt++; }
      if (!s2) { sampleLight(fx + t2x, fy + t2y, fz + t2z, L, 1); cnt++; }
      if (!cr) { sampleLight(fx + t1x + t2x, fy + t1y + t2y, fz + t1z + t2z, L, 1); cnt++; }
      const o = lights4[k], m = 17 / cnt;
      o[0] = L[0] * m; o[1] = L[1] * m; o[2] = L[2] * m; o[3] = L[3] * m;
    }
  }

  function setFlat(x, y, z, face) {
    flatLight(x, y, z, face, tmpL);
    for (let k = 0; k < 4; k++) { const o = lights4[k]; o[0] = tmpL[0] * 17; o[1] = tmpL[1] * 17; o[2] = tmpL[2] * 17; o[3] = tmpL[3] * 17; }
  }

  const getRel = (x, y, z) => (dx, dy, dz) => {
    const xx = x + dx, yy = y + dy, zz = z + dz;
    if (xx < -1 || xx > 16 || yy < -1 || yy > 16 || zz < -1 || zz > 16) return 0;
    return blocks[pidx(xx, yy, zz)];
  };

  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const v = blocks[pidx(x, y, z)];
        const id = v & ID_MASK;
        if (!id || LAYER[id] === L_NONE) continue;
        if (LIQUID[id]) { meshLiquid(x, y, z, v, id); continue; }
        const meta = v >>> ID_BITS;
        const conn = CONNECTS[id] ? connectionMask(v, getRel(x, y, z)) : 0;
        const quads = modelQuads(v, conn);
        const vb = LAYER[id] === L_TRANS ? trans : opaque;
        tintFor(id, meta, x, z, quads.length ? quads[0].flags : 0, tintOut);
        for (let i = 0; i < quads.length; i++) {
          const q = quads[i];
          if (q.cull >= 0) {
            const n = blocks[pidx(x + NX[q.cull], y + NY[q.cull], z + NZ[q.cull])];
            const nid = n & ID_MASK;
            if (OPAQUE[nid]) continue;
            // same transparent block next to itself (glass walls, water, ice) hides the shared face
            if (nid === id && LAYER[id] !== 2 && q.full) continue;
            if (nid === id && (id === B.glass || BLOCKS[id].name.startsWith('glass_'))) continue;
          }
          if (q.shade && q.full) smooth(x, y, z, q);
          else setFlat(x, y, z, q.cull >= 0 ? q.face : 6);
          if (q.flags & F_TINTPOWER) tintFor(id, meta, x, z, q.flags, tintOut);
          emit(q.translucent ? trans : vb, x, y, z, q, q.shade && q.full ? ao4 : null, lights4, tintOut, 0, null);
        }
      }
    }
  }

  // ---- liquids
  function levelOf(v, id) {
    if ((v & ID_MASK) !== id) return -1;
    const m = v >>> ID_BITS;
    return m;
  }
  function heightOf(x, y, z, id) {
    const v = blocks[pidx(x, y, z)];
    if ((v & ID_MASK) !== id) return -1;
    const above = blocks[pidx(x, Math.min(16, y + 1), z)] & ID_MASK;
    if (above === id) return 16;
    const m = v >>> ID_BITS;
    if (m & 8) return 15; // falling
    const lvl = m & 7;
    return lvl === 0 ? 14.2 : 14.2 - lvl * 1.7;
  }
  function cornerH(x, y, z, cx, cz, id) {
    // average heights of the up-to-4 cells touching this top corner
    let sum = 0, n = 0;
    for (const [ox, oz] of [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]]) {
      const xx = x + ox, zz = z + oz;
      const ab = blocks[pidx(xx, Math.min(16, y + 1), zz)] & ID_MASK;
      if (ab === id) return 16;
      const h = heightOf(xx, y, zz, id);
      if (h >= 0) { sum += h; n++; }
      else if (!OPAQUE[blocks[pidx(xx, y, zz)] & ID_MASK]) { sum += 0; n += 0.0; }
    }
    return n ? sum / n : 14;
  }

  function meshLiquid(x, y, z, v, id) {
    const d = BLOCKS[id];
    const vb = id === B.water ? trans : opaque;
    const flags = id === B.water ? F_WATER : 16; // F_LAVA
    tintFor(id, 0, x, z, 0, tintOut);
    const aboveId = blocks[pidx(x, y + 1, z)] & ID_MASK;
    const h00 = cornerH(x, y, z, 0, 0, id), h10 = cornerH(x, y, z, 1, 0, id);
    const h01 = cornerH(x, y, z, 0, 1, id), h11 = cornerH(x, y, z, 1, 1, id);
    const topTex = d.faces[2], sideTex = d.faces[0];
    // top
    if (aboveId !== id) {
      const q = { pos: [0, h01, 16, 16, h11, 16, 16, h10, 0, 0, h00, 0], uv: [0, 16, 16, 16, 16, 0, 0, 0], tex: topTex, face: 2, cull: -1, full: false, shade: 0, flags };
      setFlat(x, y, z, 6);
      // light from the cell itself and above
      flatLight(x, y + 1, z, 6, tmpL);
      for (let k = 0; k < 4; k++) { const o = lights4[k]; o[0] = Math.max(o[0], tmpL[0] * 17); o[1] = Math.max(o[1], tmpL[1] * 17); o[2] = Math.max(o[2], tmpL[2] * 17); o[3] = Math.max(o[3], tmpL[3] * 17); }
      emit(vb, x, y, z, q, null, lights4, tintOut, 0, null);
      // underside of the surface, visible from below the water
      if (id === B.water) {
        const qb = { pos: [0, h00, 0, 16, h10, 0, 16, h11, 16, 0, h01, 16], uv: [0, 0, 16, 0, 16, 16, 0, 16], tex: topTex, face: 3, cull: -1, full: false, shade: 0, flags };
        emit(vb, x, y, z, qb, null, lights4, tintOut, 0, null);
      }
    }
    // sides
    const sides = [
      [0, 1, 0, [16, 0, 16, 16, 0, 0, 16, h10, 0, 16, h11, 16]],
      [1, -1, 0, [0, 0, 0, 0, 0, 16, 0, h01, 16, 0, h00, 0]],
      [4, 0, 1, [0, 0, 16, 16, 0, 16, 16, h11, 16, 0, h01, 16]],
      [5, 0, -1, [16, 0, 0, 0, 0, 0, 0, h00, 0, 16, h10, 0]],
    ];
    for (const [face, dx, dz, pos] of sides) {
      const n = blocks[pidx(x + dx, y, z + dz)];
      const nid = n & ID_MASK;
      if (nid === id || OPAQUE[nid]) continue;
      const q = { pos, uv: [0, 16, 16, 16, 16, 16 - pos[7], 0, 16 - pos[10]], tex: sideTex, face, cull: face, full: false, shade: 0, flags };
      setFlat(x, y, z, face);
      emit(vb, x, y, z, q, null, lights4, tintOut, 0, null);
    }
    // bottom
    const below = blocks[pidx(x, y - 1, z)] & ID_MASK;
    if (below !== id && !OPAQUE[below]) {
      const q = { pos: [0, 0, 0, 16, 0, 0, 16, 0, 16, 0, 0, 16], uv: [0, 0, 16, 0, 16, 16, 0, 16], tex: topTex, face: 3, cull: 3, full: false, shade: 0, flags };
      setFlat(x, y, z, 3);
      emit(vb, x, y, z, q, null, lights4, tintOut, 0, null);
    }
    void levelOf;
  }

  void baseY;
  return { opaque: opaque.result(), trans: trans.result() };
}
