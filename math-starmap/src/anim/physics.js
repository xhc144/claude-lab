// Physics: projectile motion, oscillations, electric fields, interference, refraction, time dilation.
import { stage, slider, select, button, checkbox, plot, arrow, COLORS, TAU, FONT } from './kit.js';

const G = 9.8;

export const projectile = {
  id: 'projectile',
  title: '抛体运动',
  mount(host) {
    const S = stage(host, { height: 290 });
    let v0 = 24, deg = 52, drag = false, family = false, t = 0;
    const VMAX = 30, RMAX = (VMAX * VMAX) / G;
    const P = plot(S, { x0: -2, x1: RMAX * 1.05, y0: -2, y1: RMAX * 0.52, equal: true, pad: 22 });
    slider(S, { label: '$v_0$', min: 5, max: VMAX, step: 0.5, value: v0, fmt: (v) => v.toFixed(1), oninput: (v) => { v0 = v; t = 0; } });
    slider(S, { label: '仰角 $\\theta$', min: 0, max: 90, step: 1, value: deg, fmt: (v) => `${v}°`, oninput: (v) => { deg = v; t = 0; } });
    checkbox(S, '空气阻力', drag, (v) => { drag = v; t = 0; });
    checkbox(S, '一族轨迹与包络', family, (v) => { family = v; });
    // trajectory with optional linear drag a = −k v (integrated with small RK2 steps)
    const traj = (v, a, k) => {
      const out = [[0, 0, 0]];
      let x = 0, y = 0, vx = v * Math.cos(a), vy = v * Math.sin(a), tt = 0;
      const h = 0.01;
      for (let i = 0; i < 20000; i++) {
        const ax = -k * vx, ay = -G - k * vy;
        const mx = vx + ax * h / 2, my = vy + ay * h / 2;
        x += mx * h; y += my * h;
        vx += -k * mx * h; vy += (-G - k * my) * h;
        tt += h;
        if (y < 0) { const f = out[out.length - 1][1] / (out[out.length - 1][1] - y); x = out[out.length - 1][0] + (x - out[out.length - 1][0]) * f; out.push([x, 0, tt - h + h * f]); break; }
        out.push([x, y, tt]);
      }
      return out;
    };
    S.loop((dt) => {
      t += dt / 1000;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { xstep: 10, ystep: 10 });
      const a = (deg * Math.PI) / 180, k = drag ? 0.08 : 0;
      if (family) {
        for (let d = 15; d <= 75; d += 15) { const tr = traj(v0, (d * Math.PI) / 180, k); P.param(ctx, (i) => tr[Math.round(i)][0], (i) => tr[Math.round(i)][1], 0, tr.length - 1, { color: 'rgba(196,155,255,0.35)', width: 1, n: Math.min(300, tr.length - 1) }); }
        if (!drag) P.curve(ctx, (x) => (v0 * v0) / (2 * G) - (G * x * x) / (2 * v0 * v0), { color: 'rgba(255,138,101,0.7)', width: 1.4, from: 0, to: (v0 * v0) / G, dash: [6, 5] });
      }
      const tr = traj(v0, a, k);
      const T = tr[tr.length - 1][2], R = tr[tr.length - 1][0];
      let H = 0; for (const p of tr) H = Math.max(H, p[1]);
      P.param(ctx, (i) => tr[Math.round(i)][0], (i) => tr[Math.round(i)][1], 0, tr.length - 1, { color: 'rgba(127,180,255,0.6)', width: 1.6, n: Math.min(400, tr.length - 1) });
      const tc = t % (T + 1);
      const idx = Math.min(tr.length - 1, Math.round(Math.min(tc, T) / 0.01));
      const [x, y] = tr[idx];
      // velocity components at that moment
      const vx = drag ? (tr[Math.min(tr.length - 1, idx + 1)][0] - tr[Math.max(0, idx - 1)][0]) / 0.02 : v0 * Math.cos(a);
      const vy = drag ? (tr[Math.min(tr.length - 1, idx + 1)][1] - tr[Math.max(0, idx - 1)][1]) / 0.02 : v0 * Math.sin(a) - G * Math.min(tc, T);
      const s = 0.35;
      arrow(ctx, P.X(x), P.Y(y), P.X(x + vx * s), P.Y(y), { color: COLORS.d, width: 1.8, head: 7 });
      arrow(ctx, P.X(x), P.Y(y), P.X(x), P.Y(y + vy * s), { color: COLORS.c, width: 1.8, head: 7 });
      arrow(ctx, P.X(x), P.Y(y), P.X(x + vx * s), P.Y(y + vy * s), { color: '#fff', width: 1.6, head: 7 });
      P.dot(ctx, x, y, { r: 5, color: COLORS.b });
      P.line(ctx, R, 0, R, 1.5, { color: COLORS.b, width: 2 });
      const v2 = v0 * v0;
      S.setReadout(drag
        ? `有线性阻力 $\\boldsymbol a=\\boldsymbol g-k\\boldsymbol v$（$k=0.08\\,\\mathrm{s^{-1}}$）时数值积分：射程 $${R.toFixed(1)}\\,$m、最高 $${H.toFixed(1)}\\,$m、飞行 $${T.toFixed(2)}\\,$s。轨迹不再对称，下落段更陡，最大射程的仰角小于 $45^\\circ$。`
        : `水平匀速 $x=v_0\\cos\\theta\\,t$（绿），竖直匀变速 $y=v_0\\sin\\theta\\,t-\\frac12gt^2$（橙）。射程 $R=\\dfrac{v_0^2\\sin2\\theta}{g}=${(v2 * Math.sin(2 * a) / G).toFixed(1)}\\,$m，最高 $H=\\dfrac{v_0^2\\sin^2\\theta}{2g}=${(v2 * Math.sin(a) ** 2 / (2 * G)).toFixed(1)}\\,$m，飞行 $T=\\dfrac{2v_0\\sin\\theta}{g}=${(2 * v0 * Math.sin(a) / G).toFixed(2)}\\,$s。$45^\\circ$ 射程最大；互余的两个角射程相同。${family ? '虚线是所有轨迹的包络——“安全抛物线” $y=\\frac{v_0^2}{2g}-\\frac{gx^2}{2v_0^2}$。' : ''}`);
    });
    return { destroy: S.destroy };
  },
};

