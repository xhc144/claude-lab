// Panel controls: sections, sliders, toggles, segmented buttons, expression fields, readouts.

import { h, icon } from './dom.js';
import { ICONS } from './icons.js';
import { fmt } from './format.js';

export function section(title, children, { aside = null, id = null } = {}) {
  return h('section', { class: 'section', id },
    title ? h('h2', { class: 'section-title' }, title, aside ? h('span', { class: 'aside' }, aside) : null) : null,
    children);
}

export function slider({ label, min, max, step = 0.01, value, format = (v) => fmt(v, 3), onInput, id, title }) {
  const valueEl = h('span', { class: 'value' });
  const input = h('input', { type: 'range', min, max, step, value, id, 'aria-label': typeof label === 'string' ? label : title });
  const paint = () => {
    const lo = +input.min, hi = +input.max;
    input.style.setProperty('--pct', `${((+input.value - lo) / (hi - lo || 1)) * 100}%`);
    valueEl.textContent = format(+input.value);
  };
  input.addEventListener('input', () => { paint(); onInput?.(+input.value); });
  const labelEl = h('span', { class: 'label', html: typeof label === 'string' ? label : '' });
  if (typeof label !== 'string' && label) labelEl.append(label);
  const el = h('div', { class: 'slider' }, h('div', { class: 'field-row' }, labelEl, valueEl), input);
  paint();
  return {
    el,
    input,
    get value() { return +input.value; },
    set(v, notify = false) {
      input.value = v;
      paint();
      if (notify) onInput?.(+input.value);
    },
    setRange(lo, hi, st = input.step) {
      input.min = lo;
      input.max = hi;
      input.step = st;
      paint();
    },
    setLabel(html) { labelEl.innerHTML = html; },
  };
}

export function toggle({ label, value = false, onChange, swatch = null, id }) {
  const input = h('input', { type: 'checkbox', checked: value, id });
  input.addEventListener('change', () => onChange?.(input.checked));
  const el = h('label', { class: 'toggle' },
    input,
    h('span', { class: 'switch' }),
    swatch ? h('span', { class: 'swatch', style: { background: swatch } }) : null,
    h('span', { class: 'label', html: label }));
  return {
    el,
    input,
    get value() { return input.checked; },
    set(v) { input.checked = v; },
  };
}

export function segmented({ options, value, onChange, id }) {
  const el = h('div', { class: 'segmented', role: 'tablist', id });
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', role: 'tab', 'data-value': o.value, title: o.title || null, html: o.label });
    b.addEventListener('click', () => { set(o.value); onChange?.(o.value); });
    el.append(b);
    return b;
  });
  function set(v) {
    buttons.forEach((b) => {
      const on = b.dataset.value === String(v);
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    });
  }
  set(value);
  return { el, set };
}

export function selectBox({ options, value, onChange, id }) {
  const el = h('select', { class: 'select', id },
    options.map((o) => h('option', { value: o.value }, o.label)));
  el.value = value;
  el.addEventListener('change', () => onChange?.(el.value));
  return { el, set(v) { el.value = v; } };
}

export function button({ label, iconName, onClick, variant = '', title, id, small = false }) {
  const el = h('button', { type: 'button', class: `btn ${variant} ${small ? 'small' : ''}`.trim(), title: title || null, id },
    iconName ? icon(ICONS[iconName]) : null, label ? h('span', null, label) : null);
  el.addEventListener('click', (e) => onClick?.(e));
  return el;
}

export function iconButton({ iconName, title, onClick, id, cls = '' }) {
  const el = h('button', { type: 'button', class: `icon-btn ${cls}`.trim(), title, 'aria-label': title, id }, icon(ICONS[iconName]));
  el.addEventListener('click', (e) => onClick?.(e));
  return el;
}

/** Chip group for presets. */
export function chips({ items, value = null, onPick, id }) {
  const el = h('div', { class: 'chips', id });
  const map = new Map();
  for (const it of items) {
    const b = h('button', { type: 'button', class: 'chip', title: it.title || null, 'data-id': it.id, html: it.label });
    b.addEventListener('click', () => { set(it.id); onPick?.(it.id, it); });
    map.set(it.id, b);
    el.append(b);
  }
  function set(v) { for (const [k, b] of map) b.classList.toggle('on', k === v); }
  set(value);
  return { el, set };
}

/**
 * Text field that compiles on every keystroke. `compile(src)` returns a value or throws an error
 * with optional {pos, len}; on success `onValid(value, src)` is called.
 */
export function exprField({ prefix = null, value = '', placeholder = '', compile, onValid, id, label = null }) {
  const input = h('input', { class: 'text-input mono', type: 'text', value, placeholder, spellcheck: 'false', autocomplete: 'off', id, 'aria-label': label || prefix || 'expression' });
  const err = h('div', { class: 'expr-error', role: 'status' });
  const el = h('div', { class: 'field expr-field' },
    label ? h('span', { class: 'label', html: label }) : null,
    h('div', { class: 'expr-wrap' }, prefix ? h('span', { class: 'prefix', html: prefix }) : null, input),
    err);
  let lastGood = null;
  function check(notify = true) {
    const src = input.value;
    try {
      const result = compile(src);
      el.classList.remove('invalid');
      err.textContent = '';
      lastGood = src;
      if (notify) onValid?.(result, src);
      return true;
    } catch (e) {
      el.classList.add('invalid');
      err.textContent = '';
      err.append(h('span', null, e.message || String(e)));
      if (Number.isInteger(e.pos) && src.length < 60) {
        const caret = `${src}\n${' '.repeat(e.pos)}${'^'.repeat(Math.max(1, e.len || 1))}`;
        err.append(h('span', { class: 'caret' }, caret));
      }
      return false;
    }
  }
  input.addEventListener('input', () => check());
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lastGood != null) { input.value = lastGood; check(); } e.stopPropagation(); });
  return {
    el,
    input,
    get value() { return input.value; },
    set(v, notify = true) { input.value = v; return check(notify); },
    check,
  };
}

/** Definition-list readout: rows = [[key, label], …]; set(key, text, cls). */
export function readout(rows, { id } = {}) {
  const el = h('dl', { class: 'readout', id });
  const cells = new Map();
  for (const [key, label] of rows) {
    const dd = h('dd', { 'data-key': key }, '—');
    el.append(h('dt', { html: label }), dd);
    cells.set(key, dd);
  }
  return {
    el,
    set(key, text, cls = '') {
      const dd = cells.get(key);
      if (!dd) return;
      if (dd.textContent !== text) dd.textContent = text;
      dd.className = cls;
    },
    setHTML(key, html) {
      const dd = cells.get(key);
      if (dd && dd.innerHTML !== html) dd.innerHTML = html;
    },
  };
}
