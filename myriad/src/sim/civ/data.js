// Static tables of the civilisation layer: eras, technologies, buildings, wonders, governments,
// ideas and ruler traits. Effects are looked up by id in the civilisation code.

export const ERAS = [
  { name: '燧石纪', desc: '火与石器，口耳相传的时代', color: '#b49c7a' },
  { name: '铜火纪', desc: '农耕、畜牧与青铜，第一批村落', color: '#d08a4a' },
  { name: '铁律纪', desc: '文字、车轮与铁器，城邦崛起', color: '#a0a6b2' },
  { name: '经典纪', desc: '哲学、货币与航海，帝国与思想', color: '#e2c26a' },
  { name: '封建纪', desc: '城堡、神学与行会', color: '#8a7ac8' },
  { name: '启明纪', desc: '火药、印刷与科学方法', color: '#e89a5a' },
  { name: '蒸汽纪', desc: '煤与蒸汽，工厂与铁路', color: '#8b7f73' },
  { name: '电光纪', desc: '电力、内燃机与飞行', color: '#6ab4ff' },
  { name: '原子纪', desc: '核裂变、火箭与计算机', color: '#8af06a' },
  { name: '数智纪', desc: '网络、基因与智能', color: '#5ae0e0' },
  { name: '星海纪', desc: '飞向群星，或超越肉身', color: '#c88aff' },
];

// id, name, era, prerequisites, strategic resource that makes it effective, description
export const TECHS = [
  ['fire', '用火', 0, [], null, '驯服火焰：抵御寒冷，熟食养人'],
  ['tools', '石器', 0, [], null, '打制石器：狩猎与采集更高效'],
  ['oral', '口述传统', 0, [], null, '故事与祖训代代相传'],
  ['agriculture', '农耕', 1, ['fire', 'tools'], null, '开垦农田，人口大增，定居成为可能'],
  ['husbandry', '畜牧', 1, ['tools'], null, '驯化当地的温顺动物'],
  ['pottery', '制陶', 1, ['fire'], null, '储存粮食：粮仓'],
  ['bronze', '青铜', 1, ['fire', 'tools'], 'copper', '青铜兵器：军队更强（需铜矿）'],
  ['rafts', '舟筏', 1, ['tools'], null, '近海捕鱼，跨越狭窄水道'],
  ['mysticism', '祭祀', 1, ['oral'], null, '神祠与祭司，信仰制度化'],
  ['writing', '文字', 2, ['oral', 'pottery'], null, '记录与学问：书院'],
  ['wheel', '车轮', 2, ['husbandry'], null, '道路与车辆，贸易范围扩大'],
  ['iron', '冶铁', 2, ['bronze'], 'iron', '铁器：更强的军队与农具（需铁矿）'],
  ['masonry', '石工', 2, ['tools', 'pottery'], null, '城墙与石砌建筑'],
  ['calendar', '历法', 2, ['agriculture', 'mysticism'], null, '依时耕作，收成更稳'],
  ['currency', '货币', 3, ['writing', 'bronze'], null, '市集与贸易'],
  ['philosophy', '哲学', 3, ['writing', 'mysticism'], null, '思想开始传播与碰撞'],
  ['sailing', '航海', 3, ['rafts', 'writing'], null, '远洋殖民与海上贸易'],
  ['mathematics', '数学', 3, ['writing', 'calendar'], null, '攻城器械与精确工程'],
  ['law', '法典', 3, ['writing'], null, '成文法：国家更稳定'],
  ['engineering', '工程', 3, ['masonry', 'wheel', 'mathematics'], null, '引水渠、大型工程'],
  ['feudalism', '封建制', 4, ['law', 'iron'], null, '城堡与封臣'],
  ['theology', '神学', 4, ['philosophy'], null, '神庙与系统化的教义'],
  ['metallurgy', '冶金', 4, ['iron', 'engineering'], 'iron', '精钢与重甲'],
  ['compass', '罗盘', 4, ['sailing', 'mathematics'], null, '跨洋航行'],
  ['guilds', '行会', 4, ['currency', 'engineering'], null, '工坊与手工业'],
  ['gunpowder', '火药', 5, ['metallurgy'], null, '火器改变战争'],
  ['printing', '印刷', 5, ['guilds', 'theology'], null, '思想以前所未有的速度传播'],
  ['banking', '银行', 5, ['guilds'], null, '信用与资本'],
  ['optics', '光学', 5, ['compass', 'mathematics'], null, '望远镜与透镜'],
  ['science', '科学方法', 5, ['printing', 'optics'], null, '大学与系统研究'],
  ['steam', '蒸汽机', 6, ['science', 'metallurgy'], 'coal', '工业的心脏（需煤炭）'],
  ['railroad', '铁路', 6, ['steam'], 'coal', '铁路网与快速调兵'],
  ['industry', '工业化', 6, ['steam', 'banking'], 'coal', '工厂：生产力暴涨，污染随之而来'],
  ['medicine', '医学', 6, ['science'], null, '医院：瘟疫退却'],
  ['chemistry', '化学', 6, ['science'], null, '化肥与炸药'],
  ['electricity', '电力', 7, ['industry', 'chemistry'], null, '电网与夜晚的灯火'],
  ['combustion', '内燃机', 7, ['industry'], 'oil', '汽车与坦克（需石油）'],
  ['flight', '飞行', 7, ['combustion'], 'oil', '天空不再是边界'],
  ['radio', '无线电', 7, ['electricity'], null, '声音跨越大洋'],
  ['sanitation', '公共卫生', 7, ['medicine', 'industry'], null, '城市可以容纳更多人口'],
  ['fission', '核裂变', 8, ['electricity', 'chemistry'], 'uranium', '核电与核武器（需铀矿）'],
  ['rocketry', '火箭', 8, ['flight'], null, '弹道导弹与人造卫星'],
  ['computers', '计算机', 8, ['electricity', 'radio'], null, '信息革命的开端'],
  ['greenrev', '绿色革命', 8, ['chemistry', 'sanitation'], null, '粮食产量翻倍'],
  ['networks', '互联网', 9, ['computers'], null, '全球互联，观念瞬间传播'],
  ['genetics', '基因工程', 9, ['greenrev', 'computers'], null, '改造生命，甚至创造新物种'],
  ['renewables', '可再生能源', 9, ['electricity', 'computers'], null, '光伏与风电，污染下降'],
  ['ai', '人工智能', 9, ['networks'], null, '思考的机器'],
  ['spaceflight', '航天', 10, ['rocketry', 'computers'], null, '航天港与轨道'],
  ['terraforming', '行星工程', 10, ['renewables', 'genetics'], null, '主动调控气候'],
  ['colonization', '星际殖民', 10, ['spaceflight', 'ai'], null, '建造方舟，飞向群星'],
  ['singularity', '奇点', 10, ['ai', 'genetics'], null, '心智超越肉身'],
].map(([id, name, era, req, res, desc], i) => ({ id, i, name, era, req, res, desc }));

