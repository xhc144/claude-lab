// Structures, generated deterministically inside the worker. Each structure type owns a grid of
// regions; a region holds at most one structure whose position and validity depend only on the
// seed and the pure column function, so every chunk it overlaps can rebuild it and keep only its
// own cells. The same `locate` functions run on the main thread for the compass and the map.

import { RNG, hash3 } from '../../core/noise.js';
import { B, pack, ID_MASK, SOLID, OPAQUE, LIQUID } from '../blocks.js';
import { BIOMES } from '../biomes.js';

export const STRUCTURE_INFO = {
  heart: { zh: '织心遗迹', icon: '◎' },
  ruin: { zh: '古代遗迹', icon: '⌂' },
  mine: { zh: '废弃矿道', icon: '⛏' },
  dungeon: { zh: '暗影巢穴', icon: '☠' },
  sky: { zh: '天穹神殿', icon: '☁', shard: 'shard_sky' },
  abyss: { zh: '深渊圣所', icon: '◆', shard: 'shard_abyss' },
  sand: { zh: '沙海方尖碑', icon: '▲', shard: 'shard_sand' },
  frost: { zh: '冰晶尖塔', icon: '❄', shard: 'shard_frost' },
  tide: { zh: '潮汐神殿', icon: '≈', shard: 'shard_tide' },
};
export const SHRINE_KINDS = ['sky', 'abyss', 'sand', 'frost', 'tide'];

const SEA = 62;
const keyOf = (b) => BIOMES[b].key;

// ---------------------------------------------------------------- drawing helpers
function put(W, x, y, z, v) { W.set(x, y, z, v, true); }
function fill(W, x0, y0, z0, x1, y1, z1, v) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) W.set(x, y, z, v, true);
}
function hollow(W, x0, y0, z0, x1, y1, z1, wall, inside = 0) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const edge = x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1;
    W.set(x, y, z, edge ? (typeof wall === 'function' ? wall(x, y, z) : wall) : inside, true);
  }
}
function chest(W, x, y, z, loot, facing = 2) {
  put(W, x, y, z, pack(B.chest, facing));
  W.feature({ type: 'chest', x, y, z, loot });
}
function foundation(W, x, y, z, v, depth = 10) {
  for (let k = 1; k <= depth; k++) {
    const cur = W.get(x, y - k, z);
    if (cur < 0) return;
    if (SOLID[cur & ID_MASK] && !LIQUID[cur & ID_MASK] && OPAQUE[cur & ID_MASK]) return;
    W.set(x, y - k, z, v, true);
  }
}
const mix = (r, opts) => opts[Math.floor(r.next() * opts.length)];
// the 16 cells of a 5×5 ring, in walking order (used by the frost spire's spiral stair)
const FROST_RING = [[-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [2, -1], [2, -2], [1, -2], [0, -2], [-1, -2], [-2, -2], [-2, -1], [-2, 0], [-2, 1]];

// A straight stairway descending toward -Z: `steps` stairs, step s at (x, yTop - s, zTop - s),
// each with three cells of headroom; the side cells get `side` at step level (null = leave).
// Build it after the rooms it connects, so they cannot overwrite the steps.
function stairway(W, x, yTop, zTop, steps, stairBlock, side, width = 1, base = side || B.cobblestone) {
  for (let s = 0; s < steps; s++) {
    const sy = yTop - s, sz = zTop - s;
    for (let dx = -width; dx <= width; dx++) {
      for (let k = 1; k <= 3; k++) put(W, x + dx, sy + k, sz, 0);
      if (dx === 0) put(W, x, sy, sz, pack(stairBlock, 2)); // tall half to the south (uphill)
      else if (side !== null) put(W, x + dx, sy, sz, side);
      if (dx === 0 || side !== null) foundation(W, x + dx, sy, sz, base, 3);
    }
  }
}

// ---------------------------------------------------------------- definitions
const S = {};

// The Heart Shrine: where the story starts, 16 blocks north of the spawn point.
S.heart = {
  unique: true, radius: 10,
  locate(gen) {
    const [sx, , sz] = gen.spawnPoint();
    const x = sx, z = sz - 16;
    return { x, y: gen.column(x, z).h + 1, z };
  },
  build(gen, W, o, r) {
    const { x: cx, y, z: cz } = o;
    for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
      const d = Math.hypot(dx, dz);
      if (d > 7.6) continue;
      const x = cx + dx, z = cz + dz;
      let v = d > 6.5 ? B.ancient_gold : d < 2.4 ? B.ancient_carved : r.next() < 0.18 ? B.mossy_bricks : B.ancient_bricks;
      if (d > 4 && r.next() < 0.06) v = B.moss;
      put(W, x, y - 1, z, v);
      foundation(W, x, y - 1, z, B.ancient_bricks, 12);
      for (let k = 0; k < 12; k++) put(W, x, y + k, z, 0);
    }
    put(W, cx, y, cz, B.heart_altar);
    const heights = [5, 3, 4, 2, 5];
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
      const px = Math.round(cx + Math.cos(a) * 5), pz = Math.round(cz + Math.sin(a) * 5);
      for (let h = 0; h < heights[k]; h++) put(W, px, y + h, pz, B.ancient_pillar);
      if (heights[k] >= 4) put(W, px, y + heights[k], pz, B.ancient_lamp);
      if (heights[k] <= 3) put(W, px + (k % 2 ? 1 : -1), y, pz, B.mossy_bricks);
      if (r.next() < 0.6) put(W, px, y + heights[k] - 1, pz + 1, pack(B.vines, 4));
    }
    put(W, cx, y, cz + 6, B.waystone);
    W.feature({ type: 'waystone', x: cx, y, z: cz + 6, name: '织心遗迹' });
    chest(W, cx - 3, y, cz + 4, 'heart', 2);
    for (const [ux, uz] of [[3, 4], [-5, -2], [4, -4]]) put(W, cx + ux, y, cz + uz, B.loot_urn);
    put(W, cx + 2, y, cz + 5, pack(B.lantern, 0));
    W.feature({ type: 'structure', kind: 'heart', x: cx, y, z: cz });
  },
};

