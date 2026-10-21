#!/usr/bin/env node
// Build the static site into dist/:
//   1. parse and validate the knowledge base in content/ (ids, relations, learning-order cycles,
//      syllabus links, every TeX formula through KaTeX)
//   2. lay the stars out (deterministic force simulation, cached in .cache/)
//   3. bundle src/ into app.js and write data/graph.js + data/content.js
//
//   node scripts/build.mjs            strict: unresolved references or uncovered syllabus items fail
//   node scripts/build.mjs --loose    report them as warnings (while writing new content)
//   node scripts/build.mjs --report   also write COVERAGE.md (syllabus → stars)

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKnowledgeBase } from './lib/kb.mjs';
import { loadKatex, checkMath } from './lib/tex.mjs';
import { layout } from './lib/layout.mjs';
import { bundle } from './lib/bundle.mjs';
import { toPinyin } from './lib/pinyin.mjs';
import { RELATION_ORDER, GALAXIES } from '../src/config.js';
import { ANIMATIONS } from '../src/anim/registry.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const args = new Set(process.argv.slice(2));
const strict = !args.has('--loose');
const t0 = Date.now();

const kb = loadKnowledgeBase(ROOT, { animIds: ANIMATIONS.map((a) => a.id) });
const katex = loadKatex(ROOT);
const texErrors = checkMath(katex, kb.math);

