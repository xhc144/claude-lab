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
import { TRANSITIONS } from '../../../core/catalog/scene.js';
import { GUIDE_ACTIONS } from '../../../core/catalog/guide.js';
import { ACTION_ICON } from './GuideEditor.jsx';

const TRANS_ICON = { fade: 'blend', morph: 'shapes', push: 'arrow-right-left', slide: 'panel-right', wipe: 'columns-2', zoom: 'zoom-in', blur: 'droplets', dip: 'moon', band: 'rows-3', stripes: 'menu', iris: 'circle', scan: 'scan-line', ink: 'brush', cut: 'scissors' };

function setGuideAt(scene, idx, at, message) {
  const steps = (scene.guide?.steps || []).map((st, k) => { if (k !== idx) return st; const o = { ...st }; if (at == null) delete o.at; else o.at = at; return o; });
  editor.updateScene(scene.id, { guide: { ...scene.guide, steps } }, { message, coalesce: null });
}


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

  // drag a pointer step to pin its start time (scene-relative); double-click returns it to auto
  const dragGuide = (e, g, sc) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const scene0 = editor.s.doc.scenes.find((q) => q.id === sc.id);
    if (!scene0?.guide) return;
    const base = editor.s.doc;
    const x0 = e.clientX;
    let last = null;
    editor.pause();
    editor.seek(sc.start + g.at + g.drawDur);
    const withAt = (at) => ({ guide: { ...scene0.guide, steps: scene0.guide.steps.map((st, k) => (k === g.idx ? { ...st, at } : st)) } });
    const mv = (ev) => {
      if (Math.abs(ev.clientX - x0) < 3) return;
      last = Math.max(0, +(g.at + (ev.clientX - x0) / pps).toFixed(2));
      editor.edit([{ op: 'update_scene', scene: sc.id, set: withAt(last) }], { base, transient: true });
      editor.set({ time: sc.start + last + g.drawDur });
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      if (last != null) editor.edit([{ op: 'update_scene', scene: sc.id, set: withAt(last) }], { base, message: '调整讲解时间' });
    };
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
                // Scenes overlap during a transition; draw each one up to the middle of the cut so the
                // strip reads as clean segments, with the transition as a chip sitting on the seam.
                const inD = i > 0 && sc.transition ? sc.transition.duration : 0;
                const nx = timing.scenes[i + 1];
                const outD = nx?.transition ? nx.transition.duration : 0;
                const v0 = sc.start + inD / 2, v1 = sc.end - outD / 2;
                const guided = !!sc.guide?.length;
                const soft = sc.transition && sc.transition.type !== 'cut';
                return (
                  <div key={sc.id}>
                    <div className={`tl-scene ${sel.scene === sc.id ? 'on' : ''}`} style={{ left: x(v0) + 1, width: Math.max(8, x(v1 - v0) - 2) }}
                      onMouseDown={(e) => { e.stopPropagation(); if (e.button === 0) { editor.pause(); editor.selectScene(sc.id); } }}
                      onDoubleClick={() => editor.playScene(sc.id)}
                      title={`${i + 1}. ${title} · ${sc.duration.toFixed(1)}s${typeof s?.duration === 'number' ? '（固定）' : '（自动）'}${guided ? ` · 讲解 ${sc.guide.length} 步` : ''}`}>
                      <span className="lbl"><b style={{ color: 'var(--fg3)', marginRight: 5 }}>{i + 1}</b>{title}</span>
                      {guided ? <span className="tl-guided" title="含讲解指针"><Icon name="mouse-pointer-2" size={11} />{sc.guide.length}</span> : null}
                      <span className="edge" onMouseDown={(e) => dragEdge(e, sc)} onDoubleClick={(e) => { e.stopPropagation(); editor.updateScene(sc.id, { duration: 'auto' }, { message: '时长改为自动' }); }} title="拖动设置时长 · 双击恢复自动" />
                    </div>
                    {i > 0 ? (
                      <div className={`tl-cut ${soft ? '' : 'hard'}`} style={{ left: x(sc.start + inD / 2) }}
                        onMouseDown={(e) => { e.stopPropagation(); if (e.button === 0) { editor.pause(); editor.selectScene(sc.id, { seek: false }); editor.seek(Math.max(0, sc.start - 0.15)); } }}
                        onDoubleClick={(e) => { e.stopPropagation(); editor.set({ time: Math.max(0, sc.start - 0.4) }); editor.play(); }}
                        title={soft ? `转场：${TRANSITIONS[sc.transition.type]?.label || sc.transition.type} · ${sc.transition.duration.toFixed(2)}s · 单击定位，双击播放；在「场景」面板中修改` : '直接切换 · 在「场景」面板中可加转场'}>
                        {soft ? <span className="tl-cut-span" style={{ width: Math.max(0, x(inD)) }} /> : null}
                        <span className="tl-cut-dot"><Icon name={TRANS_ICON[sc.transition?.type] || 'chevrons-right'} size={10} /></span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          {/* explanation pointer steps of the selected scene */}
          {scT?.guide?.length && scene ? (
            <div className="tl-row">
              <div className="tl-label" onClick={() => dispatchEvent(new CustomEvent('motif:show-guide', { detail: { scene: scene.id } }))}><Icon name="mouse-pointer-2" size={13} /><span className="ellipsis">讲解指针</span></div>
              <div className="tl-track" onMouseDown={onScrub}>
                {scT.guide.map((g) => (
                  <div key={g.idx} className={`tl-guide ${g.fixed ? 'fixed' : ''}`} style={{ left: x(scT.start + g.at), width: Math.max(10, x(g.end - g.at) - 2) }}
                    onMouseDown={(e) => dragGuide(e, g, scT)} onDoubleClick={(e) => { e.stopPropagation(); setGuideAt(scene, g.idx, undefined, '讲解时间改为自动'); }}
                    title={`${g.idx + 1}. ${GUIDE_ACTIONS[g.do]?.label || g.do}${g.part != null ? `「${Array.isArray(g.part) ? g.part.join(', ') : g.part}」` : ''} · ${g.at.toFixed(1)}s${g.fixed ? '（固定，双击恢复自动）' : '（自动，拖动可固定时间）'}${g.say ? `\n${g.say}` : ''}`}>
                    <span className="tl-guide-travel" style={{ width: Math.max(0, x(g.travel)), left: -Math.max(0, x(g.travel)) }} />
                    <Icon name={ACTION_ICON[g.do] || 'mouse-pointer-2'} size={11} />
                    <span className="ellipsis">{g.note || g.say || (g.part != null ? String(g.part) : GUIDE_ACTIONS[g.do]?.label)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
