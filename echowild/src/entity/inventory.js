// Player inventory: 9 hotbar + 27 backpack slots, 4 armour slots and an off-hand slot.
// A stack is { id, n, dmg? } (dmg = durability used).

import { ITEMS, maxStack } from '../world/items.js';

export const HOTBAR = 9, MAIN = 36, ARMOR0 = 36, OFFHAND = 40, SLOTS = 41;

export const stack = (id, n = 1, extra = null) => (extra ? { id, n, ...extra } : { id, n });
export const sameKind = (a, b) => a && b && a.id === b.id && !a.dmg && !b.dmg && !a.tag && !b.tag;

export class Inventory {
  constructor(size = SLOTS) {
    this.slots = new Array(size).fill(null);
    this.selected = 0;
    this.listeners = [];
  }
  changed() { for (const l of this.listeners) l(this); }
  get(i) { return this.slots[i]; }
  set(i, s) { this.slots[i] = s && s.n > 0 ? s : null; this.changed(); }
  held() { return this.slots[this.selected]; }

  // Add as much as possible; returns the number that did not fit.
  add(id, n = 1, extra = null) {
    const ms = maxStack(id);
    let left = n;
    if (!extra && ms > 1) {
      for (let pass = 0; pass < 2 && left > 0; pass++) {
        const range = pass === 0 ? [...Array(HOTBAR).keys()] : [...Array(MAIN - HOTBAR).keys()].map((k) => k + HOTBAR);
        for (const i of range) {
          const s = this.slots[i];
          if (s && s.id === id && !s.dmg && !s.tag && s.n < ms) {
            const k = Math.min(ms - s.n, left);
            s.n += k; left -= k;
            if (!left) break;
          }
        }
      }
    }
    for (let i = 0; i < MAIN && left > 0; i++) {
      if (!this.slots[i]) {
        const k = Math.min(ms, left);
        this.slots[i] = extra ? { id, n: k, ...extra } : { id, n: k };
        left -= k;
      }
    }
    this.changed();
    return left;
  }
  addStack(s) { return this.add(s.id, s.n, s.dmg || s.tag ? { dmg: s.dmg, tag: s.tag } : null); }

  count(id) { let c = 0; for (let i = 0; i < OFFHAND + 1; i++) { const s = this.slots[i]; if (s && s.id === id) c += s.n; } return c; }
  has(id, n = 1) { return this.count(id) >= n; }
  remove(id, n = 1) {
    let left = n;
    for (let i = MAIN - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const k = Math.min(s.n, left);
        s.n -= k; left -= k;
        if (!s.n) this.slots[i] = null;
      }
    }
    this.changed();
    return n - left;
  }
  consumeHeld(n = 1) {
    const s = this.held();
    if (!s) return false;
    s.n -= n;
    if (s.n <= 0) this.slots[this.selected] = null;
    this.changed();
    return true;
  }
  // wear down the held tool; returns true if it broke
  damageHeld(amount = 1) {
    const s = this.held();
    if (!s) return false;
    const d = ITEMS[s.id];
    const dur = d && d.tool && d.tool.dur;
    if (!dur) return false;
    s.dmg = (s.dmg || 0) + amount;
    if (s.dmg >= dur) { this.slots[this.selected] = null; this.changed(); return true; }
    this.changed();
    return false;
  }
  serialize() { return { slots: this.slots.map((s) => (s ? { ...s } : null)), selected: this.selected }; }
  load(o) {
    if (!o) return;
    this.slots = new Array(SLOTS).fill(null);
    (o.slots || []).forEach((s, i) => { if (s && ITEMS[s.id] && i < SLOTS) this.slots[i] = s; });
    this.selected = o.selected || 0;
    this.changed();
  }
}

// Generic container (chests etc.)
export class Container {
  constructor(n) { this.slots = new Array(n).fill(null); }
  add(id, n = 1, extra = null) {
    const ms = maxStack(id);
    let left = n;
    if (!extra) for (let i = 0; i < this.slots.length && left; i++) {
      const s = this.slots[i];
      if (s && s.id === id && !s.dmg && !s.tag && s.n < ms) { const k = Math.min(ms - s.n, left); s.n += k; left -= k; }
    }
    for (let i = 0; i < this.slots.length && left; i++) {
      if (!this.slots[i]) { const k = Math.min(ms, left); this.slots[i] = extra ? { id, n: k, ...extra } : { id, n: k }; left -= k; }
    }
    return left;
  }
  firstStack() { for (let i = 0; i < this.slots.length; i++) if (this.slots[i]) return i; return -1; }
  take(i, n = 1) {
    const s = this.slots[i];
    if (!s) return null;
    const k = Math.min(n, s.n);
    s.n -= k;
    const out = { ...s, n: k };
    if (!s.n) this.slots[i] = null;
    return out;
  }
  empty() { return this.slots.every((s) => !s); }
}
