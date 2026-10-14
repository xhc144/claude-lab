// Preload for hidden render windows (CLI worker and GUI export). Runs with Node access so the
// encoder's stdin lives in the render process: frames go canvas → FFmpeg without crossing IPC.
const { contextBridge, ipcRenderer } = require('electron');
const { spawn } = require('child_process');

let enc = null;
contextBridge.exposeInMainWorld('motifWorker', {
  job: () => ipcRenderer.invoke('motif:job'),
  frame: (buf) => ipcRenderer.invoke('motif:frame', buf),
  file: (name, buf) => ipcRenderer.invoke('motif:file', name, buf),
  progress: (p) => ipcRenderer.send('motif:progress', p),
  done: (r) => ipcRenderer.invoke('motif:done', r),
  encoderStart: (exe, args) => {
    enc = { proc: spawn(exe, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }), err: '' };
    enc.proc.stderr.on('data', (d) => { enc.err += d.toString(); if (enc.err.length > 20000) enc.err = enc.err.slice(-8000); });
    enc.exit = new Promise((res) => enc.proc.on('close', (code) => res(code)));
    enc.proc.stdin.on('error', () => {});
    return true;
  },
  encoderWrite: (u8) => new Promise((res) => {
    const b = Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
    if (enc.proc.stdin.write(b)) res(true); else enc.proc.stdin.once('drain', () => res(true));
  }),
  encoderEnd: async () => { enc.proc.stdin.end(); const code = await enc.exit; return { code, err: enc.err.split('\n').filter((l) => l && !/=/.test(l)).slice(-6).join(' ') }; },
});
