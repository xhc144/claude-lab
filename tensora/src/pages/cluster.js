// GPU 集群 · pool tabs, a metric-switchable heat grid of every GPU, a node drawer (per-GPU table,
// history, NVLink topology, drain / reboot / isolate), the scheduling queue and allocation.

import { pageHead, panel, seg, bindSeg, stat, pill, tabs, bindTabs, empty } from '../ui/kit.js';
import { lineChart, hbars, sparkline, legend, SERIES, rampAt, STATUS, showTip, hideTip, tipRow } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { openLayer, confirmDialog, toast } from '../ui/overlay.js';
import { state, bus, pushNotification } from '../core/state.js';
import { live } from '../core/live.js';
import { NODES, POOLS, GPUS } from '../core/data.js';
import { fmt, esc, $ } from '../core/util.js';

const METRICS = {
  util: { label: '利用率', ramp: 'cyan', norm: (g) => g.util / 100, text: (g) => `${Math.round(g.util)}`, unit: '%', lo: '0%', hi: '100%' },
  temp: { label: '温度', ramp: 'amber', norm: (g) => (g.temp - 30) / 60, text: (g) => `${Math.round(g.temp)}`, unit: '°C', lo: '30 °C', hi: '90 °C' },
  mem: { label: '显存', ramp: 'violet', norm: (g) => g.mem, text: (g) => `${Math.round(g.mem * 100)}`, unit: '%', lo: '0%', hi: '100%' },
  power: { label: '功耗', ramp: 'amber', norm: (g) => g.power / 720, text: (g) => `${Math.round(g.power)}`, unit: 'W', lo: '0 W', hi: '700 W' },
};
const NODE_STATUS = { ok: ['good', '健康'], warn: ['warn', '温度告警'], crit: ['crit', '硬件故障'], drain: ['idle', '排空中'], reboot: ['info', '重启中'] };
const poolOf = (id) => POOLS.find((p) => p.id === id);

// rolling history per node for the drawer charts
const HIST = new Map();
function record(t = Date.now()) {
  for (const n of NODES) {
    const on = n.gpus.filter((g) => g.status !== 'crit');
    const h = HIST.get(n.id) || [];
    h.push({ t, util: on.reduce((a, g) => a + g.util, 0) / Math.max(1, on.length), temp: on.reduce((a, g) => a + g.temp, 0) / Math.max(1, on.length) });
    if (h.length > 90) h.shift();
    HIST.set(n.id, h);
  }
}

function gpuJob(g) {
  const running = state.jobs.filter((j) => j.status === 'running' && j.pool === g.pool);
  if (g.util < 30 || !running.length) return null;
  return running[(g.i + g.slot) % running.length];
}

