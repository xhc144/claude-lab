// End-to-end: needs a TeX engine (bundled Tectonic, TeX Live or MiKTeX); skipped without one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { convert, findEngines } from '../src/core/convert.js';
import { parseLog } from '../src/core/compile.js';

const FIX = path.resolve(import.meta.dirname, '../fixtures/selftest');
const engine = findEngines()[0];

test('parseLog reads file:line errors and classic "!" errors', () => {
  const log = './main.tex:12: Undefined control sequence.\nl.12 \\foo\n\n! Missing $ inserted.\n<inserted text>\n$\nl.30 x^2\n';
  const errs = parseLog(log);
  assert.deepEqual(errs.map((e) => [e.file, e.line]), [['main.tex', 12], ['main.tex', 30]]);
});

test('edge cases compile; exactly the three broken formulas fall back', { skip: !engine && 'no TeX engine', timeout: 600000 }, async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-compile-'));
  const r = await convert(path.join(FIX, 'edge-cases.html'), { style: 'chat', outRoot: out, engine, fetchImages: false });
  assert.ok(r.pdfPath && fs.statSync(r.pdfPath).size > 10000);
  assert.equal(r.repaired, 3);
  assert.equal(r.style, 'chat');
  const tex = fs.readFileSync(r.texPath, 'utf8');
  assert.match(tex, /\\mtbadmath\{\\textbackslash\{\}foo/);
  assert.ok(fs.existsSync(path.join(r.outDir, 'images', 'img-1.png')), 'data: image saved');
});

test('ChatGPT page compiles in the notes style without any fallback', { skip: !engine && 'no TeX engine', timeout: 600000 }, async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-compile-'));
  const r = await convert(path.join(FIX, 'chatgpt-2026.html'), { style: 'notes', outRoot: out, engine, fetchImages: false, title: '上三角 讲义' });
  assert.ok(r.pdfPath);
  assert.equal(r.repaired, 0);
  assert.equal(r.style, 'notes');
  assert.ok(fs.existsSync(path.join(r.outDir, 'mojing-notes.cls')), 'class files travel with the .tex');
});
