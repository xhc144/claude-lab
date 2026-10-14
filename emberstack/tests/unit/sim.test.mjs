import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Game } from '../../src/sim/game.js';
import { Brain } from '../../src/ai/brain.js';
import { DT, DAY_LEN } from '../../src/sim/constants.js';
import { LEVELS } from '../../src/data/levels.js';
import { CARDS } from '../../src/data/cards.js';
import { makeExpedition, makeChallenge, BIOMES, CHALLENGES } from '../../src/modes/expedition.js';

const level = (start, extra = {}) => ({ id: 't', name: 'test', biome: 'valley', board: [2400, 1700], start, objectives: [], stars: [], lose: [], schedule: [], rules: { seasons: false, season: 1, eventRate: 0, ...(extra.rules || {}) }, techs: extra.techs || [], ...extra });
const find = (g, d) => Object.values(g.s.cards).find((c) => c.d === d);
const run = (g, secs, brain = null) => { for (let i = 0; i < Math.round(secs / DT); i++) { if (brain) brain.update(DT); g.step(DT); g.events.length = 0; } };

test('a worker stacked on a tree chops wood', () => {
  const g = new Game(level([{ c: 'survivor' }, { c: 'tree' }]), { seed: 1 });
  const r = g.actDrop(find(g, 'survivor').id, find(g, 'tree').id);
  assert.ok(r.ok, r.why);
  run(g, 0.2);
  const st = g.stackOf(find(g, 'tree').id);
  assert.equal(st.task?.r, 'harvest_tree');
  run(g, 12);
  assert.ok(g.countDef('wood') >= 1);
  assert.equal(find(g, 'tree').ch, CARDS.tree.node.charges - 1);
});

test('wood ×2 + flint + a worker make a campfire', () => {
  const g = new Game(level([{ c: 'survivor' }, { c: 'wood', n: 2 }, { c: 'flint' }]), { seed: 2 });
  const wood = find(g, 'wood');
  assert.ok(g.actDrop(find(g, 'flint').id, wood.id).ok);
  assert.ok(g.actDrop(find(g, 'survivor').id, wood.id).ok);
  run(g, 10);
  assert.equal(g.countDef('campfire'), 1);
  assert.equal(g.countDef('wood'), 0);
  assert.equal(g.countDef('survivor'), 1, 'the worker is kept');
});

test('nothing gets done in the dark without light', () => {
  const g = new Game(level([{ c: 'survivor' }, { c: 'tree' }]), { seed: 3 });
  g.s.t = DAY_LEN * 0.85; // deep night on day 1
  g.actDrop(find(g, 'survivor').id, find(g, 'tree').id);
  run(g, 4);
  const st = g.stackOf(find(g, 'tree').id);
  assert.ok(st.task, 'the recipe matches');
  assert.equal(st.task.p, 0, 'but makes no progress');
  assert.equal(g.countDef('wood'), 0);
});

test('a lit campfire lets people work at night', () => {
  const g = new Game(level([{ c: 'survivor' }, { c: 'tree' }, { c: 'campfire', fuel: 3 }]), { seed: 4 });
  const fire = g.stackOf(find(g, 'campfire').id), tree = g.stackOf(find(g, 'tree').id);
  tree.x = fire.x + 130;
  tree.y = fire.y;
  g.s.t = DAY_LEN * 0.8;
  g.actDrop(find(g, 'survivor').id, find(g, 'tree').id);
  run(g, 3);
  assert.ok(g.stackOf(find(g, 'tree').id).task.p > 0);
});

test('dawn feeds people; the unfed go hungry, then starve', () => {
  const g = new Game(level([{ c: 'survivor', n: 2 }, { c: 'berry', n: 1 }]), { seed: 5 });
  run(g, DAY_LEN + 1);
  assert.equal(g.countDef('berry'), 0);
  assert.ok(g.people().some((p) => p.st.hungry), 'someone is hungry');
  run(g, DAY_LEN);
  assert.ok(g.s.stats.deaths >= 1, 'a second hungry dawn kills');
});

test('hunting a rabbit starts a battle that yields meat', () => {
  const g = new Game(level([{ c: 'survivor', n: 2 }, { c: 'rabbit' }]), { seed: 6 });
  const r = g.actDrop(find(g, 'survivor').id, find(g, 'rabbit').id);
  assert.ok(r.ok, r.why);
  run(g, 25);
  assert.equal(g.countDef('rabbit'), 0);
  assert.ok(g.countDef('raw_meat') >= 1);
});

