// Procedural heraldry: a nation's flag pattern, colours and emblem drawn onto a canvas.

const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

export function drawFlag(ctx, f, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const c1 = rgb(f.c1), c2 = rgb(f.c2), c3 = rgb(f.c3);
  ctx.fillStyle = c1;
  ctx.fillRect(x, y, w, h);
  switch (f.pattern) {
    case 'bicolorH': ctx.fillStyle = c2; ctx.fillRect(x, y + h / 2, w, h / 2); break;
    case 'bicolorV': ctx.fillStyle = c2; ctx.fillRect(x + w / 2, y, w / 2, h); break;
    case 'tricolorH': ctx.fillStyle = c2; ctx.fillRect(x, y + h / 3, w, h / 3); ctx.fillStyle = c3; ctx.fillRect(x, y + (2 * h) / 3, w, h / 3); break;
    case 'tricolorV': ctx.fillStyle = c2; ctx.fillRect(x + w / 3, y, w / 3, h); ctx.fillStyle = c3; ctx.fillRect(x + (2 * w) / 3, y, w / 3, h); break;
    case 'cross': ctx.fillStyle = c2; ctx.fillRect(x + w * 0.3, y, w * 0.14, h); ctx.fillRect(x, y + h * 0.43, w, h * 0.14); break;
    case 'saltire': ctx.strokeStyle = c2; ctx.lineWidth = h * 0.16; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke(); break;
    case 'border': ctx.strokeStyle = c2; ctx.lineWidth = h * 0.18; ctx.strokeRect(x, y, w, h); break;
    case 'diagonal': ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.fill(); break;
    case 'quarter': ctx.fillStyle = c2; ctx.fillRect(x + w / 2, y, w / 2, h / 2); ctx.fillRect(x, y + h / 2, w / 2, h / 2); break;
    case 'chevron': ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.45, y + h / 2); ctx.lineTo(x, y + h); ctx.fill(); break;
    case 'canton': ctx.fillStyle = c2; ctx.fillRect(x, y, w * 0.45, h * 0.5); break;
    default:
  }
  // emblem
  const ex = f.pattern === 'canton' ? x + w * 0.225 : f.pattern === 'chevron' ? x + w * 0.18 : x + w / 2;
  const ey = f.pattern === 'canton' ? y + h * 0.25 : y + h / 2;
  const r = h * (f.pattern === 'canton' ? 0.17 : 0.26);
  ctx.fillStyle = rgb(f.ec || f.c2);
  ctx.strokeStyle = rgb(f.ec || f.c2);
  ctx.lineWidth = Math.max(1, h * 0.06);
  switch (f.emblem) {
    case 'sun':
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.55, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * r * 0.7, ey + Math.sin(a) * r * 0.7); ctx.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r); ctx.stroke(); }
      break;
    case 'star':
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k / 10) * Math.PI * 2; const rr = k % 2 ? r * 0.42 : r; ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); break;
    case 'moon':
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgb(f.c1); ctx.beginPath(); ctx.arc(ex + r * 0.35, ey - r * 0.1, r * 0.7, 0, Math.PI * 2); ctx.fill(); break;
    case 'circle': ctx.beginPath(); ctx.arc(ex, ey, r * 0.7, 0, Math.PI * 2); ctx.fill(); break;
    case 'diamond': ctx.beginPath(); ctx.moveTo(ex, ey - r); ctx.lineTo(ex + r * 0.7, ey); ctx.lineTo(ex, ey + r); ctx.lineTo(ex - r * 0.7, ey); ctx.fill(); break;
    case 'tree':
      ctx.fillRect(ex - r * 0.08, ey, r * 0.16, r * 0.9);
      ctx.beginPath(); ctx.moveTo(ex - r * 0.8, ey + r * 0.2); ctx.lineTo(ex, ey - r); ctx.lineTo(ex + r * 0.8, ey + r * 0.2); ctx.fill(); break;
    case 'eye':
      ctx.beginPath(); ctx.ellipse(ex, ey, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.28, 0, Math.PI * 2); ctx.fill(); break;
    case 'crown':
      ctx.beginPath(); ctx.moveTo(ex - r, ey + r * 0.5); ctx.lineTo(ex - r, ey - r * 0.4); ctx.lineTo(ex - r * 0.5, ey + r * 0.05); ctx.lineTo(ex, ey - r * 0.7); ctx.lineTo(ex + r * 0.5, ey + r * 0.05); ctx.lineTo(ex + r, ey - r * 0.4); ctx.lineTo(ex + r, ey + r * 0.5); ctx.closePath(); ctx.fill(); break;
    case 'wave':
      ctx.beginPath(); for (let k = 0; k <= 12; k++) { const px = ex - r + (k / 12) * 2 * r; ctx.lineTo(px, ey + Math.sin(k * 1.2) * r * 0.25); } ctx.stroke();
      ctx.beginPath(); for (let k = 0; k <= 12; k++) { const px = ex - r + (k / 12) * 2 * r; ctx.lineTo(px, ey + r * 0.5 + Math.sin(k * 1.2) * r * 0.25); } ctx.stroke(); break;
    case 'mountain': ctx.beginPath(); ctx.moveTo(ex - r, ey + r * 0.6); ctx.lineTo(ex - r * 0.2, ey - r * 0.7); ctx.lineTo(ex + r * 0.2, ey - r * 0.1); ctx.lineTo(ex + r * 0.5, ey - r * 0.4); ctx.lineTo(ex + r, ey + r * 0.6); ctx.fill(); break;
    case 'beast':
      ctx.beginPath(); ctx.ellipse(ex, ey + r * 0.1, r * 0.75, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + r * 0.7, ey - r * 0.25, r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(ex - r * 0.6, ey + r * 0.2, r * 0.14, r * 0.55); ctx.fillRect(ex + r * 0.4, ey + r * 0.2, r * 0.14, r * 0.55); break;
    case 'flame':
      ctx.beginPath(); ctx.moveTo(ex, ey - r); ctx.quadraticCurveTo(ex + r * 0.9, ey, ex, ey + r * 0.9); ctx.quadraticCurveTo(ex - r * 0.9, ey, ex, ey - r); ctx.fill(); break;
    case 'tower':
      ctx.fillRect(ex - r * 0.35, ey - r * 0.6, r * 0.7, r * 1.4);
      for (let k = 0; k < 3; k++) ctx.fillRect(ex - r * 0.45 + k * r * 0.35, ey - r * 0.85, r * 0.2, r * 0.3); break;
    default:
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** a small canvas element with the flag */
export function flagCanvas(f, w = 30, h = 20) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr; c.height = h * dpr;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  c.className = 'flag-c';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawFlag(ctx, f, 0, 0, w, h);
  return c;
}
