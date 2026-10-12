// Entity framework and the simple entity types: dropped items, falling blocks, projectiles,
// primed blast barrels. Entities tick at 20 Hz and render interpolated.

import { moveAndCollide, sampleMedium } from './physics.js';
import { BLOCKS, B, ID_MASK, ID_BITS, SOLID, LIQUID, OPAQUE, REPLACEABLE } from '../world/blocks.js';
import { ITEMS, I, maxStack } from '../world/items.js';
import { mat4, identity, translate, rotateY, rotateX, rotateZ, scale } from '../core/math.js';
import { MeshBuilder, blockModelMesh } from '../render/itemmesh.js';
import { rayAABB } from '../interaction.js';

let nextId = 1;
export const ENTITY_TYPES = Object.create(null);

export class Entity {
  constructor(type) {
    this.id = nextId++;
    this.type = type;
    this.x = 0; this.y = 0; this.z = 0;
    this.px = 0; this.py = 0; this.pz = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pyaw = 0;
    this.hw = 0.25; this.h = 0.5;
    this.onGround = false;
    this.dead = false;
    this.age = 0;
    this.gravity = 24;
    this.drag = 0.98;
    this.persist = true;
  }
  setPos(x, y, z) { this.x = this.px = x; this.y = this.py = y; this.z = this.pz = z; }
  savePrev() { this.px = this.x; this.py = this.y; this.pz = this.z; this.pyaw = this.yaw; }
  lerpPos(a) { return [this.px + (this.x - this.px) * a, this.py + (this.y - this.py) * a, this.pz + (this.z - this.pz) * a]; }
  physics(game, dt) {
    this.vy -= this.gravity * dt;
    const med = sampleMedium(game.world, this);
    this.medium = med;
    if (med.water > 0.1) { this.vy += this.gravity * 1.25 * dt * Math.min(1, med.water * 1.4); this.vx *= 0.9; this.vz *= 0.9; this.vy *= 0.85; }
    if (med.lava) { this.vx *= 0.6; this.vz *= 0.6; this.vy *= 0.6; }
    const [dx, dy, dz] = moveAndCollide(game.world, this, this.vx * dt, this.vy * dt, this.vz * dt);
    void dx; void dy; void dz;
    if (this.hitX) this.vx *= -0.2;
    if (this.hitZ) this.vz *= -0.2;
    if (this.hitY) this.vy = 0;
    const f = this.onGround ? Math.pow(BLOCKS[game.world.getId(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z))].friction > 0.9 ? 0.98 : 0.6, dt * 20) : Math.pow(this.drag, dt * 20);
    this.vx *= f; this.vz *= f;
  }
  lightAt(game, x, y, z) {
    const l = game.world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
    return [(l & 15) / 15, ((l >> 4) & 15) / 15, ((l >> 8) & 15) / 15, ((l >> 12) & 15) / 15];
  }
  serialize() { return null; }
}

// ---------------------------------------------------------------- dropped items
export class ItemEntity extends Entity {
  constructor(stack) {
    super('item');
    this.stack = stack;
    this.hw = 0.15; this.h = 0.3;
    this.pickupDelay = 0.5;
    this.spin = Math.random() * Math.PI * 2;
    this.lifetime = 300;
  }
  tick(game, dt) {
    this.age += dt;
    this.pickupDelay -= dt;
    if (this.age > this.lifetime) { this.dead = true; return; }
    this.physics(game, dt);
    if (this.medium && this.medium.lava && !ITEMS[this.stack.id].name.startsWith('shard_')) { this.dead = true; game.particles && game.particles.smoke(this.x, this.y, this.z, 4, true); game.audio && game.audio.play('fizz', { x: this.x, y: this.y, z: this.z }); return; }
    // conveyors carry items
    if (this.onGround && game.conveyorVel) {
      const v = game.conveyorVel(this.x, this.y - 0.1, this.z);
      if (v) { this.vx = v[0]; this.vz = v[1]; this.onConveyor = true; } else this.onConveyor = false;
    }
    if (this.y < -64) this.dead = true;
  }
  render(game, r, a) {
    const m = game.itemMeshes.get(this.stack.id);
    const [x, y, z] = this.lerpPos(a);
    const t = game.time;
    const bob = Math.sin(t * 2.5 + this.spin) * 0.06 + 0.12;
    const s = m.kind === 'block' ? 0.26 : 0.42;
    const count = this.stack.n > 32 ? 3 : this.stack.n > 1 ? 2 : 1;
    const L = this.lightAt(game, x, y + 0.2, z);
    for (let k = 0; k < count; k++) {
      const M = this.model || (this.model = mat4());
      identity(M);
      translate(M, M, x + k * 0.06, y + bob + s * 0.5 + k * 0.05, z + k * 0.05);
      rotateY(M, M, t * 1.4 + this.spin + k);
      scale(M, M, s, s, s);
      r.drawMesh(m, M, L, null, ITEMS[this.stack.id] && game.itemGlows(this.stack.id) ? 0.7 : 0);
    }
  }
  serialize() { return { type: 'item', x: this.x, y: this.y, z: this.z, stack: this.stack, age: this.age }; }
}
ENTITY_TYPES.item = (o) => { const e = new ItemEntity(o.stack); e.setPos(o.x, o.y, o.z); e.age = o.age || 0; return e; };

