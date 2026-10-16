#!/usr/bin/env node
// Sets the version of each app about to be released, so no version is ever released twice.
//
//   node scripts/windows-release/bump.mjs <tags-file> <app> [<app> ...]
//
// <tags-file> lists every tag in the repository (published or not). For each app the version in
// package.json is kept if it is newer than every <app>-v* tag; otherwise it becomes the next patch
// version (1.2.3 → 1.2.4 after the highest tag). package.json and package-lock.json are updated in
// place; nothing is committed. Prints "app old new" for every app.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { APPS, nextVersion, repoRoot, versionsFromTags } from './lib.mjs';

const [tagsFile, ...apps] = process.argv.slice(2);
if (!tagsFile || !apps.length) throw new Error('usage: bump.mjs <tags-file> <app> [<app> ...]');
const tags = readFileSync(tagsFile, 'utf8').split(/\s+/).filter(Boolean);

function setVersion(file, version, lock) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  const json = JSON.parse(text);
  json.version = version;
  if (lock && json.packages?.['']) json.packages[''].version = version;
  const indent = /^\{\n( +|\t)"/.exec(text)?.[1] ?? '  ';
  writeFileSync(file, JSON.stringify(json, null, indent) + (text.endsWith('\n') ? '\n' : ''));
}

for (const app of apps) {
  if (!APPS[app]) throw new Error(`unknown app ${app}`);
  const dir = join(repoRoot, APPS[app].dir);
  const current = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  const next = nextVersion(current, versionsFromTags(app, tags));
  if (next !== current) {
    setVersion(join(dir, 'package.json'), next, false);
    setVersion(join(dir, 'package-lock.json'), next, true);
  }
  console.log(`${app} ${current} ${next}`);
}
