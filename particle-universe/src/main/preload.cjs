'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('pu', {
  platform: 'electron',
  openAudioDialog: () => ipcRenderer.invoke('dialog:openAudio'),
  saveVideoDialog: (defaultName, ext) => ipcRenderer.invoke('dialog:saveVideo', { defaultName, ext }),
  readFile: (p) => ipcRenderer.invoke('file:read', p),
  statFile: (p) => ipcRenderer.invoke('file:stat', p),
  fileOpen: (p) => ipcRenderer.invoke('file:open', p),
  fileWrite: (id, data, position) => ipcRenderer.invoke('file:write', id, data, position),
  fileClose: (id) => ipcRenderer.invoke('file:close', id),
  fileRemove: (p) => ipcRenderer.invoke('file:remove', p),
  writeFile: (p, data) => ipcRenderer.invoke('file:writeWhole', p, data),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file) || ''; } catch { return ''; } },
  paths: () => ipcRenderer.invoke('app:paths'),
  info: () => ipcRenderer.invoke('app:info'),
  gpu: () => ipcRenderer.invoke('app:gpu'),
  pendingFiles: () => ipcRenderer.invoke('app:pendingFiles'),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  toggleFullscreen: () => ipcRenderer.invoke('win:toggleFullscreen'),
  setFullscreen: (v) => ipcRenderer.invoke('win:setFullscreen', v),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  setOverlay: (opts) => ipcRenderer.invoke('win:overlay', opts),
  setProgress: (v) => ipcRenderer.invoke('win:setProgress', v),
  preventSleep: (on) => ipcRenderer.invoke('win:preventSleep', on),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen', (e, v) => cb(v)),
  onOpenFiles: (cb) => ipcRenderer.on('open-files', (e, files) => cb(files)),
  smokeLog: (msg) => ipcRenderer.send('smoke:log', String(msg)),
  smokeResult: (r) => ipcRenderer.send('smoke:result', r)
});
