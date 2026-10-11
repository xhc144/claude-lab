// Module 3 — ordinary differential equations: 2D phase plane and 3D strange attractors.

import { section, segmented } from '../ui/controls.js';
import { h } from '../ui/dom.js';
import { createPhase2D } from './phase2d.js';
import { createAttractor3D } from './attractor3d.js';

function create(ctx) {
  const { panel, query, setQuery } = ctx;
  let mode = query.get('mode') === '3d' ? '3d' : '2d';
  let view = null;
  let first = true;
  const sub = h('div');
  const seg = segmented({
    options: [{ value: '2d', label: '相平面 · 2D' }, { value: '3d', label: '奇怪吸引子 · 3D' }],
    value: mode,
    id: 'ode-mode',
    onChange: (m) => { if (m !== mode) switchMode(m); },
  });
  panel.append(section(null, [seg.el]), sub);

  function switchMode(m) {
    view?.destroy();
    mode = m;
    const make = m === '2d' ? createPhase2D : createAttractor3D;
    const q = first ? query : new URLSearchParams();
    first = false;
    view = make({ ...ctx, panel: sub, query: q, active: () => mode === m });
    if (!q.toString()) setQuery({ mode: m });
    view.start();
  }
  switchMode(mode);

  return {
    get help() { return view?.help; },
    onKey: (e) => view?.onKey?.(e),
    snapshot: () => view?.snapshot?.(),
    state: () => view?.state?.(),
    get view() { return view; },
    setMode: (m) => { seg.set(m); if (m !== mode) switchMode(m); },
    destroy() { view?.destroy(); },
  };
}

export default {
  id: 'ode',
  title: '常微分方程轨线',
  short: '微分方程',
  subtitle: '相平面、平衡点分类、分界线与零倾线；三维奇怪吸引子与蝴蝶效应',
  icon: 'ode',
  create,
};
