// Entry point: the App owns settings, menus and the running Game.

import { Game } from './game.js';
import { Input } from './input.js';
import { UIManager } from './ui/ui.js';
import { TitleScreen, PauseScreen, DeathScreen, SettingsScreen } from './ui/menus.js';
import { InventoryScreen } from './ui/inventory.js';
import { WorldStore, saveWorldMeta, listWorlds } from './save/storage.js';
import { installSystems } from './systems/index.js';
import { Renderer } from './render/renderer.js';
import { TitleScene } from './ui/titlescene.js';

export const VERSION = '1.0.0';

const DEFAULT_SETTINGS = {
  graphics: 'auto', renderDist: 8, fov: 75, sensitivity: 1, invertY: false, renderScale: 1, brightness: 0.5,
  viewBob: true, volume: 0.8, music: 0.5, difficulty: 2, showCoords: false, particles: true,
};

class App {
  constructor() {
    this.version = VERSION;
    this.canvas = document.getElementById('view');
    this.root = document.getElementById('ui');
    this.settings = this.loadSettings();
    this.input = new Input(this.canvas);
    this.ui = new UIManager(this, this.root);
    this.game = null;
    this.input.onKey = (e) => this.onKey(e);
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    this.canvas.addEventListener('click', () => { if (this.game && !this.ui.open && !this.input.locked) this.input.lock(); });
    window.addEventListener('beforeunload', () => { if (this.game) this.saveGame(true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.game) this.saveGame(); });
    this.bg = document.createElement('div');
    this.bg.className = 'menu-bg';
    this.root.prepend(this.bg);
  }

  loadSettings() {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('echowild.settings') || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
  }
  saveSettings() { try { localStorage.setItem('echowild.settings', JSON.stringify(this.settings)); } catch { /* ignore */ } }
  applySettings() {
    this.updateFx();
    if (this.game) { this.game.settings = this.settings; this.game.applySettings(); }
    if (this.titleScene) this.titleScene.applySettings(this.settings);
    this.input.sensitivity = this.settings.sensitivity;
    this.input.invertY = this.settings.invertY;
  }

  // one renderer (and GL context) for the title scene and every game
  getRenderer() {
    if (!this.renderer) { this.renderer = new Renderer(this.canvas); this.updateFx(); }
    return this.renderer;
  }
  // heavy interface effects (backdrop blur) are dropped on software rendering and the lowest quality
  updateFx() {
    const g = this.settings.graphics || 'auto';
    const low = g === 'low' || (g === 'auto' && this.renderer && this.renderer.softwareGL);
    document.body.classList.toggle('lowfx', !!low);
  }

  showTitle() {
    this.bg.style.display = '';
    this.bg.style.opacity = '1';
    this.ui.replace(new TitleScreen(this));
    if (!this.titleScene && !new URLSearchParams(location.search).has('notitle3d')) {
      const ts = this.titleScene = new TitleScene(this);
      ts.start().catch((e) => { console.warn('title scene unavailable:', e); if (this.titleScene === ts) this.stopTitleScene(); });
    }
  }
  onTitleReady() {
    this.bg.style.opacity = '0';
    setTimeout(() => { if (this.titleScene && this.titleScene.ready) this.bg.style.display = 'none'; }, 1100);
    document.body.classList.add('title-live');
  }
  stopTitleScene() {
    if (this.titleScene) { this.titleScene.stop(); this.titleScene = null; }
    document.body.classList.remove('title-live');
  }

  onScreensChanged() {
    const top = this.ui.open;
    if (this.game) {
      this.game.ui.open = top && top.capturesGame !== false ? top : null;
      this.game.ui.paused = !!(top && (top instanceof PauseScreen || top instanceof SettingsScreen || top.pauses));
      if (top) this.input.unlock();
      else if (!this.game.player.dead) this.input.lock();
    }
  }

  onLockChange(locked) {
    if (locked) return;
    // the browser released the mouse (Esc, alt-tab): pause, unless we released it ourselves
    clearTimeout(this._lockT);
    this._lockT = setTimeout(() => {
      if (!this.input.locked && this.game && !this.ui.open && !this.game.player.dead && this.game.ready) this.pause();
    }, 150);
  }

  onKey(e) {
    const top = this.ui.open;
    if (top) {
      if (top.onKey(e)) { e.preventDefault(); return true; }
      return false;
    }
    if (!this.game || !this.game.ready) return false;
    const g = this.game;
    if (e.code === 'KeyE') { this.ui.push(new InventoryScreen(g)); return true; }
    if (e.code === 'Escape') { this.pause(); return true; }
    if (e.code === 'KeyT' || e.code === 'Slash' || e.code === 'Enter') { if (g.openChat) { e.preventDefault(); g.openChat(e.code === 'Slash' ? '/' : ''); return true; } }
    if (e.code === 'KeyM' && g.openMap) { g.openMap(); return true; }
    if (e.code === 'KeyJ' && g.openCodex) { g.openCodex(); return true; }
    if (e.code === 'KeyL' && g.openJourney) { g.openJourney(); return true; }
    return false;
  }

  pause() { if (this.game && !this.ui.open) this.ui.push(new PauseScreen(this)); }
  resume() { this.ui.closeAll(); }

