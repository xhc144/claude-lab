// Life: genomes, ecology, speciation, sapience.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../../src/sim/world.js';
import { phenotype, geneticDistance, mutateInto, ARCHETYPES, FORM } from '../../src/sim/life/genome.js';
import { seedPopulation, findHome, canLive } from '../../src/sim/life/creatures.js';
import { RNG } from '../../src/core/rng.js';
import { NG, G } from '../../src/sim/constants.js';

test('phenotype follows genes: big animals live longer, need more food, fight harder', () => {
  const small = Float32Array.from(ARCHETYPES.critter.genes), big = Float32Array.from(ARCHETYPES.behemoth.genes);
  const a = phenotype(small, 0, {}), b = phenotype(big, 0, {});
  assert.ok(b.size > a.size && b.metab > a.metab && b.defense > a.defense);
  assert.equal(phenotype(Float32Array.from(ARCHETYPES.grazerFish.genes), 0, {}).hab, 0);
  assert.equal(phenotype(Float32Array.from(ARCHETYPES.bird.genes), 0, {}).fly, true);
  assert.equal(phenotype(Float32Array.from(ARCHETYPES.predator.genes), 0, {}).form, FORM.WOLF);
});

test('mutation drifts genomes gradually and stays within [0, 1]', () => {
  const rng = new RNG(3);
  const g = Float32Array.from(ARCHETYPES.grazer.genes);
  const c = new Float32Array(NG);
  let d = 0;
  for (let i = 0; i < 200; i++) { mutateInto(c, 0, g, 0, rng, 0.02); d += geneticDistance(c, 0, g, 0); for (const v of c) assert.ok(v >= 0 && v <= 1); }
  assert.ok(d / 200 > 0.005 && d / 200 < 0.08);
});

test('a flourishing world keeps a diverse, evolving ecosystem for centuries', () => {
  const w = createWorld({ seed: 7, size: 'small', start: 'flourishing' });
  const founders = w.species.length;
  for (let i = 0; i < 4 * 300; i++) step(w);
  const alive = w.species.filter((s) => s.extinct === null && s.pop > 0);
  assert.ok(alive.length >= 5, `only ${alive.length} species alive`);
  assert.ok(w.life.count > 300, `only ${w.life.count} creatures`);
  assert.ok(w.life.count < w.life.cap, 'population pinned at the hard cap');
  assert.ok(w.species.length > founders, 'no speciation happened');
  // new species remember their ancestors
  for (const s of w.species.slice(founders)) assert.ok(s.parent >= 0 && s.parent < s.id);
  // creatures stand where their bodies allow
  const L = w.life;
  let bad = 0, n = 0;
  for (let i = 0; i < L.hi; i++) { if (!L.alive[i]) continue; n++; const c = (L.y[i] | 0) * w.W + (L.x[i] | 0); if (!canLive(w, L.pHab[i], L.pFly[i], c) && !(w.elev[c] < w.seaLevel && w.baseTemp[c] < 0)) bad++; }
  assert.ok(bad / n < 0.05, `${bad}/${n} creatures out of habitat`);
});

test('predators eat prey', () => {
  const w = createWorld({ seed: 2, size: 'small', start: 'barren' });
  const rng = w.rng;
  const home = findHome(w, ARCHETYPES.grazer.genes, rng);
  seedPopulation(w, ARCHETYPES.grazer.genes, home.x, home.y, 60, 6, rng);
  seedPopulation(w, ARCHETYPES.predator.genes, home.x, home.y, 10, 4, rng);
  for (let i = 0; i < 200; i++) step(w);
  assert.ok(w.life.stats.eaten > 10, `eaten ${w.life.stats.eaten}`);
});

test('a clever, social species awakens and founds a tribe', () => {
  const w = createWorld({ seed: 12, size: 'small', start: 'barren' });
  const genes = ARCHETYPES.primate.genes.slice();
  genes[G.intellect] = 0.85;
  genes[G.social] = 0.8;
  const home = findHome(w, genes, w.rng);
  const sp = seedPopulation(w, genes, home.x, home.y, 30, 5, w.rng);
  for (let i = 0; i < 60 && !w.nations.length; i++) step(w);
  assert.ok(sp.sapient);
  assert.ok(w.nations.length >= 1);
  assert.equal(w.nations[0].species, sp.id);
  assert.ok(w.chronicle.some((e) => e.text.startsWith('智慧的曙光')));
});
