// Linear maps (grid, eigenvectors, determinant), the power method, and the dihedral group.
import { stage, slider, select, button, checkbox, plot, arrow, COLORS, TAU, FONT } from './kit.js';

function eig2(a, b, c, d) {
  const tr = a + d, det = a * d - b * c, disc = tr * tr - 4 * det;
  if (disc < -1e-12) return { real: false, tr, det, re: tr / 2, im: Math.sqrt(-disc) / 2 };
  const s = Math.sqrt(Math.max(0, disc));
  const l1 = (tr + s) / 2, l2 = (tr - s) / 2;
  const vec = (l) => { if (Math.abs(b) > 1e-9) return [b, l - a]; if (Math.abs(c) > 1e-9) return [l - d, c]; return Math.abs(l - a) < 1e-9 ? [1, 0] : [0, 1]; };
  return { real: true, tr, det, l1, l2, v1: vec(l1), v2: vec(l2) };
}

const PRESETS = {
  custom: ['自定义', null],
  rot: ['旋转 60°', [0.5, -0.866, 0.866, 0.5]],
  shear: ['剪切', [1, 1, 0, 1]],
  stretch: ['沿对角线伸缩', [1.5, 0.5, 0.5, 1.5]],
  reflect: ['反射', [0, 1, 1, 0]],
  proj: ['投影（秩 1）', [1, 0, 0, 0]],
  sing: ['奇异（det = 0）', [1, 2, 0.5, 1]],
};

export const linearMap = {
  id: 'linear-map',
  title: '线性变换、特征向量与行列式',
  mount(host) {
    const S = stage(host, { height: 300 });
    let M = [1.5, 0.5, 0.5, 1.5], t = 1, playing = 0;
    const P = plot(S, { x0: -3.2, x1: 3.2, y0: -2.4, y1: 2.4, equal: true });
    const sliders = [];
    const sel = select(S, { label: '预设', value: 'stretch', options: Object.entries(PRESETS).map(([k, v]) => [k, v[0]]), onchange: (v) => { if (PRESETS[v][1]) { M = [...PRESETS[v][1]]; sliders.forEach((s, k) => s.set(M[k])); animate(); } } });
    ['$a$', '$b$', '$c$', '$d$'].forEach((label, k) => sliders.push(slider(S, { label, min: -2, max: 2, step: 0.05, value: M[k], fmt: (v) => v.toFixed(2), oninput: (v) => { M[k] = v; sel.value = 'custom'; t = 1; } })));
    const animate = () => { t = 0; playing = 1; };
    button(S, '播放变换', animate);
    S.loop((dt) => {
      if (playing) { t = Math.min(1, t + dt / 1400); if (t >= 1) playing = 0; S.dirty = true; }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const [a, b, c, d] = M.map((m, k) => (k === 0 || k === 3 ? 1 : 0) * (1 - e) + m * e);
      const T = (x, y) => [a * x + b * y, c * x + d * y];
      // original grid (faint) and transformed grid
      ctx.lineWidth = 1;
      for (const [col, f] of [['rgba(150,172,255,0.08)', (x, y) => [x, y]], ['rgba(127,180,255,0.35)', T]]) {
        ctx.strokeStyle = col; ctx.beginPath();
        for (let k = -6; k <= 6; k++) {
          let [x1, y1] = f(k, -6), [x2, y2] = f(k, 6); ctx.moveTo(P.X(x1), P.Y(y1)); ctx.lineTo(P.X(x2), P.Y(y2));
          [x1, y1] = f(-6, k); [x2, y2] = f(6, k); ctx.moveTo(P.X(x1), P.Y(y1)); ctx.lineTo(P.X(x2), P.Y(y2));
        }
        ctx.stroke();
      }
      // unit square → parallelogram
      const det = a * d - b * c;
      ctx.fillStyle = det >= 0 ? 'rgba(255,209,102,0.25)' : 'rgba(255,138,101,0.28)';
      ctx.beginPath(); [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([x, y], k) => { const [u, v] = T(x, y); k ? ctx.lineTo(P.X(u), P.Y(v)) : ctx.moveTo(P.X(u), P.Y(v)); }); ctx.closePath(); ctx.fill();
      // eigen-directions of the final matrix
      const E = eig2(...M);
      if (E.real && t >= 1) {
        for (const [v, l] of [[E.v1, E.l1], [E.v2, E.l2]]) {
          const n = Math.hypot(...v) || 1; const u = [v[0] / n, v[1] / n];
          P.line(ctx, -6 * u[0], -6 * u[1], 6 * u[0], 6 * u[1], { color: 'rgba(78,227,193,0.5)', width: 1.2, dash: [5, 5] });
          arrow(ctx, P.X(0), P.Y(0), P.X(u[0] * l), P.Y(u[1] * l), { color: COLORS.d, width: 2.4 });
        }
      }
      const [i1, i2] = T(1, 0), [j1, j2] = T(0, 1);
      arrow(ctx, P.X(0), P.Y(0), P.X(i1), P.Y(i2), { color: COLORS.c, width: 2.4 });
      arrow(ctx, P.X(0), P.Y(0), P.X(j1), P.Y(j2), { color: COLORS.e, width: 2.4 });
      const f2 = (v) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2));
      const eigText = E.real ? `特征值 $\\lambda_1=${f2(E.l1)}$，$\\lambda_2=${f2(E.l2)}$，特征方向是绿色虚线：这两条直线上的向量只被伸缩（绿箭头 $=A\\vv v$）。` : `特征值为复数 $${f2(E.re)}\\pm${f2(E.im)}i$：没有实特征方向，变换带有旋转。`;
      S.setReadout(`$A=\\begin{pmatrix}${f2(M[0])}&${f2(M[1])}\\\\${f2(M[2])}&${f2(M[3])}\\end{pmatrix}$，列向量是 $\\vv e_1,\\vv e_2$ 的像（橙、紫）。$\\det A=${f2(E.det)}$：单位正方形变成面积 $${f2(Math.abs(E.det))}$ 的平行四边形${E.det < 0 ? '，并翻转了定向（红色）' : ''}。${eigText}`);
    });
    return { destroy: S.destroy };
  },
};

