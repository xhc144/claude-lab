// The whole knowledge base loads cleanly: ids, relations, learning order, syllabus coverage,
// animations and the words the published site must not contain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKnowledgeBase, FORBIDDEN } from '../../scripts/lib/kb.mjs';
import { ANIMATIONS } from '../../src/anim/registry.js';
import { GALAXIES } from '../../src/config.js';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const kb = loadKnowledgeBase(ROOT, { animIds: ANIMATIONS.map((a) => a.id) });

test('no errors, unresolved references or learning-order cycles', () => {
  assert.deepEqual(kb.errors, []);
  assert.deepEqual(kb.unresolved, []);
  assert.deepEqual(kb.cycles, []);
});

test('every galaxy is populated and every star is connected', () => {
  for (const g of GALAXIES) assert.ok(kb.nodes.filter((n) => n.galaxy === g.id).length >= 50, `${g.name} has too few stars`);
  assert.ok(kb.nodes.length >= 700);
  const lonely = kb.nodes.filter((n) => !kb.degree.get(n.id));
  assert.deepEqual(lonely.map((n) => n.id), []);
});

test('ids are unique and well formed', () => {
  const ids = kb.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9-]*$/);
});

test('every item of the syllabus is covered by at least one star', () => {
  assert.deepEqual(kb.uncovered, []);
  const syllabus = JSON.parse(readFileSync(join(ROOT, 'content/syllabus.json'), 'utf8'));
  const items = syllabus.groups.flatMap((g) => g.items);
  assert.ok(items.length >= 150);
});

test('every animation referenced by a star exists, and every animation is used', () => {
  const ids = new Set(ANIMATIONS.map((a) => a.id));
  const used = new Set(kb.nodes.map((n) => n.anim).filter(Boolean));
  for (const a of used) assert.ok(ids.has(a), `unknown animation ${a}`);
  for (const a of ids) assert.ok(used.has(a), `animation ${a} is not attached to any star`);
});

test('tours point at existing stars', () => {
  assert.ok(kb.tours.length >= 10);
  const ids = new Set(kb.nodes.map((n) => n.id));
  for (const t of kb.tours) for (const s of t.steps) assert.ok(ids.has(s.id), `${t.id}: ${s.id}`);
});

test('content avoids the words the published site must not contain', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  for (const f of walk(join(ROOT, 'content'))) {
    const text = readFileSync(f, 'utf8');
    for (const w of FORBIDDEN) assert.ok(!text.includes(w), `${f} contains ${w}`);
  }
});
