// electron-builder afterPack hook. When building the Windows app on a non-Windows host there is
// no rcedit/wine, so stamp the icon and version resources into Motif.exe with resedit (pure JS).
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32' || process.platform === 'win32') return;
  const ResEdit = await import('resedit');
  const pkg = ctx.packager.appInfo;
  const exePath = path.join(ctx.appOutDir, `${pkg.productFilename}.exe`);
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.ico')));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map((i) => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const [a, b, c] = pkg.version.split('.').map((n) => parseInt(n, 10) || 0);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    ProductName: 'Motif', FileDescription: 'Motif 律影 — 动态视觉创作', CompanyName: 'Motif',
    LegalCopyright: `© ${new Date().getFullYear()} Motif`, OriginalFilename: `${pkg.productFilename}.exe`, InternalName: 'Motif',
    FileVersion: pkg.version, ProductVersion: pkg.version,
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • stamped icon + version info into', path.basename(exePath));
};
