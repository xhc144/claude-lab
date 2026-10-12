// The civilisation orchestrator: awakening of sapient species into tribes, city growth and
// yields, research, construction of buildings and wonders, expansion by settlers, hunting and
// domestication, catastrophes hitting cities, archaeology, great persons — and the yearly
// schedule that calls the diplomacy, war, faith, ideas, economy and society modules.

import { G } from '../constants.js';
import { log } from '../chronicle.js';
import { pushFx, year, timeFactor } from '../state.js';
import { BUILDINGS, WONDERS, WONDER, TECH, GOVS } from './data.js';
import { createNation, rel } from './nation.js';
import { foundCity, tierOf, TIERS, destroyCity, developLand, tileFood } from './city.js';
import { findPath, labelLandmasses } from './path.js';
import { computeTerritory } from './territory.js';
import { techFlags, addResearch, grantTech, grantUpToEra, effectiveCost } from './tech.js';
import { computeAccess, updateTrade, tradeIncome, connectCities } from './economy.js';
import { folkReligion, stepMythogenesis, spreadReligions, updateStateReligion, maybeSchism, updatePrayers, createReligion, normalize } from './religion.js';
import { stepIdeaOrigins, spreadIdeas, stepNationIdeas } from './ideas.js';
import { newRuler, stepRuler, rulerTraitSum, createPerson, fullName } from './people.js';
import { stepArmies, militaryAI, maxDefense, considerNukes } from './war.js';
import { computeBorders, stepDiplomacy } from './diplomacy.js';
import { stepStability, stepUnrest, stepSocietyNation, maybeFederation, stepDisease } from './society.js';
import { forCreaturesNear, killCreature } from '../life/creatures.js';
import { prof, now } from '../../core/prof.js';

export function initCiv(w) {
  w.nations = [];
  w.cities = [];
  w.armies = [];
  w.settlers = [];
  w.routes = [];
  w.religions = [];
  w.persons = [];
  w.ruins = [];
  w.techFirsts = {};
  w.eraFirsts = {};
  w.wondersBuilt = {};
  w.ideaBorn = {};
  w.divine = { energy: 120, answered: 0, total: 0 };
  w.cityNames = new Set();
  w.dirty.territory = true;
}

// ---- founding peoples -----------------------------------------------------------------------------

/** find a good spot near (x, y) for a settlement of species sp */
function settleSpot(w, x, y, sp, rng, r = 10) {
  let best = null, bs = -1e9;
  const tf = {};
  for (let t = 0; t < 120; t++) {
    const px = Math.round(x + (rng.next() - 0.5) * 2 * r), py = Math.round(y + (rng.next() - 0.5) * 2 * r);
    if (px < 2 || py < 2 || px >= w.W - 2 || py >= w.H - 2) continue;
    const c = py * w.W + px;
    if (w.elev[c] < w.seaLevel + 0.003 || w.lake[c] > 0 || w.lava[c] > 0) continue;
    if (w.cities.some((k) => k.alive && Math.abs(k.x - px) < 4 && Math.abs(k.y - py) < 4)) continue;
    const T = w.baseTemp[c] + w.climate.offset;
    const topt = sp ? -16 + sp.ref[G.warmth] * 50 : 15;
    let s = -Math.abs(T - topt) * 0.15;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = px + dx, yy = py + dy;
      if (xx < 0 || yy < 0 || xx >= w.W || yy >= w.H) continue;
      s += tileFood(w, yy * w.W + xx, tf) * 0.4;
    }
    if (w.flow[c] > 14) s += 2;
    if (w.coastDist[c] <= 1) s += 1;
    s -= Math.hypot(px - x, py - y) * 0.05;
    if (s > bs) { bs = s; best = { x: px, y: py }; }
  }
  return best;
}

export function foundTribe(w, spId, x, y, opts = {}) {
  const rng = w.rng;
  const sp = spId != null ? w.species[spId] : null;
  const spot = opts.exact ? { x: Math.round(x), y: Math.round(y) } : settleSpot(w, x, y, sp, rng, opts.r || 10);
  if (!spot) return null;
  const n = createNation(w, { species: spId, gov: opts.gov || 'tribe' });
  techFlags(n);
  if (opts.era != null) grantUpToEra(n, opts.era);
  if (sp) sp.nations.push(n.id);
  const city = foundCity(w, n, spot.x, spot.y, opts.pop || 70 + rng.int(60));
  folkReligion(w, n, city);
  newRuler(w, n, 'founder');
  // members of the species nearby join the tribe
  if (sp) {
    let joined = 0;
    forCreaturesNear(w, spot.x, spot.y, 10, (j) => { if (w.life.sp[j] === spId && joined < 20) { killCreature(w, j, 'old'); joined++; } });
  }
  w.dirty.territory = true;
  if (!opts.silent) {
    log(w, 'civ', opts.text || `${sp ? sp.name : '先民'}在${city.name.z}点燃了篝火，${n.name}诞生了。`, { imp: w.flags.firstTribe ? 1 : 3, x: city.x, y: city.y, nations: [n.id] });
  }
  w.flags.firstTribe = true;
  return n;
}

