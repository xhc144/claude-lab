// Editor preload: a narrow, promise-based bridge. Every call goes through one channel and errors
// arrive as real Error objects carrying the same hint text the CLI shows.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const listeners = new Map();
ipcRenderer.on('motif:event', (_e, channel, payload) => { for (const fn of listeners.get(channel) || []) { try { fn(payload); } catch (err) { console.error(err); } } });
ipcRenderer.on('motif:command', (_e, cmd) => { for (const fn of listeners.get('command') || []) fn(cmd); });
ipcRenderer.on('motif:open-files', (_e, files) => { for (const fn of listeners.get('open-files') || []) fn(files); });
ipcRenderer.on('motif:fullscreen', (_e, on) => { for (const fn of listeners.get('fullscreen') || []) fn(on); });

contextBridge.exposeInMainWorld('motif', {
  platform: process.platform,
  async call(method, ...args) {
    const r = await ipcRenderer.invoke('motif:call', method, args);
    if (r && r.error) { const e = new Error(r.error); e.hint = r.hint; e.code = r.code; throw e; }
    return r ? r.result : undefined;
  },
  on(channel, fn) {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(fn);
    return () => listeners.get(channel).delete(fn);
  },
  /** Absolute path of a dropped File (Electron ≥ 32 removed File.path). */
  pathOf(file) { try { return webUtils.getPathForFile(file); } catch { return file.path || null; } },
});
