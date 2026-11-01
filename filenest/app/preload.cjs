'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const names = ['getState', 'pickFolder', 'saveRule', 'deleteRule', 'excludeItem', 'previewRule', 'runRule', 'activity', 'undoBatch', 'setPaused', 'setStartup',
  'search', 'searchTops', 'rebuildIndex', 'openPath', 'showInFolder', 'saveCategories', 'resetCategories', 'testCategory',
  'openDataFolder', 'exportSettings', 'importSettings', 'runDiagnostics', 'quit', 'getTranslate', 'saveTranslate', 'testTranslate'];
const api = {};
for (const name of names) api[name] = argument => ipcRenderer.invoke('filenest:' + name, argument);
api.onEvent = callback => { const listener = (_e, payload) => callback(payload); ipcRenderer.on('filenest:event', listener); return () => ipcRenderer.removeListener('filenest:event', listener); };
contextBridge.exposeInMainWorld('filenest', Object.freeze(api));
