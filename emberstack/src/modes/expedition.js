// Replayable modes built from the same level format as the campaign:
//   远征 expedition — a procedurally generated land with random goals, difficulty 1-5 and mutators
//   无尽 endless    — survive as long as you can while raids and fog grow every few days
//   挑战 challenge  — hand-made twists on campaign levels
// A level is generated from a small `spec` so a run can be saved and rebuilt exactly.

import { RNG } from '../core/rng.js';
import { CARDS } from '../data/cards.js';
import { TECHS } from '../data/techs.js';
import { LEVELS, ensureFood } from '../data/levels.js';

export const BIOMES = {
  valley: { name: '河谷', en: 'VALLEY', color: '#9dbb5a', nodes: ['tree', 'rock', 'berry_bush', 'tall_grass', 'pond', 'wild_wheat', 'clay_pit', 'herb_patch'], regions: ['valley_depths', 'old_ruins', 'cave', 'wolf_trail'], beasts: ['rabbit', 'deer', 'fowl'], raid: ['wolf', 'bandit', 'wolf'], foes: ['wolf', 'bandit'], boss: 'alpha_wolf', lair: 'wolf_den' },
  forest: { name: '林海', en: 'FOREST', color: '#5a8a4a', nodes: ['tree', 'pine', 'old_oak', 'berry_bush', 'mushroom_ring', 'herb_patch', 'beehive', 'rock', 'pond'], regions: ['deep_forest', 'old_ruins', 'cave', 'wolf_trail'], beasts: ['deer', 'boar', 'fowl'], raid: ['wolf', 'thornling', 'bear'], foes: ['wolf', 'thornling'], boss: 'rotroot', lair: 'wolf_den' },
  marsh: { name: '盐沼', en: 'MARSH', color: '#6a9a8a', nodes: ['reed_bed', 'clay_pit', 'salt_flat', 'pond', 'mushroom_ring', 'tree', 'rock', 'herb_patch'], regions: ['marsh_depths', 'old_ruins', 'bandit_trail'], beasts: ['fowl', 'boar'], raid: ['leech', 'bandit', 'croc'], foes: ['leech', 'croc', 'bandit'], boss: 'croc_king', lair: 'bandit_camp' },
  mountain: { name: '铜铁之山', en: 'MOUNTAIN', color: '#a89a7a', nodes: ['rock', 'pine', 'copper_vein', 'tin_vein', 'coal_seam', 'iron_vein', 'clay_pit', 'berry_bush', 'pond'], regions: ['mountain_pass', 'abandoned_mine', 'cave', 'bandit_trail'], beasts: ['goat', 'horse'], raid: ['wolf', 'bandit', 'cave_crawler'], foes: ['wolf', 'bandit', 'cave_crawler'], boss: 'slag_golem', lair: 'bandit_camp' },
  tundra: { name: '霜原', en: 'TUNDRA', color: '#a8c8e0', nodes: ['pine', 'ice_shelf', 'rock', 'pond', 'mushroom_ring', 'dead_tree'], regions: ['frozen_waste', 'ice_cave', 'star_fall'], beasts: ['seal', 'mammoth', 'goat'], raid: ['frost_wolf', 'wisp', 'frost_wolf'], foes: ['frost_wolf', 'wisp'], boss: 'frost_wraith', lair: 'shade_rift' },
  isles: { name: '雾海群岛', en: 'ISLES', color: '#5a9ab0', nodes: ['tidepool', 'driftwood_shore', 'sand_bank', 'tree', 'pond', 'rock', 'salt_flat', 'clay_pit'], regions: ['coast', 'misty_isle', 'sunken_temple'], beasts: ['seal', 'fowl'], raid: ['bandit', 'harpy', 'sea_serpent'], foes: ['harpy', 'sea_serpent'], boss: 'kraken', lair: 'serpent_nest' },
  ash: { name: '灰烬之地', en: 'ASHLANDS', color: '#c8643a', nodes: ['dead_tree', 'rock', 'mushroom_ring', 'obsidian_flow', 'sulfur_vent', 'coal_seam', 'pond', 'clay_pit', 'iron_vein'], regions: ['ash_wastes', 'old_ruins', 'abandoned_mine'], beasts: ['goat'], raid: ['shade', 'ash_hound', 'greater_shade'], foes: ['ash_hound', 'shade', 'greater_shade'], boss: 'bandit_chief', lair: 'shade_rift' },
};

