// Presentation mode: full screen, plays each scene's build and waits at its settled frame for the
// presenter (→ / Space / click), or runs continuously like a video.
import { useEffect, useRef, useState } from 'react';
import { editor } from './store.js';
import { Icon } from '../icons.jsx';
import { call } from '../api.js';

export function Present({ onClose, startScene }) {
  const ref = useRef(null);
  const [mode, setMode] = useState('step'); // step | auto
  const [cursor, setCursor] = useState(true);
  const [notes, setNotes] = useState(false);
  const st = useRef({ t: 0, target: null, idx: 0 });
  const [, force] = useState(0);
  const scenes = editor.s.timing.scenes;
  const D = editor.s.timing.duration;

  useEffect(() => {
    call('window.fullscreen', true).catch(() => {});
    editor.pause();
    const i0 = Math.max(0, scenes.findIndex((s) => s.id === startScene));
    st.current = { t: scenes[i0]?.start || 0, idx: i0, target: scenes[i0]?.settled ?? D };
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const s = st.current;
      if (s.target == null || s.t < s.target) s.t = Math.min(s.target ?? D, s.t + dt);
      const c = ref.current;
      if (c) {
        const W = editor.engine.C.env.W, H = editor.engine.C.env.H;
        const k = Math.min(innerWidth / W, innerHeight / H);
        const dpr = Math.min(2, devicePixelRatio || 1);
        const cw = Math.round(W * k * dpr), ch = Math.round(H * k * dpr);
        if (c.width !== cw) { c.width = cw; c.height = ch; c.style.width = `${W * k}px`; c.style.height = `${H * k}px`; }
        editor.engine.render(s.t, c.getContext('2d'), { scale: cw / W, live: true, playing: true });
      }
      const idx = Math.max(0, scenes.findIndex((x) => s.t >= x.start && s.t < x.end));
      if (idx !== s.idx) { s.idx = idx; force((n) => n + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); call('window.fullscreen', false).catch(() => {}); };
  }, []);

  useEffect(() => { st.current.target = mode === 'auto' ? D : scenes[st.current.idx]?.settled ?? D; }, [mode]);

  const next = () => {
    const s = st.current;
    if (mode === 'auto') return;
    if (s.t < (s.target ?? D) - 0.02) { s.t = s.target; return; } // finish the current build first
    const n = scenes[s.idx + 1];
    if (!n) return;
    s.target = n.settled;
  };
  const prev = () => {
    const s = st.current;
    const p = scenes[Math.max(0, s.idx - 1)];
    s.t = p.settled; s.target = p.settled; s.idx = scenes.indexOf(p); force((x) => x + 1);
  };

  useEffect(() => {
    let timer;
    const mv = () => { setCursor(true); clearTimeout(timer); timer = setTimeout(() => setCursor(false), 1800); };
    const key = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') onClose();
      else if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) next();
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) prev();
      else if (e.key === 'Home') { st.current.t = 0; st.current.idx = 0; st.current.target = mode === 'auto' ? D : scenes[0]?.settled; }
      else if (e.key.toLowerCase() === 'n') setNotes((v) => !v);
      else if (e.key.toLowerCase() === 'a') setMode((m) => (m === 'auto' ? 'step' : 'auto'));
    };
    addEventListener('mousemove', mv);
    addEventListener('keydown', key, true);
    mv();
    return () => { removeEventListener('mousemove', mv); removeEventListener('keydown', key, true); clearTimeout(timer); };
  }, [mode]);

  const s = st.current;
  const scene = editor.s.doc.scenes.find((x) => x.id === scenes[s.idx]?.id);
  return (
    <div className={`present ${cursor ? 'cursor' : ''}`} onClick={next} onContextMenu={(e) => { e.preventDefault(); prev(); }}>
      <canvas ref={ref} />
      {notes && scene?.notes ? <div className="notes">{scene.notes}</div> : null}
      <div className="hud" onClick={(e) => e.stopPropagation()}>
        <button className="ibtn" style={{ color: '#fff' }} onClick={prev} title="上一页 ←"><Icon name="chevron-left" /></button>
        <button className="ibtn" style={{ color: '#fff' }} onClick={next} title="下一页 →"><Icon name="chevron-right" /></button>
        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 54 }}>{s.idx + 1} / {scenes.length}</span>
        <div className="bar"><div style={{ width: `${(s.t / Math.max(0.1, D)) * 100}%` }} /></div>
        <button className={`btn sm ${mode === 'auto' ? 'primary' : ''}`} onClick={() => setMode((m) => (m === 'auto' ? 'step' : 'auto'))} title="A">{mode === 'auto' ? '连续播放' : '逐页演示'}</button>
        <button className={`ibtn ${notes ? 'on' : ''}`} style={{ color: '#fff' }} onClick={() => setNotes((v) => !v)} title="备注 N"><Icon name="captions" /></button>
        <button className="ibtn" style={{ color: '#fff' }} onClick={onClose} title="退出 Esc"><Icon name="x" /></button>
      </div>
    </div>
  );
}
