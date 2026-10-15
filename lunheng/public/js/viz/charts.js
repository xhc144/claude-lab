// SVG charts: consensus evolution, consensus-vs-evidence map, cumulative cost.
import { STATUS_COLOR, STATUS } from '../lib/fmt.js';

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

const PH = { independent: '独立', investigate: '攻关', critique: '质询', rebuttal: '答辩', verify: '核验', synthesis: '综合', report: '报告' };

/** Stacked area of agree / unsure / disagree counts per snapshot, with the status ribbon underneath. */
export function consensusChart(history, id, { width = 640, height = 240 } = {}) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', role: 'img', 'aria-label': `${id} 的共识演化` });
  const pts = history.filter((x) => x.claims[id]);
  if (pts.length < 1) {
    svg.append(el('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle' }, '尚无立场数据'));
    return svg;
  }
  const m = { l: 34, r: 12, t: 12, b: 46 };
  const iw = width - m.l - m.r, ih = height - m.t - m.b;
  const maxN = Math.max(1, ...pts.map((p) => p.claims[id].a + p.claims[id].u + p.claims[id].d));
  const X = (i) => m.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const Y = (v) => m.t + ih - (v / maxN) * ih;
  for (let v = 0; v <= maxN; v++) {
    svg.append(el('line', { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), stroke: 'rgba(120,170,255,0.08)' }));
    svg.append(el('text', { x: m.l - 8, y: Y(v) + 3, 'text-anchor': 'end' }, v));
  }
  const layers = [['d', '#ff5c8a'], ['u', '#ffb547'], ['a', '#34f5a4']];
  let base = pts.map(() => 0);
  for (const [k, color] of layers) {
    const top = pts.map((p, i) => base[i] + p.claims[id][k]);
    let d = `M ${X(0)} ${Y(top[0])}`;
    pts.forEach((_, i) => { d += ` L ${X(i)} ${Y(top[i])}`; });
    for (let i = pts.length - 1; i >= 0; i--) d += ` L ${X(i)} ${Y(base[i])}`;
    svg.append(el('path', { d: d + ' Z', fill: color, 'fill-opacity': 0.22, stroke: color, 'stroke-width': 1.5, 'stroke-opacity': 0.8 }));
    base = top;
  }
  const by = m.t + ih + 10;
  pts.forEach((p, i) => {
    const st = p.claims[id].st;
    const x0 = pts.length === 1 ? m.l : X(i) - iw / (pts.length - 1) / 2;
    const w = pts.length === 1 ? iw : iw / (pts.length - 1);
    svg.append(el('rect', { x: Math.max(m.l, x0), y: by, width: Math.min(w, m.l + iw - Math.max(m.l, x0)), height: 7, fill: STATUS_COLOR[st] || '#8b9ab3', rx: 1.5 }, ''));
    const t = el('title', {}, `R${p.round}·${PH[p.phase] || p.phase}：${STATUS[st]}`);
    svg.lastChild.append(t);
    if (pts.length <= 14 || i % Math.ceil(pts.length / 14) === 0) svg.append(el('text', { x: X(i), y: by + 24, 'text-anchor': 'middle' }, `R${p.round}·${PH[p.phase] || ''}`));
  });
  svg.append(el('text', { x: m.l, y: height - 4 }, '证据状态 →'));
  return svg;
}

const RANK = { proved: 0.95, conditional: 0.78, pending: 0.6, conjecture: 0.45, open: 0.45, disputed: 0.32, refuted: 0.05, inconsistent: 0.5 };

