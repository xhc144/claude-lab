// XHC144 · 0 → ∞ — entry point. Wires the particle universe, the scroll story, the instruments,
// the HUD and the hidden things together.
import 'katex/dist/katex.min.css';
import './styles/main.css';

import { env } from './core/env.js';
import { bus } from './core/bus.js';
import { audio } from './core/audio.js';
import { onFrame, startLoop, clock } from './core/loop.js';
import { initScroll, scrollState } from './core/scroll.js';
import { renderTex, tex } from './core/tex.js';
import { createUniverse } from './universe/universe.js';
import { initCursor, pointer } from './ui/cursor.js';
import { initEggs, unlock } from './ui/eggs.js';
import { initHud } from './ui/hud.js';
import { initTerminal, monsterOrder } from './ui/terminal.js';
import { initLab } from './ui/lab.js';
import { initHotspots, hotspotState } from './ui/hotspots.js';
import { initScreensaver } from './ui/screensaver.js';
import { initHero, playHeroIntro } from './sections/hero.js';
import { initDim0 } from './sections/dim0.js';
import { initDim1 } from './sections/dim1.js';
import { initDim3 } from './sections/dim3.js';
import { initDimN } from './sections/dimn.js';
import { initArchive } from './sections/archive.js';
import { initDimInf } from './sections/diminf.js';
import { runBoot } from './sections/boot.js';
import { mountInstruments } from './instruments/index.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function fxBig(html, caption, cls = '') {
  const layer = document.getElementById('fx-layer');
  const el = document.createElement('div');
  el.className = 'fx-big ' + cls;
  el.innerHTML = `${html}${caption ? `<p>${caption}</p>` : ''}`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  for (const el of document.querySelectorAll('.reveal')) {
    if (!el.closest('#hero')) io.observe(el);
  }
  // stagger siblings in grids
  for (const grid of document.querySelectorAll('.ins-grid, .basis, .repo-grid, .own-grid')) {
    [...grid.children].forEach((c, i) => c.style.setProperty('--i', i));
  }
  return io;
}

function initKeys() {
  let buf = [];
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { bus.emit('escape'); return; }
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (document.body.classList.contains('is-booting')) return;
    if (e.key === '/' || e.key === '`') { e.preventDefault(); bus.emit('terminal'); return; }
    buf.push(e.key.toLowerCase());
    buf = buf.slice(-12);
    const s = buf.join('');
    if (KONAMI.every((k, i) => buf[buf.length - KONAMI.length + i] === k)) { buf = []; bus.emit('fx-monster'); unlock('konami', { message: '↑↑↓↓←→←→BA：魔群 𝕄 的阶，最大的散在单群。' }); }
    else if (s.endsWith('144')) { buf = []; bus.emit('fx-144'); unlock('f144', { message: `${tex('144 = F_{12} = 12^2')}：斐波那契数列中除 0 和 1 之外唯一的完全平方数（J. H. E. Cohn, 1964）。` }); }
    else if (s.endsWith('euler')) { buf = []; bus.emit('fx-euler'); unlock('euler', { message: `${tex('e^{i\\pi}+1=0')}：0、1、e、i、π 同时出现在一个等式里。` }); }
  });
}

function initConsoleEgg() {
  const art = [
    '%c',
    '   ██╗  ██╗██╗  ██╗ ██████╗ ██╗██╗  ██╗██╗  ██╗',
    '   ╚██╗██╔╝██║  ██║██╔════╝███║██║  ██║██║  ██║',
    '    ╚███╔╝ ███████║██║     ╚██║███████║███████║',
    '    ██╔██╗ ██╔══██║██║      ██║╚════██║╚════██║',
    '   ██╔╝ ██╗██║  ██║╚██████╗ ██║     ██║     ██║',
    '   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝     ╚═╝   0 → ∞',
  ].join('\n');
  console.log(art, 'color:#ff5b1f;font-family:monospace');
  console.log('%c你好，读源码的人。所有画面都在你的浏览器里实时计算。在这里输入 qiuzhen() 解锁一个彩蛋。', 'color:#4fe3ff');
  window.qiuzhen = () => { unlock('console', { message: '你在控制台里找到了这条留言。求真，继续前进。' }); return '求真 · 继续前进'; };
}

