#!/usr/bin/env node
// 墨誊 Moteng 命令行：moteng <网页.html|.mhtml|.zip|文件夹> [选项]
import path from 'node:path';
import { convert, findEngines } from '../src/core/convert.js';

const HELP = `用法：moteng <输入> [选项]

输入可以是浏览器保存的 .html（连同 _files 文件夹）、.mhtml、.zip，或包含它们的文件夹。

选项：
  -s, --style chat|notes   版式：对话体（默认）或墨经讲义体
  -o, --out <目录>         输出根目录（默认与输入同目录）
      --tex-only           只生成 .tex，不编译 PDF
      --thinking           保留模型的“思考过程”
      --no-questions       不输出提问，只保留回答
      --paper a4|b5        纸张（默认 A4）
      --large              大字号（小四）
      --title <标题>        自定义标题
      --engine <路径>      指定 xelatex 或 tectonic
      --engines            列出找到的 TeX 引擎
  -h, --help               显示帮助
`;

function parse(argv) {
  const o = { inputs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '-s': case '--style': o.style = next(); break;
      case '-o': case '--out': o.outRoot = next(); break;
      case '--tex-only': o.compile = false; break;
      case '--thinking': o.includeThinking = true; break;
      case '--no-questions': o.includeQuestions = false; break;
      case '--paper': o.paper = next(); break;
      case '--large': o.fontSize = 'large'; break;
      case '--title': o.title = next(); break;
      case '--engine': o.enginePath = next(); break;
      case '--engines': o.listEngines = true; break;
      case '-h': case '--help': o.help = true; break;
      default: o.inputs.push(a);
    }
  }
  return o;
}

const o = parse(process.argv.slice(2));
if (o.listEngines) {
  const list = findEngines({ custom: o.enginePath });
  if (!list.length) console.log('没有找到 TeX 引擎。');
  for (const e of list) console.log(`${e.label}\t${e.path}`);
  process.exit(0);
}
if (o.help || !o.inputs.length) {
  console.log(HELP);
  process.exit(o.help ? 0 : 1);
}
const engine = o.enginePath ? findEngines({ custom: o.enginePath })[0] : undefined;
let failed = 0;
for (const input of o.inputs) {
  try {
    const r = await convert(path.resolve(input), {
      ...o,
      engine,
      onProgress: (_, d) => process.stderr.write(`  ${d}\n`),
    });
    console.log(`✔ ${r.title}（${r.platform}，${r.turns} 轮问答，${r.style === 'notes' ? '讲义体' : '对话体'}）`);
    console.log(`  TeX：${r.texPath}`);
    if (r.pdfPath) console.log(`  PDF：${r.pdfPath}`);
    for (const w of r.warnings) console.log(`  ! ${w}`);
  } catch (e) {
    failed++;
    console.error(`✘ ${input}：${e.message}`);
    if (e.log && process.env.MOTENG_DEBUG) console.error(e.log.slice(-4000));
  }
}
process.exit(failed ? 1 : 0);
