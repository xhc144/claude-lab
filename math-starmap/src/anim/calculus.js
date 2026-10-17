// Derivative as a limit of secants, the mean value theorem, Riemann sums and partial sums of series.
import { stage, slider, select, checkbox, plot, COLORS } from './kit.js';

const CURVES = {
  cubic: { name: 'x³ − 2x', f: (x) => x ** 3 - 2 * x, d: (x) => 3 * x * x - 2, view: { x0: -2.2, x1: 2.2, y0: -3, y1: 3 } },
  sin: { name: 'sin x', f: Math.sin, d: Math.cos, view: { x0: -4, x1: 4, y0: -1.8, y1: 1.8 } },
  exp: { name: 'eˣ', f: Math.exp, d: Math.exp, view: { x0: -2.5, x1: 2, y0: -0.5, y1: 6 } },
};

export const derivativeTangent = {
  id: 'derivative-tangent',
  title: '割线逼近切线',
  mount(host) {
    const S = stage(host, { height: 280, hint: '拖动白点' });
    let key = 'cubic', x0 = 0.8, h = 1;
    const P = plot(S, CURVES.cubic.view);
    select(S, { label: '曲线', value: key, options: Object.entries(CURVES).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; P.view(CURVES[v].view); x0 = 0.5; } });
    const hs = slider(S, { label: '$h$', min: -1.5, max: 1.5, step: 0.01, value: h, fmt: (v) => v.toFixed(2), oninput: (v) => { h = Math.abs(v) < 0.005 ? 0.005 : v; } });
    S.pointer({ down: (x) => { x0 = P.ix(x); return true; }, move: (x) => { const b = P.bounds(); x0 = Math.max(b.x0, Math.min(b.x1, P.ix(x))); } });
    let anim = 0;
    S.loop((dt) => {
      if (!S.dirty && !anim) return;
      S.dirty = false;
      const C = CURVES[key];
      const { ctx } = S;
      S.clear();
      P.axes(ctx);
      P.curve(ctx, C.f, { color: 'rgba(255,255,255,0.85)', width: 2 });
      const y0 = C.f(x0), x1 = x0 + h, y1 = C.f(x1);
      const k = (y1 - y0) / h, kt = C.d(x0);
      const b = P.bounds();
      P.line(ctx, b.x0, y0 + kt * (b.x0 - x0), b.x1, y0 + kt * (b.x1 - x0), { color: COLORS.d, width: 1.5, dash: [6, 4] });
      P.line(ctx, b.x0, y0 + k * (b.x0 - x0), b.x1, y0 + k * (b.x1 - x0), { color: COLORS.b, width: 2 });
      P.line(ctx, x0, y0, x1, y0, { color: 'rgba(255,255,255,0.35)', width: 1, dash: [3, 3] });
      P.line(ctx, x1, y0, x1, y1, { color: 'rgba(255,255,255,0.35)', width: 1, dash: [3, 3] });
      P.dot(ctx, x1, y1, { r: 4, color: COLORS.b });
      P.dot(ctx, x0, y0, { r: 5.5, color: '#fff' });
      S.setReadout(`割线斜率 $\\dfrac{f(x_0+h)-f(x_0)}{h}=${k.toFixed(4)}$（金），切线斜率 $f'(${x0.toFixed(2)})=${kt.toFixed(4)}$（绿虚线）。让 $h\\to0$，割线转到切线位置。`);
    });
    const play = document.createElement('button');
    play.className = 'btn sm'; play.textContent = '让 h → 0';
    play.onclick = () => { let v = Math.abs(h) < 0.02 ? 1.5 : h; const t0 = performance.now(); const tick = (t) => { const u = Math.min(1, (t - t0) / 1800); h = v * (1 - u) ** 2 + 0.005 * Math.sign(v); hs.set(h); S.dirty = true; if (u < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
    S.controls.append(play);
    return { destroy: S.destroy };
  },
};

export const mvt = {
  id: 'mvt',
  title: '拉格朗日中值定理',
  mount(host) {
    const S = stage(host, { height: 270, hint: '拖动两个端点' });
    const f = (x) => 0.15 * x ** 3 - 0.6 * x * x + 0.3 * x + 2 + 0.4 * Math.sin(2 * x);
    const df = (x) => 0.45 * x * x - 1.2 * x + 0.3 + 0.8 * Math.cos(2 * x);
    let a = -1.5, b = 3.5, drag = null;
    const P = plot(S, { x0: -2.5, x1: 5, y0: -1, y1: 5 });
    S.pointer({
      down: (x, y) => { const da = Math.abs(P.X(a) - x), db = Math.abs(P.X(b) - x); drag = da < db ? 'a' : 'b'; return true; },
      move: (x) => { const v = P.ix(x); if (drag === 'a') a = Math.min(v, b - 0.3); else b = Math.max(v, a + 0.3); },
    });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx);
      P.curve(ctx, f, { color: 'rgba(255,255,255,0.85)', width: 2 });
      const k = (f(b) - f(a)) / (b - a);
      P.line(ctx, a, f(a), b, f(b), { color: COLORS.b, width: 2 });
      // all ξ in (a,b) with f'(ξ)=k
      const xis = [];
      const N = 600;
      for (let i = 0; i < N; i++) {
        const u = a + ((b - a) * i) / N, v = a + ((b - a) * (i + 1)) / N;
        const gu = df(u) - k, gv = df(v) - k;
        if (gu * gv <= 0) { let lo = u, hi = v; for (let t = 0; t < 40; t++) { const m = (lo + hi) / 2; if ((df(lo) - k) * (df(m) - k) <= 0) hi = m; else lo = m; } xis.push((lo + hi) / 2); }
      }
      const B = P.bounds();
      for (const xi of xis) {
        const y = f(xi);
        P.line(ctx, B.x0, y + k * (B.x0 - xi), B.x1, y + k * (B.x1 - xi), { color: COLORS.d, width: 1.4, dash: [6, 4] });
        P.dot(ctx, xi, y, { r: 4.5, color: COLORS.d });
      }
      P.dot(ctx, a, f(a), { r: 6, color: '#fff' });
      P.dot(ctx, b, f(b), { r: 6, color: '#fff' });
      S.setReadout(`弦的斜率 $\\frac{f(b)-f(a)}{b-a}=${k.toFixed(3)}$。在 $(a,b)$ 内找到 ${xis.length} 个 $\\xi$ 使 $f'(\\xi)$ 等于它（绿点）：那里的切线与弦平行。中值定理保证至少有一个，但不说是哪一个。`);
    });
    return { destroy: S.destroy };
  },
};

