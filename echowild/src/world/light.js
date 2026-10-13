// Coloured flood-fill lighting. Each cell stores 16 bits: sky(0-3) R(4-7) G(8-11) B(12-15).
// Sky light falls straight down without loss from level 15; everything else loses 1 per step
// (more through water/leaves). Block light is three independent channels so a crystal can cast
// violet light next to a torch's orange. The same engine runs inside the generator worker (one
// chunk, edges treated as walls) and on the main thread (across loaded chunks).

import { OPAQUE, FILTER, ID_MASK, emissionOf } from './blocks.js';
import { ISLAND_Y } from './biomes.js';

export const SHIFT = [0, 4, 8, 12];          // sky, r, g, b
const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];

class Queue {
  constructor(n = 4096) { this.x = new Int32Array(n); this.y = new Int32Array(n); this.z = new Int32Array(n); this.v = new Int32Array(n); this.head = 0; this.tail = 0; }
  push(x, y, z, v = 0) {
    if (this.tail === this.x.length) {
      if (this.head > this.tail / 2) { // compact
        const n = this.tail - this.head;
        this.x.copyWithin(0, this.head, this.tail); this.y.copyWithin(0, this.head, this.tail);
        this.z.copyWithin(0, this.head, this.tail); this.v.copyWithin(0, this.head, this.tail);
        this.head = 0; this.tail = n;
      } else {
        const g = (a) => { const b = new Int32Array(a.length * 2); b.set(a); return b; };
        this.x = g(this.x); this.y = g(this.y); this.z = g(this.z); this.v = g(this.v);
      }
    }
    const t = this.tail++;
    this.x[t] = x; this.y[t] = y; this.z[t] = z; this.v[t] = v;
  }
  get empty() { return this.head === this.tail; }
  reset() { this.head = this.tail = 0; }
}

// world adapter interface:
//   block(x,y,z) -> cell value, or -1 if the cell is unavailable (unloaded / outside)
//   light(x,y,z) -> 16-bit light, setLight(x,y,z,v)
export class LightEngine {
  constructor(w) {
    this.w = w;
    this.add = [new Queue(), new Queue(), new Queue(), new Queue()];
    this.rem = [new Queue(), new Queue(), new Queue(), new Queue()];
  }

  // Propagate queued increases for channel c.
  spread(c) {
    const q = this.add[c], w = this.w, sh = SHIFT[c], mask = 15 << sh;
    while (!q.empty) {
      const i = q.head++;
      const x = q.x[i], y = q.y[i], z = q.z[i];
      const lv = (w.light(x, y, z) >> sh) & 15;
      if (lv <= 1) continue;
      for (let f = 0; f < 6; f++) {
        const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f];
        if (ny < 0 || ny > 255) continue;
        const b = w.block(nx, ny, nz);
        if (b < 0) continue;
        const id = b & ID_MASK;
        if (OPAQUE[id]) continue;
        const flt = FILTER[id];
        const nv = (c === 0 && f === 3 && lv === 15 && flt === 0) ? 15 : lv - (flt > 1 ? flt : 1);
        if (nv <= 0) continue;
        const cur = w.light(nx, ny, nz);
        if (((cur >> sh) & 15) < nv) {
          w.setLight(nx, ny, nz, (cur & ~mask) | (nv << sh));
          q.push(nx, ny, nz);
        }
      }
    }
    q.reset();
  }

  // Remove light starting at cells queued in rem[c] (value = old level), then re-spread.
  unspread(c) {
    const q = this.rem[c], w = this.w, sh = SHIFT[c], mask = 15 << sh, add = this.add[c];
    while (!q.empty) {
      const i = q.head++;
      const x = q.x[i], y = q.y[i], z = q.z[i], old = q.v[i];
      for (let f = 0; f < 6; f++) {
        const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f];
        if (ny < 0 || ny > 255) continue;
        const b = w.block(nx, ny, nz);
        if (b < 0) continue;
        const cur = w.light(nx, ny, nz);
        const nv = (cur >> sh) & 15;
        if (nv === 0) continue;
        if (nv < old || (c === 0 && f === 3 && old === 15 && nv === 15)) {
          // might have been lit by us; keep emitters' own light
          const e = c === 0 ? 0 : (emissionOf(b) >> (8 - (c - 1) * 4)) & 15;
          w.setLight(nx, ny, nz, (cur & ~mask) | (e << sh));
          q.push(nx, ny, nz, nv);
          if (e) add.push(nx, ny, nz);
        } else {
          add.push(nx, ny, nz);
        }
      }
    }
    q.reset();
    this.spread(c);
  }

  // A cell's block changed from oldV to newV: fix up all channels.
  update(x, y, z, oldV, newV) {
    const w = this.w;
    const oldId = oldV & ID_MASK, newId = newV & ID_MASK;
    const cur = w.light(x, y, z);
    const newE = emissionOf(newV);
    const oldE = emissionOf(oldV);
    const opacityChanged = OPAQUE[oldId] !== OPAQUE[newId] || FILTER[oldId] !== FILTER[newId];
    if (!opacityChanged && newE === oldE) return;
    const becameDarker = OPAQUE[newId] || FILTER[newId] > FILTER[oldId];
    for (let c = 0; c < 4; c++) {
      const sh = SHIFT[c];
      const lv = (cur >> sh) & 15;
      const e = c === 0 ? 0 : (newE >> (8 - (c - 1) * 4)) & 15;
      const oe = c === 0 ? 0 : (oldE >> (8 - (c - 1) * 4)) & 15;
      if (becameDarker || e < oe || (opacityChanged && lv > 0)) {
        // remove what this cell carried, then let neighbours (and the new emission) flow back
        const l2 = w.light(x, y, z);
        w.setLight(x, y, z, (l2 & ~(15 << sh)) | (e << sh));
        if (lv > 0) this.rem[c].push(x, y, z, lv);
        if (e) this.add[c].push(x, y, z);
        this.unspread(c);
      }
      if (!OPAQUE[newId]) {
        // let neighbours' light in (opening a cell), and our own emission out
        if (e > ((w.light(x, y, z) >> sh) & 15)) {
          const l2 = w.light(x, y, z);
          w.setLight(x, y, z, (l2 & ~(15 << sh)) | (e << sh));
        }
        this.add[c].push(x, y, z);
        for (let f = 0; f < 6; f++) {
          const nx = x + DX[f], ny = y + DY[f], nz = z + DZ[f];
          if (ny < 0 || ny > 255) continue;
          const b = w.block(nx, ny, nz);
          if (b < 0 || OPAQUE[b & ID_MASK]) continue;
          if ((w.light(nx, ny, nz) >> sh) & 15) this.add[c].push(nx, ny, nz);
        }
        this.spread(c);
      }
    }
  }

  // Queue a cell as a light source for every channel it carries (used when merging chunks).
  seed(x, y, z) {
    const l = this.w.light(x, y, z);
    for (let c = 0; c < 4; c++) if ((l >> SHIFT[c]) & 15) this.add[c].push(x, y, z);
  }
  flush() { for (let c = 0; c < 4; c++) this.spread(c); }
}

