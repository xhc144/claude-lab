// Crafting and smelting recipes. Crafting is shapeless and station based: the recipe book shows
// everything you can make at your current station (hand / workbench / resonator / forge),
// which ingredients you're missing, and unlocks recipes as you discover their ingredients.

import { I, ITEMS } from './items.js';
import { B, BLOCKS, COLORS, WOOD_TYPES, SLAB_OF, STAIRS_OF } from './blocks.js';

export const STATIONS = {
  hand: { zh: '随身合成', icon: 'oak_planks' },
  workbench: { zh: '工作台', icon: 'workbench' },
  resonator: { zh: '共鸣台', icon: 'resonator' },
  forge: { zh: '锻石台', icon: 'anvil_stone' },
};
// stations include the lower ones
export const STATION_RANK = { hand: ['hand'], workbench: ['hand', 'workbench'], resonator: ['hand', 'workbench', 'resonator'], forge: ['hand', 'workbench', 'forge'] };

export const TAGS = {
  '#planks': WOOD_TYPES.map((w) => `${w}_planks`),
  '#log': [...WOOD_TYPES.map((w) => `${w}_log`), 'mushroom_stem'],
  '#cobble': ['cobblestone', 'deep_cobble'],
  '#coal': ['coal', 'charcoal'],
  '#sand': ['sand', 'redsand'],
  '#meat': ['raw_venison', 'raw_boar', 'raw_fowl', 'raw_fish'],
  '#flower': ['dawnflower', 'bellbloom', 'bluestar', 'emberbloom', 'moonlily'],
};
export const TAG_ZH = { '#planks': '任意木板', '#log': '任意原木', '#cobble': '碎石', '#coal': '煤或木炭', '#sand': '沙子', '#meat': '生肉', '#flower': '花' };
export const tagItems = (t) => (TAGS[t] || []).map((n) => I[n]).filter((x) => x !== undefined);

export const RECIPES = [];
export const CATS = { basic: '基础', tools: '工具', build: '建筑', deco: '装饰', light: '照明', food: '食物', mech: '机械', gear: '装备', color: '染色', armor: '护甲' };

function r(out, n, ins, station = 'workbench', cat = 'basic') {
  const id = I[out];
  if (id === undefined) throw new Error(`recipe output ${out} unknown`);
  const parsed = Object.entries(ins).map(([k, c]) => {
    if (k.startsWith('#')) { if (!TAGS[k]) throw new Error(`tag ${k}`); return { tag: k, n: c }; }
    if (I[k] === undefined) throw new Error(`recipe ${out}: ingredient ${k} unknown`);
    return { id: I[k], n: c };
  });
  RECIPES.push({ i: RECIPES.length, out: id, n, ins: parsed, station, cat });
}

// ---- basics
for (const w of WOOD_TYPES) r(`${w}_planks`, 4, { [`${w}_log`]: 1 }, 'hand', 'basic');
r('oak_planks', 2, { mushroom_stem: 1 }, 'hand');
r('stick', 4, { '#planks': 2 }, 'hand');
r('workbench', 1, { '#planks': 4 }, 'hand');
r('torch', 4, { stick: 1, '#coal': 1 }, 'hand', 'light');
r('torch', 2, { stick: 1, glow_spore: 1 }, 'hand', 'light');
r('campfire', 1, { stick: 3, '#log': 1 }, 'hand', 'light');
r('felt_white', 1, { fluff: 4 }, 'hand', 'basic');
r('string', 3, { fluff: 2 }, 'hand', 'basic');
r('bone_meal', 3, { bone: 1 }, 'hand', 'basic');
r('snow_block', 1, { snowball: 4 }, 'hand', 'build');
r('clay', 1, { clay_ball: 4 }, 'hand', 'build');
r('paper', 3, { reeds: 3 }, 'hand', 'basic');
r('crystal_dust', 9, { power_block: 1 }, 'hand', 'mech');
r('wheat_seeds', 1, { wheat: 1 }, 'hand', 'food');

