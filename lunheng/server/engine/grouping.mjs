// Dynamic grouping: decides who does what in each phase. Reviewers and verifiers are never the
// author of what they review; the scheduler prefers reviewers from a different vendor, reviewers who
// disagree, and skeptical roles, balances load, and adds a red team when consensus outruns proof.
import { current, consensusOf } from './ledger.mjs';

const ACTIVE_STATUSES = new Set(['pending', 'disputed', 'conjecture', 'conditional', 'open']);

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const vendorOf = (session, rid) => session.team.find((r) => r.id === rid)?.vendor || '';

function activeTeam(session) {
  return session.team.filter((r) => r.active !== false);
}

/** Claims worth reviewing this round, most urgent first. */
export function reviewTargets(session) {
  const L = session.ledger;
  const order = { pending: 0, disputed: 1, conditional: 2, conjecture: 3, open: 4 };
  return Object.values(L.claims)
    .filter((c) => c.id !== 'C0' && !c.withdrawn && ACTIVE_STATUSES.has(c.status) && c.kind !== 'definition')
    .sort((a, b) => (order[a.status] - order[b.status]) || (b.round - a.round));
}

function pick(candidates, n, score) {
  return candidates.map((c) => ({ c, s: score(c) })).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.c);
}

export function planCritique(session) {
  const team = activeTeam(session);
  const L = session.ledger;
  const rand = rng(session.cursor.round * 97 + Object.keys(L.claims).length);
  const targets = reviewTargets(session).slice(0, Math.max(4, team.length * 2));
  const load = new Map(team.map((r) => [r.id, 0]));
  const tasks = Object.fromEntries(team.map((r) => [r.id, { type: 'critique', targets: [] }]));
  const perClaim = Math.min(session.settings.reviewersPerClaim ?? 2, Math.max(1, team.length - 1));
  for (const c of targets) {
    const candidates = team.filter((r) => r.id !== c.author);
    const chosen = pick(candidates, perClaim, (r) => {
      const stance = L.stances[c.id]?.[r.id]?.position;
      return (['skeptic', 'devil'].includes(r.role) ? 3 : 0)
        + (stance === 'disagree' ? 2 : stance === 'unsure' ? 1 : 0)
        + (r.vendor !== vendorOf(session, c.author) ? 1.5 : 0)
        - load.get(r.id) * 2.2
        + rand() * 0.6;
    });
    for (const r of chosen) { tasks[r.id].targets.push(c.id); load.set(r.id, load.get(r.id) + 1); }
  }
  // C0 is always reviewable; researchers without targets are asked to scrutinise the main line of argument.
  for (const r of team) if (!tasks[r.id].targets.length) tasks[r.id].targets.push('C0');
  const groups = targets.map((c) => ({
    name: `${c.id} 质询组`, kind: 'critique', target: c.id,
    members: team.filter((r) => tasks[r.id].targets.includes(c.id)).map((r) => r.id),
  })).filter((g) => g.members.length);
  return { tasks, groups };
}

export function planRebuttal(session) {
  const L = session.ledger;
  const tasks = {};
  for (const o of Object.values(L.objections)) {
    if (!['open', 'contested', 'upheld'].includes(o.state)) continue;
    const claim = L.claims[o.target];
    if (!claim || claim.withdrawn || claim.author === 'PI' || o.targetVersion !== current(claim).v) continue;
    const author = session.team.find((r) => r.id === claim.author && r.active !== false);
    if (!author) continue;
    if (o.responses.some((x) => x.by === author.id && x.round === session.cursor.round)) continue;
    tasks[author.id] ||= { type: 'rebuttal', objections: [] };
    tasks[author.id].objections.push(o.id);
  }
  const groups = Object.entries(tasks).map(([rid, t]) => ({ name: '答辩', kind: 'rebuttal', target: t.objections.join(','), members: [rid] }));
  return { tasks, groups };
}

