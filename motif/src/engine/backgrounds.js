// Procedural backgrounds. Each generator has an `under` pass (behind content) and an optional
// `over` pass (grain, vignette, letterbox) drawn on top of content. All are deterministic in t.
import { toCss, mix, adjust } from '../core/util/color.js';
import { rng } from '../core/util/misc.js';
import { colorOf } from './env.js';

const TAU = Math.PI * 2;

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}

// ───────────────────────────── textures (cached per process) ─────────────────────────────
const tex = {};
function grainTile() {
  if (tex.grain) return tex.grain;
  const s = 256;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  const img = g.createImageData(s, s);
  const r = rng(7);
  for (let i = 0; i < s * s; i++) {
    const v = r() * 255;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  tex.grain = c;
  return c;
}

function fiberTile() {
  if (tex.fiber) return tex.fiber;
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  const r = rng(11);
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = r() * s, y = r() * s, len = 6 + r() * 28, a = r() * TAU;
    g.strokeStyle = r() > 0.5 ? 'rgba(90,70,40,0.13)' : 'rgba(255,255,255,0.22)';
    g.lineWidth = 0.4 + r() * 0.9;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // soft mottling
  for (let i = 0; i < 40; i++) {
    const x = r() * s, y = r() * s, rad = 20 + r() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() > 0.5 ? 'rgba(120,90,50,0.05)' : 'rgba(255,255,255,0.08)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  tex.fiber = c;
  return c;
}

/** 1D fractal noise for mountain silhouettes. */
function ridge(seed, n) {
  const r = rng(seed);
  const pts = new Float32Array(n);
  const oct = [[0.5, 6], [0.25, 17], [0.13, 41], [0.06, 97]];
  const phases = oct.map(() => r() * 100);
  for (let i = 0; i < n; i++) {
    let v = 0;
    oct.forEach(([amp, freq], k) => { v += amp * Math.sin((i / n) * freq + phases[k]) * Math.cos((i / n) * freq * 0.37 + phases[k] * 1.7); });
    pts[i] = v;
  }
  return pts;
}

function mountainsLayer(W, H, color) {
  const key = `m${W}x${H}${color}`;
  if (tex[key]) return tex[key];
  const c = makeCanvas(Math.round(W * 1.5), H);
  const g = c.getContext('2d');
  const layers = [[0.62, 0.05, 3], [0.7, 0.08, 5], [0.79, 0.11, 9], [0.88, 0.16, 13]];
  layers.forEach(([base, alpha, seed], k) => {
    const n = 400;
    const pts = ridge(seed, n);
    g.save();
    g.filter = `blur(${(4 - k) * 3 + 2}px)`;
    const grad = g.createLinearGradient(0, H * (base - 0.25), 0, H);
    grad.addColorStop(0, toCss(color, alpha * 1.4));
    grad.addColorStop(0.55, toCss(color, alpha * 0.6));
    grad.addColorStop(1, toCss(color, 0));
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(0, H);
    for (let i = 0; i < n; i++) g.lineTo((i / (n - 1)) * c.width, H * (base - 0.18 * (pts[i] + 0.5) * (1 - k * 0.12)));
    g.lineTo(c.width, H); g.closePath(); g.fill();
    g.restore();
  });
  tex[key] = c;
  return c;
}

function noiseField(w, h, seed = 3) {
  const key = `nf${w}x${h}${seed}`;
  if (tex[key]) return tex[key];
  const r = rng(seed);
  const grid = (gw, gh) => Array.from({ length: (gw + 1) * (gh + 1) }, () => r());
  const octs = [[4, 0.5], [9, 0.25], [19, 0.15], [41, 0.1]].map(([f, a]) => ({ f, a, g: grid(f, Math.ceil((f * h) / w)) }));
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (const o of octs) {
      const gw = o.f, gh = Math.ceil((o.f * h) / w);
      const fx = (x / w) * gw, fy = (y / h) * gh;
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => o.g[Math.min(gh, j) * (gw + 1) + Math.min(gw, i)];
      v += o.a * ((at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy);
    }
    out[y * w + x] = v;
  }
  let mn = Infinity, mx = -Infinity;
  for (const v of out) { if (v < mn) mn = v; if (v > mx) mx = v; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
  tex[key] = out;
  return out;
}
export { noiseField, makeCanvas };

/** Grain is pre-baked once per size/amount into a light+dark noise layer and drawn with a
 *  per-frame random offset — far cheaper than a full-frame 'overlay' composite every frame. */
function grainLayer(W, H, amount, dark) {
  const key = `g${W}x${H}:${amount}:${dark}`;
  if (tex[key]) return tex[key];
  const pad = 128;
  const c = makeCanvas(Math.ceil(W / 2) + pad, Math.ceil(H / 2) + pad);
  const g = c.getContext('2d');
  const img = g.createImageData(c.width, c.height);
  const r = rng(13);
  const k = Math.min(1, amount * (dark ? 2.2 : 1.6));
  for (let i = 0; i < c.width * c.height; i++) {
    const v = r() - 0.5;
    const light = v > 0;
    img.data[i * 4] = light ? 255 : 0; img.data[i * 4 + 1] = light ? 255 : 0; img.data[i * 4 + 2] = light ? 255 : 0;
    img.data[i * 4 + 3] = Math.abs(v) * 2 * 255 * k * (light ? (dark ? 0.6 : 0.5) : (dark ? 0.9 : 0.7));
  }
  g.putImageData(img, 0, 0);
  tex[key] = c;
  for (const k2 of Object.keys(tex)) if (k2.startsWith('g') && k2 !== key && k2.split(':')[0] !== key.split(':')[0]) delete tex[k2];
  return c;
}

function drawGrain(ctx, W, H, amount, t, fps = 30, dark = true) {
  if (!amount) return;
  const layer = grainLayer(W, H, amount, dark);
  const frame = Math.floor(t * fps) % 64;
  const r = rng(frame + 1);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const ox = Math.floor(r() * 128), oy = Math.floor(r() * 128);
  ctx.drawImage(layer, ox, oy, Math.ceil(W / 2), Math.ceil(H / 2), 0, 0, W, H);
  ctx.restore();
}

function vignette(ctx, W, H, amount, color = '#000') {
  if (!amount) return;
  const key = `v${W}x${H}:${amount}:${color}`;
  let c = tex[key];
  if (!c) {
    c = makeCanvas(Math.ceil(W / 4), Math.ceil(H / 4));
    const g = c.getContext('2d');
    const w = c.width, h = c.height;
    const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    grd.addColorStop(0, toCss(color, 0));
    grd.addColorStop(1, toCss(color, amount));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    tex[key] = c;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, W, H);
  ctx.restore();
}

// ───────────────────────────── generators ─────────────────────────────
const GEN = {
  solid: { under(ctx, e) { ctx.fillStyle = colorOf(e.p, e.spec.color, e.p.bg); ctx.fillRect(0, 0, e.W, e.H); } },

  gradient: {
    under(ctx, e) {
      const cs = (e.spec.colors || [e.p.bg, e.p.bg2]).map((c) => colorOf(e.p, c));
      const a = ((e.spec.angle ?? 135) * Math.PI) / 180;
      const cx = e.W / 2, cy = e.H / 2, L = Math.hypot(e.W, e.H) / 2;
      const g = ctx.createLinearGradient(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      cs.forEach((c, i) => g.addColorStop(i / Math.max(1, cs.length - 1), c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, e.W, e.H);
    },
  },

  aurora: {
    smooth(ctx, e) {
      const { W, H, p, spec, t } = e;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, p.bg); g.addColorStop(1, p.bg2 || p.bg);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const colors = p.tone === 'base' ? spec.colors || [p.accent, p.accent2] : [p.accent, p.bg2 || p.accent];
      const k = (spec.intensity ?? 0.6) * (p.tone === 'base' ? 1 : 0.6);
      ctx.save();
      ctx.globalCompositeOperation = p.dark ? 'screen' : 'multiply';
      colors.forEach((c, i) => {
        const sp = 0.045 + i * 0.012;
        const cx = W * (0.5 + 0.42 * Math.sin(t * sp + i * 2.1));
        const cy = H * (0.5 + 0.36 * Math.cos(t * sp * 0.8 + i * 1.3));
        const R = Math.max(W, H) * (0.42 + 0.08 * Math.sin(t * 0.1 + i));
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        rg.addColorStop(0, toCss(c, 0.5 * k));
        rg.addColorStop(0.45, toCss(c, 0.18 * k));
        rg.addColorStop(1, toCss(c, 0));
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      });
      ctx.restore();
      const hg = ctx.createLinearGradient(0, H * 0.78, 0, H);
      hg.addColorStop(0, toCss(p.bg, 0)); hg.addColorStop(1, toCss(p.bg, 0.65));
      ctx.fillStyle = hg; ctx.fillRect(0, H * 0.78, W, H * 0.22);
    },
    detail(ctx, e) {
      const { W, H, p, spec, t } = e;
      if (!spec.stars || !p.dark) return;
      const r = rng(42);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 140; i++) {
        const x = r() * W, y = r() * H, s = r() * 1.6 + 0.3, ph = r() * TAU;
        ctx.globalAlpha = spec.stars * (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * (0.6 + r()) + ph)));
        ctx.fillRect(x, y, s * e.unit * 1.4, s * e.unit * 1.4);
      }
      ctx.restore();
    },
    over(ctx, e) { drawGrain(ctx, e.W, e.H, e.spec.grain ?? 0.03, 0, e.fps, true); },
  },

  paper: {
    under(ctx, e) {
      const { W, H, p, spec } = e;
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      if (spec.fibers) {
        ctx.save(); ctx.globalAlpha = spec.fibers * (p.dark ? 0.35 : 1);
        ctx.fillStyle = ctx.createPattern(fiberTile(), 'repeat');
        ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    },
    over(ctx, e) {
      drawGrain(ctx, e.W, e.H, (e.spec.grain ?? 0.05) * 0.8, 0, e.fps, e.p.dark);
      vignette(ctx, e.W, e.H, (e.spec.vignette ?? 0.2) * (e.p.dark ? 1.2 : 0.35), e.p.dark ? '#000' : '#6b5638');
    },
  },

  grid: {
    under(ctx, e) {
      const { W, H, p, spec, env } = e;
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      const S = env.grid.safe;
      const cols = spec.columns || env.grid.cols;
      ctx.strokeStyle = toCss(p.ink, p.dark ? 0.07 : 0.06);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= cols; i++) {
        const x = Math.round(S.x + (i * (S.w + env.grid.gutter)) / cols - (i ? env.grid.gutter / 2 : 0)) + 0.5;
        ctx.moveTo(x, 0); ctx.lineTo(x, H);
      }
      ctx.stroke();
    },
  },

  blueprint: {
    under(ctx, e) {
      const { W, H, p, spec, t, unit } = e;
      const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, adjust(p.bg, { l: 0.035 })); g.addColorStop(1, p.bg);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const step = (spec.minor || 24) * unit * 1.25;
      const off = (t * 4 * unit) % step;
      ctx.lineWidth = 1;
      for (const [every, col] of [[1, toCss(p.ink, p.dark ? 0.06 : 0.07)], [spec.major || 4, toCss(p.ink, p.dark ? 0.13 : 0.14)]]) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        for (let x = -off; x < W; x += step * every) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
        for (let y = -off * 0.5; y < H; y += step * every) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
        ctx.stroke();
      }
      // registration marks
      ctx.strokeStyle = toCss(p.ink, 0.35); ctx.lineWidth = Math.max(1, unit * 1.2);
      const m = Math.min(W, H) * 0.045, L = m * 0.5;
      for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) {
        ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, L * 0.45, 0, TAU); ctx.stroke();
      }
    },
  },

  vignette: {
    under(ctx, e) { ctx.fillStyle = e.p.bg; ctx.fillRect(0, 0, e.W, e.H); },
    over(ctx, e) { vignette(ctx, e.W, e.H, e.spec.vignette ?? 0.4, '#000'); drawGrain(ctx, e.W, e.H, e.spec.grain ?? 0.03, 0, e.fps, e.p.dark); },
  },

  ink: {
    under(ctx, e) {
      const { W, H, p, spec, t } = e;
      GEN.paper.under(ctx, { ...e, spec: { fibers: spec.fibers ?? 0.8 } });
      if (spec.mountains && p.tone !== 'accent') {
        const layer = mountainsLayer(W, H, p.dark ? '#d8cdb8' : '#1e1b17');
        ctx.save(); ctx.globalAlpha = spec.mountains * (p.dark ? 0.5 : 1);
        const dx = -((t * 6) % (layer.width - W));
        ctx.drawImage(layer, dx, 0);
        ctx.restore();
      }
      // sun / moon disk
      ctx.save();
      ctx.globalAlpha = p.dark ? 0.08 : 0.065;
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.arc(W * 0.86, H * 0.2, Math.min(W, H) * 0.085, 0, TAU); ctx.fill();
      ctx.restore();
    },
    over(ctx, e) { drawGrain(ctx, e.W, e.H, e.spec.grain ?? 0.05, 0, e.fps, e.p.dark); vignette(ctx, e.W, e.H, e.p.dark ? 0.4 : 0.12, '#3b2a14'); },
  },

  pop: {
    under(ctx, e) {
      const { W, H, p, spec, t, unit } = e;
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      const s = Math.min(W, H);
      // halftone dots in the bottom-left corner
      if (spec.dots) {
        ctx.fillStyle = toCss(p.ink, 0.13 * spec.dots * 2);
        const step = 22 * unit;
        for (let y = H * 0.55; y < H + step; y += step) for (let x = -step; x < W * 0.4; x += step) {
          const d = Math.hypot(x / (W * 0.4), (H - y) / (H * 0.45));
          const r = Math.max(0, (1 - d) * step * 0.36);
          if (r > 0.5) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        }
      }
      if (spec.shapes) {
        const c1 = p.tone === 'accent' ? p.accent : p.accent2 || p.accent;
        const c2 = p.tone === 'base' ? p.accent : p.data[2] || p.ink;
        ctx.save();
        ctx.translate(W - s * 0.08, s * 0.1); ctx.rotate(t * 0.15);
        ctx.fillStyle = c2; star(ctx, 0, 0, s * 0.14, s * 0.08, 8); ctx.fill();
        ctx.lineWidth = 4 * unit; ctx.strokeStyle = p.line; ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.translate(W * 0.94, H * 0.9);
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, TAU); ctx.fill();
        ctx.lineWidth = 4 * unit; ctx.strokeStyle = p.line; ctx.stroke();
        ctx.restore();
        // squiggle
        ctx.save(); ctx.strokeStyle = p.line; ctx.lineWidth = 6 * unit; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const x = W * 0.06 + i * s * 0.006; const y = H * 0.12 + Math.sin(i * 0.6 + t * 2) * s * 0.012; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke(); ctx.restore();
      }
    },
  },

  soft: {
    smooth(ctx, e) {
      const { W, H, p, spec } = e;
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      const rg = ctx.createRadialGradient(W * 0.92, -H * 0.1, 0, W * 0.92, -H * 0.1, Math.max(W, H) * 0.75);
      rg.addColorStop(0, toCss(p.accent, (spec.tint ?? 0.07) * (p.tone === 'base' ? 1 : 0.5)));
      rg.addColorStop(1, toCss(p.accent, 0));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      const rg2 = ctx.createRadialGradient(0, H * 1.1, 0, 0, H * 1.1, Math.max(W, H) * 0.6);
      rg2.addColorStop(0, toCss(p.accent2 || p.accent, (spec.tint ?? 0.07) * 0.7)); rg2.addColorStop(1, toCss(p.accent2 || p.accent, 0));
      ctx.fillStyle = rg2; ctx.fillRect(0, 0, W, H);
    },
    detail(ctx, e) {
      const { W, H, p, spec, unit } = e;
      if (!spec.dots) return;
      ctx.fillStyle = toCss(p.ink, 0.1 * spec.dots);
      const step = 26 * unit;
      for (let y = step; y < H * 0.36; y += step) for (let x = W * 0.72; x < W; x += step) {
        const fade = (1 - y / (H * 0.36)) * ((x - W * 0.72) / (W * 0.28));
        ctx.globalAlpha = fade; ctx.fillRect(x, y, 2.4 * unit, 2.4 * unit);
      }
      ctx.globalAlpha = 1;
    },
  },

  noir: {
    smooth(ctx, e) {
      const { W, H, p, spec, t } = e;
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      if (spec.leak) {
        const x = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.07)));
        const rg = ctx.createRadialGradient(x, H * 0.15, 0, x, H * 0.15, Math.max(W, H) * 0.55);
        rg.addColorStop(0, toCss(p.accent, 0.12 * spec.leak * (p.dark ? 1 : 0.4)));
        rg.addColorStop(1, toCss(p.accent, 0));
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      }
    },
    over(ctx, e) {
      const { W, H, spec } = e;
      vignette(ctx, W, H, spec.vignette ?? 0.6, '#000');
      drawGrain(ctx, W, H, spec.grain ?? 0.07, Math.floor(e.t * 12) / 12, e.fps, true);
      if (spec.letterbox && !e.env.portrait) {
        const h = H * spec.letterbox;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
      }
    },
  },

  blobs: {
    under(ctx, e) {
      const { W, H, p, spec, t, unit } = e;
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      const colors = p.tone === 'base' ? spec.colors || [p.accent] : [toCss(p.ink, 0.08), toCss(p.ink, 0.05)];
      const s = Math.min(W, H);
      const spots = [[0.95, 0.08, 0.34], [0.04, 0.95, 0.3], [0.88, 0.92, 0.18], [0.1, 0.1, 0.12]];
      spots.forEach(([fx, fy, fr], i) => {
        const c = colors[i % colors.length];
        const cx = W * fx + Math.sin(t * 0.2 + i) * s * 0.02, cy = H * fy + Math.cos(t * 0.17 + i * 2) * s * 0.02;
        const R = s * fr;
        ctx.save(); ctx.globalAlpha = (spec.intensity ?? 0.8) * (p.tone === 'base' ? 1 : 1);
        ctx.fillStyle = c;
        ctx.beginPath();
        for (let k = 0; k <= 64; k++) {
          const a = (k / 64) * TAU;
          const rr = R * (1 + 0.08 * Math.sin(a * 3 + t * 0.4 + i) + 0.05 * Math.cos(a * 5 - t * 0.3 + i * 2));
          k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.fill(); ctx.restore();
      });
      if (spec.dots) {
        ctx.fillStyle = toCss(p.ink, 0.12 * spec.dots * 2);
        const step = 24 * unit;
        for (let y = H * 0.12; y < H * 0.4; y += step) for (let x = W * 0.8; x < W * 0.97; x += step) { ctx.beginPath(); ctx.arc(x, y, 2.2 * unit, 0, TAU); ctx.fill(); }
      }
    },
  },

  image: {
    under(ctx, e) {
      const { W, H, p, spec, t } = e;
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      let img = e.assets?.image(spec.asset || spec.src);
      if (img && spec.blur) {
        // blur once into a cached copy instead of filtering every frame
        const key = `ib:${img.src}:${spec.blur}`;
        if (!tex[key]) {
          const c = makeCanvas(Math.round(img.width / 2), Math.round(img.height / 2));
          const g = c.getContext('2d');
          g.filter = `blur(${spec.blur / 2}px)`;
          g.drawImage(img, 0, 0, c.width, c.height);
          tex[key] = c;
        }
        img = tex[key];
      }
      if (img) {
        const s = Math.max(W / img.width, H / img.height) * (1.04 + 0.04 * Math.min(1, t / 12));
        ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
      }
      ctx.fillStyle = toCss(p.bg, spec.overlay ?? 0.55);
      ctx.fillRect(0, 0, W, H);
    },
  },
};

