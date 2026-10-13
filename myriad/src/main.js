// Entry point: build the game controller and the interface, wire keyboard shortcuts and sound,
// and show the title screen (with a living demo world turning slowly behind it).
//   URL options: ?seed=…&preset=…&start=…&size=…&mode=…&autostart=1  start a world directly

import { Game } from './ui/game.js';
import { buildHUD } from './ui/hud.js';
import { buildSide } from './ui/side.js';
import { buildModals } from './ui/modals.js';
import { showStart } from './ui/start.js';
import { AudioEngine } from './audio/audio.js';
import { getLocal, setLocal } from './ui/storage.js';
import { icon } from './ui/icons.js';
import { h } from './ui/dom.js';
import { OVERLAYS } from './render/overlay.js';

const root = document.getElementById('app');
const game = new Game(root);
const ui = { designs: getLocal('designs', []) };
buildModals(game, ui);
buildHUD(game, ui);
buildSide(game, ui);

ui.toast = (text) => game.emit('toast', { text, imp: 1, quick: true });
ui.loading = (msg, fn) => {
  const el = h('div.modal-back', { style: { background: 'rgba(3,4,10,0.75)' } }, h('div', { style: { fontFamily: 'var(--serif)', fontSize: '22px', color: 'var(--gold2)', letterSpacing: '4px' }, text: msg }));
  document.body.append(el);
  setTimeout(() => {
    try { fn(); } catch (e) { console.error(e); alert('出错了：' + e.message); }
    el.remove();
  }, 40);
};
ui.showStart = () => {
  game.setDirector(false);
  if (!game.world || !game.world.demo) startDemo();
  showStart(game, ui);
};
ui.afterNewWorld = () => {
  ui.startScreen?.remove();
  game.setTool('inspect');
  game.setDirector(false);
  ui.setOverlay('none');
  ui.side.open('chronicle');
  ui.toast('世界诞生了。左侧是你的神力；右键拖动平移，滚轮缩放；按 ? 查看帮助。');
};

// ---- sound
const audio = new AudioEngine();
ui.audio = audio;
audio.enabled = game.settings.sound;
audio.volume = game.settings.volume;
ui.setSound = (on) => {
  game.settings.sound = on;
  setLocal('settings', game.settings);
  audio.setEnabled(on);
  if (ui.soundBtn) ui.soundBtn.innerHTML = icon(on ? 'sound' : 'mute', 19);
};
ui.toggleSound = () => ui.setSound(!game.settings.sound);
const wake = () => { if (game.settings.sound) audio.start(); };
window.addEventListener('pointerdown', wake, { once: true });
window.addEventListener('keydown', wake, { once: true });
game.on('sound', (ev) => audio.play(ev));
game.on('frame', () => {
  const w = game.world;
  if (!w) return;
  const era = w.nations.reduce((m, n) => (n.alive ? Math.max(m, n.era) : m), 0);
  audio.update(era, game.speed, !document.hidden);
});

// ---- keyboard
game.on('key', (e) => {
  if (document.querySelector('.modal-back')) {
    if (e.key === 'Escape') ui.modals.close();
    return;
  }
  if (ui.startScreen && ui.startScreen.isConnected) return;
  const k = e.key;
  if (e.code === 'Space') { e.preventDefault(); game.togglePause(); return; }
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 's') { e.preventDefault(); ui.modals.saves(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k >= '1' && k <= '6') { game.setSpeed(Number(k)); return; }
  if (k === '0' || k === '`') { game.setSpeed(0); return; }
  if (k === '.') { game.setSpeed(0); game.stepOnce(); return; }
  if (k === 'Escape') { game.setTool('inspect'); game.select(null); game.R.cam.follow = null; return; }
  if (k === '?' || k === '/') { ui.modals.help(); return; }
  if (k === 'Tab') { e.preventDefault(); ui.side.toggle(); return; }
  if (k === ']') { game.brush.r = Math.min(16, game.brush.r + 1); ui.renderToolGrid(); return; }
  if (k === '[') { game.brush.r = Math.max(1, game.brush.r - 1); ui.renderToolGrid(); return; }
  const lk = k.toLowerCase();
  if (lk === 'd') { game.setDirector(!game.director); return; }
  if (lk === 't') { ui.modals.timeline(); return; }
  if (lk === 'f' && game.selection) { game.follow(game.selection); return; }
  if (lk === 'v') {
    const i = OVERLAYS.findIndex((o) => o.id === game.R.opts.overlay);
    ui.setOverlay(OVERLAYS[(i + (e.shiftKey ? OVERLAYS.length - 1 : 1)) % OVERLAYS.length].id);
    return;
  }
  if (lk === 'n') { ui.setOverlay('none'); return; }
  if (lk === 'm') { ui.modals.climate(); return; }
  if (k === 'Home' || lk === 'h') { game.R.cam.fit(game.world.W, game.world.H); return; }
});

// ---- the demo world behind the title screen
function startDemo() {
  const w = game.newWorld({ seed: 'demo-' + Math.floor(Math.random() * 1000), preset: 'continents', start: 'tribes', size: 'small', name: '序章' });
  w.demo = true;
  game.setSpeed(3);
  game.R.opts.labels = false;
  setTimeout(() => { if (game.world === w) game.setDirector(true); }, 1500);
}

game.on('world', (w) => { game.R.opts.labels = w.demo ? false : game.settings.labels; });

// ---- go
const params = new URLSearchParams(location.search);
if (params.get('autostart')) {
  game.newWorld({
    seed: params.get('seed') || '1', preset: params.get('preset') || 'continents', start: params.get('start') || 'tribes',
    size: params.get('size') || 'medium', mode: params.get('mode') || 'sandbox', name: `测试 · ${params.get('seed') || '1'}`,
  });
  game.setSpeed(Number(params.get('speed') ?? 0));
  ui.afterNewWorld();
} else {
  ui.showStart();
}

// handle for tests and the curious
window.__myriad = { game, ui };
