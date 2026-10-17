// Probability and statistics: Galton board, CLT, LLN, random walks, hypothesis tests, regression.
import { stage, slider, select, button, checkbox, plot, COLORS, TAU, FONT, gauss } from './kit.js';

const rand = Math.random;
export function erf(x) {
  // Abramowitz–Stegun 7.1.26, |error| < 1.5e-7
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
export const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
export function invPhi(p) {
  let lo = -9, hi = 9;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const npdf = (z, mu = 0, s = 1) => Math.exp(-((z - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(TAU));
function binom(n, k, p) {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c * p ** k * (1 - p) ** (n - k);
}

// ---- Galton board
export const galton = {
  id: 'galton',
  title: '高尔顿板与二项分布',
  mount(host) {
    const S = stage(host, { height: 330 });
    let n = 10, p = 0.5, speed = 1, balls = [], bins = new Array(n + 1).fill(0), total = 0, spawn = 0;
    const reset = () => { balls = []; bins = new Array(n + 1).fill(0); total = 0; };
    slider(S, { label: '层数 $n$', min: 3, max: 16, step: 1, value: n, oninput: (v) => { n = v; reset(); } });
    slider(S, { label: '向右概率 $p$', min: 0.1, max: 0.9, step: 0.05, value: p, fmt: (v) => v.toFixed(2), oninput: (v) => { p = v; reset(); } });
    slider(S, { label: '速度', min: 1, max: 8, step: 1, value: speed, oninput: (v) => { speed = v; } });
    button(S, '+1000 个', () => { for (let i = 0; i < 1000; i++) { let k = 0; for (let j = 0; j < n; j++) if (rand() < p) k++; bins[k]++; total++; } });
    button(S, '清空', reset);
    S.loop((dt) => {
      const { ctx, w, h } = S;
      spawn += dt * 0.012 * speed;
      while (spawn > 1) { spawn--; if (balls.length < 400) { const path = []; for (let j = 0; j < n; j++) path.push(rand() < p ? 1 : 0); balls.push({ path, s: 0 }); } }
      const top = 22, pegH = h * 0.5, binTop = top + pegH + 12, binH = h - binTop - 8;
      const dx = Math.min(30, (w - 40) / (n + 1)), cx = w / 2, dy = pegH / n;
      S.clear();
      // pegs
      ctx.fillStyle = 'rgba(200,214,255,0.6)';
      for (let r = 0; r < n; r++) for (let j = 0; j <= r; j++) { ctx.beginPath(); ctx.arc(cx + (j - r / 2) * dx, top + r * dy + dy * 0.5, 2.4, 0, TAU); ctx.fill(); }
      // balls
      const v = 0.004 * speed;
      ctx.fillStyle = COLORS.b;
      balls = balls.filter((b) => {
        b.s += dt * v;
        if (b.s >= n) { bins[b.path.reduce((a, c) => a + c, 0)]++; total++; return false; }
        const r = Math.floor(b.s), f = b.s - r;
        let k = 0; for (let j = 0; j < r; j++) k += b.path[j];
        const x0 = cx + (k - r / 2) * dx, x1 = cx + (k + b.path[r] - (r + 1) / 2) * dx;
        const x = x0 + (x1 - x0) * f, y = top + r * dy + dy * 0.5 * f + dy * 0.5 * f * f - Math.sin(f * Math.PI) * dy * 0.25;
        ctx.beginPath(); ctx.arc(x, y - 4, 3, 0, TAU); ctx.fill();
        return true;
      });
      // bins and theory
      const probs = []; for (let k = 0; k <= n; k++) probs.push(binom(n, k, p));
      const maxP = Math.max(...probs), maxB = Math.max(1, ...bins);
      const scale = binH / Math.max(maxP * 1.1, total ? maxB / total : 0);
      for (let k = 0; k <= n; k++) {
        const x = cx + (k - n / 2) * dx;
        ctx.strokeStyle = 'rgba(200,214,255,0.12)'; ctx.beginPath(); ctx.moveTo(x - dx / 2, binTop); ctx.lineTo(x - dx / 2, h - 8); ctx.stroke();
        if (total) { const bh = (bins[k] / total) * scale; ctx.fillStyle = 'rgba(255,209,102,0.75)'; ctx.fillRect(x - dx * 0.4, h - 8 - bh, dx * 0.8, bh); }
        ctx.fillStyle = COLORS.a; ctx.beginPath(); ctx.arc(x, h - 8 - probs[k] * scale, 3, 0, TAU); ctx.fill();
      }
      const mu = n * p, sd = Math.sqrt(n * p * (1 - p));
      ctx.strokeStyle = COLORS.d; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const k = -0.5 + ((n + 1) * i) / 200; const x = cx + (k - n / 2) * dx, y = h - 8 - npdf(k, mu, sd) * scale; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      let mean = 0, m2 = 0; for (let k = 0; k <= n; k++) { mean += k * bins[k]; m2 += k * k * bins[k]; }
      mean = total ? mean / total : 0; const varr = total ? m2 / total - mean * mean : 0;
      ctx.fillStyle = COLORS.muted; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`已落下 ${total} 个`, 10, 6);
      S.setReadout(`每颗球碰到一颗钉子就以概率 $p$ 向右，落入第 $k$ 格的概率是 $\\binom{${n}}{k}p^k(1-p)^{${n}-k}$（蓝点）。金色是实际频率：均值 $${mean.toFixed(2)}$（理论 $np=${mu.toFixed(2)}$），方差 $${varr.toFixed(2)}$（理论 $np(1-p)=${(sd * sd).toFixed(2)}$）。绿线是正态近似 $N(np,\\,np(1-p))$——棣莫弗–拉普拉斯定理。`);
    });
    return { destroy: S.destroy };
  },
};

// ---- central limit theorem
const BASES = {
  unif: { name: '均匀 U(0,1)', draw: () => rand(), mu: 0.5, sd: Math.sqrt(1 / 12), pdf: (x) => (x >= 0 && x <= 1 ? 1 : 0), range: [-0.25, 1.25] },
  exp: { name: '指数 Exp(1)', draw: () => -Math.log(1 - rand()), mu: 1, sd: 1, pdf: (x) => (x >= 0 ? Math.exp(-x) : 0), range: [-0.3, 4] },
  bern: { name: '伯努利 B(1, 0.2)', draw: () => (rand() < 0.2 ? 1 : 0), mu: 0.2, sd: 0.4, atoms: [[0, 0.8], [1, 0.2]], range: [-0.4, 1.4], step: 1 },
  dice: { name: '骰子', draw: () => 1 + Math.floor(rand() * 6), mu: 3.5, sd: Math.sqrt(35 / 12), atoms: [1, 2, 3, 4, 5, 6].map((k) => [k, 1 / 6]), range: [0.3, 6.7], step: 1 },
  u2: { name: 'U 形 Beta(½,½)', draw: () => Math.sin((rand() * Math.PI) / 2) ** 2, mu: 0.5, sd: Math.sqrt(1 / 8), pdf: (x) => (x > 0.003 && x < 0.997 ? 1 / (Math.PI * Math.sqrt(x * (1 - x))) : NaN), range: [-0.2, 1.2] },
};

export const clt = {
  id: 'clt',
  title: '中心极限定理',
  mount(host) {
    const S = stage(host, { height: 300 });
    let key = 'exp', n = 1, samples = [], target = 20000;
    const reset = () => { samples = []; };
    select(S, { label: '总体分布', value: key, options: Object.entries(BASES).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; reset(); } });
    slider(S, { label: '样本量 $n$', min: 1, max: 60, step: 1, value: n, oninput: (v) => { n = v; reset(); } });
    button(S, '重新抽样', reset);
    const P = plot(S, { x0: -4, x1: 4, y0: 0, y1: 0.62, pad: 24 });
    S.loop(() => {
      const B = BASES[key];
      if (samples.length < target) {
        for (let i = 0; i < 400; i++) { let s = 0; for (let j = 0; j < n; j++) s += B.draw(); samples.push(s); }
        S.dirty = true;
      }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx, w, h } = S;
      S.clear();
      // inset: the population
      const iw = Math.min(170, w * 0.3), ih = 74, ix = 12, iy = 12;
      ctx.strokeStyle = 'rgba(200,214,255,0.15)'; ctx.strokeRect(ix, iy, iw, ih);
      ctx.fillStyle = COLORS.muted; ctx.font = `10px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('总体', ix + 4, iy + 3);
      const [r0, r1] = B.range, IX = (x) => ix + ((x - r0) / (r1 - r0)) * iw;
      if (B.atoms) { const m = Math.max(...B.atoms.map((a) => a[1])); for (const [x, q] of B.atoms) { ctx.fillStyle = COLORS.e; ctx.fillRect(IX(x) - 3, iy + ih - 4 - (q / m) * (ih - 20), 6, (q / m) * (ih - 20)); } }
      else {
        ctx.strokeStyle = COLORS.e; ctx.lineWidth = 1.6; ctx.beginPath(); let pen = false;
        for (let i = 0; i <= 160; i++) { const x = r0 + ((r1 - r0) * i) / 160, y = B.pdf(x); if (!isFinite(y)) { pen = false; continue; } const py = iy + ih - 4 - Math.min(1, y / 2.2) * (ih - 20); pen ? ctx.lineTo(IX(x), py) : ctx.moveTo(IX(x), py); pen = true; }
        ctx.stroke();
      }
      // histogram of Z = (S − nμ)/(σ√n)
      const sn = B.sd * Math.sqrt(n), N = samples.length;
      const counts = new Map();
      let g = 1, width = 0.16;
      if (B.step) { g = Math.max(1, Math.ceil(0.14 * sn)); width = g / sn; }
      for (const s of samples) {
        const k = B.step ? Math.floor(Math.round(s) / g) : Math.floor(((s - n * B.mu) / sn + 4) / width);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      let top = 0.5;
      for (const c of counts.values()) top = Math.max(top, (c / (N * width)) * 1.08);
      if (Math.abs(P.bounds().y1 - top) / top > 0.04) P.view({ y1: top });
      ctx.fillStyle = 'rgba(255,209,102,0.7)';
      let m3 = 0;
      for (const [k, c] of counts) {
        const zc = B.step ? (k * g + (g - 1) / 2 - n * B.mu) / sn : -4 + (k + 0.5) * width;
        const dens = c / (N * width);
        const x0 = P.X(zc - width / 2) + 0.5, x1 = P.X(zc + width / 2) - 0.5;
        ctx.fillRect(x0, P.Y(dens), Math.max(1, x1 - x0), P.Y(0) - P.Y(dens));
      }
      for (const s of samples) m3 += ((s - n * B.mu) / sn) ** 3;
      P.axes(ctx, { xstep: 1, ystep: 10, grid: false });
      P.curve(ctx, (z) => npdf(z), { color: COLORS.d, width: 2 });
      S.setReadout(`金色：$${N}$ 次标准化和 $Z=\\dfrac{X_1+\\cdots+X_n-n\\mu}{\\sigma\\sqrt n}$ 的直方图，$n=${n}$；绿线 $N(0,1)$ 密度。样本偏度 $${(m3 / Math.max(1, N)).toFixed(2)}$（理论值 $\\gamma/\\sqrt n$ 随 $n$ 趋于 $0$）。无论总体多偏、多“怪”，只要方差有限，$n$ 增大时 $Z$ 的分布都趋于标准正态。`);
    });
    return { destroy: S.destroy };
  },
};

// ---- law of large numbers
const LLN = {
  coin: { name: '抛硬币', draw: () => (rand() < 0.5 ? 1 : 0), mu: 0.5, sd: 0.5, y: [0, 1] },
  dice: { name: '掷骰子', draw: () => 1 + Math.floor(rand() * 6), mu: 3.5, sd: Math.sqrt(35 / 12), y: [1, 6] },
  cauchy: { name: '柯西分布（无期望）', draw: () => Math.tan(Math.PI * (rand() - 0.5)), mu: null, y: [-6, 6] },
};
export const lln = {
  id: 'lln',
  title: '大数定律：频率的稳定',
  mount(host) {
    const S = stage(host, { height: 290 });
    let key = 'coin', paths = [], n = 0;
    const NMAX = 20000, K = 6;
    const reset = () => { paths = Array.from({ length: K }, () => ({ sum: 0, pts: [] })); n = 0; };
    reset();
    const L0 = 0, L1 = Math.log10(NMAX);
    const range = (D) => ({ y0: D.y[0] - (D.y[1] - D.y[0]) * 0.08, y1: D.y[1] + (D.y[1] - D.y[0]) * 0.08 });
    const P = plot(S, { x0: L0, x1: L1, ...range(LLN[key]), pad: 26 });
    select(S, { label: '试验', value: key, options: Object.entries(LLN).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; P.view(range(LLN[v])); reset(); } });
    button(S, '重来', reset);
    S.loop(() => {
      const D = LLN[key];
      if (n < NMAX) {
        const steps = Math.max(1, Math.floor(n * 0.02));
        for (let i = 0; i < steps && n < NMAX; i++) {
          n++;
          for (const p of paths) { p.sum += D.draw(); if (n < 50 || n % Math.max(1, Math.floor(n / 150)) === 0) p.pts.push([n, p.sum / n]); }
        }
        S.dirty = true;
      }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { labels: false, xstep: 1 });
      ctx.fillStyle = COLORS.muted; ctx.font = `10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let k = 0; k <= 4; k++) ctx.fillText(`10${'⁰¹²³⁴'[k]}`, P.X(k), P.Y(P.bounds().y0) + 3);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const y of [D.y[0], D.mu ?? 0, D.y[1]]) ctx.fillText(String(y), P.X(0) - 4, P.Y(y));
      const bb = P.bounds();
      ctx.save(); ctx.beginPath(); ctx.rect(P.X(L0), P.Y(bb.y1), P.X(L1) - P.X(L0), P.Y(bb.y0) - P.Y(bb.y1)); ctx.clip();
      if (D.mu !== null) {
        ctx.fillStyle = 'rgba(78,227,193,0.1)'; ctx.beginPath();
        for (let i = 0; i <= 100; i++) { const L = L0 + ((L1 - L0) * i) / 100, m = 10 ** L; const y = D.mu + (2 * D.sd) / Math.sqrt(m); i ? ctx.lineTo(P.X(L), P.Y(Math.min(y, D.y[1] + 1))) : ctx.moveTo(P.X(L), P.Y(Math.min(y, D.y[1] + 1))); }
        for (let i = 100; i >= 0; i--) { const L = L0 + ((L1 - L0) * i) / 100, m = 10 ** L; const y = D.mu - (2 * D.sd) / Math.sqrt(m); ctx.lineTo(P.X(L), P.Y(Math.max(y, D.y[0] - 1))); }
        ctx.fill();
        P.line(ctx, L0, D.mu, L1, D.mu, { color: COLORS.d, width: 1.2, dash: [5, 4] });
      }
      const cols = [COLORS.a, COLORS.b, COLORS.c, COLORS.e, COLORS.f, '#9fe870'];
      paths.forEach((p, i) => {
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 1.4; ctx.beginPath();
        p.pts.forEach(([m, y], k) => (k ? ctx.lineTo(P.X(Math.log10(m)), P.Y(y)) : ctx.moveTo(P.X(Math.log10(m)), P.Y(y))));
        ctx.stroke();
      });
      ctx.restore();
      const last = paths.map((p) => (p.sum / Math.max(1, n)).toFixed(3)).join(', ');
      if (D.mu === null) S.setReadout(`柯西分布没有数学期望：$n=${n}$ 时六条样本均值为 $${last}$，<b>不收敛</b>——偶尔一个极大的值就能把均值拽走。事实上 $\\bar X_n$ 仍服从同一个柯西分布。大数定律需要 $E|X|<\\infty$。`);
      else S.setReadout(`横轴是对数刻度的试验次数 $n$（已到 $${n}$）。六条样本均值 $\\bar X_n=${last}$ 都逼近 $\\mu=${D.mu}$：大数定律 $\\bar X_n\\to\\mu$。绿带是 $\\mu\\pm\\dfrac{2\\sigma}{\\sqrt n}$——偏差以 $\\frac1{\\sqrt n}$ 的速度缩小。`);
    });
    return { destroy: S.destroy };
  },
};

