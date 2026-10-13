// The recipe book. A recipe matches a stack when the stack holds exactly its inputs:
//   in    consumed cards           {id | '#tag': count}
//   keep  cards that stay          {id | '#tag': count}
//   w     workers required (kept)  — any '#worker' card; up to `multi` extra workers speed it up
//   aids  helper tags allowed once each (tools, torches, boats …); every worker recipe also accepts
//         one portable light so work can continue at night
//   batch extra copies of consumed inputs may wait in the stack and are processed one set at a time
// Harvest recipes (nodes) and exploration recipes (regions) are generated from the card data.

import { CARDS } from './cards.js';

export const RECIPES = Object.create(null);

function R(id, name, r) {
  if (RECIPES[id]) throw new Error('duplicate recipe ' + id);
  const out = typeof r.out === 'string' ? [[r.out, 1]] : r.out || [];
  RECIPES[id] = {
    id, name, in: r.in || {}, keep: r.keep || {}, w: r.w ?? 0, multi: r.multi ?? (r.w ? 1 : 0),
    out, t: r.t || 8, tech: r.tech || null, hidden: !!r.hidden, skill: r.skill || 'craft',
    aids: r.aids || [], batch: !!r.batch, dark: !!r.dark, night: !!r.night, cond: r.cond || null,
    fx: r.fx || 'craft', carry: r.carry || null, effect: r.effect || null, kind: r.kind || 'craft',
    hint: r.hint || null,
  };
  return RECIPES[id];
}

// ---- era 1: fire, tools, shelter ---------------------------------------------------------------
R('make_campfire', '生火', { in: { wood: 2, flint: 1 }, w: 1, out: 'campfire', t: 8, tech: 'fire', skill: 'build', fx: 'build' });
R('make_tablet', '凿刻石', { in: { stone: 3 }, w: 1, out: 'stone_tablet', t: 8, skill: 'build', fx: 'build' });
R('tablet_insight', '记录见闻', { keep: { stone_tablet: 1 }, w: 1, out: 'insight', t: 20, skill: 'research', aids: ['research_aid'], fx: 'research' });
R('night_talk', '篝火夜话', { keep: { '#cook': 1 }, w: 2, out: 'insight', t: 30, tech: 'lore', night: true, dark: true, skill: 'research', fx: 'research' });
R('make_club', '削木棒', { in: { wood: 2 }, w: 1, out: 'club', t: 6 });
R('make_stone_axe', '制石斧', { in: { wood: 1, flint: 1, fiber: 1 }, w: 1, out: 'stone_axe', t: 8, tech: 'stone_tools' });
R('make_stone_pick', '制石镐', { in: { wood: 1, stone: 2 }, w: 1, out: 'stone_pick', t: 8, tech: 'stone_tools' });
R('make_lean_to', '搭窝棚', { in: { wood: 3, fiber: 2 }, w: 1, out: 'lean_to', t: 12, tech: 'shelter', skill: 'build', fx: 'build' });
R('birth', '繁衍', { keep: { '#house': 1, '#adult': 2 }, out: 'child', t: 30, cond: 'housing', fx: 'birth', skill: 'none', dark: true });
R('plant_sapling', '种树', { in: { sapling: 1 }, w: 1, out: 'young_tree', t: 5, skill: 'wood', batch: true });
R('bury', '安葬', { in: { grave: 1 }, w: 1, out: [], t: 6, effect: { fog: -2 }, fx: 'bury', skill: 'none' });
R('make_shrine', '立灯龛', { in: { stone: 3, wood: 2 }, w: 1, out: 'shrine', t: 12, tech: 'lore', skill: 'build', fx: 'build' });
R('make_cairn', '垒石冢', { in: { grave: 1, stone: 2 }, w: 1, out: 'cairn', t: 10, tech: 'lore', skill: 'build', fx: 'build' });
R('make_torch', '扎火把', { in: { wood: 1, fiber: 1 }, w: 1, out: 'torch', t: 5, tech: 'torches' });
R('make_torch_post', '立火把桩', { in: { wood: 2, fiber: 1, stone: 1 }, w: 1, out: 'torch_post', t: 8, tech: 'torches', skill: 'build', fx: 'build' });
R('make_rod', '做钓竿', { in: { wood: 1, fiber: 2 }, w: 1, out: 'fishing_rod', t: 6, tech: 'fishing' });
R('make_spear', '削木矛', { in: { wood: 2, flint: 1, fiber: 1 }, w: 1, out: 'spear', t: 6, tech: 'hunting' });
R('make_drying_rack', '搭晾架', { in: { wood: 3, fiber: 1 }, w: 1, out: 'drying_rack', t: 10, tech: 'cooking', skill: 'build', fx: 'build' });

// cooking on any fire (no worker needed; the fire is its own light)
const COOK = { keep: { '#cook': 1 }, tech: 'cooking', dark: true, batch: true, skill: 'cook', fx: 'cook' };
R('cook_fish', '烤鱼', { ...COOK, in: { raw_fish: 1 }, out: 'cooked_fish', t: 6 });
R('cook_meat', '烤肉', { ...COOK, in: { raw_meat: 1 }, out: 'roast', t: 7 });
R('cook_mushroom', '烤蘑菇', { ...COOK, in: { mushroom: 1 }, out: 'roast_mushroom', t: 5 });
R('cook_root', '烤块根', { ...COOK, in: { root: 1 }, out: 'roast_root', t: 6 });
R('cook_mussel', '烤贝', { ...COOK, in: { mussel: 1 }, out: 'cooked_mussel', t: 5 });
R('dry_meat', '风干肉', { keep: { drying_rack: 1 }, in: { raw_meat: 1 }, out: 'jerky', t: 20, tech: 'cooking', dark: true, batch: true, skill: 'cook', fx: 'cook' });

