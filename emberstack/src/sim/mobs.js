// Creatures on the board: grazing beasts, hunting wolves, light-shy shades, thieving bandits,
// slumbering bosses and the lairs that keep spawning more of them.

import { CARDS } from '../data/cards.js';
import { CARD_W, CARD_H } from './constants.js';
import { startBattle, joinBattle } from './combat.js';

const CONTACT = 78;

function center(st) { return { x: st.x + CARD_W / 2, y: st.y + CARD_H / 2 }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function moveToward(g, st, tx, ty, speed, dt) {
  const c = center(st);
  const dx = tx - c.x, dy = ty - c.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return 0;
  const step = Math.min(d, speed * dt);
  st.x += (dx / d) * step;
  st.y += (dy / d) * step;
  return d - step;
}

function hasPerson(g, st) {
  for (const id of st.cards) if (CARDS[g.s.cards[id].d].tags.includes('person')) return true;
  return false;
}

/** nearest stack matching a predicate */
function nearest(g, from, pred, maxD = Infinity) {
  let best = null, bd = maxD;
  for (const st of Object.values(g.s.stacks)) {
    if (st.held || st.mob) continue;
    if (!pred(st)) continue;
    const d = dist(from, center(st));
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}

export function initMob(g, c) {
  const st = g.s.stacks[c.s];
  st.mob = true;
  const p = center(st);
  c.ai = c.ai || { m: 'idle', hx: p.x, hy: p.y, t: g.rng.next() * 3, tx: p.x, ty: p.y, tg: 0, act: false, bag: [], kids: [] };
}

function engage(g, mob, target) {
  // walls first: if a guard structure stands near the target, the mob has to break through it
  if (target.battle) {
    const b = g.s.battles[target.battle];
    if (b) { joinBattle(g, b, mob.id, 'b'); return; }
  }
  const mc = center(g.s.stacks[mob.s]);
  const tc = center(target);
  const b = startBattle(g, (mc.x + tc.x) / 2, (mc.y + tc.y) / 2 + 40);
  const defenders = target.cards.filter((id) => {
    const d = CARDS[g.s.cards[id].d];
    return d.tags.includes('person') || (d.kind === 'structure' && d.guard);
  });
  for (const id of defenders) joinBattle(g, b, id, 'a');
  joinBattle(g, b, mob.id, 'b');
  // pack members nearby join in
  for (const st of Object.values(g.s.stacks)) {
    if (!st.mob || st.battle || st.cards.length !== 1) continue;
    const c = g.s.cards[st.cards[0]];
    const d = CARDS[c.d];
    if (d.kind !== 'enemy' || c.id === mob.id) continue;
    if (dist(center(st), mc) < 170) joinBattle(g, b, c.id, 'b');
  }
  g.emit({ type: 'ambush', id: mob.id, x: tc.x, y: tc.y });
}

function guardIntercept(g, mob, pos) {
  for (const st of Object.values(g.s.stacks)) {
    if (st.mob || st.held) continue;
    const root = g.s.cards[st.cards[0]];
    const d = CARDS[root.d];
    if (!d.guard) continue;
    if (dist(pos, center(st)) < d.guard) return st;
  }
  return null;
}

function leave(g, st, c, speed, dt) {
  // run for the nearest board edge and vanish there
  const p = center(st);
  const W = g.board.w, H = g.board.h;
  const opts = [[p.x, -200], [p.x, H + 200], [-200, p.y], [W + 200, p.y]];
  opts.sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.y) - Math.hypot(b[0] - p.x, b[1] - p.y));
  moveToward(g, st, opts[0][0], opts[0][1], speed, dt);
  if (st.x < -CARD_W - 40 || st.y < -CARD_H - 40 || st.x > W + 40 || st.y > H + 40) {
    g.removeCard(c.id, 'leave');
    return true;
  }
  return false;
}

function wander(g, st, c, speed, dt, radius = 160) {
  const ai = c.ai;
  ai.t -= dt;
  if (ai.t <= 0) {
    ai.t = 3 + g.rng.next() * 4;
    const a = g.rng.next() * Math.PI * 2;
    const r = g.rng.next() * radius;
    ai.tx = Math.max(60, Math.min(g.board.w - 60, ai.hx + Math.cos(a) * r));
    ai.ty = Math.max(80, Math.min(g.board.h - 80, ai.hy + Math.sin(a) * r));
  }
  moveToward(g, st, ai.tx, ai.ty, speed * 0.45, dt);
}

