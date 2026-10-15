// Prompt construction: the shared research charter, per-phase task instructions and the ledger digest
// each researcher sees. Authors are shown by anonymous label (研究员 A, B, …) unless the session
// disables anonymity, so that arguments are judged on content rather than on the brand of the model.
import { ROLES } from './roles.mjs';
import { CLAIM_STATUS, OBJECTION_STATE, current, consensusOf } from './ledger.mjs';
import { proseOnly } from './protocol.mjs';
import { truncate } from '../util/text.mjs';

export const PHASES = {
  independent: { name: '独立研究', en: 'Independent analysis' },
  investigate: { name: '专项攻关', en: 'Focused investigation' },
  critique: { name: '交叉质询', en: 'Cross-examination' },
  rebuttal: { name: '答辩修正', en: 'Rebuttal & revision' },
  verify: { name: '独立核验', en: 'Verification' },
  synthesis: { name: '综合规划', en: 'Synthesis' },
  report: { name: '撰写报告', en: 'Report' },
  consult: { name: '定向问询', en: 'Consultation' },
};

export const DOMAINS = { math: '数学', physics: '物理', cs: '计算机科学', other: '交叉学科' };

const KIND_NAME = { proposition: '主命题', theorem: '定理', lemma: '引理', conjecture: '猜想', counterexample: '反例', observation: '观察/计算事实', definition: '定义' };
const OTYPE_NAME = { counterexample: '反例', gap: '证明缺口', error: '推理错误', ambiguity: '歧义', scope: '适用范围' };
const SEV_NAME = { fatal: '致命', major: '重要', minor: '次要' };
const VERDICT_NAME = { valid: '有效', gap: '有缺口', flawed: '有错误', false: '陈述为假', unverifiable: '无法核验' };
const POS_NAME = { agree: '同意', disagree: '反对', unsure: '不确定' };

export const kindName = (k) => KIND_NAME[k] || k;

const TAG_DOCS = {
  claim: `<claim ref="n1" kind="theorem|lemma|conjecture|counterexample|observation|definition" relation="proves|refutes|supports" target="C0" depends="C2,n2" confidence="0.8">
<statement>断言的精确陈述（自足、可判定）</statement>
<proof>完整证明。反例：给出具体实例与验算。猜想：写明证据与缺口</proof>
</claim>
  · relation 与 target 可选：relation="proves" target="C0" 表示此断言一旦成立即证明主命题；relation="refutes" 表示否定 target；kind="counterexample" 默认否定其 target。
  · 只有附完整证明的断言才用 theorem/lemma；没有证明的推测必须标为 conjecture。`,
  stance: `<stance target="C0" position="agree|disagree|unsure" confidence="0~1">一句话理由</stance>
  · agree = 你认为该断言为真。每次回答都必须给出你对 C0 的立场；也可对其他断言表态。`,
  objection: `<objection target="C3" type="counterexample|gap|error|ambiguity|scope" severity="fatal|major|minor">
指出具体问题：哪一步、为什么不成立、需要什么才能修复。
<counterexample>若 type="counterexample"：具体实例与完整验算</counterexample>
</objection>`,
  response: `<response objection="O4" action="concede|rebut|revise">
回应理由。concede = 承认质疑成立；rebut = 论证质疑不成立（必须给出具体理由）；revise = 修正断言。
<revised_statement>修订后的陈述（revise 时）</revised_statement>
<revised_proof>修订后的完整证明（revise 时）</revised_proof>
</response>`,
  verdict: `<verdict target="C3" result="valid|gap|flawed|false|unverifiable">逐步核验记录与结论依据</verdict>
  · valid：每一步都严格成立；gap：存在未论证的关键步骤；flawed：推理有错（陈述可能仍真）；false：陈述本身为假（必须给出反例）；unverifiable：无法判断。`,
  ruling: `<ruling objection="O5" result="upheld|dismissed">对该质疑是否成立的裁定理由</ruling>`,
  compute: `<compute purpose="例：穷举检验 n≤10^5" target="C3">
// JavaScript（QuickJS 沙箱，无网络、无文件；console.log 输出；可用 BigInt；单次限时约 4 秒）
</compute>
  · 系统会执行代码并把输出交还给你，届时再给出最终结论。数值结果只是证据，不能代替证明（穷尽全部有限情形除外）。`,
  question: `<question>值得继续研究的开放问题</question>`,
  withdraw: `<withdraw target="C5">撤回理由（只能撤回你自己提出的断言）</withdraw>`,
  summary: `<summary>本轮进展的客观总结——以账本状态为准，不以人数为准</summary>`,
  focus: `<focus target="C4" priority="high|normal">下一轮为何应聚焦于此</focus>`,
  assign: `<assign researcher="B" task="prove|refute|verify|explore|compute|generalize" target="C4">给该研究员的具体任务</assign>`,
  decision: `<decision value="continue|conclude">理由</decision>`,
};

