#!/usr/bin/env node
// Verifies the in-app AI assistant loop end to end with scripted mock models (OpenAI-compatible
// and Anthropic wire formats): tool calls → real project edits → live editor update → reply.
import { _electron as electron } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));
const outDir = path.join(root, 'out/e2e');
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-ai-'));
const env = { ...process.env, MOTIF_HOME: path.join(tmp, 'library'), MOTIF_USER_DATA: path.join(tmp, 'userdata') };
delete env.ELECTRON_RUN_AS_NODE;

// ── scripted model: inspect → edit → lint → answer ──
const seen = { openai: [], anthropic: [] };
function script(step, lastToolText) {
  if (step === 0) return { tool: 'motif_get_project', args: {} };
  if (step === 1) {
    const sceneId = /"id":\s*"(s_[a-z0-9]+)"/.exec(lastToolText || '')?.[1] || 1;
    return { tool: 'motif_apply_ops', args: { ops: [{ op: 'add_scene', scene: { title: 'AI 添加的关键数字', stats: [{ value: 120, suffix: '家', label: '内测企业' }, { value: 3, suffix: '倍', label: '效率提升' }] }, after: sceneId }], message: 'AI：补充关键数字页' } };
  }
  if (step === 2) return { tool: 'motif_lint', args: {} };
  return { text: '已在第 1 个场景后加入「关键数字」页（2 个数字），设计检查通过。' };
}
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const j = JSON.parse(body || '{}');
    if (req.url.endsWith('/chat/completions')) {
      seen.openai.push(j);
      const toolMsgs = j.messages.filter((m) => m.role === 'tool');
      const step = toolMsgs.length;
      const s = script(step, toolMsgs[toolMsgs.length - 1]?.content);
      const message = s.tool
        ? { role: 'assistant', content: step === 0 ? '我先看一下作品结构。' : '', tool_calls: [{ id: `call_${step}`, type: 'function', function: { name: s.tool, arguments: JSON.stringify(s.args) } }] }
        : { role: 'assistant', content: s.text };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message, finish_reason: s.tool ? 'tool_calls' : 'stop' }], usage: {} }));
    } else if (req.url.endsWith('/v1/messages')) {
      seen.anthropic.push(j);
      const results = j.messages.flatMap((m) => (Array.isArray(m.content) ? m.content.filter((c) => c.type === 'tool_result') : []));
      const step = results.length;
      const last = results[results.length - 1];
      const s = script(step, last?.content?.map?.((c) => c.text).join('') || '');
      const content = s.tool ? [{ type: 'tool_use', id: `tu_${step}`, name: s.tool, input: s.args }] : [{ type: 'text', text: s.text }];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content, stop_reason: s.tool ? 'tool_use' : 'end_turn', usage: {} }));
    } else { res.statusCode = 404; res.end('{}'); }
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--use-angle=swiftshader'], env, timeout: 60000 });
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const call = (m, ...a) => page.evaluate(([m, a]) => window.motif.call(m, ...a), [m, a]);

try {
  await page.waitForSelector('.home');
  for (const kind of ['openai', 'anthropic']) {
    const prov = await call('ai.saveProvider', { name: `Mock ${kind}`, kind, preset: 'custom', baseUrl: kind === 'openai' ? `http://127.0.0.1:${port}/v1` : `http://127.0.0.1:${port}`, model: 'mock-1', key: 'sk-test-123456', makeActive: true });
    const p = prov.providers.find((x) => x.name === `Mock ${kind}`);
    check(`${kind}: key stored encrypted, never returned`, p.hasKey && !JSON.stringify(prov).includes('sk-test-123456'), p.keyHint);
    const cfg = fs.readFileSync(path.join(env.MOTIF_USER_DATA, 'config.json'), 'utf8');
    check(`${kind}: config file has no plaintext key`, !cfg.includes('sk-test-123456'));
    await call('ai.setActive', p.id);

    const r = await call('project.create', { title: `AI 测试 ${kind}`, template: 'pitch' });
    await page.evaluate((id) => { sessionStorage.setItem('motif.route', JSON.stringify({ view: 'editor', id })); location.reload(); }, r.id);
    await page.waitForSelector('.editor .stage-canvas', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const before = await page.locator('.scene-item').count();
    await page.locator('.titlebar .btn.ai').click();
    await page.waitForSelector('.ai-input textarea');
    await page.fill('.ai-input textarea', '在第一页后面加一页关键数字：内测 120 家企业，效率提升 3 倍');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=设计检查通过', { timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, `20-ai-${kind}.png`) });
    const after = await page.locator('.scene-item').count();
    check(`${kind}: assistant added a scene, editor updated live`, after === before + 1, `${before} → ${after}`);
    const disk = await call('project.open', r.id);
    const added = disk.doc.scenes[1];
    check(`${kind}: scene written through ops with AI authorship`, added?.blocks.some((b) => b.type === 'stats') && disk.doc.meta.lastAuthor === 'ai');
    const steps = await page.locator('.ai-step').count();
    check(`${kind}: tool steps shown in chat`, steps >= 3, `${steps} steps`);
    const hist = await call('history.list', r.id);
    check(`${kind}: history records the AI edit`, hist.some((h) => h.author === 'ai' && /关键数字/.test(h.message)), hist[0]?.message);
  }
  const sys = seen.openai[0]?.messages?.[0]?.content || '';
  check('system prompt carries the live project summary', /当前项目/.test(sys) && /prj_/.test(sys));
  check('tools offered in both wire formats', seen.openai[0]?.tools?.length >= 15 && seen.anthropic[0]?.tools?.length >= 15, `${seen.openai[0]?.tools?.length} / ${seen.anthropic[0]?.tools?.length}`);
} catch (e) {
  check('ai workflow', false, e.message.split('\n')[0]);
  await page.screenshot({ path: path.join(outDir, 'ai-error.png') }).catch(() => {});
} finally {
  if (errors.length) console.log('renderer errors:', [...new Set(errors)].slice(0, 8));
  await app.close().catch(() => {});
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
