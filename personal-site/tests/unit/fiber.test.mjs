// The trefoil and its Seifert surfaces (Milnor fibres) are sampled exactly as claimed on the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleFiber, knotS3, KNOT_A, KNOT_B, toSphere } from '../../src/universe/fiber.js';
import { mulberry32 } from '../../src/core/rng.js';

const f = ([zr, zi, wr, wi]) => {
  const z2r = zr * zr - zi * zi, z2i = 2 * zr * zi;
  const w2r = wr * wr - wi * wi, w2i = 2 * wr * wi;
  return [z2r + (w2r * wr - w2i * wi), z2i + (w2r * wi + w2i * wr)];
};
const rot = ([zr, zi, wr, wi], th) => [
  Math.cos(th / 2) * zr - Math.sin(th / 2) * zi, Math.sin(th / 2) * zr + Math.cos(th / 2) * zi,
  Math.cos(th / 3) * wr - Math.sin(th / 3) * wi, Math.sin(th / 3) * wr + Math.cos(th / 3) * wi,
];

test('knot radii solve a² = b³, a² + b² = 1', () => {
  assert.ok(Math.abs(KNOT_A ** 2 - KNOT_B ** 3) < 1e-12);
  assert.ok(Math.abs(KNOT_A ** 2 + KNOT_B ** 2 - 1) < 1e-12);
});

test('the knot lies on S³ and on z² + w³ = 0', () => {
  for (let k = 0; k < 64; k++) {
    const p = knotS3((k / 64) * 2 * Math.PI, [0, 0, 0, 0]);
    assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-12);
    const [r, i] = f(p);
    assert.ok(Math.hypot(r, i) < 1e-12);
  }
});

test('fibre samples lie on S³ with arg(z² + w³) = 0, and rotate to arg = θ', () => {
  const pts = sampleFiber(4000, mulberry32(1), { nv: 60, na: 120 });
  for (let i = 0; i < 4000; i++) {
    const p = Array.from(pts.slice(i * 4, i * 4 + 4));
    assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-6, 'on S³ (float32)');
    // Stored as float32, so compare f against the real axis with an absolute tolerance
    // (near the knot |f| → 0 and the argument itself is ill-conditioned).
    const [r, im] = f(p);
    assert.ok(r > 0 && Math.abs(im) < 1e-6, 'arg f = 0');
    const th = 2.1;
    const [r2, i2] = f(rot(p, th));
    assert.ok(Math.abs(r2 * Math.sin(th) - i2 * Math.cos(th)) < 1e-6 && r2 * Math.cos(th) + i2 * Math.sin(th) > 0, 'arg f = θ after rotation');
  }
});

test('toSphere solves the weighted normalisation', () => {
  const out = toSphere(3, -1, 0.5, 2, [0, 0, 0, 0]);
  assert.ok(Math.abs(Math.hypot(...out) - 1) < 1e-12);
});