const PHASE_TAGS = {
  independent: ['claim', 'stance', 'compute', 'question'],
  investigate: ['claim', 'stance', 'objection', 'compute', 'question', 'withdraw'],
  critique: ['objection', 'stance', 'claim', 'compute', 'question'],
  rebuttal: ['response', 'stance', 'claim', 'withdraw', 'compute'],
  verify: ['verdict', 'ruling', 'stance', 'claim', 'compute'],
  synthesis: ['summary', 'focus', 'assign', 'decision', 'stance'],
  consult: ['claim', 'stance', 'objection', 'verdict', 'ruling', 'compute', 'question', 'withdraw'],
  report: [],
};

export function researcherLabel(session, rid) {
  if (rid === 'PI') return '首席研究员（人类）';
  const r = session.team.find((x) => x.id === rid);
  if (!r) return rid;
  return session.settings.anonymize ? `研究员 ${r.label}` : `研究员 ${r.label}（${r.modelId}）`;
}

export function systemPrompt(session, r) {
  const role = ROLES[r.role] || ROLES.generalist;
  const lang = session.language === 'en' ? 'English' : '简体中文';
  return `你是「论衡」多智能体学术研究实验室的研究员 ${r.label}，角色：${role.name}。
实验室由来自不同机构的多个 AI 模型组成，在一位人类首席研究员（PI）的监督下，共同研究一个${DOMAINS[session.domain] || ''}命题。其他研究员以匿名代号出现。

【学术准则】
1. 真理不由多数决定。只有经过严格推导、并由其他研究员独立核验的证明才算“已证明”；一个经核实的反例足以推翻任何断言，不论多少人支持它。
2. 严格区分：完整证明 / 证明草图 / 启发式论证 / 数值证据 / 猜想。数值检验不是证明（穷尽全部有限情形除外）。
3. 每一步推导都要可检查：写明所用定义、定理及其适用条件；不得用“显然”“易证”跳过关键步骤。
4. 主动寻找反例和漏洞，包括你自己的论证；发现自己错了就明确承认并修正——这是美德而非失败。
5. 只引用你确信存在的经典结果，并注明“需核实”；绝不编造文献、作者、年份或数据。
6. 数学用 LaTeX：行内 $...$，独立公式 $$...$$。
7. 输出语言：${lang}。

【你的职责】
${role.duty}

【标记协议】
正文用 Markdown 自由论述；需要记入「断言账本」的内容必须使用指定的标记（标记之外的内容不会被记录）。属性值用英文双引号。引用账本条目用编号（C3、O2）；本次回答中新提出的断言用 ref="n1"、"n2" 等临时编号，可在 depends 中互相引用。标记内可以使用 Markdown 与 LaTeX，不需要任何转义。`;
}

function tagDocs(phase) {
  return (PHASE_TAGS[phase] || []).map((t) => TAG_DOCS[t]).join('\n\n');
}

