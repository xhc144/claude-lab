// Inspector of the recording editor: frame (background, padding, corners, shadow, window, aspect),
// camera motion (zoom segments and defaults), cursor, webcam and sound.
import { useRef } from 'react';
import { editor } from '../editor/store.js';
import { Icon } from '../icons.jsx';
import { Segmented, Switch, Select } from '../ui.jsx';
import { fmtTime } from '../api.js';
import { setBlock, usePointer } from './state.js';
import { useThumbs } from './RecTimeline.jsx';
import { BACKGROUNDS, EASINGS, srcToOut } from '../../../core/screen/index.js';

const TABS = [
  { id: 'frame', label: '画面', icon: 'image' },
  { id: 'camera', label: '运镜', icon: 'zoom-in' },
  { id: 'cursor', label: '光标', icon: 'mouse-pointer-2' },
  { id: 'webcam', label: '摄像头', icon: 'webcam' },
  { id: 'audio', label: '音频', icon: 'audio-lines' },
];
const EASE_LABEL = { spring: '弹簧（自然）', cubic: '缓入缓出', quint: '强缓动', quad: '柔和', linear: '线性' };

export function RecInspector({ rec, tab, setTab, sel, setSel, ops }) {
  return (
    <div className="rec-insp">
      <div className="rec-tabs">
        {TABS.map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}><Icon name={t.icon} size={15} /><span>{t.label}</span></button>)}
      </div>
      <div className="rec-pane">
        {tab === 'frame' ? <FramePane rec={rec} /> : null}
        {tab === 'camera' ? <CameraPane rec={rec} sel={sel} setSel={setSel} ops={ops} /> : null}
        {tab === 'cursor' ? <CursorPane rec={rec} /> : null}
        {tab === 'webcam' ? <WebcamPane rec={rec} /> : null}
        {tab === 'audio' ? <AudioPane rec={rec} /> : null}
      </div>
    </div>
  );
}

// ───────────────────────────── controls ─────────────────────────────
function Row({ label, children, hint }) {
  return (
    <div className="rrow">
      <div className="rlabel">{label}</div>
      <div className="rctl">{children}</div>
      {hint ? <div className="rhint">{hint}</div> : null}
    </div>
  );
}

function Slider({ value, min, max, step = 0.01, onChange, fmt = (v) => v.toFixed(2), disabled }) {
  return (
    <div className="rslider">
      <input className="range" type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="mono">{fmt(Number(value))}</span>
    </div>
  );
}

function Section({ title, children, right }) {
  return <div className="rsec"><div className="rsec-h"><span>{title}</span>{right}</div>{children}</div>;
}

const pct = (v) => `${Math.round(v * 100)}%`;
const edit = (rec, set, key, message) => setBlock(rec, set, { coalesce: `rec:${rec.block.id}:${key}`, message });

