// Genomes. Every creature carries NG genes in [0, 1]; its body plan, diet, climate preference,
// life history, brain and behaviour are all read off them. Offspring inherit a copy with small
// gaussian mutations (and rare large jumps), so populations drift, adapt to where they live and,
// once separated long enough, split into new species.

import { G, NG } from '../constants.js';
import { clamp } from '../../core/util.js';

// weights of each gene in the genetic distance used for speciation
export const GENE_WEIGHT = new Float32Array([1, 0.8, 1.2, 0.8, 1.3, 0.6, 0.5, 0.5, 0.8, 0.6, 0.6, 0.7, 1.1, 0.7, 0.4]);
const WSUM = GENE_WEIGHT.reduce((a, b) => a + b, 0);

export const HAB_WATER = 0;
export const HAB_AMPHI = 1;
export const HAB_LAND = 2;

/** habitat class of a habitat gene */
export const habitatOf = (g) => (g < 0.33 ? HAB_WATER : g < 0.62 ? HAB_AMPHI : HAB_LAND);

/** weighted RMS distance between genome a (at offset ai) and b (at offset bi) */
export function geneticDistance(a, ai, b, bi) {
  let s = 0;
  for (let k = 0; k < NG; k++) {
    const d = a[ai + k] - b[bi + k];
    s += GENE_WEIGHT[k] * d * d;
  }
  return Math.sqrt(s / WSUM);
}

/** copy parent genome into child with mutation; sigma scales with the world's evolution rate */
export function mutateInto(dst, di, src, si, rng, sigma) {
  const big = rng.next() < 0.015; // a rare macro-mutation lets new body plans appear
  for (let k = 0; k < NG; k++) {
    let v = src[si + k] + rng.gauss() * sigma;
    if (big && rng.next() < 0.25) v += rng.gauss() * 0.15;
    dst[di + k] = clamp(v, 0, 1);
  }
}

/** derived traits, written into `t` (a plain object reused by callers) */
export function phenotype(g, o, t) {
  const size = 0.15 + g[o + G.size] * 1.85;
  const hab = habitatOf(g[o + G.habitat]);
  const fly = g[o + G.flight] > 0.75 && size < 1.0 && hab !== HAB_WATER;
  const armor = g[o + G.armor];
  const intel = g[o + G.intellect];
  t.size = size;
  t.hab = hab;
  t.fly = fly;
  t.diet = g[o + G.diet];
  t.speed = (0.15 + g[o + G.speed] * 0.5) * (1 - armor * 0.35) * (fly ? 1.5 : 1) * (hab === HAB_AMPHI ? 0.9 : 1);
  t.topt = -16 + g[o + G.warmth] * 50;
  t.tol = 10 + size * 3 + armor * 2;
  t.maxAge = (24 + g[o + G.longevity] * 110) * (0.75 + size * 0.25);
  t.sense = 1.5 + g[o + G.sense] * 5;
  t.intel = intel;
  t.social = g[o + G.social];
  t.aggr = g[o + G.aggression];
  t.armor = armor;
  t.litter = 1 + Math.floor(g[o + G.fertility] * 2.99);
  t.emax = 1 + size;
  t.metab = Math.pow(size, 0.75) * (
    0.03 +
    0.016 * g[o + G.speed] * g[o + G.speed] +
    0.026 * intel * intel +
    (fly ? 0.012 : 0) +
    0.006 * armor +
    0.006 * g[o + G.fertility] +
    0.004 * g[o + G.sense]);
  t.power = size * (0.55 + t.aggr * 0.65) * (1 + intel * 0.35);
  t.defense = size * (0.45 + armor * 1.1) + t.speed * 0.8;
  t.form = bodyForm(g, o, size, hab, fly);
  return t;
}

// body forms (also used to draw creatures)
export const FORM = { FISH: 0, WHALE: 1, SHRIMP: 2, SHARK: 3, FROG: 4, NEWT: 5, CROC: 6, BIRD: 7, RAPTOR: 8, MOTH: 9, RODENT: 10, HARE: 11, DEER: 12, BOVINE: 13, BEHEMOTH: 14, MUSTELID: 15, FOX: 16, WOLF: 17, TIGER: 18, DRAGON: 19, BOAR: 20, APE: 21, TURTLE: 22, LIZARD: 23 };
export const FORM_CHAR = ['鱼', '鲸', '虾', '鲨', '蛙', '螈', '鳄', '鸟', '鹰', '蛾', '鼠', '兔', '鹿', '牛', '象', '鼬', '狐', '狼', '虎', '龙', '猪', '猿', '龟', '蜥'];

