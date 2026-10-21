// Module 8 — cellular automata: Conway's Game of Life (and other B/S rules) on a torus with a
// pattern library, drawing tools, trails and cycle detection; and Wolfram's one-dimensional rules.

import { h } from '../ui/dom.js';
import { Layer, Viewport, observeSize, attachPointer, animationLoop } from '../ui/canvas.js';
import { section, slider, toggle, segmented, button, chips, readout, iconButton } from '../ui/controls.js';
import { C, MONO } from '../ui/theme.js';
import { Life, parseRule, PATTERNS, elementary, RULES_1D } from '../core/life.js';

const GW = 240, GH = 150; // torus size (cells)
const RULES_2D = [
  { id: 'life', label: '康威生命', rule: 'B3/S23' },
  { id: 'high', label: '高生命', rule: 'B36/S23', note: '多了“6 个邻居也出生”：出现会自我复制的“复制子”。' },
  { id: 'seeds', label: '种子', rule: 'B2/S', note: '细胞活不过一代，却能爆炸式扩张。' },
  { id: 'day', label: '昼夜', rule: 'B3678/S34678', note: '活细胞与死细胞的地位对称：黑白反转后规则不变。' },
  { id: 'maze', label: '迷宫', rule: 'B3/S12345', note: '长成迷宫般的通道。' },
  { id: 'ink', label: '墨迹', rule: 'B3/S012345678', note: '“没有死亡的生命”：图案只增不减，像墨迹晕开。' },
];

// age → colour: newborn near-white, then cyan, blue, violet
function ageColour(age) {
  const t = Math.min(1, Math.log(age) / Math.log(80));
  const stops = [[236, 254, 255], [103, 232, 249], [122, 162, 255], [167, 139, 250]];
  const u = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(u)), f = u - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * f);
}
const AGE_LUT = Array.from({ length: 256 }, (_, a) => ageColour(Math.max(1, a)));

