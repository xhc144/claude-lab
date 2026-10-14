// The claim ledger and its epistemic rules.
//
// Status is a deterministic function of proofs, objections, rulings and independent verdicts.
// Stances (agree / disagree) are recorded and charted as "consensus", but they never enter the
// status computation: no number of votes can prove a claim, and a single upheld counterexample
// refutes it regardless of how many researchers agree with it.

export const CLAIM_STATUS = {
  proved: '已证明',
  conditional: '条件成立',
  refuted: '已证伪',
  disputed: '争议中',
  pending: '待核验',
  conjecture: '猜想',
  definition: '定义',
  withdrawn: '已撤回',
  open: '未决',
  inconsistent: '矛盾',
};

export const OBJECTION_STATE = {
  open: '未回应', rebutted: '已反驳待裁定', conceded: '作者承认', addressed: '已修订', upheld: '质疑成立',
  dismissed: '质疑驳回', contested: '裁定分歧', withdrawn: '已撤回',
};

// Objections whose outcome is still undecided block a proof.
const BLOCKING_STATES = new Set(['open', 'rebutted', 'contested']);
const SETTLED_AGAINST = new Set(['upheld', 'conceded']);

export function createLedger(question, at = new Date().toISOString()) {
  return {
    seq: { C: 0, O: 0, V: 0, E: 0, Q: 0 },
    claims: {
      C0: {
        id: 'C0', kind: 'proposition', author: 'PI', round: 0, phase: 'setup', createdAt: at,
        versions: [{ v: 1, statement: question, proof: '', evidence: '', at, round: 0, phase: 'setup', by: 'PI', reason: '研究命题' }],
        relation: null, target: null, depends: [], confidence: null, withdrawn: false,
        status: 'open', statusReason: '尚无已核验的证明或反例', statusHistory: [{ at, round: 0, phase: 'setup', status: 'open' }],
      },
    },
    objections: {},
    verdicts: {},
    evidence: {},
    stances: {},
    stanceLog: [],
    questions: [],
  };
}

const nextId = (L, k) => `${k}${++L.seq[k]}`;
export const current = (claim) => claim.versions[claim.versions.length - 1];

function stamp(ctx) {
  return { round: ctx.round ?? 0, phase: ctx.phase ?? '', at: ctx.at ?? new Date().toISOString() };
}

export function addClaim(L, c) {
  if (!c.statement || !String(c.statement).trim()) return null;
  const id = nextId(L, 'C');
  const s = stamp(c);
  const target = c.target && L.claims[c.target] ? c.target : c.relation ? 'C0' : null;
  L.claims[id] = {
    id, kind: c.kind || 'lemma', author: c.author, ...s, createdAt: s.at,
    versions: [{ v: 1, statement: String(c.statement).trim(), proof: String(c.proof || '').trim(), evidence: String(c.evidence || '').trim(), ...s, by: c.author, reason: '' }],
    relation: c.relation || (c.kind === 'counterexample' ? 'refutes' : null),
    target: c.relation || c.kind === 'counterexample' ? target || 'C0' : target,
    depends: (c.depends || []).filter((d) => L.claims[d] && d !== id),
    confidence: c.confidence ?? null,
    withdrawn: false,
    status: 'open', statusReason: '', statusHistory: [],
  };
  return id;
}

export function reviseClaim(L, id, r) {
  const claim = L.claims[id];
  if (!claim || claim.id === 'C0') return null;
  const cur = current(claim);
  const statement = String(r.statement || '').trim() || cur.statement;
  const proof = String(r.proof || '').trim() || (r.statement ? '' : cur.proof);
  if (statement === cur.statement && proof === cur.proof) return null;
  claim.versions.push({ v: cur.v + 1, statement, proof, evidence: cur.evidence, ...stamp(r), by: r.by, reason: String(r.reason || '').trim() });
  return cur.v + 1;
}

export function addObjection(L, o) {
  const claim = L.claims[o.target];
  if (!claim || !o.content) return null;
  const id = nextId(L, 'O');
  L.objections[id] = {
    id, target: o.target, targetVersion: current(claim).v, author: o.author,
    type: o.type || 'gap', severity: o.type === 'counterexample' ? 'fatal' : o.severity || 'major',
    content: String(o.content).trim(), counterexample: String(o.counterexample || '').trim(),
    ...stamp(o), responses: [], rulings: [], fromVerdict: o.fromVerdict || null, state: 'open',
  };
  return id;
}

export function addResponse(L, oid, r) {
  const o = L.objections[oid];
  if (!o) return false;
  o.responses.push({ by: r.by, action: r.action, content: String(r.content || '').trim(), ...stamp(r) });
  return true;
}

