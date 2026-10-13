// Every card in 薪火纪. A card definition is pure data; the simulation, the AI, the renderer and the
// codex all read from here. Kinds decide the frame style and the broad rules:
//   folk · food · resource · node · structure · tool · gear · beast · enemy · lair · region ·
//   knowledge · coin · bundle · event · wonder · misc
// Seasons are indexed 0 春 / 1 夏 / 2 秋 / 3 冬.

export const CARDS = Object.create(null);

function add(id, kind, name, props = {}) {
  if (CARDS[id]) throw new Error('duplicate card ' + id);
  const tags = props.tags || [];
  CARDS[id] = { id, kind, name, desc: '', value: 0, rarity: 'common', ...props, tags };
  return CARDS[id];
}

// ---------------------------------------------------------------- folk ----------------------------
// Every person eats (appetite) at dawn. Workers can be stacked onto nodes, regions and structures.
function folk(id, name, p) {
  const base = { hp: 6, atk: 1, def: 0, spd: 1.6, dmg: 'blunt', appetite: 2, skills: {} };
  const tags = ['person', 'worker', 'adult', ...(p.tags || [])];
  return add(id, 'folk', name, { ...base, ...p, tags });
}

folk('survivor', '幸存者', { desc: '灰雾里走出来的普通人。能劳作、能战斗，也能接受训练成为专才。', tags: ['trainee'] });
add('child', 'folk', '孩童', {
  tags: ['person', 'child'], hp: 3, atk: 0, def: 0, spd: 2, dmg: 'blunt', appetite: 1,
  grows: { to: 'survivor', days: 2 },
  desc: '营地的未来。两个黎明后长大成为幸存者。不能劳作。',
});
folk('woodsman', '樵夫', { hp: 7, skills: { wood: 1.8 }, desc: '伐木与种树的好手。砍伐速度 ×1.8。' });
folk('miner', '矿工', { hp: 7, skills: { stone: 1.8, mine: 1.8 }, desc: '熟悉岩层与矿脉。采石与采矿速度 ×1.8。' });
folk('farmer', '农人', { skills: { farm: 1.8, forage: 1.4, fish: 1.2 }, desc: '懂得节令与土壤。耕作 ×1.8，采集 ×1.4。' });
folk('artisan', '工匠', { skills: { craft: 1.6, build: 1.5, smith: 1.4 }, desc: '双手灵巧。制作 ×1.6，建造 ×1.5。' });
folk('scholar', '学者', { hp: 5, skills: { research: 2.2 }, desc: '在灯下记录世界。研究产出 ×2.2。' });
folk('healer', '医者', { hp: 6, skills: { heal: 2, forage: 1.3 }, aura: { heal: 1, every: 8 }, desc: '与其同堆的人每 8 秒回复 1 点生命。草药采集 ×1.3。' });
folk('scout', '斥候', { hp: 7, atk: 2, dmg: 'pierce', skills: { explore: 1.8 }, safeExplore: 0.5, desc: '探索速度 ×1.8，探索遇险几率减半。' });
folk('merchant', '行商', { hp: 5, skills: { trade: 1 }, tradeBonus: 0.5, desc: '在集市出售货物时多得 50% 铜贝。商队会多给一个报价。' });
folk('lampwarden', '掌灯人', { hp: 8, atk: 2, dmg: 'light', light: 120, tags: ['soldier'], desc: '提灯巡夜。自带 120 光照，以光芒伤敌（对暗影双倍）。' });
folk('spearman', '矛兵', { hp: 10, atk: 2, dmg: 'pierce', skills: { hunt: 1.3 }, tags: ['soldier'], desc: '持矛的卫士。穿刺伤害，擅长对付野兽。' });
folk('archer', '弓手', { hp: 7, atk: 2, dmg: 'pierce', ranged: true, tags: ['soldier'], desc: '远程穿刺，可以命中飞行的敌人。' });
folk('maceguard', '锤卫', { hp: 13, atk: 2, def: 1, dmg: 'blunt', taunt: true, tags: ['soldier'], desc: '钝击无视护甲。嘲讽：敌人优先攻击锤卫。' });
folk('knight', '骑卫', { hp: 19, atk: 3, def: 2, spd: 1.3, dmg: 'pierce', tags: ['soldier'], desc: '铁甲骑手，营地最坚实的矛尖。' });
folk('musketeer', '火铳手', { hp: 9, atk: 5, dmg: 'pierce', ranged: true, spd: 2.2, tags: ['soldier'], desc: '火铳一响，猛兽也要倒下。远程。' });
folk('sage', '贤者', { hp: 6, light: 80, skills: { research: 3.2 }, desc: '研究产出 ×3.2，身周有微光。' });
folk('engineer', '机工', { hp: 7, skills: { craft: 1.5, smith: 1.7, build: 1.7 }, desc: '懂齿轮与蒸汽。锻造与建造 ×1.7。' });
folk('sailor', '水手', { hp: 8, skills: { sail: 1.8, fish: 1.6 }, desc: '出海探索 ×1.8，捕鱼 ×1.6。' });
folk('flamekeeper', '守火者', { hp: 12, atk: 4, dmg: 'light', light: 220, aura: { heal: 1, every: 10 }, tags: ['soldier'], rarity: 'rare', desc: '圣焰的守护者。220 光照，光芒伤害，并缓慢治疗同伴。' });
add('automaton', 'folk', '机关傀儡', {
  tags: ['person', 'worker', 'construct'], hp: 14, atk: 2, def: 2, spd: 1.8, dmg: 'blunt', appetite: 0,
  skills: { mine: 1.3, craft: 1.3, build: 1.3, stone: 1.3, wood: 1.3 }, fuelMax: 4, fuelTags: ['oil'], burn: 1, rarity: 'rare',
  desc: '不吃不睡的机关人。每天消耗 1 份灯油，没油时停止工作。',
});

// ---------------------------------------------------------------- food ----------------------------
function food(id, name, f, p = {}) {
  return add(id, 'food', name, { food: f, value: p.value ?? Math.max(1, Math.round(f / 2)), ...p, tags: ['food', ...(p.tags || [])] });
}
food('berry', '浆果', 1, { spoil: 3, tags: ['fruit'], desc: '酸甜的野果，填不饱肚子，但聊胜于无。' });
food('apple', '野果', 2, { spoil: 4, tags: ['fruit'], desc: '树上掉下来的果子。' });
food('mushroom', '蘑菇', 1, { spoil: 2, tags: ['raw'], desc: '黑暗里也会生长。烤一烤更好吃。' });
food('root', '块根', 2, { spoil: 6, tags: ['raw'], desc: '耐储存的根茎。' });
food('raw_fish', '生鱼', 1, { spoil: 2, tags: ['raw', 'fish'], desc: '放在火上烤，能多出一倍的饱腹。' });
food('cooked_fish', '烤鱼', 2, { spoil: 3, tags: ['cooked', 'fish'], desc: '焦香的烤鱼。' });
food('raw_meat', '生肉', 1, { spoil: 2, tags: ['raw', 'meat'], desc: '猎物的肉，需要烤熟或风干。' });
food('roast', '烤肉', 3, { spoil: 3, tags: ['cooked', 'meat'], desc: '篝火边最受欢迎的东西。' });
food('egg', '禽蛋', 1, { spoil: 4, tags: ['raw'], desc: '可以烤，也可以做馅饼。' });
food('grain', '谷物', 1, { tags: ['grain'], desc: '不会腐坏的谷粒。磨成面粉能做面包。' });
food('bread', '面包', 4, { spoil: 6, tags: ['cooked'], desc: '谷物的价值翻了四倍。' });
food('stew', '炖菜', 6, { spoil: 3, tags: ['cooked'], desc: '陶罐里咕嘟作响的一锅热汤。' });
food('jerky', '肉干', 2, { tags: ['preserved', 'meat'], desc: '风干的肉，永不腐坏，适合过冬。' });
food('salted_fish', '咸鱼', 3, { tags: ['preserved', 'fish'], desc: '盐渍的鱼，永不腐坏。' });
food('milk', '羊奶', 2, { spoil: 2, desc: '新鲜羊奶。' });
food('cheese', '奶酪', 5, { tags: ['preserved'], desc: '奶酪越放越香，永不腐坏。' });
food('honey', '蜂蜜', 2, { tags: ['preserved'], value: 3, desc: '金色的蜂蜜，永不腐坏。' });
food('jam', '果酱', 5, { tags: ['preserved'], value: 4, rarity: 'uncommon', desc: '把一整个夏天封进罐子里。' });
food('pie', '果馅饼', 9, { spoil: 4, value: 5, rarity: 'uncommon', desc: '营地里的节日才有的东西。' });
food('mussel', '贻贝', 1, { spoil: 2, tags: ['raw', 'fish'], desc: '潮池里的贝类，烤熟更好。' });
food('cooked_mussel', '烤贝', 2, { spoil: 3, tags: ['cooked', 'fish'], desc: '海边的盛宴。' });
food('feast', '盛宴', 20, { spoil: 2, value: 12, rarity: 'rare', tags: ['festive'], desc: '在庆典台上分享盛宴，灰雾会退散。' });
food('mead', '蜜酒', 2, { tags: ['preserved', 'festive'], value: 5, rarity: 'uncommon', desc: '让人忘却长夜的甜酒。' });
food('herb_tea', '草药茶', 2, { spoil: 3, heal: 2, tags: ['cooked'], rarity: 'uncommon', desc: '喝下它的人回复 2 点生命（叠到人物身上饮用）。' });
food('roast_root', '烤块根', 3, { spoil: 4, tags: ['cooked'], desc: '外焦里糯。' });
food('roast_mushroom', '烤蘑菇', 2, { spoil: 3, tags: ['cooked'], desc: '带着烟火气的菌香。' });
food('salt_roast', '盐焗肉排', 8, { spoil: 4, tags: ['cooked', 'meat'], value: 4, rarity: 'uncommon', desc: '盐壳里焗熟的大块肉，一块就能喂饱四个人。' });
food('rot', '腐物', 0, { value: 0, tags: ['compost'], desc: '腐坏的食物。可以给田地施肥。' });
CARDS.rot.tags = ['compost'];

