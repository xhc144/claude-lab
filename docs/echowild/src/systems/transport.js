// Rails (auto-shaping straights, curves and slopes), ridable carts with slope gravity and
// powered-rail boost, and the grappling hook.

import { BLOCKS, B, ID_MASK, ID_BITS, SOLID, pack } from '../world/blocks.js';
import { Entity, ENTITY_TYPES } from '../entity/entities.js';
import { MeshBuilder } from '../render/itemmesh.js';
import { mat4, identity, translate, rotateY, lookDir, angleLerp } from '../core/math.js';
import { I } from '../world/items.js';
import { moveAndCollide } from '../entity/physics.js';

// directions: 0 N(-z) 1 W(-x) 2 S(+z) 3 E(+x)
const DIR = [[0, -1], [-1, 0], [0, 1], [1, 0]];
const OPP = [2, 3, 0, 1];
// exits per rail shape; slopes: 2 asc E, 3 asc W, 4 asc N, 5 asc S
const EXITS = { 0: [0, 2], 1: [1, 3], 2: [3, 1], 3: [1, 3], 4: [0, 2], 5: [2, 0], 6: [2, 3], 7: [2, 1], 8: [0, 1], 9: [0, 3] };
const ASC_DIR = { 2: 3, 3: 1, 4: 0, 5: 2 }; // shape -> direction that goes up
const isRail = (id) => id === B.rail || id === B.power_rail || id === B.speed_rail;

