// The campaign: seven chapters, each a different land with its own rules, threats and goals.
// Positions in `at` are fractions of the board; everything else is laid out automatically.

export const CHAPTERS = [];
export const LEVELS = Object.create(null);

function chapter(id, name, en, biome, desc, color) {
  CHAPTERS.push({ id, name, en, biome, desc, color, levels: [] });
}
function level(ch, l) {
  const c = CHAPTERS.find((x) => x.id === ch);
  const id = `${ch}-${c.levels.length + 1}`;
  const L = { id, chapter: ch, biome: c.biome, board: [2400, 1700], stars: [], lose: [], schedule: [], ...l };
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

export const LEVEL_IDS = () => Object.keys(LEVELS);
export function levelById(id) { return LEVELS[id]; }
export function nextLevelId(id) {
  const ids = Object.keys(LEVELS);
  const i = ids.indexOf(id);
  return i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
}
