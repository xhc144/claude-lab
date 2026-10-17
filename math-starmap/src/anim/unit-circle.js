import { stage, slider, checkbox, plot, COLORS, TAU, FONT } from './kit.js';

// The unit circle drives sine and cosine: the point (cos θ, sin θ) runs round the circle while the
// graph of sin θ is traced to the right.
export default {
  id: 'unit-circle',
  title: '单位圆与三角函数',
  mount(host) {
    const S = stage(host, { height: 270, hint: '拖动圆上的点' });
    let theta = 0.8, playing = true;
    const play = checkbox(S, '自动旋转', true, (v) => { playing = v; });
    const sl = slider(S, { label: '$\\theta$', min: 0, max: TAU, step: 0.01, value: theta, fmt: (v) => `${(v / Math.PI).toFixed(2)}π`, oninput: (v) => { theta = v; playing = false; play.checked = false; } });
    let P;
    const layout = () => {
      const R = Math.min(S.h * 0.36, S.w * 0.17);
      P = { cx: R + 30, cy: S.h / 2, R, gx: R * 2 + 70, gw: S.w - (R * 2 + 70) - 20 };
    };
    S.onResize(layout); layout();
    S.pointer({
      down: (x, y) => Math.hypot(x - P.cx, y - P.cy) < P.R * 1.4 ? (playing = false, play.checked = false, setAngle(x, y), true) : false,
      move: (x, y) => setAngle(x, y),
    });
    function setAngle(x, y) { theta = (Math.atan2(-(y - P.cy), x - P.cx) + TAU) % TAU; sl.set(theta); }
    S.loop((dt) => {
      if (playing) { theta = (theta + dt * 0.0008) % TAU; sl.set(theta); S.dirty = true; }
      if (!S.dirty) return;
      S.dirty = false;
      const { ctx } = S;
      S.clear();
      const { cx, cy, R, gx, gw } = P;
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - R - 14, cy); ctx.lineTo(gx + gw, cy); ctx.moveTo(cx, cy - R - 14); ctx.lineTo(cx, cy + R + 14); ctx.stroke();
      ctx.strokeStyle = COLORS.axis; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      const px = cx + Math.cos(theta) * R, py = cy - Math.sin(theta) * R;
      // angle arc
      ctx.strokeStyle = COLORS.e; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, -theta, true); ctx.stroke();
      // cos (horizontal) and sin (vertical) legs
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.b; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke();
      ctx.strokeStyle = COLORS.a; ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      // graph of sin and cos over [0, 2π]
      const X = (t) => gx + (t / TAU) * gw;
      ctx.strokeStyle = 'rgba(127,180,255,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let k = 0; k <= 200; k++) { const t = (k / 200) * TAU; const y = cy - Math.sin(t) * R; k ? ctx.lineTo(X(t), y) : ctx.moveTo(X(t), y); } ctx.stroke();
      ctx.strokeStyle = 'rgba(255,209,102,0.3)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); for (let k = 0; k <= 200; k++) { const t = (k / 200) * TAU; const y = cy - Math.cos(t) * R; k ? ctx.lineTo(X(t), y) : ctx.moveTo(X(t), y); } ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.a; ctx.lineWidth = 2.5;
      ctx.beginPath(); for (let k = 0; k <= 200; k++) { const t = (k / 200) * theta; const y = cy - Math.sin(t) * R; k ? ctx.lineTo(X(t), y) : ctx.moveTo(X(t), y); } ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(X(theta), py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = COLORS.a; ctx.beginPath(); ctx.arc(X(theta), py, 4, 0, TAU); ctx.fill();
      ctx.font = `11px ${FONT}`; ctx.fillStyle = COLORS.muted; ctx.textAlign = 'center';
      for (const [t, s] of [[Math.PI / 2, 'π/2'], [Math.PI, 'π'], [1.5 * Math.PI, '3π/2'], [TAU, '2π']]) ctx.fillText(s, X(t), cy + 14);
      const s = Math.sin(theta), c = Math.cos(theta);
      S.setReadout(`$\\cos\\theta = ${c.toFixed(3)}$（金），$\\sin\\theta = ${s.toFixed(3)}$（蓝），$\\tan\\theta = ${Math.abs(c) < 1e-3 ? '\\text{不存在}' : (s / c).toFixed(3)}$，且 $\\sin^2\\theta+\\cos^2\\theta = 1$。`);
    });
    return { destroy: S.destroy };
  },
};
