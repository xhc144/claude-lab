// 2×2 real linear algebra. A matrix is { a, b, c, d } meaning [[a, b], [c, d]]:
// its first column (a, c) is the image of e₁ = î and its second column (b, d) the image of e₂ = ĵ.

export const mat = (a, b, c, d) => ({ a, b, c, d });
export const IDENTITY = Object.freeze(mat(1, 0, 0, 1));

export const det = (M) => M.a * M.d - M.b * M.c;
export const trace = (M) => M.a + M.d;
export const apply = (M, x, y) => [M.a * x + M.b * y, M.c * x + M.d * y];
export const transpose = (M) => mat(M.a, M.c, M.b, M.d);
export const scale = (M, k) => mat(k * M.a, k * M.b, k * M.c, k * M.d);
export const add = (A, B) => mat(A.a + B.a, A.b + B.b, A.c + B.c, A.d + B.d);
export const rotation = (theta) => mat(Math.cos(theta), -Math.sin(theta), Math.sin(theta), Math.cos(theta));

/** Matrix product A·B (apply B first, then A). */
export function mul(A, B) {
  return mat(
    A.a * B.a + A.b * B.c, A.a * B.b + A.b * B.d,
    A.c * B.a + A.d * B.c, A.c * B.b + A.d * B.d,
  );
}

export function power(M, n) {
  let R = IDENTITY;
  let B = M;
  let k = n;
  while (k > 0) {
    if (k & 1) R = mul(R, B);
    B = mul(B, B);
    k >>= 1;
  }
  return R;
}

/** Scale used for relative tolerances. */
export const norm = (M) => Math.hypot(M.a, M.b, M.c, M.d);

export function inverse(M) {
  const D = det(M);
  if (Math.abs(D) <= 1e-12 * Math.max(1, norm(M) ** 2)) return null;
  return mat(M.d / D, -M.b / D, -M.c / D, M.a / D);
}

export function lerp(A, B, t) {
  return mat(A.a + (B.a - A.a) * t, A.b + (B.b - A.b) * t, A.c + (B.c - A.c) * t, A.d + (B.d - A.d) * t);
}

export function approxEqual(A, B, tol = 1e-9) {
  return Math.abs(A.a - B.a) <= tol && Math.abs(A.b - B.b) <= tol && Math.abs(A.c - B.c) <= tol && Math.abs(A.d - B.d) <= tol;
}

const normalize = (x, y) => {
  const n = Math.hypot(x, y);
  return n > 0 ? [x / n, y / n] : [0, 0];
};

/**
 * Eigen-decomposition.
 *   kind 'real'     : two distinct real eigenvalues, values[0] > values[1], unit vectors[k].
 *   kind 'repeated' : one eigenvalue λ; `scalar` true when M = λI (every vector is an eigenvector),
 *                     otherwise a single eigenvector (defective / shear-like).
 *   kind 'complex'  : λ = re ± i·im with im > 0; modulus r and angle θ give the rotation-scaling
 *                     form M ~ r·R(θ).
 */
export function eigen(M) {
  const T = trace(M);
  const D = det(M);
  const disc = T * T - 4 * D;
  const scaleTol = 1e-10 * Math.max(1, T * T, Math.abs(D));
  if (disc > scaleTol) {
    const s = Math.sqrt(disc);
    // numerically stable pair: q = (T + sign(T)·s)/2, λ₁ = q, λ₂ = D/q
    const q = 0.5 * (T + (T >= 0 ? s : -s));
    let l1 = q;
    let l2 = q !== 0 ? D / q : 0.5 * (T - s);
    if (l2 > l1) [l1, l2] = [l2, l1];
    return { kind: 'real', values: [l1, l2], vectors: [eigenvector(M, l1), eigenvector(M, l2)] };
  }
  if (disc < -scaleTol) {
    const re = T / 2;
    const im = Math.sqrt(-disc) / 2;
    return { kind: 'complex', re, im, modulus: Math.hypot(re, im), angle: Math.atan2(im, re) };
  }
  const l = T / 2;
  const scalar = Math.abs(M.b) <= 1e-9 * Math.max(1, Math.abs(l)) && Math.abs(M.c) <= 1e-9 * Math.max(1, Math.abs(l)) && Math.abs(M.a - M.d) <= 1e-9 * Math.max(1, Math.abs(l));
  return { kind: 'repeated', values: [l, l], scalar, vectors: scalar ? [[1, 0], [0, 1]] : [eigenvector(M, l)] };
}

/** A unit vector in the null space of M − λI (picks the better-conditioned row). */
export function eigenvector(M, l) {
  const r1 = [M.a - l, M.b];
  const r2 = [M.c, M.d - l];
  const n1 = Math.hypot(r1[0], r1[1]);
  const n2 = Math.hypot(r2[0], r2[1]);
  const r = n1 >= n2 ? r1 : r2;
  if (Math.max(n1, n2) === 0) return [1, 0];
  // a vector orthogonal to the row (x, y) is (−y, x)
  const v = normalize(-r[1], r[0]);
  // canonical sign: first non-zero component positive
  if (v[0] < -1e-15 || (Math.abs(v[0]) <= 1e-15 && v[1] < 0)) return [-v[0] + 0, -v[1] + 0];
  return [v[0] + 0, v[1] + 0]; // + 0 turns −0 into 0
}

