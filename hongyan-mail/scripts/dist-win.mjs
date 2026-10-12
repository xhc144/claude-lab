// Builds the Windows deliverables from any OS (no Wine needed):
//   release/win-unpacked/                     the app (electron-builder "dir" target)
//   release/HongyanMail-Setup-<v>.exe         NSIS installer (per-user, no admin rights)
//   release/HongyanMail-<v>-win-x64-portable.zip
// Requires `makensis` (apt install nsis / choco install nsis) and `zip` on PATH.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as ResEdit from 'resedit';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const release = path.join(root, 'release');
const unpacked = path.join(release, 'win-unpacked');
const exeName = 'Hongyan Mail.exe';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });

console.log('› building app bundles');
run(process.execPath, ['scripts/build.mjs']);

console.log('› packaging Windows app (electron-builder, dir target)');
fs.rmSync(unpacked, { recursive: true, force: true });
run(process.execPath, [path.join(root, 'node_modules/electron-builder/cli.js'), '--win', 'dir', '--x64', '--publish', 'never']);
const exe = path.join(unpacked, exeName);
if (!fs.existsSync(exe)) throw new Error('electron-builder did not produce ' + exe);

// DirectX Shader Compiler: only used by WebGPU (Dawn), which the app disables. Dropping it keeps the
// installer well below GitHub's 100 MiB file limit.
for (const f of ['dxcompiler.dll', 'dxil.dll']) fs.rmSync(path.join(unpacked, f), { force: true });

console.log('› stamping icon and version information into the executable');
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
    ProductName: '鸿雁邮箱',
    FileDescription: '鸿雁邮箱',
    CompanyName: 'Hongyan Mail',
    LegalCopyright: 'MIT License',
    OriginalFilename: exeName,
    InternalName: 'Hongyan Mail',
    FileVersion: version,
    ProductVersion: version
  };
  const langs = vi.getAllLanguagesForStringValues();
  for (const l of langs.length ? langs : [{ lang: 1033, codepage: 1200 }]) vi.setStringValues(l, strings);
  vi.outputToResourceEntries(res.entries);
  res.outputResource(ntExe);
  fs.writeFileSync(exe, Buffer.from(ntExe.generate()));
}

console.log('› compiling NSIS installer');
const setup = path.join(release, `HongyanMail-Setup-${version}.exe`);
fs.rmSync(setup, { force: true });
run('makensis', ['-V2', `-DVERSION=${version}`, `-DSRC=${unpacked}`, `-DOUT=${setup}`, path.join(root, 'build/installer.nsi')]);

console.log('› creating portable zip');
const portableDir = path.join(release, `HongyanMail-${version}-portable`);
const zipFile = path.join(release, `HongyanMail-${version}-win-x64-portable.zip`);
fs.rmSync(portableDir, { recursive: true, force: true });
fs.rmSync(zipFile, { force: true });
fs.cpSync(unpacked, portableDir, { recursive: true });
fs.writeFileSync(path.join(portableDir, 'portable.txt'),
  '鸿雁邮箱便携版：数据（账户、邮件缓存、设置）保存在本目录的 data 文件夹中。\r\n删除本文件后，数据会改为保存在 %APPDATA%\\Hongyan Mail。\r\n');
run('zip', ['-q', '-r', '-9', zipFile, path.basename(portableDir)], { cwd: release });
fs.rmSync(portableDir, { recursive: true, force: true });

const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(1) + ' MB';
console.log(`\nDone:\n  ${path.relative(root, setup)}  (${mb(setup)})\n  ${path.relative(root, zipFile)}  (${mb(zipFile)})`);
