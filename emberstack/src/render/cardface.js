// Card faces: the frame, name ribbon, illustration window and stat footer of every card, rendered
// once per (card, resolution) into an offscreen sprite and reused by the board and the codex.
//
// Layout (world units, card = 110 × 150):
//   header ribbon 4..25 — kind medallion + name (stays visible when cards are stacked, STACK_DY 27)
//   art window    5,27 100×76
//   footer        105..146 — stat icons and a one-line role

import { CARDS } from '../data/cards.js';
import { CARD_W, CARD_H } from '../sim/constants.js';
import { Painter, makeCanvas, noisePattern, lighten, darken, INK } from './paint.js';
import { paintArt } from './cardart.js';
import { drawIcon } from './icons.js';

export const FONT_TITLE = '"Ma Shan Zheng","STKaiti","KaiTi","Kaiti SC","楷体",serif';
export const FONT_BODY = '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif';
export const FONT_NUM = 'Georgia,"Times New Roman",serif';

export const FACE = {
  header: { x: 4, y: 4, w: 102, h: 21 },
  art: { x: 5, y: 27, w: 100, h: 76 },
  footer: { x: 5, y: 105, w: 100, h: 40 },
  statsY: 117,
  roleY: 135,
};

export const KIND_STYLE = {
  folk: { frame: '#8a5430', accent: '#f0c46a', label: '人物', icon: 'people' },
  food: { frame: '#8a7430', accent: '#f0d47a', label: '食物', icon: 'bowl' },
  resource: { frame: '#6e5640', accent: '#e0b880', label: '材料', icon: 'box' },
  node: { frame: '#4e6e38', accent: '#c8e08a', label: '资源点', icon: 'leaf' },
  structure: { frame: '#4e5866', accent: '#c8d0dc', label: '建筑', icon: 'house' },
  tool: { frame: '#8a6232', accent: '#f0c88a', label: '工具', icon: 'axe' },
  gear: { frame: '#56606e', accent: '#d8e0ea', label: '装备', icon: 'shield' },
  beast: { frame: '#5e6a36', accent: '#d8d08a', label: '野兽', icon: 'eye' },
  enemy: { frame: '#6e1e1e', accent: '#ff8a5a', label: '敌人', icon: 'skull' },
  lair: { frame: '#4a1418', accent: '#e86a4a', label: '巢穴', icon: 'skull' },
  region: { frame: '#2e5e66', accent: '#9ad8d8', label: '地域', icon: 'boot' },
  knowledge: { frame: '#32407a', accent: '#a8c0ff', label: '知识', icon: 'spark' },
  coin: { frame: '#9a7a22', accent: '#ffe08a', label: '货币', icon: 'coin' },
  bundle: { frame: '#7a5a3a', accent: '#e8c88a', label: '包裹', icon: 'box' },
  event: { frame: '#5e3a72', accent: '#e0a8ff', label: '事件', icon: 'scroll' },
  wonder: { frame: '#a0461a', accent: '#ffd070', label: '奇观', icon: 'flame' },
  misc: { frame: '#5a5048', accent: '#d0c4b0', label: '杂项', icon: 'fog' },
};

export const RARITY = {
  common: { name: '普通', gem: null },
  uncommon: { name: '精良', gem: '#5ac86a' },
  rare: { name: '稀有', gem: '#4a9ae8' },
  epic: { name: '史诗', gem: '#b05ae8' },
  legendary: { name: '传说', gem: '#ffb22a' },
};

export const SKILL_NAMES = {
  wood: '伐木', stone: '采石', mine: '采矿', farm: '耕作', forage: '采集', fish: '捕鱼', craft: '制作', build: '建造', smith: '锻造',
  research: '研究', heal: '医疗', explore: '探索', trade: '交易', hunt: '狩猎', sail: '航海',
};
const DMG_ICON = { pierce: 'arrow', blunt: 'hammer', light: 'ray' };
export const DMG_NAMES = { pierce: '穿刺', blunt: '钝击', light: '光芒' };
const TRAIT_NAMES = { armored: '有甲', shade: '暗影', flying: '飞行', beast: '兽', boss: '首领', burning: '灼烧', regen: '再生', swarm: '成群', structure: '工事' };

