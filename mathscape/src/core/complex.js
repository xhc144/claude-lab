// Complex elementary functions on (re, im) pairs.
//
// Every helper writes its result into S[0], S[1] instead of allocating, so compiled f(z) code can
// be evaluated millions of times per frame. All functions use principal branches: the cut of log,
// sqrt and pow lies on the negative real axis and arg ∈ (−π, π] (a signed zero −0 in the imaginary
// part is treated as +0, so log(−1) = iπ and sqrt(−4) = 2i).

const LANCZOS_G = 7;
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];
const SQRT_2PI = Math.sqrt(2 * Math.PI);

function div(ar, ai, br, bi, S) {
  if (br === 0 && bi === 0) {
    // complex infinity (or NaN for 0/0)
    S[0] = ar === 0 && ai === 0 ? NaN : Infinity;
    S[1] = 0;
    return;
  }
  // Smith's algorithm: avoids overflow in br² + bi²
  if (Math.abs(br) >= Math.abs(bi)) {
    const q = bi / br;
    const d = br + bi * q;
    S[0] = (ar + ai * q) / d;
    S[1] = (ai - ar * q) / d;
  } else {
    const q = br / bi;
    const d = br * q + bi;
    S[0] = (ar * q + ai) / d;
    S[1] = (ai * q - ar) / d;
  }
}

function exp(r, i, S) {
  const e = Math.exp(r);
  if (i === 0) { S[0] = e; S[1] = 0; return; }
  S[0] = e * Math.cos(i);
  S[1] = e * Math.sin(i);
}

function log(r, i, S) {
  const m = r * r + i * i;
  S[0] = m > 1e-290 && m < 1e290 ? 0.5 * Math.log(m) : Math.log(Math.hypot(r, i));
  S[1] = Math.atan2(i === 0 ? 0 : i, r);
}

function sqrt(r, i, S) {
  if (r === 0 && i === 0) { S[0] = 0; S[1] = 0; return; }
  const m = Math.hypot(r, i);
  if (r >= 0) {
    const t = Math.sqrt(0.5 * (m + r));
    S[0] = t;
    S[1] = i / (2 * t);
  } else {
    const t = Math.sqrt(0.5 * (m - r));
    S[0] = Math.abs(i) / (2 * t);
    S[1] = i < 0 ? -t : t;
  }
}

function powi(r, i, n, S) {
  if (n === 0) { S[0] = 1; S[1] = 0; return; }
  let k = Math.abs(n);
  let br = r, bi = i; // base
  let pr = 1, pi = 0; // accumulated product
  while (k > 0) {
    if (k & 1) {
      const t = pr * br - pi * bi;
      pi = pr * bi + pi * br;
      pr = t;
    }
    k >>= 1;
    if (k) {
      const t = br * br - bi * bi;
      bi = 2 * br * bi;
      br = t;
    }
  }
  if (n < 0) div(1, 0, pr, pi, S);
  else { S[0] = pr; S[1] = pi; }
}

function pow(ar, ai, br, bi, S) {
  if (bi === 0 && Number.isInteger(br) && Math.abs(br) <= 1024) { powi(ar, ai, br, S); return; }
  if (ar === 0 && ai === 0) {
    if (br > 0) { S[0] = 0; S[1] = 0; } else { S[0] = Infinity; S[1] = 0; }
    return;
  }
  log(ar, ai, S);
  const lr = S[0], li = S[1];
  exp(br * lr - bi * li, br * li + bi * lr, S);
}

function sin(r, i, S) {
  S[0] = Math.sin(r) * Math.cosh(i);
  S[1] = Math.cos(r) * Math.sinh(i);
}

function cos(r, i, S) {
  S[0] = Math.cos(r) * Math.cosh(i);
  S[1] = -Math.sin(r) * Math.sinh(i);
}

function tan(r, i, S) {
  if (Math.abs(i) > 20) { S[0] = 0; S[1] = Math.sign(i); return; }
  const d = Math.cos(2 * r) + Math.cosh(2 * i);
  S[0] = Math.sin(2 * r) / d;
  S[1] = Math.sinh(2 * i) / d;
}

function sinh(r, i, S) {
  S[0] = Math.sinh(r) * Math.cos(i);
  S[1] = Math.cosh(r) * Math.sin(i);
}

function cosh(r, i, S) {
  S[0] = Math.cosh(r) * Math.cos(i);
  S[1] = Math.sinh(r) * Math.sin(i);
}

function tanh(r, i, S) {
  if (Math.abs(r) > 20) { S[0] = Math.sign(r); S[1] = 0; return; }
  const d = Math.cosh(2 * r) + Math.cos(2 * i);
  S[0] = Math.sinh(2 * r) / d;
  S[1] = Math.sin(2 * i) / d;
}

