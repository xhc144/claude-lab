// 新建研究: proposition → team → protocol, with live LaTeX preview and a cost envelope.
import { h, clear, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { get, post } from '../api.js';
import { md } from '../lib/md.js';
import { money } from '../lib/fmt.js';
import { app, navigate } from '../main.js';

const SAMPLES = [
  ['数学 · 欧拉多项式', 'math', '对所有非负整数 $n$，$n^2+n+41$ 都是素数。'],
  ['数学 · 无理数幂', 'math', '存在无理数 $a, b$ 使得 $a^b$ 是有理数。'],
  ['数学 · 费马数', 'math', '对所有 $n \\ge 0$，费马数 $F_n = 2^{2^n}+1$ 都是素数。'],
  ['数学 · 调和级数', 'math', '对任意整数 $n \\ge 2$，$H_n = \\sum_{k=1}^{n} \\frac{1}{k}$ 都不是整数。'],
  ['物理 · 角动量', 'physics', '在中心力场中运动的质点，其相对力心的角动量守恒；若力不是中心力，则角动量一定不守恒。'],
  ['物理 · 自由落体', 'physics', '忽略空气阻力时，从同一高度静止释放的两个不同质量的物体同时落地；考虑空气阻力时，质量较大的物体总是先落地。'],
  ['计算机 · 排序下界', 'cs', '任何基于比较的排序算法在最坏情况下都需要 $\\Omega(n \\log n)$ 次比较。'],
  ['计算机 · 停机问题变体', 'cs', '不存在算法能判定任意给定程序在空输入上是否会在 $10^{6}$ 步内停机。'],
];
const PALETTE = ['#4de8ff', '#b18cff', '#ffb547', '#ff6b9a', '#3cf0a8', '#6aa8ff', '#c6f25b', '#ff8a4c', '#f27bff', '#2fd6c4'];
const ROLE_CYCLE = ['prover', 'skeptic', 'verifier', 'experimentalist', 'prover', 'devil', 'theorist', 'verifier', 'skeptic'];

export async function mountWizard(root) {
  const { providers } = await get('/api/providers');
  const usable = providers.filter((p) => p.enabled && p.models.length);
  const D = app.meta.settingsDefaults;
  const st = {
    step: 0, title: '', question: '', background: '', domain: 'math', language: 'zh',
    team: [], settings: { ...D },
  };
  // Seed a team: one model from each provider first (maximises vendor diversity), up to 5.
  const seen = new Set();
  for (const p of usable) {
    if (st.team.length >= 5) break;
    if (seen.has(p.vendor)) continue;
    seen.add(p.vendor);
    st.team.push({ providerId: p.id, modelId: p.models[0].id, role: 'generalist', thinking: 'inherit' });
  }
  for (const p of usable) for (const m of p.models.slice(1)) if (st.team.length < 5) st.team.push({ providerId: p.id, modelId: m.id, role: 'generalist', thinking: 'inherit' });
  st.team.forEach((t, i) => { t.role = i === 0 ? 'chair' : ROLE_CYCLE[(i - 1) % ROLE_CYCLE.length]; });

  const body = h('div');
  const side = h('aside.panel.hud.summary-card', { style: { padding: '16px', position: 'sticky', top: '0' } });
  const steps = h('div.steps');

  const providerOf = (id) => providers.find((p) => p.id === id);
  const priceOf = (t) => providerOf(t.providerId)?.models.find((m) => m.id === t.modelId)?.price || null;
  const usd = (price, inTok, outTok) => {
    if (!price) return 0;
    const v = (inTok * price.input + outTok * price.output) / 1e6;
    return price.currency === 'CNY' ? v / (app.user.settings.cnyPerUsd || 7.1) : v;
  };

  function estimate() {
    const n = st.team.length;
    const s = st.settings;
    const callsPerRound = n * 3.4 + 1;
    const inTok = Math.min(s.contextChars, 30000) / 2.2 + 2500;
    let hi = 0, typ = 0;
    for (const t of st.team) {
      const p = priceOf(t);
      hi += usd(p, inTok, s.maxOutputTokens) * 3.4;
      typ += usd(p, inTok * 0.6, Math.min(s.maxOutputTokens, 2500)) * 3.4;
    }
    const chair = st.team.find((t) => t.role === 'chair') || st.team[0];
    if (chair) { hi += usd(priceOf(chair), inTok, s.maxOutputTokens) * 2; typ += usd(priceOf(chair), inTok * 0.6, 2500) * 2; }
    return { calls: Math.round(callsPerRound * s.maxRounds), hi: hi * s.maxRounds, typ: typ * s.maxRounds, unpriced: st.team.filter((t) => !priceOf(t)).length };
  }

  function paintSide() {
    const vendors = new Set(st.team.map((t) => providerOf(t.providerId)?.vendor).filter(Boolean));
    const e = estimate();
    const warn = [];
    if (st.team.length < 5) warn.push('建议至少 5 名研究员以保证交叉核验的独立性。');
    if (vendors.size < 3) warn.push('来自的厂商少于 3 家：不同训练来源的模型更能发现彼此的盲点。');
    if (e.unpriced) warn.push(`${e.unpriced} 名研究员的模型未设置价格，费用估算与美元预算对其无效。`);
    if (st.settings.budgetUsd > 0 && e.typ > st.settings.budgetUsd) warn.push('典型花费可能超过预算，研究会在预算耗尽时自动暂停。');
    clear(side,
      h('div.eyebrow', {}, 'MISSION BRIEF'),
      h('h3', { style: { margin: '6px 0 12px' } }, '研究概要'),
      h('dl', {},
        h('dt', {}, '研究员'), h('dd', {}, `${st.team.length} / 10`),
        h('dt', {}, '厂商'), h('dd', {}, vendors.size),
        h('dt', {}, '最多轮次'), h('dd', {}, st.settings.maxRounds),
        h('dt', {}, '证明所需核验'), h('dd', {}, `${st.settings.minVerifiers} 人${st.settings.crossVendor ? ' · 跨厂商' : ''}`),
        h('dt', {}, '预计调用'), h('dd', {}, `≈ ${e.calls}`),
        h('dt', {}, '典型花费'), h('dd', {}, money(e.typ)),
        h('dt', {}, '上限估计'), h('dd', {}, money(e.hi)),
        h('dt', {}, '预算'), h('dd', {}, st.settings.budgetUsd > 0 ? money(st.settings.budgetUsd) : '不限')),
      h('div.diversity', {}, ...st.team.map((t, i) => h('span', { style: { flex: 1, background: PALETTE[i % PALETTE.length] } }))),
      ...warn.map((w) => h('div.hint', { style: { color: '#ffd7a0', marginTop: '6px' } }, '⚠ ' + w)),
      h('div.col', { style: { marginTop: '16px' } },
        h('button.btn.primary', { style: { height: '40px' }, onclick: () => create(true) }, icon('play'), '创建并开始研究'),
        h('button.btn', { onclick: () => create(false) }, '仅创建（稍后手动启动）')));
  }

  async function create(autostart) {
    if (st.question.trim().length < 4) { st.step = 0; paint(); toast('请填写研究命题', 'err'); return; }
    if (st.team.length < 3) { st.step = 1; paint(); toast('研究团队至少需要 3 名研究员', 'err'); return; }
    try {
      const r = await post('/api/sessions', { title: st.title, question: st.question, background: st.background, domain: st.domain, language: st.language, team: st.team, settings: st.settings, autostart });
      navigate(`#/s/${r.id}`);
    } catch (e) { toast(e.message, 'err'); }
  }

  const field = (label, el, hint) => h('label.field', {}, h('span', {}, label), el, hint ? h('span.hint', {}, hint) : null);

  function stepQuestion() {
    const preview = h('div.preview-math.md');
    const q = h('textarea.textarea', { rows: 5, placeholder: '用自然语言 + LaTeX 写下要研究的命题，例如：对所有正整数 $n$，……', value: st.question });
    const renderPreview = () => { preview.innerHTML = st.question.trim() ? md(st.question) : '<span class="faint">实时预览（支持 Markdown 与 LaTeX）</span>'; };
    q.addEventListener('input', () => { st.question = q.value; renderPreview(); });
    renderPreview();
    return h('div.panel.hud', {}, h('div.panel-body.col', { style: { gap: '14px' } },
      field('研究命题 C0', q, '命题应当可判定：研究团队将尝试证明或证伪它，并区分已证明结论、猜想与未解决问题。'),
      preview,
      h('div', {}, h('div.sub', {}, 'SAMPLES · 示例命题'), h('div.samples', {}, ...SAMPLES.map(([n, d, text]) => h('button', { type: 'button', onclick: () => { st.question = text; st.domain = d; st.title = n.split(' · ')[1]; paint(); } }, n)))),
      h('div.grid3', {},
        field('标题（可选）', h('input.input', { value: st.title, placeholder: '自动取命题开头', oninput: (e) => { st.title = e.target.value; } })),
        field('领域', h('select.select', { onchange: (e) => { st.domain = e.target.value; } }, ...Object.entries(app.meta.domains).map(([k, n]) => h('option', { value: k, selected: st.domain === k }, n)))),
        field('研究语言', h('select.select', { onchange: (e) => { st.language = e.target.value; } }, h('option', { value: 'zh', selected: st.language === 'zh' }, '简体中文'), h('option', { value: 'en', selected: st.language === 'en' }, 'English')))),
      field('背景与约定（可选）', h('textarea.textarea', { rows: 3, placeholder: '定义、记号、已知条件、希望重点考察的方向……', value: st.background, oninput: (e) => { st.background = e.target.value; } }))));
  }

  function stepTeam() {
    if (!usable.length) {
      return h('div.panel.empty', {}, h('h3', {}, '没有可用的模型'), h('p', {}, '请先在接入中心添加服务商并配置模型。'), h('a.btn.primary', { href: '#/gateway' }, '前往接入中心'));
    }
    const rows = st.team.map((t, i) => {
      const p = providerOf(t.providerId) || usable[0];
      const known = p.models.some((m) => m.id === t.modelId);
      const modelSel = h('select.select', { onchange: (e) => { if (e.target.value === '__custom') { t.modelId = ''; paint(); } else { t.modelId = e.target.value; paintSide(); } } },
        ...p.models.map((m) => h('option', { value: m.id, selected: m.id === t.modelId }, m.label && m.label !== m.id ? `${m.id} · ${m.label}` : m.id)),
        h('option', { value: '__custom', selected: !known }, '其他模型 ID…'));
      const modelCell = known ? modelSel : h('div.row', {}, h('input.input.mono', { value: t.modelId, placeholder: '模型 ID', oninput: (e) => { t.modelId = e.target.value.trim(); } }), h('button.btn.sm.icon.ghost', { title: '从列表选择', onclick: () => { t.modelId = p.models[0]?.id || ''; paint(); } }, '↺'));
      return h('div.team-row', {},
        h('span.badge-letter', { style: { '--c': PALETTE[i % PALETTE.length] } }, 'ABCDEFGHIJ'[i]),
        h('select.select', { 'aria-label': '服务商', onchange: (e) => { t.providerId = e.target.value; t.modelId = providerOf(t.providerId).models[0]?.id || ''; paint(); } },
          ...usable.map((x) => h('option', { value: x.id, selected: x.id === p.id }, `${x.name}`))),
        modelCell,
        h('select.select', { 'aria-label': '角色', onchange: (e) => {
          if (e.target.value === 'chair') for (const x of st.team) if (x.role === 'chair') x.role = 'generalist';
          t.role = e.target.value; paint();
        } }, ...Object.entries(app.meta.roles).map(([k, r]) => h('option', { value: k, selected: t.role === k }, r.name))),
        h('select.select', { 'aria-label': '深度思考', title: '深度思考（推理）参数', onchange: (e) => { t.thinking = e.target.value; } },
          ...[['inherit', '思考：默认'], ['on', '思考：开'], ['off', '思考：关'], ['auto', '思考：平台默认']].map(([k, n]) => h('option', { value: k, selected: t.thinking === k }, n))),
        h('button.btn.sm.icon.ghost', { title: '移除', onclick: () => { st.team.splice(i, 1); paint(); } }, '✕'));
    });
    const roleHelp = h('details', { style: { marginTop: '14px' } }, h('summary', { style: { cursor: 'pointer', color: 'var(--dim)', fontSize: '12.5px' } }, '角色说明'),
      h('div.col', { style: { marginTop: '8px', gap: '6px' } }, ...Object.values(app.meta.roles).map((r) => h('div.hint', {}, h('b', { style: { color: 'var(--text-2)' } }, `${r.name}：`), r.duty))));
    return h('div.panel.hud', {}, h('div.panel-body', {},
      h('div.row', { style: { marginBottom: '12px' } },
        h('div', {}, h('div', { style: { fontWeight: 600 } }, '研究团队'), h('div.hint', {}, '推荐 5–10 名来自不同公司的模型。主持人负责综合与报告，也参与研究。')),
        h('span.grow'),
        h('button.btn.sm', { onclick: () => { st.team.forEach((t, i) => { t.role = i === 0 ? 'chair' : ROLE_CYCLE[(i - 1) % ROLE_CYCLE.length]; }); paint(); } }, icon('users'), '自动分配角色'),
        h('button.btn.sm', { disabled: st.team.length >= 10, onclick: () => {
          const used = new Set(st.team.map((t) => providerOf(t.providerId)?.vendor));
          const p = usable.find((x) => !used.has(x.vendor)) || usable[st.team.length % usable.length];
          st.team.push({ providerId: p.id, modelId: p.models[0].id, role: ROLE_CYCLE[(st.team.length - 1) % ROLE_CYCLE.length], thinking: 'inherit' });
          paint();
        } }, icon('plus'), '添加研究员')),
      ...rows, roleHelp));
  }

  function stepProtocol() {
    const s = st.settings;
    const num = (k, label, attrs, hint) => field(label, h('input.input.mono', { type: 'number', value: s[k], ...attrs, oninput: (e) => { s[k] = e.target.value === '' ? '' : +e.target.value; paintSide(); } }), hint);
    const chk = (k, label, hint) => h('div.col', { style: { gap: '2px' } }, h('label.check', {}, h('input', { type: 'checkbox', checked: !!s[k], onchange: (e) => { s[k] = e.target.checked; paintSide(); } }), label), hint ? h('span.hint', { style: { paddingLeft: '38px' } }, hint) : null);
    return h('div.col', { style: { gap: '14px' } },
      h('div.panel.hud', {}, h('div.panel-head', {}, h('span.zh', {}, '学术规程')), h('div.panel-body.col', { style: { gap: '14px' } },
        h('div.grid3', {},
          num('maxRounds', '最多研究轮次', { min: 1, max: 12 }, '每轮：独立研究/专项攻关 → 交叉质询 → 答辩 → 独立核验 → 综合'),
          num('minVerifiers', '“已证明”所需独立核验人数', { min: 1, max: 5 }, '核验者必须不是作者'),
          num('reviewersPerClaim', '每条断言的质询人数', { min: 1, max: 4 })),
        h('div.grid2', {},
          chk('crossVendor', '要求跨厂商核验', '至少一名核验者与作者来自不同厂商'),
          chk('anonymize', '匿名评审', '研究员只看到“研究员 A/B/C”，避免对品牌的权威偏见'),
          chk('computeSandbox', '计算核验沙箱', '允许研究员运行 JavaScript（QuickJS/WASM 隔离）检验反例与数值证据'),
          chk('earlyStop', '主命题判定后可提前结束', '主持人可在证据充分时结束研究'),
          chk('autoAdvance', '自动推进', '关闭后每个阶段结束都会暂停，等待人工推进'),
          chk('formatRepair', '格式修复', '回答未使用标记协议时追加一次低成本修复请求')))),
      h('div.panel.hud', {}, h('div.panel-head', {}, h('span.zh', {}, '调用与预算')), h('div.panel-body.col', { style: { gap: '14px' } },
        h('div.grid4', {},
          num('budgetUsd', '预算上限（美元，0 为不限）', { min: 0, step: 0.5 }),
          num('maxTotalTokens', 'Token 上限（0 为不限）', { min: 0, step: 100000 }),
          num('concurrency', '并发调用数', { min: 1, max: 16 }),
          num('maxOutputTokens', '单次输出上限', { min: 512, max: 128000, step: 512 })),
        h('div.grid3', {},
          num('temperature', '温度', { min: 0, max: 2, step: 0.1 }, '推理模型会自动忽略不支持的采样参数'),
          num('contextChars', '账本摘要预算（字符）', { min: 4000, max: 400000, step: 2000 }),
          field('默认深度思考', h('select.select', { onchange: (e) => { s.thinking = e.target.value; } }, ...[['auto', '平台默认'], ['on', '开启'], ['off', '关闭']].map(([k, n]) => h('option', { value: k, selected: s.thinking === k }, n))))))));
  }

  function paint() {
    const names = [['01', '命题', 'PROPOSITION'], ['02', '团队', 'TEAM'], ['03', '规程', 'PROTOCOL']];
    clear(steps, ...names.map(([n, zh, en], i) => h(`div.s${st.step === i ? '.on' : ''}`, { onclick: () => { st.step = i; paint(); } }, h('b', {}, `${n} · ${en}`), zh)));
    clear(body, [stepQuestion, stepTeam, stepProtocol][st.step](),
      h('div.row', { style: { marginTop: '14px' } }, st.step > 0 ? h('button.btn', { onclick: () => { st.step--; paint(); } }, '上一步') : null, h('span.grow'),
        st.step < 2 ? h('button.btn.primary', { onclick: () => { st.step++; paint(); } }, '下一步') : null));
    paintSide();
  }
  paint();

  clear(root, h('div.page', {},
    h('header.page-head', {}, h('div', {}, h('div.eyebrow', {}, 'NEW STUDY'), h('h1', {}, '新建研究'), h('p', {}, '提出命题、组建跨厂商研究团队、设定学术规程与预算。'))),
    steps,
    h('div.wizard', {}, body, side)));
  return null;
}
