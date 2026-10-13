// Creatures: definitions, behaviour (wander / flee / chase / graze / follow / hunt / breed / tame),
// short-range A* pathfinding, light-based spawning and despawning.

import { Entity, ENTITY_TYPES, Projectile } from './entities.js';
import { moveAndCollide, sampleMedium, boxBlocked } from './physics.js';
import { drawModel, MODELS } from './models.js';
import { BLOCKS, B, ID_MASK, SOLID, LIQUID, OPAQUE } from '../world/blocks.js';
import { I, ITEMS } from '../world/items.js';
import { BIOMES, BI, biomeOf } from '../world/biomes.js';
import { angleLerp } from '../core/math.js';

const D = (key, zh, o) => ({ key, zh, model: key, hw: 0.4, h: 1, health: 10, speed: 3, hostile: false, voice: 'chirp', drops: [], ...o });
export const MOBS = {
  deer: D('deer', '绒角鹿', { hw: 0.45, h: 1.4, health: 12, speed: 3.6, flee: true, food: 'wheat', voice: 'deer', drops: [['raw_venison', 1, 3], ['leather', 0, 2]], grazes: true }),
  sheep: D('sheep', '云角羊', { hw: 0.45, h: 1.2, health: 10, speed: 2.6, flee: true, food: 'wheat', voice: 'bleat', drops: [['fluff', 1, 2], ['raw_venison', 1, 2]], grazes: true, shearable: true }),
  puffbird: D('puffbird', '蓬蓬鸟', { hw: 0.3, h: 0.85, health: 4, speed: 2.4, flee: true, food: 'wheat_seeds', voice: 'chirp', drops: [['feather', 0, 2], ['raw_fowl', 1, 1]], flutter: true, lays: true, prey: true }),
  boar: D('boar', '獠牙野猪', { hw: 0.45, h: 1.05, health: 14, speed: 3.2, neutral: true, food: 'sunroot', voice: 'grunt', damage: 3, drops: [['raw_boar', 1, 3], ['leather', 0, 1]] }),
  fox: D('fox', '灵狐', { hw: 0.3, h: 0.8, health: 10, speed: 4.6, tameItem: 'berries', food: 'berries', voice: 'squeak', damage: 3, hunter: true, drops: [] }),
  hare: D('hare', '雪兔', { hw: 0.25, h: 0.6, health: 3, speed: 5, flee: true, skittish: true, food: 'radish', voice: 'squeak', drops: [['leather', 0, 1], ['raw_fowl', 0, 1]], hops: true, prey: true }),
  fish: D('fish', '银鳞鱼', { hw: 0.2, h: 0.3, health: 3, speed: 2.5, swims: true, voice: 'glub', drops: [['raw_fish', 1, 1], ['bone_meal', 0, 1]] }),
  jelly: D('jelly', '浮空水母', { hw: 0.35, h: 0.9, health: 6, speed: 1.2, flies: true, voice: 'boing', glow: 0.6, drops: [['gel', 1, 3], ['glow_spore', 0, 1]] }),
  gloom: D('gloom', '暗影游荡者', { hw: 0.32, h: 1.95, health: 20, speed: 3.1, hostile: true, damage: 3, voice: 'gloom', burns: true, drops: [['bone', 0, 2], ['string', 0, 1], ['glow_spore', 0, 1]] }),
  boomshroom: D('boomshroom', '爆孢菇', { hw: 0.4, h: 1.0, health: 12, speed: 2.8, hostile: true, voice: 'hiss', explodes: true, drops: [['blast_powder', 1, 2], ['red_mushroom', 0, 1]] }),
  archer: D('archer', '晶骨弓手', { hw: 0.3, h: 1.95, health: 18, speed: 3, hostile: true, ranged: true, voice: 'click', burns: true, drops: [['bone', 0, 2], ['arrow', 0, 2], ['crystal_dust', 0, 2]] }),
  spider: D('spider', '织网蛛', { hw: 0.65, h: 0.8, health: 14, speed: 4, hostile: true, damage: 2, climbs: true, voice: 'hiss', drops: [['string', 1, 2]] }),
  emberling: D('emberling', '熔焰灵', { hw: 0.3, h: 1.05, health: 10, speed: 2.2, hostile: true, flies: true, ranged: true, fireproof: true, glow: 0.9, voice: 'buzz', drops: [['blast_powder', 0, 1], ['coal', 0, 2]] }),
  gloop: D('gloop', '泥沼胶团', { hw: 0.4, h: 0.6, health: 8, speed: 2.2, hostile: true, damage: 2, hops: true, voice: 'boing', drops: [['gel', 1, 2]] }),
  warden: D('warden', '遗迹守卫', { hw: 0.85, h: 2.8, health: 120, speed: 2.4, hostile: true, damage: 8, boss: true, voice: 'warden', fireproof: true, drops: [['star_shard', 3, 5], ['echo_crystal', 2, 4]] }),
  trader: D('trader', '游商·鸦羽', { hw: 0.32, h: 1.95, health: 30, speed: 2.2, trader: true, voice: 'chirp', drops: [] }),
};
export const MOB_KINDS = Object.keys(MOBS);

const rnd = (a, b) => a + Math.random() * (b - a);

export class Mob extends Entity {
  constructor(kind) {
    super('mob');
    const d = MOBS[kind];
    this.kind = kind;
    this.def = d;
    this.hw = d.hw; this.h = d.h;
    this.health = d.health;
    this.state = 'idle';
    this.stateT = rnd(1, 4);
    this.target = null;      // { x,y,z } or entity
    this.walk = 0; this.walkAmt = 0;
    this.headYaw = 0; this.headPitch = 0;
    this.hurtT = 0; this.deadT = 0;
    this.attackT = 0; this.atkAnim = 0;
    this.love = 0; this.breedCD = 0;
    this.baby = false; this.growT = 0;
    this.tamed = false; this.sitting = false;
    this.sheared = false;
    this.fuse = 0;
    this.path = null; this.pathT = 0;
    this.eggT = rnd(300, 600);
    this.hunger = rnd(30, 120);
    this.persist = !d.hostile;
    this.noiseT = rnd(4, 14);
    this.aggro = null;
    this.yaw = Math.random() * Math.PI * 2;
    this.stuckT = 0;
    this.bob = 0;
  }

