// Small 3-D scenes drawn with the painter's algorithm: Platonic solids and Euler's formula,
// the Möbius strip, and knots.
import { stage, select, checkbox, button, orbit, COLORS, TAU, FONT } from './kit.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** faces of the convex hull of `V` (vertices are assumed to be in convex position) */
function hullFaces(V) {
  const faces = [], seen = new Set();
  const n = V.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nv = crs(sub(V[j], V[i]), sub(V[k], V[i]));
    const len = Math.hypot(...nv);
    if (len < 1e-9) continue;
    nv = nv.map((c) => c / len);
    const d = dot(nv, V[i]);
    let pos = 0, neg = 0;
    const on = [];
    for (let m = 0; m < n; m++) { const s = dot(nv, V[m]) - d; if (s > 1e-6) pos++; else if (s < -1e-6) neg++; else on.push(m); }
    if (pos && neg) continue;
    const key = on.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    if (pos) nv = nv.map((c) => -c); // outward normal
    const c = on.reduce((a, m) => [a[0] + V[m][0] / on.length, a[1] + V[m][1] / on.length, a[2] + V[m][2] / on.length], [0, 0, 0]);
    const u = norm(sub(V[on[0]], c)), w = crs(nv, u);
    on.sort((a, b) => Math.atan2(dot(sub(V[a], c), w), dot(sub(V[a], c), u)) - Math.atan2(dot(sub(V[b], c), w), dot(sub(V[b], c), u)));
    faces.push(on);
  }
  return faces;
}
const signs = (a) => { let out = [[]]; for (const x of a) out = out.flatMap((p) => (x === 0 ? [[...p, 0]] : [[...p, x], [...p, -x]])); return out; };
const cyc = (v) => [v, [v[1], v[2], v[0]], [v[2], v[0], v[1]]];

const SOLIDS = {
  tetra: { name: '正四面体', sch: '\\{3,3\\}', V: () => [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]] },
  cube: { name: '正六面体', sch: '\\{4,3\\}', V: () => signs([1, 1, 1]) },
  octa: { name: '正八面体', sch: '\\{3,4\\}', V: () => cyc([1, 0, 0]).flatMap(signs) },
  dodeca: { name: '正十二面体', sch: '\\{5,3\\}', V: () => [...signs([1, 1, 1]), ...cyc([0, 1 / PHI, PHI]).flatMap(signs)] },
  icosa: { name: '正二十面体', sch: '\\{3,5\\}', V: () => cyc([0, 1, PHI]).flatMap(signs) },
  trunc: { name: '截角二十面体（足球）', V: () => [...cyc([0, 1, 3 * PHI]), ...cyc([1, 2 + PHI, 2 * PHI]), ...cyc([PHI, 2, PHI ** 3])].flatMap(signs) },
  torus: { name: '环面多面体', torus: true },
};
function torusMesh(n = 12, m = 6) {
  const V = [], F = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const u = (i / n) * TAU, v = (j / m) * TAU, r = 1 + 0.45 * Math.cos(v);
    V.push([r * Math.cos(u), 0.45 * Math.sin(v), r * Math.sin(u)]);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) F.push([i * m + j, ((i + 1) % n) * m + j, ((i + 1) % n) * m + ((j + 1) % m), i * m + ((j + 1) % m)]);
  return { V, F };
}

