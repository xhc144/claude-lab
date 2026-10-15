// Typed access to the preload API.
import type { PhonicaApi } from '../../preload/preload.ts';
import type { AssessmentResult, HistoryEntry, Material, Settings, AiAnalysis, WeakStats, ExportOptions } from '../../shared/types.ts';

declare global {
  interface Window {
    phonica: PhonicaApi;
  }
}

const p = () => window.phonica;

export interface EngineStatus {
  ready: boolean;
  error: string | null;
  info: { ready: boolean; calibrated: boolean; tts: boolean; verifier: boolean; scoring: { trainedOn: string; metrics: Record<string, number>; model: string } | null } | null;
}

export interface TtsResult {
  url: string;
  words: Array<{ text: string; start: number; end: number }>;
  sampleRate: number;
  duration: number;
}

export interface Pron {
  phones: string[];
  source: string;
  accent: 'us' | 'uk' | 'both';
}

export const api = {
  engineStatus: () => p().engineStatus() as Promise<EngineStatus>,
  assess: (req: { text: string; accent: 'us' | 'uk'; mode: string; samples: Float32Array; sampleRate: number; materialId?: string }) =>
    p().assess(req) as Promise<{ entry: HistoryEntry; result: AssessmentResult }>,
  lookup: (word: string) => p().lookup(word) as Promise<{ word: string; ipaUS: string; ipaUK: string; prons: Pron[] }>,
  textIpa: (text: string, accent: 'us' | 'uk') => p().textIpa(text, accent) as Promise<Array<{ token: number; text: string; ipa: string; punct: string }>>,
  tts: (text: string, voice: string, speed: number) => p().tts(text, voice, speed) as Promise<TtsResult>,
  onProgress: (cb: (x: { stage: string; frac: number }) => void) => p().onProgress(cb),
  onEngineStatus: (cb: (s: EngineStatus) => void) => p().onEngineStatus(cb as (s: unknown) => void),
  listRecords: () => p().listRecords() as Promise<HistoryEntry[]>,
  getRecord: (id: string) => p().getRecord(id) as Promise<{ entry: HistoryEntry; result: AssessmentResult; ai: AiAnalysis[]; audioUrl: string }>,
  deleteRecord: (id: string) => p().deleteRecord(id) as Promise<void>,
  favorite: (id: string, fav: boolean) => p().favorite(id, fav) as Promise<void>,
  stats: () => p().stats() as Promise<WeakStats>,
  listMaterials: () => p().listMaterials() as Promise<Material[]>,
  saveMaterial: (m: Material) => p().saveMaterial(m) as Promise<Material[]>,
  deleteMaterial: (id: string) => p().deleteMaterial(id) as Promise<Material[]>,
  importMaterial: () => p().importMaterial() as Promise<{ title: string; text: string } | null>,
  exportEstimate: (id: string, o: ExportOptions) => p().exportEstimate(id, o) as Promise<{ mp3Bytes: number; wavBytes: number; durationSec: number }>,
  exportRun: (id: string, o: ExportOptions, voice?: string) => p().exportRun(id, o, voice) as Promise<{ paths: string[]; bytes: number; audio: { bytes: number; kbps: number; sampleRate: number } | null } | null>,
  reportText: (id: string) => p().reportText(id) as Promise<string>,
  showItem: (path: string) => p().showItem(path),
  aiRun: (recordId: string, providerId: string, requestId: string) => p().aiRun(recordId, providerId, requestId) as Promise<AiAnalysis>,
  aiCancel: (requestId: string) => p().aiCancel(requestId),
  aiTest: (providerId: string, draft?: unknown) => p().aiTest(providerId, draft) as Promise<string>,
  aiDelete: (recordId: string, aiId: string) => p().aiDelete(recordId, aiId),
  onAiDelta: (cb: (d: { requestId: string; text: string }) => void) => p().onAiDelta(cb),
  getSettings: () => p().getSettings() as Promise<Settings>,
  saveSettings: (s: Settings) => p().saveSettings(s) as Promise<Settings>,
  chooseDataDir: () => p().chooseDataDir() as Promise<string | null>,
  openDataDir: () => p().openDataDir(),
  appInfo: () => p().appInfo() as Promise<{ version: string; dataDir: string; engine: EngineStatus }>,
  openExternal: (url: string) => p().openExternal(url),
  setTheme: (m: string) => p().setTheme(m),
  ready: () => p().ready(),
  onNavigate: (cb: (r: { page: string; recordId?: string; tab?: string }) => void) => p().onNavigate(cb),
};
