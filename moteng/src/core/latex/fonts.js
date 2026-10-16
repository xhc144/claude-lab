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

/**
 * TeX that installs the detected fonts, each guarded by \IfFileExists so the
 * same .tex still compiles on another machine (falls back to Fandol there).
 */
export function cjkFontTeX(plan) {
  const lines = [];
  const guard = (f, then) => (f.dir.includes(' ') ? then : `\\IfFileExists{${f.dir}${f.file}}{%\n${then}%\n}{}`);
  const s = plan.serif;
  if (s) {
    const b = plan.serifBold && sameDir(s, plan.serifBold) ? plan.serifBold : null;
    const k = plan.kai && sameDir(s, plan.kai) ? plan.kai : null;
    const extra = [b ? boldSpec(b) : 'AutoFakeBold=2.5', k ? `ItalicFont=${k.file}` : 'AutoFakeSlant=0.2'].join(', ');
    const sp = spec(s, extra);
    lines.push(guard(s, `  \\setCJKmainfont{${sp.name}}[${sp.opts}]\n  \\setCJKfamilyfont{zhsong}{${sp.name}}[${sp.opts}]`));
  }
  const ss = plan.sans;
  if (ss) {
    const b = plan.sansBold && sameDir(ss, plan.sansBold) ? plan.sansBold : null;
    const sp = spec(ss, b ? boldSpec(b) : 'AutoFakeBold=2.5');
    const md = spec(ss, b ? boldSpec(b) : 'AutoFakeBold=1.5');
    lines.push(guard(ss, `  \\setCJKsansfont{${sp.name}}[${sp.opts}]\n  \\setCJKmonofont{${sp.name}}[${sp.opts}]\n  \\setCJKfamilyfont{zhhei}{${sp.name}}[${sp.opts}]\n  \\setCJKfamilyfont{zhheimd}{${md.name}}[${md.opts}]`));
  }
  if (plan.kai) {
    const sp = spec(plan.kai, 'AutoFakeBold=2.5');
    lines.push(guard(plan.kai, `  \\setCJKfamilyfont{zhkai}{${sp.name}}[${sp.opts}]`));
  }
  if (plan.fang) {
    const sp = spec(plan.fang, 'AutoFakeBold=2.5');
    lines.push(guard(plan.fang, `  \\setCJKfamilyfont{zhfs}{${sp.name}}[${sp.opts}]`));
  }
  return lines.join('\n');
}

export function monoFontTeX(plan) {
  const m = plan.mono;
  if (!m) return '';
  const b = plan.monoBold && sameDir(m, plan.monoBold) ? plan.monoBold : null;
  const sp = spec(m, [b ? boldSpec(b) : '', 'Scale=MatchLowercase'].filter(Boolean).join(', '));
  const set = `  \\setmonofont{${sp.name}}[${sp.opts}]`;
  return m.dir.includes(' ') ? set : `\\IfFileExists{${m.dir}${m.file}}{%\n${set}%\n}{}`;
}
