// EXP-03 · Electrodynamics.
// Statics: point charges (drag them), field lines integrated from the positive charges, equipotential
// shading, and test particles drifting along E.
// Radiation: an oscillating dipole. In the meridian plane its electric field lines are the level sets of
// Hertz's stream function Ψ = sin²ϑ [cos(kr − ωt)/(kr) − sin(kr − ωt)] (k = 1), traced with marching squares.
import { Instrument, TAU, PAL, MONO } from './base.js';

export class Field extends Instrument {
  init() {
    this.get2d();
    this.mode = 'static';
    this.charges = [{ x: -0.32, y: 0, q: 1 }, { x: 0.32, y: 0, q: -1 }];
    this.particles = [];
    this.dirty = true;
    this.controls([
      { type: 'chips', value: 'static', items: [{ label: '静电场', value: 'static' }, { label: '偶极辐射', value: 'dipole' }], onChange: (v) => { this.mode = v; this.dirty = true; } },
      { type: 'button', label: '＋ 正电荷', onClick: () => this.add(1) },
      { type: 'button', label: '－ 负电荷', onClick: () => this.add(-1) },
      { type: 'button', label: '重置', onClick: () => { this.charges = [{ x: -0.32, y: 0, q: 1 }, { x: 0.32, y: 0, q: -1 }]; this.dirty = true; } },
    ]);
    let grab = null;
    this.pointer({
      down: (x, y) => {
        if (this.mode !== 'static') return false;
        const [u, v] = this.toWorld(x, y);
        grab = this.charges.find((c) => Math.hypot(c.x - u, c.y - v) < 0.07);
        return !!grab;
      },
      move: (x, y) => { const [u, v] = this.toWorld(x, y); grab.x = u; grab.y = v; this.dirty = true; },
      up: () => { grab = null; },
    });
  }
  add(q) {
    if (this.charges.length >= 6) this.charges.shift();
    this.charges.push({ x: (Math.random() - 0.5) * 0.8, y: (Math.random() - 0.5) * 0.5, q });
    this.dirty = true;
  }
  get S() { return Math.min(this.w, this.h * 1.45); }
  toWorld(x, y) { return [(x - this.w / 2) / this.S, (y - this.h / 2) / this.S]; }
  toScreen(u, v) { return [this.w / 2 + u * this.S, this.h / 2 + v * this.S]; }
  E(x, y) {
    let ex = 0, ey = 0, phi = 0;
    for (const c of this.charges) {
      const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy + 1e-5, r = Math.sqrt(r2);
      ex += (c.q * dx) / (r2 * r); ey += (c.q * dy) / (r2 * r); phi += c.q / r;
    }
    return [ex, ey, phi];
  }
  onResize() { this.dirty = true; }

