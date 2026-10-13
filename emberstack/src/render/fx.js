// World-space effects: particles (sparks, smoke, ash, coins, petals), floating numbers, shock rings,
// projectile streaks and screen shake. Purely visual; driven by simulation events.

const MAX_PARTS = 1600;

export class FX {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.rings = [];
    this.beams = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '255,255,255';
  }

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
    this.rings.length = 0;
    this.beams.length = 0;
    this.shake = 0;
  }

  /** emit n particles. kind: spark | smoke | ash | coin | star | leaf | blood | water | ember | snow */
  burst(x, y, kind = 'spark', n = 12, o = {}) {
    for (let i = 0; i < n && this.parts.length < MAX_PARTS; i++) {
      const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread ?? 1) : Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 120) * (0.4 + Math.random() * 0.8);
      const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.7);
      this.parts.push({
        kind, x: x + (Math.random() - 0.5) * (o.jitter ?? 10), y: y + (Math.random() - 0.5) * (o.jitter ?? 10),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0), life, max: life,
        size: (o.size ?? 4) * (0.6 + Math.random() * 0.8), color: o.color || null, g: o.gravity ?? defaultGravity(kind),
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
      });
    }
  }

  text(x, y, str, color = '#fff2d0', size = 20, o = {}) {
    this.texts.push({ x, y, str, color, size, life: o.life ?? 1.2, max: o.life ?? 1.2, vy: o.vy ?? -38, bold: o.bold ?? true });
    if (this.texts.length > 80) this.texts.shift();
  }

  ring(x, y, r0, r1, color = 'rgba(255,220,140,1)', life = 0.6, w = 4) {
    this.rings.push({ x, y, r0, r1, color, life, max: life, w });
  }

  beam(x0, y0, x1, y1, color = '#f0e0c0', life = 0.25, kind = 'arrow') {
    this.beams.push({ x0, y0, x1, y1, color, life, max: life, kind });
  }

  kick(amount) { this.shake = Math.min(18, this.shake + amount); }
  flashScreen(color = '255,255,255', a = 0.5) { this.flash = a; this.flashColor = color; }

  update(dt) {
    const P = this.parts;
    let j = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.g * dt;
      const drag = p.kind === 'smoke' || p.kind === 'ash' || p.kind === 'snow' ? 1.6 : 0.6;
      p.vx *= 1 - drag * dt;
      p.vy *= 1 - drag * dt * 0.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      P[j++] = p;
    }
    P.length = j;
    this.texts = this.texts.filter((t) => (t.life -= dt) > 0 && ((t.y += t.vy * dt), (t.vy *= 1 - 1.5 * dt), true));
    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    this.beams = this.beams.filter((b) => (b.life -= dt) > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.8);
  }

  /** draw in world space (the board transform is already applied) */
  draw(g, zoom) {
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      g.beginPath();
      g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(t), 0, Math.PI * 2);
      g.strokeStyle = r.color.replace(/[\d.]+\)$/, (1 - t) * 0.9 + ')');
      g.lineWidth = r.w * (1 - t * 0.6);
      g.stroke();
    }
    for (const b of this.beams) {
      const t = 1 - b.life / b.max;
      const hx = b.x0 + (b.x1 - b.x0) * Math.min(1, t * 1.4), hy = b.y0 + (b.y1 - b.y0) * Math.min(1, t * 1.4);
      const tx = b.x0 + (b.x1 - b.x0) * Math.max(0, t * 1.4 - 0.35), ty = b.y0 + (b.y1 - b.y0) * Math.max(0, t * 1.4 - 0.35);
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(hx, hy);
      g.strokeStyle = b.color;
      g.lineWidth = b.kind === 'bolt' ? 5 : 2.5;
      g.lineCap = 'round';
      g.stroke();
    }
    for (const p of this.parts) drawPart(g, p);
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.max * 0.4));
      const s = t.size * (1 + Math.max(0, 0.25 - (t.max - t.life)) * 1.6) / Math.max(0.6, Math.min(1.4, zoom));
      g.globalAlpha = a;
      g.font = `${t.bold ? 'bold ' : ''}${s}px Georgia,"Noto Serif SC",serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = s * 0.18;
      g.strokeStyle = 'rgba(25,14,8,0.9)';
      g.strokeText(t.str, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.str, t.x, t.y);
      g.globalAlpha = 1;
    }
  }
}

function defaultGravity(kind) {
  switch (kind) {
    case 'smoke': return -40;
    case 'ash': return -12;
    case 'ember': return -60;
    case 'snow': return 20;
    case 'leaf': return 30;
    case 'star': return 0;
    default: return 260;
  }
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

function drawPart(g, p) {
  const t = p.life / p.max;
  switch (p.kind) {
    case 'smoke': {
      const s = p.size * (2.4 - t * 1.4);
      g.fillStyle = p.color || `rgba(70,64,60,${0.35 * t})`;
      if (p.color) g.globalAlpha = 0.4 * t;
      g.beginPath();
      g.arc(p.x, p.y, s, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      break;
    }
    case 'ash':
      g.fillStyle = `rgba(60,56,54,${0.8 * t})`;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      break;
    case 'coin':
      g.save();
      g.translate(p.x, p.y);
      g.scale(Math.cos(p.rot * 2), 1);
      g.fillStyle = '#e8b83a';
      g.beginPath();
      g.arc(0, 0, p.size, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#6a4210';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
      break;
    case 'star': {
      const s = p.size * (0.4 + t);
      g.fillStyle = p.color || `rgba(255,236,170,${t})`;
      g.globalAlpha = Math.min(1, t * 1.5);
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + p.rot, r = k % 2 ? s * 0.3 : s;
        g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
      break;
    }
    case 'leaf':
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color || '#7aa84a';
      g.globalAlpha = Math.min(1, t * 2);
      g.beginPath();
      g.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      break;
    case 'blood':
      g.fillStyle = p.color || `rgba(170,30,24,${t})`;
      g.beginPath();
      g.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
      g.fill();
      break;
    case 'water':
      g.fillStyle = `rgba(170,215,235,${0.8 * t})`;
      g.beginPath();
      g.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      g.fill();
      break;
    case 'snow':
      g.fillStyle = `rgba(250,252,255,${0.9 * t})`;
      g.beginPath();
      g.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      g.fill();
      break;
    default: {
      // spark / ember: a short glowing streak
      const c = p.color || (p.kind === 'ember' ? '255,150,60' : '255,214,120');
      g.strokeStyle = `rgba(${c},${t})`;
      g.lineWidth = p.size * 0.5 * (0.5 + t);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      g.stroke();
    }
  }
}
