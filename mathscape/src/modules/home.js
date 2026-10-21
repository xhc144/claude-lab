// Start page: what MathScape is, the modules with live previews, the precision setting and a
// gallery of ready-made examples. Like the modules, every picture here is computed in the
// browser: the hero is the phase portrait of a damped pendulum, the previews run small versions
// of the real thing (a matrix morph, domain colouring, the Lorenz attractor, the figure-eight,
// the Mandelbrot set, epicycles, a bifurcation diagram, a glider gun, a kaleidoscope, a Galton
// histogram, interfering waves and the Ulam spiral).

import { h, icon } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { Layer, observeSize, animationLoop } from '../ui/canvas.js';
import { arrow, glow } from '../ui/draw.js';
import { C, alpha, ramp } from '../ui/theme.js';
import { precisionControls } from '../ui/prefs.js';
import { lastVisit } from '../ui/settings.js';
import { mat, apply, interpolate, eigen } from '../core/linalg.js';
import { complexFunction } from '../core/expr.js';
import { phaseColor } from '../core/domaincolor.js';
import { NBody, PRESETS as NBODY_PRESETS } from '../core/nbody.js';
import { SHAPES, resample, dft, sortTerms } from '../core/fourier.js';
import { Life, PATTERNS } from '../core/life.js';
import { rosette } from '../core/symmetry.js';
import { binomialPMF, normalPDF } from '../core/probability.js';
import { sieve, ulamIndex } from '../core/primes.js';

const CARDS = {
  matrix: ['拖动基向量直接改矩阵', '特征方向、奇异值椭圆、Aⁿv 轨道', '线性 / 极分解 / 指数 / SVD 分步动画', '精确分数与根式，任意位数小数'],
  complex: ['定义域着色：增强相位图', '网格线的像与连续变形', '探针：f′(z) 与柯西–黎曼检验', '可拖动围道验证幅角原理'],
  ode: ['方向场、粒子流、平衡点分类', '分界线与零倾线，参数实时驱动', '三维奇怪吸引子与蝴蝶效应', '最大李雅普诺夫指数'],
  threebody: ['8 字形、拉格朗日、Šuvakov 轨道族', '四种积分器对比', '能量、角动量、动量守恒监测', '暂停后拖动天体编辑初值'],
  fractal: ['曼德博、朱利亚、燃烧之船、牛顿分形', '摄动理论 + 级数近似，放大到 10⁻²⁸⁰', '多线程渐进渲染', '悬停看迭代轨道与对应的朱利亚集'],
  fourier: ['手绘任意闭合曲线', '离散傅里叶变换 → 一串旋转的圆', '能量占比（帕塞瓦尔）', '方波里的吉布斯现象'],
  chaos: ['逻辑斯蒂映射的分岔图，可无限放大', '蛛网图与时间序列', '李雅普诺夫指数', '双双精度算出 12 位费根鲍姆 δ'],
  life: ['康威生命游戏与 6 种 B/S 规则', '滑翔机枪、飞船、长寿的“橡子”', '状态指纹检测周期', '沃尔夫勒姆 256 条一维规则'],
  symmetry: ['17 种壁纸群、7 种饰带群、玫瑰花群', '随手画，自动铺满整个平面', '自动标出镜面、滑移线、旋转中心', '轨形记号与晶格类型'],
  probability: ['高尔顿板：二项分布 → 正态分布', '蒲丰投针估计 π', '随机游走的 √n 扩散', '骰子之和与中心极限定理'],
  waves: ['二维波动方程，有限差分实时求解', '双缝干涉、单缝衍射、透镜、椭圆镜', '多普勒效应与马赫锥', '鼓面驻波与克拉尼沙图'],
  primes: ['乌拉姆螺旋、萨克斯螺旋、高斯素数', 'π(x) 与 Li(x)、R(x)，精确值列到 10²⁵', 'ζ 函数零点：40 位与 12 位精度', '用零点重建素数的台阶'],
};