// ---------------------------------------------------------------- resources -----------------------
function res(id, name, p = {}) {
  return add(id, 'resource', name, { value: 1, ...p, tags: ['material', ...(p.tags || [])] });
}
res('wood', '木材', { fuel: 1, tags: ['wood', 'fuel'], desc: '最基础的材料，也是篝火的燃料（1 天）。' });
res('stone', '石块', { tags: ['stone'], desc: '建造与工具的基础。' });
res('flint', '燧石', { tags: ['stone'], desc: '能打出火星的硬石，也能做成锋刃。' });
res('fiber', '纤维', { tags: ['plant'], desc: '草茎撕成的细丝，可以搓成绳。' });
res('resin', '树脂', { fuel: 1, tags: ['fuel', 'plant'], desc: '松树的泪，易燃。' });
res('sapling', '树苗', { tags: ['plant'], desc: '叠上一个人把它种下，两天后长成树。' });
res('hide', '兽皮', { value: 2, desc: '鞣制后可以做成皮革。' });
res('bone', '骨头', { desc: '可以磨成骨针、骨符。' });
res('feather', '羽毛', { desc: '轻盈的羽毛，可以做箭羽或羽笔。' });
res('charcoal', '木炭', { fuel: 3, value: 2, tags: ['fuel', 'smeltfuel'], desc: '窑里烧出的炭，冶炼和取暖都好用（3 天燃料）。' });
res('clay', '黏土', { desc: '可以烧成陶器与砖。' });
res('reed', '芦苇', { tags: ['plant'], desc: '能编筐、造纸。' });
res('sand', '沙', { desc: '熔化后成为琉璃。' });
res('rope', '绳索', { value: 2, desc: '一切捆扎都离不开它。' });
res('plank', '木板', { value: 2, fuel: 1, tags: ['wood', 'fuel'], desc: '刨平的木料，用于建造。' });
res('brick', '砖', { value: 2, desc: '窑火烧硬的黏土。' });
res('cloth', '布匹', { value: 3, desc: '织机织出的布。' });
res('leather', '皮革', { value: 3, desc: '鞣好的皮子，制作护甲与书卷。' });
res('herb', '草药', { tags: ['plant'], desc: '药囊与药剂的原料。' });
res('salt', '盐', { value: 2, desc: '腌渍食物，使其永不腐坏。' });
res('copper_ore', '铜矿石', { tags: ['ore'], desc: '泛绿的矿石，熔炼后得到铜锭。' });
res('tin_ore', '锡矿石', { tags: ['ore'], desc: '与铜同熔可得青铜。' });
res('iron_ore', '铁矿石', { tags: ['ore'], desc: '需要煤或木炭才能熔炼。' });
res('coal', '煤炭', { fuel: 4, value: 2, tags: ['fuel', 'smeltfuel'], desc: '黑色的石头，耐烧（4 天燃料）。' });
res('copper', '铜锭', { value: 3, tags: ['ingot'], desc: '柔软的红色金属。' });
res('bronze', '青铜锭', { value: 4, tags: ['ingot'], desc: '铜与锡的合金，坚硬耐用。' });
res('iron', '铁锭', { value: 5, tags: ['ingot'], desc: '新时代的骨骼。' });
res('glass', '琉璃', { value: 4, desc: '透光的琉璃，灯与灯塔的关键。' });
res('flour', '面粉', { value: 2, desc: '磨好的面粉，在烘炉里烤成面包。' });
res('paper', '纸', { value: 2, desc: '承载知识的薄片。' });
res('oil', '灯油', { value: 2, tags: ['oil'], desc: '灯柱、灯笼与傀儡的燃料。' });
res('gear', '齿轮', { value: 5, desc: '精密咬合的铁齿轮。' });
res('steam_core', '蒸汽核心', { value: 12, rarity: 'rare', desc: '锅炉与活塞的心脏。' });
res('sulfur', '硫磺', { value: 2, desc: '刺鼻的黄色晶体，火药的原料。' });
res('gunpowder', '火药', { value: 5, rarity: 'uncommon', desc: '一点就炸的黑色粉末。' });
res('crystal', '晶石', { value: 6, rarity: 'uncommon', desc: '会自己发出微光的晶体。' });
res('ember_shard', '余烬晶', { value: 8, rarity: 'rare', light: 0, desc: '古老火焰凝结的晶体，温热而明亮。' });
res('shadow_dust', '影尘', { value: 3, rarity: 'uncommon', desc: '暗影消散后留下的灰。据说能做成怪异的东西。' });
res('star_metal', '星铁', { value: 10, rarity: 'rare', desc: '从天而降的金属。' });
res('pearl', '珍珠', { value: 8, rarity: 'uncommon', desc: '潮池深处的宝物。' });
res('ivory', '象牙', { value: 6, rarity: 'uncommon', desc: '猛犸的长牙，可以雕刻。' });
res('fur', '毛皮', { value: 3, desc: '厚实的毛皮，能做御寒衣物。' });
res('ice', '冰块', { desc: '冰窖与冰屋的材料。' });
res('obsidian', '黑曜石', { value: 3, desc: '火山玻璃，锋利无比。' });
res('driftwood', '浮木', { fuel: 1, tags: ['wood', 'fuel'], desc: '海浪冲上岸的木头。' });
res('seaweed', '海藻', { tags: ['plant'], desc: '可以烧成灰，也能晒干当燃料。' });
res('wax', '蜂蜡', { value: 2, desc: '可以做成蜡烛。' });
res('candle', '蜡烛', { value: 2, light: 0, desc: '灯龛的供奉。' });
res('heartwood', '心木', { value: 15, rarity: 'epic', desc: '腐根兽体内仍然活着的木心。' });
res('wolf_pelt', '狼王皮', { value: 10, rarity: 'rare', desc: '头狼厚重的皮毛。' });
res('croc_tooth', '鳄王牙', { value: 12, rarity: 'rare', desc: '比铁还硬的牙齿。' });
res('molten_core', '熔核', { value: 15, rarity: 'epic', desc: '熔渣巨人仍在跳动的心脏。' });
res('frost_heart', '霜心', { value: 15, rarity: 'epic', desc: '冰魇消散后留下的寒晶。' });
res('abyss_pearl', '渊珠', { value: 20, rarity: 'epic', desc: '深渊海妖守护的巨珠，内部有光在流转。' });
for (const id of ['rot']) CARDS[id].kind = 'misc';

