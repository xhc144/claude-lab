// Particle "shapes" for the background universe. Each generator fills
//   pos: Float32Array(N*3) — object-space positions
//   col: Float32Array(N*4) — rgb + a scalar "pulse parameter" (light pulses travel along it)
// Procedural shapes (the trefoil's Milnor fibre and the Hopf fibration) also fill
//   proc: Float32Array(N*4) — per-particle data the vertex shader animates.

import { mulberry32, gaussian, hsl, mix3, clamp, smoothstep } from '../core/rng.js';
import { sampleFiber, knotS3, KNOT_B } from './fiber.js';
import { OCW_MATH, OCW_PHYSICS } from '../data/projects.js';

export const C = {
  white: [1.0, 0.95, 0.88],
  orange: [1.0, 0.38, 0.12],
  ember: [0.85, 0.16, 0.06],
  cyan: [0.3, 0.86, 1.0],
  violet: [0.55, 0.42, 1.0],
  acid: [0.8, 1.0, 0.25],
  blue: [0.2, 0.42, 1.0],
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function buffers(n, proc = false) {
  return { pos: new Float32Array(n * 3), col: new Float32Array(n * 4), proc: proc ? new Float32Array(n * 4) : null };
}
function put(b, i, x, y, z, c, a, gain = 1) {
  b.pos[i * 3] = x; b.pos[i * 3 + 1] = y; b.pos[i * 3 + 2] = z;
  b.col[i * 4] = c[0] * gain; b.col[i * 4 + 1] = c[1] * gain; b.col[i * 4 + 2] = c[2] * gain; b.col[i * 4 + 3] = a;
}

// Hero — a sunflower (Vogel) spiral: seed k sits at radius √k, turned by the golden angle.
// Its visible spiral arms come in consecutive Fibonacci numbers … 89, 144, 233 …
export function galaxy(n) {
  const b = buffers(n);
  const R = 4.4;
  const SEEDS = 2584; // F₁₈ seeds, each a small cloud of particles
  const rand = mulberry32(144);
  const spacing = R * Math.sqrt(Math.PI / SEEDS);
  for (let i = 0; i < n; i++) {
    const k = i % SEEDS;
    const r0 = R * Math.sqrt((k + 0.5) / SEEDS);
    const th = k * GOLDEN;
    const t = r0 / R;
    const jitter = spacing * 0.11;
    const x = r0 * Math.cos(th) + gaussian(rand) * jitter;
    const z = r0 * Math.sin(th) + gaussian(rand) * jitter;
    const r = Math.hypot(x, z);
    const y = 0.24 * Math.sin(th * 2 + r * 1.1) * t * t + gaussian(rand) * 0.02;
    const c = t < 0.4 ? mix3(C.white, C.orange, t / 0.4) : t < 0.78 ? mix3(C.orange, C.violet, (t - 0.4) / 0.38) : mix3(C.violet, C.cyan, (t - 0.78) / 0.22);
    const g = k === 144 ? 2.4 : k % 144 === 0 ? 1.5 : 0.85;
    put(b, i, x, y, z, c, t * 6, g);
  }
  return b;
}

// Dimension 0 — a point with an accretion disk and two jets.
export function singularity(n) {
  const b = buffers(n);
  const rand = mulberry32(7);
  for (let i = 0; i < n; i++) {
    const u = rand();
    if (u < 0.035) {
      const r = 0.07 * Math.cbrt(rand());
      const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      put(b, i, r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th), C.white, 0, 1.0);
    } else if (u < 0.93) {
      const r = 0.45 + 2.9 * Math.pow(rand(), 1.7);
      const th = rand() * Math.PI * 2;
      const t = (r - 0.45) / 2.9;
      const c = t < 0.25 ? mix3(C.white, C.orange, t / 0.25) : mix3(C.orange, C.violet, clamp((t - 0.25) / 0.75, 0, 1));
      put(b, i, r * Math.cos(th), gaussian(rand) * 0.018 * r, r * Math.sin(th), c, r * 2.0, 1.25 - t * 0.45);
    } else {
      const s = rand() < 0.5 ? -1 : 1;
      const y = 0.15 + 3.6 * Math.pow(rand(), 2);
      const spread = 0.025 + 0.03 * Math.sqrt(y);
      put(b, i, gaussian(rand) * spread, s * y, gaussian(rand) * spread, C.cyan, y * 3, 1.1);
    }
  }
  return b;
}

