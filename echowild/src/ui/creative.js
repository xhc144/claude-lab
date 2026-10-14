// Creative-mode tools: the item palette (every block and item, by group, searchable) and the
// world controls (time of day, daylight cycle, weather, spawning, rules, game mode). The world
// controls also open from the pause menu in any world where cheats are on.

import { h, Screen, itemTooltip } from './ui.js';
import { ITEMS, maxStack } from '../world/items.js';
import { iconURL } from '../render/icons.js';
import { clockString, DAY_TICKS } from '../render/sky.js';

export const GROUPS = [
  ['all', '全部', null],
  ['build', '建筑', ['build', 'color']],
  ['nature', '自然', ['nature', 'ore']],
  ['func', '功能', ['station', 'light', 'mech']],
  ['gear', '工具装备', ['tool', 'armor', 'gear']],
  ['food', '食物材料', ['food', 'material']],
  ['special', '奇物', ['ancient', 'special', 'quest']],
];

export function paletteItems(group, query) {
  const g = GROUPS.find((x) => x[0] === group) || GROUPS[0];
  const q = (query || '').trim();
  return ITEMS.filter((d) => d && (!g[2] || g[2].includes(d.cat)) && (!q || d.zh.includes(q) || d.name.includes(q.toLowerCase())));
}

// The palette panel. screen: the hosting inventory screen (for ui + refresh).
export function creativePalette(screen) {
  const ui = screen.ui, game = screen.game, inv = game.inventory;
  const st = screen.creative || (screen.creative = { group: 'all', query: '' });
  const root = h('div', { class: 'creative' });
  const tabs = h('div', { class: 'cat-chips' });
  const grid = h('div', { class: 'palette-grid' });
  const search = h('input', { class: 'search', placeholder: '搜索物品…', value: st.query });
  search.addEventListener('keydown', (e) => e.stopPropagation());
  search.addEventListener('input', () => { st.query = search.value; render(); });
  const trash = h('div', { class: 'trash', title: '把物品拖到这里删除' }, '🗑');
  trash.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (ui.cursor) { ui.setCursor(null); game.audio && game.audio.play('pop'); }
  });
  const clearInv = h('button', { class: 'btn small', onclick: () => { for (let i = 0; i < 36; i++) inv.slots[i] = null; inv.changed(); screen.refresh(); } }, '清空背包');
  const count = h('div', { class: 'palette-count dim' });
  const render = () => {
    tabs.innerHTML = '';
    for (const [k, zh] of GROUPS) tabs.appendChild(h('button', { class: `chip ${st.group === k ? 'on' : ''}`, onclick: () => { st.group = k; render(); } }, zh));
    grid.innerHTML = '';
    const list = paletteItems(st.group, st.query);
    count.textContent = `${list.length} 种`;
    for (const d of list) {
      const t = h('div', { class: 'ptile', title: '' }, h('img', { src: iconURL(d.id), draggable: 'false' }));
      t.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (ui.cursor) { ui.setCursor(null); return; } // clicking the palette with a stack deletes it
        const full = maxStack(d.id);
        if (e.shiftKey) { inv.add(d.id, full); screen.refresh(); game.audio && game.audio.play('pickup'); return; }
        ui.setCursor({ id: d.id, n: e.button === 0 ? full : 1 });
      });
      t.addEventListener('contextmenu', (e) => e.preventDefault());
      t.addEventListener('mouseenter', () => ui.showTip(itemTooltip({ id: d.id, n: 1 })));
      t.addEventListener('mouseleave', () => ui.hideTip());
      grid.appendChild(t);
    }
    if (!list.length) grid.appendChild(h('div', { class: 'empty' }, '没有匹配的物品。'));
  };
  render();
  root.append(
    h('div', { class: 'book-tools' }, search, count, clearInv, trash),
    tabs,
    h('div', { class: 'hint' }, '左键拿起一组 · 右键拿起一个 · Shift+点击直接放进背包 · 拿着物品点这里即可删除'),
    grid);
  return root;
}

