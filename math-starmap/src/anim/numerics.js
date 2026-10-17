// Numerical methods: Newton / bisection, fixed-point iteration and the logistic map,
// polynomial interpolation (Runge), gradient descent, linear programming.
import { stage, slider, select, button, checkbox, plot, arrow, COLORS, TAU, FONT } from './kit.js';

const sci = (v) => {
  if (!isFinite(v)) return '\\infty';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(v)), m = v / 10 ** e;
  return e === 0 ? m.toFixed(1) : `${m.toFixed(1)}\\times10^{${e}}`;
};

const ROOT_FUNS = {
  cubic: { name: 'x³ − 2x − 5', f: (x) => x ** 3 - 2 * x - 5, df: (x) => 3 * x * x - 2, root: 2.0945514815423265, view: { x0: -1, x1: 3.6, y0: -12, y1: 18 }, x0: 3.2, ab: [2, 3], note: '牛顿当年用的例子。' },
  cos: { name: 'cos x − x', f: (x) => Math.cos(x) - x, df: (x) => -Math.sin(x) - 1, root: 0.7390851332151607, view: { x0: -1.5, x1: 3, y0: -3.2, y1: 1.8 }, x0: 2.5, ab: [0, 1], note: '' },
  sqrt2: { name: 'x² − 2', f: (x) => x * x - 2, df: (x) => 2 * x, root: Math.SQRT2, view: { x0: -0.5, x1: 4, y0: -3, y1: 12 }, x0: 3.6, ab: [1, 2], note: '此时牛顿迭代就是古巴比伦的开方法 $x\\mapsto\\frac12(x+\\frac2x)$。' },
  atan: { name: 'arctan x', f: Math.atan, df: (x) => 1 / (1 + x * x), root: 0, view: { x0: -5, x1: 5, y0: -1.8, y1: 1.8 }, x0: 1.2, ab: [-1, 2], note: '初值 $|x_0|>1.3917$ 时牛顿法发散（来回越跳越远），二分法则永远收敛。' },
};