function recipOf(fn) {
  return (r, i, S) => {
    fn(r, i, S);
    div(1, 0, S[0], S[1], S);
  };
}

// asin z = −i·log(iz + sqrt(1 − z²))
function asin(r, i, S) {
  sqrt(1 - (r * r - i * i), -2 * r * i, S);
  const ur = S[0] - i, ui = S[1] + r;
  log(ur, ui, S);
  const lr = S[0];
  S[0] = S[1];
  S[1] = -lr;
}

function acos(r, i, S) {
  asin(r, i, S);
  S[0] = Math.PI / 2 - S[0];
  S[1] = -S[1];
}

// atan z = (i/2)·[log(1 − iz) − log(1 + iz)]
function atan(r, i, S) {
  log(1 + i, -r, S);
  const ar = S[0], ai = S[1];
  log(1 - i, r, S);
  const dr = ar - S[0], di = ai - S[1];
  S[0] = -di / 2;
  S[1] = dr / 2;
}

// Lanczos approximation (g = 7, n = 9), reflection formula for Re z < 1/2.
function gamma(r, i, S) {
  if (r < 0.5) {
    gamma(1 - r, -i, S);
    const gr = S[0], gi = S[1];
    sin(Math.PI * r, Math.PI * i, S);
    const sr = S[0], si = S[1];
    div(Math.PI, 0, sr * gr - si * gi, sr * gi + si * gr, S);
    return;
  }
  const zr = r - 1, zi = i;
  let xr = LANCZOS[0], xi = 0;
  for (let k = 1; k < LANCZOS.length; k++) {
    div(LANCZOS[k], 0, zr + k, zi, S);
    xr += S[0];
    xi += S[1];
  }
  const tr = zr + LANCZOS_G + 0.5, ti = zi;
  log(tr, ti, S);
  const lr = S[0], li = S[1];
  // t^(z+1/2)·e^(−t) = exp((z + 1/2)·log t − t)
  exp((zr + 0.5) * lr - zi * li - tr, (zr + 0.5) * li + zi * lr - ti, S);
  const qr = S[0], qi = S[1];
  S[0] = SQRT_2PI * (qr * xr - qi * xi);
  S[1] = SQRT_2PI * (qr * xi + qi * xr);
}

export const H = {
  div, exp, log, sqrt, pow, powi,
  sin, cos, tan, sec: recipOf(cos), csc: recipOf(sin), cot: recipOf(tan),
  sinh, cosh, tanh, asin, acos, atan, gamma,
};

/** Convenience wrapper for non-hot code: call a helper and get [re, im]. */
export function call(name, ...args) {
  const S = new Float64Array(2);
  H[name](...args, S);
  return [S[0], S[1]];
}

/**
 * Winding number of the closed curve t ↦ g(t), t ∈ [0, 1], around the origin.
 * Adaptive: a sample interval is split while the image turns by more than `maxTurn` radians,
 * so fast phase changes near zeros are not missed. Returns { winding, exact, minModulus, curve }
 * where `curve` holds the sampled image points and `exact` is the unrounded total turning / 2π.
 */
export function windingNumber(g, { samples = 720, maxTurn = 0.4, maxDepth = 14 } = {}) {
  const P = new Float64Array(2);
  const eval_ = (t) => { g(t, P); return [P[0], P[1]]; };
  let total = 0;
  let minModulus = Infinity;
  let ok = true;
  const curve = [];

  function seg(t0, p0, t1, p1, depth) {
    const a0 = Math.atan2(p0[1], p0[0]);
    const a1 = Math.atan2(p1[1], p1[0]);
    let d = a1 - a0;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > maxTurn && depth < maxDepth) {
      const tm = 0.5 * (t0 + t1);
      const pm = eval_(tm);
      seg(t0, p0, tm, pm, depth + 1);
      seg(tm, pm, t1, p1, depth + 1);
      return;
    }
    if (Math.abs(d) > maxTurn) ok = false; // could not resolve: curve passes (nearly) through 0 or ∞
    total += d;
    curve.push(p1);
    const m = Math.hypot(p1[0], p1[1]);
    if (m < minModulus) minModulus = m;
    if (!Number.isFinite(m)) ok = false;
  }

  let t0 = 0;
  let p0 = eval_(0);
  curve.push(p0);
  minModulus = Math.hypot(p0[0], p0[1]);
  for (let k = 1; k <= samples; k++) {
    const t1 = k / samples;
    const p1 = eval_(t1);
    seg(t0, p0, t1, p1, 0);
    t0 = t1;
    p0 = p1;
  }
  const exact = total / (2 * Math.PI);
  return { winding: Math.round(exact) + 0, exact, reliable: ok && Math.abs(exact - Math.round(exact)) < 1e-6, minModulus, curve };
}
