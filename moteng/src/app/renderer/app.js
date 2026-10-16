/* 墨誊 Moteng — renderer. Talks to the main process only through window.moteng. */
'use strict';

const api = window.moteng;
const $ = (id) => document.getElementById(id);

const state = {
  settings: null, jobs: [], selected: null, running: false, nextId: 1, engines: [],
  tab: 'layout', zoom: 0, picked: null,
};

// ------------------------------------------------------------------ helpers
function baseName(p) {
  return String(p).split(/[\\/]/).filter(Boolean).pop() || p;
}

function fileUrl(p) {
  const norm = String(p).replace(/\\/g, '/');
  const parts = norm.split('/').map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)));
  return (norm.startsWith('/') ? 'file://' : 'file:///') + parts.join('/');
}

let toastTimer = 0;
function toast(msg, ms = 3200) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}

const debounce = (fn, ms) => {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

const selectedJob = () => state.jobs.find((j) => j.id === state.selected) || null;
const L = () => state.settings.layout;
const emptyOverrides = () => ({ math: {}, heading: {}, image: {}, breakBefore: {}, hide: {}, eqNumber: {} });
const countOverrides = (o) => Object.values(o || {}).reduce((a, m) => a + Object.keys(m).length, 0);

// --------------------------------------------------------------- settings
async function setLayout(patch) {
  state.settings = await api.setSettings({ layout: { ...L(), ...patch } });
  renderPanel();
  onLayoutChanged();
}

async function setSetting(patch) {
  state.settings = await api.setSettings(patch);
  renderPanel();
}

const onLayoutChanged = () => {
  refreshPreview();
  scheduleLivePdf();
};

async function refreshEngines() {
  state.engines = await api.engines();
  const box = $('engine');
  const text = $('engine-text');
  box.classList.remove('ok', 'missing');
  if (state.engines.length) {
    box.classList.add('ok');
    text.textContent = `排版引擎：${state.engines[0].label}`;
    box.title = state.engines.map((e) => `${e.label}  ${e.path}`).join('\n');
  } else {
    box.classList.add('missing');
    text.textContent = '没有找到排版引擎，只能输出 .tex（点此指定 xelatex）';
    box.title = '可以安装 TeX Live 或 MiKTeX；也可以把输出的文件夹上传到 Overleaf 用 XeLaTeX 编译。';
  }
}

// ------------------------------------------------------------------ panel
const ACCENTS = { indigo: '#2F4F8F', teal: '#0F766E', ink: '#1F2328', crimson: '#B4232C', amber: '#B45309', violet: '#6D28D9' };

function seg(value, options, onPick) {
  return el('div', { class: 'seg' }, options.map(([v, label, title]) => el('button', { class: String(v) === String(value) ? 'on' : '', title: title || '', onclick: () => onPick(v) }, label)));
}

function select(value, options, onPick) {
  const s = el('select', { onchange: (e) => onPick(e.target.value) }, options.map(([v, label]) => el('option', { value: v, selected: String(v) === String(value) }, label)));
  return s;
}

function range(value, min, max, step, onPick, fmt = (v) => v) {
  const out = el('b', {}, fmt(value));
  const input = el('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { out.textContent = fmt(+input.value); });
  input.addEventListener('change', () => onPick(+input.value));
  return { input, out };
}

function ctl(label, control, { inline = false, hint = '', value = null } = {}) {
  return el('div', { class: `ctl${inline ? ' inline' : ''}` },
    el('div', { class: 'ctl-label' }, el('span', {}, label), value),
    control,
    hint ? el('div', { class: 'hint' }, hint) : null);
}

function check(label, checked, onPick, title = '') {
  const c = el('input', { type: 'checkbox', checked, onchange: (e) => onPick(e.target.checked) });
  return el('label', { class: 'check', title }, c, label);
}

function rangeCtl(label, value, min, max, step, onPick, fmt, hint) {
  const r = range(value, min, max, step, onPick, fmt);
  return ctl(label, r.input, { value: r.out, hint });
}

const openSections = new Set(['版式', '公式']);

function section(title, sub, body) {
  const d = el('details', { class: 'sec', open: openSections.has(title) }, el('summary', {}, title, sub ? el('span', { class: 'sec-sub' }, sub) : null), el('div', { class: 'sec-body' }, body));
  d.addEventListener('toggle', () => { if (d.open) openSections.add(title); else openSections.delete(title); });
  return d;
}

function renderPanel() {
  const s = state.settings;
  const l = s.layout;
  const job = selectedJob();
  const stats = job?.stats;
  const notes = s.style === 'notes';
  const panel = $('panel');
  const scroll = panel.scrollTop;
  const mm = (k) => el('label', {}, { top: '上', bottom: '下', left: '左', right: '右' }[k],
    el('input', { type: 'number', min: 6, max: 60, step: 1, value: l.marginMm[k], onchange: (e) => setLayout({ margins: 'custom', marginMm: { ...l.marginMm, [k]: +e.target.value } }) }), 'mm');

  const mathBatch = el('div', { class: 'math-batch' },
    [['keep', '保持原样'], ['long-display', '长公式 → 行间'], ['all-display', '全部 → 行间'], ['short-inline', '短行间 → 行内'], ['all-inline', '全部 → 行内']]
      .map(([v, label]) => el('button', { class: `mini-btn${l.mathMode === v ? ' on' : ''}`, style: l.mathMode === v ? 'border-color:var(--accent);color:var(--accent);font-weight:600' : '', onclick: () => setLayout({ mathMode: v }) }, label)));

  panel.replaceChildren(
    section('版式', notes ? '讲义体' : l.theme === 'web' ? '对话体 · 网页原貌' : '对话体 · 印刷', [
      ctl('版式', seg(s.style, [['chat', '对话体'], ['notes', '讲义体（墨经）']], (v) => setSetting({ style: v }).then(onLayoutChanged))),
      notes ? el('div', { class: 'hint' }, '讲义体使用墨经模板自己的页面、字体与标题设计；公式、图片、分页与编号设置仍然生效。') : null,
      ctl('外观', seg(l.theme, [['web', '网页原貌', '无衬线字体、KaTeX 公式字形、网页式的提问气泡与代码卡片'], ['print', '印刷书籍', '衬线正文、无衬线标题，适合打印装订']], (v) => setLayout({ theme: v }))),
    ]),
    section('页面', `${({ a4: 'A4', b5: 'B5', a5: 'A5', letter: 'Letter' })[l.paper]} · ${({ narrow: '窄边距', normal: '适中', wide: '宽边距', custom: '自定义' })[l.margins]}`, [
      ctl('纸张', seg(l.paper, [['a4', 'A4'], ['b5', 'B5'], ['a5', 'A5'], ['letter', 'Letter']], (v) => setLayout({ paper: v }))),
      ctl('页边距', seg(l.margins, [['narrow', '窄'], ['normal', '适中'], ['wide', '宽'], ['custom', '自定义']], (v) => setLayout({ margins: v }))),
      el('div', { class: 'margins4' }, ['top', 'bottom', 'left', 'right'].map(mm)),
    ]),
    section('字体', `${l.sizePt}pt`, [
      ctl('正文字号', select(l.sizePt, [[9, '9 pt（小五）'], [10, '10 pt'], [10.5, '10.5 pt（五号）'], [11, '11 pt'], [12, '12 pt（小四）'], [14, '14 pt（四号）']], (v) => setLayout({ sizePt: +v }))),
      ctl('中文字体', select(l.cjkFont, [['auto', '自动（网页原貌用黑体，印刷用宋体）'], ['song', '宋体 / 思源宋体'], ['hei', '黑体 / 微软雅黑'], ['kai', '楷体'], ['fang', '仿宋']], (v) => setLayout({ cjkFont: v }))),
      ctl('西文字体', select(l.latinFont, [['auto', '自动'], ['sans', '无衬线（Segoe UI，同网页）'], ['fira', 'Fira Sans'], ['stix', 'STIX Two（衬线）'], ['lm', 'Latin Modern（衬线）']], (v) => setLayout({ latinFont: v }))),
      ctl('数学字体', select(l.mathFont, [['auto', '自动'], ['lm', 'Latin Modern（同网页 KaTeX）'], ['stix', 'STIX Two'], ['fira', 'Fira Math（无衬线）']], (v) => setLayout({ mathFont: v }))),
      ctl('代码字体', select(l.monoFont, [['auto', '自动（Consolas）'], ['system', 'Consolas'], ['fira', 'Fira Mono'], ['lm', 'Latin Modern Mono']], (v) => setLayout({ monoFont: v }))),
    ]),
    section('段落', `行距 ${l.lineSpread.toFixed(2)}`, [
      rangeCtl('行距（倍）', l.lineSpread, 1, 2.4, 0.05, (v) => setLayout({ lineSpread: v }), (v) => (+v).toFixed(2)),
      rangeCtl('段间距（行）', l.parSkip, 0, 2, 0.05, (v) => setLayout({ parSkip: v }), (v) => (+v).toFixed(2)),
      ctl('', check('首行缩进两字', l.parIndent, (v) => setLayout({ parIndent: v })), { inline: true }),
    ]),
    section('标题', ({ auto: '自动编号', none: '不编号', arabic: '1. / 1.1', chinese: '一、/（一）' })[l.headingNumbers], [
      ctl('编号', seg(l.headingNumbers, [['auto', '自动'], ['none', '不编号'], ['arabic', '1.1'], ['chinese', '一、']], (v) => setLayout({ headingNumbers: v })), { hint: '标题里已经写了“一、”“1.”等编号的，不会重复编号。' }),
      ctl('层级整体调整', seg(l.headingShift, [[-1, '升一级'], [0, '不变'], [1, '降一级'], [2, '降两级']], (v) => setLayout({ headingShift: +v }))),
      rangeCtl('标题字号（倍）', l.headingScale, 0.7, 1.4, 0.05, (v) => setLayout({ headingScale: v }), (v) => (+v).toFixed(2)),
    ]),
    section('公式', `${stats ? `行内 ${stats.inlineMath} · 行间 ${stats.displayMath}` : ''}`, [
      ctl('批量转换', mathBatch, { hint: stats ? `长行内公式 ${stats.longInline} 个，短行间公式 ${stats.shortDisplay} 个。也可以在预览里点击单个公式切换。` : '在预览里点击单个公式，可以只转换它。' }),
      rangeCtl('“长公式”阈值（TeX 字符数）', l.longMath, 8, 120, 1, (v) => setLayout({ longMath: v })),
      ctl('公式编号', seg(l.eqNumbers, [['none', '不编号'], ['all', '全部行间公式'], ['tagged', '只保留原有 \\tag']], (v) => setLayout({ eqNumbers: v }))),
      ctl('', check('编号按问题分节，如 (2.3)', l.eqWithinSection, (v) => setLayout({ eqWithinSection: v })), { inline: true }),
    ]),
    section('图片与动态内容', `${Math.round(l.imageWidth * 100)}%`, [
      rangeCtl('图片默认最大宽度', l.imageWidth, 0.15, 1, 0.05, (v) => setLayout({ imageWidth: v }), (v) => `${Math.round(v * 100)}%`, '小图保持原大小；点击预览中的图片可以单独设置宽度。'),
      rangeCtl('图片最大高度（占版心）', l.imageMaxHeight, 0.15, 0.9, 0.05, (v) => setLayout({ imageMaxHeight: v }), (v) => `${Math.round(v * 100)}%`),
      ctl('图表与交互组件', seg(l.dynamic, [['image', '截图'], ['both', '截图＋文字'], ['text', '只要文字']], (v) => setLayout({ dynamic: v })), { hint: job?.info?.dynamic ? `这段对话有 ${job.info.dynamic} 处图表或交互组件，已截取 ${job.info.captured} 处。导出的 HTML 里图表保留为矢量图。` : '图表、示意图、滑块卡片等按保存网页时的样子截图。' }),
    ]),
    section('分页与页眉', '', [
      ctl('', check('每个问题从新的一页开始', l.questionNewPage, (v) => setLayout({ questionNewPage: v })), { inline: true }),
      ctl('', check('页码', l.pageNumbers, (v) => setLayout({ pageNumbers: v })), { inline: true }),
      ctl('', check('页眉显示标题', l.runningHeader, (v) => setLayout({ runningHeader: v })), { inline: true }),
      ctl('目录', seg(l.toc, [['auto', '自动'], ['on', '总是'], ['off', '不要']], (v) => setLayout({ toc: v }))),
      el('div', { class: 'hint' }, '在预览里点击任一段落，可以在它前面插入分页。'),
    ]),
    section('配色', '', [
      ctl('强调色', el('div', { class: 'swatches' }, Object.entries(ACCENTS).map(([k, c]) => el('button', { class: l.accent === k ? 'on' : '', style: `background:${c}`, title: k, onclick: () => setLayout({ accent: k }) })))),
      ctl('提问样式', seg(l.questionStyle, [['bubble', '网页气泡'], ['box', '色块'], ['plain', '无框']], (v) => setLayout({ questionStyle: v }))),
      ctl('', check('气泡沿用网页里的配色', l.followPage, (v) => setLayout({ followPage: v }), '读取保存网页时提问气泡的颜色'), { inline: true, hint: job?.info?.pageColors?.bubbleBg ? `网页气泡颜色：${job.info.pageColors.bubbleBg}` : '' }),
      ctl('代码块', seg(l.codeTheme, [['light', '浅色'], ['dark', '深色']], (v) => setLayout({ codeTheme: v }))),
    ]),
    section('内容与输出', '', [
      ctl('', check('包含提问', s.includeQuestions, (v) => setSetting({ includeQuestions: v }).then(onLayoutChanged)), { inline: true }),
      ctl('', check('包含思考过程（重新读取后生效）', s.includeThinking, (v) => setSetting({ includeThinking: v })), { inline: true }),
      ctl('', check('联网取图片', s.fetchImages, (v) => setSetting({ fetchImages: v })), { inline: true }),
      ctl('', check('导出 PDF 时同时导出交互式 HTML', s.exportHtml, (v) => setSetting({ exportHtml: v })), { inline: true }),
      ctl('', check('PDF 预览随改动自动重新编译', s.livePdf, (v) => setSetting({ livePdf: v })), { inline: true }),
      ctl('', check('完成后打开 PDF', s.openAfter, (v) => setSetting({ openAfter: v })), { inline: true }),
    ]),
    section('软件更新', '', [
      el('div', { class: 'hint', id: 'update-text' }, ''),
      el('div', { class: 'ctl inline' }, check('自动检查', s.autoUpdate, (v) => setSetting({ autoUpdate: v })), el('button', { class: 'mini-btn', id: 'update-check' }, '检查更新')),
    ]),
    el('div', { class: 'panel-actions' }, el('button', { class: 'mini-btn', onclick: resetLayout }, '恢复默认排版')),
  );
  panel.scrollTop = scroll;
  bindUpdateControls();
}

async function resetLayout() {
  state.settings = await api.setSettings({ layout: { __reset: true } });
  renderPanel();
  onLayoutChanged();
}

// --------------------------------------------------------------------- jobs
function statusLine(job) {
  switch (job.status) {
    case 'inspecting': return ['', job.detail || '正在读取…'];
    case 'ready': return ['', job.result ? '已修改，可重新导出' : '可以预览和导出'];
    case 'running': return ['', job.detail || '转换中…'];
    case 'done': return [job.result.warnings.length ? 'warn' : 'done', job.result.pdfPath ? `完成 · ${job.result.style === 'notes' ? '讲义体' : '对话体'}${job.result.warnings.length ? ` · ${job.result.warnings.length} 条提示` : ''}` : '已生成 .tex（没有编译 PDF）'];
    case 'failed': return ['failed', job.error || '失败'];
    case 'invalid': return ['failed', job.error || '无法读取'];
    default: return ['', ''];
  }
}

function renderQueue() {
  const ul = $('queue');
  ul.replaceChildren(...state.jobs.map((job) => {
    const [cls, text] = statusLine(job);
    const info = job.info;
    const src = job.path ? baseName(job.path) : '剪贴板';
    const meta = info ? [`${info.turns} 轮问答`, info.dynamic ? `${info.dynamic} 处图表/组件` : '', src].filter(Boolean).join(' · ') : src;
    const actions = [];
    if (job.status === 'done') {
      if (job.result.pdfPath) actions.push(el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); api.openPath(job.result.pdfPath); } }, '打开 PDF'));
      if (job.result.htmlPath) actions.push(el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); api.openPath(job.result.htmlPath); } }, '打开 HTML'));
      actions.push(el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); api.showInFolder(job.result.texPath); } }, '文件夹'));
    }
    if (job.status === 'failed') actions.push(el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); job.status = 'ready'; render(); runQueue([job]); } }, '重试'));
    return el('li', { class: `job${state.selected === job.id ? ' sel' : ''}`, onclick: () => selectJob(job.id) },
      el('div', { class: 'job-top' },
        info ? el('span', { class: 'badge' }, info.platform) : null,
        el('span', { class: 'job-title', title: info?.title || job.name }, info?.title || job.name),
        job.status === 'running' ? null : el('button', { class: 'job-x', title: '移除', onclick: (e) => { e.stopPropagation(); removeJob(job.id); } }, '×')),
      el('div', { class: 'job-meta', title: job.path || '' }, meta),
      el('div', { class: `job-status ${cls}` }, text),
      job.status === 'running' || job.status === 'inspecting' ? el('div', { class: 'bar' }, el('i')) : null,
      actions.length ? el('div', { class: 'job-actions' }, actions) : null);
  }));
  const runnable = state.jobs.some((j) => j.status === 'ready');
  $('run').disabled = state.running || !runnable;
  $('run').textContent = state.running ? '转换中…' : '全部转换';
  $('count').textContent = state.jobs.length ? `${state.jobs.length}` : '';
}

