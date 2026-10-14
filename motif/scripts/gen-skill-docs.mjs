#!/usr/bin/env node
// Regenerates the Skill's reference docs, tool schemas and examples from the live software
// (catalog, themes, ops, CLI help, showcase documents) so the Skill can never drift from what
// Motif actually accepts. Run after `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(root, 'skill/motif');
const cli = path.join(root, 'dist/cli.mjs');
if (!fs.existsSync(cli)) { console.error('先运行 npm run build'); process.exit(1); }
const run = (...a) => execFileSync(process.execPath, [cli, ...a], { encoding: 'utf8', env: { ...process.env, MOTIF_HOME: path.join(root, 'out/.gen-lib') }, maxBuffer: 64 << 20 });
const write = (rel, text) => { const f = path.join(skill, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text.endsWith('\n') ? text : text + '\n'); console.log('  ' + rel); };

console.log('Skill → ' + path.relative(root, skill));
write('reference/components.md', run('catalog'));
write('reference/scene.md', run('catalog', 'scene'));
write('reference/themes.md', run('catalog', 'themes'));
write('reference/ops.md', run('catalog', 'ops'));

const help = run('help');
write('reference/cli.md', `# CLI 参考（自动生成）

\`\`\`
${help.trim()}
\`\`\`

## 机器可读输出

- 任何命令加 \`--json\` 输出 JSON；失败时输出 \`{"ok": false, "error": "…", "hint": "…"}\`。
- 退出码：\`0\` 成功；\`2\` 参数/用法错误；\`3\` 操作失败或检查有 error（项目保持不变）；其他为运行错误。
- \`apply\` / \`write\` 的结果：\`{ ok, saved, revision, results: [{op, ok, id, error, hint}], warnings, issues }\`。\`results[i].id\` 是新建或修改的场景/块 ID。
- \`lint\` 的结果：\`{ duration, scenes: [...], issues: [{level, scene, sceneIndex, block, message, hint}], counts }\`。
- \`show --json\` 返回摘要与全部 ID；\`show --full --json\` 返回完整文档。

## 直接调用工具

\`motif call <工具名> '<参数 JSON>'\` 与 MCP 工具完全相同，例如：

\`\`\`bash
motif call motif_apply_ops '{"project":"季度复盘","ops":[{"op":"set_theme","theme":"swiss"}]}'
\`\`\`

工具清单见 \`tools/\`。
`);

const tools = { openai: JSON.parse(run('tools', '--format', 'openai', '--json')), anthropic: JSON.parse(run('tools', '--format', 'anthropic', '--json')), mcp: JSON.parse(run('tools', '--format', 'mcp', '--json')) };
for (const [k, v] of Object.entries(tools)) write(`tools/${k}.json`, JSON.stringify(v, null, 2));
write('tools/README.md', `# 工具定义（函数调用）

Motif 的全部能力以 ${tools.mcp.length} 个工具暴露，三种格式内容相同：

| 文件 | 用于 |
| --- | --- |
| \`openai.json\` | OpenAI 兼容的 function calling：OpenAI、DeepSeek、通义千问（DashScope 兼容模式）、Kimi、智谱 GLM、Ollama、LM Studio… |
| \`anthropic.json\` | Anthropic Messages API 的 \`tools\` 参数 |
| \`mcp.json\` | MCP \`tools/list\` 的结果（也可直接运行 \`motif mcp\` 启动 MCP 服务器） |

## 执行工具调用

模型返回工具调用后，用 CLI 执行并把输出作为工具结果返回给模型：

\`\`\`bash
motif call <name> '<arguments JSON>' --json
\`\`\`

渲染类工具（\`motif_preview\`、\`motif_render_still\`）的结果里有 \`out\` 图片路径；支持识图的模型可以把图片一并回传，用于自我检查。

## 工具一览

${tools.mcp.map((t) => `- \`${t.name}\`：${t.description}`).join('\n')}

## 接入 MCP

\`\`\`bash
claude mcp add motif -- motif mcp          # Claude Code
\`\`\`

其他客户端（Codex、Claude Desktop、Cursor、Cherry Studio…）在 MCP 配置中添加命令 \`motif mcp\`。Motif 应用的「设置 → AI 集成」会给出本机的完整配置。
`);

// examples: showcase documents + op batches
const ex = path.join(root, 'examples/showcase');
const list = [];
if (fs.existsSync(ex)) {
  for (const f of fs.readdirSync(ex).filter((x) => x.endsWith('.json')).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(ex, f), 'utf8'));
    write(`examples/${f}`, JSON.stringify(doc, null, 2));
    list.push({ f, doc });
  }
}
for (const f of fs.readdirSync(path.join(root, 'examples/ops')).filter((x) => x.endsWith('.json'))) {
  write(`examples/ops/${f}`, fs.readFileSync(path.join(root, 'examples/ops', f), 'utf8'));
}
write('examples/README.md', `# 示例

完整作品文档（可直接 \`motif new "标题" --from <文件> --json\` 创建，然后 lint / preview / export）：

| 文件 | 作品 | 主题 · 画幅 | 场景 | 展示的能力 |
| --- | --- | --- | --- | --- |
${list.map(({ f, doc }) => `| \`${f}\` | ${doc.title} | ${doc.theme?.id || doc.theme} · ${doc.aspect || doc.format?.aspect || '16:9'} | ${doc.scenes.length} | ${doc.meta?.description || ''} |`).join('\n')}

编辑操作示例（\`motif apply <项目> <文件>\`）在 \`ops/\` 中，每个文件开头的 \`//\` 说明在 JSON 外的 README 里：

- \`ops/refine.json\`：精简文案、改版式、加章节页、调整节奏
- \`ops/restyle.json\`：换主题与强调色、改为竖屏、提高能量
- \`ops/data-update.json\`：更新图表数据、加注释、强调最新一期

典型流程：

\`\`\`bash
motif new "Motif Cloud 发布" --from examples/01-product-launch.json --agent claude --json
motif lint "Motif Cloud 发布" --json
motif preview "Motif Cloud 发布" --out sheet.jpg
motif export "Motif Cloud 发布" --format mp4 --quality high --json
\`\`\`
`);
fs.rmSync(path.join(root, 'out/.gen-lib'), { recursive: true, force: true });
console.log('done');
