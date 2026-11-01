'use strict';
/* 题记前端：列表、编辑、贴图识别、关键词、导出。数据都通过 app.py 的 /api 存在本机。 */

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ICON = {
  image: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.4"/><path d="M4 15l4.5-4.5 3 3 2-2L17 15"/></svg>',
  upload: '<svg viewBox="0 0 28 28"><rect x="4" y="5" width="20" height="18" rx="3"/><path d="M14 18v-8M10.5 13.5L14 10l3.5 3.5"/></svg>',
  zoom: '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5L17 17M8.5 6.5v4M6.5 8.5h4"/></svg>',
  swap: '<svg viewBox="0 0 20 20"><path d="M4 7h11l-3-3M16 13H5l3 3"/></svg>',
  trash: '<svg viewBox="0 0 20 20"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>',
  scan: '<svg viewBox="0 0 20 20"><path d="M3 7V4h3M14 4h3v3M17 13v3h-3M6 16H3v-3M6 10h8"/></svg>',
  x: '<svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6"/></svg>',
  key: '<svg viewBox="0 0 20 20" style="width:18px;height:18px;flex:none"><circle cx="7" cy="10" r="3.5"/><path d="M10.5 10H17M14.5 10v2.5M17 10v2"/></svg>',
  back: '<svg viewBox="0 0 20 20"><path d="M12 4l-6 6 6 6"/></svg>',
};

// ------------------------------------------------------------------ 公式渲染（和 texify.py 的切分规则一致）
const ENV = '(?:equation|align|alignat|gather|multline|flalign|aligned|gathered|alignedat|split|cases|dcases|array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix)\\*?';
const SEG = new RegExp(
  String.raw`(\$\$([\s\S]+?)\$\$)|(\\\[([\s\S]+?)\\\])|(\\\(([\s\S]+?)\\\))|(\\begin\{(` + ENV +
  String.raw`)\}[\s\S]*?\\end\{\8\})|((?<!\\)\$((?:\\[\s\S]|[^$\\])+?)\$)`, 'g');
const MACROS = {
  '\\R': '\\mathbb{R}', '\\N': '\\mathbb{N}', '\\Z': '\\mathbb{Z}', '\\Q': '\\mathbb{Q}', '\\C': '\\mathbb{C}',
  '\\argmin': '\\operatorname*{arg\\,min}', '\\argmax': '\\operatorname*{arg\\,max}',
  '\\rank': '\\operatorname{rank}', '\\tr': '\\operatorname{tr}', '\\diag': '\\operatorname{diag}',
  '\\sgn': '\\operatorname{sgn}', '\\dif': '\\mathop{}\\!\\mathrm{d}',
};

function segments(text) {
  const out = []; let pos = 0, m;
  SEG.lastIndex = 0;
  while ((m = SEG.exec(text))) {
    if (m.index > pos) out.push({ t: 'text', s: text.slice(pos, m.index) });
    if (m[1]) out.push({ t: 'math', s: m[2], d: true });
    else if (m[3]) out.push({ t: 'math', s: m[4], d: true });
    else if (m[5]) out.push({ t: 'math', s: m[6], d: false });
    else if (m[7]) out.push({ t: 'math', s: m[7], d: true, env: true });
    else out.push({ t: 'math', s: m[10], d: false });
    pos = SEG.lastIndex;
  }
  if (pos < text.length) out.push({ t: 'text', s: text.slice(pos) });
  return out;
}
function mathHTML(tex, display) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', macros: { ...MACROS } });
  } catch {
    return `<span class="katex-error">${esc(tex)}</span>`;
  }
}
function textHTML(s, compact) {
  const h = esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/&quot;([^&\n]+?)&quot;/g, '“$1”');
  return compact ? h.replace(/\s*\n\s*/g, ' ') : h.replace(/\n/g, '<br>');
}
function rich(text, compact = false) {
  const segs = segments(String(text || '').trim());
  return segs.map((g, i) => {
    if (g.t === 'math') {
      if (!compact) return mathHTML(g.s, g.d);
      // 卡片里一律排成行内：顶层环境换成对应的行内版本
      const s = g.s.replace(/\\(begin|end)\{(align|flalign)\*?\}/g, '\\$1{aligned}')
        .replace(/\\(begin|end)\{gather\*?\}/g, '\\$1{gathered}')
        .replace(/\\(begin|end)\{(equation|multline)\*?\}/g, '');
      return mathHTML(s, false);
    }
    let s = g.s;
    if (!compact) {
      if (segs[i + 1]?.d) s = s.replace(/\s+$/, '');
      if (segs[i - 1]?.d) s = s.replace(/^\s+/, '');
      s = s.replace(/\n\s*\n+/g, '\n');
    }
    return textHTML(s, compact);
  }).join('');
}

// ------------------------------------------------------------------ 状态与接口
const S = {
  notes: [], settings: {}, filter: '__all', query: '',
  cur: null, dirty: false, recognizing: false, replaceImage: false,
  exp: { scope: 'all', group: '1', layout: 'compact' },
};

async function api(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: {}, keepalive: !!opts.keepalive };
  if (opts.body instanceof FormData) o.body = opts.body;
  else if (opts.body !== undefined) { o.body = JSON.stringify(opts.body); o.headers['Content-Type'] = 'application/json'; }
  let r;
  try { r = await fetch(path, o); }
  catch { throw Object.assign(new Error('连不上题记的本地服务，关掉题记再打开试试。'), { data: {} }); }
  let data = null;
  try { data = await r.json(); } catch { /* 非 JSON */ }
  if (!r.ok) throw Object.assign(new Error(data?.error || `请求失败（${r.status}）`), { data: data || {} });
  return data;
}

// ------------------------------------------------------------------ 提示
function toast(msg, { err = false, action = null, ms = 4600 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action[0];
    b.onclick = () => { action[1](); el.remove(); };
    el.appendChild(b);
  }
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), err ? ms + 2400 : ms);
}

