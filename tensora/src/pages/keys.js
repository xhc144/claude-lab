// API 密钥 · create (shown once), reveal / copy, enable / disable, edit limits, rotate,
// revoke with undo, and a per-key usage drawer.

import { pageHead, panel, seg, bindSeg, stat, pill, toggle, empty } from '../ui/kit.js';
import { lineChart, sparkline, hbars, SERIES } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { openLayer, openMenu, confirmDialog, toast } from '../ui/overlay.js';
import { state, bus } from '../core/state.js';
import { live } from '../core/live.js';
import { MODELS, NOW } from '../core/data.js';
import { fmt, esc, $, copyText, debounce, rng, hash } from '../core/util.js';

const SCOPES = [
  { id: 'all', label: '全部模型' }, { id: 'chat', label: '对话' }, { id: 'reason', label: '推理' }, { id: 'code', label: '代码' },
  { id: 'vision', label: '视觉' }, { id: 'embed', label: '嵌入' }, { id: 'audio', label: '语音' }, { id: 'image', label: '图像' },
];
const scopeLabel = (s) => SCOPES.find((x) => x.id === s)?.label || s;
const HEX = '0123456789abcdef';
const randKey = () => 'sk-tsr-' + Array.from({ length: 40 }, () => HEX[Math.floor(Math.random() * 16)]).join('');
const masked = (k) => `sk-tsr-${'•'.repeat(10)}${k.tail}`;
const sumUsage = (k) => k.usage.reduce((a, b) => a + b, 0);

function keyRow(k) {
  const pct = k.spent / k.quota;
  const kind = pct >= 0.98 ? 'crit' : pct >= 0.75 ? 'warn' : '';
  return `<article class="krow${k.enabled ? '' : ' off'}${k._fresh ? ' fresh' : ''}" data-id="${k.id}">
    <div class="kr-id">
      <div class="kr-name"><b>${esc(k.name)}</b>${k.env === 'prod' ? '<span class="tag env-prod">生产</span>' : '<span class="tag env-test">测试</span>'}</div>
      <div class="kr-key"><code data-key="${k.id}">${masked(k)}</code>
        <button type="button" class="icon-btn xs" data-act="reveal" aria-label="显示密钥">${icon('eye')}</button>
        <button type="button" class="icon-btn xs" data-act="copy" aria-label="复制密钥">${icon('copy')}</button></div>
      <div class="kr-meta">${esc(k.owner)} · 创建于 ${fmt.date(k.created, true)} · 最近使用 ${fmt.rel(k.lastUsed)}</div>
    </div>
    <div class="kr-scopes">${k.scopes.map((s) => `<span class="tag">${scopeLabel(s)}</span>`).join('')}<span class="kr-rpm">${icon('gauge')}${fmt.int(k.rpm)} RPM</span></div>
    <div class="kr-quota">
      <div class="kq-top"><span>本月额度</span><b>${fmt.cny(k.spent)} <small>/ ${fmt.cnyCompact(k.quota)}</small></b></div>
      <div class="bar ${kind}"><i style="width:${Math.min(100, pct * 100).toFixed(1)}%"></i></div>
      ${kind ? `<span class="kq-warn">${icon('alert')}${pct >= 0.98 ? '额度已用尽，请求将被拒绝' : `已用 ${Math.round(pct * 100)}%，即将触顶`}</span>` : `<span class="kq-sub">已用 ${Math.round(pct * 100)}%</span>`}
    </div>
    <div class="kr-spark" title="近 14 天调用">${sparkline(k.usage, { w: 150, h: 40, color: k.enabled ? SERIES[0] : '#5d6a80' })}<span>${fmt.compact(sumUsage(k))} 次 / 14 天</span></div>
    <div class="kr-act">
      ${toggle(`en-${k.id}`, k.enabled, `${k.enabled ? '停用' : '启用'} ${k.name}`)}
      <button type="button" class="icon-btn" data-act="more" aria-label="更多操作">${icon('more')}</button>
    </div>
  </article>`;
}

