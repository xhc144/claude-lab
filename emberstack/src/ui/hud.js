// The in-game interface: top bar (day dial, resources, fog, speed), objectives and warnings, the AI
// panel (autoplay switch, strategies, current goals, live decision log), the card inspector, toasts,
// day/night banners, and the dialogs for events, caravans, the market and the tech tree.

import { h, clear, setText, img } from './dom.js';
import { CARDS } from '../data/cards.js';
import { TECHS, ERAS } from '../data/techs.js';
import { EVENTS } from '../data/events.js';
import { RECIPES } from '../data/recipes.js';
import { STRATEGIES, STRATEGY_IDS } from '../ai/strategies.js';
import { objectiveText, starText, starMet } from '../sim/objectives.js';
import { canPay } from '../sim/eventsim.js';
import { SEASON_NAMES } from '../sim/constants.js';
import { iconURL, drawIcon } from '../render/icons.js';
import { artURL, KIND_STYLE, RARITY, cardRole } from '../render/cardface.js';
import { cardCanvas, cardDetail, renderCodex } from './codex.js';
import { store } from './store.js';

const CAT_COLORS = {
  生存: '#ff9a7a', 食物: '#f2c14e', 战斗: '#ff6a5a', 经济: '#e8c86a', 整理: '#9a8a7a', 目标: '#ffd27a', 探索: '#7ad0c8', 建设: '#c8a87a',
  实验: '#c89aff', 科技: '#8ab8f0', 思考: '#b8a37e', 训练: '#e89a5a', 世界: '#8a9aa8', 盘点: '#f6e6c4',
};
const TOAST_KINDS = new Set(['goal', 'tech', 'danger', 'death', 'boss', 'discover', 'hint', 'win', 'story', 'season', 'event', 'birth', 'explore']);