// ---- simple harmonic motion: spring and pendulum
function agm(a, b) { for (let i = 0; i < 30; i++) { const m = (a + b) / 2; b = Math.sqrt(a * b); a = m; } return a; }
export const shm = {
  id: 'shm',
  title: '简谐振动：弹簧与单摆',
  mount(host) {
    const S = stage(host, { height: 290 });
    let mode = 'spring', A = 1, gam = 0, omega = 2.4, theta0 = 30, phase = false, st = null, hist = [], time = 0;
    const reset = () => {
      time = 0; hist = [];
      st = mode === 'spring' ? [A, 0] : [(theta0 * Math.PI) / 180, 0];
    };
    select(S, { label: '振子', value: mode, options: [['spring', '弹簧振子'], ['pend', '单摆']], onchange: (v) => { mode = v; reset(); } });
    slider(S, { label: '$\\omega_0$', min: 1, max: 5, step: 0.1, value: omega, fmt: (v) => v.toFixed(1), oninput: (v) => { omega = v; reset(); } });
    slider(S, { label: '摆角 $\\theta_0$', min: 5, max: 175, step: 1, value: theta0, fmt: (v) => `${v}°`, oninput: (v) => { theta0 = v; reset(); } });
    slider(S, { label: '阻尼 $\\gamma$', min: 0, max: 1.5, step: 0.05, value: gam, fmt: (v) => v.toFixed(2), oninput: (v) => { gam = v; reset(); } });
    checkbox(S, '相图', phase, (v) => { phase = v; });
    reset();
    const acc = (x, v) => (mode === 'spring' ? -omega * omega * x : -omega * omega * Math.sin(x)) - 2 * gam * v;
    S.loop((dt) => {
      const h = Math.min(0.05, dt / 1000) / 4;
      for (let i = 0; i < 4; i++) {
        const [x, v] = st;
        const k1 = [v, acc(x, v)], k2 = [v + (h / 2) * k1[1], acc(x + (h / 2) * k1[0], v + (h / 2) * k1[1])];
        const k3 = [v + (h / 2) * k2[1], acc(x + (h / 2) * k2[0], v + (h / 2) * k2[1])], k4 = [v + h * k3[1], acc(x + h * k3[0], v + h * k3[1])];
        st = [x + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), v + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
        time += h;
      }
      hist.push([time, st[0], st[1]]);
      if (hist.length > 1200) hist.shift();
      const { ctx, w, h: H } = S;
      S.clear();
      const lw = Math.min(w * 0.36, 260), cx = lw / 2;
      const amp = mode === 'spring' ? A : (theta0 * Math.PI) / 180;
      if (mode === 'spring') {
        const sc = Math.min(lw * 0.28, H * 0.24), y = H * 0.28, wall = 14, rest = lw * 0.55, px = rest + st[0] * sc;
        ctx.fillStyle = 'rgba(200,214,255,0.25)'; ctx.fillRect(wall - 6, y - 40, 6, 80);
        ctx.strokeStyle = COLORS.a; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(wall, y);
        const coils = 14;
        for (let i = 1; i < coils * 2; i++) { const xx = wall + 8 + ((px - 22 - wall - 8) * i) / (coils * 2); ctx.lineTo(xx, y + (i % 2 ? -11 : 11)); }
        ctx.lineTo(px - 18, y); ctx.stroke();
        ctx.fillStyle = COLORS.b; ctx.fillRect(px - 18, y - 18, 36, 36);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(rest, y - 34); ctx.lineTo(rest, y + 34); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(200,214,255,0.25)'; ctx.fillRect(wall, y + 19, lw - wall, 2);
        // reference circle: uniform circular motion projects to SHM
        if (gam === 0) {
          // phasor: x = A cos φ, v = −Aω₀ sin φ
          const ry = H * 0.68, Rr = sc * A, ph = Math.atan2(-st[1] / omega, st[0]);
          const qx = rest + Rr * Math.cos(ph), qy = ry - Rr * Math.sin(ph);
          ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(rest, ry, Rr, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(196,155,255,0.7)'; ctx.beginPath(); ctx.moveTo(rest, ry); ctx.lineTo(qx, qy); ctx.stroke();
          ctx.strokeStyle = 'rgba(196,155,255,0.4)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, y + 18); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = COLORS.e; ctx.beginPath(); ctx.arc(qx, qy, 4, 0, TAU); ctx.fill();
        }
      } else {
        const L = H * 0.4, py = H * 0.45, bx = cx + L * Math.sin(st[0]), by = py + L * Math.cos(st[0]);
        ctx.fillStyle = 'rgba(200,214,255,0.3)'; ctx.fillRect(cx - 30, py - 4, 60, 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, py); ctx.lineTo(cx, py + L + 10); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = COLORS.a; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, py); ctx.lineTo(bx, by); ctx.stroke();
        ctx.fillStyle = COLORS.b; ctx.beginPath(); ctx.arc(bx, by, 11, 0, TAU); ctx.fill();
      }
      // right panel: x(t) graph or phase portrait
      const gx = lw + 20, gw = w - gx - 12, gy = 16, gh = H - 34;
      ctx.strokeStyle = COLORS.grid; ctx.strokeRect(gx, gy, gw, gh);
      ctx.fillStyle = COLORS.muted; ctx.font = `10px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      if (!phase) {
        const span = 8, t1 = time, t0 = t1 - span, ym = gy + gh / 2, sy = (gh / 2 - 6) / amp;
        ctx.strokeStyle = COLORS.axis; ctx.beginPath(); ctx.moveTo(gx, ym); ctx.lineTo(gx + gw, ym); ctx.stroke();
        if (gam > 0) { ctx.strokeStyle = 'rgba(255,138,101,0.5)'; ctx.setLineDash([4, 4]); for (const sg of [1, -1]) { ctx.beginPath(); for (let i = 0; i <= 80; i++) { const tt = t0 + (span * i) / 80; if (tt < 0) continue; const X = gx + ((tt - t0) / span) * gw, Y = ym - sg * amp * Math.exp(-gam * tt) * sy; i && tt - span / 80 >= 0 ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); } ctx.setLineDash([]); }
        ctx.strokeStyle = COLORS.b; ctx.lineWidth = 2; ctx.beginPath(); let pen = false;
        for (const [tt, x] of hist) { if (tt < t0) continue; const X = gx + ((tt - t0) / span) * gw, Y = ym - x * sy; pen ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); pen = true; }
        ctx.stroke();
        ctx.fillText(mode === 'spring' ? 'x(t)' : 'θ(t)', gx + 4, gy + 3);
      } else {
        const vmax = amp * omega * (mode === 'pend' ? Math.sqrt(2 * (1 - Math.cos(amp))) / Math.max(1e-6, amp) : 1);
        const cxp = gx + gw / 2, cyp = gy + gh / 2, sx = (gw / 2 - 8) / amp, sv = (gh / 2 - 8) / vmax;
        ctx.strokeStyle = COLORS.axis; ctx.beginPath(); ctx.moveTo(gx, cyp); ctx.lineTo(gx + gw, cyp); ctx.moveTo(cxp, gy); ctx.lineTo(cxp, gy + gh); ctx.stroke();
        ctx.strokeStyle = COLORS.e; ctx.lineWidth = 1.6; ctx.beginPath();
        hist.forEach(([, x, v], i) => (i ? ctx.lineTo(cxp + x * sx, cyp - v * sv) : ctx.moveTo(cxp + x * sx, cyp - v * sv)));
        ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cxp + st[0] * sx, cyp - st[1] * sv, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = COLORS.muted; ctx.fillText(mode === 'spring' ? '相图 (x, v)' : '相图 (θ, ω)', gx + 4, gy + 3);
      }
      const T0 = TAU / omega;
      if (mode === 'spring') S.setReadout(gam === 0 ? `$\\ddot x=-\\omega_0^2x$ 的解 $x=A\\cos(\\omega_0t+\\varphi)$：周期 $T=\\dfrac{2\\pi}{\\omega_0}=${T0.toFixed(3)}\\,$s，与振幅无关。下方紫点做匀速圆周运动，它的水平投影就是振子的位置。${phase ? '相图是一个椭圆：能量 $\\frac12v^2+\\frac12\\omega_0^2x^2$ 守恒。' : ''}` : gam < omega ? `欠阻尼 $\\ddot x+2\\gamma\\dot x+\\omega_0^2x=0$：$x=Ae^{-\\gamma t}\\cos(\\omega_dt+\\varphi)$，$\\omega_d=\\sqrt{\\omega_0^2-\\gamma^2}=${Math.sqrt(omega * omega - gam * gam).toFixed(3)}$，振幅按橙色包络 $e^{-\\gamma t}$ 衰减。${phase ? '相图螺旋收缩到原点。' : ''}` : '过阻尼（$\\gamma\\ge\\omega_0$）：不再振动，直接回到平衡位置。');
      else {
        const th = (theta0 * Math.PI) / 180, T = T0 / agm(1, Math.cos(th / 2));
        S.setReadout(`单摆 $\\ddot\\theta=-\\omega_0^2\\sin\\theta$（$\\omega_0^2=g/l$）。小角近似 $\\sin\\theta\\approx\\theta$ 给出 $T_0=2\\pi\\sqrt{l/g}=${T0.toFixed(3)}\\,$s；精确周期 $T=\\dfrac{T_0}{\\operatorname{AGM}(1,\\cos\\frac{\\theta_0}2)}=${T.toFixed(3)}\\,$s，摆角 $${theta0}^\\circ$ 时比 $T_0$ 长 $${((T / T0 - 1) * 100).toFixed(2)}\\%$${gam ? '（阻尼会使它变化）' : ''}。${phase ? '相图：小角时近似椭圆，大角时变尖；$\\theta_0\\to180^\\circ$ 时逼近分界线。' : ''}`);
      }
    });
    return { destroy: S.destroy };
  },
};

// ---- electric field of point charges
export const electricField = {
  id: 'electric-field',
  title: '点电荷的电场线',
  mount(host) {
    const S = stage(host, { height: 300, hint: '拖动电荷 · 双击切换正负' });
    const P = plot(S, { x0: -4, x1: 4, y0: -2.6, y1: 2.6, equal: true, pad: 8 });
    let qs = [{ x: -1.3, y: 0, q: 1 }, { x: 1.3, y: 0, q: -1 }], drag = -1, preset = 'dipole', vectors = false;
    const PRE = { dipole: [[-1.3, 0, 1], [1.3, 0, -1]], same: [[-1.3, 0, 1], [1.3, 0, 1]], unequal: [[-1.2, 0, 2], [1.4, 0, -1]], quad: [[-1, -1, 1], [1, -1, -1], [1, 1, 1], [-1, 1, -1]] };
    select(S, { label: '布置', value: preset, options: [['dipole', '电偶极子'], ['same', '两个同号'], ['unequal', '+2q 与 −q'], ['quad', '四极子']], onchange: (v) => { preset = v; qs = PRE[v].map(([x, y, q]) => ({ x, y, q })); } });
    checkbox(S, '场强箭头', vectors, (v) => { vectors = v; });
    button(S, '加正电荷', () => { qs.push({ x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 2, q: 1 }); });
    const E = (x, y) => { let ex = 0, ey = 0; for (const c of qs) { const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy, r3 = Math.max(1e-6, r2 * Math.sqrt(r2)); ex += (c.q * dx) / r3; ey += (c.q * dy) / r3; } return [ex, ey]; };
    let lastDown = 0;
    S.pointer({
      down: (px, py) => {
        const i = qs.findIndex((c) => Math.hypot(P.X(c.x) - px, P.Y(c.y) - py) < 16);
        const now = performance.now();
        if (i >= 0 && now - lastDown < 320) { qs[i].q = -qs[i].q; lastDown = 0; return true; }
        lastDown = now;
        drag = i; return i >= 0;
      },
      move: (px, py) => { if (drag >= 0) { qs[drag].x = P.ix(px); qs[drag].y = P.iy(py); } },
      up: () => { drag = -1; },
    });
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      const b = P.bounds();
      // potential shading
      if (vectors) {
        for (let x = b.x0 + 0.25; x < b.x1; x += 0.4) for (let y = b.y0 + 0.2; y < b.y1; y += 0.4) {
          const [ex, ey] = E(x, y), m = Math.hypot(ex, ey);
          if (m < 1e-6) continue;
          const len = Math.min(0.32, 0.12 + Math.log10(1 + m) * 0.12), a = Math.min(0.9, 0.2 + m * 0.4);
          arrow(ctx, P.X(x), P.Y(y), P.X(x + (ex / m) * len), P.Y(y + (ey / m) * len), { color: `rgba(200,214,255,${a})`, width: 1, head: 5 });
        }
      }
      // field lines: start around positive charges (proportional to q), and around negatives if net charge < 0
      const net = qs.reduce((s, c) => s + c.q, 0);
      const seeds = qs.filter((c) => (net >= 0 ? c.q > 0 : c.q < 0));
      ctx.lineWidth = 1.3;
      for (const c of seeds) {
        const n = 12 * Math.abs(c.q), dir = c.q > 0 ? 1 : -1;
        for (let k = 0; k < n; k++) {
          const a = ((k + 0.5) / n) * TAU;
          let x = c.x + 0.12 * Math.cos(a), y = c.y + 0.12 * Math.sin(a);
          ctx.strokeStyle = 'rgba(127,180,255,0.75)';
          ctx.beginPath(); ctx.moveTo(P.X(x), P.Y(y));
          let mid = null;
          for (let s = 0; s < 900; s++) {
            const h = 0.02;
            let [ex, ey] = E(x, y); let m = Math.hypot(ex, ey) || 1;
            const mx = x + dir * (ex / m) * h / 2, my = y + dir * (ey / m) * h / 2;
            [ex, ey] = E(mx, my); m = Math.hypot(ex, ey) || 1;
            x += dir * (ex / m) * h; y += dir * (ey / m) * h;
            ctx.lineTo(P.X(x), P.Y(y));
            if (s === 60) mid = [x, y, dir * ex / m, dir * ey / m];
            if (x < b.x0 - 1 || x > b.x1 + 1 || y < b.y0 - 1 || y > b.y1 + 1) break;
            if (qs.some((o) => o !== c && Math.hypot(x - o.x, y - o.y) < 0.08)) break;
          }
          ctx.stroke();
          if (mid) { const [mx, my, ux, uy] = mid; const X = P.X(mx), Y = P.Y(my), ang = Math.atan2(-uy, ux); ctx.fillStyle = 'rgba(127,180,255,0.9)'; ctx.beginPath(); ctx.moveTo(X + Math.cos(ang) * 5, Y + Math.sin(ang) * 5); ctx.lineTo(X + Math.cos(ang + 2.5) * 4, Y + Math.sin(ang + 2.5) * 4); ctx.lineTo(X + Math.cos(ang - 2.5) * 4, Y + Math.sin(ang - 2.5) * 4); ctx.fill(); }
        }
      }
      for (const c of qs) {
        const X = P.X(c.x), Y = P.Y(c.y), col = c.q > 0 ? '#ff6b6b' : '#5aa9ff';
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, 20); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, 20, 0, TAU); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(c.q > 0 ? (c.q > 1 ? '+2' : '+') : c.q < -1 ? '−2' : '−', X, Y + 0.5);
      }
      S.setReadout(`$\\boldsymbol E=\\sum_i\\dfrac{kq_i}{r_i^2}\\hat{\\boldsymbol r}_i$（叠加原理）。电场线从正电荷出发、终止于负电荷（或无穷远），切线方向即场强方向，疏密表示强弱；从每个电荷发出的条数正比于电荷量（高斯定理）。电场线互不相交。总电荷 $${net > 0 ? '+' : ''}${net}q$${net !== 0 ? '：远处看像一个点电荷' : '：远处场强按 $\\frac1{r^3}$ 衰减（偶极子）'}。`);
    });
    return { destroy: S.destroy };
  },
};

// ---- waves: two-source interference, standing waves, beats
export const waves = {
  id: 'waves',
  title: '波的叠加与干涉',
  mount(host) {
    const S = stage(host, { height: 300, hint: '移动鼠标查看程差' });
    let mode = 'two', d = 3, lam = 1, avg = false, t = 0, hover = null, img = null, data = null;
    select(S, { label: '情形', value: mode, options: [['two', '双波源干涉'], ['standing', '驻波'], ['beats', '拍']], onchange: (v) => { mode = v; } });
    slider(S, { label: '波源间距 $d$', min: 0.5, max: 6, step: 0.1, value: d, fmt: (v) => v.toFixed(1), oninput: (v) => { d = v; } });
    slider(S, { label: '波长 $\\lambda$', min: 0.4, max: 2, step: 0.05, value: lam, fmt: (v) => v.toFixed(2), oninput: (v) => { lam = v; } });
    checkbox(S, '时间平均强度', avg, (v) => { avg = v; });
    S.pointer({ down: () => false, hover: (x, y) => { hover = [x, y]; } });
    const P = plot(S, { x0: -8, x1: 8, y0: -4.6, y1: 4.6, equal: true, pad: 0 });
    S.loop((dt) => {
      t += dt / 1000;
      const { ctx, w, h } = S;
      S.clear();
      if (mode === 'two') {
        const W = Math.ceil(w / 3), H = Math.ceil(h / 3);
        if (!img || img.width !== W || img.height !== H) { img = new ImageData(W, H); data = document.createElement('canvas'); data.width = W; data.height = H; }
        const k = TAU / lam, om = 2.4, s1 = [-d / 2, 0], s2 = [d / 2, 0];
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          const x = P.ix(i * 3 + 1.5), y = P.iy(j * 3 + 1.5);
          const r1 = Math.hypot(x - s1[0], y - s1[1]) + 0.3, r2 = Math.hypot(x - s2[0], y - s2[1]) + 0.3;
          let v;
          if (avg) { const dphi = k * (r1 - r2); v = Math.cos(dphi / 2) ** 2 * 2 - 1; }
          else v = (Math.cos(k * r1 - om * t) + Math.cos(k * r2 - om * t)) / 2;
          const o = (j * W + i) * 4;
          if (avg) { img.data[o] = 40 + 215 * (v + 1) / 2 * 0.9; img.data[o + 1] = 60 + 150 * (v + 1) / 2; img.data[o + 2] = 120 + 120 * (v + 1) / 2; }
          else { const c = v > 0 ? v : 0, e = v < 0 ? -v : 0; img.data[o] = 10 + 245 * c * 0.9; img.data[o + 1] = 14 + 200 * c * 0.82 + 60 * e; img.data[o + 2] = 30 + 90 * c + 200 * e; }
          img.data[o + 3] = 255;
        }
        data.getContext('2d').putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(data, 0, 0, w, h);
        for (const s of [s1, s2]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.X(s[0]), P.Y(s[1]), 4, 0, TAU); ctx.fill(); }
        let extra = '';
        if (hover) {
          const x = P.ix(hover[0]), y = P.iy(hover[1]);
          const dr = Math.abs(Math.hypot(x - s1[0], y - s1[1]) - Math.hypot(x - s2[0], y - s2[1])) / lam;
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
          for (const s of [s1, s2]) { ctx.beginPath(); ctx.moveTo(P.X(s[0]), P.Y(s[1])); ctx.lineTo(hover[0], hover[1]); ctx.stroke(); }
          const frac = dr - Math.floor(dr);
          extra = `鼠标处程差 $|r_1-r_2|=${dr.toFixed(2)}\\lambda$：${frac < 0.15 || frac > 0.85 ? '接近整数倍，<b>加强</b>' : Math.abs(frac - 0.5) < 0.15 ? '接近半整数倍，<b>减弱</b>' : '介于两者之间'}。`;
        }
        const m = Math.floor(d / lam);
        S.setReadout(`两个同相波源（白点）。程差 $|r_1-r_2|=m\\lambda$ 处振动加强，$=(m+\\frac12)\\lambda$ 处减弱——减弱点连成一族以波源为焦点的双曲线（节线）。$d/\\lambda=${(d / lam).toFixed(2)}$，共有 $${2 * m + 1}$ 条加强线（含中垂线，$m\\le\\lfloor d/\\lambda\\rfloor$）。${extra}`);
      } else {
        const P2 = { X: (x) => 20 + ((x + 8) / 16) * (w - 40) };
        const k = TAU / lam, om = 2.4;
        const rows = mode === 'standing'
          ? [{ f: (x) => Math.cos(k * x - om * t), col: COLORS.a, lab: '向右' }, { f: (x) => Math.cos(k * x + om * t), col: COLORS.c, lab: '向左' }, { f: (x) => Math.cos(k * x - om * t) + Math.cos(k * x + om * t), col: COLORS.b, lab: '合成', env: (x) => 2 * Math.abs(Math.cos(k * x)) }]
          : [{ f: (x) => Math.cos(k * x - om * t), col: COLORS.a, lab: 'ω₁' }, { f: (x) => Math.cos(k * 1.12 * x - om * 1.12 * t), col: COLORS.c, lab: 'ω₂' }, { f: (x) => Math.cos(k * x - om * t) + Math.cos(k * 1.12 * x - om * 1.12 * t), col: COLORS.b, lab: '合成', env: (x) => 2 * Math.abs(Math.cos((k * 0.12 * x - om * 0.12 * t) / 2)) }];
        rows.forEach((r, i) => {
          const cy = h * (i === 2 ? 0.72 : 0.16 + i * 0.2), sc = i === 2 ? h * 0.11 : h * 0.07;
          ctx.strokeStyle = COLORS.grid; ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(w - 20, cy); ctx.stroke();
          if (r.env) for (const sg of [1, -1]) { ctx.strokeStyle = 'rgba(255,209,102,0.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); for (let q = 0; q <= 400; q++) { const x = -8 + (16 * q) / 400; const Y = cy - sg * r.env(x) * sc; q ? ctx.lineTo(P2.X(x), Y) : ctx.moveTo(P2.X(x), Y); } ctx.stroke(); ctx.setLineDash([]); }
          ctx.strokeStyle = r.col; ctx.lineWidth = i === 2 ? 2.2 : 1.6; ctx.beginPath();
          for (let q = 0; q <= 600; q++) { const x = -8 + (16 * q) / 600; const Y = cy - r.f(x) * sc; q ? ctx.lineTo(P2.X(x), Y) : ctx.moveTo(P2.X(x), Y); }
          ctx.stroke();
          ctx.fillStyle = r.col; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(r.lab, 22, cy - sc - 2);
        });
        if (mode === 'standing') {
          for (let n = -20; n <= 20; n++) { const x = (n + 0.5) * lam / 2; if (Math.abs(x) <= 8) { ctx.fillStyle = COLORS.d; ctx.beginPath(); ctx.arc(P2.X(x), h * 0.72, 3.5, 0, TAU); ctx.fill(); } }
          S.setReadout('两列振幅、频率相同、方向相反的波叠加：$\\cos(kx-\\omega t)+\\cos(kx+\\omega t)=2\\cos kx\\cos\\omega t$。形状不再传播，各点以振幅 $2|\\cos kx|$ 振动：绿点是始终不动的<b>波节</b>，相邻波节相距 $\\frac\\lambda2$，中间是波腹。');
        } else S.setReadout('两列频率接近的波叠加：$\\cos\\omega_1t+\\cos\\omega_2t=2\\cos\\frac{\\omega_1-\\omega_2}2t\\cdot\\cos\\frac{\\omega_1+\\omega_2}2t$。快速振动的振幅被慢变包络调制（虚线），听起来就是忽强忽弱的“拍”，拍频 $|f_1-f_2|$。调琴师正是靠消除拍来定音。');
      }
    });
    return { destroy: S.destroy };
  },
};

// ---- Young's double slit
function wavelengthRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; } else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else r = 1;
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  return [Math.round(255 * r * f), Math.round(255 * g * f), Math.round(255 * b * f)];
}
export const doubleSlit = {
  id: 'double-slit',
  title: '杨氏双缝干涉',
  mount(host) {
    const S = stage(host, { height: 300 });
    let lam = 550, d = 0.25, a = 0.05, photons = false, hits = [], acc = 0;
    const Lm = 1, Ymm = 10;
    slider(S, { label: '波长 $\\lambda$ (nm)', min: 380, max: 750, step: 5, value: lam, oninput: (v) => { lam = v; hits = []; } });
    slider(S, { label: '缝距 $d$ (mm)', min: 0.1, max: 1, step: 0.01, value: d, fmt: (v) => v.toFixed(2), oninput: (v) => { d = v; hits = []; } });
    slider(S, { label: '缝宽 $a$ (mm)', min: 0.01, max: 0.12, step: 0.005, value: a, fmt: (v) => v.toFixed(3), oninput: (v) => { a = v; hits = []; } });
    checkbox(S, '单光子逐个到达', photons, (v) => { photons = v; hits = []; });
    // y in mm on the screen at distance L = 1 m
    const I = (y) => {
      const s = (y * 1e-3) / Lm, l = lam * 1e-9;
      const beta = (Math.PI * a * 1e-3 * s) / l, alpha = (Math.PI * d * 1e-3 * s) / l;
      const sinc = Math.abs(beta) < 1e-9 ? 1 : Math.sin(beta) / beta;
      return Math.cos(alpha) ** 2 * sinc * sinc;
    };
    S.loop((dt) => {
      if (photons) { acc += dt * 0.25; while (acc > 1 && hits.length < 6000) { acc--; for (;;) { const y = (Math.random() * 2 - 1) * Ymm; if (Math.random() < I(y)) { hits.push([y, Math.random()]); break; } } } S.dirty = true; }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx, w, h } = S;
      S.clear();
      const [r, g, b] = wavelengthRGB(lam);
      // schematic
      const sx = Math.min(140, w * 0.22), slitX = sx * 0.55, cy = h / 2;
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`; ctx.beginPath(); ctx.arc(14, cy, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`; ctx.lineWidth = 1;
      for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.arc(14, cy, k * (slitX - 14) / 5.5, -0.5, 0.5); ctx.stroke(); }
      const gap = 8 + d * 30;
      ctx.fillStyle = 'rgba(200,214,255,0.5)';
      ctx.fillRect(slitX, 10, 4, cy - gap / 2 - 10 - 2); ctx.fillRect(slitX, cy - gap / 2 + 2, 4, gap - 4); ctx.fillRect(slitX, cy + gap / 2 + 2, 4, h - 10 - (cy + gap / 2 + 2));
      for (const sy of [cy - gap / 2, cy + gap / 2]) for (let k = 1; k < 5; k++) { ctx.strokeStyle = `rgba(${r},${g},${b},${0.3 - k * 0.05})`; ctx.beginPath(); ctx.arc(slitX + 4, sy, k * 14, -1.2, 1.2); ctx.stroke(); }
      // screen
      const scX = sx + 10, scW = Math.min(46, w * 0.08), Y = (y) => cy - (y / Ymm) * (h / 2 - 12);
      if (!photons) {
        for (let py = 12; py < h - 12; py++) { const y = ((cy - py) / (h / 2 - 12)) * Ymm, v = I(y); ctx.fillStyle = `rgba(${r},${g},${b},${v})`; ctx.fillRect(scX, py, scW, 1); }
      } else {
        ctx.fillStyle = '#000'; ctx.fillRect(scX, 12, scW, h - 24);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        for (const [y, u] of hits) ctx.fillRect(scX + u * (scW - 2), Y(y), 1.6, 1.6);
      }
      ctx.strokeStyle = 'rgba(200,214,255,0.3)'; ctx.strokeRect(scX, 12, scW, h - 24);
      // intensity curve
      const gx = scX + scW + 16, gw = w - gx - 14;
      ctx.strokeStyle = COLORS.grid; ctx.beginPath(); ctx.moveTo(gx, 12); ctx.lineTo(gx, h - 12); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([4, 4]); ctx.beginPath();
      for (let py = 12; py <= h - 12; py += 2) { const y = ((cy - py) / (h / 2 - 12)) * Ymm, s = (y * 1e-3) / Lm, be = (Math.PI * a * 1e-3 * s) / (lam * 1e-9), env = Math.abs(be) < 1e-9 ? 1 : (Math.sin(be) / be) ** 2; py === 12 ? ctx.moveTo(gx + env * gw, py) : ctx.lineTo(gx + env * gw, py); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = `rgb(${r},${g},${b})`; ctx.lineWidth = 1.8; ctx.beginPath();
      for (let py = 12; py <= h - 12; py++) { const y = ((cy - py) / (h / 2 - 12)) * Ymm; py === 12 ? ctx.moveTo(gx + I(y) * gw, py) : ctx.lineTo(gx + I(y) * gw, py); }
      ctx.stroke();
      if (photons) {
        const bins = new Array(60).fill(0); for (const [y] of hits) bins[Math.min(59, Math.floor(((y + Ymm) / (2 * Ymm)) * 60))]++;
        const mx = Math.max(1, ...bins); ctx.fillStyle = 'rgba(255,209,102,0.35)';
        bins.forEach((c, i) => { const y0 = Y(-Ymm + (i * 2 * Ymm) / 60), y1 = Y(-Ymm + ((i + 1) * 2 * Ymm) / 60); ctx.fillRect(gx, y1, (c / mx) * gw * 0.95, y0 - y1 - 1); });
      }
      ctx.fillStyle = COLORS.muted; ctx.font = `10px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`屏上 ±${Ymm} mm，L = ${Lm} m`, gx + 4, 14);
      const dy = (lam * 1e-9 * Lm) / (d * 1e-3) * 1e3;
      S.setReadout(`条纹间距 $\\Delta y=\\dfrac{L\\lambda}{d}=${dy.toFixed(2)}\\,\\mathrm{mm}$。光强 $I=I_0\\cos^2\\!\\dfrac{\\pi dy}{\\lambda L}\\cdot\\operatorname{sinc}^2\\!\\dfrac{\\pi ay}{\\lambda L}$：双缝干涉的细条纹被单缝衍射的包络（虚线）调制。${photons ? `已到达 $${hits.length}$ 个光子：每个光子落点随机，但大量光子的分布正是干涉图样——概率幅叠加，这就是波粒二象性。` : '波长越长、缝距越小，条纹越宽。'}`);
    });
    return { destroy: S.destroy };
  },
};

