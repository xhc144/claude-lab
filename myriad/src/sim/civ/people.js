// Notable people: rulers with traits, dynasties and successions, and great persons — generals,
// scholars, prophets, artists, explorers, merchants — whose deeds enter the chronicle. A ruler's
// epithet ("the Conqueror", "the Short-Lived"…) is decided by history when they die.

import { RNG } from '../../core/rng.js';
import { personName, dynastyName } from '../../core/lang.js';
import { RULER_TRAITS, PERSON_ROLES } from './data.js';
import { log } from '../chronicle.js';

export const TITLES = {
  tribe: '族长', chiefdom: '酋长', monarchy: '国王', empire: '皇帝', theocracy: '大祭司', republic: '执政官',
  oligarchy: '总督', democracy: '总统', junta: '元帅', commune: '主席', technocracy: '首席执行官',
};

export function createPerson(w, n, role, opts = {}) {
  const rng = new RNG(w.rng.int(1e9));
  const p = {
    id: w.persons.length,
    name: personName(n.lang, rng),
    family: opts.family || dynastyName(n.lang, rng),
    nation: n.id,
    role,
    born: w.tick - (opts.age ?? 30) * 4,
    start: w.tick,
    died: null,
    traits: opts.traits || [],
    deeds: [],
    epithet: null,
    city: opts.city ?? null,
    stats: { wars: 0, won: 0, lost: 0, cities: 0, citiesLost: 0, techs: 0, wonders: 0 },
  };
  w.persons.push(p);
  if (w.persons.length > 6000) compactPersons(w);
  return p;
}

/** forget long-dead minor people so saves stay small (keeps rulers of great nations) */
function compactPersons(w) {
  for (const p of w.persons) {
    if (p && p.died !== null && w.tick - p.died > 4000 && p.role !== 'ruler' && p.role !== 'prophet') w.persons[p.id] = { id: p.id, gone: true, name: p.name, family: p.family, role: p.role, nation: p.nation, died: p.died };
  }
}

export const fullName = (p) => (p.family ? `${p.family.z}·${p.name.z}` : p.name.z) + (p.epithet ? `「${p.epithet}」` : '');
export const ageOf = (w, p) => Math.floor(((p.died ?? w.tick) - p.born) / 4);

function pickTraits(w, n, rng) {
  const v = n.values;
  const keys = Object.keys(RULER_TRAITS);
  const out = [];
  const k = rng.chance(0.4) ? 2 : 1;
  for (let i = 0; i < k; i++) {
    const t = rng.weighted(keys, (key) => {
      if (out.includes(key)) return 0;
      let s = 1;
      if (key === 'warlike' || key === 'ambitious' || key === 'cruel') s += Math.max(0, v.mil) * 2;
      if (key === 'pious') s += Math.max(0, v.piety) * 2;
      if (key === 'wise' || key === 'scholar') s += Math.max(0, -v.trad) * 1.5;
      if (key === 'kind' || key === 'diplomat') s += Math.max(0, -v.mil) * 1.5;
      if (key === 'mad') s *= 0.35;
      return s;
    });
    if (t) out.push(t);
  }
  return out;
}

/** install a new ruler. how: 'heir' | 'election' | 'founder' | 'coup' | 'revolution' */
export function newRuler(w, n, how = 'heir') {
  const rng = new RNG(w.rng.int(1e9));
  const keepDynasty = how === 'heir' || how === 'founder';
  const family = keepDynasty ? n.dynasty : dynastyName(n.lang, rng);
  if (!keepDynasty && (n.gov === 'monarchy' || n.gov === 'empire' || n.gov === 'chiefdom')) n.dynasty = family;
  const p = createPerson(w, n, 'ruler', { family, traits: pickTraits(w, n, rng), age: 20 + rng.int(30), city: n.capital });
  p.title = TITLES[n.gov] || '领袖';
  n.leader = p.id;
  n.reignStart = w.tick;
  n.legitimacy = how === 'heir' ? Math.min(1, n.legitimacy + 0.1) : how === 'election' ? 0.85 : how === 'coup' ? 0.4 : 0.6;
  return p;
}

export function rulerTraitSum(w, n, key) {
  const p = w.persons[n.leader];
  if (!p || !p.traits) return 0;
  let s = 0;
  for (const t of p.traits) s += RULER_TRAITS[t][key] || 0;
  return s;
}

export function rulerHas(w, n, key) {
  const p = w.persons[n.leader];
  return !!(p && p.traits && p.traits.some((t) => RULER_TRAITS[t][key]));
}

function epithetFor(w, p, n) {
  const reign = (w.tick - p.start) / 4;
  const s = p.stats;
  if (s.cities >= 3 || s.won >= 3) return '征服者';
  if (s.citiesLost >= 3) return '失地者';
  if (s.wonders >= 1) return '营造者';
  if (reign < 2) return '短命者';
  if (reign > 45) return '长治者';
  if (p.traits.includes('cruel')) return '残暴者';
  if (p.traits.includes('mad')) return '疯王';
  if (p.traits.includes('wise') && s.techs >= 2) return '智者';
  if (p.traits.includes('pious')) return '虔信者';
  if (p.traits.includes('kind')) return '仁君';
  if (s.techs >= 4) return '开明者';
  if (s.wars === 0 && reign > 20) return '和平者';
  return null;
}

/** end a ruler's reign; returns the dead/deposed person */
export function endReign(w, n, cause = 'death') {
  const p = w.persons[n.leader];
  if (!p) return null;
  p.died = w.tick;
  p.epithet = epithetFor(w, p, n);
  const reign = Math.max(0, Math.round((w.tick - p.start) / 4));
  if (cause === 'death' && (p.epithet || reign > 30 || n.cities.length >= 6)) {
    log(w, 'civ', `${n.name}${p.title}${fullName(p)}${cause === 'death' ? '去世' : '下台'}，在位 ${reign} 年。`, { imp: 1, nations: [n.id] });
  }
  return p;
}

/** yearly: age, natural death, elections. returns true if the throne changed */
export function stepRuler(w, n, rng) {
  let p = w.persons[n.leader];
  if (!p || p.died !== null) { newRuler(w, n, 'founder'); return true; }
  const age = ageOf(w, p);
  const pDeath = 0.008 + Math.max(0, age - 45) * 0.004 + Math.max(0, age - 70) * 0.02;
  const elective = n.gov === 'republic' || n.gov === 'democracy' || n.gov === 'oligarchy' || n.gov === 'commune';
  const termEnd = elective && (w.tick - p.start) / 4 >= (n.gov === 'democracy' ? 6 : 8);
  if (rng.next() < pDeath) {
    endReign(w, n, 'death');
    newRuler(w, n, elective ? 'election' : n.gov === 'monarchy' || n.gov === 'empire' ? 'heir' : 'founder');
    return true;
  }
  if (termEnd) {
    p.died = w.tick;
    p.epithet = epithetFor(w, p, n);
    newRuler(w, n, 'election');
    return true;
  }
  return false;
}

export function roleName(role) {
  return PERSON_ROLES[role] || role;
}
