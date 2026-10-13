import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS } from '../../src/data/cards.js';
import { RECIPES } from '../../src/data/recipes.js';
import { TECHS } from '../../src/data/techs.js';
import { LEVELS } from '../../src/data/levels.js';
import { EVENTS } from '../../src/data/events.js';
import { MARKET_OFFERS, CARAVAN_POOL } from '../../src/data/trade.js';

const exists = (id) => !!CARDS[id];

test('every recipe references real cards and techs', () => {
  for (const r of Object.values(RECIPES)) {
    for (const k of [...Object.keys(r.in), ...Object.keys(r.keep)]) if (k[0] !== '#') assert.ok(exists(k), `${r.id}: ${k}`);
    for (const [o] of r.out) assert.ok(exists(o), `${r.id} out ${o}`);
    if (r.tech) assert.ok(TECHS[r.tech], `${r.id} tech ${r.tech}`);
  }
});

test('no two recipes share exactly the same ingredients', () => {
  const sig = new Map();
  for (const r of Object.values(RECIPES)) {
    const parts = [];
    for (const [k, n] of Object.entries(r.in)) parts.push(`in:${k}×${n}`);
    for (const [k, n] of Object.entries(r.keep)) parts.push(`keep:${k}×${n}`);
    parts.push('w' + r.w);
    // consumed and kept slots both just mean "this card is in the stack"
    const key = parts.map((p) => p.replace(/^(in|keep):/, '')).sort().join('|');
    assert.ok(!sig.has(key), `${r.id} has the same ingredients as ${sig.get(key)}`);
    sig.set(key, r.id);
  }
});

test('loot tables, bundles, events and trades reference real cards', () => {
  for (const d of Object.values(CARDS)) {
    for (const [id] of d.region?.loot || []) assert.ok(exists(id), `${d.id} loot ${id}`);
    for (const [id] of d.region?.foes || []) assert.ok(exists(id), `${d.id} foe ${id}`);
    for (const id of d.region?.reveal || []) assert.ok(exists(id), `${d.id} reveal ${id}`);
    for (const [id] of d.mob?.loot || []) assert.ok(exists(id), `${d.id} mob loot ${id}`);
    for (const [id] of d.open?.loot || []) assert.ok(exists(id), `${d.id} bundle ${id}`);
    for (const [id] of d.node?.extra || []) assert.ok(exists(id), `${d.id} extra ${id}`);
    if (d.mob?.summon) assert.ok(exists(d.mob.summon.id));
    if (d.mob?.spawn) assert.ok(exists(d.mob.spawn.id));
    if (d.grows) assert.ok(exists(d.grows.to));
  }
  for (const e of Object.values(EVENTS)) for (const ch of e.choices || []) for (const [id] of [...ch.give, ...ch.get]) assert.ok(id === '#food' || exists(id), `${e.id}: ${id}`);
  for (const o of [...MARKET_OFFERS, ...CARAVAN_POOL]) for (const [id] of [...o.give, ...o.get]) assert.ok(exists(id));
});

test('tech prerequisites exist and form no cycles', () => {
  for (const t of Object.values(TECHS)) {
    for (const r of t.req) assert.ok(TECHS[r], `${t.id} requires ${r}`);
    const seen = new Set();
    (function walk(x, depth) {
      assert.ok(depth < 20, 'cycle at ' + t.id);
      for (const r of TECHS[x].req) walk(r, depth + 1);
      seen.add(x);
    })(t.id, 0);
  }
});

test('levels reference real cards, techs and objectives', () => {
  for (const L of Object.values(LEVELS)) {
    for (const e of L.start) assert.ok(exists(e.c), `${L.id} start ${e.c}`);
    for (const t of L.techs || []) assert.ok(TECHS[t], `${L.id} tech ${t}`);
    if (Array.isArray(L.techAllowed)) for (const t of L.techAllowed) assert.ok(TECHS[t], `${L.id} allows ${t}`);
    assert.ok(L.objectives.length > 0, L.id + ' has objectives');
    for (const o of L.objectives) {
      if (o.card) assert.ok(exists(o.card), `${L.id} objective ${o.card}`);
      if (o.tech) assert.ok(TECHS[o.tech], `${L.id} objective tech ${o.tech}`);
    }
    for (const e of L.schedule || []) for (const [id] of e.spawn || []) assert.ok(exists(id), `${L.id} schedule ${id}`);
  }
});

test('every card can be obtained somewhere (recipe, loot, node, bundle, event or level)', () => {
  const obtainable = new Set();
  for (const r of Object.values(RECIPES)) for (const [o] of r.out) obtainable.add(o);
  for (const d of Object.values(CARDS)) {
    for (const [id] of d.region?.loot || []) obtainable.add(id);
    for (const [id] of d.region?.foes || []) obtainable.add(id);
    for (const id of d.region?.reveal || []) obtainable.add(id);
    for (const [id] of d.mob?.loot || []) obtainable.add(id);
    for (const [id] of d.open?.loot || []) obtainable.add(id);
    for (const [id] of d.node?.extra || []) obtainable.add(id);
    if (d.mob?.summon) obtainable.add(d.mob.summon.id);
    if (d.mob?.spawn) obtainable.add(d.mob.spawn.id);
    if (d.grows) obtainable.add(d.grows.to);
  }
  for (const L of Object.values(LEVELS)) for (const e of L.start) obtainable.add(e.c);
  for (const e of Object.values(EVENTS)) for (const ch of e.choices || []) for (const [id] of ch.get) obtainable.add(id);
  for (const o of [...MARKET_OFFERS, ...CARAVAN_POOL]) for (const [id] of o.get) obtainable.add(id);
  const always = new Set(['grave', 'rot', 'coin', 'caravan', 'wanderer', 'omen', 'refugees', 'great_flame', 'meteor_crater', 'shrine', 'treasure_site']);
  const missing = Object.keys(CARDS).filter((id) => !obtainable.has(id) && !always.has(id));
  assert.deepEqual(missing, []);
});
