// The title screen: create a world (geography preset, starting epoch, mode, size, seed and fine
// tuning), continue the autosave, load a file, or open the experiment lab.

import { h, $, esc } from './dom.js';
import { icon } from './icons.js';
import { PRESETS } from '../sim/worldgen.js';
import { createPreview } from '../sim/world.js';
import { TerrainRenderer } from '../render/terrain.js';
import { SCENARIOS } from './scenarios.js';
import { loadSlot, readMaybeGzip, getLocal, setLocal } from './storage.js';
import { restore, fromJSON } from '../sim/serialize.js';

const STARTS = [
  ['primordial', '原初之海', '只有海洋里的简单生命。登陆、飞行、智慧都要靠演化。'],
  ['flourishing', '万物繁盛', '各类原生物种遍布世界，智慧尚未出现。'],
  ['tribes', '部落黎明', '万物繁盛，几支智慧种族刚刚点燃篝火。'],
  ['kingdoms', '王国林立', '诸王国已经在大地上建立，直接进入历史。'],
  ['barren', '荒芜之地', '没有任何生命，一切由你创造。'],
];

const SIZES = [['small', '小'], ['medium', '中'], ['large', '大']];

export function showStart(game, ui) {
  const prev = getLocal('lastSetup', {});
  const st = {
    preset: prev.preset || 'continents',
    start: prev.start || 'tribes',
    size: prev.size || 'medium',
    mode: prev.mode || 'sandbox',
    seed: String(Math.floor(Math.random() * 1e6)),
    land: null, mountains: 1, temp: 0, wet: 1,
  };
  const el = h('div#start');
  const wrap = h('div.wrap');
  el.append(wrap);
  wrap.append(
    h('h1.title-big', { text: '万象' }),
    h('div.title-en', { text: 'MYRIAD · A GENESIS SANDBOX' }),
    h('div.tagline', { html: '大地自己隆起，生命自己演化，文明自己兴亡。<br>你是风、是雷、是奇迹——<em>你没有名字，直到他们为你命名。</em>' }),
  );
  const grid = h('div.start-grid');
  wrap.append(grid);

  // left: geography presets
  const left = h('div.start-card.panel');
  left.append(h('h3', { text: '选择一个世界' }));
  const presets = h('div.presets');
  left.append(presets);
  const previews = [];
  for (const key in PRESETS) {
    const p = PRESETS[key];
    const cv = h('canvas', { width: 224, height: 140 });
    const b = h('button.preset', { dataset: { preset: key } }, cv, h('div.pn', { text: p.name }), h('div.pd', { text: p.desc }));
    b.addEventListener('click', () => { st.preset = key; sync(); });
    presets.append(b);
    previews.push([key, cv]);
  }
  grid.append(left);

  // right: settings
  const right = h('div.start-card.panel');
  right.append(h('h3', { text: '创世的条件' }));
  const segRow = (label, items, key, hint) => {
    const seg = h('div.seg');
    for (const [v, name, title] of items) {
      const b = h('button', { text: name, title: title || '', dataset: { v } });
      b.addEventListener('click', () => { st[key] = v; sync(); });
      seg.append(b);
    }
    const row = h('div.form-row', {}, h('label', { text: label }), seg);
    if (hint) row.append(h('div.hint', { dataset: { hint: key } }));
    seg.dataset.key = key;
    return row;
  };
  right.append(segRow('起点', STARTS.map(([v, n, d]) => [v, n, d]), 'start', true));
  right.append(segRow('模式', [['sandbox', '沙盒', '神力无限，随心所欲'], ['divine', '神途', '神力来自信徒的崇拜，需要经营信仰']], 'mode', true));
  right.append(segRow('大小', SIZES.map(([v, n]) => [v, n]), 'size'));
  const seedIn = h('input.input', { value: st.seed });
  seedIn.addEventListener('input', () => { st.seed = seedIn.value; drawPreviews(); });
  const dice = h('button.btn.ghost', { html: icon('dice', 16), title: '随机种子' });
  dice.addEventListener('click', () => { st.seed = String(Math.floor(Math.random() * 1e6)); seedIn.value = st.seed; drawPreviews(); });
  right.append(h('div.form-row', {}, h('label', { text: '世界种子（相同的种子生成相同的世界）' }), h('div.seed-row', {}, seedIn, dice)));
  const adv = h('details');
  adv.append(h('summary', { text: '细节调整', style: { cursor: 'pointer', color: 'var(--dim)', marginBottom: '8px' } }));
  const slider = (label, min, max, stepv, key, fmt) => {
    const out = h('output', { text: fmt(st[key] ?? PRESETS[st.preset].land) });
    const inp = h('input', { type: 'range', min, max, step: stepv, value: st[key] ?? PRESETS[st.preset].land });
    inp.addEventListener('input', () => { st[key] = Number(inp.value); out.textContent = fmt(st[key]); if (key === 'land' || key === 'mountains') drawPreviews(); });
    return h('div.slider-row', { style: { gridTemplateColumns: '64px 1fr 44px' } }, h('span', { text: label }), inp, out);
  };
  adv.append(slider('陆地比例', 0.08, 0.6, 0.01, 'land', (v) => Math.round(v * 100) + '%'));
  adv.append(slider('山脉', 0.3, 2.2, 0.05, 'mountains', (v) => v.toFixed(2)));
  adv.append(slider('气温', -15, 15, 1, 'temp', (v) => (v > 0 ? '+' : '') + v + '°'));
  adv.append(slider('湿度', 0.4, 1.8, 0.05, 'wet', (v) => '×' + v.toFixed(2)));
  right.append(adv);
  const actions = h('div.start-actions');
  const go = h('button.btn.big', { html: icon('globe', 18) + '创造世界' });
  go.addEventListener('click', () => {
    setLocal('lastSetup', { preset: st.preset, start: st.start, size: st.size, mode: st.mode });
    close();
    ui.loading('世界正在从虚空中浮现……', () => {
      game.newWorld({ seed: st.seed, preset: st.preset, start: st.start, size: st.size, mode: st.mode, land: st.land ?? undefined, mountains: st.mountains, temp: st.temp, wet: st.wet, name: `${PRESETS[st.preset].name} · ${st.seed}` });
      game.setSpeed(1);
      ui.afterNewWorld();
    });
  });
  actions.append(go);
  right.append(actions);
  grid.append(right);

  // bottom: continue / load / lab
  const more = h('div.start-actions');
  const cont = h('button.btn.ghost.big', { html: icon('play', 16) + '继续上次的世界' });
  cont.disabled = true;
  loadSlot('autosave').then((s) => {
    if (s && s.snap) {
      cont.disabled = false;
      cont.innerHTML = icon('play', 16) + `继续：${esc(s.meta?.name || '')} · ${s.meta?.year ?? 0} 年`;
      cont.onclick = () => { close(); ui.loading('正在唤醒世界……', () => { const w = restore(s.snap); game.setWorld(w, true); game.setSpeed(0); ui.afterNewWorld(); }); };
    }
  }).catch(() => {});
  const load = h('button.btn.ghost.big', { html: icon('load', 16) + '打开存档文件' });
  const file = h('input', { type: 'file', accept: '.myriad,.json,.gz', style: { display: 'none' } });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const text = await readMaybeGzip(f);
      close();
      ui.loading('正在读取存档……', () => { game.setWorld(fromJSON(text), true); game.setSpeed(0); ui.afterNewWorld(); });
    } catch (e) { alert('无法读取存档：' + e.message); }
  });
  load.addEventListener('click', () => file.click());
  const lab = h('button.btn.ghost.big', { html: icon('fork', 16) + '实验室' });
  lab.addEventListener('click', () => showLab());
  more.append(cont, load, lab, file);
  wrap.append(more);
  wrap.append(h('div.foot-note', { html: '地形、气候、河流、生态、演化、城市、贸易、科技、外交、战争、信仰与社会变革都在自主运转。<br>按 <kbd>?</kbd> 查看帮助 · 所有内容由代码实时生成，离线可玩' }));

  function showLab() {
    const box = h('div.scenarios');
    for (const s of SCENARIOS) {
      const b = h('button.scn', { html: `<b>${esc(s.name)}</b><span>${esc(s.desc)}</span>` });
      b.addEventListener('click', () => {
        close();
        document.querySelector('.modal-back')?.remove();
        ui.loading(`实验「${s.name}」准备中……`, () => {
          game.newWorld({ ...s.opts, seed: String(Math.floor(Math.random() * 1e6)), name: `实验 · ${s.name}`, scenario: s.id, setup: s.setup });
          game.setSpeed(1);
          ui.afterNewWorld();
        });
      });
      box.append(b);
    }
    ui.modals.open('实验室', box, { narrow: false });
  }

  function sync() {
    el.querySelectorAll('.preset').forEach((b) => b.classList.toggle('on', b.dataset.preset === st.preset));
    el.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === st[seg.dataset.key])));
    const sh = el.querySelector('[data-hint="start"]');
    if (sh) sh.textContent = STARTS.find((s) => s[0] === st.start)[2];
    const mh = el.querySelector('[data-hint="mode"]');
    if (mh) mh.textContent = st.mode === 'divine' ? '神力需要靠信徒的崇拜积累：回应祈祷、让文明为你立教。' : '神力无限，所有工具随意使用。';
  }

  let previewToken = 0;
  function drawPreviews() {
    const token = ++previewToken;
    let i = 0;
    const next = () => {
      if (token !== previewToken || i >= previews.length || !el.isConnected) return;
      const [key, cv] = previews[i++];
      const w = createPreview({ preset: key, seed: st.seed, land: key === st.preset && st.land != null ? st.land : undefined, mountains: st.mountains, W: 112, H: 70 });
      const tr = new TerrainRenderer(w, (cw, ch) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; });
      tr.update(1e9, 0);
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tr.canvas, 0, 0, cv.width, cv.height);
      setTimeout(next, 0);
    };
    next();
  }

  function close() { previewToken++; el.remove(); }
  game.root.append(el);
  sync();
  setTimeout(drawPreviews, 30);
  ui.startScreen = el;
}