// ---------------------------------------------------------------- stats & role ------------------
/** the stat chips shown in a card's footer: [icon, text] */
export function cardStats(def) {
  const s = [];
  const k = def.kind;
  if (k === 'beast' && !def.hp) {
    if (def.value) s.push(['coin', def.value]);
  } else if (k === 'folk' || k === 'beast' || k === 'enemy' || k === 'lair') {
    if (def.hp) s.push(['heart', def.hp]);
    if (def.atk || k !== 'lair') s.push([DMG_ICON[def.dmg] || 'sword', def.atk || 0]);
    if (def.def) s.push(['shield', def.def]);
    if (k === 'folk' && def.appetite) s.push(['bowl', def.appetite]);
    if (def.light) s.push(['sun', def.light]);
  } else if (k === 'food') {
    s.push(['bowl', def.food]);
    s.push(['hourglass', def.spoil ? def.spoil + '天' : '∞']);
    if (def.heal) s.push(['plus', def.heal]);
  } else if (k === 'node' || (def.node && k === 'structure')) {
    const n = def.node;
    s.push(['cycle', n.charges < 0 ? '∞' : n.charges]);
    if (n.perennial) s.push(['leaf', '+' + (n.regen || 1)]);
    if (n.needTool === 'pick' || n.tool === 'pick') s.push(['pick', n.needTool ? '必需' : '助']);
    else if (n.tool === 'axe') s.push(['axe', '助']);
    if (def.light) s.push(['sun', def.light]);
  } else if (k === 'structure' || k === 'wonder') {
    if (def.light) s.push(['sun', def.light]);
    if (def.housing) s.push(['house', def.housing]);
    if (def.fuelMax) s.push(['flame', def.fuelMax]);
    if (def.fog) s.push(['fog', def.fog]);
    if (def.hp) s.push(['heart', def.hp]);
    if (def.store) s.push(['bowl', def.store.cap]);
    if (!s.length) s.push(def.tags.includes('research') ? ['spark', '灵感'] : ['gear', '工坊']);
  } else if (k === 'tool') {
    if (def.toolMult) s.push(['spark', '×' + def.toolMult]);
    if (def.light) s.push(['sun', def.light]);
    if (def.fuelMax) s.push(['flame', def.fuelMax]);
    if (def.heal) s.push(['plus', def.heal >= 99 ? '满' : def.heal]);
    if (def.value) s.push(['coin', def.value]);
  } else if (k === 'gear') {
    const gg = def.gear;
    if (gg.atk) s.push([DMG_ICON[gg.dmg] || 'sword', '+' + gg.atk]);
    if (gg.hp) s.push(['heart', '+' + gg.hp]);
    if (gg.def) s.push(['shield', '+' + gg.def]);
    if (gg.light) s.push(['sun', gg.light]);
    if (gg.warm) s.push(['snow', '御寒']);
  } else if (k === 'region') {
    const r = def.region;
    s.push(['clock', r.t + 's']);
    s.push(['skull', Math.max(1, Math.round(r.danger * 10))]);
    s.push(['cycle', r.charges]);
    if (r.need === 'light' || r.needLight) s.push(['sun', '需']);
    if (r.need === 'boat') s.push(['boat', '需']);
  } else if (k === 'bundle') {
    s.push(['box', '×' + def.open.n]);
  } else if (k === 'coin' || k === 'knowledge' || k === 'resource' || k === 'misc') {
    if (def.fuel) s.push(['flame', def.fuel]);
    if (def.food) s.push(['bowl', def.food]);
    if (def.fog) s.push(['fog', def.fog]);
    if (def.value) s.push(['coin', def.value]);
    if (def.id === 'insight') s.push(['spark', '研究']);
  } else if (k === 'event') {
    s.push(['eye', '点击']);
  }
  return s.slice(0, 4);
}

