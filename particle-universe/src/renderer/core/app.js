// Application controller: playlist → decode → analyse → play, the render loop, camera modes,
// auto scene switching, live capture, screenshots and export orchestration.
import { Engine } from '../gfx/engine.js';
import { TIERS } from '../gfx/particles.js';
import { QualityManager, guessTier } from '../gfx/quality.js';
import { AudioEngine, analyzeBuffer } from '../audio/player.js';
import { TrackAnalysis, createFrame } from '../audio/track.js';
import { LiveAnalyzer } from '../audio/live.js';
import { renderDemoTrack } from '../audio/demo.js';
import { Director } from '../camera/director.js';
import { FreeControls } from '../camera/controls.js';
import { makePose, copyPose } from '../camera/camera.js';
import { SCENES, sceneById } from '../scenes/index.js';
import { loadSettings, saveSettings, setPath, getPath, resetSettings } from './settings.js';
import { Playlist } from './playlist.js';
import { readTags } from './metadata.js';
import { platform } from './platform.js';
import { collectEvents, liveEvents, makeEvents, SceneScheduler } from './scheduler.js';
import { Exporter } from '../export/exporter.js';

export class App extends EventTarget {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.settings = loadSettings();
    this.engine = new Engine(canvas, this.settings);
    this.audio = new AudioEngine();
    this.audio.setVolume(this.settings.player.volume);
    this.audio.setMuted(this.settings.player.muted);
    this.audio.latencyOffset = (this.settings.audio.latency || 0) / 1000;
    this.director = new Director();
    this.director.style = this.settings.camera.style;
    this.director.shakeAmt = this.settings.camera.shake;
    this.controls = new FreeControls(canvas);
    this.controls.autoRotate = this.settings.camera.autoRotate;
    this.controls.onInteract = () => this._userCamera();
    this.quality = new QualityManager(this.engine, this.settings);
    this.playlist = new Playlist();
    this.playlist.shuffle = this.settings.player.shuffle;
    this.playlist.repeat = this.settings.player.repeat;
    this.scheduler = new SceneScheduler(this.settings);
    this.exporter = new Exporter(this);
    this.frame = createFrame();
    this.events = makeEvents();
    this.mode = 'idle';
    this.track = null;
    this.live = null;
    this.loading = null;
    this.lastT = 0;
    this.pauseFade = 0;
    this.running = false;
    this.suspended = false;
    this.pose = makePose();
    this.lastFrameTs = 0;
    this.fpsAcc = { n: 0, t: 0 };
    this.stats = { fps: 0 };
    this._raf = this._raf.bind(this);
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  toast(msg, opts = {}) { this.emit('toast', { msg, ...opts }); }

  // ---- lifecycle ---------------------------------------------------------------------------
  async init() {
    const s = this.settings;
    const auto = s.quality.auto;
    const tier = auto ? this.quality.initialTier() : Math.min(s.quality.tier, TIERS.length - 1);
    this.engine.tierIndex = -1;
    this.engine.setTier(tier, { morph: false });
    this.resize();
    this.quality.baseScale = auto ? this.quality.defaultScale(this.engine.outW, this.engine.outH, tier) : s.quality.renderScale;
    this.engine.setRenderScale(this.quality.baseScale);
    window.addEventListener('resize', () => this.resize());
    this.engine.addEventListener('scene', (e) => this._onEngineScene(e.detail));
    this.engine.addEventListener('contextlost', () => this.toast('显卡上下文丢失，正在恢复…', { error: true }));
    this.engine.addEventListener('contextrestored', () => this.toast('图形已恢复'));
    this.quality.onChange = () => this.emit('quality');
    this.audio.addEventListener('ended', () => this._onEnded());
    this.audio.addEventListener('state', () => this.emit('state'));
    this.audio.addEventListener('live-ended', () => { this.stopLive(); });
    this.playlist.addEventListener('change', () => this.emit('playlist'));
    const first = s.scene.current && sceneById(s.scene.current) ? s.scene.current : 'nebula';
    this.engine.start(first);
    this.director.setScene(sceneById(first));
    this.controls.configure(this._controlConfig(sceneById(first)));
    this.controls.fromPose(this.director.update(0, this.frame, this.events));
    // restore saved playlist (Electron only stores paths)
    const saved = Playlist.saved();
    if (saved.length && platform.electron) {
      const ok = [];
      for (const it of saved) if (await platform.exists(it.path)) ok.push(it);
      if (ok.length) this.playlist.add(ok);
    }
    platform.onOpenFiles((items) => this.addEntries(items, { play: true }));
    const pending = await platform.pendingFiles();
    if (pending.length) this.addEntries(pending, { play: true });
    this.running = true;
    requestAnimationFrame(this._raf);
  }

