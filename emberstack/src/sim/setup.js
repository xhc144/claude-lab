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
  // hostile cards with fixed positions: everything else keeps its distance from them
  const hostile = (L.start || []).filter((e) => e.at && ['enemy', 'lair'].includes(CARDS[e.c].kind)).map((e) => ({ x: e.at[0] * W, y: e.at[1] * H }));
  const safe = (x, y) => hostile.every((h) => Math.hypot(h.x - x - CARD_W / 2, h.y - y - CARD_H / 2) > 620);
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
      for (const k of ['fuel', 'ch', 'once', 'loot', 'foes', 'danger', 'reveal', 'name', 'store', 'hp', 'hint']) if (e[k] !== undefined) props[k] = Array.isArray(e[k]) ? e[k].slice() : e[k];
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
        // never put a region on a sleeping boss's doorstep: explorers would wake it
        for (let k = 0; k < 6 && !safe(x, y); k++) y += 120;
      } else {
        const [r0, r1] = { camp: [0, 240], near: [260, 480], mid: [480, 700], far: [700, 950], edge: [900, 1300] }[zone] || [0, 200];
        for (let tries = 0; tries < 30; tries++) {
          const a = g.rng.next() * Math.PI * 2;
          const r = r0 + g.rng.next() * (r1 - r0);
          x = cx + Math.cos(a) * r - CARD_W / 2;
          y = cy + Math.sin(a) * r * 0.75 - CARD_H / 2;
          if (zone === 'edge' || safe(x, y)) break;
        }
        if (zone === 'edge') {
          x = Math.max(80, Math.min(W - 80 - CARD_W, x));
          y = Math.max(80, Math.min(H - 80 - CARD_H, y));
        }
      }
      let spot = e.at ? { x, y } : g.freeSpot(x, y, CARD_H);
      if (!e.at && zone !== 'edge' && !safe(spot.x, spot.y)) {
        // pushed toward a boss by the crowd: try the other side of the camp
        spot = g.freeSpot(2 * cx - spot.x - CARD_W, 2 * cy - spot.y - CARD_H, CARD_H);
      }
      const st = g.makeStack([c.id], spot.x, spot.y);
      if (def.mob) g.initMob(c);
      if (e.wake === false && c.ai) c.ai.act = false;
      if (pile) pileStack = st;
    }
  }
  // tidy: no initial overlaps
  for (let i = 0; i < 30; i++) g.separate(true);
}
