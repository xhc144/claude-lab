// Geology and sudden catastrophes: volcanic eruptions with flowing lava that hardens into new
// land, earthquakes along plate boundaries, tsunamis, and meteor impacts that dig craters and
// darken the sky. Damage to living things is not applied here: each catastrophe pushes an
// "impact" ({kind, x, y, r, power}) that the life and civilisation systems consume, which keeps
// this module independent of them.

import { clamp } from '../core/util.js';
import { markTerrainChanged, pushFx, forDisk } from './state.js';
import { ignite } from './vegetation.js';
import { addVolcano } from './worldgen.js';

export function pushImpact(w, imp) {
  (w.impacts || (w.impacts = [])).push(imp);
}

// ---- volcanoes -----------------------------------------------------------------------------------

export function stepVolcanoes(w, rng) {
  for (const v of w.volcanoes) {
    if (v.erupting > 0) {
      v.erupting--;
      const c = v.y * w.W + v.x;
      w.lava[c] += 0.004 + v.activity * 0.006;
      if (rng.chance(0.5)) pushFx(w, { type: 'eruption', x: v.x + 0.5, y: v.y + 0.5, power: v.activity });
      w.climate.dust += 0.004 * v.activity;
      w.climate.co2 += 0.6 * v.activity;
      if (v.erupting === 0) v.heat = 0;
    } else if (w.settings.disasters) {
      v.heat += v.activity * rng.next() * 0.01;
      if (v.heat > 1 && rng.chance(0.02)) eruptVolcano(w, v, rng);
    }
  }
}

export function eruptVolcano(w, v, rng, power = 1) {
  v.erupting = Math.round((6 + rng.int(10)) * power);
  v.eruptions++;
  v.heat = 0;
  pushImpact(w, { kind: 'eruption', x: v.x + 0.5, y: v.y + 0.5, r: 3 + v.activity * 3 * power, power: v.activity * power, volcano: v });
  pushFx(w, { type: 'shockwave', x: v.x + 0.5, y: v.y + 0.5, r: 6, color: [255, 120, 40] });
}

/** lava flows downhill, burns everything, cools into rock that raises the land */
export function stepLava(w, rng) {
  const { W, H, N, elev, lava } = w;
  let active = 0;
  for (let c = 0; c < N; c++) {
    let L = lava[c];
    if (L <= 0) continue;
    active++;
    const x = c % W, y = (c / W) | 0;
    const s = elev[c] + L;
    let best = -1, bs = s;
    for (let k = 0; k < 8; k++) {
      const dx = k < 2 ? (k ? -1 : 1) : k < 4 ? 0 : k < 6 ? 1 : -1;
      const dy = k < 2 ? 0 : k < 4 ? (k === 2 ? 1 : -1) : k % 2 ? -1 : 1;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      const sn = elev[n] + lava[n] + rng.next() * 0.002;
      if (sn < bs) { bs = sn; best = n; }
    }
    if (best >= 0 && L > 0.0015) {
      const mv = Math.min(L - 0.001, (s - bs) * 0.4) * 0.6;
      if (mv > 0) { L -= mv; lava[best] += mv; }
    }
    w.veg[c] = 0;
    w.fire[c] = 0;
    if (rng.chance(0.08)) {
      const n = clamp(c + (rng.int(3) - 1) + (rng.int(3) - 1) * W, 0, N - 1);
      ignite(w, n);
    }
    // cooling: part of the lava solidifies each tick; under the sea it quenches quickly
    const cool = elev[c] < w.seaLevel ? 0.45 : 0.06;
    const solid = L * cool + 0.00015;
    elev[c] += Math.min(L, solid) * 0.9;
    L -= solid;
    w.scorch[c] = 70;
    if (L <= 0) { L = 0; w.fert[c] = Math.min(1, w.fert[c] + 0.1); }
    lava[c] = L;
    if (L > 0.002 && rng.chance(0.02)) pushImpact(w, { kind: 'lava', x: x + 0.5, y: y + 0.5, r: 0.8, power: 1 });
  }
  if (active) {
    w._lavaTerrain = (w._lavaTerrain || 0) + 1;
    if (w._lavaTerrain > 6) { w._lavaTerrain = 0; markTerrainChanged(w); }
  }
  return active;
}

// ---- earthquakes & tsunamis ---------------------------------------------------------------------

/** random quakes, most likely on stressed plate boundaries; called once a year */
export function maybeEarthquake(w, rng) {
  if (!w.settings.disasters || !rng.chance(0.05)) return;
  for (let t = 0; t < 40; t++) {
    const c = rng.int(w.N);
    if (w.stress[c] > 0.25 && rng.chance(w.stress[c])) {
      earthquake(w, c % w.W, (c / w.W) | 0, 5.5 + rng.next() * 3 * w.stress[c], rng);
      return;
    }
  }
}