function processAwakenings(w) {
  const rng = w.rng;
  for (const a of w.awakenings) {
    const sp = w.species[a.sp];
    log(w, 'life', `智慧的曙光：${sp.name}开始制造工具、用声音交流、埋葬死者。它们已不再只是动物。`, { imp: 3, x: a.x, y: a.y });
    foundTribe(w, a.sp, a.x, a.y);
    // a far-flung population may awaken separately
    const L = w.life;
    for (let t = 0; t < 40; t++) {
      const i = rng.int(L.hi);
      if (!L.alive[i] || L.sp[i] !== a.sp) continue;
      if (Math.hypot(L.x[i] - a.x, L.y[i] - a.y) > 35) { foundTribe(w, a.sp, L.x[i], L.y[i]); break; }
    }
  }
  w.awakenings = [];
}

// ---- growth -------------------------------------------------------------------------------------

function foodMultiplier(n) {
  const tf = n.tf;
  let m = tf.agriculture ? 110 : 26;
  if (tf.fire) m *= 1.1;
  if (tf.calendar) m *= 1.12;
  if (tf.engineering) m *= 1.1;
  if (tf.feudalism) m *= 1.05;
  if (tf.guilds) m *= 1.05;
  if (tf.industry) m *= 1.5;
  if (tf.railroad) m *= 1.25;
  if (tf.chemistry) m *= 1.3;
  if (tf.sanitation) m *= 1.3;
  if (tf.greenrev) m *= 2.2;
  if (tf.genetics) m *= 1.4;
  if (tf.terraforming) m *= 1.3;
  if (n.domestic != null) m *= 1.15;
  if (n.goldenAge > 0) m *= 1.1;
  return m;
}

function cityCapacity(w, c, n) {
  const b = c.buildings;
  let k = Math.max(0.5, c.food) * foodMultiplier(n);
  if (b.includes('granary')) k *= 1.15;
  if (b.includes('aqueduct')) k *= 1.3;
  if (b.includes('hospital')) k *= 1.2;
  if (b.includes('arcology')) k *= 1.5;
  if (b.includes('harbor')) k *= 1.08;
  if (c.capital) k *= 1.15;
  if (c.blessed > 0) k *= 1.35;
  // big cities import food along their trade routes
  if (c.tier >= 2) k *= 1 + Math.min(2.5, (c.routes || 0) * 0.18);
  if (c.huntFood) k += c.huntFood;
  if (!n.tf.agriculture) k = Math.min(k, 900);
  return k;
}

function growCities(w, dt0) {
  for (const c of w.cities) {
    if (!c.alive) continue;
    const dt = w.bubbles.length ? dt0 * timeFactor(w, c.x, c.y) : dt0;
    const n = w.nations[c.nation];
    const K = (c.K = cityCapacity(w, c, n));
    const tf = n.tf;
    let r = tf.agriculture ? 0.03 : 0.015;
    if (tf.sanitation) r = 0.035;
    if (tf.networks) r = 0.014; // demographic transition
    if (c.pop < K) c.pop += r * c.pop * (1 - c.pop / K) * dt + 0.5 * dt;
    else c.pop -= (c.pop - K) * 0.12 * dt;
    c.starving = c.pop > K * 1.06 ? c.starving + dt : 0;
    const cell = c.y * w.W + c.x;
    if (w.flood[cell] > 0.002) c.pop *= 1 - 0.02 * dt;
    if (w.lava[cell] > 0.001) { destroyCity(w, c, '被熔岩吞没', { cat: 'nature' }); continue; }
    if (w.fire[cell]) c.pop *= 1 - 0.01 * dt;
    if (c.pop < 8) { destroyCity(w, c, '人去城空', { cat: 'society' }); continue; }
    const t = tierOf(c.pop);
    if (t !== c.tier) {
      if (t > c.tier && t >= 4 && !c[`tier${t}`]) {
        c[`tier${t}`] = true;
        log(w, 'civ', `${n.name}的${c.name.z}成长为${TIERS[t].name}，人口突破 ${TIERS[t].min.toLocaleString()}。`, { imp: t >= 5 ? 2 : 1, x: c.x, y: c.y, nations: [n.id] });
      }
      c.tier = t;
      w.dirty.territory = true;
    }
    // defences recover when not under siege
    c.maxDefense = maxDefense(w, c);
    if (w.tick - c.siege > 2) c.defense = Math.min(c.maxDefense, c.defense + c.maxDefense * 0.04 * dt * 4);
    if (c.blessed > 0) c.blessed -= dt;
    if (c.inspired > 0) c.inspired -= dt;
  }
}

// ---- yields, research, construction -------------------------------------------------------------