  get alive() { return !this.dead && this.deadT === 0; }
  get scaleF() { return this.baby ? 0.55 : 1; }

  hurt(game, amount, cause, src) {
    if (!this.alive) return false;
    if (this.hurtT > 0.35) return false;
    if (cause === 'fire' && this.def.fireproof) return false;
    this.health -= amount;
    this.hurtT = 0.5;
    game.audio && game.audio.play('mob', { x: this.x, y: this.y + this.h / 2, z: this.z, voice: this.def.voice, pitch: (this.baby ? 1.5 : 1) * 1.2 });
    const attacker = src === game.player || cause === 'player' ? game.player : (src && src.owner === 'player' ? game.player : src && src.type === 'mob' ? src : null);
    if (attacker) {
      if (this.def.flee || this.def.skittish) { this.setState('flee', 5); this.threat = attacker; }
      if (this.def.neutral || this.def.hostile || (this.kind === 'fox' && !this.tamed) || this.def.boss) { this.aggro = attacker; this.setState('chase', 20); }
      if (this.kind === 'boar') for (const e of game.entities.near(this.x, this.y, this.z, 10)) if (e.kind === 'boar' && e !== this) { e.aggro = attacker; e.setState('chase', 15); }
      if (attacker === game.player) game.lastAttacked = this;
    }
    if (this.health <= 0) this.die(game, cause);
    return true;
  }

  die(game, cause) {
    this.health = 0;
    this.deadT = 0.001;
    this.state = 'dead';
    if (!this.baby) for (const [name, a, b] of this.def.drops) {
      const n = a + Math.floor(Math.random() * (b - a + 1));
      let id = I[name];
      if (cause === 'fire' || (this.medium && this.medium.lava)) { if (name === 'raw_venison') id = I.venison; if (name === 'raw_boar') id = I.boar; if (name === 'raw_fowl') id = I.fowl; if (name === 'raw_fish') id = I.fish; }
      if (n > 0 && id !== undefined) game.entities.spawnItem(this.x, this.y + 0.5, this.z, { id, n });
    }
    game.emit('mobKilled', this, cause);
  }

  setState(s, t) { this.state = s; this.stateT = t; this.path = null; }

  distTo(e) { return Math.hypot(e.x - this.x, e.y - this.y, e.z - this.z); }

