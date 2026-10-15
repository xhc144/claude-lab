import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, addClaim, addObjection, addResponse, addRuling, addVerdict, setStance, reviseClaim, recompute, consensusWarnings } from '../../server/engine/ledger.mjs';

const vendors = { R1: 'OpenAI', R2: 'Anthropic', R3: 'Google', R4: 'DeepSeek', R5: 'OpenAI' };
const ctx = (extra = {}) => ({ minVerifiers: 2, crossVendor: true, vendorOf: (r) => vendors[r] || '', ...extra });

function lemma(L, author = 'R1', proof = '由归纳法：基例成立；归纳步骤见下……') {
  return addClaim(L, { author, kind: 'lemma', statement: 'P(n) 对所有 n 成立', proof, relation: 'proves', target: 'C0' });
}

test('unanimous agreement never proves a claim', () => {
  const L = createLedger('命题');
  const id = lemma(L);
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5']) setStance(L, { by: r, target: id, position: 'agree', confidence: 1 });
  recompute(L, ctx());
  assert.equal(L.claims[id].status, 'pending');
  assert.equal(L.claims.C0.status, 'open');
  const w = consensusWarnings(L, new Set(Object.keys(vendors)));
  assert.ok(w.some((x) => x.id === id && x.type === 'unproven-consensus'));
});

test('proof needs enough independent verifiers; the author cannot verify their own claim', () => {
  const L = createLedger('命题');
  const id = lemma(L, 'R1');
  addVerdict(L, { target: id, by: 'R1', verdict: 'valid' });
  addVerdict(L, { target: id, by: 'R2', verdict: 'valid' });
  recompute(L, ctx());
  assert.equal(L.claims[id].status, 'pending');
  addVerdict(L, { target: id, by: 'R3', verdict: 'valid' });
  recompute(L, ctx());
  assert.equal(L.claims[id].status, 'proved');
  assert.equal(L.claims.C0.status, 'proved');
});

test('cross-vendor rule: same-vendor verifiers are not enough', () => {
  const L = createLedger('命题');
  const id = lemma(L, 'R1'); // OpenAI
  addVerdict(L, { target: id, by: 'R5', verdict: 'valid' }); // OpenAI
  recompute(L, ctx({ minVerifiers: 1 }));
  assert.equal(L.claims[id].status, 'pending');
  assert.match(L.claims[id].statusReason, /不同厂商/);
  recompute(L, ctx({ minVerifiers: 1, crossVendor: false }));
  assert.equal(L.claims[id].status, 'proved');
});

test('one upheld counterexample refutes a claim despite a supportive majority', () => {
  const L = createLedger('命题');
  const id = lemma(L, 'R1');
  for (const r of ['R2', 'R3', 'R4']) addVerdict(L, { target: id, by: r, verdict: 'valid' });
  for (const r of ['R1', 'R2', 'R3', 'R4']) setStance(L, { by: r, target: id, position: 'agree', confidence: 0.9 });
  const oid = addObjection(L, { target: id, author: 'R5', type: 'counterexample', content: 'n=40', counterexample: '41^2' });
  recompute(L, ctx());
  assert.equal(L.claims[id].status, 'disputed', 'an open fatal objection blocks the proof');
  addRuling(L, oid, { by: 'R1', ruling: 'upheld' }); // the author cannot rule
  recompute(L, ctx());
  assert.equal(L.objections[oid].state, 'open');
  addRuling(L, oid, { by: 'R3', ruling: 'upheld' });
  recompute(L, ctx());
  assert.equal(L.claims[id].status, 'refuted');
  // The proposition it was meant to prove is not proved.
  assert.notEqual(L.claims.C0.status, 'proved');
});

test('split rulings leave the objection contested and the claim disputed', () => {
  const L = createLedger('命题');
  const id = lemma(L, 'R1');
  const oid = addObjection(L, { target: id, author: 'R2', type: 'gap', severity: 'major', content: '第 3 步未证明' });
  addResponse(L, oid, { by: 'R1', action: 'rebut', content: '由引理 2' });
  recompute(L, ctx());
  assert.equal(L.objections[oid].state, 'rebutted');
  addRuling(L, oid, { by: 'R3', ruling: 'upheld' });
  addRuling(L, oid, { by: 'R4', ruling: 'dismissed' });
  recompute(L, ctx());
  assert.equal(L.objections[oid].state, 'contested');
  assert.equal(L.claims[id].status, 'disputed');
});

test('upheld gap demotes to conjecture; revision addresses objections and resets verification', () => {
  const L = createLedger('命题');
  const id = lemma(L, 'R1');
  addVerdict(L, { target: id, by: 'R2', verdict: 'valid' });
  const vid = addVerdict(L, { target: id, by: 'R3', verdict: 'gap', content: '归纳步骤缺失' });
  const oid = L.verdicts[vid].objection;
  assert.ok(oid, 'a gap verdict opens an objection');
  addRuling(L, oid, { by: 'R4', ruling: 'upheld' });
  recompute(L, ctx());
  assert.equal(L.claims[id].status, 'conjecture');
  reviseClaim(L, id, { proof: '补全的归纳步骤……（详细）', by: 'R1' });
  recompute(L, ctx());
  assert.equal(L.objections[oid].state, 'addressed');
  assert.equal(L.claims[id].status, 'pending', 'old verdicts do not carry over to the new version');
  addVerdict(L, { target: id, by: 'R3', verdict: 'valid' });
  addVerdict(L, { target: id, by: 'R4', verdict: 'valid' });
  recompute(L, ctx());
  assert.equal(L.claims[id].status, 'proved');
});

test('dependencies: proved claim depending on an unproved lemma is only conditional', () => {
  const L = createLedger('命题');
  const lem = addClaim(L, { author: 'R2', kind: 'conjecture', statement: '关键引理' });
  const thm = addClaim(L, { author: 'R1', kind: 'theorem', statement: '主定理', proof: '由关键引理与标准论证……', relation: 'proves', target: 'C0', depends: [lem] });
  addVerdict(L, { target: thm, by: 'R2', verdict: 'valid' });
  addVerdict(L, { target: thm, by: 'R3', verdict: 'valid' });
  recompute(L, ctx());
  assert.equal(L.claims[thm].status, 'conditional');
  assert.equal(L.claims.C0.status, 'conditional');
});

test('modus tollens and inconsistency detection', () => {
  const L = createLedger('命题');
  const bogus = lemma(L, 'R1');
  const ce = addClaim(L, { author: 'R2', kind: 'counterexample', statement: 'n=40 时不成立', proof: '直接计算' });
  addVerdict(L, { target: ce, by: 'R3', verdict: 'valid' });
  addVerdict(L, { target: ce, by: 'R4', verdict: 'valid' });
  recompute(L, ctx());
  assert.equal(L.claims.C0.status, 'refuted');
  assert.equal(L.claims[bogus].status, 'refuted', 'a claim implying a refuted proposition is refuted');
  // If the bogus proof had also been verified, the ledger must flag the contradiction instead of choosing.
  addVerdict(L, { target: bogus, by: 'R3', verdict: 'valid' });
  addVerdict(L, { target: bogus, by: 'R4', verdict: 'valid' });
  recompute(L, ctx());
  assert.equal(L.claims.C0.status, 'inconsistent');
});
