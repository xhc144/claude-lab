// Annotated points anchored in the 3D universe (projected to the screen every frame).
import { onFrame } from '../core/loop.js';
import { projectFiber, knotS3 } from '../universe/fiber.js';
import { archiveLayout } from '../universe/shapes.js';

export const hotspotState = { visible: false };
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function seed(k) {
  const R = 4.4, SEEDS = 2584;
  const r = R * Math.sqrt((k + 0.5) / SEEDS), th = k * GOLDEN, t = r / R;
  return [r * Math.cos(th), 0.24 * Math.sin(th * 2 + r * 1.1) * t * t, r * Math.sin(th)];
}

const knotPoint = (u) => {
  const s3 = knotS3((u.state.theta / 6) + 0.6, [0, 0, 0, 0]);
  const p = [0, 0, 0];
  projectFiber(s3[0], s3[1], s3[2], s3[3], 0, p);
  return p;
};
const axisPoint = (u) => {
  const th = u.state.theta / 2;
  const d = Math.max(1 - Math.sin(th), 0.05);
  return [0, 0, Math.max(-6, Math.min(6, (Math.cos(th) / d) * 1.25))];
};
const hopfPoint = (u) => {
  const t = u.state.time * 0.16 + 1.2, eta = 0.8;
  const v = [Math.cos(eta) * Math.cos(t), Math.cos(eta) * Math.sin(t), Math.sin(eta) * Math.cos(t), Math.sin(eta) * Math.sin(t)];
  const m = u.uniforms.uHopfRot.value.elements;
  const o = [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
  const d = Math.max(1 - o[3], 0.05);
  return [o[0] / d * 1.2, o[1] / d * 1.2, o[2] / d * 1.2];
};

function defs(universe) {
  const cols = archiveLayout();
  const col = (name) => { const c = cols.find((x) => x.name === name); return { p: [c.x, c.base + c.h + 0.25, c.z], k: `${c.field === 'math' ? 'MATH' : 'PHYSICS'} · ${c.pages} WEIGHT`, t: `${c.name}：布局权重 ${c.pages}，仅用于视觉展示。` }; };
  return {
    galaxy: [
      { p: seed(144), k: 'SEED #144', t: '第 144 颗种子。144 = F₁₂ 是斐波那契数，所以 144、288、432…号种子几乎落在同一条射线上。' },
    ],
    singularity: [
      { p: [0, 0, 0], k: 'DIM 0 · SINGULARITY', t: '没有长度、面积和体积的一个点。点一下它。', click: () => document.querySelector('.singularity-hit')?.click() },
    ],
    landscape: [
      { p: [2.24, -1.5, -1.12], k: 'ZERO · ORDER 2', t: 'z = 2 + i 是二阶零点：绕它一圈，颜色转两圈。' },
      { p: [0.7208, 1.5, 1.7403], k: 'POLE · ORDER 1', t: 'z² = −2 − 2i 的根是一阶极点：|f| → ∞，颜色反向转一圈。' },
      { p: [-1.12, -1.5, 0], k: 'ZERO · ORDER 1', t: 'z = −1：一阶零点。高度是 log|f|，零点处向下无限深。' },
    ],
    fiber: [
      { p: knotPoint, k: 'KNOT 3₁', t: '三叶结：(2, 3) 环面纽结。随着 θ 增加，结上的点沿结滑动——纽结本身是一条轨道。' },
      { p: axisPoint, k: 'F_θ · SEIFERT SURFACE', t: '亏格 1 的可定向曲面，边界恰好是三叶结。每一页都穿过对称轴两次。' },
    ],
    lorenz: [
      { p: [0.933, 0.22, 0.933], k: 'C⁺ · FIXED POINT', t: '轨道围绕两个不稳定不动点 (±6√2, ±6√2, 27) 打转。σ = 10，ρ = 28，β = 8/3。' },
      { p: [-0.933, 0.22, -0.933], k: 'LORENZ 1963', t: '最大李雅普诺夫指数约 0.906：初值误差每个时间单位约放大 2.5 倍。' },
    ],
    latent: [
      { p: () => universe.getShape('latent').centers[0], k: 'CLUSTER · ILLUSTRATIVE', t: '隐空间示意：相近的概念聚成簇，簇之间以关系相连。这里的点是生成的示意数据，不来自真实模型。' },
    ],
    archive: [col('概率论'), col('常微分方程与动力系统'), col('量子力学'), col('量子场论')],
    hopf: [
      { p: hopfPoint, k: 'S¹ → S³ → S²', t: '每个圆是球面上一点的原像；同一纬度的圆铺成一个环面，任意两个圆恰好链接一次。' },
    ],
  };
}

export function initHotspots(universe) {
  if (!universe) return;
  const layer = document.getElementById('hotspots');
  const D = defs(universe);
  let shape = null, nodes = [];
  const scr = { x: 0, y: 0, depth: 0 };
  const build = (name) => {
    layer.innerHTML = '';
    nodes = (D[name] || []).map((def) => {
      const el = document.createElement('div');
      el.className = 'hs';
      el.innerHTML = `<span class="hs-dot"></span><div class="hs-card"><span class="hs-k">${def.k}</span>${def.t}</div>`;
      el.style.opacity = '0';
      el.addEventListener('click', () => { el.classList.toggle('open'); def.click?.(); });
      layer.appendChild(el);
      return { def, el };
    });
  };
  onFrame(() => {
    if (universe.shape !== shape) { shape = universe.shape; build(shape); }
    const show = hotspotState.visible && universe.morphT >= 1 && universe.state.focus > 0.7;
    for (const n of nodes) {
      const p = typeof n.def.p === 'function' ? n.def.p(universe) : n.def.p;
      const s = show ? universe.toScreen(p[0], p[1], p[2], scr) : null;
      const inView = s && s.x > 30 && s.x < innerWidth - 30 && s.y > 70 && s.y < innerHeight - 60;
      n.el.style.opacity = inView ? '1' : '0';
      n.el.style.pointerEvents = inView ? 'auto' : 'none';
      if (s) {
        n.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
        n.el.classList.toggle('flip', s.x > innerWidth - 320);
      }
    }
  });
}
