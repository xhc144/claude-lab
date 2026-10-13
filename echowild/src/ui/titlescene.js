// The living title backdrop: a real world (fixed seed) rendered behind the main menu with a
// cinematic camera — a slow flight along the river toward the western ranges, an orbit around
// the Weaver's altar, and a rising crane over the blossom meadows — cut together with fades.
// Animals wander, clouds drift and the light breathes through golden hour. Nothing is saved.

import { Game } from '../game.js';
import { installSystems } from '../systems/index.js';
import { locateStructures } from '../world/gen/structures.js';

export const TITLE_SEED = 20261012;
const SHOT = 19;     // seconds per shot
const FADE = 1.4;    // cross-fade (through black) seconds

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export class TitleScene {
  constructor(app) {
    this.app = app;
    this.game = null;
    this.ready = false;
    this.t = 0;
    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'title-fade';
  }

  async start() {
    const app = this.app;
    const settings = { ...app.settings, renderDist: Math.max(6, Math.min(app.settings.renderDist, 10)), difficulty: 0, viewBob: false, particles: true };
    const meta = { id: '__title', name: '', seed: TITLE_SEED, mode: 'creative', difficulty: 0, dayTime: 10300 };
    const holder = document.createElement('div'); // the HUD lives off-document
    const g = new Game({ canvas: app.canvas, uiRoot: holder, settings, input: app.input, meta, app, renderer: app.getRenderer() });
    this.game = g;
    g.titleScene = true;
    installSystems(g, null);
    g.store = null;
    g.rules.weatherCycle = false; g.rules.daylightCycle = false; g.rules.mobSpawning = true;
    if (g.weather) { g.weather.rain = 0; g.weather.target = 0; }
    g.hud.setVisible(false);
    g.player.update = () => {};
    g.player.flying = true;
    const [sx, , sz] = g.gen.spawnPoint();
    const heart = locateStructures(g.gen, 'heart', sx, sz, 3)[0] || { x: sx, y: 76, z: sz - 16 };
    this.heart = heart;
    // the nearest floating island, for the closing crane shot to look up at
    let best = null;
    for (let dz = -72; dz <= 24; dz += 4) for (let dx = -48; dx <= 48; dx += 4) {
      const c = g.gen.column(heart.x + dx, heart.z + dz);
      if (c.island > 0.6 && (!best || Math.hypot(dx, dz + 30) < best.d)) best = { x: heart.x + dx, z: heart.z + dz, d: Math.hypot(dx, dz + 30) };
    }
    this.island = best;
    g.camera = () => this.camera();
    app.root.prepend(this.fadeEl);
    this.fadeEl.style.opacity = '0';
    await g.start(null);
    // the opening shot starts away from spawn: let its surroundings load before we show it
    const c0 = this.shot(0, 0);
    g.player.x = c0.x; g.player.z = c0.z;
    await g.chunks.waitFor(Math.floor(c0.x) >> 4, Math.floor(c0.z) >> 4, 2);
    if (this.stopped) return;
    g.inventory.slots.fill(null);
    g.inventory.changed();
    this.ready = true;
    this.t0 = g.time;
    app.onTitleReady && app.onTitleReady();
  }

  stop() {
    this.stopped = true;
    if (this.game) { this.game.stop(); this.game = null; }
    this.fadeEl.remove();
  }

  applySettings(s) {
    if (!this.game) return;
    this.game.settings = { ...this.game.settings, graphics: s.graphics, fov: s.fov, brightness: s.brightness, renderScale: s.renderScale };
    this.game.applySettings();
  }

  // terrain height under (x, z) (the ground, not floating islands or tree tops)
  ground(x, z) {
    return Math.max(this.game.gen.column(Math.floor(x), Math.floor(z)).h, 62);
  }
  look(c, tx, ty, tz) {
    const dx = tx - c.x, dz = tz - c.z, dy = ty - c.y;
    c.yaw = Math.atan2(-dx, -dz); c.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    return c;
  }

  // camera for shot k at local time u (0..1)
  shot(k, u) {
    const H = this.heart;
    const e = smooth(u);
    if (k === 0) {
      // a glide above the river, the low sun at our back lighting the valley ahead
      const x = lerp(H.x - 60, H.x - 22, e), z = H.z + 10 + Math.sin(u * 2.4) * 1.5;
      let top = 64;
      for (let d = -14; d <= 14; d += 7) top = Math.max(top, this.ground(x, z + d), this.ground(x + 10, z + d));
      const y = top + 7 + Math.sin(u * 3.1) * 0.5;
      return this.look({ x, y, z }, H.x + 40, H.y + 2 - u * 4, H.z + 6);
    }
    if (k === 1) {
      // orbit the altar
      const a = 0.6 + u * 1.1, r = 25;
      const x = H.x + Math.sin(a) * r, z = H.z + Math.cos(a) * r;
      const y = Math.max(this.ground(x, z), H.y) + 14 - u * 3;
      const dx = H.x - x, dz = H.z - z, dy = H.y + 3 - y;
      return { x, y, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
    }
    // a crane rising from the meadow beside the altar up toward a floating island
    const I = this.island;
    if (I) {
      const x = H.x + 6 + u * 3, z = H.z + 30 - u * 6;
      const y = lerp(this.ground(x, z) + 4, 166, e);
      return this.look({ x, y, z }, lerp(H.x, I.x, e), lerp(H.y + 2, 182, e * e), lerp(H.z, I.z, e));
    }
    const x = H.x + 3 + u * 5, z = H.z - 3 - u * 4;
    const y = this.ground(x, z) + lerp(3, 18, e);
    return { x, y, z, yaw: -0.35 + u * 0.25, pitch: lerp(0.02, -0.2, e) };
  }

  camera() {
    const g = this.game, p = g.player;
    const r = g.renderer;
    if (!this.ready) {
      const c = this.shot(0, 0);
      p.x = c.x; p.y = c.y; p.z = c.z;
      return { ...c, fov: r.fov, roll: 0 };
    }
    const t = g.time - this.t0;
    const n = Math.floor(t / SHOT), u = (t % SHOT) / SHOT;
    const k = n % 3;
    const c = this.shot(k, u);
    // fade through black at the cut
    const left = SHOT - (t % SHOT), into = t % SHOT;
    const f = left < FADE ? 1 - left / FADE : into < FADE && n > 0 ? 1 - into / FADE : 0;
    this.fadeEl.style.opacity = f.toFixed(3);
    // keep the world (chunk loading, animals, sounds) centred on the camera
    p.x = c.x; p.z = c.z; p.y = c.y - 1.62;
    p.yaw = c.yaw; p.pitch = c.pitch;
    // golden hour breathes slowly
    g.dayTime = 10150 + 750 * (0.5 - 0.5 * Math.cos(t / 240 * Math.PI * 2));
    return { x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch, fov: r.fov * 0.86, roll: Math.sin(t * 0.21) * 0.008 };
  }
}
