'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../app/state.cjs');
// 测试目录在 %LOCALAPPDATA%Temp 下，会被“不能整理系统目录”拦下，这里改掉环境变量。
for (const k of ['LOCALAPPDATA', 'APPDATA', 'USERPROFILE']) delete process.env[k];

test('旧版设置升级：日期+智能分类 → 学科大类/月份', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'filenest-state-'));
  const data = path.join(base, 'data'), root = path.join(base, '下载');
  fs.mkdirSync(data); fs.mkdirSync(root);
  fs.writeFileSync(path.join(data, 'settings-v2.json'), JSON.stringify({ Version: 2, Paused: false, Rules: [{ Id: 'b4401ec0dc5a47f4839c7e1d2f3ffaa7', Name: '项目06', Root: root, DailyTime: '20:00', LastAutoDate: '', Mode: 2, Schedule: 0, DateSource: 0, Enabled: true, IncludeFolders: true, GenerateContext: false, StableSeconds: 30 }], ContextHistory: [] }));
  const store = new Store(data, path.join(base, 'app'));
  const r = store.value.Rules[0];
  assert.equal(r.Mode, 4); assert.equal(r.DateGranularity, 'month'); assert.equal(r.Enabled, true);
  assert.ok(store.notice.includes('学科大类'));
  assert.ok(fs.existsSync(path.join(data, 'settings-v3.json')));
  assert.ok(store.value.Categories.length >= 5);
  // 分类校验
  assert.throws(() => store.saveCategories([{ Name: '其他', Keywords: [] }]), /兜底/);
  store.saveCategories([{ Name: '课程', Keywords: '高数, 线代，概率' }]);
  assert.deepEqual(new Store(data, path.join(base, 'app')).value.Categories[0].Keywords, ['高数', '线代', '概率']);
  store.addExclude(r.Id, '999-已归档');
  assert.deepEqual(store.value.Rules[0].Excludes, ['999-已归档']);
});
