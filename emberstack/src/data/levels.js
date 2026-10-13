// The campaign: seven chapters, each a different land with its own rules, threats and goals.
// Positions in `at` are fractions of the board; everything else is laid out automatically.

import { CARDS } from './cards.js';

export const CHAPTERS = [];
export const LEVELS = Object.create(null);

function chapter(id, name, en, biome, desc, color) {
  CHAPTERS.push({ id, name, en, biome, desc, color, levels: [] });
}
function level(ch, l) {
  const c = CHAPTERS.find((x) => x.id === ch);
  const id = `${ch}-${c.levels.length + 1}`;
  const L = { id, chapter: ch, biome: c.biome, board: [2400, 1700], stars: [], lose: [], schedule: [], ...l };
  // the land must be able to feed the camp: top up thin maps with food sources fitting the biome
  if (ch >= 2 && L.forage !== false) {
    const pop = L.start.filter((e) => CARDS[e.c].kind === 'folk').reduce((a, e) => a + (e.n || 1), 0);
    const perDay = (id) => {
      const nd = CARDS[id].node;
      const f = nd.out.reduce((a, [o, k]) => a + (CARDS[o].food || 0) * k * (CARDS[o].tags.includes('raw') ? 2 : 1), 0);
      const sm = L.rules?.seasons === false ? nd.season?.[L.rules?.season ?? 1] ?? 1 : 1;
      return (nd.charges < 0 ? (72 / nd.t) * f : nd.perennial ? (nd.regen || 1) * f : 0) * sm;
    };
    let sustain = 0;
    for (const e of L.start) if (CARDS[e.c].node) sustain += perDay(e.c) * (e.n || 1);
    const pool = { valley: ['berry_bush', 'pond', 'wild_wheat'], forest: ['berry_bush', 'mushroom_ring', 'pond'], marsh: ['pond', 'mushroom_ring', 'berry_bush'],
      mountain: ['berry_bush', 'pond', 'wild_wheat'], tundra: ['pond', 'mushroom_ring'], isles: ['tidepool', 'pond', 'berry_bush'], ash: ['mushroom_ring', 'pond'] }[L.biome] || ['berry_bush', 'pond'];
    let i = 0;
    const add = {};
    while (sustain < pop * 2 * 1.35 && i < 12) {
      const id = pool[i % pool.length];
      const v = perDay(id);
      i++;
      if (v <= 0) continue;
      add[id] = (add[id] || 0) + 1;
      sustain += v;
    }
    for (const [c, n] of Object.entries(add)) L.start.push({ c, n });
  }
  // provisions: every camp from chapter 2 on starts with about a day of preserved food
  if (ch >= 2 && L.provisions !== false) {
    const pop = L.start.filter((e) => CARDS[e.c].kind === 'folk').reduce((a, e) => a + (e.n || 1), 0);
    const food = L.start.filter((e) => CARDS[e.c].food > 0).reduce((a, e) => a + (e.n || 1) * CARDS[e.c].food, 0);
    if (food < pop * 2) L.start.push({ c: 'jerky', n: Math.ceil((pop * 2 - food) / 2) });
  }
  LEVELS[id] = L;
  c.levels.push(id);
  return L;
}

const E1 = ['stone_tools', 'shelter', 'cooking', 'fishing', 'hunting', 'torches', 'lore'];

// ================================================================== chapter 1 · 余烬 ================
chapter(1, '余烬', 'EMBERS', 'valley', '灰雾退去后的第一个河谷。学会生火、觅食、熬过黑夜。', '#e8894a');

level(1, {
  name: '第一缕火', sub: '教程 · 采集与生火',
  intro: [
    '灰雾吞没世界已经很多年了。',
    '你带着两个幸存者走进一片河谷。这里有树、有石头、有浆果——还有一点点希望。',
    '先生起一堆火。有了火，才有了家。',
  ],
  outro: '火光照亮了河谷。远处的灰雾似乎退后了一步。',
  techs: [], techAllowed: ['stone_tools', 'shelter', 'cooking', 'lore'],
  start: [
    { c: 'survivor', n: 2 }, { c: 'tree', n: 3 }, { c: 'rock', n: 2 }, { c: 'berry_bush', n: 2 },
    { c: 'tall_grass', n: 2 }, { c: 'flint', n: 1 }, { c: 'berry', n: 3 },
  ],
  objectives: [
    { type: 'build', card: 'campfire' },
    { type: 'build', card: 'lean_to' },
    { type: 'pop', n: 3 },
  ],
  stars: [{ type: 'days', lte: 5 }, { type: 'nodeath' }],
  rules: { eventRate: 0.15, events: ['wanderer', 'cache', 'festival_mood'], seasons: false, season: 1 },
  tutorial: 'basics',
});

level(1, {
  name: '河畔', sub: '捕鱼、烹饪与人口',
  intro: [
    '河水里有鱼。烤熟的鱼比生鱼顶饿一倍。',
    '营地需要更多的人手——而人，需要吃饭。',
  ],
  outro: '河畔的营地热闹起来了。孩子们在火边追逐。',
  techs: ['stone_tools', 'shelter'], techAllowed: E1,
  start: [
    { c: 'survivor', n: 3 }, { c: 'campfire', fuel: 4 }, { c: 'river', at: [0.5, 0.86] }, { c: 'tree', n: 3 },
    { c: 'rock', n: 2 }, { c: 'berry_bush', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'wood', n: 2 }, { c: 'valley_depths' },
  ],
  objectives: [
    { type: 'pop', n: 6 },
    { type: 'made', card: 'cooked_fish', n: 6 },
    { type: 'build', card: 'lean_to', n: 2 },
  ],
  stars: [{ type: 'days', lte: 8 }, { type: 'nodeath' }],
  rules: { eventRate: 0.25, seasons: false, season: 1 },
  tutorial: 'river',
});