// ---------------------------------------------------------------- falling (or rising) blocks
export class FallingBlock extends Entity {
  constructor(v) {
    super('falling');
    this.v = v;
    this.hw = 0.49; this.h = 0.98;
    this.dir = BLOCKS[v & ID_MASK].gravity < 0 ? -1 : 1;
    this.gravity = 28 * this.dir;
  }
  tick(game, dt) {
    this.age += dt;
    const w = game.world;
    this.vy -= this.gravity * dt;
    moveAndCollide(w, this, 0, this.vy * dt, 0);
    const landed = this.dir > 0 ? this.onGround : this.hitY && this.vy > 0;
    if (landed || this.age > 20 || this.y < -10 || this.y > 260) {
      const x = Math.floor(this.x), y = Math.floor(this.y + 0.5), z = Math.floor(this.z);
      const cur = w.getBlock(x, y, z) & ID_MASK;
      if ((cur === 0 || REPLACEABLE[cur]) && y > 0 && y < 255) {
        w.setBlock(x, y, z, this.v);
        game.audio && game.audio.place(this.v & ID_MASK, { x, y, z });
      } else game.spawnItem(this.x, this.y + 0.5, this.z, { id: this.v & ID_MASK, n: 1 });
      this.dead = true;
    }
    // falling onto a living thing hurts a little
    if (this.dir > 0 && this.vy < -8) {
      const p = game.player;
      if (Math.abs(p.x - this.x) < 0.8 && Math.abs(p.z - this.z) < 0.8 && this.y > p.y && this.y - p.y < 2) { p.damage(2, 'falling'); }
    }
  }
  render(game, r, a) {
    if (!this.mesh) { const mb = new MeshBuilder(); blockModelMesh(mb, this.v, 1); this.mesh = mb.build(r); }
    const [x, y, z] = this.lerpPos(a);
    const M = this.model || (this.model = mat4());
    identity(M); translate(M, M, x, y + 0.5, z);
    r.drawMesh(this.mesh, M, this.lightAt(game, x, y + 0.5, z));
  }
  dispose(r) { if (this.mesh) r.deleteMesh(this.mesh); }
  serialize() { return { type: 'falling', x: this.x, y: this.y, z: this.z, v: this.v }; }
}
ENTITY_TYPES.falling = (o) => { const e = new FallingBlock(o.v); e.setPos(o.x, o.y, o.z); return e; };

