// Lenient data normalisation: accept the many shapes different models (and humans pasting
// spreadsheets) produce, and store one canonical shape:
//   { labels: string[], series: [{ name, values: number[], color? , points?: [x,y][] }], unit?, prefix?, suffix? }
import { parseNumberish, isPlainObject } from '../util/misc.js';

function num(v, meta) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null || v === '') return null;
  const p = parseNumberish(String(v));
  if (!p) return null;
  if (meta) {
    if (p.suffix && !meta.suffix) meta.suffix = p.suffix === '%' ? '%' : p.suffix.length <= 3 ? p.suffix : '';
    if (p.prefix && !meta.prefix) meta.prefix = p.prefix;
  }
  return p.value;
}

export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const delim = text.includes('\t') && !text.includes(',') ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** From a 2-D table (first row header, first column labels) to canonical chart data. */
export function tableToData(rows, meta = {}) {
  if (!rows.length) return { labels: [], series: [] };
  const header = rows[0].map(String);
  const body = rows.slice(1);
  const numericHeader = header.slice(1).every((h) => num(h) != null) && header.length > 2;
  if (numericHeader && body.length <= 8) {
    // Wide format where columns are periods (e.g. 2019, 2020 …) — transpose so labels are periods.
    return {
      labels: header.slice(1),
      series: body.map((r) => ({ name: String(r[0]), values: r.slice(1).map((v) => num(v, meta)) })),
    };
  }
  return {
    labels: body.map((r) => String(r[0])),
    series: header.slice(1).map((name, j) => ({ name, values: body.map((r) => num(r[j + 1], meta)) })),
  };
}

export function normalizeChartData(input, meta = {}) {
  if (input == null) return { labels: [], series: [] };
  if (typeof input === 'string') {
    const t = input.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return normalizeChartData(JSON.parse(t), meta); } catch { /* fall through to CSV */ }
    }
    return tableToData(parseCSV(t), meta);
  }
  if (Array.isArray(input)) {
    if (!input.length) return { labels: [], series: [] };
    if (Array.isArray(input[0])) {
      // [[label, v1, v2], ...] or [[x, y], ...] (numeric pairs → scatter points)
      if (input.every((r) => r.length === 2 && typeof r[0] === 'number' && typeof r[1] === 'number')) {
        return { labels: [], series: [{ name: '', values: [], points: input.map((r) => [r[0], r[1]]) }] };
      }
      const looksHeader = input[0].slice(1).some((v) => typeof v === 'string' && num(v) == null);
      if (looksHeader) return tableToData(input, meta);
      return {
        labels: input.map((r) => String(r[0])),
        series: input[0].slice(1).map((_, j) => ({ name: j === 0 ? '' : `系列 ${j + 1}`, values: input.map((r) => num(r[j + 1], meta)) })),
      };
    }
    if (typeof input[0] === 'number' || typeof input[0] === 'string') {
      return { labels: input.map((_, i) => String(i + 1)), series: [{ name: '', values: input.map((v) => num(v, meta)) }] };
    }
    if (isPlainObject(input[0])) {
      const keys = Object.keys(input[0]);
      const labelKey = keys.find((k) => /^(label|name|category|x|key|year|date|month|period|item|类别|名称|年份|月份|项目|标签)$/i.test(k))
        || keys.find((k) => typeof input[0][k] === 'string') || keys[0];
      if ('x' in input[0] && 'y' in input[0] && typeof input[0].x === 'number') {
        return { labels: [], series: [{ name: '', values: [], points: input.map((r) => [num(r.x), num(r.y), r.size != null ? num(r.size) : undefined, r.label]) }] };
      }
      const valueKeys = keys.filter((k) => k !== labelKey && k !== 'color' && input.some((r) => num(r[k]) != null));
      return {
        labels: input.map((r) => String(r[labelKey] ?? '')),
        series: valueKeys.map((k) => ({ name: /^(value|values|y|amount|count|数值|值)$/i.test(k) && valueKeys.length === 1 ? '' : k, values: input.map((r) => num(r[k], meta)) })),
        colors: input.some((r) => r.color) ? input.map((r) => r.color || null) : undefined,
      };
    }
  }
  if (isPlainObject(input)) {
    if (input.csv) return normalizeChartData(String(input.csv), meta);
    if (Array.isArray(input.rows) && Array.isArray(input.columns)) {
      return tableToData([input.columns.map((c) => (isPlainObject(c) ? c.label ?? c.name : c)), ...input.rows], meta);
    }
    if (Array.isArray(input.rows) && !input.labels) return normalizeChartData(input.rows, meta);
    if (Array.isArray(input.points)) {
      return { labels: [], series: [{ name: input.name || '', values: [], points: input.points.map((p) => (Array.isArray(p) ? p.map((v, i) => (i < 3 ? num(v) : v)) : [num(p.x), num(p.y), p.size != null ? num(p.size) : undefined, p.label])) }] };
    }
    const labels = (input.labels || input.categories || input.x || input.keys || []).map(String);
    let series = input.series || input.datasets;
    if (!series && (input.values || input.data || input.y)) series = [{ name: input.name || '', values: input.values || input.data || input.y }];
    if (!series && !labels.length) {
      // Plain map { A: 10, B: 20 } or { A: [1,2], B: [3,4] }
      const entries = Object.entries(input).filter(([k]) => !['unit', 'prefix', 'suffix', 'title'].includes(k));
      if (entries.every(([, v]) => !Array.isArray(v))) {
        return { labels: entries.map(([k]) => k), series: [{ name: '', values: entries.map(([, v]) => num(v, meta)) }] };
      }
    }
    if (isPlainObject(series)) series = Object.entries(series).map(([name, values]) => ({ name, values }));
    series = (series || []).map((s, i) => {
      if (Array.isArray(s)) return { name: `系列 ${i + 1}`, values: s.map((v) => num(v, meta)) };
      const out = { name: String(s.name ?? s.label ?? ''), values: (s.values || s.data || []).map((v) => num(v, meta)) };
      if (s.color) out.color = s.color;
      if (s.type) out.type = s.type;
      if (Array.isArray(s.points)) out.points = s.points.map((p) => (Array.isArray(p) ? p : [num(p.x), num(p.y), p.size != null ? num(p.size) : undefined, p.label]));
      return out;
    });
    const maxLen = Math.max(0, ...series.map((s) => s.values.length));
    while (labels.length < maxLen) labels.push(String(labels.length + 1));
    const out = { labels, series };
    if (input.colors) out.colors = input.colors;
    return out;
  }
  return { labels: [], series: [] };
}

/** Normalise a list param: accept strings, objects, or a newline-separated string. */
export function normalizeItems(items, textKey = 'text') {
  if (items == null) return [];
  if (typeof items === 'string') items = items.split(/\n+/).map((s) => s.replace(/^\s*(?:[-*•·]|\d+[.)、])\s*/, '').trim()).filter(Boolean);
  if (!Array.isArray(items)) items = [items];
  return items.map((it) => {
    if (it == null) return null;
    if (typeof it === 'string' || typeof it === 'number') return { [textKey]: String(it) };
    if (isPlainObject(it)) {
      const o = { ...it };
      if (o[textKey] == null) {
        const k = ['text', 'title', 'label', 'name', 'content', 'value'].find((kk) => kk !== textKey && typeof o[kk] === 'string');
        if (k) { o[textKey] = o[k]; if (k !== 'title' || textKey === 'title') delete o[k]; }
      }
      return o;
    }
    return { [textKey]: String(it) };
  }).filter(Boolean);
}