// ------------------------------------------------------------------ 关键词统计
function kwCounts() {
  const c = new Map();
  for (const n of S.notes) for (const k of n.keywords) c.set(k, (c.get(k) || 0) + 1);
  const order = S.settings.keywords || [];
  return [...c.entries()].sort((a, b) => {
    const ia = order.indexOf(a[0]), ib = order.indexOf(b[0]);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0 || ib >= 0) return ia >= 0 ? -1 : 1;
    return b[1] - a[1] || a[0].localeCompare(b[0], 'zh');
  });
}
function keywordPool() {
  const pool = [...(S.settings.keywords || [])];
  for (const [k] of kwCounts()) if (!pool.includes(k)) pool.push(k);
  return pool;
}
function filterLabel() {
  if (S.filter === '__all') return '全部';
  if (S.filter === '__none') return '未归类';
  return S.filter;
}
function visibleNotes() {
  const q = S.query.trim().toLowerCase();
  return S.notes.filter(n => {
    if (S.filter === '__none' && n.keywords.length) return false;
    if (!S.filter.startsWith('__') && !n.keywords.includes(S.filter)) return false;
    if (!q) return true;
    return [n.problem, ideaText(n), n.source, n.keywords.join(' '), 'no.' + pad(n.seq)].join('\n').toLowerCase().includes(q);
  }).sort((a, b) => b.seq - a.seq);
}

// ------------------------------------------------------------------ 左栏：关键词目录
function renderNav() {
  const counts = kwCounts();
  const none = S.notes.filter(n => !n.keywords.length).length;
  const item = (k, label, c, muted) =>
    `<button class="nav-item${S.filter === k ? ' on' : ''}${muted ? ' muted' : ''}" data-kw="${esc(k)}"><span>${esc(label)}</span><em>${c}</em></button>`;
  let h = `<div class="nav-sec">浏览</div>${item('__all', '全部', S.notes.length)}`;
  h += `<div class="nav-sec"><span>关键词</span><button type="button" class="nav-manage" data-manage title="新建、改名、排序、删除预设关键词">管理</button></div>`;
  if (!counts.length) h += `<p class="nav-note">录题时选上关键词，这里会自动按关键词归好类，导出时也按它分章。</p>`;
  for (const [k, c] of counts) h += item(k, k, c);
  if (none) h += item('__none', '未归类', none, true);
  const imgs = S.notes.filter(n => n.image).length;
  h += `<div class="nav-foot">${S.notes.length} 题 · ${imgs} 张原图<br>${counts.length} 个关键词</div>`;
  $('#kwnav').innerHTML = h;

  const sel = $('#kwSelect');
  sel.innerHTML = `<option value="__all">全部（${S.notes.length}）</option>` +
    counts.map(([k, c]) => `<option value="${esc(k)}">${esc(k)}（${c}）</option>`).join('') +
    (none ? `<option value="__none">未归类（${none}）</option>` : '');
  sel.value = S.filter;
}
$('#kwnav').addEventListener('click', e => {
  if (e.target.closest('[data-manage]')) { openSettings(); setTimeout(() => $('#sKeywords').focus(), 60); return; }
  const b = e.target.closest('.nav-item');
  if (b) setFilter(b.dataset.kw);
});
function setFilter(k) {
  S.filter = k;
  renderNav(); renderList();
}

// ------------------------------------------------------------------ 中栏：题目卡片
function shortDate(iso) { return iso ? iso.slice(5, 10) : ''; }
function cardHTML(n) {
  const kw = n.keywords.map((k, i) => `<span class="chip${i === 0 ? ' first' : ''}">${esc(k)}</span>`).join('');
  const problem = n.problem ? rich(n.problem, true) : (n.image ? '只有原图，还没有文字' : '（空）');
  const ideas = (n.ideas || []).filter(i => i.text.trim());
  const first = ideas.find(i => i.by !== 'ai') || ideas[0];
  const more = ideas.length > 1 ? `<span class="card-more">共 ${ideas.length} 条想法</span>` : '';
  return `<article class="card${S.cur?.id === n.id ? ' on' : ''}" data-id="${n.id}" tabindex="0">
    <div class="card-top"><span class="card-no">No.<b>${pad(n.seq)}</b></span><span class="card-src">${esc(n.source)}</span><span class="card-date">${shortDate(n.created)}</span></div>
    <div class="card-problem${n.problem ? '' : ' empty'}">${problem}</div>
    ${first ? `<div class="card-idea${first.by === 'ai' ? ' ai' : ''}">${rich(first.text, true)}</div>${more}` : ''}
    ${kw || n.image ? `<div class="card-foot">${kw}${n.image ? `<span class="has-img">${ICON.image}原图</span>` : ''}</div>` : ''}
  </article>`;
}
function renderList() {
  const list = visibleNotes();
  $('#listTitle').textContent = filterLabel();
  $('#listCount').textContent = `${list.length} 题${S.query ? ' · 搜索中' : ''}`;
  if (!list.length) {
    $('#cards').innerHTML = S.notes.length
      ? `<div class="list-empty"><b>没有符合的题目</b>换个关键词或搜索词试试。</div>`
      : `<div class="list-empty"><b>还没有题目</b>截图后按 Ctrl+V 粘贴，<br>或者点右上角「新题」。</div>`;
    return;
  }
  $('#cards').innerHTML = list.map(cardHTML).join('');
}
$('#cards').addEventListener('click', e => {
  const c = e.target.closest('.card');
  if (c) openNote(c.dataset.id);
});
$('#cards').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList.contains('card')) openNote(e.target.dataset.id);
});
function markActiveCard() {
  for (const c of document.querySelectorAll('.card')) c.classList.toggle('on', c.dataset.id === S.cur?.id);
}

// ------------------------------------------------------------------ 编辑区
const F = { problem: $('#fProblem'), source: $('#fSource') };

const newId = () => Math.random().toString(36).slice(2, 10);
function ideaText(n) { return (n.ideas || []).map(i => i.text).join('\n'); }
function blankNote() {
  return { id: null, seq: null, problem: '', ideas: [], source: '', keywords: [], image: '', created: null };
}
function isBlank(n) { return !n.problem.trim() && !ideaText(n).trim() && !n.source.trim() && !n.image && !n.keywords.length; }

async function openNote(id) {
  if (S.cur?.id === id && id) return;
  await flushSave();
  const n = S.notes.find(x => x.id === id);
  if (!n) return;
  S.cur = structuredClone(n);
  S.dirty = false;
  renderEditor();
  markActiveCard();
}
async function newNote(initial = {}) {
  await flushSave();
  S.cur = { ...blankNote(), ...initial };
  if (!S.filter.startsWith('__') && !S.cur.keywords.length) S.cur.keywords = [S.filter];  // 在某个关键词下新建，默认带上它
  S.dirty = false;
  renderEditor();
  markActiveCard();
}