function yields(w, rng) {
  const income = tradeIncome(w);
  const routes = new Map();
  for (const r of w.routes) { routes.set(r.a, (routes.get(r.a) || 0) + 1); routes.set(r.b, (routes.get(r.b) || 0) + 1); }
  for (const n of w.nations) {
    if (!n.alive) continue;
    const st = n.stats;
    st.pop = 0; st.sci = 0; st.wealth = 0; st.prod = 0; st.culture = 0; st.faith = 0; st.cities = n.cities.length;
    const g = GOVS[n.gov];
    const sciMul = g.sci * (1 + rulerTraitSum(w, n, 'sci')) * (n.goldenAge > 0 ? 1.25 : 1) * (n.darkAge > 0 ? 0.6 : 1) * (0.45 + n.traits.intel * 0.9);
    let emissions = 0;
    for (const ci of n.cities) {
      const c = w.cities[ci];
      const b = c.buildings;
      const has = (id) => b.includes(id);
      const p = c.pop;
      c.routes = routes.get(c.id) || 0;
      let prod = Math.pow(p, 0.62) * 0.06 * (1 + (has('workshop') ? 0.4 : 0) + (has('factory') ? 1 : 0) + (has('powerplant') ? 0.8 : 0) + (has('nuclear') ? 1 : 0) + (has('solar') ? 0.6 : 0));
      if (n.access && n.access.iron) prod *= 1.1;
      if (n.tf.steam && n.access && n.access.coal) prod *= 1.2;
      prod *= 1 + rulerTraitSum(w, n, 'build') * 0.5;
      let wealth = Math.pow(p, 0.6) * 0.05 * (1 + (has('market') ? 0.35 : 0) + (has('bank') ? 0.6 : 0)) * g.wealth * (1 + rulerTraitSum(w, n, 'wealth')) + (income.get(c.id) || 0);
      if (n.access && n.access.gold) wealth *= 1.15;
      let sci = (w.bubbles.length ? timeFactor(w, c.x, c.y) : 1) * Math.pow(p, 0.56) * 0.04 * (1 + (has('library') ? 0.4 : 0) + (has('university') ? 0.8 : 0) + (has('lab') ? 1.2 : 0)) * sciMul * (c.inspired > 0 ? 2.5 : 1);
      const culture = Math.pow(p, 0.5) * 0.03 * (1 + c.wonders.length * 0.5 + (has('broadcast') ? 0.5 : 0) + (has('temple') ? 0.2 : 0)) * (1 + rulerTraitSum(w, n, 'culture'));
      const faith = Math.pow(p, 0.5) * 0.03 * (1 + (has('shrine') ? 0.3 : 0) + (has('temple') ? 0.6 : 0)) * (0.5 + Math.max(0, n.values.piety)) * (1 + rulerTraitSum(w, n, 'faith'));
      c.yields.prod = prod; c.yields.wealth = wealth; c.yields.sci = sci; c.yields.culture = culture; c.yields.faith = faith;
      c.culture += culture;
      st.pop += p; st.prod += prod; st.wealth += wealth; st.sci += sci; st.culture += culture; st.faith += faith;
      // industry pollutes
      let e = (has('factory') ? 0.012 : 0) + (has('powerplant') ? 0.02 : 0) + (n.tf.combustion ? 0.01 : 0) + (n.tf.steam && !has('factory') ? 0.003 : 0);
      if (e > 0) {
        e *= Math.sqrt(p / 100000) * (has('solar') ? 0.35 : 1) * (n.tf.renewables ? 0.6 : 1) * (n.ideas.ecology ? 0.7 : 1);
        emissions += e;
        const rr = 2 + c.tier * 0.6;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const xx = c.x + dx, yy = c.y + dy;
          if (xx < 0 || yy < 0 || xx >= w.W || yy >= w.H || dx * dx + dy * dy > rr * rr) continue;
          const cc = yy * w.W + xx;
          w.pollution[cc] = Math.min(1, w.pollution[cc] + e * 1.2);
        }
      }
      // building / wonder progress
      construct(w, n, c, prod, rng);
    }
    // planetary engineers pull carbon back out of the sky when it runs high
    if (n.tf.terraforming && w.climate.co2 > 320) emissions -= 0.03 * n.cities.filter((ci) => w.cities[ci].buildings.includes('spaceport') || w.cities[ci].buildings.includes('arcology')).length;
    w.climate.co2 += emissions;
    n.emissions = emissions;
    const upkeep = n.cities.reduce((s, ci) => s + w.cities[ci].buildings.length * 0.15, 0) + w.armies.filter((a) => a.nation === n.id).reduce((s, a) => s + a.str * 0.002, 0);
    n.treasury += st.wealth - upkeep;
    if (n.treasury < -50) { n.stability -= 0.05; n.treasury = -50; }
    const done = addResearch(w, n, st.sci);
    if (done) { const ld = w.persons[n.leader]; if (ld) ld.stats.techs++; }
    if (st.pop > n.peakPop) n.peakPop = st.pop;
    if (n.cities.length > n.peakCities) n.peakCities = n.cities.length;
  }
}

