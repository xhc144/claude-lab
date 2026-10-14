// UI shell: top bar, dock, playlist, scene strip, settings panel, HUD, toasts, shortcuts and
// immersive auto-hide.
import { h, $, fmtTime, fmtCount, hashGradient } from './dom.js';
import { icon, LOGO } from './icons.js';
import { SettingsPanel, setDefaultsRef } from './panels.js';
import { ExportDialog } from './export-dialog.js';
import { SCENES } from '../scenes/index.js';
import { platform } from '../core/platform.js';
import { DEFAULTS } from '../core/settings.js';

const THUMBS = import.meta.glob('../assets/scenes/*.webp', { eager: true, query: '?url', import: 'default' });
const thumbFor = (id) => THUMBS[`../assets/scenes/${id}.webp`] || null;
const SCENE_GRADS = {
  nebula: 'radial-gradient(circle at 40% 45%, #69e0d9 0, #2e7fb8 25%, #3a1b5c 55%, #05061a 80%)',
  blackhole: 'radial-gradient(ellipse at 50% 55%, #000 0 12%, #ffcf7a 14%, #f06c12 22%, #4a0a0a 45%, #050205 75%)',
  galaxy: 'radial-gradient(ellipse at 50% 50%, #fff3e2 0, #b9cdfa 12%, #4d6fd1 30%, #1a2450 55%, #040615 80%)',
  storm: 'radial-gradient(ellipse at 50% 50%, #e2f8ff 0, #39d5ff 15%, #3b4cff 35%, #1b0f6b 60%, #050014 85%)',
  silk: 'linear-gradient(120deg, #ff3b6b, #ffae3b 25%, #3bff9b 50%, #3bc8ff 70%, #8a4bff)',
  resonance: 'radial-gradient(circle at 50% 50%, #ffe0ff 0, #6ff2a6 18%, #12a37f 32%, #0b3d4f 55%, #020814 80%)',
  warp: 'radial-gradient(circle at 50% 50%, #fff 0, #8ec9ff 8%, #2d6cb5 30%, #0c2346 60%, #01040c 85%)',
  attractor: 'radial-gradient(ellipse at 45% 50%, #fff1c1 0, #f26b5b 20%, #b23a7a 40%, #4a1a6b 60%, #0d0221 85%)'
};

export class UI {
  constructor(app) {
    this.app = app;
    this.body = document.body;
    this.open = { playlist: false, settings: false, scenes: false };
    this.idleTimer = 0;
    this.lastMove = performance.now();
    this.uiHidden = false;
    this.fullscreen = false;
    setDefaultsRef(DEFAULTS);
    if (!platform.electron) this.body.classList.add('no-overlay');
    this.buildTopbar();
    this.buildWelcome();
    this.buildDock();
    this.buildPlaylist();
    this.settingsPanel = new SettingsPanel(app, $('#settingsPanel'));
    this.buildSceneStrip();
    this.exportDialog = new ExportDialog(app, $('#exportModal'), this);
    this.buildHelp();
    this.hud = $('#hud');
    this.bindEvents();
    this.refreshTrack();
    this.refreshScene(app.engine.scene);
    this.refreshPlaylist();
    this.syncToggles();
  }

  // ---------------------------------------------------------------- top bar
  buildTopbar() {
    $('#brandMark').innerHTML = LOGO;
    const acts = $('#topActions');
    const mk = (ic, tip, fn, id) => { const b = h('button', { class: 'btn-icon', 'data-tip': tip, html: icon(ic, 18), onclick: fn }); if (id) b.id = id; return b; };
    acts.append(
      mk('camera', '截图 (K)', () => this.app.screenshot()),
      mk('activity', '性能信息 (I)', () => this.app.set('quality.showStats', !this.app.settings.quality.showStats), 'btnStats'),
      mk('eyeOff', '隐藏界面 (H)', () => this.toggleUI()),
      mk('keyboard', '快捷键 (?)', () => this.showHelp()),
      mk('fullscreen', '全屏沉浸 (F)', () => this.toggleFullscreen(), 'btnFull')
    );
    $('#sceneChip').addEventListener('click', () => this.togglePanel('scenes'));
  }

