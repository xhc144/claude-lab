// node --test scripts/windows-release/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { APPS, appsTouched, appsWithWorkflowChanges, compareVersions, nextVersion, pathBelongs, versionsFromTags, here } from '../lib.mjs';

const require = createRequire(import.meta.url);
const { judge } = require('../update-signer.cjs');

test('versions compare numerically', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('0.10.0', '0.10.0'), 0);
  assert.equal(compareVersions('2.0.0', '10.0.0'), -1);
  assert.throws(() => compareVersions('1.0', '1.0.0'));
});

test('tags of one app never leak into another', () => {
  const tags = ['phonica-v1.0.0', 'phonica-latest', 'phonica-models-v1', 'motif-v0.10.0', 'moteng-v1.1.0', 'phonica-v1.10.0', 'phonica-v1.2.0'];
  assert.deepEqual(versionsFromTags('phonica', tags), ['1.0.0', '1.2.0', '1.10.0']);
  assert.deepEqual(versionsFromTags('motif', tags), ['0.10.0']);
  assert.deepEqual(versionsFromTags('particle-universe', tags), []);
});

test('next version: keep a fresh version, otherwise the patch after the highest tag', () => {
  assert.equal(nextVersion('1.1.0', []), '1.1.0');
  assert.equal(nextVersion('1.1.0', ['1.0.0']), '1.1.0');
  assert.equal(nextVersion('1.1.0', ['1.0.0', '1.1.0']), '1.1.1');
  assert.equal(nextVersion('1.1.0', ['1.1.0', '1.1.3']), '1.1.4');
  assert.equal(nextVersion('2.0.0', ['1.1.3']), '2.0.0');
  assert.throws(() => nextVersion('1.0', []));
});

test('paths map to apps, minus their ignores', () => {
  assert.ok(pathBelongs('phonica', 'phonica/src/main/main.ts'));
  assert.ok(!pathBelongs('phonica', 'phonica/tools/models/export_models.py'));
  assert.ok(!pathBelongs('phonica', 'phonica/README.md'));
  assert.ok(pathBelongs('moteng', 'mojing/tex/mojing.cls'));
  assert.ok(!pathBelongs('motif', 'moteng/package.json'));
  assert.deepEqual(appsTouched(['README.md', 'motif/src/a.js', 'docs/index.html']), ['motif']);
  assert.deepEqual(appsTouched(['mojing/tex/x.sty']), ['moteng']);
  assert.deepEqual(appsWithWorkflowChanges(['.github/workflows/phonica-windows.yml', '.github/workflows/ship.yml']), ['phonica']);
});

test('apps.json is complete and every workflow and note exists', () => {
  for (const [app, a] of Object.entries(APPS)) {
    assert.match(app, /^[a-z][a-z0-9-]*$/);
    for (const k of ['title', 'dir', 'paths', 'ignore', 'workflow', 'signerCopy', 'assets']) assert.ok(a[k], `${app}.${k}`);
    readFileSync(join(here, '..', '..', '.github', 'workflows', a.workflow), 'utf8');
    const notes = readFileSync(join(here, 'notes', `${app}.md`), 'utf8');
    for (const k of ['{{VERSION}}', '{{CHANGES}}', '{{SHA256}}', '{{SOURCE}}']) assert.ok(notes.includes(k), `${app} notes lack ${k}`);
    const pkg = JSON.parse(readFileSync(join(here, '..', '..', a.dir, 'package.json'), 'utf8'));
    const build = pkg.build ?? {};
    const yml = (() => { try { return readFileSync(join(here, '..', '..', a.dir, 'electron-builder.yml'), 'utf8'); } catch { return ''; } })();
    const feedUrl = `https://github.com/xhc144/claude-lab/releases/download/${app}-latest`;
    assert.ok(JSON.stringify(build.publish ?? '').includes(feedUrl) || yml.includes(feedUrl), `${app} does not read its update feed from ${feedUrl}`);
  }
  // the ship workflow has a build job for every app
  const ship = readFileSync(join(here, '..', '..', '.github', 'workflows', 'ship.yml'), 'utf8');
  for (const [app, a] of Object.entries(APPS)) assert.ok(ship.includes(`uses: ./.github/workflows/${a.workflow}`), `ship.yml does not build ${app}`);
});

