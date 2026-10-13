// The game state and its rules engine. Pure logic — no DOM — so it runs in the browser, in unit
// tests and in the headless AI bench alike. The player's mouse and the AI's planner change the
// world only through `act*` methods; both play by exactly the same rules.

import { RNG } from '../core/rng.js';
import { CARDS } from '../data/cards.js';
import { TECHS } from '../data/techs.js';
import { eventsForBiome } from '../data/events.js';
import { personName } from '../data/names.js';
import { CARD_W, CARD_H, DAY_LEN, DUSK, NIGHT, DAWN_END, stackOffsets, MAX_PILE } from './constants.js';
import { updateTasks } from './tasks.js';
import { pick, release, canPick } from './drop.js';
import { updateBattles, maxHp, combatStats, damageMult } from './combat.js';
import { updateMobs, initMob, onNightfall, updateSpawnQueue } from './mobs.js';
import { dawn, nightSchedule } from './daycycle.js';
import { research, trade, buy, openCard, choose, techStatus, marketOffers } from './economy.js';
import { checkObjectives } from './objectives.js';
import { setupLevel } from './setup.js';

export const DEFAULT_RULES = {
  dayLen: DAY_LEN, seasons: true, seasonDays: 3, startSeason: 0, shades: false, shadeBase: 0, shadePerFog: 1 / 12,
  fogRate: 0, eventRate: 0.3, caravanEvery: 0, cold: false, winterAppetite: 1.5, enemyHp: 1, enemyAtk: 1, danger: 1,
  workSpeed: 1, dark: false, spoilMult: 1,
};

const PILEABLE = new Set(['resource', 'food', 'knowledge', 'coin', 'misc', 'tool', 'gear', 'bundle']);
const STICKY = new Set(['kill', 'explore', 'deliver', 'discover', 'made', 'trade', 'earn', 'survive', 'research', 'festival']);

export class Game {
  constructor(level, opts = {}) {
    this.level = level;
    this.rules = { ...DEFAULT_RULES, events: eventsForBiome(level.biome || 'valley'), ...(level.rules || {}) };
    if (opts.rules) Object.assign(this.rules, opts.rules);
    this.board = { w: level.board ? level.board[0] : 2600, h: level.board ? level.board[1] : 1800 };
    this.seen = opts.seen || null; // codex: card ids the player has ever seen (for scroll hints)
    this.events = [];
    this.lights = [];
    this._ver = 0;
    this._cache = {};
    this.listeners = [];
    if (opts.load) {
      this.s = opts.load.s;
      this.rng = new RNG(1);
      this.rng.s = opts.load.rng >>> 0;
    } else {
      const seed = opts.seed ?? level.seed ?? 1;
      this.rng = new RNG(seed);
      this.s = {
        v: 1, level: level.id, seed, t: 0, day: 1, nextId: 1, nextBattle: 1, z: 1, fog: this.rules.fog0 || 0,
        cards: {}, stacks: {}, battles: {}, tech: [...(level.techs || [])], techV: 0,
        disc: [], used: [], hints: {}, sched: [], spawnQ: [], flags: {}, log: [],
        stats: {
          made: {}, killsBy: {}, kills: 0, deaths: 0, born: 0, explored: 0, trades: 0, researched: 0, coinsEarned: 0,
          eaten: 0, events: 0, floods: 0, festivals: 0, maxPop: 0, maxFog: 0, actions: { player: 0, ai: 0 }, shades: 0, bosses: [],
        },
        objectives: (level.objectives || []).map((o) => ({ ...o, sticky: o.sticky ?? STICKY.has(o.type), done: false, cur: 0, need: 1 })),
        result: null, reason: '', season: undefined, nightDone: false, duskDone: false,
      };
      if (!this.s.tech.includes('fire') && !(level.noFire)) this.s.tech.push('fire');
    }
    this.techSet = new Set(this.s.tech);
    const self = this;
    this.ctx = {
      hasTech: (id) => self.techSet.has(id),
      isActive: (c) => self.isActive(c),
      get techVersion() { return self.s.techV; },
    };
    if (!opts.load) {
      setupLevel(this);
      this.s.season = this.season();
      this.s.stats.maxPop = this.population();
    }
    this.tickN = 0;
    this.auraT = 0;
    this.refreshLights();
  }