// ---- stations & storage
r('furnace', 1, { '#cobble': 8 }, 'workbench', 'basic');
r('chest', 1, { '#planks': 8 }, 'workbench', 'basic');
r('bed', 1, { felt_white: 3, '#planks': 3 }, 'workbench', 'basic');
r('resonator', 1, { deep_bricks: 4, crystal_dust: 4, copper_block: 1 }, 'workbench', 'mech');
r('anvil_stone', 1, { deep_bricks: 5, iron_block: 2, furnace: 1 }, 'workbench', 'basic');
r('cauldron', 1, { iron_ingot: 7 }, 'workbench', 'basic');
r('flower_pot', 1, { brick: 3 }, 'workbench', 'deco');
r('bowl', 4, { '#planks': 3 }, 'workbench', 'food');

// ---- tools
const TOOL_MATS = [['wood', '#planks'], ['stone', '#cobble'], ['copper', 'copper_ingot'], ['iron', 'iron_ingot']];
for (const [t, m] of TOOL_MATS) {
  const st = t === 'wood' ? 'workbench' : 'workbench';
  r(`${t}_pickaxe`, 1, { [m]: 3, stick: 2 }, st, 'tools');
  r(`${t}_axe`, 1, { [m]: 3, stick: 2 }, st, 'tools');
  r(`${t}_shovel`, 1, { [m]: 1, stick: 2 }, st, 'tools');
  r(`${t}_hoe`, 1, { [m]: 2, stick: 2 }, st, 'tools');
  r(`${t}_sword`, 1, { [m]: 2, stick: 1 }, st, 'tools');
}
for (const [t, m, extra] of [['star', 'stargem', null], ['meteor', 'meteor_ingot', 'star_shard']]) {
  const ex = extra ? { [extra]: 1 } : {};
  r(`${t}_pickaxe`, 1, { [m]: 3, stick: 2, ...ex }, 'forge', 'tools');
  r(`${t}_axe`, 1, { [m]: 3, stick: 2, ...ex }, 'forge', 'tools');
  r(`${t}_shovel`, 1, { [m]: 1, stick: 2, ...ex }, 'forge', 'tools');
  r(`${t}_hoe`, 1, { [m]: 2, stick: 2, ...ex }, 'forge', 'tools');
  r(`${t}_sword`, 1, { [m]: 2, stick: 1, ...ex }, 'forge', 'tools');
}
r('bucket', 1, { iron_ingot: 3 }, 'workbench', 'tools');
r('shears', 1, { iron_ingot: 2 }, 'workbench', 'tools');
r('flint_steel', 1, { iron_ingot: 1, flint: 1 }, 'workbench', 'tools');
r('fishing_rod', 1, { stick: 3, string: 2 }, 'workbench', 'tools');
r('bow', 1, { stick: 3, string: 3 }, 'workbench', 'tools');
r('arrow', 4, { flint: 1, stick: 1, feather: 1 }, 'workbench', 'tools');
r('glow_arrow', 4, { arrow: 4, glow_spore: 1 }, 'workbench', 'tools');

// ---- armour
const ARM = [['leather', 'leather', 'workbench'], ['copper', 'copper_ingot', 'workbench'], ['iron', 'iron_ingot', 'workbench'], ['star', 'stargem', 'forge']];
for (const [a, m, st] of ARM) {
  r(`${a}_helmet`, 1, { [m]: 5 }, st, 'armor');
  r(`${a}_chestplate`, 1, { [m]: 8 }, st, 'armor');
  r(`${a}_leggings`, 1, { [m]: 7 }, st, 'armor');
  r(`${a}_boots`, 1, { [m]: 4 }, st, 'armor');
}