// ---- era 2: tillage ------------------------------------------------------------------------------
R('make_hoe', '做锄头', { in: { wood: 1, stone: 1, fiber: 1 }, w: 1, out: 'hoe', t: 6, tech: 'farming' });
R('make_field', '开垦田地', { in: { grain: 2, wood: 2 }, w: 1, out: 'field', t: 12, tech: 'farming', skill: 'farm', fx: 'build' });
R('fertilize', '施肥', { keep: { field: 1 }, in: { rot: 1 }, out: 'grain', t: 4, batch: true, skill: 'farm', dark: true });
R('make_kiln', '砌陶窑', { in: { stone: 4, clay: 2 }, w: 1, out: 'kiln', t: 14, tech: 'pottery', skill: 'build', fx: 'build' });
R('fire_pot', '烧陶罐', { keep: { kiln: 1 }, in: { clay: 2, '#fuel': 1 }, w: 1, out: 'pot', t: 10, tech: 'pottery' });
R('make_charcoal', '烧木炭', { keep: { kiln: 1 }, in: { wood: 3 }, w: 1, out: [['charcoal', 2]], t: 12, tech: 'pottery', batch: true });
R('make_rope', '搓绳', { in: { fiber: 2 }, w: 1, out: 'rope', t: 6, tech: 'weaving', batch: true });
R('make_loom', '造织机', { in: { wood: 3, rope: 1 }, w: 1, out: 'loom', t: 10, tech: 'weaving', skill: 'build', fx: 'build' });
R('weave_cloth', '织布', { keep: { loom: 1 }, in: { fiber: 3 }, w: 1, out: 'cloth', t: 12, tech: 'weaving', batch: true });
R('make_herb_kit', '配药囊', { in: { herb: 2, fiber: 1 }, w: 1, out: 'herb_kit', t: 6, tech: 'herbalism' });
R('make_bandage', '做绷带', { in: { fiber: 2, herb: 1 }, w: 1, out: [['bandage', 2]], t: 6, tech: 'herbalism' });
R('brew_potion', '熬疗伤药', { keep: { pot: 1 }, in: { herb: 2 }, w: 1, out: 'potion', t: 12, tech: 'herbalism', batch: true, skill: 'heal' });
R('make_herb_garden', '辟药圃', { in: { herb: 2, wood: 2 }, w: 1, out: 'herb_garden', t: 10, tech: 'herbalism', skill: 'farm', fx: 'build' });
R('make_workbench', '造工作台', { in: { wood: 4, stone: 2 }, w: 1, out: 'workbench', t: 10, tech: 'carpentry', skill: 'build', fx: 'build' });
R('saw_plank', '刨木板', { keep: { workbench: 1 }, in: { wood: 2 }, w: 1, out: [['plank', 2]], t: 8, tech: 'carpentry', batch: true });
R('make_cabin', '建木屋', { in: { plank: 4, stone: 2 }, w: 1, out: 'cabin', t: 18, tech: 'carpentry', skill: 'build', fx: 'build' });
R('make_toolbox', '做工具箱', { keep: { workbench: 1 }, in: { plank: 1, flint: 1, rope: 1 }, w: 1, out: 'toolbox', t: 8, tech: 'carpentry' });
R('make_palisade', '立木栅', { in: { wood: 4, rope: 1 }, w: 1, out: 'palisade', t: 12, tech: 'carpentry', skill: 'build', fx: 'build' });
R('make_shield', '做木盾', { keep: { workbench: 1 }, in: { plank: 2, hide: 1 }, w: 1, out: 'shield', t: 8, tech: 'carpentry' });
R('make_pen', '围畜栏', { in: { wood: 4, rope: 2 }, w: 1, out: 'pen', t: 12, tech: 'husbandry', skill: 'build', fx: 'build' });
R('tame_goat', '驯服山羊', { in: { goat: 1, grain: 1 }, w: 1, out: 'domestic_goat', t: 10, tech: 'husbandry', skill: 'farm' });
R('tame_fowl', '驯养野禽', { in: { fowl: 1, grain: 1 }, w: 1, out: 'hen', t: 8, tech: 'husbandry', skill: 'farm' });
R('tame_horse', '驯马', { in: { horse: 1, rope: 1 }, w: 1, out: 'saddle_horse', t: 14, tech: 'husbandry', skill: 'farm' });
R('breed_goat', '羊群繁殖', { keep: { pen: 1, domestic_goat: 2 }, out: 'domestic_goat', t: 45, skill: 'none', dark: true });
R('milk_goat', '挤奶', { keep: { domestic_goat: 1 }, w: 1, out: 'milk', t: 12, skill: 'farm' });
R('hen_eggs', '拾蛋', { keep: { pen: 1, hen: 1 }, out: 'egg', t: 24, skill: 'none', dark: true });
R('make_cheese', '做奶酪', { keep: { pot: 1 }, in: { milk: 2, salt: 1 }, w: 1, out: 'cheese', t: 16, tech: 'husbandry', skill: 'cook' });
R('make_tannery', '搭鞣皮架', { in: { wood: 2, hide: 1 }, w: 1, out: 'tannery', t: 10, tech: 'husbandry', skill: 'build', fx: 'build' });
R('tan_leather', '鞣皮', { keep: { tannery: 1 }, in: { hide: 1 }, w: 1, out: 'leather', t: 12, tech: 'husbandry', batch: true });
R('make_leather_armor', '缝皮甲', { in: { leather: 2, fiber: 1 }, w: 1, out: 'leather_armor', t: 10, tech: 'husbandry' });
R('make_fur_cloak', '缝毛皮斗篷', { in: { fur: 2, fiber: 1 }, w: 1, out: 'fur_cloak', t: 10, tech: 'husbandry' });
R('make_bow', '制弓', { in: { wood: 2, rope: 1 }, w: 1, out: 'bow', t: 8, tech: 'archery' });
R('make_granary', '建谷仓', { in: { plank: 3, clay: 2, stone: 2 }, w: 1, out: 'granary', t: 16, tech: 'storage', skill: 'build', fx: 'build' });
R('make_stew', '炖菜', { keep: { pot: 1, '#cook': 1 }, in: { raw_meat: 1, root: 1 }, out: 'stew', t: 10, tech: 'pottery', dark: true, skill: 'cook', fx: 'cook' });

