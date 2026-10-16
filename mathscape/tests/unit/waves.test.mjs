import test from 'node:test';
import assert from 'node:assert/strict';
import { Wave, chladni, outsideEllipse, slitWall } from '../../src/core/waves.js';

test('the undamped scheme conserves energy (reflecting box)', () => {
  const wv = new Wave(80, 60);
  wv.setAbsorbing(false);
  wv.drop(40, 30, 1, 3);
  wv.step(0.5);
  const e0 = wv.energy();
  for (let k = 0; k < 400; k++) wv.step(0.5);
  assert.ok(Math.abs(wv.energy() / e0 - 1) < 0.02, String(wv.energy() / e0));
});

test('the sponge absorbs outgoing waves', () => {
  const wv = new Wave(120, 120);
  wv.drop(60, 60, 1, 3);
  wv.step(0.5);
  const e0 = wv.energy();
  for (let k = 0; k < 600; k++) wv.step(0.5);
  assert.ok(wv.energy() < 0.05 * e0);
});

test('waves travel at speed c and slow down in a slower medium', () => {
  // a ring spreading from a drop: its crest along the centre row sits near r = c·t
  const front = (speed) => {
    const wv = new Wave(161, 161);
    wv.setAbsorbing(false);
    wv.speed.fill(speed);
    wv.drop(80, 80, 1, 2);
    for (let k = 0; k < 120; k++) wv.step(0.5); // t = 60
    let best = 0, at = 0;
    for (let x = 90; x < 160; x++) { const v = Math.abs(wv.u[80 * 161 + x]); if (v > best) { best = v; at = x; } }
    return at - 80;
  };
  const f1 = front(1), f2 = front(0.5);
  assert.ok(Math.abs(f1 - 60) < 6, String(f1));
  assert.ok(Math.abs(f2 - 30) < 6, String(f2));
});

test('a standing mode oscillates with ω = cπ√((m/W)² + (n/H)²)', () => {
  const W = 61, H = 41;
  const wv = new Wave(W, H);
  wv.setAbsorbing(false);
  wv.mode(2, 1);
  const i = Math.round(H / 2) * W + Math.round(W / 4);
  const dt = 0.25;
  const omega = Math.PI * Math.hypot(2 / (W - 1), 1 / (H - 1));
  let t = 0, prevSign = Math.sign(wv.u[i]), crossings = [];
  for (let k = 0; k < 4000 && crossings.length < 4; k++) {
    wv.step(dt); t += dt;
    const sgn = Math.sign(wv.u[i]);
    if (sgn !== prevSign) crossings.push(t);
    prevSign = sgn;
  }
  const period = crossings[3] - crossings[1];
  assert.ok(Math.abs(period / ((2 * Math.PI) / omega) - 1) < 0.02, `${period} vs ${(2 * Math.PI) / omega}`);
});

test('Chladni nodal lines', () => {
  // the antisymmetric combination vanishes on the diagonal x = y
  for (const t of [0.1, 0.37, 0.8]) assert.ok(Math.abs(chladni(t, t, 2, 5, -1)) < 1e-12);
  assert.ok(Math.abs(chladni(0.3, 0.6, 2, 5, -1)) > 0.01);
});

test('two coherent sources: bright where the path difference is a whole wavelength, dark at half', () => {
  const N = 200, lam = 16, d = 2 * lam;
  const wv = new Wave(N, N);
  wv.addSource(100, 100 - d / 2, { wavelength: lam });
  wv.addSource(100, 100 + d / 2, { wavelength: lam });
  for (let k = 0; k < 900; k++) wv.step(0.5);
  // on a circle of radius 60 round the midpoint: find the angle where r2 − r1 = λ/2
  const R = 60;
  const at = (th) => [100 + R * Math.cos(th), 100 + R * Math.sin(th)];
  const diff = (th) => { const [x, y] = at(th); return Math.hypot(x - 100, y - 100 + d / 2) - Math.hypot(x - 100, y - 100 - d / 2); };
  let lo = 0, hi = 0.6; // diff increases from 0 with the angle
  for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (diff(mid) < lam / 2) lo = mid; else hi = mid; }
  const I = ([x, y]) => wv.I[Math.round(y) * N + Math.round(x)];
  const bright = I(at(0)), dark = I(at(lo));
  assert.ok(bright > 5 * dark, `${bright} vs ${dark}`);
});

test('an elliptical mirror refocuses a drop at one focus onto the other', () => {
  const W = 200, H = 160, a = 80, b = 60, c = Math.sqrt(a * a - b * b);
  const wv = new Wave(W, H);
  wv.setAbsorbing(false);
  wv.walls(outsideEllipse(100, 80, a, b));
  wv.drop(Math.round(100 - c), 80, 1, 2);
  let best = 0, at = null;
  for (let k = 1; k <= 380; k++) {
    wv.step(0.5);
    if (k < 250) continue; // after the wave has left F₁ (it takes 2a/c = 160 to go round)
    for (let i = 0; i < wv.u.length; i++) { const v = Math.abs(wv.u[i]); if (v > best) { best = v; at = [i % W, Math.floor(i / W)]; } }
  }
  assert.ok(Math.hypot(at[0] - (100 + c), at[1] - 80) < 4, String(at));
});

test('walls block waves; slits let them through', () => {
  const through = (gaps) => {
    const wv = new Wave(160, 120);
    wv.walls(slitWall(60, 3, gaps));
    wv.drop(30, 60, 1, 3);
    let most = 0;
    for (let k = 0; k < 240; k++) {
      wv.step(0.5);
      for (let y = 0; y < 120; y++) for (let x = 70; x < 140; x++) most = Math.max(most, Math.abs(wv.u[y * 160 + x]));
    }
    return most;
  };
  assert.equal(through([]), 0);
  assert.ok(through([[60, 8]]) > 0.01, String(through([[60, 8]])));
});