const INTS = {
  sq: { name: 'x²，[0, 2]', f: (x) => x * x, a: 0, b: 2, I: 8 / 3, view: { x0: -0.2, x1: 2.2, y0: -0.3, y1: 4.4 } },
  sin: { name: 'sin x，[0, π]', f: Math.sin, a: 0, b: Math.PI, I: 2, view: { x0: -0.2, x1: 3.4, y0: -0.2, y1: 1.3 } },
  exp: { name: 'e^(−x²)，[−2, 2]', f: (x) => Math.exp(-x * x), a: -2, b: 2, I: 1.7641627815248, view: { x0: -2.3, x1: 2.3, y0: -0.1, y1: 1.2 } },
  recip: { name: '1/x，[1, 4]', f: (x) => 1 / x, a: 1, b: 4, I: Math.log(4), view: { x0: 0.7, x1: 4.3, y0: -0.1, y1: 1.2 } },
};
const RULES = [['left', '左端点'], ['right', '右端点'], ['mid', '中点'], ['trap', '梯形'], ['simpson', '辛普森']];

export const riemannSum = {
  id: 'riemann-sum',
  title: '黎曼和与数值积分',
  mount(host) {
    const S = stage(host, { height: 270 });
    let key = 'sq', n = 6, rule = 'left';
    const P = plot(S, INTS.sq.view);
    select(S, { label: '函数', value: key, options: Object.entries(INTS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; P.view(INTS[v].view); } });
    select(S, { label: '方法', value: rule, options: RULES, onchange: (v) => { rule = v; } });
    slider(S, { label: '$n$', min: 2, max: 60, step: 2, value: n, oninput: (v) => { n = v; } });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const F = INTS[key];
      const { ctx } = S;
      S.clear();
      P.axes(ctx);
      const h = (F.b - F.a) / n;
      let sum = 0;
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const x = F.a + i * h;
        ctx.fillStyle = 'rgba(127,180,255,0.22)';
        ctx.strokeStyle = 'rgba(127,180,255,0.7)';
        ctx.beginPath();
        if (rule === 'trap' || rule === 'simpson') {
          ctx.moveTo(P.X(x), P.Y(0)); ctx.lineTo(P.X(x), P.Y(F.f(x))); ctx.lineTo(P.X(x + h), P.Y(F.f(x + h))); ctx.lineTo(P.X(x + h), P.Y(0)); ctx.closePath();
          if (rule === 'trap') sum += (h * (F.f(x) + F.f(x + h))) / 2;
        } else {
          const xs = rule === 'left' ? x : rule === 'right' ? x + h : x + h / 2;
          const y = F.f(xs);
          ctx.rect(P.X(x), P.Y(Math.max(0, y)), P.X(x + h) - P.X(x), Math.abs(P.Y(y) - P.Y(0)));
          sum += y * h;
        }
        ctx.fill(); ctx.stroke();
      }
      if (rule === 'simpson') { sum = 0; for (let i = 0; i < n; i += 2) { const x = F.a + i * h; sum += (h / 3) * (F.f(x) + 4 * F.f(x + h) + F.f(x + 2 * h)); } }
      P.curve(ctx, F.f, { color: '#fff', width: 2, from: P.bounds().x0, to: P.bounds().x1 });
      const err = sum - F.I;
      S.setReadout(`近似值 $${sum.toFixed(6)}$，精确值 $${F.I.toFixed(6)}$，误差 $${err.toExponential(2).replace('e', '\\times10^{') + '}'}$。$n$ 加倍时，左/右端点误差约减半（$O(h)$），中点与梯形约变为四分之一（$O(h^2)$），辛普森约变为十六分之一（$O(h^4)$）。`);
    });
    return { destroy: S.destroy };
  },
};

