// Village life: villagers with trades (farmer, shepherd, smith, cartographer, scholar) who keep
// a daily routine — out and about by day, home behind their door at night or in the rain, wary
// of shadows — and stalls that restock every morning. Woven coins are the village currency.
// Cartographers sell treasure maps: unrolled, a map marks a buried chest a few hundred blocks
// away (it is laid into the ground when that land loads), and the HUD points the way while the
// map is in hand.

import { I, ITEMS } from '../world/items.js';
import { B, ID_MASK, SOLID, LIQUID } from '../world/blocks.js';
import { h, Screen } from '../ui/ui.js';
import { iconURL } from '../render/icons.js';

export const PROF_LIST = ['farmer', 'shepherd', 'smith', 'cartographer', 'scholar'];
export const PROF_ZH = { farmer: '农夫', shepherd: '牧羊人', smith: '铁匠', cartographer: '制图师', scholar: '学者' };
const GREETING = {
  farmer: '“今年的麦子长得真好。你要是有多余的收成，我都收。”',
  shepherd: '“羊毛暖和，云绒更暖和。要做睡袋吗？”',
  smith: '“铁要趁热打。给我矿石和煤，我给你结实的家伙。”',
  cartographer: '“地图上每一块空白，都是一个等着被讲出来的故事。”',
  scholar: '“织者留下的字句散落各地……你见过那些手记吗？”',
};
// buy: the villager takes [item, n] for coins; sell: the villager gives [item, n] for coins
const OFFERS = {
  farmer: {
    buy: [['wheat', 18, 1], ['radish', 14, 1], ['sunroot', 12, 1], ['berries', 16, 1], ['crabapple', 10, 1], ['melon_slice', 12, 1]],
    sell: [['bread', 4, 1], ['honey_bread', 2, 1], ['wheat_seeds', 10, 1], ['melon_seeds', 4, 1], ['bone_meal', 8, 1], ['baked_sunroot', 6, 1], ['lantern_melon', 1, 2]],
  },
  shepherd: {
    buy: [['fluff', 10, 1], ['string', 12, 1], ['leather', 6, 1], ['raw_venison', 8, 1]],
    sell: [['felt_white', 4, 1], ['felt_red', 4, 1], ['felt_teal', 4, 1], ['bed', 1, 3], ['carpet_red', 6, 1], ['shears', 1, 3], ['glider', 1, 8]],
  },
  smith: {
    buy: [['coal', 16, 1], ['raw_iron', 6, 1], ['raw_copper', 10, 1], ['iron_ingot', 4, 1], ['gold_ingot', 1, 2]],
    sell: [['iron_pickaxe', 1, 6], ['iron_sword', 1, 6], ['iron_axe', 1, 5], ['iron_helmet', 1, 6], ['iron_chestplate', 1, 10], ['bucket', 1, 3], ['lantern', 2, 1], ['arrow', 12, 1], ['flint_steel', 1, 2]],
  },
  cartographer: {
    buy: [['paper', 18, 1], ['glass', 8, 1], ['book', 3, 1]],
    sell: [['treasure_map', 1, 5], ['treasure_map', 1, 5], ['shard_chart', 1, 12], ['spyglass', 1, 4], ['waystone', 1, 8], ['torch', 16, 1]],
  },
  scholar: {
    buy: [['book', 2, 1], ['glow_spore', 6, 1], ['bone', 12, 1]],
    sell: [['crystal_dust', 8, 2], ['echo_crystal', 1, 9], ['lore_page', 1, 3], ['star_candy', 1, 4], ['feather_charm', 1, 12], ['bookshelf', 1, 2], ['lantern_staff', 1, 10]],
  },
};
export const VILLAGE_OFFERS = OFFERS;

const hashRand = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

export function villagerOffers(prof, seed) {
  const o = OFFERS[prof] || OFFERS.farmer;
  const rnd = hashRand(seed * 2654435761);
  const pick = (list, n) => list.map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
  const out = [];
  for (const [name, n, coins] of pick(o.buy, 2)) out.push({ give: [name, n], get: ['weave_coin', coins], left: 8 });
  const sells = pick(o.sell, 4);
  if (prof === 'cartographer' && !sells.some((s) => s[0] === 'treasure_map')) sells[0] = o.sell[0];
  for (const [name, n, coins] of sells) out.push({ give: ['weave_coin', coins], get: [name, n], left: name === 'treasure_map' ? 2 : 4 });
  return out.filter((x) => I[x.give[0]] !== undefined && I[x.get[0]] !== undefined);
}