// ---- era 3: bronze ------------------------------------------------------------------------------
R('fire_brick', '烧砖', { keep: { kiln: 1 }, in: { clay: 3, '#fuel': 1 }, w: 1, out: [['brick', 3]], t: 14, tech: 'masonry', batch: true });
R('make_stone_house', '建石屋', { in: { brick: 4, plank: 2 }, w: 1, out: 'stone_house', t: 20, tech: 'masonry', skill: 'build', fx: 'build' });
R('make_stone_wall', '砌石墙', { in: { stone: 4, brick: 2 }, w: 1, out: 'stone_wall', t: 16, tech: 'masonry', skill: 'build', fx: 'build' });
R('make_dike', '筑堤坝', { in: { stone: 3, clay: 3, wood: 2 }, w: 1, out: 'dike', t: 16, tech: 'masonry', skill: 'build', fx: 'build' });
R('make_well', '打水井', { in: { stone: 4, rope: 1 }, w: 1, out: 'well', t: 14, tech: 'masonry', skill: 'build', fx: 'build' });
R('upgrade_hearth', '砌火塘', { in: { campfire: 1, stone: 4, brick: 1 }, w: 1, out: 'hearth', t: 14, tech: 'masonry', carry: 'campfire', skill: 'build', fx: 'upgrade' });
R('make_smelter', '筑熔炉', { in: { stone: 4, brick: 2, clay: 1 }, w: 1, out: 'smelter', t: 16, tech: 'smelting', skill: 'build', fx: 'build' });
R('smelt_copper', '炼铜', { keep: { smelter: 1 }, in: { copper_ore: 2, '#smeltfuel': 1 }, w: 1, out: [['copper', 2]], t: 14, tech: 'smelting', batch: true, skill: 'smith' });
R('smelt_bronze', '炼青铜', { keep: { smelter: 1 }, in: { copper: 1, tin_ore: 1, '#smeltfuel': 1 }, w: 1, out: [['bronze', 2]], t: 14, tech: 'bronze', batch: true, skill: 'smith' });
R('make_forge', '筑锻炉', { in: { stone: 3, copper: 2, brick: 2 }, w: 1, out: 'forge', t: 16, tech: 'bronze', skill: 'build', fx: 'build' });
const FORGE = { keep: { forge: 1 }, w: 1, skill: 'smith', fx: 'forge' };
R('forge_bronze_axe', '锻青铜斧', { ...FORGE, in: { bronze: 1, wood: 1 }, out: 'bronze_axe', t: 12, tech: 'bronze' });
R('forge_bronze_pick', '锻青铜镐', { ...FORGE, in: { bronze: 1, plank: 1 }, out: 'bronze_pick', t: 12, tech: 'bronze' });
R('forge_bronze_sword', '锻青铜剑', { ...FORGE, in: { bronze: 2 }, out: 'bronze_sword', t: 12, tech: 'bronze' });
R('forge_bronze_armor', '锻青铜甲', { ...FORGE, in: { bronze: 3, leather: 1 }, out: 'bronze_armor', t: 16, tech: 'bronze' });
R('forge_mace', '锻铁锤', { ...FORGE, in: { bronze: 1, stone: 1, wood: 1 }, out: 'mace', t: 12, tech: 'tactics' });
R('make_market', '开集市', { in: { plank: 3, cloth: 2 }, w: 1, out: 'market', t: 14, tech: 'trade', skill: 'build', fx: 'build' });
R('make_scale', '做秤', { in: { copper: 1, plank: 1 }, w: 1, out: 'scale', t: 8, tech: 'trade' });
R('make_trading_post', '建商栈', { in: { plank: 4, cloth: 2, rope: 2 }, w: 1, out: 'trading_post', t: 18, tech: 'trade', skill: 'build', fx: 'build' });
R('make_paper', '造纸', { in: { reed: 2 }, w: 1, out: 'paper', t: 8, tech: 'writing', batch: true });
R('bind_book', '装订书卷', { in: { paper: 3, leather: 1 }, w: 1, out: 'book', t: 12, tech: 'writing' });
R('make_study', '建书斋', { in: { plank: 3, paper: 2 }, w: 1, out: 'study', t: 14, tech: 'writing', skill: 'build', fx: 'build' });
R('study_insight', '苦读', { keep: { study: 1 }, w: 1, out: 'insight', t: 11, skill: 'research', aids: ['research_aid'], fx: 'research' });
R('study_relic', '考据古物', { keep: { study: 1 }, in: { relic: 1 }, w: 1, out: [['insight', 3]], t: 20, tech: 'writing', skill: 'research', fx: 'research' });
R('draw_map', '绘地图', { in: { paper: 1, charcoal: 1 }, w: 1, out: 'map', t: 8, tech: 'writing' });
R('make_mill', '建磨坊', { in: { plank: 3, stone: 4 }, w: 1, out: 'mill', t: 16, tech: 'milling', skill: 'build', fx: 'build' });
R('grind_flour', '磨面', { keep: { mill: 1 }, in: { grain: 2 }, w: 1, out: [['flour', 2]], t: 10, tech: 'milling', batch: true, skill: 'farm' });
R('make_bakery', '砌烘炉', { in: { brick: 3, stone: 2 }, w: 1, out: 'bakery', t: 14, tech: 'milling', skill: 'build', fx: 'build' });
R('bake_bread', '烤面包', { keep: { bakery: 1 }, in: { flour: 2, '#fuel': 1 }, w: 1, out: [['bread', 2]], t: 14, tech: 'milling', batch: true, skill: 'cook', fx: 'cook' });
R('salt_fish', '腌鱼', { in: { raw_fish: 2, salt: 1 }, w: 1, out: [['salted_fish', 2]], t: 10, tech: 'curing', batch: true, skill: 'cook' });
R('salt_meat', '腌肉', { in: { raw_meat: 2, salt: 1 }, w: 1, out: [['jerky', 2]], t: 10, tech: 'curing', batch: true, skill: 'cook' });
R('make_smokehouse', '建熏房', { in: { brick: 2, wood: 3 }, w: 1, out: 'smokehouse', t: 14, tech: 'curing', skill: 'build', fx: 'build' });
R('smoke_fish', '熏鱼', { keep: { smokehouse: 1 }, in: { raw_fish: 1 }, out: 'salted_fish', t: 16, tech: 'curing', batch: true, dark: true, skill: 'cook', fx: 'cook' });
R('smoke_meat', '熏肉', { keep: { smokehouse: 1 }, in: { raw_meat: 1 }, out: 'jerky', t: 16, tech: 'curing', batch: true, dark: true, skill: 'cook', fx: 'cook' });

