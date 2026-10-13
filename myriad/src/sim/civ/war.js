// War. Armies are raised from city populations, march along A* paths (embarking on ships where
// their nation can sail), fight when they meet enemy armies, besiege cities until their defences
// fall, and then occupy or raze them. Battles are named after the nearest city and written into
// history. Atomic powers losing a war may reach for the unthinkable.

import { log } from '../chronicle.js';
import { pushFx, forDisk } from '../state.js';
import { findPath } from './path.js';
import { transferCity, destroyCity } from './city.js';
import { rel } from './nation.js';
import { rulerHas, createPerson, fullName } from './people.js';
import { pushImpact } from '../geology.js';
import { IMP } from '../constants.js';

/** combat quality multiplier of a nation's soldiers */
export function quality(w, n) {
  const tf = n.tf, acc = n.access || {};
  let q = 1 + n.era * 0.38;
  if (tf.bronze) q += acc.copper ? 0.3 : 0.1;
  if (tf.iron) q += acc.iron ? 0.4 : 0.12;
  if (tf.metallurgy) q += acc.iron ? 0.3 : 0.1;
  if (tf.husbandry && (acc.horse || n.domestic)) q += 0.25;
  if (tf.gunpowder) q += 0.6;
  if (tf.combustion) q += acc.oil ? 0.9 : 0.3;
  if (tf.flight) q += acc.oil ? 0.8 : 0.3;
  if (tf.computers) q += 0.6;
  q *= 0.8 + n.traits.size * 0.4 + n.traits.aggr * 0.2;
  if (n.goldenAge > 0) q *= 1.1;
  return q;
}

export function maxDefense(w, city) {
  const n = w.nations[city.nation];
  let d = 6 + Math.sqrt(city.pop) * 0.25;
  if (city.buildings.includes('walls')) d *= 2;
  if (city.buildings.includes('castle')) d *= 1.5;
  if (n.wonders.includes('rampart')) d *= 1.3;
  if (city.capital) d *= 1.25;
  return d * (1 + n.era * 0.35);
}

export function raiseArmy(w, n, city, soldiers, target) {
  soldiers = Math.max(20, Math.min(soldiers, city.pop * 0.25));
  city.pop -= soldiers * 0.6;
  const a = {
    id: (w.armySeq = (w.armySeq || 0) + 1),
    nation: n.id,
    x: city.x + 0.5, y: city.y + 0.5,
    str: soldiers, max: soldiers,
    q: quality(w, n) * (city.buildings.includes('barracks') ? 1.15 : 1),
    morale: 1,
    target: target ? target.id : -1,
    path: null, pi: 0,
    state: 'march',
    home: city.id,
    general: null,
    naval: false,
    born: w.tick,
    kills: 0,
    alive: true,
    battle: null,
    repath: 0,
  };
  // famous commanders now and then
  if (w.rng.chance(0.08 + Math.max(0, n.values.mil) * 0.1)) {
    const p = createPerson(w, n, 'general', { age: 30 + w.rng.int(15), city: city.id });
    a.general = p.id;
    a.q *= 1.25;
  }
  w.armies.push(a);
  return a;
}

function nearestEnemyCity(w, n, a, enemies) {
  let best = null, bd = 1e9;
  for (const e of enemies) {
    for (const ci of e.cities) {
      const c = w.cities[ci];
      if (a.unreachable && a.unreachable[ci] > w.tick) continue;
      const d = Math.hypot(c.x + 0.5 - a.x, c.y + 0.5 - a.y) * (c.capital ? 0.85 : 1);
      if (d < bd) { bd = d; best = c; }
    }
  }
  return best;
}

function planPath(w, a, n, city) {
  const from = Math.floor(a.y) * w.W + Math.floor(a.x);
  const to = city.y * w.W + city.x;
  let p = findPath(w, from, to, { sea: 0, maxNodes: 6000 });
  if (!p && (n.tf.rafts || n.tf.sailing)) p = findPath(w, from, to, { sea: n.tf.compass ? 2 : 1, maxNodes: 9000 });
  a.path = p;
  a.pi = 0;
  return p;
}

