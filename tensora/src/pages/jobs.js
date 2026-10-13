// 训练任务 · job list with status filters and a live monitor for the selected job: progress, loss
// (train vs validation), learning-rate schedule, per-GPU utilisation, benchmarks, checkpoints and logs.

import { pageHead, pill, jobPill, progress, tabs, bindTabs, seg, bindSeg, empty } from '../ui/kit.js';
import { lineChart, barChart, sparkline, ring, legend, SERIES } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { openLayer, confirmDialog, toast } from '../ui/overlay.js';
import { state, bus, pushNotification } from '../core/state.js';
import { live } from '../core/live.js';
import { BASE_MODELS, DATASETS, POOLS } from '../core/data.js';
import { fmt, esc, $, rng, hash, debounce } from '../core/util.js';

const FILTERS = [
  { id: 'all', label: '全部' }, { id: 'running', label: '运行中' }, { id: 'queued', label: '排队' },
  { id: 'paused', label: '已暂停' }, { id: 'completed', label: '已完成' }, { id: 'failed', label: '失败' },
];
const BENCH = ['意图准确率', '回复相关性', '格式遵循', '安全性', '多轮一致性'];
const jobColor = (j) => SERIES[(j.color - 1) % 8];
const elapsed = (j) => (j.started ? ((j.finished || Date.now()) - j.started) / 1000 : 0);

function lrSchedule(j, n = 60) {
  const warm = Math.round(n * 0.06);
  return Array.from({ length: n }, (_, i) => (i < warm ? (j.lr * (i + 1)) / warm : j.lr * 0.5 * (1 + Math.cos((Math.PI * (i - warm)) / (n - warm)))));
}

function logLine(j, t, r) {
  const step = Math.round(j.progress * j.steps);
  const loss = j.loss.length ? j.loss[j.loss.length - 1] : 0;
  const pick = r();
  if (pick < 0.08) return { lvl: 'WARN', msg: `rank ${Math.floor(r() * j.gpus)}: NCCL all-reduce 耗时 ${(180 + r() * 90).toFixed(0)} ms，高于基线` };
  if (pick < 0.2) return { lvl: 'INFO', msg: `eval @ step ${step}: val_loss=${(loss * 1.05 + 0.04).toFixed(4)} accuracy=${(0.82 + r() * 0.1).toFixed(3)}` };
  if (pick < 0.26) return { lvl: 'INFO', msg: `checkpoint 已保存 → s3://tensora-ckpt/${j.id}/step-${step} (${(j.gpus * 1.9).toFixed(1)} GB)` };
  return { lvl: 'INFO', msg: `step ${step}/${j.steps} loss=${loss.toFixed(4)} lr=${j.lr.toExponential(1)} grad_norm=${(0.4 + r() * 0.5).toFixed(3)} tok/s=${fmt.int(j.gpus * (2600 + r() * 400))}` };
}

