// 模型广场 · model marketplace: featured carousel, filters, grid / list views, a detail drawer
// (overview, performance, pricing calculator, integration code) and a streaming playground.

import { pageHead, seg, bindSeg, pill, tabs, bindTabs, codeBlock, highlight, empty } from '../ui/kit.js';
import { lineChart, SERIES } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { sigil } from '../ui/sigil.js';
import { openLayer, toast } from '../ui/overlay.js';
import { state, toggleFavorite } from '../core/state.js';
import { CATEGORIES, PROVIDERS, NOW } from '../core/data.js';
import { fmt, esc, $, rng, hash, debounce, saved } from '../core/util.js';

const CAT_ICON = { chat: 'chat', reason: 'reason', code: 'code', vision: 'vision', embed: 'embed', audio: 'audio', image: 'image' };
const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;
const ctxLabel = (n) => (n >= 1e6 ? `${n / 1e6}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : n ? String(n) : '—');
const priceIn = (m) => (m.unit ? m.unit : `¥${m.pin}`);
const priceOut = (m) => (m.unit ? '' : m.pout ? `¥${m.pout}` : '—');

function endpoint(m) {
  if (m.cat === 'embed') return m.id.includes('rerank') ? 'rerank' : 'embeddings';
  if (m.cat === 'image') return 'images/generations';
  if (m.cat === 'audio') return m.id.includes('listen') ? 'audio/transcriptions' : 'audio/speech';
  return 'chat/completions';
}

function samples(m) {
  const ep = endpoint(m);
  const body = ep === 'chat/completions'
    ? `{\n    "model": "${m.id}",\n    "messages": [{"role": "user", "content": "用三句话解释 MoE 架构"}],\n    "stream": true\n  }`
    : ep === 'embeddings' ? `{\n    "model": "${m.id}",\n    "input": ["星枢网关支持统一计费", "AI 基础设施"],\n    "dimensions": 1024\n  }`
    : ep === 'rerank' ? `{\n    "model": "${m.id}",\n    "query": "如何降低推理成本",\n    "documents": ["开启缓存", "批处理", "选用小模型"]\n  }`
    : ep === 'images/generations' ? `{\n    "model": "${m.id}",\n    "prompt": "极光下的数据中心，电影感，4K",\n    "size": "2048x1152"\n  }`
    : ep === 'audio/speech' ? `{\n    "model": "${m.id}",\n    "voice": "qingyu",\n    "input": "欢迎使用星枢智能客服。"\n  }`
    : `{\n    "model": "${m.id}",\n    "file": "@meeting.wav",\n    "diarize": true\n  }`;
  const curl = `curl "https://api.tensora.example/v1/${ep}" \\\n  -H "Authorization: Bearer $TENSORA_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
  const py = ep === 'chat/completions'
    ? `from openai import OpenAI\n\nclient = OpenAI(base_url="https://api.tensora.example/v1", api_key="sk-tsr-…")\n\nstream = client.chat.completions.create(\n    model="${m.id}",\n    messages=[{"role": "user", "content": "用三句话解释 MoE 架构"}],\n    stream=True,\n)\nfor chunk in stream:\n    print(chunk.choices[0].delta.content or "", end="")`
    : `import requests\n\nresp = requests.post(\n    "https://api.tensora.example/v1/${ep}",\n    headers={"Authorization": "Bearer sk-tsr-…"},\n    json={"model": "${m.id}"},\n    timeout=60,\n)\nprint(resp.json())`;
  const js = ep === 'chat/completions'
    ? `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "https://api.tensora.example/v1",\n  apiKey: process.env.TENSORA_API_KEY,\n});\n\nconst res = await client.chat.completions.create({\n  model: "${m.id}",\n  messages: [{ role: "user", content: "用三句话解释 MoE 架构" }],\n});\nconsole.log(res.choices[0].message.content);`
    : `const res = await fetch("https://api.tensora.example/v1/${ep}", {\n  method: "POST",\n  headers: { Authorization: \`Bearer \${process.env.TENSORA_API_KEY}\`, "Content-Type": "application/json" },\n  body: JSON.stringify({ model: "${m.id}" }),\n});\nconsole.log(await res.json());`;
  return { curl, py, js };
}