// ---------------------------------------------------------------- projectiles (arrows, snowballs, eggs, spit)
export class Projectile extends Entity {
  constructor(kind, owner) {
    super('projectile');
    this.kind = kind;            // 'arrow' | 'glow_arrow' | 'snowball' | 'egg' | 'spit' | 'shard'
    this.owner = owner;          // entity or 'player'
    this.hw = 0.1; this.h = 0.2;
    this.gravity = kind === 'arrow' || kind === 'glow_arrow' ? 18 : 22;
    this.stuck = false;
    this.damage = kind === 'arrow' ? 6 : kind === 'glow_arrow' ? 5 : kind === 'spit' ? 3 : 0;
    this.persist = kind.endsWith('arrow');
  }
  tick(game, dt) {
    this.age += dt;
    if (this.stuck) {
      if (this.age > 60) this.dead = true;
      // pick arrows back up
      if (this.owner === 'player' && this.kind.endsWith('arrow')) {
        const p = game.player;
        if (Math.hypot(p.x - this.x, p.y + 0.9 - this.y, p.z - this.z) < 1.4) {
          if (game.inventory.add(I[this.kind], 1) === 0) { this.dead = true; game.audio && game.audio.play('pickup'); }
        }
      }
      if (!SOLID[game.world.getId(this.stuckAt[0], this.stuckAt[1], this.stuckAt[2])]) { this.stuck = false; }
      return;
    }
    const w = game.world;
    this.vy -= this.gravity * dt;
    const med = sampleMedium(w, this);
    if (med.water > 0.2) { this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.9; }
    const sp = Math.hypot(this.vx, this.vy, this.vz);
    if (sp > 0.1) this.yaw = Math.atan2(-this.vx, -this.vz), this.pitch = Math.asin(this.vy / sp);
    // ray step for hits
    const steps = Math.max(1, Math.ceil(sp * dt / 0.25));
    for (let s = 0; s < steps; s++) {
      const nx = this.x + this.vx * dt / steps, ny = this.y + this.vy * dt / steps, nz = this.z + this.vz * dt / steps;
      // entity hits
      const target = game.entities.hitTest(this, nx, ny, nz);
      if (target) { this.hit(game, target); return; }
      const v = w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
      const id = v & ID_MASK;
      if (SOLID[id] && !LIQUID[id]) {
        this.hitBlock(game, Math.floor(nx), Math.floor(ny), Math.floor(nz), v);
        return;
      }
      this.x = nx; this.y = ny; this.z = nz;
    }
    if (this.age > 30 || this.y < -20) this.dead = true;
  }
  hit(game, target) {
    const sp = Math.hypot(this.vx, this.vy, this.vz);
    if (target === 'player') {
      const p = game.player;
      if (this.owner !== 'player') { p.damage(this.damage || 1, 'projectile', this.owner && this.owner.def ? this.owner : this); if (this.fire) p.fireTime = Math.max(p.fireTime, 3); }
    } else if (target.hurt) {
      const dmg = this.damage ? Math.ceil(this.damage * Math.min(1.4, sp / 28)) : 0.5;
      target.hurt(game, dmg, this.owner === 'player' ? 'player' : 'projectile', this);
      if (this.kind === 'snowball' && target.def && target.def.key === 'emberling') target.hurt(game, 3, 'snow', this);
    }
    this.impact(game);
    this.dead = true;
  }
  hitBlock(game, x, y, z, v) {
    const id = v & ID_MASK;
    if (this.kind.endsWith('arrow')) {
      this.stuck = true; this.stuckAt = [x, y, z]; this.age = 0;
      game.audio && game.audio.play('arrow_hit', { x: this.x, y: this.y, z: this.z });
      if (this.kind === 'glow_arrow' && game.lights) game.lights.flash(this.x, this.y, this.z);
      // arrows ring note blocks and press wooden buttons / targets
      if (game.onArrowHitBlock) game.onArrowHitBlock(x, y, z, v, this);
    } else {
      this.impact(game);
      this.dead = true;
    }
    void id;
  }
  impact(game) {
    if (this.kind === 'snowball' && game.particles) for (let i = 0; i < 8; i++) game.particles.add({ x: this.x, y: this.y, z: this.z, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, r: 0.95, g: 0.97, b: 1, size: 0.06, life: 0.5, grav: 14 });
    if (this.kind === 'egg') {
      game.particles && game.particles.sparks(this.x, this.y, this.z, 6, [1, 0.95, 0.8], 2);
      if (Math.random() < 0.125 && game.spawnMob) game.spawnMob('puffbird', this.x, this.y, this.z, { baby: true });
    }
    if (this.kind === 'spit' && game.particles) game.particles.sparks(this.x, this.y, this.z, 8, [0.6, 1, 0.4], 2);
  }
  render(game, r, a) {
    const [x, y, z] = this.lerpPos(a);
    if (!this.mesh) {
      const mb = new MeshBuilder();
      if (this.kind.endsWith('arrow')) {
        mb.box(-0.025, -0.025, -0.35, 0.025, 0.025, 0.25, [0.55, 0.4, 0.25, 1]);
        mb.box(-0.04, -0.04, -0.42, 0.04, 0.04, -0.33, [0.8, 0.82, 0.86, 1]);
        const f = this.kind === 'glow_arrow' ? [0.5, 0.95, 0.85, 1] : [0.92, 0.92, 0.95, 1];
        mb.box(-0.005, -0.07, 0.15, 0.005, 0.07, 0.3, f);
        mb.box(-0.07, -0.005, 0.15, 0.07, 0.005, 0.3, f);
      } else {
        const c = this.kind === 'snowball' ? [0.96, 0.98, 1, 1] : this.kind === 'egg' ? [0.95, 0.9, 0.78, 1] : this.kind === 'spit' ? [0.55, 0.9, 0.35, 1] : [0.8, 0.9, 1, 1];
        mb.box(-0.1, -0.1, -0.1, 0.1, 0.1, 0.1, c);
      }
      this.mesh = mb.build(r);
    }
    const M = this.model || (this.model = mat4());
    identity(M); translate(M, M, x, y, z);
    rotateY(M, M, this.yaw || 0);
    rotateX(M, M, this.pitch || 0);
    r.drawMesh(this.mesh, M, this.lightAt(game, x, y, z), null, this.kind === 'glow_arrow' || this.kind === 'shard' ? 0.8 : 0);
  }
  dispose(r) { if (this.mesh) r.deleteMesh(this.mesh); }
  serialize() { return this.stuck && this.kind.endsWith('arrow') ? { type: 'projectile', kind: this.kind, x: this.x, y: this.y, z: this.z } : null; }
}
ENTITY_TYPES.projectile = (o) => { const e = new Projectile(o.kind, 'player'); e.setPos(o.x, o.y, o.z); e.stuck = true; e.stuckAt = [Math.floor(o.x), Math.floor(o.y), Math.floor(o.z)]; return e; };

