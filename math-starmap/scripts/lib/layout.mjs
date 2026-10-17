// Build-time layout of the universe. Deterministic: the same knowledge base gives the same map.
//
// 1. 高中数学 sits at the centre; the other galaxies form a ring around it.
// 2. Inside a galaxy, topic clusters are placed on a sunflower spiral in curriculum order, so the
//    foundations sit in the core and the advanced / extension topics in the outer arms.
// 3. A force simulation (springs along relations, Barnes–Hut repulsion, pull towards the cluster
//    anchor, collision) settles the stars so that related ideas end up next to each other.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export const SPACING = 50;

function radiusOf(n) { return SPACING * Math.sqrt(n) * 1.02 + 140; }

/**
 * @param galaxies  [{ id }]  (first one is placed at the centre)
 * @param clusters  [{ id, galaxy, order }]
 * @param nodes     [{ id, galaxy, cluster, weight }]
 * @param edges     [{ s, t }]
 * @returns { pos: Map(id → [x, y]), galaxies: Map(id → {x, y, r}), clusters: Map(id → {x, y, r}) }
 */
export function layout({ galaxies, clusters, nodes, edges, iterations = 520, seed = 20270820 }) {
  const rand = mulberry32(seed);
  const N = nodes.length;
  const count = new Map(galaxies.map((g) => [g.id, 0]));
  for (const n of nodes) count.set(n.galaxy, count.get(n.galaxy) + 1);

  // galaxy centres
  const gal = new Map();
  const [centre, ...ring] = galaxies;
  const rCentre = radiusOf(count.get(centre.id) || 1);
  const rRingMax = Math.max(...ring.map((g) => radiusOf(count.get(g.id) || 1)));
  const R = rCentre + rRingMax + 420;
  gal.set(centre.id, { x: 0, y: 0, r: rCentre, rot: rand() * Math.PI * 2 });
  ring.forEach((g, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / ring.length + (rand() - 0.5) * 0.12;
    const rr = R * (0.96 + rand() * 0.08);
    gal.set(g.id, { x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: radiusOf(count.get(g.id) || 1), rot: rand() * Math.PI * 2 });
  });

  // cluster anchors: area-proportional sunflower inside each galaxy
  const anchor = new Map();
  for (const g of galaxies) {
    const cs = clusters.filter((c) => c.galaxy === g.id).sort((a, b) => a.order - b.order || a.index - b.index);
    const sizes = cs.map((c) => nodes.filter((n) => n.cluster === c.id).length);
    const total = sizes.reduce((a, b) => a + b, 0) || 1;
    const G = gal.get(g.id);
    let acc = 0;
    cs.forEach((c, k) => {
      const f = (acc + sizes[k] / 2) / total;
      acc += sizes[k];
      const rho = G.r * 0.86 * Math.sqrt(f);
      const a = G.rot + k * GOLDEN;
      anchor.set(c.id, { x: G.x + Math.cos(a) * rho, y: G.y + Math.sin(a) * rho, n: sizes[k] });
    });
  }

  // initial positions
  const idx = new Map(nodes.map((n, k) => [n.id, k]));
  const X = new Float64Array(N), Y = new Float64Array(N), VX = new Float64Array(N), VY = new Float64Array(N);
  const rad = new Float64Array(N);
  nodes.forEach((n, k) => {
    const A = anchor.get(n.cluster);
    const spread = SPACING * Math.sqrt(A.n) * 0.55;
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * spread;
    X[k] = A.x + Math.cos(a) * r;
    Y[k] = A.y + Math.sin(a) * r;
    rad[k] = 15 + n.weight * 4.5;
  });

  // springs: only inside a galaxy (cross-galaxy relations are drawn as long arcs instead)
  const links = [];
  const deg = new Float64Array(N);
  for (const e of edges) {
    const s = idx.get(e.s), t = idx.get(e.t);
    if (s == null || t == null) continue;
    if (nodes[s].galaxy !== nodes[t].galaxy) continue;
    const same = nodes[s].cluster === nodes[t].cluster;
    links.push([s, t, same ? SPACING * 1.35 : SPACING * 2.6, same ? 0.42 : 0.06]);
    deg[s]++; deg[t]++;
  }

  const alphaMin = 0.002;
  const decay = 1 - Math.pow(alphaMin, 1 / iterations);
  let alpha = 1;
  const strength = -SPACING * SPACING * 1.1;
  const distMax2 = (SPACING * 9) ** 2;
  for (let it = 0; it < iterations; it++) {
    alpha += (0 - alpha) * decay;
    // links
    for (const [s, t, L, k] of links) {
      let dx = X[t] + VX[t] - X[s] - VX[s], dy = Y[t] + VY[t] - Y[s] - VY[s];
      let l = Math.hypot(dx, dy) || 1e-6;
      const f = ((l - L) / l) * alpha * k;
      dx *= f; dy *= f;
      const bs = deg[s] / (deg[s] + deg[t]);
      VX[t] -= dx * bs; VY[t] -= dy * bs;
      VX[s] += dx * (1 - bs); VY[s] += dy * (1 - bs);
    }
    // repulsion (Barnes–Hut)
    const tree = buildTree(X, Y, N);
    for (let k = 0; k < N; k++) applyRepulsion(tree, k, X, Y, VX, VY, strength * alpha, distMax2);
    // pull towards the cluster anchor, and keep each galaxy round
    for (let k = 0; k < N; k++) {
      const n = nodes[k];
      const A = anchor.get(n.cluster);
      VX[k] += (A.x - X[k]) * 0.05 * alpha;
      VY[k] += (A.y - Y[k]) * 0.05 * alpha;
      const G = gal.get(n.galaxy);
      const dx = X[k] - G.x, dy = Y[k] - G.y, d = Math.hypot(dx, dy);
      if (d > G.r) { VX[k] -= (dx / d) * (d - G.r) * 0.2; VY[k] -= (dy / d) * (d - G.r) * 0.2; }
    }
    for (let k = 0; k < N; k++) { VX[k] *= 0.58; VY[k] *= 0.58; X[k] += VX[k]; Y[k] += VY[k]; }
    collide(X, Y, rad, N, it < iterations * 0.7 ? 0.5 : 0.9);
  }

  const pos = new Map(nodes.map((n, k) => [n.id, [Math.round(X[k] * 10) / 10, Math.round(Y[k] * 10) / 10]]));
  // final cluster and galaxy extents
  const clusterOut = new Map();
  for (const c of clusters) {
    const pts = nodes.map((n, k) => (n.cluster === c.id ? k : -1)).filter((k) => k >= 0);
    if (!pts.length) continue;
    const cx = pts.reduce((a, k) => a + X[k], 0) / pts.length, cy = pts.reduce((a, k) => a + Y[k], 0) / pts.length;
    const ds = pts.map((k) => Math.hypot(X[k] - cx, Y[k] - cy)).sort((a, b) => a - b);
    clusterOut.set(c.id, { x: round(cx), y: round(cy), r: round(ds[Math.floor(ds.length * 0.85)] + 60) });
  }
  const galaxyOut = new Map();
  for (const g of galaxies) {
    const G = gal.get(g.id);
    const pts = nodes.map((n, k) => (n.galaxy === g.id ? k : -1)).filter((k) => k >= 0);
    const r = pts.length ? Math.max(...pts.map((k) => Math.hypot(X[k] - G.x, Y[k] - G.y))) + 90 : G.r;
    galaxyOut.set(g.id, { x: round(G.x), y: round(G.y), r: round(r) });
  }
  return { pos, galaxies: galaxyOut, clusters: clusterOut };
}

