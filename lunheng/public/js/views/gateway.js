// 接入中心: configure providers (keys, base URLs, models, prices) and test real connectivity.
import { h, clear, modal, toast, confirmBox } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { get, post, put, del } from '../api.js';
import { app } from '../main.js';
import { ago, ms, money, tokens } from '../lib/fmt.js';

const KIND_NAME = { openai: 'OpenAI 兼容', anthropic: 'Anthropic Messages', gemini: 'Gemini generateContent', ollama: 'Ollama 原生' };
const AUTH_NAME = { bearer: 'Authorization: Bearer', 'x-api-key': 'x-api-key 头', 'api-key': 'api-key 头（Azure 风格）', 'x-goog-api-key': 'x-goog-api-key 头', 'zhipu-jwt': '智谱 JWT 签名（id.secret）', none: '无需认证' };
const THINK_NAME = { openai: 'OpenAI reasoning_effort', anthropic: 'Claude adaptive / budget', gemini: 'Gemini thinkingConfig', qwen: '通义 enable_thinking', zhipu: '智谱 thinking.type', doubao: '豆包 thinking.type', ollama: 'Ollama think', none: '不发送思考参数' };

const presetOf = (id) => app.meta.presets.find((p) => p.id === id) || app.meta.presets.find((p) => p.id === 'custom-openai');

function monoBadge(preset) {
  return h('div.mono-badge', { style: { '--h': preset.hue ?? 200 } }, preset.monogram);
}