class VillageTradeScreen extends Screen {
  constructor(game, v) { super(); this.game = game; this.v = v; }
  build() {
    const prof = this.v.prof || 'farmer';
    this.list = h('div', { class: 'trade-list' });
    const el = h('div', { class: 'screen' }, h('div', { class: 'panel menu-panel' },
      h('div', { class: 'title' }, `村民 · ${PROF_ZH[prof]}`),
      h('div', { class: 'dim small', style: { marginBottom: '10px' } }, GREETING[prof]),
      this.list,
      h('div', { class: 'dim small', style: { marginTop: '8px' } }, '货架每天清晨补货。织纹币可以在村落之间通用。'),
      h('div', { class: 'menu-row' }, h('button', { class: 'btn primary', onclick: () => this.close() }, '离开'))));
    this.render();
    return el;
  }
  render() {
    const inv = this.game.inventory;
    this.list.innerHTML = '';
    for (const o of this.v.offers) {
      const [gn, gc] = o.give, [rn, rc] = o.get;
      const ok = inv.count(I[gn]) >= gc && o.left > 0;
      const row = h('div', { class: `trade-row ${ok ? '' : 'off'}` },
        h('div', { class: 'tr-side' }, h('img', { src: iconURL(I[gn]) }), h('span', {}, `${ITEMS[I[gn]].zh} ×${gc}`), h('b', { class: 'dim' }, `（有 ${inv.count(I[gn])}）`)),
        h('div', { class: 'tr-arrow' }, '→'),
        h('div', { class: 'tr-side' }, h('img', { src: iconURL(I[rn]) }), h('span', {}, `${ITEMS[I[rn]].zh} ×${rc}`)),
        h('button', { class: 'btn small primary', ...(ok ? {} : { disabled: true }), onclick: () => this.trade(o) }, o.left > 0 ? `交易（余 ${o.left}）` : '售罄'));
      row.addEventListener('mouseenter', () => ITEMS[I[rn]].desc && this.ui.showTip(`<div class="tt-name">${ITEMS[I[rn]].zh}</div><div class="tt-desc">${ITEMS[I[rn]].desc}</div>`));
      row.addEventListener('mouseleave', () => this.ui.hideTip());
      this.list.appendChild(row);
    }
  }
  trade(o) {
    const g = this.game, inv = g.inventory;
    const [gn, gc] = o.give, [rn, rc] = o.get;
    if (inv.count(I[gn]) < gc || o.left <= 0) return;
    inv.remove(I[gn], gc);
    const left = inv.add(I[rn], rc);
    if (left) g.dropStack({ id: I[rn], n: left });
    o.left--;
    g.audio && g.audio.play('craft');
    g.emit('traded', rn, this.v.prof);
    this.render();
  }
  close() { this.ui && this.ui.hideTip(); super.close(); }
  onKey(e) { if (e.code === 'Escape' || e.code === 'KeyE') { this.close(); return true; } return true; }
}

const DIR8 = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
const dirName = (dx, dz) => DIR8[Math.round(((Math.atan2(dx, -dz) / (Math.PI * 2)) * 8 + 8)) % 8];