function card(m) {
  const fav = state.favorites.has(m.id);
  return `<article class="mcard spot" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.name)} 详情">
    <div class="mc-top">${sigil(m, 46)}
      <div class="mc-id"><b>${esc(m.name)}</b><span>${esc(PROVIDERS[m.provider].name)} · ${catLabel(m.cat)}</span></div>
      <button type="button" class="fav${fav ? ' on' : ''}" data-fav="${m.id}" aria-pressed="${fav}" aria-label="${fav ? '取消收藏' : '收藏'}">${icon('star')}</button>
    </div>
    <p class="mc-desc">${esc(m.desc)}</p>
    <div class="mc-tags">${m.isNew ? '<span class="tag new">新上架</span>' : ''}${m.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <dl class="mc-spec">
      <div><dt>上下文</dt><dd>${ctxLabel(m.ctx)}</dd></div>
      <div><dt>${m.unit ? '计费' : '输入 / 百万'}</dt><dd>${esc(priceIn(m))}</dd></div>
      ${m.unit ? '' : `<div><dt>输出 / 百万</dt><dd>${esc(priceOut(m))}</dd></div>`}
    </dl>
    <div class="mc-foot">
      <span title="首字延迟">${icon('clock')}${fmt.ms(m.ttft)}</span>
      <span title="可用性">${icon('shield')}${m.uptime.toFixed(2)}%</span>
      <span title="日调用量">${icon('usage')}${fmt.compact(m.calls / 30)}/日</span>
      <button type="button" class="btn xs try" data-try="${m.id}">${icon('play')}试用</button>
    </div>
  </article>`;
}

function row(m) {
  const fav = state.favorites.has(m.id);
  return `<tr class="click" data-id="${m.id}">
    <td><div class="mrow">${sigil(m, 32)}<div><b>${esc(m.name)}</b><span class="sub">${esc(PROVIDERS[m.provider].name)}</span></div>${m.isNew ? '<span class="tag new">新</span>' : ''}</div></td>
    <td>${icon(CAT_ICON[m.cat], 'cat-i')}${catLabel(m.cat)}</td>
    <td class="num">${ctxLabel(m.ctx)}</td>
    <td class="num">${esc(priceIn(m))}</td>
    <td class="num">${esc(priceOut(m)) || '—'}</td>
    <td class="num">${fmt.ms(m.ttft)}</td>
    <td class="num">${m.tps ? m.tps + ' t/s' : '—'}</td>
    <td class="num">${m.uptime.toFixed(2)}%</td>
    <td><button type="button" class="fav${fav ? ' on' : ''}" data-fav="${m.id}" aria-pressed="${fav}" aria-label="${fav ? '取消收藏' : '收藏'}">${icon('star')}</button></td>
  </tr>`;
}

// ---- playground ---------------------------------------------------------------------------------------

