// The journey guide: every reward exists, every achievement it waits on exists, steps advance on
// real game events, finished chapters pay out once, and an older save catches up silently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, SIDE, installJourney } from '../../src/systems/journey.js';
import { ACHIEVEMENTS } from '../../src/systems/codex.js';
import { I } from '../../src/world/items.js';
import { B } from '../../src/world/blocks.js';
import { Inventory } from '../../src/entity/inventory.js';
import { readFileSync } from 'node:fs';

test('rewards and referenced achievements exist', () => {
  const ach = new Set(ACHIEVEMENTS.map((a) => a[0]));
  const src = readFileSync(new URL('../../src/systems/journey.js', import.meta.url), 'utf8');
  for (const m of src.matchAll(/ach\('(\w+)'\)/g)) assert.ok(ach.has(m[1]), `achievement ${m[1]}`);
  for (const c of [...CHAPTERS, ...SIDE]) {
    for (const [name, n] of c.reward) { assert.ok(I[name] !== undefined, `reward ${name}`); assert.ok(n > 0); }
    const ids = new Set();
    for (const s of c.steps) {
      assert.ok(!ids.has(s.id), `duplicate step ${c.id}.${s.id}`); ids.add(s.id);
      assert.ok(s.title && s.how, `${c.id}.${s.id} has text`);
      assert.ok(typeof s.done === 'function' || (typeof s.count === 'function' && s.of > 0), `${c.id}.${s.id} is checkable`);
    }
  }
});

function fakeGame(state, setup) {
  const listeners = {};
  const toasts = [];
  const g = {
    discovered: new Set(), inventory: new Inventory(), day: 1, dayTime: 1000, ticks: 0,
    player: { x: 0, y: 70, z: 0, creative: false, hunger: 20, health: 20, medium: null },
    codex: { ach: new Set(), stats: { walked: 0, placed: 0 }, biomes: new Set() },
    quest: { found: new Set(), placed: new Set(), done: false },
    structures: new Map(), lorePages: new Set(),
    world: { isLoaded: () => false },
    hud: { toast: (t, b, k) => toasts.push([t, k]), showSubtitle() {} },
    stateSavers: [], systems: [],
    on(ev, f) { (listeners[ev] = listeners[ev] || []).push(f); },
    emit(ev, ...a) { for (const f of listeners[ev] || []) f(...a); },
    addSystem(s) { this.systems.push(s); },
    spawnItem() {},
  };
  g.toasts = toasts;
  if (setup) setup(g);
  g.tick = (n = 10) => { for (let i = 0; i < n; i++) for (const s of g.systems) s.tick && s.tick(g); };
  installJourney(g, state);
  return g;
}

test('steps follow gameplay and chapters pay out once', () => {
  const g = fakeGame(null);
  const J = g.journey;
  assert.equal(J.current().step.id, 'move');
  g.codex.stats.walked = 20;
  g.tick();
  assert.equal(J.current().step.id, 'logs');
  for (let k = 0; k < 3; k++) g.emit('blockBroken', 0, 0, 0, B.oak_log);
  g.tick();
  assert.equal(J.current().step.id, 'planks');
  // stone only counts when mined with a pickaxe
  g.inventory.add(I.wood_pickaxe, 1);
  g.discovered.add(I.oak_planks); g.discovered.add(I.workbench);
  g.emit('blockPlaced', 0, 0, 0, B.workbench);
  g.discovered.add(I.wood_pickaxe);
  g.tick();
  assert.equal(J.current().step.id, 'stone');
  for (let k = 0; k < 8; k++) g.emit('blockBroken', 0, 0, 0, B.stone);
  g.discovered.add(I.stone_pickaxe);
  const before = g.inventory.count(I.bread);
  g.tick();
  assert.equal(J.current().c.id, 'night', 'chapter two is next');
  assert.equal(g.inventory.count(I.bread) - before, 4, 'chapter reward paid');
  g.tick(40);
  assert.equal(g.inventory.count(I.bread) - before, 4, 'paid only once');
  // the tracker shows the new step
  assert.match(g.goalText(), /找到燃料/);
});

test('an older save catches up silently; a gate step completes the steps before it', () => {
  const discovered = [I.oak_log, I.oak_planks, I.stick, I.workbench, I.wood_pickaxe, I.stone_pickaxe, I.cobblestone, I.coal, I.torch, I.furnace];
  const g = fakeGame({ day: 6, discovered }, (x) => { for (const id of discovered) x.discovered.add(id); x.codex.stats.walked = 500; x.day = 6; });
  const J = g.journey;
  // chapter one is complete although its counters (logs, stone, bench placed) were never seen
  assert.ok(J.chapterDone(CHAPTERS[0]), 'chapter one caught up');
  assert.ok(J.paid.has('wake'), 'its reward is marked as paid');
  assert.equal(g.inventory.count(I.bread), 0, '…without paying it again');
  assert.equal(g.toasts.length, 0, 'no toast spam on load');
  // chapter two: coal, torch, furnace and the night are done; placing torches and eating are not
  assert.equal(J.current().step.id, 'torchPlaced');
  for (let k = 0; k < 4; k++) g.emit('blockPlaced', 0, 0, 0, B.torch);
  g.emit('ate', I.bread);
  g.tick();
  assert.equal(J.current().c.id, 'iron');
  assert.equal(g.inventory.count(I.bed), 1, 'chapter two reward');
});

test('creative mode neither tracks nor pays', () => {
  const g = fakeGame(null, (x) => { x.player.creative = true; });
  g.codex.stats.walked = 50;
  g.tick();
  assert.equal(g.goalText(), '');
  assert.equal(g.toasts.length, 0);
});
