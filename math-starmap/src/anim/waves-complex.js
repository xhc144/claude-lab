// Fourier partial sums (with epicycles and spectrum) and complex multiplication / Euler's formula.
import { stage, slider, select, checkbox, plot, arrow, COLORS, TAU, FONT } from './kit.js';

const WAVES = {
  square: { name: '方波', f: (x) => (((x % TAU) + TAU) % TAU < Math.PI ? 1 : -1), b: (n) => (n % 2 ? 4 / (Math.PI * n) : 0), a: () => 0 },
  saw: { name: '锯齿波', f: (x) => { const t = ((x + Math.PI) % TAU + TAU) % TAU - Math.PI; return t / Math.PI; }, b: (n) => (2 * (n % 2 ? 1 : -1)) / (Math.PI * n), a: () => 0 },
  tri: { name: '三角波', f: (x) => { const t = ((x % TAU) + TAU) % TAU; return t < Math.PI ? 1 - (2 * t) / Math.PI : -3 + (2 * t) / Math.PI; }, b: () => 0, a: (n) => (n % 2 ? 8 / (Math.PI * Math.PI * n * n) : 0) },
};

export const fourierSeries = {
  id: 'fourier-series',
  title: '傅里叶级数的部分和',
  mount(host) {
    const S = stage(host, { height: 300 });
    let key = 'square', N = 5, epi = true, t = 0;
    select(S, { label: '波形', value: key, options: Object.entries(WAVES).map(([k, v]) => [k, v.name]), onchange: (v) => { key = v; } });
    slider(S, { label: '项数 $N$', min: 1, max: 60, step: 1, value: N, oninput: (v) => { N = v; } });
    checkbox(S, '本轮（旋转圆）', epi, (v) => { epi = v; });
    S.loop((dt) => {
      t = (t + dt * 0.0006) % TAU;
      const W = WAVES[key];
      const { ctx, w, h } = S;
      S.clear();
      const left = epi ? Math.min(w * 0.32, 200) : 20;
      const gx0 = left + 20, gw = w - gx0 - 16, cy = h * 0.42, amp = h * 0.24;
      const X = (x) => gx0 + (x / (2 * TAU)) * gw;
      const Y = (y) => cy - y * amp;
      // axes
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx0, cy); ctx.lineTo(gx0 + gw, cy); ctx.stroke();
      // target
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k <= 600; k++) { const x = (k / 600) * 2 * TAU; const y = W.f(x); k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
      ctx.stroke();
      // partial sum
      const S_N = (x) => { let s = 0; for (let n = 1; n <= N; n++) s += W.a(n) * Math.cos(n * x) + W.b(n) * Math.sin(n * x); return s; };
      ctx.strokeStyle = COLORS.b; ctx.lineWidth = 2; ctx.beginPath();
      let peak = 0;
      for (let k = 0; k <= 800; k++) { const x = (k / 800) * 2 * TAU; const y = S_N(x); peak = Math.max(peak, y); k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
      ctx.stroke();
      // epicycles: sum of rotating vectors gives the value at angle t
      if (epi) {
        let px = left * 0.55, py = cy;
        const scale = amp;
        for (let n = 1; n <= N; n++) {
          const r = Math.hypot(W.a(n), W.b(n)) * scale;
          if (r < 0.3) continue;
          const ph = Math.atan2(W.a(n), W.b(n));
          ctx.strokeStyle = 'rgba(127,180,255,0.25)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke();
          const nx = px + r * Math.cos(n * t + ph), ny = py - r * Math.sin(n * t + ph);
          ctx.strokeStyle = 'rgba(200,220,255,0.8)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
          px = nx; py = ny;
        }
        ctx.fillStyle = COLORS.b; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,209,102,0.45)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(X(t), py); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = COLORS.b; ctx.beginPath(); ctx.arc(X(t), Y(S_N(t)), 3.5, 0, TAU); ctx.fill();
      }
      // spectrum
      const sy = h - 14, bw = Math.max(2, Math.min(10, gw / 70));
      ctx.fillStyle = COLORS.muted; ctx.font = `10px ${FONT}`; ctx.fillText('频谱', gx0, sy - 40);
      for (let n = 1; n <= Math.min(N, 60); n++) {
        const c = Math.hypot(W.a(n), W.b(n));
        ctx.fillStyle = 'rgba(255,209,102,0.85)';
        ctx.fillRect(gx0 + 30 + n * (bw + 2), sy - c * 36, bw, c * 36);
      }
      S.setReadout(`金线是前 $${N}$ 项部分和。${key === 'square' ? `方波只含奇次正弦 $\\frac4\\pi\\sum\\frac{\\sin(2k-1)x}{2k-1}$；部分和最大值 $${peak.toFixed(3)}$，在间断点附近冲过约 $9\\%$——吉布斯现象，项数再多也不消失。` : key === 'tri' ? '三角波连续，系数按 $\\frac1{n^2}$ 衰减，收敛快得多，没有吉布斯过冲。' : '锯齿波含全部正弦项，系数按 $\\frac1n$ 衰减。'}左边的旋转圆（本轮）一个套一个转动，末端的高度就是部分和的值。`);
    });
    return { destroy: S.destroy };
  },
};

