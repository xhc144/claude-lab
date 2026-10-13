// Procedural languages. Each culture draws its own sound inventory — a subset of onsets, vowels and
// codas with preferred syllable shapes and favourite word endings — so all names from one culture
// sound related. Names are built as romanised syllables and rendered in Chinese the way foreign
// names are transliterated (Va-len-ti-a → 瓦伦提亚). When a nation splits, its language drifts:
// sounds shift (k→g, s→sh, l→r…), so successor states keep a family resemblance.

import { RNG } from './rng.js';

// onset × vowel → transliteration character
const TABLE = {
  '': { a: '阿', e: '埃', i: '伊', o: '奥', u: '乌' },
  b: { a: '巴', e: '贝', i: '比', o: '博', u: '布' },
  p: { a: '帕', e: '佩', i: '皮', o: '波', u: '普' },
  m: { a: '马', e: '梅', i: '米', o: '莫', u: '穆' },
  f: { a: '法', e: '费', i: '菲', o: '佛', u: '弗' },
  d: { a: '达', e: '德', i: '迪', o: '多', u: '杜' },
  t: { a: '塔', e: '特', i: '提', o: '托', u: '图' },
  n: { a: '纳', e: '内', i: '尼', o: '诺', u: '努' },
  l: { a: '拉', e: '莱', i: '利', o: '洛', u: '卢' },
  r: { a: '拉', e: '雷', i: '里', o: '罗', u: '鲁' },
  g: { a: '加', e: '格', i: '吉', o: '戈', u: '古' },
  k: { a: '卡', e: '克', i: '基', o: '科', u: '库' },
  h: { a: '哈', e: '赫', i: '希', o: '霍', u: '胡' },
  s: { a: '萨', e: '塞', i: '西', o: '索', u: '苏' },
  sh: { a: '莎', e: '舍', i: '希', o: '朔', u: '舒' },
  z: { a: '扎', e: '泽', i: '齐', o: '佐', u: '祖' },
  v: { a: '瓦', e: '维', i: '薇', o: '沃', u: '武' },
  w: { a: '娃', e: '威', i: '维', o: '沃', u: '吴' },
  y: { a: '雅', e: '耶', i: '伊', o: '约', u: '尤' },
  th: { a: '萨', e: '瑟', i: '西', o: '索', u: '苏' },
  kh: { a: '喀', e: '赫', i: '奇', o: '霍', u: '胡' },
  j: { a: '贾', e: '杰', i: '吉', o: '乔', u: '朱' },
  ch: { a: '查', e: '切', i: '奇', o: '乔', u: '楚' },
  q: { a: '恰', e: '切', i: '琪', o: '邱', u: '曲' },
};
// syllables ending in -n have their own common characters
const TABLE_N = {
  '': { a: '安', e: '恩', i: '因', o: '昂', u: '温' },
  b: { a: '班', e: '本', i: '宾', o: '邦', u: '本' },
  d: { a: '丹', e: '登', i: '丁', o: '东', u: '敦' },
  t: { a: '坦', e: '滕', i: '廷', o: '通', u: '屯' },
  l: { a: '兰', e: '伦', i: '林', o: '隆', u: '伦' },
  r: { a: '兰', e: '伦', i: '林', o: '隆', u: '伦' },
  m: { a: '曼', e: '门', i: '明', o: '蒙', u: '蒙' },
  k: { a: '坎', e: '肯', i: '金', o: '孔', u: '昆' },
  g: { a: '甘', e: '根', i: '金', o: '贡', u: '衮' },
  s: { a: '桑', e: '森', i: '辛', o: '松', u: '孙' },
  v: { a: '万', e: '文', i: '文', o: '冯', u: '温' },
  h: { a: '汉', e: '亨', i: '欣', o: '洪', u: '浑' },
  z: { a: '赞', e: '曾', i: '津', o: '宗', u: '尊' },
  n: { a: '南', e: '嫩', i: '宁', o: '农', u: '嫩' },
  p: { a: '潘', e: '彭', i: '平', o: '庞', u: '彭' },
  f: { a: '凡', e: '芬', i: '芬', o: '丰', u: '丰' },
  j: { a: '詹', e: '珍', i: '金', o: '琼', u: '君' },
  y: { a: '延', e: '彦', i: '因', o: '雍', u: '云' },
  w: { a: '万', e: '温', i: '温', o: '翁', u: '温' },
  sh: { a: '山', e: '申', i: '欣', o: '尚', u: '顺' },
  ch: { a: '钱', e: '岑', i: '钦', o: '琼', u: '春' },
  q: { a: '钱', e: '琴', i: '钦', o: '琼', u: '群' },
  th: { a: '桑', e: '森', i: '辛', o: '松', u: '孙' },
  kh: { a: '汗', e: '亨', i: '欣', o: '洪', u: '浑' },
};
const CODA = { r: '尔', s: '斯', l: '尔', k: '克', m: '姆', th: '斯', x: '克斯', d: '德', t: '特', g: '格', sh: '什' };

