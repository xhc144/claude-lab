// Timeline: scene strip with transitions, per-block build bars for the selected scene, audio, and a
// scrubbable playhead. Dragging a block shifts its entrance (motion.delay); dragging a scene's
// right edge fixes its duration. Everything else stays automatic.
import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { editor, useEditor, findBlock } from './store.js';
import { Icon, TYPE_ICON } from '../icons.jsx';
import { COMPONENTS } from '../../../core/catalog/components.js';
import { openMenu } from '../ui.jsx';
import { blockMenu } from './menus.js';
import { natureOf } from '../../../engine/layout.js';
import { fmtTime } from '../api.js';

const LABEL_W = 120;

export function Timeline() {
  const { doc, sel } = useEditor((s) => ({ doc: s.doc, sel: s.sel }));
  const timing = useEditor((s) => s.timing);
  const bodyRef = useRef(null);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(null); // px per second; null = fit
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!doc) return null;
  const D = Math.max(1, timing.duration);
  const fitPps = Math.max(4, (width - LABEL_W - 24) / D);
  const pps = zoom || fitPps;
  const total = LABEL_W + D * pps + 40;
  const x = (t) => t * pps;
  const scT = timing.scenes.find((s) => s.id === sel.scene);
  const scene = doc.scenes.find((s) => s.id === sel.scene);

  const seekFromEvent = (e) => {
    const r = bodyRef.current.getBoundingClientRect();
    const px = e.clientX - r.left + bodyRef.current.scrollLeft - LABEL_W;
    editor.pause();
    editor.seek(px / pps);
  };
  const onScrub = (e) => {
    if (e.button !== 0) return;
    seekFromEvent(e);
    const mv = (ev) => seekFromEvent(ev);
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  // tick spacing
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60];
  const major = steps.find((s) => s * pps >= 70) || 60;
  const ticks = [];
  for (let t = 0; t <= D + 0.001; t += major) ticks.push(t);

  const dragBlock = (e, it, scStart) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const fb = findBlock(editor.s.doc, it.id);
    if (!fb) return;
    editor.selectBlock(it.id, fb.scene.id);
    if (fb.block.locked) return;
    const base = editor.s.doc;
    const m0 = fb.block.motion || {};
    const x0 = e.clientX;
    let last = null;
    const mv = (ev) => {
      const dt = (ev.clientX - x0) / pps;
      if (Math.abs(ev.clientX - x0) < 2) return;
      const set = typeof m0.at === 'number' ? { motion: { at: Math.max(0, +(m0.at + dt).toFixed(2)) } } : { motion: { delay: +((m0.delay || 0) + dt).toFixed(2) } };
      last = set;
      editor.edit([{ op: 'update_block', block: it.id, set }], { base, transient: true });
      editor.set({ time: scStart + it.start + dt + Math.min(it.duration, 1.2) });
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      if (last) editor.edit([{ op: 'update_block', block: it.id, set: last }], { base, message: '调整入场时间' });
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  const dragEdge = (e, sc) => {
    e.stopPropagation(); e.preventDefault();
    const base = editor.s.doc;
    const x0 = e.clientX;
    let last = null;
    const mv = (ev) => {
      const d = Math.max(1.2, +(sc.duration + (ev.clientX - x0) / pps).toFixed(1));
      last = d;
      editor.edit([{ op: 'update_scene', scene: sc.id, set: { duration: d } }], { base, transient: true });
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (last) editor.edit([{ op: 'update_scene', scene: sc.id, set: { duration: last } }], { base, message: '调整场景时长' }); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  const music = doc.audio?.music;
  const musicAsset = music?.asset ? doc.assets?.[music.asset] : null;

  return (
    <div className="timeline">
      <div className="tl-head">
        <span style={{ color: 'var(--fg2)', fontWeight: 600, fontSize: 11.5, letterSpacing: '.04em' }}>时间线</span>
        <span className="dim" style={{ fontSize: 11.5 }}>{doc.scenes.length} 个场景 · 总长 {fmtTime(D)}</span>
        <div className="spacer" />
        {scene ? <span className="dim" style={{ fontSize: 11.5 }}>拖动色条调整入场时间 · 拖动场景右缘固定时长</span> : null}
        <button className="ibtn sm" title="缩小" onClick={() => setZoom(Math.max(4, pps / 1.4))}><Icon name="zoom-out" size={14} /></button>
        <input className="range" type="range" min={0} max={100} value={Math.round(Math.log(pps / 4) / Math.log(400 / 4) * 100)} style={{ width: 90 }} onChange={(e) => setZoom(4 * Math.pow(100, e.target.value / 100))} />
        <button className="ibtn sm" title="放大" onClick={() => setZoom(Math.min(400, pps * 1.4))}><Icon name="zoom-in" size={14} /></button>
        <button className={`btn sm ${zoom ? '' : 'ghost'}`} onClick={() => setZoom(null)} title="适应宽度">适应</button>
      </div>
      <div className="tl-body" ref={bodyRef}>
        <div className="tl-grid" style={{ width: total }}>
          <div className="tl-ruler" onMouseDown={onScrub}>
            <div style={{ position: 'absolute', left: LABEL_W, right: 0, top: 0, bottom: 0 }}>
              {ticks.map((t) => <div key={t} className="tick" style={{ left: x(t) }}>{fmtTime(t).replace(/\.0$/, '')}</div>)}
            </div>
            <div style={{ position: 'sticky', left: 0, width: LABEL_W, height: '100%', background: 'var(--bg1)', borderRight: '1px solid var(--line)', zIndex: 2 }} />
          </div>
          {/* scenes */}
          <div className="tl-row scenes-row">
            <div className="tl-label">场景</div>
            <div className="tl-track" onMouseDown={onScrub}>
              {timing.scenes.map((sc, i) => {
                const s = doc.scenes.find((q) => q.id === sc.id);
                const title = s?.name || plain(s?.blocks.find((b) => b.type === 'title')?.text) || `场景 ${i + 1}`;
                return (
                  <div key={sc.id}>
                    {sc.transition && i > 0 ? <div className="tl-trans" style={{ left: x(sc.start), width: Math.max(3, x(sc.transition.duration)) }} title={`转场：${sc.transition.type}`} /> : null}
                    <div className={`tl-scene ${sel.scene === sc.id ? 'on' : ''}`} style={{ left: x(sc.start) + 1, width: Math.max(8, x(sc.duration) - 2) }}
                      onMouseDown={(e) => { e.stopPropagation(); if (e.button === 0) { editor.pause(); editor.selectScene(sc.id); } }}
                      onDoubleClick={() => editor.playScene(sc.id)}
                      title={`${i + 1}. ${title} · ${sc.duration.toFixed(1)}s${typeof s?.duration === 'number' ? '（固定）' : '（自动）'}`}>
                      <span className="lbl"><b style={{ color: 'var(--fg3)', marginRight: 5 }}>{i + 1}</b>{title}</span>
                      <span className="edge" onMouseDown={(e) => dragEdge(e, sc)} onDoubleClick={(e) => { e.stopPropagation(); editor.updateScene(sc.id, { duration: 'auto' }, { message: '时长改为自动' }); }} title="拖动设置时长 · 双击恢复自动" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* blocks of the selected scene */}
          {scT && scene ? scT.items.map((it) => {
            const b = scene.blocks.find((q) => q.id === it.id);
            if (!b) return null;
            const nature = natureOf(b);
            const label = COMPONENTS[b.type]?.label || b.type;
            const desc = plain(b.text || b.title || b.name || b.latex || '');
            const holdW = Math.max(0, x(scT.duration - it.start - it.duration));
            return (
              <div key={it.id} className="tl-row">
                <div className={`tl-label ${sel.block === it.id ? 'on' : ''}`} onClick={() => editor.selectBlock(it.id, scene.id)} onContextMenu={(e) => openMenu(e, blockMenu(it.id))}>
                  <Icon name={TYPE_ICON[b.type] || 'square'} size={13} />
                  <span className="ellipsis">{label}</span>
                  {b.hidden ? <Icon name="eye-off" size={12} /> : null}
                </div>
                <div className="tl-track" onMouseDown={onScrub}>
                  <div className={`tl-block ${sel.block === it.id ? 'sel' : ''} ${it.bleed ? 'bleed' : nature === 'visual' ? 'visual' : ''}`} style={{ left: x(scT.start + it.start), opacity: b.hidden ? 0.4 : 1 }}
                    onMouseDown={(e) => dragBlock(e, it, scT.start)} onContextMenu={(e) => { e.stopPropagation(); openMenu(e, blockMenu(it.id)); }}
                    title={`${label}：入场 ${it.start.toFixed(2)}s，动画 ${it.duration.toFixed(2)}s${b.motion?.delay ? `（偏移 ${b.motion.delay > 0 ? '+' : ''}${b.motion.delay}s）` : ''}`}>
                    <div className="build" style={{ width: Math.max(6, x(it.duration)) }}>{x(it.duration) > 50 ? (desc || label) : ''}</div>
                    <div className="hold" style={{ width: holdW }} />
                  </div>
                </div>
              </div>
            );
          }) : null}
          {music ? (
            <div className="tl-row">
              <div className="tl-label"><Icon name="music" size={13} />音乐</div>
              <div className="tl-track">
                <div className="tl-audio" style={{ left: x(music.start || 0), width: x(D - (music.start || 0)) }}><Icon name="volume-2" size={12} />{musicAsset?.name || music.asset}</div>
              </div>
            </div>
          ) : null}
          <Playhead pps={pps} />
        </div>
      </div>
    </div>
  );
}

function Playhead({ pps }) {
  const t = useEditor((s) => s.time);
  const playing = useEditor((s) => s.playing);
  const ref = useRef(null);
  useEffect(() => {
    // keep the playhead visible while playing
    if (!playing || !ref.current) return;
    const body = ref.current.closest('.tl-body');
    const px = LABEL_W + t * pps;
    if (px > body.scrollLeft + body.clientWidth - 40 || px < body.scrollLeft + LABEL_W) body.scrollLeft = px - LABEL_W - 40;
  }, [t, playing, pps]);
  return <div ref={ref} className="tl-playhead" style={{ left: LABEL_W + t * pps }} />;
}

const plain = (s) => String(s || '').replace(/\*\*|==|~~|`|\*/g, '').split('\n')[0];
