// Out-of-game screens: title, campaign map, level briefing, results, expedition / endless /
// challenge setup, achievements, settings and the in-game pause menu.

import { h, clear, img, starsEl } from './dom.js';
import { CHAPTERS, LEVELS } from '../data/levels.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { STRATEGIES, STRATEGY_IDS } from '../ai/strategies.js';
import { objectiveText, starText } from '../sim/objectives.js';
import { BIOMES, MUTATORS, CHALLENGES } from '../modes/expedition.js';
import { artURL } from '../render/cardface.js';
import { iconURL } from '../render/icons.js';
import { renderCodex } from './codex.js';
import { store, save, exportData, importData, resetAll } from './store.js';

const BIOME_ART = { valley: 'valley_depths', forest: 'deep_forest', marsh: 'marsh_depths', mountain: 'mountain_pass', tundra: 'frozen_waste', isles: 'misty_isle', ash: 'ash_wastes' };

export class Menus {
  constructor(app, root) {
    this.app = app;
    this.root = root;
  }

  clear() { clear(this.root); }

  // ------------------------------------------------------------------ title
  title() {
    const app = this.app, S = store();
    const run = S.run;
    const flame = h('canvas.flame-orb', { width: 148, height: 148 });
    const fg = flame.getContext('2d');
    fg.drawImage(iconCanvas('flame', 148), 0, 0);
    const scr = h('div.screen.title-screen',
      h('div.title-wrap',
        flame,
        h('div.logo', '薪火纪'),
        h('div.logo-en', 'EMBERSTACK'),
        h('div.tagline', '灰雾吞没了世界。把卡牌叠在一起——采集、建造、研究、探索、战斗——在长夜里重新点燃文明的火种。或者，看一位真正会思考的 AI 替你做到。'),
        h('div.menu-col',
          run ? h('button.btn.big.gold', { onclick: () => app.resumeRun() }, '继续 · ' + (run.name || run.levelId)) : null,
          h('button.btn.big', { onclick: () => app.show('campaign') }, run ? '战役' : '开始战役'),
          h('button.btn', { onclick: () => app.watchAI() }, '观看 AI 从零建设文明'),
          h('div.menu-row',
            h('button.btn.ghost', { onclick: () => app.show('expedition') }, '远征 · 无尽'),
            h('button.btn.ghost', { onclick: () => app.show('challenges') }, '挑战'),
            h('button.btn.ghost', { onclick: () => app.show('codex') }, '图鉴'),
            h('button.btn.ghost', { onclick: () => app.show('achievements') }, '成就'),
            h('button.btn.ghost', { onclick: () => app.show('settings') }, '设置')))),
      h('div.title-foot', `${Object.keys(LEVELS).length} 个战役关卡 · 316 张卡牌 · 48 项科技 · 一位自主思考的 AI 玩家 · 所有美术与音乐均由程序实时绘制生成`));
    this.mount(scr);
  }

  mount(el) {
    clear(this.root);
    this.root.appendChild(el);
  }