level(1, {
  name: '长夜', sub: '灰雾、暗影与光',
  intro: [
    '入夜之后，灰雾里会走出东西。',
    '它们畏惧光。让每个人都待在火光里——或者把光带到他们身边。',
    '灰雾每天都在变浓。如果它涨满，营地就会被吞没。立起灯龛可以让它退散。',
  ],
  outro: '第六个黎明到来时，暗影在晨光中化作灰烬。人们第一次觉得，夜晚是可以熬过去的。',
  techs: ['stone_tools', 'shelter', 'cooking'], techAllowed: E1,
  start: [
    { c: 'survivor', n: 3 }, { c: 'campfire', fuel: 4 }, { c: 'tree', n: 3 }, { c: 'rock', n: 2 }, { c: 'berry_bush', n: 2 },
    { c: 'tall_grass', n: 2 }, { c: 'river', at: [0.3, 0.85] }, { c: 'lean_to' }, { c: 'wood', n: 2 }, { c: 'old_ruins' },
  ],
  objectives: [
    { type: 'survive', days: 6 },
    { type: 'build', card: 'shrine', n: 1 },
    { type: 'fog', below: 40 },
  ],
  lose: [{ type: 'fog' }],
  stars: [{ type: 'nodeath' }, { type: 'fog', below: 50 }],
  rules: { shades: true, shadeBase: 1, fog0: 20, fogRate: 3, eventRate: 0.25, seasons: false, season: 2 },
  tutorial: 'night',
});

level(1, {
  name: '狼嚎', sub: '战斗与头狼',
  intro: [
    '河谷的上游住着一群狼，领头的是一匹灰白的巨狼。',
    '它们每隔几夜就会来营地边转一圈。木矛、木棒，还有更多的人手——准备好之后，去狼窝终结这一切。',
  ],
  outro: '头狼倒下了。它厚重的皮毛也许还能派上用场……',
  techs: ['stone_tools', 'shelter', 'cooking', 'hunting'], techAllowed: E1,
  start: [
    { c: 'survivor', n: 4 }, { c: 'campfire', fuel: 4 }, { c: 'lean_to' }, { c: 'tree', n: 3 }, { c: 'rock', n: 3 }, { c: 'club', n: 2 },
    { c: 'berry_bush', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'river', at: [0.62, 0.88] }, { c: 'flint', n: 2 },
    { c: 'deer', n: 2 }, { c: 'rabbit', n: 2 }, { c: 'valley_depths' },
    { c: 'alpha_wolf', at: [0.88, 0.14], wake: false },
  ],
  objectives: [{ type: 'kill', card: 'alpha_wolf' }],
  stars: [{ type: 'days', lte: 9 }, { type: 'nodeath' }],
  schedule: [
    { day: 2, at: 'night', spawn: [['wolf', 2]], msg: '狼群在夜色中逼近！', warn: '第 2 夜：狼群' },
    { day: 4, at: 'night', spawn: [['wolf', 3]], msg: '狼群又来了！', warn: '第 4 夜：狼群' },
    { day: 7, at: 'night', spawn: [['wolf', 3]], msg: '狼群又来了！', warn: '第 7 夜：狼群' },
    { day: 9, wake: 'alpha_wolf', msg: '头狼亲自下山了！', warn: '第 9 天：头狼来袭' },
  ],
  rules: { eventRate: 0.25, seasons: false, season: 2, events: ['wanderer', 'cache', 'migration', 'festival_mood', 'scholar_visit'] },
});


const ERA1 = ['stone_tools', 'shelter', 'cooking', 'fishing', 'hunting', 'torches', 'lore'];
const ERA2 = ['farming', 'pottery', 'weaving', 'herbalism', 'carpentry', 'husbandry', 'archery', 'storage'];
const ERA3 = ['masonry', 'mining', 'smelting', 'bronze', 'trade', 'writing', 'milling', 'curing'];
const ERA4 = ['iron', 'fortification', 'medicine', 'sailing', 'lamplight', 'tactics', 'mathematics', 'horsemanship', 'shadowcraft'];
const ERA5 = ['philosophy', 'astronomy', 'glassmaking', 'architecture', 'alchemy', 'navigation', 'civics', 'banking'];

// ================================================================== chapter 2 · 林海 ================
chapter(2, '林海', 'VERDANT DEEP', 'forest', '无边的古林。学会耕作与储藏，熬过第一个冬天，然后面对林海深处的东西。', '#7fae5a');