export function planVerify(session) {
  const team = activeTeam(session);
  const L = session.ledger;
  const min = session.settings.minVerifiers ?? 2;
  const rand = rng(session.cursor.round * 131 + Object.keys(L.verdicts).length);
  const load = new Map(team.map((r) => [r.id, 0]));
  const tasks = {};
  const ensure = (rid) => (tasks[rid] ||= { type: 'verify', claims: [], objections: [] });
  const groups = [];

  // Claims with proofs that still lack independent verification of their current version.
  const claims = Object.values(L.claims).filter((c) => c.id !== 'C0' && !c.withdrawn && ['pending', 'disputed', 'conditional'].includes(c.status));
  for (const c of claims) {
    const cur = current(c);
    const hasProof = c.kind === 'counterexample' || c.kind === 'observation' || cur.proof.trim().length >= 12;
    if (!hasProof) continue;
    const done = new Set(Object.values(L.verdicts).filter((v) => v.target === c.id && v.targetVersion === cur.v).map((v) => v.by));
    const validCount = Object.values(L.verdicts).filter((v) => v.target === c.id && v.targetVersion === cur.v && v.verdict === 'valid' && v.by !== c.author).length;
    const need = Math.max(0, min - validCount) + (c.status === 'disputed' ? 1 : 0);
    if (!need) continue;
    const candidates = team.filter((r) => r.id !== c.author && !done.has(r.id));
    const chosen = [];
    for (let k = 0; k < Math.min(need + 1, 3, candidates.length); k++) {
      const next = pick(candidates.filter((r) => !chosen.includes(r)), 1, (r) =>
        (r.role === 'verifier' ? 3 : 0) + (r.role === 'experimentalist' ? 1 : 0)
        + (r.vendor !== vendorOf(session, c.author) ? 2 : 0)
        + (chosen.every((x) => x.vendor !== r.vendor) ? 1.5 : 0)
        - load.get(r.id) * 2 + rand() * 0.5)[0];
      if (next) chosen.push(next);
    }
    for (const r of chosen) { ensure(r.id).claims.push(c.id); load.set(r.id, load.get(r.id) + 1); }
    if (chosen.length) groups.push({ name: `${c.id} 核验组`, kind: 'verify', target: c.id, members: chosen.map((r) => r.id) });
  }

  // Objections that need an independent ruling.
  const objs = Object.values(L.objections).filter((o) => ['open', 'rebutted', 'contested'].includes(o.state) && o.severity !== 'minor');
  for (const o of objs) {
    const claim = L.claims[o.target];
    if (!claim || o.targetVersion !== current(claim).v) continue;
    const ruled = new Set(o.rulings.map((x) => x.by));
    const candidates = team.filter((r) => r.id !== o.author && r.id !== claim.author && !ruled.has(r.id));
    const n = o.state === 'contested' ? 2 : 1 + (o.type === 'counterexample' ? 1 : 0);
    const chosen = pick(candidates, n, (r) => (r.role === 'verifier' ? 3 : 0) + (r.vendor !== vendorOf(session, o.author) ? 1 : 0) - load.get(r.id) * 2 + rand() * 0.5);
    for (const r of chosen) { ensure(r.id).objections.push(o.id); load.set(r.id, load.get(r.id) + 1); }
    if (chosen.length) groups.push({ name: `${o.id} 裁定组`, kind: 'ruling', target: o.id, members: chosen.map((r) => r.id) });
  }
  return { tasks, groups };
}