async function main() {
  const canvas = document.getElementById('universe');
  const universe = createUniverse(canvas, { count: env.particles, quality: env.quality, pixelRatio: env.pixelRatio });
  if (!universe) document.body.classList.add('no-webgl');
  window.__universe = universe;

  renderTex();
  initCursor();
  initEggs();
  initHud({ particles: universe ? universe.count : 0 });
  initTerminal();
  initLab();
  initHotspots(universe);
  initHero();
  initDim0(universe);
  initDim1();
  initDim3(universe);
  initDimN();
  initArchive();
  initDimInf();
  renderTex();
  mountInstruments();
  initKeys();
  initConsoleEgg();
  initScreensaver({ isBusy: () => document.body.classList.contains('is-booting') || !!document.querySelector('#terminal.open, #lab.open, #eggs-panel.open') });

  const chapters = [...document.querySelectorAll('[data-chapter]')];
  const sweep = document.getElementById('sweep');
  bus.on('chapter', ({ el, prev }) => {
    if (!el) return;
    document.body.className = document.body.className.replace(/\bchapter-\S+/g, '').trim() + ` chapter-${el.id}`;
    if (universe && el.dataset.shape) universe.setShape(el.dataset.shape);
    audio.chord(chapters.indexOf(el));
    if (prev) {
      audio.whoosh(chapters.indexOf(el) > chapters.indexOf(prev));
      sweep.classList.remove('go'); void sweep.offsetWidth; sweep.classList.add('go');
    }
  });

  // focus of the background universe: bright during cinematic moments, dim behind reading content
  const zones = [
    ...[...document.querySelectorAll('.opener, .knot-stage, #hero')].map((el) => ({ el, focus: 1, op: true })),
    ...[...document.querySelectorAll('.track')].map((el) => ({ el, focus: 0.55, op: false })),
    ...[...document.querySelectorAll('.chapter-body')].map((el) => ({ el, focus: 0.24, op: false })),
    { el: document.getElementById('credits'), focus: 0.7, op: false },
  ];
  const openers = [...document.querySelectorAll('.opener')];
  const letterbox = document.getElementById('letterbox');
  let warpTime = 0;
  onFrame(({ dt, time }) => {
    const mid = innerHeight / 2;
    let zone = null;
    for (const z of zones) { const r = z.el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { zone = z; break; } }
    const focus = zone ? zone.focus : 0.4;
    document.body.classList.toggle('op-active', !!zone && zone.op);
    hotspotState.visible = !!zone && zone.op;
    // letterbox while an opener is pinned
    let lb = 0;
    for (const o of openers) {
      const p = Number(o.style.getPropertyValue('--p') || 0);
      lb = Math.max(lb, smooth(0.36, 0.48, p) * (1 - smooth(0.86, 0.98, p)));
    }
    letterbox.style.setProperty('--lb', lb.toFixed(3));
    // warp on very fast scrolling
    const warp = clamp((scrollState.speed - 2600) / 7000, 0, 1);
    if (scrollState.speed > 9000) { warpTime += dt; if (warpTime > 0.35) { warpTime = -99; unlock('warp', { message: '超光速！视场被拉伸，色散加剧。（v > c 只在滚动条里成立。）' }); } }
    if (universe) {
      universe.setFocus(focus);
      universe.setWarp(warp);
      universe.setMouse(pointer.nx, pointer.ny, pointer.inside && !env.coarse);
      universe.frame(dt, time);
    }
  });

  bus.on('fx-euler', () => fxBig(tex('e^{i\\pi}+1=0', true), 'EULER · 1748'));
  bus.on('fx-144', () => fxBig(tex('144=F_{12}=12^2', true), 'THE ONLY NONTRIVIAL SQUARE FIBONACCI NUMBER · COHN 1964'));
  bus.on('fx-monster', () => fxBig(`<div class="fx-monster">|𝕄| = ${monsterOrder()}</div>`, 'MONSTER GROUP · THE LARGEST SPORADIC SIMPLE GROUP'));

  initReveal();
  initScroll();
  startLoop();
  if (universe) {
    universe.setShape('galaxy', { instant: true });
    addEventListener('resize', () => universe.resize());
  }

  await runBoot(universe, {
    onEnter: (withSound) => {
      bus.emit('sound', withSound);
      playHeroIntro();
    },
  });
  if (universe) universe.warm(['latent', 'archive', 'filament']);
}

main();
