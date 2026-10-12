// The running game: owns the world, the player and every subsystem, and drives the frame loop
// (per-frame movement and rendering, fixed 20 Hz world ticks).

import { World } from './world/world.js';
import { ChunkManager } from './world/chunkmanager.js';
import { WorldGen, SEA } from './world/gen/worldgen.js';
import { Renderer } from './render/renderer.js';
import { skyState, DAY_TICKS } from './render/sky.js';
import { Player } from './entity/player.js';
import { Inventory } from './entity/inventory.js';
import { Input } from './input.js';
import { Interaction } from './interaction.js';
import { HUD } from './ui/hud.js';
import { BLOCKS, B, ID_MASK, ID_BITS } from './world/blocks.js';
import { ITEMS, I, itemName } from './world/items.js';
import { BIOMES } from './world/biomes.js';
import { blockDrops } from './world/drops.js';
import { selectionBoxes, CONNECTS, connectionMask } from './world/models.js';
import { clamp } from './core/math.js';

export const TICK = 0.05;

export class Game {
  constructor(opts) {
    this.opts = opts;
    this.app = opts.app || null;
    this.settings = opts.settings;
    this.meta = opts.meta;               // world metadata { id, name, seed, mode, created }
    this.canvas = opts.canvas;
    this.uiRoot = opts.uiRoot;
    this.seed = this.meta.seed >>> 0;
    this.world = new World(this.seed);
    this.gen = new WorldGen(this.seed);  // main-thread copy for queries (spawn, compass)
    this.renderer = new Renderer(this.canvas);
    this.applySettings();
    this.input = opts.input || new Input(this.canvas);
    this.player = new Player(this);
    this.player.creative = this.meta.mode === 'creative';
    this.inventory = new Inventory();
    this.interaction = new Interaction(this);
    this.hud = new HUD(this, this.uiRoot);
    this.ui = { open: null };
    const cores = navigator.hardwareConcurrency || 4;
    this.chunks = new ChunkManager(this, this.seed, { workers: Math.max(2, Math.min(4, cores - 1)) });
    this.dayTime = this.meta.dayTime !== undefined ? this.meta.dayTime : 1000;
    this.day = this.meta.day || 1;
    this.ticks = 0;
    this.acc = 0;
    this.time = 0;            // seconds since start (animation clock)
    this.fps = 60; this.frameMs = 16;
    this.thirdPerson = 0;
    this.running = false;
    this.ready = false;
    this.systems = [];        // { tick(game), frame(game, dt), render(game, r) }
    this.rng = Math.random;
    this.sky = null;
    this.selVerts = new Float32Array(7 * 24 * 8);
    this.listeners = {};
  }

  applySettings() {
    const s = this.settings;
    this.renderer.renderDist = s.renderDist;
    this.renderer.fov = s.fov * Math.PI / 180;
    this.renderer.scale = s.renderScale;
    this.renderer.gamma = 1 - (s.brightness - 0.5) * 0.5;
    if (this.input) { this.input.sensitivity = s.sensitivity; this.input.invertY = s.invertY; }
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  addSystem(s) { this.systems.push(s); if (s.init) s.init(this); return s; }

  // ---------------------------------------------------------------- startup
  async start(saved) {
    if (saved && saved.player) this.loadPlayer(saved.player);
    else {
      const sp = this.findSpawn();
      this.player.x = sp[0] + 0.5; this.player.z = sp[2] + 0.5; this.player.y = sp[1];
      this.player.spawn = { x: this.player.x, y: this.player.y, z: this.player.z };
      this.giveStarterKit();
    }
    this.running = true;
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    // wait until the spawn area is loaded
    const pcx = Math.floor(this.player.x) >> 4, pcz = Math.floor(this.player.z) >> 4;
    await this.chunks.waitFor(pcx, pcz, 1);
    if (!saved || !saved.player) this.settleOnGround();
    this.ready = true;
    this.emit('ready');
  }

  findSpawn() {
    // spiral outward from the origin to the first comfortable dry land
    for (let r = 0; r < 600; r += 8) {
      const steps = Math.max(1, Math.floor(r * 0.8));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
        const c = this.gen.column(x, z);
        const key = BIOMES[c.biome].key;
        if (c.h > SEA + 1 && c.h < SEA + 30 && (key === 'meadow' || key === 'forest' || key === 'blossom') && c.island < 0.05) return [x, c.h + 2, z];
      }
    }
    const c = this.gen.column(0, 0);
    return [0, Math.max(c.h, SEA) + 2, 0];
  }

