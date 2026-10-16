#!/usr/bin/env node
// Lands a tested candidate commit on main (step "land" of .github/workflows/ship.yml).
//
//   node scripts/windows-release/land.mjs
//     env: CAND (tested commit), BRANCH, GATE / RELEASE (JSON app lists from plan.mjs),
//          NEEDS (the workflow's toJSON(needs)), GITHUB_REPOSITORY, GH_TOKEN
//
// - Every app in GATE (apps this branch changed) must have built and passed its tests, or nothing lands.
// - Apps in RELEASE are released only if their build passed and is signed; the list goes to the
//   step output "releasable".
// - If main has not moved, the candidate is pushed as is (fast-forward). If it has, the candidate is
//   merged into the new main, and lands only when every app it builds is byte-for-byte what was
//   tested; otherwise a new run is started for the branch and this one stops without landing.
// - A push that loses a race with another push is retried from the start.
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { APPS, git } from './lib.mjs';

const env = (k) => { const v = process.env[k]; if (v == null || v === '') throw new Error(`${k} is not set`); return v; };
const cand = env('CAND');
const branch = env('BRANCH');
const gate = JSON.parse(env('GATE'));
const release = JSON.parse(env('RELEASE'));
const needs = JSON.parse(env('NEEDS'));
const repo = env('GITHUB_REPOSITORY');

const out = (k, v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
const summary = (s) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + '\n');
const tryGit = (args) => { try { return { ok: true, out: git(args, { stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { ok: false, out: String(e.stderr || e.message) }; } };
const isAncestor = (a, b) => tryGit(['merge-base', '--is-ancestor', a, b]).ok;
const result = (app) => needs[app]?.result ?? 'skipped';

function redispatch(why) {
  console.log(`::warning::${why}; starting a new run for ${branch}`);
  try {
    execFileSync('gh', ['workflow', 'run', 'ship.yml', '--repo', repo, '--ref', 'main', '-f', `branch=${branch}`], { stdio: 'inherit' });
    summary(`**未合并**：${why}。已自动为 \`${branch}\` 重新启动一次流水线。`);
  } catch (e) {
    console.log(`::error::could not start a new run: ${e.message.split('\n')[0]}`);
    summary(`**未合并**：${why}。自动重新运行失败，再推送一次分支即可。`);
  }
  process.exit(1);
}

// 1. the branch's own apps must pass
const failed = gate.filter((app) => result(app) !== 'success');
if (failed.length) {
  const list = failed.map((a) => `${APPS[a].title}（${result(a)}）`).join('、');
  console.log(`::error::not merged: ${failed.join(', ')} did not pass the Windows build and tests`);
  summary(`**未合并**：${list} 没有通过 Windows 构建与测试。修好后再推送分支即可。`);
  process.exit(1);
}

if (process.env.BLOCKED === 'true') {
  console.log('::error::tests passed, but this branch changes .github/workflows and the built-in token may not push workflow files. Add a SHIP_TOKEN secret (see scripts/windows-release/README.md) or merge this branch by hand.');
  summary('**测试通过，但未合并**：分支修改了 `.github/workflows/`，需要 `SHIP_TOKEN` 才能自动合并（见 scripts/windows-release/README.md），或手动合并一次。');
  process.exit(1);
}

// 2. what may be released
const releasable = release.filter((app) => result(app) === 'success' && needs[app]?.outputs?.signed === 'true');
for (const app of release.filter((a) => !releasable.includes(a))) {
  const why = result(app) !== 'success' ? `构建或测试未通过（${result(app)}）` : '安装包没有签名';
  console.log(`::warning::${app} will not be released: ${why}`);
  summary(`- ${APPS[app].title} 不发布：${why}`);
}

// 3. land
const paths = (apps) => [...new Set(apps.flatMap((a) => APPS[a].paths.map((p) => p.replace(/\/$/, ''))))];
const tested = [...new Set([...gate, ...releasable])];
let landed = null;
for (let attempt = 1; attempt <= 4 && !landed; attempt++) {
  git(['fetch', '--quiet', 'origin', 'main']);
  const main = git(['rev-parse', 'origin/main']);
  if (isAncestor(cand, main)) { landed = main; console.log(`main (${main}) already contains ${cand}`); break; }
  let target = cand;
  if (!isAncestor(main, cand)) {
    // main moved on since the plan: merge the candidate into it
    git(['checkout', '--quiet', '--detach', main]);
    const m = tryGit(['merge', '--no-ff', '--no-edit', '-m', `Merge ${branch} [ship]`, cand]);
    if (!m.ok) { tryGit(['merge', '--abort']); redispatch('main changed meanwhile and the merge now conflicts'); }
    target = git(['rev-parse', 'HEAD']);
    if (tested.length) {
      const diff = tryGit(['diff', '--quiet', cand, target, '--', ...paths(tested)]);
      if (!diff.ok) redispatch(`main changed ${tested.join(', ')} meanwhile, so the tested build is out of date`);
    }
  }
  const push = tryGit(['push', 'origin', `${target}:refs/heads/main`]);
  if (push.ok) { landed = target; console.log(`main → ${target}`); break; }
  console.log(`push attempt ${attempt} failed: ${push.out.split('\n').slice(-3).join(' ')}`);
  if (/workflow/i.test(push.out) && /permission|refusing/i.test(push.out)) {
    console.log('::error::GitHub does not let the built-in token push changes to .github/workflows. Add a SHIP_TOKEN secret (see scripts/windows-release/README.md) or merge this branch by hand.');
    summary('**未合并**：这个分支修改了 `.github/workflows/`，GitHub 不允许内置令牌推送工作流文件。需要设置 `SHIP_TOKEN`（见 scripts/windows-release/README.md），或手动合并一次。');
    process.exit(1);
  }
}
if (!landed) { console.log('::error::could not push to main'); process.exit(1); }

out('landed', landed);
out('releasable', JSON.stringify(releasable));
summary(branch === 'main' ? `main：${landed}` : `\`${branch}\` 已合并进 main（${landed}）`);
if (releasable.length) summary(`待发布：${releasable.map((a) => APPS[a].title).join('、')}`);