// ---------------------------------------------------------------- primed blast barrel
export class PrimedBarrel extends Entity {
  constructor(fuse = 3.2) { super('primed'); this.fuse = fuse; this.hw = 0.49; this.h = 0.98; }
  tick(game, dt) {
    this.physics(game, dt);
    this.fuse -= dt;
    if (game.particles && Math.random() < 0.5) game.particles.smoke(this.x, this.y + 1, this.z, 1);
    if (this.fuse <= 0) { this.dead = true; game.explode(this.x, this.y + 0.5, this.z, 4, { fire: false, source: this }); }
  }
  render(game, r, a) {
    if (!this.mesh) { const mb = new MeshBuilder(); blockModelMesh(mb, B.blast_barrel, 1); this.mesh = mb.build(r); }
    const [x, y, z] = this.lerpPos(a);
    const M = this.model || (this.model = mat4());
    const pulse = 1 + Math.max(0, 0.3 - this.fuse) * 0.4;
    identity(M); translate(M, M, x, y + 0.5, z); scale(M, M, pulse, pulse, pulse);
    const flash = Math.floor(this.fuse * 4) % 2 === 0;
    r.drawMesh(this.mesh, M, this.lightAt(game, x, y + 0.5, z), flash ? [1, 1, 1, 0.55] : null);
  }
  dispose(r) { if (this.mesh) r.deleteMesh(this.mesh); }
}

