// In-game HUD built from DOM elements: hotbar, vitals, crosshair, toasts, chat log, debug panel.

import { iconURL } from '../render/icons.js';
import { ITEMS, itemName } from '../world/items.js';
import { BIOMES } from '../world/biomes.js';
import { clockString } from '../render/sky.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
};

const HEART = (fill) => `<svg viewBox="0 0 9 9" width="18" height="18"><path d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H3V7H2V6H1V5H0V2h1z" fill="#2a0d12"/><path d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H3V6H2V5H1z" fill="${fill}"/><path d="M2 2h1v1H2z" fill="#ffd0d6" opacity="${fill === 'none' ? 0 : 0.9}"/></svg>`;
const HEART_HALF = `<svg viewBox="0 0 9 9" width="18" height="18"><path d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H3V7H2V6H1V5H0V2h1z" fill="#2a0d12"/><path d="M1 2h2v1h1v1h0.5v3H3V6H2V5H1z" fill="#e8384f"/></svg>`;
const FOOD = (fill) => `<svg viewBox="0 0 9 9" width="18" height="18"><path d="M3 0h3v1h1v1h1v4H7v1H6v1H5v1H2V8H1V7H0V4h1V3h1V1h1z" fill="#2a1a0d"/><path d="M3 1h3v1h1v4H6v1H5v1H2V7H1V4h1V3h1z" fill="${fill}"/><path d="M4 2h1v1H4z" fill="#fff4c8" opacity="${fill === 'none' ? 0 : 0.8}"/></svg>`;
const BUBBLE = `<svg viewBox="0 0 9 9" width="16" height="16"><circle cx="4.5" cy="4.5" r="3.6" fill="#7ad0ff" stroke="#123a5a" stroke-width="1"/><rect x="2.5" y="2.5" width="1.4" height="1.4" fill="#fff"/></svg>`;
const ARMOR = `<svg viewBox="0 0 9 9" width="16" height="16"><path d="M1 1h7v3H7v2H6v1H5v1H4V7H3V6H2V4H1z" fill="#cdd2d9" stroke="#2a2e34" stroke-width="0.8"/></svg>`;

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = el('div', 'hud', root);
    this.vignette = el('div', 'vignette', this.root);
    this.hurtFlash = el('div', 'hurt-flash', this.root);
    this.waterOverlay = el('div', 'water-overlay', this.root);
    this.cross = el('div', 'crosshair', this.root);
    this.crossRing = el('div', 'cross-ring', this.cross);
    this.topLeft = el('div', 'hud-topleft', this.root);
    this.clock = el('div', 'hud-clock', this.topLeft);
    this.place = el('div', 'hud-place', this.topLeft);
    this.goal = el('div', 'hud-goal', this.topLeft);
    this.effects = el('div', 'hud-effects', this.root);
    this.toasts = el('div', 'toasts', this.root);
    this.chat = el('div', 'chat-log', this.root);
    this.subtitle = el('div', 'hud-subtitle', this.root);
    this.debug = el('pre', 'debug', this.root);
    this.debug.style.display = 'none';
    this.bottom = el('div', 'hud-bottom', this.root);
    this.heldName = el('div', 'held-name', this.bottom);
    this.vitals = el('div', 'vitals', this.bottom);
    this.armorRow = el('div', 'armor-row', this.vitals);
    this.airRow = el('div', 'air-row', this.vitals);
    const row = el('div', 'vital-rows', this.vitals);
    this.hearts = el('div', 'hearts', row);
    this.food = el('div', 'food', row);
    this.heartEls = []; this.foodEls = [];
    for (let i = 0; i < 10; i++) { this.heartEls.push(el('span', 'heart', this.hearts)); this.foodEls.push(el('span', 'foodi', this.food)); }
    this.hotbar = el('div', 'hotbar', this.bottom);
    this.slots = [];
    for (let i = 0; i < 9; i++) {
      const s = el('div', 'slot', this.hotbar);
      const img = el('img', 'slot-icon', s);
      img.draggable = false;
      const cnt = el('span', 'slot-count', s);
      const dur = el('span', 'slot-dur', s);
      el('span', 'slot-key', s, String(i + 1));
      this.slots.push({ s, img, cnt, dur, key: '' });
    }
    this.offhand = el('div', 'slot offhand', this.bottom);
    this.offImg = el('img', 'slot-icon', this.offhand);
    this.offCnt = el('span', 'slot-count', this.offhand);
    this.last = {};
    this.heldNameTimer = 0;
    this.lastSelected = -1;
    this.visible = true;
  }

  setVisible(v) { this.visible = v; this.root.style.display = v ? '' : 'none'; }

  toast(title, body = '', kind = 'info', ms = 4200) {
    const t = el('div', `toast ${kind}`, this.toasts);
    el('div', 'toast-title', t, title);
    if (body) el('div', 'toast-body', t, body);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, ms);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  message(text, color = '') {
    const m = el('div', 'chat-line', this.chat, text);
    if (color) m.style.color = color;
    setTimeout(() => m.classList.add('fade'), 9000);
    setTimeout(() => m.remove(), 10500);
    while (this.chat.children.length > 8) this.chat.firstChild.remove();
  }

  showSubtitle(text, ms = 3000) {
    this.subtitle.textContent = text;
    this.subtitle.classList.add('show');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => this.subtitle.classList.remove('show'), ms);
  }

  update(dt) {
    const g = this.game, p = g.player, inv = g.inventory;
    if (!p || !inv) return;
    // hotbar
    for (let i = 0; i < 9; i++) {
      const st = inv.slots[i];
      const sl = this.slots[i];
      const key = st ? `${st.id}:${st.n}:${st.dmg || 0}` : '';
      if (key !== sl.key) {
        sl.key = key;
        if (st) {
          sl.img.src = iconURL(st.id); sl.img.style.display = '';
          sl.cnt.textContent = st.n > 1 ? st.n : '';
          const d = ITEMS[st.id];
          const dur = d && d.tool && d.tool.dur;
          if (dur && st.dmg) {
            const f = 1 - st.dmg / dur;
            sl.dur.style.display = 'block';
            sl.dur.style.width = `${Math.max(4, f * 80)}%`;
            sl.dur.style.background = `hsl(${f * 120}, 80%, 50%)`;
          } else sl.dur.style.display = 'none';
        } else { sl.img.style.display = 'none'; sl.cnt.textContent = ''; sl.dur.style.display = 'none'; }
      }
      sl.s.classList.toggle('sel', i === inv.selected);
    }
    const off = inv.slots[40];
    const okey = off ? `${off.id}:${off.n}` : '';
    if (okey !== this.last.off) {
      this.last.off = okey;
      if (off) { this.offImg.src = iconURL(off.id); this.offImg.style.display = ''; this.offCnt.textContent = off.n > 1 ? off.n : ''; this.offhand.style.display = ''; }
      else { this.offImg.style.display = 'none'; this.offCnt.textContent = ''; this.offhand.style.display = 'none'; }
    }
    if (inv.selected !== this.lastSelected) {
      this.lastSelected = inv.selected;
      const st = inv.held();
      this.heldName.textContent = st ? itemName(st.id) : '';
      this.heldNameTimer = 2.2;
    }
    this.heldNameTimer -= dt;
    this.heldName.style.opacity = Math.max(0, Math.min(1, this.heldNameTimer));

    // vitals
    const creative = p.creative;
    this.vitals.style.visibility = creative ? 'hidden' : 'visible';
    const hp = Math.ceil(p.health), hu = Math.ceil(p.hunger);
    const hkey = `${hp}:${hu}:${p.hurtTime > 0.3 ? 1 : 0}:${g.player.effects.glow ? 1 : 0}`;
    if (hkey !== this.last.vit) {
      this.last.vit = hkey;
      for (let i = 0; i < 10; i++) {
        const v = hp - i * 2;
        this.heartEls[i].innerHTML = v >= 2 ? HEART('#e8384f') : v === 1 ? HEART_HALF : HEART('none');
        const f = hu - i * 2;
        this.foodEls[9 - i].innerHTML = f >= 2 ? FOOD('#e0a040') : f === 1 ? FOOD('#9a6a30') : FOOD('none');
      }
      this.hearts.classList.toggle('hurt', p.hurtTime > 0.3);
    }
    this.hearts.classList.toggle('low', p.health <= 4 && !creative);
    // air
    const showAir = p.air < p.maxAir && !creative;
    const bubbles = Math.ceil((p.air / p.maxAir) * 10);
    if (`${showAir}:${bubbles}` !== this.last.air) {
      this.last.air = `${showAir}:${bubbles}`;
      this.airRow.innerHTML = showAir ? BUBBLE.repeat(bubbles) : '';
    }
    const ap = g.armorPoints ? g.armorPoints() : 0;
    if (ap !== this.last.ap) { this.last.ap = ap; this.armorRow.innerHTML = ap > 0 && !creative ? ARMOR.repeat(Math.ceil(ap / 2)) : ''; }

    // overlays
    this.hurtFlash.style.opacity = Math.min(0.55, p.hurtTime * 1.4);
    const uw = p.medium && p.medium.eyeWater;
    this.waterOverlay.style.opacity = uw ? 1 : 0;
    this.vignette.style.opacity = p.health <= 4 && !creative ? 0.5 + Math.sin(performance.now() / 300) * 0.15 : 0.18;

    // crosshair mining ring
    const mp = g.interaction ? g.interaction.progress() : 0;
    this.crossRing.style.opacity = mp > 0 ? 1 : 0;
    this.crossRing.style.background = `conic-gradient(rgba(255,240,200,0.95) ${mp * 360}deg, rgba(255,255,255,0.12) 0)`;

    // top-left: clock and place
    const t = g.dayTime;
    const ck = clockString(t);
    const biome = BIOMES[g.world.biomeAt(Math.floor(p.x), Math.floor(p.z))];
    const deep = p.y < 50 && g.world.skyLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) < 4;
    const placeName = p.y > 140 && biome && biome.key === 'sky' ? '浮空群岛' : deep && p.y < 46 ? '幽光深层' : deep ? '地下洞穴' : biome ? biome.zh : '';
    const sun = g.sky ? (g.sky.daylight > 0.5 ? '☀' : g.sky.daylight > 0.1 ? '◐' : '☾') : '';
    const wtxt = g.weather ? g.weather.label() : '';
    const key = `${ck}${placeName}${wtxt}${g.day}`;
    if (key !== this.last.tl) {
      this.last.tl = key;
      this.clock.innerHTML = `<span class="sun">${sun}</span> 第 ${g.day} 天 · ${ck}${wtxt ? ` · ${wtxt}` : ''}`;
      this.place.textContent = placeName;
    }
    const goal = g.goalText ? g.goalText() : '';
    if (goal !== this.last.goal) { this.last.goal = goal; this.goal.innerHTML = goal; }

    // debug
    if (this.debug.style.display !== 'none') {
      const r = g.renderer.stats, cm = g.chunks;
      const lv = g.world.getLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z));
      this.debug.textContent = [
        `回响荒野 Echowild  ${g.fps.toFixed(0)} fps  (${(g.frameMs).toFixed(1)} ms)`,
        `XYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `区块 ${Math.floor(p.x) >> 4}, ${Math.floor(p.z) >> 4}  已加载 ${g.world.chunks.size}  生成 ${cm.genInFlight} 网格 ${cm.meshInFlight}`,
        `截面 ${r.sections} 绘制 ${r.drawn} 三角形 ${(r.tris / 1000).toFixed(0)}k`,
        `朝向 ${(p.yaw * 180 / Math.PI % 360).toFixed(0)}° 俯仰 ${(p.pitch * 180 / Math.PI).toFixed(0)}°`,
        `光照 天空 ${lv & 15} 方块 ${(lv >> 4) & 15}/${(lv >> 8) & 15}/${(lv >> 12) & 15}`,
        `生物群系 ${biome ? biome.zh : '?'}  时间 ${Math.floor(t)}  实体 ${g.entities ? g.entities.list.length : 0}`,
        `种子 ${g.world.seed}`,
      ].join('\n');
    }
  }

  toggleDebug() { this.debug.style.display = this.debug.style.display === 'none' ? '' : 'none'; }
}
