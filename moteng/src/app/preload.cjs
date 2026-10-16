// Narrow bridge between the page and the main process.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('moteng', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  engines: () => ipcRenderer.invoke('engines'),
  fonts: () => ipcRenderer.invoke('fonts'),
  pickFiles: () => ipcRenderer.invoke('pick:files'),
  pickFolder: (purpose) => ipcRenderer.invoke('pick:folder', purpose),
  pickEngine: () => ipcRenderer.invoke('pick:engine'),
  inspect: (input) => ipcRenderer.invoke('inspect', input),
  clipboardHtml: () => ipcRenderer.invoke('clipboard:html'),
  convert: (job) => ipcRenderer.invoke('convert', job),
  openPath: (p) => ipcRenderer.invoke('open:path', p),
  showInFolder: (p) => ipcRenderer.invoke('open:folder', p),
  openUrl: (u) => ipcRenderer.invoke('open:url', u),
  pendingFiles: () => ipcRenderer.invoke('pending-files'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  updateStatus: () => ipcRenderer.invoke('update:status'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (fn) => ipcRenderer.on('update:status', (_, s) => fn(s)),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onProgress: (fn) => ipcRenderer.on('progress', (_, p) => fn(p)),
  onAddFiles: (fn) => ipcRenderer.on('add-files', (_, files) => fn(files)),
});
