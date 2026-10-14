// Inventory, container and furnace screens, and the station recipe book.

import { h, Screen } from './ui.js';
import { ITEMS, I, maxStack, ARMOR_SLOTS } from '../world/items.js';
import { RECIPES, STATIONS, STATION_RANK, CATS, TAG_ZH, tagItems, countHave, canCraft, maxCraft, consumeIngredients, recipeKnown, SMELT_BY_IN, fuelValue } from '../world/recipes.js';
import { iconURL } from '../render/icons.js';
import { B } from '../world/blocks.js';
import { creativePalette, worldControls } from './creative.js';

const ARMOR_PH = ['⛑', '🛡', '👖', '👢'];

function slotGrid(ui, inv, from, to, cols, opts = {}) {
  const grid = h('div', { class: 'slot-grid', style: { gridTemplateColumns: `repeat(${cols}, 50px)` } });
  const slots = [];
  for (let i = from; i < to; i++) {
    const k = i;
    const s = ui.slot(() => inv.slots[k], (v) => { inv.slots[k] = v; inv.changed && inv.changed(); }, { ...opts, quickMove: opts.quickMove ? () => opts.quickMove(k) : null });
    slots.push(s);
    grid.appendChild(s);
  }
  grid.refresh = () => slots.forEach((s) => s.refresh());
  return grid;
}

// Move a stack from one container slot into a target range; returns leftover count.
export function moveInto(src, si, dst, from, to, onlyEmpty = false) {
  const st = src.slots[si];
  if (!st) return;
  let left = st.n;
  const ms = maxStack(st.id);
  if (!onlyEmpty && !st.dmg && !st.tag) {
    for (let i = from; i < to && left; i++) {
      const d = dst.slots[i];
      if (d && d.id === st.id && !d.dmg && !d.tag && d.n < ms) { const k = Math.min(ms - d.n, left); d.n += k; left -= k; }
    }
  }
  for (let i = from; i < to && left; i++) {
    if (!dst.slots[i]) { dst.slots[i] = { ...st, n: left }; left = 0; }
  }
  src.slots[si] = left ? { ...st, n: left } : null;
  if (src.changed) src.changed();
  if (dst.changed) dst.changed();
}

function playerSection(ui, game, quickMove) {
  const inv = game.inventory;
  const wrap = h('div', { class: 'player-inv' });
  const main = slotGrid(ui, inv, 9, 36, 9, { quickMove });
  const bar = slotGrid(ui, inv, 0, 9, 9, { quickMove, cls: 'hb' });
  wrap.append(main, h('div', { class: 'gap' }), bar);
  wrap.refresh = () => { main.refresh(); bar.refresh(); };
  return wrap;
}

// ---------------------------------------------------------------- player inventory + recipe book
export class InventoryScreen extends Screen {
  constructor(game, station = null) {
    super();
    this.game = game;
    this.stations = this.availableStations(station);
    this.station = station && this.stations.includes(station) ? station : this.stations[this.stations.length - 1];
    this.cat = 'all';
    this.query = '';
    this.onlyCraftable = false;
    this.selected = null;
  }

  availableStations(forced) {
    const g = this.game, p = g.player, w = g.world;
    const found = new Set(['hand']);
    if (forced) found.add(forced);
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    for (let dy = -2; dy <= 3; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const id = w.getId(px + dx, py + dy, pz + dz);
      if (id === B.workbench) found.add('workbench');
      else if (id === B.resonator) found.add('resonator');
      else if (id === B.anvil_stone) found.add('forge');
    }
    if (g.player.creative) { found.add('workbench'); found.add('resonator'); found.add('forge'); }
    return ['hand', 'workbench', 'resonator', 'forge'].filter((s) => found.has(s));
  }

  quickMove(k) {
    const inv = this.game.inventory;
    const st = inv.slots[k];
    if (!st) return;
    const d = ITEMS[st.id];
    if (d.armor && !inv.slots[36 + d.armor.slot] && k < 36) { inv.slots[36 + d.armor.slot] = st; inv.slots[k] = null; inv.changed(); }
    else if (k >= 36) { moveInto(inv, k, inv, 9, 36); if (inv.slots[k]) moveInto(inv, k, inv, 0, 9); }
    else if (k < 9) moveInto(inv, k, inv, 9, 36);
    else moveInto(inv, k, inv, 0, 9);
    this.refresh();
  }