/** move, fight and besiege (every tick) */
export function stepArmies(w, rng) {
  const armies = w.armies;
  for (const a of armies) {
    if (!a.alive) continue;
    const n = w.nations[a.nation];
    if (!n.alive) { a.alive = false; continue; }
    const enemies = [];
    for (const k in n.rel) if (n.rel[k].state === 'war' && w.nations[k].alive) enemies.push(w.nations[k]);
    if (!enemies.length && a.state !== 'return') { a.state = 'return'; a.path = null; }
    a.morale = Math.min(1, a.morale + 0.02);
    if (a.battle) continue; // engaged: resolved below

    // targeting
    let target = a.target >= 0 ? w.cities[a.target] : null;
    if (a.state === 'march') {
      if (!target || !target.alive || !enemies.some((e) => e.id === target.nation)) {
        target = nearestEnemyCity(w, n, a, enemies);
        a.target = target ? target.id : -1;
        a.path = null;
      }
      if (!target) { a.state = 'return'; a.path = null; }
    }
    if (a.state === 'return') {
      const home = w.cities[a.home];
      target = home && home.alive && home.nation === n.id ? home : (n.capital >= 0 ? w.cities[n.capital] : null);
      if (!target) { a.alive = false; continue; }
      if (Math.hypot(target.x + 0.5 - a.x, target.y + 0.5 - a.y) < 1.2) {
        target.pop += a.str * 0.6; // soldiers go home
        a.alive = false;
        continue;
      }
    }
    if (!target) continue;
    const dist = Math.hypot(target.x + 0.5 - a.x, target.y + 0.5 - a.y);
    if (a.state === 'march' && dist < 1.3) {
      siege(w, a, n, target, rng);
      continue;
    }
    if (!a.path || a.repath-- <= 0) {
      planPath(w, a, n, target);
      a.repath = 160;
      if (!a.path) {
        // cannot get there: try another target later, or go home
        (a.unreachable || (a.unreachable = {}))[target.id] = w.tick + 200;
        a.target = -1;
        a.fails = (a.fails || 0) + 1;
        if (a.fails > 3) a.state = 'return';
        continue;
      }
    }
    // advance along the path
    const c0 = Math.floor(a.y) * w.W + Math.floor(a.x);
    const onWater = w.elev[c0] < w.seaLevel || w.lake[c0] > 0;
    a.naval = onWater;
    let speed = 0.28 * (onWater ? 1.4 : 1) * (w.road[c0] ? (w.road[c0] >= 2 ? 3 : 1.6) : 1) * (n.tf.combustion ? 1.6 : 1);
    while (speed > 0 && a.pi < a.path.length) {
      const nc = a.path[a.pi];
      const tx = (nc % w.W) + 0.5, ty = Math.floor(nc / w.W) + 0.5;
      const d = Math.hypot(tx - a.x, ty - a.y);
      if (d <= speed) { a.x = tx; a.y = ty; a.pi++; speed -= d; } else { a.x += ((tx - a.x) / d) * speed; a.y += ((ty - a.y) / d) * speed; speed = 0; }
    }
    if (a.pi >= a.path.length) a.path = null;
  }
  engage(w, rng);
  w.armies = armies.filter((a) => a.alive);
}

/** find hostile armies in contact and resolve one round of battle for each engagement */
function engage(w, rng) {
  const armies = w.armies;
  for (let i = 0; i < armies.length; i++) {
    const a = armies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < armies.length; j++) {
      const b = armies[j];
      if (!b.alive || a.nation === b.nation) continue;
      if (Math.abs(a.x - b.x) > 1.6 || Math.abs(a.y - b.y) > 1.6) continue;
      const r = w.nations[a.nation].rel[b.nation];
      if (!r || r.state !== 'war') continue;
      fight(w, a, b, rng);
    }
  }
  for (const a of armies) if (a.battle && a.battle.lastTick < w.tick - 1) endBattle(w, a);
}

function terrainDefense(w, x, y) {
  const c = Math.floor(y) * w.W + Math.floor(x);
  const h = w.elev[c] - w.seaLevel;
  return 1 + Math.max(0, h) * 1.5 + (w.biome[c] === 7 || w.biome[c] === 8 || w.biome[c] === 13 ? 0.2 : 0);
}