export function earthquake(w, x, y, mag, rng) {
  const r = Math.max(2, (mag - 4) * 2.4);
  forDisk(w, x, y, r * 0.7, (c, xx, yy, d2) => {
    const k = 1 - Math.sqrt(d2) / (r * 0.7);
    w.elev[c] += (rng.next() - 0.5) * 0.006 * k * (mag - 5);
  });
  markTerrainChanged(w);
  pushImpact(w, { kind: 'quake', x: x + 0.5, y: y + 0.5, r, power: mag });
  pushFx(w, { type: 'quake', x: x + 0.5, y: y + 0.5, r, power: mag });
  // undersea or coastal megathrust → tsunami
  const c = y * w.W + x;
  if (mag >= 7.2 && (w.elev[c] < w.seaLevel || w.coastDist[c] <= 3)) tsunami(w, x, y, (mag - 6.5) * 0.004, r * 3.5);
  return { mag, r };
}

export function tsunami(w, x, y, amp, R) {
  pushFx(w, { type: 'tsunami', x: x + 0.5, y: y + 0.5, r: R });
  forDisk(w, x, y, R, (c, xx, yy, d2) => {
    if (w.elev[c] < w.seaLevel) return;
    const h = w.elev[c] - w.seaLevel;
    const reach = amp * (1 - Math.sqrt(d2) / R);
    if (w.coastDist[c] <= 6 && h < reach * 2.5) w.flood[c] += reach * (1 - w.coastDist[c] / 7);
  });
  pushImpact(w, { kind: 'tsunami', x: x + 0.5, y: y + 0.5, r: R, power: amp });
}

// ---- meteors -------------------------------------------------------------------------------------

/**
 * Impact of radius r (cells). Small rocks scorch a village; r ≥ 8 is an extinction event.
 * The crater gets a raised rim; dust darkens the sky for years.
 */
export function meteorImpact(w, x, y, r, rng) {
  const { W, H } = w;
  const c0 = clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1);
  const ocean = w.elev[c0] < w.seaLevel;
  const depth = 0.02 + r * 0.012;
  forDisk(w, x, y, r * 1.7, (c, xx, yy, d2) => {
    const d = Math.sqrt(d2) / r;
    if (d < 1) w.elev[c] -= depth * (1 - d * d) * (0.8 + 0.2 * rng.next());
    else w.elev[c] += depth * 0.35 * Math.max(0, 1 - (d - 1) / 0.7) * (0.6 + 0.4 * rng.next());
    w.veg[c] *= d < 1.3 ? 0 : 0.5;
    if (d < 1.2) { w.scorch[c] = 90; w.impr[c] = d < 0.8 ? 8 : w.impr[c]; }
  });
  forDisk(w, x, y, r * 3, (c, xx, yy, d2) => {
    if (rng.chance(0.35 * (1 - Math.sqrt(d2) / (r * 3)))) ignite(w, c);
  });
  w.climate.dust += 0.012 * r * r;
  w.climate.co2 += r * r * 0.8;
  markTerrainChanged(w);
  pushImpact(w, { kind: 'meteor', x, y, r: r * 2.4, power: r });
  pushFx(w, { type: 'shockwave', x, y, r: r * 6, color: [255, 230, 190] });
  if (ocean || w.coastDist[c0] < r * 2) tsunami(w, x, y, 0.004 + r * 0.0025, r * 9);
}

/** natural meteor falls — rare */
export function maybeMeteor(w, rng) {
  if (!w.settings.disasters || !rng.chance(0.0025)) return null;
  const x = rng.range(5, w.W - 5), y = rng.range(5, w.H - 5);
  const r = rng.chance(0.08) ? rng.range(4, 7) : rng.range(1, 2.5);
  return { x, y, r };
}

/** yearly slow geology: scorched ground heals, radiation decays, volcanoes reawaken */
export function stepGeologyYear(w, rng) {
  const { N, scorch, rad } = w;
  let changed = false;
  for (let c = 0; c < N; c++) {
    if (scorch[c]) { scorch[c]--; if (!scorch[c]) changed = true; }
    if (rad[c] > 0) rad[c] = rad[c] > 0.002 ? rad[c] * 0.985 : 0;
    if (w.pollution[c] > 0) w.pollution[c] *= 0.9;
    if (w.magic[c] > 0) w.magic[c] *= 0.999;
  }
  if (changed) w.dirty.climate = true;
  // hot spots occasionally birth a new volcano
  if (w.settings.disasters && rng.chance(0.002) && w.volcanoes.length < 14) {
    const c = rng.int(N);
    if (w.stress[c] > 0.4) { addVolcano(w, c % w.W, (c / w.W) | 0, rng.range(0.3, 0.9)); markTerrainChanged(w); }
  }
}
