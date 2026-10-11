// ODE numerics: fixed-step RK4, adaptive Dormand–Prince 5(4), equilibrium search and
// classification for planar systems, nullclines via marching squares, Lyapunov exponent.
//
// A system is a function f(t, y, dy) that writes dy/dt into the Float64Array `dy`.

/** Classic fourth-order Runge–Kutta step; y is updated in place. */
export function rk4Step(f, t, y, h, work) {
  const n = y.length;
  const w = work || rk4Work(n);
  const { k1, k2, k3, k4, tmp } = w;
  f(t, y, k1);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k1[i];
  f(t + 0.5 * h, tmp, k2);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k2[i];
  f(t + 0.5 * h, tmp, k3);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
  f(t + h, tmp, k4);
  for (let i = 0; i < n; i++) y[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

export function rk4Work(n) {
  return { k1: new Float64Array(n), k2: new Float64Array(n), k3: new Float64Array(n), k4: new Float64Array(n), tmp: new Float64Array(n) };
}

// Dormand–Prince 5(4) tableau
const C2 = 1 / 5, C3 = 3 / 10, C4 = 4 / 5, C5 = 8 / 9;
const A21 = 1 / 5;
const A31 = 3 / 40, A32 = 9 / 40;
const A41 = 44 / 45, A42 = -56 / 15, A43 = 32 / 9;
const A51 = 19372 / 6561, A52 = -25360 / 2187, A53 = 64448 / 6561, A54 = -212 / 729;
const A61 = 9017 / 3168, A62 = -355 / 33, A63 = 46732 / 5247, A64 = 49 / 176, A65 = -5103 / 18656;
const B1 = 35 / 384, B3 = 500 / 1113, B4 = 125 / 192, B5 = -2187 / 6784, B6 = 11 / 84;
// error coefficients e = b(5th) − b*(4th)
const E1 = 71 / 57600, E3 = -71 / 16695, E4 = 71 / 1920, E5 = -17253 / 339200, E6 = 22 / 525, E7 = -1 / 40;

/**
 * Adaptive Dormand–Prince integrator with FSAL and a PI step-size controller.
 * Integrates in either time direction (h may be negative).
 */
export class DormandPrince {
  constructor(f, dim, { rtol = 1e-8, atol = 1e-10, hmax = Infinity, hmin = 1e-14 } = {}) {
    this.f = f;
    this.n = dim;
    this.rtol = rtol;
    this.atol = atol;
    this.hmax = hmax;
    this.hmin = hmin;
    const mk = () => new Float64Array(dim);
    this.y = mk(); this.k1 = mk(); this.k2 = mk(); this.k3 = mk(); this.k4 = mk();
    this.k5 = mk(); this.k6 = mk(); this.k7 = mk(); this.tmp = mk(); this.ynew = mk();
    this.t = 0;
    this.h = 0;
    this.errPrev = 1e-4;
    this.accepted = 0;
    this.rejected = 0;
    this.evals = 0;
  }

  /** Start at (t, y0). `h0` (signed) is an initial step guess; 0 picks one automatically. */
  reset(t, y0, h0 = 0, direction = 1) {
    this.t = t;
    this.y.set(y0);
    this.f(t, this.y, this.k1);
    this.evals = 1;
    this.accepted = 0;
    this.rejected = 0;
    this.errPrev = 1e-4;
    this.dir = direction >= 0 ? 1 : -1;
    this.h = h0 !== 0 ? h0 : this.dir * this.initialStep();
  }

  initialStep() {
    // Hairer–Wanner heuristic: h ≈ 0.01·‖y‖/‖f(y)‖
    let d0 = 0, d1 = 0;
    for (let i = 0; i < this.n; i++) {
      const sc = this.atol + this.rtol * Math.abs(this.y[i]);
      d0 += (this.y[i] / sc) ** 2;
      d1 += (this.k1[i] / sc) ** 2;
    }
    d0 = Math.sqrt(d0 / this.n);
    d1 = Math.sqrt(d1 / this.n);
    const h = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * (d0 / d1);
    return Math.min(h, this.hmax);
  }

  /**
   * Take one accepted step, never stepping past `tEnd` (if given).
   * Returns false if the step size underflowed or the state became non-finite.
   */
  step(tEnd = undefined) {
    const { n, f, y, k1, k2, k3, k4, k5, k6, k7, tmp, ynew } = this;
    for (let attempt = 0; attempt < 60; attempt++) {
      let h = this.h;
      if (Math.abs(h) > this.hmax) h = Math.sign(h) * this.hmax;
      let last = false;
      if (tEnd !== undefined && (this.t + h - tEnd) * Math.sign(h) >= 0) {
        h = tEnd - this.t;
        last = true;
      }
      if (Math.abs(h) < this.hmin && !last) return false;
      const t = this.t;
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h * A21 * k1[i];
      f(t + C2 * h, tmp, k2);
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (A31 * k1[i] + A32 * k2[i]);
      f(t + C3 * h, tmp, k3);
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (A41 * k1[i] + A42 * k2[i] + A43 * k3[i]);
      f(t + C4 * h, tmp, k4);
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (A51 * k1[i] + A52 * k2[i] + A53 * k3[i] + A54 * k4[i]);
      f(t + C5 * h, tmp, k5);
      for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (A61 * k1[i] + A62 * k2[i] + A63 * k3[i] + A64 * k4[i] + A65 * k5[i]);
      f(t + h, tmp, k6);
      for (let i = 0; i < n; i++) ynew[i] = y[i] + h * (B1 * k1[i] + B3 * k3[i] + B4 * k4[i] + B5 * k5[i] + B6 * k6[i]);
      f(t + h, ynew, k7);
      this.evals += 6;

      let err = 0;
      for (let i = 0; i < n; i++) {
        const ei = h * (E1 * k1[i] + E3 * k3[i] + E4 * k4[i] + E5 * k5[i] + E6 * k6[i] + E7 * k7[i]);
        const sc = this.atol + this.rtol * Math.max(Math.abs(y[i]), Math.abs(ynew[i]));
        err += (ei / sc) ** 2;
      }
      err = Math.sqrt(err / n);
      if (!Number.isFinite(err)) {
        this.h = h * 0.25;
        this.rejected++;
        if (Math.abs(this.h) < this.hmin) return false;
        continue;
      }
      if (err <= 1) {
        // PI controller (Gustafsson): fac = 0.9·err^(−0.7/5)·errPrev^(0.4/5)
        const e = Math.max(err, 1e-10);
        let fac = 0.9 * e ** -0.14 * this.errPrev ** 0.08;
        fac = Math.min(5, Math.max(0.2, fac));
        this.errPrev = e;
        this.t = last ? tEnd : t + h;
        y.set(ynew);
        k1.set(k7); // FSAL
        if (!last) this.h = h * fac;
        this.accepted++;
        return true;
      }
      this.rejected++;
      this.h = h * Math.max(0.2, 0.9 * err ** -0.2);
      if (Math.abs(this.h) < this.hmin) return false;
    }
    return false;
  }

  /** Advance to exactly tEnd. Returns false on failure. */
  advanceTo(tEnd, maxSteps = 1e6) {
    let steps = 0;
    while ((tEnd - this.t) * this.dir > 0) {
      if (!this.step(tEnd)) return false;
      if (++steps > maxSteps) return false;
    }
    return true;
  }
}

/**
 * Integrate a trajectory and record every accepted step as { t, y, dy } samples
 * (dy is the derivative there, used for Hermite interpolation when drawing).
 * Stops at |t − t0| = duration, when `stop(y)` is true, after maxSteps, or on failure.
 */
export function integrate(f, y0, { t0 = 0, duration = 20, direction = 1, rtol = 1e-8, atol = 1e-10, hmax = Infinity, maxSteps = 20000, stop = null } = {}) {
  const n = y0.length;
  const dp = new DormandPrince(f, n, { rtol, atol, hmax });
  dp.reset(t0, y0, 0, direction);
  const ts = [t0];
  const ys = [Float64Array.from(y0)];
  const dys = [Float64Array.from(dp.k1)];
  const tEnd = t0 + direction * duration;
  let status = 'done';
  for (let s = 0; s < maxSteps; s++) {
    if ((tEnd - dp.t) * direction <= 0) break;
    if (!dp.step(tEnd)) { status = 'failed'; break; }
    ts.push(dp.t);
    ys.push(Float64Array.from(dp.y));
    dys.push(Float64Array.from(dp.k1));
    if (stop && stop(dp.y)) { status = 'stopped'; break; }
    if (s === maxSteps - 1) status = 'maxsteps';
  }
  return { t: ts, y: ys, dy: dys, status };
}

/**
 * Cubic Hermite interpolation of the solution between recorded samples, inserting points so no
 * segment of the (x, y) projection is longer than `maxSeg` (in the same units as the state).
 * Returns a flat array [x0, y0, t0, x1, y1, t1, …].
 */
export function densify(sol, maxSeg, ix = 0, iy = 1) {
  const out = [];
  const { t, y, dy } = sol;
  if (!t.length) return out;
  out.push(y[0][ix], y[0][iy], t[0]);
  for (let k = 1; k < t.length; k++) {
    const h = t[k] - t[k - 1];
    const p0 = y[k - 1], p1 = y[k];
    const d0 = dy[k - 1], d1 = dy[k];
    const len = Math.hypot(p1[ix] - p0[ix], p1[iy] - p0[iy]);
    const m = Math.min(64, Math.ceil(len / maxSeg));
    for (let j = 1; j < m; j++) {
      const s = j / m;
      const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s;
      const h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
      out.push(
        h00 * p0[ix] + h10 * h * d0[ix] + h01 * p1[ix] + h11 * h * d1[ix],
        h00 * p0[iy] + h10 * h * d0[iy] + h01 * p1[iy] + h11 * h * d1[iy],
        t[k - 1] + s * h,
      );
    }
    out.push(p1[ix], p1[iy], t[k]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Planar systems: x' = F(x, y), y' = G(x, y)

/** Central-difference Jacobian [[Fx, Fy], [Gx, Gy]] of a planar field F(x, y) -> [u, v]. */
export function jacobian2(F, x, y) {
  const hx = 1e-6 * Math.max(1, Math.abs(x));
  const hy = 1e-6 * Math.max(1, Math.abs(y));
  const [u1, v1] = F(x + hx, y);
  const [u0, v0] = F(x - hx, y);
  const [u3, v3] = F(x, y + hy);
  const [u2, v2] = F(x, y - hy);
  return { a: (u1 - u0) / (2 * hx), b: (u3 - u2) / (2 * hy), c: (v1 - v0) / (2 * hx), d: (v3 - v2) / (2 * hy) };
}

/**
 * Classify an equilibrium from its Jacobian J by trace τ, determinant Δ and discriminant τ² − 4Δ.
 * Returns { type, label, stable, eigen } where eigen is either {real:[λ1, λ2], vectors} or
 * {re, im}. Linear "center" is reported as such; for nonlinear systems it is a borderline case.
 */
export function classifyEquilibrium(J) {
  const tr = J.a + J.d;
  const dt = J.a * J.d - J.b * J.c;
  const disc = tr * tr - 4 * dt;
  const sc = Math.max(1e-12, Math.abs(J.a) + Math.abs(J.b) + Math.abs(J.c) + Math.abs(J.d));
  const eps = 1e-6 * sc;
  const eigen = disc >= 0
    ? (() => {
      const s = Math.sqrt(disc);
      const l1 = (tr + s) / 2, l2 = (tr - s) / 2;
      return { real: [l1, l2], vectors: [eigvec(J, l1), eigvec(J, l2)] };
    })()
    : { re: tr / 2, im: Math.sqrt(-disc) / 2 };
  if (Math.abs(dt) <= eps * sc) return { type: 'degenerate', label: '退化（det J = 0，非孤立或高阶）', stable: null, eigen, tr, det: dt };
  if (dt < 0) return { type: 'saddle', label: '鞍点', stable: false, eigen, tr, det: dt };
  if (Math.abs(tr) <= eps) {
    return disc < 0
      ? { type: 'center', label: '中心（线性化）', stable: null, eigen, tr, det: dt }
      : { type: 'degenerate', label: '退化', stable: null, eigen, tr, det: dt };
  }
  const stable = tr < 0;
  if (Math.abs(disc) <= eps * sc) return { type: stable ? 'stable-star' : 'unstable-star', label: stable ? '稳定退化结点' : '不稳定退化结点', stable, eigen, tr, det: dt };
  if (disc > 0) return { type: stable ? 'stable-node' : 'unstable-node', label: stable ? '稳定结点' : '不稳定结点', stable, eigen, tr, det: dt };
  return { type: stable ? 'stable-focus' : 'unstable-focus', label: stable ? '稳定焦点（螺旋汇）' : '不稳定焦点（螺旋源）', stable, eigen, tr, det: dt };
}

function eigvec(J, l) {
  const r1 = [J.a - l, J.b];
  const r2 = [J.c, J.d - l];
  const r = Math.hypot(...r1) >= Math.hypot(...r2) ? r1 : r2;
  const n = Math.hypot(r[0], r[1]);
  if (n === 0) return [1, 0];
  return [-r[1] / n, r[0] / n];
}

/**
 * Find equilibria of a planar field inside bounds {xmin, xmax, ymin, ymax} by damped Newton
 * iteration. Seeds: (1) the centre of every cell of a `bracket` × `bracket` grid in which both
 * components change sign — a bracketing test that catches every transversal zero regardless of
 * how narrow its Newton basin is — and (2) a uniform `seeds` × `seeds` grid for tangential
 * zeros. Duplicates are merged.
 */
export function findEquilibria(F, bounds, { seeds = 14, bracket = 48, maxIter = 40, tol = 1e-10 } = {}) {
  const { xmin, xmax, ymin, ymax } = bounds;
  const w = xmax - xmin, h = ymax - ymin;
  const scale = Math.max(w, h);
  const found = [];
  const starts = [];
  {
    const n = bracket;
    const U = new Float64Array((n + 1) * (n + 1)), V = new Float64Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const [u, v] = F(xmin + (i / n) * w, ymin + (j / n) * h);
        U[j * (n + 1) + i] = u;
        V[j * (n + 1) + i] = v;
      }
    }
    const changes = (A, i, j) => {
      const a = A[j * (n + 1) + i], b = A[j * (n + 1) + i + 1], c = A[(j + 1) * (n + 1) + i], d = A[(j + 1) * (n + 1) + i + 1];
      if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) return false;
      return Math.min(a, b, c, d) <= 0 && Math.max(a, b, c, d) >= 0;
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (changes(U, i, j) && changes(V, i, j)) starts.push([xmin + ((i + 0.5) / n) * w, ymin + ((j + 0.5) / n) * h]);
      }
    }
    // a whole curve of zeros (degenerate system) would flood the seed list: keep it bounded
    if (starts.length > 400) starts.length = 400;
  }
  for (let i = 0; i < seeds; i++) {
    for (let j = 0; j < seeds; j++) starts.push([xmin + ((i + 0.5) / seeds) * w, ymin + ((j + 0.5) / seeds) * h]);
  }
  for (const [x0, y0] of starts) {
    let x = x0;
    let y = y0;
    let ok = false;
    for (let it = 0; it < maxIter; it++) {
      const [u, v] = F(x, y);
      if (!Number.isFinite(u) || !Number.isFinite(v)) break;
      const r = Math.hypot(u, v);
      if (r < tol) { ok = true; break; }
      const J = jacobian2(F, x, y);
      const D = J.a * J.d - J.b * J.c;
      if (!Number.isFinite(D) || Math.abs(D) < 1e-14) break;
      let dx = (J.d * u - J.b * v) / D;
      let dy = (-J.c * u + J.a * v) / D;
      // damping: limit the Newton step to a fraction of the view
      const len = Math.hypot(dx, dy);
      if (len > 0.25 * scale) { dx *= (0.25 * scale) / len; dy *= (0.25 * scale) / len; }
      x -= dx;
      y -= dy;
      if (Math.abs(x - xmin - w / 2) > 2 * w || Math.abs(y - ymin - h / 2) > 2 * h) break;
    }
    if (!ok) {
      const [u, v] = F(x, y);
      ok = Math.hypot(u, v) < 1e-8;
    }
    if (!ok) continue;
    if (x < xmin - 0.02 * w || x > xmax + 0.02 * w || y < ymin - 0.02 * h || y > ymax + 0.02 * h) continue;
    if (found.some((p) => Math.hypot(p.x - x, p.y - y) < 1e-6 * scale)) continue;
    const J = jacobian2(F, x, y);
    found.push({ x, y, J, ...classifyEquilibrium(J) });
  }
  return found;
}

/**
 * Zero level set of a scalar field g(x, y) by marching squares on an nx × ny grid.
 * Returns a flat Float64Array of segments [x0, y0, x1, y1, …]. Sign changes across a pole
 * (e.g. 1/x at x = 0) are rejected.
 */
export function contourZero(g, bounds, nx, ny) {
  const { xmin, xmax, ymin, ymax } = bounds;
  const dx = (xmax - xmin) / nx, dy = (ymax - ymin) / ny;
  const vals = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) vals[j * (nx + 1) + i] = g(xmin + i * dx, ymin + j * dy);
  }
  const segs = [];
  const at = (i, j) => vals[j * (nx + 1) + i];
  // Crossing point on the edge from (x0, y0, value a) to (x1, y1, value b), or null when the sign
  // change is a jump through a pole: at a genuine root g is small at the interpolated point,
  // across a pole it is at least as large as the endpoint values.
  const crossing = (x0, y0, a, x1, y1, b) => {
    const s = a / (a - b);
    const x = x0 + s * (x1 - x0), y = y0 + s * (y1 - y0);
    const gm = g(x, y);
    return Math.abs(gm) < 0.5 * Math.min(Math.abs(a), Math.abs(b)) + 1e-12 ? [x, y] : null;
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v00 = at(i, j), v10 = at(i + 1, j), v11 = at(i + 1, j + 1), v01 = at(i, j + 1);
      if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v11) && Number.isFinite(v01))) continue;
      const x0 = xmin + i * dx, y0 = ymin + j * dy, x1 = x0 + dx, y1 = y0 + dy;
      // edges in order [bottom, right, top, left]
      const pts = [
        (v00 < 0) !== (v10 < 0) ? crossing(x0, y0, v00, x1, y0, v10) : undefined,
        (v10 < 0) !== (v11 < 0) ? crossing(x1, y0, v10, x1, y1, v11) : undefined,
        (v11 < 0) !== (v01 < 0) ? crossing(x1, y1, v11, x0, y1, v01) : undefined,
        (v01 < 0) !== (v00 < 0) ? crossing(x0, y1, v01, x0, y0, v00) : undefined,
      ];
      if (pts.includes(null)) continue; // pole inside this cell
      const p = pts.filter(Boolean);
      if (p.length === 2) {
        segs.push(p[0][0], p[0][1], p[1][0], p[1][1]);
      } else if (p.length === 4) {
        // saddle cell: cut off the two corners that are not joined through the centre
        const c = g(x0 + dx / 2, y0 + dy / 2);
        if ((c < 0) === (v00 < 0)) {
          segs.push(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]);
        } else {
          segs.push(p[0][0], p[0][1], p[3][0], p[3][1], p[1][0], p[1][1], p[2][0], p[2][1]);
        }
      }
    }
  }
  return Float64Array.from(segs);
}

/**
 * Largest Lyapunov exponent by Benettin's method: follow a reference orbit and a neighbour at
 * distance d0, renormalising the separation every `tau` time units.
 */
export function largestLyapunov(f, y0, { dt = 0.005, tau = 0.5, transient = 50, duration = 300, d0 = 1e-8 } = {}) {
  const n = y0.length;
  const y = Float64Array.from(y0);
  const w = rk4Work(n);
  let t = 0;
  for (; t < transient; t += dt) rk4Step(f, t, y, dt, w);
  const z = Float64Array.from(y);
  z[0] += d0;
  let sum = 0;
  let elapsed = 0;
  const stepsPerTau = Math.round(tau / dt);
  while (elapsed < duration) {
    for (let s = 0; s < stepsPerTau; s++) {
      rk4Step(f, t, y, dt, w);
      rk4Step(f, t, z, dt, w);
      t += dt;
    }
    let d = 0;
    for (let i = 0; i < n; i++) d += (z[i] - y[i]) ** 2;
    d = Math.sqrt(d);
    sum += Math.log(d / d0);
    for (let i = 0; i < n; i++) z[i] = y[i] + ((z[i] - y[i]) * d0) / d;
    elapsed += stepsPerTau * dt;
  }
  return sum / elapsed;
}
