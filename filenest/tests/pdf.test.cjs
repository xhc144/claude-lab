'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Engine } = require('../app/engine.cjs');
const { isMeaninglessName, titleFromPdf, readPdf, findTools, chineseTitleFromPdf, bilingualName } = require('../app/pdf.cjs');

// 生成一个最小的真 PDF：Info 里的标题用 UTF-16BE，正文一行英文
function makePdf(file, title, body) {
  const hex = title ? '<FEFF' + Buffer.from(title, 'utf16le').swap16().toString('hex').toUpperCase() + '>' : '()';
  const stream = 'BT /F1 18 Tf 72 720 Td (' + body + ') Tj ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Title ' + hex + ' >>'
  ];
  let out = '%PDF-1.4\n'; const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out, 'latin1');
  const when = new Date('2026-09-28T10:00:00'); fs.utimesSync(file, when, when);
}
function sandbox() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'filenest-pdf-'));
  const root = path.join(base, '下载'), data = path.join(base, 'data');
  fs.mkdirSync(root); fs.mkdirSync(data);
  return { root, data };
}
const rule = root => ({ Id: 'b'.repeat(32), Name: '测试', Root: root, Mode: 1, DateGranularity: 'month', DateSource: 1, IncludeFolders: true, StableSeconds: 30, Excludes: [] });
const later = () => new Date(Date.now() + 86400000);
const noTools = !findTools();

test('看不出内容的文件名', () => {
  for (const n of ['main', '讲义', 'handout (2)', 'notes_v2', '论文', '12345', '9BE586B8E8951_8CE98D96E796AF%91', 'BCE9BFBCE8A1', 'A6E787B9E9981.11-1.13'])
    assert.equal(isMeaninglessName(n), true, n);
  for (const n of ['微分几何', 'Complete_Geometry_Notes', '2027_Tsinghua_Math_Sprint', 'lecture_reformatted', 'Sturm比较定理讲义'])
    assert.equal(isMeaninglessName(n), false, n);
});

test('标题挑选：元数据优先，乱码和公式碎片不要', () => {
  assert.equal(titleFromPdf({ title: '阿罗不可能定理: 完整证明', text: '' }), '阿罗不可能定理：完整证明');
  assert.equal(titleFromPdf({ title: 'main.tex', text: 'Original / Page 1\n\n进阶九学\n\n高等数学拔尖计划\n' }), '进阶九学_高等数学拔尖计划');
  assert.equal(titleFromPdf({ title: '‫ࣴࢨࣉ‬࿐', text: 'ππ −2, 2\n曲率约束下的弦长估计\n' }), '曲率约束下的弦长估计');
  assert.equal(titleFromPdf({ title: '', text: '1\n2\n' }), '');
});

test('中文标题挑选：去章节号、不要图注和正文句子', () => {
  const body = '这是一段足够长的正文，用来模拟讲义首页上的大量中文文字，满足首页文字量的要求，不是图集页面。'.repeat(2);
  assert.equal(chineseTitleFromPdf({ title: '', text: '1 多项式零点集中的线性空间\n' + body }), '多项式零点集中的线性空间');
  assert.equal(chineseTitleFromPdf({ title: '', text: '区域 2\nn σs\n区域 1 法向：连续\n' }), '', '图集页面不取图注');
  assert.equal(chineseTitleFromPdf({ title: '', text: '设 n ≥ 2，粒子从整数点出发\n' + body }), '');
  assert.equal(bilingualName('poisson_branching', { title: '泊松过程与分支过程', text: '' }), '泊松过程与分支过程_poisson_branching');
  assert.equal(bilingualName('main', { title: '几何与拓扑讲义', text: '' }), '几何与拓扑讲义', '原名没意义时只用中文');
  assert.equal(bilingualName('vanwijk', { title: 'Visualization of Seifert Surfaces', text: 'Abstract' }), '');
});

test('纯英文名 PDF 加上中文标题；全英文内容的不动；撤销改回', { skip: noTools && '没有 pdfinfo/pdftotext' }, () => {
  const { root, data } = sandbox();
  makePdf(path.join(root, 'poisson_branching.pdf'), '泊松过程与分支过程', 'Poisson processes');
  makePdf(path.join(root, 'vanwijk.pdf'), 'Visualization of Seifert Surfaces', 'Abstract');
  const engine = new Engine({ dataDirectory: data, now: later });
  engine.execute(rule(root), engine.plan(rule(root)));
  assert.ok(fs.existsSync(path.join(root, '数学', '概率与统计', '泊松过程与分支过程_poisson_branching.pdf')));
  assert.ok(fs.existsSync(path.join(root, '数学', '几何与拓扑', 'vanwijk.pdf')));
  assert.equal(engine.undo().Moved, 2);
  assert.ok(fs.existsSync(path.join(root, 'poisson_branching.pdf')));
});

test('乱码名 PDF 按标题改名并归类，撤销后改回原名', { skip: noTools && '没有 pdfinfo/pdftotext' }, () => {
  const { root, data } = sandbox();
  makePdf(path.join(root, '9BE586B8E8951_8CE98D96.pdf'), '随机游动两题', 'Random walk on a line');
  makePdf(path.join(root, '微分几何.pdf'), '别的标题', 'Curves and surfaces');
  assert.equal(readPdf(path.join(root, '9BE586B8E8951_8CE98D96.pdf')).title, '随机游动两题');
  const engine = new Engine({ dataDirectory: data, now: later });
  const plan = engine.plan(rule(root));
  assert.ok(plan.Moves.some(m => m.Reason.startsWith('改名：')));
  engine.execute(rule(root), plan);
  assert.ok(fs.existsSync(path.join(root, '数学', '概率与统计', '随机游动两题.pdf')));
  assert.ok(fs.existsSync(path.join(root, '数学', '几何与拓扑', '微分几何.pdf')), '有意义的名字不改');
  assert.equal(engine.undo().Moved, 2);
  assert.ok(fs.existsSync(path.join(root, '9BE586B8E8951_8CE98D96.pdf')));
  assert.ok(fs.existsSync(path.join(root, '微分几何.pdf')));
});
