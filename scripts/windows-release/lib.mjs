// Shared helpers for the release pipeline (.github/workflows/ship.yml): which apps a change touches,
// which apps have unreleased changes, and which version a release should get.
// Every app is described in apps.json next to this file.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, '..', '..');
export const APPS = JSON.parse(readFileSync(join(here, 'apps.json'), 'utf8'));

export const git = (args, opts = {}) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts }).trim();

/** "1.10.0" → [1, 10, 0]; null for anything that is not plain x.y.z. */
export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? '').trim());
  return m ? m.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) throw new Error(`not a version: ${!x ? a : b}`);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

export const bumpPatch = (v) => { const [a, b, c] = parseVersion(v); return `${a}.${b}.${c + 1}`; };

/** Release tag of an app version, e.g. phonica-v1.2.0. */
export const tagOf = (app, version) => `${app}-v${version}`;

/** Versions of `app` among tag names (other apps' tags and the <app>-latest feed are ignored). */
export function versionsFromTags(app, tags) {
  const prefix = `${app}-v`;
  return tags
    .filter((t) => t.startsWith(prefix))
    .map((t) => t.slice(prefix.length))
    .filter((v) => parseVersion(v))
    .sort(compareVersions);
}

/** Does a repository path belong to the app (its paths, minus its ignores)? */
export function pathBelongs(app, file) {
  const a = APPS[app];
  return a.paths.some((p) => file.startsWith(p)) && !a.ignore.some((p) => file.startsWith(p));
}

/** Apps touched by a list of changed paths. */
export function appsTouched(files) {
  return Object.keys(APPS).filter((app) => files.some((f) => pathBelongs(app, f)));
}

/** Apps whose build workflow changed: rebuilt and tested, but not released for that alone. */
export function appsWithWorkflowChanges(files) {
  return Object.keys(APPS).filter((app) => files.includes(`.github/workflows/${APPS[app].workflow}`));
}

/**
 * Version the next release of an app gets. The version in package.json is kept when no tag exists for
 * it yet and it is newer than every released version (so a hand-picked 2.0.0 survives); otherwise it
 * becomes the patch after the highest existing version. `taken` lists every existing version tag of
 * the app, released or not, so a version is never reused.
 */
export function nextVersion(current, taken) {
  if (!parseVersion(current)) throw new Error(`package.json version "${current}" is not x.y.z`);
  const highest = taken.length ? taken.reduce((m, v) => (compareVersions(v, m) > 0 ? v : m)) : null;
  if (!highest || compareVersions(current, highest) > 0) return current;
  return bumpPatch(highest);
}

export const changedFiles = (from, to) => git(['diff', '--name-only', from, to]).split('\n').filter(Boolean);

export const readVersion = (app, ref = null) =>
  JSON.parse(ref ? git(['show', `${ref}:${APPS[app].dir}/package.json`]) : readFileSync(join(repoRoot, APPS[app].dir, 'package.json'), 'utf8')).version;