// ───────────────────────────── frame ─────────────────────────────
function FramePane({ rec }) {
  const s = rec.settings;
  const bg = s.background;
  const setBg = (patch) => edit(rec, { background: { ...bg, ...patch } }, 'bg', '背景');
  const aspect = rec.doc.format.aspect;
  return (
    <>
      <Section title="背景">
        <div className="bg-grid">
          {Object.entries(BACKGROUNDS).map(([id, g]) => (
            <button key={id} className={`bg-sw ${bg.type === 'gradient' && bg.preset === id ? 'on' : ''}`} title={g.label} onClick={() => setBg({ type: 'gradient', preset: id })}
              style={{ background: `radial-gradient(circle at 22% 12%, ${g.glow}55, transparent 60%), linear-gradient(${g.angle}deg, ${g.stops.join(', ')})` }} />
          ))}
          <button className={`bg-sw special ${bg.type === 'blur' ? 'on' : ''}`} title="录像本身的模糊放大" onClick={() => setBg({ type: 'blur' })}><Icon name="droplets" size={14} /></button>
          <button className={`bg-sw special ${bg.type === 'color' ? 'on' : ''}`} title="纯色" onClick={() => setBg({ type: 'color' })} style={{ background: bg.type === 'color' ? bg.color : undefined }}><Icon name="paint-bucket" size={14} /></button>
          <button className={`bg-sw special ${bg.type === 'none' ? 'on' : ''}`} title="无背景（画面铺满）" onClick={() => setBg({ type: 'none' })}><Icon name="ban" size={14} /></button>
        </div>
        {bg.type === 'color' ? <Row label="颜色"><input type="color" className="rcolor" value={bg.color || '#16181f'} onChange={(e) => setBg({ color: e.target.value })} /></Row> : null}
        {bg.type === 'blur' ? <Row label="模糊"><Slider value={Number(bg.blur) || 40} min={8} max={120} step={1} fmt={(v) => `${v}`} onChange={(v) => setBg({ blur: v })} /></Row> : null}
      </Section>
      <Section title="外观">
        <Row label="留白"><Slider value={s.padding} min={0} max={0.3} step={0.005} fmt={pct} disabled={bg.type === 'none'} onChange={(v) => edit(rec, { padding: v }, 'pad', '留白')} /></Row>
        <Row label="圆角"><Slider value={s.radius} min={0} max={60} step={1} fmt={(v) => `${v}`} onChange={(v) => edit(rec, { radius: v }, 'rad', '圆角')} /></Row>
        <Row label="阴影"><Slider value={s.shadow} min={0} max={1} step={0.01} fmt={pct} disabled={bg.type === 'none'} onChange={(v) => edit(rec, { shadow: v }, 'shadow', '阴影')} /></Row>
        <Row label="窗口"><Segmented value={s.window} onChange={(v) => setBlock(rec, { window: v }, { message: '窗口外框' })} options={[{ value: 'none', label: '无' }, { value: 'mac', label: 'macOS' }, { value: 'browser', label: '浏览器' }]} /></Row>
      </Section>
      <Section title="画面比例">
        <div className="aspect-row">
          {[['16:9', 'rectangle-horizontal'], ['9:16', 'rectangle-vertical'], ['1:1', 'square'], ['4:3', 'rectangle-horizontal'], ['4:5', 'rectangle-vertical']].map(([a, ic]) => (
            <button key={a} className={`chip ${aspect === a ? 'on' : ''}`} onClick={() => editor.edit([{ op: 'set_format', aspect: a }], { message: '画面比例' })}><Icon name={ic} size={13} />{a}</button>
          ))}
        </div>
        <div className="rhint">竖屏与方形适合短视频平台；录像会居中并保持比例。</div>
      </Section>
    </>
  );
}

