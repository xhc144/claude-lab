// GUI mode (editor). Filled in by the editor implementation.
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { handleProtocol } from './protocol.js';

export function runApp({ distDir }) {
  app.whenReady().then(() => {
    handleProtocol(distDir);
    const win = new BrowserWindow({ width: 1440, height: 900, webPreferences: { preload: path.join(distDir, 'preload.cjs') } });
    win.loadURL('motif://app/editor.html');
  });
  app.on('window-all-closed', () => app.quit());
}
