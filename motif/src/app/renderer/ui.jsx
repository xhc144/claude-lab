// Small UI kit: controls, modals, menus, popovers and toasts.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';

// ───────────────────────────── tiny global stores ─────────────────────────────
function createSignal(initial) {
  let v = initial;
  const subs = new Set();
  return {
    get: () => v,
    set: (n) => { v = typeof n === 'function' ? n(v) : n; subs.forEach((f) => f()); },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  };
}
export function useSignal(sig) { return useSyncExternalStore(sig.subscribe, sig.get); }

// ───────────────────────────── toasts ─────────────────────────────
const toastSig = createSignal([]);
let toastSeq = 0;
export function toast(message, o = {}) {
  const id = ++toastSeq;
  const t = { id, message, kind: o.kind || 'info', hint: o.hint, action: o.action };
  toastSig.set((l) => [...l.slice(-3), t]);
  setTimeout(() => toastSig.set((l) => l.filter((x) => x.id !== id)), o.duration || (t.kind === 'error' ? 7000 : 3200));
  return id;
}
toast.error = (e, o = {}) => toast(e?.message || String(e), { kind: 'error', hint: e?.hint, ...o });
toast.ok = (m, o = {}) => toast(m, { kind: 'ok', ...o });

export function Toasts() {
  const list = useSignal(toastSig);
  return createPortal(
    <div className="toasts">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="ti" style={{ marginTop: 1 }}><Icon name={t.kind === 'error' ? 'circle-alert' : t.kind === 'ok' ? 'circle-check' : 'info'} /></span>
          <div className="grow">
            <div>{t.message}</div>
            {t.hint ? <div className="hint">{t.hint}</div> : null}
          </div>
          {t.action ? <button className="btn sm" onClick={() => { t.action.run(); toastSig.set((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.label}</button> : null}
        </div>
      ))}
    </div>, document.body);
}

// ───────────────────────────── context menus ─────────────────────────────
const menuSig = createSignal(null);
/** openMenu(event | {x,y}, items[]) — item: {label, icon, kbd, danger, onClick, disabled} | '-' | {label, header:true} */
export function openMenu(e, items) {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  let x = e.clientX ?? e.x, y = e.clientY ?? e.y;
  if (e.currentTarget?.getBoundingClientRect && e.type === 'click') { const r = e.currentTarget.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
  menuSig.set({ x, y, items: items.filter(Boolean) });
}
export function Menus() {
  const m = useSignal(menuSig);
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!m || !ref.current) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(m.x, innerWidth - r.width - 8), y: m.y + r.height > innerHeight - 8 ? Math.max(8, m.y - r.height) : m.y });
  }, [m]);
  useEffect(() => {
    if (!m) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) menuSig.set(null); };
    const esc = (e) => { if (e.key === 'Escape') menuSig.set(null); };
    setTimeout(() => { addEventListener('mousedown', close); addEventListener('contextmenu', close); }, 0);
    addEventListener('keydown', esc);
    addEventListener('blur', () => menuSig.set(null), { once: true });
    return () => { removeEventListener('mousedown', close); removeEventListener('contextmenu', close); removeEventListener('keydown', esc); };
  }, [m]);
  if (!m) return null;
  return createPortal(
    <div ref={ref} className="menu" style={{ left: pos?.x ?? m.x, top: pos?.y ?? m.y, visibility: pos ? 'visible' : 'hidden' }}>
      {m.items.map((it, i) => (it === '-' ? <div key={i} className="sep" />
        : it.header ? <div key={i} className="label">{it.label}</div>
          : (
            <button key={i} className={it.danger ? 'danger' : ''} disabled={it.disabled} style={it.disabled ? { opacity: 0.4 } : null} onClick={() => { menuSig.set(null); it.onClick?.(); }}>
              {it.icon ? <Icon name={it.icon} size={15} /> : <span style={{ width: 15 }} />}
              <span>{it.label}</span>
              {it.kbd ? <span className="kbd">{it.kbd}</span> : null}
            </button>
          )))}
    </div>, document.body);
}

// ───────────────────────────── modal ─────────────────────────────
export function Modal({ title, sub, icon, onClose, children, footer, width = 560, bodyStyle, closeOnBackdrop = true }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    addEventListener('keydown', k, true);
    return () => removeEventListener('keydown', k, true);
  }, [onClose]);
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        {title != null ? (
          <div className="modal-head">
            {icon ? <span style={{ color: 'var(--acc-hi)' }}><Icon name={icon} size={18} /></span> : null}
            <div className="grow">
              <h3>{title}</h3>
              {sub ? <div className="sub">{sub}</div> : null}
            </div>
            {onClose ? <button className="ibtn" onClick={onClose} title="关闭"><Icon name="x" /></button> : null}
          </div>
        ) : null}
        <div className="modal-body" style={bodyStyle}>{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>, document.body);
}

