import test from 'node:test';
import assert from 'node:assert/strict';
import { Life, parseRule, parseRLE, PATTERNS, elementary } from '../../src/core/life.js';

const cellsOf = (life) => {
  const out = [];
  for (let y = 0; y < life.h; y++) for (let x = 0; x < life.w; x++) if (life.get(x, y)) out.push([x, y]);
  return out;
};

test('rules and RLE', () => {
  const r = parseRule('b36/s23');
  assert.equal(r.text, 'B36/S23');
  assert.deepEqual([...r.born], [0, 0, 0, 1, 0, 0, 1, 0, 0]);
  assert.equal(parseRule('23/3').text, 'B3/S23');
  assert.throws(() => parseRule('hello'));
  assert.deepEqual(parseRLE('bob$2bo$3o!').cells, [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]);
  const pulsar = parseRLE(PATTERNS.pulsar.rle);
  assert.equal(pulsar.cells.length, 48);
  assert.equal(pulsar.h, 13);
});

test('blinker oscillates, glider moves one cell diagonally every 4 generations', () => {
  const life = new Life(20, 20);
  life.place('3o!', 10, 10);
  life.step();
  assert.deepEqual(cellsOf(life), [[10, 9], [10, 10], [10, 11]]);
  life.step();
  assert.deepEqual(cellsOf(life), [[9, 10], [10, 10], [11, 10]]);
  const g = new Life(30, 30);
  g.place(PATTERNS.glider.rle, 10, 10);
  const before = cellsOf(g);
  for (let k = 0; k < 4; k++) g.step();
  assert.deepEqual(cellsOf(g), before.map(([x, y]) => [x + 1, y + 1]));
  // on a torus it comes back after 4·30 generations
  for (let k = 0; k < 116; k++) g.step();
  assert.deepEqual(cellsOf(g), before);
});

test('oscillator periods and cycle detection', () => {
  for (const [id, period] of [['pulsar', 3], ['penta', 15]]) {
    const life = new Life(40, 40);
    life.place(PATTERNS[id].rle, 20, 20);
    const start = cellsOf(life);
    for (let k = 0; k < period; k++) life.step();
    assert.deepEqual(cellsOf(life), start, id);
    assert.equal(life.cycle.period, period, id);
  }
});

test('Gosper gun fires a glider every 30 generations; diehard dies at 130', () => {
  const gun = new Life(120, 80);
  gun.place(PATTERNS.gun.rle, 30, 20);
  const p0 = gun.population();
  for (let k = 0; k < 30; k++) gun.step();
  assert.equal(gun.population(), p0 + 5);
  for (let k = 0; k < 30; k++) gun.step();
  assert.equal(gun.population(), p0 + 10);
  const dh = new Life(100, 100);
  dh.place(PATTERNS.diehard.rle, 50, 50);
  for (let k = 0; k < 129; k++) dh.step();
  assert.ok(dh.population() > 0);
  dh.step();
  assert.equal(dh.population(), 0);
});

test('elementary rules: 90 is Pascal mod 2, 30 has its famous centre column', () => {
  const W = 129;
  const r90 = elementary(90, W, 64);
  for (let n = 0; n < 64; n++) {
    let count = 0;
    for (let x = 0; x < W; x++) count += r90[n * W + x];
    assert.equal(count, 2 ** n.toString(2).split('').filter((b) => b === '1').length, `row ${n}`);
  }
  const r30 = elementary(30, 401, 20);
  const centre = Array.from({ length: 20 }, (_, g) => r30[g * 401 + 200]);
  assert.deepEqual(centre.slice(0, 16), [1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1]);
});
