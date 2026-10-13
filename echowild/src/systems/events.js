// World events and ambience: meteor showers (shooting stars, meteors that land and leave a
// crater with star iron), aurora on cold nights, fireflies, deep-cave spores.

import { Entity } from '../entity/entities.js';
import { MeshBuilder } from '../render/itemmesh.js';
import { mat4, identity, translate, rotateY, rotateX, scale } from '../core/math.js';
import { B, ID_MASK, SOLID, LIQUID, BLOCKS } from '../world/blocks.js';
import { BIOMES } from '../world/biomes.js';

const rr = (a, b) => a + Math.random() * (b - a);
const DIR8 = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
export function compassDir(dx, dz) {
  const a = Math.atan2(dx, -dz); // 0 = north (-Z), clockwise
  return DIR8[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

class Meteor extends Entity {
  constructor(target) {
    super('meteor');
    this.persist = false;
    this.target = target;
    this.hw = 0.4; this.h = 0.8;
  }
  tick(game, dt) {
    this.age += dt;
    const t = this.target;
    const dx = t.x - this.x, dy = t.y - this.y, dz = t.z - this.z;
    const d = Math.hypot(dx, dy, dz);
    const sp = 55;
    if (d < sp * dt + 0.5 || this.age > 15) { this.impact(game); return; }
    this.x += dx / d * sp * dt; this.y += dy / d * sp * dt; this.z += dz / d * sp * dt;
    const id = game.world.getId(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    if (SOLID[id] && game.world.isLoaded(Math.floor(this.x), Math.floor(this.z))) { this.target = { x: this.x, y: this.y, z: this.z }; this.impact(game); return; }
    if (game.particles) {
      for (let i = 0; i < 3; i++) game.particles.add({ x: this.x + rr(-0.3, 0.3), y: this.y + rr(-0.3, 0.3), z: this.z + rr(-0.3, 0.3), vx: rr(-1, 1), vy: rr(-0.5, 1), vz: rr(-1, 1), r: 1, g: rr(0.5, 0.85), b: 0.3, size: rr(0.25, 0.5), life: rr(0.4, 0.9), em: 1, additive: true, shrink: 1 });
      game.particles.add({ x: this.x, y: this.y, z: this.z, vy: 0.5, r: 0.3, g: 0.28, b: 0.3, a: 0.5, size: 0.7, life: 3, drag: 0.97 });
    }
  }
  impact(game) {
    this.dead = true;
    const w = game.world;
    const x = Math.floor(this.target.x), y = Math.floor(this.target.y), z = Math.floor(this.target.z);
    game.explode(x + 0.5, y + 0.5, z + 0.5, 4, { noDrops: true });
    game.audio && game.audio.play('impact', { x, y, z, volume: 1.5 });
    // crater floor: a shell of meteor rock around a glowing star core with star iron
    const R = 3;
    for (let dy = -R; dy <= 1; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy * 1.3, dz);
      const cx = x + dx, cy = y - 2 + dy, cz = z + dz;
      if (d > R + 0.3) continue;
      const cur = w.getId(cx, cy, cz);
      if (cur === B.bedrock) continue;
      if (d < 1) w.setBlock(cx, cy, cz, B.star_core);
      else if (d < 2.1 && Math.random() < 0.55) w.setBlock(cx, cy, cz, B.meteor_ore);
      else if (cur && SOLID[cur]) w.setBlock(cx, cy, cz, Math.random() < 0.12 ? B.magma : B.meteor_rock);
    }
    // scorched rim
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2, d = rr(3, 6);
      const fx = Math.floor(x + Math.cos(a) * d), fz = Math.floor(z + Math.sin(a) * d);
      const fy = w.surfaceY(fx, fz);
      if (fy > 0 && !w.getId(fx, fy + 1, fz) && Math.random() < 0.5) w.setBlock(fx, fy + 1, fz, B.fire);
    }
    game.emit('meteorLanded', x, y, z);
  }
  render(game, r, a) {
    if (!this.mesh) { const mb = new MeshBuilder(); mb.box(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, [1, 0.75, 0.45, 1]); mb.box(-0.35, -0.35, -0.35, 0.35, 0.35, 0.35, [1, 0.95, 0.8, 1]); this.mesh = mb.build(r); }
    const [x, y, z] = this.lerpPos(a);
    const M = this.model || (this.model = mat4());
    identity(M); translate(M, M, x, y, z); rotateY(M, M, game.time * 5); rotateX(M, M, game.time * 3); scale(M, M, 1.2, 1.2, 1.2);
    r.drawMesh(this.mesh, M, [1, 1, 1, 1], null, 1);
  }
  dispose(r) { if (this.mesh) r.deleteMesh(this.mesh); }
}

export function installEvents(game, state) {
  const w = game.world;
  const ev = {
    showerNight: state && state.events ? state.events.showerNight : 0,
    landed: state && state.events ? state.events.landed || 0 : 0,
    streaks: [],
    aurora: 0,
    auroraNight: 0,
    nextLanding: rr(20, 60),
    fireflies: 0,
  };
  game.events = ev;
  game.stateSavers.push((s) => { s.events = { showerNight: ev.showerNight, landed: ev.landed }; });

  const isNight = () => game.dayTime > 13000 && game.dayTime < 23000;
  ev.meteorShower = (force = false) => {
    if (force) { ev.showerNight = game.day; if (!isNight()) game.setTime(14000); }
    game.hud.toast('流星雨', '夜空中划过无数流星……也许会有一颗落在附近。', 'discover', 5000);
    game.audio && game.audio.play('discover');
    ev.nextLanding = force ? 6 : rr(15, 50);
  };
  game.on('newDay', (day) => {
    if (day >= 2 && Math.random() < 0.2) ev.showerNight = day;
    ev.auroraNight = Math.random() < 0.15 ? day : ev.auroraNight;
  });

  game.auroraLevel = () => ev.aurora;
  game.addSystem({
    tick(g) {
      const night = isNight();
      // dusk announcement of a shower
      if (ev.showerNight === g.day && g.dayTime === 13000) ev.meteorShower(false);
      const shower = night && ev.showerNight === g.day;
      if (shower) {
        ev.nextLanding -= 0.05;
        if (ev.nextLanding <= 0) {
          ev.nextLanding = rr(60, 160);
          spawnMeteor(g);
        }
      }
    },
    frame(g, dt) {
      const p = g.player;
      const night = g.sky && g.sky.daylight < 0.25;
      // shooting stars
      const shower = isNight() && ev.showerNight === g.day;
      const rate = shower ? 3 : night ? 0.04 : 0;
      if (Math.random() < rate * dt) {
        const a = Math.random() * Math.PI * 2, el = rr(0.35, 1.2);
        const dir = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
        const da = rr(-1, 1);
        ev.streaks.push({ dir, vel: [Math.cos(a + 1.6 + da) * 0.6, -0.35, Math.sin(a + 1.6 + da) * 0.6], t: 0, life: rr(0.5, 1.2), b: rr(0.6, 1) });
      }
      for (const s of ev.streaks) s.t += dt;
      ev.streaks = ev.streaks.filter((s) => s.t < s.life);
      // aurora: cold biomes, special nights, or after the world is rewoven
      const biome = BIOMES[w.biomeAt(Math.floor(p.x), Math.floor(p.z), p.y)].key;
      const cold = ['tundra', 'taiga', 'barrens', 'frozen_ocean', 'mountains'].includes(biome);
      let target = 0;
      if (night) target = cold ? 1 : ev.auroraNight === g.day ? 0.6 : 0;
      if (g.quest && g.quest.done && night) target = Math.max(target, 0.9);
      if (g.weather) target *= 1 - g.weather.rain;
      ev.aurora += (target - ev.aurora) * Math.min(1, dt * 0.3);
      // fireflies and spores
      if (g.particles && g.settings.particles) {
        const sky = w.skyLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z));
        if (night && sky > 8 && ['swamp', 'meadow', 'forest', 'blossom'].includes(biome) && !(g.weather && g.weather.rain > 0.3)) {
          const want = biome === 'swamp' ? 70 : 32;
          if (ev.fireflies < want && Math.random() < dt * 25) {
            const x = p.x + rr(-14, 14), z = p.z + rr(-14, 14);
            const gy = w.surfaceY(Math.floor(x), Math.floor(z));
            if (gy > 0 && Math.abs(gy - p.y) < 12) {
              const f = g.particles.add({ x, y: gy + rr(1, 3.5), z, r: 0.75, g: 1, b: 0.35, a: 1, size: 0.05, life: rr(6, 12), em: 1, additive: true, flicker: rr(2, 4), wander: 0.25, drag: 0.94, fade: false });
              if (f) { ev.fireflies++; setTimeout(() => ev.fireflies--, f.life * 1000); }
            }
          }
        }
        if (p.y < 46 && sky < 3 && Math.random() < dt * 10) {
          g.particles.add({ x: p.x + rr(-10, 10), y: p.y + rr(-3, 6), z: p.z + rr(-10, 10), vy: rr(-0.05, 0.1), r: 0.35, g: 0.9, b: 0.8, a: 0.8, size: 0.03, life: rr(4, 8), em: 1, additive: true, wander: 0.08, flicker: 1.5 });
        }
      }
    },
    renderSky(g, r) {
      if (!ev.streaks.length) return;
      const cam = g.cam;
      const buf = ev.buf || (ev.buf = new Float32Array(7 * 2 * 64));
      let n = 0;
      for (const s of ev.streaks) {
        if (n >= 126) break;
        const k = s.t / s.life;
        const D = 150;
        const hx = cam.x + (s.dir[0] + s.vel[0] * k) * D, hy = cam.y + (s.dir[1] + s.vel[1] * k) * D, hz = cam.z + (s.dir[2] + s.vel[2] * k) * D;
        const tl = 0.12;
        const tx = hx - s.vel[0] * tl * D, ty = hy - s.vel[1] * tl * D, tz = hz - s.vel[2] * tl * D;
        const a = Math.sin(k * Math.PI) * s.b;
        buf.set([hx, hy, hz, 1, 0.97, 0.9, a], n * 7); n++;
        buf.set([tx, ty, tz, 0.6, 0.7, 1, 0], n * 7); n++;
      }
      r.drawLines(buf, n, { depth: false });
    },
  });

  function spawnMeteor(g) {
    const p = g.player;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, d = rr(45, Math.min(110, g.settings.renderDist * 16 - 8));
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!w.isLoaded(x, z)) continue;
      const y = w.rainY(x, z);
      if (y < 20 || LIQUID[w.getId(x, y, z)] || BLOCKS[w.getId(x, y, z)].leaves) continue;
      const m = new Meteor({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      const back = a + rr(-0.6, 0.6);
      m.setPos(x + Math.cos(back) * 90, Math.min(240, y + 160), z + Math.sin(back) * 90);
      g.entities.add(m);
      g.audio && g.audio.play('meteor', { volume: 0.8 });
      ev.landed++;
      setTimeout(() => {
        g.hud.toast('流星坠落！', `一颗流星落在${compassDir(x - p.x, z - p.z)}方向约 ${Math.round(d)} 格处。陨坑里有星核与陨铁。`, 'discover', 7000);
        g.meteorMarkers = (g.meteorMarkers || []).concat([{ x, z, day: g.day }]).slice(-8);
      }, 3200);
      return true;
    }
    return false;
  }
  game.spawnMeteor = () => spawnMeteor(game);
  void ID_MASK;
}
