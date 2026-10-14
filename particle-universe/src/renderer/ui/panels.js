// Settings panel: tabbed sliders / toggles / segmented controls bound to app settings.
import { h, fmtCount } from './dom.js';
import { icon } from './icons.js';
import { PALETTES, paletteCss } from '../gfx/palettes.js';
import { TIERS } from '../gfx/particles.js';

const pct = (v) => Math.round(v * 100) + '%';
const mul = (v) => v.toFixed(2) + '×';
const sec = (v) => v.toFixed(1) + 's';

const TABS = [
  {
    id: 'particles', label: '粒子', icon: 'atom', groups: [
      { title: '粒子系统', items: [
        { type: 'tier' },
        { path: 'particles.size', label: '粒子大小', min: 0.3, max: 3, step: 0.01, fmt: mul },
        { path: 'particles.brightness', label: '整体亮度', min: 0.2, max: 3, step: 0.01, fmt: pct },
        { path: 'particles.speed', label: '运动速度', min: 0, max: 3, step: 0.01, fmt: mul },
        { path: 'particles.turbulence', label: '湍流强度', min: 0, max: 3, step: 0.01, fmt: mul },
        { path: 'particles.streak', label: '运动拖影', min: 0, max: 3, step: 0.01, fmt: mul },
        { path: 'particles.transition', label: '场景过渡', min: 1, max: 8, step: 0.1, fmt: sec }
      ] },
      { title: '当前场景', items: [{ type: 'sceneParams' }] }
    ]
  },
  {
    id: 'audio', label: '音频', icon: 'wave', groups: [
      { title: '音频响应', items: [
        { path: 'audio.reactivity', label: '响应灵敏度', min: 0, max: 2.5, step: 0.01, fmt: pct },
        { path: 'audio.bass', label: '低频冲击', min: 0, max: 2.5, step: 0.01, fmt: pct },
        { path: 'audio.treble', label: '高频闪烁', min: 0, max: 2.5, step: 0.01, fmt: pct },
        { path: 'audio.impact', label: '节拍冲击波', min: 0, max: 2.5, step: 0.01, fmt: pct },
        { path: 'audio.latency', label: '画面同步偏移', min: -250, max: 250, step: 5, fmt: (v) => (v > 0 ? '+' : '') + v + 'ms' }
      ] },
      { title: '实时输入', items: [{ type: 'live' }] },
      { title: '曲目分析', items: [{ type: 'trackInfo' }] }
    ]
  },
  {
    id: 'fx', label: '光影', icon: 'light', groups: [
      { title: '电影光效', items: [
        { path: 'fx.bloom', label: '泛光强度', min: 0, max: 3, step: 0.01, fmt: pct },
        { path: 'fx.bloomRadius', label: '泛光扩散', min: 0.4, max: 1.5, step: 0.01, fmt: pct },
        { path: 'fx.flare', label: '变形镜头光晕', min: 0, max: 3, step: 0.01, fmt: pct },
        { path: 'fx.trails', label: '余辉拖尾', min: 0, max: 1.6, step: 0.01, fmt: pct },
        { path: 'fx.dof', label: '景深虚化', min: 0, max: 3, step: 0.01, fmt: pct },
        { path: 'fx.chroma', label: '色散', min: 0, max: 3, step: 0.01, fmt: pct },
        { path: 'fx.grain', label: '胶片颗粒', min: 0, max: 3, step: 0.01, fmt: pct },
        { path: 'fx.vignette', label: '暗角', min: 0, max: 2, step: 0.01, fmt: pct },
        { path: 'fx.stars', label: '星空背景', min: 0, max: 2, step: 0.01, fmt: pct },
        { path: 'fx.letterbox', label: '电影宽银幕 2.39:1', type: 'toggle' }
      ] }
    ]
  },
  {
    id: 'color', label: '色彩', icon: 'palette', groups: [
      { title: '调色板', items: [{ type: 'palettes' }] },
      { title: '调色', items: [
        { path: 'color.hue', label: '色相偏移', min: -180, max: 180, step: 1, fmt: (v) => Math.round(v) + '°' },
        { path: 'color.saturation', label: '饱和度', min: 0, max: 2, step: 0.01, fmt: pct },
        { path: 'color.contrast', label: '对比度', min: 0.5, max: 1.6, step: 0.01, fmt: pct },
        { path: 'color.temperature', label: '色温', min: -1, max: 1, step: 0.01, fmt: (v) => (v > 0 ? '暖 ' : v < 0 ? '冷 ' : '') + Math.abs(Math.round(v * 100)) }
      ] }
    ]
  },
  {
    id: 'camera', label: '镜头', icon: 'orbit', groups: [
      { title: '运镜', items: [
        { path: 'camera.auto', label: '自动运镜', type: 'toggle' },
        { path: 'camera.style', label: '运镜风格', type: 'seg', options: [['smooth', '平稳'], ['cinematic', '电影'], ['energetic', '动感']] },
        { path: 'camera.shake', label: '节拍震动', min: 0, max: 3, step: 0.01, fmt: pct },
        { path: 'camera.autoRotate', label: '自由镜头自转', min: 0, max: 0.4, step: 0.01, fmt: (v) => v.toFixed(2) },
        { type: 'cameraActions' }
      ] },
      { title: '场景切换', items: [
        { path: 'scene.autoSwitch', label: '自动切换', type: 'seg', options: [['off', '关闭'], ['music', '随音乐'], ['timer', '定时']] },
        { path: 'scene.interval', label: '定时间隔', min: 20, max: 180, step: 5, fmt: (v) => v + 's' }
      ] }
    ]
  },
  {
    id: 'quality', label: '画质', icon: 'cpu', groups: [
      { title: '性能与画质', items: [
        { path: 'quality.auto', label: '根据硬件自动调整', type: 'toggle' },
        { path: 'quality.maxTier', label: '自动上限', type: 'seg', options: [[2, '52万'], [3, '105万'], [4, '210万'], [5, '419万']] },
        { path: 'quality.renderScale', label: '渲染分辨率', min: 0.4, max: 1.5, step: 0.05, fmt: pct, live: (app) => app.engine.renderScale },
        { path: 'quality.showStats', label: '显示性能信息', type: 'toggle' },
        { type: 'gpuInfo' }
      ] }
    ]
  }
];