  // ------------------------------------------------------------ ticking
  tick(game, dt) {
    this.age += dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.deadT > 0) {
      this.deadT += dt;
      this.vx *= 0.8; this.vz *= 0.8;
      this.physics(game, dt);
      if (this.deadT > 1.1) {
        this.dead = true;
        if (game.particles) for (let i = 0; i < 12; i++) game.particles.add({ x: this.x + rnd(-0.4, 0.4), y: this.y + rnd(0, this.h), z: this.z + rnd(-0.4, 0.4), vx: rnd(-0.5, 0.5), vy: rnd(0.5, 1.5), vz: rnd(-0.5, 0.5), r: 0.85, g: 0.85, b: 0.9, a: 0.8, size: 0.18, life: 0.9 });
      }
      return;
    }
    if (this.baby) { this.growT += dt; if (this.growT > 600) this.baby = false; }
    if (this.leaveT !== undefined) { this.leaveT -= dt; if (this.leaveT <= 0) { this.dead = true; if (game.particles) game.particles.sparks(this.x, this.y + 1, this.z, 20, [0.75, 0.6, 1], 2); return; } }
    if (this.breedCD > 0) this.breedCD -= dt;
    if (this.love > 0) { this.love -= dt; if (game.particles && Math.random() < 0.1) game.particles.add({ x: this.x, y: this.y + this.h + 0.2, z: this.z, vy: 0.6, r: 1, g: 0.35, b: 0.5, size: 0.1, life: 1, em: 1 }); }
    this.noiseT -= dt;
    if (this.noiseT <= 0) {
      this.noiseT = rnd(6, 18);
      if (!this.def.swims || Math.random() < 0.2) game.audio && game.audio.play('mob', { x: this.x, y: this.y + this.h * 0.8, z: this.z, voice: this.def.voice, pitch: (this.baby ? 1.4 : 1) * rnd(0.85, 1.15), minGap: 200 });
    }
    this.think(game, dt);
    this.move(game, dt);
    // environmental damage
    const med = this.medium;
    if (med) {
      if (med.lava && !this.def.fireproof) { this.fireT = 5; this.lavaT = (this.lavaT || 0) + dt; if (this.lavaT > 0.5) { this.lavaT = 0; this.hurt(game, 4, 'fire'); } }
      if (med.water > 0.3 && this.def.fireproof && this.kind === 'emberling') { this.waterT = (this.waterT || 0) + dt; if (this.waterT > 0.5) { this.waterT = 0; this.hurt(game, 2, 'water'); } }
      if (!this.def.swims && med.eyeWater && !this.def.flies) { this.airT = (this.airT || 0) + dt; if (this.airT > 15) { this.airT = 14; this.hurt(game, 2, 'drown'); } } else this.airT = 0;
      if (this.def.swims && med.water < 0.2) { this.dryT = (this.dryT || 0) + dt; if (this.dryT > 1) { this.dryT = 0; this.hurt(game, 1, 'dry'); } this.vy += Math.random() < 0.05 ? 4 : 0; }
    }
    if (this.fireT > 0) { this.fireT -= dt; this.burnT = (this.burnT || 0) + dt; if (this.burnT > 1) { this.burnT = 0; this.hurt(game, 1, 'fire'); } if (game.particles && Math.random() < 0.4) game.particles.flame(this.x + rnd(-0.2, 0.2), this.y + rnd(0, this.h), this.z + rnd(-0.2, 0.2)); }
    if (this.def.burns && game.sky && game.sky.daylight > 0.6 && !(game.weather && game.weather.rain > 0.3)) {
      const sky = game.world.skyLight(Math.floor(this.x), Math.floor(this.y + this.h - 0.1), Math.floor(this.z));
      if (sky >= 14) {
        this.sunT = (this.sunT || 0) + dt;
        if (game.particles && Math.random() < 0.5) game.particles.smoke(this.x + rnd(-0.3, 0.3), this.y + rnd(0.2, this.h), this.z + rnd(-0.3, 0.3), 1, true);
        if (this.sunT > 0.6) { this.sunT = 0; this.hurt(game, 3, 'fire'); this.hurtT = 0; }
      }
    }
    if (this.y < -30) this.dead = true;
  }

  think(game, dt) {
    const p = game.player, d = this.def;
    this.stateT -= dt;
    const dp = Math.hypot(p.x - this.x, p.y - this.y, p.z - this.z);
    const peaceful = game.settings.difficulty === 0;
    if (d.hostile && peaceful && !d.boss) { this.dead = true; return; }
    // hostiles notice the player
    if (d.hostile && !p.dead && !p.creative && this.state !== 'chase' && dp < (d.boss ? 18 : 16) && this.canSee(game, p)) { this.aggro = p; this.setState('chase', 30); }
    if (this.aggro && (this.aggro.dead || (this.aggro === p && (p.dead || p.creative)) || (this.aggro.alive === false))) { this.aggro = null; this.setState('idle', 2); }
    // passive animals react to food in hand and threats
    const held = game.inventory.held();
    if (!d.hostile && !this.tamed && held && d.food && held.id === I[d.food] && dp < 9 && this.state !== 'flee') { this.state = 'tempt'; this.stateT = 1; }
    if (d.skittish && p.sprinting && dp < 7 && !p.sneaking && this.state !== 'flee') { this.threat = p; this.setState('flee', 3); }
    if (d.prey && this.state !== 'flee' && Math.random() < 0.05) {
      const pred = game.entities.near(this.x, this.y, this.z, 8, (e) => e.kind === 'fox' && !e.tamed && e.alive)[0];
      if (pred) { this.threat = pred; this.setState('flee', 4); }
    }
    // wild foxes hunt when hungry
    if (d.hunter && !this.tamed) {
      this.hunger -= dt;
      if (this.hunger <= 0 && this.state !== 'chase') {
        const prey = game.entities.near(this.x, this.y, this.z, 16, (e) => e.def && e.def.prey && e.alive)[0];
        if (prey) { this.aggro = prey; this.setState('chase', 20); }
        this.hunger = rnd(40, 120);
      }
    }
    if (this.tamed) return this.thinkTamed(game, dt, dp);
    if (this.love > 0 && this.breedCD <= 0) {
      const mate = game.entities.near(this.x, this.y, this.z, 8, (e) => e !== this && e.kind === this.kind && e.love > 0 && !e.baby && e.breedCD <= 0)[0];
      if (mate) {
        this.target = mate; this.state = 'mate';
        if (this.distTo(mate) < 1.4) {
          this.love = mate.love = 0;
          this.breedCD = mate.breedCD = 300;
          const baby = game.spawnMob(this.kind, (this.x + mate.x) / 2, this.y + 0.2, (this.z + mate.z) / 2, { baby: true });
          if (baby && game.particles) for (let i = 0; i < 7; i++) game.particles.add({ x: baby.x + rnd(-0.4, 0.4), y: baby.y + 0.8, z: baby.z + rnd(-0.4, 0.4), vy: 1, r: 1, g: 0.35, b: 0.5, size: 0.12, life: 1.2, em: 1 });
          game.emit('mobBred', this.kind);
        }
        return;
      }
    }
    switch (this.state) {
      case 'chase': {
        const t = this.aggro;
        if (!t || this.stateT <= 0) { this.aggro = null; this.setState('idle', 2); break; }
        const dist = this.distTo(t);
        if (dist > 40) { this.aggro = null; this.setState('idle', 2); break; }
        if (d.ranged) {
          // keep distance and shoot
          this.target = dist < 7 ? { x: this.x - (t.x - this.x), y: this.y, z: this.z - (t.z - this.z) } : dist > 12 ? t : null;
          this.attackT -= dt;
          if (this.attackT <= 0 && dist < 18 && this.canSee(game, t)) { this.attackT = this.kind === 'emberling' ? 2.6 : 1.9; this.shoot(game, t); }
        } else if (d.explodes) {
          this.target = t;
          if (dist < 2.6) { this.fuse += dt; if (this.fuse === dt) game.audio && game.audio.play('mob', { x: this.x, y: this.y, z: this.z, voice: 'hiss' }); if (this.fuse > 1.4) { this.dead = true; game.explode(this.x, this.y + 0.5, this.z, 3, { source: this }); } }
          else this.fuse = Math.max(0, this.fuse - dt);
          this.target = dist < 2.0 ? null : t;
        } else {
          this.target = t;
          this.attackT -= dt;
          const reach = this.hw + (t.hw || 0.3) + (d.boss ? 1.6 : 0.8);
          if (dist < reach && Math.abs(t.y - this.y) < 1.8 && this.attackT <= 0) {
            this.attackT = d.boss ? 1.6 : 1.0;
            this.atkAnim = 1;
            const mult = [0, 0.5, 1, 1.5][game.settings.difficulty] || 1;
            const dmg = (d.damage || 2) * (t === game.player ? mult : 1);
            if (t === game.player) t.damage(dmg, 'mob', this);
            else if (t.hurt) { t.hurt(game, dmg, 'mob', this); if (!t.alive && this.def.hunter) { this.hunger = rnd(80, 200); this.aggro = null; this.setState('idle', 3); } }
            if (d.boss && game.shakeCamera) game.shakeCamera(0.4);
          }
        }
        break;
      }
      case 'flee': {
        const th = this.threat || game.player;
        if (this.stateT <= 0) { this.setState('idle', 2); break; }
        const dx = this.x - th.x, dz = this.z - th.z, l = Math.hypot(dx, dz) || 1;
        this.target = { x: this.x + dx / l * 6, y: this.y, z: this.z + dz / l * 6 };
        break;
      }
      case 'tempt': {
        if (this.stateT <= 0) { this.setState('idle', 1); break; }
        this.target = dp > 2 ? p : null;
        this.lookAt(p);
        break;
      }
      case 'graze': {
        this.target = null;
        if (this.stateT <= 0) {
          const bx = Math.floor(this.x), by = Math.floor(this.y - 0.1), bz = Math.floor(this.z);
          const w = game.world;
          if (w.getId(bx, by + 1, bz) === B.tall_grass) w.setBlock(bx, by + 1, bz, 0);
          else if (w.getId(bx, by, bz) === B.grass) w.setBlock(bx, by, bz, B.dirt);
          this.sheared = false;
          this.setState('idle', rnd(1, 3));
        }
        break;
      }
      case 'wander':
        if (this.stateT <= 0 || !this.target || Math.hypot(this.target.x - this.x, this.target.z - this.z) < 0.8) this.setState('idle', rnd(2, 6));
        break;
      default: // idle
        this.target = null;
        if (this.stateT <= 0) {
          const r = Math.random();
          if (d.grazes && r < 0.18 && this.onGround) { this.setState('graze', 2.2); break; }
          const a = Math.random() * Math.PI * 2, dist = rnd(3, 9);
          const tx = this.x + Math.cos(a) * dist, tz = this.z + Math.sin(a) * dist;
          this.target = { x: tx, y: this.y, z: tz };
          this.setState('wander', rnd(4, 9));
          this.target = { x: tx, y: this.y, z: tz };
        }
        if (d.lays && !this.baby) { this.eggT -= dt; if (this.eggT <= 0) { this.eggT = rnd(300, 600); game.entities.spawnItem(this.x, this.y + 0.3, this.z, { id: I.egg, n: 1 }); game.audio && game.audio.play('pop', { x: this.x, y: this.y, z: this.z }); } }
    }
  }

  thinkTamed(game, dt, dp) {
    const p = game.player;
    if (this.sitting) { this.target = null; this.lookAt(p); return; }
    // defend the owner
    const foe = game.lastAttacked && game.lastAttacked.alive && game.lastAttacked !== this ? game.lastAttacked : game.entities.near(p.x, p.y, p.z, 10, (e) => e.def && e.def.hostile && e.alive && e.aggro === p)[0];
    if (foe && this.distTo(foe) < 18) {
      this.aggro = foe;
      this.target = foe;
      this.attackT -= dt;
      if (this.distTo(foe) < this.hw + foe.hw + 0.9 && this.attackT <= 0) { this.attackT = 0.8; this.atkAnim = 1; foe.hurt(game, this.def.damage || 3, 'mob', this); }
      return;
    }
    if (dp > 28) { this.setPos(p.x + rnd(-1, 1), p.y + 0.2, p.z + rnd(-1, 1)); return; }
    this.target = dp > 4 ? p : null;
    if (!this.target && Math.random() < 0.01) { const a = Math.random() * 6.28; this.target = { x: p.x + Math.cos(a) * 3, y: p.y, z: p.z + Math.sin(a) * 3 }; }
  }

  canSee(game, t) {
    const ex = this.x, ey = this.y + this.h * 0.85, ez = this.z;
    const tx = t.x, ty = t.y + (t.h || 1.6) * 0.8, tz = t.z;
    const dx = tx - ex, dy = ty - ey, dz = tz - ez;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1) return true;
    const hit = game.world.raycast(ex, ey, ez, dx / len, dy / len, dz / len, len, (v) => OPAQUE[v & ID_MASK] === 1);
    return !hit;
  }

  lookAt(t) {
    const dx = t.x - this.x, dz = t.z - this.z;
    const want = Math.atan2(-dx, -dz);
    let rel = want - this.yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    this.headYaw = Math.max(-1, Math.min(1, rel));
    const dy = (t.y + (t.h || 1.6) * 0.8) - (this.y + this.h * 0.8);
    this.headPitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dy, Math.hypot(dx, dz)))) ;
  }

  shoot(game, t) {
    const kind = this.kind === 'emberling' ? 'spit' : 'arrow';
    const pr = new Projectile(kind, this);
    const sx = this.x, sy = this.y + this.h * 0.75, sz = this.z;
    pr.setPos(sx, sy, sz);
    const tx = t.x, ty = t.y + (t.h || 1.6) * 0.6, tz = t.z;
    const dx = tx - sx, dz = tz - sz, dh = Math.hypot(dx, dz);
    const sp = kind === 'spit' ? 14 : 22;
    const tt = dh / sp;
    pr.vx = dx / tt; pr.vz = dz / tt;
    pr.vy = (ty - sy) / tt + 0.5 * pr.gravity * tt;
    const err = [0, 0.2, 0.1, 0.05][game.settings.difficulty] || 0.1;
    pr.vx += rnd(-1, 1) * sp * err; pr.vz += rnd(-1, 1) * sp * err;
    pr.damage = kind === 'spit' ? 3 : 4;
    if (kind === 'spit') { pr.gravity = 3; pr.vy = (ty - sy) / tt + 0.5 * 3 * tt; pr.fire = true; }
    game.entities.add(pr);
    this.atkAnim = 1;
    game.audio && game.audio.play(kind === 'spit' ? 'ignite' : 'bow', { x: sx, y: sy, z: sz });
  }

  // ------------------------------------------------------------ movement
  move(game, dt) {
    const d = this.def, w = game.world;
    const med = sampleMedium(w, this);
    this.medium = med;
    let speed = d.speed * (this.state === 'chase' ? 1.25 : this.state === 'flee' ? 1.5 : this.state === 'wander' ? 0.55 : 0.8);
    if (this.baby) speed *= 1.1;
    if (this.fuse > 0) speed *= 0.3;
    let tx = 0, tz = 0, ty = 0, has = false;
    let goal = this.target;
    // path following for chasers around obstacles
    if (goal && (this.state === 'chase' || this.state === 'tempt' || this.tamed) && !d.flies && !d.swims) {
      this.pathT -= dt;
      const direct = Math.hypot(goal.x - this.x, goal.z - this.z);
      if (this.pathT <= 0 && direct > 2.5 && (this.hitX || this.hitZ || this.stuckT > 0.5)) {
        this.pathT = 1.2;
        this.path = findPath(w, this, goal, 260);
      }
      if (this.path && this.path.length) {
        const n = this.path[0];
        if (Math.hypot(n[0] + 0.5 - this.x, n[2] + 0.5 - this.z) < 0.45) this.path.shift();
        if (this.path.length) goal = { x: this.path[0][0] + 0.5, y: this.path[0][1], z: this.path[0][2] + 0.5 };
      }
    }
    if (goal) {
      const dx = goal.x - this.x, dz = goal.z - this.z, dist = Math.hypot(dx, dz);
      if (dist > 0.3) { tx = dx / dist; tz = dz / dist; has = true; }
      if (d.flies || d.swims) ty = Math.max(-1, Math.min(1, ((goal.y || this.y) + (goal.h ? goal.h * 0.5 : 0) - this.y) / 3));
    }
    // flying / swimming creatures drift and bob
    if (d.flies) {
      if (!has && !this.target) { tx = Math.sin(this.age * 0.3 + this.id) * 0.4; tz = Math.cos(this.age * 0.27 + this.id) * 0.4; ty = Math.sin(this.age * 0.5 + this.id) * 0.3; has = true; }
      // keep some height above ground
      const below = w.surfaceY(Math.floor(this.x), Math.floor(this.z));
      if (this.kind === 'jelly' && this.y - below < 3) ty = 0.6;
      const k = Math.min(1, dt * 1.5);
      this.vx += (tx * speed - this.vx) * k; this.vz += (tz * speed - this.vz) * k; this.vy += (ty * speed - this.vy) * k;
      moveAndCollide(w, this, this.vx * dt, this.vy * dt, this.vz * dt);
    } else if (d.swims) {
      if (med.water > 0.4) {
        if (!has) { tx = Math.sin(this.age * 0.4 + this.id); tz = Math.cos(this.age * 0.33 + this.id * 2); ty = Math.sin(this.age * 0.7) * 0.3; has = true; }
        const k = Math.min(1, dt * 2);
        this.vx += (tx * speed - this.vx) * k; this.vz += (tz * speed - this.vz) * k; this.vy += (ty * speed * 0.5 - this.vy) * k;
        if (w.getId(Math.floor(this.x), Math.floor(this.y + 0.6), Math.floor(this.z)) !== B.water) this.vy = Math.min(this.vy, -0.5);
      } else { this.vy -= 24 * dt; this.vx *= 0.9; this.vz *= 0.9; }
      moveAndCollide(w, this, this.vx * dt, this.vy * dt, this.vz * dt);
      if (this.hitX) this.vx = 0; if (this.hitZ) this.vz = 0; if (this.hitY) this.vy = 0;
    } else {
      // walkers
      if (has) {
        // don't walk off cliffs or into liquids (unless chasing hard)
        const ax = Math.floor(this.x + tx * (this.hw + 0.5)), az = Math.floor(this.z + tz * (this.hw + 0.5));
        let drop = 0;
        for (let k = 0; k < 4; k++) { if (SOLID[w.getId(ax, Math.floor(this.y) - 1 - k, az)]) break; drop++; }
        const liquidAhead = LIQUID[w.getId(ax, Math.floor(this.y), az)] || LIQUID[w.getId(ax, Math.floor(this.y) - 1, az)];
        if ((drop >= 4 && this.state !== 'chase') || (liquidAhead && !med.water && this.state !== 'chase' && this.state !== 'flee')) { has = false; tx = tz = 0; if (this.state === 'wander') this.setState('idle', 1); }
      }
      const k = Math.min(1, dt * (this.onGround ? 10 : 2));
      if (d.hops) {
        if (this.onGround) { this.vx *= 0.6; this.vz *= 0.6; if (has && Math.random() < dt * 4) { this.vy = this.kind === 'gloop' ? 6.5 : 5.5; this.vx = tx * speed * 1.3; this.vz = tz * speed * 1.3; } }
      } else {
        this.vx += (tx * speed - this.vx) * k; this.vz += (tz * speed - this.vz) * k;
      }
      if (med.water > 0.3) { this.vy += 30 * dt; this.vy *= 0.85; this.vx *= 0.9; this.vz *= 0.9; }
      else if (d.climbs && (this.hitX || this.hitZ) && has) this.vy = 3;
      else this.vy -= (d.flutter && this.vy < 0 ? 8 : 26) * dt;
      if (d.flutter && this.vy < -2.5) this.vy = -2.5;
      const ox = this.x, oz = this.z;
      moveAndCollide(w, this, this.vx * dt, this.vy * dt, this.vz * dt);
      if ((this.hitX || this.hitZ) && this.onGround && has && !d.hops) {
        // hop up one block
        if (!boxBlocked(w, this.x + tx * 0.3, this.y + 1.05, this.z + tz * 0.3, this.hw, this.h)) this.vy = 8.2;
        else this.stuckT += dt;
      } else this.stuckT = Math.max(0, this.stuckT - dt);
      if (this.hitY) this.vy = Math.min(0, this.vy);
      const moved = Math.hypot(this.x - ox, this.z - oz);
      this.walk += moved * (this.baby ? 6 : 4);
      this.walkAmt += ((moved / dt > 0.3 ? 1 : 0) - this.walkAmt) * Math.min(1, dt * 8);
      if (this.stuckT > 3 && this.state === 'wander') this.setState('idle', 1);
    }
    if (this.onGround && this.hitY === false) void 0;
    if (has) {
      const want = Math.atan2(-tx, -tz);
      this.yaw = angleLerp(this.yaw, want, Math.min(1, dt * 8));
    }
    if (this.state !== 'tempt' && this.state !== 'chase') { this.headYaw *= 0.9; this.headPitch *= 0.9; }
    else if (this.aggro) this.lookAt(this.aggro);
    this.atkAnim = Math.max(0, this.atkAnim - dt * 3);
    this.vx *= this.onGround ? 1 : 0.995;
  }

  // ------------------------------------------------------------ rendering
  render(game, r, a) {
    const [x, y, z] = this.lerpPos(a);
    const yaw = angleLerp(this.pyaw, this.yaw, a);
    const l = game.world.getLight(Math.floor(x), Math.floor(y + this.h * 0.6), Math.floor(z));
    const light = [(l & 15) / 15, ((l >> 4) & 15) / 15, ((l >> 8) & 15) / 15, ((l >> 12) & 15) / 15];
    const t = game.time + this.id;
    const pose = {
      walk: this.walk, walkAmt: this.def.hops ? 0 : this.walkAmt, headYaw: this.headYaw, headPitch: this.headPitch, time: t,
      dead: this.deadT ? Math.min(1, this.deadT * 3) : 0, scale: this.scaleF, attack: this.atkAnim,
      graze: this.state === 'graze' ? Math.min(1, (2.2 - this.stateT) * 2) : 0, flap: !this.onGround && this.def.flutter,
      sheared: this.sheared, inflate: Math.min(1, this.fuse / 1.4) * (0.6 + 0.4 * Math.sin(this.fuse * 20)),
      reach: this.kind === 'gloom' && this.state === 'chase' ? 1 : 0, aim: this.kind === 'archer' && this.state === 'chase',
      noAntlers: this.baby || (this.id % 3 === 0), tailSpeed: this.state === 'flee' ? 12 : this.tamed ? 9 : 4,
      bob: this.def.flies ? Math.sin(t * 2) * 0.08 : 0, squash: this.def.hops && this.kind === 'gloop' ? 1 + Math.max(-0.3, Math.min(0.3, -this.vy * 0.05)) : 1,
      spin: this.kind === 'emberling' ? t * 1.5 : 0,
    };
    const overlay = this.hurtT > 0.25 ? [1, 0.15, 0.1, 0.45] : this.fuse > 0 && Math.floor(this.fuse * 8) % 2 ? [1, 1, 1, 0.5] : this.love > 0 ? [1, 0.6, 0.7, 0.12] : null;
    drawModel(r, this.def.model, x, y, z, yaw, pose, light, overlay, this.def.glow || 0);
  }

  interact(game, held) {
    const d = this.def, p = game.player, inv = game.inventory;
    if (!this.alive) return false;
    if (d.trader) { game.openTrade && game.openTrade(this); return true; }
    if (held && d.shearable && held.id === I.shears && !this.sheared && !this.baby) {
      this.sheared = true;
      game.entities.spawnItem(this.x, this.y + 1, this.z, { id: I.fluff, n: 1 + Math.floor(Math.random() * 3) });
      inv.damageHeld(1);
      game.audio && game.audio.play('swish', { x: this.x, y: this.y, z: this.z });
      return true;
    }
    if (held && d.tameItem && !this.tamed && held.id === I[d.tameItem]) {
      if (!p.creative) inv.consumeHeld(1);
      if (Math.random() < 0.34) {
        this.tamed = true; this.persist = true; this.aggro = null;
        game.hud.toast('灵狐信任了你', '它会跟随你、保护你。空手右键让它坐下或起身。', 'discover');
        game.emit('tamed', this.kind);
        if (game.particles) for (let i = 0; i < 8; i++) game.particles.add({ x: this.x + rnd(-0.4, 0.4), y: this.y + 1, z: this.z + rnd(-0.4, 0.4), vy: 1, r: 1, g: 0.4, b: 0.55, size: 0.12, life: 1.2, em: 1 });
      } else if (game.particles) for (let i = 0; i < 5; i++) game.particles.add({ x: this.x + rnd(-0.4, 0.4), y: this.y + 1, z: this.z + rnd(-0.4, 0.4), vy: 0.8, r: 0.5, g: 0.5, b: 0.55, a: 0.7, size: 0.12, life: 1 });
      return true;
    }
    if (this.tamed && !held) { this.sitting = !this.sitting; game.hud.message(this.sitting ? '灵狐坐下了' : '灵狐站了起来'); return true; }
    if (held && d.food && held.id === I[d.food] && !this.baby && this.breedCD <= 0 && this.love <= 0) {
      if (!p.creative) inv.consumeHeld(1);
      this.love = 30;
      if (this.tamed) this.health = Math.min(d.health, this.health + 4);
      game.audio && game.audio.play('eat', { x: this.x, y: this.y, z: this.z });
      return true;
    }
    if (held && d.food && held.id === I[d.food] && this.baby) { if (!p.creative) inv.consumeHeld(1); this.growT += 60; return true; }
    return false;
  }

  serialize() {
    if (!this.persist || !this.alive) return null;
    return { type: 'mob', kind: this.kind, x: this.x, y: this.y, z: this.z, yaw: this.yaw, health: this.health, tamed: this.tamed, sitting: this.sitting, sheared: this.sheared, baby: this.baby, growT: this.growT };
  }
}
ENTITY_TYPES.mob = (o) => {
  if (!MOBS[o.kind]) return null;
  const m = new Mob(o.kind);
  m.setPos(o.x, o.y, o.z);
  Object.assign(m, { yaw: o.yaw || 0, health: o.health || m.health, tamed: !!o.tamed, sitting: !!o.sitting, sheared: !!o.sheared, baby: !!o.baby, growT: o.growT || 0 });
  if (m.tamed) m.persist = true;
  return m;
};