  resize() {
    if (this.suspended) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    this.engine.setOutputSize(w, h);
    if (this.quality.baseScale) {
      const bs = this.settings.quality.auto ? this.quality.defaultScale(w, h, this.engine.tierIndex) : this.settings.quality.renderScale;
      this.quality.baseScale = bs;
      this.engine.setRenderScale(Math.min(this.engine.renderScale, bs) || bs);
    }
  }

  _controlConfig(scene) {
    const c = scene.camera;
    return { mode: c.mode === 'look' ? 'look' : 'orbit', minDist: c.minDist || 2, maxDist: c.maxDist || 200, target: c.target || [0, 0, 0] };
  }

  // ---- main loop ---------------------------------------------------------------------------
  _raf(ts) {
    if (!this.running) return;
    requestAnimationFrame(this._raf);
    if (this.suspended) return;
    const dt = this.lastFrameTs ? Math.min(0.1, (ts - this.lastFrameTs) / 1000) : 1 / 60;
    if (this.lastFrameTs) this.quality.update(ts - this.lastFrameTs);
    this.lastFrameTs = ts;
    this.fpsAcc.n++; this.fpsAcc.t += dt;
    if (this.fpsAcc.t >= 0.5) { this.stats.fps = this.fpsAcc.n / this.fpsAcc.t; this.fpsAcc.n = 0; this.fpsAcc.t = 0; }
    try {
      this.tick(dt);
    } catch (e) {
      console.error(e);
      if (!this._errShown) { this._errShown = true; this.toast('渲染出错：' + (e.message || e), { error: true }); }
    }
  }

  tick(dt) {
    const f = this.frame, ev = this.events;
    let analysis = null, t = 0;
    if (this.mode === 'track' && this.track) {
      analysis = this.track.analysis;
      t = this.audio.visualTime;
      analysis.sample(t, f);
      if (this.audio.playing) {
        collectEvents(analysis, this.lastT, t, ev);
        this.pauseFade = Math.min(1, this.pauseFade + dt * 3);
      } else {
        collectEvents(null, 0, 0, ev);
        this.pauseFade = Math.max(0, this.pauseFade - dt * 1.2);
      }
      if (this.pauseFade < 1) this._fadeFrame(f, this.pauseFade);
      this.lastT = t;
    } else if (this.mode === 'live' && this.live) {
      this.live.update(dt, f);
      liveEvents(this.live, ev);
    } else {
      f.active = false;
      collectEvents(null, 0, 0, ev);
    }
    // automatic scene changes
    const playing = (this.mode === 'track' && this.audio.playing) || this.mode === 'live';
    const next = this.scheduler.update(dt, { analysis, t, events: ev, frame: f, currentId: this.engine.scene.id, busy: !!this.engine.trans, playing });
    if (next) this.setScene(next, { auto: true });
    // camera
    const pose = this.settings.camera.auto ? this.director.update(dt, f, ev) : this.controls.update(dt);
    copyPose(pose, this.pose);
    this.engine.frame(dt, f, ev, pose);
    this.emit('frame', { dt, t });
  }