function chooseBuild(w, n, c) {
  const has = (id) => c.buildings.includes(id);
  const v = n.values;
  const atWar = Object.values(n.rel).some((r) => r.state === 'war');
  // wonders: big cities of builder nations
  if (c.tier >= 2 && !n.cities.some((ci) => w.cities[ci].build && w.cities[ci].build.wonder)) {
    const av = WONDERS.filter((x) => !w.wondersBuilt[x.id] && n.techs[TECH[x.tech].i]);
    if (av.length && w.rng.chance(0.25 + rulerTraitSum(w, n, 'build'))) {
      const x = av[0];
      return { id: x.id, wonder: true, prog: 0, cost: x.cost };
    }
  }
  const opts = BUILDINGS.filter((b) => !has(b.id) && n.techs[TECH[b.tech].i]);
  if (!opts.length) return null;
  const pick = w.rng.weighted(opts, (b) => {
    let s = 1;
    switch (b.id) {
      case 'granary': case 'aqueduct': case 'hospital': case 'arcology': s = c.pop > c.K * 0.8 ? 3 : 1; break;
      case 'walls': case 'castle': s = atWar ? 4 : 0.8 + Math.max(0, v.mil); break;
      case 'barracks': s = 0.5 + Math.max(0, v.mil) * 2 + (atWar ? 2 : 0); break;
      case 'library': case 'university': case 'lab': s = 1.5 + Math.max(0, -v.trad) * 2; break;
      case 'market': case 'bank': s = 1.2 + Math.max(0, v.open) + (c.routes || 0) * 0.5; break;
      case 'shrine': case 'temple': s = 0.8 + Math.max(0, v.piety) * 2.5; break;
      case 'harbor': s = c.port ? 2.5 : 0; break;
      case 'factory': case 'powerplant': s = 2.5 * (n.ideas.ecology ? 0.4 : 1); break;
      case 'solar': s = 1 + (n.ideas.ecology ? 3 : 0) + (w.climate.offset > 1.5 ? 2 : 0); break;
      case 'nuclear': s = n.access && n.access.uranium ? 1.5 : 0.2; break;
      default: s = 1;
    }
    return s / (1 + b.cost / 200);
  });
  return pick ? { id: pick.id, wonder: false, prog: 0, cost: pick.cost } : null;
}

function construct(w, n, c, prod, rng) {
  if (!c.build) c.build = chooseBuild(w, n, c);
  if (!c.build) return;
  const b = c.build;
  if (b.wonder && w.wondersBuilt[b.id]) { c.build = null; return; } // someone else finished first
  b.prog += prod;
  if (b.prog < b.cost) return;
  c.build = null;
  if (b.wonder) {
    const x = WONDER[b.id];
    w.wondersBuilt[b.id] = { nation: n.id, city: c.id, tick: w.tick };
    c.wonders.push(b.id);
    n.wonders.push(b.id);
    c.culture += 500;
    const ld = w.persons[n.leader]; if (ld) ld.stats.wonders++;
    log(w, 'culture', `奇观落成：${n.name}在${c.name.z}建成了「${x.name}」——${x.desc}。`, { imp: 2, x: c.x, y: c.y, nations: [n.id] });
    pushFx(w, { type: 'wonder', x: c.x + 0.5, y: c.y + 0.5, color: n.color });
    if (b.id === 'ark') launchArk(w, n, c);
  } else {
    c.buildings.push(b.id);
  }
}

function launchArk(w, n, c) {
  const leaving = c.pop * 0.3;
  c.pop -= leaving;
  n.ascended += leaving;
  w.flags.arkLaunched = true;
  log(w, 'science', `星舟方舟从${c.name.z}升空，载着 ${Math.round(leaving).toLocaleString()} 名${n.adj}飞向群星。这个世界的孩子，第一次离开了摇篮。`, { imp: 3, x: c.x, y: c.y, nations: [n.id] });
  pushFx(w, { type: 'launch', x: c.x + 0.5, y: c.y + 0.5 });
}

// ---- expansion ----------------------------------------------------------------------------------

function cityLimit(w, n) {
  return Math.round((3 + n.era * 2.2 + (n.tf.agriculture ? 4 : 0) + (n.tf.sailing ? 3 : 0)) * (1 + rulerTraitSum(w, n, 'expand')) * (0.8 + Math.max(0, n.values.mil) * 0.3 + Math.max(0, n.values.open) * 0.2));
}

