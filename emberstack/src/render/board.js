// The board view: camera, painted ground, every card with smooth motion and flips, status overlays,
// the light-and-darkness layer, weather, fog, effects and the AI's "ember spirit" hand.

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';
import { CARD_W, CARD_H, stackOffsets, STACK_DY } from '../sim/constants.js';
import { blockReason } from '../sim/tasks.js';
import { GREAT_FLAME_STAGES } from '../sim/drop.js';
import { makeCanvas } from './paint.js';
import { cardSprite, FACE, FONT_BODY, FONT_NUM } from './cardface.js';
import { drawIcon } from './icons.js';
import { paintGround, paintSnow } from './ground.js';
import { FX } from './fx.js';

const TAU = Math.PI * 2;
const SHADOW = (() => {
  if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
  const c = makeCanvas(160, 200);
  const g = c.getContext('2d');
  g.filter = 'blur(9px)';
  g.fillStyle = 'rgba(12,6,2,0.55)';
  g.beginPath();
  g.roundRect ? g.roundRect(25, 25, 110, 150, 10) : g.rect(25, 25, 110, 150);
  g.fill();
  return c;
})();

const BLOCK_ICON = { 太暗了: 'sun', 等待夜晚: 'moon', 冬季休眠: 'snow', 等待恢复: 'leaf', 需要镐: 'pick', 需要光源: 'sun', 需要舟: 'boat', 房屋已满: 'house' };
const SPOIL_WHY = new Set(['absorb', 'consume', 'pay', 'research', 'sell', 'eat']);

