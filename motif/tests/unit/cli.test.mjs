// Drives the built CLI exactly as an AI agent would (JSON in, JSON out). Skipped if not built.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, tempLibrary } from './helpers.mjs';

const cli = path.join(root, 'dist/cli.mjs');
const built = fs.existsSync(cli);
const lib = tempLibrary('cli');
test.after(() => lib.cleanup());
const run = (args, input) => {
  const r = spawnSync(process.execPath, [cli, ...args, '--json'], { input, encoding: 'utf8', env: { ...process.env } });
  let json = null; try { json = JSON.parse(r.stdout); } catch { /* not json */ }
  return { code: r.status, json, stderr: r.stderr };
};

test('agent workflow: create from a document, edit with ops, read back, history', { skip: !built && 'run npm run build first' }, () => {
  const doc = path.join(root, 'examples/showcase/04-vertical-short.json');
  const c = run(['new', '--from', doc, '--agent', 'claude']);
  assert.equal(c.code, 0, c.stderr);
  const id = c.json.id;
  assert.equal(c.json.scenes, 6);
  const show = run(['show', id]);
  const firstBlock = show.json.scenes[0].blocks[0].id;
  const ops = JSON.stringify([{ op: 'update_block', block: firstBlock, set: { text: '每天 ==2 小时== 被浪费' } }, { op: 'set_theme', theme: 'noir' }]);
  const a = run(['apply', id, '-', '--agent', 'claude', '-m', '改钩子'], ops);
  assert.equal(a.code, 0);
  assert.equal(a.json.ok, true);
  assert.equal(a.json.revision, 1);
  const full = run(['show', id, '--full']);
  assert.equal(full.json.document.theme.id, 'noir');
  assert.match(JSON.stringify(full.json.document), /2 小时/);
  const h = run(['history', id]);
  assert.equal(h.json[0].author, 'claude');
  assert.equal(h.json[0].message, '改钩子');
});

test('failed ops exit 3 and leave the project unchanged', { skip: !built }, () => {
  const c = run(['new', '空白']);
  const a = run(['apply', c.json.id, '-'], JSON.stringify([{ op: 'remove_scene', scene: 3 }]));
  assert.equal(a.code, 3);
  assert.equal(a.json.saved, false);
});

test('reference material and tool schemas are available', { skip: !built }, () => {
  const t = run(['tools', '--format', 'openai']);
  assert.ok(t.json.length >= 20 && t.json.every((x) => x.type === 'function'));
  const tpl = run(['templates']);
  assert.ok(tpl.json.length >= 10);
  const th = run(['themes']);
  assert.equal(th.json.filter((x) => !x.user).length, 10);
  const cat = spawnSync(process.execPath, [cli, 'catalog', 'chart'], { encoding: 'utf8' });
  assert.match(cat.stdout, /kind/);
});
