// Chinese (and code) fonts present on this machine, addressed by file so the
// engine needs no font lookup: Tectonic and MiKTeX see system fonts unevenly,
// but every XeTeX loads "file.ttc" with Path=… reliably.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function fontDirs() {
  const dirs = [];
  if (process.platform === 'win32') {
    const win = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
    dirs.push(path.join(win, 'Fonts'));
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
  } else if (process.platform === 'darwin') {
    dirs.push('/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts'));
  } else {
    dirs.push('/usr/share/fonts/opentype/noto', '/usr/share/fonts/opentype/source-han-serif', '/usr/share/fonts/opentype/source-han-sans',
      '/usr/share/fonts/truetype/noto', '/usr/share/fonts/noto-cjk', '/usr/share/fonts/google-noto-cjk', '/usr/share/fonts/opentype',
      '/usr/share/fonts/truetype', path.join(os.homedir(), '.local/share/fonts'), path.join(os.homedir(), '.fonts'));
  }
  return dirs;
}

function listing(dir) {
  try { return new Map(fs.readdirSync(dir).map((n) => [n.toLowerCase(), n])); } catch { return new Map(); }
}

// Each candidate: [file name, ttc index]. First hit wins.
const ROLES = {
  serif: [['SourceHanSerifSC-Regular.otf', 0], ['SourceHanSerifCN-Regular.otf', 0], ['NotoSerifCJKsc-Regular.otf', 0], ['NotoSerifSC-Regular.otf', 0],
    ['simsun.ttc', 0], ['Songti.ttc', 0], ['NotoSerifCJK-Regular.ttc', 2]],
  serifBold: [['SourceHanSerifSC-Bold.otf', 0], ['SourceHanSerifCN-Bold.otf', 0], ['NotoSerifCJKsc-Bold.otf', 0], ['NotoSerifSC-Bold.otf', 0],
    ['simhei.ttf', 0], ['Songti.ttc', 1], ['NotoSerifCJK-Bold.ttc', 2]],
  sans: [['msyh.ttc', 0], ['SourceHanSansSC-Regular.otf', 0], ['NotoSansCJKsc-Regular.otf', 0], ['NotoSansSC-Regular.otf', 0],
    ['PingFang.ttc', 0], ['NotoSansCJK-Regular.ttc', 2], ['simhei.ttf', 0]],
  sansBold: [['msyhbd.ttc', 0], ['SourceHanSansSC-Bold.otf', 0], ['NotoSansCJKsc-Bold.otf', 0], ['NotoSansSC-Bold.otf', 0],
    ['PingFang.ttc', 4], ['NotoSansCJK-Bold.ttc', 2], ['simhei.ttf', 0]],
  kai: [['simkai.ttf', 0], ['STKAITI.TTF', 0], ['Kaiti.ttc', 0], ['LXGWWenKai-Regular.ttf', 0]],
  fang: [['simfang.ttf', 0], ['STFANGSO.TTF', 0]],
  mono: [['consola.ttf', 0], ['CascadiaMono.ttf', 0], ['Menlo.ttc', 0], ['SFNSMono.ttf', 0], ['DejaVuSansMono.ttf', 0]],
  monoBold: [['consolab.ttf', 0], ['Menlo.ttc', 1], ['DejaVuSansMono-Bold.ttf', 0]],
};

export function detectFonts() {
  const dirs = fontDirs().map((d) => ({ dir: d, files: listing(d) }));
  const pick = (role) => {
    for (const [file, index] of ROLES[role]) {
      for (const { dir, files } of dirs) {
        const real = files.get(file.toLowerCase());
        if (real) return { dir: dir.replace(/\\/g, '/').replace(/\/?$/, '/'), file: real, index };
      }
    }
    return null;
  };
  const plan = {};
  for (const role of Object.keys(ROLES)) plan[role] = pick(role);
  return plan;
}

function spec(f, extra = '') {
  const opts = [`Path=${f.dir}`];
  if (/\.ttc$/i.test(f.file)) opts.push(`FontIndex=${f.index}`);
  if (extra) opts.push(extra);
  return { name: f.file, opts: opts.join(', ') };
}

function boldSpec(f) {
  // BoldFont lives in the same Path as the regular face only when the dirs match.
  return /\.ttc$/i.test(f.file) ? `BoldFont=${f.file}, BoldFeatures={FontIndex=${f.index}}` : `BoldFont=${f.file}`;
}

