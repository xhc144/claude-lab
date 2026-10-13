import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG, Noise, hashString, hash3 } from '../../src/core/noise.js';
import { rleEncode, rleDecode } from '../../src/save/storage.js';
import { Inventory } from '../../src/entity/inventory.js';
import { I, ITEMS, maxStack, breakTime, canHarvest } from '../../src/world/items.js';
import { B } from '../../src/world/blocks.js';

test('hashing and RNG are deterministic and in range', () => {
  assert.equal(hashString('echowild'), hashString('echowild'));
  assert.notEqual(hash3(1, 2, 3, 7), hash3(1, 2, 3, 8));
  const a = new RNG(42), b = new RNG(42);
  for (let i = 0; i < 1000; i++) {
    const x = a.next();
    assert.equal(x, b.next());
    assert.ok(x >= 0 && x < 1);
  }
  const r = new RNG(7);
  for (let i = 0; i < 500; i++) { const k = r.int(5); assert.ok(Number.isInteger(k) && k >= 0 && k < 5); }
});

test('noise is smooth and bounded', () => {
  const n = new Noise(123);
  let prev = n.noise2(0, 0);
  for (let i = 1; i < 200; i++) {
    const v = n.noise2(i * 0.01, 0);
    assert.ok(Math.abs(v) <= 1.0001);
    assert.ok(Math.abs(v - prev) < 0.1, 'adjacent samples should be close');
    prev = v;
  }
});

test('chunk RLE round-trips', () => {
  const arr = new Uint16Array(65536);
  for (let i = 0; i < 65536; i++) arr[i] = i < 20000 ? 1 : i % 97 === 0 ? (i & 1023) : 0;
  const enc = rleEncode(arr);
  const dec = rleDecode(enc, 65536);
  assert.deepEqual(Array.from(dec), Array.from(arr));
  assert.ok(enc.length < arr.length / 4, 'mostly-uniform chunks compress well');
});

test('inventory stacks, overflows and removes', () => {
  const inv = new Inventory();
  const max = maxStack(I.cobblestone);
  assert.equal(inv.add(I.cobblestone, max + 10), 0);
  assert.equal(inv.count(I.cobblestone), max + 10);
  assert.equal(inv.slots[0].n, max);
  assert.equal(inv.slots[1].n, 10);
  inv.remove(I.cobblestone, max);
  assert.equal(inv.count(I.cobblestone), 10);
  // unstackable gear goes one per slot
  assert.equal(maxStack(I.glider), 1);
  inv.add(I.glider, 2);
  assert.equal(inv.slots.filter((s) => s && s.id === I.glider).length, 2);
  // a full inventory reports leftovers
  const full = new Inventory();
  const left = full.add(I.dirt, 64 * 41);
  assert.ok(left > 0);
});

test('tools: tiers gate harvesting and speed up mining', () => {
  const pick = (t) => ({ id: I[`${t}_pickaxe`], n: 1 });
  assert.ok(!canHarvest(B.iron_ore, null));
  assert.ok(!canHarvest(B.iron_ore, pick('wood')));
  assert.ok(canHarvest(B.iron_ore, pick('stone')));
  assert.ok(breakTime(B.stone, pick('iron')) < breakTime(B.stone, pick('wood')));
  assert.ok(breakTime(B.stone, null) > breakTime(B.stone, pick('wood')));
  for (const d of ITEMS) if (d) assert.ok(d.zh && d.zh.length, `item ${d.name} has a name`);
});
