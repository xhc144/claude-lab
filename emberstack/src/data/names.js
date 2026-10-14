// Given names for the people of the camp — short, plain names that read well on a card.

const A = ['阿', '小', '老', ''];
const SINGLE = '禾 苇 石 枫 岚 青 萤 梧 棠 荞 艾 杉 桐 栗 茗 汐 渚 砚 芊 鸢 晴 野 川 苓 菱 芷 柏 蒿 芦 椿 楠 柘 芸 麦 槐 葵 蓼 菖 茱 萍 樵 渔 炬 烛 焰 炎 灯 曦 晖 晨 霁 霖 雁 鹭 鹤 雀 燕 鸥 狸 鹿 熊'.split(' ');
const PAIRS = ['青禾', '石生', '秋苇', '寒枫', '暮岚', '萤火', '梧桐', '海棠', '春荞', '远山', '照夜', '拾光', '执炬', '守灯', '闻雪', '听雨', '望舒', '长庚', '启明', '南星', '北辰', '初阳', '燃犀', '星河', '归雁', '晚晴', '若木', '扶桑', '青黛', '素月', '白露', '霜降', '清明', '谷雨', '惊蛰', '小满', '芒种', '立夏', '冬至', '大寒', '知秋', '云起', '风行', '火生', '泉生', '石头', '木头', '豆子', '麦穗', '柿子'];

export function personName(rng) {
  if (rng.next() < 0.45) return rng.pick(PAIRS);
  const pre = rng.pick(A);
  return pre + rng.pick(SINGLE);
}
