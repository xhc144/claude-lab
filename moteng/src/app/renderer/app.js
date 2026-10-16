/* 墨誊 Moteng — renderer. Talks to the main process only through window.moteng. */
'use strict';

const api = window.moteng;
const $ = (id) => document.getElementById(id);

const state = { settings: null, jobs: [], selected: null, running: false, nextId: 1, engines: [] };

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

// ----------------------------------------------------------------- settings
function bindSeg(id) {
  const seg = $(id);
  const paint = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.settings[id]));
  seg.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.settings = await api.setSettings({ [id]: b.dataset.v });
    paint();
  });
  paint();
}

function bindCheck(id) {
  const c = $(id);
  c.checked = !!state.settings[id];
  c.addEventListener('change', async () => { state.settings = await api.setSettings({ [id]: c.checked }); });
}

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

// --------------------------------------------------------------------- jobs
function statusLine(job) {
  switch (job.status) {
    case 'inspecting': return ['', '正在读取…'];
    case 'ready': return ['', '等待转换'];
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
    const meta = info ? [info.platform, `${info.turns} 轮问答`, job.path ? baseName(job.path) : '剪贴板'].filter(Boolean).join(' · ') : (job.path || '');
    const actions = [];
    if (job.status === 'done') {
      if (job.result.pdfPath) actions.push(el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); api.openPath(job.result.pdfPath); } }, '打开 PDF'));
      actions.push(el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); api.showInFolder(job.result.texPath); } }, '打开文件夹'));
      const other = job.result.style === 'notes' ? 'chat' : 'notes';
      actions.push(el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); job.style = other; job.status = 'ready'; job.result = null; render(); runQueue(); } }, other === 'notes' ? '改用讲义体' : '改用对话体'));
    }
    if (job.status === 'failed') actions.push(el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); job.status = 'ready'; render(); runQueue(); } }, '重试'));
    return el('li', { class: `job${state.selected === job.id ? ' sel' : ''}`, onclick: () => { state.selected = job.id; render(); } },
      el('div', { class: 'job-top' },
        info ? el('span', { class: 'badge' }, info.platform) : null,
        el('span', { class: 'job-title', title: info?.title || job.name }, info?.title || job.name),
        job.status === 'running' ? null : el('button', { class: 'job-x', title: '移除', onclick: (e) => { e.stopPropagation(); removeJob(job.id); } }, '×')),
      el('div', { class: 'job-meta', title: job.path || '' }, meta),
      el('div', { class: `job-status ${cls}` }, text),
      job.status === 'running' ? el('div', { class: 'bar' }, el('i')) : null,
      actions.length ? el('div', { class: 'job-actions' }, actions) : null);
  }));
  const runnable = state.jobs.some((j) => j.status === 'ready');
  $('run').disabled = state.running || !runnable;
  $('run').textContent = state.running ? '转换中…' : '开始转换';
}

function renderPreview() {
  const job = state.jobs.find((j) => j.id === state.selected);
  const frame = $('pdf');
  const head = $('preview-head');
  const warn = $('warnings');
  const guide = $('guide');
  document.querySelectorAll('.error-box').forEach((e) => e.remove());
  if (!job || (job.status !== 'done' && job.status !== 'failed' && job.status !== 'invalid')) {
    head.hidden = true; warn.hidden = true; frame.hidden = true; guide.hidden = false;
    frame.removeAttribute('src');
    return;
  }
  guide.hidden = true;
  head.hidden = false;
  $('preview-title').textContent = job.info?.title || job.name;
  if (job.status === 'done') {
    const r = job.result;
    $('open-pdf').hidden = !r.pdfPath;
    $('open-tex').hidden = false;
    $('open-folder').hidden = false;
    warn.hidden = !r.warnings.length;
    warn.replaceChildren(...r.warnings.map((w) => el('div', {}, w)));
    if (r.pdfPath) {
      const src = fileUrl(r.pdfPath) + '#view=FitH';
      if (frame.dataset.src !== src) { frame.src = src; frame.dataset.src = src; }
      frame.hidden = false;
    } else {
      frame.hidden = true;
      $('preview-head').after(el('div', { class: 'error-box' }, '没有找到排版引擎，所以只生成了 main.tex。可以安装 TeX Live / MiKTeX 后重试，或把输出文件夹上传到 Overleaf，编译器选 XeLaTeX。'));
    }
  } else {
    $('open-pdf').hidden = true; $('open-tex').hidden = true; $('open-folder').hidden = true;
    warn.hidden = true;
    frame.hidden = true;
    frame.removeAttribute('src'); delete frame.dataset.src;
    $('preview-head').after(el('div', { class: 'error-box' },
      el('div', {}, el('b', {}, '转换失败：'), job.error || ''),
      job.log ? el('pre', {}, job.log) : null));
  }
}

function render() {
  renderQueue();
  renderPreview();
}