function renderClaim(session, L, c, level, activeIds) {
  const cur = current(c);
  const lab = (rid) => researcherLabel(session, rid);
  const head = `### ${c.id} · ${kindName(c.kind)} · 【${CLAIM_STATUS[c.status] || c.status}】${c.id === 'C0' ? '' : ` · ${lab(c.author)} 提出`}${cur.v > 1 ? ` · 第 ${cur.v} 版` : ''}`;
  const lines = [head];
  if (level === 'brief') {
    lines.push(truncate(cur.statement, 220));
    return lines.join('\n');
  }
  lines.push(`陈述：${level === 'full' ? cur.statement : truncate(cur.statement, 900)}`);
  if (c.relation && c.target) lines.push(`关系：${{ proves: '证明', refutes: '否定', supports: '支持', generalizes: '推广' }[c.relation] || c.relation} ${c.target}`);
  if (c.depends.length) lines.push(`依赖：${c.depends.join('、')}`);
  if (cur.proof) lines.push(`证明：${level === 'full' ? truncate(cur.proof, 5000) : truncate(cur.proof, 600)}`);
  if (cur.evidence) lines.push(`证据：${truncate(cur.evidence, level === 'full' ? 1200 : 300)}`);
  if (c.statusReason) lines.push(`状态依据：${c.statusReason}`);
  const objs = Object.values(L.objections).filter((o) => o.target === c.id);
  for (const o of objs) {
    const stale = o.targetVersion < cur.v ? `（针对第 ${o.targetVersion} 版）` : '';
    lines.push(`- ${o.id}［${lab(o.author)} · ${SEV_NAME[o.severity]} · ${OTYPE_NAME[o.type] || o.type} · ${OBJECTION_STATE[o.state] || o.state}］${stale} ${level === 'full' ? truncate(o.content, 1500) : truncate(o.content, 240)}`);
    if (o.counterexample && level === 'full') lines.push(`  反例：${truncate(o.counterexample, 800)}`);
    if (level === 'full') {
      for (const r of o.responses) lines.push(`  · 答辩（${lab(r.by)} · ${{ concede: '承认', rebut: '反驳', revise: '修订' }[r.action] || r.action}）：${truncate(r.content, 900)}`);
      for (const r of o.rulings) lines.push(`  · 裁定（${lab(r.by)}）：${r.ruling === 'upheld' ? '质疑成立' : '质疑驳回'}——${truncate(r.content, 400)}`);
    }
  }
  const verdicts = Object.values(L.verdicts).filter((v) => v.target === c.id && v.targetVersion === cur.v);
  if (verdicts.length) lines.push(`核验（当前版本）：${verdicts.map((v) => `${lab(v.by)}：${VERDICT_NAME[v.verdict]}`).join('；')}`);
  const k = consensusOf(L, c.id, activeIds);
  if (k.n) lines.push(`立场分布（仅反映意见，不代表真假）：同意 ${k.agree} · 反对 ${k.disagree} · 不确定 ${k.unsure}`);
  return lines.join('\n');
}

const STATUS_ORDER = { pending: 0, disputed: 1, conditional: 2, conjecture: 3, open: 4, proved: 5, refuted: 6, definition: 7, withdrawn: 8 };

/** Ledger digest within a character budget. Focus claims are rendered in full, the rest progressively shorter. */
export function ledgerDigest(session, { focus = [], budget = 30000 } = {}) {
  const L = session.ledger;
  const activeIds = new Set(session.team.filter((r) => r.active !== false).map((r) => r.id));
  const all = Object.values(L.claims);
  const focusSet = new Set(['C0', ...focus]);
  const ordered = [
    ...all.filter((c) => focusSet.has(c.id)),
    ...all.filter((c) => !focusSet.has(c.id)).sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.round - a.round),
  ];
  const parts = [];
  let used = 0;
  let omitted = 0;
  for (const c of ordered) {
    const inactive = c.withdrawn || c.status === 'refuted';
    let level = focusSet.has(c.id) ? 'full' : inactive ? 'brief' : 'medium';
    let text = renderClaim(session, L, c, level, activeIds);
    if (used + text.length > budget && level !== 'brief') {
      level = 'brief';
      text = renderClaim(session, L, c, level, activeIds);
    }
    if (used + text.length > budget && !focusSet.has(c.id)) { omitted++; continue; }
    parts.push(text);
    used += text.length + 2;
  }
  if (omitted) parts.push(`（另有 ${omitted} 条断言因篇幅省略）`);
  return parts.join('\n\n');
}

function evidenceDigest(session, max = 6) {
  const items = Object.values(session.ledger.evidence).slice(-max);
  if (!items.length) return '';
  return items.map((e) => `- ${e.id}（${researcherLabel(session, e.by)}${e.target ? ` · 关于 ${e.target}` : ''}）${e.purpose}\n  代码：${truncate(e.code.replace(/\s+/g, ' '), 300)}\n  ${e.ok ? `输出：${truncate(e.output, 500)}` : `错误：${truncate(e.error, 300)}`}`).join('\n');
}

function directivesText(session) {
  const ds = (session.directives || []).filter((d) => d.active);
  return ds.length ? ds.map((d) => `- ${d.text}`).join('\n') : '';
}

function ownHistory(session, rid, max = 2) {
  const mine = session.contributions.filter((c) => c.rid === rid && c.phase !== 'consult').slice(-max);
  return mine.map((c) => `【第 ${c.round} 轮 · ${PHASES[c.phase]?.name}】${truncate(proseOnly(c.text), 700)}`).join('\n');
}

function lastSynthesis(session) {
  const s = session.syntheses[session.syntheses.length - 1];
  if (!s) return '';
  const lines = [`（第 ${s.round} 轮，主持人 ${researcherLabel(session, s.by)}）`, truncate(s.summary, 1800)];
  if (s.focus?.length) lines.push(`下一步聚焦：${s.focus.map((f) => `${f.target}${f.reason ? `（${truncate(f.reason, 120)}）` : ''}`).join('；')}`);
  return lines.join('\n');
}

