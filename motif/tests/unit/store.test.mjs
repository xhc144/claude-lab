import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempLibrary, inputs } from './helpers.mjs';

const lib = tempLibrary('store');
const store = await import('../../src/core/store/index.js');
test.after(() => lib.cleanup());

test('create from template, list, resolve by id / title / prefix', () => {
  const r = store.createProject({ title: '季度复盘', template: 'annual-report', author: 'test' });
  assert.ok(fs.existsSync(path.join(r.dir, 'project.json')));
  assert.equal(r.revision, 0);
  const all = store.listProjects();
  assert.equal(all.length, 1);
  assert.equal(store.resolveProject(r.id), r.dir);
  assert.equal(store.resolveProject('季度复盘'), r.dir);
  assert.equal(store.resolveProject(r.id.slice(4, 8)), r.dir);
  assert.throws(() => store.resolveProject('不存在的作品'), /找不到项目/);
});

test('edit through ops bumps revision, snapshots history, detects conflicts', () => {
  const { id, dir } = store.createProject({ title: '编辑测试' });
  const e = store.editProject(id, [{ op: 'add_scene', scene: { title: '一' } }], { author: 'ai', message: 'AI 加场景' });
  assert.equal(e.saved, true);
  assert.equal(e.revision, 1);
  const h = store.listHistory(id);
  assert.equal(h[0].author, 'ai');
  assert.equal(h[0].message, 'AI 加场景');
  const { doc } = store.loadProject(id);
  assert.throws(() => store.saveProject(dir, doc, { expectRevision: 0 }), (err) => err.code === 'CONFLICT');
  const restored = store.restoreRevision(id, 0);
  assert.equal(restored.doc.scenes.length, 0);
  assert.equal(restored.revision, 2);
  store.nameVersion(id, '初稿');
  assert.ok(store.listHistory(id).some((x) => x.named === '初稿'));
});

test('failed ops are not saved', () => {
  const { id } = store.createProject({ title: '失败测试' });
  const e = store.editProject(id, [{ op: 'remove_scene', scene: 5 }]);
  assert.equal(e.saved, false);
  assert.equal(store.loadProject(id).doc.meta.revision, 0);
});

test('assets are copied, hashed, probed and deduplicated', async () => {
  const { id, dir } = store.createProject({ title: '资源测试' });
  const a = await store.importAsset(id, path.join(inputs, 'product.png'));
  assert.equal(a.kind, 'image');
  assert.deepEqual([a.width, a.height], [1200, 800]);
  assert.ok(fs.existsSync(path.join(dir, a.file)));
  const again = await store.importAsset(id, path.join(inputs, 'product.png'));
  assert.equal(again.id, a.id);
});

test('user templates and components round-trip', () => {
  const { id } = store.createProject({ title: '模板源', template: 'launch' });
  const t = store.saveAsTemplate(id, { name: '我的发布会' });
  assert.ok(store.listTemplates().some((x) => x.id === t.id && !x.builtin));
  const fromT = store.createProject({ title: '用模板', template: t.id });
  assert.equal(fromT.doc.scenes.length, store.loadProject(id).doc.scenes.length);
  const block = store.loadProject(id).doc.scenes[1].blocks[0];
  const c = store.saveComponent({ name: '大数字', project: id, block: block.id });
  assert.equal(store.getComponent(c.id).kind, 'block');
  assert.ok(store.listComponents().some((x) => x.id === c.id));
  store.deleteComponent(c.id);
  assert.ok(!store.listComponents().some((x) => x.id === c.id));
});

test('duplicate and delete (to trash)', () => {
  const { id } = store.createProject({ title: '原件' });
  const dup = store.duplicateProject(id);
  assert.notEqual(dup.id, id);
  const trashed = store.deleteProject(id);
  assert.ok(trashed.includes('.trash'));
  assert.throws(() => store.resolveProject(id));
});