export const complexMult = {
  id: 'complex-mult',
  title: '复数乘法：旋转与伸缩',
  mount(host) {
    const S = stage(host, { height: 300, hint: '拖动 z 与 w' });
    let z = [1.2, 0.5], w = [0.6, 0.9], drag = null, euler = false, th = 0;
    const P = plot(S, { x0: -2.6, x1: 2.6, y0: -2, y1: 2, equal: true });
    checkbox(S, '欧拉公式 $e^{i\\theta}$', euler, (v) => { euler = v; });
    S.pointer({
      down: (x, y) => { if (euler) return false; const p = [P.ix(x), P.iy(y)]; const dz = Math.hypot(p[0] - z[0], p[1] - z[1]), dw = Math.hypot(p[0] - w[0], p[1] - w[1]); drag = dz < dw ? 'z' : 'w'; return true; },
      move: (x, y) => { const p = [P.ix(x), P.iy(y)]; if (drag === 'z') z = p; else w = p; },
    });
    S.loop((dt) => {
      if (euler) th = (th + dt * 0.0007) % TAU;
      else if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      P.axes(ctx, { xstep: 1, ystep: 1 });
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(P.X(0), P.Y(0), P.sx, 0, TAU); ctx.stroke();
      const O = [P.X(0), P.Y(0)];
      if (euler) {
        const p = [Math.cos(th), Math.sin(th)];
        ctx.strokeStyle = COLORS.e; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(O[0], O[1], P.sx * 0.3, 0, -th, true); ctx.stroke();
        P.line(ctx, p[0], 0, p[0], p[1], { color: COLORS.a, width: 2.5 });
        P.line(ctx, 0, 0, p[0], 0, { color: COLORS.b, width: 2.5 });
        arrow(ctx, O[0], O[1], P.X(p[0]), P.Y(p[1]), { color: '#fff', width: 2 });
        // velocity i·e^{iθ}
        arrow(ctx, P.X(p[0]), P.Y(p[1]), P.X(p[0] - 0.6 * p[1]), P.Y(p[1] + 0.6 * p[0]), { color: COLORS.c, width: 1.8 });
        S.setReadout(`$e^{i\\theta}=\\cos\\theta+i\\sin\\theta$，$\\theta=${(th / Math.PI).toFixed(2)}\\pi$：实部 $${p[0].toFixed(3)}$（金），虚部 $${p[1].toFixed(3)}$（蓝）。速度 $\\frac{d}{d\\theta}e^{i\\theta}=ie^{i\\theta}$（橙）始终垂直于半径——匀速圆周运动。$\\theta=\\pi$ 时 $e^{i\\pi}=-1$。`);
        return;
      }
      const zw = [z[0] * w[0] - z[1] * w[1], z[0] * w[1] + z[1] * w[0]];
      const az = Math.atan2(z[1], z[0]), aw = Math.atan2(w[1], w[0]);
      const arc = (r, a0, a1, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(O[0], O[1], r, -a0, -a1, a1 > a0); ctx.stroke(); };
      arc(26, 0, az, COLORS.a); arc(34, az, az + aw, COLORS.d);
      arrow(ctx, O[0], O[1], P.X(z[0]), P.Y(z[1]), { color: COLORS.a, width: 2.2 });
      arrow(ctx, O[0], O[1], P.X(w[0]), P.Y(w[1]), { color: COLORS.d, width: 2.2 });
      arrow(ctx, O[0], O[1], P.X(zw[0]), P.Y(zw[1]), { color: COLORS.b, width: 2.6 });
      P.text(ctx, 'z', z[0], z[1], { color: COLORS.a, dx: 8, dy: -8, size: 13 });
      P.text(ctx, 'w', w[0], w[1], { color: COLORS.d, dx: 8, dy: -8, size: 13 });
      P.text(ctx, 'zw', zw[0], zw[1], { color: COLORS.b, dx: 8, dy: -8, size: 13 });
      const r = (v) => Math.hypot(v[0], v[1]).toFixed(2), deg = (a) => ((a * 180) / Math.PI).toFixed(0);
      S.setReadout(`$|zw|=|z|\\cdot|w|=${r(z)}\\times${r(w)}=${r(zw)}$，$\\arg(zw)=\\arg z+\\arg w=${deg(az)}^\\circ+${deg(aw)}^\\circ$。乘以 $w$ 就是把平面旋转 $\\arg w$、再伸缩 $|w|$ 倍。`);
    });
    return { destroy: S.destroy };
  },
};
