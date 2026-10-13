// Hand-built SVG/HTML chart kit. Every chart:
//   · draws from one scale per axis (never two y-scales),
//   · keeps text in the ink tokens and colour only on marks,
//   · ships a hover / touch / keyboard read-out (crosshair on lines, per-mark tooltip on bars),
//   · re-renders itself on resize.
// Series colours follow the validated categorical order below; colour follows the entity, not rank.

import { clamp, esc, uid, reducedMotion } from '../core/util.js';

export const SERIES = ['#00a5c3', '#da720d', '#876fe4', '#2e9e52', '#d45198', '#ad9000', '#0083e0', '#d74745'];
export const SURFACE = '#0b1019';
export const RAMP = {
  cyan: ['#012d31', '#004147', '#00565e', '#006c76', '#008390', '#009baa', '#00b3c5', '#00ccdf', '#00e3f7'],
  amber: ['#372010', '#502f16', '#6a3e1d', '#854e24', '#a15e2c', '#bf6f33', '#dd813a', '#fb9344', '#ffaa5c'],
  violet: ['#27223b', '#393255', '#4b4271', '#5f538e', '#7365ac', '#8877cb', '#9e89eb', '#b49dff', '#cab3ff'],
};
export const STATUS = { good: '#41d686', warn: '#f0b135', serious: '#f08657', crit: '#fc5855', idle: '#5d6a80' };

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (r) => '#' + r.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Sample a ramp at t in [0, 1] with linear interpolation between steps. */
export function rampAt(ramp, t) {
  const steps = RAMP[ramp] || ramp;
  t = clamp(t, 0, 1) * (steps.length - 1);
  const i = Math.min(steps.length - 2, Math.floor(t));
  const a = hexToRgb(steps[i]), b = hexToRgb(steps[i + 1]);
  const k = t - i;
  return rgbToHex(a.map((v, j) => v + (b[j] - v) * k));
}

// ---- shared tooltip ---------------------------------------------------------------------------

let tipEl = null;
export function showTip(html, x, y) {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'viz-tip';
    tipEl.setAttribute('role', 'status');
    document.body.appendChild(tipEl);
  }
  tipEl.innerHTML = html;
  tipEl.classList.add('on');
  const r = tipEl.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight;
  let left = x + 16, top = y - r.height - 12;
  if (left + r.width > vw - 8) left = x - r.width - 16;
  if (top < 8) top = y + 18;
  if (top + r.height > vh - 8) top = vh - r.height - 8;
  tipEl.style.transform = `translate(${Math.max(8, left)}px, ${top}px)`;
}
export function hideTip() { tipEl?.classList.remove('on'); }

export const tipRow = (color, name, value, extra = '') =>
  `<div class="tr"><span class="key" style="background:${color}"></span><span class="n">${esc(name)}</span><b>${value}</b>${extra}</div>`;

// ---- scales -------------------------------------------------------------------------------------

export function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
  return { lo, hi, step, ticks };
}

