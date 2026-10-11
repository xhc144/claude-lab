// Planar Newtonian N-body problem (G = 1 by default).
//
// State layout: Float64Array [x0, y0, x1, y1, …, vx0, vy0, vx1, vy1, …].
// Integrators: adaptive Dormand–Prince 5(4), symplectic Yoshida 4th order, velocity Verlet
// (leapfrog, 2nd order symplectic) and classic RK4.

import { DormandPrince, rk4Step, rk4Work } from './ode.js';

// Yoshida 4th-order coefficients (triple-jump composition of leapfrog)
const CBRT2 = Math.cbrt(2);
const W1 = 1 / (2 - CBRT2);
const W0 = -CBRT2 / (2 - CBRT2);
const YC = [W1 / 2, (W0 + W1) / 2, (W0 + W1) / 2, W1 / 2];
const YD = [W1, W0, W1];

export const INTEGRATORS = {
  dopri: { label: '自适应 Dormand–Prince 5(4)', adaptive: true, order: 5 },
  yoshida: { label: 'Yoshida 4 阶辛积分', adaptive: false, order: 4 },
  verlet: { label: '速度 Verlet（2 阶辛）', adaptive: false, order: 2 },
  rk4: { label: '经典 RK4', adaptive: false, order: 4 },
};

export class NBody {
  /**
   * @param {{masses:number[], pos:number[][], vel:number[][]}} cfg
   */
  constructor({ masses, pos, vel, G = 1, softening = 0 }) {
    this.G = G;
    this.eps2 = softening * softening;
    this.setBodies(masses, pos, vel);
    this.rtol = 1e-10;
    this.atol = 1e-12;
  }

  setBodies(masses, pos, vel) {
    const n = masses.length;
    this.n = n;
    this.m = Float64Array.from(masses);
    this.state = new Float64Array(4 * n);
    for (let i = 0; i < n; i++) {
      this.state[2 * i] = pos[i][0];
      this.state[2 * i + 1] = pos[i][1];
      this.state[2 * n + 2 * i] = vel[i][0];
      this.state[2 * n + 2 * i + 1] = vel[i][1];
    }
    this.t = 0;
    this.acc = new Float64Array(2 * n);
    this.accValid = false;
    this.work = rk4Work(4 * n);
    this.dp = null;
    this.failed = false;
  }

  set softening(eps) { this.eps2 = eps * eps; this.invalidate(); }
  get softening() { return Math.sqrt(this.eps2); }

  /** Call after editing state, masses or parameters by hand. */
  invalidate() {
    this.accValid = false;
    this.dp = null;
    this.failed = false;
  }

  pos(i) { return [this.state[2 * i], this.state[2 * i + 1]]; }
  vel(i) { const o = 2 * this.n; return [this.state[o + 2 * i], this.state[o + 2 * i + 1]]; }
  setPos(i, x, y) { this.state[2 * i] = x; this.state[2 * i + 1] = y; this.invalidate(); }
  setVel(i, vx, vy) { const o = 2 * this.n; this.state[o + 2 * i] = vx; this.state[o + 2 * i + 1] = vy; this.invalidate(); }
  setMass(i, m) { this.m[i] = m; this.invalidate(); }

  /** Gravitational accelerations for positions p (length ≥ 2n), written into acc. */
  accelerations(p, acc, offset = 0) {
    const { n, m, G, eps2 } = this;
    for (let i = 0; i < 2 * n; i++) acc[offset + i] = 0;
    for (let i = 0; i < n; i++) {
      const xi = p[2 * i], yi = p[2 * i + 1];
      for (let j = i + 1; j < n; j++) {
        const dx = p[2 * j] - xi, dy = p[2 * j + 1] - yi;
        const r2 = dx * dx + dy * dy + eps2;
        const inv = G / (r2 * Math.sqrt(r2));
        acc[offset + 2 * i] += m[j] * inv * dx;
        acc[offset + 2 * i + 1] += m[j] * inv * dy;
        acc[offset + 2 * j] -= m[i] * inv * dx;
        acc[offset + 2 * j + 1] -= m[i] * inv * dy;
      }
    }
  }

