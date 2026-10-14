// Minimal MCP server (JSON-RPC 2.0 over stdio, newline-delimited). Exposes the same tools as the
// CLI so MCP clients (Claude Desktop, Claude Code, Cursor, …) can drive Motif directly.
import { toolSchemas, callTool } from './tools.js';
import { catalogMarkdown, sceneMarkdown, themesMarkdown, opsMarkdown } from '../core/catalog/docs.js';

const RESOURCES = {
  'motif://docs/components': ['组件目录', catalogMarkdown],
  'motif://docs/scene': ['版式、转场、动画', sceneMarkdown],
  'motif://docs/themes': ['主题', themesMarkdown],
  'motif://docs/ops': ['编辑操作', opsMarkdown],
};

export function startMcp(version = '0.0.0') {
  let buf = '';
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
  // Keep stdout clean for the protocol.
  console.log = (...a) => process.stderr.write(a.join(' ') + '\n');
  // The client going away (closed pipe) ends the session quietly; pending work finishes first.
  // Exit only once stdout has flushed: pipe writes are asynchronous on Windows, and exiting
  // straight away would drop the replies still queued.
  let pending = 0, ended = false;
  const maybeExit = () => { if (ended && pending === 0) process.stdout.write('', () => process.exit(0)); };
  process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); });
  process.stdin.on('end', () => { ended = true; maybeExit(); });
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { fail(null, -32700, 'Parse error'); continue; }
      pending++;
      handle(msg).catch((e) => fail(msg.id, -32603, e.message)).finally(() => { pending--; maybeExit(); });
    }
  });
  async function handle(msg) {
    const { id, method, params } = msg;
    switch (method) {
      case 'initialize':
        return reply(id, { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: { listChanged: false }, resources: {} }, serverInfo: { name: 'motif', title: '律影 Motif', version }, instructions: '律影 Motif：用结构化文档创作动态视觉作品（视频/演示）。流程：motif_list_templates/motif_catalog 了解能力 → motif_create_project 或 motif_auto_create → motif_get_project → motif_apply_ops 修改 → motif_lint + motif_preview 检查 → motif_export 导出。' });
      case 'notifications/initialized': case 'notifications/cancelled': return undefined;
      case 'ping': return reply(id, {});
      case 'tools/list': return reply(id, { tools: toolSchemas('mcp') });
      case 'tools/call': {
        try {
          const { content } = await callTool(params.name, params.arguments || {});
          return reply(id, { content, isError: false });
        } catch (e) {
          return reply(id, { content: [{ type: 'text', text: `错误：${e.message}${e.hint ? `\n提示：${e.hint}` : ''}` }], isError: true });
        }
      }
      case 'resources/list': return reply(id, { resources: Object.entries(RESOURCES).map(([uri, [name]]) => ({ uri, name, mimeType: 'text/markdown' })) });
      case 'resources/read': { const r = RESOURCES[params?.uri]; if (!r) return fail(id, -32602, 'unknown resource'); return reply(id, { contents: [{ uri: params.uri, mimeType: 'text/markdown', text: r[1]() }] }); }
      default:
        if (id != null) fail(id, -32601, `Method not found: ${method}`);
    }
  }
}
