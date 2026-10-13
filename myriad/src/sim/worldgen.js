// Terrain generation. Continents come from a light-weight plate model: the map is split into
// noise-warped Voronoi plates, each continental or oceanic and drifting in some direction; mountain
// ranges rise where plates converge, trenches and rifts open where they meet or part, and volcanic
// arcs follow subduction zones. Fractal noise adds the detail, a preset mask shapes the overall
// geography, and the result is normalised so that a chosen fraction of the map is land.

import { RNG } from '../core/rng.js';
import { makeNoise2D, fbm, ridged } from '../core/noise.js';
import { clamp, smoothstep } from '../core/util.js';
import { R } from './constants.js';

export const PRESETS = {
  continents: { name: '群陆', desc: '数块大陆隔洋相望，最经典的世界', land: 0.37, plates: 13, cont: 0.45, mountains: 1, temp: 0, wet: 1 },
  pangaea: { name: '盘古', desc: '一整块超级大陆，内陆辽阔干旱', land: 0.4, plates: 11, cont: 0.5, mountains: 1.1, temp: 0, wet: 0.9, mask: 'center' },
  archipelago: { name: '千岛', desc: '星罗棋布的群岛，物种在孤岛上各自演化', land: 0.25, plates: 30, cont: 0.38, mountains: 0.8, temp: 2, wet: 1.15, detail: 2.2, islands: 1 },
  twin: { name: '双生', desc: '东西两块大陆，中间是一道海峡', land: 0.38, plates: 12, cont: 0.45, mountains: 1, temp: 0, wet: 1, mask: 'twin' },
  ring: { name: '环海', desc: '一圈环形大陆围住一片内海', land: 0.36, plates: 14, cont: 0.45, mountains: 1, temp: 1, wet: 1, mask: 'ring' },
  highland: { name: '群峰', desc: '高山深谷纵横，河流湍急，山地文明的摇篮', land: 0.42, plates: 16, cont: 0.5, mountains: 1.9, temp: -2, wet: 1.1 },
  waterworld: { name: '沧海', desc: '几乎被海洋覆盖，只有零星陆地', land: 0.12, plates: 18, cont: 0.3, mountains: 1.1, temp: 3, wet: 1.3, detail: 1.3 },
  frozen: { name: '霜星', desc: '寒冷的冰封世界，只有赤道附近适宜生存', land: 0.36, plates: 13, cont: 0.45, mountains: 1, temp: -13, wet: 0.8 },
  desert: { name: '赤砂', desc: '炎热干燥的沙海，水源决定一切', land: 0.45, plates: 12, cont: 0.5, mountains: 1, temp: 7, wet: 0.45 },
};

/**
 * Fill w.elev, w.plate, w.stress and w.volcanoes.
 * opts: { preset, land, mountains } (land/mountains override the preset)
 */