const EXAMPLES = [
  { href: '#/matrix?m=1,1,1,0', mod: 'matrix', title: '斐波那契矩阵与黄金比', text: '特征值 (1 ± √5)/2；Aⁿ 的元素就是斐波那契数。' },
  { href: '#/matrix?m=1,1,1e-20,1&hp=50', mod: 'matrix', title: '双精度会算错的矩阵', text: '特征值 1 ± 10⁻¹⁰，双精度却把它当成二重根。', tag: '高精度' },
  { href: '#/matrix?m=0.9,-0.45,0.45,0.9', mod: 'matrix', title: '复特征值的螺旋', text: '每作用一次转 26.57° 并缩小一点：打开迭代轨道。' },
  { href: '#/complex?f=gamma(z)', mod: 'complex', title: 'Γ 函数的相位图', text: '极点排在 0, −1, −2, …；Γ(z) 没有零点。' },
  { href: '#/complex?f=z%5E3%20-%201', mod: 'complex', title: '三次单位根', text: 'z³ − 1 的三个零点相隔 120°，色轮各转一圈。' },
  { href: '#/ode?p=hopf', mod: 'ode', title: '霍普夫分岔', text: '拖动 μ 穿过 0：稳定焦点失稳，诞生极限环。' },
  { href: '#/ode?mode=3d&p=lorenz', mod: 'ode', title: '洛伦茨吸引子', text: '相邻轨线指数分离，这就是蝴蝶效应。' },
  { href: '#/threebody?p=figure8', mod: 'threebody', title: '8 字形三体轨道', text: '三个等质量天体沿同一条曲线互相追逐。' },
  { href: '#/threebody?p=pythagorean', mod: 'threebody', title: '毕达哥拉斯三体问题', text: '质量 3、4、5 从静止出发，最终抛出一个。' },
  { href: '#/fractal?x=-0.743643887037158704752191506114774&y=0.131825904205311970493132056385139&s=3e-20&hp=50', mod: 'fractal', title: '曼德博集深处 10⁻²⁰', text: '双精度在 10⁻¹³ 就糊成马赛克；摄动理论接着往下放大。', tag: '高精度' },
  { href: '#/fractal?k=julia&j=-0.8,0.156', mod: 'fractal', title: '朱利亚集', text: 'c = −0.8 + 0.156i：一条龙形的分形海岸线。' },
  { href: '#/fourier?s=square', mod: 'fourier', title: '方波与吉布斯现象', text: '再多的圆也消不掉拐角处约 9% 的过冲。' },
  { href: '#/chaos?r=3.8284', mod: 'chaos', title: '混沌中的周期 3 窗口', text: 'r = 1 + √8 处，混沌突然变回周期 3。' },
  { href: '#/life?p=gun', mod: 'life', title: '高斯帕滑翔机枪', text: '每 30 代造出一架滑翔机，种群无限增长。' },
  { href: '#/life?mode=1d&n=110', mod: 'life', title: '规则 110', text: '一维、两种状态，却是图灵完备的。' },
  { href: '#/symmetry?g=p6m', mod: 'symmetry', title: '雪花与蜂巢 p6m', text: '平面上最大的对称群：画一笔，得到 12 份。' },
  { href: '#/probability?e=buffon', mod: 'probability', title: '扔针算 π', text: '蒲丰投针：数一数压线的针就能估计 π。' },
  { href: '#/waves?s=slit', mod: 'waves', title: '杨氏双缝', text: '平面波穿过两条缝，叠出明暗相间的条纹。' },
  { href: '#/waves?s=chladni', mod: 'waves', title: '克拉尼图形', text: '振动板上的沙子聚到节线上。' },
  { href: '#/primes?v=zeros', mod: 'primes', title: '黎曼零点与素数', text: '把 ζ 的零点一个个加进来，平滑曲线变成素数的台阶。' },
  { href: '#/primes?v=count', mod: 'primes', title: '到 10²⁵ 为止的素数', text: '用 40 位精度的 Li(x) 和 R(x) 与精确的 π(x) 对照。', tag: '高精度' },
];

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------------------------------------
// Hero: damped pendulum x′ = y, y′ = −sin x − γy. Streamlines are drawn once per size into an
// offscreen canvas; a few hundred particles then drift along the field with short trails.

const GAMMA = 0.12;
const pend = (x, y) => [y, -Math.sin(x) - GAMMA * y];
function rk4(x, y, dt) {
  const [a1, b1] = pend(x, y);
  const [a2, b2] = pend(x + 0.5 * dt * a1, y + 0.5 * dt * b1);
  const [a3, b3] = pend(x + 0.5 * dt * a2, y + 0.5 * dt * b2);
  const [a4, b4] = pend(x + dt * a3, y + dt * b3);
  return [x + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4), y + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4)];
}
const speedColor = (x, y, a) => {
  const [r, g, b] = ramp(0.25 + Math.min(1, Math.hypot(...pend(x, y)) / 3.2) * 0.75);
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
};