const ONSETS = Object.keys(TABLE).filter((o) => o !== '');
const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const CODAS = ['n', 'r', 's', 'l', 'k', 'm', 'th', 'd', 't', 'sh'];
const SHIFT = { k: 'g', g: 'kh', kh: 'h', h: 'k', b: 'p', p: 'f', f: 'v', v: 'w', w: 'b', d: 't', t: 'th', th: 'd', s: 'sh', sh: 'z', z: 's', l: 'r', r: 'l', m: 'n', n: 'm', j: 'ch', ch: 'q', q: 'j', y: '' };

/** create a language from a seed */
export function makeLanguage(seed) {
  const rng = new RNG(seed);
  const onsets = rng.shuffle(ONSETS.slice()).slice(0, 7 + rng.int(7));
  if (rng.chance(0.5)) onsets.push(''); // vowel-initial syllables allowed
  const vowels = rng.shuffle(VOWELS.slice()).slice(0, 3 + rng.int(3));
  const codas = rng.shuffle(CODAS.slice()).slice(0, 1 + rng.int(4));
  const lang = {
    seed,
    onsets,
    oW: onsets.map(() => 0.3 + rng.next()),
    vowels,
    vW: vowels.map(() => 0.3 + rng.next()),
    codas,
    codaP: rng.range(0.05, 0.45),
    minSyl: rng.chance(0.3) ? 1 : 2,
    maxSyl: 2 + rng.int(2),
    endings: [],
    // the language's favourite word endings, used for place names
    drift: 0,
  };
  for (let k = 0; k < 3; k++) lang.endings.push(syllable(lang, rng, true));
  return lang;
}

function pickW(rng, items, weights) {
  let t = 0;
  for (const w of weights) t += w;
  let r = rng.next() * t;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r < 0) return items[i]; }
  return items[items.length - 1];
}

/** one syllable: {r: romanisation, z: chinese} */
function syllable(lang, rng, allowCoda = true) {
  const o = pickW(rng, lang.onsets, lang.oW);
  const v = pickW(rng, lang.vowels, lang.vW);
  let coda = '';
  if (allowCoda && rng.next() < lang.codaP) coda = rng.pick(lang.codas);
  let z;
  if (coda === 'n' && TABLE_N[o]) z = TABLE_N[o][v];
  else z = TABLE[o][v] + (coda && coda !== 'n' ? CODA[coda] || '' : coda === 'n' ? '恩' : '');
  return { r: o + v + coda, z };
}

function build(lang, rng, nSyl, ending = false) {
  let r = '', z = '';
  let prev = '';
  for (let k = 0; k < nSyl; k++) {
    const last = k === nSyl - 1;
    let s;
    for (let t = 0; t < 6; t++) {
      s = last && ending && lang.endings.length && rng.chance(0.55) ? rng.pick(lang.endings) : syllable(lang, rng, last || rng.chance(0.3));
      if (s.z !== prev && !(s.r === 'yi' || s.r === 'wu' || s.r.startsWith('yi') || s.r.startsWith('wu'))) break;
    }
    prev = s.z;
    r += s.r; z += s.z;
  }
  return { r: r.charAt(0).toUpperCase() + r.slice(1), z };
}

/** a word with a syllable count between the language's limits; maxChars bounds the Chinese length */
export function word(lang, rng, opts = {}) {
  const lo = opts.min ?? lang.minSyl, hi = opts.max ?? lang.maxSyl;
  for (let t = 0; t < 8; t++) {
    const n = lo + rng.int(hi - lo + 1);
    const w = build(lang, rng, n, opts.ending);
    if (w.z.length <= (opts.maxChars || 4)) return w;
  }
  return build(lang, rng, 1, false);
}

export const placeName = (lang, rng) => word(lang, rng, { min: 2, max: 3, ending: true, maxChars: 4 });
export const personName = (lang, rng) => word(lang, rng, { min: 2, max: 2, maxChars: 3 });
export const dynastyName = (lang, rng) => word(lang, rng, { min: 1, max: 2, maxChars: 2 });

/** a drifted daughter language */
export function driftLanguage(lang, seed) {
  const rng = new RNG(seed);
  const d = JSON.parse(JSON.stringify(lang));
  d.seed = seed;
  d.drift = (lang.drift || 0) + 1;
  for (let k = 0; k < d.onsets.length; k++) {
    if (rng.chance(0.3) && SHIFT[d.onsets[k]] !== undefined) d.onsets[k] = SHIFT[d.onsets[k]];
  }
  if (rng.chance(0.4)) d.vowels[rng.int(d.vowels.length)] = rng.pick(VOWELS);
  d.vowels = [...new Set(d.vowels)];
  d.vW = d.vowels.map(() => 0.3 + rng.next());
  d.onsets = [...new Set(d.onsets)];
  d.oW = d.onsets.map(() => 0.3 + rng.next());
  d.codaP = Math.min(0.6, Math.max(0.02, d.codaP + rng.range(-0.1, 0.1)));
  if (rng.chance(0.5)) d.endings[rng.int(d.endings.length)] = syllable(d, rng, true);
  return d;
}