function removeJob(id) {
  state.jobs = state.jobs.filter((j) => j.id !== id);
  if (state.selected === id) state.selected = state.jobs.at(-1)?.id ?? null;
  render();
}

async function addJob(job) {
  job.id = state.nextId++;
  job.status = 'inspecting';
  state.jobs.push(job);
  state.selected = job.id;
  render();
  const r = await api.inspect(job.html ? { html: job.html, name: job.name } : job.path);
  if (r.ok) {
    job.info = r.info;
    job.status = r.info.messages ? 'ready' : 'invalid';
    if (!r.info.messages) job.error = '没有找到对话内容';
  } else {
    job.status = 'invalid';
    job.error = r.error;
  }
  render();
}

async function addFiles(paths) {
  for (const p of paths) {
    if (state.jobs.some((j) => j.path === p && j.status !== 'done')) continue;
    await addJob({ path: p, name: baseName(p) });
  }
}

async function runQueue() {
  if (state.running) return;
  state.running = true;
  render();
  try {
    for (;;) {
      const job = state.jobs.find((j) => j.status === 'ready');
      if (!job) break;
      job.status = 'running';
      job.detail = '';
      state.selected = job.id;
      render();
      const r = await api.convert({ id: job.id, path: job.path, html: job.html, name: job.name, style: job.style });
      if (r.ok) {
        job.status = 'done';
        job.result = r.result;
      } else {
        job.status = 'failed';
        job.error = r.error;
        job.log = r.log;
      }
      render();
    }
  } finally {
    state.running = false;
    render();
  }
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
window.__motengSelfTestShow = (items) => {
  for (const it of items) {
    state.jobs.push({ id: state.nextId++, name: it.title, status: 'done', info: { title: it.title, platform: 'Self-test', turns: 1 }, result: { pdfPath: it.pdfPath, texPath: it.pdfPath, warnings: it.warnings, style: /notes/.test(it.title) ? 'notes' : 'chat' } });
  }
  state.selected = state.jobs[0]?.id ?? null;
  render();
  return true;
};

// ------------------------------------------------------------------- wiring
async function init() {
  state.settings = await api.getSettings();
  ['style', 'paper', 'fontSize'].forEach(bindSeg);
  ['includeQuestions', 'includeThinking', 'fetchImages', 'openAfter'].forEach(bindCheck);
  $('outRoot').textContent = state.settings.outRoot;
  $('outRoot').title = state.settings.outRoot;

  $('pickOut').addEventListener('click', async () => {
    const p = await api.pickFolder('out');
    if (p) {
      state.settings = await api.setSettings({ outRoot: p });
      $('outRoot').textContent = p;
      $('outRoot').title = p;
    }
  });
  $('pick').addEventListener('click', async () => addFiles(await api.pickFiles()));
  $('paste').addEventListener('click', async () => {
    const c = await api.clipboardHtml();
    if (!c.html) {
      toast('剪贴板里没有网页内容。请在聊天页面选中对话后按 Ctrl+C 复制。');
      return;
    }
    const now = new Date();
    await addJob({ html: c.html, name: `剪贴板 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}` });
  });
  $('run').addEventListener('click', runQueue);
  $('clear').addEventListener('click', () => {
    state.jobs = state.jobs.filter((j) => j.status !== 'done');
    if (!state.jobs.some((j) => j.id === state.selected)) state.selected = null;
    render();
  });
  $('engine').addEventListener('click', async () => {
    if (state.engines.length) return;
    const p = await api.pickEngine();
    if (p) {
      state.settings = await api.setSettings({ enginePath: p });
      await refreshEngines();
    }
  });
  $('open-pdf').addEventListener('click', () => { const j = state.jobs.find((x) => x.id === state.selected); if (j?.result?.pdfPath) api.openPath(j.result.pdfPath); });
  $('open-tex').addEventListener('click', () => { const j = state.jobs.find((x) => x.id === state.selected); if (j?.result?.texPath) api.openPath(j.result.texPath); });
  $('open-folder').addEventListener('click', () => { const j = state.jobs.find((x) => x.id === state.selected); if (j?.result?.texPath) api.showInFolder(j.result.texPath); });

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
    if (paths.length) await addFiles(paths);
    else {
      const html = e.dataTransfer?.getData('text/html');
      if (html) await addJob({ html, name: '拖入的内容' });
    }
  });
  document.addEventListener('paste', async (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (html) await addJob({ html, name: '粘贴的内容' });
  });

  api.onProgress(({ id, detail }) => {
    const job = state.jobs.find((j) => j.id === id);
    if (job && job.status === 'running') { job.detail = detail; renderQueue(); }
  });
  api.onAddFiles((files) => addFiles(files));

  await refreshEngines();
  const pending = await api.pendingFiles();
  if (pending.length) await addFiles(pending);
  render();
}

init();
