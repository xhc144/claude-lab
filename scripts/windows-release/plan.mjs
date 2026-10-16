#!/usr/bin/env node
// Decides what one run of .github/workflows/ship.yml builds and releases.
//
//   node scripts/windows-release/plan.mjs --head <sha> [--base <sha>] [--published <file>] [--apps auto|all|a,b]
//
//   --base       main before the merge (claude/** pushes). Apps this merge changes are the "gate":
//                they must build and pass their tests before the branch lands on main.
//   --head       the commit that would land on main.
//   --published  file listing the tags of published releases, one per line.
//   --apps       auto (default): every app whose files differ from its latest published release;
//                all: every app; or a comma-separated list (a manual release of exactly those apps).
//
// Prints JSON { gate, release, build } and, under GitHub Actions, writes the same as step outputs.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { APPS, appsTouched, appsWithWorkflowChanges, changedFiles, pathBelongs, tagOf, versionsFromTags } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') ? '' : all[i + 1] ?? '']] : acc), []));
const head = args.head;
if (!head) throw new Error('--head is required');
const published = args.published && existsSync(args.published) ? readFileSync(args.published, 'utf8').split(/\s+/).filter(Boolean) : [];
const mode = (args.apps || 'auto').trim();

let gate = [];
let workflowOnly = [];
if (args.base) {
  const files = changedFiles(args.base, head);
  gate = appsTouched(files);
  workflowOnly = appsWithWorkflowChanges(files);
}

const reasons = {};
let release;
if (mode === 'auto') {
  release = Object.keys(APPS).filter((app) => {
    const versions = versionsFromTags(app, published);
    if (!versions.length) { reasons[app] = 'never released'; return true; }
    const last = tagOf(app, versions.at(-1));
    const files = changedFiles(last, head).filter((f) => pathBelongs(app, f));
    if (files.length) reasons[app] = `${files.length} file(s) changed since ${last}`;
    return files.length > 0;
  });
} else if (mode === 'all') {
  release = Object.keys(APPS);
  for (const app of release) reasons[app] = 'requested: all';
} else if (mode === 'none') {
  release = [];
} else {
  release = mode.split(/[\s,]+/).filter(Boolean);
  const unknown = release.filter((a) => !APPS[a]);
  if (unknown.length) throw new Error(`unknown app(s): ${unknown.join(', ')}; known: ${Object.keys(APPS).join(', ')}`);
  for (const app of release) reasons[app] = 'requested by hand';
}

const order = Object.keys(APPS);
const build = order.filter((a) => gate.includes(a) || workflowOnly.includes(a) || release.includes(a));
const plan = { gate, release, build, reasons };
console.log(JSON.stringify(plan, null, 2));

if (process.env.GITHUB_OUTPUT) {
  const lines = [`gate=${JSON.stringify(gate)}`, `release=${JSON.stringify(release)}`, `build=${JSON.stringify(build)}`];
  for (const app of order) lines.push(`build_${app.replace(/-/g, '_')}=${build.includes(app)}`);
  appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const row = (app) => `| ${APPS[app].title} | ${gate.includes(app) ? '✔' : ''} | ${build.includes(app) ? '✔' : ''} | ${release.includes(app) ? '✔' : ''} | ${reasons[app] ?? ''} |`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['### 本次计划', '', '| 软件 | 合并前必须通过 | 构建测试 | 发布 | 原因 |', '| --- | --- | --- | --- | --- |', ...order.map(row), ''].join('\n') + '\n');
}
