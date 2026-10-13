// The live world on the main thread: loaded chunks, block access, lighting across chunks,
// remesh bookkeeping, scheduled/random ticks and block entities. Gameplay systems (fluids,
// circuits, plants…) register per-block handlers through `world.handlers`.

import { Chunk, ckey, SECTIONS } from './chunk.js';
import { LightEngine, SHIFT } from './light.js';
import { biomeOf } from './biomes.js';
import { BLOCKS, B, ID_MASK, ID_BITS, OPAQUE, emissionOf, MAX_BLOCKS } from './blocks.js';

export const posKey = (x, y, z) => ((x + 1048576) * 2097152 + (z + 1048576)) * 256 + y;
export const keyPos = (k) => {
  const y = k % 256;
  const r = (k - y) / 256;
  const z = (r % 2097152) - 1048576;
  const x = Math.floor(r / 2097152) - 1048576;
  return [x, y, z];
};

// binary min-heap on [time, seq]
class Heap {
  constructor() { this.a = []; this.seq = 0; }
  push(t, item) { item.t = t; item.s = this.seq++; const a = this.a; a.push(item); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.lt(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; } }
  lt(x, y) { return x.t < y.t || (x.t === y.t && x.s < y.s); }
  peek() { return this.a[0]; }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && this.lt(a[l], a[m])) m = l; if (r < a.length && this.lt(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; }
    }
    return top;
  }
  get size() { return this.a.length; }
}

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.chunks = new Map();
    this.time = 0;                // game ticks since world creation
    this.handlers = {             // per-block behaviour, filled by systems
      place: new Array(MAX_BLOCKS), remove: new Array(MAX_BLOCKS), neighbor: new Array(MAX_BLOCKS),
      tick: new Array(MAX_BLOCKS), random: new Array(MAX_BLOCKS),
    };
    this.globalNeighbor = [];     // listeners called on every neighbour change (observers etc.)
    this.scheduled = new Heap();
    this.scheduledKeys = new Map();
    this.listeners = { blockChange: [] };
    this._lc = null;              // last chunk cache
    this.light = new LightEngine({
      block: (x, y, z) => {
        const c = this.chunkAt(x, z);
        return c && c.ready ? c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] : -1;
      },
      light: (x, y, z) => {
        const c = this.chunkAt(x, z);
        return c && c.ready ? c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0;
      },
      setLight: (x, y, z, v) => {
        const c = this.chunkAt(x, z);
        if (!c || !c.ready) return;
        c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] = v;
        this.markDirtyIn(c, x & 15, y, z & 15);
      },
    });
    this.updateDepth = 0;
    this.pendingUpdates = [];
  }

  // ---------------------------------------------------------------- chunks
  chunkAt(x, z) {
    const cx = x >> 4, cz = z >> 4;
    const lc = this._lc;
    if (lc && lc.cx === cx && lc.cz === cz) return lc;
    const c = this.chunks.get(ckey(cx, cz));
    if (c) this._lc = c;
    return c;
  }
  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }
  isLoaded(x, z) { const c = this.chunkAt(x, z); return !!(c && c.ready); }

  addChunk(chunk) {
    this.chunks.set(chunk.key, chunk);
    chunk.ready = true;
    chunk.computeNonEmpty();
    chunk.dirty.fill(1);
    this.mergeLight(chunk);
  }

  removeChunk(chunk) {
    this.chunks.delete(chunk.key);
    if (this._lc === chunk) this._lc = null;
    chunk.ready = false;
  }

  // Pull light across the borders between a newly added chunk and its loaded neighbours.
  mergeLight(c) {
    const eng = this.light;
    const bx = c.cx * 16, bz = c.cz * 16;
    const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dz] of sides) {
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (!n || !n.ready) continue;
      for (let i = 0; i < 16; i++) {
        // local coords of the pair (a in c, b in n)
        let ax, az, bxl, bzl;
        if (dx === -1) { ax = 0; az = i; bxl = 15; bzl = i; }
        else if (dx === 1) { ax = 15; az = i; bxl = 0; bzl = i; }
        else if (dz === -1) { ax = i; az = 0; bxl = i; bzl = 15; }
        else { ax = i; az = 15; bxl = i; bzl = 0; }
        for (let y = 0; y < 256; y++) {
          const ia = (y << 8) | (az << 4) | ax, ib = (y << 8) | (bzl << 4) | bxl;
          const la = c.light[ia], lb = n.light[ib];
          if (la === lb) continue;
          for (let ch = 0; ch < 4; ch++) {
            const sh = SHIFT[ch];
            const va = (la >> sh) & 15, vb = (lb >> sh) & 15;
            if (va > vb + 1 && !OPAQUE[n.blocks[ib] & ID_MASK]) eng.add[ch].push(bx + ax, y, bz + az);
            else if (vb > va + 1 && !OPAQUE[c.blocks[ia] & ID_MASK]) eng.add[ch].push(n.cx * 16 + bxl, y, n.cz * 16 + bzl);
          }
        }
      }
    }
    eng.flush();
  }

  // ---------------------------------------------------------------- dirty sections
  markDirtyIn(c, lx, y, lz) {
    const s = y >> 4;
    c.dirty[s] = 1;
    const ly = y & 15;
    if (ly === 0 && s > 0) c.dirty[s - 1] = 1;
    else if (ly === 15 && s < 15) c.dirty[s + 1] = 1;
    if (lx === 0 || lx === 15 || lz === 0 || lz === 15) {
      const ox = lx === 0 ? -1 : lx === 15 ? 1 : 0, oz = lz === 0 ? -1 : lz === 15 ? 1 : 0;
      if (ox) { const n = this.getChunk(c.cx + ox, c.cz); if (n) n.dirty[s] = 1; }
      if (oz) { const n = this.getChunk(c.cx, c.cz + oz); if (n) n.dirty[s] = 1; }
      if (ox && oz) { const n = this.getChunk(c.cx + ox, c.cz + oz); if (n) n.dirty[s] = 1; }
    }
  }
  markDirty(x, y, z) {
    const c = this.chunkAt(x, z);
    if (c) this.markDirtyIn(c, x & 15, y, z & 15);
  }

  // ---------------------------------------------------------------- blocks
  getBlock(x, y, z) {
    if (y < 0) return B.bedrock;
    if (y > 255) return 0;
    const c = this.chunkAt(x, z);
    if (!c || !c.ready) return 0;
    return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }
  getId(x, y, z) { return this.getBlock(x, y, z) & ID_MASK; }
  getMeta(x, y, z) { return this.getBlock(x, y, z) >>> ID_BITS; }
  getLight(x, y, z) {
    if (y > 255) return 15;
    if (y < 0) return 0;
    const c = this.chunkAt(x, z);
    if (!c || !c.ready) return 15;
    return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }
  skyLight(x, y, z) { return this.getLight(x, y, z) & 15; }
  blockLightMax(x, y, z) { const l = this.getLight(x, y, z); return Math.max((l >> 4) & 15, (l >> 8) & 15, (l >> 12) & 15); }

  // Set a cell. opts: { notify: run neighbour updates (default true), cause }
  setBlock(x, y, z, v, opts) {
    if (y < 0 || y > 255) return false;
    const c = this.chunkAt(x, z);
    if (!c || !c.ready) return false;
    const lx = x & 15, lz = z & 15;
    const i = (y << 8) | (lz << 4) | lx;
    const old = c.blocks[i];
    if (old === v) return false;
    const oldId = old & ID_MASK, newId = v & ID_MASK;
    if (oldId !== newId) {
      const rm = this.handlers.remove[oldId];
      if (rm) rm(this, x, y, z, old, v);
      if (c.blockEntities.has(i) && !(opts && opts.keepBE)) c.blockEntities.delete(i);
    }
    c.blocks[i] = v;
    c.modified = true;
    if (v) c.nonEmpty[y >> 4] = 1;
    const hi = (lz << 4) | lx;
    if (v && y > c.heights[hi]) c.heights[hi] = y;
    else if (!v && y === c.heights[hi]) c.updateHeight(lx, lz);
    this.markDirtyIn(c, lx, y, lz);
    // lighting
    if (OPAQUE[oldId] !== OPAQUE[newId] || BLOCKS[oldId].filter !== BLOCKS[newId].filter || emissionOf(old) !== emissionOf(v)) {
      this.light.update(x, y, z, old, v);
    }
    if (oldId !== newId) {
      const pl = this.handlers.place[newId];
      if (pl) pl(this, x, y, z, v, old);
    }
    for (const l of this.listeners.blockChange) l(x, y, z, old, v, opts);
    if (!opts || opts.notify !== false) this.notifyNeighbors(x, y, z, old, v);
    return true;
  }

  setId(x, y, z, id, meta = 0, opts) { return this.setBlock(x, y, z, id | (meta << ID_BITS), opts); }

  // Tell the six neighbours (and global watchers) that (x,y,z) changed.
  notifyNeighbors(x, y, z, old, v) {
    this.updateDepth++;
    const nb = this.handlers.neighbor;
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (let f = 0; f < 6; f++) {
      const [dx, dy, dz] = dirs[f];
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const nv = this.getBlock(nx, ny, nz);
      const h = nb[nv & ID_MASK];
      if (h) {
        if (this.updateDepth > 64) this.pendingUpdates.push([h, nx, ny, nz, nv, x, y, z]);
        else h(this, nx, ny, nz, nv, x, y, z);
      }
    }
    for (const g of this.globalNeighbor) g(this, x, y, z, old, v);
    this.updateDepth--;
    if (this.updateDepth === 0 && this.pendingUpdates.length) {
      const list = this.pendingUpdates; this.pendingUpdates = [];
      for (const [h, nx, ny, nz, , sx, sy, sz] of list) h(this, nx, ny, nz, this.getBlock(nx, ny, nz), sx, sy, sz);
    }
  }

  // ---------------------------------------------------------------- scheduled ticks
  schedule(x, y, z, delay, data = null) {
    const k = posKey(x, y, z);
    const at = this.time + Math.max(1, delay | 0);
    const ex = this.scheduledKeys.get(k);
    if (ex && ex.t <= at) return;
    const item = { k, x, y, z, data, live: true };
    if (ex) ex.live = false;
    this.scheduledKeys.set(k, item);
    this.scheduled.push(at, item);
  }

  runScheduled(maxPerTick = 4000) {
    let n = 0;
    while (this.scheduled.size && this.scheduled.peek().t <= this.time && n < maxPerTick) {
      const it = this.scheduled.pop();
      if (!it.live) continue;
      if (this.scheduledKeys.get(it.k) === it) this.scheduledKeys.delete(it.k);
      const c = this.chunkAt(it.x, it.z);
      if (!c || !c.ready) continue;
      const v = this.getBlock(it.x, it.y, it.z);
      const h = this.handlers.tick[v & ID_MASK];
      if (h) { h(this, it.x, it.y, it.z, v, it.data); n++; }
    }
  }

  // ---------------------------------------------------------------- random ticks
  randomTicks(cx0, cz0, radius, perSection, rng) {
    const rh = this.handlers.random;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const c = this.getChunk(cx0 + dx, cz0 + dz);
      if (!c || !c.ready) continue;
      const bx = c.cx * 16, bz = c.cz * 16;
      for (let s = 0; s < SECTIONS; s++) {
        if (!c.nonEmpty[s]) continue;
        for (let k = 0; k < perSection; k++) {
          const r = (rng() * 4096) | 0;
          const i = (s << 12) | r;
          const v = c.blocks[i];
          const h = rh[v & ID_MASK];
          if (h) h(this, bx + (i & 15), i >> 8, bz + ((i >> 4) & 15), v);
        }
      }
    }
  }

  // ---------------------------------------------------------------- block entities
  getBE(x, y, z) {
    const c = this.chunkAt(x, z);
    if (!c) return null;
    return c.blockEntities.get((y << 8) | ((z & 15) << 4) | (x & 15)) || null;
  }
  setBE(x, y, z, be) {
    const c = this.chunkAt(x, z);
    if (!c) return;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    if (be) { be.x = x; be.y = y; be.z = z; c.blockEntities.set(i, be); } else c.blockEntities.delete(i);
    c.modified = true;
  }

  // ---------------------------------------------------------------- queries
  surfaceY(x, z) {
    const c = this.chunkAt(x, z);
    if (!c || !c.ready) return -1;
    return c.heights[((z & 15) << 4) | (x & 15)];
  }
  // highest y whose block blocks rain (non-air & not plant-like)
  rainY(x, z) {
    const c = this.chunkAt(x, z);
    if (!c || !c.ready) return 255;
    let y = c.heights[((z & 15) << 4) | (x & 15)];
    while (y > 0) {
      const id = c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] & ID_MASK;
      if (id && (BLOCKS[id].solid || BLOCKS[id].liquid)) break;
      y--;
    }
    return y;
  }
  // the ground biome, or the sky biome when y is up among the floating islands
  biomeAt(x, z, y = 0) {
    const c = this.chunkAt(x, z);
    if (!c || !c.ready) return 2;
    return biomeOf(c.biomes[((z & 15) << 4) | (x & 15)], y);
  }

  // DDA voxel ray cast. Returns { x,y,z, face, v, dist, px,py,pz } or null.
  raycast(ox, oy, oz, dx, dy, dz, maxDist, test) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? x + 1 - ox : ox - x) * tdx;
    let ty = (dy > 0 ? y + 1 - oy : oy - y) * tdy;
    let tz = (dz > 0 ? z + 1 - oz : oz - z) * tdz;
    let face = -1, t = 0;
    for (let i = 0; i < 512 && t <= maxDist; i++) {
      const v = this.getBlock(x, y, z);
      if (v && test(v, x, y, z)) {
        const hit = test.detail ? test.detail(v, x, y, z, ox, oy, oz, dx, dy, dz) : { t };
        if (hit) return { x, y, z, face: hit.face !== undefined ? hit.face : face, v, dist: hit.t, px: ox + dx * hit.t, py: oy + dy * hit.t, pz: oz + dz * hit.t };
      }
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; face = sx > 0 ? 1 : 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; face = sy > 0 ? 3 : 2; }
      else { z += sz; t = tz; tz += tdz; face = sz > 0 ? 5 : 4; }
    }
    return null;
  }
}

export { BLOCKS, B };
