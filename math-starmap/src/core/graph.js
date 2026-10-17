// The knowledge graph in memory: stars, relations and the path algorithms behind
// 学习路径 (everything you need before a star, in a valid order), 知识航线 (shortest chain of
// relations between two stars) and 下一颗星 (stars whose prerequisites are all mastered).
// Pure data — no DOM — so the unit tests run it in Node.

import { RELATIONS, RELATION_ORDER, ORDER_RELATIONS } from '../config.js';
import { hslToRgb } from './util.js';

// cost of following one relation when searching for a route
const ROUTE_COST = { pre: 1, der: 1, gen: 1.2, eq: 0.8, app: 1.6, ex: 1.6, rel: 2.2 };

export class Graph {
  constructor(data) {
    this.galaxies = data.galaxies.map((g, k) => ({ ...g, index: k, rgb: hslToRgb(g.hue, 0.88, 0.7), rgbDeep: hslToRgb(g.hue, 0.8, 0.45) }));
    this.clusters = data.clusters.map((c, k) => ({ ...c, index: k, galaxy: this.galaxies[c.g], members: [] }));
    this.relTypes = data.relTypes || RELATION_ORDER;
    this.nodes = data.nodes.map((n, k) => ({
      ...n, index: k, galaxy: this.galaxies[n.g], cluster: this.clusters[n.c],
      r: 3 + n.w * 1.7, out: [], in: [], degree: 0,
    }));
    this.byId = new Map(this.nodes.map((n) => [n.id, n]));
    for (const n of this.nodes) n.cluster.members.push(n.index);
    this.edges = data.edges.map(([s, t, ty], k) => ({ s, t, type: this.relTypes[ty], index: k }));
    for (const e of this.edges) {
      this.nodes[e.s].out.push(e);
      this.nodes[e.t].in.push(e);
      this.nodes[e.s].degree++;
      this.nodes[e.t].degree++;
    }
    this.tours = (data.tours || []).map((t) => ({ ...t, steps: t.steps.map(([i, html]) => ({ i, html })) }));
    this.syllabus = data.syllabus;
    this.syllabusIndex = new Map();
    if (this.syllabus) {
      for (const g of this.syllabus.groups) for (const it of g.items) this.syllabusIndex.set(it.id, { ...it, group: g, nodes: [] });
      for (const n of this.nodes) for (const s of n.sy || []) this.syllabusIndex.get(s)?.nodes.push(n.index);
    }
  }

  node(idOrIndex) { return typeof idOrIndex === 'number' ? this.nodes[idOrIndex] : this.byId.get(idOrIndex); }

  /** Neighbour indices of i (any relation, optional type filter). */
  neighbors(i, types) {
    const n = this.nodes[i];
    const out = new Set();
    for (const e of n.out) if (!types || types[e.type]) out.add(e.t);
    for (const e of n.in) if (!types || types[e.type]) out.add(e.s);
    return [...out];
  }