/** Promise-based confirm / prompt dialogs. */
const dialogSig = createSignal(null);
export function confirmDialog({ title, message, ok = '确定', danger = false }) {
  return new Promise((resolve) => dialogSig.set({ kind: 'confirm', title, message, ok, danger, resolve }));
}
export function promptDialog({ title, label, value = '', ok = '确定', placeholder }) {
  return new Promise((resolve) => dialogSig.set({ kind: 'prompt', title, label, value, ok, placeholder, resolve }));
}
export function Dialogs() {
  const d = useSignal(dialogSig);
  const [v, setV] = useState('');
  useEffect(() => { if (d?.kind === 'prompt') setV(d.value || ''); }, [d]);
  if (!d) return null;
  const done = (r) => { dialogSig.set(null); d.resolve(r); };
  return (
    <Modal title={d.title} onClose={() => done(d.kind === 'prompt' ? null : false)} width={420}
      footer={<>
        <button className="btn" onClick={() => done(d.kind === 'prompt' ? null : false)}>取消</button>
        <button className={`btn ${d.danger ? 'danger' : 'primary'}`} onClick={() => done(d.kind === 'prompt' ? v : true)}>{d.ok}</button>
      </>}>
      {d.message ? <p style={{ margin: '0 0 6px', color: 'var(--fg1)' }}>{d.message}</p> : null}
      {d.kind === 'prompt' ? (
        <div className="col" style={{ gap: 6 }}>
          {d.label ? <span className="muted">{d.label}</span> : null}
          <input autoFocus className="input" value={v} placeholder={d.placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') done(v); }} />
        </div>
      ) : null}
    </Modal>
  );
}

// ───────────────────────────── popover anchored to an element ─────────────────────────────
export function Popover({ anchor, onClose, children, placement = 'bottom-start', offset = 6, style }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    const r = ref.current.getBoundingClientRect();
    let x = placement.endsWith('end') ? a.right - r.width : a.left;
    let y = placement.startsWith('top') ? a.top - r.height - offset : a.bottom + offset;
    if (placement.startsWith('left')) { x = a.left - r.width - offset; y = a.top; }
    if (placement.startsWith('right')) { x = a.right + offset; y = a.top; }
    if (y + r.height > innerHeight - 8) y = Math.max(8, a.top - r.height - offset);
    if (y < 8) y = 8;
    x = Math.max(8, Math.min(x, innerWidth - r.width - 8));
    setPos({ x, y });
  }, [anchor, placement, offset]);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target) && !(anchor?.contains && anchor.contains(e.target))) onClose?.(); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    const t = setTimeout(() => addEventListener('mousedown', close), 0);
    addEventListener('keydown', esc, true);
    return () => { clearTimeout(t); removeEventListener('mousedown', close); removeEventListener('keydown', esc, true); };
  }, [anchor, onClose]);
  return createPortal(<div ref={ref} className="popover" style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, ...style }}>{children}</div>, document.body);
}