const SERIES = {
  harm: { name: '1 + 1/2 + 1/3 + …（发散）', t: (n) => 1 / n, lim: null, tex: '\\sum\\frac1n' },
  alt: { name: '1 − 1/2 + 1/3 − …', t: (n) => (n % 2 ? 1 : -1) / n, lim: Math.LN2, tex: '\\sum\\frac{(-1)^{n-1}}n=\\ln2' },
  geo: { name: '1/2 + 1/4 + 1/8 + …', t: (n) => 0.5 ** n, lim: 1, tex: '\\sum\\frac1{2^n}=1' },
  basel: { name: '1 + 1/4 + 1/9 + …', t: (n) => 1 / (n * n), lim: (Math.PI ** 2) / 6, tex: '\\sum\\frac1{n^2}=\\frac{\\pi^2}6' },
  leib: { name: '4(1 − 1/3 + 1/5 − …)', t: (n) => (4 * (n % 2 ? 1 : -1)) / (2 * n - 1), lim: Math.PI, tex: '4\\sum\\frac{(-1)^{n-1}}{2n-1}=\\pi' },
};

export const seriesSums = {
  id: 'series-sums',
  title: '级数的部分和',
  mount(host) {
    const S = stage(host, { height: 260 });
    let key = 'harm', N = 50, log = false;
    const P = plot(S, { x0: 0, x1: 51, y0: 0, y1: 5 });
    select(S, { label: '级数', value: key, options: Object.entries(SERIES).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; } });
    slider(S, { label: '项数 $n$', min: 5, max: 400, step: 1, value: N, oninput: (v) => { N = v; } });
    checkbox(S, '对数横轴', log, (v) => { log = v; });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const Sr = SERIES[key];
      const sums = [];
      let s = 0;
      for (let n = 1; n <= N; n++) { s += Sr.t(n); sums.push(s); }
      const lo = Math.min(0, ...sums), hi = Math.max(...sums, Sr.lim ?? 0) * 1.1 + 0.1;
      const X = (n) => (log ? Math.log(n) : n);
      P.view({ x0: log ? -0.1 : 0, x1: X(N) * 1.03 + 0.5, y0: lo - 0.1, y1: hi });
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { labels: !log });
      if (Sr.lim != null) P.line(ctx, P.bounds().x0, Sr.lim, P.bounds().x1, Sr.lim, { color: COLORS.d, width: 1.2, dash: [6, 4] });
      if (key === 'harm') P.curve(ctx, (x) => (log ? x : Math.log(x)) + 0.5772, { color: 'rgba(255,209,102,0.5)', width: 1.2, dash: [4, 4], from: log ? 0 : 1, to: X(N) });
      ctx.strokeStyle = COLORS.a; ctx.lineWidth = 1.6; ctx.beginPath();
      sums.forEach((v, k) => { const x = P.X(X(k + 1)), y = P.Y(v); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      if (N <= 120) sums.forEach((v, k) => P.dot(ctx, X(k + 1), v, { r: 2.2, color: COLORS.a }));
      const last = sums[sums.length - 1];
      S.setReadout(Sr.lim == null
        ? `$S_{${N}}=${last.toFixed(4)}$。调和级数的部分和像 $\\ln n+\\gamma$（金虚线）一样增长，没有上界——但极其缓慢：超过 $10$ 需要 $12367$ 项。`
        : `$${Sr.tex}$。$S_{${N}}=${last.toFixed(6)}$，与极限相差 $${Math.abs(last - Sr.lim).toExponential(2).replace('e', '\\times10^{') + '}'}$。交错级数在极限两侧来回摆动，几何级数收敛最快。`);
    });
    return { destroy: S.destroy };
  },
};
