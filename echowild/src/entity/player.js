// The player: movement (walk, sprint, sneak, swim, climb, fly, glide, grapple), camera and vitals.

import { moveAndCollide, boxBlocked, sampleMedium, contactDamage } from './physics.js';
import { BLOCKS, ID_MASK } from '../world/blocks.js';
import { clamp, lerp } from '../core/math.js';

export const EYE = 1.62, EYE_SNEAK = 1.3;
const GRAVITY = 30, TERMINAL = 62;
const WALK = 4.4, SPRINT = 5.9, SNEAK = 1.5, SWIM = 2.6, FLY = 11, FLY_SPRINT = 24;
const JUMP_V = 8.9;
const STEP = 0.6;

export class Player {
  constructor(game) {
    this.game = game;
    this.x = 0.5; this.y = 100; this.z = 0.5;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0;
    this.hw = 0.3; this.h = 1.8; this.eye = EYE;
    this.eyeH = EYE;
    this.onGround = false;
    this.sneaking = false; this.sprinting = false; this.flying = false; this.gliding = false;
    this.creative = false;
    this.medium = null;
    this.fallStart = null;
    this.health = 20; this.maxHealth = 20;
    this.hunger = 20; this.saturation = 5; this.exhaustion = 0;
    this.air = 300; this.maxAir = 300;
    this.dead = false;
    this.hurtTime = 0; this.invuln = 0;
    this.bob = 0; this.bobAmt = 0;
    this.stepDist = 0;
    this.grapple = null; // { x,y,z, len } when attached
    this.knock = [0, 0, 0];
    this.spawn = null;
    this.prev = { x: 0, y: 0, z: 0 };
    this.fireTime = 0;
    this.effects = {};
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.lastJumpTap = 0;
    this.camRoll = 0;
    this.landShake = 0;
  }

  get eyeY() { return this.y + this.eyeH; }