export function installVillage(game, state) {
  const s = (state && state.village) || {};
  game.treasures = (s.treasures || []).map((t) => ({ ...t }));
  game.stateSavers.push((st) => { st.village = { treasures: game.treasures }; });

  // ---- villagers come with their houses (and a few sheep with the shepherd)
  const prevFeatures = game.onFeatures;
  game.onFeatures = (c, features) => {
    for (const f of features) {
      if (f.type === 'villager') {
        const m = game.spawnMob('villager', f.x + 0.5, f.y, f.z + 0.5, { persist: true });
        if (m) { m.prof = f.prof; m.home = f.home ? { x: f.home[0] + 0.5, y: f.home[1], z: f.home[2] + 0.5 } : { x: f.x + 0.5, y: f.y, z: f.z + 0.5 }; m.variant = Math.max(0, PROF_LIST.indexOf(f.prof)); }
      } else if (f.type === 'pen') {
        for (let k = 0; k < 2; k++) game.spawnMob('sheep', f.x + 0.5 + k, f.y, f.z + 0.5, { persist: true });
      }
    }
    if (prevFeatures) prevFeatures(c, features);
  };

  // ---- trading: villagers open their own stall
  const prevTrade = game.openTrade;
  game.openTrade = (m) => {
    if (m.kind !== 'villager') { prevTrade && prevTrade(m); return; }
    if (!m.offers) m.offers = villagerOffers(m.prof || 'farmer', (m.home ? Math.floor(m.home.x) * 73856093 ^ Math.floor(m.home.z) * 19349663 : m.id) >>> 0);
    if (m.restockDay !== game.day) { m.restockDay = game.day; for (const o of m.offers) o.left = Math.max(o.left, o.give[0] === 'weave_coin' ? 4 : 8); }
    game.app.ui.push(new VillageTradeScreen(game, m));
  };

  // ---- treasure maps
  const prevUse = game.useSpecialItem;
  game.useSpecialItem = (held, def, hit, fresh) => {
    if (def.use === 'treasure') {
      if (!fresh) return true;
      const p = game.player;
      let t = held.tag && held.tag.tx !== undefined ? { x: held.tag.tx, z: held.tag.tz } : null;
      if (!t) {
        // pick dry land 140..320 blocks away
        for (let k = 0; k < 40 && !t; k++) {
          const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 180;
          const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
          const c = game.gen.column(x, z);
          if (c.h > 63 && c.h < 120 && c.island < 0.05 && !c.river) t = { x, z };
        }
        if (!t) { game.hud.message('地图上的墨迹模糊不清……换个地方再展开试试。'); return true; }
        held.tag = { tx: t.x, tz: t.z, label: `标记：${t.x}, ${t.z}` };
        game.inventory.changed();
      }
      if (!game.treasures.some((q) => q.x === t.x && q.z === t.z)) game.treasures.push({ x: t.x, z: t.z, placed: false, found: false });
      if (!game.chartMarks.some((m) => m.x === t.x && m.z === t.z)) game.chartMarks.push({ x: t.x, z: t.z, kind: 'treasure' });
      const d = Math.round(Math.hypot(t.x - p.x, t.z - p.z));
      game.hud.toast('藏宝图展开了', `宝藏埋在${dirName(t.x - p.x, t.z - p.z)}方向约 ${d} 格（${t.x}, ${t.z}）。已标在地图上（M），拿着地图时屏幕下方会指路。到了之后向下挖。`, 'discover', 8000);
      game.audio && game.audio.play('discover');
      return true;
    }
    return prevUse ? prevUse(held, def, hit, fresh) : false;
  };
  // bury the chest when its land is loaded
  const bury = (c) => {
    for (const t of game.treasures) {
      if (t.placed || (t.x >> 4) !== c.cx || (t.z >> 4) !== c.cz) continue;
      const w = game.world;
      let y = w.surfaceY(t.x, t.z);
      while (y > 2 && (!SOLID[w.getId(t.x, y, t.z)] || LIQUID[w.getId(t.x, y, t.z)])) y--;
      const cy = Math.max(3, y - 2);
      w.setBlock(t.x, cy, t.z, B.chest);
      w.setBE(t.x, cy, t.z, { kind: 'chest', slots: new Array(27).fill(null), loot: 'treasure' });
      t.placed = true; t.y = cy;
    }
  };
  game.chunks.onChunkLoaded.push(bury);
  for (const c of game.world.chunks.values()) if (c.ready) bury(c);

  // the map in hand points the way
  const hint = document.createElement('div');
  hint.className = 'treasure-hint';
  game.hud.root.appendChild(hint);
  let last = '';
  game.addSystem({
    frame(g) {
      const held = g.inventory.held();
      let txt = '';
      if (held && held.id === I.treasure_map && held.tag && held.tag.tx !== undefined) {
        const p = g.player, dx = held.tag.tx + 0.5 - p.x, dz = held.tag.tz + 0.5 - p.z, d = Math.hypot(dx, dz);
        const t = g.treasures.find((q) => q.x === held.tag.tx && q.z === held.tag.tz);
        if (t && t.found) txt = '这张地图上的宝藏已经被挖出来了';
        else if (d < 2) txt = '✕ 就是这里！向下挖掘';
        else {
          // relative arrow: the angle between where you look and where the treasure is
          const want = Math.atan2(-dx, -dz);
          let rel = want - p.yaw;
          while (rel > Math.PI) rel -= Math.PI * 2;
          while (rel < -Math.PI) rel += Math.PI * 2;
          const arrows = ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'];
          txt = `${arrows[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8]} 宝藏 · ${dirName(dx, dz)} ${Math.round(d)} 格`;
        }
      }
      if (txt !== last) { last = txt; hint.textContent = txt; hint.classList.toggle('on', !!txt); }
    },
  });
  game.on('openContainer', (x, y, z) => {
    for (const t of game.treasures) if (t.placed && !t.found && t.x === x && t.z === z) { t.found = true; game.emit('treasureFound'); game.hud.toast('找到宝藏了！', '织纹币、宝石和远方的纪念品。', 'achievement', 5000); }
  });
}
void ID_MASK;
