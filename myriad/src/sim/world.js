// World creation and the main simulation step. This module only orchestrates: each subsystem
// lives in its own module and works on the shared state object.

import { hashStr } from '../core/rng.js';
import { allocWorld, year } from './state.js';
import { TICKS_PER_YEAR, B } from './constants.js';
import { generateTerrain, placeResources, PRESETS } from './worldgen.js';
import { computeClimate, updateGlobalClimate } from './climate.js';
import { computeHydrology, erode, stepFlood } from './hydro.js';
import { stepVegetation, stepSoil, stepFire, vegCapacity } from './vegetation.js';
import { stepVolcanoes, stepLava, maybeEarthquake, maybeMeteor, meteorImpact, stepGeologyYear } from './geology.js';
import { initLife, seedLife, stepCreatures, applyImpactsToLife, seedPopulation, findHome } from './life/creatures.js';
import { ARCHETYPES } from './life/genome.js';
import { initCiv, stepCiv, applyImpactsToCiv, foundTribe } from './civ/civ.js';
import { labelLandmasses } from './civ/path.js';
import { log } from './chronicle.js';
import { prof, now } from '../core/prof.js';
import { stepEvents } from './events.js';
import { initEntities, stepEntities } from './entities.js';
import { initStats, sampleStats } from './stats.js';
import { checkAchievements } from './achievements.js';

export const SIZES = {
  small: { W: 240, H: 150, name: '小' },
  medium: { W: 320, H: 200, name: '中' },
  large: { W: 420, H: 260, name: '大' },
};

const SEASON_SIN = [0, 1, 0, -1];

/**
 * opts: { seed, size, preset, land, mountains, temp, wet, start, mode }
 */
export function createWorld(opts = {}) {
  const size = SIZES[opts.size] || SIZES.medium;
  const W = opts.W || size.W, H = opts.H || size.H;
  const seed = typeof opts.seed === 'number' ? opts.seed >>> 0 : hashStr(String(opts.seed ?? Date.now()));
  const w = allocWorld(W, H, seed);
  const preset = PRESETS[opts.preset] || PRESETS.continents;
  w.preset = opts.preset || 'continents';
  w.climate.bias = preset.temp + (opts.temp || 0);
  w.climate.wetness = preset.wet * (opts.wet ?? 1);
  if (opts.mode) w.settings.mode = opts.mode;
  generateTerrain(w, opts);

  // spin up climate ↔ hydrology ↔ vegetation so the first frame is already in equilibrium
  w.veg.fill(0.5);
  computeClimate(w);
  computeHydrology(w);
  computeClimate(w);
  for (let c = 0; c < w.N; c++) {
    const b = w.biome[c];
    w.fert[c] = b === B.DESERT || b === B.ICE || b === B.SNOWPEAK ? 0.12 : b === B.SWAMP ? 0.85 : b === B.GRASS || b === B.SAVANNA ? 0.72 : 0.55;
  }
  for (let c = 0; c < w.N; c++) w.veg[c] = vegCapacity(w, c) * 0.92;
  computeClimate(w);
  computeHydrology(w);
  placeResources(w);
  w.stats = { vegMean: 0 };
  const cap = Math.round(4200 * (W * H) / (320 * 200));
  initLife(w, cap);
  initCiv(w);
  initEntities(w);
  initStats(w);
  w.seaLevelBase0 = w.seaLevel;
  labelLandmasses(w);
  seedLife(w, opts.life || (opts.start === 'primordial' ? 'primordial' : opts.start === 'barren' ? 'none' : 'flourishing'), w.rng);
  if (opts.start === 'tribes' || opts.start === 'kingdoms') seedPeoples(w, opts.start === 'kingdoms' ? 3 : null);
  log(w, 'nature', startText(opts.start), { imp: 2 });
  sampleStats(w);
  return w;
}

function startText(start) {
  switch (start) {
    case 'primordial': return '世界从虚空中浮现。温暖的浅海里，最初的生命开始游动。';
    case 'barren': return '世界从虚空中浮现。这是一片寂静的荒原，等待着生命的种子。';
    case 'tribes': return '世界从虚空中浮现。万物繁盛，而在几处河谷里，第一批智慧生灵正围着火堆低语。';
    case 'kingdoms': return '世界从虚空中浮现，诸王国早已在大地上林立。历史的齿轮开始转动。';
    default: return '世界从虚空中浮现。森林、草原与海洋里，万千生灵各自奔忙。';
  }
}

