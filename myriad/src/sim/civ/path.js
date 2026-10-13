// A* path finding on the cell grid for settlers, armies, roads and trade routes, plus landmass
// labelling (which cells are connected by land) used to decide who can reach whom.

import { MinHeap } from '../../core/heap.js';
import { BIOMES } from '../constants.js';

const heap = new MinHeap(4096);
let gScore = null, came = null, stamp = null, curStamp = 0;

function ensure(N) {
  if (!gScore || gScore.length !== N) {
    gScore = new Float32Array(N);
    came = new Int32Array(N);
    stamp = new Uint32Array(N);
  }
}

/**
 * Find a path from cell a to cell b. opts:
 *   sea: 0 = land only, 1 = may cross coastal water (≤ 3 cells from land), 2 = open ocean
 *   roads: prefer roads; maxNodes: give up after expanding this many cells
 * Returns an array of cell indices (a … b) or null.
 */
export function findPath(w, a, b, opts = {}) {
  const { W, H, N } = w;
  ensure(N);
  curStamp++;
  if (curStamp === 0xffffffff) { stamp.fill(0); curStamp = 1; }
  const sea = opts.sea ?? 0;
  const maxNodes = opts.maxNodes ?? 30000;
  // land-only routes between different landmasses cannot exist
  if (sea === 0 && w.landmass && w.landmass[a] >= 0 && w.landmass[b] >= 0 && w.landmass[a] !== w.landmass[b]) return null;
  const bx = b % W, by = (b / W) | 0;
  heap.clear();
  stamp[a] = curStamp;
  gScore[a] = 0;
  came[a] = -1;
  heap.push(a, 0);
  let expanded = 0;
  const elev = w.elev, seaLevel = w.seaLevel, lake = w.lake, biome = w.biome, road = w.road;
  while (heap.size > 0) {
    const c = heap.pop();
    if (c === b) {
      const path = [];
      for (let k = c; k >= 0; k = came[k]) path.push(k);
      return path.reverse();
    }
    if (++expanded > maxNodes) return null;
    const x = c % W, y = (c / W) | 0;
    const gc = gScore[c];
    for (let k = 0; k < 8; k++) {
      const dx = k < 2 ? (k ? -1 : 1) : k < 4 ? 0 : k < 6 ? 1 : -1;
      const dy = k < 2 ? 0 : k < 4 ? (k === 2 ? 1 : -1) : k % 2 ? -1 : 1;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      const water = elev[n] < seaLevel || lake[n] > 0;
      let cost;
      if (water) {
        if (sea === 0 && n !== b) continue;
        if (sea === 1 && w.coastDist[n] > 3) continue;
        cost = 1.6;
      } else {
        cost = BIOMES[biome[n]].move;
        if (road[n]) cost = Math.min(cost, road[n] >= 2 ? 0.35 : 0.6);
        if (opts.avoid && opts.avoid(n)) cost += 30;
      }
      if (k >= 4) cost *= 1.414;
      const g = gc + cost;
      if (stamp[n] === curStamp && g >= gScore[n]) continue;
      stamp[n] = curStamp;
      gScore[n] = g;
      came[n] = c;
      const h = Math.max(Math.abs(xx - bx), Math.abs(yy - by)) * 1.05;
      heap.push(n, g + h);
    }
  }
  return null;
}

/** label connected land regions; w.landmass[c] = id (or -1 for water); returns sizes */
export function labelLandmasses(w) {
  const { W, H, N } = w;
  if (!w.landmass || w.landmass.length !== N) w.landmass = new Int32Array(N);
  const lm = w.landmass;
  lm.fill(-1);
  const q = new Int32Array(N);
  const sizes = [];
  for (let s = 0; s < N; s++) {
    if (lm[s] >= 0 || w.elev[s] < w.seaLevel) continue;
    const id = sizes.length;
    let head = 0, tail = 0, size = 0;
    q[tail++] = s;
    lm[s] = id;
    while (head < tail) {
      const c = q[head++];
      size++;
      const x = c % W, y = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const xx = x + [1, -1, 0, 0, 1, 1, -1, -1][k], yy = y + [0, 0, 1, -1, 1, -1, 1, -1][k];
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (lm[n] >= 0 || w.elev[n] < w.seaLevel) continue;
        lm[n] = id;
        q[tail++] = n;
      }
    }
    sizes.push(size);
  }
  w.landmassSizes = sizes;
  w.landmassVersion = w.elevVersion;
  return sizes;
}

/** lay a road (level) along a path of cells */
export function buildRoad(w, path, level = 1) {
  let changed = 0;
  for (const c of path) {
    if (w.elev[c] < w.seaLevel || w.lake[c] > 0) continue;
    if (w.road[c] < level) { w.road[c] = level; changed++; }
  }
  if (changed) w.terrainVersion++;
  return changed;
}
