// PPTX, DOCX and XLSX importers → outline sections.
import fs from 'node:fs';
import path from 'node:path';
import { openZip, all, first, kids, attr, rels, drawingParagraphs, parseChartXml } from './xml.js';

const EMU = 914400;

function saveMedia(zip, part, mediaDir, media, prefix) {
  const bytes = zip.bytes(part);
  if (!bytes) return null;
  const ext = path.extname(part).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) return null; // skip emf/wmf
  const name = `${prefix}-${path.basename(part)}`;
  const file = path.join(mediaDir, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, bytes);
  const ref = `media:${name}`;
  if (!media.some((m) => m.ref === ref)) media.push({ ref, file, name: path.basename(part) });
  return ref;
}

// ───────────────────────────── PPTX ─────────────────────────────
export function importPptx(buf, { mediaDir, sourceName }) {
  const zip = openZip(buf);
  const pres = zip.xml('ppt/presentation.xml');
  const prels = rels(zip, 'ppt/presentation.xml');
  const order = all(pres, 'p:sldId').map((s) => prels[attr(s, 'r:id')]?.target).filter(Boolean);
  const slides = order.length ? order : zip.list(/^ppt\/slides\/slide\d+\.xml$/);
  const media = [];
  const sections = [];
  slides.forEach((part, si) => {
    const doc = zip.xml(part);
    if (!doc) return;
    const r = rels(zip, part);
    const items = [];
    let title = '', subtitle = '';
    const shapes = [];
    const tree = first(doc, 'p:spTree');
    const pos = (n) => { const off = first(n, 'a:off'); const ext = first(n, 'a:ext'); return { x: Number(attr(off, 'x') || 0) / EMU, y: Number(attr(off, 'y') || 0) / EMU, w: Number(attr(ext, 'cx') || 0) / EMU, h: Number(attr(ext, 'cy') || 0) / EMU }; };
    const walk = (node) => {
      for (const n of kids(node)) {
        if (n.nodeName === 'p:grpSp') { walk(n); continue; }
        if (n.nodeName === 'p:sp') {
          const ph = first(first(n, 'p:nvPr'), 'p:ph');
          const type = attr(ph, 'type') || (ph ? 'body' : null);
          const paras = drawingParagraphs(first(n, 'p:txBody'));
          if (paras.length) shapes.push({ kind: 'text', type, paras, ...pos(n) });
        } else if (n.nodeName === 'p:pic') {
          const embed = attr(first(n, 'a:blip'), 'r:embed');
          const target = r[embed]?.target;
          const ref = target ? saveMedia(zip, target, mediaDir, media, `s${si + 1}`) : null;
          if (ref) shapes.push({ kind: 'image', ref, ...pos(n) });
        } else if (n.nodeName === 'p:graphicFrame') {
          const tbl = first(n, 'a:tbl');
          if (tbl) {
            const rows = all(tbl, 'a:tr').map((tr) => all(tr, 'a:tc').map((tc) => all(tc, 'a:t').map((t) => t.textContent).join('').trim()));
            if (rows.length) shapes.push({ kind: 'table', rows, ...pos(n) });
          }
          const ch = first(n, 'c:chart');
          if (ch) {
            const target = r[attr(ch, 'r:id')]?.target;
            const data = target ? parseChartXml(zip.xml(target)) : null;
            if (data && data.series.length) shapes.push({ kind: 'chart', data, ...pos(n) });
          }
        }
      }
    };
    walk(tree);
    shapes.sort((a, b) => (Math.abs(a.y - b.y) < 0.3 ? a.x - b.x : a.y - b.y));
    for (const s of shapes) {
      if (s.kind === 'text') {
        if ((s.type === 'title' || s.type === 'ctrTitle') && !title) { title = s.paras.map((p) => p.text).join(' '); continue; }
        if (s.type === 'subTitle' && !subtitle) { subtitle = s.paras.map((p) => p.text).join(' '); continue; }
        const bulletLike = s.paras.length >= 2 && (s.type === 'body' || s.paras.some((p) => p.bullet || p.lvl > 0) || s.paras.every((p) => p.text.length < 60));
        if (bulletLike) items.push({ kind: 'bullets', items: s.paras.filter((p) => p.lvl === 0 || s.paras.every((q) => q.lvl > 0)).map((p) => p.text), sub: s.paras.filter((p) => p.lvl > 0).map((p) => p.text) });
        else for (const p of s.paras) items.push({ kind: 'paragraph', text: p.text });
      } else if (s.kind === 'image') items.push({ kind: 'image', ref: s.ref, area: s.w * s.h });
      else if (s.kind === 'table') items.push({ kind: 'table', rows: s.rows, header: true });
      else if (s.kind === 'chart') items.push({ kind: 'chart', chartType: s.data.kind, labels: s.data.labels, series: s.data.series, title: s.data.title });
    }
    // speaker notes
    const notesRel = Object.values(r).find((x) => /notesSlide/.test(x.type));
    let notes = '';
    if (notesRel) {
      const nd = zip.xml(notesRel.target);
      const body = all(nd, 'p:sp').filter((sp) => attr(first(first(sp, 'p:nvPr'), 'p:ph'), 'type') === 'body');
      notes = body.flatMap((sp) => drawingParagraphs(first(sp, 'p:txBody')).map((p) => p.text)).join('\n');
    }
    sections.push({ title: title || (items.find((i) => i.kind === 'paragraph')?.text?.slice(0, 40) ?? ''), subtitle, level: si === 0 ? 0 : 2, source: `${sourceName} · 第 ${si + 1} 页`, items, notes });
  });
  return { kind: 'pptx', sections, media, pages: slides.length };
}