  // ------------------------------------------------------------ events & messages
  emit(e) {
    this.events.push(e);
    if (this.events.length > 4000) this.events.splice(0, 2000);
  }
  msg(text, kind = 'info') {
    const e = { t: this.s.t, day: this.s.day, text, kind };
    this.s.log.push(e);
    if (this.s.log.length > 240) this.s.log.splice(0, 60);
    this.emit({ type: 'msg', ...e });
  }
  /** take all queued events (UI, audio, renderer and AI consume these) */
  drain() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  // ------------------------------------------------------------ lookups
  card(id) { return this.s.cards[id]; }
  stack(id) { return this.s.stacks[id]; }
  stackOf(cardId) { const c = this.s.cards[cardId]; return c ? this.s.stacks[c.s] : null; }
  def(c) { return CARDS[typeof c === 'string' ? c : c.d]; }
  stackH(st) {
    const o = stackOffsets(st.cards.map((id) => this.s.cards[id].d));
    return o[o.length - 1] + CARD_H;
  }
  cardPos(c) {
    const st = this.s.stacks[c.s];
    if (!st) return { x: 0, y: 0 };
    const i = st.cards.indexOf(c.id);
    const o = stackOffsets(st.cards.map((id) => this.s.cards[id].d));
    return { x: st.x + CARD_W / 2, y: st.y + (o[i] || 0) + CARD_H / 2 };
  }
  countDef(id) {
    const k = 'count:' + id;
    return this.cached(k, () => {
      let n = 0;
      for (const c of Object.values(this.s.cards)) if (c.d === id) n++;
      return n;
    });
  }
  cached(key, fn) {
    const c = this._cache[key];
    if (c && c.v === this._ver && c.t === this.s.t) return c.val;
    const val = fn();
    this._cache[key] = { v: this._ver, t: this.s.t, val };
    return val;
  }
  everSeen(id) { return (this.seen && this.seen.has(id)) || !!this.s.stats.made[id]; }

  // ------------------------------------------------------------ cards & stacks
  newCard(d, props = {}) {
    const def = CARDS[d];
    if (!def) throw new Error('unknown card ' + d);
    const id = this.s.nextId++;
    const c = { id, d, s: 0 };
    if (def.kind === 'folk') {
      c.name = personName(this.rng);
      c.gear = {};
      c.st = {};
      c.kills = 0;
    }
    if (def.hp) c.hp = def.hp;
    if (def.fuelMax) c.fuel = def.fuelStart ?? def.fuelMax;
    if (def.node) c.ch = def.node.charges;
    if (def.region) c.ch = def.region.charges;
    if (def.spoil) c.sp = Math.max(1, Math.round(def.spoil * (this.rules.spoilMult || 1) * (this.techSet && this.techSet.has('storage') ? 1.5 : 1)));
    if (def.grows) c.age = 0;
    if (def.store) c.store = 0;
    if (def.stages) { c.stage = 0; c.prog = {}; }
    if (def.kind === 'structure' && def.hp) c.hp = maxHp(this, c);
    Object.assign(c, props);
    this.s.cards[id] = c;
    this._ver++;
    return c;
  }

  makeStack(cardIds, x, y) {
    const id = this.s.nextId++;
    const st = { id, cards: cardIds.slice(), x, y, task: null, battle: null, held: false, dirty: true, mob: false, z: ++this.s.z };
    for (const cid of cardIds) this.s.cards[cid].s = id;
    this.s.stacks[id] = st;
    this.clampStack(st);
    return st;
  }

  clampStack(st) {
    const h = this.stackH(st);
    st.x = Math.max(10, Math.min(this.board.w - CARD_W - 10, st.x));
    st.y = Math.max(10, Math.min(this.board.h - Math.min(h, 400) - 10, st.y));
  }

  /** split a stack so that `cardId` and everything above it form a new stack */
  detach(cardId) {
    const c = this.s.cards[cardId];
    const st = this.s.stacks[c.s];
    const i = st.cards.indexOf(cardId);
    if (i <= 0) {
      st.dirty = true;
      return st;
    }
    const o = stackOffsets(st.cards.map((id) => this.s.cards[id].d));
    const moved = st.cards.slice(i);
    st.cards = st.cards.slice(0, i);
    st.dirty = true;
    const ns = this.makeStack(moved, st.x, st.y + o[i]);
    return ns;
  }

  /** pull a single card out of its stack (closing the gap) into its own stack */
  extract(cardId) {
    const c = this.s.cards[cardId];
    const st = this.s.stacks[c.s];
    if (st.cards.length === 1) return st;
    const i = st.cards.indexOf(cardId);
    const o = stackOffsets(st.cards.map((id) => this.s.cards[id].d));
    st.cards.splice(i, 1);
    st.dirty = true;
    if (i === 0 && st.cards.length) {
      // the stack keeps its position; the root moved out
    }
    return this.makeStack([cardId], st.x, st.y + (o[i] || 0));
  }