// ---------------------------------------------------------------- tools ---------------------------
// Tools sit in a stack as helpers (speeding up a skill) or are consumed to train a specialist.
function tool(id, name, p = {}) {
  return add(id, 'tool', name, { value: 3, ...p, tags: ['tool', ...(p.tags || [])] });
}
tool('stone_axe', '石斧', { tags: ['axe'], toolMult: 1.6, desc: '伐木工具：叠在伐木的堆里速度 ×1.6。也可用来训练樵夫。' });
tool('stone_pick', '石镐', { tags: ['pick'], toolMult: 1.5, desc: '采石工具 ×1.5，开采矿脉必需。也可训练矿工。' });
tool('bronze_axe', '青铜斧', { tags: ['axe'], toolMult: 2.2, value: 6, desc: '伐木 ×2.2。' });
tool('bronze_pick', '青铜镐', { tags: ['pick'], toolMult: 2.0, value: 6, desc: '采石采矿 ×2.0。' });
tool('iron_axe', '铁斧', { tags: ['axe'], toolMult: 2.8, value: 8, desc: '伐木 ×2.8。' });
tool('iron_pick', '铁镐', { tags: ['pick'], toolMult: 2.6, value: 8, desc: '采石采矿 ×2.6。' });
tool('fishing_rod', '钓竿', { tags: ['rod'], toolMult: 1.6, desc: '捕鱼 ×1.6。' });
tool('net', '渔网', { tags: ['rod'], toolMult: 2.2, value: 5, desc: '捕鱼 ×2.2。' });
tool('hoe', '锄头', { tags: ['hoe'], toolMult: 1.5, desc: '耕作 ×1.5，也可训练农人。' });
tool('pot', '陶罐', { tags: ['pot'], value: 2, desc: '炖煮与熬药的器皿。' });
tool('torch', '火把', { tags: ['torch', 'portable_light'], light: 110, fuelMax: 3, burn: 1, fuelTags: ['fuel'], fuelStart: 3, desc: '叠在堆里提供 110 光照，可以进入黑暗之地。每天燃烧 1 份。' });
tool('lantern', '灯笼', { tags: ['torch', 'portable_light'], light: 150, fuelMax: 6, burn: 1, fuelTags: ['oil'], fuelStart: 6, value: 5, desc: '更亮更持久的随身灯（150 光照），使用灯油。也可训练掌灯人。' });
tool('spear', '木矛', { tags: ['trainer'], desc: '叠在幸存者上训练矛兵。' });
tool('bow', '弓', { tags: ['trainer'], value: 4, desc: '叠在幸存者上训练弓手。' });
tool('mace', '铁锤', { tags: ['trainer'], value: 6, desc: '与盾一起训练锤卫。' });
tool('musket', '火铳', { tags: ['trainer'], value: 12, rarity: 'uncommon', desc: '让弓手升级为火铳手。' });
tool('toolbox', '工具箱', { tags: ['trainer'], value: 4, desc: '训练工匠。' });
tool('book', '书卷', { tags: ['trainer'], value: 5, desc: '训练学者。' });
tool('herb_kit', '药囊', { tags: ['trainer'], value: 3, desc: '训练医者。' });
tool('map', '地图', { tags: ['trainer', 'explore_aid'], toolMult: 1.3, value: 3, desc: '训练斥候；放在探索堆里速度 ×1.3。' });
tool('scale', '秤', { tags: ['trainer'], value: 5, desc: '训练行商。' });
tool('compass', '罗盘', { tags: ['trainer', 'explore_aid'], toolMult: 1.4, value: 6, desc: '训练水手；放在探索堆里速度 ×1.4。' });
tool('telescope', '望远镜', { tags: ['explore_aid'], toolMult: 1.5, value: 8, desc: '探索 ×1.5。' });
tool('star_chart', '星图', { tags: ['trainer'], value: 6, rarity: 'uncommon', desc: '训练贤者。' });
tool('boat', '舟', { tags: ['boat'], value: 8, desc: '出海探索必需。' });
tool('raft', '木筏', { tags: ['boat'], value: 3, rarity: 'uncommon', desc: '简陋但能漂的筏子，可以出海（较慢）。', toolMult: 0.7 });
tool('quill', '羽笔', { tags: ['research_aid'], toolMult: 1.4, value: 3, rarity: 'uncommon', desc: '放在研究堆里，研究速度 ×1.4。' });
tool('holy_flame', '圣焰', { tags: ['trainer'], light: 160, value: 20, rarity: 'epic', desc: '永不熄灭的火。训练守火者，或点燃大薪火。' });
tool('saddle_horse', '马', { tags: ['trainer', 'mount'], value: 8, desc: '驯服的马，与铁甲一起训练骑卫。' });
tool('domestic_goat', '家羊', { tags: ['livestock'], value: 4, node: null, desc: '放进畜栏会繁殖；叠上一个人可以挤奶。' });
tool('hen', '家禽', { tags: ['livestock'], value: 2, desc: '放进畜栏会下蛋。' });
CARDS.domestic_goat.kind = 'beast';
CARDS.hen.kind = 'beast';
CARDS.saddle_horse.kind = 'beast';

// ---------------------------------------------------------------- gear ----------------------------
// Drop gear on a person to equip it (one per slot). Gear is absorbed into the person.
function gear(id, name, slot, g, p = {}) {
  return add(id, 'gear', name, { value: 4, gear: { slot, ...g }, ...p, tags: ['gear', slot, ...(p.tags || [])] });
}
gear('club', '木棒', 'weapon', { atk: 1, dmg: 'blunt' }, { value: 1, desc: '装备：攻击 +1，钝击。' });
gear('bronze_sword', '青铜剑', 'weapon', { atk: 2, dmg: 'pierce' }, { value: 6, desc: '装备：攻击 +2，穿刺。' });
gear('iron_sword', '铁剑', 'weapon', { atk: 3, dmg: 'pierce' }, { value: 9, desc: '装备：攻击 +3，穿刺。' });
gear('obsidian_blade', '黑曜刃', 'weapon', { atk: 3, dmg: 'pierce', crit: 0.2 }, { value: 8, rarity: 'uncommon', desc: '装备：攻击 +3，20% 暴击。' });
gear('flame_blade', '焰刃', 'weapon', { atk: 3, dmg: 'light', light: 60 }, { value: 16, rarity: 'rare', desc: '装备：攻击 +3，光芒伤害，自带微光。' });
gear('star_blade', '星刃', 'weapon', { atk: 5, dmg: 'light', light: 80 }, { value: 30, rarity: 'epic', desc: '装备：攻击 +5，光芒伤害。' });
gear('heartwood_bow', '心木弓', 'weapon', { atk: 4, dmg: 'pierce', ranged: true }, { value: 25, rarity: 'epic', desc: '装备：攻击 +4，并使持有者成为远程。' });
gear('fang_spear', '鳄牙矛', 'weapon', { atk: 4, dmg: 'pierce', crit: 0.15 }, { value: 22, rarity: 'epic', desc: '装备：攻击 +4，15% 暴击。' });
gear('leather_armor', '皮甲', 'armor', { hp: 3 }, { value: 5, desc: '装备：生命 +3。' });
gear('bronze_armor', '青铜甲', 'armor', { hp: 5, def: 1 }, { value: 9, desc: '装备：生命 +5，护甲 +1。' });
gear('iron_armor', '铁甲', 'armor', { hp: 7, def: 2 }, { value: 12, desc: '装备：生命 +7，护甲 +2。' });
gear('fur_cloak', '毛皮斗篷', 'armor', { hp: 3, warm: true }, { value: 6, desc: '装备：生命 +3，冬夜不会受冻。' });
gear('wolf_cloak', '狼王斗篷', 'armor', { hp: 6, def: 1, warm: true }, { value: 20, rarity: 'epic', desc: '装备：生命 +6，护甲 +1，御寒。' });
gear('molten_plate', '熔核铠', 'armor', { hp: 12, def: 3, thorns: 1 }, { value: 35, rarity: 'legendary', desc: '装备：生命 +12，护甲 +3，反伤 1。' });
gear('shield', '木盾', 'trinket', { def: 1 }, { value: 4, tags: ['trainer'], desc: '装备：护甲 +1。也用于训练锤卫。' });
gear('bone_charm', '骨符', 'trinket', { def: 1, hp: 1 }, { value: 5, rarity: 'uncommon', desc: '装备：生命 +1，护甲 +1。' });
gear('dawn_amulet', '晨曦护符', 'trinket', { light: 100, hp: 2 }, { value: 18, rarity: 'rare', desc: '装备：自带 100 光照，生命 +2。' });
gear('frost_amulet', '霜心护符', 'trinket', { def: 2, hp: 4, warm: true }, { value: 30, rarity: 'epic', desc: '装备：生命 +4，护甲 +2，御寒。' });
gear('pearl_necklace', '珍珠项链', 'trinket', { hp: 2 }, { value: 22, rarity: 'rare', desc: '昂贵的饰品：卖给商人能换很多铜贝。' });