export class SettingsPanel {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.tab = 'particles';
    this.bindings = [];
    this.build();
    app.addEventListener('settings', () => this.sync());
    app.addEventListener('scene', () => { if (this.tab === 'particles') this.renderBody(); });
    app.addEventListener('track', () => { if (this.tab === 'audio') this.renderBody(); });
    app.addEventListener('quality', () => this.sync());
    app.engine.addEventListener('tier', () => this.sync());
  }

  build() {
    this.root.innerHTML = '';
    this.root.append(
      h('div', { class: 'panel-head' }, h('h3', {}, '参数调节'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn-icon', 'data-tip': '关闭 (Tab)', html: icon('x', 18), onclick: () => this.app.emit('panel', { panel: 'settings', open: false }) })),
      this.tabsEl = h('div', { class: 'tabs' }),
      this.body = h('div', { class: 'panel-body' }),
      h('div', { class: 'panel-foot' },
        h('button', { class: 'btn ghost', html: icon('refresh', 16) + '<span>恢复本页默认</span>', onclick: () => this.resetTab() }))
    );
    for (const t of TABS) {
      this.tabsEl.append(h('button', { class: 'tab' + (t.id === this.tab ? ' on' : ''), dataset: { tab: t.id }, html: icon(t.icon, 18) + `<span>${t.label}</span>`, onclick: () => { this.tab = t.id; this.renderTabs(); this.renderBody(); } }));
    }
    this.renderBody();
  }

  renderTabs() { for (const b of this.tabsEl.children) b.classList.toggle('on', b.dataset.tab === this.tab); }

  resetTab() {
    const map = { particles: ['particles', 'scene'], audio: ['audio'], fx: ['fx'], color: ['color'], camera: ['camera'], quality: ['quality'] };
    for (const s of map[this.tab]) this.app.resetSection(s);
    if (this.tab === 'particles') this.app.engine.setTier(this.app.quality.initialTier());
    this.renderBody();
  }

  renderBody() {
    this.bindings = [];
    this.body.innerHTML = '';
    const tab = TABS.find((t) => t.id === this.tab);
    for (const g of tab.groups) {
      const group = h('div', { class: 'group' }, h('div', { class: 'group-title' }, g.title));
      for (const it of g.items) group.append(this.control(it));
      this.body.append(group);
    }
    this.sync();
  }

  slider(label, get, set, { min, max, step, fmt }, def) {
    const val = h('span', { class: 'val' });
    const input = h('input', { type: 'range', min, max, step });
    const upd = (v) => { val.textContent = fmt ? fmt(v) : v; input.style.setProperty('--p', ((v - min) / (max - min)) * 100 + '%'); };
    input.addEventListener('input', () => { const v = Number(input.value); set(v); upd(v); });
    const lab = h('label', { title: def != null ? '双击恢复默认' : '' }, label);
    if (def != null) lab.addEventListener('dblclick', () => { set(def); input.value = def; upd(def); });
    this.bindings.push(() => { const v = get(); if (document.activeElement !== input) input.value = v; upd(v); });
    return h('div', { class: 'row' }, lab, input, val);
  }

  control(it) {
    const app = this.app;
    if (it.type === 'toggle') {
      const t = h('button', { class: 'toggle', onclick: () => app.set(it.path, !app.get(it.path)) });
      this.bindings.push(() => t.classList.toggle('on', !!app.get(it.path)));
      return h('div', { class: 'row toggle-row' }, h('label', {}, it.label), t);
    }
    if (it.type === 'seg') return this.seg(it.label, it.options, () => app.get(it.path), (v) => app.set(it.path, v));
    if (it.type === 'tier') return this.tierControl();
    if (it.type === 'sceneParams') return this.sceneParams();
    if (it.type === 'palettes') return this.palettes();
    if (it.type === 'live') return this.liveControls();
    if (it.type === 'trackInfo') return this.trackInfo();
    if (it.type === 'gpuInfo') return this.gpuInfo();
    if (it.type === 'cameraActions') {
      return h('div', { class: 'row wide' }, h('label', {}, '镜头'), h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', { class: 'btn', html: icon('refresh', 16) + '重置镜头', onclick: () => app.resetCamera() }),
        h('span', { class: 'info-line', style: { padding: '0' } }, '拖动旋转 · 右键平移 · 滚轮缩放')));
    }
    const def = it.path.split('.').reduce((o, k) => o && o[k], DEFAULTS_REF);
    return this.slider(it.label, () => (it.live ? it.live(app) : app.get(it.path)), (v) => app.set(it.path, v), it, def);
  }

  seg(label, options, get, set) {
    const seg = h('div', { class: 'seg' });
    for (const [v, l] of options) seg.append(h('button', { dataset: { v: String(v) }, onclick: () => set(v) }, l));
    this.bindings.push(() => { const cur = String(get()); for (const b of seg.children) b.classList.toggle('on', b.dataset.v === cur); });
    return h('div', { class: 'row wide' }, h('label', {}, label), seg);
  }

  tierControl() {
    const app = this.app;
    const wrap = h('div', {});
    const seg1 = h('div', { class: 'seg', style: { marginBottom: '6px' } });
    const seg2 = h('div', { class: 'seg' });
    const auto = h('button', { onclick: () => app.set('quality.auto', true) }, '自动');
    seg1.append(auto);
    TIERS.forEach((t, i) => {
      const b = h('button', { dataset: { i: String(i) }, onclick: () => app.set('quality.tier', i) }, t.label);
      (i < 3 ? seg1 : seg2).append(b);
    });
    wrap.append(seg1, seg2);
    const note = h('div', { class: 'info-line' });
    this.bindings.push(() => {
      const a = app.settings.quality.auto, ti = app.engine.tierIndex;
      auto.classList.toggle('on', a);
      for (const b of [...seg1.children, ...seg2.children]) if (b.dataset.i != null) b.classList.toggle('on', Number(b.dataset.i) === ti);
      note.innerHTML = `当前 <b>${fmtCount(app.engine.particles.count)}</b> 颗粒子${a ? ' · 自动模式会根据帧率实时调节' : ''}`;
    });
    return h('div', {}, h('div', { class: 'row wide' }, h('label', {}, '粒子数量'), wrap), note);
  }

  sceneParams() {
    const app = this.app;
    const scene = app.currentScene;
    const box = h('div', {});
    box.append(h('div', { class: 'info-line' }, h('b', {}, scene.name), ' · ', scene.desc));
    for (const p of scene.params) {
      const get = () => {
        const u = app.settings.sceneParams[scene.id];
        return u && u[p.key] != null ? u[p.key] : p.def;
      };
      if (p.options) {
        box.append(this.seg(p.label, p.options.map((o, i) => [i, o]), get, (v) => { app.setSceneParam(scene.id, p.key, v); this.sync(); }));
      } else {
        box.append(this.slider(p.label, get, (v) => app.setSceneParam(scene.id, p.key, v), { ...p, fmt: (v) => v.toFixed(2) }, p.def));
      }
    }
    return box;
  }

  palettes() {
    const app = this.app;
    const grid = h('div', { class: 'palettes' });
    const autoBtn = h('button', { class: 'pal auto', dataset: { id: 'auto' }, onclick: () => app.set('color.palette', 'auto') }, '跟随场景');
    grid.append(autoBtn);
    for (const p of PALETTES) {
      grid.append(h('button', { class: 'pal', dataset: { id: p.id }, style: { background: paletteCss(p) }, onclick: () => app.set('color.palette', p.id) }, p.name));
    }
    this.bindings.push(() => { const cur = app.settings.color.palette; for (const b of grid.children) b.classList.toggle('on', b.dataset.id === cur); });
    return grid;
  }

  liveControls() {
    const app = this.app;
    const row = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '2px 4px 6px' } },
      h('button', { class: 'btn', html: icon('monitor', 16) + '捕获系统声音', onclick: () => app.startLive('system') }),
      h('button', { class: 'btn', html: icon('mic', 16) + '麦克风', onclick: () => app.startLive('mic') }),
      h('button', { class: 'btn ghost', html: icon('stop', 14) + '停止', onclick: () => app.stopLive() })
    );
    return h('div', {}, row, h('div', { class: 'info-line' }, '捕获系统声音后，任意播放器（网易云音乐、QQ 音乐、Spotify 等）正在播放的声音都会驱动粒子。'));
  }

  trackInfo() {
    const app = this.app;
    const el = h('div', { class: 'info-line' });
    const upd = () => {
      const t = app.track;
      if (!t) { el.textContent = '尚未加载曲目'; return; }
      const a = t.analysis;
      el.innerHTML = `速度 <b>${Math.round(a.bpm)} BPM</b>${a.hasTempo ? '' : '（节奏不明显）'} · 节拍 <b>${a.beats.length}</b> · 鼓点 <b>${a.kicks.length / 2}</b><br>高潮 <b>${a.drops.length}</b> 处 · 段落 <b>${a.sections.length}</b> 个 · 时长 <b>${Math.floor(a.duration / 60)}:${String(Math.floor(a.duration % 60)).padStart(2, '0')}</b>`;
    };
    this.bindings.push(upd);
    return el;
  }

  gpuInfo() {
    const app = this.app;
    const el = h('div', { class: 'info-line' });
    this.bindings.push(() => {
      const e = app.engine;
      el.innerHTML = `显卡 <b>${e.gpuPretty}</b><br>粒子 <b>${fmtCount(e.particles.count)}</b> · 内部分辨率 <b>${e.post.w}×${e.post.h}</b> · 输出 <b>${e.outW}×${e.outH}</b>`;
    });
    return el;
  }

  sync() { for (const b of this.bindings) b(); }
}

let DEFAULTS_REF = {};
export function setDefaultsRef(d) { DEFAULTS_REF = d; }