  build() {
    const ui = this.ui, g = this.game, inv = g.inventory;
    const el = h('div', { class: 'screen inv-screen' });
    const panel = h('div', { class: 'panel inv-panel' });
    // left: armour + off-hand + stats
    const armor = h('div', { class: 'armor-col' });
    this.armorSlots = ARMOR_SLOTS.map((_, s) => ui.slot(() => inv.slots[36 + s], (v) => { inv.slots[36 + s] = v; inv.changed(); this.refreshStats(); }, {
      accept: (st) => ITEMS[st.id].armor && ITEMS[st.id].armor.slot === s, limit: 1, placeholder: ARMOR_PH[s], cls: 'armor',
      quickMove: () => { moveInto(inv, 36 + s, inv, 9, 36); this.refresh(); },
    }));
    this.offSlot = ui.slot(() => inv.slots[40], (v) => { inv.slots[40] = v; inv.changed(); }, { placeholder: '✋', cls: 'armor', quickMove: () => { moveInto(inv, 40, inv, 9, 36); this.refresh(); } });
    armor.append(...this.armorSlots, h('div', { class: 'lbl' }, '副手'), this.offSlot);
    this.stats = h('div', { class: 'stats' });
    const left = h('div', { class: 'inv-left' }, h('div', { class: 'title' }, '背包'), h('div', { class: 'row' }, armor, this.stats));
    this.player = playerSection(ui, g, (k) => this.quickMove(k));
    left.appendChild(this.player);
    panel.appendChild(left);
    // right: recipe book
    this.book = h('div', { class: 'recipe-book' });
    panel.appendChild(this.book);
    el.appendChild(panel);
    el.addEventListener('mousedown', (e) => { if (e.target === el) { this.ui.returnCursor(); } });
    this.buildBook();
    this.refreshStats();
    this.unsub = () => {};
    const l = () => { this.refresh(); };
    inv.listeners.push(l);
    this.unsub = () => { const i = inv.listeners.indexOf(l); if (i >= 0) inv.listeners.splice(i, 1); };
    return el;
  }

  onClose() { this.unsub(); }

  refreshStats() {
    const g = this.game, p = g.player;
    const ap = g.armorPoints();
    this.stats.innerHTML = `<div>生命 <b>${Math.ceil(p.health)}</b> / ${p.maxHealth}</div><div>饱食 <b>${Math.ceil(p.hunger)}</b> / 20</div><div>护甲 <b>${ap}</b>（减伤 ${Math.round(Math.min(80, ap * 4))}%）</div><div class="dim">第 ${g.day} 天</div>`;
  }

  refresh() {
    this.player.refresh();
    this.armorSlots.forEach((s) => s.refresh());
    this.offSlot.refresh();
    this.refreshStats();
    this.renderRecipes();
  }