export const TECH = Object.fromEntries(TECHS.map((t) => [t.id, t]));
export const NTECH = TECHS.length;
export const techCost = (t) => 50 * Math.pow(2.45, t.era) * (1 + t.req.length * 0.1);

// buildings: id, name, tech, production cost, description
export const BUILDINGS = [
  ['granary', '粮仓', 'pottery', 40, '人口上限 +15%'],
  ['shrine', '神祠', 'mysticism', 30, '信仰 +，稳定 +'],
  ['walls', '城墙', 'masonry', 60, '城防 ×2'],
  ['barracks', '兵营', 'bronze', 50, '本城军队战力 +15%'],
  ['library', '书院', 'writing', 60, '科研 +40%'],
  ['market', '市集', 'currency', 70, '财富 +35%'],
  ['harbor', '港口', 'rafts', 60, '渔获 +，海上贸易'],
  ['aqueduct', '引水渠', 'engineering', 90, '人口上限 +30%'],
  ['temple', '神庙', 'theology', 90, '信仰 ++，稳定 +'],
  ['castle', '城堡', 'feudalism', 120, '城防 +，稳定 +'],
  ['workshop', '工坊', 'guilds', 110, '产能 +40%'],
  ['university', '大学', 'science', 160, '科研 +80%'],
  ['bank', '银行', 'banking', 150, '财富 +60%'],
  ['factory', '工厂', 'industry', 220, '产能 +100%，污染'],
  ['station', '火车站', 'railroad', 160, '贸易 +，调兵加速'],
  ['hospital', '医院', 'medicine', 180, '疾病 −，人口上限 +20%'],
  ['powerplant', '火电厂', 'electricity', 260, '产能 +80%，重度污染'],
  ['broadcast', '广播塔', 'radio', 200, '文化 +，观念传播 +'],
  ['airport', '机场', 'flight', 300, '贸易 +'],
  ['nuclear', '核电站', 'fission', 400, '产能 +100%，无污染，但有熔毁风险'],
  ['lab', '研究所', 'computers', 380, '科研 +120%'],
  ['solar', '光伏电站', 'renewables', 360, '取代火电，污染 −'],
  ['spaceport', '航天港', 'spaceflight', 600, '太空计划'],
  ['arcology', '生态穹城', 'terraforming', 700, '人口上限 +50%，污染 −'],
].map(([id, name, tech, cost, desc]) => ({ id, name, tech, cost, desc }));
export const BUILDING = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export const WONDERS = [
  ['stonecircle', '日石环', 'mysticism', 160, '世界上第一处圣地：信仰与文化'],
  ['skystair', '通天阶', 'masonry', 260, '向天而筑的阶梯：文化 ++'],
  ['scrollhall', '万卷阁', 'writing', 300, '汇聚一切文字：科研 ++'],
  ['bronzegiant', '铜铸巨像', 'currency', 320, '港口巨像：财富 ++'],
  ['rampart', '千里长垣', 'engineering', 420, '绵延的城墙：全国城防 +'],
  ['beacon', '潮汐灯塔', 'sailing', 360, '照亮海路：海上贸易 +'],
  ['dome', '圣冠穹顶', 'theology', 520, '信仰传播 ++'],
  ['canal', '大运河', 'guilds', 600, '南北通航：粮食与贸易 +'],
  ['observatory', '观星台', 'optics', 640, '凝望星空：科研 ++'],
  ['expo', '万国博览馆', 'industry', 900, '文化 ++，外交关系 +'],
  ['skymirror', '天穹巨镜', 'electricity', 1100, '巨型望远镜：科研 +++'],
  ['parliament', '世界议会', 'radio', 1300, '各国更倾向和平'],
  ['archive', '永恒档案馆', 'networks', 1600, '文明崩溃时知识不会失传'],
  ['tether', '天梯', 'spaceflight', 2200, '通往轨道的缆绳'],
  ['ark', '星舟方舟', 'colonization', 3000, '一部分人将离开这个世界，飞向群星'],
].map(([id, name, tech, cost, desc]) => ({ id, name, tech, cost, desc }));
export const WONDER = Object.fromEntries(WONDERS.map((x) => [x.id, x]));

