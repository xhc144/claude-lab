// Fills vendor/tectonic/cache with every TeX file and font the two styles
// need, so the packaged app compiles offline. Needs network; run after
// fetch-tectonic.js. Ends by compiling again with --only-cached to prove it.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { convert } from '../src/core/convert.js';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'vendor', 'tectonic');
const exe = path.join(dir, process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');
const cache = path.join(dir, 'cache');
if (!fs.existsSync(exe)) {
  console.error('先运行 node scripts/fetch-tectonic.js');
  process.exit(1);
}
fs.mkdirSync(cache, { recursive: true });
process.env.TECTONIC_CACHE_DIR = cache;

const fixtures = path.join(root, 'fixtures', 'selftest');
const inputs = fs.readdirSync(fixtures).filter((f) => f.endsWith('.html')).map((f) => path.join(fixtures, f));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-warm-'));

async function pass(label, engine) {
  let failed = 0;
  for (const input of inputs) {
    for (const style of ['chat', 'notes']) {
      // safeFonts: also fetch the TeX-tree fonts the fallback path uses.
      for (const safeFonts of [false, true]) {
        const t = Date.now();
        try {
          const r = await convert(input, { style, safeFonts, outRoot: out, engine, title: `${path.basename(input, '.html')}-${style}${safeFonts ? '-safe' : ''}-${label}`, fetchImages: false, timeout: 600000 });
          console.log(`${label} ${path.basename(input)} ${style}${safeFonts ? ' safe' : ''}: ok ${((Date.now() - t) / 1000).toFixed(1)}s font=${r.cjkFont} repaired=${r.repaired} style=${r.style}`);
          if (r.style !== style) { failed++; console.log('  style fell back'); }
        } catch (e) {
          failed++;
          console.log(`${label} ${path.basename(input)} ${style}${safeFonts ? ' safe' : ''}: FAILED ${e.message}`);
          if (e.log) console.log(e.log.slice(-3000));
        }
      }
    }
  }
  return failed;
}

const online = await pass('warm', { kind: 'tectonic', path: exe, label: 'Tectonic（预热）' });
const offline = await pass('offline', { kind: 'tectonic', path: exe, label: 'Tectonic（离线）', cache });
let bytes = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else bytes += fs.statSync(p).size; } };
walk(cache);
console.log(`缓存大小：${(bytes / 1048576).toFixed(1)} MB`);
fs.rmSync(out, { recursive: true, force: true });
await probeFonts();
if (online || offline) {
  console.error(`失败：预热 ${online} 个，离线 ${offline} 个`);
  process.exit(1);
}

// Diagnostics: which ways of naming a system font this Tectonic build accepts.
async function probeFonts() {
  const { detectFonts } = await import('../src/core/latex/fonts.js');
  const { spawnSync } = await import('node:child_process');
  const f = detectFonts().serif;
  if (!f) { console.log('字体探测：没有找到系统中文字体，跳过'); return; }
  const full = f.dir + f.file;
  const idx = /\.ttc$/i.test(f.file) ? `, FontIndex=${f.index}` : '';
  const methods = {
    'Path=绝对路径': `\\setCJKmainfont{${f.file}}[Path=${f.dir}${idx}]`,
    '字体名': `\\setCJKmainfont{${f.file.replace(/\.tt[cf]$/i, '') === 'simsun' ? 'SimSun' : 'Microsoft YaHei'}}`,
    '方括号路径': `\\setCJKmainfont{[${full}]}`,
    '复制到文档目录': `\\setCJKmainfont{${f.file}}[${idx.slice(2)}]`,
    '复制后 Path=./': `\\setCJKmainfont{${f.file}}[Path=./${idx}]`,
  };
  for (const [name, cmd] of Object.entries(methods)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-font-'));
    if (name.startsWith('复制')) fs.copyFileSync(full, path.join(dir, f.file));
    fs.writeFileSync(path.join(dir, 'main.tex'), `\\documentclass{article}\n\\usepackage{xeCJK}\n\\IfFileExists{${full}}{\\typeout{MOTENG-EXISTS-YES}}{\\typeout{MOTENG-EXISTS-NO}}\n${cmd}\n\\begin{document}中文测试\\end{document}\n`);
    const r = spawnSync(exe, ['--keep-logs', '--chatter', 'minimal', 'main.tex'], { cwd: dir, env: { ...process.env, TECTONIC_CACHE_DIR: cache }, encoding: 'utf8', timeout: 300000 });
    let log = '';
    try { log = fs.readFileSync(path.join(dir, 'main.log'), 'utf8'); } catch { /* none */ }
    const ok = r.status === 0 && fs.existsSync(path.join(dir, 'main.pdf'));
    const exists = /MOTENG-EXISTS-YES/.test(log) ? '是' : /MOTENG-EXISTS-NO/.test(log) ? '否' : '?';
    const err = ((log.match(/^! .*$/m) || [])[0] || (r.stderr || '').split('\n').find((l) => /error/i.test(l)) || '').slice(0, 200);
    console.log(`字体探测 [${name}] ${ok ? '成功' : '失败'}  IfFileExists=${exists}  ${err}`);
  }
}