  removeCard(id, why = 'remove') {
    const c = this.s.cards[id];
    if (!c) return;
    const st = this.s.stacks[c.s];
    const pos = this.cardPos(c);
    if (st) {
      st.cards = st.cards.filter((x) => x !== id);
      st.dirty = true;
      if (!st.cards.length) {
        if (st.battle) {
          const b = this.s.battles[st.battle];
          if (b) { b.a = b.a.filter((x) => x !== id); b.b = b.b.filter((x) => x !== id); }
        }
        delete this.s.stacks[st.id];
      }
    }
    delete this.s.cards[id];
    this._ver++;
    this.emit({ type: 'remove', id, d: c.d, why, x: pos.x, y: pos.y });
  }

  transform(c, to) {
    const from = c.d;
    const def = CARDS[to];
    const ratio = c.hp && CARDS[from].hp ? c.hp / maxHp(this, c) : 1;
    c.d = to;
    if (def.kind === 'folk') {
      c.gear = c.gear || {};
      c.st = c.st || {};
      c.name = c.name || personName(this.rng);
      c.kills = c.kills || 0;
    }
    if (def.hp) c.hp = Math.max(1, Math.round(maxHp(this, c) * Math.min(1, ratio || 1)));
    if (def.fuelMax && c.fuel === undefined) c.fuel = def.fuelStart ?? def.fuelMax;
    if (def.store && c.store === undefined) c.store = 0;
    if (def.node && c.ch === undefined) c.ch = def.node.charges;
    if (def.spoil) c.sp = Math.round(def.spoil * (this.hasTech('storage') ? 1.5 : 1));
    else delete c.sp;
    const st = this.s.stacks[c.s];
    if (st) st.dirty = true;
    this._ver++;
    this.emit({ type: 'transform', id: c.id, from, to });
  }

  spawn(d, from, opts = {}) {
    const def = CARDS[d];
    const src = from && from.cards ? { x: from.x + CARD_W / 2, y: from.y + CARD_H / 2 } : from || this.colonyCenter();
    const c = this.newCard(d, opts.props || {});
    if (opts.carry) {
      const o = opts.carry;
      for (const k of ['name', 'kills', 'bonusHp', 'xp']) if (o[k] !== undefined) c[k] = o[k];
      c.gear = { ...(o.gear || {}) };
      c.st = { ...(o.st || {}) };
      const ratio = o.hp / maxHp(this, o);
      c.hp = Math.max(1, Math.round(maxHp(this, c) * Math.min(1, ratio)));
    }
    if (def.kind === 'folk') this.s.stats.born += d === 'child' ? 1 : 0;
    // drop onto a matching pile nearby
    if (!opts.at && opts.pile !== false && PILEABLE.has(def.kind)) {
      let best = null, bd = 340;
      for (const st of Object.values(this.s.stacks)) {
        if (st.held || st.battle || st.mob || st.task || st.cards.length >= MAX_PILE) continue;
        if (!st.cards.every((id) => this.s.cards[id].d === d)) continue;
        const dd = Math.hypot(st.x + CARD_W / 2 - src.x, st.y + CARD_H / 2 - src.y);
        if (dd < bd) { bd = dd; best = st; }
      }
      if (best) {
        best.cards.push(c.id);
        c.s = best.id;
        best.dirty = true;
        this.emit({ type: 'spawn', id: c.id, d, fx: src.x, fy: src.y });
        return c;
      }
    }
    let x, y;
    if (opts.at) { x = opts.at.x; y = opts.at.y; }
    else {
      let bx = src.x - CARD_W / 2 + 128, by = src.y - CARD_H / 2;
      if (opts.near) {
        const ns = this.s.stacks[opts.near.s];
        if (ns) { bx = ns.x; by = ns.y + CARD_H + 30; }
      }
      const spot = this.freeSpot(bx, by, CARD_H);
      x = spot.x; y = spot.y;
    }
    const st = this.makeStack([c.id], x, y);
    if (def.mob) initMob(this, c);
    if (def.mob && def.kind === 'enemy') this.scaleEnemy(c);
    void st;
    this.emit({ type: 'spawn', id: c.id, d, fx: src.x, fy: src.y });
    return c;
  }

  scaleEnemy(c) {
    const def = CARDS[c.d];
    let mult = this.rules.enemyHp || 1;
    if (def.tags.includes('shade') && !def.traits.includes('boss')) mult *= 1 + this.s.fog / 150;
    c.mhp = Math.max(1, Math.round(def.hp * mult));
    c.hp = c.mhp;
  }

