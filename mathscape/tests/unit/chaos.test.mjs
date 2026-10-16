import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, detectPeriod, lyapunov, iterate, feigenbaum, aitken, bifurcationColumn } from '../../src/core/chaos.js';
import * as DD from '../../src/core/dd.js';

const { f, df } = MAPS.logistic;

test('periods along the logistic route to chaos', () => {
  assert.equal(detectPeriod(f, 2.8), 1);
  assert.equal(detectPeriod(f, 3.2), 2);
  assert.equal(detectPeriod(f, 3.5), 4);
  assert.equal(detectPeriod(f, 3.56), 8);
  assert.equal(detectPeriod(f, 3.83), 3); // the period-3 window
  assert.equal(detectPeriod(f, 3.9), 0); // chaos
  assert.equal(detectPeriod(MAPS.sine.f, 3.2), 2);
});

test('Lyapunov exponents: negative on cycles, ln 2 at r = 4', () => {
  assert.ok(lyapunov(f, df, 3.2) < 0);
  assert.ok(lyapunov(f, df, 3.83) < 0);
  assert.ok(Math.abs(lyapunov(f, df, 4, 0.3, { n: 200000 }) - Math.LN2) < 0.01);
  assert.ok(lyapunov(f, df, 3.9) > 0.3);
  // tent map with slope r/2 = 2: exactly ln 2 everywhere on the attractor
  assert.ok(Math.abs(lyapunov(MAPS.tent.f, MAPS.tent.df, 4, 0.1234) - Math.LN2) < 1e-9);
});

test('iterates and the bifurcation histogram', () => {
  assert.deepEqual(iterate(f, 2, 0.5, 3), [0.5, 0.5, 0.5, 0.5]); // r = 2: ½ is a fixed point
  const out = new Float32Array(100);
  bifurcationColumn(f, 3.2, 0.3, 1000, 1000, 0, 1, 100, out);
  const nonzero = [...out].map((v, i) => [v, i]).filter(([v]) => v > 0);
  assert.equal(nonzero.length, 2); // two branches
  assert.equal(nonzero[0][0] + nonzero[1][0], 1000);
});

test('double-double arithmetic carries ~32 digits', () => {
  const third = DD.div(DD.dd(1), DD.dd(3));
  const back = DD.mulNum(third, 3);
  assert.ok(Math.abs(back[0] - 1 + back[1]) < 1e-31);
  // (1 + 2⁻⁶⁰)² − 1 = 2⁻⁵⁹ + 2⁻¹²⁰: invisible to doubles, kept by double-double
  const x = DD.add(DD.dd(1), DD.dd(2 ** -60));
  const y = DD.sub(DD.mul(x, x), DD.dd(1));
  assert.ok(Math.abs(DD.toNumber(y) / 2 ** -59 - 1) < 1e-15);
  const s = DD.sqrt(DD.dd(2));
  const sq = DD.sub(DD.mul(s, s), DD.dd(2));
  assert.ok(Math.abs(DD.toNumber(sq)) < 1e-30);
});

test('Feigenbaum δ from superstable parameters (doubles and double-double)', () => {
  const rows = feigenbaum(10);
  assert.ok(Math.abs(rows[1].r - (1 + Math.sqrt(5))) < 1e-15);
  assert.ok(Math.abs(rows[2].r - 3.4985616993277016) < 1e-12);
  assert.ok(Math.abs(rows[10].delta - 4.669201609) < 1e-6, String(rows[10].delta));
  assert.ok(Math.abs(rows[8].alpha + 2.5029) < 1e-3, String(rows[8].alpha));
  const hp = feigenbaum(14, { dd: true });
  const d = hp.map((r) => r.delta);
  assert.ok(Math.abs(d[14] - 4.669201609102990) < 1e-8, String(d[14]));
  const acc = aitken(d[12], d[13], d[14]);
  assert.ok(Math.abs(acc - 4.669201609102990) < 1e-10, String(acc));
  // plain doubles have already drifted by n = 13
  assert.ok(Math.abs(feigenbaum(13)[13].delta - 4.669201609102990) > Math.abs(d[13] - 4.669201609102990));
});
