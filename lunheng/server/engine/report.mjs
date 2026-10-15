// Research report. The authoritative sections (proved / refuted / conjectures / open problems) are
// generated deterministically from the ledger; the chair's narrative is appended and labelled as
// model-written, so a model can never promote a conjecture to a theorem in the report.
import { CLAIM_STATUS, OBJECTION_STATE, current, consensusOf, consensusWarnings } from './ledger.mjs';
import { kindName, DOMAINS, PHASES } from './prompts.mjs';
import { ROLES } from './roles.mjs';

const VERDICT_NAME = { valid: '有效', gap: '有缺口', flawed: '有错误', false: '陈述为假', unverifiable: '无法核验' };
const OTYPE_NAME = { counterexample: '反例', gap: '证明缺口', error: '推理错误', ambiguity: '歧义', scope: '适用范围' };

function who(session, rid) {
  if (rid === 'PI') return '首席研究员';
  const r = session.team.find((x) => x.id === rid);
  return r ? `研究员 ${r.label}（${r.modelId}）` : rid;
}

const fmtUsd = (x) => `$${(x || 0).toFixed(x >= 1 ? 2 : 4)}`;
const quote = (s) => String(s || '').trim();

function claimBlock(session, c, { withProof = true, withObjections = true } = {}) {
  const L = session.ledger;
  const cur = current(c);
  const lines = [`### ${c.id} · ${kindName(c.kind)}${cur.v > 1 ? `（第 ${cur.v} 版）` : ''}`];
  lines.push(`**陈述**：${quote(cur.statement)}`);
  lines.push(`<small>提出者：${who(session, c.author)} · 第 ${c.round} 轮 · 状态依据：${c.statusReason}</small>`);
  if (c.depends.length) lines.push(`**依赖**：${c.depends.join('、')}`);
  if (withProof && cur.proof) lines.push(`**证明**：\n\n${quote(cur.proof)}`);
  if (cur.evidence) lines.push(`**证据**：${quote(cur.evidence)}`);
  const verdicts = Object.values(L.verdicts).filter((v) => v.target === c.id && v.targetVersion === cur.v);
  if (verdicts.length) lines.push(`**核验记录**：${verdicts.map((v) => `${who(session, v.by)} 判定「${VERDICT_NAME[v.verdict]}」`).join('；')}`);
  if (withObjections) {
    const objs = Object.values(L.objections).filter((o) => o.target === c.id);
    if (objs.length) {
      lines.push('**质疑与处理**：');
      for (const o of objs) {
        lines.push(`- ${o.id}（${who(session, o.author)} · ${OTYPE_NAME[o.type] || o.type} · ${OBJECTION_STATE[o.state] || o.state}${o.targetVersion < cur.v ? ` · 针对第 ${o.targetVersion} 版` : ''}）：${quote(o.content).slice(0, 1200)}`);
        if (o.counterexample) lines.push(`  - 反例：${quote(o.counterexample).slice(0, 800)}`);
      }
    }
  }
  const evid = Object.values(L.evidence).filter((e) => e.target === c.id);
  if (evid.length) lines.push(`**计算证据**：${evid.map((e) => `${e.id}（${e.ok ? '运行成功' : '运行失败'}）`).join('、')}`);
  const k = consensusOf(L, c.id, new Set(session.team.map((r) => r.id)));
  if (k.n) lines.push(`<small>立场分布（不作为判定依据）：同意 ${k.agree} · 反对 ${k.disagree} · 不确定 ${k.unsure}</small>`);
  return lines.join('\n\n');
}