function chooseSite(w, n, src, rng) {
  const sp = n.species != null ? w.species[n.species] : null;
  const topt = sp ? -16 + sp.ref[G.warmth] * 50 : 15;
  const R = 9 + n.era * 1.6 + (n.tf.rafts ? 4 : 0) + (n.tf.sailing ? 8 : 0);
  const srcLand = w.landmass[src.y * w.W + src.x];
  let best = null, bs = 0;
  for (let t = 0; t < 70; t++) {
    const a = rng.next() * Math.PI * 2, d = 4 + rng.next() * R;
    const x = Math.round(src.x + Math.cos(a) * d), y = Math.round(src.y + Math.sin(a) * d);
    if (x < 2 || y < 2 || x >= w.W - 2 || y >= w.H - 2) continue;
    const c = y * w.W + x;
    if (w.elev[c] < w.seaLevel + 0.003 || w.lake[c] > 0 || w.lava[c] > 0 || w.rad[c] > 0.2) continue;
    if (w.owner[c] >= 0 && w.owner[c] !== n.id) continue;
    if (w.cities.some((k) => k.alive && Math.abs(k.x - x) < 5 && Math.abs(k.y - y) < 5 && Math.hypot(k.x - x, k.y - y) < 4.6)) continue;
    const overseas = w.landmass[c] !== srcLand;
    if (overseas && !(n.tf.rafts && d < 10) && !n.tf.sailing) continue;
    const T = w.baseTemp[c] + w.climate.offset;
    if (Math.abs(T - topt) > 22) continue;
    let s = 0;
    for (let k = 0; k < 13; k++) {
      const xx = x + [0, 1, -1, 0, 0, 2, -2, 0, 0, 1, 1, -1, -1][k], yy = y + [0, 0, 0, 1, -1, 0, 0, 2, -2, 1, -1, 1, -1][k];
      if (xx < 0 || yy < 0 || xx >= w.W || yy >= w.H) continue;
      s += tileFood(w, yy * w.W + xx, n.tf);
    }
    if (w.flow[c] > 14) s += 2.5;
    if (w.coastDist[c] <= 1) s += 1.2;
    if (w.res[c]) s += 0.6;
    s -= Math.abs(T - topt) * 0.08 + d * 0.08 + (overseas ? 1 : 0);
    if (s > bs) { bs = s; best = { x, y, overseas }; }
  }
  return bs > 3 ? best : null;
}

/** found count cities for nation n right away (scenario starts) */
export function expandNation(w, n, count, pop = 2000) {
  const rng = w.rng;
  if (!w.landmass || w.landmassVersion !== w.elevVersion) labelLandmasses(w);
  computeTerritory(w);
  let made = 0;
  for (let k = 0; k < count * 4 && made < count; k++) {
    const src = w.cities[rng.pick(n.cities)];
    const site = chooseSite(w, n, src, rng);
    if (!site || site.overseas) continue;
    const city = foundCity(w, n, site.x, site.y, pop * (0.6 + rng.next() * 0.8));
    if (n.religion != null) city.religion[n.religion] = 0.9;
    computeTerritory(w);
    made++;
  }
  return made;
}

function expansion(w, rng) {
  for (const n of w.nations) {
    if (!n.alive || !n.cities.length) continue;
    if (n.cities.length >= cityLimit(w, n)) continue;
    if (w.settlers.filter((s) => s.nation === n.id).length >= 1 + Math.floor(n.cities.length / 6)) continue;
    const thresh = n.tf.agriculture ? 700 : 110;
    const srcs = n.cities.map((ci) => w.cities[ci]).filter((c) => c.pop > thresh && c.pop > c.K * 0.55);
    if (!srcs.length || !rng.chance(0.35)) continue;
    const src = rng.pick(srcs);
    const site = chooseSite(w, n, src, rng);
    if (!site) continue;
    const sea = site.overseas ? (n.tf.compass ? 2 : 1) : 0;
    const path = findPath(w, src.y * w.W + src.x, site.y * w.W + site.x, { sea, maxNodes: 7000 });
    if (!path) continue;
    const people = Math.max(30, src.pop * 0.12);
    src.pop -= people;
    w.settlers.push({ id: (w.settlerSeq = (w.settlerSeq || 0) + 1), nation: n.id, x: src.x + 0.5, y: src.y + 0.5, tx: site.x, ty: site.y, path, pi: 0, pop: people, from: src.id, born: w.tick, naval: false });
  }
}

function stepSettlers(w, rng) {
  for (const s of w.settlers) {
    const n = w.nations[s.nation];
    if (!n.alive) { s.done = true; continue; }
    let speed = 0.4;
    while (speed > 0 && s.pi < s.path.length) {
      const nc = s.path[s.pi];
      const tx = (nc % w.W) + 0.5, ty = Math.floor(nc / w.W) + 0.5;
      const d = Math.hypot(tx - s.x, ty - s.y);
      if (d <= speed) { s.x = tx; s.y = ty; s.pi++; speed -= d; } else { s.x += ((tx - s.x) / d) * speed; s.y += ((ty - s.y) / d) * speed; speed = 0; }
    }
    const c0 = Math.floor(s.y) * w.W + Math.floor(s.x);
    s.naval = w.elev[c0] < w.seaLevel;
    if (s.pi >= s.path.length) {
      s.done = true;
      const c = s.ty * w.W + s.tx;
      const blocked = (w.owner[c] >= 0 && w.owner[c] !== n.id) || w.cities.some((k) => k.alive && Math.hypot(k.x - s.tx, k.y - s.ty) < 4.2) || w.elev[c] < w.seaLevel;
      if (blocked) {
        const home = w.cities[s.from];
        if (home && home.alive) home.pop += s.pop;
        continue;
      }
      const city = foundCity(w, n, s.tx, s.ty, s.pop);
      if (n.religion != null) city.religion[n.religion] = 0.8;
      const src = w.cities[s.from];
      if (src) for (const id in src.ideas) city.ideas[id] = src.ideas[id] * 0.8;
      if (!w.flags.firstColony && s.naval !== undefined && w.landmass[c] !== w.landmass[src.y * w.W + src.x]) {
        w.flags.firstColony = true;
        log(w, 'civ', `${n.adj}的船队越过大海，在新的土地上建立了${city.name.z}。`, { imp: 2, x: city.x, y: city.y, nations: [n.id] });
      }
    }
  }
  w.settlers = w.settlers.filter((s) => !s.done);
}