export class BoardView {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.dpr = 1;
    this.w = 1;
    this.h = 1;
    this.cam = { x: 1300, y: 900, z: 0.6 };
    this.camT = { x: 1300, y: 900, z: 0.6 };
    this.autoCam = true;
    this.views = new Map();
    this.ghosts = [];
    this.spawnFrom = new Map();
    this.removeWhy = new Map();
    this.fx = new FX();
    this.hoverSid = null;
    this.drop = null; // { sid, ok }
    this.selected = null;
    this.time = 0;
    this.speed = 1;
    this.dark = makeCanvas(2, 2);
    this.hand = { x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, t: 1, dur: 0.3, vis: 0, tap: 0, card: null };
    this.weather = [];
    this.flood = 0;
    this.meteors = [];
    this.lowFx = false;
    this.showHand = true;
    this.lastSeason = -1;
  }

  // ------------------------------------------------------------------ setup
  setGame(game) {
    this.game = game;
    this.views.clear();
    this.ghosts.length = 0;
    this.spawnFrom.clear();
    this.fx.clear();
    this.weather.length = 0;
    const c = game.colonyCenter();
    this.biome = game.level.biome || 'valley';
    this.ground = paintGround(this.biome, game.board.w, game.board.h, c, hash(game.level.id));
    this.snow = this.biome === 'tundra' ? null : paintSnow(game.board.w, game.board.h, hash(game.level.id) + 1);
    this.cam.x = this.camT.x = c.x;
    this.cam.y = this.camT.y = c.y;
    this.fitColony(true);
    this.hand.x = this.hand.tx = c.x;
    this.hand.y = this.hand.ty = c.y;
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.dark.width = Math.max(2, Math.round(w * 0.5));
    this.dark.height = Math.max(2, Math.round(h * 0.5));
  }

  // ------------------------------------------------------------------ camera
  worldToScreen(x, y) { return { x: (x - this.cam.x) * this.cam.z + this.w / 2, y: (y - this.cam.y) * this.cam.z + this.h / 2 }; }
  screenToWorld(sx, sy) { return { x: (sx - this.w / 2) / this.cam.z + this.cam.x, y: (sy - this.h / 2) / this.cam.z + this.cam.y }; }
  zoomLimits() { return { min: Math.max(0.18, Math.min(this.w / this.game.board.w, this.h / this.game.board.h) * 0.9), max: 2.2 }; }
  zoomAt(sx, sy, f) {
    const L = this.zoomLimits();
    const before = this.screenToWorld(sx, sy);
    const z = Math.max(L.min, Math.min(L.max, this.camT.z * f));
    this.camT.z = this.cam.z = z;
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.camT.x = this.cam.x;
    this.camT.y = this.cam.y;
    this.clampCam();
  }
  pan(dx, dy) {
    this.cam.x -= dx / this.cam.z;
    this.cam.y -= dy / this.cam.z;
    this.camT.x = this.cam.x;
    this.camT.y = this.cam.y;
    this.clampCam();
  }
  clampCam() {
    const B = this.game.board;
    for (const c of [this.cam, this.camT]) {
      c.x = Math.max(0, Math.min(B.w, c.x));
      c.y = Math.max(0, Math.min(B.h, c.y));
    }
  }
  /** frame the colony (all non-hostile stacks near the people) */
  fitColony(instant = false) {
    const g = this.game;
    if (!g) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const cc = g.colonyCenter();
    for (const st of Object.values(g.s.stacks)) {
      if (st.mob && !st.battle) continue;
      const cx = st.x + CARD_W / 2, cy = st.y + CARD_H / 2;
      if (Math.hypot(cx - cc.x, cy - cc.y) > 1300) continue;
      x0 = Math.min(x0, st.x);
      y0 = Math.min(y0, st.y);
      x1 = Math.max(x1, st.x + CARD_W);
      y1 = Math.max(y1, st.y + Math.min(400, g.stackH(st)));
    }
    if (!isFinite(x0)) return;
    const pad = 140;
    const L = this.zoomLimits();
    const z = Math.max(L.min, Math.min(1.05, Math.min(this.w / (x1 - x0 + pad * 2), (this.h - 120) / (y1 - y0 + pad * 2))));
    this.camT.x = (x0 + x1) / 2;
    this.camT.y = (y0 + y1) / 2 - 20 / z;
    this.camT.z = z;
    if (instant) Object.assign(this.cam, this.camT);
  }

  // ------------------------------------------------------------------ events
  onEvents(evs) {
    const g = this.game;
    for (const e of evs) {
      switch (e.type) {
        case 'spawn':
          this.spawnFrom.set(e.id, { x: e.fx, y: e.fy, mob: e.mob });
          if (e.mob) this.fx.burst(e.fx, e.fy, 'smoke', 10, { speed: 60, size: 10, life: 1, color: 'rgba(40,30,50,1)' });
          break;
        case 'remove':
          this.removeWhy.set(e.id, e.why);
          break;
        case 'craft': {
          this.fx.burst(e.x, e.y, 'star', 14, { speed: 150, size: 7, life: 0.7 });
          this.fx.ring(e.x, e.y, 20, 110, 'rgba(255,220,140,1)', 0.55, 5);
          if (e.fx === 'smoke' || e.fx === 'fire') this.fx.burst(e.x, e.y - 20, 'smoke', 8, { speed: 30, size: 9, life: 1.4 });
          break;
        }
        case 'discover': {
          const st = g.s.stacks[e.sid];
          if (st) {
            const x = st.x + CARD_W / 2, y = st.y + CARD_H / 2;
            this.fx.burst(x, y, 'star', 40, { speed: 260, size: 10, life: 1.4, color: 'rgba(255,230,140,1)' });
            this.fx.ring(x, y, 30, 260, 'rgba(255,230,150,1)', 1.1, 8);
            this.fx.text(x, y - 120, '发现隐藏配方！', '#ffe08a', 26, { life: 2.2 });
          }
          break;
        }
        case 'hit': {
          const t = g.s.cards[e.t], a = g.s.cards[e.a];
          const tv = this.views.get(e.t), av = this.views.get(e.a);
          if (tv) {
            tv.hit = 1;
            tv.shake = 0.35;
            const x = tv.x + CARD_W / 2, y = tv.y + 40;
            this.fx.text(x + (Math.random() - 0.5) * 30, y, (e.crit ? '暴击 ' : '') + '-' + e.dmg, e.crit ? '#ffb040' : e.kind === 'light' ? '#ffe9a0' : '#ff7060', e.crit ? 30 : 24);
            const kind = t && CARDS[t.d].traits && CARDS[t.d].traits.includes('shade') ? 'smoke' : t && CARDS[t.d].kind === 'folk' ? 'blood' : 'spark';
            this.fx.burst(x, y + 20, kind, 7, { speed: 130, size: kind === 'smoke' ? 6 : 4, life: 0.5, color: kind === 'smoke' ? 'rgba(60,40,80,1)' : null });
            if (e.kind === 'light') this.fx.burst(x, y + 20, 'star', 6, { speed: 90, size: 6, life: 0.5 });
          }
          if (av && tv) {
            const dx = tv.x - av.x, dy = tv.y - av.y, d = Math.hypot(dx, dy) || 1;
            if (e.ranged) this.fx.beam(av.x + CARD_W / 2, av.y + 30, tv.x + CARD_W / 2, tv.y + 40, '#e8dcc0', 0.22);
            else { av.lx = (dx / d) * 26; av.ly = (dy / d) * 26; }
          }
          if (a && CARDS[a.d].traits && CARDS[a.d].traits.includes('boss')) this.fx.kick(3);
          break;
        }
        case 'miss': {
          const tv = this.views.get(e.t);
          if (tv) this.fx.text(tv.x + CARD_W / 2, tv.y + 30, '闪避', '#d8d8d8', 18, { life: 0.8 });
          break;
        }
        case 'shot': {
          const fv = this.views.get(e.from), tv = this.views.get(e.t);
          if (fv && tv) this.fx.beam(fv.x + CARD_W / 2, fv.y + 10, tv.x + CARD_W / 2, tv.y + 40, '#f0e0c0', 0.25);
          break;
        }
        case 'dmg': {
          const v = this.views.get(e.id);
          if (v) { v.hit = 1; this.fx.text(v.x + CARD_W / 2, v.y + 40, '-' + e.dmg, '#ff7060', 22); }
          break;
        }
        case 'heal': {
          const v = this.views.get(e.id);
          if (v) { this.fx.text(v.x + CARD_W / 2, v.y + 30, '+' + e.n, '#9ae08a', 20, { life: 1 }); this.fx.burst(v.x + CARD_W / 2, v.y + 60, 'star', 4, { speed: 40, size: 5, color: 'rgba(160,240,140,1)', life: 0.8 }); }
          break;
        }
        case 'cold': {
          const v = this.views.get(e.id);
          if (v) { v.hit = 0.7; this.fx.burst(v.x + CARD_W / 2, v.y + 40, 'snow', 10, { speed: 60, size: 5, life: 1 }); this.fx.text(v.x + CARD_W / 2, v.y + 20, '寒冷', '#bfe0ff', 18); }
          break;
        }
        case 'death':
          this.fx.burst(e.x, e.y, 'ash', 30, { speed: 70, size: 4, life: 1.6 });
          this.fx.text(e.x, e.y - 60, '✝ ' + (e.name || CARDS[e.d].name), '#d8d0c0', 22, { life: 2.2, vy: -20 });
          break;
        case 'kill':
          this.fx.burst(e.x, e.y, 'smoke', 14, { speed: 80, size: 9, life: 1, color: 'rgba(40,30,30,1)' });
          this.fx.burst(e.x, e.y, 'spark', 16, { speed: 220, size: 5, life: 0.6 });
          if (CARDS[e.d].traits && CARDS[e.d].traits.includes('boss')) { this.fx.kick(14); this.fx.flashScreen('255,230,170', 0.6); this.fx.ring(e.x, e.y, 40, 420, 'rgba(255,220,150,1)', 1.4, 10); }
          break;
        case 'battleStart':
          this.fx.ring(e.x, e.y, 30, 200, 'rgba(255,90,60,1)', 0.6, 6);
          this.fx.kick(2);
          break;
        case 'battleEnd':
          if (e.won) this.fx.burst(e.x, e.y, 'star', 18, { speed: 160, size: 7, life: 0.9 });
          break;
        case 'sell':
          this.fx.burst(e.x, e.y, 'coin', Math.min(14, 2 + e.v), { speed: 160, size: 6, life: 0.9, up: 160 });
          this.fx.text(e.x, e.y - 50, '+' + e.v + ' 铜贝', '#ffd860', 20);
          break;
        case 'fuel':
          this.fx.burst(e.x, e.y - 30, 'ember', 16, { speed: 90, size: 5, life: 1 });
          break;
        case 'store': case 'deliver': case 'equip':
          this.fx.burst(e.x, e.y, 'star', 8, { speed: 90, size: 6, life: 0.6 });
          break;
        case 'stage':
          this.fx.burst(e.x, e.y, 'ember', 50, { speed: 260, size: 7, life: 1.6 });
          this.fx.ring(e.x, e.y, 40, 380, 'rgba(255,170,80,1)', 1.3, 10);
          this.fx.kick(8);
          break;
        case 'festival':
          for (let i = 0; i < 5; i++) this.fx.burst(e.x + (Math.random() - 0.5) * 200, e.y - 120 - Math.random() * 120, 'star', 16, { speed: 170, size: 6, life: 1.2, color: ['rgba(255,120,120,1)', 'rgba(255,220,120,1)', 'rgba(140,220,255,1)'][i % 3] });
          break;
        case 'open': case 'trade':
          if (e.x !== undefined) this.fx.burst(e.x, e.y, 'star', 12, { speed: 140, size: 6, life: 0.7 });
          break;
        case 'snuff': {
          const c = g.s.cards[e.id], v = this.views.get(e.id);
          if (c && v) this.fx.burst(v.x + CARD_W / 2, v.y + 40, 'smoke', e.big ? 30 : 14, { speed: 70, size: 12, life: 1.6, color: 'rgba(30,24,30,1)' });
          if (e.big) this.fx.kick(5);
          break;
        }
        case 'fireOut': {
          const v = this.views.get(e.id);
          if (v) this.fx.burst(v.x + CARD_W / 2, v.y + 40, 'smoke', 10, { speed: 40, size: 10, life: 1.4 });
          break;
        }
        case 'meteor':
          this.meteors.push({ x: e.x, y: e.y, t: 0 });
          break;
        case 'flood':
          this.flood = 2.5;
          this.fx.kick(6);
          break;
        case 'summon': {
          const v = this.views.get(e.id);
          const b = this.views.get(e.by);
          if (b) this.fx.burst(b.x + CARD_W / 2, b.y + 60, 'smoke', 16, { speed: 90, size: 10, life: 1.2, color: 'rgba(40,20,40,1)' });
          if (v) v.flash = 1;
          break;
        }
        case 'ambush': {
          this.fx.text(e.x, e.y - 90, '伏击！', '#ff6050', 28, { life: 1.6 });
          this.fx.kick(4);
          break;
        }
        case 'hand':
          this.onHand(e);
          break;
        case 'transform': {
          const v = this.views.get(e.id);
          if (v) { v.flipP = 0; this.fx.burst(v.x + CARD_W / 2, v.y + 70, 'leaf', 8, { speed: 80, size: 5, life: 0.9 }); }
          break;
        }
        case 'research':
          this.fx.flashScreen('180,200,255', 0.25);
          break;
        case 'cure': {
          const v = this.views.get(e.id);
          if (v) this.fx.text(v.x + CARD_W / 2, v.y + 30, '痊愈', '#9ae08a', 18);
          break;
        }
        case 'burn': {
          const v = this.views.get(e.id);
          if (v) { this.fx.burst(v.x + CARD_W / 2, v.y + 60, 'ember', 10, { speed: 80, size: 5, life: 0.8 }); v.hit = 1; }
          break;
        }
        default:
          break;
      }
    }
  }

  onHand(e) {
    const h = this.hand;
    h.fx = h.x;
    h.fy = h.y;
    if (h.vis < 0.2) { h.fx = e.from.x; h.fy = e.from.y; }
    h.tx = e.to.x;
    h.ty = e.to.y;
    h.t = 0;
    h.dur = Math.max(0.06, 0.34 / Math.max(1, this.speed));
    h.vis = 1;
    h.tap = e.tap ? 1 : 0;
    h.card = e.id;
    h.from2 = e.from;
  }

  // ------------------------------------------------------------------ per-frame update
  update(dt) {
    const g = this.game;
    this.time += dt;
    // camera
    if (this.autoCam && Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) this.fitColony();
    const kc = 1 - Math.exp(-dt * 3);
    this.cam.x += (this.camT.x - this.cam.x) * kc;
    this.cam.y += (this.camT.y - this.cam.y) * kc;
    this.cam.z += (this.camT.z - this.cam.z) * kc;

    // card views follow their simulation positions
    const seen = new Set();
    for (const st of Object.values(g.s.stacks)) {
      const defs = st.cards.map((id) => g.s.cards[id].d);
      const off = stackOffsets(defs);
      const k = st.held ? 1 : 1 - Math.exp(-dt * (st.mob ? 9 : 15));
      for (let i = 0; i < st.cards.length; i++) {
        const id = st.cards[i];
        seen.add(id);
        const tx = st.x, ty = st.y + off[i];
        let v = this.views.get(id);
        if (!v) {
          const src = this.spawnFrom.get(id);
          this.spawnFrom.delete(id);
          v = { x: tx, y: ty, s: 1, flipP: 1, a: 1, hit: 0, shake: 0, lx: 0, ly: 0, flash: 0 };
          if (src) {
            v.x = src.x - CARD_W / 2;
            v.y = src.y - CARD_H / 2;
            v.s = src.mob ? 0.6 : 0.3;
            v.flipP = src.mob ? 1 : 0;
            v.a = src.mob ? 0 : 1;
          } else if (this.time > 0.5) {
            v.s = 0.6;
            v.a = 0;
          }
          this.views.set(id, v);
        }
        const kk = st.held ? 1 : v.s < 0.95 ? 1 - Math.exp(-dt * 8) : k;
        v.x += (tx - v.x) * kk;
        v.y += (ty - v.y) * kk;
        v.s += (1 - v.s) * (1 - Math.exp(-dt * 8));
        v.a += (1 - v.a) * (1 - Math.exp(-dt * 6));
        if (v.flipP < 1) v.flipP = Math.min(1, v.flipP + dt * 2.6);
        v.hit = Math.max(0, v.hit - dt * 3);
        v.flash = Math.max(0, v.flash - dt * 2);
        v.shake = Math.max(0, v.shake - dt);
        v.lx *= Math.exp(-dt * 10);
        v.ly *= Math.exp(-dt * 10);
        v.sid = st.id;
      }
    }
    // removed cards become ghosts
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.views.delete(id);
      const c = { id };
      const why = this.removeWhy.get(id) || 'remove';
      this.removeWhy.delete(id);
      const d = v.d;
      if (!d) continue;
      const life = why === 'death' ? 0.9 : SPOIL_WHY.has(why) ? 0.28 : 0.45;
      this.ghosts.push({ ...v, ...c, d, why, life, max: life });
      if (!SPOIL_WHY.has(why) && why !== 'death') this.fx.burst(v.x + CARD_W / 2, v.y + CARD_H / 2, 'smoke', 6, { speed: 40, size: 9, life: 0.8 });
    }
    for (const [id, v] of this.views) v.d = g.s.cards[id] && g.s.cards[id].d;
    this.ghosts = this.ghosts.filter((gh) => (gh.life -= dt) > 0);
    if (this.removeWhy.size > 400) this.removeWhy.clear();

    // AI hand
    const h = this.hand;
    if (h.t < 1) {
      h.t = Math.min(1, h.t + dt / h.dur);
      const e = h.t < 0.5 ? 2 * h.t * h.t : 1 - Math.pow(-2 * h.t + 2, 2) / 2;
      h.x = h.fx + (h.tx - h.fx) * e;
      h.y = h.fy + (h.ty - h.fy) * e - Math.sin(h.t * Math.PI) * 40;
    } else h.vis = Math.max(0, h.vis - dt * 0.35);
    h.tap = Math.max(0, h.tap - dt * 2);

    this.fx.update(dt);
    this.updateWeather(dt);
    this.flood = Math.max(0, this.flood - dt);
    for (const m of this.meteors) {
      m.t += dt;
      if (m.t > 0.6 && !m.hit) {
        m.hit = true;
        this.fx.kick(12);
        this.fx.flashScreen('255,240,200', 0.7);
        this.fx.burst(m.x, m.y, 'ember', 60, { speed: 360, size: 8, life: 1.4 });
        this.fx.burst(m.x, m.y, 'smoke', 30, { speed: 120, size: 16, life: 2 });
        this.fx.ring(m.x, m.y, 20, 360, 'rgba(255,200,120,1)', 1, 10);
      }
    }
    this.meteors = this.meteors.filter((m) => m.t < 1.2);
  }

  updateWeather(dt) {
    const g = this.game;
    const season = g.season();
    const want = this.lowFx ? 0 : this.biome === 'tundra' || season === 3 ? 140 : this.biome === 'ash' ? 110 : season === 2 && (this.biome === 'forest' || this.biome === 'valley') ? 26 : g.isNight() && season === 1 && this.biome !== 'isles' ? 30 : this.biome === 'marsh' && g.s.flags.storm ? 160 : 0;
    const kind = this.biome === 'ash' ? 'ash' : this.biome === 'tundra' || season === 3 ? 'snow' : season === 2 ? 'leaf' : this.biome === 'marsh' && g.s.flags.storm ? 'rain' : 'firefly';
    while (this.weather.length < want) this.weather.push(newFlake(kind, this.w, this.h, true));
    if (this.weather.length > want) this.weather.length = want;
    for (const p of this.weather) {
      if (p.kind !== kind) Object.assign(p, newFlake(kind, this.w, this.h, false));
      p.t += dt;
      p.x += (p.vx + Math.sin(p.t * p.f + p.ph) * p.sway) * dt;
      p.y += p.vy * dt;
      if (p.y > this.h + 20 || p.x < -30 || p.x > this.w + 30 || (p.kind === 'firefly' && p.t > p.life)) Object.assign(p, newFlake(kind, this.w, this.h, false));
    }
  }

  // ------------------------------------------------------------------ drawing
  draw() {
    const g = this.g, G = this.game, dpr = this.dpr, z = this.cam.z;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#120c08';
    g.fillRect(0, 0, this.cv.width, this.cv.height);
    const sh = this.fx.shake;
    const sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
    const ox = this.w / 2 - this.cam.x * z + sx, oy = this.h / 2 - this.cam.y * z + sy;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    const view = { x0: this.cam.x - this.w / 2 / z - CARD_W, y0: this.cam.y - this.h / 2 / z - 420, x1: this.cam.x + this.w / 2 / z + 20, y1: this.cam.y + this.h / 2 / z + 20 };

    // ground and season
    g.imageSmoothingEnabled = true;
    g.drawImage(this.ground.canvas, 0, 0, G.board.w, G.board.h);
    const season = G.season();
    if (season === 3 && this.snow) {
      g.globalAlpha = 0.85;
      g.drawImage(this.snow.canvas, 0, 0, G.board.w, G.board.h);
      g.globalAlpha = 1;
    } else if (season === 2 && this.biome !== 'tundra' && this.biome !== 'ash') {
      g.fillStyle = 'rgba(190,110,30,0.13)';
      g.fillRect(0, 0, G.board.w, G.board.h);
    } else if (season === 1 && this.biome !== 'tundra' && this.biome !== 'ash') {
      g.fillStyle = 'rgba(255,220,120,0.05)';
      g.fillRect(0, 0, G.board.w, G.board.h);
    }

    // steam engine aura
    for (const c of Object.values(G.s.cards)) {
      if (c.d === 'steam_engine' && c.fuel > 0) {
        const v = this.views.get(c.id);
        if (v) {
          g.beginPath();
          g.arc(v.x + CARD_W / 2, v.y + CARD_H / 2, CARDS.steam_engine.aura.radius, 0, TAU);
          g.setLineDash([12, 10]);
          g.strokeStyle = 'rgba(255,220,160,0.25)';
          g.lineWidth = 3;
          g.stroke();
          g.setLineDash([]);
        }
      }
    }

    // battles: dusty arena under the fighters
    for (const b of Object.values(G.s.battles)) {
      const r = 150 + 30 * Math.max(b.a.length, b.b.length);
      const gr = g.createRadialGradient(b.x, b.y, 10, b.x, b.y, r);
      gr.addColorStop(0, 'rgba(120,40,20,0.35)');
      gr.addColorStop(1, 'rgba(120,40,20,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(b.x, b.y, r, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(b.x, b.y - 30, r * 0.85, 0, TAU);
      g.setLineDash([6, 9]);
      g.lineDashOffset = -this.time * 30;
      g.strokeStyle = 'rgba(255,110,70,0.45)';
      g.lineWidth = 3;
      g.stroke();
      g.setLineDash([]);
    }

    // stacks
    const stacks = Object.values(G.s.stacks).sort((a, b) => (a.held ? 1e9 : a.z) - (b.held ? 1e9 : b.z));
    const scale = z * dpr;
    for (const st of stacks) {
      const v0 = this.views.get(st.cards[0]);
      if (!v0) continue;
      const vt = this.views.get(st.cards[st.cards.length - 1]);
      if (v0.x > view.x1 || v0.x < view.x0 || v0.y > view.y1 || vt.y < view.y0 - 200) continue;
      this.drawStack(g, st, scale);
    }
    // ghosts
    for (const gh of this.ghosts) this.drawGhost(g, gh, scale);
    // task bars and labels above stacks
    for (const st of stacks) this.drawStackHud(g, st);

    // meteors (before darkness so the impact is lit by its own glow later)
    for (const m of this.meteors) {
      if (m.t < 0.6) {
        const t = m.t / 0.6;
        const x = m.x + (1 - t) * 600, y = m.y - (1 - t) * 900;
        g.strokeStyle = 'rgba(255,230,180,0.9)';
        g.lineWidth = 10;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 120, y - 180);
        g.stroke();
      }
    }

    // darkness
    g.setTransform(1, 0, 0, 1, 0, 0);
    const amb = G.ambient();
    this.drawDarkness(g, amb);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    this.drawGlows(g, amb);
    this.fx.draw(g, z);
    this.drawHand(g);

    // screen-space layers
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawWeather(g, amb);
    this.drawFogEdge(g);
    if (this.flood > 0) {
      g.fillStyle = `rgba(60,110,140,${Math.min(0.45, this.flood * 0.2)})`;
      g.fillRect(0, 0, this.w, this.h);
    }
    if (this.fx.flash > 0) {
      g.fillStyle = `rgba(${this.fx.flashColor},${this.fx.flash})`;
      g.fillRect(0, 0, this.w, this.h);
    }
  }

  drawStack(g, st, scale) {
    const G = this.game;
    const n = st.cards.length;
    const v0 = this.views.get(st.cards[0]), vt = this.views.get(st.cards[n - 1]);
    const lift = st.held ? 14 : 0;
    // shadow
    if (SHADOW) {
      const h = vt.y - v0.y + CARD_H;
      g.globalAlpha = Math.min(v0.a, 1) * (st.held ? 0.8 : 1);
      g.drawImage(SHADOW, v0.x - 25 + 4 + lift, v0.y - 25 + 7 + lift * 1.4, CARD_W + 50, h + 50);
      g.globalAlpha = 1;
    }
    // hover / drop highlight
    const hl = this.drop && this.drop.sid === st.id ? (this.drop.ok ? 'rgba(140,255,150,0.9)' : 'rgba(255,110,90,0.9)') : this.hoverSid === st.id ? 'rgba(255,224,150,0.85)' : null;
    if (hl) {
      g.save();
      g.shadowColor = hl;
      g.shadowBlur = 18;
      g.strokeStyle = hl;
      g.lineWidth = 4;
      roundRect(g, v0.x - 3, v0.y - 3, CARD_W + 6, vt.y - v0.y + CARD_H + 6, 9);
      g.stroke();
      g.restore();
    }
    if (st.battle) {
      g.save();
      g.shadowColor = 'rgba(255,60,40,0.9)';
      g.shadowBlur = 14 + Math.sin(this.time * 8) * 4;
      g.strokeStyle = 'rgba(255,90,60,0.7)';
      g.lineWidth = 3;
      roundRect(g, v0.x - 2, v0.y - 2, CARD_W + 4, vt.y - v0.y + CARD_H + 4, 9);
      g.stroke();
      g.restore();
    }
    const defs = st.cards.map((id) => G.s.cards[id].d);
    for (let i = 0; i < n; i++) {
      const id = st.cards[i];
      const c = G.s.cards[id];
      const v = this.views.get(id);
      if (!v) continue;
      const vis = i === n - 1 ? CARD_H : defs[i + 1] === defs[i] ? 9 : STACK_DY;
      this.drawCard(g, c, v, scale, st.held ? 1.035 : 1, lift);
      this.drawCardOverlay(g, c, v, i === n - 1, vis, st);
    }
  }

  drawCard(g, c, v, scale, s0 = 1, lift = 0) {
    const s = v.s * s0;
    const sh = v.shake > 0 ? Math.sin(this.time * 70) * 6 * v.shake : 0;
    const x = v.x + v.lx + sh - lift * 0.3, y = v.y + v.ly - lift;
    const back = v.flipP < 0.5;
    const fx = back ? 1 - v.flipP * 2 : v.flipP * 2 - 1;
    const spr = cardSprite(back ? '#back' : c.d, scale * s);
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, v.a));
    g.translate(x + CARD_W / 2, y + CARD_H / 2);
    g.scale(s * Math.max(0.02, fx), s);
    g.drawImage(spr, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
    if (v.hit > 0) {
      g.globalAlpha = v.hit * 0.45;
      g.fillStyle = '#ff3020';
      roundRect(g, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 7);
      g.fill();
    }
    if (v.flash > 0) {
      g.globalAlpha = v.flash * 0.6;
      g.fillStyle = '#fff4d8';
      roundRect(g, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 7);
      g.fill();
    }
    g.restore();
    if (this.selected === c.id) {
      g.strokeStyle = 'rgba(255,236,170,0.95)';
      g.lineWidth = 3;
      roundRect(g, x - 2, y - 2, CARD_W + 4, CARD_H + 4, 8);
      g.stroke();
    }
  }

  drawGhost(g, gh, scale) {
    const t = gh.life / gh.max;
    const spr = cardSprite(gh.d, scale * 0.8);
    g.save();
    g.globalAlpha = t;
    const cx = gh.x + CARD_W / 2, cy = gh.y + CARD_H / 2;
    g.translate(cx, cy);
    if (gh.why === 'death') {
      g.rotate((1 - t) * 0.25);
      g.filter = 'grayscale(1)';
      if (Math.random() < 0.6) this.fx.burst(cx + (Math.random() - 0.5) * CARD_W, cy + (Math.random() - 0.5) * CARD_H, 'ash', 1, { speed: 30, size: 4, life: 1 });
    }
    const s = gh.why === 'death' ? 1 : 0.4 + 0.6 * t;
    g.scale(s, s);
    g.drawImage(spr, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
    g.restore();
  }

  /** dynamic information drawn over a card face */
  drawCardOverlay(g, c, v, top, vis, st) {
    if (v.flipP < 1 || v.a < 0.5) return;
    const def = CARDS[c.d];
    const G = this.game;
    const x = v.x + v.lx, y = v.y + v.ly - (st.held ? 14 : 0);
    const maxHp = def.hp || def.kind === 'folk' ? G.maxHp(c) : 0;
    if (!top) {
      // covered card: thin health bar under the name ribbon
      if (maxHp && c.hp < maxHp && vis >= 20) bar(g, x + 26, y + 22.5, 76, 3, c.hp / maxHp, hpColor(c.hp / maxHp));
      return;
    }
    const A = FACE.art;
    const by = A.y + A.h - 4; // chip baseline inside the art window
    let lx = x + A.x + 3;
    const chip = (icon, text, color) => {
      g.font = `bold 10px ${FONT_NUM}`;
      const w = 15 + g.measureText(text).width;
      g.fillStyle = 'rgba(24,14,8,0.78)';
      roundRect(g, lx, y + by - 12, w, 13, 6.5);
      g.fill();
      drawIcon(g, icon, lx + 6.5, y + by - 5.5, 9, color);
      g.fillStyle = '#f6e8c8';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(text, lx + 12.5, y + by - 5);
      lx += w + 3;
    };
    if (def.fuelMax) chip('flame', `${Math.ceil(c.fuel || 0)}/${def.fuelMax}`, c.fuel > 0 ? null : '#6a6a6a');
    if ((def.node || def.region) && c.ch >= 0) chip('cycle', String(c.ch));
    if (c.sp !== undefined && def.spoil) chip('hourglass', c.sp + '天', c.sp <= 1 ? '#e86a4a' : null);
    if (def.store) chip('bowl', `${c.store || 0}/${def.store.cap}`);
    if (def.grows) chip('leaf', `${Math.floor(c.age || 0)}/${def.grows.days}`);
    if (def.stages && c.stage < GREAT_FLAME_STAGES.length) {
      const sg = GREAT_FLAME_STAGES[c.stage];
      const need = Object.entries(sg.need);
      const have = need.reduce((a, [k]) => a + Math.min(sg.need[k], (c.prog && c.prog[k]) || 0), 0);
      const tot = need.reduce((a, [, n]) => a + n, 0);
      chip('flame', `${sg.name} ${have}/${tot}`);
    }
    if (c.offers && def.kind === 'event') chip('coin', '交易');
    if (c.ev) chip('eye', '待决');
    // health
    if (maxHp && (c.hp < maxHp || def.kind === 'enemy' || st.battle)) {
      const f = Math.max(0, c.hp / maxHp);
      g.fillStyle = 'rgba(24,14,8,0.78)';
      roundRect(g, x + A.x + 3, y + A.y + A.h - 22, A.w - 6, 7, 3.5);
      g.fill();
      bar(g, x + A.x + 4.5, y + A.y + A.h - 20.5, A.w - 9, 4, f, hpColor(f));
      g.font = `bold 8px ${FONT_NUM}`;
      g.fillStyle = '#fff';
      g.textAlign = 'right';
      g.fillText(`${Math.ceil(c.hp)}`, x + A.x + A.w - 4, y + A.y + A.h - 27);
    }
    // people: name, status, gear
    if (def.kind === 'folk' && c.name) {
      g.font = `9px ${FONT_BODY}`;
      const w = g.measureText(c.name).width + 8;
      g.fillStyle = 'rgba(244,232,204,0.88)';
      roundRect(g, x + A.x + 3, y + A.y + 3, w, 12, 3);
      g.fill();
      g.fillStyle = '#2a1a0e';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(c.name, x + A.x + 7, y + A.y + 9.5);
      let sx = x + A.x + 3 + w + 3;
      if (c.st && c.st.hungry) { drawIcon(g, 'bowl', sx + 5, y + A.y + 9, 10, '#e86a4a'); sx += 12; }
      if (c.st && c.st.sick) { drawIcon(g, 'plus', sx + 5, y + A.y + 9, 9, '#8ac04a'); sx += 12; }
      let gx = x + A.x + A.w - 8;
      if (c.gear) for (const slot of ['weapon', 'armor', 'trinket']) {
        const gid = c.gear[slot];
        if (!gid) continue;
        g.fillStyle = 'rgba(24,14,8,0.7)';
        g.beginPath();
        g.arc(gx, y + A.y + 9, 6.5, 0, TAU);
        g.fill();
        drawIcon(g, slot === 'weapon' ? 'sword' : slot === 'armor' ? 'shield' : 'spark', gx, y + A.y + 9, 10);
        gx -= 15;
      }
    }
  }

  drawStackHud(g, st) {
    const G = this.game;
    const v0 = this.views.get(st.cards[0]);
    if (!v0 || st.held) return;
    if (st.task) {
      const r = RECIPES[st.task.r];
      const x = v0.x, y = v0.y - 22;
      const blocked = st.task.bt > 0.4 ? blockReason(G, st, r, st.task.m) : null;
      g.fillStyle = 'rgba(28,18,10,0.85)';
      roundRect(g, x, y, CARD_W, 16, 8);
      g.fill();
      g.strokeStyle = blocked ? 'rgba(200,100,80,0.9)' : 'rgba(230,190,120,0.9)';
      g.lineWidth = 1.2;
      g.stroke();
      if (!blocked) {
        const p = Math.min(1, st.task.p);
        const gr = g.createLinearGradient(x, 0, x + CARD_W, 0);
        gr.addColorStop(0, '#e8a040');
        gr.addColorStop(1, '#ffe08a');
        g.fillStyle = gr;
        roundRect(g, x + 2.5, y + 2.5, (CARD_W - 5) * p, 11, 5.5);
        g.fill();
      }
      g.font = `bold 10px ${FONT_BODY}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const label = blocked ? blocked : r.name;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(28,18,10,0.9)';
      g.strokeText(label, x + CARD_W / 2 + (blocked ? 6 : 0), y + 8.5);
      g.fillStyle = blocked ? '#ffb8a0' : '#fff6dc';
      g.fillText(label, x + CARD_W / 2 + (blocked ? 6 : 0), y + 8.5);
      if (blocked) drawIcon(g, BLOCK_ICON[blocked] || 'lock', x + CARD_W / 2 - g.measureText(label).width / 2 - 4, y + 8, 11);
    }
  }

  drawDarkness(g, amb) {
    const G = this.game;
    const night = 1 - amb;
    const dusk = G.rules.dark ? 0 : Math.max(0, 1 - Math.abs(G.phase() - 0.74) / 0.06);
    if (night < 0.02 && dusk <= 0) return;
    const d = this.dark, dg = d.getContext('2d');
    const k = d.width / this.w;
    dg.setTransform(1, 0, 0, 1, 0, 0);
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, d.width, d.height);
    const a = Math.min(0.9, night * 0.88);
    dg.fillStyle = `rgba(8,10,26,${a})`;
    dg.fillRect(0, 0, d.width, d.height);
    dg.globalCompositeOperation = 'destination-out';
    const z = this.cam.z;
    for (const L of G.lights) {
      const st = G.s.stacks[L.sid];
      const v = st && this.views.get(st.cards[0]);
      const wx = v ? v.x + CARD_W / 2 : L.x, wy = v ? v.y + CARD_H / 2 : L.y;
      const p = this.worldToScreen(wx, wy);
      const fl = L.warm ? 1 + 0.035 * Math.sin(this.time * 9 + L.sid) + 0.02 * Math.sin(this.time * 23 + L.sid * 3) : 1;
      const r = L.r * z * fl * k;
      const sx = p.x * k, sy = p.y * k;
      if (sx < -r || sy < -r || sx > d.width + r || sy > d.height + r) continue;
      const gr = dg.createRadialGradient(sx, sy, r * 0.05, sx, sy, r);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0.88)');
      gr.addColorStop(0.85, 'rgba(0,0,0,0.35)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr;
      dg.beginPath();
      dg.arc(sx, sy, r, 0, TAU);
      dg.fill();
    }
    g.drawImage(d, 0, 0, this.cv.width, this.cv.height);
    // warm firelight bloom
    g.globalCompositeOperation = 'lighter';
    for (const L of G.lights) {
      if (!L.warm && !L.struct) continue;
      const st = G.s.stacks[L.sid];
      const v = st && this.views.get(st.cards[0]);
      const wx = v ? v.x + CARD_W / 2 : L.x, wy = v ? v.y + CARD_H / 2 : L.y;
      const p = this.worldToScreen(wx, wy);
      const r = L.r * z * 0.7 * this.dpr;
      const fl = 0.9 + 0.1 * Math.sin(this.time * 11 + L.sid);
      const gr = g.createRadialGradient(p.x * this.dpr, p.y * this.dpr, 0, p.x * this.dpr, p.y * this.dpr, r);
      const col = L.warm ? '255,150,60' : '200,210,255';
      gr.addColorStop(0, `rgba(${col},${0.22 * night * fl})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.fillRect(p.x * this.dpr - r, p.y * this.dpr - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
    if (dusk > 0) {
      g.fillStyle = `rgba(230,110,40,${0.16 * dusk})`;
      g.fillRect(0, 0, this.cv.width, this.cv.height);
    }
  }

  /** things that glow through the dark: shade eyes, flames, crystals */
  drawGlows(g, amb) {
    const G = this.game;
    const night = 1 - amb;
    if (night < 0.2) return;
    for (const st of Object.values(G.s.stacks)) {
      if (!st.mob) continue;
      const c = G.s.cards[st.cards[0]];
      const def = CARDS[c.d];
      if (def.kind !== 'enemy') continue;
      const v = this.views.get(c.id);
      if (!v) continue;
      const shadeish = def.traits.includes('shade') || def.mob.nocturnal;
      if (!shadeish) continue;
      const x = v.x + CARD_W / 2, y = v.y + 58;
      const col = def.id.startsWith('frost') ? '140,210,255' : def.id.startsWith('ash') ? '255,130,50' : def.traits.includes('shade') ? '200,150,255' : '255,210,90';
      const blink = Math.sin(this.time * 1.3 + c.id) > 0.97 ? 0.1 : 1;
      for (const dx of [-7, 7]) {
        const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, 9);
        gr.addColorStop(0, `rgba(${col},${0.95 * night * blink})`);
        gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr;
        g.fillRect(x + dx - 9, y - 9, 18, 18);
      }
    }
    // flame flicker particles above lit fires
    if (!this.lowFx && Math.random() < 0.5) {
      for (const L of G.lights) {
        if (!L.warm || Math.random() > 0.25) continue;
        const st = G.s.stacks[L.sid];
        const v = st && this.views.get(st.cards[0]);
        if (v) this.fx.burst(v.x + CARD_W / 2 + (Math.random() - 0.5) * 40, v.y + 50, 'ember', 1, { speed: 30, size: 3, life: 1.2, angle: -Math.PI / 2, spread: 0.8, jitter: 4 });
      }
    }
  }

  drawHand(g) {
    const h = this.hand;
    if (!this.showHand || h.vis <= 0.01) return;
    const z = this.cam.z;
    const s = 1 / Math.max(0.5, Math.min(1.3, z));
    g.save();
    g.globalAlpha = Math.min(1, h.vis * 1.4);
    // trail
    if (h.t < 1) {
      g.strokeStyle = 'rgba(255,190,90,0.35)';
      g.lineWidth = 6 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(h.fx, h.fy);
      g.quadraticCurveTo((h.fx + h.x) / 2, (h.fy + h.y) / 2 - 30, h.x, h.y);
      g.stroke();
    }
    const r = 15 * s;
    const gr = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, r * 3);
    gr.addColorStop(0, 'rgba(255,210,120,0.9)');
    gr.addColorStop(0.3, 'rgba(255,150,60,0.45)');
    gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(h.x, h.y, r * 3, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(h.x, h.y, r * 0.55, 0, TAU);
    g.fillStyle = '#fff2c8';
    g.fill();
    g.beginPath();
    g.arc(h.x, h.y, r + Math.sin(this.time * 6) * 2 * s, 0, TAU);
    g.strokeStyle = 'rgba(255,230,170,0.85)';
    g.lineWidth = 2 * s;
    g.stroke();
    if (h.tap > 0) {
      g.beginPath();
      g.arc(h.x, h.y, r + (1 - h.tap) * 40 * s, 0, TAU);
      g.strokeStyle = `rgba(255,230,170,${h.tap})`;
      g.lineWidth = 3 * s;
      g.stroke();
    }
    g.font = `bold ${11 * s}px ${FONT_BODY}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3 * s;
    g.strokeStyle = 'rgba(30,16,8,0.9)';
    g.strokeText('AI', h.x, h.y - r - 9 * s);
    g.fillStyle = '#ffe2a0';
    g.fillText('AI', h.x, h.y - r - 9 * s);
    g.restore();
  }

  drawWeather(g, amb) {
    for (const p of this.weather) {
      switch (p.kind) {
        case 'snow':
          g.fillStyle = 'rgba(250,252,255,0.85)';
          g.beginPath();
          g.arc(p.x, p.y, p.size, 0, TAU);
          g.fill();
          break;
        case 'ash':
          g.fillStyle = p.hot ? `rgba(255,140,60,${0.8 * (0.5 + 0.5 * Math.sin(p.t * 5 + p.ph))})` : 'rgba(80,72,70,0.75)';
          g.fillRect(p.x, p.y, p.size, p.size);
          break;
        case 'leaf':
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.t * p.f);
          g.fillStyle = p.color;
          g.beginPath();
          g.ellipse(0, 0, p.size * 1.6, p.size * 0.7, 0, 0, TAU);
          g.fill();
          g.restore();
          break;
        case 'rain':
          g.strokeStyle = 'rgba(190,210,230,0.45)';
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - 4, p.y - 16);
          g.stroke();
          break;
        case 'firefly': {
          const a = Math.max(0, Math.sin((p.t / p.life) * Math.PI)) * (0.5 + 0.5 * Math.sin(p.t * 4 + p.ph)) * (1 - amb);
          const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7);
          gr.addColorStop(0, `rgba(220,255,140,${a})`);
          gr.addColorStop(1, 'rgba(220,255,140,0)');
          g.fillStyle = gr;
          g.fillRect(p.x - 7, p.y - 7, 14, 14);
          break;
        }
        default:
          break;
      }
    }
  }

  drawFogEdge(g) {
    const fog = this.game.s.fog || 0;
    if (fog < 3) return;
    const f = Math.min(1, fog / 100);
    const cx = this.w / 2, cy = this.h / 2, R = Math.hypot(cx, cy);
    const gr = g.createRadialGradient(cx, cy, R * (0.95 - f * 0.55), cx, cy, R);
    gr.addColorStop(0, 'rgba(150,145,160,0)');
    gr.addColorStop(1, `rgba(150,145,160,${0.25 + f * 0.6})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, this.w, this.h);
    // drifting wisps
    const n = Math.round(4 + f * 10);
    for (let i = 0; i < n; i++) {
      const t = this.time * (0.02 + (i % 3) * 0.01) + i * 0.37;
      const x = ((Math.sin(t) * 0.5 + 0.5) * 1.4 - 0.2) * this.w;
      const y = ((i * 0.618) % 1) * this.h;
      const rr = 160 + (i % 4) * 60;
      const edge = Math.min(1, Math.max(Math.abs(x - cx) / cx, Math.abs(y - cy) / cy));
      const a = f * 0.22 * edge;
      if (a < 0.01) continue;
      const wg = g.createRadialGradient(x, y, 0, x, y, rr);
      wg.addColorStop(0, `rgba(170,165,180,${a})`);
      wg.addColorStop(1, 'rgba(170,165,180,0)');
      g.fillStyle = wg;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }

  /** stack id and card under a screen point */
  pickAt(sx, sy) {
    const p = this.screenToWorld(sx, sy);
    const G = this.game;
    let best = null;
    for (const st of Object.values(G.s.stacks)) {
      if (st.held) continue;
      const v0 = this.views.get(st.cards[0]), vt = this.views.get(st.cards[st.cards.length - 1]);
      if (!v0 || !vt) continue;
      if (p.x >= v0.x && p.x <= v0.x + CARD_W && p.y >= v0.y && p.y <= vt.y + CARD_H) if (!best || st.z > best.z) best = st;
    }
    if (!best) return null;
    let card = best.cards[0];
    for (let i = best.cards.length - 1; i >= 0; i--) {
      const v = this.views.get(best.cards[i]);
      if (p.y >= v.y) { card = best.cards[i]; break; }
    }
    return { st: best, card, wx: p.x, wy: p.y };
  }
}

function newFlake(kind, w, h, anywhere) {
  const p = { kind, t: 0, ph: Math.random() * 6, f: 0.5 + Math.random() * 1.5, x: Math.random() * w, y: anywhere ? Math.random() * h : -10, life: 4 + Math.random() * 4 };
  switch (kind) {
    case 'snow': return Object.assign(p, { vx: -8 + Math.random() * 6, vy: 30 + Math.random() * 40, sway: 14, size: 1 + Math.random() * 2.2 });
    case 'ash': return Object.assign(p, { vx: 14 + Math.random() * 10, vy: 12 + Math.random() * 22, sway: 10, size: 1.5 + Math.random() * 2, hot: Math.random() < 0.25 });
    case 'leaf': return Object.assign(p, { vx: 20 + Math.random() * 20, vy: 30 + Math.random() * 30, sway: 30, size: 2.5 + Math.random() * 2, color: ['#c87a2a', '#a85a22', '#d8a040'][Math.floor(Math.random() * 3)] });
    case 'rain': return Object.assign(p, { vx: 80, vy: 600 + Math.random() * 200, sway: 0, size: 1 });
    case 'firefly': return Object.assign(p, { y: Math.random() * h, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 16, sway: 12, size: 2 });
    default: return Object.assign(p, { vx: 0, vy: 0, sway: 0, size: 1 });
  }
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function bar(g, x, y, w, h, f, color) {
  g.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(g, x, y, w, h, h / 2);
  g.fill();
  g.fillStyle = color;
  roundRect(g, x, y, Math.max(h, w * Math.max(0, Math.min(1, f))), h, h / 2);
  g.fill();
}

function hpColor(f) { return f > 0.6 ? '#7ac85a' : f > 0.3 ? '#e8c040' : '#e85a40'; }

function hash(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
