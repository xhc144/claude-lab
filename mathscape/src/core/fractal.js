// Escape-time fractals: the Mandelbrot set, Julia sets, the Burning Ship, and the Newton basins of
// z³ − 1, plus deep zoom by perturbation around a high-precision reference orbit.
//
// The per-pixel kernels (escape, perturb, newton, renderRows) are plain, self-contained functions
// — no imports, no outer variables — so the UI can send their source text to Web Workers. They
// return a "smooth iteration count" ν: the iteration at which |z| left the radius-256 disc, made
// continuous by ν = n + 1 − log₂ log|z| (no colour banding); −1 means "did not escape".
//
// Deep zoom. In double precision the pixel coordinates c = c₀ + Δc stop being distinct once the
// pixel size drops below ~10⁻¹⁶·|c|. Perturbation computes ONE reference orbit Z_n of the view
// centre with BigInt fixed-point arithmetic, and every pixel only tracks its small difference
// δ_n = z_n − Z_n in doubles:  δ_{n+1} = (2Z_n + δ_n)·δ_n + Δc.  Doubles are fine for δ because
// δ is relative to the reference. Rebasing (Zhuoran, 2021) keeps this valid everywhere: whenever
// the full value z = Z_m + δ comes closer to the orbit's start than δ is large, or the reference
// orbit ends, continue with δ := z − Z₀ and m := 0. No glitch detection is needed.

/** Smooth escape count of z ↦ z² + c (ship = false) or the Burning Ship (ship = true). */
export function escape(zx, zy, cx, cy, maxIter, ship, eps) {
  const B2 = 65536; // escape radius 256, squared
  // the main cardioid and the period-2 bulb of the Mandelbrot set are interior: skip them
  if (!ship && zx === 0 && zy === 0) {
    const qx = cx - 0.25, q = qx * qx + cy * cy;
    if (q * (q + qx) <= 0.25 * cy * cy || (cx + 1) * (cx + 1) + cy * cy <= 0.0625) return -1;
  }
  let x = zx, y = zy, x2 = x * x, y2 = y * y;
  // Brent-style periodicity check: an orbit that returns (within eps) to a saved point is periodic
  let px = x, py = y, lap = 0, span = 8;
  for (let n = 0; n < maxIter; n++) {
    if (x2 + y2 > B2) {
      const lz = 0.5 * Math.log(x2 + y2);
      return n + 1 - Math.log(lz / Math.LN2) / Math.LN2;
    }
    if (ship) {
      y = 2 * Math.abs(x * y) + cy;
    } else {
      y = 2 * x * y + cy;
    }
    x = x2 - y2 + cx;
    x2 = x * x;
    y2 = y * y;
    if (eps > 0) {
      if (Math.abs(x - px) + Math.abs(y - py) < eps) return -1;
      if (++lap === span) { lap = 0; span *= 2; px = x; py = y; }
    }
  }
  return -1;
}

/**
 * Perturbation with rebasing. `ref` holds the reference orbit Z₀ … Z_refLen as interleaved
 * (re, im) doubles; (dx, dy) = δ₀ = z₀ − Z₀ and (dcx, dcy) = Δc = c − C. Mandelbrot: δ₀ = 0;
 * Julia: Δc = 0 and δ₀ is the pixel's offset from the centre.
 */
export function perturb(ref, refLen, dx, dy, dcx, dcy, maxIter, m0) {
  const B2 = 65536;
  const z0x = ref[0], z0y = ref[1];
  // m0 > 0: start at iteration m0 (the series approximation already supplied δ_{m0})
  let m = m0 || 0;
  for (let n = m; n < maxIter; n++) {
    const Zx = ref[2 * m], Zy = ref[2 * m + 1];
    const ax = 2 * Zx + dx, ay = 2 * Zy + dy;
    const nx = ax * dx - ay * dy + dcx;
    dy = ax * dy + ay * dx + dcy;
    dx = nx;
    m++;
    const zx = ref[2 * m] + dx, zy = ref[2 * m + 1] + dy;
    const r2 = zx * zx + zy * zy;
    if (r2 > B2) {
      const lz = 0.5 * Math.log(r2);
      return n + 2 - Math.log(lz / Math.LN2) / Math.LN2;
    }
    const ex = zx - z0x, ey = zy - z0y;
    if (ex * ex + ey * ey < dx * dx + dy * dy || m >= refLen) { dx = ex; dy = ey; m = 0; }
  }
  return -1;
}

