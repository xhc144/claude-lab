// 调用统计 · request volume, latency percentiles, status codes, model ranking, a weekday × hour
// heatmap, error breakdown and the live request log with a per-request detail drawer.

import { pageHead, panel, seg, bindSeg, stat, pill } from '../ui/kit.js';
import { lineChart, donut, hbars, legend, SERIES, STATUS, rampAt, showTip, hideTip } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { openLayer, toast } from '../ui/overlay.js';
import { state } from '../core/state.js';
import { live } from '../core/live.js';
import { MODELS, NOW, trafficHistory } from '../core/data.js';
import { fmt, esc, $, rng, hash, debounce } from '../core/util.js';

const RANGES = { '24h': { hours: 24, label: '近 24 小时' }, '7d': { hours: 168, label: '近 7 天' }, '30d': { hours: 720, label: '近 30 天' } };
const ERRORS = [
  { code: 429, type: 'rate_limit_exceeded', msg: '超出密钥 RPM 限制', share: 0.46 },
  { code: 400, type: 'invalid_request', msg: '请求参数不合法（max_tokens 超出上限）', share: 0.22 },
  { code: 500, type: 'upstream_error', msg: '上游模型返回 5xx，已自动重试', share: 0.14 },
  { code: 401, type: 'invalid_api_key', msg: '密钥无效或已停用', share: 0.1 },
  { code: 504, type: 'timeout', msg: '生成超时（> 120 s）', share: 0.08 },
];

function dataset(range, model, key) {
  const { hours } = RANGES[range];
  const h = trafficHistory(hours, hours + 3);
  const share = (model === 'all' ? 1 : (MODELS.find((m) => m.id === model)?.calls || 1e6) / MODELS.reduce((a, m) => a + m.calls, 0)) *
    (key === 'all' ? 1 : 0.18 + (hash(key) % 20) / 100);
  const r = rng(hash(range + model + key));
  let pts = h.map((p) => ({ t: p.t, v: p.v * share }));
  if (range === '30d') {
    pts = Array.from({ length: 30 }, (_, d) => ({ t: pts[d * 24].t, v: pts.slice(d * 24, d * 24 + 24).reduce((a, p) => a + p.v, 0) }));
  }
  const lat = pts.map((p, i) => {
    const load = p.v / Math.max(...pts.map((x) => x.v));
    const p50 = 280 + load * 70 + r.gauss() * 12;
    return { p50, p95: p50 * (2.8 + r() * 0.3) + load * 120, p99: p50 * (5.2 + r() * 0.8) + load * 260 + (i % 17 === 3 ? 900 : 0) };
  });
  const total = pts.reduce((a, p) => a + p.v, 0);
  const errRate = 0.0038 + r() * 0.0012;
  return { pts, lat, total, errRate, share };
}