/** Monotone cubic (Fritsch–Carlson) path through points; never overshoots the data. */
export function smoothPath(pts) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); dy.push(pts[i + 1][1] - pts[i][1]); m.push(dy[i] / (dx[i] || 1)); }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(pts[i][0] + h).toFixed(2)},${(pts[i][1] + h * t[i]).toFixed(2)} ${(pts[i + 1][0] - h).toFixed(2)},${(pts[i + 1][1] - h * t[i + 1]).toFixed(2)} ${pts[i + 1][0].toFixed(2)},${pts[i + 1][1].toFixed(2)}`;
  }
  return d;
}

const linePath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('');

/** Split [x,y|null] into contiguous runs so gaps in data stay gaps. */
function runs(xs, ys, sx, sy) {
  const out = [];
  let cur = [];
  ys.forEach((v, i) => {
    if (v == null || Number.isNaN(v)) { if (cur.length) out.push(cur); cur = []; return; }
    cur.push([sx(xs[i]), sy(v)]);
  });
  if (cur.length) out.push(cur);
  return out;
}

function observe(host, fn) {
  let w = host.clientWidth;
  const ro = new ResizeObserver(() => {
    const nw = host.clientWidth;
    if (Math.abs(nw - w) > 1) { w = nw; fn(); }
  });
  ro.observe(host);
  return () => ro.disconnect();
}

// ---- line / area chart ------------------------------------------------------------------------

/**
 * lineChart(host, {
 *   x: number[], series: [{ name, color, values, area?, dash?, width? }],
 *   height, xFmt, yFmt, tipX, yMin, yMax, yTicks, xTicks, area, smooth, glow, stream, endDot, refLines: [{ y, label }]
 * })
 */
export function lineChart(host, opts) {
  const id = uid('lc');
  let o = { height: 220, yTicks: 4, xTicks: 5, area: true, smooth: true, endDot: true, glow: true, yMin: 0, ...opts };
  let hover = -1;
  let smoothMax = null;
  host.classList.add('viz');
  host.tabIndex = 0;
  host.setAttribute('role', 'img');
  if (o.label) host.setAttribute('aria-label', o.label);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'viz-svg');
  host.appendChild(svg);
  let geo = null;

  function render(shifted = false) {
    const W = Math.max(120, host.clientWidth);
    const H = o.height;
    const xs = o.x;
    const all = o.series.flatMap((s) => s.values.filter((v) => v != null));
    let lo = o.yMin != null ? Math.min(o.yMin, ...all) : Math.min(...all);
    let hi = o.yMax != null ? o.yMax : Math.max(...all, ...(o.refLines || []).map((r) => r.y));
    if (o.yMin == null) lo -= (hi - lo) * 0.08;
    if (o.stream) {
      // ease the y-range so a live chart breathes instead of jumping on every spike
      smoothMax = smoothMax == null ? hi : hi > smoothMax ? hi : smoothMax + (hi - smoothMax) * 0.08;
      hi = smoothMax;
    }
    const { ticks, lo: tlo, hi: thi } = niceTicks(lo, hi * 1.04, o.yTicks);
    const yf = (v) => String((o.yFmt || String)(v));
    const padL = Math.max(...ticks.map((t) => yf(t).length)) * 6.4 + 14;
    const pad = { l: o.hideY ? 6 : padL, r: o.endLabel ? 64 : 14, t: 12, b: o.hideX ? 8 : 26 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const x0 = xs[0], x1 = xs[xs.length - 1];
    const sx = (v) => pad.l + ((v - x0) / (x1 - x0 || 1)) * pw;
    const sy = (v) => pad.t + ph - ((v - tlo) / (thi - tlo || 1)) * ph;
    geo = { W, H, pad, pw, ph, sx, sy, xs };

    let s = `<defs><clipPath id="${id}-c"><rect x="${pad.l}" y="0" width="${pw}" height="${H}"/></clipPath>`;
    o.series.forEach((se, i) => {
      s += `<linearGradient id="${id}-g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${se.color}" stop-opacity="${se.areaOpacity ?? 0.2}"/><stop offset="1" stop-color="${se.color}" stop-opacity="0"/></linearGradient>`;
    });
    s += '</defs>';
    // grid + y labels
    s += '<g class="grid">';
    for (const t of ticks) {
      const y = sy(t).toFixed(1);
      s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/>`;
      if (!o.hideY) s += `<text class="ax" x="${pad.l - 8}" y="${y}" dy="3.5" text-anchor="end">${esc(yf(t))}</text>`;
    }
    s += '</g>';
    // x labels
    if (!o.hideX) {
      const labelW = Math.max(...[xs[0], xs[xs.length - 1]].map((v) => String((o.xFmt || String)(v)).length)) * 6.6 + 18;
      const n = Math.max(2, Math.min(o.xTicks, xs.length, Math.floor(pw / labelW)));
      s += '<g>';
      for (let k = 0; k < n; k++) {
        const idx = Math.round((k / Math.max(1, n - 1)) * (xs.length - 1));
        const anchor = k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle';
        s += `<text class="ax" x="${sx(xs[idx]).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${esc((o.xFmt || String)(xs[idx]))}</text>`;
      }
      s += '</g>';
    }
    for (const r of o.refLines || []) {
      const y = sy(r.y).toFixed(1);
      s += `<g class="ref"><line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l + 8}" y="${y}" dy="-7">${esc(r.label)}</text></g>`;
    }
    s += `<g clip-path="url(#${id}-c)"><g class="plot">`;
    const base = sy(Math.max(tlo, 0));
    o.series.forEach((se, i) => {
      const segs = runs(xs, se.values, sx, sy);
      const pathOf = o.smooth ? smoothPath : linePath;
      for (const seg of segs) {
        const d = pathOf(seg);
        if ((se.area ?? o.area) && seg.length > 1) {
          s += `<path class="area" d="${d}L${seg[seg.length - 1][0].toFixed(2)},${base}L${seg[0][0].toFixed(2)},${base}Z" fill="url(#${id}-g${i})"/>`;
        }
        s += `<path class="line${se.dash ? ' dash' : ''}" d="${d}" style="stroke:${se.color};stroke-width:${se.width || 2}px${o.glow && !se.dash ? `;filter:drop-shadow(0 0 6px ${se.color}66)` : ''}"/>`;
      }
    });
    s += '</g></g>';
    // end dots / labels (not clipped)
    o.series.forEach((se) => {
      let li = se.values.length - 1;
      while (li >= 0 && se.values[li] == null) li--;
      if (li < 0) return;
      const ex = sx(xs[li]), ey = sy(se.values[li]);
      if (o.endDot && !se.dash) {
        if (o.stream) s += `<circle class="pulse" cx="${ex}" cy="${ey}" r="4" style="fill:${se.color}"/>`;
        s += `<circle cx="${ex}" cy="${ey}" r="4" fill="${se.color}" stroke="${SURFACE}" stroke-width="2"/>`;
      }
      if (o.endLabel) s += `<text class="end" x="${ex + 9}" y="${ey}" dy="3.5">${esc((o.endFmt || yf)(se.values[li]))}</text>`;
    });
    s += `<g class="cross" visibility="hidden"><line class="cx" y1="${pad.t}" y2="${pad.t + ph}"/>${o.series.map((se) => `<circle r="4.5" fill="${se.color}" stroke="${SURFACE}" stroke-width="2"/>`).join('')}</g>`;
    s += `<rect class="hit" x="${pad.l}" y="0" width="${pw}" height="${H}" fill="transparent"/>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);
    svg.innerHTML = s;

    if (shifted && !reducedMotion() && xs.length > 1) {
      const step = sx(xs[xs.length - 1]) - sx(xs[xs.length - 2]);
      const plot = svg.querySelector('.plot');
      plot.style.transform = `translateX(${step}px)`;
      plot.getBoundingClientRect();
      plot.style.transition = 'transform 1s linear';
      plot.style.transform = 'translateX(0)';
    }
    if (hover >= 0) drawCross(Math.min(hover, xs.length - 1), false);
  }

  function nearest(px) {
    const { sx, xs } = geo;
    let best = 0, bd = Infinity;
    for (let i = 0; i < xs.length; i++) { const d = Math.abs(sx(xs[i]) - px); if (d < bd) { bd = d; best = i; } }
    return best;
  }

  function drawCross(i, withTip = true, clientX, clientY) {
    hover = i;
    const g = svg.querySelector('.cross');
    if (!g || !geo) return;
    const { sx, sy, xs } = geo;
    const x = sx(xs[i]);
    g.setAttribute('visibility', 'visible');
    g.querySelector('line').setAttribute('x1', x);
    g.querySelector('line').setAttribute('x2', x);
    [...g.querySelectorAll('circle')].forEach((c, k) => {
      const v = o.series[k].values[i];
      c.setAttribute('visibility', v == null ? 'hidden' : 'visible');
      if (v != null) { c.setAttribute('cx', x); c.setAttribute('cy', sy(v)); }
    });
    if (!withTip) return;
    const fmtV = o.tipFmt || o.yFmt || String;
    const rows = o.series.filter((se) => se.values[i] != null).map((se) => tipRow(se.color, se.name, esc(fmtV(se.values[i], se))));
    const head = esc((o.tipX || o.xFmt || String)(xs[i]));
    const rect = svg.getBoundingClientRect();
    const cx = clientX ?? rect.left + (x / geo.W) * rect.width;
    const cy = clientY ?? rect.top + rect.height / 3;
    showTip(`<div class="th">${head}</div>${rows.join('')}${o.tipExtra ? o.tipExtra(i) : ''}`, cx, cy);
  }

  function clear() {
    hover = -1;
    svg.querySelector('.cross')?.setAttribute('visibility', 'hidden');
    hideTip();
  }

  const onMove = (e) => {
    if (!geo) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * geo.W;
    drawCross(nearest(px), true, e.clientX, e.clientY);
  };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerdown', onMove);
  svg.addEventListener('pointerleave', clear);
  host.addEventListener('blur', clear);
  host.addEventListener('keydown', (e) => {
    if (!geo) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = geo.xs.length;
      const i = hover < 0 ? n - 1 : clamp(hover + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1);
      drawCross(i, true);
    } else if (e.key === 'Escape') clear();
  });

  render();
  const stop = observe(host, () => render());
  return {
    update(next, { shifted = false } = {}) { o = { ...o, ...next }; render(shifted); },
    destroy() { stop(); clear(); svg.remove(); },
  };
}

// ---- column chart (stacked or grouped) ---------------------------------------------------------

/**
 * barChart(host, { labels, series: [{ name, color, values }], stacked, height, yFmt, xFmt, tipX, refLines, highlight, every, onPick })
 */
export function barChart(host, opts) {
  let o = { height: 220, yTicks: 4, stacked: true, ...opts };
  host.classList.add('viz');
  host.tabIndex = 0;
  if (o.label) host.setAttribute('aria-label', o.label);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'viz-svg');
  host.appendChild(svg);
  let geo = null, hover = -1;

  const roundTop = (x, y, w, h, r) => {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  function render() {
    const W = Math.max(120, host.clientWidth), H = o.height;
    const n = o.labels.length;
    const totals = o.labels.map((_, i) => o.stacked ? o.series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...o.series.map((s) => s.values[i] || 0)));
    const { ticks, hi } = niceTicks(0, Math.max(...totals, ...(o.refLines || []).map((r) => r.y)) * 1.05, o.yTicks);
    const yf = (v) => String((o.yFmt || String)(v));
    const padL = Math.max(...ticks.map((t) => yf(t).length)) * 6.4 + 14;
    const pad = { l: padL, r: 12, t: 14, b: 26 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const band = pw / n;
    const sy = (v) => pad.t + ph - (v / hi) * ph;
    geo = { W, pad, band, n };
    let s = '<g class="grid">';
    for (const t of ticks) {
      const y = sy(t).toFixed(1);
      s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text class="ax" x="${pad.l - 8}" y="${y}" dy="3.5" text-anchor="end">${esc(yf(t))}</text>`;
    }
    s += '</g>';
    const every = o.every || Math.ceil(n / Math.max(2, Math.floor(pw / 56)));
    s += `<rect class="band-hl" y="${pad.t}" height="${ph}" width="${band}" x="-999"/>`;
    for (let i = 0; i < n; i++) {
      const cx = pad.l + band * i + band / 2;
      if (i % every === 0 || i === n - 1) {
        if (!(i === n - 1 && i % every !== 0 && i % every < every / 2)) s += `<text class="ax" x="${cx}" y="${H - 6}" text-anchor="middle">${esc((o.xFmt || String)(o.labels[i]))}</text>`;
      }
      const dim = o.highlight != null && o.highlight(i) === false ? ' dim' : '';
      if (o.stacked) {
        const bw = Math.min(24, band * 0.64);
        let acc = 0;
        const topIdx = o.series.map((se, k) => (se.values[i] > 0 ? k : -1)).filter((k) => k >= 0).pop();
        o.series.forEach((se, k) => {
          const v = se.values[i] || 0;
          if (v <= 0) return;
          const y0 = sy(acc), y1 = sy(acc + v);
          acc += v;
          const gap = k === 0 ? 0 : 2; // surface gap between stacked segments
          const h = Math.max(0, y0 - y1 - gap);
          const x = cx - bw / 2;
          s += k === topIdx
            ? `<path class="vb${dim}" d="${roundTop(x, y1, bw, h, 4)}" fill="${se.color}"/>`
            : `<rect class="vb${dim}" x="${x}" y="${y1}" width="${bw}" height="${h}" fill="${se.color}"/>`;
        });
      } else {
        const k = o.series.length;
        const bw = Math.min(14, (band * 0.7 - (k - 1) * 2) / k);
        const groupW = bw * k + (k - 1) * 2;
        o.series.forEach((se, j) => {
          const v = se.values[i] || 0;
          const x = cx - groupW / 2 + j * (bw + 2);
          s += `<path class="vb${dim}" d="${roundTop(x, sy(v), bw, sy(0) - sy(v), 4)}" fill="${se.color}"/>`;
        });
      }
    }
    for (const r of o.refLines || []) {
      const y = sy(r.y).toFixed(1);
      s += `<g class="ref"><line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l + 8}" y="${y}" dy="-7">${esc(r.label)}</text></g>`;
    }
    s += `<line class="base" x1="${pad.l}" x2="${W - pad.r}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    s += `<rect class="hit" x="${pad.l}" y="0" width="${pw}" height="${H}" fill="transparent"/>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);
    svg.innerHTML = s;
    if (hover >= 0) pick(hover, false);
  }

  function pick(i, tip = true, ex, ey) {
    hover = i;
    const hl = svg.querySelector('.band-hl');
    hl.setAttribute('x', geo.pad.l + geo.band * i);
    hl.setAttribute('width', geo.band);
    if (!tip) return;
    const f = o.tipFmt || o.yFmt || String;
    const rows = o.series.map((se) => tipRow(se.color, se.name, esc(f(se.values[i] || 0)))).reverse();
    const total = o.series.reduce((a, se) => a + (se.values[i] || 0), 0);
    const foot = o.stacked && o.series.length > 1 ? `<div class="tf"><span>合计</span><b>${esc(f(total))}</b></div>` : '';
    const rect = svg.getBoundingClientRect();
    showTip(`<div class="th">${esc((o.tipX || o.xFmt || String)(o.labels[i]))}</div>${rows.join('')}${foot}`,
      ex ?? rect.left + ((geo.pad.l + geo.band * (i + 0.5)) / geo.W) * rect.width, ey ?? rect.top + 30);
  }
  const clear = () => { hover = -1; svg.querySelector('.band-hl')?.setAttribute('x', -999); hideTip(); };
  const idxAt = (e) => {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * geo.W;
    return clamp(Math.floor((px - geo.pad.l) / geo.band), 0, geo.n - 1);
  };
  svg.addEventListener('pointermove', (e) => geo && pick(idxAt(e), true, e.clientX, e.clientY));
  svg.addEventListener('pointerleave', clear);
  svg.addEventListener('click', (e) => geo && o.onPick && o.onPick(idxAt(e)));
  host.addEventListener('blur', clear);
  host.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    pick(hover < 0 ? geo.n - 1 : clamp(hover + (e.key === 'ArrowRight' ? 1 : -1), 0, geo.n - 1));
  });
  render();
  const stop = observe(host, render);
  return { update(next) { o = { ...o, ...next }; render(); }, destroy() { stop(); clear(); svg.remove(); } };
}

