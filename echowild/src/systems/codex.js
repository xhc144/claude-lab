// The explorer's codex (J): biomes visited, creatures met, items discovered, the Weaver's
// notes, milestones and life statistics. Milestones unlock with a toast as they happen.

import { ITEMS, I } from '../world/items.js';
import { B, ID_MASK, ID_BITS, WOOD_TYPES } from '../world/blocks.js';
import { BIOMES } from '../world/biomes.js';
import { MOBS } from '../entity/mobs.js';
import { h, Screen, itemTooltip } from '../ui/ui.js';
import { iconURL } from '../render/icons.js';
import { LORE, LoreScreen } from './adventure.js';

const MOB_TEXT = {
  deer: '温顺的鹿，绒角在春天会长出小花。喜欢小麦，受惊会飞快逃走。',
  sheep: '毛像云朵一样蓬松，可以用剪刀剪下绒毛。成群在草甸上吃草。',
  puffbird: '圆滚滚的小鸟，会下蛋。撒一把种子就能让它们跟你走。',
  boar: '平时埋头拱土，被激怒后会召集同伴冲锋。爱吃日光根。',
  fox: '机敏的猎手，会追捕雪兔和蓬蓬鸟。喂它霜莓可以驯服，它会为你作战。',
  hare: '雪原上的胆小鬼，看到奔跑的人就逃。悄悄靠近才能抓到。',
  fish: '在河流与海洋中成群游动。可以用鱼竿钓起。',
  jelly: '漂浮在浮空群岛之间的发光水母，掉落凝胶与孢子。',
  gloom: '被遗忘的回响化成的影子。夜里与黑暗处游荡，阳光会把它们重新织回风里。',
  boomshroom: '会走路的蘑菇，靠近时嘶嘶作响然后爆炸。离它远一点！',
  archer: '晶骨组成的弓手，在黑暗中远远放箭。白天会燃烧。',
  spider: '能爬墙的大蜘蛛，掉落织网丝线。',
  emberling: '幽光深层岩浆附近的火灵，会吐出火球。',
  gloop: '沼泽里蹦跳的泥胶团，掉落弹性凝胶。',
  warden: '深渊圣所的古老守卫，守护着深渊之心。极其强大——带上最好的装备再来。',
  trader: '神出鬼没的游商，带着来自远方的货物，偶尔出售织界残图。',
};

const disc = (name) => (g) => g.discovered.has(I[name]);
// [id, title, description, check(g) | null (event driven)]
const ACH = [
  ['wood', '万物之始', '获得第一块原木', (g) => WOOD_TYPES.some((w) => I[`${w}_log`] !== undefined && g.discovered.has(I[`${w}_log`]))],
  ['bench', '匠人之心', '制作一张工作台', disc('workbench')],
  ['stonepick', '石器时代', '制作一把石镐', disc('stone_pickaxe')],
  ['furnace', '炉火初燃', '制作熔炉', disc('furnace')],
  ['copper', '铜光', '炼出铜锭', disc('copper_ingot')],
  ['iron', '铁器时代', '炼出铁锭', disc('iron_ingot')],
  ['harvest', '丰收', '收获第一把小麦', disc('wheat')],
  ['night', '长夜将尽', '度过第一个夜晚', (g) => g.day >= 2],
  ['sleep', '安眠', '在睡袋中睡一觉', null],
  ['deep', '向下深掘', '到达 Y=30 以下的幽光深层', null],
  ['sky', '云端漫步', '登上浮空群岛', null],
  ['geode', '晶洞之歌', '获得一枚回响晶片', disc('echo_crystal')],
  ['compass', '聆听回响', '制作回响罗盘', disc('echo_compass')],
  ['ping', '回声定位', '发出第一次回响脉冲', null],
  ['glider', '乘风而行', '用滑翔翼滑翔超过 60 格', null],
  ['tame', '忠实伙伴', '驯服一只灵狐', null],
  ['breed', '生生不息', '让两只动物繁殖', null],
  ['fish', '垂钓者', '钓起一样东西', null],
  ['trade', '以物易物', '与游商完成一笔交易', null],
  ['hunter', '初次交锋', '击败一只暗影游荡者', null],
  ['lamp', '共鸣电路', '用共鸣信号点亮一盏晶灯', null],
  ['piston', '机械之力', '制作活塞', disc('piston')],
  ['cart', '轨道旅人', '乘坐矿车', (g) => !!(g.player.riding)],
  ['meteor', '天外来客', '拾取陨铁原矿或星屑', (g) => g.discovered.has(I.raw_meteor) || g.discovered.has(I.star_shard)],
  ['star', '星辰锻造', '制作一把星辉镐', disc('star_pickaxe')],
  ['waystone', '石碑之网', '激活一座回响石碑', null],
  ['travel', '一步千里', '通过石碑传送', null],
  ['shrine', '封印解除', '开启一座碎片神殿', null],
  ['shard', '第一枚碎片', '获得一枚回响碎片', (g) => g.quest && g.quest.found.size > 0],
  ['boss', '守卫倒下', '击败遗迹守卫', null],
  ['altar', '织界重织', '把五枚碎片全部放回织心祭坛', (g) => g.quest && g.quest.done],
  ['lore', '织者的故事', '读完全部 12 页织者手记', (g) => g.lorePages && g.lorePages.size >= LORE.length],
  ['explorer', '行者', '踏足 8 种不同的生物群系', (g) => g.codex.biomes.size >= 8],
  ['builder', '筑者', '放置 1000 个方块', (g) => g.codex.stats.placed >= 1000],
  ['miner', '矿工', '挖掘 1000 个方块', (g) => g.codex.stats.broken >= 1000],
  ['cartographer', '制图师', '在地图上探索 1000 个区块', (g) => g.map && g.map.tiles.size >= 1000],
];
export const ACHIEVEMENTS = ACH;

