// Ambient background: a slow constellation of nodes and faint links over a deep-space gradient.
export function startBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, nodes = [];
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.width = Math.floor(innerWidth * dpr);
    h = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    const n = Math.round((innerWidth * innerHeight) / 26000);
    nodes = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.12 * dpr, vy: (Math.random() - 0.5) * 0.12 * dpr,
      r: (Math.random() * 1.3 + 0.4) * dpr, hue: Math.random() < 0.5 ? 190 : 260,
    }));
  };
  resize();
  addEventListener('resize', resize);
  let last = 0;
  const frame = (t) => {
    requestAnimationFrame(frame);
    if (document.hidden || t - last < 50) return;
    last = t;
    const g = ctx.createRadialGradient(w * 0.3, h * 0.15, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    g.addColorStop(0, '#0b1430');
    g.addColorStop(0.55, '#060a16');
    g.addColorStop(1, '#03050b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // faint grid
    ctx.strokeStyle = 'rgba(90,140,255,0.035)';
    ctx.lineWidth = 1;
    const step = 64 * dpr;
    ctx.beginPath();
    for (let x = 0; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    const maxD = 140 * dpr;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (!reduce) { a.x += a.vx; a.y += a.vy; }
      if (a.x < 0 || a.x > w) a.vx *= -1;
      if (a.y < 0 || a.y > h) a.vy *= -1;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = dx * dx + dy * dy;
        if (d < maxD * maxD) {
          ctx.strokeStyle = `rgba(110,180,255,${0.08 * (1 - Math.sqrt(d) / maxD)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.fillStyle = `hsla(${a.hue},90%,75%,0.55)`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }
  };
  requestAnimationFrame(frame);
}
