// The trefoil as the link of the singularity z² + w³ = 0, and its Milnor fibration.
//
//   K   = { (z, w) ∈ S³ : z² + w³ = 0 }            — the trefoil knot (the (2,3) torus knot)
//   F_θ = { (z, w) ∈ S³ \ K : arg(z² + w³) = θ }   — a Seifert surface of K (genus 1), one per θ
//
// Every page F_θ is the image of the affine curve z² + w³ = 1 under
//   (z, w) ↦ (e^{iθ/2} z, e^{iθ/3} w)  followed by the weighted radial flow (z, w) ↦ (s³z, s²w)
// that pushes a point onto S³. Both maps preserve arg(z² + w³) up to the rotation by θ, so we sample
// the θ = 0 page once (on the CPU) and let the GPU rotate it to any θ. Stereographic projection from
// the pole (z, w) = (i, 0) turns S³ into ℝ³ with the knot's symmetry axis along +z.

export const KNOT_SCALE = 1.25;

// |w| on the knot: a² = b³ and a² + b² = 1  ⇒  b³ + b² − 1 = 0.
function knotRadii() {
  let b = 0.75;
  for (let k = 0; k < 40; k++) b -= (b * b * b + b * b - 1) / (3 * b * b + 2 * b);
  return { a: Math.sqrt(1 - b * b), b };
}
export const { a: KNOT_A, b: KNOT_B } = knotRadii();

// Push an affine point onto S³ with the weighted flow: find u = s² > 0 with u³|z|² + u²|w|² = 1.
// g(u) is increasing and convex, so Newton started to the right of the root converges monotonically.
export function toSphere(zr, zi, wr, wi, out) {
  const Z2 = zr * zr + zi * zi;
  const W2 = wr * wr + wi * wi;
  let u = Z2 > 1e-12 ? Math.cbrt(1 / Z2) : 1 / Math.sqrt(W2);
  if (W2 > 1e-12) u = Math.min(u, 1 / Math.sqrt(W2));
  for (let k = 0; k < 40; k++) {
    const g = u * u * u * Z2 + u * u * W2 - 1;
    const dg = 3 * u * u * Z2 + 2 * u * W2;
    const step = g / dg;
    u -= step;
    if (Math.abs(step) < 1e-12 * u) break;
  }
  const s3 = Math.pow(u, 1.5);
  out[0] = s3 * zr; out[1] = s3 * zi; out[2] = u * wr; out[3] = u * wi;
  return out;
}

// Rotate the θ = 0 page to angle θ and project stereographically from (i, 0). Writes xyz into out.
// Returns the distance from the origin (used to fade points that run off towards infinity).
export function projectFiber(x0, x1, x2, x3, theta, out, o = 0) {
  const c1 = Math.cos(theta / 2), s1 = Math.sin(theta / 2);
  const c2 = Math.cos(theta / 3), s2 = Math.sin(theta / 3);
  const zr = c1 * x0 - s1 * x1, zi = s1 * x0 + c1 * x1;
  const wr = c2 * x2 - s2 * x3, wi = s2 * x2 + c2 * x3;
  const d = Math.max(1 - zi, 1e-3);
  out[o] = (wr / d) * KNOT_SCALE;
  out[o + 1] = (wi / d) * KNOT_SCALE;
  out[o + 2] = (zr / d) * KNOT_SCALE;
  return Math.hypot(out[o], out[o + 1], out[o + 2]);
}

// z = ±√(1 − w³) on the θ = 0 page; `ref` (optional) picks the sign closest to a neighbouring value
// so finite differences never jump across the branch cut.
function sheetZ(wr, wi, sign, ref) {
  const w2r = wr * wr - wi * wi, w2i = 2 * wr * wi;
  const w3r = w2r * wr - w2i * wi, w3i = w2r * wi + w2i * wr;
  const cr = 1 - w3r, ci = -w3i;
  const r = Math.hypot(cr, ci);
  let sr = Math.sqrt(Math.max(0, (r + cr) / 2));
  let si = Math.sqrt(Math.max(0, (r - cr) / 2)) * (ci < 0 ? -1 : 1);
  if (ref) {
    if ((sr - ref[0]) ** 2 + (si - ref[1]) ** 2 > (sr + ref[0]) ** 2 + (si + ref[1]) ** 2) { sr = -sr; si = -si; }
  } else if (sign < 0) { sr = -sr; si = -si; }
  return [sr, si];
}

