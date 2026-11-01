'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Engine } = require('../app/engine.cjs');
const { categorize } = require('../app/classify.cjs');

function sandbox() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'filenest-test-'));
  const root = path.join(base, '下载'), data = path.join(base, 'data');
  fs.mkdirSync(root); fs.mkdirSync(data);
  return { base, root, data };
}
function touch(file, text = 'x', when = new Date('2026-09-28T10:00:00')) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text); fs.utimesSync(file, when, when);
}
const rule = (root, extra = {}) => ({ Id: 'a'.repeat(32), Name: '测试', Root: root, Mode: 4, DateGranularity: 'month', DateSource: 1, IncludeFolders: true, StableSeconds: 30, Excludes: [], ...extra });
const exists = p => fs.existsSync(p);
const later = () => new Date(Date.now() + 86400000);

test('新文件按 学科大类/月份 归档，旧日期文件夹不动', () => {
  const { root, data } = sandbox();
  touch(path.join(root, '三个渐近估计问题_解答.pdf'));
  touch(path.join(root, '理论力学速通讲义.pdf'));
  touch(path.join(root, '英语词汇冲刺.pdf'));
  touch(path.join(root, 'Claude Setup.exe'));
  touch(path.join(root, '9BE586B8E8951_8CE98D96.pdf'));
  touch(path.join(root, '2026-09-15', '旧文件.pdf'));
  const engine = new Engine({ dataDirectory: data, now: later });
  const plan = engine.plan(rule(root));
  assert.equal(plan.Moves.length, 5);
  const r = engine.execute(rule(root), plan);
  assert.equal(r.Moved, 5, JSON.stringify(r));
  assert.ok(exists(path.join(root, '数学', '竞赛与题库', '2026-09', '三个渐近估计问题_解答.pdf')));
  assert.ok(exists(path.join(root, '物理', '力学', '2026-09', '理论力学速通讲义.pdf')));
  assert.ok(exists(path.join(root, '英语', '词汇', '2026-09', '英语词汇冲刺.pdf')));
  assert.ok(exists(path.join(root, '编程与软件', '安装包', '2026-09', 'Claude Setup.exe')));
  assert.ok(exists(path.join(root, '其他', '2026-09', '9BE586B8E8951_8CE98D96.pdf')));
  assert.ok(exists(path.join(root, '2026-09-15', '旧文件.pdf')));
  // 再跑一次不会套层
  assert.equal(engine.plan(rule(root)).Moves.length, 0);
});

test('细分只用设置里的固定主题，不按文件名新建文件夹', () => {
  const { root, data } = sandbox();
  for (const n of ['三个渐近估计问题_多路线探索版.pdf', '重积分与含参积分_整理版.pdf', '卡特兰数与鞅.pdf', '近期数学结果.pdf'])
    touch(path.join(root, n));
  const engine = new Engine({ dataDirectory: data, now: later });
  engine.execute(rule(root), engine.plan(rule(root)));
  const topics = fs.readdirSync(path.join(root, '数学')).sort();
  assert.deepEqual(topics, ['分析与微积分', '概率与统计', '讲义与综合']);
  assert.equal(fs.readdirSync(path.join(root, '数学', '分析与微积分', '2026-09')).length, 2);
});

test('含 desktop.ini 的自定义文件夹和排除项保留原位；网页附件文件夹跟随网页', () => {
  const { root, data } = sandbox();
  touch(path.join(root, '999-已归档', 'desktop.ini'));
  touch(path.join(root, '999-已归档', 'a.pdf'));
  touch(path.join(root, '我的收藏', 'b.pdf'));
  touch(path.join(root, 'Claude Code.html'));
  touch(path.join(root, 'Claude Code_files', 'x.js'));
  const engine = new Engine({ dataDirectory: data, now: later });
  const r1 = rule(root, { Excludes: ['我的收藏'] });
  const plan = engine.plan(r1);
  assert.deepEqual(plan.Kept.sort(), ['999-已归档', '我的收藏'].sort());
  engine.execute(r1, plan);
  assert.ok(exists(path.join(root, '999-已归档', 'a.pdf')));
  assert.ok(exists(path.join(root, '我的收藏', 'b.pdf')));
  assert.ok(exists(path.join(root, '编程与软件', 'AI技能与工具', '2026-09', 'Claude Code.html')));
  assert.ok(exists(path.join(root, '编程与软件', 'AI技能与工具', '2026-09', 'Claude Code_files', 'x.js')));
});