/**
 * Closed-form SVD (Blinn): M = U·diag(σ₁, σ₂)·Vᵀ with σ₁ ≥ σ₂ ≥ 0 and U, V orthogonal.
 * Also returns the angles: U = R(phi); Vᵀ = R(theta), or diag(1, −1)·R(theta) when `flip`.
 */
export function svd(M) {
  const E = (M.a + M.d) / 2;
  const F = (M.a - M.d) / 2;
  const G = (M.c + M.b) / 2;
  const Hh = (M.c - M.b) / 2;
  const Q = Math.hypot(E, Hh);
  const R = Math.hypot(F, G);
  const s1 = Q + R;
  const s2 = Q - R;
  const a1 = Math.atan2(G, F);
  const a2 = Math.atan2(Hh, E);
  const theta = (a2 - a1) / 2;
  const phi = (a2 + a1) / 2;
  const flip = s2 < 0;
  const U = rotation(phi);
  let Vt = rotation(theta);
  if (flip) Vt = mat(Vt.a, Vt.b, -Vt.c, -Vt.d);
  return { sigma: [s1, Math.abs(s2)], U, Vt, phi, theta, flip };
}

/**
 * Polar decomposition M = Q·P with Q orthogonal and P symmetric positive semi-definite.
 * Q = U·Vᵀ, P = V·Σ·Vᵀ. For det Q = +1, `angle` is the rotation angle of Q.
 */
export function polar(M) {
  const { sigma, U, Vt } = svd(M);
  const Q = mul(U, Vt);
  const V = transpose(Vt);
  const P = mul(mul(V, mat(sigma[0], 0, 0, sigma[1])), Vt);
  return { Q, P, rotation: det(Q) > 0, angle: Math.atan2(Q.c, Q.a) };
}

// For 2×2 matrices both exp and log have closed forms. Write M = m·I + K with m = tr M / 2;
// the traceless part satisfies K² = p·I with p = m² − det M (Cayley–Hamilton), so every power
// series in M collapses to α·I + β·K.

/**
 * Real principal logarithm L (exp L = M), or null when M has none: det M ≤ 0, or a negative
 * eigenvalue — except M = −k·I = k·R(π), whose logarithm is ln k·I + π·J.
 */
export function logm(M) {
  const D = det(M);
  if (!(D > 0)) return null;
  const m = trace(M) / 2;
  const K = mat(M.a - m, M.b, M.c, M.d - m);
  const p = m * m - D;
  const tol = 1e-12 * Math.max(m * m, D);
  const comb = (alpha, beta) => mat(alpha + beta * K.a, beta * K.b, beta * K.c, alpha + beta * K.d);
  if (p > tol) {
    // real eigenvalues m ± s; both positive is required
    const s = Math.sqrt(p);
    if (m - s <= 0) return null;
    return comb(0.5 * Math.log(D), Math.atanh(s / m) / s);
  }
  if (p < -tol) {
    // m ± i·s = r·e^{±iθ}
    const s = Math.sqrt(-p);
    return comb(0.5 * Math.log(D), Math.atan2(s, m) / s);
  }
  if (m > 0) return comb(Math.log(m), 1 / m); // K² = 0: log(m(I + K/m)) = ln m·I + K/m
  if (norm(K) <= 1e-9 * Math.abs(m)) return mat(Math.log(-m), -Math.PI, Math.PI, Math.log(-m));
  return null;
}

/** Matrix exponential. */
export function expm(L) {
  const m = trace(L) / 2;
  const K = mat(L.a - m, L.b, L.c, L.d - m);
  const p = m * m - det(L); // K² = p·I, so exp K = cosh√p·I + (sinh√p/√p)·K
  let c, s;
  if (Math.abs(p) < 1e-8) { c = 1 + p / 2; s = 1 + p / 6; }
  else if (p > 0) { const r = Math.sqrt(p); c = Math.cosh(r); s = Math.sinh(r) / r; }
  else { const r = Math.sqrt(-p); c = Math.cos(r); s = Math.sin(r) / r; }
  const e = Math.exp(m);
  return mat(e * (c + s * K.a), e * s * K.b, e * s * K.c, e * (c + s * K.d));
}

/** Real power Mᵗ = exp(t·log M) for real t, or null when M has no real logarithm. */
export function powReal(M, t, L = logm(M)) {
  return L ? expm(scale(L, t)) : null;
}

/**
 * M = U·Σ·Vᵀ as three steps for t ∈ [0, 1]: rotate by Vᵀ (t ≤ ⅓), stretch along the axes to Σ
 * (⅓ … ⅔), rotate by U (⅔ … 1). With det M < 0 the reflection is put into Σ as a negative
 * second singular value, so the stretch step passes through a singular matrix.
 */