function star(ctx, x, y, R, r, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU - Math.PI / 2;
    const rr = i % 2 ? r : R;
    i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

export function backgroundSpec(env, scene) {
  const th = env.theme.background;
  if (scene && scene.background && scene.background !== 'auto') return { ...scene.background };
  return { ...th };
}

let smoothCanvas = null;
/** Smooth gradient fields are rendered at 1/4 resolution and upscaled (visually identical,
 *  ~16× cheaper); crisp details are drawn at full resolution on top. */
function drawSmooth(ctx, gen, e) {
  const sw = Math.max(64, Math.round(e.W / 4)), sh = Math.max(36, Math.round(e.H / 4));
  if (!smoothCanvas || smoothCanvas.width !== sw || smoothCanvas.height !== sh) smoothCanvas = makeCanvas(sw, sh);
  const g = smoothCanvas.getContext('2d');
  g.setTransform(sw / e.W, 0, 0, sh / e.H, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  gen.smooth(g, e);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(smoothCanvas, 0, 0, e.W, e.H);
  ctx.restore();
}

export function drawBackground(ctx, env, spec, p, t, pass = 'under', assets) {
  const gen = GEN[spec.type] || GEN.solid;
  const e = { W: env.W, H: env.H, p, spec, t, env, unit: env.unit, fps: env.doc.format.fps, assets };
  ctx.save();
  if (pass === 'under') {
    if (gen.smooth) drawSmooth(ctx, gen, e);
    if (gen.under) gen.under(ctx, e);
    if (gen.detail) gen.detail(ctx, e);
  } else if (gen[pass]) gen[pass](ctx, e);
  ctx.restore();
}

export const BACKGROUND_TYPES = Object.keys(GEN);