function firstClause(desc, n = 12) {
  const parts = (desc || '').split(/[。：；！？，（]/).filter(Boolean);
  let c = parts[0] || '';
  if (c.length < 4 && parts[1] && c.length + parts[1].length < n) c += '，' + parts[1];
  return c.length > n ? c.slice(0, n - 1) + '…' : c;
}

/** a short role line under the stats */
export function cardRole(def) {
  const k = def.kind;
  if (k === 'folk') {
    const sk = Object.entries(def.skills || {}).sort((a, b) => b[1] - a[1]);
    if (sk.length) return sk.slice(0, 2).map(([s, m]) => `${SKILL_NAMES[s] || s}×${m}`).join(' ');
    if (def.tags.includes('soldier')) return [DMG_NAMES[def.dmg], def.ranged ? '远程' : '', def.taunt ? '嘲讽' : ''].filter(Boolean).join(' · ');
    if (def.grows) return `${def.grows.days} 天后长大`;
    return '可训练成专才';
  }
  if (k === 'beast' && !def.mob) return firstClause(def.desc);
  if (k === 'enemy' || k === 'beast' || k === 'lair') {
    const t = (def.traits || []).filter((x) => TRAIT_NAMES[x] && x !== 'beast').map((x) => TRAIT_NAMES[x]);
    if (def.ranged) t.unshift('远程');
    if (def.mob && def.mob.beh === 'flee') t.unshift('会逃跑');
    if (def.mob && def.mob.beh === 'neutral') t.unshift('中立');
    if (def.mob && def.mob.beh === 'raider') t.unshift('掠夺');
    return t.slice(0, 3).join(' · ') || DMG_NAMES[def.dmg];
  }
  if (k === 'node' || (k === 'structure' && def.node)) {
    const outs = def.node.out.map(([id]) => CARDS[id].name);
    return outs.length ? '产出 ' + outs.join('、') : firstClause(def.desc);
  }
  if (k === 'food') return def.tags.includes('preserved') ? '耐储存' : def.tags.includes('raw') ? '生食 · 可烹饪' : def.tags.includes('cooked') ? '熟食' : '食物';
  if (k === 'region') {
    const needs = [];
    if (def.region.need === 'light' || def.region.needLight) needs.push('需光源');
    if (def.region.need === 'boat') needs.push('需舟');
    return ['探索', ...needs].join(' · ');
  }
  return firstClause(def.desc);
}

// ---------------------------------------------------------------- painting ----------------------
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function corner(g, x, y, sx, sy, accent) {
  g.save();
  g.translate(x, y);
  g.scale(sx, sy);
  g.beginPath();
  g.moveTo(0, 9);
  g.quadraticCurveTo(0, 0, 9, 0);
  g.moveTo(2.5, 7);
  g.quadraticCurveTo(3, 3, 7, 2.5);
  g.lineWidth = 0.9;
  g.strokeStyle = accent;
  g.globalAlpha = 0.85;
  g.stroke();
  g.beginPath();
  g.arc(3.4, 3.4, 1.3, 0, Math.PI * 2);
  g.fillStyle = accent;
  g.fill();
  g.restore();
}

function fitText(g, text, maxW, size, font) {
  let s = size;
  g.font = `${s}px ${font}`;
  while (g.measureText(text).width > maxW && s > 6) {
    s -= 0.5;
    g.font = `${s}px ${font}`;
  }
  return s;
}

