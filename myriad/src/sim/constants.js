// Enumerations and static tables shared by the whole simulation.

export const TICKS_PER_YEAR = 4; // one tick is one season
export const SEASONS = ['春', '夏', '秋', '冬'];
export const KM_PER_UNIT = 6; // elevation is stored in [-1, 1]; 1 unit = 6000 m

// ---- biomes --------------------------------------------------------------------------------------
export const B = {
  DEEP: 0, OCEAN: 1, SHALLOW: 2, REEF: 3, LAKE: 4,
  ICE: 5, TUNDRA: 6, TAIGA: 7, FOREST: 8, GRASS: 9, SHRUB: 10, DESERT: 11,
  SAVANNA: 12, JUNGLE: 13, SWAMP: 14, MOUNTAIN: 15, SNOWPEAK: 16, BEACH: 17,
  VOLCANIC: 18, WASTE: 19,
};

// name, base colour (rgb), forested?, food value for foragers/farmers, movement cost
export const BIOMES = [
  { name: '深海', color: [16, 38, 78], food: 0, move: 9, water: true },
  { name: '海洋', color: [26, 64, 116], food: 0, move: 8, water: true },
  { name: '浅海', color: [42, 104, 150], food: 0, move: 6, water: true },
  { name: '珊瑚礁', color: [48, 150, 168], food: 0, move: 6, water: true },
  { name: '湖泊', color: [52, 112, 158], food: 0, move: 6, water: true },
  { name: '冰原', color: [226, 236, 244], food: 0.02, move: 3.5 },
  { name: '冻原', color: [146, 152, 128], food: 0.25, move: 1.6 },
  { name: '针叶林', color: [46, 92, 66], food: 0.5, move: 1.8, forest: true },
  { name: '温带林', color: [62, 118, 52], food: 0.75, move: 1.7, forest: true },
  { name: '草原', color: [128, 160, 72], food: 1.0, move: 1.0 },
  { name: '灌丛', color: [146, 146, 82], food: 0.55, move: 1.2 },
  { name: '沙漠', color: [214, 190, 130], food: 0.08, move: 1.6 },
  { name: '稀树草原', color: [170, 166, 76], food: 0.85, move: 1.1 },
  { name: '雨林', color: [30, 104, 44], food: 0.7, move: 2.4, forest: true },
  { name: '沼泽', color: [70, 98, 70], food: 0.5, move: 2.6 },
  { name: '山地', color: [122, 110, 98], food: 0.18, move: 3.2 },
  { name: '雪峰', color: [236, 240, 246], food: 0.02, move: 4.5 },
  { name: '海滩', color: [222, 206, 156], food: 0.4, move: 1.1 },
  { name: '火山岩', color: [58, 50, 50], food: 0.05, move: 2.2 },
  { name: '焦土', color: [92, 84, 70], food: 0.05, move: 1.5 },
];

export const isWaterBiome = (b) => b <= B.LAKE;

// ---- resources -----------------------------------------------------------------------------------
export const R = { NONE: 0, COPPER: 1, IRON: 2, GOLD: 3, GEMS: 4, COAL: 5, OIL: 6, URANIUM: 7, FISH: 8, SPICE: 9, MARBLE: 10, HORSE: 11 };
export const RESOURCES = [
  { name: '无', color: [0, 0, 0] },
  { name: '铜矿', color: [214, 120, 60], strategic: true },
  { name: '铁矿', color: [150, 150, 170], strategic: true },
  { name: '金矿', color: [250, 210, 60], luxury: true },
  { name: '宝石', color: [200, 90, 230], luxury: true },
  { name: '煤炭', color: [40, 40, 40], strategic: true },
  { name: '石油', color: [20, 20, 30], strategic: true },
  { name: '铀矿', color: [120, 240, 90], strategic: true },
  { name: '鱼群', color: [180, 220, 255], food: true },
  { name: '香料', color: [230, 120, 80], luxury: true },
  { name: '石材', color: [230, 226, 214] },
  { name: '野马', color: [160, 110, 70] },
];

// ---- tile improvements ---------------------------------------------------------------------------
export const IMP = { NONE: 0, FARM: 1, PASTURE: 2, MINE: 3, URBAN: 4, RUIN: 5, WELL: 6, SOLAR: 7, CRATER: 8 };
export const IMPROVEMENTS = ['无', '农田', '牧场', '矿场', '城区', '遗迹', '油井', '光伏阵列', '陨坑'];

// ---- genes ---------------------------------------------------------------------------------------
export const GENES = [
  'size', 'speed', 'diet', 'warmth', 'habitat', 'fertility', 'longevity', 'sense',
  'intellect', 'social', 'aggression', 'armor', 'flight', 'hue', 'pattern',
];
export const G = Object.fromEntries(GENES.map((g, i) => [g, i]));
export const NG = GENES.length;
export const GENE_LABELS = {
  size: '体型', speed: '速度', diet: '食性', warmth: '耐热', habitat: '陆栖度', fertility: '繁殖力',
  longevity: '寿命', sense: '感知', intellect: '智力', social: '群居性', aggression: '攻击性',
  armor: '护甲', flight: '飞行', hue: '体色', pattern: '花纹',
};
