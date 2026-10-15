// Material analysis: any supported file → a normalised outline the director (or an AI) can design from.
//   outline = { title, sources, sections:[{title, level, source, items:[…], notes}], media:[{ref,file,name}], insights }
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { importPptx, importDocx, importXlsx } from './office.js';
import { importMarkdown, importText, importCsv, importJson, importPdf } from './text.js';
import { parseNumberish } from '../util/misc.js';

export const SUPPORTED = ['.pptx', '.docx', '.xlsx', '.xlsm', '.pdf', '.md', '.markdown', '.txt', '.csv', '.tsv', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

export async function analyzeFile(file, o = {}) {
  const ext = path.extname(file).toLowerCase();
  const sourceName = path.basename(file);
  const mediaDir = o.mediaDir || fs.mkdtempSync(path.join(os.tmpdir(), 'motif-import-'));
  const buf = fs.readFileSync(file);
  const ctx = { sourceName, mediaDir, baseDir: path.dirname(file) };
  switch (ext) {
    case '.pptx': return importPptx(buf, ctx);
    case '.docx': return importDocx(buf, ctx);
    case '.xlsx': case '.xlsm': return importXlsx(buf, ctx);
    case '.pdf': return importPdf(buf, ctx);
    case '.md': case '.markdown': return importMarkdown(buf.toString('utf8'), ctx);
    case '.txt': return importText(buf.toString('utf8'), ctx);
    case '.csv': case '.tsv': return importCsv(buf.toString('utf8'), ctx);
    case '.json': return importJson(buf.toString('utf8'), ctx);
    case '.png': case '.jpg': case '.jpeg': case '.webp': case '.gif': case '.svg': {
      const ref = `media:${sourceName}`;
      return { kind: 'image', sections: [{ title: path.basename(file, ext), level: 2, source: sourceName, items: [{ kind: 'image', ref }] }], media: [{ ref, file, name: sourceName }] };
    }
    case '.ppt': case '.doc': case '.xls':
      throw new Error(`${ext} 为旧版二进制格式，请先另存为 ${ext}x 后再导入`);
    default:
      throw new Error(`不支持的文件类型 ${ext}（支持：${SUPPORTED.join(' ')}）`);
  }
}

export async function analyzeFiles(files, o = {}) {
  const outline = { title: '', sources: [], sections: [], media: [], documents: [] };
  for (const f of files) {
    if (!fs.existsSync(f)) throw new Error(`文件不存在：${f}`);
    const r = await analyzeFile(f, o);
    outline.sources.push({ file: f, kind: r.kind, sections: r.sections.length, pages: r.pages, media: r.media.length });
    if (r.document) outline.documents.push(r.document);
    if (!outline.title && r.title) outline.title = r.title;
    if (!outline.title && r.sections[0]?.level === 0 && r.sections[0].title) outline.title = r.sections[0].title;
    outline.sections.push(...r.sections);
    outline.media.push(...r.media);
  }
  if (!outline.title) outline.title = path.basename(files[0] || '作品', path.extname(files[0] || ''));
  for (const s of outline.sections) for (const it of s.items) annotate(it);
  outline.insights = insights(outline);
  return outline;
}

// ───────────────────────────── content analysis ─────────────────────────────
const TIMEY = /^(\d{4}|\d{4}[-/.年]\d{1,2}|(?:19|20)\d{2}\s*[QH]\d|Q[1-4]|H[12]|[一二三四五六七八九十]+月|\d{1,2}月|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|周[一二三四五六日]|第[一二三四五六七八九十\d]+[季周])/i;

/** Classify a table: is it numeric data that should become a chart? */
export function analyzeTable(rows) {
  if (!rows?.length || rows.length < 2) return { numeric: false };
  const header = rows[0].map((c) => String(c ?? ''));
  const body = rows.slice(1).filter((r) => r.some((c) => c !== '' && c != null));
  const ncol = header.length;
  const numCols = [];
  for (let j = 1; j < ncol; j++) {
    const vals = body.map((r) => r[j]).filter((v) => v !== '' && v != null);
    if (vals.length && vals.every((v) => typeof v === 'number' || parseNumberish(String(v)) && /^[\s¥$€£+\-−]*[\d.,]+\s*[%万亿千百kKmMbB]?\s*$/.test(String(v)))) numCols.push(j);
  }
  const labels = body.map((r) => String(r[0] ?? ''));
  const timeLike = labels.length >= 3 && labels.filter((l) => TIMEY.test(l.trim())).length >= labels.length * 0.7;
  const numericHeader = header.slice(1).filter((h) => /^\d{4}$|^Q[1-4]$/i.test(h.trim())).length >= 2;
  const pct = numCols.length === 1 && body.every((r) => /%$/.test(String(r[numCols[0]]))) ;
  const sum = numCols.length === 1 ? body.reduce((s, r) => s + (parseNumberish(String(r[numCols[0]]))?.value || 0), 0) : 0;
  let chart = null;
  if (numCols.length) {
    if (numericHeader && body.length <= 6) chart = 'line';
    else if (timeLike) chart = body.length > 8 || numCols.length > 2 ? 'line' : 'bar';
    else if ((pct || Math.abs(sum - 100) < 1.5) && body.length <= 7 && numCols.length === 1) chart = 'donut';
    else if (body.length > 8 || labels.some((l) => l.length > 10)) chart = 'hbar';
    else chart = numCols.length > 3 ? 'line' : 'bar';
  }
  return { numeric: numCols.length > 0, numCols, timeLike, chart, rows: body.length, cols: ncol, textHeavy: !numCols.length };
}

const STAT_RE = /([¥$€£]?\s*[\d,.]+\s*(?:%|万|亿|千|百万|倍|x|X|k|K|M|B|元|美元|人|家|个|次|小时|分钟|天|年)?)/;
export function keyNumbers(text) {
  const out = [];
  const re = /([^，。；,;:：\d]{0,14}?)\s*((?:增长|提升|下降|减少|达到|超过|突破|约|共|累计|同比|环比)?\s*[¥$€£]?\s*\d[\d,.]*\d?\s*(?:%|万|亿|千|百万|倍|x|k|K|M|B)?)\s*([^，。；,;:：\d]{0,12})/g;
  let m;
  while ((m = re.exec(text))) {
    const num = m[2].replace(/^(增长|提升|下降|减少|达到|超过|突破|约|共|累计|同比|环比)\s*/, '');
    const p = parseNumberish(num);
    if (!p) continue;
    const meaningful = p.suffix || /增长|提升|下降|减少|达到|超过|突破|同比|环比/.test(m[2]) || p.value >= 100;
    if (!meaningful || (/^\d{4}$/.test(num.trim()) && p.value > 1900 && p.value < 2100)) continue;
    out.push({ value: num.trim(), label: (m[1] + m[3]).replace(/^[的是为]|[的是为]$/g, '').trim(), raw: m[0].trim(), delta: /增长|提升|同比|环比/.test(m[2]) ? '+' : /下降|减少/.test(m[2]) ? '−' : null });
  }
  return out;
}

function annotate(it) {
  if (it.kind === 'table') it.analysis = analyzeTable(it.rows);
  if (it.kind === 'paragraph') {
    it.numbers = keyNumbers(it.text);
    if (/\$[^$]+\$/.test(it.text) || /\\(frac|sum|int|sqrt)/.test(it.text)) it.math = true;
  }
}

function insights(outline) {
  const text = outline.sections.map((s) => [s.title, ...s.items.map((i) => i.text || (i.items || []).join(' '))].join(' ')).join(' ');
  const scores = {};
  const has = (re, key) => { const g = new RegExp(re.source, 'gi'); const n = (text.match(g) || []).length + (re.test(outline.title) ? 3 : 0); if (key) scores[key] = n; return n > 0; };
  const topics = [];
  if (has(/公式|定理|函数|方程|证明|积分|导数|几何|物理|化学|theorem|equation|calculus/i, 'math') || outline.sections.some((s) => s.items.some((i) => i.kind === 'equation' || i.math))) topics.push('math');
  if (has(/营收|收入|利润|财报|年报|增长率|毛利|季度|KPI|revenue|profit|quarter/i, 'finance')) topics.push('finance');
  if (has(/AI|人工智能|模型|算法|芯片|云|数据平台|SaaS|科技|技术|发布|product|launch/i, 'tech')) topics.push('tech');
  if (has(/架构|系统|服务|接口|API|数据库|部署|工程|pipeline|architecture/i, 'engineering')) topics.push('engineering');
  if (has(/课程|学习|学生|教学|课堂|知识|健康|lesson|course|student/i, 'education')) topics.push('education');
  if (has(/文化|历史|传统|节日|诗|茶|书法|非遗|古|中国风/i, 'culture')) topics.push('culture');
  if (has(/营销|活动|品牌|用户增长|粉丝|促销|社交|短视频|marketing|campaign/i, 'marketing')) topics.push('marketing');
  if (has(/融资|投资|路演|市场规模|商业模式|估值|pitch|investor/i, 'pitch')) topics.push('pitch');
  const counts = { tables: 0, charts: 0, images: 0, bullets: 0, paragraphs: 0, numbers: 0 };
  for (const s of outline.sections) for (const i of s.items) {
    if (i.kind === 'table') counts.tables++;
    if (i.kind === 'chart' || i.analysis?.chart) counts.charts++;
    if (i.kind === 'image') counts.images++;
    if (i.kind === 'bullets') counts.bullets++;
    if (i.kind === 'paragraph') { counts.paragraphs++; counts.numbers += i.numbers?.length || 0; }
  }
  return { topics, scores, counts, characters: text.length };
}
