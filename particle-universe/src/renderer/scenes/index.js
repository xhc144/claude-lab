import nebula from './nebula.js';
import blackhole from './blackhole.js';
import galaxy from './galaxy.js';
import storm from './storm.js';
import silk from './silk.js';
import resonance from './resonance.js';
import warp from './warp.js';
import attractor from './attractor.js';

export const SCENES = [nebula, blackhole, galaxy, storm, silk, resonance, warp, attractor];
export const sceneById = (id) => SCENES.find((s) => s.id === id) || SCENES[0];
export const sceneIndex = (id) => Math.max(0, SCENES.findIndex((s) => s.id === id));
export function defaultParams(scene) {
  const o = {};
  for (const p of scene.params) o[p.key] = p.def;
  return o;
}
