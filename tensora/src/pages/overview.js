// 总览 · the command center. Live gateway throughput, the GPU "compute core", training runs,
// model performance, routing topology, token mix, the live request stream and recent events.

import { pageHead, panel, seg, bindSeg, stat, pill, jobPill, progress } from '../ui/kit.js';
import { lineChart, barChart, donut, sparkline, legend, SERIES, rampAt, STATUS, SURFACE, showTip, hideTip, tipRow } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { sigil } from '../ui/sigil.js';
import { openNotifications } from '../ui/shell.js';
import { live } from '../core/live.js';
import { state, bus } from '../core/state.js';
import { GPUS, NODES, POOLS, MODELS, ROUTES_UPSTREAM, REGIONS, DAILY_COST, DAILY_TOKENS, MTD_COST, trafficHistory, BASE_MODELS } from '../core/data.js';
import { fmt, esc, tweenNumber, $, reducedMotion } from '../core/util.js';

const LVL_ICON = { good: 'ok', warn: 'alert', crit: 'fail', info: 'info' };

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
}

// ---- compute core ring --------------------------------------------------------------------------

function coreRing(size = 280) {
  const c = size / 2;
  const rOuter = c - 31, rInner = c - 51;
  const poolGap = 0.09, nodeGap = 0.014;
  const nodeCount = NODES.length;
  const free = Math.PI * 2 - POOLS.length * poolGap - (nodeCount - POOLS.length) * nodeGap;
  const per = free / GPUS.length;
  let a = poolGap / 2;
  const arc = (r, a0, a1) => {
    const p = (ang) => [c + r * Math.sin(ang), c - r * Math.cos(ang)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  let outer = '', inner = '', labels = '';
  let prevPool = null;
  NODES.forEach((node, ni) => {
    if (prevPool && prevPool !== node.pool) a += poolGap;
    else if (ni > 0) a += nodeGap;
    if (prevPool !== node.pool) {
      const pool = POOLS.find((p) => p.id === node.pool);
      const span = pool.nodes * 8 * per + (pool.nodes - 1) * nodeGap;
      const mid = a + span / 2;
      const lr = c - 10;
      labels += `<text class="core-pool" x="${(c + lr * Math.sin(mid)).toFixed(1)}" y="${(c - lr * Math.cos(mid)).toFixed(1)}" text-anchor="middle" dy="3" transform="rotate(${((mid * 180) / Math.PI + (mid > Math.PI / 2 && mid < Math.PI * 1.5 ? 180 : 0)).toFixed(1)} ${(c + lr * Math.sin(mid)).toFixed(1)} ${(c - lr * Math.cos(mid)).toFixed(1)})">${pool.short}</text>`;
    }
    prevPool = node.pool;
    for (const g of node.gpus) {
      const a0 = a + 0.004, a1 = a + per - 0.004;
      outer += `<path class="cg" data-g="${g.i}" d="${arc(rOuter, a0, a1)}"/>`;
      inner += `<path class="cm" data-g="${g.i}" d="${arc(rInner, a0, a1)}"/>`;
      a += per;
    }
  });
  return `<svg class="core-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="GPU 集群利用率环形图：外环为算力利用率，内环为显存占用">
    <defs><radialGradient id="core-glow"><stop offset="0" stop-color="var(--acc-a)" stop-opacity=".22"/><stop offset="1" stop-color="var(--acc-a)" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${c}" cy="${c}" r="${rInner - 14}" fill="url(#core-glow)" class="core-glow"/>
    <circle cx="${c}" cy="${c}" r="${rInner - 16}" class="core-orbit"/>
    <g class="core-outer">${outer}</g><g class="core-inner">${inner}</g>${labels}
  </svg>`;
}

function paintCore(root) {
  root.querySelectorAll('.cg').forEach((p) => {
    const g = GPUS[+p.dataset.g];
    const col = g.status === 'crit' ? STATUS.crit : g.status === 'warn' ? STATUS.warn : rampAt('cyan', 0.12 + (g.util / 100) * 0.88);
    p.setAttribute('stroke', col);
    p.classList.toggle('alert', g.status !== 'ok');
  });
  root.querySelectorAll('.cm').forEach((p) => {
    const g = GPUS[+p.dataset.g];
    p.setAttribute('stroke', g.status === 'crit' ? STATUS.crit : rampAt('violet', 0.1 + g.mem * 0.9));
  });
}

// ---- routing topology ---------------------------------------------------------------------------

function topology(width = 760, height = 300) {
  const L = 92, Rx = width - 150, cx = width / 2 - 20, cy = height / 2;
  const ly = (i, n) => 34 + (i * (height - 68)) / (n - 1);
  let paths = '', nodes = '', packets = '';
  const motion = !reducedMotion();
  REGIONS.forEach((r, i) => {
    const y = ly(i, REGIONS.length);
    const d = `M${L},${y} C${(L + cx) / 2},${y} ${(L + cx) / 2},${cy} ${cx - 36},${cy}`;
    paths += `<path class="tp-in" d="${d}" style="stroke-width:${(1 + r.share * 10).toFixed(1)}px"/>`;
    nodes += `<g class="tp-node" data-tip-k="region" data-i="${i}"><circle cx="${L}" cy="${y}" r="5"/><text x="${L - 14}" y="${y}" dy="4" text-anchor="end">${r.name}</text><text class="tp-v" x="${L - 14}" y="${y}" dy="17" text-anchor="end">${Math.round(r.share * 100)}%</text></g>`;
    if (motion) for (let k = 0; k < Math.ceil(r.share * 8); k++) packets += `<circle class="pk in" r="2.2"><animateMotion dur="${(2.6 - r.share * 2).toFixed(2)}s" begin="${(k * 0.43 + i * 0.17).toFixed(2)}s" repeatCount="indefinite" path="${d}"/></circle>`;
  });
  ROUTES_UPSTREAM.forEach((u, i) => {
    const y = ly(i, ROUTES_UPSTREAM.length);
    const d = `M${cx + 36},${cy} C${(cx + Rx) / 2},${cy} ${(cx + Rx) / 2},${y} ${Rx},${y}`;
    paths += `<path class="tp-out ${u.health}" data-u="${i}" d="${d}" style="stroke-width:${(1 + u.share * 10).toFixed(1)}px"/>`;
    nodes += `<g class="tp-node up ${u.health}" data-tip-k="up" data-i="${i}"><rect x="${Rx}" y="${y - 15}" width="140" height="30" rx="9"/><circle cx="${Rx + 13}" cy="${y}" r="3.5" class="hd"/><text x="${Rx + 24}" y="${y}" dy="4">${u.name}</text></g>`;
    if (motion) for (let k = 0; k < Math.ceil(u.share * 8); k++) packets += `<circle class="pk out ${u.kind}" r="2.2"><animateMotion dur="${(2.4 - u.share * 1.6).toFixed(2)}s" begin="${(k * 0.37 + i * 0.21).toFixed(2)}s" repeatCount="indefinite" path="${d}"/></circle>`;
  });
  const hex = (r) => Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k - Math.PI / 2; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const hub = `<g class="tp-hub"><polygon points="${hex(44)}" class="h-glow"/><polygon points="${hex(36)}" class="h-body"/><polygon points="${hex(26)}" class="h-core"/>
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="h-t">GATEWAY</text><text x="${cx}" y="${cy + 12}" text-anchor="middle" class="h-s" id="tp-rps">— rps</text></g>`;
  return `<svg class="topo" viewBox="0 0 ${width} ${height}" role="img" aria-label="智能路由拓扑：接入区域经网关分发到各上游">
    <text class="tp-h" x="${L}" y="14" text-anchor="end">接入区域</text><text class="tp-h" x="${Rx}" y="14">上游与集群</text>
    ${paths}${packets}${hub}${nodes}</svg>`;
}

// ---- page -----------------------------------------------------------------------------------------

export default {
  domain: 'core',
  mount(view, ctx) {
    const running = state.jobs.filter((j) => j.status === 'running');
    const crit = state.notifications.filter((n) => n.level === 'crit' && !n.read).length;
    const now = new Date();
    const dateStr = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${'日一二三四五六'[now.getDay()]}`;
    const days14 = trafficHistory(24 * 14, 9);
    const dayTotals = Array.from({ length: 14 }, (_, d) => days14.slice(d * 24, d * 24 + 24).reduce((a, x) => a + x.v, 0));
    const tokens14 = DAILY_TOKENS.slice(-14).map((d) => d.input + d.output);
    const cost14 = DAILY_COST.slice(-14).map((d) => d.infer + d.train + d.store + d.net);

    view.innerHTML = `
      ${pageHead({
        eyebrow: `指挥中心 · ${dateStr}`,
        title: `${greeting()}，${esc(state.user.name)}`,
        sub: `网关运行平稳，<b>${running.length}</b> 个训练任务进行中${crit ? `，<a href="#/cluster" class="lnk crit">${crit} 条严重告警</a>需要处理` : '，没有未处理的严重告警'}。`,
        actions: `<a class="btn" href="#/training">${icon('training')}新建训练</a><a class="btn primary" href="#/keys/new">${icon('plus')}创建密钥</a>`,
      })}
      <div class="grid">
        <section class="panel spot rv hero c-8">
          <div class="hero-top">
            <div class="hero-num">
              <span class="eyebrow"><i class="live-dot"></i>网关实时吞吐 · 全部区域</span>
              <div class="hn"><b id="hero-rps">0</b><small>req/s</small><span class="delta up" id="hero-delta">${icon('up')}<span>—</span></span></div>
            </div>
            ${seg('hero-range', [{ value: 'live', label: '实时' }, { value: '24h', label: '24 小时' }, { value: '7d', label: '7 天' }], 'live', { label: '时间范围' })}
          </div>
          <div class="hero-chips">
            <div class="hc"><span>成功率</span><b id="hc-ok">—</b></div>
            <div class="hc"><span>P95 延迟</span><b id="hc-p95">—</b></div>
            <div class="hc"><span>Tokens / 秒</span><b id="hc-tok">—</b></div>
            <div class="hc"><span>活跃密钥</span><b>${state.keys.filter((k) => k.enabled).length}</b></div>
            <div class="hc"><span>在线模型</span><b>${MODELS.length}</b></div>
          </div>
          <div class="hero-chart" id="hero-chart"></div>
        </section>

        <section class="panel spot rv core c-4">
          <div class="p-head"><div class="p-title"><h2>算力核心</h2><span class="p-meta">${GPUS.length} GPU · ${NODES.length} 节点</span></div><a class="btn xs ghost" href="#/cluster">集群${icon('right')}</a></div>
          <div class="core-wrap" id="core-wrap">
            ${coreRing()}
            <div class="core-c"><span>集群利用率</span><b id="core-util">—</b><small id="core-online">—</small></div>
          </div>
          <div class="core-stats">
            <div><span>${icon('zap')}功耗</span><b id="core-power">—</b></div>
            <div><span>${icon('thermo')}平均温度</span><b id="core-temp">—</b></div>
            <div><span>${icon('memory')}显存</span><b id="core-mem">—</b></div>
          </div>
          <div class="core-key"><span><i class="ramp cyan"></i>外环 · 算力利用率</span><span><i class="ramp violet"></i>内环 · 显存</span></div>
        </section>

        <div class="c-3">${stat({ label: '今日请求', value: '—', id: 'st-req', delta: '8.4%', good: true, sub: '较昨日同时段', spark: sparkline(dayTotals, { w: 260, h: 38, color: SERIES[0] }), icon: 'usage' })}</div>
        <div class="c-3">${stat({ label: '今日 Token', value: '—', id: 'st-tok', delta: '12.1%', good: true, sub: '输入 + 输出', spark: sparkline(tokens14, { w: 260, h: 38, color: SERIES[2] }), icon: 'tokens' })}</div>
        <div class="c-3">${stat({ label: '今日费用', value: '—', id: 'st-cost', delta: '3.2%', good: false, up: true, sub: `本月预算剩余 ${fmt.cnyCompact(state.budget - MTD_COST)}`, spark: sparkline(cost14, { w: 260, h: 38, color: SERIES[1] }), icon: 'yuan' })}</div>
        <div class="c-3">${stat({ label: '训练中任务', value: String(running.length), id: 'st-jobs', sub: `占用 ${running.reduce((a, j) => a + j.gpus, 0)} 张 GPU · ${state.jobs.filter((j) => j.status === 'queued').length} 个排队`, spark: `<div class="st-bars">${state.jobs.slice(0, 6).map((j) => `<i class="${j.status}" style="--h:${Math.max(0.12, j.progress)}"></i>`).join('')}</div>`, icon: 'training' })}</div>

        ${panel({
          title: '训练任务', meta: '进度、损失与资源', cls: 'c-7 jobs-mini', id: 'ov-jobs',
          tools: `<a class="btn xs ghost" href="#/jobs">全部任务${icon('right')}</a>`,
          body: '<div class="jm-list" id="jm-list"></div>',
        })}
        ${panel({
          title: '模型性能', meta: '近 1 小时 · 网关实测', cls: 'c-5 t-6', id: 'ov-perf',
          tools: seg('perf-sort', [{ value: 'calls', label: '调用量' }, { value: 'ttft', label: '首字延迟' }, { value: 'tps', label: '吞吐' }], 'calls', { small: true, label: '排序' }),
          body: '<div class="perf" id="perf"></div>',
        })}

        ${panel({
          title: '智能路由拓扑', meta: '按延迟、成本与健康度动态分流', cls: 'c-8 topo-panel',
          tools: `<span class="p-legend"><i class="dot good"></i>健康<i class="dot warn"></i>降级</span>`,
          body: `<div class="topo-wrap" id="topo">${topology()}</div>`,
        })}
        ${panel({
          title: 'Token 构成', meta: '今日 · 按模型', cls: 'c-4 t-6',
          body: '<div id="mix-donut"></div><div id="mix-legend"></div>',
        })}

        ${panel({
          title: '实时请求流', meta: '采样 · 悬停暂停滚动', cls: 'c-7 feed-panel',
          tools: `<a class="btn xs ghost" href="#/usage">调用明细${icon('right')}</a>`,
          body: `<div class="feed" id="feed" role="log" aria-live="off"><div class="feed-h"><span>时间</span><span>模型</span><span>密钥</span><span>状态</span><span class="num">延迟</span><span class="num">Tokens</span></div><div id="feed-rows"></div></div>`,
        })}
        ${panel({
          title: '事件与告警', meta: '最近 7 天', cls: 'c-5',
          tools: `<button class="btn xs ghost" type="button" id="ev-all">全部${icon('right')}</button>`,
          body: '<ol class="events" id="events"></ol>',
        })}

        ${panel({
          title: '近 30 天费用', meta: '按服务堆叠 · 日维度', cls: 'c-12',
          tools: `<a class="btn xs ghost" href="#/billing">费用分析${icon('right')}</a>`,
          body: `<div id="cost-legend"></div><div id="cost-chart"></div>`,
        })}
      </div>`;

    // hero chart -------------------------------------------------------------------------------
    let range = 'live';
    const heroHost = $('#hero-chart', view);
    const liveOpts = () => ({
      x: live.hist.map((p) => p.t),
      series: [{ name: '请求 / 秒', color: SERIES[0], values: live.hist.map((p) => p.v) }],
      xFmt: (t) => fmt.time(t), tipX: (t) => fmt.time(t), yFmt: (v) => fmt.compact(v), tipFmt: (v) => `${fmt.int(v)} req/s`,
      stream: true, yMin: 0, height: 236, xTicks: 6,
    });
    const histOpts = (hours) => {
      const h = trafficHistory(hours, hours);
      return {
        x: h.map((p) => p.t), series: [{ name: '请求数 / 小时', color: SERIES[0], values: h.map((p) => p.v) }],
        xFmt: (t) => (hours > 24 ? fmt.date(t) : fmt.time(t, false)), tipX: (t) => `${fmt.date(t)} ${fmt.time(t, false)}`,
        yFmt: (v) => fmt.compact(v), tipFmt: (v) => `${fmt.int(v)} 次`, stream: false, yMin: 0, height: 236, xTicks: hours > 24 ? 7 : 6,
      };
    };
    const hero = lineChart(heroHost, { ...liveOpts(), label: '网关实时吞吐折线图' });
    ctx.keep(hero.destroy);
    bindSeg(view, 'hero-range', (v) => {
      range = v;
      hero.update(v === 'live' ? liveOpts() : histOpts(v === '24h' ? 24 : 168));
    });

    // core ring --------------------------------------------------------------------------------
    const coreWrap = $('#core-wrap', view);
    paintCore(coreWrap);
    coreWrap.addEventListener('pointermove', (e) => {
      const p = e.target.closest('.cg, .cm');
      if (!p) { hideTip(); return; }
      const g = GPUS[+p.dataset.g];
      const pool = POOLS.find((x) => x.id === g.pool);
      const st = g.status === 'crit' ? pill('crit', 'ECC 故障 · 已隔离') : g.status === 'warn' ? pill('warn', '温度偏高') : pill('good', '正常');
      showTip(`<div class="th">${g.node} · GPU ${g.slot}</div>
        ${tipRow(rampAt('cyan', 0.85), '利用率', fmt.pct(g.util, 0))}${tipRow(rampAt('violet', 0.8), '显存', `${fmt.pct(g.mem * 100, 0)} / ${pool.mem} GB`)}
        ${tipRow(STATUS.serious, '温度', `${g.temp.toFixed(0)} °C`)}${tipRow(SERIES[5], '功耗', `${Math.round(g.power)} W`)}<div class="tf">${st}<span>${pool.gpu}</span></div>`, e.clientX, e.clientY);
    });
    coreWrap.addEventListener('pointerleave', hideTip);
    coreWrap.addEventListener('click', (e) => {
      const p = e.target.closest('.cg, .cm');
      if (p) ctx.navigate(`cluster/${GPUS[+p.dataset.g].node}`);
    });

    // jobs mini list -----------------------------------------------------------------------------
    const jmList = $('#jm-list', view);
    const drawJobs = () => {
      const list = state.jobs.filter((j) => j.status === 'running' || j.status === 'paused').concat(state.jobs.filter((j) => j.status === 'completed')).slice(0, 4);
      jmList.innerHTML = list.map((j) => {
        const base = BASE_MODELS.find((b) => b.id === j.base);
        return `<a class="jm" href="#/jobs/${j.id}" data-job="${j.id}">
          <span class="jm-key" style="background:${SERIES[(j.color - 1) % 8]}"></span>
          <div class="jm-main"><div class="jm-t"><b>${esc(j.name)}</b>${jobPill(j)}</div>
            <div class="jm-s">${esc(base?.name || j.base)} · ${esc(j.method)} · ${j.gpus} × GPU</div>
            <div class="jm-p">${progress(j.progress, j.status)}<span class="jm-pct">${fmt.pct(j.progress * 100, 1)}</span></div></div>
          <div class="jm-side"><div class="jm-loss">${sparkline(j.loss.slice(-60), { w: 112, h: 34, color: SERIES[(j.color - 1) % 8], area: false })}</div>
            <span class="jm-eta">${j.status === 'running' ? `剩余 ${fmt.dur(j.eta)}` : j.status === 'completed' ? '已完成' : '已暂停'}</span><span class="jm-l">loss ${j.loss.length ? j.loss[j.loss.length - 1].toFixed(3) : '—'}</span></div>
        </a>`;
      }).join('');
    };
    drawJobs();
    ctx.keep(bus.on('jobs', drawJobs));

    // model performance ----------------------------------------------------------------------------
    const perf = $('#perf', view);
    const perfModels = MODELS.filter((m) => m.tps > 0).sort((a, b) => b.calls - a.calls).slice(0, 6);
    let perfSort = 'calls';
    const drawPerf = () => {
      const rows = [...perfModels].sort((a, b) => perfSort === 'ttft' ? a.ttft - b.ttft : b[perfSort] - a[perfSort]);
      const maxT = Math.max(...rows.map((m) => m.ttft)), maxS = Math.max(...rows.map((m) => m.tps));
      perf.innerHTML = `<div class="pf-h"><span>模型</span><span>首字延迟</span><span>输出速度</span><span class="num">成功率</span></div>` + rows.map((m) => `
        <a class="pf-r" href="#/models/${m.id}">
          <span class="pf-m">${sigil(m, 26)}<b>${esc(m.name)}</b></span>
          <span class="pf-b"><i style="width:${(m.ttft / maxT) * 100}%;background:${SERIES[0]}"></i><em>${fmt.ms(m.ttft)}</em></span>
          <span class="pf-b"><i style="width:${(m.tps / maxS) * 100}%;background:${SERIES[2]}"></i><em>${m.tps} t/s</em></span>
          <span class="num">${m.uptime.toFixed(2)}%</span>
        </a>`).join('');
    };
    drawPerf();
    bindSeg(view, 'perf-sort', (v) => { perfSort = v; drawPerf(); });

    // topology hover -----------------------------------------------------------------------------------
    const topo = $('#topo', view);
    topo.addEventListener('pointermove', (e) => {
      const n = e.target.closest('.tp-node');
      topo.querySelectorAll('.tp-out').forEach((p) => p.classList.remove('hl'));
      if (!n) { hideTip(); return; }
      const i = +n.dataset.i;
      if (n.dataset.tipK === 'up') {
        const u = ROUTES_UPSTREAM[i];
        topo.querySelector(`.tp-out[data-u="${i}"]`)?.classList.add('hl');
        showTip(`<div class="th">${u.name}</div>${tipRow(SERIES[0], '流量占比', fmt.pct(u.share * 100, 0))}${tipRow(SERIES[2], '平均延迟', fmt.ms(u.latency))}<div class="tf">${u.health === 'ok' ? pill('good', '健康') : pill('warn', '降级 · 已降低权重')}<span>${u.kind === 'self' ? '自有集群' : '外部上游'}</span></div>`, e.clientX, e.clientY);
      } else {
        const r = REGIONS[i];
        showTip(`<div class="th">${r.name}</div>${tipRow(SERIES[0], '请求占比', fmt.pct(r.share * 100, 0))}${tipRow(SERIES[1], '当前', `${fmt.int(live.rps * r.share)} req/s`)}`, e.clientX, e.clientY);
      }
    });
    topo.addEventListener('pointerleave', () => { hideTip(); topo.querySelectorAll('.tp-out').forEach((p) => p.classList.remove('hl')); });

    // token mix donut ------------------------------------------------------------------------------------
    const mixModels = MODELS.filter((m) => m.pin > 0).map((m) => ({ m, v: m.calls * (m.cat === 'embed' ? 0.4 : 1.2) * (m.ctx > 300000 ? 1.6 : 1) })).sort((a, b) => b.v - a.v);
    const top = mixModels.slice(0, 5);
    const restV = mixModels.slice(5).reduce((a, x) => a + x.v, 0);
    const totalV = mixModels.reduce((a, x) => a + x.v, 0);
    const scale = (live.totals.tokensToday || 1) / totalV;
    const segs = top.map((x, i) => ({ name: x.m.name, value: x.v * scale, color: SERIES[i] })).concat([{ name: '其他', value: restV * scale, color: '#5d6a80' }]);
    const dn = donut($('#mix-donut', view), { segments: segs, fmt: (v) => fmt.compact(v), centerLabel: '今日 Token', centerSub: '悬停查看占比', size: 196, thickness: 18 });
    ctx.keep(dn.destroy);
    $('#mix-legend', view).innerHTML = `<div class="mix-l">${segs.map((s, i) => `<button type="button" class="ml" data-i="${i}"><span class="key" style="background:${s.color}"></span><span class="ml-n">${esc(s.name)}</span><b>${fmt.pct((s.value / (totalV * scale)) * 100, 1)}</b></button>`).join('')}</div>`;
    $('#mix-legend', view).addEventListener('pointerover', (e) => { const b = e.target.closest('.ml'); if (b) dn.focus(+b.dataset.i); });
    $('#mix-legend', view).addEventListener('pointerleave', () => dn.focus(-1));

    // live feed ---------------------------------------------------------------------------------------------
    const feedRows = $('#feed-rows', view);
    let feedHold = false;
    $('#feed', view).addEventListener('pointerenter', () => { feedHold = true; });
    $('#feed', view).addEventListener('pointerleave', () => { feedHold = false; });
    const statusPill = (s) => s === 200 ? `<span class="sc ok">200</span>` : s === 429 ? `<span class="sc warn">429</span>` : `<span class="sc crit">${s}</span>`;
    const feedRow = (r, fresh) => `<div class="fr${fresh ? ' fresh' : ''}"><span class="mono">${fmt.time(r.t)}</span><span class="fr-m">${esc(r.model.name)}</span><span class="fr-k">${esc(r.key.name.split(' · ')[1] || r.key.name)}</span><span>${statusPill(r.status)}</span><span class="num">${fmt.ms(r.latency)}</span><span class="num">${fmt.compact(r.tin + r.tout)}</span></div>`;
    let lastFeedId = null;
    const drawFeed = (fresh) => {
      const rows = live.feed.slice(0, 8);
      feedRows.innerHTML = rows.map((r) => feedRow(r, fresh && lastFeedId && r.id > lastFeedId)).join('');
      lastFeedId = rows[0]?.id;
    };
    if (!live.feed.length) for (let i = 0; i < 4; i++) live.step();
    drawFeed(false);

    // events -----------------------------------------------------------------------------------------------
    const drawEvents = () => {
      $('#events', view).innerHTML = state.notifications.slice(0, 5).map((n) => `<li class="ev l-${n.level}"><a href="#/${n.link || 'overview'}"><span class="ev-ic">${icon(LVL_ICON[n.level])}</span><span class="ev-b"><b>${esc(n.title)}</b><span>${esc(n.body)}</span></span><time>${fmt.rel(n.at)}</time></a></li>`).join('');
    };
    drawEvents();
    ctx.keep(bus.on('notifications', drawEvents));
    $('#ev-all', view).addEventListener('click', openNotifications);

    // cost chart -------------------------------------------------------------------------------------------------
    const costSeries = [['infer', '推理 API'], ['train', '训练算力'], ['store', '存储与数据'], ['net', '网络与专线']].map(([k, n], i) => ({ name: n, color: SERIES[i], values: DAILY_COST.map((d) => d[k]) }));
    $('#cost-legend', view).innerHTML = legend(costSeries.map((s) => ({ name: s.name, color: s.color, value: fmt.cnyCompact(s.values.reduce((a, b) => a + b, 0)) })));
    const cost = barChart($('#cost-chart', view), {
      labels: DAILY_COST.map((d) => d.t), series: costSeries, height: 200, xFmt: (t) => fmt.date(t), tipX: (t) => fmt.date(t, true),
      yFmt: (v) => fmt.cnyCompact(v), tipFmt: (v) => fmt.cny(v), label: '近 30 天费用堆叠柱状图', onPick: () => ctx.navigate('billing'),
    });
    ctx.keep(cost.destroy);

    // live updates -----------------------------------------------------------------------------------------------
    const prevHour = live.hist[0]?.v || 1;
    const tick = () => {
      tweenNumber($('#hero-rps', view), live.rps, (v) => fmt.int(v), 600);
      const ch = ((live.rps - prevHour) / prevHour) * 100;
      const d = $('#hero-delta', view);
      d.className = `delta ${ch >= 0 ? 'up' : 'down'}`;
      d.innerHTML = `${icon(ch >= 0 ? 'up' : 'downRight')}<span>${Math.abs(ch).toFixed(1)}% 较 90 秒前</span>`;
      $('#hc-ok', view).textContent = fmt.pct(live.success, 2);
      $('#hc-p95', view).textContent = fmt.ms(live.p95);
      $('#hc-tok', view).textContent = fmt.compact(live.tokS);
      if (range === 'live') hero.update(liveOpts(), { shifted: true });
      paintCore(coreWrap);
      $('#core-util', view).textContent = fmt.pct(live.gpu.util, 1);
      $('#core-online', view).textContent = `${live.gpu.online} / ${live.gpu.total} 在线`;
      $('#core-power', view).textContent = `${live.gpu.power.toFixed(1)} kW`;
      $('#core-temp', view).textContent = `${live.gpu.temp.toFixed(1)} °C`;
      $('#core-mem', view).textContent = fmt.pct(live.gpu.mem * 100, 0);
      tweenNumber($('#st-req [data-stat]', view), live.totals.requestsToday, (v) => fmt.compact(v, 2));
      tweenNumber($('#st-tok [data-stat]', view), live.totals.tokensToday, (v) => fmt.compact(v, 2));
      tweenNumber($('#st-cost [data-stat]', view), live.totals.costToday, (v) => fmt.cny(v));
      $('#st-jobs [data-stat]', view).textContent = state.jobs.filter((j) => j.status === 'running').length;
      $('#tp-rps', view).textContent = `${fmt.int(live.rps)} rps`;
      if (!feedHold) drawFeed(true);
      // refresh job rows in place (progress and eta) without rebuilding the list
      jmList.querySelectorAll('.jm').forEach((a) => {
        const j = state.jobs.find((x) => x.id === a.dataset.job);
        if (!j) return;
        a.querySelector('.bar i').style.width = `${(j.progress * 100).toFixed(2)}%`;
        a.querySelector('.jm-pct').textContent = fmt.pct(j.progress * 100, 1);
        if (j.status === 'running') a.querySelector('.jm-eta').textContent = `剩余 ${fmt.dur(j.eta)}`;
        if (j.loss.length) a.querySelector('.jm-l').textContent = `loss ${j.loss[j.loss.length - 1].toFixed(3)}`;
      });
    };
    tick();
    ctx.keep(live.on(tick));
  },
};
