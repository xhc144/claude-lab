#!/usr/bin/env node
// Turns the latest.yml that electron-builder writes next to an NSIS installer into the update
// feed the apps read from https://github.com/<repo>/releases/download/<app>-latest/latest.yml.
// The installer itself stays in the versioned release, so every url in the feed is made absolute
// and points there. Sizes and SHA-512 hashes are re-checked against the files on disk first.
//
//   node scripts/windows-release/update-feed.mjs <release-dir> <owner/repo> <versioned-tag> <out-file>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [dir, repo, tag, out] = process.argv.slice(2);
if (!dir || !repo || !tag || !out) {
  console.error('usage: update-feed.mjs <release-dir> <owner/repo> <versioned-tag> <out-file>');
  process.exit(2);
}
if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w.-]+$/.test(tag)) throw new Error(`bad repo or tag: ${repo} ${tag}`);

const src = join(dir, 'latest.yml');
if (!existsSync(src)) throw new Error(`${src} not found: electron-builder writes it only for an nsis target with a publish config`);
const yml = readFileSync(src, 'utf8');
const base = `https://github.com/${repo}/releases/download/${tag}/`;

const version = yml.match(/^version:\s*(\S+)/m)?.[1];
if (!version) throw new Error('latest.yml has no version');
if (!tag.endsWith(`v${version}`)) throw new Error(`tag ${tag} does not match version ${version}`);

const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2');
const files = [...yml.matchAll(/^\s*- url:\s*(.+)\n\s+sha512:\s*(.+)\n\s+size:\s*(\d+)/gm)].map((m) => ({ url: unquote(m[1]), sha512: unquote(m[2]), size: Number(m[3]) }));
if (!files.length) throw new Error('latest.yml lists no files');
for (const f of files) {
  if (/^[a-z]+:\/\//i.test(f.url)) throw new Error(`already absolute: ${f.url}`);
  const p = join(dir, f.url);
  if (!existsSync(p)) throw new Error(`${f.url} listed in latest.yml but missing from ${dir}`);
  if (statSync(p).size !== f.size) throw new Error(`${f.url}: size ${statSync(p).size} != ${f.size}`);
  const sha = createHash('sha512').update(readFileSync(p)).digest('base64');
  if (sha !== f.sha512) throw new Error(`${f.url}: sha512 mismatch`);
  if (!existsSync(p + '.blockmap')) console.warn(`note: ${f.url}.blockmap missing; updates will download the whole installer`);
}

const abs = (name) => base + encodeURIComponent(name);
const feed = yml
  .replace(/^(\s*- url:\s*)(.+)$/gm, (_, k, v) => k + abs(unquote(v)))
  .replace(/^(path:\s*)(.+)$/m, (_, k, v) => k + abs(unquote(v)));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, feed);
console.log(`update feed for ${version} → ${out}\n${feed}`);
