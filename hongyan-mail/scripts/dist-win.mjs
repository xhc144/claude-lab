// Builds the Windows deliverables (electron-builder; scripts/after-pack.cjs trims, stamps and signs
// the exe, so no Wine is needed for that):
//   release/win-unpacked/                          unpacked app
//   release/HongyanMail-Setup-<v>.exe              installer (per-user, no admin rights); installed
//   release/latest.yml (+ .blockmap)               copies update themselves from this information
//   release/HongyanMail-<v>-win-x64-portable.zip   unzip anywhere; keeps data beside the exe, no auto-update
//   node scripts/dist-win.mjs [--installer | --no-installer]
// The installer is built by default on Windows; elsewhere NSIS needs Wine, so pass --installer to try.
// With WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD set, the exe and the installer are signed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const release = path.join(root, 'release');
const unpacked = path.join(release, 'win-unpacked');
const exeName = 'Hongyan Mail.exe';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
const isWin = process.platform === 'win32';
const has = (cmd) => { try { execFileSync(isWin ? 'where' : 'which', [isWin ? cmd + '.exe' : cmd], { stdio: 'ignore' }); return true; } catch { return false; } };

console.log('› building app bundles');
run(process.execPath, ['scripts/build.mjs']);

const installer = process.argv.includes('--installer') || (isWin && !process.argv.includes('--no-installer'));
if (!installer) console.log('› skipping the NSIS installer (Windows builds it by default; --installer to force)');
const setup = path.join(release, `HongyanMail-Setup-${version}.exe`);
console.log(`› packaging Windows app (electron-builder, ${installer ? 'nsis' : 'dir'} target)`);
fs.rmSync(unpacked, { recursive: true, force: true });
for (const f of [setup, setup + '.blockmap', path.join(release, 'latest.yml')]) fs.rmSync(f, { force: true });
run(process.execPath, [path.join(root, 'node_modules/electron-builder/cli.js'), '--win', installer ? 'nsis' : 'dir', '--x64', '--publish', 'never']);
const exe = path.join(unpacked, exeName);
if (!fs.existsSync(exe)) throw new Error('electron-builder did not produce ' + exe);
if (installer) for (const f of [setup, path.join(release, 'latest.yml'), path.join(unpacked, 'resources', 'app-update.yml')]) if (!fs.existsSync(f)) throw new Error('electron-builder did not produce ' + f);

console.log('› creating portable zip');
const folder = `HongyanMail-${version}-portable`;
const portableDir = path.join(release, folder);
const zipFile = path.join(release, `HongyanMail-${version}-win-x64-portable.zip`);
fs.rmSync(portableDir, { recursive: true, force: true });
fs.rmSync(zipFile, { force: true });
fs.cpSync(unpacked, portableDir, { recursive: true });
// the portable copy has no update feed: updating it would install a second copy elsewhere
fs.rmSync(path.join(portableDir, 'resources', 'app-update.yml'), { force: true });
fs.writeFileSync(path.join(portableDir, 'portable.txt'),
  '鸿雁邮箱便携版：数据（账户、邮件缓存、设置）保存在本目录的 data 文件夹中。\r\n删除本文件后，数据会改为保存在 %APPDATA%\\Hongyan Mail。\r\n');
if (!isWin && has('zip')) run('zip', ['-q', '-r', '-9', '-X', zipFile, folder], { cwd: release });
else if (has('7z')) run('7z', ['a', '-tzip', '-mx=9', zipFile, folder], { cwd: release, stdio: 'ignore' });
else run('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${folder}' -DestinationPath '${zipFile}' -CompressionLevel Optimal`], { cwd: release });
fs.rmSync(portableDir, { recursive: true, force: true });

const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(1) + ' MB';
console.log(`\nDone:\n  ${path.relative(root, zipFile)}  (${mb(zipFile)})`);
if (installer) console.log(`  ${path.relative(root, setup)}  (${mb(setup)})`);