// Dimension 1 — a Lissajous knot: (sin 2t, sin 3t, sin 5t) with pairwise coprime frequencies.
export function filament(n) {
  const b = buffers(n);
  const rand = mulberry32(11);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 2.7 * Math.sin(2 * t + 0.3), y = 1.6 * Math.sin(3 * t), z = 2.1 * Math.sin(5 * t + 1.1);
    const tube = 0.025 + 0.11 * Math.pow(rand(), 4);
    const c = hsl(0.53 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2)), 0.9, 0.62);
    const warm = mix3(c, C.orange, 0.5 + 0.5 * Math.sin(t * 3 + 1));
    put(b, i, x + gaussian(rand) * tube, y + gaussian(rand) * tube, z + gaussian(rand) * tube, warm, t * 7, 0.95);
  }
  return b;
}

// Dimension 2 — the phase portrait of f(z) = (z² − 1)(z − 2 − i)² / (z² + 2 + 2i) as a landscape:
// height = log|f|, colour = arg f, brightness steps at every doubling of |f| (an "enhanced" portrait).
export function fz(x, y) {
  const ar = x * x - y * y - 1, ai = 2 * x * y; // z² − 1
  const br = x - 2, bi = y - 1; // z − 2 − i
  const b2r = br * br - bi * bi, b2i = 2 * br * bi;
  const nr = ar * b2r - ai * b2i, ni = ar * b2i + ai * b2r;
  const dr = x * x - y * y + 2, di = 2 * x * y + 2; // z² + 2 + 2i
  const dd = dr * dr + di * di;
  return [(nr * dr + ni * di) / dd, (ni * dr - nr * di) / dd];
}

export function landscape(n) {
  const b = buffers(n);
  const side = Math.floor(Math.sqrt(n));
  const L = 2.7;
  const rand = mulberry32(2);
  for (let i = 0; i < n; i++) {
    const gx = (i % side) + rand() * 0.6, gy = Math.floor(i / side) % side + rand() * 0.6;
    const x = -L + (2 * L * gx) / side, y = -L + (2 * L * gy) / side;
    const [fr, fi] = fz(x, y);
    const mod = Math.hypot(fr, fi) || 1e-9;
    const h = clamp(0.34 * Math.log(mod), -1.6, 1.6);
    const arg = Math.atan2(fi, fr) / (2 * Math.PI);
    const lev = Math.log2(mod);
    const step = lev - Math.floor(lev);
    const c = hsl(arg, 0.92, 0.42 + 0.22 * step);
    put(b, i, x * 1.12, h, -y * 1.12, c, lev * 2, 0.9);
  }
  return b;
}

// Dimension 3 — the trefoil's Milnor fibre (a Seifert surface) + the knot itself.
// proc = point of S³ on the θ = 0 page; the shader rotates it to the current θ.
export function fiber(n) {
  const b = buffers(n, true);
  const rand = mulberry32(31);
  const nKnot = Math.floor(n * 0.12);
  const surf = sampleFiber(n - nKnot, rand);
  b.proc.set(surf, 0);
  const s3 = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    let near, c, gain;
    if (i < n - nKnot) {
      const w = Math.hypot(surf[i * 4 + 2], surf[i * 4 + 3]);
      near = smoothstep(0.15, KNOT_B, w);
      const sheetTone = surf[i * 4] * 0.5 + 0.5;
      c = mix3(mix3([0.42, 0.28, 1.0], [0.18, 0.72, 1.0], sheetTone), C.white, Math.pow(near, 8) * 0.5);
      gain = 0.7 + 0.3 * near;
    } else {
      knotS3(((i - (n - nKnot)) / nKnot) * Math.PI * 2, s3);
      b.proc.set(s3, i * 4);
      near = 1;
      c = mix3(C.orange, C.white, 0.25);
      gain = 1.0;
    }
    b.col[i * 4] = c[0] * gain; b.col[i * 4 + 1] = c[1] * gain; b.col[i * 4 + 2] = c[2] * gain;
    b.col[i * 4 + 3] = near * 9;
  }
  return b;
}