function create({ stage, panel, toast, query, setQuery }) {
  const st = {
    mode: query.get('mode') === '1d' ? '1d' : '2d',
    playing: true,
    speed: 20, // generations per second (61 = as fast as possible)
    tool: 'draw',
    trails: true,
    grid: true,
    rule2d: 'B3/S23',
    rule1d: 30,
    init1d: 'single',
    rows1d: 0,
    pop: [],
  };
  try { if (query.get('rule')) st.rule2d = parseRule(query.get('rule')).text; } catch { /* default */ }
  const qr = Number(query.get('n'));
  if (query.get('n') && Number.isInteger(qr) && qr >= 0 && qr <= 255) st.rule1d = qr;

  const life = new Life(GW, GH, parseRule(st.rule2d));
  const start = PATTERNS[query.get('p')] ? query.get('p') : 'gun';
  life.place(PATTERNS[start].rle, Math.floor(GW / 2), Math.floor(GH / 2));

  // ------------------------------------------------------------------ DOM
  const layer = new Layer(stage);
  const info = h('div', { class: 'overlay-card tl', id: 'life-info' });
  const playBtn = iconButton({ iconName: 'pause', title: '播放 / 暂停（Space）', cls: 'play', id: 'life-play', onClick: () => setPlaying(!st.playing) });
  const transport = h('div', { class: 'transport' },
    iconButton({ iconName: 'trash', title: '清空（C）', id: 'life-clear', onClick: () => { life.clear(); st.pop = []; draw(); } }),
    playBtn,
    iconButton({ iconName: 'step', title: '前进一代（→）', id: 'life-step', onClick: () => { setPlaying(false); stepOnce(); } }),
    h('div', { class: 'sep' }),
    iconButton({ iconName: 'shuffle', title: '随机汤（R）', id: 'life-random', onClick: () => soup() }));
  stage.append(info, transport);

  const cellCanvas = document.createElement('canvas');
  cellCanvas.width = GW;
  cellCanvas.height = GH;
  const cellCtx = cellCanvas.getContext('2d');
  const cellImg = cellCtx.createImageData(GW, GH);
  const vp = new Viewport({ scale: 4 });

  // ------------------------------------------------------------------ simulation
  function stepOnce() {
    life.step();
    st.pop.push(life.population());
    if (st.pop.length > 600) st.pop.shift();
  }
  function soup() {
    life.randomize(densitySlider.value, Math.random, 0.6);
    st.pop = [];
    draw();
  }
  let acc = 0;
  const loop = animationLoop((dt) => {
    if (st.mode === '2d') {
      if (st.playing) {
        if (st.speed > 60) {
          const t0 = performance.now();
          while (performance.now() - t0 < 10) stepOnce();
        } else {
          acc += dt * st.speed;
          let n = 0;
          while (acc >= 1 && n < 8) { stepOnce(); acc -= 1; n++; }
          if (n === 8) acc = 0;
        }
      }
      draw();
    } else if (st.rows1d < oneD.gens) {
      st.rows1d = Math.min(oneD.gens, st.rows1d + Math.max(1, Math.round(dt * 160)));
      draw();
    }
  });
  function setPlaying(on) {
    st.playing = on;
    playBtn.innerHTML = '';
    const t = document.createElement('template');
    t.innerHTML = on
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/><rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5 v13 l11-6.5 z" fill="currentColor"/></svg>';
    playBtn.append(t.content.firstElementChild);
  }

  // ------------------------------------------------------------------ drawing
  function draw() {
    const { ctx } = layer;
    layer.reset();
    ctx.fillStyle = '#070a10';
    ctx.fillRect(0, 0, layer.w, layer.h);
    if (st.mode === '1d') { draw1D(ctx); return; }
    const d = cellImg.data;
    const { cells, age, heat } = life;
    for (let i = 0; i < cells.length; i++) {
      const q = 4 * i;
      if (cells[i]) {
        const c = AGE_LUT[Math.min(255, age[i])];
        d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2];
      } else {
        const hv = st.trails ? heat[i] : 0;
        d[q] = 12 + hv * 70; d[q + 1] = 15 + hv * 22; d[q + 2] = 24 + hv * 110;
      }
      d[q + 3] = 255;
    }
    cellCtx.putImageData(cellImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const x0 = vp.sx(0), y0 = vp.sy(0);
    ctx.drawImage(cellCanvas, x0, y0, GW * vp.scale, GH * vp.scale);
    if (st.grid && vp.scale >= 9) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const b = vp.bounds;
      for (let x = Math.max(0, Math.ceil(b.xmin)); x <= Math.min(GW, b.xmax); x++) { ctx.moveTo(vp.sx(x) + 0.5, y0); ctx.lineTo(vp.sx(x) + 0.5, y0 + GH * vp.scale); }
      for (let y = Math.max(0, Math.ceil(-b.ymax)); y <= Math.min(GH, -b.ymin); y++) { ctx.moveTo(x0, vp.sy(-y) + 0.5); ctx.lineTo(x0 + GW * vp.scale, vp.sy(-y) + 0.5); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, GW * vp.scale + 1, GH * vp.scale + 1);
    paintInfo();
  }

  // ------------------------------------------------------------------ one-dimensional rules
  const oneD = { width: 0, gens: 0, data: null, canvas: document.createElement('canvas') };
  function compute1D() {
    const W = layer.w || 800, H = layer.h || 600;
    const cell = Math.max(2, Math.floor(Math.min(W / 260, 6)));
    oneD.width = Math.floor(W / cell) | 1;
    oneD.gens = Math.floor((H - 70) / cell);
    oneD.cell = cell;
    oneD.data = elementary(st.rule1d, oneD.width, oneD.gens, st.init1d);
    const c = oneD.canvas;
    c.width = oneD.width;
    c.height = oneD.gens;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(oneD.width, oneD.gens);
    for (let i = 0; i < oneD.data.length; i++) {
      const g = Math.floor(i / oneD.width);
      const t = g / oneD.gens;
      const q = 4 * i;
      if (oneD.data[i]) { img.data[q] = 120 + 110 * (1 - t); img.data[q + 1] = 180 + 60 * (1 - t); img.data[q + 2] = 255; img.data[q + 3] = 255; }
      else { img.data[q] = 9; img.data[q + 1] = 12; img.data[q + 2] = 19; img.data[q + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
    st.rows1d = 0;
  }
  function draw1D(ctx) {
    const cell = oneD.cell;
    const w = oneD.width * cell;
    const x0 = Math.round((layer.w - w) / 2), y0 = 14;
    ctx.imageSmoothingEnabled = false;
    const rows = Math.max(1, st.rows1d);
    ctx.drawImage(oneD.canvas, 0, 0, oneD.width, rows, x0, y0, w, rows * cell);
    info.textContent = '';
    const note = RULES_1D.find((r) => r.rule === st.rule1d);
    info.append(h('div', { class: 'title' }, `一维规则 ${st.rule1d}`), h('div', { class: 'big', style: { maxWidth: '260px', fontFamily: 'inherit', fontSize: '12px', color: C.text2 } }, note ? note.note : '从上往下：每一行由上一行按规则逐格算出。'));
  }

  function paintInfo() {
    const pop = life.population();
    info.textContent = '';
    info.append(
      h('div', { class: 'title' }, `${life.rule.text} · ${GW}×${GH} 环面`),
      h('div', { class: 'big' }, `第 ${life.gen} 代`),
      h('div', { class: 'big', style: { color: C.text2 } }, `活细胞 ${pop}`));
    read.set('gen', String(life.gen));
    read.set('pop', String(pop));
    read.set('state', life.cycle ? (life.cycle.period === 1 ? `第 ${life.cycle.start} 代起静止` : `第 ${life.cycle.start} 代起周期 ${life.cycle.period}`) : pop ? '仍在演化' : '全部死亡', life.cycle || !pop ? 'good' : '');
    drawChart();
  }

  function drawChart() {
    const c = chart;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 300, hh = 70;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, w, hh);
    const p = st.pop;
    if (p.length < 2) return;
    const max = Math.max(...p, 1);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    p.forEach((v, i) => {
      const x = 4 + (i / (p.length - 1)) * (w - 8), y = hh - 6 - (v / max) * (hh - 16);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = C.text3;
    ctx.font = `10px ${MONO}`;
    ctx.fillText(`最多 ${max}`, 6, 11);
  }

  // ------------------------------------------------------------------ interaction
  let paintValue = 1;
  let lastCell = null;
  const cellAt = (x, y) => [Math.floor(x), Math.floor(-y)];
  const paintLine = (a, b) => {
    // all cells on the segment a → b
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let k = 0; k <= n; k++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * k) / n), y = Math.round(a[1] + ((b[1] - a[1]) * k) / n);
      if (x >= 0 && x < GW && y >= 0 && y < GH) life.set(x, y, paintValue);
    }
  };
  const detach = attachPointer(layer.canvas, vp, {
    hitTest: (px, py) => {
      if (st.mode !== '2d' || st.tool !== 'draw') return null;
      const [x, y] = cellAt(vp.wx(px), vp.wy(py));
      return x >= 0 && x < GW && y >= 0 && y < GH ? 'paint' : null;
    },
    cursor: () => 'cell',
    onDragStart(hd, x, y) {
      const c = cellAt(x, y);
      paintValue = life.get(c[0], c[1]) ? 0 : 1;
      life.set(c[0], c[1], paintValue);
      lastCell = c;
      draw();
    },
    onDrag(hd, x, y) {
      const c = cellAt(x, y);
      paintLine(lastCell, c);
      lastCell = c;
      draw();
    },
    onDragEnd() { lastCell = null; },
    onView: () => draw(),
  });

  const fit = (all = true) => {
    if (all) vp.fit(0, GW, -GH, 0, 0.02, { top: 0, bottom: 70, left: 0, right: 0 });
    else vp.fit(GW / 2 - 48, GW / 2 + 48, -(GH / 2 + 26), -(GH / 2 - 26), 0.02, { top: 0, bottom: 70, left: 0, right: 0 });
  };

  // ------------------------------------------------------------------ panel
  const modeSeg = segmented({
    id: 'life-mode',
    options: [{ value: '2d', label: '二维生命游戏' }, { value: '1d', label: '一维规则' }],
    value: st.mode,
    onChange: (v) => setMode(v),
  });
  const patternChips = chips({
    id: 'life-patterns',
    items: Object.entries(PATTERNS).map(([id, p]) => ({ id, label: p.label, title: p.note })),
    onPick: (id) => {
      const c = [Math.floor(vp.wx(layer.w / 2)), Math.floor(-vp.wy((layer.h - 70) / 2))];
      life.place(PATTERNS[id].rle, Math.min(GW - 1, Math.max(0, c[0])), Math.min(GH - 1, Math.max(0, c[1])));
      patternNote.textContent = `${PATTERNS[id].label}：${PATTERNS[id].note}（已放在视野中央）`;
      patternChips.set(null);
      draw();
    },
  });
  const patternNote = h('div', { class: 'hint', id: 'life-pattern-note' }, '点击图案，把它放到视野中央；可以叠加多个。');
  const densitySlider = slider({ label: '随机汤密度', min: 0.05, max: 0.7, step: 0.01, value: 0.32, format: (v) => `${Math.round(v * 100)}%` });
  const toolSeg = segmented({
    id: 'life-tool',
    options: [{ value: 'draw', label: '画细胞' }, { value: 'pan', label: '拖动视野' }],
    value: st.tool,
    onChange: (v) => { st.tool = v; },
  });
  const ruleChips = chips({
    id: 'life-rules',
    items: RULES_2D.map((r) => ({ id: r.id, label: r.label, title: r.rule })),
    value: RULES_2D.find((r) => r.rule === st.rule2d)?.id ?? null,
    onPick: (id) => setRule(RULES_2D.find((r) => r.id === id).rule),
  });
  const ruleInput = h('input', { class: 'text-input mono', type: 'text', id: 'life-rule', value: st.rule2d, spellcheck: 'false', 'aria-label': '规则' });
  const ruleNote = h('div', { class: 'hint' });
  ruleInput.addEventListener('input', () => {
    try { const r = parseRule(ruleInput.value); ruleInput.classList.remove('invalid'); setRule(r.text, { fromInput: true }); } catch { ruleInput.classList.add('invalid'); }
  });
  ruleInput.addEventListener('keydown', (e) => e.stopPropagation());
  function setRule(text, { fromInput = false } = {}) {
    life.rule = parseRule(text);
    life.edited();
    st.rule2d = life.rule.text;
    if (!fromInput) ruleInput.value = st.rule2d;
    const r = RULES_2D.find((x) => x.rule === st.rule2d);
    ruleChips.set(r ? r.id : null);
    ruleNote.textContent = r?.note || 'B 后的数字：死细胞有这么多活邻居就出生；S 后的数字：活细胞有这么多活邻居就存活。';
    syncQuery();
  }
  const read = readout([['gen', '代数'], ['pop', '活细胞'], ['state', '状态']], { id: 'life-readout' });
  const chart = h('canvas', { class: 'panel-canvas', id: 'life-chart', style: { height: '70px' } });
  const speedSlider = slider({ label: '速度（代 / 秒）', min: 1, max: 61, step: 1, value: st.speed, id: 'life-speed', format: (v) => (v > 60 ? '最快' : String(v)), onInput: (v) => { st.speed = v; } });

  // one-dimensional controls
  const rule1Slider = slider({ label: '规则编号', min: 0, max: 255, step: 1, value: st.rule1d, id: 'life-rule1d', format: (v) => String(v), onInput: (v) => set1D(v) });
  const bitsEl = h('div', { class: 'rule-bits', id: 'life-bits' });
  const rule1Chips = chips({ id: 'life-rules1d', items: RULES_1D.map((r) => ({ id: String(r.rule), label: r.label })), onPick: (id) => set1D(Number(id)) });
  const initSeg = segmented({ options: [{ value: 'single', label: '单个细胞' }, { value: 'random', label: '随机一行' }], value: st.init1d, onChange: (v) => { st.init1d = v; compute1D(); } });
  function paintBits() {
    bitsEl.textContent = '';
    for (let k = 7; k >= 0; k--) {
      const on = (st.rule1d >> k) & 1;
      const b = h('button', { type: 'button', class: `rule-bit ${on ? 'on' : ''}`, title: `邻域 ${k.toString(2).padStart(3, '0')} → ${on}` },
        h('span', { class: 'nbhd' }, [4, 2, 1].map((m) => h('i', { class: k & m ? 'on' : '' }))),
        h('span', { class: 'out' }, h('i', { class: on ? 'on' : '' })));
      b.addEventListener('click', () => set1D(st.rule1d ^ (1 << k)));
      bitsEl.append(b);
    }
  }
  function set1D(n) {
    st.rule1d = n;
    rule1Slider.set(n);
    rule1Chips.set(RULES_1D.some((r) => r.rule === n) ? String(n) : null);
    paintBits();
    compute1D();
    syncQuery();
  }

  const sec2d = [
    section('图案库', [patternChips.el, patternNote,
      h('div', { class: 'btn-row' }, button({ label: '随机汤', iconName: 'shuffle', small: true, onClick: soup }), button({ label: '清空', iconName: 'trash', small: true, onClick: () => { life.clear(); st.pop = []; draw(); } })),
      densitySlider.el]),
    section('规则', [ruleChips.el, ruleInput, ruleNote]),
    section('播放与绘制', [speedSlider.el, toolSeg.el,
      h('div', { class: 'toggles two' },
        toggle({ label: '余晖', value: st.trails, swatch: '#8a46c8', onChange: (v) => { st.trails = v; draw(); } }).el,
        toggle({ label: '网格线', value: st.grid, swatch: '#475569', onChange: (v) => { st.grid = v; draw(); } }).el),
      h('div', { class: 'hint' }, '“画细胞”时在网格上拖动：从死细胞开始拖是画，从活细胞开始拖是擦。滚轮缩放；颜色越白越年轻，紫色的细胞已经活了很久。')]),
    section('统计', [read.el, chart, h('div', { class: 'hint' }, '每一代都会记下整盘状态的指纹，一旦重复，就知道它从哪一代起进入了周期。')]),
  ];
  const sec1d = [
    section('规则', [rule1Slider.el, bitsEl, rule1Chips.el, initSeg.el,
      h('div', { class: 'hint' }, '上排三格是一个细胞和左右邻居，下面一格是它下一代的状态。8 种邻域各给 0 或 1，正好组成 0–255 的二进制编号；点击方块即可翻转。')]),
  ];
  panel.append(section('模式', [modeSeg.el]), ...sec2d, ...sec1d);

  function setMode(m) {
    st.mode = m;
    modeSeg.set(m);
    for (const s of sec2d) s.style.display = m === '2d' ? '' : 'none';
    for (const s of sec1d) s.style.display = m === '1d' ? '' : 'none';
    transport.style.display = m === '2d' ? '' : 'none';
    if (m === '1d') compute1D();
    draw();
    syncQuery();
  }

  function syncQuery() {
    setQuery({ mode: st.mode === '1d' ? '1d' : null, rule: st.mode === '2d' && st.rule2d !== 'B3/S23' ? st.rule2d : null, n: st.mode === '1d' ? st.rule1d : null });
  }

  const stopResize = observeSize(stage, (w, hh) => {
    const first = vp.w <= 1;
    layer.resize(w, hh);
    vp.setSize(w, hh);
    if (first) fit(false); // open close to the action; F shows the whole torus
    if (st.mode === '1d') compute1D();
    draw();
  });
  setRule(st.rule2d);
  paintBits();
  rule1Chips.set(RULES_1D.some((r) => r.rule === st.rule1d) ? String(st.rule1d) : null);
  setMode(st.mode);
  setPlaying(true);
  loop.start();

  return {
    help: {
      tips: [
        '康威生命游戏：死细胞恰有 3 个活邻居就出生，活细胞有 2 或 3 个活邻居就存活，否则死亡。棋盘上下、左右相连（环面）。',
        '从图案库放下滑翔机、飞船、振荡器或滑翔机枪；用“画细胞”自己设计。',
        '换一条规则（如 B36/S23 的高生命）看看同样的初值会长成什么。',
        '“一维规则”画出沃尔夫勒姆的 256 条初等元胞自动机：规则 30 的混沌、规则 90 的谢尔宾斯基三角、规则 110 的图灵完备。',
      ],
      keys: [['Space', '播放 / 暂停'], ['→', '前进一代'], ['R', '随机汤'], ['C', '清空'], ['F', '视野复位']],
    },
    onKey(e) {
      if (st.mode !== '2d') return;
      if (e.key === ' ') { setPlaying(!st.playing); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setPlaying(false); stepOnce(); draw(); }
      else if (e.key === 'r' || e.key === 'R') soup();
      else if (e.key === 'c' || e.key === 'C') { life.clear(); st.pop = []; draw(); }
      else if (e.key === 'f' || e.key === 'F') { fit(); draw(); }
    },
    snapshot: () => layer.canvas,
    state: () => ({ mode: st.mode, gen: life.gen, pop: life.population(), rule: life.rule.text, playing: st.playing, cycle: life.cycle, rule1d: st.rule1d, rows1d: st.rows1d }),
    cell: (x, y) => life.get(x, y),
    cellToClient(x, y) { const r = layer.canvas.getBoundingClientRect(); return [r.left + vp.sx(x + 0.5), r.top + vp.sy(-(y + 0.5))]; },
    setPlaying,
    destroy() { loop.stop(); detach(); stopResize(); },
  };
}

export default {
  id: 'life',
  title: '生命游戏',
  short: '生命',
  subtitle: '三条规则，长出滑翔机、振荡器和会自己造滑翔机的“枪”；还有沃尔夫勒姆的一维规则',
  icon: 'life',
  create,
};
