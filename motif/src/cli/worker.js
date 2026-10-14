// Spawns the Electron render worker and talks to it over a local socket / named pipe.
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Find the app root (folder with package.json whose main is dist/main.cjs) for dev runs. */
function appRoot() {
  for (const up of ['..', '../..', '../../..']) {
    const dir = path.resolve(here, up);
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) { try { if (JSON.parse(fs.readFileSync(pkg, 'utf8')).name === 'motif') return dir; } catch { /* continue */ } }
  }
  return null;
}

export function electronCommand() {
  if (process.env.MOTIF_ELECTRON) return { exe: process.env.MOTIF_ELECTRON, args: [] };
  // Packaged: the CLI runs inside Motif.exe with ELECTRON_RUN_AS_NODE; relaunch the same binary.
  if (process.versions.electron) return { exe: process.execPath, args: [] };
  const root = appRoot();
  if (!root) throw new Error('找不到 Motif 应用目录（开发模式需在 motif/ 下构建）');
  const req = createRequire(path.join(root, 'package.json'));
  let exe;
  try { exe = req('electron'); } catch { throw new Error('未安装 electron 依赖：在 motif 目录运行 npm install'); }
  if (!fs.existsSync(path.join(root, 'dist/main.cjs'))) throw new Error('应用尚未构建：在 motif 目录运行 npm run build');
  return { exe, args: [root] };
}

function which(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) { const f = path.join(dir, bin); if (fs.existsSync(f)) return f; }
  return null;
}

/** Linux without a display (servers, CI): prefer Xvfb, fall back to Chromium's headless ozone. */
function launchPlan(cmd) {
  const extra = (process.env.MOTIF_WORKER_FLAGS || '').split(/\s+/).filter(Boolean);
  if (process.platform !== 'linux') return { exe: cmd.exe, pre: [], flags: extra };
  const flags = ['--no-sandbox', '--use-angle=swiftshader', ...extra];
  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) return { exe: cmd.exe, pre: [], flags };
  const xvfb = process.env.MOTIF_NO_XVFB ? null : which('xvfb-run');
  if (xvfb) return { exe: xvfb, pre: ['-a', cmd.exe], flags };
  return { exe: cmd.exe, pre: [], flags: ['--ozone-platform=headless', ...flags] };
}

/**
 * Run a render job. Returns the worker result. onProgress receives {done,total,...}.
 */
export function runJob(job, { onProgress, onLog, timeoutMs = 60 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const sock = process.platform === 'win32' ? `\\\\.\\pipe\\motif-${process.pid}-${Date.now()}` : path.join(os.tmpdir(), `motif-${process.pid}-${Date.now()}.sock`);
    let settled = false;
    let child;
    const finish = (fn, v) => { if (settled) return; settled = true; clearTimeout(timer); server.close(); if (process.platform !== 'win32') fs.rmSync(sock, { force: true }); fn(v); };
    const server = net.createServer((conn) => {
      conn.write(JSON.stringify({ type: 'job', job }) + '\n');
      let buf = '';
      conn.on('data', (d) => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          let m; try { m = JSON.parse(line); } catch { continue; }
          if (m.type === 'progress') onProgress?.(m);
          else if (m.type === 'log') onLog?.(m.message);
          else if (m.type === 'result') finish(resolve, m.result);
        }
      });
      conn.on('error', () => {});
    });
    server.on('error', (e) => finish(reject, e));
    server.listen(sock, () => {
      let cmd;
      try { cmd = electronCommand(); } catch (e) { return finish(reject, e); }
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const plan = launchPlan(cmd);
      const args = [...plan.pre, ...cmd.args, `--motif-worker=${sock}`, ...plan.flags];
      child = spawn(plan.exe, args, { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let err = '';
      child.stderr.on('data', (d) => { err += d.toString(); if (err.length > 20000) err = err.slice(-8000); });
      child.stdout.on('data', () => {});
      child.on('error', (e) => finish(reject, e));
      child.on('exit', (code) => {
        setTimeout(() => {
          if (!settled) finish(reject, new Error(`渲染进程意外退出（代码 ${code}）\n${err.split('\n').filter((l) => !/dbus|Fontconfig|gpu_init|viz_main|egl|GLDisplay|ozone|sandbox/i.test(l)).slice(-8).join('\n')}`));
        }, 300);
      });
    });
    const timer = setTimeout(() => { try { child?.kill(); } catch { /* ignore */ } finish(reject, new Error('渲染超时')); }, timeoutMs);
  });
}