export default {
  domain: 'compute',
  mount(view, ctx) {
    let pool = 'all', metric = 'util';
    if (!HIST.size) for (let i = 40; i > 0; i--) record(Date.now() - i * 1000);
    const utilHist = [];

    view.innerHTML = `
      ${pageHead({
        eyebrow: '算力 · 资源池',
        title: 'GPU 集群',
        sub: `${POOLS.length} 个资源池、${NODES.length} 台节点、${GPUS.length} 张 GPU。颜色表示所选指标，点击任意 GPU 查看节点详情。`,
        actions: `<button class="btn" type="button" id="c-queue">${icon('jobs')}调度队列</button><button class="btn primary" type="button" id="c-expand">${icon('plus')}申请扩容</button>`,
      })}
      <div class="grid" id="c-stats"></div>
      <section class="panel rv c-toolbar">
        ${tabs('c-pool', [{ id: 'all', label: '全部资源池', count: GPUS.length }, ...POOLS.map((p) => ({ id: p.id, label: p.name, count: p.nodes * 8 }))], 'all')}
        <div class="c-tools">${seg('c-metric', Object.entries(METRICS).map(([k, m]) => ({ value: k, label: m.label })), 'util', { small: true, label: '着色指标' })}
          <div class="heat-k" id="c-key"></div></div>
      </section>
      <div class="nodes" id="nodes"></div>
      <div class="grid">
        ${panel({ cls: 'c-6', title: '资源分配', meta: '按训练任务 · GPU 数', body: '<div id="c-alloc"></div>' })}
        ${panel({ cls: 'c-6', title: '调度队列', meta: '先进先出 · 支持抢占', id: 'queue-panel', body: '<div id="c-q"></div>' })}
      </div>`;

    const drawStats = () => {
      const g = live.gpu;
      const alerts = NODES.filter((n) => n.status !== 'ok').length;
      utilHist.push(g.util);
      if (utilHist.length > 40) utilHist.shift();
      $('#c-stats', view).innerHTML = [
        stat({ label: '在线 GPU', value: `${g.online}`, unit: `/ ${g.total}`, sub: `${GPUS.filter((x) => x.util < 30 && x.status === 'ok').length} 张空闲可调度`, icon: 'cluster' }),
        stat({ label: '平均利用率', value: fmt.pct(g.util, 1), sub: '近 40 秒', spark: sparkline(utilHist.length > 1 ? utilHist : [g.util, g.util], { w: 260, h: 38, color: SERIES[0] }), icon: 'gauge' }),
        stat({ label: '总功耗', value: `${g.power.toFixed(1)}`, unit: 'kW', sub: `平均温度 ${g.temp.toFixed(1)} °C · PUE 1.18`, icon: 'zap' }),
        stat({ label: '告警节点', value: String(alerts), sub: alerts ? NODES.filter((n) => n.status !== 'ok').map((n) => n.id).join('、') : '全部节点健康', icon: 'alert' }),
      ].map((s) => `<div class="c-3">${s}</div>`).join('');
    };

    const nodesEl = $('#nodes', view);
    const drawNodes = () => {
      const list = NODES.filter((n) => pool === 'all' || n.pool === pool);
      nodesEl.innerHTML = list.map((n) => {
        const p = poolOf(n.pool);
        const [kind, label] = NODE_STATUS[n.status] || NODE_STATUS.ok;
        return `<article class="node spot status-${n.status}" data-node="${n.id}">
          <header class="nd-h"><button type="button" class="nd-name" data-open="${n.id}"><b class="mono">${n.id}</b><span>${esc(p.short)} · ${esc(p.gpu)}</span></button>${pill(kind, label)}</header>
          <div class="nd-gpus">${n.gpus.map((g) => `<button type="button" class="gc${g.status !== 'ok' ? ' g-' + g.status : ''}" data-g="${g.i}" aria-label="${n.id} GPU ${g.slot}"><span class="gc-s">${g.slot}</span><b></b>${g.status === 'crit' ? icon('fail') : g.status === 'warn' ? icon('thermo') : ''}</button>`).join('')}</div>
          <footer class="nd-f"><span>${icon('cluster')}CPU <b data-cpu>${Math.round(n.cpu)}%</b></span><span>${icon('memory')}内存 <b>${Math.round(n.ram * 100)}%</b></span><span>${icon('radio')}<b data-net>${Math.round(n.net)}</b> Gb/s</span></footer>
        </article>`;
      }).join('') || empty('没有节点', '这个资源池暂时没有节点。', 'server');
      paint();
    };
    const paint = () => {
      const m = METRICS[metric];
      nodesEl.querySelectorAll('.gc').forEach((c) => {
        const g = GPUS[+c.dataset.g];
        const off = g.status === 'crit';
        c.style.setProperty('--c', off ? '#1a0f14' : rampAt(m.ramp, 0.06 + Math.max(0, Math.min(1, m.norm(g))) * 0.84));
        c.style.setProperty('--tc', m.norm(g) > 0.62 && !off ? '#04101a' : '#e8eefb');
        c.querySelector('b').textContent = off ? 'ECC' : g.drain && g.util < 2 ? '—' : m.text(g);
      });
      $('#c-key', view).innerHTML = `<span>${m.lo}</span><i class="ramp ${m.ramp}"></i><span>${m.hi}</span>`;
    };
    drawStats();
    drawNodes();

    bindTabs(view, 'c-pool', (id) => { pool = id; drawNodes(); });
    bindSeg(view, 'c-metric', (v) => { metric = v; paint(); });

    nodesEl.addEventListener('pointermove', (e) => {
      const c = e.target.closest('.gc');
      if (!c) { hideTip(); return; }
      const g = GPUS[+c.dataset.g];
      const p = poolOf(g.pool);
      const job = gpuJob(g);
      const st = g.status === 'crit' ? pill('crit', `ECC 错误 ${g.ecc} 次 · 已隔离`) : g.status === 'warn' ? pill('warn', '温度偏高') : g.drain ? pill('idle', '排空中') : g.util < 30 ? pill('idle', '空闲') : pill('good', '运行中');
      showTip(`<div class="th">${g.node} · GPU ${g.slot} · ${p.gpu}</div>${tipRow(rampAt('cyan', 0.85), '利用率', fmt.pct(g.util, 0))}${tipRow(rampAt('violet', 0.8), '显存', `${Math.round(g.mem * p.mem)} / ${p.mem} GB`)}${tipRow(rampAt('amber', 0.8), '温度', `${g.temp.toFixed(1)} °C`)}${tipRow(SERIES[5], '功耗', `${Math.round(g.power)} W`)}<div class="tf">${st}<span>${job ? esc(job.name) : '无任务'}</span></div>`, e.clientX, e.clientY);
    });
    nodesEl.addEventListener('pointerleave', hideTip);
    nodesEl.addEventListener('click', (e) => {
      const c = e.target.closest('.gc, [data-open]');
      if (!c) return;
      const id = c.dataset.open || GPUS[+c.dataset.g].node;
      ctx.navigate(`cluster/${id}`);
    });

    // allocation + queue ------------------------------------------------------------------------------------
    const drawAlloc = () => {
      const running = state.jobs.filter((j) => j.status === 'running');
      const used = running.reduce((a, j) => a + j.gpus, 0);
      const rows = running.map((j) => ({ label: j.name, sub: `${poolOf(j.pool).short} · ${esc(j.owner)}`, value: j.gpus, color: SERIES[(j.color - 1) % 8], key: true }));
      rows.push({ label: '在线推理服务', sub: '网关自有上游', value: 40, color: SERIES[6], key: true });
      rows.push({ label: '空闲', sub: '可立即调度', value: Math.max(0, live.gpu.online - used - 40), color: '#5d6a80', key: true });
      $('#c-alloc', view).innerHTML = hbars(rows, { fmt: (v) => `${v} 张`, max: Math.max(...rows.map((r) => r.value)) });
    };
    const drawQueue = () => {
      const q = state.jobs.filter((j) => j.status === 'queued');
      $('#c-q', view).innerHTML = q.length ? `<ol class="queue">${q.map((j, i) => `<li><span class="qn">${i + 1}</span><div><b>${esc(j.name)}</b><span>${j.gpus} × ${esc(poolOf(j.pool).gpu)} · ${esc(j.owner)} · 预计等待 ${fmt.dur(1800 + i * 2400)}</span></div><button type="button" class="btn xs" data-boost="${j.id}">${icon('zap')}提升优先级</button></li>`).join('')}</ol>`
        : empty('队列为空', '所有提交的任务都已开始运行。', 'jobs');
    };
    drawAlloc();
    drawQueue();
    $('#c-q', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-boost]');
      if (!b) return;
      const j = state.jobs.find((x) => x.id === b.dataset.boost);
      b.disabled = true;
      b.innerHTML = `${icon('check')}已提升`;
      toast({ kind: 'good', title: `「${j.name}」已提升为高优先`, body: '将抢占 2 个抢占式任务的资源，费用 ×1.3' });
    });
    ctx.keep(bus.on('jobs', () => { drawAlloc(); drawQueue(); }));
    $('#c-queue', view).addEventListener('click', () => $('#queue-panel', view).scrollIntoView({ behavior: 'smooth', block: 'center' }));
    $('#c-expand', view).addEventListener('click', expand);

    ctx.keep(live.on(() => {
      record();
      paint();
      drawStats();
      nodesEl.querySelectorAll('.node').forEach((el) => {
        const n = NODES.find((x) => x.id === el.dataset.node);
        n.cpu = Math.max(8, Math.min(96, n.cpu + (Math.random() - 0.5) * 4));
        n.net = Math.max(10, n.net + (Math.random() - 0.5) * 30);
        el.querySelector('[data-cpu]').textContent = `${Math.round(n.cpu)}%`;
        el.querySelector('[data-net]').textContent = Math.round(n.net);
      });
    }));

    let layer = null;
    this._open = (params) => {
      layer?.close();
      layer = null;
      const n = params[0] && NODES.find((x) => x.id === params[0]);
      if (n) layer = nodeDrawer(n, ctx, () => drawNodes());
    };
    ctx.keep(() => layer?.close());
    this._open(ctx.params);
  },
  update(params) { this._open(params); },
};

