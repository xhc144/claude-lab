// ε–N for sequences and ε–δ for functions.
import { stage, slider, select, plot, COLORS } from './kit.js';

const SEQS = {
  a: { name: '1 + (−1)ⁿ/n', f: (n) => 1 + (-1) ** n / n, L: 1, tex: '1+\\frac{(-1)^n}{n}', N: (e) => Math.ceil(1 / e) },
  b: { name: 'n/(n+1)', f: (n) => n / (n + 1), L: 1, tex: '\\frac{n}{n+1}', N: (e) => Math.max(0, Math.ceil(1 / e - 1)) },
  c: { name: 'sin n / √n', f: (n) => Math.sin(n) / Math.sqrt(n), L: 0, tex: '\\frac{\\sin n}{\\sqrt n}', N: (e) => Math.ceil(1 / (e * e)) },
  d: { name: '(−1)ⁿ（发散）', f: (n) => (-1) ** n, L: null, tex: '(-1)^n', N: () => Infinity },
};

export const epsilonN = {
  id: 'epsilon-n',
  title: '数列极限的 ε–N 定义',
  mount(host) {
    const S = stage(host, { height: 270 });
    let key = 'a', eps = 0.2;
    const M = 60;
    const P = plot(S, { x0: 0, x1: M + 1, y0: -0.2, y1: 2.1 });
    select(S, { label: '数列', value: key, options: Object.entries(SEQS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; const s = SEQS[v]; P.view(s.L === 0 ? { y0: -1, y1: 1 } : s.L === null ? { y0: -1.6, y1: 1.6 } : { y0: -0.2, y1: 2.1 }); } });
    slider(S, { label: '$\\varepsilon$', min: 0.02, max: 0.6, step: 0.01, value: eps, fmt: (v) => v.toFixed(2), oninput: (v) => { eps = v; } });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      const sq = SEQS[key];
      S.clear();
      P.axes(ctx, { xstep: 10 });
      const N = sq.N(eps);
      if (sq.L !== null) {
        const b = P.bounds();
        ctx.fillStyle = 'rgba(78,227,193,0.12)';
        ctx.fillRect(P.X(b.x0), P.Y(sq.L + eps), P.X(b.x1) - P.X(b.x0), P.Y(sq.L - eps) - P.Y(sq.L + eps));
        P.line(ctx, b.x0, sq.L, b.x1, sq.L, { color: COLORS.d, width: 1, dash: [5, 4] });
        if (N <= M) { P.line(ctx, N + 0.5, b.y0, N + 0.5, b.y1, { color: COLORS.b, width: 1.2, dash: [3, 3] }); P.text(ctx, `N = ${N}`, N + 0.5, b.y1, { color: COLORS.b, dx: 4, dy: 10, size: 11 }); }
      }
      let outside = 0;
      for (let n = 1; n <= M; n++) {
        const y = sq.f(n);
        const inside = sq.L !== null && Math.abs(y - sq.L) < eps;
        if (!inside && n > N) outside++;
        P.dot(ctx, n, y, { r: 3, color: inside ? COLORS.d : n <= N ? 'rgba(255,255,255,0.55)' : COLORS.c });
      }
      if (sq.L === null) S.setReadout(`$${sq.tex}$ 在 $1$ 与 $-1$ 之间来回跳：无论 $L$ 取什么、$\\varepsilon<1$ 时都找不到 $N$——数列发散。`);
      else S.setReadout(`$\\lim ${sq.tex}=${sq.L}$。对 $\\varepsilon=${eps.toFixed(2)}$，取 $N=${N}$：$n>N$ 的每一项都落在绿色带 $(${sq.L}-\\varepsilon,\\ ${sq.L}+\\varepsilon)$ 内${outside ? `（图中仍有 ${outside} 项在外，说明 $N$ 取小了）` : ''}。$\\varepsilon$ 越小，$N$ 越大。`);
    });
    return { destroy: S.destroy };
  },
};

const FUNS = {
  sq: { name: 'x²（在 x₀=1 处）', f: (x) => x * x, x0: 1, view: { x0: -0.2, x1: 2.2, y0: -0.4, y1: 3.4 }, tex: 'x^2', cont: true },
  sinc: { name: 'sin x / x（在 0 处）', f: (x) => (Math.abs(x) < 1e-9 ? NaN : Math.sin(x) / x), L: 1, x0: 0, view: { x0: -6, x1: 6, y0: -0.5, y1: 1.4 }, tex: '\\frac{\\sin x}{x}' },
  step: { name: '符号函数（在 0 处）', f: (x) => (x > 0 ? 1 : x < 0 ? -1 : 0), L: 1, x0: 0, view: { x0: -2, x1: 2, y0: -1.6, y1: 1.6 }, tex: '\\operatorname{sgn}x', bad: true },
};

export const epsilonDelta = {
  id: 'epsilon-delta',
  title: '函数极限的 ε–δ 定义',
  mount(host) {
    const S = stage(host, { height: 280 });
    let key = 'sq', eps = 0.5;
    const P = plot(S, FUNS.sq.view);
    select(S, { label: '函数', value: key, options: Object.entries(FUNS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; P.view(FUNS[v].view); } });
    slider(S, { label: '$\\varepsilon$', min: 0.05, max: 1, step: 0.01, value: eps, fmt: (v) => v.toFixed(2), oninput: (v) => { eps = v; } });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const F = FUNS[key];
      const L = F.L ?? F.f(F.x0);
      const { ctx } = S;
      S.clear();
      P.axes(ctx);
      // largest δ that works (scan)
      let delta = 0;
      for (let d = 0.001; d < 3; d *= 1.02) {
        let ok = true;
        for (let k = 1; k <= 200 && ok; k++) for (const s of [-1, 1]) { const x = F.x0 + s * (d * k) / 200; const y = F.f(x); if (isFinite(y) && Math.abs(y - L) >= eps) ok = false; }
        if (!ok) break;
        delta = d;
      }
      if (F.bad) delta = 0;
      const b = P.bounds();
      ctx.fillStyle = 'rgba(78,227,193,0.12)';
      ctx.fillRect(P.X(b.x0), P.Y(L + eps), P.X(b.x1) - P.X(b.x0), P.Y(L - eps) - P.Y(L + eps));
      if (delta > 0) { ctx.fillStyle = 'rgba(255,209,102,0.12)'; ctx.fillRect(P.X(F.x0 - delta), P.Y(b.y1), P.X(F.x0 + delta) - P.X(F.x0 - delta), P.Y(b.y0) - P.Y(b.y1)); }
      P.curve(ctx, F.f, { color: 'rgba(255,255,255,0.8)', width: 2 });
      if (delta > 0) P.curve(ctx, F.f, { color: COLORS.b, width: 3, from: F.x0 - delta, to: F.x0 + delta });
      P.dot(ctx, F.x0, L, { r: 4, color: '#04060f', ring: COLORS.d });
      if (F.bad) S.setReadout(`在 $0$ 处，无论 $\\delta$ 多小，左右两侧的函数值分别是 $-1$ 和 $1$，不能同时落在 $1$ 的 $\\varepsilon$ 带里（$\\varepsilon<2$ 时）：$\\lim_{x\\to0}${F.tex}$ 不存在。`);
      else S.setReadout(`对 $\\varepsilon=${eps.toFixed(2)}$（绿带），可取 $\\delta\\approx${delta.toFixed(3)}$（金带）：$0<|x-${F.x0}|<\\delta$ 时 $|${F.tex}-${L}|<\\varepsilon$，金色曲线段完全落在绿带内。`);
    });
    return { destroy: S.destroy };
  },
};
