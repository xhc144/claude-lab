// Can a player actually walk through the generated buildings? Each structure is generated with
// the real terrain around it, then searched with player movement rules: auto-step 0.6, jump
// 1.25, 1.8 of headroom, any drop, ladders climb. Rune pedestals must be reachable with the
// seals closed, shard chests once they are open.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldGen } from '../../src/world/gen/worldgen.js';
import { locateStructures } from '../../src/world/gen/structures.js';
import { B, ID_MASK, SOLID, CLIMB, LIQUID } from '../../src/world/blocks.js';
import { collisionBoxes, CONNECTS, connectionMask } from '../../src/world/models.js';

const STEP = 0.6, JUMP = 1.25, TALL = 1.8;

function region(gen, cx, cz, r) {
  const map = new Map();
  for (let z = (cz - r) >> 4; z <= (cz + r) >> 4; z++) for (let x = (cx - r) >> 4; x <= (cx + r) >> 4; x++) map.set(`${x},${z}`, gen.generate(x, z).blocks);
  const get = (x, y, z) => {
    if (y < 0 || y > 255) return 0;
    const b = map.get(`${x >> 4},${z >> 4}`);
    return b ? b[(y << 8) | ((z & 15) << 4) | (x & 15)] : 1; // outside: solid
  };
  return get;
}

function walker(get, sealsOpen) {
  const boxCache = new Map();
  const boxes = (x, y, z) => {
    const v = get(x, y, z), id = v & ID_MASK;
    if (!SOLID[id] || (sealsOpen && id === B.seal_door)) return null;
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

function reach(get, start, targets, { sealsOpen = false, box, surface = false }) {
  const W = walker(get, sealsOpen);
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

// find pedestals and shard chests of a structure in the generated region
function scan(get, cx, cy, cz, r, ry) {
  const peds = [], chests = [];
  for (let y = cy - ry; y <= cy + ry; y++) for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
    const id = get(x, y, z) & ID_MASK;
    if (id === B.rune_pedestal) peds.push([x, y, z]);
    else if (id === B.chest) chests.push([x, y, z]);
  }
  return { peds, chests };
}

const SEEDS = [20261012, 424242];

for (const seed of SEEDS) {
  const gen = new WorldGen(seed);
  const near = (kind) => { const [x, , z] = gen.spawnPoint(); return locateStructures(gen, kind, x, z, 4)[0]; };

  test(`sand obelisk: pedestals and the shard vault can be walked to (seed ${seed})`, () => {
    const o = near('sand');
    const get = region(gen, o.x, o.z - 12, 30);
    const { peds, chests } = scan(get, o.x, o.y - 11, o.z - 18, 8, 6);
    assert.equal(peds.length, 3);
    const start = [o.x + 6, o.y, o.z - 6], top = { surface: true };
    const box = [o.x - 30, o.x + 30, o.z - 42, o.z + 18];
    assert.deepEqual(reach(get, start, peds, { box, ...top }), peds.map(() => true), 'pedestals reachable');
    assert.deepEqual(reach(get, start, chests, { box, sealsOpen: true, ...top }), chests.map(() => true), 'vault reachable');
    // and back out again: from the chamber floor up to the surface
    const back = reach(get, [o.x, o.y - 11, o.z - 18], [[o.x, o.y, o.z - 3]], { box });
    assert.deepEqual(back, [true], 'the stairway leads back up');
  });

  test(`frost spire: the spiral stair reaches every storey and the crown (seed ${seed})`, () => {
    const o = near('frost');
    const get = region(gen, o.x, o.z, 14);
    const { peds, chests } = scan(get, o.x, o.y + 15, o.z, 5, 16);
    assert.equal(peds.length, 3);
    const start = [o.x, o.y, o.z + 9], top = { surface: true };
    const box = [o.x - 12, o.x + 12, o.z - 12, o.z + 12];
    assert.deepEqual(reach(get, start, peds, { box, ...top }), peds.map(() => true), 'all pedestals reachable');
    assert.deepEqual(reach(get, start, chests, { box, sealsOpen: true, ...top }), [true], 'crown vault reachable');
    assert.deepEqual(reach(get, start, chests, { box, sealsOpen: false, ...top }), [false], 'the seal really blocks the vault');
  });

  test(`sky temple: the pedestal rocks are bridged and the vault is reachable (seed ${seed})`, () => {
    const o = near('sky');
    const get = region(gen, o.x, o.z, 22);
    const { peds, chests } = scan(get, o.x, o.y, o.z, 20, 3);
    assert.equal(peds.length, 3);
    const start = [o.x, o.y, o.z + 7];
    const box = [o.x - 24, o.x + 24, o.z - 24, o.z + 24];
    assert.deepEqual(reach(get, start, peds, { box }), peds.map(() => true));
    assert.deepEqual(reach(get, start, chests, { box, sealsOpen: true }), [true]);
  });

  test(`ruin cellars can be entered and left (seed ${seed})`, () => {
    const [sx, , sz] = gen.spawnPoint();
    const cellars = locateStructures(gen, 'ruin', sx, sz, 4).filter((o) => o.variant === 1).slice(0, 2);
    assert.ok(cellars.length > 0, 'found a ruin with a cellar');
    for (const o of cellars) {
      const get = region(gen, o.x, o.z - 5, 14);
      const room = [o.x, o.y - 7, o.z - 10];
      const box = [o.x - 14, o.x + 14, o.z - 18, o.z + 14];
      const start = [o.x, o.y, o.z + 1];
      assert.deepEqual(reach(get, start, [room], { box, surface: true }), [true], `down into the cellar at ${o.x},${o.z}`);
      assert.deepEqual(reach(get, room, [start], { box }), [true], `back out of the cellar at ${o.x},${o.z}`);
    }
  });
}
