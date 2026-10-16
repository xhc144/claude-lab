#!/usr/bin/env node
// Render the project index, film players and shared assets into docs/ from site/projects.mjs.
// Runs on its own (no project builds needed) and is also called by build-pages.mjs.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, SITE, categories, projects } from '../site/projects.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'docs');
const metaCache = join(root, 'site/film-meta.json');
const tree = (dir) => `${REPO}/tree/main/${dir}`;
const blob = (path) => `${REPO}/blob/main/${path}`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtTime = (sec) => {
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
};
const fmtSize = (bytes) => bytes >= 1e6 ? `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

// ─── film metadata: ffprobe when available, otherwise the committed cache ───
const cache = existsSync(metaCache) ? JSON.parse(readFileSync(metaCache, 'utf8')) : {};
let hasProbe = true;
try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); } catch { hasProbe = false; }
function probe(src) {
  const file = join(root, src);
  const size = statSync(file).size;
  if (cache[src]?.size === size || !hasProbe) {
    if (!cache[src]) throw new Error(`ffprobe missing and no cached metadata for ${src}`);
    return cache[src];
  }
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_chapters', '-show_streams', '-select_streams', 'v:0', file]).toString());
  const meta = {
    size, duration: Number(j.format.duration), height: j.streams?.[0]?.height || null,
    chapters: (j.chapters || []).map((c) => ({ t: Number(c.start_time), title: c.tags?.title || '' })),
  };
  cache[src] = meta;
  return meta;
}

// Films without a finished cut (no `versions`) get an ordinary card and no player page.
const films = projects.filter((p) => p.category === 'film' && p.versions);
for (const f of films) {
  const multi = f.versions.length > 1;
  for (const v of f.versions) {
    Object.assign(v, probe(v.src));
    v.file = multi ? `film-${v.id}.mp4` : 'film.mp4';
    if (v.srt) v.srtFile = v.file.replace(/\.mp4$/, '.srt');
  }
  f.runtime = f.versions[0].duration;
}
writeFileSync(metaCache, JSON.stringify(Object.fromEntries(Object.entries(cache).sort()), null, 1) + '\n');

// ─── icons ───
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
const icon = {
  ext: svg('<path d="M7 17 17 7M8 7h9v9"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  down: svg('<path d="M12 4v12m-5-5 5 5 5-5M5 20h14"/>'),
  up: svg('<path d="M12 19V5m-6 6 6-6 6 6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', ' class="sun"'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', ' class="moon"'),
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>',
};
const isExternal = (href) => /^https?:/.test(href);

// ─── shared page chrome ───
const favicon = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fe6c1"/><stop offset="1" stop-color="#e8c88a"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><text x="16" y="21.5" font-family="monospace" font-size="15" font-weight="700" text-anchor="middle" fill="#0b2418">CL</text></svg>')}`;
const head = ({ title, description, base, image, url }) => `<!doctype html>
<html lang="zh-CN" class="no-js"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0a1015" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#f5f3ee" media="(prefers-color-scheme: light)">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${favicon}">
<link rel="stylesheet" href="${base}assets/site.css">
<script>try{var t=localStorage.getItem('lab-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}document.documentElement.classList.replace('no-js','js')</script>
</head>`;
const header = (base, nav = '') => `<a class="skip" href="#main">跳到主要内容</a>
<header class="site-header"><div class="wrap">
<a class="brand" href="${base}" aria-label="Claude Lab 首页"><span class="brand-mark">CL</span>CLAUDE LAB<b>/</b></a>
${nav}
<div class="header-actions">
<a class="icon-btn" href="${REPO}" aria-label="GitHub 源码仓库">${icon.github}</a>
<button class="icon-btn theme-toggle" type="button" aria-label="切换主题">${icon.sun}${icon.moon}</button>
</div></div></header>`;
const footer = (base) => `<footer class="site-footer"><div class="wrap">
<span>Claude Lab · 每个实验独立维护，源码与构建说明见各项目目录。</span>
<span><a href="${blob('README.md')}">仓库说明</a> · <a href="${blob('docs/INTEGRATION.md')}">整合记录</a> · <a href="${REPO}">GitHub</a></span>
</div></footer>
<button class="icon-btn to-top" type="button" aria-label="回到顶部">${icon.up}</button>
<script src="${base}assets/site.js" defer></script>`;