// ---- random walk
export const randomWalk = {
  id: 'random-walk',
  title: '随机游走与 √n',
  mount(host) {
    const S = stage(host, { height: 300 });
    let mode = '1d', walks = [], n = 0, w2 = null;
    const NMAX = 400, M = 300;
    const reset = () => { walks = Array.from({ length: M }, () => [0]); n = 0; w2 = { pts: [[0, 0]], back: 0, R: 12 }; };
    reset();
    const Y = 2.6 * Math.sqrt(NMAX);
    const P = plot(S, { x0: 0, x1: NMAX, y0: -Y, y1: Y, pad: 22 });
    select(S, { label: '维数', value: mode, options: [['1d', '一维（300 条）'], ['2d', '二维格点']], onchange: (v) => { mode = v; reset(); } });
    button(S, '重来', reset);
    S.loop((dt) => {
      const { ctx, w, h } = S;
      if (mode === '1d') {
        if (n < NMAX) { const k = Math.max(1, Math.round(dt / 16)); for (let s = 0; s < k && n < NMAX; s++) { n++; for (const wk of walks) wk.push(wk[wk.length - 1] + (rand() < 0.5 ? 1 : -1)); } S.dirty = true; }
        if (!S.dirty) return;
        S.dirty = false;
        S.clear();
        const gw = w * 0.74;
        P.fit(); P.ox = 26; P.sx = (gw - 30) / NMAX;
        P.axes(ctx, { xstep: 100, ystep: 20, labels: true });
        for (const k of [1, 2]) for (const sg of [1, -1]) P.curve(ctx, (x) => sg * k * Math.sqrt(x), { color: k === 1 ? 'rgba(78,227,193,0.8)' : 'rgba(78,227,193,0.4)', width: 1.4, from: 0, to: NMAX, dash: k === 2 ? [5, 4] : null });
        ctx.lineWidth = 1;
        walks.forEach((wk, i) => {
          ctx.strokeStyle = i < 5 ? [COLORS.b, COLORS.a, COLORS.c, COLORS.e, COLORS.f][i] : 'rgba(150,170,255,0.06)';
          ctx.lineWidth = i < 5 ? 1.5 : 1;
          ctx.beginPath(); wk.forEach((y, x) => (x ? ctx.lineTo(P.X(x), P.Y(y)) : ctx.moveTo(P.X(x), P.Y(y)))); ctx.stroke();
        });
        // histogram of S_n at the right
        const hx = gw + 10, hw = w - hx - 12, bins = new Map();
        for (const wk of walks) { const v = wk[n]; bins.set(v, (bins.get(v) || 0) + 1); }
        const bh = Math.max(1, P.sy * 2 - 1);
        const peak = Math.max(...bins.values());
        ctx.fillStyle = 'rgba(255,209,102,0.7)';
        for (const [v, c] of bins) ctx.fillRect(hx, P.Y(v) - bh / 2, (c / peak) * hw * 0.85, bh);
        if (n > 0) {
          const sd = Math.sqrt(n);
          ctx.strokeStyle = COLORS.d; ctx.lineWidth = 1.5; ctx.beginPath();
          for (let i = 0; i <= 120; i++) { const v = -Y + (2 * Y * i) / 120; const d = (2 * M * npdf(v, 0, sd)) / peak; const x = hx + d * hw * 0.85; i ? ctx.lineTo(x, P.Y(v)) : ctx.moveTo(x, P.Y(v)); }
          ctx.stroke();
        }
        let ms = 0, zeros = 0; for (const wk of walks) { ms += wk[n] ** 2; } ms /= M;
        for (let k = 1; k <= n; k++) if (walks[0][k] === 0) zeros++;
        S.setReadout(`每步等概率 $\\pm1$。$n=${n}$ 时 $300$ 条路径的 $\\overline{S_n^2}=${ms.toFixed(1)}$（理论 $E S_n^2=n=${n}$）：典型位移只有 $\\sqrt n$ 量级，绿线是 $\\pm\\sqrt n$ 与 $\\pm2\\sqrt n$。右侧是 $S_n$ 的分布与正态近似 $N(0,n)$。金色路径已回到原点 $${zeros}$ 次——一维、二维随机游走以概率 $1$ 无穷次回到原点（波利亚定理），三维则不然。`);
      } else {
        if (w2.pts.length >= 20000 && !S.dirty) return;
        S.dirty = false;
        const k = Math.max(1, Math.round(dt / 4));
        for (let s = 0; s < k && w2.pts.length < 20000; s++) {
          const [x, y] = w2.pts[w2.pts.length - 1], r = Math.floor(rand() * 4);
          const q = [x + [1, -1, 0, 0][r], y + [0, 0, 1, -1][r]];
          if (q[0] === 0 && q[1] === 0) w2.back++;
          w2.R = Math.max(w2.R, Math.abs(q[0]) * 1.15, Math.abs(q[1]) * 1.15);
          w2.pts.push(q);
        }
        S.clear();
        const m = w2.pts.length - 1, R = w2.R;
        const sc = Math.min(w, h) / (2 * R), cx = w / 2, cy = h / 2;
        ctx.lineWidth = 1;
        const seg = 400;
        for (let i = 0; i < m; i += seg) {
          ctx.strokeStyle = `hsla(${200 + (i / Math.max(1, m)) * 120},80%,65%,0.75)`;
          ctx.beginPath();
          for (let j = i; j <= Math.min(m, i + seg); j++) { const [x, y] = w2.pts[j]; j === i ? ctx.moveTo(cx + x * sc, cy - y * sc) : ctx.lineTo(cx + x * sc, cy - y * sc); }
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(78,227,193,0.6)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(cx, cy, Math.sqrt(m) * sc, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        const [x, y] = w2.pts[m];
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + x * sc, cy - y * sc, 3.5, 0, TAU); ctx.fill();
        ctx.fillStyle = COLORS.d; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
        S.setReadout(`二维格点随机游走，已走 $${m}$ 步，离原点 $${Math.hypot(x, y).toFixed(1)}$；虚线圆半径 $\\sqrt n=${Math.sqrt(m).toFixed(1)}$。回到原点 $${w2.back}$ 次。二维游走是常返的，但回来得很慢：前 $n$ 步平均回原点约 $\\frac1\\pi\\ln n$ 次。`);
      }
    });
    return { destroy: S.destroy };
  },
};

// ---- hypothesis test: α, β, power, p-value
export const hypothesis = {
  id: 'hypothesis',
  title: '假设检验：α、β 与 p 值',
  mount(host) {
    const S = stage(host, { height: 280 });
    let alpha = 0.05, delta = 2, zobs = 1.8, side = 'one';
    select(S, { label: '备择', value: side, options: [['one', '单侧 μ > μ₀'], ['two', '双侧 μ ≠ μ₀']], onchange: (v) => { side = v; } });
    slider(S, { label: '$\\alpha$', min: 0.01, max: 0.2, step: 0.01, value: alpha, fmt: (v) => v.toFixed(2), oninput: (v) => { alpha = v; } });
    slider(S, { label: '真实偏移 $\\delta$', min: 0, max: 4, step: 0.1, value: delta, fmt: (v) => v.toFixed(1), oninput: (v) => { delta = v; } });
    slider(S, { label: '观测 $z$', min: -3.5, max: 4.5, step: 0.05, value: zobs, fmt: (v) => v.toFixed(2), oninput: (v) => { zobs = v; } });
    const P = plot(S, { x0: -4, x1: 7, y0: 0, y1: 0.46, pad: 24 });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { xstep: 1, ystep: 0.1, grid: false });
      const two = side === 'two';
      const zc = invPhi(1 - (two ? alpha / 2 : alpha));
      const inRej = (z) => (two ? Math.abs(z) >= zc : z >= zc);
      const fill = (f, a, b, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(P.X(a), P.Y(0)); for (let i = 0; i <= 120; i++) { const z = a + ((b - a) * i) / 120; ctx.lineTo(P.X(z), P.Y(f(z))); } ctx.lineTo(P.X(b), P.Y(0)); ctx.closePath(); ctx.fill(); };
      const f0 = (z) => npdf(z), f1 = (z) => npdf(z, delta);
      // β: H1 density over the acceptance region
      fill(f1, two ? -zc : -4, zc, 'rgba(127,180,255,0.28)');
      // power: H1 density over the rejection region
      fill(f1, zc, 7, 'rgba(78,227,193,0.25)');
      if (two) fill(f1, -4, -zc, 'rgba(78,227,193,0.25)');
      // α
      fill(f0, zc, 7, 'rgba(255,138,101,0.55)');
      if (two) fill(f0, -4, -zc, 'rgba(255,138,101,0.55)');
      // p-value
      const pv = two ? 2 * (1 - Phi(Math.abs(zobs))) : 1 - Phi(zobs);
      if (two) { fill(f0, Math.abs(zobs), 7, 'rgba(255,209,102,0.5)'); fill(f0, -4, -Math.abs(zobs), 'rgba(255,209,102,0.5)'); }
      else fill(f0, zobs, 7, 'rgba(255,209,102,0.5)');
      P.curve(ctx, f0, { color: '#fff', width: 2 });
      P.curve(ctx, f1, { color: COLORS.a, width: 2 });
      for (const z of two ? [zc, -zc] : [zc]) P.line(ctx, z, 0, z, 0.44, { color: COLORS.c, width: 1.4, dash: [5, 4] });
      P.line(ctx, zobs, 0, zobs, 0.44, { color: COLORS.b, width: 2 });
      P.text(ctx, 'H₀', 0, f0(0), { color: '#fff', dy: -10, align: 'center', size: 12 });
      P.text(ctx, 'H₁', delta, f1(delta), { color: COLORS.a, dy: -10, align: 'center', size: 12 });
      P.text(ctx, `z = ${zobs.toFixed(2)}`, zobs, 0.44, { color: COLORS.b, dx: 5, dy: 6, size: 11 });
      const beta = two ? Phi(zc - delta) - Phi(-zc - delta) : Phi(zc - delta);
      S.setReadout(`白：$H_0$ 下检验统计量 $Z\\sim N(0,1)$；蓝：$H_1$ 下 $Z\\sim N(\\delta,1)$。临界值 $${two ? '\\pm' : ''}${zc.toFixed(3)}$，橙色面积 $=\\alpha=${alpha.toFixed(2)}$（第一类错误）；浅蓝 $\\beta=${beta.toFixed(3)}$（第二类错误），功效 $1-\\beta=${(1 - beta).toFixed(3)}$（绿）。观测 $z=${zobs.toFixed(2)}$ 的 $p$ 值 $=${pv < 0.0001 ? pv.toExponential(1) : pv.toFixed(4)}$（金色面积）：${inRej(zobs) ? `$p\\le\\alpha$，<b>拒绝</b> $H_0$` : `$p>\\alpha$，<b>不能拒绝</b> $H_0$`}。$p$ 值不是“$H_0$ 为真的概率”，而是 $H_0$ 为真时出现至少这么极端结果的概率。`);
    });
    return { destroy: S.destroy };
  },
};

