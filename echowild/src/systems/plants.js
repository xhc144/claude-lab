// Living blocks: crops, farmland moisture, saplings → trees, grass spread, leaf decay, berries,
// reeds/cactus/vines, crystal growth, melting ice, fire, bone meal, and the light you carry.

import { BLOCKS, B, ID_MASK, ID_BITS, LIQUID, SOLID, OPAQUE, REPLACEABLE, FLAMMABLE, pack } from '../world/blocks.js';
import { I, ITEMS } from '../world/items.js';
import { blockDrops } from '../world/drops.js';
import { FACE_N } from '../world/placement.js';
import { RNG } from '../core/noise.js';

export function installPlants(game) {
  const w = game.world;
  const R = w.handlers.random;
  const rnd = Math.random;

  const lightAt = (x, y, z) => {
    const l = w.getLight(x, y, z);
    const sky = (l & 15) * (game.sky ? Math.max(0.25, game.sky.daylight) : 1);
    return Math.max(sky, (l >> 4) & 15, (l >> 8) & 15, (l >> 12) & 15);
  };
  const drop = (x, y, z, v) => { for (const s of blockDrops(v, null)) game.entities.spawnItem(x + 0.5, y + 0.4, z + 0.5, s); };
  const sparkle = (x, y, z) => { if (game.particles) for (let i = 0; i < 8; i++) game.particles.add({ x: x + rnd(), y: y + rnd() * 0.8, z: z + rnd(), vy: 0.6, r: 0.5, g: 1, b: 0.55, a: 0.9, size: 0.06, life: 0.9, em: 1, additive: true }); };

  // ---- crops
  const growCrop = (x, y, z, v, boost = 0) => {
    const id = v & ID_MASK, d = BLOCKS[id];
    let st = (v >>> ID_BITS) & 7;
    if (st < 7) { st = Math.min(7, st + 1 + boost); w.setBlock(x, y, z, pack(id, st)); return true; }
    if (d.crop.fruit) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => rnd() - 0.5);
      for (const [dx, dz] of dirs) {
        const t = w.getId(x + dx, y, z + dz), below = w.getId(x + dx, y - 1, z + dz);
        if (!t && (below === B.farmland || below === B.dirt || below === B.grass)) { w.setBlock(x + dx, y, z + dz, B[d.crop.fruit]); return true; }
        if (t === B[d.crop.fruit]) return false;
      }
    }
    return false;
  };
  for (const name of ['wheat', 'radish', 'melon_stem', 'sunroot']) {
    R[B[name]] = (world, x, y, z, v) => {
      if (lightAt(x, y + 1, z) < 9) return;
      const wet = (w.getMeta(x, y - 1, z) & 1) === 1;
      if (rnd() < (wet ? 0.35 : 0.15)) growCrop(x, y, z, v);
    };
  }
  R[B.farmland] = (world, x, y, z, v) => {
    let wet = false;
    for (let dz = -4; dz <= 4 && !wet; dz++) for (let dx = -4; dx <= 4 && !wet; dx++) for (const dy of [0, 1]) if (LIQUID[w.getId(x + dx, y + dy, z + dz)] === 1) { wet = true; break; }
    if (!wet && game.weather && game.weather.isRainingAt(x, y + 1, z)) wet = true;
    const m = (v >>> ID_BITS) & 1;
    if (wet !== !!m) w.setBlock(x, y, z, pack(B.farmland, wet ? 1 : 0));
    else if (!wet && !BLOCKS[w.getId(x, y + 1, z)].crop && rnd() < 0.2) w.setBlock(x, y, z, B.dirt);
  };
  w.handlers.neighbor[B.farmland] = (world, x, y, z) => { if (SOLID[w.getId(x, y + 1, z)]) w.setBlock(x, y, z, B.dirt); };

  // ---- saplings grow into the same trees the world generator plants
  const writer = {
    inside: (x, z) => w.isLoaded(x, z),
    get: (x, y, z) => w.getBlock(x, y, z) & ID_MASK,
    set(x, y, z, v) {
      const c = w.getBlock(x, y, z) & ID_MASK;
      if (c && !REPLACEABLE[c] && !BLOCKS[c].leaves && !BLOCKS[c].name.endsWith('_sapling')) return;
      w.setBlock(x, y, z, v);
    },
    setIfAir(x, y, z, v) { const c = w.getBlock(x, y, z) & ID_MASK; if (!c || REPLACEABLE[c]) w.setBlock(x, y, z, v); },
    feature() {},
  };
  const TREE_OF = { oak_sapling: 'oak', birch_sapling: 'birch', pine_sapling: 'pine', blossom_sapling: 'blossom', willow_sapling: 'willow', cloud_sapling: 'cloud' };
  game.growTree = (x, y, z, v) => {
    const name = BLOCKS[v & ID_MASK].name;
    // need some head room
    for (let k = 1; k <= 4; k++) { const c = w.getId(x, y + k, z); if (c && !REPLACEABLE[c] && !BLOCKS[c].leaves) return false; }
    w.setBlock(x, y, z, 0);
    const r = new RNG((x * 73856093) ^ (z * 19349663) ^ (game.world.time | 0));
    const gen = game.gen, kind = TREE_OF[name];
    if (kind === 'cloud') {
      const hh = 4 + r.int(3);
      for (let i = 0; i < hh; i++) writer.set(x, y + i, z, B.cloud_log);
      gen.leafBall(writer, x, y + hh, z, 2.6, B.cloud_leaves, r, 0.7);
    } else if (kind === 'oak' && r.next() < 0.12) gen.bigOak(writer, x, y, z, r);
    else gen[kind](writer, x, y, z, r);
    sparkle(x, y, z);
    return true;
  };
  for (const n of Object.keys(TREE_OF)) R[B[n]] = (world, x, y, z, v) => { if (lightAt(x, y + 1, z) >= 9 && rnd() < 0.12) game.growTree(x, y, z, v); };

  // ---- grass spreads in light, dies in the dark
  R[B.grass] = (world, x, y, z) => {
    const above = w.getId(x, y + 1, z);
    if (OPAQUE[above] || LIQUID[above]) { w.setBlock(x, y, z, B.dirt); return; }
    for (let k = 0; k < 2; k++) {
      const tx = x + Math.floor(rnd() * 3) - 1, ty = y + Math.floor(rnd() * 5) - 3, tz = z + Math.floor(rnd() * 3) - 1;
      if (w.getId(tx, ty, tz) === B.dirt && !OPAQUE[w.getId(tx, ty + 1, tz)] && !LIQUID[w.getId(tx, ty + 1, tz)] && lightAt(tx, ty + 1, tz) >= 9) w.setBlock(tx, ty, tz, B.grass);
    }
  };
  R[B.mycel] = (world, x, y, z) => {
    const tx = x + Math.floor(rnd() * 3) - 1, ty = y + Math.floor(rnd() * 3) - 1, tz = z + Math.floor(rnd() * 3) - 1;
    if (w.getId(tx, ty, tz) === B.deepstone && !OPAQUE[w.getId(tx, ty + 1, tz)] && rnd() < 0.2) w.setBlock(tx, ty, tz, B.mycel);
  };

  // ---- leaves decay when no log is near (player-placed leaves carry meta 1 and never decay)
  const LOGS = new Set(BLOCKS.filter((d) => d.name.endsWith('_log') || d.name === 'mushroom_stem').map((d) => d.id));
  for (const d of BLOCKS) {
    if (!d.leaves) continue;
    R[d.id] = (world, x, y, z, v) => {
      if ((v >>> ID_BITS) & 1) return;
      if (rnd() > 0.35) return;
      for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 6) continue;
        if (LOGS.has(w.getId(x + dx, y + dy, z + dz))) return;
      }
      w.setBlock(x, y, z, 0);
      drop(x, y, z, v);
      if (game.particles && rnd() < 0.5) game.particles.blockBreak(x, y, z, v);
    };
  }

  // ---- berries, reeds, cactus, vines, mushrooms
  R[B.berry_bush] = (world, x, y, z, v) => { if (!((v >>> ID_BITS) & 1) && rnd() < 0.08 && lightAt(x, y, z) >= 9) w.setBlock(x, y, z, pack(B.berry_bush, 1)); };
  const growUp = (id, max, needWater) => (world, x, y, z) => {
    if (w.getId(x, y + 1, z) || rnd() > 0.1) return;
    let hgt = 1;
    while (w.getId(x, y - hgt, z) === id) hgt++;
    if (hgt >= max) return;
    if (needWater) {
      const by = y - hgt + 1;
      let near = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (LIQUID[w.getId(x + dx, by - 1, z + dz)] === 1) near = true;
      if (!near) return;
    }
    w.setBlock(x, y + 1, z, id);
  };
  R[B.reeds] = growUp(B.reeds, 3, true);
  R[B.cactus] = growUp(B.cactus, 3, false);
  R[B.vines] = (world, x, y, z, v) => {
    if (rnd() > 0.06 || w.getId(x, y - 1, z)) return;
    let len = 1;
    while (w.getId(x, y + len, z) === B.vines && len < 9) len++;
    if (len < 8) w.setBlock(x, y - 1, z, v);
  };
  for (const id of [B.glowshroom, B.red_mushroom]) R[id] = (world, x, y, z, v) => {
    if (rnd() > 0.04) return;
    const tx = x + Math.floor(rnd() * 5) - 2, ty = y + Math.floor(rnd() * 3) - 1, tz = z + Math.floor(rnd() * 5) - 2;
    if (!w.getId(tx, ty, tz) && SOLID[w.getId(tx, ty - 1, tz)] && lightAt(tx, ty, tz) < 10) w.setBlock(tx, ty, tz, v & ID_MASK);
  };

  // ---- echo crystals grow from budding blocks
  R[B.budding_echo] = (world, x, y, z) => {
    if (rnd() > 0.2) return;
    const f = Math.floor(rnd() * 6);
    const [dx, dy, dz] = FACE_N[f];
    const t = w.getBlock(x + dx, y + dy, z + dz), tid = t & ID_MASK;
    if (!tid) w.setBlock(x + dx, y + dy, z + dz, pack(B.crystal_bud, f));
    else if (tid === B.crystal_bud && rnd() < 0.3) w.setBlock(x + dx, y + dy, z + dz, pack(B.crystal_cluster, t >>> ID_BITS));
  };

  // ---- ice and snow melt near strong light
  R[B.ice] = (world, x, y, z) => { if (Math.max(...[1, 2, 3].map((c) => (w.getLight(x, y + 1, z) >> (c * 4)) & 15)) >= 12) w.setBlock(x, y, z, B.water); };
  R[B.snow_layer] = (world, x, y, z) => { if (Math.max(...[1, 2, 3].map((c) => (w.getLight(x, y, z) >> (c * 4)) & 15)) >= 12) w.setBlock(x, y, z, 0); };

  // ---- fire
  const isFlammable = (x, y, z) => FLAMMABLE[w.getId(x, y, z)] > 0;
  const nearFlammable = (x, y, z) => FACE_N.some(([dx, dy, dz]) => isFlammable(x + dx, y + dy, z + dz));
  w.handlers.place[B.fire] = (world, x, y, z) => w.schedule(x, y, z, 20 + Math.floor(rnd() * 20));
  w.handlers.neighbor[B.fire] = (world, x, y, z) => { if (!SOLID[w.getId(x, y - 1, z)] && !nearFlammable(x, y, z)) w.setBlock(x, y, z, 0); };
  w.handlers.tick[B.fire] = (world, x, y, z, v) => {
    const age = (v >>> ID_BITS) & 15;
    if (game.weather && game.weather.isRainingAt(x, y, z) && rnd() < 0.6) { w.setBlock(x, y, z, 0); return; }
    const eternal = w.getId(x, y - 1, z) === B.magma;
    if (!eternal && !nearFlammable(x, y, z) && (age > 3 || !SOLID[w.getId(x, y - 1, z)])) { w.setBlock(x, y, z, 0); return; }
    if (!eternal && age >= 15 && rnd() < 0.25) { w.setBlock(x, y, z, 0); return; }
    // burn neighbours
    for (const [dx, dy, dz] of FACE_N) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const nid = w.getId(nx, ny, nz);
      const f = FLAMMABLE[nid];
      if (!f || rnd() * 300 > f) continue;
      if (nid === B.blast_barrel) { game.ignite(nx, ny, nz); continue; }
      w.setBlock(nx, ny, nz, rnd() < 0.5 ? pack(B.fire, Math.min(15, age + 2)) : 0);
    }
    // jump to nearby air next to fuel
    for (let k = 0; k < 2; k++) {
      const nx = x + Math.floor(rnd() * 3) - 1, ny = y + Math.floor(rnd() * 4) - 1, nz = z + Math.floor(rnd() * 3) - 1;
      if (!w.getId(nx, ny, nz) && nearFlammable(nx, ny, nz) && rnd() < 0.35) w.setBlock(nx, ny, nz, pack(B.fire, Math.min(15, age + 1)));
    }
    w.setBlock(x, y, z, pack(B.fire, Math.min(15, age + 1)), { notify: false });
    w.schedule(x, y, z, 25 + Math.floor(rnd() * 20));
  };
  R[B.lava] = (world, x, y, z) => {
    if (rnd() > 0.25) return;
    const nx = x + Math.floor(rnd() * 3) - 1, ny = y + 1 + Math.floor(rnd() * 2), nz = z + Math.floor(rnd() * 3) - 1;
    if (!w.getId(nx, ny, nz) && nearFlammable(nx, ny, nz)) w.setBlock(nx, ny, nz, B.fire);
  };

  // fire and lava ambience
  game.addSystem({
    frame(g) {
      if (!g.particles || !g.settings.particles) return;
      const p = g.player;
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(p.x + (rnd() - 0.5) * 24), y = Math.floor(p.y + (rnd() - 0.5) * 14), z = Math.floor(p.z + (rnd() - 0.5) * 24);
        const id = w.getId(x, y, z);
        if (id === B.fire) { g.particles.flame(x + rnd(), y + rnd() * 0.6, z + rnd()); if (rnd() < 0.3) g.particles.smoke(x + 0.5, y + 1, z + 0.5, 1, true); }
        else if (id === B.lava && !w.getId(x, y + 1, z) && rnd() < 0.3) g.particles.sparks(x + rnd(), y + 0.95, z + rnd(), 1, [1, 0.6, 0.2], 1.5);
        else if (id === B.torch || id === B.lantern) { if (rnd() < 0.5) g.particles.flame(x + 0.5, y + (id === B.torch ? 0.7 : 0.5), z + 0.5); }
        else if (id === B.campfire && !((w.getMeta(x, y, z)) & 8)) { g.particles.smoke(x + 0.5, y + 0.7, z + 0.5, 1); g.particles.flame(x + 0.5, y + 0.3, z + 0.5); }
        else if ((id === B.crystal_cluster || id === B.crystal_ore || id === B.deep_crystal_ore || id === B.star_core) && rnd() < 0.5) g.particles.add({ x: x + rnd(), y: y + rnd(), z: z + rnd(), vy: 0.2, r: 0.7, g: 0.5, b: 1, size: 0.04, life: 1.4, em: 1, additive: true, flicker: 8 });
        else if (id === B.glowshroom || id === B.glowcap) g.particles.add({ x: x + rnd(), y: y + rnd(), z: z + rnd(), vy: 0.15, r: 0.4, g: 1, b: 0.85, size: 0.035, life: 2.5, em: 1, additive: true, wander: 0.2 });
        else if (id === B.blossom_leaves && !w.getId(x, y - 1, z) && rnd() < 0.4) g.particles.add({ x: x + rnd(), y: y - 0.1, z: z + rnd(), vx: 0.3, vy: -0.5, r: 1, g: 0.72, b: 0.82, size: 0.05, life: 5, wander: 0.5, collide: true });
      }
    },
  });

  // ---- bone meal
  game.fertilize = (x, y, z) => {
    const v = w.getBlock(x, y, z), id = v & ID_MASK, d = BLOCKS[id];
    let ok = false;
    if (d.crop) ok = growCrop(x, y, z, v, 1 + Math.floor(rnd() * 2)) || true;
    else if (d.name.endsWith('_sapling')) { ok = true; if (rnd() < 0.45) game.growTree(x, y, z, v); }
    else if (id === B.berry_bush) { ok = true; w.setBlock(x, y, z, pack(B.berry_bush, 1)); }
    else if (id === B.grass || id === B.sky_grass) {
      ok = true;
      for (let k = 0; k < 14; k++) {
        const tx = x + Math.floor(rnd() * 7) - 3, tz = z + Math.floor(rnd() * 7) - 3;
        for (let ty = y + 1; ty >= y - 1; ty--) {
          if (w.getId(tx, ty - 1, tz) === B.grass && !w.getId(tx, ty, tz)) { w.setBlock(tx, ty, tz, rnd() < 0.8 ? B.tall_grass : [B.dawnflower, B.bellbloom, B.bluestar, B.emberbloom][Math.floor(rnd() * 4)]); break; }
        }
      }
    } else if (id === B.reeds || id === B.cactus) { ok = true; for (let k = 0; k < 2; k++) R[id](w, x, y, z, v); }
    if (ok) { sparkle(x, y + 0.2, z); game.audio && game.audio.play('chime', { x, y, z, freq: 990 }); }
    return ok;
  };

  // ---- carried light: held torches, lanterns and glowing effects light up the dark
  const LIGHT_ITEMS = new Map([[I.torch, B.glow_air], [I.lantern, B.glow_air], [I.campfire, B.glow_air], [I.lamp_stone, B.glow_air], [I.lava_bucket, B.glow_air],
    [I.crystal_lantern, B.glow_air_cool], [I.glowshroom, B.glow_air_cool], [I.glow_spore, B.glow_air_cool], [I.lantern_staff, B.glow_air_cool], [I.crystal_lamp, B.glow_air_cool], [I.ancient_lamp, B.glow_air_cool]]);
  let lit = null; // { x,y,z,id }
  const clearLit = () => {
    if (lit && (w.getId(lit.x, lit.y, lit.z) === lit.id)) w.setBlock(lit.x, lit.y, lit.z, 0, { notify: false });
    lit = null;
  };
  for (const id of [B.glow_air, B.glow_air_cool]) {
    R[id] = (world, x, y, z) => { if (!lit || lit.x !== x || lit.y !== y || lit.z !== z) w.setBlock(x, y, z, 0, { notify: false }); };
  }
  game.addSystem({
    tick(g) {
      const p = g.player, inv = g.inventory;
      const held = inv.held(), off = inv.slots[40];
      let src = (held && LIGHT_ITEMS.get(held.id)) || (off && LIGHT_ITEMS.get(off.id)) || null;
      if (!src && p.effects.glow) src = B.glow_air_cool;
      if (p.dead) src = null;
      const x = Math.floor(p.x), y = Math.floor(p.eyeY), z = Math.floor(p.z);
      if (!src) { if (lit) clearLit(); return; }
      if (lit && lit.x === x && lit.y === y && lit.z === z && lit.id === src) return;
      const cur = w.getId(x, y, z);
      if (cur && cur !== B.glow_air && cur !== B.glow_air_cool) {
        // eye cell occupied (e.g. swimming): try the feet cell
        return;
      }
      clearLit();
      w.setBlock(x, y, z, src, { notify: false });
      lit = { x, y, z, id: src };
    },
    dispose() { clearLit(); },
  });
  game.beforeSave = (game.beforeSave || []);
  void ITEMS;
}