/** paint a full card face into g, whose transform maps 1 unit to 1 world unit, card at (0, 0) */
export function paintFace(g, id) {
  const def = CARDS[id];
  const st = KIND_STYLE[def.kind] || KIND_STYLE.misc;
  const W = CARD_W, H = CARD_H;
  const frame = st.frame;

  // frame body
  rr(g, 0.5, 0.5, W - 1, H - 1, 7);
  const fg = g.createLinearGradient(0, 0, W, H);
  fg.addColorStop(0, lighten(frame, 0.22));
  fg.addColorStop(0.5, frame);
  fg.addColorStop(1, darken(frame, 0.38));
  g.fillStyle = fg;
  g.fill();
  g.save();
  g.clip();
  g.globalAlpha = 0.16;
  g.globalCompositeOperation = 'overlay';
  g.fillStyle = noisePattern(g);
  g.fillRect(0, 0, W, H);
  g.restore();
  // wood/leather grain streaks
  g.save();
  rr(g, 0.5, 0.5, W - 1, H - 1, 7);
  g.clip();
  g.globalAlpha = 0.12;
  g.strokeStyle = darken(frame, 0.6);
  g.lineWidth = 0.5;
  for (let i = 0; i < 14; i++) {
    const y = 3 + i * 11 + ((i * 37) % 7);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(30, y - 3, 70, y + 4, W, y - 1);
    g.stroke();
  }
  g.restore();
  rr(g, 0.5, 0.5, W - 1, H - 1, 7);
  g.lineWidth = 1.6;
  g.strokeStyle = INK;
  g.stroke();
  // inner bevel
  rr(g, 2.6, 2.6, W - 5.2, H - 5.2, 5);
  g.lineWidth = 0.7;
  g.strokeStyle = lighten(st.accent, 0.2);
  g.globalAlpha = 0.55;
  g.stroke();
  g.globalAlpha = 1;

  // art window
  const A = FACE.art;
  g.save();
  rr(g, A.x, A.y, A.w, A.h, 3);
  g.clip();
  g.translate(A.x, A.y);
  const P = new Painter(g, hashId(id));
  try {
    paintArt(P, id);
  } catch (e) {
    g.fillStyle = '#3a2a22';
    g.fillRect(0, 0, A.w, A.h);
  }
  g.restore();
  // inner shadow + ink border on the art window
  g.save();
  rr(g, A.x, A.y, A.w, A.h, 3);
  g.clip();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 5;
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  rr(g, A.x - 1.5, A.y - 1.5, A.w + 3, A.h + 3, 4);
  g.stroke();
  g.restore();
  rr(g, A.x, A.y, A.w, A.h, 3);
  g.lineWidth = 1.2;
  g.strokeStyle = INK;
  g.stroke();

  // footer panel
  const F = FACE.footer;
  rr(g, F.x, F.y, F.w, F.h, 3);
  const pg = g.createLinearGradient(0, F.y, 0, F.y + F.h);
  pg.addColorStop(0, '#f2e6c8');
  pg.addColorStop(1, '#d8c49a');
  g.fillStyle = pg;
  g.fill();
  g.save();
  g.clip();
  g.globalAlpha = 0.1;
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = noisePattern(g);
  g.fillRect(F.x, F.y, F.w, F.h);
  g.restore();
  rr(g, F.x, F.y, F.w, F.h, 3);
  g.lineWidth = 1;
  g.strokeStyle = INK;
  g.stroke();
  // divider
  g.beginPath();
  g.moveTo(F.x + 10, FACE.roleY - 8);
  g.lineTo(F.x + F.w - 10, FACE.roleY - 8);
  g.lineWidth = 0.5;
  g.strokeStyle = 'rgba(60,36,18,0.35)';
  g.stroke();

  // stats
  const stats = cardStats(def);
  if (stats.length) {
    g.font = `bold 10px ${FONT_NUM}`;
    const widths = stats.map(([, t]) => 11 + measure(g, String(t), t));
    const gap = 5;
    let x = 55 - (widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)) / 2;
    stats.forEach(([ic, t], i) => {
      drawIcon(g, ic, x + 4.5, FACE.statsY, 10);
      setStatFont(g, t);
      g.fillStyle = '#2a1a10';
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillText(String(t), x + 10.5, FACE.statsY + 0.5);
      x += widths[i] + gap;
    });
  }
  // role line
  const role = cardRole(def);
  g.fillStyle = '#5a3c22';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, role, 92, 7.5, FONT_BODY);
  g.fillText(role, 55, FACE.roleY);

  // header ribbon
  const Hd = FACE.header;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.4)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  rr(g, Hd.x + 6, Hd.y, Hd.w - 6, Hd.h, 4);
  const hg = g.createLinearGradient(0, Hd.y, 0, Hd.y + Hd.h);
  hg.addColorStop(0, '#f6ead0');
  hg.addColorStop(1, '#dcc89c');
  g.fillStyle = hg;
  g.fill();
  g.restore();
  rr(g, Hd.x + 6, Hd.y, Hd.w - 6, Hd.h, 4);
  g.lineWidth = 1;
  g.strokeStyle = INK;
  g.stroke();
  // name
  g.fillStyle = '#22140a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, def.name, Hd.w - 30, 13, FONT_TITLE);
  g.fillText(def.name, 62, Hd.y + Hd.h / 2 + 0.8);
  // kind medallion
  const mx = 14.5, my = Hd.y + Hd.h / 2;
  g.beginPath();
  g.arc(mx, my, 10, 0, Math.PI * 2);
  const mg = g.createRadialGradient(mx - 3, my - 3, 1, mx, my, 10);
  mg.addColorStop(0, lighten(frame, 0.45));
  mg.addColorStop(1, darken(frame, 0.2));
  g.fillStyle = mg;
  g.fill();
  g.lineWidth = 1.2;
  g.strokeStyle = INK;
  g.stroke();
  g.beginPath();
  g.arc(mx, my, 8, 0, Math.PI * 2);
  g.lineWidth = 0.6;
  g.strokeStyle = st.accent;
  g.stroke();
  drawIcon(g, st.icon, mx, my, 11);

  // corners
  corner(g, 4.5, H - 4.5, 1, -1, st.accent);
  corner(g, W - 4.5, H - 4.5, -1, -1, st.accent);

  // rarity gem on the bottom edge
  const rar = RARITY[def.rarity] || RARITY.common;
  if (rar.gem) {
    const gx = W / 2, gy = H - 2.5;
    g.save();
    g.shadowColor = rar.gem;
    g.shadowBlur = 6;
    g.beginPath();
    g.moveTo(gx, gy - 5);
    g.lineTo(gx + 6, gy);
    g.lineTo(gx, gy + 5 - 2.5);
    g.lineTo(gx - 6, gy);
    g.closePath();
    const gg = g.createLinearGradient(gx - 6, gy - 5, gx + 6, gy + 3);
    gg.addColorStop(0, lighten(rar.gem, 0.6));
    gg.addColorStop(0.5, rar.gem);
    gg.addColorStop(1, darken(rar.gem, 0.4));
    g.fillStyle = gg;
    g.fill();
    g.restore();
    g.lineWidth = 0.9;
    g.strokeStyle = INK;
    g.stroke();
  }
}