// Small ruins dotted across the land.
S.ruin = {
  spacing: 9, salt: 11, radius: 9,
  locate(gen, rx, rz) {
    const r = new RNG(hash3(rx, rz, 11, gen.seed));
    if (r.next() < 0.25) return null;
    const x = rx * 144 + 16 + r.int(112), z = rz * 144 + 16 + r.int(112);
    const c = gen.column(x, z);
    const k = keyOf(c.biome);
    if (c.h <= SEA + 1 || c.h > SEA + 45 || c.island > 0.05) return null;
    if (!['meadow', 'forest', 'blossom', 'taiga', 'tundra', 'swamp', 'desert', 'mesa', 'barrens', 'mountains', 'beach'].includes(k)) return null;
    let lo = 999, hi = -999;
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]]) { const h = gen.column(x + dx, z + dz).h; lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (hi - lo > 5) return null;
    return { x, y: c.h + 1, z, variant: r.int(3), biome: k };
  },
  build(gen, W, o, r) {
    const { x: cx, y, z: cz } = o;
    const sand = o.biome === 'desert' || o.biome === 'mesa';
    const cold = o.biome === 'tundra' || o.biome === 'taiga' || o.biome === 'barrens';
    const wallA = sand ? B.cut_sandstone : cold ? B.deep_bricks : B.stone_bricks;
    const wallB = sand ? B.sandstone : cold ? B.deep_tiles : B.mossy_bricks;
    const floor = sand ? B.smooth_sandstone : cold ? B.deep_tiles : B.cracked_bricks;
    if (o.variant === 0 || o.variant === 2) {
      // crumbling courtyard
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, z = cz + dz;
        if (r.next() < 0.8) put(W, x, y - 1, z, r.next() < 0.5 ? floor : wallA);
        foundation(W, x, y - 1, z, wallA, 6);
        for (let k = 0; k < 6; k++) put(W, x, y + k, z, 0);
        const edge = Math.abs(dx) === 4 || Math.abs(dz) === 4;
        if (edge && !(dz === 4 && Math.abs(dx) <= 1)) {
          const hgt = Math.max(0, Math.floor(r.next() * 5) - (Math.abs(dx) + Math.abs(dz) === 8 ? -1 : 1));
          for (let k = 0; k < hgt; k++) put(W, x, y + k, z, r.next() < 0.3 ? wallB : wallA);
        }
      }
      for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) for (let k = 0; k < 4; k++) put(W, cx + dx, y + k, cz + dz, B.ancient_pillar);
      put(W, cx - 4, y + 4, cz - 4, B.ancient_lamp);
      put(W, cx + 2, y, cz - 2, B.loot_urn); put(W, cx - 2, y, cz + 1, B.loot_urn);
      if (r.next() < 0.6) chest(W, cx + 3, y, cz - 3, 'ruin', r.int(4));
      if (o.variant === 2) { put(W, cx, y, cz, B.waystone); W.feature({ type: 'waystone', x: cx, y, z: cz, name: '' }); }
      else if (r.next() < 0.5) put(W, cx, y, cz, B.ancient_carved);
    } else {
      // an arch over a stairway down to a cellar
      for (let k = 0; k < 4; k++) { put(W, cx - 2, y + k, cz, B.ancient_pillar); put(W, cx + 2, y + k, cz, B.ancient_pillar); }
      fill(W, cx - 2, y + 4, cz, cx + 2, y + 4, cz, B.ancient_bricks);
      put(W, cx, y + 4, cz, B.ancient_carved);
      put(W, cx, y + 3, cz, pack(B.lantern, 1));
      // the cellar, then a stair shaft from the surface down into it (7 steps, the last one
      // standing in the cellar doorway at floor level)
      const ry = y - 7, rz = cz - 10;
      hollow(W, cx - 3, ry - 1, rz - 3, cx + 3, ry + 3, rz + 3, (x, yy) => (yy === ry - 1 ? floor : r.next() < 0.3 ? wallB : wallA));
      stairway(W, cx, y - 1, cz - 1, 7, B.cobblestone_stairs, wallA);
      chest(W, cx, ry, rz - 2, 'ruin', 2);
      put(W, cx - 2, ry, rz - 2, B.loot_urn); put(W, cx + 2, ry, rz - 2, B.loot_urn);
      put(W, cx + 2, ry + 2, rz, pack(B.torch, 4));
      put(W, cx - 2, ry, rz + 1, B.bookshelf);
    }
    W.feature({ type: 'structure', kind: 'ruin', x: cx, y, z: cz });
  },
};

