// Tiny DOM helpers: h() builds elements, the rest are conveniences shared by every screen.

export function h(tag, attrs, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    kids.unshift(attrs);
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list' && k !== 'type') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function img(src, cls = 'icon', alt = '') {
  const i = document.createElement('img');
  i.src = src;
  i.className = cls;
  i.alt = alt;
  i.draggable = false;
  return i;
}

export function starsEl(n, max = 3) {
  const s = h('span.stars');
  for (let i = 0; i < max; i++) s.appendChild(h('span', { class: i < n ? 'on' : '' }, '★'));
  return s;
}

/** update text only when it changed (avoids layout churn in per-frame HUD updates) */
export function setText(el, t) {
  t = String(t);
  if (el.textContent !== t) el.textContent = t;
}
