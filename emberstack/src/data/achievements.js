// Achievements. `on` names the moment they are checked: 'event' (a simulation event, live),
// 'end' (a finished level) or 'meta' (campaign-wide records). `test` returns true when earned.

import { CHAPTERS } from './levels.js';
import { HIDDEN_RECIPES } from './recipes.js';

export const ACHIEVEMENTS = [
  { id: 'first_fire', icon: '火', name: '第一缕火', desc: '生起第一堆篝火。', on: 'event', test: (e) => e.type === 'craft' && e.r === 'make_campfire' },
  { id: 'first_child', icon: '婴', name: '薪火相传', desc: '营地里诞生了第一个孩子。', on: 'event', test: (e) => e.type === 'craft' && e.r === 'birth' },
  { id: 'first_secret', icon: '秘', name: '灵光一现', desc: '发现一个隐藏配方。', on: 'event', test: (e) => e.type === 'discover' },
  { id: 'secrets_10', icon: '典', name: '博物志', desc: '累计发现 10 个隐藏配方。', on: 'meta', test: (s) => s.recipes.filter((r) => HIDDEN_RECIPES.includes(r)).length >= 10 },
  { id: 'secrets_all', icon: '圣', name: '万物有灵', desc: `发现全部 ${HIDDEN_RECIPES.length} 个隐藏配方。`, on: 'meta', test: (s) => HIDDEN_RECIPES.every((r) => s.recipes.includes(r)) },
  { id: 'alpha', icon: '狼', name: '狼王之死', desc: '击败头狼。', on: 'event', test: (e) => e.type === 'kill' && e.d === 'alpha_wolf' },
  { id: 'rotroot', icon: '根', name: '腐朽之心', desc: '击败腐根兽。', on: 'event', test: (e) => e.type === 'kill' && e.d === 'rotroot' },
  { id: 'croc', icon: '鳄', name: '沼泽之主', desc: '击败鳄王。', on: 'event', test: (e) => e.type === 'kill' && e.d === 'croc_king' },
  { id: 'golem', icon: '熔', name: '熄灭熔炉', desc: '击败熔渣巨人。', on: 'event', test: (e) => e.type === 'kill' && e.d === 'slag_golem' },
  { id: 'wraith', icon: '霜', name: '破晓', desc: '击败冰魇。', on: 'event', test: (e) => e.type === 'kill' && e.d === 'frost_wraith' },
  { id: 'kraken', icon: '渊', name: '深渊回响', desc: '击败深渊海妖。', on: 'event', test: (e) => e.type === 'kill' && e.d === 'kraken' },
  { id: 'ashking', icon: '王', name: '长夜终结', desc: '击败灰烬之王。', on: 'event', test: (e) => e.type === 'kill' && e.d === 'ash_king' },
  { id: 'great_flame', icon: '薪', name: '大薪火', desc: '重新点燃大薪火。', on: 'event', test: (e) => e.type === 'stage' && e.stage >= 3 },
  { id: 'lighthouse', icon: '塔', name: '雾海明灯', desc: '建成一座灯塔。', on: 'event', test: (e, g) => e.type === 'craft' && g.countDef('lighthouse') > 0 },
  { id: 'festival', icon: '宴', name: '长夜之宴', desc: '举办一次庆典。', on: 'event', test: (e) => e.type === 'festival' },
  { id: 'pop20', icon: '众', name: '人丁兴旺', desc: '在一局中人口达到 20。', on: 'end', test: (r) => r.maxPop >= 20 },
  { id: 'winter', icon: '冬', name: '熬过寒冬', desc: '在冬天结束时无人饿死或冻死。', on: 'event', test: (e, g) => e.type === 'season' && e.season === 0 && g.s.day > 4 && g.s.stats.deaths === 0 },
  { id: 'nodeath_ch', icon: '护', name: '一个都不能少', desc: '无人牺牲地通关任意一关的终章（x-4）。', on: 'end', test: (r) => r.won && r.levelId.endsWith('-4') && r.deaths === 0 },
  { id: 'three_star', icon: '星', name: '尽善尽美', desc: '获得一次三星评价。', on: 'end', test: (r) => r.won && r.stars >= 3 },
  { id: 'all_stars', icon: '辰', name: '满天星斗', desc: '战役所有关卡三星。', on: 'meta', test: (s, levels) => levels.every((id) => (s.progress[id]?.stars || 0) >= 3) },
  ...CHAPTERS.map((c) => ({
    id: 'chapter_' + c.id, icon: c.name[0], name: `${c.name}之章`, desc: `通关第 ${c.id} 章「${c.name}」。`, on: 'meta',
    test: (s) => c.levels.every((id) => s.progress[id]?.won),
  })),
  { id: 'ai_win', icon: '灵', name: '火之灵', desc: '让 AI 独立通关一个关卡。', on: 'end', test: (r) => r.won && r.aiOnly },
  { id: 'ai_campaign', icon: '慧', name: '无人之境', desc: 'AI 独立通关每一章的终章。', on: 'meta', test: (s) => CHAPTERS.every((c) => s.progress[c.levels[c.levels.length - 1]]?.aiWon) },
  { id: 'manual_win', icon: '手', name: '亲力亲为', desc: '不使用 AI 通关一个第 3 章以后的关卡。', on: 'end', test: (r) => r.won && r.noAi && Number(r.levelId.split('-')[0]) >= 3 },
  { id: 'expedition', icon: '远', name: '远行者', desc: '完成一次远征。', on: 'end', test: (r) => r.won && r.mode === 'expedition' },
  { id: 'endless30', icon: '久', name: '长明', desc: '在无尽模式中坚持 30 天。', on: 'end', test: (r) => r.mode === 'endless' && r.days >= 30 },
  { id: 'challenge', icon: '试', name: '迎难而上', desc: '完成一个挑战关卡。', on: 'end', test: (r) => r.won && r.mode === 'challenge' },
  { id: 'kills100', icon: '刃', name: '百战', desc: '累计击败 100 个敌人。', on: 'meta', test: (s) => s.stats.kills >= 100 },
  { id: 'rich', icon: '贝', name: '富甲一方', desc: '在一局中通过集市赚取 60 铜贝。', on: 'end', test: (r) => r.coinsEarned >= 60 },
  { id: 'scholar', icon: '学', name: '格物致知', desc: '在一局中研究 15 项科技。', on: 'end', test: (r) => r.researched >= 15 },
];