function fight(w, a, b, rng) {
  if (!a.battle) a.battle = { foe: b.id, start: w.tick, lastTick: w.tick, losses: 0, foeLosses: 0, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (!b.battle) b.battle = { foe: a.id, start: w.tick, lastTick: w.tick, losses: 0, foeLosses: 0, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  a.battle.lastTick = b.battle.lastTick = w.tick;
  const pa = a.str * a.q * a.morale, pb = b.str * b.q * b.morale;
  const la = Math.min(a.str, pb * 0.06 * (0.7 + rng.next() * 0.6) / terrainDefense(w, a.x, a.y));
  const lb = Math.min(b.str, pa * 0.06 * (0.7 + rng.next() * 0.6) / terrainDefense(w, b.x, b.y));
  a.str -= la; b.str -= lb;
  a.battle.losses += la; b.battle.losses += lb;
  a.morale -= (la / Math.max(1, a.max)) * 1.6;
  b.morale -= (lb / Math.max(1, b.max)) * 1.6;
  if (rng.chance(0.6)) pushFx(w, { type: 'battle', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  for (const [x, y] of [[a, b], [b, a]]) {
    if (x.str < 8 || x.morale < 0.15) {
      x.state = 'return';
      x.path = null;
      if (x.str < 8) x.alive = false;
      x.battle.lastTick = -1e9;
      y.battle.lastTick = -1e9;
      y.kills += x.battle.losses;
      recordBattle(w, y, x);
      y.battle = null;
      x.battle = null;
      return;
    }
  }
}

function endBattle(w, a) {
  a.battle = null;
}

function nearestCityName(w, x, y) {
  let best = null, bd = 1e9;
  for (const c of w.cities) {
    if (!c.alive && !c.fell) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best ? best.name.z : '无名之地';
}

function recordBattle(w, winner, loser) {
  const nw = w.nations[winner.nation], nl = w.nations[loser.nation];
  const r = rel(w, nw, nl);
  r.score += (nw.id < nl.id ? 1 : -1) * 2;
  const total = Math.round((winner.max - winner.str) + (loser.max - loser.str));
  const place = nearestCityName(w, winner.x, winner.y);
  w.battleNames = w.battleNames || {};
  const k = (w.battleNames[place] = (w.battleNames[place] || 0) + 1);
  const name = k === 1 ? `${place}之战` : k <= 10 ? `第${'一二三四五六七八九十'[k - 1]}次${place}之战` : `第 ${k} 次${place}之战`;
  const gen = winner.general != null ? w.persons[winner.general] : null;
  if (gen) gen.stats.won++;
  const lw = w.persons[nw.leader]; if (lw) lw.stats.won++;
  const ll = w.persons[nl.leader]; if (ll) ll.stats.lost++;
  w.battles = (w.battles || 0) + 1;
  const big = total > 25000;
  if (total < 300 && !gen) return;
  log(w, 'war', `${name}：${nw.name}${gen ? `在名将${fullName(gen)}率领下` : ''}击败${nl.name}，双方伤亡约 ${total} 人。`, { imp: big ? 2 : 1, x: winner.x, y: winner.y, nations: [nw.id, nl.id] });
}

function siege(w, a, n, city, rng) {
  const def = w.nations[city.nation];
  city.siege = w.tick;
  const power = a.str * a.q * 0.0035 * (n.tf.mathematics ? 1.3 : 1) * (n.tf.gunpowder ? 1.6 : 1);
  city.defense -= power;
  city.pop *= 0.997;
  // the garrison fights back
  a.str -= Math.max(0, city.defense) * 0.08 * (0.6 + rng.next() * 0.5);
  if (rng.chance(0.3)) pushFx(w, { type: 'battle', x: city.x + 0.5, y: city.y + 0.5 });
  if (a.str < 8) { a.alive = false; return; }
  if (city.defense > 0) return;
  // the city falls
  const r = rel(w, n, def);
  r.score += (n.id < def.id ? 1 : -1) * (city.capital ? 8 : 4);
  const leader = w.persons[n.leader];
  if (leader) leader.stats.cities++;
  const dl = w.persons[def.leader]; if (dl) dl.stats.citiesLost++;
  const cruel = rulerHas(w, n, 'cruel') || n.values.mil > 0.85;
  const alien = def.species !== n.species;
  const raze = city.tier <= 2 && (cruel ? rng.chance(0.5) : alien ? rng.chance(0.15) : rng.chance(0.03));
  const wasCapital = city.capital;
  if (raze) {
    destroyCity(w, city, '被攻陷后焚毁', { cat: 'war', text: `${n.name}攻陷并焚毁了${def.name}的${city.name.z}。` });
  } else {
    city.pop *= 0.8;
    const oldName = def.name;
    transferCity(w, city, n, 'conquest');
    city.defense = maxDefense(w, city) * 0.2;
    log(w, 'war', `${n.name}攻陷了${oldName}的${wasCapital ? '首都' : ''}${city.name.z}。`, { imp: wasCapital || city.tier >= 3 ? 2 : 1, x: city.x, y: city.y, nations: [n.id, def.id] });
  }
  a.target = -1;
  a.path = null;
  pushFx(w, { type: 'conquest', x: city.x + 0.5, y: city.y + 0.5, color: n.color });
}

/** yearly military AI for nations at war: raise armies near the front */
export function militaryAI(w, n, rng) {
  const enemies = [];
  for (const k in n.rel) if (n.rel[k].state === 'war' && w.nations[k].alive) enemies.push(w.nations[k]);
  if (!enemies.length) return;
  const mine = w.armies.filter((a) => a.alive && a.nation === n.id);
  const strength = mine.reduce((s, a) => s + a.str, 0);
  const pop = n.stats.pop;
  const mobil = 0.02 + Math.max(0, n.values.mil) * 0.03 + (n.gov === 'junta' ? 0.02 : 0);
  const want = pop * mobil;
  if (strength >= want || mine.length >= 3 + Math.floor(n.cities.length / 3)) return;
  // raise from the city closest to the nearest enemy city
  let best = null, bd = 1e9;
  for (const ci of n.cities) {
    const c = w.cities[ci];
    if (c.pop < 300) continue;
    for (const e of enemies) for (const ei of e.cities) {
      const ec = w.cities[ei];
      const d = Math.hypot(c.x - ec.x, c.y - ec.y);
      if (d < bd) { bd = d; best = c; }
    }
  }
  if (!best) return;
  raiseArmy(w, n, best, Math.min(want - strength, best.pop * 0.2), null);
  n.treasury -= 5;
}

/** physical effects of a nuclear explosion at a city; returns the number killed */
export function nukeEffects(w, city) {
  const x = city.x + 0.5, y = city.y + 0.5;
  pushFx(w, { type: 'nuke', x, y });
  pushImpact(w, { kind: 'nuke', x, y, r: 4, power: 10 });
  forDisk(w, x, y, 5, (c, xx, yy, d2) => {
    const k = 1 - Math.sqrt(d2) / 5;
    w.rad[c] = Math.min(1, w.rad[c] + 0.9 * k);
    w.veg[c] *= 0.1;
    if (w.impr[c] === IMP.URBAN || w.impr[c] === IMP.FARM) w.impr[c] = IMP.RUIN;
    w.scorch[c] = Math.max(w.scorch[c], 40);
  });
  w.climate.dust += 0.25;
  w.dirty.climate = true;
  w.terrainVersion++;
  w.nukes = (w.nukes || 0) + 1;
  const dead = Math.round(city.pop * 0.85);
  city.pop *= 0.15;
  return dead;
}

/** the unthinkable: an atomic power strikes an enemy city */
export function nuclearStrike(w, n, city, rng) {
  const target = w.nations[city.nation];
  const x = city.x + 0.5, y = city.y + 0.5;
  pushFx(w, { type: 'nuke', x, y });
  pushImpact(w, { kind: 'nuke', x, y, r: 4, power: 10 });
  forDisk(w, x, y, 5, (c, xx, yy, d2) => {
    const k = 1 - Math.sqrt(d2) / 5;
    w.rad[c] = Math.min(1, w.rad[c] + 0.9 * k);
    w.veg[c] *= 0.1;
    if (w.impr[c] === IMP.URBAN || w.impr[c] === IMP.FARM) w.impr[c] = IMP.RUIN;
    w.scorch[c] = Math.max(w.scorch[c], 40);
  });
  w.climate.dust += 0.25;
  w.dirty.climate = true;
  w.terrainVersion++;
  w.nukes = (w.nukes || 0) + 1;
  const dead = Math.round(city.pop * 0.85);
  city.pop *= 0.15;
  log(w, 'war', `☢ ${n.name}向${target.name}的${city.name.z}投下了核弹。顷刻之间，约 ${dead} 人死去。`, { imp: 3, x: city.x, y: city.y, nations: [n.id, target.id] });
  if (city.pop < 200) destroyCity(w, city, '在核火中毁灭', { silent: true });
  // the whole world recoils
  for (const m of w.nations) if (m.alive && m !== n) { const r = rel(w, n, m); r.op -= 60; }
}

export function considerNukes(w, n, rng) {
  if (!n.tf.fission || !(n.access && n.access.uranium)) return;
  const enemies = [];
  for (const k in n.rel) if (n.rel[k].state === 'war' && w.nations[k].alive) enemies.push([w.nations[k], n.rel[k]]);
  for (const [e, r] of enemies) {
    const losing = (n.id < e.id ? r.score : -r.score) < -10;
    const mad = rulerHas(w, n, 'mad');
    const p = (losing ? 0.04 : 0.004) * (mad ? 5 : 1) * (1 + Math.max(0, n.values.mil)) * (n.ideas.pacifism ? 0.2 : 1);
    if (!rng.chance(p) || !e.cities.length) continue;
    const city = w.cities[e.cities.reduce((a, b) => (w.cities[a].pop > w.cities[b].pop ? a : b))];
    nuclearStrike(w, n, city, rng);
    return;
  }
}

