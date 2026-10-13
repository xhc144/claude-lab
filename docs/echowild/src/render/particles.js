// CPU particles: block chips, smoke, flames, sparks, bubbles, petals, fireflies, explosions.

import { BLOCKS, ID_MASK, LIQUID } from '../world/blocks.js';

const MAX = 6000;

export class Particles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.glow = [];
    this.pool = [];
  }

  add(o) {
    if (this.list.length + this.glow.length > MAX) return null;
    const p = this.pool.pop() || {};
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.r = o.r ?? 1; p.g = o.g ?? 1; p.b = o.b ?? 1; p.a = o.a ?? 1;
    p.u0 = o.u0 || 0; p.v0 = o.v0 || 0; p.us = o.us || 1; p.layer = o.layer ?? -1;
    p.size = o.size || 0.1; p.em = o.em || 0;
    p.life = o.life || 1; p.age = 0;
    p.grav = o.grav ?? 0; p.drag = o.drag ?? 0.98;
    p.fade = o.fade ?? true; p.shrink = o.shrink || 0; p.collide = o.collide || false;
    p.lit = o.lit ?? true; p.flicker = o.flicker || 0; p.wander = o.wander || 0;
    p.baseA = p.a; p.baseSize = p.size;
    (o.additive ? this.glow : this.list).push(p);
    return p;
  }

  // light multiplier at a position (sky * daylight vs block light)
  lightAt(x, y, z) {
    const g = this.game;
    const l = g.world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
    const sky = (l & 15) / 15 * (g.sky ? 0.25 + 0.75 * g.sky.daylight : 1);
    const bl = Math.max((l >> 4) & 15, (l >> 8) & 15, (l >> 12) & 15) / 15;
    return Math.max(0.12, sky, bl);
  }

  blockChips(x, y, z, v, face, n = 4) {
    const id = v & ID_MASK;
    const d = BLOCKS[id];
    if (!d.faces) return;
    const layer = d.faces[face >= 0 && face < 6 ? face : 2];
    const nx = [1, -1, 0, 0, 0, 0][face] || 0, ny = [0, 0, 1, -1, 0, 0][face] || 0, nz = [0, 0, 0, 0, 1, -1][face] || 0;
    const L = this.lightAt(x + 0.5 + nx * 0.7, y + 0.5 + ny * 0.7, z + 0.5 + nz * 0.7);
    const tint = d.tint ? this.tintFor(d.tint) : [1, 1, 1];
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + 0.5 + nx * 0.52 + (nx ? 0 : Math.random() - 0.5) * 0.9,
        y: y + 0.5 + ny * 0.52 + (ny ? 0 : Math.random() - 0.5) * 0.9,
        z: z + 0.5 + nz * 0.52 + (nz ? 0 : Math.random() - 0.5) * 0.9,
        vx: nx * 1.5 + (Math.random() - 0.5) * 2, vy: ny * 1.5 + Math.random() * 2, vz: nz * 1.5 + (Math.random() - 0.5) * 2,
        layer, u0: Math.floor(Math.random() * 12) / 16, v0: Math.floor(Math.random() * 12) / 16, us: 0.25,
        r: L * tint[0], g: L * tint[1], b: L * tint[2], size: 0.06 + Math.random() * 0.04, life: 0.5 + Math.random() * 0.4, grav: 18, collide: true, fade: false,
      });
    }
  }

  tintFor(t) {
    const g = this.game;
    const p = g.player;
    const c = g.world.chunkAt(Math.floor(p.x), Math.floor(p.z));
    if (!c) return [1, 1, 1];
    const v = c.tints[(t - 1) * 256 + (((Math.floor(p.z) & 15) << 4) | (Math.floor(p.x) & 15))];
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }

  blockBreak(x, y, z, v) {
    const id = v & ID_MASK;
    const d = BLOCKS[id];
    if (!d.faces) return;
    const L = this.lightAt(x + 0.5, y + 0.5, z + 0.5);
    const tint = d.tint ? this.tintFor(d.tint) : [1, 1, 1];
    for (let i = 0; i < 26; i++) {
      const layer = d.faces[i % 6];
      this.add({
        x: x + Math.random(), y: y + Math.random(), z: z + Math.random(),
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4.5, vz: (Math.random() - 0.5) * 4,
        layer, u0: Math.floor(Math.random() * 12) / 16, v0: Math.floor(Math.random() * 12) / 16, us: 0.25,
        r: L * tint[0], g: L * tint[1], b: L * tint[2], size: 0.07 + Math.random() * 0.05, life: 0.6 + Math.random() * 0.6, grav: 20, collide: true, fade: false,
      });
    }
  }

  smoke(x, y, z, n = 1, dark = false) {
    for (let i = 0; i < n; i++) {
      const c = dark ? 0.15 + Math.random() * 0.1 : 0.55 + Math.random() * 0.2;
      this.add({ x: x + (Math.random() - 0.5) * 0.3, y, z: z + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.3, vy: 0.9 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.3, r: c, g: c, b: c, a: 0.55, size: 0.16 + Math.random() * 0.1, life: 2.5 + Math.random() * 2, drag: 0.99, wander: 0.6 });
    }
  }

  flame(x, y, z) {
    this.add({ x: x + (Math.random() - 0.5) * 0.15, y, z: z + (Math.random() - 0.5) * 0.15, vy: 0.4 + Math.random() * 0.3, r: 1, g: 0.65 + Math.random() * 0.25, b: 0.25, a: 0.9, size: 0.05 + Math.random() * 0.04, life: 0.5, em: 1, additive: true, shrink: 1 });
  }

  sparks(x, y, z, n, color = [0.5, 0.95, 1], speed = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.add({ x, y, z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + 1, vz: Math.sin(a) * Math.cos(b) * s, r: color[0], g: color[1], b: color[2], a: 1, size: 0.04 + Math.random() * 0.04, life: 0.5 + Math.random() * 0.7, grav: 6, em: 1, additive: true, shrink: 0.7 });
    }
  }

  bubbles(x, y, z, n = 3) {
    for (let i = 0; i < n; i++) this.add({ x: x + (Math.random() - 0.5) * 0.5, y, z: z + (Math.random() - 0.5) * 0.5, vy: 1.5 + Math.random(), r: 0.75, g: 0.9, b: 1, a: 0.7, size: 0.04 + Math.random() * 0.03, life: 1.2, drag: 0.95, wander: 0.3, water: true });
  }

  splash(x, y, z, n = 14) {
    for (let i = 0; i < n; i++) this.add({ x: x + (Math.random() - 0.5), y, z: z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, r: 0.75, g: 0.88, b: 1, a: 0.8, size: 0.05, life: 0.6, grav: 16 });
  }

  explosion(x, y, z, power = 3) {
    for (let i = 0; i < 40 * power / 3; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = 3 + Math.random() * 7;
      this.add({ x, y, z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + 2, vz: Math.sin(a) * Math.cos(b) * s, r: 1, g: 0.6 + Math.random() * 0.3, b: 0.2, size: 0.15 + Math.random() * 0.2, life: 0.4 + Math.random() * 0.4, em: 1, additive: true, drag: 0.9, shrink: 1 });
    }
    for (let i = 0; i < 30; i++) {
      const c = 0.3 + Math.random() * 0.3;
      this.add({ x: x + (Math.random() - 0.5) * power, y: y + (Math.random() - 0.5) * power, z: z + (Math.random() - 0.5) * power, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 2, r: c, g: c, b: c, a: 0.75, size: 0.5 + Math.random() * 0.6, life: 1.5 + Math.random() * 1.5, drag: 0.96 });
    }
  }

  frame(dt) {
    const w = this.game.world;
    for (const arr of [this.list, this.glow]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.age += dt;
        if (p.age >= p.life) { arr[i] = arr[arr.length - 1]; arr.pop(); this.pool.push(p); continue; }
        p.vy -= p.grav * dt;
        const dr = Math.pow(p.drag, dt * 60);
        p.vx *= dr; p.vy *= dr; p.vz *= dr;
        if (p.wander) { p.vx += (Math.random() - 0.5) * p.wander * dt * 10; p.vz += (Math.random() - 0.5) * p.wander * dt * 10; }
        let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
        if (p.collide) {
          const id = w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)) & ID_MASK;
          if (BLOCKS[id].solid && !LIQUID[id]) {
            if (Math.floor(ny) !== Math.floor(p.y)) { ny = p.y; p.vy *= -0.2; p.vx *= 0.6; p.vz *= 0.6; }
            if (Math.floor(nx) !== Math.floor(p.x)) { nx = p.x; p.vx *= -0.3; }
            if (Math.floor(nz) !== Math.floor(p.z)) { nz = p.z; p.vz *= -0.3; }
          }
        }
        p.x = nx; p.y = ny; p.z = nz;
        const t = p.age / p.life;
        if (p.fade) p.a = p.baseA * (1 - t * t);
        if (p.shrink) p.size = p.baseSize * (1 - t * p.shrink);
        if (p.flicker) p.a = p.baseA * (0.5 + 0.5 * Math.sin(p.age * p.flicker + p.x * 10));
      }
    }
  }

  render(r) {
    if (this.list.length) r.drawParticles(this.list, this.list.length, false);
    if (this.glow.length) r.drawParticles(this.glow, this.glow.length, true);
  }
}