const problems = [...kb.errors, ...texErrors];
const soft = [...kb.unresolved, ...kb.uncovered.map((u) => `syllabus item not covered by any star: ${u}`)];
if (strict) problems.push(...soft); else kb.warnings.push(...soft);
for (const w of kb.warnings) console.warn(`  ! ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`✗ knowledge base has ${problems.length} problem(s)`);
  process.exit(1);
}

// ---- layout (cached by structure)
const structure = JSON.stringify([kb.clusters.map((c) => [c.id, c.galaxy, c.order]), kb.nodes.map((n) => [n.id, n.galaxy, n.cluster, n.weight]), kb.edges.map((e) => [e.s, e.t])]);
const layoutKey = createHash('sha256').update(structure).digest('hex').slice(0, 16);
const cacheDir = join(ROOT, '.cache');
const cacheFile = join(cacheDir, `layout-${layoutKey}.json`);
let L;
if (existsSync(cacheFile) && !args.has('--no-cache')) {
  const c = JSON.parse(readFileSync(cacheFile, 'utf8'));
  L = { pos: new Map(c.pos), galaxies: new Map(c.galaxies), clusters: new Map(c.clusters) };
} else {
  L = layout({ galaxies: GALAXIES, clusters: kb.clusters, nodes: kb.nodes, edges: kb.edges });
  mkdirSync(cacheDir, { recursive: true });
  for (const f of readdirSync(cacheDir)) if (f.startsWith('layout-')) rmSync(join(cacheDir, f));
  writeFileSync(cacheFile, JSON.stringify({ pos: [...L.pos], galaxies: [...L.galaxies], clusters: [...L.clusters] }));
}

// ---- data files
const nodeIndex = new Map(kb.nodes.map((n, k) => [n.id, k]));
const galaxyIdx = new Map(GALAXIES.map((g, k) => [g.id, k]));
const sectionCode = { statement: 's', intuition: 'i', proof: 'p', example: 'e', app: 'a', note: 'n' };
const graph = {
  galaxies: GALAXIES.map((g) => ({ ...g, ...L.galaxies.get(g.id) })),
  clusters: kb.clusters.map((c) => ({ id: c.id, name: c.name, en: c.en, g: galaxyIdx.get(c.galaxy), order: c.order, ...(L.clusters.get(c.id) || { x: 0, y: 0, r: 0 }) })),
  nodes: kb.nodes.map((n) => {
    const [x, y] = L.pos.get(n.id);
    const py = toPinyin(ROOT, [n.title, ...n.aliases]);
    const o = { id: n.id, t: n.title, g: galaxyIdx.get(n.galaxy), c: n.clusterIndex, k: n.kind, ty: n.type, lv: n.level, w: n.weight, x, y, s: n.summary };
    if (n.en) o.en = n.en;
    if (n.aliases.length) o.al = n.aliases;
    if (n.tags.length) o.tg = n.tags;
    if (n.syllabus.length) o.sy = n.syllabus;
    if (n.anim) o.an = n.anim;
    if (py.full) { o.py = py.full; o.pi = py.initials; }
    o.sec = [...new Set(n.html.map(([k]) => sectionCode[k]))].join('');
    return o;
  }),
  edges: kb.edges.map((e) => [nodeIndex.get(e.s), nodeIndex.get(e.t), RELATION_ORDER.indexOf(e.type)]),
  relTypes: RELATION_ORDER,
  tours: kb.tours.map((t) => ({ id: t.id, title: t.title, desc: t.desc, steps: t.steps.map((s) => [nodeIndex.get(s.id), s.html]) })),
  syllabus: kb.syllabus,
};
const content = {};
for (const n of kb.nodes) content[n.id] = { h: n.html, x: n.text };

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const graphJs = `window.STARMAP_GRAPH=${JSON.stringify(graph)};\n`;
const contentJs = `window.STARMAP_CONTENT=${JSON.stringify(content)};\n`;
const { js: appJs, count } = bundle(join(ROOT, 'src/main.js'), ROOT);
const css = readFileSync(join(ROOT, 'css/app.css'), 'utf8');
const hash = createHash('sha256').update(graphJs + contentJs + appJs + css).digest('hex').slice(0, 10);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'data'), { recursive: true });
writeFileSync(join(DIST, 'data/graph.js'), graphJs);
writeFileSync(join(DIST, 'data/content.js'), contentJs);
writeFileSync(join(DIST, 'app.js'), `/* 数学知识星图 Math Starmap v${pkg.version} — generated by scripts/build.mjs from src/, do not edit. */\n${appJs}`);
writeFileSync(join(DIST, 'app.css'), css);
cpSync(join(ROOT, 'vendor/katex'), join(DIST, 'katex'), { recursive: true, filter: (p) => !p.endsWith('LICENSE.txt') });
cpSync(join(ROOT, 'favicon.svg'), join(DIST, 'favicon.svg'));
let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
html = html.replaceAll('{{V}}', hash).replaceAll('{{VERSION}}', pkg.version)
  .replaceAll('{{NODES}}', String(kb.nodes.length)).replaceAll('{{EDGES}}', String(kb.edges.length));
writeFileSync(join(DIST, 'index.html'), html);

// ---- report
const byGalaxy = GALAXIES.map((g) => `${g.name} ${kb.nodes.filter((n) => n.galaxy === g.id).length}`).join(' · ');
const byRel = RELATION_ORDER.map((r) => `${r} ${kb.edges.filter((e) => e.type === r).length}`).join(' · ');
const items = kb.syllabus.groups.reduce((a, g) => a + g.items.length, 0);
console.log(`✓ ${kb.nodes.length} stars (${byGalaxy})`);
console.log(`✓ ${kb.edges.length} relations (${byRel}); ${kb.math.length} formulas checked by KaTeX`);
console.log(`✓ syllabus: ${items - kb.uncovered.length}/${items} items covered; ${kb.tours.length} tours; ${count} modules → dist/ in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

if (args.has('--report')) {
  const lines = ['# 考纲覆盖表', '', '由 `node scripts/build.mjs --report` 生成：清华大学 2027 新领军计划考试大纲（数学与物理）每个官方列项对应的知识星。拆分条目只为检索，不是官方公布的独立考点。', ''];
  for (const g of kb.syllabus.groups) {
    lines.push(`## ${g.subject} · ${g.name}（考纲第 ${g.page} 页）`, '', `> ${g.wording}`, '', '| 列项 | 知识星 |', '| --- | --- |');
    for (const it of g.items) lines.push(`| ${it.name} | ${(kb.coverage.get(it.id) || []).map((id) => kb.byId.get(id).title).join('、') || '—'} |`);
    lines.push('');
  }
  writeFileSync(join(ROOT, 'COVERAGE.md'), lines.join('\n'));
  console.log('✓ COVERAGE.md');
}
