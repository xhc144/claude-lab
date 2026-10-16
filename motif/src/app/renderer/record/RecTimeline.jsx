// Timeline of the recording editor. Output time runs left to right: the picture track shows the
// clips (cuts and speed) with thumbnails, the zoom track the camera segments, then the clicks and
// the audio tracks. Zooms, clicks and audio live in source time and are mapped through the clips.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { editor, useEditor } from '../editor/store.js';
import { Icon } from '../icons.jsx';
import { openMenu } from '../ui.jsx';
import { fmtTime } from '../api.js';
import { setBlock, usePointer } from './state.js';
import { clipStarts, clipLength, outToSrc, srcToOut, srcRangeToOut, setSpeed, trimClip, MIN_CLIP, clicksOf } from '../../../core/screen/index.js';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8];
const HEAD_W = 92;

export function RecTimeline({ rec, sel, setSel, ops }) {
  const time = useEditor((s) => s.time);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const L = Math.max(0.5, rec.length);
  const pps = Math.max(2, ((width - 28) / L) * zoom);
  const contentW = Math.max(width, L * pps + 28);
  const local = Math.max(0, Math.min(L, time - rec.start));
  const track = usePointer(rec);
  const starts = useMemo(() => clipStarts(rec.clips), [rec.clips]);

  // keep the playhead visible while playing
  const playing = useEditor((s) => s.playing);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const x = local * pps;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 60) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
  }, [local, playing, pps]);

  const xToT = (clientX) => {
    const r = contentRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(L, (clientX - r.left - 14) / pps));
  };
  const scrub = (e) => {
    if (e.button !== 0) return;
    editor.pause();
    editor.seek(rec.start + Math.min(L - 0.001, xToT(e.clientX)));
    const mv = (ev) => editor.seek(rec.start + Math.min(L - 0.001, xToT(ev.clientX)));
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const el = scrollRef.current;
    const r = el.getBoundingClientRect();
    const t = (el.scrollLeft + e.clientX - r.left - 14) / pps;
    const nz = Math.max(1, Math.min(80, zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
    setZoom(nz);
    requestAnimationFrame(() => { const p2 = Math.max(2, ((width - 28) / L) * nz); el.scrollLeft = Math.max(0, t * p2 - (e.clientX - r.left - 14)); });
  };

  const curClip = outToSrc(rec.clips, local).index;
  const selClip = sel?.kind === 'clip' ? sel.index : null;
  const speedMenu = (e) => {
    const i = selClip ?? curClip;
    openMenu(e, SPEEDS.map((v) => ({ label: `${v}×${v === 1 ? '（原速）' : ''}`, icon: rec.clips[i]?.speed === v ? 'check' : undefined, onClick: () => setBlock(rec, { clips: setSpeed(rec.clips, i, v) }, { message: '调整速度' }) })));
  };

  const ticks = useMemo(() => {
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const step = steps.find((s) => s * pps >= 70) || 600;
    const out = [];
    for (let t = 0; t <= L + 1e-6; t += step) out.push(t);
    return { step, list: out };
  }, [pps, L]);

  const hasMic = !!rec.block.mic, hasSys = !!rec.block.system;
  return (
    <div className="rtl">
      <div className="rtl-tools">
        <button className="btn sm" title="在播放头处分割 S" onClick={ops.split}><Icon name="scissors" size={13} />分割</button>
        <button className="btn sm ghost" title="删除所选片段或缩放 Delete" disabled={!sel} onClick={ops.removeSelected}><Icon name="trash" size={13} />删除</button>
        <button className="btn sm ghost" title="所选片段（或播放头所在片段）的速度" onClick={speedMenu}><Icon name="gauge" size={13} />{rec.clips[selClip ?? curClip]?.speed ?? 1}×</button>
        <span className="tb-sep" />
        <button className="btn sm" title="在播放头处添加缩放 Z" onClick={() => ops.addZoom()}><Icon name="zoom-in" size={13} />缩放</button>
        <button className="btn sm ghost" title="根据录制时的点击重新生成自动缩放（保留手动缩放）" disabled={!track?.events?.length} onClick={() => ops.autoZoom(track)}><Icon name="wand-sparkles" size={13} />自动运镜</button>
        <div className="grow" />
        <span className="mono dim" style={{ fontSize: 11.5 }}>{fmtTime(local)} / {fmtTime(L)} · {rec.clips.length} 段</span>
        <span className="tb-sep" />
        <button className="ibtn sm" title="缩小 (Ctrl+滚轮)" onClick={() => setZoom((z) => Math.max(1, z / 1.5))}><Icon name="minus" size={13} /></button>
        <input className="range" style={{ width: 90 }} type="range" min={0} max={1} step={0.001} value={Math.log(zoom) / Math.log(80)} onChange={(e) => setZoom(Math.exp(Number(e.target.value) * Math.log(80)))} />
        <button className="ibtn sm" title="放大 (Ctrl+滚轮)" onClick={() => setZoom((z) => Math.min(80, z * 1.5))}><Icon name="plus" size={13} /></button>
        <button className="ibtn sm" title="适应宽度" onClick={() => setZoom(1)}><Icon name="move-horizontal" size={13} /></button>
      </div>
      <div className="rtl-body">
        <div className="rtl-heads" style={{ width: HEAD_W }}>
          <div className="rh ruler-h" />
          <div className="rh clips"><Icon name="film" size={13} />画面</div>
          <div className="rh zooms"><Icon name="zoom-in" size={13} />缩放</div>
          <div className="rh clicks"><Icon name="mouse-pointer-click" size={13} />点击</div>
          {hasMic ? <div className="rh audio"><Icon name="mic" size={13} />麦克风</div> : null}
          {hasSys ? <div className="rh audio"><Icon name="volume-2" size={13} />系统声音</div> : null}
        </div>
        <div className="rtl-scroll" ref={scrollRef} onWheel={onWheel}>
          <div className="rtl-content" ref={contentRef} style={{ width: contentW }}>
            <div className="trk ruler" onMouseDown={scrub}>
              {ticks.list.map((t) => <span key={t} className="tick" style={{ left: 14 + t * pps }}>{t < 60 && ticks.step < 1 ? t.toFixed(1) : fmtClock(t)}</span>)}
            </div>
            <div className="trk clips" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSel(null); scrub(e); } }}>
              {rec.clips.map((c, i) => <ClipItem key={c.id || i} rec={rec} clip={c} index={i} start={starts[i]} pps={pps} selected={selClip === i} onSelect={() => setSel({ kind: 'clip', index: i })} />)}
            </div>
            <div className="trk zooms" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSel(null); scrub(e); } }}
              onDoubleClick={(e) => { if (e.target === e.currentTarget) ops.addZoom(xToT(e.clientX)); }} title="双击添加缩放">
              {rec.zooms.map((z, i) => <ZoomItem key={z.id || i} rec={rec} z={z} index={i} pps={pps} selected={sel?.kind === 'zoom' && sel.id === z.id} onSelect={() => setSel({ kind: 'zoom', id: z.id })} />)}
            </div>
            <div className="trk clicks" onMouseDown={scrub}>
              {track ? clicksOf(track.events).map((c, i) => { const t = srcToOut(rec.clips, c.t); return t == null ? null : <span key={i} className={`clk ${c.k === 2 ? 'r' : ''}`} style={{ left: 14 + t * pps }} />; })
                : <span className="dim trk-note">{rec.block.pointer ? '正在读取光标轨迹…' : '这段录像没有光标轨迹'}</span>}
            </div>
            {hasMic ? <AudioTrack rec={rec} which="mic" pps={pps} width={contentW} /> : null}
            {hasSys ? <AudioTrack rec={rec} which="system" pps={pps} width={contentW} /> : null}
            <div className="playhead" style={{ left: 14 + local * pps }} onMouseDown={scrub}><span /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const fmtClock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Drag helper: base document, transient updates while moving, one undo step on release. */
