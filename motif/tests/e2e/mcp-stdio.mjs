#!/usr/bin/env node
// Drives the MCP server the way MCP clients (Claude Code, Claude Desktop, Codex, Cursor…) do:
// spawn the command with stdio pipes, speak newline-delimited JSON-RPC, then close stdin.
//   node tests/e2e/mcp-stdio.mjs                       → this checkout (Electron runtime + dist/cli.mjs)
//   node tests/e2e/mcp-stdio.mjs <Motif.exe> <cli.mjs> → a packaged build
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));
const [command, ...args] = process.argv.length > 2 ? process.argv.slice(2).map((a) => (fs.existsSync(a) ? path.resolve(a) : a)) : [require('electron'), path.join(root, 'dist/cli.mjs')];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-mcp-'));
const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', MOTIF_HOME: path.join(tmp, 'library'), MOTIF_USER_DATA: path.join(tmp, 'userdata') };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };
const watchdog = setTimeout(() => { console.log(`✗ watchdog: no finish after 3 min (last check: ${results.at(-1)?.name || 'none'})`); child.kill(); process.exit(2); }, 3 * 60 * 1000);
watchdog.unref();

const child = spawn(command, [...args, 'mcp'], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
let stderr = '';
child.stderr.on('data', (d) => { stderr += d; });
const exited = new Promise((r) => child.on('exit', (code) => r(code)));

// Replies are matched to requests by id.
const waiting = new Map();
let buf = '', nextId = 1;
child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    waiting.get(msg.id)?.(msg);
    waiting.delete(msg.id);
  }
});
const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
const request = (method, params) => {
  const id = nextId++;
  const reply = new Promise((resolve, reject) => {
    waiting.set(id, resolve);
    exited.then((code) => reject(new Error(`server exited (${code}) before answering ${method}${stderr ? `: ${stderr.trim().slice(-400)}` : ''}`)));
  });
  send({ id, method, params });
  return reply;
};
const tool = async (name, a = {}) => {
  const r = await request('tools/call', { name, arguments: a });
  if (r.error) throw new Error(`${name}: ${r.error.message}`);
  return r.result;
};

try {
  const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'motif-e2e', version: '1' } });
  check('initialize', init.result?.serverInfo?.name === 'motif', `${init.result?.serverInfo?.title} ${init.result?.serverInfo?.version}`);
  send({ method: 'notifications/initialized' });

  const list = await request('tools/list', {});
  const tools = list.result?.tools || [];
  check('tools/list returns every tool with a schema', tools.length >= 20 && tools.every((t) => t.inputSchema?.type === 'object'), `${tools.length} tools`);

  const created = await tool('motif_create_project', { title: 'MCP 测试', template: 'launch' });
  const id = /"id":\s*"(prj_[a-z0-9]+)"/.exec(created.content[0].text)?.[1];
  check('motif_create_project', !created.isError && !!id, id);

  const applied = await tool('motif_apply_ops', { project: id, ops: [{ op: 'update_scene', scene: 1, set: { name: '经 MCP 修改' } }], message: 'MCP e2e' });
  check('motif_apply_ops', !applied.isError, applied.content[0].text.split('\n').slice(0, 3).join(' ').slice(0, 80));

  const lint = await tool('motif_lint', { project: id });
  check('motif_lint', !lint.isError && /"error":\s*0/.test(lint.content[0].text), lint.content[0].text.replace(/\s+/g, ' ').slice(0, 80));

  const still = await tool('motif_render_still', { project: id, scene: '1' });
  const img = still.content.find((c) => c.type === 'image');
  check('motif_render_still returns an image', !still.isError && img?.data?.length > 10000, img ? `${img.mimeType}, ${Math.round(img.data.length * 0.75 / 1024)} KB` : still.content[0].text.slice(0, 120));

  const bad = await tool('motif_get_project', { project: 'prj_missing' });
  check('tool errors come back as isError results', bad.isError === true);

  const docs = await request('resources/read', { uri: 'motif://docs/ops' });
  check('resources/read', /update_block/.test(docs.result?.contents?.[0]?.text || ''));

  // A client closing the pipe ends the session cleanly.
  child.stdin.end();
  const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r('timeout'), 15000))]);
  check('server exits when the client disconnects', code === 0, `exit ${code}`);
} catch (e) {
  check('mcp session', false, e.message.split('\n')[0]);
} finally {
  if (child.exitCode === null) child.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
if (failed.length && stderr) console.log('server stderr:\n' + stderr.trim().slice(-2000));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