  // ------------------------------------------------------------------ campaign
  campaign() {
    const app = this.app, S = store();
    const unlocked = (id) => S.settings.unlockAll || isUnlocked(id, S);
    const chapters = h('div.chapters.scroll');
    for (const ch of CHAPTERS) {
      const first = ch.levels[0];
      const open = unlocked(first);
      const total = ch.levels.reduce((a, id) => a + (S.progress[id]?.stars || 0), 0);
      const card = h('div', { class: 'chapter' + (open ? '' : ' locked') },
        h('div.chapter-art', { style: { backgroundImage: `url(${artURL(BIOME_ART[ch.biome], 300)})` } },
          h('div.seal.chapter-no', String(ch.id)),
          h('div.chapter-name', h('small', ch.en), ch.name)),
        h('div.chapter-desc', ch.desc, h('div.muted', { style: { fontSize: '12px', marginTop: '3px' } }, `★ ${total}/${ch.levels.length * 3}`)),
        h('div.levels', ch.levels.map((id) => {
          const L = LEVELS[id], p = S.progress[id];
          return h('button.lvl', { disabled: !unlocked(id), onclick: () => app.brief(L) },
            h('span.lid', id), h('span.lname', L.name, h('small', L.sub || '')),
            p?.aiWon ? h('span', { title: 'AI 曾通关', style: { fontSize: '12px', color: 'var(--gold)' } }, 'AI') : null,
            starsEl(p?.stars || 0));
        })));
      chapters.appendChild(card);
    }
    const scr = h('div.screen.campaign',
      h('div.topnav', h('button.btn.ghost.small', { onclick: () => app.show('title') }, '← 返回'), h('h1', '战役 · 七片土地'),
        h('button.btn.small', { onclick: () => app.campaignAI() }, '让 AI 连续通关')),
      chapters,
      h('div.mode-cards',
        h('button.mode-card', { onclick: () => app.show('expedition') }, h('b', '远征'), h('p', '随机生成的土地、随机目标与难度修正。每一次都不一样。')),
        h('button.mode-card', { onclick: () => app.show('expedition', { endless: true }) }, h('b', '无尽'), h('p', '没有终点。每三夜一次袭击，一次比一次凶猛。你能坚持多少天？')),
        h('button.mode-card', { onclick: () => app.show('challenges') }, h('b', '挑战'), h('p', '战役关卡的残酷变体：永夜、孤身、饥荒、兽潮……'))));
    this.mount(scr);
    // scroll to the first unfinished chapter
    const idx = CHAPTERS.findIndex((c) => c.levels.some((id) => !S.progress[id]?.won));
    if (idx > 0) requestAnimationFrame(() => { chapters.scrollLeft = idx * 318 - 40; });
  }

  // ------------------------------------------------------------------ briefing
  brief(L, opts = {}) {
    const app = this.app, S = store();
    let strat = S.settings.strategy;
    const stratBox = h('div.strategy-pick');
    const drawStrats = () => {
      clear(stratBox);
      for (const id of STRATEGY_IDS) stratBox.appendChild(h('button', { class: 'strat' + (strat === id ? ' on' : ''), onclick: () => { strat = id; S.settings.strategy = id; save(); drawStrats(); } }, h('b', STRATEGIES[id].name), h('small', STRATEGIES[id].desc)));
    };
    drawStrats();
    const story = h('div.story', L.intro.map((t, i) => h('p', { style: { animationDelay: i * 0.5 + 's' } }, t)));
    const goals = h('ul.goal-list',
      (L.objectives || []).map((o) => h('li', objectiveText(o))),
      (L.objectives || []).length ? null : h('li', '坚持尽可能多的天数'),
      (L.stars || []).map((s) => h('li.star', '★ ' + starText(s))),
      (L.lose || []).map((l) => h('li.lose', l.type === 'fog' ? '灰雾涨满即失败' : l.type === 'time' ? `必须在 ${l.days} 天内完成` : l.type === 'lost' ? '不能失去关键卡牌' : `牺牲不得达到 ${l.n} 人`)));
    const best = S.progress[L.id];
    const sheet = h('div.sheet.parch',
      h('button.close', { onclick: () => opts.back ? opts.back() : app.show('campaign') }, '×'),
      h('h2', L.name), h('div.brief-sub', (L.id.match(/^\d/) ? `第 ${L.id} 关 · ` : '') + (L.sub || '')),
      h('div.scroll', { style: { overflowY: 'auto', minHeight: '0' } },
        story,
        h('h3', '目标'), goals,
        best?.won ? h('div.muted', `最佳：${best.bestDays} 天 · ${'★'.repeat(best.stars)}`) : null,
        h('div.divider'),
        h('h3', 'AI 策略（自动游玩时使用）'), stratBox),
      h('div.row.end', { style: { marginTop: '12px' } },
        h('button.btn.ghost', { onclick: () => app.startLevel(L, { ai: true, strategy: strat }) }, img(iconURL('brain', 36)), ' 交给 AI'),
        h('button.btn.big.gold', { onclick: () => app.startLevel(L, { ai: false, strategy: strat }) }, '亲自开始')));
    this.mount(h('div.screen', h('div.veil', sheet)));
  }