function dragEdit(e, rec, compute, message) {
  e.preventDefault(); e.stopPropagation();
  const base = editor.s.doc;
  const x0 = e.clientX;
  let last = null;
  const mv = (ev) => {
    const set = compute(ev.clientX - x0, ev);
    if (!set) return;
    last = set;
    editor.edit([{ op: 'update_block', block: rec.block.id, set }], { base, transient: true });
  };
  const up = () => {
    removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
    if (last) editor.edit([{ op: 'update_block', block: rec.block.id, set: last }], { base, message });
  };
  addEventListener('mousemove', mv); addEventListener('mouseup', up);
}

function ClipItem({ rec, clip, index, start, pps, selected, onSelect }) {
  const len = clipLength(clip);
  const w = Math.max(2, len * pps);
  const thumbs = useThumbs(rec);
  const tiles = useMemo(() => {
    if (!thumbs?.list.length) return [];
    const tw = 30 * (thumbs.ar || 16 / 9);
    const n = Math.max(1, Math.ceil(w / tw));
    const out = [];
    for (let j = 0; j < n && j < 400; j++) {
      const src = clip.from + ((j + 0.5) * tw / pps) * clip.speed;
      const k = Math.min(thumbs.list.length - 1, Math.max(0, Math.round(src / thumbs.step)));
      out.push({ x: j * tw, w: tw, url: thumbs.list[k] });
    }
    return out;
  }, [thumbs, w, clip.from, clip.speed, pps]);
  const trim = (edge) => (e) => {
    const c0 = rec.clips[index];
    dragEdit(e, rec, (dx) => {
      const ds = (dx / pps) * c0.speed;
      const src = edge === 'from' ? c0.from + ds : c0.to + ds;
      return { clips: trimClip(rec.clips, index, edge, src, rec.D) };
    }, '修剪片段');
  };
  const menu = (e) => {
    e.preventDefault();
    onSelect();
    openMenu(e, [
      ...SPEEDS.map((v) => ({ label: `速度 ${v}×`, icon: clip.speed === v ? 'check' : undefined, onClick: () => setBlock(rec, { clips: setSpeed(rec.clips, index, v) }, { message: '调整速度' }) })),
      '-',
      { label: clip.muted ? '取消静音' : '静音这一段', icon: clip.muted ? 'volume-2' : 'volume-x', onClick: () => setBlock(rec, { clips: rec.clips.map((c, i) => (i === index ? { ...c, muted: !c.muted } : c)) }, { message: '静音片段' }) },
      { label: '删除片段', icon: 'trash', danger: true, disabled: rec.clips.length <= 1, onClick: () => setBlock(rec, { clips: rec.clips.filter((_, i) => i !== index) }, { message: '删除片段' }) },
    ]);
  };
  return (
    <div className={`clip ${selected ? 'on' : ''} ${clip.muted ? 'muted' : ''}`} style={{ left: 14 + start * pps, width: w }}
      onMouseDown={(e) => { if (e.button === 0) { onSelect(); editor.pause(); editor.seek(rec.start + start + Math.min(len - 0.001, (e.clientX - e.currentTarget.getBoundingClientRect().left) / pps)); } }} onContextMenu={menu}>
      <div className="tiles">{tiles.map((t, i) => <img key={i} src={t.url} style={{ left: t.x, width: t.w }} draggable={false} />)}</div>
      <div className="lbl">{clip.speed !== 1 ? <b>{clip.speed}×</b> : null}{clip.muted ? <Icon name="volume-x" size={11} /> : null}<span>{fmtTime(len)}</span></div>
      {w > 14 ? <><span className="edge l" onMouseDown={trim('from')} title="拖动修剪开头" /><span className="edge r" onMouseDown={trim('to')} title="拖动修剪结尾" /></> : null}
    </div>
  );
}