function render() {
  renderQueue();
  renderCenter();
}

function selectJob(id) {
  if (state.selected === id) return;
  state.selected = id;
  hideToolbar();
  render();
  renderPanel();
  refreshPreview();
  if (state.tab === 'pdf') scheduleLivePdf(0);
}

function removeJob(id) {
  const job = state.jobs.find((j) => j.id === id);
  if (job && job.prepared) api.closeJob(id);
  state.jobs = state.jobs.filter((j) => j.id !== id);
  if (state.selected === id) state.selected = state.jobs.at(-1)?.id ?? null;
  render();
  renderPanel();
  refreshPreview();
}

async function addJob(job) {
  job.id = state.nextId++;
  job.overrides = emptyOverrides();
  job.status = job.error ? 'invalid' : 'inspecting';
  state.jobs.push(job);
  const first = state.selected === null || !state.jobs.some((j) => j.id === state.selected);
  if (first) state.selected = job.id;
  render();
  if (job.error) return;
  const r = await api.prepare({ id: job.id, input: job.input, html: job.html, name: job.name, url: job.url });
  if (r.ok) {
    job.info = r.info;
    job.prepared = true;
    job.status = r.info.messages ? 'ready' : 'invalid';
    if (!r.info.messages) job.error = '没有找到对话内容';
  } else {
    job.status = 'invalid';
    job.error = r.error;
  }
  render();
  if (state.selected === job.id) { renderPanel(); refreshPreview(); }
}

