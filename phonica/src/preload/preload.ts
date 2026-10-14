// The renderer's API surface. Everything goes through invoke/handle with
// structured results; no Node access is exposed.
import { contextBridge, ipcRenderer } from 'electron';

type Res<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };

async function call<T>(ch: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(ch, ...args)) as Res<T>;
  if (!r.ok) {
    const e = new Error(r.error) as Error & { code?: string };
    e.code = r.code;
    throw e;
  }
  return r.value;
}

function on<T>(ch: string, cb: (v: T) => void): () => void {
  const fn = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(ch, fn);
  return () => ipcRenderer.removeListener(ch, fn);
}

const api = {
  engineStatus: () => call('engine:status'),
  assess: (req: unknown) => call('engine:assess', req),
  lookup: (word: string) => call('engine:lookup', word),
  textIpa: (text: string, accent: string) => call('engine:textIpa', text, accent),
  tts: (text: string, voice: string, speed: number) => call('engine:tts', text, voice, speed),
  onProgress: (cb: (p: { stage: string; frac: number }) => void) => on('engine:progress', cb),
  onEngineStatus: (cb: (s: unknown) => void) => on('engine:status', cb),

  listRecords: () => call('records:list'),
  getRecord: (id: string) => call('records:get', id),
  deleteRecord: (id: string) => call('records:delete', id),
  favorite: (id: string, fav: boolean) => call('records:favorite', id, fav),
  stats: () => call('records:stats'),

  listMaterials: () => call('materials:list'),
  saveMaterial: (m: unknown) => call('materials:save', m),
  deleteMaterial: (id: string) => call('materials:delete', id),
  importMaterial: () => call('materials:import'),

  exportEstimate: (id: string, o: unknown) => call('export:estimate', id, o),
  exportRun: (id: string, o: unknown, voice?: string) => call('export:run', id, o, voice),
  reportText: (id: string) => call('export:copyPrompt', id),
  showItem: (p: string) => call('shell:showItem', p),

  aiRun: (recordId: string, providerId: string, requestId: string) => call('ai:run', recordId, providerId, requestId),
  aiCancel: (requestId: string) => call('ai:cancel', requestId),
  aiTest: (providerId: string, draft?: unknown) => call('ai:test', providerId, draft),
  aiDelete: (recordId: string, aiId: string) => call('ai:delete', recordId, aiId),
  onAiDelta: (cb: (d: { requestId: string; text: string }) => void) => on('ai:delta', cb),

  getSettings: () => call('settings:get'),
  saveSettings: (s: unknown) => call('settings:save', s),
  chooseDataDir: () => call('settings:chooseDataDir'),
  openDataDir: () => call('settings:openDataDir'),
  appInfo: () => call('app:info'),
  openExternal: (url: string) => call('shell:openExternal', url),
  setTheme: (mode: string) => ipcRenderer.send('theme:changed', mode),
  ready: () => ipcRenderer.send('renderer:ready'),
  onNavigate: (cb: (r: { page: string; recordId?: string; tab?: string }) => void) => on('app:navigate', cb),
  platform: process.platform,
};

contextBridge.exposeInMainWorld('phonica', api);
export type PhonicaApi = typeof api;
