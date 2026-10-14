// Random events that can befall a camp at dawn. Event cards wait on the board for a decision;
// instant events happen at once. Every choice lists exactly what it costs and yields, so a player
// (or the AI) can weigh it. `effect` keys are implemented in sim/eventsim.js.

export const EVENTS = Object.create(null);
function E(id, e) { EVENTS[id] = { id, w: 1, minDay: 2, bio: null, timeout: 2, def: -1, ...e }; }

E('wanderer', {
  name: '流浪者', card: 'wanderer', art: 'wanderer', w: 3,
  text: '一个裹着破毯子的人在营地边缘停下，望着火光。「我能留下吗？我会干活。」',
  choices: [
    { label: '接纳（给他 2 份食物）', give: [['#food', 2]], get: [['survivor', 1]] },
    { label: '请他离开', give: [], get: [] },
  ],
  def: 1,
});
E('refugees', {
  name: '难民', card: 'refugees', art: 'refugees', w: 1.2, minDay: 4,
  text: '一群逃离灰雾的人来到营地，老人、孩子，还有几个拿着棍棒的青年。',
  choices: [
    { label: '全部接纳（6 份食物）', give: [['#food', 6]], get: [['survivor', 2], ['child', 1]] },
    { label: '只收留孩子（2 份食物）', give: [['#food', 2]], get: [['child', 1]] },
    { label: '拒绝（灰雾 +3）', give: [], get: [], fog: 3 },
  ],
  def: 2,
});
E('scholar_visit', {
  name: '游学者', card: 'omen', art: 'scholar', w: 1, minDay: 3,
  text: '一位背着竹简的游学者愿意用见闻交换一顿饭。',
  choices: [
    { label: '请他吃饭（3 份食物 → 2 份灵感）', give: [['#food', 3]], get: [['insight', 2]] },
    { label: '买下他的残卷（3 铜贝）', give: [['coin', 3]], get: [['scroll', 1]] },
    { label: '谢绝', give: [], get: [] },
  ],
  def: 2,
});
E('sick_traveller', {
  name: '病倒的旅人', card: 'omen', art: 'sick', w: 0.8, minDay: 5,
  text: '营地外躺着一个发烧的旅人，怀里紧紧抱着一本书。',
  choices: [
    { label: '用疗伤药救他（得到典籍）', give: [['potion', 1]], get: [['tome', 1], ['survivor', 1]] },
    { label: '用草药照料（2 草药，他会留下）', give: [['herb', 2]], get: [['survivor', 1]] },
    { label: '无能为力（灰雾 +2）', give: [], get: [], fog: 2 },
  ],
  def: 2,
});
E('tribute', {
  name: '盗匪的勒索', card: 'omen', art: 'bandit', w: 1, minDay: 4, bio: ['mountain', 'marsh', 'valley', 'isles'],
  text: '一支箭钉在营地的木桩上，箭杆上绑着字条：「交出 5 个铜贝，否则今夜见。」',
  choices: [
    { label: '交钱（5 铜贝）', give: [['coin', 5]], get: [] },
    { label: '拒绝，准备迎战（今夜盗匪来袭）', give: [], get: [], effect: 'raid' },
  ],
  def: 1,
});
E('cache', {
  name: '遗落的箱子', kind: 'instant', art: 'cache', w: 1.2,
  text: '巡夜的人在灰雾边缘发现了一只被遗弃的箱子。', effect: 'cache',
});
E('storm', {
  name: '暴风', kind: 'instant', art: 'storm', w: 1, minDay: 3,
  text: '狂风卷过营地，所有火焰都被压低了。每处火源失去 2 份燃料，火把熄灭。', effect: 'storm',
});
E('eclipse', {
  name: '日蚀', kind: 'instant', art: 'eclipse', w: 0.5, minDay: 6,
  text: '太阳被吞没了。今天将一直是黑夜。', effect: 'eclipse',
});
E('meteor', {
  name: '流星', kind: 'instant', art: 'meteor', w: 0.5, minDay: 5,
  text: '一颗流星划过天空，坠落在不远处，留下一个冒烟的陨坑。', effect: 'meteor',
});
E('aurora', {
  name: '极光', kind: 'instant', art: 'aurora', w: 0.7, minDay: 3, bio: ['tundra', 'isles', 'mountain'],
  text: '天空中流动着绿色的光带。人们仰望着它，觉得长夜没那么可怕了。灰雾 -6，并获得 1 份灵感。', effect: 'aurora',
});
E('harvest_moon', {
  name: '丰收月', kind: 'instant', art: 'harvest', w: 0.8, minDay: 3,
  text: '圆月高悬，人们精神百倍。今天所有采集与耕作速度 ×1.5。', effect: 'harvest_moon',
});
E('plague', {
  name: '疫病', kind: 'instant', art: 'plague', w: 0.7, minDay: 6,
  text: '有人开始发热咳嗽。染病的人每天失去 1 点生命、劳作变慢，直到用药或在医馆治愈。（有水井可以避免）', effect: 'plague',
});
E('migration', {
  name: '兽群迁徙', kind: 'instant', art: 'migration', w: 1, minDay: 2,
  text: '大地在震动——一群野兽正从营地附近经过。', effect: 'migration',
});
E('wolf_howl', {
  name: '狼嚎', kind: 'instant', art: 'wolves', w: 0.9, minDay: 3, bio: ['valley', 'forest', 'mountain', 'tundra'],
  text: '远处传来狼嚎。今夜狼群会来。', effect: 'wolves',
});
E('ash_tide', {
  name: '灰潮', kind: 'instant', art: 'ashtide', w: 0.8, minDay: 5, needShades: true,
  text: '灰雾像潮水一样涌来。灰雾 +6，今夜暗影加倍。', effect: 'ash_tide',
});
E('flood_warning', {
  name: '洪水预警', kind: 'instant', art: 'flood', w: 0, minDay: 3,
  text: '河水在上涨。明天黎明，洪水将冲走低处没有堤坝保护的物资。', effect: 'flood_warning',
});
E('festival_mood', {
  name: '篝火之歌', kind: 'instant', art: 'song', w: 0.8, minDay: 2,
  text: '有人在篝火边唱起了旧日的歌。灰雾 -3。', effect: 'song',
});
E('lost_scout', {
  name: '迷路的斥候', card: 'omen', art: 'scout', w: 0.6, minDay: 5,
  text: '一个疲惫的斥候带着地图来到营地。他愿意用地图换一顿饱饭。',
  choices: [
    { label: '交换（3 份食物 → 地图）', give: [['#food', 3]], get: [['map', 1]] },
    { label: '邀请他加入（5 份食物）', give: [['#food', 5]], get: [['scout', 1]] },
    { label: '谢绝', give: [], get: [] },
  ],
  def: 2,
});
E('old_smith', {
  name: '老铁匠', card: 'omen', art: 'smith', w: 0.6, minDay: 6, bio: ['mountain', 'ash', 'tundra', 'isles'],
  text: '一个老铁匠路过营地，愿意替你们打一件东西。',
  choices: [
    { label: '打一把铁剑（2 铁锭）', give: [['iron', 2]], get: [['iron_sword', 1]] },
    { label: '打一副青铜甲（3 青铜锭）', give: [['bronze', 3]], get: [['bronze_armor', 1]] },
    { label: '请他歇歇脚就好', give: [], get: [] },
  ],
  def: 2,
});
E('shrine_found', {
  name: '古老的灯龛', kind: 'instant', art: 'shrine', w: 0.4, minDay: 4,
  text: '探路的人在雾里找到一座仍然完好的古老灯龛，把它搬回了营地。', effect: 'shrine',
});

/** event ids allowed in a biome by default */
export function eventsForBiome(bio) {
  return Object.values(EVENTS).filter((e) => !e.bio || e.bio.includes(bio)).map((e) => e.id);
}