export const newton = {
  id: 'newton',
  title: '牛顿迭代与二分法',
  mount(host) {
    const S = stage(host, { height: 290, hint: '拖动初值' });
    let key = 'cubic', method = 'newton', x0 = ROOT_FUNS.cubic.x0, k = 0, auto = 1, drag = false;
    const P = plot(S, ROOT_FUNS.cubic.view);
    select(S, { label: '函数', value: key, options: Object.entries(ROOT_FUNS).map(([q, v]) => [q, v.name]), onchange: (v) => { key = v; x0 = ROOT_FUNS[v].x0; k = 0; P.view(ROOT_FUNS[v].view); } });
    select(S, { label: '方法', value: method, options: [['newton', '牛顿法'], ['bisect', '二分法']], onchange: (v) => { method = v; k = 0; } });
    button(S, '下一步', () => { k = Math.min(k + 1, 12); });
    button(S, '自动', () => { k = 0; auto = 1; });
    button(S, '重置', () => { k = 0; auto = 0; });
    S.pointer({
      down: (x) => { if (method !== 'newton') return false; drag = true; x0 = P.ix(x); k = 0; auto = 0; return true; },
      move: (x) => { if (drag) x0 = Math.max(P.bounds().x0, Math.min(P.bounds().x1, P.ix(x))); },
      up: () => { drag = false; },
    });
    let acc = 0;
    S.loop((dt) => {
      if (auto) { acc += dt; if (acc > 800) { acc = 0; if (k < 6) { k++; S.dirty = true; } else auto = 0; } }
      if (!S.dirty) return;
      S.dirty = false;
      const F = ROOT_FUNS[key];
      const { ctx } = S;
      S.clear();
      P.axes(ctx);
      P.curve(ctx, F.f, { color: 'rgba(255,255,255,0.85)', width: 2 });
      const rows = [];
      if (method === 'newton') {
        let x = x0;
        rows.push(x);
        for (let i = 0; i < k; i++) {
          const y = F.f(x), d = F.df(x);
          if (Math.abs(d) < 1e-12 || !isFinite(x)) break;
          const xn = x - y / d;
          const alpha = 0.35 + 0.65 * ((i + 1) / k);
          P.line(ctx, x, 0, x, y, { color: `rgba(255,209,102,${alpha * 0.7})`, width: 1, dash: [3, 3] });
          P.line(ctx, x, y, xn, 0, { color: `rgba(127,180,255,${alpha})`, width: 1.6 });
          P.dot(ctx, x, y, { r: 3, color: COLORS.b });
          x = xn; rows.push(x);
          if (Math.abs(x) > 1e6) break;
        }
        rows.forEach((v, i) => { if (isFinite(v) && Math.abs(v) < 1e5) P.dot(ctx, v, 0, { r: i === rows.length - 1 ? 5 : 3, color: i === 0 ? COLORS.c : i === rows.length - 1 ? COLORS.d : 'rgba(78,227,193,0.6)' }); });
        P.text(ctx, 'x₀', x0, 0, { color: COLORS.c, dy: 14, align: 'center', size: 12 });
      } else {
        let [a, b] = F.ab;
        const b0 = P.bounds();
        for (let i = 0; i <= k; i++) {
          const ya = P.Y(b0.y0) - 10 - i * 5;
          if (i === k) {
            ctx.fillStyle = 'rgba(78,227,193,0.12)'; ctx.fillRect(P.X(a), P.Y(b0.y1), P.X(b) - P.X(a), P.Y(b0.y0) - P.Y(b0.y1));
            P.line(ctx, a, b0.y0, a, b0.y1, { color: COLORS.d, width: 1.2, dash: [4, 3] });
            P.line(ctx, b, b0.y0, b, b0.y1, { color: COLORS.d, width: 1.2, dash: [4, 3] });
          }
          ctx.strokeStyle = `rgba(255,209,102,${0.3 + (0.7 * (i + 1)) / (k + 1)})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(P.X(a), ya); ctx.lineTo(P.X(b), ya); ctx.stroke();
          const m = (a + b) / 2;
          rows.push(m);
          if (i < k) { if (F.f(a) * F.f(m) <= 0) b = m; else a = m; }
        }
        const m = rows[rows.length - 1];
        P.dot(ctx, m, 0, { r: 5, color: COLORS.d });
        P.dot(ctx, m, F.f(m), { r: 3.5, color: COLORS.b });
      }
      const err = rows.map((v) => Math.abs(v - F.root));
      const tbl = rows.slice(-5).map((v, i, arr) => { const j = rows.length - arr.length + i; return `$x_{${j}}=${isFinite(v) && Math.abs(v) < 1e9 ? v.toFixed(12).replace(/0+$/, '').replace(/\.$/, '') : '\\infty'}$（误差 $${sci(err[j])}$）`; }).join('；');
      const intro = method === 'newton' ? '牛顿法 $x_{k+1}=x_k-\\dfrac{f(x_k)}{f\'(x_k)}$：用切线与 $x$ 轴的交点代替曲线的零点。在单根附近二次收敛——每步有效数字约翻倍。' : '二分法：区间端点函数值异号，取中点并保留异号的一半。每步误差减半（线性收敛），约 $3.3$ 步多一位有效数字，但对连续函数总能收敛。';
      S.setReadout(`${intro}${F.note} ${tbl}`);
    });
    return { destroy: S.destroy };
  },
};

// ---- fixed-point iteration, cobweb, logistic map and its bifurcation diagram
const MAPS = {
  logistic: { name: '逻辑斯谛 rx(1−x)', g: (x, r) => r * x * (1 - x), view: [0, 1] },
  cos: { name: 'cos x', g: (x) => Math.cos(x), view: [0, 1.6] },
  babylon: { name: '(x + 2/x)/2', g: (x) => (x + 2 / x) / 2, view: [0.6, 3] },
};

export const cobweb = {
  id: 'cobweb',
  title: '不动点迭代与混沌',
  mount(host) {
    const S = stage(host, { height: 300 });
    let key = 'logistic', r = 2.8, x0 = 0.12, bif = null, bifW = 0, bifH = 0;
    select(S, { label: '迭代', value: key, options: Object.entries(MAPS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; x0 = v === 'logistic' ? 0.12 : v === 'cos' ? 0.2 : 2.8; } });
    const rs = slider(S, { label: '$r$', min: 0.5, max: 4, step: 0.001, value: r, fmt: (v) => v.toFixed(3), oninput: (v) => { r = v; } });
    slider(S, { label: '$x_0$', min: 0.01, max: 0.99, step: 0.01, value: x0, fmt: (v) => v.toFixed(2), oninput: (v) => { x0 = key === 'babylon' ? 0.6 + v * 2.4 : key === 'cos' ? v * 1.6 : v; } });
    const preset = (v) => () => { r = v; rs.set(v); };
    button(S, '稳定 2.8', preset(2.8));
    button(S, '周期 2', preset(3.2));
    button(S, '周期 4', preset(3.5));
    button(S, '混沌 3.9', preset(3.9));
    const makeBif = (bw, bh) => {
      const c = document.createElement('canvas');
      c.width = bw; c.height = bh;
      const g = c.getContext('2d');
      const img = g.createImageData(bw, bh);
      for (let i = 0; i < bw; i++) {
        const rr = 2.5 + (1.5 * i) / (bw - 1);
        let x = 0.5;
        for (let k = 0; k < 400; k++) x = rr * x * (1 - x);
        for (let k = 0; k < 300; k++) {
          x = rr * x * (1 - x);
          const j = Math.floor((1 - x) * (bh - 1));
          const o = (j * bw + i) * 4;
          img.data[o] = 170; img.data[o + 1] = 200; img.data[o + 2] = 255;
          img.data[o + 3] = Math.min(255, img.data[o + 3] + 60);
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    };
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx, w, h } = S;
      S.clear();
      const M = MAPS[key], logi = key === 'logistic';
      const side = logi ? Math.min(h - 30, w * 0.5) : Math.min(h - 30, w - 40);
      const ox = logi ? 30 : (w - side) / 2, oy = 14;
      const [v0, v1] = M.view;
      const X = (x) => ox + ((x - v0) / (v1 - v0)) * side, Y = (y) => oy + side - ((y - v0) / (v1 - v0)) * side;
      ctx.strokeStyle = COLORS.grid; ctx.strokeRect(ox, oy, side, side);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(v0), Y(v0)); ctx.lineTo(X(v1), Y(v1)); ctx.stroke();
      ctx.strokeStyle = COLORS.a; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 300; i++) { const x = v0 + ((v1 - v0) * i) / 300, y = M.g(x, r); i ? ctx.lineTo(X(x), Y(Math.max(v0 - 1, Math.min(v1 + 1, y)))) : ctx.moveTo(X(x), Y(y)); }
      ctx.stroke();
      // cobweb
      let x = x0;
      ctx.strokeStyle = 'rgba(255,209,102,0.8)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(X(x), Y(v0));
      for (let k = 0; k < 120; k++) {
        const y = M.g(x, r);
        ctx.lineTo(X(x), Y(y)); ctx.lineTo(X(y), Y(y));
        x = y;
        if (!isFinite(x)) break;
      }
      ctx.stroke();
      ctx.fillStyle = COLORS.c; ctx.beginPath(); ctx.arc(X(x0), Y(v0), 4, 0, TAU); ctx.fill();
      ctx.fillStyle = COLORS.muted; ctx.font = `10px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('y = x', X(v1) - 34, Y(v1) + 4);
      let txt;
      if (logi) {
        const bx = ox + side + 24, bw = Math.max(80, w - bx - 10), bh = side;
        if (!bif || bifW !== Math.round(bw * S.dpr) || bifH !== Math.round(bh * S.dpr)) { bifW = Math.round(bw * S.dpr); bifH = Math.round(bh * S.dpr); bif = makeBif(bifW, bifH); }
        ctx.drawImage(bif, bx, oy, bw, bh);
        ctx.strokeStyle = COLORS.grid; ctx.strokeRect(bx, oy, bw, bh);
        if (r >= 2.5) { const rx = bx + ((r - 2.5) / 1.5) * bw; ctx.strokeStyle = COLORS.c; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(rx, oy); ctx.lineTo(rx, oy + bh); ctx.stroke(); }
        ctx.fillStyle = COLORS.muted; ctx.textAlign = 'center';
        for (const v of [2.5, 3, 3.5, 4]) ctx.fillText(String(v), bx + ((v - 2.5) / 1.5) * bw, oy + bh + 3);
        ctx.textAlign = 'left'; ctx.fillText('分岔图（r 从 2.5 到 4）', bx + 4, oy + 4);
        const xs = 1 - 1 / r, slope = 2 - r;
        let z = 0.5;
        for (let k = 0; k < 3000; k++) z = r * z * (1 - z);
        let period = 0;
        for (let p = 1, y = z; p <= 32 && !period; p++) { y = r * y * (1 - y); if (Math.abs(y - z) < 1e-6) period = p; }
        const regime = r <= 1 ? '轨道趋于 $0$' : r < 3 ? `收敛到不动点 $x^*=1-\\frac1r=${xs.toFixed(4)}$，因为 $|g'(x^*)|=|2-r|=${Math.abs(slope).toFixed(3)}<1$` : period ? `$|g'(x^*)|=${Math.abs(slope).toFixed(3)}>1$，不动点失稳，轨道落入<b>周期 ${period}</b> 的环` : r < 3.5699 ? `$|g'(x^*)|=${Math.abs(slope).toFixed(3)}>1$，不动点失稳，轨道正缓慢趋于周期环` : '已进入混沌区：轨道不收敛也不周期，对初值极其敏感（$r=3.83$ 附近有周期 3 窗口）';
        txt = `蛛网图：从 $x_0$ 出发，竖直走到曲线、水平走到对角线，反复进行就得到 $x_{k+1}=g(x_k)$。$r=${r.toFixed(3)}$：${regime}。$r=3$、$1+\\sqrt6\\approx3.449$… 处周期依次倍增，分岔间隔之比趋于费根鲍姆常数 $4.669\\ldots$。`;
      } else if (key === 'cos') txt = `$x_{k+1}=\\cos x_k$ 收敛到唯一不动点 $x^*=0.739085\\ldots$（当前 $x_{120}=${x.toFixed(6)}$）。在 $x^*$ 处 $|g'(x^*)|=\\sin x^*\\approx0.674<1$，误差每步约乘 $0.674$——线性收敛，蛛网呈螺旋状。`;
      else txt = `$g(x)=\\frac12(x+\\frac2x)$ 是 $x^2-2$ 的牛顿迭代，不动点 $\\sqrt2$ 处 $g'(\\sqrt2)=0$，于是二次收敛：蛛网几乎一步就到（当前 $x=${x.toFixed(12)}$）。`;
      S.setReadout(txt);
    });
    return { destroy: S.destroy };
  },
};

// ---- polynomial interpolation: equispaced vs Chebyshev nodes
const IFUNS = {
  runge: { name: '1/(1+25x²)', f: (x) => 1 / (1 + 25 * x * x) },
  abs: { name: '|x|', f: (x) => Math.abs(x) },
  sin: { name: 'sin(πx)', f: (x) => Math.sin(Math.PI * x) },
  free: { name: '自由拖动节点', f: null },
};
export const interpolation = {
  id: 'interpolation',
  title: '插值多项式与龙格现象',
  mount(host) {
    const S = stage(host, { height: 290 });
    let key = 'runge', n = 11, nodes = 'equi', ys = null, drag = -1;
    const P = plot(S, { x0: -1.1, x1: 1.1, y0: -0.9, y1: 1.5 });
    select(S, { label: '函数', value: key, options: Object.entries(IFUNS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; ys = null; } });
    select(S, { label: '节点', value: nodes, options: [['equi', '等距'], ['cheb', '切比雪夫']], onchange: (v) => { nodes = v; ys = null; } });
    slider(S, { label: '节点数 $n$', min: 2, max: 21, step: 1, value: n, oninput: (v) => { n = v; ys = null; } });
    const xsOf = () => Array.from({ length: n }, (_, k) => (nodes === 'equi' ? -1 + (2 * k) / (n - 1) : -Math.cos(((2 * k + 1) * Math.PI) / (2 * n))));
    S.pointer({
      down: (x, y) => {
        if (key !== 'free') return false;
        const xs = xsOf();
        let best = -1, bd = 16;
        xs.forEach((u, i) => { const d = Math.hypot(P.X(u) - x, P.Y(ys[i]) - y); if (d < bd) { bd = d; best = i; } });
        drag = best; return best >= 0;
      },
      move: (x, y) => { if (drag >= 0) ys[drag] = Math.max(-0.85, Math.min(1.45, P.iy(y))); },
      up: () => { drag = -1; },
    });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { xstep: 0.5, ystep: 0.5 });
      const F = IFUNS[key];
      const xs = xsOf();
      if (!ys || ys.length !== n) ys = xs.map((x, i) => (F.f ? F.f(x) : 0.3 * Math.sin(i * 1.3) + 0.2));
      if (F.f) ys = xs.map(F.f);
      const wts = xs.map((xj, j) => 1 / xs.reduce((p, xk, k) => (k === j ? p : p * (xj - xk)), 1));
      const poly = (x) => {
        let num = 0, den = 0;
        for (let j = 0; j < n; j++) { const d = x - xs[j]; if (Math.abs(d) < 1e-14) return ys[j]; const t = wts[j] / d; num += t * ys[j]; den += t; }
        return num / den;
      };
      if (F.f) P.curve(ctx, F.f, { color: 'rgba(255,255,255,0.75)', width: 2, from: -1, to: 1 });
      ctx.save(); ctx.beginPath(); ctx.rect(0, P.Y(1.5), S.w, P.Y(-0.9) - P.Y(1.5)); ctx.clip();
      P.curve(ctx, poly, { color: COLORS.b, width: 2.2, from: -1, to: 1, n: 600 });
      ctx.restore();
      xs.forEach((x, i) => P.dot(ctx, x, ys[i], { r: key === 'free' ? 5.5 : 4, color: COLORS.d }));
      let txt = `$${n}$ 个${nodes === 'equi' ? '等距' : '切比雪夫'}节点上的 $${n - 1}$ 次插值多项式（金）。`;
      if (F.f) {
        let err = 0; for (let i = 0; i <= 800; i++) { const x = -1 + i / 400; err = Math.max(err, Math.abs(poly(x) - F.f(x))); }
        txt += `最大误差 $\\max|f-p|=${err < 1e-3 ? err.toExponential(2) : err.toFixed(3)}$。`;
        if (key === 'runge') txt += nodes === 'equi' ? '龙格现象：等距节点越多，端点附近振荡越剧烈，误差趋于无穷。改用切比雪夫节点 $x_k=\\cos\\frac{(2k+1)\\pi}{2n}$（在端点更密）误差就趋于 $0$。' : '切比雪夫节点使 $\\prod(x-x_k)$ 的最大值最小（$=2^{1-n}$），误差随 $n$ 指数下降。';
        else if (key === 'abs') txt += '$|x|$ 在 $0$ 处不可导，收敛较慢；等距节点时端点同样会振荡。';
        else txt += '$\\sin\\pi x$ 是整函数，两种节点都收敛得飞快。';
      } else txt += '拖动节点：过 $n$ 个横坐标不同的点恰有一个次数 $\\le n-1$ 的多项式（拉格朗日插值），$p(x)=\\sum y_j\\ell_j(x)$，这里用数值稳定的重心公式计算。';
      S.setReadout(txt);
    });
    return { destroy: S.destroy };
  },
};

