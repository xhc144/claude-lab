// Item registry. Block items share their block's id (0..1023); other items start at 1024.

import { BLOCKS, B, MAX_BLOCKS } from './blocks.js';

export const ITEMS = [];
export const I = Object.create(null); // name -> id

export const TIERS = [
  { key: 'wood', zh: '木', speed: 2, dur: 64, dmg: 0, color: '#a1703f' },
  { key: 'stone', zh: '石', speed: 4, dur: 140, dmg: 1, color: '#7c8591' },
  { key: 'copper', zh: '铜', speed: 5, dur: 220, dmg: 1.5, color: '#db8a5c' },
  { key: 'iron', zh: '铁', speed: 6.5, dur: 300, dmg: 2, color: '#cdd2d9' },
  { key: 'star', zh: '星辉', speed: 9, dur: 1600, dmg: 3, color: '#b7d5ff' },
  { key: 'meteor', zh: '星铁', speed: 12, dur: 2600, dmg: 4, color: '#ff8a4a' },
];

let nextItemId = MAX_BLOCKS;
function item(name, zh, o = {}) {
  const id = nextItemId++;
  const d = { id, name, zh, stack: 64, cat: 'material', desc: '', ...o };
  ITEMS[id] = d;
  I[name] = id;
  return id;
}

// block items
for (const b of BLOCKS) {
  if (!b.item) continue;
  ITEMS[b.id] = { id: b.id, name: b.name, zh: b.zh, block: b.id, stack: 64, cat: b.cat || 'build', desc: '' };
  I[b.name] = b.id;
}

// ---- materials
item('stick', '木棍');
item('coal', '煤', { fuel: 80 });
item('charcoal', '木炭', { fuel: 80 });
item('raw_copper', '粗铜');
item('raw_iron', '粗铁');
item('raw_gold', '粗金');
item('raw_meteor', '陨铁原矿', { desc: '从天而降的星铁，需要高温熔炼。' });
item('copper_ingot', '铜锭');
item('iron_ingot', '铁锭');
item('gold_ingot', '金锭');
item('meteor_ingot', '星铁锭', { desc: '坚韧无比的天外金属。' });
item('crystal_dust', '共鸣晶粉', { places: 'wire', desc: '放置后形成共鸣丝，可以传导共鸣信号。' });
item('stargem', '星辉石', { desc: '深层岩石中闪烁的宝石。' });
item('echo_crystal', '回响晶片', { desc: '晶洞中生长的晶体，蕴含回响之力。' });
item('star_shard', '星屑', { desc: '陨星核心的碎片，微微发光。' });
item('flint', '燧石');
item('leather', '皮革');
item('fluff', '云绒', { desc: '云角羊身上的柔软绒毛。' });
item('string', '丝线');
item('feather', '羽毛');
item('bone', '骨头');
item('bone_meal', '骨粉', { use: 'fertilize', desc: '对作物或树苗使用，加速生长。' });
item('glow_spore', '荧光孢子', { desc: '幽光深层菌类的孢子，会发出柔和的光。' });
item('gel', '弹胶', { desc: '跃跃史莱姆的凝胶，富有弹性。' });
item('clay_ball', '陶泥球');
item('brick', '砖坯');
item('snowball', '雪球', { stack: 16, use: 'throw' });
item('book', '书');
item('paper', '纸');
item('blast_powder', '爆裂粉', { desc: '爆孢菇的孢子粉，一点就炸。' });
item('wheat_seeds', '麦种', { places: 'wheat', cat: 'nature' });
item('melon_seeds', '灯笼瓜籽', { places: 'melon_stem', cat: 'nature' });
item('loom_thread', '织界丝', { desc: '用回响晶片与星屑纺成的丝线，古代织者的造物之材。' });
item('gear', '铜齿轮');
item('lens', '晶透镜');

