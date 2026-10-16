// App-wide state: settings, engine status, navigation and toasts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type EngineStatus } from './api.ts';
import type { Settings, UpdateStatus } from '../../shared/types.ts';

export type Page = 'practice' | 'history' | 'weak' | 'materials' | 'settings';

export interface Route {
  page: Page;
  recordId?: string;
}

export interface PracticeRequest {
  text: string;
  materialId?: string;
  title?: string;
  nonce: number;
}

interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

interface Ctx {
  settings: Settings | null;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  engine: EngineStatus;
  route: Route;
  go: (r: Route) => void;
  practice: PracticeRequest | null;
  startPractice: (text: string, materialId?: string, title?: string) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  toasts: Toast[];
  historyVersion: number;
  bumpHistory: () => void;
  theme: 'light' | 'dark';
  update: UpdateStatus | null;
}

const C = createContext<Ctx>(null as unknown as Ctx);

export function useApp() {
  return useContext(C);
}

function systemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [engine, setEngine] = useState<EngineStatus>({ ready: false, error: null, info: null });
  const [route, setRoute] = useState<Route>({ page: 'practice' });
  const [practice, setPractice] = useState<PracticeRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [dark, setDark] = useState(systemDark());
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const seq = useRef(1);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => undefined);
    api.engineStatus().then(setEngine).catch(() => undefined);
    const off = api.onEngineStatus(setEngine);
    api.updateStatus().then(setUpdate).catch(() => undefined);
    const offUpdate = api.onUpdateStatus(setUpdate);
    // used by the self-test to visit pages for screenshots
    const offNav = api.onNavigate((r) => setRoute({ page: r.page as Page, recordId: r.recordId }));
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMq = () => setDark(mq.matches);
    mq.addEventListener('change', onMq);
    // poll until the engine reports ready (initial model load takes a few seconds)
    const t = setInterval(() => api.engineStatus().then((s) => { setEngine(s); if (s.ready || s.error) clearInterval(t); }).catch(() => undefined), 1000);
    return () => { off(); offUpdate(); offNav(); mq.removeEventListener('change', onMq); clearInterval(t); };
  }, []);

  const theme: 'light' | 'dark' = settings?.theme === 'dark' ? 'dark' : settings?.theme === 'light' ? 'light' : dark ? 'dark' : 'light';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = seq.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const saved = await api.saveSettings(next);
      setSettings(saved);
      if (patch.theme) api.setTheme(patch.theme);
    } catch (e) {
      toast(`保存设置失败：${(e as Error).message}`, 'error');
    }
  }, [settings, toast]);

  const value = useMemo<Ctx>(() => ({
    settings,
    updateSettings,
    engine,
    route,
    go: setRoute,
    practice,
    startPractice: (text, materialId, title) => {
      setPractice({ text, materialId, title, nonce: Date.now() });
      setRoute({ page: 'practice' });
    },
    toast,
    toasts,
    historyVersion,
    bumpHistory: () => setHistoryVersion((v) => v + 1),
    theme,
    update,
  }), [settings, updateSettings, engine, route, practice, toast, toasts, historyVersion, theme, update]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