export default {
  domain: 'train',
  mount(view, ctx) {
    let filter = 'all', q = '';
    let sel = null;
    let charts = [];
    let lossChart = null;
    let logs = [], logLevel = 'all', logPaused = false;
    const r = rng(9);

    view.innerHTML = `
      ${pageHead({
        eyebrow: '训练平台 · 任务监控',
        title: '训练任务',
        sub: '实时查看损失曲线、资源利用率与检查点。运行中的任务会自动刷新。',
        actions: `<a class="btn primary" href="#/training">${icon('plus')}新建训练</a>`,
      })}
      <div class="jobs-layout">
        <aside class="panel rv jl">
          <div class="input-icon">${icon('search')}<input class="input" id="j-q" placeholder="搜索任务名称或 ID" aria-label="搜索任务"></div>
          <div class="jl-f" id="j-f">${FILTERS.map((f) => `<button type="button" class="chip${f.id === 'all' ? ' on' : ''}" data-f="${f.id}">${f.label}<em data-count="${f.id}"></em></button>`).join('')}</div>
          <div class="jl-list" id="j-list"></div>
        </aside>
        <section class="jd" id="jd"></section>
      </div>`;

    const list = $('#j-list', view);
    const drawList = () => {
      const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === 'all' ? state.jobs.length : state.jobs.filter((j) => j.status === f.id).length]));
      view.querySelectorAll('[data-count]').forEach((em) => { em.textContent = counts[em.dataset.count]; });
      const jobs = state.jobs.filter((j) => (filter === 'all' || j.status === filter) && (!q || (j.name + j.id).toLowerCase().includes(q)));
      list.innerHTML = jobs.length ? jobs.map((j) => `<a class="jli${sel && sel.id === j.id ? ' on' : ''}" href="#/jobs/${j.id}" data-id="${j.id}">
        <span class="jli-k" style="background:${jobColor(j)}"></span>
        <div class="jli-m"><div class="jli-t"><b>${esc(j.name)}</b>${jobPill(j)}</div>
          <span class="jli-s">${j.id} · ${j.gpus} GPU · ${esc(j.owner)}</span>
          <div class="jli-p">${progress(j.progress, j.status)}<span>${fmt.pct(j.progress * 100, 0)}</span></div></div></a>`).join('')
        : empty('没有任务', '换个筛选条件，或新建一个训练任务。', 'jobs');
    };

    const detail = $('#jd', view);
    function destroyCharts() { charts.forEach((c) => c.destroy()); charts = []; lossChart = null; }

    function drawDetail() {
      destroyCharts();
      const j = sel;
      if (!j) { detail.innerHTML = `<div class="panel">${empty('选择一个任务', '左侧列表中选择任务查看详情。', 'jobs')}</div>`; return; }
      const base = BASE_MODELS.find((b) => b.id === j.base);
      const ds = DATASETS.find((d) => d.id === j.dataset);
      const pool = POOLS.find((p) => p.id === j.pool);
      const canPause = j.status === 'running', canResume = j.status === 'paused', canStop = ['running', 'paused', 'queued'].includes(j.status);
      const rr = rng(hash(j.id));
      const benchBase = BENCH.map(() => 58 + rr() * 18);
      const benchFt = benchBase.map((v) => Math.min(98, v + 6 + rr() * 16 * Math.max(0.3, j.progress)));
      detail.innerHTML = `
        <section class="panel jd-head" style="--jc:${jobColor(j)}">
          <div class="jh-top">
            <div class="jh-t"><span class="eyebrow">${j.id} · ${esc(j.owner)}</span><h2>${esc(j.name)}</h2>
              <div class="jh-tags">${jobPill(j)}<span class="tag">${esc(base?.name || j.base)}</span><span class="tag">${esc(j.method)}</span><span class="tag">${esc(ds?.name || '自定义数据')}</span><span class="tag">${j.gpus} × ${esc(pool?.gpu || 'GPU')}</span></div></div>
            <div class="jh-act">
              ${canPause ? `<button class="btn sm" type="button" data-a="pause">${icon('pause')}暂停</button>` : ''}
              ${canResume ? `<button class="btn sm primary" type="button" data-a="resume">${icon('play')}恢复</button>` : ''}
              ${canStop ? `<button class="btn sm danger" type="button" data-a="stop">${icon('stop')}停止</button>` : ''}
              ${j.status === 'completed' ? `<button class="btn sm primary" type="button" data-a="deploy">${icon('rocket')}部署为端点</button>` : ''}
              ${j.status === 'failed' ? `<button class="btn sm primary" type="button" data-a="retry">${icon('refresh')}按建议重试</button>` : ''}
              <button class="btn sm" type="button" data-a="clone">${icon('clone')}克隆</button>
            </div>
          </div>
          ${j.status === 'failed' ? `<div class="callout crit">${icon('fail')}<div><b>任务在 step ${Math.round(j.progress * j.steps)} 失败</b><span class="mono">${esc(j.error)}</span><span>建议：开启梯度检查点，并把 micro-batch 从 4 降到 2，或者把序列长度降到 32K。</span></div></div>` : ''}
          <div class="jh-prog">
            <div class="jp-ring">${ring(j.progress, { size: 92, thickness: 7, color: jobColor(j), label: '训练进度' })}<b id="jd-pct">${fmt.pct(j.progress * 100, 1)}</b></div>
            <dl class="jp-stats">
              <div><dt>步数</dt><dd id="jd-step">${fmt.int(j.progress * j.steps)} / ${fmt.int(j.steps)}</dd></div>
              <div><dt>${j.status === 'running' ? '剩余时间' : '状态'}</dt><dd id="jd-eta">${j.status === 'running' ? fmt.dur(j.eta) : j.status === 'queued' ? '等待调度' : j.status === 'paused' ? '已暂停' : j.status === 'completed' ? '已完成' : '已终止'}</dd></div>
              <div><dt>已运行</dt><dd id="jd-el">${j.started ? fmt.dur(elapsed(j)) : '—'}</dd></div>
              <div><dt>当前损失</dt><dd id="jd-loss">${j.loss.length ? j.loss[j.loss.length - 1].toFixed(4) : '—'}</dd></div>
              <div><dt>已产生费用</dt><dd id="jd-cost">${fmt.cny(j.cost)}</dd></div>
              <div><dt>学习率</dt><dd>${j.lr.toExponential(0)}</dd></div>
            </dl>
          </div>
        </section>
        <div class="jd-grid">
          <section class="panel c-wide"><div class="p-head"><div class="p-title"><h2>损失曲线</h2><span class="p-meta">训练集每 ${Math.max(1, Math.round(j.steps / 120))} 步采样 · 验证集定期评估</span></div><div id="jd-loss-l"></div></div><div id="jd-loss-c"></div></section>
          <section class="panel"><div class="p-head"><div class="p-title"><h2>学习率调度</h2><span class="p-meta">线性预热 + 余弦退火</span></div></div><div id="jd-lr"></div></section>
          <section class="panel"><div class="p-head"><div class="p-title"><h2>GPU 利用率</h2><span class="p-meta">前 ${j.gpuUtil.length} 张卡 · 近 40 次采样</span></div></div><div class="gpu-mult" id="jd-gpus"></div></section>
          <section class="panel c-wide"><div class="p-head"><div class="p-title"><h2>评测基准</h2><span class="p-meta">${j.status === 'completed' ? '最终检查点' : '最近一次评估'} vs 基座模型</span></div></div>${legend([{ name: '基座模型', color: '#5d6a80' }, { name: '微调后', color: jobColor(j) }])}<div id="jd-bench"></div></section>
          <section class="panel c-wide">
            <div class="p-head">${tabs('jd-tabs', [{ id: 'ckpt', label: '检查点' }, { id: 'logs', label: '训练日志' }, { id: 'cfg', label: '配置' }], 'ckpt')}<div class="p-tools" id="jd-log-tools" hidden>${seg('log-lvl', [{ value: 'all', label: '全部' }, { value: 'WARN', label: '警告' }], 'all', { small: true })}<button class="btn xs" type="button" id="log-pause">${icon('pause')}暂停滚动</button></div></div>
            <div data-pane="ckpt">${ckptTable(j)}</div>
            <div data-pane="logs" hidden><div class="console" id="console" role="log"></div></div>
            <div data-pane="cfg" hidden><div class="code"><div class="code-h"><span>yaml</span><button type="button" class="btn xs ghost" data-copy>${icon('copy')}复制</button></div><pre><code>${esc(`job: ${j.id}\nbase_model: ${j.base}\nmethod: ${j.method}\ndataset: ${j.dataset}\ntrain:\n  steps: ${j.steps}\n  learning_rate: ${j.lr}\n  scheduler: cosine\n  warmup_ratio: 0.06\n  bf16: true\n  gradient_checkpointing: ${j.status === 'failed' ? 'false' : 'true'}\nresources:\n  pool: ${j.pool}\n  gpus: ${j.gpus}\n  priority: standard`)}</code></pre></div></div>
          </section>
        </div>`;

      // charts
      const lossX = j.loss.map((_, i) => i);
      const valSeries = j.loss.map(() => null);
      j.valIdx.forEach((idx, k) => { if (idx < valSeries.length) valSeries[idx] = j.val[k]; });
      $('#jd-loss-l', detail).innerHTML = legend([{ name: '训练损失', color: jobColor(j) }, { name: '验证损失', color: SERIES[1] === jobColor(j) ? SERIES[0] : SERIES[1], dash: true }]);
      if (j.loss.length > 1) {
        const valDense = interpolate(valSeries);
        charts.push(lossChart = lineChart($('#jd-loss-c', detail), {
          x: lossX, series: [{ name: '训练损失', color: jobColor(j), values: j.loss }, { name: '验证损失', color: SERIES[1] === jobColor(j) ? SERIES[0] : SERIES[1], values: valDense, dash: true, area: false }],
          height: 250, yMin: null, xFmt: (i) => `step ${fmt.compact(Math.round((i / Math.max(1, j.loss.length - 1)) * j.progress * j.steps))}`, tipX: (i) => `step ${fmt.int(Math.round((i / Math.max(1, j.loss.length - 1)) * j.progress * j.steps))}`,
          yFmt: (v) => v.toFixed(2), tipFmt: (v) => v.toFixed(4), xTicks: 5, label: '损失曲线',
        }));
      } else {
        $('#jd-loss-c', detail).innerHTML = empty(j.status === 'queued' ? '等待调度' : '正在加载权重', j.status === 'queued' ? '任务开始后这里会实时绘制损失曲线。' : '第一批损失值会在几秒后出现。', 'clock');
      }
      const lr = lrSchedule(j);
      charts.push(lineChart($('#jd-lr', detail), { x: lr.map((_, i) => i), series: [{ name: '学习率', color: SERIES[2], values: lr }], height: 170, xFmt: (i) => `${Math.round((i / (lr.length - 1)) * 100)}%`, tipX: (i) => `训练进度 ${Math.round((i / (lr.length - 1)) * 100)}%`, yFmt: (v) => v.toExponential(0), tipFmt: (v) => v.toExponential(2), xTicks: 5, glow: false, endDot: false, refLines: [], label: '学习率调度' }));
      drawGpus();
      charts.push(barChart($('#jd-bench', detail), {
        labels: BENCH, stacked: false, height: 210, yFmt: (v) => `${Math.round(v)}`, tipFmt: (v) => `${v.toFixed(1)} 分`,
        series: [{ name: '基座模型', color: '#5d6a80', values: benchBase }, { name: '微调后', color: jobColor(j), values: j.status === 'queued' ? benchBase.map(() => 0) : benchFt }], label: '评测基准分组柱状图',
      }));
      bindTabs(detail, 'jd-tabs', (id) => {
        detail.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== id; });
        $('#jd-log-tools', detail).hidden = id !== 'logs';
        if (id === 'logs') drawLogs(true);
      });
      bindSeg(detail, 'log-lvl', (v) => { logLevel = v; drawLogs(true); });
      $('#log-pause', detail).addEventListener('click', (e) => {
        logPaused = !logPaused;
        e.currentTarget.innerHTML = logPaused ? `${icon('play')}继续滚动` : `${icon('pause')}暂停滚动`;
      });
      logs = Array.from({ length: 18 }, (_, i) => ({ t: Date.now() - (18 - i) * 4000, ...logLine(j, 0, r) }));
      if (j.status === 'failed') logs.push({ t: j.finished, lvl: 'ERROR', msg: j.error }, { t: j.finished + 400, lvl: 'ERROR', msg: 'torchrun: 进程组异常退出 (exit code 1)，任务已终止并释放 GPU' });
    }

    function drawGpus() {
      const host = $('#jd-gpus', detail);
      if (!host || !sel) return;
      host.innerHTML = sel.gpuUtil.map((s, i) => {
        const cur = s[s.length - 1];
        return `<div class="gm"><div class="gm-h"><span>GPU ${i}</span><b>${sel.status === 'running' ? fmt.pct(cur, 0) : '—'}</b></div>${sparkline(s, { w: 120, h: 30, color: sel.status === 'running' ? SERIES[0] : '#5d6a80', min: 0 })}</div>`;
      }).join('');
    }

    function drawLogs(force) {
      const host = $('#console', detail);
      if (!host || (logPaused && !force)) return;
      const rows = logs.filter((l) => logLevel === 'all' || l.lvl !== 'INFO').slice(-120);
      host.innerHTML = rows.map((l) => `<div class="ln l-${l.lvl}"><span class="lt">${fmt.time(l.t)}</span><span class="ll">${l.lvl}</span><span class="lm">${esc(l.msg)}</span></div>`).join('') || '<div class="ln"><span class="lm">没有警告。</span></div>';
      host.scrollTop = host.scrollHeight;
    }

    function select(id) {
      const j = state.jobs.find((x) => x.id === id) || state.jobs.find((x) => x.status === 'running') || state.jobs[0];
      sel = j;
      logPaused = false;
      logLevel = 'all';
      drawList();
      drawDetail();
      if (id && innerWidth < 1100) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // actions
    detail.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a || !sel) return;
      const j = sel;
      if (a === 'pause') {
        j.status = 'paused';
        toast({ kind: 'info', title: `已暂停「${j.name}」`, body: '已保存检查点，GPU 资源已释放', action: { label: '恢复', fn: () => { j.status = 'running'; bus.emit('jobs', j); } } });
        bus.emit('jobs', j);
      } else if (a === 'resume') {
        j.status = 'running';
        toast({ kind: 'good', title: `已恢复「${j.name}」`, body: `从 step ${fmt.int(j.progress * j.steps)} 的检查点继续` });
        bus.emit('jobs', j);
      } else if (a === 'stop') {
        if (!(await confirmDialog({ title: '停止训练任务', body: `「<b>${esc(j.name)}</b>」会立即终止，已保存的检查点仍可部署或下载，但无法从当前进度恢复。`, confirmLabel: '停止任务', danger: true }))) return;
        j.status = 'failed';
        j.error = '用户手动停止';
        j.finished = Date.now();
        toast({ kind: 'warn', title: `已停止「${j.name}」` });
        bus.emit('jobs', j);
      } else if (a === 'clone') {
        toast({ kind: 'info', title: '已复制任务配置', body: '在新建训练页面调整后即可提交' });
        ctx.navigate('training');
      } else if (a === 'retry') {
        j.status = 'queued';
        j.progress = 0;
        j.loss = [];
        j.val = [];
        j.valIdx = [];
        j.error = null;
        j.method += ' · 梯度检查点';
        j.eta = 9 * 3600;
        bus.emit('jobs', j);
        toast({ kind: 'good', title: '已按建议重新提交', body: '开启梯度检查点，micro-batch 降为 2' });
        setTimeout(() => { j.status = 'running'; j.started = Date.now(); j.finished = null; j.loss = [2.7]; bus.emit('jobs', j); }, 3000);
      } else if (a === 'deploy') {
        deploy(j);
      }
    });

    function deploy(j) {
      openLayer({
        kind: 'modal', title: '部署为专属端点', eyebrow: esc(j.name),
        body: `<div class="form">
          <div class="field"><label class="field-l" for="dp-name">端点名称</label><input class="input mono" id="dp-name" value="${j.id}-v1"></div>
          <div class="field"><span class="field-l">实例规格</span>${seg('dp-size', [{ value: '1', label: '1 × L40S' }, { value: '2', label: '2 × H100' }, { value: '4', label: '4 × H200' }], '2')}</div>
          <div class="field"><label class="field-l" for="dp-min">自动扩缩容 <small id="dp-min-v">1 – 6 副本</small></label><input type="range" id="dp-min" min="1" max="16" value="6" style="--p:33%"></div>
        </div>`,
        foot: '<button class="btn ghost" type="button" data-x>取消</button><button class="btn primary" type="button" data-go>部署</button>',
        onMount(p, close) {
          bindSeg(p, 'dp-size', () => {});
          const rg = $('#dp-min', p);
          rg.addEventListener('input', () => { rg.style.setProperty('--p', `${((rg.value - 1) / 15) * 100}%`); $('#dp-min-v', p).textContent = `1 – ${rg.value} 副本`; });
          p.querySelector('[data-x]').addEventListener('click', () => close());
          p.querySelector('[data-go]').addEventListener('click', (e) => {
            const name = $('#dp-name', p).value.trim();
            if (!/^[a-z0-9-]{3,40}$/.test(name)) { $('#dp-name', p).closest('.field').classList.add('err'); toast({ kind: 'warn', title: '端点名称只能包含小写字母、数字和连字符' }); return; }
            e.currentTarget.classList.add('loading');
            setTimeout(() => {
              close();
              toast({ kind: 'good', title: '端点部署中', body: `${name} 预计 2 分钟内就绪，就绪后会出现在模型广场的「我的模型」中` });
              pushNotification({ level: 'good', title: '端点已就绪', body: `${name} 已上线，可通过 model="${name}" 调用。`, link: 'models' });
            }, 900);
          });
        },
      });
    }

    $('#j-f', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      filter = b.dataset.f;
      view.querySelectorAll('#j-f .chip').forEach((x) => x.classList.toggle('on', x === b));
      drawList();
    });
    $('#j-q', view).addEventListener('input', debounce((e) => { q = e.target.value.trim().toLowerCase(); drawList(); }));

    let lastLen = -1;
    ctx.keep(live.on(() => {
      list.querySelectorAll('.jli').forEach((a) => {
        const j = state.jobs.find((x) => x.id === a.dataset.id);
        if (!j || j.status !== 'running') return;
        a.querySelector('.bar i').style.width = `${(j.progress * 100).toFixed(2)}%`;
        a.querySelector('.jli-p span').textContent = fmt.pct(j.progress * 100, 0);
      });
      if (!sel) return;
      const j = sel;
      const set = (id, v) => { const el = $(id, detail); if (el) el.textContent = v; };
      set('#jd-pct', fmt.pct(j.progress * 100, 1));
      const ringV = detail.querySelector('.jp-ring .ring-v');
      if (ringV) { const c = +ringV.getAttribute('stroke-dasharray'); ringV.setAttribute('stroke-dashoffset', (c * (1 - j.progress)).toFixed(2)); }
      set('#jd-step', `${fmt.int(j.progress * j.steps)} / ${fmt.int(j.steps)}`);
      if (j.status === 'running') set('#jd-eta', fmt.dur(j.eta));
      if (j.started) set('#jd-el', fmt.dur(elapsed(j)));
      if (j.loss.length) set('#jd-loss', j.loss[j.loss.length - 1].toFixed(4));
      set('#jd-cost', fmt.cny(j.cost));
      if (j.status === 'running') {
        logs.push({ t: Date.now(), ...logLine(j, 0, r) });
        if (logs.length > 300) logs.splice(0, logs.length - 300);
        drawLogs(false);
        if (j.loss.length !== lastLen) {
          lastLen = j.loss.length;
          const valSeries = j.loss.map(() => null);
          j.valIdx.forEach((idx, k) => { if (idx < valSeries.length) valSeries[idx] = j.val[k]; });
          if (lossChart) {
            lossChart.update({ x: j.loss.map((_, i) => i), series: [{ name: '训练损失', color: jobColor(j), values: j.loss }, { name: '验证损失', color: SERIES[1] === jobColor(j) ? SERIES[0] : SERIES[1], values: interpolate(valSeries), dash: true, area: false }] });
          } else if (j.loss.length > 1) {
            drawDetail();
            return;
          }
          drawGpus();
        }
      }
    }));
    ctx.keep(bus.on('jobs', (j) => { if (sel && j && j.id === sel.id) drawDetail(); drawList(); }));
    ctx.keep(destroyCharts);
    this._select = select;
    select(ctx.params[0]);
  },
  update(params) { this._select(params[0]); },
};