// ───────────────────────────── camera motion ─────────────────────────────
function CameraPane({ rec, sel, setSel, ops }) {
  const track = usePointer(rec);
  const d = rec.settings.zoom;
  const z = sel?.kind === 'zoom' ? rec.zooms.find((x) => x.id === sel.id) : null;
  const zi = z ? rec.zooms.indexOf(z) : -1;
  const setZ = (patch, key) => edit(rec, { zooms: rec.zooms.map((x, i) => (i === zi ? { ...x, ...patch } : x)) }, `z:${z.id}:${key}`, '调整缩放');
  const clicks = track ? track.events.filter((e) => e.k === 1 || e.k === 2).length : 0;
  return (
    <>
      <Section title="自动运镜" right={<span className="dim">{track ? `${clicks} 次点击` : '无光标轨迹'}</span>}>
        <div className="rhint" style={{ marginTop: 0 }}>点击附近自动放大，多次点击在同一区域时镜头保持不动，光标离开画面中部时镜头平滑跟随。</div>
        <Row label="放大倍数"><Slider value={d.scale} min={1.1} max={4} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => edit(rec, { zoomDefaults: { ...d, scale: v } }, 'zd', '默认缩放')} /></Row>
        <Row label="缓动"><Select value={d.easing} style={{ width: '100%' }} options={EASINGS.map((e) => ({ value: e, label: EASE_LABEL[e] || e }))} onChange={(v) => edit(rec, { zoomDefaults: { ...d, easing: v } }, 'zde', '默认缓动')} /></Row>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <button className="btn sm grow" disabled={!track?.events.length} onClick={() => ops.autoZoom(track)}><Icon name="wand-sparkles" size={13} />按点击重新生成</button>
          <button className="btn sm ghost" disabled={!rec.zooms.length} onClick={() => { setBlock(rec, { zooms: [] }, { message: '清除缩放' }); setSel(null); }}>清除全部</button>
        </div>
      </Section>
      {z ? (
        <Section title="所选缩放" right={<button className="ibtn sm" title="删除 Delete" onClick={ops.removeSelected}><Icon name="trash" size={13} /></button>}>
          <div className="dim" style={{ marginBottom: 6 }}>源时间 {fmtTime(z.start)} – {fmtTime(z.end)}（{(z.end - z.start).toFixed(1)} 秒）</div>
          <Row label="倍数"><Slider value={z.scale} min={1.1} max={5} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => setZ({ scale: v }, 'scale')} /></Row>
          <Row label="镜头"><Segmented value={z.mode} onChange={(v) => setZ({ mode: v }, 'mode')} options={[{ value: 'auto', label: '跟随光标' }, { value: 'manual', label: '固定位置' }]} /></Row>
          <FocusPicker rec={rec} z={z} onChange={(f) => setZ({ focus: f, mode: 'manual' }, 'focus')} />
          <Row label="缓动"><Select value={z.easing} style={{ width: '100%' }} options={EASINGS.map((e) => ({ value: e, label: EASE_LABEL[e] || e }))} onChange={(v) => setZ({ easing: v }, 'ease')} /></Row>
          <Row label="进入"><Slider value={z.enter} min={0} max={2} step={0.05} fmt={(v) => `${v.toFixed(2)}s`} onChange={(v) => setZ({ enter: v }, 'enter')} /></Row>
          <Row label="退出"><Slider value={z.exit} min={0} max={2} step={0.05} fmt={(v) => `${v.toFixed(2)}s`} onChange={(v) => setZ({ exit: v }, 'exit')} /></Row>
        </Section>
      ) : null}
      <Section title={`缩放片段（${rec.zooms.length}）`} right={<button className="btn sm ghost" onClick={() => ops.addZoom()}><Icon name="plus" size={13} />添加</button>}>
        {!rec.zooms.length ? <div className="dim">还没有缩放。按 Z 在播放头处添加，或在时间线的缩放轨道上双击。</div> : (
          <div className="zlist">
            {rec.zooms.map((x) => {
              const out = srcToOut(rec.clips, x.start);
              return (
                <button key={x.id} className={`zrow ${z?.id === x.id ? 'on' : ''}`} onClick={() => { setSel({ kind: 'zoom', id: x.id }); if (out != null) { editor.pause(); editor.seek(rec.start + out + Math.min(x.enter, 0.8)); } }}>
                  <Icon name={x.mode === 'auto' ? 'mouse-pointer-2' : 'locate-fixed'} size={13} />
                  <span className="mono">{out == null ? '已剪掉' : fmtTime(out)}</span>
                  <span className="grow dim">{x.mode === 'auto' ? '跟随光标' : '固定'}</span>
                  <b>{x.scale.toFixed(1)}×</b>
                </button>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}

/** Drag the zoomed viewport over a frame of the recording to set where a manual zoom looks. */
function FocusPicker({ rec, z, onChange }) {
  const thumbs = useThumbs(rec);
  const ref = useRef(null);
  const k = thumbs?.list.length ? Math.min(thumbs.list.length - 1, Math.max(0, Math.round((z.start + z.enter) / thumbs.step))) : -1;
  const url = k >= 0 ? thumbs.list[k] : null;
  const ar = (rec.block.source?.width || 16) / (rec.block.source?.height || 9);
  const vw = 1 / z.scale;
  const clampF = (v) => Math.min(1 - vw / 2, Math.max(vw / 2, v));
  const fx = clampF(z.focus[0]), fy = clampF(z.focus[1]);
  const down = (e) => {
    const r = ref.current.getBoundingClientRect();
    const at = (ev) => onChange([+Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)).toFixed(4), +Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)).toFixed(4)]);
    at(e);
    const mv = (ev) => at(ev);
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  return (
    <div className="focus-pick" ref={ref} style={{ aspectRatio: String(ar) }} onMouseDown={down} title="拖动选择放大的位置">
      {url ? <img src={url} draggable={false} /> : null}
      <div className="vp" style={{ left: `${(fx - vw / 2) * 100}%`, top: `${(fy - vw / 2) * 100}%`, width: `${vw * 100}%`, height: `${vw * 100}%` }} />
      <span className="fp-dot" style={{ left: `${z.focus[0] * 100}%`, top: `${z.focus[1] * 100}%` }} />
      {z.mode === 'auto' ? <span className="fp-note">跟随光标中 · 拖动改为固定位置</span> : null}
    </div>
  );
}

// ───────────────────────────── cursor ─────────────────────────────
function CursorPane({ rec }) {
  const c = rec.settings.cursor;
  const set = (patch, key) => edit(rec, { cursor: { ...c, ...patch } }, `cur:${key}`, '光标');
  const has = !!rec.block.pointer;
  const inVideo = rec.block.source?.cursorInVideo !== false;
  return (
    <>
      {!has ? <div className="rnote"><Icon name="info" size={14} />这段录像没有光标轨迹（导入的视频），只能使用录像里原有的光标。</div> : null}
      <Section title="光标">
        <Row label="显示" hint={inVideo && (c.show === 'overlay') ? '录像里已有系统光标，叠加美化光标会出现两个光标' : c.show === 'auto' ? (inVideo ? '自动：录像带有系统光标，保留原光标并添加点击特效' : '自动：使用平滑的美化光标') : null}>
          <Select value={c.show} style={{ width: '100%' }} onChange={(v) => set({ show: v }, 'show')} options={[{ value: 'auto', label: '自动' }, { value: 'overlay', label: '美化光标' }, { value: 'recorded', label: '录像原光标' }, { value: 'none', label: '隐藏光标与特效' }]} />
        </Row>
        <Row label="大小"><Slider value={c.size} min={0.5} max={3} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} disabled={!has} onChange={(v) => set({ size: v }, 'size')} /></Row>
        <Row label="平滑移动"><Switch value={c.smooth !== false} disabled={!has} onChange={(v) => set({ smooth: v }, 'smooth')} /></Row>
        <Row label="移动倾斜"><Slider value={c.tilt} min={0} max={4} step={0.1} fmt={(v) => v.toFixed(1)} disabled={!has} onChange={(v) => set({ tilt: v }, 'tilt')} /></Row>
        <Row label="光晕"><Switch value={!!c.highlight} disabled={!has} onChange={(v) => set({ highlight: v }, 'hl')} /></Row>
        <Row label="静止时隐藏"><Switch value={!!c.hideIdle} disabled={!has} onChange={(v) => set({ hideIdle: v }, 'idle')} /></Row>
        {c.hideIdle ? <Row label="静止多久"><Slider value={c.idleDelay} min={0.3} max={6} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => set({ idleDelay: v }, 'idled')} /></Row> : null}
      </Section>
      <Section title="点击特效">
        <Row label="样式"><Segmented value={c.click} onChange={(v) => set({ click: v }, 'click')} options={[{ value: 'ripple', label: '涟漪' }, { value: 'ring', label: '收缩环' }, { value: 'pulse', label: '脉冲' }, { value: 'none', label: '无' }]} /></Row>
        <Row label="颜色">
          <div className="row" style={{ gap: 6 }}>
            <input type="color" className="rcolor" value={c.clickColor || '#4f8cff'} disabled={c.click === 'none'} onChange={(e) => set({ clickColor: e.target.value }, 'cc')} />
            {c.clickColor ? <button className="btn sm ghost" onClick={() => set({ clickColor: null }, 'cc')}>默认（左键蓝 · 右键橙）</button> : <span className="dim">左键蓝 · 右键橙</span>}
          </div>
        </Row>
      </Section>
    </>
  );
}