  settleOnGround() {
    const p = this.player, w = this.world;
    const x = Math.floor(p.x), z = Math.floor(p.z);
    let y = 254;
    while (y > 1 && !BLOCKS[w.getId(x, y, z)].solid) y--;
    // avoid spawning under a tree canopy or on leaves
    if (BLOCKS[w.getId(x, y, z)].leaves) {
      let yy = y;
      while (yy > 1 && (BLOCKS[w.getId(x, yy, z)].leaves || !BLOCKS[w.getId(x, yy, z)].solid || w.getId(x, yy, z) === B.oak_log)) yy--;
      y = yy;
    }
    p.y = y + 1;
    p.vy = 0;
    p.spawn = { x: p.x, y: p.y, z: p.z };
  }

  giveStarterKit() {
    if (this.player.creative) {
      const kit = ['grass', 'stone_bricks', 'oak_planks', 'glass', 'torch', 'lamp_stone', 'oak_log', 'crystal_lamp', 'water_bucket'];
      kit.forEach((n, i) => { this.inventory.slots[i] = { id: I[n], n: ITEMS[I[n]].stack }; });
    } else {
      this.inventory.slots[0] = { id: I.bread, n: 3 };
      this.inventory.slots[1] = { id: I.torch, n: 4 };
    }
    this.inventory.changed();
  }

  // ---------------------------------------------------------------- frame loop
  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    const t0 = performance.now();
    this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
    this.time += dt;
    this.frame(dt);
    this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  frame(dt) {
    const inp = this.input, p = this.player;
    const paused = !!this.ui.paused;
    if (!paused) {
      this.handleInput(dt);
      // movement in small substeps for stable collisions at low frame rates
      const steps = Math.ceil(dt / (1 / 120));
      const sdt = dt / steps;
      const mv = this.movementInput();
      for (let i = 0; i < steps; i++) { p.update(sdt, mv); mv.jumpPressed = false; mv.flyToggle = false; }
      this.interaction.update(dt);
      this.acc += dt;
      let n = 0;
      while (this.acc >= TICK && n < 5) { this.tick(); this.acc -= TICK; n++; }
      if (n === 5) this.acc = 0;
      for (const s of this.systems) if (s.frame) s.frame(this, dt);
    }
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    this.chunks.update(pcx, pcz, this.settings.renderDist, this.ready ? 3 : 8);
    this.render(dt);
    this.hud.update(dt);
    inp.endFrame();
  }

