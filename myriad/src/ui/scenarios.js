// The experiment lab: ready-made worlds that pose a question, each with its own starting
// conditions and twist.

import { meteorImpact } from '../sim/geology.js';
import { summonComet } from '../sim/entities.js';
import { grantUpToEra } from '../sim/civ/tech.js';
import { log } from '../sim/chronicle.js';
import { refreshName } from '../sim/civ/nation.js';
import { seedPeoples } from '../sim/world.js';

export const SCENARIOS = [
  {
    id: 'islands', name: '孤岛进化', desc: '星罗棋布的群岛上，同一批祖先能分化出多少种生灵？',
    opts: { preset: 'archipelago', start: 'flourishing', size: 'medium' },
  },
  {
    id: 'mind', name: '智慧的种子', desc: '大陆中央矗立着一座回响碑。谁会第一个睁开思考的眼睛？',
    opts: { preset: 'pangaea', start: 'flourishing', size: 'medium' },
    setup(w) {
      w.monoliths.push({ x: w.W / 2, y: w.H / 2, r: 18, born: 0 });
      log(w, 'divine', '一座无言的黑色石碑立于大陆中央。', { imp: 2, x: w.W / 2, y: w.H / 2 });
    },
  },
  {
    id: 'twins', name: '双雄', desc: '东西两块大陆，各自孕育一支智慧种族。当他们终于相遇……',
    opts: { preset: 'twin', start: 'tribes', size: 'medium' },
  },
  {
    id: 'winter', name: '永冬', desc: '霜星上只有赤道附近适合居住。文明能在严寒中走多远？',
    opts: { preset: 'frozen', start: 'tribes', size: 'medium' },
  },
  {
    id: 'melting', name: '文明熔炉', desc: '一整块超级大陆上，四种不同的智慧种族比邻而居。',
    opts: { preset: 'pangaea', start: 'flourishing', size: 'large' },
    setup(w) { seedPeoples(w, null); seedPeoples(w, null); },
  },
  {
    id: 'impact', name: '大灭绝之后', desc: '繁盛的世界刚刚被一颗巨大的陨星击中。生命会如何复苏？',
    opts: { preset: 'continents', start: 'flourishing', size: 'medium' },
    setup(w) { meteorImpact(w, w.W * 0.45, w.H * 0.5, 8, w.rng); log(w, 'nature', '一颗巨大的陨星划破天际。', { imp: 3 }); },
  },
  {
    id: 'greenhouse', name: '温室末日', desc: '诸王国诞生在一颗二氧化碳浓度极高的星球上，海平面将不断上涨。',
    opts: { preset: 'continents', start: 'kingdoms', size: 'medium' },
    setup(w) { w.climate.co2 = 1100; },
  },
  {
    id: 'spacerace', name: '天外来客', desc: '工业化的诸国发现，一颗彗星将在一百二十年后撞击世界。他们能否及时造出火箭？',
    opts: { preset: 'continents', start: 'kingdoms', size: 'medium' },
    setup(w) {
      for (const n of w.nations) { grantUpToEra(n, 6); n.gov = 'republic'; refreshName(n); }
      for (const c of w.cities) c.pop *= 4;
      summonComet(w, 120, 7);
    },
  },
  {
    id: 'pantheon', name: '万神殿', desc: '神途模式：你的神力只来自信徒。赢得崇拜，或被人遗忘。',
    opts: { preset: 'continents', start: 'tribes', size: 'medium', mode: 'divine' },
  },
  {
    id: 'genesis', name: '从零开始', desc: '一颗荒芜的星球，没有任何生命。一切都由你创造。',
    opts: { preset: 'continents', start: 'barren', size: 'medium' },
  },
];
