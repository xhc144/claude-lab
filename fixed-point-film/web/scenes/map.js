// A map of a park lying inside the park: rotate, shrink, crumple — one point sits on the place it shows.
import { W, H, C, FONT, clamp, lerp, ease, smooth, ramp, rng, glowDot, ring, arrow, text, hexA, L, background } from '../lib.js';

const PW = 1400, PH = 760;          // park coordinates (px of the ground image)
const OX = 260, OY = 72;            // where the ground sits on screen
let AERIAL, MAP, LAYOUT;

// ------------------------------------------------------------------ layout
function makeLayout() {
  const r = rng(21);
  const lake = [];
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * Math.PI * 2;
    const m = 1 + 0.12 * Math.sin(2 * a + 0.5) + 0.08 * Math.sin(3 * a + 1.2);
    lake.push([430 + 250 * m * Math.cos(a), 300 + 160 * m * Math.sin(a)]);
  }
  const loop = [];
  for (let k = 0; k <= 90; k++) {
    const a = (k / 90) * Math.PI * 2;
    const m = 1 + 0.12 * Math.sin(2 * a + 0.5) + 0.08 * Math.sin(3 * a + 1.2);
    loop.push([430 + (250 * m + 62) * Math.cos(a), 300 + (160 * m + 58) * Math.sin(a)]);
  }
  const paths = [
    loop,
    [[700, 780], [700, 640], [760, 540], [860, 450], [1010, 300]],
    [[860, 450], [990, 500], [1180, 560], [1420, 600]],
    [[1010, 300], [1120, 180], [1260, 60], [1330, -20]],
    [[740, 300], [860, 450]],
    [[160, 560], [260, 640], [420, 690], [560, 700], [700, 700]],
  ];
  const buildings = {
    pavilion: [1010, 250],
    cafe: [1180, 560],
    gate: [700, 735],
    garden: [880, 300],
    playground: [255, 625],
    fountain: [760, 545],
  };
  const near = (x, y) => {
    const inLake = (() => { // crude polygon test via angle radius
      const a = Math.atan2((y - 300) / 160, (x - 430) / 250);
      const m = 1 + 0.12 * Math.sin(2 * a + 0.5) + 0.08 * Math.sin(3 * a + 1.2);
      return Math.hypot((x - 430) / 250, (y - 300) / 160) < m + 0.32;
    })();
    if (inLake) return true;
    for (const p of paths) for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      const dx = bx - ax, dy = by - ay;
      const u = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
      if (Math.hypot(x - ax - u * dx, y - ay - u * dy) < 34) return true;
    }
    for (const [bx, by] of Object.values(buildings)) if (Math.hypot(x - bx, y - by) < 95) return true;
    return false;
  };
  const trees = [];
  for (let k = 0; k < 2600 && trees.length < 260; k++) {
    const x = r() * PW, y = r() * PH;
    if (near(x, y) || trees.some((t) => Math.hypot(t[0] - x, t[1] - y) < 34)) continue;
    trees.push([x, y, 13 + 10 * r()]);
  }
  return { lake, paths, buildings, trees };
}

function smoothPath(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

function octagon(g, x, y, r) {
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    g[k ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a));
  }
  g.closePath();
}

