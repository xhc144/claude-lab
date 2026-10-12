// Settlements: founding, food potential of the land they work, growth tiers, the farms, mines and
// streets they spread over the landscape, conquest and destruction (cities leave ruins that later
// peoples may dig up).

import { B, BIOMES, IMP, R } from '../constants.js';
import { RIVER_FLOW } from '../hydro.js';
import { placeName } from '../../core/lang.js';
import { RNG } from '../../core/rng.js';
import { log } from '../chronicle.js';
import { refreshName } from './nation.js';
import { pushFx } from '../state.js';

export const TIERS = [
  { name: '营地', min: 0 },
  { name: '村落', min: 300 },
  { name: '城镇', min: 2000 },
  { name: '城市', min: 10000 },
  { name: '大都会', min: 60000 },
  { name: '超级都市', min: 400000 },
];

export function tierOf(pop) {
  let t = 0;
  for (let k = 0; k < TIERS.length; k++) if (pop >= TIERS[k].min) t = k;
  return t;
}

export function uniqueCityName(w, n, rng) {
  const taken = w.cityNames || (w.cityNames = new Set());
  for (let t = 0; t < 12; t++) {
    const nm = placeName(n.lang, rng);
    if (!taken.has(nm.z)) { taken.add(nm.z); return nm; }
  }
  const nm = placeName(n.lang, rng);
  nm.z += '新城';
  return nm;
}

export function foundCity(w, n, x, y, pop, opts = {}) {
  const rng = new RNG(w.rng.int(1e9));
  x = Math.round(x); y = Math.round(y);
  const c = y * w.W + x;
  const city = {
    id: w.cities.length,
    nation: n.id,
    origNation: n.id,
    name: opts.name || uniqueCityName(w, n, rng),
    x, y,
    pop,
    founded: w.tick,
    alive: true,
    capital: false,
    buildings: [],
    build: null,
    defense: 5,
    maxDefense: 5,
    unrest: 0,
    culture: 0,
    religion: {},
    ideas: {},
    port: w.coastDist[c] <= 2,
    food: 1,
    K: pop,
    tier: tierOf(pop),
    yields: { prod: 0, wealth: 0, sci: 0, culture: 0, faith: 0 },
    disease: 0,
    immunity: 0,
    plague: null,
    cells: 0,
    wonders: [],
    starving: 0,
    prayer: null,
    lastConquest: -1e9,
    garrison: 0,
    blessed: 0,
    inspired: 0,
    sacked: 0,
  };
  // the founders' faith comes with them
  if (n.religion != null) city.religion[n.religion] = 0.9;
  w.cities.push(city);
  n.cities.push(city.id);
  if (n.capital < 0) { n.capital = city.id; city.capital = true; }
  w.impr[c] = IMP.URBAN;
  w.dirty.territory = true;
  w.terrainVersion++;
  pushFx(w, { type: 'found', x: x + 0.5, y: y + 0.5, color: n.color });
  return city;
}

/** how much food a cell yields to a city of nation n (tf: nation's tech flags) */
export function tileFood(w, c, tf) {
  const h = w.elev[c] - w.seaLevel;
  const r = w.res[c];
  if (h < 0 || w.lake[c] > 0) {
    let f = w.lake[c] > 0 ? 0.25 : 0.1;
    if (tf.rafts) f += 0.25;
    if (tf.sailing) f += 0.15;
    if (r === R.FISH) f += tf.rafts ? 1.2 : 0.4;
    return f * (0.5 + w.veg[c]);
  }
  const b = w.biome[c];
  let f = BIOMES[b].food * (0.55 + 0.45 * w.fert[c]);
  if (!tf.agriculture) f = f * 0.6 + w.veg[c] * 0.35; // foragers live off wild plants and game
  if (w.flow[c] > RIVER_FLOW) f += tf.agriculture ? 0.7 : 0.35;
  if (w.coastDist[c] <= 1) f += tf.rafts ? 0.35 : 0.15;
  const im = w.impr[c];
  if (im === IMP.FARM) f += 1.1 * (0.4 + w.fert[c]) * (tf.calendar ? 1.15 : 1);
  else if (im === IMP.PASTURE) f += 0.6;
  else if (im === IMP.URBAN) f *= 0.3;
  if (r === R.HORSE && tf.husbandry) f += 0.4;
  if (r === R.SPICE) f += 0.2;
  if (w.flood[c] > 0.002) f *= 0.4;
  if (w.fire[c] || w.lava[c] > 0) f = 0;
  return f * (1 - Math.min(0.8, w.pollution[c] * 0.8)) * (1 - Math.min(1, w.rad[c] * 1.5));
}

export function cityCell(w, city) {
  return city.y * w.W + city.x;
}

