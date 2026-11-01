'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SearchIndex } = require('../app/search.cjs');

test('索引与查找', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'filenest-search-'));
  for (const f of ['数学/2026-10/微分几何.pdf', '数学/2026-10/微分方程.zip', '物理/2026-10/量子力学.pdf', '2026-09-15/旧的微分笔记.pdf', 'desktop.ini']) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), 'x');
  }
  const index = new SearchIndex();
  await index.build([{ Id: 'r', Name: '下载', Root: root }]);
  assert.equal(index.query({ q: '微分' }).total, 3);
  assert.equal(index.query({ q: '微分', type: 'pdf' }).total, 2);
  assert.equal(index.query({ q: '微分', top: '数学' }).total, 2);
  assert.equal(index.query({ q: 'desktop' }).total, 0);
  assert.deepEqual(index.tops('r').map(t => t.name).sort(), ['2026-09-15', '数学', '物理'].sort());
  assert.ok(index.has(path.join(root, '物理', '2026-10', '量子力学.pdf')));
  assert.ok(!index.has('C:\\Windows\\notepad.exe'));
});
