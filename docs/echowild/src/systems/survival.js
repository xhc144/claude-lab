// Core survival rules: using blocks and items, eating, melee, furnaces, campfires, death and
// respawn, sleeping, recipe discovery.

import { BLOCKS, B, ID_MASK, ID_BITS, LIQUID, SOLID, REPLACEABLE, pack, OPAQUE } from '../world/blocks.js';
import { ITEMS, I, itemName } from '../world/items.js';
import { RECIPES, recipeKnown, SMELT_BY_IN, fuelValue, COOKABLE } from '../world/recipes.js';
import { InventoryScreen, ContainerScreen, FurnaceScreen } from '../ui/inventory.js';
import { Container } from '../entity/inventory.js';
import { Projectile, PrimedBarrel } from '../entity/entities.js';
import { lookDir } from '../core/math.js';
import { FACE_N } from '../world/placement.js';
import { DAY_TICKS } from '../render/sky.js';

const CONTAINER_SIZES = { chest: 27, dispenser: 9, placer: 9, hopper: 5 };
const CONTAINER_ZH = { chest: '木箱', dispenser: '投掷器', placer: '放置机', hopper: '漏斗' };

export function installSurvival(game, state) {
  const w = game.world;
  game.discovered = new Set(state && state.discovered ? state.discovered : []);
  game.spawnPoint = state && state.spawnPoint ? state.spawnPoint : null;
  game.furnaces = new Set();
  game.using = null; // { id, t, need, kind }

  // ---- discovery: every item that passes through the inventory unlocks recipes
  const knownCount = () => RECIPES.filter((r) => recipeKnown(r, game.discovered)).length;
  let lastKnown = knownCount();
  const scan = () => {
    let added = false;
    for (const s of game.inventory.slots) if (s && !game.discovered.has(s.id)) { game.discovered.add(s.id); added = true; }
    if (added) {
      const k = knownCount();
      if (k > lastKnown && game.ready) {
        game.hud.toast('发现新配方', `解锁了 ${k - lastKnown} 个配方 · 按 E 打开合成书`, 'discover', 3000);
        game.audio && game.audio.play('discover');
      }
      lastKnown = k;
    }
  };
  game.inventory.listeners.push(scan);
  scan();

  game.keepInventory = () => game.player.creative || game.settings.difficulty === 0;
  game.itemGlows = (id) => ['star_shard', 'echo_crystal', 'glow_spore', 'shard_sky', 'shard_abyss', 'shard_sand', 'shard_frost', 'shard_tide', 'star_wings', 'loom_thread'].includes(ITEMS[id] && ITEMS[id].name);

  game.dropStack = (st) => {
    const p = game.player;
    const d = lookDir(p.yaw, p.pitch);
    game.entities.spawnItem(p.x + d[0] * 0.4, p.eyeY - 0.3, p.z + d[2] * 0.4, st, [d[0] * 4, d[1] * 4 + 1.5, d[2] * 4], 1.5);
  };

  game.markBEChanged = (be) => {
    const c = w.chunkAt(be.x, be.z);
    if (c) c.modified = true;
  };

  // ---- block entities
  game.getContainer = (x, y, z, kind) => {
    let be = w.getBE(x, y, z);
    if (!be || be.kind !== kind) {
      be = kind === 'furnace' ? { kind, slots: [null, null, null], burn: 0, burnMax: 0, progress: 0 } : { kind, slots: new Array(CONTAINER_SIZES[kind] || 27).fill(null) };
      w.setBE(x, y, z, be);
    }
    if (kind === 'furnace') game.furnaces.add(be);
    return be;
  };
  // index block entities when chunks load
  game.chunks.onChunkLoaded.push((c) => {
    for (const be of c.blockEntities.values()) if (be.kind === 'furnace') game.furnaces.add(be);
  });
  game.chunks.onChunkUnload.push((c) => {
    for (const be of c.blockEntities.values()) if (be.kind === 'furnace') game.furnaces.delete(be);
  });
  // breaking a container spills its contents
  for (const name of ['chest', 'dispenser', 'placer', 'hopper', 'furnace', 'campfire']) {
    w.handlers.remove[B[name]] = (world, x, y, z) => {
      const be = world.getBE(x, y, z);
      if (!be) return;
      for (const st of be.slots || []) if (st) game.entities.spawnItem(x + 0.5, y + 0.5, z + 0.5, st);
      if (be.kind === 'furnace') game.furnaces.delete(be);
    };
  }

  // ---- using blocks
  game.blockUse = (x, y, z, v, held, fresh, hit) => {
    const id = v & ID_MASK, meta = v >>> ID_BITS;
    const d = BLOCKS[id];
    if (!fresh && d.use !== 'button') return false;
    const ui = game.app && game.app.ui;
    switch (d.use) {
      case 'workbench': ui.push(new InventoryScreen(game, 'workbench')); return true;
      case 'resonator': ui.push(new InventoryScreen(game, 'resonator')); return true;
      case 'forge': ui.push(new InventoryScreen(game, 'forge')); return true;
      case 'furnace': ui.push(new FurnaceScreen(game, game.getContainer(x, y, z, 'furnace'))); game.audio && game.audio.play('chest_open'); return true;
      case 'chest': {
        const kind = d.name === 'chest' ? 'chest' : d.name;
        const be = game.getContainer(x, y, z, kind);
        if (be.loot && game.loot) game.loot.fill(be);
        ui.push(new ContainerScreen(game, be, CONTAINER_ZH[kind] || d.zh, kind === 'hopper' ? 5 : kind === 'chest' ? 9 : 3));
        game.audio && game.audio.play('chest_open', { x, y, z });
        game.emit('openContainer', x, y, z, be);
        return true;
      }
      case 'toggle': {
        if (d.name === 'iron_door') return false;
        if (d.shape === 'door') {
          const upper = meta & 8;
          const by = upper ? y - 1 : y;
          const lower = w.getBlock(x, by, z);
          const nm = (lower >>> ID_BITS) ^ 4;
          w.setBlock(x, by, z, pack(id, nm));
          if ((w.getBlock(x, by + 1, z) & ID_MASK) === id) w.setBlock(x, by + 1, z, pack(id, (w.getMeta(x, by + 1, z)) ^ 4));
          game.audio && game.audio.play(nm & 4 ? 'door_open' : 'door_close', { x, y, z });
        } else {
          w.setBlock(x, y, z, pack(id, meta ^ 4));
          game.audio && game.audio.play(meta & 4 ? 'door_close' : 'door_open', { x, y, z });
        }
        return true;
      }
      case 'bed': return game.trySleep(x, y, z);
      case 'campfire': {
        if (held && COOKABLE.has(held.id)) {
          let be = w.getBE(x, y, z);
          if (!be) { be = { kind: 'campfire', slots: [null, null, null, null], t: [0, 0, 0, 0] }; w.setBE(x, y, z, be); }
          const i = be.slots.findIndex((s) => !s);
          if (i < 0) return true;
          be.slots[i] = { id: held.id, n: 1 }; be.t[i] = 0;
          if (!game.player.creative) game.inventory.consumeHeld(1);
          game.campfires.add(be);
          return true;
        }
        if (held && ITEMS[held.id].tool && ITEMS[held.id].tool.type === 'shovel') { w.setBlock(x, y, z, pack(id, meta ^ 8)); game.audio && game.audio.play('fizz', { x, y, z }); return true; }
        if (held && held.id === I.flint_steel && (meta & 8)) { w.setBlock(x, y, z, pack(id, meta & ~8)); return true; }
        return false;
      }
      case 'ignite':
        if (held && (held.id === I.flint_steel)) { game.ignite(x, y, z); game.inventory.damageHeld(1); return true; }
        return false;
      default:
        if (game.useMechBlock) return game.useMechBlock(x, y, z, v, held, hit);
        return false;
    }
  };

  // ---- ignition and explosions
  game.ignite = (x, y, z) => {
    const id = w.getId(x, y, z);
    if (id === B.blast_barrel) {
      w.setBlock(x, y, z, 0);
      const e = new PrimedBarrel();
      e.setPos(x + 0.5, y, z + 0.5);
      e.vy = 3;
      game.entities.add(e);
      game.audio && game.audio.play('fuse', { x, y, z });
    }
  };
  game.explode = (x, y, z, power, opts = {}) => {
    game.audio && game.audio.play('explosion', { x, y, z, volume: Math.min(1.5, power / 3) });
    game.particles && game.particles.explosion(x, y, z, power);
    game.shake = Math.max(game.shake || 0, Math.max(0, 1 - Math.hypot(game.player.x - x, game.player.y - y, game.player.z - z) / (power * 6)));
    const R = power;
    const drops = [];
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > R * (0.75 + Math.random() * 0.3)) continue;
      const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
      const v = w.getBlock(bx, by, bz);
      const id = v & ID_MASK;
      if (!id || LIQUID[id]) continue;
      const bd = BLOCKS[id];
      if (bd.hardness < 0 || bd.hardness > 20) continue;
      if (id === B.blast_barrel) { w.setBlock(bx, by, bz, 0); const e = new PrimedBarrel(0.3 + Math.random() * 0.6); e.setPos(bx + 0.5, by, bz + 0.5); game.entities.add(e); continue; }
      w.setBlock(bx, by, bz, 0, { cause: 'explosion' });
      if (Math.random() < 0.3) drops.push([bx, by, bz, v]);
    }
    if (!opts.noDrops) for (const [bx, by, bz, v] of drops) game.harvestDrops && game.harvestDrops(bx, by, bz, v);
    // damage and fling
    const p = game.player;
    const pd = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
    if (pd < R * 2) {
      const f = 1 - pd / (R * 2);
      p.damage(Math.ceil(f * power * 4.5), 'explosion');
      const k = f * 14 / Math.max(0.5, pd);
      p.knock[0] += (p.x - x) * k; p.knock[1] += f * 9; p.knock[2] += (p.z - z) * k;
    }
    for (const e of game.entities.near(x, y, z, R * 2)) {
      if (e === opts.source) continue;
      const ed = Math.hypot(e.x - x, e.y - y, e.z - z) || 0.5;
      const f = 1 - ed / (R * 2);
      if (e.hurt) e.hurt(game, Math.ceil(f * power * 4.5), 'explosion', null);
      e.vx += (e.x - x) / ed * f * 12; e.vy += f * 9; e.vz += (e.z - z) / ed * f * 12;
    }
  };

  // ---- items
  game.itemUse = (held, def, hit, fresh) => {
    const p = game.player, inv = game.inventory;
    if (def.food) {
      if (p.hunger >= 20 && !p.creative && def.name !== 'star_candy' && def.name !== 'berries') return false;
      if (!game.using || game.using.id !== held.id) game.using = { id: held.id, t: 0, need: def.name === 'berries' ? 0.9 : 1.5, kind: 'eat', slot: inv.selected };
      return true;
    }
    const tool = def.tool;
    if (tool && tool.type === 'hoe' && hit && fresh) {
      const id = hit.v & ID_MASK;
      if ((id === B.grass || id === B.dirt || id === B.snow_grass || id === B.sky_grass) && !w.getId(hit.x, hit.y + 1, hit.z)) {
        w.setBlock(hit.x, hit.y, hit.z, B.farmland);
        game.audio && game.audio.place(B.dirt, { x: hit.x, y: hit.y, z: hit.z });
        inv.damageHeld(1);
        return true;
      }
      return false;
    }
    switch (def.use) {
      case 'bucket': return fresh && game.useBucket(held, def);
      case 'fertilize': return fresh && hit && game.fertilize && game.fertilize(hit.x, hit.y, hit.z) && (p.creative || inv.consumeHeld(1));
      case 'ignite': {
        if (!fresh || !hit) return false;
        const id = hit.v & ID_MASK;
        if (id === B.blast_barrel) { game.ignite(hit.x, hit.y, hit.z); inv.damageHeld(1); return true; }
        if (id === B.campfire && ((hit.v >>> ID_BITS) & 8)) { w.setBlock(hit.x, hit.y, hit.z, hit.v & ~(8 << ID_BITS)); return true; }
        const n = FACE_N[hit.face];
        const fx = hit.x + n[0], fy = hit.y + n[1], fz = hit.z + n[2];
        if (w.getId(fx, fy, fz) === 0) { w.setBlock(fx, fy, fz, B.fire); game.audio && game.audio.play('ignite', { x: fx, y: fy, z: fz }); inv.damageHeld(1); return true; }
        return false;
      }
      case 'throw': {
        if (!fresh) return false;
        const d = lookDir(p.yaw, p.pitch);
        const pr = new Projectile(def.name === 'egg' ? 'egg' : 'snowball', 'player');
        pr.setPos(p.x + d[0] * 0.5, p.eyeY - 0.1, p.z + d[2] * 0.5);
        pr.vx = d[0] * 22 + p.vx; pr.vy = d[1] * 22 + 2; pr.vz = d[2] * 22 + p.vz;
        game.entities.add(pr);
        game.audio && game.audio.play('throw');
        if (!p.creative) inv.consumeHeld(1);
        return true;
      }
      case 'bow': {
        if (!p.creative && !inv.has(I.arrow) && !inv.has(I.glow_arrow)) return false;
        if (!game.using || game.using.kind !== 'bow') game.using = { id: held.id, t: 0, need: 99, kind: 'bow', slot: inv.selected };
        return true;
      }
      case 'zoom': return true;
      default:
        if (game.useSpecialItem) return game.useSpecialItem(held, def, hit, fresh);
        return false;
    }
  };

  game.onUseRelease = () => {
    const u = game.using;
    if (!u) return;
    if (u.kind === 'bow' && u.t > 0.15) game.fireBow(u.t);
    game.using = null;
  };
  game.fireBow = (t) => {
    const p = game.player, inv = game.inventory;
    const power = Math.min(1, t / 1.0);
    const kind = inv.has(I.glow_arrow) && !inv.has(I.arrow) ? 'glow_arrow' : 'arrow';
    if (!p.creative) inv.remove(I[kind], 1);
    const d = lookDir(p.yaw, p.pitch);
    const pr = new Projectile(kind, 'player');
    pr.setPos(p.x + d[0] * 0.5, p.eyeY - 0.1, p.z + d[2] * 0.5);
    const sp = 12 + power * 32;
    pr.vx = d[0] * sp; pr.vy = d[1] * sp; pr.vz = d[2] * sp;
    pr.damage = Math.round(2 + power * 7);
    game.entities.add(pr);
    inv.damageHeld(1);
    game.audio && game.audio.play('bow', { pitch: 0.9 + power * 0.3 });
  };

  game.useBucket = (held, def) => {
    const p = game.player, inv = game.inventory;
    const d = lookDir(p.yaw, p.pitch);
    const hit = w.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], 5, (v) => (v & ID_MASK) !== 0);
    if (!hit) return false;
    const id = hit.v & ID_MASK;
    if (!def.fluid) {
      // scoop a source block
      if (LIQUID[id] && ((hit.v >>> ID_BITS) & 7) === 0) {
        w.setBlock(hit.x, hit.y, hit.z, 0);
        const full = LIQUID[id] === 1 ? I.water_bucket : I.lava_bucket;
        if (!p.creative) { inv.consumeHeld(1); if (inv.add(full, 1)) game.dropStack({ id: full, n: 1 }); }
        game.audio && game.audio.play(LIQUID[id] === 1 ? 'bucket_fill' : 'bucket_lava');
        return true;
      }
      if (id === B.cauldron && (hit.v >>> ID_BITS) & 3) {
        w.setBlock(hit.x, hit.y, hit.z, B.cauldron);
        if (!p.creative) { inv.consumeHeld(1); inv.add(I.water_bucket, 1); }
        return true;
      }
      return false;
    }
    let tx = hit.x, ty = hit.y, tz = hit.z;
    if (id === B.cauldron && def.fluid === 'water') { w.setBlock(tx, ty, tz, pack(B.cauldron, 3)); if (!p.creative) { inv.consumeHeld(1); inv.add(I.bucket, 1); } return true; }
    if (!REPLACEABLE[id] || LIQUID[id] && ((hit.v >>> ID_BITS) & 7) === 0) { const n = FACE_N[hit.face]; tx += n[0]; ty += n[1]; tz += n[2]; }
    const cur = w.getId(tx, ty, tz);
    if (cur && !REPLACEABLE[cur]) return false;
    w.setBlock(tx, ty, tz, def.fluid === 'water' ? B.water : B.lava);
    if (!p.creative) { inv.consumeHeld(1); inv.add(I.bucket, 1); }
    game.audio && game.audio.play('bucket_empty', { x: tx, y: ty, z: tz });
    return true;
  };

  // per-frame: eating / bow charge progress
  game.addSystem({
    frame(g, dt) {
      const u = g.using;
      if (!u) return;
      const held = g.inventory.held();
      if (!held || held.id !== u.id || g.inventory.selected !== u.slot || !g.input.button(2)) { if (u.kind !== 'bow') g.using = null; return; }
      u.t += dt;
      if (u.kind === 'eat') {
        if (Math.floor(u.t * 6) !== Math.floor((u.t - dt) * 6)) {
          g.audio && g.audio.play('eat', { pitch: 0.8 + Math.random() * 0.4 });
          const d = lookDir(g.player.yaw, g.player.pitch - 0.3);
          if (g.particles) for (let i = 0; i < 3; i++) g.particles.add({ x: g.player.x + d[0] * 0.4, y: g.player.eyeY - 0.25, z: g.player.z + d[2] * 0.4, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 1.5, r: 0.85, g: 0.6, b: 0.35, size: 0.035, life: 0.5, grav: 12 });
        }
        if (u.t >= u.need) {
          const def = ITEMS[u.id];
          g.player.eat(def.food);
          if (def.poison && Math.random() < def.poison) { g.player.effects.hunger = 15; g.hud.message('吃了生禽肉，肚子有点不舒服……', '#c9a'); }
          if (def.effect === 'glow') g.player.effects.glow = 120;
          if (!g.player.creative) {
            g.inventory.consumeHeld(1);
            if (def.returns) { if (g.inventory.add(I[def.returns], 1)) g.dropStack({ id: I[def.returns], n: 1 }); }
          }
          g.audio && g.audio.play('burp');
          g.emit('ate', u.id);
          g.using = null;
        }
      }
    },
  });

  // ---- melee
  game.meleeAttack = (e) => {
    const p = game.player, inv = game.inventory;
    const held = inv.held();
    const def = held && ITEMS[held.id];
    let dmg = def && def.tool && def.tool.dmg ? def.tool.dmg : 1;
    const crit = p.vy < -1 && !p.onGround && !(p.medium && p.medium.water > 0.2);
    if (crit) dmg *= 1.5;
    if (p.sprinting) dmg += 1;
    if (e.hurt && e.hurt(game, dmg, 'player', p)) {
      const d = lookDir(p.yaw, 0);
      const kb = p.sprinting ? 9 : 6;
      e.vx += d[0] * kb; e.vz += d[2] * kb; e.vy += 4.5;
      if (crit && game.particles) game.particles.sparks(e.x, e.y + e.h * 0.7, e.z, 10, [1, 0.9, 0.5], 3);
      if (def && def.tool) inv.damageHeld(def.tool.type === 'sword' ? 1 : 2);
      p.exhaust(0.1);
      game.audio && game.audio.play(crit ? 'crit' : 'hit_mob', { x: e.x, y: e.y, z: e.z });
    }
  };

  // ---- furnaces and campfires
  game.campfires = new Set();
  game.addSystem({
    tick(g) {
      const dt = 0.05;
      for (const be of g.furnaces) {
        if (!w.isLoaded(be.x, be.z)) continue;
        const v = w.getBlock(be.x, be.y, be.z);
        if ((v & ID_MASK) !== B.furnace) { g.furnaces.delete(be); continue; }
        const [inp, fuel, out] = be.slots;
        const rec = inp && SMELT_BY_IN.get(inp.id);
        const canOut = rec && (!out || (out.id === rec.out && out.n + rec.n <= ITEMS[out.id].stack));
        if (be.burn <= 0 && rec && canOut && fuel && fuelValue(fuel.id) > 0) {
          be.burn = be.burnMax = fuelValue(fuel.id);
          if (ITEMS[fuel.id].name === 'lava_bucket') be.slots[1] = { id: I.bucket, n: 1 };
          else { fuel.n--; if (!fuel.n) be.slots[1] = null; }
          g.markBEChanged(be);
        }
        const lit = be.burn > 0;
        if (lit) {
          be.burn -= dt;
          if (rec && canOut) {
            be.progress = (be.progress || 0) + dt;
            if (be.progress >= rec.time) {
              be.progress = 0;
              inp.n--; if (!inp.n) be.slots[0] = null;
              if (out) out.n += rec.n; else be.slots[2] = { id: rec.out, n: rec.n };
              g.markBEChanged(be);
            }
          } else be.progress = Math.max(0, (be.progress || 0) - dt * 2);
        } else be.progress = Math.max(0, (be.progress || 0) - dt * 2);
        const m = v >>> ID_BITS;
        const isLit = (m & 4) !== 0;
        if (isLit !== lit) w.setBlock(be.x, be.y, be.z, pack(B.furnace, (m & 3) | (lit ? 4 : 0)), { keepBE: true });
        if (lit && g.particles && Math.random() < 0.08) {
          const f = m & 3;
          const off = [[0, -0.52], [-0.52, 0], [0, 0.52], [0.52, 0]][f];
          g.particles.flame(be.x + 0.5 + off[0], be.y + 0.35, be.z + 0.5 + off[1]);
        }
      }
      for (const be of g.campfires) {
        const v = w.getBlock(be.x, be.y, be.z);
        if ((v & ID_MASK) !== B.campfire) { g.campfires.delete(be); continue; }
        if ((v >>> ID_BITS) & 8) continue;
        let any = false;
        for (let i = 0; i < 4; i++) {
          const st = be.slots[i];
          if (!st) continue;
          any = true;
          be.t[i] += dt;
          if (be.t[i] >= 14) {
            const rec = SMELT_BY_IN.get(st.id);
            be.slots[i] = null;
            if (rec) g.entities.spawnItem(be.x + 0.5, be.y + 0.8, be.z + 0.5, { id: rec.out, n: 1 }, [(Math.random() - 0.5), 3, (Math.random() - 0.5)]);
            g.audio && g.audio.play('pop', { x: be.x, y: be.y, z: be.z });
          }
        }
        if (!any) g.campfires.delete(be);
      }
    },
    frame(g) {
      // campfire smoke and food on the fire
      if (!g.particles || !g.settings.particles) return;
      for (const be of g.campfires) if (Math.random() < 0.3) g.particles.smoke(be.x + 0.5, be.y + 0.6, be.z + 0.5, 1);
    },
  });
  game.chunks.onChunkLoaded.push((c) => { for (const be of c.blockEntities.values()) if (be.kind === 'campfire' && be.slots.some(Boolean)) game.campfires.add(be); });

  // ---- sleeping
  game.trySleep = (x, y, z) => {
    const night = game.dayTime > 12500 && game.dayTime < 23400;
    game.spawnPoint = { x: x + 0.5, y: y + 1, z: z + 0.5 };
    if (!night && !(game.weather && game.weather.storm > 0.5)) { game.hud.message('重生点已设在这只睡袋旁。只有夜晚或雷暴时才能入睡。'); return true; }
    if (game.mobs && game.mobs.hostileNear(x, y, z, 10)) { game.hud.message('附近有怪物游荡，现在睡不着。', '#f9a'); return true; }
    game.sleep();
    return true;
  };
  game.sleep = () => {
    const fade = document.createElement('div');
    fade.className = 'sleep-fade';
    game.uiRoot.appendChild(fade);
    requestAnimationFrame(() => fade.classList.add('on'));
    setTimeout(() => {
      game.dayTime = 0; game.day++;
      if (game.weather) game.weather.clear();
      game.player.health = Math.min(game.player.maxHealth, game.player.health + 6);
      game.hud.showSubtitle(`第 ${game.day} 天`, 2500);
      game.emit('newDay', game.day);
      fade.classList.remove('on');
      setTimeout(() => fade.remove(), 1200);
    }, 1400);
  };

  // ---- death & respawn
  const CAUSES = { fall: '从高处摔落', drown: '溺水了', lava: '跌进了岩浆', fire: '被火焰吞没', starve: '饿倒了', contact: '被刺扎伤', explosion: '被炸飞了', void: '坠入了虚空', projectile: '被远程击中', falling: '被落下的方块砸中', mob: '被怪物击倒', generic: '倒下了' };
  game.onPlayerDeath = (cause, src) => {
    const p = game.player;
    let text = CAUSES[cause] || CAUSES.generic;
    if (src && src.def && src.def.zh) text = `被${src.def.zh}击倒`;
    if (!game.keepInventory()) {
      const inv = game.inventory;
      for (let i = 0; i < inv.slots.length; i++) {
        const s = inv.slots[i];
        if (s && !(ITEMS[s.id].shard)) { game.entities.spawnItem(p.x, p.y + 1, p.z, s, [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6], 2); inv.slots[i] = null; }
      }
      inv.changed();
      game.deathPoint = { x: p.x, y: p.y, z: p.z, day: game.day };
    }
    game.audio && game.audio.play('death');
    game.emit('death', text);
  };
  game.respawn = () => {
    const p = game.player;
    const sp = game.spawnPoint || p.spawn;
    p.dead = false;
    p.health = p.maxHealth; p.hunger = 20; p.saturation = 5; p.air = p.maxAir; p.fireTime = 0; p.effects = {};
    p.x = sp.x; p.y = sp.y; p.z = sp.z; p.vx = p.vy = p.vz = 0; p.fallStart = null;
    if (game.spawnPoint) {
      // bed gone? fall back to world spawn
      const id = w.getId(Math.floor(sp.x), Math.floor(sp.y) - 1, Math.floor(sp.z));
      if (w.isLoaded(Math.floor(sp.x), Math.floor(sp.z)) && id !== B.bed) { game.spawnPoint = null; Object.assign(p, { x: p.spawn.x, y: p.spawn.y, z: p.spawn.z }); game.hud.message('你的睡袋不见了，回到了世界出生点。'); }
    }
    p.invuln = 3;
    game.hud.showSubtitle(`第 ${game.day} 天`, 2000);
  };

  // status effects tick (hunger poisoning, glow)
  game.addSystem({
    tick(g) {
      const e = g.player.effects;
      for (const k of Object.keys(e)) { e[k] -= 0.05; if (e[k] <= 0) delete e[k]; }
      if (e.hunger) g.player.exhaust(0.025);
    },
  });

  // time-of-day helpers for commands/UI
  game.setTime = (t) => { game.dayTime = ((t % DAY_TICKS) + DAY_TICKS) % DAY_TICKS; };
  game.harvestDrops = (x, y, z, v) => {
    const st = BLOCKS[v & ID_MASK].item ? { id: v & ID_MASK, n: 1 } : null;
    if (st && !LIQUID[v & ID_MASK]) game.entities.spawnItem(x + 0.5, y + 0.5, z + 0.5, st);
  };
  void SOLID; void OPAQUE; void itemName;
}
