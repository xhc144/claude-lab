#!/usr/bin/env node
// Endpoint probe: sends one minimal streaming request to every built-in platform using the same
// adapters the gateway uses.
//
//   npm run probe                      → invalid key: checks reachability, path and auth-header handling
//   LUNHENG_KEY_ANTHROPIC=sk-ant-… npm run probe -- anthropic
//                                      → real key: performs an actual completion and prints the reply
//
// Environment keys: LUNHENG_KEY_<PRESET> (OPENAI, ANTHROPIC, GEMINI, DEEPSEEK, QWEN, KIMI, ZHIPU, DOUBAO, GROK, OLLAMA)
// Optional model override: LUNHENG_MODEL_<PRESET>; base URL override: LUNHENG_URL_<PRESET>.
import { PRESETS } from '../server/providers/presets.mjs';
import { ADAPTERS } from '../server/providers/gateway.mjs';
import { classifyHttpError, fromNetworkError, redact } from '../server/providers/errors.mjs';

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const presets = PRESETS.filter((p) => !p.custom && (!only.length || only.includes(p.id)));
const DUMMY = 'lunheng-probe-invalid-key-000000';

async function probe(preset) {
  const env = preset.id.toUpperCase();
  const key = process.env[`LUNHENG_KEY_${env}`] || '';
  const baseUrl = process.env[`LUNHENG_URL_${env}`] || preset.baseUrl;
  const modelId = process.env[`LUNHENG_MODEL_${env}`] || preset.models[0]?.id || (preset.kind === 'ollama' ? 'llama3.1' : '');
  const provider = { ...preset, presetId: preset.id, baseUrl, extraHeaders: {} };
  const adapter = ADAPTERS[preset.kind];
  const apiKey = key || (preset.kind === 'ollama' ? '' : DUMMY);
  const { url, init } = adapter.buildRequest({
    provider, model: { id: modelId }, apiKey,
    req: { system: 'Connectivity probe.', messages: [{ role: 'user', content: 'Reply with exactly: OK' }], maxTokens: 512, temperature: null, thinking: 'off' },
  });
  const started = Date.now();
  const signal = AbortSignal.timeout(30_000);
  try {
    const res = await fetch(url, { ...init, signal });
    if (!res.ok) {
      const raw = await res.text();
      let payload = raw;
      try { payload = JSON.parse(raw); } catch { /* text */ }
      const err = classifyHttpError(res.status, payload, res.headers);
      const msg = redact(err.message, [apiKey]).slice(0, 140);
      if (!key && err.kind === 'auth') return { preset, ok: true, status: res.status, note: `端点可达，认证被识别并拒绝（使用无效密钥，符合预期）：${msg}` };
      return { preset, ok: false, status: res.status, note: `${err.summary.slice(0, 200)}` };
    }
    let text = '';
    const out = await adapter.parseStream(res, (d) => { if (d.type === 'text') text += d.text; });
    return { preset, ok: true, status: res.status, note: `真实调用成功 ${Date.now() - started}ms · 回复 ${JSON.stringify(out.text.trim().slice(0, 60))} · tokens ${out.usage ? `${out.usage.inputTokens}/${out.usage.outputTokens}` : '未返回'}` };
  } catch (e) {
    const err = fromNetworkError(e, { timedOut: signal.aborted });
    return { preset, ok: false, status: 0, note: `无法连接：${err.message.slice(0, 160)}` };
  }
}

console.log(`论衡端点探测 · ${new Date().toISOString()}\n`);
const results = await Promise.all(presets.map(probe));
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.preset.name.padEnd(22)} ${String(r.status || '—').padStart(3)}  ${r.note}`);
}
console.log('\n说明：未提供密钥时使用无效密钥，只验证网络可达性、请求路径与认证头格式；返回“认证失败”即表示该平台的协议适配与网络链路正常。');
