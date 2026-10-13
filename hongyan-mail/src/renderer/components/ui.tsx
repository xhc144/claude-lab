import React, { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, X } from 'lucide-react';
import { avatarColors, initials } from '../lib/avatar';
import { useApp } from '../store';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ------------------------------------------------------------------ buttons

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
  size?: 's' | 'm' | 'l';
  icon?: ReactNode;
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'secondary', size = 'm', icon, loading, children, className, disabled, ...rest }, ref
) {
  return (
    <button ref={ref} className={cx('btn', `btn-${variant}`, `btn-${size}`, loading && 'is-loading', className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner size={14} /> : icon}
      {children != null && <span className="btn-label">{children}</span>}
    </button>
  );
});

type IconBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tip?: string; kbd?: string; active?: boolean; size?: 's' | 'm' | 'l' };

export const IconButton = React.forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton(
  { tip, kbd, active, size = 'm', className, children, ...rest }, ref
) {
  return (
    <button ref={ref} className={cx('icon-btn', `icon-btn-${size}`, active && 'is-active', className)} aria-label={tip} data-tip={tip ? (kbd ? `${tip}  ${kbd}` : tip) : undefined} {...rest}>
      {children}
    </button>
  );
});

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={cx('switch', checked && 'is-on')} onClick={() => onChange(!checked)}>
      <span className="switch-thumb" />
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, size = 'm' }: { value: T; options: Array<{ value: T; label: ReactNode; title?: string }>; onChange: (v: T) => void; size?: 's' | 'm' }) {
  const uid = React.useId();
  return (
    <div className={cx('segmented', `segmented-${size}`)} role="tablist">
      {options.map((o) => (
        <button key={String(o.value)} role="tab" aria-selected={o.value === value} title={o.title} className={cx('segmented-item', o.value === value && 'is-active')} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={`seg-${uid}`} className="segmented-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="segmented-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, address, size = 36, ring }: { name: string; address: string; size?: number; ring?: string }) {
  const dark = useApp((s) => s.dark);
  const { bg, fg } = avatarColors(address || name, dark);
  const text = initials(name, address);
  return (
    <span className="avatar" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * (text.length > 1 ? 0.36 : 0.44), outline: ring ? `1.5px solid ${ring}` : undefined, outlineOffset: ring ? 2 : undefined }} aria-hidden>
      {text}
    </span>
  );
}

export function Field({ label, hint, error, children, inline }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; inline?: boolean }) {
  return (
    <label className={cx('field', inline && 'field-inline', !!error && 'has-error')}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

// ------------------------------------------------------------------ menus

export interface MenuItem {
  label?: ReactNode;
  icon?: ReactNode;
  kbd?: string;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  submenu?: MenuItem[];
  separator?: boolean;
  heading?: string;
}

function MenuList({ items, onClose, style, className }: { items: MenuItem[]; onClose: () => void; style?: React.CSSProperties; className?: string }) {
  const [sub, setSub] = useState<{ index: number; rect: DOMRect } | null>(null);
  const [focus, setFocus] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const actionable = items.map((it, i) => (!it.separator && !it.heading && !it.disabled ? i : -1)).filter((i) => i >= 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const pos = actionable.indexOf(focus);
        const next = e.key === 'ArrowDown' ? actionable[(pos + 1) % actionable.length] : actionable[(pos - 1 + actionable.length) % actionable.length];
        setFocus(next ?? -1);
      } else if (e.key === 'Enter' && focus >= 0) {
        e.preventDefault();
        const it = items[focus];
        if (it.onSelect) { it.onSelect(); onClose(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <motion.div ref={ref} className={cx('menu', className)} style={style} role="menu" initial={{ opacity: 0, scale: 0.97, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.12 }}>
      {items.map((it, i) => {
        if (it.separator) return <div key={i} className="menu-sep" />;
        if (it.heading) return <div key={i} className="menu-heading">{it.heading}</div>;
        return (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            className={cx('menu-item', it.danger && 'is-danger', focus === i && 'is-focus', sub?.index === i && 'is-open')}
            onMouseEnter={(e) => {
              setFocus(i);
              if (it.submenu) setSub({ index: i, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() });
              else setSub(null);
            }}
            onClick={() => {
              if (it.submenu) return;
              it.onSelect?.();
              onClose();
            }}
          >
            <span className="menu-icon">{it.checked ? <Check size={15} /> : it.icon}</span>
            <span className="menu-label">{it.label}</span>
            {it.kbd && <span className="menu-kbd">{it.kbd}</span>}
            {it.submenu && <ChevronRight size={14} className="menu-chevron" />}
          </button>
        );
      })}
      {sub && items[sub.index]?.submenu && (
        <FloatingMenu items={items[sub.index].submenu!} anchor={{ x: sub.rect.right - 4, y: sub.rect.top - 6 }} onClose={onClose} sub />
      )}
    </motion.div>
  );
}

function FloatingMenu({ items, anchor, onClose, sub, align = 'start' }: { items: MenuItem[]; anchor: { x: number; y: number; w?: number; h?: number }; onClose: () => void; sub?: boolean; align?: 'start' | 'end' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight?: number }>({ left: anchor.x, top: anchor.y });
  useLayoutEffect(() => {
    const el = ref.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = align === 'end' && anchor.w !== undefined ? anchor.x + anchor.w - r.width : anchor.x;
    let top = anchor.y + (anchor.h ?? 0);
    if (left + r.width > window.innerWidth - 8) left = sub ? anchor.x - r.width - (anchor.w ?? 0) - 4 : window.innerWidth - r.width - 8;
    if (left < 8) left = 8;
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, (anchor.h ? anchor.y - r.height - 4 : window.innerHeight - r.height - 8));
    setPos({ left, top, maxHeight: window.innerHeight - 16 });
  }, [anchor.x, anchor.y]);
  return (
    <div ref={ref} className="menu-anchor" style={{ left: pos.left, top: pos.top }}>
      <MenuList items={items} onClose={onClose} style={{ maxHeight: pos.maxHeight }} />
    </div>
  );
}

export function Dropdown({ trigger, items, align = 'start' }: { trigger: (props: { onClick: (e: React.MouseEvent) => void; 'aria-expanded': boolean }) => ReactNode; items: MenuItem[] | (() => MenuItem[]); align?: 'start' | 'end' }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const close = () => setAnchor(null);
  useDismiss(!!anchor, close);
  return (
    <>
      {trigger({ onClick: (e) => setAnchor(anchor ? null : (e.currentTarget as HTMLElement).getBoundingClientRect()), 'aria-expanded': !!anchor })}
      {createPortal(
        <AnimatePresence>
          {anchor && (
            <div className="menu-layer" onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close(); }}>
              <div onMouseDown={(e) => e.stopPropagation()}>
                <FloatingMenu items={typeof items === 'function' ? items() : items} anchor={{ x: anchor.left, y: anchor.top + 4, w: anchor.width, h: anchor.height }} onClose={close} align={align} />
              </div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// Global context menu (one at a time)
let openContext: ((items: MenuItem[], x: number, y: number) => void) | null = null;
export function showContextMenu(e: React.MouseEvent | MouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  openContext?.(items, e.clientX, e.clientY);
}

export function ContextMenuHost() {
  const [state, setState] = useState<{ items: MenuItem[]; x: number; y: number } | null>(null);
  useEffect(() => {
    openContext = (items, x, y) => setState({ items, x, y });
    return () => { openContext = null; };
  }, []);
  const close = () => setState(null);
  useDismiss(!!state, close);
  return createPortal(
    <AnimatePresence>
      {state && (
        <div className="menu-layer" onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close(); }}>
          <div onMouseDown={(e) => e.stopPropagation()}>
            <FloatingMenu items={state.items} anchor={{ x: state.x, y: state.y }} onClose={close} />
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function useDismiss(active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const onBlur = () => close();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
    };
  }, [active]);
}

// ------------------------------------------------------------------ modal

export function Modal({ open, onClose, children, width = 560, className, title, subtitle, closable = true, footer }: {
  open: boolean; onClose: () => void; children: ReactNode; width?: number; className?: string; title?: ReactNode; subtitle?: ReactNode; closable?: boolean; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open || !closable) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closable, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="modal-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} onMouseDown={(e) => { if (e.target === e.currentTarget && closable) onClose(); }}>
          <motion.div
            className={cx('modal', className)}
            style={{ width }}
            role="dialog"
            aria-modal
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            {(title || closable) && (
              <div className="modal-head">
                <div>
                  {title && <h2 className="modal-title">{title}</h2>}
                  {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                </div>
                {closable && <IconButton tip="关闭" onClick={onClose} className="modal-close"><X size={18} /></IconButton>}
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ------------------------------------------------------------------ brand

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg className={cx('logo-mark', className)} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`lg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ef7350" />
          <stop offset="0.55" stopColor="#d2412a" />
          <stop offset="1" stopColor="#a92d1b" />
        </linearGradient>
        <linearGradient id={`hl${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill={`url(#lg${id})`} />
      <rect x="2" y="2" width="60" height="60" rx="17" fill={`url(#hl${id})`} />
      <path d={GOOSE_PATH} fill="#fff" transform="translate(-2.6 4.4)" />
    </svg>
  );
}

/** A wild goose in flight — the messenger bird of 鸿雁传书. */
export const GOOSE_PATH =
  'M8 42 C16 39.5 24 37 30 34.5 C27 26 21 18 11 11.5 C24 13.5 34 21 38.5 31 C42.5 27.5 46.5 23.5 50.5 20.2 C52.6 18.4 55.4 18.6 56.6 20.4 L61.5 22 L56.3 23.2 C52.8 25.4 49.4 29.6 45.8 33.6 C39.5 40 29 43.2 18.5 43.2 C14.6 43.2 11 42.8 8 42 Z';

export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wordmark-cn">鸿雁</span>
      <span className="wordmark-en">Hongyan</span>
    </span>
  );
}

// ------------------------------------------------------------------ tooltips

/** One global tooltip for every element carrying data-tip (not clipped by scroll containers). */
export function TooltipHost() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; side: 'bottom' | 'right' | 'top' } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: Element | null = null;
    const hide = () => { if (timer) clearTimeout(timer); timer = null; current = null; setTip(null); };
    const over = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]');
      if (el === current) return;
      hide();
      if (!el) return;
      current = el;
      timer = setTimeout(() => {
        const text = el.getAttribute('data-tip');
        if (!text || !document.body.contains(el)) return;
        const r = el.getBoundingClientRect();
        const side = (el.getAttribute('data-tip-side') as 'right' | 'top') || (r.bottom + 40 > window.innerHeight ? 'top' : 'bottom');
        if (side === 'right') setTip({ text, x: r.right + 8, y: r.top + r.height / 2, side });
        else if (side === 'top') setTip({ text, x: r.left + r.width / 2, y: r.top - 8, side });
        else setTip({ text, x: r.left + r.width / 2, y: r.bottom + 8, side: 'bottom' });
      }, 420);
    };
    window.addEventListener('mouseover', over);
    window.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('keydown', hide, true);
    return () => {
      window.removeEventListener('mouseover', over);
      window.removeEventListener('mousedown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('keydown', hide, true);
    };
  }, []);
  if (!tip) return null;
  const [label, ...keys] = tip.text.split('  ');
  return createPortal(
    <div className={cx('tooltip', `tooltip-${tip.side}`)} style={{ left: tip.x, top: tip.y }}>
      {label}
      {keys.length > 0 && <span className="tooltip-kbd">{keys.join(' ')}</span>}
    </div>,
    document.body
  );
}
