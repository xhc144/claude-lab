// The world state: typed-array fields over a W×H grid of cells plus global scalars. Every
// simulation module receives this object and reads/writes it directly; nothing here touches the
// DOM, so the whole simulation runs (and is unit-tested) under Node.

import { RNG } from '../core/rng.js';
import { TICKS_PER_YEAR, B } from './constants.js';

export const FIELDS_F32 = [
  'elev', 'baseTemp', 'seasonAmp', 'rain', 'veg', 'fert', 'flow', 'lake', 'flood', 'lava',
  'rad', 'pollution', 'coastDist', 'stress', 'magic',
];
export const FIELDS_U8 = ['biome', 'fire', 'res', 'impr', 'road', 'plate', 'scorch'];
export const FIELDS_I16 = ['owner', 'ownerCity'];
export const FIELDS_I32 = ['down'];

export function allocWorld(W, H, seed) {
  const N = W * H;
  const w = {
    version: 1,
    seed,
    W, H, N,
    rng: new RNG(seed ^ 0x5bd1e995),
    tick: 0,
    startYear: 0,
    seaLevel: 0,
    seaLevelBase: 0,
    seasonSin: 0,
    climate: {
      co2: 280, // ppm
      dust: 0, // aerosol optical depth (cooling)
      solar: 0, // player-controlled forcing in °C
      bias: 0, // world preset temperature bias in °C
      offset: 0, // current global temperature anomaly in °C (derived)
      wetness: 1, // rainfall multiplier
      iceAge: 0, // remaining ticks of a forced ice age
    },
    settings: {
      evolution: 1, // multiplier on mutation
      mode: 'sandbox', // 'sandbox' | 'divine'
      disasters: true, // natural random disasters
      civAggression: 1,
    },
    // dirty flags for derived fields
    dirty: { climate: true, hydro: true, terrainRender: true },
    // incremented whenever terrain changes, so the renderer knows to refresh
    terrainVersion: 0,
    flags: {}, // one-off world milestones (first landfall, first city, …)
    speciesAliveCount: 0,
    species: [],
    chronicle: [],
    impacts: [],
    // queued visual effects for the renderer: {type, x, y, ...}
    fx: [],
    // queued notifications for the UI
    notices: [],
  };
  for (const f of FIELDS_F32) w[f] = new Float32Array(N);
  for (const f of FIELDS_U8) w[f] = new Uint8Array(N);
  for (const f of FIELDS_I16) w[f] = new Int16Array(N).fill(-1);
  for (const f of FIELDS_I32) w[f] = new Int32Array(N).fill(-1);
  return w;
}

export const year = (w) => w.startYear + Math.floor(w.tick / TICKS_PER_YEAR);
export const season = (w) => w.tick % TICKS_PER_YEAR;
export const idx = (w, x, y) => y * w.W + x;
export const inBounds = (w, x, y) => x >= 0 && y >= 0 && x < w.W && y < w.H;

export const isOcean = (w, c) => w.elev[c] < w.seaLevel;
export const isWater = (w, c) => w.elev[c] < w.seaLevel || w.lake[c] > 0;
export const isLand = (w, c) => w.elev[c] >= w.seaLevel && w.lake[c] <= 0;
/** height above sea level in elevation units (negative = depth) */
export const height = (w, c) => w.elev[c] - w.seaLevel;

/** current temperature (°C) of a cell, including season and global anomaly */
export function tempAt(w, c) {
  return w.baseTemp[c] + w.seasonAmp[c] * w.seasonSin + w.climate.offset;
}

/** annual mean temperature including the global anomaly */
export function meanTempAt(w, c) {
  return w.baseTemp[c] + w.climate.offset;
}

/** frozen sea surface? (land creatures may cross it) */
export function seaIce(w, c) {
  return w.elev[c] < w.seaLevel && tempAt(w, c) < -3;
}

/** cell index nearest to a float position, clamped to the map */
export function cellAt(w, x, y) {
  const cx = x < 0 ? 0 : x >= w.W ? w.W - 1 : x | 0;
  const cy = y < 0 ? 0 : y >= w.H ? w.H - 1 : y | 0;
  return cy * w.W + cx;
}

/** iterate over cells within radius r of (x, y): fn(c, x, y, d2) */
export function forDisk(w, x, y, r, fn) {
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(w.W - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(w.H - 1, Math.ceil(y + r));
  const r2 = r * r;
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const d2 = (xx - x) * (xx - x) + (yy - y) * (yy - y);
      if (d2 <= r2) fn(yy * w.W + xx, xx, yy, d2);
    }
  }
}

export function markTerrainChanged(w) {
  w.dirty.climate = true;
  w.dirty.hydro = true;
  w.terrainVersion++;
}

export function pushFx(w, fx) {
  if (w.fx.length < 400) w.fx.push(fx);
}

export function notify(w, n) {
  if (w.notices.length < 60) w.notices.push(n);
}

export const isForest = (b) => b === B.TAIGA || b === B.FOREST || b === B.JUNGLE;
