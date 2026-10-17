// Path algorithms and search on the built graph (dist/data/graph.js; `npm run test:unit` builds first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { Graph } from '../../src/core/graph.js';
import { Search } from '../../src/core/search.js';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(resolve(ROOT, 'dist/data/graph.js'), 'utf8'), sandbox);
const G = new Graph(sandbox.window.STARMAP_GRAPH);
const S = new Search(G);
const idx = (id) => G.node(id).index;
const ids = (list) => list.map((i) => G.nodes[i].id);

test('learning path: target last, and every prerequisite before what needs it', () => {
  for (const id of ['clt', 'fourier-series', 'galois-theory', 'stokes-theorem', 'time-dilation', 'rsa']) {
    const order = G.learningPath(idx(id));
    assert.equal(order[order.length - 1], idx(id));
    const pos = new Map(order.map((u, k) => [u, k]));
    for (const u of order) for (const e of G.nodes[u].in) if (G.orders(e) && pos.has(e.s)) assert.ok(pos.get(e.s) < pos.get(u), `${G.nodes[e.s].id} must come before ${G.nodes[u].id}`);
    // closed under prerequisites
    for (const u of order) for (const e of G.nodes[u].in) if (G.orders(e)) assert.ok(pos.has(e.s), `${id}: missing ${G.nodes[e.s].id}`);
  }
});

test('school stars never wait for university stars', () => {
  for (const n of G.nodes.filter((x) => x.lv === 'hs')) {
    const order = G.learningPath(n.index);
    const deep = order.filter((u) => G.nodes[u].lv !== 'hs');
    assert.deepEqual(ids(deep), [], `${n.id} needs ${ids(deep)}`);
  }
});

test('skipping mastered stars keeps the target', () => {
  const all = G.learningPath(idx('clt'));
  const skip = (u) => u !== idx('clt');
  assert.deepEqual(G.learningPath(idx('clt'), { skip }), [idx('clt')]);
  assert.ok(all.length > 5);
});

test('route finds a chain of real relations', () => {
  const r = G.route(idx('vieta-theorem'), idx('quintic-insolvability'));
  assert.ok(r && r.nodes.length >= 3);
  assert.equal(r.nodes[0], idx('vieta-theorem'));
  assert.equal(r.nodes[r.nodes.length - 1], idx('quintic-insolvability'));
  r.steps.forEach((s, k) => {
    const [a, b] = [r.nodes[k], r.nodes[k + 1]];
    assert.ok((s.edge.s === a && s.edge.t === b) || (s.edge.s === b && s.edge.t === a));
  });
  assert.deepEqual(G.route(idx('set'), idx('set')).nodes, [idx('set')]);
});

test('frontier: stars whose prerequisites are all mastered', () => {
  const mastered = new Set(['set', 'function']);
  const front = G.frontier((id) => (mastered.has(id) ? 2 : 0), 50);
  assert.ok(front.length > 0);
  for (const u of front) {
    assert.ok(!mastered.has(G.nodes[u].id));
    for (const e of G.nodes[u].in) if (G.orders(e)) assert.ok(mastered.has(G.nodes[e.s].id));
  }
});

test('search: Chinese, pinyin, initials, English and aliases', () => {
  const top = (q) => G.nodes[S.query(q)[0].i].id;
  assert.equal(top('泰勒公式'), 'taylor-theorem');
  assert.equal(top('taile'), 'taylor-theorem');
  assert.equal(top('tlgs'), 'taylor-theorem');
  assert.equal(top('Fourier series'), 'fourier-series');
  assert.equal(top('rsa'), 'rsa');
  assert.ok(S.query('高斯分布').some((r) => G.nodes[r.i].id === 'normal-distribution'));
  assert.ok(['double-integral', 'triple-integral', 'change-of-variables', 'fubini'].includes(top('chongjifen')));
  assert.deepEqual(S.query(''), []);
});