  // input: { fwd, strafe, jump, sneak, sprint, jumpPressed, flyToggle }
  update(dt, inp) {
    const world = this.game.world;
    this.prev.x = this.x; this.prev.y = this.y; this.prev.z = this.z;
    if (this.dead) { this.vx = this.vz = 0; return; }
    if (this.riding) { this.riding.carry(this, inp, dt); this.fallStart = null; this.updateVitals(dt); return; }
    if (!world.isLoaded(Math.floor(this.x), Math.floor(this.z))) return; // wait for terrain

    const med = sampleMedium(world, this);
    this.medium = med;
    const inWater = med.water > 0.05, inLava = med.lava > 0;
    const fluid = inWater || inLava;

    if (inp.flyToggle && (this.creative || this.game.canFly())) { this.flying = !this.flying; this.vy = 0; }
    if (this.flying && this.onGround && !this.creative && !this.game.canFly()) this.flying = false;

    // sneaking shrinks the box a little and slows you
    this.sneaking = inp.sneak && !this.flying;
    const targetEye = this.sneaking ? EYE_SNEAK : EYE;
    this.eyeH = lerp(this.eyeH, targetEye, Math.min(1, dt * 14));
    const wantH = this.sneaking ? 1.5 : 1.8;
    if (wantH > this.h && boxBlocked(world, this.x, this.y, this.z, this.hw, wantH)) { /* stay crouched under low ceilings */ } else this.h = wantH;

    // sprint
    if (inp.sprint && inp.fwd > 0 && !this.sneaking && (this.hunger > 6 || this.creative)) this.sprinting = true;
    if (inp.fwd <= 0 || this.sneaking || this.hitX || this.hitZ || (this.hunger <= 6 && !this.creative)) this.sprinting = false;

    // wish direction (world space). yaw 0 looks to -Z.
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * inp.fwd + cos * inp.strafe;
    let wz = -cos * inp.fwd - sin * inp.strafe;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    const groundId = this.onGround ? this.groundUnder() : 0;
    const gdef = BLOCKS[groundId];
    const slippery = gdef.friction > 0.9;

    if (this.flying) {
      const sp = (this.sprinting || inp.sprint) ? FLY_SPRINT : FLY;
      const k = Math.min(1, dt * 10);
      this.vx += (wx * sp - this.vx) * k;
      this.vz += (wz * sp - this.vz) * k;
      const vyT = (inp.jump ? 1 : 0) * sp * 0.75 - (inp.sneak ? 1 : 0) * sp * 0.75;
      this.vy += (vyT - this.vy) * k;
      this.gliding = false;
    } else if (this.grapple) {
      this.updateGrapple(dt, inp, wx, wz);
    } else if (fluid) {
      const sp = inLava ? SWIM * 0.5 : (this.sprinting ? SWIM * 1.7 : SWIM);
      const k = Math.min(1, dt * 6);
      // swimming toward where you look while sprinting
      if (this.sprinting && med.eyeWater) {
        const cp = Math.cos(this.pitch);
        this.vx += (-sin * cp * sp - this.vx) * k;
        this.vz += (-cos * cp * sp - this.vz) * k;
        this.vy += (Math.sin(this.pitch) * sp - this.vy) * k;
      } else {
        this.vx += (wx * sp - this.vx) * k;
        this.vz += (wz * sp - this.vz) * k;
        this.vy -= (inLava ? 6 : 9) * dt;
        if (inp.jump) this.vy += (inLava ? 14 : 22) * dt;
        if (inp.sneak) this.vy -= 10 * dt;
        this.vy *= Math.pow(inLava ? 0.1 : 0.2, dt);
        this.vy = clamp(this.vy, -4.5, med.water > 0.4 ? 4 : 6.5);
        // hop out of the water onto a ledge
        if (inp.jump && (this.hitX || this.hitZ) && med.water < 0.8) this.vy = 6.2;
      }
      this.gliding = false;
    } else {
      // walking / falling
      let sp = this.sprinting ? SPRINT : this.sneaking ? SNEAK : WALK;
      sp *= med.speed;
      if (gdef.speed < 1 && this.onGround) sp *= gdef.speed;
      const accel = this.onGround ? (slippery ? 2.2 : 20) : (this.gliding ? 1.4 : 5.5);
      const k = Math.min(1, dt * accel);
      this.vx += (wx * sp - this.vx) * k;
      this.vz += (wz * sp - this.vz) * k;
      // climbing
      if (med.climb) {
        this.vy = Math.max(this.vy, -2.4);
        if (inp.jump || ((this.hitX || this.hitZ) && inp.fwd > 0)) this.vy = 3.2;
        else if (this.sneaking) this.vy = Math.max(0, this.vy);
        this.fallStart = null;
      }
      // gliding
      const hasGlider = this.game.hasGlider();
      if (!this.onGround && !med.climb && hasGlider && inp.jump && this.vy < -1) this.gliding = true;
      if (this.onGround || !inp.jump || !hasGlider || med.climb) this.gliding = false;
      if (this.gliding) {
        const lift = this.game.updraftAt ? this.game.updraftAt(this.x, this.y, this.z) : 0;
        const cp = Math.cos(this.pitch);
        const gsp = 9 + Math.max(0, -this.pitch) * 9;
        this.vx += (-sin * cp * gsp - this.vx) * Math.min(1, dt * 1.6);
        this.vz += (-cos * cp * gsp - this.vz) * Math.min(1, dt * 1.6);
        const sink = -1.8 + Math.min(0, this.pitch) * 5 + Math.max(0, this.pitch) * 1.5;
        this.vy += (sink + lift * 9 - this.vy) * Math.min(1, dt * (lift > 0 ? 2.5 : 3));
        this.fallStart = this.y;
      } else {
        this.vy -= GRAVITY * dt;
        if (this.vy < -TERMINAL) this.vy = -TERMINAL;
        // air drag
        this.vy *= Math.pow(0.98, dt * 20);
      }
      if (inp.jump && this.onGround && !med.climb) {
        this.vy = JUMP_V;
        if (this.sprinting) { this.vx += -sin * 1.8; this.vz += -cos * 1.8; }
        this.exhaust(this.sprinting ? 0.2 : 0.05);
        this.game.audio && this.game.audio.step(groundId, 0.6);
      }
      // updraft from fans/campfires without a glider is a gentle push
      if (!this.gliding && this.game.updraftAt) {
        const lift = this.game.updraftAt(this.x, this.y, this.z);
        if (lift > 0) { this.vy += lift * 40 * dt; this.fallStart = null; }
      }
    }

    // external knockback
    this.vx += this.knock[0]; this.vy += this.knock[1]; this.vz += this.knock[2];
    this.knock[0] = this.knock[1] = this.knock[2] = 0;
    // conveyor belts carry you
    if (this.onGround && this.game.conveyorPush) {
      const p = this.game.conveyorPush(this);
      if (p) { this.extra = p; }
    }

    let dx = this.vx * dt, dy = this.vy * dt, dz = this.vz * dt;
    if (this.extra) { dx += this.extra[0] * dt; dz += this.extra[1] * dt; this.extra = null; }

    // sneaking keeps you on the ledge
    if (this.sneaking && this.onGround && !this.flying) {
      const step = 0.05;
      while (dx !== 0 && !this.groundBelow(this.x + dx, this.z)) {
        if (Math.abs(dx) < step) { dx = 0; break; }
        dx -= Math.sign(dx) * step;
      }
      while (dz !== 0 && !this.groundBelow(this.x + dx, this.z + dz)) {
        if (Math.abs(dz) < step) { dz = 0; break; }
        dz -= Math.sign(dz) * step;
      }
    }

    const wasGround = this.onGround;
    const ox = this.x, oy = this.y, oz = this.z;
    const vyBefore = this.vy;
    moveAndCollide(world, this, dx, dy, dz);
    // Step up onto slabs, stairs and low ledges while walking. Not while rising: a jump clears
    // the obstacle by itself, and the probe below would otherwise interfere with it.
    if ((this.hitX || this.hitZ) && (wasGround || this.onGround || fluid) && !this.flying && dy <= 0) {
      // keep the plain move's full collision result so a failed probe can be undone exactly
      const sx = this.x, sy = this.y, sz = this.z, sg = this.onGround, shx = this.hitX, shy = this.hitY, shz = this.hitZ, sgid = this.groundId;
      this.x = ox; this.y = oy; this.z = oz;
      const up = moveAndCollide(world, this, 0, STEP + (fluid ? 0.1 : 0), 0)[1];
      moveAndCollide(world, this, dx, 0, dz);
      moveAndCollide(world, this, 0, -up - 0.01, 0);
      const moved = Math.hypot(this.x - ox, this.z - oz), movedA = Math.hypot(sx - ox, sz - oz);
      if (moved <= movedA + 1e-4 || !this.onGround) {
        // the step did not help: restore everything, including hitY — the probe's landing sets
        // it, and a stale hitY zeroes vy below (that killed every jump made against a wall)
        this.x = sx; this.y = sy; this.z = sz;
        this.onGround = sg; this.hitX = shx; this.hitY = shy; this.hitZ = shz; this.groundId = sgid;
      } else {
        this.stepSmooth = (this.stepSmooth || 0) + (this.y - oy);
      }
    }
    if (this.hitX) this.vx = 0;
    if (this.hitZ) this.vz = 0;
    if (this.hitY) {
      // bounce gel
      const bid = this.onGround ? this.groundUnder() : 0;
      if (this.onGround && BLOCKS[bid].bounce && !this.sneaking && vyBefore < -3) {
        this.vy = -vyBefore * BLOCKS[bid].bounce;
        this.onGround = false;
        this.fallStart = null;
        this.game.audio && this.game.audio.play('boing', { x: this.x, y: this.y, z: this.z, pitch: 0.8 + Math.min(1, -vyBefore / 30) });
      } else this.vy = 0;
    }

    // fall damage
    if (!this.onGround && !fluid && !med.climb && !this.flying && !this.gliding) {
      if (this.fallStart === null || this.y > this.fallStart) this.fallStart = this.y;
    }
    if (this.onGround || fluid || med.climb || this.flying) {
      if (this.fallStart !== null && this.onGround && !fluid) {
        const dist = this.fallStart - this.y;
        if (dist > 1.2) this.landShake = Math.min(1, dist / 12);
        if (dist > 3.4 && !this.creative && !med.soft) {
          let dmg = Math.floor(dist - 3);
          if (this.game.inventoryHas && this.game.inventoryHas('feather_charm')) dmg = Math.floor(dmg / 2);
          if (BLOCKS[this.groundUnder()].softLanding || BLOCKS[this.groundUnder()].name === 'cloud_block') dmg = 0;
          if (dmg > 0) this.damage(dmg, 'fall');
        }
        if (dist > 0.8) this.game.audio && this.game.audio.step(this.groundUnder(), Math.min(1, 0.4 + dist / 8));
      }
      this.fallStart = null;
    }

    // footsteps and view bob
    const hs = Math.hypot(this.x - ox, this.z - oz);
    if (this.onGround && !this.flying) {
      this.stepDist += hs;
      if (this.stepDist > (this.sprinting ? 2.1 : 1.7)) {
        this.stepDist = 0;
        if (!this.sneaking) this.game.audio && this.game.audio.step(this.groundUnder(), this.sprinting ? 0.5 : 0.35);
      }
      this.bob += hs * 2.2;
      this.bobAmt = lerp(this.bobAmt, Math.min(1, hs / dt / SPRINT), Math.min(1, dt * 10));
      if (!this.sprinting) this.exhaust(hs * 0.01); else this.exhaust(hs * 0.1);
    } else this.bobAmt = lerp(this.bobAmt, 0, Math.min(1, dt * 6));

    // environment damage / air
    if (!this.creative) {
      if (med.eyeWater) {
        this.air -= dt * 20;
        if (this.air <= 0) { this.air = 0; this.drownT = (this.drownT || 0) + dt; if (this.drownT > 1) { this.drownT = 0; this.damage(2, 'drown'); } }
      } else this.air = Math.min(this.maxAir, this.air + dt * 100);
      if (inLava) { this.fireTime = 8; this.lavaT = (this.lavaT || 0) + dt; if (this.lavaT > 0.5) { this.lavaT = 0; this.damage(4, 'lava'); } }
      if (this.fireTime > 0) {
        this.fireTime -= dt;
        if (inWater || (this.game.weather && this.game.weather.isRainingAt(this.x, this.y, this.z))) this.fireTime = 0;
        this.burnT = (this.burnT || 0) + dt;
        if (this.burnT > 1) { this.burnT = 0; this.damage(1, 'fire'); }
      }
      const cd = contactDamage(world, this);
      if (cd) { this.cdT = (this.cdT || 0) + dt; if (this.cdT > 0.5) { this.cdT = 0; this.damage(cd, 'contact'); } }
      if (this.y < -40) { this.damage(4, 'void'); }
    } else if (this.y < -60) { this.y = 120; this.vy = 0; }

    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.landShake = Math.max(0, this.landShake - dt * 3);
    this.updateVitals(dt);
    // camera roll while gliding banks into turns
    const targetRoll = this.gliding ? clamp((this.turnRate || 0) * -0.05, -0.35, 0.35) : 0;
    this.camRoll = lerp(this.camRoll, targetRoll, Math.min(1, dt * 4));
  }

