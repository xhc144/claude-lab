// The journey: a chaptered guide from the first log to the reweaving of the world. Each step says
// what to do, how to do it and where to look; the HUD tracks the current step with a progress bar,
// finished chapters pay out a reward, and one-time tips explain the moment you need them (dusk,
// hunger, darkness, deep water…). Side paths (farming, machines, stars, wandering) give long-term
// goals after the main story. Progress is saved with the world; older saves catch up silently.

import { I, ITEMS } from '../world/items.js';
import { B, BLOCKS, ID_MASK, WOOD_TYPES } from '../world/blocks.js';
import { STRUCTURE_INFO } from '../world/gen/structures.js';
import { h, Screen, itemTooltip } from '../ui/ui.js';
import { iconURL } from '../render/icons.js';

const has = (...names) => (g) => names.some((n) => I[n] !== undefined && g.discovered.has(I[n]));
const ach = (id) => (g) => !!(g.codex && g.codex.ach.has(id));
const cnt = (k, of) => ({ count: (g) => g.journey.cnt[k] || 0, of });
const TOOL_TIERS = ['wood', 'stone', 'copper', 'iron', 'star', 'meteor'];
const pickAtLeast = (tier) => has(...TOOL_TIERS.slice(TOOL_TIERS.indexOf(tier)).map((t) => `${t}_pickaxe`));

