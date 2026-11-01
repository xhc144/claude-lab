'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const api = window.filenest;
  const pending = new Set();
  let state = { rules: [], categories: [], statuses: {}, paused: false, startup: false, busy: false, modeNames: {}, fallback: '其他' };
  let activePage = 'organize';
  let ruleKey = '', categoryKey = '';
  let editingRule = null, editingCategory = -1;
  let confirmResolve = null;
  let searchTimer = null, tryTimer = null;

  // ---------- 小工具 ----------
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    svg.setAttribute('aria-hidden', 'true'); use.setAttribute('href', '#i-' + name); svg.append(use); return svg;
  }
  function button(text, cls, sym, fn) {
    const b = el('button', 'button ' + (cls || 'secondary'), text); b.type = 'button';
    if (sym) b.prepend(icon(sym)); if (fn) b.addEventListener('click', fn); return b;
  }
  function iconButton(sym, label, fn) {
    const b = el('button', 'icon-button'); b.type = 'button'; b.title = label; b.setAttribute('aria-label', label); b.append(icon(sym));
    b.addEventListener('click', fn); return b;
  }
  const badge = (t, tone) => el('span', 'badge ' + (tone || ''), t);
  const clear = n => { n.replaceChildren(); return n; };
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const errText = e => (e && e.message ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
  const baseName = p => String(p || '').split(/[\\/]/).pop();
  function rel(p, root) { const a = String(p || ''), r = String(root || '').replace(/[\\/]+$/, ''); return a.toLowerCase().startsWith(r.toLowerCase() + '\\') || a.toLowerCase().startsWith(r.toLowerCase() + '/') ? a.slice(r.length + 1) : a; }
  function parentOf(p) { const s = String(p); const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/')); return i > 0 ? s.slice(0, i) : ''; }
  function when(value) {
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    const now = new Date(), sameDay = d.toDateString() === now.toDateString();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return '今天 ' + hm;
    if (d.toDateString() === y.toDateString()) return '昨天 ' + hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }
  function size(bytes) {
    const b = num(bytes); if (!b) return '';
    if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'; return (b / 1073741824).toFixed(2) + ' GB';
  }

  function notify(message, kind = 'success') {
    if (!message) return;
    const t = el('div', 'toast' + (kind === 'error' || kind === 'warning' ? ' error' : ''));
    t.append(icon(kind === 'error' || kind === 'warning' ? 'alert' : 'check'), el('p', '', message));
    const x = iconButton('close', '关闭', () => t.remove()); t.append(x);
    $('toast-stack').append(t);
    while ($('toast-stack').children.length > 4) $('toast-stack').firstElementChild.remove();
    setTimeout(() => t.remove(), kind === 'error' ? 15000 : 6000);
  }
  async function action(key, fn, opts = {}) {
    if (pending.has(key)) return undefined;
    pending.add(key); renderControls();
    try { return await fn(); }
    catch (e) {
      if (opts.inline) { $(opts.inline).textContent = errText(e); $(opts.inline).hidden = false; }
      else notify(errText(e) || '操作没有完成，请重试。', 'error');
      return undefined;
    } finally { pending.delete(key); renderControls(); }
  }
  function confirmAction(title, message, label = '确认') {
    if (confirmResolve) return Promise.resolve(false);
    $('confirm-title').textContent = title; $('confirm-message').textContent = message; $('confirm-yes').textContent = label;
    $('confirm-dialog').showModal();
    return new Promise(r => { confirmResolve = r; });
  }
  function finishConfirm(v) { const r = confirmResolve; confirmResolve = null; $('confirm-dialog').close(); if (r) r(v); }
  function openDetails(title, eyebrow = '') {
    $('detail-title').textContent = title; $('detail-eyebrow').textContent = eyebrow;
    clear($('detail-body')); clear($('detail-footer')).append(button('完成', 'primary', null, () => $('detail-dialog').close()));
    if (!$('detail-dialog').open) $('detail-dialog').showModal();
    return $('detail-body');
  }
  function menu(items) {
    const d = el('details', 'menu'); const s = el('summary', 'icon-button'); s.title = '更多'; s.append(icon('more')); d.append(s);
    const panel = el('div', 'menu-panel');
    for (const it of items) {
      const b = el('button', it.danger ? 'danger-text' : '', it.label); b.type = 'button';
      if (it.symbol) b.prepend(icon(it.symbol)); if (it.disabled) b.disabled = true;
      b.addEventListener('click', () => { d.open = false; it.action(); }); panel.append(b);
    }
    d.append(panel); return d;
  }

  // ---------- 状态 ----------
  async function refresh() { accept(await api.getState()); }
  function accept(next) {
    if (!next || typeof next !== 'object') return;
    state = { ...state, ...next };
    state.rules = Array.isArray(state.rules) ? state.rules : [];
    state.categories = Array.isArray(state.categories) ? state.categories : [];
    renderAll();
  }
  function renderAll() {
    $('app-version').textContent = state.version || '3.0';
    $('data-directory').textContent = state.dataDirectory || '';
    $('fallback-name').textContent = state.fallback || '其他';
    renderRules(); renderCategories(); renderControls();
  }
  function navigate(page) {
    if (!['organize', 'search', 'categories', 'settings'].includes(page)) page = 'organize';
    activePage = page;
    for (const n of document.querySelectorAll('.page')) n.hidden = n.id !== 'page-' + page;
    for (const n of document.querySelectorAll('.nav-item')) n.classList.toggle('active', n.dataset.page === page);
    if (page === 'search') { loadTops(); runSearch(); setTimeout(() => $('search-input').focus(), 0); }
    if (page === 'organize') loadActivity();
  }
  function renderControls() {
    const enabled = state.rules.filter(r => r.Enabled && num(r.Schedule) !== 2).length;
    const text = state.busy && state.busyText ? state.busyText : state.paused ? '自动整理已暂停' : enabled ? '自动整理开启中 · ' + enabled + ' 个文件夹' : state.rules.length ? '还没有开启自动整理（可以先“预览”看看）' : '还没有添加要整理的文件夹';
    $('automation-status').textContent = text;
    const color = state.paused ? '#c7a867' : enabled ? '#45a787' : '#b3c3c8';
    $('automation-dot').style.background = color; $('side-dot').style.background = color;
    $('side-status').textContent = state.paused ? '已暂停' : enabled ? '正在守候' : '未开启';
    $('nav-status').textContent = state.busy ? '整理中' : '';
    $('pause-all').querySelector('span').textContent = state.paused ? '恢复自动整理' : '暂停自动整理';
    $('pause-all').querySelector('use').setAttribute('href', state.paused ? '#i-play' : '#i-pause');
    $('pause-all').hidden = !state.rules.length;
    $('pause-all').disabled = pending.has('pause');
    $('add-rule').disabled = state.busy;
    $('startup-switch').setAttribute('aria-checked', String(Boolean(state.startup)));
    $('startup-switch').disabled = pending.has('startup');
    $('run-diagnostics').disabled = state.busy || pending.has('diag');
    $('run-diagnostics').querySelector('span').textContent = pending.has('diag') ? '自检中…' : '开始自检';
    $('rule-save').disabled = pending.has('save-rule');
    for (const n of document.querySelectorAll('[data-idle]')) n.disabled = state.busy || pending.has(n.dataset.idle);
  }

  // ---------- 整理任务 ----------
  function layoutText(rule) {
    const g = rule.DateGranularity === 'day' ? '按天' : '按月';
    return { 0: '日期（' + g + '）', 1: '学科大类', 4: '学科大类 → 日期（' + g + '）', 5: '日期（' + g + '）→ 学科大类' }[num(rule.Mode)] || '未知方式';
  }
  function scheduleText(rule) { return num(rule.Schedule) === 1 ? '每天 ' + (rule.DailyTime || '20:00') : num(rule.Schedule) === 2 ? '仅手动' : '一直监测'; }

  function renderRules() {
    const key = JSON.stringify([state.rules, state.statuses, state.paused, state.busy]);
    if (key === ruleKey) return; ruleKey = key;
    const list = clear($('rule-list'));
    if (!state.rules.length) {
      const e = el('div', 'empty-card'); const t = el('span', 'icon-tile'); t.append(icon('folder'));
      e.append(t, el('h3', '', '添加一个要自动整理的文件夹'), el('p', '', '比如浏览器或 ChatGPT 的下载文件夹。新文件会按学科大类和月份放好。'), button('添加文件夹', 'primary', 'plus', () => openRule()));
      list.append(e); return;
    }
    for (const rule of state.rules) {
      const card = el('article', 'rule-card');
      const top = el('div', 'rule-top'); const t = el('span', 'icon-tile'); t.append(icon('folder'));
      const h = el('div', 'rule-heading'); h.append(el('h3', '', rule.Name)); const p = el('p', 'rule-path', rule.Root); p.title = rule.Root; h.append(p);
      const manual = num(rule.Schedule) === 2;
      const label = manual ? '仅手动' : !rule.Enabled ? '未开启' : state.paused ? '已暂停' : '自动整理中';
      top.append(t, h, badge(label, rule.Enabled && !state.paused && !manual ? 'success' : '')); card.append(top);
      const bottom = el('div', 'rule-bottom'); const chips = el('div', 'chips');
      const c1 = el('span', 'chip', layoutText(rule)); c1.prepend(icon('grid'));
      const c2 = el('span', 'chip', scheduleText(rule)); c2.prepend(icon('clock'));
      chips.append(c1, c2);
      const actions = el('div', 'rule-actions');
      const pv = button('预览', 'secondary small', null, () => previewRule(rule)); pv.dataset.idle = 'preview-' + rule.Id;
      const run = button('立即整理', 'ghost small', 'play', () => runRule(rule)); run.dataset.idle = 'run-' + rule.Id;
      const items = [
        { label: '编辑', symbol: 'settings', disabled: state.busy, action: () => openRule(rule) },
        { label: '打开这个文件夹', symbol: 'open', action: () => action('open', () => api.openPath({ path: rule.Root })) }
      ];
      if (!manual) items.push({ label: rule.Enabled ? '关闭自动整理' : '开启自动整理', symbol: rule.Enabled ? 'pause' : 'play', disabled: state.busy, action: () => action('toggle', async () => { await api.saveRule({ ...rule, Enabled: !rule.Enabled }); await refresh(); notify(rule.Enabled ? '已关闭这个文件夹的自动整理。' : '已开启自动整理。'); }) });
      items.push({ label: '移除', symbol: 'close', danger: true, disabled: state.busy, action: async () => {
        if (await confirmAction('移除“' + rule.Name + '”？', '只是不再整理这个文件夹，里面的文件一个都不会动。', '移除')) action('del', async () => { await api.deleteRule({ id: rule.Id }); await refresh(); notify('已移除。'); });
      } });
      actions.append(pv, run, menu(items)); bottom.append(chips, actions); card.append(bottom);
      const st = state.statuses[rule.Id];
      if (st && st.text) card.append(el('p', 'rule-state' + (st.error ? ' error' : ''), '上次检查 ' + when(st.lastRun) + ' · ' + st.text));
      list.append(card);
    }
    renderControls();
  }

  function updateExample() {
    const mode = num($('rule-mode').value), day = $('rule-granularity').value === 'day';
    const d = new Date(), month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const date = day ? month + '-' + String(d.getDate()).padStart(2, '0') : month;
    const parts = { 0: [date], 1: ['数学'], 4: ['数学', date], 5: [date, '数学'] }[mode];
    $('rule-example').textContent = '例：微分几何讲义.pdf  →  ' + parts.join('\\') + '\\微分几何讲义.pdf';
    $('rule-granularity-field').hidden = mode === 1;
    $('rule-date-field').hidden = mode === 1;
    const schedule = num($('rule-schedule').value);
    $('rule-time-field').hidden = schedule !== 1; $('rule-time').disabled = schedule !== 1;
    $('rule-enabled').disabled = schedule === 2;
  }
  function openRule(rule) {
    if (state.busy) { notify('正在整理，稍等一下再修改。', 'warning'); return; }
    editingRule = rule ? { ...rule } : null;
    $('rule-form').reset(); $('rule-error').hidden = true;
    $('rule-dialog-title').textContent = rule ? '编辑“' + rule.Name + '”' : '添加要整理的文件夹';
    $('rule-name').value = rule ? rule.Name : '';
    $('rule-root').value = rule ? rule.Root : '';
    $('rule-mode').value = String(rule ? num(rule.Mode) : 4);
    $('rule-granularity').value = rule && rule.DateGranularity === 'day' ? 'day' : 'month';
    $('rule-schedule').value = String(rule ? num(rule.Schedule) : 0);
    $('rule-time').value = rule ? rule.DailyTime || '20:00' : '20:00';
    $('rule-date').value = String(rule ? num(rule.DateSource) : 0);
    $('rule-folders').checked = rule ? rule.IncludeFolders !== false : true;
    $('rule-stable').value = rule ? num(rule.StableSeconds) || 30 : 30;
    $('rule-excludes').value = rule && Array.isArray(rule.Excludes) ? rule.Excludes.join('\n') : '';
    $('rule-enabled').checked = Boolean(rule && rule.Enabled);
    $('rule-dialog').querySelector('.advanced').open = Boolean(rule && rule.Excludes && rule.Excludes.length);
    updateExample(); $('rule-dialog').showModal(); (rule ? $('rule-name') : $('rule-root')).focus();
  }
  async function saveRule(event) {
    event.preventDefault(); $('rule-error').hidden = true;
    const schedule = num($('rule-schedule').value);
    const rule = {
      ...(editingRule || {}), Name: $('rule-name').value.trim(), Root: $('rule-root').value.trim(),
      Mode: num($('rule-mode').value), DateGranularity: $('rule-granularity').value, Schedule: schedule,
      DailyTime: $('rule-time').value || '20:00', DateSource: num($('rule-date').value),
      Enabled: $('rule-enabled').checked && schedule !== 2, IncludeFolders: $('rule-folders').checked,
      StableSeconds: num($('rule-stable').value), Excludes: $('rule-excludes').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
    };
    if (!editingRule) rule.Id = crypto.randomUUID().replace(/-/g, '');
    await action('save-rule', async () => {
      await api.saveRule(rule); await refresh(); $('rule-dialog').close();
      notify(rule.Enabled ? '已保存并开启自动整理。' : '已保存。可以点“预览”看看会怎么整理。');
    }, { inline: 'rule-error' });
  }

  async function previewRule(rule) {
    await action('preview-' + rule.Id, async () => {
      const plan = await api.previewRule({ id: rule.Id });
      const body = openDetails(rule.Name, '整理预览 · 现在还没有移动任何文件');
      const moves = Array.isArray(plan.Moves) ? plan.Moves : [];
      const readyCount = moves.filter(m => m.Ready).length;
      body.append(el('p', 'detail-summary', moves.length ? '将整理 ' + moves.length + ' 项' + (readyCount < moves.length ? '（其中 ' + (moves.length - readyCount) + ' 项刚下载，稳定后才会移动）' : '') + '：' : '现在没有需要整理的新文件。'));
      const groups = new Map();
      for (const m of moves) { const k = m.Folder || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
      for (const [folder, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
        const g = el('div', 'move-group'); const h = el('h3', '', folder.replace(/[\\/]/g, ' / ') + '  '); h.prepend(icon('folder')); h.append(badge(items.length + ' 项'));
        g.append(h);
        for (const m of items) {
          const row = el('div', 'move-row');
          row.append(el('span', 'name', baseName(m.Source)));
          const why = el('span', 'why', m.Reason || ''); why.title = m.Reason || ''; row.append(why);
          if (!m.Ready) row.append(badge('等待稳定', 'warning'));
          if (!m.CompanionOf) {
            const skip = button('不要整理', 'text small', null, () => action('exclude', async () => {
              await api.excludeItem({ ruleId: rule.Id, name: baseName(m.Source) }); await refresh();
              row.remove(); notify('以后不会再整理“' + baseName(m.Source) + '”。可以在任务的“更多选项”里改回来。');
            }));
            row.append(skip);
          }
          g.append(row);
        }
        body.append(g);
      }
      const notes = [];
      if (plan.Kept && plan.Kept.length) notes.push('保留原位（排除项或自定义文件夹）：' + plan.Kept.join('、'));
      if (plan.Notes && plan.Notes.length) notes.push(...plan.Notes);
      if (notes.length) body.append(el('div', 'detail-notes', notes.join('\n')));
      const run = button('立即整理', 'primary', 'play', () => { $('detail-dialog').close(); runRule(rule); });
      run.disabled = !readyCount;
      clear($('detail-footer')).append(button('返回', 'secondary', null, () => $('detail-dialog').close()), run);
    });
  }
  async function runRule(rule) {
    await action('run-' + rule.Id, async () => {
      const r = await api.runRule({ id: rule.Id }); await refresh(); loadActivity();
      if (!r.Moved && !r.Failed) { notify(r.Waiting ? '有 ' + r.Waiting + ' 个文件刚下载完，稳定后会自动整理。' : '没有需要整理的新文件。'); return; }
      if (!r.Failed) { notify('已整理 ' + r.Moved + ' 项。可以在“最近整理”里查看或撤销。'); return; }
      const body = openDetails(rule.Name, '整理结果');
      body.append(el('p', 'detail-summary', '已整理 ' + r.Moved + ' 项，' + r.Failed + ' 项没有成功：'));
      body.append(el('pre', 'report-text', (r.Messages || []).join('\n')));
    });
  }

  // ---------- 最近整理 ----------
  async function loadActivity() {
    const list = $('activity-list');
    let batches;
    try { batches = await api.activity(); } catch (e) { clear(list).append(el('div', 'empty-line', '读取整理记录失败：' + errText(e))); return; }
    clear(list);
    if (!batches || !batches.length) { list.append(el('div', 'empty-line', '还没有整理记录。')); return; }
    for (const b of batches.slice(0, 30)) {
      const d = el('details', 'activity'); const s = el('summary');
      s.append(icon('chevron'), el('span', 'activity-time', when(b.CreatedUtc)));
      const names = b.Entries.filter(e => e.State !== 'failed').map(e => baseName(e.Source));
      const title = el('span', 'activity-title', names.slice(0, 3).join('、') + (names.length > 3 ? ' 等 ' + names.length + ' 项' : ''));
      s.append(title);
      if (b.Moved && b.Undone) s.append(badge('部分已撤销', 'warning'));
      else if (!b.Moved && b.Undone) s.append(badge('已撤销'));
      else s.append(badge('整理 ' + b.Moved + ' 项', 'success'));
      d.append(s);
      const body = el('div', 'activity-body');
      for (const e of b.Entries) {
        const row = el('div', 'activity-entry' + (e.State === 'undone' ? ' undone' : ''));
        row.append(el('span', 'name', baseName(e.Source)));
        const dest = el('span', 'dest', e.State === 'failed' ? '未成功：' + (e.Error || '') : '→ ' + parentOf(rel(e.Destination, b.Root)).replace(/[\\/]/g, ' / '));
        dest.title = e.Destination; row.append(dest);
        if (e.State === 'moved') row.append(iconButton('open', '在资源管理器中显示', () => action('reveal', () => api.showInFolder({ path: e.Destination }))));
        body.append(row);
      }
      if (b.Moved) {
        const foot = el('div', 'activity-foot');
        const u = button('撤销这一批', 'secondary small', 'undo', async () => {
          if (await confirmAction('撤销这一批整理？', '把这 ' + b.Moved + ' 项移回原来的位置。为了防止它们马上又被整理，自动整理会先暂停。', '撤销'))
            action('undo', async () => {
              const r = await api.undoBatch({ id: b.Id }); await refresh(); loadActivity();
              if (r.Failed) { const body2 = openDetails('撤销结果'); body2.append(el('pre', 'report-text', r.Messages.join('\n'))); }
              else notify('已移回 ' + r.Moved + ' 项。' + (r.Paused ? '自动整理已暂停，需要时点“恢复自动整理”。' : ''));
            });
        });
        u.dataset.idle = 'undo'; foot.append(u); body.append(foot);
      }
      d.append(body); list.append(d);
    }
    renderControls();
  }

  // ---------- 查找 ----------
  const typeLabel = { pdf: 'PDF', doc: 'DOC', archive: 'ZIP', image: 'IMG', media: '影音', web: 'WEB', app: 'APP', folder: '文件夹', other: '' };
  async function loadTops() {
    try {
      const tops = await api.searchTops({});
      const sel = $('search-top'), cur = sel.value;
      clear(sel).append(new Option('所有分类', ''));
      const cats = new Set(state.categories.map(c => c.Name).concat([state.fallback]));
      const ordered = [...tops.filter(t => cats.has(t.name)), ...tops.filter(t => !cats.has(t.name) && !/^\d{4}-/.test(t.name)), ...tops.filter(t => /^\d{4}-/.test(t.name))];
      for (const t of ordered.slice(0, 200)) sel.append(new Option(t.name + '（' + t.count + '）', t.name));
      sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
    } catch {}
  }
  async function runSearch() {
    const q = $('search-input').value.trim();
    let r;
    try { r = await api.search({ q, type: $('search-type').value, top: $('search-top').value, limit: 300 }); }
    catch (e) { $('search-summary').textContent = errText(e); return; }
    const list = clear($('search-results'));
    $('search-summary').textContent = (q || $('search-type').value !== 'all' || $('search-top').value ? '找到 ' + r.total + ' 项' + (r.total > r.items.length ? '，显示最新的 ' + r.items.length + ' 项' : '') : '最近的文件') + ' · 共索引 ' + r.count + ' 项' + (r.truncated ? '（已达上限）' : '') + ' · ' + when(r.builtAt) + ' 扫描';
    if (!state.rules.length) { list.append(el('div', 'empty-line', '先在“整理”里添加文件夹，这里就能查找了。')); return; }
    if (!r.items.length) { list.append(el('div', 'empty-line', '没有找到。试试少输几个字。')); return; }
    for (const it of r.items) {
      const row = el('div', 'result-row');
      row.append(el('span', 'type-tag ' + it.type, typeLabel[it.type] || (it.ext || '').toUpperCase().slice(0, 4) || '—'));
      const name = el('span', 'name', it.name); name.title = it.path;
      name.addEventListener('click', () => action('open', () => api.openPath({ path: it.path })));
      const where = el('span', 'where', it.folder === '.' ? it.ruleName : it.folder.replace(/[\\/]/g, ' / ')); where.title = it.folder;
      const acts = el('span', 'row-actions');
      acts.append(iconButton('open', '打开', () => action('open', () => api.openPath({ path: it.path }))), iconButton('folder', '在资源管理器中显示', () => action('reveal', () => api.showInFolder({ path: it.path }))));
      row.append(name, where, el('span', 'when', when(it.mtime)), el('span', 'size', size(it.size)), acts);
      list.append(row);
    }
  }

  // ---------- 分类规则 ----------
  function renderCategories() {
    const key = JSON.stringify([state.categories, state.fallback]);
    if (key === categoryKey) return; categoryKey = key;
    const list = clear($('category-list'));
    state.categories.forEach((c, i) => {
      const card = el('article', 'category-card');
      const order = el('div', 'category-order');
      const up = iconButton('up', '上移', () => moveCategory(i, -1)); up.disabled = i === 0;
      const down = iconButton('down', '下移', () => moveCategory(i, 1)); down.disabled = i === state.categories.length - 1;
      order.append(up, down);
      const main = el('div'); const h = el('h3', '', c.Name); main.append(h);
      const kws = el('div', 'keywords');
      for (const k of c.Keywords.slice(0, 36)) kws.append(el('span', 'keyword', k));
      if (c.Keywords.length > 36) kws.append(el('span', 'keyword more', '等 ' + c.Keywords.length + ' 个'));
      for (const x of (c.Extensions || []).slice(0, 12)) kws.append(el('span', 'keyword ext', '.' + x));
      if ((c.Extensions || []).length > 12) kws.append(el('span', 'keyword more', '…'));
      if (!c.Keywords.length && !(c.Extensions || []).length) kws.append(el('span', 'keyword more', '还没有关键词'));
      main.append(kws);
      if ((c.Topics || []).length) main.append(el('p', '', '细分：' + c.Topics.map(t => t.Name).join('、') + (c.DefaultTopic ? '（其余放“' + c.DefaultTopic + '”）' : '')));
      card.append(order, main, button('编辑', 'secondary small', null, () => openCategory(i)));
      list.append(card);
    });
    const fb = el('article', 'category-card fallback'); fb.append(el('span'), (() => { const m = el('div'); m.append(el('h3', '', state.fallback || '其他'), el('p', '', '上面都没命中的文件放这里。乱码文件名、没写主题的文件一般会进来。')); return m; })(), el('span'));
    list.append(fb);
  }
  function saveCategoryList(list, msg) {
    return action('cats', async () => { await api.saveCategories({ categories: list }); await refresh(); if (msg) notify(msg); }, {});
  }
  function moveCategory(i, delta) {
    const list = state.categories.map(c => ({ ...c })); const j = i + delta;
    if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]];
    saveCategoryList(list);
  }
  function openCategory(i) {
    editingCategory = i; const c = i >= 0 ? state.categories[i] : { Name: '', Keywords: [], Extensions: [] };
    $('category-dialog-title').textContent = i >= 0 ? '编辑分类“' + c.Name + '”' : '添加分类';
    $('category-name').value = c.Name; $('category-keywords').value = c.Keywords.join('，');
    $('category-exts').value = (c.Extensions || []).join(', '); $('category-error').hidden = true;
    $('category-delete').hidden = i < 0;
    $('category-dialog').showModal(); $('category-name').focus();
  }
  async function saveCategory(event) {
    event.preventDefault(); $('category-error').hidden = true;
    const list = state.categories.map(c => ({ ...c }));
    const item = { Name: $('category-name').value.trim(), Keywords: $('category-keywords').value, Extensions: $('category-exts').value };
    // 细分主题和扩展名权重这里不编辑，保存时原样保留。
    if (editingCategory >= 0) list[editingCategory] = { ...list[editingCategory], ...item }; else list.push(item);
    await action('cats', async () => { await api.saveCategories({ categories: list }); await refresh(); $('category-dialog').close(); notify('分类规则已保存，之后的新文件按新规则整理。'); }, { inline: 'category-error' });
    updateTry();
  }
  async function deleteCategory() {
    const c = state.categories[editingCategory]; if (!c) return;
    if (!(await confirmAction('删除分类“' + c.Name + '”？', '只删除规则，已经放进“' + c.Name + '”文件夹的文件不会动。以后这类文件会按其他规则分，没命中就进“' + state.fallback + '”。', '删除'))) return;
    const list = state.categories.filter((_, i) => i !== editingCategory);
    await action('cats', async () => { await api.saveCategories({ categories: list }); await refresh(); $('category-dialog').close(); notify('已删除。'); }, { inline: 'category-error' });
  }
  async function updateTry() {
    const name = $('try-name').value.trim(), out = clear($('try-result'));
    if (!name) return;
    try {
      const r = await api.testCategory({ name });
      if (!r) return;
      out.append(document.createTextNode('会放进 '), el('strong', '', r.category), document.createTextNode('　' + r.reason));
    } catch (e) { out.textContent = errText(e); }
  }

  // ---------- 绑定 ----------
  function bind() {
    for (const n of document.querySelectorAll('.nav-item')) n.addEventListener('click', () => navigate(n.dataset.page));
    for (const n of document.querySelectorAll('[data-close]')) n.addEventListener('click', () => $(n.dataset.close).close());
    $('confirm-no').addEventListener('click', () => finishConfirm(false));
    $('confirm-yes').addEventListener('click', () => finishConfirm(true));
    $('confirm-dialog').addEventListener('cancel', e => { e.preventDefault(); finishConfirm(false); });
    $('add-rule').addEventListener('click', () => openRule());
    $('rule-form').addEventListener('submit', saveRule);
    for (const id of ['rule-mode', 'rule-granularity', 'rule-schedule']) $(id).addEventListener('change', updateExample);
    $('rule-pick').addEventListener('click', () => action('pick', async () => {
      const p = await api.pickFolder();
      if (p) { $('rule-root').value = p; if (!$('rule-name').value.trim()) $('rule-name').value = baseName(p.replace(/[\\/]+$/, '')) || '我的文件夹'; }
    }));
    $('pause-all').addEventListener('click', () => action('pause', async () => { await api.setPaused({ paused: !state.paused }); await refresh(); }));
    $('search-input').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 160); });
    $('search-type').addEventListener('change', runSearch);
    $('search-top').addEventListener('change', runSearch);
    $('search-rebuild').addEventListener('click', () => action('rebuild', async () => { $('search-summary').textContent = '正在重新扫描…'; await api.rebuildIndex(); await loadTops(); await runSearch(); }));
    $('add-category').addEventListener('click', () => openCategory(-1));
    $('category-form').addEventListener('submit', saveCategory);
    $('category-delete').addEventListener('click', deleteCategory);
    $('reset-categories').addEventListener('click', async () => {
      if (await confirmAction('恢复默认分类规则？', '你改过的关键词会被默认规则替换。已经整理好的文件不会动。', '恢复默认'))
        action('cats', async () => { await api.resetCategories(); await refresh(); notify('已恢复默认分类规则。'); updateTry(); });
    });
    $('try-name').addEventListener('input', () => { clearTimeout(tryTimer); tryTimer = setTimeout(updateTry, 150); });
    $('startup-switch').addEventListener('click', () => action('startup', async () => { await api.setStartup({ enabled: !state.startup }); await refresh(); }));
    $('open-data').addEventListener('click', () => action('data', () => api.openDataFolder()));
    // 机器翻译设置（密钥只写不读：保存后界面上不再显示）
    let translateCfg = null;
    function renderTranslate(c) {
      translateCfg = c;
      $('translate-switch').setAttribute('aria-checked', String(!!c.Enabled));
      if (!$('translate-url').value) $('translate-url').value = c.BaseUrl || '';
      if (!$('translate-model').value) $('translate-model').value = c.Model || '';
      $('translate-key').placeholder = c.HasKey ? '已保存（不显示）；要换就粘贴新的' : '在网关里新建一个密钥粘贴到这里';
      $('translate-status').textContent = (c.Enabled ? '已开启' : '未开启') + (c.HasKey ? '' : ' · 还没填密钥') + ' · 已翻译 ' + c.Cached + ' 个名字' + (c.LastError ? ' · 最近一次失败：' + c.LastError : '');
    }
    const translateForm = () => ({ Enabled: translateCfg ? translateCfg.Enabled : false, BaseUrl: $('translate-url').value.trim(), Model: $('translate-model').value.trim(), Key: $('translate-key').value });
    api.getTranslate().then(renderTranslate).catch(() => {});
    $('translate-switch').addEventListener('click', () => action('translate', async () => { renderTranslate(await api.saveTranslate({ ...translateForm(), Enabled: !(translateCfg && translateCfg.Enabled), Key: '' })); }, { inline: 'translate-error' }));
    $('translate-save').addEventListener('click', () => action('translate', async () => {
      $('translate-error').hidden = true;
      renderTranslate(await api.saveTranslate(translateForm())); $('translate-key').value = ''; notify('机器翻译设置已保存。');
    }, { inline: 'translate-error' }));
    $('translate-test').addEventListener('click', () => action('translate', async () => {
      $('translate-error').hidden = true;
      const r = await api.testTranslate(translateForm()); notify('翻译正常：' + r.sample + ' → ' + r.result);
    }, { inline: 'translate-error' }));

    $('export-settings').addEventListener('click', () => action('export', async () => { const p = await api.exportSettings(); if (p) notify('已导出到 ' + p); }));
    $('import-settings').addEventListener('click', async () => {
      if (await confirmAction('导入设置？', '会替换现在的任务和分类规则。导入后自动整理先暂停，检查无误后再恢复。', '选择文件'))
        action('import', async () => { const r = await api.importSettings(); if (r) { await refresh(); notify('已导入，自动整理已暂停。'); } });
    });
    $('run-diagnostics').addEventListener('click', () => action('diag', async () => { const text = await api.runDiagnostics(); openDetails('自检结果', '运行诊断').append(el('pre', 'report-text', text)); }));
    $('quit-app').addEventListener('click', async () => {
      if (await confirmAction('完全退出文件管家？', '退出后自动整理会停止，直到下次打开。只是关掉窗口的话，它会继续在托盘里工作。', '退出'))
        action('quit', () => api.quit());
    });
    $('retry-connect').addEventListener('click', connect);
    document.addEventListener('click', e => { for (const m of document.querySelectorAll('.menu[open]')) if (!m.contains(e.target)) m.open = false; });
  }

  async function connect() {
    try {
      if (!api || typeof api.getState !== 'function') throw new Error('请通过桌面上的“文件管家”打开，不要直接打开网页文件。');
      api.onEvent(ev => {
        if (!ev || typeof ev !== 'object') return;
        if (ev.type === 'state') accept(ev.state);
        if (ev.type === 'toast') notify(ev.message, ev.kind);
        if (ev.type === 'activity' && activePage === 'organize') loadActivity();
      });
      await refresh(); $('fatal-overlay').hidden = true; loadActivity();
    } catch (e) { $('fatal-message').textContent = errText(e); $('fatal-overlay').hidden = false; }
  }

  bind(); navigate('organize'); connect();
})();