// Abandoned mineshafts: branching corridors with supports, rails and chests.
S.mine = {
  spacing: 14, salt: 23, radius: 52,
  locate(gen, rx, rz) {
    const r = new RNG(hash3(rx, rz, 23, gen.seed));
    if (r.next() < 0.35) return null;
    const x = rx * 224 + 56 + r.int(112), z = rz * 224 + 56 + r.int(112);
    const c = gen.column(x, z);
    if (c.h < SEA - 20) return null;
    return { x, y: Math.min(c.h - 18, 26 + r.int(20)), z, seed: r.int(1 << 30) };
  },
  plan(o) {
    const r = new RNG(o.seed);
    const segs = [];
    const open = [[o.x, o.y, o.z, r.int(4), 0]];
    while (open.length && segs.length < 14) {
      const [x, y, z, dir, depth] = open.shift();
      const len = 8 + r.int(18);
      const [dx, dz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
      const ex = x + dx * len, ez = z + dz * len;
      if (Math.abs(ex - o.x) > 46 || Math.abs(ez - o.z) > 46) continue;
      segs.push({ x, y, z, dx, dz, len, rails: r.next() < 0.6, chest: r.next() < 0.35 ? 3 + r.int(len - 4) : -1, webs: r.next() < 0.4 });
      if (depth < 3) {
        for (const nd of [(dir + 1) % 4, (dir + 3) % 4, dir]) if (r.next() < 0.5) open.push([ex, y, ez, nd, depth + 1]);
      }
    }
    return segs;
  },
  build(gen, W, o, r) {
    // central room
    hollow(W, o.x - 3, o.y - 1, o.z - 3, o.x + 3, o.y + 3, o.z + 3, B.oak_planks);
    fill(W, o.x - 2, o.y, o.z - 2, o.x + 2, o.y + 2, o.z + 2, 0);
    for (const seg of this.plan(o)) {
      for (let i = 0; i <= seg.len; i++) {
        const x = seg.x + seg.dx * i, z = seg.z + seg.dz * i;
        const px = seg.dz, pz = seg.dx; // perpendicular
        for (let w = -1; w <= 1; w++) {
          const ax = x + px * w, az = z + pz * w;
          for (let k = 0; k < 3; k++) put(W, ax, seg.y + k, az, 0);
          const fl = W.get(ax, seg.y - 1, az);
          if (fl >= 0 && !SOLID[fl & ID_MASK]) put(W, ax, seg.y - 1, az, B.oak_planks);
        }
        if (i % 4 === 0) {
          put(W, x - px, seg.y, z - pz, B.oak_fence); put(W, x - px, seg.y + 1, z - pz, B.oak_fence);
          put(W, x + px, seg.y, z + pz, B.oak_fence); put(W, x + px, seg.y + 1, z + pz, B.oak_fence);
          for (let w = -1; w <= 1; w++) put(W, x + px * w, seg.y + 2, z + pz * w, B.oak_planks);
          if (r.next() < 0.25) put(W, x, seg.y + 1, z, pack(B.lantern, 1));
        }
        if (seg.rails && r.next() < 0.85) put(W, x, seg.y, z, pack(B.rail, seg.dx ? 1 : 0));
        if (seg.webs && r.next() < 0.08) put(W, x + px * (r.next() < 0.5 ? 1 : -1), seg.y + 2, z + pz, B.cobweb);
        if (i === seg.chest) chest(W, x + px, seg.y, z + pz, 'mine', seg.dx ? (seg.dz ? 0 : 0) : 1);
      }
    }
    W.feature({ type: 'structure', kind: 'mine', x: o.x, y: o.y, z: o.z });
  },
};

// Gloom nests: a spawner room deep in the rock.
S.dungeon = {
  spacing: 7, salt: 37, radius: 6,
  locate(gen, rx, rz) {
    const r = new RNG(hash3(rx, rz, 37, gen.seed));
    if (r.next() < 0.45) return null;
    const x = rx * 112 + 12 + r.int(88), z = rz * 112 + 12 + r.int(88);
    const c = gen.column(x, z);
    const y = 14 + r.int(Math.max(1, Math.min(36, c.h - 26)));
    if (y > c.h - 10) return null;
    return { x, y, z };
  },
  build(gen, W, o, r) {
    hollow(W, o.x - 4, o.y - 1, o.z - 4, o.x + 4, o.y + 4, o.z + 4, () => (r.next() < 0.5 ? B.mossy_bricks : r.next() < 0.5 ? B.deep_bricks : B.cobblestone));
    put(W, o.x, o.y, o.z, B.gloom_nest);
    chest(W, o.x - 3, o.y, o.z + 3, 'dungeon', 2);
    if (r.next() < 0.5) chest(W, o.x + 3, o.y, o.z - 3, 'dungeon', 0);
    for (let k = 0; k < 4; k++) put(W, o.x - 3 + r.int(7), o.y + 3, o.z - 3 + r.int(7), B.cobweb);
    W.feature({ type: 'structure', kind: 'dungeon', x: o.x, y: o.y, z: o.z });
    W.feature({ type: 'nest', x: o.x, y: o.y, z: o.z });
  },
};

// ---------------------------------------------------------------- the five shard shrines
function shrineLocate(spacing, salt, test) {
  return (gen, rx, rz) => {
    const r = new RNG(hash3(rx, rz, salt, gen.seed));
    const size = spacing * 16;
    for (let t = 0; t < 28; t++) {
      const x = rx * size + 40 + r.int(size - 80), z = rz * size + 40 + r.int(size - 80);
      const res = test(gen, x, z, r);
      if (res) return { x, z, ...res };
    }
    return null;
  };
}
function sealRow(W, x0, y0, z0, x1, y1, z1) { fill(W, x0, y0, z0, x1, y1, z1, B.seal_door); }
function shardRoomChest(W, x, y, z, kind) { chest(W, x, y, z, `shard_${kind}`, 2); }

S.sky = {
  spacing: 30, salt: 101, radius: 24, shrine: true,
  locate: shrineLocate(30, 101, (gen, x, z) => (gen.column(x, z).island > 0.42 ? { y: 200 } : null)),
  build(gen, W, o, r) {
    const { x: cx, z: cz } = o, y = o.y;
    const island = (ix, iz, rad, topBlock = B.sky_grass) => {
      for (let dz = -rad - 1; dz <= rad + 1; dz++) for (let dx = -rad - 1; dx <= rad + 1; dx++) {
        const d = Math.hypot(dx, dz);
        if (d > rad + 0.5) continue;
        const depth = Math.max(1, Math.round((rad + 0.5 - d) * 1.3));
        for (let k = 0; k < depth; k++) put(W, ix + dx, y - 1 - k, iz + dz, k === 0 ? topBlock : k < 3 ? B.dirt : k === depth - 1 && r.next() < 0.3 ? B.levistone : B.stone);
        if (d > rad - 1 && r.next() < 0.35) put(W, ix + dx, y - 1 - depth, iz + dz, B.cloud_block);
      }
    };
    island(cx, cz, 9);
    // temple
    hollow(W, cx - 4, y, cz - 4, cx + 4, y + 6, cz + 4, (x, yy, z) => (yy === y + 6 ? B.ancient_gold : (x + z) % 3 === 0 ? B.ancient_carved : B.ancient_bricks));
    fill(W, cx - 3, y, cz - 3, cx + 3, y, cz + 3, B.ancient_carved);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) for (let k = 0; k < 8; k++) put(W, cx + dx, y + k, cz + dz, B.ancient_pillar);
    sealRow(W, cx - 1, y + 1, cz + 4, cx + 1, y + 3, cz + 4);
    put(W, cx, y + 5, cz, B.ancient_lamp);
    shardRoomChest(W, cx, y + 1, cz - 2, 'sky');
    put(W, cx - 2, y + 1, cz - 2, pack(B.crystal_lantern, 0)); put(W, cx + 2, y + 1, cz - 2, pack(B.crystal_lantern, 0));
    // three outlying rocks carry the rune pedestals
    for (let k = 0; k < 3; k++) {
      const a = Math.PI / 2 + k * (Math.PI * 2 / 3) + 0.4;
      const ix = Math.round(cx + Math.cos(a) * 16), iz = Math.round(cz + Math.sin(a) * 16);
      island(ix, iz, 3);
      // a two-wide cloud-plank bridge out to the rock
      for (let t = 8; t <= 14; t += 0.5) for (const w of [0, 1]) {
        const bx = Math.round(cx + Math.cos(a) * t - Math.sin(a) * w), bz = Math.round(cz + Math.sin(a) * t + Math.cos(a) * w);
        if (W.get(bx, y - 1, bz) === 0) put(W, bx, y - 1, bz, B.cloud_planks);
      }
      put(W, ix, y, iz, B.rune_pedestal);
      put(W, ix + 1, y, iz + 1, pack(B.crystal_lantern, 0));
    }
    // a step up onto the threshold of the sealed door
    put(W, cx, y, cz + 5, pack(B.stone_bricks_stairs, 0));
    // a launch pad and a sign of the way
    put(W, cx, y, cz + 7, B.launch_pad);
    W.feature({ type: 'structure', kind: 'sky', x: cx, y, z: cz });
  },
};