// ---- donut ----------------------------------------------------------------------------------------

/** donut(host, { segments: [{ name, value, color }], size, thickness, fmt, centerLabel, centerValue }) */
export function donut(host, opts) {
  let o = { size: 188, thickness: 16, ...opts };
  host.classList.add('viz', 'donut');
  const wrap = document.createElement('div');
  wrap.className = 'donut-wrap';
  host.appendChild(wrap);
  let active = -1;

  function arc(cx, cy, r, a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }

  function render() {
    const S = o.size, r = S / 2 - o.thickness / 2 - 4;
    const total = o.segments.reduce((a, s) => a + s.value, 0) || 1;
    const gap = 2.6 / r; // 2px surface gap between segments, as an angle
    let a = 0;
    let paths = '';
    o.segments.forEach((sg, i) => {
      const span = (sg.value / total) * Math.PI * 2;
      const a0 = a + gap / 2, a1 = a + span - gap / 2;
      if (a1 > a0) paths += `<path class="seg${active === i ? ' on' : ''}${active >= 0 && active !== i ? ' dim' : ''}" data-i="${i}" d="${arc(S / 2, S / 2, r, a0, a1)}" style="stroke:${sg.color};stroke-width:${o.thickness}px"/>`;
      a += span;
    });
    const cur = active >= 0 ? o.segments[active] : null;
    const f = o.fmt || String;
    wrap.innerHTML = `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" class="viz-svg"><circle cx="${S / 2}" cy="${S / 2}" r="${r}" class="track" style="stroke-width:${o.thickness}px"/>${paths}</svg>
      <div class="donut-c"><span class="dl">${esc(cur ? cur.name : o.centerLabel || '合计')}</span><b class="dv">${esc(cur ? f(cur.value) : o.centerValue ?? f(total))}</b><span class="dp">${cur ? ((cur.value / total) * 100).toFixed(1) + '%' : esc(o.centerSub || '')}</span></div>`;
  }
  wrap.addEventListener('pointerover', (e) => {
    const i = e.target.closest('.seg')?.dataset.i;
    if (i != null && +i !== active) { active = +i; render(); o.onHover?.(active); }
  });
  wrap.addEventListener('pointerleave', () => { active = -1; render(); o.onHover?.(-1); });
  render();
  return {
    update(next) { o = { ...o, ...next }; render(); },
    focus(i) { active = i; render(); },
    destroy() { wrap.remove(); },
  };
}

