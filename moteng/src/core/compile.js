// Finding and running a TeX engine.
//
// Preference: the Tectonic bundled with the app (offline cache included), then
// an installed TeX Live / MiKTeX xelatex. The user may also point at an engine.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const EXE = process.platform === 'win32' ? '.exe' : '';

function exists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function onPath(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    const p = path.join(d, name + EXE);
    if (exists(p)) return p;
  }
  return null;
}

function windowsTexCandidates() {
  const out = [];
  const roots = [process.env.SystemDrive ? process.env.SystemDrive + '\\' : 'C:\\', 'D:\\'];
  for (const root of roots) {
    const tl = path.join(root, 'texlive');
    try {
      for (const year of fs.readdirSync(tl).filter((y) => /^\d{4}$/.test(y)).sort().reverse()) {
        out.push(path.join(tl, year, 'bin', 'windows', 'xelatex.exe'), path.join(tl, year, 'bin', 'win64', 'xelatex.exe'), path.join(tl, year, 'bin', 'win32', 'xelatex.exe'));
      }
    } catch { /* no TeX Live here */ }
  }
  const local = process.env.LOCALAPPDATA;
  if (local) out.push(path.join(local, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64', 'xelatex.exe'));
  for (const pf of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) {
    out.push(path.join(pf, 'MiKTeX', 'miktex', 'bin', 'x64', 'xelatex.exe'), path.join(pf, 'MiKTeX', 'miktex', 'bin', 'xelatex.exe'));
  }
  return out;
}

/**
 * @param {object} o { resourcesDir?: string, custom?: string }
 * @returns {{kind:'tectonic'|'xelatex', path:string, label:string, cache?:string}[]}
 */
export function findEngines(o = {}) {
  const engines = [];
  const add = (e) => { if (!engines.some((x) => x.path === e.path)) engines.push(e); };
  if (o.custom && exists(o.custom)) {
    add({ kind: /tectonic/i.test(path.basename(o.custom)) ? 'tectonic' : 'xelatex', path: o.custom, label: '自定义：' + o.custom });
  }
  if (process.env.MOTENG_TECTONIC && exists(process.env.MOTENG_TECTONIC)) {
    add({ kind: 'tectonic', path: process.env.MOTENG_TECTONIC, label: 'Tectonic（环境变量）', cache: process.env.TECTONIC_CACHE_DIR });
  }
  for (const dir of [o.resourcesDir && path.join(o.resourcesDir, 'tectonic'), path.resolve(import.meta.dirname, '../../vendor/tectonic')].filter(Boolean)) {
    const p = path.join(dir, 'tectonic' + EXE);
    if (exists(p)) {
      const cache = path.join(dir, 'cache');
      add({ kind: 'tectonic', path: p, label: '内置 Tectonic', cache: fs.existsSync(cache) ? cache : undefined });
    }
  }
  const sys = onPath('xelatex');
  if (sys) add({ kind: 'xelatex', path: sys, label: /miktex/i.test(sys) ? 'MiKTeX（系统）' : 'TeX Live（系统）' });
  if (process.platform === 'win32') {
    for (const p of windowsTexCandidates()) if (exists(p)) add({ kind: 'xelatex', path: p, label: /miktex/i.test(p) ? 'MiKTeX' : 'TeX Live' });
  } else if (process.platform === 'darwin') {
    for (const p of ['/Library/TeX/texbin/xelatex', '/usr/local/texlive/2026/bin/universal-darwin/xelatex']) if (exists(p)) add({ kind: 'xelatex', path: p, label: 'MacTeX' });
  }
  const tect = onPath('tectonic');
  if (tect) add({ kind: 'tectonic', path: tect, label: 'Tectonic（系统）' });
  return engines;
}

/** Errors from a TeX log: [{ file, line, message }]. */
export function parseLog(log, mainName = 'main.tex') {
  const errors = [];
  const lines = log.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m = l.match(/^(?:\.\/)?(.+?\.(?:tex|sty|cls|def|cfg)):(\d+): (.*)$/);
    if (m) {
      errors.push({ file: path.basename(m[1]), line: +m[2], message: m[3] + (lines[i + 1] && !lines[i + 1].startsWith('l.') ? ' ' + lines[i + 1].trim() : '') });
      continue;
    }
    m = l.match(/^! (.*)$/);
    if (m) {
      let line = 0;
      for (let k = i + 1; k < Math.min(lines.length, i + 30); k++) {
        const lm = lines[k].match(/^l\.(\d+)/);
        if (lm) { line = +lm[1]; break; }
      }
      // Tectonic prints "error: main.tex:12: …" itself; avoid double counting.
      if (!errors.some((e) => e.line === line && e.message.startsWith(m[1].slice(0, 20)))) errors.push({ file: mainName, line, message: m[1] });
      continue;
    }
    m = l.match(/^error: (?:\.\/)?(.+?\.tex):(\d+): (.*)$/);
    if (m) errors.push({ file: path.basename(m[1]), line: +m[2], message: m[3] });
  }
  // A missing package or font in the preamble.
  return errors;
}

function run(cmd, args, opts) {
  return new Promise((resolve) => {
    let out = '';
    let killed = false;
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env, windowsHide: true });
    const timer = setTimeout(() => { killed = true; child.kill(); }, opts.timeout || 180000);
    child.stdout.on('data', (d) => { out += d; opts.onData?.(String(d)); });
    child.stderr.on('data', (d) => { out += d; opts.onData?.(String(d)); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out: out + '\n' + e.message, killed }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, killed }); });
  });
}

