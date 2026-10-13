// The player's powers, random events, entities and the codex.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../../src/sim/world.js';
import { applyTool, TOOLS, TOOL } from '../../src/sim/powers.js';
import { EVENTS, runEvent } from '../../src/sim/events.js';
import { ARCHETYPES } from '../../src/sim/life/genome.js';
import { ACHIEVEMENTS, checkAchievements } from '../../src/sim/achievements.js';
import { summonComet, spawnMonster } from '../../src/sim/entities.js';

function populated(seed = 5) {
  const w = createWorld({ seed, size: 'small', start: 'tribes' });
  for (let i = 0; i < 4 * 120; i++) step(w);
  return w;
}

test('every tool applies to a populated world without errors', () => {
  const w = populated();
  const city = w.cities.find((c) => c.alive);
  const x = city.x + 0.5, y = city.y + 0.5;
  // a creature for the creature-targeted tools
  const L = w.life;
  let ci = -1;
  for (let i = 0; i < L.hi; i++) if (L.alive[i] && L.pHab[i] === 2) { ci = i; break; }
  for (const t of TOOLS) {
    const opts = { strength: 0.6, dt: 0.1, param: { genes: ARCHETYPES.grazer.genes, idea: 'liberty', aspect: 'mystery' } };
    let tx = x, ty = y;
    if (['uplift'].includes(t.id) && ci >= 0) { tx = L.x[ci]; ty = L.y[ci]; }
    if (t.mode === 'pair') opts.from = { x, y };
    assert.doesNotThrow(() => applyTool(w, t.id, tx, ty, opts), t.id);
  }
  for (let i = 0; i < 4 * 30; i++) step(w);
});

test('divine mode charges energy; sandbox does not', () => {
  const w = populated(9);
  const e0 = w.divine.energy;
  applyTool(w, 'lightning', 50, 50, {});
  assert.equal(w.divine.energy, e0);
  w.settings.mode = 'divine';
  w.divine.energy = 100;
  applyTool(w, 'lightning', 50, 50, {});
  assert.equal(w.divine.energy, 100 - TOOL.lightning.cost);
  w.divine.energy = 1;
  const r = applyTool(w, 'meteor', 50, 50, {});
  assert.equal(r.ok, false);
});

test('terrain tools reshape the land', () => {
  const w = createWorld({ seed: 3, size: 'small', start: 'barren' });
  let sea = -1;
  for (let c = 0; c < w.N; c++) if (w.elev[c] < w.seaLevel - 0.1) { const x = c % w.W, y = (c / w.W) | 0; if (x > 20 && y > 20 && x < w.W - 20 && y < w.H - 20) { sea = c; break; } }
  const x = sea % w.W, y = (sea / w.W) | 0;
  applyTool(w, 'island', x, y, { r: 7, strength: 0.8 });
  assert.ok(w.elev[sea] >= w.seaLevel, 'island did not rise');
  const before = w.elev[sea];
  applyTool(w, 'lower', x, y, { r: 4, strength: 1, dt: 1 });
  assert.ok(w.elev[sea] < before);
});

test('portals carry creatures across the world', () => {
  const w = createWorld({ seed: 4, size: 'small', start: 'flourishing' });
  const L = w.life;
  let i = 0;
  while (!(L.alive[i] && L.pHab[i] === 2)) i++;
  const ax = L.x[i], ay = L.y[i];
  let bx = -1, by = -1;
  for (let c = 0; c < w.N; c++) { const x = c % w.W, y = (c / w.W) | 0; if (w.elev[c] > w.seaLevel + 0.01 && Math.hypot(x - ax, y - ay) > 60) { bx = x + 0.5; by = y + 0.5; break; } }
  w.portals.push({ ax, ay, bx, by, born: 0 });
  const uid = L.uid[i];
  let moved = false;
  for (let k = 0; k < 30 && !moved; k++) { step(w); if (L.alive[i] && L.uid[i] === uid && Math.hypot(L.x[i] - bx, L.y[i] - by) < 5) moved = true; }
  assert.ok(moved);
});

test('random events, monsters and comets run', () => {
  const w = populated(6);
  for (const e of EVENTS) assert.doesNotThrow(() => runEvent(w, e.id), e.id);
  spawnMonster(w, w.cities.find((c) => c.alive).x, w.cities.find((c) => c.alive).y, 1);
  summonComet(w, 3, 3);
  for (let i = 0; i < 4 * 6; i++) step(w);
  assert.equal(w.comets.length, 0, 'comet should have struck or been deflected');
  assert.ok(w.chronicle.some((e) => e.text.includes('彗星')));
});

test('the codex recognises milestones', () => {
  const w = populated(7);
  checkAchievements(w);
  assert.ok(w.achievements.firstLife && w.achievements.firstTribe);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
});
