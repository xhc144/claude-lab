// The auto-director: outline → designed document. Encodes editorial judgement so that "content in"
// becomes a well-paced piece: one idea per scene, data shown as the right chart, lists shown as
// steps/timelines/feature grids when their structure says so, numbers promoted to big stats,
// section breaks for rhythm, and a cover and closing. AI agents can run it, then refine.
import { normalizeDocument } from './doc.js';
import { parseNumberish } from './util/misc.js';

const THEME_BY_TOPIC = [['math', 'lumen'], ['culture', 'ink'], ['engineering', 'blueprint'], ['pitch', 'corporate'], ['finance', 'editorial'], ['tech', 'aurora'], ['education', 'meadow'], ['marketing', 'pop']];

export function pickTheme(insights) {
  const scores = insights?.scores || {};
  const ranked = THEME_BY_TOPIC.filter(([topic]) => insights?.topics?.includes(topic)).sort((a, b) => (scores[b[0]] || 1) - (scores[a[0]] || 1));
  return ranked[0]?.[1] || 'corporate';
}

const isCJK = (s) => /[一-鿿]/.test(s || '');
const clip = (s, n) => { const t = String(s || '').trim(); return t.length > n ? t.slice(0, n - 1).replace(/[，,、；;：:\s]+$/, '') + '…' : t; };
const sentences = (t) => String(t || '').split(/(?<=[。！？!?；;])\s*|(?<=\.)\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);

function headline(s, cjk) {
  const t = String(s || '').replace(/[。.]$/, '').replace(/^[一二三四五六七八九十]+[、.．]\s*/, '').replace(/^(?:\d{1,2}[、．.](?!\d)\s*|\d{1,2}(?:\.\d+)+\s+(?![万亿千百%倍个元人]))/, '').trim();
  return clip(t, cjk ? 26 : 70);
}

function chartBlockFromTable(rows, analysis, title) {
  const header = rows[0].map((h) => String(h ?? ''));
  const body = rows.slice(1).filter((r) => r.some((c) => c !== '' && c != null));
  let numCols = analysis.numCols?.length ? analysis.numCols : [1];
  // never mix units in one chart: keep the columns that share the first numeric column's unit
  const unitOf = (j) => { const v = body.map((r) => r[j]).find((x) => x !== '' && x != null); if (typeof v === 'number') return ''; const p = parseNumberish(String(v ?? '')); return p ? (/%/.test(p.suffix) ? '%' : p.suffix || '') + (/^[+\-−]/.test(String(v).trim()) ? '±' : '') : ''; };
  const u0 = unitOf(numCols[0]);
  numCols = numCols.filter((j) => unitOf(j) === u0);
  let suffix;
  const series = numCols.slice(0, 4).map((j) => ({ name: header[j], values: body.map((r) => { const p = typeof r[j] === 'number' ? { value: r[j], suffix: '' } : parseNumberish(String(r[j] ?? '')); if (p?.suffix && !suffix && p.suffix.length <= 2) suffix = p.suffix; return p ? p.value : null; }) }));
  const labels = body.map((r) => String(r[0] ?? ''));
  const block = { type: 'chart', kind: analysis.chart || 'bar', data: { labels, series } };
  if (suffix) block.suffix = suffix;
  if (series.length === 1 && ['bar', 'hbar', 'line'].includes(block.kind)) {
    const vals = series[0].values;
    let mi = 0; vals.forEach((v, i) => { if ((v ?? -Infinity) > (vals[mi] ?? -Infinity)) mi = i; });
    if (block.kind !== 'line') block.highlight = labels[mi];
    if (block.kind === 'line' || analysis.timeLike) {
      const a = vals.find((v) => v != null), b = [...vals].reverse().find((v) => v != null);
      if (a && b && a > 0) { const g = ((b - a) / a) * 100; if (Math.abs(g) >= 10) block.annotate = [{ at: labels[vals.lastIndexOf(b)], text: `${g > 0 ? '+' : ''}${g.toFixed(0)}%` }]; }
    }
  }
  if (block.kind === 'hbar') block.sort = 'desc';
  if (title) block.title = undefined;
  return block;
}

