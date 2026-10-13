// Meshes for items held in the hand or lying in the world, and generic box-model helpers.
// Vertex format (13 floats): position, normal, colour rgba, u, v, layer (-1 = untextured).

import { BLOCKS, ID_MASK, TINT } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { modelQuads } from '../world/models.js';
import { itemSprite, defaultState } from './icons.js';
import { buildBlockTextures } from './textures.js';
import { BIOMES } from '../world/biomes.js';

export class MeshBuilder {
  constructor() { this.v = []; this.i = []; this.n = 0; }
  quad(p, nrm, col, uv, layer) {
    // p: 4 corners [x,y,z]; uv: 4 [u,v]
    // col: one rgba for the quad, or four (one per corner)
    const per = Array.isArray(col[0]);
    for (let k = 0; k < 4; k++) {
      const c = per ? col[k] : col;
      this.v.push(p[k][0], p[k][1], p[k][2], nrm[0], nrm[1], nrm[2], c[0], c[1], c[2], c[3], uv ? uv[k][0] : 0, uv ? uv[k][1] : 0, layer);
    }
    const b = this.n;
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.n += 4;
  }
  // axis-aligned box with per-face colours (col or [6 cols]) and optional face UVs/layer
  box(x0, y0, z0, x1, y1, z1, col, faces = null) {
    const F = [
      [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
      [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
      [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
    ];
    for (let f = 0; f < 6; f++) {
      const c = Array.isArray(col[0]) ? col[f] : col;
      if (!c) continue;
      const fc = faces && faces[f];
      this.quad(F[f][1], F[f][0], c, fc ? fc.uv : null, fc ? fc.layer : -1);
    }
  }
  build(renderer) {
    const verts = new Float32Array(this.v);
    const idx = this.n > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i);
    return renderer.createMesh(verts, idx);
  }
}

const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// Extrude 16×16 RGBA pixels into a thin voxel slab centred on the origin (1 unit wide).
export function extrudeSprite(mb, data, { thickness = 1 / 16, glow = false } = {}) {
  const S = 16, px = 1 / 16;
  const a = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? 0 : data[(y * S + x) * 4 + 3]);
  const t = thickness / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    if (data[i + 3] < 128) continue;
    const c = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, 1];
    const x0 = x * px - 0.5, x1 = x0 + px, y1 = 0.5 - y * px, y0 = y1 - px;
    mb.quad([[x0, y0, t], [x1, y0, t], [x1, y1, t], [x0, y1, t]], [0, 0, 1], c, null, -1);
    mb.quad([[x1, y0, -t], [x0, y0, -t], [x0, y1, -t], [x1, y1, -t]], [0, 0, -1], c, null, -1);
    const dark = [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75, 1];
    if (a(x - 1, y) < 128) mb.quad([[x0, y0, -t], [x0, y0, t], [x0, y1, t], [x0, y1, -t]], [-1, 0, 0], dark, null, -1);
    if (a(x + 1, y) < 128) mb.quad([[x1, y0, t], [x1, y0, -t], [x1, y1, -t], [x1, y1, t]], [1, 0, 0], dark, null, -1);
    if (a(x, y - 1) < 128) mb.quad([[x0, y1, t], [x1, y1, t], [x1, y1, -t], [x0, y1, -t]], [0, 1, 0], c, null, -1);
    if (a(x, y + 1) < 128) mb.quad([[x0, y0, -t], [x1, y0, -t], [x1, y0, t], [x0, y0, t]], [0, -1, 0], dark, null, -1);
  }
  void glow;
}

const FLAT_BLOCK_SHAPES = new Set(['cross', 'crop', 'torch', 'wallflat', 'rail', 'vine', 'flat', 'wire', 'fire', 'lever']);

// A block model (in 0..1 cube centred on the origin) with real textures.
export function blockModelMesh(mb, v, scale = 1) {
  const id = v & ID_MASK;
  const d = BLOCKS[id];
  const quads = modelQuads(v, d.shape === 'fence' ? 5 : 0);
  const tintId = TINT[id];
  const tint = tintId === 1 ? BIOMES[2].grassRGB : tintId === 2 ? BIOMES[2].foliageRGB : tintId === 3 ? BIOMES[0].waterRGB : null;
  const data = buildBlockTextures().data;
  for (const q of quads) {
    const p = q.pos;
    const pts = [];
    for (let k = 0; k < 4; k++) pts.push([(p[k * 3] / 16 - 0.5) * scale, (p[k * 3 + 1] / 16 - 0.5) * scale, (p[k * 3 + 2] / 16 - 0.5) * scale]);
    const uv = [];
    for (let k = 0; k < 4; k++) uv.push([q.uv[k * 2] / 16, q.uv[k * 2 + 1] / 16]);
    const n = q.face < 6 ? NORMALS[q.face] : [0, 1, 0];
    let col = [1, 1, 1, 1];
    if (tint) {
      // sample the texture's centre pixel to decide whether it is a tintable (gray) texture
      const o = q.tex * 1024 + (8 * 16 + 8) * 4;
      const sat = Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]);
      if (sat < 7 || d.name !== 'grass') col = [tint[0] / 255, tint[1] / 255, tint[2] / 255, 1];
      if (d.name === 'grass' && q.face !== 2) col = [1, 1, 1, 1];
    }
    mb.quad(pts, n, col, uv, q.tex);
    if (q.face === 6) mb.quad([pts[1], pts[0], pts[3], pts[2]], [-n[0], -n[1], -n[2]], col, [uv[1], uv[0], uv[3], uv[2]], q.tex);
  }
}

export function blockTextureSprite(layer) {
  const t = buildBlockTextures();
  return t.data.subarray(layer * 1024, layer * 1024 + 1024);
}

// Cache of item meshes keyed by item id.
export class ItemMeshes {
  constructor(renderer) { this.r = renderer; this.cache = new Map(); }
  get(id) {
    let m = this.cache.get(id);
    if (m) return m;
    const mb = new MeshBuilder();
    const def = ITEMS[id];
    let kind = 'sprite';
    if (def && def.block !== undefined) {
      const bd = BLOCKS[def.block];
      if (FLAT_BLOCK_SHAPES.has(bd.shape)) {
        const layer = bd.name === 'inverter' ? bd.faces[0] : bd.faces[bd.shape === 'rail' || bd.shape === 'flat' ? 2 : 0];
        const tint = bd.tint ? (bd.tint === 1 ? BIOMES[2].grassRGB : BIOMES[2].foliageRGB) : null;
        let data = blockTextureSprite(layer);
        if (tint) {
          data = new Uint8ClampedArray(data);
          for (let i = 0; i < data.length; i += 4) {
            const sat = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
            if (sat < 7) { data[i] = data[i] * tint[0] / 255; data[i + 1] = data[i + 1] * tint[1] / 255; data[i + 2] = data[i + 2] * tint[2] / 255; }
          }
        }
        extrudeSprite(mb, data);
      } else {
        blockModelMesh(mb, defaultState(def.block), 1);
        kind = 'block';
      }
    } else {
      extrudeSprite(mb, itemSprite(id).d);
    }
    m = mb.build(this.r);
    m.kind = kind;
    this.cache.set(id, m);
    return m;
  }
}
