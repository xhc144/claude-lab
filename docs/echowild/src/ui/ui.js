// Screen manager and shared widgets (item slots, tooltips, the stack held on the cursor).

import { iconURL } from '../render/icons.js';
import { ITEMS, maxStack } from '../world/items.js';

export const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  return e;
};

export function itemTooltip(st) {
  const d = ITEMS[st.id];
  if (!d) return '';
  let s = `<div class="tt-name">${d.zh}</div>`;
  if (d.food) s += `<div class="tt-line food">饱食度 +${d.food.hunger}</div>`;
  if (d.tool && d.tool.dmg) s += `<div class="tt-line">攻击伤害 ${d.tool.dmg.toFixed(1)}</div>`;
  if (d.tool && d.tool.speed && d.tool.type !== 'sword') s += `<div class="tt-line">挖掘速度 ×${d.tool.speed}</div>`;
  if (d.armor) s += `<div class="tt-line">护甲 +${d.armor.points}</div>`;
  const dur = (d.tool && d.tool.dur) || (d.armor && d.armor.dur);
  if (dur) s += `<div class="tt-line dim">耐久 ${Math.max(0, Math.round(dur - (st.dmg || 0)))} / ${Math.round(dur)}</div>`;
  if (d.desc) s += `<div class="tt-desc">${d.desc}</div>`;
  if (st.tag && st.tag.label) s += `<div class="tt-desc">${st.tag.label}</div>`;
  return s;
}

