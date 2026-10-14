// 设置 · appearance (accent, motion, density, rail), workspace defaults, members & invites,
// notification routing and security (2FA, sessions, audit log).

import { pageHead, panel, toggle, bindToggle, tabs, bindTabs, seg, bindSeg, pill } from '../ui/kit.js';
import { icon } from '../ui/icons.js';
import { openLayer, confirmDialog, toast } from '../ui/overlay.js';
import { state, setPref } from '../core/state.js';
import { MODELS, TEAM_MEMBERS, NOW } from '../core/data.js';
import { fmt, esc, $, saved } from '../core/util.js';

const ACCENTS = [
  { id: 'ion', name: '离子青', a: '#5de8f6', b: '#a58fff' },
  { id: 'plasma', name: '等离子', a: '#b9a4ff', b: '#ff7ac6' },
  { id: 'solar', name: '日冕金', a: '#ffc56e', b: '#ff7a59' },
  { id: 'aurora', name: '北境绿', a: '#6cf2b4', b: '#5db7ff' },
];
const ROLES = ['所有者', '管理员', '研究员', '开发者', '财务只读'];
const AUDIT = [
  ['林知远', '创建了 API 密钥「生产 · 推荐系统」', 'key', 22], ['周屿', '启动训练任务「代码补全 · 仓库级 FIM」', 'training', 34 * 60 / 6],
  ['系统', '隔离 GPU wl-h100-03 · 3（ECC 错误）', 'shield', 7], ['沈墨', '将「研究组 · 模型评测」速率限制调整为 1,200 RPM', 'gauge', 180],
  ['何夕', '下载发票 INV-2026-09', 'billing', 60 * 26], ['林知远', '邀请成员 hexi@tensora.example（财务只读）', 'users', 60 * 50],
];

