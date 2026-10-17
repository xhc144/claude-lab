#!/usr/bin/env node
// Regenerate data/pinyin.json from the titles and aliases in content/ (needs `npm install`).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin, customPinyin } from 'pinyin-pro';
import { loadKnowledgeBase } from './lib/kb.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
// readings pinyin-pro gets wrong in mathematical phrases
customPinyin({
  重积分: 'chóng jī fēn', 重极限: 'chóng jí xiàn', 重数: 'chóng shù', 重根: 'chóng gēn', 重排: 'chóng pái',
  重复: 'chóng fù', 重叠: 'chóng dié', 重合: 'chóng hé', 重伯努利: 'chóng bó nǔ lì', 不重不漏: 'bù chóng bù lòu',
  可重: 'kě chóng', 代数数: 'dài shù shù', 公差: 'gōng chā', 差分: 'chā fēn', 差商: 'chā shāng',
});
const kb = loadKnowledgeBase(ROOT);
const words = {}, chars = {};
for (const n of kb.nodes) for (const s of [n.title, ...n.aliases]) {
  // keep Latin letters and digits ("RSA 公钥密码" → rsa gong yao mi ma), drop punctuation and Greek
  const syl = pinyin(s, { toneType: 'none', type: 'array', nonZh: 'consecutive' })
    .map((p) => p.toLowerCase().replace(/ü/g, 'v').replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  if (syl.length) words[s] = syl.join(' ');
  for (const ch of s) if (/[一-鿿]/.test(ch) && !chars[ch]) chars[ch] = pinyin(ch, { toneType: 'none' }).replace('ü', 'v');
}
mkdirSync(join(ROOT, 'data'), { recursive: true });
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(join(ROOT, 'data/pinyin.json'), JSON.stringify({ words: sorted(words), chars: sorted(chars) }, null, 0) + '\n');
console.log(`✓ data/pinyin.json: ${Object.keys(words).length} titles, ${Object.keys(chars).length} characters`);