function createHero(container) {
  const layer = new Layer(container);
  const TRAIL = 16;
  const st = { w: 0, h: 0, scale: 1, x0: 0, y0: 0, bg: null, parts: [] };
  const sx = (x) => (x - st.x0) * st.scale;
  const sy = (y) => st.h / 2 - y * st.scale;

  function spawn(p, x, y) {
    p.x = x ?? st.x0 + Math.random() * (st.w / st.scale);
    p.y = y ?? (Math.random() * 2 - 1) * (st.h / 2 / st.scale);
    p.age = 0;
    p.life = 3 + Math.random() * 6;
    p.n = 0;
    p.trail = p.trail || new Float32Array(2 * TRAIL);
  }

  function resize(w, hh) {
    st.w = w;
    st.h = hh;
    layer.resize(w, hh);
    st.scale = hh / 6.8; // y ∈ [−3.4, 3.4]
    st.x0 = -w / 2 / st.scale + 0.35 * Math.PI; // a centre (focus) sits right of the text column
    // streamlines from a jittered grid of seeds, integrated both ways
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * layer.dpr));
    c.height = Math.max(1, Math.round(hh * layer.dpr));
    const g = c.getContext('2d');
    g.scale(layer.dpr, layer.dpr);
    g.lineWidth = 1;
    const gap = 30;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let px = gap / 2; px < w; px += gap) {
      for (let py = gap / 2; py < hh; py += gap) {
        const x0 = st.x0 + (px + (rnd() - 0.5) * gap) / st.scale;
        const y0 = (hh / 2 - py - (rnd() - 0.5) * gap) / st.scale;
        for (const dir of [1, -1]) {
          let [x, y] = [x0, y0];
          g.beginPath();
          g.moveTo(sx(x), sy(y));
          for (let k = 0; k < 26; k++) {
            [x, y] = rk4(x, y, 0.045 * dir);
            if (Math.abs(y) > 4.5) break;
            g.lineTo(sx(x), sy(y));
          }
          g.strokeStyle = speedColor(x0, y0, 0.16);
          g.stroke();
        }
      }
    }
    // equilibria: stable foci at 2kπ, saddles at (2k+1)π
    for (let k = Math.floor(st.x0 / Math.PI) - 1; k * Math.PI < st.x0 + w / st.scale + 1; k++) {
      const X = sx(k * Math.PI), Y = sy(0);
      if (k % 2 === 0) {
        glow(g, X, Y, 22, C.accent2, 0.5);
        g.fillStyle = 'rgba(232, 236, 244, 0.85)';
        g.beginPath(); g.arc(X, Y, 2.6, 0, 2 * Math.PI); g.fill();
      } else {
        g.strokeStyle = 'rgba(251, 191, 36, 0.55)';
        g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(X - 5, Y - 5); g.lineTo(X + 5, Y + 5); g.moveTo(X - 5, Y + 5); g.lineTo(X + 5, Y - 5); g.stroke();
      }
    }
    st.bg = c;
    const n = Math.round(Math.min(320, (w * hh) / 2600));
    st.parts = Array.from({ length: n }, () => { const p = {}; spawn(p); p.age = Math.random() * p.life; return p; });
  }

  function frame(dt) {
    const { ctx } = layer;
    layer.reset();
    if (st.bg) ctx.drawImage(st.bg, 0, 0, st.w, st.h);
    const step = Math.min(0.05, dt) * 1.6;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    const xmax = st.x0 + st.w / st.scale;
    for (const p of st.parts) {
      p.age += dt;
      [p.x, p.y] = rk4(p.x, p.y, step);
      if (p.age > p.life || p.x < st.x0 - 0.5 || p.x > xmax + 0.5 || Math.abs(p.y) > 4) { spawn(p); continue; }
      const t = p.trail;
      t.copyWithin(2, 0, 2 * TRAIL - 2);
      t[0] = sx(p.x); t[1] = sy(p.y);
      p.n = Math.min(TRAIL, p.n + 1);
      if (p.n < 2) continue;
      const fade = Math.min(1, p.age * 2, (p.life - p.age) * 2);
      ctx.strokeStyle = speedColor(p.x, p.y, 0.75 * fade);
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      for (let k = 1; k < p.n; k++) ctx.lineTo(t[2 * k], t[2 * k + 1]);
      ctx.stroke();
    }
  }

  // a click on the field releases a burst of particles there
  layer.canvas.addEventListener('pointerdown', (e) => {
    const r = layer.canvas.getBoundingClientRect();
    const x = st.x0 + (e.clientX - r.left) / st.scale;
    const y = (st.h / 2 - (e.clientY - r.top)) / st.scale;
    for (let k = 0; k < 28 && st.parts.length; k++) {
      const p = st.parts[(Math.random() * st.parts.length) | 0];
      spawn(p, x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5);
      p.life = 6 + Math.random() * 4;
    }
  });
  return { resize, frame, canvas: layer.canvas };
}

// ------------------------------------------------------------------------------------------------
// Module previews: { resize(w, h, dpr), frame(t, dt) } on a Layer.

function matrixPreview(layer) {
  const A = mat(1.3, 0.6, 0.25, 0.95);
  let w = 0, hh = 0;
  return {
    resize(W, H) { w = W; hh = H; },
    frame(t) {
      const { ctx } = layer;
      layer.reset();
      const s = REDUCED ? 1 : 0.5 - 0.5 * Math.cos(t * 0.8);
      const M = interpolate(A, s, 'polar');
      const k = hh / 4.6, ox = w / 2, oy = hh / 2;
      const X = (x) => ox + x * k, Y = (y) => oy - y * k;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -8; i <= 8; i++) { ctx.moveTo(X(i), 0); ctx.lineTo(X(i), hh); ctx.moveTo(0, Y(i)); ctx.lineTo(w, Y(i)); }
      ctx.stroke();
      const c1 = apply(M, 1, 0), c2 = apply(M, 0, 1);
      ctx.strokeStyle = 'rgba(122, 162, 255, 0.4)';
      ctx.beginPath();
      for (let i = -8; i <= 8; i++) {
        ctx.moveTo(X(i * c1[0] - 9 * c2[0]), Y(i * c1[1] - 9 * c2[1])); ctx.lineTo(X(i * c1[0] + 9 * c2[0]), Y(i * c1[1] + 9 * c2[1]));
        ctx.moveTo(X(i * c2[0] - 9 * c1[0]), Y(i * c2[1] - 9 * c1[1])); ctx.lineTo(X(i * c2[0] + 9 * c1[0]), Y(i * c2[1] + 9 * c1[1]));
      }
      ctx.stroke();
      const e = eigen(M);
      if (e.kind === 'real') {
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = alpha(C.eig, 0.7);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (const v of e.vectors) { ctx.moveTo(X(-9 * v[0]), Y(-9 * v[1])); ctx.lineTo(X(9 * v[0]), Y(9 * v[1])); }
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(c1[0]), Y(c1[1])); ctx.lineTo(X(c1[0] + c2[0]), Y(c1[1] + c2[1])); ctx.lineTo(X(c2[0]), Y(c2[1]));
      ctx.closePath();
      ctx.fillStyle = alpha(C.v, 0.16);
      ctx.fill();
      ctx.strokeStyle = alpha(C.v, 0.7);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const th = (i / 64) * 2 * Math.PI;
        const [x, y] = apply(M, Math.cos(th), Math.sin(th));
        if (i) ctx.lineTo(X(x), Y(y)); else ctx.moveTo(X(x), Y(y));
      }
      ctx.strokeStyle = alpha(C.cyan, 0.6);
      ctx.stroke();
      arrow(ctx, X(0), Y(0), X(c1[0]), Y(c1[1]), { color: C.i, width: 2.4, head: 10 });
      arrow(ctx, X(0), Y(0), X(c2[0]), Y(c2[1]), { color: C.j, width: 2.4, head: 10 });
    },
  };
}