function ZoomItem({ rec, z, index, pps, selected, onSelect }) {
  const hold = srcRangeToOut(rec.clips, z.start, z.end);
  const tail = z.exit > 0 ? srcRangeToOut(rec.clips, z.end, z.end + z.exit) : [];
  if (!hold.length) return null;
  const o0 = hold[0][0], o1 = hold.at(-1)[1];
  const neighbours = () => {
    const prev = rec.zooms[index - 1], next = rec.zooms[index + 1];
    return { min: prev ? prev.end : 0, max: next ? next.start : rec.D };
  };
  const move = (mode) => (e) => {
    if (e.button !== 0) return;
    onSelect();
    const { min, max } = neighbours();
    const len = z.end - z.start;
    dragEdit(e, rec, (dx) => {
      const dt = dx / pps;
      let s = z.start, en = z.end;
      if (mode === 'move') {
        s = outToSrc(rec.clips, Math.max(0, o0 + dt)).src;
        s = Math.max(min, Math.min(max - len, s));
        en = s + len;
      } else if (mode === 'start') s = Math.max(min, Math.min(z.end - 0.2, outToSrc(rec.clips, Math.max(0, o0 + dt)).src));
      else en = Math.min(max, Math.max(z.start + 0.2, outToSrc(rec.clips, Math.max(0, o1 + dt)).src));
      return { zooms: rec.zooms.map((x, i) => (i === index ? { ...x, start: +s.toFixed(3), end: +en.toFixed(3) } : x)) };
    }, '调整缩放');
  };
  const label = `${z.scale.toFixed(1)}× · ${z.mode === 'auto' ? '跟随光标' : '固定'}`;
  return (
    <>
      {hold.map(([a, b], i) => {
        const w = Math.max(4, (b - a) * pps);
        const enterW = i === 0 ? Math.min(w, (z.enter / 1) * pps) : 0;
        return (
          <div key={i} className={`zseg ${z.mode} ${selected ? 'on' : ''}`} style={{ left: 14 + a * pps, width: w, '--enter': `${enterW}px` }} onMouseDown={move('move')} title={`${label}（拖动移动，拖动两端调整）`}>
            {w > 60 ? <span className="lbl"><Icon name={z.mode === 'auto' ? 'mouse-pointer-2' : 'locate-fixed'} size={11} />{label}</span> : null}
            {i === 0 ? <span className="edge l" onMouseDown={(e) => { e.stopPropagation(); move('start')(e); }} /> : null}
            {i === hold.length - 1 ? <span className="edge r" onMouseDown={(e) => { e.stopPropagation(); move('end')(e); }} /> : null}
          </div>
        );
      })}
      {tail.map(([a, b], i) => <div key={`t${i}`} className={`ztail ${z.mode}`} style={{ left: 14 + a * pps, width: Math.max(1, (b - a) * pps) }} />)}
    </>
  );
}