// ───────────────────────────── DOCX ─────────────────────────────
export function importDocx(buf, { mediaDir, sourceName }) {
  const zip = openZip(buf);
  const doc = zip.xml('word/document.xml');
  const r = rels(zip, 'word/document.xml');
  const styles = zip.xml('word/styles.xml');
  const styleName = {};
  for (const st of all(styles, 'w:style')) styleName[attr(st, 'w:styleId')] = (attr(first(st, 'w:name'), 'w:val') || '').toLowerCase();
  const media = [];
  const sections = [];
  let cur = { title: '', level: 0, items: [], source: sourceName };
  let docTitle = '';
  let listBuf = null;
  const flushList = () => { if (listBuf && listBuf.items.length) cur.items.push(listBuf); listBuf = null; };
  const push = (it) => { flushList(); cur.items.push(it); };
  const body = first(doc, 'w:body');
  let imgN = 0;
  for (const n of kids(body)) {
    if (n.nodeName === 'w:p') {
      const pPr = first(n, 'w:pPr');
      const sid = attr(first(pPr, 'w:pStyle'), 'w:val') || '';
      const sname = styleName[sid] || sid.toLowerCase();
      const text = all(n, 'w:t').map((t) => t.textContent).join('').trim();
      for (const blip of all(n, 'a:blip')) {
        const target = r[attr(blip, 'r:embed')]?.target;
        const ref = target ? saveMedia(zip, target, mediaDir, media, `d${++imgN}`) : null;
        if (ref) push({ kind: 'image', ref });
      }
      if (!text) continue;
      const hm = /(?:heading|标题)\s*(\d)/.exec(sname);
      if (sname === 'title' || sname === '标题') { docTitle = docTitle || text; continue; }
      if (hm) {
        const lvl = Number(hm[1]);
        flushList();
        if (cur.title || cur.items.length) sections.push(cur);
        cur = { title: text, level: lvl, items: [], source: sourceName };
        continue;
      }
      const isList = !!first(pPr, 'w:numPr') || /list/.test(sname);
      if (isList) { if (!listBuf) listBuf = { kind: 'bullets', items: [], ordered: /number/.test(sname) }; listBuf.items.push(text); continue; }
      if (/quote|引用/.test(sname)) { push({ kind: 'quote', text }); continue; }
      push({ kind: 'paragraph', text });
    } else if (n.nodeName === 'w:tbl') {
      const rows = all(n, 'w:tr').map((tr) => all(tr, 'w:tc').map((tc) => all(tc, 'w:t').map((t) => t.textContent).join('').trim()));
      if (rows.length) push({ kind: 'table', rows, header: true });
    }
  }
  flushList();
  if (cur.title || cur.items.length) sections.push(cur);
  // embedded charts (word/charts/*.xml)
  for (const c of zip.list(/^word\/charts\/chart\d+\.xml$/)) {
    const data = parseChartXml(zip.xml(c));
    if (data?.series.length) (sections[sections.length - 1] || cur).items.push({ kind: 'chart', chartType: data.kind, labels: data.labels, series: data.series, title: data.title });
  }
  return { kind: 'docx', title: docTitle, sections, media };
}

