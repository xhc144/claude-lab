#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('../docs',import.meta.url)));
const files=[];function walk(d){for(const n of readdirSync(d)){const p=join(d,n);if(statSync(p).isDirectory())walk(p);else files.push(p)}}walk(root);
const allowed=new Set(['.html','.css','.js','.woff2','.svg','.jpg','.mp4','.txt','.md','.pdf','.png','.zip']);
const templateNames='notes|exercise|exam|paper|book|translation';
const previewNames='notes|exercise|exercise-student|exercise-key|exam|exam-answers|paper|book|translation|translation-columns';
const mojingAsset=new RegExp(`^mojing/(?:previews/(?:${previewNames})\\.pdf|previews/png/(?:${previewNames})\\.png|dist/mojing-(?:${templateNames})\\.zip)$`);
const failures=[];let refs=0;
for(const file of files){
 const rel=relative(root,file);if(rel==='.nojekyll')continue;
 const ext=/\.[^.]+$/.exec(file)?.[0];
 if(!allowed.has(ext)||/hongyan|node_modules|\.env|\.exe|\.eml|\.sqlite|\.key/i.test(rel))failures.push('Forbidden output: '+rel);
 if(['.pdf','.png','.zip'].includes(ext)&&!mojingAsset.test(rel))failures.push('Outside template asset whitelist: '+rel);
 if(ext==='.pdf'&&!readFileSync(file).subarray(0,5).equals(Buffer.from('%PDF-')))failures.push('Invalid PDF: '+rel);
 if(ext==='.zip'&&!readFileSync(file).subarray(0,2).equals(Buffer.from('PK')))failures.push('Invalid ZIP: '+rel);
 if(!['.html','.css','.js'].includes(ext))continue;
 const text=readFileSync(file,'utf8');
 if(/高二|清华大学求真|备考|mit-ocw-notes|ai-self-study|repository-index/.test(text))failures.push('Out-of-scope personal data: '+rel);
 const patterns=ext==='.html'?[/(?:src|href)=["']([^"']+)["']/g]:ext==='.css'?[/url\(["']?([^\)"']+)["']?\)/g]:[/from\s+["'](\.[^"']+)["']/g,/new URL\(["'](\.[^"']+)["']/g];
 for(const pattern of patterns)for(const m of text.matchAll(pattern)){
  const ref=m[1];if(/^(https?:|data:|blob:|mailto:|#)/.test(ref))continue;
  const clean=ref.split(/[?#]/)[0];if(!clean)continue;
  if(clean.startsWith('/')){failures.push('Root-absolute path: '+rel+' → '+clean);continue}
  let target=resolve(dirname(file),clean);refs++;
  if(!target.startsWith(root)||!existsSync(target)){failures.push('Missing path: '+rel+' → '+clean);continue}
  if(statSync(target).isDirectory()&&!existsSync(join(target,'index.html')))failures.push('Missing index: '+rel+' → '+clean);
 }
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`✓ ${files.length} allowed files; ${refs} relative references resolve; publication boundary checked`);