export function buildReport(session, narrative = '') {
  const L = session.ledger;
  const claims = Object.values(L.claims).filter((c) => c.id !== 'C0');
  const by = (s) => claims.filter((c) => c.status === s);
  const C0 = L.claims.C0;
  const verdictLine = {
    proved: '✅ 主命题已被证明',
    refuted: '❌ 主命题已被证伪',
    conditional: '🟡 主命题条件成立（依赖尚未证明的引理）',
    disputed: '⚠️ 主命题表述存在争议',
    inconsistent: '🛑 账本出现矛盾：同时存在已核验的证明与否定，需要人工审查',
    open: '❔ 主命题尚未解决',
  }[C0.status] || C0.status;

  const out = [];
  out.push(`# 研究报告：${session.title}`);
  out.push(`> **研究命题**：${quote(current(C0).statement)}`);
  out.push(`领域：${DOMAINS[session.domain] || session.domain} · 研究轮次：${session.cursor.round} · 团队：${session.team.length} 名研究员（${new Set(session.team.map((r) => r.vendor)).size} 家厂商） · 总费用：${fmtUsd(session.usage.costUsd)} · Token：${(session.usage.inputTokens + session.usage.outputTokens).toLocaleString('en-US')} · 生成于 ${new Date().toLocaleString('zh-CN', { hour12: false })}`);

  out.push('## 结论摘要');
  out.push(`**${verdictLine}**\n\n依据：${C0.statusReason}`);
  out.push(`| 状态 | 数量 |\n| --- | --- |\n${['proved', 'conditional', 'refuted', 'pending', 'disputed', 'conjecture', 'withdrawn'].map((s) => `| ${CLAIM_STATUS[s]} | ${by(s).length} |`).join('\n')}`);
  out.push(`判定规则：一条断言只有在其证明获得至少 ${session.settings.minVerifiers} 名非作者研究员的独立核验${session.settings.crossVendor ? '（且至少一名来自不同厂商）' : ''}、且不存在未决的重要质疑时，才被标记为「已证明」；经独立裁定成立的反例使断言「已证伪」。研究员的同意/反对立场只作为共识参考，**不参与真假判定**。`);

  out.push('## 一、已证明的结论');
  out.push(by('proved').length ? by('proved').map((c) => claimBlock(session, c)).join('\n\n---\n\n') : '_本次研究没有获得完整核验的证明。_');

  if (by('conditional').length) {
    out.push('## 二、条件成立的结论');
    out.push('以下断言的证明已通过核验，但依赖尚未证明的断言，只能视为条件性结论。');
    out.push(by('conditional').map((c) => claimBlock(session, c)).join('\n\n---\n\n'));
  }

  out.push('## 三、已证伪的断言');
  out.push(by('refuted').length ? by('refuted').map((c) => claimBlock(session, c, { withProof: false })).join('\n\n---\n\n') : '_无。_');

  out.push('## 四、猜想（尚无有效证明）');
  out.push(by('conjecture').length ? by('conjecture').map((c) => claimBlock(session, c, { withProof: true })).join('\n\n---\n\n') : '_无。_');

  const unresolved = [...by('pending'), ...by('disputed')];
  out.push('## 五、待核验与争议中的断言');
  out.push(unresolved.length ? unresolved.map((c) => `**【${CLAIM_STATUS[c.status]}】**\n\n${claimBlock(session, c)}`).join('\n\n---\n\n') : '_无。_');

  out.push('## 六、未解决问题');
  const qs = L.questions.map((q) => `- ${quote(q.text)}（${who(session, q.by)}）`);
  const openObjs = Object.values(L.objections).filter((o) => ['open', 'rebutted', 'contested'].includes(o.state) && o.severity !== 'minor')
    .map((o) => `- 质疑 ${o.id} 对 ${o.target} 的${OTYPE_NAME[o.type] || o.type}问题尚未定论：${quote(o.content).slice(0, 300)}`);
  out.push([...openObjs, ...qs].join('\n') || '_无记录。_');

  const warnings = consensusWarnings(L, new Set(session.team.map((r) => r.id)));
  out.push('## 七、共识与证据的偏差');
  out.push(warnings.length ? warnings.map((w) => `- ${w.text}`).join('\n') : '_未发现共识与证据状态明显背离的断言。_');

  out.push('## 八、研究叙述（主持人撰写）');
  out.push('> 以下内容由主持人模型撰写，仅供理解研究过程；如与上文账本章节冲突，以账本章节为准。');
  out.push(narrative ? quote(narrative) : '_主持人未生成叙述。_');

  const evid = Object.values(L.evidence);
  if (evid.length) {
    out.push('## 附录 A：计算证据');
    out.push(evid.map((e) => `### ${e.id} · ${who(session, e.by)}${e.target ? ` · 关于 ${e.target}` : ''}\n\n${e.purpose ? `目的：${e.purpose}\n\n` : ''}\`\`\`js\n${e.code}\n\`\`\`\n\n${e.ok ? `输出：\n\n\`\`\`\n${e.output.slice(0, 3000) || '（无输出）'}\n\`\`\`` : `错误：${e.error}`}`).join('\n\n'));
  }

  out.push('## 附录 B：研究团队与调用统计');
  out.push(`| 代号 | 模型 | 服务商 | 角色 | 调用 | 输入 Token | 输出 Token | 费用 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${session.team.map((r) => `| ${r.label} | ${r.modelId} | ${r.providerName} | ${ROLES[r.role]?.name || r.role} | ${r.stats.calls} | ${r.stats.inputTokens.toLocaleString('en-US')} | ${r.stats.outputTokens.toLocaleString('en-US')} | ${fmtUsd(r.stats.costUsd)} |`).join('\n')}`);
  if (session.usage.estimated) out.push('<small>部分调用的 Token 由服务商未返回用量而按文本长度估算。</small>');

  out.push('## 附录 C：研究时间线');
  out.push(session.timeline.map((t) => `- 第 ${t.round} 轮 · ${PHASES[t.phase]?.name || t.phase}${t.skipped ? '（跳过）' : ''}：${t.summary || ''}`).join('\n') || '_无。_');

  return out.join('\n\n');
}