function nodeDrawer(n, ctx, redraw) {
  const p = poolOf(n.pool);
  let chart = null;
  const [kind, label] = NODE_STATUS[n.status] || NODE_STATUS.ok;
  const topo = () => {
    const c = 110, R = 82;
    const pts = n.gpus.map((g, i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; return { g, x: c + R * Math.cos(a), y: c + R * Math.sin(a) }; });
    return `<svg class="nvl" viewBox="0 0 220 220" role="img" aria-label="NVLink 拓扑：8 张 GPU 通过 NVSwitch 全互联">
      ${pts.map((q) => `<line x1="${c}" y1="${c}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" class="${q.g.status === 'crit' ? 'down' : ''}"/>`).join('')}
      <rect x="${c - 26}" y="${c - 16}" width="52" height="32" rx="8" class="sw"/><text x="${c}" y="${c + 4}" text-anchor="middle">NVSwitch</text>
      ${pts.map((q) => `<g class="gn ${q.g.status}"><circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="15" style="fill:${q.g.status === 'crit' ? '#2a0d12' : rampAt('cyan', 0.1 + (q.g.util / 100) * 0.85)}"/><text x="${q.x.toFixed(1)}" y="${(q.y + 4).toFixed(1)}" text-anchor="middle">${q.g.slot}</text></g>`).join('')}
    </svg>`;
  };
  const rows = () => n.gpus.map((g) => {
    const job = gpuJob(g);
    const st = g.status === 'crit' ? pill('crit', '已隔离') : g.status === 'warn' ? pill('warn', '过热') : g.drain ? pill('idle', '排空') : g.util < 30 ? pill('idle', '空闲') : pill('good', '运行');
    return `<tr><td class="mono">GPU ${g.slot}</td><td>${st}</td><td class="num">${g.status === 'crit' ? '—' : fmt.pct(g.util, 0)}</td><td class="num">${g.status === 'crit' ? '—' : `${Math.round(g.mem * p.mem)} GB`}</td><td class="num">${g.temp.toFixed(0)} °C</td><td class="num">${Math.round(g.power)} W</td><td class="num">${g.ecc}</td><td class="muted">${job ? esc(job.name) : '—'}</td>
      <td class="num">${g.status === 'crit' ? `<button type="button" class="btn xs" data-fix="${g.i}">${icon('refresh')}更换后恢复</button>` : ''}</td></tr>`;
  }).join('');
  return openLayer({
    kind: 'drawer', wide: true, eyebrow: `${esc(p.name)} · ${esc(p.gpu)}`, title: `<span class="mono">${n.id}</span>`,
    onClose: () => { if (location.hash.startsWith(`#/cluster/${n.id}`)) ctx.replace('cluster'); },
    body: `<div class="kd-head">${pill(kind, label)}<span class="tag">8 × ${esc(p.gpu)}</span><span class="tag">2 × 96 核 CPU · 2 TB 内存</span><span class="tag">8 × 400G InfiniBand</span></div>
      <div class="kd-kpis"><div><span>平均利用率</span><b id="nd-u">—</b></div><div><span>平均温度</span><b id="nd-t">—</b></div><div><span>功耗</span><b id="nd-p">—</b></div><div><span>已运行</span><b>${fmt.dur(n.uptime / 1000)}</b></div></div>
      <div class="nd-two">
        <div><h3 class="md-h">近 90 秒</h3>${legend([{ name: '平均利用率 %', color: SERIES[0] }, { name: '平均温度 °C', color: SERIES[1] }])}<div id="nd-chart"></div></div>
        <div><h3 class="md-h">NVLink 拓扑</h3><div class="nvl-wrap" id="nd-topo">${topo()}</div></div>
      </div>
      <h3 class="md-h">GPU 明细</h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>设备</th><th>状态</th><th class="num">利用率</th><th class="num">显存</th><th class="num">温度</th><th class="num">功耗</th><th class="num">ECC</th><th>任务</th><th></th></tr></thead><tbody id="nd-rows">${rows()}</tbody></table></div>
      <h3 class="md-h">远程访问</h3><div class="copyline"><code>ssh ops@${n.id}.infra.tensora.example</code><button type="button" class="btn xs ghost" data-copy="ssh ops@${n.id}.infra.tensora.example">${icon('copy')}复制</button></div>`,
    foot: `<button class="btn" type="button" data-act="drain">${icon('drain')}<span>${n.gpus.some((g) => g.drain) ? '恢复调度' : '排空节点'}</span></button><button class="btn danger" type="button" data-act="reboot">${icon('power')}重启节点</button>`,
    onMount(panel, close) {
      const h = () => HIST.get(n.id) || [];
      chart = lineChart(panel.querySelector('#nd-chart'), {
        x: h().map((x) => x.t), series: [{ name: '平均利用率 %', color: SERIES[0], values: h().map((x) => x.util) }, { name: '平均温度 °C', color: SERIES[1], values: h().map((x) => x.temp), area: false }],
        height: 190, xFmt: (t) => fmt.time(t), yFmt: (v) => Math.round(v), tipFmt: (v, s) => (s.name.includes('温度') ? `${v.toFixed(1)} °C` : `${v.toFixed(1)}%`), stream: true, xTicks: 3, yMin: 0,
      });
      const refresh = () => {
        const on = n.gpus.filter((g) => g.status !== 'crit');
        panel.querySelector('#nd-u').textContent = fmt.pct(on.reduce((a, g) => a + g.util, 0) / Math.max(1, on.length), 1);
        panel.querySelector('#nd-t').textContent = `${(on.reduce((a, g) => a + g.temp, 0) / Math.max(1, on.length)).toFixed(1)} °C`;
        panel.querySelector('#nd-p').textContent = `${(n.gpus.reduce((a, g) => a + g.power, 0) / 1000).toFixed(2)} kW`;
        panel.querySelector('#nd-rows').innerHTML = rows();
        panel.querySelector('#nd-topo').innerHTML = topo();
      };
      refresh();
      const off = live.on(() => {
        refresh();
        chart.update({ x: h().map((x) => x.t), series: [{ name: '平均利用率 %', color: SERIES[0], values: h().map((x) => x.util) }, { name: '平均温度 °C', color: SERIES[1], values: h().map((x) => x.temp), area: false }] }, { shifted: true });
      });
      panel.addEventListener('click', async (e) => {
        const fix = e.target.closest('[data-fix]');
        if (fix) {
          const g = GPUS[+fix.dataset.fix];
          if (!(await confirmDialog({ title: `恢复 GPU ${g.slot}`, body: '请确认机房已完成硬件更换。恢复后该 GPU 会重新加入调度池，并先运行 5 分钟压力自检。', confirmLabel: '恢复调度' }))) return;
          g.status = 'ok'; g.ecc = 0; g.util = 8; g.mem = 0.05; g.temp = 36;
          if (!n.gpus.some((x) => x.status !== 'ok')) n.status = 'ok';
          refresh();
          redraw();
          toast({ kind: 'good', title: `${n.id} · GPU ${g.slot} 已恢复调度`, body: '自检通过后将接收新任务' });
          state.notifications.filter((x) => x.link === `cluster/${n.id}`).forEach((x) => { x.read = true; });
          bus.emit('notifications');
          return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'drain') {
          const draining = n.gpus.some((g) => g.drain);
          if (!draining && !(await confirmDialog({ title: `排空 ${n.id}？`, body: '节点将停止接收新任务，运行中的任务会在下一个检查点后迁移到其他节点。适合在维护前使用。', confirmLabel: '排空节点' }))) return;
          n.gpus.forEach((g) => { g.drain = !draining; if (draining) g.util = Math.max(g.util, 40); });
          n.status = draining ? (n.gpus.some((g) => g.status === 'crit') ? 'crit' : n.gpus.some((g) => g.status === 'warn') ? 'warn' : 'ok') : 'drain';
          e.target.closest('[data-act]').querySelector('span').textContent = draining ? '排空节点' : '恢复调度';
          redraw();
          toast({ kind: draining ? 'good' : 'info', title: draining ? `${n.id} 已恢复调度` : `${n.id} 正在排空`, body: draining ? '节点重新接收任务' : '任务迁移完成后节点将空闲' });
        } else if (act === 'reboot') {
          if (!(await confirmDialog({ title: `重启 ${n.id}`, body: `节点上运行的任务会被中断并从最近的检查点恢复，约需 4 分钟。输入节点名以确认。`, confirmLabel: '重启', danger: true, requireText: n.id }))) return;
          const prev = n.status;
          n.status = 'reboot';
          n.gpus.forEach((g) => { g.drain = true; });
          redraw();
          close();
          toast({ kind: 'info', title: `${n.id} 正在重启`, body: '演示中约 6 秒后恢复' });
          setTimeout(() => {
            n.gpus.forEach((g) => { g.drain = false; if (g.status !== 'crit') g.util = 50; });
            n.status = prev === 'drain' || prev === 'reboot' ? 'ok' : prev;
            redraw();
            pushNotification({ level: 'good', title: '节点重启完成', body: `${n.id} 已重新上线，所有 GPU 自检通过。`, link: `cluster/${n.id}` });
            toast({ kind: 'good', title: `${n.id} 已重新上线` });
          }, 6000);
        }
      });
      return () => { off(); chart?.destroy(); };
    },
  });
}

