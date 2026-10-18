// 把本目录的 Markdown 源文件（KaTeX 公式）渲染成 A4 PDF，输出到 dist/。
// 用法：npm ci && npm run build            （构建全部）
//       node build.mjs paper.md            （只构建指定文件）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const sources = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['paper.md', 'solutions.md', 'design-notes.md'].filter((f) => existsSync(join(here, f)));

const md = MarkdownIt({ html: true, typographer: false }).use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: true, strict: 'ignore' },
});

const nm = (p) => pathToFileURL(join(here, 'node_modules', p)).href;

const css = `
@import url("${nm('katex/dist/katex.min.css')}");
@import url("${nm('@fontsource/noto-serif-sc/400.css')}");
@import url("${nm('@fontsource/noto-serif-sc/700.css')}");
@import url("${nm('@fontsource/noto-sans-sc/500.css')}");
@import url("${nm('@fontsource/noto-sans-sc/700.css')}");
:root { --ink: #1a1a1a; --accent: #1f3a68; --rule: #c9ced6; --soft: #f4f6f9; }
@page { size: A4; margin: 20mm 19mm 22mm 19mm; }
html { font-size: 10.6pt; }
body { margin: 0; color: var(--ink); background: #fff;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif; line-height: 1.72; text-align: justify; }
h1, h2, h3, h4 { font-family: "Noto Sans SC", sans-serif; color: var(--accent); line-height: 1.35; break-after: avoid; }
h1 { font-size: 1.75rem; text-align: center; margin: 0 0 1.1rem; letter-spacing: 0.04em; }
h2 { font-size: 1.32rem; margin: 1.6rem 0 0.7rem; padding-bottom: 0.25rem; border-bottom: 1.5px solid var(--accent); }
h3 { font-size: 1.08rem; margin: 1.3rem 0 0.45rem; }
p { margin: 0.42rem 0; orphans: 3; widows: 3; }
strong { font-family: "Noto Sans SC", sans-serif; font-weight: 700; color: #111; }
hr { border: none; border-top: 1px solid var(--rule); margin: 1.4rem 0; }
table { border-collapse: collapse; margin: 0.7rem auto; break-inside: avoid; }
th, td { border: 1px solid var(--rule); padding: 0.32rem 0.6rem; vertical-align: middle; }
th { background: var(--soft); font-family: "Noto Sans SC", sans-serif; font-weight: 500; }
ol, ul { padding-left: 1.6rem; margin: 0.4rem 0; }
li { margin: 0.2rem 0; }
img { display: block; margin: 0.8rem auto; max-width: 48%; break-inside: avoid; }
.katex { font-size: 1.06em; }
.katex-display, eq, section.eqno { break-inside: avoid; }
eqn { display: block; margin: 0.55rem 0; break-inside: avoid; overflow-x: auto; }
.page-break { break-before: page; }
`;

function render(file) {
  let src = readFileSync(join(here, file), 'utf8');
  // "<!-- pagebreak -->" in the source starts a new page in the PDF
  src = src.replace(/<!--\s*pagebreak\s*-->/g, '<div class="page-break"></div>');
  const body = md.render(src);
  const bad = body.match(/KaTeX parse error[^<]*/);
  if (bad) throw new Error(`${file}: ${bad[0]}`);
  const title = (src.match(/^#\s+(.+)$/m) || [, basename(file)])[1].replace(/[*`$]/g, '');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<base href="${pathToFileURL(here + '/').href}"><title>${title}</title><style>${css}</style></head>
<body>${body}</body></html>`;
}

mkdirSync(dist, { recursive: true });
const browser = await chromium.launch();
try {
  for (const file of sources) {
    const html = render(file);
    const htmlPath = join(dist, basename(file, '.md') + '.html');
    writeFileSync(htmlPath, html);
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const pdfPath = join(dist, basename(file, '.md') + '.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;text-align:center;font-size:8pt;color:#777;font-family:serif">— <span class="pageNumber"></span> / <span class="totalPages"></span> —</div>',
      margin: { top: '20mm', bottom: '22mm', left: '19mm', right: '19mm' },
    });
    await page.close();
    console.log(`${file} -> dist/${basename(pdfPath)}`);
  }
} finally {
  await browser.close();
}