function setStatFont(g, t) {
  g.font = typeof t === 'number' || /^[\d+×∞.s-]+$/.test(String(t)) ? `bold 10px ${FONT_NUM}` : `bold 8px ${FONT_BODY}`;
}
function measure(g, s, t) {
  setStatFont(g, t);
  return g.measureText(s).width;
}

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** the back of a card: a woodcut flame emblem on deep red lacquer */
export function paintBack(g) {
  const W = CARD_W, H = CARD_H;
  rr(g, 0.5, 0.5, W - 1, H - 1, 7);
  const bg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 95);
  bg.addColorStop(0, '#7a2a1c');
  bg.addColorStop(1, '#2a0e0a');
  g.fillStyle = bg;
  g.fill();
  g.save();
  g.clip();
  g.globalAlpha = 0.18;
  g.strokeStyle = '#e8a04a';
  g.lineWidth = 0.5;
  for (let d = -H; d < W + H; d += 7) {
    g.beginPath(); g.moveTo(d, 0); g.lineTo(d - H, H); g.stroke();
    g.beginPath(); g.moveTo(d - H, 0); g.lineTo(d, H); g.stroke();
  }
  g.restore();
  rr(g, 0.5, 0.5, W - 1, H - 1, 7);
  g.lineWidth = 1.6;
  g.strokeStyle = INK;
  g.stroke();
  rr(g, 6, 6, W - 12, H - 12, 4);
  g.lineWidth = 1;
  g.strokeStyle = '#d9a84a';
  g.stroke();
  rr(g, 9, 9, W - 18, H - 18, 3);
  g.lineWidth = 0.5;
  g.stroke();
  g.save();
  g.translate(W / 2, H / 2);
  const halo = g.createRadialGradient(0, 0, 2, 0, 0, 40);
  halo.addColorStop(0, 'rgba(255,190,90,0.55)');
  halo.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = halo;
  g.fillRect(-45, -45, 90, 90);
  g.beginPath();
  g.arc(0, 0, 26, 0, Math.PI * 2);
  g.lineWidth = 1.4;
  g.strokeStyle = '#d9a84a';
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
    g.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
    g.stroke();
  }
  drawIcon(g, 'flame', 0, 0, 36, '#f6a032');
  g.restore();
  g.fillStyle = '#d9a84a';
  g.font = `11px ${FONT_TITLE}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('薪 火 纪', W / 2, H - 20);
}

// ---------------------------------------------------------------- sprite cache ------------------
const BUCKETS = [0.5, 1, 1.5, 2, 3, 4];
const cache = new Map();
const MAX_SPRITES = 260;
let generation = 0;

export function bucketFor(scale) {
  for (const b of BUCKETS) if (b >= scale * 0.95) return b;
  return BUCKETS[BUCKETS.length - 1];
}

/** a cached canvas with the face of card `id` (or '#back') rendered at `scale` pixels per unit */
export function cardSprite(id, scale) {
  const b = bucketFor(scale);
  const key = id + '|' + b;
  let s = cache.get(key);
  if (s) {
    cache.delete(key);
    cache.set(key, s); // LRU touch
    return s;
  }
  s = makeCanvas(Math.ceil(CARD_W * b), Math.ceil(CARD_H * b));
  const g = s.getContext('2d');
  g.scale(b, b);
  if (id === '#back') paintBack(g);
  else paintFace(g, id);
  cache.set(key, s);
  if (cache.size > MAX_SPRITES) cache.delete(cache.keys().next().value);
  return s;
}

/** drop every cached sprite (e.g. after web fonts finish loading) */
export function flushSprites() {
  cache.clear();
  generation++;
}
export function spriteGeneration() { return generation; }

/** a card face as a data URL for HTML (codex, tooltips, dialogs) */
const urls = new Map();
export function cardURL(id, scale = 1) {
  const key = id + '|' + scale + '|' + generation;
  let u = urls.get(key);
  if (u) return u;
  const c = makeCanvas(Math.ceil(CARD_W * scale), Math.ceil(CARD_H * scale));
  const g = c.getContext('2d');
  g.scale(scale, scale);
  if (id === '#back') paintBack(g);
  else paintFace(g, id);
  u = c.toDataURL('image/png');
  urls.set(key, u);
  return u;
}

/** just the illustration (art window) as a data URL, for small icons in the HTML interface */
export function artURL(id, px = 64) {
  const key = 'art|' + id + '|' + px + '|' + generation;
  let u = urls.get(key);
  if (u) return u;
  const h = Math.round((px * 76) / 100);
  const c = makeCanvas(px, h);
  const g = c.getContext('2d');
  g.scale(px / 100, px / 100);
  paintArt(new Painter(g, hashId(id)), id);
  u = c.toDataURL('image/png');
  urls.set(key, u);
  return u;
}
