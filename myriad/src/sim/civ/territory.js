// Borders. Every city radiates influence over the land around it; a multi-source Dijkstra
// (mountains and water cost more, strong cities reach further, incumbent owners hold ground a little
// more easily) assigns each cell to the city that reaches it most cheaply. The same pass totals
// each city's food potential and each nation's area.

import { MinHeap } from '../../core/heap.js';
import { BIOMES } from '../constants.js';
import { tileFood } from './city.js';

const heap = new MinHeap(8192);
let best = null, src = null;

export function computeTerritory(w) {
  const { W, H, N } = w;
  if (!best || best.length !== N) { best = new Float32Array(N); src = new Int32Array(N); }
  best.fill(Infinity);
  src.fill(-1);
  heap.clear();
  const prevOwner = w.owner;
  const cities = w.cities;
  const strength = new Float32Array(cities.length);
  const reach = new Float32Array(cities.length);
  for (const c of cities) {
    if (!c.alive) continue;
    const n = w.nations[c.nation];
    strength[c.id] = 1 + c.tier * 0.35 + (c.capital ? 0.4 : 0) + Math.min(1, c.culture / 4000) * 0.6;
    reach[c.id] = 3 + c.tier * 1.6 + (c.capital ? 1.5 : 0) + Math.min(5, Math.sqrt(c.culture) / 18) + (n.tf && n.tf.sailing ? 0.5 : 0);
    const cell = c.y * W + c.x;
    best[cell] = 0;
    src[cell] = c.id;
    heap.push(cell, 0);
  }
  while (heap.size > 0) {
    const key = heap.peekKey();
    const c = heap.pop();
    if (key > best[c]) continue;
    const ci = src[c];
    const city = cities[ci];
    const nat = city.nation;
    const s = strength[ci];
    const x = c % W, y = (c / W) | 0;
    for (let k = 0; k < 8; k++) {
      const dx = k < 2 ? (k ? -1 : 1) : k < 4 ? 0 : k < 6 ? 1 : -1;
      const dy = k < 2 ? 0 : k < 4 ? (k === 2 ? 1 : -1) : k % 2 ? -1 : 1;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      const water = w.elev[n] < w.seaLevel || w.lake[n] > 0;
      let cost;
      if (water) {
        if (w.lake[n] <= 0 && w.coastDist[n] > 2) continue; // territorial waters only
        cost = 1.6;
      } else cost = 0.6 + BIOMES[w.biome[n]].move * 0.4;
      if (k >= 4) cost *= 1.414;
      if (prevOwner[n] === nat) cost *= 0.85; // incumbency
      const g = best[c] + cost / s;
      if (g * s > reach[ci]) continue;
      if (g < best[n]) {
        best[n] = g;
        src[n] = ci;
        heap.push(n, g);
      }
    }
  }
  // write ownership and totals
  for (const c of cities) { if (c.alive) { c.cells = 0; c.food = 0; } }
  for (const n of w.nations) { if (n.alive) n.stats.cells = 0; }
  const owner = w.owner, ownerCity = w.ownerCity;
  for (let c = 0; c < N; c++) {
    const ci = src[c];
    if (ci < 0) { owner[c] = -1; ownerCity[c] = -1; continue; }
    const city = cities[ci];
    const n = w.nations[city.nation];
    owner[c] = city.nation;
    ownerCity[c] = ci;
    city.cells++;
    n.stats.cells++;
    city.food += tileFood(w, c, n.tf || {});
  }
  w.territoryVersion = (w.territoryVersion || 0) + 1;
  w.dirty.territory = false;
}