// ---- creatures and cities ----------------------------------------------------------------------

function huntAndTame(w, rng) {
  const L = w.life;
  for (const c of w.cities) {
    if (!c.alive) continue;
    const n = w.nations[c.nation];
    c.huntFood = 0;
    if (n.tf.industry) continue;
    const r = 3 + c.tier;
    let caught = 0;
    const maxCatch = 1 + c.tier;
    forCreaturesNear(w, c.x + 0.5, c.y + 0.5, r, (j) => {
      if (caught >= maxCatch) return false;
      const sp = w.species[L.sp[j]];
      if (sp.domestic === n.id || sp.sapient) return;
      if (L.pHab[j] === 0 && !n.tf.rafts) return;
      // big slow animals are the easiest prey for organised hunters
      const p = 0.25 + L.pSize[j] * 0.2 - L.pSpeed[j] * 0.4 - L.pArmor[j] * 0.2;
      if (rng.next() < p) {
        c.huntFood += 25 + L.pSize[j] * 40;
        killCreature(w, j, 'hunted');
        caught++;
      }
    });
    // dangerous beasts prey on small settlements
    if (c.tier <= 1 && rng.chance(0.2)) {
      forCreaturesNear(w, c.x + 0.5, c.y + 0.5, 2.5, (j) => {
        if (L.pDiet[j] > 0.6 && L.pSize[j] > 1.2 && L.pAggr[j] > 0.55) {
          c.pop *= 0.96;
          if (rng.chance(0.15)) log(w, 'nature', `${w.species[L.sp[j]].name}袭击了${c.name.z}，村民们心惊胆战。`, { imp: 1, x: c.x, y: c.y, nations: [n.id] });
          return false;
        }
      });
    }
  }
  // domestication
  for (const n of w.nations) {
    if (!n.alive || n.domestic != null || !n.tf.husbandry || !n.cities.length || !rng.chance(0.3)) continue;
    const c = w.cities[rng.pick(n.cities)];
    let found = -1;
    forCreaturesNear(w, c.x + 0.5, c.y + 0.5, 8, (j) => {
      const sp = w.species[L.sp[j]];
      if (sp.sapient || sp.domestic != null || L.pHab[j] !== 2) return;
      if (L.pDiet[j] < 0.45 && L.pAggr[j] < 0.55 && L.pSocial[j] > 0.35 && L.pIntel[j] < 0.45) { found = L.sp[j]; return false; }
    });
    if (found >= 0) {
      const sp = w.species[found];
      sp.domestic = n.id;
      n.domestic = found;
      log(w, 'civ', `${n.adj}驯化了${sp.name}。从此它们拉车、产奶、随人迁徙${sp.ref[G.size] > 0.5 && sp.ref[G.speed] > 0.45 ? '，也驮着战士冲锋陷阵' : ''}。`, { imp: 2, x: c.x, y: c.y, nations: [n.id] });
    }
  }
}

// ---- catastrophes -------------------------------------------------------------------------------

export function applyImpactsToCiv(w, impacts) {
  for (const im of impacts) {
    for (const c of w.cities) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x + 0.5 - im.x, c.y + 0.5 - im.y);
      if (d > im.r) continue;
      const k = 1 - d / im.r;
      const n = w.nations[c.nation];
      switch (im.kind) {
        case 'meteor':
          if (d < im.r * 0.5) destroyCity(w, c, '被天降陨石夷为平地', { cat: 'nature' });
          else c.pop *= 1 - 0.7 * k;
          break;
        case 'eruption':
          if (d < im.r * 0.4 && w.rng.chance(0.5)) destroyCity(w, c, '被火山喷发吞没', { cat: 'nature' });
          else c.pop *= 1 - 0.4 * k;
          break;
        case 'quake': {
          const loss = Math.min(0.5, (im.power - 5) * 0.06 * k * (n.era >= 7 ? 0.4 : 1));
          c.pop *= 1 - loss;
          c.defense *= 0.5;
          if (loss > 0.08 && c.buildings.length && w.rng.chance(0.4)) c.buildings.splice(w.rng.int(c.buildings.length), 1);
          if (loss > 0.12) log(w, 'nature', `强烈地震袭击${c.name.z}，约 ${Math.round(loss * 100)}% 的居民罹难。`, { imp: c.tier >= 3 ? 2 : 1, x: c.x, y: c.y, nations: [n.id] });
          break;
        }
        case 'tsunami':
          if (w.coastDist[c.y * w.W + c.x] <= 3) {
            c.pop *= 1 - 0.35 * k;
            if (k > 0.3) log(w, 'nature', `海啸吞没了${c.name.z}的海岸。`, { imp: 1, x: c.x, y: c.y, nations: [n.id] });
          }
          break;
        case 'nuke':
          break; // handled by the strike itself
        case 'smite':
          break;
        default:
      }
      if (c.alive && c.pop < 8) destroyCity(w, c, '在灾难中毁灭', { cat: 'nature' });
    }
    if (im.kind === 'smite') {
      for (const a of w.armies) if (a.alive && Math.hypot(a.x - im.x, a.y - im.y) < im.r) { a.str *= 0.15; a.morale = 0; a.state = 'return'; if (a.str < 10) a.alive = false; }
    }
  }
}