  buildBook() {
    const b = this.book;
    b.innerHTML = '';
    if (this.game.player.creative) {
      // creative: every item at hand, the recipe book (free crafting) and the world controls
      this.mode = this.mode || 'items';
      const modes = h('div', { class: 'mode-tabs' }, ...[['items', '物品'], ['book', '合成书'], ['world', '世界']].map(([k, zh]) =>
        h('button', { class: `mode-tab ${this.mode === k ? 'on' : ''}`, onclick: () => { this.mode = k; this.buildBook(); } }, zh)));
      b.appendChild(modes);
      if (this.mode === 'items') { this.grid = null; b.appendChild(creativePalette(this)); return; }
      if (this.mode === 'world') { this.grid = null; b.appendChild(worldControls(this.game)); return; }
    }
    const tabs = h('div', { class: 'station-tabs' });
    for (const s of this.stations) {
      tabs.appendChild(h('button', { class: `tab ${s === this.station ? 'on' : ''}`, onclick: () => { this.station = s; this.selected = null; this.buildBook(); } },
        h('img', { src: iconURL(I[STATIONS[s].icon]) }), STATIONS[s].zh));
    }
    const missing = ['workbench', 'resonator', 'forge'].filter((s) => !this.stations.includes(s));
    const hint = missing.length ? h('div', { class: 'hint' }, `靠近${missing.map((s) => STATIONS[s].zh).join('、')}可以解锁更多配方`) : null;
    const cats = h('div', { class: 'cat-chips' });
    for (const [k, zh] of [['all', '全部'], ...Object.entries(CATS)]) {
      cats.appendChild(h('button', { class: `chip ${this.cat === k ? 'on' : ''}`, onclick: () => { this.cat = k; this.buildBook(); } }, zh));
    }
    const search = h('input', { class: 'search', placeholder: '搜索配方…', value: this.query });
    search.addEventListener('input', () => { this.query = search.value.trim(); this.renderRecipes(); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    const only = h('label', { class: 'only' }, h('input', { type: 'checkbox', ...(this.onlyCraftable ? { checked: true } : {}) }), '只看可合成');
    only.firstChild.addEventListener('change', (e) => { this.onlyCraftable = e.target.checked; this.renderRecipes(); });
    this.grid = h('div', { class: 'recipe-grid' });
    this.detail = h('div', { class: 'recipe-detail' });
    b.append(tabs, hint || h('div'), h('div', { class: 'book-tools' }, search, only), cats, this.grid, this.detail);
    this.renderRecipes();
  }

  visibleRecipes() {
    const g = this.game, inv = g.inventory;
    const allowed = STATION_RANK[this.station];
    const known = g.discovered;
    const q = this.query;
    const out = [];
    for (const r of RECIPES) {
      if (!allowed.includes(r.station)) continue;
      if (this.cat !== 'all' && r.cat !== this.cat) continue;
      if (!g.player.creative && !recipeKnown(r, known)) continue;
      if (q && !ITEMS[r.out].zh.includes(q) && !ITEMS[r.out].name.includes(q)) continue;
      const ok = g.player.creative || canCraft(inv, r);
      if (this.onlyCraftable && !ok) continue;
      out.push({ r, ok });
    }
    out.sort((a, b) => (b.ok - a.ok) || (a.r.i - b.r.i));
    return out;
  }

  renderRecipes() {
    if (!this.grid) return;
    const list = this.visibleRecipes();
    this.grid.innerHTML = '';
    const total = RECIPES.filter((r) => STATION_RANK[this.station].includes(r.station)).length;
    for (const { r, ok } of list) {
      const t = h('div', { class: `rtile ${ok ? 'ok' : ''} ${this.selected === r ? 'sel' : ''}` }, h('img', { src: iconURL(r.out), draggable: 'false' }), r.n > 1 ? h('span', { class: 'n' }, r.n) : null);
      t.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.selected = r;
        if (e.shiftKey && ok) this.craft(r, this.game.player.creative ? 64 : maxCraft(this.game.inventory, r));
        else if (e.button === 0 && ok && this.lastClick === r && performance.now() - this.lastClickT < 350) this.craft(r, 1);
        this.lastClick = r; this.lastClickT = performance.now();
        this.renderRecipes();
      });
      t.addEventListener('mouseenter', () => this.ui.showTip(`<div class="tt-name">${ITEMS[r.out].zh}${r.n > 1 ? ` ×${r.n}` : ''}</div><div class="tt-line dim">${r.ins.map((i) => `${i.tag ? TAG_ZH[i.tag] : ITEMS[i.id].zh}×${i.n}`).join('　')}</div>`));
      t.addEventListener('mouseleave', () => this.ui.hideTip());
      this.grid.appendChild(t);
    }
    if (!list.length) this.grid.appendChild(h('div', { class: 'empty' }, this.onlyCraftable ? '还没有能合成的东西——去收集材料吧。' : '没有匹配的配方。'));
    const known = list.length;
    this.grid.appendChild(h('div', { class: 'count' }, `已发现配方 ${this.game.player.creative ? total : RECIPES.filter((r) => STATION_RANK[this.station].includes(r.station) && recipeKnown(r, this.game.discovered)).length} / ${total}`));
    void known;
    this.renderDetail();
  }