export function addRuling(L, oid, r) {
  const o = L.objections[oid];
  if (!o) return false;
  o.rulings.push({ by: r.by, ruling: r.ruling, content: String(r.content || '').trim(), ...stamp(r) });
  return true;
}

/** A claim verdict. Negative verdicts open an objection so the author can answer and others can rule on it. */
export function addVerdict(L, v) {
  const claim = L.claims[v.target];
  if (!claim) return null;
  const id = nextId(L, 'V');
  L.verdicts[id] = {
    id, target: v.target, targetVersion: current(claim).v, by: v.by, verdict: v.verdict,
    content: String(v.content || '').trim(), evidence: v.evidence || [], ...stamp(v), objection: null,
  };
  if (['gap', 'flawed', 'false'].includes(v.verdict)) {
    const type = v.verdict === 'false' ? 'counterexample' : v.verdict === 'gap' ? 'gap' : 'error';
    L.verdicts[id].objection = addObjection(L, {
      target: v.target, author: v.by, type, severity: v.verdict === 'false' ? 'fatal' : 'major',
      content: v.content || `核验结论：${v.verdict}`, fromVerdict: id, ...stamp(v),
    });
  }
  return id;
}

export function addEvidence(L, e) {
  const id = nextId(L, 'E');
  L.evidence[id] = { id, by: e.by, purpose: e.purpose || '', target: e.target || null, code: e.code, ok: !!e.ok, output: e.output || '', error: e.error || '', durationMs: e.durationMs || 0, ...stamp(e) };
  return id;
}

export function addQuestion(L, q) {
  const text = String(q.text || '').trim();
  if (!text) return null;
  const id = nextId(L, 'Q');
  L.questions.push({ id, by: q.by, text, ...stamp(q) });
  return id;
}

export function setStance(L, s) {
  if (!L.claims[s.target]) return false;
  L.stances[s.target] ||= {};
  const rec = { position: s.position, confidence: s.confidence ?? 0.5, reason: String(s.reason || '').trim().slice(0, 600), ...stamp(s) };
  L.stances[s.target][s.by] = rec;
  L.stanceLog.push({ target: s.target, by: s.by, position: rec.position, confidence: rec.confidence, round: rec.round, phase: rec.phase, at: rec.at });
  return true;
}

export function withdrawClaim(L, id, by, reason, ctx = {}) {
  const c = L.claims[id];
  if (!c || c.author !== by || id === 'C0') return false;
  c.withdrawn = true;
  c.withdrawReason = String(reason || '').trim();
  c.withdrawnAt = stamp(ctx);
  return true;
}

/** Latest entry per author. */
function latestBy(list, key = 'by') {
  const map = new Map();
  for (const x of list) map.set(x[key], x);
  return [...map.values()];
}

/** Recompute every objection's state for the given ledger. */
export function objectionState(L, o) {
  const claim = L.claims[o.target];
  if (!claim) return 'withdrawn';
  if (o.targetVersion < current(claim).v) return 'addressed';
  const rulings = latestBy(o.rulings);
  if (rulings.some((r) => r.by === o.author && r.ruling === 'dismissed')) return 'withdrawn';
  const responses = o.responses.filter((r) => r.by === claim.author || claim.author === 'PI');
  const last = responses[responses.length - 1];
  if (last?.action === 'concede') return 'conceded';
  const independent = rulings.filter((r) => r.by !== o.author && r.by !== claim.author);
  const up = independent.filter((r) => r.ruling === 'upheld').length;
  const down = independent.filter((r) => r.ruling === 'dismissed').length;
  if (up && down) return 'contested';
  if (up) return 'upheld';
  if (down) return 'dismissed';
  if (last?.action === 'rebut') return 'rebutted';
  return 'open';
}

/**
 * Recompute statuses. ctx = { minVerifiers, crossVendor, vendorOf(rid), round, phase, at }.
 * Returns status transitions [{id, from, to, reason}].
 */