// consumables used on people
add('potion', 'tool', '疗伤药', { tags: ['tool', 'medicine'], heal: 6, value: 4, desc: '叠到人物身上：回复 6 点生命，并治愈疫病。' });
add('elixir', 'tool', '灵药', { tags: ['tool', 'medicine'], heal: 99, value: 10, rarity: 'rare', desc: '叠到人物身上：完全恢复，并永久生命 +2。' });
add('bandage', 'tool', '绷带', { tags: ['tool', 'medicine'], heal: 3, value: 2, desc: '叠到人物身上：回复 3 点生命。' });

// ---------------------------------------------------------------- nodes ---------------------------
// A node is harvested by stacking workers on it. charges -1 = inexhaustible; perennial nodes regrow
// `regen` charges every dawn (except in winter) instead of disappearing.
function node(id, name, n, p = {}) {
  const def = add(id, 'node', name, { value: 0, ...p, node: { w: 1, multi: 2, ...n }, tags: ['node', ...(p.tags || [])] });
  return def;
}
const NOWINTER = { 3: 0 };
node('berry_bush', '浆果丛', { t: 8, out: [['berry', 1]], extra: [['fiber', 0.12]], charges: 5, perennial: true, regen: 2, skill: 'forage', season: NOWINTER }, { desc: '可采集浆果。每个黎明恢复 2 次，冬天休眠。' });
node('tall_grass', '茅草丛', { t: 6, out: [['fiber', 1]], extra: [['root', 0.08]], charges: 4, perennial: true, regen: 2, skill: 'forage', season: { 3: 0.3 } }, { desc: '可采集纤维。' });
node('tree', '树', { t: 10, out: [['wood', 1]], extra: [['apple', 0.1, [0, 1, 2]], ['sapling', 0.22]], charges: 4, skill: 'wood', tool: 'axe' }, { tags: ['tree'], desc: '可砍伐木材，偶尔掉落果子和树苗。' });
node('pine', '松树', { t: 11, out: [['wood', 1]], extra: [['resin', 0.35], ['sapling', 0.15]], charges: 5, skill: 'wood', tool: 'axe' }, { tags: ['tree'], desc: '木材与树脂。' });
node('dead_tree', '枯树', { t: 8, out: [['wood', 1]], charges: 2, skill: 'wood', tool: 'axe' }, { tags: ['tree'], desc: '灰烬里站着的枯树。' });
node('old_oak', '古橡', { t: 12, out: [['wood', 1]], extra: [['sapling', 0.3], ['relic', 0.03]], charges: 10, skill: 'wood', tool: 'axe' }, { tags: ['tree'], rarity: 'uncommon', desc: '活了几百年的大树，木材丰富。' });
node('young_tree', '幼树', { t: 1, out: [], charges: 0, skill: 'wood' }, { tags: ['plant'], grows: { to: 'tree', days: 2 }, desc: '两个黎明后长成大树。' });
node('rock', '岩石', { t: 10, out: [['stone', 1]], extra: [['flint', 0.3]], charges: 5, skill: 'stone', tool: 'pick' }, { desc: '可采集石块与燧石。' });
node('river', '河流', { t: 14, out: [['raw_fish', 1]], extra: [['reed', 0.08]], charges: -1, skill: 'fish', tool: 'rod', season: { 3: 0.5 } }, { fixed: true, desc: '取之不尽的鱼。冬季结冰，捕鱼减半。' });
node('pond', '池塘', { t: 13, out: [['raw_fish', 1]], extra: [['reed', 0.25]], charges: 6, perennial: true, regen: 2, skill: 'fish', tool: 'rod', season: { 3: 0.4 } }, { desc: '可以捕鱼，鱼群每天恢复。' });
node('clay_pit', '黏土坑', { t: 10, out: [['clay', 1]], charges: 6, skill: 'stone', tool: 'pick' }, { desc: '湿润的黏土。' });
node('reed_bed', '芦苇荡', { t: 8, out: [['reed', 1]], charges: 5, perennial: true, regen: 2, skill: 'forage', season: { 3: 0.3 } }, { desc: '可采集芦苇。' });
node('wild_wheat', '野麦', { t: 10, out: [['grain', 1]], charges: 4, perennial: true, regen: 1, skill: 'farm', season: NOWINTER }, { desc: '野生的麦子。学会农耕后可以种成田地。' });
node('herb_patch', '草药丛', { t: 10, out: [['herb', 1]], charges: 4, perennial: true, regen: 1, skill: 'forage', season: NOWINTER }, { desc: '可采集草药。' });
node('mushroom_ring', '菇圈', { t: 9, out: [['mushroom', 1]], charges: 4, perennial: true, regen: 2, skill: 'forage', dark: true }, { desc: '黑暗中也能采集的蘑菇。' });
node('beehive', '蜂巢', { t: 14, out: [['honey', 1]], extra: [['wax', 0.4]], charges: 3, perennial: true, regen: 1, skill: 'forage', season: NOWINTER, sting: 0.3 }, { desc: '可采蜂蜜。采集者可能被蛰（堆里有火把则不会）。' });
node('copper_vein', '铜矿脉', { t: 14, out: [['copper_ore', 1]], charges: 8, skill: 'mine', tool: 'pick', needTool: 'pick', tech: 'mining' }, { desc: '需要镐与「采矿」才能开采。' });
node('tin_vein', '锡矿脉', { t: 14, out: [['tin_ore', 1]], charges: 6, skill: 'mine', tool: 'pick', needTool: 'pick', tech: 'mining' }, { desc: '需要镐与「采矿」才能开采。' });
node('iron_vein', '铁矿脉', { t: 16, out: [['iron_ore', 1]], charges: 10, skill: 'mine', tool: 'pick', needTool: 'pick', tech: 'mining' }, { desc: '需要镐与「采矿」才能开采。' });
node('coal_seam', '煤层', { t: 12, out: [['coal', 1]], charges: 10, skill: 'mine', tool: 'pick', needTool: 'pick', tech: 'mining' }, { desc: '需要镐与「采矿」才能开采。' });
node('salt_flat', '盐滩', { t: 10, out: [['salt', 1]], charges: 6, perennial: true, regen: 1, skill: 'forage' }, { desc: '可采集盐。' });
node('sand_bank', '沙洲', { t: 8, out: [['sand', 1]], charges: 8, perennial: true, regen: 1, skill: 'stone' }, { desc: '可采集沙。' });
node('tidepool', '潮池', { t: 10, out: [['mussel', 1]], extra: [['seaweed', 0.3], ['pearl', 0.05]], charges: 6, perennial: true, regen: 2, skill: 'fish' }, { desc: '贻贝、海藻，偶尔有珍珠。' });
node('driftwood_shore', '浮木滩', { t: 9, out: [['driftwood', 1]], charges: 6, perennial: true, regen: 1, skill: 'forage' }, { desc: '海浪会送来新的浮木。' });
node('ice_shelf', '冰架', { t: 10, out: [['ice', 1]], charges: 8, skill: 'stone', tool: 'pick' }, { desc: '可采集冰块。' });
node('sulfur_vent', '硫磺口', { t: 14, out: [['sulfur', 1]], charges: 6, skill: 'mine', tool: 'pick', fumes: 0.1 }, { desc: '可采集硫磺，偶尔会被毒气灼伤。' });
node('crystal_geode', '晶洞', { t: 18, out: [['crystal', 1]], charges: 3, skill: 'mine', tool: 'pick', needTool: 'pick', dark: true }, { rarity: 'uncommon', light: 70, desc: '会发光的晶洞，需要镐。' });
node('meteor_crater', '陨坑', { t: 20, out: [['star_metal', 1]], charges: 2, skill: 'mine', tool: 'pick', needTool: 'pick' }, { rarity: 'rare', desc: '天外来的星铁。' });
node('ember_vein', '余烬脉', { t: 18, out: [['ember_shard', 1]], charges: 4, skill: 'mine', tool: 'pick', needTool: 'pick', dark: true }, { rarity: 'rare', light: 90, desc: '地下仍在燃烧的古老火脉。' });
node('obsidian_flow', '黑曜石流', { t: 14, out: [['obsidian', 1]], charges: 5, skill: 'mine', tool: 'pick', needTool: 'pick' }, { desc: '冷却的熔岩。' });
node('ruins_rubble', '废墟堆', { t: 12, out: [['stone', 1]], extra: [['brick', 0.3], ['relic', 0.07], ['scroll', 0.06]], charges: 5, skill: 'stone', tool: 'pick' }, { desc: '翻找瓦砾，也许能找到古物。' });
node('hot_spring', '温泉', { t: 6, out: [], charges: -1, skill: 'heal', healNode: 2, dark: true }, { fixed: true, light: 60, desc: '叠上一个人：每 6 秒回复 2 点生命。' });