test('撤销把文件移回并删除新建的空文件夹；同名不覆盖', () => {
  const { root, data } = sandbox();
  touch(path.join(root, '微分几何.pdf'), 'new');
  touch(path.join(root, '数学', '几何与拓扑', '2026-09', '微分几何.pdf'), 'old');
  touch(path.join(root, '链摆.pdf'));
  const engine = new Engine({ dataDirectory: data, now: later });
  const r = engine.execute(rule(root), engine.plan(rule(root)));
  assert.equal(r.Moved, 2);
  assert.ok(exists(path.join(root, '数学', '几何与拓扑', '2026-09', '微分几何 (2).pdf')));
  assert.equal(fs.readFileSync(path.join(root, '数学', '几何与拓扑', '2026-09', '微分几何.pdf'), 'utf8'), 'old');
  const activity = engine.activity();
  assert.equal(activity[0].Moved, 2);
  const u = engine.undo(activity[0].Id);
  assert.equal(u.Moved, 2, JSON.stringify(u));
  assert.equal(fs.readFileSync(path.join(root, '微分几何.pdf'), 'utf8'), 'new');
  assert.ok(exists(path.join(root, '链摆.pdf')));
  assert.ok(!exists(path.join(root, '物理')), '为整理新建的空文件夹应被删除');
  assert.ok(exists(path.join(root, '数学', '几何与拓扑', '2026-09', '微分几何.pdf')));
  assert.equal(engine.undo(activity[0].Id).Moved, 0);
});

test('刚写入的文件等待稳定；下载中的文件不动', () => {
  const { root, data } = sandbox();
  touch(path.join(root, '微分几何.pdf'), 'x', new Date());
  touch(path.join(root, '大文件.pdf.crdownload'));
  let clock = new Date();
  const engine = new Engine({ dataDirectory: data, now: () => clock });
  const p1 = engine.plan(rule(root));
  assert.equal(p1.Moves.length, 1);
  assert.equal(p1.Moves[0].Ready, false);
  assert.equal(engine.execute(rule(root), p1).Moved, 0);
  clock = new Date(clock.getTime() + 31000);
  const p2 = engine.plan(rule(root));
  assert.equal(p2.Moves[0].Ready, true);
  assert.equal(engine.execute(rule(root), p2).Moved, 1);
  assert.ok(exists(path.join(root, '大文件.pdf.crdownload')));
});

test('其他布局：按日期(按天)、只按大类、日期→大类', () => {
  for (const [extra, expected] of [
    [{ Mode: 0, DateGranularity: 'day' }, ['2026-09-28', '微分几何.pdf']],
    [{ Mode: 1 }, ['数学', '几何与拓扑', '微分几何.pdf']],
    [{ Mode: 5 }, ['2026-09', '数学', '几何与拓扑', '微分几何.pdf']]
  ]) {
    const { root, data } = sandbox();
    touch(path.join(root, '微分几何.pdf'));
    const engine = new Engine({ dataDirectory: data, now: later });
    engine.execute(rule(root, extra), engine.plan(rule(root, extra)));
    assert.ok(exists(path.join(root, ...expected)), JSON.stringify(extra));
  }
});

test('旧版撤销记录可以读取', () => {
  const { root, data } = sandbox();
  touch(path.join(root, '2026-10-17', 'humanizer.zip'));
  const id = '202610170933452589341-69f3b27917b34a94bda601e27fe67464';
  fs.mkdirSync(path.join(data, 'journal'), { recursive: true });
  fs.writeFileSync(path.join(data, 'journal', id + '.json'), JSON.stringify({ Version: 1, Id: id, Root: root, CreatedUtc: '2026-10-17T09:33:45Z', Entries: [{ Source: path.join(root, 'humanizer.zip'), Destination: path.join(root, '2026-10-17', 'humanizer.zip'), Signature: 'cgB1Nek=', State: 'moved', Error: null, IsDirectory: false }], CreatedDirectories: [] }));
  const engine = new Engine({ dataDirectory: data, now: later });
  assert.equal(engine.activity()[0].Moved, 1);
  assert.equal(engine.undo().Moved, 1);
  assert.ok(exists(path.join(root, 'humanizer.zip')));
});

test('分类关键词：文件名优先，媒体按扩展名优先', () => {
  const c = n => { const r = categorize(n, { probe: false }); return r.topic ? r.category + '/' + r.topic : r.category; };
  assert.equal(c('扭结记号_中文动画.mp4'), '视频音频/数学科普视频');
  assert.equal(c('雨夜，最后一袋猫粮-便携版.mp4'), '视频音频/短片与其他');
  assert.equal(c('04_热力学与统计物理_提示词.md'), '物理/量子与热统');
  assert.equal(c('新领军英语考情与备考报告.pdf'), '英语/试卷与测评');
  assert.equal(c('瑞青新能源BIP_ERP项目启动大会.pptx'), '其他');
  assert.equal(c('积分最小值问题 - Claude (2026_10_26 00：32：44).html'), '数学/分析与微积分');
  assert.equal(c('Folio-Setup-0.2.1.exe'), '编程与软件/安装包');
  assert.equal(c('四大力学速成讲义.pdf'), '物理/综合与备考');
});

test('按学科大类整理时放进细分主题文件夹', () => {
  const { root, data } = sandbox();
  touch(path.join(root, '卡方分布与t分布_详细讲义.pdf'));
  const engine = new Engine({ dataDirectory: data, now: later });
  const r = { ...rule(root), Mode: 1 };
  engine.execute(r, engine.plan(r));
  assert.ok(exists(path.join(root, '数学', '概率与统计', '卡方分布与t分布_详细讲义.pdf')));
});