// ─── index ───
const filmHref = (f) => `films/${f.id}/`;
const primaryHref = (p) => p.versions ? filmHref(p) : p.links.find((l) => l.primary).href;
const linkHtml = (l) => {
  const ext = isExternal(l.href);
  const attrs = `href="${esc(l.href)}"${l.download ? ` download="${esc(l.download)}"` : ''}${ext ? ' rel="noopener"' : ''}`;
  if (l.primary) return `<a class="btn btn-primary" ${attrs}>${esc(l.label)}${ext ? icon.ext : ''}</a>`;
  return `<a class="text-link" ${attrs}>${esc(l.label)}${l.download ? icon.down : ext ? icon.ext : ''}</a>`;
};

function card(p) {
  const cat = categories.find((c) => c.id === p.category);
  const isFilm = Boolean(p.versions);
  const href = primaryHref(p);
  const links = isFilm
    ? [{ label: '观看影片', href, primary: true }, ...(p.versions.length > 1 ? [{ label: `${p.versions[1].label} 版`.replace('English 版', '英文版'), href: `${href}?v=${p.versions[1].id}` }] : []), { label: '制作源码', href: tree(p.versions[0].src.split('/')[0]) }]
    : p.links;
  const badge = isFilm
    ? `<span class="badge k-film">${icon.play}${fmtTime(p.runtime)}</span>`
    : `<span class="badge k-${p.status.kind}">${esc(p.status.label)}</span>`;
  const langs = isFilm && p.versions.length > 1 ? `<span class="langs"><span>中</span><span>EN</span></span>` : '';
  const cover = p.cover
    ? `<a class="cover" href="${esc(href)}" tabindex="-1" aria-hidden="true"><img src="assets/covers/${p.cover}.jpg" alt="" loading="lazy" decoding="async" width="800" height="450">${badge}${langs}</a>`
    : `<a class="cover art" href="${esc(href)}" tabindex="-1" aria-hidden="true" style="--h:${p.art.hue}"><span class="glyph">${esc(p.art.glyph)}</span>${badge}</a>`;
  const search = [p.title, p.en, p.summary, p.note, p.notice, p.keywords, p.tools, cat.label, cat.en, isFilm ? '影片 视频 film video' : p.status.label, ...p.tags].filter(Boolean).join(' ');
  return `<article class="card reveal" data-cat="${p.category}" data-search="${esc(search)}" id="p-${p.id}">
${cover}
<div class="card-body"><p class="kicker">${esc(p.en)}</p>
<h3><a href="${esc(href)}"${isExternal(href) ? ' rel="noopener"' : ''}>${esc(p.title)}</a></h3>
<p class="summary">${esc(p.summary)}</p>${p.note ? `\n<p class="note">${esc(p.note)}</p>` : ''}${p.notice ? `\n<p class="note">${esc(p.notice)}</p>` : ''}
<ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<div class="links">${links.map(linkHtml).join('')}</div></div></article>`;
}

const onlineCount = projects.filter((p) => p.versions || p.status?.kind === 'online').length;
const filmMinutes = Math.round(films.reduce((a, f) => a + f.runtime, 0) / 60);
const desktopCount = projects.filter((p) => p.category === 'desktop').length;
const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
const mosaic = [['m1', 'echowild'], ['m2', 'symmetry-film'], ['m3', 'myriad'], ['m4', 'personal-site'], ['m5', 'fermat-windmill'], ['m6', 'tensora']]
  .map(([cls, id]) => `<a class="${cls}" href="${esc(primaryHref(byId[id]))}"><img src="assets/covers/${byId[id].cover}.jpg" alt="${esc(byId[id].title)} 画面" width="800" height="450"><span>${esc(byId[id].title)}</span></a>`).join('\n');