// ---- whole-chunk initial lighting (generator worker) -----------------------------------------
// blocks/light: Uint16Array(65536), index (y<<8)|(z<<4)|x. Edges are treated as unavailable.
export function lightChunk(blocks, light) {
  light.fill(0);
  const w = {
    block: (x, y, z) => (x < 0 || x > 15 || z < 0 || z > 15 || y < 0 || y > 255) ? -1 : blocks[(y << 8) | (z << 4) | x],
    light: (x, y, z) => light[(y << 8) | (z << 4) | x],
    setLight: (x, y, z, v) => { light[(y << 8) | (z << 4) | x] = v; },
  };
  const eng = new LightEngine(w);
  const stop = new Uint8Array(256); // first y (from top) where sky light stops being 15
  const q = eng.add[0];
  const blocker = (x, y, z) => { const id = blocks[(y << 8) | (z << 4) | x] & ID_MASK; return OPAQUE[id] || FILTER[id]; };
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    let y = 255;
    for (; y >= 0; y--) {
      if (blocker(x, y, z)) break;
      light[(y << 8) | (z << 4) | x] = 15;
    }
    // Floating islands hang 50+ blocks above open ground: daylight reaches the ground beneath
    // them from all around, so their masses do not cast a sky shadow. (Otherwise a wide island
    // leaves the land below pitch black at noon.) Cells skipped here are lit by the spread.
    if (y >= ISLAND_Y && !blocker(x, ISLAND_Y - 1, z)) {
      for (; y >= 0; y--) {
        if (blocker(x, y, z)) {
          if (y < ISLAND_Y) break;
          if (y < 255 && light[((y + 1) << 8) | (z << 4) | x] === 15) q.push(x, y + 1, z);
          continue;
        }
        if (light[((y + 1) << 8) | (z << 4) | x] !== 15) q.push(x, y, z); // just below a skipped block
        light[(y << 8) | (z << 4) | x] = 15;
      }
    }
    stop[(z << 4) | x] = y + 1;
  }
  // sky seeds: lit cells beside shaded columns, and the cell just above the stop
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const s = stop[(z << 4) | x];
    let maxN = s;
    if (x > 0) maxN = Math.max(maxN, stop[(z << 4) | (x - 1)]);
    if (x < 15) maxN = Math.max(maxN, stop[(z << 4) | (x + 1)]);
    if (z > 0) maxN = Math.max(maxN, stop[((z - 1) << 4) | x]);
    if (z < 15) maxN = Math.max(maxN, stop[((z + 1) << 4) | x]);
    for (let y = s; y <= Math.min(255, maxN); y++) q.push(x, y, z);
    if (s > 0 && s <= 255) q.push(x, s, z);
  }
  eng.spread(0);
  // block light
  for (let i = 0; i < 65536; i++) {
    const v = blocks[i];
    if (!v) continue;
    const e = emissionOf(v);
    if (!e) continue;
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    light[i] = (light[i] & 15) | (((e >> 8) & 15) << 4) | (((e >> 4) & 15) << 8) | ((e & 15) << 12);
    for (let c = 1; c < 4; c++) if ((light[i] >> SHIFT[c]) & 15) eng.add[c].push(x, y, z);
  }
  for (let c = 1; c < 4; c++) eng.spread(c);
  return stop;
}
