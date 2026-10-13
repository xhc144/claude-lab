// The turning of days. At every dawn the camp eats, fires burn down, food spoils, children grow,
// wild plants regrow, the wounded heal, the cold bites, the ash fog creeps, and the world throws
// something new at the camp.

import { CARDS } from '../data/cards.js';
import { CARD_H } from './constants.js';
import { rollEvents, fireEvent, spawnCaravan, expireEvents, flood } from './eventsim.js';
import { lairSpawn, spawnAttacker, edgeSpawnPoint } from './mobs.js';

function feed(g) {
  const winter = g.rules.seasons && g.season() === 3;
  const people = g.people().filter((c) => (CARDS[c.d].appetite || 0) > 0);
  if (!people.length) return;
  // perishable first (soonest to spoil), then the granary, then preserved food
  const cards = Object.values(g.s.cards).filter((c) => {
    const d = CARDS[c.d];
    if (!(d.food > 0)) return false;
    const st = g.s.stacks[c.s];
    return st && !st.held && !st.mob;
  });
  const perish = cards.filter((c) => c.sp !== undefined).sort((a, b) => a.sp - b.sp || CARDS[a.d].food - CARDS[b.d].food);
  const keep = cards.filter((c) => c.sp === undefined).sort((a, b) => CARDS[a.d].food - CARDS[b.d].food);
  const granaries = Object.values(g.s.cards).filter((c) => CARDS[c.d].store);
  let eaten = 0;
  const take = (need) => {
    for (const list of [perish, null, keep]) {
      if (need <= 0) break;
      if (list === null) {
        for (const gr of granaries) {
          const t = Math.min(need, gr.store || 0);
          gr.store -= t;
          need -= t;
          eaten += t;
          if (need <= 0) break;
        }
        continue;
      }
      while (need > 0 && list.length) {
        const c = list[0];
        const left = c.fl ?? CARDS[c.d].food;
        const t = Math.min(need, left);
        need -= t;
        eaten += t;
        if (left - t <= 0) {
          list.shift();
          g.removeCard(c.id, 'eat');
        } else c.fl = left - t;
      }
    }
    return need;
  };
  // the young and the weak eat first
  people.sort((a, b) => (CARDS[a.d].tags.includes('child') ? 0 : 1) - (CARDS[b.d].tags.includes('child') ? 0 : 1) || a.hp - b.hp);
  let starving = 0;
  for (const p of people) {
    let need = CARDS[p.d].appetite;
    if (winter) need = Math.ceil(need * (g.rules.winterAppetite ?? 1));
    const left = take(need);
    p.st = p.st || {};
    if (left <= 0) p.st.hungry = 0;
    else if (p.st.hungry) {
      starving++;
      g.killPerson(p, '饿死了');
    } else {
      p.st.hungry = 1;
    }
  }
  g.s.stats.eaten += eaten;
  const hungry = g.people().filter((c) => c.st && c.st.hungry).length;
  if (hungry) g.msg(`${hungry} 人在挨饿！再吃不上饭就会饿死。`, 'danger');
  g.emit({ type: 'feed', eaten, hungry, starving });
}

function burnFuel(g) {
  const winter = g.rules.seasons && g.season() === 3;
  for (const c of Object.values(g.s.cards)) {
    const d = CARDS[c.d];
    if (!d.fuelMax || !d.burn) continue;
    if (!(c.fuel > 0)) continue;
    const st = g.s.stacks[c.s];
    let burn = d.burn;
    if (winter && d.tags.includes('fire') && !d.warmth) burn *= 2;
    if (g.rules.cold && d.tags.includes('fire') && !d.warmth) burn += 0.5;
    c.fuel = Math.max(0, c.fuel - burn);
    if (c.fuel <= 0) {
      if (d.id === 'torch') {
        g.removeCard(c.id, 'burnout');
        g.msg('一支火把燃尽了。', 'info');
      } else if (d.kind === 'structure') {
        g.msg(`${d.name}熄灭了——叠上燃料重新点燃它。`, 'warn');
        g.emit({ type: 'fireOut', id: c.id });
      }
    }
    void st;
  }
}

function spoil(g) {
  for (const c of Object.values(g.s.cards)) {
    if (c.sp === undefined) continue;
    c.sp -= 1;
    if (c.sp <= 0) {
      g.transform(c, 'rot');
      delete c.sp;
      delete c.fl;
    }
  }
}

function grow(g) {
  for (const c of Object.values(g.s.cards)) {
    const d = CARDS[c.d];
    if (!d.grows) continue;
    c.age = (c.age || 0) + 1;
    if (c.age >= d.grows.days) {
      const to = d.grows.to;
      g.transform(c, to);
      delete c.age;
      if (to === 'survivor') g.msg(`${c.name || '孩子'}长大了，成为了幸存者。`, 'good');
    }
  }
}

function regenNodes(g) {
  const winter = g.rules.seasons && g.season() === 3;
  for (const c of Object.values(g.s.cards)) {
    const d = CARDS[c.d];
    const n = d.node;
    if (!n || !n.perennial) continue;
    if (winter && n.season && n.season[3] === 0) continue;
    c.ch = Math.min(n.charges, (c.ch || 0) + (n.regen || 1));
  }
}