test('research spends insight cards from the board', () => {
  const g = new Game(level([{ c: 'insight', n: 3 }]), { seed: 7 });
  assert.equal(g.techStatus('stone_tools').ok, true);
  assert.ok(g.actResearch('stone_tools').ok);
  assert.ok(g.hasTech('stone_tools'));
  assert.equal(g.countDef('insight'), 1);
  assert.equal(g.actResearch('mining').ok, false, 'needs insight and prerequisites');
});

test('cards cannot be picked up when the rules say no', () => {
  const g = new Game(level([{ c: 'survivor' }, { c: 'wolf' }, { c: 'river' }]), { seed: 8 });
  assert.equal(g.canPick(find(g, 'wolf').id).ok, false);
  assert.equal(g.canPick(find(g, 'river').id).ok, false);
  assert.equal(g.canPick(find(g, 'survivor').id).ok, true);
});

test('the simulation is deterministic for a seed (with the AI playing)', () => {
  const play = () => {
    const g = new Game(LEVELS['1-2'], { seed: 99 });
    run(g, 150, new Brain(g, { strategy: 'balanced' }));
    return JSON.stringify(g.s);
  };
  assert.equal(play(), play());
});

test('a saved game continues exactly like the original', () => {
  const g = new Game(LEVELS['1-3'], { seed: 11 });
  run(g, 80, new Brain(g, {}));
  const saved = JSON.parse(JSON.stringify(g.toJSON()));
  const h = Game.fromJSON(LEVELS['1-3'], saved);
  run(g, 60);
  run(h, 60);
  assert.equal(JSON.stringify(h.s), JSON.stringify(g.s));
});

test('the AI changes the world only through the player actions', () => {
  // static guarantee: no file of the AI touches the state directly
  const dir = new URL('../../src/ai/', import.meta.url);
  const forbidden = [/\bg\.spawn\(/, /newCard\(/, /removeCard\(/, /\.transform\(/, /addTech\(/, /makeStack\(/, /\.s\.fog\s*[-+]?=/, /\.hp\s*[-+]?=[^=]/, /\.fuel\s*[-+]?=[^=]/, /\.s\.tech\.push/, /\bg\.finish\(/, /\.ch\s*[-+]?=[^=]/];
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const re of forbidden) assert.ok(!re.test(src), `${f} matches ${re}`);
  }
  // dynamic: every AI move is counted as an action, and the AI never acts while disabled
  const g = new Game(LEVELS['1-1'], { seed: 3 });
  const b = new Brain(g, { enabled: false });
  run(g, 30, b);
  assert.equal(g.s.stats.actions.ai || 0, 0);
  b.enabled = true;
  run(g, 30, b);
  assert.ok(g.s.stats.actions.ai > 0);
});

test('every expedition, endless run and challenge builds a valid level', () => {
  for (const biome of Object.keys(BIOMES)) {
    for (const diff of [1, 2, 3, 4, 5]) {
      const L = makeExpedition({ mode: 'expedition', biome, diff, seed: diff * 13 + biome.length, mutators: diff === 5 ? ['dark', 'famine'] : [] });
      for (const e of L.start) assert.ok(CARDS[e.c], `${L.id}: ${e.c}`);
      const g = new Game(L, { seed: L.seed });
      run(g, 2);
      assert.ok(g.population() > 0);
      assert.ok(L.objectives.length >= 2, `${L.id} has goals`);
    }
    const E = makeExpedition({ mode: 'endless', biome, diff: 2, seed: 5 });
    assert.equal(E.objectives.length, 0);
    assert.ok(E.schedule.length > 20);
    run(new Game(E, { seed: 5 }), 2);
  }
  for (const c of CHALLENGES) run(new Game(makeChallenge(c.id), { seed: 1 }), 2);
});

test('expedition specs rebuild the same level', () => {
  const spec = { mode: 'expedition', biome: 'marsh', diff: 3, seed: 4242, mutators: ['trade'] };
  assert.equal(JSON.stringify(makeExpedition(spec)), JSON.stringify(makeExpedition({ ...spec })));
});