/** Each claim placed by weighted consensus (x) against its evidence-based status (y). */
export function evidenceMap(ledger, team, { width = 420, height = 320, onPick } = {}) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', role: 'img', 'aria-label': '共识与证据对照' });
  const m = { l: 18, r: 18, t: 18, b: 30 };
  const iw = width - m.l - m.r, ih = height - m.t - m.b;
  const cx = m.l + iw / 2, cy = m.t + ih / 2;
  const quad = [
    [cx, m.t, '多数同意 · 已证明', '#34f5a4'],
    [m.l, m.t, '少数派获证 · 已证明', '#4de8ff'],
    [cx, cy, '多数同意 · 未证或被否定 ⚠', '#ffb547'],
    [m.l, cy, '多数反对 · 未证或被否定', '#8b9ab3'],
  ];
  for (const [x, y, label, c] of quad) {
    svg.append(el('rect', { x, y, width: iw / 2, height: ih / 2, fill: c, 'fill-opacity': 0.035, stroke: 'rgba(120,170,255,0.08)' }));
    svg.append(el('text', { x: x + 8, y: y + 15, style: `fill:${c};opacity:.75` }, label));
  }
  svg.append(el('text', { x: cx, y: height - 8, 'text-anchor': 'middle' }, '← 反对    立场加权共识    同意 →'));
  const active = new Set(team.map((r) => r.id));
  for (const c of Object.values(ledger.claims)) {
    if (c.withdrawn || c.kind === 'definition') continue;
    const st = ledger.stances[c.id] || {};
    let w = 0, ws = 0, n = 0;
    for (const [rid, s] of Object.entries(st)) {
      if (!active.has(rid)) continue;
      const cw = s.confidence ?? 0.5;
      ws += cw; n++;
      w += s.position === 'agree' ? cw : s.position === 'disagree' ? -cw : 0;
    }
    if (!n) continue;
    const xv = ws ? w / ws : 0;
    const x = cx + xv * (iw / 2 - 14);
    const y = m.t + (1 - (RANK[c.status] ?? 0.45)) * ih;
    const col = STATUS_COLOR[c.status] || '#8b9ab3';
    const g = el('g', { style: 'cursor:pointer' });
    g.append(el('circle', { cx: x, cy: y, r: c.id === 'C0' ? 9 : 6, fill: col, 'fill-opacity': 0.85, stroke: '#04060c', 'stroke-width': 1.5 }));
    g.append(el('text', { x: x + 10, y: y + 4, style: `fill:${col};font-weight:700` }, c.id));
    g.append(el('title', {}, `${c.id} · ${STATUS[c.status]} · ${n} 人表态`));
    g.addEventListener('click', () => onPick?.(c.id));
    svg.append(g);
  }
  return svg;
}

/** Cumulative cost line over completed calls. */
export function costLine(calls, { width = 640, height = 140 } = {}) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%' });
  const done = calls.filter((c) => c.status === 'ok').sort((a, b) => String(a.endedAt).localeCompare(String(b.endedAt)));
  if (done.length < 2) { svg.append(el('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle' }, '调用数据不足')); return svg; }
  const m = { l: 4, r: 4, t: 8, b: 4 };
  let acc = 0;
  const ys = done.map((c) => (acc += c.costUsd || 0));
  const max = Math.max(1e-9, acc);
  const X = (i) => m.l + (i / (done.length - 1)) * (width - m.l - m.r);
  const Y = (v) => m.t + (1 - v / max) * (height - m.t - m.b);
  let d = `M ${X(0)} ${Y(ys[0])}`;
  ys.forEach((v, i) => { d += ` L ${X(i)} ${Y(v)}`; });
  svg.append(el('path', { d: `${d} L ${X(ys.length - 1)} ${height - m.b} L ${X(0)} ${height - m.b} Z`, fill: 'url(#cg)', opacity: 0.5 }));
  const defs = el('defs');
  const lg = el('linearGradient', { id: 'cg', x1: 0, y1: 0, x2: 0, y2: 1 });
  lg.append(el('stop', { offset: 0, 'stop-color': '#4de8ff', 'stop-opacity': 0.5 }), el('stop', { offset: 1, 'stop-color': '#4de8ff', 'stop-opacity': 0 }));
  defs.append(lg);
  svg.prepend(defs);
  svg.append(el('path', { d, fill: 'none', stroke: '#4de8ff', 'stroke-width': 1.8 }));
  return svg;
}