S.abyss = {
  spacing: 28, salt: 202, radius: 26, shrine: true,
  locate: shrineLocate(28, 202, (gen, x, z) => { const c = gen.column(x, z); return c.h > SEA + 2 && c.h < SEA + 40 && c.island < 0.05 ? { y: 22, top: c.h } : null; }),
  build(gen, W, o, r) {
    const { x: cx, z: cz } = o, y = o.y;
    // the great hall
    hollow(W, cx - 10, y - 1, cz - 6, cx + 10, y + 7, cz + 6, (x, yy) => (yy === y - 1 ? B.deep_tiles : yy === y + 7 ? B.deep_bricks : r.next() < 0.15 ? B.ancient_carved : B.deep_bricks));
    for (let x = -8; x <= 8; x += 4) for (const z of [-4, 4]) { for (let k = 0; k < 7; k++) put(W, cx + x, y + k, cz + z, B.ancient_pillar); put(W, cx + x, y + 6, cz + z + (z > 0 ? -1 : 1), B.ancient_lamp); }
    for (const [dx, dz] of [[-8, -2], [-8, 2], [-2, -5], [2, 5]]) put(W, cx + dx, y, cz + dz, B.rune_pedestal);
    // shard vault to the east, behind a seal
    hollow(W, cx + 10, y - 1, cz - 3, cx + 16, y + 4, cz + 3, B.ancient_gold);
    sealRow(W, cx + 10, y, cz - 1, cx + 10, y + 2, cz + 1);
    shardRoomChest(W, cx + 14, y, cz, 'abyss');
    put(W, cx + 13, y + 3, cz, B.ancient_lamp);
    // a shaft with a ladder from the surface down to the west door of the hall
    const sx = cx - 13;
    const top = o.top;
    for (let yy = y; yy <= top + 3; yy++) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(W, sx + dx, yy, cz + dz, (Math.abs(dx) === 1 || Math.abs(dz) === 1) && yy <= top ? B.deep_bricks : 0);
      put(W, sx, yy, cz, 0);
      if (yy <= top) put(W, sx, yy, cz - 1, B.deep_bricks), put(W, sx, yy, cz, pack(B.ladder, 0));
    }
    fill(W, sx, y, cz, cx - 10, y + 2, cz, 0);
    fill(W, sx + 1, y, cz - 1, cx - 10, y + 2, cz + 1, 0);
    for (let x = sx + 1; x < cx - 10; x++) { put(W, x, y - 1, cz - 1, B.deep_tiles); put(W, x, y - 1, cz, B.deep_tiles); put(W, x, y - 1, cz + 1, B.deep_tiles); }
    // marker arch on the surface
    for (let k = 1; k <= 4; k++) { put(W, sx - 2, top + k, cz, B.ancient_pillar); put(W, sx + 2, top + k, cz, B.ancient_pillar); }
    fill(W, sx - 2, top + 5, cz, sx + 2, top + 5, cz, B.deep_bricks);
    put(W, sx, top + 5, cz, B.ancient_lamp);
    W.feature({ type: 'structure', kind: 'abyss', x: cx, y, z: cz, entrance: [sx, top + 1, cz] });
    W.feature({ type: 'warden', x: cx, y, z: cz });
  },
};

