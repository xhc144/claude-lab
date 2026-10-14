// motif — command line interface. Every command supports --json for machine-readable output.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as cmd from './commands.js';
import { toolSchemas, TOOLS, callTool } from './tools.js';
import { startMcp } from './mcp.js';
import { electronCommand } from './worker.js';

const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

const HELP = {
  _: `律影 Motif ${VERSION} — 动态视觉创作 CLI（人类与 AI 共用）

用法: motif <命令> [参数] [--json]

项目
  list                                 列出素材库中的项目
  new [标题] [--template ID] [--theme ID] [--aspect 16:9] [--accent #hex] [--from doc.json]
  show <项目> [--full]                  查看摘要（--full 输出完整 JSON）
  apply <项目> <ops.json | ->           应用编辑操作（原子；- 表示从标准输入读取）
  write <项目> <doc.json | ->           用完整文档替换内容
  validate <项目 | doc.json>            结构校验
  open <项目>                           在编辑器中打开
  delete <项目>                         移入回收站
  duplicate <项目> [--title]

检查与渲染
  lint <项目>                           设计检查（溢出/重叠/密度/时长/对比度/节奏）
  preview <项目> [--out sheet.png]      渲染全部场景联系表
  still <项目> [--scene N] [--at end|start|mid|秒] [--out f.png] [--scale 1]
  export <项目> [--format mp4|webm|mov|gif|png|pdf|html] [--out 路径] [--quality high|standard|small]
                [--fps 30] [--width 1920] [--range 0,10] [--mute]
  thumb <项目>                          更新库缩略图

素材与智能设计
  analyze <文件…>                       分析 pptx/docx/xlsx/pdf/md/txt/csv/json/图片 → 结构化大纲
  auto <文件…> [--title] [--theme] [--aspect]   分析 + 自动设计 → 新项目
  assets <项目> [list | add <文件…> | remove <ID…>]

复用与历史
  templates [list | show <ID> | save <项目> --name 名称 | delete <ID>]
  components [list | show <ID> | save <项目> --block <ID>|--scene <N> --name 名称 | insert <项目> --component <ID> [--scene N] | delete <ID>]
  themes [list | show <ID> | save <theme.json>]
  history <项目> [list | restore <修订> | name <标签> | show <修订>]

参考与集成
  catalog [组件类型 | scene | themes | ops]   组件/版式/主题/操作参考文档
  icons [--search 关键词]               可用图标名
  schema                               文档与操作的结构说明（JSON）
  tools [--format mcp|openai|anthropic] 输出工具定义（函数调用）
  call <工具名> <参数JSON>               直接调用一个工具（与 MCP 相同）
  mcp                                  启动 MCP 服务器（stdio）
  config [键] [值]                      查看/设置配置（library、ffmpegPath）
  doctor                               环境检查

全局参数
  --json            输出 JSON
  --library <目录>  指定素材库（等同环境变量 MOTIF_HOME）
  --agent <名称>    写入历史的作者名（默认 ai；环境变量 MOTIF_AGENT）
  -m, --message     写入历史的说明

示例
  motif new "季度复盘" --template annual-report --theme editorial
  echo '[{"op":"set_theme","theme":"swiss"}]' | motif apply 季度复盘 -
  motif lint 季度复盘 && motif preview 季度复盘 --out sheet.png
  motif export 季度复盘 --format mp4 --quality high`,
};

function parse(argv) {
  const pos = [];
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { pos.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      const key = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (v !== undefined) o[key] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--') && !['json', 'full', 'partial', 'dryRun', 'mute', 'verbose', 'yes', 'help'].includes(key)) o[key] = argv[++i];
      else o[key] = true;
    } else if (a === '-m') o.message = argv[++i];
    else if (a === '-h') o.help = true;
    else pos.push(a);
  }
  return { pos, o };
}

const isTTY = process.stdout.isTTY;
const c = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s), yellow = (s) => c('33', s), green = (s) => c('32', s), dim = (s) => c('2', s), bold = (s) => c('1', s), cyan = (s) => c('36', s);

