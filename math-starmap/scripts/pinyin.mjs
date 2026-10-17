#!/usr/bin/env node
// Regenerate data/pinyin.json from the titles and aliases in content/ (needs `npm install`).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';
import { loadKnowledgeBase } from './lib/kb.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const kb = loadKnowledgeBase(ROOT);
const words = {}, chars = {};
for (const n of kb.nodes) for (const s of [n.title, ...n.aliases]) {
  const syl = pinyin(s, { toneType: 'none', type: 'array', nonZh: 'removed' }).filter((p) => /^[a-zü]+$/.test(p)).map((p) => p.replace('ü', 'v'));
  if (syl.length) words[s] = syl.join(' ');
  for (const ch of s) if (/[一-鿿]/.test(ch) && !chars[ch]) chars[ch] = pinyin(ch, { toneType: 'none' }).replace('ü', 'v');
}
mkdirSync(join(ROOT, 'data'), { recursive: true });
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(join(ROOT, 'data/pinyin.json'), JSON.stringify({ words: sorted(words), chars: sorted(chars) }, null, 0) + '\n');
console.log(`✓ data/pinyin.json: ${Object.keys(words).length} titles, ${Object.keys(chars).length} characters`);