/** cities on cells that sank below the sea are lost */
function checkDrowned(w) {
  for (const c of w.cities) {
    if (!c.alive) continue;
    // dykes hold back a little water; modern ones a little more
    if (w.elev[c.y * w.W + c.x] < w.seaLevel - (w.nations[c.nation].tf.industry ? 0.004 : 0.0015)) {
      const n = w.nations[c.nation];
      destroyCity(w, c, '沉入了上涨的海水', { cat: 'nature', text: `海平面上涨，${n.name}的${c.name.z}沉入大海，只留下水下的废墟。` });
      w.flags.drownedCity = true;
    }
  }
}

// ---- archaeology, great people -----------------------------------------------------------------

function archaeology(w, rng) {
  for (const r of w.ruins) {
    if (r.discovered) continue;
    const c = r.y * w.W + r.x;
    const o = w.owner[c];
    if (o < 0) continue;
    const n = w.nations[o];
    if (!n.tf.writing || !rng.chance(0.05)) continue;
    r.discovered = true;
    r.discoveredBy = n.id;
    n.researchPts += 40 + r.era * 30;
    const cap = w.cities[n.capital];
    if (cap) cap.culture += 100 + r.wonders.length * 400;
    w.flags.archaeology = true;
    log(w, 'culture', `${n.adj}的学者在${r.underwater ? '浅海之下' : '荒野之中'}发掘出古城「${r.name}」的遗迹——那是 ${year(w) - r.year} 年前的${r.nation}。${r.wonders.length ? '残存的奇观令世人惊叹。' : ''}`, { imp: r.wonders.length ? 2 : 1, x: r.x, y: r.y, nations: [n.id] });
  }
}

function greatPeople(w, n, rng) {
  const p0 = 0.02 + n.stats.culture * 0.0004 + n.stats.sci * 0.0002;
  if (!n.cities.length || !rng.chance(Math.min(0.15, p0))) return;
  const atWar = Object.values(n.rel).some((r) => r.state === 'war');
  const roles = [['scientist', 1 + n.stats.sci * 0.02], ['artist', 1 + n.stats.culture * 0.02], ['merchant', 0.6 + (n.stats.wealth > 20 ? 1 : 0)], ['prophet', 0.4 + Math.max(0, n.values.piety) * 1.5], ['explorer', n.tf.sailing ? 0.8 : 0.1], ['general', atWar ? 1.5 : 0.1]];
  const role = rng.weighted(roles, (r) => r[1])[0];
  const city = w.cities[rng.weighted(n.cities, (ci) => w.cities[ci].pop)];
  const p = createPerson(w, n, role, { city: city.id, age: 25 + rng.int(20) });
  const name = fullName(p);
  let text = '';
  switch (role) {
    case 'scientist': {
      const t = n.research ? TECH[n.research] : null;
      if (t) {
        n.researchPts += effectiveCost(w, n, t) * 0.45;
        p.deeds.push(`推动「${t.name}」的研究`);
        text = `${city.name.z}的天才学者${name}在「${t.name}」上取得了重大突破。`;
      }
      break;
    }
    case 'artist': city.culture += 400; p.deeds.push('传世杰作'); text = `${city.name.z}的艺术家${name}创作出传世之作，${n.adj}文化之名远播四方。`; break;
    case 'merchant': n.treasury += 150; p.deeds.push('富甲一方'); text = `巨贾${name}在${city.name.z}积累起惊人的财富。`; break;
    case 'explorer': {
      let met = 0;
      for (const m of w.nations) if (m.alive && m !== n) { const r = rel(w, n, m); if (!r.contact) { r.contact = true; met++; } }
      p.deeds.push('远航探索');
      text = met ? `探险家${name}从${city.name.z}出发远航，带回了 ${met} 个陌生民族的消息。` : `探险家${name}绘制了前所未有的精确地图。`;
      break;
    }
    case 'prophet': {
      const cur = n.religion != null ? w.religions[n.religion] : null;
      if (!cur || !cur.player || rng.chance(0.3)) {
        const aspect = cur && cur.player ? cur.aspect : rng.pick(['ancestors', 'nature']);
        const r = createReligion(w, n, city, { aspect, player: cur?.player || false, epithet: cur?.epithet, deity: cur?.deity, parent: cur ? cur.id : null, name: `${p.name.z}${cur && cur.player ? '派' : '之道'}` });
        city.religion[r.id] = 0.5;
        normalize(city.religion);
        p.deeds.push(`创立${r.name}`);
        text = cur && cur.player ? `先知${name}在${city.name.z}重新诠释了「${cur.epithet}」的启示，创立${r.name}。` : `先知${name}在${city.name.z}传道，创立了${r.name}。`;
      } else {
        for (const ci of n.cities) { const c2 = w.cities[ci]; c2.religion[cur.id] = Math.min(1, (c2.religion[cur.id] || 0) + 0.1); normalize(c2.religion); }
        p.deeds.push('宣讲神迹');
        text = `先知${name}走遍${n.name}，宣讲「${cur.epithet}」的神迹，信众日增。`;
      }
      break;
    }
    case 'general': p.deeds.push('百战名将'); text = `${n.adj}名将${name}崭露头角。`; n.generalBonus = 20; break;
  }
  if (text) log(w, role === 'scientist' ? 'science' : role === 'prophet' ? 'faith' : 'culture', text, { imp: 1, x: city.x, y: city.y, nations: [n.id] });
}