const REPLIES = {
  chat: '混合专家（MoE）架构把一个大模型拆成许多“专家”子网络，并由一个门控网络为每个 Token 挑选少数几个专家参与计算。\n\n这样模型的总参数量可以很大，但每次推理只激活其中一小部分，**计算成本接近一个小模型**。\n\n代价是训练时需要做负载均衡，避免少数专家过载，而推理时对显存和跨卡通信的要求更高。',
  reason: '思考了 3.2 秒\n\n我们分三步来看：\n1. **稀疏激活**：每个 Token 只路由到 k 个专家（常见 k=2），计算量 ∝ k，而非专家总数。\n2. **容量扩展**：专家数从 8 增加到 64 时，总参数增长 8 倍，单 Token FLOPs 基本不变。\n3. **工程约束**：All-to-All 通信成为瓶颈，需要专家并行与容量因子调优。\n\n结论：MoE 用“更多参数、同等算力”换取更强的模型能力。',
  code: '```python\nimport torch.nn as nn\n\nclass MoE(nn.Module):\n    def __init__(self, dim, n_experts=8, k=2):\n        super().__init__()\n        self.gate = nn.Linear(dim, n_experts)\n        self.experts = nn.ModuleList(nn.Linear(dim, dim) for _ in range(n_experts))\n        self.k = k\n\n    def forward(self, x):\n        w, idx = self.gate(x).softmax(-1).topk(self.k, dim=-1)\n        return sum(w[..., i:i+1] * self.experts[j](x) for i, j in enumerate(idx.unbind(-1)))\n```\n这个最小实现演示了 top-k 门控：每个 Token 只经过 k 个专家。',
  vision: '图像分析结果：\n- 画面主体为 2U 服务器机架，共 8 台节点，指示灯 7 绿 1 琥珀。\n- 第 3 台节点的风扇格栅有明显积尘，可能与该节点温度偏高有关。\n- 线缆整理规范，未发现松动的电源接头。\n\n建议：安排对第 3 台节点做除尘，并复查其 GPU 温度曲线。',
  embed: '已生成 2 条向量（维度 1024，float32）。\n\n余弦相似度：0.8217\n\n[0.0132, -0.0418, 0.0907, 0.0021, -0.0655, 0.0384, …]\n\n提示：开启 Matryoshka 截断可把维度降到 256，存储减少 75%，召回率下降不到 1%。',
  audio: '已合成 6.4 秒音频（24 kHz · 音色「清羽」· 情感：亲切）。\n\n首包延迟 172 ms，实时率 0.08。\n\n▶ 欢迎使用星枢智能客服。',
  image: '已生成 1 张 2048 × 1152 图像（种子 81920417）。\n\n画面：极光在夜空中流动，下方是一座发光的玻璃数据中心，冷色调，电影感景深。\n\n耗时 3.4 秒 · 计费 ¥0.28',
};

