// Guided flights: a curated tour (content/tours.md) or any learning path / route, played star by
// star with narration. The camera flies to each stop; the route is drawn through all stops.

import { el, escapeHtml, rgba } from '../core/util.js';
import { renderMath } from '../core/tex.js';
import { ICON } from './icons.js';

export class TourPlayer {
  constructor(app) {
    this.app = app;
    this.root = el('div', { id: 'tour', class: 'glass', role: 'region', 'aria-label': '航线播放' });
    this.tour = null;
    this.k = 0;
    this.auto = false;
  }
  active() { return !!this.tour; }
  start(id) {
    const t = this.app.graph.tours.find((x) => x.id === id);
    if (!t) return;
    this.play({ title: t.title, steps: t.steps });
  }
  startCustom(title, nodes) {
    if (!nodes.length) return;
    this.play({ title, steps: nodes.map((i) => ({ i, html: '' })) });
  }
  play(tour) {
    this.tour = tour;
    this.k = 0;
    this.app.setPath({ nodes: tour.steps.map((s) => s.i), kind: 'tour', numbered: true });
    if (this.app.mode !== 'map') this.app.setMode('map');
    this.app.drawer.close();
    this.root.classList.add('on');
    this.go(0);
  }
  stop() {
    this.tour = null;
    this.auto = false;
    clearTimeout(this.timer);
    this.root.classList.remove('on');
    this.app.clearPath();
  }
  go(k) {
    const t = this.tour;
    if (!t) return;
    this.k = Math.max(0, Math.min(t.steps.length - 1, k));
    const step = t.steps[this.k];
    const n = this.app.graph.nodes[step.i];
    this.app.select(step.i, { fly: true, keepPath: true, from: 'tour', zoom: 1.25 });
    this.render(n, step);
    clearTimeout(this.timer);
    if (this.auto && this.k < t.steps.length - 1) this.timer = setTimeout(() => this.go(this.k + 1), 6500);
    else if (this.auto) this.auto = false;
  }
  render(n, step) {
    const t = this.tour;
    this.root.innerHTML = '';
    this.root.style.setProperty('--gc', rgba(n.galaxy.rgb, 1));
    this.root.append(
      el('div', { class: 'tour-top' },
        el('b', { text: t.title }), el('span', { text: `${this.k + 1} / ${t.steps.length}` }), el('span', { class: 'grow' }),
        el('button', { class: 'icon-btn', 'aria-label': '结束航线', title: '结束（Esc）', html: ICON.close, onclick: () => this.stop() })),
      el('div', { class: 'tour-step-title', style: { color: rgba(n.galaxy.rgb, 1) }, text: n.t }),
      el('div', { class: 'tour-text scroll', html: step.html || n.s || '' }),
      el('div', { class: 'tour-progress' }, ...t.steps.map((_, k) => el('i', { class: k <= this.k ? 'on' : '' }))),
      el('div', { class: 'tour-nav' },
        el('button', { class: 'btn sm', html: `${this.auto ? ICON.pause : ICON.play}<span>${this.auto ? '暂停' : '自动'}</span>`, onclick: () => { this.auto = !this.auto; this.go(this.k); } }),
        el('button', { class: 'btn sm', disabled: this.k === 0, html: `${ICON.prev}<span>上一站</span>`, onclick: () => this.go(this.k - 1) }),
        this.k < t.steps.length - 1
          ? el('button', { class: 'btn primary sm', html: `<span>下一站</span>${ICON.next}`, onclick: () => this.go(this.k + 1) })
          : el('button', { class: 'btn gold sm', html: '<span>完成航线</span>', onclick: () => { this.app.toast(`航线「${escapeHtml(t.title)}」完成`); this.stop(); } })));
    renderMath(this.root);
  }
}
