// 星卡: the knowledge card for the selected star — summary, statement, intuition, proof (folded),
// examples, applications, an interactive animation, every relation grouped by kind, and the
// syllabus items it belongs to. Learning status and favourites are set here.

import { el, escapeHtml, rgba } from '../core/util.js';
import { KINDS, LEVELS, RELATIONS, SECTION_KINDS } from '../config.js';
import { renderMath } from '../core/tex.js';
import { ICON } from './icons.js';
import { mountAnimation, animationTitle } from '../anim/index.js';

const SEC_CODE = { statement: 's', intuition: 'i', proof: 'p', example: 'e', app: 'a', note: 'n' };

export class Card {
  constructor(app) {
    this.app = app;
    this.i = -1;
    this.anim = null;
    this.root = el('aside', { id: 'card', class: 'glass', 'aria-label': '知识卡片' });
    this.head = el('div', { class: 'card-head' });
    this.body = el('div', { class: 'card-body scroll' });
    this.root.append(this.head, this.body);
    this.body.addEventListener('click', (e) => {
      const a = e.target.closest('a.wl, [data-go]');
      if (!a) return;
      e.preventDefault();
      const id = a.dataset.id || a.dataset.go;
      const n = this.app.graph.node(id);
      if (n) this.app.select(n.index, { fly: true, from: 'card' });
    });
    app.store.on('change', (w) => { if (this.i >= 0 && w && (w.type === 'progress' || w.type === 'fav') ) this.renderHead(); });
    this.bindSheet();
  }

  get node() { return this.app.graph.nodes[this.i]; }

  open(i) {
    const same = i === this.i;
    this.i = i;
    this.renderHead();
    if (!same || !this.bodyReady) this.renderBody();
    this.root.classList.add('open');
    this.app.root.classList.add('card-open');
    this.root.style.setProperty('--gc', rgba(this.node.galaxy.rgb, 1));
    if (!same) this.body.scrollTop = 0;
  }
  close() {
    this.root.classList.remove('open', 'tall');
    this.app.root.classList.remove('card-open');
    this.destroyAnim();
    this.i = -1;
    this.bodyReady = false;
  }
  isOpen() { return this.root.classList.contains('open'); }
  destroyAnim() { if (this.anim) { try { this.anim.destroy(); } catch { /* ignore */ } this.anim = null; } }

  renderHead() {
    const n = this.node;
    if (!n) return;
    const app = this.app;
    const st = app.store.status(n.id);
    const fav = app.store.isFav(n.id);
    const gal = n.galaxy, clu = n.cluster;
    this.head.innerHTML = '';
    const grip = el('button', { class: 'sheet-grip', 'aria-label': '展开或收起卡片', onclick: () => this.root.classList.toggle('tall') });
    const close = el('button', { class: 'icon-btn card-close', 'aria-label': '关闭卡片', html: ICON.close, onclick: () => app.deselect() });
    const crumbs = el('div', { class: 'crumbs' },
      el('button', { text: gal.name, onclick: () => app.flyGalaxy(gal.index) }), '›',
      el('button', { text: clu.name, onclick: () => app.flyCluster(clu.index) }));
    const badges = el('div', { class: 'badges' },
      el('span', { class: 'badge-k kind', text: `${KINDS[n.k].glyph} ${n.ty}` }),
      el('span', { class: `badge-k lv-${n.lv}`, title: LEVELS[n.lv].desc, text: LEVELS[n.lv].name }),
      ...(n.tg || []).slice(0, 4).map((t) => el('span', { class: 'badge-k', text: `# ${t}` })));
    const seg = el('div', { class: 'status-seg', role: 'group', 'aria-label': '学习状态' },
      ...[['0', '未学'], ['1', '学习中'], ['2', '已掌握']].map(([s, label]) => el('button', {
        'data-s': s, class: String(st) === s ? 'on' : '', 'aria-pressed': String(String(st) === s), text: label,
        onclick: () => { app.store.setStatus(n.id, +s); if (+s === 2) app.toast(`已点亮「${n.t}」`); },
      })));
    const actions = el('div', { class: 'actions' },
      seg,
      el('button', { class: `btn sm fav-btn${fav ? ' on' : ''}`, 'aria-pressed': String(fav), html: `${fav ? ICON.starFill : ICON.star}<span>${fav ? '已收藏' : '收藏'}</span>`, onclick: () => { const on = app.store.toggleFav(n.id); app.toast(on ? '已加入收藏' : '已取消收藏'); } }),
      el('button', { class: 'btn sm', title: '从这颗星展开知识星链（E）', html: `${ICON.web}<span>星链展开</span>`, onclick: () => app.setMode('explore', this.i) }),
      el('button', { class: 'btn sm', title: '学会它需要的全部前置知识，按顺序排好', html: `${ICON.path}<span>学习路径</span>`, onclick: () => app.showLearningPath(this.i) }),
      el('button', { class: 'btn sm', title: '从这颗星出发，找到通往另一颗星的关系链', html: `${ICON.route}<span>航线</span>`, onclick: () => app.drawer.openRoute(this.i) }),
    );
    this.head.append(grip, close, crumbs,
      el('h2', { class: 'card-title', text: n.t }),
      n.en ? el('div', { class: 'card-en', text: n.en }) : '',
      badges, actions);
  }