export function generateTerrain(w, opts = {}) {
  const P = PRESETS[opts.preset] || PRESETS.continents;
  const landFrac = opts.land ?? P.land;
  const mountainK = (opts.mountains ?? 1) * P.mountains;
  const rng = new RNG(w.seed);
  const { W, H } = w;
  const S = Math.min(W, H);
  const nWarpX = makeNoise2D(rng.int(1e9));
  const nWarpY = makeNoise2D(rng.int(1e9));
  const nBase = makeNoise2D(rng.int(1e9));
  const nRidge = makeNoise2D(rng.int(1e9));
  const nCont = makeNoise2D(rng.int(1e9));
  const scale = 1 / S; // noise frequencies are relative to map size so all sizes look alike
  const detail = P.detail || 1;

  // ---- plates
  const NP = Math.max(4, Math.round(P.plates * Math.sqrt((W * H) / (320 * 200))));
  const plates = [];
  for (let i = 0; i < NP; i++) {
    const x = rng.range(0, W), y = rng.range(0, H);
    let contP = P.cont;
    const ux = x / W - 0.5, uy = y / H - 0.5;
    if (P.mask === 'center') contP += 0.5 - 2.2 * Math.hypot(ux, uy);
    if (P.mask === 'twin') contP += 0.45 - 2.4 * Math.min(Math.hypot(ux + 0.25, uy), Math.hypot(ux - 0.25, uy));
    if (P.mask === 'ring') contP += 0.5 - 6 * Math.abs(Math.hypot(ux, uy * 1.4) - 0.28);
    const continental = rng.next() < contP;
    const a = rng.range(0, Math.PI * 2), sp = rng.range(0.3, 1);
    plates.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, continental,
      base: continental ? rng.range(0.26, 0.4) : rng.range(-0.55, -0.4),
    });
  }
  w.plates = plates.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, continental: p.continental }));

  const BW = S * 0.045; // half-width of plate boundary zones
  const warp = S * 0.11;
  const elev = w.elev;
  const volcanoCandidates = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = y * W + x;
      const fx = x * scale, fy = y * scale;
      const wx = x + warp * fbm(nWarpX, fx * 2.2, fy * 2.2, 4);
      const wy = y + warp * fbm(nWarpY, fx * 2.2 + 31.7, fy * 2.2 - 11.3, 4);
      let d1 = Infinity, d2 = Infinity, i1 = 0, i2 = 0;
      for (let i = 0; i < NP; i++) {
        const dx = wx - plates[i].x, dy = wy - plates[i].y;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = i; } else if (d < d2) { d2 = d; i2 = i; }
      }
      d1 = Math.sqrt(d1); d2 = Math.sqrt(d2);
      const pa = plates[i1], pb = plates[i2];
      w.plate[c] = i1;
      const e = clamp(1 - (d2 - d1) / BW, 0, 1); // 1 on the boundary, 0 away from it

      // base height: continental shelves blend towards each other near boundaries
      let h = pa.base + (((pa.base + pb.base) / 2) - pa.base) * e * 0.55;
      // continents are not uniform: large-scale noise carves inland seas and bays
      h += 0.22 * fbm(nCont, fx * 3.1, fy * 3.1, 3);

      // relative motion across the boundary
      let nx = pb.x - pa.x, ny = pb.y - pa.y;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      const conv = (pa.vx - pb.vx) * nx + (pa.vy - pb.vy) * ny; // > 0: plates collide
      let tect = 0;
      if (e > 0) {
        const e15 = e * Math.sqrt(e), e2 = e * e;
        if (conv > 0) {
          if (pa.continental && pb.continental) tect = conv * 0.85 * e15;
          else if (pa.continental) tect = conv * 0.6 * e15;
          else if (pb.continental) tect = -conv * 0.32 * e2;
          else tect = conv * 0.5 * e2 * e;
          if (e > 0.82 && conv > 0.45 && (pa.continental !== pb.continental || !pa.continental)) volcanoCandidates.push(c);
        } else {
          tect = pa.continental && pb.continental ? conv * 0.28 * e2 : -conv * 0.16 * e2;
        }
        w.stress[c] = Math.abs(conv) * e;
      }
      const ridge = ridged(nRidge, fx * 6 * detail, fy * 6 * detail, 5);
      h += tect * mountainK * (0.55 + 0.9 * ridge);
      h += 0.3 * fbm(nBase, fx * 7 * detail, fy * 7 * detail, 6);
      if (P.islands) h += 0.32 * fbm(nRidge, fx * 16 + 5.3, fy * 16 - 2.1, 3);
      h += 0.12 * mountainK * ridge * (pa.continental ? 1 : 0.35) * smoothstep(-0.1, 0.25, h);

      // preset masks
      const ux = x / W - 0.5, uy = y / H - 0.5;
      if (P.mask === 'center') h += 0.35 - 1.4 * Math.hypot(ux * 1.1, uy * 1.4);
      else if (P.mask === 'twin') h += 0.25 - 1.5 * Math.min(Math.hypot((ux + 0.24) * 1.3, uy), Math.hypot((ux - 0.24) * 1.3, uy)) - 0.25 * Math.exp(-ux * ux * 160);
      else if (P.mask === 'ring') h += 0.25 - 4.5 * Math.abs(Math.hypot(ux, uy * 1.5) - 0.3);

      // the world is a floating shard: its rim is always open sea
      const edge = Math.min(x, W - 1 - x, y, H - 1 - y) / (S * 0.13);
      h -= (1 - smoothstep(0, 1, edge)) * 0.9;
      elev[c] = h;
    }
  }

  // ---- normalise: the landFrac quantile becomes sea level (0)
  const sorted = Float32Array.from(elev).sort();
  const t = sorted[Math.floor((1 - landFrac) * (sorted.length - 1))];
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  for (let c = 0; c < w.N; c++) {
    const v = elev[c];
    if (v >= t) elev[c] = Math.pow((v - t) / (hi - t + 1e-9), 2.0) * 0.95 + 0.002;
    else elev[c] = -Math.pow((t - v) / (t - lo + 1e-9), 0.55);
  }
  // the outermost cells are always sea, whatever the mountains near the rim say
  for (let c = 0; c < w.N; c++) {
    const x = c % W, y = (c / W) | 0;
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 3) elev[c] = Math.min(elev[c], -0.03 - (3 - d) * 0.03);
  }

  // ---- volcanoes: subduction arcs plus a hot spot or two
  w.volcanoes = [];
  rng.shuffle(volcanoCandidates);
  const wantV = Math.round(5 * Math.sqrt((W * H) / (320 * 200)));
  for (const c of volcanoCandidates) {
    if (w.volcanoes.length >= wantV) break;
    const x = c % W, y = (c / W) | 0;
    if (w.volcanoes.some((v) => Math.hypot(v.x - x, v.y - y) < S * 0.12)) continue;
    addVolcano(w, x, y, rng.range(0.3, 1));
  }
  for (let k = 0; k < 2; k++) {
    const x = rng.int(W - 20) + 10, y = rng.int(H - 20) + 10;
    if (!w.volcanoes.some((v) => Math.hypot(v.x - x, v.y - y) < S * 0.1)) addVolcano(w, x, y, rng.range(0.2, 0.6));
  }
}