S.sand = {
  spacing: 28, salt: 303, radius: 14, shrine: true,
  locate: shrineLocate(28, 303, (gen, x, z) => { const c = gen.column(x, z); const k = keyOf(c.biome); return (k === 'desert' || k === 'mesa') && c.h > SEA + 1 ? { y: c.h + 1 } : null; }),
  build(gen, W, o, r) {
    const { x: cx, y, z: cz } = o;
    // stepped base and the needle
    for (let s = 0; s < 2; s++) fill(W, cx - 3 + s, y - 1 + s, cz - 3 + s, cx + 3 - s, y - 1 + s, cz + 3 - s, B.cut_sandstone);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) foundation(W, cx + dx, y - 1, cz + dz, B.sandstone, 8);
    for (let k = 1; k < 24; k++) fill(W, cx - 1, y + k, cz - 1, cx + 1, y + k, cz + 1, k % 6 === 0 ? B.chiseled_stone : k % 6 === 3 ? B.cut_sandstone : B.sandstone);
    fill(W, cx - 1, y + 24, cz - 1, cx + 1, y + 24, cz + 1, B.gold_block);
    put(W, cx, y + 25, cz, B.gold_block);
    // the chamber under the sand, reached by a hidden stairway on the north face that runs
    // all the way down to the chamber floor (11 steps; the last one stands inside the room)
    const ry = y - 11, rz = cz - 18;
    hollow(W, cx - 5, ry - 1, rz - 5, cx + 5, ry + 4, rz + 5, (x, yy) => (yy === ry - 1 ? B.smooth_sandstone : B.cut_sandstone));
    stairway(W, cx, y - 1, cz - 4, 11, B.smooth_sandstone_stairs, null, 0, B.sandstone);
    // line the cut below ground with sandstone so the loose sand around cannot pour in
    for (let s = 0; s < 9; s++) {
      const sy = y - 1 - s, sz = cz - 4 - s;
      for (let k = 1; k <= 3; k++) if (sy + k <= y - 1) { put(W, cx - 1, sy + k, sz, B.cut_sandstone); put(W, cx + 1, sy + k, sz, B.cut_sandstone); }
      if (sy + 4 <= y - 1) put(W, cx, sy + 4, sz, B.cut_sandstone);
    }
    for (const [dx, dz] of [[-4, 0], [4, 0], [0, 4]]) put(W, cx + dx, ry, rz + dz, B.rune_pedestal);
    put(W, cx - 4, ry + 3, rz - 4, B.ancient_lamp); put(W, cx + 4, ry + 3, rz - 4, B.ancient_lamp);
    hollow(W, cx - 2, ry - 1, rz - 9, cx + 2, ry + 3, rz - 5, B.gold_block);
    sealRow(W, cx - 1, ry, rz - 5, cx + 1, ry + 1, rz - 5);
    shardRoomChest(W, cx, ry, rz - 7, 'sand');
    W.feature({ type: 'structure', kind: 'sand', x: cx, y, z: cz });
  },
};

