// A small shell. Press "/" (or the 终端 button) to open it; `help` lists the commands.
import { bus } from '../core/bus.js';
import { audio } from '../core/audio.js';
import { scrollToId } from '../core/scroll.js';
import { tex } from '../core/tex.js';
import { unlock, EGGS, hasEgg, eggCount } from './eggs.js';
import { PUBLIC_REPOS, OCW_TOTALS, GITHUB, SNAPSHOT_DATE } from '../data/projects.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CHAPTERS = { hero: 'hero', origin: 'hero', 0: 'dim0', 1: 'dim1', 2: 'dim2', 3: 'dim3', 4: 'dim4', '3+1': 'dim4', n: 'dimn', sigma: 'archive', 'Σ': 'archive', archive: 'archive', inf: 'diminf', '∞': 'diminf', infinity: 'diminf' };

const FILES = {
  'mission.txt': '目标：2027 年清华大学求真书院数学领军计划。\n状态：备考中。\n策略：数学分析 + 高等代数打底，群表示论 / 拓扑 / 概率论拓展，竞赛训练不断线。',
  'interests.txt': '数学：数学分析 · 高等代数 · 群表示论 · 拓扑 · 概率论 · 数学竞赛\n物理：经典力学 · 电动力学 · 量子力学\nAI / CS：AI 编程 · 智能体 · 数学可视化 · 自动化工具',
  'readme.md': '这个网站从 0 维走到 ∞ 维：\n  0 奇点 → 1 轨迹 → 2 复平面 → 3 纽结 → 3+1 时空 → n 隐空间 → Σ 档案 → ∞ 无穷维\n所有画面都在浏览器里实时计算。输入 cd 3 直接跳到三叶结。',
};