  // ------------------------------------------------------------------ results
  results(r) {
    const app = this.app;
    const won = r.won;
    const statRows = [
      ['坚持天数', r.days], ['人口峰值', r.maxPop], ['牺牲', r.deaths], ['击败敌人', r.kills], ['制作物品', r.crafted], ['研究科技', r.researched],
      ['探索次数', r.explored], ['发现隐藏配方', r.discovered], ['集市收入', r.coinsEarned], ['你的操作', r.actions.player || 0], ['AI 的操作', r.actions.ai || 0],
    ];
    let countdown = null;
    const cdText = h('span.muted');
    const next = won && r.next;
    const sheet = h('div.sheet.parch',
      h('div', { class: 'result-title' + (won ? '' : ' lose') }, r.mode === 'endless' ? `坚持了 ${r.days} 天` : won ? '胜利' : '失败'),
      won && r.mode !== 'endless' ? h('div.result-stars', [0, 1, 2].map((i) => h('span', { class: i < r.stars ? 'on' : '', style: { animationDelay: 0.3 + i * 0.25 + 's' } }, '★'))) : null,
      h('p.story', { style: { textAlign: 'center' } }, won ? r.outro || r.reason : r.reason),
      r.newAch.length ? h('div', { style: { textAlign: 'center', margin: '6px 0' } }, r.newAch.map((a) => h('span.mini', { style: { margin: '3px' } }, '🏅 ' + a.name))) : null,
      h('div.stat-grid', statRows.map(([k, v]) => h('div', h('span', k), h('b.num', String(v))))),
      h('div.row.center', { style: { marginTop: '10px' } },
        h('button.btn.ghost', { onclick: () => { stop(); app.show(r.mode === 'campaign' ? 'campaign' : 'title'); } }, '返回'),
        h('button.btn.ghost', { onclick: () => { stop(); app.restart(); } }, '重玩'),
        next ? h('button.btn.gold', { onclick: () => { stop(); app.brief(LEVELS[next]); } }, '下一关') : null,
        next ? h('button.btn', { onclick: () => { stop(); app.startLevel(LEVELS[next], { ai: true }); } }, '下一关交给 AI') : null),
      h('div.row.center', cdText));
    function stop() { if (countdown) clearInterval(countdown); countdown = null; }
    if (next && r.aiOnly && store().settings.autoNext) {
      let n = 8;
      cdText.textContent = `AI 将在 ${n} 秒后自动进入下一关……`;
      countdown = setInterval(() => {
        n--;
        if (!sheet.isConnected) return stop();
        cdText.textContent = `AI 将在 ${n} 秒后自动进入下一关……`;
        if (n <= 0) { stop(); app.startLevel(LEVELS[next], { ai: true, auto: true }); }
      }, 1000);
    }
    this.mount(h('div.screen', h('div.veil', sheet)));
  }

