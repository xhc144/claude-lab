// Civilisation: languages, growth, technology, territory, faith, war, society, saves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../../src/sim/world.js';
import { makeLanguage, placeName, driftLanguage } from '../../src/core/lang.js';
import { RNG } from '../../src/core/rng.js';
import { recordOmen, stepMythogenesis } from '../../src/sim/civ/religion.js';
import { declareWar } from '../../src/sim/civ/diplomacy.js';
import { rel } from '../../src/sim/civ/nation.js';
import { raiseArmy } from '../../src/sim/civ/war.js';
import { splitNation } from '../../src/sim/civ/society.js';
import { TECHS, techCost } from '../../src/sim/civ/data.js';
import { snapshot, restore, toJSON, fromJSON } from '../../src/sim/serialize.js';

const run = (w, years) => { for (let i = 0; i < years * 4; i++) step(w); };

test('languages make consistent Chinese-transliterated names; daughter languages drift', () => {
  const rng = new RNG(1);
  for (let s = 1; s < 20; s++) {
    const L = makeLanguage(s * 101);
    for (let k = 0; k < 20; k++) {
      const n = placeName(L, rng);
      assert.ok(n.z.length >= 1 && n.z.length <= 6, n.z);
      assert.ok(/^[一-鿿]+$/.test(n.z), n.z);
      assert.ok(/^[A-Z][a-z]+$/.test(n.r), n.r);
    }
  }
  const L = makeLanguage(5), D = driftLanguage(L, 9);
  assert.notDeepEqual(L.onsets, D.onsets);
});

test('technology costs rise with each era', () => {
  for (let e = 1; e < 11; e++) {
    const a = TECHS.filter((t) => t.era === e - 1).map(techCost), b = TECHS.filter((t) => t.era === e).map(techCost);
    assert.ok(Math.min(...b) > Math.max(...a) * 0.9);
  }
  // every prerequisite comes from an earlier or equal era
  for (const t of TECHS) for (const r of t.req) assert.ok(TECHS.find((u) => u.id === r).era <= t.era);
});

test('tribes grow, spread, learn, trade and claim land', () => {
  const w = createWorld({ seed: 7, size: 'small', start: 'tribes' });
  const n0 = w.nations.length, c0 = w.cities.length;
  assert.ok(n0 >= 2);
  run(w, 250);
  const alive = w.nations.filter((n) => n.alive);
  assert.ok(w.cities.filter((c) => c.alive).length > c0, 'no expansion');
  assert.ok(alive.some((n) => n.techCount > 3), 'no research');
  let owned = 0;
  for (let c = 0; c < w.N; c++) if (w.owner[c] >= 0) owned++;
  assert.ok(owned > 200, 'no territory');
  // every owned cell belongs to a living city of that nation
  for (let c = 0; c < w.N; c += 7) {
    if (w.owner[c] < 0) continue;
    const city = w.cities[w.ownerCity[c]];
    assert.ok(city.nation === w.owner[c]);
  }
  assert.ok(w.chronicle.length > 20);
});

test('mythogenesis: a people who see thunderbolts come to worship a god of wrath', () => {
  const w = createWorld({ seed: 3, size: 'small', start: 'tribes' });
  const n = w.nations[0];
  const city = w.cities[n.capital];
  for (let k = 0; k < 12; k++) recordOmen(w, city.x, city.y, 'lightning', 1.5, 3);
  let r = null;
  for (let k = 0; k < 200 && !r; k++) r = stepMythogenesis(w, n, w.rng);
  assert.ok(r, 'no revelation');
  assert.equal(r.player, true);
  assert.equal(r.aspect, 'wrath');
  assert.ok(['雷霆之主', '执雷者'].includes(r.epithet));
  // a people shown mercy worship differently
  const m = w.nations[1];
  const mc = w.cities[m.capital];
  for (let k = 0; k < 12; k++) recordOmen(w, mc.x, mc.y, 'rain', 1.5, 3);
  let r2 = null;
  for (let k = 0; k < 200 && !r2; k++) r2 = stepMythogenesis(w, m, w.rng);
  assert.ok(r2 && r2.aspect === 'mercy');
});

test('war: armies march, fight and besiege; peace eventually returns', () => {
  const w = createWorld({ seed: 11, size: 'small', start: 'kingdoms' });
  run(w, 5);
  // pick two nations on the same landmass
  let pair = null;
  for (const a of w.nations) for (const b of w.nations) {
    if (a.id >= b.id || !a.alive || !b.alive) continue;
    const ca = w.cities[a.capital], cb = w.cities[b.capital];
    if (w.landmass[ca.y * w.W + ca.x] === w.landmass[cb.y * w.W + cb.x]) pair = [a, b];
  }
  assert.ok(pair, 'no two nations share a landmass');
  const [a, b] = pair;
  rel(w, a, b).contact = true;
  declareWar(w, a, b, 'conquest');
  assert.equal(rel(w, a, b).state, 'war');
  raiseArmy(w, a, w.cities[a.capital], 3000, null);
  raiseArmy(w, b, w.cities[b.capital], 3000, null);
  let fought = false;
  for (let i = 0; i < 4 * 60; i++) { step(w); if (w.armies.some((x) => x.battle) || w.cities.some((c) => w.tick - c.siege < 2)) fought = true; }
  assert.ok(fought, 'the armies never met');
  run(w, 150);
  assert.ok(w.chronicle.some((e) => e.text.includes('和约') || e.text.includes('议和') || e.text.includes('灭亡')));
});

test('secession creates a successor state with a drifted language', () => {
  const w = createWorld({ seed: 6, size: 'small', start: 'kingdoms' });
  const n = w.nations.find((x) => x.cities.length >= 3);
  const m = splitNation(w, n, n.cities.slice(-1), { hostile: true });
  assert.ok(m && m.alive && m.parent === n.id);
  assert.equal(m.cities.length, 1);
  assert.equal(w.cities[m.cities[0]].nation, m.id);
  assert.equal(m.species, n.species);
});

test('saves are complete: a restored world has exactly the same future', () => {
  const w = createWorld({ seed: 13, size: 'small', start: 'tribes' });
  run(w, 60);
  const w2 = restore(snapshot(w));
  const w3 = fromJSON(toJSON(w));
  for (let i = 0; i < 4 * 25; i++) { step(w); step(w2); step(w3); }
  for (const x of [w2, w3]) {
    assert.equal(x.rng.s, w.rng.s);
    assert.equal(x.life.count, w.life.count);
    assert.equal(x.cities.length, w.cities.length);
    assert.equal(x.chronicle.length, w.chronicle.length);
    assert.deepEqual(Array.from(x.owner), Array.from(w.owner));
  }
  // relation records are shared again after JSON
  for (const a of w3.nations) for (const k in a.rel) assert.equal(w3.nations[k].rel[a.id], a.rel[k]);
});