// Dimension 3+1 — the Lorenz attractor (σ = 10, ρ = 28, β = 8/3), one long RK4 trajectory.
export function lorenzTrajectory(n, sub = 2, dt = 0.004) {
  let x = 1, y = 1, z = 1;
  const f = (x, y, z) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
  const step = () => {
    const k1 = f(x, y, z);
    const k2 = f(x + (dt / 2) * k1[0], y + (dt / 2) * k1[1], z + (dt / 2) * k1[2]);
    const k3 = f(x + (dt / 2) * k2[0], y + (dt / 2) * k2[1], z + (dt / 2) * k2[2]);
    const k4 = f(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    z += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  };
  for (let i = 0; i < 3000; i++) step();
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < sub; s++) step();
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

export function lorenz(n) {
  const b = buffers(n);
  const tr = lorenzTrajectory(n);
  const rand = mulberry32(3);
  const s = 0.11;
  for (let i = 0; i < n; i++) {
    const x = tr[i * 3], y = tr[i * 3 + 1], z = tr[i * 3 + 2];
    const wing = smoothstep(-6, 6, x);
    const c = mix3(C.cyan, C.orange, wing);
    put(b, i, x * s + gaussian(rand) * 0.006, (z - 25) * s + gaussian(rand) * 0.006, y * s + gaussian(rand) * 0.006, c, (i / n) * 260, 0.9);
  }
  return b;
}

// Dimension n — a latent space: anisotropic clusters joined by a nearest-neighbour graph.
export function latent(n) {
  const b = buffers(n);
  const rand = mulberry32(42);
  const K = 9;
  const centers = [];
  while (centers.length < K) {
    const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1), r = 1.7 + rand() * 1.3;
    const p = [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.75, r * Math.sin(ph) * Math.sin(th)];
    if (centers.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 1.55)) centers.push(p);
  }
  const axes = centers.map(() => {
    const a = [gaussian(rand), gaussian(rand), gaussian(rand)];
    const l = Math.hypot(...a);
    return { dir: a.map((v) => v / l), s: [0.42 + rand() * 0.3, 0.16 + rand() * 0.1, 0.1 + rand() * 0.06] };
  });
  const colors = centers.map((_, k) => hsl(0.5 + k / K * 0.62, 0.85, 0.6));
  const edges = [];
  centers.forEach((p, i) => {
    const d = centers.map((q, j) => [Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), j]).filter(([, j]) => j !== i).sort((u, v) => u[0] - v[0]);
    for (const [, j] of d.slice(0, 2)) if (!edges.some(([a, c]) => (a === i && c === j) || (a === j && c === i))) edges.push([i, j]);
  });
  const nEdge = Math.floor(n * 0.16);
  for (let i = 0; i < n; i++) {
    if (i < n - nEdge) {
      const k = i % K;
      const { dir, s } = axes[k];
      const g1 = gaussian(rand) * s[0], g2 = gaussian(rand) * s[1], g3 = gaussian(rand) * s[2];
      // build an orthonormal frame from dir
      const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = [dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2], dir[0] * up[1] - dir[1] * up[0]];
      const ul = Math.hypot(...u); u[0] /= ul; u[1] /= ul; u[2] /= ul;
      const v = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
      const p = centers[k];
      const x = p[0] + dir[0] * g1 + u[0] * g2 + v[0] * g3;
      const y = p[1] + dir[1] * g1 + u[1] * g2 + v[1] * g3;
      const z = p[2] + dir[2] * g1 + u[2] * g2 + v[2] * g3;
      const r = Math.hypot(g1, g2, g3);
      put(b, i, x, y, z, mix3(colors[k], C.white, Math.max(0, 0.5 - r)), r * 8, 1.0);
    } else {
      const [ia, ib] = edges[i % edges.length];
      const t = rand();
      const A = centers[ia], B = centers[ib];
      const bow = 0.35 * Math.sin(Math.PI * t);
      const x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t + bow, z = A[2] + (B[2] - A[2]) * t;
      put(b, i, x + gaussian(rand) * 0.012, y + gaussian(rand) * 0.012, z + gaussian(rand) * 0.012, mix3(colors[ia], colors[ib], t), t * 12, 0.7);
    }
  }
  return { ...b, centers, colors };
}