function complexPreview(layer) {
  const F = complexFunction('(z^2 - 1)(z - 2 - i)^2/(z^2 + 2 + 2i)');
  const out = new Float64Array(2);
  let img = null;
  return {
    resize(W, H, dpr) {
      const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
      img = new ImageData(pw, ph);
      const k = 6.4 / pw; // x ∈ [−3.2, 3.2]
      for (let j = 0; j < ph; j++) {
        for (let i = 0; i < pw; i++) {
          F.fn((i - pw / 2) * k + 0.3, (ph / 2 - j) * k, 0, 0, out);
          const p = 4 * (j * pw + i);
          const [r, g, b] = phaseColor(out[0], out[1]);
          const L = Math.log2(Math.hypot(out[0], out[1]));
          const ph12 = ((Math.atan2(out[1], out[0]) / (2 * Math.PI)) * 12 + 12) % 1;
          const shade = Number.isFinite(L) ? 0.62 + 0.24 * (L - Math.floor(L)) + 0.14 * ph12 : 1;
          img.data[p] = r * shade; img.data[p + 1] = g * shade; img.data[p + 2] = b * shade; img.data[p + 3] = 255;
        }
      }
    },
    frame() {
      if (!img) return;
      const { ctx } = layer;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(img, 0, 0);
    },
    static: true,
  };
}

function lorenzPreview(layer) {
  const N = 7000;
  const pts = new Float32Array(3 * N);
  let [x, y, z] = [1, 1, 1];
  const f = (x_, y_, z_) => [10 * (y_ - x_), x_ * (28 - z_) - y_, x_ * y_ - (8 / 3) * z_];
  const dt = 0.008;
  for (let k = -400; k < N; k++) {
    const k1 = f(x, y, z);
    const k2 = f(x + 0.5 * dt * k1[0], y + 0.5 * dt * k1[1], z + 0.5 * dt * k1[2]);
    const k3 = f(x + 0.5 * dt * k2[0], y + 0.5 * dt * k2[1], z + 0.5 * dt * k2[2]);
    const k4 = f(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    z += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    if (k >= 0) { pts[3 * k] = x; pts[3 * k + 1] = y; pts[3 * k + 2] = z; }
  }
  let w = 0, hh = 0;
  const BATCH = 7;
  const colors = Array.from({ length: BATCH }, (_, b) => { const [r, g, bl] = ramp(0.3 + 0.7 * (b / (BATCH - 1))); return `rgba(${r | 0}, ${g | 0}, ${bl | 0}, 0.8)`; });
  return {
    resize(W, H) { w = W; hh = H; },
    frame(t) {
      const { ctx } = layer;
      layer.reset();
      const yaw = (REDUCED ? 0.6 : t * 0.25) + 0.6, c = Math.cos(yaw), s = Math.sin(yaw);
      const k = hh / 52, ox = w / 2, oy = hh / 2;
      const P = (i) => [ox + (pts[3 * i] * c - pts[3 * i + 1] * s) * k, oy - (pts[3 * i + 2] - 25) * k];
      ctx.lineWidth = 0.9;
      // colour by height (z): split the polyline into bands
      for (let b = 0; b < BATCH; b++) {
        ctx.strokeStyle = colors[b];
        ctx.beginPath();
        for (let i = 1; i < N; i++) {
          const band = Math.min(BATCH - 1, Math.max(0, Math.floor(((pts[3 * i + 2] - 5) / 42) * BATCH)));
          if (band !== b) continue;
          const [x0, y0] = P(i - 1), [x1, y1] = P(i);
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        }
        ctx.stroke();
      }
      const head = Math.floor((t * 450) % N);
      const [hx, hy] = P(head);
      glow(ctx, hx, hy, 16, C.v, 0.9);
      ctx.fillStyle = '#fff7e0';
      ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, 2 * Math.PI); ctx.fill();
    },
  };
}

function threeBodyPreview(layer) {
  const preset = NBODY_PRESETS.find((p) => p.id === 'figure8');
  const sys = new NBody(preset);
  sys.toCenterOfMassFrame();
  const TR = 420;
  const trails = Array.from({ length: sys.n }, () => ({ buf: new Float32Array(2 * TR), head: -1, n: 0 }));
  let w = 0, hh = 0, acc = 0;
  const push = () => {
    for (let i = 0; i < sys.n; i++) {
      const tr = trails[i];
      tr.head = (tr.head + 1) % TR;
      const [px, py] = sys.pos(i);
      tr.buf[2 * tr.head] = px; tr.buf[2 * tr.head + 1] = py;
      tr.n = Math.min(TR, tr.n + 1);
    }
  };
  // pre-roll so the trails are full from the first frame
  for (let k = 0; k < TR; k++) { sys.advance(0.015); push(); }
  return {
    resize(W, H) { w = W; hh = H; },
    frame(t, dt) {
      if (!REDUCED) {
        acc += Math.min(0.05, dt) * 1.1;
        while (acc > 0.015) { sys.advance(0.015); push(); acc -= 0.015; }
      }
      const { ctx } = layer;
      layer.reset();
      const k = Math.min(w / 2.7, hh / 1.25), ox = w / 2, oy = hh / 2;
      for (let i = 0; i < sys.n; i++) {
        const tr = trails[i], col = C.bodies[i];
        ctx.strokeStyle = alpha(col, 0.55);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let j = 0; j < tr.n; j++) {
          const q = (tr.head - j + TR) % TR;
          const X = ox + tr.buf[2 * q] * k, Y = oy - tr.buf[2 * q + 1] * k;
          if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        }
        ctx.stroke();
        const [px, py] = sys.pos(i);
        glow(ctx, ox + px * k, oy - py * k, 18, col, 0.9);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(ox + px * k, oy - py * k, 4, 0, 2 * Math.PI); ctx.fill();
      }
    },
  };
}