async function addPaths(paths) {
  if (!paths.length) return;
  const r = await api.expand(paths);
  if (!r.ok) { toast(r.error); return; }
  if (!r.items.length) { toast('没有找到可转换的文件'); return; }
  if (r.items.length > 1) toast(`加入 ${r.items.length} 段对话`);
  for (const it of r.items) {
    const key = `${it.path}#${it.index ?? ''}`;
    if (state.jobs.some((j) => j.key === key && j.status !== 'done')) continue;
    // Prepare one after another: each reads its page and renders snapshots.
    await addJob({ key, path: it.path, input: it.index !== undefined ? { path: it.path, index: it.index } : it.path, name: it.name || baseName(it.path), error: it.error });
  }
}

function jobPayload(job) {
  return { id: job.id, path: job.path, input: job.input, html: job.html, name: job.name, style: state.settings.style, layout: L(), overrides: job.overrides };
}

async function runQueue(list = null) {
  if (state.running) return;
  state.running = true;
  render();
  try {
    for (;;) {
      const job = (list || state.jobs).find((j) => j.status === 'ready');
      if (!job) break;
      await exportJob(job);
      if (list) list = list.filter((j) => j !== job);
    }
  } finally {
    state.running = false;
    render();
  }
}

async function exportJob(job) {
  job.status = 'running';
  job.detail = '';
  render();
  const r = await api.convert(jobPayload(job));
  if (r.ok) {
    job.status = 'done';
    job.result = r.result;
    if (r.result.pdfPath) toast(`已导出：${baseName(r.result.pdfPath)}`);
  } else {
    job.status = 'failed';
    job.error = r.error;
    job.log = r.log;
  }
  render();
}