export function updateMobs(g, dt) {
  const night = g.isNight();
  const bright = g.ambient() >= 0.5;
  for (const st of Object.values(g.s.stacks)) {
    if (!st.mob || st.held) continue;
    if (st.cards.length !== 1) continue; // a stacked beast (being tamed) stands still
    const c = g.s.cards[st.cards[0]];
    const def = CARDS[c.d];
    const mob = def.mob;
    if (!mob || !c.ai) continue;
    const ai = c.ai;
    const pos = center(st);
    const speed = mob.speed * (g.rules.enemySpeed || 1);

    // shades suffer in light even while fighting
    if ((def.tags.includes('shade')) && !def.traits.includes('boss') && def.kind === 'enemy') {
      const lit = g.lightAt(pos.x, pos.y);
      let burn = 0;
      if (bright && !g.rules.dark) burn = 3;
      else if (lit > 0) burn = 1.4 * (1 + lit) * g.lightBurnAt(pos.x, pos.y);
      if (burn > 0) {
        c.burnAcc = (c.burnAcc || 0) + burn * dt;
        if (c.burnAcc >= 1) {
          const n = Math.floor(c.burnAcc);
          c.burnAcc -= n;
          g.emit({ type: 'burn', id: c.id });
          g.hurt(c, n, '');
          if (!g.s.cards[c.id]) continue;
        }
      }
    }
    if (st.battle) continue;

    switch (mob.beh) {
      case 'flee': {
        const threat = nearest(g, pos, (s) => hasPerson(g, s), 140);
        if (threat) {
          const tc = center(threat);
          const dx = pos.x - tc.x, dy = pos.y - tc.y;
          const d = Math.hypot(dx, dy) || 1;
          ai.hx = Math.max(80, Math.min(g.board.w - 80, pos.x + (dx / d) * 200));
          ai.hy = Math.max(100, Math.min(g.board.h - 100, pos.y + (dy / d) * 200));
          moveToward(g, st, ai.hx, ai.hy, speed, dt);
        } else wander(g, st, c, speed, dt);
        break;
      }
      case 'wander':
      case 'neutral':
        wander(g, st, c, speed, dt);
        break;
      case 'hunter': {
        if (mob.nocturnal && !night && !g.rules.dark) {
          leave(g, st, c, speed, dt);
          break;
        }
        ai.t -= dt;
        let target = ai.tg ? g.s.stacks[ai.tg] : null;
        if (ai.t <= 0 || !target || target.held) {
          ai.t = 1;
          target = nearest(g, pos, (s) => hasPerson(g, s), ai.raid ? Infinity : mob.aggro * (night ? 1.6 : 1));
          ai.tg = target ? target.id : 0;
        }
        if (!target) { wander(g, st, c, speed, dt, 260); break; }
        const wall = guardIntercept(g, c, pos);
        if (wall && !hasPerson(g, wall)) {
          if (dist(pos, center(wall)) < CONTACT + 20) { engage(g, c, wall); break; }
          moveToward(g, st, center(wall).x, center(wall).y, speed, dt);
          break;
        }
        const tc = center(target);
        if (moveToward(g, st, tc.x, tc.y, speed, dt) < CONTACT) engage(g, c, target);
        break;
      }
      case 'shade': {
        if (bright && !g.rules.dark && !def.traits.includes('boss')) break; // burning away
        // flee from light
        const lit = g.lightAt(pos.x, pos.y);
        if (lit > 0) {
          const L = g.nearestLight(pos.x, pos.y);
          if (L) {
            const dx = pos.x - L.x, dy = pos.y - L.y;
            const d = Math.hypot(dx, dy) || 1;
            moveToward(g, st, pos.x + (dx / d) * 120, pos.y + (dy / d) * 120, speed * 1.2, dt);
          }
          break;
        }
        ai.t -= dt;
        let target = ai.tg ? g.s.stacks[ai.tg] : null;
        if (ai.t <= 0 || !target || target.held || g.stackLit(target)) {
          ai.t = 0.8;
          target = nearest(g, pos, (s) => !g.stackLit(s) && (hasPerson(g, s) || CARDS[g.s.cards[s.cards[0]].d].kind === 'structure'), 1100);
          ai.tg = target ? target.id : 0;
        }
        if (!target) { wander(g, st, c, speed, dt, 300); break; }
        const tc = center(target);
        // never step into light while approaching
        const nx = pos.x + Math.sign(tc.x - pos.x) * 30, ny = pos.y + Math.sign(tc.y - pos.y) * 30;
        if (g.lightAt(nx, ny) > 0 && dist(pos, tc) > CONTACT) { wander(g, st, c, speed, dt, 120); break; }
        if (moveToward(g, st, tc.x, tc.y, speed, dt) < CONTACT) {
          if (hasPerson(g, target)) engage(g, c, target);
          else {
            // gnaws at an unlit structure: snuff its fire
            const root = g.s.cards[target.cards[0]];
            if (root.fuel > 0) { root.fuel = Math.max(0, root.fuel - 1); g.emit({ type: 'snuff', id: root.id }); }
            ai.tg = 0;
            ai.t = 2;
          }
        }
        break;
      }
      case 'raider': {
        if (ai.bag && ai.bag.length >= 3) {
          if (leave(g, st, c, speed * 1.1, dt)) g.msg('盗匪带着赃物逃走了。', 'danger');
          break;
        }
        ai.t -= dt;
        let target = ai.tg ? g.s.stacks[ai.tg] : null;
        if (ai.t <= 0 || !target || target.held) {
          ai.t = 1;
          target = nearest(g, pos, (s) => !s.battle && s.cards.some((id) => {
            const d = CARDS[g.s.cards[id].d];
            return d.kind === 'coin' || (d.food > 0);
          }));
          ai.tg = target ? target.id : 0;
        }
        if (!target) {
          const p = nearest(g, pos, (s) => hasPerson(g, s));
          if (p) { const tc = center(p); if (moveToward(g, st, tc.x, tc.y, speed, dt) < CONTACT) engage(g, c, p); }
          break;
        }
        const tc = center(target);
        if (moveToward(g, st, tc.x, tc.y, speed, dt) < CONTACT) {
          if (hasPerson(g, target)) { engage(g, c, target); break; }
          // steal
          const loot = target.cards.filter((id) => {
            const d = CARDS[g.s.cards[id].d];
            return d.kind === 'coin' || d.food > 0;
          }).slice(-3);
          for (const id of loot) {
            ai.bag.push(g.s.cards[id].d);
            g.removeCard(id, 'stolen');
          }
          if (loot.length) g.msg(`盗匪偷走了 ${loot.length} 张卡牌！`, 'danger');
          ai.tg = 0;
        }
        break;
      }
      case 'boss': {
        if (!ai.act) {
          const near = nearest(g, pos, (s) => hasPerson(g, s), 260);
          if (near) { ai.act = true; g.msg(`${def.name}被惊醒了！`, 'danger'); }
          else break;
        }
        if (mob.darkPulse) {
          ai.pulse = (ai.pulse || 0) + dt;
          if (ai.pulse >= mob.darkPulse) {
            ai.pulse = 0;
            g.darkPulse(pos, 700);
          }
        }
        ai.t -= dt;
        let target = ai.tg ? g.s.stacks[ai.tg] : null;
        if (ai.t <= 0 || !target) {
          ai.t = 1.5;
          target = nearest(g, pos, (s) => hasPerson(g, s));
          ai.tg = target ? target.id : 0;
        }
        if (!target) break;
        const tc = center(target);
        if (moveToward(g, st, tc.x, tc.y, speed, dt) < CONTACT + 10) engage(g, c, target);
        break;
      }
      case 'lair':
      default:
        break;
    }
  }
}

