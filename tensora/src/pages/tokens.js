// Token 消耗 · monthly token mix, daily input / output, a 26-week activity calendar, prompt-cache
// savings, per-model and per-key breakdowns and actionable optimisation suggestions.

import { pageHead, panel, seg, bindSeg, stat } from '../ui/kit.js';
import { lineChart, barChart, hbars, legend, ring, SERIES, rampAt, showTip, hideTip } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { openLayer, toast } from '../ui/overlay.js';
import { state, bus } from '../core/state.js';
import { MODELS, DAILY_TOKENS, DAILY_COST, PROVIDERS, NOW } from '../core/data.js';
import { fmt, esc, $, saved } from '../core/util.js';

export default {
  domain: 'gateway',
  mount(view, ctx) {
    let range = 30;
    const charts = [];
    const today = new Date(NOW);
    const monthDays = DAILY_TOKENS.slice(-today.getDate());
    const mIn = monthDays.reduce((a, d) => a + d.input, 0), mOut = monthDays.reduce((a, d) => a + d.output, 0), mCache = monthDays.reduce((a, d) => a + d.cached, 0);
    const mTotal = mIn + mOut;
    const blendedIn = 1.6, blendedCache = 0.16; // ¥ per 1M tokens, blended across models
    const cacheSaved = (mCache / 1e6) * (blendedIn - blendedCache);
    const applied = new Set(saved.get('tips', []));

    view.innerHTML = `
      ${pageHead({
        eyebrow: 'API 网关 · 用量',
        title: 'Token 消耗',
        sub: '输入、输出与缓存命中的 Token 走势，以及它们落在哪些模型和密钥上。',
        actions: `${seg('t-range', [{ value: '30', label: '30 天' }, { value: '90', label: '90 天' }, { value: '180', label: '180 天' }], '30', { label: '时间范围' })}<button class="btn" type="button" id="t-alert">${icon('bell')}用量提醒</button>`,
      })}
      <section class="panel spot rv tok-hero">
        <div class="th-left">
          <span class="eyebrow">${today.getMonth() + 1} 月累计 · 截至今日</span>
          <div class="hn"><b>${fmt.compact(mTotal, 1)}</b><small>tokens</small><span class="delta up">${icon('up')}<span>14.2% 环比</span></span></div>
          <div class="mixbar" role="img" aria-label="输入 ${fmt.pct(((mIn - mCache) / mTotal) * 100)}，缓存命中 ${fmt.pct((mCache / mTotal) * 100)}，输出 ${fmt.pct((mOut / mTotal) * 100)}">
            <i style="flex:${mIn - mCache};background:${SERIES[0]}"></i><i style="flex:${mCache};background:${SERIES[6]}"></i><i style="flex:${mOut};background:${SERIES[2]}"></i>
          </div>
          ${legend([
            { name: '输入（未命中）', color: SERIES[0], value: fmt.compact(mIn - mCache, 1) },
            { name: '输入（缓存命中）', color: SERIES[6], value: fmt.compact(mCache, 1) },
            { name: '输出', color: SERIES[2], value: fmt.compact(mOut, 1) },
          ])}
        </div>
        <div class="th-right">
          ${stat({ label: '日均消耗', value: fmt.compact(mTotal / monthDays.length, 1), sub: '工作日约为周末的 1.6 倍', icon: 'calendar' })}
          ${stat({ label: '输出 / 输入比', value: (mOut / mIn).toFixed(2), sub: '对话类业务的典型区间 0.2–0.4', icon: 'sort' })}
          ${stat({ label: '月末预测', value: fmt.compact((mTotal / monthDays.length) * 31, 1), sub: '按近 7 日斜率外推', icon: 'trend' })}
        </div>
      </section>
      <div class="grid">
        ${panel({ cls: 'c-8 keep', title: '每日 Token', meta: '<span id="t-daily-meta"></span>', body: '<div id="t-daily-l"></div><div id="t-daily"></div>' })}
        ${panel({
          cls: 'c-4 keep cache-panel', title: '提示词缓存', meta: '本月',
          body: `<div class="cache">${ring(mCache / mIn, { size: 150, thickness: 12, color: SERIES[6], label: '缓存命中率' })}<div class="cache-c"><b>${fmt.pct((mCache / mIn) * 100, 1)}</b><span>输入命中率</span></div></div>
            <div class="cache-s"><div><span>节省费用</span><b>${fmt.cny(cacheSaved)}</b></div><div><span>命中 Tokens</span><b>${fmt.compact(mCache, 1)}</b></div></div>
            <p class="field-h">缓存命中的输入按标准价的 10% 计费。把稳定的系统提示词放在消息开头可提高命中率。</p>`,
        })}
        ${panel({ cls: 'c-12', title: '活跃日历', meta: '近 26 周 · 每日 Token 总量', tools: '<div class="heat-k"><span>少</span><i class="ramp cyan"></i><span>多</span></div>', body: '<div class="cal-wrap" id="t-cal"></div>' })}
        ${panel({ cls: 'c-7', title: '按模型', meta: '本月 · 点击行查看模型', body: '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>模型</th><th class="num">输入</th><th class="num">输出</th><th class="num">费用</th><th>占比</th></tr></thead><tbody id="t-models"></tbody></table></div>' })}
        ${panel({ cls: 'c-5', title: '按密钥', meta: '本月 Token 总量', body: '<div id="t-keys"></div>' })}
        ${panel({ cls: 'c-12', title: '优化建议', meta: '基于近 30 天调用特征估算', body: '<div class="tips-grid" id="t-tips"></div>' })}
      </div>`;

    // daily chart ---------------------------------------------------------------------------------------
    const drawDaily = () => {
      charts.splice(0).forEach((c) => c.destroy());
      const days = DAILY_TOKENS.slice(-range);
      const series = [{ name: '输入', color: SERIES[0], values: days.map((d) => d.input) }, { name: '输出', color: SERIES[2], values: days.map((d) => d.output) }];
      $('#t-daily-meta', view).textContent = `近 ${range} 天 · ${range <= 30 ? '堆叠柱状' : '面积'}`;
      $('#t-daily-l', view).innerHTML = legend(series.map((s) => ({ name: s.name, color: s.color, value: fmt.compact(s.values.reduce((a, b) => a + b, 0), 2) })));
      const host = $('#t-daily', view);
      host.innerHTML = '';
      charts.push(range <= 30
        ? barChart(host, { labels: days.map((d) => d.t), series, height: 250, xFmt: (t) => fmt.date(t), tipX: (t) => fmt.date(t, true), yFmt: (v) => fmt.compact(v), tipFmt: (v) => fmt.compact(v, 2), label: '每日 Token 堆叠柱状图' })
        : lineChart(host, { x: days.map((d) => d.t), series, height: 250, xFmt: (t) => fmt.date(t), tipX: (t) => fmt.date(t, true), yFmt: (v) => fmt.compact(v), tipFmt: (v) => fmt.compact(v, 2), glow: false, xTicks: 6, label: '每日 Token 面积图' }));
    };
    drawDaily();
    bindSeg(view, 't-range', (v) => { range = +v; drawDaily(); });
    ctx.keep(() => charts.forEach((c) => c.destroy()));

    // calendar --------------------------------------------------------------------------------------------
    const cal = $('#t-cal', view);
    const days = DAILY_TOKENS.slice(-26 * 7 + ((7 - ((new Date(NOW).getDay() + 6) % 7) - 1)));
    const vals = days.map((d) => d.input + d.output);
    const max = Math.max(...vals), min = Math.min(...vals);
    const firstDow = (new Date(days[0].t).getDay() + 6) % 7;
    const cells = Array(firstDow).fill(null).concat(days);
    let months = '';
    let lastMonth = -1;
    for (let w = 0; w < Math.ceil(cells.length / 7); w++) {
      const d = cells[w * 7] || cells[w * 7 + 6];
      const mo = d ? new Date(d.t).getMonth() : lastMonth;
      months += `<span>${mo !== lastMonth ? `${mo + 1} 月` : ''}</span>`;
      lastMonth = mo;
    }
    cal.innerHTML = `<div class="cal">
      <div class="cal-m" style="--w:${Math.ceil(cells.length / 7)}">${months}</div>
      <div class="cal-d"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div>
      <div class="cal-g" style="--w:${Math.ceil(cells.length / 7)}">${cells.map((d) => d ? `<i data-t="${d.t}" data-v="${Math.round(d.input + d.output)}" style="background:${rampAt('cyan', 0.1 + ((d.input + d.output - min) / (max - min)) * 0.9)}"></i>` : '<i class="nil"></i>').join('')}</div>
    </div>`;
    cal.addEventListener('pointermove', (e) => {
      const c = e.target.closest('i[data-v]');
      if (!c) { hideTip(); return; }
      const d = new Date(+c.dataset.t);
      showTip(`<div class="th">${fmt.date(+c.dataset.t, true)} · 星期${'日一二三四五六'[d.getDay()]}</div><div class="tr"><span class="n">Token 总量</span><b>${fmt.compact(+c.dataset.v, 2)}</b></div>`, e.clientX, e.clientY);
    });
    cal.addEventListener('pointerleave', hideTip);

    // models table ------------------------------------------------------------------------------------------
    const priced = MODELS.filter((m) => m.pin > 0);
    const w = priced.map((m) => m.calls * (m.ctx > 300000 ? 1.5 : 1) * (m.cat === 'embed' ? 0.5 : 1));
    const wSum = w.reduce((a, b) => a + b, 0);
    const rows = priced.map((m, i) => {
      const share = w[i] / wSum;
      const tin = mIn * share * (m.cat === 'embed' ? 1.4 : 1), tout = m.pout ? mOut * share * 1.1 : 0;
      return { m, share, tin, tout, raw: (tin / 1e6) * m.pin * 0.7 + (tout / 1e6) * m.pout };
    });
    // list prices before volume discounts; scale so the column reconciles with this month's inference bill
    const inferMTD = DAILY_COST.filter((d) => d.inMonth).reduce((a, d) => a + d.infer, 0);
    const rawSum = rows.reduce((a, r) => a + r.raw, 0);
    rows.forEach((r) => { r.cost = (r.raw / rawSum) * inferMTD; });
    rows.sort((a, b) => b.share - a.share).splice(8);
    $('#t-models', view).innerHTML = rows.map((r) => `<tr class="click" data-model="${r.m.id}"><td><b>${esc(r.m.name)}</b><span class="sub">${esc(PROVIDERS[r.m.provider].name)}</span></td><td class="num">${fmt.compact(r.tin, 2)}</td><td class="num">${r.tout ? fmt.compact(r.tout, 2) : '—'}</td><td class="num">${fmt.cny(r.cost)}</td><td class="share"><span class="mini-bar"><i style="width:${(r.share / rows[0].share) * 100}%"></i></span>${fmt.pct(r.share * 100, 1)}</td></tr>`).join('');
    $('#t-models', view).addEventListener('click', (e) => { const tr = e.target.closest('[data-model]'); if (tr) ctx.navigate(`models/${tr.dataset.model}`); });

    // keys --------------------------------------------------------------------------------------------------
    const drawKeys = () => {
      const kw = state.keys.map((k) => k.usage.reduce((a, b) => a + b, 0));
      const kSum = kw.reduce((a, b) => a + b, 0) || 1;
      $('#t-keys', view).innerHTML = hbars(state.keys.map((k, i) => ({ label: k.name, sub: k.owner, value: (kw[i] / kSum) * mTotal, color: SERIES[0], attrs: ` data-key="${k.id}"` })).sort((a, b) => b.value - a.value), { fmt: (v) => fmt.compact(v, 2) });
    };
    drawKeys();
    ctx.keep(bus.on('keys', drawKeys));
    $('#t-keys', view).addEventListener('click', (e) => { const r = e.target.closest('[data-key]'); if (r) ctx.navigate(`keys/${r.dataset.key}`); });

    // tips --------------------------------------------------------------------------------------------------
    const TIPS = [
      { id: 'route', icon: 'route', title: '短对话自动降级', body: '32% 的请求输入少于 500 tokens 且无工具调用，可路由到 Tensora Swift。', save: 18400, action: '启用路由策略' },
      { id: 'cache', icon: 'layers', title: '固定系统提示词前缀', body: '「生产 · 智能客服」每次请求携带 3.1K tokens 相同前缀，但缓存命中率仅 12%。', save: 9600, action: '查看接入指南' },
      { id: 'batch', icon: 'clock', title: '离线任务改用批处理', body: '每晚 01:00–05:00 的评测流量对时延不敏感，批处理 API 价格为标准价的一半。', save: 7200, action: '开启批处理' },
    ];
    const drawTips = () => {
      $('#t-tips', view).innerHTML = TIPS.map((t) => `<div class="tip${applied.has(t.id) ? ' done' : ''}">
        <span class="tip-ic">${icon(applied.has(t.id) ? 'check' : t.icon)}</span>
        <div class="tip-b"><b>${t.title}</b><span>${t.body}</span></div>
        <div class="tip-s"><small>预计每月节省</small><b>${fmt.cny(t.save)}</b></div>
        <button type="button" class="btn sm${applied.has(t.id) ? '' : ' primary'}" data-tip="${t.id}">${applied.has(t.id) ? `${icon('check')}已应用` : t.action}</button>
      </div>`).join('');
    };
    drawTips();
    $('#t-tips', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-tip]');
      if (!b) return;
      const t = TIPS.find((x) => x.id === b.dataset.tip);
      if (t.id === 'cache' && !applied.has('cache')) { ctx.navigate('models/tensora-swift/code'); }
      if (applied.has(t.id)) {
        applied.delete(t.id);
        toast({ kind: 'info', title: `已撤销「${t.title}」` });
      } else {
        applied.add(t.id);
        toast({ kind: 'good', title: `已应用「${t.title}」`, body: `预计每月节省 ${fmt.cny(t.save)}，效果将在 24 小时后显示在费用分析中` });
      }
      saved.set('tips', [...applied]);
      drawTips();
    });

    $('#t-alert', view).addEventListener('click', () => {
      openLayer({
        kind: 'modal', title: 'Token 用量提醒', eyebrow: '通知',
        body: `<div class="form">
          <div class="field"><label class="field-l" for="ta-daily">单日超过 <small id="ta-daily-v"></small></label><input id="ta-daily" type="range" min="5" max="60" value="30"></div>
          <div class="field"><label class="field-l" for="ta-month">本月累计超过 <small id="ta-month-v"></small></label><input id="ta-month" type="range" min="100" max="1500" step="50" value="700"></div>
          <div class="field"><span class="field-l">通知渠道</span><div class="chips">${['站内通知', '邮件', '企业微信', 'Webhook'].map((c, i) => `<button type="button" class="chip${i < 2 ? ' on' : ''}" aria-pressed="${i < 2}">${c}</button>`).join('')}</div></div>
        </div>`,
        foot: '<button class="btn ghost" type="button" data-x>取消</button><button class="btn primary" type="button" data-save>保存提醒</button>',
        onMount(p, close) {
          const sync = () => {
            for (const [id, unit] of [['ta-daily', 'B'], ['ta-month', 'B']]) {
              const el = $(`#${id}`, p);
              el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
              $(`#${id}-v`, p).textContent = `${el.value}${unit} tokens`;
            }
          };
          p.querySelectorAll('input[type=range]').forEach((el) => el.addEventListener('input', sync));
          sync();
          p.querySelector('.chips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) { c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on')); } });
          p.querySelector('[data-x]').addEventListener('click', () => close());
          p.querySelector('[data-save]').addEventListener('click', () => {
            const ch = [...p.querySelectorAll('.chip.on')].map((c) => c.textContent);
            if (!ch.length) { toast({ kind: 'warn', title: '请至少选择一个通知渠道' }); return; }
            close();
            toast({ kind: 'good', title: '用量提醒已保存', body: `单日 ${$('#ta-daily', p).value}B · 月累计 ${$('#ta-month', p).value}B · ${ch.join('、')}` });
          });
        },
      });
    });
  },
};
