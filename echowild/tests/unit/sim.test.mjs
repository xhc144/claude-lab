// Block simulation on a headless flat world: light, resonance circuits, fluids, pistons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, makeGame, GROUND } from './harness.mjs';
import { B, ID_MASK, ID_BITS, pack } from '../../src/world/blocks.js';
import { installCircuits } from '../../src/systems/circuits.js';
import { installFluids } from '../../src/systems/fluids.js';
import { installMachines } from '../../src/systems/machines.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const sky = (w, x, y, z) => w.getLight(x, y, z) & 15;
const blockR = (w, x, y, z) => (w.getLight(x, y, z) >> 4) & 15;
const Y = GROUND; // first air layer
async function run(g, n) { for (let i = 0; i < n; i++) { g.tick(); if (i % 4 === 0) await flush(); } await flush(); }

test('sky light fills open air and is blocked by roofs', () => {
  const w = makeWorld(1);
  assert.equal(sky(w, 3, Y, 3), 15);
  assert.equal(sky(w, 3, Y - 1, 3), 0, 'inside stone');
  // a 5×5 roof two blocks up darkens the centre underneath
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) w.setBlock(dx, Y + 2, dz, B.stone);
  assert.ok(sky(w, 0, Y, 0) < 15, 'shade under the roof');
  assert.ok(sky(w, 0, Y, 0) >= 12, 'light still leaks in from the open sides');
  // removing it restores full sky light
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) w.setBlock(dx, Y + 2, dz, 0);
  assert.equal(sky(w, 0, Y, 0), 15);
});

test('block light spreads from a torch and falls off by one per block', () => {
  const w = makeWorld(1);
  w.setBlock(0, Y, 0, B.torch);
  const at0 = blockR(w, 0, Y, 0);
  assert.ok(at0 >= 12, `torch emits (${at0})`);
  for (let d = 1; d < 6; d++) assert.equal(blockR(w, d, Y, 0), at0 - d, `distance ${d}`);
  // a wall cuts the light off behind it
  for (let y = Y; y < Y + 4; y++) for (let z = -6; z <= 6; z++) w.setBlock(3, y, z, B.stone);
  assert.ok(blockR(w, 4, Y, 0) < at0 - 4, 'light has to go around the wall');
  w.setBlock(0, Y, 0, 0);
  assert.equal(blockR(w, 1, Y, 0), 0, 'light removed with the torch');
});

test('a lever drives a wire line that weakens by one per block and lights a lamp', async () => {
  const g = makeGame(makeWorld(2));
  installCircuits(g);
  const w = g.world, C = g.circuits;
  w.setBlock(0, Y, 0, pack(B.lever, 3)); // floor lever
  for (let x = 1; x <= 16; x++) w.setBlock(x, Y, 0, B.wire);
  w.setBlock(6, Y, 1, B.crystal_lamp);
  w.setBlock(16, Y, 1, B.crystal_lamp);
  await run(g, 6);
  const lvl = (x) => w.getMeta(x, Y, 0) & 15;
  assert.equal(lvl(1), 0);
  C.toggleLever(0, Y, 0);
  await run(g, 8);
  for (let x = 1; x <= 16; x++) assert.equal(lvl(x), Math.max(0, 16 - x), `wire ${x}`);
  assert.equal(w.getMeta(6, Y, 1) & 1, 1, 'near lamp lit');
  assert.equal(w.getMeta(16, Y, 1) & 1, 0, 'far lamp out of range');
  assert.ok(blockR(w, 6, Y, 2) > 0 || ((w.getLight(6, Y, 2) >> 8) & 15) > 0 || ((w.getLight(6, Y, 2) >> 12) & 15) > 0, 'lit lamp emits light');
  C.toggleLever(0, Y, 0);
  await run(g, 8);
  for (let x = 1; x <= 16; x++) assert.equal(lvl(x), 0);
  assert.equal(w.getMeta(6, Y, 1) & 1, 0, 'lamp off again');
});

