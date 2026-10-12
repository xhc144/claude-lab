// Looking at, mining, placing and using blocks; attacking entities.

import { BLOCKS, B, ID_MASK, ID_BITS, LIQUID, SOLID, REPLACEABLE } from './world/blocks.js';
import { ITEMS, I, breakTime } from './world/items.js';
import { selectionBoxes, CONNECTS, connectionMask } from './world/models.js';
import { resolvePlacement } from './world/placement.js';
import { lookDir } from './core/math.js';
import { boxBlocked } from './entity/physics.js';

// precise ray vs the block's selection boxes
function rayBoxes(v, x, y, z, ox, oy, oz, dx, dy, dz, world) {
  const id = v & ID_MASK;
  const conn = CONNECTS[id] ? connectionMask(v, (a, b, c) => world.getBlock(x + a, y + b, z + c)) : 0;
  const boxes = selectionBoxes(v, conn);
  let best = null;
  for (const b of boxes) {
    const r = rayAABB(ox, oy, oz, dx, dy, dz, x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
    if (r && (!best || r.t < best.t)) best = r;
  }
  return best;
}

export function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = -Infinity, tmax = Infinity, face = -1;
  const axes = [[ox, dx, x0, x1, 1, 0], [oy, dy, y0, y1, 3, 2], [oz, dz, z0, z1, 5, 4]];
  for (const [o, d, a, b, fneg, fpos] of axes) {
    if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
    let t1 = (a - o) / d, t2 = (b - o) / d, f1 = fneg, f2 = fpos;
    if (t1 > t2) { [t1, t2] = [t2, t1]; [f1, f2] = [f2, f1]; }
    if (t1 > tmin) { tmin = t1; face = f1; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return { t: Math.max(0, tmin), face };
}

export class Interaction {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.targetEntity = null;
    this.mining = null; // { x,y,z, v, time, need }
    this.cooldown = 0;
    this.useCooldown = 0;
    this.swing = 0;
    this.lastPlace = 0;
  }

  progress() { return this.mining && this.mining.need > 0 ? Math.min(1, this.mining.time / this.mining.need) : 0; }

  reach() { return this.game.player.creative ? 6 : 4.8; }

  pick() {
    const g = this.game, p = g.player, w = g.world;
    const [dx, dy, dz] = lookDir(p.yaw, p.pitch);
    const ox = p.x, oy = p.eyeY, oz = p.z;
    const reach = this.reach();
    const swim = p.medium && p.medium.eyeWater;
    const test = (v) => {
      const id = v & ID_MASK;
      if (LIQUID[id]) return false;
      if (id === B.air || BLOCKS[id].shape === 'none') return false;
      return true;
    };
    test.detail = (v, x, y, z) => {
      const r = rayBoxes(v, x, y, z, ox, oy, oz, dx, dy, dz, w);
      return r && r.t <= reach ? r : null;
    };
    void swim;
    let hit = w.raycast(ox, oy, oz, dx, dy, dz, reach, test);
    // entities
    let ent = null;
    if (g.entities) ent = g.entities.raycast(ox, oy, oz, dx, dy, dz, Math.min(reach, hit ? hit.dist : reach));
    if (ent && (!hit || ent.t < hit.dist)) { this.targetEntity = ent.e; hit = null; } else this.targetEntity = null;
    this.target = hit;
    return hit;
  }

  update(dt) {
    const g = this.game, inp = g.input, p = g.player;
    this.cooldown -= dt; this.useCooldown -= dt;
    this.swing = Math.max(0, this.swing - dt * 3.5);
    if (p.dead || !inp.locked || g.ui.open) { this.mining = null; return; }
    const hit = this.pick();

    // attack / mine
    const lmb = inp.button(0);
    const lclick = inp.clicked(0);
    if (this.targetEntity && (lclick || (lmb && this.cooldown <= 0))) {
      if (lclick || this.cooldown <= 0) {
        g.attackEntity(this.targetEntity);
        this.swing = 1;
        this.cooldown = 0.45;
      }
      this.mining = null;
    } else if (lmb && hit) {
      if (lclick) this.swing = 1;
      if (p.creative) {
        if (lclick || this.cooldown <= 0) {
          this.breakBlock(hit.x, hit.y, hit.z);
          this.cooldown = 0.18;
          this.swing = 1;
        }
      } else {
        const m = this.mining;
        if (!m || m.x !== hit.x || m.y !== hit.y || m.z !== hit.z || m.v !== hit.v) {
          const id = hit.v & ID_MASK;
          let need = breakTime(id, g.inventory.held());
          if (p.medium && p.medium.eyeWater) need *= 3;
          if (!p.onGround && !p.flying && !(p.medium && p.medium.climb) && !(p.medium && p.medium.water > 0.2)) need *= 2.5;
          this.mining = { x: hit.x, y: hit.y, z: hit.z, v: hit.v, time: 0, need, face: hit.face, tick: 0 };
          g.emit('blockHit', hit.x, hit.y, hit.z, hit.v);
        }
        const mm = this.mining;
        mm.time += dt;
        mm.tick -= dt;
        if (mm.tick <= 0) {
          mm.tick = 0.22;
          this.swing = 1;
          g.audio && g.audio.hit(hit.v & ID_MASK, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
          g.particles && g.particles.blockChips(hit.x, hit.y, hit.z, hit.v, hit.face, 3);
        }
        if (mm.time >= mm.need && mm.need < Infinity) {
          this.breakBlock(hit.x, hit.y, hit.z);
          this.mining = null;
        }
      }
    } else {
      this.mining = null;
      if (lclick) { this.swing = 1; g.audio && g.audio.play('swish', { volume: 0.25 }); }
    }

    // use / place
    const rclick = inp.clicked(2);
    const rmb = inp.button(2);
    if (rclick || (rmb && this.useCooldown <= 0)) this.use(rclick, hit);
    if (!rmb && g.onUseRelease) g.onUseRelease();

    // middle click: pick block (creative)
    if (inp.clicked(1) && hit && p.creative) g.pickBlock(hit.v);
  }

  use(fresh, hit) {
    const g = this.game, p = g.player, inv = g.inventory;
    const held = inv.held();
    const hdef = held ? ITEMS[held.id] : null;
    this.useCooldown = 0.22;
    // entity interaction (feeding, riding, trading)
    if (this.targetEntity && fresh) {
      if (g.interactEntity(this.targetEntity, held)) { this.swing = 1; return; }
    }
    // block interaction
    if (hit && !p.sneaking) {
      const d = BLOCKS[hit.v & ID_MASK];
      if (d.use && g.useBlock(hit.x, hit.y, hit.z, hit.v, held, fresh, hit)) { this.swing = 1; this.useCooldown = 0.3; return; }
    }
    // item use
    if (hdef && hdef.use && g.useItem(held, hdef, hit, fresh)) { this.swing = 1; return; }
    if (hdef && hdef.food && g.useItem(held, hdef, hit, fresh)) return;
    // placement
    if (!hit || !held) return;
    let blockId = null;
    if (hdef.block !== undefined) blockId = hdef.block;
    else if (hdef.places) blockId = B[hdef.places];
    if (blockId === null) return;
    // throttle repeated placement when holding the button
    if (!fresh && performance.now() - this.lastPlace < 230) return;
    if (this.place(blockId, hit)) {
      this.lastPlace = performance.now();
      if (!p.creative) inv.consumeHeld(1);
      this.swing = 1;
    }
  }

  place(blockId, hit) {
    const g = this.game, p = g.player, w = g.world;
    const r = resolvePlacement(w, blockId, hit, p);
    if (!r) return false;
    const d = BLOCKS[blockId];
    // don't place solid blocks inside entities
    if (SOLID[blockId] && d.shape !== 'wire') {
      const cells = [[r.x, r.y, r.z], ...r.extra.map((e) => [e[0], e[1], e[2]])];
      for (const [x, y, z] of cells) {
        if (boxOverlapsCell(p, x, y, z)) return false;
        if (g.entities && g.entities.anyInCell(x, y, z)) return false;
      }
    }
    if (!w.isLoaded(r.x, r.z)) return false;
    w.setBlock(r.x, r.y, r.z, r.v, { cause: 'player' });
    for (const [x, y, z, v] of r.extra) w.setBlock(x, y, z, v, { cause: 'player' });
    g.onBlockPlaced && g.onBlockPlaced(r.x, r.y, r.z, r.v);
    g.emit('blockPlaced', r.x, r.y, r.z, r.v);
    g.audio && g.audio.place(blockId, { x: r.x + 0.5, y: r.y + 0.5, z: r.z + 0.5 });
    return true;
  }

  breakBlock(x, y, z) {
    const g = this.game, w = g.world, p = g.player;
    const v = w.getBlock(x, y, z);
    const id = v & ID_MASK;
    const d = BLOCKS[id];
    if (d.hardness < 0 && !p.creative) return false;
    if (id === B.bedrock && !p.creative) return false;
    const held = g.inventory.held();
    g.harvestBlock(x, y, z, v, held, !p.creative);
    if (!p.creative && held && ITEMS[held.id].tool && d.hardness > 0) {
      if (g.inventory.damageHeld(1)) g.onToolBreak(held);
    }
    p.exhaust(0.005);
    return true;
  }
}

function boxOverlapsCell(p, x, y, z) {
  return p.x + p.hw > x && p.x - p.hw < x + 1 && p.y + p.h > y && p.y < y + 1 && p.z + p.hw > z && p.z - p.hw < z + 1;
}

export { REPLACEABLE, ID_BITS, I, boxBlocked };