export class Hud {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.t = 0;
    this.logSeen = 0;
    this.toastN = 0;
    this.lastToast = new Map();
    this.hidden = false;
    this.dialog = null;
    this.build();
  }

  get g() { return this.app.g; }
  get brain() { return this.app.brain; }

  // ------------------------------------------------------------------ construction
  build() {
    const app = this.app;
    const R = clear(this.root);
    R.className = 'screen hud passthrough';
    // top bar
    this.dial = h('canvas.daydial', { width: 100, height: 100, title: '日夜与季节' });
    this.lvlName = h('b');
    this.lvlSub = h('span');
    this.chips = {};
    const chip = (key, icon, title) => {
      const val = h('span.num');
      const sub = h('small');
      const el = h('div.chipx', { title }, img(iconURL(icon, 36), 'icon'), val, sub);
      this.chips[key] = { el, val, sub };
      return el;
    };
    this.fogBar = h('div.fogbar', h('i'));
    this.fogVal = h('span.num');
    const fogChip = h('div.chipx', { title: '灰雾：涨满时某些关卡会失败；暗影随之增多' }, img(iconURL('fog', 36), 'icon'), this.fogBar, this.fogVal);
    this.speedBtns = [];
    const speeds = h('div.speed');
    this.pauseBtn = h('button.iconbtn', { title: '暂停 (空格)', onclick: () => app.togglePause() }, img(iconURL('pause', 40)));
    speeds.appendChild(this.pauseBtn);
    for (const [i, s] of [1, 2, 4, 8, 16].entries()) {
      const b = h('button.iconbtn', { title: `${s} 倍速 (${i + 1})`, onclick: () => app.setSpeed(s) }, s + '×');
      b.dataset.s = s;
      this.speedBtns.push(b);
      speeds.appendChild(b);
    }
    const tools = h('div.tools',
      h('button.iconbtn', { title: '科技树 (T)', onclick: () => this.openTech() }, img(iconURL('spark', 40))),
      h('button.iconbtn', { title: '图鉴 (C)', onclick: () => this.openCodex() }, img(iconURL('scroll', 40))),
      h('button.iconbtn', { title: '镜头对准营地 (F)', onclick: () => { app.view.autoCam = true; app.view.fitColony(); } }, img(iconURL('eye', 40))),
      h('button.iconbtn', { title: '菜单 (Esc)', onclick: () => app.openPause() }, img(iconURL('gear', 40))));
    this.top = h('div.topbar.panel',
      this.dial, h('div.lvl-title', this.lvlName, this.lvlSub),
      h('div.res', chip('pop', 'people', '人口 / 住房'), chip('food', 'bowl', '食物总量 / 每日所需'), chip('coin', 'coin', '铜贝'), chip('insight', 'spark', '灵感（研究用）'),
        chip('tech', 'scroll', '已掌握科技'), chip('threat', 'skull', '场上的敌人'), fogChip),
      speeds, tools);
    // left column
    this.objList = h('div');
    this.starList = h('div.starline');
    this.loseList = h('div.starline');
    this.warnList = h('div.warnings.panel');
    this.objHead = h('h3', { style: { cursor: 'pointer' }, title: '点击收起/展开', onclick: () => this.objBox.classList.toggle('mini') }, '目标');
    this.objBox = h('div.objectives.panel', this.objHead, this.objList, this.starList, this.loseList);
    if (window.innerWidth < 820) this.objBox.classList.add('mini');
    this.left = h('div.leftcol', this.objBox, this.warnList);
    // AI panel
    this.aiToggle = h('div.toggle', { title: 'AI 自动游玩 (A)', onclick: () => app.setAI(!app.aiOn) });
    this.aiFocus = h('div.focus');
    this.aiState = h('div');
    this.stratBtns = STRATEGY_IDS.map((id) => h('button.btn.ghost.small', { title: STRATEGIES[id].desc, onclick: () => app.setStrategy(id) }, STRATEGIES[id].name));
    this.goalBox = h('div.ai-goals');
    this.logBox = h('div.ai-log.scroll');
    const opt = (label, key, fn) => {
      const cb = h('input', { type: 'checkbox', checked: !!store().settings[key], onchange: (e) => { store().settings[key] = e.target.checked; fn && fn(e.target.checked); app.saveSettings(); } });
      return h('label', cb, label);
    };
    this.ai = h('div.aipanel.panel',
      h('div.ai-tab', { onclick: () => this.ai.classList.remove('collapsed') }),
      h('div.ai-head', h('button.iconbtn', { title: '收起/展开', onclick: () => this.ai.classList.toggle('collapsed') }, img(iconURL('brain', 40))), h('h3', 'AI 玩家'), h('span.muted', { style: { fontSize: '12px' } }, '自动游玩'), this.aiToggle),
      h('div.ai-status', this.aiFocus, this.aiState),
      h('div.ai-strats', this.stratBtns),
      this.goalBox,
      h('div', { style: { padding: '0 12px', fontSize: '12px', color: 'var(--muted)' } }, '决策日志'),
      this.logBox,
      h('div.ai-foot',
        opt('自动下一关', 'autoNext'),
        opt('显示 AI 之手', 'showHand', (v) => { app.view.showHand = v; }),
        opt('跟随镜头', 'autoCam', (v) => { app.view.autoCam = v; }),
        opt('镜头追随 AI 之手', 'followAI', (v) => { app.view.followAI = v; if (v) app.view.autoCam = true; }),
        opt('手动操作时接管', 'takeover')));
    if (window.innerWidth < 820) this.ai.classList.add('collapsed');
    // inspector, toasts, takeover notice
    this.inspector = h('div.inspector.panel.hidden');
    this.toasts = h('div.toasts');
    this.takeover = h('div.takeover.hidden', '你接管了控制权，AI 正在旁观。', h('button.btn.small.gold', { onclick: () => app.setAI(true) }, '交还给 AI'));
    this.tutorialBox = h('div.tutorial.parch.hidden');
    this.bannerBox = h('div');
    this.dialogBox = h('div');
    R.append(this.top, this.left, this.ai, this.inspector, this.takeover, this.toasts, this.tutorialBox, this.bannerBox, this.dialogBox);
    this.refreshStatic();
  }

  refreshStatic() {
    const L = this.app.level;
    setText(this.lvlName, L.name);
    setText(this.lvlSub, (L.id.match(/^\d/) ? L.id + ' · ' : '') + (L.sub || ''));
    this.logSeen = 0;
    clear(this.logBox);
    this.updateAiControls();
    this.update(1, true);
  }

  setHidden(v) {
    this.hidden = v;
    for (const el of [this.top, this.left, this.ai, this.inspector]) el.style.visibility = v ? 'hidden' : '';
  }

  updateAiControls() {
    const app = this.app;
    this.aiToggle.classList.toggle('on', app.aiOn);
    this.stratBtns.forEach((b, i) => b.classList.toggle('on', STRATEGY_IDS[i] === app.brain.strategyId));
    this.takeover.classList.toggle('hidden', !(app.tookOver && !app.aiOn));
    for (const b of this.speedBtns) b.classList.toggle('on', Number(b.dataset.s) === app.speed && !app.paused);
    this.pauseBtn.classList.toggle('on', app.paused);
  }

  // ------------------------------------------------------------------ per-frame
  update(dt, force = false) {
    this.t += dt;
    if (!force && this.t < 0.2) return;
    this.t = 0;
    const g = this.g, app = this.app;
    this.drawDial();
    // resources
    const pop = g.population(), house = g.housing();
    const C = this.chips;
    setText(C.pop.val, pop);
    setText(C.pop.sub, '/' + house);
    const food = g.totalFood();
    const need = dailyNeed(g);
    setText(C.food.val, food);
    setText(C.food.sub, '/' + need + '每日');
    C.food.el.classList.toggle('alert', food < need && g.phase() > 0.5);
    setText(C.coin.val, g.coinValue());
    setText(C.insight.val, g.freeCards('insight').length);
    setText(C.tech.val, g.s.tech.length);
    const foes = Object.values(g.s.stacks).filter((st) => st.mob && CARDS[g.s.cards[st.cards[0]].d].kind === 'enemy').length;
    setText(C.threat.val, foes);
    C.threat.el.classList.toggle('alert', foes > 0 && Object.keys(g.s.battles).length > 0);
    const fog = Math.round(g.s.fog || 0);
    this.fogBar.firstChild.style.width = Math.min(100, fog) + '%';
    this.fogBar.classList.toggle('high', fog >= 70);
    setText(this.fogVal, fog + '%');
    const tb = this.top.getBoundingClientRect().bottom;
    if (Math.abs(tb + 10 - (this.leftTop || 0)) > 1) {
      this.leftTop = tb + 10;
      this.left.style.top = this.leftTop + 'px';
      if (window.innerWidth > 820) this.ai.style.top = this.leftTop + 'px';
    }
    // objectives
    this.drawObjectives();
    this.drawWarnings();
    this.drawAi();
    this.updateAiControls();
  }

  drawDial() {
    const g = this.g;
    const c = this.dial, x = c.getContext('2d');
    const W = 100, cx = 50, cy = 50, r = 44;
    x.clearRect(0, 0, W, W);
    const ph = g.phase();
    // day/night ring
    const seg = (a0, a1, col) => { x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a0 * Math.PI * 2 - Math.PI / 2, a1 * Math.PI * 2 - Math.PI / 2); x.closePath(); x.fillStyle = col; x.fill(); };
    if (g.rules.dark) seg(0, 1, '#1a1e36');
    else {
      seg(0, 0.06, '#7a6a8a');
      seg(0.06, 0.7, '#e8b860');
      seg(0.7, 0.78, '#c8603a');
      seg(0.78, 1, '#1a1e36');
    }
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.lineWidth = 4;
    x.strokeStyle = '#21160f';
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, 28, 0, Math.PI * 2);
    x.fillStyle = '#2a1c12';
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = '#d9a84a';
    x.stroke();
    // needle
    const a = ph * Math.PI * 2 - Math.PI / 2;
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
    x.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    x.lineWidth = 4;
    x.strokeStyle = '#fff2c8';
    x.stroke();
    drawIcon(x, g.isNight() ? 'moon' : 'sun', cx + Math.cos(a) * 36, cy + Math.sin(a) * 36, 13);
    // day number and season
    x.fillStyle = '#ffe2a0';
    x.font = 'bold 22px Georgia,serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(String(g.s.day), cx, cy - 4);
    x.font = '13px "Noto Serif SC",serif';
    x.fillStyle = '#d9c09a';
    x.fillText(g.rules.seasons === false ? '' : SEASON_NAMES[g.season()], cx, cy + 15);
  }

  drawObjectives() {
    const g = this.g;
    const key = g.s.objectives.map((o) => `${o.cur}/${o.need}/${o.done}`).join('|') + g.s.day;
    if (key === this.objKey) return;
    this.objKey = key;
    clear(this.objList);
    const doneN = g.s.objectives.filter((o) => o.done || o.cur >= o.need).length;
    setText(this.objHead, g.s.objectives.length ? `目标 ${doneN}/${g.s.objectives.length}` : '目标');
    if (!g.s.objectives.length) this.objList.appendChild(h('div.obj', h('div.t', h('span', '坚持下去'), h('span.num', `第 ${g.s.day} 天`))));
    for (const o of g.s.objectives) {
      const f = o.need ? Math.min(1, o.cur / o.need) : 0;
      this.objList.appendChild(h('div', { class: 'obj' + (o.done ? ' done' : '') }, h('div.t', h('span', (o.done ? '✓ ' : '') + objectiveText(o)), h('span.num', `${Math.min(o.cur, o.need)}/${o.need}`)), h('div.pbar', h('i', { style: { width: f * 100 + '%' } }))));
    }
    clear(this.starList);
    for (const s of this.app.level.stars || []) this.starList.appendChild(h('div', { class: starMet(g, s) ? 'met' : '' }, '★ ' + starText(s)));
    clear(this.loseList);
    for (const l of this.app.level.lose || []) {
      if (l.type === 'time') this.loseList.appendChild(h('div', { class: g.s.day > l.days - 3 ? 'bad' : '' }, `⌛ 期限：第 ${l.days} 天（剩 ${Math.max(0, l.days - g.s.day + 1)} 天）`));
      if (l.type === 'fog') this.loseList.appendChild(h('div', { class: g.s.fog > 70 ? 'bad' : '' }, '☁ 灰雾涨满即失败'));
      if (l.type === 'lost') this.loseList.appendChild(h('div', `✝ 不能失去${CARDS[l.card].name}`));
      if (l.type === 'deaths') this.loseList.appendChild(h('div', `✝ 牺牲不得超过 ${l.n - 1} 人`));
    }
  }

  drawWarnings() {
    const g = this.g;
    const W = [];
    const need = dailyNeed(g), food = g.totalFood();
    if (food < need) W.push(['bad', `食物不足：黎明需要 ${need}，现有 ${food}`]);
    const fires = Object.values(g.s.cards).filter((c) => CARDS[c.d].fuelMax && CARDS[c.d].kind === 'structure');
    const lowFire = fires.filter((c) => (c.fuel || 0) <= 1);
    if (fires.length && lowFire.length) W.push(['warn', `${lowFire.map((c) => CARDS[c.d].name).slice(0, 2).join('、')}燃料将尽`]);
    const hungry = g.people().filter((p) => p.st && p.st.hungry).length;
    if (hungry) W.push(['bad', `${hungry} 人在挨饿——再饿一次就会死去`]);
    if (g.s.fog >= 70) W.push(['bad', `灰雾已到 ${Math.round(g.s.fog)}%`]);
    if (g.population() > g.housing()) W.push(['warn', '住房不足：无法繁衍']);
    if (g.season() === 2 && g.rules.seasons !== false) W.push(['info', '秋天：为冬天储备耐放的食物与燃料']);
    for (const e of g.level.schedule || []) if (e.warn && e.day >= g.s.day && e.day - g.s.day <= 3) W.push(['warn', e.day === g.s.day ? `今天：${e.warn.replace(/^第 \d+ (天|夜)：/, '')}` : e.warn]);
    for (const b of Object.values(g.s.battles)) W.push(['bad', `战斗中：${b.a.length} 对 ${b.b.length}`]);
    const key = W.map((w) => w.join(':')).join('|');
    if (key === this.warnKey) return;
    this.warnKey = key;
    clear(this.warnList);
    this.warnList.classList.toggle('hidden', !W.length);
    for (const [k, t] of W.slice(0, 6)) this.warnList.appendChild(h('div', { class: 'w-' + k }, k === 'bad' ? '⚠' : k === 'warn' ? '◆' : '◇', h('span', t)));
  }

  drawAi() {
    const app = this.app, b = app.brain;
    setText(this.aiFocus, app.aiOn ? (b.focus ? '正在：' + b.focus : '思考中…') : app.tookOver ? '旁观中（你在操作）' : 'AI 已关闭');
    setText(this.aiState, `${STRATEGIES[b.strategyId].name}策略 · ${b.stats.actions} 次操作 · ${b.stats.thinks} 次规划 · 实验 ${b.stats.experiments}`);
    const gk = b.goals.map((x) => x.name + x.prio).join('|');
    if (gk !== this.goalKey) {
      this.goalKey = gk;
      clear(this.goalBox);
      const top = Math.max(1, ...b.goals.map((x) => x.prio));
      for (const x of b.goals.slice(0, 5)) {
        this.goalBox.appendChild(h('div.goalrow',
          h('span.cat', { style: { color: CAT_COLORS[x.cat] || '#b8a37e' } }, x.cat || '目标'),
          h('span.gt', { title: x.detail || x.name }, x.name),
          h('span.gb', h('i', { style: { width: Math.min(100, (x.prio / top) * 100) + '%' } }))));
      }
    }
    // new log lines
    const log = b.log;
    if (this.logSeen > log.length) this.logSeen = 0;
    if (log.length > this.logSeen) {
      const atBottom = this.logBox.scrollTop + this.logBox.clientHeight >= this.logBox.scrollHeight - 30;
      for (const e of log.slice(this.logSeen)) this.logBox.appendChild(logLine(e));
      this.logSeen = log.length;
      while (this.logBox.childNodes.length > 160) this.logBox.removeChild(this.logBox.firstChild);
      if (atBottom) this.logBox.scrollTop = this.logBox.scrollHeight;
    }
  }

  // ------------------------------------------------------------------ events
  onEvents(evs) {
    const g = this.g;
    for (const e of evs) {
      if (e.type === 'msg') {
        if (TOAST_KINDS.has(e.kind)) this.toast(e.text, e.kind);
        if (['goal', 'death', 'boss', 'discover', 'tech', 'danger'].includes(e.kind)) this.app.brain.log.push({ t: g.s.t, day: g.s.day, cat: '世界', text: e.text, important: e.kind !== 'tech' });
      } else if (e.type === 'dawn') {
        if (this.app.speed <= 8) this.banner(`第 ${g.s.day} 天`, g.rules.seasons === false ? '' : SEASON_NAMES[g.season()]);
      } else if (e.type === 'night') {
        if (this.app.speed <= 4 && !g.rules.dark) this.banner('夜幕降临', '回到火光里', 'night');
      } else if (e.type === 'research') {
        this.toast(`研究完成：${TECHS[e.tech].name}`, 'tech');
      } else if (e.type === 'discover') {
        this.toast(`发现隐藏配方「${RECIPES[e.r].name}」！`, 'discover');
      } else if (e.type === 'event' && !e.instant && !this.app.aiOn) {
        const c = g.s.cards[e.cardId];
        if (c && store().settings.tutorial !== false && !this.dialog) this.openEvent(c);
      }
    }
  }

  toast(text, kind = 'info') {
    const now = performance.now();
    if (now - (this.lastToast.get(text) || 0) < 5000) return;
    this.lastToast.set(text, now);
    if (this.toasts.childNodes.length >= 4) this.toasts.removeChild(this.toasts.firstChild);
    const el = h('div', { class: 'toast ' + kind }, text);
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 4600);
  }

  banner(text, sub, cls = '') {
    clear(this.bannerBox);
    this.bannerBox.appendChild(h('div', { class: 'banner ' + cls }, text, sub ? h('small', sub) : null));
  }

  // ------------------------------------------------------------------ inspector
  inspect(cardId) {
    const g = this.g;
    const c = cardId && g.s.cards[cardId];
    if (!c || this.hidden) { this.inspector.classList.add('hidden'); this.inspected = null; return; }
    if (this.inspected === cardId && this.inspT && performance.now() - this.inspT < 500) return;
    this.inspected = cardId;
    this.inspT = performance.now();
    const d = CARDS[c.d];
    const lines = [];
    if (d.kind === 'folk') lines.push(`${c.name || ''} · 生命 ${Math.ceil(c.hp)}/${g.maxHp(c)}` + (c.kills ? ` · 击杀 ${c.kills}` : ''));
    if (c.gear) { const gs = Object.values(c.gear).filter(Boolean).map((id) => CARDS[id].name); if (gs.length) lines.push('装备：' + gs.join('、')); }
    if (d.fuelMax) lines.push(`燃料 ${Math.ceil(c.fuel || 0)}/${d.fuelMax}`);
    if (c.sp !== undefined && d.spoil) lines.push(`${c.sp} 天后腐坏`);
    if ((d.node || d.region) && c.ch >= 0) lines.push(`剩余 ${c.ch} 次`);
    const st = g.s.stacks[c.s];
    if (st && st.task) lines.push(`正在进行：${RECIPES[st.task.r].name} ${Math.round(st.task.p * 100)}%`);
    clear(this.inspector);
    this.inspector.classList.remove('hidden');
    const canvas = cardCanvas(c.d, 110);
    canvas.style.width = '110px';
    canvas.style.flex = 'none';
    this.inspector.append(canvas, h('div.info',
      h('div', h('b', d.name), h('span.kind', `${KIND_STYLE[d.kind].label} · ${(RARITY[d.rarity] || RARITY.common).name}`)),
      h('div', d.desc),
      lines.length ? h('div.muted', lines.join(' · ')) : null,
      h('div.uses', cardRole(d))));
  }

  // ------------------------------------------------------------------ dialogs
  closeDialog() {
    clear(this.dialogBox);
    this.dialog = null;
    this.app.dialogClosed();
  }

  openDialog(kind, sheetCls, ...content) {
    clear(this.dialogBox);
    this.dialog = kind;
    const sheet = h('div', { class: 'sheet parch ' + (sheetCls || '') }, h('button.close', { onclick: () => this.closeDialog(), title: '关闭' }, '×'), ...content);
    const veil = h('div.veil', { onclick: (e) => { if (e.target === veil) this.closeDialog(); } }, sheet);
    this.dialogBox.appendChild(veil);
    this.app.dialogOpened(kind);
    return sheet;
  }

  openEvent(card) {
    const g = this.g;
    const e = EVENTS[card.ev];
    if (!e) return;
    const choices = e.choices.map((ch, i) => {
      const ok = canPay(g, ch.give);
      return h('button.choice', { disabled: !ok, onclick: () => { const r = this.app.playerAct(() => g.actChoose(card.id, i)); if (r && r.ok) this.closeDialog(); else this.toast(r?.why || '无法选择', 'danger'); } },
        ch.label, h('small', costText(ch.give, ch.get) + (ok ? '' : ' · 材料不足')));
    });
    const left = card.exp ? Math.max(0, card.exp - g.s.day) : null;
    this.openDialog('event', '',
      h('div.dlg-cards', cardCanvasFixed(card.d, 132), h('div', { style: { flex: '1' } },
        h('h2', e.name), h('p.story', e.text),
        left !== null ? h('div.muted', { style: { fontSize: '13px' } }, `不做决定的话，${left <= 0 ? '今天' : left + ' 天后'}黎明会自动选择「${e.choices[e.def >= 0 ? e.def : e.choices.length - 1].label}」。`) : null)),
      h('div', choices));
  }

  openTrade(card) {
    const g = this.g;
    const draw = () => {
      const rows = card.offers.map((o, i) => h('div.offer',
        h('div.pay', o.give.map(([k, n]) => mini(k, n, g))), h('span.arrow', '→'), h('div.get', o.get.map(([k, n]) => mini(k, n))), h('span.spacer'),
        h('span.muted', { style: { fontSize: '12px' } }, `余 ${o.left}`),
        h('button.btn.small', { disabled: o.left <= 0 || !canPay(g, o.give), onclick: () => { const r = this.app.playerAct(() => g.actTrade(card.id, i)); if (!r.ok) this.toast(r.why, 'danger'); draw(); } }, '交易')));
      clear(body).append(...rows);
    };
    const body = h('div');
    this.openDialog('trade', '', h('div.dlg-cards', cardCanvasFixed('caravan', 110), h('div', h('h2', '商队'), h('p', `远方来的商人愿意交换货物。你有 ${g.coinValue()} 铜贝。商队会在第 ${card.exp} 天离开。`))), body);
    draw();
  }

  openMarket(card) {
    const g = this.g;
    const body = h('div');
    const draw = () => {
      clear(body).append(...g.marketOffers().map((o) => h('div.offer',
        h('div.pay', o.give.map(([k, n]) => mini(k, n, g))), h('span.arrow', '→'), h('div.get', o.get.map(([k, n]) => mini(k, n))), h('span.spacer'),
        h('button.btn.small', { disabled: !canPay(g, o.give), onclick: () => { const r = this.app.playerAct(() => g.actBuy(card.id, o.id)); if (!r.ok) this.toast(r.why, 'danger'); draw(); } }, '购买'))));
    };
    this.openDialog('market', '', h('div.dlg-cards', cardCanvasFixed('market', 110), h('div', h('h2', '集市'), h('p', `把货物叠到集市上就能卖成铜贝；在这里花铜贝购买补给。现有 ${g.coinValue()} 铜贝。`))), body);
    draw();
  }

  openTech() {
    const g = this.g;
    const body = h('div.techtree');
    const info = h('div.muted', { style: { margin: '2px 0 8px' } });
    const draw = () => {
      clear(body);
      const have = g.freeCards('insight').length;
      setText(info, `灵感 ${have} · 把人叠在刻石或书斋上产出灵感。${this.app.aiOn && this.app.brain.techTarget ? ' AI 正在攒灵感研究「' + TECHS[this.app.brain.techTarget].name + '」。' : ''}`);
      for (const e of ERAS) {
        const techs = Object.values(TECHS).filter((t) => t.era === e.id);
        const col = h('div.era', h('div.era-h', { style: { background: e.color } }, e.name));
        for (const t of techs) {
          const st = g.techStatus(t.id);
          const cls = st.done ? 'done' : st.locked ? 'locked' : st.ok ? 'avail' : 'blocked';
          const el = h('button', { class: 'tech ' + cls + (this.app.brain.techTarget === t.id ? ' target' : ''), title: st.why || '点击研究', onclick: () => {
            if (!st.ok) { this.toast(st.why, 'danger'); return; }
            const r = this.app.playerAct(() => g.actResearch(t.id));
            if (!r.ok) this.toast(r.why, 'danger');
            draw();
          } }, h('span.cost', st.done ? '✓' : '✦' + t.cost), h('b', t.name), t.desc);
          col.appendChild(el);
        }
        body.appendChild(col);
      }
    };
    this.openDialog('tech', 'wide', h('h2', '科技'), info, body);
    draw();
  }

  openCodex() {
    const sheet = this.openDialog('codex', 'wide');
    sheet.style.height = '88vh';
    renderCodex(sheet, {});
  }

  openCardInfo(id) {
    this.openDialog('card', 'wide', cardDetail(id));
  }

  // ------------------------------------------------------------------ tutorial
  showTutorial(step) {
    if (!step) { this.tutorialBox.classList.add('hidden'); return; }
    clear(this.tutorialBox);
    this.tutorialBox.classList.remove('hidden');
    this.tutorialBox.append(h('div.seal.sage', '火'), h('div', { html: step.html }),
      h('div.row.tnext', step.done ? h('span.good', '✓ 完成') : null, h('span.spacer'),
        h('button.btn.small.ghost', { onclick: () => this.app.tutorial.skip() }, '关闭教程'),
        step.manual ? h('button.btn.small', { onclick: () => this.app.tutorial.next() }, '继续') : null));
  }
}