// ---- building
r('stone_bricks', 4, { stone: 4 }, 'workbench', 'build');
r('mossy_bricks', 2, { stone_bricks: 2, vines: 1 }, 'workbench', 'build');
r('mossy_bricks', 2, { stone_bricks: 2, moss: 1 }, 'workbench', 'build');
r('chiseled_stone', 1, { stone_bricks_slab: 2 }, 'workbench', 'build');
r('polished_stone', 4, { stone: 4 }, 'hand', 'build');
r('deep_bricks', 4, { deep_cobble: 4 }, 'workbench', 'build');
r('deep_tiles', 4, { deep_bricks: 4 }, 'workbench', 'build');
r('bricks', 1, { brick: 4 }, 'workbench', 'build');
r('sandstone', 1, { sand: 4 }, 'hand', 'build');
r('redstone_rock', 1, { redsand: 4 }, 'hand', 'build');
r('cut_sandstone', 4, { sandstone: 4 }, 'workbench', 'build');
r('bookshelf', 1, { '#planks': 6, book: 3 }, 'workbench', 'deco');
r('book', 1, { paper: 3, leather: 1 }, 'workbench', 'basic');
r('thatch', 1, { wheat: 4 }, 'hand', 'build');
r('oak_door', 3, { '#planks': 6 }, 'workbench', 'build');
r('iron_door', 3, { iron_ingot: 6 }, 'workbench', 'build');
r('trapdoor', 2, { '#planks': 6 }, 'workbench', 'build');
r('ladder', 3, { stick: 7 }, 'workbench', 'build');
r('oak_fence', 3, { '#planks': 4, stick: 2 }, 'workbench', 'build');
r('oak_gate', 1, { stick: 4, '#planks': 2 }, 'workbench', 'build');
r('stone_wall', 6, { cobblestone: 6 }, 'workbench', 'build');
for (const base of Object.keys(SLAB_OF)) {
  r(`${base}_slab`, 6, { [base]: 3 }, 'workbench', 'build');
  r(`${base}_stairs`, 4, { [base]: 6 }, 'workbench', 'build');
}
r('carpet_red', 3, { felt_red: 2 }, 'workbench', 'deco');
r('carpet_teal', 3, { felt_teal: 2 }, 'workbench', 'deco');
r('carpet_white', 3, { felt_white: 2 }, 'workbench', 'deco');
for (const m of [['copper_block', 'copper_ingot'], ['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['stargem_block', 'stargem'], ['meteor_block', 'meteor_ingot']]) {
  r(m[0], 1, { [m[1]]: 9 }, 'workbench', 'build');
  r(m[1], 9, { [m[0]]: 1 }, 'hand', 'basic');
}
r('copper_tiles', 4, { copper_block: 1 }, 'workbench', 'build');
r('echo_block', 1, { echo_crystal: 4 }, 'workbench', 'build');
r('lamp_stone', 2, { glow_spore: 4, glass: 1 }, 'workbench', 'light');
r('lantern', 1, { iron_ingot: 1, torch: 1 }, 'workbench', 'light');
r('crystal_lantern', 1, { copper_ingot: 1, crystal_dust: 2, glass: 1 }, 'workbench', 'light');
r('bounce_gel', 1, { gel: 9 }, 'workbench', 'build');
r('gel', 9, { bounce_gel: 1 }, 'hand', 'basic');

// ---- colours: felt, glaze and glass take a dye ingredient
const DYES = {
  white: 'bone_meal', silver: 'clay_ball', gray: 'flint', black: 'coal', red: 'emberbloom', orange: 'sunroot', yellow: 'dawnflower',
  lime: 'fern', green: 'cactus', teal: 'glow_spore', sky: 'moonlily', blue: 'bluestar', violet: 'echo_crystal', magenta: 'red_mushroom',
  pink: 'bellbloom', brown: 'dirt',
};
for (const [c] of COLORS) {
  const dye = DYES[c];
  if (c !== 'white') r(`felt_${c}`, 4, { felt_white: 4, [dye]: 1 }, 'workbench', 'color');
  r(`glaze_${c}`, 4, { terracotta: 4, [dye]: 1 }, 'workbench', 'color');
  r(`glass_${c}`, 4, { glass: 4, [dye]: 1 }, 'workbench', 'color');
}

// ---- food
r('bread', 1, { wheat: 3 }, 'hand', 'food');
r('mushroom_stew', 1, { bowl: 1, red_mushroom: 1, glowshroom: 1 }, 'hand', 'food');
r('honey_bread', 1, { bread: 1, berries: 2, crabapple: 1 }, 'workbench', 'food');
r('star_candy', 2, { berries: 2, star_shard: 1 }, 'hand', 'food');
r('melon_seeds', 1, { melon_slice: 1 }, 'hand', 'food');

// ---- resonance machinery
r('lever', 1, { stick: 1, cobblestone: 1 }, 'workbench', 'mech');
r('button', 1, { stone: 1 }, 'hand', 'mech');
r('pressure_plate', 1, { stone: 2 }, 'workbench', 'mech');
r('power_block', 1, { crystal_dust: 9 }, 'workbench', 'mech');
r('inverter', 1, { crystal_dust: 1, stick: 1 }, 'workbench', 'mech');
r('note_block', 1, { '#planks': 8, crystal_dust: 1 }, 'workbench', 'mech');
r('rail', 16, { iron_ingot: 6, stick: 1 }, 'workbench', 'mech');
r('cart', 1, { iron_ingot: 5 }, 'workbench', 'mech');
r('hopper', 1, { iron_ingot: 5, chest: 1 }, 'workbench', 'mech');
r('gear', 2, { copper_ingot: 4 }, 'workbench', 'mech');
r('lens', 1, { glass: 3, crystal_dust: 1 }, 'resonator', 'mech');
r('repeater', 1, { stone: 3, inverter: 2, crystal_dust: 1 }, 'resonator', 'mech');
r('crystal_lamp', 1, { crystal_dust: 4, lamp_stone: 1 }, 'resonator', 'mech');
r('piston', 1, { '#planks': 3, '#cobble': 4, iron_ingot: 1, crystal_dust: 1 }, 'resonator', 'mech');
r('sticky_piston', 1, { piston: 1, gel: 1 }, 'resonator', 'mech');
r('observer', 1, { '#cobble': 6, crystal_dust: 2, lens: 1 }, 'resonator', 'mech');
r('daylight_sensor', 1, { glass: 3, lens: 1, oak_planks_slab: 3 }, 'resonator', 'mech');
r('dispenser', 1, { '#cobble': 7, bow: 1, crystal_dust: 1 }, 'resonator', 'mech');
r('placer', 1, { '#cobble': 7, chest: 1, crystal_dust: 1 }, 'resonator', 'mech');
r('drill', 1, { iron_ingot: 4, iron_pickaxe: 1, crystal_dust: 2, '#cobble': 2 }, 'resonator', 'mech');
r('fan', 1, { iron_ingot: 4, gear: 1, crystal_dust: 2, '#cobble': 2 }, 'resonator', 'mech');
r('launch_pad', 2, { gel: 2, iron_ingot: 2, crystal_dust: 1, polished_stone: 4 }, 'resonator', 'mech');
r('conveyor', 6, { copper_ingot: 3, gear: 2, crystal_dust: 1, polished_stone: 3 }, 'resonator', 'mech');
r('power_rail', 6, { gold_ingot: 6, stick: 1, crystal_dust: 1 }, 'resonator', 'mech');
r('blast_barrel', 1, { blast_powder: 5, '#sand': 4 }, 'workbench', 'mech');

// ---- gear
r('glider', 1, { felt_white: 4, stick: 3, string: 2 }, 'workbench', 'gear');
r('grapple', 1, { iron_ingot: 3, string: 3, crystal_dust: 1 }, 'resonator', 'gear');
r('echo_compass', 1, { gold_ingot: 4, echo_crystal: 1, crystal_dust: 1 }, 'resonator', 'gear');
r('spyglass', 1, { copper_ingot: 2, lens: 1 }, 'resonator', 'gear');
r('loom_thread', 1, { echo_crystal: 2, star_shard: 1 }, 'resonator', 'gear');
r('waystone', 1, { deep_bricks: 4, echo_crystal: 2, star_shard: 1 }, 'resonator', 'gear');
r('lantern_staff', 1, { stick: 2, crystal_lantern: 1, loom_thread: 1 }, 'resonator', 'gear');
r('feather_charm', 1, { feather: 4, gold_ingot: 1, loom_thread: 1 }, 'resonator', 'gear');

// ---------------------------------------------------------------- smelting
export const SMELT = [];
function s(inp, out, n = 1, time = 6) {
  const ids = inp.startsWith('#') ? tagItems(inp) : [I[inp]];
  for (const id of ids) {
    if (id === undefined || I[out] === undefined) throw new Error(`smelt ${inp} -> ${out}`);
    SMELT.push({ in: id, out: I[out], n, time });
  }
}
s('raw_copper', 'copper_ingot'); s('raw_iron', 'iron_ingot'); s('raw_gold', 'gold_ingot'); s('raw_meteor', 'meteor_ingot', 1, 16);
s('#sand', 'glass'); s('cobblestone', 'stone'); s('deep_cobble', 'deepstone'); s('clay_ball', 'brick'); s('clay', 'terracotta');
s('sandstone', 'smooth_sandstone'); s('#log', 'charcoal'); s('stone_bricks', 'cracked_bricks'); s('stone', 'polished_stone');
s('raw_venison', 'venison'); s('raw_boar', 'boar'); s('raw_fowl', 'fowl'); s('raw_fish', 'fish'); s('sunroot', 'baked_sunroot'); s('egg', 'fried_egg');
s('iron_ore', 'iron_ingot'); s('copper_ore', 'copper_ingot'); s('gold_ore', 'gold_ingot'); s('meteor_ore', 'meteor_ingot', 1, 16);

export const SMELT_BY_IN = new Map(SMELT.map((x) => [x.in, x]));
export const COOKABLE = new Set(['raw_venison', 'raw_boar', 'raw_fowl', 'raw_fish', 'sunroot', 'egg'].map((n) => I[n]));

// fuel burn time in seconds
export function fuelValue(id) {
  const d = ITEMS[id];
  if (!d) return 0;
  if (d.fuel) return d.fuel;
  const n = d.name;
  if (n.endsWith('_log') || n === 'mushroom_stem') return 15;
  if (n.endsWith('_planks') || n.endsWith('_slab') && BLOCKS[id] && BLOCKS[id].sound === 'wood') return 15;
  if (n === 'stick' || n.endsWith('_sapling')) return 5;
  if (n === 'workbench' || n === 'chest' || n === 'bookshelf' || n === 'oak_fence' || n === 'ladder' || n === 'note_block') return 15;
  if (n.startsWith('wood_')) return 10;
  if (n === 'thatch' || n === 'dead_bush') return 6;
  return 0;
}

// ---------------------------------------------------------------- crafting helpers
export function countHave(inv, ing) {
  if (ing.tag) { let c = 0; for (const id of tagItems(ing.tag)) c += inv.count(id); return c; }
  return inv.count(ing.id);
}
export function canCraft(inv, rec, times = 1) {
  return rec.ins.every((ing) => countHave(inv, ing) >= ing.n * times);
}
export function maxCraft(inv, rec) {
  let m = Infinity;
  for (const ing of rec.ins) m = Math.min(m, Math.floor(countHave(inv, ing) / ing.n));
  const stack = ITEMS[rec.out].stack;
  return Math.min(m, Math.max(1, Math.floor(stack * 4 / rec.n)));
}
export function consumeIngredients(inv, rec, times = 1) {
  for (const ing of rec.ins) {
    let need = ing.n * times;
    if (ing.tag) {
      for (const id of tagItems(ing.tag)) { if (!need) break; need -= inv.remove(id, Math.min(need, inv.count(id))); }
    } else inv.remove(ing.id, need);
  }
}
export function recipeKnown(rec, discovered) {
  // known once you have handled any ingredient (or the output itself)
  if (discovered.has(rec.out)) return true;
  return rec.ins.some((ing) => (ing.tag ? tagItems(ing.tag).some((id) => discovered.has(id)) : discovered.has(ing.id)));
}

export { B };