export default {
  domain: 'gateway',
  mount(view, ctx) {
    let f = { range: '24h', model: 'all', key: 'all' };
    let logFilter = 'all', logQ = '', paused = false;
    const charts = [];

    view.innerHTML = `
      ${pageHead({
        eyebrow: 'API 网关 · 可观测性',
        title: '调用统计',
        sub: '请求量、延迟分位、错误与流量构成。所有指标在网关侧采集，与上游无关。',
        actions: `${seg('u-range', [{ value: '24h', label: '24 小时' }, { value: '7d', label: '7 天' }, { value: '30d', label: '30 天' }], '24h', { label: '时间范围' })}<button class="btn" type="button" id="u-export">${icon('download')}导出 CSV</button>`,
      })}
      <div class="filters rv">
        <label class="flt"><span>${icon('models')}模型</span><select class="select" id="u-model"><option value="all">全部模型</option>${MODELS.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label>
        <label class="flt"><span>${icon('key')}密钥</span><select class="select" id="u-key"><option value="all">全部密钥</option>${state.keys.map((k) => `<option value="${k.id}">${esc(k.name)}</option>`).join('')}</select></label>
        <button class="btn ghost sm" type="button" id="u-clear" hidden>${icon('x')}清除筛选</button>
      </div>
      <div class="grid" id="u-stats"></div>
      <div class="grid">
        ${panel({ cls: 'c-8', title: '请求量', meta: '<span id="u-vol-meta"></span>', body: '<div id="u-vol"></div>' })}
        ${panel({ cls: 'c-4 t-6', title: '状态码分布', meta: '按响应计数', body: '<div id="u-codes"></div><div id="u-codes-l"></div>' })}
        ${panel({ cls: 'c-6', title: '延迟分位', meta: '端到端，含排队与生成', body: `<div id="u-lat-l"></div><div id="u-lat"></div>` })}
        ${panel({ cls: 'c-6 t-6', title: '模型调用排行', meta: '<span id="u-rank-meta"></span>', body: '<div id="u-rank"></div>' })}
        ${panel({ cls: 'c-6', title: '调用时段热力', meta: '近 7 天 · 星期 × 小时', body: '<div class="heat" id="u-heat"></div><div class="heat-k"><span>低</span><i class="ramp cyan"></i><span>高</span></div>' })}
        ${panel({ cls: 'c-6 t-12', title: '错误类型', meta: '<span id="u-err-meta"></span>', body: '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>状态</th><th>类型</th><th class="num">次数</th><th class="num">占比</th></tr></thead><tbody id="u-err"></tbody></table></div>' })}
        ${panel({
          cls: 'c-12', title: '请求日志', meta: '实时 · 最近 80 条采样',
          tools: `<div class="input-icon kq">${icon('search')}<input class="input" id="log-q" placeholder="请求 ID / 模型 / 密钥" aria-label="搜索请求"></div>${seg('log-f', [{ value: 'all', label: '全部' }, { value: 'ok', label: '成功' }, { value: 'err', label: '失败' }], 'all', { small: true, label: '状态筛选' })}<button class="btn sm" type="button" id="log-pause">${icon('pause')}<span>暂停</span></button>`,
          body: '<div class="tbl-wrap"><table class="tbl log"><thead><tr><th>时间</th><th>请求 ID</th><th>模型</th><th>密钥</th><th>区域</th><th>状态</th><th class="num">延迟</th><th class="num">输入</th><th class="num">输出</th><th class="num">费用</th></tr></thead><tbody id="log-body"></tbody></table></div>',
        })}
      </div>`;

    const statusSegs = (d) => {
      const e = d.total * d.errRate;
      return [
        { name: '2xx 成功', value: d.total - e, color: STATUS.good },
        { name: '429 限流', value: e * 0.46, color: STATUS.warn },
        { name: '4xx 客户端', value: e * 0.32, color: STATUS.serious },
        { name: '5xx 服务端', value: e * 0.22, color: STATUS.crit },
      ];
    };

    const build = () => {
      charts.splice(0).forEach((c) => c.destroy());
      const d = dataset(f.range, f.model, f.key);
      const daily = f.range === '30d';
      const xFmt = (t) => (f.range === '24h' ? fmt.time(t, false) : fmt.date(t));
      const tipX = (t) => (daily ? fmt.date(t, true) : `${fmt.date(t)} ${fmt.time(t, false)}`);
      const lat = d.lat;
      const avg = (k) => lat.reduce((a, x) => a + x[k], 0) / lat.length;
      $('#u-stats', view).innerHTML = [
        stat({ label: '总请求', value: fmt.compact(d.total, 2), delta: '6.8%', good: true, sub: RANGES[f.range].label, icon: 'usage' }),
        stat({ label: '成功率', value: fmt.pct(100 - d.errRate * 100, 2), delta: '0.04%', good: true, sub: `${fmt.compact(d.total * d.errRate)} 次失败`, icon: 'ok' }),
        stat({ label: 'P50 延迟', value: fmt.ms(avg('p50')), delta: '3.1%', good: true, up: false, sub: `P95 ${fmt.ms(avg('p95'))}`, icon: 'clock' }),
        stat({ label: 'P99 延迟', value: fmt.ms(avg('p99')), delta: '5.4%', good: false, up: true, sub: '尾延迟主要来自长输出', icon: 'gauge' }),
      ].map((s) => `<div class="c-3">${s}</div>`).join('');
      $('#u-vol-meta', view).textContent = `${RANGES[f.range].label} · ${daily ? '按天' : '按小时'}`;
      charts.push(lineChart($('#u-vol', view), { x: d.pts.map((p) => p.t), series: [{ name: daily ? '请求数 / 天' : '请求数 / 小时', color: SERIES[0], values: d.pts.map((p) => p.v) }], height: 250, xFmt, tipX, yFmt: (v) => fmt.compact(v), tipFmt: (v) => `${fmt.int(v)} 次`, xTicks: 7, label: '请求量折线图' }));
      const segs = statusSegs(d);
      charts.push(donut($('#u-codes', view), { segments: segs, fmt: (v) => fmt.compact(v), centerLabel: '成功率', centerValue: fmt.pct(100 - d.errRate * 100, 2), centerSub: `${fmt.compact(d.total)} 次`, size: 188, thickness: 16 }));
      $('#u-codes-l', view).innerHTML = `<div class="code-l">${segs.map((s, i) => `<div><span class="key" style="background:${s.color}"></span><span>${s.name}</span><b>${fmt.compact(s.value)}</b><small>${i === 0 ? icon('ok') : icon(i === 3 ? 'fail' : 'alert')}${fmt.pct((s.value / d.total) * 100, i ? 2 : 1)}</small></div>`).join('')}</div>`;
      const latSeries = [['P50', 'p50', SERIES[0]], ['P95', 'p95', SERIES[1]], ['P99', 'p99', SERIES[2]]].map(([n, k, c]) => ({ name: n, color: c, values: lat.map((x) => x[k]), area: false }));
      $('#u-lat-l', view).innerHTML = legend(latSeries.map((s) => ({ name: s.name, color: s.color, value: fmt.ms(s.values.reduce((a, b) => a + b, 0) / s.values.length) })));
      charts.push(lineChart($('#u-lat', view), { x: d.pts.map((p) => p.t), series: latSeries, height: 232, xFmt, tipX, yFmt: (v) => fmt.ms(v), glow: false, xTicks: 6, endDot: false, label: '延迟分位折线图' }));
      const ranked = MODELS.filter((m) => f.model === 'all' || m.id === f.model).sort((a, b) => b.calls - a.calls).slice(0, 7);
      const allCalls = MODELS.reduce((a, m) => a + m.calls, 0);
      $('#u-rank-meta', view).textContent = RANGES[f.range].label;
      $('#u-rank', view).innerHTML = hbars(ranked.map((m) => ({ label: m.name, sub: `${fmt.ms(m.ttft)} · ${m.uptime}%`, value: f.model === 'all' ? (m.calls / allCalls) * d.total : d.total, color: SERIES[0], attrs: ` data-model="${m.id}"` })), { fmt: (v) => fmt.compact(v) });
      const errTotal = d.total * d.errRate;
      $('#u-err-meta', view).textContent = `${fmt.compact(errTotal)} 次 · ${RANGES[f.range].label}`;
      $('#u-err', view).innerHTML = ERRORS.map((e) => `<tr><td><span class="sc ${e.code === 429 ? 'warn' : 'crit'}">${e.code}</span></td><td><b class="mono et">${e.type}</b><span class="sub">${e.msg}</span></td><td class="num">${fmt.int(errTotal * e.share)}</td><td class="num"><span class="mini-bar"><i style="width:${e.share * 100}%"></i></span>${fmt.pct(e.share * 100, 0)}</td></tr>`).join('');
      drawHeat(d.share);
      $('#u-clear', view).hidden = f.model === 'all' && f.key === 'all';
    };

    const drawHeat = (share) => {
      const r = rng(77);
      const cells = [];
      for (let dow = 0; dow < 7; dow++) for (let h = 0; h < 24; h++) {
        const daily = 0.62 + 0.38 * Math.sin(((h - 9) / 24) * Math.PI * 2);
        const wk = dow >= 5 ? 0.74 : 1;
        cells.push({ dow, h, v: 0.98e6 * daily * wk * share * (1 + r.gauss() * 0.05) });
      }
      const max = Math.max(...cells.map((c) => c.v)), min = Math.min(...cells.map((c) => c.v));
      const days = ['一', '二', '三', '四', '五', '六', '日'];
      $('#u-heat', view).innerHTML = `<div class="heat-grid">${days.map((d, dow) => `<span class="hd-l">周${d}</span>${cells.filter((c) => c.dow === dow).map((c) => `<i data-d="${dow}" data-h="${c.h}" data-v="${Math.round(c.v)}" style="background:${rampAt('cyan', 0.08 + ((c.v - min) / (max - min)) * 0.92)}"></i>`).join('')}`).join('')}<span></span>${Array.from({ length: 24 }, (_, h) => `<span class="hh-l">${h % 3 === 0 ? h : ''}</span>`).join('')}</div>`;
    };
    $('#u-heat', view).addEventListener('pointermove', (e) => {
      const c = e.target.closest('i[data-v]');
      if (!c) { hideTip(); return; }
      showTip(`<div class="th">周${'一二三四五六日'[c.dataset.d]} · ${c.dataset.h}:00–${+c.dataset.h + 1}:00</div><div class="tr"><span class="n">平均请求</span><b>${fmt.int(c.dataset.v)} 次/小时</b></div>`, e.clientX, e.clientY);
    });
    $('#u-heat', view).addEventListener('pointerleave', hideTip);
    $('#u-rank', view).addEventListener('click', (e) => { const r = e.target.closest('[data-model]'); if (r) { f.model = r.dataset.model; $('#u-model', view).value = f.model; build(); } });

    build();
    bindSeg(view, 'u-range', (v) => { f.range = v; build(); });
    $('#u-model', view).addEventListener('change', (e) => { f.model = e.target.value; build(); });
    $('#u-key', view).addEventListener('change', (e) => { f.key = e.target.value; build(); });
    $('#u-clear', view).addEventListener('click', () => { f.model = 'all'; f.key = 'all'; $('#u-model', view).value = 'all'; $('#u-key', view).value = 'all'; build(); });
    $('#u-export', view).addEventListener('click', () => {
      const d = dataset(f.range, f.model, f.key);
      const csv = 'time,requests,p50_ms,p95_ms,p99_ms\n' + d.pts.map((p, i) => `${new Date(p.t).toISOString()},${Math.round(p.v)},${Math.round(d.lat[i].p50)},${Math.round(d.lat[i].p95)},${Math.round(d.lat[i].p99)}`).join('\n');
      const name = `tensora-usage-${f.range}-${fmt.date(NOW, true)}.csv`;
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch { /* sandboxed viewers block downloads; the toast still reports the export */ }
      toast({ kind: 'good', title: '已导出 CSV', body: `${name} · ${d.pts.length} 行` });
    });

    // request log --------------------------------------------------------------------------------------------
    const body = $('#log-body', view);
    const drawLog = () => {
      const q = logQ.toLowerCase();
      const rows = live.feed.filter((r) => (logFilter === 'all' || (logFilter === 'ok' ? r.status === 200 : r.status !== 200)) && (!q || (r.id + r.model.name + r.key.name).toLowerCase().includes(q))).slice(0, 14);
      body.innerHTML = rows.length ? rows.map((r) => `<tr class="click" data-id="${r.id}"><td class="mono">${fmt.time(r.t)}</td><td class="mono rid">${r.id}</td><td>${esc(r.model.name)}</td><td class="muted">${esc(r.key.name)}</td><td class="muted">${r.region.name}</td><td><span class="sc ${r.status === 200 ? 'ok' : r.status === 429 ? 'warn' : 'crit'}">${r.status}</span></td><td class="num">${fmt.ms(r.latency)}</td><td class="num">${fmt.int(r.tin)}</td><td class="num">${fmt.int(r.tout)}</td><td class="num">¥${r.cost.toFixed(4)}</td></tr>`).join('')
        : `<tr><td colspan="10"><div class="empty">${icon('search')}<b>没有符合条件的请求</b><span>${logFilter === 'err' ? '最近的采样中没有失败请求。' : '换个关键词试试。'}</span></div></td></tr>`;
    };
    if (live.feed.length < 10) for (let i = 0; i < 6; i++) live.step();
    drawLog();
    let hovering = false; // rows stay put under the pointer so they can be clicked
    body.addEventListener('pointerenter', () => { hovering = true; });
    body.addEventListener('pointerleave', () => { hovering = false; });
    ctx.keep(live.on(() => { if (!paused && !hovering) drawLog(); }));
    bindSeg(view, 'log-f', (v) => { logFilter = v; drawLog(); });
    $('#log-q', view).addEventListener('input', debounce((e) => { logQ = e.target.value.trim(); drawLog(); }));
    $('#log-pause', view).addEventListener('click', (e) => {
      paused = !paused;
      e.currentTarget.innerHTML = paused ? `${icon('play')}<span>继续</span>` : `${icon('pause')}<span>暂停</span>`;
      e.currentTarget.classList.toggle('primary', paused);
      if (!paused) drawLog();
    });
    body.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      const r = tr && live.feed.find((x) => x.id === tr.dataset.id);
      if (r) openRequest(r);
    });
    ctx.keep(() => charts.forEach((c) => c.destroy()));
  },
};