  renderDetail() {
    const d = this.detail, r = this.selected, inv = this.game.inventory;
    d.innerHTML = '';
    if (!r) { d.appendChild(h('div', { class: 'dim' }, '选择一个配方查看材料。双击合成一次，Shift+点击合成尽可能多。')); return; }
    const def = ITEMS[r.out];
    const creative = this.game.player.creative;
    const ok = creative || canCraft(inv, r);
    const head = h('div', { class: 'rd-head' }, h('img', { src: iconURL(r.out) }), h('div', {}, h('div', { class: 'rd-name' }, `${def.zh}${r.n > 1 ? ` ×${r.n}` : ''}`), h('div', { class: 'dim' }, `${STATIONS[r.station].zh} · ${CATS[r.cat] || ''}`)));
    const ings = h('div', { class: 'rd-ings' });
    for (const ing of r.ins) {
      const have = countHave(inv, ing);
      const icon = ing.tag ? tagItems(ing.tag)[Math.floor(performance.now() / 1000) % tagItems(ing.tag).length] : ing.id;
      ings.appendChild(h('div', { class: `ing ${have >= ing.n ? 'have' : 'miss'}` }, h('img', { src: iconURL(icon) }), h('span', {}, ing.tag ? TAG_ZH[ing.tag] : ITEMS[ing.id].zh), h('b', {}, `${Math.min(have, 999)}/${ing.n}`)));
    }
    const max = creative ? 64 : ok ? maxCraft(inv, r) : 0;
    const btns = h('div', { class: 'rd-btns' },
      h('button', { class: 'btn primary small', ...(ok ? {} : { disabled: true }), onclick: () => this.craft(r, 1) }, '合成'),
      h('button', { class: 'btn small', ...(max > 1 ? {} : { disabled: true }), onclick: () => this.craft(r, max) }, `全部 (${max})`));
    d.append(head, def.desc ? h('div', { class: 'rd-desc' }, def.desc) : h('div'), ings, btns);
  }

  craft(r, times) {
    const g = this.game, inv = g.inventory;
    if (g.player.creative) times = Math.max(1, Math.min(times, 64)); // creative crafting is free
    else {
      times = Math.max(1, Math.min(times, maxCraft(inv, r)));
      if (!canCraft(inv, r, times)) return;
      consumeIngredients(inv, r, times);
    }
    const total = r.n * times;
    const left = inv.add(r.out, total);
    if (left) g.dropStack({ id: r.out, n: left });
    g.audio && g.audio.play('craft');
    g.onCrafted && g.onCrafted(r.out, total);
    g.emit('crafted', r.out, total);
    this.refresh();
  }