export async function mountGateway(root) {
  let providers = (await get('/api/providers')).providers;
  const grid = h('div.prov-grid');

  const paint = () => {
    if (!providers.length) {
      clear(grid, h('div.panel.empty', { style: { gridColumn: '1 / -1' } }, icon('gateway'), h('h3', {}, '尚未接入任何服务商'), h('p', {}, '点击右上角「添加服务商」，选择平台并填写 API Key。所有请求由服务器发出，密钥加密保存，不会出现在浏览器中。')));
      return;
    }
    clear(grid, ...providers.map((p) => {
      const preset = presetOf(p.presetId);
      const t = p.lastTest;
      return h('article.panel.hud.prov', {},
        h('div.head', {}, monoBadge(preset),
          h('div.grow', {}, h('h3', {}, p.name), h('div.url', {}, p.baseUrl)),
          h('span', { class: `light ${t ? (t.ok ? 'ok' : 'bad') : ''}`, title: t ? `${t.ok ? '连接正常' : '连接失败'} · ${ago(t.at)}` : '尚未测试' })),
        h('div.row.wrap', {},
          h('span.chip', {}, KIND_NAME[p.kind]),
          h('span.chip.mono', {}, p.hasKey ? `KEY ${p.keyHint}` : p.kind === 'ollama' || p.authStyle === 'none' ? '无需密钥' : '⚠ 未设置密钥'),
          h('span.chip.mono', {}, `并发 ${p.concurrency}`),
          p.enabled ? null : h('span.chip', { style: { color: 'var(--amber)' } }, '已停用')),
        h('div.models', {}, ...(p.models.length ? p.models.slice(0, 12).map((m) => h('span.chip.mono', { title: m.price ? `${m.price.input}/${m.price.output} ${m.price.currency} 每百万 token` : '未设置价格' }, m.id)) : [h('span.hint', {}, '尚未添加模型')]),
          p.models.length > 12 ? h('span.chip', {}, `+${p.models.length - 12}`) : null),
        t && !t.ok ? h('div.hint', { style: { color: '#ff9db8' } }, t.message) : null,
        h('div.foot', {},
          h('button.btn.sm', { onclick: () => testDialog(p) }, icon('bolt'), '测试连接'),
          h('button.btn.sm', { onclick: () => editDialog(p) }, icon('edit'), '配置'),
          h('span.grow'),
          h('button.btn.sm.ghost', { title: '删除', onclick: async () => {
            if (!(await confirmBox('删除服务商', `删除「${p.name}」及其加密保存的密钥？使用它的研究将无法继续调用。`, { danger: true, ok: '删除' }))) return;
            await del(`/api/providers/${p.id}`);
            providers = providers.filter((x) => x.id !== p.id);
            paint();
          } }, icon('trash'))));
    }));
  };

  const refresh = async () => { providers = (await get('/api/providers')).providers; paint(); };

  function presetPicker() {
    const m = modal('添加服务商', h('div.col', { style: { gap: '14px' } },
      h('p.dim', { style: { margin: 0 } }, '每个平台按其官方协议与认证方式分别适配；也可以接入任何 OpenAI / Anthropic / Gemini 兼容的第三方中转。'),
      h('div.preset-grid', {}, ...app.meta.presets.map((p) => h('button.preset', { onclick: () => { m.close(); editDialog(null, p); } },
        monoBadge(p), h('div', {}, h('div', {}, p.name), h('small', {}, KIND_NAME[p.kind])))))), { wide: true });
  }

  function editDialog(existing, presetArg) {
    const preset = presetArg || presetOf(existing.presetId);
    const isNew = !existing;
    const v = existing || { name: preset.name, baseUrl: preset.baseUrl, kind: preset.kind, authStyle: preset.authStyle, thinkingStyle: preset.thinkingStyle, streamUsage: true, concurrency: preset.kind === 'ollama' ? 1 : 4, timeoutMs: 900000, idleTimeoutMs: 300000, maxRetries: 3, enabled: true, models: preset.models.map((x) => ({ ...x })), extraQuery: {} };
    const models = v.models.map((x) => ({ ...x, price: x.price ? { ...x.price } : null }));
    const err = h('div.form-error.hidden');
    const f = {
      name: h('input.input', { value: v.name }),
      baseUrl: h('input.input.mono', { value: v.baseUrl, placeholder: 'https://…' }),
      apiKey: h('input.input.mono', { type: 'password', autocomplete: 'off', placeholder: existing?.hasKey ? `已保存 ${existing.keyHint}，留空表示不修改` : preset.keyOptional ? '可选' : '粘贴 API Key' }),
      clearKey: h('input', { type: 'checkbox' }),
      kind: h('select.select', {}, ...Object.entries(KIND_NAME).map(([k, n]) => h('option', { value: k, selected: v.kind === k }, n))),
      authStyle: h('select.select', {}, ...(preset.authStyles || [preset.authStyle]).concat(existing && !(preset.authStyles || []).includes(v.authStyle) ? [v.authStyle] : []).filter((x, i, a) => a.indexOf(x) === i).map((k) => h('option', { value: k, selected: v.authStyle === k }, AUTH_NAME[k] || k))),
      thinkingStyle: h('select.select', {}, ...Object.entries(THINK_NAME).map(([k, n]) => h('option', { value: k, selected: v.thinkingStyle === k }, n))),
      streamUsage: h('input', { type: 'checkbox', checked: v.streamUsage !== false }),
      enabled: h('input', { type: 'checkbox', checked: v.enabled !== false }),
      concurrency: h('input.input.mono', { type: 'number', min: 1, max: 32, value: v.concurrency }),
      maxRetries: h('input.input.mono', { type: 'number', min: 0, max: 8, value: v.maxRetries }),
      timeout: h('input.input.mono', { type: 'number', min: 10, max: 3600, value: Math.round(v.timeoutMs / 1000) }),
      idle: h('input.input.mono', { type: 'number', min: 10, max: 1800, value: Math.round(v.idleTimeoutMs / 1000) }),
      headers: h('textarea.textarea.mono', { rows: 2, placeholder: existing?.headerNames?.length ? `已加密保存：${existing.headerNames.join(', ')}；留空表示不修改，填 {} 表示清除` : '{"HTTP-Referer": "https://example.com"}' }),
      query: h('textarea.textarea.mono', { rows: 1, placeholder: '{"api-version": "2024-10-21"}' }, Object.keys(v.extraQuery || {}).length ? JSON.stringify(v.extraQuery) : ''),
    };
    const modelRows = h('tbody');
    const paintModels = () => clear(modelRows, ...models.map((mm, i) => {
      const price = mm.price || { input: '', output: '', currency: 'USD' };
      const upd = (k, val) => { mm.price = { ...(mm.price || { input: 0, output: 0, currency: 'USD' }), [k]: val }; };
      return h('tr', {},
        h('td', {}, h('input.input.mono', { value: mm.id, placeholder: 'model-id', oninput: (e) => { mm.id = e.target.value.trim(); } })),
        h('td', {}, h('input.input', { value: mm.label || '', placeholder: '显示名称', oninput: (e) => { mm.label = e.target.value; } })),
        h('td', { style: { width: '84px' } }, h('input.input.mono', { type: 'number', step: 'any', min: 0, value: price.input, oninput: (e) => upd('input', e.target.value) })),
        h('td', { style: { width: '84px' } }, h('input.input.mono', { type: 'number', step: 'any', min: 0, value: price.output, oninput: (e) => upd('output', e.target.value) })),
        h('td', { style: { width: '78px' } }, h('select.select', { onchange: (e) => upd('currency', e.target.value) }, h('option', { value: 'USD', selected: price.currency !== 'CNY' }, 'USD'), h('option', { value: 'CNY', selected: price.currency === 'CNY' }, 'CNY'))),
        h('td', { style: { width: '34px' } }, h('button.btn.sm.icon.ghost', { title: '高级参数', onclick: () => extraDialog(mm) }, icon('sliders'))),
        h('td', { style: { width: '34px' } }, h('button.btn.sm.icon.ghost', { title: '移除', onclick: () => { models.splice(i, 1); paintModels(); } }, '✕')));
    }));
    paintModels();

    const fetchBtn = h('button.btn.sm', { disabled: isNew, title: isNew ? '保存后可从服务商拉取模型列表' : '', onclick: async () => {
      fetchBtn.disabled = true;
      try {
        const r = await get(`/api/providers/${existing.id}/models`);
        const have = new Set(models.map((x) => x.id));
        pickModels(r.models.filter((x) => !have.has(x.id)), (chosen) => { models.push(...chosen.map((x) => ({ id: x.id, label: x.label, price: null }))); paintModels(); });
      } catch (e) { toast(`拉取失败：${e.message}`, 'err'); } finally { fetchBtn.disabled = false; }
    } }, icon('download'), '拉取模型列表');

    const field = (label, el, hint) => h('label.field', {}, h('span', {}, label), el, hint ? h('span.hint', {}, hint) : null);
    const altUrls = (preset.altBaseUrls || []).length ? h('div.row.wrap', {}, h('span.hint', {}, '快速切换：'), h('button.btn.xs', { type: 'button', onclick: () => { f.baseUrl.value = preset.baseUrl; } }, '默认'), ...preset.altBaseUrls.map((a) => h('button.btn.xs', { type: 'button', onclick: () => { f.baseUrl.value = a.url; } }, a.label))) : null;

    const body = h('div.col', { style: { gap: '16px' } },
      h('div.row', {}, monoBadge(preset), h('div', {}, h('div', { style: { fontWeight: 600 } }, preset.name), h('div.hint', {}, `${KIND_NAME[preset.kind]} 协议`)), h('span.grow'),
        preset.keyUrl ? h('a.btn.sm', { href: preset.keyUrl, target: '_blank', rel: 'noopener noreferrer' }, '获取 API Key ↗') : null,
        preset.docsUrl ? h('a.btn.sm.ghost', { href: preset.docsUrl, target: '_blank', rel: 'noopener noreferrer' }, '接口文档 ↗') : null),
      preset.note ? h('div.hint', { style: { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '8px' } }, preset.note) : null,
      h('div.grid2', {}, field('名称', f.name), field('Base URL', f.baseUrl, null)),
      altUrls,
      h('div.grid2', {},
        field('API Key', f.apiKey, '仅在服务器端使用并以 AES-256-GCM 加密存储；保存后不会再显示明文。'),
        h('div.col', {}, field('认证方式', f.authStyle), existing?.hasKey ? h('label.check', {}, f.clearKey, '清除已保存的密钥') : null)),
      preset.custom ? h('div.grid2', {}, field('协议', f.kind), field('思考参数风格', f.thinkingStyle)) : null,
      h('div', {},
        h('div.row', { style: { marginBottom: '6px' } }, h('div.sub', { style: { margin: 0 } }, 'MODELS · 模型与价格（每百万 token）'), h('span.grow'), fetchBtn,
          h('button.btn.sm', { onclick: () => { models.push({ id: '', label: '', price: null }); paintModels(); } }, icon('plus'), '添加模型')),
        h('table.model-table', {}, h('thead', {}, h('tr', {}, h('th', {}, '模型 ID'), h('th', {}, '名称'), h('th', {}, '输入价'), h('th', {}, '输出价'), h('th', {}, '币种'), h('th'), h('th'))), modelRows),
        h('div.hint', { style: { marginTop: '6px' } }, '价格用于费用估算与预算限制，默认值为各平台公开参考价，可按实际账单修改；未填价格的模型只受 Token 上限约束。')),
      h('details', {}, h('summary', { style: { cursor: 'pointer', color: 'var(--dim)', fontSize: '12.5px' } }, '高级设置：并发、超时、重试、自定义请求头'),
        h('div.col', { style: { gap: '12px', marginTop: '12px' } },
          h('div.grid4', {}, field('并发上限', f.concurrency), field('失败重试次数', f.maxRetries), field('总超时（秒）', f.timeout), field('无数据超时（秒）', f.idle)),
          h('div.row.wrap', { style: { gap: '18px' } }, h('label.check', {}, f.streamUsage, '请求流式用量（stream_options）'), h('label.check', {}, f.enabled, '启用该服务商'), !preset.custom ? h('span.hint', {}, `思考参数：${THINK_NAME[v.thinkingStyle] || v.thinkingStyle}`) : null),
          field('自定义请求头（JSON，值将加密保存）', f.headers, '例如 OpenRouter 的 HTTP-Referer / X-Title，或中转要求的额外头。'),
          field('附加查询参数（JSON）', f.query, '例如 Azure OpenAI 的 api-version。'))),
      err);

    const save = async () => {
      err.classList.add('hidden');
      try {
        const payload = {
          name: f.name.value.trim(), baseUrl: f.baseUrl.value.trim(), authStyle: f.authStyle.value,
          streamUsage: f.streamUsage.checked, enabled: f.enabled.checked,
          concurrency: +f.concurrency.value, maxRetries: +f.maxRetries.value, timeoutMs: +f.timeout.value * 1000, idleTimeoutMs: +f.idle.value * 1000,
          models: models.filter((x) => x.id).map((x) => ({ ...x, price: x.price && x.price.input !== '' && x.price.output !== '' ? { input: +x.price.input, output: +x.price.output, currency: x.price.currency || 'USD' } : null })),
          extraQuery: f.query.value.trim() || {},
        };
        if (preset.custom) { payload.kind = f.kind.value; payload.thinkingStyle = f.thinkingStyle.value; }
        if (f.apiKey.value.trim()) payload.apiKey = f.apiKey.value.trim();
        if (f.clearKey.checked) payload.clearKey = true;
        if (f.headers.value.trim()) payload.extraHeaders = f.headers.value.trim();
        if (isNew) {
          payload.presetId = preset.id;
          if (preset.custom) payload.vendor = payload.name;
          const r = await post('/api/providers', payload);
          toast(`已添加 ${r.provider.name}`, 'ok');
        } else {
          await put(`/api/providers/${existing.id}`, payload);
          toast('已保存', 'ok');
        }
        m.close();
        await refresh();
      } catch (e) {
        err.textContent = e.message;
        err.classList.remove('hidden');
      }
    };
    const m = modal(isNew ? `添加 · ${preset.name}` : `配置 · ${existing.name}`, body, { wide: true, foot: [h('button.btn', { onclick: () => m.close() }, '取消'), h('button.btn.primary', { onclick: save }, isNew ? '添加' : '保存')] });
  }

  function extraDialog(mm) {
    const ta = h('textarea.textarea.mono', { rows: 6, placeholder: '{"reasoning_effort": "high"}' }, mm.extraBody && Object.keys(mm.extraBody).length ? JSON.stringify(mm.extraBody, null, 2) : '');
    const ctxIn = h('input.input.mono', { type: 'number', min: 1024, value: mm.contextWindow || '', placeholder: 'Ollama num_ctx，默认 16384' });
    const err = h('div.form-error.hidden');
    const m = modal(`高级参数 · ${mm.id || '模型'}`, h('div.col', { style: { gap: '12px' } },
      h('label.field', {}, h('span', {}, '附加请求体字段（JSON，原样合并进请求）'), ta, h('span.hint', {}, '用于厂商特有参数，例如 {"enable_thinking": true}、{"thinking": {"type": "enabled"}}、{"top_p": 0.9}。')),
      h('label.field', {}, h('span', {}, '上下文窗口（仅 Ollama）'), ctxIn),
      h('label.check', {}, h('input', { type: 'checkbox', checked: !!mm.reasoning, onchange: (e) => { mm.reasoning = e.target.checked; } }), '推理模型'),
      err), {
      foot: [h('button.btn', { onclick: () => m.close() }, '取消'), h('button.btn.primary', { onclick: () => {
        try {
          mm.extraBody = ta.value.trim() ? JSON.parse(ta.value) : {};
          mm.contextWindow = ctxIn.value ? +ctxIn.value : undefined;
          m.close();
        } catch { err.textContent = 'JSON 格式错误'; err.classList.remove('hidden'); }
      } }, '确定')],
    });
  }

  function pickModels(list, onPick) {
    if (!list.length) { toast('没有新的模型可添加'); return; }
    const chosen = new Set();
    const filter = h('input.input', { placeholder: '筛选…' });
    const box = h('div.col', { style: { maxHeight: '52vh', overflow: 'auto', gap: '2px' } });
    const paintList = () => clear(box, ...list.filter((x) => x.id.toLowerCase().includes(filter.value.toLowerCase())).map((x) =>
      h('label.check', { style: { padding: '4px 2px' } }, h('input', { type: 'checkbox', checked: chosen.has(x), onchange: (e) => { e.target.checked ? chosen.add(x) : chosen.delete(x); } }), h('span.mono', {}, x.id), x.label && x.label !== x.id ? h('span.dim', {}, x.label) : null)));
    filter.addEventListener('input', paintList);
    paintList();
    const m = modal(`可用模型（${list.length}）`, h('div.col', {}, filter, box), {
      foot: [h('button.btn', { onclick: () => m.close() }, '取消'), h('button.btn.primary', { onclick: () => { onPick([...chosen]); m.close(); } }, '添加所选')],
    });
  }

  function testDialog(p) {
    const sel = h('select.select', {}, ...p.models.map((x) => h('option', { value: x.id }, x.id)));
    const custom = h('input.input.mono', { placeholder: '或输入其他模型 ID' });
    const out = h('div.test-out', {}, '发送一条最小的流式请求，验证 Base URL、认证方式与模型 ID 是否可用。');
    const go = h('button.btn.primary', { onclick: async () => {
      go.disabled = true;
      out.className = 'test-out';
      out.textContent = '正在调用…';
      try {
        const r = await post(`/api/providers/${p.id}/test`, { modelId: custom.value.trim() || sel.value });
        if (r.ok) {
          out.className = 'test-out ok';
          out.textContent = `✓ 连接成功 · 模型 ${r.servedModel}\n总耗时 ${ms(r.latencyMs)} · 首 token ${ms(r.firstTokenMs)}\n回复：${r.text}${r.thinking ? `\n思考：${r.thinking.slice(0, 120)}…` : ''}\nToken：输入 ${tokens(r.usage.inputTokens)} / 输出 ${tokens(r.usage.outputTokens)}${r.usage.estimated ? '（估算）' : ''} · 费用 ${money(r.costUsd, 6)}${r.repairs ? `\n已自动适配 ${r.repairs} 处参数差异（已记住）` : ''}`;
        } else {
          out.className = 'test-out bad';
          out.textContent = `✗ ${r.error.summary}`;
        }
        refresh();
      } catch (e) {
        out.className = 'test-out bad';
        out.textContent = `✗ ${e.message}`;
      } finally { go.disabled = false; }
    } }, icon('bolt'), '发送测试请求');
    modal(`测试连接 · ${p.name}`, h('div.col', { style: { gap: '12px' } }, h('div.grid2', {}, sel, custom), go, out));
  }

  clear(root, h('div.page', {},
    h('header.page-head', {},
      h('div', {}, h('div.eyebrow', {}, 'MODEL GATEWAY'), h('h1', {}, '接入中心'), h('p', {}, '多平台 API 接入：每家按其原生协议、认证方式与参数差异分别适配，支持同时配置多个服务商与 OpenAI 兼容中转。')),
      h('div.actions', {}, h('button.btn.primary', { onclick: presetPicker }, icon('plus'), '添加服务商'))),
    grid));
  paint();
  return null;
}