// ---------------------------------------------------------------- beasts ---------------------------
// Passive or neutral animals. Drag a person onto them to hunt (a small battle).
function beast(id, name, st, mob, p = {}) {
  return add(id, 'beast', name, { value: 0, dmg: 'blunt', spd: 1.8, def: 0, ...st, mob: { speed: 30, ...mob }, ...p, tags: ['beast', 'creature', ...(p.tags || [])] });
}
beast('rabbit', '野兔', { hp: 2, atk: 0 }, { beh: 'flee', loot: [['raw_meat', 1], ['hide', 1, 0.4]] }, { desc: '跑得飞快。拖一个人上去捕猎。' });
beast('fowl', '野禽', { hp: 2, atk: 0 }, { beh: 'flee', loot: [['raw_meat', 1], ['feather', 2], ['egg', 1, 0.3]] }, { desc: '可以捕猎，也能驯养成家禽。' });
beast('deer', '鹿', { hp: 5, atk: 1 }, { beh: 'flee', loot: [['raw_meat', 2], ['hide', 1], ['bone', 1, 0.5]] }, { desc: '警觉的鹿。' });
beast('goat', '野山羊', { hp: 5, atk: 1 }, { beh: 'wander', loot: [['raw_meat', 2], ['hide', 1]] }, { desc: '可以捕猎，学会驯养后可以驯服。' });
beast('horse', '野马', { hp: 7, atk: 1 }, { beh: 'flee', loot: [['raw_meat', 2], ['hide', 1]] }, { desc: '学会驯养后用绳索驯服。' });
beast('boar', '野猪', { hp: 8, atk: 2 }, { beh: 'neutral', loot: [['raw_meat', 3], ['hide', 1]] }, { desc: '被激怒会冲撞。肉很多。' });
beast('mammoth', '猛犸', { hp: 26, atk: 3, def: 1 }, { beh: 'neutral', speed: 18, loot: [['raw_meat', 6], ['fur', 2], ['ivory', 1]] }, { rarity: 'uncommon', desc: '冻原的巨兽。一次狩猎够全营吃很久。' });
beast('seal', '海豹', { hp: 5, atk: 1 }, { beh: 'wander', loot: [['raw_meat', 2], ['oil', 1], ['fur', 1, 0.6]] }, { desc: '肉、油与毛皮。' });

// ---------------------------------------------------------------- enemies --------------------------
// beh: hunter (seeks people), raider (steals), shade (avoids light, dies at dawn), boss, lair (spawns)
function enemy(id, name, st, mob, p = {}) {
  return add(id, 'enemy', name, { value: 0, dmg: 'blunt', spd: 1.6, def: 0, traits: [], ...st, mob: { speed: 40, aggro: 420, ...mob }, ...p, tags: ['enemy', 'creature', ...(p.tags || [])] });
}
enemy('wolf', '狼', { hp: 6, atk: 2, spd: 1.3, traits: ['beast'] }, { beh: 'hunter', speed: 55, nocturnal: true, loot: [['hide', 1], ['raw_meat', 1], ['bone', 1, 0.3]] }, { desc: '夜里成群出没。' });
enemy('alpha_wolf', '头狼', { hp: 30, atk: 3, spd: 1.2, traits: ['beast', 'boss'] }, { beh: 'boss', speed: 45, summon: { id: 'wolf', every: 16, max: 2 }, loot: [['wolf_pelt', 1], ['raw_meat', 3], ['relic', 1]] }, { rarity: 'epic', desc: '狼群之王。战斗中会召唤狼。' });
enemy('bear', '熊', { hp: 16, atk: 3, traits: ['beast'] }, { beh: 'neutral', speed: 30, loot: [['raw_meat', 4], ['fur', 1], ['hide', 1]] }, { desc: '别去惹它，除非你准备好了。' });
enemy('shade', '灰影', { hp: 5, atk: 1, traits: ['shade'] }, { beh: 'shade', speed: 38, loot: [['shadow_dust', 1, 0.35]] }, { tags: ['shade'], desc: '灰雾中诞生的暗影。畏光，黎明时消散。非光芒伤害减半。' });
enemy('wisp', '鬼火', { hp: 4, atk: 1, spd: 1.2, traits: ['shade', 'flying'] }, { beh: 'shade', speed: 60, loot: [['shadow_dust', 1, 0.3]] }, { tags: ['shade'], desc: '飘忽的鬼火。飞行：只有远程能命中。' });
enemy('greater_shade', '魇', { hp: 16, atk: 3, traits: ['shade'] }, { beh: 'shade', speed: 34, loot: [['shadow_dust', 2], ['ember_shard', 1, 0.15]] }, { tags: ['shade'], rarity: 'uncommon', desc: '浓雾凝成的巨大暗影。' });
enemy('thornling', '刺藤', { hp: 6, atk: 1, traits: ['armored'] }, { beh: 'hunter', speed: 25, loot: [['wood', 1]] }, { desc: '会走路的荆棘。有甲：穿刺伤害减半。' });
enemy('rotroot', '腐根兽', { hp: 60, atk: 4, def: 1, spd: 1.8, traits: ['armored', 'boss', 'regen'] }, { beh: 'boss', speed: 14, summon: { id: 'thornling', every: 12, max: 3 }, regen: 1, loot: [['heartwood', 1], ['wood', 4], ['relic', 1]] }, { rarity: 'epic', desc: '古树腐烂的心。甲壳坚硬（钝击克制），会再生。' });
enemy('leech', '水蛭', { hp: 2, atk: 1, spd: 1.1, traits: ['swarm'] }, { beh: 'hunter', speed: 30, loot: [] }, { desc: '成群而来的吸血虫。' });
enemy('croc', '沼鳄', { hp: 13, atk: 3, traits: ['armored', 'beast'] }, { beh: 'hunter', speed: 30, loot: [['hide', 2], ['raw_meat', 2]] }, { desc: '沼泽里的伏击者。有甲。' });
enemy('croc_king', '鳄王', { hp: 80, atk: 5, def: 1, traits: ['armored', 'beast', 'boss'] }, { beh: 'boss', speed: 18, summon: { id: 'leech', every: 9, max: 5 }, loot: [['croc_tooth', 1], ['hide', 3], ['relic', 1]] }, { rarity: 'epic', desc: '沼泽之主，召唤水蛭群。' });
enemy('bandit', '盗匪', { hp: 8, atk: 2, dmg: 'pierce' }, { beh: 'raider', speed: 45, loot: [['coin', 2], ['leather', 1, 0.3]] }, { desc: '会偷走铜贝与食物。' });
enemy('bandit_archer', '匪弓手', { hp: 6, atk: 2, dmg: 'pierce', ranged: true }, { beh: 'hunter', speed: 42, loot: [['coin', 2], ['bow', 1, 0.2]] }, { desc: '远程的盗匪。' });
enemy('bandit_chief', '匪首', { hp: 48, atk: 4, def: 1, dmg: 'pierce', traits: ['boss'] }, { beh: 'boss', speed: 30, summon: { id: 'bandit', every: 15, max: 3 }, loot: [['coin', 15], ['iron_sword', 1], ['relic', 1]] }, { rarity: 'epic', desc: '盗匪的首领。' });
enemy('cave_crawler', '穴爬虫', { hp: 7, atk: 2, traits: ['armored'] }, { beh: 'hunter', speed: 35, loot: [['bone', 1], ['crystal', 1, 0.1]] }, { desc: '洞穴深处的甲虫。' });
enemy('slag_golem', '熔渣巨人', { hp: 110, atk: 5, def: 2, spd: 2.0, traits: ['armored', 'boss', 'burning'] }, { beh: 'boss', speed: 12, summon: { id: 'cave_crawler', every: 16, max: 2 }, loot: [['molten_core', 1], ['iron', 4], ['coal', 4]] }, { rarity: 'epic', light: 140, desc: '熔炉里醒来的巨人。灼烧：每次被近战命中都会反烧攻击者。' });
enemy('frost_wolf', '霜狼', { hp: 10, atk: 3, spd: 1.3, traits: ['beast'] }, { beh: 'hunter', speed: 55, nocturnal: true, loot: [['fur', 1], ['raw_meat', 1]] }, { desc: '冻原的狼，比河谷的狼更凶。' });
enemy('frost_wraith', '冰魇', { hp: 95, atk: 5, spd: 1.6, traits: ['shade', 'flying', 'boss'] }, { beh: 'boss', speed: 22, summon: { id: 'wisp', every: 10, max: 4 }, loot: [['frost_heart', 1], ['shadow_dust', 3]] }, { tags: ['shade'], rarity: 'epic', desc: '极夜的化身。飞行、暗影：需要远程与光。' });
enemy('harpy', '海妖鸟', { hp: 7, atk: 2, spd: 1.3, traits: ['flying'] }, { beh: 'hunter', speed: 60, loot: [['feather', 2]] }, { desc: '飞行：只有远程能命中。' });
enemy('sea_serpent', '海蛇', { hp: 18, atk: 4, traits: ['beast'] }, { beh: 'hunter', speed: 40, loot: [['raw_meat', 3], ['hide', 1], ['pearl', 1, 0.2]] }, { desc: '从海里爬上岸的长蛇。' });
enemy('tentacle', '触手', { hp: 14, atk: 3, traits: ['armored'] }, { beh: 'hunter', speed: 20, loot: [['raw_meat', 1]] }, { desc: '深渊海妖的触手。' });
enemy('kraken', '深渊海妖', { hp: 150, atk: 6, def: 1, spd: 1.8, traits: ['armored', 'boss'] }, { beh: 'boss', speed: 10, summon: { id: 'tentacle', every: 11, max: 4 }, loot: [['abyss_pearl', 1], ['pearl', 3], ['oil', 4]] }, { rarity: 'legendary', desc: '雾海深处的巨物。不断伸出触手。' });
enemy('ash_hound', '灰犬', { hp: 11, atk: 3, spd: 1.2, traits: ['shade', 'beast'] }, { beh: 'shade', speed: 58, loot: [['shadow_dust', 1, 0.5]] }, { tags: ['shade'], desc: '灰烬里奔跑的猎犬。' });
enemy('ash_knight', '灰烬骑士', { hp: 26, atk: 4, def: 2, traits: ['shade', 'armored'] }, { beh: 'shade', speed: 32, loot: [['shadow_dust', 2], ['iron', 1, 0.5], ['ember_shard', 1, 0.2]] }, { tags: ['shade'], rarity: 'uncommon', desc: '盔甲里只有灰。' });
enemy('ash_king', '灰烬之王', { hp: 260, atk: 7, def: 2, spd: 1.7, traits: ['shade', 'boss', 'armored'] }, { beh: 'boss', speed: 8, summon: { id: 'ash_knight', every: 18, max: 3 }, darkPulse: 30, loot: [['ember_shard', 6], ['star_metal', 2]] }, { tags: ['shade'], rarity: 'legendary', desc: '灰雾的源头。会周期性地熄灭附近的火焰。' });