// ---- gradient descent on a contour map
const GFUNS = {
  bowl: { name: '狭长碗 (x² + 10y²)/2', f: (x, y) => (x * x + 10 * y * y) / 2, g: (x, y) => [x, 10 * y], view: { x0: -3.2, x1: 3.2, y0: -2, y1: 2 }, eta: -0.8, start: [-2.8, 1.2], min: [[0, 0]], note: '条件数 $\\kappa=10$：步长须 $<\\frac2{L}=0.2$，否则发散；步长接近上限时沿陡峭方向来回之字形。' },
  rosen: { name: '罗森布罗克函数', f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2, g: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)], view: { x0: -2, x1: 2, y0: -1, y1: 3 }, eta: -2.8, start: [-1.5, 2.5], min: [[1, 1]], note: '最小值 $(1,1)$ 藏在弯曲的香蕉形峡谷底部：梯度几乎垂直于谷底，纯梯度下降很慢，动量能明显加速。' },
  wells: { name: '双井 (x²−1)² + y²/2 + 0.3x', f: (x, y) => (x * x - 1) ** 2 + 0.5 * y * y + 0.3 * x, g: (x, y) => [4 * x * (x * x - 1) + 0.3, y], view: { x0: -2, x1: 2, y0: -1.6, y1: 1.6 }, eta: -1.3, start: [1.7, 1.3], min: [[-1.036, 0], [0.96, 0]], note: '两个局部极小，右边那个较高：从哪里出发决定落到哪个坑——梯度下降只保证找到局部极小（点击换起点试试）。' },
};
export const gradientDescent = {
  id: 'gradient-descent',
  title: '梯度下降',
  mount(host) {
    const S = stage(host, { height: 300, hint: '点击设置起点' });
    let key = 'bowl', le = GFUNS.bowl.eta, beta = 0, start = GFUNS.bowl.start.slice(), path = [], shown = 0, img = null, imgKey = '';
    const P = plot(S, { ...GFUNS.bowl.view, equal: true, pad: 10 });
    select(S, { label: '函数', value: key, options: Object.entries(GFUNS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; P.view(GFUNS[v].view); start = GFUNS[v].start.slice(); le = GFUNS[v].eta; ls.set(le); run(); img = null; } });
    const ls = slider(S, { label: '步长 $\\eta$', min: -4, max: -0.2, step: 0.05, value: le, fmt: (v) => (10 ** v).toPrecision(2), oninput: (v) => { le = v; run(); } });
    slider(S, { label: '动量 $\\beta$', min: 0, max: 0.95, step: 0.05, value: beta, fmt: (v) => v.toFixed(2), oninput: (v) => { beta = v; run(); } });
    const run = () => {
      const G = GFUNS[key], eta = 10 ** le;
      let [x, y] = start, vx = 0, vy = 0;
      path = [[x, y]];
      for (let i = 0; i < 600; i++) {
        const [gx, gy] = G.g(x, y);
        vx = beta * vx - eta * gx; vy = beta * vy - eta * gy;
        x += vx; y += vy;
        if (!isFinite(x) || Math.abs(x) > 1e3 || Math.abs(y) > 1e3) { path.push([x, y]); break; }
        path.push([x, y]);
        if (Math.hypot(gx, gy) < 1e-7) break;
      }
      shown = 1;
    };
    run();
    S.pointer({ down: (x, y) => { start = [P.ix(x), P.iy(y)]; run(); return true; } });
    const heat = () => {
      const G = GFUNS[key], W = Math.ceil(S.w / 2), H = Math.ceil(S.h / 2);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'), im = g.createImageData(W, H);
      let lo = Infinity, hi = -Infinity;
      const vals = new Float64Array(W * H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const v = G.f(P.ix(i * 2 + 1), P.iy(j * 2 + 1)); vals[j * W + i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      for (let k = 0; k < W * H; k++) {
        const t = Math.log(1 + (vals[k] - lo)) / Math.log(1 + (hi - lo));
        const band = (t * 18) % 1;
        const line = band < 0.06 ? 1 : 0;
        const hue = 250 - t * 210;
        const l = 0.08 + (1 - t) * 0.16 + line * 0.18;
        const [r, gg, b] = hsl(hue / 360, 0.7, l);
        im.data[k * 4] = r; im.data[k * 4 + 1] = gg; im.data[k * 4 + 2] = b; im.data[k * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return c;
    };
    S.loop((dt) => {
      if (shown < path.length) { shown = Math.min(path.length, shown + Math.max(1, Math.round(dt / 16))); S.dirty = true; }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx, w, h } = S;
      const ik = `${key}|${w}|${h}`;
      if (!img || imgKey !== ik) { img = heat(); imgKey = ik; }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, w, h);
      const G = GFUNS[key];
      for (const m of G.min) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; const X = P.X(m[0]), Y = P.Y(m[1]); ctx.beginPath(); ctx.moveTo(X - 5, Y); ctx.lineTo(X + 5, Y); ctx.moveTo(X, Y - 5); ctx.lineTo(X, Y + 5); ctx.stroke(); }
      ctx.strokeStyle = COLORS.b; ctx.lineWidth = 1.8; ctx.beginPath();
      for (let i = 0; i < shown; i++) { const [x, y] = path[i]; const X = P.X(Math.max(-1e4, Math.min(1e4, x))), Y = P.Y(Math.max(-1e4, Math.min(1e4, y))); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.stroke();
      for (let i = 0; i < shown; i += Math.max(1, Math.floor(shown / 40))) { const [x, y] = path[i]; if (Math.abs(x) < 1e3) { ctx.fillStyle = COLORS.b; ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), 2, 0, TAU); ctx.fill(); } }
      const [sx, sy] = start; ctx.fillStyle = COLORS.c; ctx.beginPath(); ctx.arc(P.X(sx), P.Y(sy), 4.5, 0, TAU); ctx.fill();
      const [ex, ey] = path[shown - 1];
      const div = !isFinite(ex) || Math.abs(ex) > 1e3 || Math.abs(ey) > 1e3;
      if (!div) { const [gx, gy] = G.g(ex, ey); const L = Math.hypot(gx, gy); if (L > 1e-9) arrow(ctx, P.X(ex), P.Y(ey), P.X(ex) - (gx / L) * 26, P.Y(ey) + (gy / L) * 26, { color: '#fff', width: 1.5, head: 7 }); }
      S.setReadout(`$\\boldsymbol x_{k+1}=\\boldsymbol x_k-\\eta\\nabla f(\\boldsymbol x_k)${beta ? '+\\beta(\\boldsymbol x_k-\\boldsymbol x_{k-1})' : ''}$，$\\eta=${(10 ** le).toPrecision(2)}$${beta ? `，$\\beta=${beta.toFixed(2)}$` : ''}。第 $${shown - 1}$ 步：${div ? '<b>发散</b>——步长太大。' : `$f=${G.f(ex, ey).toPrecision(5)}$。`}白箭头是负梯度方向（垂直于等高线）。${G.note}`);
    });
    return { destroy: S.destroy };
  },
};
function hsl(h, s, l) {
  const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}

