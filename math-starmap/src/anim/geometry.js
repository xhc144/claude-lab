// Plane geometry: conics from focus and directrix, the convex hull (Andrew's monotone chain),
// curvature and the osculating circle.
import { stage, slider, select, button, checkbox, plot, arrow, COLORS, TAU, FONT } from './kit.js';

// ---- conics: |PF| = e·|PD|, focus at the origin, directrix x = −ℓ/e, semi-latus rectum ℓ
export const conics = {
  id: 'conics',
  title: '圆锥曲线：焦点与准线',
  mount(host) {
    const S = stage(host, { height: 300 });
    const L = 1.4;
    let e = 0.6, s = 0, second = true, play = true;
    const P = plot(S, { x0: -4.2, x1: 6.2, y0: -3.3, y1: 3.3, equal: true });
    slider(S, { label: '离心率 $e$', min: 0, max: 2, step: 0.01, value: e, fmt: (v) => v.toFixed(2), oninput: (v) => { e = v; } });
    checkbox(S, '第二焦点', second, (v) => { second = v; });
    checkbox(S, '动点', play, (v) => { play = v; });
    S.loop((dt) => {
      if (play) s += dt * 0.0007;
      else if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { xstep: 1, ystep: 1, labels: false });
      const ee = Math.abs(e - 1) < 0.005 ? 1 : e;
      const kind = ee < 0.005 ? '圆' : ee < 1 ? '椭圆' : ee === 1 ? '抛物线' : '双曲线';
      const dx = ee > 0.005 ? -L / ee : null;
      // the curve (both branches): polar r = ℓ/(1 − e cos θ), r may be negative for e > 1
      ctx.strokeStyle = COLORS.a; ctx.lineWidth = 2.2;
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k <= 1440; k++) {
        const th = (k / 1440) * TAU;
        const den = 1 - ee * Math.cos(th);
        const rr = L / den;
        if (Math.abs(den) < 0.02 || Math.abs(rr) > 40) { pen = false; continue; }
        const x = rr * Math.cos(th), y = rr * Math.sin(th);
        if (pen) ctx.lineTo(P.X(x), P.Y(y)); else ctx.moveTo(P.X(x), P.Y(y));
        pen = true;
      }
      ctx.stroke();
      // directrix
      if (dx !== null) { P.line(ctx, dx, -10, dx, 10, { color: COLORS.b, width: 1.4, dash: [6, 5] }); P.text(ctx, '准线', dx, 3.0, { color: COLORS.b, dx: 6, size: 11 }); }
      // geometry of the second focus / asymptotes
      let a = 0, c = 0, F2 = null;
      if (ee > 0.005 && ee < 1) { a = L / (1 - ee * ee); c = ee * a; F2 = [2 * c, 0]; }
      if (ee > 1) {
        a = L / (ee * ee - 1); c = ee * a; F2 = [-2 * c, 0];
        const b = a * Math.sqrt(ee * ee - 1), cx = -c;
        for (const sg of [1, -1]) P.line(ctx, cx - 10, -sg * (b / a) * 10, cx + 10, sg * (b / a) * 10, { color: 'rgba(255,255,255,0.18)', width: 1, dash: [3, 4] });
      }
      // moving point
      let th;
      if (ee < 1) th = s % TAU;
      else {
        const lim = Math.acos(Math.min(1, (1 - L / 5.5) / ee));
        th = Math.PI + (Math.PI - lim) * Math.sin(s * 1.3);
      }
      const rp = L / (1 - ee * Math.cos(th));
      const Px = rp * Math.cos(th), Py = rp * Math.sin(th);
      const PF = Math.hypot(Px, Py);
      P.dot(ctx, 0, 0, { r: 4.5, color: COLORS.d });
      P.text(ctx, 'F', 0, 0, { color: COLORS.d, dx: 6, dy: 12, size: 12 });
      if (F2 && second) { P.dot(ctx, F2[0], F2[1], { r: 3.5, color: COLORS.e }); P.text(ctx, "F'", F2[0], 0, { color: COLORS.e, dx: 6, dy: 12, size: 12 }); P.line(ctx, Px, Py, F2[0], F2[1], { color: COLORS.e, width: 1.4 }); }
      P.line(ctx, Px, Py, 0, 0, { color: COLORS.d, width: 2 });
      if (dx !== null) P.line(ctx, Px, Py, dx, Py, { color: COLORS.b, width: 2 });
      P.dot(ctx, Px, Py, { r: 5, color: '#fff' });
      P.text(ctx, 'P', Px, Py, { dx: 8, dy: -10, size: 12 });
      const PD = dx !== null ? Math.abs(Px - dx) : Infinity;
      let txt = `$e=${ee.toFixed(2)}$：<b>${kind}</b>。`;
      if (ee < 0.005) txt += `$e=0$ 时准线退到无穷远，曲线是以焦点为圆心、半径 $${L}$ 的圆。`;
      else {
        txt += `$|PF|=${PF.toFixed(2)}$，$|PD|=${PD.toFixed(2)}$，$\\dfrac{|PF|}{|PD|}=${(PF / PD).toFixed(3)}=e$——到焦点与到准线距离之比恒为离心率。`;
        if (F2) {
          const PF2 = Math.hypot(Px - F2[0], Py - F2[1]);
          txt += ee < 1 ? `且 $|PF|+|PF'|=${(PF + PF2).toFixed(2)}=2a$。` : `且 $\\big||PF|-|PF'|\\big|=${Math.abs(PF - PF2).toFixed(2)}=2a$，虚线是渐近线。`;
        } else txt += '抛物线：到焦点与到准线距离相等。';
      }
      S.setReadout(txt);
    });
    return { destroy: S.destroy };
  },
};