// step: { id, title, how, hint?, done?(g), count?(g), of? }
export const CHAPTERS = [
  {
    id: 'wake', zh: '第一章 · 初醒', intro: '你在织心祭坛旁醒来，身边只有风声。先让自己活下去：木头、工具、石头。',
    reward: [['bread', 4], ['campfire', 1], ['oak_sapling', 2]],
    steps: [
      { id: 'move', title: '四处走走', how: '用 W A S D 移动，鼠标环顾，空格跳跃，按住 Ctrl 疾跑。', count: (g) => Math.floor(g.codex ? g.codex.stats.walked : 0), of: 12 },
      { id: 'logs', title: '砍下原木', how: '走到树旁，准星对准树干，按住鼠标左键直到它碎开。走近掉落物即可拾取。', hint: '任何树都可以。徒手也能砍，只是慢一点。', ...cnt('logs', 3) },
      { id: 'planks', title: '做出木板', how: '按 E 打开背包，在右侧合成书里点木板配方，再点「合成」。', hint: '一块原木能做 4 块木板。', done: has(...WOOD_TYPES.map((w) => `${w}_planks`)) },
      { id: 'bench', title: '制作工作台', how: '在合成书里找到工作台（4 块木板）并合成。', done: has('workbench') },
      { id: 'benchPlaced', title: '放置工作台', how: '把工作台放进快捷栏，选中它，对着地面按鼠标右键。', hint: '站在工作台旁按 E，合成书会解锁更多配方。', ...cnt('bench', 1) },
      { id: 'woodpick', gate: true, title: '制作木镐', how: '靠近工作台，用木板和木棍合成木镐。', hint: '木棍用 2 块木板合成。', done: pickAtLeast('wood') },
      { id: 'stone', title: '采集石头', how: '用镐挖掘灰色的苍石，收集 8 块碎石。', hint: '山坡、河岸和地表的裂口都能见到石头。不用镐挖不出东西。', ...cnt('stone', 8) },
      { id: 'stonepick', gate: true, title: '制作石镐', how: '在工作台用碎石和木棍合成石镐，顺手做一把石剑。', hint: '石镐能挖铜和铁，挖掘速度也更快。', done: pickAtLeast('stone') },
    ],
  },
  {
    id: 'night', zh: '第二章 · 长夜', intro: '太阳会落下，影子会醒来。准备光和火，吃饱，熬过第一个夜晚。',
    reward: [['bed', 1], ['venison', 4], ['torch', 8]],
    steps: [
      { id: 'coal', title: '找到燃料', how: '挖掘石头中带黑点的煤矿石，得到煤。', hint: '找不到煤？先做熔炉，把原木放进去烧成木炭。', done: has('coal', 'charcoal') },
      { id: 'torch', title: '制作火把', how: '用木棍和煤（或木炭）合成火把，一次 4 支。', done: has('torch', 'lantern', 'crystal_lantern') },
      { id: 'torchPlaced', title: '点亮营地', how: '在你的落脚处放置 4 支火把。', hint: '暗影游荡者不会在明亮的地方出现。', ...cnt('torch', 4) },
      { id: 'furnace', title: '制作熔炉', how: '在工作台用 8 块碎石合成熔炉，并放置下来。', hint: '熔炉能烤熟食物、冶炼矿石、把沙子烧成玻璃。', done: has('furnace') },
      { id: 'eat', title: '填饱肚子', how: '手持食物按住鼠标右键进食。', hint: '霜莓、林檎随手可摘；打猎得到的肉放进熔炉或营火烤熟更顶饿。', ...cnt('ate', 1) },
      { id: 'survive', title: '熬过第一个夜晚', how: '天黑后待在明亮的庇护所里，或者用睡袋睡到天亮。', hint: '睡袋需要云绒——用剪刀剪羊毛或从云绒羊身上获得。', done: (g) => g.day >= 2 || ach('sleep')(g) },
    ],
  },
  {
    id: 'iron', zh: '第三章 · 铁与火', intro: '石器只能走到这里。向地下挖掘，找到铜与铁，让熔炉燃烧起来。',
    reward: [['glider', 1], ['torch', 16], ['bread', 4]],
    steps: [
      { id: 'copper', title: '熔炼铜锭', how: '挖掘带橙色斑点的铜矿石，把粗铜和燃料放进熔炉。', hint: '铜矿在地表附近的石层里很常见。', done: has('copper_ingot') },
      { id: 'rawiron', title: '找到铁矿', how: '用石镐挖掘带浅褐色斑点的铁矿石。', hint: '铁矿多在 Y=60 以下的石层与洞穴壁上。按 F3 查看坐标。', done: has('raw_iron', 'iron_ingot') },
      { id: 'ingot', gate: true, title: '炼出铁锭', how: '把粗铁放进熔炉炼成铁锭。', done: has('iron_ingot') },
      { id: 'ironpick', title: '制作铁镐', how: '在工作台用 3 块铁锭和 2 根木棍合成铁镐。', hint: '铁镐能开采金矿、共鸣晶矿和星辉石。', done: pickAtLeast('iron') },
      { id: 'armor', title: '穿上护甲', how: '合成任意一件护甲，在背包里把它放进左侧的护甲栏。', hint: '皮甲用打猎得到的皮革，铜甲和铁甲在工作台合成。', done: (g) => [36, 37, 38, 39].some((i) => g.inventory.slots[i]) },
      { id: 'bucket', title: '制作铁桶', how: '用 3 块铁锭合成铁桶，可以装水和岩浆。', done: has('bucket', 'water_bucket', 'lava_bucket') },
    ],
  },
  {
    id: 'echo', zh: '第四章 · 聆听回响', intro: '织界的碎片在深处低语。下到幽光深层，造出能听见回响的罗盘。',
    reward: [['waystone', 2], ['crystal_lantern', 4], ['honey_bread', 4]],
    steps: [
      { id: 'deep', title: '深入幽光深层', how: '一路向下挖掘或探索洞穴，到达 Y=30 以下的黑暗深层。', hint: '带足火把和食物。玄岩比苍石更硬，颜色更深。', done: ach('deep') },
      { id: 'dust', title: '采集共鸣晶粉', how: '用铁镐开采闪着青光的共鸣晶矿。', hint: '深层的玄岩共鸣晶矿更多。', done: has('crystal_dust') },
      { id: 'gold', title: '熔炼金锭', how: '用铁镐开采金矿，熔炼出至少 4 块金锭。', hint: '金矿较深，常见于 Y=40 以下。', done: has('gold_ingot') },
      { id: 'resonator', title: '制作共鸣台', how: '工作台合成：玄岩砖 ×4、共鸣晶粉 ×4、铜块 ×1。', hint: '玄岩砖用深层的玄岩碎块合成；铜块用 9 块铜锭合成。', done: has('resonator') },
      { id: 'crystal', title: '获得回响晶片', how: '寻找地下的晶洞——满是紫色晶体的空腔，打碎晶簇获得回响晶片。', hint: '晶洞外层是平滑的白晶岩，里面会发出微光。', done: has('echo_crystal') },
      { id: 'compass', gate: true, title: '制作回响罗盘', how: '站在共鸣台旁：金锭 ×4、回响晶片 ×1、共鸣晶粉 ×1。', done: has('echo_compass') },
      { id: 'ping', title: '发出回响', how: '把回响罗盘放在快捷栏，按 F 发出回响脉冲。', hint: '脉冲会透过岩石显示附近的矿石，并指出最近的碎片神殿方向。', done: ach('ping') },
    ],
  },
  {
    id: 'shards', zh: '第五章 · 织界碎片', intro: '五座神殿守着五枚碎片。跟随回响找到第一座，解开它的封印。',
    reward: [['feather_charm', 1], ['star_candy', 3], ['waystone', 2]],
    steps: [
      { id: 'shrine', title: '找到碎片神殿', how: '跟着回响脉冲指示的方向前进，直到看见神殿。', hint: '天穹神殿在云上，深渊圣所在深层，方尖碑在沙海，冰晶尖塔在雪原，潮汐神殿在海底。', done: (g) => [...(g.structures || new Map()).values()].some((s) => STRUCTURE_INFO[s.kind] && STRUCTURE_INFO[s.kind].shard) },
      { id: 'waystone', title: '激活回响石碑', how: '对着回响石碑按右键将它激活。之后可以在任意两座石碑之间传送。', hint: '神殿和遗迹附近常有石碑；也可以放置自己的石碑。', done: ach('waystone') },
      { id: 'seal', title: '开启神殿封印', how: '找到神殿里所有的符文基座，对着它们按右键点亮。全部点亮后织印石门会打开。', hint: '基座可能藏在楼梯尽头、地下室或塔顶。', done: ach('shrine') },
      { id: 'shard', title: '取得回响碎片', how: '进入封印后的宝库，打开宝箱取出碎片。', done: (g) => !!(g.quest && g.quest.found.size > 0) },
      { id: 'altar', gate: true, title: '碎片归位', how: '带着碎片回到织心祭坛，对着祭坛按右键放入碎片。', hint: '祭坛就在你最初醒来的地方，按 M 打开地图可以看到它。', done: (g) => !!(g.quest && g.quest.placed.size > 0) },
    ],
  },
  {
    id: 'weave', zh: '终章 · 重织', intro: '还有四座神殿在等待。集齐全部碎片，打倒深渊的守卫，把世界重新织在一起。',
    reward: [['star_wings', 1], ['stargem', 8]],
    steps: [
      { id: 'five', title: '集齐五枚碎片', how: '找到全部五座神殿并取出碎片。', hint: '每次回响都会指向最近的、还没取得碎片的神殿。', count: (g) => (g.quest ? g.quest.found.size : 0), of: 5 },
      { id: 'warden', title: '击败遗迹守卫', how: '深渊圣所的守卫会在你踏入大厅时苏醒。', hint: '带上铁甲或星辉甲、好剑和大量食物。它怕远程消耗。', done: ach('boss') },
      { id: 'reweave', gate: true, title: '重织世界', how: '把五枚碎片全部放回织心祭坛。', count: (g) => (g.quest ? g.quest.placed.size : 0), of: 5 },
    ],
  },
];

