// Hydrology. A priority flood from the sea gives every land cell a downhill route to the ocean
// (depressions are filled, so water can always leave them); summing rainfall along those routes
// gives river discharge, and filled depressions in wet regions become lakes. Rivers slowly cut their
// beds and carry sediment to their mouths, where deltas grow. Separately, "flood water" is a fast
// cellular layer for sudden water: storms, tsunamis, the player's springs.

import { MinHeap } from '../core/heap.js';

export const RIVER_FLOW = 14; // discharge above which a cell carries a visible river

let heap = null;

export function computeHydrology(w) {
  const { W, H, N, elev, seaLevel, rain } = w;
  if (!w._filled || w._filled.length !== N) {
    w._filled = new Float32Array(N);
    w._order = new Int32Array(N);
    w._visited = new Uint8Array(N);
  }
  const filled = w._filled, order = w._order, visited = w._visited;
  const down = w.down, flow = w.flow, lake = w.lake;
  visited.fill(0);
  down.fill(-1);
  heap = heap || new MinHeap(N >> 2);
  heap.clear();
  let oc = 0;

  for (let c = 0; c < N; c++) {
    const x = c % W, y = (c / W) | 0;
    if (elev[c] < seaLevel) {
      visited[c] = 1;
      filled[c] = seaLevel;
      // only sea cells touching land seed the flood
      let coast = false;
      for (let k = 0; k < 4 && !coast; k++) {
        const xx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), yy = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && elev[yy * W + xx] >= seaLevel) coast = true;
      }
      if (coast) heap.push(c, seaLevel);
    } else if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
      visited[c] = 1;
      filled[c] = elev[c];
      heap.push(c, elev[c]);
    }
  }

  while (heap.size > 0) {
    const c = heap.pop();
    if (elev[c] >= seaLevel) order[oc++] = c;
    const x = c % W, y = (c / W) | 0;
    const fc = filled[c];
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if ((dx === 0 && dy === 0) || xx < 0 || xx >= W) continue;
        const n = yy * W + xx;
        if (visited[n]) continue;
        visited[n] = 1;
        const fn = Math.max(elev[n], fc + 1e-5);
        filled[n] = fn;
        down[n] = c;
        heap.push(n, fn);
      }
    }
  }

  // discharge: accumulate rain downstream (reverse of flood order = upstream first)
  flow.fill(0);
  for (let i = 0; i < oc; i++) { const c = order[i]; flow[c] = 0.15 + rain[c] * 1.2; }
  for (let i = oc - 1; i >= 0; i--) {
    const c = order[i];
    const d = down[c];
    if (d >= 0 && elev[d] >= seaLevel) flow[d] += flow[c];
  }
  // lakes: filled depressions where enough water arrives
  for (let c = 0; c < N; c++) {
    lake[c] = 0;
    if (elev[c] < seaLevel) continue;
    const depth = filled[c] - elev[c];
    if (depth > 0.005 && (rain[c] > 0.3 || flow[c] > 60)) lake[c] = depth;
  }
  // a lone flooded cell is just a wide spot in a river, not a lake
  for (let c = 0; c < N; c++) {
    if (lake[c] <= 0) continue;
    const x = c % W, y = (c / W) | 0;
    let n = 0;
    for (let k = 0; k < 8; k++) {
      const xx = x + [1, -1, 0, 0, 1, 1, -1, -1][k], yy = y + [0, 0, 1, -1, 1, -1, 1, -1][k];
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && lake[yy * W + xx] > 0) n++;
    }
    if (n < 3) lake[c] = -1;
  }
  for (let c = 0; c < N; c++) if (lake[c] < 0) lake[c] = 0;
  w.dirty.hydro = false;
}

/** slow fluvial and thermal erosion; amount ≈ years elapsed */
export function erode(w, amount, rng) {
  const { W, H, N, elev, seaLevel, flow, down, lake } = w;
  for (let c = 0; c < N; c++) {
    if (flow[c] < 8 || elev[c] < seaLevel || lake[c] > 0) continue;
    const d = down[c];
    if (d < 0) continue;
    const slope = elev[c] - elev[d];
    if (slope <= 0) continue;
    const e = Math.min(slope * 0.25, 0.0000045 * Math.sqrt(flow[c]) * amount);
    elev[c] = Math.max(seaLevel + 0.0006, elev[c] - e);
    if (elev[d] < seaLevel) {
      // sediment builds a delta at the river mouth
      if (elev[d] < seaLevel - 0.001) elev[d] = Math.min(seaLevel - 0.0008, elev[d] + e * 0.9);
      else if (rng.chance(0.02 * amount)) elev[d] = seaLevel + 0.0008;
    } else {
      elev[d] += e * 0.3;
    }
  }
  // thermal weathering: oversteep slopes slump
  const samples = (N / 12) | 0;
  for (let s = 0; s < samples; s++) {
    const c = rng.int(N);
    const x = c % W, y = (c / W) | 0;
    let best = -1, bd = 0;
    for (let k = 0; k < 4; k++) {
      const xx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), yy = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      const diff = elev[c] - elev[n];
      if (diff > bd) { bd = diff; best = n; }
    }
    if (best >= 0 && bd > 0.07) {
      const m = (bd - 0.07) * 0.2 * Math.min(1, amount);
      elev[c] -= m;
      elev[best] += m;
    }
  }
}

/** fast surface water: spreads downhill, drains into the sea, evaporates */
export function stepFlood(w) {
  const { W, H, N, elev, seaLevel, flood } = w;
  let active = 0;
  for (let c = 0; c < N; c++) {
    let f = flood[c];
    if (f <= 0) continue;
    if (elev[c] < seaLevel) { flood[c] = 0; continue; }
    active++;
    const x = c % W, y = (c / W) | 0;
    const s = elev[c] + f;
    let best = -1, bs = s;
    for (let k = 0; k < 8; k++) {
      const dx = k < 2 ? (k ? -1 : 1) : k < 4 ? 0 : k < 6 ? 1 : -1;
      const dy = k < 2 ? 0 : k < 4 ? (k === 2 ? 1 : -1) : k % 2 ? -1 : 1;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      const sn = Math.max(elev[n], seaLevel) + flood[n];
      if (sn < bs) { bs = sn; best = n; }
    }
    if (best >= 0) {
      const mv = Math.min(f, (s - bs) * 0.5) * 0.85;
      f -= mv;
      if (elev[best] >= seaLevel) flood[best] += mv;
    }
    f = f * 0.985 - 0.00004;
    flood[c] = f > 0 ? f : 0;
    if (f > 0.0004) w.fire[c] = 0;
  }
  return active;
}
