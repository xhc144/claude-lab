// Dimension 3: the pinned knot stage. Scrolling walks through four steps (trefoil → Seifert surface →
// open book → invariants) and drives the particle universe; the side panel animates Seifert's
// algorithm on the standard trefoil diagram and offers direct controls.
import { track } from '../core/scroll.js';
import { onFrame } from '../core/loop.js';
import { audio } from '../core/audio.js';
import { toast } from '../ui/toast.js';
import { unlock } from '../ui/eggs.js';
import { tex } from '../core/tex.js';

const NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const curve = (t) => [Math.sin(t) + 2 * Math.sin(2 * t), -(Math.cos(t) - 2 * Math.cos(2 * t))];

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Self-intersections of the sampled diagram, as parameter pairs.
function crossings(n = 900) {
  const P = Array.from({ length: n }, (_, i) => curve((i / n) * TAU));
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = P[j], d = P[(j + 1) % n];
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (Math.abs(den) < 1e-12) continue;
      const s = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
      const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (s >= 0 && s < 1 && u >= 0 && u < 1) {
        out.push({ ta: ((i + s) / n) * TAU, tb: ((j + u) / n) * TAU, p: [a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1])] });
      }
    }
  }
  return out;
}

function buildDiagram(svg) {
  const S = 34;
  const X = ([x, y]) => [x * S, y * S];
  const cr = crossings();
  // alternate over/under along the parameter
  const events = cr.flatMap((c, k) => [{ t: c.ta, k }, { t: c.tb, k }]).sort((a, b) => a.t - b.t);
  const unders = events.filter((_, i) => i % 2 === 1).map((e) => e.t);
  const gap = 0.16;
  const near = (t) => unders.some((u) => Math.min(Math.abs(t - u), TAU - Math.abs(t - u)) < gap);
  let d = '', pen = false;
  const N = 720;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TAU;
    if (near(t)) { pen = false; continue; }
    const [x, y] = X(curve(t));
    d += `${pen ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
    pen = true;
  }
  const g = {};
  g.knot = el('g', { class: 'sv-knot' }, svg);
  el('path', { d, fill: 'none', stroke: '#ece8e1', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, g.knot);

  g.arrows = el('g', { class: 'sv-arrows' }, svg);
  for (let k = 0; k < 6; k++) {
    const t = (k / 6) * TAU + 0.5;
    if (near(t)) continue;
    const [x, y] = X(curve(t));
    const [x2, y2] = X(curve(t + 0.01));
    const a = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
    el('path', { d: 'M -7 -6 L 7 0 L -7 6 Z', fill: '#ff5b1f', transform: `translate(${x} ${y}) rotate(${a})` }, g.arrows);
  }

  // Seifert circles: smoothing the three crossings leaves two nested circles.
  const rc = Math.hypot(...X(cr[0].p));
  g.circles = el('g', { class: 'sv-circles' }, svg);
  el('circle', { r: rc * 0.55, fill: 'none', stroke: '#4fe3ff', 'stroke-width': 2.4 }, g.circles);
  el('circle', { r: rc * 1.75, fill: 'none', stroke: '#9b7bff', 'stroke-width': 2.4 }, g.circles);
  for (const c of cr) {
    const [x, y] = X(c.p);
    const a = Math.atan2(y, x);
    const r = rc * 1.15;
    el('path', { d: 'M -6 -6 L 6 6 M 6 -6 L -6 6', stroke: '#ff5b1f', 'stroke-width': 2, transform: `translate(${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)})` }, g.circles);
  }

  // Disks + half-twisted bands
  g.surface = el('g', { class: 'sv-surface' }, svg);
  el('circle', { r: rc * 1.75, fill: 'rgba(155,123,255,0.22)', stroke: '#9b7bff', 'stroke-width': 2 }, g.surface);
  el('circle', { r: rc * 0.55, fill: 'rgba(79,227,255,0.28)', stroke: '#4fe3ff', 'stroke-width': 2 }, g.surface);
  for (const c of cr) {
    const a = Math.atan2(...[...X(c.p)].reverse());
    const r1 = rc * 0.55, r2 = rc * 1.75, w = 0.2;
    const P = (r, da) => `${(r * Math.cos(a + da)).toFixed(2)} ${(r * Math.sin(a + da)).toFixed(2)}`;
    // a bow-tie: the band's edges swap sides half-way — one half twist
    el('path', { d: `M ${P(r1, -w * 1.6)} L ${P(r2, w * 0.55)} L ${P(r2, -w * 0.55)} L ${P(r1, w * 1.6)} Z`, fill: 'rgba(255,91,31,0.35)', stroke: '#ff5b1f', 'stroke-width': 1.6 }, g.surface);
  }
  return g;
}

const CAPS = [
  '① 纽结图：3 个交叉，沿曲线走，上、下交替出现。',
  '② 给纽结定一个方向，沿箭头行走。',
  '③ 在每个交叉处顺着方向“光滑化”，得到 2 个嵌套的 Seifert 圆。',
  null,
];

export function initDim3(universe) {
  const stage = document.getElementById('knot-stage');
  const steps = [...stage.querySelectorAll('.kstep')];
  const stepLabel = stage.querySelector('[data-knot-step-label]');
  const bar = stage.querySelector('.knot-progress > i');
  const svg = stage.querySelector('.seifert-svg');
  const cap = stage.querySelector('.seifert-cap');
  const algoOut = stage.querySelector('[data-readout-knot="algo"]');
  const thetaOut = stage.querySelector('[data-readout-knot="theta"]');
  const slider = stage.querySelector('[data-knot="theta"]');
  const btn = (k) => stage.querySelector(`[data-knot="${k}"]`);
  const g = buildDiagram(svg);
  CAPS[3] = `④ 每个圆张一张圆盘，每个交叉接一条半扭的带子。${tex('\\chi=2-3=-1,\\ g=\\tfrac{1-\\chi}{2}=1')}`;

  let algo = -1;
  const showAlgo = (k) => {
    algo = k;
    g.knot.style.opacity = k <= 1 ? 1 : 0.15;
    g.arrows.style.opacity = k === 1 || k === 2 ? 1 : 0;
    g.circles.style.opacity = k === 2 ? 1 : 0;
    g.surface.style.opacity = k === 3 ? 1 : 0;
    cap.innerHTML = CAPS[k];
    algoOut.textContent = `${k + 1}/4`;
  };
  for (const part of Object.values(g)) part.style.transition = 'opacity 0.8s ease';
  showAlgo(0);
  let algoTimer = 0;

  // scroll-driven steps
  let step = -1;
  const setStep = (k) => {
    if (k === step) return;
    step = k;
    steps.forEach((s, i) => s.classList.toggle('is-on', i === k));
    stepLabel.textContent = String(k + 1).padStart(2, '0');
    if (!universe) return;
    universe.setOpenBook(k === 2);
    universe.setZoom(k === 1 ? 0.45 : k === 3 ? 0.2 : 0);
    universe.state.thetaSpeed = k === 2 ? 0.35 : 0.22;
    btn('book').classList.toggle('is-on', k === 2);
    audio.blip();
  };
  track(stage, (p) => {
    bar.style.setProperty('--p', p.toFixed(3));
    setStep(Math.min(3, Math.floor(p * 4)));
  }, 'pin');

  // controls
  btn('auto').addEventListener('click', () => {
    const on = !btn('auto').classList.contains('is-on');
    btn('auto').classList.toggle('is-on', on);
    universe?.setThetaAuto(on);
  });
  btn('book').addEventListener('click', () => {
    const on = !btn('book').classList.contains('is-on');
    btn('book').classList.toggle('is-on', on);
    universe?.setOpenBook(on);
  });
  btn('tube').addEventListener('click', () => {
    const on = !btn('tube').classList.contains('is-on');
    btn('tube').classList.toggle('is-on', on);
    universe?.setKnot(on);
  });
  btn('reset').addEventListener('click', () => universe?.resetView());
  let attempts = 0;
  btn('untie').addEventListener('click', () => {
    universe?.wobbleKnot();
    audio.whoosh(false);
    attempts++;
    if (attempts === 1) toast('ATTEMPT 1', '纽结抖了抖，又回到原样。再试一次？');
    else if (attempts === 2) toast('ATTEMPT 2', '还是不行。也许问题不在力气。');
    else unlock('untie', { message: `无论怎样连续变形都解不开：${tex('\\Delta_{3_1}(t)=t^2-t+1\\neq 1')}，而平凡结的 Alexander 多项式是 1。` });
  });
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    universe?.setTheta(v);
    btn('auto').classList.remove('is-on');
    if (v >= Number(slider.max) - 0.02) {
      unlock('monodromy', { message: `θ 走过了 ${tex('12\\pi')}：三叶结纤维化的单值化是 6 阶的——每一页都转了 6 圈，每个点都回到了原处。` });
    }
  });

  // drag to rotate
  const drag = stage.querySelector('[data-drag]');
  let last = null;
  drag.addEventListener('pointerdown', (e) => { last = [e.clientX, e.clientY]; drag.setPointerCapture(e.pointerId); });
  drag.addEventListener('pointermove', (e) => {
    if (!last || !universe) return;
    universe.drag(e.clientX - last[0], e.clientY - last[1]);
    last = [e.clientX, e.clientY];
  });
  const end = () => { last = null; };
  drag.addEventListener('pointerup', end);
  drag.addEventListener('pointercancel', end);

  // per-frame: θ readout, algorithm cycle while visible
  onFrame(({ dt }) => {
    const r = stage.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (universe) {
      const th = universe.state.theta;
      thetaOut.textContent = (((th % (12 * Math.PI)) + 12 * Math.PI) % (12 * Math.PI)).toFixed(2);
      if (universe.state.thetaAuto) slider.value = String(((th % (12 * Math.PI)) + 12 * Math.PI) % (12 * Math.PI));
    }
    algoTimer += dt;
    if (algoTimer > 3.6) { algoTimer = 0; showAlgo((algo + 1) % 4); }
  });

  const count = stage.querySelector('.side-note');
  if (universe && count) count.innerHTML = count.innerHTML.replace('约 5.8 万', `约 ${(Math.round(universe.count * 0.88 / 1000) / 10).toFixed(1)} 万`);
}
