// Climate. Temperature follows latitude, altitude (lapse rate) and continentality, with a
// seasonal swing that is larger inland and towards the poles and opposite in the two hemispheres.
// Rain is carried by prevailing winds — easterly trades, mid-latitude westerlies, polar easterlies:
// each row of the map is swept downwind, air picks up moisture over warm sea and drops it over land,
// heavily where it is forced up a slope (so mountains cast rain shadows and continental interiors
// dry out); plants return part of it. Global temperature responds to CO₂ (greenhouse), dust
// (volcanoes, impacts, nuclear winter) and the player's forcing, and sea level follows global
// temperature, slowly drowning or exposing coasts.

import { clamp, smoothstep } from '../core/util.js';
import { B } from './constants.js';
import { markTerrainChanged } from './state.js';

/** prevailing zonal wind at row y: +1 blows towards +x (east), -1 towards west */
export function windAt(w, y) {
  const a = Math.abs(((y + 0.5) / w.H) * 2 - 1);
  return a < 0.32 ? -1 : a < 0.68 ? 1 : -1;
}

export function latitude(w, y) {
  return ((y + 0.5) / w.H) * 2 - 1; // -1 north pole … +1 south pole
}

/** distance (in cells) from every cell to the nearest cell of the other kind (land vs sea) */
export function computeCoastDist(w) {
  const { W, H, N, elev, seaLevel } = w;
  const d = w.coastDist;
  const q = new Int32Array(N);
  let head = 0, tail = 0;
  d.fill(1e9);
  for (let c = 0; c < N; c++) {
    const sea = elev[c] < seaLevel;
    const x = c % W, y = (c / W) | 0;
    let edge = false;
    for (let k = 0; k < 4 && !edge; k++) {
      const xx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), yy = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if ((elev[yy * W + xx] < seaLevel) !== sea) edge = true;
    }
    if (edge) { d[c] = 1; q[tail++] = c; }
  }
  while (head < tail) {
    const c = q[head++];
    const sea = elev[c] < seaLevel;
    const x = c % W, y = (c / W) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if ((elev[n] < seaLevel) !== sea || d[n] <= d[c] + 1) continue;
        d[n] = d[c] + 1;
        q[tail++] = n;
      }
    }
  }
  for (let c = 0; c < N; c++) if (d[c] > 1e8) d[c] = 255;
}

/** recompute temperature, seasonality, rainfall and biomes from the terrain */
export function computeClimate(w) {
  const { W, H, N, elev, seaLevel } = w;
  computeCoastDist(w);
  const bias = w.climate.bias;
  for (let y = 0; y < H; y++) {
    const lat = latitude(w, y);
    const a = Math.abs(lat);
    const t0 = 29 - 48 * Math.pow(a, 1.9);
    const amp0 = 2 + 26 * Math.pow(a, 1.2);
    const hemi = lat < 0 ? 1 : -1;
    for (let x = 0; x < W; x++) {
      const c = y * W + x;
      const h = elev[c] - seaLevel;
      if (h < 0) {
        w.baseTemp[c] = Math.max(-2, t0 * 0.9 + 2.5) + bias;
        w.seasonAmp[c] = amp0 * 0.3 * hemi;
      } else {
        const cont = clamp(w.coastDist[c] / 22, 0, 1);
        w.baseTemp[c] = t0 - 30 * h + bias - 1.5 * cont;
        w.seasonAmp[c] = amp0 * (0.4 + 0.6 * cont) * hemi;
      }
    }
  }
  computeRain(w);
  computeBiomes(w);
  w.dirty.climate = false;
}

function computeRain(w) {
  const { W, H, elev, seaLevel, veg, lake } = w;
  const rain = w.rain;
  const wet = w.climate.wetness * (1 + 0.025 * w.climate.offset);
  const off = w.climate.offset;
  const rowE = new Float32Array(W), rowW = new Float32Array(W);
  // sweep one row downwind, writing per-cell precipitation into out
  const sweep = (y, dir, out) => {
    let m = 0.45;
    let prevH = 0;
    for (let i = 0; i < W; i++) {
      const x = dir > 0 ? i : W - 1 - i;
      const c = y * W + x;
      const h = elev[c] - seaLevel;
      if (h < 0 || lake[c] > 0) {
        const T = Math.max(0, w.baseTemp[c] + off);
        m += (0.025 + T * 0.0024) * (1 - m) * wet;
        out[x] = m * 0.03;
        prevH = Math.max(0, h);
      } else {
        const rise = Math.max(0, h - prevH);
        const frac = Math.min(0.5, 0.026 + rise * 5);
        const r = m * frac;
        m -= r;
        m += r * 0.6 * (0.25 + 0.75 * veg[c]); // transpiration recycles rain inland
        out[x] = r;
        prevH = h;
      }
    }
  };
  for (let y = 0; y < H; y++) {
    const a = Math.abs(latitude(w, y));
    // share of westerly flow: blends smoothly across the edges of the circulation cells
    const west = smoothstep(0.22, 0.42, a) * (1 - smoothstep(0.58, 0.78, a));
    if (west < 0.999) sweep(y, -1, rowE);
    if (west > 0.001) sweep(y, 1, rowW);
    const band = (1 + 0.7 * Math.exp(-((a / 0.12) ** 2)) - 0.35 * Math.exp(-(((a - 0.3) / 0.11) ** 2)) + 0.25 * Math.exp(-(((a - 0.56) / 0.1) ** 2))) *
      (1 - 0.5 * smoothstep(0.7, 1, a));
    for (let x = 0; x < W; x++) {
      const r = (west < 0.999 ? rowE[x] * (1 - west) : 0) + (west > 0.001 ? rowW[x] * west : 0);
      rain[y * W + x] = 1 - Math.exp(-r * 72 * band);
    }
  }
  blur(rain, W, H, 2);
  blur(rain, W, H, 3);
  for (let c = 0; c < w.N; c++) rain[c] = clamp(rain[c], 0, 1);
}