/** Human-readable instructions for a task produced by the scheduler. */
function taskText(session, r, task) {
  const L = session.ledger;
  const lab = (rid) => researcherLabel(session, rid);
  switch (task.type) {
    case 'independent':
      return `这是第一阶段：独立研究。此阶段你看不到其他研究员的工作，请完全独立地思考，不要猜测他人观点。
1. 澄清命题中的定义、隐含假设与可能的歧义；
2. 判断命题可能的真假方向，尝试给出严格证明，或构造并验算反例；
3. 把论证拆成可独立核验的断言（定理/引理/猜想/反例），每条都附证明或证据，并用 relation/target 标明它与 C0 的关系；
4. 证明不完整时，明确写出卡在哪一步——不要伪装成完整证明；
5. 给出你对 C0 的立场与置信度。`;
    case 'investigate': {
      const a = task.assignment || {};
      const verb = { prove: '为该断言构造完整严格的证明（或修补已发现的缺口）', refute: '寻找反例或致命漏洞；若找不到，说明为何反驳失败', verify: '复查该断言的全部论证', explore: '探索新的思路、等价形式与关键引理', compute: '设计计算实验（使用 compute 标记）获取证据或反例', generalize: '寻找推广、加强或与已知理论的联系' }[a.task] || '推进研究';
      return `这是专项攻关阶段。你的任务：${verb}${a.target ? `，目标 ${a.target}` : ''}。
${a.instructions ? `主持人/调度给你的具体指令：${a.instructions}\n` : ''}${task.redTeam ? '注意：该断言目前获得高度共识但尚未被证明。你被编入“红队”，请全力寻找它的反例或证明中的漏洞——共识越强，越需要最强的反驳检验。\n' : ''}提出的新断言、质疑都要使用标记协议；最后更新你对 C0 的立场。`;
    }
    case 'critique':
      return `这是交叉质询阶段。请审查账本中的断言，重点审查分配给你的目标：${task.targets.length ? task.targets.join('、') : '（未分配特定目标，自由审查）'}。
对每个目标：逐步检查证明，主动寻找反例、隐藏假设、量词或边界错误、循环论证、以偏概全。
- 发现问题：提出 objection，注明类型与严重程度（只有确定陈述为假时才用 counterexample）。
- 确认无误：用 stance 表态同意，并简述你检查了什么。
不要因为多数研究员同意就放弃质疑，也不要为了反对而反对。最后更新你对 C0 的立场。`;
    case 'rebuttal': {
      const list = task.objections.map((oid) => {
        const o = L.objections[oid];
        return `- ${oid} 针对 ${o.target}（${lab(o.author)} · ${SEV_NAME[o.severity]} · ${OTYPE_NAME[o.type]}）：${truncate(o.content, 1600)}${o.counterexample ? `\n  反例：${truncate(o.counterexample, 800)}` : ''}`;
      }).join('\n');
      return `这是答辩修正阶段。以下质疑针对你提出的断言：
${list}

请逐条用 response 标记回应：concede（质疑成立——若为成立的反例，断言即被推翻）、rebut（质疑不成立，必须给出具体论证）、revise（给出修订后的陈述与完整证明；修订后旧质疑视为已处理，但会接受新一轮审查）。
坦诚承认错误是学术美德；为错误辩护会被核验者识破。最后更新你对 C0 的立场。`;
    }
    case 'verify': {
      const cl = task.claims.length ? `需要你核验的断言：${task.claims.join('、')}。对每条给出 verdict。` : '';
      const ob = task.objections.length ? `需要你裁定的质疑：${task.objections.join('、')}。对每条给出 ruling。` : '';
      return `这是独立核验阶段。你被选为独立核验者（你不是这些断言或质疑的作者）。
${cl}
${ob}
核验要求：独立重做推导，逐行检查每一步是否严格成立、引用的定理条件是否满足；反例要亲自验算。不要依赖作者的自信或多数人的意见。
必要时使用 compute 标记做数值核验；数值证据可以否定断言（找到反例），但通常不能证明断言。`;
    }
    case 'synthesis':
      return `你是本次研究的主持人。现在是第 ${session.cursor.round} 轮的综合规划阶段（最多 ${session.settings.maxRounds} 轮）。
1. 用 summary 客观总结本轮进展：以账本中的状态为准（已证明 / 已证伪 / 待核验 / 争议中 / 猜想），不得以人数多寡判断真假；
2. 用 focus 指出下一轮最关键的 1–3 个断言或问题；
3. 用 assign 给研究员分配下一轮任务（researcher 填代号字母，例如 B）。可以为高共识但未证明的断言指派反驳者；
4. 用 decision 判断是否结束：只有当主命题已被证明或证伪且关键断言均已核验，或继续研究已不太可能取得进展时，才选择 conclude。`;
    case 'report':
      return `研究已结束。请以主持人身份撰写研究报告的「叙述」部分（Markdown，不要使用任何标记协议标签）：
1. 问题重述与背景；
2. 研究过程：团队采用了哪些思路、哪些路线失败了以及原因；
3. 主要发现：必须与账本状态严格一致——只有「已证明」的断言可称为定理或结论；「条件成立」须说明依赖；「猜想」必须明确标注为猜想；「已证伪」要写出反例；
4. 争议、局限与可信度评估（指出哪些结论仅有数值证据，哪些核验者较少）；
5. 未解决问题与后续研究方向。
系统会在你的叙述之外，另行根据账本生成「已证明 / 已证伪 / 猜想 / 未解决」等权威章节。`;
    case 'consult':
      return `首席研究员（人类）直接向你提问：
${task.question}

请认真回答。如果回答中包含新的断言、质疑或核验结论，请使用标记协议记录；否则用 Markdown 回答即可。`;
    default:
      return '请推进研究。';
  }
}

