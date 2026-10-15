// Standalone player/presenter used by HTML export. Play mode runs the timeline; presentation
// mode plays each scene's entrance then holds until click / → / space.
(async function () {
  const doc = window.MOTIF_DOC;
  const canvas = document.getElementById('c');
  const $ = (id) => document.getElementById(id);
  const engine = new Motif.MotifEngine({ resolveUrl: (a) => a.file || a.src, onInvalidate: () => draw() });
  await engine.setDocument(doc);
  $('loading').remove();
  const C = engine.C;
  const W = C.env.W, H = C.env.H;
  let t = 0, playing = false, last = 0, present = false, holdAt = null;
  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.round(W * s) + 'px';
    canvas.style.height = Math.round(H * s) + 'px';
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
    draw();
  }
  function draw() { engine.render(t, canvas.getContext('2d'), { scale: canvas.width / W }); ui(); }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function ui() { $('fill').style.width = `${(t / engine.duration) * 100}%`; $('time').textContent = `${fmt(t)} / ${fmt(engine.duration)}`; $('play').textContent = playing ? '❚❚' : '▶'; $('mode').style.background = present ? 'rgba(255,255,255,.35)' : ''; }
  const ticks = $('track');
  C.scenes.forEach((s) => { const d = document.createElement('div'); d.className = 'tick'; d.style.left = `${(s.start / engine.duration) * 100}%`; ticks.appendChild(d); });
  const music = doc.audio?.music?.asset && doc.assets[doc.audio.music.asset] ? new Audio(doc.assets[doc.audio.music.asset].file) : null;
  if (music) music.volume = doc.audio.music.volume ?? 0.7;
  function syncAudio() { if (!music) return; if (playing && !present) { if (Math.abs(music.currentTime - t) > 0.25) music.currentTime = t; music.play().catch(() => {}); } else music.pause(); }
  function sceneHold(time) {
    const S = engine.sceneAt(time + 0.001);
    return S ? S.start + Math.max(S.contentEnd + 0.2, 0.5) : engine.duration;
  }
  function loop(now) {
    if (playing) {
      const dt = Math.min(0.1, (now - last) / 1000);
      t += dt;
      if (present && holdAt != null && t >= holdAt) { t = holdAt; playing = false; }
      if (t >= engine.duration) { t = engine.duration; playing = false; }
      engine.prepareFrame(t);
      draw();
      syncAudio();
    }
    last = now;
    requestAnimationFrame(loop);
  }
  function toggle() { if (t >= engine.duration - 0.01) t = 0; playing = !playing; if (present && playing) holdAt = sceneHold(t); last = performance.now(); syncAudio(); ui(); }
  function next() {
    const idx = C.scenes.findIndex((s) => t < s.end - 0.01 && t >= s.start - 0.01);
    if (playing) { t = holdAt ?? t; playing = false; draw(); return; }
    const S = C.scenes[idx + 1];
    if (!S) return;
    t = Math.max(t, S.start - (S.transitionIn?.duration || 0) + 0.001);
    holdAt = S.start + Math.max(S.contentEnd + 0.2, 0.5);
    playing = true; last = performance.now();
  }
  function prev() { const S = engine.sceneAt(t); const i = C.scenes.indexOf(S); const P = C.scenes[Math.max(0, i - 1)]; t = P.start + Math.max(P.contentEnd + 0.2, 0.5); playing = false; draw(); }
  $('play').onclick = toggle;
  $('mode').onclick = () => { present = !present; if (present) { playing = false; holdAt = sceneHold(t); } ui(); };
  $('fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  $('track').onclick = (e) => { const r = $('track').getBoundingClientRect(); t = ((e.clientX - r.left) / r.width) * engine.duration; engine.prepareFrame(t).then(draw); syncAudio(); };
  canvas.onclick = () => (present ? next() : toggle());
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); present ? next() : toggle(); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
    else if (e.key === 'f' || e.key === 'F') $('fs').click();
    else if (e.key === 'p' || e.key === 'P') $('mode').click();
  });
  window.addEventListener('resize', fit);
  fit();
  requestAnimationFrame(loop);
  if (new URLSearchParams(location.search).has('present')) $('mode').click();
})();
