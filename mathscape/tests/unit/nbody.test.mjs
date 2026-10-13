import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NBody, PRESETS, randomSystem } from '../../src/core/nbody.js';

const preset = (id) => PRESETS.find((p) => p.id === id);
const maxDiff = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);

test('two-body Kepler orbit: period, energy and Kepler\'s third law', () => {
  // reduced problem: masses 1 and 1e-9 → test particle on an ellipse with a = 1, e = 0.5
  const a = 1, e = 0.5, M = 1;
  const rp = a * (1 - e);
  const vp = Math.sqrt((M * (1 + e)) / rp); // vis-viva at pericentre
  const sys = new NBody({ masses: [M, 1e-12], pos: [[0, 0], [rp, 0]], vel: [[0, 0], [0, vp]] });
  const T = 2 * Math.PI * Math.sqrt(a ** 3 / M);
  const s0 = Float64Array.from(sys.state);
  assert.ok(sys.advance(T, 'dopri').ok);
  assert.ok(maxDiff(sys.state, s0) < 1e-7, 'returns after one Kepler period');
  // apocentre after half a period
  const half = new NBody({ masses: [M, 1e-12], pos: [[0, 0], [rp, 0]], vel: [[0, 0], [0, vp]] });
  half.advance(T / 2, 'dopri');
  const [x, y] = half.pos(1);
  assert.ok(Math.abs(x + a * (1 + e)) < 1e-7 && Math.abs(y) < 1e-7);
});

test('conservation laws hold for every preset (adaptive integrator)', () => {
  for (const p of PRESETS) {
    const sys = new NBody(p);
    sys.toCenterOfMassFrame();
    const E0 = sys.energy(), L0 = sys.angularMomentum();
    const r = sys.advance(p.id === 'pythagorean' ? 30 : 10, 'dopri');
    assert.ok(r.ok, p.id);
    assert.ok(Math.abs((sys.energy() - E0) / E0) < 1e-6, `${p.id}: energy drift`);
    assert.ok(Math.abs(sys.angularMomentum() - L0) < 1e-7 * Math.max(1, Math.abs(L0)), `${p.id}: angular momentum`);
    const [px, py] = sys.momentum();
    assert.ok(Math.hypot(px, py) < 1e-9, `${p.id}: linear momentum`);
    const [cx, cy] = sys.centerOfMass();
    assert.ok(Math.hypot(cx, cy) < 1e-8, `${p.id}: centre of mass`);
  }
});

test('periodic orbits return to their initial state after one period', () => {
  // Published initial conditions: 8 digits (figure eight) and 15 digits (Šuvakov–Dmitrašinović).
  // The S–D orbits are unstable, so the return error is limited by the published digits.
  const tolerances = { figure8: 1e-6, lagrange: 1e-8, euler: 1e-8, butterfly: 5e-3, moth: 5e-3, yinyang: 5e-3, dragonfly: 5e-3, goggles: 5e-3 };
  for (const [id, tol] of Object.entries(tolerances)) {
    const p = preset(id);
    const sys = new NBody(p);
    sys.rtol = 1e-12;
    sys.atol = 1e-14;
    const s0 = Float64Array.from(sys.state);
    assert.ok(sys.advance(p.period, 'dopri').ok);
    const err = maxDiff(sys.state, s0);
    assert.ok(err < tol, `${id}: return error ${err}`);
  }
});

test('figure eight: the three bodies trace the same curve, a third of a period apart', () => {
  const p = preset('figure8');
  const sys = new NBody(p);
  const third = new NBody(p);
  third.advance(p.period / 3, 'dopri');
  // body 3 at t = T/3 sits where body 1 started (choreography), up to relabelling
  const starts = [0, 1, 2].map((i) => sys.pos(i));
  const after = [0, 1, 2].map((i) => third.pos(i));
  for (const q of after) assert.ok(starts.some((s) => Math.hypot(s[0] - q[0], s[1] - q[1]) < 1e-6));
});

test('Lagrange triangle rotates rigidly', () => {
  const p = preset('lagrange');
  const sys = new NBody(p);
  sys.advance(p.period / 4, 'dopri');
  // after a quarter period each body has turned by 90°
  for (let i = 0; i < 3; i++) {
    const [x0, y0] = p.pos[i];
    const [x, y] = sys.pos(i);
    assert.ok(Math.hypot(x - -y0, y - x0) < 1e-8);
  }
});