S.frost = {
  spacing: 28, salt: 404, radius: 8, shrine: true,
  locate: shrineLocate(28, 404, (gen, x, z) => { const c = gen.column(x, z); const k = keyOf(c.biome); return (k === 'barrens' || k === 'tundra' || k === 'taiga') && c.h > SEA + 1 ? { y: c.h + 1 } : null; }),
  build(gen, W, o, r) {
    const { x: cx, y, z: cz } = o;
    const H = 30;
    for (let k = -1; k <= H; k++) for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx, dz);
      const rad = 4.6 - Math.max(0, k - 25) * 0.25; // the crown narrows above its walkway
      if (d > rad + 0.5) continue;
      const x = cx + dx, z = cz + dz;
      if (k === -1) { put(W, x, y - 1, z, B.packed_ice); foundation(W, x, y - 1, z, B.packed_ice, 8); continue; }
      if (d > rad - 0.7 || k === H || k % 8 === 7) put(W, x, y + k, z, (dx + k) % 5 === 0 ? B.pale_crystal : B.packed_ice);
      else put(W, x, y + k, z, 0);
    }
    // A spiral of half-block steps winds around a 3×3 ice core: 16 cells of the 5×5 ring per
    // turn, half a block higher per cell, so each turn climbs exactly one storey (8 blocks).
    // Every step keeps three cells of headroom, which also opens the way through each floor.
    fill(W, cx - 1, y, cz - 1, cx + 1, y + 22, cz + 1, B.packed_ice);
    for (const k of [3, 11, 19]) for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) put(W, cx + dx, y + k, cz + dz, B.ancient_lamp);
    const ring = FROST_RING;
    const top = 23; // the crown floor
    for (let i = 0; i <= top * 2; i++) {
      const [dx, dz] = ring[i % 16], L = i >> 1;
      put(W, cx + dx, y + L, cz + dz, pack(B.polished_stone_slab, i & 1)); // bottom, then top half
      for (let k = 1; k <= 3; k++) put(W, cx + dx, y + L + k, cz + dz, 0);
    }
    // rune pedestals on the two upper storeys and in the crown
    put(W, cx + 3, y + 8, cz, B.rune_pedestal);
    put(W, cx - 3, y + 16, cz, B.rune_pedestal);
    put(W, cx + ring[5][0], y + top + 1, cz + ring[5][1], B.rune_pedestal);
    // ground-floor entrance on the south side, with a cleared, paved approach
    fill(W, cx - 1, y, cz + 4, cx + 1, y + 2, cz + 5, 0);
    for (let dz = 5; dz <= 8; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (let k = 0; k < 3; k++) put(W, cx + dx, y + k, cz + dz, 0);
      put(W, cx + dx, y - 1, cz + dz, B.packed_ice);
      foundation(W, cx + dx, y - 1, cz + dz, B.packed_ice, 6);
    }
    // the crown vault: a sealed cell on top of the core, its door facing the spiral's last step
    for (let k = 1; k <= 3; k++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) put(W, cx, y + top + k, cz, 0);
      else put(W, cx + dx, y + top + k, cz + dz, B.packed_ice);
    }
    fill(W, cx - 1, y + top + 4, cz - 1, cx + 1, y + top + 4, cz + 1, B.pale_crystal);
    sealRow(W, cx - 1, y + top + 1, cz, cx - 1, y + top + 2, cz);
    shardRoomChest(W, cx, y + top + 1, cz, 'frost');
    put(W, cx, y + 29, cz, B.ancient_lamp);
    W.feature({ type: 'structure', kind: 'frost', x: cx, y, z: cz });
  },
};