// ---- food (hunger points, saturation)
const food = (name, zh, hunger, sat, o = {}) => item(name, zh, { food: { hunger, sat }, cat: 'food', ...o });
food('berries', '霜莓', 2, 0.6);
food('crabapple', '林檎', 4, 2.4);
food('wheat', '麦穗', 0, 0, { food: null, cat: 'material' });
food('bread', '面包', 5, 6);
food('radish', '月光萝卜', 3, 3.6, { places: 'radish' });
food('melon_slice', '灯笼瓜片', 2, 1.2);
food('sunroot', '日薯', 1, 0.6, { places: 'sunroot' });
food('baked_sunroot', '烤日薯', 5, 6);
food('raw_venison', '生鹿肉', 3, 1.8);
food('venison', '烤鹿肉', 8, 12.8);
food('raw_boar', '生野猪肉', 3, 1.8);
food('boar', '烤野猪肉', 8, 12.8);
food('raw_fowl', '生禽肉', 2, 1.2, { poison: 0.3 });
food('fowl', '烤禽肉', 6, 7.2);
food('raw_fish', '生银鳞鱼', 2, 0.4);
food('fish', '烤银鳞鱼', 5, 6);
food('egg', '蓬鸟蛋', 0, 0, { food: null, stack: 16, use: 'throw', cat: 'material' });
food('mushroom_stew', '菌菇汤', 6, 7.2, { stack: 1, returns: 'bowl' });
food('fried_egg', '煎蛋', 4, 4);
food('honey_bread', '蜜糖面包', 7, 9);
food('star_candy', '星糖', 4, 9.6, { effect: 'glow', desc: '吃下后身体会微微发光一段时间。' });
item('bowl', '木碗');

// ---- tools
const TOOL_TYPES = [
  ['pickaxe', '镐'], ['axe', '斧'], ['shovel', '锹'], ['hoe', '锄'], ['sword', '剑'],
];
for (let t = 0; t < TIERS.length; t++) {
  const tier = TIERS[t];
  for (const [type, zh] of TOOL_TYPES) {
    const baseDmg = type === 'sword' ? 4 : type === 'axe' ? 3.5 : type === 'pickaxe' ? 2 : 1.5;
    item(`${tier.key}_${type}`, `${tier.zh}${zh}`, {
      stack: 1, cat: 'tool',
      tool: { type, tier: t, speed: tier.speed, dur: tier.dur, dmg: baseDmg + tier.dmg * (type === 'sword' ? 1.3 : 1) },
    });
  }
}

// ---- armour
export const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet'];
const ARMOR = [
  ['leather', '皮', [1, 3, 2, 1], 80, '#8a5a30'],
  ['copper', '铜', [2, 4, 3, 1], 160, '#db8a5c'],
  ['iron', '铁', [2, 6, 5, 2], 240, '#cdd2d9'],
  ['star', '星辉', [3, 8, 6, 3], 520, '#b7d5ff'],
];
const PIECES = [['helmet', '盔'], ['chestplate', '甲'], ['leggings', '护腿'], ['boots', '靴']];
for (const [mat, zh, pts, dur, color] of ARMOR) {
  PIECES.forEach(([piece, pzh], slot) => {
    item(`${mat}_${piece}`, `${zh}${pzh}`, { stack: 1, cat: 'armor', armor: { slot, points: pts[slot], dur: dur * (slot === 1 ? 1.4 : 1), color } });
  });
}