/** destroy a city, leaving ruins. cause is used for the chronicle */
export function destroyCity(w, city, cause, opts = {}) {
  if (!city.alive) return;
  const n = w.nations[city.nation];
  city.alive = false;
  city.fell = w.tick;
  city.pop = 0;
  const i = n.cities.indexOf(city.id);
  if (i >= 0) n.cities.splice(i, 1);
  if (n.capital === city.id) {
    n.capital = -1;
    city.capital = false;
    if (n.cities.length) {
      const nc = w.cities[n.cities.reduce((a, b) => (w.cities[a].pop >= w.cities[b].pop ? a : b))];
      n.capital = nc.id;
      nc.capital = true;
    }
  }
  const c = cityCell(w, city);
  const underwater = w.elev[c] < w.seaLevel;
  w.ruins.push({ x: city.x, y: city.y, name: city.name.z, nation: n.name, era: n.era, year: w.startYear + Math.floor(w.tick / 4), wonders: city.wonders.slice(), underwater, discovered: false, cause });
  // the urban area crumbles into ruin
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = city.x + dx, yy = city.y + dy;
    if (xx < 0 || yy < 0 || xx >= w.W || yy >= w.H) continue;
    const cc = yy * w.W + xx;
    if (w.impr[cc] === IMP.URBAN) w.impr[cc] = IMP.RUIN;
  }
  w.impr[c] = IMP.RUIN;
  w.dirty.territory = true;
  w.terrainVersion++;
  if (!opts.silent) log(w, opts.cat || 'civ', opts.text || `${n.name}的${city.name.z}${cause}，化为废墟。`, { imp: city.tier >= 3 ? 2 : 1, x: city.x, y: city.y, nations: [n.id] });
  checkNationDeath(w, n, cause);
}

/** a nation with no cities left is gone */
export function checkNationDeath(w, n, cause = '') {
  if (n.alive && n.cities.length === 0) {
    n.alive = false;
    n.fell = w.tick;
    for (const k in n.rel) { const r = n.rel[k]; if (r.state !== 'peace') r.state = 'peace'; }
    log(w, 'civ', `${n.name}灭亡了。立国 ${Math.round((w.tick - n.founded) / 4)} 年。`, { imp: n.peakCities >= 5 ? 3 : 2, nations: [n.id] });
    return true;
  }
  return false;
}

/** change a city's owner (conquest, secession, cession) */
export function transferCity(w, city, to, how = 'conquest') {
  const from = w.nations[city.nation];
  if (from.id === to.id) return;
  const i = from.cities.indexOf(city.id);
  if (i >= 0) from.cities.splice(i, 1);
  if (from.capital === city.id) {
    from.capital = -1;
    city.capital = false;
    if (from.cities.length) {
      const nc = w.cities[from.cities.reduce((a, b) => (w.cities[a].pop >= w.cities[b].pop ? a : b))];
      from.capital = nc.id;
      nc.capital = true;
      if (how === 'conquest') from.stability -= 0.15;
    }
  }
  city.nation = to.id;
  to.cities.push(city.id);
  if (to.capital < 0) { to.capital = city.id; city.capital = true; }
  city.lastConquest = w.tick;
  city.unrest = Math.min(1, city.unrest + (how === 'conquest' ? 0.45 : 0.15));
  city.siege = 0;
  w.dirty.territory = true;
  checkNationDeath(w, from, how);
  if (!from.alive) refreshName(from);
}

/** spread farms, pastures, mines and the urban footprint around a city (yearly, a few cells at a time) */
export function developLand(w, city, n, rng) {
  const tf = n.tf;
  const tier = city.tier;
  const radius = 2 + tier;
  const urbanWanted = Math.min(24, Math.floor(Math.sqrt(city.pop / 900)));
  let urban = 0;
  const cands = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = city.x + dx, y = city.y + dy;
      if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
      const c = y * w.W + x;
      if (w.ownerCity[c] !== city.id && !(dx === 0 && dy === 0)) continue;
      if (w.elev[c] < w.seaLevel || w.lake[c] > 0) continue;
      const d = Math.hypot(dx, dy);
      if (w.impr[c] === IMP.URBAN) { urban++; continue; }
      cands.push([c, d]);
    }
  }
  cands.sort((a, b) => a[1] - b[1]);
  let changes = 0;
  // urban sprawl grows from the centre outwards
  for (const [c, d] of cands) {
    if (urban >= urbanWanted || changes > 3) break;
    if (d <= 1.5 + tier * 0.6 && w.impr[c] !== IMP.RUIN) { w.impr[c] = IMP.URBAN; urban++; changes++; }
  }
  for (const [c, d] of cands) {
    if (changes > 4) break;
    const im = w.impr[c];
    const b = w.biome[c];
    const r = w.res[c];
    if (im === IMP.NONE || im === IMP.RUIN) {
      if (tf.bronze && (r === R.COPPER || r === R.IRON || r === R.GOLD || r === R.GEMS || r === R.MARBLE || (r === R.COAL && tf.steam) || (r === R.URANIUM && tf.fission))) { w.impr[c] = IMP.MINE; changes++; }
      else if (r === R.OIL && tf.combustion) { w.impr[c] = IMP.WELL; changes++; }
      else if (tf.agriculture && d <= radius && w.fert[c] > 0.3 && b !== B.MOUNTAIN && b !== B.SNOWPEAK && b !== B.ICE && b !== B.DESERT && b !== B.SWAMP && rng.chance(0.5)) {
        w.impr[c] = (tf.husbandry && (b === B.GRASS || b === B.SAVANNA || b === B.SHRUB || b === B.TUNDRA) && rng.chance(0.45)) ? IMP.PASTURE : IMP.FARM;
        // clearing land: forests are cut down
        w.veg[c] = Math.min(w.veg[c], 0.35);
        changes++;
      } else if (tf.renewables && b === B.DESERT && rng.chance(0.2)) { w.impr[c] = IMP.SOLAR; changes++; }
    }
  }
  if (changes) w.terrainVersion++;
  return changes;
}
