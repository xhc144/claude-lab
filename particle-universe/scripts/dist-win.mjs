// Builds the Windows deliverables (electron-builder "nsis" target; scripts/after-pack.cjs trims and
// stamps the exe, so no Wine is needed for that):
//   release/win-unpacked/                                 unpacked app
//   release/ParticleUniverse-Setup-<v>-x64.exe            installer; installed copies update themselves
//   release/latest.yml (+ .blockmap)                      update information for the installer
//   release/ParticleUniverse-<v>-win-x64-portable.zip     unzip anywhere, run ParticleUniverse.exe (no auto-update)
//   node scripts/dist-win.mjs [--installer | --no-installer]
// The installer is built by default on Windows; elsewhere NSIS needs Wine, so pass --installer to try.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

const installer = process.argv.includes('--installer') || (isWin && !process.argv.includes('--no-installer'));
if (!installer) console.log('› skipping the NSIS installer (Windows builds it by default; --installer to force)');
const setup = path.join(release, `ParticleUniverse-Setup-${version}-x64.exe`);
console.log(`› packaging Windows app (electron-builder, ${installer ? 'nsis' : 'dir'} target)`);
fs.rmSync(unpacked, { recursive: true, force: true });
for (const f of [setup, setup + '.blockmap', path.join(release, 'latest.yml')]) fs.rmSync(f, { force: true });
run(process.execPath, [path.join(root, 'node_modules/electron-builder/cli.js'), '--win', installer ? 'nsis' : 'dir', '--x64', '--publish', 'never', `-c.electronVersion=${electronVersion}`, ...(electronDist ? [`-c.electronDist=${electronDist}`] : [])]);
const exe = path.join(unpacked, exeName);
if (!fs.existsSync(exe)) throw new Error('electron-builder did not produce ' + exe);
if (installer) for (const f of [setup, path.join(release, 'latest.yml'), path.join(unpacked, 'resources', 'app-update.yml')]) if (!fs.existsSync(f)) throw new Error('electron-builder did not produce ' + f);

console.log('› writing portable zip');
const folder = `ParticleUniverse-${version}-win-x64`;
const stage = path.join(release, folder);
const zipFile = path.join(release, `${folder}-portable.zip`);
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zipFile, { force: true });
fs.cpSync(unpacked, stage, { recursive: true });
// the portable copy has no update feed: updating it would install a second copy elsewhere
fs.rmSync(path.join(stage, 'resources', 'app-update.yml'), { force: true });
const readme = fs.readFileSync(path.join(root, 'scripts/README-win.txt'), 'utf8').replace(/\r?\n/g, '\r\n').replace('{VERSION}', version);
fs.writeFileSync(path.join(stage, 'README.txt'), '\ufeff' + readme);
if (!isWin && has('zip')) run('zip', ['-q', '-r', '-9', '-X', zipFile, folder], { cwd: release });
else if (has('7z')) run('7z', ['a', '-tzip', '-mx=9', zipFile, folder], { cwd: release, stdio: 'ignore' });
else run('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${folder}' -DestinationPath '${zipFile}' -CompressionLevel Optimal`], { cwd: release });
fs.rmSync(stage, { recursive: true, force: true });

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(1) + ' MB';
console.log(`\nDone:\n  ${path.relative(root, zipFile)}  ${mb(zipFile)}\n  sha256 ${sha(zipFile)}`);
if (installer) console.log(`  ${path.relative(root, setup)}  ${mb(setup)}\n  sha256 ${sha(setup)}`);
console.log(`  exe sha256 ${sha(exe)}`);
