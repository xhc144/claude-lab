// Diplomacy. Opinions between nations drift towards what their circumstances suggest — shared
// borders breed friction, trade breeds friendship, faith, ideology and even species matter, old
// wars are remembered — and each nation weighs war or peace by aggression, relative strength,
// hunger for land and resources, and zeal. Allies are called to arms; long wars end in treaties.

import { log } from '../chronicle.js';
import { rel, valueDistance, alliesOf, enemiesOf } from './nation.js';
import { GOVS } from './data.js';
import { rulerTraitSum, rulerHas } from './people.js';

/** count shared border cells between every pair of nations */
export function computeBorders(w) {
  const { W, H, owner } = w;
  const m = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = y * W + x;
      const a = owner[c];
      if (a < 0) continue;
      if (x + 1 < W) { const b = owner[c + 1]; if (b >= 0 && b !== a) { const k = a < b ? a * 4096 + b : b * 4096 + a; m.set(k, (m.get(k) || 0) + 1); } }
      if (y + 1 < H) { const b = owner[c + W]; if (b >= 0 && b !== a) { const k = a < b ? a * 4096 + b : b * 4096 + a; m.set(k, (m.get(k) || 0) + 1); } }
    }
  }
  return m;
}

export const borderLen = (borders, a, b) => borders.get(a < b ? a * 4096 + b : b * 4096 + a) || 0;

export function militaryPower(w, n) {
  let s = 0;
  for (const a of w.armies) if (a.alive && a.nation === n.id) s += a.str * a.q;
  return s + n.stats.pop * 0.02 * (1 + n.era * 0.38) * (0.6 + Math.max(0, n.values.mil));
}

export function aggression(w, n) {
  return 0.12 + n.values.mil * 0.35 + GOVS[n.gov].war + rulerTraitSum(w, n, 'war') + (n.traits.aggr - 0.4) * 0.4 + (w.settings.civAggression - 1) * 0.4 - (n.ideas.pacifism ? 0.35 : 0) - (w.wondersBuilt.parliament ? 0.15 : 0);
}

const CB = {
  holy: '圣战', resource: '资源之争', border: '边境争端', revenge: '复仇', conquest: '扩张野心', ideology: '意识形态之争', divine: '神意',
};

export function declareWar(w, a, b, cb = 'conquest', silentAllies = false) {
  const r = rel(w, a, b);
  if (r.state === 'war') return;
  if (r.state === 'alliance') r.op -= 50;
  r.state = 'war';
  r.since = w.tick;
  r.score = 0;
  r.wars++;
  r.lastWar = w.tick;
  r.cb = cb;
  const la = w.persons[a.leader]; if (la) la.stats.wars++;
  log(w, 'war', `${a.name}以「${CB[cb] || cb}」为由向${b.name}宣战。`, { imp: a.cities.length + b.cities.length >= 8 ? 2 : 1, x: w.cities[b.capital]?.x, y: w.cities[b.capital]?.y, nations: [a.id, b.id] });
  if (silentAllies) return;
  // defensive allies join; offensive allies sometimes
  for (const ally of alliesOf(w, b)) {
    if (ally === a) continue;
    if (w.rng.chance(0.7)) { declareWar(w, ally, a, 'conquest', true); log(w, 'war', `${ally.name}履行盟约，向${a.name}宣战。`, { imp: 1, nations: [ally.id, a.id] }); }
  }
  for (const ally of alliesOf(w, a)) {
    if (ally === b) continue;
    if (w.rng.chance(0.35)) { declareWar(w, ally, b, 'conquest', true); log(w, 'war', `${ally.name}加入${a.name}一方参战。`, { imp: 1, nations: [ally.id, b.id] }); }
  }
}

export function makePeace(w, a, b, how = 'treaty') {
  const r = rel(w, a, b);
  if (r.state !== 'war') return;
  const scoreA = a.id < b.id ? r.score : -r.score;
  const winner = scoreA > 4 ? a : scoreA < -4 ? b : null;
  r.state = 'peace';
  r.truce = w.tick + 4 * 15;
  r.op = Math.min(r.op, -10);
  const years = Math.round((w.tick - r.since) / 4);
  let text;
  if (how === 'divine') text = `在神的意志下，${a.name}与${b.name}放下了武器。`;
  else if (winner) {
    const loser = winner === a ? b : a;
    const tribute = Math.min(loser.treasury * 0.5, 200);
    loser.treasury -= tribute;
    winner.treasury += tribute;
    text = `${a.name}与${b.name}签订和约，持续 ${years} 年的战争以${winner.name}的胜利告终。`;
  } else text = `${a.name}与${b.name}在僵持 ${years} 年后议和。`;
  log(w, 'war', text, { imp: 1, nations: [a.id, b.id] });
}