const indexHtml = `${head({ title: 'Claude Lab · 实验作品集', description: `Claude Lab：${projects.length} 个与 Claude 协作完成的实验——数学可视化、创世沙盒、卡牌策略、三维冒险、AI 原型、Windows 软件、数学讲解影片与中文 LaTeX 模板。`, base: '', image: `${SITE}assets/covers/symmetry-film.jpg`, url: SITE })}
<body>
${header('', `<nav class="site-nav" aria-label="主导航">${categories.map((c) => `<a href="#${c.id}" data-jump>${esc(c.label)}</a>`).join('')}<a href="#about">关于</a></nav>`)}
<main id="main">
<div class="wrap"><section class="hero" aria-labelledby="hero-title">
<div><p class="eyebrow">Experiments in mathematics, worlds &amp; motion</p>
<h1 id="hero-title">把想法做成<br><em>可以探索</em>的作品。</h1>
<p class="lede">这里收集与 Claude 协作完成的独立实验：在浏览器里打开数学仪器、创造一片世界、玩一局卡牌策略，或观看由代码生成的数学影片。每件作品都附带完整源码。</p>
<div class="stats">
<div class="stat"><b>${projects.length}</b><span>个项目</span></div>
<div class="stat"><b>${onlineCount}</b><span>个可在线打开</span></div>
<div class="stat"><b>${films.length}</b><span>部影片 · ${filmMinutes} 分钟</span></div>
<div class="stat"><b>${desktopCount}</b><span>个桌面软件</span></div>
</div>
<div class="hero-cta"><a class="btn btn-primary" href="#projects">浏览全部项目</a><a class="btn" href="${REPO}" rel="noopener">${icon.github.replace('<svg', '<svg width="16" height="16"')}GitHub 源码</a></div></div>
<div class="mosaic" aria-label="精选作品">${mosaic}</div>
</section></div>

<div class="toolbar" role="search"><div class="wrap">
<label class="search"><span class="visually-hidden">搜索项目</span>${icon.search}<input id="q" type="search" placeholder="搜索项目、主题或技术" autocomplete="off" enterkeyhint="search" aria-describedby="results-status"><kbd>/</kbd><button class="clear" type="button">清除</button></label>
<div class="chips" role="group" aria-label="按类别筛选">
<button class="chip" type="button" data-cat="all" aria-pressed="true">全部<span class="n">${projects.length}</span></button>
${categories.map((c) => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="false">${esc(c.label)}<span class="n">${projects.filter((p) => p.category === c.id).length}</span></button>`).join('\n')}
</div></div></div>

<div class="wrap" id="projects">
<p class="results-status" id="results-status" aria-live="polite">共 ${projects.length} 个项目</p>
${categories.map((c) => {
  const items = projects.filter((p) => p.category === c.id);
  return `<section class="cat" id="${c.id}" aria-labelledby="h-${c.id}">
<div class="cat-head"><div><h2 id="h-${c.id}"><small>${esc(c.en)}</small>${esc(c.label)}</h2></div><p>${esc(c.blurb)} <span class="count">${items.length} 项</span></p></div>
<div class="grid">
${items.map(card).join('\n')}
</div></section>`;
}).join('\n')}
<div class="empty" id="empty"><h2>没有找到匹配的项目</h2><p>换一个关键词试试，比如“影片”“Windows”“数论”或英文名称。</p><button class="btn" type="button" id="reset">清除搜索与筛选</button></div>