// lairs: stationary spawners; destroy them by attacking
function lair(id, name, st, spawn, p = {}) {
  return add(id, 'lair', name, { value: 0, dmg: 'blunt', atk: 0, spd: 2, def: 1, traits: ['structure'], ...st, mob: { beh: 'lair', speed: 0, spawn, loot: p.loot || [] }, fixed: true, ...p, tags: ['enemy', 'lair', ...(p.tags || [])] });
}
lair('wolf_den', '狼窝', { hp: 24 }, { id: 'wolf', every: 1, max: 3, night: true }, { loot: [['hide', 3], ['bone', 2]], desc: '每晚放出狼群。摧毁它！' });
lair('bandit_camp', '匪寨', { hp: 45, def: 2, atk: 2 }, { id: 'bandit', every: 2, max: 3, alt: 'bandit_archer' }, { loot: [['coin', 12], ['iron', 2], ['leather', 2]], desc: '每两天派出盗匪。' });
lair('shade_rift', '影隙', { hp: 30, traits: ['structure', 'shade'] }, { id: 'shade', every: 1, max: 4, night: true }, { fog: 2, loot: [['ember_shard', 1], ['shadow_dust', 2]], tags: ['shade'], desc: '灰雾的裂口：每晚涌出暗影，并使灰雾每天 +2。' });
lair('serpent_nest', '蛇巢', { hp: 30 }, { id: 'sea_serpent', every: 3, max: 2 }, { loot: [['pearl', 2]], desc: '海蛇的巢穴。' });

