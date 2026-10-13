// Economy: strategic and luxury resources a nation controls, trade routes between cities (caravan
// tracks over land, shipping lanes over sea) that bring wealth, carry ideas, faiths, knowledge and
// plague, and the road and rail networks that grow along them.

import { R, IMP } from '../constants.js';
import { findPath, buildRoad } from './path.js';
import { log } from '../chronicle.js';

const RES_KEY = { [R.COPPER]: 'copper', [R.IRON]: 'iron', [R.GOLD]: 'gold', [R.GEMS]: 'gems', [R.COAL]: 'coal', [R.OIL]: 'oil', [R.URANIUM]: 'uranium', [R.FISH]: 'fish', [R.SPICE]: 'spice', [R.MARBLE]: 'marble', [R.HORSE]: 'horse' };

/** count resources inside each nation's borders */
export function computeAccess(w) {
  for (const n of w.nations) if (n.alive) n.owned = {};
  if (!w.resCells || w.resVersion !== w.elevVersion) {
    w.resCells = [];
    for (let c = 0; c < w.N; c++) if (w.res[c]) w.resCells.push(c);
    w.resVersion = w.elevVersion;
  }
  for (const c of w.resCells) {
    const o = w.owner[c];
    if (o < 0) continue;
    const k = RES_KEY[w.res[c]];
    const n = w.nations[o];
    n.owned[k] = (n.owned[k] || 0) + (w.impr[c] === IMP.MINE || w.impr[c] === IMP.WELL ? 1.5 : 1);
  }
  // access = owned or imported through trade
  for (const n of w.nations) {
    if (!n.alive) continue;
    n.access = { ...n.owned };
  }
  for (const r of w.routes) {
    const a = w.nations[w.cities[r.a].nation], b = w.nations[w.cities[r.b].nation];
    if (a === b) continue;
    for (const k in b.owned) if (!a.access[k]) a.access[k] = 0.5;
    for (const k in a.owned) if (!b.access[k]) b.access[k] = 0.5;
  }
}

function tradeRange(n) {
  const tf = n.tf;
  if (tf.flight) return 90;
  if (tf.railroad || tf.compass) return 42;
  if (tf.sailing) return 28;
  if (tf.wheel) return 16;
  return 10;
}

function complement(a, b) {
  let s = 0;
  for (const k in a.owned) if (!b.owned[k]) s++;
  for (const k in b.owned) if (!a.owned[k]) s++;
  return 1 + Math.min(6, s) * 0.15;
}

/** form new trade routes and drop broken ones (yearly) */
export function updateTrade(w, rng) {
  // drop dead or wartime routes
  w.routes = w.routes.filter((r) => {
    const A = w.cities[r.a], Bc = w.cities[r.b];
    if (!A.alive || !Bc.alive) return false;
    const na = w.nations[A.nation], nb = w.nations[Bc.nation];
    if (na !== nb) {
      const rl = na.rel[nb.id];
      if (rl && rl.state === 'war') return false;
    }
    return true;
  });
  const count = new Map();
  for (const r of w.routes) { count.set(r.a, (count.get(r.a) || 0) + 1); count.set(r.b, (count.get(r.b) || 0) + 1); }
  const cities = w.cities.filter((c) => c.alive && c.tier >= 1);
  let attempts = 0;
  for (const A of rng.shuffle(cities.slice())) {
    if (attempts > 6) break;
    const na = w.nations[A.nation];
    const maxR = 1 + Math.floor(A.tier / 2) + (A.buildings.includes('harbor') ? 1 : 0) + (A.buildings.includes('market') ? 1 : 0);
    if ((count.get(A.id) || 0) >= maxR) continue;
    if (!rng.chance(0.3)) continue;
    const range = tradeRange(na);
    let best = null, bv = 0;
    for (const B of cities) {
      if (B === A || (count.get(B.id) || 0) >= 1 + Math.floor(B.tier / 2) + 1) continue;
      const d = Math.hypot(A.x - B.x, A.y - B.y);
      if (d > range || d < 3) continue;
      if (w.routes.some((r) => (r.a === A.id && r.b === B.id) || (r.a === B.id && r.b === A.id))) continue;
      const nb = w.nations[B.nation];
      if (na !== nb) {
        const rl = na.rel[nb.id];
        if (!rl || !rl.contact || rl.state === 'war' || rl.op < -30) continue;
      }
      const v = Math.sqrt(A.pop * B.pop) / (1 + d * 0.08) * (na === nb ? 0.8 : complement(na, nb));
      if (v > bv) { bv = v; best = B; }
    }
    if (!best) continue;
    attempts++;
    const sameLand = w.landmass && w.landmass[A.y * w.W + A.x] === w.landmass[best.y * w.W + best.x];
    const canSail = na.tf.rafts || na.tf.sailing;
    let path = sameLand ? findPath(w, A.y * w.W + A.x, best.y * w.W + best.x, { sea: 0, maxNodes: 6000 }) : null;
    let sea = false;
    if (!path && canSail) {
      path = findPath(w, A.y * w.W + A.x, best.y * w.W + best.x, { sea: na.tf.compass ? 2 : 1, maxNodes: 9000 });
      sea = true;
    }
    if (!path) continue;
    const route = { id: (w.routeSeq = (w.routeSeq || 0) + 1), a: A.id, b: best.id, path: path.filter((_, k) => k % 2 === 0 || k === path.length - 1), sea, since: w.tick, value: bv };
    w.routes.push(route);
    count.set(A.id, (count.get(A.id) || 0) + 1);
    count.set(best.id, (count.get(best.id) || 0) + 1);
    const nb = w.nations[best.nation];
    if (na !== nb) {
      const rl = na.rel[nb.id];
      rl.trade++;
      if (!w.flags.firstTrade) {
        w.flags.firstTrade = true;
        log(w, 'civ', `${A.name.z}与${best.name.z}之间开辟了世界上第一条跨国商路。`, { imp: 2, x: A.x, y: A.y, nations: [na.id, nb.id] });
      }
    }
    // roads follow the caravans
    if (!sea && na.tf.wheel) buildRoad(w, path, na.tf.combustion ? 3 : na.tf.railroad ? 2 : 1);
  }
}

/** wealth from trade for each city (yearly), returns map cityId → income */
export function tradeIncome(w) {
  const inc = new Map();
  for (const r of w.routes) {
    const A = w.cities[r.a], B = w.cities[r.b];
    const na = w.nations[A.nation], nb = w.nations[B.nation];
    const v = Math.sqrt(A.pop * B.pop) * 0.0012 * (na === nb ? 0.7 : 1.2) * (r.sea ? 1.25 : 1);
    inc.set(A.id, (inc.get(A.id) || 0) + v);
    inc.set(B.id, (inc.get(B.id) || 0) + v);
  }
  return inc;
}

/** upgrade road networks between a nation's cities (yearly, a little at a time) */
export function connectCities(w, n, rng) {
  if (!n.tf.wheel || n.cities.length < 2 || !rng.chance(0.25)) return;
  const a = w.cities[rng.pick(n.cities)];
  let best = null, bd = 1e9;
  for (const ci of n.cities) {
    const b = w.cities[ci];
    if (b === a) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best || bd > 25 || (w.landmass && w.landmass[a.y * w.W + a.x] !== w.landmass[best.y * w.W + best.x])) return;
  const path = findPath(w, a.y * w.W + a.x, best.y * w.W + best.x, { sea: 0, maxNodes: 6000 });
  if (path) buildRoad(w, path, n.tf.combustion ? 3 : n.tf.railroad ? 2 : 1);
}
