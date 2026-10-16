// Plane symmetry groups: rosettes C_n / D_n, the 7 frieze groups and the 17 wallpaper groups.
//
// A wallpaper group is given, as in the International Tables, by its lattice basis (a, b) and the
// general positions of one unit cell: affine maps f ↦ A·f + t in lattice (fractional) coordinates.
// In Cartesian coordinates they become p ↦ M·p + τ with M = L·A·L⁻¹ and τ = L·t (L = [a b]); all
// further images come from adding lattice vectors k·a + l·b. Mirror lines, glide lines and rotation
// centres are not tabulated: they are computed from the operations (see elements()).

const S3 = Math.sqrt(3) / 2;
export const LATTICES = {
  oblique: { label: '斜方', a: [1, 0], b: [0.3, 0.86] },
  rect: { label: '矩形', a: [1, 0], b: [0, 0.72] },
  centred: { label: '有心矩形', a: [1, 0], b: [0, 1.25] },
  square: { label: '正方', a: [1, 0], b: [0, 1] },
  hex: { label: '六角', a: [1, 0], b: [-0.5, S3] },
};

// [A as [a11, a12, a21, a22], t] in fractional coordinates
const I = [1, 0, 0, 1], NEG = [-1, 0, 0, -1], MX = [-1, 0, 0, 1], MY = [1, 0, 0, -1];
const R4 = [0, -1, 1, 0], R4i = [0, 1, -1, 0], SW = [0, 1, 1, 0], SWn = [0, -1, -1, 0];
const H3 = [0, -1, 1, -1], H3b = [-1, 1, -1, 0];
const op = (A, t = [0, 0]) => ({ A, t });
const centre = (ops) => [...ops, ...ops.map((o) => op(o.A, [o.t[0] + 0.5, o.t[1] + 0.5]))];
const p3 = [op(I), op(H3), op(H3b)];

export const WALLPAPER = {
  p1: { lattice: 'oblique', orbifold: 'o', ops: [op(I)], desc: '只有平移' },
  p2: { lattice: 'oblique', orbifold: '2222', ops: [op(I), op(NEG)], desc: '二重旋转中心' },
  pm: { lattice: 'rect', orbifold: '**', ops: [op(I), op(MX)], desc: '平行的镜面' },
  pg: { lattice: 'rect', orbifold: 'xx', ops: [op(I), op(MX, [0, 0.5])], desc: '平行的滑移反射，没有镜面' },
  cm: { lattice: 'centred', orbifold: '*x', ops: centre([op(I), op(MX)]), desc: '镜面与滑移线交替' },
  pmm: { lattice: 'rect', orbifold: '*2222', ops: [op(I), op(NEG), op(MX), op(MY)], desc: '两组互相垂直的镜面' },
  pmg: { lattice: 'rect', orbifold: '22*', ops: [op(I), op(NEG), op(MX, [0.5, 0]), op(MY, [0.5, 0])], desc: '一组镜面，加垂直的滑移' },
  pgg: { lattice: 'rect', orbifold: '22x', ops: [op(I), op(NEG), op(MX, [0.5, 0.5]), op(MY, [0.5, 0.5])], desc: '两组滑移反射，没有镜面' },
  cmm: { lattice: 'centred', orbifold: '2*22', ops: centre([op(I), op(NEG), op(MX), op(MY)]), desc: '两组垂直镜面，另有不在镜面上的二重中心' },
  p4: { lattice: 'square', orbifold: '442', ops: [op(I), op(NEG), op(R4), op(R4i)], desc: '四重旋转中心，没有镜面' },
  p4m: { lattice: 'square', orbifold: '*442', ops: [op(I), op(NEG), op(R4), op(R4i), op(MX), op(MY), op(SW), op(SWn)], desc: '正方形的全部对称：镜面过四重中心' },
  p4g: { lattice: 'square', orbifold: '4*2', ops: [op(I), op(NEG), op(R4), op(R4i), op(MX, [0.5, 0.5]), op(MY, [0.5, 0.5]), op(SW, [0.5, 0.5]), op(SWn, [0.5, 0.5])], desc: '镜面不经过四重中心' },
  p3: { lattice: 'hex', orbifold: '333', ops: p3, desc: '三重旋转中心，没有镜面' },
  p3m1: { lattice: 'hex', orbifold: '*333', ops: [...p3, op(SWn), op([-1, 1, 0, 1]), op([1, 0, 1, -1])], desc: '所有三重中心都在镜面上' },
  p31m: { lattice: 'hex', orbifold: '3*3', ops: [...p3, op(SW), op([1, -1, 0, -1]), op([-1, 0, -1, 1])], desc: '有的三重中心不在镜面上' },
  p6: { lattice: 'hex', orbifold: '632', ops: [...p3, op(NEG), op([0, 1, -1, 1]), op([1, -1, 1, 0])], desc: '六重旋转中心，没有镜面' },
  p6m: {
    lattice: 'hex', orbifold: '*632',
    ops: [...p3, op(NEG), op([0, 1, -1, 1]), op([1, -1, 1, 0]), op(SWn), op([-1, 1, 0, 1]), op([1, 0, 1, -1]), op(SW), op([1, -1, 0, -1]), op([-1, 0, -1, 1])],
    desc: '雪花与蜂巢：平面上最大的对称群',
  },
};