function expand() {
  openLayer({
    kind: 'modal', title: '申请扩容', eyebrow: '算力 · 资源池',
    body: `<form class="form" id="ex-form">
      <div class="row2">
        <div class="field"><label class="field-l" for="ex-type">GPU 型号</label><select class="select" id="ex-type"><option>H200 141GB</option><option>H100 80GB SXM</option><option>L40S 48GB</option></select></div>
        <div class="field"><label class="field-l" for="ex-pool">目标资源池</label><select class="select" id="ex-pool">${POOLS.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><span class="field-l">数量</span>${seg('ex-n', [8, 16, 32, 64].map((v) => ({ value: String(v), label: `${v} 卡` })), '16')}</div>
      <div class="field"><span class="field-l">使用期限</span>${seg('ex-term', [{ value: 'm', label: '按月' }, { value: 'y', label: '1 年 (−25%)' }, { value: '3y', label: '3 年 (−42%)' }], 'y')}</div>
      <div class="field"><label class="field-l" for="ex-why">用途说明</label><textarea class="textarea" id="ex-why" rows="3" placeholder="例如：Q4 多语种翻译模型全参微调，预计持续 6 周"></textarea><span class="field-h" id="ex-why-h">至少 10 个字，便于容量规划团队评估</span></div>
    </form>`,
    foot: '<button class="btn ghost" type="button" data-x>取消</button><button class="btn primary" type="submit" form="ex-form">提交申请</button>',
    onMount(p, close) {
      let n = 16;
      bindSeg(p, 'ex-n', (v) => { n = +v; });
      bindSeg(p, 'ex-term', () => {});
      p.querySelector('[data-x]').addEventListener('click', () => close());
      p.querySelector('#ex-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const why = p.querySelector('#ex-why');
        if (why.value.trim().length < 10) { why.closest('.field').classList.add('err'); why.focus(); return; }
        const ticket = `OPS-${Math.floor(4000 + Math.random() * 999)}`;
        close();
        toast({ kind: 'good', title: '扩容申请已提交', body: `工单 ${ticket} · ${n} × ${p.querySelector('#ex-type').value}，容量团队会在 1 个工作日内回复` });
        pushNotification({ level: 'info', title: '扩容申请已提交', body: `工单 ${ticket}：${n} × ${p.querySelector('#ex-type').value}，等待容量团队审批。`, link: 'cluster' });
      });
      p.querySelector('#ex-why').addEventListener('input', (e) => e.target.closest('.field').classList.remove('err'));
    },
  });
}
