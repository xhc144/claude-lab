// 费用分析 · month-to-date spend with forecast against budget, budget controls and alerts, daily cost
// by service, per-team breakdown, balance & top-up, and invoices.

import { pageHead, panel, seg, bindSeg, pill, toggle, bindToggle } from '../ui/kit.js';
import { lineChart, barChart, donut, legend, ring, SERIES, STATUS } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { openLayer, toast } from '../ui/overlay.js';
import { state, bus, pushNotification } from '../core/state.js';
import { DAILY_COST, SERVICES, TEAMS, INVOICES, MTD_COST, NOW } from '../core/data.js';
import { fmt, esc, $, saved } from '../core/util.js';

const SVC_KEYS = ['infer', 'train', 'store', 'net'];

export default {
  domain: 'billing',
  mount(view, ctx) {
    const charts = [];
    const now = new Date(NOW);
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = now.getDate();
    const month = DAILY_COST.filter((d) => d.inMonth);
    const dayTotal = (d) => SVC_KEYS.reduce((a, k) => a + d[k], 0);
    const last7 = DAILY_COST.slice(-7).reduce((a, d) => a + dayTotal(d), 0) / 7;
    const forecast = MTD_COST + last7 * (dim - day);

    view.innerHTML = `
      ${pageHead({
        eyebrow: '账户 · 成本中心',
        title: '费用分析',
        sub: '推理、训练、存储与网络的统一账单。预测基于近 7 日的日均消耗。',
        actions: `<button class="btn" type="button" id="b-dl">${icon('download')}导出账单</button><button class="btn primary" type="button" id="b-topup">${icon('wallet')}充值</button>`,
      })}
      <div class="grid">
        <section class="panel spot rv c-8 keep bill-hero">
          <div class="bh-top">
            <div><span class="eyebrow">${now.getMonth() + 1} 月累计消费 · 第 ${day} / ${dim} 天</span>
              <div class="hn"><b>${fmt.cny(MTD_COST)}</b><span class="delta down">${icon('up')}<span>18.4% 同比上月同期</span></span></div></div>
            <div class="bh-fc"><span>月末预测</span><b>${fmt.cny(forecast)}</b>${forecast > state.budget ? pill('warn', `超出预算 ${fmt.pct(((forecast - state.budget) / state.budget) * 100, 0)}`) : pill('good', '预算内')}</div>
          </div>
          <div id="b-cum-l"></div>
          <div id="b-cum"></div>
        </section>
        <section class="panel spot rv c-4 keep budget" id="budget"></section>
        ${panel({ cls: 'c-8', title: '每日费用', meta: '近 30 天 · 按服务堆叠', tools: seg('b-svc', [{ value: 'all', label: '全部' }, ...SERVICES.map((s) => ({ value: s.id, label: s.name }))], 'all', { small: true, label: '服务' }), body: '<div id="b-daily-l"></div><div id="b-daily"></div>' })}
        ${panel({ cls: 'c-4 t-6', title: '服务构成', meta: '本月', body: '<div id="b-svc-d"></div><div class="mix-l one" id="b-svc-l"></div>' })}
        ${panel({ cls: 'c-12', title: '团队成本', meta: '本月 · 推理 + 训练', body: `<div class="tbl-wrap"><table class="tbl teams"><thead><tr><th>团队</th><th>负责人</th><th class="num">推理</th><th class="num">训练</th><th class="num">合计</th><th>团队预算</th><th class="num">月末预测</th></tr></thead><tbody id="b-teams"></tbody></table></div>` })}
        ${panel({ cls: 'c-5 t-6', title: '账户余额', meta: '预付费', id: 'balance-panel', body: '<div id="b-bal"></div>' })}
        ${panel({ cls: 'c-7', title: '发票与账单', meta: '按月开具 · 增值税专用发票', body: `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>编号</th><th>账期</th><th class="num">金额</th><th>状态</th><th>开具日期</th><th></th></tr></thead><tbody id="b-inv"></tbody></table></div>` })}
      </div>`;

    // cumulative chart ------------------------------------------------------------------------------------
    const days = Array.from({ length: dim }, (_, i) => new Date(now.getFullYear(), now.getMonth(), i + 1).getTime());
    let acc = 0;
    const actual = days.map((_, i) => (i < month.length ? (acc += dayTotal(month[i])) : null));
    const fc = days.map((_, i) => (i < month.length - 1 ? null : MTD_COST + last7 * (i - (month.length - 1))));
    const drawCum = () => {
      charts[0]?.destroy();
      $('#b-cum-l', view).innerHTML = legend([{ name: '实际累计', color: SERIES[0] }, { name: '预测', color: SERIES[2], dash: true }, { name: `预算 ${fmt.cnyCompact(state.budget)}`, color: STATUS.warn, dash: true }]);
      charts[0] = lineChart($('#b-cum', view), {
        x: days, series: [{ name: '实际累计', color: SERIES[0], values: actual }, { name: '预测', color: SERIES[2], values: fc, dash: true, area: false }],
        refLines: [{ y: state.budget, label: `月度预算 ${fmt.cnyCompact(state.budget)}` }], height: 240, xFmt: (t) => `${new Date(t).getDate()} 日`, tipX: (t) => fmt.date(t, true),
        yFmt: (v) => fmt.cnyCompact(v), tipFmt: (v) => fmt.cny(v), xTicks: 7, label: '本月累计费用与预测',
      });
    };
    drawCum();

    // budget ------------------------------------------------------------------------------------------------
    const drawBudget = () => {
      const pct = MTD_COST / state.budget;
      const runway = Math.max(0, (state.budget - MTD_COST) / last7);
      const color = pct >= 0.9 ? STATUS.crit : pct >= 0.7 ? STATUS.warn : SERIES[0];
      $('#budget', view).innerHTML = `
        <div class="p-head"><div class="p-title"><h2>月度预算</h2><span class="p-meta">超出阈值时提醒</span></div></div>
        <div class="bg-ring">${ring(pct, { size: 168, thickness: 12, color, label: '预算使用率' })}<div class="bg-c"><b>${fmt.pct(pct * 100, 0)}</b><span>已使用</span><small>${fmt.cnyCompact(MTD_COST)} / ${fmt.cnyCompact(state.budget)}</small></div></div>
        <dl class="bg-list"><div><dt>剩余预算</dt><dd>${fmt.cny(Math.max(0, state.budget - MTD_COST))}</dd></div><div><dt>按当前速度可用</dt><dd>${runway >= dim - day ? '覆盖到月底' : `约 ${runway.toFixed(1)} 天`}</dd></div><div><dt>日均消耗</dt><dd>${fmt.cny(last7)}</dd></div></dl>
        <div class="field"><label class="field-l" for="bg-v">调整预算 <small id="bg-vv">${fmt.cny(state.budget)}</small></label><input type="range" id="bg-v" min="300000" max="1200000" step="10000" value="${state.budget}"></div>
        <div class="bg-alerts">${[['at50', '50%'], ['at80', '80%'], ['at100', '100%']].map(([k, l]) => `<label class="bg-a">${toggle(`al-${k}`, state.alerts[k], `${l} 提醒`)}<span>${l} 提醒</span></label>`).join('')}</div>`;
      const r = $('#bg-v', view);
      const sync = () => { r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`); $('#bg-vv', view).textContent = fmt.cny(+r.value); };
      sync();
      r.addEventListener('input', sync);
      r.addEventListener('change', () => {
        state.budget = +r.value;
        saved.set('budget', state.budget);
        drawBudget();
        drawCum();
        drawTeams();
        view.querySelector('.bh-fc .pill')?.replaceWith(document.createRange().createContextualFragment(forecast > state.budget ? pill('warn', `超出预算 ${fmt.pct(((forecast - state.budget) / state.budget) * 100, 0)}`) : pill('good', '预算内')));
        toast({ kind: 'good', title: `月度预算已调整为 ${fmt.cny(state.budget)}`, timeout: 2200 });
      });
      for (const k of ['at50', 'at80', 'at100']) {
        bindToggle($(`#al-${k}`, view), (on) => { state.alerts[k] = on; saved.set('alerts', state.alerts); toast({ kind: 'info', title: `${k.slice(2)}% 预算提醒已${on ? '开启' : '关闭'}`, timeout: 1800 }); });
      }
    };
    drawBudget();

    // daily cost ------------------------------------------------------------------------------------------
    const drawDaily = (svc) => {
      charts[1]?.destroy();
      const series = SERVICES.map((s, i) => ({ name: s.name, color: SERIES[i], values: DAILY_COST.map((d) => d[s.id]) })).filter((s, i) => svc === 'all' || SERVICES[i].id === svc);
      $('#b-daily-l', view).innerHTML = legend(series.map((s) => ({ name: s.name, color: s.color, value: fmt.cnyCompact(s.values.reduce((a, b) => a + b, 0)) })));
      charts[1] = barChart($('#b-daily', view), {
        labels: DAILY_COST.map((d) => d.t), series, height: 240, xFmt: (t) => fmt.date(t), tipX: (t) => fmt.date(t, true), yFmt: (v) => fmt.cnyCompact(v), tipFmt: (v) => fmt.cny(v),
        highlight: (i) => DAILY_COST[i].inMonth, label: '每日费用堆叠柱状图',
      });
    };
    drawDaily('all');
    bindSeg(view, 'b-svc', drawDaily);

    const svcTotals = SERVICES.map((s, i) => ({ name: s.name, color: SERIES[i], value: month.reduce((a, d) => a + d[s.id], 0) }));
    charts[2] = donut($('#b-svc-d', view), { segments: svcTotals, fmt: (v) => fmt.cnyCompact(v), centerLabel: '本月合计', centerValue: fmt.cnyCompact(MTD_COST), centerSub: '悬停查看占比', size: 180, thickness: 16 });
    $('#b-svc-l', view).innerHTML = svcTotals.map((s, i) => `<button type="button" class="ml" data-i="${i}"><span class="key" style="background:${s.color}"></span><span class="ml-n">${s.name}</span><b>${fmt.cny(s.value)}</b></button>`).join('');
    $('#b-svc-l', view).addEventListener('pointerover', (e) => { const b = e.target.closest('.ml'); if (b) charts[2].focus(+b.dataset.i); });
    $('#b-svc-l', view).addEventListener('pointerleave', () => charts[2].focus(-1));

    // teams ---------------------------------------------------------------------------------------------------
    const drawTeams = () => {
      $('#b-teams', view).innerHTML = TEAMS.map((t) => {
        const total = t.infer + t.train;
        const fcT = (total / day) * dim;
        const pct = total / t.budget;
        const kind = fcT > t.budget ? 'warn' : '';
        return `<tr><td><b>${esc(t.name)}</b></td><td class="muted">${esc(t.lead)}</td><td class="num">${fmt.cny(t.infer)}</td><td class="num">${fmt.cny(t.train)}</td><td class="num"><b>${fmt.cny(total)}</b></td>
          <td class="tb"><div class="bar ${kind}"><i style="width:${Math.min(100, pct * 100).toFixed(1)}%"></i></div><span>${fmt.pct(pct * 100, 0)} / ${fmt.cnyCompact(t.budget)}</span></td>
          <td class="num">${fmt.cny(fcT)} ${fcT > t.budget ? `<span class="tag warn-t">${icon('alert')}超预算</span>` : ''}</td></tr>`;
      }).join('');
    };
    drawTeams();

    // balance -------------------------------------------------------------------------------------------------
    let autoTop = saved.get('autoTopup', true);
    const drawBalance = () => {
      const days = state.balance / (last7 * 0.45);
      $('#b-bal', view).innerHTML = `
        <div class="bal"><span>可用余额</span><b>${fmt.cny(state.balance)}</b><small>按推理日均消耗约可使用 ${days.toFixed(0)} 天</small></div>
        <div class="pay"><span class="pay-ic">${icon('wallet')}</span><div><b>企业对公账户</b><span>招商银行 · 尾号 8842 · 已验证</span></div>${pill('good', '默认')}</div>
        <label class="bg-a">${toggle('auto-top', autoTop, '自动充值')}<span>余额低于 ¥50,000 时自动充值 ¥100,000</span></label>
        <button class="btn primary wide" type="button" id="b-topup2">${icon('plus')}立即充值</button>`;
      bindToggle($('#auto-top', view), (on) => { autoTop = on; saved.set('autoTopup', on); toast({ kind: 'info', title: on ? '已开启自动充值' : '已关闭自动充值', timeout: 1800 }); });
      $('#b-topup2', view).addEventListener('click', () => ctx.navigate('billing/topup'));
    };
    drawBalance();
    ctx.keep(bus.on('balance', drawBalance));

    // invoices --------------------------------------------------------------------------------------------------
    $('#b-inv', view).innerHTML = [{ id: `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, period: `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`, amount: MTD_COST, status: 'open', issued: null }, ...INVOICES].map((inv) => `<tr>
      <td class="mono">${inv.id}</td><td>${inv.period}</td><td class="num">${fmt.cny(inv.amount)}</td><td>${inv.status === 'paid' ? pill('good', '已支付') : pill('info', '出账中')}</td><td class="muted">${inv.issued ? fmt.date(inv.issued, true) : '月末生成'}</td>
      <td class="num">${inv.status === 'paid' ? `<button type="button" class="btn xs ghost" data-inv="${inv.id}">${icon('download')}PDF</button>` : ''}</td></tr>`).join('');
    $('#b-inv', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-inv]');
      if (!b) return;
      b.classList.add('loading');
      setTimeout(() => { b.classList.remove('loading'); toast({ kind: 'good', title: `${b.dataset.inv}.pdf 已生成`, body: '演示环境不包含真实发票文件' }); }, 700);
    });
    $('#b-dl', view).addEventListener('click', () => {
      const csv = 'date,inference,training,storage,network,total\n' + DAILY_COST.map((d) => `${fmt.date(d.t, true)},${d.infer},${d.train},${d.store},${d.net},${dayTotal(d)}`).join('\n');
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `tensora-billing-${fmt.date(NOW, true)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch { /* sandboxed viewers block downloads; the toast still reports the export */ }
      toast({ kind: 'good', title: '账单明细已导出', body: `近 30 天 · ${DAILY_COST.length} 行` });
    });
    $('#b-topup', view).addEventListener('click', () => ctx.navigate('billing/topup'));

    let layer = null;
    this._open = (params) => {
      layer?.close();
      layer = params[0] === 'topup' ? topup(ctx) : null;
    };
    ctx.keep(() => layer?.close());
    ctx.keep(() => charts.forEach((c) => c?.destroy()));
    this._open(ctx.params);
  },
  update(params) { this._open(params); },
};

function topup(ctx) {
  let amount = 100000, method = 'bank';
  return openLayer({
    kind: 'modal', title: '账户充值', eyebrow: `当前余额 ${fmt.cny(state.balance)}`,
    onClose: () => { if (location.hash === '#/billing/topup') ctx.replace('billing'); },
    body: `<div class="form">
      <div class="field"><span class="field-l">充值金额</span><div class="amounts" id="tp-amt">${[20000, 50000, 100000, 300000].map((v) => `<button type="button" class="amt${v === amount ? ' on' : ''}" data-v="${v}"><b>${fmt.cnyCompact(v)}</b>${v >= 100000 ? `<small>赠 ${v >= 300000 ? '5' : '3'}% 额度</small>` : '<small>&nbsp;</small>'}</button>`).join('')}</div></div>
      <div class="field"><label class="field-l" for="tp-custom">自定义金额 <small>最低 ¥1,000</small></label><input class="input" type="number" id="tp-custom" min="1000" step="1000" placeholder="输入金额"></div>
      <div class="field"><span class="field-l">支付方式</span>${seg('tp-m', [{ value: 'bank', label: '对公转账' }, { value: 'alipay', label: '支付宝企业' }, { value: 'wechat', label: '微信支付' }], 'bank')}</div>
      <div class="tp-sum"><span>到账金额</span><b id="tp-total">${fmt.cny(amount * 1.03)}</b></div>
    </div>`,
    foot: '<button class="btn ghost" type="button" data-x>取消</button><button class="btn primary" type="button" id="tp-go">确认充值</button>',
    onMount(p, close) {
      const total = () => { const bonus = amount >= 300000 ? 0.05 : amount >= 100000 ? 0.03 : 0; $('#tp-total', p).textContent = fmt.cny(amount * (1 + bonus)); return amount * (1 + bonus); };
      $('#tp-amt', p).addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (!b) return;
        amount = +b.dataset.v;
        p.querySelectorAll('.amt').forEach((x) => x.classList.toggle('on', x === b));
        $('#tp-custom', p).value = '';
        total();
      });
      $('#tp-custom', p).addEventListener('input', (e) => {
        const v = Number(e.target.value);
        p.querySelectorAll('.amt').forEach((x) => x.classList.remove('on'));
        e.target.closest('.field').classList.toggle('err', !!e.target.value && v < 1000);
        if (v >= 1000) { amount = v; total(); }
      });
      bindSeg(p, 'tp-m', (v) => { method = v; });
      p.querySelector('[data-x]').addEventListener('click', () => close());
      $('#tp-go', p).addEventListener('click', (e) => {
        const custom = $('#tp-custom', p).value;
        if (custom && Number(custom) < 1000) { $('#tp-custom', p).focus(); toast({ kind: 'warn', title: '充值金额最低 ¥1,000' }); return; }
        e.currentTarget.classList.add('loading');
        e.currentTarget.textContent = method === 'bank' ? '生成转账信息' : '等待支付确认';
        setTimeout(() => {
          const got = total();
          state.balance += got;
          bus.emit('balance');
          close();
          toast({ kind: 'good', title: `充值成功 ${fmt.cny(got)}`, body: `当前余额 ${fmt.cny(state.balance)}（演示，未产生真实交易）` });
          pushNotification({ level: 'good', title: '充值到账', body: `${fmt.cny(got)} 已到账，当前余额 ${fmt.cny(state.balance)}。`, link: 'billing' });
        }, 1100);
      });
    },
  });
}
