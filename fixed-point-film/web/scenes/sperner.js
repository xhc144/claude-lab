// Sperner's lemma: colour the triangulation, then the door-walking proof.
import { C, RGB, FONT, clamp, lerp, ease, smooth, ramp, rng, glowDot, ring, arrow, text, hexA, L, background, polyAt, strokePoly } from '../lib.js';
import { A, B, CC, grid, isRainbow, isDoor, walk, centroid, mid, edgeKey } from './tri.js';

const N = 8;
let G, COL, RAINBOW, BOTTOM, WALK_A, WALK_B, ORDER_B, ORDER_I;

function colour(seed) {
  const r = rng(seed);
  const col = [];
  for (const v of G.verts) {
    if (!v) continue;
    const { i, j } = v, n = N;
    let c;
    if (i === 0 && j === 0) c = 0;
    else if (i === n) c = 1;
    else if (j === n) c = 2;
    else if (j === 0) c = r() < 0.5 ? 0 : 1;
    else if (i === 0) c = r() < 0.5 ? 0 : 2;
    else if (i + j === n) c = r() < 0.5 ? 1 : 2;
    else { const q = r(); c = q < 0.36 ? 0 : q < 0.68 ? 1 : 2; }
    col[v.id] = c;
  }
  return col;
}

function analyse(col) {
  const bottom = [];
  for (let i = 0; i < N; i++) {
    const a = G.id(i, 0), b = G.id(i + 1, 0);
    if (isDoor(col, a, b)) bottom.push(edgeKey(a, b));
  }
  const rainbow = G.tris.map((_, k) => k).filter((k) => isRainbow(G, col, k));
  const walks = bottom.map((d) => walk(G, col, d));
  return { bottom, rainbow, walks };
}

function pickSeed() {
  for (let seed = 1; seed < 20000; seed++) {
    const col = colour(seed);
    const { bottom, rainbow, walks } = analyse(col);
    if (bottom.length !== 3 || rainbow.length !== 3) continue;
    const toR = walks.filter((w) => w.end === 'rainbow');
    const exits = walks.filter((w) => w.end === 'exit');
    if (toR.length !== 1 || exits.length !== 2) continue;
    if (toR[0].rooms.length < 9 || exits[0].rooms.length < 4 || exits[0].rooms.length > 12) continue;
    return seed;
  }
  return 1;
}

function pathPoints(w) {
  const pts = [];
  const d0 = mid(G, w.doors[0]);
  pts.push([d0[0], d0[1] + 70], d0);
  w.rooms.forEach((k, idx) => {
    pts.push(centroid(G, k));
    if (w.doors[idx + 1]) pts.push(mid(G, w.doors[idx + 1]));
  });
  if (w.end === 'exit') { const last = pts[pts.length - 1]; pts.push([last[0], last[1] + 70]); }
  return pts;
}