level(2, {
  name: '林间空地', sub: '农耕、季节与第一个冬天',
  intro: [
    '林海边缘有一片空地，土壤松软。',
    '这里有四季。冬天来临时，浆果丛会休眠，篝火要烧双倍的柴，人们也会更饿。',
    '开垦田地，建起谷仓，在第一场雪之前备好粮食。',
  ],
  outro: '春天回来了。田埂上冒出了新芽。',
  techs: ERA1, techAllowed: { maxEra: 2 },
  start: [
    { c: 'survivor', n: 4 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to' }, { c: 'tree', n: 4 }, { c: 'pine', n: 2 }, { c: 'rock', n: 2 },
    { c: 'berry_bush', n: 3 }, { c: 'wild_wheat', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'pond' }, { c: 'herb_patch' },
    { c: 'grain', n: 2 }, { c: 'deer' }, { c: 'fowl' }, { c: 'deep_forest' },
  ],
  objectives: [{ type: 'survive', days: 10 }, { type: 'pop', n: 5 }, { type: 'build', card: 'field' }],
  stars: [{ type: 'nodeath' }, { type: 'pop', n: 7 }],
  rules: { seasons: true, seasonDays: 3, startSeason: 1, eventRate: 0.3 },
});

level(2, {
  name: '药师', sub: '草药、疫病与医者',
  intro: [
    '营地里有人开始咳嗽。森林里长着能治病的草，但需要懂行的人。',
    '采集草药，烧制陶罐，熬出疗伤药——再培养一位医者。',
  ],
  outro: '热退了。医者的药囊成了营地里最珍贵的东西。',
  techs: [...ERA1, 'pottery'], techAllowed: { maxEra: 2 },
  start: [
    { c: 'survivor', n: 5 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 2 }, { c: 'tree', n: 3 }, { c: 'rock', n: 2 },
    { c: 'herb_patch', n: 2 }, { c: 'clay_pit' }, { c: 'berry_bush', n: 2 }, { c: 'pond' }, { c: 'tall_grass', n: 2 },
    { c: 'mushroom_ring' }, { c: 'deep_forest' },
  ],
  objectives: [{ type: 'made', card: 'potion', n: 3 }, { type: 'have', card: 'healer', n: 1 }, { type: 'pop', n: 6 }],
  stars: [{ type: 'days', lte: 9 }, { type: 'nodeath' }],
  schedule: [
    { day: 3, event: 'plague', warn: '第 3 天：疫病' },
    { day: 7, event: 'plague', warn: '第 7 天：疫病' },
  ],
  rules: { seasons: true, seasonDays: 4, startSeason: 0, eventRate: 0.25 },
});

level(2, {
  name: '迷雾林', sub: '探索、斥候与失散的族人',
  intro: [
    '大雾里走散了几个族人。他们一定还在幽林深处。',
    '派人去探索——但林中有狼和野猪，夜里还有暗影。',
  ],
  outro: '失散的人们循着火光回来了。营地从未如此热闹。',
  techs: [...ERA1, 'weaving'], techAllowed: { maxEra: 2 },
  start: [
    { c: 'survivor', n: 4 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 2 }, { c: 'tree', n: 3 }, { c: 'pine', n: 1 }, { c: 'rock', n: 2 },
    { c: 'berry_bush', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'pond' }, { c: 'map' }, { c: 'club', n: 2 },
    { c: 'deep_forest', ch: 9, once: ['survivor'] }, { c: 'deep_forest', ch: 9, once: ['scroll', 'survivor'] }, { c: 'wolf_trail' },
  ],
  objectives: [{ type: 'explore', n: 18 }, { type: 'pop', n: 10 }],
  stars: [{ type: 'days', lte: 10 }, { type: 'nodeath' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, shades: true, shadeBase: 0, fog0: 15, fogRate: 2, eventRate: 0.3 },
});

level(2, {
  name: '古树之心', sub: 'Boss · 腐根兽',
  intro: [
    '林海最深处有一棵枯死的古树，它的根正在腐烂、蠕动。',
    '腐根兽有坚硬的树皮：矛与箭只能刮出浅痕，钝器才能把它砸开。',
    '它沉睡着——但第 12 天，它会醒来。',
  ],
  outro: '腐根兽倒下了，裂开的树皮里有一截仍然温热的心木。',
  techs: [...ERA1, 'farming', 'pottery', 'weaving', 'carpentry'], techAllowed: { maxEra: 2 },
  start: [
    { c: 'survivor', n: 5 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 2 }, { c: 'tree', n: 4 }, { c: 'rock', n: 3 }, { c: 'old_oak' },
    { c: 'berry_bush', n: 3 }, { c: 'tall_grass', n: 2 }, { c: 'pond' }, { c: 'wild_wheat', n: 2 }, { c: 'herb_patch' }, { c: 'boar' }, { c: 'deer' },
    { c: 'deep_forest' }, { c: 'rotroot', at: [0.86, 0.18], wake: false },
  ],
  objectives: [{ type: 'kill', card: 'rotroot' }],
  stars: [{ type: 'days', lte: 12 }, { type: 'nodeath' }],
  schedule: [
    { day: 6, at: 'night', spawn: [['wolf', 2]], warn: '第 6 夜：狼群' },
    { day: 12, wake: 'rotroot', msg: '腐根兽醒了，拖着根须向营地爬来！', warn: '第 12 天：腐根兽苏醒' },
  ],
  rules: { seasons: true, seasonDays: 4, startSeason: 0, eventRate: 0.3 },
});

// ================================================================== chapter 3 · 盐沼 ================
chapter(3, '盐沼', 'SALT MIRE', 'marsh', '泥泞的盐沼。黏土、盐与芦苇——还有洪水、沼鳄和来往的商队。', '#5aa7a0');

level(3, {
  name: '盐与陶', sub: '集市与铜贝',
  intro: [
    '盐沼里没有多少吃的，却有取之不尽的黏土和盐。',
    '烧砖、腌鱼、织布，把它们拿到集市上换成铜贝。',
  ],
  outro: '营地的集市有了名气，远方的商人开始专程绕道而来。',
  techs: [...ERA1, 'pottery', 'weaving', 'carpentry'], techAllowed: { maxEra: 3, not: ['mining', 'smelting', 'bronze', 'milling'] },
  start: [
    { c: 'survivor', n: 5 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 2 }, { c: 'clay_pit', n: 2 }, { c: 'salt_flat', n: 2 },
    { c: 'reed_bed', n: 2 }, { c: 'tree', n: 4 }, { c: 'rock', n: 2 }, { c: 'pond', n: 2 }, { c: 'berry_bush', n: 2 }, { c: 'tall_grass', n: 2 },
    { c: 'mushroom_ring' }, { c: 'wild_wheat' }, { c: 'fowl', n: 2 }, { c: 'marsh_depths' },
  ],
  objectives: [{ type: 'build', card: 'market' }, { type: 'coins', n: 25 }],
  stars: [{ type: 'days', lte: 12 }, { type: 'nodeath' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 0, eventRate: 0.3, caravanEvery: 4 },
});

level(3, {
  name: '水患', sub: '洪水与堤坝',
  intro: [
    '每隔几天，河水就会漫过盐沼的低地，卷走一切没有固定的东西。',
    '洪水来临前会有预警。把物资搬到高处，或者筑起堤坝。',
  ],
  outro: '堤坝稳稳地立在水边。这一次，洪水只带走了泥沙。',
  board: [2400, 1800], floodY: 1050, campAt: [0.5, 0.42],
  techs: [...ERA1, 'pottery', 'weaving'], techAllowed: { maxEra: 3, not: ['mining', 'smelting', 'bronze'] },
  start: [
    { c: 'survivor', n: 5 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 2 }, { c: 'clay_pit', n: 2 }, { c: 'reed_bed' }, { c: 'salt_flat' },
    { c: 'tree', n: 4 }, { c: 'rock', n: 3 }, { c: 'river', at: [0.5, 0.92] }, { c: 'berry_bush', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'marsh_depths' },
  ],
  objectives: [{ type: 'build', card: 'dike' }, { type: 'survive', days: 9 }, { type: 'pop', n: 6 }],
  stars: [{ type: 'nodeath' }, { type: 'days', lte: 10 }],
  schedule: [
    { day: 3, event: 'flood_warning', warn: '第 4 天黎明：洪水' },
    { day: 6, event: 'flood_warning', warn: '第 7 天黎明：洪水' },
    { day: 8, event: 'flood_warning', warn: '第 9 天黎明：洪水' },
  ],
  rules: { seasons: true, seasonDays: 4, startSeason: 0, eventRate: 0.25 },
});

level(3, {
  name: '商路', sub: '商队与交易',
  intro: [
    '盐沼的商路重新开通了。商队每隔两天经过一次。',
    '和他们做生意：卖掉多余的货物，买下营地缺少的东西。',
  ],
  outro: '商路上的驼铃声成了营地的日常。',
  techs: [...ERA1, 'pottery', 'weaving', 'trade'], techAllowed: { maxEra: 3, not: ['mining', 'smelting', 'bronze'] },
  start: [
    { c: 'survivor', n: 5 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 2 }, { c: 'clay_pit', n: 2 }, { c: 'salt_flat', n: 2 }, { c: 'reed_bed', n: 2 },
    { c: 'tree', n: 4 }, { c: 'rock', n: 2 }, { c: 'pond', n: 2 }, { c: 'berry_bush', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'coin', n: 6 }, { c: 'mushroom_ring' }, { c: 'fowl', n: 2 }, { c: 'workbench' }, { c: 'marsh_depths' },
  ],
  objectives: [{ type: 'trade', n: 6 }, { type: 'build', card: 'trading_post' }, { type: 'coins', n: 15 }],
  stars: [{ type: 'days', lte: 12 }, { type: 'nodeath' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 0, eventRate: 0.25, caravanEvery: 2 },
});

level(3, {
  name: '沼泽之主', sub: 'Boss · 鳄王',
  intro: [
    '沼鳄在芦苇间游弋。它们的王，比一条船还长。',
    '鳄王披着厚甲，还会唤来成群的水蛭。用钝器，备好护甲。',
  ],
  outro: '鳄王沉入了泥沼。它的牙齿比铁还硬。',
  techs: [...ERA1, 'pottery', 'weaving', 'carpentry', 'husbandry'], techAllowed: { maxEra: 3 },
  start: [
    { c: 'survivor', n: 6 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 3 }, { c: 'clay_pit' }, { c: 'salt_flat' }, { c: 'reed_bed' },
    { c: 'tree', n: 4 }, { c: 'rock', n: 3 }, { c: 'pond', n: 2 }, { c: 'berry_bush', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'fowl', n: 2 },
    { c: 'club', n: 3 }, { c: 'leather_armor', n: 2 }, { c: 'marsh_depths' }, { c: 'croc', at: [0.15, 0.82] }, { c: 'croc_king', at: [0.88, 0.85], wake: false },
  ],
  objectives: [{ type: 'kill', card: 'croc_king' }],
  stars: [{ type: 'days', lte: 14 }, { type: 'nodeath' }],
  schedule: [
    { day: 5, at: 'night', spawn: [['croc', 1], ['leech', 3]], warn: '第 5 夜：沼鳄与水蛭' },
    { day: 9, at: 'night', spawn: [['croc', 2], ['leech', 3]], warn: '第 9 夜：沼鳄与水蛭' },
    { day: 14, wake: 'croc_king', msg: '鳄王从泥沼中浮起，向营地爬来！', warn: '第 14 天：鳄王来袭' },
  ],
  rules: { seasons: true, seasonDays: 4, startSeason: 0, eventRate: 0.25, caravanEvery: 5 },
});

// ================================================================== chapter 4 · 铜铁之山 ============
chapter(4, '铜铁之山', 'IRON CRAGS', 'mountain', '矿脉纵横的群山。采矿、冶炼、锻造——以及占山为王的盗匪。', '#c98a52');

level(4, {
  name: '铜火', sub: '采矿、冶炼与青铜',
  intro: [
    '山里有绿色的矿石和黑色的煤。',
    '挖出矿石，筑起熔炉，炼出青铜。把四块青铜锭献上山顶的古祭坛。',
  ],
  outro: '青铜在祭坛上闪着光。新时代开始了。',
  altar: { bronze: 4 },
  techs: [...ERA1, 'pottery', 'weaving', 'carpentry', 'masonry', 'mining', 'smelting'], techAllowed: { maxEra: 3 },
  start: [
    { c: 'survivor', n: 5 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 2 }, { c: 'tree', n: 4 }, { c: 'pine', n: 2 }, { c: 'rock', n: 3 },
    { c: 'copper_vein', n: 2 }, { c: 'tin_vein' }, { c: 'coal_seam' }, { c: 'clay_pit', n: 2 }, { c: 'berry_bush', n: 2 }, { c: 'goat', n: 2 },
    { c: 'pond' }, { c: 'tall_grass', n: 2 }, { c: 'stone_pick' }, { c: 'kiln' }, { c: 'insight', n: 3 }, { c: 'wild_wheat', n: 2 }, { c: 'quest_altar', at: [0.5, 0.18] }, { c: 'mountain_pass' },
  ],
  objectives: [{ type: 'deliver', card: 'bronze', n: 4 }],
  stars: [{ type: 'days', lte: 12 }, { type: 'nodeath' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, eventRate: 0.25 },
});

level(4, {
  name: '矿坑深处', sub: '永夜之下',
  intro: [
    '营地扎在一座巨大的废弃矿坑里。这里没有白天。',
    '只有火光照到的地方，人们才能干活。立起更多火把桩，再带着火把下到矿井深处去。',
  ],
  outro: '矿井深处的灯一盏接一盏亮起，像地下的星河。',
  techs: [...ERA1, 'pottery', 'weaving', 'carpentry', 'masonry', 'mining'], techAllowed: { maxEra: 3 },
  start: [
    { c: 'survivor', n: 6 }, { c: 'campfire', fuel: 8, at: [0.46, 0.55] }, { c: 'campfire', fuel: 6, at: [0.6, 0.5] }, { c: 'torch_post', fuel: 3, at: [0.53, 0.66] },
    { c: 'lean_to', n: 2 }, { c: 'tree', n: 2 }, { c: 'dead_tree', n: 3 }, { c: 'pine', n: 2 }, { c: 'rock', n: 3 }, { c: 'mushroom_ring', n: 4 },
    { c: 'coal_seam' }, { c: 'copper_vein', n: 2 }, { c: 'pond', n: 2 }, { c: 'tall_grass', n: 3 }, { c: 'wood', n: 8 }, { c: 'coal', n: 4 },
    { c: 'stone_pick' }, { c: 'torch', n: 3 }, { c: 'club', n: 2 }, { c: 'jerky', n: 8 }, { c: 'abandoned_mine', ch: 7 }, { c: 'cave', ch: 6 },
  ],
  objectives: [{ type: 'explore', n: 10 }, { type: 'have', card: 'copper_ore', n: 8 }, { type: 'build', card: 'torch_post', n: 4 }, { type: 'survive', days: 6 }],
  stars: [{ type: 'nodeath' }, { type: 'days', lte: 8 }],
  rules: { seasons: false, season: 1, dark: true, shades: true, shadeBase: 0, shadePerFog: 1 / 15, fog0: 5, fogRate: 1, eventRate: 0.2, events: ['wanderer', 'cache', 'festival_mood', 'scholar_visit'] },
});

level(4, {
  name: '盗匪寨', sub: '劫掠与反击',
  intro: [
    '山口那边有一座匪寨，每隔两天就有盗匪下山来偷铜贝和粮食。',
    '练兵、锻甲，然后端掉它。小心，匪首也在寨子里。',
  ],
  outro: '匪寨烧成了一片灰。山口终于太平了。',
  techs: [...ERA1, 'pottery', 'weaving', 'carpentry', 'masonry', 'mining', 'smelting', 'farming'], techAllowed: { maxEra: 3 },
  start: [
    { c: 'survivor', n: 6 }, { c: 'campfire', fuel: 5 }, { c: 'lean_to', n: 3 }, { c: 'tree', n: 4 }, { c: 'rock', n: 3 }, { c: 'copper_vein', n: 2 },
    { c: 'tin_vein' }, { c: 'coal_seam' }, { c: 'clay_pit' }, { c: 'berry_bush', n: 3 }, { c: 'pond', n: 2 }, { c: 'goat', n: 3 }, { c: 'tall_grass', n: 2 },
    { c: 'wild_wheat', n: 2 }, { c: 'mushroom_ring' }, { c: 'field' }, { c: 'coin', n: 5 }, { c: 'stone_pick' }, { c: 'spear', n: 2 }, { c: 'bandit_trail' },
    { c: 'bandit_camp', at: [0.88, 0.16] }, { c: 'bandit_chief', at: [0.8, 0.1], wake: false },
  ],
  objectives: [{ type: 'kill', card: 'bandit_camp' }, { type: 'kill', card: 'bandit_chief' }],
  stars: [{ type: 'days', lte: 14 }, { type: 'nodeath' }],
  schedule: [{ day: 12, wake: 'bandit_chief', msg: '匪首亲自带人下山了！', warn: '第 12 天：匪首下山' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, eventRate: 0.25, events: ['wanderer', 'cache', 'migration', 'festival_mood', 'tribute', 'old_smith'] },
});

level(4, {
  name: '熔炉巨人', sub: 'Boss · 熔渣巨人',
  intro: [
    '古代的熔炉里，有什么东西醒了。它浑身流淌着熔渣。',
    '近身攻击它的人会被灼伤。弓手能在远处放箭；钝器能砸开它的外壳。',
  ],
  outro: '熔渣巨人冷却成了一堆黑石。它的核心仍在微微跳动。',
  techs: [...ERA1, ...ERA2, 'masonry', 'mining', 'smelting', 'bronze'], techAllowed: { maxEra: 4, not: ['sailing', 'horsemanship'] },
  start: [
    { c: 'survivor', n: 7 }, { c: 'campfire', fuel: 6 }, { c: 'lean_to', n: 2 }, { c: 'cabin' }, { c: 'tree', n: 4 }, { c: 'rock', n: 3 },
    { c: 'copper_vein', n: 2 }, { c: 'tin_vein', n: 2 }, { c: 'iron_vein' }, { c: 'coal_seam', n: 2 }, { c: 'clay_pit' }, { c: 'berry_bush', n: 2 },
    { c: 'wild_wheat', n: 2 }, { c: 'pond', n: 2 }, { c: 'goat', n: 3 }, { c: 'tall_grass', n: 2 }, { c: 'stone_pick', n: 2 }, { c: 'smelter' },
    { c: 'field', n: 2 }, { c: 'mushroom_ring' }, { c: 'kiln' }, { c: 'slag_golem', at: [0.86, 0.2], wake: false },
  ],
  objectives: [{ type: 'kill', card: 'slag_golem' }],
  stars: [{ type: 'days', lte: 16 }, { type: 'nodeath' }],
  schedule: [{ day: 16, wake: 'slag_golem', msg: '熔渣巨人迈着沉重的步子走来！', warn: '第 16 天：熔渣巨人苏醒' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, eventRate: 0.25 },
});

// ================================================================== chapter 5 · 霜原 ================
chapter(5, '霜原', 'FROSTREACH', 'tundra', '永冻的北方。燃料就是生命，毛皮就是铠甲。', '#9cc3dd');

level(5, {
  name: '冻土', sub: '严寒与燃料',
  intro: [
    '这里永远是冬天。每个黎明，不在火光旁、没有毛皮的人都会冻伤。',
    '让火永远燃着。火塘不需要多余的柴，毛皮斗篷能御寒。',
  ],
  outro: '十个黎明过去了，营地的火从未熄灭。',
  techs: [...ERA1, 'pottery', 'weaving', 'husbandry'], techAllowed: { maxEra: 3 },
  start: [
    { c: 'survivor', n: 5 }, { c: 'campfire', fuel: 6 }, { c: 'lean_to', n: 2 }, { c: 'pine', n: 5 }, { c: 'rock', n: 3 }, { c: 'pond', n: 2 },
    { c: 'mushroom_ring', n: 3 }, { c: 'tall_grass', n: 2 }, { c: 'wood', n: 6 }, { c: 'fur', n: 4 }, { c: 'seal', n: 3 }, { c: 'hot_spring' },
    { c: 'jerky', n: 8 }, { c: 'frozen_waste' },
  ],
  objectives: [{ type: 'survive', days: 10 }, { type: 'pop', n: 5 }],
  stars: [{ type: 'nodeath' }, { type: 'pop', n: 7 }],
  rules: { seasons: false, season: 3, cold: 'always', winterAppetite: 1.5, eventRate: 0.25, events: ['wanderer', 'cache', 'migration', 'aurora', 'festival_mood', 'storm'] },
});

level(5, {
  name: '猛犸之路', sub: '大型狩猎',
  intro: [
    '猛犸群每年都会经过这片冰原。一头猛犸够全营吃上好几天。',
    '但它们并不温顺。组织一支狩猎队。',
  ],
  outro: '篝火边堆满了毛皮和象牙。这个冬天不会挨饿了。',
  techs: [...ERA1, 'pottery', 'weaving', 'husbandry', 'carpentry'], techAllowed: { maxEra: 3 },
  start: [
    { c: 'survivor', n: 6 }, { c: 'campfire', fuel: 6 }, { c: 'lean_to', n: 3 }, { c: 'pine', n: 4 }, { c: 'rock', n: 3 }, { c: 'pond' },
    { c: 'tall_grass', n: 2 }, { c: 'wood', n: 4 }, { c: 'spear', n: 2 }, { c: 'mammoth', n: 2 }, { c: 'seal' }, { c: 'frozen_waste' },
  ],
  objectives: [{ type: 'kill', card: 'mammoth', n: 3 }, { type: 'made', card: 'fur_cloak', n: 3 }],
  stars: [{ type: 'nodeath' }, { type: 'days', lte: 10 }],
  schedule: [
    { day: 3, spawn: [['mammoth', 2]], msg: '又一群猛犸出现在冰原上。' },
    { day: 6, spawn: [['mammoth', 2]], msg: '猛犸群又经过了。' },
    { day: 5, at: 'night', spawn: [['frost_wolf', 2]], warn: '第 5 夜：霜狼' },
  ],
  rules: { seasons: true, seasonDays: 3, startSeason: 2, cold: true, eventRate: 0.2, events: ['wanderer', 'cache', 'aurora', 'festival_mood'] },
});

level(5, {
  name: '极光', sub: '星空与典籍',
  intro: [
    '北方的夜空格外清澈。古老的典籍说，星星里藏着驱散灰雾的方法。',
    '学会文字与算学，建起观星台。',
  ],
  outro: '学者们第一次画出了完整的星图。',
  techs: [...ERA1, ...ERA2, 'masonry', 'mining', 'smelting', 'bronze', 'writing'], techAllowed: { maxEra: 5 },
  start: [
    { c: 'survivor', n: 6 }, { c: 'scholar' }, { c: 'hearth', fuel: 6 }, { c: 'cabin' }, { c: 'lean_to' }, { c: 'pine', n: 4 }, { c: 'rock', n: 3 },
    { c: 'copper_vein' }, { c: 'tin_vein' }, { c: 'coal_seam' }, { c: 'clay_pit', n: 2 }, { c: 'sand_bank' }, { c: 'pond' }, { c: 'reed_bed' }, { c: 'brick', n: 4 },
    { c: 'tall_grass', n: 2 }, { c: 'stone_pick' }, { c: 'study' }, { c: 'smelter' }, { c: 'kiln' }, { c: 'fur', n: 3 }, { c: 'jerky', n: 6 }, { c: 'ice_cave' }, { c: 'star_fall' },
  ],
  objectives: [{ type: 'research', tech: 'astronomy' }, { type: 'build', card: 'observatory' }],
  stars: [{ type: 'days', lte: 16 }, { type: 'nodeath' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 0, cold: true, eventRate: 0.25, events: ['wanderer', 'cache', 'aurora', 'festival_mood', 'scholar_visit'] },
});

level(5, {
  name: '冰魇', sub: 'Boss · 冰魇',
  intro: [
    '极夜降临时，冰魇会从冰窟里飘出来，带着成群的鬼火。',
    '它是暗影：只有光芒能真正伤到它。鬼火在天上飞，需要弓手。',
  ],
  outro: '冰魇在晨光中碎成了千万片冰晶。',
  techs: [...ERA1, ...ERA2, 'masonry', 'mining', 'smelting', 'bronze', 'writing', 'lamplight'], techAllowed: { maxEra: 4 },
  start: [
    { c: 'survivor', n: 7 }, { c: 'hearth', fuel: 6 }, { c: 'cabin' }, { c: 'lean_to', n: 2 }, { c: 'pine', n: 4 }, { c: 'rock', n: 3 },
    { c: 'copper_vein', n: 2 }, { c: 'coal_seam' }, { c: 'clay_pit' }, { c: 'reed_bed' }, { c: 'pond', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'seal', n: 2 },
    { c: 'stone_pick' }, { c: 'smelter' }, { c: 'kiln' }, { c: 'fur', n: 2 }, { c: 'bow', n: 2 }, { c: 'jerky', n: 4 },
    { c: 'frost_wraith', at: [0.85, 0.15], wake: false },
  ],
  objectives: [{ type: 'kill', card: 'frost_wraith' }],
  stars: [{ type: 'days', lte: 15 }, { type: 'nodeath' }],
  schedule: [{ day: 15, wake: 'frost_wraith', msg: '极夜降临，冰魇飘向营地！', warn: '第 15 天：冰魇来袭' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, cold: true, shades: true, shadeBase: 1, fog0: 15, fogRate: 1, eventRate: 0.2 },
});

// ================================================================== chapter 6 · 雾海群岛 ============
chapter(6, '雾海群岛', 'MIST ARCHIPELAGO', 'isles', '雾海中星罗棋布的小岛。造船出海，点亮灯塔。', '#6aa6c9');

level(6, {
  name: '造舟', sub: '船坞与雾岛',
  intro: [
    '营地在一座小岛的海滩上。雾里还有更多的岛。',
    '建起船坞，造一条舟，去看看雾的另一边。',
  ],
  outro: '舟从雾中归来，带回了贝壳、珍珠，还有迷路的人。',
  techs: [...ERA1, ...ERA2], techAllowed: { maxEra: 4 },
  start: [
    { c: 'survivor', n: 6 }, { c: 'campfire', fuel: 6 }, { c: 'lean_to', n: 2 }, { c: 'cabin' }, { c: 'tree', n: 5 }, { c: 'rock', n: 2 },
    { c: 'tidepool', n: 2 }, { c: 'driftwood_shore' }, { c: 'sand_bank' }, { c: 'tall_grass', n: 3 }, { c: 'berry_bush', n: 2 }, { c: 'seal' },
    { c: 'workbench' }, { c: 'loom' }, { c: 'coast' }, { c: 'misty_isle', ch: 5 }, { c: 'misty_isle', ch: 5 },
  ],
  objectives: [{ type: 'build', card: 'dock' }, { type: 'explore', n: 6 }],
  stars: [{ type: 'days', lte: 11 }, { type: 'nodeath' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, eventRate: 0.25, caravanEvery: 4 },
});

level(6, {
  name: '灯塔', sub: '琉璃与长明之光',
  intro: [
    '雾海的灰雾比任何地方都浓。古人在礁石上建灯塔，用光把雾劈开。',
    '烧出琉璃，榨出灯油，建起两座灯塔——在灰雾吞没营地之前。',
  ],
  outro: '两道光柱刺破了雾海。灰雾第一次退到了海平线以外。',
  techs: [...ERA1, ...ERA2, 'masonry', 'mining', 'smelting', 'writing', 'trade', 'fortification', 'glassmaking', 'lamplight'], techAllowed: { maxEra: 5 },
  start: [
    { c: 'survivor', n: 7 }, { c: 'hearth', fuel: 6 }, { c: 'cabin', n: 2 }, { c: 'tree', n: 4 }, { c: 'rock', n: 3 }, { c: 'sand_bank', n: 2 },
    { c: 'glassworks' }, { c: 'oil_press' }, { c: 'insight', n: 5 }, { c: 'copper', n: 2 },
    { c: 'clay_pit', n: 3 }, { c: 'copper_vein', n: 2 }, { c: 'coal_seam', n: 2 }, { c: 'tidepool', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'seal', n: 2 }, { c: 'rock', n: 2 }, { c: 'brick', n: 4 },
    { c: 'pond' }, { c: 'kiln' }, { c: 'smelter' }, { c: 'workbench' }, { c: 'study' }, { c: 'stone_pick', n: 2 }, { c: 'coast' },
  ],
  objectives: [{ type: 'build', card: 'lighthouse', n: 2, lit: true }, { type: 'fog', below: 30 }],
  lose: [{ type: 'fog' }],
  stars: [{ type: 'days', lte: 18 }, { type: 'fog', below: 70 }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, shades: true, shadeBase: 1, fog0: 30, fogRate: 3, eventRate: 0.25, caravanEvery: 4 },
});

level(6, {
  name: '海市', sub: '珍珠与财富',
  intro: [
    '雾海的商人只认珍珠和金子。',
    '潜进潮池，出海寻宝。营地里有一卷残卷，记着珍珠项链的串法。',
    '串起一条珍珠项链，再攒下 120 铜贝的家底。',
  ],
  outro: '营地的仓库里堆满了金锭。雾海诸岛都知道了这个名字。',
  techs: [...ERA1, ...ERA2, 'masonry', 'trade', 'writing', 'sailing', 'smelting', 'mining'], techAllowed: { maxEra: 5 },
  start: [
    { c: 'survivor', n: 7 }, { c: 'hearth', fuel: 6 }, { c: 'cabin', n: 2 }, { c: 'tree', n: 4 }, { c: 'rock', n: 2 }, { c: 'tidepool', n: 3 },
    { c: 'driftwood_shore' }, { c: 'sand_bank' }, { c: 'salt_flat' }, { c: 'clay_pit' }, { c: 'tall_grass', n: 2 }, { c: 'seal', n: 2 }, { c: 'dock' },
    { c: 'market' }, { c: 'workbench' }, { c: 'loom' }, { c: 'boat' }, { c: 'scroll', hint: 'h_pearl_necklace' }, { c: 'misty_isle', ch: 6 }, { c: 'sunken_temple' },
  ],
  objectives: [{ type: 'coins', n: 120 }, { type: 'made', card: 'pearl_necklace', n: 1 }],
  stars: [{ type: 'days', lte: 14 }, { type: 'nodeath' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, eventRate: 0.3, caravanEvery: 3 },
});

level(6, {
  name: '深渊海妖', sub: 'Boss · 深渊海妖',
  intro: [
    '雾海深处的海妖爬上了岸。它的触手缠住了半个海滩。',
    '它皮糙肉厚，触手会不断长出来。集结你最强的军队。',
  ],
  outro: '海妖沉回了深渊。海面上漂着一颗发光的巨珠。',
  techs: [...ERA1, ...ERA2, ...ERA3, 'iron', 'tactics', 'sailing'], techAllowed: { maxEra: 5 },
  start: [
    { c: 'survivor', n: 8 }, { c: 'maceguard', n: 2 }, { c: 'archer', n: 2 }, { c: 'iron_armor', n: 2 }, { c: 'hearth', fuel: 6 }, { c: 'cabin', n: 2 }, { c: 'stone_house' }, { c: 'tree', n: 4 }, { c: 'rock', n: 3 },
    { c: 'iron_vein', n: 2 }, { c: 'coal_seam', n: 2 }, { c: 'copper_vein' }, { c: 'tin_vein' }, { c: 'tidepool', n: 2 }, { c: 'pond', n: 2 }, { c: 'tall_grass', n: 2 },
    { c: 'smelter' }, { c: 'forge' }, { c: 'workbench' }, { c: 'tannery' }, { c: 'iron_pick' }, { c: 'seal', n: 2 }, { c: 'salted_fish', n: 8 },
    { c: 'kraken', at: [0.84, 0.86], wake: false }, { c: 'serpent_nest', at: [0.12, 0.88] },
  ],
  objectives: [{ type: 'kill', card: 'kraken' }],
  stars: [{ type: 'days', lte: 20 }, { type: 'nodeath' }],
  schedule: [{ day: 20, wake: 'kraken', msg: '深渊海妖向营地伸出了触手！', warn: '第 20 天：海妖上岸' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, eventRate: 0.25, caravanEvery: 5 },
});

// ================================================================== chapter 7 · 灰烬王座 ============
chapter(7, '灰烬王座', 'ASHEN THRONE', 'ash', '灰雾的源头。齿轮、蒸汽与烽燧——重燃大薪火，终结长夜。', '#c7684a');

level(7, {
  name: '齿轮与蒸汽', sub: '机关与蒸汽机',
  intro: [
    '灰烬荒原上散落着前人留下的机器。它们还能动吗？',
    '建起机关坊，车出齿轮，造一台蒸汽机。',
  ],
  outro: '蒸汽机喷出了第一口白气。整个营地都在欢呼。',
  techs: [...ERA1, ...ERA2, ...ERA3, 'iron', 'mathematics', 'lamplight'], techAllowed: { maxEra: 6 },
  start: [
    { c: 'survivor', n: 7 }, { c: 'artisan' }, { c: 'hearth', fuel: 6 }, { c: 'cabin', n: 2 }, { c: 'dead_tree', n: 4 }, { c: 'tree', n: 2 }, { c: 'rock', n: 3 },
    { c: 'iron_vein', n: 2 }, { c: 'coal_seam', n: 2 }, { c: 'clay_pit' }, { c: 'mushroom_ring', n: 2 }, { c: 'pond' }, { c: 'tall_grass', n: 2 },
    { c: 'smelter' }, { c: 'forge' }, { c: 'kiln' }, { c: 'workbench' }, { c: 'study' }, { c: 'iron_pick' }, { c: 'stone_pick' }, { c: 'jerky', n: 6 }, { c: 'ash_wastes' },
  ],
  objectives: [{ type: 'build', card: 'steam_engine' }, { type: 'made', card: 'gear', n: 6 }],
  stars: [{ type: 'days', lte: 16 }, { type: 'nodeath' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, shades: true, shadeBase: 1, fog0: 20, fogRate: 1, eventRate: 0.25 },
});

level(7, {
  name: '群灯计划', sub: '烽燧与灰雾',
  intro: [
    '要接近灰烬王座，必须先把灰雾压下去。',
    '在荒原上点燃三座烽燧。它们烧煤，一旦熄灭就不再驱雾。',
  ],
  outro: '三座烽燧连成一线。灰烬王座的轮廓第一次从雾中显露出来。',
  techs: [...ERA1, ...ERA2, ...ERA3, ...ERA4, 'civics', 'glassmaking', 'architecture'], techAllowed: { maxEra: 6 },
  start: [
    { c: 'survivor', n: 7 }, { c: 'lampwarden' }, { c: 'hearth', fuel: 6 }, { c: 'cabin', n: 2 }, { c: 'dead_tree', n: 4 }, { c: 'tree', n: 4 }, { c: 'rock', n: 7 },
    { c: 'iron_vein', n: 2 }, { c: 'coal_seam', n: 3 }, { c: 'ember_vein', n: 2 }, { c: 'clay_pit' }, { c: 'mushroom_ring', n: 2 }, { c: 'pond' },
    { c: 'tall_grass', n: 2 }, { c: 'smelter' }, { c: 'forge' }, { c: 'kiln' }, { c: 'study' }, { c: 'iron_pick', n: 2 }, { c: 'jerky', n: 6 }, { c: 'coal', n: 6 },
    { c: 'stone', n: 6 }, { c: 'ash_wastes' }, { c: 'ash_wastes' },
  ],
  objectives: [{ type: 'build', card: 'beacon', n: 3, lit: true }, { type: 'fog', below: 30 }],
  lose: [{ type: 'fog' }],
  stars: [{ type: 'days', lte: 18 }, { type: 'fog', below: 75 }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, shades: true, shadeBase: 2, fog0: 40, fogRate: 3, eventRate: 0.25, caravanEvery: 3 },
});

level(7, {
  name: '灰烬之潮', sub: '守住火塘',
  intro: [
    '灰烬王察觉到了你们。一波又一波的暗影正涌向营地。',
    '守住火塘十二天。它熄灭的那一刻，一切都完了。',
  ],
  outro: '第十二个黎明，灰潮退去了。火塘仍在燃烧。',
  techs: [...ERA1, ...ERA2, ...ERA3, ...ERA4], techAllowed: { maxEra: 6 },
  start: [
    { c: 'survivor', n: 7 }, { c: 'lampwarden', n: 2 }, { c: 'archer', n: 2 }, { c: 'hearth', fuel: 8 }, { c: 'cabin', n: 2 }, { c: 'stone_house' },
    { c: 'dead_tree', n: 4 }, { c: 'tree', n: 3 }, { c: 'rock', n: 3 }, { c: 'coal_seam', n: 2 }, { c: 'iron_vein' }, { c: 'copper_vein' }, { c: 'clay_pit' },
    { c: 'mushroom_ring', n: 3 }, { c: 'pond', n: 2 }, { c: 'tall_grass', n: 2 }, { c: 'smelter' }, { c: 'forge' }, { c: 'kiln' }, { c: 'oil_press' },
    { c: 'iron_pick' }, { c: 'jerky', n: 8 }, { c: 'stone_wall' }, { c: 'shade_rift', at: [0.86, 0.14] },
  ],
  objectives: [{ type: 'survive', days: 12 }],
  lose: [{ type: 'lost', card: 'hearth' }],
  stars: [{ type: 'nodeath' }, { type: 'kills', n: 30 }],
  schedule: [
    { day: 3, at: 'night', spawn: [['ash_hound', 3]], warn: '第 3 夜：灰犬' },
    { day: 5, at: 'night', spawn: [['ash_hound', 3], ['ash_knight', 1]], warn: '第 5 夜：灰犬与灰烬骑士' },
    { day: 8, at: 'night', spawn: [['ash_knight', 2], ['ash_hound', 3]], warn: '第 8 夜：灰烬骑士' },
    { day: 11, at: 'night', spawn: [['ash_knight', 3], ['greater_shade', 2]], warn: '第 11 夜：大潮' },
  ],
  rules: { seasons: true, seasonDays: 4, startSeason: 2, shades: true, shadeBase: 2, fog0: 35, fogRate: 2, eventRate: 0.2 },
});

level(7, {
  name: '大薪火', sub: '终章 · 灰烬之王',
  intro: [
    '这里是一切开始的地方：大薪火熄灭后留下的基座。',
    '分三个阶段献上材料，重新点燃大薪火。然后——击败灰烬之王。',
  ],
  outro: '大薪火冲天而起。光芒所及之处，灰雾像晨露一样消散。长夜结束了。',
  techs: [...ERA1, ...ERA2, ...ERA3, ...ERA4, ...ERA5, 'clockwork', 'beacon_lore'], techAllowed: { maxEra: 6 },
  start: [
    { c: 'survivor', n: 8 }, { c: 'lampwarden', n: 2 }, { c: 'archer', n: 2 }, { c: 'maceguard' }, { c: 'artisan' }, { c: 'hearth', fuel: 8 },
    { c: 'cabin', n: 2 }, { c: 'stone_house' }, { c: 'dead_tree', n: 4 }, { c: 'tree', n: 3 }, { c: 'rock', n: 4 }, { c: 'iron_vein', n: 2 },
    { c: 'coal_seam', n: 2 }, { c: 'ember_vein', n: 2 }, { c: 'sand_bank' }, { c: 'clay_pit' }, { c: 'mushroom_ring', n: 3 }, { c: 'pond', n: 2 },
    { c: 'tall_grass', n: 2 }, { c: 'smelter' }, { c: 'forge' }, { c: 'kiln' }, { c: 'glassworks' }, { c: 'clock_workshop' }, { c: 'shrine' },
    { c: 'oil_press' }, { c: 'iron_pick', n: 2 }, { c: 'jerky', n: 8 }, { c: 'field', n: 3 }, { c: 'granary', store: 30 }, { c: 'iron', n: 4 },
    { c: 'glass', n: 2 }, { c: 'brick', n: 4 }, { c: 'copper_vein' }, { c: 'copper', n: 2 }, { c: 'lantern' }, { c: 'ember_vein' }, { c: 'reed_bed' },
    { c: 'great_flame_site', at: [0.5, 0.3] },
    { c: 'ash_king', at: [0.88, 0.12], wake: false },
  ],
  objectives: [{ type: 'build', card: 'great_flame' }, { type: 'kill', card: 'ash_king' }],
  stars: [{ type: 'days', lte: 24 }, { type: 'nodeath' }],
  schedule: [{ day: 24, wake: 'ash_king', msg: '灰烬之王从王座上站了起来！', warn: '第 24 天：灰烬之王' }],
  rules: { seasons: true, seasonDays: 4, startSeason: 1, shades: true, shadeBase: 2, fog0: 45, fogRate: 2, eventRate: 0.2 },
});

export const LEVEL_IDS = () => Object.keys(LEVELS);
export function levelById(id) { return LEVELS[id]; }
export function nextLevelId(id) {
  const ids = Object.keys(LEVELS);
  const i = ids.indexOf(id);
  return i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
}