export function svdPath(M, t) {
  const { sigma, phi, theta, flip } = svd(M);
  const s1 = sigma[0];
  const s2 = flip ? -sigma[1] : sigma[1];
  const u = 3 * Math.min(1, Math.max(0, t));
  if (u <= 1) return rotation(u * theta);
  if (u <= 2) {
    const k = u - 1;
    return mul(mat(1 + k * (s1 - 1), 0, 0, 1 + k * (s2 - 1)), rotation(theta));
  }
  return mul(rotation((u - 2) * phi), mul(mat(s1, 0, 0, s2), rotation(theta)));
}

/**
 * Path from I to M used by the transform animation.
 *  - 'linear': (1 − t)·I + t·M  (straight line in matrix space; passes through singular
 *              matrices when det M < 0, which is unavoidable for orientation reversal)
 *  - 'polar' : R(t·θ)·((1 − t)·I + t·P) when M = R(θ)·P has det > 0, so the rotation part turns
 *              rigidly instead of collapsing; falls back to linear otherwise.
 *  - 'exp'   : Mᵗ = exp(t·log M), the one-parameter group through M (needs a real logarithm;
 *              falls back to 'polar').
 *  - 'svd'   : rotate, stretch, rotate (see svdPath).
 */
export function interpolate(M, t, mode = 'linear') {
  if (t >= 1) return { ...M };
  if (t <= 0) return { ...IDENTITY };
  if (mode === 'svd') return svdPath(M, t);
  if (mode === 'exp') {
    const P = powReal(M, t);
    if (P) return P;
    mode = 'polar';
  }
  if (mode === 'polar' && det(M) > 0) {
    const { P, angle } = polar(M);
    return mul(rotation(t * angle), lerp(IDENTITY, P, t));
  }
  return lerp(IDENTITY, M, t);
}

/** Rank with a relative tolerance. */
export function rank(M) {
  const { sigma } = svd(M);
  const tol = 1e-10 * Math.max(1, sigma[0]);
  return (sigma[0] > tol ? 1 : 0) + (sigma[1] > tol ? 1 : 0);
}

const deg = (r) => (r * 180) / Math.PI;
const fmtAngle = (r) => {
  const d = deg(r);
  const rounded = Math.round(d * 10) / 10;
  return `${Object.is(rounded, -0) ? 0 : rounded}°`;
};

/** Human-readable geometric description (Chinese), most specific first. */
export function classify(M) {
  const tags = [];
  const n = Math.max(1, norm(M));
  const tol = 1e-9 * n;
  const D = det(M);
  const r = rank(M);
  if (r === 0) return ['零变换：整个平面压缩到原点'];
  if (r === 1) {
    tags.push('奇异：平面被压缩到一条直线（det = 0）');
    const P = mul(M, M);
    if (approxEqual(P, M, 1e-9 * n)) {
      const sym = Math.abs(M.b - M.c) <= tol;
      tags.push(sym ? '正交投影（M² = M，对称）' : '斜投影（M² = M）');
    }
    if (approxEqual(mul(M, M), mat(0, 0, 0, 0), 1e-9 * n * n)) tags.push('幂零（M² = 0）');
    return tags;
  }
  if (approxEqual(M, IDENTITY, tol)) return ['恒等变换'];
  if (Math.abs(M.b) <= tol && Math.abs(M.c) <= tol && Math.abs(M.a - M.d) <= tol) {
    return [M.a < 0 ? `均匀缩放 ${+M.a.toFixed(4)} 倍（含 180° 旋转）` : `均匀缩放 ${+M.a.toFixed(4)} 倍`];
  }
  const MtM = mul(transpose(M), M);
  const orthogonal = approxEqual(MtM, IDENTITY, 1e-9 * n * n);
  if (orthogonal) {
    if (D > 0) return [`旋转 ${fmtAngle(Math.atan2(M.c, M.a))}（正交，保长度和角度）`];
    const axis = Math.atan2(M.c, M.a) / 2;
    return [`反射：关于与 x 轴成 ${fmtAngle(axis)} 的直线（正交，翻转定向）`];
  }
  // conformal: M = k·R(θ) has a = d, b = −c
  if (Math.abs(M.a - M.d) <= tol && Math.abs(M.b + M.c) <= tol) {
    tags.push(`旋转 ${fmtAngle(Math.atan2(M.c, M.a))} 并缩放 ${+Math.hypot(M.a, M.c).toFixed(4)} 倍（保角）`);
  }
  const ev = eigen(M);
  if (ev.kind === 'complex' && tags.length === 0) tags.push('复特征值：每次作用都带有旋转（无实不变直线）');
  if (ev.kind === 'repeated' && !ev.scalar) {
    tags.push(Math.abs(ev.values[0] - 1) <= 1e-9 ? '剪切（单一特征方向，λ = 1）' : '亏损矩阵：只有一条特征方向（剪切 + 缩放）');
  }
  if (Math.abs(M.b - M.c) <= tol && ev.kind === 'real') tags.push('对称矩阵：沿两条正交特征方向伸缩');
  if (Math.abs(Math.abs(D) - 1) <= 1e-9 && !orthogonal) tags.push('保面积（|det| = 1）');
  if (D < 0) tags.push('翻转定向（det < 0）');
  if (tags.length === 0) tags.push('一般线性变换');
  return tags;
}
