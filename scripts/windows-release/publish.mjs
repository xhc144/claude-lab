#!/usr/bin/env node
// Publishes one tested, signed build of an app as a GitHub release and moves its update feed forward.
// Used by .github/workflows/ship.yml; needs GH_TOKEN and GITHUB_REPOSITORY.
//
//   node scripts/windows-release/publish.mjs release <app> <dist-dir> <commit-sha>
//   node scripts/windows-release/publish.mjs feed <app> <commit-sha>
//
// release:
//   1. The version comes from the build's latest.yml and must match package.json at <commit-sha>.
//   2. The tag <app>-v<version> is created through the API first. Creating a ref is atomic, so two runs
//      can never publish the same version: the loser exits with code 3 ("version taken") and nothing of
//      it is uploaded. A tag left by an earlier attempt at the same commit is reused.
//   3. A draft release gets every asset (never --clobber) plus latest.yml with absolute URLs, and is
//      published only when all uploads succeeded, so users never see a half-filled release.
//   4. Then the feed step runs.
// feed:
//   <app>-latest/latest.yml (read by installed apps) is set to the latest.yml of the highest published
//   <app>-v* release, and only ever moves to a higher version; an older run can never overwrite a newer
//   feed. Safe to run any number of times.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APPS, compareVersions, git, here, parseVersion, readVersion, repoRoot, tagOf, versionsFromTags } from './lib.mjs';

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) throw new Error('GITHUB_REPOSITORY is not set');

const gh = (args, opts = {}) => String(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts }) ?? '').trim();
const tryGh = (args) => { try { return { ok: true, out: gh(args) }; } catch (e) { return { ok: false, out: String(e.stderr || e.message) }; } };
const note = (m) => console.log(`::notice::${m}`);

/** Published (non-draft) releases of the repository: [{ tag, draft, prerelease }]. */
function releases() {
  const out = gh(['api', '--paginate', `repos/${repo}/releases?per_page=100`, '--jq', '.[] | [.tag_name, .draft, .prerelease] | @tsv']);
  return out.split('\n').filter(Boolean).map((l) => { const [tag, draft, pre] = l.split('\t'); return { tag, draft: draft === 'true', prerelease: pre === 'true' }; });
}

