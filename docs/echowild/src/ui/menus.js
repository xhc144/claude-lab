// Title, world list, world creation, settings, pause, death and help screens.

import { h, Screen } from './ui.js';
import { listWorlds, deleteWorld, exportWorld, importWorld, isPersistent } from '../save/storage.js';
import { hashString } from '../core/noise.js';

const fmtDate = (t) => { if (!t) return '—'; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const MODE_ZH = { survival: '生存', creative: '创造' };
const DIFF_ZH = ['和平', '简单', '普通', '困难'];

export class TitleScreen extends Screen {
  constructor(app) { super(); this.app = app; this.capturesGame = false; }
  build() {
    const el = h('div', { class: 'screen title-screen' },
      h('div', { class: 'logo' },
        h('div', { class: 'logo-main' }, '回响荒野'),
        h('div', { class: 'logo-sub' }, 'E C H O W I L D'),
        h('div', { class: 'logo-tag' }, '在破碎的织界中拾起回响，重织这个世界')),
      h('div', { class: 'title-btns' },
        h('button', { class: 'btn primary big', onclick: () => this.ui.push(new WorldsScreen(this.app)) }, '开始冒险'),
        h('button', { class: 'btn big', onclick: () => this.ui.push(new HelpScreen(this.app)) }, '玩法指南'),
        h('button', { class: 'btn big', onclick: () => this.ui.push(new SettingsScreen(this.app)) }, '设置')),
      h('div', { class: 'title-foot' }, `v${this.app.version} · 全部画面、音效与世界均由代码实时生成`));
    return el;
  }
  onKey() { return true; }
}

export class WorldsScreen extends Screen {
  constructor(app) { super(); this.app = app; this.capturesGame = false; }
  build() {
    this.list = h('div', { class: 'world-list' }, h('div', { class: 'dim' }, '读取存档中…'));
    const file = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      try { await importWorld(await f.text()); this.refresh(); } catch (e) { alert(`导入失败：${e.message}`); }
    });
    this.warn = h('div', { class: 'warn-line' });
    const el = h('div', { class: 'screen' },
      h('div', { class: 'panel menu-panel wide' },
        h('div', { class: 'title' }, '选择世界'),
        this.warn,
        this.list,
        h('div', { class: 'menu-row' },
          h('button', { class: 'btn primary', onclick: () => this.ui.push(new CreateWorldScreen(this.app)) }, '新建世界'),
          h('button', { class: 'btn', onclick: () => file.click() }, '导入存档'),
          h('button', { class: 'btn', onclick: () => this.close() }, '返回')),
        file));
    this.refresh();
    isPersistent().then((p) => { if (!p) this.warn.textContent = '注意：当前浏览器无法使用本地存储，存档只保留到关闭页面为止。可以用“导出”保存到文件。'; });
    return el;
  }
  async refresh() {
    const ws = await listWorlds();
    this.list.innerHTML = '';
    if (!ws.length) { this.list.appendChild(h('div', { class: 'empty' }, '还没有世界。新建一个，开始你的第一次探索吧。')); return; }
    for (const w of ws) {
      const row = h('div', { class: 'world-row' },
        h('div', { class: 'wr-main' },
          h('div', { class: 'wr-name' }, w.name),
          h('div', { class: 'wr-info' }, `${MODE_ZH[w.mode] || w.mode} · ${DIFF_ZH[w.difficulty ?? 2]} · 第 ${w.day || 1} 天 · 种子 ${w.seed} · ${fmtDate(w.lastPlayed)}`),
          w.shards ? h('div', { class: 'wr-shards' }, '◆'.repeat(w.shards) + '◇'.repeat(5 - w.shards)) : null),
        h('div', { class: 'wr-btns' },
          h('button', { class: 'btn primary small', onclick: () => this.app.playWorld(w) }, '进入'),
          h('button', { class: 'btn small', onclick: async () => { const txt = await exportWorld(w.id); download(`${w.name}.echowild.json`, txt); } }, '导出'),
          h('button', { class: 'btn danger small', onclick: async () => { if (confirm(`确定删除世界「${w.name}」吗？此操作无法撤销。`)) { await deleteWorld(w.id); this.refresh(); } } }, '删除')));
      this.list.appendChild(row);
    }
  }
  onKey(e) { if (e.code === 'Escape') { this.close(); return true; } return true; }
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export class CreateWorldScreen extends Screen {
  constructor(app) { super(); this.app = app; this.capturesGame = false; this.mode = 'survival'; this.diff = 2; }
  build() {
    const name = h('input', { class: 'text', value: '新的荒野', maxlength: 32 });
    const seed = h('input', { class: 'text', placeholder: '留空则随机' });
    for (const i of [name, seed]) i.addEventListener('keydown', (e) => e.stopPropagation());
    const modeBtns = h('div', { class: 'seg' });
    const diffBtns = h('div', { class: 'seg' });
    const desc = h('div', { class: 'dim small' });
    const renderSeg = () => {
      modeBtns.innerHTML = ''; diffBtns.innerHTML = '';
      for (const [k, zh] of Object.entries(MODE_ZH)) modeBtns.appendChild(h('button', { class: `seg-b ${this.mode === k ? 'on' : ''}`, onclick: () => { this.mode = k; renderSeg(); } }, zh));
      DIFF_ZH.forEach((zh, i) => diffBtns.appendChild(h('button', { class: `seg-b ${this.diff === i ? 'on' : ''}`, onclick: () => { this.diff = i; renderSeg(); } }, zh)));
      desc.textContent = this.mode === 'creative' ? '创造模式：无限材料、可以飞行、方块瞬间破坏，所有配方都可以直接查看。' : ['和平：没有敌对生物，饥饿不会致命。', '简单：敌对生物较弱。', '普通：标准的生存挑战。', '困难：敌对生物更多更强，饥饿可以致命。'][this.diff];
    };
    renderSeg();
    const el = h('div', { class: 'screen' },
      h('div', { class: 'panel menu-panel' },
        h('div', { class: 'title' }, '新建世界'),
        h('label', { class: 'field' }, h('span', {}, '世界名称'), name),
        h('label', { class: 'field' }, h('span', {}, '世界种子'), seed),
        h('div', { class: 'field' }, h('span', {}, '游戏模式'), modeBtns),
        h('div', { class: 'field' }, h('span', {}, '难度'), diffBtns),
        desc,
        h('div', { class: 'menu-row' },
          h('button', { class: 'btn primary', onclick: () => {
            const s = seed.value.trim();
            const sd = s === '' ? (Math.random() * 4294967295) >>> 0 : /^-?\d+$/.test(s) ? Number(s) >>> 0 : hashString(s);
            this.app.createWorld({ name: name.value.trim() || '新的荒野', seed: sd, mode: this.mode, difficulty: this.diff });
          } }, '创建并进入'),
          h('button', { class: 'btn', onclick: () => this.close() }, '取消'))));
    return el;
  }
  onKey(e) { if (e.code === 'Escape') { this.close(); return true; } return true; }
}