// ---- linear programming: max c·x on x + y ≤ 4, 3x + y ≤ 6, x, y ≥ 0
export const linearProgramming = {
  id: 'linear-programming',
  title: '线性规划：等值线平移',
  mount(host) {
    const S = stage(host, { height: 300 });
    let c1 = 3, c2 = 2, s = 0, play = true;
    const P = plot(S, { x0: -0.6, x1: 5, y0: -0.6, y1: 5, equal: true });
    slider(S, { label: '$c_1$', min: -2, max: 5, step: 0.1, value: c1, fmt: (v) => v.toFixed(1), oninput: (v) => { c1 = v; } });
    slider(S, { label: '$c_2$', min: -2, max: 5, step: 0.1, value: c2, fmt: (v) => v.toFixed(1), oninput: (v) => { c2 = v; } });
    checkbox(S, '平移等值线', play, (v) => { play = v; });
    const V = [[0, 0], [2, 0], [1, 3], [0, 4]];
    S.loop((dt) => {
      if (play) s += dt * 0.00035;
      else if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { xstep: 1, ystep: 1 });
      // constraint lines
      P.line(ctx, -1, 5, 5, -1, { color: 'rgba(127,180,255,0.35)', width: 1 });
      P.line(ctx, 0, 6, 2.2, -0.6, { color: 'rgba(255,154,213,0.35)', width: 1 });
      P.text(ctx, 'x + y = 4', 3.6, 0.4, { color: COLORS.a, size: 11 });
      P.text(ctx, '3x + y = 6', 1.75, 1.3, { color: COLORS.f, size: 11 });
      ctx.fillStyle = 'rgba(78,227,193,0.16)'; ctx.strokeStyle = COLORS.d; ctx.lineWidth = 2;
      ctx.beginPath(); V.forEach(([x, y], i) => (i ? ctx.lineTo(P.X(x), P.Y(y)) : ctx.moveTo(P.X(x), P.Y(y)))); ctx.closePath(); ctx.fill(); ctx.stroke();
      const vals = V.map(([x, y]) => c1 * x + c2 * y);
      const best = Math.max(...vals), worst = Math.min(...vals);
      const opt = V.filter((_, i) => Math.abs(vals[i] - best) < 1e-9);
      // sweeping iso-line c1 x + c2 y = level
      const zero = Math.hypot(c1, c2) < 1e-9;
      if (!zero) {
        const span = best - worst || 1;
        const ph = (s % 1.3) / 1.0;
        const level = worst - 0.15 * span + Math.min(1.15, ph) * 1.15 * span;
        const n = [c1, c2], L = Math.hypot(...n), base = [(n[0] * level) / (L * L), (n[1] * level) / (L * L)], dir = [-n[1] / L, n[0] / L];
        const inside = level <= best + 1e-9;
        P.line(ctx, base[0] - dir[0] * 20, base[1] - dir[1] * 20, base[0] + dir[0] * 20, base[1] + dir[1] * 20, { color: inside ? COLORS.b : 'rgba(255,209,102,0.35)', width: 2, dash: inside ? null : [6, 5] });
        // gradient arrow from the region's centroid
        const g0 = [0.8, 1.6];
        arrow(ctx, P.X(g0[0]), P.Y(g0[1]), P.X(g0[0] + (c1 / L) * 0.9), P.Y(g0[1] + (c2 / L) * 0.9), { color: COLORS.b, width: 2 });
        P.text(ctx, 'c', g0[0] + (c1 / L) * 0.9, g0[1] + (c2 / L) * 0.9, { color: COLORS.b, dx: 6, dy: -6, size: 12 });
        P.text(ctx, `${c1.toFixed(1)}x + ${c2.toFixed(1)}y = ${level.toFixed(2)}`, 3.0, 4.6, { color: COLORS.b, size: 11 });
      }
      V.forEach(([x, y], i) => {
        const isOpt = opt.includes(V[i]);
        P.dot(ctx, x, y, { r: isOpt ? 6 : 4, color: isOpt ? COLORS.b : '#fff', ring: isOpt ? '#fff' : null });
        P.text(ctx, `(${x},${y}) → ${+vals[i].toFixed(2)}`, x, y, { color: isOpt ? COLORS.b : COLORS.muted, dx: 9, dy: x === 0 && y === 0 ? 10 : -10, size: 11 });
      });
      if (opt.length === 2) P.line(ctx, opt[0][0], opt[0][1], opt[1][0], opt[1][1], { color: COLORS.b, width: 4 });
      const txt = zero ? '目标函数为常数，所有可行点都最优。' : `$\\max\\ ${c1.toFixed(1)}x+${c2.toFixed(1)}y$，约束 $x+y\\le4$，$3x+y\\le6$，$x,y\\ge0$。把等值线沿 $\\boldsymbol c$ 方向平移，最后离开可行域（绿色凸多边形）的地方就是最优解：${opt.length === 2 ? `等值线与一条边平行，<b>整条边</b> $(${opt[0]})$–$(${opt[1]})$ 都最优` : `顶点 $(${opt[0]})$`}，最优值 $${+best.toFixed(2)}$。线性目标的最优值总在顶点处取到——单纯形法就是沿顶点爬升。`;
      S.setReadout(txt);
    });
    return { destroy: S.destroy };
  },
};