  updateGrapple(dt, inp, wx, wz) {
    const g = this.grapple;
    const ex = this.x, ey = this.y + 1.0, ez = this.z;
    let dx = g.x - ex, dy = g.y - ey, dz = g.z - ez;
    const d = Math.hypot(dx, dy, dz) || 1;
    dx /= d; dy /= d; dz /= d;
    // reel in, but let gravity swing you
    const reel = inp.sneak ? 0 : 1;
    if (d > 1.6 && reel) {
      const pull = 34;
      this.vx += dx * pull * dt; this.vy += dy * pull * dt; this.vz += dz * pull * dt;
    }
    this.vy -= GRAVITY * 0.55 * dt;
    this.vx += wx * 6 * dt; this.vz += wz * 6 * dt;
    // rope constraint (no stretching beyond current length)
    const sp = Math.hypot(this.vx, this.vy, this.vz);
    const maxSp = 22;
    if (sp > maxSp) { this.vx *= maxSp / sp; this.vy *= maxSp / sp; this.vz *= maxSp / sp; }
    const radial = this.vx * dx + this.vy * dy + this.vz * dz;
    if (d >= g.len && radial < 0) { this.vx -= radial * dx; this.vy -= radial * dy; this.vz -= radial * dz; }
    g.len = Math.min(g.len, d);
    if (inp.jumpPressed) { this.game.releaseGrapple(); this.vy += 6; }
    if (d < 1.3) { this.vx *= 0.6; this.vy *= 0.6; this.vz *= 0.6; }
    this.fallStart = null;
  }