// ---- least squares regression
export const regression = {
  id: 'regression',
  title: '最小二乘回归直线',
  mount(host) {
    const S = stage(host, { height: 300, hint: '拖动点 · 点击空白处添加' });
    const P = plot(S, { x0: 0, x1: 10, y0: 0, y1: 8, equal: true, pad: 24 });
    let pts = [], drag = -1, squares = true;
    const gen = () => { pts = []; const b = 0.3 + rand() * 0.5, a = 1 + rand() * 1.5; for (let i = 0; i < 12; i++) { const x = 0.6 + rand() * 8.8; pts.push([x, Math.max(0.2, Math.min(7.8, a + b * x + gauss(rand) * 0.8))]); } };
    gen();
    checkbox(S, '残差平方', squares, (v) => { squares = v; });
    button(S, '随机数据', gen);
    button(S, '清空', () => { pts = []; });
    S.pointer({
      down: (x, y) => {
        let best = -1, bd = 14;
        pts.forEach((p, i) => { const d = Math.hypot(P.X(p[0]) - x, P.Y(p[1]) - y); if (d < bd) { bd = d; best = i; } });
        if (best < 0) { pts.push([P.ix(x), P.iy(y)]); best = pts.length - 1; }
        drag = best; return true;
      },
      move: (x, y) => { if (drag >= 0) pts[drag] = [Math.max(0, Math.min(10, P.ix(x))), Math.max(0, Math.min(8, P.iy(y)))]; },
      up: () => { drag = -1; },
    });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { xstep: 1, ystep: 1 });
      const n = pts.length;
      if (n < 2) { for (const p of pts) P.dot(ctx, p[0], p[1], { color: COLORS.b }); S.setReadout('至少需要两个点。点击画布添加。'); return; }
      const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
      let sxx = 0, sxy = 0, syy = 0;
      for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
      const b = sxx > 1e-12 ? sxy / sxx : 0, a = my - b * mx;
      let sse = 0;
      for (const [x, y] of pts) {
        const yh = a + b * x, r = y - yh;
        sse += r * r;
        if (squares) {
          ctx.fillStyle = r > 0 ? 'rgba(255,138,101,0.16)' : 'rgba(127,180,255,0.16)';
          ctx.strokeStyle = r > 0 ? 'rgba(255,138,101,0.5)' : 'rgba(127,180,255,0.5)';
          const s = Math.abs(r) * P.sx, x0 = P.X(x), y0 = P.Y(Math.max(y, yh));
          ctx.fillRect(x0, y0, s, s); ctx.strokeRect(x0, y0, s, s);
        }
        P.line(ctx, x, y, x, yh, { color: 'rgba(255,255,255,0.45)', width: 1 });
      }
      P.curve(ctx, (x) => a + b * x, { color: COLORS.d, width: 2.4 });
      P.dot(ctx, mx, my, { r: 4, color: '#04060f', ring: COLORS.d });
      for (const p of pts) P.dot(ctx, p[0], p[1], { r: 4.5, color: COLORS.b });
      const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
      S.setReadout(`$\\hat y=${a.toFixed(3)}${b >= 0 ? '+' : ''}${b.toFixed(3)}x$，$\\hat b=\\dfrac{\\sum(x_i-\\bar x)(y_i-\\bar y)}{\\sum(x_i-\\bar x)^2}$，$\\hat a=\\bar y-\\hat b\\bar x$——直线必过样本中心 $(\\bar x,\\bar y)$（空心点）。方块面积之和就是残差平方和 $\\mathrm{SSE}=${sse.toFixed(3)}$，最小二乘直线使它最小。相关系数 $r=${r.toFixed(3)}$，$R^2=${(r * r).toFixed(3)}$。`);
    });
    return { destroy: S.destroy };
  },
};
