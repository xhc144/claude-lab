import { h, clear, toast } from '../lib/dom.js';
import { get, put, post } from '../api.js';
import { money, tokens } from '../lib/fmt.js';
import { app, applyUser } from '../main.js';

export async function mountSettings(root) {
  const usage = await get('/api/account/usage');
  const s = app.user.settings;
  const cur = h('select.select', {}, h('option', { value: 'USD', selected: s.currency === 'USD' }, '美元 USD'), h('option', { value: 'CNY', selected: s.currency === 'CNY' }, '人民币 CNY'));
  const rate = h('input.input.mono', { type: 'number', step: 0.01, min: 1, value: s.cnyPerUsd });
  const cap = h('input.input.mono', { type: 'number', step: 1, min: 0, value: s.globalBudgetUsd });
  const oldPw = h('input.input', { type: 'password', autocomplete: 'current-password' });
  const newPw = h('input.input', { type: 'password', autocomplete: 'new-password' });

  const days = Object.entries(usage.byDay || {}).sort().slice(-30);
  const max = Math.max(1e-9, ...days.map(([, v]) => v));
  const chart = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', padding: '8px 0' } },
    ...days.map(([d, v]) => h('div', { title: `${d} · ${money(v)}`, style: { flex: 1, minWidth: '6px', height: `${Math.max(2, (v / max) * 100)}%`, background: 'linear-gradient(180deg, var(--cyan), rgba(167,139,250,.5))', borderRadius: '3px 3px 0 0' } })));

  const field = (label, el, hint) => h('label.field', {}, h('span', {}, label), el, hint ? h('span.hint', {}, hint) : null);
  clear(root, h('div.page', {},
    h('header.page-head', {}, h('div', {}, h('div.eyebrow', {}, 'ACCOUNT'), h('h1', {}, '账户与计费'), h('p', {}, `当前用户：${app.user.username}`))),
    h('div.grid2', { style: { alignItems: 'start' } },
      h('section.panel.hud', {}, h('div.panel-head', {}, h('span.zh', {}, '费用显示与总预算')), h('div.panel-body.col', { style: { gap: '14px' } },
        h('div.grid2', {}, field('显示币种', cur), field('汇率（1 美元 = ? 人民币）', rate, '用于人民币计价模型（DeepSeek、通义、Kimi、智谱、豆包）的换算')),
        field('账户总预算（美元，0 为不限）', cap, '所有研究累计花费达到上限后，新的模型调用会被拒绝。'),
        h('div.row', {}, h('button.btn.primary', { onclick: async () => {
          try {
            const r = await put('/api/account/settings', { currency: cur.value, cnyPerUsd: +rate.value, globalBudgetUsd: +cap.value });
            applyUser(r.user);
            toast('已保存', 'ok');
          } catch (e) { toast(e.message, 'err'); }
        } }, '保存')))),
      h('section.panel.hud', {}, h('div.panel-head', {}, h('span.zh', {}, '用量')), h('div.panel-body', {},
        h('div.grid2', {}, h('div', {}, h('div.eyebrow', {}, 'TOTAL SPEND'), h('div.mono', { style: { fontSize: '24px' } }, money(usage.totalUsd || 0))), h('div', {}, h('div.eyebrow', {}, 'TOKENS'), h('div.mono', { style: { fontSize: '24px' } }, tokens(usage.totalTokens || 0)))),
        days.length ? chart : h('p.hint', {}, '暂无用量记录。'),
        h('p.hint', {}, '费用按各模型在接入中心设置的参考价估算，实际以服务商账单为准。'))),
      h('section.panel.hud', {}, h('div.panel-head', {}, h('span.zh', {}, '修改密码')), h('div.panel-body.col', { style: { gap: '12px' } },
        field('当前密码', oldPw), field('新密码（至少 8 位）', newPw),
        h('div.row', {}, h('button.btn', { onclick: async () => {
          try { await post('/api/account/password', { oldPassword: oldPw.value, newPassword: newPw.value }); toast('密码已修改，其他设备已登出', 'ok'); oldPw.value = newPw.value = ''; } catch (e) { toast(e.message, 'err'); }
        } }, '修改密码')))),
      h('section.panel.hud', {}, h('div.panel-head', {}, h('span.zh', {}, '密钥安全')), h('div.panel-body', {},
        h('ul.hint', { style: { margin: 0, paddingLeft: '18px', lineHeight: '1.9' } },
          h('li', {}, 'API Key 由服务器以 AES-256-GCM 加密存储，密钥派生绑定到你的账户与具体服务商。'),
          h('li', {}, '浏览器只会收到掩码提示（如 sk-••••abcd），所有模型调用都在服务器端发出。'),
          h('li', {}, '服务商返回的错误信息在展示前会去除密钥片段。'),
          h('li', {}, '每个账户的服务商、研究与用量相互隔离；登录会话使用 HttpOnly + SameSite=Strict Cookie 与 CSRF 令牌。')))))));
  return null;
}