// ---- reflection and refraction
const MEDIA = [['1', '空气 1.00'], ['1.33', '水 1.33'], ['1.5', '玻璃 1.50'], ['2.42', '钻石 2.42']];
export const refraction = {
  id: 'refraction',
  title: '反射、折射与全反射',
  mount(host) {
    const S = stage(host, { height: 300, hint: '拖动光源' });
    let n1 = 1, n2 = 1.5, th = 0.7, drag = false;
    select(S, { label: '上层', value: '1', options: MEDIA, onchange: (v) => { n1 = +v; } });
    select(S, { label: '下层', value: '1.5', options: MEDIA, onchange: (v) => { n2 = +v; } });
    button(S, '水 → 空气', () => { n1 = 1.33; n2 = 1; S.controls.querySelectorAll('select')[0].value = '1.33'; S.controls.querySelectorAll('select')[1].value = '1'; });
    S.pointer({
      down: (x, y) => { drag = true; set(x, y); return true; },
      move: (x, y) => { if (drag) set(x, y); },
      up: () => { drag = false; },
    });
    const set = (x, y) => { const cx = S.w / 2, cy = S.h / 2; if (y >= cy - 2) return; th = Math.max(0, Math.min(1.55, Math.atan2(cx - x, cy - y))); };
    S.loop(() => {
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx, w, h } = S;
      S.clear();
      const cx = w / 2, cy = h / 2, L = Math.min(w, h * 2) * 0.46;
      ctx.fillStyle = `rgba(127,180,255,${0.04 + (n1 - 1) * 0.12})`; ctx.fillRect(0, 0, w, cy);
      ctx.fillStyle = `rgba(127,180,255,${0.04 + (n2 - 1) * 0.12})`; ctx.fillRect(0, cy, w, h - cy);
      ctx.strokeStyle = 'rgba(200,214,255,0.4)'; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx, 6); ctx.lineTo(cx, h - 6); ctx.stroke(); ctx.setLineDash([]);
      const s2 = (n1 / n2) * Math.sin(th);
      const tir = s2 > 1;
      const t2 = tir ? null : Math.asin(s2);
      let R = 1;
      if (!tir) {
        const ci = Math.cos(th), ct = Math.cos(t2);
        const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
        R = (rs * rs + rp * rp) / 2;
      }
      const src = [cx - L * Math.sin(th), cy - L * Math.cos(th)];
      const beam = (x1, y1, x2, y2, alpha, wd) => { ctx.strokeStyle = `rgba(255,209,102,${alpha})`; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
      ctx.shadowColor = 'rgba(255,209,102,0.8)'; ctx.shadowBlur = 8;
      beam(src[0], src[1], cx, cy, 1, 3);
      beam(cx, cy, cx + L * Math.sin(th), cy - L * Math.cos(th), Math.max(0.08, R), 1 + 2 * R);
      if (!tir) beam(cx, cy, cx + L * Math.sin(t2), cy + L * Math.cos(t2), Math.max(0.1, 1 - R), 1 + 2 * (1 - R));
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.b; ctx.beginPath(); ctx.arc(src[0], src[1], 7, 0, TAU); ctx.fill();
      const arc = (a0, a1, r, col) => { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); };
      arc(-Math.PI / 2 - th, -Math.PI / 2, 40, COLORS.b);
      if (!tir) arc(Math.PI / 2 - t2, Math.PI / 2, 40, COLORS.d);
      ctx.font = `12px ${FONT}`; ctx.fillStyle = COLORS.b; ctx.textAlign = 'right'; ctx.fillText(`θ₁ = ${((th * 180) / Math.PI).toFixed(1)}°`, cx - 8, cy - 48);
      if (!tir) { ctx.fillStyle = COLORS.d; ctx.textAlign = 'left'; ctx.fillText(`θ₂ = ${((t2 * 180) / Math.PI).toFixed(1)}°`, cx + 8, cy + 56); }
      ctx.fillStyle = COLORS.muted; ctx.textAlign = 'left'; ctx.fillText(`n₁ = ${n1}`, 10, 18); ctx.fillText(`n₂ = ${n2}`, 10, h - 12);
      const crit = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;
      S.setReadout(`斯涅尔定律 $n_1\\sin\\theta_1=n_2\\sin\\theta_2$；反射角等于入射角。${tir ? `<b>全反射</b>：$\\frac{n_1}{n_2}\\sin\\theta_1=${s2.toFixed(3)}>1$，没有折射光，光全部反射回来（光纤的原理）。` : `$\\theta_2=${((t2 * 180) / Math.PI).toFixed(1)}^\\circ$，反射率（菲涅耳公式、自然光）$R=${(R * 100).toFixed(1)}\\%$，光线粗细代表能量分配。`}${crit !== null ? `从光密到光疏介质，临界角 $\\theta_c=\\arcsin\\frac{n_2}{n_1}=${crit.toFixed(1)}^\\circ$。` : ''}费马原理：光沿用时最短的路径走，由此可推出折射定律。`);
    });
    return { destroy: S.destroy };
  },
};

