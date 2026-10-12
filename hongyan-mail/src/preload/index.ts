// The only bridge between the sandboxed renderer and the main process.
import { contextBridge, ipcRenderer, webUtils } from 'electron';

const API_CHANNEL = 'hy:invoke';
const EVENT_CHANNEL = 'hy:event';

contextBridge.exposeInMainWorld('hy', {
  // Returns an envelope { ok, value } | { ok: false, error }; the renderer unwraps it so that
  // diagnosis details survive the context bridge (thrown errors lose custom properties).
  invoke: (method: string, ...args: unknown[]) => ipcRenderer.invoke(API_CHANNEL, method, args),
  onEvent: (cb: (e: unknown) => void) => {
    const handler = (_e: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(EVENT_CHANNEL, handler);
    return () => ipcRenderer.removeListener(EVENT_CHANNEL, handler);
  },
  ready: () => ipcRenderer.send('hy:renderer-ready'),
  platform: process.platform,
  pathForFile: (file: File) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  }
});