// --------------------------------------------------------------- center pane
function renderCenter() {
  const job = selectedJob();
  const ready = job && job.prepared && job.status !== 'invalid';
  $('guide').hidden = !!job;
  $('preview-head').hidden = !job;
  $('stage').hidden = !ready || state.tab !== 'layout';
  $('pdf-pane').hidden = !ready || state.tab !== 'pdf';
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  const box = $('result-box');
  box.hidden = true;
  box.className = 'result-box';
  if (!job) return;
  $('preview-title').textContent = job.info?.title || job.name;
  $('export-pdf').disabled = !ready || job.status === 'running' || state.running;
  $('export-html').disabled = !ready;
  $('export-pdf').textContent = job.status === 'running' ? '导出中…' : '导出 PDF';
  const n = countOverrides(job.overrides);
  $('adjusted').hidden = !n;
  $('adjusted').replaceChildren(`已单独调整 ${n} 处`, el('button', { onclick: () => { job.overrides = emptyOverrides(); onLayoutChanged(); render(); } }, '全部恢复'));
  const warn = $('warnings');
  const warnings = job.result?.warnings || job.info?.warnings || [];
  warn.hidden = !warnings.length || !ready;
  warn.replaceChildren(...warnings.map((w) => el('div', {}, w)));
  if (job.status === 'invalid' || job.status === 'failed') {
    box.hidden = false;
    box.classList.add('bad');
    box.replaceChildren(el('b', {}, job.status === 'invalid' ? '无法读取：' : '导出失败：'), job.error || '', job.log ? el('pre', {}, job.log) : null);
  } else if (job.status === 'done' && job.result) {
    box.hidden = false;
    const r = job.result;
    box.replaceChildren(el('b', {}, '已导出'),
      r.pdfPath ? el('button', { class: 'btn small', onclick: () => api.openPath(r.pdfPath) }, '打开 PDF') : el('span', {}, '没有找到排版引擎，只生成了 main.tex'),
      r.htmlPath ? el('button', { class: 'btn small', onclick: () => api.openPath(r.htmlPath) }, '打开 HTML') : null,
      el('button', { class: 'btn small', onclick: () => api.openPath(r.texPath) }, '打开 .tex'),
      el('button', { class: 'btn small', onclick: () => api.showInFolder(r.texPath) }, '打开文件夹'));
  }
}

