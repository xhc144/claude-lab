import { h, clear } from '../lib/dom.js';
import { icon, logo } from '../lib/icons.js';
import { post } from '../api.js';
import { logout, app } from '../main.js';

export function buildShell(root) {
  const items = [
    ['archive', '#/', 'archive', '研究档案'],
    ['new', '#/new', 'plus', '新建研究'],
    ['gateway', '#/gateway', 'gateway', '接入中心 · API'],
    ['settings', '#/settings', 'settings', '账户与计费'],
  ];
  const links = items.map(([key, href, ic, tip]) => h('a.nav', { href, dataset: { key }, 'aria-label': tip }, icon(ic), h('span.tip', {}, tip)));
  const rail = h('nav.rail', {},
    h('a', { href: '#/', class: 'logo', 'aria-label': '论衡' }, logo()),
    ...links,
    h('div.spacer'),
    h('a.nav', { href: '#', 'aria-label': '退出登录', onclick: async (e) => { e.preventDefault(); await post('/api/auth/logout').catch(() => {}); logout(); } }, icon('logout'), h('span.tip', {}, `退出（${app.user?.username || ''}）`)));
  const main = h('main.main');
  clear(root, rail, main);
  return {
    main,
    setActive(section) {
      const key = section === 's' ? 'archive' : section;
      for (const a of links) a.classList.toggle('active', a.dataset.key === key);
    },
  };
}