  movementInput() {
    const inp = this.input;
    const block = !inp.locked || this.ui.open;
    const f = block ? 0 : (inp.down('forward') ? 1 : 0) - (inp.down('back') ? 1 : 0);
    const s = block ? 0 : (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    return {
      fwd: f, strafe: s,
      jump: !block && inp.down('jump'),
      sneak: !block && inp.down('sneak'),
      sprint: !block && (inp.down('sprint') || this.sprintLatch),
      jumpPressed: !block && this._jumpPressed,
      flyToggle: !block && this._flyToggle,
    };
  }

  handleInput(dt) {
    const inp = this.input, p = this.player;
    this._jumpPressed = false; this._flyToggle = false;
    if (!inp.locked || this.ui.open) return;
    const [mx, my] = inp.takeMouse();
    const sens = 0.0022 * (inp.sensitivity || 1) * (this.zoomed ? 0.3 : 1);
    const oldYaw = p.yaw;
    p.yaw -= mx * sens;
    p.pitch -= my * sens * (inp.invertY ? -1 : 1);
    p.pitch = clamp(p.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
    p.turnRate = (p.yaw - oldYaw) / Math.max(dt, 1e-3);
    // hotbar
    const w = inp.takeWheel();
    if (w) this.inventory.selected = (this.inventory.selected + (w > 0 ? 1 : -1) + 9) % 9;
    for (let i = 0; i < 9; i++) if (inp.keyPressed(`Digit${i + 1}`)) this.inventory.selected = i;
    if (inp.pressed('jump')) this._jumpPressed = true;
    if (inp.doubleTap('jump')) this._flyToggle = true;
    if (inp.doubleTap('forward')) this.sprintLatch = true;
    if (!inp.down('forward')) this.sprintLatch = false;
    if (inp.pressed('camera')) this.thirdPerson = (this.thirdPerson + 1) % 3;
    if (inp.pressed('debug')) this.hud.toggleDebug();
    if (inp.pressed('hud')) this.hud.setVisible(!this.hud.visible);
    if (inp.pressed('drop')) this.dropHeld(inp.down('sprint'));
    if (inp.pressed('offhand')) this.swapOffhand();
    this.zoomed = inp.down('zoom') || (this.inventory.held() && this.inventory.held().id === I.spyglass && inp.button(2));
  }

  tick() {
    this.ticks++;
    this.world.time++;
    this.dayTime += 1;
    if (this.dayTime >= DAY_TICKS) { this.dayTime -= DAY_TICKS; this.day++; this.emit('newDay', this.day); }
    this.world.runScheduled();
    const p = this.player;
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    this.world.randomTicks(pcx, pcz, Math.min(6, this.settings.renderDist), 3, this.rng);
    for (const s of this.systems) if (s.tick) s.tick(this);
  }

  // ---------------------------------------------------------------- rendering
  envState() {
    const p = this.player, w = this.world;
    const biome = BIOMES[w.biomeAt(Math.floor(p.x), Math.floor(p.z))];
    const weather = this.weather ? this.weather.state() : { rain: 0, storm: 0 };
    const flash = this.weather ? this.weather.flash : 0;
    const s = skyState(this.dayTime, weather, biome, flash);
    this.sky = s;
    const rd = this.settings.renderDist * 16;
    const env = {
      ...s,
      time: this.time,
      ambient: 0.035 + this.settings.brightness * 0.05,
      fogNear: rd * 0.55, fogFar: rd * 0.98,
      cloudCover: 0.5 - (weather.rain * 0.3) + 0.08,
      aurora: this.auroraLevel ? this.auroraLevel() : 0,
      moonPhase: (this.day % 8) / 8,
      underwater: false,
    };
    // underground: fog closes in and turns dark
    const sky = w.skyLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z));
    const cave = 1 - sky / 15;
    if (cave > 0.4 && p.y < 60) {
      const k = (cave - 0.4) / 0.6;
      const deep = p.y < 46 ? [0.035, 0.05, 0.08] : [0.04, 0.045, 0.06];
      env.fog = env.fog.map((c, i) => c * (1 - k) + deep[i] * k);
      env.horizon = env.fog; env.zenith = env.fog;
    }
    if (p.medium && p.medium.eyeWater) {
      const t = biome.waterRGB.map((c) => c / 255);
      const dl = 0.15 + s.daylight * 0.55;
      env.fog = [t[0] * 0.4 * dl, t[1] * 0.55 * dl, t[2] * 0.7 * dl];
      env.fogNear = 0; env.fogFar = 22 + s.daylight * 14;
      env.underwater = true;
    }
    if (p.medium && p.medium.eyeLava) { env.fog = [0.6, 0.18, 0.02]; env.fogNear = 0; env.fogFar = 3; env.underwater = true; }
    if (this.weather) this.weather.adjustEnv(env, p);
    return env;
  }

  camera() {
    const p = this.player;
    const a = this.acc / TICK;
    void a;
    let x = p.x, y = p.eyeY, z = p.z, yaw = p.yaw, pitch = p.pitch;
    // view bobbing
    if (this.settings.viewBob && !this.thirdPerson) {
      const b = p.bob, amt = p.bobAmt;
      y += Math.abs(Math.sin(b * Math.PI)) * 0.06 * amt;
      x += Math.cos(yaw) * Math.sin(b * Math.PI) * 0.03 * amt;
      z -= Math.sin(yaw) * Math.sin(b * Math.PI) * 0.03 * amt;
    }
    if (p.landShake > 0) y -= Math.sin(p.landShake * Math.PI) * 0.12 * p.landShake;
    if (p.stepSmooth) { y -= p.stepSmooth; p.stepSmooth *= 0.75; if (Math.abs(p.stepSmooth) < 0.005) p.stepSmooth = 0; }
    let fov = this.renderer.fov;
    if (p.sprinting) fov *= 1.08;
    if (p.gliding) fov *= 1.1;
    if (this.zoomed) fov *= 0.3;
    this._fovSmooth = this._fovSmooth ? this._fovSmooth + (fov - this._fovSmooth) * 0.15 : fov;
    fov = this._fovSmooth;
    if (this.thirdPerson) {
      const dir = this.thirdPerson === 1 ? 1 : -1;
      const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
      let dist = 4.2;
      // pull the camera in front of walls
      const hit = this.world.raycast(x, y, z, -fx * dir, -fy * dir, -fz * dir, dist, (v) => BLOCKS[v & ID_MASK].solid && BLOCKS[v & ID_MASK].opaque);
      if (hit) dist = Math.max(0.6, hit.dist - 0.3);
      x -= fx * dist * dir; y -= fy * dist * dir; z -= fz * dist * dir;
      if (dir < 0) { yaw += Math.PI; pitch = -pitch; }
    }
    const roll = p.camRoll + (p.hurtTime > 0 ? Math.sin(p.hurtTime * 20) * 0.04 * p.hurtTime : 0);
    return { x, y, z, yaw, pitch, fov, roll };
  }