test('update-signer accepts only the same certificate on an intact file', () => {
  const base = { currentStatus: 'Valid', currentThumbprint: 'AB12', candidateStatus: 'UnknownError', candidateThumbprint: 'ab12', cmsThumbprint: 'AB12', candidateSubject: 'CN=x' };
  assert.equal(judge(base).ok, true);
  assert.equal(judge({ ...base, candidateStatus: 'Valid' }).ok, true);
  assert.equal(judge({ ...base, candidateStatus: 'HashMismatch' }).ok, false);
  assert.equal(judge({ ...base, candidateStatus: 'NotSigned', candidateThumbprint: null }).ok, false);
  assert.equal(judge({ ...base, candidateThumbprint: 'CD34', cmsThumbprint: 'CD34' }).ok, false);
  assert.equal(judge({ ...base, cmsThumbprint: null, cmsError: 'bad signature' }).ok, false);
  assert.equal(judge({ ...base, cmsThumbprint: 'CD34' }).ok, false);
  assert.equal(judge({ ...base, currentThumbprint: null, currentStatus: 'NotSigned' }).ok, false);
  assert.equal(judge({ ...base, currentStatus: 'HashMismatch' }).ok, false);
  assert.equal(judge(null).ok, false);
});

test('update-feed.mjs makes urls absolute and checks hashes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feed-'));
  const setup = Buffer.from('installer bytes');
  writeFileSync(join(dir, 'App Setup 1.2.3.exe'), setup);
  writeFileSync(join(dir, 'App Setup 1.2.3.exe.blockmap'), 'x');
  const sha = createHash('sha512').update(setup).digest('base64');
  writeFileSync(join(dir, 'latest.yml'), `version: 1.2.3\nfiles:\n  - url: App Setup 1.2.3.exe\n    sha512: ${sha}\n    size: ${setup.length}\npath: App Setup 1.2.3.exe\nsha512: ${sha}\nreleaseDate: '2026-10-16T00:00:00.000Z'\n`);
  const out = join(dir, 'out', 'latest.yml');
  execFileSync(process.execPath, [join(here, 'update-feed.mjs'), dir, 'o/r', 'app-v1.2.3', out], { stdio: 'pipe' });
  const feed = readFileSync(out, 'utf8');
  assert.match(feed, /- url: https:\/\/github\.com\/o\/r\/releases\/download\/app-v1\.2\.3\/App%20Setup%201\.2\.3\.exe/);
  assert.match(feed, /^path: https:\/\/github\.com\/o\/r\/releases\/download\/app-v1\.2\.3\//m);
  // a tag for another version is refused
  assert.throws(() => execFileSync(process.execPath, [join(here, 'update-feed.mjs'), dir, 'o/r', 'app-v1.2.4', out], { stdio: 'pipe' }));
  // a file that does not match its hash is refused
  writeFileSync(join(dir, 'App Setup 1.2.3.exe'), 'tampered bytes!');
  assert.throws(() => execFileSync(process.execPath, [join(here, 'update-feed.mjs'), dir, 'o/r', 'app-v1.2.3', out], { stdio: 'pipe' }));
});

test('bump.mjs writes package.json and package-lock.json versions', () => {
  // runs against a scratch copy of the repository layout
  const root = mkdtempSync(join(tmpdir(), 'bump-'));
  mkdirSync(join(root, 'scripts', 'windows-release'), { recursive: true });
  for (const f of ['lib.mjs', 'bump.mjs', 'apps.json']) writeFileSync(join(root, 'scripts', 'windows-release', f), readFileSync(join(here, f)));
  mkdirSync(join(root, 'phonica'));
  writeFileSync(join(root, 'phonica', 'package.json'), JSON.stringify({ name: 'phonica', version: '1.1.0' }, null, 2) + '\n');
  writeFileSync(join(root, 'phonica', 'package-lock.json'), JSON.stringify({ name: 'phonica', version: '1.1.0', lockfileVersion: 3, packages: { '': { name: 'phonica', version: '1.1.0' } } }, null, 2) + '\n');
  writeFileSync(join(root, 'tags'), 'phonica-v1.0.0\nphonica-v1.1.0\nmotif-v9.9.9\n');
  const out = execFileSync(process.execPath, [join(root, 'scripts', 'windows-release', 'bump.mjs'), join(root, 'tags'), 'phonica'], { encoding: 'utf8' });
  assert.equal(out.trim(), 'phonica 1.1.0 1.1.1');
  assert.equal(JSON.parse(readFileSync(join(root, 'phonica', 'package.json'), 'utf8')).version, '1.1.1');
  const lock = JSON.parse(readFileSync(join(root, 'phonica', 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, '1.1.1');
  assert.equal(lock.packages[''].version, '1.1.1');
});
