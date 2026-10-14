// Mouse, touch and wheel on the board: drag cards (pick up a card and everything above it), drop
// them onto stacks, click to open/inspect, drag empty ground to pan, wheel or pinch to zoom.
// Every change to the world goes through app.playerAct → the same g.act* calls the AI uses.

import { CARDS } from '../data/cards.js';
import { RECIPES } from '../data/recipes.js';
import { matchStack } from '../sim/match.js';
import { store } from './store.js';

export class Input {
  constructor(app, canvas) {
    this.app = app;
    this.cv = canvas;
    this.state = 'idle';
    this.pointers = new Map();
    this.press = null;
    this.held = null;
    this.lastHoverT = 0;
    this.lastClick = { t: 0, id: null };
    const on = (t, f, o) => canvas.addEventListener(t, f.bind(this), o);
    on('pointerdown', this.down);
    on('pointermove', this.move);
    on('pointerup', this.up);
    on('pointercancel', this.cancel);
    on('pointerleave', this.leave);
    on('wheel', this.wheel, { passive: false });
    on('contextmenu', (e) => e.preventDefault());
  }

  get view() { return this.app.view; }
  get g() { return this.app.g; }

  pos(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  down(e) {
    if (!this.app.inGame || !this.g) return;
    this.app.audio.unlock();
    this.cv.setPointerCapture(e.pointerId);
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      // second finger: pinch-zoom (drop whatever the first finger was doing)
      if (this.state === 'drag') this.finishDrag(p, true);
      this.state = 'pinch';
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (e.button === 2 || e.button === 1) { this.state = 'pan'; this.last = p; return; }
    const hit = this.view.pickAt(p.x, p.y);
    if (hit) {
      this.state = 'press';
      this.press = { x: p.x, y: p.y, card: hit.card, sid: hit.st.id, t: performance.now() };
    } else {
      this.state = 'pan';
      this.last = p;
      this.press = { x: p.x, y: p.y, card: null, t: performance.now() };
    }
  }

  move(e) {
    if (!this.app.inGame || !this.g) return;
    const p = this.pos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    const v = this.view;
    if (this.state === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      v.autoCam = false;
      v.pan(mx - this.pinch.mx, my - this.pinch.my);
      if (this.pinch.d > 10) v.zoomAt(mx, my, d / this.pinch.d);
      this.pinch = { d, mx, my };
      return;
    }
    if (this.state === 'press') {
      if (Math.hypot(p.x - this.press.x, p.y - this.press.y) > 6) this.startDrag(p);
      return;
    }
    if (this.state === 'drag') { this.dragTo(p); return; }
    if (this.state === 'pan') {
      v.autoCam = false;
      v.pan(p.x - this.last.x, p.y - this.last.y);
      this.last = p;
      return;
    }
    // hover
    const now = performance.now();
    if (now - this.lastHoverT < 50) return;
    this.lastHoverT = now;
    const hit = v.pickAt(p.x, p.y);
    v.hoverSid = hit ? hit.st.id : null;
    this.cv.classList.toggle('over-card', !!hit);
    this.app.hud.inspect(hit ? hit.card : this.app.selected);
  }

  startDrag(p) {
    const g = this.g;
    const id = this.press.card;
    const can = g.canPick(id);
    if (!can.ok) {
      // creatures and fixed cards can't be dragged: pan instead
      const d = CARDS[g.s.cards[id]?.d];
      if (d && (d.kind === 'beast' || d.kind === 'enemy')) this.app.hud.toast(can.why, 'info');
      this.state = 'pan';
      this.last = p;
      return;
    }
    const v = this.view;
    const cv = v.views.get(id);
    const w = v.screenToWorld(this.press.x, this.press.y);
    const r = this.app.playerAct(() => g.actPick(id));
    if (!r.ok) { this.state = 'idle'; return; }
    this.held = r.sid;
    this.off = cv ? { x: w.x - cv.x, y: w.y - cv.y } : { x: 55, y: 20 };
    this.state = 'drag';
    this.cv.classList.add('dragging');
    this.app.audio.play('pick');
    this.dragTo(p);
  }

  dragTo(p) {
    const g = this.g, v = this.view;
    const st = g.s.stacks[this.held];
    if (!st) { this.state = 'idle'; return; }
    const w = v.screenToWorld(p.x, p.y);
    st.x = w.x - this.off.x;
    st.y = w.y - this.off.y;
    // edge scrolling while dragging near the screen border
    const m = 40;
    const ex = p.x < m ? -1 : p.x > v.w - m ? 1 : 0, ey = p.y < m ? -1 : p.y > v.h - m ? 1 : 0;
    if (ex || ey) { v.autoCam = false; v.pan(-ex * 12, -ey * 12); }
    const hit = v.pickAt(p.x, p.y);
    if (hit && hit.st.id !== this.held) {
      if (!v.drop || v.drop.sid !== hit.st.id) v.drop = { sid: hit.st.id, ok: true, label: this.preview(st, hit.st) };
    } else v.drop = null;
    this.app.dropHint(v.drop && v.drop.label, p);
  }

  /** what dropping the held stack on a target would do (known recipes only) */
  preview(held, target) {
    const g = this.g;
    const cards = [...target.cards, ...held.cards].map((id) => g.s.cards[id]);
    const td = CARDS[cards[0].d];
    if (td.kind === 'enemy' || td.kind === 'lair') return '⚔ 攻击';
    if (target.battle) return '⚔ 加入战斗';
    if (td.kind === 'beast' && !td.tags.includes('livestock')) return '⚔ 狩猎';
    const m = matchStack(cards, g.ctx);
    if (!m) return null;
    const r = RECIPES[m.r];
    if (r.hidden && !g.s.disc.includes(r.id) && !store().recipes.includes(r.id)) return '？ 似乎会发生什么';
    return '→ ' + r.name;
  }

  finishDrag(p, cancel = false) {
    const g = this.g, v = this.view;
    const st = g.s.stacks[this.held];
    this.cv.classList.remove('dragging');
    v.drop = null;
    this.app.dropHint(null);
    if (!st) { this.state = 'idle'; return; }
    const hit = cancel ? null : v.pickAt(p.x, p.y);
    const target = hit && hit.st.id !== this.held ? hit.st.id : null;
    const r = this.app.playerAct(() => g.actRelease(this.held, st.x, st.y, target));
    this.app.audio.play(target && r.ok ? 'stack' : 'drop');
    if (r && !r.ok && r.why && target) this.app.hud.toast(r.why, 'info');
    this.held = null;
    this.state = 'idle';
  }

  up(e) {
    if (!this.app.inGame || !this.g) return;
    const p = this.pos(e);
    this.pointers.delete(e.pointerId);
    if (this.state === 'pinch') { if (this.pointers.size === 0) this.state = 'idle'; return; }
    if (this.state === 'drag') { this.finishDrag(p); return; }
    if (this.state === 'press') {
      const now = performance.now();
      const id = this.press.card;
      const dbl = this.lastClick.id === id && now - this.lastClick.t < 350;
      this.lastClick = { t: now, id };
      this.app.clickCard(id, dbl);
    } else if (this.state === 'pan' && this.press && !this.press.card && Math.hypot(p.x - this.press.x, p.y - this.press.y) < 5) {
      this.app.clickCard(null);
    }
    this.state = 'idle';
    this.press = null;
  }

  cancel(e) {
    this.pointers.delete(e.pointerId);
    if (this.state === 'drag') this.finishDrag(this.pos(e), true);
    this.state = 'idle';
  }

  leave() {
    if (this.state === 'idle') { this.view.hoverSid = null; }
  }

  wheel(e) {
    if (!this.app.inGame || !this.g) return;
    e.preventDefault();
    const p = this.pos(e);
    this.view.autoCam = false;
    const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    if (e.ctrlKey || Math.abs(dy) >= Math.abs(e.deltaX)) this.view.zoomAt(p.x, p.y, Math.exp(-dy * 0.0015));
    else this.view.pan(-e.deltaX, 0);
  }
}