const RHO = (v) => v / (1 - v); // radial parameter of the w-plane, v ∈ [0, 1)

function pagePoint(v, alpha, sign, ref, s3, xyz) {
  const rho = RHO(v);
  const wr = rho * Math.cos(alpha), wi = rho * Math.sin(alpha);
  const z = sheetZ(wr, wi, sign, ref);
  toSphere(z[0], z[1], wr, wi, s3);
  projectFiber(s3[0], s3[1], s3[2], s3[3], 0, xyz);
  return z;
}

// Sample `count` points on the θ = 0 page with (roughly) uniform density in ℝ³:
// evaluate the local area of a fine (v, α) grid on both sheets, then resample cells ∝ area.
// Returns Float32Array(count*4) of S³ coordinates.
export function sampleFiber(count, rand, { nv = 200, na = 400, maxR = 6.5 } = {}) {
  const VMAX = 0.988;
  const cells = nv * na * 2;
  const weight = new Float64Array(cells);
  const s3 = [0, 0, 0, 0];
  const p = [0, 0, 0], pv = [0, 0, 0], pa = [0, 0, 0];
  const dv = VMAX / nv, da = (2 * Math.PI) / na;
  let total = 0;
  for (let sheet = 0; sheet < 2; sheet++) {
    const sign = sheet ? -1 : 1;
    for (let i = 0; i < nv; i++) {
      const v = (i + 0.5) * dv;
      for (let j = 0; j < na; j++) {
        const alpha = (j + 0.5) * da;
        const z = pagePoint(v, alpha, sign, null, s3, p);
        const r = Math.hypot(p[0], p[1], p[2]);
        let w = 0;
        if (r < maxR) {
          pagePoint(v + dv * 0.5, alpha, sign, z, s3, pv);
          pagePoint(v, alpha + da * 0.5, sign, z, s3, pa);
          const ax = pv[0] - p[0], ay = pv[1] - p[1], az = pv[2] - p[2];
          const bx = pa[0] - p[0], by = pa[1] - p[1], bz = pa[2] - p[2];
          w = 4 * Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
          if (!Number.isFinite(w)) w = 0;
          w = Math.min(w, 0.05); // guard against cells that brush the pole
        }
        weight[(sheet * nv + i) * na + j] = w;
        total += w;
      }
    }
  }
  const out = new Float32Array(count * 4);
  const stepW = total / count;
  let acc = 0, cell = 0, target = rand() * stepW;
  for (let n = 0; n < count; n++) {
    while (cell < cells - 1 && acc + weight[cell] < target) { acc += weight[cell]; cell++; }
    target += stepW;
    const sheet = cell >= nv * na ? 1 : 0;
    const rem = cell - sheet * nv * na;
    const i = Math.floor(rem / na), j = rem % na;
    const v = (i + rand()) * dv, alpha = (j + rand()) * da;
    const rho = RHO(v);
    const wr = rho * Math.cos(alpha), wi = rho * Math.sin(alpha);
    const z = sheetZ(wr, wi, sheet ? -1 : 1, null);
    toSphere(z[0], z[1], wr, wi, s3);
    out.set(s3, n * 4);
  }
  return out;
}

// The knot itself: z = a e^{3it}, w = b e^{iπ/3} e^{2it}, t ∈ [0, 2π).
export function knotS3(t, out) {
  out[0] = KNOT_A * Math.cos(3 * t);
  out[1] = KNOT_A * Math.sin(3 * t);
  out[2] = KNOT_B * Math.cos(2 * t + Math.PI / 3);
  out[3] = KNOT_B * Math.sin(2 * t + Math.PI / 3);
  return out;
}

export function knotCurve(samples = 720) {
  const pts = [];
  const s3 = [0, 0, 0, 0], p = [0, 0, 0];
  for (let k = 0; k < samples; k++) {
    knotS3((k / samples) * 2 * Math.PI, s3);
    projectFiber(s3[0], s3[1], s3[2], s3[3], 0, p);
    pts.push([p[0], p[1], p[2]]);
  }
  return pts;
}