  renderBody() {
    const n = this.node;
    const app = this.app;
    this.destroyAnim();
    const parts = [];
    parts.push(`<div class="summary">${n.s || ''}</div>`);
    const c = app.content && app.content[n.id];
    if (c) {
      for (const [kind, heading, html] of c.h) {
        if (!html) continue;
        const code = SEC_CODE[kind] || 'n';
        const title = heading || SECTION_KINDS[kind]?.name || '';
        const head = `<div class="sec-h">${escapeHtml(title || '内容')}</div>`;
        if (kind === 'proof') parts.push(`<details class="sec" data-code="${code}"><summary>${head}</summary><div class="sec-in">${html}</div></details>`);
        else parts.push(`<section class="sec" data-code="${code}">${title ? head : ''}${html}</section>`);
      }
      this.bodyReady = true;
    } else {
      parts.push('<p class="loading-text">正在载入完整内容…</p>');
      this.bodyReady = false;
    }
    if (n.an) parts.push(`<section class="sec" data-code="anim"><div class="sec-h">交互动画</div><div class="anim-box"><div class="anim-title"><b>${escapeHtml(animationTitle(n.an))}</b><span class="grow"></span></div><div class="anim-host"></div></div></section>`);
    this.body.innerHTML = parts.join('');
    // relations
    const rel = el('section', { class: 'sec', 'data-code': 'rel' }, el('div', { class: 'sec-h', text: '知识关系' }));
    const groups = app.graph.relationGroups(this.i);
    if (!groups.length) rel.append(el('p', { class: 'loading-text', text: '这颗星暂时没有连线。' }));
    for (const g of groups) {
      const R = RELATIONS[g.type];
      const style = R.double ? `border-top: 4px double ${R.color}` : `border-top: 2px ${R.dash && R.dash.length ? (R.dash[0] <= 3 ? 'dotted' : 'dashed') : 'solid'} ${R.color}`;
      rel.append(el('div', { class: 'rel-group' },
        el('div', { class: 'rel-label' }, el('span', { class: 'rel-line', style }), el('span', { text: `${g.label} · ${g.items.length}` })),
        el('div', { class: 'rel-chips' }, ...g.items.map((j) => {
          const m = app.graph.nodes[j];
          return el('button', { class: `rel-chip${app.store.status(m.id) === 2 ? ' mastered' : ''}`, 'data-go': m.id, title: `${m.galaxy.name} · ${m.ty}`, style: { color: rgba(m.galaxy.rgb, 1) } },
            el('span', { class: 'd' }), el('span', { style: { color: 'var(--text)' }, text: m.t }));
        }))));
    }
    this.body.append(rel);
    // syllabus
    if (n.sy && n.sy.length) {
      const box = el('div', { class: 'syl-box' });
      for (const id of n.sy) {
        const it = app.graph.syllabusIndex.get(id);
        if (!it) continue;
        box.append(el('div', { class: 'syl-line', html: `<b>${escapeHtml(it.group.subject)} · ${escapeHtml(it.group.name)}</b>：${escapeHtml(it.name)}<br><span>${escapeHtml(it.group.wording)}</span>` }));
      }
      this.body.append(el('section', { class: 'sec', 'data-code': 'syl' }, el('div', { class: 'sec-h', text: '考纲对应' }), box));
    }
    this.body.append(el('div', { class: 'card-foot', text: `星 ${n.id} · ${n.galaxy.name} / ${n.cluster.name} · ${n.degree} 条关系` }));
    renderMath(this.body);
    if (n.an) {
      const host = this.body.querySelector('.anim-host');
      try { this.anim = mountAnimation(n.an, host, { color: rgba(n.galaxy.rgb, 1), rgb: n.galaxy.rgb }); }
      catch (e) { host.textContent = '动画加载失败'; console.error(e); }
    }
  }

  openSection(code) {
    const sec = this.body.querySelector(`[data-code="${code}"]`);
    if (!sec) return;
    if (sec.tagName === 'DETAILS') sec.open = true;
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sec.classList.remove('flash');
    void sec.offsetWidth;
    sec.classList.add('flash');
  }

  // bottom sheet on phones: drag the grip up / down
  bindSheet() {
    let y0 = null;
    this.root.addEventListener('touchstart', (e) => { if (e.target.closest('.sheet-grip, .card-head') && !e.target.closest('button:not(.sheet-grip)')) y0 = e.touches[0].clientY; }, { passive: true });
    this.root.addEventListener('touchend', (e) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0;
      y0 = null;
      if (dy < -40) this.root.classList.add('tall');
      else if (dy > 60) { if (this.root.classList.contains('tall')) this.root.classList.remove('tall'); else this.app.deselect(); }
    });
  }
}
