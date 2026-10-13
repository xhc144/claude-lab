// Reusable markup builders for the console's building blocks, plus the few behaviours that go
// with them (segmented controls, spotlight hover, tabs). Builders return HTML strings.

import { icon } from './icons.js';
import { esc } from '../core/util.js';

export function pageHead({ eyebrow, title, sub = '', actions = '', id = '' }) {
  return `<header class="page-head rv"${id ? ` id="${id}"` : ''}>
    <div class="ph-text"><span class="eyebrow">${eyebrow}</span><h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>
    ${actions ? `<div class="ph-actions">${actions}</div>` : ''}
  </header>`;
}

/** panel shell: title row with optional meta + tools, then body. */
export function panel({ title = '', meta = '', tools = '', body = '', cls = '', id = '', span = '' }) {
  return `<section class="panel spot rv ${cls}"${id ? ` id="${id}"` : ''}${span ? ` style="--span:${span}"` : ''}>
    ${title || tools ? `<div class="p-head"><div class="p-title"><h2>${title}</h2>${meta ? `<span class="p-meta">${meta}</span>` : ''}</div>${tools ? `<div class="p-tools">${tools}</div>` : ''}</div>` : ''}
    ${body}
  </section>`;
}

export function seg(id, options, value, { small = false, label = '' } = {}) {
  return `<div class="seg${small ? ' sm' : ''}" id="${id}" role="radiogroup"${label ? ` aria-label="${esc(label)}"` : ''}>
    <i class="seg-ind" aria-hidden="true"></i>
    ${options.map((o) => `<button type="button" role="radio" data-value="${esc(o.value)}" aria-checked="${o.value === value}" class="${o.value === value ? 'on' : ''}">${o.icon ? icon(o.icon) : ''}${o.label ? `<span>${esc(o.label)}</span>` : ''}</button>`).join('')}
  </div>`;
}

function placeInd(el) {
  const on = el.querySelector('button.on');
  const ind = el.querySelector('.seg-ind');
  if (!on || !ind) return;
  ind.style.width = `${on.offsetWidth}px`;
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
}

export function bindSeg(root, id, onChange) {
  const el = root.querySelector(`#${id}`);
  if (!el) return;
  requestAnimationFrame(() => { placeInd(el); el.classList.add('ready'); });
  document.fonts?.ready.then(() => placeInd(el));
  const ro = new ResizeObserver(() => placeInd(el));
  ro.observe(el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-value]');
    if (!b || b.classList.contains('on')) return;
    el.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    placeInd(el);
    onChange(b.dataset.value);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const btns = [...el.querySelectorAll('button')];
    const i = btns.findIndex((b) => b.classList.contains('on'));
    const n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
    n.click();
    n.focus();
  });
}

export function stat({ label, value, unit = '', delta = '', good = true, up = good, sub = '', spark = '', id = '', icon: ic = '' }) {
  return `<div class="stat rv"${id ? ` id="${id}"` : ''}>
    <div class="st-top"><span class="st-l">${ic ? icon(ic) : ''}${label}</span>${delta ? `<span class="delta ${good ? 'up' : 'down'}">${icon(up ? 'up' : 'downRight')}${delta}</span>` : ''}</div>
    <div class="st-v"><b data-stat>${value}</b>${unit ? `<small>${unit}</small>` : ''}</div>
    ${sub ? `<div class="st-sub">${sub}</div>` : ''}
    ${spark ? `<div class="st-spark">${spark}</div>` : ''}
  </div>`;
}

const PILL_ICON = { good: 'ok', warn: 'alert', crit: 'fail', info: 'info', idle: 'pause', run: '', ion: '' };
export function pill(kind, text) {
  const ic = kind === 'run' ? '<i class="spin-dot"></i>' : PILL_ICON[kind] ? icon(PILL_ICON[kind]) : '';
  return `<span class="pill p-${kind}">${ic}${esc(text)}</span>`;
}

export const JOB_STATUS = {
  running: ['run', '运行中'],
  queued: ['idle', '排队中'],
  paused: ['warn', '已暂停'],
  completed: ['good', '已完成'],
  failed: ['crit', '失败'],
};
export const jobPill = (j) => pill(...JOB_STATUS[j.status]);

export function toggle(id, on, label = '') {
  return `<button type="button" class="switch${on ? ' on' : ''}" id="${id}" role="switch" aria-checked="${on}"${label ? ` aria-label="${esc(label)}"` : ''}><i></i></button>`;
}

export function bindToggle(el, onChange) {
  el.addEventListener('click', () => {
    const on = !el.classList.contains('on');
    el.classList.toggle('on', on);
    el.setAttribute('aria-checked', on);
    onChange(on);
  });
}

export function empty(title, body, ic = 'search') {
  return `<div class="empty">${icon(ic)}<b>${esc(title)}</b><span>${esc(body)}</span></div>`;
}

export const progress = (v, kind = '') => `<div class="bar${kind ? ' ' + kind : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v * 100)}"><i style="width:${(v * 100).toFixed(2)}%"></i></div>`;

/** Spotlight: panels with .spot get a soft light that follows the pointer (CSS reads --mx/--my). */
export function installSpotlight(root) {
  root.addEventListener('pointermove', (e) => {
    const p = e.target.closest?.('.spot');
    if (!p) return;
    const r = p.getBoundingClientRect();
    p.style.setProperty('--mx', `${e.clientX - r.left}px`);
    p.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

/** Simple tab strip: [{ id, label }]; returns markup. Bind with bindTabs. */
export function tabs(id, items, active) {
  return `<div class="tabs" id="${id}" role="tablist">${items.map((t) => `<button type="button" role="tab" data-tab="${t.id}" aria-selected="${t.id === active}" class="${t.id === active ? 'on' : ''}">${esc(t.label)}${t.count != null ? `<em>${t.count}</em>` : ''}</button>`).join('')}</div>`;
}
export function bindTabs(root, id, onChange) {
  const el = root.querySelector(`#${id}`);
  el?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    el.querySelectorAll('[data-tab]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    onChange(b.dataset.tab);
  });
}

/** Code block with a copy button; `lang` is only a label. */
export function codeBlock(code, lang = '') {
  return `<div class="code"><div class="code-h"><span>${esc(lang)}</span><button type="button" class="btn xs ghost" data-copy>${icon('copy')}复制</button></div><pre><code>${code}</code></pre></div>`;
}

/** Tiny tokenizer-based highlighter for the bash / python / js / json snippets shown in the app. */
const HL_RE = /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(\d+(?:\.\d+)?(?:e-?\d+)?)\b|\b(import|from|const|let|await|async|for|in|def|return|new|true|false|True|False|None|null|with|as|if|else|curl|export)\b|([A-Za-z_][\w]*)(?=\()/g;
export function highlight(code) {
  let out = '', last = 0;
  for (const m of code.matchAll(HL_RE)) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? 'tk-c' : m[2] ? 'tk-s' : m[3] ? 'tk-n' : m[4] ? 'tk-k' : 'tk-f';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}