// A font file outside the main face's directory has to be given by full path.
function sameDir(a, b) {
  return a && b && a.dir === b.dir;
}

// Family names for the files above. Tectonic's XeTeX cannot open a font by
// absolute path on Windows (fontspec: 'The font "simsun" cannot be found'),
// but finds the same font by name; TeX Live and MiKTeX accept both.
const FAMILY = {
  'simsun.ttc': 'SimSun', 'simhei.ttf': 'SimHei', 'simkai.ttf': 'KaiTi', 'simfang.ttf': 'FangSong',
  'stkaiti.ttf': 'STKaiti', 'stfangso.ttf': 'STFangsong', 'msyh.ttc': 'Microsoft YaHei', 'msyhbd.ttc': 'Microsoft YaHei',
  'sourcehanserifsc-regular.otf': 'Source Han Serif SC', 'sourcehanserifsc-bold.otf': 'Source Han Serif SC',
  'sourcehanserifcn-regular.otf': 'Source Han Serif CN', 'sourcehanserifcn-bold.otf': 'Source Han Serif CN',
  'sourcehansanssc-regular.otf': 'Source Han Sans SC', 'sourcehansanssc-bold.otf': 'Source Han Sans SC',
  'notoserifcjksc-regular.otf': 'Noto Serif CJK SC', 'notoserifcjksc-bold.otf': 'Noto Serif CJK SC',
  'notoserifcjk-regular.ttc': 'Noto Serif CJK SC', 'notoserifcjk-bold.ttc': 'Noto Serif CJK SC',
  'notosanscjksc-regular.otf': 'Noto Sans CJK SC', 'notosanscjksc-bold.otf': 'Noto Sans CJK SC',
  'notosanscjk-regular.ttc': 'Noto Sans CJK SC', 'notosanscjk-bold.ttc': 'Noto Sans CJK SC',
  'notoserifsc-regular.otf': 'Noto Serif SC', 'notoserifsc-bold.otf': 'Noto Serif SC',
  'notosanssc-regular.otf': 'Noto Sans SC', 'notosanssc-bold.otf': 'Noto Sans SC',
  'songti.ttc': 'Songti SC', 'pingfang.ttc': 'PingFang SC', 'kaiti.ttc': 'Kaiti SC', 'lxgwwenkai-regular.ttf': 'LXGW WenKai',
  'consola.ttf': 'Consolas', 'consolab.ttf': 'Consolas', 'cascadiamono.ttf': 'Cascadia Mono', 'menlo.ttc': 'Menlo',
  'dejavusansmono.ttf': 'DejaVu Sans Mono', 'dejavusansmono-bold.ttf': 'DejaVu Sans Mono',
};

export function familyName(f) {
  return f ? FAMILY[f.file.toLowerCase()] || null : null;
}

// "By name if the engine can find it, else by file if the file is there."
function either(name, byName, byPath, f) {
  const pathBlock = f.dir.includes(' ') ? byPath : `\\IfFileExists{${f.dir}${f.file}}{%\n${byPath}%\n}{}`;
  if (!name) return pathBlock;
  return `\\IfFontExistsTF{${name}}{%\n${byName}%\n}{%\n${pathBlock}%\n}`;
}

/**
 * TeX that installs the detected fonts. Each face is tried by family name
 * first, then by file, so the same .tex still compiles on another machine
 * (where neither exists, the class's Fandol fonts stay in place).
 */
