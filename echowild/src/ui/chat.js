// Chat line and commands (/help lists them).

import { h, Screen } from './ui.js';
import { I, ITEMS } from '../world/items.js';
import { B, BLOCKS } from '../world/blocks.js';
import { BIOMES } from '../world/biomes.js';

export class ChatScreen extends Screen {
  constructor(game, prefix = '') { super(); this.game = game; this.prefix = prefix; this.capturesGame = true; }
  build() {
    this.input = h('input', { class: 'chat-input', maxlength: 200, value: this.prefix, spellcheck: 'false', autocomplete: 'off' });
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') { const t = this.input.value.trim(); this.close(); if (t) runCommand(this.game, t); }
      else if (e.code === 'Escape') this.close();
      else if (e.code === 'ArrowUp') { const hst = this.game.chatHistory || []; if (hst.length) this.input.value = hst[hst.length - 1]; }
      else if (e.code === 'Tab') { e.preventDefault(); this.complete(); }
    });
    const el = h('div', { class: 'screen clear chat-screen' }, this.input);
    setTimeout(() => { this.input.focus(); this.input.setSelectionRange(this.input.value.length, this.input.value.length); }, 0);
    return el;
  }
  complete() {
    const v = this.input.value;
    const m = /^\/give\s+(\S*)$/.exec(v);
    if (m) {
      const opts = Object.keys(I).filter((n) => n.startsWith(m[1]));
      if (opts.length === 1) this.input.value = `/give ${opts[0]} `;
      else if (opts.length) this.game.hud.message(opts.slice(0, 20).join('  '), '#9ab');
    }
  }
  onKey(e) { if (e.code === 'Escape') { this.close(); return true; } return true; }
}

export function runCommand(game, text) {
  (game.chatHistory ||= []).push(text);
  const hud = game.hud, p = game.player;
  if (!text.startsWith('/')) { hud.message(`<b>你</b>：${escapeHtml(text)}`); return; }
  const [cmd, ...a] = text.slice(1).split(/\s+/);
  const say = (s, c = '#bfe') => hud.message(s, c);
  const allowed = p.creative || game.meta.cheats !== false;
  switch (cmd) {
    case 'help':
      say('指令：/time set day|night|&lt;数值&gt; · /weather clear|rain|storm|snow · /give 物品 [数量] · /tp x y z · /gamemode survival|creative · /spawn · /seed · /locate 结构 · /kill · /heal · /meteor · /summon 生物');
      break;
    case 'seed': say(`世界种子：${game.world.seed}`); break;
    case 'time': {
      if (!allowed) return say('需要开启作弊', '#f99');
      const v = a[1] || a[0];
      const t = v === 'day' ? 1000 : v === 'noon' ? 6000 : v === 'sunset' || v === 'dusk' ? 11800 : v === 'night' ? 14000 : v === 'midnight' ? 18000 : v === 'dawn' ? 23000 : Number(v);
      if (!Number.isFinite(t)) return say('用法：/time set day|noon|sunset|night|midnight|dawn|数值', '#f99');
      game.setTime(t); say(`时间已设为 ${t}`);
      break;
    }
    case 'weather':
      if (!game.weather) return;
      game.weather.set(a[0] || 'clear', Number(a[1]) || 600); say(`天气：${game.weather.label() || '晴'}`);
      break;
    case 'give': {
      const name = a[0];
      const id = I[name] ?? Object.values(ITEMS).find((d) => d && d.zh === name)?.id;
      if (id === undefined) return say(`未知物品：${escapeHtml(name || '')}`, '#f99');
      const n = Math.max(1, Math.min(9999, Number(a[1]) || 1));
      const left = game.inventory.add(id, n);
      if (left) game.dropStack({ id, n: left });
      say(`获得 ${ITEMS[id].zh} ×${n}`);
      break;
    }
    case 'tp': {
      const [x, y, z] = a.map(Number);
      if (![x, y, z].every(Number.isFinite)) return say('用法：/tp x y z', '#f99');
      game.teleport(x, y, z); say(`传送到 ${x} ${y} ${z}`);
      break;
    }
    case 'gamemode': case 'gm': {
      const m = a[0] === 'creative' || a[0] === 'c' || a[0] === '1' ? 'creative' : 'survival';
      p.creative = m === 'creative'; game.meta.mode = m;
      if (!p.creative) p.flying = false;
      say(`游戏模式：${m === 'creative' ? '创造' : '生存'}`);
      break;
    }
    case 'spawn': { const s = game.spawnPoint || p.spawn; game.teleport(s.x, s.y, s.z); break; }
    case 'kill': p.creative = false; p.damage(9999, 'void'); break;
    case 'heal': p.health = p.maxHealth; p.hunger = 20; p.saturation = 10; say('状态已恢复'); break;
    case 'biome': say(`当前生物群系：${BIOMES[game.world.biomeAt(Math.floor(p.x), Math.floor(p.z))].zh}`); break;
    case 'locate': {
      if (!game.locate) return say('定位不可用', '#f99');
      const r = game.locate(a[0]);
      if (!r) return say(`附近没有找到 ${escapeHtml(a[0] || '')}（可用：${(game.locateKinds || []).join(' ')}）`, '#f99');
      say(`${r.zh} 位于 ${r.x}, ${r.y ?? '~'}, ${r.z}（距离 ${Math.round(Math.hypot(r.x - p.x, r.z - p.z))} 格）`);
      break;
    }
    case 'meteor': if (game.events) { game.events.meteorShower(true); say('流星雨来了！'); } break;
    case 'summon': if (game.spawnMob) { const e = game.spawnMob(a[0], p.x + Math.sin(-p.yaw) * 3, p.y + 1, p.z - Math.cos(p.yaw) * 3); say(e ? `召唤了 ${e.def.zh}` : `未知生物（${(game.mobKinds || []).join(' ')}）`); } break;
    case 'setblock': {
      const [x, y, z] = a.slice(0, 3).map(Number);
      const id = B[a[3]];
      if (id === undefined) return say('用法：/setblock x y z 方块', '#f99');
      game.world.setBlock(x, y, z, id); say(`放置 ${BLOCKS[id].zh}`);
      break;
    }
    case 'fly': if (p.creative) { p.flying = !p.flying; } break;
    default: say(`未知指令：/${escapeHtml(cmd)}，输入 /help 查看帮助`, '#f99');
  }
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
