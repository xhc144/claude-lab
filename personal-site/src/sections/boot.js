// The boot screen. Each log line is real work (sampling the trefoil's fibre, integrating the Lorenz
// system, compiling shaders …) and prints the time it actually took.
import { audio } from '../core/audio.js';
import { env } from '../core/env.js';
import { sleep } from '../core/fx.js';

const pad = (s, n) => (s + ' ').padEnd(n, '.');

export function runBoot(universe, { onEnter }) {
  const root = document.getElementById('boot');
  const log = root.querySelector('.boot-log');
  const pct = root.querySelector('.boot-pct');
  const bar = root.querySelector('.boot-bar');
  const lines = [];
  const print = (html) => { lines.push(html); log.innerHTML = lines.slice(-11).join('\n'); };
  let shown = 0;
  const setPct = (v) => { shown = v; pct.textContent = String(Math.round(v)).padStart(3, '0'); bar.style.setProperty('--bp', (v / 100).toFixed(3)); };

  const jobs = [
    ['mount /mathematics', null],
    ['mount /physics', null],
    ['mount /artificial-intelligence', null],
    ['sample 2584 seeds @ 137.508°', () => universe?.getShape('galaxy')],
    ['collapse to a point (dim 0)', () => universe?.getShape('singularity')],
    ['solve z² + w³ = e^{iθ} on S³', () => universe?.getShape('fiber')],
    ['integrate lorenz σ=10 ρ=28 β=8/3', () => universe?.getShape('lorenz')],
    ['phase portrait of f(z), 2-D', () => universe?.getShape('landscape')],
    ['lift S² → S³ (hopf)', () => universe?.getShape('hopf')],
    ['compile shaders (GLSL)', () => universe?.frame(0.016, 0)],
  ];

  const skip = env.params.has('skip');
  return new Promise((resolve) => {
    let entered = false;
    const enter = async (withSound) => {
      if (entered) return;
      entered = true;
      if (withSound) await audio.enable();
      onEnter?.(withSound && audio.on);
      audio.impact();
      audio.whoosh(true);
      root.classList.add('leaving');
      document.body.classList.remove('is-booting');
      setTimeout(() => { root.remove(); }, 1000);
      resolve();
    };
    if (skip) {
      for (const [, job] of jobs) job?.();
      enter(false);
      return;
    }
    root.querySelector('[data-enter="sound"]').addEventListener('click', () => enter(true));
    root.querySelector('[data-enter="silent"]').addEventListener('click', () => enter(false));
    const onKey = (e) => {
      if (!root.classList.contains('ready')) return;
      if (e.key === 'Enter') { e.preventDefault(); enter(true); }
      if (e.key === 'Escape') { e.preventDefault(); enter(false); }
      if (entered) removeEventListener('keydown', onKey);
    };
    addEventListener('keydown', onKey);

    (async () => {
      const fast = env.reducedMotion;
      print('<span class="ok">XHC144 OBSERVATORY OS</span>  ·  ' + new Date().toISOString().slice(0, 10) + '  ·  quality=' + env.quality + '  ·  particles=' + env.particles.toLocaleString('en-US'));
      for (let i = 0; i < jobs.length; i++) {
        const [label, job] = jobs[i];
        await sleep(fast ? 0 : 90);
        const t0 = performance.now();
        let ok = true;
        try { job?.(); } catch (err) { ok = false; console.warn(err); }
        const ms = performance.now() - t0;
        print(`&gt; ${pad(label, 38)} ${ok ? '<span class="ok">ok</span>' : '<span class="warn">skip</span>'}  ${ms.toFixed(1).padStart(6)} ms`);
        const target = ((i + 1) / jobs.length) * 100;
        const from = shown;
        for (let k = 1; k <= 6; k++) { setPct(from + ((target - from) * k) / 6); audio.tick(); await sleep(fast ? 0 : 16); }
      }
      print('&gt; ' + pad('target 2027 · 求真书院', 38) + ' <span class="warn">locked</span>');
      setPct(100);
      await sleep(fast ? 0 : 250);
      root.classList.add('ready');
      root.querySelector('[data-enter="sound"]').focus({ preventScroll: true });
    })();
  });
}
