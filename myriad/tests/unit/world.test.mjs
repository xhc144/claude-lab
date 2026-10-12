// The physical world: terrain generation, climate, hydrology, vegetation, geology.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hash2 } from '../../src/core/rng.js';
import { makeNoise2D } from '../../src/core/noise.js';
import { createPreview, createWorld, step } from '../../src/sim/world.js';
import { PRESETS } from '../../src/sim/worldgen.js';
import { latitude } from '../../src/sim/climate.js';
import { meteorImpact, earthquake } from '../../src/sim/geology.js';
import { B } from '../../src/sim/constants.js';

test('RNG and noise are deterministic', () => {
  const a = new RNG(42), b = new RNG(42);
  for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
  const n1 = makeNoise2D(7), n2 = makeNoise2D(7);
  for (let i = 0; i < 200; i++) assert.equal(n1(i * 0.37, i * 0.11), n2(i * 0.37, i * 0.11));
  for (let i = 0; i < 200; i++) { const v = n1(i * 0.13, -i * 0.29); assert.ok(v >= -1.0001 && v <= 1.0001); }
  assert.equal(hash2(3, 4, 5), hash2(3, 4, 5));
  // gaussian deviates have roughly unit variance
  const r = new RNG(1);
  let s = 0, s2 = 0;
  for (let i = 0; i < 20000; i++) { const g = r.gauss(); s += g; s2 += g * g; }
  assert.ok(Math.abs(s / 20000) < 0.03 && Math.abs(s2 / 20000 - 1) < 0.05);
});

test('every preset hits its land fraction and keeps open sea at the rim', () => {
  for (const key of Object.keys(PRESETS)) {
    const w = createPreview({ preset: key, seed: 3, W: 120, H: 76 });
    let land = 0, rimLand = 0;
    for (let c = 0; c < w.N; c++) {
      if (w.elev[c] >= w.seaLevel) {
        land++;
        const x = c % w.W, y = (c / w.W) | 0;
        if (x === 0 || y === 0 || x === w.W - 1 || y === w.H - 1) rimLand++;
      }
    }
    const frac = land / w.N;
    assert.ok(Math.abs(frac - PRESETS[key].land) < 0.03, `${key}: land fraction ${frac.toFixed(3)} vs ${PRESETS[key].land}`);
    assert.equal(rimLand, 0, `${key}: land at the map rim`);
  }
});

test('the same seed makes the same world, different seeds differ', () => {
  const a = createPreview({ seed: 'abc' }), b = createPreview({ seed: 'abc' }), c = createPreview({ seed: 'abd' });
  assert.deepEqual(Array.from(a.elev.slice(0, 500)), Array.from(b.elev.slice(0, 500)));
  let diff = 0;
  for (let i = 0; i < a.N; i++) if ((a.elev[i] >= 0) !== (c.elev[i] >= 0)) diff++;
  assert.ok(diff > a.N * 0.05);
});

test('climate: tropics are warmer than the poles, mountains colder than lowlands', () => {
  const w = createPreview({ seed: 9, W: 160, H: 100 });
  const rowMean = (y) => { let s = 0; for (let x = 0; x < w.W; x++) s += w.baseTemp[y * w.W + x]; return s / w.W; };
  assert.ok(rowMean(w.H >> 1) > rowMean(2) + 20, 'equator vs north pole');
  assert.ok(rowMean(w.H >> 1) > rowMean(w.H - 3) + 20, 'equator vs south pole');
  // at similar latitude, high land is colder than low land
  let hi = [], lo = [];
  for (let y = 40; y < 60; y++) for (let x = 0; x < w.W; x++) {
    const c = y * w.W + x, h = w.elev[c] - w.seaLevel;
    if (h > 0.3) hi.push(w.baseTemp[c]); else if (h > 0 && h < 0.05) lo.push(w.baseTemp[c]);
  }
  if (hi.length > 5 && lo.length > 5) assert.ok(hi.reduce((a, b) => a + b) / hi.length < lo.reduce((a, b) => a + b) / lo.length - 4);
  // seasons are opposite in the two hemispheres
  const n = Math.floor(w.H * 0.2) * w.W + 10, s = Math.floor(w.H * 0.8) * w.W + 10;
  assert.ok(w.seasonAmp[n] > 0 && w.seasonAmp[s] < 0);
  assert.ok(latitude(w, 0) < 0 && latitude(w, w.H - 1) > 0);
});

test('hydrology: every land cell drains to the sea without cycles', () => {
  const w = createPreview({ seed: 21, W: 140, H: 90 });
  for (let c = 0; c < w.N; c++) {
    if (w.elev[c] < w.seaLevel) continue;
    let k = c, steps = 0;
    while (w.elev[k] >= w.seaLevel && steps < w.N) {
      const d = w.down[k];
      if (d < 0) break; // edge outlet
      k = d; steps++;
    }
    assert.ok(steps < w.N, 'drainage cycle');
    assert.ok(w.elev[k] < w.seaLevel || w.down[k] < 0);
  }
  // rivers exist and discharge grows downstream
  let rivers = 0;
  for (let c = 0; c < w.N; c++) if (w.flow[c] > 14 && w.elev[c] >= w.seaLevel) { rivers++; const d = w.down[c]; if (d >= 0 && w.elev[d] >= w.seaLevel) assert.ok(w.flow[d] >= w.flow[c]); }
  assert.ok(rivers > 20);
});

test('biomes are consistent with climate', () => {
  const w = createPreview({ seed: 5, W: 160, H: 100 });
  for (let c = 0; c < w.N; c++) {
    const b = w.biome[c];
    if (w.elev[c] < w.seaLevel) assert.ok(b <= B.REEF);
    if (b === B.JUNGLE) assert.ok(w.baseTemp[c] > 18 && w.rain[c] > 0.4);
    if (b === B.DESERT) assert.ok(w.rain[c] + Math.min(0.25, w.flow[c] / 400) < 0.25);
    if (b === B.ICE) assert.ok(w.baseTemp[c] < -10);
  }
});

test('meteors dig craters and darken the sky; quakes shake the ground', () => {
  const w = createWorld({ seed: 4, size: 'small', start: 'barren' });
  const x = 120, y = 75, c = y * w.W + x;
  const before = w.elev[c];
  meteorImpact(w, x, y, 5, w.rng);
  assert.ok(w.elev[c] < before - 0.05);
  assert.ok(w.climate.dust > 0.2);
  for (let i = 0; i < 40; i++) step(w);
  assert.ok(w.climate.offset < 0, 'impact winter');
  const q = earthquake(w, 60, 40, 7, w.rng);
  assert.ok(q.r > 5);
});

test('global warming raises the sea and floods low coasts', () => {
  const w = createWorld({ seed: 8, size: 'small', start: 'barren' });
  const land0 = w.elev.reduce((s, e) => s + (e >= w.seaLevel ? 1 : 0), 0);
  // sustained emissions: CO₂ is held high against the carbon cycle
  for (let i = 0; i < 4 * 150; i++) { w.climate.co2 = 1600; step(w); }
  assert.ok(w.climate.offset > 4, `offset ${w.climate.offset}`);
  assert.ok(w.seaLevel > w.seaLevelBase0 + 0.01);
  const land1 = w.elev.reduce((s, e) => s + (e >= w.seaLevel ? 1 : 0), 0);
  assert.ok(land1 < land0);
});
