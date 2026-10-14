import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './icons.tsx';
import { scoreColor } from '../lib/format.ts';
import { useApp } from '../lib/store.tsx';

export function ScoreRing({ score, size = 132, label = '总分', stroke = 11 }: { score: number; size?: number; label?: string; stroke?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(score), 30);
    return () => clearTimeout(t);
  }, [score]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--surface-3)' }} strokeWidth={stroke} />
        <circle className="prog" cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: scoreColor(score) }} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, shown)) / 100)} />
      </svg>
      <div className="val">
        <b style={{ color: scoreColor(score) }}>{score}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function Metric({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value ?? 0), 30);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="metric" title={hint}>
      <span className="muted">{label}</span>
      <div className="bar"><i style={{ width: `${w}%`, background: value === null ? 'transparent' : scoreColor(value) }} /></div>
      <b style={{ color: value === null ? 'var(--text-3)' : scoreColor(value) }}>{value === null ? '—' : value}</b>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost icon sm right" onClick={onClose} aria-label="关闭"><IconClose /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ title, onClose, children, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="drawer">
      <div className="drawer-head">
        <div className="grow">{title}</div>
        {actions}
        <button className="btn ghost icon sm" onClick={onClose} aria-label="关闭"><IconClose /></button>
      </div>
      <div className="drawer-body">{children}</div>
    </div>,
    document.body,
  );
}

export function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" className={`switch ${on ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!on)} aria-pressed={on} />;
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
      ))}
    </div>
  );
}

export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <div className="empty">{icon}<div>{children}</div></div>;
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: Array<{ id: T; label: ReactNode; badge?: ReactNode }>; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={t.id === value ? 'on' : ''} onClick={() => onChange(t.id)}>{t.label}{t.badge !== undefined && t.badge !== null && <span className="badge">{t.badge}</span>}</button>
      ))}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}
