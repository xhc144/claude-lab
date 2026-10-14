// Custom theme designer. A user theme extends a built-in design system and overrides its key
// tokens; everything else (secondary colours, tone variants, data palette) is derived here with
// contrast guarantees, so a few choices still produce a complete, consistent system. Saved
// themes live in the library (themes/) and are available to every project, the CLI and AI.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Field, Select, Segmented, TextInput, toast, Spinner } from '../ui.jsx';
import { editor } from './store.js';
import { call } from '../api.js';
import { THEMES } from '../../../core/themes/index.js';
import { BACKGROUNDS, MOTIONS, TRANSITIONS } from '../../../core/catalog/scene.js';
import { MotifEngine } from '../../../engine/index.js';
import { mix, toCss, toHex, contrast, ensureContrast, parseColor } from '../../../core/util/color.js';
import { clone } from '../../../core/util/misc.js';

const FONT_SETS = {
  grotesk: { label: '几何无衬线（Space Grotesk）', display: ['Motif Grotesk', 'Motif Sans SC'], text: ['Motif Inter', 'Motif Sans SC'] },
  inter: { label: '现代无衬线（Inter）', display: ['Motif Inter', 'Motif Sans SC'], text: ['Motif Inter', 'Motif Sans SC'] },
  archivo: { label: '宽体无衬线（Archivo）', display: ['Motif Archivo', 'Motif Sans SC'], text: ['Motif Inter', 'Motif Sans SC'] },
  outfit: { label: '圆润友好（Outfit）', display: ['Motif Outfit', 'Motif Sans SC'], text: ['Motif Outfit', 'Motif Sans SC'] },
  serif: { label: '报刊衬线（Fraunces + 宋体）', display: ['Motif Fraunces', 'Motif Serif SC'], text: ['Motif Serif SC', 'Motif Fraunces'] },
  elegant: { label: '优雅衬线（Instrument + 宋体）', display: ['Motif Instrument', 'Motif Serif SC'], text: ['Motif Inter', 'Motif Sans SC'] },
  brush: { label: '书法（马善政楷书）', display: ['Motif Brush SC', 'Motif Serif SC'], text: ['Motif Serif SC'] },
};

const hex = (c) => { try { return toHex(c); } catch { return '#888888'; } };
const dark = (c) => { const p = parseColor(c); return p ? 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b < 0.45 : true; };

/** Build a full user theme from a handful of choices. */
export function buildUserTheme(d) {
  const base = THEMES[d.extends];
  const bg = d.bg, ink = ensureContrast(d.ink, d.bg, 7);
  const accent = ensureContrast(d.accent, bg, 2.6), accent2 = d.accent2;
  const isDark = dark(bg);
  const onAccent = contrast('#ffffff', accent) >= contrast('#111111', accent) ? '#ffffff' : '#111111';
  const palette = {
    bg, bg2: mix(bg, ink, 0.05), surface: toCss(ink, isDark ? 0.06 : 0.04), surface2: toCss(ink, isDark ? 0.1 : 0.07),
    ink, muted: mix(ink, bg, 0.35), faint: mix(ink, bg, 0.6), line: toCss(ink, isDark ? 0.16 : 0.14),
    accent, accent2, accent3: base.palette.accent3 || mix(accent, accent2, 0.5),
    highlight: toCss(accent, 0.2), onAccent,
    data: [accent, accent2, ...base.palette.data.filter((c) => c !== base.palette.accent && c !== base.palette.accent2).slice(0, 6)],
    gradient: [accent, accent2],
  };
  const inverseBg = isDark ? mix('#ffffff', accent, 0.06) : mix('#0b0c10', accent, 0.12);
  const inverseInk = isDark ? '#101219' : '#f4f5f8';
  const tones = {
    inverse: { bg: inverseBg, bg2: mix(inverseBg, inverseInk, 0.05), ink: inverseInk, muted: mix(inverseInk, inverseBg, 0.35), faint: mix(inverseInk, inverseBg, 0.6), line: toCss(inverseInk, 0.14), surface: toCss(inverseInk, 0.05), accent: ensureContrast(accent, inverseBg, 3) },
    accent: { bg: accent, bg2: mix(accent, onAccent, 0.08), ink: onAccent, muted: mix(onAccent, accent, 0.3), faint: mix(onAccent, accent, 0.55), line: toCss(onAccent, 0.22), surface: toCss(onAccent, 0.08), accent: onAccent === '#ffffff' ? accent2 : mix(accent2, '#000000', 0.4) },
  };
  const fonts = clone(base.fonts);
  const fs = FONT_SETS[d.fonts];
  if (fs) { for (const k of ['display', 'heading', 'number']) fonts[k] = { ...fonts[k], family: fs.display }; fonts.text = { ...fonts.text, family: fs.text }; }
  const background = d.background === 'auto' ? { ...base.background } : { type: d.background, grain: base.background.grain ?? 0.03 };
  if (['aurora', 'blobs', 'gradient'].includes(background.type)) background.colors = [accent, accent2, mix(accent, accent2, 0.5), mix(accent, bg, 0.5)];
  const motion = { ...base.motion };
  if (d.enter !== 'auto') { motion.enter = d.enter; motion.titleEnter = d.enter; }
  if (d.transition !== 'auto') motion.transition = { ...motion.transition, type: d.transition };
  return {
    id: d.id, name: d.name, extends: d.extends, description: d.description || `基于 ${base.name} 的自定义主题`,
    scheme: isDark ? 'dark' : 'light', palette, tones, fonts, background, motion,
  };
}