// ---------------------------------------------------------------- pathfinding (small A*)
function walkable(w, x, y, z, h) {
  if (!SOLID[w.getId(x, y - 1, z)] || LIQUID[w.getId(x, y - 1, z)]) return false;
  for (let k = 0; k < h; k++) { const id = w.getId(x, y + k, z); if (SOLID[id] || LIQUID[id] === 2) return false; }
  if (BLOCKS[w.getId(x, y - 1, z)].shape === 'fence') return false;
  return true;
}
export function findPath(w, e, goal, maxNodes = 250) {
  const sx = Math.floor(e.x), sy = Math.floor(e.y + 0.01), sz = Math.floor(e.z);
  const gx = Math.floor(goal.x), gy = Math.floor(goal.y), gz = Math.floor(goal.z);
  const h = Math.ceil(e.h);
  const key = (x, y, z) => `${x},${y},${z}`;
  const open = [{ x: sx, y: sy, z: sz, g: 0, f: 0, parent: null }];
  const seen = new Map([[key(sx, sy, sz), open[0]]]);
  let best = open[0], bestH = Infinity, n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const c = open.splice(bi, 1)[0];
    const hd = Math.abs(c.x - gx) + Math.abs(c.z - gz) + Math.abs(c.y - gy) * 0.5;
    if (hd < bestH) { bestH = hd; best = c; }
    if (hd < 1.5) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      for (const dy of [0, 1, -1, -2, -3]) {
        const nx = c.x + dx, ny = c.y + dy, nz = c.z + dz;
        if (dx && dz && (!walkable(w, c.x + dx, c.y, c.z, h) || !walkable(w, c.x, c.y, c.z + dz, h))) continue;
        if (!walkable(w, nx, ny, nz, h)) continue;
        if (dy === 1 && SOLID[w.getId(c.x, c.y + h, c.z)]) continue;
        const k = key(nx, ny, nz);
        const g = c.g + (dx && dz ? 1.41 : 1) + (dy > 0 ? 0.5 : dy < -1 ? 0.8 : 0);
        const ex = seen.get(k);
        if (ex && ex.g <= g) continue;
        const node = { x: nx, y: ny, z: nz, g, f: g + Math.abs(nx - gx) + Math.abs(nz - gz) + Math.abs(ny - gy), parent: c };
        seen.set(k, node);
        open.push(node);
        break;
      }
    }
  }
  const path = [];
  for (let c = best; c && c.parent; c = c.parent) path.unshift([c.x, c.y, c.z]);
  return path.length ? path : null;
}