// Σ — the archive: one column of light per finished Chinese re-edition in mit-ocw-notes,
// height ∝ PDF pages (15 mathematics volumes inside, 9 physics volumes outside).
export function archiveLayout() {
  const cols = [];
  OCW_MATH.forEach(([name, pages], k) => {
    const a = (k / OCW_MATH.length) * Math.PI * 2 + 0.2;
    cols.push({ name, pages, field: 'math', x: 1.75 * Math.cos(a), z: 1.75 * Math.sin(a) });
  });
  OCW_PHYSICS.forEach(([name, pages], k) => {
    const a = (k / OCW_PHYSICS.length) * Math.PI * 2 + 0.55;
    cols.push({ name, pages, field: 'physics', x: 3.25 * Math.cos(a), z: 3.25 * Math.sin(a) });
  });
  const base = -1.7;
  for (const c of cols) { c.h = c.pages / 62; c.base = base; }
  return cols;
}

export function archive(n) {
  const b = buffers(n);
  const rand = mulberry32(1660 + 912);
  const cols = archiveLayout();
  const totalPages = cols.reduce((s, c) => s + c.pages, 0);
  const nFloor = Math.floor(n * 0.14);
  const nCols = n - nFloor;
  let i = 0;
  for (const c of cols) {
    const m = Math.round((c.pages / totalPages) * nCols);
    const tone = c.field === 'math' ? C.orange : C.cyan;
    for (let k = 0; k < m && i < nCols; k++, i++) {
      const t = rand();
      const y = c.base + t * c.h;
      const onEdge = rand() < 0.7;
      const a = rand() * Math.PI * 2;
      const r = onEdge ? 0.15 : 0.15 * Math.sqrt(rand());
      put(b, i, c.x + r * Math.cos(a), y, c.z + r * Math.sin(a), mix3(tone, C.white, t * t * 0.8), t * 10, 0.85 + t * 0.5);
    }
  }
  for (; i < n; i++) {
    // polar floor grid
    const ring = rand() < 0.5;
    let x, z;
    if (ring) {
      const r = [1.0, 1.75, 2.5, 3.25, 4.0][Math.floor(rand() * 5)];
      const a = rand() * Math.PI * 2;
      x = r * Math.cos(a); z = r * Math.sin(a);
    } else {
      const a = Math.floor(rand() * 24) / 24 * Math.PI * 2;
      const r = 0.6 + rand() * 3.6;
      x = r * Math.cos(a); z = r * Math.sin(a);
    }
    put(b, i, x, -1.72, z, C.violet, Math.hypot(x, z) * 3, 0.45);
  }
  return { ...b, cols };
}

// ∞ — the Hopf fibration S³ → S²: every point of the sphere lifts to a great circle of S³;
// stereographic projection turns five latitude rings of base points into five nested tori of
// pairwise-linked circles. proc = (η, α, t₀, ring) — the shader runs t along each fibre.
export const HOPF_RINGS = [0.36, 0.6, 0.8, 0.98];
export function hopf(n) {
  const b = buffers(n, true);
  const rand = mulberry32(3);
  const F = 24;
  const per = HOPF_RINGS.length * F;
  for (let i = 0; i < n; i++) {
    const fibre = i % per;
    const ring = Math.floor(fibre / F), j = fibre % F;
    const eta = HOPF_RINGS[ring];
    const alpha = (j / F) * Math.PI * 2 + ring * 0.37;
    const t0 = rand() * Math.PI * 2;
    b.proc[i * 4] = eta; b.proc[i * 4 + 1] = alpha; b.proc[i * 4 + 2] = t0; b.proc[i * 4 + 3] = ring;
    const c = hsl(j / F, 0.85, 0.52 + ring * 0.05);
    b.col[i * 4] = c[0]; b.col[i * 4 + 1] = c[1]; b.col[i * 4 + 2] = c[2]; b.col[i * 4 + 3] = t0 * 3;
  }
  return b;
}

export const SHAPES = { galaxy, singularity, filament, landscape, fiber, lorenz, latent, archive, hopf };