/**
 * One engine pass on <dir>/main.tex. For xelatex `passes` controls reruns;
 * Tectonic reruns by itself.
 */
export async function compileOnce(engine, dir, { passes = 1, onData, timeout, offline = true } = {}) {
  const env = { ...process.env };
  let result;
  if (engine.kind === 'tectonic') {
    if (engine.cache) env.TECTONIC_CACHE_DIR = engine.cache;
    const args = ['--keep-logs', '--chatter', 'minimal'];
    if (offline && engine.cache) args.push('--only-cached');
    args.push('main.tex');
    result = await run(engine.path, args, { cwd: dir, env, onData, timeout });
    // A package missing from the bundled cache: try once more online.
    if (result.code !== 0 && offline && engine.cache && /not (found|available)|only-cached|cached/i.test(result.out) && !/main\.tex:\d+:/.test(result.out)) {
      result = await run(engine.path, ['--keep-logs', '--chatter', 'minimal', 'main.tex'], { cwd: dir, env, onData, timeout });
    }
  } else {
    // No -halt-on-error: one run then reports every independent bad formula.
    const args = ['-interaction=nonstopmode', '-file-line-error'];
    if (/miktex/i.test(engine.path)) args.push('--enable-installer');
    args.push('main.tex');
    for (let p = 0; p < passes; p++) {
      result = await run(engine.path, args, { cwd: dir, env, onData, timeout });
      if (result.code !== 0) break;
    }
  }
  let log = '';
  try { log = fs.readFileSync(path.join(dir, 'main.log'), 'utf8'); } catch { log = result.out; }
  const pdf = path.join(dir, 'main.pdf');
  const ok = result.code === 0 && exists(pdf);
  const errors = ok ? [] : parseLog(log + '\n' + result.out);
  return { ok, pdf: ok ? pdf : null, log, out: result.out, errors, killed: result.killed };
}

export function cleanAux(dir) {
  for (const ext of ['aux', 'out', 'toc', 'xdv', 'fls', 'fdb_latexmk', 'synctex.gz', 'bbl', 'blg']) {
    try { fs.rmSync(path.join(dir, `main.${ext}`)); } catch { /* absent */ }
  }
  // Font probes (\IfFontExistsTF) leave this behind on TeX Live.
  try { fs.rmSync(path.join(dir, 'missfont.log')); } catch { /* absent */ }
}

export function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'moteng-'));
}
