// Research. Each nation pours its science into one technology at a time, chosen by what its
// culture values and what its land offers; knowledge already held by neighbours and trade partners
// is much cheaper to acquire (diffusion), and collapses can plunge a nation into a dark age that
// erases what it knew.

import { TECHS, TECH, ERAS, techCost } from './data.js';
import { updateEra, refreshName } from './nation.js';
import { log } from '../chronicle.js';

const MIL = new Set(['bronze', 'iron', 'metallurgy', 'gunpowder', 'feudalism', 'combustion', 'flight', 'fission', 'rocketry']);
const ECO = new Set(['agriculture', 'pottery', 'currency', 'guilds', 'banking', 'industry', 'railroad', 'steam', 'husbandry', 'wheel', 'greenrev']);
const FAITH = new Set(['mysticism', 'theology', 'oral']);
const SCI = new Set(['writing', 'philosophy', 'mathematics', 'optics', 'science', 'computers', 'printing', 'medicine', 'chemistry', 'networks', 'ai', 'genetics']);
const NAVAL = new Set(['rafts', 'sailing', 'compass']);

export function techFlags(n) {
  const tf = n.tf || (n.tf = {});
  for (const t of TECHS) tf[t.id] = n.techs[t.i] === 1;
  return tf;
}

export function available(n) {
  const out = [];
  for (const t of TECHS) {
    if (n.techs[t.i]) continue;
    if (t.req.every((r) => n.techs[TECH[r].i])) out.push(t);
  }
  return out;
}

/** fraction of contacted nations that already know t (0..1) */
function diffusion(w, n, t) {
  let known = 0, total = 0;
  for (const k in n.rel) {
    const r = n.rel[k];
    if (!r.contact) continue;
    const m = w.nations[k];
    if (!m.alive) continue;
    total++;
    if (m.techs[t.i]) known += r.trade > 0 ? 1.4 : 1;
  }
  return total ? Math.min(1, known / total) : 0;
}

export function effectiveCost(w, n, t) {
  return techCost(t) * (1 - 0.55 * diffusion(w, n, t)) * (n.darkAge > 0 ? 1.5 : 1);
}

export function chooseResearch(w, n) {
  const av = available(n);
  if (!av.length) { n.research = null; return null; }
  const v = n.values;
  const t = w.rng.weighted(av, (t) => {
    let s = 1 / Math.pow(1.8, t.era - n.era);
    if (MIL.has(t.id)) s *= 1 + Math.max(0, v.mil) * 1.5 + n.weariness;
    if (ECO.has(t.id)) s *= 1.2 + Math.max(0, v.coll) * 0.4;
    if (FAITH.has(t.id)) s *= 1 + Math.max(0, v.piety) * 1.2;
    if (SCI.has(t.id)) s *= 1 + Math.max(0, -v.trad) * 1.2 + Math.max(0, -v.piety) * 0.4;
    if (NAVAL.has(t.id)) s *= n.coastal ? 1.6 + Math.max(0, v.open) : 0.4;
    if (t.res && n.access && !n.access[t.res]) s *= 0.5;
    if (t.id === 'agriculture') s *= 3;
    s *= 1 + diffusion(w, n, t) * 2;
    return s;
  });
  n.research = t ? t.id : null;
  return t;
}

/** add research points; returns the tech id completed, if any */
export function addResearch(w, n, pts) {
  if (!n.research) chooseResearch(w, n);
  if (!n.research) return null;
  n.researchPts += pts;
  const t = TECH[n.research];
  const cost = effectiveCost(w, n, t);
  if (n.researchPts >= cost) {
    n.researchPts -= cost;
    grantTech(w, n, t.id);
    chooseResearch(w, n);
    return t.id;
  }
  return null;
}

export function grantTech(w, n, id, how = 'research') {
  const t = TECH[id];
  if (n.techs[t.i]) return;
  n.techs[t.i] = 1;
  techFlags(n);
  if (n.research === id) n.research = null;
  const firstInWorld = !w.techFirsts[id];
  if (firstInWorld) {
    w.techFirsts[id] = { nation: n.id, tick: w.tick };
    const cap = w.cities[n.capital];
    log(w, 'science', `${n.name}在世界上第一个掌握了「${t.name}」。${t.desc}。`, { imp: t.era >= 6 ? 2 : 1, x: cap?.x, y: cap?.y, nations: [n.id] });
  }
  if (updateEra(n)) {
    const firstEra = !w.eraFirsts[n.era];
    if (firstEra) w.eraFirsts[n.era] = { nation: n.id, tick: w.tick };
    const cap = w.cities[n.capital];
    log(w, 'science', `${n.name}迈入了${ERAS[n.era].name}——${ERAS[n.era].desc}。${firstEra ? '这是世界上第一个进入这个时代的文明。' : ''}`, { imp: firstEra ? 2 : 1, x: cap?.x, y: cap?.y, nations: [n.id] });
  }
  if (n.gov === 'tribe' && (id === 'agriculture' || id === 'bronze')) { n.gov = 'chiefdom'; refreshName(n); }
}

/** a dark age wipes out up to k of the most recent techs */
export function loseTechs(w, n, k) {
  const known = TECHS.filter((t) => n.techs[t.i] && !TECHS.some((u) => n.techs[u.i] && u.req.includes(t.id)));
  w.rng.shuffle(known);
  const lost = [];
  for (const t of known.slice(0, k)) {
    if (t.era === 0) continue;
    n.techs[t.i] = 0;
    lost.push(t.name);
  }
  if (lost.length) {
    techFlags(n);
    updateEra(n);
    if (n.research && n.techs[TECH[n.research].i] === 0) n.researchPts = 0;
  }
  return lost;
}

/** give a nation all techs up to (and including) era e — for scenario starts */
export function grantUpToEra(n, e) {
  for (const t of TECHS) if (t.era <= e) n.techs[t.i] = 1;
  techFlags(n);
  updateEra(n);
}

