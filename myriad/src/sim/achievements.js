// The codex of wonders: milestones of the world's history. Each is checked once a year; the UI
// keeps a record across all worlds the player has made, so there is always something left to see.

import { year } from './state.js';
import { notify } from './state.js';

const alive = (w) => w.nations.filter((n) => n.alive && n.cities.length);
const playerReligions = (w) => w.religions.filter((r) => r.player);

export const ACHIEVEMENTS = [
  { id: 'firstLife', name: '第一缕生机', desc: '世界上有了生命', cat: '生命', check: (w) => w.life.count > 0 },
  { id: 'landfall', name: '登陆', desc: '水生生物演化出陆生后代', cat: '生命', check: (w) => !!w.flags.landfall },
  { id: 'flight', name: '天空之翼', desc: '演化出会飞的物种', cat: '生命', check: (w) => !!w.flags.flight },
  { id: 'giant', name: '巨兽时代', desc: '一个物种的体型基因超过 0.9', cat: '生命', check: (w) => w.species.some((s) => s.extinct === null && s.pop > 5 && s.ref[0] > 0.9) },
  { id: 'species50', name: '万物生长', desc: '同时存在 30 个以上物种', cat: '生命', check: (w) => w.speciesAliveCount >= 30 },
  { id: 'species300', name: '演化之树', desc: '累计诞生 300 个物种', cat: '生命', check: (w) => w.species.length >= 300 },
  { id: 'awakening', name: '智慧曙光', desc: '一个物种自然演化出智慧', cat: '生命', check: (w) => w.species.some((s) => s.sapient && !s.designed && s.births > 0 && w.chronicle.some((e) => e.text.startsWith('智慧的曙光'))) },
  { id: 'chimera', name: '嵌合之术', desc: '创造嵌合物种', cat: '生命', check: (w) => !!w.flags.chimera },
  { id: 'massExtinction', name: '大灭绝', desc: '百年内现存物种减少七成以上', cat: '生命', check: (w) => { const s = w.series; if (!s || s.species.length < 60) return false; const n = s.species.length; const old = Math.max(...s.species.slice(Math.max(0, n - 50), n - 1)); return old >= 10 && s.species[n - 1] <= old * 0.3; } },
  { id: 'firstTribe', name: '篝火', desc: '第一个部落诞生', cat: '文明', check: (w) => w.nations.length > 0 },
  { id: 'twoPeoples', name: '异族', desc: '两个不同的智慧物种同时拥有文明', cat: '文明', check: (w) => new Set(alive(w).map((n) => n.species)).size >= 2 },
  { id: 'city10k', name: '万人之城', desc: '一座城市人口过万', cat: '文明', check: (w) => w.cities.some((c) => c.alive && c.pop >= 10000) },
  { id: 'megacity', name: '超级都市', desc: '一座城市人口突破四十万', cat: '文明', check: (w) => w.cities.some((c) => c.alive && c.pop >= 400000) },
  { id: 'empire', name: '帝国', desc: '一个国家拥有 20 座以上城市', cat: '文明', check: (w) => alive(w).some((n) => n.cities.length >= 20) },
  { id: 'hundredCities', name: '百城之世', desc: '世界上同时存在一百座城市', cat: '文明', check: (w) => w.cities.filter((c) => c.alive).length >= 100 },
  { id: 'dynasty', name: '千年王朝', desc: '一个国家存续一千年', cat: '文明', check: (w) => alive(w).some((n) => w.tick - n.founded >= 4000) },
  { id: 'wonder', name: '奇观', desc: '建成第一座世界奇观', cat: '文明', check: (w) => Object.keys(w.wondersBuilt).length >= 1 },
  { id: 'wonders8', name: '奇观之世', desc: '建成八座世界奇观', cat: '文明', check: (w) => Object.keys(w.wondersBuilt).length >= 8 },
  { id: 'domestic', name: '驯化', desc: '文明驯化了一种动物', cat: '文明', check: (w) => w.species.some((s) => s.domestic != null) },
  { id: 'trade', name: '丝路', desc: '开辟跨国商路', cat: '文明', check: (w) => !!w.flags.firstTrade },
  { id: 'colony', name: '远航', desc: '跨海建立殖民地', cat: '文明', check: (w) => !!w.flags.firstColony },
  { id: 'archaeology', name: '考古', desc: '发掘古代文明的遗迹', cat: '文明', check: (w) => !!w.flags.archaeology },
  { id: 'industry', name: '蒸汽轰鸣', desc: '有文明进入蒸汽纪', cat: '科技', check: (w) => w.eraFirsts[6] != null },
  { id: 'atomic', name: '原子之火', desc: '有文明进入原子纪', cat: '科技', check: (w) => w.eraFirsts[8] != null },
  { id: 'stellar', name: '星海', desc: '有文明进入星海纪', cat: '科技', check: (w) => w.eraFirsts[10] != null },
  { id: 'ark', name: '离开摇篮', desc: '星舟方舟升空', cat: '科技', check: (w) => !!w.flags.arkLaunched },
  { id: 'deflect', name: '天外救世', desc: '文明用火箭拦截了末日彗星', cat: '科技', check: (w) => w.chronicle.some((e) => e.text.includes('推离了轨道')) },
  { id: 'war', name: '烽火', desc: '第一场战争', cat: '战争', check: (w) => w.nations.some((n) => Object.values(n.rel).some((r) => r.wars > 0)) },
  { id: 'worldWar', name: '世界大战', desc: '六国以上卷入同一时期的战争', cat: '战争', check: (w) => (w.worldWars || 0) > 0 },
  { id: 'nuke', name: '末日之火', desc: '核武器第一次被使用', cat: '战争', check: (w) => (w.nukes || 0) > 0 },
  { id: 'slayer', name: '屠龙者', desc: '英雄斩杀巨兽', cat: '战争', check: (w) => w.chronicle.some((e) => e.text.includes('斩杀了巨兽')) },
  { id: 'peace', name: '千年和平', desc: '三国以上的世界持续 300 年没有战争', cat: '战争', check: (w) => { const s = w.series; if (!s || s.wars.length < 2) return false; const yrs = 300 / w.seriesEvery; const n = s.wars.length; return n > yrs && s.wars.slice(n - yrs).every((v) => v === 0) && s.nations.slice(n - yrs).every((v) => v >= 3); } },
  { id: 'named', name: '你的名字', desc: '第一次有人为你命名', cat: '信仰', check: (w) => playerReligions(w).length > 0 },
  { id: 'manyNames', name: '千面之神', desc: '你拥有五个不同的尊号', cat: '信仰', check: (w) => new Set(playerReligions(w).map((r) => r.epithet)).size >= 5 },
  { id: 'prayer', name: '有求必应', desc: '回应十次祈祷', cat: '信仰', check: (w) => (w.divine.answered || 0) >= 10 },
  { id: 'schism', name: '异端', desc: '宗教分裂', cat: '信仰', check: (w) => w.chronicle.some((e) => e.text.includes('发生分裂')) },
  { id: 'million', name: '万众归心', desc: '一百万人信仰你', cat: '信仰', check: (w) => playerReligions(w).reduce((s, r) => s + (r.alive ? r.followers : 0), 0) >= 1e6 },
  { id: 'revolution', name: '革命', desc: '一场革命推翻旧政权', cat: '社会', check: (w) => w.chronicle.some((e) => e.text.includes('革命席卷') || e.text.includes('爆发内战')) },
  { id: 'collapse', name: '分崩离析', desc: '一个大国崩溃为数个继承国', cat: '社会', check: (w) => w.chronicle.some((e) => e.text.includes('分崩离析')) },
  { id: 'union', name: '合众', desc: '两国和平合并', cat: '社会', check: (w) => w.chronicle.some((e) => e.text.includes('和平合并')) },
  { id: 'plague', name: '大瘟疫', desc: '瘟疫夺去十万人的生命', cat: '社会', check: (w) => (w.plagueDeaths || 0) >= 100000 },
  { id: 'golden', name: '黄金时代', desc: '一个国家迎来黄金时代', cat: '社会', check: (w) => w.chronicle.some((e) => e.text.includes('黄金时代')) },
  { id: 'greenhouse', name: '温室星球', desc: '全球升温超过 4°C', cat: '自然', check: (w) => w.climate.offset >= 4 },
  { id: 'iceage', name: '冰河世纪', desc: '全球降温超过 5°C', cat: '自然', check: (w) => w.climate.offset <= -5 },
  { id: 'drowned', name: '沉没之城', desc: '一座城市被上涨的海水吞没', cat: '自然', check: (w) => !!w.flags.drownedCity },
  { id: 'volcano', name: '炎山', desc: '目睹一次火山喷发', cat: '自然', check: (w) => w.volcanoes.some((v) => v.eruptions > 0) },
  { id: 'portal', name: '虚空行者', desc: '打开虚空之门', cat: '奇术', check: (w) => !!w.flags.portal },
  { id: 'rewind', name: '时间旅人', desc: '回溯时间线', cat: '奇术', check: (w) => !!w.flags.rewound },
  { id: 'years10k', name: '万古', desc: '世界存在了一万年', cat: '自然', check: (w) => year(w) >= 10000 },
  { id: 'extinctCiv', name: '寂静', desc: '所有文明都已消失', cat: '文明', check: (w) => w.nations.length > 0 && alive(w).length === 0 },
];

export function checkAchievements(w) {
  w.achievements = w.achievements || {};
  for (const a of ACHIEVEMENTS) {
    if (w.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.check(w); } catch { ok = false; }
    if (ok) {
      w.achievements[a.id] = { tick: w.tick, year: year(w) };
      notify(w, { kind: 'achievement', id: a.id, name: a.name, desc: a.desc });
    }
  }
}