export function cjkFontTeX(plan, { noFakeSlant = false } = {}) {
  const lines = [];
  const s = plan.serif;
  const slant = noFakeSlant ? '' : 'AutoFakeSlant=0.2';
  if (s) {
    const n = familyName(s);
    const b = plan.serifBold;
    const nb = familyName(b);
    const k = plan.kai;
    const nk = familyName(k);
    const nameOpts = [b ? (nb && nb !== n ? `BoldFont=${nb}` : '') : 'AutoFakeBold=2.5', nk ? `ItalicFont=${nk}` : slant].filter(Boolean).join(', ');
    const bp = b && sameDir(s, b) ? b : null;
    const kp = k && sameDir(s, k) ? k : null;
    const sp = spec(s, [bp ? boldSpec(bp) : 'AutoFakeBold=2.5', kp ? `ItalicFont=${kp.file}` : slant].filter(Boolean).join(', '));
    lines.push(either(n,
      `  \\setCJKmainfont{${n}}[${nameOpts}]\n  \\setCJKfamilyfont{zhsong}{${n}}[${nameOpts}]`,
      `  \\setCJKmainfont{${sp.name}}[${sp.opts}]\n  \\setCJKfamilyfont{zhsong}{${sp.name}}[${sp.opts}]`, s));
  }
  const ss = plan.sans;
  if (ss) {
    const n = familyName(ss);
    const b = plan.sansBold;
    const nb = familyName(b);
    const nameOpts = b ? (nb && nb !== n ? `BoldFont=${nb}` : '') : 'AutoFakeBold=2.5';
    const bp = b && sameDir(ss, b) ? b : null;
    const sp = spec(ss, bp ? boldSpec(bp) : 'AutoFakeBold=2.5');
    const md = spec(ss, bp ? boldSpec(bp) : 'AutoFakeBold=1.5');
    const o = nameOpts ? `[${nameOpts}]` : '';
    lines.push(either(n,
      `  \\setCJKsansfont{${n}}${o}\n  \\setCJKmonofont{${n}}${o}\n  \\setCJKfamilyfont{zhhei}{${n}}${o}\n  \\setCJKfamilyfont{zhheimd}{${n}}${o}`,
      `  \\setCJKsansfont{${sp.name}}[${sp.opts}]\n  \\setCJKmonofont{${sp.name}}[${sp.opts}]\n  \\setCJKfamilyfont{zhhei}{${sp.name}}[${sp.opts}]\n  \\setCJKfamilyfont{zhheimd}{${md.name}}[${md.opts}]`, ss));
  }
  for (const [role, family] of [['kai', 'zhkai'], ['fang', 'zhfs']]) {
    const f = plan[role];
    if (!f) continue;
    const n = familyName(f);
    const sp = spec(f, 'AutoFakeBold=2.5');
    lines.push(either(n, `  \\setCJKfamilyfont{${family}}{${n}}[AutoFakeBold=2.5]`, `  \\setCJKfamilyfont{${family}}{${sp.name}}[${sp.opts}]`, f));
  }
  return lines.join('\n');
}

export function monoFontTeX(plan) {
  const m = plan.mono;
  if (!m) return '';
  const n = familyName(m);
  const b = plan.monoBold && sameDir(m, plan.monoBold) ? plan.monoBold : null;
  const sp = spec(m, [b ? boldSpec(b) : '', 'Scale=MatchLowercase'].filter(Boolean).join(', '));
  return either(n, `  \\setmonofont{${n}}[Scale=MatchLowercase]`, `  \\setmonofont{${sp.name}}[${sp.opts}]`, m);
}

/**
 * Makes another CJK face the body font: hei (微软雅黑 / 思源黑体), kai (楷体) or fang (仿宋).
 * Emitted after cjkFontTeX; when the face is missing the earlier main font stays.
 * `safe`: only the Fandol fonts that ship with TeX.
 */
export function cjkMainTeX(plan, role, { safe = false, noFakeSlant = false } = {}) {
  if (!role || role === 'song') return '';
  const slant = noFakeSlant ? '' : ', AutoFakeSlant=0.2';
  if (safe || !plan) {
    const fandol = { hei: ['FandolHei-Regular.otf', 'FandolHei-Bold.otf'], kai: ['FandolKai-Regular.otf', ''], fang: ['FandolFang-Regular.otf', ''] }[role];
    if (!fandol) return '';
    return `\\setCJKmainfont{${fandol[0]}}[${fandol[1] ? `BoldFont=${fandol[1]}` : 'AutoFakeBold=2.5'}${slant}]`;
  }
  const f = role === 'hei' ? plan.sans : plan[role];
  if (!f) return '';
  const b = role === 'hei' ? plan.sansBold : null;
  const n = familyName(f);
  const nb = familyName(b);
  const nameOpts = [b ? (nb && nb !== n ? `BoldFont=${nb}` : '') : 'AutoFakeBold=2.5', slant.slice(2)].filter(Boolean).join(', ');
  const bp = b && sameDir(f, b) ? b : null;
  const sp = spec(f, [bp ? boldSpec(bp) : 'AutoFakeBold=2.5', slant.slice(2)].filter(Boolean).join(', '));
  return either(n, `  \\setCJKmainfont{${n}}${nameOpts ? `[${nameOpts}]` : ''}`, `  \\setCJKmainfont{${sp.name}}[${sp.opts}]`, f);
}
