// Laying out a level's starting cards on the board.

import { CARDS } from '../data/cards.js';
import { CARD_W, CARD_H } from './constants.js';

const ZONE_BY_KIND = {
  folk: 'camp', structure: 'camp', wonder: 'camp', resource: 'camp', food: 'camp', tool: 'camp', gear: 'camp',
  knowledge: 'camp', coin: 'camp', bundle: 'camp', misc: 'camp', node: 'near', beast: 'mid', region: 'frontier',
  enemy: 'edge', lair: 'edge', event: 'camp',
};

export function setupLevel(g) {
  const L = g.level;
  const W = g.board.w, H = g.board.h;
  const cx = W * (L.campAt ? L.campAt[0] : 0.5), cy = H * (L.campAt ? L.campAt[1] : 0.55);
  let regionIdx = 0;
  const regionsTotal = (L.start || []).filter((e) => CARDS[e.c].kind === 'region' && !e.at).reduce((a, e) => a + (e.n || 1), 0);
  for (const e of L.start || []) {
    const def = CARDS[e.c];
    if (!def) throw new Error('level ' + L.id + ': unknown card ' + e.c);
    const n = e.n || 1;
    const zone = e.zone || ZONE_BY_KIND[def.kind] || 'camp';
    const pile = e.pile ?? ['resource', 'food', 'knowledge', 'coin'].includes(def.kind);
    let pileStack = null;
    for (let i = 0; i < n; i++) {
      const props = {};
      for (const k of ['fuel', 'ch', 'once', 'loot', 'foes', 'danger', 'reveal', 'name', 'store', 'hp']) if (e[k] !== undefined) props[k] = Array.isArray(e[k]) ? e[k].slice() : e[k];
      const c = g.newCard(e.c, props);
      if (pile && pileStack) {
        pileStack.cards.push(c.id);
        c.s = pileStack.id;
        continue;
      }
      let x, y;
      if (e.at) {
        x = e.at[0] * W - CARD_W / 2 + i * (CARD_W + 20);
        y = e.at[1] * H - CARD_H / 2;
      } else if (zone === 'frontier') {
        // regions line up along the top of the board like a map of the unknown
        const span = Math.min(W - 400, regionsTotal * (CARD_W + 70));
        x = W / 2 - span / 2 + (regionIdx + 0.5) * (span / Math.max(1, regionsTotal)) - CARD_W / 2;
        y = Math.max(60, cy - 640 + (regionIdx % 2) * 40);
        regionIdx++;
      } else {
        const [r0, r1] = { camp: [0, 200], near: [260, 460], mid: [480, 700], far: [700, 950], edge: [900, 1300] }[zone] || [0, 200];
        const a = g.rng.next() * Math.PI * 2;
        const r = r0 + g.rng.next() * (r1 - r0);
        x = cx + Math.cos(a) * r - CARD_W / 2;
        y = cy + Math.sin(a) * r * 0.75 - CARD_H / 2;
        if (zone === 'edge') {
          x = Math.max(80, Math.min(W - 80 - CARD_W, x));
          y = Math.max(80, Math.min(H - 80 - CARD_H, y));
        }
      }
      const spot = e.at ? { x, y } : g.freeSpot(x, y, CARD_H);
      const st = g.makeStack([c.id], spot.x, spot.y);
      if (def.mob) g.initMob(c);
      if (e.wake === false && c.ai) c.ai.act = false;
      if (pile) pileStack = st;
    }
  }
  // tidy: no initial overlaps
  for (let i = 0; i < 30; i++) g.separate(true);
}