// governments: suffix for nation names and modifiers
export const GOVS = {
  tribe: { name: '部落', suffix: '部落', stab: 0.05, war: 0.1, sci: 0.9, wealth: 0.8, succession: 'elder' },
  chiefdom: { name: '酋邦', suffix: '酋邦', stab: 0.05, war: 0.2, sci: 0.9, wealth: 0.9, succession: 'strongman' },
  monarchy: { name: '王国', suffix: '王国', stab: 0.1, war: 0.15, sci: 1, wealth: 1, succession: 'heredity' },
  empire: { name: '帝国', suffix: '帝国', stab: 0.05, war: 0.25, sci: 1, wealth: 1.05, succession: 'heredity' },
  theocracy: { name: '神权国', suffix: '神权国', stab: 0.15, war: 0.15, sci: 0.85, wealth: 0.95, succession: 'appointment' },
  republic: { name: '共和国', suffix: '共和国', stab: 0.05, war: 0.0, sci: 1.15, wealth: 1.1, succession: 'election' },
  oligarchy: { name: '商业寡头国', suffix: '商邦', stab: 0.0, war: -0.05, sci: 1.05, wealth: 1.3, succession: 'election' },
  democracy: { name: '民主联邦', suffix: '联邦', stab: 0.1, war: -0.15, sci: 1.25, wealth: 1.2, succession: 'election' },
  junta: { name: '军政府', suffix: '军政府', stab: -0.05, war: 0.35, sci: 0.9, wealth: 0.9, succession: 'strongman' },
  commune: { name: '公社联盟', suffix: '公社联盟', stab: 0.05, war: 0.05, sci: 1.1, wealth: 0.9, succession: 'election' },
  technocracy: { name: '技术官僚国', suffix: '技术共同体', stab: 0.1, war: -0.05, sci: 1.45, wealth: 1.1, succession: 'appointment' },
};

