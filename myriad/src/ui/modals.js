// Dialogs: saves, the timeline, the codex, the species designer, the climate panel, settings
// and help.

import { h, esc } from './dom.js';
import { icon } from './icons.js';
import { saveSlot, loadSlot, deleteSlot, listSlots, gzipBlob, download, readMaybeGzip, setLocal } from './storage.js';
import { snapshot, restore, toJSON, fromJSON } from '../sim/serialize.js';
import { ACHIEVEMENTS } from '../sim/achievements.js';
import { ARCHETYPES, phenotype, FORM_CHAR, hueChar, featureChar } from '../sim/life/genome.js';
import { speciesColor } from '../sim/life/species.js';
import { GENES, GENE_LABELS, NG } from '../sim/constants.js';
import { drawGenomePreview } from '../render/sprites.js';
import { setClimate } from '../sim/powers.js';
import { year } from '../sim/state.js';

export function buildModals(game, ui) {
  const M = {};

  M.open = (title, body, opts = {}) => {
    document.querySelector('.modal-back')?.remove();
    const back = h('div.modal-back');
    const m = h('div.modal.panel');
    if (opts.narrow) m.classList.add('narrow');
    if (opts.wide) m.classList.add('wide');
    const head = h('div.modal-head', {}, h('h2', { text: title }));
    const x = h('button.ibtn', { html: icon('close', 18), title: '关闭（Esc）' });
    x.addEventListener('click', () => close());
    head.append(x);
    const b = h('div.modal-body');
    b.append(body);
    m.append(head, b);
    if (opts.foot) m.append(opts.foot);
    back.append(m);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    document.body.append(back);
    function close() { back.remove(); if (opts.onClose) opts.onClose(); }
    return { close, body: b, el: m };
  };

  M.close = () => document.querySelector('.modal-back')?.remove();

  // ---- saves
  M.saves = async () => {
    const body = h('div');
    const dlg = M.open('存档', body);
    const render = async () => {
      body.innerHTML = '';
      let slots = [];
      try { slots = await listSlots(); } catch { body.append(h('div.sub', { text: '此浏览器不允许本地存储（可能处于隐私模式），但仍可导出为文件。' })); }
      const keys = ['autosave', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
      const list = h('div.list');
      for (const k of keys) {
        const s = slots.find((x) => x.key === k);
        const meta = s && s.meta;
        const row = h('div.li', { style: { gridTemplateColumns: '96px 1fr auto' } });
        const img = h('div', { style: { width: '96px', height: '60px', borderRadius: '6px', background: '#10264a', backgroundSize: 'cover', backgroundImage: meta && meta.thumb ? `url(${meta.thumb})` : 'none' } });
        const info = h('div', { html: `<div class="nm">${k === 'autosave' ? '自动存档' : '存档位 ' + k.slice(4)}${meta ? ' · ' + esc(meta.name) : ''}</div><div class="meta">${meta ? `${meta.year} 年 · ${meta.nations} 国 · ${meta.species} 物种 · ${new Date(meta.date).toLocaleString()}` : '空'}</div>` });
        const btns = h('div', { style: { display: 'flex', gap: '4px' } });
        if (k !== 'autosave') {
          const sv = h('button.btn.ghost', { text: '保存' });
          sv.addEventListener('click', async () => { await saveSlot(k, { meta: game.saveMeta(), snap: snapshot(game.world) }); ui.toast('已保存到存档位 ' + k.slice(4)); render(); });
          btns.append(sv);
        }
        if (meta) {
          const ld = h('button.btn', { text: '读取' });
          ld.addEventListener('click', async () => {
            const data = await loadSlot(k);
            dlg.close();
            ui.loading('正在读取……', () => { const w = restore(data.snap); game.setWorld(w, true); game.setSpeed(0); ui.afterNewWorld(); });
          });
          const del = h('button.btn.ghost', { html: icon('trash', 14), title: '删除' });
          del.addEventListener('click', async () => { if (confirm('删除这个存档？')) { await deleteSlot(k); render(); } });
          btns.append(ld, del);
        }
        row.append(img, info, btns);
        list.append(row);
      }
      body.append(list);
      const row = h('div.row-btns', { style: { marginTop: '14px' } });
      const ex = h('button.btn', { html: icon('download', 15) + '导出为文件' });
      ex.addEventListener('click', async () => {
        const text = toJSON(game.world);
        const blob = await gzipBlob(text);
        download(blob, `万象-${game.world.name.replace(/[\\/:*?"<>|· ]+/g, '_')}-${year(game.world)}年.myriad`);
      });
      const file = h('input', { type: 'file', accept: '.myriad,.json,.gz', style: { display: 'none' } });
      file.addEventListener('change', async () => {
        const f = file.files[0];
        if (!f) return;
        try { const text = await readMaybeGzip(f); dlg.close(); ui.loading('正在读取……', () => { game.setWorld(fromJSON(text), true); game.setSpeed(0); ui.afterNewWorld(); }); } catch (e) { alert('无法读取存档：' + e.message); }
      });
      const im = h('button.btn.ghost', { html: icon('upload', 15) + '从文件读取' });
      im.addEventListener('click', () => file.click());
      const shot = h('button.btn.ghost', { html: icon('camera', 15) + '截图' });
      shot.addEventListener('click', () => game.R.canvas.toBlob((b) => download(b, `万象-${year(game.world)}年.png`)));
      row.append(ex, im, shot, file);
      body.append(row, h('div.sub', { style: { marginTop: '10px' }, text: '存档包含整个世界的完整状态（地形、每一个生物、每一座城市与全部历史），同一存档继续运行会得到完全相同的未来。' }));
    };
    render();
  };

  // ---- timeline
  M.timeline = () => {
    const body = h('div');
    const dlg = M.open('时间线', body, { wide: true });
    const render = () => {
      body.innerHTML = '';
      body.append(h('div.sub', { html: '世界每隔一段时间会被记录下来。回到任何一个时刻，历史就会从那里重新展开——因为每一次干预都会改变后来的一切，你可以探索「如果当初……」的不同未来。' }));
      const tl = h('div.tl');
      game.timeline.forEach((it, i) => {
        const card = h('div.tl-item', { title: '回到这一刻' });
        card.append(it.thumb ? h('img', { src: it.thumb }) : h('canvas'), h('div.ty', { text: `${it.year} 年` }), h('div.td', { text: it.desc + (it.branch ? ` · 支线 ${it.branch}` : '') }));
        card.addEventListener('click', () => {
          if (!confirm(`回到 ${it.year} 年？之后的历史将被改写（之后的快照会被丢弃）。`)) return;
          game.rewind(i);
          dlg.close();
        });
        tl.append(card);
      });
      body.append(tl);
      const row = h('div.row-btns');
      const now = h('button.btn', { html: icon('camera', 15) + '记录此刻' });
      now.addEventListener('click', () => { game.takeSnapshot(); render(); });
      const sel = h('select', { style: { width: 'auto' } });
      for (const v of [10, 25, 50, 100, 200, 500]) sel.append(h('option', { value: v, text: `每 ${v} 年自动记录` }));
      sel.value = game.snapEvery;
      sel.addEventListener('change', () => { game.snapEvery = Number(sel.value); });
      row.append(now, sel);
      body.append(row);
    };
    render();
  };

  // ---- codex
  M.codex = () => {
    document.querySelector('#btn-codex .dot')?.remove();
    const w = game.world;
    const body = h('div');
    const got = Object.keys(game.codex).length;
    body.append(h('div.sub', { text: `已解锁 ${got} / ${ACHIEVEMENTS.length}。图鉴跨越你创造的所有世界保存。高亮表示在当前世界中达成。` }));
    const cats = [...new Set(ACHIEVEMENTS.map((a) => a.cat))];
    for (const cat of cats) {
      body.append(h('div.h3', { text: cat }));
      const g = h('div.ach-grid');
      for (const a of ACHIEVEMENTS.filter((x) => x.cat === cat)) {
        const here = w && w.achievements && w.achievements[a.id];
        const ever = game.codex[a.id];
        const card = h('div.ach', { html: `<b>${ever ? esc(a.name) : '？？？'}</b><span>${esc(a.desc)}</span>${here ? `<span class="when">本世界 ${here.year} 年达成</span>` : ever ? `<span class="when" style="color:var(--dim2)">曾于「${esc(ever.world || '')}」达成</span>` : ''}` });
        if (here) card.classList.add('got');
        g.append(card);
      }
      body.append(g);
    }
    if (w) {
      const mine = w.religions.filter((r) => r.player);
      if (mine.length) {
        body.append(h('div.h3', { text: '这个世界给你的名号' }));
        body.append(h('div', { html: mine.map((r) => `<span class="tag gold">「${esc(r.epithet)}」${esc(r.deity.z)} —— ${esc(w.nations[r.origin]?.adj || '')}</span>`).join('') }));
      }
    }
    M.open('万象图鉴', body, { wide: true });
  };

  // ---- species designer
  M.designer = () => {
    const genes = (game.param.genes ? Array.from(game.param.genes) : ARCHETYPES.grazer.genes.slice());
    let name = game.param.name || '';
    const body = h('div.designer');
    const left = h('div');
    const right = h('div');
    body.append(left, right);
    const arch = h('div.arch-grid');
    for (const k in ARCHETYPES) {
      const b = h('button.arch', { text: ARCHETYPES[k].name });
      b.addEventListener('click', () => { genes.splice(0, NG, ...ARCHETYPES[k].genes); name = ARCHETYPES[k].name; nameIn.value = name; refresh(); syncSliders(); });
      arch.append(b);
    }
    left.append(h('div.h3', { text: '从原型开始' }), arch, h('div.h3', { text: '基因' }));
    const sliders = [];
    for (let k = 0; k < NG; k++) {
      const out = h('output', { text: genes[k].toFixed(2) });
      const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: genes[k] });
      inp.addEventListener('input', () => { genes[k] = Number(inp.value); out.textContent = genes[k].toFixed(2); refresh(); });
      sliders.push([inp, out]);
      left.append(h('div.slider-row', { style: { gridTemplateColumns: '54px 1fr 36px', marginTop: '4px' } }, h('span', { text: GENE_LABELS[GENES[k]] }), inp, out));
    }
    const syncSliders = () => sliders.forEach(([inp, out], k) => { inp.value = genes[k]; out.textContent = genes[k].toFixed(2); });
    const pv = h('canvas.preview');
    const info = h('div', { style: { fontSize: '12px', lineHeight: '1.8', marginTop: '10px', color: 'var(--dim)' } });
    const nameIn = h('input.input', { placeholder: '物种名称（留空自动命名）', value: name });
    nameIn.addEventListener('input', () => { name = nameIn.value.trim(); });
    right.append(pv, h('div.form-row', { style: { marginTop: '10px' } }, h('label', { text: '名称' }), nameIn), info);
    const use = h('button.btn', { html: icon('spawn', 15) + '投放到世界' });
    use.addEventListener('click', () => {
      game.param.genes = genes.slice();
      game.param.name = name || null;
      game.param.spawnKey = '';
      game.setTool('spawn');
      dlg.close();
      ui.toast('在地图上点击即可投放这个物种');
    });
    const save = h('button.btn.ghost', { html: icon('save', 15) + '保存设计' });
    save.addEventListener('click', () => {
      const d = { id: String(Date.now()), name: name || autoName(), genes: genes.slice() };
      ui.designs.push(d);
      setLocal('designs', ui.designs);
      ui.toast(`设计「${d.name}」已保存`);
      ui.renderToolGrid();
    });
    right.append(h('div.row-btns', {}, use, save));
    const autoName = () => {
      const g = Float32Array.from(genes);
      const t = phenotype(g, 0, {});
      const hue = hueChar(g[13]), feat = featureChar(g, 0, 0.3);
      return (feat === hue ? hue : hue + feat) + FORM_CHAR[t.form];
    };
    let raf = 0;
    const refresh = () => {
      const g = Float32Array.from(genes);
      const t = phenotype(g, 0, {});
      const hab = t.fly ? '飞行' : ['水生', '两栖', '陆生'][t.hab];
      info.innerHTML = `外观：<b style="color:var(--text)">${autoName()}</b>（${hab}）<br>体型 ${t.size.toFixed(2)} · 速度 ${t.speed.toFixed(2)} · 代谢 ${t.metab.toFixed(3)}<br>适宜 ${t.topt.toFixed(0)}°C · 寿命约 ${(t.maxAge / 4).toFixed(0)} 年 · 每窝 ${t.litter} 只<br>战力 ${t.power.toFixed(2)} · 防御 ${t.defense.toFixed(2)}`;
    };
    const anim = (now) => {
      if (!pv.isConnected) return;
      raf = requestAnimationFrame(anim);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = pv.getBoundingClientRect();
      if (pv.width !== Math.round(r.width * dpr)) { pv.width = Math.round(r.width * dpr); pv.height = Math.round(r.height * dpr); }
      const ctx = pv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, r.width, r.height);
      const g = Float32Array.from(genes);
      const col = speciesColor(g, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(r.width / 2, r.height * 0.72, 70, 12, 0, 0, Math.PI * 2); ctx.fill();
      drawGenomePreview(ctx, r.width / 2, r.height * 0.58, 46, genes, col, now / 1000);
    };
    refresh();
    const dlg = M.open('物种设计器', body, { wide: false, onClose: () => cancelAnimationFrame(raf) });
    raf = requestAnimationFrame(anim);
  };

  // ---- climate
  M.climate = () => {
    const w = game.world;
    const body = h('div');
    const readout = h('div.sub');
    const upd = () => { readout.innerHTML = `全球气温距平 <b style="color:var(--text)">${w.climate.offset >= 0 ? '+' : ''}${w.climate.offset.toFixed(2)}°C</b> · CO₂ <b style="color:var(--text)">${Math.round(w.climate.co2)} ppm</b> · 尘埃 <b style="color:var(--text)">${w.climate.dust.toFixed(2)}</b> · 海平面 <b style="color:var(--text)">${Math.round((w.seaLevel - w.seaLevelBase0) * 6000)} m</b>`; };
    upd();
    const t = setInterval(() => { if (!body.isConnected) clearInterval(t); else upd(); }, 500);
    body.append(readout);
    const row = (label, min, max, stepv, get, set, fmt, hint) => {
      const out = h('output', { text: fmt(get()) });
      const inp = h('input', { type: 'range', min, max, step: stepv, value: get() });
      inp.addEventListener('input', () => { set(Number(inp.value)); out.textContent = fmt(Number(inp.value)); });
      body.append(h('div.slider-row', { style: { gridTemplateColumns: '84px 1fr 64px' } }, h('span', { text: label }), inp, out));
      if (hint) body.append(h('div', { style: { fontSize: '11px', color: 'var(--dim2)', margin: '2px 0 6px 92px' }, text: hint }));
    };
    row('太阳辉度', -12, 12, 0.5, () => w.climate.solar, (v) => setClimate(w, 'solar', v), (v) => (v > 0 ? '+' : '') + v + '°C', '直接加热或冷却整个星球');
    row('二氧化碳', 150, 2000, 10, () => w.climate.co2, (v) => setClimate(w, 'co2', v), (v) => Math.round(v) + ' ppm', '温室效应：浓度每翻一倍升温约 3°C，会被植物和海洋慢慢吸收');
    row('大气尘埃', 0, 3, 0.05, () => w.climate.dust, (v) => setClimate(w, 'dust', v), (v) => v.toFixed(2), '遮挡阳光、降低气温；几年内沉降');
    row('基准海平面', -0.12, 0.12, 0.005, () => w.seaLevelBase, (v) => setClimate(w, 'sea', v), (v) => Math.round(v * 6000) + ' m', '海平面会缓慢地向新的基准移动，同时随气温升降');
    row('降水倍率', 0.3, 2, 0.05, () => w.climate.wetness, (v) => { w.climate.wetness = v; w.dirty.climate = true; game.dirtyDerived = performance.now() + 200; }, (v) => '×' + v.toFixed(2));
    body.append(h('div.sub', { style: { marginTop: '10px' }, text: '气候变化会影响植被、物种分布、冰原与海平面——升温会淹没沿海城市，降温会让冰川南侵、露出陆桥。' }));
    M.open('全球气候', body, { narrow: true });
  };

  // ---- settings
  M.settings = () => {
    const w = game.world;
    const body = h('div');
    const tog = (label, key, apply) => {
      const inp = h('input', { type: 'checkbox' });
      inp.checked = !!game.settings[key];
      inp.addEventListener('change', () => { game.settings[key] = inp.checked; setLocal('settings', game.settings); apply && apply(inp.checked); });
      body.append(h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '6px 0', cursor: 'pointer' } }, inp, label));
    };
    body.append(h('div.h3', { text: '画面' }));
    tog('云层', 'clouds', (v) => { game.R.opts.clouds = v; });
    tog('地名与国名', 'labels', (v) => { game.R.opts.labels = v; });
    tog('显示生物', 'creatures', (v) => { game.R.opts.creatures = v; });
    tog('国界', 'borders', (v) => { game.R.opts.borders = v; });
    tog('昼夜交替（城市夜景）', 'daynight', (v) => { game.R.opts.daynight = v; });
    body.append(h('div.h3', { text: '通知与声音' }));
    const lv = h('select');
    [[1, '所有事件'], [2, '重要事件'], [3, '只有划时代的大事']].forEach(([v, n]) => lv.append(h('option', { value: v, text: n })));
    lv.value = game.settings.toastLevel;
    lv.addEventListener('change', () => { game.settings.toastLevel = Number(lv.value); setLocal('settings', game.settings); });
    body.append(h('div.form-row', {}, h('label', { text: '弹出通知' }), lv));
    tog('声音', 'sound', (v) => ui.setSound(v));
    const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: game.settings.volume });
    vol.addEventListener('input', () => { game.settings.volume = Number(vol.value); setLocal('settings', game.settings); ui.audio && ui.audio.setVolume(game.settings.volume); });
    body.append(h('div.slider-row', {}, h('span', { text: '音量' }), vol, h('span')));
    tog('每三分钟自动存档', 'autosave');
    if (w) {
      body.append(h('div.h3', { text: '这个世界的规则' }));
      const mode = h('select');
      [['sandbox', '沙盒：神力无限'], ['divine', '神途：神力来自信徒']].forEach(([v, n]) => mode.append(h('option', { value: v, text: n })));
      mode.value = w.settings.mode;
      mode.addEventListener('change', () => { w.settings.mode = mode.value; ui.renderToolGrid(); game.emit('ui'); });
      body.append(h('div.form-row', {}, h('label', { text: '模式' }), mode));
      const dis = h('input', { type: 'checkbox' });
      dis.checked = w.settings.disasters;
      dis.addEventListener('change', () => { w.settings.disasters = dis.checked; });
      body.append(h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '6px 0', cursor: 'pointer' } }, dis, '自然灾害（雷火、火山、地震、陨石）'));
      const slider = (label, min, max, stepv, get, set, fmt) => {
        const out = h('output', { text: fmt(get()) });
        const inp = h('input', { type: 'range', min, max, step: stepv, value: get() });
        inp.addEventListener('input', () => { set(Number(inp.value)); out.textContent = fmt(Number(inp.value)); });
        body.append(h('div.slider-row', { style: { gridTemplateColumns: '84px 1fr 44px' } }, h('span', { text: label }), inp, out));
      };
      slider('演化速度', 0.25, 4, 0.25, () => w.settings.evolution, (v) => { w.settings.evolution = v; }, (v) => '×' + v);
      slider('文明好战', 0.2, 2, 0.1, () => w.settings.civAggression, (v) => { w.settings.civAggression = v; }, (v) => '×' + v.toFixed(1));
    }
    M.open('设置', body, { narrow: true });
  };

  // ---- help
  M.help = () => {
    const body = h('div.help-grid', { html: `
      <div>
        <h4>你是谁</h4>
        <p>你是这块漂浮在虚空中的大地上一股无名的力量。大地自己隆起与侵蚀，风雨自己流转，生命自己演化，文明自己兴起、争斗、衰亡。你可以只是看着，也可以出手。</p>
        <p>你在文明附近的每一次作为都会被当作<b>征兆</b>记住。看惯了雷霆与陨石的民族会敬畏你，受过甘霖与赐福的民族会感恩你，见过虚空之门与时之泡的民族会追问你。印象足够深时，他们会给你取名、为你立教——<b>你没有名字，直到他们为你命名。</b></p>
        <h4>基本操作</h4>
        <p>左侧是神力。选择工具后在地图上左键使用；画笔类工具可以按住拖动。<b>右键或中键拖动</b>平移，<b>滚轮</b>缩放，触屏可双指缩放。选中「查看」工具时，左键拖动也可平移，点击任何东西会在右侧显示详情。</p>
        <p>底部的叠加层可以切换政治、宗教、思潮、时代、物种分布、气温、降水等视图。右下角小地图可以快速跳转。</p>
        <h4>快捷键</h4>
        <p><kbd>空格</kbd> 暂停/继续 · <kbd>1</kbd>–<kbd>6</kbd> 速度 · <kbd>.</kbd> 单步 · <kbd>Esc</kbd> 回到查看工具 / 关闭窗口<br>
        <kbd>[</kbd> <kbd>]</kbd> 画笔大小 · <kbd>V</kbd> 切换叠加层（<kbd>N</kbd> 关闭）· <kbd>Tab</kbd> 侧栏 · <kbd>D</kbd> 导演模式 · <kbd>T</kbd> 时间线 · <kbd>M</kbd> 气候 · <kbd>F</kbd> 跟随选中对象 · <kbd>H</kbd> 全景 · <kbd>Ctrl</kbd>+<kbd>S</kbd> 存档 · <kbd>?</kbd> 帮助</p>
      </div>
      <div>
        <h4>世界如何运转</h4>
        <p><b>地理</b>：板块碰撞造就山脉与火山；风带把海上的水汽带上陆地，山脉投下雨影；雨水汇成河流湖泊，缓慢侵蚀河谷。气温随纬度、海拔与季节变化，全球气候受二氧化碳、尘埃影响，海平面随之升降。</p>
        <p><b>生命</b>：每个生物都带着基因组——体型、速度、食性、耐热、陆栖度、智力、群居性……它们觅食、捕猎、逃跑、迁徙、繁殖，后代带着突变。被隔离的种群会分化成新物种；聪明而合群的物种可能自然觉醒出智慧。</p>
        <p><b>文明</b>：部落从篝火开始，开垦农田、驯化动物、建立城市、扩张领土，研究横跨十一个时代的科技，修路通商，建造奇观。各国有自己的语言、国旗、政体、价值观与统治者，会结盟、宣战、围城、议和。思想在城市间传播，引发革命、内战与分裂；宗教兴起、扩散与分裂；瘟疫沿商路蔓延；工业带来污染与全球变暖。</p>
        <h4>时间线与存档</h4>
        <p>世界会定期被记录。打开<b>时间线</b>可以回到过去的任一时刻，开辟新的历史分支。存档包含完整状态，可导出为文件分享——同一存档继续运行会得到完全相同的未来。</p>
        <h4>神途模式</h4>
        <p>神力来自崇拜你的信徒。回应城市的祈祷（金色气泡）能获得额外神力与更虔诚的信仰。</p>
      </div>` });
    M.open('帮助', body, { wide: true });
  };

  M.confirmMenu = () => {
    const body = h('div', { html: '<div class="sub">回到标题画面？当前世界会自动存档，可以从「继续上次的世界」回来。</div>' });
    const foot = h('div.modal-foot');
    const no = h('button.btn.ghost', { text: '取消' });
    const yes = h('button.btn', { text: '回到标题' });
    foot.append(no, yes);
    const dlg = M.open('返回标题', body, { narrow: true, foot });
    no.addEventListener('click', () => dlg.close());
    yes.addEventListener('click', async () => { dlg.close(); await game.autosave(); ui.showStart(); });
  };

  ui.modals = M;
  return M;
}

