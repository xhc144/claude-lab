'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { Translator, cleanZh } = require('../app/translate.cjs');
const { Engine } = require('../app/engine.cjs');

const DICT = { langlands: '朗兰兹纲领', shifted_path_distance_spectra: '平移路径距离矩阵的谱', 'Visualization of Seifert Surfaces': 'Seifert曲面可视化' };

// 假的 OpenAI 兼容接口：按行号返回 JSON 数组
function fakeServer(t, { fail = false } = {}) {
  const seen = { requests: 0, auth: '' };
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
      seen.requests++; seen.auth = req.headers.authorization || '';
      if (fail) { res.writeHead(500); res.end('boom'); return; }
      const lines = JSON.parse(body).messages[1].content.split('\n').map(l => l.replace(/^\d+\.\s*/, ''));
      const out = lines.map(l => DICT[l] || '');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(out) + '\n```' } }] }));
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => { t.after(() => server.close()); r({ url: 'http://127.0.0.1:' + server.address().port + '/v1', seen }); }));
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'filenest-tr-'));

test('译文清理：去引号扩展名，没有中文的不要', () => {
  assert.equal(cleanZh('“朗兰兹纲领.mp4”'), '朗兰兹纲领');
  assert.equal(cleanZh('Langlands'), '');
  assert.equal(cleanZh('类域论: 入门'), '类域论：入门');
});

test('批量翻译、缓存、带上密钥；同一个名字只问一次', async t => {
  const { url, seen } = await fakeServer(t);
  const d = tmp();
  const tr = new Translator({ dataDirectory: d });
  tr.save({ Enabled: true, BaseUrl: url, Model: 'm', Key: 'sk-test' });
  assert.equal(await tr.ensure(['langlands', 'shifted_path_distance_spectra', 'langlands']), 2);
  assert.equal(tr.lookup('langlands'), '朗兰兹纲领');
  assert.equal(seen.auth, 'Bearer sk-test');
  await tr.ensure(['langlands']);
  assert.equal(seen.requests, 1, '缓存命中不再请求');
  assert.equal(new Translator({ dataDirectory: d }).lookup('shifted_path_distance_spectra'), '平移路径距离矩阵的谱', '缓存写到磁盘');
  assert.equal(tr.publicConfig().HasKey, true);
  assert.ok(!JSON.stringify(tr.publicConfig()).includes('sk-test'), '界面拿不到密钥');
});

test('接口出错时不抛出、不写缓存，记下原因', async t => {
  const { url } = await fakeServer(t, { fail: true });
  const tr = new Translator({ dataDirectory: tmp() });
  tr.save({ Enabled: true, BaseUrl: url, Model: 'm' });
  assert.equal(await tr.ensure(['langlands']), 0);
  assert.equal(tr.lookup('langlands'), '');
  assert.match(tr.publicConfig().LastError, /500/);
});

test('整理时：内容里没中文的英文名用译名，“中文_英文名”；没开翻译时不改', async t => {
  const { url } = await fakeServer(t);
  const base = tmp(), root = path.join(base, '下载'), data = path.join(base, 'data');
  fs.mkdirSync(root); fs.mkdirSync(data);
  fs.writeFileSync(path.join(root, 'langlands.mp4'), 'x'); const w = new Date('2026-09-28'); fs.utimesSync(path.join(root, 'langlands.mp4'), w, w);
  const tr = new Translator({ dataDirectory: data });
  tr.save({ Enabled: true, BaseUrl: url, Model: 'm' });
  const engine = new Engine({ dataDirectory: data, now: () => new Date(Date.now() + 86400000) });
  const rule = { Id: 'd'.repeat(32), Name: '测试', Root: root, Mode: 1, DateGranularity: 'month', DateSource: 1, IncludeFolders: true, StableSeconds: 30, Excludes: [] };
  assert.deepEqual(engine.translationCandidates(rule), ['langlands']);
  assert.equal(engine.plan(rule).Moves[0].Destination.endsWith('langlands.mp4'), true, '不开翻译不改名');
  await tr.ensure(engine.translationCandidates(rule));
  engine.execute(rule, engine.plan(rule, undefined, { translate: s => tr.lookup(s) }));
  assert.ok(fs.existsSync(path.join(root, '视频音频', '数学科普视频', '朗兰兹纲领_langlands.mp4')));
});
