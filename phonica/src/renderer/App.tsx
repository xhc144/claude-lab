import { useEffect, useState, type ReactElement } from 'react';
import { useApp, type Page } from './lib/store.tsx';
import { api } from './lib/api.ts';
import { Toasts } from './components/ui.tsx';
import { IconMic, IconHistory, IconTarget, IconBook, IconSettings } from './components/icons.tsx';
import { Practice } from './pages/Practice.tsx';
import { History } from './pages/History.tsx';
import { Weak } from './pages/Weak.tsx';
import { Materials } from './pages/Materials.tsx';
import { Settings } from './pages/Settings.tsx';

const NAV: Array<{ id: Page; label: string; icon: ReactElement }> = [
  { id: 'practice', label: '朗读练习', icon: <IconMic /> },
  { id: 'history', label: '历史记录', icon: <IconHistory /> },
  { id: 'weak', label: '薄弱项', icon: <IconTarget /> },
  { id: 'materials', label: '素材库', icon: <IconBook /> },
];

export function App() {
  const { route, go, engine, historyVersion } = useApp();
  const [mini, setMini] = useState<{ n: number; avg: number } | null>(null);
  useEffect(() => {
    api.listRecords().then((l) => {
      const recent = l.slice(0, 20);
      setMini({ n: l.length, avg: recent.length ? Math.round(recent.reduce((s, e) => s + e.scores.overall, 0) / recent.length) : 0 });
    }).catch(() => undefined);
  }, [historyVersion]);
  useEffect(() => api.ready(), []);

  const status = engine.ready ? 'ok' : engine.error ? 'err' : '';
  return (
    <div className="app">
      <div className="titlebar">
        <div className="brand"><div className="logo">声</div>声准<small>Phonica</small></div>
        <div className="spacer" />
        <div className={`status ${status}`} title={engine.error ?? ''}>
          <span className="dot" />
          {engine.ready ? (engine.info?.calibrated ? '本地评测引擎就绪' : '评测引擎就绪（未校准）') : engine.error ? '评测引擎错误' : '正在加载评测模型…'}
        </div>
      </div>
      <nav className="sidebar">
        {NAV.map((n) => (
          <div key={n.id} className={`nav-item ${route.page === n.id ? 'active' : ''}`} onClick={() => go({ page: n.id })}>
            {n.icon}{n.label}
          </div>
        ))}
        <div className="nav-sep" />
        <div className={`nav-item ${route.page === 'settings' ? 'active' : ''}`} onClick={() => go({ page: 'settings' })}><IconSettings />设置</div>
        <div className="grow" />
        {mini && mini.n > 0 && (
          <div className="mini-stats">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div><b>{mini.n}</b>次练习</div>
              <div style={{ textAlign: 'right' }}><b style={{ color: `var(--${mini.avg >= 80 ? 'good' : mini.avg >= 60 ? 'fair' : 'poor'})` }}>{mini.avg}</b>近期均分</div>
            </div>
          </div>
        )}
      </nav>
      <main className="main">
        <div style={{ display: route.page === 'practice' ? 'contents' : 'none' }}><Practice /></div>
        {route.page === 'history' && <History />}
        {route.page === 'weak' && <Weak />}
        {route.page === 'materials' && <Materials />}
        {route.page === 'settings' && <Settings />}
      </main>
      <Toasts />
    </div>
  );
}