function healAndCold(g) {
  const winter = g.rules.seasons && g.season() === 3;
  const cold = g.rules.cold === 'always' || (g.rules.cold && winter);
  for (const p of g.people()) {
    const d = CARDS[p.d];
    if (d.tags.includes('construct')) continue;
    p.st = p.st || {};
    if (p.st.sick) {
      g.hurt(p, 1, '病倒了');
      if (!g.s.cards[p.id]) continue;
    }
    if (cold && !g.isWarm(p)) {
      g.hurt(p, 2, '冻死了');
      if (!g.s.cards[p.id]) continue;
      g.emit({ type: 'cold', id: p.id });
    }
    if (!p.st.hungry) g.heal(p, 1 + (g.hasTech('medicine') ? 1 : 0));
  }
}

function updateFog(g) {
  let delta = g.rules.fogRate || 0;
  for (const c of Object.values(g.s.cards)) {
    const d = CARDS[c.d];
    if (!d.fog) continue;
    if (d.fog < 0 && d.fuelMax && !(c.fuel > 0)) continue; // unlit beacons don't help
    delta += d.fog;
  }
  if (g.rules.fogDarkness) {
    // darkness breeds fog: a camp with little light grows the fog faster
    const lit = g.lights.reduce((a, L) => a + L.r, 0);
    if (lit < 500) delta += 1;
  }
  const before = g.s.fog;
  g.addFog(delta, null);
  const f = g.s.fog;
  for (const th of [50, 75, 90]) if (before < th && f >= th) g.msg(`灰雾浓度达到 ${th}%！暗影将更加强大。`, 'danger');
}

function schedule(g) {
  const sch = g.level.schedule || [];
  sch.forEach((e, i) => {
    if (g.s.sched.includes(i)) return;
    if (e.day !== g.s.day) return;
    if (e.at === 'night') return; // handled at nightfall
    g.s.sched.push(i);
    runScheduled(g, e);
  });
}

export function runScheduled(g, e) {
  if (e.msg) g.msg(e.msg, e.kind || 'story');
  if (e.event) fireEvent(g, e.event);
  if (e.caravan) spawnCaravan(g);
  if (e.flag) Object.assign(g.s.flags, e.flag);
  for (const [d, n, opts] of e.spawn || []) {
    for (let i = 0; i < n; i++) {
      if (CARDS[d].kind === 'enemy') {
        const m = spawnAttacker(g, d, e.from ? { x: e.from[0] * g.board.w, y: e.from[1] * g.board.h } : edgeSpawnPoint(g), true);
        if (opts && opts.boss) g.msg(`${CARDS[d].name}向营地袭来！`, 'boss');
        void m;
      } else {
        const cc = g.colonyCenter();
        const p = g.freeSpot(cc.x + g.rng.range(-400, 400), cc.y + g.rng.range(-300, 300), CARD_H);
        g.spawn(d, p, { at: p });
      }
    }
  }
  if (e.wake) {
    for (const c of Object.values(g.s.cards)) if (c.d === e.wake && c.ai) { c.ai.act = true; g.msg(`${CARDS[c.d].name}开始向营地进发！`, 'boss'); }
  }
}

export function nightSchedule(g) {
  const sch = g.level.schedule || [];
  sch.forEach((e, i) => {
    if (g.s.sched.includes(i)) return;
    if (e.day !== g.s.day || e.at !== 'night') return;
    g.s.sched.push(i);
    runScheduled(g, e);
  });
}

export function dawn(g) {
  const prevSeason = g.s.season;
  g.s.season = g.season();
  if (g.rules.seasons && prevSeason !== undefined && prevSeason !== g.s.season) {
    const names = ['春天', '夏天', '秋天', '冬天'];
    g.msg(`${names[g.s.season]}来了。` + (g.s.season === 3 ? '万物休眠，篝火加倍耗柴，人们需要更多食物。' : g.s.season === 2 ? '秋天是收获的季节，为冬天做好储备。' : ''), 'season');
    g.emit({ type: 'season', season: g.s.season });
  }
  if (g.s.flags.flood && g.s.flags.flood === g.s.day) flood(g);
  feed(g);
  burnFuel(g);
  spoil(g);
  grow(g);
  regenNodes(g);
  healAndCold(g);
  updateFog(g);
  // day-based lairs
  for (const c of Object.values(g.s.cards)) {
    const d = CARDS[c.d];
    if (d.kind !== 'lair' || d.mob.spawn.night) continue;
    c.ai = c.ai || {};
    c.ai.days = (c.ai.days || 0) + 1;
    if (c.ai.days >= d.mob.spawn.every) { c.ai.days = 0; lairSpawn(g, c); }
  }
  expireEvents(g);
  schedule(g);
  if (g.s.day > 1) {
    rollEvents(g);
    const every = g.rules.caravanEvery;
    if (every) {
      const n = every - (g.countDef('trading_post') ? 1 : 0);
      if ((g.s.day - 1) % Math.max(2, n) === 0 && !Object.values(g.s.cards).some((c) => c.d === 'caravan')) spawnCaravan(g);
    }
  }
  g.s.stats.maxPop = Math.max(g.s.stats.maxPop, g.population());
  g.emit({ type: 'dawn', day: g.s.day });
}
