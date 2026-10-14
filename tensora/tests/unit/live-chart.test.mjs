import test from 'node:test';
import assert from 'node:assert/strict';
import { live } from '../../src/core/live.js';
import { smoothPath } from '../../src/ui/charts.js';

test('repeated horizontal coordinates produce finite vertical curve segments', () => {
  for (const points of [
    [[10, 20], [10, 30], [10, 25]],
    [[0, 10], [10, 20], [10, 30], [10, 25], [20, 35]],
  ]) {
    const path = smoothPath(points);
    assert.doesNotMatch(path, /NaN|Infinity/);
    assert.match(path, /^M/);
    const [x, y] = points.at(-1);
    assert.ok(path.endsWith(`${x.toFixed(2)},${y.toFixed(2)}`));
  }
});

test('a stalled or backwards wall clock keeps live samples ordered and drawable', () => {
  const previous = live.hist.at(-1).t;
  const originalNow = Date.now;
  try {
    Date.now = () => previous - 5000;
    for (let i = 0; i < 3; i++) live.step();
  } finally {
    Date.now = originalNow;
  }
  const samples = live.hist.slice(-4);
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i].t - samples[i - 1].t >= 1000);
  assert.doesNotMatch(smoothPath(samples.map(p => [p.t - previous, p.v])), /NaN|Infinity/);
});