// ---------------------------------------------------------------- manager
export class EntityManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.byId = new Map();
    this.mergeT = 0;
  }
  add(e) { this.list.push(e); this.byId.set(e.id, e); return e; }

  spawnItem(x, y, z, stack, vel, delay = 0.5) {
    if (!stack || !stack.n || !ITEMS[stack.id]) return null;
    const e = new ItemEntity({ ...stack });
    e.setPos(x, y, z);
    if (vel) { e.vx = vel[0]; e.vy = vel[1]; e.vz = vel[2]; }
    else { e.vx = (Math.random() - 0.5) * 2.5; e.vy = 3 + Math.random() * 1.5; e.vz = (Math.random() - 0.5) * 2.5; }
    e.pickupDelay = delay;
    return this.add(e);
  }

  tick(dt) {
    const g = this.game, p = g.player;
    for (const e of this.list) e.savePrev();
    for (const e of this.list) {
      if (e.dead) continue;
      // freeze entities in unloaded chunks
      if (!g.world.isLoaded(Math.floor(e.x), Math.floor(e.z))) continue;
      e.tick(g, dt);
    }
    // pickup
    if (!p.dead) {
      for (const e of this.list) {
        if (e.dead || e.type !== 'item' || e.pickupDelay > 0) continue;
        const dx = p.x - e.x, dy = (p.y + 0.8) - e.y, dz = p.z - e.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < 1.6) {
          const left = g.inventory.add(e.stack.id, e.stack.n, e.stack.dmg || e.stack.tag ? { dmg: e.stack.dmg, tag: e.stack.tag } : null);
          if (left < e.stack.n) {
            g.audio && g.audio.play('pickup', { pitch: 0.9 + Math.random() * 0.4 });
            g.onPickup && g.onPickup(e.stack.id, e.stack.n - left);
          }
          if (left === 0) e.dead = true; else e.stack.n = left;
        } else if (d < 2.6) {
          // gentle magnet
          e.vx += dx / d * 0.6; e.vy += dy / d * 0.6; e.vz += dz / d * 0.6;
        }
      }
    }
    // merge nearby item stacks
    this.mergeT -= dt;
    if (this.mergeT <= 0) {
      this.mergeT = 1;
      const items = this.list.filter((e) => e.type === 'item' && !e.dead && !e.onConveyor);
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        if (a.dead) continue;
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j];
          if (b.dead || b.stack.id !== a.stack.id || a.stack.dmg || b.stack.dmg || a.stack.tag || b.stack.tag) continue;
          if (Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 || Math.abs(a.z - b.z) > 1) continue;
          const ms = maxStack(a.stack.id);
          if (a.stack.n + b.stack.n > ms) continue;
          a.stack.n += b.stack.n; b.dead = true;
          a.age = Math.min(a.age, b.age);
        }
      }
    }
    // cleanup
    if (this.list.some((e) => e.dead)) {
      this.list = this.list.filter((e) => {
        if (e.dead) { this.byId.delete(e.id); if (e.dispose) e.dispose(this.game.renderer); if (e.onRemove) e.onRemove(this.game); return false; }
        return true;
      });
    }
  }

  render(r, alpha) {
    const g = this.game;
    r.beginEntities();
    const cam = g.cam;
    const maxD = (g.settings.renderDist * 16) ** 2;
    for (const e of this.list) {
      const dx = e.x - cam.x, dz = e.z - cam.z;
      if (dx * dx + dz * dz > maxD) continue;
      e.render(g, r, alpha);
    }
  }

  // closest entity hit along a ray (for attacking / interacting)
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null;
    for (const e of this.list) {
      if (e.dead || !e.hurt) continue;
      const hw = e.hw + 0.1;
      const r = rayAABB(ox, oy, oz, dx, dy, dz, e.x - hw, e.y, e.z - hw, e.x + hw, e.y + e.h, e.z + hw);
      if (r && r.t <= maxDist && (!best || r.t < best.t)) best = { e, t: r.t };
    }
    return best;
  }

  // projectile collision test against living entities and the player
  hitTest(proj, x, y, z) {
    const p = this.game.player;
    if (proj.owner !== 'player' && !p.dead && Math.abs(p.x - x) < p.hw + 0.1 && Math.abs(p.z - z) < p.hw + 0.1 && y > p.y && y < p.y + p.h) return 'player';
    for (const e of this.list) {
      if (e === proj || e.dead || !e.hurt || e === proj.owner) continue;
      if (Math.abs(e.x - x) < e.hw + 0.1 && Math.abs(e.z - z) < e.hw + 0.1 && y > e.y && y < e.y + e.h) return e;
    }
    return null;
  }

  anyInCell(x, y, z) {
    for (const e of this.list) {
      if (e.dead || e.type === 'item' || e.type === 'projectile') continue;
      if (e.x + e.hw > x && e.x - e.hw < x + 1 && e.y + e.h > y && e.y < y + 1 && e.z + e.hw > z && e.z - e.hw < z + 1) return true;
    }
    return false;
  }

  near(x, y, z, r, filter) {
    const out = [];
    for (const e of this.list) {
      if (e.dead) continue;
      if (filter && !filter(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y, e.z - z);
      if (d <= r) out.push(e);
    }
    return out;
  }

  attack(e) { if (this.game.meleeAttack) this.game.meleeAttack(e); }
  interact(e, held) { return e.interact ? e.interact(this.game, held) : false; }

  // ---- persistence: entities live in the chunk they stand in
  takeChunkEntities(chunk) {
    const out = [];
    const bx = chunk.cx * 16, bz = chunk.cz * 16;
    for (const e of this.list) {
      if (e.dead) continue;
      if (e.x < bx || e.x >= bx + 16 || e.z < bz || e.z >= bz + 16) continue;
      if (e.persist !== false) { const s = e.serialize(); if (s) out.push(s); }
      e.dead = true;
    }
    return out;
  }
  restore(list) {
    for (const o of list || []) {
      const f = ENTITY_TYPES[o.type];
      if (!f) continue;
      try { const e = f(o, this.game); if (e) this.add(e); } catch (err) { console.warn('entity restore failed', o.type, err); }
    }
  }
}

export { rotateZ, OPAQUE, ID_BITS };