function openPlayground(m) {
  let timer = 0;
  const firstPrompt = m.cat === 'code' ? '写一个最小的 MoE 层 PyTorch 实现' : m.cat === 'vision' ? '分析这张机房巡检照片里的异常' : m.cat === 'image' ? '极光下的数据中心，电影感，4K' : m.cat === 'audio' ? '欢迎使用星枢智能客服。' : m.cat === 'embed' ? '星枢网关支持统一计费 / AI 基础设施' : '用三句话解释 MoE 架构';
  openLayer({
    kind: 'modal', wide: true, title: `${esc(m.name)} · Playground`, eyebrow: '模型试用 · 演示响应', cls: 'pg',
    body: `<div class="pg-grid">
      <aside class="pg-side">
        <div class="field"><label class="field-l" for="pg-sys">系统提示词</label><textarea id="pg-sys" class="textarea" rows="4">你是星枢平台的技术顾问，回答简洁、准确。</textarea></div>
        <div class="field"><label class="field-l" for="pg-temp">Temperature <small id="pg-temp-v">0.7</small></label><input id="pg-temp" type="range" min="0" max="2" step="0.1" value="0.7" style="--p:35%"></div>
        <div class="field"><label class="field-l" for="pg-max">最大输出 Tokens <small id="pg-max-v">1024</small></label><input id="pg-max" type="range" min="64" max="8192" step="64" value="1024" style="--p:12%"></div>
        <div class="pg-meta"><div><span>首字延迟</span><b id="pg-ttft">—</b></div><div><span>输出 Tokens</span><b id="pg-tok">0</b></div><div><span>预估费用</span><b id="pg-cost">¥0.0000</b></div></div>
      </aside>
      <section class="pg-chat">
        <div class="pg-log" id="pg-log"><div class="pg-hint">${sigil(m, 40)}<b>${esc(m.name)}</b><span>发送一条消息试试。这里的回复是预置的演示内容，不消耗真实额度。</span></div></div>
        <form class="pg-in" id="pg-form"><textarea id="pg-q" class="textarea" rows="2" placeholder="输入消息，Enter 发送，Shift+Enter 换行">${esc(firstPrompt)}</textarea><button class="btn primary" id="pg-send" type="submit">${icon('send')}发送</button></form>
      </section>
    </div>`,
    onMount(panel) {
      const log = $('#pg-log', panel), q = $('#pg-q', panel), send = $('#pg-send', panel);
      const ranges = [['pg-temp', (v) => v], ['pg-max', (v) => v]];
      for (const [id] of ranges) {
        const el = $(`#${id}`, panel);
        const sync = () => { el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`); $(`#${id}-v`, panel).textContent = el.value; };
        el.addEventListener('input', sync);
        sync();
      }
      let streaming = false;
      const stop = () => { clearInterval(timer); streaming = false; send.innerHTML = `${icon('send')}发送`; send.classList.remove('danger'); send.classList.add('primary'); };
      const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/```(\w*)\n([\s\S]*?)```/g, (_, l, c) => `<pre class="pg-code">${c}</pre>`);
      $('#pg-form', panel).addEventListener('submit', (e) => {
        e.preventDefault();
        if (streaming) { stop(); toast({ kind: 'info', title: '已停止生成', timeout: 1600 }); return; }
        const text = q.value.trim();
        if (!text) { q.focus(); return; }
        log.querySelector('.pg-hint')?.remove();
        log.insertAdjacentHTML('beforeend', `<div class="msg me"><p>${esc(text)}</p></div><div class="msg ai"><span class="ai-av">${sigil(m, 26)}</span><div class="ai-b"><p class="typing"><i></i><i></i><i></i></p></div></div>`);
        q.value = '';
        log.scrollTop = log.scrollHeight;
        const reply = REPLIES[m.cat] || REPLIES.chat;
        const body = log.lastElementChild.querySelector('.ai-b');
        const ttft = Math.round(m.ttft * (0.8 + Math.random() * 0.4));
        streaming = true;
        send.innerHTML = `${icon('stop')}停止`;
        send.classList.remove('primary');
        send.classList.add('danger');
        setTimeout(() => {
          if (!streaming) { body.innerHTML = '<p class="muted">（已停止）</p>'; return; }
          $('#pg-ttft', panel).textContent = fmt.ms(ttft);
          let i = 0;
          timer = setInterval(() => {
            i = Math.min(reply.length, i + 3 + Math.floor(Math.random() * 4));
            body.innerHTML = `<div class="ai-t">${md(reply.slice(0, i)).replace(/\n/g, '<br>')}<span class="caret"></span></div>`;
            const toks = Math.round(i / 1.6);
            $('#pg-tok', panel).textContent = toks;
            $('#pg-cost', panel).textContent = `¥${((toks * (m.pout || 2) + text.length * (m.pin || 1)) / 1e6).toFixed(4)}`;
            log.scrollTop = log.scrollHeight;
            if (i >= reply.length) { body.querySelector('.caret')?.remove(); stop(); }
          }, 28);
        }, Math.min(ttft, 1600));
      });
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#pg-form', panel).requestSubmit(); } });
      return () => clearInterval(timer);
    },
  });
}

// ---- detail drawer ---------------------------------------------------------------------------------------