export const FRIEZE = {
  p1: { name: '跳跃', orbifold: '∞∞', ops: [op(I)], desc: '只有平移' },
  p11g: { name: '踏步', orbifold: '∞x', ops: [op(I), op(MY, [0.5, 0])], desc: '滑移反射，像脚印' },
  p1m1: { name: '侧行', orbifold: '*∞∞', ops: [op(I), op(MX)], desc: '竖直镜面' },
  p11m: { name: '跳步', orbifold: '∞*', ops: [op(I), op(MY)], desc: '水平镜面' },
  p2: { name: '旋转跳跃', orbifold: '22∞', ops: [op(I), op(NEG)], desc: '二重旋转中心' },
  p2mg: { name: '旋转侧行', orbifold: '2*∞', ops: [op(I), op(NEG), op(MX, [0.5, 0]), op(MY, [0.5, 0])], desc: '竖直镜面 + 滑移 + 二重中心' },
  p2mm: { name: '旋转跳步', orbifold: '*22∞', ops: [op(I), op(NEG), op(MX), op(MY)], desc: '竖直与水平镜面' },
};

/** Rosette group C_n (rotations) or D_n (rotations and n mirrors), as Cartesian maps. */
export function rosette(type, n) {
  const ops = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n, c = Math.cos(a), s = Math.sin(a);
    ops.push({ M: [c, -s, s, c], tau: [0, 0] });
    if (type === 'D') ops.push({ M: [c, s, s, -c], tau: [0, 0] }); // reflection in the line at angle a/2
  }
  return { periodic: 0, ops, L: [1, 0, 0, 1] };
}

const matMul = (P, Q) => [P[0] * Q[0] + P[1] * Q[2], P[0] * Q[1] + P[1] * Q[3], P[2] * Q[0] + P[3] * Q[2], P[2] * Q[1] + P[3] * Q[3]];
const matInv = (P) => { const d = P[0] * P[3] - P[1] * P[2]; return [P[3] / d, -P[1] / d, -P[2] / d, P[0] / d]; };
const apply = (P, v) => [P[0] * v[0] + P[1] * v[1], P[2] * v[0] + P[3] * v[1]];

/** Cartesian group: { periodic (0, 1 or 2 independent translations), L = [a b], ops: [{ M, tau }] }. */
export function group(kind, id, { n = 6, cell = 1 } = {}) {
  if (kind === 'rosette') return rosette(id, n);
  const spec = kind === 'frieze' ? FRIEZE[id] : WALLPAPER[id];
  const lat = kind === 'frieze' ? { a: [1, 0], b: [0, 1] } : LATTICES[spec.lattice];
  const L = [lat.a[0] * cell, lat.b[0] * cell, lat.a[1] * cell, lat.b[1] * cell];
  const Li = matInv(L);
  return {
    periodic: kind === 'frieze' ? 1 : 2,
    L,
    ops: spec.ops.map(({ A, t }) => ({ M: matMul(matMul(L, A), Li), tau: apply(L, t) })),
  };
}

