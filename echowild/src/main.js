// Entry point.
import { Game } from './game.js';
import { Input } from './input.js';

const DEFAULT_SETTINGS = {
  renderDist: 8, fov: 75, sensitivity: 1, invertY: false, renderScale: 1, brightness: 0.5,
  viewBob: true, volume: 0.8, music: 0.5, difficulty: 2, showCoords: false,
};

const canvas = document.getElementById('view');
const ui = document.getElementById('ui');

async function boot() {
  const q = new URLSearchParams(location.search);
  const seed = q.has('seed') ? Number(q.get('seed')) >>> 0 : 20261012;
  const mode = q.get('mode') === 'creative' ? 'creative' : 'survival';
  const settings = { ...DEFAULT_SETTINGS };
  if (q.has('rd')) settings.renderDist = Number(q.get('rd'));
  const input = new Input(canvas);
  const loading = document.createElement('div');
  loading.className = 'screen loading';
  loading.innerHTML = '<div class="title">回响荒野</div><div class="bar"><i></i></div><div class="tip">正在编织世界……</div>';
  ui.appendChild(loading);
  const game = new Game({ canvas, uiRoot: ui, settings, input, meta: { id: 'dev', name: '开发世界', seed, mode } });
  window.__game = game;
  const bar = loading.querySelector('i');
  const prog = setInterval(() => { bar.style.width = `${Math.min(100, game.world.chunks.size / 25 * 100)}%`; }, 100);
  await game.start(null);
  clearInterval(prog);
  loading.remove();
  const ctp = document.createElement('div');
  ctp.className = 'screen click-to-play';
  ctp.innerHTML = '<div class="big">点击开始</div><div class="hint">WASD 移动 · 空格 跳跃 · 鼠标 视角 · 左键 挖掘 · 右键 放置</div>';
  ui.appendChild(ctp);
  ctp.addEventListener('click', () => input.lock());
  input.onLockChange = (locked) => { ctp.style.display = locked ? 'none' : ''; };
  if (q.has('autoplay')) ctp.style.display = 'none';
}

boot().catch((e) => {
  console.error(e);
  ui.innerHTML = `<div class="screen"><div class="panel"><h2>启动失败</h2><pre>${String(e.stack || e)}</pre></div></div>`;
});