// World controls; usable inside the creative inventory or as its own screen.
export function worldControls(game, { onChange } = {}) {
  const rules = game.rules;
  const root = h('div', { class: 'world-ctl' });
  const clock = h('b', {});
  const slider = h('input', { type: 'range', min: 0, max: DAY_TICKS - 1, step: 50, value: Math.round(game.dayTime) });
  slider.addEventListener('input', () => { game.setTime(Number(slider.value)); sync(); });
  slider.addEventListener('keydown', (e) => e.stopPropagation());
  const presets = h('div', { class: 'seg' }, ...[['黎明', 23000], ['清晨', 500], ['正午', 6000], ['黄昏', 11800], ['入夜', 13500], ['午夜', 18000]]
    .map(([zh, t]) => h('button', { class: 'seg-b', onclick: () => { game.setTime(t); slider.value = t; sync(); } }, zh)));
  const toggle = (key, label, desc) => {
    const b = h('button', { class: `seg-b ${rules[key] ? 'on' : ''}` }, rules[key] ? '开' : '关');
    b.addEventListener('click', () => { rules[key] = !rules[key]; b.textContent = rules[key] ? '开' : '关'; b.classList.toggle('on', rules[key]); onChange && onChange(); });
    return h('div', { class: 'wc-row' }, h('div', {}, h('div', {}, label), h('div', { class: 'dim small' }, desc)), b);
  };
  const weatherBtns = h('div', { class: 'seg' });
  const renderWeather = () => {
    weatherBtns.innerHTML = '';
    const cur = game.weather ? game.weather.kind : 'clear';
    for (const [k, zh] of [['clear', '晴朗'], ['rain', '降雨'], ['storm', '雷暴']]) {
      weatherBtns.appendChild(h('button', { class: `seg-b ${cur === k ? 'on' : ''}`, onclick: () => {
        if (!game.weather) return;
        if (k === 'clear') game.weather.clear(); else game.weather.set(k, 1200);
        renderWeather();
      } }, zh));
    }
  };
  renderWeather();
  const modeBtns = h('div', { class: 'seg' });
  const renderMode = () => {
    modeBtns.innerHTML = '';
    for (const [m, zh] of [['survival', '生存'], ['creative', '创造']]) {
      modeBtns.appendChild(h('button', { class: `seg-b ${(game.player.creative ? 'creative' : 'survival') === m ? 'on' : ''}`, onclick: () => { game.setGameMode(m); renderMode(); onChange && onChange(); } }, zh));
    }
  };
  renderMode();
  const sync = () => { clock.textContent = `${clockString(game.dayTime)} · 第 ${game.day} 天`; };
  sync();
  const kill = h('button', { class: 'btn small', onclick: () => {
    let n = 0;
    for (const e of game.entities.list) if (e.def && e.def.hostile && !e.def.boss && !e.dead && Math.hypot(e.x - game.player.x, e.z - game.player.z) < 96) { e.dead = true; n++; }
    game.hud.message(`清除了 ${n} 只敌对生物`);
  } }, '清除附近敌对生物');
  const home = h('button', { class: 'btn small', onclick: () => { const s = game.spawnPoint || game.findSpawn(); game.teleport(s[0] + 0.5, s[1], s[2] + 0.5); } }, '回到出生点');
  root.append(
    h('div', { class: 'wc-sec' }, h('div', { class: 'wc-head' }, '时间 ', clock), slider, presets),
    toggle('daylightCycle', '时间流逝', '关闭后，时间停在当前时刻'),
    h('div', { class: 'wc-sec' }, h('div', { class: 'wc-head' }, '天气'), weatherBtns),
    toggle('weatherCycle', '天气变化', '关闭后，天气保持当前状态'),
    toggle('mobSpawning', '生物自然生成', '关闭后不再刷出新的动物和怪物'),
    toggle('keepInventory', '死亡不掉落', '死亡时保留背包里的物品'),
    h('div', { class: 'wc-sec' }, h('div', { class: 'wc-head' }, '游戏模式'), modeBtns),
    h('div', { class: 'menu-row' }, home, kill));
  root.refresh = () => { sync(); slider.value = Math.round(game.dayTime); renderWeather(); renderMode(); };
  return root;
}

export class WorldControlScreen extends Screen {
  constructor(app) { super(); this.app = app; this.pauses = true; }
  build() {
    const g = this.app.game;
    this.ctl = worldControls(g);
    return h('div', { class: 'screen' }, h('div', { class: 'panel menu-panel wc-panel' },
      h('div', { class: 'title' }, '世界控制'), this.ctl,
      h('div', { class: 'menu-row' }, h('button', { class: 'btn primary', onclick: () => this.close() }, '完成'))));
  }
  onKey(e) { if (e.code === 'Escape') { this.close(); return true; } return true; }
}