/** pick a dark spawn point at some distance from the camp */
export function darkSpawnPoint(g, minR = 480, maxR = 820) {
  const cc = g.colonyCenter();
  for (let i = 0; i < 24; i++) {
    const a = g.rng.next() * Math.PI * 2;
    const r = minR + g.rng.next() * (maxR - minR);
    const x = cc.x + Math.cos(a) * r, y = cc.y + Math.sin(a) * r;
    if (x < 40 || y < 40 || x > g.board.w - 40 || y > g.board.h - 40) continue;
    if (g.lightAt(x, y) > 0) continue;
    return { x, y };
  }
  // fall back to a board edge
  const edge = g.rng.int(0, 3);
  const W = g.board.w, H = g.board.h;
  return [{ x: g.rng.range(0, W), y: 30 }, { x: g.rng.range(0, W), y: H - 30 }, { x: 30, y: g.rng.range(0, H) }, { x: W - 30, y: g.rng.range(0, H) }][edge];
}

export function edgeSpawnPoint(g) {
  const cc = g.colonyCenter();
  const W = g.board.w, H = g.board.h;
  const opts = [{ x: g.rng.range(80, W - 80), y: 60 }, { x: g.rng.range(80, W - 80), y: H - 60 }, { x: 60, y: g.rng.range(80, H - 80) }, { x: W - 60, y: g.rng.range(80, H - 80) }];
  opts.sort((a, b) => Math.hypot(b.x - cc.x, b.y - cc.y) - Math.hypot(a.x - cc.x, a.y - cc.y));
  return opts[g.rng.int(0, 1)];
}

