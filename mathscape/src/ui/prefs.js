// Precision controls bound to the shared settings (settings dialog, start page, matrix panel).

import { h } from './dom.js';
import { segmented, chips, toggle } from './controls.js';
import { settings, updateSettings, onSettings, DIGIT_CHOICES } from './settings.js';

/** Returns { el, destroy } — call destroy() when the element goes away. */
export function precisionControls({ idPrefix = 'prec', showStart = false, compact = false } = {}) {
  const mode = segmented({
    id: `${idPrefix}-mode`,
    options: [
      { value: 'standard', label: compact ? '双精度' : '标准 · 双精度', title: 'IEEE 754 双精度浮点数，约 16 位有效数字' },
      { value: 'high', label: compact ? '高精度' : '高精度 · 任意位数', title: '有理数精确运算 + 任意位数的十进制近似' },
    ],
    value: settings.precision,
    onChange: (v) => updateSettings({ precision: v }),
  });
  const digits = chips({
    id: `${idPrefix}-digits`,
    items: DIGIT_CHOICES.map((d) => ({ id: String(d), label: `${d} 位` })),
    value: String(settings.digits),
    onPick: (id) => updateSettings({ digits: Number(id), precision: 'high' }),
  });
  const digitsRow = h('div', { class: 'field prec-digits' }, h('span', { class: 'label' }, '高精度的有效数字位数'), digits.el);
  const start = showStart
    ? toggle({ label: '打开网站时先显示开启页面', value: settings.startPage, id: `${idPrefix}-start`, onChange: (v) => updateSettings({ startPage: v }) })
    : null;
  const el = h('div', { class: 'prec-controls' }, mode.el, digitsRow, start?.el);
  const sync = () => {
    mode.set(settings.precision);
    digits.set(String(settings.digits));
    el.classList.toggle('hp', settings.precision === 'high');
    start?.set(settings.startPage);
  };
  sync();
  return { el, destroy: onSettings(sync) };
}
