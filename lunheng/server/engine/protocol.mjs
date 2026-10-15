// The Lunheng contribution protocol: researchers write free Markdown and record structured
// contributions with XML-like tags. Tags (not JSON) keep LaTeX intact: "\frac", "\neq", "\binom"
// would otherwise be mangled by JSON string escapes.

const TAGS = ['claim', 'objection', 'response', 'verdict', 'ruling', 'compute', 'question', 'withdraw', 'stance', 'summary', 'focus', 'assign', 'decision'];
const TAG_RE = new RegExp(`<(${TAGS.join('|')})\\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\\/>|>([\\s\\S]*?)<\\/\\1\\s*>)`, 'gi');
const ATTR_RE = /([a-zA-Z_][\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>/]+))/g;

export function parseAttrs(s) {
  const out = {};
  for (const m of String(s || '').matchAll(ATTR_RE)) out[m[1].toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? '').trim();
  return out;
}

function inner(body, tag) {
  const m = String(body || '').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  return m ? m[1].trim() : '';
}

function stripInner(body, tags) {
  let s = String(body || '');
  for (const t of tags) s = s.replace(new RegExp(`<${t}\\b[^>]*>[\\s\\S]*?<\\/${t}\\s*>`, 'gi'), '');
  return s.trim();
}

const SYN = {
  kind: {
    theorem: 'theorem', 定理: 'theorem', proposition: 'theorem', 命题: 'theorem', result: 'theorem',
    lemma: 'lemma', 引理: 'lemma', corollary: 'lemma', 推论: 'lemma',
    conjecture: 'conjecture', 猜想: 'conjecture', hypothesis: 'conjecture', 假设: 'conjecture',
    counterexample: 'counterexample', 反例: 'counterexample',
    observation: 'observation', 观察: 'observation', fact: 'observation', 事实: 'observation', computation: 'observation', 数值: 'observation',
    definition: 'definition', 定义: 'definition',
  },
  position: {
    agree: 'agree', support: 'agree', true: 'agree', yes: 'agree', 同意: 'agree', 支持: 'agree', 成立: 'agree', 真: 'agree',
    disagree: 'disagree', oppose: 'disagree', false: 'disagree', no: 'disagree', 反对: 'disagree', 不成立: 'disagree', 假: 'disagree',
    unsure: 'unsure', undecided: 'unsure', neutral: 'unsure', unknown: 'unsure', 不确定: 'unsure', 存疑: 'unsure',
  },
  otype: {
    counterexample: 'counterexample', 反例: 'counterexample',
    gap: 'gap', 漏洞: 'gap', 缺口: 'gap', incomplete: 'gap',
    error: 'error', 错误: 'error', flaw: 'error', mistake: 'error',
    ambiguity: 'ambiguity', 歧义: 'ambiguity', unclear: 'ambiguity', definition: 'ambiguity',
    scope: 'scope', 范围: 'scope', overgeneralization: 'scope', assumption: 'scope', 假设: 'scope',
  },
  severity: { fatal: 'fatal', 致命: 'fatal', critical: 'fatal', major: 'major', 严重: 'major', 重要: 'major', minor: 'minor', 次要: 'minor', 轻微: 'minor' },
  action: { concede: 'concede', 承认: 'concede', accept: 'concede', rebut: 'rebut', 反驳: 'rebut', reject: 'rebut', revise: 'revise', 修正: 'revise', 修订: 'revise', amend: 'revise' },
  verdict: {
    valid: 'valid', correct: 'valid', 有效: 'valid', 成立: 'valid', sound: 'valid',
    gap: 'gap', 漏洞: 'gap', incomplete: 'gap', 不完整: 'gap',
    flawed: 'flawed', invalid: 'flawed', error: 'flawed', 错误: 'flawed', wrong: 'flawed',
    false: 'false', 假: 'false', 不成立: 'false', refuted: 'false',
    unverifiable: 'unverifiable', unknown: 'unverifiable', 无法核验: 'unverifiable',
  },
  ruling: { upheld: 'upheld', uphold: 'upheld', valid: 'upheld', 成立: 'upheld', 维持: 'upheld', dismissed: 'dismissed', dismiss: 'dismissed', invalid: 'dismissed', 驳回: 'dismissed', 不成立: 'dismissed' },
  relation: { proves: 'proves', prove: 'proves', 证明: 'proves', refutes: 'refutes', refute: 'refutes', 否定: 'refutes', 反驳: 'refutes', supports: 'supports', support: 'supports', 支持: 'supports', generalizes: 'generalizes', 推广: 'generalizes' },
  task: { prove: 'prove', refute: 'refute', verify: 'verify', explore: 'explore', compute: 'compute', review: 'review', generalize: 'generalize' },
  decision: { continue: 'continue', 继续: 'continue', conclude: 'conclude', stop: 'conclude', 结束: 'conclude', finish: 'conclude' },
};

const norm = (table, v, fallback) => SYN[table][String(v || '').trim().toLowerCase()] ?? SYN[table][String(v || '').trim()] ?? fallback;

