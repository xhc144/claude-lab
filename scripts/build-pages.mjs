#!/usr/bin/env node
// Build and publish only reviewed static outputs; never copy the repository root.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
for (const project of ['mathscape','myriad','personal-site','echowild','tensora','emberstack','math-starmap']) {
 execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:join(root,project),stdio:'inherit'});
}
const out=join(root,'docs');
// Keep the durable history/verification record and the film media (managed by build-site.mjs) across rebuilds.
for(const p of ['mathscape','myriad','personal-site','echowild','tensora','emberstack','math-starmap','mojing']) rmSync(join(out,p),{recursive:true,force:true});
mkdirSync(out,{recursive:true});
for(const [p,file] of [['mathscape','mathscape.html'],['myriad','myriad.html'],['tensora','tensora.html'],['emberstack','emberstack.html']]) {
 mkdirSync(join(out,p),{recursive:true});cpSync(join(root,p,'dist',file),join(out,p,'index.html'));
}
cpSync(join(root,'personal-site/dist'),join(out,'personal-site'),{recursive:true});
cpSync(join(root,'math-starmap/dist'),join(out,'math-starmap'),{recursive:true});
mkdirSync(join(out,'echowild'),{recursive:true});
for(const p of ['index.html','css','src']) cpSync(join(root,'echowild',p),join(out,'echowild',p),{recursive:true});
cpSync(join(root,'echowild/dist/echowild.html'),join(out,'echowild/echowild.html'));
const mojing = join(out,'mojing');
mkdirSync(join(mojing,'previews/png'),{recursive:true});
mkdirSync(join(mojing,'dist'),{recursive:true});
for(const name of ['notes','exercise','exercise-student','exercise-key','exam','exam-answers','paper','book','translation','translation-columns']) {
 cpSync(join(root,'mojing/previews',name+'.pdf'),join(mojing,'previews',name+'.pdf'));
}
for(const name of ['notes','exercise','exercise-student','exam','exam-answers','paper','book','translation','translation-columns']) {
 cpSync(join(root,'mojing/previews/png',name+'.png'),join(mojing,'previews/png',name+'.png'));
}
for(const name of ['notes','exercise','exam','paper','book','translation']) {
 cpSync(join(root,'mojing/dist','mojing-'+name+'.zip'),join(mojing,'dist','mojing-'+name+'.zip'));
}
// Index, film players, covers and the Mojing page come from site/ (see site/projects.mjs).
execFileSync(process.execPath,['scripts/build-site.mjs'],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['scripts/check-pages.mjs'],{cwd:root,stdio:'inherit'});
console.log('Pages output ready in docs/');