function interpolate(arr) {
  // validation points are sparse; connect them so the dashed line reads as a trend
  const out = arr.slice();
  let last = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i] == null) continue;
    if (last >= 0) for (let k = last + 1; k < i; k++) out[k] = out[last] + ((out[i] - out[last]) * (k - last)) / (i - last);
    last = i;
  }
  return out;
}

function ckptTable(j) {
  if (!j.valIdx.length) return empty('还没有检查点', '第一次评估后会自动保存检查点。', 'database');
  const pts = j.valIdx.filter((_, k) => k % 3 === 2 || k === j.valIdx.length - 1).slice(-6).reverse();
  const best = Math.min(...j.val);
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>检查点</th><th class="num">训练损失</th><th class="num">验证损失</th><th class="num">大小</th><th>保存时间</th><th></th></tr></thead><tbody>${pts.map((idx) => {
    const k = j.valIdx.indexOf(idx);
    const step = Math.round((idx / Math.max(1, j.loss.length - 1)) * j.progress * j.steps);
    const isBest = j.val[k] === best;
    return `<tr><td class="mono">step-${step}${isBest ? ' <span class="tag best">最佳</span>' : ''}</td><td class="num">${j.loss[idx].toFixed(4)}</td><td class="num">${j.val[k].toFixed(4)}</td><td class="num">${(j.gpus * 1.9).toFixed(1)} GB</td><td class="muted">${fmt.rel((j.started || Date.now()) + (idx / j.loss.length) * elapsed(j) * 1000)}</td>
      <td class="num"><button type="button" class="btn xs ghost" data-copy="s3://tensora-ckpt/${j.id}/step-${step}">${icon('copy')}路径</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