// ---- era 4: iron & lamps -------------------------------------------------------------------------
R('smelt_iron', '炼铁', { keep: { smelter: 1 }, in: { iron_ore: 2, '#smeltfuel': 2 }, w: 1, out: [['iron', 2]], t: 16, tech: 'iron', batch: true, skill: 'smith' });
R('forge_iron_axe', '锻铁斧', { ...FORGE, in: { iron: 1, wood: 1 }, out: 'iron_axe', t: 12, tech: 'iron' });
R('forge_iron_pick', '锻铁镐', { ...FORGE, in: { iron: 1, plank: 1 }, out: 'iron_pick', t: 12, tech: 'iron' });
R('forge_iron_sword', '锻铁剑', { ...FORGE, in: { iron: 2 }, out: 'iron_sword', t: 12, tech: 'iron' });
R('forge_iron_armor', '锻铁甲', { ...FORGE, in: { iron: 3, leather: 1 }, out: 'iron_armor', t: 16, tech: 'iron' });
R('make_watchtower', '建瞭望塔', { in: { plank: 4, stone: 4, rope: 1 }, w: 1, out: 'watchtower', t: 18, tech: 'fortification', skill: 'build', fx: 'build' });
R('make_barracks', '建兵营', { in: { plank: 4, stone: 4, cloth: 1 }, w: 1, out: 'barracks', t: 18, tech: 'tactics', skill: 'build', fx: 'build' });
R('make_infirmary', '开医馆', { in: { plank: 3, cloth: 2, herb: 2 }, w: 1, out: 'infirmary', t: 16, tech: 'medicine', skill: 'build', fx: 'build' });
R('make_dock', '建船坞', { in: { plank: 5, rope: 2 }, w: 1, out: 'dock', t: 16, tech: 'sailing', skill: 'build', fx: 'build' });
R('build_boat', '造舟', { keep: { dock: 1 }, in: { plank: 3, cloth: 2 }, w: 1, out: 'boat', t: 20, tech: 'sailing', skill: 'build', fx: 'build' });
R('make_net', '织渔网', { in: { rope: 3 }, w: 1, out: 'net', t: 8, tech: 'sailing' });
R('make_oil_press', '建油坊', { in: { plank: 2, stone: 3, copper: 1 }, w: 1, out: 'oil_press', t: 14, tech: 'lamplight', skill: 'build', fx: 'build' });
R('press_fish_oil', '榨鱼油', { keep: { oil_press: 1 }, in: { raw_fish: 2 }, w: 1, out: 'oil', t: 12, tech: 'lamplight', batch: true });
R('press_resin_oil', '熬松油', { keep: { oil_press: 1 }, in: { resin: 2 }, w: 1, out: 'oil', t: 12, tech: 'lamplight', batch: true });
R('make_lantern', '糊灯笼', { in: { copper: 1, oil: 1, paper: 1 }, w: 1, out: 'lantern', t: 10, tech: 'lamplight' });
R('make_lamp_post', '立灯柱', { in: { copper: 2, stone: 2, oil: 1 }, w: 1, out: 'lamp_post', t: 12, tech: 'lamplight', skill: 'build', fx: 'build' });