/** yearly diplomacy for all nations; borders from computeBorders */
export function stepDiplomacy(w, rng, borders) {
  const nations = w.nations.filter((n) => n.alive && n.cities.length);
  // contact & opinion
  for (let i = 0; i < nations.length; i++) {
    const a = nations[i];
    for (let j = i + 1; j < nations.length; j++) {
      const b = nations[j];
      const bl = borderLen(borders, a.id, b.id);
      let r = a.rel[b.id];
      const ca = w.cities[a.capital], cb = w.cities[b.capital];
      const capDist = ca && cb ? Math.hypot(ca.x - cb.x, ca.y - cb.y) : 999;
      const reach = (a.tf.sailing || b.tf.sailing ? 60 : 0) + (a.tf.compass || b.tf.compass ? 80 : 0) + (a.tf.radio || b.tf.radio ? 400 : 0);
      if (!r && bl === 0 && capDist > reach) continue;
      r = rel(w, a, b);
      if (!r.contact && (bl > 0 || capDist <= reach || r.trade > 0)) {
        r.contact = true;
        if (!w.flags.firstContact) { w.flags.firstContact = true; log(w, 'civ', `${a.adj}与${b.adj}第一次相遇。`, { imp: 2, nations: [a.id, b.id] }); }
      }
      let target = 0;
      target -= Math.min(30, bl * 0.35) * (0.5 + Math.max(0, (a.values.mil + b.values.mil) / 2));
      target += Math.min(30, r.trade * 7);
      if (a.religion != null && a.religion === b.religion) target += 20;
      else if (a.religion != null && b.religion != null) target -= 8 * (1 + Math.max(0, (a.values.piety + b.values.piety) / 2));
      target -= valueDistance(a, b) * 10;
      if (a.species !== b.species) target -= 18 * (1 - Math.max(0, (a.values.open + b.values.open) / 2));
      if (r.state === 'alliance') target += 25;
      const years = (w.tick - r.lastWar) / 4;
      if (years < 60) target -= 35 * (1 - years / 60);
      target += (rulerTraitSum(w, a, 'diplo') + rulerTraitSum(w, b, 'diplo')) * 30;
      if (rulerHas(w, a, 'mad') || rulerHas(w, b, 'mad')) target -= 15;
      // common enemies
      for (const k in a.rel) if (a.rel[k].state === 'war' && b.rel[k] && b.rel[k].state === 'war') target += 15;
      r.op += (target - r.op) * 0.12 + (rng.next() - 0.5) * 3;
      r.op = Math.max(-100, Math.min(100, r.op));
      r.trade = Math.max(0, r.trade - 0.2);
    }
  }
  // war, peace and alliance decisions
  let warsDeclared = 0;
  for (const a of rng.shuffle(nations.slice())) {
    const atWarCount = enemiesOf(w, a).length;
    for (const k in a.rel) {
      const b = w.nations[k];
      if (!b.alive || !b.cities.length) continue;
      const r = a.rel[k];
      if (!r.contact) continue;
      if (r.state === 'war') {
        // peace?
        const years = (w.tick - r.since) / 4;
        const score = a.id < b.id ? r.score : -r.score;
        const tired = a.weariness + b.weariness;
        if (years > 2 && (Math.abs(score) > 14 + years * 0.5 || tired > 1.2 || rng.chance(0.015 * years))) makePeace(w, a, b);
        continue;
      }
      if (warsDeclared >= 2 || atWarCount >= 2 || w.tick < r.truce) continue;
      const bl = borderLen(borders, a.id, b.id);
      const reachable = bl > 0 || ((a.tf.sailing || a.tf.rafts) && Math.hypot(w.cities[a.capital].x - w.cities[b.capital].x, w.cities[a.capital].y - w.cities[b.capital].y) < (a.tf.compass ? 120 : 45));
      if (!reachable) continue;
      const pa = militaryPower(w, a), pb = militaryPower(w, b) + alliesOf(w, b).reduce((s, x) => s + militaryPower(w, x) * 0.5, 0);
      let U = aggression(w, a) - r.op / 90 + Math.max(-0.6, Math.min(0.6, Math.log2((pa + 1) / (pb + 1)) * 0.3)) - a.weariness * 1.5 - (r.state === 'alliance' ? 1 : 0);
      let cb = 'conquest';
      const want = ['iron', 'coal', 'oil', 'uranium'].filter((res) => b.owned && b.owned[res] && !(a.owned && a.owned[res]) && a.tf[{ iron: 'iron', coal: 'steam', oil: 'combustion', uranium: 'fission' }[res]]);
      if (want.length) { U += 0.15 * want.length; cb = 'resource'; }
      if (a.religion != null && b.religion != null && a.religion !== b.religion && (a.ideas.zeal || a.values.piety > 0.6)) { U += 0.3; cb = 'holy'; }
      if (bl > 25) { U += 0.1; if (cb === 'conquest') cb = 'border'; }
      if ((w.tick - r.lastWar) / 4 < 80 && r.wars > 0 && r.op < -40) { U += 0.15; cb = 'revenge'; }
      if (valueDistance(a, b) > 1.4 && a.era >= 6) { U += 0.15; cb = 'ideology'; }
      if (U > 0.85 && rng.chance(0.2)) { declareWar(w, a, b, cb); warsDeclared++; }
      else if (r.state === 'peace' && r.op > 55 && rng.chance(0.08) && enemiesOf(w, a).some((e) => enemiesOf(w, b).includes(e) || borderLen(borders, e.id, b.id) > 0)) {
        r.state = 'alliance';
        log(w, 'civ', `${a.name}与${b.name}结为同盟。`, { imp: 1, nations: [a.id, b.id] });
      } else if (r.state === 'alliance' && r.op < 15) {
        r.state = 'peace';
        log(w, 'civ', `${a.name}与${b.name}的同盟破裂。`, { imp: 1, nations: [a.id, b.id] });
      }
    }
  }
  // world wars
  let wars = 0;
  const involved = new Set();
  for (const a of nations) for (const k in a.rel) if (a.rel[k].state === 'war' && a.id < Number(k)) { wars++; involved.add(a.id); involved.add(Number(k)); }
  w.activeWars = wars;
  if (wars >= 4 && involved.size >= 6 && !w.worldWarActive) {
    w.worldWarActive = true;
    w.worldWars = (w.worldWars || 0) + 1;
    log(w, 'war', `战火燃遍世界：${involved.size} 个国家卷入了第${'一二三四五六七八九十'[Math.min(9, w.worldWars - 1)]}次世界大战。`, { imp: 3 });
  } else if (wars <= 1) w.worldWarActive = false;
}