S.tide = {
  spacing: 28, salt: 505, radius: 10, shrine: true,
  locate: shrineLocate(28, 505, (gen, x, z) => { const c = gen.column(x, z); const k = keyOf(c.biome); return (k === 'ocean' || k === 'frozen_ocean') && c.h < SEA - 9 ? { y: c.h + 1 } : null; }),
  build(gen, W, o, r) {
    const { x: cx, y, z: cz } = o;
    const wall = (x, yy, z) => ((x + yy + z) % 4 === 0 ? B.copper_tiles : (x * 3 + z) % 5 === 0 ? B.glaze_teal : B.stone_bricks);
    hollow(W, cx - 7, y - 1, cz - 7, cx + 7, y + 8, cz + 7, wall, B.water);
    for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) foundation(W, cx + dx, y - 1, cz + dz, B.stone_bricks, 6);
    fill(W, cx - 1, y, cz + 7, cx + 1, y + 2, cz + 7, B.water);
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) put(W, cx + dx, y, cz + dz, B.rune_pedestal);
    for (const [dx, dz] of [[-6, 0], [6, 0]]) put(W, cx + dx, y + 3, cz + dz, B.ancient_lamp);
    // a breathing pocket near the roof
    hollow(W, cx - 2, y + 4, cz + 1, cx + 2, y + 7, cz + 4, B.glass, 0);
    fill(W, cx - 1, y + 4, cz + 2, cx + 1, y + 4, cz + 2, B.water);
    put(W, cx, y + 6, cz + 3, B.lamp_stone);
    // the dry treasury behind a seal
    hollow(W, cx - 3, y - 1, cz - 7, cx + 3, y + 4, cz - 3, B.copper_tiles, 0);
    sealRow(W, cx - 1, y, cz - 3, cx + 1, y + 1, cz - 3);
    shardRoomChest(W, cx, y, cz - 5, 'tide');
    put(W, cx, y + 3, cz - 5, B.ancient_lamp);
    W.feature({ type: 'structure', kind: 'tide', x: cx, y, z: cz });
  },
};