function openDetail(m, ctx) {
  const r = rng(hash(m.id));
  const hours = Array.from({ length: 24 }, (_, i) => NOW - (23 - i) * 3600000);
  const p50 = hours.map(() => Math.round(m.ttft * (0.9 + r() * 0.2)));
  const p95 = p50.map((v) => Math.round(v * (1.9 + r() * 0.5)));
  const code = samples(m);
  let chart = null;
  const fav = () => state.favorites.has(m.id);
  const layer = openLayer({
    kind: 'drawer', wide: true, cls: 'mdrawer',
    eyebrow: `${esc(PROVIDERS[m.provider].name)} · ${catLabel(m.cat)}`,
    title: `<span class="md-title">${sigil(m, 40)}${esc(m.name)}</span>`,
    body: `
      <div class="md-tags">${m.isNew ? pill('info', '新上架') : ''}${pill('good', `可用性 ${m.uptime}%`)}${m.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <p class="md-desc">${esc(m.desc)}</p>
      ${tabs('md-tabs', [{ id: 'ov', label: '概览' }, { id: 'perf', label: '性能' }, { id: 'price', label: '定价' }, { id: 'code', label: '接入代码' }], 'ov')}
      <div class="md-pane" data-pane="ov">
        <dl class="md-spec">
          <div><dt>模型 ID</dt><dd class="mono">${m.id}<button type="button" class="icon-btn xs" data-copy="${m.id}" aria-label="复制模型 ID">${icon('copy')}</button></dd></div>
          <div><dt>上下文窗口</dt><dd>${ctxLabel(m.ctx)} tokens</dd></div>
          <div><dt>首字延迟 (P50)</dt><dd>${fmt.ms(m.ttft)}</dd></div>
          <div><dt>输出速度</dt><dd>${m.tps ? `${m.tps} tokens/s` : '—'}</dd></div>
          <div><dt>综合评分</dt><dd>${m.score} / 100</dd></div>
          <div><dt>上架时间</dt><dd>${fmt.date(m.released, true)}</dd></div>
          <div><dt>部署区域</dt><dd>华东 · 华北 · 新加坡</dd></div>
          <div><dt>近 30 天调用</dt><dd>${fmt.compact(m.calls)}</dd></div>
        </dl>
        <h3 class="md-h">能力</h3>
        <ul class="caps">${['流式输出', '函数 / 工具调用', '结构化 JSON 输出', '提示词缓存', '批处理 API', '数据不用于训练'].map((c, i) => `<li class="${m.cat === 'embed' && i < 3 ? 'no' : ''}">${icon(m.cat === 'embed' && i < 3 ? 'x' : 'check')}${c}</li>`).join('')}</ul>
      </div>
      <div class="md-pane" data-pane="perf" hidden>
        <div class="legend">${[['首字延迟 P50', SERIES[0]], ['首字延迟 P95', SERIES[1]]].map(([n, c]) => `<span class="lg"><span class="key" style="--c:${c}"></span>${n}</span>`).join('')}</div>
        <div id="md-chart"></div>
        <div class="md-kpis"><div><span>24h 请求</span><b>${fmt.compact(m.calls / 30)}</b></div><div><span>错误率</span><b>${(100 - m.uptime + 0.21).toFixed(2)}%</b></div><div><span>缓存命中</span><b>${(28 + r() * 20).toFixed(1)}%</b></div></div>
      </div>
      <div class="md-pane" data-pane="price" hidden>
        ${m.unit ? `<div class="unit-price"><span>按量计费</span><b>${esc(m.unit)}</b><small>按实际用量结算，无最低消费</small></div>` : `
        <table class="tbl price-tbl"><thead><tr><th>计费项</th><th class="num">标准</th><th class="num">批处理 (−50%)</th><th class="num">缓存命中</th></tr></thead><tbody>
          <tr><td>输入 / 百万 Tokens</td><td class="num">¥${m.pin}</td><td class="num">¥${(m.pin / 2).toFixed(2)}</td><td class="num">¥${(m.pin / 10).toFixed(2)}</td></tr>
          <tr><td>输出 / 百万 Tokens</td><td class="num">${m.pout ? '¥' + m.pout : '—'}</td><td class="num">${m.pout ? '¥' + (m.pout / 2).toFixed(2) : '—'}</td><td class="num">—</td></tr>
        </tbody></table>
        <div class="calc">
          <h3 class="md-h">月度费用估算</h3>
          <div class="field"><label class="field-l" for="calc-in">每月输入 Tokens <small id="calc-in-v"></small></label><input id="calc-in" type="range" min="1" max="2000" value="300"></div>
          <div class="field"><label class="field-l" for="calc-out">每月输出 Tokens <small id="calc-out-v"></small></label><input id="calc-out" type="range" min="0" max="1000" value="80"></div>
          <div class="field"><label class="field-l" for="calc-cache">缓存命中率 <small id="calc-cache-v"></small></label><input id="calc-cache" type="range" min="0" max="90" value="30"></div>
          <div class="calc-out"><span>预估月费用</span><b id="calc-total">—</b><small id="calc-note"></small></div>
        </div>`}
      </div>
      <div class="md-pane" data-pane="code" hidden>
        <div class="code-tabs">${seg('code-lang', [{ value: 'curl', label: 'cURL' }, { value: 'py', label: 'Python' }, { value: 'js', label: 'Node.js' }], 'curl', { small: true })}</div>
        <div id="code-box">${codeBlock(highlight(code.curl), 'bash')}</div>
        <p class="field-h">接口兼容 OpenAI 格式，只需替换 base_url 与密钥即可迁移。</p>
      </div>`,
    foot: `<button type="button" class="btn ghost" id="md-fav">${icon('star')}<span>${fav() ? '已收藏' : '收藏'}</span></button><a class="btn" href="#/keys/new">${icon('key')}创建专用密钥</a><button type="button" class="btn primary" id="md-try">${icon('play')}在 Playground 试用</button>`,
    onMount(panel) {
      bindTabs(panel, 'md-tabs', (id) => {
        panel.querySelectorAll('.md-pane').forEach((p) => { p.hidden = p.dataset.pane !== id; });
        if (id === 'perf' && !chart) {
          chart = lineChart($('#md-chart', panel), {
            x: hours, series: [{ name: '首字延迟 P50', color: SERIES[0], values: p50 }, { name: '首字延迟 P95', color: SERIES[1], values: p95, area: false }],
            height: 210, xFmt: (t) => fmt.time(t, false), tipX: (t) => fmt.time(t, false), yFmt: (v) => fmt.ms(v), glow: false, xTicks: 6,
          });
        }
      });
      bindSeg(panel, 'code-lang', (v) => { $('#code-box', panel).innerHTML = codeBlock(highlight(code[v]), v === 'curl' ? 'bash' : v === 'py' ? 'python' : 'javascript'); });
      const calcIds = ['calc-in', 'calc-out', 'calc-cache'];
      const calc = () => {
        const [i, o, c] = calcIds.map((id) => $(`#${id}`, panel));
        if (!i) return;
        for (const el of [i, o, c]) el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
        $('#calc-in-v', panel).textContent = `${fmt.compact(i.value * 1e6)}`;
        $('#calc-out-v', panel).textContent = `${fmt.compact(o.value * 1e6)}`;
        $('#calc-cache-v', panel).textContent = `${c.value}%`;
        const cr = c.value / 100;
        const total = i.value * (m.pin * (1 - cr) + (m.pin / 10) * cr) + o.value * m.pout;
        const saved = i.value * m.pin * cr * 0.9;
        $('#calc-total', panel).textContent = fmt.cny(total, 0);
        $('#calc-note', panel).textContent = saved > 1 ? `缓存为你节省约 ${fmt.cny(saved)}` : '开启提示词缓存可显著降低输入成本';
      };
      calcIds.forEach((id) => $(`#${id}`, panel)?.addEventListener('input', calc));
      calc();
      $('#md-try', panel).addEventListener('click', () => openPlayground(m));
      $('#md-fav', panel).addEventListener('click', (e) => {
        const on = toggleFavorite(m.id);
        e.currentTarget.querySelector('span').textContent = on ? '已收藏' : '收藏';
        e.currentTarget.classList.toggle('on', on);
        toast({ kind: on ? 'good' : 'info', title: on ? `已收藏 ${m.name}` : `已取消收藏 ${m.name}`, timeout: 1800 });
      });
      $('#md-fav', panel).classList.toggle('on', fav());
      return () => chart?.destroy();
    },
    onClose: () => { if (location.hash.startsWith(`#/models/${m.id}`)) ctx.replace('models'); detailLayer = null; },
  });
  return layer;
}