  // ------------------------------------------------------------------ expedition / endless
  expedition(opts = {}) {
    const app = this.app;
    const st = { biome: 'valley', diff: 2, seed: Math.floor(Math.random() * 1e6), mutators: [], endless: !!opts.endless };
    const body = h('div');
    const draw = () => {
      clear(body);
      const pill = (on, label, f) => h('button', { class: 'pill' + (on ? ' on' : ''), onclick: () => { f(); draw(); } }, label);
      body.append(
        h('div.form-row', h('label', '模式'), h('div.pillset', pill(!st.endless, '远征', () => { st.endless = false; }), pill(st.endless, '无尽', () => { st.endless = true; }))),
        h('div.form-row', h('label', '土地'), h('div.pillset', Object.entries(BIOMES).map(([id, b]) => pill(st.biome === id, b.name, () => { st.biome = id; })))),
        h('div.form-row', h('label', '难度'), h('div.pillset', [1, 2, 3, 4, 5].map((d) => pill(st.diff === d, '◆'.repeat(d), () => { st.diff = d; })))),
        h('div.form-row', h('label', '种子'), h('input', { type: 'number', value: st.seed, style: { width: '120px', fontFamily: 'var(--num)', fontSize: '15px' }, onchange: (e) => { st.seed = Math.abs(parseInt(e.target.value, 10) || 1); } }),
          h('button.btn.small.ghost', { onclick: () => { st.seed = Math.floor(Math.random() * 1e6); draw(); } }, '随机')),
        h('h3', { style: { marginTop: '10px' } }, '修正'),
        h('div.mutators', MUTATORS.map((m) => h('button', { class: 'mut' + (st.mutators.includes(m.id) ? ' on' : ''), onclick: () => { st.mutators = st.mutators.includes(m.id) ? st.mutators.filter((x) => x !== m.id) : [...st.mutators, m.id]; draw(); } }, h('div', h('b', m.name), h('small', m.desc))))),
        st.endless ? h('p.muted', `无尽记录：${store().stats.endlessBest} 天`) : null);
    };
    draw();
    const spec = () => ({ mode: st.endless ? 'endless' : 'expedition', biome: st.biome, diff: st.diff, seed: st.seed, mutators: st.mutators.slice() });
    const sheet = h('div.sheet.parch.wide',
      h('button.close', { onclick: () => app.show('campaign') }, '×'),
      h('h2', '远征 · 无尽'), h('div.scroll', { style: { minHeight: '0' } }, body),
      h('div.row.end', { style: { marginTop: '12px' } },
        h('button.btn.ghost', { onclick: () => app.startSpec(spec(), { ai: true }) }, img(iconURL('brain', 36)), ' 交给 AI'),
        h('button.btn.gold', { onclick: () => app.briefSpec(spec()) }, '出发')));
    this.mount(h('div.screen', h('div.veil', sheet)));
  }

  challenges() {
    const app = this.app, S = store();
    const sheet = h('div.sheet.parch.wide',
      h('button.close', { onclick: () => app.show('campaign') }, '×'),
      h('h2', '挑战'), h('p.muted', '战役关卡的残酷变体。'),
      h('div.scroll', { style: { minHeight: '0' } }, CHALLENGES.map((c) => {
        const p = S.progress[c.id];
        const base = LEVELS[c.base];
        return h('div.offer', h('div', { style: { width: '64px', flex: 'none' } }, img(artURL(BIOME_ART[base.biome], 64), '')),
          h('div', { style: { flex: '1' } }, h('b', { style: { fontSize: '17px' } }, c.name), h('div.muted', { style: { fontSize: '13px' } }, c.desc + ` · 基于 ${c.base}「${base.name}」`)),
          starsEl(p?.stars || 0),
          h('button.btn.small', { onclick: () => app.briefSpec({ mode: 'challenge', id: c.id }) }, '挑战'));
      })));
    this.mount(h('div.screen', h('div.veil', sheet)));
  }

  // ------------------------------------------------------------------ codex / achievements / settings
  codex() {
    const sheet = h('div.sheet.parch.wide', { style: { height: '90vh' } }, h('button.close', { onclick: () => this.app.show('title') }, '×'));
    this.mount(h('div.screen', h('div.veil', sheet)));
    renderCodex(sheet, {});
  }

