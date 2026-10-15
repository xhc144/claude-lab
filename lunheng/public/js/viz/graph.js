// 论证图谱: force-directed graph of claims, objections and their logical relations.
import { STATUS_COLOR, KIND, STATUS, OSTATE } from '../lib/fmt.js';
import { shape, hexA, monoFont } from './arena.js';

const OBJ_COLOR = { open: '#ffb547', rebutted: '#b18cff', contested: '#ffb547', upheld: '#ff5c8a', conceded: '#ff5c8a', dismissed: '#56627a', withdrawn: '#56627a', addressed: '#2fd6c4' };
const REL_COLOR = { proves: '#34f5a4', refutes: '#ff5c8a', supports: '#4de8ff', generalizes: '#a78bfa' };

export function createGraph(container, { getState, onOpen, tip }) {
  const canvas = document.createElement('canvas');
  container.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const nodes = new Map();
  let edges = [];
  let alpha = 1;
  const view = { x: 0, y: 0, k: 1 };
  let drag = null;
  let hover = null;
  let running = true;
  let sig = '';
  let lastRev = -1;

  const resize = () => {
    const r = container.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.floor(W * dpr));
    canvas.height = Math.max(1, Math.floor(H * dpr));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function sync() {
    const S = getState();
    if (!S || S.ledgerRev === lastRev) return;
    lastRev = S.ledgerRev;
    const L = S.ledger;
    const key = JSON.stringify([Object.values(L.claims).map((c) => [c.id, c.status, c.versions.length, c.depends, c.target]), Object.values(L.objections).map((o) => [o.id, o.state])]);
    if (key === sig) return;
    sig = key;
    const want = new Set();
    const ensure = (id, data, near) => {
      want.add(id);
      let n = nodes.get(id);
      if (!n) {
        const base = near && nodes.get(near);
        n = { id, x: (base?.x ?? 0) + (Math.random() - 0.5) * 80, y: (base?.y ?? 0) + (Math.random() - 0.5) * 80, vx: 0, vy: 0, fixed: false };
        nodes.set(id, n);
        alpha = Math.max(alpha, 0.8);
      }
      Object.assign(n, data);
      return n;
    };
    const c0 = ensure('C0', { type: 'claim', c: L.claims.C0, r: 26 });
    if (!c0.placed) { c0.x = 0; c0.y = 0; c0.placed = true; }
    for (const c of Object.values(L.claims)) {
      if (c.id === 'C0') continue;
      const deg = Object.values(L.objections).filter((o) => o.target === c.id).length;
      ensure(c.id, { type: 'claim', c, r: 9 + Math.min(8, deg * 1.5) + (c.kind === 'theorem' ? 3 : 0) }, c.target || c.depends[0] || 'C0');
    }
    for (const o of Object.values(L.objections)) ensure(o.id, { type: 'objection', o, r: 5 }, o.target);
    for (const id of [...nodes.keys()]) if (!want.has(id)) nodes.delete(id);
    edges = [];
    for (const c of Object.values(L.claims)) {
      for (const d of c.depends) edges.push({ a: c.id, b: d, kind: 'depends', len: 110 });
      if (c.target && c.relation) edges.push({ a: c.id, b: c.target, kind: c.relation, len: 130 });
      else if (c.id !== 'C0' && !c.depends.length) edges.push({ a: c.id, b: 'C0', kind: 'loose', len: 190 });
    }
    for (const o of Object.values(L.objections)) edges.push({ a: o.id, b: o.target, kind: 'objection', len: 46, o });
    alpha = Math.max(alpha, 0.5);
  }

  function step() {
    if (alpha < 0.01) return;
    const arr = [...nodes.values()];
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const rep = (a.type === 'objection' || b.type === 'objection' ? 900 : 4200) / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx += dx * rep * alpha; a.vy += dy * rep * alpha;
        b.vx -= dx * rep * alpha; b.vy -= dy * rep * alpha;
      }
    }
    for (const e of edges) {
      const a = nodes.get(e.a), b = nodes.get(e.b);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = ((d - e.len) / d) * 0.04 * alpha * (e.kind === 'loose' ? 0.3 : 1);
      a.vx += dx * f; a.vy += dy * f;
      b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const n of arr) {
      if (n.id === 'C0') { n.vx += -n.x * 0.02; n.vy += -n.y * 0.02; }
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += Math.max(-30, Math.min(30, n.vx));
      n.y += Math.max(-30, Math.min(30, n.vy));
    }
    alpha *= 0.993;
  }

  const toScreen = (n) => ({ x: W / 2 + (n.x + view.x) * view.k, y: H / 2 + (n.y + view.y) * view.k });
  const toWorld = (x, y) => ({ x: (x - W / 2) / view.k - view.x, y: (y - H / 2) / view.k - view.y });

  function arrow(x1, y1, x2, y2, r2, color, dashed, width = 1.4) {
    const dx = x2 - x1, dy = y2 - y1;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ex = x2 - (dx / d) * (r2 + 3), ey = y2 - (dy / d) * (r2 + 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [4, 4] : []);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    const a = Math.atan2(dy, dx);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 8 * Math.cos(a - 0.4), ey - 8 * Math.sin(a - 0.4));
    ctx.lineTo(ex - 8 * Math.cos(a + 0.4), ey - 8 * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }

  function draw() {
    if (!running) return;
    requestAnimationFrame(draw);
    sync();
    step();
    const S = getState();
    if (!S || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const k = view.k;
    for (const e of edges) {
      const a = nodes.get(e.a), b = nodes.get(e.b);
      if (!a || !b) continue;
      const A = toScreen(a), B = toScreen(b);
      if (e.kind === 'objection') arrow(A.x, A.y, B.x, B.y, b.r * k, hexA(OBJ_COLOR[e.o.state] || '#ffb547', 0.75), e.o.state === 'dismissed' || e.o.state === 'addressed', 1.2);
      else if (e.kind === 'depends') arrow(A.x, A.y, B.x, B.y, b.r * k, 'rgba(160,175,205,0.45)', true);
      else if (e.kind === 'loose') { ctx.strokeStyle = 'rgba(120,170,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
      else arrow(A.x, A.y, B.x, B.y, b.r * k, hexA(REL_COLOR[e.kind] || '#4de8ff', a.c?.status === 'proved' ? 0.95 : 0.5), false, a.c?.status === 'proved' ? 2.2 : 1.4);
    }
    for (const n of nodes.values()) {
      const p = toScreen(n);
      const r = n.r * k;
      if (n.type === 'objection') {
        ctx.fillStyle = OBJ_COLOR[n.o.state] || '#ffb547';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); ctx.restore();
        if (k > 0.8) { ctx.fillStyle = 'rgba(160,175,205,0.8)'; ctx.font = `10px ${monoFont()}`; ctx.textAlign = 'center'; ctx.fillText(n.id, p.x, p.y - r - 4); }
        continue;
      }
      const c = n.c;
      const col = STATUS_COLOR[c.status] || '#8b9ab3';
      ctx.shadowColor = col; ctx.shadowBlur = hover === n.id ? 26 : 12;
      ctx.fillStyle = hexA(col, c.withdrawn ? 0.3 : 0.9);
      if (n.id === 'C0') {
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.stroke();
      } else {
        shape(ctx, c.kind, p.x, p.y, r);
        ctx.shadowBlur = 0;
      }
      // verification ticks
      const vs = Object.values(S.ledger.verdicts).filter((v) => v.target === c.id && v.targetVersion === c.versions.length && v.verdict === 'valid');
      vs.forEach((v, i) => {
        const a = -Math.PI / 2 + i * 0.5;
        ctx.fillStyle = '#34f5a4';
        ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * (r + 6), p.y + Math.sin(a) * (r + 6), 2.4, 0, Math.PI * 2); ctx.fill();
      });
      const author = S.team.find((t) => t.id === c.author);
      ctx.fillStyle = n.id === 'C0' ? '#04060c' : 'rgba(230,238,250,0.95)';
      ctx.font = `700 ${n.id === 'C0' ? 13 : 11}px ${monoFont()}`;
      ctx.textAlign = 'center';
      ctx.fillText(n.id, p.x, n.id === 'C0' ? p.y + 4 : p.y + r + 15);
      if (author && k > 0.7) { ctx.fillStyle = author.color; ctx.font = `10px ${monoFont()}`; ctx.fillText(author.label, p.x, p.y + r + 27); }
    }
  }
  requestAnimationFrame(draw);

  function nodeAt(e) {
    const rect = canvas.getBoundingClientRect();
    const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    let best = null, bd = Infinity;
    for (const n of nodes.values()) {
      const d = (n.x - w.x) ** 2 + (n.y - w.y) ** 2;
      const rr = (n.r + 6) ** 2;
      if (d < rr && d < bd) { best = n; bd = d; }
    }
    return best;
  }

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const before = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    view.k = Math.min(3, Math.max(0.25, view.k * (e.deltaY < 0 ? 1.12 : 0.89)));
    const after = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    view.x += after.x - before.x; view.y += after.y - before.y;
  }, { passive: false });
  canvas.addEventListener('mousedown', (e) => {
    const n = nodeAt(e);
    drag = { n, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    if (n) n.fixed = true;
    canvas.classList.add('dragging');
  });
  addEventListener('mousemove', onMove);
  addEventListener('mouseup', onUp);
  function onMove(e) {
    if (drag) {
      const dx = (e.clientX - drag.sx) / view.k, dy = (e.clientY - drag.sy) / view.k;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      if (drag.n) {
        const rect = canvas.getBoundingClientRect();
        const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
        drag.n.x = w.x; drag.n.y = w.y;
        alpha = Math.max(alpha, 0.2);
      } else { view.x = drag.vx + dx; view.y = drag.vy + dy; }
      return;
    }
    if (e.target !== canvas) return;
    const n = nodeAt(e);
    hover = n?.id || null;
    canvas.style.cursor = n ? 'pointer' : 'grab';
    if (n && tip) {
      const rect = container.getBoundingClientRect();
      const text = n.type === 'objection'
        ? `${n.id} → ${n.o.target} · ${OSTATE[n.o.state]}\n${n.o.content.slice(0, 220)}`
        : `${n.id} · ${KIND[n.c.kind] || n.c.kind} · ${STATUS[n.c.status]}\n${n.c.versions[n.c.versions.length - 1].statement.slice(0, 260)}`;
      tip(text, e.clientX - rect.left + 14, e.clientY - rect.top + 14);
    } else tip?.(null);
  }
  function onUp() {
    if (!drag) return;
    canvas.classList.remove('dragging');
    if (drag.n) {
      drag.n.fixed = drag.moved;
      if (!drag.moved) onOpen?.(drag.n.type === 'objection' ? drag.n.o.target : drag.n.id);
    }
    drag = null;
  }

  return {
    reset() { view.x = 0; view.y = 0; view.k = 1; for (const n of nodes.values()) n.fixed = false; alpha = 1; },
    reheat() { alpha = 1; },
    destroy() { running = false; ro.disconnect(); removeEventListener('mousemove', onMove); removeEventListener('mouseup', onUp); canvas.remove(); },
  };
}