<section class="about" id="about" aria-label="关于本站">
<div><h2>关于这些项目</h2><p>每个实验一个目录，各自保留依赖、构建脚本与 Git 历史。网页版本是预先构建好的静态文件；影片播放的是已生成的 H.264 / AAC 成片。</p></div>
<div><h2>数据与隐私</h2><p>游戏与沙盒存档只保存在你自己的浏览器里，清理浏览器数据前请先导出。星枢 Tensora 的模型、厂商与账单全部为虚构；本站不包含任何凭据、安装包或用户数据。</p></div>
<div><h2>在本地构建</h2><p>在仓库根目录运行 <code>node scripts/build-pages.mjs</code> 重建全部站点产物；只改了导航时运行 <code>node scripts/build-site.mjs</code>。</p></div>
</section>
</div>
</main>
${footer('')}
</body></html>
`;

// ─── film pages ───
function filmPage(f, i) {
  const base = '../../';
  const first = f.versions[0];
  const prev = films[(i - 1 + films.length) % films.length], next = films[(i + 1) % films.length];
  const source = f.versions[0].src.split('/')[0];
  const chapterLists = f.versions.filter((v) => v.chapters.length).map((v, k) => `<ol class="chapters" data-v="${v.id}"${v.id !== first.id ? ' hidden' : ''}>${v.chapters.map((c) => `<li><button type="button" data-t="${c.t}"><time>${fmtTime(c.t)}</time><span>${esc(c.title)}</span></button></li>`).join('')}</ol>`).join('\n');
  const downloads = [
    ...f.versions.flatMap((v) => [
      `<li><a href="${v.file}" download>${esc(f.versions.length > 1 ? `${v.label} · MP4` : '成片 · MP4')}<small>${fmtSize(v.size)}</small></a></li>`,
      v.srtFile ? `<li><a href="${v.srtFile}" download>${esc(f.versions.length > 1 ? `${v.label} · 字幕 SRT` : '字幕 SRT')}<small>${fmtSize(statSync(join(root, v.srt)).size)}</small></a></li>` : '',
    ]),
    ...(f.extras || []).map((x) => `<li><a href="${x.name}"${x.name.endsWith('.pdf') ? ' download' : ''}>${esc(x.label)}<small>${fmtSize(statSync(join(root, x.src)).size)}</small></a></li>`),
  ].filter(Boolean).join('');
  const data = f.versions.map((v) => ({ id: v.id, src: v.file, note: v.note || '', duration: fmtTime(v.duration) }));
  return `${head({ title: `《${f.title}》${f.en} · Claude Lab`, description: f.summary, base, image: `${SITE}assets/covers/${f.cover}.jpg`, url: `${SITE}films/${f.id}/` })}