  _fadeFrame(f, k) {
    const keys = ['rms', 'sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'kick', 'snare', 'hat', 'onset', 'drop', 'build', 'flux'];
    for (const key of keys) f[key] *= k;
    f.intensity *= 0.4 + 0.6 * k;
    for (let i = 0; i < f.spectrum.length; i++) f.spectrum[i] *= 0.3 + 0.7 * k;
    if (k < 0.02) f.active = false;
  }

  exportPose(dt, f, ev, director) {
    if (this.settings.camera.auto) return director.update(dt, f, ev);
    return this.controls.update(dt);
  }

  // ---- scenes / camera ------------------------------------------------------------------------
  setScene(id, { auto = false } = {}) {
    const scene = sceneById(id);
    if (!scene) return;
    if (this.engine.scene && this.engine.scene.id === id && !this.engine.trans) return;
    this.engine.switchScene(id);
    this.scheduler.note(id);
    if (!auto) { this.settings.scene.current = id; saveSettings(this.settings); }
  }

  _onEngineScene({ scene, duration, intro }) {
    if (!intro) {
      this.director.setScene(scene, { blend: Math.max(1.5, duration * 0.9), from: this.pose });
      this.controls.configure(this._controlConfig(scene));
      if (!this.settings.camera.auto) {
        const p = this.director.update(0, this.frame, this.events);
        this.controls.fromPose(p);
      }
    }
    this.settings.scene.current = scene.id;
    saveSettings(this.settings);
    this.emit('scene', { scene });
  }

  nextScene(dir = 1) {
    const i = SCENES.findIndex((s) => s.id === (this.engine.trans ? this.engine.trans.to.id : this.engine.scene.id));
    this.setScene(SCENES[(i + dir + SCENES.length) % SCENES.length].id);
  }

  _userCamera() {
    if (this.settings.camera.auto) {
      this.controls.fromPose(this.pose);
      this.settings.camera.auto = false;
      saveSettings(this.settings);
      this.emit('settings', { path: 'camera.auto' });
      this.toast('已切换到自由镜头 · 按 C 恢复自动运镜');
    }
  }

  setAutoCamera(on) {
    this.settings.camera.auto = on;
    if (on) this.director.setScene(this.engine.scene, { blend: 2.5, from: this.pose });
    else this.controls.fromPose(this.pose);
    saveSettings(this.settings);
    this.emit('settings', { path: 'camera.auto' });
  }

  resetCamera() {
    this.director.setScene(this.engine.scene, { blend: 1.5, from: this.pose });
    const p = this.director.update(0, this.frame, this.events);
    this.controls.fromPose(p);
  }

  // ---- settings ------------------------------------------------------------------------------
  set(path, value) {
    setPath(this.settings, path, value);
    const [sec, key] = path.split('.');
    if (path === 'player.volume') this.audio.setVolume(value);
    else if (path === 'player.muted') this.audio.setMuted(value);
    else if (path === 'audio.latency') this.audio.latencyOffset = value / 1000;
    else if (path === 'camera.style') this.director.style = value;
    else if (path === 'camera.shake') this.director.shakeAmt = value;
    else if (path === 'camera.autoRotate') this.controls.autoRotate = value;
    else if (path === 'camera.auto') this.setAutoCamera(value);
    else if (path === 'color.palette') this.engine.refreshPalette();
    else if (path === 'player.shuffle') { this.playlist.shuffle = value; this.playlist._reshuffle(); }
    else if (path === 'player.repeat') this.playlist.repeat = value;
    else if (path === 'quality.auto') {
      if (value) { this.quality.restartCalibration(); this.quality.baseScale = this.quality.defaultScale(this.engine.outW, this.engine.outH, this.engine.tierIndex); }
    } else if (path === 'quality.tier') {
      this.settings.quality.auto = false;
      this.engine.setTier(value);
    } else if (path === 'quality.renderScale') {
      this.settings.quality.auto = false;
      this.quality.baseScale = value;
      this.engine.setRenderScale(value);
    } else if (path === 'quality.maxTier') {
      if (this.engine.tierIndex > value) this.engine.setTier(value);
    }
    void sec; void key;
    saveSettings(this.settings);
    this.emit('settings', { path });
  }

  get(path) { return getPath(this.settings, path); }

  setSceneParam(sceneId, key, value) {
    if (!this.settings.sceneParams[sceneId]) this.settings.sceneParams[sceneId] = {};
    this.settings.sceneParams[sceneId][key] = value;
    saveSettings(this.settings);
  }

  resetSection(section) {
    if (section === 'scene') { this.settings.sceneParams[this.engine.scene.id] = {}; }
    else resetSettings(this.settings, section);
    // re-apply side effects
    for (const p of ['player.volume', 'camera.style', 'camera.shake', 'camera.autoRotate', 'color.palette']) this.set(p, getPath(this.settings, p));
    this.audio.latencyOffset = (this.settings.audio.latency || 0) / 1000;
    saveSettings(this.settings);
    this.emit('settings', { path: section + '.*' });
  }

  // ---- playlist / playback ---------------------------------------------------------------------
  async importFiles() {
    const items = await platform.pickAudio();
    if (items.length) this.addEntries(items, { play: this.mode !== 'track' || !this.audio.playing });
  }

  addEntries(entries, { play = false } = {}) {
    const added = this.playlist.add(entries);
    if (added.length) this.toast(`已添加 ${added.length} 首曲目`);
    if (play && added.length) this.playItem(added[0].id);
    return added;
  }

  async playDemo() {
    let demo = this.playlist.items.find((x) => x.kind === 'demo');
    if (!demo) [demo] = this.playlist.add([{ name: 'Aurora.demo', kind: 'demo', title: '极光 Aurora（内置演示）', artist: '音乐粒子宇宙 · 程序化合成' }], { front: true });
    await this.playItem(demo.id);
  }

  async _prepare(item, onProgress) {
    if (item.analysis && item.buffer) return item;
    if (item.kind === 'demo') {
      onProgress && onProgress(0.05, '正在合成演示曲目');
      item.buffer = await renderDemoTrack(this.audio.sampleRate);
    } else {
      onProgress && onProgress(0.02, '读取文件');
      const bytes = await platform.read(item);
      try {
        const tags = readTags(bytes);
        if (tags.title) item.title = tags.title;
        if (tags.artist) item.artist = tags.artist;
        if (tags.cover && !item.cover) item.cover = URL.createObjectURL(tags.cover);
      } catch { /* ignore tag errors */ }
      onProgress && onProgress(0.06, '解码音频');
      try {
        item.buffer = await this.audio.decode(bytes);
      } catch {
        throw new Error('无法解码该音频格式');
      }
    }
    item.duration = item.buffer.duration;
    if (item.duration > 3600 * 1.5) throw new Error('音频过长（超过 90 分钟）');
    onProgress && onProgress(0.1, '分析节奏与频谱');
    const raw = await analyzeBuffer(item.buffer, (p) => onProgress && onProgress(0.1 + p * 0.9, '分析节奏与频谱'));
    item.analysis = new TrackAnalysis(raw);
    item.bpm = Math.round(raw.bpm);
    return item;
  }

  _release(keep) {
    for (const it of this.playlist.items) {
      if (!keep.includes(it) && (it.buffer || it.analysis)) { it.buffer = null; it.analysis = null; if (it.status === 'ready') it.status = 'idle'; }
    }
  }

  async playItem(id) {
    const item = this.playlist.items.find((x) => x.id === id);
    if (!item) return;
    this.stopLive();
    const token = Symbol('load');
    this.loading = { item, token, progress: 0, label: '' };
    item.status = 'loading';
    this.emit('loading', this.loading);
    this.emit('playlist');
    try {
      await this.audio.resume();
      await this._prepare(item, (p, label) => {
        if (this.loading && this.loading.token === token) { this.loading.progress = p; this.loading.label = label; this.emit('loading', this.loading); }
      });
      if (!this.loading || this.loading.token !== token) return;
      item.status = 'ready';
      this.playlist.index = this.playlist.indexOf(item.id);
      this.audio.setBuffer(item.buffer);
      this.track = { item, analysis: item.analysis, buffer: item.buffer };
      this.mode = 'track';
      this.lastT = 0;
      this.loading = null;
      this.scheduler.reset();
      await this.audio.play(0);
      this.pauseFade = 0;
      platform.preventSleep(true);
      this._release([item]);
      this.emit('track', { item });
      this.emit('loading', null);
      this.emit('playlist');
    } catch (e) {
      console.error(e);
      item.status = 'error';
      item.error = e.message || String(e);
      if (this.loading && this.loading.token === token) this.loading = null;
      this.emit('loading', null);
      this.emit('playlist');
      this.toast(`「${item.title}」${item.error}`, { error: true });
    }
  }

  togglePlay() {
    if (this.mode === 'live') { this.stopLive(); return; }
    if (!this.track) {
      if (this.playlist.items.length) this.playItem(this.playlist.items[Math.max(0, this.playlist.index)].id);
      else this.playDemo();
      return;
    }
    this.audio.toggle();
    platform.preventSleep(!this.audio.playing);
  }

  next(manual = true) {
    const i = this.playlist.nextIndex(manual);
    if (i >= 0) this.playItem(this.playlist.items[i].id);
  }

  prev() {
    if (this.track && this.audio.position > 4) { this.audio.seek(0); return; }
    const i = this.playlist.prevIndex();
    if (i >= 0) this.playItem(this.playlist.items[i].id);
  }

  seek(t) {
    if (!this.track) return;
    this.audio.seek(t);
    this.lastT = t;
    this.scheduler.armed = -1;
  }

  _onEnded() {
    this.emit('state');
    const i = this.playlist.nextIndex(false);
    if (i >= 0) this.playItem(this.playlist.items[i].id);
    else platform.preventSleep(false);
  }

  removeItem(id) {
    const cur = this.track && this.track.item.id === id;
    this.playlist.remove(id);
    if (cur) { this.audio.stop(); this.track = null; this.mode = 'idle'; this.emit('track', { item: null }); }
  }

  // ---- live capture --------------------------------------------------------------------------
  async startLive(kind) {
    try {
      this.audio.pause();
      const live = await this.audio.startLive(kind);
      this.live = new LiveAnalyzer(live.analyser, this.audio.sampleRate);
      this.mode = 'live';
      this.liveKind = kind;
      this.emit('track', { live: kind });
      this.toast(kind === 'system' ? '正在捕获系统声音 · 播放任意音乐即可驱动粒子' : '正在使用麦克风输入');
    } catch (e) {
      console.warn(e);
      this.toast(kind === 'system' ? '无法捕获系统声音：' + (e.message || e.name) : '无法访问麦克风：' + (e.message || e.name), { error: true });
    }
  }

  stopLive() {
    if (!this.live && this.mode !== 'live') return;
    this.audio.stopLive();
    this.live = null;
    this.mode = this.track ? 'track' : 'idle';
    this.emit('track', { item: this.track ? this.track.item : null });
  }

  // ---- screenshot ------------------------------------------------------------------------------
  async screenshot() {
    this.tick(0.0001);
    const blob = await this.engine.screenshot();
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `粒子宇宙_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
    const p = await platform.saveImage(blob, name);
    this.toast(p ? '截图已保存' : '截图已下载', p ? { action: platform.canReveal ? { label: '打开位置', run: () => platform.showItem(p) } : null } : {});
  }

  // ---- export support --------------------------------------------------------------------------
  suspendForExport() {
    this.suspended = true;
    const wasPlaying = this.audio.playing;
    this.audio.pause();
    return {
      wasPlaying, position: this.audio.position, sceneId: this.engine.trans ? this.engine.trans.to.id : this.engine.scene.id,
      tier: this.engine.tierIndex, scale: this.engine.renderScale, pose: copyPose(this.pose), stress: this.engine.stress,
      rng: this.engine.rng
    };
  }

  resumeAfterExport(s) {
    this.suspended = false;
    this.engine.stress = 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.engine.setOutputSize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
    this.engine.setRenderScale(s.scale);
    this.engine.setTier(s.tier, { morph: false });
    this.engine.rng = s.rng;
    this.engine.start(s.sceneId, { intro: false });
    this.director.reset(Date.now() & 0xffff);
    this.director.setScene(sceneById(s.sceneId), { blend: 0.01, from: s.pose });
    this.lastFrameTs = 0;
    this.lastT = s.position;
    this.quality.cooldown = 4;
  }

  get currentScene() { return this.engine.trans ? this.engine.trans.to : this.engine.scene || sceneById(this.settings.scene.current); }
  get gpuTierGuess() { return guessTier(this.engine.gpu); }
}
