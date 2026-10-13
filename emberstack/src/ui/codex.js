// The codex (图鉴): every card the player has met, every recipe known or hinted, the tech tree,
// the bestiary and a rules primer. Shared by the main menu and the in-game pause.

import { h, clear } from './dom.js';
import { CARDS, ALL_CARD_IDS } from '../data/cards.js';
import { RECIPES, recipeInputsText } from '../data/recipes.js';
import { TECHS, ERAS } from '../data/techs.js';
import { cardSprite, KIND_STYLE, RARITY, cardRole } from '../render/cardface.js';
import { store } from './store.js';

const KIND_ORDER = ['folk', 'food', 'resource', 'tool', 'gear', 'structure', 'wonder', 'node', 'region', 'beast', 'enemy', 'lair', 'knowledge', 'coin', 'bundle', 'event', 'misc'];

/** a <canvas> showing a card face, drawn from the sprite cache */
export function cardCanvas(id, w = 110) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * dpr);
  c.height = Math.round((w * 150 / 110) * dpr);
  c.style.width = '100%';
  c.style.aspectRatio = '110 / 150';
  c.style.borderRadius = '6px';
  const s = cardSprite(id, (w / 110) * dpr, true);
  c.getContext('2d').drawImage(s, 0, 0, c.width, c.height);
  return c;
}

function nameOf(k) { return CARDS[k]?.name || k; }

export function recipeLine(r, known = true) {
  const outs = r.out.map(([id, n]) => nameOf(id) + (n > 1 ? '×' + n : '')).join('、') || (r.kind === 'explore' ? '探索' : '—');
  if (!known) return h('div.recipe-row.hidden-r', h('span.rn', '？？？'), h('span.ing', r.hint && store().hints.includes(r.id) ? '线索：' + r.hint : '尚未发现的隐藏配方'));
  return h('div', { class: 'recipe-row' + (r.hidden ? ' hidden-r' : '') },
    h('span.rn', r.name),
    h('span.ing', recipeInputsText(r) + '  →  ' + outs),
    r.tech ? h('span.muted', { style: { fontSize: '12px' } }, '需「' + (TECHS[r.tech]?.name || r.tech) + '」') : null);
}

function isGenerated(r) { return r.kind === 'harvest' || r.kind === 'explore' || r.id.startsWith('harvest_') || r.id.startsWith('explore_'); }

export function renderCodex(root, opts = {}) {
  const S = store();
  const seen = new Set(S.seen);
  const all = opts.revealAll;
  let tab = opts.tab || 'cards';
  const body = h('div.scroll', { style: { flex: '1', minHeight: '0', paddingRight: '6px' } });
  const tabs = h('div.tabs');
  const TABS = [['cards', '卡牌'], ['recipes', '配方'], ['techs', '科技'], ['bestiary', '敌人'], ['help', '玩法']];
  const draw = () => {
    clear(tabs);
    for (const [id, label] of TABS) tabs.appendChild(h('button', { class: 'tab' + (tab === id ? ' on' : ''), onclick: () => { tab = id; draw(); } }, label));
    clear(body);
    if (tab === 'cards') cardsTab(body, seen, all);
    else if (tab === 'recipes') recipesTab(body, all);
    else if (tab === 'techs') techTab(body);
    else if (tab === 'bestiary') bestiaryTab(body, seen, all);
    else helpTab(body);
  };
  const nSeen = ALL_CARD_IDS.filter((id) => seen.has(id)).length;
  root.appendChild(h('div.row', h('h2', '图鉴'), h('span.muted', `已见 ${nSeen}/${ALL_CARD_IDS.length} 张卡牌 · 已发现 ${S.recipes.filter((r) => RECIPES[r]?.hidden).length}/${Object.values(RECIPES).filter((r) => r.hidden).length} 个隐藏配方`)));
  root.appendChild(tabs);
  root.appendChild(body);
  draw();
}

