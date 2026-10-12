// Block registry. A cell stores a 16-bit value: id in the low 10 bits, metadata in the high 6 bits.
// Every property lives in a flat typed array indexed by id so the hot loops (meshing, lighting,
// physics) never touch objects. This module is shared by the main thread and the workers.

export const ID_BITS = 10;
export const ID_MASK = (1 << ID_BITS) - 1;
export const MAX_BLOCKS = 1 << ID_BITS;
export const idOf = (v) => v & ID_MASK;
export const metaOf = (v) => v >>> ID_BITS;
export const pack = (id, meta = 0) => id | (meta << ID_BITS);

// Render layers
export const L_NONE = 0, L_OPAQUE = 1, L_CUTOUT = 2, L_TRANS = 3;

export const BLOCKS = [];
export const B = Object.create(null); // name -> id

export const SOLID = new Uint8Array(MAX_BLOCKS);     // has collision
export const OPAQUE = new Uint8Array(MAX_BLOCKS);    // full, light-blocking cube that hides neighbour faces
export const LAYER = new Uint8Array(MAX_BLOCKS);
export const FILTER = new Uint8Array(MAX_BLOCKS);    // extra light attenuation (0..15) for non-opaque
export const EMIT = new Uint16Array(MAX_BLOCKS);     // packed 4:4:4 rgb emission (r<<8 | g<<4 | b)
export const REPLACEABLE = new Uint8Array(MAX_BLOCKS);
export const LIQUID = new Uint8Array(MAX_BLOCKS);    // 1 water, 2 lava
export const CLIMB = new Uint8Array(MAX_BLOCKS);
export const TINT = new Uint8Array(MAX_BLOCKS);      // 0 none, 1 grass, 2 foliage, 3 water
export const GRAVITY = new Int8Array(MAX_BLOCKS);    // 1 falls, -1 rises
export const FLAMMABLE = new Uint8Array(MAX_BLOCKS); // catch chance (0 = never burns)
export const FULLCUBE = new Uint8Array(MAX_BLOCKS);  // shape is the plain unit cube (opaque or not)

const textureNames = [];
const textureIndex = new Map();
export function texLayer(name) {
  let i = textureIndex.get(name);
  if (i === undefined) {
    i = textureNames.length;
    textureNames.push(name);
    textureIndex.set(name, i);
  }
  return i;
}
export const TEXTURE_NAMES = textureNames;

// face order: 0 +X east, 1 -X west, 2 +Y up, 3 -Y down, 4 +Z south, 5 -Z north
export const FACE_DX = [1, -1, 0, 0, 0, 0];
export const FACE_DY = [0, 0, 1, -1, 0, 0];
export const FACE_DZ = [0, 0, 0, 0, 1, -1];
export const OPPOSITE = [1, 0, 3, 2, 5, 4];

function faceTex(t) {
  // t: string | {all, top, bottom, side, front, back, ...}
  if (typeof t === 'string') return [t, t, t, t, t, t];
  if (Array.isArray(t)) return t;
  const side = t.side || t.all;
  const out = [t.east || side, t.west || side, t.top || t.all || side, t.bottom || t.all || side, t.south || side, t.north || t.front || side];
  return out;
}

const DEFAULTS = {
  shape: 'cube', solid: true, opaque: true, layer: L_OPAQUE, filter: 0, light: null,
  hardness: 1, tool: null, level: 0, sound: 'stone', drops: undefined, replaceable: false,
  tint: 0, friction: 0.6, bounce: 0, climb: false, gravity: 0, flammable: 0, item: true,
  orient: null, speed: 1, damage: 0, cat: 'build',
};

function def(name, zh, props = {}) {
  const id = BLOCKS.length;
  const d = Object.assign({}, DEFAULTS, props, { id, name, zh });
  if (d.shape !== 'cube' && props.opaque === undefined) d.opaque = false;
  if (d.layer === L_OPAQUE && !d.opaque && props.layer === undefined) d.layer = L_CUTOUT;
  if (d.tex) {
    d.faces = faceTex(d.tex).map(texLayer);
    if (d.texAlt) d.facesAlt = faceTex(d.texAlt).map(texLayer);
  }
  if (d.extraTex) for (const t of d.extraTex) texLayer(t);
  BLOCKS.push(d);
  B[name] = id;
  SOLID[id] = d.solid ? 1 : 0;
  OPAQUE[id] = d.opaque ? 1 : 0;
  LAYER[id] = d.layer;
  FILTER[id] = d.filter;
  if (d.light) EMIT[id] = (d.light[0] << 8) | (d.light[1] << 4) | d.light[2];
  REPLACEABLE[id] = d.replaceable ? 1 : 0;
  LIQUID[id] = d.liquid || 0;
  CLIMB[id] = d.climb ? 1 : 0;
  TINT[id] = d.tint;
  GRAVITY[id] = d.gravity;
  FLAMMABLE[id] = d.flammable;
  FULLCUBE[id] = d.shape === 'cube' ? 1 : 0;
  return id;
}

const stoneLike = (o = {}) => ({ hardness: 1.5, tool: 'pickaxe', level: 0, sound: 'stone', ...o });
const woodLike = (o = {}) => ({ hardness: 2, tool: 'axe', sound: 'wood', flammable: 5, ...o });
const dirtLike = (o = {}) => ({ hardness: 0.5, tool: 'shovel', sound: 'gravel', ...o });
const plant = (o = {}) => ({ shape: 'cross', solid: false, opaque: false, layer: L_CUTOUT, hardness: 0, sound: 'plant', replaceable: false, flammable: 60, cat: 'nature', ...o });

