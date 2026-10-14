// The application: screens, the fixed-step game loop (simulation + AI at 1–16× speed), saving,
// achievements, and the glue between the board view, the HUD, the menus, input and audio.

import { Game } from './sim/game.js';
import { Brain } from './ai/brain.js';
import { DT } from './sim/constants.js';
import { CARDS } from './data/cards.js';
import { LEVELS, nextLevelId } from './data/levels.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { stars, starText, starMet } from './sim/objectives.js';
import { BoardView } from './render/board.js';
import { flushSprites } from './render/cardface.js';
import { audio } from './audio/audio.js';
import { Hud } from './ui/hud.js';
import { Menus, isUnlocked } from './ui/menus.js';
import { Input } from './ui/input.js';
import { Tutorial } from './ui/tutorial.js';
import { h } from './ui/dom.js';
import { levelFromSpec } from './modes/expedition.js';
import { load, store, save, markSeen, addRecipe, addHint, recordLevel, unlockAch, aiMemory, saveAiMemory, saveRun, clearRun } from './ui/store.js';

const DEMO_LEVELS = ['1-2', '2-1', '3-1', '6-1', '4-1', '5-1'];

export class App {
  constructor(root) {
    load();
    this.root = root;
    this.canvas = root.querySelector('#board');
    const ui = root.querySelector('#ui');
    this.hudRoot = h('div.screen.passthrough');
    this.menuRoot = h('div.screen.passthrough');
    this.hintEl = h('div', { style: { position: 'absolute', pointerEvents: 'none', padding: '3px 10px', borderRadius: '12px', background: 'rgba(28,18,10,0.9)', border: '1px solid var(--gold)', fontSize: '13px', display: 'none', zIndex: 5 } });
    ui.append(this.hudRoot, this.menuRoot, this.hintEl);
    this.view = new BoardView(this.canvas);
    this.audio = audio;
    this.menus = new Menus(this, this.menuRoot);
    this.tutorial = new Tutorial(this);
    this.input = new Input(this, this.canvas);
    this.g = null;
    this.brain = null;
    this.hud = null;
    this.inGame = false;
    this.paused = false;
    this.speed = 1;
    this.aiOn = false;
    this.tookOver = false;
    this.acc = 0;
    this.selected = null;
    this.dialog = null;
    this.endT = 0;
    this.seenT = 0;
    this.saveT = 0;
    this.demoIdx = 0;
    const S = store().settings;
    this.view.lowFx = S.lowFx;
    this.view.showHand = S.showHand;
    this.applyAudio();
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => this.key(e));
    addEventListener('pointerdown', () => this.audio.unlock(), { capture: true });
    addEventListener('beforeunload', () => this.autosave(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosave(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => flushSprites());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.view.resize(window.innerWidth, window.innerHeight, dpr);
  }

  applyAudio() {
    const S = store().settings;
    this.audio.setVolumes({ master: S.master, music: S.music, sfx: S.sfx });
  }
  saveSettings() { save(); }
  hudToast(t) { if (this.hud) this.hud.toast(t); }

  // ------------------------------------------------------------------ screens
  show(name, opts) {
    if (this.inGame) this.leaveGame();
    this.ensureDemo();
    this.audio.setMood('title');
    switch (name) {
      case 'title': this.menus.title(); break;
      case 'campaign': this.menus.campaign(); break;
      case 'expedition': this.menus.expedition(opts); break;
      case 'challenges': this.menus.challenges(); break;
      case 'codex': this.menus.codex(); break;
      case 'achievements': this.menus.achievements(); break;
      case 'settings': this.menus.settings(); break;
      default: this.menus.title();
    }
  }

  brief(L) {
    if (this.inGame) this.leaveGame();
    this.ensureDemo();
    this.menus.brief(L);
  }
  briefSpec(spec) {
    const L = levelFromSpec(spec);
    this.menus.brief(L, { back: () => this.show(spec.mode === 'challenge' ? 'challenges' : 'expedition') });
  }
  startSpec(spec, opts) { this.startLevel(levelFromSpec(spec), opts); }

  /** the title screen plays a real game in the background, driven by the AI */
  ensureDemo() {
    if (this.demo && !this.demo.g.s.result) return;
    const id = DEMO_LEVELS[this.demoIdx++ % DEMO_LEVELS.length];
    const g = new Game(LEVELS[id], { seed: Math.floor(Math.random() * 1e6) });
    const brain = new Brain(g, { strategy: 'balanced' });
    this.demo = { g, brain };
    this.g = g;
    this.brain = brain;
    this.view.setGame(g);
    this.view.autoCam = true;
    this.view.showHand = store().settings.showHand;
    // skip the slow opening so the board is already alive
    for (let i = 0; i < 900 && !g.s.result; i++) { brain.update(DT); g.step(DT); g.drain(); }
    this.view.setGame(g);
  }

  // ------------------------------------------------------------------ game lifecycle
  startLevel(L, opts = {}) {
    this.leaveGame();
    this.demo = null;
    this.menus.clear();
    const S = store();
    const seed = opts.seed ?? (L.mode === 'expedition' || L.mode === 'endless' ? L.seed : Math.floor(Math.random() * 1e9));
    const g = opts.load ? Game.fromJSON(L, opts.load) : new Game(L, { seed, seen: new Set(S.seen) });
    if (opts.load) g.seen = new Set(S.seen);
    const brain = new Brain(g, { strategy: opts.strategy || S.settings.strategy, mem: aiMemory(), enabled: !!opts.ai });
    this.g = g;
    this.brain = brain;
    this.level = L;
    this.levelOpts = { ...opts, load: null };
    this.aiOn = !!opts.ai;
    this.tookOver = false;
    this.inGame = true;
    this.paused = false;
    this.speed = opts.ai ? Math.max(2, S.settings.speed || 2) : 1;
    this.acc = 0;
    this.endT = 0;
    this.selected = null;
    this.view.setGame(g);
    this.view.autoCam = S.settings.autoCam !== false;
    this.view.showHand = S.settings.showHand;
    this.view.followAI = !!S.settings.followAI;
    if (!this.hud) this.hud = new Hud(this, this.hudRoot);
    else this.hud.build();
    this.hud.setHidden(false);
    this.tutorial.skip();
    if (L.tutorial && S.settings.tutorial !== false && !opts.ai && !opts.load) this.tutorial.start(L.tutorial);
    markSeen(Object.values(g.s.cards).map((c) => c.d));
    this.audio.setMood('day', 0);
    if (!opts.load) {
      this.hud.banner(L.name, L.id.match(/^\d/) ? `第 ${L.id} 关` : L.sub || '');
      brain.note('目标', `新的土地：${L.name}。${L.objectives?.length ? '目标：' + L.objectives.length + ' 项。' : ''}先看看手里有什么。`, true);
    }
    S.stats.games++;
    save();
  }

  leaveGame() {
    if (!this.inGame) return;
    this.autosave(true);
    if (this.brain) saveAiMemory(this.brain.mem);
    this.inGame = false;
    this.tutorial.skip();
    if (this.hud) { this.hud.root.innerHTML = ''; this.hud = null; }
  }

  resumeRun() {
    const run = store().run;
    if (!run) return this.show('title');
    const L = levelFromSpec(run.spec, run.levelId);
    if (!L) { clearRun(); return this.show('title'); }
    try {
      this.startLevel(L, { load: run.game, ai: run.ai?.on, strategy: run.ai?.strategy });
      this.hud.toast('已读取存档：第 ' + this.g.s.day + ' 天');
    } catch (e) {
      console.error(e);
      clearRun();
      this.show('title');
    }
  }

  autosave(now = false) {
    if (!this.inGame || !this.g || this.g.s.result) return;
    saveRun({ levelId: this.level.id, spec: this.level.spec || null, name: this.level.name, game: this.g.toJSON(), ai: { on: this.aiOn, strategy: this.brain.strategyId }, t: Date.now() });
    if (now) save(true);
  }

  restart() {
    const L = this.level;
    this.menus.clear();
    this.startLevel(L, { ai: this.aiOn || this.levelOpts?.ai, strategy: this.brain?.strategyId });
  }

  quit() {
    this.menus.clear();
    this.leaveGame();
    this.show('title');
  }

  watchAI() {
    // the AI plays the campaign from the very first level, moving on by itself
    store().settings.autoNext = true;
    save();
    this.startLevel(LEVELS['1-1'], { ai: true, strategy: store().settings.strategy });
  }

  campaignAI() {
    const S = store();
    const ids = Object.keys(LEVELS);
    const id = ids.find((x) => !S.progress[x]?.won && (S.settings.unlockAll || isUnlocked(x, S))) || '1-1';
    S.settings.autoNext = true;
    save();
    this.startLevel(LEVELS[id], { ai: true });
  }

  // ------------------------------------------------------------------ controls
  setSpeed(s) {
    this.speed = s;
    this.paused = false;
    store().settings.speed = s;
    save();
    this.hud && this.hud.updateAiControls();
  }
  togglePause() {
    this.paused = !this.paused;
    this.hud && this.hud.updateAiControls();
  }
  setAI(on) {
    if (!this.brain) return;
    this.aiOn = on;
    this.brain.enabled = on;
    if (on) {
      this.tookOver = false;
      this.brain.execs = [];
      this.brain.thinkT = 0;
      this.brain.note('思考', '控制权回到我手里。先重新看一遍局势。', true);
      this.tutorial.skip();
      if (this.speed < 2) this.speed = 2;
    }
    this.hud && this.hud.updateAiControls();
    this.audio.play('click');
  }
  setStrategy(id) {
    this.brain.setStrategy(id);
    this.brain.note('思考', `改用「${this.brain.base.name}」策略：${this.brain.base.desc}`, true);
    store().settings.strategy = id;
    save();
    this.hud && this.hud.updateAiControls();
  }

  /** every manual change to the world passes through here (so the AI can step aside) */
  playerAct(fn) {
    if (this.aiOn && store().settings.takeover !== false) {
      this.aiOn = false;
      this.brain.enabled = false;
      this.tookOver = true;
      this.brain.note('思考', '玩家接管了控制权。我在旁边看着。', true);
      this.hud && this.hud.updateAiControls();
    }
    this.tutorialPoke = true;
    return fn();
  }

  clickCard(id, dbl = false) {
    if (!this.inGame) return;
    const g = this.g;
    if (!id) { this.selected = null; this.view.selected = null; this.hud.inspect(null); return; }
    const c = g.s.cards[id];
    if (!c) return;
    const d = CARDS[c.d];
    this.selected = id;
    this.view.selected = id;
    this.hud.inspect(id);
    if (dbl) { this.hud.openCardInfo(c.d); return; }
    if (c.ev) { this.hud.openEvent(c); return; }
    if (c.offers) { this.hud.openTrade(c); return; }
    if (d.market) { this.hud.openMarket(c); return; }
    if (d.open && ['bundle', 'scroll', 'tome', 'reveal'].includes(d.open.type)) {
      const r = this.playerAct(() => g.actOpen(id));
      if (!r.ok) this.hud.toast(r.why, 'info');
      else this.audio.play('open');
    }
  }

  dialogOpened(kind) { this.dialog = kind; }
  dialogClosed() { this.dialog = null; }

  openPause() {
    if (!this.inGame) return;
    this.pausedBefore = this.paused;
    this.paused = true;
    this.menus.pause();
  }
  closePause(keep = false) {
    this.menus.clear();
    if (!keep) this.paused = !!this.pausedBefore;
  }

  dropHint(label, p) {
    const el = this.hintEl;
    if (!label) { el.style.display = 'none'; return; }
    el.textContent = label;
    el.style.display = 'block';
    el.style.left = p.x + 18 + 'px';
    el.style.top = p.y + 14 + 'px';
  }

  key(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    this.audio.unlock();
    if (!this.inGame) {
      if (e.key === 'Escape') this.show('title');
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (this.hud.dialog) this.hud.closeDialog();
      else if (this.menuRoot.childNodes.length) this.closePause();
      else this.openPause();
      return;
    }
    if (this.menuRoot.childNodes.length) return;
    if (k === ' ') { e.preventDefault(); this.togglePause(); }
    else if (k >= '1' && k <= '5') this.setSpeed([1, 2, 4, 8, 16][+k - 1]);
    else if (k === 'a') this.setAI(!this.aiOn);
    else if (k === 't') this.hud.dialog === 'tech' ? this.hud.closeDialog() : this.hud.openTech();
    else if (k === 'c') this.hud.dialog === 'codex' ? this.hud.closeDialog() : this.hud.openCodex();
    else if (k === 'f') { this.view.autoCam = true; this.view.fitColony(); }
    else if (k === 'h') this.hud.setHidden(!this.hud.hidden);
  }

  // ------------------------------------------------------------------ loop
  frame(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    try { this.tick(dt); } catch (e) { console.error(e); }
    requestAnimationFrame((tt) => this.frame(tt));
  }

  tick(dt) {
    const g = this.g;
    if (!g) return;
    const demo = !this.inGame;
    const speed = demo ? 2 : this.speed;
    const running = demo || (!this.paused && !(this.hud && this.hud.dialog && !this.aiOn) && !this.menuRoot.childNodes.length);
    this.view.speed = speed;
    if (running && !g.s.result) {
      this.acc += dt * speed;
      let steps = 0;
      while (this.acc >= DT && steps < 80) {
        if (demo || this.aiOn) this.brain.update(DT);
        g.step(DT);
        this.acc -= DT;
        steps++;
        this.dispatch(g.drain(), demo);
        if (g.s.result) break;
      }
      if (steps >= 80) this.acc = 0;
    }
    if (demo && g.s.result) { this.demo = null; this.ensureDemo(); }
    this.view.update(dt);
    this.view.draw();
    if (!demo) {
      this.hud.update(dt);
      this.tutorial.update(dt);
      this.seenT += dt;
      if (this.seenT > 1.5) {
        this.seenT = 0;
        markSeen(Object.values(g.s.cards).map((c) => c.d));
      }
      const night = g.isNight();
      this.audio.setMood(night ? 'night' : 'day', Object.keys(g.s.battles).length ? 1 : 0);
      if (g.s.result) {
        this.endT += dt;
        if (this.endT > 1.8 && this.inGame && !this.ended) this.finish();
      } else this.ended = false;
    }
  }

  dispatch(evs, demo) {
    if (!evs.length) return;
    this.view.handLabel = this.brain && this.brain.current ? this.brain.current.label : '';
    this.view.onEvents(evs);
    if (demo) return;
    this.hud.onEvents(evs);
    this.audio.onEvents(evs, this.speed);
    const g = this.g;
    for (const e of evs) {
      if (e.type === 'discover') { addRecipe(e.r); if (!g.s.disc.includes(e.r)) g.s.disc.push(e.r); }
      else if (e.type === 'hint') addHint(e.r);
      else if (e.type === 'dawn') this.autosave();
      for (const a of ACHIEVEMENTS) if (a.on === 'event' && !store().ach[a.id] && safe(() => a.test(e, g))) this.award(a);
    }
  }

  award(a) {
    if (unlockAch(a.id)) {
      this.hud && this.hud.toast(`🏅 成就达成：${a.name}`, 'goal');
      this.audio.play('discover');
      (this.newAch ||= []).push(a);
    }
  }

  finish() {
    this.ended = true;
    const g = this.g, L = this.level, S = store();
    const won = g.s.result === 'win';
    const st = g.s.stats;
    const mode = L.mode || 'campaign';
    const r = {
      levelId: L.id, mode, won, stars: stars(g), days: g.s.day, maxPop: st.maxPop, deaths: st.deaths, kills: st.kills,
      crafted: Object.values(st.made).reduce((a, b) => a + b, 0), researched: st.researched, explored: st.explored, discovered: g.s.disc.length,
      coinsEarned: st.coinsEarned, actions: st.actions, reason: g.s.reason, outro: L.outro,
      aiOnly: (st.actions.player || 0) === 0 && (st.actions.ai || 0) > 0, noAi: (st.actions.ai || 0) === 0,
      next: mode === 'campaign' ? nextLevelId(L.id) : null, newAch: [],
      strategy: this.brain.base.name, starList: (L.stars || []).map((c) => ({ text: starText(c), met: won && starMet(g, c) })),
    };
    this.newAch = [];
    if (mode === 'campaign' || mode === 'challenge') recordLevel(L.id, { won, stars: r.stars, days: r.days, ai: r.aiOnly });
    S.stats.wins += won ? 1 : 0;
    S.stats.deaths += st.deaths;
    S.stats.kills += st.kills;
    S.stats.crafted += r.crafted;
    S.stats.days += g.s.day;
    if (won && r.aiOnly) S.stats.aiWins++;
    if (mode === 'endless') S.stats.endlessBest = Math.max(S.stats.endlessBest, g.s.day);
    if (mode === 'expedition' && won) S.stats.expeditions++;
    this.brain.mem.games = (this.brain.mem.games || 0) + 1;
    if (won) this.brain.mem.wins = (this.brain.mem.wins || 0) + 1;
    saveAiMemory(this.brain.mem);
    clearRun();
    const levels = Object.keys(LEVELS);
    for (const a of ACHIEVEMENTS) {
      if (S.ach[a.id]) continue;
      if (a.on === 'end' && safe(() => a.test(r))) this.award(a);
      if (a.on === 'meta' && safe(() => a.test(S, levels))) this.award(a);
    }
    r.newAch = this.newAch;
    save(true);
    this.paused = true;
    this.menus.results(r);
  }
}

function safe(f) {
  try { return !!f(); } catch { return false; }
}

