// Villages: they exist within reach of spawn, every house gets a villager, every home can be
// walked to from the well (through its door), and the chests, beds and roofs are in place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldGen } from '../../src/world/gen/worldgen.js';
import { locateStructures } from '../../src/world/gen/structures.js';
import { B, ID_MASK } from '../../src/world/blocks.js';
import { region, reach } from './walker.mjs';
import { villagerOffers, VILLAGE_OFFERS, PROF_LIST } from '../../src/systems/village.js';
import { I } from '../../src/world/items.js';

const SEEDS = [20261012, 424242, 777];

for (const seed of SEEDS) {
  test(`villages near spawn are built and every home can be walked to (seed ${seed})`, () => {
    const gen = new WorldGen(seed);
    const [sx, , sz] = gen.spawnPoint();
    const vs = locateStructures(gen, 'village', sx, sz, 3);
    assert.ok(vs.length > 0 && vs[0].d < 480, `a village within reach of spawn (nearest ${vs[0] && Math.round(vs[0].d)})`);
    const v = vs[0];
    const R = 40;
    const get = region(gen, v.x, v.z, R);
    const feats = [];
    for (let cz = (v.z - R) >> 4; cz <= (v.z + R) >> 4; cz++) for (let cx = (v.x - R) >> 4; cx <= (v.x + R) >> 4; cx++) {
      feats.push(...gen.generate(cx, cz).features.filter((f) => f.type === 'villager' || f.type === 'chest'));
    }
    const homes = feats.filter((f) => f.type === 'villager');
    assert.ok(homes.length >= 4, `houses with villagers (${homes.length})`);
    // each house has a door in front of its home spot, a lantern and a roof over the home
    for (const f of homes) {
      const [hx, hy, hz] = f.home;
      let door = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ((get(hx + dx, hy, hz + dz) & ID_MASK) === B.oak_door) door = true;
      assert.ok(door, `door next to the home at ${hx},${hy},${hz}`);
      let roof = false;
      for (let y = hy + 2; y < hy + 9; y++) if ((get(hx, y, hz) & ID_MASK) !== 0) roof = true;
      assert.ok(roof, `roof over ${hx},${hz}`);
    }
    assert.ok(feats.some((f) => f.type === 'chest'), 'house chests');
    // walk from the well to every home
    const start = [v.x + 3, v.y, v.z];
    const box = [v.x - R, v.x + R, v.z - R, v.z + R];
    const targets = homes.map((f) => f.home);
    const ok = reach(get, start, targets, { box, surface: true, doorsOpen: true });
    assert.deepEqual(ok, targets.map(() => true), `homes reachable: ${targets.filter((_, i) => !ok[i]).map((t) => t.join(',')).join(' ')}`);
    // and back out again from each home to the well
    for (const t of targets) assert.deepEqual(reach(get, t, [[v.x + 3, v.y, v.z]], { box, doorsOpen: true }), [true], `out of ${t.join(',')}`);
  });
}

test('every trade names real items, and each trade has a stall', () => {
  for (const prof of PROF_LIST) {
    const o = VILLAGE_OFFERS[prof];
    for (const [name] of [...o.buy, ...o.sell]) assert.ok(I[name] !== undefined, `${prof}: ${name}`);
    const offers = villagerOffers(prof, 12345);
    assert.equal(offers.length, 6, `${prof} offers`);
    assert.ok(offers.some((x) => x.get[0] === 'weave_coin') && offers.some((x) => x.give[0] === 'weave_coin'));
  }
  assert.ok(villagerOffers('cartographer', 99).some((x) => x.get[0] === 'treasure_map'), 'cartographers always sell a treasure map');
});