function fractalPreview(layer) {
  let img = null;
  return {
    resize(W, H, dpr) {
      const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
      img = new ImageData(pw, ph);
      const k = 3.1 / pw, cx0 = -0.62, MAX = 160;
      for (let j = 0; j < ph; j++) {
        for (let i = 0; i < pw; i++) {
          const cx = cx0 + (i - pw / 2) * k, cy = (ph / 2 - j) * k;
          const q = (cx - 0.25) ** 2 + cy * cy;
          let n = MAX, x = 0, y = 0;
          if (!(q * (q + (cx - 0.25)) < 0.25 * cy * cy || (cx + 1) ** 2 + cy * cy < 0.0625)) {
            for (n = 0; n < MAX && x * x + y * y < 256; n++) { const t = x * x - y * y + cx; y = 2 * x * y + cy; x = t; }
          }
          const p = 4 * (j * pw + i);
          if (n >= MAX) { img.data[p] = 6; img.data[p + 1] = 8; img.data[p + 2] = 14; }
          else {
            const nu = n + 1 - Math.log2(Math.log2(x * x + y * y) / 2);
            const t = 0.5 + 0.5 * Math.sin(Math.log(nu + 1) * 2.1 - 1.2);
            const [r, g, b] = ramp(t);
            const fade = Math.min(1, nu / 6);
            img.data[p] = r * fade; img.data[p + 1] = g * fade; img.data[p + 2] = b * fade;
          }
          img.data[p + 3] = 255;
        }
      }
    },
    frame() {
      if (!img) return;
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.putImageData(img, 0, 0);
    },
    static: true,
  };
}

function fourierPreview(layer) {
  const terms = sortTerms(dft(resample(SHAPES.heart.pts(), 256)), 'amp');
  const K = 36;
  let w = 0, hh = 0;
  return {
    resize(W, H) { w = W; hh = H; },
    frame(t) {
      const { ctx } = layer;
      layer.reset();
      const k = hh / 2.5, ox = w / 2, oy = hh / 2;
      const T = REDUCED ? 0.999 : (t * 0.09) % 1;
      // the traced part of the curve
      ctx.strokeStyle = alpha(C.v, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s <= 240; s++) {
        const u = (s / 240) * T;
        let x = 0, y = 0;
        for (let i = 0; i < K; i++) { const { k: f, re, im } = terms[i], a = 2 * Math.PI * f * u, c = Math.cos(a), sn = Math.sin(a); x += re * c - im * sn; y += re * sn + im * c; }
        s ? ctx.lineTo(ox + x * k, oy - y * k) : ctx.moveTo(ox + x * k, oy - y * k);
      }
      ctx.stroke();
      // the chain of circles
      let x = 0, y = 0;
      ctx.lineWidth = 1;
      for (let i = 0; i < K; i++) {
        const { k: f, re, im, amp } = terms[i];
        const a = 2 * Math.PI * f * T, c = Math.cos(a), sn = Math.sin(a);
        const nx = x + re * c - im * sn, ny = y + re * sn + im * c;
        if (f !== 0) {
          ctx.strokeStyle = `rgba(148, 163, 184, ${Math.max(0.08, 0.35 - i * 0.008)})`;
          ctx.beginPath(); ctx.arc(ox + x * k, oy - y * k, amp * k, 0, 2 * Math.PI); ctx.stroke();
          ctx.strokeStyle = 'rgba(122, 162, 255, 0.7)';
          ctx.beginPath(); ctx.moveTo(ox + x * k, oy - y * k); ctx.lineTo(ox + nx * k, oy - ny * k); ctx.stroke();
        }
        x = nx; y = ny;
      }
      glow(ctx, ox + x * k, oy - y * k, 12, C.v, 0.9);
    },
  };
}

function chaosPreview(layer) {
  let img = null;
  return {
    resize(W, H, dpr) {
      const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
      const hits = new Float32Array(pw * ph);
      for (let i = 0; i < pw; i++) {
        const r = 2.85 + (1.15 * (i + 0.5)) / pw;
        let x = 0.5;
        for (let n = 0; n < 300; n++) x = r * x * (1 - x);
        for (let n = 0; n < 260; n++) {
          x = r * x * (1 - x);
          const j = Math.floor((1 - x) * 0.94 * ph + 0.03 * ph);
          if (j >= 0 && j < ph) hits[j * pw + i] += 1;
        }
      }
      img = new ImageData(pw, ph);
      for (let q = 0; q < pw * ph; q++) {
        const v = Math.min(1, Math.sqrt(hits[q] / 14));
        const [r, g, b] = v > 0 ? ramp(0.25 + 0.75 * v) : [0, 0, 0];
        img.data[4 * q] = 8 + r * v; img.data[4 * q + 1] = 11 + g * v; img.data[4 * q + 2] = 18 + b * v; img.data[4 * q + 3] = 255;
      }
    },
    frame() {
      if (!img) return;
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.putImageData(img, 0, 0);
    },
    static: true,
  };
}

