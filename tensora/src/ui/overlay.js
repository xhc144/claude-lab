// Layers that float above the console: toasts, modal dialogs, side drawers / bottom sheets,
// confirmation dialogs and anchored menus. All of them close on Escape and restore focus.

import { icon } from './icons.js';
import { esc } from '../core/util.js';

const KIND_ICON = { good: 'ok', warn: 'alert', crit: 'fail', info: 'info' };

// ---- toasts -------------------------------------------------------------------------------------

let toastHost = null;
export function toast({ kind = 'info', title, body = '', action = null, timeout = 4200 } = {}) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toasts';
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  el.className = `toast t-${kind}`;
  el.innerHTML = `<span class="t-ic">${icon(KIND_ICON[kind] || 'info')}</span>
    <div class="t-body"><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}</div>
    ${action ? `<button class="t-act" type="button">${esc(action.label)}</button>` : ''}
    <button class="t-x" type="button" aria-label="关闭">${icon('x')}</button>
    <i class="t-bar" style="animation-duration:${timeout}ms"></i>`;
  toastHost.prepend(el);
  while (toastHost.children.length > 4) toastHost.lastElementChild.remove();
  let left = timeout, started = performance.now(), timer = 0;
  const close = () => {
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  };
  const arm = () => { started = performance.now(); timer = setTimeout(close, left); };
  el.addEventListener('pointerenter', () => { clearTimeout(timer); left -= performance.now() - started; el.classList.add('hold'); });
  el.addEventListener('pointerleave', () => { el.classList.remove('hold'); arm(); });
  el.querySelector('.t-x').addEventListener('click', close);
  el.querySelector('.t-act')?.addEventListener('click', () => { action.fn(); close(); });
  arm();
  return close;
}

// ---- modal / drawer -----------------------------------------------------------------------------

const stack = [];

function trapKeys(e) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') { e.stopPropagation(); top.close(); return; }
  if (e.key !== 'Tab') return;
  const f = [...top.panel.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
document.addEventListener('keydown', trapKeys, true);

/**
 * openLayer({ kind: 'modal'|'drawer', title, eyebrow, body, foot, wide, onMount(panel, close), onClose })
 */
export function openLayer(opts) {
  const { kind = 'modal', title = '', eyebrow = '', body = '', foot = '', wide = false, onMount, onClose, cls = '' } = opts;
  const prevFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = `layer layer-${kind}`;
  root.innerHTML = `<div class="scrim"></div>
    <section class="${kind}${wide ? ' wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="lh">
        <div class="lh-t">${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}<h2>${title}</h2></div>
        <button class="icon-btn lx" type="button" aria-label="关闭">${icon('x')}</button>
      </header>
      <div class="lb">${body}</div>
      ${foot ? `<footer class="lf">${foot}</footer>` : ''}
    </section>`;
  document.body.appendChild(root);
  document.documentElement.classList.add('layer-open');
  const panel = root.querySelector(`.${kind}`);
  let closed = false;
  const cleanups = [];
  const close = (result) => {
    if (closed) return;
    closed = true;
    root.classList.add('out');
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) document.documentElement.classList.remove('layer-open');
    cleanups.forEach((fn) => fn());
    onClose?.(result);
    setTimeout(() => root.remove(), 240);
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
  };
  const entry = { panel, close };
  stack.push(entry);
  root.querySelector('.scrim').addEventListener('click', () => close());
  root.querySelector('.lx').addEventListener('click', () => close());
  // swipe-down to dismiss bottom sheets on touch screens
  if (kind === 'drawer') {
    let y0 = null;
    panel.querySelector('.lh').addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') y0 = e.clientY; });
    panel.addEventListener('pointerup', (e) => { if (y0 != null && e.clientY - y0 > 80) close(); y0 = null; });
  }
  requestAnimationFrame(() => root.classList.add('in'));
  const ret = onMount?.(panel, close);
  if (typeof ret === 'function') cleanups.push(ret);
  setTimeout(() => {
    const target = panel.querySelector('[autofocus]') || panel.querySelector('input, select, textarea') || panel.querySelector('.lx');
    target?.focus({ preventScroll: true });
  }, 60);
  return { panel, close };
}

/** Close every open modal / drawer (used when the route changes underneath them). */
export function closeAllLayers() {
  [...stack].reverse().forEach((l) => l.close());
  closeMenu();
}

/** Promise<boolean>. With requireText the confirm button unlocks only after the text is typed. */
export function confirmDialog({ title, body, confirmLabel = '确认', danger = false, requireText = '' }) {
  return new Promise((resolve) => {
    let ok = false;
    openLayer({
      kind: 'modal', title, cls: 'confirm',
      body: `<p class="muted">${body}</p>${requireText ? `<label class="field-l" for="confirm-text">输入 <code>${esc(requireText)}</code> 以确认</label><input id="confirm-text" class="input" autocomplete="off" spellcheck="false">` : ''}`,
      foot: `<button class="btn ghost" type="button" data-x>取消</button><button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-ok ${requireText ? 'disabled' : ''}>${esc(confirmLabel)}</button>`,
      onMount(panel, close) {
        const okBtn = panel.querySelector('[data-ok]');
        panel.querySelector('[data-x]').addEventListener('click', () => close());
        okBtn.addEventListener('click', () => { ok = true; close(); });
        const input = panel.querySelector('#confirm-text');
        input?.addEventListener('input', () => { okBtn.disabled = input.value.trim() !== requireText; });
        input?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !okBtn.disabled) okBtn.click(); });
      },
      onClose: () => resolve(ok),
    });
  });
}

// ---- anchored menu ------------------------------------------------------------------------------

let openMenuEl = null;
export function closeMenu() { openMenuEl?.remove(); openMenuEl = null; }

/** openMenu(anchor, [{ label, icon, fn, danger, sep, checked }]) */
export function openMenu(anchor, items, { align = 'end' } = {}) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => it.sep ? '<hr>' : `<button type="button" role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span>${it.checked ? icon('check', 'mk') : ''}${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const mr = m.getBoundingClientRect();
  let left = align === 'end' ? r.right - mr.width : r.left;
  left = Math.max(8, Math.min(left, innerWidth - mr.width - 8));
  let top = r.bottom + 6;
  if (top + mr.height > innerHeight - 8) top = r.top - mr.height - 6;
  m.style.left = `${left}px`;
  m.style.top = `${Math.max(8, top)}px`;
  openMenuEl = m;
  m.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const it = items[+b.dataset.i];
    closeMenu();
    it.fn?.();
  });
  m.querySelector('button')?.focus({ preventScroll: true });
  m.addEventListener('keydown', (e) => {
    const btns = [...m.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    if (e.key === 'Escape') { closeMenu(); anchor.focus(); }
  });
  setTimeout(() => {
    const off = (e) => { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener('pointerdown', off, true); } };
    document.addEventListener('pointerdown', off, true);
  });
  return m;
}