  groundUnder() {
    const w = this.game.world;
    const y = Math.floor(this.y - 0.08);
    // check the four corners for the block we stand on
    for (const [ox, oz] of [[0, 0], [-this.hw, -this.hw], [this.hw, -this.hw], [-this.hw, this.hw], [this.hw, this.hw]]) {
      const id = w.getBlock(Math.floor(this.x + ox), y, Math.floor(this.z + oz)) & ID_MASK;
      if (id && BLOCKS[id].solid) return id;
    }
    return w.getBlock(Math.floor(this.x), y, Math.floor(this.z)) & ID_MASK;
  }

  groundBelow(x, z) {
    return boxBlocked(this.game.world, x, this.y - 0.6, z, this.hw, 0.59);
  }

  exhaust(v) {
    if (this.creative) return;
    this.exhaustion += v;
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
  }

  updateVitals(dt) {
    if (this.creative) { this.health = this.maxHealth; this.hunger = 20; return; }
    const peaceful = this.game.settings && this.game.settings.difficulty === 0;
    this.regenTimer += dt;
    const fed = !!this.effects.fed;
    if (this.hunger >= (fed ? 14 : 18) && this.health < this.maxHealth && this.regenTimer > (this.saturation > 0 ? 0.6 : fed ? 2 : 4)) {
      this.regenTimer = 0;
      this.health = Math.min(this.maxHealth, this.health + 1);
      this.exhaust(3);
    } else if (peaceful && this.health < this.maxHealth && this.regenTimer > 2) {
      this.regenTimer = 0; this.health += 1;
    }
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer > 4) { this.starveTimer = 0; if (this.health > (peaceful ? 10 : 1)) this.damage(1, 'starve'); }
    }
  }

  damage(amount, cause = 'generic', src = null) {
    if (this.dead || this.creative) return false;
    if (this.invuln > 0 && cause !== 'void' && cause !== 'drown' && cause !== 'starve') return false;
    let a = amount;
    if (cause !== 'void' && cause !== 'starve' && cause !== 'drown' && this.game.armorPoints) {
      const pts = this.game.armorPoints();
      a = a * (1 - Math.min(0.8, pts * 0.04));
      if (pts && this.game.damageArmor) this.game.damageArmor(1);
    }
    this.health -= a;
    this.hurtTime = 0.4;
    this.invuln = 0.5;
    if (src) {
      const dx = this.x - src.x, dz = this.z - src.z, d = Math.hypot(dx, dz) || 1;
      this.knock[0] += dx / d * 6; this.knock[1] += 4; this.knock[2] += dz / d * 6;
    }
    this.exhaust(0.3);
    this.game.onPlayerHurt && this.game.onPlayerHurt(a, cause);
    if (this.health <= 0) { this.health = 0; this.dead = true; this.game.onPlayerDeath && this.game.onPlayerDeath(cause, src); }
    return true;
  }

  heal(n) { this.health = Math.min(this.maxHealth, this.health + n); }
  eat(food) {
    this.hunger = Math.min(20, this.hunger + food.hunger);
    this.saturation = Math.min(this.hunger, this.saturation + food.sat);
  }
}
