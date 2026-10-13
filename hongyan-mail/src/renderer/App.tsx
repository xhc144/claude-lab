import React, { useEffect, useRef, useState } from 'react';
import { Search, WifiOff, X } from 'lucide-react';
import type { ViewSpec } from '@shared/types';
import { useApp } from './store';
import { useShortcuts } from './lib/shortcuts';
import { Sidebar } from './components/Sidebar';
import { MessageList } from './components/MessageList';
import { Reader } from './components/Reader';
import { Composers } from './components/Composer';
import { ModalHost, Toasts } from './components/Overlays';
import { ContextMenuHost, cx, LogoMark, TooltipHost } from './components/ui';
import { Welcome } from './components/AddAccount';

const SEARCH_HELP = ['from:', 'to:', 'subject:', 'has:attachment', 'is:unread', 'is:starred', 'after:2024-01-01', 'in:sent'];

function TopBar({ searchRef }: { searchRef: React.RefObject<HTMLInputElement | null> }) {
  const s = useApp();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const prevView = useRef<ViewSpec>(s.view);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (s.view.kind !== 'search') { prevView.current = s.view; if (!focused) setText(''); }
  }, [s.view]);

  const run = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (!query) {
      if (useApp.getState().view.kind === 'search') s.setView(prevView.current);
      return;
    }
    s.setView({ kind: 'search', query }, { keepSearch: true });
  };

  return (
    <div className="topbar drag">
      <div className={cx('search', focused && 'is-focused', s.view.kind === 'search' && 'is-active')}>
        <Search size={15} className="search-icon" />
        <input
          ref={searchRef}
          className="no-drag"
          value={text}
          placeholder="搜索邮件、联系人、附件…"
          onChange={(e) => {
            setText(e.target.value);
            if (timer.current) clearTimeout(timer.current);
            const v = e.target.value;
            timer.current = setTimeout(() => run(v), 280);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run(text);
            if (e.key === 'Escape') { e.preventDefault(); setText(''); run(''); (e.target as HTMLInputElement).blur(); }
          }}
          spellCheck={false}
          aria-label="搜索邮件"
        />
        {text ? (
          <button className="search-clear no-drag" onClick={() => { setText(''); run(''); }} aria-label="清除搜索"><X size={14} /></button>
        ) : (
          <span className="search-kbd"><kbd className="kbd">/</kbd></span>
        )}
        {focused && !text && (
          <div className="search-help">
            <span>筛选条件：</span>
            {SEARCH_HELP.map((h) => (
              <button key={h} className="search-op no-drag" onMouseDown={(e) => { e.preventDefault(); setText(h); }}>{h}</button>
            ))}
          </div>
        )}
      </div>
      <div className="topbar-spacer" />
      {!s.online && <span className="offline-pill"><WifiOff size={13} /> 离线</span>}
      <button className="palette-btn no-drag" onClick={() => s.openModal({ type: 'palette' })} data-tip="命令面板">
        <span>命令</span> <kbd className="kbd">Ctrl</kbd><kbd className="kbd">K</kbd>
      </button>
      <div className="titlebar-controls-space" />
    </div>
  );
}

function Resizer() {
  const s = useApp();
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={cx('resizer', drag && 'is-dragging')}
      onMouseDown={(e) => {
        e.preventDefault();
        setDrag(true);
        const startX = e.clientX;
        const start = s.settings?.listWidth || 400;
        let w = start;
        const content = document.querySelector('.content') as HTMLElement;
        const move = (ev: MouseEvent) => {
          w = Math.max(300, Math.min(680, start + ev.clientX - startX));
          content.style.setProperty('--list-w', `${w}px`);
        };
        const up = () => {
          setDrag(false);
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
          void s.updateSettings({ listWidth: w });
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
      onDoubleClick={() => void s.updateSettings({ listWidth: 400 })}
      role="separator"
      aria-orientation="vertical"
    />
  );
}

function Splash() {
  return (
    <div className="splash">
      <LogoMark size={56} />
    </div>
  );
}

export function App() {
  const booted = useApp((s) => s.booted);
  const onboarding = useApp((s) => s.onboarding);
  const listWidth = useApp((s) => s.settings?.listWidth || 400);
  const collapsed = useApp((s) => !!s.settings?.sidebarCollapsed);
  const searchRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useApp.getState().boot().catch((e) => setError(String(e?.message || e)));
  }, []);
  useShortcuts(() => { searchRef.current?.focus(); searchRef.current?.select(); });

  if (error) return <div className="fatal"><h2>鸿雁邮箱启动失败</h2><pre>{error}</pre></div>;
  if (!booted) return <Splash />;
  if (onboarding) {
    return (
      <>
        <Welcome />
        <ModalHost />
        <Toasts />
        <TooltipHost />
      </>
    );
  }
  return (
    <div className={cx('app', collapsed && 'sidebar-collapsed')}>
      <Sidebar />
      <main className="main">
        <TopBar searchRef={searchRef} />
        <div className="content" style={{ ['--list-w' as any]: `${listWidth}px` }}>
          <MessageList />
          <Resizer />
          <Reader />
        </div>
      </main>
      <Composers />
      <ModalHost />
      <Toasts />
      <ContextMenuHost />
      <TooltipHost />
    </div>
  );
}
