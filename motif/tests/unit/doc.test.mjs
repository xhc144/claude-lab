import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDocument, validateDocument, createDocument, summarizeDocument, findScene, findBlock } from '../../src/core/doc.js';

test('scene shorthand becomes blocks with ids', () => {
  const { doc, warnings } = normalizeDocument({ title: 'T', theme: 'swiss', aspect: '9:16', scenes: [{ title: '你好', subtitle: '副标题', bullets: ['a', 'b'] }] });
  assert.equal(doc.theme.id, 'swiss');
  assert.deepEqual([doc.format.width, doc.format.height, doc.format.aspect], [1080, 1920, '9:16']);
  const s = doc.scenes[0];
  assert.match(s.id, /^s_/);
  assert.deepEqual(s.blocks.map((b) => b.type), ['title', 'bullets']);
  assert.equal(s.blocks[0].subtitle, '副标题');
  assert.ok(s.blocks.every((b) => /^b_/.test(b.id)));
  assert.equal(warnings.filter((w) => w.level === 'error').length, 0);
});

test('aliases resolve and unknown types are reported with a suggestion', () => {
  const { doc, warnings } = normalizeDocument({ slides: [{ blocks: [{ type: 'heading', text: 'x' }, { type: 'barchart', data: { a: 1 } }, { type: 'chrat' }] }] });
  assert.deepEqual(doc.scenes[0].blocks.slice(0, 2).map((b) => b.type), ['title', 'chart']);
  const err = warnings.find((w) => w.level === 'error');
  assert.ok(err && /chrat/.test(err.message) && /chart/.test(err.hint));
});

test('layout aliases and transition strings normalise', () => {
  const { doc } = normalizeDocument({ scenes: [{ layout: 'two-column', transition: 'band', background: '#112233', title: 'x' }] });
  const s = doc.scenes[0];
  assert.equal(s.layout, 'split');
  assert.deepEqual(s.transition, { type: 'band' });
  assert.deepEqual(s.background, { type: 'solid', color: '#112233' });
});

test('image decorative frame string becomes mount (never a position)', () => {
  const { doc } = normalizeDocument({ scenes: [{ blocks: [{ type: 'image', src: 'a.png', frame: 'phone', motion: 'kenburns' }] }] });
  const b = doc.scenes[0].blocks[0];
  assert.equal(b.mount, 'phone');
  assert.equal(b.move, 'kenburns');
  assert.equal(b.frame, undefined);
  assert.equal(b.motion, undefined);
});

test('duplicate ids across scenes are made unique', () => {
  const { doc } = normalizeDocument({ scenes: [{ id: 's_a', blocks: [{ id: 'b_1', type: 'text', text: 'x' }] }, { id: 's_a', blocks: [{ id: 'b_1', type: 'text', text: 'y' }] }] });
  const ids = doc.scenes.flatMap((s) => [s.id, ...s.blocks.map((b) => b.id)]);
  assert.equal(new Set(ids).size, ids.length);
});

test('validation flags bad enum values and missing assets', () => {
  const { doc } = normalizeDocument({ scenes: [{ blocks: [{ type: 'chart', kind: 'pie3d', data: [1, 2] }, { type: 'image', asset: 'ast_missing' }] }] });
  const issues = validateDocument(doc);
  assert.equal(doc.scenes[0].blocks[0].kind, 'pie', 'pie3d is understood as pie');
  const bad = validateDocument(normalizeDocument({ scenes: [{ blocks: [{ type: 'chart', kind: 'pyramid', data: [1] }] }] }).doc);
  assert.ok(bad.some((i) => i.level === 'error' && /pyramid/.test(i.message)));
  assert.ok(issues.some((i) => i.level === 'error' && /ast_missing/.test(i.message)));
});

test('createDocument, summary and lookups', () => {
  const doc = createDocument({ title: '作品', theme: 'ink', scenes: [{ title: '一' }, { title: '二', stat: 42 }] });
  assert.equal(doc.theme.id, 'ink');
  assert.match(summarizeDocument(doc), /作品/);
  assert.equal(findScene(doc, 2).id, doc.scenes[1].id);
  const b = doc.scenes[1].blocks.find((x) => x.type === 'stat');
  assert.equal(findBlock(doc, b.id).block, b);
});
