// Export dialog: format / resolution / range options, live progress with preview.
import { h, fmtTime, fmtBytes, fmtCount } from './dom.js';
import { icon } from './icons.js';
import { RESOLUTIONS, probe, bitrateFor } from '../export/exporter.js';
import { TIERS } from '../gfx/particles.js';
import { platform } from '../core/platform.js';
import { saveSettings } from '../core/settings.js';

export class ExportDialog {
  constructor(app, root, ui) {
    this.app = app;
    this.root = root;
    this.ui = ui;
    this.caps = null;
    root.addEventListener('click', (e) => { if (e.target === root && !app.exporter.running) this.hide(); });
  }

  get opts() { return this.app.settings.export; }

  show() {
    const app = this.app;
    if (app.exporter.running) { this.root.classList.add('open'); return; }
    if (!app.track) { app.toast('请先播放一首曲目，再导出它的可视化视频', { error: true }); return; }
    if (!('VideoEncoder' in window)) { app.toast('当前环境不支持 WebCodecs 视频编码', { error: true }); return; }
    this.range = { start: 0, end: app.track.buffer.duration };
    this.renderOptions();
    this.root.classList.add('open');
  }

  hide() { this.root.classList.remove('open'); }

  seg(options, get, set) {
    const seg = h('div', { class: 'seg' });
    const sync = () => { for (const b of seg.children) b.classList.toggle('on', b.dataset.v === String(get())); };
    for (const [v, l, disabled] of options) {
      const b = h('button', { dataset: { v: String(v) }, disabled: !!disabled, onclick: () => { set(v); sync(); this.updateSummary(); } }, l);
      seg.append(b);
    }
    sync();
    return seg;
  }