let detailLayer = null;

// ---- page ----------------------------------------------------------------------------------------------------

export default {
  domain: 'gateway',
  mount(view, ctx) {
    const models = state.models;
    const featured = models.filter((m) => m.isNew || m.featured).sort((a, b) => b.score - a.score);
    let f = { q: '', cat: 'all', sort: 'hot', view: saved.get('modelsView', 'grid'), fav: false };
    let slide = 0;
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.id === 'all' ? models.length : models.filter((m) => m.cat === c.id).length]));

    view.innerHTML = `
      ${pageHead({
        eyebrow: 'API 网关 · 模型广场',
        title: '模型广场',
        sub: `${models.length} 个模型，统一 OpenAI 兼容接口、统一计费与智能路由。价格单位为每百万 Tokens。`,
        actions: `<button class="btn" type="button" id="docs-btn">${icon('terminal')}快速接入</button><a class="btn primary" href="#/keys/new">${icon('key')}创建密钥</a>`,
      })}
      <section class="feature panel rv" id="feature" aria-roledescription="carousel" aria-label="精选模型">
        <div class="ft-slides" id="ft-slides"></div>
        <div class="ft-dots" id="ft-dots">${featured.map((m, i) => `<button type="button" aria-label="第 ${i + 1} 个：${esc(m.name)}" data-s="${i}"><i></i></button>`).join('')}</div>
      </section>
      <div class="m-toolbar rv">
        <div class="input-icon mq-search">${icon('search')}<input class="input" id="m-q" placeholder="搜索模型、能力或标签" autocomplete="off" aria-label="搜索模型"></div>
        <div class="m-cats" role="group" aria-label="模型类别">${CATEGORIES.map((c) => `<button type="button" class="chip${c.id === 'all' ? ' on' : ''}" data-cat="${c.id}">${c.id !== 'all' ? icon(CAT_ICON[c.id]) : ''}${c.label}<em>${counts[c.id]}</em></button>`).join('')}</div>
        <div class="m-right">
          <button type="button" class="chip" id="m-fav" aria-pressed="false">${icon('star')}收藏</button>
          <select class="select" id="m-sort" aria-label="排序"><option value="hot">最热门</option><option value="new">最新上架</option><option value="cheap">价格最低</option><option value="fast">首字最快</option><option value="score">评分最高</option></select>
          ${seg('m-view', [{ value: 'grid', icon: 'grid' }, { value: 'list', icon: 'list' }], f.view, { label: '视图' })}
        </div>
      </div>
      <div id="m-results" class="rv"></div>`;

    // featured carousel ------------------------------------------------------------------------------------------
    const slides = $('#ft-slides', view);
    const drawSlide = () => {
      const m = featured[slide];
      slides.innerHTML = `<div class="ft-slide" style="--h:${PROVIDERS[m.provider].hue}">
        <div class="ft-text">
          <span class="eyebrow">${m.isNew ? '本周新上架' : '旗舰推荐'} · ${esc(PROVIDERS[m.provider].name)}</span>
          <h2 class="ft-name">${esc(m.name)}</h2>
          <p class="ft-desc">${esc(m.desc)}</p>
          <div class="ft-specs"><div><span>上下文</span><b>${ctxLabel(m.ctx)}</b></div><div><span>首字延迟</span><b>${fmt.ms(m.ttft)}</b></div><div><span>${m.unit ? '计费' : '输入 / 输出'}</span><b>${m.unit ? esc(m.unit) : `¥${m.pin} / ¥${m.pout}`}</b></div><div><span>评分</span><b>${m.score}</b></div></div>
          <div class="ft-cta"><button type="button" class="btn primary" data-try="${m.id}">${icon('play')}立即试用</button><button type="button" class="btn" data-open="${m.id}">查看详情${icon('right')}</button></div>
        </div>
        <div class="ft-art" aria-hidden="true">${sigil(m, 220)}<i class="ft-halo"></i></div>
      </div>`;
      $('#ft-dots', view).querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === slide));
    };
    drawSlide();
    let rot = setInterval(() => { slide = (slide + 1) % featured.length; drawSlide(); }, 7000);
    const feature = $('#feature', view);
    feature.addEventListener('pointerenter', () => clearInterval(rot));
    feature.addEventListener('pointerleave', () => { clearInterval(rot); rot = setInterval(() => { slide = (slide + 1) % featured.length; drawSlide(); }, 7000); });
    ctx.keep(() => clearInterval(rot));
    $('#ft-dots', view).addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { slide = +b.dataset.s; drawSlide(); } });

    // results ------------------------------------------------------------------------------------------------------
    const results = $('#m-results', view);
    const draw = () => {
      const q = f.q.toLowerCase();
      let list = models.filter((m) => (f.cat === 'all' || m.cat === f.cat) && (!f.fav || state.favorites.has(m.id)) && (!q || (m.name + m.id + m.tags.join(' ') + m.desc + PROVIDERS[m.provider].name).toLowerCase().includes(q)));
      const price = (m) => (m.unit ? 99 : m.pin + m.pout * 0.3);
      list.sort(f.sort === 'new' ? (a, b) => b.released - a.released : f.sort === 'cheap' ? (a, b) => price(a) - price(b) : f.sort === 'fast' ? (a, b) => a.ttft - b.ttft : f.sort === 'score' ? (a, b) => b.score - a.score : (a, b) => b.calls - a.calls);
      if (!list.length) {
        results.innerHTML = `<div class="panel">${empty(f.fav ? '还没有收藏的模型' : '没有匹配的模型', f.fav ? '在模型卡片右上角点亮星标即可收藏。' : '换个关键词，或清除类别筛选。', f.fav ? 'star' : 'search')}<div class="empty-act"><button type="button" class="btn sm" id="m-reset">清除筛选</button></div></div>`;
        $('#m-reset', view).addEventListener('click', reset);
        return;
      }
      results.innerHTML = f.view === 'grid'
        ? `<div class="mgrid">${list.map(card).join('')}</div>`
        : `<div class="panel"><div class="tbl-wrap"><table class="tbl mtable"><thead><tr><th>模型</th><th>类别</th><th class="num">上下文</th><th class="num">输入 / 计费</th><th class="num">输出</th><th class="num">首字</th><th class="num">速度</th><th class="num">可用性</th><th><span class="sr">收藏</span></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div></div>`;
      results.insertAdjacentHTML('afterbegin', `<div class="m-count">${list.length} 个模型${f.cat !== 'all' ? ` · ${catLabel(f.cat)}` : ''}${f.q ? ` · 「${esc(f.q)}」` : ''}</div>`);
    };
    const reset = () => {
      f = { ...f, q: '', cat: 'all', fav: false };
      $('#m-q', view).value = '';
      view.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === 'all'));
      $('#m-fav', view).classList.remove('on');
      draw();
    };
    draw();

    $('#m-q', view).addEventListener('input', debounce((e) => { f.q = e.target.value.trim(); draw(); }, 120));
    view.querySelector('.m-cats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      f.cat = b.dataset.cat;
      view.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    });
    $('#m-sort', view).addEventListener('change', (e) => { f.sort = e.target.value; draw(); });
    $('#m-fav', view).addEventListener('click', (e) => { f.fav = !f.fav; e.currentTarget.classList.toggle('on', f.fav); e.currentTarget.setAttribute('aria-pressed', f.fav); draw(); });
    bindSeg(view, 'm-view', (v) => { f.view = v; saved.set('modelsView', v); draw(); });
    $('#docs-btn', view).addEventListener('click', () => ctx.navigate(`models/${featured[0].id}/code`));

    view.addEventListener('click', (e) => {
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        e.stopPropagation();
        const id = favBtn.dataset.fav;
        const on = toggleFavorite(id);
        favBtn.classList.toggle('on', on);
        favBtn.setAttribute('aria-pressed', on);
        favBtn.classList.add('pop');
        setTimeout(() => favBtn.classList.remove('pop'), 400);
        const m = models.find((x) => x.id === id);
        toast({ kind: on ? 'good' : 'info', title: on ? `已收藏 ${m.name}` : `已取消收藏 ${m.name}`, timeout: 1800 });
        if (f.fav) draw();
        return;
      }
      const tryBtn = e.target.closest('[data-try]');
      if (tryBtn) { e.stopPropagation(); openPlayground(models.find((x) => x.id === tryBtn.dataset.try)); return; }
      const open = e.target.closest('[data-open], .mcard, tr[data-id]');
      if (open) ctx.navigate(`models/${open.dataset.open || open.dataset.id}`);
    });
    view.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('mcard')) { e.preventDefault(); ctx.navigate(`models/${e.target.dataset.id}`); }
    });
    ctx.keep(() => { detailLayer?.close(); detailLayer = null; });
    this.update(ctx.params, ctx);
  },
  update(params, ctx) {
    const [id, tab] = params;
    const m = id && state.models.find((x) => x.id === id);
    if (!m) { detailLayer?.close(); detailLayer = null; return; }
    detailLayer?.close();
    detailLayer = openDetail(m, ctx);
    if (tab === 'code') detailLayer.panel.querySelector('[data-tab="code"]')?.click();
  },
};
