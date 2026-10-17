// Animation id → module. Each module: { id, title, mount(host, opts) → { destroy() } }.
import { ANIMATIONS } from './registry.js';
import unitCircle from './unit-circle.js';
import taylor from './taylor.js';

export const MODULES = [unitCircle, taylor];
const byId = new Map(MODULES.map((m) => [m.id, m]));

export function mountAnimation(id, host, opts = {}) {
  const m = byId.get(id);
  if (!m) { host.textContent = '这个动画还没有实现。'; return { destroy() {} }; }
  return m.mount(host, opts);
}
export function animationTitle(id) {
  return byId.get(id)?.title || ANIMATIONS.find((a) => a.id === id)?.title || id;
}
