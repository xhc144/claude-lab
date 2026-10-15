import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../../src/core/doc.js';
import { applyOps, OPS } from '../../src/core/ops.js';

const base = () => createDocument({ title: 'T', scenes: [{ title: 'A' }, { title: 'B', bullets: ['x', 'y'] }, { title: 'C' }] });

test('add / update / move / remove scenes and blocks', () => {
  let d = base();
  let r = applyOps(d, [{ op: 'add_scene', after: 1, scene: { title: '新', stat: 9 } }]);
  assert.ok(r.ok); d = r.doc;
  assert.equal(d.scenes.length, 4);
  assert.equal(d.scenes[1].blocks[0].text, '新');
  const sid = r.results[0].id;
  r = applyOps(d, [{ op: 'add_block', scene: sid, block: { type: 'text', text: '说明' } }, { op: 'move_scene', scene: sid, position: 4 }]);
  assert.ok(r.ok); d = r.doc;
  assert.equal(d.scenes[3].id, sid);
  const bid = d.scenes[3].blocks.find((b) => b.type === 'text').id;
  r = applyOps(d, [{ op: 'update_block', block: bid, set: { text: '改了', style: { color: 'accent' } } }]);
  d = r.doc;
  assert.equal(d.scenes[3].blocks.find((b) => b.id === bid).text, '改了');
  r = applyOps(d, [{ op: 'update_block', block: bid, set: { style: null } }, { op: 'remove_scene', scene: 1 }]);
  d = r.doc;
  assert.equal(d.scenes.length, 3);
  assert.equal(d.scenes[2].blocks.find((b) => b.id === bid).style, undefined);
});

test('a failing op leaves the document untouched (atomic) and suggests a fix', () => {
  const d = base();
  const r = applyOps(d, [{ op: 'set_title', title: '新标题' }, { op: 'update_blok', block: 'x' }]);
  assert.equal(r.ok, false);
  assert.equal(r.doc, d);
  assert.equal(d.title, 'T');
  const bad = r.results.find((x) => !x.ok);
  assert.match(bad.hint, /update_block/);
});

test('unknown block reference explains what exists', () => {
  const r = applyOps(base(), [{ op: 'remove_block', block: 'b_nope' }]);
  assert.equal(r.ok, false);
  assert.ok(r.results[0].error.includes('b_nope'));
});

test('partial mode keeps successful ops', () => {
  const r = applyOps(base(), [{ op: 'set_title', title: 'X' }, { op: 'remove_scene', scene: 99 }], { partial: true });
  assert.equal(r.ok, false);
  assert.equal(r.doc.title, 'X');
});

test('theme, style, format and aliases', () => {
  const r = applyOps(base(), [{ op: 'theme', theme: 'noir', accent: '#ff0055' }, { op: 'style', energy: 0.9 }, { op: 'aspect', aspect: '1:1' }]);
  assert.ok(r.ok);
  assert.equal(r.doc.theme.id, 'noir');
  assert.equal(r.doc.theme.accent, '#ff0055');
  assert.equal(r.doc.style.energy, 0.9);
  assert.deepEqual([r.doc.format.width, r.doc.format.height], [1080, 1080]);
});

test('replace_document keeps identity and assets', () => {
  const d = base();
  d.assets = { ast_1: { id: 'ast_1', file: 'assets/a.png', kind: 'image' } };
  const r = applyOps(d, [{ op: 'replace_document', document: { title: '全新', scenes: [{ title: 'Z' }] } }]);
  assert.equal(r.doc.id, d.id);
  assert.equal(r.doc.title, '全新');
  assert.ok(r.doc.assets.ast_1);
  assert.equal(r.doc.scenes.length, 1);
});

test('every op documents its params', () => {
  for (const [k, v] of Object.entries(OPS)) {
    assert.ok(v.desc && typeof v.apply === 'function', k);
    assert.ok(v.params && typeof v.params === 'object', k);
  }
});