/** Image of point p under op with lattice translation (k, l). */
export function image(g, o, p, k = 0, l = 0) {
  const q = apply(o.M, p);
  return [q[0] + o.tau[0] + k * g.L[0] + l * g.L[1], q[1] + o.tau[1] + k * g.L[2] + l * g.L[3]];
}

/** Identity of a line {p, u}: its direction mod π and its signed distance from the origin. */
function lineKey(v) {
  let ang = Math.atan2(v.u[1], v.u[0]);
  let sgn = 1;
  if (ang < -1e-9) { ang += Math.PI; sgn = -1; }
  if (ang >= Math.PI - 1e-9) { ang -= Math.PI; sgn = -sgn; }
  const dist = sgn * (v.p[0] * -v.u[1] + v.p[1] * v.u[0]);
  return `${Math.round(ang * 1e6)}|${Math.round(dist * 1e6)}`;
}

/**
 * Symmetry elements of a group inside the cell at the origin (for periodic groups; repeat them
 * by lattice translations): rotation centres { p, order }, mirror lines and glide lines
 * { p, u } (a point and a unit direction).
 */
export function elements(g) {
  const centres = [];
  const mirrors = [];
  const glides = [];
  const range = g.periodic === 0 ? [0] : [-2, -1, 0, 1, 2];
  const lRange = g.periodic === 2 ? range : [0];
  const Li = matInv(g.L);
  const inCell = (p) => {
    if (g.periodic === 0) return true;
    const f = apply(Li, p);
    const e = 1e-9;
    return f[0] >= -e && f[0] < 1 - e && (g.periodic === 1 ? true : f[1] >= -e && f[1] < 1 - e);
  };
  for (const o of g.ops) {
    const [m00, m01, m10, m11] = o.M;
    const det = m00 * m11 - m01 * m10;
    for (const k of range) {
      for (const l of lRange) {
        const s = [o.tau[0] + k * g.L[0] + l * g.L[1], o.tau[1] + k * g.L[2] + l * g.L[3]];
        if (det > 0) {
          const ang = Math.atan2(m10, m00);
          if (Math.abs(ang) < 1e-9) continue; // translation
          // fixed point: (I − M)c = s
          const a = 1 - m00, b = -m01, c2 = -m10, d = 1 - m11;
          const den = a * d - b * c2;
          const p = [(d * s[0] - b * s[1]) / den, (a * s[1] - c2 * s[0]) / den];
          if (!inCell(p)) continue;
          const order = Math.round((2 * Math.PI) / Math.abs(ang));
          const old = centres.find((q) => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < 1e-7);
          if (old) old.order = Math.max(old.order, order);
          else centres.push({ p, order });
        } else {
          // reflection in a line through the origin with direction u, then translation s
          const phi = Math.atan2(m10, m00);
          const u = [Math.cos(phi / 2), Math.sin(phi / 2)];
          const along = s[0] * u[0] + s[1] * u[1];
          const perp = [s[0] - along * u[0], s[1] - along * u[1]];
          const p = [perp[0] / 2, perp[1] / 2];
          const line = { p, u, glide: along };
          const list = Math.abs(along) < 1e-9 ? mirrors : glides;
          if (!list.some((v) => lineKey(v) === lineKey(line))) list.push(line);
        }
      }
    }
  }
  // a glide along a mirror line is just mirror + translation: keep it as a mirror only
  const mirrorKeys = new Set(mirrors.map(lineKey));
  return { centres, mirrors, glides: glides.filter((v) => !mirrorKeys.has(lineKey(v))) };
}

/** Closure check helper for tests: is the fractional op (A, t) in the list modulo the lattice? */
export function containsMod(ops, A, t) {
  return ops.some((o) => o.A.every((v, i) => Math.abs(v - A[i]) < 1e-12)
    && [0, 1].every((i) => { const d = o.t[i] - t[i]; return Math.abs(d - Math.round(d)) < 1e-12; }));
}

export { matMul, apply };