// ---------------------------------------------------------------- structures ----------------------
function struct(id, name, p = {}) {
  return add(id, 'structure', name, { value: 0, ...p, tags: ['structure', ...(p.tags || [])] });
}
const FUEL = ['fuel'];
struct('campfire', '篝火', { light: 260, fuelMax: 6, fuelStart: 3, fuelTags: FUEL, burn: 1, tags: ['fire', 'cook'], desc: '光与热的中心：260 光照，可以烤食物。每天消耗 1 份燃料（冬天 2 份），把木材叠上去添柴。' });
struct('hearth', '火塘', { light: 330, fuelMax: 10, fuelStart: 4, fuelTags: FUEL, burn: 1, warmth: true, tags: ['fire', 'cook'], rarity: 'uncommon', desc: '石砌的火塘：330 光照，冬天不额外耗柴，附近的人不会受冻。' });
struct('torch_post', '火把桩', { light: 170, fuelMax: 3, fuelStart: 2, fuelTags: FUEL, burn: 1, desc: '便宜的照明：170 光照。' });
struct('lamp_post', '灯柱', { light: 230, fuelMax: 8, fuelStart: 4, fuelTags: ['oil'], burn: 1, desc: '灯油点亮的灯柱：230 光照。' });
struct('watchtower', '瞭望塔', { light: 290, fuelMax: 6, fuelStart: 3, fuelTags: FUEL, burn: 1, tower: { atk: 2, range: 300, spd: 1.8 }, desc: '290 光照，塔上的弓手会射击范围内的敌人。' });
struct('lighthouse', '灯塔', { light: 520, fuelMax: 10, fuelStart: 5, fuelTags: ['oil'], burn: 1, fog: -3, rarity: 'rare', desc: '520 光照，点亮时灰雾每天 -3。' });
struct('beacon', '烽燧', { light: 420, fuelMax: 10, fuelStart: 5, fuelTags: ['smeltfuel'], burn: 1, fog: -5, rarity: 'rare', desc: '420 光照，点亮时灰雾每天 -5。烧煤或木炭。' });
struct('aether_lamp', '以太灯', { light: 300, rarity: 'rare', desc: '无需燃料的晶石灯：300 光照。' });
struct('eternal_lamp', '长明灯', { light: 240, rarity: 'epic', fog: -1, desc: '余烬晶点燃的长明灯：240 光照，不需燃料，灰雾每天 -1。' });
struct('moon_lantern', '月光灯', { light: 200, burnShade: 2, rarity: 'rare', desc: '影尘与琉璃做的怪灯：200 光照，对其中的暗影造成双倍灼烧。' });
struct('cairn', '石冢', { light: 60, fog: -1, desc: '堆起的石头纪念着逝者。灰雾每天 -1。' });
struct('shrine', '灯龛', { light: 110, fog: -2, desc: '供奉着火种的灯龛：灰雾每天 -2。' });
struct('memorial', '纪念碑', { light: 80, fog: -2, rarity: 'uncommon', desc: '刻满名字的石碑。灰雾每天 -2。' });
struct('lean_to', '窝棚', { housing: 2, tags: ['house'], desc: '可住 2 人。两个成年人叠在房屋上会生下孩子。' });
struct('cabin', '木屋', { housing: 4, tags: ['house'], desc: '可住 4 人。' });
struct('stone_house', '石屋', { housing: 6, tags: ['house'], desc: '可住 6 人。' });
struct('snow_hut', '雪屋', { housing: 3, warmth: true, tags: ['house'], rarity: 'uncommon', desc: '冰块砌成的屋子，可住 3 人，且御寒。' });
struct('stone_tablet', '刻石', { tags: ['research'], desc: '叠上一个人，记录见闻、产生灵感。' });
struct('study', '书斋', { tags: ['research'], desc: '叠上一个人产出灵感，比刻石快得多。' });
struct('library', '藏书阁', { tags: ['research'], rarity: 'uncommon', desc: '叠上一个人，一次产出两份灵感。' });
struct('observatory', '观星台', { tags: ['research'], rarity: 'rare', desc: '夜里叠上学者：产出灵感与星图。' });
struct('drying_rack', '晾架', { desc: '把生肉或生鱼放上去风干，做成不坏的食物。' });
struct('workbench', '工作台', { desc: '精细木工与工具制作的台子。' });
struct('kiln', '陶窑', { tags: ['kiln'], desc: '烧制陶器、砖与木炭。' });
struct('loom', '织机', { desc: '把纤维织成布。' });
struct('tannery', '鞣皮架', { desc: '把兽皮鞣成皮革。' });
struct('smelter', '熔炉', { desc: '把矿石熔成金属锭。' });
struct('forge', '锻炉', { desc: '锻造武器、护甲与金属工具。' });
struct('mill', '磨坊', { desc: '把谷物磨成面粉。' });
struct('bakery', '烘炉', { desc: '把面粉烤成面包。' });
struct('smokehouse', '熏房', { desc: '用盐腌制鱼肉。' });
struct('oil_press', '油坊', { desc: '从鱼和树脂里榨出灯油。' });
struct('glassworks', '琉璃坊', { desc: '把沙子烧成琉璃。' });
struct('alchemy_lab', '炼丹房', { desc: '调配火药与灵药。' });
struct('clock_workshop', '机关坊', { desc: '制造齿轮与机关。' });
struct('dock', '船坞', { desc: '建造舟船。' });
struct('field', '田地', { node: { t: 28, out: [['grain', 2]], charges: -1, skill: 'farm', tool: 'hoe', season: { 0: 1, 1: 1.2, 2: 1.4, 3: 0 }, w: 1, multi: 1 }, tags: ['farm'], desc: '种植谷物：每次收获 2 份。秋天最快，冬天休耕。' });
struct('orchard', '果园', { node: { t: 24, out: [['apple', 2]], charges: -1, skill: 'farm', season: { 0: 0.8, 1: 1, 2: 1.4, 3: 0 }, w: 1, multi: 1 }, tags: ['farm'], rarity: 'uncommon', desc: '每次收获 2 个野果，冬天休眠。' });
struct('herb_garden', '药圃', { node: { t: 16, out: [['herb', 1]], charges: -1, skill: 'forage', season: { 3: 0.3 }, w: 1, multi: 1 }, tags: ['farm'], desc: '源源不断的草药。' });
struct('pen', '畜栏', { desc: '放入两只家羊会繁殖；放入家禽会下蛋。' });
struct('granary', '谷仓', { store: { cap: 40 }, desc: '把食物叠上去存进仓里：存储的食物永不腐坏，黎明时自动取用。最多 40 份饱腹。' });
struct('market', '集市', { market: true, tags: ['market'], desc: '把货物叠上去换成铜贝；点击它购买补给。' });
struct('palisade', '木栅', { hp: 30, def: 1, guard: 170, taunt: true, desc: '拦截靠近的敌人（170 范围），敌人必须先打穿它。' });
struct('stone_wall', '石墙', { hp: 70, def: 3, guard: 190, taunt: true, desc: '坚固的拦截工事（190 范围）。' });
struct('infirmary', '医馆', { aura: { heal: 1, every: 4 }, desc: '叠上的病人每 4 秒回复 1 点生命，并治愈疫病。' });
struct('well', '水井', { desc: '干旱时让田地照常生长；防止疫病。' });
struct('dike', '堤坝', { desc: '抵御洪水：洪水不会冲走它附近（350 范围）的卡牌。', guardFlood: 350 });
struct('festival_ground', '庆典台', { desc: '把盛宴或蜜酒叠上去举行庆典，驱散灰雾。' });
struct('steam_engine', '蒸汽机', { fuelMax: 8, fuelStart: 3, fuelTags: ['smeltfuel'], burn: 1, aura: { speed: 1.5, radius: 320 }, light: 120, rarity: 'rare', desc: '烧煤运转：320 范围内的建筑生产速度 ×1.5。' });
struct('barracks', '兵营', { housing: 3, tags: ['house'], aura: { heal: 1, every: 6 }, desc: '可住 3 人；叠上的士兵每 6 秒回复 1 点生命。' });
struct('trading_post', '商栈', { desc: '商队会更频繁地来访。' });
struct('quest_altar', '古祭坛', { fixed: true, deliver: true, rarity: 'rare', desc: '把任务需要的物品叠上来献祭。' });
add('great_flame_site', 'wonder', '大薪火基座', { tags: ['structure', 'wonder'], fixed: true, stages: true, rarity: 'legendary', light: 120, desc: '分阶段献上材料，重新点燃照亮世界的大薪火。' });
add('great_flame', 'wonder', '大薪火', { tags: ['structure', 'wonder', 'fire'], fixed: true, light: 900, fog: -12, rarity: 'legendary', desc: '重燃的大薪火：900 光照，灰雾每天 -12。' });

// ---------------------------------------------------------------- knowledge / coin / bundles -------
add('insight', 'knowledge', '灵感', { tags: ['insight'], desc: '研究科技需要消耗灵感。' });
add('scroll', 'knowledge', '残卷', { tags: ['openable'], value: 2, open: { type: 'scroll' }, desc: '点击阅读：获得 1 份灵感，并得到一条隐藏配方的线索。' });
add('tome', 'knowledge', '典籍', { tags: ['openable'], value: 5, rarity: 'uncommon', open: { type: 'tome', insight: 3 }, desc: '点击阅读：获得 3 份灵感。' });
add('relic', 'knowledge', '古物', { tags: ['valuable'], value: 6, rarity: 'uncommon', desc: '失落时代的器物。卖钱，或放进书斋研究。' });
add('coin', 'coin', '铜贝', { tags: ['coin'], value: 1, desc: '通用货币。' });
add('gold', 'coin', '金锭', { tags: ['coin', 'valuable'], value: 10, rarity: 'uncommon', desc: '价值 10 铜贝。' });

function bundle(id, name, loot, n, p = {}) {
  return add(id, 'bundle', name, { tags: ['openable'], value: 0, open: { type: 'bundle', loot, n }, ...p });
}
bundle('supply_basic', '补给包', [['wood', 3], ['stone', 3], ['fiber', 2], ['berry', 2], ['flint', 1], ['tree', 1], ['rock', 1], ['berry_bush', 1]], 3, { desc: '点击打开：3 张基础资源。' });
bundle('food_crate', '粮箱', [['bread', 2], ['jerky', 3], ['salted_fish', 2], ['cheese', 1], ['grain', 3], ['apple', 2]], 4, { desc: '点击打开：4 份耐放的食物。' });
bundle('crafter_bundle', '匠人包', [['plank', 3], ['rope', 3], ['brick', 2], ['cloth', 1], ['leather', 1], ['copper', 1], ['clay', 2]], 3, { desc: '点击打开：3 份加工材料。' });
bundle('explorer_bundle', '远行包', [['torch', 2], ['map', 1], ['rope', 2], ['jerky', 2], ['bandage', 2], ['scroll', 1]], 3, { desc: '点击打开：3 件远行物资。' });
bundle('military_crate', '军械箱', [['spear', 2], ['bow', 2], ['leather_armor', 2], ['shield', 2], ['bronze_sword', 1], ['club', 2]], 2, { desc: '点击打开：2 件武备。' });
bundle('treasure_chest', '宝箱', [['coin', 4], ['gold', 1], ['relic', 2], ['pearl', 1], ['crystal', 1], ['tome', 1], ['ember_shard', 0.5]], 3, { rarity: 'rare', desc: '点击打开：3 件宝物。' });
bundle('seed_pouch', '种子袋', [['sapling', 3], ['grain', 3], ['herb', 2], ['berry', 2]], 3, { desc: '点击打开：种子与幼苗。' });

// ---------------------------------------------------------------- events & regions -----------------
function eventCard(id, name, p) { return add(id, 'event', name, { tags: ['event', 'openable'], open: { type: 'event' }, fixed: false, ...p }); }
eventCard('wanderer', '流浪者', { desc: '灰雾中走来的陌生人。点击决定是否接纳。' });
eventCard('caravan', '商队', { open: { type: 'trade' }, desc: '远方的商队，停留两天。点击交易。' });
eventCard('omen', '异兆', { desc: '有什么事情正在发生。点击查看。' });
eventCard('refugees', '难民', { desc: '一群逃难的人。点击决定。' });