// ------------------------------------------------------------------ helpers
export function dailyNeed(g) {
  const winter = g.rules.seasons !== false && g.season() === 3;
  let n = 0;
  for (const p of g.people()) n += CARDS[p.d].appetite || 0;
  return Math.ceil(n * (winter ? g.rules.winterAppetite || 1.25 : 1));
}

function logLine(e) {
  const hh = e.t !== undefined ? `D${e.day}` : '';
  return h('div', { class: 'logline' + (e.important ? ' imp' : '') },
    h('span.when', hh), h('span.cat', { style: { color: CAT_COLORS[e.cat] || '#b8a37e', marginRight: '6px' } }, e.cat), e.text);
}

function nameOf(k) { return k === '#food' ? '食物' : CARDS[k]?.name || k; }
function costText(give, get) {
  const a = give.map(([k, n]) => nameOf(k) + '×' + n).join(' + ');
  const b = get.map(([k, n]) => nameOf(k) + '×' + n).join(' + ');
  return (a ? '付出 ' + a : '无需付出') + (b ? ' · 得到 ' + b : '');
}

function mini(k, n, g) {
  const id = k === '#food' ? 'bread' : k;
  const short = g && (k === 'coin' ? g.coinValue() < n : k === '#food' ? g.freeFood() < n : g.freeCards(k).length < n);
  return h('span', { class: 'mini' + (short ? ' short' : ''), title: nameOf(k) }, img(artURL(id, 52), ''), `${nameOf(k)}×${n}`);
}

function cardCanvasFixed(id, w) {
  const c = cardCanvas(id, w);
  c.style.width = w + 'px';
  c.style.flex = 'none';
  return c;
}