// ---- convex hull
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function monotoneChain(pts) {
  const p = pts.slice().sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const steps = [];
  const half = (seq, label) => {
    const st = [];
    for (const q of seq) {
      while (st.length >= 2 && cross(st[st.length - 2], st[st.length - 1], q) <= 0) {
        steps.push({ label, stack: st.slice(), cur: q, pop: true });
        st.pop();
      }
      st.push(q);
      steps.push({ label, stack: st.slice(), cur: q, pop: false });
    }
    return st;
  };
  const lower = half(p, '下凸壳');
  const upper = half(p.slice().reverse(), '上凸壳');
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  return { hull, steps, lower };
}

export const convexHull = {
  id: 'convex-hull',
  title: '凸包：单调链算法',
  mount(host) {
    const S = stage(host, { height: 300, hint: '点击添加点 · 拖动移动' });
    const P = plot(S, { x0: -1, x1: 1, y0: -1, y1: 1, equal: true, pad: 18 });
    let pts = [], drag = -1, anim = null, k = 0, acc = 0;
    const rnd = (n) => {
      pts = [];
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * 0.85; pts.push([rr * Math.cos(a) * 1.3, rr * Math.sin(a)]); }
      anim = null;
    };
    rnd(18);
    button(S, '随机点', () => rnd(14 + Math.floor(Math.random() * 16)));
    button(S, '清空', () => { pts = []; anim = null; });
    button(S, '演示算法', () => { if (pts.length >= 3) { anim = monotoneChain(pts); k = 0; acc = 0; } });
    S.pointer({
      down: (x, y) => {
        const q = [P.ix(x), P.iy(y)];
        let best = -1, bd = 12;
        pts.forEach((p, i) => { const d = Math.hypot(P.X(p[0]) - x, P.Y(p[1]) - y); if (d < bd) { bd = d; best = i; } });
        anim = null;
        if (best < 0) { pts.push(q); drag = pts.length - 1; } else drag = best;
        return true;
      },
      move: (x, y) => { if (drag >= 0) pts[drag] = [P.ix(x), P.iy(y)]; },
      up: () => { drag = -1; },
    });
    S.loop((dt) => {
      if (anim) {
        acc += dt;
        if (acc > 320) { acc = 0; if (k < anim.steps.length) k++; S.dirty = true; }
      }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { labels: false, xstep: 0.5, ystep: 0.5 });
      const { hull } = pts.length >= 3 ? monotoneChain(pts) : { hull: pts.slice() };
      const done = !anim || k >= anim.steps.length;
      if (done && hull.length >= 3) {
        ctx.fillStyle = 'rgba(127,180,255,0.12)'; ctx.strokeStyle = COLORS.a; ctx.lineWidth = 2;
        ctx.beginPath(); hull.forEach((p, i) => (i ? ctx.lineTo(P.X(p[0]), P.Y(p[1])) : ctx.moveTo(P.X(p[0]), P.Y(p[1])))); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      let info = '';
      if (!done) {
        const st = anim.steps[Math.max(0, k - 1)];
        if (st.label === '上凸壳') {
          ctx.strokeStyle = 'rgba(127,180,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
          anim.lower.forEach((p, i) => (i ? ctx.lineTo(P.X(p[0]), P.Y(p[1])) : ctx.moveTo(P.X(p[0]), P.Y(p[1])))); ctx.stroke();
        }
        ctx.strokeStyle = COLORS.b; ctx.lineWidth = 2.4; ctx.beginPath();
        st.stack.forEach((p, i) => (i ? ctx.lineTo(P.X(p[0]), P.Y(p[1])) : ctx.moveTo(P.X(p[0]), P.Y(p[1])))); ctx.stroke();
        const top = st.stack[st.stack.length - 1];
        if (st.pop) P.line(ctx, top[0], top[1], st.cur[0], st.cur[1], { color: COLORS.c, width: 2, dash: [4, 3] });
        P.dot(ctx, st.cur[0], st.cur[1], { r: 6, color: st.pop ? COLORS.c : COLORS.b, ring: '#fff' });
        info = `第 $${k}$ / $${anim.steps.length}$ 步（${st.label}）：${st.pop ? '新点使栈顶两点构成<b>右转</b>（叉积 $\\le0$），弹出栈顶。' : '左转，新点入栈。'}点已按 $x$ 坐标排序，先自左向右求下凸壳，再自右向左求上凸壳。`;
      }
      const onHull = new Set(hull);
      for (const p of pts) P.dot(ctx, p[0], p[1], { r: onHull.has(p) && done ? 4.5 : 3.2, color: onHull.has(p) && done ? COLORS.a : 'rgba(255,255,255,0.8)' });
      if (done) {
        let area = 0;
        for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; area += a[0] * b[1] - a[1] * b[0]; }
        info = pts.length < 3 ? '至少需要 3 个点。点击画布添加。' : `$${pts.length}$ 个点，凸包有 $${hull.length}$ 个顶点，面积 $${(Math.abs(area) / 2).toFixed(3)}$。凸包是包含全部点的最小凸集——像把橡皮筋套在钉子上松手。单调链算法：排序 $O(n\\log n)$，之后每个点至多进栈、出栈各一次。`;
      }
      S.setReadout(info);
    });
    return { destroy: S.destroy };
  },
};

