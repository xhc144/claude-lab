// 交锋场: researchers on an orbit around the proposition core. Live calls pulse, claims orbit the
// core in status colours, and every objection / verdict / ruling fires a beam between researchers.
import { STATUS_COLOR } from '../lib/fmt.js';

const BEAM = { claim: '#4de8ff', objection: '#ff5c8a', verdict: '#34f5a4', 'verdict-bad': '#ffb547', ruling: '#ffb547', response: '#b18cff', compute: '#5b9dff', synthesis: '#2fd6c4', withdraw: '#8b9ab3' };

export function createArena(container, { getState, onSelect }) {
  const canvas = document.createElement('canvas');
  container.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let hover = null;
  const beams = [];
  const flashes = new Map();
  let running = true;
  const t0 = performance.now();

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

  function layout(team) {
    const cx = W / 2, cy = H / 2;
    const R = Math.max(80, Math.min(W * 0.4, H * 0.335));
    const pos = new Map();
    const n = team.length;
    team.forEach((r, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      pos.set(r.id, { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a });
    });
    return { cx, cy, R, pos };
  }

  function claimPositions(L, cx, cy, R) {
    const claims = Object.values(L.claims).filter((c) => c.id !== 'C0');
    const out = new Map();
    const r1 = Math.max(60, R * 0.5);
    claims.forEach((c, i) => {
      const a = -Math.PI / 2 + (i / Math.max(claims.length, 8)) * Math.PI * 2 + (performance.now() - t0) / 90000;
      const ring = r1 + (i % 2) * 14;
      out.set(c.id, { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring, c });
    });
    return out;
  }

  function beam(from, to, color) {
    beams.push({ from, to, color, born: performance.now(), life: 2400 });
    if (beams.length > 80) beams.shift();
  }

  function draw(now) {
    if (!running) return;
    requestAnimationFrame(draw);
    const S = getState();
    if (!S || !W) return;
    const team = S.team.filter((r) => r.active !== false);
    const { cx, cy, R, pos } = layout(team);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const t = (now - t0) / 1000;

    // core glow + orbit
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2);
    g.addColorStop(0, 'rgba(77,232,255,0.10)');
    g.addColorStop(0.5, 'rgba(120,100,255,0.04)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = 'rgba(120,180,255,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    for (const [k, rr] of [[1, 64], [-1, 92]]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(k * t * 0.15);
      ctx.strokeStyle = 'rgba(120,180,255,0.14)';
      ctx.setLineDash([14, 10, 2, 10]);
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // claims orbiting the core, linked to authors
    const cpos = claimPositions(S.ledger, cx, cy, R);
    for (const [id, p] of cpos) {
      const c = p.c;
      const col = STATUS_COLOR[c.status] || '#8b9ab3';
      const ap = pos.get(c.author);
      if (ap) {
        ctx.strokeStyle = hexA(col, c.withdrawn ? 0.05 : 0.13);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ap.x, ap.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      if (c.target === 'C0' && (c.relation === 'proves' || c.relation === 'refutes')) {
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = hexA(c.relation === 'proves' ? '#34f5a4' : '#ff5c8a', c.status === 'proved' ? 0.7 : 0.25);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.restore();
      }
      const fl = flashes.get(id);
      const boost = fl ? Math.max(0, 1 - (now - fl) / 1500) : 0;
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 8 + boost * 24;
      const sz = (c.kind === 'theorem' ? 6 : c.kind === 'counterexample' ? 6 : 4.5) + boost * 4;
      shape(ctx, c.kind, p.x, p.y, sz);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200,215,240,0.75)';
      ctx.font = '600 10px ' + monoFont();
      ctx.textAlign = 'center';
      ctx.fillText(id, p.x, p.y - sz - 4);
    }

    // proposition core
    const C0 = S.ledger.claims.C0;
    const c0col = STATUS_COLOR[C0.status] || '#8b9ab3';
    const pulse = 1 + Math.sin(t * 2.2) * 0.04;
    const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 48 * pulse);
    cg.addColorStop(0, hexA(c0col, 0.5));
    cg.addColorStop(1, hexA(c0col, 0.02));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, 48 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c0col;
    ctx.lineWidth = 2;
    ctx.shadowColor = c0col; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    // beams
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      const age = (now - b.born) / b.life;
      if (age >= 1) { beams.splice(i, 1); continue; }
      const A = b.from === 'core' ? { x: cx, y: cy } : pos.get(b.from);
      const B = b.to === 'core' ? { x: cx, y: cy } : pos.get(b.to);
      if (!A || !B) continue;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const qx = mx + (cx - mx) * 0.55, qy = my + (cy - my) * 0.55;
      ctx.strokeStyle = hexA(b.color, 0.35 * (1 - age));
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(qx, qy, B.x, B.y); ctx.stroke();
      const head = Math.min(1, age * 1.6);
      for (let k = 0; k < 6; k++) {
        const u = Math.max(0, head - k * 0.035);
        const x = (1 - u) * (1 - u) * A.x + 2 * (1 - u) * u * qx + u * u * B.x;
        const y = (1 - u) * (1 - u) * A.y + 2 * (1 - u) * u * qy + u * u * B.y;
        ctx.fillStyle = hexA(b.color, (1 - k / 6) * (1 - age * 0.7));
        ctx.beginPath(); ctx.arc(x, y, 3.2 - k * 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // researchers
    const live = S.live || {};
    for (const r of team) {
      const p = pos.get(r.id);
      const state = live[r.id] || r.stats?.state || 'idle';
      const stance = S.ledger.stances?.C0?.[r.id]?.position;
      const rad = 20;
      const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, rad * 2.4);
      glow.addColorStop(0, hexA(r.color, 0.35));
      glow.addColorStop(1, hexA(r.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad * 2.4, 0, Math.PI * 2); ctx.fill();
      // hexagonal badge
      ctx.fillStyle = 'rgba(6,10,20,0.92)';
      ctx.strokeStyle = r.color;
      ctx.lineWidth = hover === r.id ? 2.5 : 1.6;
      hex(ctx, p.x, p.y, rad);
      ctx.fill(); ctx.stroke();
      if (stance) {
        ctx.strokeStyle = { agree: '#34f5a4', disagree: '#ff5c8a', unsure: '#ffb547' }[stance];
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 6, p.a + Math.PI - 0.5, p.a + Math.PI + 0.5); ctx.stroke();
      }
      if (state === 'thinking' || state === 'streaming') {
        const col = state === 'thinking' ? '#b18cff' : '#4de8ff';
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.shadowColor = col; ctx.shadowBlur = 12;
        const s0 = t * (state === 'thinking' ? 3 : 6);
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 11, s0, s0 + 1.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 11, s0 + Math.PI, s0 + Math.PI + 1.6); ctx.stroke();
        ctx.shadowBlur = 0;
        if (state === 'streaming' && Math.random() < 0.25) beams.push({ from: r.id, to: 'core', color: '#4de8ff', born: now, life: 1400 });
      }
      if ((r.stats?.state === 'idle') && r.stats?.lastError && live[r.id] === 'error') {
        ctx.strokeStyle = '#ff5c8a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 8, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = r.color;
      ctx.font = '700 15px ' + monoFont();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.label, p.x, p.y + 1);
      ctx.textBaseline = 'alphabetic';
      const below = p.y > cy - 4;
      const ty = below ? p.y + rad + 22 : p.y - rad - 26;
      ctx.fillStyle = 'rgba(225,235,250,0.92)';
      ctx.font = '600 11.5px ' + monoFont();
      ctx.fillText(short(r.modelId), p.x, ty);
      ctx.fillStyle = 'rgba(140,155,180,0.9)';
      ctx.font = '11px ' + uiFont();
      ctx.fillText(`${S.roleName?.(r.role) || r.role} · ${r.vendor}`, p.x, ty + 14);
    }
  }
  requestAnimationFrame(draw);

  const pick = (e) => {
    const S = getState();
    if (!S) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const { pos } = layout(S.team.filter((r) => r.active !== false));
    for (const [id, p] of pos) if ((p.x - x) ** 2 + (p.y - y) ** 2 < 26 * 26) return id;
    return null;
  };
  canvas.addEventListener('mousemove', (e) => { hover = pick(e); canvas.style.cursor = hover ? 'pointer' : 'default'; });
  canvas.addEventListener('click', (e) => { const id = pick(e); if (id) onSelect?.(id); });

  return {
    /** Visualise a feed entry: beams between the actor and the author of what they acted on. */
    pulse(entry, S) {
      if (!entry?.rid) {
        if (entry?.kind === 'status') for (const r of entry.refs || []) flashes.set(r, performance.now());
        return;
      }
      const L = S.ledger;
      const ref = (entry.refs || [])[entry.kind === 'objection' || entry.kind === 'verdict' ? 1 : 0] || (entry.refs || [])[0];
      let targetClaim = ref && L.claims[ref] ? L.claims[ref] : null;
      if (!targetClaim && ref && L.objections[ref]) targetClaim = L.claims[L.objections[ref].target];
      const kind = entry.kind === 'verdict' && entry.verdict && entry.verdict !== 'valid' ? 'verdict-bad' : entry.kind;
      const color = BEAM[kind] || '#4de8ff';
      if (entry.kind === 'claim' || entry.kind === 'synthesis') { beam(entry.rid, 'core', color); if (ref) flashes.set(ref, performance.now()); return; }
      if (entry.kind === 'response' && ref && L.objections[ref]) { beam(entry.rid, L.objections[ref].author, color); return; }
      const to = targetClaim?.author && targetClaim.author !== 'PI' && targetClaim.author !== entry.rid ? targetClaim.author : 'core';
      beam(entry.rid, to, color);
      if (targetClaim) flashes.set(targetClaim.id, performance.now());
    },
    destroy() { running = false; ro.disconnect(); canvas.remove(); },
  };
}

function hex(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export function shape(ctx, kind, x, y, s) {
  ctx.beginPath();
  if (kind === 'conjecture') { ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s * 1.3, y); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s * 1.3, y); ctx.closePath(); }
  else if (kind === 'counterexample') { ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s * 1.2, y + s); ctx.lineTo(x - s * 1.2, y + s); ctx.closePath(); }
  else if (kind === 'theorem') { hex(ctx, x, y, s * 1.25); }
  else if (kind === 'observation' || kind === 'definition') { ctx.rect(x - s, y - s, s * 2, s * 2); }
  else ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.fill();
}

export function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const short = (id) => (id.length > 22 ? id.slice(0, 21) + '…' : id);
let fonts = null;
const readFonts = () => {
  if (!fonts) {
    const cs = getComputedStyle(document.documentElement);
    fonts = { mono: cs.getPropertyValue('--mono').trim() || 'monospace', ui: cs.getPropertyValue('--font').trim() || 'sans-serif' };
  }
  return fonts;
};
export const monoFont = () => readFonts().mono;
export const uiFont = () => readFonts().ui;
