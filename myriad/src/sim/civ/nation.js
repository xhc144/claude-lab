// Nations: identity (name in their own language, colours, heraldry), culture values, government,
// technology, relations with every other nation, and the impressions left by the player's divine
// acts, from which their religions will later take shape.

import { RNG } from '../../core/rng.js';
import { hsl, clamp } from '../../core/util.js';
import { makeLanguage, placeName, driftLanguage, dynastyName } from '../../core/lang.js';
import { G } from '../constants.js';
import { GOVS, NTECH, TECHS, TECH } from './data.js';

const FLAG_PATTERNS = ['solid', 'bicolorH', 'bicolorV', 'tricolorH', 'tricolorV', 'cross', 'saltire', 'border', 'diagonal', 'quarter', 'chevron', 'canton'];
const EMBLEMS = ['none', 'sun', 'star', 'moon', 'circle', 'diamond', 'tree', 'eye', 'crown', 'wave', 'mountain', 'beast', 'flame', 'tower'];

export function pickColor(w, rng) {
  const used = w.nations.filter((n) => n.alive).map((n) => n.hue);
  let best = rng.next() * 360, bd = -1;
  for (let t = 0; t < 24; t++) {
    const h = rng.next() * 360;
    let d = 360;
    for (const u of used) { const x = Math.abs(h - u); d = Math.min(d, Math.min(x, 360 - x)); }
    if (d > bd) { bd = d; best = h; }
  }
  return best;
}

export function makeFlag(rng, hue, parentFlag = null) {
  const c1 = hsl(hue, 0.6 + rng.next() * 0.25, 0.42 + rng.next() * 0.12);
  const c2 = rng.chance(0.5) ? [236, 228, 210] : hsl(hue + 150 + rng.next() * 60, 0.55, 0.5);
  const c3 = rng.chance(0.4) ? [30, 30, 36] : hsl(hue + 40 + rng.next() * 30, 0.65, 0.55);
  if (parentFlag && rng.chance(0.7)) {
    // successor states echo their parent's flag
    return { ...parentFlag, c1, emblem: rng.chance(0.5) ? parentFlag.emblem : rng.pick(EMBLEMS), ec: c2 };
  }
  return { pattern: rng.pick(FLAG_PATTERNS), c1, c2, c3, emblem: rng.pick(EMBLEMS), ec: rng.chance(0.5) ? [250, 230, 140] : c2 };
}

export function govName(n) {
  return n.root.z + GOVS[n.gov].suffix;
}

export function refreshName(n) {
  n.name = govName(n);
}

/** culture values from the species' nature plus chance */
function initValues(sp, rng) {
  const g = sp ? sp.ref : null;
  const v = (k, base) => clamp(base + rng.range(-0.35, 0.35), -1, 1);
  return {
    trad: v('trad', g ? 0.3 - g[G.intellect] * 0.4 : 0),
    coll: v('coll', g ? (g[G.social] - 0.5) * 1.2 : 0),
    piety: v('piety', 0.3),
    mil: v('mil', g ? (g[G.aggression] - 0.4) * 1.2 + (g[G.diet] - 0.5) * 0.4 : 0),
    open: v('open', g ? 0.1 - (g[G.aggression] - 0.4) * 0.5 : 0),
  };
}

