// Beyond geometry: Nash equilibrium, Hex, fair rent division.
import { C, RGB, FONT, clamp, lerp, ease, smooth, ramp, rng, glowDot, ring, arrow, text, hexA, L, background, panel, strokePoly, polyAt } from '../lib.js';
import { grid, isRainbow } from './tri.js';

const CXS = [360, 960, 1560], TOP = 170, CW = 540, CH = 640;
let HEX, RENT;

// ---------------------------------------------------------------- Hex
function buildHex() {
  const n = 9, r = rng(1979);
  const cells = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push([i, j]);
  for (let k = cells.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [cells[k], cells[m]] = [cells[m], cells[k]]; }
  const owner = new Map();
  cells.forEach(([i, j], k) => owner.set(`${i},${j}`, k % 2));     // 0 red (top-bottom), 1 blue (left-right)
  const nb = (i, j) => [[i - 1, j], [i - 1, j + 1], [i, j - 1], [i, j + 1], [i + 1, j - 1], [i + 1, j]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n);
  const bfs = (p) => {
    const prev = new Map(), q = [];
    for (let k = 0; k < n; k++) {
      const s = p === 0 ? [0, k] : [k, 0];
      if (owner.get(`${s[0]},${s[1]}`) === p) { q.push(s); prev.set(`${s[0]},${s[1]}`, null); }
    }
    while (q.length) {
      const [i, j] = q.shift();
      if ((p === 0 && i === n - 1) || (p === 1 && j === n - 1)) {
        const path = [];
        let cur = `${i},${j}`;
        while (cur) { path.push(cur.split(',').map(Number)); cur = prev.get(cur); }
        return path.reverse();
      }
      for (const [a, b] of nb(i, j)) {
        const key = `${a},${b}`;
        if (owner.get(key) === p && !prev.has(key)) { prev.set(key, `${i},${j}`); q.push([a, b]); }
      }
    }
    return null;
  };
  const red = bfs(0), blue = bfs(1);
  return { n, order: cells, owner, winner: red ? 0 : 1, path: red || blue, both: !!(red && blue) };
}

function hexPath(ctx, x, y, s) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    ctx[k ? 'lineTo' : 'moveTo'](x + s * Math.cos(a), y + s * Math.sin(a));
  }
  ctx.closePath();
}

// ---------------------------------------------------------------- rent: a small Sperner triangle
function buildRent() {
  const g = grid(6), r = rng(7);
  const col = [];
  for (const v of g.verts) {
    if (!v) continue;
    const { i, j } = v, n = 6;
    let c;
    if (i === 0 && j === 0) c = 0; else if (i === n) c = 1; else if (j === n) c = 2;
    else if (j === 0) c = r() < 0.5 ? 0 : 1; else if (i === 0) c = r() < 0.5 ? 0 : 2; else if (i + j === n) c = r() < 0.5 ? 1 : 2;
    else c = Math.floor(r() * 3);
    col[v.id] = c;
  }
  const rainbow = g.tris.map((_, k) => k).filter((k) => isRainbow(g, col, k));
  return { g, col, rainbow };
}