// ───────────────────────────── XLSX ─────────────────────────────
function colIndex(ref) { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

export function importXlsx(buf, { sourceName }) {
  const zip = openZip(buf);
  const wb = zip.xml('xl/workbook.xml');
  const wrels = rels(zip, 'xl/workbook.xml');
  const ss = zip.xml('xl/sharedStrings.xml');
  const strings = all(ss, 'si').map((si) => all(si, 't').map((t) => t.textContent).join(''));
  const stylesDoc = zip.xml('xl/styles.xml');
  const numFmts = {};
  for (const f of all(stylesDoc, 'numFmt')) numFmts[attr(f, 'numFmtId')] = attr(f, 'formatCode');
  const xfs = all(first(stylesDoc, 'cellXfs'), 'xf').map((x) => Number(attr(x, 'numFmtId') || 0));
  const isDateFmt = (id) => (id >= 14 && id <= 22) || (numFmts[id] && /[ymd]/i.test(numFmts[id]) && !/[#0]/.test(numFmts[id]));
  const isPct = (id) => id === 9 || id === 10 || (numFmts[id] || '').includes('%');
  const sections = [];
  for (const sh of all(wb, 'sheet')) {
    const target = wrels[attr(sh, 'r:id')]?.target;
    const sd = zip.xml(target);
    if (!sd) continue;
    const grid = [];
    for (const row of all(sd, 'row')) {
      for (const c of all(row, 'c')) {
        const ref = attr(c, 'r');
        const ri = Number(ref.replace(/[A-Z]+/g, '')) - 1, ci = colIndex(ref);
        const t = attr(c, 't');
        const v = first(c, 'v')?.textContent;
        let val = null;
        if (t === 's') val = strings[Number(v)] ?? '';
        else if (t === 'inlineStr') val = all(c, 't').map((x) => x.textContent).join('');
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'str' || t === 'e') val = v ?? '';
        else if (v != null) {
          const num = Number(v);
          const s = Number(attr(c, 's') || 0);
          const fmt = xfs[s] || 0;
          if (isDateFmt(fmt)) { const d = new Date(Math.round((num - 25569) * 86400 * 1000)); val = d.toISOString().slice(0, 10); }
          else if (isPct(fmt)) val = `${+(num * 100).toFixed(2)}%`;
          else val = num;
        }
        (grid[ri] ||= [])[ci] = val;
      }
    }
    const rows = grid.filter((r) => r && r.some((x) => x != null && x !== ''));
    if (!rows.length) continue;
    const width = Math.max(...rows.map((r) => r.length));
    const usedCols = [];
    for (let j = 0; j < width; j++) if (rows.some((r) => r[j] != null && r[j] !== '')) usedCols.push(j);
    const clean = rows.map((r) => usedCols.map((j) => r[j] ?? ''));
    sections.push({ title: attr(sh, 'name'), level: 2, source: `${sourceName} · ${attr(sh, 'name')}`, items: [{ kind: 'table', rows: clean, header: true }] });
  }
  for (const c of zip.list(/^xl\/charts\/chart\d+\.xml$/)) {
    const data = parseChartXml(zip.xml(c));
    if (data?.series.length) sections.push({ title: data.title || '图表', level: 2, source: sourceName, items: [{ kind: 'chart', chartType: data.kind, labels: data.labels, series: data.series, title: data.title }] });
  }
  return { kind: 'xlsx', sections, media: [] };
}