// -------------------------------------------------------------- live preview
let previewSeq = 0;
async function refreshPreview() {
  const job = selectedJob();
  if (!job || !job.prepared) return;
  const seq = ++previewSeq;
  const r = await api.preview({ id: job.id, layout: L(), overrides: job.overrides, includeQuestions: state.settings.includeQuestions });
  if (seq !== previewSeq) return;
  if (!r.ok) { toast(r.error); return; }
  job.stats = r.stats;
  $('mt-vars').textContent = r.css;
  const doc = $('doc');
  doc.className = `mt-doc theme-${r.layout.theme} code-${r.layout.codeTheme}`;
  doc.innerHTML = r.html;
  if (state.picked) {
    const again = doc.querySelector(`[data-oid="${CSS.escape(state.picked)}"]`);
    if (again) again.classList.add('is-picked');
  }
  applyZoom();
  requestAnimationFrame(markPages);
  renderPanelStatsOnly();
}

// Stats change with the document; keep the open panel in sync without losing focus.
const renderPanelStatsOnly = debounce(() => {
  if (document.activeElement && document.activeElement.closest('#panel') && /^(INPUT|SELECT)$/.test(document.activeElement.tagName)) return;
  renderPanel();
}, 300);

// Estimated automatic page ends along the right edge (TeX breaks a little differently).
function markPages() {
  const paper = $('paper');
  const marks = $('page-marks');
  const cs = getComputedStyle(document.documentElement);
  const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
  const pageH = px('--mt-page-h');
  const body = pageH - px('--mt-mt') - px('--mt-mb');
  if (!body) { marks.replaceChildren(); return; }
  const top = px('--mt-mt');
  const height = paper.scrollHeight - top - px('--mt-mb');
  const out = [];
  // Explicit breaks restart the count.
  const docTop = paper.getBoundingClientRect().top;
  const scale = state.zoomScale || 1;
  const breaks = [...paper.querySelectorAll('.mt-pagebreak')].map((b) => (b.getBoundingClientRect().top - docTop) / scale - top);
  let start = 0;
  let page = 1;
  const stops = [...breaks, height];
  for (const stop of stops) {
    for (let y = start + body; y < stop - 20; y += body) {
      page++;
      out.push(el('div', { style: `top:${(top + y).toFixed(0)}px` }, `≈ 第 ${page} 页`));
    }
    if (stop !== height) page++;
    start = stop;
  }
  marks.replaceChildren(...out);
}

function applyZoom() {
  const wrap = $('paper-wrap');
  const scroll = $('paper-scroll');
  const pageW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mt-page-w')) || 794;
  let scale = state.zoom === 0 ? Math.min(1.4, (scroll.clientWidth - 120) / pageW) : state.zoom;
  scale = Math.max(0.3, Math.min(2.5, scale || 1));
  state.zoomScale = scale;
  wrap.style.transform = `scale(${scale})`;
  wrap.style.marginBottom = `${(scale - 1) * wrap.offsetHeight}px`;
  $('zoom-text').textContent = `${Math.round(scale * 100)}%`;
}