export function installTransport(game) {
  const w = game.world;

  // ---------------------------------------------------------------- rail shaping
  function railAt(x, y, z) { return isRail(w.getId(x, y, z)); }
  function connections(x, y, z) {
    const out = [];
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIR[d];
      if (railAt(x + dx, y, z + dz)) out.push([d, 0]);
      else if (railAt(x + dx, y + 1, z + dz)) out.push([d, 1]);
      else if (railAt(x + dx, y - 1, z + dz)) out.push([d, -1]);
    }
    return out;
  }
  function shapeFor(x, y, z, straightOnly) {
    const c = connections(x, y, z);
    const up = c.find(([, dy]) => dy === 1);
    if (up) return { 3: 2, 1: 3, 0: 4, 2: 5 }[up[0]];
    const ds = c.map(([d]) => d);
    const has = (d) => ds.includes(d);
    if (has(0) && has(2)) return 0;
    if (has(1) && has(3)) return 1;
    if (!straightOnly) {
      if (has(2) && has(3)) return 6;
      if (has(2) && has(1)) return 7;
      if (has(0) && has(1)) return 8;
      if (has(0) && has(3)) return 9;
    }
    if (has(0) || has(2)) return 0;
    if (has(1) || has(3)) return 1;
    return null;
  }
  function reshape(x, y, z) {
    const v = w.getBlock(x, y, z), id = v & ID_MASK;
    if (!isRail(id)) return;
    const m = v >>> ID_BITS;
    const s = shapeFor(x, y, z, id !== B.rail);
    if (s === null || s === (m & 15)) return;
    w.setBlock(x, y, z, pack(id, (m & 16) | s), { notify: false });
  }
  const linkedTo = (x, y, z, tx, tz) => {
    const v = w.getBlock(x, y, z), m = (v >>> ID_BITS) & 15;
    return (EXITS[m] || []).some((d) => x + DIR[d][0] === tx && z + DIR[d][1] === tz);
  };
  for (const id of [B.rail, B.power_rail]) {
    w.handlers.place[id] = (world, x, y, z) => {
      reshape(x, y, z);
      // bend neighbours that are still loose ends toward the new rail
      for (const [d, dy] of connections(x, y, z)) {
        const nx = x + DIR[d][0], ny = y + dy, nz = z + DIR[d][1];
        const linked = (EXITS[(w.getMeta(nx, ny, nz)) & 15] || []).filter((e) => railAt(nx + DIR[e][0], ny, nz + DIR[e][1]) || railAt(nx + DIR[e][0], ny + 1, nz + DIR[e][1]) || railAt(nx + DIR[e][0], ny - 1, nz + DIR[e][1]));
        if (linked.length < 2 && !linkedTo(nx, ny, nz, x, z)) reshape(nx, ny, nz);
      }
    };
  }
  // powered rails follow the signal
  game.circuits.device(B.power_rail, 16, (x, y, z, v, p, was, m) => w.setBlock(x, y, z, pack(B.power_rail, p ? m | 16 : m & ~16), { notify: false }));

  // ---------------------------------------------------------------- carts
  class Cart extends Entity {
    constructor() { super('cart'); this.hw = 0.45; this.h = 0.7; this.speed = 0; this.dir = 0; this.rider = null; this.persist = true; this.health = 6; }
    hurt(game2, amount, cause) {
      if (cause !== 'player') return false;
      this.health -= amount;
      if (this.health <= 0) { this.dead = true; if (this.rider) this.dismount(); game.entities.spawnItem(this.x, this.y + 0.3, this.z, { id: I.cart, n: 1 }); }
      return true;
    }
    interact(g) {
      if (this.rider) return false;
      const p = g.player;
      p.riding = this; this.rider = p;
      g.hud.message('乘上了矿车：W 加速，空格或潜行下车');
      return true;
    }
    dismount() {
      const p = this.rider;
      if (!p) return;
      p.riding = null; this.rider = null;
      p.x = this.x; p.y = this.y + 0.8; p.z = this.z; p.vx = p.vy = p.vz = 0;
    }
    carry(p, inp, dt) {
      p.x = this.x; p.y = this.y + 0.35; p.z = this.z;
      p.prev.x = this.px; p.prev.y = this.py + 0.35; p.prev.z = this.pz;
      p.vx = p.vy = p.vz = 0; p.onGround = true;
      if (inp.jumpPressed || inp.sneak) { this.dismount(); p.vy = 4; return; }
      if (inp.fwd) {
        const [lx, , lz] = lookDir(p.yaw, 0);
        const [dx, dz] = DIR[this.dir];
        const along = lx * dx + lz * dz;
        this.speed += along * inp.fwd * 2.5 * dt;
      }
    }
    tick(g, dt) {
      this.age += dt;
      const x = Math.floor(this.x), z = Math.floor(this.z);
      let y = Math.floor(this.y + 0.05);
      let v = w.getBlock(x, y, z);
      if (!isRail(v & ID_MASK)) { const vb = w.getBlock(x, y - 1, z); if (isRail(vb & ID_MASK)) { y -= 1; v = vb; } }
      if (!isRail(v & ID_MASK)) {
        // off the rails: ordinary physics
        this.vy -= 24 * dt;
        this.vx = Math.cos(this.dir) * 0; this.vz = 0;
        moveAndCollide(w, this, DIR[this.dir][0] * this.speed * dt, this.vy * dt, DIR[this.dir][1] * this.speed * dt);
        if (this.onGround) { this.vy = 0; this.speed *= 0.8; }
        return;
      }
      const m = v >>> ID_BITS, shape = m & 15, id = v & ID_MASK;
      const ex = EXITS[shape] || [0, 2];
      // align direction with the rail
      if (!ex.includes(this.dir) && !ex.includes(OPP[this.dir])) this.dir = ex[0];
      // slope gravity
      if (ASC_DIR[shape] !== undefined) this.speed += (this.dir === ASC_DIR[shape] ? -1 : 1) * 9 * dt * Math.sign(this.speed || 1);
      if (shape >= 2 && shape <= 5 && Math.abs(this.speed) < 0.5) { this.dir = OPP[ASC_DIR[shape]]; this.speed = 1; }
      // powered rails
      if (id === B.power_rail) {
        if (m & 16) {
          if (Math.abs(this.speed) < 0.3) {
            // kick away from a wall
            const [a, b] = ex;
            this.dir = SOLID[w.getId(x + DIR[a][0], y, z + DIR[a][1])] ? b : a;
            this.speed = 1;
          }
          this.speed = Math.sign(this.speed) * Math.min(11, Math.abs(this.speed) + 14 * dt);
        } else this.speed *= Math.pow(0.02, dt);
      }
      this.speed *= Math.pow(0.82, dt);
      if (this.speed < 0) { this.speed = -this.speed; this.dir = OPP[this.dir]; }
      if (this.speed > 12) this.speed = 12;
      // move in small steps, turning at curve centres
      let dist = this.speed * dt;
      let cx = x, cy = y, cz = z;
      let guard = 0;
      while (dist > 1e-4 && guard++ < 24) {
        const cm = (w.getBlock(cx, cy, cz) >>> ID_BITS) & 15;
        const exits = EXITS[cm] || [0, 2];
        const entry = OPP[this.dir];
        const out = exits[0] === entry ? exits[1] : exits[1] === entry ? exits[0] : (exits.includes(this.dir) ? this.dir : exits[0]);
        let [dx, dz] = DIR[this.dir];
        let along = dx * (this.x - cx - 0.5) + dz * (this.z - cz - 0.5);
        if (out !== this.dir) {
          // a curve: roll to the centre, then turn
          if (along < -1e-6) {
            const st = Math.min(dist, -along);
            this.x += dx * st; this.z += dz * st; dist -= st;
            if (dx === 0) this.x = cx + 0.5; else this.z = cz + 0.5;
            if (st < -along - 1e-6) break;
          }
          this.x = cx + 0.5; this.z = cz + 0.5;
          this.dir = out; [dx, dz] = DIR[out]; along = 0;
        }
        const toEdge = 0.5 - along;
        const st = Math.min(dist, toEdge);
        this.x += dx * st; this.z += dz * st; dist -= st;
        if (dx === 0) this.x = cx + 0.5; else this.z = cz + 0.5;
        const asc = ASC_DIR[cm];
        const ofs = asc !== undefined ? DIR[asc][0] * (this.x - cx - 0.5) + DIR[asc][1] * (this.z - cz - 0.5) + 0.5 : 0;
        this.y = cy + 0.07 + Math.max(0, Math.min(1, ofs));
        if (st >= toEdge - 1e-6) {
          const nx = cx + dx, nz = cz + dz;
          const ny = cy + (asc === this.dir ? 1 : 0);
          if (railAt(nx, ny, nz)) { cx = nx; cy = ny; cz = nz; }
          else if (railAt(nx, ny - 1, nz)) { cx = nx; cy = ny - 1; cz = nz; }
          else { this.speed = 0; this.x -= dx * 0.05; this.z -= dz * 0.05; break; }
        }
      }
      this.yaw = angleLerp(this.yaw, Math.atan2(-DIR[this.dir][0], -DIR[this.dir][1]), 0.4);
      // bump mobs
      for (const e of g.entities.near(this.x, this.y, this.z, 0.9)) if (e !== this && e.type === 'mob' && this.speed > 2) { e.vx += DIR[this.dir][0] * 6; e.vz += DIR[this.dir][1] * 6; e.vy += 3; if (this.speed > 6) e.hurt(g, 4, 'cart'); }
      if (this.speed > 3 && g.audio && Math.random() < 0.2) g.audio.play('click', { x: this.x, y: this.y, z: this.z, pitch: 0.5 });
    }
    render(g, r, a) {
      if (!this.mesh) {
        const mb = new MeshBuilder();
        const c1 = [0.55, 0.58, 0.63, 1], c2 = [0.36, 0.38, 0.43, 1], wood = [0.55, 0.4, 0.25, 1];
        mb.box(-0.45, 0.12, -0.6, 0.45, 0.2, 0.6, c2);
        mb.box(-0.45, 0.2, -0.6, -0.38, 0.62, 0.6, c1); mb.box(0.38, 0.2, -0.6, 0.45, 0.62, 0.6, c1);
        mb.box(-0.38, 0.2, -0.6, 0.38, 0.62, -0.53, c1); mb.box(-0.38, 0.2, 0.53, 0.38, 0.62, 0.6, c1);
        mb.box(-0.38, 0.2, -0.53, 0.38, 0.24, 0.53, wood);
        for (const zz of [-0.4, 0.4]) for (const xx of [-0.47, 0.47]) mb.box(xx - 0.04, 0, zz - 0.12, xx + 0.04, 0.2, zz + 0.12, [0.15, 0.15, 0.18, 1]);
        mb.box(-0.47, 0.6, -0.62, 0.47, 0.66, -0.56, [0.89, 0.75, 0.43, 1]);
        this.mesh = mb.build(r);
      }
      const [x, y, z] = this.lerpPos(a);
      const M = this.model || (this.model = mat4());
      identity(M); translate(M, M, x, y, z); rotateY(M, M, this.yaw);
      r.drawMesh(this.mesh, M, this.lightAt(g, x, y + 0.5, z));
    }
    dispose(r) { if (this.mesh) r.deleteMesh(this.mesh); }
    serialize() { return { type: 'cart', x: this.x, y: this.y, z: this.z, dir: this.dir }; }
  }
  ENTITY_TYPES.cart = (o) => { const c = new Cart(); c.setPos(o.x, o.y, o.z); c.dir = o.dir || 0; return c; };

  // ---------------------------------------------------------------- items: cart, grapple
  const prev = game.useSpecialItem;
  game.useSpecialItem = (held, def, hit, fresh) => {
    if (def.use === 'cart') {
      if (!fresh || !hit || !isRail(hit.v & ID_MASK)) return false;
      const c = new Cart();
      c.setPos(hit.x + 0.5, hit.y + 0.07, hit.z + 0.5);
      const shape = (hit.v >>> ID_BITS) & 15;
      c.dir = (EXITS[shape] || [0])[0];
      game.entities.add(c);
      if (!game.player.creative) game.inventory.consumeHeld(1);
      return true;
    }
    if (def.use === 'grapple') {
      if (!fresh) return true;
      const p = game.player;
      if (p.grapple) { p.grapple = null; return true; }
      const d = lookDir(p.yaw, p.pitch);
      const h = w.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], 32, (v) => SOLID[v & ID_MASK] === 1 && !BLOCKS[v & ID_MASK].liquid);
      game.audio && game.audio.play('grapple');
      if (!h) return true;
      p.grapple = { x: h.px - d[0] * 0.05, y: h.py - d[1] * 0.05, z: h.pz - d[2] * 0.05, len: h.dist + 0.5 };
      game.audio && game.audio.play('grapple_hit', { x: h.px, y: h.py, z: h.pz });
      game.inventory.damageHeld(1);
      return true;
    }
    return prev ? prev(held, def, hit, fresh) : false;
  };
  // rope rendering and auto-release
  const buf = new Float32Array(7 * 40);
  game.addSystem({
    frame(g) {
      const p = g.player;
      if (p.grapple) {
        const held = g.inventory.held();
        if (!held || held.id !== I.grapple || p.dead) p.grapple = null;
      }
    },
    renderTranslucent(g, r) {
      const p = g.player, gr = p.grapple;
      if (!gr) return;
      const d = lookDir(p.yaw, p.pitch);
      const sx = p.x + d[0] * 0.4 + Math.cos(p.yaw) * 0.3, sy = p.eyeY - 0.35, sz = p.z + d[2] * 0.4 - Math.sin(p.yaw) * 0.3;
      let n = 0;
      for (let i = 0; i < 16; i++) {
        for (const t of [i / 16, (i + 1) / 16]) {
          buf.set([sx + (gr.x - sx) * t, sy + (gr.y - sy) * t - Math.sin(t * Math.PI) * 0.05, sz + (gr.z - sz) * t, 0.85, 0.78, 0.62, 1], n * 7); n++;
        }
      }
      r.drawLines(buf, n);
    },
  });
}
