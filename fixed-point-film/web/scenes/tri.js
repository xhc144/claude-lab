// Triangulated triangle shared by the Sperner and Brouwer scenes.
export const A = [300, 800], B = [1120, 800], CC = [710, 800 - 820 * Math.sqrt(3) / 2];

export function grid(n) {
  const id = (i, j) => j * (n + 1) + i;
  const verts = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i + j <= n; i++) {
    verts[id(i, j)] = {
      i, j, id: id(i, j),
      x: A[0] + (i / n) * (B[0] - A[0]) + (j / n) * (CC[0] - A[0]),
      y: A[1] + (i / n) * (B[1] - A[1]) + (j / n) * (CC[1] - A[1]),
      bary: [(n - i - j) / n, i / n, j / n],
    };
  }
  const tris = [];
  for (let j = 0; j < n; j++) for (let i = 0; i + j < n; i++) {
    tris.push([id(i, j), id(i + 1, j), id(i, j + 1)]);
    if (i + j < n - 1) tris.push([id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
  }
  const edges = new Map();
  tris.forEach((tr, k) => {
    for (let e = 0; e < 3; e++) {
      const a = tr[e], b = tr[(e + 1) % 3];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edges.has(key)) edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), tris: [] });
      edges.get(key).tris.push(k);
    }
  });
  return { n, id, verts, tris, edges };
}

export const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function isRainbow(g, colors, k) {
  const s = new Set(g.tris[k].map((v) => colors[v]));
  return s.size === 3;
}

export function isDoor(colors, a, b) {
  const ca = colors[a], cb = colors[b];
  return (ca === 0 && cb === 1) || (ca === 1 && cb === 0);
}

/** Walk from a boundary door; returns {rooms, doors, end: 'rainbow'|'exit'}. */
export function walk(g, colors, startKey) {
  const rooms = [], doors = [startKey];
  let tri = g.edges.get(startKey).tris[0];
  let enter = startKey;
  for (let guard = 0; guard < 10000; guard++) {
    rooms.push(tri);
    if (isRainbow(g, colors, tri)) return { rooms, doors, end: 'rainbow' };
    const tr = g.tris[tri];
    let next = null;
    for (let e = 0; e < 3; e++) {
      const a = tr[e], b = tr[(e + 1) % 3], key = edgeKey(a, b);
      if (key !== enter && isDoor(colors, a, b)) next = key;
    }
    doors.push(next);
    const other = g.edges.get(next).tris.filter((k) => k !== tri);
    if (!other.length) return { rooms, doors, end: 'exit' };
    enter = next;
    tri = other[0];
  }
  throw new Error('walk did not terminate');
}

export const centroid = (g, k) => {
  const [a, b, c] = g.tris[k].map((v) => g.verts[v]);
  return [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3];
};
export const mid = (g, key) => {
  const e = g.edges.get(key);
  const a = g.verts[e.a], b = g.verts[e.b];
  return [(a.x + b.x) / 2, (a.y + b.y) / 2];
};