export function bodyForm(g, o, size, hab, fly) {
  const diet = g[o + G.diet], armor = g[o + G.armor], speed = g[o + G.speed], intel = g[o + G.intellect];
  if (armor > 0.72 && speed < 0.35) return FORM.TURTLE;
  if (hab === HAB_WATER) {
    if (size < 0.4) return FORM.SHRIMP;
    if (diet > 0.6 && size > 0.9) return FORM.SHARK;
    if (size > 1.45) return FORM.WHALE;
    return FORM.FISH;
  }
  if (fly) {
    if (size < 0.35) return FORM.MOTH;
    return diet > 0.6 ? FORM.RAPTOR : FORM.BIRD;
  }
  if (hab === HAB_AMPHI) {
    if (diet > 0.6 && size > 0.9) return FORM.CROC;
    if (size < 0.55) return FORM.FROG;
    return g[o + G.pattern] > 0.5 ? FORM.LIZARD : FORM.NEWT;
  }
  if (size > 1.6) return diet > 0.62 ? FORM.DRAGON : FORM.BEHEMOTH;
  if (diet > 0.64) return size < 0.5 ? FORM.MUSTELID : size < 0.85 ? FORM.FOX : size < 1.25 ? FORM.WOLF : FORM.TIGER;
  if (diet > 0.36) return intel > 0.45 ? FORM.APE : size < 0.5 ? FORM.RODENT : FORM.BOAR;
  if (size < 0.42) return FORM.RODENT;
  if (size < 0.7) return FORM.HARE;
  if (size < 1.2) return FORM.DEER;
  return FORM.BOVINE;
}

// ---- naming --------------------------------------------------------------------------------------

const HUE_CHARS = [[15, '赤'], [40, '橙'], [65, '金'], [150, '碧'], [195, '青'], [250, '蓝'], [295, '紫'], [335, '绯'], [360, '赤']];
export function hueChar(h) {
  for (const [lim, ch] of HUE_CHARS) if (h * 360 <= lim) return ch;
  return '赤';
}

const PARTS = ['角', '鳞', '羽', '须', '尾', '冠', '斑', '爪', '脊', '鬃'];

/** most distinctive trait of a genome → one character */
export function featureChar(g, o, rngVal) {
  const c = [
    [g[o + G.armor] - 0.62, '甲'],
    [g[o + G.aggression] - 0.7, g[o + G.diet] > 0.5 ? '牙' : '角'],
    [g[o + G.social] - 0.72, '群'],
    [g[o + G.speed] - 0.72, '疾'],
    [g[o + G.intellect] - 0.55, '智'],
    [g[o + G.fertility] - 0.8, '繁'],
    [0.22 - g[o + G.warmth], '雪'],
    [g[o + G.warmth] - 0.8, '炎'],
    [g[o + G.size] - 0.82, '巨'],
    [0.1 - g[o + G.size], '微'],
    [g[o + G.sense] - 0.8, '瞳'],
    [g[o + G.longevity] - 0.82, '寿'],
    [g[o + G.flight] - 0.85, '翼'],
  ];
  c.sort((a, b) => b[0] - a[0]);
  if (c[0][0] > 0) return c[0][1];
  return PARTS[Math.floor(rngVal * PARTS.length)];
}