/** spawn something hostile that will come for the camp */
export function spawnAttacker(g, d, pos, raid = true) {
  const p = pos || edgeSpawnPoint(g);
  const m = g.spawnMob(d, p.x - CARD_W / 2, p.y - CARD_H / 2);
  if (m.ai) {
    m.ai.raid = raid;
    m.ai.act = true;
  }
  return m;
}

/** at nightfall: shades rise from the dark, lairs release their brood, scheduled raids arrive */
export function onNightfall(g) {
  const R = g.rules;
  const q = [];
  if (R.shades) {
    let n = Math.floor((R.shadeBase ?? 0) + g.s.fog * (R.shadePerFog ?? 1 / 12));
    if (g.s.flags.ashTide === g.s.day) n *= 2;
    n = Math.min(n, R.shadeMax ?? 14);
    for (let i = 0; i < n; i++) {
      let d = 'shade';
      const f = g.s.fog;
      const roll = g.rng.next();
      if (R.shadeTypes) d = g.rng.weighted(R.shadeTypes);
      else if (f > 65 && roll < 0.22) d = 'greater_shade';
      else if (f > 35 && roll < 0.35) d = 'wisp';
      q.push({ t: g.s.t + g.rng.next() * g.dayLen() * 0.16, d, dark: true });
    }
  }
  if (g.s.flags.raidNight === g.s.day) {
    const n = 2 + Math.floor(g.s.day / 6);
    for (let i = 0; i < n; i++) q.push({ t: g.s.t + i * 1.5, d: g.rng.chance(0.3) ? 'bandit_archer' : 'bandit' });
  }
  if (g.s.flags.wolfNight === g.s.day) {
    const n = 2 + Math.floor(g.s.day / 7);
    const d = g.level.biome === 'tundra' ? 'frost_wolf' : 'wolf';
    for (let i = 0; i < n; i++) q.push({ t: g.s.t + i, d });
  }
  // lairs that spawn at night
  for (const c of Object.values(g.s.cards)) {
    const def = CARDS[c.d];
    if (def.kind !== 'lair') continue;
    const sp = def.mob.spawn;
    if (!sp.night) continue;
    lairSpawn(g, c);
  }
  g.s.spawnQ.push(...q);
}

export function lairSpawn(g, c) {
  const def = CARDS[c.d];
  const sp = def.mob.spawn;
  c.ai = c.ai || { kids: [] };
  c.ai.kids = (c.ai.kids || []).filter((id) => g.s.cards[id]);
  const st = g.s.stacks[c.s];
  while (c.ai.kids.length < sp.max) {
    const d = sp.alt && g.rng.chance(0.35) ? sp.alt : sp.id;
    const m = g.spawnMob(d, st.x + g.rng.range(-120, 120), st.y + g.rng.range(80, 160));
    m.ai.raid = true;
    c.ai.kids.push(m.id);
    if (c.ai.kids.length >= sp.max || g.rng.chance(0.4)) break;
  }
}

export function updateSpawnQueue(g) {
  if (!g.s.spawnQ.length) return;
  const now = g.s.t;
  const keep = [];
  for (const e of g.s.spawnQ) {
    if (e.t > now) { keep.push(e); continue; }
    const p = e.dark ? darkSpawnPoint(g) : edgeSpawnPoint(g);
    const m = spawnAttacker(g, e.d, p, !e.dark);
    if (e.boss) { m.ai.act = true; g.msg(`${CARDS[e.d].name}出现了！`, 'boss'); }
  }
  g.s.spawnQ = keep;
}