export class SettingsScreen extends Screen {
  constructor(app) { super(); this.app = app; this.capturesGame = !!app.game; }
  build() {
    const s = this.app.settings;
    const rows = [];
    const slider = (key, zh, min, max, step, fmt = (v) => v) => {
      const val = h('span', { class: 'val' }, fmt(s[key]));
      const inp = h('input', { type: 'range', min, max, step, value: s[key] });
      inp.addEventListener('input', () => { s[key] = Number(inp.value); val.textContent = fmt(s[key]); this.app.applySettings(); });
      rows.push(h('label', { class: 'setting' }, h('span', {}, zh), inp, val));
    };
    const toggle = (key, zh) => {
      const b = h('button', { class: `seg-b ${s[key] ? 'on' : ''}` }, s[key] ? '开' : '关');
      b.addEventListener('click', () => { s[key] = !s[key]; b.textContent = s[key] ? '开' : '关'; b.classList.toggle('on', s[key]); this.app.applySettings(); });
      rows.push(h('div', { class: 'setting' }, h('span', {}, zh), b));
    };
    slider('renderDist', '视距（区块）', 3, 16, 1);
    slider('fov', '视野', 55, 110, 1, (v) => `${v}°`);
    slider('sensitivity', '鼠标灵敏度', 0.2, 3, 0.05, (v) => Number(v).toFixed(2));
    slider('brightness', '亮度', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`);
    slider('renderScale', '渲染分辨率', 0.4, 1, 0.05, (v) => `${Math.round(v * 100)}%`);
    slider('volume', '音效音量', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`);
    slider('music', '音乐音量', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`);
    toggle('invertY', '反转鼠标 Y 轴');
    toggle('viewBob', '行走视角摇晃');
    toggle('showCoords', '显示坐标');
    toggle('particles', '天气与环境粒子');
    if (this.app.game && !this.app.game.player.creative) {
      const seg = h('div', { class: 'seg' });
      const render = () => { seg.innerHTML = ''; DIFF_ZH.forEach((zh, i) => seg.appendChild(h('button', { class: `seg-b ${s.difficulty === i ? 'on' : ''}`, onclick: () => { s.difficulty = i; this.app.applySettings(); render(); } }, zh))); };
      render();
      rows.push(h('div', { class: 'setting' }, h('span', {}, '难度'), seg));
    }
    return h('div', { class: 'screen' }, h('div', { class: 'panel menu-panel' }, h('div', { class: 'title' }, '设置'), h('div', { class: 'settings' }, ...rows), h('div', { class: 'menu-row' }, h('button', { class: 'btn primary', onclick: () => this.close() }, '完成'))));
  }
  onClose() { this.app.saveSettings(); }
  onKey(e) { if (e.code === 'Escape') { this.close(); return true; } return true; }
}

export class PauseScreen extends Screen {
  constructor(app) { super(); this.app = app; }
  build() {
    const g = this.app.game;
    const shards = g.quest ? g.quest.count() : 0;
    return h('div', { class: 'screen pause-screen' },
      h('div', { class: 'panel menu-panel' },
        h('div', { class: 'title' }, '游戏暂停'),
        h('div', { class: 'pause-info' }, `${g.meta.name} · 第 ${g.day} 天 · 回响碎片 ${shards}/5`),
        h('div', { class: 'menu-col' },
          h('button', { class: 'btn primary', onclick: () => this.app.resume() }, '继续游戏'),
          h('button', { class: 'btn', onclick: () => this.ui.push(new SettingsScreen(this.app)) }, '设置'),
          h('button', { class: 'btn', onclick: () => this.ui.push(new HelpScreen(this.app)) }, '玩法指南'),
          h('button', { class: 'btn', onclick: async () => { await this.app.saveGame(); this.app.game.hud.toast('已保存', '世界进度已写入本地存档。'); } }, '立即保存'),
          h('button', { class: 'btn danger', onclick: () => this.app.quitToTitle() }, '保存并返回标题'))));
  }
  onKey(e) { if (e.code === 'Escape') { this.app.resume(); return true; } return true; }
}

export class DeathScreen extends Screen {
  constructor(app, cause) { super(); this.app = app; this.cause = cause; }
  build() {
    const g = this.app.game;
    return h('div', { class: 'screen death-screen' },
      h('div', { class: 'death' },
        h('div', { class: 'death-title' }, '你倒下了'),
        h('div', { class: 'death-cause' }, this.cause),
        h('div', { class: 'dim' }, `坚持到了第 ${g.day} 天${g.keepInventory() ? '' : ' · 物品散落在倒下的地方'}`),
        h('div', { class: 'menu-row' },
          h('button', { class: 'btn primary', onclick: () => this.app.respawn() }, '重生'),
          h('button', { class: 'btn', onclick: () => this.app.quitToTitle() }, '返回标题'))));
  }
  onKey() { return true; }
}

const HELP = [
  ['操作', `
<table class="keys">
<tr><td>W A S D</td><td>移动</td><td>空格</td><td>跳跃 / 游泳上浮 / 空中按住展开滑翔翼</td></tr>
<tr><td>鼠标</td><td>环顾</td><td>Shift</td><td>潜行（不会从边缘掉落）</td></tr>
<tr><td>Ctrl / 双击 W</td><td>疾跑</td><td>双击空格</td><td>飞行（创造模式 / 织星之翼）</td></tr>
<tr><td>左键</td><td>挖掘 / 攻击</td><td>右键</td><td>放置 / 使用 / 交互</td></tr>
<tr><td>滚轮 / 1–9</td><td>切换快捷栏</td><td>中键</td><td>拾取方块（创造）</td></tr>
<tr><td>E</td><td>背包与合成</td><td>Q</td><td>丢弃（Ctrl+Q 整组）</td></tr>
<tr><td>F</td><td>回响脉冲（需要回响罗盘）</td><td>X</td><td>与副手交换</td></tr>
<tr><td>M</td><td>世界地图</td><td>J</td><td>探索图鉴</td></tr>
<tr><td>T 或 /</td><td>聊天与指令</td><td>C</td><td>望远</td></tr>
<tr><td>V / F5</td><td>切换视角</td><td>F3</td><td>调试信息</td></tr>
<tr><td>F1</td><td>隐藏界面</td><td>Esc</td><td>暂停</td></tr>
</table>
<p class="dim">背包里：左键拿起/放下，右键拆分一半或放下一个，Shift+点击快速转移，悬停时按数字键与快捷栏交换。</p>`],
  ['生存入门', `
<p><b>第一天</b>：徒手砍树得到原木 → 在背包（E）里做成木板、木棍和<b>工作台</b>。靠近工作台时，背包的合成书会自动解锁更多配方——不需要摆放材料的位置，只要材料齐全就能合成。</p>
<p><b>工具</b>：木镐能挖石头和煤；石镐能挖铜和铁；铁镐能挖金、共鸣晶和星辉石。更好的工具挖得更快，攻击也更痛。</p>
<p><b>夜晚</b>：天黑后暗影游荡者会出没，白天它们会化作烟尘。点起火把、搭个小屋，或者用睡袋（右键）跳过夜晚并设置重生点。</p>
<p><b>饥饿</b>：饱食度高时会自动回血。打猎、钓鱼、种田（用锄头翻土，在水边的耕地上播种），在熔炉或营火上把食物烤熟能获得更多饱食度。</p>
<p><b>熔炉</b>：把粗铜、粗铁和沙子放进熔炉，再放入燃料（煤、木炭、木头）。漏斗可以自动给熔炉进料和取料。</p>`],
  ['共鸣机械', `
<p><b>共鸣晶粉</b>可以铺成共鸣丝，传导 0–15 级的共鸣信号，每格衰减 1。</p>
<p><b>信号源</b>：拉杆、按钮、压力板、共鸣晶块、日光感应器、侦测器（相邻方块变化时发出脉冲）。</p>
<p><b>逻辑</b>：反相晶柱（输入有信号时熄灭）、节拍器（延迟 1–4 档，右键调节，还能放大信号）。</p>
<p><b>执行</b>：晶灯、门、推进器（粘性推进器可以拉回方块）、音晶匣（右键调音，可以演奏旋律）、投掷器、放置机、掘进机（会挖掉面前的方块）、导风扇（吹动生物与物品，向上吹可以托起滑翔翼）、弹射板、传送带、驱动轨、爆裂桶。</p>
<p><b>自动化</b>：传送带运送物品与生物，漏斗吸入上方的物品并推入容器，掘进机 + 传送带 + 漏斗 + 箱子可以组成自动采矿线。</p>`],
  ['探索与碎片', `
<p>很久以前，<b>织者</b>用回响之丝编织出这个世界。大寂静让天空碎裂，群岛浮上云端，五枚<b>回响碎片</b>散落四方。你醒来时身边是一座残破的<b>织心祭坛</b>。</p>
<p>五枚碎片分别藏在：浮空群岛的<b>天穹神殿</b>、幽光深层的<b>深渊圣所</b>、流金沙海的<b>方尖碑</b>、霜晶荒原的<b>冰晶尖塔</b>、深海之下的<b>潮汐神殿</b>。神殿的织印石门需要激活所有符文基座才会打开。</p>
<p><b>回响罗盘</b>（共鸣台合成，需要晶洞里的回响晶片）按 F 或右键发出脉冲：穿透岩石显示附近矿石，并为你指出最近的碎片神殿方向。</p>
<p><b>回响石碑</b>：激活后可以在任意两座石碑之间瞬间传送。遗迹里能找到，也可以自己合成。</p>
<p>夜空偶尔会划过<b>流星雨</b>——跟着坠落的星光走，陨坑里有星核与陨铁，能锻造最强的星铁装备。</p>
<p>集齐五枚碎片并放回织心祭坛，世界会给你一份馈赠。</p>`],
];

export class HelpScreen extends Screen {
  constructor(app) { super(); this.app = app; this.capturesGame = !!app.game; this.tab = 0; }
  build() {
    const tabs = h('div', { class: 'station-tabs' });
    const body = h('div', { class: 'help-body' });
    const render = () => {
      tabs.innerHTML = '';
      HELP.forEach(([t], i) => tabs.appendChild(h('button', { class: `tab ${i === this.tab ? 'on' : ''}`, onclick: () => { this.tab = i; render(); } }, t)));
      body.innerHTML = HELP[this.tab][1];
    };
    render();
    return h('div', { class: 'screen' }, h('div', { class: 'panel menu-panel wide' }, h('div', { class: 'title' }, '玩法指南'), tabs, body, h('div', { class: 'menu-row' }, h('button', { class: 'btn primary', onclick: () => this.close() }, '关闭'))));
  }
  onKey(e) { if (e.code === 'Escape') { this.close(); return true; } return true; }
}