// ---- gear & specials
item('bucket', '铁桶', { stack: 16, cat: 'tool', use: 'bucket' });
item('water_bucket', '水桶', { stack: 1, cat: 'tool', use: 'bucket', fluid: 'water' });
item('lava_bucket', '岩浆桶', { stack: 1, cat: 'tool', use: 'bucket', fluid: 'lava', fuel: 1000 });
item('flint_steel', '打火石', { stack: 1, cat: 'tool', use: 'ignite', tool: { type: 'ignite', dur: 64 } });
item('shears', '剪刀', { stack: 1, cat: 'tool', tool: { type: 'shears', tier: 2, speed: 6, dur: 238, dmg: 1 } });
item('fishing_rod', '钓竿', { stack: 1, cat: 'tool', use: 'fish', tool: { type: 'rod', dur: 64 } });
item('bow', '长弓', { stack: 1, cat: 'tool', use: 'bow', tool: { type: 'bow', dur: 384 } });
item('arrow', '箭', { cat: 'tool' });
item('glow_arrow', '荧光箭', { cat: 'tool', desc: '命中后会留下片刻光亮。' });
item('glider', '滑翔翼', { stack: 1, cat: 'gear', desc: '在空中按住跳跃键展开滑翔。导风扇和营火的热气流可以把你托起来。', tool: { type: 'glider', dur: 600 } });
item('grapple', '钩爪', { stack: 1, cat: 'gear', use: 'grapple', desc: '右键射出钩索，把自己拉向命中的方块。再次右键松开。', tool: { type: 'grapple', dur: 250 } });
item('echo_compass', '回响罗盘', { stack: 1, cat: 'gear', use: 'ping', desc: '右键发出回响脉冲：穿透岩石显示附近的矿石与洞穴，并指向最近的回响碎片。' });
item('spyglass', '望远镜', { stack: 1, cat: 'gear', use: 'zoom' });
item('cart', '矿车', { stack: 1, cat: 'mech', use: 'cart' });
item('waystone_key', '回响印记', { stack: 1, cat: 'gear', desc: '记录着你激活过的回响石碑。' });
item('star_wings', '织星之翼', { stack: 1, cat: 'gear', desc: '织界的馈赠。装备在副手栏，可以在空中自由飞翔（双击跳跃）。' });
item('feather_charm', '羽落护符', { stack: 1, cat: 'gear', desc: '放在背包里时，摔落伤害减半。' });
item('lantern_staff', '萤灯杖', { stack: 1, cat: 'gear', use: 'lightorb', desc: '右键放出一枚漂浮的光球，照亮周围一段时间。' });

// ---- the five echo shards
export const SHARDS = [
  ['shard_sky', '苍穹之羽', '浮空群岛的天穹神殿中'],
  ['shard_abyss', '深渊之心', '幽光深层的古老圣所里'],
  ['shard_sand', '沙海之眼', '流金沙海的方尖碑下'],
  ['shard_frost', '霜冻之泪', '霜晶荒原的冰晶尖塔内'],
  ['shard_tide', '潮汐之歌', '深海之下的潮汐神殿中'],
];
for (const [name, zh, where] of SHARDS) item(name, zh, { stack: 1, cat: 'quest', desc: `五枚回响碎片之一。传说它藏在${where}。`, shard: true });

export const ITEM_COUNT = ITEMS.length;
export const itemDef = (id) => ITEMS[id];
export function itemName(id) { const d = ITEMS[id]; return d ? d.zh : '未知物品'; }
export const maxStack = (id) => (ITEMS[id] ? ITEMS[id].stack : 64);
export const isBlockItem = (id) => id < MAX_BLOCKS;

// Seeds that drop from grass
export const GRASS_DROPS = ['wheat_seeds', 'melon_seeds', 'sunroot'];

// Mining time in seconds for block id with the given tool item (or null), Minecraft-like rules.
export function breakTime(blockId, toolItem) {
  const b = BLOCKS[blockId];
  if (b.hardness < 0) return Infinity;
  if (b.hardness === 0) return 0.05;
  const t = toolItem && ITEMS[toolItem.id] && ITEMS[toolItem.id].tool;
  let speed = 1, canHarvest = !b.tool || b.tool === 'shears' || b.tool === 'hoe' || b.tool === 'axe' || b.tool === 'shovel';
  if (b.tool === 'pickaxe') canHarvest = !!(t && t.type === 'pickaxe' && t.tier >= b.level);
  if (t && t.type === b.tool) { speed = t.speed; }
  if (t && t.type === 'sword' && (b.name === 'cobweb' || b.leaves)) speed = 8;
  if (t && t.type === 'shears' && (b.leaves || b.name === 'cobweb' || b.name.startsWith('felt_') || b.name === 'vines')) speed = 10;
  let time = b.hardness * (canHarvest ? 1.5 : 5) / speed;
  return Math.max(0.05, time);
}

export function canHarvest(blockId, toolItem) {
  const b = BLOCKS[blockId];
  if (b.tool !== 'pickaxe') return true;
  const t = toolItem && ITEMS[toolItem.id] && ITEMS[toolItem.id].tool;
  return !!(t && t.type === 'pickaxe' && t.tier >= b.level);
}

export { B };