export const SIDE = [
  {
    id: 'farm', zh: '支线 · 田园', intro: '种下种子，养起牲畜，让饭桌丰盛起来。',
    reward: [['melon_seeds', 4], ['honey_bread', 6]],
    steps: [
      { id: 'hoe', title: '制作锄头', how: '用木板（或石头）和木棍合成锄头。', done: has(...TOOL_TIERS.map((t) => `${t}_hoe`)) },
      { id: 'seeds', title: '收集麦种', how: '打碎草丛有机会掉落麦种。', done: has('wheat_seeds') },
      { id: 'plant', title: '播种', how: '用锄头右键翻耕水边的泥土，再把麦种种在耕地上。', hint: '耕地离水 4 格以内才会保持湿润，作物长得更快。', ...cnt('planted', 4) },
      { id: 'wheat', title: '收获小麦', how: '等麦穗变成金黄色后收割。骨粉可以催熟。', done: has('wheat') },
      { id: 'bread', title: '烤面包', how: '用 3 束麦穗在工作台合成面包。', done: has('bread', 'honey_bread') },
      { id: 'breed', title: '繁殖动物', how: '拿着动物喜欢的食物（鹿吃小麦，蓬蓬鸟吃种子）右键喂两只同类。', done: ach('breed') },
    ],
  },
  {
    id: 'home', zh: '支线 · 家园', intro: '把营地变成一个真正的家。',
    reward: [['lantern', 4], ['flower_pot', 2], ['carpet_red', 6]],
    steps: [
      { id: 'chest', title: '制作木箱', how: '用 8 块木板合成木箱，存放多余的物品。', done: has('chest') },
      { id: 'door', title: '装上一扇门', how: '合成并放置一扇木门。', done: has('oak_door', 'iron_door') },
      { id: 'glass', title: '烧制玻璃', how: '把沙子放进熔炉烧成玻璃，做成窗户。', done: has('glass') },
      { id: 'build', title: '筑造', how: '放置 300 个方块，建造属于你的房屋。', count: (g) => (g.codex ? g.codex.stats.placed : 0), of: 300 },
      { id: 'bedPlaced', title: '安家', how: '在家里放下睡袋，并在上面睡一觉，设置重生点。', done: ach('sleep') },
    ],
  },
  {
    id: 'village', zh: '支线 · 炊烟', intro: '荒野里也有人烟。找到一座村落，用织纹币和村民做生意，再跟着藏宝图去挖宝。',
    reward: [['weave_coin', 12], ['treasure_map', 1]],
    steps: [
      { id: 'find', title: '找到炊烟村落', how: '村落坐落在草甸、森林、樱林和针叶林的平地上：一口水井、四条石子路和几栋木屋。', hint: '站在高处找炊烟般的屋顶和路灯；按 M 打开地图，发现的村落会被标出。', done: (g) => [...(g.structures || new Map()).values()].some((s) => s.kind === 'village') },
      { id: 'coin', title: '赚到织纹币', how: '把多余的麦穗、羊毛、煤或矿石卖给村民，换取织纹币。遗迹宝箱里也常有。', done: has('weave_coin') },
      { id: 'trade', title: '与村民交易', how: '对着村民按右键打开货架。每位村民的货物不同，每天清晨补货。', ...cnt('villageTrade', 1) },
      { id: 'map', title: '买一张藏宝图', how: '制图师（戴贝雷帽、穿深蓝外套）出售藏宝图。', done: has('treasure_map') },
      { id: 'dig', title: '挖出宝藏', how: '右键展开藏宝图，跟着屏幕下方的指引走到标记处，向下挖两三格。', hint: '宝藏埋在地表以下，用铲子挖得更快。', ...cnt('treasure', 1) },
    ],
  },
  {
    id: 'friends', zh: '支线 · 旅伴', intro: '荒野里并不只有你。',
    reward: [['fishing_rod', 1], ['fish', 6]],
    steps: [
      { id: 'fish', title: '钓到一条鱼', how: '用 3 根木棍和 2 根丝线做鱼竿，对着水面右键抛竿，浮标下沉时再按右键。', hint: '丝线来自蜘蛛，或用云绒合成。', done: ach('fish') },
      { id: 'tame', title: '驯服灵狐', how: '雪原上的灵狐喜欢霜莓。喂它直到冒出爱心。', hint: '驯服后它会跟着你一起战斗。', done: ach('tame') },
      { id: 'trade', title: '与游商交易', how: '游商会不定期出现在你附近，右键与他交易。', done: ach('trade') },
      { id: 'hunter', title: '击退暗影', how: '打倒一只暗影游荡者。', done: ach('hunter') },
    ],
  },
  {
    id: 'machine', zh: '支线 · 机巧', intro: '共鸣晶粉可以传递信号，驱动整座工坊。',
    reward: [['crystal_dust', 32], ['repeater', 2], ['piston', 2]],
    steps: [
      { id: 'lamp', title: '点亮晶灯', how: '放一盏晶灯，用共鸣丝把它连到拉杆或按钮上，再拨动拉杆。', hint: '共鸣晶粉右键铺在地上就是共鸣丝。', done: ach('lamp') },
      { id: 'piston', title: '制作推进器', how: '在工作台合成推进器，给它信号就能推动方块。', done: ach('piston') },
      { id: 'hopper', title: '自动化', how: '合成漏斗或传送带，让物品自己流动起来。', done: has('hopper', 'conveyor') },
      { id: 'cart', title: '轨道旅人', how: '铺设轨道，放下矿车并乘坐它。', done: ach('cart') },
    ],
  },
  {
    id: 'stars', zh: '支线 · 星辰', intro: '夜空里落下的不只是光。',
    reward: [['meteor_ingot', 2], ['star_candy', 4]],
    steps: [
      { id: 'glide', title: '乘风而行', how: '从高处跳下，在空中按住空格展开滑翔翼，滑翔超过 60 格。', done: ach('glider') },
      { id: 'meteor', title: '天外来客', how: '流星雨之夜，跟着坠落的星光找到陨坑，拾取陨铁原矿或星屑。', hint: '流星雨时天空会出现成串的流星。', done: ach('meteor') },
      { id: 'starpick', title: '星辰锻造', how: '用星辉石在锻石台制作星辉镐。', hint: '星辉石矿在很深的地方，需要铁镐。', done: ach('star') },
      { id: 'sky', title: '云端漫步', how: '登上浮空群岛。', hint: '用逆重晶、滑翔翼、导风扇或者一路搭方块上去。', done: ach('sky') },
    ],
  },
  {
    id: 'wander', zh: '支线 · 行者', intro: '世界很大，地图上的空白在等着你。',
    reward: [['spyglass', 1], ['waystone', 2]],
    steps: [
      { id: 'biomes', title: '踏足八种群系', how: '去不同的地方走走：森林、草原、沙海、雪原、沼泽、樱林……', count: (g) => (g.codex ? g.codex.biomes.size : 0), of: 8 },
      { id: 'ruins', title: '发现五座遗迹', how: '遗迹、矿道、巢穴和神殿都算。', count: (g) => (g.structures ? g.structures.size : 0), of: 5 },
      { id: 'travel', title: '一步千里', how: '激活两座回响石碑，并在它们之间传送一次。', done: ach('travel') },
      { id: 'lore', title: '织者手记', how: '在遗迹宝箱里收集 4 页织者手记。', count: (g) => (g.lorePages ? g.lorePages.size : 0), of: 4 },
    ],
  },
];
const ALL = [...CHAPTERS, ...SIDE];