// ------------------------------------------------------------ element toolbar
function hideToolbar() {
  $('toolbar').hidden = true;
  state.pickedNode = null;
  document.querySelectorAll('.mt-doc .is-picked').forEach((e) => e.classList.remove('is-picked'));
  state.picked = null;
}

function setOverride(kind, oid, value) {
  const job = selectedJob();
  if (!job) return;
  const map = job.overrides[kind];
  if (value === undefined || value === null) delete map[oid];
  else map[oid] = value;
  onLayoutChanged();
  render();
}

function pickTarget(target) {
  return target.closest('.mt-m') || target.closest('.mt-dm') || target.closest('.mt-h') || target.closest('.mt-img') || target.closest('.mt-pagebreak')
    || target.closest('.mt-code, .mt-table-wrap, .mt-quote, .mt-note, .mt-list > li > .mt-p, .mt-p, .mt-list');
}

function showToolbar(node, ev) {
  const job = selectedJob();
  const oid = node.dataset.oid || '';
  if (!job || !oid) return;
  hideToolbar();
  state.picked = oid;
  node.classList.add('is-picked');
  const o = job.overrides;
  const rows = [];
  const title = (t) => el('div', { class: 'tb-title' }, el('span', {}, t), el('button', { class: 'tb-x', title: '关闭', onclick: hideToolbar }, '×'));
  const btn = (label, onclick, on = false, tip = '') => el('button', { class: on ? 'on' : '', title: tip, onclick }, label);
  const breakRow = (key) => el('div', { class: 'tb-row' },
    btn(o.breakBefore[key] ? '取消此前的分页' : '在此前分页', () => setOverride('breakBefore', key, o.breakBefore[key] ? null : true)),
    btn(o.hide[key] ? '显示' : '不输出这一段', () => setOverride('hide', key, o.hide[key] ? null : true), false, '从 PDF 和 HTML 里去掉这一段'));
  if (node.classList.contains('mt-m')) {
    const tex = node.dataset.tex;
    const moved = !!node.dataset.moved;
    rows.push(title(moved ? '行内公式（由行间公式转来）' : '行内公式'), el('div', { class: 'tb-tex' }, tex),
      el('div', { class: 'tb-row' },
        // Undo the user's own move first, so the batch rule (if any) applies again.
        btn(moved ? '恢复为行间公式' : '转为行间公式', () => { hideToolbar(); setOverride('math', oid, o.math[oid] === 'inline' ? null : 'display'); }),
        o.math[oid] ? btn('恢复原样', () => { hideToolbar(); setOverride('math', oid, null); }) : null,
        btn('复制 TeX', () => { navigator.clipboard.writeText(tex); toast('已复制 TeX'); })));
  } else if (node.classList.contains('mt-dm')) {
    const tex = node.dataset.tex;
    const moved = !!node.dataset.moved;
    const numbered = o.eqNumber[oid] ?? (L().eqNumbers === 'all');
    rows.push(title(moved ? '行间公式（由行内公式转来）' : '行间公式'), el('div', { class: 'tb-tex' }, tex),
      el('div', { class: 'tb-row' },
        btn(moved ? '恢复为行内公式' : '转为行内公式', () => { hideToolbar(); setOverride('math', oid, o.math[oid] === 'display' ? null : 'inline'); }),
        btn(numbered ? '去掉编号' : '编号', () => setOverride('eqNumber', oid, !numbered)),
        o.math[oid] || o.eqNumber[oid] !== undefined ? btn('恢复原样', () => { hideToolbar(); const job2 = selectedJob(); delete job2.overrides.eqNumber[oid]; setOverride('math', oid, null); }) : null,
        btn('复制 TeX', () => { navigator.clipboard.writeText(tex); toast('已复制 TeX'); })),
      breakRow(oid));
  } else if (node.classList.contains('mt-h')) {
    const lvl = +node.dataset.level || 1;
    rows.push(title(`标题 · ${lvl} 级`),
      el('div', { class: 'tb-row' }, [1, 2, 3, 4].map((n) => btn(`${n} 级`, () => setOverride('heading', oid, n), n === lvl && !!o.heading[oid])), btn('改为正文', () => { hideToolbar(); setOverride('heading', oid, 0); }), o.heading[oid] !== undefined ? btn('恢复', () => setOverride('heading', oid, null)) : null),
      breakRow(oid));
  } else if (node.classList.contains('mt-img')) {
    const cur = +(node.dataset.width || 0);
    const r = el('input', { type: 'range', min: 10, max: 100, step: 5, value: Math.round((cur || L().imageWidth) * 100) });
    const label = el('span', {}, `${r.value}%`);
    r.addEventListener('input', () => { label.textContent = `${r.value}%`; const img = node.querySelector('img, svg'); if (img) { img.style.width = `${r.value}%`; img.style.maxWidth = '100%'; img.style.maxHeight = 'none'; } });
    r.addEventListener('change', () => setOverride('image', oid, +r.value / 100));
    rows.push(title(node.classList.contains('mt-dyn') ? '图表 / 交互组件截图' : '图片'),
      el('div', { class: 'tb-row' }, el('span', {}, '宽度'), r, label),
      el('div', { class: 'tb-row' }, [30, 50, 75, 100].map((n) => btn(`${n}%`, () => setOverride('image', oid, n / 100), Math.round(cur * 100) === n)), cur ? btn('恢复', () => setOverride('image', oid, null)) : null),
      breakRow(oid));
  } else if (node.classList.contains('mt-pagebreak')) {
    rows.push(title('分页'), el('div', { class: 'tb-row' }, btn('去掉这个分页', () => { hideToolbar(); setOverride('breakBefore', oid, null); })));
    if (!o.breakBefore[oid]) rows.pop(), rows.push(title('分页（来自“每个问题新页”设置）'));
  } else {
    rows.push(title({ 'mt-code': '代码块', 'mt-table-wrap': '表格', 'mt-quote': '引用', 'mt-note': '提示框', 'mt-list': '列表' }[[...node.classList].find((c) => /^mt-(code|table-wrap|quote|note|list)$/.test(c))] || '段落'), breakRow(oid));
  }
  const tb = $('toolbar');
  tb.replaceChildren(...rows.filter(Boolean));
  tb.hidden = false;
  state.pickedNode = node;
  state.pickedX = ev ? ev.clientX : null;
  positionToolbar();
}

