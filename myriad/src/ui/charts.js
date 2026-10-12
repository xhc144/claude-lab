// Charts drawn with canvas: time-series lines, the "histomap" (a stream graph of nations' fortunes
// through time) and the phylogenetic tree of life.

import { fmtNum } from '../core/util.js';

function setup(canvas, heightCss) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const W = Math.max(50, r.width || canvas.clientWidth || 300);
  const H = heightCss || r.height || 150;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}

/** series: [{values, color, label}] sharing x values xs */
export function lineChart(canvas, xs, series, opts = {}) {
  const { ctx, W, H } = setup(canvas);
  ctx.clearRect(0, 0, W, H);
  const padL = 40, padR = 8, padT = 10, padB = 18;
  if (!xs.length) { ctx.fillStyle = '#6d7390'; ctx.font = '12px sans-serif'; ctx.fillText('暂无数据', W / 2 - 24, H / 2); return; }
  let lo = opts.min ?? Infinity, hi = opts.max ?? -Infinity;
  if (opts.min === undefined || opts.max === undefined) {
    for (const s of series) for (const v of s.values) { if (opts.min === undefined) lo = Math.min(lo, v); if (opts.max === undefined) hi = Math.max(hi, v); }
  }
  if (hi - lo < 1e-9) { hi += 1; lo -= opts.min === undefined ? 1 : 0; }
  const x0 = xs[0], x1 = xs[xs.length - 1] || x0 + 1;
  const X = (x) => padL + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - padL - padR);
  const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.fillStyle = '#6d7390';
  ctx.font = '10px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.lineWidth = 1;
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3;
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(opts.fmt ? opts.fmt(v) : fmtNum(v), padL - 4, y + 3);
  }
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(x0)} 年`, padL, H - 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(x1)} 年`, W - padR, H - 4);
  if (opts.zero && lo < 0 && hi > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(W - padR, Y(0)); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(xs.length / (W - padL)));
    for (let i = 0; i < xs.length; i += step) {
      const x = X(xs[i]), y = Y(s.values[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const li = xs.length - 1;
    ctx.lineTo(X(xs[li]), Y(s.values[li]));
    ctx.stroke();
    if (s.fill) {
      ctx.lineTo(X(xs[li]), Y(lo)); ctx.lineTo(X(xs[0]), Y(lo)); ctx.closePath();
      ctx.globalAlpha = 0.12; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = 1;
    }
  }
}

/** stream graph of nations' population through time; returns hit-test function */
export function histomap(canvas, w, opts = {}) {
  const { ctx, W, H } = setup(canvas);
  ctx.clearRect(0, 0, W, H);
  const nations = w.nations.filter((n) => n.hist.length > 0);
  if (!nations.length) {
    ctx.fillStyle = '#6d7390'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('文明出现后，这里将展开一幅世界史长卷', W / 2, H / 2);
    return () => null;
  }
  const t0 = Math.min(...nations.map((n) => n.founded));
  const t1 = w.tick;
  const cols = Math.max(2, Math.floor(W / 2));
  const ts = Array.from({ length: cols }, (_, i) => t0 + ((t1 - t0) * i) / (cols - 1));
  // order: by founding, children placed after their parent
  const order = [];
  const byParent = new Map();
  for (const n of nations) { const p = n.parent ?? -1; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(n); }
  const visit = (n) => { order.push(n); for (const c of byParent.get(n.id) || []) visit(c); };
  for (const n of nations) if (n.parent == null || !nations.includes(w.nations[n.parent])) visit(n);
  for (const n of nations) if (!order.includes(n)) order.push(n);
  const val = (n, t) => {
    if (t < n.founded || (n.fell != null && t > n.fell)) return 0;
    const hst = n.hist;
    if (t <= hst[0][0]) return hst[0][1];
    for (let k = 1; k < hst.length; k++) {
      if (hst[k][0] >= t) { const a = hst[k - 1], b = hst[k]; const f = (t - a[0]) / Math.max(1, b[0] - a[0]); return a[1] + (b[1] - a[1]) * f; }
    }
    return n.alive ? n.stats.pop : hst[hst.length - 1][1];
  };
  const grid = order.map((n) => ts.map((t) => Math.sqrt(Math.max(0, val(n, t)))));
  const totals = ts.map((_, i) => grid.reduce((s, row) => s + row[i], 0));
  const bands = [];
  for (let i = 0; i < cols; i++) {
    const tot = totals[i] || 1;
    let acc = 0;
    for (let k = 0; k < order.length; k++) {
      const v = grid[k][i] / tot;
      (bands[k] || (bands[k] = [])).push([acc, acc + v]);
      acc += v;
    }
  }
  const X = (i) => (i / (cols - 1)) * W;
  for (let k = 0; k < order.length; k++) {
    const n = order[k];
    const b = bands[k];
    ctx.fillStyle = `rgb(${n.color[0]},${n.color[1]},${n.color[2]})`;
    ctx.beginPath();
    for (let i = 0; i < cols; i++) ctx.lineTo(X(i), b[i][0] * H);
    for (let i = cols - 1; i >= 0; i--) ctx.lineTo(X(i), b[i][1] * H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  // labels where bands are widest
  ctx.font = '600 11px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 0; k < order.length; k++) {
    const b = bands[k];
    let bi = 0, bw = 0;
    for (let i = 0; i < cols; i++) { const wdt = b[i][1] - b[i][0]; if (wdt > bw) { bw = wdt; bi = i; } }
    if (bw * H < 13) continue;
    const name = order[k].root.z;
    const x = Math.min(W - 30, Math.max(30, X(bi)));
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(name, x + 1, ((b[bi][0] + b[bi][1]) / 2) * H + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, x, ((b[bi][0] + b[bi][1]) / 2) * H);
  }
  ctx.textBaseline = 'alphabetic';
  return (mx, my) => {
    const i = Math.max(0, Math.min(cols - 1, Math.round((mx / W) * (cols - 1))));
    const fy = my / H;
    for (let k = 0; k < order.length; k++) if (fy >= bands[k][i][0] && fy <= bands[k][i][1] && bands[k][i][1] > bands[k][i][0]) return order[k];
    return null;
  };
}

/** the tree of life; returns {height, hit(x, y) → species} */
export function phyloTree(canvas, w, opts = {}) {
  const sp = w.species;
  const keep = new Set();
  // show species that mattered (and their ancestors), plus all living ones
  for (const s of sp) {
    if (s.extinct === null && s.pop > 0 || s.peak >= (opts.minPeak ?? 12) || s.sapient) {
      let p = s;
      while (p && !keep.has(p.id)) { keep.add(p.id); p = p.parent >= 0 ? sp[p.parent] : null; }
    }
  }
  const children = new Map();
  for (const s of sp) {
    if (!keep.has(s.id)) continue;
    const p = s.parent >= 0 && keep.has(s.parent) ? s.parent : -1;
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(s);
  }
  const rows = [];
  const visit = (s, depth) => {
    rows.push(s);
    for (const c of (children.get(s.id) || []).sort((a, b) => a.born - b.born)) visit(c, depth + 1);
  };
  for (const r of (children.get(-1) || []).sort((a, b) => a.born - b.born)) visit(r, 0);
  const rowH = 14;
  const height = Math.max(120, rows.length * rowH + 30);
  const { ctx, W, H } = setup(canvas, height);
  ctx.clearRect(0, 0, W, H);
  const t0 = 0, t1 = Math.max(1, w.tick);
  const padL = 6, padR = 112;
  const X = (t) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
  const yOf = new Map();
  rows.forEach((s, i) => yOf.set(s.id, 16 + i * rowH));
  ctx.font = '11px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textBaseline = 'middle';
  for (const s of rows) {
    const y = yOf.get(s.id);
    const xa = X(s.born), xb = X(s.extinct ?? w.tick);
    const col = `rgb(${s.color[0]},${s.color[1]},${s.color[2]})`;
    if (s.parent >= 0 && yOf.has(s.parent)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xa, yOf.get(s.parent)); ctx.lineTo(xa, y); ctx.stroke();
    }
    const alive = s.extinct === null;
    ctx.strokeStyle = col;
    ctx.globalAlpha = alive ? 1 : 0.45;
    ctx.lineWidth = Math.max(1.2, Math.min(7, Math.log2(1 + (alive ? s.pop : s.peak * 0.3)) * 0.9));
    ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(Math.max(xa + 1.5, xb), y); ctx.stroke();
    ctx.globalAlpha = 1;
    if (opts.selected === s.id) { ctx.strokeStyle = '#f6e2a8'; ctx.lineWidth = 1; ctx.strokeRect(xa - 2, y - 6, Math.max(4, xb - xa) + 4, 12); }
    ctx.fillStyle = alive ? '#e8eaf3' : '#6d7390';
    ctx.fillText((s.sapient ? '★ ' : '') + s.name + (alive ? ` ${s.pop}` : ' †'), Math.max(xb + 4, xa + 4), y);
  }
  return {
    height,
    hit: (mx, my) => {
      const i = Math.round((my - 16) / rowH);
      return rows[i] || null;
    },
  };
}

/** small sparkline for inspectors */
export function sparkline(canvas, values, color = '#e8c878') {
  const { ctx, W, H } = setup(canvas, 40);
  ctx.clearRect(0, 0, W, H);
  if (values.length < 2) return;
  const hi = Math.max(...values, 1), lo = Math.min(...values, 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  values.forEach((v, i) => { const x = (i / (values.length - 1)) * W, y = H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
}