function region(id, name, r, p = {}) {
  return add(id, 'region', name, { value: 0, ...p, region: { t: 16, charges: 4, danger: 0.1, foes: [], ...r }, tags: ['region', ...(p.tags || [])] });
}
region('valley_depths', '河谷深处', { t: 15, charges: 5, loot: [['tree', 3], ['rock', 3], ['berry_bush', 2], ['tall_grass', 1.5], ['wild_wheat', 1], ['rabbit', 2], ['flint', 1.5], ['wood', 2], ['survivor', 0.7], ['scroll', 0.5], ['pond', 0.6], ['herb_patch', 0.6], ['root', 1]], danger: 0.06, foes: [['wolf', 1]] }, { desc: '河谷的上游。' });
region('deep_forest', '幽林', { t: 17, charges: 5, loot: [['tree', 3], ['pine', 1.5], ['herb_patch', 2], ['mushroom_ring', 1.5], ['beehive', 1], ['deer', 2], ['boar', 1.2], ['fowl', 1.5], ['resin', 1], ['apple', 1.5], ['root', 1.2], ['survivor', 0.5], ['scroll', 0.6], ['old_oak', 0.4]], danger: 0.14, foes: [['wolf', 2], ['boar', 1], ['bear', 0.4]] }, { desc: '古老的森林，雾气终年不散。' });
region('old_ruins', '古代遗迹', { t: 20, charges: 4, loot: [['ruins_rubble', 2], ['relic', 2], ['scroll', 2.5], ['tome', 0.6], ['coin', 2], ['stone', 1.5], ['brick', 1], ['ember_shard', 0.3], ['insight', 1.5], ['treasure_chest', 0.15]], danger: 0.2, foes: [['shade', 2], ['wisp', 0.5]] }, { desc: '前代文明的残垣。' });
region('marsh_depths', '盐沼深处', { t: 17, charges: 5, loot: [['reed_bed', 2], ['clay_pit', 2], ['salt_flat', 1.6], ['pond', 1.5], ['herb_patch', 1], ['fowl', 2], ['clay', 1.5], ['reed', 1.5], ['survivor', 0.4], ['scroll', 0.4]], danger: 0.15, foes: [['leech', 2], ['croc', 0.5]] }, { desc: '泥泞与盐霜交错的沼地。' });
region('cave', '幽洞', { t: 19, charges: 5, need: 'light', loot: [['rock', 3], ['copper_vein', 1.5], ['tin_vein', 1.2], ['coal_seam', 1.5], ['crystal_geode', 0.4], ['bone', 1.5], ['mushroom_ring', 1.5], ['relic', 0.5], ['clay_pit', 0.8]], danger: 0.18, foes: [['cave_crawler', 2], ['bear', 0.4]] }, { desc: '漆黑的洞穴。需要光源（火把、灯笼或掌灯人）才能探索。' });
region('abandoned_mine', '废弃矿井', { t: 21, charges: 5, need: 'light', loot: [['iron_vein', 2], ['coal_seam', 2], ['copper_vein', 1], ['iron_ore', 2], ['coal', 2], ['relic', 0.8], ['survivor', 0.35], ['stone_pick', 0.6]], danger: 0.2, foes: [['cave_crawler', 2], ['shade', 1]] }, { desc: '被遗弃的矿井。需要光源。' });
region('mountain_pass', '山口', { t: 18, charges: 4, loot: [['rock', 2], ['iron_vein', 1], ['goat', 2], ['horse', 1], ['pine', 2], ['flint', 2], ['survivor', 0.45], ['copper_vein', 0.8], ['coal_seam', 0.6]], danger: 0.14, foes: [['wolf', 1.5], ['bandit', 1]] }, { desc: '通往群山的隘口。' });
region('frozen_waste', '冻原', { t: 20, charges: 5, loot: [['pine', 2], ['ice_shelf', 2], ['mammoth', 1], ['fur', 1], ['ivory', 0.3], ['meteor_crater', 0.25], ['survivor', 0.35], ['seal', 1], ['rock', 1]], danger: 0.18, foes: [['frost_wolf', 2]] }, { desc: '一望无际的冰原。' });
region('ice_cave', '冰窟', { t: 22, charges: 4, need: 'light', loot: [['crystal_geode', 1.5], ['ice_shelf', 2], ['relic', 1], ['ember_shard', 0.5], ['fur', 1], ['scroll', 0.8]], danger: 0.22, foes: [['frost_wolf', 1], ['wisp', 1.5]] }, { desc: '幽蓝的冰洞。需要光源。' });
region('coast', '海岸', { t: 15, charges: 5, loot: [['tidepool', 2], ['driftwood_shore', 2], ['sand_bank', 2], ['seal', 1.5], ['fowl', 1], ['raw_fish', 2], ['salt_flat', 1], ['survivor', 0.4]], danger: 0.06, foes: [['harpy', 1]] }, { desc: '海风与盐。' });
region('misty_isle', '雾岛', { t: 19, charges: 5, need: 'boat', loot: [['tidepool', 2], ['driftwood_shore', 1.5], ['tree', 1], ['seal', 1.5], ['pearl', 0.8], ['relic', 1], ['survivor', 0.5], ['scroll', 1], ['sand_bank', 1]], danger: 0.18, foes: [['harpy', 2], ['sea_serpent', 0.5]] }, { desc: '雾中的小岛。需要舟或筏才能前往。' });
region('sunken_temple', '沉没神殿', { t: 24, charges: 4, need: 'boat', needLight: true, loot: [['relic', 2.5], ['tome', 1], ['pearl', 1], ['gold', 0.6], ['ember_shard', 1], ['scroll', 1], ['treasure_chest', 0.3]], danger: 0.28, foes: [['sea_serpent', 1], ['shade', 1.5]] }, { rarity: 'uncommon', desc: '半没在海里的神殿。需要舟与光源。' });
region('ash_wastes', '灰烬荒原', { t: 20, charges: 5, loot: [['dead_tree', 2], ['ember_vein', 1], ['obsidian_flow', 1.5], ['sulfur_vent', 1.5], ['relic', 1], ['shadow_dust', 1], ['survivor', 0.3], ['coal_seam', 1]], danger: 0.25, foes: [['ash_hound', 2], ['shade', 1.5], ['greater_shade', 0.4]] }, { desc: '被灰雾吞没的土地。' });
region('star_fall', '星陨之地', { t: 20, charges: 3, loot: [['meteor_crater', 2], ['crystal_geode', 1], ['star_metal', 1], ['insight', 1]], danger: 0.15, foes: [['wisp', 1]] }, { rarity: 'rare', desc: '流星坠落的地方。' });
region('bandit_trail', '匪径', { t: 16, charges: 3, loot: [['coin', 2], ['leather', 1], ['iron_sword', 0.3], ['food_crate', 0.4], ['rope', 1]], danger: 0.45, foes: [['bandit', 2], ['bandit_archer', 1]], reveal: ['bandit_camp'] }, { desc: '盗匪留下的足迹。探索到底会找到匪寨。' });
region('wolf_trail', '狼径', { t: 14, charges: 3, loot: [['bone', 2], ['hide', 1.5], ['raw_meat', 1]], danger: 0.4, foes: [['wolf', 1]], reveal: ['wolf_den'] }, { desc: '狼群的踪迹。探索到底会找到狼窝。' });
region('treasure_site', '藏宝地', { t: 16, charges: 2, loot: [['treasure_chest', 2], ['gold', 1], ['relic', 1]], danger: 0.2, foes: [['shade', 1]] }, { rarity: 'rare', desc: '藏宝图指向的地方。' });

// misc
add('grave', 'misc', '墓碑', { tags: ['grave'], desc: '逝者长眠于此。叠一个人上去安葬：灰雾 -2。' });
add('snowman', 'misc', '雪人', { tags: ['festive'], fog: -1, rarity: 'uncommon', desc: '孩子们堆的雪人。看着它，人们好像没那么怕黑了（灰雾每天 -1）。' });
add('treasure_map', 'knowledge', '藏宝图', { tags: ['openable'], value: 4, rarity: 'uncommon', open: { type: 'reveal', region: 'treasure_site' }, desc: '点击展开：出现一处藏宝地。' });

// sanity: default helpers
export function card(id) {
  const c = CARDS[id];
  if (!c) throw new Error('unknown card ' + id);
  return c;
}
export function hasTag(def, tag) { return def.tags.includes(tag); }
export const ALL_CARD_IDS = Object.keys(CARDS);