// ───────────────────────────── thumbnails ─────────────────────────────
const thumbCache = new Map();
export function useThumbs(rec) {
  const url = editor.engine?.assets.urlFor(rec.block.asset);
  const [v, setV] = useState(() => thumbCache.get(url) || null);
  useEffect(() => {
    if (!url) return undefined;
    if (thumbCache.get(url)?.complete) { setV(thumbCache.get(url)); return undefined; }
    let alive = true;
    const D = rec.D || 1;
    const n = Math.max(2, Math.min(80, Math.ceil(D / 2)));
    const step = D / (n - 1);
    const entry = { list: [], step, ar: (rec.block.source?.width || 16) / (rec.block.source?.height || 9), complete: false };
    const el = document.createElement('video');
    el.muted = true; el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = url;
    const c = document.createElement('canvas');
    c.height = 60; c.width = Math.round(60 * entry.ar);
    const g = c.getContext('2d');
    const seek = (t) => new Promise((res) => { const done = () => { el.removeEventListener('seeked', done); res(); }; el.addEventListener('seeked', done); el.currentTime = Math.min(t, Math.max(0, (el.duration || D) - 0.05)); setTimeout(done, 2500); });
    (async () => {
      await new Promise((r) => { el.addEventListener('loadeddata', r, { once: true }); el.addEventListener('error', r, { once: true }); });
      for (let i = 0; i < n && alive; i++) {
        await seek(i * step);
        try { g.drawImage(el, 0, 0, c.width, c.height); entry.list[i] = c.toDataURL('image/jpeg', 0.7); } catch { entry.list[i] = entry.list[i - 1] || ''; }
        // fill the gaps so tiles show something while the rest loads
        const filled = { ...entry, list: Array.from({ length: n }, (_, k) => entry.list[Math.min(k, i)]) };
        if (alive && (i % 6 === 0 || i === n - 1)) setV(filled);
      }
      entry.complete = alive;
      if (alive) thumbCache.set(url, { ...entry });
      el.removeAttribute('src'); el.load();
    })();
    return () => { alive = false; };
  }, [url, rec.D]);
  return v;
}

