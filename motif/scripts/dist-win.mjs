#!/usr/bin/env node
// Builds the Windows release: production bundles → Skill docs → bundled FFmpeg → electron-builder
// (NSIS installer + portable zip, x64). Works on Windows (CI) and cross-builds from Linux/macOS
// (no wine needed: executable resources are stamped by scripts/after-pack.cjs).
//   node scripts/dist-win.mjs [--dir]   (--dir: unpacked app only, fastest)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const run = (script, ...args) => execFileSync(process.execPath, [path.join(root, script), ...args], { stdio: 'inherit', cwd: root });

run('scripts/build.mjs');
run('scripts/gen-skill-docs.mjs');
run('scripts/fetch-ffmpeg.mjs', '--platform', 'win32', '--arch', 'x64');

const { build, Platform, Arch } = require('electron-builder');
const dirOnly = process.argv.includes('--dir');
const cross = process.platform !== 'win32';
const nsisOnLinux = cross && !process.argv.includes('--no-nsis');
const targets = dirOnly ? ['dir'] : ['nsis', 'zip'];
const result = await build({
  projectDir: root,
  targets: Platform.WINDOWS.createTarget(targets, Arch.x64),
  publish: 'never', // releases are uploaded by the workflow (see .github/workflows/motif-windows.yml)
  config: {
    win: { signAndEditExecutable: !cross },
  },
}).catch((e) => {
  if (nsisOnLinux && /wine|makensis/i.test(String(e.message))) console.error('NSIS 安装包需要在 Windows 上构建（或安装 wine）；可用 --dir 生成绿色版，或交给 CI 的 windows-latest 任务。');
  throw e;
});
for (const f of result) if (fs.existsSync(f)) console.log('→', path.relative(root, f), `${(fs.statSync(f).size / 1e6).toFixed(1)} MB`);
void require;
