// Colours of the living world. Each land biome has a "bare" and a "lush" colour and its pixel
// colour moves between them with plant biomass; seasons tint deciduous forests in autumn and lay
// snow on cold ground; water darkens with depth and turns green where plankton blooms.

import { B } from '../sim/constants.js';

// [bare, lush] per biome
export const LAND = {
  [B.ICE]: [[222, 232, 242], [232, 240, 248]],
  [B.TUNDRA]: [[138, 132, 116], [128, 146, 112]],
  [B.TAIGA]: [[104, 106, 84], [38, 82, 60]],
  [B.FOREST]: [[124, 120, 74], [52, 112, 48]],
  [B.GRASS]: [[164, 158, 94], [108, 160, 64]],
  [B.SHRUB]: [[170, 158, 106], [120, 140, 72]],
  [B.DESERT]: [[226, 198, 138], [212, 192, 128]],
  [B.SAVANNA]: [[196, 170, 96], [158, 164, 70]],
  [B.JUNGLE]: [[110, 120, 60], [24, 100, 42]],
  [B.SWAMP]: [[92, 96, 72], [58, 94, 66]],
  [B.MOUNTAIN]: [[132, 120, 108], [110, 116, 92]],
  [B.SNOWPEAK]: [[234, 238, 244], [234, 238, 244]],
  [B.BEACH]: [[226, 210, 160], [214, 204, 150]],
  [B.VOLCANIC]: [[52, 46, 46], [70, 70, 54]],
  [B.WASTE]: [[104, 96, 78], [110, 108, 74]],
};

export const AUTUMN = [196, 118, 46];
export const SNOW = [238, 242, 248];
export const SEA_ICE = [214, 228, 240];
export const RIVER = [58, 118, 170];
export const LAKE = [56, 116, 160];
export const FARM_A = [196, 176, 92];
export const FARM_B = [132, 152, 70];
export const URBAN = [128, 122, 116];
export const ROAD = [140, 108, 72];
export const RAIL = [70, 64, 62];
export const HIGHWAY = [90, 92, 98];

/** water colour for depth d (elevation units below sea level), temperature T and plankton p */
export function waterColor(d, T, p, out) {
  const t = Math.sqrt(Math.min(1, d / 0.6));
  // shallow teal → deep navy
  let r = 46 + (16 - 46) * t, g = 112 + (40 - 112) * t, b = 150 + (86 - 150) * t;
  if (d < 0.025) { const s = 1 - d / 0.025; r += 26 * s * s; g += 34 * s * s; b += 14 * s * s; }
  // cold seas are greyer, warm seas bluer
  const cold = Math.max(0, Math.min(1, (8 - T) / 16));
  r += 10 * cold; g += 6 * cold; b -= 6 * cold;
  // plankton blooms tint the water green
  g += p * 22 * (1 - t);
  r -= p * 6;
  out[0] = r; out[1] = g; out[2] = b;
}