/** "C3", "c3", "[C3]", "C3v2", "C 3" → "C3". Also O#/E#. Local refs (n1, new1) are returned as-is in lowercase. */
export function normRef(v) {
  const s = String(v || '').trim().replace(/^[[(（【]|[\])）】]$/g, '');
  const m = s.match(/^([COEVcoev])\s*-?\s*(\d+)/);
  if (m) return `${m[1].toUpperCase()}${m[2]}`;
  const local = s.match(/^(n|new|ref)?\s*-?\s*(\d+)$/i);
  if (local && local[1]) return `n${local[2]}`;
  return s.toLowerCase();
}

export function parseRefList(v) {
  return String(v || '').split(/[,，;；\s]+/).map(normRef).filter(Boolean);
}

function conf(v) {
  if (v == null || v === '') return null;
  let n = parseFloat(String(v).replace('%', ''));
  if (!Number.isFinite(n)) return null;
  if (n > 1) n /= 100;
  return Math.max(0, Math.min(1, n));
}

export function stripFences(code) {
  const s = String(code || '').trim();
  const m = s.match(/^```[\w-]*\s*\n?([\s\S]*?)\n?```$/);
  return (m ? m[1] : s).trim();
}

/** Parse every protocol tag in a model's answer. Unknown or malformed items are dropped, never guessed. */
export function parseContribution(text) {
  const out = { claims: [], objections: [], responses: [], verdicts: [], rulings: [], computes: [], questions: [], withdrawals: [], stances: [], summary: '', focus: [], assignments: [], decision: null };
  for (const m of String(text || '').matchAll(TAG_RE)) {
    const tag = m[1].toLowerCase();
    const a = parseAttrs(m[2]);
    const body = (m[4] ?? '').trim();
    switch (tag) {
      case 'claim': {
        const statement = inner(body, 'statement') || stripInner(body, ['proof', 'evidence']);
        if (!statement) break;
        out.claims.push({
          ref: normRef(a.ref || a.id || `n${out.claims.length + 1}`),
          kind: norm('kind', a.kind || a.type, 'lemma'),
          statement,
          proof: inner(body, 'proof'),
          evidence: inner(body, 'evidence'),
          relation: a.relation ? norm('relation', a.relation, null) : null,
          target: a.target ? normRef(a.target) : null,
          depends: parseRefList(a.depends || a.uses || ''),
          confidence: conf(a.confidence),
        });
        break;
      }
      case 'objection': {
        const target = normRef(a.target);
        const content = stripInner(body, ['counterexample']) || inner(body, 'counterexample');
        if (!target || !content) break;
        const type = norm('otype', a.type, 'gap');
        out.objections.push({
          target,
          type,
          severity: type === 'counterexample' ? 'fatal' : norm('severity', a.severity, 'major'),
          content,
          counterexample: inner(body, 'counterexample'),
        });
        break;
      }
      case 'response': {
        const objection = normRef(a.objection || a.target);
        if (!objection) break;
        out.responses.push({
          objection,
          action: norm('action', a.action, 'rebut'),
          content: stripInner(body, ['revised_statement', 'revised_proof']),
          revisedStatement: inner(body, 'revised_statement'),
          revisedProof: inner(body, 'revised_proof'),
        });
        break;
      }
      case 'verdict': {
        const target = normRef(a.target);
        const verdict = norm('verdict', a.result || a.verdict || a.value, null);
        if (!target || !verdict) break;
        out.verdicts.push({ target, verdict, content: body, step: a.step || '' });
        break;
      }
      case 'ruling': {
        const objection = normRef(a.objection || a.target);
        const ruling = norm('ruling', a.result || a.ruling || a.value, null);
        if (!objection || !ruling) break;
        out.rulings.push({ objection, ruling, content: body });
        break;
      }
      case 'compute': {
        const code = stripFences(body);
        if (code) out.computes.push({ purpose: a.purpose || '', target: a.target ? normRef(a.target) : null, code });
        break;
      }
      case 'question': if (body) out.questions.push(body); break;
      case 'withdraw': {
        const target = normRef(a.target);
        if (target) out.withdrawals.push({ target, reason: body });
        break;
      }
      case 'stance': {
        const target = normRef(a.target || 'C0');
        const position = norm('position', a.position || a.value, null);
        if (!position) break;
        out.stances.push({ target, position, confidence: conf(a.confidence) ?? 0.5, reason: body });
        break;
      }
      case 'summary': if (body) out.summary = body; break;
      case 'focus': {
        const target = normRef(a.target);
        if (target) out.focus.push({ target, priority: a.priority || 'normal', reason: body });
        break;
      }
      case 'assign': {
        const researcher = String(a.researcher || a.to || '').trim();
        if (!researcher) break;
        out.assignments.push({ researcher, task: norm('task', a.task, 'explore'), target: a.target ? normRef(a.target) : null, instructions: body });
        break;
      }
      case 'decision': {
        const value = norm('decision', a.value || a.result, null);
        if (value) out.decision = { value, reason: body };
        break;
      }
      default: break;
    }
  }
  return out;
}

export function countItems(p) {
  return p.claims.length + p.objections.length + p.responses.length + p.verdicts.length + p.rulings.length + p.stances.length + p.withdrawals.length + p.questions.length;
}

/** Text with protocol tags removed (for compact digests and previews). */
export function proseOnly(text) {
  return String(text || '').replace(TAG_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}
