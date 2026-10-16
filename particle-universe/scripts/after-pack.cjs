// electron-builder afterPack hook: trims Windows files the app does not use and stamps the icon and
// version information into ParticleUniverse.exe with resedit (pure JS, so it works from any OS).
// Runs before the NSIS installer is built, so the installer and the portable zip carry the same exe.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const dir = ctx.appOutDir;
  // DirectX Shader Compiler is only used by WebGPU (Dawn); the app renders with WebGL2 (ANGLE/D3D11,
  // which uses d3dcompiler_47.dll and is kept).
  for (const f of ['dxcompiler.dll', 'dxil.dll', 'resources/default_app.asar']) fs.rmSync(path.join(dir, f), { force: true });

  const ResEdit = await import('resedit');
  const version = ctx.packager.appInfo.version;
  const exeName = `${ctx.packager.appInfo.productFilename}.exe`;
  const exe = path.join(dir, exeName);
  const ntExe = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(ntExe);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.ico')));
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
    ProductVersion: version,
  };
  const langs = vi.getAllLanguagesForStringValues();
  for (const l of langs.length ? langs : [{ lang: 1033, codepage: 1200 }]) vi.setStringValues(l, strings);
  vi.outputToResourceEntries(res.entries);
  res.outputResource(ntExe);
  fs.writeFileSync(exe, Buffer.from(ntExe.generate()));
  console.log('  • trimmed unused DLLs and stamped icon + version info into', exeName);
};