// ---- era 5: letters ------------------------------------------------------------------------------
R('make_library', '建藏书阁', { in: { brick: 4, book: 2, plank: 2 }, w: 1, out: 'library', t: 20, tech: 'philosophy', skill: 'build', fx: 'build' });
R('library_insight', '藏书阁研读', { keep: { library: 1 }, w: 1, out: [['insight', 2]], t: 15, skill: 'research', aids: ['research_aid'], fx: 'research' });
R('make_observatory', '筑观星台', { in: { brick: 4, glass: 2, bronze: 2 }, w: 1, out: 'observatory', t: 22, tech: 'astronomy', skill: 'build', fx: 'build' });
R('observe_stars', '观星', { keep: { observatory: 1 }, w: 1, out: [['insight', 2], ['star_chart', 1, 0.3]], t: 24, night: true, dark: true, skill: 'research', fx: 'research' });
R('make_telescope', '磨望远镜', { in: { glass: 2, bronze: 1 }, w: 1, out: 'telescope', t: 12, tech: 'astronomy' });
R('make_glassworks', '建琉璃坊', { in: { brick: 4, stone: 2, sand: 2 }, w: 1, out: 'glassworks', t: 16, tech: 'glassmaking', skill: 'build', fx: 'build' });
R('melt_glass', '烧琉璃', { keep: { glassworks: 1 }, in: { sand: 2, '#smeltfuel': 1 }, w: 1, out: 'glass', t: 14, tech: 'glassmaking', batch: true });
R('make_lighthouse', '建灯塔', { in: { brick: 6, glass: 2, copper: 2 }, w: 1, out: 'lighthouse', t: 26, tech: 'architecture', skill: 'build', fx: 'build' });
R('make_alchemy_lab', '建炼丹房', { in: { brick: 3, glass: 2, copper: 2 }, w: 1, out: 'alchemy_lab', t: 16, tech: 'alchemy', skill: 'build', fx: 'build' });
R('mix_gunpowder', '配火药', { keep: { alchemy_lab: 1 }, in: { sulfur: 1, charcoal: 2 }, w: 1, out: 'gunpowder', t: 14, tech: 'alchemy', batch: true });
R('brew_elixir', '炼灵药', { keep: { alchemy_lab: 1 }, in: { potion: 2, crystal: 1 }, w: 1, out: 'elixir', t: 20, tech: 'alchemy', skill: 'heal' });
R('make_compass', '制罗盘', { in: { iron: 1, glass: 1 }, w: 1, out: 'compass', t: 10, tech: 'navigation' });
R('make_festival_ground', '筑庆典台', { in: { plank: 4, cloth: 2, stone: 2 }, w: 1, out: 'festival_ground', t: 16, tech: 'civics', skill: 'build', fx: 'build' });
R('prepare_feast', '备盛宴', { keep: { '#cook': 1 }, in: { roast: 2, bread: 2 }, w: 1, out: 'feast', t: 16, tech: 'civics', dark: true, skill: 'cook', fx: 'cook' });
R('make_memorial', '立纪念碑', { in: { stone: 5, paper: 1 }, w: 1, out: 'memorial', t: 16, tech: 'civics', skill: 'build', fx: 'build' });
R('cast_gold', '铸金锭', { keep: { smelter: 1 }, in: { coin: 10 }, w: 1, out: 'gold', t: 8, tech: 'banking', skill: 'smith' });

