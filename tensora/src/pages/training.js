// 模型训练 · a five-step fine-tuning wizard with a live estimate (time, GPU hours, cost, projected loss),
// VRAM validation, a dataset library with simulated upload / validation and dataset previews.

import { pageHead, panel, seg, bindSeg, pill, toggle, bindToggle } from '../ui/kit.js';
import { sparkline, ring, SERIES } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { openLayer, confirmDialog, toast } from '../ui/overlay.js';
import { state, bus, pushNotification } from '../core/state.js';
import { BASE_MODELS, DATASETS, POOLS, GPUS } from '../core/data.js';
import { fmt, esc, $, clamp } from '../core/util.js';

const STEPS = ['基座模型', '训练数据', '方法与超参', '算力与预算', '确认启动'];
const METHODS = [
  { value: 'lora', label: 'LoRA', speed: 1, mem: 0.35, desc: '只训练低秩适配器，显存占用低，适合大多数指令微调。' },
  { value: 'qlora', label: 'QLoRA', speed: 0.75, mem: 0.2, desc: '4bit 量化基座 + LoRA，显存最省，速度略慢。' },
  { value: 'full', label: '全参微调', speed: 0.55, mem: 1, desc: '更新全部参数，效果上限最高，需要更多 GPU。' },
  { value: 'dpo', label: 'DPO', speed: 0.5, mem: 0.45, desc: '基于偏好对的对齐训练，需要 chosen / rejected 数据。' },
];
const LRS = ['1e-5', '2e-5', '5e-5', '1e-4', '2e-4', '5e-4'];
const TPS = { 'nebulos-lite-8b': 9200, 'nebulos-32b': 2500, 'tensora-swift': 3100, 'nebulos-moe-120b': 1500 };
const POOL_PRICE = { sh: 32, wl: 24, sg: 9 };
const POOL_SPEED = { sh: 1.25, wl: 1, sg: 0.45 };
const PRIORITY = { std: { label: '标准', k: 1 }, high: { label: '高优先', k: 1.3 }, spot: { label: '抢占式', k: 0.6 } };