const yamlVersion = (text) => text.match(/^version:\s*['"]?([^'"\s]+)/m)?.[1] ?? null;

function globToRegex(glob) {
  return new RegExp('^' + glob.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
}

function releaseNotes(app, version, sha, previousTag, sums) {
  const a = APPS[app];
  const template = readFileSync(join(here, 'notes', `${app}.md`), 'utf8');
  let changes = '';
  if (previousTag) {
    const paths = a.paths.map((p) => p.replace(/\/$/, ''));
    const exclude = a.ignore.map((p) => `:(exclude)${p.replace(/\/$/, '')}`);
    let log = [];
    try {
      log = git(['log', '--no-merges', '--format=- %s', `${previousTag}..${sha}`, '--', ...paths, ...exclude], { stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(Boolean);
    } catch {
      console.log(`::warning::could not list the changes since ${previousTag}; the release notes leave them out`);
    }
    const shown = log.filter((l) => !/^- (Release|Bump) /.test(l)).slice(0, 40);
    changes = shown.length ? `**自 ${previousTag} 以来的改动**\n\n${shown.join('\n')}${log.length > shown.length + 1 ? '\n- ……' : ''}` : '';
  } else {
    changes = '这是这个软件第一次通过自动流水线发布。';
  }
  return template
    .replaceAll('{{VERSION}}', version)
    .replaceAll('{{REPO}}', repo)
    .replaceAll('{{TAG}}', tagOf(app, version))
    .replaceAll('{{SOURCE}}', `https://github.com/${repo}/tree/${tagOf(app, version)}/${a.dir}`)
    .replaceAll('{{CHANGES}}', changes)
    .replaceAll('{{SHA256}}', sums.trim());
}

function tagSha(tag) {
  const r = tryGh(['api', `repos/${repo}/git/ref/tags/${tag}`, '--jq', '.object.type + " " + .object.sha']);
  if (!r.ok) return null;
  const [type, sha] = r.out.split(' ');
  return type === 'tag' ? gh(['api', `repos/${repo}/git/tags/${sha}`, '--jq', '.object.sha']) : sha;
}

function release(app, dist, sha) {
  const a = APPS[app];
  if (!a) throw new Error(`unknown app ${app}`);
  const feedSrc = join(dist, 'latest.yml');
  if (!existsSync(feedSrc)) throw new Error(`${feedSrc} missing: the build did not produce update information`);
  const version = yamlVersion(readFileSync(feedSrc, 'utf8'));
  if (!parseVersion(version)) throw new Error(`latest.yml has no usable version (${version})`);
  const pkgVersion = readVersion(app);
  if (pkgVersion !== version) throw new Error(`build is ${version} but ${a.dir}/package.json at ${sha} says ${pkgVersion}`);
  const tag = tagOf(app, version);

  const all = releases();
  const existing = all.find((r) => r.tag === tag);
  if (existing && !existing.draft) {
    const at = tagSha(tag);
    if (at === sha) { note(`${tag} is already published from this commit; only the feed is checked`); return feed(app, sha); }
    console.log(`::error::${tag} is already published from ${at}; refusing to publish it again from ${sha}`);
    process.exit(3);
  }

  const files = readdirSync(dist).filter((f) => a.assets.some((g) => globToRegex(g).test(f)));
  for (const g of a.assets) if (!files.some((f) => globToRegex(g).test(f))) throw new Error(`no file in ${dist} matches ${g}`);

  const tmp = mkdtempSync(join(tmpdir(), `${app}-`));
  const feedOut = join(tmp, 'latest.yml');
  execFileSync(process.execPath, [join(here, 'update-feed.mjs'), dist, repo, tag, feedOut], { stdio: 'inherit' });

  const published = versionsFromTags(app, all.filter((r) => !r.draft).map((r) => r.tag)).filter((v) => compareVersions(v, version) < 0);
  const previousTag = published.length ? tagOf(app, published.at(-1)) : null;
  const sums = existsSync(join(dist, 'SHA256SUMS.txt')) ? readFileSync(join(dist, 'SHA256SUMS.txt'), 'utf8') : '';
  const notesFile = join(tmp, 'notes.md');
  writeFileSync(notesFile, releaseNotes(app, version, sha, previousTag, sums));

  // Lock the version: creating a ref fails if it exists.
  const created = tryGh(['api', '-X', 'POST', `repos/${repo}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`]);
  if (!created.ok) {
    const at = tagSha(tag);
    if (at !== sha) {
      console.log(`::error::tag ${tag} already exists at ${at ?? '?'} (this build is ${sha}); another run took this version`);
      process.exit(3);
    }
    note(`reusing tag ${tag} left at this commit by an earlier attempt`);
  }

  // a draft left by an earlier attempt of this version is replaced
  if (existing?.draft) gh(['release', 'delete', tag, '--repo', repo, '--yes']);
  const title = `${a.title} ${version}（Windows）`;
  gh(['release', 'create', tag, '--repo', repo, '--draft', '--verify-tag', '--title', title, '--notes-file', notesFile, ...files.map((f) => join(dist, f)), feedOut], { stdio: 'inherit' });
  gh(['release', 'edit', tag, '--repo', repo, '--draft=false', '--latest=false'], { stdio: 'inherit' });
  note(`published ${tag}: ${files.join(', ')}, latest.yml`);
  feed(app, sha);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${title}\n\nhttps://github.com/${repo}/releases/tag/${tag}\n\n`, { flag: 'a' });
  }
}

function feed(app, sha) {
  const feedTag = `${app}-latest`;
  const all = releases();
  const versions = versionsFromTags(app, all.filter((r) => !r.draft && !r.prerelease).map((r) => r.tag));
  if (!versions.length) { note(`${app}: nothing published yet, feed unchanged`); return; }
  const tmp = mkdtempSync(join(tmpdir(), `${app}-feed-`));

  // the newest published release that carries update information
  let source = null;
  for (const v of [...versions].reverse()) {
    const dir = join(tmp, v);
    if (tryGh(['release', 'download', tagOf(app, v), '--repo', repo, '--pattern', 'latest.yml', '--dir', dir]).ok) { source = { version: v, file: join(dir, 'latest.yml') }; break; }
  }
  if (!source) { note(`${app}: no published release has latest.yml yet, feed unchanged`); return; }
  const wanted = readFileSync(source.file, 'utf8');
  if (yamlVersion(wanted) !== source.version) throw new Error(`${tagOf(app, source.version)}/latest.yml says ${yamlVersion(wanted)}`);

  const curDir = join(tmp, 'current');
  let current = null;
  if (all.some((r) => r.tag === feedTag)) {
    if (tryGh(['release', 'download', feedTag, '--repo', repo, '--pattern', 'latest.yml', '--dir', curDir]).ok) current = readFileSync(join(curDir, 'latest.yml'), 'utf8');
  } else {
    gh(['release', 'create', feedTag, '--repo', repo, '--prerelease', '--latest=false', '--target', sha, '--title', `${APPS[app].title} · 自动更新信息`,
      '--notes', `已安装的${APPS[app].title}从这里读取最新版本信息（latest.yml）；安装包在对应的 ${app}-v* 发布里。由自动发布流水线维护，请不要删除或手动修改。`], { stdio: 'inherit' });
  }
  const curVersion = current ? yamlVersion(current) : null;
  if (current === wanted) { note(`${feedTag} already points at ${source.version}`); return; }
  if (curVersion && parseVersion(curVersion) && compareVersions(curVersion, source.version) > 0) {
    note(`${feedTag} points at ${curVersion}, newer than ${source.version}; left as is`);
    return;
  }
  gh(['release', 'upload', feedTag, '--repo', repo, '--clobber', source.file], { stdio: 'inherit' });
  note(`${feedTag}: ${curVersion ?? '(none)'} → ${source.version}`);
}

const [cmd, ...rest] = process.argv.slice(2);
process.chdir(repoRoot);
if (cmd === 'release') release(rest[0], rest[1], rest[2]);
else if (cmd === 'feed') feed(rest[0], rest[1]);
else throw new Error('usage: publish.mjs release <app> <dist-dir> <sha> | feed <app> <sha>');