function progressPrinter(label) {
  if (!process.stderr.isTTY) return undefined;
  let last = 0;
  return (p) => {
    const now = Date.now();
    if (now - last < 120 && p.done !== p.total) return;
    last = now;
    if (p.total) process.stderr.write(`\r${label} ${p.done}/${p.total} ${'█'.repeat(Math.round((p.done / p.total) * 24)).padEnd(24, '░')}`);
    if (p.done === p.total) process.stderr.write('\n');
  };
}

function printIssues(issues) {
  if (!issues?.length) { console.log(green('✓ 没有发现问题')); return; }
  for (const i of issues) {
    const tag = i.level === 'error' ? red('错误') : i.level === 'warning' ? yellow('警告') : dim('提示');
    const where = [i.sceneIndex != null ? `场景 ${i.sceneIndex + 1}` : i.scene, i.block, i.path].filter(Boolean).join(' · ');
    console.log(`${tag} ${where ? dim(where + '  ') : ''}${i.message}${i.hint ? dim(`\n     → ${i.hint}`) : ''}`);
  }
}

async function main() {
  const { pos, o } = parse(process.argv.slice(2));
  if (o.library) process.env.MOTIF_HOME = path.resolve(o.library);
  if (o.agent) process.env.MOTIF_AGENT = o.agent;
  const [command, ...args] = pos;
  const out = (data, human) => {
    if (o.json) process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    else if (human) human(data);
    else if (typeof data === 'string') console.log(data);
    else console.log(JSON.stringify(data, null, 2));
  };
  if (!command || command === 'help' || o.help) { console.log(HELP._); return; }
  switch (command) {
    case 'version': case '--version': return out({ version: VERSION }, () => console.log(VERSION));
    case 'list': case 'ls': case 'library':
      return out(cmd.list(), (ps) => {
        if (!ps.length) return console.log(dim('素材库为空。用 motif new 或 motif auto 创建项目。'));
        for (const p of ps) console.log(`${bold(p.title)}  ${dim(p.id)}  ${p.theme} · ${p.aspect} · ${p.scenes} 场景 · rev ${p.revision}${p.lastAuthor ? ` · ${p.lastAuthor}` : ''}\n  ${dim(p.path)}`);
      });
    case 'new': case 'create': {
      const r = cmd.create({ ...o, title: o.title || args[0] });
      return out(r, () => console.log(`${green('✓')} 已创建 ${bold(r.title)} ${dim(r.id)}（${r.theme}，${r.scenes} 场景）\n  ${dim(r.path)}`));
    }
    case 'show': case 'get': return out(cmd.show(args[0], o), (r) => console.log(r.summary || JSON.stringify(r.document, null, 2)));
    case 'apply': case 'edit': {
      const r = await cmd.apply(args[0], args[1] ?? '-', o);
      out(r, () => {
        for (const x of r.results) console.log(`${x.ok ? green('✓') : red('✗')} ${x.op}${x.id ? dim(' → ' + x.id) : ''}${x.error ? ' ' + red(x.error) : ''}${x.hint ? dim(`\n   → ${x.hint}`) : ''}`);
        if (r.saved) console.log(dim(`已保存 · 修订 ${r.revision}`)); else console.log(red('未保存：操作失败，项目保持不变'));
        if (r.warnings?.length) printIssues(r.warnings.map((w) => ({ ...w, level: w.level || 'warning' })));
        if (r.issues?.length) printIssues(r.issues);
      });
      if (!r.ok) process.exitCode = 3;
      return;
    }
    case 'write': { const r = await cmd.write(args[0], args[1] ?? '-', o); out(r, () => { console.log(r.saved ? `${green('✓')} 已写入 · 修订 ${r.revision}` : red('写入失败')); printIssues([...(r.warnings || []), ...(r.issues || [])]); }); if (!r.ok) process.exitCode = 3; return; }
    case 'validate': { const r = cmd.validate(args[0]); out(r, () => printIssues(r.issues)); if (r.issues.some((i) => i.level === 'error')) process.exitCode = 3; return; }
    case 'lint': {
      const r = await cmd.lint(args[0], o);
      out(r, () => { console.log(dim(`时长 ${r.duration.toFixed(1)}s · ${r.scenes.length} 场景 · 错误 ${r.counts.error} · 警告 ${r.counts.warning} · 提示 ${r.counts.info}`)); printIssues(r.issues); });
      if (r.counts.error) process.exitCode = 3;
      return;
    }
    case 'preview': case 'sheet': { const r = await cmd.preview(args[0], { ...o, onProgress: progressPrinter('渲染') }); return out(r, () => console.log(`${green('✓')} 联系表：${r.out}（${r.scenes} 场景，${r.duration.toFixed(1)}s）`)); }
    case 'still': case 'frame': { const r = await cmd.still(args[0], o); return out(r, () => console.log(`${green('✓')} ${r.out}`)); }
    case 'thumb': { const r = await cmd.thumb(args[0], o); return out(r, () => console.log(`${green('✓')} ${r.out}`)); }
    case 'export': case 'render': {
      const r = await cmd.exportProject(args[0], { ...o, onProgress: progressPrinter('导出') });
      return out(r, () => console.log(`${green('✓')} ${r.out}\n  ${dim(`${r.format} · ${r.duration ? r.duration.toFixed(1) + 's 成片 · ' : ''}${r.frames ? r.frames + ' 帧 · ' : ''}${r.bytes ? (r.bytes / 1048576).toFixed(1) + ' MB · ' : ''}用时 ${r.seconds}s`)}`));
    }
    case 'analyze': { const r = await cmd.analyze(args, o); return out(r, (x) => { console.log(`${bold(x.title)}  ${dim(x.sources.map((s) => `${path.basename(s.file)}(${s.kind})`).join(', '))}`); console.log(dim(`主题线索：${x.insights.topics.join('、') || '无'} · ${JSON.stringify(x.insights.counts)}`)); for (const s of x.sections) { console.log(`${'#'.repeat(Math.max(1, s.level || 1))} ${s.title || dim('(无标题)')} ${dim(s.source || '')}`); for (const it of s.items) console.log(`   - ${it.kind}${it.kind === 'table' ? ` ${it.rows.length}×${it.rows[0]?.length}${it.analysis?.chart ? ' → 建议 ' + it.analysis.chart : ''}` : it.kind === 'bullets' ? ` ×${it.items.length}: ${it.items.slice(0, 3).join(' | ').slice(0, 80)}` : it.kind === 'paragraph' ? `: ${it.text.slice(0, 70)}${it.numbers?.length ? cyan(' [数字 ' + it.numbers.map((n) => n.value).join(', ') + ']') : ''}` : it.kind === 'chart' ? ` ${it.chartType} ${it.labels.length}×${it.series.length}` : ''}`); } }); }
    case 'auto': { const r = await cmd.auto(args, o); return out(r, () => console.log(`${green('✓')} 已生成 ${bold(r.title)} ${dim(r.id)}（${r.theme}，${r.scenes} 场景）\n${r.summary}\n${dim(r.path)}`)); }
    case 'assets': { const r = await cmd.assets(args[0], args[1] || 'list', args.slice(2), o); return out(r, (x) => console.log(Array.isArray(x) ? x.map((a) => `${a.id}  ${a.kind}  ${a.name}${a.width ? ` ${a.width}×${a.height}` : ''}${a.duration ? ` ${a.duration}s` : ''}`).join('\n') || dim('（无资源）') : JSON.stringify(x, null, 2))); }
    case 'history': { const r = cmd.history(args[0], args[1] || 'list', args[2], o); return out(r, (x) => console.log(Array.isArray(x) ? x.map((h) => `rev ${String(h.revision).padStart(3)}  ${h.time.replace('T', ' ').slice(0, 19)}  ${h.author.padEnd(10)} ${h.message}${h.named ? cyan(' ★ ' + h.named) : ''}`).join('\n') : JSON.stringify(x, null, 2))); }
    case 'templates': { const r = cmd.templates(args[0] || 'list', args[1], o); return out(r, (x) => console.log(Array.isArray(x) ? x.map((t) => `${bold(t.id.padEnd(20))} ${t.name}  ${dim(`${t.theme} · ${t.aspect} · ${t.scenes} 场景${t.builtin ? '' : ' · 用户'}`)}\n  ${dim(t.description)}`).join('\n') : x.summary || JSON.stringify(x, null, 2))); }
    case 'components': { const r = await cmd.components(args[0] || 'list', args[1], o); return out(r, (x) => console.log(Array.isArray(x) ? x.map((t) => `${t.id}  ${t.kind}  ${t.name}  ${dim(t.type || '')}`).join('\n') || dim('（没有保存的组件）') : JSON.stringify(x, null, 2))); }
    case 'themes': { const r = cmd.themes(args[0] || 'list', args[1]); return out(r, (x) => console.log(Array.isArray(x) ? x.map((t) => `${bold(t.id.padEnd(11))} ${t.name}${t.user ? dim(' · 用户主题') : ''}\n  ${dim(t.description)}`).join('\n') : JSON.stringify(x, null, 2))); }
    case 'catalog': case 'docs': case 'reference': return out(cmd.catalog(args[0], o));
    case 'icons': return out(cmd.icons(o), (x) => console.log(x.join('  ')));
    case 'schema': return out(cmd.schema());
    case 'tools': return out(toolSchemas(o.format || 'mcp'));
    case 'call': { const r = await callTool(args[0], cmd.readJsonArg(args[1] || '{}')); return out(r.result); }
    case 'mcp': return startMcp(VERSION);
    case 'config': return out(cmd.config(args[0], args[1]));
    case 'doctor': return out(cmd.doctor(), (x) => x.forEach((ch) => console.log(`${ch.ok ? green('✓') : red('✗')} ${ch.name}  ${dim(ch.detail || '')}${!ch.ok && ch.fix ? `\n   → ${ch.fix}` : ''}`)));
    case 'open': {
      const { exe, args: a } = electronCommand();
      const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
      const p = args[0] ? (await import('../core/store/index.js')).resolveProject(args[0]) : null;
      spawn(exe, [...a, ...(p ? [`--open=${p}`] : [])], { env, detached: true, stdio: 'ignore' }).unref();
      return out({ opened: p || true }, () => console.log(`${green('✓')} 已在编辑器中打开`));
    }
    case 'delete': case 'rm': { const store = await import('../core/store/index.js'); const d = store.deleteProject(args[0]); return out({ trashed: d }, () => console.log(`${green('✓')} 已移入回收站：${d}`)); }
    case 'duplicate': { const store = await import('../core/store/index.js'); const r = store.duplicateProject(args[0], o.title); return out({ id: r.id, path: r.dir }, () => console.log(`${green('✓')} ${r.id}`)); }
    default: {
      const t = TOOLS.find((x) => x.name === command || x.name === `motif_${command}`);
      if (t) { const r = await callTool(t.name, cmd.readJsonArg(args[0] || '{}')); return out(r.result); }
      throw new cmd.CliError(`未知命令 "${command}"`, '运行 motif help 查看全部命令', 2);
    }
  }
}

main().catch((e) => {
  const json = process.argv.includes('--json');
  if (json) process.stdout.write(JSON.stringify({ ok: false, error: e.message, hint: e.hint }, null, 2) + '\n');
  else { process.stderr.write(red(`错误：${e.message}`) + (e.hint ? `\n${dim('→ ' + e.hint)}` : '') + '\n'); if (process.env.MOTIF_DEBUG) process.stderr.write(e.stack + '\n'); }
  process.exitCode = e.exit || 1;
});
void fs;