export const MUTATORS = [
  { id: 'dark', name: '永夜', desc: '太阳再也没有升起。只有火光能让人工作。', rules: { dark: true, shades: true, shadeBase: 1 } },
  { id: 'famine', name: '饥荒', desc: '食物腐坏快一倍，冬天胃口更大。', rules: { spoilMult: 0.5, winterAppetite: 1.6 } },
  { id: 'lonely', name: '孤身', desc: '只有一个人从灰雾中走出来。', start: (s) => { const f = s.find((e) => e.c === 'survivor'); if (f) f.n = 1; } },
  { id: 'horde', name: '兽潮', desc: '敌人生命与攻击 +50%，夜袭更频繁。', rules: { enemyHp: 1.5, enemyAtk: 1.5, danger: 1.6 } },
  { id: 'mist', name: '浓雾', desc: '灰雾增长速度翻倍，起始灰雾 30%。', rules: { fogRate: 2.5, fog0: 30 }, fog: true },
  { id: 'cold', name: '极寒', desc: '冬天更长，寒冷会伤人。', rules: { cold: true, seasonDays: 4 } },
  { id: 'rich', name: '丰饶', desc: '更多的资源点与补给（降低难度）。', start: (s) => s.push({ c: 'supply_basic', n: 2 }, { c: 'food_crate', n: 1 }, { c: 'berry_bush', n: 2 }) },
  { id: 'trade', name: '商路', desc: '商队每两天来访一次，起始有集市。', rules: { caravanEvery: 2 }, start: (s) => s.push({ c: 'market' }, { c: 'coin', n: 8 }) },
  { id: 'swift', name: '急行', desc: '一天只有平常的三分之二长。', rules: { dayLen: 48 } },
  { id: 'scholar', name: '博学', desc: '起始多掌握一个时代的科技，但目标更多。', techBonus: 1, extraGoal: true },
];

export const CHALLENGES = [
  { id: 'c_dark_valley', name: '永夜河谷', base: '1-3', desc: '「长夜」，但太阳再也没有升起。', mutators: ['dark'], extra: { lose: [{ type: 'fog' }] } },
  { id: 'c_lone_wolf', name: '孤身', base: '1-2', desc: '「河畔」，但只有一个人走出灰雾。没有第二个人，就没有孩子。', mutators: ['lonely'] },
  { id: 'c_famine_marsh', name: '盐沼饥荒', base: '3-2', desc: '食物腐坏飞快，冬天无比漫长。', mutators: ['famine', 'cold'] },
  { id: 'c_horde_forest', name: '林海兽潮', base: '2-3', desc: '「迷雾林」里的野兽与暗影强了一半，夜袭更频繁。', mutators: ['horde'] },
  { id: 'c_swift_mountain', name: '急行山路', base: '4-1', desc: '日短夜长，时间就是一切。', mutators: ['swift'] },
  { id: 'c_misty_isles', name: '雾锁群岛', base: '6-1', desc: '灰雾翻倍地蔓延。', mutators: ['mist'] },
  { id: 'c_ash_horde', name: '灰烬狂潮', base: '7-1', desc: '灰烬中的敌人更强，夜更深。', mutators: ['horde', 'mist'] },
];

const ERA_TECHS = (e) => Object.values(TECHS).filter((t) => t.era <= e).map((t) => t.id);

