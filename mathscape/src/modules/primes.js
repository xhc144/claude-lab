// Module 12 — primes: the Ulam and Sacks spirals, Gaussian primes, how many primes there are
// (π(x) against x/ln x, Li(x) and Riemann's R(x), with a 40-digit table up to 10²⁵), and the zeros
// of ζ rebuilding the prime staircase through the explicit formula.

import { h } from '../ui/dom.js';
import { Layer, Viewport, observeSize, attachPointer, animationLoop } from '../ui/canvas.js';
import { section, slider, toggle, segmented, button, chips, readout } from '../ui/controls.js';
import { fmt } from '../ui/format.js';
import { C, MONO, FONT, alpha } from '../ui/theme.js';
import {
  sieve, factor, ulamIndex, gaussianPrime, PI_POW10, liFixed, riemannRFixed, roundFixed,
  li, riemannR, hardyZ, zetaZeros, chebyshevPsi, psiExplicit,
} from '../core/primes.js';

const TABS = {
  ulam: { label: '素数螺旋', note: '把 1, 2, 3, … 绕成方形螺旋，只点亮素数（乌拉姆 1963 年开会走神时画出来的）：素数明显挤在一些斜线上。斜线对应二次多项式 4n² + bn + c，有的多项式就是格外“爱”出素数。萨克斯螺旋把 n 放在半径 √n、角度 2π√n 处，平方数排在正右方，同一条曲线也是一条二次多项式。' },
  count: { label: '素数有多少', note: '小于 x 的素数个数 π(x) 约为 x/ln x（素数定理），也就是说 x 附近的素数平均每隔 ln x 个数出现一个。高斯更好的猜测是对数积分 Li(x)，黎曼的 R(x) 又好得多。右栏表格是 x = 10ᵏ 的精确值与这几个公式的差，Li 与 R 都用 40 位精度计算。' },
  zeros: { label: '黎曼零点', note: '黎曼的显式公式：ψ(x) = x − Σ x^ρ/ρ − ln 2π − ½ln(1 − x⁻²)，ψ(x) 把每个素数幂 pᵏ ≤ x 计为 ln p。每对零点 ρ = ½ ± iγ 贡献一个振幅 √x、频率 γ 的波，加的零点越多，平滑的曲线就越贴近素数的台阶。黎曼猜想：所有非平凡零点的实部都是 ½。' },
  gauss: { label: '高斯素数', note: '高斯整数 a + bi 里的“素数”：不能再分解成两个非单位高斯整数之积。2 = (1 + i)(1 − i) 和 5 = (2 + i)(2 − i) 在这里都不是素数了；而 3、7、11 这些除以 4 余 3 的素数仍然是。a + bi（a、b 都不为 0）是素数，当且仅当范数 a² + b² 是普通素数。' },
};