  /** Relations of a star grouped for the card: [{ key, label, type, items: [index] }]. */
  relationGroups(i) {
    const n = this.nodes[i];
    const groups = new Map();
    const add = (type, dir, j) => {
      const R = RELATIONS[type];
      const symmetric = type === 'eq' || type === 'rel';
      const key = symmetric ? type : `${type}-${dir}`;
      const label = symmetric ? (type === 'eq' ? '等价表述' : '相关 / 类比') : dir === 'out' ? R.out : R.in;
      if (!groups.has(key)) groups.set(key, { key, type, dir, label, items: [] });
      groups.get(key).items.push(j);
    };
    for (const e of n.in) add(e.type, 'in', e.s);
    for (const e of n.out) add(e.type, 'out', e.t);
    const order = ['pre-in', 'der-in', 'gen-in', 'eq', 'gen-out', 'der-out', 'pre-out', 'app-in', 'app-out', 'ex-out', 'ex-in', 'rel'];
    return [...groups.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((g) => ({ ...g, items: g.items.sort((a, b) => this.nodes[b].w - this.nodes[a].w) }));
  }

  /** Every star you should learn before i (前置/推导 closure), in a valid learning order, ending with i. */
  learningPath(i, { skip } = {}) {
    const need = new Set([i]);
    const queue = [i];
    while (queue.length) {
      const u = queue.shift();
      for (const e of this.nodes[u].in) {
        if (!ORDER_RELATIONS.includes(e.type) || need.has(e.s)) continue;
        need.add(e.s);
        queue.push(e.s);
      }
    }
    // depth = longest chain of prerequisites below a star (inside the needed set)
    const depth = new Map();
    const dep = (u) => {
      if (depth.has(u)) return depth.get(u);
      depth.set(u, 0);
      let d = 0;
      for (const e of this.nodes[u].in) if (ORDER_RELATIONS.includes(e.type) && need.has(e.s)) d = Math.max(d, dep(e.s) + 1);
      depth.set(u, d);
      return d;
    };
    for (const u of need) dep(u);
    // Kahn's algorithm, preferring shallow stars, then the same galaxy as the goal, then heavier stars
    const indeg = new Map([...need].map((u) => [u, 0]));
    for (const u of need) for (const e of this.nodes[u].out) if (ORDER_RELATIONS.includes(e.type) && need.has(e.t)) indeg.set(e.t, indeg.get(e.t) + 1);
    const goalG = this.nodes[i].g;
    const key = (u) => depth.get(u) * 1000 + (this.nodes[u].g === goalG ? 0 : 100) - this.nodes[u].w * 10 + (this.nodes[u].c % 10);
    const ready = [...need].filter((u) => indeg.get(u) === 0);
    const order = [];
    while (ready.length) {
      ready.sort((a, b) => key(a) - key(b));
      const u = ready.shift();
      order.push(u);
      for (const e of this.nodes[u].out) {
        if (!ORDER_RELATIONS.includes(e.type) || !need.has(e.t)) continue;
        indeg.set(e.t, indeg.get(e.t) - 1);
        if (indeg.get(e.t) === 0) ready.push(e.t);
      }
    }
    return skip ? order.filter((u) => u === i || !skip(u)) : order;
  }

  /** Cheapest chain of relations from a to b (relations followed in either direction). */
  route(a, b, types) {
    if (a === b) return { nodes: [a], steps: [] };
    const N = this.nodes.length;
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const via = new Array(N);
    dist[a] = 0;
    // binary heap of [dist, node]
    const heap = [[0, a]];
    const push = (x) => { heap.push(x); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      if (u === b) break;
      const relax = (e, v, dir) => {
        if (types && !types[e.type]) return;
        const nd = d + ROUTE_COST[e.type] + (this.nodes[v].g !== this.nodes[u].g ? 0.4 : 0);
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; via[v] = { edge: e, dir }; push([nd, v]); }
      };
      for (const e of this.nodes[u].out) relax(e, e.t, 'out');
      for (const e of this.nodes[u].in) relax(e, e.s, 'in');
    }
    if (!isFinite(dist[b])) return null;
    const nodes = [];
    const steps = [];
    for (let v = b; v !== -1; v = prev[v]) { nodes.unshift(v); if (prev[v] !== -1) steps.unshift(via[v]); }
    return { nodes, steps, cost: dist[b] };
  }

  /** Stars that are not mastered yet but whose prerequisites all are: the natural next things to learn. */
  frontier(status, limit = 12) {
    const out = [];
    for (const n of this.nodes) {
      if (status(n.id) === 2) continue;
      const pre = n.in.filter((e) => ORDER_RELATIONS.includes(e.type));
      if (!pre.length) continue;
      if (pre.every((e) => status(this.nodes[e.s].id) === 2)) out.push(n);
    }
    // stars that open many doors first
    out.sort((a, b) => b.out.length + b.w * 2 - (a.out.length + a.w * 2));
    return out.slice(0, limit).map((n) => n.index);
  }

  /** Starting points: stars with no prerequisites, heaviest first. */
  roots(g) {
    return this.nodes.filter((n) => (g == null || n.g === g) && !n.in.some((e) => ORDER_RELATIONS.includes(e.type)))
      .sort((a, b) => b.w - a.w || b.out.length - a.out.length).map((n) => n.index);
  }

  stats(status) {
    const per = this.galaxies.map(() => ({ total: 0, learning: 0, mastered: 0 }));
    for (const n of this.nodes) {
      const p = per[n.g];
      p.total++;
      const s = status(n.id);
      if (s === 1) p.learning++;
      if (s === 2) p.mastered++;
    }
    const all = per.reduce((a, p) => ({ total: a.total + p.total, learning: a.learning + p.learning, mastered: a.mastered + p.mastered }), { total: 0, learning: 0, mastered: 0 });
    return { per, all };
  }
}

