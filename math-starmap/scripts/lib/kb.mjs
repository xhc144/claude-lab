// Knowledge base: parse content/**/*.md into nodes, relations, clusters, tours and syllabus links,
// then validate everything. See content/README.md for the authoring format.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GALAXIES, RELATIONS, TYPE_WORDS, LEVELS, SECTION_KINDS, ORDER_RELATIONS } from '../../src/config.js';
import { compile, plainText } from './markdown.mjs';

// relation keys in a node's metadata → [relation type, direction]; 'out' means self → target
const REL_KEYS = {
  前置: ['pre', 'in'], 后续: ['pre', 'out'],
  推出: ['der', 'out'], 推导出: ['der', 'out'], 源于: ['der', 'in'], 推导自: ['der', 'in'],
  推广: ['gen', 'out'], 推广为: ['gen', 'out'], 特例: ['gen', 'in'],
  等价: ['eq', 'out'],
  应用: ['app', 'out'], 应用于: ['app', 'out'], 用到: ['app', 'in'],
  例: ['ex', 'out'], 例子: ['ex', 'out'], 是例子: ['ex', 'in'],
  相关: ['rel', 'out'], 类比: ['rel', 'out'],
};
// when several relations join the same pair of stars only one line is drawn; the most specific wins,
// and relations that fix a learning order (推导, 推广, 前置) beat the symmetric ones
const PRIORITY = ['der', 'gen', 'eq', 'pre', 'app', 'ex', 'rel'];
const UNDIRECTED = new Set(['eq', 'rel']);
const LEVEL_WORDS = { hs: 'hs', 高中: 'hs', core: 'core', 考纲: 'core', 核心: 'core', ext: 'ext', 拓展: 'ext' };
export const FORBIDDEN = ['高二', '备考', '清华大学求真'];

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (name.endsWith('.md') && !name.startsWith('_') && name !== 'README.md') out.push(p);
  }
  return out;
}

const splitList = (v) => v.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);

function parseFrontMatter(text, file) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) throw new Error(`${file}: missing front matter (--- galaxy / cluster / title ---)`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w一-龥]+)\s*:\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, rest: text.slice(m[0].length), offset: m[0].split('\n').length - 1 };
}