export const polyhedra = {
  id: 'polyhedra',
  title: '正多面体与欧拉公式',
  mount(host) {
    const S = stage(host, { height: 300, hint: '拖动旋转' });
    const R = orbit(S, { yaw: 0.5, pitch: 0.4 });
    let key = 'dodeca', mesh = null, showBack = true;
    const build = () => {
      const D = SOLIDS[key];
      if (D.torus) { mesh = torusMesh(); return; }
      let V = D.V();
      const r = Math.max(...V.map((v) => Math.hypot(...v)));
      V = V.map((v) => v.map((c) => c / r));
      mesh = { V, F: hullFaces(V) };
    };
    build();
    select(S, { label: '多面体', value: key, options: Object.entries(SOLIDS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; build(); } });
    checkbox(S, '显示背面棱', showBack, (v) => { showBack = v; });
    const light = norm([-0.5, 0.7, -0.6]);
    S.loop((dt) => {
      R.step(dt);
      const { ctx, w, h } = S;
      S.clear();
      const sc = Math.min(w, h) * (key === 'torus' ? 0.3 : 0.36), cx = w / 2, cy = h / 2;
      const P = mesh.V.map((v) => R.project(v, sc, cx, cy, 5));
      const RV = mesh.V.map((v) => R.rotate(v));
      const faces = mesh.F.map((f) => {
        const a = RV[f[0]], b = RV[f[1]], c = RV[f[2]];
        let nv = norm(crs(sub(b, a), sub(c, a)));
        const cen = f.reduce((s, i) => [s[0] + RV[i][0] / f.length, s[1] + RV[i][1] / f.length, s[2] + RV[i][2] / f.length], [0, 0, 0]);
        if (!mesh.torus && dot(nv, cen) < 0) nv = nv.map((q) => -q);
        const view = sub(cen, [0, 0, -5]);
        return { f, nv, depth: cen[2], front: dot(nv, view) < 0 };
      });
      faces.sort((p, q) => q.depth - p.depth);
      if (showBack && key !== 'torus') {
        ctx.strokeStyle = 'rgba(160,180,255,0.18)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        for (const F of faces) if (!F.front) { ctx.beginPath(); F.f.forEach((i, k) => (k ? ctx.lineTo(P[i][0], P[i][1]) : ctx.moveTo(P[i][0], P[i][1]))); ctx.closePath(); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      const hue = { 3: 212, 4: 160, 5: 268, 6: 44 };
      for (const F of faces) {
        if (!F.front && key !== 'torus') continue;
        const lam = Math.max(0.06, dot(F.nv, light) * (F.front ? 1 : -1));
        const hh = key === 'torus' ? 186 : hue[F.f.length] ?? 200;
        ctx.fillStyle = `hsla(${hh},70%,${18 + lam * 42}%,${F.front ? 0.92 : 0.55})`;
        ctx.strokeStyle = `hsla(${hh},90%,80%,${F.front ? 0.9 : 0.25})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); F.f.forEach((i, k) => (k ? ctx.lineTo(P[i][0], P[i][1]) : ctx.moveTo(P[i][0], P[i][1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      const Vn = mesh.V.length, Fn = mesh.F.length, En = mesh.F.reduce((s, f) => s + f.length, 0) / 2;
      ctx.fillStyle = COLORS.text; ctx.font = `13px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`V = ${Vn}   E = ${En}   F = ${Fn}`, 12, 10);
      ctx.fillStyle = COLORS.b; ctx.fillText(`V − E + F = ${Vn - En + Fn}`, 12, 30);
      const D = SOLIDS[key];
      const types = [...new Set(mesh.F.map((f) => f.length))].sort();
      let txt;
      if (D.torus) txt = `环面上的多面体：$V-E+F=${Vn}-${En}+${Fn}=0$。欧拉示性数 $\\chi=2-2g$ 只与曲面的亏格 $g$（洞的个数）有关——球面 $2$，环面 $0$。`;
      else if (D.sch) txt = `${D.name}，施莱夫利符号 $${D.sch}$：每个面是正 $${D.sch[2]}$ 边形，每个顶点处有 $${D.sch[4]}$ 个面。$V-E+F=2$。由 $\\frac1p+\\frac1q>\\frac12$ 可知正多面体恰有五种。`;
      else txt = `${D.name}：$12$ 个正五边形、$20$ 个正六边形，${types.length} 种面。$${Vn}-${En}+${Fn}=2$——任何凸多面体（拓扑上是球面）都满足欧拉公式。`;
      S.setReadout(txt);
    });
    return { destroy: S.destroy };
  },
};

// ---- Möbius strip
export const mobius = {
  id: 'mobius',
  title: '默比乌斯带：只有一个面',
  mount(host) {
    const S = stage(host, { height: 300, hint: '拖动旋转' });
    const R = orbit(S, { yaw: 0.3, pitch: 0.55, auto: 0.00012 });
    let mode = 'mobius', t = 0, ant = true;
    select(S, { label: '曲面', value: mode, options: [['mobius', '默比乌斯带'], ['band', '普通环带'], ['cut', '沿中线剪开后']], onchange: (v) => { mode = v; t = 0; } });
    checkbox(S, '蚂蚁与法向量', ant, (v) => { ant = v; });
    const W = 0.42;
    // surface point; for "cut" u runs over [0, 4π) and v over one half of the strip
    const surf = (u, v) => {
      if (mode === 'band') return [Math.cos(u) * 1.2, v, Math.sin(u) * 1.2];
      const r = 1.2 + v * Math.cos(u / 2);
      return [r * Math.cos(u), v * Math.sin(u / 2), r * Math.sin(u)];
    };
    const normal = (u, v) => {
      const e = 1e-4;
      const a = sub(surf(u + e, v), surf(u - e, v)), b = sub(surf(u, v + e), surf(u, v - e));
      return norm(crs(a, b));
    };
    const light = norm([-0.4, 0.8, -0.5]);
    S.loop((dt) => {
      R.step(dt);
      t += dt * 0.0005;
      const { ctx, w, h } = S;
      S.clear();
      const sc = Math.min(w * 0.3, h * 0.55), cx = w / 2, cy = h / 2 + 6;
      const uMax = mode === 'cut' ? 2 * TAU : TAU;
      const nu = mode === 'cut' ? 160 : 90, nv = 6;
      const v0 = mode === 'cut' ? W * 0.12 : -W, v1 = W;
      const quads = [];
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const u = (i / nu) * uMax, u2 = ((i + 1) / nu) * uMax, v = v0 + ((v1 - v0) * j) / nv, vv = v0 + ((v1 - v0) * (j + 1)) / nv;
        const pts = [surf(u, v), surf(u2, v), surf(u2, vv), surf(u, vv)];
        const rv = pts.map((p) => R.rotate(p));
        const n = norm(crs(sub(rv[1], rv[0]), sub(rv[3], rv[0])));
        const cen = rv.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
        const facing = dot(n, sub(cen, [0, 0, -5])) < 0;
        quads.push({ pr: pts.map((p) => R.project(p, sc, cx, cy, 5)), depth: cen[2], lam: Math.abs(dot(n, light)), facing, u });
      }
      quads.sort((a, b) => b.depth - a.depth);
      for (const q of quads) {
        const hue = mode === 'band' ? (q.facing ? 212 : 22) : 200 + 80 * Math.sin(q.u / 2);
        ctx.fillStyle = `hsla(${hue},65%,${16 + q.lam * 44}%,0.95)`;
        ctx.strokeStyle = `hsla(${hue},70%,${30 + q.lam * 40}%,0.6)`;
        ctx.lineWidth = 0.6;
        ctx.beginPath(); q.pr.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // boundary
      ctx.strokeStyle = 'rgba(255,209,102,0.85)'; ctx.lineWidth = 1.6;
      const edges = mode === 'band' ? [[-W, TAU], [W, TAU]] : mode === 'mobius' ? [[W, 2 * TAU]] : [[W, 2 * TAU], [v0, 2 * TAU]];
      for (const [v, span] of edges) {
        ctx.beginPath();
        for (let k = 0; k <= 400; k++) { const p = R.project(surf((k / 400) * span, v), sc, cx, cy, 5); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
        ctx.stroke();
      }
      let laps = 0;
      if (ant && mode !== 'cut') {
        const u = t % (2 * TAU);
        laps = Math.floor(t / TAU);
        const p = surf(u, 0), n = normal(u, 0), n0 = normal(0, 0);
        const flip = mode === 'mobius' && laps % 2 === 1;
        const a = R.project(p, sc, cx, cy, 5), b = R.project([p[0] + n[0] * 0.38, p[1] + n[1] * 0.38, p[2] + n[2] * 0.38], sc, cx, cy, 5);
        ctx.strokeStyle = COLORS.c; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.fillStyle = COLORS.c; ctx.beginPath(); ctx.arc(b[0], b[1], 3.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a[0], a[1], 4.5, 0, TAU); ctx.fill();
        const st = R.project(surf(0, 0), sc, cx, cy, 5), stn = R.project([surf(0, 0)[0] + n0[0] * 0.38, n0[1] * 0.38, surf(0, 0)[2] + n0[2] * 0.38], sc, cx, cy, 5);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(st[0], st[1]); ctx.lineTo(stn[0], stn[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = COLORS.text; ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`蚂蚁沿中线已走 ${(t / TAU).toFixed(2)} 圈`, 12, 10);
        if (mode === 'mobius') { ctx.fillStyle = flip ? COLORS.c : COLORS.d; ctx.fillText(flip ? '法向量与出发时相反' : '法向量与出发时同侧', 12, 28); }
      }
      if (mode === 'mobius') S.setReadout('参数式 $\\big((1+v\\cos\\frac u2)\\cos u,\\ v\\sin\\frac u2,\\ (1+v\\cos\\frac u2)\\sin u\\big)$。蚂蚁沿中线走一圈回到起点，却站到了“背面”：法向量反向——带子只有<b>一个面</b>、一条边界（金线），是<b>不可定向</b>曲面，欧拉示性数 $0$。走两圈才复原。');
      else if (mode === 'band') S.setReadout('普通环带（圆柱面）有内外两面（两种颜色）和两条边界：沿中线走一圈，法向量回到原样——它是可定向的。');
      else S.setReadout('把默比乌斯带沿中线剪开，得到的<b>不是两条</b>，而是一条长度加倍、扭了两整圈（四个半扭）的带子；它有两个面、两条边界，是可定向的。若沿三等分线剪开，则得到一长一短两条套在一起的带子。');
    });
    return { destroy: S.destroy };
  },
};

// ---- knots: drawn as a tube, sorted back to front so that crossings read correctly
const KNOTS = {
  unknot: { name: '平凡纽结（圆）', f: (t) => [2 * Math.cos(t), 2 * Math.sin(t), 0.6 * Math.sin(2 * t)], cr: 0, tri: false, note: '平凡纽结：可以不剪断地解成一个圆。上下起伏的这个圈在某些角度下看起来有交叉，但都能消去，最少交叉数是 $0$。' },
  trefoil: { name: '三叶结', f: (t) => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)], cr: 3, tri: true, note: '三叶结：最简单的非平凡纽结，交叉数 $3$。它可以<b>三染色</b>（每个交叉处三条弧颜色全同或全异，且至少用两种颜色），而平凡纽结不行——这就证明了它解不开。三叶结与它的镜像不同痕：它是手性的。' },
  eight: { name: '8 字结', f: (t) => [(2 + Math.cos(2 * t)) * Math.cos(3 * t), (2 + Math.cos(2 * t)) * Math.sin(3 * t), Math.sin(4 * t)], cr: 4, tri: false, note: '8 字结：交叉数 $4$，不能三染色，但它与三叶结、平凡纽结都不同痕（可由琼斯多项式区分）。它与自己的镜像同痕（无手性）。' },
  cinque: { name: '五叶结 (2,5) 环面结', f: (t) => { const r = 2 + Math.cos(5 * t); return [r * Math.cos(2 * t), r * Math.sin(2 * t), -Math.sin(5 * t)]; }, cr: 5, tri: false, note: '$(2,5)$ 环面结：在环面上绕大圆 $2$ 圈、小圆 $5$ 圈。$(p,q)$ 环面结（$p,q$ 互素）的交叉数是 $\\min\\{p(q-1),\\,q(p-1)\\}$，这里是 $5$。' },
};
function segIntersect(a, b, c, d) {
  const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]);
  const d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export const knot = {
  id: 'knot',
  title: '纽结：交叉与不变量',
  mount(host) {
    const S = stage(host, { height: 300, hint: '拖动旋转' });
    const R = orbit(S, { yaw: 0.2, pitch: 0.25, auto: 0.0002 });
    let key = 'trefoil';
    select(S, { label: '纽结', value: key, options: Object.entries(KNOTS).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; } });
    button(S, '正对投影', () => { R.yaw = 0; R.pitch = 0; });
    S.loop((dt) => {
      R.step(dt);
      const { ctx, w, h } = S;
      S.clear();
      const K = KNOTS[key];
      const N = 360, sc = Math.min(w, h) * 0.145, cx = w / 2, cy = h / 2;
      const pts = [];
      for (let i = 0; i < N; i++) { const t = (i / N) * TAU; pts.push(R.project(K.f(t), sc, cx, cy, 9)); }
      const segs = [];
      for (let i = 0; i < N; i++) segs.push({ a: pts[i], b: pts[(i + 1) % N], z: (pts[i][2] + pts[(i + 1) % N][2]) / 2, i });
      // count crossings of the current projection
      let crossings = 0;
      for (let i = 0; i < N; i += 2) for (let j = i + 4; j < N; j += 2) {
        if (i === 0 && j >= N - 4) continue;
        if (segIntersect(pts[i], pts[(i + 2) % N], pts[j], pts[(j + 2) % N])) crossings++;
      }
      segs.sort((p, q) => q.z - p.z);
      const zmin = Math.min(...pts.map((p) => p[2])), zmax = Math.max(...pts.map((p) => p[2]));
      // the dark outline uses butt caps so it never covers the neighbouring segment's colour
      for (const s of segs) {
        const depth = (s.z - zmin) / (zmax - zmin || 1);
        const hue = 200 + (s.i / N) * 140;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#04060f'; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(s.b[0], s.b[1]); ctx.stroke();
        ctx.lineCap = 'round';
        ctx.strokeStyle = `hsl(${hue},80%,${66 - depth * 26}%)`; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(s.b[0], s.b[1]); ctx.stroke();
        ctx.strokeStyle = `hsla(${hue},90%,92%,${0.55 - depth * 0.4})`; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(s.a[0] - 1.5, s.a[1] - 1.5); ctx.lineTo(s.b[0] - 1.5, s.b[1] - 1.5); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.fillStyle = COLORS.text; ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`当前投影的交叉点：${crossings}`, 12, 10);
      ctx.fillStyle = COLORS.b; ctx.fillText(`最少交叉数：${K.cr}`, 12, 28);
      ctx.fillStyle = COLORS.muted; ctx.fillText(`可三染色：${K.tri ? '是' : '否'}`, 12, 46);
      S.setReadout(`${K.note} 旋转它：投影中的交叉数会变（对应雷德迈斯特移动），但纽结类型不变——不变量就是不随这些移动改变的量。`);
    });
    return { destroy: S.destroy };
  },
};