const LAT_SYL = ['va', 'ru', 'tor', 'mel', 'ka', 'phy', 'lo', 'den', 'ar', 'sil', 'ne', 'gor', 'thal', 'ix', 'or', 'bran', 'ce', 'mi', 'pal', 'xen', 'dra', 'quo', 'lu', 'ste'];
const FORM_LAT = ['ichthys', 'cetus', 'caris', 'selache', 'rana', 'triton', 'suchus', 'ornis', 'aquila', 'lepis', 'mys', 'lagus', 'cervus', 'bos', 'therium', 'mustela', 'vulpes', 'lupus', 'felis', 'draco', 'sus', 'pithecus', 'testudo', 'saurus'];
const HUE_LAT = { 赤: 'rubr', 橙: 'aurant', 金: 'aure', 碧: 'virid', 青: 'cyane', 蓝: 'caerule', 紫: 'purpure', 绯: 'rose' };
const FEAT_LAT = { 甲: 'cataphractus', 牙: 'dentatus', 角: 'cornutus', 群: 'gregarius', 疾: 'velox', 智: 'sapiens', 繁: 'fecundus', 雪: 'borealis', 炎: 'ardens', 巨: 'giganteus', 微: 'minimus', 瞳: 'oculatus', 寿: 'longaevus', 翼: 'alatus' };

export function latinName(form, hue, feat, rng) {
  const syl = () => LAT_SYL[rng.int(LAT_SYL.length)];
  const genus = (syl() + syl()).replace(/^./, (m) => m.toUpperCase()) + FORM_LAT[form];
  const ep = FEAT_LAT[feat] || (HUE_LAT[hue] || 'nov') + 'us';
  return `${genus} ${ep}`;
}

// ---- archetypes ----------------------------------------------------------------------------------

/** gene presets: [size, speed, diet, warmth, habitat, fertility, longevity, sense, intellect, social, aggression, armor, flight, hue, pattern] */
export const ARCHETYPES = {
  grazerFish: { name: '原初滤食鱼', genes: [0.22, 0.4, 0.05, 0.55, 0.1, 0.7, 0.3, 0.4, 0.05, 0.6, 0.1, 0.15, 0.1, 0.55, 0.3] },
  hunterFish: { name: '利齿掠食鱼', genes: [0.45, 0.6, 0.85, 0.5, 0.12, 0.4, 0.4, 0.6, 0.12, 0.2, 0.7, 0.2, 0.1, 0.02, 0.5] },
  plankton: { name: '微光浮游虾', genes: [0.06, 0.3, 0.0, 0.5, 0.05, 0.95, 0.15, 0.2, 0.02, 0.8, 0.0, 0.1, 0.1, 0.48, 0.2] },
  newt: { name: '泥岸两栖螈', genes: [0.25, 0.35, 0.2, 0.6, 0.47, 0.65, 0.35, 0.4, 0.08, 0.3, 0.2, 0.2, 0.1, 0.3, 0.6] },
  grazer: { name: '草原角兽', genes: [0.45, 0.5, 0.05, 0.5, 0.85, 0.5, 0.45, 0.5, 0.1, 0.75, 0.25, 0.25, 0.1, 0.12, 0.4] },
  critter: { name: '林地小兽', genes: [0.15, 0.6, 0.4, 0.55, 0.85, 0.85, 0.25, 0.55, 0.15, 0.35, 0.2, 0.1, 0.2, 0.08, 0.7] },
  predator: { name: '荒原掠食兽', genes: [0.55, 0.65, 0.88, 0.5, 0.85, 0.35, 0.5, 0.7, 0.2, 0.45, 0.75, 0.2, 0.1, 0.05, 0.3] },
  bird: { name: '天际鸣禽', genes: [0.18, 0.7, 0.35, 0.55, 0.9, 0.6, 0.35, 0.7, 0.15, 0.6, 0.15, 0.05, 0.92, 0.6, 0.5] },
  behemoth: { name: '甲背巨兽', genes: [0.92, 0.2, 0.05, 0.45, 0.9, 0.2, 0.85, 0.35, 0.12, 0.5, 0.4, 0.7, 0.05, 0.1, 0.2] },
  primate: { name: '林冠灵猿', genes: [0.4, 0.5, 0.45, 0.62, 0.86, 0.45, 0.6, 0.65, 0.58, 0.7, 0.35, 0.1, 0.1, 0.07, 0.4] },
  frostBeast: { name: '雪原毛兽', genes: [0.6, 0.4, 0.15, 0.12, 0.88, 0.4, 0.6, 0.5, 0.1, 0.65, 0.3, 0.45, 0.05, 0.15, 0.2] },
  desertLizard: { name: '赤砂蜥', genes: [0.2, 0.55, 0.5, 0.88, 0.58, 0.6, 0.4, 0.5, 0.1, 0.2, 0.4, 0.4, 0.05, 0.08, 0.8] },
};