export default {
  init() {
    HEX = buildHex();
    RENT = buildRent();
    window.HEX = { winner: HEX.winner, both: HEX.both, len: HEX.path.length };
  },
  draw(ctx, t, S) {
    background(ctx);
    const zh = S.lang === 'zh';
    const font = zh ? FONT.zh : FONT.sans;
    const tf = zh ? FONT.zhSerif : FONT.serif;
    const [c0, c1, c2, c3, c4] = Array.from({ length: 5 }, (_, i) => S.cue(i));
    text(ctx, L(S.lang, 'Far beyond geometry', '远远超出几何'), 960, 110, { size: 50, weight: 700, align: 'center', font: tf, alpha: ramp(t, c0, 0.6) });
    const heads = [
      [L(S.lang, 'Game theory', '博弈论'), L(S.lang, 'Nash equilibrium', '纳什均衡')],
      [L(S.lang, 'Board games', '棋盘游戏'), L(S.lang, 'Hex never ends in a draw', '六贯棋 Hex 没有平局')],
      [L(S.lang, 'Fair division', '公平分配'), L(S.lang, 'Envy-free rent', '无嫉妒分房租')],
    ];
    const st = [c1, c3, c4];
    for (let k = 0; k < 3; k++) {
      const a = ramp(t, c0 + 0.4 + 0.25 * k, 0.6);
      const x0 = CXS[k] - CW / 2;
      panel(ctx, x0, TOP, CW, CH, a);
      const on = ramp(t, st[k] - 0.2, 0.6);
      const dimmed = 0.35 + 0.65 * on;
      text(ctx, heads[k][0], CXS[k], TOP + 58, { size: 26, color: C.dim, align: 'center', alpha: a * dimmed, font });
      text(ctx, heads[k][1], CXS[k], TOP + 108, { size: 38, weight: 700, align: 'center', alpha: a * dimmed, font });
    }

    // ---- Nash: strategy triangle, an improvement map, and its fixed point
    {
      const a = ramp(t, c1 - 0.2, 0.6);
      const cx = CXS[0], cy = TOP + 390, s = 178;
      const P = [[cx - s, cy + s * 0.58], [cx + s, cy + s * 0.58], [cx, cy - s * 1.15]];
      const ctr = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3];
      if (a > 0) {
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(120,140,200,0.08)'; ctx.strokeStyle = 'rgba(210,220,255,0.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(...P[0]); ctx.lineTo(...P[1]); ctx.lineTo(...P[2]); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        const names = zh ? ['石头', '布', '剪刀'] : ['Rock', 'Paper', 'Scissors'];
        text(ctx, names[0], P[0][0] - 6, P[0][1] + 34, { size: 26, align: 'center', alpha: a, font, color: C.dim });
        text(ctx, names[1], P[1][0] + 6, P[1][1] + 34, { size: 26, align: 'center', alpha: a, font, color: C.dim });
        text(ctx, names[2], P[2][0], P[2][1] - 18, { size: 26, align: 'center', alpha: a, font, color: C.dim });
        // illustrative improvement map: turn toward the better reply, pulled to the mix (1/3,1/3,1/3)
        const th = 0.7, k = 0.82;
        const F = ([x, y]) => [ctr[0] + k * (Math.cos(th) * (x - ctr[0]) - Math.sin(th) * (y - ctr[1])), ctr[1] + k * (Math.sin(th) * (x - ctr[0]) + Math.cos(th) * (y - ctr[1]))];
        for (let i = 0; i <= 8; i++) for (let j = 0; i + j <= 8; j++) {
          const l = [(8 - i - j) / 8, i / 8, j / 8];
          const p = [l[0] * P[0][0] + l[1] * P[1][0] + l[2] * P[2][0], l[0] * P[0][1] + l[1] * P[1][1] + l[2] * P[2][1]];
          const q = F(p);
          arrow(ctx, p[0], p[1], lerp(p[0], q[0], 0.45), lerp(p[1], q[1], 0.45), { color: C.violet, width: 2, head: 8, alpha: 0.6 * a });
        }
        const pts = [[lerp(P[0][0], P[1][0], 0.15), P[0][1] - 12]];
        for (let i = 0; i < 26; i++) pts.push(F(pts[pts.length - 1]));
        const u = ramp(t, c1 + 1.2, 4.5, (x) => x);
        const at = polyAt(pts, u);
        strokePoly(ctx, at.prefix, { color: C.gold, width: 3.5, glow: C.gold, alpha: a });
        glowDot(ctx, at.p[0], at.p[1], 6, C.gold, a);
        const eq = ramp(t, c1 + 5.4, 0.6);
        glowDot(ctx, ctr[0], ctr[1], 9, C.gold, eq, 4);
        text(ctx, '(⅓, ⅓, ⅓)', ctr[0] + 18, ctr[1] - 16, { size: 28, font: FONT.serif, color: C.gold, alpha: eq, weight: 600 });
        text(ctx, L(S.lang, 'John Nash, 1950', '约翰·纳什，1950 年'), cx, TOP + CH - 68, { size: 28, align: 'center', alpha: a, font });
        const nob = ramp(t, c2, 0.6);
        text(ctx, L(S.lang, 'Nobel Prize in Economics, 1994', '1994 年诺贝尔经济学奖'), cx, TOP + CH - 28, { size: 26, align: 'center', color: C.gold, alpha: nob, font, weight: 600 });
      }
    }

    // ---- Hex
    {
      const a = ramp(t, c3 - 0.2, 0.6);
      if (a > 0) {
        const n = HEX.n, s = 17.5, w = Math.sqrt(3) * s, h = 1.5 * s;
        const bx = CXS[1] - ((n - 1) * w + ((n - 1) * w) / 2) / 2, by = TOP + 260 - ((n - 1) * h) / 2 + 20;
        const pos = (i, j) => [bx + j * w + i * w / 2, by + i * h];
        const filled = ramp(t, c3 + 0.3, 4.6, (x) => x) * n * n;
        // borders
        ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.strokeStyle = C.red;
        ctx.beginPath(); ctx.moveTo(pos(0, 0)[0] - w / 2, pos(0, 0)[1] - s * 1.2); ctx.lineTo(pos(0, n - 1)[0] + w / 2, pos(0, n - 1)[1] - s * 1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pos(n - 1, 0)[0] - w / 2, pos(n - 1, 0)[1] + s * 1.2); ctx.lineTo(pos(n - 1, n - 1)[0] + w / 2, pos(n - 1, n - 1)[1] + s * 1.2); ctx.stroke();
        ctx.strokeStyle = C.blue;
        ctx.beginPath(); ctx.moveTo(pos(0, 0)[0] - w * 0.95, pos(0, 0)[1] - s * 0.6); ctx.lineTo(pos(n - 1, 0)[0] - w * 0.95, pos(n - 1, 0)[1] + s * 0.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pos(0, n - 1)[0] + w * 0.95, pos(0, n - 1)[1] - s * 0.6); ctx.lineTo(pos(n - 1, n - 1)[0] + w * 0.95, pos(n - 1, n - 1)[1] + s * 0.6); ctx.stroke();
        ctx.restore();
        const onPath = new Set(HEX.path.map(([i, j]) => `${i},${j}`));
        const pathA = ramp(t, c3 + 5.1, 0.6);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const [x, y] = pos(i, j);
          hexPath(ctx, x, y, s * 0.94);
          ctx.fillStyle = 'rgba(200,210,240,0.10)';
          ctx.globalAlpha = a;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        HEX.order.forEach(([i, j], k) => {
          const u = clamp(filled - k);
          if (u <= 0) return;
          const [x, y] = pos(i, j);
          const own = HEX.owner.get(`${i},${j}`);
          const hl = onPath.has(`${i},${j}`) && own === HEX.winner;
          hexPath(ctx, x, y, s * 0.94 * (0.6 + 0.4 * u));
          ctx.save();
          ctx.globalAlpha = a * (hl ? 1 : 1 - 0.55 * pathA);
          ctx.fillStyle = own === 0 ? C.red : C.blue;
          if (hl && pathA > 0) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 16 * pathA; }
          ctx.fill();
          ctx.restore();
        });
        if (pathA > 0) {
          const pts = HEX.path.map(([i, j]) => pos(i, j));
          strokePoly(ctx, pts, { color: '#ffffff', width: 4, alpha: pathA * 0.9, glow: '#ffffff' });
        }
        const winTxt = HEX.winner === 0 ? L(S.lang, 'red connects top–bottom', '红方连通上下') : L(S.lang, 'blue connects left–right', '蓝方连通左右');
        text(ctx, winTxt, CXS[1], TOP + 486, { size: 28, align: 'center', color: HEX.winner === 0 ? C.red : C.blue, alpha: pathA, font, weight: 600 });
        text(ctx, L(S.lang, 'no draw  ⟺  Brouwer in 2D', '无平局 ⟺ 二维布劳威尔'), CXS[1], TOP + CH - 76, { size: 28, align: 'center', alpha: ramp(t, c3 + 4.0, 0.6), font, color: C.gold, weight: 600 });
        text(ctx, L(S.lang, 'David Gale, 1979', '戴维·盖尔，1979 年'), CXS[1], TOP + CH - 34, { size: 26, align: 'center', alpha: ramp(t, c3 + 4.0, 0.6), font, color: C.dim });
      }
    }

    // ---- rent
    {
      const a = ramp(t, c4 - 0.2, 0.6);
      if (a > 0) {
        const cx = CXS[2];
        const rooms = zh ? ['A 房', 'B 房', 'C 房'] : ['Room A', 'Room B', 'Room C'];
        const start = [1500, 1500, 1500], end = [1900, 1550, 1050];
        const u = ramp(t, c4 + 0.6, 2.6);
        rooms.forEach((nm, k) => {
          const x = cx - 170 + k * 170, y = TOP + 160;
          ctx.save(); ctx.globalAlpha = a;
          ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.strokeStyle = 'rgba(210,220,255,0.6)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(x - 70, y, 140, 120, 12); ctx.fill(); ctx.stroke();
          ctx.restore();
          text(ctx, nm, x, y + 40, { size: 26, align: 'center', alpha: a, font, color: C.dim });
          const price = Math.round(lerp(start[k], end[k], u) / 10) * 10;
          text(ctx, '¥' + price, x, y + 92, { size: 34, align: 'center', alpha: a, font: FONT.sans, weight: 700, color: C.ink });
          const pick = ramp(t, c4 + 3.4 + 0.3 * k, 0.4);
          glowDot(ctx, x, y + 170, 16, [C.cyan, C.violet, C.green][k], pick, 2);
          text(ctx, '✓', x, y + 182, { size: 26, align: 'center', alpha: pick, font: FONT.zh, color: '#0b1020', weight: 700 });
        });
        text(ctx, L(S.lang, 'total ¥4500 · each person prefers a different room', '总价 ¥4500 · 每人都最想要不同的房间'), cx, TOP + 386, { size: 22, align: 'center', alpha: a * ramp(t, c4 + 3.6, 0.5), font, color: C.dim });
        // mini Sperner triangle of price splits
        const { g, col, rainbow } = RENT;
        const sc = 0.24, ox = cx - 710 * sc, oy = TOP + 408 - 90 * sc;
        const P = (v) => [ox + v.x * sc, oy + v.y * sc];
        ctx.save(); ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = 'rgba(150,165,210,0.4)'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const e of g.edges.values()) { const p = P(g.verts[e.a]), q = P(g.verts[e.b]); ctx.moveTo(...p); ctx.lineTo(...q); }
        ctx.stroke();
        for (const k of rainbow) {
          const [p, q, r] = g.tris[k].map((v) => P(g.verts[v]));
          ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.lineTo(...r); ctx.closePath();
          ctx.fillStyle = `rgba(255,236,170,${0.5 * ramp(t, c4 + 2.6, 0.5)})`; ctx.fill();
        }
        for (const v of g.verts) if (v) { const [x, y] = P(v); ctx.fillStyle = RGB[col[v.id]]; ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        text(ctx, L(S.lang, 'Francis Su, 1999 (via Sperner)', 'Francis Su，1999 年（用斯佩纳引理）'), cx, TOP + CH - 34, { size: 26, align: 'center', alpha: a, font, color: C.dim });
      }
    }
  },
};
