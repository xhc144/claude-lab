'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Engine } = require('../app/engine.cjs');
const { suggestName, zipNames } = require('../app/naming.cjs');

// 不压缩的最小 zip，文件名按 UTF-8 标记
function makeZip(file, names) {
  const locals = [], centrals = []; let off = 0;
  for (const n of names) {
    const nb = Buffer.from(n, 'utf8');
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(nb.length, 26);
    locals.push(lh, nb);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    centrals.push(ch, nb); off += 30 + nb.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  fs.writeFileSync(file, Buffer.concat([...locals, cd, end]));
}
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); const w = new Date('2026-09-28T10:00:00'); fs.utimesSync(file, w, w); }
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'filenest-name-')); }

test('从内容找中文名：网页标题、压缩包、文件夹、tex、md', () => {
  const d = tmp();
  put(path.join(d, 'coin_pattern.html'), '<html><head><title>抛硬币直到正正反或正反正 - Claude</title></head></html>');
  put(path.join(d, 'index.html'), '<title>三叶结 · Seifert 算法逐步可视化</title>');
  put(path.join(d, 'echo.html'), '<title>Echo Wild</title>');
  makeZip(path.join(d, 'integrals_30_bundle.zip'), ['积分三十题/积分三十题_题目册.pdf', '积分三十题/README.txt']);
  makeZip(path.join(d, 'tool.zip'), ['tool/README-先读.txt', 'tool/main.js']);
  put(path.join(d, 'burnside', 'Burnside引理速通讲义.pdf'), 'x');
  put(path.join(d, 'site', 'index.html'), '<title>数境 MathScape · 交互式数学可视化</title>');
  put(path.join(d, 'notes.tex'), '\\documentclass{ctexart}\\title{单调函数的最优节点}\\begin{document}');
  put(path.join(d, 'optimization.md'), '# 最优化：从找最大最小到 AI\n正文');
  assert.deepEqual(zipNames(path.join(d, 'integrals_30_bundle.zip')).slice(0, 1), ['积分三十题/积分三十题_题目册.pdf']);
  const s = (n, dir = false) => suggestName(path.join(d, n), dir);
  assert.equal(s('coin_pattern.html'), '抛硬币直到正正反或正反正_coin_pattern');
  assert.equal(s('index.html'), '三叶结 · Seifert 算法逐步可视化', '没意义的原名只留中文');
  assert.equal(s('echo.html'), '', '标题没有中文就不改');
  assert.equal(s('integrals_30_bundle.zip'), '积分三十题_integrals_30_bundle');
  assert.equal(s('tool.zip'), '', '只有说明文件是中文的不算');
  assert.equal(s('burnside', true), 'Burnside引理速通讲义_burnside');
  assert.equal(s('site', true), '数境 MathScape · 交互式数学可视化_site');
  assert.equal(s('notes.tex'), '单调函数的最优节点', 'notes 没意义，只留中文');
  assert.equal(s('optimization.md'), '最优化：从找最大最小到 AI_optimization');
});

test('整理时英文名文件夹和压缩包加中文名，撤销改回', () => {
  const base = tmp(), root = path.join(base, '下载'), data = path.join(base, 'data');
  put(path.join(root, 'burnside', 'Burnside引理速通讲义.pdf'), 'x');
  makeZip(path.join(root, 'integrals_30_bundle.zip'), ['积分三十题/积分三十题_题目册.pdf']);
  fs.mkdirSync(data);
  const r = { Id: 'c'.repeat(32), Name: '测试', Root: root, Mode: 1, DateGranularity: 'month', DateSource: 1, IncludeFolders: true, StableSeconds: 30, Excludes: [] };
  const engine = new Engine({ dataDirectory: data, now: () => new Date(Date.now() + 86400000) });
  engine.execute(r, engine.plan(r));
  assert.ok(fs.existsSync(path.join(root, '数学', '分析与微积分', '积分三十题_integrals_30_bundle.zip')));
  assert.ok(fs.existsSync(path.join(root, '数学', '代数与数论', 'Burnside引理速通讲义_burnside')));
  assert.equal(engine.undo().Moved, 2);
  assert.ok(fs.existsSync(path.join(root, 'burnside')) && fs.existsSync(path.join(root, 'integrals_30_bundle.zip')));
});