  achievements() {
    const S = store();
    const got = ACHIEVEMENTS.filter((a) => S.ach[a.id]).length;
    const sheet = h('div.sheet.parch.wide',
      h('button.close', { onclick: () => this.app.show('title') }, '×'),
      h('h2', '成就'), h('p.muted', `${got}/${ACHIEVEMENTS.length} · 战役 ${Object.values(S.progress).filter((p) => p.won).length} 关通过 · 累计 ${S.stats.wins} 胜 · AI 通关 ${S.stats.aiWins} 次`),
      h('div.scroll', { style: { minHeight: '0' } }, h('div.ach-grid', ACHIEVEMENTS.map((a) => h('div', { class: 'ach' + (S.ach[a.id] ? '' : ' off') }, h('div.medal.title-font', a.icon), h('div', h('b', a.name), h('small', a.desc)))))));
    this.mount(h('div.screen', h('div.veil', sheet)));
  }

  settings(back) {
    const app = this.app, S = store();
    const set = S.settings;
    const range = (key, fn) => h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: set[key], oninput: (e) => { set[key] = +e.target.value; fn && fn(); app.saveSettings(); } });
    const check = (key, fn) => h('input', { type: 'checkbox', checked: !!set[key], onchange: (e) => { set[key] = e.target.checked; fn && fn(); app.saveSettings(); } });
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const ok = importData(await f.text());
      app.hudToast(ok ? '存档已导入' : '导入失败：文件无效');
      this.settings(back);
    } });
    const sheet = h('div.sheet.parch',
      h('button.close', { onclick: () => (back ? back() : app.show('title')) }, '×'),
      h('h2', '设置'),
      h('div.settings-grid',
        h('span', '总音量'), range('master', () => app.applyAudio()),
        h('span', '音乐'), range('music', () => app.applyAudio()),
        h('span', '音效'), range('sfx', () => app.applyAudio()),
        h('span', '精简特效（低配设备）'), check('lowFx', () => { app.view.lowFx = set.lowFx; }),
        h('span', '显示 AI 之手'), check('showHand', () => { app.view.showHand = set.showHand; }),
        h('span', 'AI 通关后自动进入下一关'), check('autoNext'),
        h('span', '手动操作时自动接管 AI'), check('takeover'),
        h('span', '教程提示与事件弹窗'), check('tutorial'),
        h('span', '解锁全部关卡（观看 AI 用）'), check('unlockAll')),
      h('div.divider'),
      h('div.row',
        h('button.btn.small.ghost', { onclick: () => download('emberstack-save.json', exportData()) }, '导出存档'),
        h('button.btn.small.ghost', { onclick: () => fileIn.click() }, '导入存档'), fileIn,
        h('span.spacer'),
        h('button.btn.small', { onclick: () => { if (confirm('清除所有进度、成就与设置？此操作无法撤销。')) { resetAll(); app.applyAudio(); this.settings(back); } } }, '重置全部进度')));
    this.mount(h('div.screen', h('div.veil', sheet)));
  }

  pause() {
    const app = this.app;
    const sheet = h('div.sheet.parch', { style: { width: 'min(420px, 100%)', textAlign: 'center' } },
      h('h2', '暂停'),
      h('div.menu-col',
        h('button.btn', { onclick: () => app.closePause() }, '继续'),
        h('button.btn.ghost', { onclick: () => { app.hud.openCodex(); app.closePause(true); } }, '图鉴'),
        h('button.btn.ghost', { onclick: () => this.settings(() => this.pause()) }, '设置'),
        h('button.btn.ghost', { onclick: () => app.restart() }, '重新开始'),
        h('button.btn.ghost', { onclick: () => app.quit() }, '保存并退出')));
    this.mount(h('div.screen', h('div.veil', sheet)));
  }
}

export function isUnlocked(id, S) {
  const ids = Object.keys(LEVELS);
  const i = ids.indexOf(id);
  if (i <= 0) return true;
  // a level opens when the previous one is won; the first level of a chapter also needs its predecessor
  return !!S.progress[ids[i - 1]]?.won;
}

function iconCanvas(name, px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const i = new Image();
  i.src = iconURL(name, px, '#f6a032');
  const g = c.getContext('2d');
  i.onload = () => g.drawImage(i, 0, 0);
  return c;
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