// ---------------------------------------------------------------- terrain
def('air', '空气', { shape: 'none', solid: false, opaque: false, layer: L_NONE, replaceable: true, item: false, hardness: 0 });
def('bedrock', '界底岩', { tex: 'bedrock', hardness: -1, sound: 'stone', cat: 'nature' });
def('stone', '苍石', stoneLike({ tex: 'stone', drops: 'cobblestone', cat: 'nature' }));
def('cobblestone', '碎石', stoneLike({ tex: 'cobblestone', hardness: 2 }));
def('dirt', '泥土', dirtLike({ tex: 'dirt', cat: 'nature' }));
def('grass', '青草地', dirtLike({ tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, drops: 'dirt', sound: 'grass', tint: 1, cat: 'nature' }));
def('sand', '细沙', dirtLike({ tex: 'sand', gravity: 1, sound: 'sand', cat: 'nature' }));
def('gravel', '砂砾', dirtLike({ tex: 'gravel', gravity: 1, hardness: 0.6, cat: 'nature' }));
def('clay', '陶泥', dirtLike({ tex: 'clay', hardness: 0.6, drops: { item: 'clay_ball', n: 4 }, cat: 'nature' }));
def('deepstone', '玄岩', stoneLike({ tex: 'deepstone', hardness: 3, drops: 'deep_cobble', cat: 'nature' }));
def('deep_cobble', '玄岩碎块', stoneLike({ tex: 'deep_cobble', hardness: 3 }));
def('sandstone', '砂岩', stoneLike({ tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone' }, hardness: 0.8, cat: 'nature' }));
def('redsand', '赤沙', dirtLike({ tex: 'redsand', gravity: 1, sound: 'sand', cat: 'nature' }));
def('redstone_rock', '赤砂岩', stoneLike({ tex: { top: 'redrock_top', bottom: 'redrock_top', side: 'redrock' }, hardness: 0.8, cat: 'nature' }));
def('terracotta', '陶土', stoneLike({ tex: 'terracotta', hardness: 1.25, cat: 'nature' }));
def('terra_orange', '橙陶土', stoneLike({ tex: 'terra_orange', hardness: 1.25, cat: 'nature' }));
def('terra_cream', '米陶土', stoneLike({ tex: 'terra_cream', hardness: 1.25, cat: 'nature' }));
def('terra_rust', '锈陶土', stoneLike({ tex: 'terra_rust', hardness: 1.25, cat: 'nature' }));
def('terra_umber', '褐陶土', stoneLike({ tex: 'terra_umber', hardness: 1.25, cat: 'nature' }));
def('snow_block', '积雪块', dirtLike({ tex: 'snow', sound: 'snow', hardness: 0.3, drops: { item: 'snowball', n: 4 }, cat: 'nature' }));
def('snow_grass', '雪覆草地', dirtLike({ tex: { top: 'snow', bottom: 'dirt', side: 'snow_side' }, drops: 'dirt', sound: 'snow', cat: 'nature' }));
def('snow_layer', '雪层', { shape: 'layer', tex: 'snow', solid: true, opaque: false, layer: L_CUTOUT, hardness: 0.1, tool: 'shovel', sound: 'snow', replaceable: true, drops: { item: 'snowball', n: 1 }, cat: 'nature' });
def('ice', '冰', { tex: 'ice', opaque: false, layer: L_TRANS, filter: 1, hardness: 0.5, tool: 'pickaxe', sound: 'glass', friction: 0.98, drops: null, cat: 'nature' });
def('packed_ice', '坚冰', { tex: 'packed_ice', hardness: 0.5, tool: 'pickaxe', sound: 'glass', friction: 0.98, cat: 'nature' });
def('obsidian', '黑曜岩', stoneLike({ tex: 'obsidian', hardness: 50, level: 4, cat: 'nature' }));
def('magma', '熔岩石', stoneLike({ tex: 'magma', hardness: 0.5, light: [9, 4, 1], damage: 1, cat: 'nature' }));
def('mycel', '菌毯', dirtLike({ tex: { top: 'mycel_top', bottom: 'deepstone', side: 'mycel_side' }, drops: 'deep_cobble', hardness: 1.2, tool: 'pickaxe', cat: 'nature' }));
def('moss', '苔藓块', dirtLike({ tex: 'moss', sound: 'grass', hardness: 0.2, tool: 'hoe', cat: 'nature' }));
def('pale_soil', '白晶土', dirtLike({ tex: { top: 'pale_top', bottom: 'pale_soil', side: 'pale_side' }, drops: 'pale_soil', cat: 'nature' }));
def('mud', '淤泥', dirtLike({ tex: 'mud', sound: 'gravel', speed: 0.75, cat: 'nature' }));

// ores
def('coal_ore', '煤矿石', stoneLike({ tex: 'coal_ore', hardness: 3, drops: { item: 'coal', n: 1 }, cat: 'ore' }));
def('copper_ore', '铜矿石', stoneLike({ tex: 'copper_ore', hardness: 3, level: 1, drops: { item: 'raw_copper', n: [1, 3] }, cat: 'ore' }));
def('iron_ore', '铁矿石', stoneLike({ tex: 'iron_ore', hardness: 3, level: 1, drops: { item: 'raw_iron', n: 1 }, cat: 'ore' }));
def('gold_ore', '金矿石', stoneLike({ tex: 'deep_gold_ore', hardness: 4, level: 3, drops: { item: 'raw_gold', n: 1 }, cat: 'ore' }));
def('crystal_ore', '共鸣晶矿', stoneLike({ tex: 'crystal_ore', hardness: 3, level: 2, light: [1, 5, 6], drops: { item: 'crystal_dust', n: [3, 5] }, cat: 'ore' }));
def('deep_crystal_ore', '玄岩共鸣晶矿', stoneLike({ tex: 'deep_crystal_ore', hardness: 4, level: 2, light: [1, 6, 7], drops: { item: 'crystal_dust', n: [4, 6] }, cat: 'ore' }));
def('star_ore', '星辉石矿', stoneLike({ tex: 'star_ore', hardness: 5, level: 3, light: [3, 4, 6], drops: { item: 'stargem', n: 1 }, cat: 'ore' }));
def('deep_iron_ore', '玄岩铁矿', stoneLike({ tex: 'deep_iron_ore', hardness: 4, level: 1, drops: { item: 'raw_iron', n: [1, 2] }, cat: 'ore' }));
def('meteor_rock', '陨石', stoneLike({ tex: 'meteor_rock', hardness: 4, level: 1, cat: 'ore' }));
def('meteor_ore', '陨铁矿', stoneLike({ tex: 'meteor_ore', hardness: 6, level: 4, light: [6, 3, 2], drops: { item: 'raw_meteor', n: 1 }, cat: 'ore' }));
def('star_core', '星核', { tex: 'star_core', hardness: 4, tool: 'pickaxe', level: 3, sound: 'crystal', light: [12, 13, 15], drops: { item: 'star_shard', n: [2, 4] }, cat: 'ore' });

// liquids
def('water', '水', { shape: 'liquid', tex: { top: 'water_still', bottom: 'water_still', side: 'water_flow' }, solid: false, opaque: false, layer: L_TRANS, filter: 2, liquid: 1, replaceable: true, hardness: -2, item: false, tint: 3, sound: 'water' });
def('lava', '岩浆', { shape: 'liquid', tex: { top: 'lava_still', bottom: 'lava_still', side: 'lava_flow' }, solid: false, opaque: false, layer: L_OPAQUE, liquid: 2, replaceable: true, hardness: -2, item: false, light: [15, 9, 3], damage: 4, sound: 'lava' });

// ---------------------------------------------------------------- wood
const WOODS = [
  ['oak', '橡木'], ['birch', '白桦'], ['pine', '针杉'], ['blossom', '霞樱'], ['willow', '沼柳'], ['cloud', '云木'],
];
for (const [w, zh] of WOODS) {
  def(`${w}_log`, `${zh}原木`, woodLike({ tex: { top: `${w}_log_top`, bottom: `${w}_log_top`, side: `${w}_log` }, orient: 'axis', cat: 'nature' }));
  def(`${w}_planks`, `${zh}木板`, woodLike({ tex: `${w}_planks` }));
  def(`${w}_leaves`, `${zh}树叶`, { tex: `${w}_leaves`, opaque: false, layer: L_CUTOUT, filter: 1, hardness: 0.2, tool: 'shears', sound: 'plant', tint: w === 'oak' || w === 'willow' ? 2 : 0, flammable: 30, drops: { sapling: `${w}_sapling` }, cat: 'nature', leaves: true });
  def(`${w}_sapling`, `${zh}树苗`, plant({ tex: `${w}_sapling` }));
}
export const WOOD_TYPES = WOODS.map((w) => w[0]);

def('mushroom_stem', '菌柄', woodLike({ tex: { top: 'mush_stem_top', bottom: 'mush_stem_top', side: 'mush_stem' }, hardness: 1, sound: 'cloth', flammable: 0, cat: 'nature' }));
def('glowcap', '荧伞菌盖', { tex: 'glowcap', hardness: 0.6, tool: 'axe', sound: 'cloth', light: [3, 11, 13], cat: 'nature', drops: { item: 'glow_spore', n: [0, 2], extra: 'glowcap' } });
def('ambercap', '琥伞菌盖', { tex: 'ambercap', hardness: 0.6, tool: 'axe', sound: 'cloth', light: [12, 7, 2], cat: 'nature' });

// ---------------------------------------------------------------- plants
def('tall_grass', '草丛', plant({ tex: 'tall_grass', tint: 1, replaceable: true, drops: { seeds: true } }));
def('fern', '蕨', plant({ tex: 'fern', tint: 1, replaceable: true, drops: { seeds: true } }));
def('dawnflower', '晨曦花', plant({ tex: 'dawnflower', drops: 'dawnflower' }));
def('bellbloom', '霞铃花', plant({ tex: 'bellbloom' }));
def('bluestar', '蓝星草', plant({ tex: 'bluestar' }));
def('emberbloom', '火绒花', plant({ tex: 'emberbloom' }));
def('moonlily', '月光百合', plant({ tex: 'moonlily', light: [5, 6, 9] }));
def('dead_bush', '枯灌木', plant({ tex: 'dead_bush', replaceable: true, drops: { item: 'stick', n: [0, 2] } }));
def('reeds', '芦苇', plant({ tex: 'reeds', drops: 'reeds' }));
def('glowshroom', '荧光菇', plant({ tex: 'glowshroom', light: [2, 10, 9], flammable: 0 }));
def('red_mushroom', '赤菇', plant({ tex: 'red_mushroom', flammable: 0 }));
def('berry_bush', '霜莓丛', plant({ tex: 'berry_bush', texAlt: 'berry_bush_ripe', drops: null, flammable: 40 }));
def('cactus', '仙人柱', { shape: 'cactus', tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, opaque: false, layer: L_CUTOUT, hardness: 0.4, sound: 'cloth', damage: 1, cat: 'nature' });
def('lily_pad', '睡莲', { shape: 'flat', tex: 'lily_pad', solid: true, opaque: false, layer: L_CUTOUT, hardness: 0, sound: 'plant', tint: 2, cat: 'nature' });
def('seagrass', '海草', plant({ tex: 'seagrass', replaceable: true, drops: null, water: true }));
def('vines', '藤蔓', { shape: 'vine', tex: 'vines', solid: false, opaque: false, layer: L_CUTOUT, hardness: 0.2, tool: 'shears', sound: 'plant', climb: true, tint: 2, replaceable: true, flammable: 30, cat: 'nature' });
def('crystal_cluster', '回响晶簇', { shape: 'cross', tex: 'crystal_cluster', solid: false, opaque: false, layer: L_CUTOUT, hardness: 1.5, tool: 'pickaxe', sound: 'crystal', light: [10, 5, 15], drops: { item: 'echo_crystal', n: [1, 2] }, cat: 'nature' });
def('crystal_bud', '回响晶芽', { shape: 'cross', tex: 'crystal_bud', solid: false, opaque: false, layer: L_CUTOUT, hardness: 0.5, tool: 'pickaxe', sound: 'crystal', light: [5, 2, 9], drops: null, cat: 'nature' });
def('echo_block', '回响晶块', { tex: 'echo_block', hardness: 1.5, tool: 'pickaxe', sound: 'crystal', light: [6, 3, 10], cat: 'nature' });
def('budding_echo', '萌生回响晶', { tex: 'budding_echo', hardness: 1.5, tool: 'pickaxe', sound: 'crystal', drops: null, light: [4, 2, 7], cat: 'nature' });
def('cobweb', '丝网', plant({ tex: 'cobweb', hardness: 4, tool: 'shears', sound: 'cloth', speed: 0.15, flammable: 0, drops: { item: 'string', n: 1 } }));
def('pale_crystal', '霜晶柱', { tex: 'pale_crystal', hardness: 1.2, tool: 'pickaxe', sound: 'crystal', light: [8, 11, 14], opaque: false, layer: L_TRANS, cat: 'nature' });
def('levistone', '逆重晶', { tex: 'levistone', hardness: 1.0, tool: 'pickaxe', sound: 'crystal', gravity: -1, light: [4, 6, 9], cat: 'special' });
def('cloud_block', '云絮', { tex: 'cloud', opaque: false, layer: L_TRANS, hardness: 0.2, sound: 'cloth', softLanding: true, cat: 'special' });
def('sky_grass', '天穹草地', dirtLike({ tex: { top: 'skygrass_top', bottom: 'dirt', side: 'skygrass_side' }, drops: 'dirt', sound: 'grass', cat: 'nature' }));

// crops (meta = growth stage 0..7)
def('farmland', '耕地', { shape: 'farmland', tex: { top: 'farmland', bottom: 'dirt', side: 'dirt' }, texAlt: { top: 'farmland_wet', bottom: 'dirt', side: 'dirt' }, opaque: false, layer: L_OPAQUE, hardness: 0.6, tool: 'shovel', sound: 'gravel', drops: 'dirt', cat: 'nature' });
def('wheat', '金穗麦', plant({ shape: 'crop', tex: 'wheat_0', extraTex: ['wheat_1', 'wheat_2', 'wheat_3'], item: false, drops: null, crop: { stages: 4, seed: 'wheat_seeds', produce: 'wheat' } }));
def('radish', '月光萝卜', plant({ shape: 'crop', tex: 'radish_0', extraTex: ['radish_1', 'radish_2', 'radish_3'], item: false, drops: null, crop: { stages: 4, seed: 'radish', produce: 'radish' } }));
def('melon_stem', '灯笼瓜藤', plant({ shape: 'crop', tex: 'melon_stem_0', extraTex: ['melon_stem_1', 'melon_stem_2', 'melon_stem_3'], item: false, drops: null, crop: { stages: 4, seed: 'melon_seeds', fruit: 'lantern_melon' } }));
def('lantern_melon', '灯笼瓜', { tex: { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' }, hardness: 1, tool: 'axe', sound: 'wood', light: [13, 9, 3], drops: { item: 'melon_slice', n: [3, 6] }, cat: 'nature' });
def('sunroot', '日薯', plant({ shape: 'crop', tex: 'sunroot_0', extraTex: ['sunroot_1', 'sunroot_2', 'sunroot_3'], item: false, drops: null, crop: { stages: 4, seed: 'sunroot', produce: 'sunroot' } }));

// ---------------------------------------------------------------- building
def('stone_bricks', '石砖', stoneLike({ tex: 'stone_bricks' }));
def('mossy_bricks', '苔石砖', stoneLike({ tex: 'mossy_bricks' }));
def('cracked_bricks', '裂纹石砖', stoneLike({ tex: 'cracked_bricks' }));
def('chiseled_stone', '錾纹石', stoneLike({ tex: 'chiseled_stone' }));
def('deep_bricks', '玄岩砖', stoneLike({ tex: 'deep_bricks', hardness: 3 }));
def('deep_tiles', '玄岩瓦', stoneLike({ tex: 'deep_tiles', hardness: 3 }));
def('polished_stone', '磨制苍石', stoneLike({ tex: 'polished_stone' }));
def('bricks', '红砖', stoneLike({ tex: 'bricks', hardness: 2 }));
def('smooth_sandstone', '平滑砂岩', stoneLike({ tex: 'sandstone_top', hardness: 0.8 }));
def('cut_sandstone', '雕纹砂岩', stoneLike({ tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'cut_sandstone' }, hardness: 0.8 }));
def('glass', '玻璃', { tex: 'glass', opaque: false, layer: L_CUTOUT, hardness: 0.3, sound: 'glass', drops: null });
def('bookshelf', '书架', woodLike({ tex: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' }, hardness: 1.5, drops: { item: 'book', n: 3 } }));
def('thatch', '茅草块', { tex: { top: 'thatch_top', bottom: 'thatch_top', side: 'thatch' }, hardness: 0.5, tool: 'hoe', sound: 'grass', flammable: 60, orient: 'axis' });
def('copper_block', '铜块', stoneLike({ tex: 'copper_block', hardness: 3, level: 1, sound: 'metal', cat: 'material' }));
def('iron_block', '铁块', stoneLike({ tex: 'iron_block', hardness: 5, level: 1, sound: 'metal', cat: 'material' }));
def('gold_block', '金块', stoneLike({ tex: 'gold_block', hardness: 3, level: 3, sound: 'metal', cat: 'material' }));
def('stargem_block', '星辉块', stoneLike({ tex: 'stargem_block', hardness: 5, level: 3, sound: 'metal', light: [6, 8, 12], cat: 'material' }));
def('meteor_block', '星铁块', stoneLike({ tex: 'meteor_block', hardness: 6, level: 4, sound: 'metal', cat: 'material' }));
def('copper_tiles', '铜瓦', stoneLike({ tex: 'copper_tiles', hardness: 3, sound: 'metal' }));
def('lamp_stone', '辉光石', { tex: 'lamp_stone', hardness: 0.5, tool: 'pickaxe', sound: 'glass', light: [15, 14, 10] });

// coloured felt and glass
export const COLORS = [
  ['white', '白', '#e9ecef'], ['silver', '银灰', '#9aa3ad'], ['gray', '灰', '#565d68'], ['black', '黑', '#22252b'],
  ['red', '红', '#c8423b'], ['orange', '橙', '#e58a34'], ['yellow', '黄', '#eac54a'], ['lime', '黄绿', '#8bc34a'],
  ['green', '绿', '#3f8a46'], ['teal', '青', '#2e9e98'], ['sky', '天蓝', '#5cb6e6'], ['blue', '蓝', '#3b5fc0'],
  ['violet', '紫', '#7b4fc4'], ['magenta', '品红', '#b84aa8'], ['pink', '粉', '#ee93b4'], ['brown', '棕', '#7b5236'],
];
for (const [c, zh] of COLORS) def(`felt_${c}`, `${zh}色绒块`, { tex: `felt_${c}`, hardness: 0.8, tool: 'shears', sound: 'cloth', flammable: 30, cat: 'color' });
for (const [c, zh] of COLORS) def(`glaze_${c}`, `${zh}色釉砖`, stoneLike({ tex: `glaze_${c}`, hardness: 1.4, cat: 'color' }));
for (const [c, zh] of COLORS) def(`glass_${c}`, `${zh}色玻璃`, { tex: `glass_${c}`, opaque: false, layer: L_TRANS, hardness: 0.3, sound: 'glass', drops: null, cat: 'color' });

// shaped building pieces (slabs: meta 0 bottom, 1 top, 2 double; stairs: meta = facing | upside<<2)
export const SLAB_OF = Object.create(null);
export const STAIRS_OF = Object.create(null);
for (const [base, zh] of [['cobblestone', '碎石'], ['stone_bricks', '石砖'], ['oak_planks', '橡木'], ['pine_planks', '针杉'], ['birch_planks', '白桦'], ['blossom_planks', '霞樱'], ['bricks', '红砖'], ['smooth_sandstone', '砂岩'], ['deep_bricks', '玄岩砖'], ['polished_stone', '磨制苍石'], ['cloud_planks', '云木']]) {
  const b = BLOCKS[B[base]];
  const tex = b.faces.map((f) => TEXTURE_NAMES[f]);
  const props = { tex, hardness: b.hardness, tool: b.tool, sound: b.sound, flammable: b.flammable, base };
  const s = def(`${base}_slab`, `${zh}台阶`, { ...props, shape: 'slab', opaque: false, layer: L_OPAQUE, orient: 'slab' });
  const t = def(`${base}_stairs`, `${zh}楼梯`, { ...props, shape: 'stairs', opaque: false, layer: L_OPAQUE, orient: 'stairs' });
  SLAB_OF[base] = s; STAIRS_OF[base] = t;
}

def('oak_fence', '橡木栅栏', woodLike({ shape: 'fence', tex: 'oak_planks', opaque: false, layer: L_OPAQUE, cat: 'build' }));
def('stone_wall', '碎石矮墙', stoneLike({ shape: 'fence', tex: 'cobblestone', opaque: false, layer: L_OPAQUE, wall: true }));
def('oak_gate', '橡木栅栏门', woodLike({ shape: 'gate', tex: 'oak_planks', opaque: false, layer: L_OPAQUE, orient: 'facing4', use: 'toggle', cat: 'mech' }));
def('oak_door', '橡木门', woodLike({ shape: 'door', tex: { side: 'oak_door' }, extraTex: ['oak_door_top'], opaque: false, layer: L_CUTOUT, orient: 'door', use: 'toggle', cat: 'mech' }));
def('iron_door', '铁门', stoneLike({ shape: 'door', tex: { side: 'iron_door' }, extraTex: ['iron_door_top'], opaque: false, layer: L_CUTOUT, orient: 'door', hardness: 5, sound: 'metal', cat: 'mech' }));
def('trapdoor', '活板门', woodLike({ shape: 'trapdoor', tex: 'trapdoor', opaque: false, layer: L_CUTOUT, orient: 'trapdoor', use: 'toggle', cat: 'mech' }));
def('ladder', '梯子', woodLike({ shape: 'wallflat', tex: 'ladder', solid: false, opaque: false, layer: L_CUTOUT, orient: 'wall4', climb: true, hardness: 0.4, cat: 'build' }));
def('torch', '火把', { shape: 'torch', tex: 'torch', solid: false, opaque: false, layer: L_CUTOUT, hardness: 0, sound: 'wood', light: [15, 11, 6], orient: 'torch', cat: 'light' });
def('lantern', '提灯', { shape: 'lantern', tex: 'lantern', solid: true, opaque: false, layer: L_CUTOUT, hardness: 1, tool: 'pickaxe', sound: 'metal', light: [15, 12, 7], orient: 'hang', cat: 'light' });
def('crystal_lantern', '晶光提灯', { shape: 'lantern', tex: 'crystal_lantern', solid: true, opaque: false, layer: L_CUTOUT, hardness: 1, tool: 'pickaxe', sound: 'metal', light: [8, 13, 15], orient: 'hang', cat: 'light' });
def('campfire', '营火', { shape: 'campfire', tex: 'campfire_log', extraTex: ['fire'], solid: true, opaque: false, layer: L_CUTOUT, hardness: 2, tool: 'axe', sound: 'wood', light: [15, 10, 5], damage: 1, use: 'campfire', cat: 'light' });
def('fire', '火焰', { shape: 'fire', tex: 'fire', solid: false, opaque: false, layer: L_CUTOUT, hardness: 0, replaceable: true, light: [15, 10, 4], item: false, damage: 1, drops: null });
def('carpet_red', '红色地毯', { shape: 'carpet', tex: 'felt_red', solid: true, opaque: false, layer: L_OPAQUE, hardness: 0.1, sound: 'cloth', flammable: 40, cat: 'color' });
def('carpet_teal', '青色地毯', { shape: 'carpet', tex: 'felt_teal', solid: true, opaque: false, layer: L_OPAQUE, hardness: 0.1, sound: 'cloth', flammable: 40, cat: 'color' });
def('carpet_white', '白色地毯', { shape: 'carpet', tex: 'felt_white', solid: true, opaque: false, layer: L_OPAQUE, hardness: 0.1, sound: 'cloth', flammable: 40, cat: 'color' });
def('flower_pot', '花盆', { shape: 'pot', tex: 'flower_pot', solid: true, opaque: false, layer: L_CUTOUT, hardness: 0, sound: 'stone', cat: 'build' });

// ---------------------------------------------------------------- stations & containers
def('workbench', '工作台', woodLike({ tex: { top: 'workbench_top', bottom: 'oak_planks', side: 'workbench_side', north: 'workbench_front' }, orient: 'facing4', use: 'workbench', cat: 'station' }));
def('furnace', '熔炉', stoneLike({ tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', north: 'furnace_front' }, texAlt: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', north: 'furnace_front_lit' }, hardness: 3.5, orient: 'facing4', use: 'furnace', litLight: [13, 9, 4], cat: 'station' }));
def('chest', '木箱', woodLike({ shape: 'chest', tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', north: 'chest_front' }, opaque: false, layer: L_OPAQUE, orient: 'facing4', use: 'chest', cat: 'station' }));
def('resonator', '共鸣台', stoneLike({ tex: { top: 'resonator_top', bottom: 'deep_tiles', side: 'resonator_side' }, light: [3, 8, 10], hardness: 3, use: 'resonator', cat: 'station' }));
def('anvil_stone', '锻石台', stoneLike({ tex: { top: 'forge_top', bottom: 'deep_tiles', side: 'forge_side' }, hardness: 4, use: 'forge', cat: 'station' }));
def('bed', '睡袋', { shape: 'bed', tex: 'bed_top', extraTex: ['bed_side'], solid: true, opaque: false, layer: L_OPAQUE, hardness: 0.3, sound: 'cloth', orient: 'facing4', use: 'bed', flammable: 30, cat: 'station' });
def('cauldron', '蓄水缸', stoneLike({ shape: 'cauldron', tex: 'cauldron', opaque: false, layer: L_OPAQUE, hardness: 2, sound: 'metal', cat: 'station' }));

// ---------------------------------------------------------------- resonance (signal) machinery
def('wire', '共鸣丝', { shape: 'wire', tex: 'wire', solid: false, opaque: false, layer: L_CUTOUT, hardness: 0, sound: 'crystal', drops: { item: 'crystal_dust', n: 1 }, item: false, cat: 'mech' });
def('lever', '拉杆', { shape: 'lever', tex: 'lever', extraTex: ['cobblestone'], solid: false, opaque: false, layer: L_CUTOUT, hardness: 0.5, sound: 'stone', orient: 'attach', use: 'lever', cat: 'mech' });
def('button', '按钮', { shape: 'button', tex: 'polished_stone', solid: false, opaque: false, layer: L_OPAQUE, hardness: 0.5, sound: 'stone', orient: 'attach', use: 'button', cat: 'mech' });
def('pressure_plate', '压力板', { shape: 'plate', tex: 'polished_stone', solid: false, opaque: false, layer: L_OPAQUE, hardness: 0.5, tool: 'pickaxe', sound: 'stone', cat: 'mech' });
def('power_block', '共鸣晶块', { tex: 'power_block', hardness: 3, tool: 'pickaxe', sound: 'crystal', light: [3, 9, 11], cat: 'mech' });
def('inverter', '反相晶柱', { shape: 'inverter', tex: 'inverter_on', extraTex: ['inverter_off'], solid: false, opaque: false, layer: L_CUTOUT, hardness: 0, sound: 'crystal', light: [3, 10, 12], orient: 'torch', cat: 'mech' });
def('repeater', '节拍器', { shape: 'repeater', tex: 'repeater', extraTex: ['repeater_on', 'polished_stone'], solid: true, opaque: false, layer: L_OPAQUE, hardness: 0, sound: 'stone', orient: 'facing4', use: 'repeater', cat: 'mech' });
def('crystal_lamp', '晶灯', { tex: 'lamp_off', texAlt: 'lamp_on', hardness: 0.3, sound: 'glass', litLight: [12, 14, 15], cat: 'mech' });
def('piston', '推进器', stoneLike({ shape: 'piston', tex: { top: 'piston_top', side: 'piston_side', bottom: 'piston_bottom' }, extraTex: ['piston_inner'], opaque: true, orient: 'facing6', cat: 'mech' }));
def('sticky_piston', '粘性推进器', stoneLike({ shape: 'piston', tex: { top: 'piston_top_sticky', side: 'piston_side', bottom: 'piston_bottom' }, extraTex: ['piston_inner'], opaque: true, orient: 'facing6', cat: 'mech' }));
def('piston_head', '推进头', stoneLike({ shape: 'piston_head', tex: 'piston_top', extraTex: ['piston_top_sticky', 'piston_side'], opaque: false, item: false, drops: null }));
def('observer', '侦测器', stoneLike({ tex: { top: 'observer_top', side: 'observer_side', north: 'observer_face', south: 'observer_back' }, texAlt: { top: 'observer_top', side: 'observer_side', north: 'observer_face', south: 'observer_back_on' }, orient: 'facing6', cat: 'mech' }));
def('daylight_sensor', '日光感应器', woodLike({ shape: 'sensor', tex: { top: 'daylight_top', side: 'daylight_side', bottom: 'oak_planks' }, opaque: false, layer: L_OPAQUE, flammable: 0, use: 'sensor', cat: 'mech' }));
def('note_block', '音晶匣', woodLike({ tex: 'note_block', use: 'note', cat: 'mech' }));
def('blast_barrel', '爆裂桶', { tex: { top: 'barrel_top', bottom: 'barrel_top', side: 'barrel_side' }, hardness: 0, sound: 'cloth', use: 'ignite', flammable: 100, cat: 'mech' });
def('dispenser', '投掷器', stoneLike({ tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', north: 'dispenser_front' }, hardness: 3.5, orient: 'facing6', use: 'chest', cat: 'mech' }));
def('fan', '导风扇', stoneLike({ tex: { top: 'fan_face', side: 'fan_side', bottom: 'fan_back' }, orient: 'facing6', hardness: 2, sound: 'metal', cat: 'mech' }));
def('launch_pad', '弹射板', { shape: 'plate_thick', tex: { top: 'launch_top', side: 'launch_side', bottom: 'polished_stone' }, solid: true, opaque: false, layer: L_OPAQUE, hardness: 1.5, tool: 'pickaxe', sound: 'metal', cat: 'mech' });
def('drill', '掘进机', stoneLike({ tex: { top: 'drill_face', side: 'drill_side', bottom: 'piston_bottom' }, orient: 'facing6', hardness: 3, sound: 'metal', cat: 'mech' }));
def('placer', '放置机', stoneLike({ tex: { top: 'placer_face', side: 'drill_side', bottom: 'piston_bottom' }, orient: 'facing6', hardness: 3, sound: 'metal', use: 'chest', cat: 'mech' }));
def('conveyor', '传送带', { shape: 'conveyor', tex: 'conveyor', extraTex: ['conveyor_side'], solid: true, opaque: false, layer: L_OPAQUE, hardness: 1, tool: 'pickaxe', sound: 'metal', orient: 'facing4', cat: 'mech' });
def('hopper', '漏斗', stoneLike({ shape: 'hopper', tex: 'hopper', extraTex: ['hopper_inside'], opaque: false, layer: L_OPAQUE, hardness: 3, sound: 'metal', use: 'chest', cat: 'mech' }));
def('rail', '轨道', { shape: 'rail', tex: 'rail', extraTex: ['rail_curve'], solid: false, opaque: false, layer: L_CUTOUT, hardness: 0.7, tool: 'pickaxe', sound: 'metal', cat: 'mech' });
def('power_rail', '驱动轨', { shape: 'rail', tex: 'power_rail', extraTex: ['power_rail_on'], solid: false, opaque: false, layer: L_CUTOUT, hardness: 0.7, tool: 'pickaxe', sound: 'metal', cat: 'mech' });
def('bounce_gel', '弹胶块', { tex: 'bounce_gel', opaque: false, layer: L_TRANS, hardness: 0, sound: 'gel', bounce: 0.92, cat: 'special' });
def('speed_rail', '疾风轨', { shape: 'rail', tex: 'speed_rail', solid: false, opaque: false, layer: L_CUTOUT, hardness: 0.7, tool: 'pickaxe', sound: 'metal', cat: 'mech', item: false });

// ---------------------------------------------------------------- ancient / special
def('ancient_bricks', '古织砖', stoneLike({ tex: 'ancient_bricks', hardness: 4, cat: 'ancient' }));
def('ancient_carved', '古织纹石', stoneLike({ tex: 'ancient_carved', hardness: 4, cat: 'ancient' }));
def('ancient_gold', '鎏金古砖', stoneLike({ tex: 'ancient_gold', hardness: 4, cat: 'ancient' }));
def('ancient_lamp', '古织灯', stoneLike({ tex: 'ancient_lamp', light: [6, 15, 12], hardness: 3, cat: 'ancient' }));
def('ancient_pillar', '古织柱', stoneLike({ tex: { top: 'ancient_pillar_top', bottom: 'ancient_pillar_top', side: 'ancient_pillar' }, orient: 'axis', hardness: 4, cat: 'ancient' }));
def('seal_door', '织印石门', stoneLike({ tex: 'seal_door', hardness: -1, cat: 'ancient', item: false }));
def('rune_pedestal', '符文基座', stoneLike({ shape: 'pedestal', tex: { top: 'pedestal_top', side: 'pedestal_side', bottom: 'ancient_bricks' }, texAlt: { top: 'pedestal_top_on', side: 'pedestal_side', bottom: 'ancient_bricks' }, opaque: false, layer: L_OPAQUE, hardness: -1, use: 'pedestal', cat: 'ancient', item: false }));
def('waystone', '回响石碑', stoneLike({ shape: 'waystone', tex: { top: 'waystone_top', side: 'waystone', bottom: 'ancient_bricks' }, texAlt: { top: 'waystone_top', side: 'waystone_on', bottom: 'ancient_bricks' }, opaque: false, layer: L_OPAQUE, hardness: 6, level: 1, light: [4, 9, 12], use: 'waystone', cat: 'ancient' }));
def('heart_altar', '织心祭坛', stoneLike({ shape: 'altar', tex: { top: 'altar_top', side: 'altar_side', bottom: 'ancient_bricks' }, opaque: false, layer: L_OPAQUE, hardness: -1, light: [10, 8, 14], use: 'altar', cat: 'ancient', item: false }));
def('gloom_nest', '暗影巢', stoneLike({ tex: 'gloom_nest', opaque: false, layer: L_CUTOUT, hardness: 5, drops: null, cat: 'ancient', item: false }));
def('loot_urn', '古陶罐', { shape: 'urn', tex: { top: 'urn_top', side: 'urn_side', bottom: 'urn_top' }, solid: true, opaque: false, layer: L_OPAQUE, hardness: 0.2, sound: 'glass', drops: { loot: 'urn' }, cat: 'ancient' });

// ---------------------------------------------------------------- derived lookups
export const LIGHT_PASS = new Uint8Array(MAX_BLOCKS); // 1 if light can enter the cell at all
for (let i = 0; i < BLOCKS.length; i++) LIGHT_PASS[i] = OPAQUE[i] ? 0 : 1;
// Some non-cube shapes still block light completely (pistons are opaque anyway)

export const BLOCK_COUNT = BLOCKS.length;

export function blockByName(name) {
  const id = B[name];
  if (id === undefined) throw new Error(`unknown block ${name}`);
  return id;
}

export const emitR = (id) => EMIT[id] >> 8;
export const emitG = (id) => (EMIT[id] >> 4) & 15;
export const emitB = (id) => EMIT[id] & 15;

// Emission can depend on state (lit furnace, powered lamp, inverter off).
export function emissionOf(v) {
  const id = v & ID_MASK;
  const d = BLOCKS[id];
  if (d.litLight) {
    const m = v >>> ID_BITS;
    if (id === B.furnace) return (m & 4) ? packRGB(d.litLight) : 0;
    return (m & 1) ? packRGB(d.litLight) : 0;
  }
  if (id === B.inverter) return ((v >>> ID_BITS) & 8) ? 0 : EMIT[id];
  if (id === B.campfire && ((v >>> ID_BITS) & 8)) return 0;
  return EMIT[id];
}
export const packRGB = (c) => (c[0] << 8) | (c[1] << 4) | c[2];

export const isAir = (v) => (v & ID_MASK) === 0;

// Textures that carry a per-pixel glow mask in their alpha channel (alpha 128..250 = emissive).
export const GLOW_TEX = new Set([
  'crystal_ore', 'deep_crystal_ore', 'star_ore', 'meteor_ore', 'magma', 'budding_echo', 'resonator_top', 'resonator_side',
  'waystone_on', 'pedestal_top_on', 'altar_side', 'altar_top', 'gloom_nest', 'furnace_front_lit', 'mycel_top', 'pale_top',
  'ancient_carved', 'seal_door', 'star_core', 'meteor_block', 'observer_back_on', 'daylight_top', 'skygrass_top', 'lava_still', 'lava_flow',
  'campfire_log', 'drill_face', 'launch_top', 'stargem_block', 'power_block', 'lamp_on', 'echo_block', 'levistone',
]);
