// Pointer, wheel, touch and keyboard input on the sky canvas, routed to the active view.

export function bindInput(app, canvas) {
  const pointers = new Map();
  let down = null;      // { x, y, t, node, moved, mode }
  let pinch = null;
  let lastTap = { t: 0, i: -1, x: 0, y: 0 };
  let velo = [];

  const view = () => (app.mode === 'explore' ? app.explorer : app.universe);
  const pickAt = (x, y) => {
    if (app.mode === 'explore') return app.explorer.pick(x, y);
    const i = app.universe.pick(x, y);
    return i >= 0 ? { node: i } : null;
  };
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    pointers.set(e.pointerId, { x, y });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      down = null;
      return;
    }
    const hit = pickAt(x, y);
    down = { x, y, t: performance.now(), hit, moved: false, lx: x, ly: y };
    velo = [];
    view().cam.stop();
    app.tooltip.hide();
  });

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x, y });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const cam = view().cam;
      const [wx, wy] = cam.toWorld(pinch.cx, pinch.cy);
      cam.k = Math.min(cam.maxK, Math.max(cam.minK, cam.k * (d / pinch.d)));
      cam.x = wx - (cx - cam.w / 2) / cam.k;
      cam.y = wy - (cy - cam.h / 2) / cam.k;
      pinch = { d, cx, cy };
      return;
    }
    if (down) {
      const dx = x - down.lx, dy = y - down.ly;
      if (!down.moved && Math.hypot(x - down.x, y - down.y) > 5) down.moved = true;
      if (down.moved) {
        if (down.hit && down.hit.node != null) {
          // drag a star
          const [wx, wy] = view().cam.toWorld(x, y);
          view().drag(down.hit.node, wx, wy);
        } else {
          view().cam.panBy(dx, dy);
          velo.push([performance.now(), dx, dy]);
          if (velo.length > 6) velo.shift();
          canvas.classList.add('grabbing');
        }
      }
      down.lx = x; down.ly = y;
      return;
    }
    // hover
    if (e.pointerType === 'mouse') {
      const hit = pickAt(x, y);
      const v = view();
      if (app.mode === 'explore') v.hoverMoon = hit && hit.moon ? hit.moon : null;
      const i = hit && hit.node != null ? hit.node : -1;
      v.hover = i;
      canvas.classList.toggle('pointer', !!hit);
      if (i >= 0) app.tooltip.show(app, i, e.clientX, e.clientY); else app.tooltip.hide();
    }
  });

  const end = (e) => {
    const [x, y] = local(e);
    pointers.delete(e.pointerId);
    canvas.classList.remove('grabbing');
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (!down) return;
    const d = down;
    down = null;
    if (d.moved) {
      if (d.hit && d.hit.node != null) { view().release(); return; }
      // fling
      const now = performance.now();
      const recent = velo.filter((v) => now - v[0] < 90);
      if (recent.length >= 2) {
        const dt = Math.max(16, now - recent[0][0]);
        const vx = recent.reduce((a, v) => a + v[1], 0) / dt, vy = recent.reduce((a, v) => a + v[2], 0) / dt;
        if (Math.hypot(vx, vy) > 0.15) view().cam.fling(vx, vy);
      }
      return;
    }
    // click / tap
    const now = performance.now();
    const hit = d.hit;
    const isDouble = now - lastTap.t < 340 && Math.hypot(x - lastTap.x, y - lastTap.y) < 24;
    if (hit && hit.moon) { app.card.openSection(hit.moon === 'anim' ? 'anim' : hit.moon); return; }
    if (hit && hit.node != null) {
      if (isDouble && lastTap.i === hit.node) {
        if (app.mode === 'map') app.setMode('explore', hit.node);
        else { app.explorer.expand(hit.node); }
        lastTap = { t: 0, i: -1, x, y };
        return;
      }
      app.onStarClick(hit.node);
    } else {
      if (isDouble) { view().cam.zoomAt(x, y, 2); lastTap = { t: 0, i: -1, x, y }; return; }
      if (app.mode === 'map' && !app.tour.active()) app.deselect();
    }
    lastTap = { t: now, i: hit && hit.node != null ? hit.node : -1, x, y };
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinch = null; if (down?.hit?.node != null) view().release(); down = null; });
  canvas.addEventListener('pointerleave', () => { if (!down) { view().hover = -1; app.tooltip.hide(); } });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [x, y] = local(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    view().cam.zoomAt(x, y, Math.exp(-delta * (e.ctrlKey ? 0.012 : 0.0016)));
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); app.topbar.focus(); return; }
    if (typing) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const cam = view().cam;
    switch (e.key) {
      case 'Escape':
        if (app.help.isOpen()) app.help.close();
        else if (app.tour.active()) app.tour.stop();
        else if (app.card.isOpen()) app.deselect();
        else if (app.drawer.isOpen()) app.drawer.close();
        else if (app.mode === 'explore') app.setMode('map');
        else app.clearPath();
        break;
      case 'e': case 'E': app.setMode(app.mode === 'explore' ? 'map' : 'explore'); break;
      case '0': app.fit(); break;
      case 'r': case 'R': app.randomStar(); break;
      case '+': case '=': cam.zoomAt(cam.w / 2, cam.h / 2, 1.5); break;
      case '-': case '_': cam.zoomAt(cam.w / 2, cam.h / 2, 1 / 1.5); break;
      case 'ArrowLeft': cam.panBy(120, 0); break;
      case 'ArrowRight': cam.panBy(-120, 0); break;
      case 'ArrowUp': cam.panBy(0, 120); break;
      case 'ArrowDown': cam.panBy(0, -120); break;
      case '?': app.help.open(); break;
      case 'f': case 'F': if (app.sel >= 0) { const on = app.store.toggleFav(app.graph.nodes[app.sel].id); app.toast(on ? '已加入收藏' : '已取消收藏'); } break;
      case 'm': case 'M': if (app.sel >= 0) { app.store.setStatus(app.graph.nodes[app.sel].id, 2); app.toast(`已点亮「${app.graph.nodes[app.sel].t}」`); } break;
      case 'l': case 'L': if (app.sel >= 0) app.store.setStatus(app.graph.nodes[app.sel].id, 1); break;
      default: return;
    }
    e.preventDefault();
  });
}
