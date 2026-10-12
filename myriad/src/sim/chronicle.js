// The chronicle: everything noteworthy that happens is written down as an entry with a category,
// an importance (1 minor … 3 epochal), a place and the nations involved. The UI reads it as the
// world's history book; the director camera flies to important entries.

import { year, notify } from './state.js';

export const CATS = {
  nature: { name: '自然', color: '#7fc4a0' },
  life: { name: '生命', color: '#9fd36b' },
  civ: { name: '文明', color: '#e8c070' },
  war: { name: '战争', color: '#e86b5a' },
  faith: { name: '信仰', color: '#c79bff' },
  science: { name: '科技', color: '#6bc3ff' },
  society: { name: '社会', color: '#ffa86b' },
  culture: { name: '文化', color: '#ff86c8' },
  divine: { name: '神迹', color: '#ffe27a' },
};

const MAX = 4000;

export function log(w, cat, text, opts = {}) {
  const e = {
    t: w.tick,
    year: year(w),
    cat,
    text,
    imp: opts.imp || 1,
    x: opts.x ?? null,
    y: opts.y ?? null,
    nations: opts.nations || null,
    id: (w.chronicleSeq = (w.chronicleSeq || 0) + 1),
  };
  if (!w.chronicle) w.chronicle = [];
  w.chronicle.push(e);
  if (w.chronicle.length > MAX) {
    // drop the oldest minor entries first so the great events survive
    const keep = [];
    let dropped = 0;
    for (const x of w.chronicle) {
      if (dropped < 500 && x.imp < 2) { dropped++; continue; }
      keep.push(x);
    }
    w.chronicle = keep.length > MAX ? keep.slice(keep.length - MAX) : keep;
  }
  if (e.imp >= 2) notify(w, { kind: 'chronicle', entry: e });
  return e;
}
