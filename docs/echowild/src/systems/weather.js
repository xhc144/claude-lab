// Weather: clear / rain / storm (snow in cold biomes), rain streaks and snowflakes, lightning
// that can start fires, rain that douses flames and fills cauldrons, snow that piles up.

import { BLOCKS, B, ID_MASK, SOLID, LIQUID, FLAMMABLE, pack } from '../world/blocks.js';
import { BIOMES } from '../world/biomes.js';
import { hash2 } from '../core/noise.js';

const DUR = { clear: [6000, 18000], rain: [3000, 8000], storm: [2000, 5000] };
const rr = (a, b) => a + Math.random() * (b - a);

export class Weather {
  constructor(game, saved) {
    this.game = game;
    this.kind = saved ? saved.kind : 'clear';
    this.t = saved ? saved.t : rr(...DUR.clear);
    this.rain = saved ? saved.rain || 0 : 0;
    this.storm = saved ? saved.storm || 0 : 0;
    this.flash = 0;
    this.bolts = [];
    this.lineBuf = new Float32Array(7 * 4000);
    this.flakes = [];
  }
  serialize() { return { kind: this.kind, t: this.t, rain: this.rain, storm: this.storm }; }
  set(kind, dur) {
    if (kind === 'snow') kind = 'rain';
    if (!DUR[kind]) kind = 'clear';
    this.kind = kind;
    this.t = dur ? dur * 20 : rr(...DUR[kind]);
  }
  clear() { this.set('clear'); this.rain = 0; this.storm = 0; }
  state() { return { rain: this.rain, storm: this.storm }; }
  label() {
    if (this.rain < 0.2) return '';
    const p = this.game.player;
    const cold = this.snowAt(p.x, p.y, p.z);
    if (this.storm > 0.5) return cold ? '暴风雪' : '雷暴';
    const b = BIOMES[this.game.world.biomeAt(Math.floor(p.x), Math.floor(p.z), p.y)];
    if (!b.rain) return '阴天';
    return cold ? '飘雪' : '下雨';
  }
  biomeRains(x, z) { return BIOMES[this.game.world.biomeAt(Math.floor(x), Math.floor(z))].rain !== false; }
  snowAt(x, y, z) {
    const b = BIOMES[this.game.world.biomeAt(Math.floor(x), Math.floor(z), y)];
    return b.snow || y > 150 || (b.key === 'mountains' && y > 120);
  }
  rainAt(x, z) { return this.biomeRains(x, z) ? this.rain : 0; }
  isRainingAt(x, y, z) {
    if (this.rain < 0.3 || !this.biomeRains(x, z)) return false;
    return this.game.world.rainY(Math.floor(x), Math.floor(z)) < y;
  }
  adjustEnv(env) {
    const r = this.rainAt(this.game.player.x, this.game.player.z);
    env.fogFar *= 1 - r * 0.35;
    env.fogNear *= 1 - r * 0.5;
  }

  tick() {
    const g = this.game;
    if (!g.rules || g.rules.weatherCycle) this.t -= 1;
    if (this.t <= 0) {
      const r = Math.random();
      if (this.kind === 'clear') this.set(r < 0.75 ? 'rain' : 'storm');
      else this.set('clear');
    }
    const targetRain = this.kind === 'clear' ? 0 : 1;
    const targetStorm = this.kind === 'storm' ? 1 : 0;
    this.rain += Math.sign(targetRain - this.rain) * Math.min(Math.abs(targetRain - this.rain), 0.004);
    this.storm += Math.sign(targetStorm - this.storm) * Math.min(Math.abs(targetStorm - this.storm), 0.004);
    // lightning
    if (this.storm > 0.6 && Math.random() < 0.012) this.strike();
    // world effects of rain and snow around the player
    if (this.rain > 0.5 && Math.random() < 0.5) {
      const w = g.world, p = g.player;
      const x = Math.floor(p.x + rr(-40, 40)), z = Math.floor(p.z + rr(-40, 40));
      if (!w.isLoaded(x, z)) return;
      const y = w.rainY(x, z);
      const top = w.getBlock(x, y, z) & ID_MASK;
      if (!this.biomeRains(x, z)) return;
      if (this.snowAt(x, y, z)) {
        const above = w.getId(x, y + 1, z);
        if (top === B.water && (w.getMeta(x, y, z) & 7) === 0) w.setBlock(x, y, z, B.ice);
        else if (top === B.snow_layer) { const m = w.getMeta(x, y, z); if (m < 3 && Math.random() < 0.3) w.setBlock(x, y, z, pack(B.snow_layer, m + 1)); }
        else if (!above && SOLID[top] && BLOCKS[top].shape === 'cube' && BLOCKS[top].opaque && top !== B.ice && (w.getLight(x, y + 1, z) >> 4) < 10) w.setBlock(x, y + 1, z, B.snow_layer);
      } else if (top === B.cauldron) {
        const m = w.getMeta(x, y, z) & 3;
        if (m < 3 && Math.random() < 0.2) w.setBlock(x, y, z, pack(B.cauldron, m + 1));
      } else if (top === B.fire) w.setBlock(x, y, z, 0);
    }
  }