/**
 * Newton's method for z³ − 1 from z: returns root·1000 + smooth step count (root 0, 1, 2 =
 * 1, e^{2πi/3}, e^{−2πi/3}), or −1 if it has not converged.
 */
export function newton(x, y, maxIter) {
  const TOL = 1e-6, H = Math.sqrt(3) / 2;
  for (let n = 0; n < maxIter; n++) {
    // z ← z − (z³ − 1)/(3z²) = (2z³ + 1)/(3z²)
    const x2 = x * x - y * y, y2 = 2 * x * y; // z²
    const x3 = x2 * x - y2 * y, y3 = x2 * y + y2 * x; // z³
    const nr = 2 * x3 + 1, ni = 2 * y3;
    const dr = 3 * x2, di = 3 * y2;
    const den = dr * dr + di * di;
    if (den === 0) return -1;
    x = (nr * dr + ni * di) / den;
    y = (ni * dr - nr * di) / den;
    const d0 = Math.hypot(x - 1, y), d1 = Math.hypot(x + 0.5, y - H), d2 = Math.hypot(x + 0.5, y + H);
    const d = Math.min(d0, d1, d2);
    if (d < TOL) {
      const root = d === d0 ? 0 : d === d1 ? 1 : 2;
      // quadratic convergence: log d roughly doubles each step, which gives a smooth fraction
      const frac = Math.log(Math.log(d) / Math.log(TOL)) / Math.LN2;
      return root * 1000 + Math.max(0, n + 1 - frac);
    }
  }
  return -1;
}

/**
 * Worker entry: smooth values for pixel rows [y0, y1) of a w × h image, every `step`-th pixel in
 * both directions (progressive passes). Pixel (i, j) sits at (i − w/2, h/2 − j)·ps from the
 * centre (cx, cy). Result: Float32Array, row-major over the computed pixels of those rows.
 */