function lifePreview(layer) {
  const GW = 84, GH = 52;
  let life = null, w = 0, hh = 0, acc = 0;
  const reset = () => { life = new Life(GW, GH); life.place(PATTERNS.gun.rle, 22, 14); };
  reset();
  for (let k = 0; k < 60; k++) life.step();
  return {
    resize(W, H) { w = W; hh = H; },
    frame(t, dt) {
      if (!REDUCED) {
        acc += Math.min(0.05, dt);
        while (acc > 0.07) { life.step(); acc -= 0.07; if (life.gen > 330) { reset(); for (let k = 0; k < 60; k++) life.step(); } }
      }
      const { ctx } = layer;
      layer.reset();
      const cell = Math.max(w / GW, hh / GH);
      const x0 = (w - GW * cell) / 2, y0 = (hh - GH * cell) / 2;
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x;
          if (life.cells[i]) {
            const a = Math.min(1, life.age[i] / 40);
            ctx.fillStyle = `rgb(${236 - 130 * a}, ${254 - 90 * a}, 255)`;
            ctx.fillRect(x0 + x * cell + 0.5, y0 + y * cell + 0.5, cell - 1, cell - 1);
          } else if (life.heat[i] > 0.05) {
            ctx.fillStyle = `rgba(138, 70, 200, ${0.45 * life.heat[i]})`;
            ctx.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
          }
        }
      }
    },
  };
}

function symmetryPreview(layer) {
  const g = rosette('D', 7);
  let w = 0, hh = 0;
  const cols = [C.cyan, C.v, C.accent2];
  return {
    resize(W, H) { w = W; hh = H; },
    frame(t) {
      const { ctx } = layer;
      layer.reset();
      const k = hh * 0.46, ox = w / 2, oy = hh / 2;
      const tt = REDUCED ? 1 : t * 0.35;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let c = 0; c < 3; c++) {
        // a slowly morphing stroke inside one wedge
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          const r = 0.15 + 0.8 * u;
          const a = 0.22 * Math.sin(3 * u * Math.PI + tt + c * 2.1) + 0.12 * Math.sin(tt * 0.7 + c);
          pts.push([r * Math.cos(a), r * Math.sin(a) * (0.6 + 0.4 * Math.sin(tt * 0.5 + c * 1.3))]);
        }
        ctx.strokeStyle = alpha(cols[c], 0.75);
        ctx.beginPath();
        for (const o of g.ops) {
          pts.forEach(([x, y], i) => {
            const X = ox + (o.M[0] * x + o.M[1] * y) * k, Y = oy - (o.M[2] * x + o.M[3] * y) * k;
            i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
          });
        }
        ctx.stroke();
      }
    },
  };
}

function probabilityPreview(layer) {
  const n = 14, pmf = binomialPMF(n, 0.5);
  const counts = new Array(n + 1).fill(0);
  let total = 0, acc = 0, w = 0, hh = 0;
  const drop = (m) => { for (let i = 0; i < m; i++) { let s = 0; for (let r = 0; r < n; r++) s += Math.random() < 0.5 ? 1 : 0; counts[s]++; total++; } };
  drop(REDUCED ? 3000 : 40);
  return {
    resize(W, H) { w = W; hh = H; },
    frame(t, dt) {
      if (!REDUCED) {
        acc += Math.min(0.05, dt) * 160;
        const m = Math.floor(acc); acc -= m;
        drop(m);
        if (total > 4000) { counts.fill(0); total = 0; }
      }
      const { ctx } = layer;
      layer.reset();
      const bw = (w - 30) / (n + 1), base = hh - 14, top = 18;
      const sc = (base - top) / (Math.max(...pmf) * 1.15);
      for (let k = 0; k <= n; k++) {
        const v = total ? counts[k] / total : 0;
        const x = 15 + k * bw;
        const grd = ctx.createLinearGradient(0, base - v * sc, 0, base);
        grd.addColorStop(0, alpha(C.accent, 0.9));
        grd.addColorStop(1, alpha(C.accent, 0.25));
        ctx.fillStyle = grd;
        ctx.fillRect(x + 2, base - v * sc, bw - 4, v * sc);
      }
      const sd = Math.sqrt(n * 0.25);
      ctx.strokeStyle = alpha(C.v, 0.95);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const xv = -0.5 + ((n + 1) * i) / 120;
        const X = 15 + (xv + 0.5) * bw, Y = base - normalPDF(xv, n / 2, sd) * sc;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();
      ctx.fillStyle = C.warn;
      for (let k = 0; k <= n; k++) { ctx.beginPath(); ctx.arc(15 + (k + 0.5) * bw, base - pmf[k] * sc, 2.4, 0, 2 * Math.PI); ctx.fill(); }
    },
  };
}

function wavesPreview(layer) {
  const R = 4; // pixels per sample
  let w = 0, hh = 0, small = null, sctx = null, img = null;
  return {
    resize(W, H) {
      w = W; hh = H;
      small = document.createElement('canvas');
      small.width = Math.max(1, Math.ceil(W / R)); small.height = Math.max(1, Math.ceil(H / R));
      sctx = small.getContext('2d');
      img = sctx.createImageData(small.width, small.height);
    },
    frame(t) {
      if (!img) return;
      const sw = small.width, sh = small.height;
      const lam = 15 / R, kw = (2 * Math.PI) / lam, ph = REDUCED ? 0 : t * 3;
      const s1 = [sw * 0.5, sh * 0.5 - 1.5 * lam], s2 = [sw * 0.5, sh * 0.5 + 1.5 * lam];
      const d = img.data;
      for (let j = 0; j < sh; j++) {
        for (let i = 0; i < sw; i++) {
          const r1 = Math.hypot(i - s1[0], j - s1[1]), r2 = Math.hypot(i - s2[0], j - s2[1]);
          const v = (Math.cos(kw * r1 - ph) / Math.sqrt(r1 + 2) + Math.cos(kw * r2 - ph) / Math.sqrt(r2 + 2)) * 2.2;
          const a = Math.min(1, Math.abs(v));
          const c = v < 0 ? [37, 99, 235] : [234, 120, 40];
          const q = 4 * (j * sw + i);
          d[q] = 8 + (c[0] - 8) * a; d[q + 1] = 11 + (c[1] - 11) * a; d[q + 2] = 18 + (c[2] - 18) * a; d[q + 3] = 255;
        }
      }
      sctx.putImageData(img, 0, 0);
      const { ctx } = layer;
      layer.reset();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, 0, 0, sw * R, sh * R);
      for (const s of [s1, s2]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s[0] * R, s[1] * R, 3.5, 0, 2 * Math.PI); ctx.fill(); }
    },
  };
}