// ───────────────────────────── webcam ─────────────────────────────
function WebcamPane({ rec }) {
  const cam = rec.settings.camera;
  const set = (patch, key) => edit(rec, { camera_layout: { ...cam, ...patch } }, `cam:${key}`, '摄像头');
  if (!rec.block.camera) return <div className="rnote"><Icon name="info" size={14} />这段录像没有摄像头画面。录制时在“摄像头”中选择设备即可同时录制画中画。</div>;
  return (
    <Section title="摄像头画中画">
      <Row label="显示"><Switch value={cam.show !== false} onChange={(v) => set({ show: v }, 'show')} /></Row>
      <Row label="位置">
        <div className="pos-grid">
          {['tl', 'tr', 'bl', 'br'].map((p) => <button key={p} className={cam.position === p ? 'on' : ''} onClick={() => set({ position: p }, 'pos')} title={{ tl: '左上', tr: '右上', bl: '左下', br: '右下' }[p]}><span className={`pdot ${p}`} /></button>)}
        </div>
      </Row>
      <Row label="大小"><Slider value={cam.size} min={0.08} max={0.5} step={0.005} fmt={pct} onChange={(v) => set({ size: v }, 'size')} /></Row>
      <Row label="形状"><Segmented value={cam.shape} onChange={(v) => set({ shape: v }, 'shape')} options={[{ value: 'circle', label: '圆形' }, { value: 'rounded', label: '圆角' }, { value: 'square', label: '方形' }]} /></Row>
      <Row label="描边"><Slider value={cam.border} min={0} max={10} step={0.5} fmt={(v) => `${v}`} onChange={(v) => set({ border: v }, 'border')} /></Row>
      <Row label="阴影"><Slider value={cam.shadow} min={0} max={1} step={0.01} fmt={pct} onChange={(v) => set({ shadow: v }, 'shadow')} /></Row>
      <Row label="镜像"><Switch value={cam.mirror !== false} onChange={(v) => set({ mirror: v }, 'mirror')} /></Row>
      <Row label="放大时缩小"><Switch value={cam.shrinkOnZoom !== false} onChange={(v) => set({ shrinkOnZoom: v }, 'shrink')} /></Row>
    </Section>
  );
}