export function ThemeEditor({ onClose, onSaved, initial }) {
  const doc = editor.s.doc;
  const cur = THEMES[doc.theme.id] ? doc.theme.id : 'aurora';
  const b = THEMES[initial?.extends || cur];
  const [d, setD] = useState(() => initial ? {
    id: initial.id, name: initial.name, extends: initial.extends, bg: initial.palette?.bg || b.palette.bg, ink: initial.palette?.ink || b.palette.ink,
    accent: initial.palette?.accent || b.palette.accent, accent2: initial.palette?.accent2 || b.palette.accent2 || b.palette.accent, fonts: initial._fonts || 'keep', background: initial._background || 'auto', enter: initial._enter || 'auto', transition: initial._transition || 'auto',
  } : {
    name: `${b.name.split(' ')[0]} · 自定义`, extends: cur, bg: hex(b.palette.bg), ink: hex(b.palette.ink), accent: hex(doc.theme.accent || b.palette.accent),
    accent2: hex(b.palette.accent2 || b.palette.accent), fonts: 'keep', background: 'auto', enter: 'auto', transition: 'auto',
  });
  const [busy, setBusy] = useState(false);
  const canvas = useRef(null);
  const set = (patch) => setD((o) => ({ ...o, ...patch }));
  const rebase = (id) => { const t = THEMES[id]; set({ extends: id, bg: hex(t.palette.bg), ink: hex(t.palette.ink), accent: hex(t.palette.accent), accent2: hex(t.palette.accent2 || t.palette.accent) }); };
  const theme = useMemo(() => buildUserTheme({ ...d, id: d.id || 'draft-theme' }), [d]);

  // live preview with the person's current scene
  const engine = useMemo(() => new MotifEngine({ resolveUrl: editor.engine.assets.resolveUrl }), []);
  useEffect(() => {
    let alive = true;
    const c = canvas.current;
    if (!c) return;
    const scene = doc.scenes.find((s) => s.id === editor.s.sel.scene) || doc.scenes[0];
    if (!scene) return;
    engine.userThemes = { [theme.id]: theme };
    const pd = { ...clone(doc), theme: { id: theme.id }, scenes: [clone(scene)], style: { ...doc.style, progress: false, pageNumbers: false } };
    (async () => {
      await engine.setDocument(pd, { normalized: true });
      engine.cache.clear(); engine.update(pd);
      if (!alive) return;
      const W = engine.C.env.W, H = engine.C.env.H;
      const s = (c.clientWidth * Math.min(2, devicePixelRatio)) / W;
      c.width = Math.round(W * s); c.height = Math.round(H * s);
      const tm = engine.timing().scenes[0];
      engine.render(tm.settled - tm.start, c.getContext('2d'), { scale: s, solo: tm.id, chrome: false, noCamera: true });
    })();
    return () => { alive = false; };
  }, [theme]);

  const save = async () => {
    if (!d.name.trim()) { toast('请填写主题名称'); return; }
    setBusy(true);
    try {
      const t = buildUserTheme({ ...d, name: d.name.trim() });
      if (!t.id) delete t.id;
      Object.assign(t, { _fonts: d.fonts, _background: d.background, _enter: d.enter, _transition: d.transition });
      const saved = await call('themes.save', t);
      editor.engine.userThemes = { ...editor.engine.userThemes, [saved.id]: saved };
      editor.engine.cache.clear();
      editor.edit([{ op: 'set_theme', theme: saved.id, accent: null }], { message: `主题：${saved.name}` });
      toast.ok(`已保存主题「${saved.name}」，并应用到当前作品`);
      onSaved?.(saved);
    } catch (e) { toast.error(e); setBusy(false); }
  };

  const colorRow = (key, label) => (
    <Field label={label}>
      <div className="row" style={{ gap: 6 }}>
        <span className="swatch" style={{ background: d[key] }}><input type="color" value={hex(d[key])} onChange={(e) => set({ [key]: e.target.value })} /></span>
        <TextInput mono value={d[key]} onCommit={(v) => parseColor(v) && set({ [key]: v })} />
      </div>
    </Field>
  );
  const warn = contrast(d.ink, d.bg) < 4.5 ? '正文与背景对比度偏低，已自动加强' : contrast(d.accent, d.bg) < 2.6 ? '强调色与背景太接近，已自动调整' : null;
  return (
    <Modal title={initial ? '编辑自定义主题' : '新建自定义主题'} sub="选择基础设计系统和几项关键令牌，其余配色、色调与数据色板自动推导" icon="palette" onClose={onClose} width={980}
      footer={<><span className="dim grow" style={{ fontSize: 12 }}>保存后所有作品、CLI 与 AI 都可以使用（motif themes）</span><button className="btn" onClick={onClose}>取消</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? <Spinner size={14} /> : null}保存并应用</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 18 }}>
        <div>
          <div className="card" style={{ overflow: 'hidden', aspectRatio: `${doc.format.width} / ${doc.format.height}`, maxHeight: 420, display: 'grid', placeItems: 'center', background: '#000' }}>
            <canvas ref={canvas} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="row" style={{ gap: 4, marginTop: 10 }}>
            {theme.palette.data.slice(0, 8).map((c, i) => <i key={i} style={{ width: 22, height: 10, borderRadius: 3, background: c }} />)}
            <span className="dim" style={{ fontSize: 11.5, marginLeft: 6 }}>数据色板</span>
          </div>
          {warn ? <div className="ai-step" style={{ marginTop: 10 }}>{warn}</div> : null}
        </div>
        <div>
          <Field label="名称"><TextInput value={d.name} onChange={(v) => set({ name: v })} /></Field>
          <Field label="基于"><Select value={d.extends} options={Object.values(THEMES).map((t) => ({ value: t.id, label: t.name }))} onChange={rebase} /></Field>
          <div className="divider" style={{ margin: '10px 0' }} />
          {colorRow('bg', '背景')}
          {colorRow('ink', '文字')}
          {colorRow('accent', '强调色')}
          {colorRow('accent2', '辅助色')}
          <div className="divider" style={{ margin: '10px 0' }} />
          <Field label="字体"><Select value={d.fonts} options={[{ value: 'keep', label: '沿用基础主题' }, ...Object.entries(FONT_SETS).map(([k, v]) => ({ value: k, label: v.label }))]} onChange={(v) => set({ fonts: v })} /></Field>
          <Field label="背景"><Select value={d.background} options={Object.entries(BACKGROUNDS).filter(([k]) => k !== 'image').map(([k, v]) => ({ value: k, label: k === 'auto' ? '沿用基础主题' : v.label }))} onChange={(v) => set({ background: v })} /></Field>
          <Field label="入场动画"><Select value={d.enter} options={Object.entries(MOTIONS).filter(([k]) => k !== 'none').map(([k, v]) => ({ value: k, label: k === 'auto' ? '沿用基础主题' : v }))} onChange={(v) => set({ enter: v })} /></Field>
          <Field label="默认转场"><Select value={d.transition} options={Object.entries(TRANSITIONS).map(([k, v]) => ({ value: k, label: k === 'auto' ? '沿用基础主题' : v.label }))} onChange={(v) => set({ transition: v })} /></Field>
        </div>
      </div>
    </Modal>
  );
}

export { Segmented };
