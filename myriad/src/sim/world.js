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
import { initLife, seedLife, stepCreatures, applyImpactsToLife } from './life/creatures.js';

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
  seedLife(w, opts.life || (opts.start === 'primordial' ? 'primordial' : opts.start === 'barren' ? 'none' : 'flourishing'), w.rng);
  return w;
}

/** advance the world by one tick (one season) */
export function step(w) {
  w.tick++;
  const s = w.tick % TICKS_PER_YEAR;
  w.seasonSin = SEASON_SIN[s];
  const rng = w.rng;

  if (w.dirty.hydro && (w.tick % 2 === 0)) computeHydrology(w);
  if (w.dirty.climate) computeClimate(w);

  w.stats.vegMean = stepVegetation(w);
  stepFire(w, rng);
  stepFlood(w);
  stepVolcanoes(w, rng);
  stepLava(w, rng);
  stepCreatures(w);

  if (w.impacts.length) {
    const imps = w.impacts;
    w.impacts = [];
    applyImpactsToLife(w, imps);
  }

  if (s === 0) yearly(w);
}

function yearly(w) {
  const rng = w.rng;
  updateGlobalClimate(w, w.stats.vegMean);
  stepSoil(w);
  stepGeologyYear(w, rng);
  maybeEarthquake(w, rng);
  const m = maybeMeteor(w, rng);
  if (m) meteorImpact(w, m.x, m.y, m.r, rng);
  if (year(w) % 5 === 0) {
    erode(w, 5, rng);
    w.terrainVersion++;
  }
  if (year(w) % 25 === 0) w.dirty.hydro = true;
  if (year(w) % 2 === 0) w.dirty.climate = true;
}