  strike() {
    const g = this.game, w = g.world, p = g.player;
    const x = Math.floor(p.x + rr(-70, 70)), z = Math.floor(p.z + rr(-70, 70));
    if (!w.isLoaded(x, z) || !this.biomeRains(x, z)) return;
    const y = w.rainY(x, z);
    // jagged bolt from the clouds
    const pts = [[x + 0.5, Math.min(230, y + 120), z + 0.5]];
    let cx = x + 0.5, cz = z + 0.5;
    for (let yy = pts[0][1]; yy > y + 1; yy -= rr(4, 10)) { cx += rr(-2.5, 2.5); cz += rr(-2.5, 2.5); pts.push([cx, yy, cz]); }
    pts.push([x + 0.5, y + 1, z + 0.5]);
    this.bolts.push({ pts, t: 0.35 });
    this.flash = 1;
    const d = Math.hypot(x - p.x, z - p.z);
    setTimeout(() => g.audio && g.audio.play('thunder', { distance: d, volume: Math.max(0.3, 1.4 - d / 100) }), d * 3);
    // set things alight
    const top = w.getId(x, y, z);
    if (!w.getId(x, y + 1, z) && (FLAMMABLE[top] || top === B.grass) && Math.random() < 0.6) w.setBlock(x, y + 1, z, B.fire);
    if (Math.hypot(p.x - x, p.z - z) < 3 && Math.abs(p.y - y) < 4) { p.damage(5, 'fire'); p.fireTime = 4; }
    for (const e of g.entities.near(x, y + 1, z, 3)) if (e.hurt) { e.hurt(g, 5, 'fire'); e.fireT = 4; }
    g.emit('lightning', x, y, z);
  }

  frame(dt) {
    const g = this.game;
    this.flash = Math.max(0, this.flash - dt * 3);
    for (const b of this.bolts) b.t -= dt;
    this.bolts = this.bolts.filter((b) => b.t > 0);
  }

  // rain streaks (lines) and snowflakes (particles) in a field around the camera
  render(r) {
    const g = this.game;
    const cam = g.cam, w = g.world;
    const buf = this.lineBuf;
    let n = 0;
    // lightning bolts
    for (const b of this.bolts) {
      const a = Math.min(1, b.t * 4);
      for (let i = 0; i < b.pts.length - 1; i++) {
        const p0 = b.pts[i], p1 = b.pts[i + 1];
        buf.set([p0[0], p0[1], p0[2], 0.9, 0.95, 1, a], n * 7); n++;
        buf.set([p1[0], p1[1], p1[2], 0.9, 0.95, 1, a], n * 7); n++;
      }
    }
    if (n) r.drawLines(buf, n, { depth: true });
    if (this.rain < 0.05 || !g.settings.particles) return;
    n = 0;
    const R = 18, t = g.time;
    const flakes = this.flakes;
    flakes.length = 0;
    const cx0 = Math.floor(cam.x), cz0 = Math.floor(cam.z);
    const dens = this.rain;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > R * R) continue;
      const x = cx0 + dx, z = cz0 + dz;
      const h = hash2(x, z, 77);
      if ((h & 255) / 255 > dens * 0.85) continue;
      if (!w.isLoaded(x, z) || !this.biomeRains(x, z)) continue;
      const ground = w.rainY(x, z) + 1;
      const fx = x + ((h >> 8) & 255) / 255, fz = z + ((h >> 16) & 255) / 255;
      const snow = this.snowAt(x, ground, z);
      const span = 24;
      if (snow) {
        for (let k = 0; k < 2; k++) {
          const ph = ((h >> (k * 5)) & 1023) / 1023;
          const yy = cam.y + span / 2 - ((t * 2.2 + ph * span) % span);
          if (yy < ground) continue;
          flakes.push({ x: fx + Math.sin(t * 0.8 + ph * 10) * 0.4, y: yy, z: fz + Math.cos(t * 0.6 + ph * 7) * 0.4, r: 1, g: 1, b: 1, a: 0.85, u0: 0, v0: 0, us: 1, layer: -1, size: 0.045, em: 0 });
        }
      } else {
        for (let k = 0; k < 2; k++) {
          const ph = ((h >> (k * 6 + 3)) & 1023) / 1023;
          const yy = cam.y + span / 2 - ((t * 22 + ph * span) % span);
          if (yy < ground || n > 3800) continue;
          const len = 0.7;
          const lit = 0.45 + (g.sky ? g.sky.daylight * 0.4 : 0.3);
          buf.set([fx, yy, fz, 0.7 * lit, 0.78 * lit, 0.95 * lit, 0.42], n * 7); n++;
          buf.set([fx - 0.05, yy + len, fz - 0.03, 0.7 * lit, 0.78 * lit, 0.95 * lit, 0.0], n * 7); n++;
          if (yy - ground < 0.5 && Math.random() < 0.08 && g.particles) g.particles.add({ x: fx, y: ground + 0.05, z: fz, vy: 0.8, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5), r: 0.75, g: 0.85, b: 1, a: 0.6, size: 0.04, life: 0.25, grav: 10 });
        }
      }
    }
    if (n) r.drawLines(buf, n, { depth: true });
    if (flakes.length) r.drawParticles(flakes, flakes.length, false);
  }
}

export function installWeather(game, state) {
  const wthr = new Weather(game, state && state.weather);
  game.weather = wthr;
  game.stateSavers.push((s) => { s.weather = wthr.serialize(); });
  game.addSystem({
    tick() { wthr.tick(); },
    frame(g, dt) { wthr.frame(dt); },
    renderTranslucent(g, r) { wthr.render(r); },
  });
  void LIQUID;
}