export const STRUCTURES = S;
const ORDER = ['heart', 'ruin', 'mine', 'dungeon', 'sky', 'abyss', 'sand', 'frost', 'tide'];

const locCache = new Map();
function locateRegion(gen, kind, rx, rz) {
  const k = `${gen.seed}:${kind}:${rx}:${rz}`;
  if (locCache.has(k)) return locCache.get(k);
  const s = S[kind];
  const o = s.unique ? (rx === 0 && rz === 0 ? s.locate(gen) : null) : s.locate(gen, rx, rz);
  if (locCache.size > 5000) locCache.clear();
  locCache.set(k, o);
  return o;
}

export function placeStructures(gen, W, cx, cz) {
  const bx0 = cx * 16, bz0 = cz * 16;
  for (const kind of ORDER) {
    const s = S[kind];
    if (s.unique) {
      const o = locateRegion(gen, kind, 0, 0);
      if (o && Math.abs(o.x - (bx0 + 8)) <= s.radius + 8 && Math.abs(o.z - (bz0 + 8)) <= s.radius + 8) s.build(gen, W, o, new RNG(hash3(o.x, o.z, 999, gen.seed)));
      continue;
    }
    const size = s.spacing * 16;
    const rx0 = Math.floor((bx0 - s.radius) / size), rx1 = Math.floor((bx0 + 15 + s.radius) / size);
    const rz0 = Math.floor((bz0 - s.radius) / size), rz1 = Math.floor((bz0 + 15 + s.radius) / size);
    for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
      const o = locateRegion(gen, kind, rx, rz);
      if (!o) continue;
      if (o.x + s.radius < bx0 || o.x - s.radius > bx0 + 15 || o.z + s.radius < bz0 || o.z - s.radius > bz0 + 15) continue;
      // the heart shrine keeps its surroundings clear of other structures
      if (kind !== 'heart') { const h = locateRegion(gen, 'heart', 0, 0); if (h && Math.hypot(o.x - h.x, o.z - h.z) < 40 && (kind === 'ruin' || kind === 'sand' || kind === 'frost')) continue; }
      s.build(gen, W, o, new RNG(hash3(o.x, o.z, s.salt, gen.seed)));
    }
  }
}

// All structures of a kind near (x,z), nearest first. Used by the compass, /locate and the map.
export function locateStructures(gen, kind, x, z, regionRadius = 3) {
  const s = S[kind];
  if (s.unique) { const o = locateRegion(gen, kind, 0, 0); return o ? [o] : []; }
  const size = s.spacing * 16;
  const crx = Math.floor(x / size), crz = Math.floor(z / size);
  const out = [];
  for (let rz = crz - regionRadius; rz <= crz + regionRadius; rz++) for (let rx = crx - regionRadius; rx <= crx + regionRadius; rx++) {
    const o = locateRegion(gen, kind, rx, rz);
    if (o) out.push({ ...o, kind, d: Math.hypot(o.x - x, o.z - z) });
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}