function triPath(ctx, k) {
  const [a, b, c] = G.tris[k].map((v) => G.verts[v]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
}

export default {
  init() {
    G = grid(N);
    const seed = pickSeed();
    COL = colour(seed);
    const an = analyse(COL);
    RAINBOW = an.rainbow;
    BOTTOM = an.bottom;
    const ia = an.walks.findIndex((w) => w.end === 'rainbow');
    WALK_A = { ...an.walks[ia], pts: pathPoints(an.walks[ia]), door: an.bottom[ia] };
    const ib = an.walks.findIndex((w) => w.end === 'exit');
    WALK_B = { ...an.walks[ib], pts: pathPoints(an.walks[ib]), door: an.bottom[ib] };
    window.SPERNER = { seed, rainbow: RAINBOW.length, bottom: BOTTOM.length, walkA: WALK_A.rooms.length, walkB: WALK_B.rooms.length };
    // colouring order: boundary along the sides, interior in a scattered order
    ORDER_B = [];
    for (let i = 1; i < N; i++) ORDER_B.push(G.id(i, 0));
    for (let j = 1; j < N; j++) ORDER_B.push(G.id(N - j, j));
    for (let j = N - 1; j >= 1; j--) ORDER_B.push(G.id(0, j));
    const r = rng(99);
    ORDER_I = G.verts.filter((v) => v && v.i > 0 && v.j > 0 && v.i + v.j < N).map((v) => [r(), v.id]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  },
  draw(ctx, t, S) {
    background(ctx, 900, 450);
    const zh = S.lang === 'zh';
    const font = zh ? FONT.zh : FONT.sans;
    const cue = (i) => S.cue(i);
    const [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9] = Array.from({ length: 10 }, (_, i) => cue(i));

    // ---------------- triangle + subdivision
    const big = ramp(t, c1 + 0.1, 1.0);
    const sub = ramp(t, c1 + 1.6, 2.2);
    const doorMode = ramp(t, c5 + 1.0, 0.8);
    ctx.save();
    ctx.globalAlpha = big;
    ctx.fillStyle = 'rgba(120,140,200,0.06)';
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...CC); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (sub > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(150,165,210,${0.45 - 0.25 * doorMode})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 1; k < N; k++) {
        const u = clamp(sub * 1.4 - (k / N) * 0.4);
        if (u <= 0) continue;
        // three families of lines parallel to the sides
        const fam = [
          [G.verts[G.id(0, k)], G.verts[G.id(N - k, k)]],
          [G.verts[G.id(k, 0)], G.verts[G.id(k, N - k)]],
          [G.verts[G.id(k, 0)], G.verts[G.id(0, k)]],
        ];
        for (const [p, q] of fam) { ctx.moveTo(p.x, p.y); ctx.lineTo(lerp(p.x, q.x, u), lerp(p.y, q.y, u)); }
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = big;
    ctx.strokeStyle = 'rgba(210,220,255,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...CC); ctx.closePath(); ctx.stroke();
    ctx.restore();

    // ---------------- rooms visited / rainbow fills
    const walkA = ramp(t, c7 + 1.0, Math.max(3, S.lines[7].e - S.lines[7].s - 1.2), (x) => x);
    const walkB = ramp(t, c8 + 0.3, 3.6, (x) => x);
    const tintRooms = (w, u, color) => {
      const at = polyAt(w.pts, u);
      // each room index r is at point 2 + 2r in pts
      const reached = Math.floor((at.index - 1) / 2) + 1;
      for (let r = 0; r < Math.min(reached, w.rooms.length); r++) {
        triPath(ctx, w.rooms[r]);
        ctx.fillStyle = hexA(color, 0.16);
        ctx.fill();
      }
    };
    if (walkA > 0) tintRooms(WALK_A, walkA, C.gold);
    if (walkB > 0) tintRooms(WALK_B, walkB, C.cyan);
    const rbA = ramp(t, c4 + 0.6, 0.6) * (1 - 0.65 * ramp(t, c5 + 0.4, 0.6)) + 0.65 * ramp(t, c8 + 4.2, 0.6);
    if (rbA > 0) {
      RAINBOW.forEach((k, idx) => {
        const a = clamp(rbA) * ramp(t, c4 + 0.6 + idx * 0.35, 0.5);
        triPath(ctx, k);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(255,240,200,0.32)';
        ctx.shadowColor = C.gold; ctx.shadowBlur = 24;
        ctx.fill();
        ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.stroke();
        ctx.restore();
      });
    }

    // ---------------- doors
    if (doorMode > 0) {
      ctx.save();
      for (const e of G.edges.values()) {
        if (!isDoor(COL, e.a, e.b)) continue;
        const a = G.verts[e.a], b = G.verts[e.b];
        const isBottom = a.j === 0 && b.j === 0;
        const pul = isBottom ? 0.5 + 0.5 * ramp(t, c6, 0.5) * (0.6 + 0.4 * Math.sin(t * 6)) : 0.5;
        ctx.strokeStyle = `rgba(255,236,170,${doorMode * (0.55 + 0.45 * pul)})`;
        ctx.lineWidth = isBottom ? 9 : 7;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255,220,120,0.9)'; ctx.shadowBlur = 12;
        const sh = 0.18; // leave the vertex dots visible
        ctx.beginPath();
        ctx.moveTo(lerp(a.x, b.x, sh), lerp(a.y, b.y, sh));
        ctx.lineTo(lerp(a.x, b.x, 1 - sh), lerp(a.y, b.y, 1 - sh));
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---------------- vertex colours
    const colB = ramp(t, c2 + 1.0, 4.4, (x) => x), colI = ramp(t, c3 - 0.2, 2.2, (x) => x);
    const shownColour = new Map();
    ORDER_B.forEach((id, k) => { const u = colB * ORDER_B.length - k; if (u > 0) shownColour.set(id, clamp(u)); });
    ORDER_I.forEach((id, k) => { const u = colI * ORDER_I.length - k; if (u > 0) shownColour.set(id, clamp(u)); });
    if (sub > 0.3) {
      for (const v of G.verts) {
        if (!v) continue;
        const corner = (v.i === 0 && v.j === 0) || v.i === N || v.j === N;
        if (corner) continue;
        const k = shownColour.get(v.id) || 0;
        const a = ramp(t, c1 + 2.2, 0.8);
        if (k <= 0) {
          ctx.fillStyle = `rgba(160,170,200,${0.6 * a})`;
          ctx.beginPath(); ctx.arc(v.x, v.y, 5, 0, Math.PI * 2); ctx.fill();
        } else {
          const pop = 1 + 0.5 * Math.sin(Math.PI * k) * (k < 1 ? 1 : 0);
          glowDot(ctx, v.x, v.y, 10 * pop, RGB[COL[v.id]], 1, 2.0);
        }
      }
    }
    const corners = [[A, 0], [B, 1], [CC, 2]];
    corners.forEach(([p, c], k) => {
      const a = ramp(t, c1 + 0.4 + k * 0.3, 0.5);
      glowDot(ctx, p[0], p[1], 17, RGB[c], a, 3);
    });

    // ---------------- side rule highlight
    const rule = ramp(t, c2 + 0.4, 0.6) * (1 - ramp(t, c3 + 1.2, 0.8));
    if (rule > 0) {
      const sides = [[A, B, 0, 1], [A, CC, 0, 2], [B, CC, 1, 2]];
      sides.forEach(([p, q, ca, cb], k) => {
        const a = rule * ramp(t, c2 + 0.4 + k * 0.5, 0.5);
        const g = ctx.createLinearGradient(p[0], p[1], q[0], q[1]);
        g.addColorStop(0, hexA(RGB[ca], 0.9)); g.addColorStop(1, hexA(RGB[cb], 0.9));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = g; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
        ctx.restore();
      });
    }

    // ---------------- walkers
    const walker = (w, u, color) => {
      if (u <= 0) return;
      const at = polyAt(w.pts, u);
      strokePoly(ctx, at.prefix, { color, width: 5, glow: color, glowBlur: 14, alpha: 0.95 });
      glowDot(ctx, at.p[0], at.p[1], 11, color, 1, 3);
    };
    walker(WALK_B, walkB * (1 - ramp(t, c9 + 3.0, 0.8)), C.cyan);
    walker(WALK_A, walkA, C.gold);
    if (walkA >= 1) {
      const [x, y] = centroid(G, WALK_A.rooms[WALK_A.rooms.length - 1]);
      const burst = clamp((t - (c7 + 1.0 + (S.lines[7].e - S.lines[7].s - 1.2))) / 1.0);
      ring(ctx, x, y, 20 + 60 * burst, C.gold, 4, 1 - burst);
    }

    // ---------------- pairing arcs under the bottom side
    const pr = ramp(t, c9 + 0.4, 0.8);
    if (pr > 0) {
      const [x1] = mid(G, WALK_B.doors[0]);
      const [x2] = mid(G, WALK_B.doors[WALK_B.doors.length - 1]);
      const y = A[1] + 18;
      ctx.save();
      ctx.globalAlpha = pr;
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 4; ctx.shadowColor = C.cyan; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(x1, y); ctx.bezierCurveTo(x1, y + 52, x2, y + 52, x2, y);
      ctx.stroke();
      ctx.restore();
      const [xa] = mid(G, WALK_A.door);
      const pa = ramp(t, c9 + 1.4, 0.6);
      glowDot(ctx, xa, y + 26, 9, C.gold, pa, 3);
      text(ctx, L(S.lang, '2 paired', '2 扇配对'), (x1 + x2) / 2, y + 74, { size: 26, align: 'center', color: C.cyan, alpha: pr, font });
      text(ctx, L(S.lang, '1 left over', '剩 1 扇'), xa, y + 74, { size: 26, align: 'center', color: C.gold, alpha: pa, font });
    }
    // door numbers on the bottom
    const dn = ramp(t, c6 + 0.6, 0.6) * (1 - ramp(t, c9 + 0.2, 0.5));
    if (dn > 0) BOTTOM.forEach((key, k) => {
      const [x, y] = mid(G, key);
      text(ctx, String(k + 1), x, y + 52, { size: 34, weight: 700, align: 'center', color: '#ffe9a8', alpha: dn * ramp(t, c6 + 0.6 + 0.4 * k, 0.4), font: FONT.sans });
    });

    // ---------------- right column
    const RX = 1250;
    const tf = zh ? FONT.zhSerif : FONT.serif;
    const head = ramp(t, c0 + 0.6, 0.8);
    text(ctx, L(S.lang, "Sperner's Lemma", '斯佩纳引理'), RX, 150, { size: zh ? 60 : 58, weight: 700, font: tf, alpha: head });
    text(ctx, L(S.lang, 'Emanuel Sperner, 1928', '埃马努埃尔·斯佩纳，1928 年'), RX + 2, 200, { size: 28, color: C.dim, alpha: head, font });
    const block = (lines, a, y0, gap = 54) => lines.forEach(([str, o = {}], k) => text(ctx, str, RX, y0 + k * gap, { size: 34, font, alpha: a, ...o }));
    const dotRow = (cols, x, y, a) => cols.forEach((c, k) => glowDot(ctx, x + k * 30, y - 11, 10, RGB[c], a, 1.6));
    // rules
    const rA = ramp(t, c2 + 0.4, 0.6) * (1 - ramp(t, c4, 0.6));
    if (rA > 0) {
      text(ctx, L(S.lang, 'Coloring rule', '染色规则'), RX, 300, { size: 36, weight: 700, alpha: rA, font, color: C.dim });
      const rows = [
        [L(S.lang, 'bottom side', '底边'), [0, 1], 0.4], [L(S.lang, 'left side', '左边'), [0, 2], 0.9], [L(S.lang, 'right side', '右边'), [1, 2], 1.4],
      ];
      rows.forEach(([lab, cols, d], k) => {
        const a = rA * ramp(t, c2 + 0.4 + d, 0.5);
        text(ctx, lab, RX, 372 + k * 62, { size: 34, alpha: a, font });
        dotRow(cols, RX + 250, 372 + k * 62, a);
      });
      const a4 = rA * ramp(t, c3, 0.5);
      text(ctx, L(S.lang, 'inside', '内部'), RX, 372 + 3 * 62, { size: 34, alpha: a4, font });
      dotRow([0, 1, 2], RX + 250, 372 + 3 * 62, a4);
      text(ctx, L(S.lang, 'anything', '随意'), RX + 350, 372 + 3 * 62, { size: 30, alpha: a4, color: C.dim, font });
    }
    // lemma
    const lA = ramp(t, c4 + 0.3, 0.6) * (1 - ramp(t, c5, 0.6));
    if (lA > 0) {
      block([
        [L(S.lang, 'Always a rainbow triangle', '一定有三色小三角形'), { weight: 700, color: C.gold }],
        [L(S.lang, 'with all three colors.', '（红、绿、蓝齐全）'), { color: C.dim }],
        [L(S.lang, `Here: ${RAINBOW.length} of them — odd.`, `这里有 ${RAINBOW.length} 个：奇数`), { color: C.ink }],
      ], lA, 330);
    }
    // rooms & doors
    const dA = ramp(t, c5 + 0.4, 0.6);
    if (dA > 0) {
      text(ctx, L(S.lang, 'room  =  small triangle', '房间  =  小三角形'), RX, 320, { size: 34, alpha: dA, font });
      const da2 = ramp(t, c5 + 1.4, 0.6);
      ctx.save(); ctx.globalAlpha = da2; ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(255,220,120,0.9)'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(RX + 36, 372); ctx.lineTo(RX + 100, 372); ctx.stroke(); ctx.restore();
      glowDot(ctx, RX + 18, 372, 10, C.red, da2, 1.6);
      glowDot(ctx, RX + 118, 372, 10, C.green, da2, 1.6);
      text(ctx, L(S.lang, '=  door', '=  门'), RX + 150, 384, { size: 34, alpha: da2, font });
    }
    const bA = ramp(t, c6 + 0.4, 0.6);
    if (bA > 0) {
      block([
        [L(S.lang, `bottom side: ${BOTTOM.length} doors (odd)`, `底边：${BOTTOM.length} 扇门（奇数）`), { color: '#ffe9a8' }],
        [L(S.lang, 'other sides: 0 doors', '另两边：0 扇门'), { color: C.dim }],
      ], bA, 450);
    }
    const wA = ramp(t, c7 + 0.6, 0.6);
    if (wA > 0) {
      block([
        [L(S.lang, '≤ 2 doors per room', '每个房间 ≤ 2 扇门'), { color: C.ink }],
        [L(S.lang, '→ never revisit a room', '→ 不会重复进入'), { color: C.dim }],
      ], wA, 570);
    }
    const eA = ramp(t, c8 + 0.4, 0.6);
    if (eA > 0) {
      text(ctx, L(S.lang, 'A walk ends', '一条路的终点：'), RX, 690, { size: 34, alpha: eA, font, weight: 700 });
      text(ctx, L(S.lang, '· at another bottom door', '· 底边另一扇门'), RX, 740, { size: 32, alpha: eA * ramp(t, c8 + 0.8, 0.5), font, color: C.cyan });
      text(ctx, L(S.lang, '· or in a rainbow room', '· 或三色房间'), RX, 786, { size: 32, alpha: eA * ramp(t, c8 + 3.6, 0.5), font, color: C.gold });
    }
    const pA = ramp(t, c9 + 2.0, 0.8);
    text(ctx, '3 = 2 + 1', RX, 268, { size: 50, weight: 700, color: C.gold, alpha: pA, font: FONT.serif, glow: 'rgba(0,0,0,0.8)' });
  },
};