  onKey(e) {
    if (e.code === 'KeyE' || e.code === 'Escape') { this.close(); return true; }
    const hs = this.ui.hoverSlot;
    if (hs && /^Digit[1-9]$/.test(e.code)) {
      const k = Number(e.code.slice(5)) - 1;
      const inv = this.game.inventory;
      const a = hs.get(), b = inv.slots[k];
      if (hs.opts.accept && b && !hs.opts.accept(b)) return true;
      hs.set(b ? { ...b } : null); inv.slots[k] = a ? { ...a } : null; inv.changed();
      this.refresh();
      return true;
    }
    if (hs && e.code === 'KeyQ') {
      const st = hs.get();
      if (st) { const n = e.ctrlKey ? st.n : 1; this.game.dropStack({ ...st, n }); hs.set(st.n - n > 0 ? { ...st, n: st.n - n } : null); this.refresh(); }
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- chests, hoppers, dispensers
export class ContainerScreen extends Screen {
  constructor(game, be, title, cols = 9) {
    super();
    this.game = game; this.be = be; this.title = title; this.cols = cols;
  }
  build() {
    const ui = this.ui, g = this.game, be = this.be;
    const inv = g.inventory;
    const cont = { slots: be.slots, changed: () => { g.markBEChanged(be); } };
    const el = h('div', { class: 'screen inv-screen' });
    const panel = h('div', { class: 'panel cont-panel' });
    this.cgrid = slotGrid(ui, cont, 0, be.slots.length, this.cols, { quickMove: (k) => { moveInto(cont, k, inv, 0, 36); this.refresh(); } });
    this.player = playerSection(ui, g, (k) => { moveInto(inv, k, cont, 0, be.slots.length); this.refresh(); });
    panel.append(h('div', { class: 'title' }, this.title), this.cgrid, h('div', { class: 'title sub' }, '背包'), this.player);
    el.appendChild(panel);
    const l = () => this.refresh();
    inv.listeners.push(l);
    this.unsub = () => { const i = inv.listeners.indexOf(l); if (i >= 0) inv.listeners.splice(i, 1); };
    this.timer = setInterval(() => this.refresh(), 250);
    return el;
  }
  refresh() { this.cgrid.refresh(); this.player.refresh(); }
  onClose() { this.unsub(); clearInterval(this.timer); if (this.be.onClose) this.be.onClose(this.game); this.game.audio && this.game.audio.play('chest_close'); }
  onKey(e) { if (e.code === 'KeyE' || e.code === 'Escape') { this.close(); return true; } return false; }
}

// ---------------------------------------------------------------- furnace
export class FurnaceScreen extends Screen {
  constructor(game, be) { super(); this.game = game; this.be = be; }
  build() {
    const ui = this.ui, g = this.game, be = this.be, inv = g.inventory;
    const cont = { slots: be.slots, changed: () => g.markBEChanged(be) };
    const el = h('div', { class: 'screen inv-screen' });
    const panel = h('div', { class: 'panel cont-panel furnace' });
    const mk = (i, opts = {}) => ui.slot(() => be.slots[i], (v) => { be.slots[i] = v; g.markBEChanged(be); }, { ...opts, quickMove: () => { moveInto(cont, i, inv, 0, 36); this.refresh(); } });
    this.sIn = mk(0, { accept: (st) => SMELT_BY_IN.has(st.id), placeholder: '矿' });
    this.sFuel = mk(1, { accept: (st) => fuelValue(st.id) > 0, placeholder: '🔥' });
    this.sOut = mk(2, { takeOnly: true, onTake: (st) => g.onSmeltTaken && g.onSmeltTaken(st) });
    this.flame = h('div', { class: 'flame' }, h('i'));
    this.arrow = h('div', { class: 'arrow' }, h('i'));
    const area = h('div', { class: 'furnace-area' }, h('div', { class: 'fcol' }, this.sIn, this.flame, this.sFuel), this.arrow, h('div', { class: 'fout' }, this.sOut));
    this.player = playerSection(ui, g, (k) => {
      const st = inv.slots[k];
      if (!st) return;
      if (SMELT_BY_IN.has(st.id)) moveInto(inv, k, cont, 0, 1);
      else if (fuelValue(st.id) > 0) moveInto(inv, k, cont, 1, 2);
      this.refresh();
    });
    panel.append(h('div', { class: 'title' }, '熔炉'), area, h('div', { class: 'title sub' }, '背包'), this.player);
    el.appendChild(panel);
    this.timer = setInterval(() => this.refresh(), 100);
    return el;
  }
  refresh() {
    const be = this.be;
    this.sIn.refresh(); this.sFuel.refresh(); this.sOut.refresh(); this.player.refresh();
    const recipe = be.slots[0] && SMELT_BY_IN.get(be.slots[0].id);
    this.arrow.firstChild.style.width = `${recipe ? Math.min(100, (be.progress || 0) / recipe.time * 100) : 0}%`;
    this.flame.firstChild.style.height = `${be.burnMax ? (be.burn / be.burnMax) * 100 : 0}%`;
  }
  onClose() { clearInterval(this.timer); }
  onKey(e) { if (e.code === 'KeyE' || e.code === 'Escape') { this.close(); return true; } return false; }
}