// ───────────────────────────── audio ─────────────────────────────
const peakCache = new Map();
function AudioTrack({ rec, which, pps, width }) {
  const ref = useRef(null);
  const url = editor.engine?.assets.urlFor(rec.block[which]);
  const [peaks, setPeaks] = useState(() => peakCache.get(url) || null);
  const vol = Number(rec.settings.audio[which] ?? 1);
  useEffect(() => {
    if (!url || peakCache.has(url)) { setPeaks(peakCache.get(url) || null); return undefined; }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(url);
        const size = Number(res.headers.get('content-length') || 0);
        if (size > 80e6) { peakCache.set(url, { none: true }); if (alive) setPeaks({ none: true }); return; }
        const buf = await res.arrayBuffer();
        const ac = new OfflineAudioContext(1, 1, 8000);
        const audio = await ac.decodeAudioData(buf);
        const data = audio.getChannelData(0);
        const rate = 40; // peaks per second
        const per = Math.max(1, Math.floor(audio.sampleRate / rate));
        const out = new Float32Array(Math.ceil(data.length / per));
        for (let i = 0; i < out.length; i++) { let m = 0; for (let j = i * per, e = Math.min(data.length, j + per); j < e; j++) { const v = Math.abs(data[j]); if (v > m) m = v; } out[i] = m; }
        const p = { rate, data: out };
        peakCache.set(url, p);
        if (alive) setPeaks(p);
      } catch { peakCache.set(url, { none: true }); if (alive) setPeaks({ none: true }); }
    })();
    return () => { alive = false; };
  }, [url]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const H = 30;
    c.width = Math.min(32000, Math.round(width * dpr)); c.height = H * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, H);
    const starts = clipStarts(rec.clips);
    rec.clips.forEach((cl, i) => {
      const x0 = 14 + starts[i] * pps, w = clipLength(cl) * pps;
      g.fillStyle = cl.muted || vol <= 0 ? 'rgba(255,255,255,0.04)' : which === 'mic' ? 'rgba(62,207,142,0.14)' : 'rgba(90,209,255,0.14)';
      g.fillRect(x0, 2, w, H - 4);
      if (!peaks?.data || cl.muted) return;
      g.fillStyle = vol <= 0 ? 'rgba(255,255,255,0.15)' : which === 'mic' ? '#3ecf8e' : '#5ad1ff';
      const k = Math.min(1.6, Math.max(0.15, vol));
      for (let x = 0; x < w; x += 2) {
        const src = cl.from + (x / pps) * cl.speed;
        const v = peaks.data[Math.floor(src * peaks.rate)] || 0;
        const h = Math.max(1, Math.min(H - 6, Math.sqrt(v) * (H - 6) * k));
        g.fillRect(x0 + x, H / 2 - h / 2, 1.4, h);
      }
    });
  }, [peaks, pps, width, rec.clips, vol, which]);
  return (
    <div className="trk audio" title={`${which === 'mic' ? '麦克风' : '系统声音'} · 音量 ${Math.round(vol * 100)}%`}>
      <canvas ref={ref} style={{ width: Math.min(32000, width), height: 30 }} />
    </div>
  );
}

export { MIN_CLIP };
