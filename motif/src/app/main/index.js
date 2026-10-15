// Electron main process. Two modes share one binary:
//   GUI mode (default)        → the editor
//   --motif-worker=<socket>   → headless render worker driven by the CLI over a local socket
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import { registerSchemePrivileges, handleProtocol } from './protocol.js';
import { runRenderJob } from './render-job.js';

const distDir = __dirname; // main.cjs lives in dist/
const workerArg = process.argv.find((a) => a.startsWith('--motif-worker'));

registerSchemePrivileges();
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Software 2D raster in the worker: predictable output and much cheaper pixel readback.
if (workerArg) app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
if (workerArg) runWorker(workerArg.split('=')[1]);
else import('./app.js').then((m) => m.runApp({ distDir })).catch((e) => { console.error(e); app.exit(1); });

function runWorker(sock) {
  // isolated profile so a worker never fights a running editor over Chromium's profile locks
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-worker-'));
  app.setPath('userData', profile);
  app.on('window-all-closed', () => {});
  const cleanup = () => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ } };
  app.whenReady().then(() => {
    handleProtocol(distDir);
    const conn = net.connect(sock);
    const send = (m) => { try { conn.write(JSON.stringify(m) + '\n'); } catch { /* closed */ } };
    let buf = '';
    conn.on('data', async (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.type !== 'job') continue;
        try {
          const r = await runRenderJob(msg.job, {
            distDir,
            preload: path.join(distDir, 'worker-preload.cjs'),
            onProgress: (p) => send({ type: 'progress', ...p }),
            onLog: (s) => send({ type: 'log', message: s }),
          });
          send({ type: 'result', result: r });
        } catch (e) {
          send({ type: 'result', result: { ok: false, error: e.message, stack: e.stack } });
        }
        conn.end(() => { cleanup(); app.exit(0); });
      }
    });
    conn.on('error', (e) => { console.error('worker socket error', e.message); cleanup(); app.exit(2); });
  });
}