  /** First-order system for generic integrators. */
  derivative = (t, y, dy) => {
    const n2 = 2 * this.n;
    for (let i = 0; i < n2; i++) dy[i] = y[n2 + i];
    this.accelerations(y, dy, n2);
  };

  kinetic() {
    const { n, m, state } = this;
    let k = 0;
    for (let i = 0; i < n; i++) k += 0.5 * m[i] * (state[2 * n + 2 * i] ** 2 + state[2 * n + 2 * i + 1] ** 2);
    return k;
  }

  potential() {
    const { n, m, state, G, eps2 } = this;
    let u = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const r = Math.sqrt((state[2 * j] - state[2 * i]) ** 2 + (state[2 * j + 1] - state[2 * i + 1]) ** 2 + eps2);
        u -= (G * m[i] * m[j]) / r;
      }
    }
    return u;
  }

  energy() { return this.kinetic() + this.potential(); }

  /** z-component of total angular momentum about the origin. */
  angularMomentum() {
    const { n, m, state } = this;
    let L = 0;
    for (let i = 0; i < n; i++) L += m[i] * (state[2 * i] * state[2 * n + 2 * i + 1] - state[2 * i + 1] * state[2 * n + 2 * i]);
    return L;
  }

  momentum() {
    const { n, m, state } = this;
    let px = 0, py = 0;
    for (let i = 0; i < n; i++) { px += m[i] * state[2 * n + 2 * i]; py += m[i] * state[2 * n + 2 * i + 1]; }
    return [px, py];
  }

  totalMass() { return this.m.reduce((s, v) => s + v, 0); }

  centerOfMass() {
    const { n, m, state } = this;
    const M = this.totalMass();
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) { x += m[i] * state[2 * i]; y += m[i] * state[2 * i + 1]; }
    return [x / M, y / M];
  }

  /** Shift to the centre-of-mass frame: total momentum 0, centre of mass at the origin. */
  toCenterOfMassFrame() {
    const { n, state } = this;
    const M = this.totalMass();
    const [cx, cy] = this.centerOfMass();
    const [px, py] = this.momentum();
    for (let i = 0; i < n; i++) {
      state[2 * i] -= cx;
      state[2 * i + 1] -= cy;
      state[2 * n + 2 * i] -= px / M;
      state[2 * n + 2 * i + 1] -= py / M;
    }
    this.invalidate();
  }

  /** Reverse all velocities (time reversal). */
  reverse() {
    const { n, state } = this;
    for (let i = 2 * n; i < 4 * n; i++) state[i] = -state[i];
    this.invalidate();
  }

  minDistance() {
    const { n, state } = this;
    let d = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) d = Math.min(d, Math.hypot(state[2 * j] - state[2 * i], state[2 * j + 1] - state[2 * i + 1]));
    }
    return d;
  }

  // --- fixed-step integrators -----------------------------------------------------------------

  ensureAcc() {
    if (!this.accValid) {
      this.accelerations(this.state, this.acc);
      this.accValid = true;
    }
  }

  /** Kick–drift–kick leapfrog (velocity Verlet). */
  stepVerlet(dt) {
    const { n, state, acc } = this;
    const o = 2 * n;
    this.ensureAcc();
    for (let i = 0; i < o; i++) state[o + i] += 0.5 * dt * acc[i];
    for (let i = 0; i < o; i++) state[i] += dt * state[o + i];
    this.accelerations(state, acc);
    for (let i = 0; i < o; i++) state[o + i] += 0.5 * dt * acc[i];
    this.t += dt;
  }

  /** Yoshida 4th-order symplectic integrator (drift–kick composition). */
  stepYoshida(dt) {
    const { n, state, acc } = this;
    const o = 2 * n;
    for (let s = 0; s < 4; s++) {
      const c = YC[s] * dt;
      for (let i = 0; i < o; i++) state[i] += c * state[o + i];
      if (s < 3) {
        this.accelerations(state, acc);
        const d = YD[s] * dt;
        for (let i = 0; i < o; i++) state[o + i] += d * acc[i];
      }
    }
    this.accValid = false;
    this.t += dt;
  }

  stepRK4(dt) {
    rk4Step(this.derivative, this.t, this.state, dt, this.work);
    this.accValid = false;
    this.t += dt;
  }

  /**
   * Advance the simulation by `duration` (may be negative only for the fixed-step methods via
   * reversed velocities; use reverse() instead). Returns { steps, ok }.
   * `budget` caps the number of steps so a frame can never stall the UI.
   */
  advance(duration, method = 'dopri', { dt = 1e-3, budget = 200000 } = {}) {
    if (this.failed || duration <= 0) return { steps: 0, ok: !this.failed };
    const tEnd = this.t + duration;
    let steps = 0;
    if (method === 'dopri') {
      if (!this.dp) {
        this.dp = new DormandPrince(this.derivative, 4 * this.n, { rtol: this.rtol, atol: this.atol });
        this.dp.reset(this.t, this.state);
      }
      const dp = this.dp;
      dp.rtol = this.rtol;
      dp.atol = this.atol;
      while (dp.t < tEnd) {
        if (!dp.step(tEnd)) { this.failed = true; break; }
        if (++steps >= budget) break;
      }
      this.state.set(dp.y);
      this.t = dp.t;
      this.accValid = false;
      return { steps, ok: !this.failed };
    }
    const fn = method === 'yoshida' ? this.stepYoshida : method === 'verlet' ? this.stepVerlet : this.stepRK4;
    const nSteps = Math.max(1, Math.round(duration / dt));
    const h = duration / nSteps;
    for (; steps < nSteps && steps < budget; steps++) fn.call(this, h);
    for (let i = 0; i < this.state.length; i++) {
      if (!Number.isFinite(this.state[i])) { this.failed = true; break; }
    }
    return { steps, ok: !this.failed };
  }

  snapshot() {
    return { masses: Array.from(this.m), pos: Array.from({ length: this.n }, (_, i) => this.pos(i)), vel: Array.from({ length: this.n }, (_, i) => this.vel(i)) };
  }
}