function renderEditor() {
  const cur = S.cur;
  document.body.classList.toggle('editing', !!cur);
  $('#welcome').hidden = !!cur;
  $('#sheet').hidden = !cur;
  $('#edFoot').hidden = !cur;
  if (!cur) { renderWelcome(); return; }
  F.problem.value = cur.problem;
  F.source.value = cur.source;
  cur.pending = {};  // AI 改过、还没决定要不要的版本：{ problem | 想法 id: 新文字 }
  if (!cur.ideas.length) cur.ideas.push({ id: newId(), text: '', by: 'me' });
  $('#kwFind').value = '';
  updateHead();
  renderImageBox();
  renderKeywords();
  renderPreview('problem'); renderProposal('problem');
  renderIdeas();
  requestAnimationFrame(() => grow(F.problem));
  setSaveState(cur.id ? 'saved' : '');
  $('#btnDelete').hidden = !cur.id;
}
function updateHead() {
  const cur = S.cur;
  $('#edNo').textContent = cur.seq ? pad(cur.seq) : '新';
  $('#edMeta').textContent = cur.created ? cur.created.slice(0, 10) + ' 录入' : '还没保存';
  $('#btnDelete').hidden = !cur.id;
}
function grow(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight + 2) + 'px';
}
let previewTimer = {};
function renderPreview(field) {
  const v = S.cur?.problem || '';
  $('#pvProblem').innerHTML = v.trim() ? rich(v) : '';
}
F.problem.addEventListener('input', () => {
  S.cur.problem = F.problem.value;
  grow(F.problem);
  clearTimeout(previewTimer.problem);
  previewTimer.problem = setTimeout(() => renderPreview('problem'), 140);
  markDirty();
});
F.source.addEventListener('input', () => { S.cur.source = F.source.value; markDirty(); });
F.source.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); F.problem.focus(); } });
window.addEventListener('resize', () => { if (S.cur) { grow(F.problem); document.querySelectorAll('#ideaList textarea').forEach(grow); } });

// ------------------------------------------------------------------ 想法：一条一条的，自己写的和 AI 给的分开标
function ideaLabel(cur, it) {
  if (it.by === 'ai') return 'AI 思路';
  const mine = cur.ideas.filter(i => i.by !== 'ai');
  return mine.length === 1 ? '我的想法' : `想法 ${mine.indexOf(it) + 1}`;
}
function renderIdeas(focusId) {
  const cur = S.cur;
  $('#ideaList').innerHTML = cur.ideas.map((it, i) => `
    <div class="idea-item${it.by === 'ai' ? ' ai' : ''}" data-iid="${it.id}">
      <div class="idea-bar">
        <span class="idea-tag">${esc(ideaLabel(cur, it))}</span>
        <span class="idea-tools">
          <button type="button" class="mini" data-act="tidy" title="让 AI 把这条里的公式写成 LaTeX、顺一下文字（不改意思）">AI 转 LaTeX</button>
          ${it.by === 'ai' ? '<button type="button" class="mini" data-act="mine" title="改成自己的想法（PDF 里不再标 AI）">算我的</button>' : ''}
          ${i > 0 ? '<button type="button" class="mini" data-act="up" title="往前挪">上移</button>' : ''}
          <button type="button" class="mini rm" data-act="del">删除</button>
        </span>
      </div>
      <textarea class="src kai" rows="2" spellcheck="false" placeholder="${i === 0 ? '突破口、关键一步、卡在哪里、和哪道题像……可以只写几个词' : '另一个角度、补充、后来想到的……'}">${esc(it.text)}</textarea>
      <div class="preview kai">${it.text.trim() ? rich(it.text) : ''}</div>
      <div class="proposal-slot" data-pr-for="${it.id}"></div>
    </div>`).join('');
  for (const it of cur.ideas) renderProposal(it.id);
  renderPendingBar();
  requestAnimationFrame(() => {
    document.querySelectorAll('#ideaList textarea').forEach(grow);
    if (focusId) $(`.idea-item[data-iid="${focusId}"] textarea`)?.focus();
  });
}
function ideaById(id) { return S.cur.ideas.find(i => i.id === id); }
$('#ideaList').addEventListener('input', e => {
  if (e.target.tagName !== 'TEXTAREA') return;
  const box = e.target.closest('.idea-item'), it = ideaById(box.dataset.iid);
  it.text = e.target.value;
  grow(e.target);
  clearTimeout(previewTimer[it.id]);
  previewTimer[it.id] = setTimeout(() => { const pv = box.querySelector('.preview'); pv.innerHTML = it.text.trim() ? rich(it.text) : ''; }, 140);
  markDirty();
});
$('#ideaList').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const cur = S.cur, id = b.closest('.idea-item').dataset.iid, it = ideaById(id), i = cur.ideas.indexOf(it);
  if (b.dataset.act === 'tidy') tidyIdeas([it], b);
  else if (b.dataset.act === 'mine') { it.by = 'me'; renderIdeas(); markDirty(true); }
  else if (b.dataset.act === 'up') { cur.ideas.splice(i - 1, 0, ...cur.ideas.splice(i, 1)); renderIdeas(); markDirty(true); }
  else if (b.dataset.act === 'del') {
    cur.ideas.splice(i, 1);
    delete cur.pending[id];
    if (!cur.ideas.length) cur.ideas.push({ id: newId(), text: '', by: 'me' });
    renderIdeas(); markDirty(true);
    if (it.text.trim()) toast('删掉了一条想法', { action: ['撤销', () => { if (S.cur === cur) { cur.ideas.splice(i, 0, it); renderIdeas(); markDirty(true); } }] });
  }
});
$('#btnAddIdea').addEventListener('click', () => {
  const it = { id: newId(), text: '', by: 'me' };
  S.cur.ideas.push(it);
  renderIdeas(it.id);
});