// ───────────────────────────── audio ─────────────────────────────
function AudioPane({ rec }) {
  const a = rec.settings.audio;
  const set = (patch, key) => edit(rec, { audio: { ...a, ...patch } }, `aud:${key}`, '音量');
  return (
    <>
      <Section title="音量">
        {rec.block.mic ? <Row label="麦克风"><VolumeRow value={a.mic} onChange={(v) => set({ mic: v }, 'mic')} /></Row> : <div className="dim">没有录制麦克风。</div>}
        {rec.block.system ? <Row label="系统声音"><VolumeRow value={a.system} onChange={(v) => set({ system: v }, 'sys')} /></Row> : <div className="dim" style={{ marginTop: 4 }}>没有录制系统声音。</div>}
        <div className="rhint">在时间线的片段上右键可以静音其中一段；变速片段的声音会同步变速（音调不变）。</div>
      </Section>
    </>
  );
}

function VolumeRow({ value, onChange }) {
  const v = Number(value ?? 1);
  return (
    <div className="row" style={{ gap: 6, width: '100%' }}>
      <button className="ibtn sm" title={v > 0 ? '静音' : '取消静音'} onClick={() => onChange(v > 0 ? 0 : 1)}><Icon name={v > 0 ? 'volume-2' : 'volume-x'} size={14} /></button>
      <Slider value={v} min={0} max={2} step={0.01} fmt={pct} onChange={onChange} />
    </div>
  );
}
