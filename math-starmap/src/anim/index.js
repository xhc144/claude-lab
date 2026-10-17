// Animation id → module. Each module: { id, title, mount(host, opts) → { destroy() } }.
import { ANIMATIONS } from './registry.js';
import unitCircle from './unit-circle.js';
import taylor from './taylor.js';
import { epsilonN, epsilonDelta } from './limits.js';
import { derivativeTangent, mvt, riemannSum, seriesSums } from './calculus.js';
import { fourierSeries, complexMult } from './waves-complex.js';
import { linearMap, powerMethod, dihedral } from './algebra.js';
import { conics, convexHull, curvature } from './geometry.js';
import { polyhedra, mobius, knot } from './three-d.js';
import { galton, clt, lln, randomWalk, hypothesis, regression } from './probability.js';
import { newton, cobweb, interpolation, gradientDescent, linearProgramming } from './numerics.js';
import { projectile, shm, electricField, waves, doubleSlit, refraction, lightClock } from './physics.js';

export const MODULES = [
  unitCircle, taylor, epsilonN, epsilonDelta, derivativeTangent, mvt, riemannSum, seriesSums,
  fourierSeries, complexMult, linearMap, powerMethod, dihedral, conics, convexHull, curvature,
  polyhedra, mobius, knot, galton, clt, lln, randomWalk, hypothesis, regression, newton, cobweb,
  interpolation, gradientDescent, linearProgramming, projectile, shm, electricField, waves,
  doubleSlit, refraction, lightClock,
];
const byId = new Map(MODULES.map((m) => [m.id, m]));

export function mountAnimation(id, host, opts = {}) {
  const m = byId.get(id);
  if (!m) { host.textContent = '这个动画还没有实现。'; return { destroy() {} }; }
  return m.mount(host, opts);
}
export function animationTitle(id) {
  return byId.get(id)?.title || ANIMATIONS.find((a) => a.id === id)?.title || id;
}
