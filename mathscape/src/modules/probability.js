// Module 10 — probability: a Galton board (binomial → normal), Buffon's needle (estimating π),
// random walks (√n spreading) and sums of dice (the central limit theorem). Every experiment runs
// live and is drawn against the exact distribution.

import { h } from '../ui/dom.js';
import { Layer, observeSize, animationLoop } from '../ui/canvas.js';
import { section, slider, segmented, button, readout } from '../ui/controls.js';
import { fmt } from '../ui/format.js';
import { C, MONO, FONT, alpha } from '../ui/theme.js';
import { binomialPMF, normalPDF, diceSum, buffonDrop, buffonPi, walk, rng } from '../core/probability.js';

const TABS = {
  galton: { label: '高尔顿板', note: '每颗球在每一排钉子处各以概率 p 向右、1 − p 向左。落到第 k 格需要恰好 k 次向右，所以格子里的球数服从二项分布 B(n, p)；排数多了，它就接近正态分布——这是中心极限定理最早的样子（棣莫弗–拉普拉斯）。' },
  buffon: { label: '蒲丰投针', note: '把长 ℓ 的针随机扔到间距 d 的平行线上（ℓ ≤ d），压线的概率是 2ℓ/(πd)。于是数一数压线的针，就能估计 π ≈ 2ℓN/(d·压线数)。误差大约按 1/√N 缩小：想多得一位有效数字，要多扔 100 倍的针。' },
  walk: { label: '随机游走', note: '每一步等概率 +1 或 −1。n 步后的位置均值为 0，方差恰好为 n，所以典型距离只有 √n；大量路径的终点分布接近正态 N(0, n)。一维随机游走必定会回到原点（波利亚定理），但平均要等无穷久。' },
  dice: { label: '骰子之和', note: '一个骰子是均匀分布；几个骰子的点数之和，分布是均匀分布的卷积，迅速变成钟形。不论单个骰子是什么分布，独立相加后都趋向正态——中心极限定理。' },
};