/** separable box blur in place */
export function blur(f, W, H, r) {
  const tmp = new Float32Array(Math.max(W, H));
  for (let y = 0; y < H; y++) {
    let s = 0, n = 0;
    for (let x = -r; x <= r; x++) if (x >= 0 && x < W) { s += f[y * W + x]; n++; }
    for (let x = 0; x < W; x++) {
      tmp[x] = s / n;
      const xo = x - r, xi = x + r + 1;
      if (xo >= 0) { s -= f[y * W + xo]; n--; }
      if (xi < W) { s += f[y * W + xi]; n++; }
    }
    for (let x = 0; x < W; x++) f[y * W + x] = tmp[x];
  }
  for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let y = -r; y <= r; y++) if (y >= 0 && y < H) { s += f[y * W + x]; n++; }
    for (let y = 0; y < H; y++) {
      tmp[y] = s / n;
      const yo = y - r, yi = y + r + 1;
      if (yo >= 0) { s -= f[yo * W + x]; n--; }
      if (yi < H) { s += f[yi * W + x]; n++; }
    }
    for (let y = 0; y < H; y++) f[y * W + x] = tmp[y];
  }
}

export function computeBiomes(w) {
  const { N, elev, seaLevel, lake, rain, flow } = w;
  const off = w.climate.offset;
  for (let c = 0; c < N; c++) {
    const h = elev[c] - seaLevel;
    const T = w.baseTemp[c] + off;
    let b;
    if (h < 0) {
      const d = -h;
      b = d > 0.3 ? B.DEEP : d > 0.09 ? B.OCEAN : T > 21 && d < 0.05 && w.coastDist[c] <= 4 ? B.REEF : B.SHALLOW;
    } else if (lake[c] > 0) {
      b = B.LAKE;
    } else if (w.scorch[c] > 0) {
      b = w.rad[c] > 0.3 ? B.WASTE : B.VOLCANIC;
    } else if (w.rad[c] > 0.4) {
      b = B.WASTE;
    } else {
      const Rn = Math.min(1, rain[c] + Math.min(0.25, flow[c] / 400));
      if (T < -11) b = B.ICE;
      else if (h > 0.55) b = T < 2 ? B.SNOWPEAK : B.MOUNTAIN;
      else if (h > 0.4 && T < -3) b = B.SNOWPEAK;
      else if (h > 0.42) b = B.MOUNTAIN;
      else if (h < 0.012 && w.coastDist[c] <= 1 && Rn < 0.65 && T > 0) b = B.BEACH;
      else if (T < -4) b = B.TUNDRA;
      else if (T < 3) b = Rn > 0.28 ? B.TAIGA : B.TUNDRA;
      else if (Rn < 0.13) b = B.DESERT;
      else if (T > 19) b = Rn > 0.62 ? B.JUNGLE : Rn > 0.32 ? B.SAVANNA : Rn > 0.2 ? B.SHRUB : B.DESERT;
      else if (Rn > 0.5) b = Rn > 0.78 && h < 0.05 && flow[c] > 25 ? B.SWAMP : B.FOREST;
      else b = Rn > 0.24 ? B.GRASS : B.SHRUB;
    }
    w.biome[c] = b;
  }
}

/** greenhouse + aerosol forcing → target anomaly; called once a year */
export function updateGlobalClimate(w, vegFraction) {
  const cl = w.climate;
  // the carbon cycle: excess CO₂ is slowly taken up by plants and the ocean
  cl.co2 -= (cl.co2 - 280) * (0.003 + 0.008 * vegFraction);
  cl.co2 = clamp(cl.co2, 120, 4000);
  cl.dust *= 0.82; // aerosols wash out within a few years
  if (cl.dust < 1e-4) cl.dust = 0;
  if (cl.iceAge > 0) cl.iceAge--;
  const target = 3.2 * Math.log2(cl.co2 / 280) - 7 * (cl.dust / (0.6 + cl.dust)) + cl.solar - (cl.iceAge > 0 ? 9 : 0);
  cl.offset += (target - cl.offset) * 0.12;

  // sea level follows global temperature (ice sheets melt or grow) with a long lag
  const seaTarget = w.seaLevelBase + clamp(cl.offset * 0.0042, -0.05, 0.06);
  const before = w.seaLevel;
  w.seaLevel += (seaTarget - w.seaLevel) * 0.03;
  w._seaDrift = (w._seaDrift || 0) + Math.abs(w.seaLevel - before);
  if (w._seaDrift > 0.0006) { w._seaDrift = 0; markTerrainChanged(w); }
}
