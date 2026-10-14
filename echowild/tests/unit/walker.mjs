// Shared by the structure tests: generate a region of real terrain and search it with player
// movement rules (auto-step 0.6, jump 1.25, 1.8 of headroom, any drop, ladders climb).
import assert from 'node:assert/strict';
import { B, ID_MASK, SOLID, CLIMB, LIQUID } from '../../src/world/blocks.js';
import { collisionBoxes, CONNECTS, connectionMask } from '../../src/world/models.js';
import { BLOCKS } from '../../src/world/blocks.js';
const DOOR = new Set(BLOCKS.filter((b) => b && b.shape === 'door').map((b) => b.id));

const STEP = 0.6, JUMP = 1.25, TALL = 1.8;

export function region(gen, cx, cz, r) {
  const map = new Map();
  for (let z = (cz - r) >> 4; z <= (cz + r) >> 4; z++) for (let x = (cx - r) >> 4; x <= (cx + r) >> 4; x++) map.set(`${x},${z}`, gen.generate(x, z).blocks);
  const get = (x, y, z) => {
    if (y < 0 || y > 255) return 0;
    const b = map.get(`${x >> 4},${z >> 4}`);
    return b ? b[(y << 8) | ((z & 15) << 4) | (x & 15)] : 1; // outside: solid
  };
  return get;
}

export function walker(get, sealsOpen, doorsOpen = false) {
  const boxCache = new Map();
  const boxes = (x, y, z) => {
    const v = get(x, y, z), id = v & ID_MASK;
    if (!SOLID[id] || (sealsOpen && id === B.seal_door) || (doorsOpen && DOOR.has(id))) return null;
    const k = `${v}:${CONNECTS[id] ? connectionMask(v, (dx, dy, dz) => get(x + dx, y + dy, z + dz)) : 0}`;
    let bs = boxCache.get(k);
    if (!bs) { const conn = CONNECTS[id] ? connectionMask(v, (dx, dy, dz) => get(x + dx, y + dy, z + dz)) : 0; bs = collisionBoxes(v, conn); boxCache.set(k, bs); }
    return bs;
  };
  // is the column (x,z) free of collision between heights a and b?
  const free = (x, z, a, b) => {
    for (let y = Math.floor(a); y < Math.ceil(b); y++) {
      const bs = boxes(x, y, z);
      if (!bs) continue;
      for (const q of bs) if (y + q[1] < b - 1e-3 && y + q[4] > a + 1e-3) return false;
    }
    return true;
  };
  // highest place to stand in (x,z) at or below `limit`
  const support = (x, z, limit, minY) => {
    for (let y = Math.floor(limit); y >= minY; y--) {
      const bs = boxes(x, y, z);
      const tops = bs ? bs.map((q) => y + q[4]).filter((t) => t <= limit + 1e-6).sort((p, q) => q - p) : [];
      for (const t of tops) if (free(x, z, t, t + TALL)) return t;
      if (LIQUID[get(x, y, z) & ID_MASK] === 1) return null; // water: not modelled (swimming)
    }
    return null;
  };
  const climb = (x, y, z) => CLIMB[get(x, y, z) & ID_MASK];
  return { free, support, climb };
}

export function reach(get, start, targets, { sealsOpen = false, doorsOpen = false, box, surface = false }) {
  const W = walker(get, sealsOpen, doorsOpen);
  const s0 = W.support(start[0], start[2], surface ? 250 : start[1] + 0.5, start[1] - 20);
  assert.ok(s0 !== null, 'start position has ground');
  const key = (x, z, t) => `${x},${z},${Math.round(t * 2)}`;
  const seen = new Set([key(start[0], start[2], s0)]);
  const q = [[start[0], s0, start[2]]];
  const hit = new Set();
  while (q.length) {
    const [x, t, z] = q.shift();
    targets.forEach((g, i) => { if (Math.max(Math.abs(g[0] - x), Math.abs(g[2] - z)) <= 1 && Math.abs(g[1] - t) <= 1.5) hit.add(i); });
    if (hit.size === targets.length) break;
    const next = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < box[0] || nx > box[1] || nz < box[2] || nz > box[3]) continue;
      const t2 = W.support(nx, nz, t + JUMP, Math.floor(t) - 40);
      if (t2 === null) continue;
      const hi = Math.max(t, t2);
      if (!W.free(nx, nz, t2, hi + TALL)) continue;
      if (t2 > t + STEP && !W.free(x, z, t, hi + TALL)) continue; // a jump needs room overhead
      next.push([nx, t2, nz]);
    }
    // ladders
    const fy = Math.floor(t);
    if (W.climb(x, fy, z) || W.climb(x, fy + 1, z)) {
      if (W.free(x, z, t + 1, t + 1 + TALL)) next.push([x, t + 1, z]);
    }
    for (const n of next) {
      const k = key(n[0], n[2], n[1]);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  return targets.map((_, i) => hit.has(i));
}