const round = (v) => Math.round(v);

function buildTree(X, Y, N) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let k = 0; k < N; k++) { minX = Math.min(minX, X[k]); maxX = Math.max(maxX, X[k]); minY = Math.min(minY, Y[k]); maxY = Math.max(maxY, Y[k]); }
  const size = Math.max(maxX - minX, maxY - minY) + 1;
  const root = { x0: minX, y0: minY, s: size, m: 0, cx: 0, cy: 0, kids: null, pt: -1 };
  for (let k = 0; k < N; k++) insert(root, k, X, Y, 0);
  finalize(root, X, Y);
  return root;
}
function insert(node, k, X, Y, depth) {
  if (node.kids === null && node.pt < 0 && node.m === 0) { node.pt = k; node.m = 1; return; }
  if (node.kids === null) {
    if (depth > 40) { node.m++; (node.extra ||= []).push(k); return; }
    node.kids = [null, null, null, null];
    const old = node.pt; node.pt = -1; node.m = 0;
    insert(node, old, X, Y, depth);
  }
  node.m++;
  const h = node.s / 2;
  const q = (X[k] >= node.x0 + h ? 1 : 0) + (Y[k] >= node.y0 + h ? 2 : 0);
  if (!node.kids[q]) node.kids[q] = { x0: node.x0 + (q & 1 ? h : 0), y0: node.y0 + (q & 2 ? h : 0), s: h, m: 0, cx: 0, cy: 0, kids: null, pt: -1 };
  insert(node.kids[q], k, X, Y, depth + 1);
}
function finalize(node, X, Y) {
  if (node.kids === null) {
    const pts = [node.pt, ...(node.extra || [])].filter((k) => k >= 0);
    node.m = pts.length;
    node.cx = pts.reduce((a, k) => a + X[k], 0) / (pts.length || 1);
    node.cy = pts.reduce((a, k) => a + Y[k], 0) / (pts.length || 1);
    return;
  }
  let m = 0, cx = 0, cy = 0;
  for (const c of node.kids) if (c) { finalize(c, X, Y); m += c.m; cx += c.cx * c.m; cy += c.cy * c.m; }
  node.m = m; node.cx = cx / m; node.cy = cy / m;
}
function applyRepulsion(node, k, X, Y, VX, VY, str, distMax2) {
  if (!node || node.m === 0) return;
  const dx = node.cx - X[k], dy = node.cy - Y[k];
  let l2 = dx * dx + dy * dy;
  if (node.kids === null || (node.s * node.s) / (l2 || 1e-9) < 0.81) {
    if (node.kids === null && node.pt === k && node.m === 1) return;
    if (l2 > distMax2) return;
    if (l2 < 1) l2 = 1;
    const m = node.kids === null && node.pt === k ? node.m - 1 : node.m;
    VX[k] += (dx * str * m) / l2;
    VY[k] += (dy * str * m) / l2;
    return;
  }
  for (const c of node.kids) applyRepulsion(c, k, X, Y, VX, VY, str, distMax2);
}

function collide(X, Y, rad, N, strength) {
  const cell = 80;
  const grid = new Map();
  for (let k = 0; k < N; k++) {
    const key = `${Math.floor(X[k] / cell)},${Math.floor(Y[k] / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(k);
  }
  for (let k = 0; k < N; k++) {
    const gx = Math.floor(X[k] / cell), gy = Math.floor(Y[k] / cell);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const list = grid.get(`${gx + ox},${gy + oy}`);
      if (!list) continue;
      for (const j of list) {
        if (j <= k) continue;
        const dx = X[j] - X[k], dy = Y[j] - Y[k];
        const min = rad[j] + rad[k];
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = ((min - d) / d) * 0.5 * strength;
        X[j] += dx * push; Y[j] += dy * push;
        X[k] -= dx * push; Y[k] -= dy * push;
      }
    }
  }
}
