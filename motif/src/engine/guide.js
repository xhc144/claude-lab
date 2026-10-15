// Explanation pointer ("讲解指针"). A scene's `guide` steps become a timed track: a cursor travels
// to each target and draws a hand-made mark there (circle, underline, highlight…) while that step's
// narration plays. Targets resolve at draw time from what the components actually drew this frame
// (see REC in components/kit.js) or from a component's own anchor() — a formula term, a plot point.
// Everything is a pure function of (scene, t), so preview, scrubbing and export agree frame for frame.
import { REC, roundRect } from './components/kit.js';
import { guideTarget, sayDuration } from '../core/catalog/guide.js';
import { EASE, clamp01, cubicBezier } from './motion/easing.js';
import { toCss } from '../core/util/color.js';
import { colorOf } from './env.js';
import { fontString } from './text/text.js';
import { hash32, clamp } from '../core/util/misc.js';

const TAU = Math.PI * 2;
const glide = cubicBezier(0.6, 0.02, 0.22, 1);
const drawEase = cubicBezier(0.45, 0.05, 0.3, 1);

const DRAW_DUR = { point: 0.3, circle: 0.75, underline: 0.55, highlight: 0.6, box: 0.8, arrow: 0.65, focus: 0.45, cross: 0.45, check: 0.4 };

/**
 * Time the steps of a compiled scene (scene-local seconds). Called after blocks are re-timed.
 * Steps start once their target has entered and the previous step has had its say.
 */
export function planGuide(cs, env, lead) {
  const g = cs.scene.guide;
  if (!g?.steps?.length) { cs.guide = null; return 0; }
  const T = env.motion.tempo;
  const steps = [];
  let prevEnd = lead;
  g.steps.forEach((st, idx) => {
    const block = guideTarget(cs.scene, st.target);
    const item = block ? cs.items.find((it) => it.block.id === block.id) : null;
    // wait for the target's build to finish (a derivation's last step included)
    const ready = item ? item.start + Math.max(item.inst.duration * 0.85, item.inst.duration - 0.2) : lead + 0.4;
    const travel = (idx === 0 ? 0.75 : 0.55) * T;
    const drawDur = (DRAW_DUR[st.do] || 0.5) * T;
    const dwell = st.hold != null ? Math.max(0.2, st.hold) : Math.max(st.say ? 0 : 1.3 * T, sayDuration(st.say), 0.9);
    const at = st.at != null ? st.at : Math.max(prevEnd + travel, ready + travel * 0.4);
    const end = at + drawDur + dwell;
    steps.push({ ...st, idx, block, item, at, travel, drawDur, end, seed: hash32(`${cs.id}:${idx}:${st.do}`) });
    prevEnd = Math.max(prevEnd, end);
  });
  steps.sort((a, b) => a.at - b.at);
  cs.guide = { cursor: g.cursor || 'arrow', color: g.color, steps, start: steps[0].at - steps[0].travel, end: Math.max(...steps.map((s) => s.end)) };
  return cs.guide.end;
}

// ───────────────────────────── anchors ─────────────────────────────

