// 研究控制台: live view of one study. State arrives as a full snapshot, then as SSE events.
import { h, clear, modal, drawer, toast, confirmBox, rafThrottle } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { get, post, put, subscribe } from '../api.js';
import { md, mdInline, renderContribution, linkRefs } from '../lib/md.js';
import { STATUS, STATUS_COLOR, KIND, OTYPE, SEV, OSTATE, VERDICT, POS, SESSION_STATUS, money, tokens, ms, clock } from '../lib/fmt.js';
import { createArena } from '../viz/arena.js';
import { createGraph } from '../viz/graph.js';
import { consensusChart, evidenceMap, costLine } from '../viz/charts.js';
import { app } from '../main.js';

const PHASE_NAME = { independent: '独立研究', investigate: '专项攻关', critique: '交叉质询', rebuttal: '答辩修正', verify: '独立核验', synthesis: '综合规划', report: '撰写报告', consult: '定向问询', done: '完成' };
const ROUND_PHASES = (r) => (r <= 1 ? ['independent', 'critique', 'rebuttal', 'verify', 'synthesis'] : ['investigate', 'critique', 'rebuttal', 'verify', 'synthesis']);
const TABS = [
  ['arena', 'arena', '交锋场'], ['graph', 'graph', '论证图谱'], ['ledger', 'ledger', '断言账本'], ['consensus', 'consensus', '共识演化'],
  ['transcript', 'transcript', '研究记录'], ['report', 'report', '研究报告'], ['telemetry', 'telemetry', '调用遥测'],
];
const roleName = (r) => app.meta.roles[r]?.name || r;
const statusChip = (s, prefix = '') => h('span.chip.status', { dataset: { s } }, h('span.dot'), `${prefix}${STATUS[s] || s}`);
const html = (tag, markup, attrs = {}) => { const e = h(tag, attrs); e.innerHTML = markup; return linkRefs(e); };