export function installCodex(game, state) {
  const s = state && state.codex ? state.codex : {};
  const cx = game.codex = {
    biomes: new Set(s.biomes || []),
    seen: new Set(s.seen || []),
    kills: s.kills || {},
    ach: new Set(s.ach || []),
    stats: Object.assign({ broken: 0, placed: 0, crafted: 0, walked: 0, deaths: 0, killed: 0, playTime: 0, glided: 0 }, s.stats || {}),
  };
  game.stateSavers.push((st) => { st.codex = { biomes: [...cx.biomes], seen: [...cx.seen], kills: cx.kills, ach: [...cx.ach], stats: cx.stats }; });

  const unlock = (id) => {
    if (cx.ach.has(id)) return;
    const a = ACH.find((x) => x[0] === id);
    if (!a) return;
    cx.ach.add(id);
    game.hud.toast(`里程碑：${a[1]}`, a[2], 'achievement', 5000);
    game.audio && game.audio.play('discover');
    game.emit('achievement', id);
  };
  game.unlock = unlock;

  game.on('blockBroken', () => { cx.stats.broken++; });
  game.on('blockPlaced', () => { cx.stats.placed++; });
  game.on('crafted', (id, n) => { cx.stats.crafted += n; });
  game.on('death', () => { cx.stats.deaths++; });
  game.on('mobKilled', (m, cause) => {
    if (cause !== 'player' && game.lastAttacked !== m) return;
    cx.kills[m.kind] = (cx.kills[m.kind] || 0) + 1;
    cx.stats.killed++;
    if (m.kind === 'gloom') unlock('hunter');
    if (m.kind === 'warden') unlock('boss');
  });
  game.on('tamed', (k) => { if (k === 'fox') unlock('tame'); });
  game.on('mobBred', () => unlock('breed'));
  game.on('fished', () => unlock('fish'));
  game.on('traded', () => unlock('trade'));
  game.on('ping', () => unlock('ping'));
  game.on('waystoneActivated', () => unlock('waystone'));
  game.on('travelled', () => unlock('travel'));
  game.on('shrineOpened', () => unlock('shrine'));
  const prevSleep = game.sleep;
  if (prevSleep) game.sleep = (...a) => { const r = prevSleep(...a); unlock('sleep'); return r; };

  let t = 0, lampT = 0, lx = null, lz = null;
  game.addSystem({
    tick(g) {
      const p = g.player;
      cx.stats.playTime += 0.05;
      if (lx !== null && !p.riding && !p.flying) {
        const d = Math.hypot(p.x - lx, p.z - lz);
        if (d < 5) { if (p.gliding) cx.stats.glided += d; else if (p.onGround) cx.stats.walked += d; }
      }
      lx = p.x; lz = p.z;
      if (cx.stats.glided > 60) unlock('glider');
      if (++t < 20) return;
      t = 0;
      const x = Math.floor(p.x), z = Math.floor(p.z);
      if (g.world.isLoaded(x, z)) {
        const b = g.world.biomeAt(x, z, p.y);
        const deep = p.y < 30 && (g.world.getLight(x, Math.floor(p.y + 1), z) & 15) < 4;
        const bk = deep ? 'underworld' : BIOMES[b].key;
        if (!cx.biomes.has(bk)) {
          cx.biomes.add(bk);
          const bd = BIOMES.find((q) => q.key === bk);
          if (cx.biomes.size > 1) g.hud.toast(`新的生物群系：${bd.zh}`, bd.desc || '', 'discover', 3500);
        }
        if (deep) unlock('deep');
        if (BIOMES[b].key === 'sky' && p.y > 120) unlock('sky');
      }
      for (const e of g.entities.near(p.x, p.y, p.z, 14, (e) => e.def && e.alive)) {
        if (!cx.seen.has(e.kind)) { cx.seen.add(e.kind); if (cx.seen.size > 1 || g.ticks > 400) g.hud.message(`图鉴新增：${e.def.zh}`, '#bfe'); }
      }
      for (const a of ACH) if (a[3] && !cx.ach.has(a[0]) && a[3](g)) unlock(a[0]);
      // look for a lit crystal lamp near the player now and then
      if (!cx.ach.has('lamp') && ++lampT >= 3) {
        lampT = 0;
        const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
        outer: for (let dy = -6; dy <= 6; dy++) for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
          const v = g.world.getBlock(px + dx, py + dy, pz + dz);
          if ((v & ID_MASK) === B.crystal_lamp && ((v >>> ID_BITS) & 1)) { unlock('lamp'); break outer; }
        }
      }
    },
  });
  game.openCodex = () => { if (!game.ui.open) game.app.ui.push(new CodexScreen(game)); };
}

