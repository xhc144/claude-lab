// Streams chunks around the player: requests generation (or loads saved chunks), merges light,
// keeps meshes up to date by sending padded section copies to the workers, and unloads far chunks.

import { Chunk, ckey } from './chunk.js';
import { WorkerPool } from '../workers/pool.js';
import { P, pidx } from '../render/mesher.js';
import { B } from './blocks.js';

export class ChunkManager {
  constructor(game, seed, { workers = 3 } = {}) {
    this.game = game;
    this.world = game.world;
    this.pending = new Map();   // key -> 'gen' | 'load'
    this.pool = new WorkerPool(workers, seed, (m) => this.onMessage(m));
    this.maxGen = workers * 3;
    this.maxMesh = workers * 4;
    this.genInFlight = 0;
    this.meshInFlight = 0;
    this.savedIndex = new Set(); // keys of chunks present in storage
    this.storage = null;
    this.onChunkLoaded = [];
    this.onChunkUnload = [];
    this.stats = { gen: 0, meshed: 0 };
  }

  // Called every frame with the player's chunk position.
  update(pcx, pcz, renderDist, budgetMs = 4) {
    const world = this.world;
    const loadR = renderDist + 1;
    const t0 = performance.now();

    // 1) request missing chunks, nearest first (spiral order)
    if (this.genInFlight < this.maxGen) {
      const order = spiral(loadR);
      for (const [dx, dz] of order) {
        if (this.genInFlight >= this.maxGen) break;
        const cx = pcx + dx, cz = pcz + dz;
        const k = ckey(cx, cz);
        if (world.chunks.has(k) || this.pending.has(k)) continue;
        this.request(cx, cz);
      }
    }

    // 2) unload far chunks
    const unloadR = loadR + 2;
    for (const c of world.chunks.values()) {
      if (Math.abs(c.cx - pcx) > unloadR || Math.abs(c.cz - pcz) > unloadR) this.unload(c);
    }

    // 3) mesh dirty sections of chunks whose neighbours are all present
    if (this.meshInFlight < this.maxMesh) {
      const cands = [];
      for (const c of world.chunks.values()) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (Math.abs(dx) > renderDist || Math.abs(dz) > renderDist) continue;
        let any = false;
        for (let s = 0; s < 16; s++) if (c.dirty[s] && !c.meshing[s]) { any = true; break; }
        if (!any) continue;
        if (!this.neighboursReady(c)) continue;
        cands.push([dx * dx + dz * dz, c]);
      }
      cands.sort((a, b) => a[0] - b[0]);
      const py = this.game.player ? Math.floor(this.game.player.y / 16) : 4;
      outer: for (const [, c] of cands) {
        const order = [];
        for (let s = 0; s < 16; s++) if (c.dirty[s] && !c.meshing[s]) order.push(s);
        order.sort((a, b) => Math.abs(a - py) - Math.abs(b - py));
        for (const s of order) {
          if (this.meshInFlight >= this.maxMesh || performance.now() - t0 > budgetMs) break outer;
          this.meshSection(c, s);
        }
      }
    }
  }

  neighboursReady(c) {
    const w = this.world;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const n = w.getChunk(c.cx + dx, c.cz + dz);
      if (!n || !n.ready) return false;
    }
    return true;
  }

  request(cx, cz) {
    const k = ckey(cx, cz);
    if (this.storage && this.savedIndex.has(k)) {
      this.pending.set(k, 'load');
      this.genInFlight++;
      this.storage.loadChunk(cx, cz).then((rec) => {
        if (!this.pending.has(k)) { this.genInFlight--; return; }
        if (!rec) { this.pending.delete(k); this.genInFlight--; this.savedIndex.delete(k); return; }
        this.pool.post({ type: 'relight', cx, cz, blocks: rec.blocks }, [rec.blocks.buffer]);
        this.pending.set(k, { rec });
      }).catch((e) => { console.error(e); this.pending.delete(k); this.genInFlight--; });
      return;
    }
    this.pending.set(k, 'gen');
    this.genInFlight++;
    this.pool.post({ type: 'gen', cx, cz });
  }

  onMessage(m) {
    if (m.type === 'gen' || m.type === 'relight') {
      this.genInFlight--;
      const k = ckey(m.cx, m.cz);
      const p = this.pending.get(k);
      if (!p) return; // cancelled
      this.pending.delete(k);
      const c = new Chunk(m.cx, m.cz);
      c.blocks = m.blocks;
      c.light = m.light;
      if (m.type === 'gen') {
        c.biomes = m.biomes; c.heights = m.heights; c.tints = m.tints;
        c.features = m.features;
      } else {
        const rec = p.rec;
        c.biomes = rec.biomes; c.tints = rec.tints;
        c.heights = new Uint8Array(256);
        for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.updateHeight(x, z);
        c.modified = true;
        c.savedEntities = rec.entities || null;
        for (const be of rec.blockEntities || []) c.blockEntities.set(be.i, be.data);
        c.features = [];
      }
      this.world.addChunk(c);
      this.stats.gen++;
      for (const f of this.onChunkLoaded) f(c);
    } else if (m.type === 'mesh') {
      this.meshInFlight--;
      const chunk = this.world.chunks.get(m.key);
      if (!chunk) return;
      chunk.meshing[m.sy] = 0;
      if (chunk.meshVersion[m.sy] !== m.version) return; // stale; a newer job (or dirty flag) follows
      this.game.renderer.uploadSection(chunk, m.sy, m);
      this.stats.meshed++;
    }
  }

  meshSection(c, sy) {
    const world = this.world;
    c.dirty[sy] = 0;
    if (!c.nonEmpty[sy]) {
      // empty: drop any existing mesh
      if (c.meshes[sy]) this.game.renderer.uploadSection(c, sy, { opaque: null, trans: null });
      return;
    }
    const blocks = new Uint16Array(P * P * P);
    const light = new Uint16Array(P * P * P);
    const tints = new Uint32Array(P * P * 3);
    const by = sy * 16;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = dx === 0 && dz === 0 ? c : world.getChunk(c.cx + dx, c.cz + dz);
      const x0 = dx === -1 ? 15 : 0, x1 = dx === 1 ? 0 : 15;
      const z0 = dz === -1 ? 15 : 0, z1 = dz === 1 ? 0 : 15;
      const ox = dx * 16, oz = dz * 16;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const px = x + ox, pz = z + oz;
        if (px < -1 || px > 16 || pz < -1 || pz > 16) continue;
        const ci = (z << 4) | x;
        for (let t = 0; t < 3; t++) tints[t * P * P + (pz + 1) * P + (px + 1)] = n.tints[t * 256 + ci];
        for (let y = -1; y <= 16; y++) {
          const wy = by + y;
          const di = pidx(px, y, pz);
          if (wy < 0) { blocks[di] = B.bedrock; light[di] = 0; continue; }
          if (wy > 255) { blocks[di] = 0; light[di] = 15; continue; }
          const si = (wy << 8) | ci;
          blocks[di] = n.blocks[si];
          light[di] = n.light[si];
        }
      }
    }
    c.meshing[sy] = 1;
    c.meshVersion[sy]++;
    this.meshInFlight++;
    this.pool.post({ type: 'mesh', key: c.key, sy, version: c.meshVersion[sy], blocks, light, tints }, [blocks.buffer, light.buffer, tints.buffer]);
  }

  unload(c) {
    for (const f of this.onChunkUnload) f(c);
    this.game.renderer.disposeChunk(c);
    this.world.removeChunk(c);
  }

  // Force-load chunks synchronously-ish for teleport/spawn: returns a promise resolved when ready.
  waitFor(cx, cz, r = 1) {
    return new Promise((resolve) => {
      const check = () => {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          const c = this.world.getChunk(cx + dx, cz + dz);
          if (!c || !c.ready) { setTimeout(check, 30); return; }
        }
        resolve();
      };
      check();
    });
  }

  dispose() { this.pool.terminate(); }
}

let spiralCache = new Map();
function spiral(r) {
  if (spiralCache.has(r)) return spiralCache.get(r);
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) out.push([dx, dz]);
  out.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
  spiralCache.set(r, out);
  return out;
}