const isLog = (id) => { const n = BLOCKS[id] && BLOCKS[id].name; return !!n && (n.endsWith('_log') || n === 'mushroom_stem'); };
const STONEISH = new Set(['stone', 'cobblestone', 'deepstone', 'deep_cobble', 'sandstone', 'redstone_rock']);

export function installJourney(game, state) {
  const s = (state && state.journey) || {};
  const J = game.journey = {
    done: new Set(s.done || []),     // `${chapter}.${step}`
    paid: new Set(s.paid || []),     // chapters whose reward was given
    cnt: Object.assign({}, s.cnt || {}),
    tips: new Set(s.tips || []),
    hidden: !!s.hidden,
    fresh: !state || !state.journey,
  };
  game.stateSavers.push((st) => { st.journey = { done: [...J.done], paid: [...J.paid], cnt: J.cnt, tips: [...J.tips], hidden: J.hidden }; });

  const progress = (step) => {
    if (step.count) { const n = step.count(game); return { n: Math.min(n, step.of), of: step.of, ok: n >= step.of }; }
    const ok = !!step.done(game);
    return { n: ok ? 1 : 0, of: 1, ok };
  };
  const chapterDone = (c) => c.steps.every((st) => J.done.has(`${c.id}.${st.id}`));
  J.chapterDone = chapterDone;
  J.progress = progress;
  // the active main chapter: the first not finished
  J.active = () => CHAPTERS.find((c) => !chapterDone(c)) || null;
  J.current = () => {
    const c = J.active();
    if (!c) return null;
    const step = c.steps.find((st) => !J.done.has(`${c.id}.${st.id}`));
    return step ? { c, step } : null;
  };

  const holdingPick = () => { const held = game.inventory.held(); const d = held && ITEMS[held.id]; return !!(d && d.tool && d.tool.type === 'pickaxe'); };
  // counters fed by gameplay events
  const bump = (k, n = 1) => { J.cnt[k] = (J.cnt[k] || 0) + n; };
  game.on('blockBroken', (x, y, z, v) => {
    const id = v & ID_MASK;
    if (isLog(id)) bump('logs');
    else if (STONEISH.has(BLOCKS[id] && BLOCKS[id].name) && holdingPick()) bump('stone'); // (no drop without a pickaxe)
  });
  game.on('blockPlaced', (x, y, z, v) => {
    const id = v & ID_MASK, n = BLOCKS[id] && BLOCKS[id].name;
    if (id === B.workbench) bump('bench');
    else if (n === 'torch' || n === 'lantern' || n === 'crystal_lantern' || n === 'campfire') bump('torch');
    else if (BLOCKS[id] && BLOCKS[id].shape === 'crop') bump('planted');
  });
  game.on('ate', () => bump('ate'));
  game.on('traded', (name, prof) => { if (prof) bump('villageTrade'); });
  game.on('treasureFound', () => bump('treasure'));

  const give = (c) => {
    const names = [];
    for (const [name, n] of c.reward) {
      const id = I[name];
      if (id === undefined) continue;
      const left = game.inventory.add(id, n);
      if (left > 0) game.spawnItem(game.player.x, game.player.y + 0.5, game.player.z, { id, n: left });
      names.push(`${ITEMS[id].zh}${n > 1 ? ` ×${n}` : ''}`);
    }
    return names.join('、');
  };

  // a quiet first pass: an older save that is already far along starts where it is (no reward spam)
  // (a step marked `gate` can only be done after the ones before it, so it completes them too)
  const settle = (silent) => {
    for (const c of ALL) {
      c.steps.forEach((st, i) => {
        const k = `${c.id}.${st.id}`;
        if (J.done.has(k)) return;
        if (!progress(st).ok) return;
        J.done.add(k);
        if (st.gate) for (let j = 0; j < i; j++) J.done.add(`${c.id}.${c.steps[j].id}`);
        if (!silent && !game.player.creative) {
          const active = J.active();
          if (CHAPTERS.includes(c) ? (active === c || chapterDone(c)) : true) {
            game.hud.toast(`✓ ${st.title}`, c.zh, 'quest', 3200);
            game.audio && game.audio.play('pickup');
          }
        }
      });
      if (chapterDone(c) && !J.paid.has(c.id)) {
        J.paid.add(c.id);
        if (silent || game.player.creative) continue;
        const what = give(c);
        game.hud.showSubtitle(`${c.zh.replace(/^.*· /, '')} · 完成`, 3500);
        game.hud.toast(`${c.zh} 完成`, `奖励：${what}`, 'achievement', 6500);
        game.audio && game.audio.play('quest');
        game.emit('chapterDone', c.id);
        const next = J.active();
        if (next && CHAPTERS.includes(c)) setTimeout(() => game.hud.toast(`新的篇章：${next.zh}`, next.intro, 'quest', 7000), 2600);
      }
    }
  };
  const isOld = !J.fresh || (state && (state.day > 1 || (state.discovered && state.discovered.length > 12)));
  if (isOld) settle(true);
  J.fresh = false;

  // one-time contextual tips
  const tip = (id, title, body, ms = 7000) => {
    if (J.tips.has(id) || game.player.creative) return;
    J.tips.add(id);
    game.hud.toast(title, body, 'tip', ms);
  };
  J.tip = tip;
  game.on('blockHit', (x, y, z, v) => {
    const d = BLOCKS[v & ID_MASK];
    if (!d || !STONEISH.has(d.name)) return;
    const held = game.inventory.held();
    const pick = held && ITEMS[held.id] && ITEMS[held.id].tool && ITEMS[held.id].tool.type === 'pickaxe';
    if (!pick) tip('pick', '需要一把镐', '徒手挖石头既慢又不会掉落。先用木板和木棍在工作台做一把木镐。');
  });

  let t = 0, introT = 0;
  game.addSystem({
    tick(g) {
      if (++t % 10) return;
      settle(false);
      if (g.player.creative) return;
      const p = g.player;
      // welcome card on a brand-new world
      if (!J.tips.has('welcome')) {
        introT++;
        if (introT > 3) tip('welcome', '欢迎来到回响荒野', '左上角是你的<b>旅程</b>：它会一步步告诉你接下来做什么。按 <b>L</b> 打开旅程手册，按 <b>E</b> 打开背包与合成书。', 11000);
      }
      const dt = g.dayTime % 24000;
      if (dt > 11200 && dt < 12600) tip('dusk', '天色渐暗', '夜里会出现<b>暗影游荡者</b>。放置火把照亮周围、躲进屋里，或者在睡袋里睡到天亮。', 9000);
      if (p.hunger <= 9) tip('hunger', '肚子饿了', '饱食度低于一半后不再自动回血，太低还会无法疾跑。手持食物<b>按住右键</b>进食。');
      if (p.health <= 9 && p.health > 0) tip('hurt', '你受伤了', '饱食度充足时生命会慢慢恢复。先退到安全的地方。');
      if (p.medium && p.medium.eyeWater) tip('swim', '在水下', '按住<b>空格</b>上浮。注意快捷栏上方的气泡——耗尽后会溺水。');
      const x = Math.floor(p.x), y = Math.floor(p.y + 1), z = Math.floor(p.z);
      if (g.world.isLoaded(x, z)) {
        const lv = g.world.getLight(x, y, z);
        if ((lv & 15) < 3 && ((lv >> 4) & 15) < 4 && p.y < 56) tip('dark', '这里很暗', '黑暗中会生成怪物。放置<b>火把</b>照亮洞穴，也方便找到回去的路。');
      }
      if (g.inventory.slots.slice(0, 36).every(Boolean)) tip('full', '背包满了', '新捡到的东西会留在地上。做一个<b>木箱</b>存放杂物，或按 Q 丢掉不需要的。');
      if (g.entities && (g.ticks % 40 === 0)) {
        const foe = g.entities.near(p.x, p.y, p.z, 14, (e) => e.def && e.def.hostile && e.alive)[0];
        if (foe) tip('foe', `小心：${foe.def.zh}`, '左键攻击，剑比徒手痛得多。打不过就退到明亮处——多数影子怕光。');
      }
      if (g.day >= 2 && !J.tips.has('journal') && J.done.size >= 6) tip('journal', '旅程手册', '按 <b>L</b> 查看全部篇章、每一步的做法和奖励，还有田园、家园、机巧等支线。');
    },
  });

  // HUD tracker (replaces the old one-line goal; shard carrying keeps priority)
  const oldGoal = game.goalText;
  game.goalText = () => {
    if (game.player.creative || J.hidden) return '';
    const carrying = game.quest && !game.quest.done && ['shard_sky', 'shard_abyss', 'shard_sand', 'shard_frost', 'shard_tide'].some((n) => game.inventory.has(I[n]));
    if (carrying && oldGoal) return `<div class="qt"><div class="qt-ch">织界碎片</div><div class="qt-step">${oldGoal()}</div></div>`;
    const cur = J.current();
    if (!cur) return oldGoal ? `<div class="qt"><div class="qt-step">${oldGoal()}</div></div>` : '';
    const pr = progress(cur.step);
    const idx = cur.c.steps.indexOf(cur.step);
    const bar = pr.of > 1 ? `<div class="qt-bar"><i style="width:${Math.round(pr.n / pr.of * 100)}%"></i></div>` : '';
    return `<div class="qt"><div class="qt-ch">${cur.c.zh}<span>${idx + 1}/${cur.c.steps.length}</span></div>`
      + `<div class="qt-step">${cur.step.title}${pr.of > 1 ? `<span class="qt-n">${pr.n}/${pr.of}</span>` : ''}</div>${bar}`
      + `<div class="qt-how">${cur.step.how}</div><div class="qt-key">L 旅程手册</div></div>`;
  };

  game.openJourney = () => { if (!game.app.ui.open) game.app.ui.push(new JourneyScreen(game)); };
}