// ------------------------------------------------------------------ AI 改的东西先摆出来，自己决定用不用
function renderProposal(key) {
  const cur = S.cur;
  const slot = key === 'problem' ? $('#prProblem') : $(`.proposal-slot[data-pr-for="${key}"]`);
  if (!slot) return;
  const text = cur.pending[key];
  if (text === undefined) { slot.innerHTML = ''; return; }
  const kai = key === 'problem' ? '' : ' kai';
  slot.innerHTML = `<div class="proposal">
    <div class="pr-head"><b>AI 改成了这样</b><span>对照上面原来的看看，确认没问题再用</span></div>
    <div class="pr-body preview${kai}">${rich(text)}</div>
    <details class="pr-src"><summary>看 LaTeX 源码</summary><pre>${esc(text)}</pre></details>
    <div class="pr-actions">
      <button type="button" class="btn primary sm" data-pr="accept">用这个</button>
      ${key === 'problem' ? '' : '<button type="button" class="btn sm" data-pr="both">两个都留</button>'}
      <button type="button" class="btn ghost sm" data-pr="reject">不要</button>
    </div></div>`;
}
function applyProposal(key, how) {
  const cur = S.cur, text = cur.pending[key];
  if (text === undefined) return;
  delete cur.pending[key];
  if (how === 'reject') { renderProposal(key); renderPendingBar(); return; }
  if (key === 'problem') {
    cur.problem = text; F.problem.value = text; grow(F.problem); renderPreview('problem'); renderProposal('problem');
  } else {
    const it = ideaById(key);
    if (!it) return;
    if (how === 'both') cur.ideas.splice(cur.ideas.indexOf(it) + 1, 0, { id: newId(), text, by: 'me' });
    else it.text = text;
    renderIdeas();
  }
  renderPendingBar();
  markDirty(true);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pr]');
  if (!b || !S.cur) return;
  const slot = b.closest('.proposal-slot');
  applyProposal(slot.id === 'prProblem' ? 'problem' : slot.dataset.prFor, b.dataset.pr);
});
function renderPendingBar() {
  const n = Object.keys(S.cur.pending).filter(k => k !== 'problem').length;
  $('#pendingBar').hidden = n < 2;
  $('#pendingCount').textContent = n;
}
$('#pendingBar').addEventListener('click', e => {
  const b = e.target.closest('[data-all]');
  if (!b) return;
  for (const k of Object.keys(S.cur.pending)) if (k !== 'problem') applyProposal(k, b.dataset.all);
});

// ------------------------------------------------------------------ 保存（自动 + Ctrl+S）
let saveTimer = null, saveChain = Promise.resolve();
function markDirty(now = false) {
  S.dirty = true;
  setSaveState('dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, now ? 0 : 1100);
}
function save() {
  clearTimeout(saveTimer);
  saveChain = saveChain.then(doSave, doSave);
  return saveChain;
}
async function flushSave() {
  if (S.dirty) await save(); else await saveChain;
}
function payload(n) {
  return { problem: n.problem, ideas: n.ideas.map(({ id, text, by }) => ({ id, text, by })), source: n.source, keywords: n.keywords, image: n.image };
}
async function doSave() {
  const cur = S.cur;
  if (!cur || !S.dirty) return;
  if (!cur.id && isBlank(cur)) { S.dirty = false; setSaveState(''); return; }
  S.dirty = false;
  setSaveState('saving');
  try {
    const saved = cur.id
      ? await api('/api/notes/' + cur.id, { method: 'PUT', body: payload(cur) })
      : await api('/api/notes', { method: 'POST', body: payload(cur) });
    upsertNote(saved);
    Object.assign(cur, { id: saved.id, seq: saved.seq, created: saved.created, updated: saved.updated });
    if (S.cur === cur) { updateHead(); setSaveState(S.dirty ? 'dirty' : 'saved'); }
    renderNav(); renderList();
  } catch (e) {
    S.dirty = true;
    setSaveState('error', e.message);
    toast('没保存上：' + e.message, { err: true });
  }
}
function upsertNote(n) {
  const i = S.notes.findIndex(x => x.id === n.id);
  if (i >= 0) S.notes[i] = n; else S.notes.push(n);
}
function setSaveState(kind, msg) {
  const el = $('#saveState');
  el.className = 'save-state ' + kind;
  el.textContent = { saved: '已保存', dirty: '有改动，马上自动保存', saving: '保存中…', error: msg || '保存失败', '': '' }[kind] ?? '';
}
$('#btnSave').addEventListener('click', async () => {
  if (!S.cur) return;
  S.dirty = true;
  await save();
  if (!S.dirty && S.cur.id) toast(`No.${pad(S.cur.seq)} 已保存`);
});
window.addEventListener('beforeunload', () => {
  if (!S.dirty || !S.cur || isBlank(S.cur)) return;
  const cur = S.cur;
  fetch(cur.id ? '/api/notes/' + cur.id : '/api/notes', {
    method: cur.id ? 'PUT' : 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(cur)),
  });
});

$('#btnDelete').addEventListener('click', async () => {
  const cur = S.cur;
  if (!cur?.id) return;
  if (!confirm(`删除 No.${pad(cur.seq)}？\n（题目和原图会挪到 data/deleted.json 里留底，不会彻底消失）`)) return;
  try {
    await api('/api/notes/' + cur.id, { method: 'DELETE' });
    S.notes = S.notes.filter(n => n.id !== cur.id);
    S.cur = null; S.dirty = false;
    const next = visibleNotes()[0];
    renderNav(); renderList();
    if (next) openNote(next.id); else renderEditor();
    toast(`No.${pad(cur.seq)} 已删除`);
  } catch (e) { toast(e.message, { err: true }); }
});

// ------------------------------------------------------------------ 原图
function renderImageBox() {
  const box = $('#imgBox'), cur = S.cur;
  if (!cur.image) {
    box.innerHTML = `<div class="drop" data-pick tabindex="0">${ICON.upload}
      <strong>粘贴题目截图 <kbd>Ctrl</kbd><kbd>V</kbd></strong>
      <span>或拖入图片 · 点击选择文件 · 也可以不贴图，直接在下面打字</span></div>`;
    return;
  }
  box.innerHTML = `<div class="shot${S.recognizing ? ' busy' : ''}">
      <div class="frame" data-zoom title="点击放大"><img src="/images/${esc(cur.image)}" alt="原图"></div>
      <span class="busy-pill">DeepSeek 正在识别…</span>
      <div class="shot-bar">
        <span class="meta" id="imgMeta">原图</span>
        <button type="button" data-zoom>${ICON.zoom}放大</button>
        <button type="button" data-recog>${ICON.scan}重新识别</button>
        <button type="button" data-replace>${ICON.swap}换图</button>
        <button type="button" class="rm" data-remove>${ICON.trash}移除</button>
      </div>
    </div>`;
  const img = box.querySelector('img');
  img.onload = () => { const m = $('#imgMeta'); if (m) m.textContent = `原图 · ${img.naturalWidth}×${img.naturalHeight}`; };
}
$('#imgBox').addEventListener('click', e => {
  const t = e.target.closest('[data-pick],[data-zoom],[data-recog],[data-replace],[data-remove]');
  if (!t) return;
  if (t.hasAttribute('data-pick')) pickFile(false);
  else if (t.hasAttribute('data-zoom')) openLightbox('/images/' + S.cur.image);
  else if (t.hasAttribute('data-recog')) recognize();
  else if (t.hasAttribute('data-replace')) pickFile(true);
  else if (t.hasAttribute('data-remove')) removeImage();
});
$('#imgBox').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.hasAttribute('data-pick')) { e.preventDefault(); pickFile(false); }
});
function pickFile(replace) {
  S.replaceImage = replace;
  $('#filePick').value = '';
  $('#filePick').click();
}
$('#filePick').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) addImage(f, { target: S.replaceImage ? 'replace' : (S.cur ? 'current' : 'auto') });
});
function removeImage() {
  const cur = S.cur, old = cur.image;
  cur.image = '';
  renderImageBox(); markDirty(true);
  toast('已从这道题移除原图（图片文件仍保留在 data/images 里）', {
    action: ['撤销', () => { if (S.cur === cur) { cur.image = old; renderImageBox(); markDirty(true); } }],
  });
}