  render() {
    const r = this.renderer;
    const env = this.envState();
    this.env = env;
    const cam = this.camera();
    this.cam = cam;
    r.beginFrame(cam, env);
    r.drawSky();
    for (const s of this.systems) if (s.renderSky) s.renderSky(this, r);
    r.drawTerrain(0);
    for (const s of this.systems) if (s.renderOpaque) s.renderOpaque(this, r);
    r.drawClouds();
    r.drawTerrain(1);
    for (const s of this.systems) if (s.renderTranslucent) s.renderTranslucent(this, r);
    this.drawSelection();
    for (const s of this.systems) if (s.renderOverlay) s.renderOverlay(this, r);
  }

  drawSelection() {
    const t = this.interaction.target;
    if (!t || this.ui.open || !this.hud.visible) return;
    const v = this.world.getBlock(t.x, t.y, t.z);
    const id = v & ID_MASK;
    const conn = CONNECTS[id] ? connectionMask(v, (a, b, c) => this.world.getBlock(t.x + a, t.y + b, t.z + c)) : 0;
    const boxes = selectionBoxes(v, conn);
    const out = this.selVerts;
    let n = 0;
    const e = 0.004;
    const col = [0.05, 0.06, 0.1, 0.75];
    for (const b of boxes) {
      const x0 = t.x + b[0] - e, y0 = t.y + b[1] - e, z0 = t.z + b[2] - e, x1 = t.x + b[3] + e, y1 = t.y + b[4] + e, z1 = t.z + b[5] + e;
      const edges = [
        [x0, y0, z0, x1, y0, z0], [x0, y1, z0, x1, y1, z0], [x0, y0, z1, x1, y0, z1], [x0, y1, z1, x1, y1, z1],
        [x0, y0, z0, x0, y1, z0], [x1, y0, z0, x1, y1, z0], [x0, y0, z1, x0, y1, z1], [x1, y0, z1, x1, y1, z1],
        [x0, y0, z0, x0, y0, z1], [x1, y0, z0, x1, y0, z1], [x0, y1, z0, x0, y1, z1], [x1, y1, z0, x1, y1, z1],
      ];
      for (const ed of edges) {
        if (n + 2 > out.length / 7) break;
        out.set([ed[0], ed[1], ed[2], ...col], n * 7); n++;
        out.set([ed[3], ed[4], ed[5], ...col], n * 7); n++;
      }
    }
    this.renderer.drawLines(out, n);
  }

  // ---------------------------------------------------------------- gameplay hooks (extended by systems)
  canFly() { return this.player.creative || (this.inventory.slots[40] && this.inventory.slots[40].id === I.star_wings); }
  hasGlider() {
    const inv = this.inventory;
    for (let i = 0; i < 9; i++) if (inv.slots[i] && inv.slots[i].id === I.glider) return true;
    return !!(inv.slots[40] && (inv.slots[40].id === I.glider || inv.slots[40].id === I.star_wings));
  }
  inventoryHas(name) { return this.inventory.has(I[name]); }
  armorPoints() {
    let pts = 0;
    for (let s = 36; s < 40; s++) { const st = this.inventory.slots[s]; if (st && ITEMS[st.id].armor) pts += ITEMS[st.id].armor.points; }
    return pts;
  }
  damageArmor(n) {
    for (let s = 36; s < 40; s++) {
      const st = this.inventory.slots[s];
      if (!st) continue;
      const a = ITEMS[st.id].armor;
      st.dmg = (st.dmg || 0) + n;
      if (st.dmg >= a.dur) { this.inventory.slots[s] = null; this.hud.message(`${ITEMS[st.id].zh} 损坏了`, '#f5a'); }
    }
    this.inventory.changed();
  }