<body>
${header(base, `<nav class="site-nav" aria-label="主导航"><a href="${base}#film">全部影片</a><a href="${base}">项目导航</a></nav>`)}
<main id="main"><div class="wrap">
<nav class="crumbs" aria-label="位置"><a href="${base}">项目导航</a><span aria-hidden="true">/</span><a href="${base}#film">影片</a><span aria-hidden="true">/</span><span aria-current="page">${esc(f.title)}</span></nav>
<div class="film-head"><div><p class="eyebrow">${esc(f.en)}</p><h1>《${esc(f.title)}》</h1>
<p class="film-meta"><span>${icon.play.replace('<svg', '<svg width="12" height="12"')}<span data-duration>${fmtTime(first.duration)}</span></span><span>${first.height ? `${first.height}p` : 'HD'}</span><span>${f.versions.length > 1 ? f.versions.map((v) => v.label).join(' / ') : '单一版本'}</span>${first.chapters.length ? `<span>${first.chapters.length} 个章节</span>` : ''}</p></div>
${f.versions.length > 1 ? `<div class="seg" role="group" aria-label="选择版本">${f.versions.map((v, k) => `<button type="button" data-v="${v.id}" aria-pressed="${k === 0}">${esc(v.label)}</button>`).join('')}</div>` : ''}
</div>
<div class="player"><video controls playsinline preload="metadata" poster="${base}assets/covers/${f.cover}.jpg" aria-label="《${esc(f.title)}》播放器"><source src="${first.file}" type="video/mp4">浏览器无法播放时，请使用右侧的下载链接。</video></div>
<div class="film-body">
<div>
<p class="film-desc">${esc(f.summary)}</p>
<p class="version-note">${esc(first.note || '')}</p>
${f.notice ? `<p class="notice">${esc(f.notice)}</p>` : ''}
${chapterLists ? `<h2>章节</h2>\n${chapterLists}` : `<ul class="tags">${f.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`}
</div>
<aside class="side">
<div class="side-box"><h2>下载</h2><ul>${downloads}</ul></div>
<div class="side-box"><h2>制作</h2><p>${esc(f.tools)}</p><p>在项目目录中重新生成：</p><code>${esc(f.build)}</code><ul><li><a href="${tree(source)}" rel="noopener">制作源码<small>GitHub ↗</small></a></li><li><a href="${blob(`${source}/README.md`)}" rel="noopener">项目说明<small>README ↗</small></a></li></ul></div>
</aside>
</div>
<nav class="film-nav" aria-label="更多影片">
<a href="../${prev.id}/"><img src="${base}assets/covers/${prev.cover}.jpg" alt="" loading="lazy" width="800" height="450"><span><small>上一部</small><b>《${esc(prev.title)}》</b></span></a>
<a class="next" href="../${next.id}/"><img src="${base}assets/covers/${next.cover}.jpg" alt="" loading="lazy" width="800" height="450"><span><small>下一部</small><b>《${esc(next.title)}》</b></span></a>
</nav>
</div></main>
<script type="application/json" id="film-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
${footer(base)}
</body></html>
`;
}

// Copy a large file only when it changed, so rebuilding the site does not rewrite ~600 MB of video.
function copyIfChanged(from, to) {
  if (existsSync(to) && statSync(to).size === statSync(from).size && statSync(to).mtimeMs >= statSync(from).mtimeMs) return;
  cpSync(from, to);
}

// ─── write ───
mkdirSync(out, { recursive: true });
writeFileSync(join(out, '.nojekyll'), '');
rmSync(join(out, 'assets'), { recursive: true, force: true });
mkdirSync(join(out, 'assets/covers'), { recursive: true });
cpSync(join(root, 'site/site.css'), join(out, 'assets/site.css'));
cpSync(join(root, 'site/site.js'), join(out, 'assets/site.js'));
for (const p of projects) if (p.cover) cpSync(join(root, 'site/covers', `${p.cover}.jpg`), join(out, 'assets/covers', `${p.cover}.jpg`));
writeFileSync(join(out, 'index.html'), indexHtml);
mkdirSync(join(out, 'mojing'), { recursive: true });
cpSync(join(root, 'site/mojing.html'), join(out, 'mojing/index.html'));

const filmsDir = join(out, 'films');
mkdirSync(filmsDir, { recursive: true });
for (const name of readdirSync(filmsDir)) if (!films.some((f) => f.id === name)) rmSync(join(filmsDir, name), { recursive: true, force: true });
films.forEach((f, i) => {
  const dir = join(filmsDir, f.id);
  mkdirSync(dir, { recursive: true });
  const keep = new Set(['index.html']);
  for (const v of f.versions) {
    copyIfChanged(join(root, v.src), join(dir, v.file)); keep.add(v.file);
    if (v.srtFile) { cpSync(join(root, v.srt), join(dir, v.srtFile)); keep.add(v.srtFile); }
  }
  for (const x of f.extras || []) { cpSync(join(root, x.src), join(dir, x.name)); keep.add(x.name); }
  for (const name of readdirSync(dir)) if (!keep.has(name)) rmSync(join(dir, name), { recursive: true, force: true });
  writeFileSync(join(dir, 'index.html'), filmPage(f, i));
});
console.log(`Site: ${projects.length} projects, ${films.length} film pages written to docs/`);