/** Bullets → the most expressive component for their structure. */
function listBlock(items, ordered) {
  const clean = items.map((t) => String(t).trim()).filter(Boolean);
  const nums = clean.map((t) => keyNumbers(t)[0]).filter(Boolean);
  if (nums.length >= 3 && nums.length >= clean.length * 0.6 && clean.length <= 6) {
    return { type: 'stats', items: clean.map((t) => { const n = keyNumbers(t)[0]; return n ? { value: n.value, label: clip(t.replace(n.value, '').replace(/[，,。]\s*$/, '').replace(/\s+/g, ' ').trim() || n.label, 18) } : null; }).filter(Boolean).slice(0, 4) };
  }
  const years = clean.filter((t) => /^((?:19|20)\d{2}|Q[1-4]|\d{1,2}月)/.test(t));
  if (years.length >= 3 && years.length >= clean.length * 0.7) {
    return { type: 'timeline', items: clean.map((t) => { const m = /^((?:19|20)\d{2}(?:[年.\-/]\d{1,2}月?)?|Q[1-4]|\d{1,2}月)[年：:\s,，、-]*(.*)$/.exec(t); return m ? { date: m[1], title: clip(m[2] || m[1], 18) } : { date: '', title: clip(t, 18) }; }) };
  }
  const kv = clean.map((t) => /^(.{2,14}?)[：:]\s*(.+)$/.exec(t));
  if (kv.every(Boolean) && clean.length >= 2 && clean.length <= 6) {
    return { type: 'features', items: kv.map((m) => ({ title: m[1].trim(), text: clip(m[2], 40) })) };
  }
  const stepy = ordered || clean.filter((t) => /^(第[一二三四五六七八九十\d]+步|首先|其次|然后|最后|step\s*\d)/i.test(t)).length >= 2;
  if (stepy && clean.length >= 3 && clean.length <= 6 && clean.every((t) => t.length <= 40)) {
    return { type: 'steps', items: clean.map((t) => { const s = t.replace(/^(第[一二三四五六七八九十\d]+步|首先|其次|然后|最后|step\s*\d+)[：:，,\s]*/i, ''); const m = /^(.{2,12}?)[：:，,—-]\s*(.+)$/.exec(s); return m ? { title: m[1], text: clip(m[2], 30) } : { title: clip(s, 16) }; }) };
  }
  return { type: 'bullets', items: clean.map((t) => { const m = /^(.{2,16}?)[：:—]\s*(.+)$/.exec(t); return m && t.length > 26 ? { text: m[1], detail: clip(m[2], 50) } : { text: clip(t, 46) }; }) };
}

function statsFromNumbers(nums) {
  return nums.slice(0, 4).map((n) => ({ value: n.value, label: clip(n.label || '', 14), ...(n.delta === '+' ? { delta: '' } : {}) })).map((s) => { delete s.delta; return s; });
}

