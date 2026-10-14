// Can a player actually walk through the generated buildings? Each structure is generated with
// the real terrain around it, then searched with player movement rules: auto-step 0.6, jump
// 1.25, 1.8 of headroom, any drop, ladders climb. Rune pedestals must be reachable with the
// seals closed, shard chests once they are open.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldGen } from '../../src/world/gen/worldgen.js';
import { locateStructures } from '../../src/world/gen/structures.js';
import { B, ID_MASK } from '../../src/world/blocks.js';
import { region, reach } from './walker.mjs';

// find pedestals and shard chests of a structure in the generated region
function scan(get, cx, cy, cz, r, ry) {
  const peds = [], chests = [];
  for (let y = cy - ry; y <= cy + ry; y++) for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
    const id = get(x, y, z) & ID_MASK;
    if (id === B.rune_pedestal) peds.push([x, y, z]);
    else if (id === B.chest) chests.push([x, y, z]);
  }
  return { peds, chests };
}

const SEEDS = [20261012, 424242];

for (const seed of SEEDS) {
  const gen = new WorldGen(seed);
  const near = (kind) => { const [x, , z] = gen.spawnPoint(); return locateStructures(gen, kind, x, z, 4)[0]; };

  test(`sand obelisk: pedestals and the shard vault can be walked to (seed ${seed})`, () => {
    const o = near('sand');
    const get = region(gen, o.x, o.z - 12, 30);
    const { peds, chests } = scan(get, o.x, o.y - 11, o.z - 18, 8, 6);
    assert.equal(peds.length, 3);
    const start = [o.x + 6, o.y, o.z - 6], top = { surface: true };
    const box = [o.x - 30, o.x + 30, o.z - 42, o.z + 18];
    assert.deepEqual(reach(get, start, peds, { box, ...top }), peds.map(() => true), 'pedestals reachable');
    assert.deepEqual(reach(get, start, chests, { box, sealsOpen: true, ...top }), chests.map(() => true), 'vault reachable');
    // and back out again: from the chamber floor up to the surface
    const back = reach(get, [o.x, o.y - 11, o.z - 18], [[o.x, o.y, o.z - 3]], { box });
    assert.deepEqual(back, [true], 'the stairway leads back up');
  });

  test(`frost spire: the spiral stair reaches every storey and the crown (seed ${seed})`, () => {
    const o = near('frost');
    const get = region(gen, o.x, o.z, 14);
    const { peds, chests } = scan(get, o.x, o.y + 15, o.z, 5, 16);
    assert.equal(peds.length, 3);
    const start = [o.x, o.y, o.z + 9], top = { surface: true };
    const box = [o.x - 12, o.x + 12, o.z - 12, o.z + 12];
    assert.deepEqual(reach(get, start, peds, { box, ...top }), peds.map(() => true), 'all pedestals reachable');
    assert.deepEqual(reach(get, start, chests, { box, sealsOpen: true, ...top }), [true], 'crown vault reachable');
    assert.deepEqual(reach(get, start, chests, { box, sealsOpen: false, ...top }), [false], 'the seal really blocks the vault');
  });

  test(`sky temple: the pedestal rocks are bridged and the vault is reachable (seed ${seed})`, () => {
    const o = near('sky');
    const get = region(gen, o.x, o.z, 22);
    const { peds, chests } = scan(get, o.x, o.y, o.z, 20, 3);
    assert.equal(peds.length, 3);
    const start = [o.x, o.y, o.z + 7];
    const box = [o.x - 24, o.x + 24, o.z - 24, o.z + 24];
    assert.deepEqual(reach(get, start, peds, { box }), peds.map(() => true));
    assert.deepEqual(reach(get, start, chests, { box, sealsOpen: true }), [true]);
  });

  test(`ruin cellars can be entered and left (seed ${seed})`, () => {
    const [sx, , sz] = gen.spawnPoint();
    const cellars = locateStructures(gen, 'ruin', sx, sz, 4).filter((o) => o.variant === 1).slice(0, 2);
    assert.ok(cellars.length > 0, 'found a ruin with a cellar');
    for (const o of cellars) {
      const get = region(gen, o.x, o.z - 5, 14);
      const room = [o.x, o.y - 7, o.z - 10];
      const box = [o.x - 14, o.x + 14, o.z - 18, o.z + 14];
      const start = [o.x, o.y, o.z + 1];
      assert.deepEqual(reach(get, start, [room], { box, surface: true }), [true], `down into the cellar at ${o.x},${o.z}`);
      assert.deepEqual(reach(get, room, [start], { box }), [true], `back out of the cellar at ${o.x},${o.z}`);
    }
  });
}
