// Tiny DOM helpers. Text is always assigned via textContent; HTML only enters through md.js (sanitized).

export function h(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (val === undefined || val === null) continue;
        if (prop.startsWith('--')) el.style.setProperty(prop, String(val));
        else el.style[prop] = val;
      }
    }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; // only ever called with sanitized output
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

let toastWrap;
export function toast(msg, kind = '') {
  if (!toastWrap) { toastWrap = h('div.toast-wrap'); document.body.append(toastWrap); }
  const t = h(`div.toast${kind ? '.' + kind : ''}`, {}, msg);
  toastWrap.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, kind === 'err' ? 6000 : 3200);
}

/** Modal dialog. Returns { el, close }. */
export function modal(title, body, { wide = false, foot = null, onClose } = {}) {
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h(`div.panel.hud.modal${wide ? '.wide' : ''}`, { role: 'dialog', 'aria-modal': 'true' },
    h('div.panel-head', {}, h('span.zh', {}, title), h('span.grow'), h('button.btn.ghost.sm.icon', { onclick: close, 'aria-label': '关闭' }, '✕')),
    h('div.panel-body', {}, body),
    foot ? h('div.modal-foot', {}, foot) : null);
  const overlay = h('div.overlay', { onmousedown: (e) => { if (e.target === overlay) close(); } }, box);
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  return { el: box, close };
}

export function drawer(title, body, { onClose } = {}) {
  document.querySelector('.drawer')?.__close?.();
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const el = h('div.panel.drawer', {},
    h('div.panel-head', {}, title instanceof Node ? title : h('span.zh', {}, title), h('span.grow'), h('button.btn.ghost.sm.icon', { onclick: close, 'aria-label': '关闭' }, '✕')),
    h('div.panel-body', {}, body));
  el.__close = close;
  document.body.append(el);
  document.addEventListener('keydown', onKey);
  return { el, close };
}

export function confirmBox(title, text, { danger = false, ok = '确认' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(title, h('p', {}, text), {
      onClose: () => { if (!done) resolve(false); },
      foot: [
        h('button.btn', { onclick: () => m.close() }, '取消'),
        h(`button.btn${danger ? '.danger' : '.primary'}`, { onclick: () => { done = true; m.close(); resolve(true); } }, ok),
      ],
    });
  });
}

export function rafThrottle(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(...args); });
  };
}