function primesPreview(layer) {
  let img = null;
  return {
    resize(W, H, dpr) {
      const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
      const cell = Math.max(2, Math.round(3 * dpr));
      const K = Math.ceil(Math.max(pw, ph) / cell / 2) + 1;
      const isP = sieve((2 * K + 1) ** 2 + 45);
      const euler = new Set(Array.from({ length: 40 }, (_, k) => k * k + k + 41));
      img = new ImageData(pw, ph);
      img.data.fill(255);
      for (let j = 0; j < ph; j++) {
        for (let i = 0; i < pw; i++) {
          const x = Math.round((i - pw / 2) / cell), y = Math.round((ph / 2 - j) / cell);
          const n = 40 + ulamIndex(x, y);
          const p = 4 * (j * pw + i);
          const edge = (i % cell === 0) || (j % cell === 0);
          let c = [10, 14, 22];
          if (isP[n] && !edge) c = euler.has(n) ? [251, 191, 36] : ramp(0.35 + 0.65 * Math.min(1, Math.hypot(x, y) / K));
          img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2];
        }
      }
    },
    frame() {
      if (!img) return;
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.putImageData(img, 0, 0);
    },
    static: true,
  };
}

const PREVIEWS = {
  matrix: matrixPreview, complex: complexPreview, ode: lorenzPreview, threebody: threeBodyPreview,
  fractal: fractalPreview, fourier: fourierPreview, chaos: chaosPreview, life: lifePreview,
  symmetry: symmetryPreview, probability: probabilityPreview, waves: wavesPreview, primes: primesPreview,
};

// ------------------------------------------------------------------------------------------------