export function createNation(w, opts) {
  const rng = w.rng;
  const id = w.nations.length;
  const sp = opts.species != null ? w.species[opts.species] : null;
  const lang = opts.lang || makeLanguage(rng.int(1e9));
  const lrng = new RNG(rng.int(1e9));
  const root = opts.root || placeName(lang, lrng);
  const hue = opts.hue ?? pickColor(w, rng);
  const n = {
    id,
    root,
    name: '',
    adj: root.z + '人',
    lang,
    species: opts.species ?? null,
    hue,
    color: hsl(hue, 0.62, 0.52),
    flag: makeFlag(rng, hue, opts.parentFlag || null),
    founded: w.tick,
    alive: true,
    fell: null,
    gov: opts.gov || 'tribe',
    values: opts.values || initValues(sp, rng),
    techs: opts.techs ? Uint8Array.from(opts.techs) : new Uint8Array(NTECH),
    research: null,
    researchPts: 0,
    era: 0,
    cities: [],
    capital: -1,
    treasury: 20,
    stability: 0.75,
    legitimacy: 0.8,
    weariness: 0,
    religion: opts.religion ?? null,
    ideas: {},
    leader: -1,
    dynasty: dynastyName(lang, lrng),
    rel: {},
    parent: opts.parent ?? null,
    divine: { wrath: 0, mercy: 0, mystery: 0, creation: 0, acts: {} },
    hist: [],
    stats: { pop: 0, cells: 0, sci: 0, wealth: 0, prod: 0, army: 0, cities: 0 },
    traits: speciesTraits(sp),
    goldenAge: 0,
    darkAge: 0,
    events: [],
    peakCities: 0,
    peakPop: 0,
    wonders: [],
    ascended: 0,
  };
  refreshName(n);
  updateEra(n);
  w.nations.push(n);
  return n;
}

/** what the founding species brings to its civilisation */
export function speciesTraits(sp) {
  if (!sp) return { intel: 0.6, aggr: 0.4, social: 0.6, size: 0.4, hab: 2, fly: false, warmth: 0.55, diet: 0.4 };
  const g = sp.ref;
  return {
    intel: g[G.intellect], aggr: g[G.aggression], social: g[G.social], size: g[G.size],
    hab: sp.hab, fly: sp.fly, warmth: g[G.warmth], diet: g[G.diet],
  };
}

export const has = (n, techId) => n.techs[TECH[techId].i] === 1;

export function updateEra(n) {
  let e = 0;
  const perEra = new Array(11).fill(0);
  let count = 0;
  for (const t of TECHS) if (n.techs[t.i]) { perEra[t.era]++; count++; }
  for (let k = 1; k < 11; k++) if (perEra[k] >= 2) e = k;
  n.techCount = count;
  const changed = e !== n.era;
  n.era = e;
  return changed;
}

/** relation record between two nations (created on demand, symmetric storage) */
export function rel(w, a, b) {
  const na = typeof a === 'number' ? w.nations[a] : a;
  const nb = typeof b === 'number' ? w.nations[b] : b;
  let r = na.rel[nb.id];
  if (!r) {
    r = { op: 0, state: 'peace', since: w.tick, truce: 0, contact: false, trade: 0, score: 0, wars: 0, lastWar: -1e9 };
    na.rel[nb.id] = r;
    nb.rel[na.id] = r;
  }
  return r;
}

export const atWar = (w, a, b) => {
  const r = a.rel[b.id];
  return !!r && r.state === 'war';
};

export function enemiesOf(w, n) {
  const out = [];
  for (const k in n.rel) if (n.rel[k].state === 'war' && w.nations[k].alive) out.push(w.nations[k]);
  return out;
}

export function alliesOf(w, n) {
  const out = [];
  for (const k in n.rel) if (n.rel[k].state === 'alliance' && w.nations[k].alive) out.push(w.nations[k]);
  return out;
}

export const aliveNations = (w) => w.nations.filter((n) => n.alive);

/** a successor state's language drifts from its parent's */
export function childLanguage(w, parent) {
  return driftLanguage(parent.lang, w.rng.int(1e9));
}

/** distance between two nations' culture values (0..~2.2) */
export function valueDistance(a, b) {
  const va = a.values, vb = b.values;
  return Math.sqrt((va.trad - vb.trad) ** 2 + (va.coll - vb.coll) ** 2 + (va.piety - vb.piety) ** 2 + (va.mil - vb.mil) ** 2 + (va.open - vb.open) ** 2);
}
