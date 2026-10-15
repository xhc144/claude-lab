export const STATUS = {
  proved: '已证明', conditional: '条件成立', refuted: '已证伪', disputed: '争议中', pending: '待核验',
  conjecture: '猜想', definition: '定义', withdrawn: '已撤回', open: '未决', inconsistent: '矛盾',
};
export const STATUS_COLOR = {
  proved: '#34f5a4', conditional: '#2fd6c4', refuted: '#ff5c8a', disputed: '#ffb547', pending: '#5b9dff',
  conjecture: '#b18cff', definition: '#9fb3c8', withdrawn: '#4b5873', open: '#8b9ab3', inconsistent: '#ff3b3b',
};
export const KIND = { proposition: '主命题', theorem: '定理', lemma: '引理', conjecture: '猜想', counterexample: '反例', observation: '观察', definition: '定义' };
export const OTYPE = { counterexample: '反例', gap: '证明缺口', error: '推理错误', ambiguity: '歧义', scope: '适用范围' };
export const SEV = { fatal: '致命', major: '重要', minor: '次要' };
export const OSTATE = { open: '未回应', rebutted: '已反驳待裁定', conceded: '作者承认', addressed: '已修订', upheld: '质疑成立', dismissed: '质疑驳回', contested: '裁定分歧', withdrawn: '已撤回' };
export const VERDICT = { valid: '有效', gap: '有缺口', flawed: '有错误', false: '陈述为假', unverifiable: '无法核验' };
export const POS = { agree: '同意', disagree: '反对', unsure: '不确定' };
export const SESSION_STATUS = { ready: '待启动', running: '研究中', pausing: '暂停中…', paused: '已暂停', completed: '已完成', failed: '出错' };

let currency = { code: 'USD', rate: 7.1 };
export function setCurrency(code, rate) { currency = { code, rate: rate || 7.1 }; }

export function money(usd, digits) {
  const v = currency.code === 'CNY' ? usd * currency.rate : usd;
  const sym = currency.code === 'CNY' ? '¥' : '$';
  const d = digits ?? (Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 3 : 4);
  return `${sym}${(v || 0).toFixed(d)}`;
}

export function tokens(n) {
  n = n || 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

export function ms(n) {
  if (!n) return '—';
  return n >= 60000 ? `${(n / 60000).toFixed(1)}m` : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`;
}

export function clock(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

export function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}