export function direct(outline, o = {}) {
  if (outline.documents?.length) return normalizeDocument(outline.documents[0]).doc;
  const cjk = isCJK(outline.title) || outline.sections.some((s) => isCJK(s.title));
  const theme = o.theme || pickTheme(outline.insights);
  const title = o.title || outline.title || (cjk ? '未命名作品' : 'Untitled');
  const scenes = [];
  const sections = outline.sections.filter((s) => s.title || s.items.length);
  // cover: use a title-like first section if present
  const first = sections[0];
  let coverSub = '';
  if (first && (first.level === 0 || (first.items.length <= 2 && first.items.every((i) => i.kind === 'paragraph' && i.text.length < 60)))) {
    coverSub = first.subtitle || first.items.find((i) => i.kind === 'paragraph')?.text || '';
    sections.shift();
  }
  const year = /((?:19|20)\d{2})/.exec(`${title} ${coverSub}`)?.[1];
  scenes.push({ blocks: [{ type: 'title', text: headline(title, cjk), ...(coverSub ? { subtitle: clip(coverSub, cjk ? 40 : 90) } : {}), ...(year && !title.includes(year) ? { kicker: year } : {}) }] });

  const topLevels = sections.filter((s) => s.level === 1);
  let sectionNo = 0;
  const toneCycle = [];
  for (const sec of sections) {
    if (topLevels.length >= 2 && sec.level === 1) {
      sectionNo++;
      scenes.push({ layout: 'section', sectionNumber: sectionNo, blocks: [{ type: 'title', kicker: cjk ? `第 ${sectionNo} 部分` : `Part ${sectionNo}`, text: headline(sec.title, cjk) }] });
      if (!sec.items.length) continue;
    }
    const afterDivider = scenes[scenes.length - 1]?.layout === 'section';
    let secTitle = headline(sec.title, cjk);
    let titleUsed = afterDivider;
    let pendingText = [];
    let pendingImage = null;
    const notes = sec.notes || undefined;
    const pushScene = (blocks, extra = {}) => {
      const hasTitle = blocks.some((b) => b.type === 'title');
      const visual = blocks.some((b) => ['stat', 'stats', 'chart', 'quote'].includes(b.type));
      const skipTitle = titleUsed && visual && afterDivider;
      titleUsed = false;
      scenes.push({ ...extra, ...(notes && !scenes.some((s) => s.notes === notes) ? { notes, narration: { text: clip(notes, 200) } } : {}), blocks: hasTitle || !secTitle || skipTitle ? blocks : [{ type: 'title', text: secTitle }, ...blocks] });
    };
    const flushText = () => {
      const text = pendingText.join('\n');
      pendingText = [];
      const last = scenes[scenes.length - 1];
      const eq = last?.blocks?.find((b) => b.type === 'equation');
      if (eq && !eq.label && text && text.length <= 60 && !pendingImage) { eq.label = text.replace(/[。.]$/, ''); return; }
      if (!text.trim()) { if (pendingImage) { pushScene([{ type: 'image', src: pendingImage.ref, caption: pendingImage.caption }], { layout: 'focus' }); pendingImage = null; } return; }
      const nums = keyNumbers(text);
      const sents = sentences(text);
      if (nums.length >= 2 && text.length < 260) {
        pushScene([{ type: 'stats', items: statsFromNumbers(nums) }, ...(sents[0] && sents[0].length < 60 ? [] : [])]);
      } else if (nums.length === 1 && text.length < 160) {
        pushScene([{ type: 'stat', value: nums[0].value, label: clip(nums[0].label || sents[0], 24), context: sents.length > 1 ? clip(sents.slice(1).join(''), 60) : undefined }], { layout: 'split' });
      } else if (sents.length >= 3 && sents.length <= 6 && sents.every((s) => s.length < 70) && text.length > 120) {
        pushScene([listBlock(sents.map((s) => s.replace(/[。.；;]$/, '')), false), ...(pendingImage ? [{ type: 'image', src: pendingImage.ref }] : [])]);
      } else if (text.length < 50 && !pendingImage) {
        pushScene([{ type: 'title', text: headline(text, cjk), ...(secTitle ? { kicker: clip(secTitle, 16) } : {}) }], { layout: 'cover', tone: 'accent' });
      } else {
        const body = text.length > 220 ? sents.reduce((acc, s) => (acc.length + s.length < 200 ? acc + s : acc), '') || clip(text, 200) : text;
        pushScene([{ type: 'text', text: body, size: body.length < 90 ? 'l' : 'auto' }, ...(pendingImage ? [{ type: 'image', src: pendingImage.ref }] : [])]);
      }
      pendingImage = null;
    };
    for (const it of sec.items) {
      switch (it.kind) {
        case 'paragraph': pendingText.push(it.text); break;
        case 'image': if (pendingImage) flushText(); pendingImage = it; break;
        case 'bullets': {
          const lead = pendingText.length && pendingText.join('').length < 80 ? pendingText.join(' ') : null;
          if (!lead) flushText(); else pendingText = [];
          const items = it.items.filter(Boolean);
          for (let k = 0; k < items.length; k += 6) {
            const chunk = items.slice(k, k + 6);
            const blocks = [listBlock(chunk, it.ordered)];
            if (lead && k === 0) blocks.unshift({ type: 'title', text: secTitle || headline(lead, cjk), ...(secTitle ? { subtitle: clip(lead, 50) } : {}) });
            if (pendingImage && k === 0) { blocks.push({ type: 'image', src: pendingImage.ref }); pendingImage = null; }
            pushScene(blocks);
          }
          break;
        }
        case 'table': {
          flushText();
          const a = it.analysis || {};
          if (a.chart) pushScene([chartBlockFromTable(it.rows, a, secTitle)]);
          if (!a.chart || (a.rows <= 6 && a.cols <= 5 && a.textHeavy)) pushScene([{ type: 'table', columns: it.rows[0], rows: it.rows.slice(1, 8) }]);
          break;
        }
        case 'chart': {
          flushText();
          const kind = { bar: 'bar', hbar: 'hbar', line: 'line', area: 'area', pie: 'pie', donut: 'donut', scatter: 'scatter', stacked: 'stacked', radar: 'radar' }[it.chartType] || 'bar';
          pushScene([{ type: 'chart', kind, data: { labels: it.labels, series: it.series.map((s) => ({ name: s.name, values: s.values })) } }], { ...(it.title && !secTitle ? {} : {}) });
          break;
        }
        case 'quote': flushText(); scenes.push({ blocks: [{ type: 'quote', text: clip(it.text, 90), ...(it.author ? { author: it.author } : {}) }] }); break;
        case 'code': flushText(); pushScene([{ type: 'code', code: it.code.split('\n').slice(0, 14).join('\n'), language: it.language }]); break;
        case 'equation': flushText(); pushScene([{ type: 'equation', latex: it.latex }]); break;
        default:
      }
    }
    flushText();
    void toneCycle;
  }
  // closing
  scenes.push({ blocks: [{ type: 'title', text: cjk ? '谢谢观看' : 'Thank you', ...(o.contact ? { subtitle: o.contact } : {}) }], layout: 'closing' });
  let finalScenes = scenes;
  const max = o.maxScenes || 30;
  if (finalScenes.length > max) {
    // keep cover, closing, sections and data scenes first; drop plain text scenes beyond the budget
    const score = (s) => (s.layout === 'section' ? 3 : s.blocks.some((b) => ['chart', 'stats', 'stat', 'timeline', 'steps', 'table'].includes(b.type)) ? 2 : s.blocks.some((b) => b.type === 'bullets' || b.type === 'features') ? 1 : 0);
    const middle = finalScenes.slice(1, -1).map((s, i) => ({ s, i, k: score(s) }));
    const keep = new Set(middle.sort((a, b) => b.k - a.k || a.i - b.i).slice(0, max - 2).map((x) => x.i));
    finalScenes = [finalScenes[0], ...finalScenes.slice(1, -1).filter((_, i) => keep.has(i)), finalScenes[finalScenes.length - 1]];
  }
  const doc = {
    title, theme: { id: theme }, format: o.aspect || '16:9',
    style: { energy: o.energy ?? (theme === 'pop' ? 0.85 : theme === 'noir' || theme === 'ink' ? 0.35 : 0.6), pageNumbers: finalScenes.length > 6 && ['editorial', 'corporate', 'swiss'].includes(theme) },
    meta: { description: `由 ${outline.sources.map((s) => s.file.split(/[\\/]/).pop()).join('、')} 自动生成`, source: outline.sources.map((s) => s.file.split(/[\\/]/).pop()) },
    scenes: finalScenes,
  };
  return normalizeDocument(doc).doc;
}

function keyNumbers(text) {
  const out = [];
  const re = /([^，。；,;:：\n\d]{0,12}?)((?:增长|提升|下降|减少|达到|超过|突破|约|共|累计)?\s*[¥$€£]?\s*\d[\d,.]*\s*(?:%|万|亿|倍|x|k|K|M|B)\+?)([^，。；,;:：\n\d]{0,12})/g;
  let m;
  while ((m = re.exec(text))) {
    const v = m[2].replace(/^(增长|提升|下降|减少|达到|超过|突破|约|共|累计)\s*/, '').trim();
    const p = parseNumberish(v);
    if (!p || !p.suffix) continue;
    out.push({ value: v, label: (m[1] + m[3]).replace(/^[的是为了在]|[的是为了]$/g, '').trim(), delta: /增长|提升/.test(m[2]) ? '+' : null });
  }
  return out;
}