// ---- era 6: clockwork ----------------------------------------------------------------------------
R('make_clock_workshop', '建机关坊', { in: { iron: 3, plank: 3, brick: 2 }, w: 1, out: 'clock_workshop', t: 20, tech: 'clockwork', skill: 'build', fx: 'build' });
R('cut_gears', '车齿轮', { keep: { clock_workshop: 1 }, in: { iron: 1 }, w: 1, out: [['gear', 2]], t: 12, tech: 'clockwork', batch: true, skill: 'smith' });
R('make_steam_core', '造蒸汽核心', { keep: { clock_workshop: 1 }, in: { iron: 2, gear: 2, coal: 1 }, w: 1, out: 'steam_core', t: 20, tech: 'steam', skill: 'smith', fx: 'forge' });
R('make_steam_engine', '装蒸汽机', { in: { steam_core: 1, iron: 2, brick: 4 }, w: 1, out: 'steam_engine', t: 24, tech: 'steam', skill: 'build', fx: 'build' });
R('forge_musket', '造火铳', { ...FORGE, in: { iron: 2, plank: 1, gunpowder: 1 }, out: 'musket', t: 16, tech: 'firearms' });
R('build_automaton', '造机关傀儡', { keep: { clock_workshop: 1 }, in: { steam_core: 1, iron: 3, gear: 3 }, w: 1, out: 'automaton', t: 30, tech: 'automata', skill: 'smith', fx: 'upgrade' });
R('make_beacon', '筑烽燧', { in: { stone: 6, iron: 2, ember_shard: 1 }, w: 1, out: 'beacon', t: 24, tech: 'beacon_lore', skill: 'build', fx: 'build' });
R('kindle_holy_flame', '引圣焰', { keep: { shrine: 1 }, in: { ember_shard: 3, lantern: 1 }, w: 1, out: 'holy_flame', t: 24, tech: 'beacon_lore', fx: 'upgrade' });
R('found_great_flame', '奠基大薪火', { in: { stone: 8, brick: 6 }, w: 2, out: 'great_flame_site', t: 30, tech: 'great_flame', skill: 'build', fx: 'build' });
R('make_aether_lamp', '造以太灯', { in: { crystal: 2, glass: 1, gear: 1 }, w: 1, out: 'aether_lamp', t: 16, tech: 'aether', skill: 'build', fx: 'build' });
R('make_moon_lantern', '造月光灯', { in: { shadow_dust: 2, glass: 1 }, w: 1, out: 'moon_lantern', t: 14, tech: 'shadowcraft', skill: 'build', fx: 'build' });
R('make_candle', '做蜡烛', { in: { wax: 1, fiber: 1 }, w: 1, out: [['candle', 2]], t: 6, tech: 'civics' });

// ---- training: a survivor (or a specialist) consumes an item and becomes someone new --------------
const TRAIN = { skill: 'train', fx: 'upgrade', t: 8 };
R('train_woodsman', '训练樵夫', { ...TRAIN, in: { survivor: 1, '#axe': 1 }, out: 'woodsman', carry: 'survivor' });
R('train_miner', '训练矿工', { ...TRAIN, in: { survivor: 1, '#pick': 1 }, out: 'miner', carry: 'survivor', tech: 'mining' });
R('train_farmer', '训练农人', { ...TRAIN, in: { survivor: 1, hoe: 1 }, out: 'farmer', carry: 'survivor', tech: 'farming' });
R('train_spearman', '训练矛兵', { ...TRAIN, in: { survivor: 1, spear: 1 }, out: 'spearman', carry: 'survivor', tech: 'hunting' });
R('train_archer', '训练弓手', { ...TRAIN, in: { survivor: 1, bow: 1 }, out: 'archer', carry: 'survivor', tech: 'archery' });
R('train_artisan', '训练工匠', { ...TRAIN, in: { survivor: 1, toolbox: 1 }, out: 'artisan', carry: 'survivor', tech: 'carpentry' });
R('train_scholar', '训练学者', { ...TRAIN, in: { survivor: 1, book: 1 }, out: 'scholar', carry: 'survivor', tech: 'writing' });
R('train_healer', '训练医者', { ...TRAIN, in: { survivor: 1, herb_kit: 1 }, out: 'healer', carry: 'survivor', tech: 'herbalism' });
R('train_scout', '训练斥候', { ...TRAIN, in: { survivor: 1, map: 1 }, out: 'scout', carry: 'survivor' });
R('train_merchant', '训练行商', { ...TRAIN, in: { survivor: 1, scale: 1 }, out: 'merchant', carry: 'survivor', tech: 'trade' });
R('train_lampwarden', '训练掌灯人', { ...TRAIN, in: { survivor: 1, lantern: 1 }, out: 'lampwarden', carry: 'survivor', tech: 'lamplight' });
R('train_maceguard', '训练锤卫', { ...TRAIN, in: { survivor: 1, mace: 1, shield: 1 }, out: 'maceguard', carry: 'survivor', tech: 'tactics' });
R('train_sailor', '训练水手', { ...TRAIN, in: { survivor: 1, compass: 1 }, out: 'sailor', carry: 'survivor', tech: 'navigation' });
R('train_knight', '训练骑卫', { ...TRAIN, in: { spearman: 1, saddle_horse: 1, iron_armor: 1 }, out: 'knight', carry: 'spearman', tech: 'horsemanship', t: 12 });
R('train_musketeer', '训练火铳手', { ...TRAIN, in: { archer: 1, musket: 1 }, out: 'musketeer', carry: 'archer', tech: 'firearms' });
R('train_sage', '训练贤者', { ...TRAIN, in: { scholar: 1, star_chart: 1 }, out: 'sage', carry: 'scholar', tech: 'astronomy' });
R('train_engineer', '训练机工', { ...TRAIN, in: { artisan: 1, gear: 2 }, out: 'engineer', carry: 'artisan', tech: 'clockwork' });
R('train_flamekeeper', '传承圣焰', { ...TRAIN, in: { lampwarden: 1, holy_flame: 1 }, out: 'flamekeeper', carry: 'lampwarden', tech: 'beacon_lore', t: 16 });

