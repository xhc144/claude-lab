// Primary production. On land `veg` is plant biomass, in water it is plankton; both grow
// logistically towards a carrying capacity set by temperature, water and soil, both are eaten by
// herbivores. Plants only grow in the warm season, wind-borne seed lets bare ground green again,
// dry vegetation catches fire from lightning, fire spreads with the wind and leaves fertile ash.

import { clamp, smoothstep } from '../core/util.js';
import { B } from './constants.js';
import { tempAt } from './state.js';
import { windAt } from './climate.js';

/** carrying capacity of a cell (0..1) */
export function vegCapacity(w, c) {
  const h = w.elev[c] - w.seaLevel;
  const T = w.baseTemp[c] + w.climate.offset;
  if (h < 0 || w.lake[c] > 0) {
    // plankton: rich on shelves, near coasts and river mouths, in cool upwelling water
    const depth = Math.max(0, -h);
    const shelf = 1 - smoothstep(0.02, 0.25, depth);
    const coast = 1 - smoothstep(1, 10, w.coastDist[c]);
    let k = 0.05 + 0.45 * shelf + 0.2 * coast;
    k *= 0.6 + 0.4 * smoothstep(-2, 12, T);
    if (w.lake[c] > 0) k = 0.55;
    return clamp(k - w.pollution[c] * 0.8 - w.rad[c], 0, 1);
  }
  const b = w.biome[c];
  if (b === B.ICE || b === B.SNOWPEAK) return 0.01;
  const warm = smoothstep(-9, 13, T) * (1 - smoothstep(33, 46, T));
  const water = smoothstep(0.03, 0.5, w.rain[c] + Math.min(0.35, w.flow[c] / 120) + Math.min(0.2, w.flood[c] * 40));
  let k = warm * water * (0.45 + 0.55 * w.fert[c]);
  if (h > 0.3) k *= clamp(1 - (h - 0.3) * 2.2, 0.08, 1);
  if (b === B.VOLCANIC || b === B.WASTE) k *= 0.25;
  k += w.magic[c] * 0.6; // the world tree and similar miracles
  return clamp(k - w.pollution[c] * 0.6 - w.rad[c] * 1.2, 0, 1);
}

/** one tick of growth for every cell; returns mean land vegetation */
export function stepVegetation(w) {
  const { N, veg, elev, seaLevel } = w;
  let sum = 0, nLand = 0;
  // capacity is costly-ish: recompute a rolling stripe each tick, cache the rest
  if (!w._vcap || w._vcap.length !== N) {
    w._vcap = new Float32Array(N);
    for (let c = 0; c < N; c++) w._vcap[c] = vegCapacity(w, c);
  }
  const cap = w._vcap;
  const stripe = 8;
  for (let c = w.tick % stripe; c < N; c += stripe) cap[c] = vegCapacity(w, c);

  for (let c = 0; c < N; c++) {
    const K = cap[c];
    let v = veg[c];
    const land = elev[c] >= seaLevel;
    let rate;
    if (land) {
      const T = tempAt(w, c);
      rate = T > 3 ? 0.19 : T > -2 ? 0.05 : 0;
      nLand++;
    } else {
      rate = 0.3;
    }
    if (v < K) v += rate * (v + (land ? 0.04 : 0.07)) * (1 - v / (K + 1e-6));
    else v -= (v - K) * 0.06;
    veg[c] = v < 0 ? 0 : v;
    if (land) sum += v;
  }
  return nLand ? sum / nLand : 0;
}

/** soil slowly builds under plants and erodes when bare */
export function stepSoil(w) {
  const { N, veg, fert, elev, seaLevel } = w;
  for (let c = 0; c < N; c++) {
    if (elev[c] < seaLevel) continue;
    const target = 0.15 + 0.75 * veg[c];
    fert[c] += (target - fert[c]) * 0.01;
  }
}

/** wildfires: random lightning ignitions and spread; `active` cells carry a burn timer */
export function stepFire(w, rng) {
  const { W, H, N, veg, fire, elev, seaLevel } = w;
  // lightning: try a handful of random cells, mostly in the hot season
  if (w.settings.disasters) {
    const tries = Math.round(N / 3000);
    for (let s = 0; s < tries; s++) {
      const c = rng.int(N);
      if (elev[c] < seaLevel || fire[c] || w.lake[c] > 0) continue;
      const T = tempAt(w, c);
      const dry = 1 - w.rain[c];
      if (veg[c] > 0.45 && T > 14 && rng.chance(0.004 * dry * dry * veg[c])) ignite(w, c);
    }
  }
  let burning = 0;
  const spreadTo = [];
  for (let c = 0; c < N; c++) {
    const f = fire[c];
    if (!f) continue;
    burning++;
    const x = c % W, y = (c / W) | 0;
    const wind = windAt(w, y);
    if (veg[c] > 0.05) {
      for (let k = 0; k < 8; k++) {
        const dx = k < 2 ? (k ? -1 : 1) : k < 4 ? 0 : k < 6 ? 1 : -1;
        const dy = k < 2 ? 0 : k < 4 ? (k === 2 ? 1 : -1) : k % 2 ? -1 : 1;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (fire[n] || elev[n] < seaLevel || w.lake[n] > 0 || w.flood[n] > 0.0004) continue;
        const p = 0.22 * veg[n] * (1.15 - w.rain[n]) * (dx === wind ? 1.8 : dx === -wind ? 0.5 : 1);
        if (rng.next() < p) spreadTo.push(n);
      }
    }
    veg[c] *= 0.55;
    if (f <= 1) {
      fire[c] = 0;
      veg[c] = Math.min(veg[c], 0.04);
      w.fert[c] = Math.min(1, w.fert[c] + 0.06);
    } else fire[c] = f - 1;
  }
  for (const n of spreadTo) if (!fire[n]) fire[n] = 3 + rng.int(3);
  return burning;
}

export function ignite(w, c) {
  if (w.elev[c] >= w.seaLevel && w.veg[c] > 0.05) w.fire[c] = Math.max(w.fire[c], 4);
}