  spawnMob(d, x, y) {
    const c = this.newCard(d);
    this.makeStack([c.id], x, y);
    initMob(this, c);
    if (CARDS[d].kind === 'enemy') this.scaleEnemy(c);
    this.emit({ type: 'spawn', id: c.id, d, fx: x + CARD_W / 2, fy: y + CARD_H / 2, mob: true });
    return c;
  }
  initMob(c) { initMob(this, c); }

  freeSpot(x, y, h = CARD_H, opts = {}) {
    const ex = opts.exclude;
    const stacks = Object.values(this.s.stacks).filter((st) => st.id !== ex && !st.held && !st.mob);
    const hs = stacks.map((st) => this.stackH(st));
    const W = this.board.w, H = this.board.h;
    const free = (px, py) => {
      if (px < 10 || py < 10 || px > W - CARD_W - 10 || py > H - h - 10) return false;
      for (let i = 0; i < stacks.length; i++) {
        const st = stacks[i];
        if (px < st.x + CARD_W + 12 && px + CARD_W + 12 > st.x && py < st.y + hs[i] + 12 && py + h + 12 > st.y) return false;
      }
      return true;
    };
    if (free(x, y)) return { x, y };
    for (let ring = 1; ring <= 14; ring++) {
      const r = ring * 64;
      const n = ring * 8;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const px = x + Math.cos(a) * r * 1.25, py = y + Math.sin(a) * r;
        if (free(px, py)) return { x: px, y: py };
      }
    }
    return { x: Math.max(10, Math.min(W - CARD_W - 10, x)), y: Math.max(10, Math.min(H - h - 10, y)) };
  }

  /** keep stacks from piling up on each other (gentle pushes unless forced) */
  separate(force = false) {
    const list = Object.values(this.s.stacks).filter((st) => !st.held && !st.battle && !st.mob);
    const hs = new Map(list.map((st) => [st.id, this.stackH(st)]));
    const fixed = (st) => CARDS[this.s.cards[st.cards[0]].d].fixed;
    const cell = 240;
    const grid = new Map();
    for (const st of list) {
      const k = Math.floor(st.x / cell) + ',' + Math.floor(st.y / cell);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(st);
    }
    const push = force ? 0.55 : 0.18;
    for (const a of list) {
      const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 2; dy++) {
        for (const b of grid.get(gx + dx + ',' + (gy + dy)) || []) {
          if (b.id <= a.id) continue;
          const ah = hs.get(a.id), bh = hs.get(b.id);
          const ox = Math.min(a.x + CARD_W, b.x + CARD_W) - Math.max(a.x, b.x) + 6;
          const oy = Math.min(a.y + ah, b.y + bh) - Math.max(a.y, b.y) + 6;
          if (ox <= 0 || oy <= 0) continue;
          const fa = fixed(a), fb = fixed(b);
          if (fa && fb) continue;
          const wa = fa ? 0 : fb ? 1 : 0.5, wb = fb ? 0 : fa ? 1 : 0.5;
          if (ox < oy) {
            const s = a.x + CARD_W / 2 < b.x + CARD_W / 2 ? -1 : 1;
            const m = Math.min(ox, 40) * push;
            a.x += s * m * wa * 2;
            b.x -= s * m * wb * 2;
          } else {
            const s = a.y + ah / 2 < b.y + bh / 2 ? -1 : 1;
            const m = Math.min(oy, 40) * push;
            a.y += s * m * wa * 2;
            b.y -= s * m * wb * 2;
          }
        }
      }
    }
    for (const st of list) this.clampStack(st);
  }

  // ------------------------------------------------------------ people & health
  people() {
    return this.cached('people', () => Object.values(this.s.cards).filter((c) => CARDS[c.d].tags.includes('person')));
  }
  population() { return this.people().filter((c) => !CARDS[c.d].tags.includes('construct')).length; }
  housing() {
    return this.cached('housing', () => {
      let h = 0;
      for (const c of Object.values(this.s.cards)) h += CARDS[c.d].housing || 0;
      return h;
    });
  }
  isActive(c) {
    const d = CARDS[c.d];
    if (d.tags.includes('construct')) return (c.fuel || 0) > 0;
    return true;
  }
  maxHp(c) { return maxHp(this, c); }
  stats(c) { return combatStats(this, c); }
  dmgMult(as, ts) { return damageMult(as, ts); }
  heal(c, n) {
    const m = maxHp(this, c);
    if (c.hp >= m) return;
    c.hp = Math.min(m, c.hp + n);
    this.emit({ type: 'heal', id: c.id, n });
  }
  hurt(c, dmg, why = '', attacker = null) {
    if (!c || !this.s.cards[c.id]) return;
    c.hp = (c.hp ?? 1) - dmg;
    this.emit({ type: 'dmg', id: c.id, dmg });
    if (c.hp <= 0) this.die(c, why, attacker);
  }
  die(c, why, attacker) {
    const def = CARDS[c.d];
    const pos = this.cardPos(c);
    if (def.kind === 'folk') return this.killPerson(c, why || '倒下了');
    if (attacker && this.s.cards[attacker.id] && CARDS[attacker.d].kind === 'folk') {
      attacker.kills = (attacker.kills || 0) + 1;
      if (attacker.kills % 3 === 0 && attacker.kills <= 6) this.msg(`${attacker.name}身经百战，攻击力提升了。`, 'good');
    }
    if (def.kind === 'enemy' || def.kind === 'lair' || def.kind === 'beast') {
      this.s.stats.kills++;
      this.s.stats.killsBy[c.d] = (this.s.stats.killsBy[c.d] || 0) + 1;
      if (def.tags.includes('shade')) this.s.stats.shades++;
      if ((def.traits || []).includes('boss')) { this.s.stats.bosses.push(c.d); this.msg(`${def.name}被击败了！`, 'boss'); }
      if (def.kind === 'lair') this.msg(`${def.name}被摧毁了！`, 'good');
      const at = this.s.stacks[c.s];
      const from = at ? { x: at.x + CARD_W / 2, y: at.y + CARD_H / 2 } : pos;
      this.removeCard(c.id, 'death');
      for (const [id, n, p] of (def.mob && def.mob.loot) || []) {
        if (p !== undefined && !this.rng.chance(p)) continue;
        for (let i = 0; i < n; i++) this.spawn(id, from, {});
      }
      if (c.ai && c.ai.bag) for (const d of c.ai.bag) this.spawn(d, from, {});
      this.emit({ type: 'kill', d: c.d, x: from.x, y: from.y });
      return;
    }
    // structures (walls)
    this.removeCard(c.id, 'destroyed');
    this.msg(`${def.name}被摧毁了。`, 'danger');
  }
  killPerson(c, why) {
    const def = CARDS[c.d];
    const pos = this.cardPos(c);
    const st = this.s.stacks[c.s];
    const at = st ? { x: st.x, y: st.y } : { x: pos.x - CARD_W / 2, y: pos.y - CARD_H / 2 };
    const inBattle = st && st.battle;
    this.removeCard(c.id, 'death');
    this.s.stats.deaths++;
    this.msg(`${c.name || def.name}（${def.name}）${why}。`, 'death');
    this.emit({ type: 'death', d: c.d, name: c.name, x: pos.x, y: pos.y });
    if (!def.tags.includes('construct')) {
      const spot = inBattle ? this.freeSpot(at.x, at.y + 160, CARD_H) : this.freeSpot(at.x, at.y, CARD_H);
      this.spawn('grave', pos, { at: spot });
    }
  }
  isWarm(p) {
    if (p.gear) for (const gid of Object.values(p.gear)) if (gid && CARDS[gid].gear.warm) return true;
    const pos = this.cardPos(p);
    for (const L of this.lights) {
      if (!L.warm) continue;
      if (Math.hypot(L.x - pos.x, L.y - pos.y) <= L.r) return true;
    }
    const st = this.s.stacks[p.s];
    if (st && st.cards.some((id) => CARDS[this.s.cards[id].d].warmth)) return true;
    return false;
  }

  // ------------------------------------------------------------ time & light
  dayLen() { return this.rules.dayLen || DAY_LEN; }
  phase() { return (this.s.t % this.dayLen()) / this.dayLen(); }
  season() {
    if (!this.rules.seasons) return this.rules.season ?? 1;
    return ((this.rules.startSeason || 0) + Math.floor((this.s.day - 1) / (this.rules.seasonDays || 3))) % 4;
  }
  ambient() {
    if (this.rules.dark) return 0.06;
    if (this.s.flags.eclipse === this.s.day) return 0.04;
    if (this.rules.polarNight) return 0.1;
    const p = this.phase();
    if (p < DAWN_END) return 0.25 + 0.75 * (p / DAWN_END);
    if (p < DUSK) return 1;
    if (p < NIGHT) return 1 - (p - DUSK) / (NIGHT - DUSK);
    return 0;
  }
  isNight() { return this.ambient() < 0.5; }
  cardLight(c) {
    const def = CARDS[c.d];
    if (def.kind === 'enemy' || def.kind === 'lair') return 0;
    let L = def.light || 0;
    if (L && def.fuelMax && !(c.fuel > 0)) L = 0;
    if (L && def.tags.includes('construct') && !(c.fuel > 0)) L = 0;
    if (c.gear) for (const gid of Object.values(c.gear)) if (gid && CARDS[gid].gear.light) L = Math.max(L, CARDS[gid].gear.light);
    return L;
  }
  refreshLights() {
    const lights = [];
    for (const st of Object.values(this.s.stacks)) {
      if (st.held) continue;
      let best = 0, burn = 1, warm = false, struct = false;
      for (const id of st.cards) {
        const c = this.s.cards[id];
        const L = this.cardLight(c);
        if (L > best) best = L;
        const d = CARDS[c.d];
        if (L > 0 && d.burnShade) burn = Math.max(burn, d.burnShade);
        if (L > 0 && (d.tags.includes('fire') || d.warmth)) warm = true;
        if (L > 0 && (d.kind === 'structure' || d.kind === 'wonder')) struct = true;
      }
      for (const id of st.cards) if (CARDS[this.s.cards[id].d].warmth) warm = true;
      if (best > 0) lights.push({ x: st.x + CARD_W / 2, y: st.y + CARD_H / 2, r: best, sid: st.id, burn, warm, struct });
    }
    this.lights = lights;
  }
  lightAt(x, y) {
    let best = 0;
    for (const L of this.lights) {
      const d = Math.hypot(L.x - x, L.y - y);
      if (d < L.r) best = Math.max(best, 1 - d / L.r);
    }
    return best;
  }
  lightBurnAt(x, y) {
    let b = 1;
    for (const L of this.lights) if (Math.hypot(L.x - x, L.y - y) < L.r) b = Math.max(b, L.burn);
    return b;
  }
  nearestLight(x, y) {
    let best = null, bd = Infinity;
    for (const L of this.lights) {
      const d = Math.hypot(L.x - x, L.y - y) - L.r;
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  }
  stackLit(st) {
    if (this.ambient() >= 0.5) return true;
    return this.lightAt(st.x + CARD_W / 2, st.y + CARD_H / 2) > 0;
  }
  steamBoost(st) {
    for (const c of Object.values(this.s.cards)) {
      if (c.d !== 'steam_engine' || !(c.fuel > 0)) continue;
      const p = this.cardPos(c);
      if (Math.hypot(p.x - st.x - CARD_W / 2, p.y - st.y - CARD_H / 2) < CARDS.steam_engine.aura.radius) return true;
    }
    return false;
  }
  darkPulse(pos, r) {
    let best = null, bd = r;
    for (const c of Object.values(this.s.cards)) {
      const d = CARDS[c.d];
      if (!d.fuelMax || !(c.fuel > 0) || d.kind !== 'structure') continue;
      const p = this.cardPos(c);
      const dd = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (dd < bd) { bd = dd; best = c; }
    }
    if (best) {
      best.fuel = 0;
      this.msg(`黑暗的脉冲扑灭了${CARDS[best.d].name}！`, 'danger');
      this.emit({ type: 'snuff', id: best.id, big: true });
    }
  }
  colonyCenter() {
    return this.cached('cc', () => {
      let x = 0, y = 0, n = 0;
      for (const c of this.people()) {
        const st = this.s.stacks[c.s];
        if (!st || st.battle) continue;
        x += st.x + CARD_W / 2;
        y += st.y + CARD_H / 2;
        n++;
      }
      if (!n) {
        for (const L of this.lights) { x += L.x; y += L.y; n++; }
      }
      return n ? { x: x / n, y: y / n } : { x: this.board.w / 2, y: this.board.h / 2 };
    });
  }
  addFog(dv, why) {
    this.s.fog = Math.max(0, Math.min(100, this.s.fog + dv));
    this.s.stats.maxFog = Math.max(this.s.stats.maxFog, this.s.fog);
    if (why && dv) this.emit({ type: 'fog', dv, why });
  }

  // ------------------------------------------------------------ tech
  hasTech(id) { return this.techSet.has(id); }
  techAllowed(id) {
    const a = this.level.techAllowed;
    if (!a) return true;
    if (Array.isArray(a)) return a.includes(id) || this.level.techs?.includes(id);
    if (a.maxEra) return TECHS[id].era <= a.maxEra && !(a.not || []).includes(id);
    return true;
  }
  addTech(id) {
    if (this.techSet.has(id)) return;
    this.techSet.add(id);
    this.s.tech.push(id);
    this.s.techV++;
    for (const st of Object.values(this.s.stacks)) st.dirty = true;
  }
  techStatus(id) { return techStatus(this, id); }
  hasMerchant() { return this.countDef('merchant') > 0; }

  // ------------------------------------------------------------ inventory helpers (free = idle cards)
  isFree(c) {
    const st = this.s.stacks[c.s];
    if (!st || st.held || st.battle || st.mob) return false;
    if (st.task) {
      const m = st.task.m;
      if (m.consume.includes(c.id) || m.keep.includes(c.id) || m.workers.includes(c.id) || m.extra.includes(c.id) || m.aids.includes(c.id)) return false;
    }
    return true;
  }
  freeCards(k) {
    const out = [];
    const tag = k[0] === '#' ? k.slice(1) : null;
    for (const c of Object.values(this.s.cards)) {
      if (tag ? !CARDS[c.d].tags.includes(tag) : c.d !== k) continue;
      if (this.isFree(c)) out.push(c);
    }
    return out;
  }
  freeFood() {
    let n = 0;
    for (const c of Object.values(this.s.cards)) {
      const d = CARDS[c.d];
      if (d.food > 0 && this.isFree(c)) n += c.fl ?? d.food;
      if (d.store) n += c.store || 0;
    }
    return n;
  }
  totalFood() {
    let n = 0;
    for (const c of Object.values(this.s.cards)) {
      const d = CARDS[c.d];
      const st = this.s.stacks[c.s];
      if (d.food > 0 && st && !st.mob) n += c.fl ?? d.food;
      if (d.store) n += c.store || 0;
    }
    return n;
  }
  payFood(n, to) {
    const cards = Object.values(this.s.cards).filter((c) => CARDS[c.d].food > 0 && this.isFree(c));
    cards.sort((a, b) => (a.sp ?? 99) - (b.sp ?? 99) || CARDS[a.d].food - CARDS[b.d].food);
    for (const c of cards) {
      if (n <= 0) break;
      const left = c.fl ?? CARDS[c.d].food;
      const t = Math.min(n, left);
      n -= t;
      if (left - t <= 0) {
        if (to) this.emit({ type: 'payFly', d: c.d, from: this.cardPos(c), to });
        this.removeCard(c.id, 'pay');
      } else c.fl = left - t;
    }
    for (const c of Object.values(this.s.cards)) {
      if (n <= 0) break;
      if (!CARDS[c.d].store) continue;
      const t = Math.min(n, c.store || 0);
      c.store -= t;
      n -= t;
    }
  }
  coinValue() {
    let n = 0;
    for (const c of Object.values(this.s.cards)) {
      if (c.d !== 'coin' && c.d !== 'gold') continue;
      if (this.isFree(c)) n += c.d === 'gold' ? 10 : 1;
    }
    return n;
  }
  payCoins(n, to) {
    const coins = this.freeCards('coin');
    for (const c of coins) {
      if (n <= 0) break;
      if (to) this.emit({ type: 'payFly', d: 'coin', from: this.cardPos(c), to });
      this.removeCard(c.id, 'pay');
      n--;
    }
    if (n > 0) {
      for (const c of this.freeCards('gold')) {
        if (n <= 0) break;
        const at = this.cardPos(c);
        this.removeCard(c.id, 'pay');
        const change = 10 - n;
        n = Math.max(0, n - 10);
        for (let i = 0; i < change; i++) this.spawn('coin', at, {});
      }
    }
  }

  // ------------------------------------------------------------ actions (the player's hands and the AI's)
  actPick(cardId, who = 'player') {
    const r = pick(this, cardId);
    if (r.ok) this.s.stats.actions[who] = (this.s.stats.actions[who] || 0) + 1;
    return r;
  }
  actRelease(sid, x, y, targetSid) { return release(this, sid, x, y, targetSid); }
  canPick(cardId) { return canPick(this, this.s.cards[cardId]); }
  /** move a card (and everything above it) to a spot on the board */
  actMove(cardId, x, y, who = 'player') {
    const p = this.actPick(cardId, who);
    if (!p.ok) return p;
    return release(this, p.sid, x, y, null);
  }
  /** drop a card (and everything above it) onto the stack that holds `targetCardId` */
  actDrop(cardId, targetCardId, who = 'player') {
    const t = this.s.cards[targetCardId];
    if (!t) return { ok: false, why: '目标不存在' };
    const tst = this.s.stacks[t.s];
    if (!tst) return { ok: false, why: '目标不存在' };
    if (tst.cards.includes(cardId)) return { ok: false, why: '同一堆' };
    const p = this.actPick(cardId, who);
    if (!p.ok) return p;
    const tt = this.s.stacks[t.s];
    return release(this, p.sid, tt.x, tt.y + 30, tt.id);
  }
  actOpen(cardId, who = 'player') { const r = openCard(this, cardId); if (r.ok) this.s.stats.actions[who]++; return r; }
  actResearch(id, who = 'player') { const r = research(this, id); if (r.ok) this.s.stats.actions[who]++; return r; }
  actTrade(cardId, idx, who = 'player') { const r = trade(this, cardId, idx); if (r.ok) this.s.stats.actions[who]++; return r; }
  actBuy(marketId, offerId, who = 'player') { const r = buy(this, marketId, offerId); if (r.ok) this.s.stats.actions[who]++; return r; }
  actChoose(cardId, idx, who = 'player') { const r = choose(this, cardId, idx); if (r.ok) this.s.stats.actions[who]++; return r; }
  marketOffers() { return marketOffers(this); }

  /** topmost stack under a world point (for mouse drops) */
  stackAt(x, y, exclude = null) {
    let best = null;
    for (const st of Object.values(this.s.stacks)) {
      if (st.id === exclude || st.held) continue;
      const h = this.stackH(st);
      if (x >= st.x && x <= st.x + CARD_W && y >= st.y && y <= st.y + h) {
        if (!best || st.z > best.z) best = st;
      }
    }
    return best;
  }
  /** which card of a stack lies under a world point */
  cardAt(x, y) {
    const st = this.stackAt(x, y);
    if (!st) return null;
    const o = stackOffsets(st.cards.map((id) => this.s.cards[id].d));
    for (let i = st.cards.length - 1; i >= 0; i--) if (y >= st.y + o[i]) return this.s.cards[st.cards[i]];
    return this.s.cards[st.cards[0]];
  }

  // ------------------------------------------------------------ the loop
  finish(result, reason) {
    if (this.s.result) return;
    this.s.result = result;
    this.s.reason = reason;
    this.emit({ type: 'end', result, reason });
  }

  step(dt) {
    if (this.s.result) return;
    const s = this.s;
    s.t += dt;
    this.tickN++;
    const day = Math.floor(s.t / this.dayLen()) + 1;
    if (day > s.day) {
      s.day = day;
      s.nightDone = false;
      s.duskDone = false;
      dawn(this);
    }
    const ph = this.phase();
    if (!s.duskDone && ph >= DUSK - 0.04) {
      s.duskDone = true;
      this.emit({ type: 'dusk' });
    }
    if (!s.nightDone && ph >= NIGHT) {
      s.nightDone = true;
      onNightfall(this);
      nightSchedule(this);
      this.emit({ type: 'night' });
    }
    this.refreshLights();
    updateSpawnQueue(this);
    updateTasks(this, dt);
    updateMobs(this, dt);
    updateBattles(this, dt);
    this.auraT += dt;
    if (this.auraT >= 0.5) {
      this.auras(this.auraT);
      this.auraT = 0;
    }
    if (this.tickN % 2 === 0) this.separate();
    if (this.tickN % 4 === 0) checkObjectives(this);
  }

  auras(dt) {
    for (const st of Object.values(this.s.stacks)) {
      if (st.mob) continue;
      for (const id of st.cards) {
        const c = this.s.cards[id];
        if (!c) continue;
        const d = CARDS[c.d];
        if (d.aura && d.aura.heal) {
          c.auraT = (c.auraT || 0) + dt;
          if (c.auraT >= d.aura.every) {
            c.auraT = 0;
            for (const oid of st.cards) {
              const o = this.s.cards[oid];
              if (!o || !CARDS[o.d].tags.includes('person')) continue;
              if (d.kind === 'structure' && o.st && o.st.sick) { o.st.sick = 0; this.emit({ type: 'cure', id: o.id }); }
              this.heal(o, d.aura.heal);
            }
          }
        }
        if (d.tower && c.fuel > 0) {
          c.towerT = (c.towerT || 0) + dt;
          if (c.towerT >= d.tower.spd) {
            const p = this.cardPos(c);
            let tgt = null, bd = d.tower.range;
            for (const e of Object.values(this.s.cards)) {
              const ed = CARDS[e.d];
              if (ed.kind !== 'enemy') continue;
              const ep = this.cardPos(e);
              const dd = Math.hypot(ep.x - p.x, ep.y - p.y);
              if (dd < bd) { bd = dd; tgt = e; }
            }
            if (tgt) {
              c.towerT = 0;
              const as = { atk: d.tower.atk, dmg: 'pierce', ranged: true };
              const ts = combatStats(this, tgt);
              const dmg = Math.max(1, Math.round(as.atk * damageMult(as, ts)) - ts.def);
              this.emit({ type: 'shot', from: c.id, t: tgt.id, dmg });
              this.hurt(tgt, dmg, '');
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ persistence
  toJSON() {
    return { v: 1, level: this.level.id, spec: this.level.spec || null, rng: this.rng.s, s: this.s };
  }
  static fromJSON(level, data, opts = {}) {
    return new Game(level, { ...opts, load: data });
  }
}