// target：auto = 粘贴/随手拖进来，除非当前是空白新题，否则新建一题；
//         current = 拖到/点了这道题自己的贴图区；replace = 换图
async function addImage(file, { target = 'auto' } = {}) {
  if (!file || !/^image\//.test(file.type)) { toast('只能放图片文件', { err: true }); return; }
  const blankDraft = S.cur && !S.cur.image && !S.cur.problem.trim() && !ideaText(S.cur).trim();
  if (!S.cur || (target === 'auto' && !blankDraft) || (target === 'current' && S.cur.image)) {
    await newNote();
  }
  const cur = S.cur;
  const fd = new FormData();
  fd.append('file', file, file.name || 'paste.png');
  let r;
  try { r = await api('/api/image', { method: 'POST', body: fd }); }
  catch (e) { toast(e.message, { err: true }); return; }
  cur.image = r.image;
  if (S.cur === cur) renderImageBox();
  S.dirty = true;
  await save();
  if (!S.settings.has_key) {
    toast('原图已保存。在「设置」里填好 DeepSeek Key，贴图后就能自动识别。', { action: ['去设置', openSettings], ms: 7000 });
  } else if (cur.problem.trim()) {  // 已经有文字的题绝不自动覆盖
    toast('原图已附上。这道题已经有文字了，要用 AI 重新识别吗？', { action: ['识别', () => recognize(cur)], ms: 8000 });
  } else {
    recognize(cur);
  }
}

// 粘贴、拖放
document.addEventListener('paste', e => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.kind === 'file' && i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  addImage(item.getAsFile());
});
let dragDepth = 0;
document.addEventListener('dragenter', e => { if (e.dataTransfer?.types?.includes('Files')) { dragDepth++; dragHint(true); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dragHint(false); } });
document.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; dragHint(false);
  const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/'));
  if (!f) return;
  const zone = e.target.closest?.('#imgBox');  // 拖到这道题的贴图区 = 给这道题配图
  addImage(f, { target: zone ? (S.cur?.image ? 'replace' : 'current') : 'auto' });
});
function dragHint(on) {
  document.querySelectorAll('.drop,.shot').forEach(el => el.classList.toggle('over', on));
}

// ------------------------------------------------------------------ AI：识别、整理、推荐关键词
function setRecognizing(on) {
  S.recognizing = on;
  $('.shot')?.classList.toggle('busy', on);
  $('#btnRecog').classList.toggle('busy', on);
  $('#btnRecog').disabled = on;
}
function aiError(e) {
  if (e.data?.need_key) toast(e.message, { err: true, action: ['去设置', openSettings] });
  else toast(e.message, { err: true });
}
async function recognize(target) {
  const cur = target || S.cur;
  if (!cur?.image) { toast('先贴一张题目的截图，再让 AI 识别'); return; }
  if (S.recognizing) return;
  setRecognizing(true);
  try {
    const r = await api('/api/recognize', { method: 'POST', body: { image: cur.image } });
    const prev = cur.problem;
    if (r.problem) cur.problem = r.problem;
    const added = mergeKeywords(cur, r.keywords);
    if (!cur.source && r.source) cur.source = r.source;
    if (S.cur === cur) {
      F.problem.value = cur.problem; F.source.value = cur.source;
      grow(F.problem); renderPreview('problem'); renderKeywords(added);
      F.problem.classList.remove('flash'); void F.problem.offsetWidth; F.problem.classList.add('flash');
      S.dirty = true; await save();
    } else {
      upsertNote(await api('/api/notes/' + cur.id, { method: 'PUT', body: payload(cur) }));
      renderNav(); renderList();
    }
    const undo = prev.trim() && prev !== cur.problem
      ? ['撤销', () => { cur.problem = prev; if (S.cur === cur) { F.problem.value = prev; grow(F.problem); renderPreview('problem'); } markDirty(true); }]
      : null;
    toast(added.length ? `识别完成，推荐了关键词：${added.join('、')}。记得对照原图检查一下` : '识别完成，记得对照原图检查一下', { action: undo, ms: 6000 });
  } catch (e) { aiError(e); }
  finally { setRecognizing(false); }
}
async function withBusy(btn, fn) {
  btn.classList.add('busy'); btn.disabled = true;
  try { await fn(); } catch (e) { aiError(e); }
  finally { btn.classList.remove('busy'); btn.disabled = false; }
}
$('#btnRecog').addEventListener('click', () => recognize());
$('#btnPolish').addEventListener('click', () => withBusy($('#btnPolish'), async () => {
  const cur = S.cur;
  if (!cur.problem.trim()) { toast('题目文字是空的，没什么可整理'); return; }
  const r = await api('/api/polish', { method: 'POST', body: { text: cur.problem } });
  if (S.cur !== cur) return;
  if (r.text.trim() === cur.problem.trim()) { toast('AI 看过了，题目格式没什么要改的'); return; }
  cur.pending.problem = r.text; renderProposal('problem');
}));