// The toolbar follows its element while the page scrolls; it closes when the element leaves the view.
function positionToolbar() {
  const tb = $('toolbar');
  const node = state.pickedNode;
  if (tb.hidden || !node) return;
  if (!document.body.contains(node)) { hideToolbar(); return; }
  const stage = $('stage').getBoundingClientRect();
  const r = node.getBoundingClientRect();
  if (r.bottom < stage.top || r.top > stage.bottom) { hideToolbar(); return; }
  const x = Math.min(stage.width - tb.offsetWidth - 10, Math.max(10, (state.pickedX ?? r.left) - stage.left - 40));
  let y = r.bottom + 8 - stage.top;
  if (y + tb.offsetHeight > stage.height - 10) y = r.top - tb.offsetHeight - 8 - stage.top;
  y = Math.max(10, Math.min(stage.height - tb.offsetHeight - 10, y));
  tb.style.left = `${x}px`;
  tb.style.top = `${y}px`;
}

// ------------------------------------------------------------------ live PDF
let liveTimer = 0;
let liveSeq = 0;
function scheduleLivePdf(delay = 1200) {
  const job = selectedJob();
  if (!job || !job.prepared || !state.engines.length) return;
  if (!state.settings.livePdf && state.tab !== 'pdf') return;
  if (state.tab !== 'pdf' && !state.settings.livePdf) return;
  clearTimeout(liveTimer);
  setPdfState(job, '待更新');
  liveTimer = setTimeout(() => runLivePdf(job), delay);
}

function setPdfState(job, text, bad = false) {
  job.pdfState = text;
  if (selectedJob() !== job) return;
  $('pdf-state').textContent = text ? `· ${text}` : '';
  const st = $('pdf-status');
  st.textContent = bad ? text : text === '已更新' ? 'TeX 实际排出的 PDF（与导出的文件相同）。' : `PDF ${text}…`;
  st.classList.toggle('bad', bad);
}

async function runLivePdf(job) {
  const seq = ++liveSeq;
  setPdfState(job, '编译中');
  const r = await api.livePdf(jobPayload(job));
  if (seq !== liveSeq || r.stale) return;
  if (!r.ok) { setPdfState(job, `编译失败：${r.error}`, true); return; }
  job.livePdf = r.result.pdfPath;
  setPdfState(job, '已更新');
  if (selectedJob() === job) showPdf(job);
}

function showPdf(job) {
  const frame = $('pdf');
  if (!job.livePdf) { frame.removeAttribute('src'); delete frame.dataset.src; return; }
  const src = `${fileUrl(job.livePdf)}#view=FitH&t=${Date.now()}`;
  frame.src = src;
}

// -------------------------------------------------------------- page hooks
// Called by the main process: decode an image Chromium understands, return PNG (base64).
window.__motengToPng = async (b64, mime) => {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const w = img.naturalWidth || 800;
    const h = img.naturalHeight || 600;
    const scale = Math.min(1, 2400 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c.toDataURL('image/png').split(',')[1];
  } catch {
    return null;
  }
};

// Self-test: show finished results so the CI screenshot has something to look at.
window.__motengSelfTestShow = async (items) => {
  for (const it of items) {
    await addPaths([it.input]);
  }
  state.selected = state.jobs[0]?.id ?? null;
  render();
  renderPanel();
  await refreshPreview();
  return { jobs: state.jobs.length, doc: $('doc').innerHTML.length, maths: document.querySelectorAll('#doc .katex').length };
};

// ------------------------------------------------------------------- updates
let lastUpdate = null;
function showUpdate(u) {
  if (!u) return;
  lastUpdate = u;
  const text = u.state === 'disabled' ? `自动更新不可用：${u.reason || ''}`
    : u.state === 'checking' ? '正在检查…'
    : u.state === 'downloading' ? `正在下载 ${u.version || ''}（${u.percent || 0}%）`
    : u.state === 'ready' ? `${u.version} 已下载，重启后生效；关闭软件时也会自动安装`
    : u.state === 'none' ? `${u.current}，已是最新版本`
    : u.state === 'error' ? `检查失败：${u.error}` : `当前版本 ${u.current}`;
  const t = $('update-text');
  if (t) { t.textContent = text; t.title = text; }
  const btn = $('update-check');
  if (btn) {
    btn.disabled = u.state === 'disabled' || u.state === 'checking' || u.state === 'downloading';
    btn.textContent = u.state === 'ready' ? '重启并更新' : '检查更新';
  }
  const ready = $('update-ready');
  ready.hidden = u.state !== 'ready';
  ready.textContent = `新版本 ${u.version || ''} 已下载 · 重启更新`;
}