// ---- hidden recipes: never listed until someone stumbles on them (or reads a scroll) --------------
const H = { hidden: true };
R('h_pine_torch', '松明', { ...H, in: { wood: 1, resin: 1 }, w: 1, out: [['torch', 2]], t: 5, hint: '松树的泪能让木头烧得更久。' });
R('h_jam', '熬果酱', { ...H, keep: { pot: 1, '#cook': 1 }, in: { berry: 3 }, out: 'jam', t: 12, dark: true, skill: 'cook', fx: 'cook', hint: '三捧浆果在火上的陶罐里慢慢熬。' });
R('h_pie', '烤馅饼', { ...H, keep: { '#cook': 1 }, in: { flour: 1, apple: 1, egg: 1 }, w: 1, out: 'pie', t: 12, skill: 'cook', fx: 'cook', hint: '面粉、果子与蛋，在火边。' });
R('h_mead', '酿蜜酒', { ...H, keep: { pot: 1 }, in: { honey: 2 }, out: 'mead', t: 30, dark: true, skill: 'cook', hint: '两罐蜂蜜封进陶罐，等它自己变化。' });
R('h_orchard', '栽果园', { ...H, in: { apple: 2, sapling: 1 }, w: 1, out: 'orchard', t: 12, skill: 'farm', fx: 'build', hint: '把果子埋在树苗旁边。' });
R('h_herb_tea', '煮草药茶', { ...H, keep: { pot: 1, '#cook': 1 }, in: { herb: 1 }, out: 'herb_tea', t: 6, dark: true, skill: 'cook', fx: 'cook', hint: '一株草药，一个陶罐，一团火。' });
R('h_fish_stew', '鱼汤', { ...H, keep: { pot: 1, '#cook': 1 }, in: { raw_fish: 1, mushroom: 1 }, out: 'stew', t: 10, dark: true, skill: 'cook', fx: 'cook', hint: '鱼和蘑菇一起下锅。' });
R('h_bone_charm', '刻骨符', { ...H, in: { bone: 3, fiber: 1 }, w: 1, out: 'bone_charm', t: 8, hint: '三块骨头用细绳穿起。' });
R('h_quill', '削羽笔', { ...H, in: { feather: 2, charcoal: 1 }, w: 1, out: 'quill', t: 6, hint: '羽毛蘸上炭黑就能写字。' });
R('h_wolf_cloak', '狼王斗篷', { ...H, in: { wolf_pelt: 1, leather: 1 }, w: 1, out: 'wolf_cloak', t: 12, hint: '头狼的皮配上鞣好的皮革。' });
R('h_heartwood_bow', '心木弓', { ...H, keep: { workbench: 1 }, in: { heartwood: 1, rope: 1 }, w: 1, out: 'heartwood_bow', t: 16, hint: '活着的木心，在工作台上配一根弦。' });
R('h_fang_spear', '鳄牙矛', { ...H, in: { croc_tooth: 1, wood: 2 }, w: 1, out: 'fang_spear', t: 12, hint: '把鳄王的牙绑在长杆上。' });
R('h_molten_plate', '熔核铠', { ...H, keep: { forge: 1 }, in: { molten_core: 1, iron: 3 }, w: 1, out: 'molten_plate', t: 24, skill: 'smith', fx: 'forge', hint: '仍在跳动的熔核与三块铁，在锻炉上。' });
R('h_frost_amulet', '霜心护符', { ...H, in: { frost_heart: 1, rope: 1 }, w: 1, out: 'frost_amulet', t: 10, hint: '用绳子把霜心挂在胸前。' });
R('h_flame_blade', '焰刃', { ...H, keep: { forge: 1 }, in: { ember_shard: 1, iron_sword: 1 }, w: 1, out: 'flame_blade', t: 16, skill: 'smith', fx: 'forge', hint: '把余烬晶锻进一把铁剑。' });
R('h_star_blade', '星刃', { ...H, keep: { forge: 1 }, in: { star_metal: 2, ember_shard: 1 }, w: 1, out: 'star_blade', t: 20, skill: 'smith', fx: 'forge', hint: '两块星铁与一颗余烬晶。' });
R('h_obsidian_blade', '黑曜刃', { ...H, in: { obsidian: 2, wood: 1 }, w: 1, out: 'obsidian_blade', t: 10, hint: '黑曜石磨成刃，装在木柄上。' });
R('h_dawn_amulet', '晨曦护符', { ...H, in: { ember_shard: 1, gold: 1 }, w: 1, out: 'dawn_amulet', t: 12, hint: '把余烬晶嵌进金子里。' });
R('h_pearl_necklace', '串珍珠', { ...H, in: { pearl: 3, rope: 1 }, w: 1, out: 'pearl_necklace', t: 10, hint: '三颗珍珠串在一根绳上。' });
R('h_eternal_lamp', '长明灯', { ...H, in: { ember_shard: 2, glass: 1, stone: 2 }, w: 1, out: 'eternal_lamp', t: 18, skill: 'build', fx: 'build', hint: '琉璃罩住两颗余烬晶，再用石头垒起灯座。' });
R('h_snowman', '堆雪人', { ...H, keep: { child: 1 }, in: { ice: 3 }, out: 'snowman', t: 10, dark: true, skill: 'none', hint: '让孩子们玩一会儿冰块。' });
R('h_raft', '扎木筏', { ...H, in: { driftwood: 3, rope: 1 }, w: 1, out: 'raft', t: 12, skill: 'build', hint: '浮木用绳索捆在一起。' });
R('h_treasure_map', '寻宝图', { ...H, in: { relic: 1, map: 1 }, w: 1, out: 'treasure_map', t: 10, skill: 'research', hint: '古物上的花纹和地图对得上。' });
R('h_lingzhi', '灵芝汤', { ...H, keep: { pot: 1, '#cook': 1 }, in: { mushroom: 2, herb: 2, honey: 1 }, out: 'elixir', t: 20, dark: true, skill: 'heal', fx: 'cook', hint: '两菇两草一勺蜜，火上慢炖。' });
R('h_candle', '捻蜡烛', { ...H, in: { wax: 2 }, w: 1, out: [['candle', 2]], t: 6, hint: '蜂蜡捏一捏就能点着。' });
R('h_carve_ivory', '牙雕', { ...H, keep: { workbench: 1 }, in: { ivory: 1 }, w: 1, out: [['relic', 2]], t: 14, hint: '在工作台上雕刻象牙。' });
R('h_salt_roast', '盐焗肉排', { ...H, keep: { '#cook': 1 }, in: { raw_meat: 3, salt: 1 }, w: 1, out: 'salt_roast', t: 14, skill: 'cook', fx: 'cook', hint: '三块生肉裹上盐，在火上焗。' });
R('h_sea_salt', '煮海盐', { ...H, keep: { '#cook': 1 }, in: { seaweed: 3 }, out: 'salt', t: 10, dark: true, skill: 'cook', hint: '海藻在火上烤干，会留下白色的结晶。' });
R('h_crystal_lamp', '晶灯', { ...H, in: { crystal: 2, lantern: 1 }, w: 1, out: 'aether_lamp', t: 14, skill: 'build', fx: 'build', hint: '两块晶石放进灯笼里。' });
R('h_cheese_cave', '窖藏奶酪', { ...H, in: { milk: 2, ice: 1 }, w: 1, out: 'cheese', t: 16, skill: 'cook', hint: '羊奶放在冰上，会慢慢凝固。' });
R('h_shadow_ink', '影墨', { ...H, in: { shadow_dust: 1, paper: 2 }, w: 1, out: 'scroll', t: 10, skill: 'research', fx: 'research', hint: '影尘溶进纸里，会浮现前人的字迹。' });
R('h_ember_torch', '余烬火把', { ...H, in: { ember_shard: 1, wood: 1 }, w: 1, out: 'lantern', t: 10, hint: '余烬晶插在木棍上，比灯笼还亮。' });
R('h_ice_house', '冰屋', { ...H, in: { ice: 4, fur: 1 }, w: 1, out: 'snow_hut', t: 16, skill: 'build', fx: 'build', hint: '冰块砌墙，毛皮挂门。' });
R('h_bone_flute', '骨笛', { ...H, keep: { '#cook': 1 }, in: { bone: 1, feather: 1 }, w: 1, out: 'insight', t: 12, night: true, dark: true, skill: 'research', fx: 'research', hint: '火边吹响骨笛，人们会讲起古老的故事。' });