// ------------------------------------------------------------------ ground (aerial view)
function drawAerial() {
  const cv = document.createElement('canvas');
  cv.width = PW; cv.height = PH;
  const g = cv.getContext('2d');
  const { lake, paths, buildings, trees } = LAYOUT;
  // grass with noise
  const img = g.createImageData(PW, PH);
  const r = rng(3);
  const G = 70, grid = Array.from({ length: (G + 1) * (G + 1) }, () => r());
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const gx = (x / PW) * G, gy = (y / PH) * G * (PH / PW) * 1.8;
    const x0 = Math.floor(gx), y0 = Math.floor(gy) % G, fx = smooth(gx - x0), fy = smooth(gy - Math.floor(gy));
    const q = (a, b) => grid[(b % G) * (G + 1) + (a % (G + 1))];
    const n = lerp(lerp(q(x0, y0), q(x0 + 1, y0), fx), lerp(q(x0, y0 + 1), q(x0 + 1, y0 + 1), fx), fy);
    const o = (y * PW + x) * 4, fine = r() * 0.08;
    img.data[o] = 62 + 30 * n + 20 * fine;
    img.data[o + 1] = 104 + 34 * n + 30 * fine;
    img.data[o + 2] = 52 + 16 * n;
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // paths
  for (const p of paths) {
    smoothPath(g, p);
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = '#8f8467'; g.lineWidth = 30; g.stroke();
    g.strokeStyle = '#d8cba6'; g.lineWidth = 24; g.stroke();
  }
  // lake
  g.beginPath(); lake.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); g.closePath();
  g.strokeStyle = '#cdbf8f'; g.lineWidth = 16; g.stroke();
  const lg = g.createRadialGradient(430, 300, 20, 430, 300, 280);
  lg.addColorStop(0, '#1f5f8c'); lg.addColorStop(1, '#3f93bd');
  g.fillStyle = lg; g.fill();
  g.globalAlpha = 0.25; g.strokeStyle = '#d8f0ff'; g.lineWidth = 2;
  for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(400 + k * 18, 280 + (k % 3) * 30, 60 + k * 9, 6, 0.1, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  // island
  g.fillStyle = '#5c8a46'; g.beginPath(); g.arc(470, 292, 28, 0, Math.PI * 2); g.fill();
  // plaza + fountain
  const [fx, fy] = buildings.fountain;
  g.fillStyle = '#cfc4a6'; g.beginPath(); g.arc(fx, fy, 54, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4aa3d0'; g.beginPath(); g.arc(fx, fy, 22, 0, Math.PI * 2); g.fill();
  // playground
  const [px, py] = buildings.playground;
  g.fillStyle = '#e1c98d'; g.fillRect(px - 100, py - 60, 200, 120);
  g.fillStyle = '#d0533f'; g.fillRect(px - 60, py - 30, 40, 26);
  g.fillStyle = '#3c78c8'; g.beginPath(); g.arc(px + 40, py + 10, 22, 0, Math.PI * 2); g.fill();
  // flower garden
  const [gx2, gy2] = buildings.garden;
  g.fillStyle = '#6d8f3e'; g.beginPath(); g.arc(gx2, gy2, 66, 0, Math.PI * 2); g.fill();
  const fr = rng(8);
  for (let k = 0; k < 140; k++) {
    const a = fr() * Math.PI * 2, rr = 60 * Math.sqrt(fr());
    g.fillStyle = ['#ff6f91', '#ffd25e', '#ff9a3c', '#f4f1ff', '#c46cff'][k % 5];
    g.beginPath(); g.arc(gx2 + rr * Math.cos(a), gy2 + rr * Math.sin(a), 4, 0, Math.PI * 2); g.fill();
  }
  // buildings with shadows
  const roof = (draw, color) => {
    g.save(); g.translate(8, 10); g.fillStyle = 'rgba(0,0,0,0.35)'; draw(); g.fill(); g.restore();
    g.fillStyle = color; draw(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.stroke();
  };
  const [vx, vy] = buildings.pavilion;
  roof(() => octagon(g, vx, vy, 46), '#b5523b');
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; g.beginPath(); g.moveTo(vx, vy); g.lineTo(vx + 44 * Math.cos(a), vy + 44 * Math.sin(a)); g.stroke(); }
  const [cx2, cy2] = buildings.cafe;
  roof(() => { g.beginPath(); g.rect(cx2 - 64, cy2 - 44, 128, 88); }, '#6f7d8c');
  const [gtx, gty] = buildings.gate;
  roof(() => { g.beginPath(); g.rect(gtx - 62, gty - 14, 24, 28); g.rect(gtx + 38, gty - 14, 24, 28); }, '#9a9086');
  // trees: shadow, crown, highlight
  for (const [x, y, rr] of trees) {
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(x + 6, y + 8, rr, 0, Math.PI * 2); g.fill();
  }
  for (const [x, y, rr] of trees) {
    const tg = g.createRadialGradient(x - rr * 0.35, y - rr * 0.35, 1, x, y, rr);
    tg.addColorStop(0, '#6fae4f'); tg.addColorStop(1, '#22501f');
    g.fillStyle = tg; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  return cv;
}

// ------------------------------------------------------------------ paper map
function drawMap(lang) {
  const cv = document.createElement('canvas');
  cv.width = PW; cv.height = PH;
  const g = cv.getContext('2d');
  const { lake, paths, buildings, trees } = LAYOUT;
  g.fillStyle = '#f6f1e3'; g.fillRect(0, 0, PW, PH);
  g.fillStyle = '#d6eac2'; g.fillRect(22, 22, PW - 44, PH - 44);
  g.save();
  g.beginPath(); g.rect(22, 22, PW - 44, PH - 44); g.clip();
  for (const [x, y, rr] of trees) { g.fillStyle = '#a9d48f'; g.beginPath(); g.arc(x, y, rr * 0.8, 0, Math.PI * 2); g.fill(); }
  for (const p of paths) {
    smoothPath(g, p);
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = '#a89f8c'; g.lineWidth = 26; g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 20; g.stroke();
  }
  g.beginPath(); lake.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); g.closePath();
  g.fillStyle = '#a8d3ee'; g.fill(); g.strokeStyle = '#4f8fbf'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#d6eac2'; g.beginPath(); g.arc(470, 292, 28, 0, Math.PI * 2); g.fill(); g.stroke();
  const sym = (draw) => { draw(); g.fillStyle = '#f2c9a0'; g.fill(); g.strokeStyle = '#8a5a3a'; g.lineWidth = 4; g.stroke(); };
  const B = buildings;
  sym(() => octagon(g, B.pavilion[0], B.pavilion[1], 46));
  sym(() => { g.beginPath(); g.rect(B.cafe[0] - 64, B.cafe[1] - 44, 128, 88); });
  sym(() => { g.beginPath(); g.rect(B.gate[0] - 62, B.gate[1] - 14, 24, 28); g.rect(B.gate[0] + 38, B.gate[1] - 14, 24, 28); });
  g.fillStyle = '#f7e2a6'; g.beginPath(); g.rect(B.playground[0] - 100, B.playground[1] - 60, 200, 120); g.fill(); g.strokeStyle = '#b39448'; g.stroke();
  g.fillStyle = '#f6c6d8'; g.beginPath(); g.arc(B.garden[0], B.garden[1], 66, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#c0718f'; g.stroke();
  g.fillStyle = '#e7e0cc'; g.beginPath(); g.arc(B.fountain[0], B.fountain[1], 54, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#a89f8c'; g.stroke();
  g.fillStyle = '#a8d3ee'; g.beginPath(); g.arc(B.fountain[0], B.fountain[1], 22, 0, Math.PI * 2); g.fill();
  const font = lang === 'zh' ? FONT.zh : FONT.sans;
  const lbl = (s, x, y, size = 40) => {
    g.font = `700 ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.strokeText(s, x, y);
    g.fillStyle = '#2d3a4a'; g.fillText(s, x, y);
  };
  lbl(L(lang, 'Lake', '湖'), 430, 300, 54);
  lbl(L(lang, 'Pavilion', '亭'), B.pavilion[0], B.pavilion[1] - 80);
  lbl(L(lang, 'Café', '咖啡馆'), B.cafe[0], B.cafe[1] + 82);
  lbl(L(lang, 'Gate', '大门'), B.gate[0] + 120, B.gate[1] - 10);
  lbl(L(lang, 'Garden', '花园'), B.garden[0], B.garden[1] - 92);
  lbl(L(lang, 'Playground', '游乐场'), B.playground[0], B.playground[1] - 92);
  g.restore();
  // title box + compass + frame
  g.fillStyle = '#ffffff'; g.fillRect(40, 40, 330, 92);
  g.strokeStyle = '#2d3a4a'; g.lineWidth = 4; g.strokeRect(40, 40, 330, 92);
  g.font = `800 46px ${font}`; g.fillStyle = '#2d3a4a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(L(lang, 'PARK MAP', '公园地图'), 205, 88);
  const nx = PW - 110, ny = 110;
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(nx, ny, 56, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(nx, ny - 46); g.lineTo(nx + 16, ny); g.lineTo(nx - 16, ny); g.closePath(); g.fill();
  g.fillStyle = '#2d3a4a'; g.beginPath(); g.moveTo(nx, ny + 46); g.lineTo(nx + 16, ny); g.lineTo(nx - 16, ny); g.closePath(); g.fill();
  g.font = `800 30px ${FONT.sans}`; g.fillStyle = '#c0392b'; g.fillText('N', nx + 34, ny - 34);
  g.strokeStyle = '#2d3a4a'; g.lineWidth = 10; g.strokeRect(5, 5, PW - 10, PH - 10);
  return cv;
}

// ------------------------------------------------------------------ geometry
// similarity M(u) = T + s R(θ) u   (u in park px, result in park px)
const sim = (s, th, cx, cy) => {
  // choose T so that the map centre lands at (cx, cy)
  const c = Math.cos(th) * s, d = Math.sin(th) * s;
  return { a: c, b: d, c: -d, d: c, e: cx - (c * PW / 2 - d * PH / 2), f: cy - (d * PW / 2 + c * PH / 2), s, th };
};
const apply = (m, x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
const compose = (m, n) => ({ // m ∘ n
  a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
});
const mix = (p, q, u) => ({ s: lerp(p.s, q.s, u), th: lerp(p.th, q.th, u), cx: lerp(p.cx, q.cx, u), cy: lerp(p.cy, q.cy, u) });
const HOLD = { s: 0.66, th: 0.0, cx: 700, cy: 360 };
const LAND = { s: 0.52, th: -0.14, cx: 820, cy: 410 };
const FINAL = { s: 0.42, th: -0.55, cx: 905, cy: 420 };

// smooth crumple displacement (park px), long wavelengths so the mesh is exact enough
const crumpleD = (x, y) => [
  26 * Math.sin(x * 0.011 + y * 0.004 + 0.7) + 14 * Math.sin(y * 0.017 - x * 0.006 + 2.1),
  24 * Math.sin(y * 0.012 - x * 0.005 + 1.3) + 12 * Math.sin(x * 0.015 + y * 0.009 + 0.4),
];
const heightF = (x, y) => Math.sin(x * 0.011 + y * 0.004 + 0.7) + 0.8 * Math.sin(y * 0.012 - x * 0.005 + 1.3) + 0.5 * Math.sin(x * 0.03 + y * 0.021) + 0.4 * Math.sin(x * 0.024 - y * 0.035 + 1);

const groundOf = (m, cr) => (x, y) => {
  const [dx, dy] = crumpleD(x, y);
  return apply(m, x + cr * dx, y + cr * dy);
};

function fixedPoint(G) {
  let x = PW / 2, y = PH / 2;
  for (let k = 0; k < 80; k++) [x, y] = G(x, y);
  return [x, y];
}

function drawPaper(ctx, m, cr, shadow, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (cr < 0.002) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = shadow.blur; ctx.shadowOffsetX = shadow.dx; ctx.shadowOffsetY = shadow.dy;
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(MAP, 0, 0);
    ctx.restore();
    ctx.restore();
    return;
  }
  const G = groundOf(m, cr);
  const GX = 16, GY = 9;
  const verts = [];
  for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) {
    const sx = (i / GX) * PW, sy = (j / GY) * PH;
    verts.push([sx, sy, ...G(sx, sy)]);
  }
  // shadow of the whole sheet
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = shadow.blur; ctx.shadowOffsetX = shadow.dx; ctx.shadowOffsetY = shadow.dy;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  const edge = [];
  for (let i = 0; i <= GX; i++) edge.push(verts[i]);
  for (let j = 1; j <= GY; j++) edge.push(verts[j * (GX + 1) + GX]);
  for (let i = GX - 1; i >= 0; i--) edge.push(verts[GY * (GX + 1) + i]);
  for (let j = GY - 1; j > 0; j--) edge.push(verts[j * (GX + 1)]);
  edge.forEach((v, k) => ctx[k ? 'lineTo' : 'moveTo'](v[2], v[3]));
  ctx.closePath(); ctx.fill();
  ctx.restore();
  const tri = (p, q, r) => {
    // affine map from source triangle (p,q,r)[0..1] to dest [2..3]
    const [x0, y0, u0, v0] = p, [x1, y1, u1, v1] = q, [x2, y2, u2, v2] = r;
    const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den;
    const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / den;
    const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den;
    const d = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den;
    const e = u0 - a * x0 - c * y0, f = v0 - b * x0 - d * y0;
    const mx = (u0 + u1 + u2) / 3, my = (v0 + v1 + v2) / 3;
    const grow = (u, v) => { const dx = u - mx, dy = v - my, l = Math.hypot(dx, dy) || 1; return [u + dx / l * 0.9, v + dy / l * 0.9]; };
    ctx.save();
    ctx.beginPath();
    [[u0, v0], [u1, v1], [u2, v2]].forEach(([u, v], k) => { const [gx, gy] = grow(u, v); ctx[k ? 'lineTo' : 'moveTo'](gx, gy); });
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(MAP, 0, 0);
    ctx.restore();
    // facet shading from a fake height field
    const hx = (heightF((x0 + x1 + x2) / 3 + 4, (y0 + y1 + y2) / 3) - heightF((x0 + x1 + x2) / 3 - 4, (y0 + y1 + y2) / 3)) / 8;
    const hy = (heightF((x0 + x1 + x2) / 3, (y0 + y1 + y2) / 3 + 4) - heightF((x0 + x1 + x2) / 3, (y0 + y1 + y2) / 3 - 4)) / 8;
    const shade = clamp((hx * 0.7 + hy * 0.7) * 22, -1, 1) * cr;
    ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${0.22 * shade})` : `rgba(0,0,0,${-0.3 * shade})`;
    ctx.beginPath(); ctx.moveTo(u0, v0); ctx.lineTo(u1, v1); ctx.lineTo(u2, v2); ctx.closePath(); ctx.fill();
  };
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const v00 = verts[j * (GX + 1) + i], v10 = verts[j * (GX + 1) + i + 1];
    const v01 = verts[(j + 1) * (GX + 1) + i], v11 = verts[(j + 1) * (GX + 1) + i + 1];
    tri(v00, v10, v11);
    tri(v00, v11, v01);
  }
  ctx.restore();
}

export default {
  init(S) {
    LAYOUT = makeLayout();
    AERIAL = drawAerial();
    MAP = drawMap(S.lang);
  },
  draw(ctx, t, S) {
    background(ctx);
    const c0 = S.cue(0), c1 = S.cue(1), c2 = S.cue(2), c3 = S.cue(3), c4 = S.cue(4);
    // camera zooms into the fixed point at the end
    const zoomU = ramp(t, c4 + 2.2, Math.max(2, S.dur - c4 - 3.2));
    // map pose over time
    let pose = HOLD;
    pose = mix(pose, LAND, ramp(t, c1 + 0.2, 1.6));
    pose = mix(pose, FINAL, ramp(t, c2 + 0.1, 1.8));
    const crumple = ramp(t, c2 + 2.0, 1.4) * (1 - ramp(t, c4 + 0.1, 1.1));
    const m = sim(pose.s, pose.th, pose.cx, pose.cy);
    const G = groundOf(m, crumple);
    const fp = fixedPoint(G);
    const zs = 1 + 0.85 * zoomU;
    const [zx, zy] = [OX + fp[0], OY + fp[1]];

    ctx.save();
    ctx.translate(lerp(zx, 960, zoomU), lerp(zy, 450, zoomU)); ctx.scale(zs, zs); ctx.translate(-zx, -zy);
    // ground
    const ga = ramp(t, 0, 0.9);
    ctx.save();
    ctx.globalAlpha = ga;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40;
    ctx.drawImage(AERIAL, OX, OY);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.6 * ga;
    ctx.strokeStyle = '#d7e6ff'; ctx.lineWidth = 3;
    ctx.strokeRect(OX, OY, PW, PH);
    ctx.restore();
    text(ctx, L(S.lang, 'the park (from above)', '公园（俯视）'), OX + 10, OY - 18, { size: 26, color: C.dim, alpha: ga * (1 - zoomU) });

    ctx.save();
    ctx.translate(OX, OY);
    // the paper map: appears, lands, turns, shrinks, crumples
    const lift = 1 - ramp(t, c1 + 0.2, 1.6);
    const paperA = ramp(t, c0 + 1.0, 0.7);
    const nested = ramp(t, c4 + 1.0, 0.5);
    const dim = 1 - 0.5 * (ramp(t, c3 + 2.4, 0.5) - ramp(t, c3 + 3.6, 0.5));
    if (paperA > 0) drawPaper(ctx, m, crumple, { blur: 14 + 40 * lift, dx: 6 + 26 * lift, dy: 8 + 36 * lift }, paperA * dim);
    // nested copies M^k(park): Droste spiral into the fixed point
    if (nested > 0) {
      let mk = m;
      for (let k = 2; k <= 9; k++) {
        mk = compose(m, mk);
        const a = ramp(t, c4 + 1.0 + 0.42 * (k - 2), 0.4);
        if (a <= 0) break;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10 / k;
        ctx.transform(mk.a, mk.b, mk.c, mk.d, mk.e, mk.f);
        ctx.drawImage(MAP, 0, 0);
        ctx.restore();
      }
      // orbit of the gate under repeated application
      const pts = [LAYOUT.buildings.gate];
      for (let k = 0; k < 12; k++) pts.push(apply(m, ...pts[pts.length - 1]));
      const shown = (t - (c4 + 1.0)) / 0.42 + 1;
      for (let k = 0; k < pts.length - 1 && k < shown; k++) {
        const u = clamp(shown - k);
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
        arrow(ctx, x0, y0, lerp(x0, x1, u), lerp(y0, y1, u), { color: C.gold, width: 5 / zs, head: 20 / zs, alpha: 0.95 });
        ctx.restore();
        glowDot(ctx, x0, y0, 7 / zs, C.gold, 1, 2.5);
      }
    }
    // landmark arrows: real place -> where the map shows it
    const la = ramp(t, c3 + 0.2, 0.6) * (1 - ramp(t, c4 + 0.6, 0.6));
    if (la > 0) {
      for (const key of ['pavilion', 'cafe', 'gate', 'playground']) {
        const [x, y] = LAYOUT.buildings[key];
        const [gx, gy] = G(x, y);
        ring(ctx, x, y, 16, '#ffffff', 3, la);
        arrow(ctx, x, y, gx, gy, { color: '#ffffff', width: 3, head: 16, alpha: la, dash: [10, 8] });
      }
    }
    // the fixed point
    const fa = ramp(t, c3 + 1.4, 0.6);
    if (fa > 0) {
      glowDot(ctx, fp[0], fp[1], 9 / zs, C.gold, fa, 4);
      ring(ctx, fp[0], fp[1], (24 + 8 * Math.sin(t * 4)) / zs, C.gold, 3 / zs, fa);
      const lab = fa * (1 - zoomU);
      text(ctx, L(S.lang, 'fixed point', '不动点'), fp[0] + 34, fp[1] - 28, { size: 34, weight: 700, color: C.gold, alpha: lab, glow: 'rgba(0,0,0,0.9)', font: S.lang === 'zh' ? FONT.zh : FONT.sans });
    }
    ctx.restore();
    ctx.restore();
  },
};
