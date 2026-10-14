import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS, B, pack, TEXTURE_NAMES, LIQUID, LAYER, L_NONE } from '../../src/world/blocks.js';
import { modelQuads, selectionBoxes, collisionBoxes } from '../../src/world/models.js';
import { ITEMS, I } from '../../src/world/items.js';
import { RECIPES, SMELT, STATIONS, tagItems } from '../../src/world/recipes.js';
import { blockDrops } from '../../src/world/drops.js';

test('every block state builds a model and selection boxes', () => {
  let states = 0;
  for (const d of BLOCKS) {
    if (!d || d.id === 0 || LIQUID[d.id] || LAYER[d.id] === L_NONE) continue; // liquids have their own mesher
    for (let m = 0; m < 64; m++) {
      const v = pack(d.id, m);
      assert.doesNotThrow(() => { modelQuads(v, 0); modelQuads(v, 15); selectionBoxes(v, 0); collisionBoxes(v, 0); }, `${d.name} meta ${m}`);
      states++;
    }
    for (const f of d.faces || []) assert.ok(f >= 0 && f < TEXTURE_NAMES.length, `${d.name} texture layer`);
  }
  assert.ok(states > 10000);
});

test('recipes reference real items and stations', () => {
  const seen = new Set();
  for (const r of RECIPES) {
    const name = ITEMS[r.out] ? ITEMS[r.out].name : r.out;
    assert.ok(ITEMS[r.out], `recipe ${r.i} output`);
    assert.ok(r.n >= 1);
    assert.ok(STATIONS[r.station], `recipe ${name} station ${r.station}`);
    assert.ok(r.ins.length > 0);
    for (const ing of r.ins) {
      assert.ok(ing.n >= 1);
      if (ing.tag) assert.ok(tagItems(ing.tag).length > 0, `tag ${ing.tag}`);
      else assert.ok(ITEMS[ing.id], `recipe ${name} ingredient ${ing.id}`);
    }
    const sig = `${r.out}:${r.station}:${r.ins.map((x) => `${x.tag || x.id}x${x.n}`).sort().join(',')}`;
    assert.ok(!seen.has(sig), `duplicate recipe ${name}`);
    seen.add(sig);
  }
  assert.ok(RECIPES.length > 150);
  for (const s of SMELT) { assert.ok(ITEMS[s.in], 'smelt input'); assert.ok(ITEMS[s.out], 'smelt output'); }
});

test('core progression is craftable', () => {
  const outs = new Set(RECIPES.map((r) => r.out));
  for (const n of ['oak_planks', 'stick', 'workbench', 'furnace', 'wood_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'star_pickaxe', 'resonator', 'echo_compass', 'glider', 'piston', 'crystal_lamp', 'rail', 'cart', 'bed', 'chest', 'torch']) {
    assert.ok(I[n] !== undefined, `${n} exists`);
    assert.ok(outs.has(I[n]), `${n} has a recipe`);
  }
  const smelted = new Set(SMELT.map((s) => s.out));
  for (const n of ['iron_ingot', 'copper_ingot', 'glass', 'bread'].filter((n) => !outs.has(I[n]))) assert.ok(smelted.has(I[n]), `${n} is smelted`);
});

test('ores drop their materials with the right tool', () => {
  const ironPick = { id: I.iron_pickaxe, n: 1 };
  const drops = (b) => blockDrops(b, ironPick, () => 0.5).map((s) => ITEMS[s.id].name);
  assert.ok(drops(B.coal_ore).includes('coal'));
  assert.ok(drops(B.iron_ore).length > 0);
  assert.deepEqual(blockDrops(B.iron_ore, null), [], 'iron ore needs a pickaxe');
  assert.deepEqual(blockDrops(B.crystal_ore, ironPick, () => 0).map((s) => ITEMS[s.id].name), ['crystal_dust']);
});

test('logs, planks and other self-dropping blocks give a full stack', () => {
  const axe = { id: I.wood_axe, n: 1 };
  for (const n of ['oak_log', 'birch_log', 'pine_log', 'blossom_log', 'willow_log', 'cloud_log', 'oak_planks', 'crystal_lamp']) {
    const d = blockDrops(B[n], axe, () => 0.5);
    assert.deepEqual(d, [{ id: B[n], n: 1 }], `${n} drops itself`);
  }
  // nothing anywhere returns a stack without a count (the entity system would discard it)
  for (const b of BLOCKS) if (b && b.id) for (const s of blockDrops(b.id, { id: I.meteor_pickaxe, n: 1 }, () => 0.01)) assert.ok(s.n >= 1 && ITEMS[s.id], `${b.name} drop`);
});
