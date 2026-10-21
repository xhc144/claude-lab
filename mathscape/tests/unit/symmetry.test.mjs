import test from 'node:test';
import assert from 'node:assert/strict';
import { WALLPAPER, FRIEZE, group, elements, containsMod, rosette } from '../../src/core/symmetry.js';

const fracCompose = (o1, o2) => {
  const [a, b, c, d] = o1.A, [e, f, g, h] = o2.A;
  return { A: [a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h], t: [a * o2.t[0] + b * o2.t[1] + o1.t[0], c * o2.t[0] + d * o2.t[1] + o1.t[1]] };
};

test('all 17 wallpaper and 7 frieze groups are closed modulo the lattice', () => {
  for (const [id, g] of [...Object.entries(WALLPAPER), ...Object.entries(FRIEZE).map(([k, v]) => [`frieze ${k}`, v])]) {
    for (const o1 of g.ops) for (const o2 of g.ops) {
      const c = fracCompose(o1, o2);
      assert.ok(containsMod(g.ops, c.A, c.t), `${id} not closed`);
    }
  }
  const order = { p1: 1, p2: 2, pm: 2, pg: 2, cm: 4, pmm: 4, pmg: 4, pgg: 4, cmm: 8, p4: 4, p4m: 8, p4g: 8, p3: 3, p3m1: 6, p31m: 6, p6: 6, p6m: 12 };
  assert.equal(Object.keys(WALLPAPER).length, 17);
  for (const [id, n] of Object.entries(order)) assert.equal(WALLPAPER[id].ops.length, n, id);
  assert.equal(Object.keys(FRIEZE).length, 7);
});

test('every operation is an isometry on its lattice', () => {
  for (const id of Object.keys(WALLPAPER)) {
    const g = group('wallpaper', id, { cell: 1.7 });
    for (const { M } of g.ops) {
      const [a, b, c, d] = M;
      assert.ok(Math.abs(a * a + c * c - 1) < 1e-12 && Math.abs(b * b + d * d - 1) < 1e-12 && Math.abs(a * b + c * d) < 1e-12, id);
    }
  }
});

const summary = (g) => {
  const e = elements(g);
  return { orders: [...new Set(e.centres.map((c) => c.order))].sort((x, y) => x - y), mirrors: e.mirrors.length > 0, glides: e.glides.length > 0 };
};

test('symmetry elements come out right', () => {
  const W = (id) => summary(group('wallpaper', id));
  assert.deepEqual(W('p1'), { orders: [], mirrors: false, glides: false });
  assert.deepEqual(W('p2').orders, [2]);
  assert.deepEqual(W('pm'), { orders: [], mirrors: true, glides: false });
  assert.deepEqual(W('pg'), { orders: [], mirrors: false, glides: true });
  assert.deepEqual(W('cm'), { orders: [], mirrors: true, glides: true });
  assert.deepEqual(W('pgg'), { orders: [2], mirrors: false, glides: true });
  assert.deepEqual(W('p4'), { orders: [2, 4], mirrors: false, glides: false });
  assert.deepEqual(W('p4g'), { orders: [2, 4], mirrors: true, glides: true });
  assert.deepEqual(W('p3'), { orders: [3], mirrors: false, glides: false });
  assert.deepEqual(W('p6'), { orders: [2, 3, 6], mirrors: false, glides: false });
  assert.deepEqual(W('p6m'), { orders: [2, 3, 6], mirrors: true, glides: true });
  // p4: two 4-fold centres and two 2-fold centres per cell
  const p4 = elements(group('wallpaper', 'p4'));
  assert.equal(p4.centres.filter((c) => c.order === 4).length, 2);
  assert.equal(p4.centres.filter((c) => c.order === 2).length, 2);
  // p31m has a 3-fold centre off the mirrors, p3m1 does not
  const offMirror = (id) => {
    const e = elements(group('wallpaper', id));
    return e.centres.filter((c) => c.order === 3).some((c) => e.mirrors.every((m) => Math.abs((c.p[0] - m.p[0]) * -m.u[1] + (c.p[1] - m.p[1]) * m.u[0]) > 1e-6));
  };
  assert.equal(offMirror('p31m'), true);
  assert.equal(offMirror('p3m1'), false);
  // frieze p11g: a glide and nothing else; rosette D5: five mirrors through a 5-fold centre
  assert.deepEqual(summary(group('frieze', 'p11g')), { orders: [], mirrors: false, glides: true });
  const d5 = elements(rosette('D', 5));
  assert.equal(d5.mirrors.length, 5);
  assert.deepEqual(d5.centres.map((c) => c.order), [5]);
  assert.equal(elements(rosette('C', 7)).mirrors.length, 0);
});