function fib(n) {
  let a = 0n, b = 1n;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
function factor(n) {
  const out = [];
  let x = BigInt(n);
  for (let p = 2n; p * p <= x; p += p === 2n ? 1n : 2n) {
    while (x % p === 0n) { out.push(p); x /= p; }
    if (p > 1000000n) break;
  }
  if (x > 1n) out.push(x);
  return out;
}
export function monsterOrder() {
  const f = [[2, 46], [3, 20], [5, 9], [7, 6], [11, 2], [13, 3], [17, 1], [19, 1], [23, 1], [29, 1], [31, 1], [41, 1], [47, 1], [59, 1], [71, 1]];
  return f.reduce((acc, [p, e]) => acc * BigInt(p) ** BigInt(e), 1n);
}

export function initTerminal() {
  const root = document.getElementById('terminal');
  const out = document.getElementById('term-out');
  const input = document.getElementById('term-in');
  const history = [];
  let hi = 0;
  let greeted = false;

  const print = (html, cls = '') => {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.innerHTML = html;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  };

  const open = () => {
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    if (!greeted) {
      greeted = true;
      print(`<span class="acc">XHC144 OBSERVATORY OS</span> · 输入 <span class="ok">help</span> 查看命令，<span class="ok">Tab</span> 补全，<span class="ok">Esc</span> 关闭。`);
    }
    setTimeout(() => input.focus(), 50);
    unlock('terminal', { message: '这里有一个能用的终端。试试 <b>help</b>、<b>whoami</b>、<b>cd 3</b>、<b>fib 144</b>。' });
  };
  const close = () => { root.classList.remove('open'); root.setAttribute('aria-hidden', 'true'); input.blur(); };
  bus.on('terminal', open);
  bus.on('escape', close);
  document.getElementById('term-btn').addEventListener('click', open);
  for (const b of document.querySelectorAll('[data-open-terminal]')) b.addEventListener('click', open);
  root.querySelector('.term-close').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  const commands = {
    help: () => [
      '<span class="acc">可用命令</span>',
      '  whoami            关于我',
      '  ls                列出维度与文件',
      '  cd &lt;维度&gt;         跳转：0 1 2 3 3+1 n Σ ∞（或 hero / archive）',
      '  cat &lt;文件&gt;        mission.txt · interests.txt · readme.md',
      '  projects          公开仓库',
      '  open github       打开 GitHub 主页',
      '  fib &lt;n&gt;           斐波那契数 F(n)（任意精度）',
      '  factor &lt;n&gt;        质因数分解',
      '  euler · monster   两个等式 / 一个数',
      '  sound on|off      声音开关',
      '  eggs              彩蛋进度',
      '  date · clear · exit',
    ].join('\n'),
    whoami: () => 'xhc144 — 高二学生。\n主线：数学（数学分析 · 高等代数 · 群表示论 · 拓扑 · 概率论 · 竞赛）\n交叉：物理（经典力学 → 电动力学 → 量子力学）· 人工智能 · 计算机科学\n目标：2027 清华大学求真书院数学领军计划（备考中）\n工具：AI 编程 · 智能体 · 数学可视化 · 自动化工具',
    ls: () => 'dim0/  dim1/  dim2/  dim3/  dim4/  dimn/  archive/  diminf/\nmission.txt  interests.txt  readme.md',
    cd: (arg) => {
      const id = CHAPTERS[(arg || '').trim()] || CHAPTERS[(arg || '').trim().toLowerCase()];
      if (!id) return `<span class="err">cd: 没有这个维度：${esc(arg || '')}</span>（可用：0 1 2 3 3+1 n Σ ∞）`;
      setTimeout(() => { close(); scrollToId(id); }, 250);
      return `<span class="ok">→ 正在跃迁到 ${esc(arg)} …</span>`;
    },
    cat: (arg) => FILES[(arg || '').trim()] ? esc(FILES[arg.trim()]) : `<span class="err">cat: ${esc(arg || '')}: 没有那个文件</span>`,
    projects: () => PUBLIC_REPOS.map((r) => `<span class="acc">${r.name}</span>  ${esc(r.title)}\n  ${r.url}`).join('\n') + `\n\nmit-ocw-notes：数学 ${OCW_TOTALS.mathBooks} 册 ${OCW_TOTALS.mathPages} 页 · 物理 ${OCW_TOTALS.physBooks} 科 ${OCW_TOTALS.physPages} 页（快照 ${SNAPSHOT_DATE}）`,
    open: (arg) => {
      const a = (arg || 'github').trim();
      const repo = PUBLIC_REPOS.find((r) => r.name === a);
      const url = repo ? repo.url : a === 'github' ? GITHUB : null;
      if (!url) return `<span class="err">open: 不认识 ${esc(a)}</span>`;
      window.open(url, '_blank', 'noopener');
      return `<span class="ok">已在新标签页打开 ${url}</span>`;
    },
    fib: (arg) => {
      const n = Number.parseInt(arg, 10);
      if (!Number.isFinite(n) || n < 0 || n > 5000) return '<span class="err">用法：fib n（0 ≤ n ≤ 5000）</span>';
      const v = fib(n);
      let extra = '';
      if (n === 12) {
        extra = '\n<span class="ok">F(12) = 144 = 12² —— 斐波那契数列里除 0、1 之外唯一的完全平方数（Cohn, 1964）。</span>';
        unlock('f144', { message: tex('144 = F_{12} = 12^2') + '：斐波那契数列中除 0 和 1 之外唯一的完全平方数（J. H. E. Cohn, 1964）。' });
      }
      return `F(${n}) = ${v}${extra}`;
    },
    factor: (arg) => {
      if (!/^\d{1,30}$/.test((arg || '').trim())) return '<span class="err">用法：factor n（n 为正整数）</span>';
      const n = BigInt(arg.trim());
      if (n < 2n) return `${n}`;
      const f = factor(n);
      return `${n} = ${f.join(' × ')}${f.length === 1 ? '  <span class="ok">（质数）</span>' : ''}`;
    },
    euler: () => { bus.emit('fx-euler'); return tex('e^{i\\pi}+1=0') + '\n五个最重要的常数，一个等式。'; },
    monster: () => { bus.emit('fx-monster'); return `|𝕄| = ${monsterOrder()}\n≈ 8.08 × 10⁵³ —— 魔群：最大的散在单群。`; },
    sound: (arg) => {
      if (arg === 'on') { bus.emit('sound', true); return '<span class="ok">声音：开</span>'; }
      if (arg === 'off') { bus.emit('sound', false); return '声音：关'; }
      return `声音当前${audio.on ? '开' : '关'}。用法：sound on | sound off`;
    },
    eggs: () => `已发现 ${eggCount()} / ${EGGS.length}\n` + EGGS.map((e, i) => `${String(i + 1).padStart(2, '0')}  ${hasEgg(e.id) ? '<span class="ok">✓ ' + e.name + '</span>' : '· ？？？  线索：' + e.hint}`).join('\n'),
    date: () => {
      const now = new Date();
      const target = Date.UTC(2026, 11, 31, 16, 0, 0); // 2027-01-01 00:00 Beijing
      const days = Math.max(0, Math.ceil((target - now.getTime()) / 86400000));
      return `${now.toLocaleString('zh-CN', { hour12: false })}\n距离 2027 年还有 ${days} 天。`;
    },
    clear: () => { out.innerHTML = ''; return null; },
    exit: () => { close(); return null; },
    sudo: () => '<span class="err">权限不足：在数学里，root 权限只能靠证明获得。</span>',
    rm: () => '<span class="err">拒绝执行：公理不可删除。</span>',
    echo: (arg) => esc(arg || ''),
    hello: () => '你好！欢迎来到 0 → ∞。',
    qiuzhen: () => { unlock('console', { message: '求真。继续前进。' }); return '求真 · 继续前进'; },
    neofetch: () => `<span class="acc">        ∞        </span>  xhc144@observatory\n<span class="acc">     0 → ∞      </span>  OS: Observatory OS 2026.10\n<span class="acc">   ℝ³ × t × n   </span>  Shell: xsh 1.0\n                   Kernel: Mathematics\n                   Uptime: 高二\n                   Target: 2027 求真书院`,
  };

  const run = (line) => {
    const raw = line.trim();
    if (!raw) return;
    print(esc(raw), 'cmd');
    history.push(raw); hi = history.length;
    const [name, ...rest] = raw.split(/\s+/);
    const fn = commands[name.toLowerCase()];
    audio.tick();
    if (!fn) { print(`<span class="err">${esc(name)}: 未知命令</span>。输入 help 查看可用命令。`); return; }
    const res = fn(rest.join(' '));
    if (res) print(res);
  };

  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { run(input.value); input.value = ''; }
    else if (e.key === 'Escape') close();
    else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; input.value = history[hi]; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (hi < history.length - 1) { hi++; input.value = history[hi]; } else { hi = history.length; input.value = ''; } e.preventDefault(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const m = Object.keys(commands).filter((c) => c.startsWith(input.value));
      if (m.length === 1) input.value = m[0] + ' ';
      else if (m.length > 1) print(m.join('  '));
    } else audio.tick();
  });
  return { open, close };
}