export async function mountConsole(root, id) {
  const { session } = await get(`/api/sessions/${id}`);
  const S = session;
  S.ledgerRev = 1;
  S.roleName = roleName;
  S.live = {};
  const liveCalls = new Map();
  let tab = sessionStorageGet(`tab:${id}`) || 'arena';
  let selected = null;
  const expanded = new Set();
  let ledgerFilter = 'all';
  let ledgerQuery = '';
  let consClaim = 'C0';
  let destroyed = false;

  // ───────────────────────── layout ─────────────────────────
  const cbar = h('header.panel.hud.cbar');
  const roster = h('section.panel.roster');
  const stage = h('section.panel.stagecol');
  const ctl = h('aside.panel.ctlcol');
  const grid = h('div.cgrid', {}, roster, stage, ctl);
  clear(root, h('div.console', {}, cbar, grid));

  const tabsBar = h('nav.stage-tabs', { role: 'tablist' });
  const stageBody = h('div.stage');
  stage.append(tabsBar, stageBody);
  const views = {};

  // ───────────────────────── dirty rendering ─────────────────────────
  const dirty = new Set();
  const flush = rafThrottle(() => {
    if (destroyed) return;
    const d = [...dirty];
    dirty.clear();
    for (const k of d) renderers[k]?.();
  });
  const mark = (...keys) => { for (const k of keys) dirty.add(k); flush(); };

  // ───────────────────────── header bar ─────────────────────────
  function renderBar() {
    const C0 = S.ledger.claims.C0;
    const r = S.cursor.round;
    const phases = [...ROUND_PHASES(r), 'report'];
    const curIdx = S.cursor.phase === 'done' ? phases.length : S.cursor.phase === 'report' ? phases.length - 1 : phases.indexOf(S.cursor.phase);
    const skipped = new Set(S.timeline.filter((t) => t.round === r && t.skipped).map((t) => t.phase));
    const prog = S.plan?.progress ? Object.values(S.plan.progress) : [];
    const pct = prog.length ? (prog.filter((x) => x === 'done' || x === 'failed').length / prog.length) * 100 : 0;
    const running = S.status === 'running' || S.status === 'pausing';
    const spent = S.usage.costUsd;
    const budget = S.settings.budgetUsd;
    const frac = budget > 0 ? Math.min(1, spent / budget) : 0;
    const gaugeColor = frac > 0.9 ? '#ff5c8a' : frac > 0.7 ? '#ffb547' : '#4de8ff';
    const circ = 2 * Math.PI * 19;
    const gauge = h('div.gauge', { title: budget > 0 ? `预算已用 ${Math.round(frac * 100)}%` : '未设置美元预算' });
    gauge.innerHTML = `<svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" fill="none" stroke="rgba(120,170,255,.14)" stroke-width="4"/><circle cx="23" cy="23" r="19" fill="none" stroke="${gaugeColor}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${circ * frac} ${circ}" transform="rotate(-90 23 23)" style="filter:drop-shadow(0 0 4px ${gaugeColor})"/><text x="23" y="27" text-anchor="middle" fill="#e7eef9" font-size="11" font-family="monospace">${budget > 0 ? Math.round(frac * 100) + '%' : '∞'}</text></svg>`;
    gauge.append(h('div.num', {}, money(spent), h('small', {}, budget > 0 ? `预算 ${money(budget)}` : '预算不限'), h('small', {}, `${tokens(S.usage.inputTokens + S.usage.outputTokens)} tok · ${S.usage.calls} 调用`)));

    const prop = h('div.prop', {},
      h('div.t', {}, statusChip(C0.status, 'C0 '), h('span.name', { title: '双击重命名', ondblclick: rename }, S.title)),
      html('div.q', mdInline(C0.versions[0].statement), { title: C0.statusReason }));
    const pipeline = h('div.pipeline', {},
      h('div.round', {}, 'ROUND', h('b', {}, `${Math.min(r, S.settings.maxRounds)}/${S.settings.maxRounds}`)),
      ...phases.map((p, i) => {
        const cls = i < curIdx ? (skipped.has(p) ? 'skip' : 'done') : i === curIdx ? `now${running ? ' live' : ''}` : '';
        return h(`div.ph${cls ? '.' + cls.split(' ').join('.') : ''}`, { title: PHASE_NAME[p] }, PHASE_NAME[p], i === curIdx && prog.length ? h('span.bar', { style: { width: `${pct}%` } }) : null);
      }));
    const c = h('div.controls');
    if (running) {
      c.append(h('button.btn.warn', { onclick: () => act('pause'), disabled: S.status === 'pausing' }, icon('pause'), S.status === 'pausing' ? '暂停中…' : '暂停'),
        h('button.btn.icon.danger', { title: '立即中止进行中的调用（已中止的工作会在继续时重做）', onclick: () => act('abort') }, icon('stop')));
    } else if (S.cursor.phase === 'done') {
      c.append(h('button.btn', { onclick: extend }, icon('plusCircle'), '追加一轮'), h('button.btn.primary', { onclick: () => switchTab('report') }, icon('report'), '查看报告'));
    } else {
      c.append(h('button.btn.go', { onclick: () => act('start') }, icon('play'), S.status === 'ready' ? '开始研究' : '继续'),
        h('button.btn.icon', { title: '单步：执行一个阶段后暂停', onclick: () => act('start', { step: true }) }, icon('step')),
        h('button.btn.icon', { title: '立即结束并生成报告', onclick: conclude }, icon('report')));
    }
    c.append(h('button.btn.icon.ghost.ctltoggle', { title: '控制面板', onclick: () => grid.classList.toggle('showctl') }, icon('panel')));
    clear(cbar, prop, h('div.row', {}, pipeline, c), gauge);
  }

  async function act(what, body = {}) {
    try {
      await post(`/api/sessions/${id}/${what}`, body);
      if (what === 'start') { S.status = 'running'; mark('bar', 'ctl'); }
    } catch (e) { toast(e.message, 'err'); }
  }
  async function conclude() {
    if (!(await confirmBox('结束研究', '立即结束研究并由主持人撰写报告？已完成的论证与核验都会保留。', { ok: '结束并生成报告' }))) return;
    act('conclude');
  }
  async function extend() {
    try { await post(`/api/sessions/${id}/extend`, { rounds: 1 }); await resync(); toast('已追加一轮，可点击「继续」', 'ok'); } catch (e) { toast(e.message, 'err'); }
  }
  async function rename() {
    const input = h('input.input', { value: S.title });
    const m = modal('重命名研究', input, { foot: [h('button.btn', { onclick: () => m.close() }, '取消'), h('button.btn.primary', { onclick: async () => {
      try { await put(`/api/sessions/${id}/title`, { title: input.value }); S.title = input.value; mark('bar'); m.close(); } catch (e) { toast(e.message, 'err'); }
    } }, '保存')] });
    input.focus();
  }

  // ───────────────────────── roster ─────────────────────────
  function renderRoster() {
    const running = S.status === 'running' || S.status === 'pausing';
    clear(roster,
      h('div.panel-head', {}, h('span.zh', {}, '研究团队'), h('span.mono', {}, `${S.team.filter((r) => r.active !== false).length}`), h('span.grow'),
        h('button.btn.xs.ghost', { disabled: running, title: running ? '暂停后可调整团队' : '调整团队', onclick: teamDialog }, icon('users'), '调整')),
      h('div.scroll', {}, ...S.team.map((r) => {
        const st = S.ledger.stances.C0?.[r.id];
        const pos = st ? (st.position === 'agree' ? 0.5 + st.confidence / 2 : st.position === 'disagree' ? 0.5 - st.confidence / 2 : 0.5) : null;
        const state = r.stats.state;
        return h(`div.rcard${selected === r.id ? '.sel' : ''}${r.active === false ? '.off' : ''}`, { style: { '--c': r.color }, onclick: () => { selected = selected === r.id ? null : r.id; mark('roster', 'view'); } },
          h('div.top', {}, h('span.badge-letter', { style: { '--c': r.color } }, r.label),
            h('div.grow', {}, h('div.model', { title: r.modelId }, r.modelId), h('div.rprov', {}, `${r.providerName} · ${r.vendor}`)),
            h(`span.state${state === 'thinking' ? '.thinking' : state === 'streaming' ? '.streaming' : r.stats.lastError && r.stats.errors ? '.err' : ''}`, { title: { thinking: '思考中', streaming: '输出中', idle: '空闲' }[state] || state })),
          h('div.roleline', {}, h('span.chip', {}, r.role === 'chair' ? '★ ' + roleName(r.role) : roleName(r.role)),
            r.thinking && r.thinking !== 'inherit' ? h('span.chip', {}, `思考${{ on: '开', off: '关', auto: '默认' }[r.thinking]}`) : null,
            st ? h('span.chip.mono', { style: { color: { agree: 'var(--emerald)', disagree: 'var(--rose)', unsure: 'var(--amber)' }[st.position] } }, `C0 ${POS[st.position]} ${Math.round(st.confidence * 100)}%`) : null),
          pos != null ? h('div.stancebar', { title: '对 C0 的立场（左：反对，右：同意）' }, h('i', { style: { left: `${pos * 100}%`, background: pos > 0.55 ? 'var(--emerald)' : pos < 0.45 ? 'var(--rose)' : 'var(--amber)', boxShadow: '0 0 8px currentColor' } })) : null,
          h('div.stats', {}, h('span', {}, `${r.stats.calls} 次`), h('span', {}, `${tokens(r.stats.inputTokens + r.stats.outputTokens)} tok`), h('span', {}, money(r.stats.costUsd))),
          r.stats.errors ? h('div.errline', { title: r.stats.lastError }, `⚠ ${r.stats.errors} 次失败：${r.stats.lastError}`) : null);
      })));
  }

  async function teamDialog() {
    const { providers } = await get('/api/providers');
    const update = new Map();
    const add = [];
    const rows = S.team.map((r) => {
      const u = { id: r.id };
      update.set(r.id, u);
      const prov = h('select.select', {}, ...providers.map((p) => h('option', { value: p.id, selected: p.id === r.providerId }, p.name)));
      const model = h('input.input.mono', { value: r.modelId });
      const role = h('select.select', {}, ...Object.entries(app.meta.roles).map(([k, x]) => h('option', { value: k, selected: k === r.role }, x.name)));
      const active = h('input', { type: 'checkbox', checked: r.active !== false });
      prov.onchange = () => { u.providerId = prov.value; const p = providers.find((x) => x.id === prov.value); model.value = p?.models[0]?.id || ''; u.modelId = model.value; };
      model.oninput = () => { u.modelId = model.value.trim(); u.providerId = prov.value; };
      role.onchange = () => { u.role = role.value; };
      active.onchange = () => { u.active = active.checked; };
      return h('div.team-row', { style: { gridTemplateColumns: '30px 1fr 1.3fr 120px 70px' } }, h('span.badge-letter', { style: { '--c': r.color } }, r.label), prov, model, role, h('label.check', {}, active, '在任'));
    });
    const addBox = h('div');
    const addRow = () => {
      if (S.team.length + add.length >= 10) return toast('最多 10 名研究员', 'err');
      const a = { providerId: providers[0]?.id, modelId: providers[0]?.models[0]?.id || '', role: 'generalist' };
      add.push(a);
      const prov = h('select.select', { onchange: (e) => { a.providerId = e.target.value; const p = providers.find((x) => x.id === a.providerId); a.modelId = p?.models[0]?.id || ''; model.value = a.modelId; } }, ...providers.map((p) => h('option', { value: p.id }, p.name)));
      const model = h('input.input.mono', { value: a.modelId, oninput: (e) => { a.modelId = e.target.value.trim(); } });
      const role = h('select.select', { onchange: (e) => { a.role = e.target.value; } }, ...Object.entries(app.meta.roles).filter(([k]) => k !== 'chair').map(([k, x]) => h('option', { value: k, selected: k === 'generalist' }, x.name)));
      addBox.append(h('div.team-row', { style: { gridTemplateColumns: '30px 1fr 1.3fr 120px 70px', marginTop: '8px' } }, h('span.badge-letter', { style: { '--c': '#8b9ab3' } }, '+'), prov, model, role, h('span')));
    };
    const m = modal('调整研究团队', h('div', {}, h('p.hint', { style: { marginTop: 0 } }, '暂停期间可以更换模型、调整角色、让研究员离任或加入新研究员；历史贡献会保留。'), ...rows, addBox,
      h('button.btn.sm', { style: { marginTop: '10px' }, onclick: addRow }, icon('plus'), '加入研究员')), {
      wide: true,
      foot: [h('button.btn', { onclick: () => m.close() }, '取消'), h('button.btn.primary', { onclick: async () => {
        try {
          await put(`/api/sessions/${id}/team`, { update: [...update.values()].filter((u) => Object.keys(u).length > 1), add: add.filter((a) => a.modelId) });
          m.close();
          await resync();
          toast('团队已更新', 'ok');
        } catch (e) { toast(e.message, 'err'); }
      } }, '保存')],
    });
  }

  // ───────────────────────── control column ─────────────────────────
  const feedBox = h('div.feed');
  const feedScroll = h('div.scroll', {}, feedBox);
  let feedStick = true;
  feedScroll.addEventListener('scroll', () => { feedStick = feedScroll.scrollHeight - feedScroll.scrollTop - feedScroll.clientHeight < 80; });
  const ctlTop = h('div');
  let piTab = 'directive';
  const piBox = h('div');
  ctl.append(h('div.panel-head', {}, h('span.zh', {}, '首席研究员控制台'), h('span.grow'), h('button.btn.xs.ghost', { onclick: settingsDialog }, icon('sliders'), '规程')), ctlTop, h('div.ctl-section', {}, piBox), h('div.panel-head', {}, h('span.zh', {}, '研究日志'), h('span.grow'), h('span.mono.faint', { id: 'conn' }, '')), feedScroll);

  function renderCtl() {
    const light = h(`span.status-light.${S.status}`);
    const groups = S.plan?.groups || [];
    const alarms = S.plan?.alarms || [];
    const prog = S.plan?.progress || {};
    const remaining = S.settings.budgetUsd > 0 ? Math.max(0, S.settings.budgetUsd - S.usage.costUsd) : null;
    clear(ctlTop,
      h('div.ctl-section', {},
        h('div.status-line', {}, light, h('span.big', {}, SESSION_STATUS[S.status] || S.status), h('span.dim', {}, `· 第 ${S.cursor.round} 轮 · ${PHASE_NAME[S.cursor.phase] || S.cursor.phase}`)),
        S.pauseReason && S.status !== 'running' ? h('div.hint', { style: { marginTop: '6px' } }, S.pauseReason) : null,
        h('div.row.wrap', { style: { marginTop: '8px' } },
          h('span.chip.mono', {}, `核验门槛 ${S.settings.minVerifiers}${S.settings.crossVendor ? ' · 跨厂商' : ''}`),
          h('span.chip.mono', {}, S.settings.anonymize ? '匿名评审' : '实名评审'),
          remaining != null ? h('span.chip.mono', {}, `余额 ${money(remaining)}`) : null)),
      groups.length ? h('div.ctl-section', {},
        h('div.sub', {}, `DYNAMIC GROUPS · ${PHASE_NAME[S.plan.phase] || ''}`),
        h('div.groups', {}, ...groups.slice(0, 12).map((g) => h(`div.group${g.redTeam ? '.red' : ''}`, {}, h('span', {}, g.name), h('span.mem', {}, ...g.members.map((rid) => {
          const r = S.team.find((x) => x.id === rid);
          const p = prog[rid];
          return r ? h('span.badge-letter', { style: { '--c': r.color, opacity: p === 'done' ? 0.5 : 1 }, title: `${r.label} · ${{ pending: '等待', running: '进行中', done: '完成', failed: '失败' }[p] || ''}` }, r.label) : null;
        }))))),
        ...alarms.map((a) => h('div.hint', { style: { color: '#ffd7a0', marginTop: '6px' } }, `⚠ 共识警报：${a.target} 同意率 ${Math.round(a.agreeRatio * 100)}% 但未证明，已组建红队`))) : null);
    renderPi();
  }

  function renderPi() {
    const tabs = [['directive', '指示'], ['claim', '断言'], ['objection', '质疑'], ['ask', '提问']];
    const body = h('div.col', { style: { gap: '8px' } });
    const claims = Object.values(S.ledger.claims);
    if (piTab === 'directive') {
      const ta = h('textarea.textarea', { rows: 3, placeholder: '对全体研究员的指示，例如：请优先检查 n 为偶数的情形；不要使用未经证明的猜想。' });
      body.append(ta, h('button.btn.sm.primary', { onclick: async () => { if (!ta.value.trim()) return; try { await post(`/api/sessions/${id}/directives`, { text: ta.value }); ta.value = ''; toast('指示已发布，将出现在之后的所有提示中', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, '发布指示'),
        ...(S.directives || []).slice().reverse().map((d) => h(`div.directive${d.active ? '' : '.off'}`, {}, h('div.grow', {}, d.text), h('button.btn.xs.ghost', { onclick: async () => { await put(`/api/sessions/${id}/directives/${d.id}`, { active: !d.active }); } }, d.active ? '停用' : '启用'))));
    } else if (piTab === 'claim') {
      const kind = h('select.select', {}, ...['lemma', 'theorem', 'conjecture', 'counterexample', 'observation', 'definition'].map((k) => h('option', { value: k }, KIND[k])));
      const rel = h('select.select', {}, h('option', { value: '' }, '无关系'), h('option', { value: 'proves' }, '证明 →'), h('option', { value: 'refutes' }, '否定 →'), h('option', { value: 'supports' }, '支持 →'));
      const target = h('select.select', {}, ...claims.map((c) => h('option', { value: c.id }, c.id)));
      const st = h('textarea.textarea', { rows: 2, placeholder: '断言陈述（支持 LaTeX）' });
      const pf = h('textarea.textarea', { rows: 2, placeholder: '证明或证据（可选）' });
      body.append(h('div.grid3', { style: { gap: '6px' } }, kind, rel, target), st, pf, h('div.hint', {}, 'PI 提出的断言同样需要独立核验才会被标记为已证明。'),
        h('button.btn.sm.primary', { onclick: async () => { try { const r = await post(`/api/sessions/${id}/claims`, { kind: kind.value, relation: rel.value || null, target: rel.value ? target.value : null, statement: st.value, proof: pf.value }); toast(`已记入账本：${r.id}`, 'ok'); st.value = pf.value = ''; } catch (e) { toast(e.message, 'err'); } } }, '记入账本'));
    } else if (piTab === 'objection') {
      const target = h('select.select', {}, ...claims.filter((c) => !c.withdrawn).map((c) => h('option', { value: c.id }, `${c.id} · ${STATUS[c.status]}`)));
      const type = h('select.select', {}, ...Object.entries(OTYPE).map(([k, n]) => h('option', { value: k }, n)));
      const sev = h('select.select', {}, ...Object.entries(SEV).map(([k, n]) => h('option', { value: k, selected: k === 'major' }, n)));
      const ta = h('textarea.textarea', { rows: 3, placeholder: '指出问题：哪一步、为什么不成立' });
      body.append(h('div.grid3', { style: { gap: '6px' } }, target, type, sev), ta,
        h('button.btn.sm.primary', { onclick: async () => { try { const r = await post(`/api/sessions/${id}/objections`, { target: target.value, type: type.value, severity: sev.value, content: ta.value }); toast(`已提出质疑 ${r.id}，作者将在答辩阶段回应`, 'ok'); ta.value = ''; } catch (e) { toast(e.message, 'err'); } } }, '提出质疑'));
    } else {
      const who = h('select.select', {}, ...S.team.filter((r) => r.active !== false).map((r) => h('option', { value: r.id, selected: r.id === selected }, `${r.label} · ${r.modelId}`)));
      const ta = h('textarea.textarea', { rows: 3, placeholder: '直接向某位研究员提问；回答会记入研究记录，其中的标记会进入账本。' });
      const btn = h('button.btn.sm.primary', { onclick: async () => {
        if (!ta.value.trim()) return;
        btn.disabled = true; btn.textContent = '等待回答…';
        try { const r = await post(`/api/sessions/${id}/consult`, { rid: who.value, question: ta.value }); ta.value = ''; openContribution(r.contribution); } catch (e) { toast(e.message, 'err'); } finally { btn.disabled = false; btn.textContent = '提问'; }
      } }, '提问');
      body.append(who, ta, btn);
    }
    clear(piBox, h('div.pi-tabs', {}, ...tabs.map(([k, n]) => h(`button${piTab === k ? '.on' : ''}`, { onclick: () => { piTab = k; renderPi(); } }, n))), body);
  }

  function settingsDialog() {
    const s = { ...S.settings };
    const num = (k, label, attrs) => h('label.field', {}, h('span', {}, label), h('input.input.mono', { type: 'number', value: s[k], ...attrs, oninput: (e) => { s[k] = +e.target.value; } }));
    const chk = (k, label) => h('label.check', {}, h('input', { type: 'checkbox', checked: !!s[k], onchange: (e) => { s[k] = e.target.checked; } }), label);
    const m = modal('研究规程与预算', h('div.col', { style: { gap: '14px' } },
      h('div.grid3', {}, num('maxRounds', '最多轮次', { min: 1, max: 12 }), num('minVerifiers', '证明所需核验人数', { min: 1, max: 5 }), num('reviewersPerClaim', '每条断言质询人数', { min: 1, max: 4 })),
      h('div.grid3', {}, num('budgetUsd', '预算（美元，0 不限）', { min: 0, step: 0.5 }), num('maxTotalTokens', 'Token 上限（0 不限）', { min: 0 }), num('concurrency', '并发调用', { min: 1, max: 16 })),
      h('div.grid3', {}, num('maxOutputTokens', '单次输出上限', { min: 512, step: 512 }), num('temperature', '温度', { min: 0, max: 2, step: 0.1 }), num('contextChars', '账本摘要预算（字符）', { min: 4000, step: 2000 })),
      h('div.grid2', {}, chk('crossVendor', '要求跨厂商核验'), chk('anonymize', '匿名评审'), chk('computeSandbox', '计算核验沙箱'), chk('autoAdvance', '自动推进'), chk('earlyStop', '允许提前结束'), chk('formatRepair', '格式修复'))), {
      wide: true,
      foot: [h('button.btn', { onclick: () => m.close() }, '取消'), h('button.btn.primary', { onclick: async () => { try { const r = await put(`/api/sessions/${id}/settings`, s); S.settings = r.settings; mark('bar', 'ctl'); m.close(); toast('规程已更新', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, '保存')],
    });
  }

  // ───────────────────────── feed ─────────────────────────
  function feedEntry(f) {
    const r = f.rid ? S.team.find((x) => x.id === f.rid) : null;
    return h('div.fe', { dataset: { k: f.kind } }, h('time', {}, clock(f.at)), h('span.ico'),
      html('div.tx2', mdInline(f.text), { style: r ? { borderLeft: `2px solid ${r.color}`, paddingLeft: '6px' } : null }));
  }
  function renderFeedAll() {
    clear(feedBox, ...S.feed.slice(-400).map(feedEntry));
    feedStick = true;
    requestAnimationFrame(() => { feedScroll.scrollTop = feedScroll.scrollHeight; });
  }
  function appendFeed(f) {
    feedBox.append(feedEntry(f));
    while (feedBox.childElementCount > 600) feedBox.firstChild.remove();
    if (feedStick) requestAnimationFrame(() => { feedScroll.scrollTop = feedScroll.scrollHeight; });
  }

  // ───────────────────────── stage tabs ─────────────────────────
  function renderTabs() {
    const counts = {
      ledger: Object.keys(S.ledger.claims).length - 1,
      transcript: S.contributions.length,
      telemetry: S.calls.length,
    };
    clear(tabsBar, ...TABS.map(([k, ic, name]) => h(`button${tab === k ? '.on' : ''}`, { role: 'tab', 'aria-selected': tab === k, onclick: () => switchTab(k) }, icon(ic), name, counts[k] ? h('span.count', {}, counts[k]) : null)));
  }
  function switchTab(k) {
    tab = k;
    sessionStorageSet(`tab:${id}`, k);
    for (const [name, v] of Object.entries(views)) v.el.classList.toggle('hidden', name !== k);
    ensureView(k);
    renderTabs();
    mark('view');
  }
  function ensureView(k) {
    if (views[k]) return views[k];
    const el = h('div.view');
    stageBody.append(el);
    const v = { el };
    views[k] = v;
    if (k === 'arena') {
      const box = h('div.arena');
      const c0 = h('div.c0card');
      box.append(c0, h('div.legend', {}, ...[['#4de8ff', '提出断言'], ['#ff5c8a', '质疑'], ['#34f5a4', '核验有效'], ['#ffb547', '裁定/核验存疑'], ['#b18cff', '答辩']].map(([c, n]) => h('span', {}, h('i', { style: { background: c } }), n))));
      v.tx = h('div.transmissions');
      el.append(box, v.tx);
      v.c0 = c0;
      v.arena = createArena(box, { getState: () => S, onSelect: (rid) => { selected = rid; mark('roster'); } });
    } else if (k === 'graph') {
      const box = h('div.graph');
      const tip = h('div.panel.tip.hidden');
      box.append(tip,
        h('div.panel.legend', {}, ...['proved', 'conditional', 'pending', 'disputed', 'conjecture', 'refuted'].map((s) => h('span', {}, h('span.sw', { style: { background: STATUS_COLOR[s] } }), STATUS[s])),
          h('span', {}, '◆ 质疑'), h('span', {}, '⬢ 定理 ● 引理'), h('span', {}, '▲ 反例 ◆ 猜想'), h('span', {}, '→ 证明/否定 ⇢ 依赖')),
        h('div.tools', {}, h('button.btn.sm', { onclick: () => v.graph.reset() }, icon('refresh'), '重置视图')));
      el.append(box);
      v.graph = createGraph(box, {
        getState: () => S,
        onOpen: openClaim,
        tip: (text, x, y) => { if (!text) { tip.classList.add('hidden'); return; } tip.textContent = text; tip.style.whiteSpace = 'pre-wrap'; tip.style.left = `${x}px`; tip.style.top = `${y}px`; tip.classList.remove('hidden'); },
      });
    } else if (k === 'ledger') {
      v.bar = h('div.toolbar');
      v.list = h('div.scroll');
      el.append(v.bar, v.list);
    } else {
      v.body = h('div.scroll');
      el.append(v.body);
    }
    return v;
  }

  // ───────────────────────── arena transmissions ─────────────────────────
  function renderTx() {
    const v = views.arena;
    if (!v || tab !== 'arena') return;
    const C0 = S.ledger.claims.C0;
    clear(v.c0, h('div.lbl', {}, 'PROPOSITION · C0'), h('div.st', { style: { color: STATUS_COLOR[C0.status] } }, STATUS[C0.status]), h('div.why', {}, C0.statusReason));
    const cards = [...liveCalls.values()].sort((a, b) => a.rec.startedAt.localeCompare(b.rec.startedAt));
    if (!cards.length) {
      const recent = S.contributions.slice(-6).reverse();
      clear(v.tx, ...(recent.length ? recent.map((c) => {
        const r = S.team.find((x) => x.id === c.rid) || { color: '#8b9ab3', label: '?', modelId: '' };
        return h('div.tx.done', { style: { '--c': r.color, cursor: 'pointer' }, onclick: () => openContribution(c) },
          h('div.h', {}, h('span.badge-letter', { style: { '--c': r.color } }, r.label), h('span.mono', {}, r.modelId), h('span.grow'), h('span.chip', {}, PHASE_NAME[c.phase])),
          h('div.body', { style: { fontFamily: 'var(--font)', fontSize: '12px' } }, c.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 360)));
      }) : [h('div.empty', { style: { gridColumn: '1 / -1', padding: '24px' } }, S.status === 'ready' ? '点击「开始研究」，研究员将同时独立展开分析，实时输出会出现在这里。' : '暂无进行中的调用。')]));
      return;
    }
    clear(v.tx, ...cards.map((lc) => {
      const r = S.team.find((x) => x.id === lc.rec.rid) || { color: '#8b9ab3', label: '?' };
      const done = lc.rec.status !== 'running';
      return h(`div.tx${done ? '.done' : ''}`, { style: { '--c': r.color } },
        h('div.h', {}, h('span.badge-letter', { style: { '--c': r.color } }, r.label), h('span.mono', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, lc.rec.modelId), h('span.grow'),
          h('span.chip', {}, `${PHASE_NAME[lc.rec.phase] || lc.rec.phase}${lc.rec.kind !== 'main' ? ' · 追问' : ''}`),
          h('span.chip.mono', {}, done ? (lc.rec.status === 'ok' ? `✓ ${ms(lc.rec.latencyMs)}` : '✗') : ms(Date.now() - new Date(lc.rec.startedAt).getTime()))),
        lc.retry ? h('div.hint', { style: { color: '#ffd7a0' } }, lc.retry) : null,
        lc.thinking ? h('div.think', {}, lc.thinking.slice(-320)) : null,
        h('div.body', {}, lc.text.slice(-1400), done ? null : h('span.cursor')));
    }));
  }

  // ───────────────────────── ledger ─────────────────────────
  function claimDetail(c) {
    const L = S.ledger;
    const cur = c.versions[c.versions.length - 1];
    const lab = (rid) => { const r = S.team.find((x) => x.id === rid); return r ? `研究员 ${r.label}` : rid === 'PI' ? '首席研究员' : rid; };
    const who = (rid) => { const r = S.team.find((x) => x.id === rid); return r ? h('span.row', { style: { gap: '5px', display: 'inline-flex' } }, h('span.badge-letter', { style: { '--c': r.color, width: '16px', height: '16px', fontSize: '9px' } }, r.label), h('span.mono', {}, r.modelId)) : h('span', {}, lab(rid)); };
    const out = h('div.detail');
    if (cur.proof) out.append(h('div', {}, h('div.sub', {}, `PROOF · 证明（第 ${cur.v} 版）`), html('div.md', md(cur.proof))));
    if (cur.evidence) out.append(h('div', {}, h('div.sub', {}, 'EVIDENCE'), html('div.md', md(cur.evidence))));
    if (c.depends.length || c.relation) out.append(h('div.row.wrap', {}, c.relation ? h('span.chip', {}, `${{ proves: '证明', refutes: '否定', supports: '支持', generalizes: '推广' }[c.relation]} → `, h('span.ref', { dataset: { ref: c.target } }, c.target)) : null, ...c.depends.map((d) => h('span.chip', {}, '依赖 ', h('span.ref', { dataset: { ref: d } }, d)))));
    const objs = Object.values(L.objections).filter((o) => o.target === c.id);
    if (objs.length) out.append(h('div', {}, h('div.sub', {}, `OBJECTIONS · 质疑 ${objs.length}`), h('div.thread', {}, ...objs.map((o) => h('div.item', {},
      h('div.who', {}, h('span.mono', { style: { color: 'var(--rose)' } }, o.id), who(o.author), h('span.chip', {}, `${OTYPE[o.type]} · ${SEV[o.severity]}`), h('span.chip', { style: { color: ['upheld', 'conceded'].includes(o.state) ? 'var(--rose)' : o.state === 'dismissed' ? 'var(--dim)' : 'var(--amber)' } }, OSTATE[o.state] || o.state), o.targetVersion < cur.v ? h('span.chip', {}, `针对 v${o.targetVersion}`) : null),
      html('div.md', md(o.content)),
      o.counterexample ? h('div', {}, h('div.sub', {}, 'COUNTEREXAMPLE'), html('div.md', md(o.counterexample))) : null,
      ...o.responses.map((r) => h('div', { style: { marginTop: '6px', paddingLeft: '10px', borderLeft: '2px solid rgba(167,139,250,.4)' } }, h('div.who', {}, '答辩 · ', who(r.by), h('span.chip', {}, { concede: '承认', rebut: '反驳', revise: '修订' }[r.action])), html('div.md', md(r.content)))),
      ...o.rulings.map((r) => h('div', { style: { marginTop: '6px', paddingLeft: '10px', borderLeft: '2px solid rgba(255,181,71,.4)' } }, h('div.who', {}, '裁定 · ', who(r.by), h('span.chip', {}, r.ruling === 'upheld' ? '质疑成立' : '质疑驳回')), html('div.md', md(r.content)))))))));
    const vs = Object.values(L.verdicts).filter((v) => v.target === c.id);
    if (vs.length) out.append(h('div', {}, h('div.sub', {}, `VERIFICATION · 核验 ${vs.length}`), h('div.thread', {}, ...vs.map((v) => h('div.item', {},
      h('div.who', {}, h('span.mono', {}, v.id), who(v.by), h('span.chip', { style: { color: v.verdict === 'valid' ? 'var(--emerald)' : v.verdict === 'unverifiable' ? 'var(--dim)' : 'var(--rose)' } }, VERDICT[v.verdict]), v.targetVersion < cur.v ? h('span.chip', {}, `针对 v${v.targetVersion}（已过期）`) : null),
      html('div.md', md(v.content)))))));
    const evs = Object.values(L.evidence).filter((e) => e.target === c.id);
    if (evs.length) out.append(h('div', {}, h('div.sub', {}, 'COMPUTATION · 计算证据'), ...evs.map(evidenceBlock)));
    const st = Object.entries(L.stances[c.id] || {});
    if (st.length) out.append(h('div', {}, h('div.sub', {}, 'STANCES · 立场（不参与判定）'), h('div.row.wrap', {}, ...st.map(([rid, s]) => h(`span.stance-chip.${s.position}`, { title: s.reason }, `${lab(rid)} · ${POS[s.position]} ${Math.round(s.confidence * 100)}%`)))));
    if (c.versions.length > 1) out.append(h('div', {}, h('div.sub', {}, 'HISTORY · 版本'), ...c.versions.slice(0, -1).map((v) => h('details', {}, h('summary', { style: { cursor: 'pointer', fontSize: '12px', color: 'var(--dim)' } }, `第 ${v.v} 版 · 第 ${v.round} 轮`), html('div.md', md(v.statement + (v.proof ? `\n\n**证明**：${v.proof}` : '')))))));
    out.append(h('div.hint', {}, `状态轨迹：${c.statusHistory.map((x) => `R${x.round} ${STATUS[x.status]}`).join(' → ') || '—'}`));
    return out;
  }

  function evidenceBlock(e) {
    const r = S.team.find((x) => x.id === e.by);
    return h('div', { style: { marginTop: '6px' } },
      h('div.who', { style: { fontSize: '11.5px', color: 'var(--dim)' } }, `${e.id} · ${r ? `研究员 ${r.label}` : e.by} · ${e.purpose || ''} · ${e.ok ? `成功 ${e.durationMs}ms` : '失败'}`),
      h('pre', { class: 'md', style: { margin: '4px 0' } }, h('code', {}, e.code)),
      h('div.test-out', { class: e.ok ? 'test-out ok' : 'test-out bad' }, e.ok ? (e.output || '（无输出）') : e.error));
  }

  function renderLedger() {
    const v = views.ledger;
    if (!v || tab !== 'ledger') return;
    const all = Object.values(S.ledger.claims);
    const counts = {};
    for (const c of all) counts[c.status] = (counts[c.status] || 0) + 1;
    const filters = [['all', '全部', all.length], ...['proved', 'conditional', 'pending', 'disputed', 'conjecture', 'refuted', 'withdrawn', 'open', 'inconsistent'].filter((s) => counts[s]).map((s) => [s, STATUS[s], counts[s]])];
    const search = h('input.input', { placeholder: '搜索断言…', value: ledgerQuery, style: { width: '180px', height: '28px', marginLeft: 'auto' } });
    search.addEventListener('input', () => { ledgerQuery = search.value; renderLedgerList(); });
    clear(v.bar, ...filters.map(([k, n, cnt]) => h(`button.filter${ledgerFilter === k ? '.on' : ''}`, { onclick: () => { ledgerFilter = k; renderLedger(); } }, k !== 'all' ? h('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: STATUS_COLOR[k] } }) : null, n, h('span.n', {}, cnt))), search);
    renderLedgerList();
  }

  function renderLedgerList() {
    const v = views.ledger;
    const scroll = v.list.scrollTop;
    const q = ledgerQuery.trim().toLowerCase();
    const list = Object.values(S.ledger.claims)
      .filter((c) => ledgerFilter === 'all' || c.status === ledgerFilter)
      .filter((c) => !selected || c.author === selected || c.id === 'C0')
      .filter((c) => !q || c.versions[c.versions.length - 1].statement.toLowerCase().includes(q) || c.id.toLowerCase() === q);
    clear(v.list, ...list.map((c) => {
      const cur = c.versions[c.versions.length - 1];
      const r = S.team.find((x) => x.id === c.author);
      const k = consensus(c.id);
      const open = expanded.has(c.id);
      return h('article.claim', { style: { '--sc': STATUS_COLOR[c.status] } },
        h('div.ch', { onclick: () => { open ? expanded.delete(c.id) : expanded.add(c.id); renderLedgerList(); } },
          h('span.id', {}, c.id), statusChip(c.status), h('span.kind', {}, KIND[c.kind] || c.kind), cur.v > 1 ? h('span.chip.mono', {}, `v${cur.v}`) : null,
          r ? h('span.badge-letter', { style: { '--c': r.color, width: '20px', height: '20px', fontSize: '10px' }, title: r.modelId }, r.label) : h('span.chip', {}, 'PI'),
          h('span.grow'),
          k.n ? h('div.cbar-mini', { title: `同意 ${k.agree} · 不确定 ${k.unsure} · 反对 ${k.disagree}` }, h('span', { style: { flex: k.agree, background: 'var(--emerald)' } }), h('span', { style: { flex: k.unsure, background: 'var(--amber)' } }), h('span', { style: { flex: k.disagree, background: 'var(--rose)' } })) : null,
          h('span.faint', {}, open ? '▾' : '▸')),
        html('div.stmt.md', md(cur.statement)),
        h('div.reason', {}, c.statusReason),
        open ? claimDetail(c) : null);
    }));
    if (!list.length) v.list.append(h('div.empty', {}, '没有符合条件的断言。'));
    v.list.scrollTop = scroll;
  }

  function consensus(cid) {
    const out = { agree: 0, disagree: 0, unsure: 0, n: 0 };
    const active = new Set(S.team.filter((r) => r.active !== false).map((r) => r.id));
    for (const [rid, s] of Object.entries(S.ledger.stances[cid] || {})) { if (!active.has(rid)) continue; out[s.position]++; out.n++; }
    return out;
  }

  function openClaim(cid) {
    const L = S.ledger;
    let c = L.claims[cid];
    if (!c && L.objections[cid]) c = L.claims[L.objections[cid].target];
    if (!c && L.evidence[cid]) { modal(`计算证据 ${cid}`, evidenceBlock(L.evidence[cid])); return; }
    if (!c) return;
    const cur = c.versions[c.versions.length - 1];
    const r = S.team.find((x) => x.id === c.author);
    drawer(h('div.row', {}, h('span.mono', { style: { color: STATUS_COLOR[c.status], fontWeight: 700 } }, c.id), statusChip(c.status), h('span.dim', {}, KIND[c.kind])),
      h('div.col', { style: { gap: '12px' } },
        h('div.hint', {}, `${r ? `研究员 ${r.label} · ${r.modelId}` : '首席研究员'} · 第 ${c.round} 轮提出`),
        html('div.md', md(cur.statement), { style: { fontSize: '15px' } }),
        h('div.hint', {}, `判定依据：${c.statusReason}`),
        claimDetail(c)));
  }

  // ───────────────────────── consensus view ─────────────────────────
  function renderConsensus() {
    const v = views.consensus;
    if (!v || tab !== 'consensus') return;
    const L = S.ledger;
    if (!L.claims[consClaim]) consClaim = 'C0';
    const sel = h('select.select', { style: { width: '220px', height: '30px' }, onchange: (e) => { consClaim = e.target.value; renderConsensus(); } },
      ...Object.values(L.claims).filter((c) => !c.withdrawn).map((c) => h('option', { value: c.id, selected: c.id === consClaim }, `${c.id} · ${STATUS[c.status]}`)));
    const warnings = consensusWarningsClient();
    const st = Object.entries(L.stances[consClaim] || {});
    clear(v.body, h('div.cons', {},
      h('div.panel.hud.card', {},
        h('div.row', { style: { marginBottom: '8px' } }, h('div', {}, h('div.eyebrow', {}, 'CONSENSUS DRIFT'), h('div', { style: { fontWeight: 600 } }, '立场分布随研究阶段的演化')), h('span.grow'), sel),
        consensusChart(S.consensus, consClaim),
        h('div.row.wrap', { style: { gap: '14px', fontSize: '11.5px', color: 'var(--dim)', marginTop: '4px' } }, h('span', { style: { color: 'var(--emerald)' } }, '■ 同意'), h('span', { style: { color: 'var(--amber)' } }, '■ 不确定'), h('span', { style: { color: 'var(--rose)' } }, '■ 反对'), h('span', {}, '下方色带 = 该时刻由证据决定的状态')),
        st.length ? h('table.data', { style: { marginTop: '12px' } }, h('thead', {}, h('tr', {}, h('th', {}, '研究员'), h('th', {}, '立场'), h('th', {}, '置信度'), h('th', {}, '理由'))),
          h('tbody', {}, ...st.map(([rid, s]) => { const r = S.team.find((x) => x.id === rid); return h('tr', {}, h('td', {}, r ? `${r.label} · ${r.modelId}` : rid), h('td', { style: { color: { agree: 'var(--emerald)', disagree: 'var(--rose)', unsure: 'var(--amber)' }[s.position] } }, POS[s.position]), h('td', {}, `${Math.round(s.confidence * 100)}%`), h('td.wrap', {}, s.reason || '—')); }))) : null),
      h('div.col', { style: { gap: '14px' } },
        h('div.panel.hud.card', {}, h('div.eyebrow', {}, 'CONSENSUS × EVIDENCE'), h('div', { style: { fontWeight: 600, marginBottom: '6px' } }, '共识与证据对照'), evidenceMap(L, S.team.filter((r) => r.active !== false), { onPick: (cid) => { consClaim = cid; renderConsensus(); } })),
        h('div.panel.hud.card', {}, h('div.eyebrow', {}, 'EPISTEMIC ALERTS'), h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, '共识 ≠ 真理'),
          h('div.warnlist', {}, ...(warnings.length ? warnings.map((w) => linkRefs(h('div.warn', {}, w))) : [h('div.warn.ok', {}, '目前没有共识与证据状态背离的断言。')])),
          h('p.hint', {}, '断言状态只由证明、独立核验与反例决定；立场分布仅用于发现群体盲区，并在高共识而未证明时触发红队。')))));
  }

  function consensusWarningsClient() {
    const out = [];
    for (const c of Object.values(S.ledger.claims)) {
      if (c.withdrawn || c.kind === 'definition') continue;
      const k = consensus(c.id);
      if (k.n < 2) continue;
      const ratio = k.agree / k.n;
      if (ratio >= 0.75 && !['proved', 'refuted'].includes(c.status)) out.push(`${c.id}：${Math.round(ratio * 100)}% 研究员同意，但状态为「${STATUS[c.status]}」——高共识不等于已证明。`);
      if (c.status === 'refuted' && k.agree > k.disagree) out.push(`${c.id}：多数研究员仍表示同意，但它已被核验的反例或论证否定。`);
      if (c.status === 'proved' && k.disagree > k.agree) out.push(`${c.id}：证明已通过独立核验，尽管多数研究员表示怀疑——少数派可能是对的。`);
    }
    return out;
  }

  // ───────────────────────── transcript matrix ─────────────────────────
  function renderTranscript() {
    const v = views.transcript;
    if (!v || tab !== 'transcript') return;
    const team = S.team;
    const keys = [];
    const seen = new Set();
    for (const c of S.contributions) {
      const key = `${c.round}|${c.phase}`;
      if (!seen.has(key)) { seen.add(key); keys.push([c.round, c.phase]); }
    }
    if (!keys.length) { clear(v.body, h('div.empty', {}, '研究开始后，每位研究员在每个阶段的贡献会按矩阵排列在这里。')); return; }
    const gridEl = h('div.matrix', { style: { gridTemplateColumns: `112px repeat(${team.length}, minmax(130px, 1fr))` } });
    gridEl.append(h('div.mh', {}, '阶段'), ...team.map((r) => h('div.mh', {}, h('span.badge-letter', { style: { '--c': r.color, width: '18px', height: '18px', fontSize: '9.5px' } }, r.label), h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, r.modelId))));
    for (const [round, phase] of keys) {
      gridEl.append(h('div.rowh', {}, h('b', {}, `ROUND ${round}`), PHASE_NAME[phase] || phase));
      for (const r of team) {
        const cs = S.contributions.filter((c) => c.round === round && c.phase === phase && c.rid === r.id);
        if (!cs.length) { gridEl.append(h('div.cell.none', { style: { '--c': r.color } })); continue; }
        const c = cs[cs.length - 1];
        const it = c.items || {};
        const tags = [['claims', 'C+'], ['objections', 'O'], ['responses', 'R'], ['verdicts', 'V'], ['rulings', '⚖'], ['stances', '±']].filter(([k2]) => it[k2]?.length).map(([k2, l]) => h('span', {}, `${l}${it[k2].length}`));
        if (c.evidence?.length) tags.push(h('span', {}, `E${c.evidence.length}`));
        gridEl.append(h('div.cell', { style: { '--c': r.color }, onclick: () => openContribution(c), title: '查看完整内容' },
          h('div.ic', {}, ...tags, cs.length > 1 ? h('span', {}, `×${cs.length}`) : null),
          h('div.pv', {}, c.text.replace(/<[^>]+>/g, ' ').replace(/[#*$`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120))));
      }
    }
    clear(v.body, gridEl);
  }

  function openContribution(c) {
    const r = S.team.find((x) => x.id === c.rid) || { label: '?', color: '#8b9ab3', modelId: '' };
    const calls = S.calls.filter((x) => c.callIds?.includes(x.id));
    const body = h('div.col', { style: { gap: '12px' } },
      h('div.row.wrap', {}, h('span.badge-letter', { style: { '--c': r.color } }, r.label), h('span.mono', {}, r.modelId), h('span.chip', {}, roleName(r.role)), h('span.chip', {}, `第 ${c.round} 轮 · ${PHASE_NAME[c.phase]}`),
        ...calls.map((x) => h('span.chip.mono', {}, `${tokens(x.inputTokens)}→${tokens(x.outputTokens)} · ${ms(x.latencyMs)} · ${money(x.costUsd)}`))),
      c.task?.question ? h('div.warn', {}, `PI 提问：${c.task.question}`) : null,
      c.thinking ? h('details', {}, h('summary', { style: { cursor: 'pointer', color: '#c3b4ff' } }, `模型思考过程（${c.thinking.length} 字）`), h('div', { style: { whiteSpace: 'pre-wrap', color: 'var(--dim)', fontSize: '12.5px', maxHeight: '320px', overflow: 'auto', marginTop: '6px' } }, c.thinking)) : null,
      html('div.md', renderContribution(c.text, c.mapping)),
      ...(c.followups || []).map((f) => h('div', {}, h('div.sub', {}, f.type === 'compute' ? 'AFTER COMPUTATION · 计算后结论' : 'FORMAT REPAIR · 格式修复'), html('div.md', renderContribution(f.text, c.mapping)))),
      ...(c.evidence || []).map((eid) => S.ledger.evidence[eid] ? evidenceBlock(S.ledger.evidence[eid]) : null),
      c.parseNote ? h('div.hint', {}, c.parseNote) : null);
    modal(`研究员 ${r.label} 的贡献`, body, { wide: true });
  }

  // ───────────────────────── report ─────────────────────────
  function renderReport() {
    const v = views.report;
    if (!v || tab !== 'report') return;
    const bar = h('div.report-bar', {},
      h('a.btn.sm', { href: `/api/sessions/${id}/export?format=md`, download: '' }, icon('download'), 'Markdown'),
      h('a.btn.sm', { href: `/api/sessions/${id}/export?format=json`, download: '' }, icon('download'), '完整记录 JSON'),
      h('button.btn.sm', { onclick: () => print() }, icon('print'), '打印 / PDF'),
      h('span.grow'),
      h('button.btn.sm', { title: '根据当前账本重新生成权威章节（不调用模型）', onclick: async () => { try { const r = await post(`/api/sessions/${id}/report/rebuild`); S.report = r.report; renderReport(); toast('报告已按账本更新', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, icon('refresh'), S.report ? '按账本刷新' : '生成账本草稿'));
    if (!S.report) {
      clear(v.body, bar, h('div.empty', {}, h('h3', {}, '报告尚未生成'), h('p', {}, '研究完成时主持人会撰写叙述部分，系统根据账本生成「已证明 / 已证伪 / 猜想 / 未解决问题」等权威章节。也可以随时生成账本草稿。')));
      return;
    }
    clear(v.body, bar, html('article.report.md', md(S.report.markdown)));
  }

  // ───────────────────────── telemetry ─────────────────────────
  function renderTelemetry() {
    const v = views.telemetry;
    if (!v || tab !== 'telemetry') return;
    const calls = S.calls;
    const ok = calls.filter((c) => c.status === 'ok');
    const avgLat = ok.length ? ok.reduce((a, c) => a + c.latencyMs, 0) / ok.length : 0;
    const avgFirst = ok.filter((c) => c.firstTokenMs).length ? ok.reduce((a, c) => a + (c.firstTokenMs || 0), 0) / ok.filter((c) => c.firstTokenMs).length : 0;
    const kpi = (l, val, s) => h('div.panel.kpi', {}, h('div.eyebrow', {}, l), h('div.v', {}, val), h('div.s', {}, s));
    const byModel = new Map();
    for (const c of calls) {
      const k = `${c.providerName}|${c.modelId}`;
      const m = byModel.get(k) || { provider: c.providerName, vendor: c.vendor, model: c.modelId, calls: 0, ok: 0, err: 0, retries: 0, inT: 0, outT: 0, cost: 0, lat: 0, est: false };
      m.calls++;
      if (c.status === 'ok') { m.ok++; m.lat += c.latencyMs; }
      if (c.status === 'error') m.err++;
      m.retries += c.retries || 0;
      m.inT += c.inputTokens; m.outT += c.outputTokens; m.cost += c.costUsd;
      if (c.estimated) m.est = true;
      byModel.set(k, m);
    }
    clear(v.body, h('div.tele', {},
      h('div.kpis', {},
        kpi('CALLS', S.usage.calls, `${S.usage.errors} 失败 · ${S.usage.retries} 重试`),
        kpi('INPUT', tokens(S.usage.inputTokens), '输入 token'),
        kpi('OUTPUT', tokens(S.usage.outputTokens), `含推理 ${tokens(S.usage.reasoningTokens)}`),
        kpi('COST', money(S.usage.costUsd), S.usage.unpriced ? '部分模型未定价' : S.usage.estimated ? '部分用量为估算' : '按参考价计算'),
        kpi('LATENCY', ms(Math.round(avgLat)), '平均总耗时'),
        kpi('TTFT', ms(Math.round(avgFirst)), '平均首 token')),
      h('div.panel.hud', { style: { padding: '12px 14px' } }, h('div.row', {}, h('div.eyebrow', {}, 'CUMULATIVE COST · 累计费用'), h('span.grow'), h('span.mono.dim', {}, `${money(S.usage.costUsd)} · ${ok.length} 次成功调用`)), costLine(calls, { width: 1100, height: 150 })),
      h('div.panel.hud', {}, h('div.panel-head', {}, h('span.zh', {}, '按模型统计')),
        h('table.data', {}, h('thead', {}, h('tr', {}, ...['服务商', '模型', '调用', '成功', '失败', '重试', '输入', '输出', '平均耗时', '费用'].map((x) => h('th', {}, x)))),
          h('tbody', {}, ...[...byModel.values()].map((m) => h('tr', {}, h('td', {}, m.provider), h('td', {}, m.model), h('td', {}, m.calls), h('td', {}, m.ok), h('td', {}, m.err), h('td', {}, m.retries), h('td', {}, tokens(m.inT) + (m.est ? '*' : '')), h('td', {}, tokens(m.outT)), h('td', {}, ms(Math.round(m.ok ? m.lat / m.ok : 0))), h('td', {}, money(m.cost))))))),
      h('div.panel.hud', {}, h('div.panel-head', {}, h('span.zh', {}, '调用日志'), h('span.mono', {}, `最近 ${Math.min(200, calls.length)} 条`)),
        h('div', { style: { maxHeight: '420px', overflow: 'auto' } }, h('table.data', {}, h('thead', {}, h('tr', {}, ...['时间', '研究员', '模型', '阶段', '类型', '状态', '输入', '输出', '首 token', '耗时', '重试', '费用'].map((x) => h('th', {}, x)))),
          h('tbody', {}, ...calls.slice(-200).reverse().map((c) => {
            const r = S.team.find((x) => x.id === c.rid);
            return h(`tr${c.status === 'error' ? '.err' : ''}`, { title: c.error || '' }, h('td', {}, clock(c.startedAt)), h('td', { style: { color: r?.color } }, r?.label || c.rid), h('td', {}, c.modelId), h('td', {}, PHASE_NAME[c.phase] || c.phase),
              h('td', {}, { main: '主回答', 'compute-followup': '计算追问', 'format-repair': '格式修复' }[c.kind] || c.kind), h('td', {}, { ok: '✓', error: `✗ ${c.errorKind || ''}`, aborted: '中止', running: '…' }[c.status] || c.status),
              h('td', {}, tokens(c.inputTokens) + (c.estimated ? '*' : '')), h('td', {}, tokens(c.outputTokens)), h('td', {}, ms(c.firstTokenMs)), h('td', {}, ms(c.latencyMs)), h('td', {}, c.retries || ''), h('td', {}, money(c.costUsd)));
          }))))),
      h('p.hint', {}, '* 表示服务商未返回用量，按文本长度估算。费用按接入中心设置的参考价计算。')));
  }

  // ───────────────────────── wiring ─────────────────────────
  const renderers = {
    bar: renderBar,
    roster: renderRoster,
    ctl: renderCtl,
    tx: renderTx,
    view: () => {
      renderTabs();
      ({ arena: renderTx, ledger: renderLedger, consensus: renderConsensus, transcript: renderTranscript, report: renderReport, telemetry: renderTelemetry }[tab] || (() => {}))();
    },
  };

  stage.addEventListener('click', onRefClick);
  ctl.addEventListener('click', onRefClick);
  function onRefClick(e) {
    const ref = e.target.closest?.('.ref');
    if (!ref || ref.closest('.drawer')) return;
    const rid = ref.dataset.ref || ref.textContent.trim();
    if (/^[COE]\d+$/.test(rid)) { e.stopPropagation(); openClaim(rid); }
  }
  document.addEventListener('click', onDrawerRef);
  function onDrawerRef(e) {
    const ref = e.target.closest?.('.drawer .ref, .modal .ref');
    if (!ref) return;
    const rid = ref.dataset.ref || ref.textContent.trim();
    if (/^[COE]\d+$/.test(rid)) openClaim(rid);
  }

  async function resync() {
    const { session: fresh } = await get(`/api/sessions/${id}`);
    Object.assign(S, fresh);
    S.ledgerRev++;
    for (const [cid, lc] of liveCalls) if (!S.calls.find((c) => c.id === cid && c.status === 'running')) liveCalls.delete(cid);
    renderFeedAll();
    mark('bar', 'roster', 'ctl', 'view', 'tx');
  }

  let wasBroken = false;
  const close = subscribe(id, {
    meta: (m) => {
      const prevStatus = S.status;
      Object.assign(S, m);
      mark('bar', 'roster', 'ctl');
      if (prevStatus !== S.status && tab === 'arena') mark('tx');
    },
    ledger: (L) => { S.ledger = L; S.ledgerRev++; mark('bar', 'view', 'roster'); },
    contribution: (c) => { S.contributions.push(c); if (tab === 'transcript' || tab === 'arena') mark('view'); },
    call: (c) => {
      const i = S.calls.findIndex((x) => x.id === c.id);
      if (i >= 0) S.calls[i] = c; else S.calls.push(c);
      if (c.status === 'running') { if (!liveCalls.has(c.id)) liveCalls.set(c.id, { rec: c, text: '', thinking: '' }); }
      else {
        const lc = liveCalls.get(c.id);
        if (lc) { lc.rec = c; setTimeout(() => { liveCalls.delete(c.id); mark('tx'); }, 3500); }
      }
      mark('tx');
      if (tab === 'telemetry') mark('view');
    },
    call_retry: (x) => { const lc = liveCalls.get(x.callId); if (lc) { lc.text = ''; lc.thinking = ''; lc.retry = `第 ${x.attempt}/${x.maxRetries} 次重试：${x.error.summary}`; mark('tx'); } },
    delta: (d) => {
      let lc = liveCalls.get(d.callId);
      if (!lc) { lc = { rec: { id: d.callId, rid: d.rid, status: 'running', startedAt: new Date().toISOString(), modelId: '', phase: S.cursor.phase, kind: 'main' }, text: '', thinking: '' }; liveCalls.set(d.callId, lc); }
      lc.text += d.text || '';
      lc.thinking += d.thinking || '';
      if (lc.text.length > 20000) lc.text = lc.text.slice(-12000);
      if (lc.thinking.length > 8000) lc.thinking = lc.thinking.slice(-4000);
      mark('tx');
    },
    feed: (f) => { S.feed.push(f); appendFeed(f); views.arena?.arena.pulse(f, S); },
    consensus: (c) => { S.consensus.push(c); if (tab === 'consensus') mark('view'); },
    synthesis: (x) => { S.syntheses.push(x); },
    report: (r) => { S.report = r; mark('bar'); if (tab === 'report') mark('view'); },
  }, (state) => {
    const conn = document.getElementById('conn');
    if (conn) conn.textContent = state === 'open' ? '● LIVE' : state === 'reconnecting' ? '○ 重连中' : '○ 已断开';
    if (state === 'open' && wasBroken) resync().catch(() => {});
    if (state !== 'open') wasBroken = true;
  });

  const ticker = setInterval(() => { if (liveCalls.size && tab === 'arena') mark('tx'); }, 1000);

  renderBar();
  renderRoster();
  renderCtl();
  renderFeedAll();
  switchTab(TABS.some(([k]) => k === tab) ? tab : 'arena');

  return () => {
    destroyed = true;
    close();
    clearInterval(ticker);
    document.removeEventListener('click', onDrawerRef);
    document.querySelector('.drawer')?.__close?.();
    for (const v of Object.values(views)) { v.arena?.destroy(); v.graph?.destroy(); }
  };
}

function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* storage unavailable */ } }
