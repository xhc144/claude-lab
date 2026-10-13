import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldGen, SEA } from '../../src/world/gen/worldgen.js';
import { locateStructures, STRUCTURE_INFO, SHRINE_KINDS } from '../../src/world/gen/structures.js';
import { B, ID_MASK, LIQUID, SOLID } from '../../src/world/blocks.js';
import { BIOMES } from '../../src/world/biomes.js';

const digest = (arr) => { let h = 2166136261; for (let i = 0; i < arr.length; i++) { h ^= arr[i]; h = Math.imul(h, 16777619); } return h >>> 0; };

test('chunk generation is deterministic per seed', () => {
  const a = new WorldGen(20261012), b = new WorldGen(20261012), c = new WorldGen(7);
  for (const [cx, cz] of [[0, 0], [3, -2], [-5, 9]]) {
    const ga = a.generate(cx, cz), gb = b.generate(cx, cz);
    assert.equal(digest(ga.blocks), digest(gb.blocks), `chunk ${cx},${cz}`);
    assert.deepEqual(Array.from(ga.biomes), Array.from(gb.biomes));
  }
  assert.notEqual(digest(a.generate(0, 0).blocks), digest(c.generate(0, 0).blocks));
});

test('generated chunks are well formed', () => {
  const g = new WorldGen(99);
  const r = g.generate(1, 1);
  assert.equal(r.blocks.length, 65536);
  assert.equal(r.heights.length, 256);
  for (let i = 0; i < 256; i++) {
    assert.equal(r.blocks[i] & ID_MASK, B.bedrock, 'bedrock floor');
    const hgt = r.heights[i];
    assert.ok(hgt > 0 && hgt < 256);
    assert.ok(BIOMES[r.biomes[i]], 'valid biome');
  }
});

for (const seed of [20261012, 1, 424242]) {
  test(`spawn is dry land next to the Heart shrine (seed ${seed})`, () => {
    const g = new WorldGen(seed);
    const [x, h, z] = g.spawnPoint();
    const col = g.column(x, z);
    assert.ok(col.h >= SEA, 'spawn above sea level');
    const heart = locateStructures(g, 'heart', x, z)[0];
    assert.ok(heart, 'heart shrine exists');
    assert.ok(Math.hypot(heart.x - x, heart.z - z) < 24, 'heart shrine is next to spawn');
    void h;
  });

  test(`every shard shrine can be found (seed ${seed})`, () => {
    const g = new WorldGen(seed);
    const [x, , z] = g.spawnPoint();
    for (const kind of SHRINE_KINDS) {
      const l = locateStructures(g, kind, x, z, 4);
      assert.ok(l.length > 0, `${STRUCTURE_INFO[kind].zh} within reach`);
      assert.ok(l[0].d < 2400, `${kind} at ${Math.round(l[0].d)}`);
      // the same query is stable
      assert.deepEqual(locateStructures(g, kind, x, z, 4)[0], l[0]);
    }
  });
}

test('structures are carved into generated terrain', () => {
  const g = new WorldGen(20261012);
  const heart = locateStructures(g, 'heart', 0, 0)[0];
  const r = g.generate(heart.x >> 4, heart.z >> 4);
  const ids = new Set(Array.from(r.blocks, (v) => v & ID_MASK));
  assert.ok(ids.has(B.heart_altar) || r.features.some((f) => f.type === 'structure' && f.kind === 'heart'), 'altar chunk');
  const feats = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) feats.push(...g.generate((heart.x >> 4) + dx, (heart.z >> 4) + dz).features);
  assert.ok(feats.some((f) => f.type === 'chest'), 'heart shrine has a chest');
  assert.ok(feats.some((f) => f.type === 'waystone'), 'heart shrine has a waystone');
  void LIQUID; void SOLID;
});
