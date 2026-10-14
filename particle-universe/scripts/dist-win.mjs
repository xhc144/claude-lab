// Builds the Windows deliverable from any OS (no Wine):
//   release/win-unpacked/                                 unpacked app (electron-builder "dir" target)
//   release/ParticleUniverse-<v>-win-x64-portable.zip     unzip anywhere, run ParticleUniverse.exe
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as ResEdit from 'resedit';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const electronVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version;
const release = path.join(root, 'release');
const unpacked = path.join(release, 'win-unpacked');
const exeName = 'ParticleUniverse.exe';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });

const isWin = process.platform === 'win32';
const has = (cmd) => { try { execFileSync(isWin ? 'where' : 'which', [isWin ? cmd + '.exe' : cmd], { stdio: 'ignore' }); return true; } catch { return false; } };

// Electron for Windows: prefer a local copy (offline / proxy-friendly); otherwise electron-builder downloads it.
const cacheZip = process.env.ELECTRON_WIN_ZIP || path.join(process.env.HOME || process.env.USERPROFILE || '', '.cache/electron', `electron-v${electronVersion}-win32-x64.zip`);
let electronDist = path.join(root, 'build-cache', `electron-v${electronVersion}-win32-x64`);
if (!fs.existsSync(path.join(electronDist, 'electron.exe'))) {
  if (fs.existsSync(cacheZip) && has('unzip')) {
    fs.mkdirSync(electronDist, { recursive: true });
    run('unzip', ['-q', '-o', cacheZip, '-d', electronDist]);
  } else {
    electronDist = null;
  }
}

console.log('› building renderer');
run(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build']);
if (!fs.existsSync(path.join(root, 'build/icon.ico'))) run(process.execPath, ['scripts/make-icons.mjs']);

console.log('› packaging Windows app (electron-builder, dir target)');
fs.rmSync(unpacked, { recursive: true, force: true });
run(process.execPath, [path.join(root, 'node_modules/electron-builder/cli.js'), '--win', 'dir', '--x64', '--publish', 'never', `-c.electronVersion=${electronVersion}`, ...(electronDist ? [`-c.electronDist=${electronDist}`] : [])]);
const exe = path.join(unpacked, exeName);
if (!fs.existsSync(exe)) throw new Error('electron-builder did not produce ' + exe);

// DirectX Shader Compiler is only used by WebGPU (Dawn); the app renders with WebGL2 (ANGLE/D3D11,
// which uses d3dcompiler_47.dll and is kept).
for (const f of ['dxcompiler.dll', 'dxil.dll', 'resources/default_app.asar']) fs.rmSync(path.join(unpacked, f), { force: true });

console.log('› stamping icon and version information');
{
  const data = fs.readFileSync(exe);
  const ntExe = ResEdit.NtExecutable.from(data, { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(ntExe);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(root, 'build/icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const groupLang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, groupLang, iconFile.icons.map((i) => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const [ma, mi, pa] = version.split('.').map(Number);
  vi.setFileVersion(ma, mi, pa, 0, 1033);
  vi.setProductVersion(ma, mi, pa, 0, 1033);
  const strings = {
    ProductName: '音乐粒子宇宙',
    FileDescription: '音乐粒子宇宙 · GPU 音乐可视化',
    CompanyName: 'Particle Universe',
    LegalCopyright: 'MIT License',
    OriginalFilename: exeName,
    InternalName: 'ParticleUniverse',
    FileVersion: version,
    ProductVersion: version
  };
  const langs = vi.getAllLanguagesForStringValues();
  for (const l of langs.length ? langs : [{ lang: 1033, codepage: 1200 }]) vi.setStringValues(l, strings);
  vi.outputToResourceEntries(res.entries);
  res.outputResource(ntExe);
  fs.writeFileSync(exe, Buffer.from(ntExe.generate()));
}

console.log('› writing portable zip');
const folder = `ParticleUniverse-${version}-win-x64`;
const stage = path.join(release, folder);
const zipFile = path.join(release, `${folder}-portable.zip`);
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zipFile, { force: true });
fs.cpSync(unpacked, stage, { recursive: true });
const readme = fs.readFileSync(path.join(root, 'scripts/README-win.txt'), 'utf8').replace(/\r?\n/g, '\r\n').replace('{VERSION}', version);
fs.writeFileSync(path.join(stage, '使用说明.txt'), '﻿' + readme);
fs.writeFileSync(path.join(stage, 'README.txt'), '﻿' + readme);
fs.rmSync(path.join(stage, '使用说明.txt'));
run('zip', ['-q', '-r', '-9', '-X', zipFile, folder], { cwd: release });
fs.rmSync(stage, { recursive: true, force: true });

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(1) + ' MB';
console.log(`\nDone:\n  ${path.relative(root, zipFile)}  ${mb(zipFile)}\n  sha256 ${sha(zipFile)}\n  exe sha256 ${sha(exe)}`);