// ---------------------------------------------------------------------------------------------
// Initial conditions

/** Šuvakov–Dmitrašinović (2013) family: x1 = (−1,0), x2 = (1,0), x3 = 0; v1 = v2 = (p1,p2), v3 = −2(p1,p2). */
function suvakov(p1, p2) {
  return {
    masses: [1, 1, 1],
    pos: [[-1, 0], [1, 0], [0, 0]],
    vel: [[p1, p2], [p1, p2], [-2 * p1, -2 * p2]],
  };
}

const LAGRANGE_V = 3 ** -0.25; // circular speed for equal masses on the unit circle
const lagrange = () => {
  const angles = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
  return {
    masses: [1, 1, 1],
    pos: angles.map((a) => [Math.cos(a), Math.sin(a)]),
    vel: angles.map((a) => [-LAGRANGE_V * Math.sin(a), LAGRANGE_V * Math.cos(a)]),
  };
};

const EULER_V = Math.sqrt(5 / 4); // outer bodies at ±1 around a central equal mass

export const PRESETS = [
  {
    id: 'figure8', name: '8 字形轨道', period: 6.32591398, view: 1.4,
    note: 'Chenciner–Montgomery (2000)：三个等质量天体沿同一条 8 字形曲线互相追逐，是稳定的周期解。',
    ...{ masses: [1, 1, 1], pos: [[-0.97000436, 0.24308753], [0.97000436, -0.24308753], [0, 0]], vel: [[0.466203685, 0.43236573], [0.466203685, 0.43236573], [-0.93240737, -0.86473146]] },
  },
  {
    id: 'lagrange', name: '拉格朗日等边三角形', period: 2 * Math.PI * 3 ** 0.25, view: 1.6,
    note: '三个等质量天体位于等边三角形顶点做刚性旋转（1772）。等质量时这一构型不稳定——数值误差会逐渐把它撕裂。',
    ...lagrange(),
  },
  {
    id: 'euler', name: '欧拉共线解', period: (2 * Math.PI) / EULER_V, view: 1.6,
    note: '三个天体始终保持在一条旋转的直线上（1767），同样不稳定。',
    masses: [1, 1, 1], pos: [[-1, 0], [0, 0], [1, 0]], vel: [[0, -EULER_V], [0, 0], [0, EULER_V]],
  },
  {
    id: 'butterfly', name: '蝴蝶 I', period: 6.23564136316479, view: 1.4,
    note: 'Šuvakov 与 Dmitrašinović 于 2013 年发现的周期轨道之一。',
    ...suvakov(0.306892758965492, 0.125506782829762),
  },
  {
    id: 'moth', name: '飞蛾 I', period: 14.8939113169584, view: 1.6,
    note: 'Šuvakov–Dmitrašinović 周期解：飞蛾 I。',
    ...suvakov(0.464445237398184, 0.396059973403921),
  },
  {
    id: 'yinyang', name: '阴阳 Ia', period: 17.328369755004, view: 1.6,
    note: 'Šuvakov–Dmitrašinović 周期解：阴阳 Ia。',
    ...suvakov(0.513938054919243, 0.304736003875733),
  },
  {
    id: 'dragonfly', name: '蜻蜓', period: 21.2709751966648, view: 1.8,
    note: 'Šuvakov–Dmitrašinović 周期解：蜻蜓。',
    ...suvakov(0.080584285736084, 0.588836087036133),
  },
  {
    id: 'goggles', name: '护目镜', period: 10.4668176954385, view: 1.4,
    note: 'Šuvakov–Dmitrašinović 周期解：护目镜。',
    ...suvakov(0.083300198893688, 0.127889238684538),
  },
  {
    id: 'pythagorean', name: '毕达哥拉斯问题', period: null, view: 4.2,
    note: 'Burrau (1913)：质量 3、4、5 的天体静止于 3-4-5 直角三角形顶点。经过一连串近距离相遇后，最轻的天体被抛出，另两个结成双星向反方向离去（t ≈ 60–70）。',
    masses: [3, 4, 5], pos: [[1, 3], [-2, -1], [1, -1]], vel: [[0, 0], [0, 0], [0, 0]],
  },
  {
    id: 'hierarchical', name: '双星 + 外围行星', period: null, view: 3.2,
    note: '一对紧密双星（周期约 2.1）与一颗绕它们运行的轻行星（周期约 18.6）：层级三体系统，长期稳定。',
    masses: [1, 1, 0.02],
    pos: [[-0.3, 0], [0.3, 0], [2.6, 0]],
    // circular binary: v² = G·m/(2d) with separation d = 0.6; planet: v² = G·(m₁ + m₂)/r
    vel: [[0, -Math.sqrt(1 / 1.2)], [0, Math.sqrt(1 / 1.2)], [0, Math.sqrt(2 / 2.6)]],
  },
];

/** A random bound three-body system in its centre-of-mass frame (deterministic for a seed). */
export function randomSystem(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  const rand = () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (;;) {
    const masses = [0.6 + rand() * 0.9, 0.6 + rand() * 0.9, 0.6 + rand() * 0.9];
    const pos = masses.map(() => [(rand() - 0.5) * 2.4, (rand() - 0.5) * 2.4]);
    const vel = masses.map(() => [(rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9]);
    const sys = new NBody({ masses, pos, vel });
    sys.toCenterOfMassFrame();
    if (sys.minDistance() > 0.5 && sys.energy() < -0.3) return { ...sys.snapshot(), seed };
  }
}