/** Full user message for one researcher call. */
export function buildUserMessage(session, r, task, { budget } = {}) {
  const sections = [];
  const C0 = session.ledger.claims.C0;
  sections.push(`# 研究命题（C0）\n${current(C0).statement}\n\n领域：${DOMAINS[session.domain] || session.domain} · 第 ${session.cursor.round} 轮 · 阶段：${PHASES[task.type]?.name || task.type}${session.background ? `\n\n背景说明：${session.background}` : ''}`);
  const d = directivesText(session);
  if (d) sections.push(`# 首席研究员指示（优先遵循）\n${d}`);
  if (task.type !== 'independent') {
    const focus = [...(task.targets || []), ...(task.claims || []), ...(task.objections || []).map((oid) => session.ledger.objections[oid]?.target).filter(Boolean), task.assignment?.target].filter(Boolean);
    sections.push(`# 断言账本\n状态说明：已证明 = 证明经足够数量的独立核验者确认且无未决质疑；待核验 = 有证明但核验不足；争议中 = 存在未决质疑；猜想 = 无有效证明；已证伪 = 反例或否定论证经核实成立。\n\n${ledgerDigest(session, { focus, budget: budget ?? session.settings.contextChars ?? 30000 })}`);
    const ev = evidenceDigest(session);
    if (ev) sections.push(`# 计算证据（沙箱运行记录）\n${ev}`);
    const syn = lastSynthesis(session);
    if (syn && task.type !== 'synthesis') sections.push(`# 上一轮综合（主持人）\n${syn}`);
    const qs = session.ledger.questions.slice(-6);
    if (qs.length) sections.push(`# 已记录的开放问题\n${qs.map((q) => `- ${q.id}：${truncate(q.text, 200)}`).join('\n')}`);
    const mine = ownHistory(session, r.id);
    if (mine) sections.push(`# 你此前的工作（摘要）\n${mine}`);
  }
  if (task.type === 'synthesis') {
    const team = session.team.filter((x) => x.active !== false).map((x) => `- ${x.label}：${ROLES[x.role]?.name || x.role}`).join('\n');
    sections.push(`# 研究团队（代号与角色）\n${team}`);
  }
  sections.push(`# 你的任务\n${taskText(session, r, task)}`);
  const docs = tagDocs(task.type);
  if (docs) sections.push(`# 可用标记\n${docs}`);
  return sections.join('\n\n');
}

export function computeFollowup(results) {
  const body = results.map((x, i) => `[计算 ${i + 1}] ${x.purpose || ''}\n${x.ok ? `输出：\n${truncate(x.output, 4000) || '（无输出）'}` : `运行错误：${truncate(x.error, 1000)}`}${x.truncated ? '\n（输出过长已截断）' : ''}`).join('\n\n');
  return `沙箱已执行你的代码，结果如下：\n\n${body}\n\n请根据这些结果给出你的最终结论，并按标记协议输出（verdict / ruling / claim / objection / stance 等）。注意：此轮不再执行新的 compute 代码；数值结果是证据而非证明。`;
}

export const FORMAT_REPAIR = `你上一条回答没有使用标记协议，因此无法记入断言账本。请不要重复长篇论述，只把你上一条回答中的结论按要求的标记重新输出（例如 claim / objection / response / verdict / ruling / stance）。`;