// ideas spread between cities like memes; each nudges culture values and favours a government
export const IDEAS = [
  { id: 'ancestors', name: '祖灵崇拜', tech: null, gov: null, v: { trad: 0.3, piety: 0.2 }, color: '#b8946a' },
  { id: 'divineRight', name: '君权神授', tech: 'mysticism', gov: 'monarchy', v: { trad: 0.25, piety: 0.2 }, color: '#e0b040' },
  { id: 'warrior', name: '尚武精神', tech: 'bronze', gov: 'junta', v: { mil: 0.4 }, color: '#d05040' },
  { id: 'mercantile', name: '重商主义', tech: 'currency', gov: 'oligarchy', v: { open: 0.35, coll: -0.1 }, color: '#e8c05a' },
  { id: 'republic', name: '共和理想', tech: 'philosophy', gov: 'republic', v: { trad: -0.2, coll: -0.15 }, color: '#5a9ae8' },
  { id: 'asceticism', name: '苦修之道', tech: 'philosophy', gov: null, v: { piety: 0.25, mil: -0.15 }, color: '#a08ad0' },
  { id: 'zeal', name: '宗教狂热', tech: 'theology', gov: 'theocracy', v: { piety: 0.45, open: -0.25, mil: 0.2 }, color: '#c040c0' },
  { id: 'chivalry', name: '骑士精神', tech: 'feudalism', gov: 'monarchy', v: { mil: 0.2, trad: 0.2 }, color: '#8080c0' },
  { id: 'humanism', name: '人文主义', tech: 'printing', gov: 'republic', v: { piety: -0.2, open: 0.25, trad: -0.25 }, color: '#f0a070' },
  { id: 'liberty', name: '自由主义', tech: 'printing', gov: 'democracy', v: { coll: -0.4, trad: -0.2 }, color: '#40b0f0' },
  { id: 'rationalism', name: '理性主义', tech: 'science', gov: 'technocracy', v: { piety: -0.45, trad: -0.3 }, color: '#60e0d0' },
  { id: 'nationalism', name: '民族主义', tech: 'industry', gov: 'empire', v: { mil: 0.3, open: -0.35, coll: 0.15 }, color: '#e06030' },
  { id: 'socialism', name: '公社主义', tech: 'industry', gov: 'commune', v: { coll: 0.5, trad: -0.2 }, color: '#e03050' },
  { id: 'pacifism', name: '和平主义', tech: 'radio', gov: 'democracy', v: { mil: -0.55 }, color: '#90e090' },
  { id: 'ecology', name: '生态主义', tech: 'renewables', gov: null, v: { trad: 0.1, coll: 0.15, mil: -0.2 }, color: '#50c050' },
  { id: 'technoUtopia', name: '技术乌托邦', tech: 'computers', gov: 'technocracy', v: { trad: -0.45, piety: -0.2 }, color: '#40f0ff' },
  { id: 'nihilism', name: '虚无主义', tech: 'networks', gov: null, v: { piety: -0.3, coll: -0.2 }, color: '#707080' },
  { id: 'transcendence', name: '超越主义', tech: 'ai', gov: 'technocracy', v: { trad: -0.3, piety: 0.2 }, color: '#d0a0ff' },
];
export const IDEA = Object.fromEntries(IDEAS.map((x) => [x.id, x]));

export const RULER_TRAITS = {
  ambitious: { name: '雄才', desc: '渴望扩张与荣耀', war: 0.25, expand: 0.3 },
  kind: { name: '仁厚', desc: '爱民如子，稳定上升', war: -0.15, stab: 0.08 },
  cruel: { name: '残暴', desc: '以恐惧统治，攻城后常屠城', war: 0.15, stab: -0.05, cruel: true },
  pious: { name: '虔诚', desc: '敬畏神明，信仰兴盛', faith: 0.3 },
  greedy: { name: '贪婪', desc: '国库充盈，民怨渐生', wealth: 0.2, stab: -0.05 },
  wise: { name: '睿智', desc: '礼贤下士，科研兴盛', sci: 0.25 },
  weak: { name: '懦弱', desc: '优柔寡断，权臣当道', stab: -0.08, war: -0.1 },
  mad: { name: '癫狂', desc: '行事无常，令人恐惧', war: 0.4, stab: -0.1, mad: true },
  warlike: { name: '好战', desc: '以战为荣', war: 0.35 },
  diplomat: { name: '纵横', desc: '长于外交与结盟', war: -0.2, diplo: 0.3 },
  builder: { name: '营造', desc: '热衷于宏伟工程', build: 0.4 },
  scholar: { name: '博学', desc: '自己便是学者', sci: 0.15, culture: 0.2 },
};

export const PERSON_ROLES = {
  ruler: '统治者', general: '名将', scientist: '学者', prophet: '先知', artist: '艺术家',
  explorer: '探险家', merchant: '巨贾', rebel: '起义领袖', hero: '英雄', thinker: '思想家',
};