  // ---------------------------------------------------------------- worlds
  async createWorld({ name, seed, mode, difficulty }) {
    const meta = { id: `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, name, seed, mode, difficulty, created: Date.now(), lastPlayed: Date.now(), day: 1 };
    await saveWorldMeta(meta);
    this.startGame(meta, null);
  }

  async playWorld(meta) {
    const store = new WorldStore(meta.id);
    const state = await store.loadState();
    this.startGame(meta, state, store);
  }

  async startGame(meta, state, store = new WorldStore(meta.id)) {
    this.ui.closeAll();
    this.stopTitleScene();
    this.bg.style.display = 'none';
    const loading = document.createElement('div');
    loading.className = 'screen loading';
    loading.innerHTML = '<div class="ld-rings"><i></i><i></i><i></i></div><div class="title">回响荒野</div><div class="sub"></div><div class="bar"><i></i></div><div class="ld-status">正在编织世界…</div><div class="tip"></div>';
    loading.querySelector('.sub').textContent = meta.name;
    loading.querySelector('.tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.root.appendChild(loading);
    if (meta.difficulty !== undefined) this.settings.difficulty = meta.difficulty;
    const game = new Game({ canvas: this.canvas, uiRoot: this.root, settings: this.settings, input: this.input, meta, app: this, renderer: this.getRenderer() });
    this.game = game;
    window.__game = game;
    game.store = store;
    const keys = await store.savedKeys();
    game.chunks.storage = store;
    for (const [cx, cz] of keys) game.chunks.savedIndex.add(((cx & 0xffff) << 16) | (cz & 0xffff));
    installSystems(game, state);
    const bar = loading.querySelector('i');
    const prog = setInterval(() => { bar.style.width = `${Math.min(100, game.world.chunks.size / 30 * 100)}%`; }, 100);
    await game.start(state);
    clearInterval(prog);
    loading.classList.add('fade');
    setTimeout(() => loading.remove(), 600);
    this.autosave = setInterval(() => this.saveGame(), 30000);
    game.on('death', (cause) => { this.input.unlock(); setTimeout(() => this.ui.push(new DeathScreen(this, cause)), 900); });
    if (!new URLSearchParams(location.search).has('autoplay')) this.ui.push(new ClickToPlay(this));
    else this.onScreensChanged();
  }

  async saveGame(sync = false) {
    const g = this.game;
    if (!g || !g.ready || this.saving) return;
    this.saving = true;
    try {
      const jobs = [];
      for (const c of g.world.chunks.values()) {
        if (!c.ready) continue;
        const ents = g.entities.serializeChunk(c);
        if (c.modified || ents.length) {
          jobs.push(g.store.saveChunk(c, ents));
          g.chunks.savedIndex.add(c.key);
          c.modified = false;
          c.dirtySave = false;
        }
      }
      jobs.push(g.store.saveState(g.serializeState()));
      g.meta.lastPlayed = Date.now();
      g.meta.day = g.day;
      g.meta.shards = g.quest ? g.quest.count() : 0;
      jobs.push(saveWorldMeta(g.meta));
      if (!sync) await Promise.all(jobs);
    } catch (e) { console.error('save failed', e); } finally { this.saving = false; }
  }

  async quitToTitle() {
    await this.saveGame();
    clearInterval(this.autosave);
    if (this.game) { this.game.stop(); this.game = null; }
    this.input.unlock();
    this.ui.closeAll();
    this.showTitle();
  }

  respawn() {
    this.ui.closeAll();
    this.game.respawn();
  }
}

class ClickToPlay {
  constructor(app) { this.app = app; this.capturesGame = true; this.pauses = false; }
  build() {
    const el = document.createElement('div');
    el.className = 'screen click-to-play';
    el.innerHTML = '<div class="big">点击开始</div><div class="hint">WASD 移动 · 空格 跳跃 · 鼠标 视角 · 左键 挖掘 · 右键 放置 · E 背包</div>';
    el.addEventListener('click', () => { this.ui.pop(this); });
    return el;
  }
  onKey(e) { if (e.code === 'Escape') return true; return false; }
}

const TIPS = [
  '靠近工作台时，背包里的合成书会自动解锁更多配方。',
  '夜晚的流星会坠落在附近——陨坑里藏着星核与陨铁。',
  '回响罗盘可以穿透岩石感知矿石，还会指向最近的碎片神殿。',
  '导风扇向上吹的气流可以托起滑翔翼，造一座“风之电梯”吧。',
  '霜晶荒原的晶柱在夜里会发出星海般的微光。',
  '萤火沼泽的夜晚，萤火虫会在芦苇间起舞。',
  '逆重晶会向上“坠落”，可以用来搭建悬空的结构。',
  '音晶匣右键可以调音，用节拍器串起来就能演奏旋律。',
  '弹胶块能让你高高弹起，潜行时则会稳稳落地。',
  '幽光深层的巨型菌伞会照亮整个洞穴。',
];

async function boot() {
  const app = new App();
  window.__app = app;
  const q = new URLSearchParams(location.search);
  if (q.has('autoplay')) {
    // test / dev entry: jump straight into a world
    const seed = q.has('seed') ? Number(q.get('seed')) >>> 0 : 20261012;
    if (q.has('rd')) app.settings.renderDist = Number(q.get('rd'));
    if (q.has('gfx')) app.settings.graphics = q.get('gfx');
    const mode = q.get('mode') === 'creative' ? 'creative' : 'survival';
    const id = `dev-${seed}-${mode}`;
    const existing = q.has('fresh') ? null : (await listWorlds()).find((w) => w.id === id);
    const meta = existing || { id, name: `测试世界 ${seed}`, seed, mode, difficulty: 2, created: Date.now(), lastPlayed: Date.now(), day: 1 };
    if (!existing) await saveWorldMeta(meta);
    if (existing) await app.playWorld(existing); else await app.startGame(meta, null);
    return;
  }
  app.showTitle();
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('ui').innerHTML = `<div class="screen"><div class="panel"><h2>启动失败</h2><pre style="white-space:pre-wrap;max-width:80vw">${String(e.stack || e)}</pre></div></div>`;
});