  buildWelcome() {
    const w = $('#welcomeActions');
    w.append(
      h('button', { class: 'btn primary lg', html: icon('folder', 18) + '<span>导入本地音乐</span>', onclick: () => this.app.importFiles() }),
      h('button', { class: 'btn lg', html: icon('sparkles', 18) + '<span>播放内置演示曲</span>', onclick: () => this.app.playDemo() }),
      h('button', { class: 'btn lg', html: icon('monitor', 18) + '<span>捕获系统声音</span>', onclick: () => this.app.startLive('system') })
    );
    $('.welcome-inner').append(h('div', { class: 'welcome-keys' },
      h('span', { html: '<kbd>Space</kbd>播放' }), h('span', { html: '<kbd>1-8</kbd>场景' }), h('span', { html: '<kbd>C</kbd>自动运镜' }),
      h('span', { html: '<kbd>F</kbd>全屏' }), h('span', { html: '<kbd>H</kbd>隐藏界面' }), h('span', { html: '<kbd>X</kbd>导出视频' })));
  }

  // ---------------------------------------------------------------- dock
  buildDock() {
    const app = this.app;
    const dock = $('#dock');
    this.cover = h('div', { class: 'cover' }, h('div', { class: 'eq' }, ...Array.from({ length: 5 }, () => h('i'))));
    this.eqBars = [...this.cover.querySelectorAll('.eq i')];
    this.title = h('div', { class: 'track-title' }, '未播放');
    this.sub = h('div', { class: 'track-sub' }, '导入音乐或播放演示曲');
    this.loadBar = h('div', { class: 'loading-bar' }, h('i'));
    this.trackEl = h('div', { class: 'track' }, this.cover, h('div', { class: 'track-meta' }, this.title, this.sub, this.loadBar));

    this.btnShuffle = h('button', { class: 'btn-icon', 'data-tip': '随机播放', html: icon('shuffle', 18), onclick: () => app.set('player.shuffle', !app.settings.player.shuffle) });
    this.btnPrev = h('button', { class: 'btn-icon', 'data-tip': '上一首 ([)', html: icon('prev', 18), onclick: () => app.prev() });
    this.btnPlay = h('button', { class: 'btn-play', 'data-tip': '播放 / 暂停 (空格)', html: icon('play', 20), onclick: () => app.togglePlay() });
    this.btnNext = h('button', { class: 'btn-icon', 'data-tip': '下一首 (])', html: icon('next', 18), onclick: () => app.next(true) });
    this.btnRepeat = h('button', { class: 'btn-icon', 'data-tip': '循环模式', html: icon('repeat', 18), onclick: () => {
      const order = ['all', 'one', 'off'];
      app.set('player.repeat', order[(order.indexOf(app.settings.player.repeat) + 1) % 3]);
    } });
    this.tCur = h('span', { class: 'time' }, '0:00');
    this.tDur = h('span', { class: 'time' }, '0:00');
    this.seekCanvas = h('canvas');
    this.hoverTime = h('div', { class: 'hover-time' });
    this.seekEl = h('div', { class: 'seek' }, this.seekCanvas, this.hoverTime);
    const transport = h('div', { class: 'transport' },
      h('div', { class: 'transport-row' }, this.btnShuffle, this.btnPrev, this.btnPlay, this.btnNext, this.btnRepeat),
      h('div', { class: 'progress' }, this.tCur, this.seekEl, this.tDur));

    this.btnMute = h('button', { class: 'btn-icon', 'data-tip': '静音 (M)', html: icon('volume', 18), onclick: () => app.set('player.muted', !app.settings.player.muted) });
    this.vol = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: app.settings.player.volume });
    this.vol.style.setProperty('--p', app.settings.player.volume * 100 + '%');
    this.vol.addEventListener('input', () => { const v = Number(this.vol.value); app.set('player.volume', v); this.vol.style.setProperty('--p', v * 100 + '%'); if (app.settings.player.muted) app.set('player.muted', false); });
    this.btnCam = h('button', { class: 'btn-icon', 'data-tip': '自动运镜 (C)', html: icon('orbit', 18), onclick: () => app.set('camera.auto', !app.settings.camera.auto) });
    this.btnScenes = h('button', { class: 'btn-icon', 'data-tip': '场景 (G)', html: icon('scenes', 18), onclick: () => this.togglePanel('scenes') });
    this.btnList = h('button', { class: 'btn-icon', 'data-tip': '播放列表 (L)', html: icon('list', 18), onclick: () => this.togglePanel('playlist') });
    this.btnSettings = h('button', { class: 'btn-icon', 'data-tip': '参数调节 (Tab)', html: icon('sliders', 18), onclick: () => this.togglePanel('settings') });
    this.btnExport = h('button', { class: 'btn-icon', 'data-tip': '导出高清视频 (X)', html: icon('film', 18), onclick: () => this.exportDialog.show() });
    const right = h('div', { class: 'dock-right' }, h('div', { class: 'volume' }, this.btnMute, this.vol), h('span', { class: 'sep' }), this.btnCam, this.btnScenes, this.btnList, this.btnSettings, this.btnExport);
    dock.append(this.trackEl, transport, right);

    // seek interactions
    const seekAt = (e) => {
      const r = this.seekEl.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    };
    let dragging = false;
    this.seekEl.addEventListener('pointerdown', (e) => { if (!app.track) return; dragging = true; this.seekEl.setPointerCapture(e.pointerId); app.seek(seekAt(e) * app.audio.duration); });
    this.seekEl.addEventListener('pointermove', (e) => {
      const f = seekAt(e);
      const r = this.seekEl.getBoundingClientRect();
      this.hoverTime.style.left = f * r.width + 'px';
      this.hoverTime.textContent = fmtTime(f * (app.audio.duration || 0));
      if (dragging) app.seek(f * app.audio.duration);
    });
    this.seekEl.addEventListener('pointerup', () => { dragging = false; });
    this.waveCache = null;
  }

  drawSeek() {
    const app = this.app;
    const c = this.seekCanvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr), hgt = Math.round(c.clientHeight * dpr);
    if (!w || !hgt) return;
    const key = (app.track ? app.track.item.id : 'none') + ':' + w + 'x' + hgt;
    if (!this.waveCache || this.waveCache.key !== key) {
      c.width = w; c.height = hgt;
      const mk = (played) => {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt;
        const g = cv.getContext('2d');
        const ov = app.track ? app.track.analysis.overview : null;
        const bars = Math.floor(w / (3 * dpr));
        const grad = g.createLinearGradient(0, 0, w, 0);
        if (played) { grad.addColorStop(0, '#7ef0ff'); grad.addColorStop(0.5, '#9d8cff'); grad.addColorStop(1, '#ff7ad1'); }
        else { grad.addColorStop(0, 'rgba(255,255,255,.22)'); grad.addColorStop(1, 'rgba(255,255,255,.22)'); }
        g.fillStyle = grad;
        for (let i = 0; i < bars; i++) {
          let v = 0.12;
          if (ov) {
            const n = ov.length / 2;
            const a = Math.floor((i / bars) * n), b = Math.max(a + 1, Math.floor(((i + 1) / bars) * n));
            let pk = 0, rm = 0;
            for (let j = a; j < b; j++) { pk = Math.max(pk, ov[j * 2]); rm = Math.max(rm, ov[j * 2 + 1]); }
            v = Math.max(0.08, Math.min(1, rm * 1.6 * 0.7 + pk * 0.3));
          }
          const bh = Math.max(2 * dpr, v * hgt * 0.9);
          const x = i * 3 * dpr;
          g.globalAlpha = 1;
          g.beginPath();
          g.roundRect ? g.roundRect(x, (hgt - bh) / 2, 2 * dpr, bh, dpr) : g.rect(x, (hgt - bh) / 2, 2 * dpr, bh);
          g.fill();
        }
        return cv;
      };
      this.waveCache = { key, played: mk(true), rest: mk(false) };
    }
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, hgt);
    const p = app.track && app.audio.duration ? app.audio.position / app.audio.duration : 0;
    const px = Math.round(p * w);
    g.drawImage(this.waveCache.rest, 0, 0);
    if (px > 0) g.drawImage(this.waveCache.played, 0, 0, px, hgt, 0, 0, px, hgt);
    if (app.track) {
      // drop markers
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (const d of app.track.analysis.drops) g.fillRect(Math.round((d / app.audio.duration) * w), 0, Math.max(1, dpr), 3 * dpr);
    }
  }

  // ---------------------------------------------------------------- playlist
  buildPlaylist() {
    const app = this.app;
    const root = $('#playlistPanel');
    this.plCount = h('span', { class: 'count' });
    this.plBody = h('div', { class: 'panel-body' });
    root.append(
      h('div', { class: 'panel-head' }, h('h3', {}, '播放列表'), this.plCount, h('span', { class: 'spacer' }),
        h('button', { class: 'btn-icon', 'data-tip': '清空列表', html: icon('trash', 17), onclick: () => { if (confirm('清空播放列表？')) { app.audio.stop(); app.track = null; app.mode = 'idle'; app.playlist.clear(); app.emit('track', { item: null }); } } }),
        h('button', { class: 'btn-icon', 'data-tip': '关闭 (L)', html: icon('x', 18), onclick: () => this.togglePanel('playlist', false) })),
      this.plBody,
      h('div', { class: 'panel-foot' },
        h('button', { class: 'btn primary', html: icon('plus', 16) + '导入音乐', onclick: () => app.importFiles() }),
        h('button', { class: 'btn', html: icon('sparkles', 16) + '演示曲', onclick: () => app.playDemo() }))
    );
  }

  refreshPlaylist() {
    const app = this.app, pl = app.playlist;
    this.plCount.textContent = pl.items.length ? `${pl.items.length} 首` : '';
    this.plBody.innerHTML = '';
    if (!pl.items.length) {
      this.plBody.append(h('div', { class: 'pl-empty', html: `${icon('music', 30)}<p>列表为空</p><p>点击「导入音乐」或直接把音频文件<br>拖进窗口</p>` }));
      this.plBody.querySelector('.ic').style.margin = '0 auto 6px';
      return;
    }
    const playingId = app.track ? app.track.item.id : -1;
    pl.items.forEach((it, i) => {
      const on = it.id === playingId;
      const idx = on ? h('span', { class: 'idx' + (app.audio.playing ? '' : ' paused'), html: '<span class="mini-eq"><i></i><i></i><i></i></span>' }) : h('span', { class: 'idx' }, String(i + 1).padStart(2, '0'));
      const st = it.status === 'loading' ? h('span', { class: 'st' }, '解析中') : it.status === 'error' ? h('span', { class: 'st', style: { color: '#ff8a9a' }, title: it.error }, '失败') : h('span', { class: 'dur' }, it.duration ? fmtTime(it.duration) : '');
      const rm = h('button', { class: 'btn-icon rm', html: icon('x', 15), onclick: (e) => { e.stopPropagation(); app.removeItem(it.id); } });
      this.plBody.append(h('div', { class: 'pl-item' + (on ? ' on' : ''), onclick: () => app.playItem(it.id), title: it.path || it.name },
        idx, h('div', { class: 'nm' }, h('b', {}, it.title), h('span', {}, it.artist || (it.kind === 'demo' ? '内置' : it.name))), st, rm));
    });
  }

  // ---------------------------------------------------------------- scenes
  buildSceneStrip() {
    const app = this.app;
    const root = $('#sceneStrip');
    const seg = h('div', { class: 'seg' });
    for (const [v, l] of [['off', '手动切换'], ['music', '随音乐切换'], ['timer', '定时切换']]) seg.append(h('button', { dataset: { v }, onclick: () => app.set('scene.autoSwitch', v) }, l));
    this.autoSeg = seg;
    this.cards = h('div', { class: 'cards' });
    this.stripDesc = h('div', { class: 'strip-desc' });
    root.append(h('div', { class: 'strip-head' }, h('h3', {}, '视觉场景'), h('span', { class: 'spacer' }), seg,
      h('button', { class: 'btn-icon', html: icon('x', 18), onclick: () => this.togglePanel('scenes', false) })), this.cards, this.stripDesc);
    SCENES.forEach((s, i) => {
      const th = thumbFor(s.id);
      const card = h('div', { class: 'card', dataset: { id: s.id }, onclick: () => app.setScene(s.id), onmouseenter: () => { this.stripDesc.textContent = `${s.name} · ${s.desc}`; } },
        h('div', { class: 'thumb', style: { backgroundImage: th ? `url(${th})` : SCENE_GRADS[s.id] } }),
        h('div', { class: 'shade' }), h('span', { class: 'key' }, String(i + 1)),
        h('div', { class: 'lbl' }, h('b', {}, s.name), h('span', {}, s.en)));
      this.cards.append(card);
    });
    root.addEventListener('mouseleave', () => { const s = app.currentScene; this.stripDesc.textContent = `${s.name} · ${s.desc}`; });
  }

  refreshScene(scene) {
    scene = scene || this.app.currentScene;
    $('#sceneName').textContent = scene.name;
    $('#sceneEn').textContent = scene.en;
    for (const c of this.cards.children) c.classList.toggle('on', c.dataset.id === scene.id);
    this.stripDesc.textContent = `${scene.name} · ${scene.desc}`;
  }

  // ---------------------------------------------------------------- help
  buildHelp() {
    const m = $('#helpModal');
    const keys = [
      ['播放 / 暂停', 'Space'], ['快退 / 快进 5 秒', '← →'], ['音量', '↑ ↓'], ['上一首 / 下一首', '[ ]'],
      ['切换场景', '1 – 8'], ['下一个场景', 'N'], ['自动运镜 / 自由镜头', 'C'], ['重置镜头', 'R'],
      ['自由镜头旋转 / 缩放', 'W A S D / Q E'], ['全屏沉浸', 'F / F11'], ['隐藏界面', 'H'], ['截图', 'K'],
      ['播放列表', 'L'], ['参数面板', 'Tab'], ['场景面板', 'G'], ['导出视频', 'X'], ['静音', 'M'], ['性能信息', 'I']
    ];
    m.append(h('div', { class: 'dialog' }, h('h2', { html: icon('keyboard', 20) + '快捷键' }),
      h('div', { class: 'sub' }, '鼠标：左键拖动旋转 · 右键 / Shift 拖动平移 · 滚轮缩放 · 双击画面切换全屏'),
      h('div', { class: 'help-grid' }, ...keys.map(([a, b]) => h('div', {}, h('span', {}, a), h('kbd', {}, b)))),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => m.classList.remove('open') }, '知道了'))));
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
  }

  showHelp() { $('#helpModal').classList.add('open'); }

  // ---------------------------------------------------------------- panels
  togglePanel(name, force) {
    const want = force != null ? force : !this.open[name];
    this.open[name] = want;
    if (want && name === 'scenes') { /* scenes strip overlaps nothing */ }
    $('#playlistPanel').classList.toggle('open', this.open.playlist);
    $('#settingsPanel').classList.toggle('open', this.open.settings);
    $('#sceneStrip').classList.toggle('open', this.open.scenes);
    if (this.open.settings) this.settingsPanel.sync();
    this.btnList.classList.toggle('on', this.open.playlist);
    this.btnSettings.classList.toggle('on', this.open.settings);
    this.btnScenes.classList.toggle('on', this.open.scenes);
    this.poke();
  }

  toggleUI(force) {
    this.uiHidden = force != null ? force : !this.uiHidden;
    this.body.classList.toggle('ui-hidden', this.uiHidden);
    if (this.uiHidden) this.app.toast('界面已隐藏 · 按 H 恢复');
  }

  async toggleFullscreen() {
    try { this.fullscreen = await platform.toggleFullscreen(); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- toasts
  toast({ msg, error, action }) {
    const root = $('#toasts');
    const t = h('div', { class: 'toast' + (error ? ' err' : ''), html: icon(error ? 'info' : 'check', 16) }, h('span', {}, msg));
    if (action) t.append(h('button', { class: 'link', onclick: () => { action.run(); } }, action.label));
    root.append(t);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, error ? 5200 : 3200);
  }

  // ---------------------------------------------------------------- state refresh
  refreshTrack() {
    const app = this.app;
    const welcome = $('#welcome');
    const hasContent = !!app.track || app.mode === 'live' || !!app.loading;
    welcome.classList.toggle('hide', hasContent);
    this.trackEl.classList.toggle('loading', !!app.loading);
    if (app.loading) {
      const it = app.loading.item;
      this.title.textContent = it.title;
      this.sub.innerHTML = `<span>${app.loading.label || '准备中'}… ${Math.round(app.loading.progress * 100)}%</span>`;
      this.loadBar.firstChild.style.width = Math.round(app.loading.progress * 100) + '%';
      this.setCover(it);
      return;
    }
    if (app.mode === 'live') {
      this.title.textContent = app.liveKind === 'system' ? '系统声音' : '麦克风';
      this.sub.innerHTML = '<span class="tag live">LIVE</span><span>实时捕获中 · 点击播放键停止</span>';
      this.setCover(null, app.liveKind === 'system' ? 'monitor' : 'mic');
      this.btnPlay.innerHTML = icon('stop', 18);
      return;
    }
    const t = app.track;
    if (!t) {
      this.title.textContent = '未播放';
      this.sub.textContent = '导入音乐或播放演示曲';
      this.setCover(null);
    } else {
      this.title.textContent = t.item.title;
      const bpm = t.analysis.hasTempo ? `<span class="tag">${Math.round(t.analysis.bpm)} BPM</span>` : '';
      this.sub.innerHTML = `${bpm}<span>${t.item.artist || (t.item.kind === 'demo' ? '内置演示' : '')}</span>`;
      this.setCover(t.item);
    }
    this.btnPlay.innerHTML = icon(app.audio.playing ? 'pause' : 'play', 20);
    document.title = t ? `${t.item.title} · 音乐粒子宇宙` : '音乐粒子宇宙';
  }

  setCover(item, ic) {
    const c = this.cover;
    c.classList.toggle('has-img', !!(item && item.cover));
    const img = c.querySelector('img');
    if (item && item.cover) {
      if (!img) c.prepend(h('img', { src: item.cover, alt: '' }));
      else if (img.src !== item.cover) img.src = item.cover;
    } else if (img) img.remove();
    c.style.background = item ? (item.cover ? '#000' : hashGradient(item.title || '')) : '';
    const old = c.querySelector('.ic');
    if (old) old.remove();
    if (!item && ic) c.insertAdjacentHTML('afterbegin', icon(ic, 22));
  }

  syncToggles() {
    const s = this.app.settings;
    this.btnShuffle.classList.toggle('on', s.player.shuffle);
    this.btnRepeat.innerHTML = icon(s.player.repeat === 'one' ? 'repeat1' : 'repeat', 18);
    this.btnRepeat.classList.toggle('on', s.player.repeat !== 'off');
    this.btnRepeat.dataset.tip = { all: '列表循环', one: '单曲循环', off: '不循环' }[s.player.repeat];
    this.btnMute.innerHTML = icon(s.player.muted || s.player.volume === 0 ? 'mute' : 'volume', 18);
    this.btnCam.classList.toggle('on', s.camera.auto);
    $('#btnStats').classList.toggle('on', s.quality.showStats);
    this.hud.classList.toggle('on', s.quality.showStats);
    for (const b of this.autoSeg.children) b.classList.toggle('on', b.dataset.v === s.scene.autoSwitch);
  }

  // ---------------------------------------------------------------- per frame
  frame() {
    const app = this.app;
    const f = app.frame;
    const kick = Math.min(1, (f.kick || 0) * 0.9 + (f.drop || 0) * 0.3);
    this.body.style.setProperty('--kick', kick.toFixed(3));
    if (app.track && !app.loading) {
      this.tCur.textContent = fmtTime(app.audio.position);
      this.tDur.textContent = fmtTime(app.audio.duration);
    } else if (!app.loading) { this.tCur.textContent = '0:00'; this.tDur.textContent = '0:00'; }
    this._seekTick = (this._seekTick || 0) + 1;
    if (this._seekTick % 2 === 0) this.drawSeek();
    // cover equaliser
    if (f.active) {
      const bands = [f.bass, f.lowMid, f.mid, f.highMid, f.treble];
      this.eqBars.forEach((b, i) => { b.style.height = Math.round(15 + bands[i] * 85) + '%'; });
    }
    const variant = app.engine.label || '';
    if (variant !== this._variant) { this._variant = variant; $('#sceneVariant').textContent = variant; }
    // HUD
    if (app.settings.quality.showStats && (this._hudTick = (this._hudTick || 0) + 1) % 10 === 0) this.drawHud();
    // immersive idle
    const now = performance.now();
    const anyOpen = this.open.playlist || this.open.settings || this.open.scenes;
    const playing = (app.mode === 'track' && app.audio.playing) || app.mode === 'live';
    const idle = playing && !anyOpen && !this.hoverUI && now - this.lastMove > 3200 && !$('.modal.open');
    if (idle !== this.isIdle) { this.isIdle = idle; this.body.classList.toggle('idle', idle); }
  }

  drawHud() {
    const app = this.app, e = app.engine, q = app.quality;
    const fps = app.stats.fps;
    const cls = fps > 55 ? 'ok' : fps > 40 ? 'warn' : 'bad';
    const sp = app.frame.spectrum;
    let bars = '';
    for (let i = 0; i < 32; i++) bars += `<i style="height:${Math.round(8 + (sp[i * 4] || 0) * 92)}%"></i>`;
    this.hud.innerHTML = `<div><b class="${cls}">${fps.toFixed(0)} FPS</b> · ${e.stats.gpuMs != null ? 'GPU ' + e.stats.gpuMs.toFixed(1) + 'ms' : '帧 ' + (1000 / Math.max(1, fps)).toFixed(1) + 'ms'}</div>
<div>粒子 <b>${fmtCount(e.particles.count)}</b>${app.settings.quality.auto ? ' · 自动' : ''}</div>
<div>渲染 <b>${e.post.w}×${e.post.h}</b> → ${e.outW}×${e.outH}</div>
<div>${e.gpuPretty}</div>
<div>${app.track ? `BPM <b>${Math.round(app.track.analysis.bpm)}</b> · 小节 ${app.frame.bar + 1} · 强度 ${(app.frame.intensity * 100).toFixed(0)}%` : '—'}</div>
<div class="bars">${bars}</div>`;
    void q;
  }

  poke() {
    this.lastMove = performance.now();
    if (this.isIdle) { this.isIdle = false; this.body.classList.remove('idle'); }
  }

  // ---------------------------------------------------------------- events
  bindEvents() {
    const app = this.app;
    app.addEventListener('toast', (e) => this.toast(e.detail));
    app.addEventListener('frame', () => this.frame());
    app.addEventListener('track', () => { this.refreshTrack(); this.refreshPlaylist(); this.waveCache = null; });
    app.addEventListener('loading', () => { this.refreshTrack(); });
    app.addEventListener('state', () => { this.refreshTrack(); this.refreshPlaylist(); });
    app.addEventListener('playlist', () => this.refreshPlaylist());
    app.addEventListener('scene', (e) => this.refreshScene(e.detail.scene));
    app.addEventListener('settings', () => this.syncToggles());
    app.addEventListener('panel', (e) => this.togglePanel(e.detail.panel, e.detail.open));
    const lowFx = () => this.body.classList.toggle('low-fx', app.engine.tierIndex <= 1);
    app.engine.addEventListener('tier', lowFx);
    lowFx();
    platform.onFullscreen((v) => { this.fullscreen = v; $('#btnFull').innerHTML = icon(v ? 'exitFullscreen' : 'fullscreen', 18); });

    window.addEventListener('pointermove', () => this.poke(), { passive: true });
    window.addEventListener('pointerdown', () => this.poke(), { passive: true });
    for (const el of [$('#dock'), $('#topbar'), $('#playlistPanel'), $('#settingsPanel'), $('#sceneStrip')]) {
      el.addEventListener('pointerenter', () => { this.hoverUI = true; });
      el.addEventListener('pointerleave', () => { this.hoverUI = false; });
    }
    app.canvas.addEventListener('dblclick', () => this.toggleFullscreen());

    // drag & drop
    let depth = 0;
    window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { depth++; this.body.classList.add('dragging'); } });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) this.body.classList.remove('dragging'); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      this.body.classList.remove('dragging');
      const items = platform.fromFiles(e.dataTransfer.files);
      if (!items.length) { app.toast('没有可识别的音频文件', { error: true }); return; }
      app.addEntries(items, { play: !app.audio.playing });
    });

    // keyboard
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
      if ($('#exportModal.open')) { if (e.key === 'Escape') this.exportDialog.hide(); return; }
      if ($('#helpModal.open')) { if (e.key === 'Escape' || e.key === '?') $('#helpModal').classList.remove('open'); return; }
      this.poke();
      const k = e.key, code = e.code;
      const free = !app.settings.camera.auto;
      if (free && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(code)) { app.controls.key(code, true); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let handled = true;
      if (k === ' ') app.togglePlay();
      else if (k === 'ArrowLeft') app.seek(app.audio.position - (e.shiftKey ? 15 : 5));
      else if (k === 'ArrowRight') app.seek(app.audio.position + (e.shiftKey ? 15 : 5));
      else if (k === 'ArrowUp') { const v = Math.min(1, app.settings.player.volume + 0.05); app.set('player.volume', v); this.vol.value = v; this.vol.style.setProperty('--p', v * 100 + '%'); }
      else if (k === 'ArrowDown') { const v = Math.max(0, app.settings.player.volume - 0.05); app.set('player.volume', v); this.vol.value = v; this.vol.style.setProperty('--p', v * 100 + '%'); }
      else if (k === '[') app.prev();
      else if (k === ']') app.next(true);
      else if (/^[1-8]$/.test(k)) app.setScene(SCENES[Number(k) - 1].id);
      else if (code === 'KeyN') app.nextScene(1);
      else if (code === 'KeyC') app.set('camera.auto', !app.settings.camera.auto);
      else if (code === 'KeyR') app.resetCamera();
      else if (code === 'KeyF' || k === 'F11') this.toggleFullscreen();
      else if (code === 'KeyH') this.toggleUI();
      else if (code === 'KeyK') app.screenshot();
      else if (code === 'KeyL') this.togglePanel('playlist');
      else if (k === 'Tab') this.togglePanel('settings');
      else if (code === 'KeyG') this.togglePanel('scenes');
      else if (code === 'KeyX') this.exportDialog.show();
      else if (code === 'KeyM') app.set('player.muted', !app.settings.player.muted);
      else if (code === 'KeyI') app.set('quality.showStats', !app.settings.quality.showStats);
      else if (k === '?' || (k === '/' && e.shiftKey)) this.showHelp();
      else if (k === 'Escape') {
        if (this.open.playlist || this.open.settings || this.open.scenes) { this.open = { playlist: false, settings: false, scenes: false }; this.togglePanel('scenes', false); }
        else if (this.uiHidden) this.toggleUI(false);
        else if (this.fullscreen) platform.setFullscreen(false);
      } else handled = false;
      if (handled) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => app.controls.key(e.code, false));
    window.addEventListener('blur', () => { for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']) app.controls.key(c, false); });
  }
}