const groupDigits = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function create({ stage, panel, query, setQuery }) {
  const st = {
    tab: TABS[query.get('v')] ? query.get('v') : 'ulam',
    spiral: 'ulam', start: 1, K: 200, euler: false, twins: false,
    R: 60,
    logX: 3,
    N: 30, X: 100, playing: false,
    hover: null,
  };

  // ------------------------------------------------------------------ DOM
  const layer = new Layer(stage);
  const info = h('div', { class: 'overlay-card tl', id: 'primes-info' });
  stage.append(info);
  let W = 0, H = 0;
  const vp = new Viewport({ scale: 4, minScale: 0.2, maxScale: 70 });
  const gvp = new Viewport({ scale: 6, minScale: 0.5, maxScale: 70 });

  // one sieve shared by the spirals and the Gaussian primes (grown on demand)
  let isP = sieve(1000);
  const ensureSieve = (n) => { if (isP.length <= n) isP = sieve(Math.max(n, 2 * isP.length)); };
  const prime = (n) => n >= 0 && n < isP.length && isP[n] === 1;

  // ------------------------------------------------------------------ spirals
  const spiralImg = { canvas: document.createElement('canvas'), key: '' };
  const eulerSet = () => { const s = new Set(); for (let k = 0; k < 40; k++) s.add(k * k + k + 41); return s; };
  function spiralKind(n, euler) {
    if (!prime(n)) return 0;
    if (st.euler && euler.has(n)) return 3;
    if (st.twins && (prime(n - 2) || prime(n + 2))) return 2;
    return 1;
  }
  const KIND_RGB = [[11, 15, 23], [203, 213, 225], [244, 114, 182], [251, 191, 36]];
  function buildSpiralImage() {
    const key = `${st.K}|${st.start}|${st.euler}|${st.twins}`;
    if (spiralImg.key === key) return;
    const K = st.K, S = 2 * K + 1;
    ensureSieve(S * S + st.start + 2);
    const euler = eulerSet();
    const c = spiralImg.canvas;
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let row = 0; row < S; row++) {
      const y = K - row;
      for (let col = 0; col < S; col++) {
        const n = st.start - 1 + ulamIndex(col - K, y);
        const rgb = KIND_RGB[spiralKind(n, euler)];
        const q = 4 * (row * S + col);
        img.data[q] = rgb[0]; img.data[q + 1] = rgb[1]; img.data[q + 2] = rgb[2]; img.data[q + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    spiralImg.key = key;
  }
  const spiralCellAt = (wx, wy) => [Math.round(wx), Math.round(wy)];
  function sacksIndex(wx, wy) {
    const r = Math.hypot(wx, wy);
    let ph = Math.atan2(wy, wx) / (2 * Math.PI);
    if (ph < 0) ph += 1;
    const k = Math.round(r - ph);
    return Math.max(1, Math.round((k + ph) ** 2));
  }

  function drawUlam(ctx) {
    if (st.spiral === 'sacks') { drawSacks(ctx); return; }
    buildSpiralImage();
    const K = st.K, S = 2 * K + 1;
    const cell = vp.scale;
    if (cell < 18) {
      ctx.imageSmoothingEnabled = cell < 1.5;
      ctx.drawImage(spiralImg.canvas, vp.sx(-K - 0.5), vp.sy(K + 0.5), S * cell, S * cell);
    } else {
      // close up: every cell with its number
      const b = vp.bounds;
      const x0 = Math.max(-K, Math.floor(b.xmin)), x1 = Math.min(K, Math.ceil(b.xmax));
      const y0 = Math.max(-K, Math.floor(b.ymin)), y1 = Math.min(K, Math.ceil(b.ymax));
      const euler = eulerSet();
      ctx.font = `${Math.min(14, cell * 0.36)}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const n = st.start - 1 + ulamIndex(x, y);
          const kind = spiralKind(n, euler);
          const px = vp.sx(x), py = vp.sy(y);
          ctx.fillStyle = kind ? alpha(['#000', '#cbd5e1', '#f472b6', '#fbbf24'][kind], 0.85) : '#0e131c';
          ctx.fillRect(px - cell / 2 + 1, py - cell / 2 + 1, cell - 2, cell - 2);
          if (cell >= 26) {
            ctx.fillStyle = kind ? '#0b0f17' : C.text3;
            ctx.fillText(String(n), px, py + 0.5);
          }
        }
      }
      // the path of the spiral: from every visible cell to the next number
      if (cell >= 26) {
        ctx.strokeStyle = 'rgba(122, 162, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const q = nextSpiral([x, y]);
            if (Math.max(Math.abs(q[0]), Math.abs(q[1])) > K) continue;
            ctx.moveTo(vp.sx(x), vp.sy(y));
            ctx.lineTo(vp.sx(q[0]), vp.sy(q[1]));
          }
        }
        ctx.stroke();
      }
    }
    if (st.hover && st.hover.tab === 'ulam') {
      const [x, y] = st.hover.cell;
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      const r = Math.max(3, cell / 2);
      ctx.strokeRect(vp.sx(x) - r, vp.sy(y) - r, 2 * r, 2 * r);
    }
  }
  /** The lattice point after (x, y) along the Ulam spiral. */
  function nextSpiral([x, y]) {
    const k = Math.max(Math.abs(x), Math.abs(y));
    if (x === k && y === -k) return [x + 1, y]; // last cell of a ring (or the centre): out to the next ring
    if (x === k) return [x, y + 1];
    if (y === k && x > -k) return [x - 1, y];
    if (x === -k && y > -k) return [x, y - 1];
    return [x + 1, y];
  }

  function drawSacks(ctx) {
    const N = (2 * st.K + 1) ** 2;
    ensureSieve(N + 2);
    const euler = eulerSet();
    const sz = Math.max(1.2, Math.min(5, vp.scale * 0.35));
    const groups = [[], [], [], []];
    for (let n = 2; n <= N; n++) {
      const kind = spiralKind(n, euler);
      if (!kind) continue;
      const r = Math.sqrt(n), a = 2 * Math.PI * r;
      groups[kind].push(vp.sx(r * Math.cos(a)), vp.sy(r * Math.sin(a)));
    }
    groups.forEach((pts, kind) => {
      if (!kind) return;
      ctx.fillStyle = ['', '#cbd5e1', '#f472b6', '#fbbf24'][kind];
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) ctx.rect(pts[i] - sz / 2, pts[i + 1] - sz / 2, sz, sz);
      ctx.fill();
    });
    if (st.hover && st.hover.tab === 'ulam') {
      const r = Math.sqrt(st.hover.n), a = 2 * Math.PI * r;
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(vp.sx(r * Math.cos(a)), vp.sy(r * Math.sin(a)), sz + 3, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------------ Gaussian primes
  const gaussImg = { canvas: document.createElement('canvas'), key: '' };
  function buildGaussImage() {
    const key = String(st.R);
    if (gaussImg.key === key) return;
    const R = st.R, S = 2 * R + 1;
    ensureSieve(2 * R * R + 2);
    const c = gaussImg.canvas;
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let row = 0; row < S; row++) {
      const b = R - row;
      for (let col = 0; col < S; col++) {
        const a = col - R;
        const q = 4 * (row * S + col);
        let rgb = a === 0 || b === 0 ? [22, 28, 40] : [11, 15, 23];
        if (gaussianPrime(a, b, prime)) {
          const t = Math.sqrt(a * a + b * b) / (R * Math.SQRT2);
          rgb = [120 + 120 * t, 200 - 90 * t, 255 - 20 * t];
        }
        img.data[q] = rgb[0]; img.data[q + 1] = rgb[1]; img.data[q + 2] = rgb[2]; img.data[q + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    gaussImg.key = key;
  }
  function drawGauss(ctx) {
    buildGaussImage();
    const R = st.R, S = 2 * R + 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(gaussImg.canvas, gvp.sx(-R - 0.5), gvp.sy(R + 0.5), S * gvp.scale, S * gvp.scale);
    if (gvp.scale >= 14) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const b = gvp.bounds;
      for (let x = Math.max(-R, Math.ceil(b.xmin)); x <= Math.min(R, b.xmax); x++) { ctx.moveTo(gvp.sx(x - 0.5), gvp.sy(R + 0.5)); ctx.lineTo(gvp.sx(x - 0.5), gvp.sy(-R - 0.5)); }
      for (let y = Math.max(-R, Math.ceil(b.ymin)); y <= Math.min(R, b.ymax); y++) { ctx.moveTo(gvp.sx(-R - 0.5), gvp.sy(y - 0.5)); ctx.lineTo(gvp.sx(R + 0.5), gvp.sy(y - 0.5)); }
      ctx.stroke();
    }
    ctx.fillStyle = C.text3;
    ctx.font = `12px ${MONO}`;
    ctx.fillText('Re', gvp.sx(R + 1), gvp.sy(0) + 4);
    ctx.fillText('Im', gvp.sx(0) - 7, gvp.sy(R + 1.2));
    if (st.hover && st.hover.tab === 'gauss') {
      const [a, b] = st.hover.cell;
      const r = Math.max(3, gvp.scale / 2);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gvp.sx(a) - r, gvp.sy(b) - r, 2 * r, 2 * r);
    }
  }
  function gaussExplain(a, b) {
    const z = `${a}${b < 0 ? ' − ' : ' + '}${Math.abs(b)}i`.replace(/^0 \+ /, '').replace(/^-/, '−');
    const n = a * a + b * b;
    if (n === 0) return [z, '0 不是素数'];
    if (n === 1) return [z, '单位（±1、±i）不算素数'];
    if (gaussianPrime(a, b, prime)) {
      if (a === 0 || b === 0) return [z, `素数：${Math.abs(a + b)} ≡ 3 (mod 4)，在高斯整数里仍不可分解`];
      return [z, `素数：范数 ${a}² + ${b}² = ${n} 是素数`];
    }
    const f = factor(n).map(([p, e]) => (e > 1 ? `${p}^${e}` : String(p))).join(' · ');
    return [z, `合数：范数 ${n} = ${f}`];
  }

  // ------------------------------------------------------------------ counting
  let countSieve = null; // up to 10^7
  const table = { rows: null };
  function ensureCount() {
    if (!countSieve) countSieve = sieve(1e7);
  }
  function buildTable() {
    if (table.rows) return;
    table.rows = [];
    for (let k = 1; k <= 25; k++) {
      const x = 10n ** BigInt(k);
      const p = PI_POW10[k];
      table.rows.push({ k, pi: p, li: roundFixed(liFixed(x, 40), 40) - p, r: roundFixed(riemannRFixed(x, 40), 40) - p });
    }
  }

  function plotFrame(ctx, r, xr, yr, { xlog = false, xlabel = '', ylabel = '', xticks = null, yticks = null } = {}) {
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    const X = (v) => r.x + ((xlog ? Math.log10(v) - Math.log10(xr[0]) : v - xr[0]) / (xlog ? Math.log10(xr[1]) - Math.log10(xr[0]) : xr[1] - xr[0])) * r.w;
    const Y = (v) => r.y + r.h - ((v - yr[0]) / (yr[1] - yr[0])) * r.h;
    ctx.font = `10.5px ${MONO}`;
    ctx.fillStyle = C.text3;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.beginPath();
    for (const t of xticks || []) { ctx.moveTo(X(t[0]), r.y); ctx.lineTo(X(t[0]), r.y + r.h); }
    for (const t of yticks || []) { ctx.moveTo(r.x, Y(t[0])); ctx.lineTo(r.x + r.w, Y(t[0])); }
    ctx.stroke();
    ctx.textAlign = 'center';
    for (const t of xticks || []) ctx.fillText(t[1], X(t[0]), r.y + r.h + 13);
    ctx.textAlign = 'right';
    for (const t of yticks || []) ctx.fillText(t[1], r.x - 5, Y(t[0]) + 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.text2;
    ctx.font = `12px ${FONT}`;
    if (ylabel) ctx.fillText(ylabel, r.x + 8, r.y + 16);
    if (xlabel) { ctx.textAlign = 'right'; ctx.fillText(xlabel, r.x + r.w - 6, r.y + r.h - 6); ctx.textAlign = 'left'; }
    return { X, Y };
  }
  const niceTicks = (lo, hi, n = 5) => {
    const span = hi - lo, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9 * step; v += step) out.push([v, fmt(Math.abs(v) >= 1e5 ? v : Math.round(v * 1e6) / 1e6, 3)]);
    return out;
  };
  /** Legend row ending at the right edge x. */
  function legend(ctx, xRight, y, items) {
    ctx.font = `12px ${FONT}`;
    const width = items.reduce((a, [label]) => a + 34 + ctx.measureText(label).width, 0);
    ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
    ctx.fillRect(xRight - width - 6, y - 10, width + 4, 20);
    let cx = xRight - width;
    for (const [label, col, dash] of items) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + 18, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.text2;
      ctx.fillText(label, cx + 23, y + 4);
      cx += 34 + ctx.measureText(label).width;
    }
  }

  function drawCount(ctx) {
    ensureCount();
    const Xmax = Math.round(10 ** st.logX);
    const pad = { l: 64, r: 22 };
    const top = { x: pad.l, y: 24, w: W - pad.l - pad.r, h: (H - 110) * 0.58 };
    const bot = { x: pad.l, y: top.y + top.h + 36, w: top.w, h: H - top.y - top.h - 36 - 30 };
    // samples of π(x), one per pixel column (or every integer when x is small)
    const n = Math.round(top.w * 2);
    const xs = [], ps = [];
    let count = 0, k = 1; // count = π(k)
    for (let i = 0; i <= n; i++) {
      const x = 2 + ((Xmax - 2) * i) / n;
      while (k + 1 <= x && k + 1 < countSieve.length) { k++; count += countSieve[k]; }
      xs.push(x);
      ps.push(count);
    }
    const piX = ps[ps.length - 1];
    const ymax = Math.max(li(Xmax), piX) * 1.05;
    const xt = niceTicks(0, Xmax, 6).map(([v]) => [v, v >= 1e4 ? `${fmt(v / 10 ** Math.floor(Math.log10(v)), 2)}e${Math.floor(Math.log10(v))}` : String(v)]);
    const f = plotFrame(ctx, top, [0, Xmax], [0, ymax], { xticks: xt, yticks: niceTicks(0, ymax, 4), ylabel: '素数个数' });
    const curve = (fn, col, dash, r = top, F = f) => {
      ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash(dash || []);
      ctx.beginPath();
      xs.forEach((x, i) => { const v = fn(x, i); const X = F.X(x), Y = F.Y(v); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke(); ctx.setLineDash([]);
    };
    ctx.save();
    ctx.beginPath(); ctx.rect(top.x, top.y, top.w, top.h); ctx.clip();
    curve((x) => x / Math.log(x), C.warn, [5, 4]);
    curve((x) => li(x) - li(2), C.cyan);
    curve((x) => riemannR(x), C.ok, [2, 3]);
    // π(x) as a staircase
    ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    xs.forEach((x, i) => { const X = f.X(x), Y = f.Y(ps[i]); if (i) { ctx.lineTo(X, f.Y(ps[i - 1])); ctx.lineTo(X, Y); } else ctx.moveTo(X, Y); });
    ctx.stroke();
    ctx.restore();
    legend(ctx, top.x + top.w - 4, top.y + 16, [['π(x)', '#f8fafc'], ['x / ln x', C.warn, [5, 4]], ['Li(x)', C.cyan], ['R(x)', C.ok, [2, 3]]]);
    // differences from π(x)
    const dPNT = xs.map((x, i) => x / Math.log(x) - ps[i]);
    const dLi = xs.map((x, i) => li(x) - li(2) - ps[i]);
    const dR = xs.map((x, i) => riemannR(x) - ps[i]);
    const m = Math.max(1, ...dLi.map(Math.abs), ...dR.map(Math.abs), ...dPNT.map(Math.abs).slice(Math.floor(xs.length * 0.1)));
    const g = plotFrame(ctx, bot, [0, Xmax], [-m * 1.05, m * 1.05], { xticks: xt, yticks: niceTicks(-m, m, 4), ylabel: '与 π(x) 的差', xlabel: 'x' });
    ctx.save();
    ctx.beginPath(); ctx.rect(bot.x, bot.y, bot.w, bot.h); ctx.clip();
    curve((x, i) => dPNT[i], C.warn, [5, 4], bot, g);
    curve((x, i) => dLi[i], C.cyan, null, bot, g);
    curve((x, i) => dR[i], C.ok, null, bot, g);
    ctx.strokeStyle = 'rgba(248,250,252,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bot.x, g.Y(0)); ctx.lineTo(bot.x + bot.w, g.Y(0)); ctx.stroke();
    ctx.restore();
    setInfo(`x = ${groupDigits(String(Xmax))}`, `π(x) = ${groupDigits(String(piX))}`, `平均间隔 ln x ≈ ${fmt(Math.log(Xmax), 2)}`);
    countRead.set('pi', groupDigits(String(piX)));
    countRead.set('pnt', `${fmt(Xmax / Math.log(Xmax), 6)}（差 ${fmt(Xmax / Math.log(Xmax) - piX, 4)}）`);
    countRead.set('li', `${fmt(li(Xmax) - li(2), 6)}（差 ${fmt(li(Xmax) - li(2) - piX, 4)}）`);
    countRead.set('r', `${fmt(riemannR(Xmax), 6)}（差 ${fmt(riemannR(Xmax) - piX, 4)}）`);
  }

  // ------------------------------------------------------------------ zeros
  let zeros = null, zSieve = null;
  const ensureZeros = () => { if (!zeros) { zeros = zetaZeros(300); zSieve = sieve(1000); } };
  // Z(t) on a fixed grid, filled in lazily (each value costs ~t/2 terms)
  const ZSTEP = 0.04, zGrid = new Float64Array(Math.ceil(600 / ZSTEP)).fill(NaN);
  const zAt = (t) => {
    const i = Math.round(t / ZSTEP);
    if (Number.isNaN(zGrid[i])) zGrid[i] = hardyZ(i * ZSTEP);
    return zGrid[i];
  };
  function drawZeros(ctx) {
    ensureZeros();
    const N = Math.round(st.N);
    const pad = { l: 56, r: 22 };
    const top = { x: pad.l, y: 24, w: W - pad.l - pad.r, h: (H - 110) * 0.36 };
    const bot = { x: pad.l, y: top.y + top.h + 36, w: top.w, h: H - top.y - top.h - 36 - 30 };
    // Z(t)
    const T = Math.max(60, (zeros[Math.max(0, N - 1)] || 0) + 8);
    const samples = Math.min(4000, Math.round(top.w * 2));
    const zs = [];
    let zmax = 1;
    for (let i = 0; i <= samples; i++) {
      const t = 1 + ((T - 1) * i) / samples;
      const z = t < 10 ? NaN : zAt(t);
      zs.push([t, z]);
      if (Number.isFinite(z)) zmax = Math.max(zmax, Math.abs(z));
    }
    zmax = Math.min(zmax, 8);
    const f = plotFrame(ctx, top, [0, T], [-zmax, zmax], { xticks: niceTicks(0, T, 8), yticks: niceTicks(-zmax, zmax, 2), ylabel: 'Z(t) = e^{iθ(t)} ζ(½ + it)', xlabel: 't' });
    ctx.save();
    ctx.beginPath(); ctx.rect(top.x, top.y, top.w, top.h); ctx.clip();
    ctx.strokeStyle = 'rgba(248,250,252,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(top.x, f.Y(0)); ctx.lineTo(top.x + top.w, f.Y(0)); ctx.stroke();
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5;
    ctx.beginPath();
    let pen = false;
    for (const [t, z] of zs) { if (!Number.isFinite(z)) { pen = false; continue; } const X = f.X(t), Y = f.Y(Math.max(-zmax, Math.min(zmax, z))); pen ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); pen = true; }
    ctx.stroke();
    for (let k = 0; k < zeros.length && zeros[k] <= T; k++) {
      ctx.fillStyle = k < N ? C.warn : 'rgba(148,163,184,0.5)';
      ctx.beginPath(); ctx.arc(f.X(zeros[k]), f.Y(0), k < N ? 3.2 : 2.2, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.restore();
    // ψ(x) and the explicit formula
    const X = st.X;
    const steps = Math.round(bot.w * 1.5);
    const exact = [], approx = [];
    let ymax = 0, err = 0;
    for (let i = 0; i <= steps; i++) {
      const x = 1.5 + ((X - 1.5) * i) / steps;
      const e = chebyshevPsi(x, zSieve), a = psiExplicit(x, zeros, N);
      exact.push([x, e]); approx.push([x, a]);
      ymax = Math.max(ymax, e, a);
      if (Math.abs(x - Math.round(x)) > 0.05) err = Math.max(err, Math.abs(a - e));
    }
    const g = plotFrame(ctx, bot, [0, X], [-2, ymax * 1.08], { xticks: niceTicks(0, X, 8), yticks: niceTicks(0, ymax, 4), ylabel: 'ψ(x) = Σ_{pᵏ ≤ x} ln p', xlabel: 'x' });
    ctx.save();
    ctx.beginPath(); ctx.rect(bot.x, bot.y, bot.w, bot.h); ctx.clip();
    ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    exact.forEach(([x, v], i) => { const px = g.X(x), py = g.Y(v); if (i) { ctx.lineTo(px, g.Y(exact[i - 1][1])); ctx.lineTo(px, py); } else ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.strokeStyle = C.warn; ctx.lineWidth = 1.6;
    ctx.beginPath();
    approx.forEach(([x, v], i) => { const px = g.X(x), py = g.Y(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.restore();
    legend(ctx, bot.x + bot.w - 4, bot.y + 16, [['ψ(x)（精确的台阶）', '#f8fafc'], [`用前 ${N} 对零点的显式公式`, C.warn]]);
    setInfo('黎曼显式公式', `${N} 对零点`, N ? `γ${N} = ${zeros[N - 1].toFixed(6)}` : '只剩主项 x');
    zeroRead.set('n', String(N));
    zeroRead.set('g', N ? zeros[N - 1].toFixed(9) : '—');
    zeroRead.set('err', fmt(err, 3));
  }

  // ------------------------------------------------------------------ drawing
  function setInfo(title, a, b) {
    info.textContent = '';
    info.append(h('div', { class: 'title' }, title), h('div', { class: 'big' }, a), h('div', { class: 'big', style: { color: C.text2 } }, b));
  }
  function draw() {
    if (W < 50 || H < 50) return;
    const { ctx } = layer;
    layer.reset();
    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, W, H);
    if (st.tab === 'ulam') { drawUlam(ctx); paintUlamInfo(); }
    else if (st.tab === 'gauss') { drawGauss(ctx); paintGaussInfo(); }
    else if (st.tab === 'count') drawCount(ctx);
    else drawZeros(ctx);
  }
  function paintUlamInfo() {
    const hv = st.hover && st.hover.tab === 'ulam' ? st.hover : null;
    if (!hv) { setInfo(st.spiral === 'sacks' ? '萨克斯螺旋' : '乌拉姆螺旋', `1 … ${groupDigits(String((2 * st.K + 1) ** 2 + st.start - 1))}`, '把鼠标移到格子上看因数分解'); return; }
    const n = hv.n;
    const f = n > 1 ? factor(n) : [];
    const desc = n < 2 ? '既不是素数也不是合数' : f.length === 1 && f[0][1] === 1 ? (prime(n - 2) || prime(n + 2) ? '素数（孪生素数）' : '素数') : f.map(([p, e]) => (e > 1 ? `${p}^${e}` : String(p))).join(' · ');
    setInfo(st.spiral === 'sacks' ? '萨克斯螺旋' : '乌拉姆螺旋', `n = ${groupDigits(String(n))}`, desc);
  }
  function paintGaussInfo() {
    const hv = st.hover && st.hover.tab === 'gauss' ? st.hover : null;
    if (!hv) { setInfo('高斯素数', `|a|, |b| ≤ ${st.R}`, '把鼠标移到格子上看是否为素数'); return; }
    const [z, why] = gaussExplain(...hv.cell);
    setInfo('高斯素数', z, why);
  }

  // ------------------------------------------------------------------ interaction
  const detachU = attachPointer(layer.canvas, vp, {
    onHover(px, py, wx, wy) {
      if (st.tab === 'ulam') {
        if (st.spiral === 'sacks') st.hover = { tab: 'ulam', n: sacksIndex(wx, wy) };
        else {
          const cell = spiralCellAt(wx, wy);
          if (Math.max(Math.abs(cell[0]), Math.abs(cell[1])) > st.K) st.hover = null;
          else st.hover = { tab: 'ulam', cell, n: st.start - 1 + ulamIndex(...cell) };
        }
      } else if (st.tab === 'gauss') {
        const a = Math.round(gvp.wx(px)), b = Math.round(gvp.wy(py));
        st.hover = Math.max(Math.abs(a), Math.abs(b)) <= st.R ? { tab: 'gauss', cell: [a, b] } : null;
      } else return;
      draw();
    },
    onView: () => draw(),
  });
  // the Gaussian plane has its own viewport: route pan/zoom by swapping which one is live
  const liveVp = () => (st.tab === 'gauss' ? gvp : vp);
  for (const key of ['zoomAt', 'panPx']) {
    const orig = vp[key].bind(vp);
    vp[key] = (...args) => (st.tab === 'gauss' ? gvp[key](...args) : st.tab === 'ulam' ? orig(...args) : undefined);
  }

  function fitView() {
    if (st.tab === 'ulam') {
      const r = st.spiral === 'sacks' ? 2 * st.K + 1.5 : st.K + 0.5;
      vp.fit(-r, r, -r, r, 0.02, { top: 0, bottom: 0, left: 0, right: 0 });
    } else if (st.tab === 'gauss') gvp.fit(-st.R - 0.5, st.R + 0.5, -st.R - 0.5, st.R + 0.5, 0.02);
  }

  // ------------------------------------------------------------------ panel
  const tabSeg = segmented({ id: 'primes-tab', options: Object.entries(TABS).map(([value, t]) => ({ value, label: t.label })), value: st.tab, onChange: (v) => setTab(v) });
  const note = h('div', { class: 'note', id: 'primes-note' });

  const spiralSeg = segmented({ id: 'primes-spiral', options: [{ value: 'ulam', label: '乌拉姆（方形）' }, { value: 'sacks', label: '萨克斯（阿基米德）' }], value: st.spiral, onChange: (v) => { st.spiral = v; st.hover = null; fitView(); draw(); } });
  const startChips = chips({
    id: 'primes-start',
    items: [{ id: '1', label: '从 1 开始' }, { id: '41', label: '从 41 开始' }],
    value: '1',
    onPick: (id) => { st.start = Number(id); if (st.start === 41) { st.euler = true; eulerToggle.set(true); } draw(); },
  });
  const kSlider = slider({ label: '螺旋大小', min: 10, max: 600, step: 10, value: st.K, id: 'primes-k', format: (v) => `${2 * v + 1}²`, onInput: (v) => { st.K = v; fitView(); draw(); } });
  const eulerToggle = toggle({ label: 'n² + n + 41', value: st.euler, swatch: '#fbbf24', id: 'primes-euler', onChange: (v) => { st.euler = v; draw(); } });
  const twinToggle = toggle({ label: '孪生素数', value: st.twins, swatch: '#f472b6', id: 'primes-twins', onChange: (v) => { st.twins = v; draw(); } });
  const ulamSec = section('螺旋', [spiralSeg.el, startChips.el, kSlider.el, h('div', { class: 'toggles two' }, eulerToggle.el, twinToggle.el),
    h('div', { class: 'hint' }, '欧拉的多项式 n² + n + 41 对 n = 0 … 39 全给出素数；从 41 开始绕螺旋，这 40 个素数恰好排成一条斜线。滚轮放大到能看清数字；按 F 复位。')]);

  const countRead = readout([['pi', 'π(x)'], ['pnt', 'x / ln x'], ['li', 'Li(x)'], ['r', 'R(x)']], { id: 'primes-count-readout' });
  const tableEl = h('div', { class: 'table-scroll' });
  const countSec = section('素数计数', [
    slider({ label: 'x 的范围', min: 1.5, max: 7, step: 0.1, value: st.logX, id: 'primes-x', format: (v) => `10^${v.toFixed(1)}`, onInput: (v) => { st.logX = v; draw(); } }).el,
    countRead.el,
    h('div', { class: 'hint' }, '图里 Li(x) 从 2 积起（偏移 Li(2) ≈ 1.045）。R(x) = Σ μ(n)/n · Li(x^{1/n})：用默比乌斯函数修正了素数幂被重复计数的部分。'),
  ]);
  const tableSec = section('x = 10ᵏ 的精确值', [tableEl, h('div', { class: 'hint' }, 'π(10ᵏ) 是数学家们用组合方法算出的精确值（k = 25 是 2013 年的结果）。Li 与 R 在这里用 BigInt 定点数算到小数点后 40 位，再取整相减。注意 R(x) 的误差时正时负——它在零点的振荡里。')]);

  const zeroRead = readout([['n', '使用的零点对数'], ['g', '最后一个 γ'], ['err', '最大误差（避开台阶处）']], { id: 'primes-zero-readout' });
  const nSlider = slider({ label: '零点对数 N', min: 0, max: 300, step: 1, value: st.N, id: 'primes-n', format: (v) => String(v), onInput: (v) => { st.N = v; draw(); } });
  const zPlay = button({ label: '从 0 播放到 300', iconName: 'play', small: true, id: 'primes-play', onClick: () => { st.N = 0; st.playing = true; } });
  const zeroSec = section('零点', [nSlider.el,
    slider({ label: 'x 的范围', min: 20, max: 500, step: 10, value: st.X, id: 'primes-zx', format: (v) => String(v), onInput: (v) => { st.X = v; draw(); } }).el,
    h('div', { class: 'btn-row' }, zPlay),
    zeroRead.el,
    h('div', { class: 'hint' }, '上图是哈代 Z 函数：它是实值的，绝对值等于 |ζ(½ + it)|，每次穿过 0 就是一个零点（欧拉–麦克劳林求和，约 12 位有效数字）。黄点是当前用到的零点。')]);

  const gaussSec = section('高斯整数', [
    slider({ label: '范围 |a|, |b| ≤', min: 10, max: 300, step: 5, value: st.R, id: 'primes-r', format: (v) => String(v), onInput: (v) => { st.R = v; fitView(); draw(); } }).el,
    h('div', { class: 'hint' }, '图案有 8 重对称：乘以单位 ±1、±i 和取共轭都不改变“是不是素数”。颜色越偏粉，范数越大。')]);

  const secs = { ulam: [ulamSec], count: [countSec, tableSec], zeros: [zeroSec], gauss: [gaussSec] };
  panel.append(section('主题', [tabSeg.el, note]), ulamSec, countSec, tableSec, zeroSec, gaussSec);

  function renderTable() {
    buildTable();
    const signed = (v) => (v < 0n ? '−' : v > 0n ? '+' : '') + groupDigits(String(v < 0n ? -v : v));
    const t = h('table', { class: 'feigen-table prime-table', id: 'primes-table' },
      h('thead', null, h('tr', null, h('th', null, 'k'), h('th', null, 'π(10ᵏ)，下一行：Li − π 与 R − π'))),
      h('tbody', null, table.rows.map((r) => h('tr', null,
        h('td', null, String(r.k)),
        h('td', { class: 'mono' },
          h('div', null, groupDigits(String(r.pi))),
          h('div', { class: 'diffs' }, h('span', { class: 'li' }, `Li ${signed(r.li)}`), h('span', { class: 'r' }, `R ${signed(r.r)}`)))))));
    tableEl.textContent = '';
    tableEl.append(t);
  }

  function setTab(t) {
    st.tab = t;
    st.hover = null;
    tabSeg.set(t);
    note.textContent = TABS[t].note;
    for (const [k, list] of Object.entries(secs)) for (const s of list) s.style.display = k === t ? '' : 'none';
    if (t === 'count' && !table.rows) renderTable();
    info.style.display = t === 'count' || t === 'zeros' ? 'none' : ''; // the charts carry their own labels
    layer.canvas.style.cursor = t === 'ulam' || t === 'gauss' ? 'crosshair' : 'default';
    setQuery({ v: t === 'ulam' ? null : t });
    fitView();
    draw();
  }

  const loop = animationLoop((dt) => {
    if (st.tab === 'zeros' && st.playing) {
      st.N = Math.min(300, st.N + dt * (4 + st.N * 0.6));
      nSlider.set(Math.round(st.N));
      if (st.N >= 300) st.playing = false;
      draw();
    }
  });

  const stopResize = observeSize(stage, (w, hh) => {
    const first = W < 50;
    W = w; H = hh;
    layer.resize(w, hh);
    vp.setSize(w, hh);
    gvp.setSize(w, hh);
    if (first) fitView();
    draw();
  });
  setTab(st.tab);
  loop.start();

  return {
    help: {
      tips: [
        '素数螺旋：滚轮放大能看到每个格子里的数字和螺旋的走向，鼠标悬停显示因数分解。',
        '素数有多少：拖动 x 的范围，看 x/ln x、Li(x)、R(x) 谁离 π(x) 最近；右栏表格一直列到 10²⁵。',
        '黎曼零点：点“从 0 播放到 300”，看 ζ 的零点怎样一个个把平滑曲线“掰”成素数的台阶。',
        '高斯素数：复平面上的素数，形状像一块对称的地毯。',
      ],
      keys: [['F', '视野复位']],
    },
    onKey(e) {
      if (e.key === 'f' || e.key === 'F') { fitView(); draw(); }
    },
    snapshot: () => layer.canvas,
    state: () => ({
      tab: st.tab, spiral: st.spiral, start: st.start, K: st.K, R: st.R, logX: st.logX, N: Math.round(st.N), X: st.X,
      hover: st.hover ? { ...st.hover } : null,
      info: info.textContent,
      zeros: zeros ? zeros.length : 0,
      table: table.rows ? table.rows.length : 0,
    }),
    cellToClient(x, y) { const v = liveVp(); const r = layer.canvas.getBoundingClientRect(); return [r.left + v.sx(x), r.top + v.sy(y)]; },
    destroy() { loop.stop(); detachU(); stopResize(); },
  };
}

export default {
  id: 'primes',
  title: '素数',
  short: '素数',
  subtitle: '乌拉姆螺旋、高斯素数、素数定理与 40 位精度的 Li(x)、R(x)，还有黎曼零点怎样重建素数的台阶',
  icon: 'primes',
  create,
};