export const powerMethod = {
  id: 'power-method',
  title: '幂法求主特征向量',
  mount(host) {
    const S = stage(host, { height: 280 });
    let M = [2, 1, 1, 1.5], v = [0.2, 1], hist = [], step = 0, timer = 0;
    const P = plot(S, { x0: -1.6, x1: 1.6, y0: -1.25, y1: 1.25, equal: true });
    const reset = () => { const a = Math.random() * TAU; v = [Math.cos(a), Math.sin(a)]; hist = [v]; step = 0; };
    slider(S, { label: '$a_{12}=a_{21}$', min: -1.5, max: 1.5, step: 0.05, value: 1, fmt: (x) => x.toFixed(2), oninput: (x) => { M[1] = M[2] = x; reset(); } });
    slider(S, { label: '$a_{22}$', min: -2, max: 3, step: 0.05, value: 1.5, fmt: (x) => x.toFixed(2), oninput: (x) => { M[3] = x; reset(); } });
    button(S, '换个初始向量', reset);
    reset();
    S.loop((dt) => {
      timer += dt;
      if (timer > 650 && step < 25) {
        timer = 0; step++;
        const w = [M[0] * v[0] + M[1] * v[1], M[2] * v[0] + M[3] * v[1]];
        const n = Math.hypot(...w) || 1; v = [w[0] / n, w[1] / n]; hist.push(v); S.dirty = true;
      }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { xstep: 1, ystep: 1 });
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(P.X(0), P.Y(0), P.sx, 0, TAU); ctx.stroke();
      const E = eig2(...M);
      const big = Math.abs(E.l1) >= Math.abs(E.l2) ? E.v1 : E.v2;
      const n = Math.hypot(...big); const u = [big[0] / n, big[1] / n];
      P.line(ctx, -1.5 * u[0], -1.5 * u[1], 1.5 * u[0], 1.5 * u[1], { color: COLORS.d, width: 1.5, dash: [6, 4] });
      hist.forEach((h, k) => { ctx.globalAlpha = 0.25 + 0.75 * (k / hist.length); P.dot(ctx, h[0], h[1], { r: 3, color: COLORS.b }); });
      ctx.globalAlpha = 1;
      arrow(ctx, P.X(0), P.Y(0), P.X(v[0]), P.Y(v[1]), { color: COLORS.b, width: 2.4 });
      const ray = v[0] * (M[0] * v[0] + M[1] * v[1]) + v[1] * (M[2] * v[0] + M[3] * v[1]);
      const lmax = Math.abs(E.l1) >= Math.abs(E.l2) ? E.l1 : E.l2, lmin = Math.abs(E.l1) >= Math.abs(E.l2) ? E.l2 : E.l1;
      S.setReadout(`第 $${step}$ 步：$\\vv q_{k+1}=\\frac{A\\vv q_k}{\\|A\\vv q_k\\|}$，瑞利商 $${ray.toFixed(5)}$，主特征值 $${lmax.toFixed(5)}$。每步误差约乘以 $|\\lambda_2/\\lambda_1|=${Math.abs(lmin / lmax).toFixed(3)}$——比值越接近 $1$ 收敛越慢；若两个特征值绝对值相等，幂法不收敛。`);
    });
    return { destroy: S.destroy };
  },
};