// ---- curvature and the osculating circle
function clothoidTable() {
  const n = 1400, s0 = -4.2, s1 = 4.2, h = (s1 - s0) / n;
  const xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
  // integrate from s = 0 outwards so that the curve passes through the origin
  const mid = n / 2;
  for (let dir of [1, -1]) {
    let x = 0, y = 0;
    for (let i = 0; i < mid; i++) {
      const a = (mid + dir * i) * h + s0, b = a + dir * h, m = (a + b) / 2;
      const f = (s) => [Math.cos((s * s) / 2), Math.sin((s * s) / 2)];
      const fa = f(a), fb = f(b), fm = f(m);
      x += (dir * h * (fa[0] + 4 * fm[0] + fb[0])) / 6;
      y += (dir * h * (fa[1] + 4 * fm[1] + fb[1])) / 6;
      xs[mid + dir * (i + 1)] = x; ys[mid + dir * (i + 1)] = y;
    }
  }
  return (t) => {
    const u = Math.max(0, Math.min(n - 1e-9, (t - s0) / h)), i = Math.floor(u), f = u - i;
    return [xs[i] * (1 - f) + xs[i + 1] * f, ys[i] * (1 - f) + ys[i + 1] * f];
  };
}

const CURVES = {
  ellipse: { name: '椭圆', t0: 0, t1: TAU, view: { x0: -2.6, x1: 2.6, y0: -1.8, y1: 1.8 }, p: (t) => [2 * Math.cos(t), 1.2 * Math.sin(t)], d1: (t) => [-2 * Math.sin(t), 1.2 * Math.cos(t)], d2: (t) => [-2 * Math.cos(t), -1.2 * Math.sin(t)], note: '椭圆在长轴端点最弯（$\\kappa=a/b^2$），在短轴端点最平（$\\kappa=b/a^2$）。' },
  parabola: { name: '抛物线', t0: -2.2, t1: 2.2, view: { x0: -2.6, x1: 2.6, y0: -0.6, y1: 2.8 }, p: (t) => [t, (t * t) / 2], d1: (t) => [1, t], d2: () => [0, 1], note: '$y=\\frac{x^2}2$ 的曲率 $\\kappa=(1+x^2)^{-3/2}$，顶点处最大（$=1$），远处趋于 $0$。' },
  sine: { name: '正弦曲线', t0: -TAU / 2 - 1, t1: TAU / 2 + 1, view: { x0: -4.3, x1: 4.3, y0: -2.2, y1: 2.2 }, p: (t) => [t, Math.sin(t)], d1: (t) => [1, Math.cos(t)], d2: (t) => [0, -Math.sin(t)], note: '拐点处 $\\kappa=0$，密切圆退化为切线；曲率的符号表示向左还是向右弯。' },
  clothoid: { name: '回旋线（欧拉螺线）', t0: -4.1, t1: 4.1, view: { x0: -1.25, x1: 1.25, y0: -1.0, y1: 1.0 }, p: null, d1: (t) => [Math.cos((t * t) / 2), Math.sin((t * t) / 2)], d2: (t) => [-t * Math.sin((t * t) / 2), t * Math.cos((t * t) / 2)], note: '回旋线的曲率与弧长成正比：$\\kappa=s$。公路、铁路的缓和曲线用它让离心加速度均匀增加。' },
};