test('an inverter turns off when the block it stands on is powered', async () => {
  const g = makeGame(makeWorld(1));
  installCircuits(g);
  const w = g.world;
  w.setBlock(0, Y, 0, pack(B.inverter, 0));
  for (let x = 1; x <= 4; x++) w.setBlock(x, Y, 0, B.wire);
  await run(g, 10);
  assert.equal(w.getMeta(1, Y, 0) & 15, 15, 'inverter on by default');
  w.setBlock(0, Y - 1, 1, B.power_block); // powers the stone under the inverter
  await run(g, 10);
  assert.equal(w.getMeta(0, Y, 0) & 8, 8, 'inverter off');
  assert.equal(w.getMeta(1, Y, 0) & 15, 0);
  w.setBlock(0, Y - 1, 1, B.stone);
  await run(g, 10);
  assert.equal(w.getMeta(1, Y, 0) & 15, 15, 'back on');
});

test('repeaters delay the signal by their setting', async () => {
  async function delayFor(setting) {
    const g = makeGame(makeWorld(1));
    installCircuits(g);
    const w = g.world;
    w.setBlock(0, Y, 0, pack(B.lever, 3));
    w.setBlock(1, Y, 0, B.wire);
    w.setBlock(2, Y, 0, pack(B.repeater, 3 | ((setting - 1) << 2))); // facing east
    w.setBlock(3, Y, 0, B.wire);
    await run(g, 20); // let placement ticks settle
    g.circuits.toggleLever(0, Y, 0);
    for (let t = 1; t < 60; t++) { g.tick(); await flush(); if ((w.getMeta(3, Y, 0) & 15) > 0) return t; }
    return Infinity;
  }
  const d1 = await delayFor(1), d4 = await delayFor(4);
  assert.ok(Number.isFinite(d1) && Number.isFinite(d4), 'signal passes');
  assert.ok(d4 > d1 + 4, `longer delay (${d1} vs ${d4})`);
});

test('water spreads seven blocks across flat ground and makes infinite sources', async () => {
  const g = makeGame(makeWorld(1));
  installFluids(g);
  const w = g.world;
  w.setBlock(0, Y, 0, B.water);
  await run(g, 120);
  const isWater = (x, z) => (w.getBlock(x, Y, z) & ID_MASK) === B.water;
  for (let d = 0; d <= 7; d++) assert.ok(isWater(d, 0), `water at ${d}`);
  assert.equal((w.getBlock(3, Y, 0) >>> ID_BITS) & 7, 3, 'level grows with distance');
  assert.ok(!isWater(8, 0), 'stops after seven');
  // two sources fill the gap between them with a new source
  const g2 = makeGame(makeWorld(1));
  installFluids(g2);
  const w2 = g2.world;
  for (let x = -2; x <= 2; x++) { w2.setBlock(x, Y, -1, B.stone); w2.setBlock(x, Y, 1, B.stone); }
  w2.setBlock(-1, Y, 0, B.water); w2.setBlock(1, Y, 0, B.water);
  await run(g2, 60);
  const mid = w2.getBlock(0, Y, 0);
  assert.equal(mid & ID_MASK, B.water);
  assert.equal((mid >>> ID_BITS) & 7, 0, 'gap becomes a source');
});

test('lava meeting water turns to stone', async () => {
  const g = makeGame(makeWorld(1));
  installFluids(g);
  const w = g.world;
  w.setBlock(0, Y, 0, B.lava);
  w.setBlock(3, Y, 0, B.water);
  await run(g, 200);
  const between = [1, 2].map((x) => w.getBlock(x, Y, 0) & ID_MASK);
  assert.ok(between.some((id) => id === B.cobblestone || id === B.stone || id === B.obsidian), `rock formed: ${between}`);
});

test('a powered piston pushes the block in front of it and retracts', async () => {
  const g = makeGame(makeWorld(1));
  installCircuits(g);
  installMachines(g);
  const w = g.world;
  w.setBlock(0, Y, 0, pack(B.piston, 0)); // facing +x
  w.setBlock(1, Y, 0, B.cobblestone);
  await run(g, 5);
  w.setBlock(-1, Y, 0, B.power_block);
  await run(g, 10);
  assert.equal(w.getId(2, Y, 0), B.cobblestone, 'block pushed');
  assert.equal(w.getId(1, Y, 0), B.piston_head);
  assert.equal(w.getMeta(0, Y, 0) & 8, 8, 'piston extended');
  w.setBlock(-1, Y, 0, 0);
  await run(g, 10);
  assert.equal(w.getId(1, Y, 0), 0, 'head retracted');
  assert.equal(w.getId(2, Y, 0), B.cobblestone, 'normal piston leaves the block');
});