export class UIManager {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.stack = [];          // open screens
    this.cursor = null;       // item stack held by the mouse
    this.cursorEl = h('div', { class: 'cursor-stack' }, h('img'), h('span'));
    this.tip = h('div', { class: 'tooltip' });
    root.appendChild(this.cursorEl);
    root.appendChild(this.tip);
    this.mouse = [0, 0];
    window.addEventListener('mousemove', (e) => {
      this.mouse = [e.clientX, e.clientY];
      this.cursorEl.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 22}px)`;
      if (this.tip.style.display === 'block') this.placeTip();
    });
    this.hoverSlot = null;
  }

  get top() { return this.stack[this.stack.length - 1] || null; }
  get open() { return this.stack.length > 0 ? this.top : null; }

  push(screen) {
    if (this.top && this.top.onHide) this.top.onHide();
    this.stack.push(screen);
    screen.ui = this;
    if (!screen.el) screen.el = screen.build();
    this.root.appendChild(screen.el);
    if (screen.onShow) screen.onShow();
    this.app.onScreensChanged();
    return screen;
  }
  pop(screen = this.top) {
    const i = this.stack.indexOf(screen);
    if (i < 0) return;
    this.stack.splice(i, 1);
    if (screen.onClose) screen.onClose();
    screen.el.remove();
    this.hideTip();
    if (!this.stack.length) this.returnCursor();
    if (this.top && this.top.onShow) this.top.onShow();
    this.app.onScreensChanged();
  }
  replace(screen) { while (this.stack.length) this.pop(); this.push(screen); }
  closeAll() { while (this.stack.length) this.pop(); }

  // cursor stack ------------------------------------------------------------
  setCursor(st) {
    this.cursor = st && st.n > 0 ? st : null;
    const img = this.cursorEl.firstChild, cnt = this.cursorEl.lastChild;
    if (this.cursor) {
      img.src = iconURL(this.cursor.id);
      cnt.textContent = this.cursor.n > 1 ? this.cursor.n : '';
      this.cursorEl.style.display = 'block';
      this.hideTip();
    } else this.cursorEl.style.display = 'none';
  }
  returnCursor() {
    if (!this.cursor) return;
    const g = this.app.game;
    if (g) {
      const left = g.inventory.addStack(this.cursor);
      if (left > 0) g.dropStack({ ...this.cursor, n: left });
    }
    this.setCursor(null);
  }

  // tooltips ----------------------------------------------------------------
  showTip(html) {
    if (!html || this.cursor) { this.hideTip(); return; }
    this.tip.innerHTML = html;
    this.tip.style.display = 'block';
    this.placeTip();
  }
  placeTip() {
    const [x, y] = this.mouse;
    const r = this.tip.getBoundingClientRect();
    let tx = x + 16, ty = y + 14;
    if (tx + r.width > innerWidth - 8) tx = x - r.width - 12;
    if (ty + r.height > innerHeight - 8) ty = innerHeight - r.height - 8;
    this.tip.style.transform = `translate(${tx}px, ${ty}px)`;
  }
  hideTip() { this.tip.style.display = 'none'; }

  // A slot widget bound to get/set functions. opts: { accept(st) -> bool, takeOnly, onChange, quickMove(e) }
  slot(get, set, opts = {}) {
    const el = h('div', { class: `islot ${opts.cls || ''}` }, h('img', { draggable: 'false' }), h('span', { class: 'n' }), h('span', { class: 'dur' }));
    if (opts.placeholder) el.appendChild(h('span', { class: 'ph', html: opts.placeholder }));
    const img = el.children[0], cnt = el.children[1], dur = el.children[2];
    const ph = opts.placeholder ? el.children[3] : null;
    let lastKey = null;
    const refresh = () => {
      const st = get();
      const key = st ? `${st.id}:${st.n}:${st.dmg || 0}` : '';
      if (key === lastKey) return;
      lastKey = key;
      if (st) {
        img.src = iconURL(st.id); img.style.display = '';
        cnt.textContent = st.n > 1 ? st.n : '';
        const d = ITEMS[st.id];
        const md = (d.tool && d.tool.dur) || (d.armor && d.armor.dur);
        if (md && st.dmg) { const f = 1 - st.dmg / md; dur.style.display = 'block'; dur.style.width = `${Math.max(5, f * 78)}%`; dur.style.background = `hsl(${f * 120},80%,50%)`; }
        else dur.style.display = 'none';
        if (ph) ph.style.display = 'none';
      } else {
        img.style.display = 'none'; cnt.textContent = ''; dur.style.display = 'none';
        if (ph) ph.style.display = '';
      }
    };
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.clickSlot(e, get, set, opts);
      refresh();
      this.hideTip();
      if (opts.onChange) opts.onChange();
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('mouseenter', () => { this.hoverSlot = { get, set, opts }; const st = get(); if (st) this.showTip(itemTooltip(st)); });
    el.addEventListener('mouseleave', () => { if (this.hoverSlot && this.hoverSlot.get === get) this.hoverSlot = null; this.hideTip(); });
    el.refresh = refresh;
    refresh();
    return el;
  }

  clickSlot(e, get, set, opts) {
    const cur = this.cursor;
    const st = get();
    if (e.shiftKey && opts.quickMove) { if (st) opts.quickMove(); return; }
    if (opts.takeOnly) {
      if (!st) return;
      if (!cur) { this.setCursor({ ...st }); set(null); }
      else if (cur.id === st.id && !cur.dmg && !st.dmg && cur.n + st.n <= maxStack(st.id)) { this.setCursor({ ...cur, n: cur.n + st.n }); set(null); }
      if (opts.onTake) opts.onTake(st);
      return;
    }
    const accept = (s) => !opts.accept || opts.accept(s);
    if (e.button === 2) {
      if (!cur && st) {
        const half = Math.ceil(st.n / 2);
        this.setCursor({ ...st, n: half });
        set(st.n - half > 0 ? { ...st, n: st.n - half } : null);
      } else if (cur && accept(cur)) {
        if (!st) { set({ ...cur, n: 1 }); this.setCursor(cur.n > 1 ? { ...cur, n: cur.n - 1 } : null); }
        else if (st.id === cur.id && !st.dmg && !cur.dmg && st.n < maxStack(st.id)) { set({ ...st, n: st.n + 1 }); this.setCursor(cur.n > 1 ? { ...cur, n: cur.n - 1 } : null); }
      }
      return;
    }
    if (!cur) { if (st) { this.setCursor({ ...st }); set(null); } return; }
    if (!accept(cur)) return;
    if (!st) {
      const lim = opts.limit || maxStack(cur.id);
      if (cur.n > lim) { set({ ...cur, n: lim }); this.setCursor({ ...cur, n: cur.n - lim }); } else { set({ ...cur }); this.setCursor(null); }
      return;
    }
    if (st.id === cur.id && !st.dmg && !cur.dmg && !st.tag && !cur.tag) {
      const ms = Math.min(opts.limit || 99, maxStack(st.id));
      const k = Math.min(ms - st.n, cur.n);
      set({ ...st, n: st.n + k });
      this.setCursor(cur.n - k > 0 ? { ...cur, n: cur.n - k } : null);
      return;
    }
    set({ ...cur }); this.setCursor({ ...st });
  }
}

export class Screen {
  constructor() { this.el = null; this.ui = null; this.capturesGame = true; }
  build() { return h('div', { class: 'screen' }); }
  close() { this.ui.pop(this); }
  // return true when the key was handled
  onKey() { return false; }
}