function openRequest(r) {
  const queue = r.status === 429 ? r.latency : Math.min(30, r.latency * 0.03);
  const route = r.status === 429 ? 0 : 6 + (hash(r.id) % 14);
  const first = r.status === 200 ? Math.max(20, r.model.ttft * 0.9) : 0;
  const gen = Math.max(0, r.latency - queue - route - first);
  const total = queue + route + first + gen || 1;
  const steps = [['排队与鉴权', queue, SERIES[6]], ['路由决策', route, SERIES[2]], ['首字生成', first, SERIES[0]], ['流式输出', gen, SERIES[3]]];
  let left = 0;
  const json = (o) => JSON.stringify(o, null, 2).replace(/("[^"]*")(\s*:)?/g, (m, s, colon) => (colon ? `<span class="tk-p">${esc(s)}</span>${colon}` : `<span class="tk-s">${esc(s)}</span>`)).replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tk-n">$1</span>');
  const req = { model: r.model.id, stream: r.stream, max_tokens: 2048, messages: [{ role: 'system', content: '你是星枢智能客服…' }, { role: 'user', content: '（已脱敏，共 ' + r.tin + ' tokens）' }] };
  const res = r.status === 200
    ? { id: r.id, object: 'chat.completion', model: r.model.id, usage: { prompt_tokens: r.tin, completion_tokens: r.tout, total_tokens: r.tin + r.tout }, upstream: r.model.provider === 'tensora' ? 'sh-h200-pool' : `${r.model.provider}-relay` }
    : { error: { code: r.status, type: ERRORS.find((e) => e.code === r.status)?.type || 'upstream_error', message: ERRORS.find((e) => e.code === r.status)?.msg || '上游错误' } };
  openLayer({
    kind: 'drawer', wide: true, eyebrow: `请求详情 · ${fmt.time(r.t)}`, title: `<span class="mono">${r.id}</span>`,
    body: `<div class="kd-head">${r.status === 200 ? pill('good', '200 成功') : r.status === 429 ? pill('warn', '429 限流') : pill('crit', `${r.status} 失败`)}<span class="tag">${esc(r.model.name)}</span><span class="tag">${esc(r.key.name)}</span><span class="tag">${r.region.name}</span>${r.stream ? '<span class="tag">流式</span>' : ''}</div>
      <div class="kd-kpis"><div><span>总耗时</span><b>${fmt.ms(r.latency)}</b></div><div><span>输入 Tokens</span><b>${fmt.int(r.tin)}</b></div><div><span>输出 Tokens</span><b>${fmt.int(r.tout)}</b></div><div><span>费用</span><b>¥${r.cost.toFixed(5)}</b></div></div>
      <h3 class="md-h">耗时分解</h3>
      <div class="wf">${steps.map(([n, v, c]) => { const row = `<div class="wf-r"><span>${n}</span><div class="wf-t"><i style="left:${(left / total) * 100}%;width:${Math.max(0.6, (v / total) * 100)}%;background:${c}"></i></div><b>${fmt.ms(v)}</b></div>`; left += v; return row; }).join('')}</div>
      <h3 class="md-h">请求</h3><div class="code"><div class="code-h"><span>json</span><button type="button" class="btn xs ghost" data-copy>${icon('copy')}复制</button></div><pre><code>${json(req)}</code></pre></div>
      <h3 class="md-h">响应</h3><div class="code"><div class="code-h"><span>json</span><button type="button" class="btn xs ghost" data-copy>${icon('copy')}复制</button></div><pre><code>${json(res)}</code></pre></div>`,
  });
}
