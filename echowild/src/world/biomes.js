// Biome table. Colours are the tints multiplied onto gray texture pixels (grass, foliage, water).

export const BIOMES = [];
export const BI = Object.create(null);

function biome(key, zh, o) {
  const id = BIOMES.length;
  const b = {
    id, key, zh,
    grass: '#6fb35a', foliage: '#5aa548', water: '#3f86c8',
    temp: 0.6, rain: true, snow: false,
    fog: null, sky: null,
    desc: '',
    ...o,
  };
  b.grassRGB = rgb(b.grass); b.foliageRGB = rgb(b.foliage); b.waterRGB = rgb(b.water);
  BIOMES.push(b);
  BI[key] = id;
  return id;
}
function rgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

biome('ocean', '澄蓝深海', { water: '#2f6fc0', desc: '辽阔的海洋，海底长着海草，偶尔能找到沉没的古迹。' });
biome('beach', '金沙海岸', { grass: '#86b85e', desc: '温暖的沙滩，海浪拍岸。' });
biome('meadow', '和风草甸', { grass: '#79c05a', foliage: '#64b04c', desc: '起伏的草原与野花，适合安家的地方。' });
biome('forest', '翠语森林', { grass: '#5fae4e', foliage: '#4f9c40', desc: '橡树与白桦交织的森林，林间藏着古代遗迹。' });
biome('blossom', '霞樱林', { grass: '#8cc46a', foliage: '#7cb85a', desc: '粉色的霞樱终年盛开，花瓣随风飘落。' });
biome('swamp', '萤火沼泽', { grass: '#6a8a42', foliage: '#5a7a34', water: '#4a6a4a', fog: '#7a8a6a', desc: '低洼湿地，沼柳垂枝；夜晚会有萤火虫飞舞。' });
biome('desert', '流金沙海', { grass: '#b5b25e', foliage: '#a8a854', temp: 1.0, rain: false, fog: '#e8d8b0', desc: '炎热干燥的沙漠，沙海之下埋着方尖碑的秘密。' });
biome('mesa', '赤岩峡谷', { grass: '#a0a050', foliage: '#94944a', temp: 0.95, rain: false, fog: '#e0b090', desc: '层层赤陶土构成的峡谷与台地。' });
biome('tundra', '霜原', { grass: '#88b0a0', foliage: '#6a9a80', water: '#3a78c0', temp: 0.0, snow: true, desc: '寒冷的雪原，针杉稀疏，湖面结冰。' });
biome('taiga', '霜杉林', { grass: '#6a9a7a', foliage: '#4a7a5a', water: '#3a78c0', temp: 0.15, snow: true, desc: '高大的针杉覆盖着积雪。' });
biome('mountains', '苍岩山脉', { grass: '#6a9e6a', foliage: '#5a8e5a', temp: 0.3, desc: '高耸的山峰，峰顶终年积雪。' });
biome('barrens', '霜晶荒原', { grass: '#a8c0c8', foliage: '#9ab0c0', water: '#5aa8d8', temp: 0.2, snow: false, fog: '#c8d8e8', sky: '#b8d0f0', desc: '苍白的大地上生长着发光的霜晶柱，夜晚宛如星海。' });
biome('river', '清溪', { water: '#3f86c8', desc: '蜿蜒的河流。' });
biome('sky', '浮空群岛', { grass: '#6fd0a0', foliage: '#bcd8f2', temp: 0.5, desc: '悬浮在云端的岛屿，由逆重晶托起。' });
biome('underworld', '幽光深层', { grass: '#4a6a7a', foliage: '#3a8a9a', water: '#2a5a8a', temp: 0.7, rain: false, fog: '#1a2030', desc: '世界深处的巨大洞穴，荧光菌林与熔岩湖。' });
biome('frozen_ocean', '冰封之海', { water: '#3a68b0', temp: 0.0, snow: true, desc: '寒冷的海面上漂浮着浮冰。' });
