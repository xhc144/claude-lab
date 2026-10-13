#!/usr/bin/env node
// Build and publish only reviewed static outputs; never copy the repository root.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
for (const project of ['mathscape','myriad','personal-site','echowild','tensora']) {
 execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:join(root,project),stdio:'inherit'});
}
const out=join(root,'docs');
// Keep the durable history/verification record across rebuilds.
for(const p of ['index.html','mathscape','myriad','personal-site','echowild','tensora','mojing','films']) rmSync(join(out,p),{recursive:true,force:true});
mkdirSync(out,{recursive:true});
cpSync(join(root,'site/index.html'),join(out,'index.html'));
writeFileSync(join(out,'.nojekyll'),'');
for(const [p,file] of [['mathscape','mathscape.html'],['myriad','myriad.html'],['tensora','tensora.html']]) {
 mkdirSync(join(out,p),{recursive:true});cpSync(join(root,p,'dist',file),join(out,p,'index.html'));
}
cpSync(join(root,'personal-site/dist'),join(out,'personal-site'),{recursive:true});
mkdirSync(join(out,'echowild'),{recursive:true});
for(const p of ['index.html','css','src']) cpSync(join(root,'echowild',p),join(out,'echowild',p),{recursive:true});
cpSync(join(root,'echowild/dist/echowild.html'),join(out,'echowild/echowild.html'));
const mojing = join(out,'mojing');
mkdirSync(join(mojing,'previews/png'),{recursive:true});
mkdirSync(join(mojing,'dist'),{recursive:true});
cpSync(join(root,'site/mojing.html'),join(mojing,'index.html'));
for(const name of ['notes','exercise','exercise-student','exercise-key','exam','exam-answers','paper','book','translation','translation-columns']) {
 cpSync(join(root,'mojing/previews',name+'.pdf'),join(mojing,'previews',name+'.pdf'));
}
for(const name of ['notes','exercise','exercise-student','exam','exam-answers','paper','book','translation','translation-columns']) {
 cpSync(join(root,'mojing/previews/png',name+'.png'),join(mojing,'previews/png',name+'.png'));
}
for(const name of ['notes','exercise','exam','paper','book','translation']) {
 cpSync(join(root,'mojing/dist','mojing-'+name+'.zip'),join(mojing,'dist','mojing-'+name+'.zip'));
}
const films=[
 ['symmetry-film','《对称的语言》','symmetry-film/output/abstract_algebra_promo_web.mp4','约 3 分 40 秒 · 抽象代数程序化影片'],
 ['sea-above','《倒悬之海》','sea-above/out/the_sea_above.mp4','约 71 秒 · 程序化三维短片']
];
for(const [slug,title,source,description] of films){
 const dir=join(out,'films',slug);mkdirSync(dir,{recursive:true});cpSync(join(root,source),join(dir,'film.mp4'));
 writeFileSync(join(dir,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Claude Lab</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0d151a;color:#edf3ef;font:16px/1.7 system-ui,sans-serif}main{width:min(1100px,92%);margin:40px auto}a{color:#b1edca}h1{font-size:clamp(28px,5vw,46px)}video{width:100%;max-height:75vh;background:#000;border-radius:12px}p{color:#a8bfbd}.links{display:flex;gap:24px;flex-wrap:wrap}</style></head><body><main><a href="../../">← 返回项目导航</a><h1>${title}</h1><p>${description}</p><video controls playsinline preload="metadata" aria-label="${title}播放器"><source src="film.mp4" type="video/mp4">浏览器无法播放时，可使用下方成片链接。</video><p>影片制作需要 Python 与本地渲染环境。这里播放已生成的 H.264 / AAC 成片。</p><div class="links"><a href="film.mp4">打开成片文件</a><a href="https://github.com/xhc144/claude-lab/tree/main/${slug}">查看制作源码 ↗</a></div></main></body></html>`);
}
execFileSync(process.execPath,['scripts/check-pages.mjs'],{cwd:root,stdio:'inherit'});
console.log('Pages output ready in docs/');