export function recompute(L, ctx = {}) {
  const minVerifiers = Math.max(1, ctx.minVerifiers ?? 2);
  const vendorOf = ctx.vendorOf || (() => '');
  for (const o of Object.values(L.objections)) o.state = objectionState(L, o);

  const before = Object.fromEntries(Object.entries(L.claims).map(([id, c]) => [id, c.status]));
  const info = {};

  // Local evaluation (does not depend on other claims' statuses).
  for (const c of Object.values(L.claims)) {
    if (c.id === 'C0') continue;
    const cur = current(c);
    const objs = Object.values(L.objections).filter((o) => o.target === c.id && o.targetVersion === cur.v);
    const live = objs.filter((o) => o.severity !== 'minor');
    const refutingObj = live.find((o) => o.type === 'counterexample' && SETTLED_AGAINST.has(o.state));
    const brokenObj = live.find((o) => ['gap', 'error'].includes(o.type) && SETTLED_AGAINST.has(o.state));
    const statementObj = live.find((o) => ['ambiguity', 'scope'].includes(o.type) && SETTLED_AGAINST.has(o.state));
    const blocking = live.filter((o) => BLOCKING_STATES.has(o.state));
    const verdicts = latestBy(Object.values(L.verdicts).filter((v) => v.target === c.id && v.targetVersion === cur.v && v.by !== c.author));
    const valid = verdicts.filter((v) => v.verdict === 'valid');
    const crossOk = !ctx.crossVendor || valid.some((v) => vendorOf(v.by) && vendorOf(v.by) !== vendorOf(c.author));
    const hasProof = c.kind === 'counterexample' || c.kind === 'observation' ? true : cur.proof.trim().length >= 12;
    info[c.id] = { refutingObj, brokenObj, statementObj, blocking, valid, crossOk, hasProof };
  }

  const set = (c, status, reason) => { c.status = status; c.statusReason = reason; };
  const label = (rid) => (ctx.labelOf ? ctx.labelOf(rid) : rid);

  const C0 = L.claims.C0;
  const evalC0 = () => {
    const linked = Object.values(L.claims).filter((x) => x.id !== 'C0' && x.target === 'C0' && !x.withdrawn);
    const provers = linked.filter((x) => x.relation === 'proves');
    const refuters = linked.filter((x) => x.relation === 'refutes');
    const p = provers.find((x) => x.status === 'proved');
    const r = refuters.find((x) => x.status === 'proved');
    const c0objs = Object.values(L.objections).filter((o) => o.target === 'C0' && o.targetVersion === current(C0).v && o.severity !== 'minor');
    const c0refuting = c0objs.find((o) => o.type === 'counterexample' && SETTLED_AGAINST.has(o.state));
    const c0blocking = c0objs.filter((o) => o.type !== 'counterexample' && (BLOCKING_STATES.has(o.state) || (['ambiguity', 'scope'].includes(o.type) && SETTLED_AGAINST.has(o.state))));
    if (p && (r || c0refuting)) set(C0, 'inconsistent', `矛盾：${p.id} 证明命题，而 ${(r || c0refuting).id} 否定命题——需要人工审查`);
    else if (r) set(C0, 'refuted', `由已核验的 ${r.id} 否定`);
    else if (c0refuting) set(C0, 'refuted', `反例质疑 ${c0refuting.id} 经独立裁定成立`);
    else if (p) set(C0, 'proved', `由已核验的 ${p.id} 证明`);
    else if (provers.find((x) => x.status === 'conditional')) {
      const q = provers.find((x) => x.status === 'conditional');
      set(C0, 'conditional', `${q.id} 给出证明，但依赖尚未证明的引理`);
    } else if (c0blocking.length) set(C0, 'disputed', `命题表述受到质疑：${c0blocking.map((o) => o.id).join('、')}`);
    else {
      const inProgress = linked.filter((x) => ['pending', 'disputed'].includes(x.status)).map((x) => x.id);
      set(C0, 'open', inProgress.length ? `待核验/争议中的相关论证：${inProgress.join('、')}` : '尚无已核验的证明或反例');
    }
  };

  // Fixpoint over cross-claim relations (dependencies, refutations, modus tollens).
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const c of Object.values(L.claims)) {
      if (c.id === 'C0') continue;
      const prev = `${c.status}|${c.statusReason}`;
      const i = info[c.id];
      const refuter = Object.values(L.claims).find((x) => x.id !== c.id && x.relation === 'refutes' && x.target === c.id && x.status === 'proved' && !x.withdrawn);
      // If c claims to establish a target that has been refuted, c itself cannot be true (modus tollens).
      const deadTarget = c.relation === 'proves' && c.target && L.claims[c.target]?.status === 'refuted' ? L.claims[c.target] : null;
      if (c.withdrawn) set(c, 'withdrawn', c.withdrawReason ? `作者撤回：${c.withdrawReason}` : '作者撤回');
      else if (c.kind === 'definition') set(c, i.blocking.length ? 'disputed' : 'definition', i.blocking.length ? `存在未决质疑 ${i.blocking.map((o) => o.id).join('、')}` : '定义（不具真值）');
      else if (i.refutingObj) set(c, 'refuted', `反例质疑 ${i.refutingObj.id} ${i.refutingObj.state === 'conceded' ? '已被作者承认' : '经独立裁定成立'}`);
      else if (refuter) set(c, 'refuted', `被已证明的断言 ${refuter.id} 否定`);
      else if (deadTarget && !(i.hasProof && !i.brokenObj && !i.blocking.length && i.valid.length >= minVerifiers && i.crossOk)) {
        set(c, 'refuted', `它蕴含的 ${deadTarget.id} 已被证伪，故该断言不成立`);
      }
      else if (i.blocking.length) set(c, 'disputed', `未决质疑：${i.blocking.map((o) => `${o.id}（${OBJECTION_STATE[o.state]}）`).join('、')}`);
      else if (i.statementObj) set(c, 'disputed', `陈述存在已确认的${i.statementObj.type === 'scope' ? '适用范围' : '歧义'}问题（${i.statementObj.id}），需修订`);
      else if (i.brokenObj) set(c, 'conjecture', `证明存在已确认的漏洞（${i.brokenObj.id}），需修订`);
      else if (!i.hasProof) set(c, 'conjecture', '尚无证明');
      else if (i.valid.length < minVerifiers) set(c, 'pending', `独立核验 ${i.valid.length}/${minVerifiers}`);
      else if (!i.crossOk) set(c, 'pending', '需要至少一位来自不同厂商的核验者确认');
      else {
        const deps = c.depends.map((d) => L.claims[d]).filter(Boolean);
        const weak = deps.filter((d) => d.status !== 'proved' && d.status !== 'definition');
        const bad = weak.filter((d) => ['refuted', 'withdrawn'].includes(d.status));
        const who = i.valid.map((v) => label(v.by)).join('、');
        if (bad.length) set(c, 'disputed', `所依赖的 ${bad.map((d) => d.id).join('、')} 已被否定或撤回`);
        else if (weak.length) set(c, 'conditional', `证明经 ${who} 核验，但依赖未证明的 ${weak.map((d) => d.id).join('、')}`);
        else set(c, 'proved', `证明经 ${who} 独立核验有效，无未决质疑`);
      }
      if (`${c.status}|${c.statusReason}` !== prev) changed = true;
    }
    const prevC0 = `${C0.status}|${C0.statusReason}`;
    evalC0();
    if (`${C0.status}|${C0.statusReason}` !== prevC0) changed = true;
    if (!changed && pass > 0) break;
  }

  const changes = [];
  const s = stamp(ctx);
  for (const c of Object.values(L.claims)) {
    if (before[c.id] !== c.status) {
      changes.push({ id: c.id, from: before[c.id], to: c.status, reason: c.statusReason });
      c.statusHistory.push({ ...s, status: c.status });
    }
  }
  return changes;
}