/** Focused investigation: chair assignments first, then role/stance-driven defaults and a red team. */
export function planInvestigate(session) {
  const team = activeTeam(session);
  const L = session.ledger;
  const activeIds = new Set(team.map((r) => r.id));
  const syn = session.syntheses[session.syntheses.length - 1];
  const tasks = {};
  const byLabel = new Map(team.map((r) => [r.label.toUpperCase(), r]));
  const resolveRid = (s) => {
    const t = String(s).trim().toUpperCase().replace(/^研究员\s*/, '').replace(/^R(?=\d)/, '');
    return byLabel.get(t) || team.find((r) => r.id.toUpperCase() === String(s).trim().toUpperCase()) || null;
  };
  for (const a of syn?.assignments || []) {
    const r = resolveRid(a.researcher);
    if (!r || tasks[r.id]) continue;
    tasks[r.id] = { type: 'investigate', assignment: { task: a.task, target: a.target && L.claims[a.target] ? a.target : null, instructions: a.instructions, by: 'chair' } };
  }
  const focus = (syn?.focus || []).map((f) => f.target).filter((id) => L.claims[id]);
  const pool = focus.length ? focus : reviewTargets(session).slice(0, 3).map((c) => c.id);
  if (!pool.length) pool.push('C0');
  let i = 0;
  for (const r of team) {
    if (tasks[r.id]) continue;
    const target = pool[i++ % pool.length];
    const stance = L.stances[target]?.[r.id]?.position;
    const task = r.role === 'prover' ? 'prove'
      : r.role === 'skeptic' || r.role === 'devil' ? 'refute'
        : r.role === 'experimentalist' ? 'compute'
          : r.role === 'verifier' ? 'verify'
            : r.role === 'theorist' ? 'generalize'
              : stance === 'disagree' ? 'refute' : 'prove';
    tasks[r.id] = { type: 'investigate', assignment: { task, target, instructions: '', by: 'scheduler' } };
  }
  // Consensus alarm: strong agreement without proof triggers a red team.
  const alarms = [];
  for (const id of new Set([...pool, 'C0'])) {
    const c = L.claims[id];
    if (!c || ['proved', 'refuted'].includes(c.status)) continue;
    const k = consensusOf(L, id, activeIds);
    if (k.n >= 3 && k.agreeRatio >= 0.8) {
      const want = Math.max(1, Math.round(team.length / 4));
      const red = team
        .filter((r) => r.id !== c.author)
        .sort((a, b) => (['devil', 'skeptic'].includes(b.role) - ['devil', 'skeptic'].includes(a.role)) || ((L.stances[id]?.[a.id]?.confidence ?? 0.5) - (L.stances[id]?.[b.id]?.confidence ?? 0.5)))
        .slice(0, want);
      for (const r of red) tasks[r.id] = { type: 'investigate', redTeam: true, assignment: { task: 'refute', target: id, instructions: `该断言获得 ${Math.round(k.agreeRatio * 100)}% 同意但尚未被证明。`, by: 'consensus-alarm' } };
      alarms.push({ target: id, agreeRatio: k.agreeRatio, members: red.map((r) => r.id) });
    }
  }
  const NAMES = { prove: '证明组', refute: '反驳组', compute: '计算组', verify: '复核组', explore: '探索组', generalize: '理论组', review: '审查组' };
  const groupMap = new Map();
  for (const [rid, t] of Object.entries(tasks)) {
    const a = t.assignment;
    const key = `${a.task}|${a.target || ''}|${t.redTeam ? 'red' : ''}`;
    if (!groupMap.has(key)) groupMap.set(key, { name: `${t.redTeam ? '红队 · ' : ''}${NAMES[a.task] || a.task}${a.target ? ` → ${a.target}` : ''}`, kind: a.task, target: a.target, redTeam: !!t.redTeam, members: [] });
    groupMap.get(key).members.push(rid);
  }
  return { tasks, groups: [...groupMap.values()], alarms };
}

export function planIndependent(session) {
  const tasks = Object.fromEntries(activeTeam(session).map((r) => [r.id, { type: 'independent' }]));
  return { tasks, groups: [{ name: '全员独立研究（互不可见）', kind: 'independent', members: Object.keys(tasks) }] };
}

export function planSynthesis(session) {
  const chair = session.team.find((r) => r.id === session.chairId && r.active !== false) || activeTeam(session)[0];
  return chair ? { tasks: { [chair.id]: { type: 'synthesis' } }, groups: [{ name: '主持人综合', kind: 'synthesis', members: [chair.id] }] } : { tasks: {}, groups: [] };
}

export function planPhase(session, phase) {
  switch (phase) {
    case 'independent': return planIndependent(session);
    case 'investigate': return planInvestigate(session);
    case 'critique': return planCritique(session);
    case 'rebuttal': return planRebuttal(session);
    case 'verify': return planVerify(session);
    case 'synthesis': return planSynthesis(session);
    default: return { tasks: {}, groups: [] };
  }
}
