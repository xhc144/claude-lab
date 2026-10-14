import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { inputs } from './helpers.mjs';
import { analyzeFiles, analyzeTable, keyNumbers } from '../../src/core/importers/index.js';
import { direct } from '../../src/core/director.js';
import { validateDocument } from '../../src/core/doc.js';

const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-media-'));
test.after(() => fs.rmSync(mediaDir, { recursive: true, force: true }));
const items = (o) => o.sections.flatMap((s) => s.items);

test('PPTX: titles, bullets, native chart caches, table, image, notes', async () => {
  const o = await analyzeFiles([path.join(inputs, 'annual-review.pptx')], { mediaDir });
  assert.equal(o.title, '2025 年度经营汇报');
  assert.ok(o.sections.length >= 8);
  const it = items(o);
  assert.ok(it.some((i) => i.kind === 'chart'));
  const table = it.find((i) => i.kind === 'table');
  assert.equal(table.rows[0][0], '区域');
  assert.ok(it.some((i) => i.kind === 'bullets' && i.items.some((t) => /380 万/.test(t))));
  assert.equal(o.media.length, 1);
  assert.ok(fs.existsSync(o.media[0].file));
  assert.ok(o.insights.topics.includes('finance'));
});

test('DOCX: headings, lists, table with chart suggestion, quote', async () => {
  const o = await analyzeFiles([path.join(inputs, 'cycling-report.docx')], { mediaDir });
  assert.equal(o.title, '城市骑行调研报告');
  const t = items(o).find((i) => i.kind === 'table');
  assert.equal(t.analysis.numeric, true);
  assert.ok(items(o).some((i) => i.kind === 'quote' || /毛细血管/.test(i.text || '')));
});

test('XLSX: each sheet becomes a section with a typed table', async () => {
  const o = await analyzeFiles([path.join(inputs, 'metrics.xlsx')], { mediaDir });
  const tables = items(o).filter((i) => i.kind === 'table');
  assert.equal(tables.length, 2);
  assert.equal(tables[0].analysis.chart, 'line');
  assert.equal(tables[1].analysis.chart, 'donut');
});

test('Markdown: equation detected', async () => {
  const o = await analyzeFiles([path.join(inputs, 'pythagoras.md')], { mediaDir });
  assert.ok(items(o).some((i) => i.kind === 'equation'));
  assert.ok(o.insights.topics.includes('math'));
});

test('PDF: headings and table recovered from a converted document', async () => {
  const f = path.join(inputs, 'cycling-report.pdf');
  if (!fs.existsSync(f)) return;
  const o = await analyzeFiles([f], { mediaDir });
  assert.ok(o.sections.some((s) => /城市对比/.test(s.title)));
  assert.ok(items(o).some((i) => i.kind === 'table'));
});

test('table analysis and key numbers', () => {
  assert.equal(analyzeTable([['年份', '营收'], ['2021', 12], ['2022', 19], ['2023', 31]]).chart, 'bar');
  assert.equal(analyzeTable([['渠道', '占比'], ['A', '40%'], ['B', '35%'], ['C', '25%']]).chart, 'donut');
  const nums = keyNumbers('本报告基于 12 个城市、共 3,600 名骑行者。营收增长 65%。');
  assert.ok(nums.some((n) => n.value.includes('3,600')));
  assert.ok(nums.some((n) => n.value.includes('65%') && n.delta === '+'));
});

test('director: designs a valid document and keeps years in titles', async () => {
  const o = await analyzeFiles([path.join(inputs, 'annual-review.pptx')], { mediaDir });
  const doc = direct(o, {});
  assert.equal(doc.title, '2025 年度经营汇报');
  assert.ok(doc.scenes.length >= 7);
  const blocks = doc.scenes.flatMap((s) => s.blocks);
  assert.ok(blocks.some((b) => b.type === 'chart'));
  assert.ok(blocks.some((b) => b.type === 'stats' || b.type === 'stat'));
  assert.ok(blocks.some((b) => b.type === 'title' && /2026/.test(b.text)), 'year kept in "2026 计划"');
  assert.equal(validateDocument(doc).filter((i) => i.level === 'error').length, 0);
});