// ───────────────────────────── controls ─────────────────────────────
export function Switch({ value, onChange, disabled }) {
  return <button type="button" className={`switch ${value ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!value)} aria-pressed={!!value} />;
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : String(o);
        return <button key={String(v)} type="button" className={value === v ? 'on' : ''} title={typeof o === 'object' ? o.title || l : l} onClick={() => onChange(v)}>{o.icon ? <Icon name={o.icon} size={14} /> : l}</button>;
      })}
    </div>
  );
}

export function Select({ value, options, onChange, placeholder, style }) {
  return (
    <select className="select" style={style} value={value ?? ''} onChange={(e) => { const o = options.find((x) => String(typeof x === 'object' ? x.value : x) === e.target.value); onChange(o == null ? e.target.value : typeof o === 'object' ? o.value : o); }}>
      {placeholder != null ? <option value="">{placeholder}</option> : null}
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        return <option key={String(v)} value={String(v)}>{typeof o === 'object' ? o.label : String(o)}</option>;
      })}
    </select>
  );
}

/** Text input that commits on blur/Enter but reports live changes (for instant canvas updates). */
export function TextInput({ value, onChange, onCommit, placeholder, mono, autoFocus, invalid, style, onKeyDown }) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value ?? ''); }, [value]);
  return (
    <input className={`input ${mono ? 'mono' : ''} ${invalid ? 'invalid' : ''}`} style={style} value={v} placeholder={placeholder} autoFocus={autoFocus} spellCheck={false}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; onCommit?.(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); onKeyDown?.(e); }}
      onChange={(e) => { setV(e.target.value); onChange?.(e.target.value); }} />
  );
}

export function TextArea({ value, onChange, onCommit, placeholder, mono, rows = 3, style, inputRef }) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  const ref = useRef(null);
  useEffect(() => { if (!focused.current) setV(value ?? ''); }, [value]);
  const fit = useCallback(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(320, el.scrollHeight + 2) + 'px'; }, []);
  useLayoutEffect(fit, [v, fit]);
  return (
    <textarea ref={(el) => { ref.current = el; if (inputRef) inputRef.current = el; }} className={`textarea ${mono ? 'mono' : ''}`} rows={rows} style={style} value={v} placeholder={placeholder} spellCheck={false}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; onCommit?.(v); }}
      onChange={(e) => { setV(e.target.value); onChange?.(e.target.value); }} />
  );
}

/** Numeric input with label-scrubbing (drag the handle left/right), arrow keys and units. */
export function NumberInput({ value, onChange, onCommit, min, max, step = 1, unit, placeholder, scrub = true, precision }) {
  const [v, setV] = useState(value ?? '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value ?? ''); }, [value]);
  const clamp = (n) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const round = (n) => (precision != null ? +n.toFixed(precision) : step < 1 ? +n.toFixed(String(step).split('.')[1]?.length || 2) : Math.round(n));
  const emit = (n, commit) => { const x = clamp(round(n)); setV(x); onChange?.(x); if (commit) onCommit?.(x); };
  const onScrub = (e) => {
    e.preventDefault();
    const x0 = e.clientX; const v0 = Number(v) || 0;
    let last = v0;
    const mv = (ev) => { const dx = ev.clientX - x0; last = clamp(round(v0 + dx * step * (ev.shiftKey ? 10 : 1) * 0.5)); setV(last); onChange?.(last); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); document.body.style.cursor = ''; onCommit?.(last); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
    document.body.style.cursor = 'ew-resize';
  };
  return (
    <div className="num">
      {scrub ? <span className="scrub" onMouseDown={onScrub} title="左右拖动调整"><Icon name="chevrons-left-right" size={11} /></span> : null}
      <input value={v} placeholder={placeholder}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; if (v === '' || v == null) { onCommit?.(null); return; } const n = Number(v); if (isFinite(n)) emit(n, true); else setV(value ?? ''); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); emit((Number(v) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1), true); }
        }}
        onChange={(e) => setV(e.target.value)} />
      {unit ? <span className="unit">{unit}</span> : null}
    </div>
  );
}

export function Field({ label, required, help, children, stacked, title }) {
  return (
    <div className={`field ${stacked ? 'stacked' : ''}`}>
      <label title={title || (typeof label === 'string' ? label : undefined)}>{label}{required ? <span className="req">*</span> : null}</label>
      <div style={{ minWidth: 0 }}>
        {children}
        {help ? <div className="help">{help}</div> : null}
      </div>
    </div>
  );
}

export function Group({ title, icon, children, open: initial = false, right }) {
  return (
    <details className="field-group" open={initial}>
      <summary>
        <span className="chev"><Icon name="chevron-right" size={14} /></span>
        {icon ? <Icon name={icon} size={14} /> : null}
        <span className="grow">{title}</span>
        {right}
      </summary>
      <div className="body">{children}</div>
    </details>
  );
}

export function Spinner({ size = 16 }) { return <span className="spinner" style={{ width: size, height: size }} />; }

export function Progress({ value, indeterminate }) {
  return <div className={`progress ${indeterminate ? 'indet' : ''}`}><div style={{ width: `${Math.round((value || 0) * 100)}%` }} /></div>;
}

export function CopyBox({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="codebox">
      {text}
      <button className="btn sm copy" onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}>
        <Icon name={ok ? 'check' : 'copy'} size={13} />{ok ? '已复制' : '复制'}
      </button>
    </div>
  );
}

export function useDebounced(fn, ms) {
  const t = useRef(null);
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => () => clearTimeout(t.current), []);
  return useCallback((...a) => { clearTimeout(t.current); t.current = setTimeout(() => f.current(...a), ms); }, [ms]);
}

export function useResizeObserver(ref, cb) {
  const f = useRef(cb);
  f.current = cb;
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => { const r = entries[0].contentRect; f.current(r); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
}

export { createSignal };