  buildStatic() {
    // equipotential backdrop
    const gw = 120, gh = Math.max(40, Math.round((120 * this.h) / this.w));
    const img = new ImageData(gw, gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const [u, v] = this.toWorld(((i + 0.5) / gw) * this.w, ((j + 0.5) / gh) * this.h);
      const phi = this.E(u, v)[2];
      const band = Math.abs(((phi * 0.6) % 1 + 1) % 1 - 0.5) * 2;
      const s = Math.tanh(phi * 0.25);
      const k = (j * gw + i) * 4;
      const base = 14 + band * 10;
      img.data[k] = base + Math.max(0, s) * 70;
      img.data[k + 1] = base + 6;
      img.data[k + 2] = base + Math.max(0, -s) * 80 + 6;
      img.data[k + 3] = 255;
    }
    this.bg = document.createElement('canvas');
    this.bg.width = gw; this.bg.height = gh;
    this.bg.getContext('2d').putImageData(img, 0, 0);
    // field lines from positive charges (or from negative ones if there are none)
    const sources = this.charges.some((c) => c.q > 0) ? this.charges.filter((c) => c.q > 0) : this.charges;
    this.lines = [];
    for (const c of sources) {
      const n = 18;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + 0.1;
        let x = c.x + Math.cos(a) * 0.012, y = c.y + Math.sin(a) * 0.012;
        const pts = [[x, y]];
        const dir = c.q > 0 ? 1 : -1;
        for (let s = 0; s < 900; s++) {
          let [ex, ey] = this.E(x, y);
          let m = Math.hypot(ex, ey) || 1;
          const h = 0.004;
          const mx = x + dir * (ex / m) * h * 0.5, my = y + dir * (ey / m) * h * 0.5;
          [ex, ey] = this.E(mx, my);
          m = Math.hypot(ex, ey) || 1;
          x += dir * (ex / m) * h; y += dir * (ey / m) * h;
          pts.push([x, y]);
          if (Math.abs(x) > 1.2 || Math.abs(y) > 0.9) break;
          if (this.charges.some((d) => d.q * c.q < 0 && Math.hypot(d.x - x, d.y - y) < 0.01)) break;
        }
        this.lines.push(pts);
      }
    }
    this.particles = [];
  }

  drawStatic(dt) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bg, 0, 0, this.w, this.h);
    ctx.lineWidth = 1;
    for (const pts of this.lines) {
      ctx.strokeStyle = 'rgba(236,232,225,0.42)';
      ctx.beginPath();
      pts.forEach(([u, v], i) => { const [x, y] = this.toScreen(u, v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    // test particles flowing along the lines
    while (this.particles.length < 120 && this.lines.length) {
      const line = this.lines[(Math.random() * this.lines.length) | 0];
      this.particles.push({ line, i: Math.random() * line.length });
    }
    ctx.fillStyle = PAL.acid;
    for (const p of this.particles) {
      p.i += dt * 110;
      if (p.i >= p.line.length - 1) { p.i = 0; p.line = this.lines[(Math.random() * this.lines.length) | 0]; }
      const [u, v] = p.line[Math.floor(p.i)];
      const [x, y] = this.toScreen(u, v);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    for (const c of this.charges) {
      const [x, y] = this.toScreen(c.x, c.y);
      ctx.fillStyle = c.q > 0 ? PAL.signal : PAL.ion;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = `bold 14px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.q > 0 ? '+' : '−', x, y + 0.5);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2;
    ctx.fillText('拖动电荷 · 线 = 电场线 · 明暗 = 电势', 12, 18);
  }

  drawDipole(time) {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, w, h);
    const gw = 170, gh = Math.max(60, Math.round((gw * h) / w));
    const span = 22; // half-width in units of 1/k
    const sc = span / (w / 2);
    const om = time * 1.6;
    const val = new Float32Array((gw + 1) * (gh + 1));
    for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) {
      const x = (i / gw - 0.5) * w * sc, y = (j / gh - 0.5) * h * sc;
      const r = Math.hypot(x, y) + 1e-6;
      const s2 = (x * x) / (r * r); // sin²ϑ with ϑ measured from the vertical dipole axis
      val[j * (gw + 1) + i] = r < 0.9 ? NaN : s2 * (Math.cos(r - om) / r - Math.sin(r - om));
    }
    const cellW = w / gw, cellH = h / gh;
    const levels = [-0.9, -0.6, -0.3, -0.1, 0.1, 0.3, 0.6, 0.9];
    ctx.lineWidth = 1.3;
    for (const L of levels) {
      ctx.strokeStyle = L > 0 ? 'rgba(255,91,31,0.85)' : 'rgba(79,227,255,0.85)';
      ctx.beginPath();
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const a = val[j * (gw + 1) + i], b = val[j * (gw + 1) + i + 1], c = val[(j + 1) * (gw + 1) + i + 1], d = val[(j + 1) * (gw + 1) + i];
        if (!(a === a && b === b && c === c && d === d)) continue;
        const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x0 = i * cellW, y0 = j * cellH;
        const ip = (p, q) => (L - p) / (q - p);
        const top = [x0 + ip(a, b) * cellW, y0], right = [x0 + cellW, y0 + ip(b, c) * cellH];
        const bottom = [x0 + ip(d, c) * cellW, y0 + cellH], left = [x0, y0 + ip(a, d) * cellH];
        const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (idx) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 10: seg(top, right); seg(left, bottom); break;
        }
      }
      ctx.stroke();
    }
    // the dipole itself
    const cx = w / 2, cy = h / 2, a = Math.cos(om) * 10;
    ctx.strokeStyle = PAL.ink3; ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14); ctx.stroke();
    ctx.fillStyle = a > 0 ? PAL.signal : PAL.ion; ctx.beginPath(); ctx.arc(cx, cy - Math.abs(a) - 2, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = a > 0 ? PAL.ion : PAL.signal; ctx.beginPath(); ctx.arc(cx, cy + Math.abs(a) + 2, 4, 0, TAU); ctx.fill();
    ctx.font = `11px ${MONO}`; ctx.fillStyle = PAL.ink2;
    ctx.fillText('振荡偶极子 · 子午面内的电场线 · 一个格 = 1/k', 12, 18);
    ctx.fillStyle = PAL.ink3;
    ctx.fillText(`λ = 2π/k ≈ ${(TAU / sc).toFixed(0)} px`, 12, h - 12);
  }

  frame(dt, time) {
    if (this.mode === 'static') {
      if (this.dirty) { this.dirty = false; this.buildStatic(); }
      this.drawStatic(dt);
    } else this.drawDipole(time);
  }
}
