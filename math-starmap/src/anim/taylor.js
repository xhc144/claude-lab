import { stage, slider, select, plot, COLORS } from './kit.js';

// Taylor polynomials at 0 approaching a function as the degree grows.
const FUNCS = {
  sin: { name: 'sin x', f: Math.sin, c: (k) => (k % 2 ? ((k - 1) / 2) % 2 ? -1 : 1 : 0), view: { x0: -9, x1: 9, y0: -2.6, y1: 2.6 }, tex: '\\sin x' },
  cos: { name: 'cos x', f: Math.cos, c: (k) => (k % 2 ? 0 : (k / 2) % 2 ? -1 : 1), view: { x0: -9, x1: 9, y0: -2.6, y1: 2.6 }, tex: '\\cos x' },
  exp: { name: 'eˣ', f: Math.exp, c: () => 1, view: { x0: -5, x1: 3.5, y0: -2, y1: 12 }, tex: '\\mathrm{e}^x' },
  log: { name: 'ln(1+x)', f: (x) => (x > -1 ? Math.log(1 + x) : NaN), c: (k) => (k === 0 ? 0 : ((k % 2 ? 1 : -1) * fact(k - 1))), view: { x0: -1.5, x1: 3, y0: -3, y1: 2.5 }, tex: '\\ln(1+x)', radius: 1 },
  geo: { name: '1/(1−x)', f: (x) => 1 / (1 - x), c: (k) => fact(k), view: { x0: -3, x1: 2, y0: -3, y1: 6 }, tex: '\\frac{1}{1-x}', radius: 1 },
};
function fact(n) { let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; }

export default {
  id: 'taylor',
  title: '泰勒多项式逼近',
  mount(host) {
    const S = stage(host, { height: 280 });
    let key = 'sin', n = 3;
    const P = plot(S, { ...FUNCS.sin.view });
    select(S, { label: '函数', value: key, options: Object.entries(FUNCS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; P.view(FUNCS[v].view); } });
    slider(S, { label: '阶数 $n$', min: 0, max: 24, step: 1, value: n, oninput: (v) => { n = v; } });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const F = FUNCS[key];
      const { ctx } = S;
      S.clear();
      P.axes(ctx);
      if (F.radius) { const b = P.bounds(); ctx.fillStyle = 'rgba(78,227,193,0.06)'; ctx.fillRect(P.X(-F.radius), P.Y(b.y1), P.X(F.radius) - P.X(-F.radius), P.Y(b.y0) - P.Y(b.y1)); }
      P.curve(ctx, F.f, { color: 'rgba(255,255,255,0.85)', width: 2.2 });
      const poly = (x) => { let s = 0, p = 1; for (let k = 0; k <= n; k++) { s += (F.c(k) / fact(k)) * p; p *= x; } return s; };
      P.curve(ctx, poly, { color: COLORS.b, width: 2.4 });
      const xe = F.radius ? 0.5 : 1;
      const err = Math.abs(poly(xe) - F.f(xe));
      S.setReadout(`白线 $${F.tex}$，金线是它在 $0$ 处的 $${n}$ 阶泰勒多项式 $T_{${n}}(x)=\\sum_{k=0}^{${n}} \\frac{f^{(k)}(0)}{k!}x^k$。在 $x=${xe}$ 处误差 $${err < 1e-12 ? '<10^{-12}' : err.toExponential(2).replace('e', '\\times10^{') + '}'}$。${F.radius ? '绿色带是 $|x|<1$：收敛半径为 $1$，在 $|x|>1$ 处无论取多少阶，多项式都远离函数。' : '阶数越高，贴合的区间越宽。'}`);
    });
    return { destroy: S.destroy };
  },
};
