// Instrument registry: mounts every [data-instrument] host, runs only the visible ones.
import { onFrame } from '../core/loop.js';
import { Domain } from './domain.js';
import { Fourier } from './fourier.js';
import { Linear } from './linear.js';
import { Rep } from './rep.js';
import { Topo } from './topo.js';
import { Galton } from './galton.js';
import { Pascal } from './pascal.js';
import { Pendulum } from './pendulum.js';
import { Field } from './field.js';
import { Quantum } from './quantum.js';
import { Mlp } from './mlp.js';
import { Attention } from './attention.js';
import { Agent } from './agent.js';

const REGISTRY = { domain: Domain, fourier: Fourier, linear: Linear, rep: Rep, topo: Topo, galton: Galton, pascal: Pascal, pendulum: Pendulum, field: Field, quantum: Quantum, mlp: Mlp, attention: Attention, agent: Agent };
const live = new Set();
let io = null;
let ro = null;

export function createInstrument(host, opts = {}) {
  const Cls = REGISTRY[host.dataset.instrument];
  if (!Cls) return null;
  let inst;
  try {
    inst = new Cls(host, opts);
    inst.visible = !!opts.alwaysOn;
    inst.init?.();
    inst.resize();
  } catch (err) {
    console.error(`[instrument:${host.dataset.instrument}]`, err);
    return null;
  }
  live.add(inst);
  host.__inst = inst;
  if (!opts.alwaysOn) io.observe(host);
  ro.observe(inst.canvas);
  const destroy = inst.destroy.bind(inst);
  inst.destroy = () => { destroy(); live.delete(inst); io.unobserve(host); ro.unobserve(inst.canvas); };
  return inst;
}

export function mountInstruments(root = document) {
  io = io || new IntersectionObserver((entries) => {
    for (const e of entries) if (e.target.__inst) e.target.__inst.visible = e.isIntersecting;
  }, { rootMargin: '120px' });
  ro = ro || new ResizeObserver((entries) => {
    for (const e of entries) { const inst = e.target.closest('[data-instrument]')?.__inst; if (inst) inst._dirty = true; }
  });
  for (const host of root.querySelectorAll('[data-instrument]')) if (!host.closest('#lab')) createInstrument(host);
  onFrame(({ dt }) => {
    for (const inst of live) {
      if (!inst.visible) continue;
      if (inst._dirty) { inst._dirty = false; inst.resize(); }
      inst.time += dt;
      try { inst.frame(dt, inst.time); } catch (err) { console.error(`[instrument:${inst.type}]`, err); live.delete(inst); }
    }
  });
}