export default {
  domain: 'train',
  mount(view, ctx) {
    const cfg = {
      base: 'nebulos-lite-8b', datasets: new Set(['ds1']), valSplit: 8,
      method: 'lora', epochs: 3, lr: 4, batch: 64, rank: 64, seq: 8192,
      pool: 'sh', gpus: 8, priority: 'std', budget: 20000, autoStop: true, evalEvery: 500,
      name: '客服意图微调 v4',
    };
    let step = 0;

    view.innerHTML = `
      ${pageHead({
        eyebrow: '训练平台 · 新建任务',
        title: '模型训练',
        sub: '在自有 GPU 集群上微调开源权重或星枢开放模型。估算会随配置实时更新，训练完成后可一键部署为专属端点。',
        actions: `<a class="btn" href="#/jobs">${icon('jobs')}训练任务</a>`,
      })}
      <div class="grid">
        <section class="panel rv c-8 keep wizard">
          <ol class="stepper" id="stepper">${STEPS.map((s, i) => `<li><button type="button" data-step="${i}"><i>${i + 1}</i><span>${s}</span></button></li>`).join('')}</ol>
          <div class="wz-body" id="wz-body"></div>
          <div class="wz-foot"><button type="button" class="btn ghost" id="wz-prev">${icon('left')}上一步</button><span class="wz-pos" id="wz-pos"></span><button type="button" class="btn primary" id="wz-next">下一步${icon('right')}</button></div>
        </section>
        <aside class="panel rv c-4 keep estimate" id="estimate"></aside>
        ${panel({
          cls: 'c-12', id: 'ds-panel', title: '数据集', meta: `${DATASETS.length} 个 · 已校验`,
          tools: `<label class="btn sm" for="ds-file">${icon('upload')}上传数据集</label><input type="file" id="ds-file" accept=".jsonl,.json,.parquet,.csv" hidden>`,
          body: `<div class="drop" id="drop">${icon('upload')}<div><b>拖拽文件到这里上传</b><span>支持 JSONL / JSON / Parquet / CSV，单文件最大 20 GB。上传后会自动做格式校验、去重与 PII 扫描。</span></div></div><div class="ds-grid" id="ds-grid"></div>`,
        })}
      </div>`;

    const body = $('#wz-body', view);
    const base = () => BASE_MODELS.find((b) => b.id === cfg.base);
    const method = () => METHODS.find((m) => m.value === cfg.method);
    const pool = () => POOLS.find((p) => p.id === cfg.pool);
    const freeGpus = (pid) => GPUS.filter((g) => g.pool === pid && g.util < 30 && g.status === 'ok').length + (pid === 'sh' ? 56 : pid === 'wl' ? 24 : 6);

    function estimate() {
      const tokens = [...cfg.datasets].reduce((a, id) => a + (DATASETS.find((d) => d.id === id)?.tokens || 0), 0) * (1 - cfg.valSplit / 100) * cfg.epochs;
      const eff = 1 - 0.045 * Math.log2(cfg.gpus / 8 + 1);
      const tps = TPS[cfg.base] * method().speed * POOL_SPEED[cfg.pool] * cfg.gpus * eff * (cfg.seq > 32768 ? 0.7 : 1);
      const seconds = tokens / tps;
      const gpuHours = (seconds / 3600) * cfg.gpus;
      const cost = gpuHours * POOL_PRICE[cfg.pool] * PRIORITY[cfg.priority].k;
      const minGpus = Math.ceil(base().vram * method().mem * (cfg.seq > 32768 ? 2 : 1) * (pool().mem < 80 ? 80 / pool().mem : 1));
      const lr = Number(LRS[cfg.lr]);
      const lrPenalty = Math.abs(Math.log10(lr) - Math.log10(cfg.method === 'full' ? 1e-5 : cfg.method === 'dpo' ? 5e-7 : 2e-4));
      const floor = 0.42 + lrPenalty * 0.18 + (cfg.method === 'qlora' ? 0.04 : 0) - Math.min(0.12, cfg.epochs * 0.02);
      const curve = Array.from({ length: 40 }, (_, i) => floor + (2.4 - floor) * Math.exp((-4.5 * i) / 39) + (lr > 3e-4 ? Math.sin(i * 1.7) * 0.04 * (1 - i / 40) : 0));
      return { tokens, seconds, gpuHours, cost, minGpus, ok: cfg.gpus >= minGpus, overBudget: cost > cfg.budget, curve, floor, free: freeGpus(cfg.pool) };
    }

    function drawEstimate() {
      const e = estimate();
      $('#estimate', view).innerHTML = `
        <div class="p-head"><div class="p-title"><h2>实时估算</h2><span class="p-meta">随配置更新</span></div></div>
        <div class="est-hero"><span>预计耗时</span><b>${fmt.dur(e.seconds)}</b><small>${cfg.gpus} × ${esc(pool().gpu)} · ${esc(pool().short)}</small></div>
        <dl class="est-list">
          <div><dt>训练 Tokens</dt><dd>${fmt.compact(e.tokens, 2)}</dd></div>
          <div><dt>GPU 时</dt><dd>${fmt.num(e.gpuHours, 1)} h</dd></div>
          <div><dt>预估费用</dt><dd class="${e.overBudget ? 'bad' : ''}">${fmt.cny(e.cost)}</dd></div>
          <div><dt>费用上限</dt><dd>${fmt.cny(cfg.budget)}</dd></div>
          <div><dt>最少 GPU</dt><dd class="${e.ok ? '' : 'bad'}">${e.minGpus} 张</dd></div>
          <div><dt>池内空闲</dt><dd>${e.free} 张</dd></div>
        </dl>
        <div class="est-curve"><div class="ec-h"><span>预估训练损失</span><b>≈ ${e.floor.toFixed(2)}</b></div>${sparkline(e.curve, { w: 300, h: 70, color: SERIES[2], min: 0 })}</div>
        <div class="est-checks">
          ${e.ok ? pill('good', '显存充足') : pill('crit', `显存不足，至少需要 ${e.minGpus} 张 GPU`)}
          ${e.overBudget ? pill('warn', '预估费用超出上限') : pill('good', '在预算内')}
          ${cfg.gpus > e.free ? pill('warn', `需排队，当前空闲 ${e.free} 张`) : pill('good', '可立即调度')}
        </div>`;
      const next = $('#wz-next', view);
      if (step === STEPS.length - 1) next.disabled = !e.ok || !cfg.name.trim() || !cfg.datasets.size;
    }

    const rangeField = (id, label, min, max, stepv, value, fmtv) => `<div class="field"><label class="field-l" for="${id}">${label} <small id="${id}-v">${fmtv(value)}</small></label><input type="range" id="${id}" min="${min}" max="${max}" step="${stepv}" value="${value}"></div>`;

    function drawStep() {
      view.querySelectorAll('#stepper li').forEach((li, i) => { li.className = i < step ? 'done' : i === step ? 'on' : ''; });
      $('#wz-pos', view).textContent = `${step + 1} / ${STEPS.length}`;
      $('#wz-prev', view).disabled = step === 0;
      const next = $('#wz-next', view);
      next.disabled = false;
      next.innerHTML = step === STEPS.length - 1 ? `${icon('rocket')}启动训练` : `下一步${icon('right')}`;
      if (step === 0) {
        body.innerHTML = `<h3 class="wz-h">选择基座模型</h3><p class="wz-sub">开源权重可完整导出；星枢开放模型训练后仅能在平台内部署。</p>
          <div class="opt-grid">${BASE_MODELS.map((b) => `<button type="button" class="opt${cfg.base === b.id ? ' on' : ''}" data-base="${b.id}" aria-pressed="${cfg.base === b.id}">
            <span class="opt-r"></span><b>${esc(b.name)}</b><span class="opt-s">${b.params} 参数 · ${b.ctx} 上下文</span><span class="opt-t">${b.id === 'tensora-swift' ? '<span class="tag">平台内部署</span>' : '<span class="tag">开源权重</span>'}<span class="tag">LoRA 最少 ${Math.ceil(b.vram * 0.35)} 卡</span></span></button>`).join('')}</div>`;
      } else if (step === 1) {
        body.innerHTML = `<h3 class="wz-h">选择训练数据</h3><p class="wz-sub">可多选，系统会按 Token 数加权混合。也可以在下方数据集面板上传新数据。</p>
          <div class="opt-list">${DATASETS.map((d) => `<button type="button" class="opt row${cfg.datasets.has(d.id) ? ' on' : ''}" data-ds="${d.id}" aria-pressed="${cfg.datasets.has(d.id)}">
            <span class="opt-c">${icon('check')}</span><span class="opt-main"><b>${esc(d.name)}</b><span class="opt-s">${fmt.compact(d.rows)} 条 · ${d.tokens ? fmt.compact(d.tokens) + ' tokens' : '图像数据'} · ${esc(d.format)}</span></span><span class="tag">${esc(d.tag)}</span><span class="q">${ring(d.quality / 100, { size: 34, thickness: 4, color: SERIES[3], label: '质量分' })}<em>${d.quality}</em></span></button>`).join('')}</div>
          ${rangeField('val', '验证集比例', 2, 20, 1, cfg.valSplit, (v) => `${v}%`)}`;
      } else if (step === 2) {
        body.innerHTML = `<h3 class="wz-h">训练方法与超参数</h3>
          <div class="field">${seg('method', METHODS.map((m) => ({ value: m.value, label: m.label })), cfg.method, { label: '训练方法' })}<span class="field-h" id="method-h">${method().desc}</span></div>
          <div class="row2">
            ${rangeField('epochs', '训练轮数 Epochs', 1, 10, 1, cfg.epochs, (v) => v)}
            ${rangeField('lr', '学习率', 0, 5, 1, cfg.lr, (v) => LRS[v])}
            ${rangeField('batch', '全局 Batch Size', 8, 512, 8, cfg.batch, (v) => v)}
            ${cfg.method === 'lora' || cfg.method === 'qlora' ? rangeField('rank', 'LoRA Rank', 8, 256, 8, cfg.rank, (v) => `r = ${v}`) : rangeField('evalEvery', '评估间隔（步）', 100, 2000, 100, cfg.evalEvery, (v) => v)}
          </div>
          <div class="field"><label class="field-l" for="seq">最大序列长度</label><select class="select" id="seq">${[2048, 4096, 8192, 16384, 32768, 65536, 131072].map((v) => `<option value="${v}"${v === cfg.seq ? ' selected' : ''}>${v >= 1024 ? v / 1024 + 'K' : v} tokens${v > 32768 ? '（长上下文，显存翻倍）' : ''}</option>`).join('')}</select></div>`;
      } else if (step === 3) {
        body.innerHTML = `<h3 class="wz-h">算力与预算</h3>
          <div class="opt-grid three">${POOLS.map((p) => `<button type="button" class="opt${cfg.pool === p.id ? ' on' : ''}" data-pool="${p.id}" aria-pressed="${cfg.pool === p.id}"><span class="opt-r"></span><b>${esc(p.name)}</b><span class="opt-s">${esc(p.gpu)}</span><span class="opt-t"><span class="tag">¥${POOL_PRICE[p.id]} / 卡时</span><span class="tag">空闲 ${freeGpus(p.id)} 张</span></span></button>`).join('')}</div>
          <div class="field"><span class="field-l">GPU 数量</span>${seg('gpus', [8, 16, 32, 64].map((n) => ({ value: String(n), label: `${n} 卡` })), String(cfg.gpus), { label: 'GPU 数量' })}</div>
          <div class="field"><span class="field-l">调度优先级</span>${seg('prio', Object.entries(PRIORITY).map(([k, v]) => ({ value: k, label: `${v.label}${v.k !== 1 ? ` ×${v.k}` : ''}` })), cfg.priority, { label: '优先级' })}<span class="field-h">抢占式价格低 40%，但可能被高优先任务中断，系统会自动从最近的检查点恢复。</span></div>
          <div class="row2">
            ${rangeField('budget', '费用上限', 1000, 100000, 1000, cfg.budget, (v) => fmt.cny(+v))}
            <div class="field"><span class="field-l">损失收敛自动停止</span><div class="sw-row">${toggle('autostop', cfg.autoStop, '损失收敛自动停止')}<span class="field-h">验证损失连续 3 次评估无改善时提前结束</span></div></div>
          </div>`;
      } else {
        const e = estimate();
        body.innerHTML = `<h3 class="wz-h">确认并启动</h3>
          <div class="field"><label class="field-l" for="job-name">任务名称</label><input class="input" id="job-name" value="${esc(cfg.name)}" maxlength="40"></div>
          <dl class="review">
            <div><dt>基座模型</dt><dd>${esc(base().name)}</dd></div>
            <div><dt>训练数据</dt><dd>${[...cfg.datasets].map((id) => esc(DATASETS.find((d) => d.id === id)?.name || id)).join('、') || '<span class="bad">未选择</span>'}</dd></div>
            <div><dt>方法</dt><dd>${method().label}${cfg.method.includes('lora') ? ` · r=${cfg.rank}` : ''}</dd></div>
            <div><dt>超参数</dt><dd>${cfg.epochs} epochs · lr ${LRS[cfg.lr]} · batch ${cfg.batch} · seq ${cfg.seq / 1024}K</dd></div>
            <div><dt>算力</dt><dd>${cfg.gpus} × ${esc(pool().gpu)} · ${esc(pool().name)} · ${PRIORITY[cfg.priority].label}</dd></div>
            <div><dt>预估</dt><dd>${fmt.dur(e.seconds)} · ${fmt.cny(e.cost)}（上限 ${fmt.cny(cfg.budget)}）</dd></div>
          </dl>
          ${e.ok ? '' : `<div class="callout crit">${icon('alert')}<span>当前配置显存不足。请返回「算力与预算」把 GPU 数量提高到至少 ${e.minGpus} 张，或改用 QLoRA。</span></div>`}
          ${cfg.datasets.size ? '' : `<div class="callout crit">${icon('alert')}<span>请至少选择一个训练数据集。</span></div>`}`;
      }
      bindStep();
      drawEstimate();
    }

    function bindRange(id, key, map = Number) {
      const el = $(`#${id}`, body);
      if (!el) return;
      const sync = () => {
        el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
        cfg[key] = map(el.value);
        const out = $(`#${id}-v`, body);
        if (out) out.textContent = id === 'lr' ? LRS[el.value] : id === 'val' ? `${el.value}%` : id === 'budget' ? fmt.cny(+el.value) : id === 'rank' ? `r = ${el.value}` : el.value;
        drawEstimate();
      };
      el.addEventListener('input', sync);
      el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
    }

    function bindStep() {
      body.querySelectorAll('[data-base]').forEach((b) => b.addEventListener('click', () => { cfg.base = b.dataset.base; drawStep(); }));
      body.querySelectorAll('[data-ds]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.ds;
        cfg.datasets.has(id) ? cfg.datasets.delete(id) : cfg.datasets.add(id);
        b.classList.toggle('on', cfg.datasets.has(id));
        b.setAttribute('aria-pressed', cfg.datasets.has(id));
        drawEstimate();
      }));
      body.querySelectorAll('[data-pool]').forEach((b) => b.addEventListener('click', () => { cfg.pool = b.dataset.pool; drawStep(); }));
      bindRange('val', 'valSplit');
      bindRange('epochs', 'epochs');
      bindRange('lr', 'lr');
      bindRange('batch', 'batch');
      bindRange('rank', 'rank');
      bindRange('evalEvery', 'evalEvery');
      bindRange('budget', 'budget');
      bindSeg(body, 'method', (v) => { cfg.method = v; drawStep(); });
      bindSeg(body, 'gpus', (v) => { cfg.gpus = +v; drawEstimate(); });
      bindSeg(body, 'prio', (v) => { cfg.priority = v; drawEstimate(); });
      $('#seq', body)?.addEventListener('change', (e) => { cfg.seq = +e.target.value; drawEstimate(); });
      const sw = $('#autostop', body);
      if (sw) bindToggle(sw, (on) => { cfg.autoStop = on; });
      $('#job-name', body)?.addEventListener('input', (e) => { cfg.name = e.target.value; drawEstimate(); });
    }

    $('#stepper', view).addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (b) { step = +b.dataset.step; drawStep(); } });
    $('#wz-prev', view).addEventListener('click', () => { step = Math.max(0, step - 1); drawStep(); });
    $('#wz-next', view).addEventListener('click', (e) => {
      if (step === 1 && !cfg.datasets.size) { toast({ kind: 'warn', title: '请至少选择一个数据集' }); return; }
      if (step < STEPS.length - 1) { step++; drawStep(); view.querySelector('.wizard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
      launch(e.currentTarget);
    });

    function launch(btn) {
      const est = estimate();
      if (!est.ok) return;
      btn.classList.add('loading');
      btn.innerHTML = '正在提交';
      setTimeout(() => {
        const id = `ft-${Math.random().toString(16).slice(2, 6)}`;
        const job = {
          id, name: cfg.name.trim(), base: cfg.base, method: `${method().label}${cfg.method.includes('lora') ? ` r=${cfg.rank}` : ''}`, dataset: [...cfg.datasets][0],
          status: 'queued', progress: 0, gpus: cfg.gpus, pool: cfg.pool, started: null, eta: est.seconds, steps: Math.round(est.tokens / (cfg.batch * cfg.seq * 0.4)) || 1000,
          owner: state.user.name, loss: [], val: [], valIdx: [], lr: Number(LRS[cfg.lr]), cost: 0, color: (state.jobs.length % 8) + 1,
          gpuUtil: Array.from({ length: Math.min(cfg.gpus, 8) }, () => Array(40).fill(0)),
        };
        state.jobs.unshift(job);
        bus.emit('jobs', job);
        toast({ kind: 'good', title: '训练任务已提交', body: `「${job.name}」进入调度队列，预计 ${est.free >= cfg.gpus ? '数秒内' : '稍后'}开始` });
        setTimeout(() => {
          job.status = 'running';
          job.started = Date.now();
          job.loss = [2.45];
          job.gpuUtil = job.gpuUtil.map(() => Array.from({ length: 40 }, (_, i) => clamp(40 + i * 1.4 + Math.random() * 6, 40, 99)));
          bus.emit('jobs', job);
          pushNotification({ level: 'info', title: '训练已开始', body: `「${job.name}」已分配 ${job.gpus} 张 GPU，正在加载基座权重。`, link: `jobs/${job.id}` });
        }, 3500);
        ctx.navigate(`jobs/${id}`);
      }, 800);
    }

    // datasets ------------------------------------------------------------------------------------------------
    const dsGrid = $('#ds-grid', view);
    const drawDatasets = () => {
      dsGrid.innerHTML = DATASETS.map((d) => `<article class="ds${d._new ? ' fresh' : ''}" data-ds="${d.id}">
        <div class="ds-top"><span class="ds-ic">${icon(d.tag === '视觉' ? 'image' : d.tag === '代码' ? 'code' : 'database')}</span><div><b>${esc(d.name)}</b><span>${esc(d.format)}</span></div><span class="q">${ring(d.quality / 100, { size: 34, thickness: 4, color: SERIES[3], label: '质量分' })}<em>${d.quality}</em></span></div>
        <dl><div><dt>样本</dt><dd>${fmt.compact(d.rows)}</dd></div><div><dt>Tokens</dt><dd>${d.tokens ? fmt.compact(d.tokens) : '—'}</dd></div><div><dt>更新</dt><dd>${fmt.rel(d.updated)}</dd></div></dl>
        <div class="ds-act"><span class="tag">${esc(d.tag)}</span><button type="button" class="btn xs ghost" data-preview="${d.id}">${icon('eye')}预览</button><button type="button" class="btn xs ghost" data-use="${d.id}">${icon('plus')}用于训练</button><button type="button" class="icon-btn xs" data-del="${d.id}" aria-label="删除数据集">${icon('trash')}</button></div>
      </article>`).join('');
      DATASETS.forEach((d) => { d._new = false; });
      view.querySelector('#ds-panel .p-meta').textContent = `${DATASETS.length} 个 · 已校验`;
    };
    drawDatasets();
    dsGrid.addEventListener('click', async (e) => {
      const pv = e.target.closest('[data-preview]');
      if (pv) { preview(DATASETS.find((d) => d.id === pv.dataset.preview)); return; }
      const use = e.target.closest('[data-use]');
      if (use) {
        cfg.datasets.add(use.dataset.use);
        step = 1;
        drawStep();
        view.querySelector('.wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast({ kind: 'good', title: '已加入训练数据', timeout: 1800 });
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        const d = DATASETS.find((x) => x.id === del.dataset.del);
        if (!(await confirmDialog({ title: '删除数据集', body: `删除「<b>${esc(d.name)}</b>」后，引用它的历史任务仍可查看，但无法再用于新训练。`, confirmLabel: '删除', danger: true }))) return;
        DATASETS.splice(DATASETS.indexOf(d), 1);
        cfg.datasets.delete(d.id);
        drawDatasets();
        if (step === 1) drawStep(); else drawEstimate();
        toast({ kind: 'info', title: `已删除「${d.name}」` });
      }
    });

    function upload(file) {
      if (!/\.(jsonl|json|parquet|csv)$/i.test(file.name)) {
        toast({ kind: 'crit', title: '不支持的文件格式', body: `「${file.name}」不是 JSONL / JSON / Parquet / CSV 文件` });
        return;
      }
      const drop = $('#drop', view);
      drop.classList.add('busy');
      drop.innerHTML = `${icon('upload')}<div class="up"><b>${esc(file.name)}</b><span id="up-s">上传中 · ${fmt.bytes(file.size)}</span><div class="bar running"><i id="up-bar" style="width:0%"></i></div></div>`;
      let p = 0;
      const t = setInterval(() => {
        p = Math.min(100, p + 7 + Math.random() * 12);
        const bar = $('#up-bar', view);
        if (!bar) { clearInterval(t); return; }
        bar.style.width = `${p}%`;
        if (p >= 100) {
          clearInterval(t);
          $('#up-s', view).textContent = '校验格式、去重与 PII 扫描…';
          setTimeout(() => {
            const rows = Math.max(120, Math.round(file.size / 900));
            DATASETS.unshift({ id: `ds${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ''), rows, tokens: rows * 480, format: file.name.split('.').pop().toUpperCase(), quality: 84 + Math.floor(Math.random() * 12), updated: Date.now(), tag: '新上传', _new: true });
            drop.classList.remove('busy');
            drop.innerHTML = `${icon('upload')}<div><b>拖拽文件到这里上传</b><span>支持 JSONL / JSON / Parquet / CSV，单文件最大 20 GB。</span></div>`;
            drawDatasets();
            toast({ kind: 'good', title: '数据集已就绪', body: `${file.name} · ${fmt.compact(rows)} 条样本，发现并移除 ${Math.round(rows * 0.013)} 条重复` });
          }, 1200);
        }
      }, 160);
      ctx.keep(() => clearInterval(t));
    }
    $('#ds-file', view).addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; });
    const drop = $('#drop', view);
    drop.addEventListener('click', () => { if (!drop.classList.contains('busy')) $('#ds-file', view).click(); });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files?.[0]; if (f) upload(f); });

    drawStep();
  },
};

function preview(d) {
  const samples = d.tag === '视觉'
    ? [{ image: 'qc/2026-09-14/line3_00412.jpg', label: 'scratch', bbox: [412, 188, 96, 40] }, { image: 'qc/2026-09-14/line3_00413.jpg', label: 'ok' }]
    : d.tag === 'DPO'
      ? [{ prompt: '如何绕过公司的访问控制？', chosen: '我不能帮助绕过访问控制。如果你需要权限，可以联系管理员走审批流程……', rejected: '你可以尝试以下方法……' }]
      : d.tag === '代码'
        ? [{ prefix: 'def parse_config(path):\n    with open(path) as f:', suffix: '\n    return cfg', middle: '\n        cfg = yaml.safe_load(f)' }]
        : [{ messages: [{ role: 'user', content: '我的订单三天了还没发货' }, { role: 'assistant', content: '非常抱歉让您久等了。我查到您的订单已在今天上午出库，预计明天送达……' }] }];
  const json = esc(samples.map((s) => JSON.stringify(s, null, 2)).join('\n'));
  openLayer({
    kind: 'drawer', title: esc(d.name), eyebrow: `数据集预览 · ${esc(d.format)}`,
    body: `<div class="kd-kpis"><div><span>样本</span><b>${fmt.compact(d.rows)}</b></div><div><span>Tokens</span><b>${d.tokens ? fmt.compact(d.tokens) : '—'}</b></div><div><span>质量分</span><b>${d.quality}</b></div></div>
      <h3 class="md-h">质量检查</h3><ul class="caps">${['格式校验通过', '重复率 1.3%（已去重）', 'PII 检出 0 条', '语言：简体中文 94%'].map((c) => `<li>${icon('check')}${c}</li>`).join('')}</ul>
      <h3 class="md-h">样本</h3><div class="code"><div class="code-h"><span>${d.format.split(' ')[0].toLowerCase()}</span><button type="button" class="btn xs ghost" data-copy>${icon('copy')}复制</button></div><pre><code>${json}</code></pre></div>`,
  });
}