/** Stance distribution for a claim. Reported as consensus; never used to set status. */
export function consensusOf(L, id, activeIds = null) {
  const map = L.stances[id] || {};
  const out = { agree: 0, disagree: 0, unsure: 0, n: 0, weighted: 0 };
  let wsum = 0;
  for (const [rid, s] of Object.entries(map)) {
    if (activeIds && !activeIds.has(rid)) continue;
    out[s.position]++;
    out.n++;
    const w = s.confidence ?? 0.5;
    wsum += w;
    out.weighted += s.position === 'agree' ? w : s.position === 'disagree' ? -w : 0;
  }
  out.weighted = wsum ? out.weighted / wsum : 0;
  out.agreeRatio = out.n ? out.agree / out.n : 0;
  return out;
}

/** Claims where consensus and the evidence-based status diverge. */
export function consensusWarnings(L, activeIds) {
  const warnings = [];
  for (const c of Object.values(L.claims)) {
    if (c.withdrawn || c.kind === 'definition') continue;
    const k = consensusOf(L, c.id, activeIds);
    if (k.n < 2) continue;
    if (k.agreeRatio >= 0.75 && !['proved', 'refuted'].includes(c.status)) {
      warnings.push({ id: c.id, type: 'unproven-consensus', text: `${c.id}：${Math.round(k.agreeRatio * 100)}% 研究员同意，但状态为「${CLAIM_STATUS[c.status]}」——高共识不等于已证明` });
    }
    if (c.status === 'refuted' && k.agree > k.disagree) {
      warnings.push({ id: c.id, type: 'refuted-majority', text: `${c.id}：多数研究员仍表示同意，但它已被核验的反例/论证否定` });
    }
    if (c.status === 'proved' && k.disagree > k.agree) {
      warnings.push({ id: c.id, type: 'proved-minority', text: `${c.id}：证明已通过独立核验，尽管多数研究员表示怀疑` });
    }
  }
  return warnings;
}
