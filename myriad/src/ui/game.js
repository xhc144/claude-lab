// The game controller: owns the world and the renderer, runs the simulation within a per-frame
// time budget, routes input to the camera and the player's tools, tracks the selection, turns the
// world's notices into toasts, drives the director camera, keeps timeline snapshots for rewinding,
// and autosaves.

import { createWorld, step, refreshDerived } from '../sim/world.js';
import { year } from '../sim/state.js';
import { applyTool, TOOL } from '../sim/powers.js';
import { snapshot, restore } from '../sim/serialize.js';
import { log } from '../sim/chronicle.js';
import { findCreatureAt } from '../sim/life/creatures.js';
import { Renderer } from '../render/renderer.js';
import { getLocal, setLocal, saveSlot } from './storage.js';
import { h } from './dom.js';

export const SPEEDS = [
  { tps: 0, name: '暂停' },
  { tps: 2, name: '1×' },
  { tps: 6, name: '2×' },
  { tps: 16, name: '3×' },
  { tps: 48, name: '4×' },
  { tps: 160, name: '5×' },
  { tps: 4000, name: '极速' },
];

export class Game {
  constructor(root) {
    this.root = root;
    this.canvas = h('canvas#stage');
    root.append(this.canvas);
    this.R = new Renderer(this.canvas);
    this.world = null;
    this.speed = 1;
    this.prevSpeed = 1;
    this.tool = 'inspect';
    this.brush = { r: 4, strength: 0.5 };
    this.param = { genes: null, name: null, idea: 'republic', aspect: 'mercy', species: null };
    this.pairFirst = null;
    this.selection = null;
    this.listeners = {};
    this.acc = 0;
    this.lastFrame = 0;
    this.uiTimer = 0;
    this.director = false;
    this.directorQueue = [];
    this.directorHold = 0;
    this.timeline = [];
    this.snapEvery = 50;
    this.lastSnapYear = -1e9;
    this.dirtyDerived = 0;
    this.lastAutosave = performance.now();
    this.ticksThisSecond = 0;
    this.tpsMeasured = 0;
    this.tpsClock = 0;
    this.frameMs = 16;
    this.codex = getLocal('codex', {});
    this.settings = Object.assign({ clouds: true, labels: true, creatures: true, borders: true, daynight: false, toastLevel: 2, autosave: true, sound: true, volume: 0.5 }, getLocal('settings', {}));
    Object.assign(this.R.opts, { clouds: this.settings.clouds, labels: this.settings.labels, creatures: this.settings.creatures, borders: this.settings.borders, daynight: this.settings.daynight });
    this.input();
    window.addEventListener('resize', () => this.R.resize());
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  on(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = [])).push(fn); }
  emit(ev, data) { for (const fn of this.listeners[ev] || []) fn(data); }

  // ---- worlds ----------------------------------------------------------------------------------

  newWorld(opts) {
    const w = createWorld(opts);
    w.name = opts.name || `第 ${w.seed % 10000} 号世界`;
    w.scenario = opts.scenario || null;
    if (opts.setup) opts.setup(w);
    this.setWorld(w, true);
    return w;
  }

  setWorld(w, fresh = false) {
    this.world = w;
    this.R.setWorld(w);
    this.selection = null;
    this.R.selection = null;
    this.pairFirst = null;
    if (fresh) { this.timeline = []; this.lastSnapYear = -1e9; this.takeSnapshot('创世之初'); }
    this.emit('world', w);
    this.emit('ui');
  }

  // ---- time ------------------------------------------------------------------------------------

  setSpeed(i) {
    if (i > 0) this.prevSpeed = i;
    this.speed = Math.max(0, Math.min(SPEEDS.length - 1, i));
    this.emit('speed', this.speed);
  }

  togglePause() { this.setSpeed(this.speed === 0 ? this.prevSpeed || 1 : 0); }

  stepOnce() {
    if (!this.world) return;
    step(this.world);
    this.afterTicks(1);
  }

  frame(now) {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    const w = this.world;
    if (!w) return;
    const t0 = performance.now();
    // run the simulation within a time budget
    const sp = SPEEDS[this.speed];
    let ticks = 0;
    if (sp.tps > 0) {
      this.acc += dt * sp.tps;
      const budget = sp.tps >= 1000 ? 28 : sp.tps >= 100 ? 18 : 11;
      const maxTicks = sp.tps >= 1000 ? 400 : Math.ceil(sp.tps / 10) + 2;
      while (this.acc >= 1 && ticks < maxTicks && performance.now() - t0 < budget) {
        step(w);
        this.acc -= 1;
        ticks++;
      }
      if (this.acc > maxTicks) this.acc = 0; // cannot keep up: drop the backlog
    }
    if (ticks) this.afterTicks(ticks);
    // derived fields after player edits
    if (this.dirtyDerived && now > this.dirtyDerived) {
      this.dirtyDerived = 0;
      if (refreshDerived(w)) this.R.terrain.markAll();
    }
    this.ticksThisSecond += ticks;
    this.tpsClock += dt;
    if (this.tpsClock >= 1) { this.tpsMeasured = this.ticksThisSecond / this.tpsClock; this.ticksThisSecond = 0; this.tpsClock = 0; }
    this.R.ticksPerSecond = sp.tps === 0 ? 0 : Math.min(sp.tps, this.tpsMeasured || sp.tps);
    // brush held down
    if (this.painting && this.pointer) this.applyBrush(dt);
    this.updateDirector(dt);
    this.R.selection = this.selection;
    this.R.frame(dt, this);
    this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1;
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) { this.uiTimer = 0.25; this.emit('ui'); }
    this.emit('frame', dt);
  }

  afterTicks(n) {
    const w = this.world;
    // notices → toasts, director, codex
    if (w.notices.length) {
      const ns = w.notices;
      w.notices = [];
      for (const no of ns) this.handleNotice(no);
    }
    // timeline snapshots
    const y = year(w);
    if (y - this.lastSnapYear >= this.snapEvery) this.takeSnapshot();
    // autosave every 3 minutes of play
    if (this.settings.autosave && performance.now() - this.lastAutosave > 180000) { this.lastAutosave = performance.now(); this.autosave(); }
    this.emit('tick', n);
  }

  handleNotice(no) {
    if (this.world && this.world.demo) {
      if (no.kind === 'chronicle' && no.entry.imp >= 2 && no.entry.x != null) this.directorQueue.push(no.entry);
      return;
    }
    if (no.kind === 'chronicle') {
      const e = no.entry;
      if (e.imp >= this.settings.toastLevel) this.emit('toast', { text: e.text, year: e.year, cat: e.cat, imp: e.imp, x: e.x, y: e.y });
      if (e.imp >= 2 && e.x != null) this.directorQueue.push(e);
      this.emit('chronicle', e);
      this.emit('sound', { cat: e.cat, imp: e.imp, text: e.text });
    } else if (no.kind === 'achievement') {
      const first = !this.codex[no.id];
      if (first) { this.codex[no.id] = { date: Date.now(), world: this.world.name, year: year(this.world) }; setLocal('codex', this.codex); }
      this.emit('toast', { text: `图鉴解锁：「${no.name}」—— ${no.desc}`, ach: true, imp: 3 });
      this.emit('sound', { cat: 'achievement', imp: 3 });
      this.emit('codex');
    }
  }

  // ---- timeline --------------------------------------------------------------------------------

  takeSnapshot(label = null) {
    const w = this.world;
    const y = year(w);
    this.lastSnapYear = y;
    let thumb = null;
    try { thumb = this.thumbnail(160, 100); } catch { thumb = null; }
    const alive = w.nations.filter((n) => n.alive && n.cities.length);
    const desc = label || (alive.length ? `${alive.length} 国 · ${w.cities.filter((c) => c.alive).length} 城` : `${w.speciesAliveCount} 个物种`);
    this.timeline.push({ year: y, tick: w.tick, snap: snapshot(w), thumb, desc, branch: w.branch || 0 });
    if (this.timeline.length > 14) this.timeline.splice(1, 1); // always keep the beginning
    this.emit('timeline');
  }

  rewind(i) {
    const item = this.timeline[i];
    if (!item) return;
    const w = restore(item.snap);
    w.branch = (this.world.branch || 0) + 1;
    w.flags.rewound = true;
    w.name = this.world.name;
    this.timeline = this.timeline.slice(0, i + 1);
    this.setWorld(w);
    this.lastSnapYear = item.year;
    log(w, 'divine', `时间倒流回 ${item.year} 年。一条新的时间线从这里分岔（第 ${w.branch} 条支线）。`, { imp: 2 });
    this.emit('timeline');
  }

  thumbnail(tw, th) {
    const src = this.R.terrain.canvas;
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, tw, th);
    if (this.R.overlay && this.world.nations.length) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(this.R.overlay.border, 0, 0, tw, th);
    }
    return c.toDataURL('image/jpeg', 0.7);
  }

  async autosave() {
    if (!this.world) return;
    try {
      await saveSlot('autosave', { meta: this.saveMeta(), snap: snapshot(this.world) });
      this.emit('saved', 'autosave');
    } catch { /* storage unavailable */ }
  }

  saveMeta() {
    const w = this.world;
    let thumb = null;
    try { thumb = this.thumbnail(160, 100); } catch { /* ignore */ }
    return { name: w.name, year: year(w), date: Date.now(), nations: w.nations.filter((n) => n.alive && n.cities.length).length, species: w.speciesAliveCount, thumb, seed: w.seed };
  }

  // ---- tools -----------------------------------------------------------------------------------

  setTool(id) {
    this.tool = id;
    this.pairFirst = null;
    this.emit('tool', id);
  }

  useToolAt(x, y, dt = 0.016) {
    const w = this.world;
    const t = TOOL[this.tool];
    if (!t || t.id === 'inspect') return null;
    const opts = { r: this.brush.r, strength: this.brush.strength, dt, param: this.param };
    if (t.mode === 'pair') {
      if (!this.pairFirst) {
        this.pairFirst = { x, y };
        this.emit('toast', { text: '已选定第一个目标，请点击第二个目标', imp: 1, quick: true });
        return null;
      }
      opts.from = this.pairFirst;
      this.pairFirst = null;
    }
    const res = applyTool(w, t.id, x, y, opts);
    if (res && res.msg) this.emit('toast', { text: res.msg, imp: 1, quick: true });
    if (res && res.ok !== false) {
      this.edits = (this.edits || 0) + 1;
      const r = (t.r ? this.brush.r : 3) + 3;
      this.R.terrain.markRect(x - r, y - r, x + r, y + r);
      if (['raise', 'lower', 'flatten', 'mountain', 'island', 'smooth', 'drought', 'wet', 'heat', 'cool', 'worldtree', 'volcano', 'meteor', 'quake'].includes(t.id)) this.dirtyDerived = performance.now() + 350;
      if (t.mode !== 'brush') this.emit('sound', { cat: 'tool', tool: t.id });
      this.emit('ui');
    }
    // notices produced by the tool (e.g. chronicle entries) show immediately even when paused
    if (w.notices.length) { const ns = w.notices; w.notices = []; for (const no of ns) this.handleNotice(no); }
    return res;
  }

  applyBrush(dt) {
    const t = TOOL[this.tool];
    if (!t || t.mode !== 'brush') return;
    const [wx, wy] = this.R.cam.toWorld(this.pointer.x, this.pointer.y);
    this.useToolAt(wx, wy, dt);
  }

  // ---- selection & inspection ------------------------------------------------------------------

  pickAt(x, y) {
    const w = this.world;
    // armies, cities, creatures, then the cell
    for (const a of w.armies) if (a.alive && Math.hypot(a.x - x, a.y - y) < Math.max(0.9, 8 / this.R.cam.zoom)) return { type: 'army', id: a.id };
    let best = null, bd = Math.max(1.2, 10 / this.R.cam.zoom);
    for (const c of w.cities) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x + 0.5 - x, c.y + 0.5 - y);
      if (d < bd + c.tier * 0.25) { bd = d; best = c; }
    }
    if (best) return { type: 'city', id: best.id };
    const j = findCreatureAt(w, x, y, Math.max(0.8, 6 / this.R.cam.zoom));
    if (j >= 0) return { type: 'creature', uid: w.life.uid[j], slot: j };
    if (x < 0 || y < 0 || x >= w.W || y >= w.H) return null;
    return { type: 'cell', x: Math.floor(x), y: Math.floor(y) };
  }

  select(sel, fly = false) {
    this.selection = sel;
    this.emit('select', sel);
    if (fly && sel) {
      const p = this.selectionPos(sel);
      if (p) this.R.cam.flyTo(p.x, p.y, Math.max(this.R.cam.zoom, sel.type === 'nation' ? 5 : 8));
    }
  }

  selectionPos(sel) {
    const w = this.world;
    if (!sel) return null;
    switch (sel.type) {
      case 'city': { const c = w.cities[sel.id]; return c ? { x: c.x + 0.5, y: c.y + 0.5 } : null; }
      case 'army': { const a = w.armies.find((q) => q.id === sel.id); return a ? { x: a.x, y: a.y } : null; }
      case 'creature': { const L = w.life; const i = this.findCreatureSlot(sel); return i >= 0 ? { x: L.x[i], y: L.y[i] } : null; }
      case 'nation': { const n = w.nations[sel.id]; const c = n && w.cities[n.capital]; return c ? { x: c.x + 0.5, y: c.y + 0.5 } : null; }
      case 'species': { const s = w.species[sel.id]; return s ? { x: s.x, y: s.y } : null; }
      case 'cell': return { x: sel.x + 0.5, y: sel.y + 0.5 };
      default: return null;
    }
  }

  findCreatureSlot(sel) {
    const L = this.world.life;
    if (sel.slot != null && L.alive[sel.slot] && L.uid[sel.slot] === sel.uid) return sel.slot;
    for (let i = 0; i < L.hi; i++) if (L.alive[i] && L.uid[i] === sel.uid) { sel.slot = i; return i; }
    return -1;
  }

  follow(sel) {
    this.R.cam.follow = () => this.selectionPos(sel);
  }

  flyTo(x, y, z) { this.R.cam.flyTo(x, y, z ?? Math.max(this.R.cam.zoom, 7)); }

  // ---- director mode ---------------------------------------------------------------------------

  setDirector(on) {
    this.director = on;
    this.directorHold = 0;
    this.directorQueue = [];
    this.emit('director', on);
    if (on && this.speed === 0) this.setSpeed(2);
  }

  updateDirector(dt) {
    if (!this.director) return;
    this.directorHold -= dt;
    if (this.directorHold > 0) return;
    const w = this.world;
    // the most important recent event wins
    this.directorQueue = this.directorQueue.filter((e) => w.tick - e.t < 40);
    this.directorQueue.sort((a, b) => b.imp - a.imp || b.t - a.t);
    const e = this.directorQueue.shift();
    if (e) {
      this.R.cam.flyTo(e.x + 0.5, e.y + 0.5, 9, 2.2);
      this.emit('caption', { text: e.text, cat: e.cat, year: e.year });
      this.directorHold = 7;
    } else {
      // drift over something interesting: a large city, a battle or a herd
      const cs = w.cities.filter((c) => c.alive);
      const fighting = w.armies.filter((a) => a.battle);
      let tx, ty, z = 6;
      if (fighting.length && Math.random() < 0.5) { const a = fighting[0]; tx = a.x; ty = a.y; z = 10; }
      else if (cs.length && Math.random() < 0.7) { const c = cs[Math.floor(Math.random() * cs.length)]; tx = c.x; ty = c.y; z = 7 + Math.random() * 5; }
      else { const sp = w.species.filter((s) => s.extinct === null && s.pop > 10); const s = sp[Math.floor(Math.random() * sp.length)]; if (s) { tx = s.x; ty = s.y; z = 12; } }
      if (tx != null) this.R.cam.flyTo(tx, ty, z, 3);
      this.emit('caption', null);
      this.directorHold = 9;
    }
  }

  // ---- input -----------------------------------------------------------------------------------

  input() {
    const cv = this.canvas;
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    let downAt = null;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      if (!this.world) return;
      cv.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      this.pointer = { x: e.offsetX, y: e.offsetY };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        this.painting = false;
        drag = null;
        return;
      }
      downAt = { x: e.offsetX, y: e.offsetY, t: performance.now(), button: e.button };
      const t = TOOL[this.tool];
      const panButton = e.button === 1 || e.button === 2 || this.tool === 'inspect';
      if (panButton) {
        drag = { x: e.offsetX, y: e.offsetY, moved: 0 };
        cv.classList.add('panning');
      } else if (t && t.mode === 'brush') {
        this.painting = true;
        this.R.cam.follow = null;
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.world) return;
      const p = { x: e.offsetX, y: e.offsetY };
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      this.pointer = p;
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.R.cam.zoomAt(d / pinch.d, cx, cy);
        this.R.cam.pan(cx - pinch.cx, cy - pinch.cy);
        pinch = { d, cx, cy };
        return;
      }
      if (drag) {
        const dx = p.x - drag.x, dy = p.y - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        this.R.cam.pan(dx, dy);
        drag.x = p.x; drag.y = p.y;
      }
      const [wx, wy] = this.R.cam.toWorld(p.x, p.y);
      const t = TOOL[this.tool];
      this.R.brush = t && t.id !== 'inspect' ? { x: wx, y: wy, r: t.mode === 'brush' || t.r ? (t.mode === 'brush' ? this.brush.r : (t.r || 2) * (t.id === 'meteor' ? 0.4 + this.brush.strength : 1)) : 0.8, color: t.cat === 'disaster' ? 'rgba(255,150,120,0.9)' : t.cat === 'wonder' ? 'rgba(200,170,255,0.9)' : undefined } : null;
      if (!drag && !this.painting) this.emit('hover', { x: wx, y: wy, sx: p.x, sy: p.y });
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      cv.classList.remove('panning');
      const wasDrag = drag && drag.moved > 5;
      drag = null;
      if (this.painting) { this.painting = false; return; }
      if (!downAt || wasDrag || !this.world) return;
      if (e.type === 'pointercancel') return;
      if (downAt.button !== 0 && !(downAt.button === undefined)) { downAt = null; return; }
      const [wx, wy] = this.R.cam.toWorld(e.offsetX, e.offsetY);
      const t = TOOL[this.tool];
      if (!t || t.id === 'inspect') {
        const sel = this.pickAt(wx, wy);
        this.select(sel);
      } else if (t.mode !== 'brush') {
        this.useToolAt(wx, wy);
      }
      downAt = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { this.R.brush = null; this.emit('hover', null); });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.world) return;
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      this.R.cam.zoomAt(f, e.offsetX, e.offsetY);
      this.R.cam.follow = null;
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      this.emit('key', e);
    });
  }
}