export default {
  domain: 'billing',
  mount(view) {
    const members = TEAM_MEMBERS;
    const notif = saved.get('notif', { train: true, gpu: true, budget: true, keys: true, models: false, weekly: true });
    view.innerHTML = `
      ${pageHead({ eyebrow: '账户 · 偏好与安全', title: '设置', sub: '外观偏好保存在当前浏览器；工作区、成员与安全设置对团队所有成员生效（演示环境不会提交到服务器）。' })}
      <div class="settings rv">
        ${tabs('s-tabs', [{ id: 'look', label: '外观' }, { id: 'ws', label: '工作区' }, { id: 'team', label: '成员', count: members.length }, { id: 'notif', label: '通知' }, { id: 'sec', label: '安全' }], 'look')}
        <div class="s-pane" data-pane="look">
          ${panel({ title: '主题色', meta: '影响按钮、选中态、发光与背景光场', body: `<div class="accents" id="accents">${ACCENTS.map((a) => `<button type="button" class="accent${state.prefs.accent === a.id ? ' on' : ''}" data-accent="${a.id}" aria-pressed="${state.prefs.accent === a.id}"><span class="sw" style="background:linear-gradient(135deg, ${a.a}, ${a.b})"></span><b>${a.name}</b><span class="ac-prev"><i style="background:${a.a}"></i><i style="background:${a.b}"></i></span></button>`).join('')}</div>` })}
          ${panel({ title: '界面', body: `<div class="s-rows">
            <div class="s-row"><div><b>动效</b><span>关闭后保留所有功能，只去掉过渡与背景流动。系统开启“减少动态效果”时会自动关闭。</span></div>${seg('s-motion', [{ value: 'full', label: '完整' }, { value: 'off', label: '关闭' }], state.prefs.motion)}</div>
            <div class="s-row"><div><b>信息密度</b><span>紧凑模式缩小面板内边距与间距，适合小屏笔记本。</span></div>${seg('s-density', [{ value: 'cozy', label: '舒适' }, { value: 'compact', label: '紧凑' }], state.prefs.density)}</div>
            <div class="s-row"><div><b>导航栏</b><span>收起后只显示图标，悬停显示名称。</span></div>${seg('s-rail', [{ value: 'wide', label: '展开' }, { value: 'slim', label: '收起' }], state.prefs.rail)}</div>
          </div>` })}
        </div>
        <div class="s-pane" data-pane="ws" hidden>
          ${panel({ title: '工作区', body: `<form class="form" id="ws-form">
            <div class="row2"><div class="field"><label class="field-l" for="ws-n">工作区名称</label><input class="input" id="ws-n" value="星枢 · 生产"></div>
            <div class="field"><label class="field-l" for="ws-r">默认区域</label><select class="select" id="ws-r"><option>华东 · 上海</option><option>华北 · 乌兰察布</option><option>新加坡</option></select></div></div>
            <div class="row2"><div class="field"><label class="field-l" for="ws-m">默认模型</label><select class="select" id="ws-m">${MODELS.filter((m) => m.cat === 'chat').map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
            <div class="field"><label class="field-l" for="ws-ret">请求日志保留</label><select class="select" id="ws-ret"><option>7 天</option><option selected>30 天</option><option>90 天</option><option>不保留请求内容</option></select></div></div>
            <div class="s-row"><div><b>数据不用于训练</b><span>网关转发到第三方上游时附带 no-train 标记，并在合同层面约束。</span></div>${toggle('ws-notrain', true, '数据不用于训练')}</div>
            <div class="s-row"><div><b>失败自动重试</b><span>上游 5xx 时最多重试 2 次，并切换到同模型的备用上游。</span></div>${toggle('ws-retry', true, '失败自动重试')}</div>
            <div class="form-act"><button class="btn primary" type="submit">保存更改</button></div>
          </form>` })}
        </div>
        <div class="s-pane" data-pane="team" hidden>
          ${panel({ title: '成员', meta: `${members.length} 人`, tools: `<button class="btn sm primary" type="button" id="invite">${icon('plus')}邀请成员</button>`, body: '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>成员</th><th>角色</th><th>最近活跃</th><th></th></tr></thead><tbody id="members"></tbody></table></div>' })}
        </div>
        <div class="s-pane" data-pane="notif" hidden>
          ${panel({ title: '通知', meta: '站内通知始终开启，以下控制邮件与企业微信推送', body: `<div class="s-rows">${[
            ['train', '训练任务', '任务完成、失败或被抢占时'], ['gpu', 'GPU 健康', '硬件故障、过热与节点离线'], ['budget', '预算与余额', '预算阈值、余额不足与充值到账'],
            ['keys', 'API 密钥', '额度预警、异常调用与密钥即将过期'], ['models', '模型上新', '模型广场新上架与价格调整'], ['weekly', '每周报告', '每周一 09:00 发送用量与成本摘要'],
          ].map(([k, t, d]) => `<div class="s-row"><div><b>${t}</b><span>${d}</span></div>${toggle(`n-${k}`, notif[k], t)}</div>`).join('')}</div>` })}
        </div>
        <div class="s-pane" data-pane="sec" hidden>
          ${panel({ title: '登录安全', body: `<div class="s-rows">
            <div class="s-row"><div><b>两步验证</b><span>登录时需要验证器 App 的 6 位动态码。</span></div>${toggle('sec-2fa', saved.get('2fa', true), '两步验证')}</div>
            <div class="s-row"><div><b>单点登录 (SSO)</b><span>通过企业身份提供商 SAML 2.0 登录，已同步 6 名成员。</span></div>${pill('good', '已连接')}</div>
          </div>` })}
          ${panel({ title: '活跃会话', body: '<div id="sessions"></div>' })}
          ${panel({ title: '审计日志', meta: '最近操作', body: `<ol class="audit">${AUDIT.map(([who, what, ic, min]) => `<li><span class="au-ic">${icon(ic)}</span><div><b>${esc(who)}</b><span>${esc(what)}</span></div><time>${fmt.rel(NOW - min * 60000)}</time></li>`).join('')}</ol>` })}
        </div>
      </div>`;

    bindTabs(view, 's-tabs', (id) => view.querySelectorAll('.s-pane').forEach((p) => { p.hidden = p.dataset.pane !== id; }));

    $('#accents', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-accent]');
      if (!b) return;
      setPref('accent', b.dataset.accent);
      view.querySelectorAll('[data-accent]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      toast({ kind: 'good', title: `主题色已切换为「${ACCENTS.find((a) => a.id === b.dataset.accent).name}」`, timeout: 1800 });
    });
    bindSeg(view, 's-motion', (v) => { setPref('motion', v); toast({ kind: 'info', title: v === 'off' ? '已关闭动效' : '已开启完整动效', timeout: 1800 }); });
    bindSeg(view, 's-density', (v) => setPref('density', v));
    bindSeg(view, 's-rail', (v) => { setPref('rail', v); document.getElementById('shell').dataset.rail = v; });

    $('#ws-form', view).addEventListener('submit', (e) => {
      e.preventDefault();
      const n = $('#ws-n', view);
      if (!n.value.trim()) { n.closest('.field').classList.add('err'); n.focus(); return; }
      const btn = e.submitter || view.querySelector('#ws-form .btn');
      btn.classList.add('loading');
      setTimeout(() => { btn.classList.remove('loading'); toast({ kind: 'good', title: '工作区设置已保存', body: `默认模型：${$('#ws-m', view).selectedOptions[0].textContent}` }); }, 600);
    });
    for (const id of ['ws-notrain', 'ws-retry']) bindToggle($(`#${id}`, view), () => {});

    for (const k of Object.keys(notif)) {
      bindToggle($(`#n-${k}`, view), (on) => { notif[k] = on; saved.set('notif', notif); toast({ kind: 'info', title: `已${on ? '开启' : '关闭'}推送`, timeout: 1500 }); });
    }
    bindToggle($('#sec-2fa', view), async (on) => {
      saved.set('2fa', on);
      toast({ kind: on ? 'good' : 'warn', title: on ? '两步验证已开启' : '两步验证已关闭', body: on ? '' : '建议所有者账号保持开启' });
    });

    const drawMembers = () => {
      $('#members', view).innerHTML = members.map((m, i) => `<tr><td><div class="mem"><span class="mav" style="--h:${(i * 57) % 360}">${esc(m.name.slice(0, 1))}</span><div><b>${esc(m.name)}</b><span class="sub">${esc(m.email)}</span></div>${m.pending ? '<span class="tag">待接受</span>' : ''}</div></td>
        <td>${m.role === '所有者' ? `<span class="tag">${m.role}</span>` : `<select class="select sm" data-role="${i}" aria-label="${esc(m.name)} 的角色">${ROLES.slice(1).map((r) => `<option${r === m.role ? ' selected' : ''}>${r}</option>`).join('')}</select>`}</td>
        <td class="muted">${m.pending ? '尚未登录' : fmt.rel(m.active)}</td>
        <td class="num">${m.role === '所有者' ? '' : `<button type="button" class="btn xs ghost" data-rm="${i}">${icon('trash')}移除</button>`}</td></tr>`).join('');
    };
    drawMembers();
    $('#members', view).addEventListener('change', (e) => {
      const s = e.target.closest('[data-role]');
      if (!s) return;
      members[+s.dataset.role].role = s.value;
      toast({ kind: 'good', title: `${members[+s.dataset.role].name} 的角色已改为「${s.value}」`, timeout: 2000 });
    });
    $('#members', view).addEventListener('click', async (e) => {
      const b = e.target.closest('[data-rm]');
      if (!b) return;
      const m = members[+b.dataset.rm];
      if (!(await confirmDialog({ title: '移除成员', body: `「<b>${esc(m.name)}</b>」将立即失去工作区访问权限，其创建的密钥不受影响。`, confirmLabel: '移除', danger: true }))) return;
      members.splice(+b.dataset.rm, 1);
      drawMembers();
      toast({ kind: 'info', title: `已移除 ${m.name}` });
    });
    $('#invite', view).addEventListener('click', () => {
      openLayer({
        kind: 'modal', title: '邀请成员', eyebrow: '工作区',
        body: `<form class="form" id="inv-form" novalidate><div class="field"><label class="field-l" for="inv-e">邮箱</label><input class="input" id="inv-e" type="email" placeholder="name@company.com" autocomplete="off" autofocus><span class="field-h" id="inv-h">邀请链接 7 天内有效</span></div>
          <div class="field"><label class="field-l" for="inv-r">角色</label><select class="select" id="inv-r">${ROLES.slice(1).map((r) => `<option${r === '开发者' ? ' selected' : ''}>${r}</option>`).join('')}</select></div></form>`,
        foot: '<button class="btn ghost" type="button" data-x>取消</button><button class="btn primary" type="submit" form="inv-form">发送邀请</button>',
        onMount(p, close) {
          p.querySelector('[data-x]').addEventListener('click', () => close());
          $('#inv-form', p).addEventListener('submit', (e) => {
            e.preventDefault();
            const v = $('#inv-e', p).value.trim();
            const f = $('#inv-e', p).closest('.field');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { f.classList.add('err'); $('#inv-h', p).textContent = '请输入有效的邮箱地址'; return; }
            if (members.some((m) => m.email === v)) { f.classList.add('err'); $('#inv-h', p).textContent = '该成员已在工作区中'; return; }
            members.push({ name: v.split('@')[0], email: v, role: $('#inv-r', p).value, active: Date.now(), pending: true });
            close();
            drawMembers();
            toast({ kind: 'good', title: '邀请已发送', body: `${v} · ${$('#inv-r', p).value}（演示，不会发送真实邮件）` });
          });
          $('#inv-e', p).addEventListener('input', () => $('#inv-e', p).closest('.field').classList.remove('err'));
        },
      });
    });

    const sessions = [
      { dev: 'MacBook Pro · Chrome', ip: '116.228.x.x · 上海', at: Date.now() - 60000, current: true },
      { dev: 'iPhone 16 · Tensora App', ip: '223.104.x.x · 上海', at: Date.now() - 3 * 3600000 },
      { dev: 'Windows · Edge', ip: '101.80.x.x · 杭州', at: Date.now() - 2 * 86400000 },
    ];
    const drawSessions = () => {
      $('#sessions', view).innerHTML = `<div class="sess">${sessions.map((s, i) => `<div class="se"><span class="se-ic">${icon(s.dev.includes('iPhone') ? 'radio' : 'terminal')}</span><div><b>${esc(s.dev)}</b><span>${esc(s.ip)} · ${fmt.rel(s.at)}</span></div>${s.current ? pill('good', '当前会话') : `<button type="button" class="btn xs" data-kill="${i}">退出登录</button>`}</div>`).join('')}</div>`;
    };
    drawSessions();
    $('#sessions', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-kill]');
      if (!b) return;
      const s = sessions.splice(+b.dataset.kill, 1)[0];
      drawSessions();
      toast({ kind: 'good', title: '已退出该会话', body: s.dev });
    });
  },
};
