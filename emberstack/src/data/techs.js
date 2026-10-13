// The tech tree: six eras, 48 technologies. Research is paid with 灵感 (insight) cards taken from
// the board — the AI pays exactly the same way. `bonus` keys are read by the simulation.

export const ERAS = [
  { id: 1, name: '薪火', en: 'EMBER', color: '#e8894a' },
  { id: 2, name: '耕作', en: 'TILLAGE', color: '#9dbb5a' },
  { id: 3, name: '青铜', en: 'BRONZE', color: '#d39a52' },
  { id: 4, name: '铁与灯', en: 'IRON', color: '#8fa3b5' },
  { id: 5, name: '典籍', en: 'LETTERS', color: '#7fa7d8' },
  { id: 6, name: '机巧', en: 'CLOCKWORK', color: '#c58ad8' },
];

export const TECHS = Object.create(null);
function T(id, name, era, cost, req, desc, extra = {}) {
  TECHS[id] = { id, name, era, cost, req, desc, items: extra.items || null, bonus: extra.bonus || null, icon: extra.icon || id };
}

// era 1
T('fire', '取火', 1, 0, [], '用燧石与木材生起篝火。');
T('stone_tools', '石器', 1, 2, [], '石斧、石镐与木棒。');
T('shelter', '庇护', 1, 2, ['fire'], '窝棚：人口得以繁衍。');
T('cooking', '炙烤', 1, 2, ['fire'], '在篝火上烤熟食物；晾架风干肉干。');
T('fishing', '渔猎', 1, 2, [], '钓竿让捕鱼更快。');
T('hunting', '狩猎', 1, 3, ['stone_tools'], '木矛与矛兵。');
T('torches', '火把', 1, 3, ['fire'], '火把与火把桩，把光带进黑暗。');
T('lore', '口述', 1, 2, ['fire'], '篝火边的夜话会带来灵感；墓碑可以立成石冢。');
// era 2
T('farming', '农耕', 2, 5, ['stone_tools'], '锄头、田地与农人。');
T('pottery', '制陶', 2, 4, ['fire'], '陶窑、陶罐与木炭。');
T('weaving', '编织', 2, 4, [], '绳索、织机与布匹。');
T('herbalism', '草药', 2, 4, ['cooking'], '药囊、绷带、疗伤药与医者。');
T('carpentry', '木工', 2, 5, ['stone_tools'], '工作台、木板、木屋、工具箱与工匠、木栅、木盾。');
T('husbandry', '驯养', 2, 5, ['weaving'], '畜栏、驯服野兽、鞣皮与皮甲。');
T('archery', '弓术', 2, 5, ['hunting', 'weaving'], '弓与弓手。');
T('storage', '储藏', 2, 4, ['pottery'], '谷仓。所有食物腐坏变慢。', { bonus: { spoilMult: 1.5 } });
// era 3
T('masonry', '石工', 3, 7, ['pottery'], '砖、石屋、石墙与水井；火塘。');
T('mining', '采矿', 3, 6, ['stone_tools'], '开采矿脉，训练矿工。');
T('smelting', '冶炼', 3, 7, ['mining', 'pottery'], '熔炉：铜锭与锡。');
T('bronze', '青铜', 3, 8, ['smelting'], '青铜锭、锻炉、青铜工具、青铜剑与青铜甲。');
T('trade', '贸易', 3, 6, ['weaving'], '集市、秤与行商；商栈。');
T('writing', '文字', 3, 7, ['lore'], '纸、书卷、学者与书斋。');
T('milling', '磨坊', 3, 7, ['farming', 'masonry'], '磨坊与烘炉：面包。');
T('curing', '腌制', 3, 5, ['cooking'], '盐渍咸鱼与肉干、熏房。');
// era 4
T('iron', '铁器', 4, 11, ['bronze'], '铁锭、铁斧铁镐、铁剑与铁甲、铁锤。');
T('fortification', '筑城', 4, 10, ['masonry', 'carpentry'], '瞭望塔。所有墙体生命 +50%。', { bonus: { wallHp: 1.5 } });
T('medicine', '医学', 4, 10, ['herbalism', 'writing'], '医馆。所有人每个黎明额外回复 1 点生命。', { bonus: { regen: 1 } });
T('sailing', '航海', 4, 9, ['carpentry', 'weaving'], '船坞与舟：出海探索。渔网。');
T('lamplight', '灯艺', 4, 9, ['pottery', 'smelting'], '油坊、灯笼、灯柱与掌灯人。');
T('tactics', '战术', 4, 9, ['bronze'], '锤卫。所有士兵攻击 +1。', { bonus: { soldierAtk: 1 } });
T('mathematics', '算学', 4, 10, ['writing'], '一切建造速度 +20%。', { bonus: { buildSpeed: 1.2 } });
T('horsemanship', '骑术', 4, 11, ['husbandry', 'iron'], '骑卫。');
// era 5
T('philosophy', '哲思', 5, 14, ['writing', 'mathematics'], '藏书阁与贤者。');
T('astronomy', '天文', 5, 14, ['mathematics'], '观星台、星图与望远镜。');
T('glassmaking', '琉璃', 5, 13, ['masonry', 'smelting'], '琉璃坊与琉璃。');
T('architecture', '营造', 5, 15, ['glassmaking', 'fortification'], '灯塔。');
T('alchemy', '炼丹', 5, 15, ['medicine', 'smelting'], '炼丹房、火药与灵药。');
T('navigation', '导航', 5, 13, ['sailing', 'astronomy'], '罗盘与水手；海上探索更快。', { bonus: { sailSpeed: 1.3 } });
T('civics', '礼制', 5, 12, ['writing'], '灯龛、庆典台与盛宴、纪念碑。');
T('banking', '钱庄', 5, 13, ['trade', 'mathematics'], '金锭；集市售价 +25%。', { bonus: { sellMult: 1.25 } });
// era 6
T('clockwork', '机关', 6, 18, ['mathematics', 'iron'], '机关坊、齿轮与机工。');
T('steam', '蒸汽', 6, 20, ['clockwork'], '蒸汽核心与蒸汽机。');
T('firearms', '火器', 6, 20, ['alchemy', 'iron'], '火铳与火铳手。');
T('automata', '傀儡', 6, 24, ['steam'], '机关傀儡：不吃饭的工人。');
T('beacon_lore', '烽燧', 6, 20, ['architecture', 'civics'], '烽燧、圣焰与守火者。');
T('great_flame', '大薪火', 6, 28, ['beacon_lore', 'steam'], '大薪火基座。');
T('aether', '以太', 6, 22, ['alchemy', 'astronomy'], '以太灯。');
T('shadowcraft', '驭影', 4, 8, ['lamplight'], '以影尘为材料：月光灯与驱影香。');

export const TECH_IDS = Object.keys(TECHS);

/** all prerequisites (transitively) of a tech, in research order */
export function techPath(id, have = new Set()) {
  const out = [];
  const seen = new Set();
  (function visit(t) {
    if (seen.has(t) || have.has(t)) return;
    seen.add(t);
    for (const r of TECHS[t].req) visit(r);
    out.push(t);
  })(id);
  return out;
}