// ---- links between cities (for faith, ideas and disease) ----------------------------------------

function cityLinks(w) {
  const links = new Map();
  const cities = w.cities.filter((c) => c.alive);
  const add = (a, b, wgt) => {
    if (!links.has(a.id)) links.set(a.id, []);
    links.get(a.id).push([b, wgt]);
  };
  for (let i = 0; i < cities.length; i++) {
    const a = cities[i];
    for (let j = i + 1; j < cities.length; j++) {
      const b = cities[j];
      const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (d > 22) continue;
      const dd = Math.hypot(a.x - b.x, a.y - b.y);
      if (dd > 14) continue;
      const same = a.nation === b.nation;
      let wgt = (same ? 1.5 : 1) / (1 + dd / 4);
      if (!same) { const r = w.nations[a.nation].rel[b.nation]; if (r && r.state === 'war') wgt *= 0.3; }
      add(a, b, wgt); add(b, a, wgt);
    }
  }
  for (const r of w.routes) {
    const a = w.cities[r.a], b = w.cities[r.b];
    add(a, b, 1.2); add(b, a, 1.2);
  }
  return links;
}

// ---- the schedule ------------------------------------------------------------------------------

export function stepCiv(w) {
  const rng = w.rng;
  if (w.awakenings.length) processAwakenings(w);
  if (!w.nations.length) return;
  let t = now();
  growCities(w, 0.25);
  stepSettlers(w, rng);
  t = prof(w, 'civ.grow', t);
  stepArmies(w, rng);
  t = prof(w, 'civ.armies', t);
  const s = w.tick % 4;
  if (s === 1) {
    if (!w.landmass || w.landmassVersion !== w.elevVersion) labelLandmasses(w);
    for (const n of w.nations) if (n.alive && !n.tf) techFlags(n);
    if (w.dirty.territory || year(w) % 2 === 0) computeTerritory(w);
    computeAccess(w);
    yields(w, rng);
    expansion(w, rng);
    huntAndTame(w, rng);
    prof(w, 'civ.year1', t);
  } else if (s === 2) {
    const borders = computeBorders(w);
    w.borders = borders;
    stepDiplomacy(w, rng, borders);
    for (const n of w.nations) if (n.alive) { militaryAI(w, n, rng); considerNukes(w, n, rng); }
    updateTrade(w, rng);
    const links = cityLinks(w);
    w._links = links;
    spreadReligions(w, links);
    spreadIdeas(w, links);
    stepDisease(w, links, rng);
    for (const n of w.nations) if (n.alive && n.cities.length) { updateStateReligion(w, n); stepIdeaOrigins(w, n, rng); stepNationIdeas(w, n); stepMythogenesis(w, n, rng); }
    maybeSchism(w, rng);
    updatePrayers(w, rng);
    prof(w, 'civ.year2', t);
  } else if (s === 3) {
    for (const n of w.nations) {
      if (!n.alive || !n.cities.length) continue;
      for (const ci of n.cities) stepUnrest(w, w.cities[ci], n);
      stepStability(w, n);
      stepRuler(w, n, rng);
      stepSocietyNation(w, n, rng);
      if (!n.alive) continue;
      greatPeople(w, n, rng);
      connectCities(w, n, rng);
      for (const ci of n.cities) developLand(w, w.cities[ci], n, rng);
      if (year(w) % 5 === 0) n.hist.push([w.tick, Math.round(n.stats.pop), n.stats.cells]);
      if (n.hist.length > 600) n.hist = n.hist.filter((_, k) => k % 2 === 0);
      if (n.capital < 0 && n.cities.length) { n.capital = n.cities[0]; w.cities[n.capital].capital = true; }
    }
    maybeFederation(w, rng);
    archaeology(w, rng);
    checkDrowned(w);
    // divine energy from worship
    let worshippers = 0;
    for (const r of w.religions) if (r.alive && r.player) worshippers += r.followers * (0.3 + r.devotion);
    w.divine.worshippers = worshippers;
    w.divine.energy = Math.min(5000, w.divine.energy + 3 + Math.sqrt(worshippers) * 0.05);
    prof(w, 'civ.year3', t);
  }
}