test('Pythagorean problem: the lightest body is ejected, the others form a binary', () => {
  const sys = new NBody(preset('pythagorean'));
  sys.rtol = 1e-12;
  sys.atol = 1e-14;
  const E0 = sys.energy();
  assert.ok(sys.advance(80, 'dopri').ok);
  assert.ok(Math.abs((sys.energy() - E0) / E0) < 1e-6);
  const [x0, y0] = sys.pos(0), [x1, y1] = sys.pos(1), [x2, y2] = sys.pos(2);
  const binary = Math.hypot(x2 - x1, y2 - y1);
  const escape = Math.hypot(x0 - (4 * x1 + 5 * x2) / 9, y0 - (4 * y1 + 5 * y2) / 9);
  // The close encounters are chaotic: the binary's orbital phase differs across
  // floating-point implementations. Binding energy identifies a binary without
  // imposing an arbitrary separation at one timestamp.
  const [vx1, vy1] = sys.vel(1), [vx2, vy2] = sys.vel(2);
  const binaryEnergy = 0.5 * ((vx2 - vx1) ** 2 + (vy2 - vy1) ** 2) - 9 / binary;
  assert.ok(binaryEnergy < 0, `binary specific energy ${binaryEnergy}`);
  assert.ok(escape > 20, `escaper distance ${escape}`);
  // the escaper (mass 3) has positive energy relative to the binary
  const [vx0, vy0] = sys.vel(0);
  assert.ok(Math.hypot(vx0, vy0) > Math.sqrt((2 * 9) / escape));
});

test('symplectic integrators: bounded energy error and correct convergence order', () => {
  const p = preset('figure8');
  const energyErr = (method, dt, T = 2 * p.period) => {
    const s = new NBody(p);
    const E0 = s.energy();
    s.advance(T, method, { dt });
    return { s, err: Math.abs((s.energy() - E0) / E0) };
  };
  // order: halving dt divides the end-point error by ~2^order
  const ref = new NBody(p);
  ref.rtol = 1e-13; ref.atol = 1e-15;
  ref.advance(p.period, 'dopri');
  const posErr = (method, dt) => {
    const s = new NBody(p);
    s.advance(p.period, method, { dt });
    return maxDiff(s.state, ref.state);
  };
  const yRatio = posErr('yoshida', 0.02) / posErr('yoshida', 0.01);
  const vRatio = posErr('verlet', 0.004) / posErr('verlet', 0.002);
  const rRatio = posErr('rk4', 0.02) / posErr('rk4', 0.01);
  assert.ok(yRatio > 12 && yRatio < 20, `Yoshida ratio ${yRatio}`);
  assert.ok(vRatio > 3.3 && vRatio < 4.8, `Verlet ratio ${vRatio}`);
  assert.ok(rRatio > 12 && rRatio < 20, `RK4 ratio ${rRatio}`);
  // long-time energy behaviour: symplectic error stays bounded, RK4 drifts
  assert.ok(energyErr('yoshida', 0.01, 20 * p.period).err < 1e-6);
  assert.ok(energyErr('verlet', 0.002, 20 * p.period).err < 1e-4);
});

test('time reversal: integrating forward then backward recovers the start', () => {
  const p = preset('figure8');
  const sys = new NBody(p);
  const s0 = Float64Array.from(sys.state);
  sys.advance(5, 'verlet', { dt: 0.001 });
  sys.reverse();
  sys.advance(5, 'verlet', { dt: 0.001 });
  sys.reverse();
  // leapfrog is exactly time-symmetric: only round-off remains
  assert.ok(maxDiff(sys.state, s0) < 1e-9);
});

test('softening regularises the force and the potential consistently', () => {
  const sys = new NBody({ masses: [1, 1], pos: [[0, 0], [1e-6, 0]], vel: [[0, 0], [0, 0]], softening: 0.1 });
  const acc = new Float64Array(4);
  sys.accelerations(sys.state, acc);
  assert.ok(Math.abs(acc[0]) < 1e-3); // finite even at near-zero distance
  // force = −dU/dx: compare with a numerical derivative of the softened potential
  const s = new NBody({ masses: [1, 2], pos: [[0, 0], [0.3, 0.1]], vel: [[0, 0], [0, 0]], softening: 0.2 });
  s.accelerations(s.state, acc);
  const h = 1e-6;
  const U = (x) => { s.state[0] = x; return s.potential(); };
  const dUdx = (U(h) - U(-h)) / (2 * h);
  assert.ok(Math.abs(-dUdx / 1 - acc[0]) < 1e-6);
});

test('random systems are bound and in the centre-of-mass frame', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const cfg = randomSystem(seed);
    const s = new NBody(cfg);
    assert.ok(s.energy() < 0);
    assert.ok(Math.hypot(...s.momentum()) < 1e-12);
  }
  assert.deepEqual(randomSystem(42), randomSystem(42));
});
