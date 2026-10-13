// Heads-up display: timecode, live readouts, current dimension, ladder navigation, sound toggle.
import { onFrame, clock } from '../core/loop.js';
import { bus } from '../core/bus.js';
import { scrollState, scrollToId } from '../core/scroll.js';
import { scramble } from '../core/fx.js';
import { audio } from '../core/audio.js';
import { pointer } from './cursor.js';
import { unlock } from './eggs.js';

export function initHud({ particles = 0 } = {}) {
  const $ = (id) => document.getElementById(id);
  const tc = $('timecode'), z = $('zcoord'), alt = $('alt'), fps = $('fps'), pts = $('pcount');
  const dimEl = document.querySelector('.hud-chapter-dim'), nameEl = document.querySelector('.hud-chapter-name');
  const links = [...document.querySelectorAll('.ladder a')];
  pts.textContent = particles.toLocaleString('en-US');

  let lastSec = -1;
  onFrame(() => {
    const t = clock.time;
    const f = Math.floor((t % 1) * 24);
    const s = Math.floor(t);
    if (clock.frame % 2 === 0) {
      tc.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
      const zr = (pointer.nx * 2 * innerWidth / innerHeight), zi = pointer.ny * 2;
      z.textContent = `${zr.toFixed(3)} ${zi < 0 ? '−' : '+'} ${Math.abs(zi).toFixed(3)}i`;
      alt.textContent = (scrollState.total * 100).toFixed(1).padStart(4, '0');
    }
    if (s !== lastSec) { lastSec = s; fps.textContent = clock.fps; }
  });

  bus.on('chapter', ({ el }) => {
    if (!el) return;
    scramble(dimEl, el.dataset.dim, { duration: 600 });
    scramble(nameEl, el.dataset.name, { duration: 700, glyphs: '零一二三四五六七八九十维点线面体' });
    for (const a of links) a.classList.toggle('is-active', a.dataset.nav === el.id);
  });

  for (const a of document.querySelectorAll('[data-nav]')) {
    a.addEventListener('click', (e) => { e.preventDefault(); audio.click(); scrollToId(a.dataset.nav); });
  }

  // sound
  const btn = $('sound-btn');
  const setSound = async (on) => {
    if (on) on = await audio.enable(); else audio.disable();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.querySelector('.lbl').textContent = on ? 'SOUND ON' : 'SOUND OFF';
  };
  btn.addEventListener('click', () => setSound(!audio.on));
  bus.on('sound', setSound);

  // REC ×5 → director's cut
  let recClicks = [], rec = $('rec');
  rec.addEventListener('click', () => {
    const now = performance.now();
    recClicks = recClicks.filter((t) => now - t < 2500);
    recClicks.push(now);
    if (recClicks.length >= 5) {
      recClicks = [];
      unlock('rec', { message: '导演剪辑版：直接跳到片尾字幕。' });
      document.body.classList.remove('director'); void document.body.offsetWidth;
      document.body.classList.add('director');
      scrollToId('credits');
    }
  });
  return { setSound };
}