// ---- small static pieces (strings) ----------------------------------------------------------------

/** Inline sparkline as an SVG string. Uses non-scaling strokes so it can stretch to its box. */
export function sparkline(values, { w = 120, h = 34, color = SERIES[0], area = true, dot = true, min } = {}) {
  const vs = values.filter((v) => v != null);
  if (vs.length < 2) return '';
  const lo = min ?? Math.min(...vs), hi = Math.max(...vs);
  const sx = (i) => 2 + (i / (values.length - 1)) * (w - 6);
  const sy = (v) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (h - 6);
  const pts = values.map((v, i) => [sx(i), sy(v)]);
  const d = smoothPath(pts);
  const gid = uid('sp');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    ${area ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".3"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${last[0]},${h}L${pts[0][0]},${h}Z" fill="url(#${gid})"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${dot ? `<circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="${color}" stroke="${SURFACE}" stroke-width="1.5"/>` : ''}
  </svg>`;
}

/** Circular meter as an SVG string; value in [0, 1]. */
export function ring(value, { size = 64, thickness = 6, color = SERIES[0], track = 'rgba(160,190,255,.1)', label = '' } = {}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const v = clamp(value, 0, 1);
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${thickness}"/>
    <circle class="ring-v" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - v)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

/** Horizontal bar list as HTML rows: [{ label, value, color, sub, href }]. */
export function hbars(rows, { fmt = String, max } = {}) {
  const m = max ?? Math.max(...rows.map((r) => r.value), 1);
  return `<div class="hbars">${rows.map((r) => `
    <div class="hb-row"${r.attrs || ''}>
      <div class="hb-l"><span class="hb-name">${r.key ? `<span class="key" style="background:${r.color}"></span>` : ''}${esc(r.label)}</span>${r.sub ? `<span class="hb-sub">${esc(r.sub)}</span>` : ''}</div>
      <div class="hb-track"><i style="width:${((r.value / m) * 100).toFixed(2)}%;background:${r.color}"></i></div>
      <b class="hb-v">${esc(fmt(r.value))}</b>
    </div>`).join('')}</div>`;
}

export const legend = (items) =>
  `<div class="legend" role="list">${items.map((it) => `<span class="lg" role="listitem"><span class="key${it.dash ? ' dash' : ''}" style="--c:${it.color}"></span>${esc(it.name)}${it.value != null ? `<b>${esc(it.value)}</b>` : ''}</span>`).join('')}</div>`;