  renderOptions() {
    const app = this.app, o = this.opts;
    const dur = app.track.buffer.duration;
    const maxTier = Math.min(TIERS.length - 1, Math.max(app.engine.tierIndex, app.gpuTierGuess + 1));
    this.maxTier = maxTier;
    this.root.innerHTML = '';
    const startIn = h('input', { type: 'text', value: fmtTime(this.range.start) });
    const endIn = h('input', { type: 'text', value: fmtTime(this.range.end) });
    const parseT = (s) => { const m = /^(\d+):(\d{1,2})(?:\.(\d+))?$/.exec(s.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number('0.' + m[3]) : 0) : Number(s) || 0; };
    const rangeRow = h('div', { class: 'range-inputs' }, startIn, '至', endIn);
    const updRange = () => {
      if (o.range === 'full') { this.range = { start: 0, end: dur }; }
      else if (o.range === 'from') { this.range = { start: app.audio.position, end: dur }; }
      else { this.range = { start: Math.max(0, Math.min(dur - 1, parseT(startIn.value))), end: Math.max(1, Math.min(dur, parseT(endIn.value))) }; if (this.range.end <= this.range.start) this.range.end = Math.min(dur, this.range.start + 10); }
      startIn.value = fmtTime(this.range.start); endIn.value = fmtTime(this.range.end);
      const custom = o.range === 'custom';
      startIn.disabled = !custom; endIn.disabled = !custom;
      this.updateSummary();
    };
    startIn.addEventListener('change', updRange); endIn.addEventListener('change', updRange);
    this.summary = h('div', { class: 'summary' }, '正在检测编码器…');
    this.startBtn = h('button', { class: 'btn primary', html: icon('film', 16) + '开始导出', onclick: () => this.start() });
    const dlg = h('div', { class: 'dialog' },
      h('h2', { html: icon('film', 20) + '导出高清视频' }),
      h('div', { class: 'sub' }, `「${app.track.item.title}」· 逐帧离线渲染，画面与音乐严格同步，导出速度取决于显卡性能`),
      h('div', { class: 'row' }, h('label', {}, '分辨率'), this.seg(RESOLUTIONS.map((r) => [r.id, r.label]), () => o.resolution, (v) => { o.resolution = v; this.probeCaps(); })),
      h('div', { class: 'row' }, h('label', {}, '帧率'), this.seg([[30, '30 fps'], [60, '60 fps']], () => o.fps, (v) => { o.fps = v; this.probeCaps(); })),
      h('div', { class: 'row' }, h('label', {}, '画质'), this.seg([['standard', '标准'], ['high', '高'], ['ultra', '极高']], () => o.quality, (v) => { o.quality = v; this.probeCaps(); })),
      h('div', { class: 'row' }, h('label', {}, '格式'), this.formatSeg = h('div', {})),
      h('div', { class: 'row' }, h('label', {}, '粒子数量'), this.seg([['current', `当前 (${TIERS[app.engine.tierIndex].label})`], ['max', `最高 (${TIERS[maxTier].label})`]], () => o.particles, (v) => { o.particles = v; })),
      h('div', { class: 'row' }, h('label', {}, '导出范围'), h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
        this.seg([['full', '整首'], ['from', '从当前位置'], ['custom', '自定义']], () => o.range, (v) => { o.range = v; updRange(); }), rangeRow)),
      this.summary,
      h('div', { class: 'actions' }, h('button', { class: 'btn ghost', onclick: () => this.hide() }, '取消'), this.startBtn)
    );
    this.root.append(dlg);
    updRange();
    this.probeCaps();
  }

  dims() {
    const r = RESOLUTIONS.find((x) => x.id === this.opts.resolution) || RESOLUTIONS[1];
    return { w: r.w, h: r.h };
  }

  async probeCaps() {
    const { w, h: hh } = this.dims();
    const o = this.opts;
    const token = (this._probeToken = Symbol('p'));
    this.caps = null;
    this.updateSummary();
    const caps = await probe(w, hh, o.fps, bitrateFor(w, hh, o.fps, o.quality));
    if (token !== this._probeToken) return;
    this.caps = caps;
    if (o.format === 'mp4' && !caps.mp4) o.format = 'webm';
    if (o.format === 'webm' && !caps.webm) o.format = 'mp4';
    if (o.format === 'auto') o.format = caps.mp4 ? 'mp4' : 'webm';
    this.formatSeg.innerHTML = '';
    this.formatSeg.append(this.seg([
      ['mp4', 'MP4 · ' + (caps.mp4 ? caps.mp4.label : '不可用'), !caps.mp4],
      ['webm', 'WebM · ' + (caps.webm ? caps.webm.label : '不可用'), !caps.webm]
    ], () => o.format, (v) => { o.format = v; }));
    this.updateSummary();
  }

  updateSummary() {
    if (!this.summary) return;
    const app = this.app, o = this.opts;
    const { w, h: hh } = this.dims();
    const len = Math.max(0, this.range.end - this.range.start);
    const br = bitrateFor(w, hh, o.fps, o.quality);
    const size = (br + 256000) / 8 * len;
    const frames = Math.round(len * o.fps);
    const fmt = this.caps ? (o.format === 'webm' ? this.caps.webm : this.caps.mp4) : null;
    const enc = !this.caps ? '正在检测编码器…' : fmt ? `${fmt.label}${fmt.video.__hw === 'prefer-hardware' ? ' · 硬件加速' : ''}` : '<span style="color:#ff8a9a">该分辨率下没有可用的编码器，请降低分辨率</span>';
    const tierIdx = o.particles === 'max' ? this.maxTier : app.engine.tierIndex;
    this.summary.innerHTML = `输出 <b>${w}×${hh} · ${o.fps}fps</b> · 码率 <b>${(br / 1e6).toFixed(0)} Mbps</b> · 时长 <b>${fmtTime(len)}</b>（${fmtCount(frames)} 帧）<br>粒子 <b>${fmtCount(TIERS[tierIdx].n)}</b> · 预计文件 <b>${fmtBytes(size)}</b> · ${enc}<br>场景切换与镜头运动将按照当前设置（${app.settings.camera.auto ? '自动运镜' : '自由镜头'} · ${{ off: '手动场景', music: '随音乐切换场景', timer: '定时切换场景' }[app.settings.scene.autoSwitch]}）自动生成。`;
    if (this.startBtn) this.startBtn.disabled = !fmt || len < 0.5;
  }

  async start() {
    const app = this.app, o = this.opts;
    saveSettings(app.settings);
    const { w, h: hh } = this.dims();
    const tier = o.particles === 'max' ? this.maxTier : app.engine.tierIndex;
    // progress view
    this.root.innerHTML = '';
    const prev = h('canvas', { width: 640, height: Math.round(640 * hh / w) });
    const ctx = prev.getContext('2d');
    const bar = h('i');
    const stats = h('div', { class: 'export-stats' }, h('span', {}, '准备中…'), h('span', {}, ''));
    const cancel = h('button', { class: 'btn', onclick: () => { app.exporter.cancel(); cancel.disabled = true; cancel.textContent = '正在取消…'; } }, '取消导出');
    const box = h('div', { class: 'dialog' },
      h('h2', { html: icon('film', 20) + '正在导出' }),
      h('div', { class: 'sub' }, `${w}×${hh} · ${o.fps}fps · 请勿关闭窗口，导出期间暂停播放`),
      h('div', { class: 'export-preview', style: { aspectRatio: `${w} / ${hh}`, maxHeight: '46vh' } }, prev),
      h('div', { class: 'export-bar' }, bar), stats,
      h('div', { class: 'actions' }, cancel));
    this.root.append(box);
    try {
      const res = await app.exporter.run({
        w, h: hh, fps: o.fps, quality: o.quality, format: o.format, start: this.range.start, end: this.range.end, tier,
        name: `${app.track.item.title} - 粒子宇宙`,
        preview: (canvas) => { try { ctx.drawImage(canvas, 0, 0, prev.width, prev.height); } catch { /* ignore */ } },
        onProgress: (p) => {
          bar.style.width = (p.progress * 100).toFixed(1) + '%';
          stats.children[0].textContent = `${(p.progress * 100).toFixed(1)}% · ${fmtCount(p.frame)} / ${fmtCount(p.total)} 帧 · ${p.scene}`;
          stats.children[1].textContent = `${p.speed.toFixed(2)}× 实时 · 已用 ${fmtTime(p.elapsed)}${p.eta != null ? ' · 剩余 ' + fmtTime(p.eta) : ''}`;
        }
      });
      if (res.cancelled) { this.hide(); app.toast('导出已取消'); return; }
      this.root.innerHTML = '';
      this.root.append(h('div', { class: 'dialog' },
        h('h2', { html: icon('check', 20) + '导出完成' }),
        h('div', { class: 'sub' }, `${res.w}×${res.h} · ${res.fps}fps · ${res.format} · 用时 ${fmtTime(res.seconds)}`),
        h('div', { class: 'summary' }, h('b', {}, res.path)),
        h('div', { class: 'actions' },
          platform.canReveal ? h('button', { class: 'btn', html: icon('folder', 16) + '打开所在文件夹', onclick: () => platform.showItem(res.path) }) : null,
          h('button', { class: 'btn primary', onclick: () => this.hide() }, '完成'))));
    } catch (e) {
      console.error(e);
      this.root.innerHTML = '';
      this.root.append(h('div', { class: 'dialog' },
        h('h2', { html: icon('info', 20) + '导出失败' }),
        h('div', { class: 'summary' }, String(e && e.message || e)),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => this.hide() }, '关闭'))));
    }
  }
}