function create({ root, modules }) {
  const cleanups = [];
  const animated = []; // { frame, visible }
  const visible = new WeakMap();
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => { for (const en of entries) visible.set(en.target, en.isIntersecting); })
    : null;
  cleanups.push(() => io?.disconnect());

  // ---- hero
  const heroCanvasBox = h('div', { class: 'hero-canvas' });
  const last = lastVisit();
  const lastDef = last && modules.find((m) => last.hash.startsWith(`#/${m.id}`));
  const hero = h('section', { class: 'hero' },
    heroCanvasBox,
    h('div', { class: 'hero-inner' },
      h('div', { class: 'eyebrow' }, h('span', { class: 'pulse' }), '交互式数学可视化 · 全部实时计算'),
      h('h1', { class: 'hero-title' }, '数境 ', h('span', { class: 'grad' }, 'MathScape')),
      h('p', { class: 'lead' }, '从矩阵、复变函数、微分方程与三体运动，到分形、傅里叶本轮、混沌、生命游戏、对称、概率、波动与素数。每一帧都在你的浏览器里计算和绘制，没有一张预渲染的图片；需要时，还能把数字算到 1000 位。'),
      h('div', { class: 'hero-actions' },
        h('a', { class: 'btn primary big', href: '#/matrix', id: 'home-start' }, h('span', null, '开始探索'), icon(ICONS.arrow)),
        lastDef ? h('a', { class: 'btn big ghost', href: last.hash, id: 'home-resume' }, h('span', null, `继续：${lastDef.title}`)) : null),
      h('div', { class: 'hero-stats' },
        [[String(modules.length), '个交互模块'], ['150+', '个内置示例与预设'], ['1000', '位有效数字'], ['0', '个外部依赖']]
          .map(([n, t]) => h('div', { class: 'stat' }, h('b', null, n), h('span', null, t))))),
    h('div', { class: 'hero-caption' }, '背景：阻尼单摆的相平面 x′ = y，y′ = −sin x − 0.12y · 点击放出粒子'));
  const heroAnim = createHero(heroCanvasBox);
  cleanups.push(observeSize(heroCanvasBox, (w, hh) => heroAnim.resize(w, hh)));
  io?.observe(heroAnim.canvas);
  animated.push({ el: heroAnim.canvas, frame: (t, dt) => heroAnim.frame(dt) });

  // ---- module cards
  const grid = h('div', { class: 'module-grid', id: 'home-modules' });
  modules.forEach((m, k) => {
    const box = h('div', { class: 'mcard-preview' });
    const card = h('a', { class: 'mcard', href: `#/${m.id}`, 'data-module': m.id, style: { animationDelay: `${0.06 * k}s` } },
      box,
      h('div', { class: 'mcard-body' },
        h('div', { class: 'mcard-head' },
          h('span', { class: 'mcard-icon', html: ICONS[m.icon] }),
          h('h3', null, m.title),
          k < 9 ? h('kbd', { title: `快捷键 ${k + 1}` }, String(k + 1)) : null),
        h('p', null, m.subtitle),
        h('ul', null, (CARDS[m.id] || []).map((f) => h('li', null, f))),
        h('span', { class: 'mcard-go' }, '打开', icon(ICONS.arrow))));
    grid.append(card);
    const layer = new Layer(box, { passive: true });
    const pv = (PREVIEWS[m.id] || (() => ({ resize() {}, frame() {}, static: true })))(layer);
    let t0 = performance.now();
    cleanups.push(observeSize(box, (w, hh) => {
      layer.resize(w, hh);
      pv.resize(w, hh, layer.dpr);
      pv.frame((performance.now() - t0) / 1000, 0.016);
    }));
    io?.observe(layer.canvas);
    if (!pv.static) animated.push({ el: layer.canvas, frame: (t, dt) => pv.frame(t, dt) });
  });

  // ---- precision + gallery
  const prec = precisionControls({ idPrefix: 'home-prec' });
  cleanups.push(prec.destroy);
  const precCard = h('div', { class: 'home-card prec-card', id: 'home-precision' },
    h('div', { class: 'home-card-head' }, h('span', { class: 'mcard-icon', html: ICONS.digits }), h('h3', null, '计算精度')),
    h('p', { class: 'muted' }, '默认用 IEEE 754 双精度（约 16 位有效数字），快而够用。打开高精度后，矩阵模块改用精确分数与任意位数的十进制运算，分形可以继续放大到 10⁻²⁸⁰，混沌模块用双双精度算费根鲍姆常数，其他模块收紧积分容差、显示更多位数。'),
    prec.el,
    h('div', { class: 'prec-demo' },
      h('div', null,
        h('div', { class: 'mono-line' }, h('span', { class: 'k' }, '双精度'), '0.1 + 0.2 = ', h('b', { class: 'bad' }, '0.30000000000000004')),
        h('div', { class: 'mono-line' }, h('span', { class: 'k' }, '高精度'), '0.1 + 0.2 = ', h('b', { class: 'good' }, '3/10'))),
      h('a', { class: 'btn small', href: '#/matrix?m=1,1,1e-20,1&hp=50', id: 'home-hp-demo' }, h('span', null, '看一个双精度算错的例子'), icon(ICONS.arrow))),
    h('div', { class: 'hint' }, '在任何页面按 P 都可以切换。'));

  const gallery = h('div', { class: 'home-card gallery-card' },
    h('div', { class: 'home-card-head' }, h('span', { class: 'mcard-icon', html: ICONS.play }), h('h3', null, '从一个例子开始')),
    h('div', { class: 'gallery', id: 'home-gallery' }, EXAMPLES.map((ex) => {
      const m = modules.find((q) => q.id === ex.mod);
      return h('a', { class: 'gitem', href: ex.href },
        h('span', { class: `gicon g-${ex.mod}`, html: ICONS[m.icon] }),
        h('span', { class: 'gtext' },
          h('b', null, ex.title, ex.tag ? h('span', { class: 'gtag' }, ex.tag) : null),
          h('span', null, ex.text)));
    })));

  const footer = h('footer', { class: 'home-footer' },
    h('div', { class: 'keys' },
      h('span', null, h('kbd', null, '1'), '–', h('kbd', null, String(Math.min(9, modules.length))), ' 切换模块'),
      h('span', null, h('kbd', null, '0'), ' 回到这里'),
      h('span', null, h('kbd', null, 'P'), ' 切换精度'),
      h('span', null, h('kbd', null, '?'), ' 帮助')),
    h('div', { class: 'links' },
      h('a', { href: 'https://github.com/xhc144/claude-lab/blob/main/mathscape/dist/mathscape.html', target: '_blank', rel: 'noopener' }, icon(ICONS.download), '离线单文件版'),
      h('a', { href: 'https://github.com/xhc144/claude-lab/tree/main/mathscape', target: '_blank', rel: 'noopener' }, icon(ICONS.code), '源码与数值方法')));

  root.append(hero,
    h('section', { class: 'home-section' }, h('div', { class: 'home-section-head' }, h('h2', null, `${modules.length} 个实验室`), h('span', { class: 'muted' }, '每张卡片里的画面都在实时计算')), grid),
    h('section', { class: 'home-section home-split' }, precCard, gallery),
    footer);

  // ---- animation (only what is on screen; nothing at all with reduced motion)
  const start = performance.now();
  const loop = animationLoop((dt, now) => {
    if (document.hidden) return;
    const t = (now - start) / 1000;
    for (const a of animated) if (visible.get(a.el) !== false) a.frame(t, dt);
  });
  if (REDUCED) requestAnimationFrame(() => { for (const a of animated) a.frame(0, 0.016); });
  else loop.start();
  cleanups.push(() => loop.stop());

  return {
    help: {
      tips: [
        '点击卡片或按 <kbd>1</kbd>–<kbd>9</kbd> 打开前九个模块；任何时候按 <kbd>0</kbd> 或点左上角标志回到这里。',
        '“计算精度”在这里、设置（齿轮）和快捷键 <kbd>P</kbd> 三处都能切换，选择保存在本机浏览器中。',
        '背景是阻尼单摆的相平面：紫色亮点是稳定焦点（摆静止下垂），黄色叉号是鞍点（倒立）。点击背景放出一团粒子。',
      ],
      keys: [],
    },
    destroy() { for (const fn of cleanups) fn(); },
  };
}

export default {
  id: 'home',
  title: '开启页面',
  short: '首页',
  subtitle: '数境 MathScape：交互式数学可视化',
  icon: 'brand',
  create,
};