function mapRect(r, m, inv) {
  if (!m) return r;
  const M = inv ? inv.multiply(m) : m;
  const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(([x, y]) => [M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { ...r, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

const norm = (s) => String(s).replace(/[*=~`_]/g, '').replace(/\s+/g, '').toLowerCase();

/** Rectangles (one per line) where `query` appears in a recorded text layout; also the full-text box. */
function textRects(rec, query, nth, counter) {
  const { L, x, y, w } = rec;
  const chars = [];
  const lines = L.lines;
  lines.forEach((line, li) => {
    for (const u of line.units) {
      if (u.k === 'nl' || u.k === 'sp' || !u.t) continue;
      for (const ch of norm(u.t)) chars.push({ ch, u, li });
    }
  });
  const rectOf = (us) => {
    const byLine = new Map();
    for (const { u, li } of us) { const a = byLine.get(li) || []; a.push(u); byLine.set(li, a); }
    return [...byLine.entries()].map(([li, units]) => {
      const line = lines[li];
      const ox = L.align === 'center' ? (w - line.width) / 2 : L.align === 'right' ? w - line.width : 0;
      const x0 = Math.min(...units.map((u) => u.x)), x1 = Math.max(...units.map((u) => u.x + u.w));
      const by = y + line.y + L.lineHeight / 2 + L.size * 0.36;
      return { x: x + ox + x0, y: by - L.size * 0.84, w: x1 - x0, h: L.size * 1.06 };
    });
  };
  if (query == null) return rectOf(chars);
  const hay = chars.map((c) => c.ch).join('');
  const q = norm(query);
  if (!q) return null;
  let from = 0;
  for (;;) {
    const i = hay.indexOf(q, from);
    if (i < 0) return null;
    counter.n++;
    if (counter.n === nth) return rectOf(chars.slice(i, i + q.length));
    from = i + 1;
  }
}

const union = (rs) => {
  const v = rs.filter(Boolean);
  if (!v.length) return null;
  const x0 = Math.min(...v.map((r) => r.x)), y0 = Math.min(...v.map((r) => r.y));
  return { x: x0, y: y0, w: Math.max(...v.map((r) => r.x + r.w)) - x0, h: Math.max(...v.map((r) => r.y + r.h)) - y0 };
};

/** Resolve a step to rectangles in scene coordinates at scene time lt; null when the part is not on screen. */
export function resolveTarget(step, S, lt, rec = REC) {
  const it = step.item;
  if (!it) return null;
  const nth = Math.max(1, step.nth || 1);
  const part = step.part;
  // Components with their own geometry (formula, plot, chart, geometry) answer first; text search
  // over what was drawn covers everything else, including their labels.
  if (it.inst.anchor) {
    const r = it.inst.anchor(part, lt - it.start, nth);
    if (r?.length) return r;
  }
  const inv = rec.base ? rec.base.inverse() : null;
  const texts = rec.texts.filter((r) => r.block === it.block.id);
  const items = rec.items.filter((r) => r.block === it.block.id);
  const itemRect = (i) => {
    const own = items.filter((r) => r.i === i);
    if (!own.length) return null;
    return union([...own.map((r) => (r.box ? mapRect(r.box, r.m, inv) : null)), ...texts.filter((r) => r.item === i).flatMap((r) => (textRects(r, null) || []).map((q) => mapRect(q, r.m, inv)))]);
  };
  if (part == null || part === '') {
    const all = [...items.map((r) => (r.box ? mapRect(r.box, r.m, inv) : null)), ...texts.flatMap((r) => (textRects(r, null) || []).map((q) => mapRect(q, r.m, inv)))];
    const u = union(all);
    return [u || it.rect];
  }
  if (typeof part === 'number' || /^\d+$/.test(String(part))) {
    const r = itemRect(Number(part) - 1);
    if (r) return [r];
  }
  const byKey = items.find((r) => r.key != null && String(r.key) === String(part));
  if (byKey) { const r = itemRect(byKey.i); if (r) return [r]; }
  const counter = { n: 0 };
  for (const r of texts) {
    const hit = textRects(r, part, nth, counter);
    if (hit) return hit.map((q) => mapRect(q, r.m, inv));
  }
  return null;
}

// ───────────────────────────── mark geometry ─────────────────────────────

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** A mark is a list of polylines (pen strokes) in scene coordinates. */
function markPaths(step, rects, env) {
  const R = rng(step.seed);
  const U = union(rects);
  const body = env.sizes.body;
  const seg = rects.length === 1 ? rects[0].seg : null;
  const pad = seg ? body * 0.3 : Math.max(env.sizes.small * 0.32, Math.min(U.h, U.w) * 0.16);
  const N = 48;
  switch (step.do) {
    case 'underline': case 'highlight': case 'cross': {
      if (seg) {
        const [[x0, y0], [x1, y1]] = seg;
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
        const off = step.do === 'underline' ? body * 0.45 : 0;
        return [Array.from({ length: N + 1 }, (_, k) => { const u = k / N; const b = Math.sin(u * Math.PI) * body * 0.12; return [x0 + (x1 - x0) * u + nx * (off + b), y0 + (y1 - y0) * u + ny * (off + b)]; })];
      }
      return rects.map((r) => {
        const sag = (R() - 0.5) * r.h * 0.12;
        const tilt = (R() - 0.5) * r.h * 0.1;
        const yb = step.do === 'underline' ? r.y + r.h + Math.max(4 * env.unit, r.h * 0.1) : step.do === 'cross' ? r.y + r.h * 0.55 : r.y + r.h * 0.52;
        const ext = step.do === 'highlight' ? r.h * 0.12 : r.h * 0.1;
        const x0 = r.x - ext, x1 = r.x + r.w + ext;
        return Array.from({ length: N + 1 }, (_, k) => {
          const u = k / N;
          return [x0 + (x1 - x0) * u, yb + Math.sin(u * Math.PI) * sag + (u - 0.5) * (step.do === 'cross' ? -r.h * 0.22 : tilt)];
        });
      });
    }
    case 'circle': {
      let cx = U.x + U.w / 2, cy = U.y + U.h / 2, rx = U.w / 2 + pad * 1.5, ry = U.h / 2 + pad * 1.3, rot = (R() - 0.5) * 0.08;
      const minR = body * 0.85;
      rx = Math.max(rx, minR); ry = Math.max(ry, minR * 0.8);
      if (rx > ry * 4) ry = rx / 4; // very wide targets: keep the loop round enough to read as a circle
      if (seg) { const [[x0, y0], [x1, y1]] = seg; cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; rx = Math.hypot(x1 - x0, y1 - y0) / 2 + pad * 1.5; ry = body; rot = Math.atan2(y1 - y0, x1 - x0); }
      const a0 = -Math.PI * 0.62 + (R() - 0.5) * 0.3, sweep = TAU + 0.42;
      const wob = R() * TAU;
      const M = 96;
      return [Array.from({ length: M + 1 }, (_, k) => {
        const u = k / M;
        const a = a0 + sweep * u;
        const grow = 1 + 0.07 * u + 0.025 * Math.sin(a * 2 + wob);
        const ex = Math.cos(a) * rx * grow, ey = Math.sin(a) * ry * grow;
        return [cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)];
      })];
    }
    case 'box': {
      const x0 = U.x - pad * 1.2, y0 = U.y - pad, x1 = U.x + U.w + pad * 1.2, y1 = U.y + U.h + pad;
      const j = () => (R() - 0.5) * pad * 0.5;
      const c = [[x0 + j(), y0 + j()], [x1 + j(), y0 + j()], [x1 + j(), y1 + j()], [x0 + j(), y1 + j()]];
      const pts = [];
      for (let e = 0; e < 4; e++) {
        const [ax, ay] = c[e], [bx, by] = c[(e + 1) % 4];
        for (let k = 0; k < 16; k++) { const u = k / 16; pts.push([ax + (bx - ax) * u, ay + (by - ay) * u]); }
      }
      const [ax, ay] = c[0], [bx, by] = c[1];
      for (let k = 0; k <= 5; k++) { const u = k / 16; pts.push([ax + (bx - ax) * u, ay + (by - ay) * u - pad * 0.15]); }
      return [pts];
    }
    case 'arrow': {
      const { W, H } = env;
      const tc = [U.x + U.w / 2, U.y + U.h / 2];
      const dx = tc[0] < W / 2 ? 1 : -1, dy = tc[1] > H * 0.45 ? -1 : 1;
      const dist = clamp(Math.max(U.w, U.h) * 0.6 + body * 4, body * 5, Math.min(W, H) * 0.32);
      let sx = tc[0] + dx * dist, sy = tc[1] + dy * dist * 0.75;
      sx = clamp(sx, env.grid.mx * 0.6, W - env.grid.mx * 0.6); sy = clamp(sy, env.grid.my * 0.6, H - env.grid.my * 0.6);
      // end on the target's edge, facing the start
      const ang = Math.atan2(sy - tc[1], sx - tc[0]);
      const ex = tc[0] + Math.cos(ang) * (U.w / 2 + pad * 1.4) * 0.92, ey = tc[1] + Math.sin(ang) * (U.h / 2 + pad * 1.4);
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const len = Math.hypot(ex - sx, ey - sy) || 1;
      const bend = len * 0.22 * (dx * dy > 0 ? 1 : -1);
      const cxp = mx + (-(ey - sy) / len) * bend, cyp = my + ((ex - sx) / len) * bend;
      const shaft = Array.from({ length: N + 1 }, (_, k) => { const u = k / N; return [(1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cxp + u * u * ex, (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cyp + u * u * ey]; });
      const tang = Math.atan2(ey - cyp, ex - cxp);
      const hs = Math.max(body * 0.7, 14 * env.unit);
      const head = [[ex - Math.cos(tang - 0.5) * hs, ey - Math.sin(tang - 0.5) * hs], [ex, ey], [ex - Math.cos(tang + 0.5) * hs, ey - Math.sin(tang + 0.5) * hs]];
      return [shaft, head];
    }
    case 'check': {
      const s = clamp(U.h * 1.1, body * 1.4, body * 2.4);
      const x = U.x + U.w + pad * 1.6, cy = U.y + U.h / 2;
      return [[[x, cy - s * 0.02], [x + s * 0.32, cy + s * 0.34], [x + s * 0.95, cy - s * 0.55]].flatMap((p, k, a) => (k === 0 ? [p] : Array.from({ length: 12 }, (_, q) => { const u = (q + 1) / 12; const [ax, ay] = a[k - 1]; return [ax + (p[0] - ax) * u, ay + (p[1] - ay) * u]; })))];
    }
    default: return [];
  }
}

function pathLength(poly) { let s = 0; for (let i = 1; i < poly.length; i++) s += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); return s; }

/** Point at fraction u along a list of polylines, plus how much of each polyline is drawn. */
function along(paths, u) {
  const lens = paths.map(pathLength);
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let target = total * clamp01(u);
  let tip = paths[0]?.[0] || [0, 0];
  const drawn = [];
  for (let k = 0; k < paths.length; k++) {
    const P = paths[k];
    if (target <= 0) { drawn.push(null); continue; }
    if (target >= lens[k]) { drawn.push(P); tip = P[P.length - 1]; target -= lens[k]; continue; }
    const part = [P[0]];
    let acc = 0;
    for (let i = 1; i < P.length; i++) {
      const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      if (acc + d >= target) { const f = (target - acc) / (d || 1); const q = [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f]; part.push(q); tip = q; break; }
      acc += d; part.push(P[i]);
    }
    drawn.push(part);
    target = 0;
  }
  return { tip, drawn };
}

function strokePoly(ctx, poly) {
  if (!poly || poly.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.stroke();
}

// ───────────────────────────── drawing ─────────────────────────────

function markColor(step, guide, p) {
  if (step.color) return colorOf(p, step.color, p.accent);
  if (step.do === 'cross') return p.negative || p.accent;
  if (step.do === 'check') return p.positive || p.accent;
  return guide.color ? colorOf(p, guide.color, p.accent) : p.accent;
}

/** Where the cursor rests for a step (pointing just under the middle of the target). */
function restPoint(step, rects, paths, env) {
  const U = union(rects);
  if (step.do === 'point' || step.do === 'focus') return rects[0].point ? [U.x + U.w / 2, U.y + U.h / 2] : [U.x + U.w * 0.55, U.y + U.h * 0.88];
  if (paths.length) return paths[0][0];
  return [U.x + U.w / 2, U.y + U.h / 2];
}

/** Visibility 0..1 of step i's mark at lt: fades out when the next step starts unless keep. */
function markAlpha(steps, i, lt, sceneDur) {
  const s = steps[i];
  if (lt < s.at) return 0;
  if (s.keep) return 1;
  const next = steps[i + 1];
  const off = next ? next.at - next.travel * 0.5 : s.do === 'focus' ? s.end : sceneDur + 1;
  return 1 - EASE.inOutSine(clamp01((lt - off) / 0.35));
}

function drawNote(ctx, env, p, text, U, color, k, prefer) {
  if (!text || k <= 0) return;
  const size = Math.max(env.sizes.small, env.sizes.body * 0.82);
  const font = fontString({ ...env.fonts.text, weight: 600 }, size);
  ctx.save();
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const tw = ctx.measureText(text).width;
  const ph = size * 1.75, pw = tw + size * 1.3;
  let x = U.x + U.w - pw * 0.25, y = U.y - ph - size * 0.75;
  if (prefer) { x = prefer[0] - pw / 2; y = prefer[1] - ph - size * 0.4; }
  if (y < env.grid.my * 0.4) y = U.y + U.h + size * 0.9;
  x = clamp(x, env.grid.mx * 0.4, env.W - env.grid.mx * 0.4 - pw);
  const e = EASE.outBack(clamp01(k));
  ctx.translate(x + pw / 2, y + ph / 2);
  ctx.rotate(-0.025);
  ctx.scale(e, e);
  ctx.globalAlpha *= clamp01(k * 2);
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 14 * env.unit; ctx.shadowOffsetY = 3 * env.unit;
  roundRect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = p.onAccent || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.04);
  ctx.restore();
}

function drawMark(ctx, env, p, guide, step, rects, paths, lt, alpha) {
  const color = markColor(step, guide, p);
  const u = drawEase(clamp01((lt - step.at) / step.drawDur));
  const U = union(rects);
  const lw = Math.max(3, env.unit * 5.5);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (step.do === 'focus') {
    const pad = env.sizes.small * 0.6;
    const k = EASE.inOutSine(u);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-env.W, -env.H, env.W * 3, env.H * 3);
    roundRect(ctx, U.x - pad, U.y - pad, U.w + pad * 2, U.h + pad * 2, pad);
    ctx.fillStyle = toCss(p.bg, 0.68 * k);
    ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = toCss(color, k); ctx.lineWidth = Math.max(2, env.unit * 3);
    roundRect(ctx, U.x - pad, U.y - pad, U.w + pad * 2, U.h + pad * 2, pad); ctx.stroke();
  } else if (step.do === 'point') {
    const r = Math.max(env.sizes.small * 0.9, Math.min(U.w, U.h) * 0.6);
    const tp = clamp01((lt - step.at) / 0.7);
    if (tp > 0 && tp < 1) {
      const [x, y] = restPoint(step, rects, paths, env);
      ctx.strokeStyle = toCss(color, 0.85 * (1 - tp)); ctx.lineWidth = Math.max(2, env.unit * 3);
      ctx.beginPath(); ctx.arc(x, y, r * EASE.outCubic(tp), 0, TAU); ctx.stroke();
    }
    if (rects[0].point) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(U.x + U.w / 2, U.y + U.h / 2, Math.max(4, env.unit * 7) * EASE.outBack(clamp01((lt - step.at) / 0.3)), 0, TAU); ctx.fill(); }
  } else {
    const { drawn } = along(paths, u);
    if (step.do === 'highlight') {
      ctx.globalCompositeOperation = p.dark ? 'screen' : 'multiply';
      ctx.strokeStyle = toCss(color, p.dark ? 0.42 : 0.34);
      ctx.lineCap = 'butt';
      drawn.forEach((d, k) => { if (!d) return; const r = rects[k] || U; ctx.lineWidth = r.seg ? env.sizes.body * 0.7 : r.h * 0.92; strokePoly(ctx, d); });
    } else {
      ctx.strokeStyle = color; ctx.lineWidth = step.do === 'cross' ? lw * 0.9 : lw;
      drawn.forEach((d) => strokePoly(ctx, d));
    }
  }
  if (step.note) {
    const prefer = step.do === 'arrow' && paths[0] ? paths[0][0] : null;
    drawNote(ctx, env, p, step.note, U, color, (lt - step.at - step.drawDur * 0.6) / 0.35, prefer);
  }
  ctx.restore();
}

// ── cursor ──
function cursorAt(steps, geo, lt, env) {
  const entry = [env.W * 0.9, env.H * 0.96];
  let pos = null, alpha = 0, press = 0, drawing = false;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i], G = geo[i];
    const from = i === 0 ? entry : geo[i - 1]?.end || entry;
    const t0 = s.at - s.travel;
    if (lt < t0) break;
    if (lt < s.at) {
      const u = glide(clamp01((lt - t0) / s.travel));
      const to = G?.start || from;
      const dx = to[0] - from[0], dy = to[1] - from[1];
      const len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(len * 0.18, env.sizes.body * 3);
      const c = [(from[0] + to[0]) / 2 - (dy / len) * bend, (from[1] + to[1]) / 2 + (dx / len) * bend];
      pos = [(1 - u) * (1 - u) * from[0] + 2 * (1 - u) * u * c[0] + u * u * to[0], (1 - u) * (1 - u) * from[1] + 2 * (1 - u) * u * c[1] + u * u * to[1]];
      alpha = i === 0 ? clamp01((lt - t0) / (s.travel * 0.5)) : 1;
      continue;
    }
    alpha = 1;
    if (!G) continue;
    if (lt < s.at + s.drawDur && G.paths.length && s.do !== 'focus') {
      pos = along(G.paths, drawEase(clamp01((lt - s.at) / s.drawDur))).tip;
      drawing = true;
    } else {
      const idle = lt - (s.at + s.drawDur);
      const w = env.unit * 3;
      pos = [G.end[0] + Math.sin(idle * 1.3 + i) * w * Math.min(1, idle), G.end[1] + Math.sin(idle * 0.9 + i * 2) * w * 0.6 * Math.min(1, idle)];
      drawing = false;
    }
    if (s.do === 'point') press = 1 - Math.abs(clamp01((lt - s.at) / 0.24) * 2 - 1);
  }
  const last = steps[steps.length - 1];
  if (pos && lt > last.end) alpha *= 1 - clamp01((lt - last.end) / 0.5);
  return { pos, alpha, press, drawing };
}

function drawCursor(ctx, kind, env, p, cur, color, history) {
  if (!cur.pos || cur.alpha <= 0 || kind === 'none') return;
  const [x, y] = cur.pos;
  const s = env.unit * 1.35;
  ctx.save();
  ctx.globalAlpha *= cur.alpha;
  if (kind === 'laser') {
    const r = 9 * env.unit;
    history.forEach(([hx, hy], k) => { const a = 0.32 * (1 - k / history.length); ctx.fillStyle = toCss('#ff3b30', a); ctx.beginPath(); ctx.arc(hx, hy, r * (0.9 - k * 0.06), 0, TAU); ctx.fill(); });
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,70,60,0.95)'); g.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  } else if (kind === 'pen') {
    ctx.translate(x, y);
    ctx.rotate(-0.72);
    const L = 64 * s, Wd = 11 * s;
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 10 * s; ctx.shadowOffsetX = 3 * s; ctx.shadowOffsetY = 5 * s;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Wd * 0.5, -Wd * 1.6); ctx.lineTo(Wd * 0.5, -L); ctx.lineTo(-Wd * 0.5, -L); ctx.lineTo(-Wd * 0.5, -Wd * 1.6); ctx.closePath();
    ctx.fillStyle = p.dark ? '#f2f2f2' : '#23252b'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Wd * 0.28, -Wd * 0.9); ctx.lineTo(-Wd * 0.28, -Wd * 0.9); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(-Wd * 0.5, -L, Wd, Wd * 1.1);
  } else if (kind === 'hand') {
    ctx.translate(x, y);
    const k = 1 - cur.press * 0.12;
    ctx.scale(k * s * 1.25, k * s * 1.25);
    ctx.translate(-9, -2);
    const P = new Path2D('M9 2c1.7 0 3 1.3 3 3v8.2l1.2-.4c1.6-.5 3.3.4 3.8 2l.1.3 1.4-.2c1.6-.2 3.1.8 3.5 2.4l.1.4 1.1-.1c1.8-.1 3.3 1.3 3.3 3.1V30c0 5.5-4.5 10-10 10h-3.2c-3.4 0-6.5-1.7-8.4-4.6L.7 27.6c-.9-1.4-.5-3.3.9-4.2 1.3-.8 3-.6 4 .6L6 24.6V5c0-1.7 1.3-3 3-3z');
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff'; ctx.fill(P);
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#1b1d22'; ctx.stroke(P);
  } else {
    // classic arrow pointer, tip at (x, y)
    ctx.translate(x, y);
    const k = 1 - cur.press * 0.14;
    ctx.scale(k * s * 1.45, k * s * 1.45);
    const P = new Path2D('M0 0 L0 22.5 L5.4 17.4 L9.3 26.4 L13.4 24.6 L9.6 15.8 L16.8 15.8 Z');
    ctx.shadowColor = 'rgba(0,0,0,0.32)'; ctx.shadowBlur = 7; ctx.shadowOffsetX = 1.2; ctx.shadowOffsetY = 2.6;
    ctx.fillStyle = '#16181d'; ctx.fill(P);
    ctx.shadowColor = 'transparent';
    ctx.lineJoin = 'round'; ctx.lineWidth = 1.7; ctx.strokeStyle = '#ffffff'; ctx.stroke(P);
    ctx.fill(P);
  }
  ctx.restore();
}

/** Geometry of every step that is on screen (or about to be) — targets, mark paths, start/end points. */
function stepGeometry(S, lt, env) {
  const { steps } = S.guide;
  return steps.map((s) => {
    if (lt < s.at - s.travel) return null;
    const rects = resolveTarget(s, S, Math.max(lt, s.at));
    if (!rects?.length) { S.guideMiss = S.guideMiss || new Set(); S.guideMiss.add(s.idx); return null; }
    const paths = markPaths(s, rects, env);
    const start = s.do === 'point' || s.do === 'focus' || !paths.length ? restPoint(s, rects, paths, env) : paths[0][0];
    const lastPath = paths[paths.length - 1];
    const end = s.do === 'point' || s.do === 'focus' || !paths.length ? start : s.do === 'arrow' ? paths[0][paths[0].length - 1] : lastPath[lastPath.length - 1];
    return { rects, paths, start, end };
  });
}

/** Draw the guide track of scene S at scene time lt (called after the scene's blocks, inside the camera). */
export function drawGuide(ctx, C, S, lt) {
  const G = S.guide;
  if (!G || lt < G.start) return;
  const { env } = C;
  const p = S.palette;
  const geo = stepGeometry(S, lt, env);
  G.steps.forEach((s, i) => {
    const g = geo[i];
    if (!g) return;
    const a = markAlpha(G.steps, i, lt, S.duration);
    if (a > 0) drawMark(ctx, env, p, G, s, g.rects, g.paths, lt, a);
  });
  const cur = cursorAt(G.steps, geo, lt, env);
  const history = [];
  if (G.cursor === 'laser') for (let k = 1; k <= 7; k++) { const h = cursorAt(G.steps, geo, lt - k * 0.018, env); if (h.pos) history.push(h.pos); }
  drawCursor(ctx, G.cursor, env, p, cur, markColor(G.steps.find((s) => lt >= s.at - s.travel && lt < s.end) || G.steps[0], G, p), history);
}

/** The narration line of the step being explained at lt (for captions), or null. */
export function guideSay(S, lt) {
  const G = S.guide;
  if (!G) return null;
  let cur = null;
  for (const s of G.steps) if (lt >= s.at - s.travel * 0.6) cur = s;
  if (!cur || lt > cur.end + 0.4) return null;
  return cur.say || null;
}