export function renderRows(job) {
  const { kind, w, h, y0, y1, step, ps, cx, cy, jx, jy, maxIter, ref, refLen, eps, sa } = job;
  const cols = Math.ceil(w / step);
  const rows = Math.ceil((y1 - y0) / step);
  const out = new Float32Array(cols * rows);
  let k = 0;
  for (let j = y0; j < y1; j += step) {
    const oy = (h / 2 - j) * ps;
    for (let i = 0; i < w; i += step) {
      const ox = (i - w / 2) * ps;
      let v;
      if (ref && sa && sa.skip > 0) {
        // δ_skip = A·d + B·d² + C·d³, d = Δc (Mandelbrot) or δ₀ (Julia)
        const d2x = ox * ox - oy * oy, d2y = 2 * ox * oy;
        const d3x = d2x * ox - d2y * oy, d3y = d2x * oy + d2y * ox;
        const sx = sa.ax * ox - sa.ay * oy + sa.bx * d2x - sa.by * d2y + sa.cx * d3x - sa.cy * d3y;
        const sy = sa.ax * oy + sa.ay * ox + sa.bx * d2y + sa.by * d2x + sa.cx * d3y + sa.cy * d3x;
        v = kind === 'julia' ? perturb(ref, refLen, sx, sy, 0, 0, maxIter, sa.skip) : perturb(ref, refLen, sx, sy, ox, oy, maxIter, sa.skip);
      } else if (ref) {
        v = kind === 'julia' ? perturb(ref, refLen, ox, oy, 0, 0, maxIter, 0) : perturb(ref, refLen, 0, 0, ox, oy, maxIter, 0);
      } else if (kind === 'newton') {
        v = newton(cx + ox, cy + oy, maxIter);
      } else if (kind === 'julia') {
        v = escape(cx + ox, cy + oy, jx, jy, maxIter, false, eps);
      } else {
        // the Burning Ship is drawn with the imaginary axis pointing down, as is customary
        v = escape(0, 0, cx + ox, kind === 'ship' ? -(cy + oy) : cy + oy, maxIter, kind === 'ship', eps);
      }
      out[k++] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Reference orbits in BigInt fixed point (value = X / 2^bits)

/** round(q · 2^bits) for an exact rational q = { n, d } (see bigreal.js). */
export function toFixed(q, bits) {
  const B = BigInt(bits);
  const num = q.n << B;
  const r = num / q.d;
  const rem = num - r * q.d;
  return 2n * (rem < 0n ? -rem : rem) >= q.d ? r + (num < 0n ? -1n : 1n) : r;
}

/** Nearest double to X / 2^bits. */
export const fixedToNumber = (X, bits) => Number(X) * 2 ** -bits;

/**
 * Orbit Z₀ = z₀, Z_{n+1} = Z_n² + C of a point given in fixed point, until |Z| > 256 or maxIter.
 * Returns { ref: Float64Array of interleaved Z_n, len: index of the last point }.
 */
export function referenceOrbit(zx, zy, cx, cy, bits, maxIter) {
  const B = BigInt(bits);
  const ref = new Float64Array(2 * (maxIter + 1));
  let x = zx, y = zy;
  ref[0] = fixedToNumber(x, bits);
  ref[1] = fixedToNumber(y, bits);
  let n = 0;
  while (n < maxIter) {
    const x2 = (x * x) >> B, y2 = (y * y) >> B, xy = (x * y) >> B;
    x = x2 - y2 + cx;
    y = 2n * xy + cy;
    n++;
    const fx = fixedToNumber(x, bits), fy = fixedToNumber(y, bits);
    ref[2 * n] = fx;
    ref[2 * n + 1] = fy;
    if (fx * fx + fy * fy > 65536) break;
  }
  return { ref: ref.subarray(0, 2 * (n + 1)), len: n };
}

/**
 * Series approximation: along the reference orbit, δ_n ≈ A_n·d + B_n·d² + C_n·d³ where d = Δc
 * (Mandelbrot: A₀ = 0, A_{n+1} = 2Z_nA_n + 1) or d = δ₀ (Julia: A₀ = 1, A_{n+1} = 2Z_nA_n), with
 * B_{n+1} = 2Z_nB_n + A_n², C_{n+1} = 2Z_nC_n + 2A_nB_n. `probes` (offsets d at the view's
 * corners, where the truncation error is largest) are iterated exactly alongside; the skip stops
 * as soon as the cubic predicts any of them worse than `tol` relative error.
 * Returns { skip, ax, ay, bx, by, cx, cy } (skip = 0: no safe skip).
 */
export function seriesApprox(ref, refLen, julia, probes, { tol = 1e-8, maxSkip = Infinity } = {}) {
  let ax = julia ? 1 : 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0;
  const P = probes.map(([px, py]) => ({ px, py, dx: julia ? px : 0, dy: julia ? py : 0 }));
  let best = { skip: 0, ax, ay, bx, by, cx, cy };
  const limit = Math.min(refLen - 1, maxSkip);
  for (let n = 0; n < limit; n++) {
    const Zx = ref[2 * n], Zy = ref[2 * n + 1];
    const tx = 2 * Zx, ty = 2 * Zy;
    const nax = tx * ax - ty * ay + (julia ? 0 : 1);
    const nay = tx * ay + ty * ax;
    const nbx = tx * bx - ty * by + ax * ax - ay * ay;
    const nby = tx * by + ty * bx + 2 * ax * ay;
    const ncx = tx * cx - ty * cy + 2 * (ax * bx - ay * by);
    const ncy = tx * cy + ty * cx + 2 * (ax * by + ay * bx);
    ax = nax; ay = nay; bx = nbx; by = nby; cx = ncx; cy = ncy;
    if (!(Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(bx) && Number.isFinite(ax))) break;
    let ok = true;
    for (const p of P) {
      // exact perturbation step for the probe: δ ← (2Z + δ)δ + Δc
      const qx = tx + p.dx, qy = ty + p.dy;
      const ndx = qx * p.dx - qy * p.dy + (julia ? 0 : p.px);
      p.dy = qx * p.dy + qy * p.dx + (julia ? 0 : p.py);
      p.dx = ndx;
      const d2x = p.px * p.px - p.py * p.py, d2y = 2 * p.px * p.py;
      const d3x = d2x * p.px - d2y * p.py, d3y = d2x * p.py + d2y * p.px;
      const sx = ax * p.px - ay * p.py + bx * d2x - by * d2y + cx * d3x - cy * d3y;
      const sy = ax * p.py + ay * p.px + bx * d2y + by * d2x + cx * d3y + cy * d3x;
      const err = Math.hypot(sx - p.dx, sy - p.dy), mag = Math.hypot(p.dx, p.dy);
      // the full value must also stay away from 0, where rebasing would have kicked in
      const zx = ref[2 * (n + 1)] + p.dx, zy = ref[2 * (n + 1) + 1] + p.dy;
      if (!(err <= tol * mag) || zx * zx + zy * zy < p.dx * p.dx + p.dy * p.dy) { ok = false; break; }
    }
    if (!ok) break;
    best = { skip: n + 1, ax, ay, bx, by, cx, cy };
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Analysis helpers (main thread)

/** Orbit z₀, z₁, … of z ↦ z² + c (at most n points, stops after escaping). */
export function orbit(zx, zy, cx, cy, n, ship = false) {
  const pts = [[zx, zy]];
  let x = zx, y = zy;
  for (let k = 0; k < n; k++) {
    const nx = x * x - y * y + cx;
    y = (ship ? 2 * Math.abs(x * y) : 2 * x * y) + cy;
    x = nx;
    pts.push([x, y]);
    if (x * x + y * y > 1e4) break;
  }
  return pts;
}

/**
 * Period of the attracting cycle of z ↦ z² + c reached from 0, or 0 (escapes / not found).
 * Returns { period, escaped, cycle }.
 */
export function attractingPeriod(cx, cy, { transient = 4000, maxPeriod = 64, tol = 1e-9 } = {}) {
  let x = 0, y = 0;
  for (let k = 0; k < transient; k++) {
    const nx = x * x - y * y + cx;
    y = 2 * x * y + cy;
    x = nx;
    if (x * x + y * y > 4) return { period: 0, escaped: true, cycle: [] };
  }
  const sx = x, sy = y;
  const cycle = [[x, y]];
  for (let p = 1; p <= maxPeriod; p++) {
    const nx = x * x - y * y + cx;
    y = 2 * x * y + cy;
    x = nx;
    if (Math.hypot(x - sx, y - sy) < tol) return { period: p, escaped: false, cycle };
    cycle.push([x, y]);
  }
  return { period: 0, escaped: false, cycle: [] };
}

/** Automatic iteration limit for a view of the given width (wider zooms need fewer). */
export function autoIterations(span, kind) {
  if (kind === 'newton') return 60;
  const z = Math.max(0, Math.log10(3.5 / span));
  return Math.round(160 + 140 * z + 5 * z * z);
}

// ---------------------------------------------------------------------------------------------
// Colour

/** Cosine palettes (Iñigo Quílez): colour(t) = a + b·cos(2π(c·t + d)). */
export const PALETTES = {
  aurora: { label: '极光', a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1, 1], d: [0.3, 0.2, 0.2] },
  fire: { label: '火焰', a: [0.55, 0.3, 0.15], b: [0.45, 0.35, 0.2], c: [1, 1, 1], d: [0.0, 0.1, 0.2] },
  ocean: { label: '深海', a: [0.2, 0.45, 0.6], b: [0.3, 0.35, 0.4], c: [1, 1, 1], d: [0.55, 0.6, 0.65] },
  neon: { label: '霓虹', a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1, 0.5], d: [0.8, 0.9, 0.3] },
  ink: { label: '水墨', a: [0.5, 0.5, 0.52], b: [0.5, 0.5, 0.5], c: [0.5, 0.5, 0.5], d: [0, 0, 0] },
};

/** 1024-entry RGB lookup table of a palette. */
export function paletteLUT(name) {
  const p = PALETTES[name] || PALETTES.aurora;
  const N = 1024;
  const lut = new Uint8ClampedArray(3 * N);
  for (let i = 0; i < N; i++) {
    const t = i / N;
    for (let k = 0; k < 3; k++) lut[3 * i + k] = 255 * (p.a[k] + p.b[k] * Math.cos(2 * Math.PI * (p.c[k] * t + p.d[k])));
  }
  return lut;
}