function cardsTab(body, seen, all) {
  const detail = h('div');
  body.appendChild(detail);
  const showDetail = (id) => {
    clear(detail);
    detail.appendChild(cardDetail(id));
    detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const queue = [];
  for (const kind of KIND_ORDER) {
    const ids = ALL_CARD_IDS.filter((id) => CARDS[id].kind === kind);
    if (!ids.length) continue;
    body.appendChild(h('h3', { style: { margin: '14px 0 6px' } }, KIND_STYLE[kind].label + ` · ${ids.filter((i) => all || seen.has(i)).length}/${ids.length}`));
    const grid = h('div.codex-grid');
    for (const id of ids) {
      const known = all || seen.has(id);
      const cell = h('div.cc', { onclick: known ? () => showDetail(id) : null, title: known ? CARDS[id].name : '尚未遇见' });
      if (known) {
        const slot = h('div', { style: { aspectRatio: '110 / 150' } });
        cell.appendChild(slot);
        cell.appendChild(h('div', CARDS[id].name));
        queue.push([slot, id]);
      } else {
        cell.appendChild(h('div.unknown', '？'));
        cell.appendChild(h('div', '？？？'));
      }
      grid.appendChild(cell);
    }
    body.appendChild(grid);
  }
  // paint the faces progressively so the dialog opens instantly
  const step = () => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 12) {
      const [slot, id] = queue.shift();
      if (slot.isConnected) slot.appendChild(cardCanvas(id, 104));
    }
    if (queue.length && body.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function cardDetail(id) {
  const d = CARDS[id];
  const S = store();
  const known = (r) => !r.hidden || S.recipes.includes(r.id);
  const makes = Object.values(RECIPES).filter((r) => !isGenerated(r) && r.out.some(([o]) => o === id));
  const uses = Object.values(RECIPES).filter((r) => !isGenerated(r) && (r.in[id] || r.keep[id] || Object.keys(r.in).concat(Object.keys(r.keep)).some((k) => k[0] === '#' && d.tags.includes(k.slice(1)))));
  const rar = RARITY[d.rarity] || RARITY.common;
  const box = h('div.codex-detail');
  const left = h('div', { style: { width: '150px', flex: 'none' } }, cardCanvas(id, 150));
  box.appendChild(left);
  box.appendChild(h('div', { style: { flex: '1', minWidth: '0' } },
    h('h3', d.name + '  ', h('small.muted', { style: { fontSize: '13px' } }, `${KIND_STYLE[d.kind].label} · ${rar.name}`)),
    h('p', { style: { margin: '4px 0 8px', lineHeight: '1.6' } }, d.desc),
    h('div.muted', { style: { fontSize: '13px' } }, cardRole(d)),
    makes.length ? h('div', h('b', '获得方式'), makes.slice(0, 6).map((r) => recipeLine(r, known(r)))) : null,
    uses.length ? h('div', h('b', '用途'), uses.slice(0, 8).map((r) => recipeLine(r, known(r)))) : null,
  ));
  return box;
}

function recipesTab(body, all) {
  const S = store();
  const byTech = new Map();
  for (const r of Object.values(RECIPES)) {
    if (isGenerated(r)) continue;
    const era = r.tech ? TECHS[r.tech]?.era || 1 : 1;
    const k = r.hidden ? 'hidden' : era;
    if (!byTech.has(k)) byTech.set(k, []);
    byTech.get(k).push(r);
  }
  for (const e of ERAS) {
    const list = byTech.get(e.id) || [];
    if (!list.length) continue;
    body.appendChild(h('h3', { style: { margin: '12px 0 4px', color: e.color } }, `${e.name}时代 · ${list.length} 个配方`));
    for (const r of list) body.appendChild(recipeLine(r, true));
  }
  const hid = byTech.get('hidden') || [];
  body.appendChild(h('h3', { style: { margin: '14px 0 4px' } }, `隐藏配方 · ${hid.filter((r) => all || S.recipes.includes(r.id)).length}/${hid.length}`));
  body.appendChild(h('p.muted', { style: { fontSize: '13px', margin: '0 0 6px' } }, '隐藏配方不会出现在任何列表里——只能靠尝试、残卷上的线索，或者看 AI 做实验时偶然撞见。'));
  for (const r of hid) body.appendChild(recipeLine(r, all || S.recipes.includes(r.id)));
}

function techTab(body) {
  const tree = h('div.techtree');
  for (const e of ERAS) {
    const col = h('div.era', h('div.era-h', { style: { background: e.color } }, e.name));
    for (const t of Object.values(TECHS).filter((x) => x.era === e.id)) {
      col.appendChild(h('div.tech', h('span.cost', t.cost ? '✦' + t.cost : ''), h('b', t.name), t.desc, t.req.length ? h('div.muted', { style: { fontSize: '11px' } }, '前置：' + t.req.map((r) => TECHS[r].name).join('、')) : null));
    }
    tree.appendChild(col);
  }
  body.appendChild(tree);
}

function bestiaryTab(body, seen, all) {
  const ids = ALL_CARD_IDS.filter((id) => ['enemy', 'lair', 'beast'].includes(CARDS[id].kind));
  const TIPS = {
    armored: '有甲：穿刺伤害减半，钝击（木棒、铁锤、锤卫）克制。', shade: '暗影：非光芒伤害减半；畏光，黎明消散。掌灯人、守火者与焰刃克制。',
    flying: '飞行：近战只能造成三分之一伤害，需要弓手或火铳手。', boss: '首领：会召唤手下。准备充足再去挑战。', burning: '灼烧：近战攻击它可能被反烧。',
    regen: '再生：每秒回复生命，必须集中火力。', swarm: '成群：单个很弱，但会一拥而上。',
  };
  for (const id of ids) {
    const d = CARDS[id];
    const known = all || seen.has(id);
    const row = h('div.codex-detail', { style: { alignItems: 'flex-start' } });
    row.appendChild(h('div', { style: { width: '90px', flex: 'none' } }, known ? cardCanvas(id, 90) : h('div.unknown', '？')));
    if (known) {
      row.appendChild(h('div', { style: { flex: '1' } },
        h('b', { style: { fontSize: '17px' } }, d.name), h('span.muted', `  生命 ${d.hp} · 攻击 ${d.atk || 0} · 护甲 ${d.def || 0}`),
        h('p', { style: { margin: '4px 0' } }, d.desc),
        (d.traits || []).filter((t) => TIPS[t]).map((t) => h('div', { style: { fontSize: '13px', color: '#6a3a22' } }, '• ' + TIPS[t]))));
    } else row.appendChild(h('div.muted', '尚未遭遇。'));
    body.appendChild(row);
  }
}

function helpTab(body) {
  const P = (t) => h('p', { style: { lineHeight: '1.75', margin: '4px 0 10px' } }, t);
  body.appendChild(h('div', { style: { maxWidth: '760px' } },
    h('h3', '堆叠即行动'), P('把一张卡拖到另一张卡上，它们就叠成一堆。当一堆卡正好凑齐某个配方时，进度条会出现，时间到了就会产出新卡。人物是“劳力”：把人叠在树上就会砍树，叠在刻石上就会记录见闻，叠在篝火和生鱼上就会烤鱼。'),
    h('h3', '昼夜与光'), P('一天大约 72 秒（1 倍速）。入夜后，没有光的地方无法工作，暗影会从灰雾中走出来。篝火、火把桩、灯柱照亮周围；火把与灯笼可以叠在堆里随身携带。黎明时，每个人都要吃饭，燃料会被消耗。'),
    h('h3', '灰雾'), P('灰雾是这个世界的倒计时。它随时间上涨，暗影越多涨得越快；灯龛、石冢、庆典与灯塔能让它退散。某些关卡里，灰雾涨满就是失败。'),
    h('h3', '科技'), P('研究消耗“灵感”卡。把人叠在刻石、书斋上产出灵感，然后打开科技树研究。新科技解锁新的配方、建筑与职业。'),
    h('h3', '战斗'), P('把人物拖到敌人或野兽身上就会开战，更多的人可以加入同一场战斗。三种伤害：穿刺（对野兽好用）、钝击（无视护甲）、光芒（重创暗影）。飞行的敌人需要远程。'),
    h('h3', '季节'), P('春夏秋冬轮转。冬天作物休眠、篝火加倍耗柴、人们胃口更大。秋天是储粮的季节：谷仓、风干、腌制。'),
    h('h3', 'AI 玩家'), P('点亮右侧的「AI 自动游玩」，一位会思考的 AI 就会接手：它看到的和你一样，用和你一样的拖拽来操作，必须遵守同样的规则。你随时可以拖动卡牌接管，再点一下把控制权交还给它。右侧的决策日志会解释它在想什么。'),
    h('h3', '快捷键'), h('div', { style: { lineHeight: '2' } },
      ...[['空格', '暂停/继续'], ['1–5', '速度 1×/2×/4×/8×/16×'], ['A', 'AI 开关'], ['T', '科技树'], ['C', '图鉴'], ['F', '镜头对准营地'], ['H', '隐藏界面（观战）'], ['Esc', '菜单'], ['滚轮/双指', '缩放'], ['拖拽空地/右键', '平移']].map(([k, v]) => h('div', h('span.kbd', k), '  ', v))),
  ));
}
