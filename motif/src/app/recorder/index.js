// Recorder windows. #bar: the floating control bar that captures the screen, microphone, system
// sound and webcam with MediaRecorder and streams the chunks to the main process. #area: a
// transparent full-screen overlay to drag the rectangle to record.
import './recorder.css';

const M = window.motif;
const root = document.getElementById('root');
const ICON = {
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
};

if (location.hash === '#area') area();
else bar();

// ───────────────────────────── control bar ─────────────────────────────
async function bar() {
  const sess = await M.call('recorder.session');
  if (!sess) { window.close(); return; }
  const o = sess.opts;
  root.innerHTML = `<div class="bar"><span class="dot"></span><span class="time">00:00</span><span class="state">准备中…</span><span class="meter" title="麦克风音量"><i></i></span>
    <button class="b pause" title="暂停 / 继续（${sess.shortcuts.pause.replace('CommandOrControl', 'Ctrl')}）">${ICON.pause}</button>
    <button class="b stop" title="结束录制（${sess.shortcuts.stop.replace('CommandOrControl', 'Ctrl')}）">${ICON.stop}</button>
    <button class="b trash" title="放弃这次录制">${ICON.trash}</button></div>`;
  const $ = (s) => root.querySelector(s);
  const el = $('.bar');
  const setState = (s) => { $('.state').textContent = s; };
  const fail = async (msg) => { setState(msg); await M.call('recorder.fail', msg); };

  let display, mic, cam;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: o.fps, max: o.fps }, width: { ideal: 7680 }, height: { ideal: 4320 }, cursor: o.cursor === 'hide' ? 'never' : 'always' },
      audio: !!o.system && sess.platform === 'win32',
    });
  } catch (e) { return fail(`无法录制屏幕：${e.message}`); }
  try { if (o.mic) mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: o.mic === 'default' ? undefined : { exact: o.mic }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { setState(`麦克风不可用：${e.message}`); }
  try { if (o.camera) cam = await navigator.mediaDevices.getUserMedia({ video: { deviceId: o.camera === 'default' ? undefined : { exact: o.camera }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } }); }
  catch (e) { setState(`摄像头不可用：${e.message}`); }

  const vt = display.getVideoTracks()[0];
  const vs = vt.getSettings();
  // Whether the system cursor is baked into the picture (Chromium may not honour cursor: never).
  const cursorInVideo = vs.cursor ? vs.cursor !== 'never' : true;
  vt.addEventListener('ended', () => stop()); // window closed / screen unplugged

  if (mic) meter(mic, $('.meter i')); else $('.meter').style.display = 'none';

  const pick = (list) => list.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  const vmime = pick(['video/webm;codecs=h264', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']);
  const amime = pick(['audio/webm;codecs=opus', 'audio/webm']);
  const px = (vs.width || 1920) * (vs.height || 1080);
  const recs = [];
  const make = (kind, stream, opts) => {
    const r = new MediaRecorder(stream, opts);
    let chain = Promise.resolve();
    r.ondataavailable = (e) => { if (e.data && e.data.size) chain = chain.then(() => e.data.arrayBuffer()).then((b) => M.call('recorder.chunk', kind, b)).catch((err) => console.error(err)); };
    r.onstart = () => M.call('recorder.started', kind, Date.now());
    r.flushed = () => chain;
    r.kind = kind;
    recs.push(r);
    return r;
  };
  make('screen', new MediaStream([vt]), { mimeType: vmime, videoBitsPerSecond: Math.round(Math.min(60e6, Math.max(6e6, px * (o.fps || 30) * 0.2))) });
  const sysTrack = display.getAudioTracks()[0];
  if (sysTrack) make('system', new MediaStream([sysTrack]), { mimeType: amime, audioBitsPerSecond: 192000 });
  if (mic) make('mic', mic, { mimeType: amime, audioBitsPerSecond: 160000 });
  if (cam) make('camera', cam, { mimeType: vmime, videoBitsPerSecond: 4e6 });

  // countdown
  const n = Math.max(0, Math.min(10, Number(o.countdown ?? 3)));
  if (n) {
    const c = document.createElement('div');
    c.className = 'count';
    el.appendChild(c);
    for (let i = n; i > 0; i--) { c.innerHTML = `${i}<small>即将开始录制</small>`; await new Promise((r) => setTimeout(r, 1000)); }
    c.remove();
  }

  let active = 0, since = 0, paused = false, stopping = false;
  for (const r of recs) r.start(1000);
  since = performance.now();
  el.classList.add('recording');
  setState(sess.source.name ? `正在录制 · ${sess.source.name}` : '正在录制');
  const clock = setInterval(() => {
    const s = (active + (paused ? 0 : performance.now() - since)) / 1000;
    $('.time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }, 250);

  const togglePause = async () => {
    if (stopping) return;
    if (!paused) {
      for (const r of recs) if (r.state === 'recording') r.pause();
      active += performance.now() - since; paused = true;
      el.classList.replace('recording', 'paused'); $('.pause').innerHTML = ICON.play; setState('已暂停');
      await M.call('recorder.pause');
    } else {
      for (const r of recs) if (r.state === 'paused') r.resume();
      since = performance.now(); paused = false;
      el.classList.replace('paused', 'recording'); $('.pause').innerHTML = ICON.pause; setState('正在录制');
      await M.call('recorder.resume');
    }
  };
  async function stop() {
    if (stopping) return;
    stopping = true;
    if (!paused) active += performance.now() - since;
    clearInterval(clock);
    setState('正在保存…');
    await Promise.all(recs.map((r) => new Promise((res) => { if (r.state === 'inactive') return res(); r.addEventListener('stop', res, { once: true }); r.stop(); })));
    await Promise.all(recs.map((r) => r.flushed()));
    for (const s of [display, mic, cam]) s?.getTracks().forEach((t) => t.stop());
    await M.call('recorder.finish', { cursorInVideo, fps: Math.round(vs.frameRate || o.fps || 30), width: vs.width, height: vs.height, duration: active / 1000 }).catch(() => {});
  }
  $('.pause').onclick = togglePause;
  $('.stop').onclick = stop;
  $('.trash').onclick = async () => { stopping = true; for (const r of recs) { try { r.stop(); } catch { /* ignore */ } } for (const s of [display, mic, cam]) s?.getTracks().forEach((t) => t.stop()); await M.call('recorder.cancel'); };
  M.on('recorder-bar', (m) => { if (m.type === 'stop') stop(); if (m.type === 'toggle-pause') togglePause(); });
}

function meter(stream, bar) {
  try {
    const ac = new AudioContext();
    const an = ac.createAnalyser();
    an.fftSize = 512;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      bar.style.width = `${Math.min(100, Math.round(Math.sqrt(peak) * 100))}%`;
      requestAnimationFrame(tick);
    };
    tick();
  } catch { /* no audio context */ }
}

// ───────────────────────────── area picker ─────────────────────────────
function area() {
  root.innerHTML = '<div class="area"><canvas></canvas><div class="hint">拖动选择要录制的区域 · Enter 确认 · Esc 取消</div></div>';
  const wrap = root.querySelector('.area');
  const cv = wrap.querySelector('canvas');
  const g = cv.getContext('2d');
  let r = null, drag = null, label = null, confirm = null;
  const dpr = devicePixelRatio || 1;
  const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; draw(); };
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.fillStyle = 'rgba(8, 10, 16, 0.45)';
    g.fillRect(0, 0, innerWidth, innerHeight);
    if (!r) return;
    g.clearRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#7c8cff'; g.lineWidth = 2; g.setLineDash([]);
    g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    g.fillStyle = '#7c8cff';
    for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) g.fillRect(x - 4, y - 4, 8, 8);
    if (!label) { label = document.createElement('div'); label.className = 'size'; wrap.appendChild(label); }
    label.textContent = `${Math.round(r.w * dpr)} × ${Math.round(r.h * dpr)}`;
    label.style.left = `${r.x}px`; label.style.top = `${Math.max(4, r.y - 28)}px`;
  }
  const finish = (ok) => M.call('recorder.areaDone', ok && r ? r : null);
  wrap.addEventListener('mousedown', (e) => {
    if (e.target.closest('.confirm')) return;
    confirm?.remove(); confirm = null;
    drag = { x: e.clientX, y: e.clientY };
    r = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
    draw();
  });
  addEventListener('mousemove', (e) => {
    if (!drag) return;
    r = { x: Math.min(drag.x, e.clientX), y: Math.min(drag.y, e.clientY), w: Math.abs(e.clientX - drag.x), h: Math.abs(e.clientY - drag.y) };
    draw();
  });
  addEventListener('mouseup', () => {
    if (!drag) return;
    drag = null;
    if (!r || r.w < 16 || r.h < 16) { r = null; label?.remove(); label = null; draw(); return; }
    confirm = document.createElement('div');
    confirm.className = 'confirm';
    confirm.innerHTML = '<button class="redo">重选</button><button class="go">录制此区域</button>';
    confirm.style.left = `${Math.min(innerWidth - 220, r.x + r.w - 200)}px`;
    confirm.style.top = `${Math.min(innerHeight - 44, r.y + r.h + 10)}px`;
    confirm.querySelector('.go').onclick = () => finish(true);
    confirm.querySelector('.redo').onclick = () => { r = null; confirm.remove(); confirm = null; label?.remove(); label = null; draw(); };
    wrap.appendChild(confirm);
  });
  wrap.addEventListener('dblclick', () => { if (r) finish(true); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(false); if (e.key === 'Enter' && r) finish(true); });
  addEventListener('resize', size);
  size();
}