/** Parse one content file. Returns { cluster, nodes } with raw metadata and bodies. */
export function parseContentFile(text, file) {
  text = text.replace(/\r\n?/g, '\n');
  const { meta, rest, offset } = parseFrontMatter(text, file);
  const cluster = { id: meta.cluster, name: meta.title, en: meta.en || '', galaxy: meta.galaxy, order: Number(meta.order ?? 0), file, level: meta.level };
  const nodes = [];
  const lines = rest.split('\n');
  let cur = null;
  const flush = () => { if (cur) { cur.body = cur.bodyLines.join('\n').trim(); delete cur.bodyLines; nodes.push(cur); } };
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    const h = /^##\s+(.+?)\s*\{#([^}]+)\}\s*$/.exec(line);
    if (h) {
      flush();
      cur = { title: h[1].trim(), id: h[2].trim(), meta: {}, bodyLines: [], file, line: k + 1 + offset };
      // metadata: "key: value" lines (several per line separated by " | ") until the first blank line
      while (k + 1 < lines.length && /^[\w一-龥]+\s*:/.test(lines[k + 1])) {
        k++;
        for (const part of lines[k].split(/\s+\|\s+/)) {
          const kv = /^([\w一-龥]+)\s*:\s*(.*)$/.exec(part.trim());
          if (!kv) throw new Error(`${file}:${k + 1 + offset}: bad metadata “${part}”`);
          const key = kv[1];
          cur.meta[key] = cur.meta[key] ? `${cur.meta[key]}, ${kv[2]}` : kv[2];
        }
      }
      continue;
    }
    if (/^##\s/.test(line)) throw new Error(`${file}:${k + 1 + offset}: node heading needs an id: “## 标题 {#id}”`);
    if (cur) cur.bodyLines.push(line);
    else if (line.trim() && !/^#\s/.test(line)) throw new Error(`${file}:${k + 1 + offset}: text before the first node`);
  }
  flush();
  return { cluster, nodes };
}

function sectionKind(heading) {
  for (const [kind, def] of Object.entries(SECTION_KINDS)) if (def.words.some((w) => heading.startsWith(w))) return kind;
  return 'note';
}

/** Split a node body into summary + sections ([kind, heading, markdown]). */
export function splitBody(body) {
  const parts = body.split(/^###\s+/m);
  const head = parts.shift().trim();
  const paras = head.split(/\n\s*\n/);
  const summary = (paras.shift() || '').trim();
  const sections = [];
  const lead = paras.join('\n\n').trim();
  if (lead) sections.push(['statement', '', lead]);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const heading = (nl < 0 ? p : p.slice(0, nl)).trim();
    const md = nl < 0 ? '' : p.slice(nl + 1).trim();
    sections.push([sectionKind(heading), heading, md]);
  }
  return { summary, sections };
}

function parseTours(text, file) {
  const tours = [];
  let cur = null;
  for (const [k, raw] of text.replace(/\r\n?/g, '\n').split('\n').entries()) {
    const line = raw.trimEnd();
    const h = /^##\s+(.+?)\s*\{#([^}]+)\}\s*$/.exec(line);
    if (h) { cur = { id: h[2], title: h[1], desc: '', steps: [], line: k + 1 }; tours.push(cur); continue; }
    if (!cur) continue;
    const d = /^desc:\s*(.*)$/.exec(line);
    if (d) { cur.desc = d[1]; continue; }
    const s = /^-\s+([a-z0-9][a-z0-9-]*)\s*[:：]\s*(.*)$/.exec(line);
    if (s) { cur.steps.push({ id: s[1], text: s[2], line: k + 1 }); continue; }
    if (/^\s+\S/.test(line) && cur.steps.length) { cur.steps[cur.steps.length - 1].text += ' ' + line.trim(); continue; }
    if (line.trim() && !/^#\s/.test(line)) throw new Error(`${file}:${k + 1}: unexpected line in tours: ${line}`);
  }
  return tours;
}

/**
 * Load and validate the whole knowledge base.
 * Returns { galaxies, clusters, nodes, edges, tours, syllabus, errors, warnings, math }.
 */
export function loadKnowledgeBase(root, { animIds = [] } = {}) {
  const errors = [];
  const warnings = [];
  const contentDir = join(root, 'content');
  const syllabus = JSON.parse(readFileSync(join(contentDir, 'syllabus.json'), 'utf8'));
  const syllabusByKey = new Map();
  for (const g of syllabus.groups) for (const it of g.items) {
    syllabusByKey.set(it.id, it.id);
    syllabusByKey.set(it.name, it.id);
    for (const a of it.aliases || []) syllabusByKey.set(a, it.id);
  }
  const galaxyIndex = new Map(GALAXIES.map((g, k) => [g.id, k]));

  const clusters = [];
  const raw = [];
  for (const file of listFiles(contentDir)) {
    const rel = relative(root, file);
    const text = readFileSync(file, 'utf8');
    if (rel.endsWith('tours.md')) continue;
    let parsed;
    try { parsed = parseContentFile(text, rel); } catch (e) { errors.push(e.message); continue; }
    const c = parsed.cluster;
    if (!c.id || !ID_RE.test(c.id)) errors.push(`${rel}: cluster id “${c.id}” must be kebab-case`);
    if (!galaxyIndex.has(c.galaxy)) errors.push(`${rel}: unknown galaxy “${c.galaxy}”`);
    if (!c.name) errors.push(`${rel}: cluster title missing`);
    if (clusters.some((x) => x.id === c.id)) errors.push(`${rel}: duplicate cluster id “${c.id}”`);
    c.index = clusters.length;
    clusters.push(c);
    for (const n of parsed.nodes) { n.cluster = c; raw.push(n); }
  }

  // nodes
  const unresolvedEarly = [];
  const byId = new Map();
  const nodes = [];
  for (const r of raw) {
    const where = `${r.file}:${r.line}`;
    if (!ID_RE.test(r.id)) { errors.push(`${where}: id “${r.id}” must be kebab-case`); continue; }
    if (byId.has(r.id)) { errors.push(`${where}: duplicate id “${r.id}” (first in ${byId.get(r.id).where})`); continue; }
    const m = r.meta;
    const known = new Set(['type', 'en', 'level', 'w', 'weight', '考纲', 'syllabus', 'alias', '别名', 'tags', '标签', 'anim', '动画', ...Object.keys(REL_KEYS)]);
    for (const key of Object.keys(m)) if (!known.has(key)) errors.push(`${where}: unknown metadata key “${key}”`);
    const typeWord = (m.type || '').trim();
    const kind = TYPE_WORDS[typeWord];
    if (!kind) errors.push(`${where}: type “${typeWord}” is not one of ${Object.keys(TYPE_WORDS).join(' ')}`);
    const levelWord = (m.level || r.cluster.level || '').trim();
    const level = LEVEL_WORDS[levelWord];
    if (!level) errors.push(`${where}: level “${levelWord}” must be hs / core / ext (高中 / 考纲 / 拓展)`);
    const w = Number(m.w ?? m.weight ?? 2);
    if (!(w >= 1 && w <= 5)) errors.push(`${where}: weight must be 1–5`);
    const syl = [];
    for (const key of splitList(m['考纲'] || m.syllabus || '')) {
      const id = syllabusByKey.get(key);
      if (!id) errors.push(`${where}: unknown syllabus item “${key}”`);
      else if (!syl.includes(id)) syl.push(id);
    }
    const anim = (m.anim || m['动画'] || '').trim();
    if (anim && animIds.length && !animIds.includes(anim)) unresolvedEarly.push(`${where}: unknown animation “${anim}”`);
    const { summary, sections } = splitBody(r.body);
    if (!summary) errors.push(`${where}: missing summary (first paragraph of the body)`);
    const node = {
      id: r.id, title: r.title, en: (m.en || '').trim(), galaxy: r.cluster.galaxy, cluster: r.cluster.id, clusterIndex: r.cluster.index,
      kind, type: typeWord, level, weight: w, syllabus: syl, anim,
      aliases: splitList(m.alias || m['别名'] || ''), tags: splitList(m.tags || m['标签'] || ''),
      summaryMd: summary, sections, where, meta: m,
    };
    byId.set(r.id, node);
    nodes.push(node);
  }

  // relations
  const pairs = new Map(); // "a|b" (sorted) → edge
  const addEdge = (s, t, type, where) => {
    if (s === t) { errors.push(`${where}: ${s} relates to itself`); return; }
    if (UNDIRECTED.has(type) && s > t) [s, t] = [t, s];
    const key = s < t ? `${s}|${t}` : `${t}|${s}`;
    const prev = pairs.get(key);
    if (!prev || PRIORITY.indexOf(type) < PRIORITY.indexOf(prev.type)) pairs.set(key, { s, t, type, where, also: prev ? [...(prev.also || []), prev.type] : [] });
    else if (prev.type !== type || prev.s !== s) prev.also = [...(prev.also || []), type];
  };
  const unresolved = [...unresolvedEarly];
  for (const n of nodes) {
    for (const [key, [type, dir]] of Object.entries(REL_KEYS)) {
      if (!n.meta[key]) continue;
      for (const target of splitList(n.meta[key])) {
        if (!byId.has(target)) { unresolved.push(`${n.where}: ${key} → “${target}” does not exist`); continue; }
        if (dir === 'out') addEdge(n.id, target, type, n.where); else addEdge(target, n.id, type, n.where);
      }
    }
  }

  // compile Markdown (wiki links need every title, so this comes after all nodes are known)
  const title = (id) => byId.get(id)?.title ?? id;
  const math = [];
  for (const n of nodes) {
    const linkTargets = new Set();
    const comp = (md, part) => {
      try {
        const out = compile(md, { title });
        for (const l of out.links) linkTargets.add(l);
        for (const m of out.math) math.push({ ...m, where: `${n.where} (${part})` });
        return out.html;
      } catch (e) { errors.push(`${n.where} (${part}): ${e.message}`); return ''; }
    };
    n.summary = comp(n.summaryMd, '摘要');
    n.html = n.sections.map(([kind, heading, md]) => [kind, heading, comp(md, heading || '正文')]);
    n.text = plainText([n.summaryMd, ...n.sections.map((s) => s[1] + ' ' + s[2])].join(' '));
    for (const l of linkTargets) {
      if (!byId.has(l)) unresolved.push(`${n.where}: link [[${l}]] does not exist`);
      else if (l !== n.id) n.links = [...(n.links || []), l];
    }
    for (const word of FORBIDDEN) {
      const all = [n.title, n.en, n.summaryMd, ...n.sections.flat(), ...n.aliases, ...n.tags].join('\n');
      if (all.includes(word)) errors.push(`${n.where}: contains “${word}”, which the public site must not publish`);
    }
  }
  // wiki links in the text become "相关" lines when the pair is not related otherwise
  for (const n of nodes) for (const l of n.links || []) {
    const key = n.id < l ? `${n.id}|${l}` : `${l}|${n.id}`;
    if (!pairs.has(key)) addEdge(n.id, l, 'rel', n.where);
  }
  const edges = [...pairs.values()];

  // learning order (前置 + 推导) must be acyclic
  const out = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) if (ORDER_RELATIONS.includes(e.type)) out.get(e.s).push(e.t);
  const state = new Map();
  const stack = [];
  const cycles = [];
  const dfs = (u) => {
    state.set(u, 1); stack.push(u);
    for (const v of out.get(u)) {
      if (state.get(v) === 1) cycles.push([...stack.slice(stack.indexOf(v)), v].join(' → '));
      else if (!state.get(v)) dfs(v);
    }
    stack.pop(); state.set(u, 2);
  };
  for (const n of nodes) if (!state.get(n.id)) dfs(n.id);
  for (const c of cycles) errors.push(`learning-order cycle (前置/推导): ${c}`);

  // syllabus coverage
  const coverage = new Map();
  for (const n of nodes) for (const s of n.syllabus) coverage.set(s, [...(coverage.get(s) || []), n.id]);
  const uncovered = [];
  for (const g of syllabus.groups) for (const it of g.items) if (!coverage.has(it.id)) uncovered.push(`${it.id} ${it.name}`);

  // degree
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) { degree.set(e.s, degree.get(e.s) + 1); degree.set(e.t, degree.get(e.t) + 1); }
  for (const n of nodes) if (!degree.get(n.id)) warnings.push(`${n.where}: ${n.id} has no relations`);

  // tours
  let tours = [];
  try { tours = parseTours(readFileSync(join(contentDir, 'tours.md'), 'utf8'), 'content/tours.md'); } catch (e) { if (e.code !== 'ENOENT') errors.push(e.message); }
  for (const t of tours) {
    if (!t.steps.length) errors.push(`content/tours.md:${t.line}: tour ${t.id} has no steps`);
    for (const s of t.steps) {
      if (!byId.has(s.id)) unresolved.push(`content/tours.md:${s.line}: tour step “${s.id}” does not exist`);
      try {
        const c = compile(s.text, { title });
        s.html = c.html.replace(/^<p>([\s\S]*)<\/p>$/, '$1');
        for (const m of c.math) math.push({ ...m, where: `content/tours.md:${s.line}` });
      } catch (e) { errors.push(`content/tours.md:${s.line}: ${e.message}`); }
    }
    for (const word of FORBIDDEN) if (JSON.stringify(t).includes(word)) errors.push(`content/tours.md: tour ${t.id} contains “${word}”`);
  }

  for (const c of clusters) if (!nodes.some((n) => n.cluster === c.id)) warnings.push(`${c.file}: cluster has no nodes`);
  return { galaxies: GALAXIES, clusters, nodes, byId, edges, tours, syllabus, coverage, uncovered, unresolved, cycles, errors, warnings, math, degree, relations: RELATIONS, levels: LEVELS };
}