const fmtTime = (s) => { const h2 = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h2 ? `${h2} 小时 ${m} 分` : `${m} 分钟`; };

class CodexScreen extends Screen {
  constructor(game, tab = 'ach') { super(); this.game = game; this.tab = tab; }
  build() {
    const g = this.game, cx = g.codex;
    const tabs = [['ach', '里程碑'], ['biomes', '群系'], ['mobs', '生物'], ['items', '物品'], ['lore', '手记'], ['stats', '统计']];
    this.body = h('div', { class: 'codex-body' });
    this.tabEls = tabs.map(([k, t]) => h('button', { class: `codex-tab${k === this.tab ? ' on' : ''}`, onclick: () => { this.tab = k; this.render(); } }, t));
    const done = ACH.filter((a) => cx.ach.has(a[0])).length;
    const root = h('div', { class: 'screen' }, h('div', { class: 'panel codex-panel' },
      h('div', { class: 'codex-head' }, h('div', { class: 'title' }, '探险图鉴'), h('div', { class: 'codex-sum' }, `里程碑 ${done}/${ACH.length} · 生物 ${cx.seen.size}/${Object.keys(MOBS).length} · 群系 ${cx.biomes.size}/${BIOMES.length} · 物品 ${g.discovered.size}/${ITEMS.filter(Boolean).length}`)),
      h('div', { class: 'codex-tabs' }, ...this.tabEls),
      this.body,
      h('div', { class: 'menu-row' }, h('button', { class: 'btn', onclick: () => this.close() }, '关闭（J）'))));
    this.render();
    return root;
  }
  render() {
    const g = this.game, cx = g.codex, ui = this.ui;
    this.tabEls.forEach((el, i) => el.classList.toggle('on', ['ach', 'biomes', 'mobs', 'items', 'lore', 'stats'][i] === this.tab));
    const b = this.body;
    b.innerHTML = '';
    if (this.tab === 'ach') {
      const grid = h('div', { class: 'codex-grid' });
      for (const [id, title, desc] of ACH) {
        const got = cx.ach.has(id);
        grid.appendChild(h('div', { class: `codex-card${got ? '' : ' locked'}` }, h('div', { class: 'cc-icon' }, got ? '★' : '☆'), h('div', {}, h('div', { class: 'cc-title' }, title), h('div', { class: 'cc-desc' }, desc))));
      }
      b.appendChild(grid);
    } else if (this.tab === 'biomes') {
      const grid = h('div', { class: 'codex-grid' });
      for (const bd of BIOMES) {
        const got = cx.biomes.has(bd.key);
        const col = bd.grassRGB ? `rgb(${bd.grassRGB.join(',')})` : '#555';
        grid.appendChild(h('div', { class: `codex-card${got ? '' : ' locked'}` }, h('div', { class: 'cc-swatch', style: { background: got ? col : '#333' } }), h('div', {}, h('div', { class: 'cc-title' }, got ? bd.zh : '？？？'), h('div', { class: 'cc-desc' }, got ? bd.desc || '' : '尚未踏足。'))));
      }
      b.appendChild(grid);
    } else if (this.tab === 'mobs') {
      const grid = h('div', { class: 'codex-grid' });
      for (const [k, d] of Object.entries(MOBS)) {
        const got = cx.seen.has(k);
        const tag = d.boss ? '首领' : d.hostile ? '敌对' : d.neutral ? '中立' : d.trader ? '商人' : '友善';
        grid.appendChild(h('div', { class: `codex-card${got ? '' : ' locked'}` },
          h('div', { class: `cc-icon mob-${d.boss ? 'boss' : d.hostile ? 'hostile' : 'passive'}` }, got ? d.zh[0] : '?'),
          h('div', {}, h('div', { class: 'cc-title' }, got ? d.zh : '？？？', got ? h('span', { class: 'cc-tag' }, tag) : null),
            h('div', { class: 'cc-desc' }, got ? `${MOB_TEXT[k] || ''} 生命 ${d.health / 2}♥${cx.kills[k] ? ` · 击败 ${cx.kills[k]}` : ''}` : '尚未遇见。'))));
      }
      b.appendChild(grid);
    } else if (this.tab === 'items') {
      const grid = h('div', { class: 'codex-items' });
      for (const d of ITEMS) {
        if (!d || d.hidden || d.noItem) continue;
        const got = g.discovered.has(d.id);
        const el = h('div', { class: `codex-item${got ? '' : ' locked'}` });
        if (got) {
          el.appendChild(h('img', { src: iconURL(d.id), draggable: 'false' }));
          el.addEventListener('mouseenter', () => ui.showTip(itemTooltip({ id: d.id, n: 1 })));
          el.addEventListener('mouseleave', () => ui.hideTip());
        } else el.textContent = '?';
        grid.appendChild(el);
      }
      b.appendChild(grid);
    } else if (this.tab === 'lore') {
      const list = h('div', { class: 'codex-lore' });
      LORE.forEach(([title], i) => {
        const got = g.lorePages.has(i);
        list.appendChild(h('div', { class: `codex-card${got ? ' clickable' : ' locked'}`, onclick: got ? () => this.ui.push(new LoreScreen(i)) : null }, h('div', { class: 'cc-icon' }, got ? '✎' : '?'), h('div', {}, h('div', { class: 'cc-title' }, got ? title : `第 ${i + 1} 页 · 未找到`), h('div', { class: 'cc-desc' }, got ? '点击阅读' : '散落在遗迹、矿道与神殿的宝箱中。'))));
      });
      b.appendChild(list);
    } else {
      const S = cx.stats;
      const rows = [
        ['存活天数', `${g.day} 天`], ['游戏时长', fmtTime(S.playTime)], ['行走距离', `${Math.round(S.walked)} 格`], ['滑翔距离', `${Math.round(S.glided)} 格`],
        ['挖掘方块', S.broken], ['放置方块', S.placed], ['合成物品', S.crafted], ['击败生物', S.killed], ['死亡次数', S.deaths],
        ['探索区块', g.map ? g.map.tiles.size : 0], ['激活石碑', g.waystones ? g.waystones.length : 0], ['发现遗迹', g.structures ? g.structures.size : 0],
        ['回响碎片', `${g.quest ? g.quest.count() : 0} / 5 归位`],
      ];
      b.appendChild(h('div', { class: 'codex-stats' }, ...rows.map(([k, v]) => h('div', { class: 'cs-row' }, h('span', {}, k), h('b', {}, String(v))))));
    }
  }
  close() { this.ui && this.ui.hideTip(); super.close(); }
  onKey(e) { if (e.code === 'Escape' || e.code === 'KeyJ') { this.close(); return true; } return true; }
}