function create({ stage, panel, toast, query, setQuery }) {
  const st = { tab: TABS[query.get('e')] ? query.get('e') : 'galton', playing: true };
  const random = Math.random;

  // ------------------------------------------------------------------ DOM
  const layer = new Layer(stage);
  const info = h('div', { class: 'overlay-card tl', id: 'prob-info' });
  stage.append(info);
  let W = 0, H = 0;

  // ------------------------------------------------------------------ Galton board
  const G = { n: 12, p: 0.5, rate: 30, balls: [], counts: [], total: 0, acc: 0, sum: 0, sum2: 0 };
  const resetGalton = () => { G.balls = []; G.counts = new Array(G.n + 1).fill(0); G.total = 0; G.sum = 0; G.sum2 = 0; };
  resetGalton();
  const landGalton = (k) => { G.counts[k]++; G.total++; G.sum += k; G.sum2 += k * k; };
  function dropMany(m) { for (let i = 0; i < m; i++) { let k = 0; for (let r = 0; r < G.n; r++) if (random() < G.p) k++; landGalton(k); } }
  function geomGalton() {
    const top = 56, binH = Math.max(110, H * 0.3), foot = 44; // foot: bin labels and legend
    const boardH = H - top - binH - 30 - foot;
    const vs = boardH / (G.n + 0.5);
    const hs = Math.min((W - 80) / (G.n + 1), vs * 1.25);
    return { top, vs, hs, cx: W / 2, binTop: top + boardH + 18, binH };
  }
  function stepGalton(dt) {
    if (st.playing) {
      G.acc += dt * G.rate;
      while (G.acc >= 1 && G.balls.length < 400) { G.acc -= 1; G.balls.push({ row: 0, k: 0, t: 0, dir: random() < G.p ? 1 : 0 }); }
    }
    const speed = 7;
    for (const b of G.balls) {
      b.t += dt * speed;
      while (b.t >= 1 && b.row < G.n) {
        b.t -= 1;
        b.k += b.dir;
        b.row++;
        b.dir = random() < G.p ? 1 : 0;
      }
    }
    const done = G.balls.filter((b) => b.row >= G.n);
    for (const b of done) landGalton(b.k);
    G.balls = G.balls.filter((b) => b.row < G.n);
  }
  function drawGalton(ctx) {
    const g = geomGalton();
    const pegX = (r, j) => g.cx + (j - r / 2) * g.hs;
    const pegY = (r) => g.top + r * g.vs;
    ctx.fillStyle = 'rgba(203, 213, 225, 0.55)';
    for (let r = 0; r < G.n; r++) for (let j = 0; j <= r; j++) { ctx.beginPath(); ctx.arc(pegX(r, j), pegY(r), 2.6, 0, 2 * Math.PI); ctx.fill(); }
    // balls: hop from peg (row, k) to (row + 1, k + dir)
    for (const b of G.balls) {
      const x0 = pegX(b.row, b.k), y0 = pegY(b.row) - 8;
      const x1 = b.row + 1 >= G.n ? g.cx + (b.k + b.dir - G.n / 2) * g.hs : pegX(b.row + 1, b.k + b.dir);
      const y1 = b.row + 1 >= G.n ? g.binTop - 6 : pegY(b.row + 1) - 8;
      const x = x0 + (x1 - x0) * b.t, y = y0 + (y1 - y0) * b.t - Math.sin(Math.PI * b.t) * g.vs * 0.35;
      ctx.fillStyle = C.v;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill();
    }
    // bins with the exact binomial and its normal approximation
    const pmf = binomialPMF(G.n, G.p);
    const maxE = Math.max(...pmf) * Math.max(1, G.total);
    const maxC = Math.max(1, ...G.counts, maxE);
    const bw = g.hs * 0.86;
    const base = g.binTop + g.binH;
    for (let k = 0; k <= G.n; k++) {
      const x = g.cx + (k - G.n / 2) * g.hs;
      const bh = (G.counts[k] / maxC) * g.binH;
      ctx.fillStyle = alpha(C.accent, 0.75);
      ctx.fillRect(x - bw / 2, base - bh, bw, bh);
      if (G.total) {
        const ey = base - ((pmf[k] * G.total) / maxC) * g.binH;
        ctx.fillStyle = C.v;
        ctx.beginPath(); ctx.arc(x, ey, 3.2, 0, 2 * Math.PI); ctx.fill();
      }
      if (G.n <= 16) { ctx.fillStyle = C.text3; ctx.font = `10px ${MONO}`; ctx.textAlign = 'center'; ctx.fillText(String(k), x, base + 13); }
    }
    if (G.total) {
      const mu = G.n * G.p, sd = Math.sqrt(G.n * G.p * (1 - G.p));
      ctx.strokeStyle = alpha(C.j, 0.9);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const k = -0.5 + ((G.n + 1) * i) / 200;
        const x = g.cx + (k - G.n / 2) * g.hs, y = base - ((normalPDF(k, mu, sd) * G.total) / maxC) * g.binH;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    legend(ctx, [[C.accent, '实验次数'], [C.v, '二项分布 B(n, p)'], [C.j, '正态近似']], base + 28);
    const m = G.total ? G.sum / G.total : 0, v = G.total > 1 ? (G.sum2 - G.total * m * m) / (G.total - 1) : 0;
    galRead.set('N', String(G.total));
    galRead.set('mean', `${fmt(m, 3)}（理论 ${fmt(G.n * G.p, 3)}）`);
    galRead.set('var', `${fmt(v, 3)}（理论 ${fmt(G.n * G.p * (1 - G.p), 3)}）`);
    setInfo('高尔顿板', `${G.n} 排 · p = ${fmt(G.p, 2)}`, `${G.total} 颗球`);
  }

  // ------------------------------------------------------------------ Buffon's needle
  const BF = { ratio: 0.8, rate: 60, needles: [], N: 0, crossings: 0, history: [], acc: 0 };
  const resetBuffon = () => { BF.needles = []; BF.N = 0; BF.crossings = 0; BF.history = []; };
  const spacing = () => Math.max(50, Math.min(90, H * 0.12));
  function throwNeedles(m, keep = true) {
    const d = spacing(), l = BF.ratio * d;
    const floorH = H * 0.6;
    for (let i = 0; i < m; i++) {
      const r = buffonDrop(BF.ratio, 1, random);
      BF.N++;
      if (r.cross) BF.crossings++;
      if (keep) {
        const lane = Math.floor(random() * Math.max(1, Math.floor((floorH - 40) / d)));
        BF.needles.push({ x: 30 + random() * (W - 60), y: 40 + (lane + r.y) * d, theta: r.theta, cross: r.cross, l });
      }
      const step = BF.N < 200 ? 1 : Math.ceil(BF.N / 400);
      if (BF.N % step === 0) BF.history.push([BF.N, buffonPi(BF.ratio, 1, BF.N, BF.crossings)]);
    }
    if (BF.needles.length > 500) BF.needles.splice(0, BF.needles.length - 500);
  }
  function drawBuffon(ctx) {
    const d = spacing();
    const floorH = H * 0.6;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 40; y <= floorH; y += d) { ctx.moveTo(20, y); ctx.lineTo(W - 20, y); }
    ctx.stroke();
    ctx.lineCap = 'round';
    BF.needles.forEach((n, i) => {
      const age = (BF.needles.length - i) / BF.needles.length;
      const dx = (n.l / 2) * Math.cos(n.theta), dy = (n.l / 2) * Math.sin(n.theta);
      ctx.strokeStyle = n.cross ? alpha(C.v, 0.95 - 0.6 * age) : alpha(C.accent, 0.7 - 0.5 * age);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(n.x - dx, n.y - dy); ctx.lineTo(n.x + dx, n.y + dy); ctx.stroke();
    });
    // the estimate of π against the number of needles (log scale)
    const top = floorH + 30, bottom = H - 34, left = 54, right = W - 20;
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(left, top, right - left, bottom - top);
    const lo = 2.6, hi = 3.7;
    const Y = (v) => bottom - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (bottom - top);
    const maxN = Math.max(10, BF.N);
    const X = (n) => left + (Math.log10(n) / Math.log10(maxN)) * (right - left);
    ctx.strokeStyle = alpha(C.ok, 0.8);
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(left, Y(Math.PI)); ctx.lineTo(right, Y(Math.PI)); ctx.stroke();
    ctx.setLineDash([]);
    // ±1σ band of the estimator
    const P = (2 * BF.ratio) / Math.PI;
    ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const n = 10 ** ((i / 60) * Math.log10(maxN)); const s = Math.PI * Math.sqrt((1 - P) / (P * n)); i ? ctx.lineTo(X(n), Y(Math.PI + s)) : ctx.moveTo(X(n), Y(Math.PI + s)); }
    for (let i = 60; i >= 0; i--) { const n = 10 ** ((i / 60) * Math.log10(maxN)); const s = Math.PI * Math.sqrt((1 - P) / (P * n)); ctx.lineTo(X(n), Y(Math.PI - s)); }
    ctx.fill();
    ctx.strokeStyle = C.v;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    BF.history.forEach(([n, v], i) => { if (!Number.isFinite(v)) return; i ? ctx.lineTo(X(n), Y(v)) : ctx.moveTo(X(n), Y(v)); });
    ctx.stroke();
    ctx.fillStyle = C.text3;
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = 'right';
    for (const v of [2.8, 3, 3.2, 3.4, 3.6]) ctx.fillText(v.toFixed(1), left - 6, Y(v) + 3);
    ctx.textAlign = 'center';
    for (let e = 0; 10 ** e <= maxN; e++) ctx.fillText(`10${'⁰¹²³⁴⁵⁶⁷⁸'[e]}`, X(10 ** e), bottom + 14);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ok;
    ctx.fillText('π', right - 14, Y(Math.PI) - 5);
    const est = buffonPi(BF.ratio, 1, BF.N, BF.crossings);
    bufRead.set('N', String(BF.N));
    bufRead.set('cross', `${BF.crossings}（${fmt(BF.N ? (100 * BF.crossings) / BF.N : 0, 2)}%）`);
    bufRead.set('pi', Number.isFinite(est) ? fmt(est, 6) : '—');
    bufRead.set('err', Number.isFinite(est) ? fmt(Math.abs(est - Math.PI), 4) : '—', Number.isFinite(est) && Math.abs(est - Math.PI) < 0.01 ? 'good' : '');
    setInfo('蒲丰投针', `ℓ/d = ${fmt(BF.ratio, 2)} · 黄色 = 压线`, Number.isFinite(est) ? `π ≈ ${fmt(est, 5)}` : '开始投针…');
  }

  // ------------------------------------------------------------------ random walks
  const RW = { N: 400, M: 80, paths: [], n: 0, speed: 120 };
  function newWalks() { const r = rng((Math.random() * 1e9) | 0); RW.paths = Array.from({ length: RW.M }, () => walk(RW.N, r)); RW.n = 0; }
  newWalks();
  function drawWalk(ctx) {
    const left = 46, right = W - 190, top = 60, bottom = H - 40;
    const mid = (top + bottom) / 2;
    const sy = (bottom - top) / 2 / (3 * Math.sqrt(RW.N));
    const X = (k) => left + (k / RW.N) * (right - left);
    const Y = (v) => mid - v * sy;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.beginPath(); ctx.moveTo(left, mid); ctx.lineTo(right, mid); ctx.stroke();
    // envelopes ±√n, ±2√n
    for (const [m, a] of [[1, 0.8], [2, 0.45]]) {
      ctx.strokeStyle = alpha(C.ok, a);
      ctx.setLineDash([5, 5]);
      for (const sgn of [1, -1]) {
        ctx.beginPath();
        for (let k = 0; k <= RW.N; k += 2) { const y = Y(sgn * m * Math.sqrt(k)); k ? ctx.lineTo(X(k), y) : ctx.moveTo(X(k), y); }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    const n = Math.floor(RW.n);
    RW.paths.forEach((p, i) => {
      ctx.strokeStyle = i === 0 ? C.v : `hsla(${200 + (i * 47) % 120}, 80%, 66%, 0.28)`;
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) k ? ctx.lineTo(X(k), Y(p[k])) : ctx.moveTo(X(k), Y(p[k]));
      ctx.stroke();
    });
    // histogram of current positions vs N(0, n)
    const hx = right + 20, hw = W - hx - 16;
    const bins = new Map();
    let s2 = 0, s1 = 0, zero = 0;
    for (const p of RW.paths) { const v = p[n]; bins.set(v, (bins.get(v) || 0) + 1); s2 += v * v; s1 += v; if (v === 0) zero++; }
    // frequencies and P(Sₙ = v) ≈ 2φ(v; 0, √n) (positions share the parity of n) on one scale
    const maxCount = Math.max(...bins.values());
    const K = (0.8 * hw) / Math.max(maxCount / RW.M, n > 0 ? 2 * normalPDF(0, 0, Math.sqrt(n)) : 0);
    for (const [v, c] of bins) {
      ctx.fillStyle = alpha(C.accent, 0.7);
      ctx.fillRect(hx, Y(v) - Math.max(1.5, sy), (c / RW.M) * K, Math.max(2, 2 * sy - 1));
    }
    if (n > 0) {
      ctx.strokeStyle = C.j;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const v = -3 * Math.sqrt(RW.N) + (6 * Math.sqrt(RW.N) * i) / 100;
        const x = hx + 2 * normalPDF(v, 0, Math.sqrt(n)) * K;
        i ? ctx.lineTo(x, Y(v)) : ctx.moveTo(x, Y(v));
      }
      ctx.stroke();
    }
    ctx.fillStyle = C.text3;
    ctx.font = `10.5px ${FONT}`;
    ctx.fillText('步数 n →', right - 50, bottom + 16);
    ctx.fillText('终点分布', hx, top - 8);
    ctx.fillStyle = alpha(C.ok, 0.9);
    ctx.fillText('±√n', X(RW.N) - 30, Y(Math.sqrt(RW.N)) - 6);
    walkRead.set('n', String(n));
    walkRead.set('mean', fmt(s1 / RW.M, 3));
    walkRead.set('sq', `${fmt(s2 / RW.M, 1)}（理论 ${n}）`);
    walkRead.set('zero', `${zero} / ${RW.M}`);
    setInfo('随机游走', `${RW.M} 条路径 · 每条 ${RW.N} 步`, `n = ${n}`);
  }

  // ------------------------------------------------------------------ dice
  const DI = { k: 2, rate: 40, counts: new Map(), total: 0, last: [], acc: 0 };
  const resetDice = () => { DI.counts = new Map(); DI.total = 0; DI.last = []; };
  function roll(m) {
    for (let i = 0; i < m; i++) {
      let s = 0;
      const faces = [];
      for (let d = 0; d < DI.k; d++) { const f = 1 + Math.floor(random() * 6); faces.push(f); s += f; }
      DI.counts.set(s, (DI.counts.get(s) || 0) + 1);
      DI.total++;
      DI.last = faces;
    }
  }
  function drawDice(ctx) {
    // the latest roll
    const size = Math.min(46, (W - 80) / Math.max(DI.k, 1) - 10);
    const x0 = W / 2 - (DI.last.length * (size + 10)) / 2 + 5;
    DI.last.forEach((f, i) => die(ctx, x0 + i * (size + 10), 64, size, f));
    const exact = diceSum(DI.k);
    const lo = DI.k, hi = 6 * DI.k;
    const left = 50, right = W - 30, top = 64 + size + 40, bottom = H - 70;
    const bw = (right - left) / (hi - lo + 1);
    const maxP = Math.max(...exact.slice(lo));
    const maxV = Math.max(maxP, ...[...DI.counts.values()].map((c) => c / Math.max(1, DI.total)));
    const Y = (p) => bottom - (p / maxV) * (bottom - top);
    for (let s = lo; s <= hi; s++) {
      const x = left + (s - lo) * bw;
      const c = DI.counts.get(s) || 0;
      ctx.fillStyle = alpha(C.accent, 0.75);
      const y = Y(DI.total ? c / DI.total : 0);
      ctx.fillRect(x + bw * 0.08, y, bw * 0.84, bottom - y);
      ctx.fillStyle = C.v;
      ctx.beginPath(); ctx.arc(x + bw / 2, Y(exact[s]), Math.min(4, bw * 0.25), 0, 2 * Math.PI); ctx.fill();
      if (bw > 14 || s % 5 === 0) { ctx.fillStyle = C.text3; ctx.font = `10px ${MONO}`; ctx.textAlign = 'center'; ctx.fillText(String(s), x + bw / 2, bottom + 13); }
    }
    const mu = 3.5 * DI.k, sd = Math.sqrt((35 / 12) * DI.k);
    ctx.strokeStyle = C.j;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const s = lo - 0.5 + ((hi - lo + 1) * i) / 200;
      const x = left + (s - lo + 0.5) * bw;
      const y = Y(normalPDF(s, mu, sd));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    legend(ctx, [[C.accent, '实验频率'], [C.v, '精确分布'], [C.j, '正态 N(3.5k, 35k/12)']], bottom + 34);
    let sum = 0, tv = 0;
    for (const [s, c] of DI.counts) sum += s * c;
    for (let s = lo; s <= hi; s++) tv += Math.abs((DI.counts.get(s) || 0) / Math.max(1, DI.total) - exact[s]);
    diceRead.set('N', String(DI.total));
    diceRead.set('mean', `${fmt(DI.total ? sum / DI.total : 0, 3)}（理论 ${fmt(mu, 2)}）`);
    diceRead.set('tv', DI.total ? fmt(tv / 2, 4) : '—');
    setInfo('骰子之和', `${DI.k} 个骰子`, `${DI.total} 次`);
  }
  function die(ctx, x, y, s, f) {
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, s, s, s * 0.18) : ctx.rect(x, y, s, s);
    ctx.fill();
    const pip = (u, v) => { ctx.beginPath(); ctx.arc(x + u * s, y + v * s, s * 0.09, 0, 2 * Math.PI); ctx.fill(); };
    ctx.fillStyle = '#0a1020';
    const P = { 1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]], 4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]], 5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]], 6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]] };
    for (const [u, v] of P[f]) pip(u, v);
  }

  // ------------------------------------------------------------------ shared drawing
  function legend(ctx, items, y) {
    ctx.font = `11px ${FONT}`;
    let x = 56;
    for (const [col, text] of items) {
      ctx.fillStyle = col;
      ctx.fillRect(x, y - 8, 10, 10);
      ctx.fillStyle = C.text2;
      ctx.textAlign = 'left';
      ctx.fillText(text, x + 15, y + 1);
      x += ctx.measureText(text).width + 40;
    }
  }
  function setInfo(title, a, b) {
    info.textContent = '';
    info.append(h('div', { class: 'title' }, title), h('div', { class: 'big' }, a), h('div', { class: 'big', style: { color: C.text2 } }, b));
  }
  function draw() {
    if (W < 50 || H < 50) return; // not laid out yet
    const { ctx } = layer;
    layer.reset();
    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, W, H);
    if (st.tab === 'galton') drawGalton(ctx);
    else if (st.tab === 'buffon') drawBuffon(ctx);
    else if (st.tab === 'walk') drawWalk(ctx);
    else drawDice(ctx);
  }

  const loop = animationLoop((dt) => {
    if (st.tab === 'galton') stepGalton(dt);
    else if (st.playing && st.tab === 'buffon') { BF.acc += dt * BF.rate; const m = Math.floor(BF.acc); BF.acc -= m; throwNeedles(m); }
    else if (st.playing && st.tab === 'walk') RW.n = Math.min(RW.N, RW.n + dt * RW.speed);
    else if (st.playing && st.tab === 'dice') { DI.acc += dt * DI.rate; const m = Math.floor(DI.acc); DI.acc -= m; roll(m); }
    draw();
  });

  // ------------------------------------------------------------------ panel
  const tabSeg = segmented({ id: 'prob-tab', options: Object.entries(TABS).map(([value, t]) => ({ value, label: t.label })), value: st.tab, onChange: (v) => setTab(v) });
  const note = h('div', { class: 'note', id: 'prob-note' });
  const playBtn = button({ label: '暂停', iconName: 'pause', small: true, id: 'prob-play', onClick: () => { st.playing = !st.playing; playBtn.querySelector('span').textContent = st.playing ? '暂停' : '继续'; } });

  const galRead = readout([['N', '球数'], ['mean', '平均格号'], ['var', '方差']], { id: 'galton-readout' });
  const galSec = section('高尔顿板', [
    slider({ label: '钉子排数 n', min: 2, max: 24, step: 1, value: G.n, id: 'galton-n', format: (v) => String(v), onInput: (v) => { G.n = v; resetGalton(); } }).el,
    slider({ label: '向右的概率 p', min: 0.05, max: 0.95, step: 0.01, value: G.p, id: 'galton-p', format: (v) => fmt(v, 2), onInput: (v) => { G.p = v; resetGalton(); } }).el,
    slider({ label: '每秒落球', min: 1, max: 120, step: 1, value: G.rate, format: (v) => String(v), onInput: (v) => { G.rate = v; } }).el,
    h('div', { class: 'btn-row' }, button({ label: '一次落 1000 颗', small: true, id: 'galton-1000', onClick: () => dropMany(1000) }), button({ label: '清空', small: true, onClick: resetGalton })),
    galRead.el]);

  const bufRead = readout([['N', '针数 N'], ['cross', '压线'], ['pi', 'π 的估计'], ['err', '与 π 的误差']], { id: 'buffon-readout' });
  const bufSec = section('蒲丰投针', [
    slider({ label: '针长 ℓ / 线距 d', min: 0.2, max: 1, step: 0.05, value: BF.ratio, id: 'buffon-ratio', format: (v) => fmt(v, 2), onInput: (v) => { BF.ratio = v; resetBuffon(); } }).el,
    slider({ label: '每秒投针', min: 1, max: 600, step: 1, value: BF.rate, format: (v) => String(v), onInput: (v) => { BF.rate = v; } }).el,
    h('div', { class: 'btn-row' }, button({ label: '一次投 10 万根', small: true, id: 'buffon-many', onClick: () => throwNeedles(100000, false) }), button({ label: '清空', small: true, onClick: resetBuffon })),
    bufRead.el]);

  const walkRead = readout([['n', '当前步数 n'], ['mean', 'Sₙ 的平均'], ['sq', 'Sₙ² 的平均'], ['zero', '此刻在原点']], { id: 'walk-readout' });
  const walkSec = section('随机游走', [
    slider({ label: '步数 N', min: 50, max: 4000, step: 50, value: RW.N, format: (v) => String(v), onInput: (v) => { RW.N = v; newWalks(); } }).el,
    slider({ label: '路径数', min: 5, max: 400, step: 5, value: RW.M, id: 'walk-m', format: (v) => String(v), onInput: (v) => { RW.M = v; newWalks(); } }).el,
    h('div', { class: 'btn-row' }, button({ label: '重新生成', iconName: 'shuffle', small: true, id: 'walk-new', onClick: newWalks }), button({ label: '直接到终点', small: true, id: 'walk-end', onClick: () => { RW.n = RW.N; } })),
    walkRead.el]);

  const diceRead = readout([['N', '次数'], ['mean', '平均点数和'], ['tv', '与精确分布的距离']], { id: 'dice-readout' });
  const diceSec = section('骰子之和', [
    slider({ label: '骰子个数 k', min: 1, max: 12, step: 1, value: DI.k, id: 'dice-k', format: (v) => String(v), onInput: (v) => { DI.k = v; resetDice(); } }).el,
    slider({ label: '每秒投掷', min: 1, max: 300, step: 1, value: DI.rate, format: (v) => String(v), onInput: (v) => { DI.rate = v; } }).el,
    h('div', { class: 'btn-row' }, button({ label: '一次投 1 万次', small: true, id: 'dice-many', onClick: () => roll(10000) }), button({ label: '清空', small: true, onClick: resetDice })),
    diceRead.el]);

  const secs = { galton: galSec, buffon: bufSec, walk: walkSec, dice: diceSec };
  panel.append(section('实验', [tabSeg.el, h('div', { class: 'btn-row' }, playBtn), note]), galSec, bufSec, walkSec, diceSec);

  function setTab(t) {
    st.tab = t;
    tabSeg.set(t);
    note.textContent = TABS[t].note;
    for (const [k, s] of Object.entries(secs)) s.style.display = k === t ? '' : 'none';
    setQuery({ e: t === 'galton' ? null : t });
    draw();
  }

  const stopResize = observeSize(stage, (w, hh) => { W = w; H = hh; layer.resize(w, hh); draw(); });
  setTab(st.tab);
  loop.start();

  return {
    help: {
      tips: [
        '四个实验都在实时随机抽样，并和精确分布对比：黄点是理论值，粉线是正态近似。',
        '“一次落 1000 颗 / 投 10 万根 / 投 1 万次”可以瞬间积累大量样本，看大数定律如何把频率拉向概率。',
      ],
      keys: [['Space', '暂停 / 继续']],
    },
    onKey(e) { if (e.key === ' ') { playBtn.click(); e.preventDefault(); } },
    snapshot: () => layer.canvas,
    state: () => ({
      tab: st.tab,
      galton: { n: G.n, p: G.p, total: G.total, mean: G.total ? G.sum / G.total : 0 },
      buffon: { N: BF.N, crossings: BF.crossings, pi: buffonPi(BF.ratio, 1, BF.N, BF.crossings) },
      walk: { n: RW.n, N: RW.N, M: RW.M, meanSq: RW.paths.reduce((a, p) => a + p[Math.floor(RW.n)] ** 2, 0) / RW.M },
      dice: { k: DI.k, total: DI.total, mean: DI.total ? [...DI.counts].reduce((a, [s, c]) => a + s * c, 0) / DI.total : 0 },
    }),
    destroy() { loop.stop(); stopResize(); },
  };
}

export default {
  id: 'probability',
  title: '概率实验室',
  short: '概率',
  subtitle: '高尔顿板、蒲丰投针、随机游走与骰子：让随机性自己画出二项分布、π 与正态曲线',
  icon: 'probability',
  create,
};