class JourneyScreen extends Screen {
  constructor(game) { super(); this.game = game; const a = game.journey.active(); this.sel = (a || CHAPTERS[CHAPTERS.length - 1]).id; }
  build() {
    const g = this.game, J = g.journey;
    this.list = h('div', { class: 'jr-list' });
    this.body = h('div', { class: 'jr-body' });
    const total = ALL.reduce((a, c) => a + c.steps.length, 0);
    const hide = h('button', { class: 'btn small', onclick: () => { J.hidden = !J.hidden; hide.textContent = J.hidden ? '显示追踪' : '隐藏追踪'; } }, J.hidden ? '显示追踪' : '隐藏追踪');
    const root = h('div', { class: 'screen' }, h('div', { class: 'panel journey-panel' },
      h('div', { class: 'codex-head' }, h('div', { class: 'title' }, '旅程手册'), h('div', { class: 'codex-sum' }, `已完成 ${J.done.size} / ${total} 步 · 篇章奖励 ${J.paid.size} / ${ALL.length}`)),
      h('div', { class: 'jr-wrap' }, this.list, this.body),
      h('div', { class: 'menu-row' }, hide, h('button', { class: 'btn primary', onclick: () => this.close() }, '关闭（L）'))));
    this.render();
    return root;
  }
  render() {
    const g = this.game, J = g.journey, ui = this.ui;
    const active = J.active();
    this.list.innerHTML = '';
    const row = (c, side) => {
      const done = J.chapterDone(c);
      const n = c.steps.filter((st) => J.done.has(`${c.id}.${st.id}`)).length;
      const locked = !side && !done && c !== active && CHAPTERS.indexOf(c) > CHAPTERS.indexOf(active);
      this.list.appendChild(h('div', { class: `jr-ch${c.id === this.sel ? ' on' : ''}${done ? ' done' : ''}${locked ? ' locked' : ''}`, onclick: () => { this.sel = c.id; this.render(); } },
        h('span', { class: 'jr-mark' }, done ? '✦' : c === active ? '➤' : side ? '◇' : '·'),
        h('span', { class: 'jr-name' }, c.zh), h('span', { class: 'jr-cnt' }, `${n}/${c.steps.length}`)));
    };
    this.list.appendChild(h('div', { class: 'jr-group' }, '主线'));
    CHAPTERS.forEach((c) => row(c, false));
    this.list.appendChild(h('div', { class: 'jr-group' }, '支线'));
    SIDE.forEach((c) => row(c, true));
    const c = ALL.find((x) => x.id === this.sel);
    const b = this.body;
    b.innerHTML = '';
    const locked = CHAPTERS.includes(c) && active && CHAPTERS.indexOf(c) > CHAPTERS.indexOf(active) && !J.chapterDone(c);
    b.appendChild(h('div', { class: 'jr-title' }, c.zh));
    b.appendChild(h('div', { class: 'jr-intro' }, c.intro));
    let firstOpen = true;
    for (const st of c.steps) {
      const done = J.done.has(`${c.id}.${st.id}`);
      const pr = J.progress(st);
      const cur = !done && firstOpen && !locked;
      if (!done) firstOpen = false;
      const hideText = locked && !done;
      b.appendChild(h('div', { class: `jr-step${done ? ' done' : ''}${cur ? ' cur' : ''}` },
        h('div', { class: 'jr-st-head' }, h('span', { class: 'jr-check' }, done ? '✓' : cur ? '›' : ''), h('span', { class: 'jr-st-title' }, hideText ? '？？？' : st.title),
          pr.of > 1 && !done && !hideText ? h('span', { class: 'jr-st-n' }, `${pr.n}/${pr.of}`) : null),
        hideText ? null : h('div', { class: 'jr-how' }, st.how),
        hideText || !st.hint || done ? null : h('div', { class: 'jr-hint' }, `提示：${st.hint}`),
        pr.of > 1 && !done && !hideText ? h('div', { class: 'qt-bar' }, h('i', { style: { width: `${Math.round(pr.n / pr.of * 100)}%` } })) : null));
    }
    const rw = h('div', { class: 'jr-reward' }, h('span', { class: 'dim' }, J.paid.has(c.id) ? '奖励（已领取）' : '完成奖励'));
    for (const [name, n] of c.reward) {
      const id = I[name];
      if (id === undefined) continue;
      const it = h('div', { class: 'jr-item' }, h('img', { src: iconURL(id), draggable: 'false' }), n > 1 ? h('span', {}, String(n)) : null);
      it.addEventListener('mouseenter', () => ui.showTip(itemTooltip({ id, n })));
      it.addEventListener('mouseleave', () => ui.hideTip());
      rw.appendChild(it);
    }
    b.appendChild(rw);
  }
  close() { this.ui && this.ui.hideTip(); super.close(); }
  onKey(e) { if (e.code === 'Escape' || e.code === 'KeyL') { this.close(); return true; } return true; }
}
