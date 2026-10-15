import { h, clear, toast, confirmBox } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { get, post, del } from '../api.js';
import { money, tokens, ago, STATUS, SESSION_STATUS } from '../lib/fmt.js';
import { mdInline } from '../lib/md.js';
import { navigate } from '../main.js';

export async function mountArchive(root) {
  const [{ sessions }, { providers }, usage] = await Promise.all([get('/api/sessions'), get('/api/providers'), get('/api/account/usage')]);
  const running = sessions.filter((s) => s.status === 'running').length;
  const kpi = (label, value, sub) => h('div.panel.hud.kpi', {}, h('div.eyebrow', {}, label), h('div.v', {}, value), h('div.s', {}, sub));

  const cards = h('div.cards');
  const paint = (list) => {
    if (!list.length) {
      clear(cards, h('div.panel.empty', { style: { gridColumn: '1 / -1' } },
        icon('flask'),
        h('h3', {}, providers.length ? '还没有研究' : '先接入至少一个 AI 服务商'),
        h('p', {}, providers.length ? '提出一个数学、物理或计算机科学命题，组建跨厂商研究团队开始研究。' : '在接入中心填写 API Key、Base URL 与模型 ID，支持 OpenAI、Claude、Gemini、DeepSeek、通义千问、Kimi、智谱、豆包、Grok、Ollama 及 OpenAI 兼容中转。'),
        h('div.row', { style: { justifyContent: 'center', marginTop: '14px' } },
          providers.length ? h('a.btn.primary', { href: '#/new' }, icon('plus'), '新建研究') : h('a.btn.primary', { href: '#/gateway' }, icon('gateway'), '前往接入中心'))));
      return;
    }
    clear(cards, ...list.map((s) => {
      const q = h('div.q');
      q.innerHTML = mdInline(s.question);
      return h('article.panel.hud.study', { onclick: () => navigate(`#/s/${s.id}`), tabindex: 0, onkeydown: (e) => { if (e.key === 'Enter') navigate(`#/s/${s.id}`); } },
        h('div.row', {},
          h('span.chip.status', { dataset: { s: s.c0 } }, h('span.dot'), `C0 ${STATUS[s.c0] || s.c0}`),
          h('span.chip', {}, SESSION_STATUS[s.status] || s.status),
          h('span.grow'),
          h('span.faint.mono', { style: { fontSize: '11px' } }, ago(s.updatedAt))),
        h('h3', {}, s.title),
        q,
        h('div.team', {}, ...s.team.map((r) => h('span.badge-letter', { style: { '--c': r.color }, title: `${r.label} · ${r.modelId}` }, r.label))),
        h('div.meta', {}, h('span', {}, `R${s.round}`), h('span', {}, `${s.claims} 断言`), h('span', {}, tokens(s.tokens) + ' tok'), h('span', {}, money(s.costUsd)), h('span.grow'),
          h('button.btn.xs.ghost', { title: '复制为新研究', onclick: async (e) => { e.stopPropagation(); const r = await post(`/api/sessions/${s.id}/duplicate`); toast('已复制研究配置', 'ok'); navigate(`#/s/${r.id}`); } }, icon('copy')),
          h('button.btn.xs.ghost', { title: '删除', onclick: async (e) => {
            e.stopPropagation();
            if (!(await confirmBox('删除研究', `确定删除「${s.title}」及其全部研究记录吗？此操作不可撤销。`, { danger: true, ok: '删除' }))) return;
            await del(`/api/sessions/${s.id}`);
            const i = list.indexOf(s);
            list.splice(i, 1);
            paint(list);
          } }, icon('trash'))));
    }));
  };
  paint(sessions);

  clear(root, h('div.page', {},
    h('header.page-head', {},
      h('div', {}, h('div.eyebrow', {}, 'RESEARCH ARCHIVE'), h('h1', {}, '研究档案'), h('p', {}, '全部研究的状态、结论与成本；研究历史自动保存，可随时继续。')),
      h('div.actions', {}, h('a.btn', { href: '#/gateway' }, icon('gateway'), `接入中心 · ${providers.length}`), h('a.btn.primary', { href: '#/new' }, icon('plus'), '新建研究'))),
    h('section.kpis', {},
      kpi('STUDIES · 研究', sessions.length, `${running} 项正在进行`),
      kpi('SETTLED · 已判定', sessions.filter((s) => ['proved', 'refuted'].includes(s.c0)).length, '主命题已证明或证伪'),
      kpi('SPEND · 累计费用', money(usage.totalUsd || 0), '按各模型参考价估算'),
      kpi('TOKENS · 用量', tokens(usage.totalTokens || 0), `${providers.length} 个服务商已接入`)),
    cards));
  return null;
}