function bindUpdateControls() {
  const btn = $('update-check');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (lastUpdate?.state === 'ready') { api.installUpdate(); return; }
    const u = await api.checkUpdate();
    showUpdate(u);
    if (u.state === 'none') toast('已是最新版本');
  });
  if (lastUpdate) showUpdate(lastUpdate);
}

function initUpdates() {
  api.updateStatus().then(showUpdate).catch(() => {});
  api.onUpdateStatus(showUpdate);
  $('update-ready').addEventListener('click', () => api.installUpdate());
}

// ------------------------------------------------------------------- wiring
async function init() {
  state.settings = await api.getSettings();
  renderPanel();
  initUpdates();
  const showOut = () => { $('outRoot').textContent = state.settings.outRoot; $('outRoot').title = state.settings.outRoot; };
  showOut();

  $('pickOut').addEventListener('click', async () => {
    const p = await api.pickFolder('out');
    if (p) { state.settings = await api.setSettings({ outRoot: p }); showOut(); }
  });
  $('pick').addEventListener('click', async () => addPaths(await api.pickFiles()));
  $('pick-folder').addEventListener('click', async () => addPaths(await api.pickFolders()));
  $('paste').addEventListener('click', async () => {
    const c = await api.clipboardHtml();
    if (!c.html) {
      toast('剪贴板里没有网页内容。请在聊天页面选中对话后按 Ctrl+C 复制。');
      return;
    }
    const now = new Date();
    await addJob({ html: c.html, name: `剪贴板 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}` });
  });
  $('run').addEventListener('click', () => runQueue());
  $('clear').addEventListener('click', () => {
    for (const j of state.jobs.filter((x) => x.status === 'done')) api.closeJob(j.id);
    state.jobs = state.jobs.filter((j) => j.status !== 'done');
    if (!state.jobs.some((j) => j.id === state.selected)) state.selected = state.jobs[0]?.id ?? null;
    render();
    refreshPreview();
  });
  $('engine').addEventListener('click', async () => {
    if (state.engines.length) return;
    const p = await api.pickEngine();
    if (p) { state.settings = await api.setSettings({ enginePath: p }); await refreshEngines(); }
  });
  $('export-pdf').addEventListener('click', () => { const j = selectedJob(); if (j && j.status !== 'running') { if (j.status === 'done') j.status = 'ready'; runQueue([j]); } });
  $('export-html').addEventListener('click', async () => {
    const j = selectedJob();
    if (!j) return;
    const r = await api.exportHtml(jobPayload(j));
    if (r.ok) { toast(`已导出：${baseName(r.path)}`); api.showInFolder(r.path); } else if (!r.canceled) toast(r.error);
  });
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab;
    hideToolbar();
    renderCenter();
    const j = selectedJob();
    if (state.tab === 'pdf' && j) { if (j.livePdf) showPdf(j); if (!j.livePdf || j.pdfState === '待更新') scheduleLivePdf(0); setPdfState(j, j.pdfState || ''); }
    if (state.tab === 'layout') applyZoom();
  });
  $('zoom-bar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const z = +b.dataset.z;
    const cur = state.zoomScale || 1;
    state.zoom = z === 0 ? 0 : Math.max(0.3, Math.min(2.5, Math.round((cur + z * 0.1) * 10) / 10));
    applyZoom();
  });
  window.addEventListener('resize', debounce(() => { applyZoom(); markPages(); }, 120));
  $('doc').addEventListener('click', (e) => {
    if (e.target.closest('a')) e.preventDefault();
    if (getSelection().toString()) return;
    const node = pickTarget(e.target);
    if (node) { e.stopPropagation(); showToolbar(node, e); } else hideToolbar();
  });
  $('paper-scroll').addEventListener('scroll', () => requestAnimationFrame(positionToolbar));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideToolbar(); });

  // Drag and drop anywhere in the window.
  const drop = $('drop');
  let depth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; drop.classList.add('over'); });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('over'); });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0;
    drop.classList.remove('over');
    const paths = [...(e.dataTransfer?.files || [])].map((f) => api.pathForFile(f)).filter(Boolean);
    if (paths.length) await addPaths(paths);
    else {
      const html = e.dataTransfer?.getData('text/html');
      if (html) await addJob({ html, name: '拖入的内容' });
    }
  });
  document.addEventListener('paste', async (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const html = e.clipboardData?.getData('text/html');
    if (html) await addJob({ html, name: '粘贴的内容' });
  });

  api.onProgress(({ id, detail, live }) => {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;
    if (live) { setPdfState(job, detail || '编译中'); return; }
    if (job.status === 'running' || job.status === 'inspecting') { job.detail = detail; renderQueue(); }
  });
  api.onAddFiles((files) => addPaths(files));

  await refreshEngines();
  const pending = await api.pendingFiles();
  if (pending.length) await addPaths(pending);
  render();
}

init();