export default {
  domain: 'gateway',
  mount(view, ctx) {
    let filter = { q: '', env: 'all' };
    view.innerHTML = `
      ${pageHead({
        eyebrow: 'API 网关 · 访问凭证',
        title: 'API 密钥',
        sub: '管理访问凭证、模型权限、速率限制与月度额度。完整密钥只在创建或轮换时显示一次。',
        actions: `<a class="btn" href="#/usage">${icon('usage')}调用统计</a><button class="btn primary" type="button" id="new-key">${icon('plus')}创建密钥</button>`,
      })}
      <div class="grid stats4" id="k-stats"></div>
      ${panel({
        cls: 'c-12 keys-panel',
        title: '全部密钥', meta: '按创建时间排序',
        tools: `<div class="input-icon kq">${icon('search')}<input class="input" id="k-q" placeholder="搜索名称、负责人或尾号" aria-label="搜索密钥"></div>${seg('k-env', [{ value: 'all', label: '全部' }, { value: 'prod', label: '生产' }, { value: 'test', label: '测试' }], 'all', { small: true, label: '环境' })}`,
        body: '<div class="klist" id="k-list"></div>',
      })}
      <div class="grid">
        ${panel({ cls: 'c-6', title: '安全建议', meta: '基于当前配置', body: `<ul class="tips">
          <li>${icon('shield')}<div><b>为生产密钥配置 IP 白名单</b><span>2 个生产密钥尚未限制来源 IP，泄露后可被任意调用。</span></div></li>
          <li>${icon('refresh')}<div><b>定期轮换长期密钥</b><span>「生产 · 智能客服」已使用 210 天，建议每 90 天轮换一次。</span></div></li>
          <li>${icon('lock')}<div><b>最小权限原则</b><span>「研究组 · 模型评测」拥有全部模型权限，可按需收窄范围。</span></div></li></ul>` })}
        ${panel({ cls: 'c-6', title: '接入方式', meta: 'OpenAI 兼容', body: `<div class="snippet"><span class="eyebrow">Base URL</span><div class="copyline"><code>https://api.tensora.example/v1</code><button class="btn xs ghost" type="button" data-copy="https://api.tensora.example/v1">${icon('copy')}复制</button></div><span class="eyebrow">请求头</span><div class="copyline"><code>Authorization: Bearer sk-tsr-…</code><button class="btn xs ghost" type="button" data-copy="Authorization: Bearer $TENSORA_API_KEY">${icon('copy')}复制</button></div><p class="field-h">在 <a class="lnk" href="#/models">模型广场</a> 的「接入代码」标签可查看各语言示例。</p></div>` })}
      </div>`;

    const drawStats = () => {
      const keys = state.keys;
      const active = keys.filter((k) => k.enabled).length;
      const calls = keys.reduce((a, k) => a + sumUsage(k), 0);
      const spent = keys.reduce((a, k) => a + k.spent, 0);
      const hot = keys.filter((k) => k.spent / k.quota >= 0.75).length;
      $('#k-stats', view).innerHTML = [
        stat({ label: '活跃密钥', value: `${active}`, unit: `/ ${keys.length}`, sub: `${keys.filter((k) => k.env === 'prod').length} 个生产 · ${keys.filter((k) => k.env === 'test').length} 个测试`, icon: 'key' }),
        stat({ label: '近 14 天调用', value: fmt.compact(calls, 2), delta: '9.6%', good: true, sub: '全部密钥合计', icon: 'usage' }),
        stat({ label: '本月消费', value: fmt.cny(spent), sub: `占总额度 ${Math.round((spent / keys.reduce((a, k) => a + k.quota, 0)) * 100)}%`, icon: 'yuan' }),
        stat({ label: '额度预警', value: String(hot), sub: hot ? '个密钥用量超过 75%' : '所有密钥额度充足', icon: 'alert' }),
      ].map((s) => `<div class="c-3">${s}</div>`).join('');
    };

    const list = $('#k-list', view);
    const draw = () => {
      const q = filter.q.toLowerCase();
      const keys = state.keys.filter((k) => (filter.env === 'all' || k.env === filter.env) && (!q || (k.name + k.owner + k.tail).toLowerCase().includes(q)));
      list.innerHTML = keys.length ? keys.map(keyRow).join('') : empty('没有匹配的密钥', '换个关键词或切换环境筛选。', 'key');
      state.keys.forEach((k) => { k._fresh = false; });
      drawStats();
    };
    draw();

    $('#k-q', view).addEventListener('input', debounce((e) => { filter.q = e.target.value.trim(); draw(); }));
    bindSeg(view, 'k-env', (v) => { filter.env = v; draw(); });
    $('#new-key', view).addEventListener('click', () => ctx.navigate('keys/new'));

    const byId = (id) => state.keys.find((k) => k.id === id);
    list.addEventListener('click', async (e) => {
      const rowEl = e.target.closest('.krow');
      if (!rowEl) return;
      const k = byId(rowEl.dataset.id);
      const sw = e.target.closest('.switch');
      if (sw) {
        k.enabled = !k.enabled;
        draw();
        toast({ kind: k.enabled ? 'good' : 'warn', title: k.enabled ? `已启用「${k.name}」` : `已停用「${k.name}」`, body: k.enabled ? '密钥立即恢复调用' : '使用该密钥的请求将返回 401', action: { label: '撤销', fn: () => { k.enabled = !k.enabled; draw(); } } });
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'reveal') {
        const code = rowEl.querySelector('code');
        const shown = code.dataset.shown === '1';
        code.textContent = shown ? masked(k) : `sk-tsr-${(hash(k.id + k.tail) >>> 0).toString(16).slice(0, 6)}…${k.tail}`;
        code.dataset.shown = shown ? '0' : '1';
        if (!shown) toast({ kind: 'info', title: '只显示前缀与尾号', body: '完整密钥仅在创建或轮换时显示一次；如已遗失，请轮换密钥', timeout: 3200 });
        return;
      }
      if (act === 'copy') {
        const ok = await copyText(`sk-tsr-…${k.tail}`);
        toast({ kind: ok ? 'good' : 'warn', title: ok ? '已复制密钥前缀与尾号' : '无法访问剪贴板', body: '完整密钥仅在创建时可复制', timeout: 2200 });
        return;
      }
      if (act === 'more') {
        openMenu(e.target.closest('[data-act]'), [
          { label: '查看用量', icon: 'usage', fn: () => ctx.navigate(`keys/${k.id}`) },
          { label: '编辑限额', icon: 'gauge', fn: () => editLimits(k) },
          { label: '轮换密钥', icon: 'refresh', fn: () => rotate(k) },
          { sep: true },
          { label: '删除密钥', icon: 'trash', danger: true, fn: () => revoke(k) },
        ]);
        return;
      }
      if (!e.target.closest('button, a, code')) ctx.navigate(`keys/${k.id}`);
    });

    function editLimits(k) {
      openLayer({
        kind: 'modal', title: `编辑限额 · ${esc(k.name)}`, eyebrow: '速率与额度',
        body: `<div class="form">
          <div class="field"><label class="field-l" for="lim-rpm">每分钟请求数 <small id="lim-rpm-v">${fmt.int(k.rpm)} RPM</small></label><input id="lim-rpm" type="range" min="60" max="10000" step="60" value="${k.rpm}"></div>
          <div class="field"><label class="field-l" for="lim-quota">月度额度（¥）</label><input id="lim-quota" class="input" type="number" min="100" step="100" value="${k.quota}"><span class="field-h">本月已用 ${fmt.cny(k.spent)}，额度低于已用金额时密钥会立即被限流。</span></div>
        </div>`,
        foot: '<button class="btn ghost" type="button" data-x>取消</button><button class="btn primary" type="button" data-save>保存</button>',
        onMount(p, close) {
          const r = $('#lim-rpm', p);
          const sync = () => { r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`); $('#lim-rpm-v', p).textContent = `${fmt.int(r.value)} RPM`; };
          r.addEventListener('input', sync); sync();
          p.querySelector('[data-x]').addEventListener('click', () => close());
          p.querySelector('[data-save]').addEventListener('click', () => {
            const qv = Number($('#lim-quota', p).value);
            if (!(qv >= 100)) { $('#lim-quota', p).closest('.field').classList.add('err'); $('#lim-quota', p).focus(); return; }
            k.rpm = Number(r.value);
            k.quota = qv;
            close();
            draw();
            toast({ kind: 'good', title: '限额已更新', body: `${fmt.int(k.rpm)} RPM · 月度 ${fmt.cny(k.quota)}` });
          });
        },
      });
    }

    async function rotate(k) {
      const ok = await confirmDialog({ title: `轮换「${esc(k.name)}」？`, body: '将生成新的密钥值。旧密钥会保留 <b>24 小时</b> 宽限期，之后失效，请在此期间完成替换。', confirmLabel: '轮换密钥' });
      if (!ok) return;
      const full = randKey();
      k.tail = full.slice(-4);
      k._fresh = true;
      draw();
      showSecret(k, full, '密钥已轮换');
    }

    async function revoke(k) {
      const ok = await confirmDialog({ title: '删除密钥', body: `删除后，所有使用「<b>${esc(k.name)}</b>」的请求会立刻返回 401，此操作无法从服务端恢复。`, confirmLabel: '删除密钥', danger: true, requireText: k.name });
      if (!ok) return;
      const idx = state.keys.indexOf(k);
      state.keys.splice(idx, 1);
      draw();
      toast({ kind: 'warn', title: `已删除「${k.name}」`, body: '5 秒内可撤销', timeout: 5000, action: { label: '撤销', fn: () => { state.keys.splice(idx, 0, k); k._fresh = true; draw(); toast({ kind: 'good', title: '已恢复密钥', timeout: 1800 }); } } });
    }

    function showSecret(k, full, title) {
      openLayer({
        kind: 'modal', title, eyebrow: esc(k.name), cls: 'secret',
        body: `<div class="secret-box"><span class="eyebrow">${icon('lock')}只显示这一次</span><div class="copyline big"><code id="sec-v">${full}</code><button class="btn sm primary" type="button" data-copy="${full}">${icon('copy')}复制</button></div>
          <p class="muted">请立即复制并保存到密钥管理系统或环境变量中。关闭此窗口后，平台只保留尾号 <b>${k.tail}</b>。</p>
          <div class="code"><div class="code-h"><span>bash</span></div><pre><code><span class="tk-k">export</span> TENSORA_API_KEY=<span class="tk-s">"${full}"</span></code></pre></div></div>`,
        foot: '<button class="btn primary" type="button" data-x>我已妥善保存</button>',
        onMount(p, close) { p.querySelector('[data-x]').addEventListener('click', () => close()); },
      });
    }

    function createModal() {
      let env = 'prod';
      const scopes = new Set(['chat']);
      return openLayer({
        kind: 'modal', title: '创建 API 密钥', eyebrow: 'API 网关', wide: false, cls: 'create-key',
        onClose: () => { if (location.hash === '#/keys/new') ctx.replace('keys'); },
        body: `<form class="form" id="ck-form" novalidate>
          <div class="field"><label class="field-l" for="ck-name">名称 <small>用于区分业务与负责人</small></label><input id="ck-name" class="input" placeholder="例如：生产 · 推荐系统" maxlength="40" autocomplete="off" autofocus><span class="field-h" id="ck-name-h">2–40 个字符</span></div>
          <div class="field"><span class="field-l">环境</span>${seg('ck-env', [{ value: 'prod', label: '生产', icon: 'shield' }, { value: 'test', label: '测试', icon: 'branch' }], 'prod')}</div>
          <div class="field"><span class="field-l">模型权限 <small id="ck-scope-n">1 项</small></span><div class="chips" id="ck-scopes">${SCOPES.map((s) => `<button type="button" class="chip${s.id === 'chat' ? ' on' : ''}" data-scope="${s.id}" aria-pressed="${s.id === 'chat'}">${s.label}</button>`).join('')}</div></div>
          <div class="row2">
            <div class="field"><label class="field-l" for="ck-rpm">速率限制 <small id="ck-rpm-v">1,200 RPM</small></label><input id="ck-rpm" type="range" min="60" max="10000" step="60" value="1200"></div>
            <div class="field"><label class="field-l" for="ck-quota">月度额度（¥）</label><input id="ck-quota" class="input" type="number" min="100" step="100" value="20000"></div>
          </div>
          <div class="row2">
            <div class="field"><label class="field-l" for="ck-exp">有效期</label><select id="ck-exp" class="select"><option value="0">永不过期</option><option value="30">30 天</option><option value="90" selected>90 天</option><option value="365">1 年</option></select></div>
            <div class="field"><label class="field-l" for="ck-ip">IP 白名单 <small>可选</small></label><input id="ck-ip" class="input mono" placeholder="10.0.0.0/8, 47.96.1.8"></div>
          </div>
        </form>`,
        foot: '<button class="btn ghost" type="button" data-x>取消</button><button class="btn primary" type="submit" form="ck-form" id="ck-submit">创建密钥</button>',
        onMount(p, close) {
          bindSeg(p, 'ck-env', (v) => { env = v; });
          const rpm = $('#ck-rpm', p);
          const sync = () => { rpm.style.setProperty('--p', `${((rpm.value - rpm.min) / (rpm.max - rpm.min)) * 100}%`); $('#ck-rpm-v', p).textContent = `${fmt.int(rpm.value)} RPM`; };
          rpm.addEventListener('input', sync); sync();
          $('#ck-scopes', p).addEventListener('click', (e) => {
            const b = e.target.closest('[data-scope]');
            if (!b) return;
            const id = b.dataset.scope;
            if (id === 'all') { scopes.clear(); scopes.add('all'); }
            else { scopes.delete('all'); scopes.has(id) ? scopes.delete(id) : scopes.add(id); }
            p.querySelectorAll('[data-scope]').forEach((x) => { const on = scopes.has(x.dataset.scope); x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
            $('#ck-scope-n', p).textContent = scopes.size ? (scopes.has('all') ? '全部模型' : `${scopes.size} 项`) : '至少选择一项';
          });
          p.querySelector('[data-x]').addEventListener('click', () => close());
          $('#ck-name', p).addEventListener('input', () => $('#ck-name', p).closest('.field').classList.remove('err'));
          $('#ck-form', p).addEventListener('submit', (e) => {
            e.preventDefault();
            const name = $('#ck-name', p).value.trim();
            const nameField = $('#ck-name', p).closest('.field');
            if (name.length < 2) { nameField.classList.add('err'); $('#ck-name-h', p).textContent = '请输入至少 2 个字符的名称'; $('#ck-name', p).focus(); return; }
            if (state.keys.some((k) => k.name === name)) { nameField.classList.add('err'); $('#ck-name-h', p).textContent = '已有同名密钥，换一个名称以便区分'; return; }
            if (!scopes.size) { toast({ kind: 'warn', title: '请至少选择一项模型权限' }); return; }
            const btn = $('#ck-submit', p);
            btn.classList.add('loading');
            btn.textContent = '正在创建';
            setTimeout(() => {
              const full = randKey();
              const k = { id: `k${Date.now()}`, name, env, tail: full.slice(-4), created: Date.now(), lastUsed: Date.now(), scopes: [...scopes], models: [], rpm: Number(rpm.value), quota: Number($('#ck-quota', p).value) || 20000, spent: 0, enabled: true, owner: state.user.name, usage: Array(13).fill(0).concat([0]), _fresh: true };
              state.keys.unshift(k);
              close();
              draw();
              bus.emit('keys');
              showSecret(k, full, '密钥已创建');
            }, 650);
          });
        },
      });
    }

    function detail(k) {
      const r = rng(hash(k.id));
      const days = k.usage.map((_, i) => NOW - (k.usage.length - 1 - i) * 86400000);
      const models = (k.models.length ? k.models : MODELS.slice(0, 4).map((m) => m.id)).map((id, i) => ({ m: MODELS.find((x) => x.id === id), v: (0.5 + r()) / (i + 1) }));
      const tot = models.reduce((a, x) => a + x.v, 0);
      let chart = null;
      return openLayer({
        kind: 'drawer', wide: true, eyebrow: `API 密钥 · ${k.env === 'prod' ? '生产' : '测试'}`, title: esc(k.name),
        onClose: () => { if (location.hash.startsWith(`#/keys/${k.id}`)) ctx.replace('keys'); },
        body: `<div class="kd-head"><code>${masked(k)}</code>${k.enabled ? pill('good', '启用中') : pill('idle', '已停用')}</div>
          <div class="kd-kpis"><div><span>14 天调用</span><b>${fmt.compact(sumUsage(k), 2)}</b></div><div><span>本月消费</span><b>${fmt.cny(k.spent)}</b></div><div><span>速率限制</span><b>${fmt.int(k.rpm)} RPM</b></div><div><span>错误率</span><b>${(0.3 + r() * 0.6).toFixed(2)}%</b></div></div>
          <h3 class="md-h">每日调用</h3><div id="kd-chart"></div>
          <h3 class="md-h">模型分布</h3>${hbars(models.filter((x) => x.m).map((x, i) => ({ label: x.m.name, value: (x.v / tot) * 100, color: SERIES[i], key: true })), { fmt: (v) => fmt.pct(v, 1), max: 100 })}
          <h3 class="md-h">最近请求</h3><div class="kd-feed" id="kd-feed"></div>`,
        foot: `<button class="btn" type="button" data-edit>${icon('gauge')}编辑限额</button><button class="btn" type="button" data-rotate>${icon('refresh')}轮换</button>`,
        onMount(p, close) {
          chart = lineChart($('#kd-chart', p), { x: days, series: [{ name: '调用次数', color: SERIES[0], values: k.usage }], height: 190, xFmt: (t) => fmt.date(t), yFmt: (v) => fmt.compact(v), tipFmt: (v) => `${fmt.int(v)} 次`, xTicks: 5 });
          const drawFeed = () => {
            const rows = live.feed.filter((x) => x.key.id === k.id).slice(0, 6);
            $('#kd-feed', p).innerHTML = rows.length ? rows.map((x) => `<div class="kf"><span class="mono">${fmt.time(x.t)}</span><span>${esc(x.model.name)}</span><span class="sc ${x.status === 200 ? 'ok' : x.status === 429 ? 'warn' : 'crit'}">${x.status}</span><span class="mono">${fmt.ms(x.latency)}</span></div>`).join('') : `<p class="field-h">${k.enabled ? '等待新的请求…' : '密钥已停用，没有新的请求。'}</p>`;
          };
          drawFeed();
          const off = live.on(drawFeed);
          p.querySelector('[data-edit]').addEventListener('click', () => { close(); editLimits(k); });
          p.querySelector('[data-rotate]').addEventListener('click', () => { close(); rotate(k); });
          return () => { off(); chart?.destroy(); };
        },
      });
    }

    let layer = null;
    this._open = (params) => {
      const [id] = params;
      layer?.close();
      layer = null;
      if (id === 'new') layer = createModal();
      else if (id && byId(id)) layer = detail(byId(id));
    };
    ctx.keep(() => layer?.close());
    ctx.keep(bus.on('keys', drawStats));
    this._open(ctx.params);
  },
  update(params) { this._open(params); },
};