// ---------------------------------------------------------------- spawning
const PASSIVE_BY_BIOME = {
  meadow: [['sheep', 3], ['deer', 2], ['puffbird', 3], ['boar', 1]],
  forest: [['deer', 3], ['boar', 2], ['puffbird', 2], ['fox', 1]],
  blossom: [['deer', 2], ['puffbird', 3], ['fox', 1], ['hare', 1]],
  swamp: [['puffbird', 2], ['boar', 1]],
  taiga: [['fox', 2], ['hare', 3], ['deer', 2]],
  tundra: [['hare', 4], ['fox', 2], ['sheep', 1]],
  mountains: [['sheep', 4], ['hare', 1]],
  barrens: [['hare', 2], ['fox', 1]],
  beach: [['puffbird', 1]],
  desert: [['hare', 1]],
  mesa: [['hare', 1]],
  sky: [['sheep', 3], ['puffbird', 2]],
};
const pick = (list) => { let s = 0; for (const [, w] of list) s += w; let r = Math.random() * s; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; };

export function installMobs(game) {
  const w = game.world;
  game.mobKinds = MOB_KINDS;
  game.spawnMob = (kind, x, y, z, opts = {}) => {
    if (!MOBS[kind]) return null;
    const m = new Mob(kind);
    m.setPos(x, y, z);
    if (opts.baby) { m.baby = true; }
    if (opts.persist !== undefined) m.persist = opts.persist;
    game.entities.add(m);
    return m;
  };
  game.mobs = {
    hostileNear(x, y, z, r) { return game.entities.near(x, y, z, r, (e) => e.def && e.def.hostile && e.alive).length > 0; },
    count(filter) { let n = 0; for (const e of game.entities.list) if (e.type === 'mob' && !e.dead && filter(e)) n++; return n; },
  };

  // natural populations in freshly generated chunks
  game.chunks.onChunkLoaded.push((c) => {
    if (!c.generated) return;
    if (Math.random() > 0.22) return;
    const lx = 3 + Math.floor(Math.random() * 10), lz = 3 + Math.floor(Math.random() * 10);
    const x = c.cx * 16 + lx, z = c.cz * 16 + lz;
    const y = c.heights[(lz << 4) | lx];
    const top = c.blocks[(y << 8) | (lz << 4) | lx] & ID_MASK;
    if (top !== B.grass && top !== B.snow_grass && top !== B.sky_grass && top !== B.snow_layer && top !== B.tall_grass && top !== B.pale_soil && top !== B.sand) return;
    const biome = BIOMES[biomeOf(c.biomes[(lz << 4) | lx], y)].key;
    const list = PASSIVE_BY_BIOME[biome];
    if (!list) return;
    const kind = pick(list);
    const n = kind === 'fox' ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) game.spawnMob(kind, x + 0.5 + (Math.random() - 0.5) * 3, y + 1.2, z + 0.5 + (Math.random() - 0.5) * 3, { baby: Math.random() < 0.15 });
  });

  // the player's own body in third person
  game.addSystem({
    renderOpaque(g, r) {
      if (!g.thirdPerson || g.player.dead) return;
      r.beginEntities();
      const p = g.player;
      const l = w.getLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z));
      const light = [(l & 15) / 15, ((l >> 4) & 15) / 15, ((l >> 8) & 15) / 15, ((l >> 12) & 15) / 15];
      const pose = { walk: p.bob * Math.PI, walkAmt: p.bobAmt, headPitch: -p.pitch * 0.8, time: g.time, attack: g.interaction.swing, squash: p.sneaking ? 0.92 : 1 };
      drawModel(r, 'player', p.x, p.y, p.z, p.yaw, pose, light, p.hurtTime > 0.2 ? [1, 0.2, 0.2, 0.4] : null);
    },
  });

  let spawnT = 0;
  game.addSystem({
    tick(g) {
      spawnT -= 0.05;
      if (spawnT > 0) return;
      spawnT = 1;
      const p = g.player;
      let hostile = 0, passive = 0, fish = 0, jelly = 0;
      for (const e of g.entities.list) {
        if (e.type !== 'mob' || e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        // despawn far-away hostiles and ambient creatures
        if (!e.persist && !e.def.boss && (d > 90 || (d > 40 && Math.random() < 0.004))) { e.dead = true; continue; }
        if (e.def.hostile) hostile++;
        else if (e.kind === 'fish') fish++;
        else if (e.kind === 'jelly') jelly++;
        else if (d < 96) passive++;
      }
      const diff = g.settings.difficulty;
      const hostileCap = [0, 10, 18, 28][diff] || 18;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (hostile < hostileCap) { if (trySpawnHostile(g)) hostile++; }
      }
      if (fish < 10 && Math.random() < 0.5) { if (trySpawnFish(g)) fish++; }
      if (jelly < 6 && p.y > 120 && Math.random() < 0.4) trySpawnJelly(g);
      if (passive < 14 && Math.random() < 0.1) trySpawnPassive(g);
      // the wandering trader visits now and then during the day
      if (g.sky && g.sky.daylight > 0.7 && Math.random() < 0.0015 && g.mobs.count((e) => e.kind === 'trader') === 0 && g.day > 1) trySpawnTrader(g);
    },
  });

  function randomAround(p, rmin, rmax) {
    const a = Math.random() * Math.PI * 2, d = rmin + Math.random() * (rmax - rmin);
    return [Math.floor(p.x + Math.cos(a) * d), Math.floor(p.z + Math.sin(a) * d)];
  }

  function spaceFor(x, y, z, h) {
    if (!SOLID[w.getId(x, y - 1, z)] || LIQUID[w.getId(x, y - 1, z)]) return false;
    for (let k = 0; k < Math.ceil(h); k++) { const id = w.getId(x, y + k, z); if (SOLID[id] || LIQUID[id]) return false; }
    return true;
  }

  function trySpawnHostile(g) {
    const p = g.player;
    const [x, z] = randomAround(p, 22, 52);
    if (!w.isLoaded(x, z)) return false;
    // choose a height: surface at night, or a cave pocket near the player's depth
    const surf = w.surfaceY(x, z);
    let y;
    const night = g.sky.daylight < 0.25 || (g.weather && g.weather.storm > 0.6 && g.sky.daylight < 0.6);
    if (Math.random() < 0.5 && night) y = surf + 1;
    else {
      y = Math.floor(p.y) + Math.floor(Math.random() * 30) - 15;
      // find floor below
      let k = 0;
      while (k < 12 && !SOLID[w.getId(x, y - 1, z)]) { y--; k++; }
    }
    if (y < 2 || y > 250) return false;
    const L = w.getLight(x, y, z);
    const sky = L & 15, blk = Math.max((L >> 4) & 15, (L >> 8) & 15, (L >> 12) & 15);
    if (blk > 3) return false;
    const effSky = sky * (g.sky.daylight > 0.25 ? 1 : 0);
    if (effSky > 6) return false;
    const ground = w.getId(x, y - 1, z);
    if (ground === B.glass || BLOCKS[ground].leaves || BLOCKS[ground].shape === 'slab') return false;
    // pick species
    const biome = BIOMES[w.biomeAt(x, z, y)].key;
    let kind;
    const deep = y < 46 && sky < 4;
    const r = Math.random();
    if (deep && y < 30 && r < 0.25) kind = 'emberling';
    else if (biome === 'swamp' && !deep && r < 0.35) kind = 'gloop';
    else if (r < 0.45) kind = 'gloom';
    else if (r < 0.65) kind = 'boomshroom';
    else if (r < 0.85) kind = 'archer';
    else kind = 'spider';
    const d = MOBS[kind];
    if (!d.flies && !spaceFor(x, y, z, d.h)) return false;
    if (d.flies && (SOLID[w.getId(x, y, z)] || SOLID[w.getId(x, y + 1, z)])) return false;
    if (Math.hypot(x - p.x, y - p.y, z - p.z) < 20) return false;
    const n = kind === 'gloom' && Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) g.spawnMob(kind, x + 0.5 + i * 0.6, y + 0.05, z + 0.5);
    return true;
  }

  function trySpawnFish(g) {
    const p = g.player;
    const [x, z] = randomAround(p, 10, 32);
    if (!w.isLoaded(x, z)) return false;
    const y = Math.floor(Math.min(62, p.y + 10));
    for (let yy = y; yy > y - 20; yy--) {
      if (w.getId(x, yy, z) === B.water && w.getId(x, yy - 1, z) === B.water && w.getId(x, yy + 1, z) === B.water) {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) g.spawnMob('fish', x + 0.5 + Math.random(), yy + 0.3, z + 0.5 + Math.random());
        return true;
      }
    }
    return false;
  }
  function trySpawnJelly(g) {
    const p = g.player;
    const [x, z] = randomAround(p, 16, 40);
    const y = Math.floor(p.y + (Math.random() - 0.3) * 20);
    if (!w.isLoaded(x, z) || w.getId(x, y, z) || w.getId(x, y + 1, z)) return;
    g.spawnMob('jelly', x + 0.5, y, z + 0.5, { persist: false });
  }
  function trySpawnPassive(g) {
    const p = g.player;
    const [x, z] = randomAround(p, 30, 60);
    if (!w.isLoaded(x, z)) return;
    const y = w.surfaceY(x, z);
    const top = w.getId(x, y, z);
    if (top !== B.grass && top !== B.snow_grass && top !== B.sky_grass) return;
    if (w.skyLight(x, y + 1, z) < 10) return;
    const list = PASSIVE_BY_BIOME[BIOMES[w.biomeAt(x, z, y)].key];
    if (!list) return;
    const kind = pick(list);
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) g.spawnMob(kind, x + 0.5 + Math.random() * 2, y + 1.1, z + 0.5 + Math.random() * 2);
  }
  function trySpawnTrader(g) {
    const p = g.player;
    const [x, z] = randomAround(p, 14, 24);
    if (!w.isLoaded(x, z)) return;
    const y = w.surfaceY(x, z) + 1;
    if (!spaceFor(x, y, z, 2)) return;
    const t = g.spawnMob('trader', x + 0.5, y, z + 0.5, { persist: false });
    t.leaveT = 600;
    g.hud.toast('游商来访', '一位背着行囊的游商出现在附近。右键与她交易。', 'discover');
  }
  void ITEMS; void BI; void MODELS;
}
