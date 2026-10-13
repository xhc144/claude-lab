// Machines driven by resonance signals: pistons, dispensers, placers, drills, fans, launch pads,
// conveyor belts and hoppers; plus right-click behaviour of circuit parts.

import { BLOCKS, B, ID_MASK, ID_BITS, SOLID, LIQUID, REPLACEABLE, OPAQUE, pack, OPPOSITE } from '../world/blocks.js';
import { ITEMS, I, maxStack } from '../world/items.js';
import { FACE_N, hasSupport } from '../world/placement.js';
import { blockDrops } from '../world/drops.js';
import { Projectile } from '../entity/entities.js';
import { SMELT_BY_IN, fuelValue } from '../world/recipes.js';

const F4 = [[0, -1], [-1, 0], [0, 1], [1, 0]];

export function installMachines(game) {
  const w = game.world;
  const C = game.circuits;
  const bid = (x, y, z) => w.getBlock(x, y, z) & ID_MASK;

  // ---------------------------------------------------------------- pistons
  const UNPUSHABLE = new Set([B.bedrock, B.obsidian, B.piston_head, B.seal_door, B.rune_pedestal, B.heart_altar, B.waystone]);
  function pushable(v) {
    const id = v & ID_MASK, d = BLOCKS[id];
    if (UNPUSHABLE.has(id) || d.hardness < 0) return false;
    if (['chest', 'furnace', 'hopper', 'dispenser', 'placer'].includes(d.name)) return false;
    if ((id === B.piston || id === B.sticky_piston) && ((v >>> ID_BITS) & 8)) return false;
    return true;
  }
  function extend(x, y, z, v) {
    const m = v >>> ID_BITS, f = m & 7;
    const [dx, dy, dz] = FACE_N[f];
    const line = [];
    let cx = x + dx, cy = y + dy, cz = z + dz;
    for (let k = 0; k <= 12; k++) {
      const cv = w.getBlock(cx, cy, cz), cid = cv & ID_MASK;
      if (!cid || (REPLACEABLE[cid] && !SOLID[cid]) || LIQUID[cid]) break;
      if (!pushable(cv) || k === 12 || cy < 1 || cy > 254) return false;
      line.push([cx, cy, cz, cv]);
      cx += dx; cy += dy; cz += dz;
    }
    // the free cell at the end: break whatever soft thing is there
    const endv = w.getBlock(cx, cy, cz);
    if ((endv & ID_MASK) && !LIQUID[endv & ID_MASK]) for (const s of blockDrops(endv, null)) game.entities.spawnItem(cx + 0.5, cy + 0.5, cz + 0.5, s);
    for (let i = line.length - 1; i >= 0; i--) {
      const [lx, ly, lz, lv] = line[i];
      w.setBlock(lx + dx, ly + dy, lz + dz, lv);
    }
    w.setBlock(x, y, z, pack(v & ID_MASK, m | 8), { notify: false });
    w.setBlock(x + dx, y + dy, z + dz, pack(B.piston_head, f | ((v & ID_MASK) === B.sticky_piston ? 8 : 0)));
    pushEntities(x + dx, y + dy, z + dz, dx, dy, dz);
    for (const [lx, ly, lz] of line) pushEntities(lx + dx, ly + dy, lz + dz, dx, dy, dz);
    game.audio && game.audio.play('piston', { x, y, z, pitch: 1.2 });
    return true;
  }
  function retract(x, y, z, v) {
    const m = v >>> ID_BITS, f = m & 7;
    const [dx, dy, dz] = FACE_N[f];
    const sticky = (v & ID_MASK) === B.sticky_piston;
    w.setBlock(x, y, z, pack(v & ID_MASK, m & ~8), { notify: false });
    if (bid(x + dx, y + dy, z + dz) === B.piston_head) w.setBlock(x + dx, y + dy, z + dz, 0);
    if (sticky) {
      const fv = w.getBlock(x + 2 * dx, y + 2 * dy, z + 2 * dz), fid = fv & ID_MASK;
      if (fid && !LIQUID[fid] && pushable(fv) && SOLID[fid]) {
        w.setBlock(x + 2 * dx, y + 2 * dy, z + 2 * dz, 0);
        w.setBlock(x + dx, y + dy, z + dz, fv);
      }
    }
    game.audio && game.audio.play('piston', { x, y, z, pitch: 0.8 });
  }
  function pushEntities(x, y, z, dx, dy, dz) {
    const p = game.player;
    const inCell = (e) => e.x + e.hw > x && e.x - e.hw < x + 1 && e.y + e.h > y && e.y < y + 1 && e.z + e.hw > z && e.z - e.hw < z + 1;
    if (inCell(p)) { p.x += dx; p.y += dy * 1.01; p.z += dz; if (dy > 0) p.vy = Math.max(p.vy, 4); }
    for (const e of game.entities.list) if (!e.dead && inCell(e)) { e.x += dx; e.y += dy; e.z += dz; }
  }
  for (const pid of [B.piston, B.sticky_piston]) C.device(pid, 8, (x, y, z, v, p) => { if (p) extend(x, y, z, v); else retract(x, y, z, v); });
  // a piston head without its piston (e.g. broken) disappears; breaking the head retracts the piston
  w.handlers.neighbor[B.piston_head] = (world, x, y, z, v) => {
    const f = (v >>> ID_BITS) & 7;
    const [dx, dy, dz] = FACE_N[OPPOSITE[f]];
    const bv = w.getBlock(x + dx, y + dy, z + dz), b = bv & ID_MASK;
    if ((b !== B.piston && b !== B.sticky_piston) || !((bv >>> ID_BITS) & 8)) w.setBlock(x, y, z, 0);
  };
  w.handlers.remove[B.piston_head] = (world, x, y, z, v, nv) => {
    if ((nv & ID_MASK) === B.piston_head) return;
    const f = (v >>> ID_BITS) & 7;
    const [dx, dy, dz] = FACE_N[OPPOSITE[f]];
    const bv = w.getBlock(x + dx, y + dy, z + dz), b = bv & ID_MASK;
    if ((b === B.piston || b === B.sticky_piston) && ((bv >>> ID_BITS) & 8)) setTimeout(() => w.setBlock(x + dx, y + dy, z + dz, pack(b, (bv >>> ID_BITS) & 7)), 0);
  };
  for (const pid of [B.piston, B.sticky_piston]) {
    const prev = w.handlers.remove[pid];
    w.handlers.remove[pid] = (world, x, y, z, v, nv) => {
      if (prev) prev(world, x, y, z, v, nv);
      if ((nv & ID_MASK) === pid) return;
      const f = (v >>> ID_BITS) & 7;
      const [dx, dy, dz] = FACE_N[f];
      if (((v >>> ID_BITS) & 8) && bid(x + dx, y + dy, z + dz) === B.piston_head) setTimeout(() => w.setBlock(x + dx, y + dy, z + dz, 0), 0);
    };
  }

  // ---------------------------------------------------------------- dispenser / placer / drill (pulse on rising edge)
  const front = (x, y, z, m) => { const [dx, dy, dz] = FACE_N[m & 7]; return [x + dx, y + dy, z + dz, dx, dy, dz]; };
  C.device(B.dispenser, 8, (x, y, z, v, p, was, m) => {
    w.setBlock(x, y, z, pack(B.dispenser, p ? m | 8 : m & ~8), { notify: false, keepBE: true });
    if (!p) return;
    const be = game.getContainer(x, y, z, 'dispenser');
    const filled = be.slots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    if (!filled.length) { game.audio && game.audio.play('click', { x, y, z, pitch: 0.6 }); return; }
    const i = filled[Math.floor(Math.random() * filled.length)];
    const st = be.slots[i];
    const def = ITEMS[st.id];
    const [fx, fy, fz, dx, dy, dz] = front(x, y, z, m);
    const take = () => { st.n--; if (!st.n) be.slots[i] = null; game.markBEChanged(be); };
    if (def.name === 'arrow' || def.name === 'glow_arrow' || def.name === 'snowball' || def.name === 'egg') {
      const pr = new Projectile(def.name === 'arrow' || def.name === 'glow_arrow' ? def.name : def.name, 'dispenser');
      pr.setPos(fx + 0.5 - dx * 0.4, fy + 0.5 - dy * 0.4, fz + 0.5 - dz * 0.4);
      const sp = 24;
      pr.vx = dx * sp + (Math.random() - 0.5); pr.vy = dy * sp + 1.5; pr.vz = dz * sp + (Math.random() - 0.5);
      game.entities.add(pr); take();
      game.audio && game.audio.play('bow', { x, y, z });
    } else if (def.use === 'bucket' && def.fluid) {
      if (!bid(fx, fy, fz) || REPLACEABLE[bid(fx, fy, fz)]) { w.setBlock(fx, fy, fz, def.fluid === 'water' ? B.water : B.lava); be.slots[i] = { id: I.bucket, n: 1 }; game.markBEChanged(be); }
    } else if (def.name === 'bucket') {
      const fv = w.getBlock(fx, fy, fz);
      if (LIQUID[fv & ID_MASK] && ((fv >>> ID_BITS) & 7) === 0) { w.setBlock(fx, fy, fz, 0); be.slots[i] = { id: LIQUID[fv & ID_MASK] === 1 ? I.water_bucket : I.lava_bucket, n: 1 }; game.markBEChanged(be); }
    } else if (def.name === 'bone_meal') {
      if (game.fertilize(fx, fy, fz) || game.fertilize(fx, fy - 1, fz)) take();
    } else if (def.name === 'flint_steel') {
      if (bid(fx, fy, fz) === B.blast_barrel) game.ignite(fx, fy, fz);
      else if (!bid(fx, fy, fz)) w.setBlock(fx, fy, fz, B.fire);
    } else if (def.name === 'blast_barrel') {
      take(); w.setBlock(fx, fy, fz, B.blast_barrel); game.ignite(fx, fy, fz);
    } else {
      const one = { ...st, n: 1 };
      take();
      game.entities.spawnItem(fx + 0.5 - dx * 0.3, fy + 0.4, fz + 0.5 - dz * 0.3, one, [dx * 5 + (Math.random() - 0.5), dy * 5 + 1.5, dz * 5 + (Math.random() - 0.5)], 0.6);
      game.audio && game.audio.play('click', { x, y, z });
    }
  });
  C.device(B.placer, 8, (x, y, z, v, p, was, m) => {
    w.setBlock(x, y, z, pack(B.placer, p ? m | 8 : m & ~8), { notify: false, keepBE: true });
    if (!p) return;
    const be = game.getContainer(x, y, z, 'placer');
    const [fx, fy, fz] = front(x, y, z, m);
    const cur = bid(fx, fy, fz);
    if (cur && !REPLACEABLE[cur]) return;
    for (let i = 0; i < be.slots.length; i++) {
      const st = be.slots[i];
      if (!st) continue;
      const d = ITEMS[st.id];
      const blockId = d.block !== undefined ? d.block : d.places ? B[d.places] : null;
      if (blockId === null) continue;
      const bd = BLOCKS[blockId];
      let state = blockId;
      if (bd.orient === 'facing6') state = pack(blockId, m & 7);
      if (!hasSupport(w, fx, fy, fz, state)) continue;
      w.setBlock(fx, fy, fz, state);
      st.n--; if (!st.n) be.slots[i] = null;
      game.markBEChanged(be);
      game.audio && game.audio.place(blockId, { x: fx, y: fy, z: fz });
      return;
    }
  });
  C.device(B.drill, 8, (x, y, z, v, p, was, m) => {
    w.setBlock(x, y, z, pack(B.drill, p ? m | 8 : m & ~8), { notify: false });
    if (!p) return;
    const [fx, fy, fz] = front(x, y, z, m);
    const fv = w.getBlock(fx, fy, fz), fid = fv & ID_MASK;
    if (!fid || LIQUID[fid]) return;
    const d = BLOCKS[fid];
    if (d.hardness < 0 || d.hardness > 20 || fid === B.bedrock) return;
    w.setBlock(fx, fy, fz, 0);
    game.particles && game.particles.blockBreak(fx, fy, fz, fv);
    game.audio && game.audio.play('drill', { x: fx, y: fy, z: fz });
    // drills work like an iron pickaxe
    const drops = blockDrops(fv, { id: I.iron_pickaxe, n: 1 });
    // output into a container behind the drill if there is one, else drop in front
    const [bx, by, bz] = front(x, y, z, OPPOSITE[m & 7]);
    const be = w.getBE(bx, by, bz);
    for (const s of drops) {
      let left = s.n;
      if (be && be.slots && be.kind !== 'furnace') { const cont = { slots: be.slots }; left = addToSlots(cont.slots, s.id, s.n); game.markBEChanged(be); }
      if (left) game.entities.spawnItem(fx + 0.5, fy + 0.3, fz + 0.5, { id: s.id, n: left }, [0, 1, 0], 0.4);
    }
  });
  function addToSlots(slots, id, n) {
    const ms = maxStack(id);
    let left = n;
    for (let i = 0; i < slots.length && left; i++) { const s = slots[i]; if (s && s.id === id && !s.dmg && s.n < ms) { const k = Math.min(ms - s.n, left); s.n += k; left -= k; } }
    for (let i = 0; i < slots.length && left; i++) if (!slots[i]) { const k = Math.min(ms, left); slots[i] = { id, n: k }; left -= k; }
    return left;
  }

  // ---------------------------------------------------------------- fans, launch pads, conveyors
  const fans = new Map(); // key -> {x,y,z,f}
  C.device(B.fan, 8, (x, y, z, v, p, was, m) => {
    w.setBlock(x, y, z, pack(B.fan, p ? m | 8 : m & ~8), { notify: false });
    const k = `${x},${y},${z}`;
    if (p) fans.set(k, { x, y, z, f: m & 7 }); else fans.delete(k);
  });
  game.chunks.onChunkLoaded.push((c) => {
    // re-register powered fans after loading (they keep their powered bit)
    for (let i = 0; i < 65536; i++) {
      const v = c.blocks[i];
      if ((v & ID_MASK) === B.fan && ((v >>> ID_BITS) & 8)) fans.set(`${c.cx * 16 + (i & 15)},${i >> 8},${c.cz * 16 + ((i >> 4) & 15)}`, { x: c.cx * 16 + (i & 15), y: i >> 8, z: c.cz * 16 + ((i >> 4) & 15), f: (v >>> ID_BITS) & 7 });
    }
  });
  const RANGE = 9;
  // wind strength at a point from one fan (0..1), following the fan axis until blocked
  function windFrom(fan, x, y, z) {
    const [dx, dy, dz] = FACE_N[fan.f];
    const rx = x - (fan.x + 0.5), ry = y - (fan.y + 0.5), rz = z - (fan.z + 0.5);
    const along = rx * dx + ry * dy + rz * dz;
    if (along < 0.3 || along > RANGE + 0.5) return 0;
    const px = rx - dx * along, py = ry - dy * along, pz = rz - dz * along;
    if (Math.hypot(px, py, pz) > 0.75) return 0;
    for (let k = 1; k < along; k++) { if (OPAQUE[bid(fan.x + dx * k, fan.y + dy * k, fan.z + dz * k)]) return 0; }
    return 1 - along / (RANGE + 1) * 0.6;
  }
  game.updraftAt = (x, y, z) => {
    let lift = 0;
    // fans pointing up
    for (const fan of fans.values()) {
      if (fan.f !== 2 || Math.abs(fan.x + 0.5 - x) > 1.2 || Math.abs(fan.z + 0.5 - z) > 1.2) continue;
      const s = windFrom(fan, x, y + 0.5, z);
      if (s > 0) lift = Math.max(lift, s);
    }
    // hot air above lit campfires
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let k = 1; k <= 12; k++) {
      const v = w.getBlock(bx, Math.floor(y) - k, bz);
      const id = v & ID_MASK;
      if (id === B.campfire && !((v >>> ID_BITS) & 8)) { lift = Math.max(lift, 0.55 * (1 - k / 13)); break; }
      if (OPAQUE[id]) break;
    }
    return lift;
  };
  game.addSystem({
    tick(g) {
      if (!fans.size) return;
      const p = g.player;
      for (const fan of fans.values()) {
        if (!w.isLoaded(fan.x, fan.z)) continue;
        if (bid(fan.x, fan.y, fan.z) !== B.fan) { fans.delete(`${fan.x},${fan.y},${fan.z}`); continue; }
        const [dx, dy, dz] = FACE_N[fan.f];
        const push = (e, k) => {
          const s = windFrom(fan, e.x, e.y + (e.h || 1) * 0.5, e.z);
          if (s <= 0) return;
          if (fan.f === 2) { if (e !== p) e.vy = Math.max(e.vy, 5 * s); return; }
          const f = 14 * s * k;
          if (e === p) { p.knock[0] += dx * f * 0.05; p.knock[1] += dy * f * 0.05; p.knock[2] += dz * f * 0.05; }
          else { e.vx += dx * f * 0.05; e.vy += dy * f * 0.05; e.vz += dz * f * 0.05; }
        };
        push(p, 1);
        for (const e of g.entities.list) if (!e.dead) push(e, e.type === 'item' ? 1.6 : 1);
      }
    },
    frame(g, dt) {
      if (!g.particles || !fans.size) return;
      for (const fan of fans.values()) {
        if (Math.random() > dt * 8) continue;
        const [dx, dy, dz] = FACE_N[fan.f];
        g.particles.add({ x: fan.x + 0.5 + dx * 0.6 + (Math.random() - 0.5) * 0.6, y: fan.y + 0.5 + dy * 0.6 + (Math.random() - 0.5) * 0.6, z: fan.z + 0.5 + dz * 0.6 + (Math.random() - 0.5) * 0.6, vx: dx * 7, vy: dy * 7, vz: dz * 7, r: 0.9, g: 0.95, b: 1, a: 0.35, size: 0.05, life: 1.1, drag: 0.99 });
      }
    },
  });

  // launch pads fling whatever steps on them; powering one fires it too
  const launch = (e, isPlayer) => {
    const v = 17;
    if (isPlayer) { if (e.sneaking) return; e.vy = v; e.fallStart = null; }
    else e.vy = v;
    game.audio && game.audio.play('launch', { x: e.x, y: e.y, z: e.z });
    if (game.particles) game.particles.sparks(e.x, e.y + 0.2, e.z, 12, [1, 0.85, 0.3], 3);
  };
  game.addSystem({
    tick(g) {
      const p = g.player;
      const under = (e) => bid(Math.floor(e.x), Math.floor(e.y - 0.05), Math.floor(e.z)) === B.launch_pad;
      if (!p.dead && p.onGround && under(p) && p.vy <= 0.1) launch(p, true);
      for (const e of g.entities.list) if (!e.dead && e.onGround && under(e) && e.vy <= 0.1 && e.type !== 'projectile') launch(e, false);
    },
  });
  C.device(B.launch_pad, 0, () => {}); // registered as device so circuits wake it (no state)

  // conveyors: carry entities along their facing unless powered (powered = stopped)
  const BELT = 2.6;
  game.conveyorVel = (x, y, z) => {
    const v = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    if ((v & ID_MASK) !== B.conveyor) return null;
    if (C.isPowered(Math.floor(x), Math.floor(y), Math.floor(z))) return null;
    const [dx, dz] = F4[(v >>> ID_BITS) & 3];
    // keep items centred on the belt
    const cx = Math.floor(x) + 0.5, cz = Math.floor(z) + 0.5;
    return [dx * BELT + (dx === 0 ? (cx - x) * 3 : 0), dz * BELT + (dz === 0 ? (cz - z) * 3 : 0)];
  };
  game.conveyorPush = (pl) => game.conveyorVel(pl.x, pl.y - 0.05, pl.z);
  // mobs ride belts too
  game.addSystem({
    tick(g) {
      for (const e of g.entities.list) {
        if (e.dead || e.type !== 'mob' || !e.onGround) continue;
        const cv = game.conveyorVel(e.x, e.y - 0.05, e.z);
        if (cv) { e.x += cv[0] * 0.05; e.z += cv[1] * 0.05; }
      }
    },
  });

  // ---------------------------------------------------------------- hoppers
  const hoppers = new Set();
  const hopperKey = (x, y, z) => `${x},${y},${z}`;
  const addHopper = (x, y, z) => hoppers.add(hopperKey(x, y, z));
  w.handlers.place[B.hopper] = (world, x, y, z) => { addHopper(x, y, z); game.getContainer(x, y, z, 'hopper'); };
  game.chunks.onChunkLoaded.push((c) => {
    for (const [i, be] of c.blockEntities) if (be.kind === 'hopper') addHopper(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15));
  });
  let hopT = 0;
  game.addSystem({
    tick(g) {
      hopT++;
      if (hopT % 8) return;
      for (const k of hoppers) {
        const [x, y, z] = k.split(',').map(Number);
        if (!w.isLoaded(x, z)) continue;
        const v = w.getBlock(x, y, z);
        if ((v & ID_MASK) !== B.hopper) { hoppers.delete(k); continue; }
        if (C.isPowered(x, y, z)) continue; // powered hoppers are locked
        const be = game.getContainer(x, y, z, 'hopper');
        // 1) push one item down (or into the side container it faces)
        const out = (v >>> ID_BITS) & 7; // 0 = down, 1..4 = facing4+1
        const [ox, oy, oz] = out === 0 ? [x, y - 1, z] : [x + F4[out - 1][0], y, z + F4[out - 1][1]];
        const target = w.getBE(ox, oy, oz);
        if (target && target.slots) {
          for (let i = 0; i < be.slots.length; i++) {
            const st = be.slots[i];
            if (!st) continue;
            if (insertInto(target, st, out === 0 ? 'top' : 'side')) { st.n--; if (!st.n) be.slots[i] = null; game.markBEChanged(be); game.markBEChanged(target); break; }
          }
        }
        // 2) pull from a container above (furnaces give their output)
        const above = w.getBE(x, y + 1, z);
        if (above && above.slots) {
          const idxs = above.kind === 'furnace' ? [2] : above.slots.map((_, i) => i);
          for (const i of idxs) {
            const st = above.slots[i];
            if (!st) continue;
            if (addToSlots(be.slots, st.id, 1) === 0) { st.n--; if (!st.n) above.slots[i] = null; game.markBEChanged(be); game.markBEChanged(above); break; }
          }
        }
        // 3) swallow item entities resting on top
        for (const e of g.entities.list) {
          if (e.dead || e.type !== 'item') continue;
          if (e.x < x || e.x > x + 1 || e.z < z || e.z > z + 1 || e.y < y + 0.5 || e.y > y + 1.6) continue;
          const left = addToSlots(be.slots, e.stack.id, e.stack.n);
          if (left < e.stack.n) { game.markBEChanged(be); if (left) e.stack.n = left; else e.dead = true; }
        }
      }
    },
  });
  function insertInto(be, st, side) {
    if (be.kind === 'furnace') {
      const slot = side === 'top' ? 0 : 1;
      if (slot === 0 && !SMELT_BY_IN.has(st.id)) return false;
      if (slot === 1 && !fuelValue(st.id)) return false;
      const cur = be.slots[slot];
      if (!cur) { be.slots[slot] = { id: st.id, n: 1 }; return true; }
      if (cur.id === st.id && cur.n < maxStack(st.id)) { cur.n++; return true; }
      return false;
    }
    return addToSlots(be.slots, st.id, 1) === 0;
  }

  // ---------------------------------------------------------------- right-click behaviour of parts
  game.useMechBlock = (x, y, z, v, held) => {
    const id = v & ID_MASK, m = v >>> ID_BITS;
    if (id === B.lever) { C.toggleLever(x, y, z); return true; }
    if (id === B.button) { C.pressButton(x, y, z); return true; }
    if (id === B.repeater) { const d = ((m >> 2) & 3) + 1 & 3; w.setBlock(x, y, z, pack(B.repeater, (m & ~12) | (d << 2))); game.audio && game.audio.play('click', { x, y, z }); return true; }
    if (id === B.note_block) {
      const sneak = game.player.sneaking;
      const n = ((m & 31) + (sneak ? 24 : 1)) % 25;
      w.setBlock(x, y, z, pack(B.note_block, (m & 32) | n), { notify: false });
      C.playNote(x, y, z);
      return true;
    }
    if (id === B.daylight_sensor) { w.setBlock(x, y, z, pack(B.daylight_sensor, m ^ 16), { notify: false }); w.schedule(x, y, z, 1); game.audio && game.audio.play('click', { x, y, z }); return true; }
    if (id === B.berry_bush && (m & 1)) { w.setBlock(x, y, z, B.berry_bush); game.entities.spawnItem(x + 0.5, y + 0.6, z + 0.5, { id: I.berries, n: 2 + Math.floor(Math.random() * 2) }); game.audio && game.audio.play('pop', { x, y, z }); return true; }
    if (game.useAncientBlock) return game.useAncientBlock(x, y, z, v, held);
    return false;
  };
  // punching a note block also plays it
  game.on('blockHit', (x, y, z, v) => { if ((v & ID_MASK) === B.note_block) C.playNote(x, y, z); });
  void SOLID;
}