// ---- light clock: time dilation
export const lightClock = {
  id: 'light-clock',
  title: '光钟与时间膨胀',
  mount(host) {
    const S = stage(host, { height: 290 });
    let beta = 0.6, t = 0, trail = [];
    slider(S, { label: '$v/c$', min: 0, max: 0.98, step: 0.01, value: beta, fmt: (v) => v.toFixed(2), oninput: (v) => { beta = v; t = 0; trail = []; } });
    button(S, '重新开始', () => { t = 0; trail = []; });
    S.loop((dt) => {
      t += dt / 1000;
      const { ctx, w, h } = S;
      S.clear();
      const gamma = 1 / Math.sqrt(1 - beta * beta);
      const Lc = h * 0.3, c = Lc / 0.75; // the light takes 0.75 s to cross the clock at rest
      const tick = (2 * Lc) / c;
      const lane = (y0, label) => { ctx.fillStyle = COLORS.muted; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(label, 10, y0 - Lc - 22); };
      const drawClock = (x, yb, py, col) => {
        ctx.fillStyle = 'rgba(200,214,255,0.7)'; ctx.fillRect(x - 16, yb - Lc - 3, 32, 3); ctx.fillRect(x - 16, yb, 32, 3);
        ctx.strokeStyle = 'rgba(200,214,255,0.2)'; ctx.strokeRect(x - 16, yb - Lc, 32, Lc);
        const g = ctx.createRadialGradient(x, py, 0, x, py, 10); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, py, 10, 0, TAU); ctx.fill();
      };
      const tri = (u) => { const f = u % 2; return f < 1 ? f : 2 - f; };
      // rest clock
      const yb1 = h * 0.45, x1 = 60;
      const p1 = tri(t / (tick / 2));
      lane(yb1, '静止的光钟');
      drawClock(x1, yb1, yb1 - p1 * Lc, COLORS.b);
      // moving clock (seen from the ground)
      const yb2 = h * 0.92, span = w - 150;
      const vx = beta * c, x2 = 130 + ((vx * t) % span);
      const p2 = tri(t / ((gamma * tick) / 2));
      const py2 = yb2 - p2 * Lc;
      trail.push([x2, py2]);
      if ((trail.length > 1 && trail[trail.length - 1][0] < trail[trail.length - 2][0]) || trail.length > 3000) trail = [[x2, py2]];
      ctx.strokeStyle = 'rgba(255,138,101,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath();
      trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      lane(yb2, `以 v = ${beta.toFixed(2)}c 运动的光钟（地面看）`);
      drawClock(x2, yb2, py2, COLORS.c);
      const n1 = Math.floor(t / tick), n2 = Math.floor(t / (gamma * tick));
      ctx.font = `13px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.b; ctx.fillText(`滴答 ${n1}`, w - 12, yb1 - Lc - 22);
      ctx.fillStyle = COLORS.c; ctx.fillText(`滴答 ${n2}`, w - 12, yb2 - Lc - 22);
      // γ(β) inset
      const ix = w - 150, iy = yb1 - Lc + 4, iw = 136, ih = Lc - 4;
      ctx.strokeStyle = COLORS.grid; ctx.strokeRect(ix, iy, iw, ih);
      ctx.strokeStyle = COLORS.e; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let i = 0; i <= 100; i++) { const bb = (i / 100) * 0.98, gg = 1 / Math.sqrt(1 - bb * bb); const X = ix + (bb / 1) * iw, Y = iy + ih - ((gg - 1) / 4) * ih; i ? ctx.lineTo(X, Math.max(iy, Y)) : ctx.moveTo(X, Y); }
      ctx.stroke();
      ctx.fillStyle = COLORS.e; ctx.beginPath(); ctx.arc(ix + beta * iw, Math.max(iy, iy + ih - ((gamma - 1) / 4) * ih), 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = COLORS.muted; ctx.font = `10px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('γ(v/c)', ix + 4, iy + 3);
      S.setReadout(`光在镜子间往返一次是钟的一次“滴答”。地面看来，运动光钟里的光走斜线，路程更长；光速不变，所以它走得慢：$\\Delta t=\\gamma\\Delta\\tau$，$\\gamma=\\dfrac1{\\sqrt{1-v^2/c^2}}=${gamma.toFixed(3)}$。由勾股定理 $(c\\Delta t/2)^2=(v\\Delta t/2)^2+L^2$ 即得。运动方向上的长度则收缩为 $\\frac{L}{\\gamma}$。`);
    });
    return { destroy: S.destroy };
  },
};