export const dihedral = {
  id: 'dihedral',
  title: '正多边形的对称群 Dₙ',
  mount(host) {
    const S = stage(host, { height: 280 });
    let n = 5;
    let state = { rot: 0, flip: false };   // element r^rot s^flip
    let word = [];
    let anim = null; // { from: angleFn, t }
    const vis = { angle: 0, flipScale: 1 };
    slider(S, { label: '$n$', min: 3, max: 8, step: 1, value: n, oninput: (v) => { n = v; state = { rot: 0, flip: false }; word = []; vis.angle = 0; vis.flipScale = 1; } });
    const apply = (op) => {
      if (anim) return;
      if (op === 'r') { state.rot = (state.rot + (state.flip ? n - 1 : 1)) % n; anim = { type: 'r', t: 0 }; }
      else { state.flip = !state.flip; anim = { type: 's', t: 0 }; }
      word.push(op);
      if (word.length > 14) word = word.slice(-14);
    };
    button(S, '旋转 r', () => apply('r'));
    button(S, '翻转 s', () => apply('s'));
    button(S, '复位', () => { state = { rot: 0, flip: false }; word = []; vis.angle = 0; vis.flipScale = 1; });
    S.loop((dt) => {
      if (anim) {
        anim.t = Math.min(1, anim.t + dt / 500);
        S.dirty = true;
        if (anim.t >= 1) anim = null;
      }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx, w, h } = S;
      S.clear();
      const cx = w * 0.36, cy = h / 2, R = Math.min(h * 0.38, w * 0.26);
      // target pose of the polygon: vertex k sits at angle (state) ; draw with animation interpolation
      const baseAngle = (k) => -Math.PI / 2 + (TAU * k) / n;
      // compute current pose: rotation angle and flip scale
      const targetAngle = (TAU * state.rot) / n;
      if (!anim) { vis.angle = targetAngle; vis.flipScale = state.flip ? -1 : 1; }
      else if (anim.type === 'r') { const prev = targetAngle - ((state.flip ? -1 : 1) * TAU) / n; vis.angle = prev + (targetAngle - prev) * anim.t; }
      else { vis.flipScale = (state.flip ? 1 : -1) * Math.cos(Math.PI * anim.t); }
      // symmetry axes (faint)
      ctx.strokeStyle = 'rgba(150,172,255,0.12)'; ctx.lineWidth = 1;
      for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (Math.PI * k) / n; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * R * 1.25, cy - Math.sin(a) * R * 1.25); ctx.lineTo(cx + Math.cos(a) * R * 1.25, cy + Math.sin(a) * R * 1.25); ctx.stroke(); }
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = baseAngle(k) + vis.angle;
        const x = Math.cos(a) * R, y = Math.sin(a) * R;
        pts.push([cx + x * vis.flipScale, cy + y]);
      }
      ctx.fillStyle = 'rgba(255,154,213,0.16)'; ctx.strokeStyle = COLORS.f; ctx.lineWidth = 2;
      ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.stroke();
      pts.forEach(([x, y], k) => {
        ctx.fillStyle = k === 0 ? COLORS.b : '#0b1024'; ctx.strokeStyle = COLORS.f;
        ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = k === 0 ? '#1a1200' : '#fff'; ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(k + 1), x, y + 0.5);
      });
      // text panel
      const tx = w * 0.66;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.muted; ctx.font = `12px ${FONT}`;
      ctx.fillText(`|Dₙ| = 2n = ${2 * n}`, tx, 24);
      ctx.fillText('操作序列（从左到右依次执行）：', tx, 48);
      ctx.fillStyle = '#fff'; ctx.font = `600 15px ${FONT}`;
      ctx.fillText(word.join(' ') || '（无）', tx, 70, w - tx - 10);
      ctx.fillStyle = COLORS.muted; ctx.font = `12px ${FONT}`;
      ctx.fillText('化简后的群元素：', tx, 104);
      ctx.fillStyle = COLORS.b; ctx.font = `600 18px ${FONT}`;
      const el = `${state.rot ? `r${state.rot > 1 ? toSup(state.rot) : ''}` : ''}${state.flip ? 's' : ''}` || 'e';
      ctx.fillText(el, tx, 126);
      S.setReadout(`$D_${n}$ 有 $${n}$ 个旋转和 $${n}$ 个反射。试试“先 $s$ 再 $r$”与“先 $r$ 再 $s$”：结果不同，$D_n$ 不是交换群；但 $srs=r^{-1}$，$r^${n}=s^2=e$——这三条关系完全确定了这个群。`);
    });
    return { destroy: S.destroy };
  },
};
function toSup(k) { return String(k).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''); }