export const curvature = {
  id: 'curvature',
  title: '曲率与密切圆',
  mount(host) {
    const S = stage(host, { height: 300, hint: '拖动曲线上的点' });
    CURVES.clothoid.p = clothoidTable();
    let key = 'ellipse', t = 0.6, auto = true, comb = false, drag = false;
    const P = plot(S, { ...CURVES.ellipse.view, equal: true });
    select(S, { label: '曲线', value: key, options: Object.entries(CURVES).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; P.view(CURVES[v].view); const C = CURVES[v]; t = C.t0 + (C.t1 - C.t0) * 0.62; } });
    checkbox(S, '自动', auto, (v) => { auto = v; });
    checkbox(S, '曲率梳', comb, (v) => { comb = v; });
    const kappa = (C, u) => { const [x1, y1] = C.d1(u), [x2, y2] = C.d2(u); return (x1 * y2 - y1 * x2) / Math.pow(x1 * x1 + y1 * y1, 1.5); };
    S.pointer({
      down: (x, y) => {
        const C = CURVES[key];
        let best = null, bd = 30;
        for (let k = 0; k <= 600; k++) { const u = C.t0 + ((C.t1 - C.t0) * k) / 600; const p = C.p(u); const d = Math.hypot(P.X(p[0]) - x, P.Y(p[1]) - y); if (d < bd) { bd = d; best = u; } }
        if (best === null) return false;
        t = best; drag = true; auto = false; return true;
      },
      move: (x, y) => {
        if (!drag) return;
        const C = CURVES[key];
        let best = t, bd = Infinity;
        for (let k = 0; k <= 600; k++) { const u = C.t0 + ((C.t1 - C.t0) * k) / 600; const p = C.p(u); const d = Math.hypot(P.X(p[0]) - x, P.Y(p[1]) - y); if (d < bd) { bd = d; best = u; } }
        t = best;
      },
      up: () => { drag = false; },
    });
    let dirn = 1;
    S.loop((dt) => {
      const C = CURVES[key];
      if (auto) {
        t += dirn * dt * 0.0004 * (C.t1 - C.t0) / 3;
        if (key === 'ellipse') t = ((t - C.t0) % TAU) + C.t0;
        else if (t > C.t1 - 0.05 || t < C.t0 + 0.05) { dirn = -dirn; t = Math.max(C.t0 + 0.05, Math.min(C.t1 - 0.05, t)); }
      } else if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { labels: false });
      if (comb) {
        ctx.strokeStyle = 'rgba(196,155,255,0.45)'; ctx.lineWidth = 1;
        const tips = [];
        for (let k = 0; k <= 160; k++) {
          const u = C.t0 + ((C.t1 - C.t0) * k) / 160, p = C.p(u), [x1, y1] = C.d1(u), v = Math.hypot(x1, y1), kk = kappa(C, u);
          const sc = (key === 'clothoid' ? 0.08 : 0.35) * kk;
          const q = [p[0] - (y1 / v) * sc, p[1] + (x1 / v) * sc];
          ctx.beginPath(); ctx.moveTo(P.X(p[0]), P.Y(p[1])); ctx.lineTo(P.X(q[0]), P.Y(q[1])); ctx.stroke();
          tips.push(q);
        }
        ctx.strokeStyle = COLORS.e; ctx.beginPath(); tips.forEach((q, i) => (i ? ctx.lineTo(P.X(q[0]), P.Y(q[1])) : ctx.moveTo(P.X(q[0]), P.Y(q[1])))); ctx.stroke();
      }
      P.param(ctx, (u) => C.p(u)[0], (u) => C.p(u)[1], C.t0, C.t1, { color: 'rgba(255,255,255,0.85)', width: 2, n: 700 });
      const p = C.p(t), [x1, y1] = C.d1(t), v = Math.hypot(x1, y1), kk = kappa(C, t);
      const T = [x1 / v, y1 / v], N = [-T[1], T[0]];
      P.line(ctx, p[0] - T[0] * 9, p[1] - T[1] * 9, p[0] + T[0] * 9, p[1] + T[1] * 9, { color: 'rgba(127,180,255,0.45)', width: 1.2 });
      if (Math.abs(kk) > 1e-4) {
        const R = 1 / kk, c = [p[0] + N[0] * R, p[1] + N[1] * R];
        ctx.strokeStyle = COLORS.b; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(P.X(c[0]), P.Y(c[1]), Math.abs(R) * P.sx, 0, TAU); ctx.stroke();
        P.line(ctx, p[0], p[1], c[0], c[1], { color: 'rgba(255,209,102,0.6)', width: 1.2, dash: [4, 3] });
        P.dot(ctx, c[0], c[1], { r: 3, color: COLORS.b });
      }
      arrow(ctx, P.X(p[0]), P.Y(p[1]), P.X(p[0] + T[0] * 0.5), P.Y(p[1] + T[1] * 0.5), { color: COLORS.a, width: 2 });
      arrow(ctx, P.X(p[0]), P.Y(p[1]), P.X(p[0] + N[0] * 0.5), P.Y(p[1] + N[1] * 0.5), { color: COLORS.d, width: 2 });
      P.dot(ctx, p[0], p[1], { r: 5, color: '#fff' });
      ctx.fillStyle = COLORS.muted; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('蓝 切向量 · 绿 法向量 · 金 密切圆', 10, 8);
      S.setReadout(`$\\kappa=\\dfrac{x'y''-y'x''}{(x'^2+y'^2)^{3/2}}=${kk.toFixed(3)}$，曲率半径 $R=\\frac1{|\\kappa|}=${Math.abs(kk) > 1e-4 ? (1 / Math.abs(kk)).toFixed(3) : '\\infty'}$。密切圆与曲线在该点二阶相切：同点、同切线、同曲率。${C.note}`);
    });
    return { destroy: S.destroy };
  },
};
