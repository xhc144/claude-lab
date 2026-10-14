import { h, clear } from '../lib/dom.js';
import { logo } from '../lib/icons.js';
import { post, setCsrf } from '../api.js';
import { app } from '../main.js';

export function mountAuth(root, { onLogin }) {
  const signup = app.meta?.signup || 'open';
  let mode = app.meta?.hasUsers ? 'login' : 'register';
  const err = h('div.form-error.hidden');
  const user = h('input.input', { name: 'username', autocomplete: 'username', placeholder: '用户名', required: true });
  const pass = h('input.input', { name: 'password', type: 'password', autocomplete: 'current-password', placeholder: '密码（至少 8 位）', required: true });
  const invite = h('input.input', { name: 'invite', placeholder: '邀请码' });
  const submit = h('button.btn.primary', { type: 'submit', style: { width: '100%', height: '40px' } });
  const tabs = h('div.tabs');
  const inviteWrap = h('label.field', {}, h('span', {}, '邀请码'), invite);
  const form = h('form.col', { style: { gap: '14px' }, onsubmit: async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    submit.disabled = true;
    try {
      const body = { username: user.value, password: pass.value };
      if (mode === 'register' && signup === 'invite') body.invite = invite.value;
      const r = await post(mode === 'login' ? '/api/auth/login' : '/api/auth/register', body);
      setCsrf(r.csrf);
      onLogin(r.user);
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    } finally {
      submit.disabled = false;
    }
  } },
  tabs,
  h('label.field', {}, h('span', {}, '用户名'), user),
  h('label.field', {}, h('span', {}, '密码'), pass),
  inviteWrap, err, submit,
  h('p.hint', {}, 'API 密钥使用 AES-256-GCM 加密保存在本服务器，只用于服务器端调用模型，永远不会发送到浏览器或其他用户。'));

  const paint = () => {
    clear(tabs,
      h(`button${mode === 'login' ? '.on' : ''}`, { type: 'button', onclick: () => { mode = 'login'; paint(); } }, '登录'),
      signup !== 'closed' ? h(`button${mode === 'register' ? '.on' : ''}`, { type: 'button', onclick: () => { mode = 'register'; paint(); } }, '注册') : null);
    submit.textContent = mode === 'login' ? '进入实验室' : '创建账户';
    pass.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    inviteWrap.classList.toggle('hidden', !(mode === 'register' && signup === 'invite'));
  };
  if (signup === 'closed') mode = 'login';
  paint();

  const tenet = (b, s) => h('div.tenet', {}, h('b', {}, b), h('span', {}, s));
  clear(root, h('div.auth', {},
    h('section.pitch', {},
      h('div.brandmark', {}, logo(), h('div', {}, h('div.t1', {}, '论 衡'), h('div.t2', {}, 'LUNHENG · MULTI-AGENT RESEARCH LAB'))),
      h('h1', {}, '让多家 AI 模型', h('br'), h('em', {}, '互相质疑、彼此核验')),
      h('p', {}, '组建 5–10 名来自不同厂商的模型研究员，独立推导、交叉质询、寻找反例、独立核验。结论只由论证和核验决定——真理不由多数决定。'),
      h('div.tenets', {},
        tenet('独立核验', '一条断言只有获得非作者、跨厂商的独立核验才算“已证明”。'),
        tenet('反例优先', '一个经裁定成立的反例，足以推翻任何多数共识。'),
        tenet('共识≠真理', '立场分布被单独记录，并在共识超前于证明时拉响警报。'))),
    h('section.panel.hud.card', {},
      h('div.eyebrow', {}, 'ACCESS · 身份验证'),
      h('h2', { style: { margin: '8px 0 18px', fontSize: '22px' } }, mode === 'login' ? '欢迎回到实验室' : '创建研究员账户'),
      form)));
  user.focus();
  return null;
}