// ---- generated: harvesting nodes ------------------------------------------------------------------
for (const def of Object.values(CARDS)) {
  const n = def.node;
  if (!n) continue;
  if (def.id === 'young_tree') continue;
  const aids = [];
  if (n.tool) aids.push(n.tool);
  R('harvest_' + def.id, def.kind === 'structure' ? '耕作' + def.name : '采集' + def.name, {
    keep: { [def.id]: 1 }, w: n.w ?? 1, multi: n.multi ?? 2, out: n.out, t: n.t, tech: n.tech || null,
    skill: n.skill, aids, dark: !!n.dark, kind: 'harvest', fx: 'harvest',
  });
}
// cultivating a domestic goat counts as a node-like harvest (milk) — defined explicitly above.

// ---- generated: exploring regions ----------------------------------------------------------------
for (const def of Object.values(CARDS)) {
  const r = def.region;
  if (!r) continue;
  R('explore_' + def.id, '探索' + def.name, {
    keep: { [def.id]: 1 }, w: 1, multi: 2, out: [], t: r.t, skill: r.need === 'boat' ? 'sail' : 'explore',
    aids: ['explore_aid', 'boat'], kind: 'explore', fx: 'explore', dark: false,
  });
}

export const RECIPE_IDS = Object.keys(RECIPES);
export const HIDDEN_RECIPES = RECIPE_IDS.filter((id) => RECIPES[id].hidden);

/** human readable list of a recipe's ingredients, e.g. "木材×2 + 燧石 + 劳力" */
export function recipeInputsText(r) {
  const parts = [];
  const nm = (k) => (k[0] === '#' ? TAG_NAMES[k.slice(1)] || k.slice(1) : CARDS[k]?.name || k);
  for (const [k, n] of Object.entries(r.keep)) parts.push(nm(k) + (n > 1 ? '×' + n : ''));
  for (const [k, n] of Object.entries(r.in)) parts.push(nm(k) + (n > 1 ? '×' + n : ''));
  if (r.w) parts.push('劳力' + (r.w > 1 ? '×' + r.w : ''));
  return parts.join(' + ');
}

export const TAG_NAMES = {
  worker: '劳力', person: '人物', adult: '成年人', house: '房屋', cook: '火堆', fuel: '燃料', smeltfuel: '煤或木炭',
  axe: '斧', pick: '镐', rod: '钓竿', hoe: '锄', fire: '火', research_aid: '研究辅助', explore_aid: '探索辅助',
  boat: '舟', portable_light: '随身光源', food: '食物', soldier: '士兵', child: '孩童',
};