// 把一条或几条想法交给 AI：公式写成 LaTeX、顺顺文字。结果先摆在每条下面，不直接覆盖
async function tidyIdeas(list, btn) {
  const cur = S.cur;
  list = list.filter(it => it.text.trim());
  if (!list.length) { toast('想法还是空的，先写几句（口语、关键词都行）'); return; }
  await withBusy(btn, async () => {
    const results = await Promise.allSettled(list.map(it =>
      api('/api/polish', { method: 'POST', body: { kind: 'idea', text: it.text, problem: cur.problem } })));
    if (S.cur !== cur) { toast('已经换到别的题了，刚才 AI 的结果没用上'); return; }
    let changed = 0, same = 0;
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      if (r.value.text.trim() === list[i].text.trim()) { same++; return; }
      cur.pending[list[i].id] = r.value.text; changed++;
      renderProposal(list[i].id);
    });
    renderPendingBar();
    const failed = results.find(r => r.status === 'rejected');
    if (failed) aiError(failed.reason);
    if (!changed && same) toast('AI 看过了，没什么要改的');
    else if (changed) $(`.proposal-slot[data-pr-for="${list.find(it => cur.pending[it.id] !== undefined).id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}
$('#btnTidyAll').addEventListener('click', () => tidyIdeas(S.cur.ideas, $('#btnTidyAll')));
$('#btnHint').addEventListener('click', () => withBusy($('#btnHint'), async () => {
  const cur = S.cur;
  if (!cur.problem.trim()) { toast('先把题目文字填上，AI 才能给思路'); return; }
  const r = await api('/api/hint', { method: 'POST', body: { problem: cur.problem, ideas: cur.ideas.map(i => i.text).filter(t => t.trim()) } });
  if (S.cur !== cur) return;
  const it = { id: newId(), text: r.text, by: 'ai' };
  // 只有一条空白想法时直接占用它的位置
  if (cur.ideas.length === 1 && !cur.ideas[0].text.trim()) cur.ideas = [it]; else cur.ideas.push(it);
  renderIdeas(); markDirty(true);
  toast('AI 加了一条「AI 思路」，PDF 里会用灰线和你自己的想法区分开；觉得是你的可以点「算我的」');
}));
$('#btnSuggest').addEventListener('click', () => withBusy($('#btnSuggest'), async () => {
  const cur = S.cur;
  const r = await api('/api/suggest', { method: 'POST', body: { problem: cur.problem, ideas: cur.ideas.map(i => i.text) } });
  const added = mergeKeywords(cur, r.keywords);
  if (S.cur === cur) renderKeywords(added);
  if (added.length) markDirty(true);
  toast(added.length ? `加上了：${added.join('、')}` : `AI 推荐的（${r.keywords.join('、') || '无'}）都已经选上了`);
}));

// ------------------------------------------------------------------ 关键词
function mergeKeywords(n, list) {
  const added = [];
  for (const k of list || []) if (k && !n.keywords.includes(k)) { n.keywords.push(k); added.push(k); }
  return added;
}
function renderKeywords(fresh = []) {
  const cur = S.cur;
  const sel = cur.keywords.map((k, i) =>
    `<span class="kw on${fresh.includes(k) ? ' new' : ''}" data-k="${esc(k)}" title="${i ? '点一下设为第一个（决定 PDF 里的章节）' : '第一个关键词：决定它在 PDF 里归哪一章'}">` +
    `${i === 0 && cur.keywords.length > 1 ? '<b class="lead">主</b>' : ''}${esc(k)}` +
    `<button type="button" class="x" data-rm="${esc(k)}" aria-label="移除 ${esc(k)}">${ICON.x}</button></span>`).join('');
  $('#kwSel').innerHTML = sel || '<span class="kw-empty">还没选关键词：点下面的词，或者在框里打一个新词</span>';
  renderPresets();
}
// 下面的候选：边打字边筛；打的词不在列表里，就出现「新建」按钮，回车也行
function renderPresets() {
  const cur = S.cur;
  const q = $('#kwFind').value.replace(/\s+/g, ' ').trim().replace(/^[#＃]/, '');
  const ql = q.toLowerCase();
  const pool = keywordPool().filter(k => !cur.keywords.includes(k));
  const hits = q ? pool.filter(k => k.toLowerCase().includes(ql)) : pool;
  const exact = q && keywordPool().find(k => k.toLowerCase() === ql);
  let h = '';
  if (q && !exact) h += `<button type="button" class="kw create default" data-create="${esc(q)}">新建「${esc(q)}」<kbd>Enter</kbd></button>`;
  else if (q && cur.keywords.includes(exact)) h += `<span class="kw-note">「${esc(exact)}」已经选上了</span>`;
  h += hits.map(k => `<button type="button" class="kw off${k === exact ? ' default' : ''}" data-add="${esc(k)}">${esc(k)}${k === exact ? '<kbd>Enter</kbd>' : ''}</button>`).join('');
  if (q && !hits.length && exact === undefined) h += `<span class="kw-note">现有关键词里没有含「${esc(q)}」的</span>`;
  $('#kwPresets').innerHTML = h;
}
$('#kwFind').addEventListener('input', renderPresets);
$('#kwFind').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === '，' || e.key === '、') {
    e.preventDefault();
    const d = $('#kwPresets .default');
    if (d) d.click();
  } else if (e.key === 'Escape') { e.target.value = ''; renderPresets(); }
  else if (e.key === 'Backspace' && !e.target.value && S.cur.keywords.length) {
    S.cur.keywords.pop(); renderKeywords(); markDirty(true);
  }
});
$('#kwSel').addEventListener('click', e => {
  const rm = e.target.closest('[data-rm]');
  if (rm) { S.cur.keywords = S.cur.keywords.filter(k => k !== rm.dataset.rm); renderKeywords(); markDirty(true); return; }
  const chip = e.target.closest('.kw.on');
  if (chip) {
    const k = chip.dataset.k;
    if (S.cur.keywords[0] === k) return;
    S.cur.keywords = [k, ...S.cur.keywords.filter(x => x !== k)];
    renderKeywords(); markDirty(true);
    return;
  }
  if (e.target === $('#kwSel') || e.target.classList.contains('kw-empty')) $('#kwFind').focus();
});
$('#kwPresets').addEventListener('click', e => {
  const b = e.target.closest('[data-add],[data-create]');
  if (!b) return;
  if (b.dataset.create) { addCustomKeyword(b.dataset.create); return; }
  S.cur.keywords.push(b.dataset.add);
  if ($('#kwFind').value) { $('#kwFind').value = ''; $('#kwFind').focus(); }
  renderKeywords([b.dataset.add]); markDirty(true);
});
async function addCustomKeyword(raw) {
  const k = raw.replace(/\s+/g, ' ').trim().replace(/^[#＃]/, '').slice(0, 24);
  if (!k) return;
  if (!S.cur.keywords.includes(k)) S.cur.keywords.push(k);
  $('#kwFind').value = '';
  renderKeywords([k]); markDirty(true);
  $('#kwFind').focus();
  if (!(S.settings.keywords || []).includes(k)) {  // 新词存进预设，以后每道题都能直接点
    try {
      S.settings = await api('/api/settings', { method: 'POST', body: { keywords: [...S.settings.keywords, k] } });
      toast(`新建了关键词「${k}」，以后直接点就行（在「设置」里可以改名、排序、删除）`);
    } catch { /* 不影响这道题 */ }
  }
}

// ------------------------------------------------------------------ 欢迎页
function welcomeFigure() {
  const X = x => 380 + 70 * x, Y = y => 150 - 70 * y;
  const pts = [[2, 1], [1.4118, -.1765], [.5294, .2647], [.3737, -.0467], [.1401, .0701], [.0989, -.0124]];
  let grid = '';
  for (let x = 0; x <= 760; x += 35) grid += `<line class="g" x1="${x}" y1="0" x2="${x}" y2="300"/>`;
  for (let y = 10; y <= 300; y += 35) grid += `<line class="g" x1="0" y1="${y}" x2="760" y2="${y}"/>`;
  const ell = [3.6, 2.8284, 1.4553, .7487, .3852, .1982].map(c => `<ellipse cx="380" cy="150" rx="${70 * c}" ry="${35 * c}"/>`).join('');
  let segs = '';
  for (let i = 0; i < pts.length - 1; i++) segs += `<line class="${i % 2 ? 'b' : 'a'}" stroke-linecap="round" x1="${X(pts[i][0])}" y1="${Y(pts[i][1])}" x2="${X(pts[i + 1][0])}" y2="${Y(pts[i + 1][1])}"/>`;
  const dots = pts.slice(1, 4).map(p => `<circle r="4" cx="${X(p[0])}" cy="${Y(p[1])}"/>`).join('');
  return `<svg class="welcome-fig" viewBox="0 0 760 300" role="img" aria-label="等高线与最速下降折线">${grid}
    <line class="ax" x1="0" y1="150" x2="760" y2="150"/><line class="ax" x1="380" y1="0" x2="380" y2="300"/>${ell}${segs}${dots}
    <circle class="z0" r="5" cx="${X(2)}" cy="${Y(1)}"/></svg>`;
}
function renderWelcome() {
  $('#welcome').innerHTML = `
    <div class="eyebrow">PROBLEM NOTEBOOK</div>
    <h1>把题目截图贴进来</h1>
    <p class="lede">按 <kbd>Ctrl</kbd> <kbd>V</kbd> 粘贴，或者把图片拖到下面。DeepSeek 会把它转成文字和公式，原图一起存着，随时可以对照。</p>
    <div class="drop" data-pick tabindex="0">${ICON.upload}<strong>粘贴题目截图 <kbd>Ctrl</kbd><kbd>V</kbd></strong>
      <span>或拖入图片 · 点击选择文件 · 不贴图也行：点右上角「新题」直接打字</span></div>
    ${S.settings.has_key ? '' : `<div class="notice">${ICON.key}<span>还没填 DeepSeek API Key。不填也能手动录题；填上之后贴图就会自动识别。</span><button class="btn" data-settings>去设置</button></div>`}
    <div class="steps">
      <div class="step"><i>01</i><b>贴图</b><span>截图后直接 Ctrl+V，原图自动保存</span></div>
      <div class="step"><i>02</i><b>识别</b><span>AI 转成文字和 LaTeX 公式，也可以自己打</span></div>
      <div class="step"><i>03</i><b>关键词与想法</b><span>点选「特征值」「多项式」，写下你的思路</span></div>
      <div class="step"><i>04</i><b>导出</b><span>按关键词分章，生成 LaTeX 或 PDF</span></div>
    </div>
    ${welcomeFigure()}`;
}
$('#welcome').addEventListener('click', e => {
  if (e.target.closest('[data-pick]')) pickFile(false);
  if (e.target.closest('[data-settings]')) openSettings();
});

// ------------------------------------------------------------------ 搜索、新建、快捷键
$('#q').addEventListener('input', e => { S.query = e.target.value; renderList(); });
$('#btnNew').addEventListener('click', () => newNote().then(() => F.problem.focus()));
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (S.cur) $('#btnSave').click(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); $('#btnNew').click(); }
  else if (e.key === '/' && !typing) { e.preventDefault(); $('#q').focus(); }
  else if (e.key === 'Escape' && !$('#lightbox').hidden) closeLightbox();
});

// ------------------------------------------------------------------ 灯箱
function openLightbox(src) {
  const lb = $('#lightbox');
  lb.querySelector('img').src = src;
  lb.hidden = false;
}
function closeLightbox() { $('#lightbox').hidden = true; }
$('#lightbox').addEventListener('click', closeLightbox);

// ------------------------------------------------------------------ 设置
function openSettings() {
  const s = S.settings;
  $('#sKey').value = '';
  $('#sKey').placeholder = s.has_key ? `已保存 ${s.key_hint}，留空表示不改` : 'sk-...';
  $('#sKeyNote').innerHTML = s.has_key
    ? `已经填过了。要换就直接输入新的。 <a href="#" id="clearKey">清除已保存的 Key</a>`
    : '在 platform.deepseek.com 的「API Keys」页面创建，复制过来粘贴即可。';
  $('#sBase').value = s.base_url || '';
  $('#sVision').value = s.vision_model || '';
  $('#sText').value = s.text_model || '';
  $('#sKeywords').value = (s.keywords || []).join('、');
  $('#sTitle').value = s.doc_title || '';
  $('#sSubtitle').value = s.doc_subtitle || '';
  $('#sAuthor').value = s.author || '';
  $('#testResult').textContent = ''; $('#testResult').className = 'fld-note';
  $('#dlgSettings').showModal();
}
function settingsForm() {
  const body = {
    base_url: $('#sBase').value, vision_model: $('#sVision').value, text_model: $('#sText').value,
    keywords: $('#sKeywords').value.split(/[、,，;；\n]+/).map(s => s.trim()).filter(Boolean),
    doc_title: $('#sTitle').value, doc_subtitle: $('#sSubtitle').value, author: $('#sAuthor').value,
  };
  if ($('#sKey').value.trim()) body.api_key = $('#sKey').value.trim();
  return body;
}
async function saveSettings(extra = {}) {
  S.settings = await api('/api/settings', { method: 'POST', body: { ...settingsForm(), ...extra } });
  renderNav();
  if (S.cur) renderKeywords(); else renderWelcome();
}
$('#formSettings').addEventListener('submit', async e => {
  e.preventDefault();
  try { await saveSettings(); $('#dlgSettings').close(); toast('设置已保存'); }
  catch (err) { toast(err.message, { err: true }); }
});
$('#dlgSettings').addEventListener('click', async e => {
  if (e.target.id === 'clearKey') {
    e.preventDefault();
    await saveSettings({ clear_key: true });
    openSettings();
    toast('已清除 API Key');
  }
});
$('#btnTest').addEventListener('click', async () => {
  const out = $('#testResult');
  out.className = 'fld-note'; out.textContent = '正在连接…';
  try {
    await saveSettings();
    $('#sKey').value = '';
    const r = await api('/api/settings/test', { method: 'POST' });
    out.className = 'fld-note ok';
    out.textContent = `连上了（${(r.ms / 1000).toFixed(1)} 秒），模型回复：${r.reply}`;
    $('#sKey').placeholder = `已保存 ${S.settings.key_hint}，留空表示不改`;
  } catch (e) { out.className = 'fld-note err'; out.textContent = e.message; }
});
$('#btnSettings').addEventListener('click', openSettings);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

// ------------------------------------------------------------------ 导出
function segPick(id, key) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    S.exp[key] = b.dataset.v;
    for (const x of $(id).querySelectorAll('button')) x.classList.toggle('on', x === b);
    updateMiniPreview();
  });
}
segPick('#eScope', 'scope'); segPick('#eGroup', 'group'); segPick('#eLayout', 'layout');
function exportSet() {
  return S.exp.scope === 'current' ? visibleNotes() : S.notes;
}
function updateMiniPreview() {
  const set = exportSet();
  const kws = new Set(set.flatMap(n => n.keywords));
  $('#mpTitle').textContent = $('#eTitle').value || '题记';
  $('#mpSub').textContent = $('#eSubtitle').value;
  $('#mpStats').textContent = `${set.length} 题 · ${kws.size} 个关键词`;
  const focus = S.exp.scope === 'current' && !S.filter.startsWith('__') ? S.filter : '';
  $('#mpKw').textContent = S.exp.group === '1' ? (focus || set.find(n => n.keywords.length)?.keywords[0] || '关键词') : '全部题目';
}
async function openExport() {
  await flushSave();
  if (!S.notes.length) { toast('还没有题目可以导出'); return; }
  const s = S.settings;
  $('#eTitle').value = s.doc_title || '题记';
  $('#eSubtitle').value = s.doc_subtitle || '';
  const filtered = S.filter !== '__all' || S.query.trim();
  const cur = visibleNotes().length;
  S.exp.scope = filtered && cur ? 'current' : 'all';
  $('#eScope').innerHTML = `<button type="button" data-v="all" class="${S.exp.scope === 'all' ? 'on' : ''}">全部 ${S.notes.length} 题</button>` +
    (filtered && cur ? `<button type="button" data-v="current" class="${S.exp.scope === 'current' ? 'on' : ''}">当前列表「${esc(S.query.trim() ? '搜索结果' : filterLabel())}」${cur} 题</button>` : '');
  $('#expStatus').hidden = true;
  setExportBusy(false);
  updateMiniPreview();
  $('#dlgExport').showModal();
}
['#eTitle', '#eSubtitle'].forEach(id => $(id).addEventListener('input', updateMiniPreview));
$('#btnExport').addEventListener('click', openExport);
function setExportBusy(on) {
  $('#btnExportPdf').disabled = on; $('#btnExportTex').disabled = on;
}
function expStatus(kind, html) {
  const el = $('#expStatus');
  el.hidden = false;
  el.className = 'exp-status ' + kind;
  el.innerHTML = html;
}
async function doExport(format) {
  const set = exportSet();
  const focus = S.exp.scope === 'current' && !S.filter.startsWith('__') && !S.query.trim() ? S.filter : '';
  setExportBusy(true);
  expStatus('busy', `<span class="msg">${format === 'pdf' ? '正在排版 PDF…第一次要加载中文字体，可能要半分钟。' : '正在生成 LaTeX 源文件…'}</span>`);
  const t0 = Date.now();
  try {
    const r = await api('/api/export', {
      method: 'POST', body: {
        format, ids: S.exp.scope === 'current' ? set.map(n => n.id) : null, focus,
        title: $('#eTitle').value, subtitle: $('#eSubtitle').value,
        group: S.exp.group === '1', layout: S.exp.layout, images: $('#eImages').checked, open: true,
      },
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    S.lastExport = r.path;
    expStatus('ok', `<span class="msg"><b>${r.kind === 'pdf' ? '已生成并打开' : '已生成'}</b>（${secs} 秒） <span class="file">${esc(r.name)}</span></span>
      ${r.kind === 'pdf' ? '<button class="btn" data-open>再次打开</button>' : ''}
      <button class="btn" data-reveal>${r.kind === 'pdf' ? '在文件夹中显示' : '打开文件夹'}</button>`);
  } catch (e) {
    const d = e.data || {};
    expStatus('err', `<span class="msg"><b>${esc(e.message)}</b>
      ${d.detail ? `<span class="detail">${esc(d.detail)}${d.snippet ? '<br>' + esc(d.snippet) : ''}</span>` : ''}</span>
      ${d.seq ? `<button class="btn" data-goto="${d.seq}">去改 No.${pad(d.seq)}</button>` : ''}`);
  } finally { setExportBusy(false); }
}
$('#btnExportPdf').addEventListener('click', () => doExport('pdf'));
$('#btnExportTex').addEventListener('click', () => doExport('tex'));
$('#expStatus').addEventListener('click', async e => {
  if (e.target.closest('[data-open],[data-reveal]')) {
    // PDF：「在文件夹中显示」选中文件；LaTeX：直接打开导出的文件夹
    const reveal = !!e.target.closest('[data-reveal]') && S.lastExport.endsWith('.pdf');
    try { await api('/api/open', { method: 'POST', body: { path: S.lastExport, reveal } }); }
    catch (err) { toast(err.message, { err: true }); }
  }
  const g = e.target.closest('[data-goto]');
  if (g) {
    const n = S.notes.find(x => x.seq === +g.dataset.goto);
    $('#dlgExport').close();
    if (n) { S.filter = '__all'; S.query = ''; $('#q').value = ''; renderNav(); renderList(); openNote(n.id); }
  }
});

// ------------------------------------------------------------------ 窄窗口
(function narrowControls() {
  const sel = document.createElement('select');
  sel.id = 'kwSelect';
  sel.setAttribute('aria-label', '按关键词筛选');
  sel.addEventListener('change', () => setFilter(sel.value));
  $('.list-head').appendChild(sel);
  const back = document.createElement('button');
  back.className = 'btn icon back';
  back.setAttribute('aria-label', '返回列表');
  back.innerHTML = ICON.back;
  back.addEventListener('click', async () => { await flushSave(); S.cur = null; document.body.classList.remove('editing'); markActiveCard(); });
  $('.ed-head').prepend(back);
})();

// ------------------------------------------------------------------ 启动
(async function init() {
  try {
    const st = await api('/api/state');
    S.notes = st.notes; S.settings = st.settings;
  } catch (e) { toast(e.message, { err: true, ms: 60000 }); }
  renderNav(); renderList();
  const first = visibleNotes()[0];
  if (first) openNote(first.id); else renderEditor();
})();
