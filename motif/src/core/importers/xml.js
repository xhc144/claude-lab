// XML + ZIP helpers for Office Open XML importers (Node).
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
import path from 'node:path';

export function openZip(buf) {
  const files = unzipSync(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  return {
    files,
    has: (p) => !!files[p],
    text: (p) => (files[p] ? strFromU8(files[p]) : null),
    bytes: (p) => files[p] || null,
    xml: (p) => (files[p] ? parseXml(strFromU8(files[p])) : null),
    list: (re) => Object.keys(files).filter((k) => re.test(k)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };
}

export function parseXml(text) {
  return new DOMParser({ onError: () => {} }).parseFromString(text, 'text/xml');
}

/** All descendants with a qualified tag name (e.g. "a:t"). */
export function all(node, tag) {
  if (!node) return [];
  return Array.from(node.getElementsByTagName(tag));
}

export function first(node, tag) {
  if (!node) return null;
  const l = node.getElementsByTagName(tag);
  return l.length ? l[0] : null;
}

/** Direct children with a given tag. */
export function kids(node, tag) {
  if (!node) return [];
  const out = [];
  for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!tag || c.nodeName === tag)) out.push(c);
  return out;
}

export const attr = (n, a) => (n ? n.getAttribute(a) : null);

/** Relationship map for a part: id → absolute target path inside the zip. */
export function rels(zip, partPath) {
  const dir = path.posix.dirname(partPath);
  const relPath = path.posix.join(dir, '_rels', path.posix.basename(partPath) + '.rels');
  const doc = zip.xml(relPath);
  const map = {};
  if (!doc) return map;
  for (const r of all(doc, 'Relationship')) {
    const target = attr(r, 'Target');
    const mode = attr(r, 'TargetMode');
    const resolved = mode === 'External' ? target : target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(dir, target));
    map[attr(r, 'Id')] = { target: resolved, type: attr(r, 'Type') || '' };
  }
  return map;
}

/** Text content of DrawingML paragraphs (a:p → a:r/a:t). */
export function drawingParagraphs(node) {
  return all(node, 'a:p').map((p) => {
    const lvl = Number(attr(first(p, 'a:pPr'), 'lvl') || 0);
    const bullet = !!first(p, 'a:buChar') || !!first(p, 'a:buAutoNum');
    const noBullet = !!first(p, 'a:buNone');
    const text = all(p, 'a:t').map((t) => t.textContent).join('').replace(/\s+/g, ' ').trim();
    return { text, lvl, bullet, noBullet };
  }).filter((p) => p.text);
}

/** Parse a DrawingML chart part into canonical chart data. */
export function parseChartXml(doc) {
  if (!doc) return null;
  const plot = first(doc, 'c:plotArea');
  if (!plot) return null;
  const types = ['c:barChart', 'c:bar3DChart', 'c:lineChart', 'c:line3DChart', 'c:pieChart', 'c:pie3DChart', 'c:doughnutChart', 'c:areaChart', 'c:area3DChart', 'c:scatterChart', 'c:radarChart', 'c:bubbleChart'];
  let kind = 'bar', chartNode = null;
  for (const t of types) { const n = first(plot, t); if (n) { chartNode = n; kind = t.replace(/^c:|3D|Chart$/g, '').replace('Chart', ''); break; } }
  if (!chartNode) return null;
  if (kind === 'bar') {
    const dir = attr(first(chartNode, 'c:barDir'), 'val');
    const grouping = attr(first(chartNode, 'c:grouping'), 'val');
    if (dir === 'bar') kind = 'hbar';
    if (grouping === 'stacked' || grouping === 'percentStacked') kind = 'stacked';
  }
  if (kind === 'doughnut') kind = 'donut';
  if (kind === 'bubble') kind = 'scatter';
  const pts = (n) => {
    const cache = first(n, 'c:strCache') || first(n, 'c:numCache') || first(n, 'c:strLit') || first(n, 'c:numLit');
    if (!cache) return [];
    const arr = [];
    for (const pt of all(cache, 'c:pt')) arr[Number(attr(pt, 'idx'))] = first(pt, 'c:v')?.textContent ?? '';
    return arr;
  };
  const series = [];
  let labels = [];
  for (const ser of all(chartNode, 'c:ser')) {
    const name = pts(first(ser, 'c:tx'))[0] || first(first(ser, 'c:tx'), 'c:v')?.textContent || '';
    const cat = first(ser, 'c:cat') || first(ser, 'c:xVal');
    const val = first(ser, 'c:val') || first(ser, 'c:yVal');
    const l = pts(cat);
    if (l.length > labels.length) labels = l;
    series.push({ name, values: pts(val).map((v) => (v === '' || v == null ? null : Number(v))) });
  }
  const title = all(first(doc, 'c:title'), 'a:t').map((t) => t.textContent).join('').trim();
  return { kind, labels: labels.map((x) => String(x ?? '')), series, title };
}
