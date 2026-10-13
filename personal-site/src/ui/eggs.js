// Easter-egg registry: what exists, what was found (remembered per browser), and the counter.
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { audio } from '../core/audio.js';
import { toast } from './toast.js';

export const EGGS = [
  { id: 'terminal', name: '隐藏终端', hint: '键盘上的 / 键' },
  { id: 'f144', name: '144 的秘密', hint: '首页 144 旁边的注记，或者在页面上键入 144' },
  { id: 'konami', name: '最大的散在单群', hint: '↑ ↑ ↓ ↓ ← → ← → B A' },
  { id: 'untie', name: '解不开的结', hint: '在第 3 维试着把三叶结解开' },
  { id: 'bang', name: '大爆炸', hint: '点一下第 0 维中央的奇点' },
  { id: 'warp', name: '超光速', hint: '非常非常快地滚动页面' },
  { id: 'idle', name: '待机画面', hint: '什么都不做，静置 45 秒' },
  { id: 'epsilon', name: '最短的数学笑话', hint: '页脚某个角落里有一个 ε' },
  { id: 'euler', name: '最美的等式', hint: '在页面上键入 euler' },
  { id: 'rec', name: '导演剪辑版', hint: '连续点击左下角的 REC 指示灯 5 次' },
  { id: 'console', name: '给读源码的人', hint: '开发者工具的控制台里有一行留言' },
  { id: 'monodromy', name: '单值化', hint: '在第 3 维把 θ 滑到尽头（12π）' },
];

const found = new Set(store.get('eggs', []));

export function eggCount() { return found.size; }
export function hasEgg(id) { return found.has(id); }

function renderCount() {
  const el = document.getElementById('egg-count');
  if (el) el.textContent = String(found.size).padStart(2, '0');
  for (const t of document.querySelectorAll('.egg-total')) t.textContent = EGGS.length;
}

export function renderEggList() {
  const list = document.getElementById('eggs-list');
  if (!list) return;
  list.innerHTML = EGGS.map((e) => found.has(e.id)
    ? `<li class="found"><div><b>${e.name}</b><em>已发现 · ${e.hint}</em></div></li>`
    : `<li><div><b>？？？</b><em>线索：${e.hint}</em></div></li>`).join('');
}

export function unlock(id, { message } = {}) {
  const egg = EGGS.find((e) => e.id === id);
  if (!egg) return false;
  const fresh = !found.has(id);
  if (fresh) {
    found.add(id);
    store.set('eggs', [...found]);
    renderCount();
    const btn = document.getElementById('egg-btn');
    if (btn) { btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); }
    audio.success();
    toast(`HIDDEN SIGNAL ${String(found.size).padStart(2, '0')}/${EGGS.length} · ${egg.name}`, message || '你发现了一个彩蛋。');
    if (found.size === EGGS.length) setTimeout(() => toast('ALL SIGNALS FOUND', '全部 12 个彩蛋都被你找到了。你一定是那种会把定理的证明读到最后一行的人。', { duration: 9000 }), 1200);
  } else if (message) {
    toast(egg.name, message);
  }
  bus.emit('egg', { id, fresh });
  return fresh;
}

export function initEggs() {
  renderCount();
  const panel = document.getElementById('eggs-panel');
  const open = () => { renderEggList(); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); };
  const close = () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); };
  document.getElementById('egg-btn').addEventListener('click', open);
  panel.querySelector('.eggs-close').addEventListener('click', close);
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  bus.on('escape', close);
}