function pickN(rng, arr, n) { return rng.shuffle(arr.slice()).slice(0, n); }

/** build an expedition (or endless) level from its spec: { mode, biome, diff, seed, mutators } */
export function makeExpedition(spec) {
  const rng = new RNG(spec.seed >>> 0 || 1);
  const B = BIOMES[spec.biome] || BIOMES.valley;
  const d = Math.max(1, Math.min(5, spec.diff || 2));
  const muts = (spec.mutators || []).map((id) => MUTATORS.find((m) => m.id === id)).filter(Boolean);
  const endless = spec.mode === 'endless';
  const era = Math.min(5, Math.max(1, d - 1 + muts.reduce((a, m) => a + (m.techBonus || 0), 0)));
  const techs = era <= 1 ? ['stone_tools', 'shelter', 'cooking'] : ERA_TECHS(era - 1).filter((t) => t !== 'beacon_lore');
  const start = [
    { c: 'survivor', n: 3 + Math.floor(d / 2) + (endless ? 2 : 0) },
    { c: 'campfire', fuel: 4 },
    { c: 'lean_to' },
    { c: 'wood', n: 3 },
    { c: 'jerky', n: 3 + d },
    { c: 'club', n: Math.ceil(d / 2) },
  ];
  if (d >= 3) start.push({ c: 'spear', n: 1 });
  if (spec.biome === 'tundra') start.push({ c: 'fur_cloak', n: 2 });
  if (era >= 3) start.push({ c: 'artisan' }, { c: 'stone_pick' }, { c: 'kiln' });
  if (era >= 4) start.push({ c: 'cabin' }, { c: 'smelter' });
  if (era >= 5) start.push({ c: 'forge' }, { c: 'study' });
  if (endless) start.push({ c: 'spearman' }, { c: spec.biome === 'isles' || spec.biome === 'tundra' ? 'archer' : 'spearman' }, { c: 'lean_to' }, { c: 'torch_post' });
  // nodes: every land has the basics (wood, stone, fibre, clay, water), then its own character
  const counts = { tree: 3, rock: 2, tall_grass: 2, clay_pit: 1, pond: 1 };
  if (spec.biome === 'ash' || spec.biome === 'tundra') counts.tree = 2;
  if (spec.biome === 'tundra') counts.pine = 2;
  start.push({ c: 'sapling', n: 2 });
  for (const id of B.nodes.slice(0, 3)) counts[id] = (counts[id] || 0) + 1;
  for (let i = 0; i < 3 + Math.max(0, 3 - d); i++) { const id = rng.pick(B.nodes); counts[id] = (counts[id] || 0) + 1; }
  for (const [c, n] of Object.entries(counts)) start.push({ c, n });
  for (const id of pickN(rng, B.regions, 2 + (d >= 3 ? 1 : 0))) start.push({ c: id });
  for (const id of pickN(rng, B.beasts, 2)) start.push({ c: id });
  // dangers
  const corner = () => [rng.chance(0.5) ? 0.1 : 0.9, rng.chance(0.5) ? 0.12 : 0.88];
  const lair = d >= 4 || endless;
  // a lair is either hidden at the end of a trail (found by exploring) or lurks in a far corner
  const trail = Object.values(CARDS).find((c) => c.kind === 'region' && c.region.reveal && c.region.reveal.includes(B.lair));
  if (lair && trail && !endless) { if (!start.some((e) => e.c === trail.id)) start.push({ c: trail.id }); }
  else if (lair) start.push({ c: B.lair, at: corner() });
  if (d >= 4) start.push({ c: spec.biome === 'isles' || spec.biome === 'tundra' ? 'archer' : 'spearman' });
  const boss = d >= 4 && !endless;
  if (boss) start.push({ c: B.boss, at: corner(), wake: false });

  const startFood = () => start.reduce((t, e) => t + (CARDS[e.c].food || 0) * (e.n || 1), 0);
  // goals
  const objectives = [];
  if (endless) {
    // none: endless runs end only in defeat; score = days survived
  } else {
    const BUILD = [['shrine', 'torch_post', 'drying_rack', 'stone_tablet'], ['workbench', 'kiln', 'granary', 'loom', 'cabin'], ['well', 'tannery', 'market', 'stone_house', 'smelter'], ['watchtower', 'library', 'mill', 'lamp_post']];
    const MADE = [['cooked_fish', 'torch'], ['rope', 'plank', 'cooked_fish'], ['brick', 'cloth', 'bread'], ['bread', 'glass', 'leather']];
    const tier = (arr) => arr[Math.min(arr.length - 1, Math.floor((d - 1) / 1.4))];
    const pool = [
      () => ({ type: 'pop', n: 5 + d * 2 }),
      () => ({ type: 'research', n: [3, 3, 4, 4, 4][d - 1] }),
      () => ({ type: 'explore', n: 3 + d }),
      () => ({ type: 'build', card: rng.pick(tier(BUILD)) }),
      () => ({ type: 'food', n: startFood() + 6 + d * 4 }),
      () => ({ type: 'made', card: rng.pick(tier(MADE)), n: Math.round(3 + d * 1.5) }),
    ];
    if (d >= 2) pool.push(() => ({ type: 'lights', n: 1 + Math.ceil(d / 2) }), () => ({ type: 'soldiers', n: d - 1 }));
    if (lair) pool.push(() => ({ type: 'kill', card: B.lair }));
    const want = 3 + (muts.some((m) => m.extraGoal) ? 1 : 0);
    const seen = new Set();
    for (const f of rng.shuffle(pool)) {
      if (objectives.length >= want) break;
      const o = f();
      if (o.type === 'build' && start.some((e) => e.c === o.card)) continue;
      const k = o.type + (o.card || '');
      if (seen.has(o.type)) continue;
      seen.add(k);
      seen.add(o.type);
      objectives.push(o);
    }
    if (boss) objectives.push({ type: 'kill', card: B.boss });
    // make sure every goal can actually be reached on this map
    for (const o of objectives) {
      if (o.card === 'bread') start.push({ c: 'wild_wheat', n: 2 });
      if (o.card === 'roast' || o.card === 'jerky' || o.card === 'leather' || o.card === 'tannery') start.push({ c: 'deer', n: 2 });
      if (o.card === 'glass') start.push({ c: 'sand_bank', n: 2 });
      if (o.card === 'smelter') start.push({ c: 'copper_vein' }, { c: 'coal_seam' });
    }
  }
  const shades = d >= 3 || muts.some((m) => m.fog || m.id === 'dark') || spec.biome === 'ash';
  const rules = {
    seasons: true, seasonDays: 4, startSeason: rng.chance(0.7) ? 0 : 1, eventRate: 0.25 + d * 0.03,
    shades, shadeBase: shades ? Math.max(0, d - 3) : 0, fog0: shades ? d * 4 : 0, fogRate: shades ? 0.5 + d * 0.3 : 0,
    cold: spec.biome === 'tundra', enemyHp: 0.75 + d * 0.1, enemyAtk: 0.8 + d * 0.07, bossHp: 0.85,
  };
  for (const m of muts) {
    if (m.rules) Object.assign(rules, m.rules);
    if (m.start) m.start(start);
  }
  const schedule = [];
  const wakeDay = 10 + d * 3;
  if (boss) schedule.push({ day: wakeDay, wake: B.boss, warn: `第 ${wakeDay} 天：${CARDS[B.boss].name}苏醒` });
  if (endless) {
    for (let day = 4; day <= 240; day += 3) {
      const n = 1 + Math.floor(day / 6);
      const foes = [];
      const kinds = Math.min(B.raid.length, 1 + Math.floor(day / 10));
      for (let i = 0; i < Math.min(16, n); i++) foes.push(B.raid[(i + day) % kinds]);
      const grouped = {};
      for (const f of foes) grouped[f] = (grouped[f] || 0) + 1;
      schedule.push({ day, at: 'night', msg: `第 ${day} 夜：灰雾里的敌人来袭（${foes.length}）。`, kind: 'danger', spawn: Object.entries(grouped).map(([id, k]) => [id, k]), warn: `第 ${day} 夜：袭击` });
      if (day % 15 === 0 || (day > 36 && day % 12 === 0)) schedule.push({ day, at: 'night', spawn: [[B.boss, day > 60 ? 2 : 1, { boss: true }]], warn: `第 ${day} 夜：首领` });
    }
    rules.fogRate = 1.2;
  }
  const lose = [];
  if (shades) lose.push({ type: 'fog' });
  if (!endless) lose.push({ type: 'time', days: 22 + objectives.length * 6 + d * 2 });
  // feed the camp it will grow into, not just the one it starts with
  const grown = { start: [...start, { c: 'survivor', n: 2 + Math.ceil(d / 2) }], rules, biome: spec.biome };
  const before = grown.start.length;
  ensureFood(grown);
  start.push(...grown.start.slice(before));
  const biomeName = B.name;
  const id = endless ? `endless-${spec.biome}-${spec.seed}` : `exp-${spec.biome}-${d}-${spec.seed}`;
  return {
    id, mode: endless ? 'endless' : 'expedition', spec, chapter: 0, biome: spec.biome, board: [2600, 1800],
    name: endless ? `无尽 · ${biomeName}` : `远征 · ${biomeName}`,
    sub: endless ? '坚持得越久越好' : `难度 ${'◆'.repeat(d)}${muts.length ? ' · ' + muts.map((m) => m.name).join('、') : ''}`,
    intro: endless
      ? [`${biomeName}的灰雾永不消散。每隔三夜，就会有东西从雾里走出来，一次比一次多。`, '没有终点——只有你能坚持多少天。']
      : [`一支远征队来到了陌生的${biomeName}。`, '这里的一切都是新的：地形、资源，还有潜伏在雾中的东西。', ...muts.map((m) => `【${m.name}】${m.desc}`)],
    outro: endless ? '火光终于熄灭了。但它燃烧过的日子，会被记住。' : '远征队在这片土地上扎下了根。',
    techs, techAllowed: { maxEra: Math.min(6, era + 2) }, start, objectives,
    stars: endless ? [] : [{ type: 'days', lte: 10 + objectives.length * 3 + d }, { type: 'nodeath' }],
    lose, schedule, rules, seed: spec.seed,
  };
}

/** a campaign level with a challenge's twists applied */
export function makeChallenge(id) {
  const C = CHALLENGES.find((c) => c.id === id);
  const base = LEVELS[C.base];
  const muts = C.mutators.map((m) => MUTATORS.find((x) => x.id === m));
  const start = base.start.map((e) => ({ ...e }));
  const rules = { ...(base.rules || {}) };
  for (const m of muts) {
    if (m.rules) Object.assign(rules, m.rules);
    if (m.start) m.start(start);
  }
  return {
    ...base, ...(C.extra || {}), id: C.id, mode: 'challenge', spec: { mode: 'challenge', id }, name: C.name, sub: `挑战 · 基于「${base.name}」`,
    intro: [...base.intro, ...muts.map((m) => `【${m.name}】${m.desc}`)], start, rules,
    lose: [...(base.lose || []), ...((C.extra && C.extra.lose) || [])],
  };
}

/** rebuild any level from a saved spec */
export function levelFromSpec(spec, fallbackId) {
  if (spec && (spec.mode === 'expedition' || spec.mode === 'endless')) return makeExpedition(spec);
  if (spec && spec.mode === 'challenge') return makeChallenge(spec.id);
  return LEVELS[fallbackId];
}