/** create a volcanic cone and register it */
export function addVolcano(w, x, y, activity = 0.6, raise = true) {
  const { W } = w;
  if (raise) {
    const peak = Math.max(w.elev[y * W + x], w.seaLevel) + 0.12 + activity * 0.1;
    const r = 4;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= w.H) continue;
        const d = Math.hypot(dx, dy) / r;
        if (d > 1) continue;
        const c = yy * W + xx;
        const cone = peak - (peak - w.elev[c]) * Math.pow(d, 0.7);
        w.elev[c] = Math.max(w.elev[c], d < 0.2 ? peak - 0.03 : cone); // crater dip at the top
      }
    }
  }
  const v = { x, y, activity, heat: 0, erupting: 0, eruptions: 0, name: null };
  w.volcanoes.push(v);
  return v;
}

/** scatter mineral and biological resources; call after the first climate/biome pass */
export function placeResources(w) {
  const rng = new RNG(w.seed ^ 0xa5a5a5);
  const nClump = makeNoise2D(rng.int(1e9));
  const { W, H, N } = w;
  const S = Math.min(W, H);
  for (let c = 0; c < N; c++) {
    const x = c % W, y = (c / W) | 0;
    const clump = (fbm(nClump, (x / S) * 9, (y / S) * 9, 3) + 1) / 2; // deposits come in clusters
    const k = clump * clump * 2.2;
    const h = w.elev[c] - w.seaLevel;
    const b = w.biome[c];
    let r = R.NONE;
    if (h < 0) {
      if (h > -0.12 && w.coastDist[c] <= 3 && rng.chance(0.05 * k)) r = R.FISH;
      else if (h > -0.1 && rng.chance(0.004 * k)) r = R.OIL;
    } else if (w.lake[c] <= 0) {
      const st = w.stress[c];
      const hill = smoothstep(0.08, 0.3, h);
      const roll = rng.next() / k;
      if (roll < 0.006 + 0.01 * hill + 0.01 * st) r = R.COPPER;
      else if (roll < 0.012 + 0.02 * hill + 0.014 * st) r = R.IRON;
      else if (roll < 0.0145 + 0.006 * hill + 0.006 * st) r = R.GOLD;
      else if (roll < 0.016 + 0.004 * hill) r = R.GEMS;
      else if (roll < 0.017 + 0.002 * st) r = R.URANIUM;
      else if (roll < 0.03 && h < 0.25 && (b === 8 || b === 7 || b === 14 || b === 9)) r = R.COAL;
      else if (roll < 0.036 && (b === 11 || b === 6 || b === 17)) r = R.OIL;
      else if (roll < 0.05 && (b === 13 || b === 12)) r = R.SPICE;
      else if (roll < 0.058 && hill > 0.3) r = R.MARBLE;
      else if (roll < 0.066 && (b === 9 || b === 12)) r = R.HORSE;
    }
    w.res[c] = r;
  }
}