  harvestBlock(x, y, z, v, tool, drop) {
    const w = this.world;
    const id = v & ID_MASK;
    const d = BLOCKS[id];
    // doors: remove the other half too
    if (d.shape === 'door') {
      const up = (v >>> ID_BITS) & 8;
      const oy = up ? y - 1 : y + 1;
      if ((w.getBlock(x, oy, z) & ID_MASK) === id) w.setBlock(x, oy, z, 0);
      if (up) { v = w.getBlock(x, y - 1, z) || v; }
    }
    if (this.onBeforeBreak && this.onBeforeBreak(x, y, z, v, tool) === false) return;
    w.setBlock(x, y, z, 0, { cause: 'player' });
    if (this.particles) this.particles.blockBreak(x, y, z, v);
    if (this.audio) this.audio.dig(id, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (drop) {
      for (const s of blockDrops(d.shape === 'door' ? (v & ~(8 << ID_BITS)) : v, tool, this.rng)) this.spawnItem(x + 0.5, y + 0.3, z + 0.5, s);
      if (this.onHarvest) this.onHarvest(x, y, z, v, tool);
    }
    this.emit('blockBroken', x, y, z, v);
  }

  // Without an entity system yet, drops go straight into the inventory.
  spawnItem(x, y, z, st, vel) {
    if (this.entities && this.entities.spawnItem) return this.entities.spawnItem(x, y, z, st, vel);
    this.inventory.add(st.id, st.n);
    return null;
  }

  pickBlock(v) {
    const id = v & ID_MASK;
    const itemId = BLOCKS[id].item ? id : null;
    if (itemId === null) return;
    const inv = this.inventory;
    for (let i = 0; i < 9; i++) if (inv.slots[i] && inv.slots[i].id === itemId) { inv.selected = i; return; }
    inv.slots[inv.selected] = { id: itemId, n: ITEMS[itemId].stack };
    inv.changed();
  }

  dropHeld(all) {
    const st = this.inventory.held();
    if (!st) return;
    const n = all ? st.n : 1;
    const p = this.player;
    const dir = [-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)];
    const s = { ...st, n };
    this.inventory.consumeHeld(n);
    if (this.entities) this.entities.spawnItem(p.x + dir[0] * 0.4, p.eyeY - 0.3, p.z + dir[2] * 0.4, s, [dir[0] * 5, dir[1] * 5 + 1.5, dir[2] * 5], 1.2);
    else this.inventory.add(s.id, s.n);
  }

  swapOffhand() {
    const inv = this.inventory;
    const a = inv.slots[inv.selected], b = inv.slots[40];
    inv.slots[inv.selected] = b; inv.slots[40] = a;
    inv.changed();
  }

  attackEntity(e) { if (this.entities) this.entities.attack(e); }
  interactEntity(e, held) { return this.entities ? this.entities.interact(e, held) : false; }
  useBlock(x, y, z, v, held, fresh, hit) { return this.blockUse ? this.blockUse(x, y, z, v, held, fresh, hit) : false; }
  useItem(held, def, hit, fresh) { return this.itemUse ? this.itemUse(held, def, hit, fresh) : false; }
  onToolBreak(st) { this.hud.message(`${itemName(st.id)} 用坏了`, '#f9a'); if (this.audio) this.audio.play('break_tool'); }
  releaseGrapple() { this.player.grapple = null; }

  // ---------------------------------------------------------------- persistence
  serializePlayer() {
    const p = this.player;
    return {
      x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, vy: 0,
      health: p.health, hunger: p.hunger, saturation: p.saturation, air: p.air,
      spawn: p.spawn, flying: p.flying, inventory: this.inventory.serialize(),
      effects: p.effects,
    };
  }
  loadPlayer(o) {
    const p = this.player;
    Object.assign(p, { x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0, pitch: o.pitch || 0, health: o.health ?? 20, hunger: o.hunger ?? 20, saturation: o.saturation ?? 5, air: o.air ?? 300, spawn: o.spawn, flying: !!o.flying && this.canFly() });
    p.effects = o.effects || {};
    this.inventory.load(o.inventory);
  }

  stop() {
    this.running = false;
    this.chunks.dispose();
    for (const s of this.systems) if (s.dispose) s.dispose(this);
    this.hud.root.remove();
  }
}