// sapient peoples for the "tribes" / "kingdoms" starts: humans of several distinct stocks
const PEOPLES = [
  { name: '原人', genes: [0.42, 0.5, 0.45, 0.6, 0.86, 0.45, 0.6, 0.65, 0.76, 0.72, 0.38, 0.1, 0.1, 0.08, 0.4] },
  { name: '鳞民', genes: [0.5, 0.45, 0.6, 0.82, 0.7, 0.5, 0.55, 0.6, 0.74, 0.6, 0.6, 0.45, 0.05, 0.38, 0.8] },
  { name: '霜裔', genes: [0.6, 0.4, 0.35, 0.2, 0.88, 0.35, 0.75, 0.6, 0.75, 0.68, 0.32, 0.3, 0.05, 0.6, 0.2] },
  { name: '潮人', genes: [0.38, 0.55, 0.4, 0.62, 0.5, 0.55, 0.6, 0.7, 0.77, 0.75, 0.25, 0.15, 0.05, 0.52, 0.6] },
];

export function seedPeoples(w, era = null) {
  const rng = w.rng;
  const kinds = rng.shuffle(PEOPLES.slice()).slice(0, 2 + rng.int(2));
  let tribes = 0;
  for (const k of kinds) {
    const home = findHome(w, k.genes, rng, 600);
    if (!home) continue;
    const sp = seedPopulation(w, k.genes, home.x, home.y, 0, 5, rng, k.name);
    sp.sapient = true;
    const n = 2 + rng.int(2);
    for (let i = 0; i < n; i++) {
      const spot = i === 0 ? home : findHome(w, k.genes, rng, 300);
      if (!spot) continue;
      const nat = foundTribe(w, sp.id, spot.x, spot.y, { silent: true, era, gov: era ? 'monarchy' : 'tribe', pop: era ? 4000 : 120, r: 14 });
      if (nat) tribes++;
    }
  }
  return tribes;
}

/** recompute climate and rivers right away (used while the player edits a paused world) */
export function refreshDerived(w) {
  if (w.dirty.climate || w.dirty.hydro) {
    computeClimate(w);
    computeHydrology(w);
    computeClimate(w);
    w._vcap = null;
    w.dirty.territory = true;
    return true;
  }
  return false;
}

/** advance the world by one tick (one season) */
export function step(w) {
  w.tick++;
  const s = w.tick % TICKS_PER_YEAR;
  w.seasonSin = SEASON_SIN[s];
  const rng = w.rng;

  let t = now();
  // derived fields are refreshed at most once a year (the UI forces a refresh while editing)
  if (w.dirty.hydro && s === 0) computeHydrology(w);
  if (w.dirty.climate && s === 0) computeClimate(w);
  t = prof(w, 'climate', t);

  w.stats.vegMean = stepVegetation(w);
  stepFire(w, rng);
  stepFlood(w);
  stepVolcanoes(w, rng);
  stepLava(w, rng);
  t = prof(w, 'nature', t);
  stepCreatures(w);
  t = prof(w, 'creatures', t);
  stepCiv(w);
  t = prof(w, 'civ', t);
  if (w.tornadoes.length || w.monsters.length || w.comets.length) stepEntities(w, rng);

  if (w.impacts.length) {
    const imps = w.impacts;
    w.impacts = [];
    applyImpactsToLife(w, imps);
    applyImpactsToCiv(w, imps);
  }

  if (s === 0) yearly(w);
}

function yearly(w) {
  const rng = w.rng;
  updateGlobalClimate(w, w.stats.vegMean);
  stepSoil(w);
  stepGeologyYear(w, rng);
  maybeEarthquake(w, rng);
  stepEvents(w, rng);
  sampleStats(w);
  checkAchievements(w);
  const m = maybeMeteor(w, rng);
  if (m) meteorImpact(w, m.x, m.y, m.r, rng);
  if (year(w) % 5 === 0) {
    erode(w, 5, rng);
    w.terrainVersion++;
  }
  if (year(w) % 25 === 0) w.dirty.hydro = true;
  if (year(w) % 2 === 0) w.dirty.climate = true;
}
