// Guided tutorials for the first chapter. Each step explains one idea and advances by itself when
// the player (or the AI) has done the thing — so the tutorial also narrates an AI playthrough.


const has = (g, id, n = 1) => g.countDef(id) >= n;
const task = (g, pred) => Object.values(g.s.stacks).some((st) => st.task && pred(st.task.r));

const TUTORIALS = {
  basics: [
    { html: '<b>欢迎来到薪火纪。</b>灰雾外的这片河谷就是你的营地。<br>按住一张卡并拖动它，放到另一张卡上，它们就会<b>叠成一堆</b>。试着把一个<b>幸存者</b>拖到<b>树</b>上——他会开始伐木。', done: (g) => task(g, (r) => r === 'harvest_tree') || has(g, 'wood') },
    { html: '很好！进度条走完就会掉出<b>木材</b>。每个<b>黎明</b>大家都要吃饭——把另一个幸存者叠到<b>浆果丛</b>上采些浆果。', done: (g) => task(g, (r) => r === 'harvest_berry_bush') || g.countDef('berry') > 3 },
    { html: '要熬过黑夜，需要火。把<b>木材 ×2</b>、<b>燧石</b>和<b>一个人</b>叠在一起，就能<b>生火</b>。<br><small>提示：拖到一堆的任意位置都行；堆里多余的卡不会被消耗。</small>', done: (g) => has(g, 'campfire') },
    { html: '<b>篝火</b>每天会烧掉一份燃料——把木材叠到篝火上添柴。入夜后，只有<b>火光照到的地方</b>才能工作。看右上角的日晷：金色是白天，蓝色是夜晚。', manual: true },
    { html: '人需要住处才会繁衍。用<b>木材 ×3 + 纤维 ×2 + 一个人</b>搭一座<b>窝棚</b>。纤维来自<b>茅草丛</b>。', done: (g) => has(g, 'lean_to') },
    { html: '把<b>两个成年人</b>叠到窝棚上，过一会儿就会有<b>孩子</b>出生，孩子两天后长大。完成左上角的全部目标就能过关。', done: (g) => g.population() >= 3 || g.countDef('child') > 0 },
    { html: '你也可以把这些交给<b>AI</b>：点亮右侧面板的开关，AI 会接管营地，并在<b>决策日志</b>里写下它的每一个想法。它和你遵守同样的规则——只能拖卡、只能看到场上的东西。随时拖一张卡，你就能接管回来。', manual: true },
  ],
  river: [
    { html: '<b>河流</b>里的鱼取之不尽。把一个人叠到河流上捕鱼。', done: (g) => task(g, (r) => r === 'harvest_river') || has(g, 'raw_fish') },
    { html: '生鱼只顶 1 份饱，烤熟后翻倍。把<b>生鱼直接叠到篝火上</b>，它会自己烤好——不需要人看着。', done: (g) => has(g, 'cooked_fish') || g.s.stats.made.cooked_fish > 0 },
    { html: '用 <b>石块 ×3 + 一个人</b>凿一块<b>刻石</b>，再把人叠在刻石上记录见闻，就会产出<b>灵感</b>。灵感用来研究科技。', done: (g) => has(g, 'stone_tablet') || has(g, 'insight') },
    { html: '点击上方的 <b>✦ 科技</b> 按钮（或按 <b>T</b>）打开科技树，花灵感研究新东西。<b>渔猎</b>能做钓竿，<b>口述</b>能在篝火边讲故事产出灵感。', done: (g) => g.s.stats.researched > 0 },
    { html: '远处的<b>地域卡</b>（河谷深处）可以探索：叠一个人上去，会带回新的资源点、动物，甚至新的同伴。', manual: true },
  ],
  night: [
    { html: '这一关有<b>灰雾</b>（顶部的雾气条）。它每天上涨；涨满，营地就会被吞没。', manual: true },
    { html: '夜里，<b>灰影</b>会从黑暗中走出来寻找落单的人。它们<b>畏光</b>——在光里会被灼烧。让大家待在篝火边，或者立一根<b>火把桩</b>（木材×2 + 纤维 + 石块 + 人）。', done: (g) => has(g, 'torch_post') || has(g, 'torch') || g.s.stats.kills > 0 },
    { html: '研究<b>口述</b>后可以立<b>灯龛</b>（石块 ×3 + 木材 ×2 + 人）。点亮的灯龛每天让灰雾<b>退散 2 点</b>。', done: (g) => has(g, 'shrine') },
    { html: '打不过的时候就躲进光里。人物被打倒会留下<b>墓碑</b>——叠一个人上去安葬，也能让灰雾退散。坚持到第 6 个黎明！', manual: true },
  ],
};

export class Tutorial {
  constructor(app) {
    this.app = app;
    this.steps = null;
    this.i = 0;
    this.doneT = 0;
  }

  start(key) {
    this.steps = TUTORIALS[key] || null;
    this.i = 0;
    this.doneT = 0;
    this.show();
  }

  show() {
    const s = this.steps && this.steps[this.i];
    this.app.hud.showTutorial(s ? { html: s.html, manual: !!s.manual, done: this.doneT > 0 } : null);
  }

  next() {
    if (!this.steps) return;
    this.i++;
    this.doneT = 0;
    if (this.i >= this.steps.length) this.steps = null;
    this.show();
  }

  skip() {
    this.steps = null;
    this.show();
  }

  update(dt) {
    const s = this.steps && this.steps[this.i];
    if (!s || s.manual || !this.app.g) return;
    if (this.doneT > 0) {
      this.doneT += dt;
      if (this.doneT > 1.4) this.next();
    } else if (s.done(this.app.g)) {
      this.doneT = 0.001;
      this.show();
      this.app.audio.play('research');
    }
  }
}

