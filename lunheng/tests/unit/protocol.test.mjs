import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContribution, normRef, proseOnly } from '../../server/engine/protocol.mjs';

test('tags keep LaTeX backslashes intact (no JSON escaping hazards)', () => {
  const p = parseContribution(String.raw`分析……
<claim ref="n1" kind="lemma" relation="proves" target="C0" depends="C2, n2" confidence="80%">
<statement>对任意 $n\neq 0$，$\frac{1}{n}\binom{2n}{n}\in\mathbb{Q}$ 且 $\nabla f=0$。</statement>
<proof>由 \text{定义} 直接得到：\[ \rho = \tau \times \beta \]</proof>
</claim>`);
  assert.equal(p.claims.length, 1);
  const c = p.claims[0];
  assert.match(c.statement, /\\neq 0/);
  assert.match(c.statement, /\\frac\{1\}\{n\}\\binom/);
  assert.match(c.statement, /\\nabla/);
  assert.match(c.proof, /\\rho = \\tau \\times \\beta/);
  assert.equal(c.kind, 'lemma');
  assert.equal(c.relation, 'proves');
  assert.equal(c.target, 'C0');
  assert.deepEqual(c.depends, ['C2', 'n2']);
  assert.equal(c.confidence, 0.8);
});

test('synonyms, self-closing tags, fenced compute and malformed items', () => {
  const p = parseContribution(`
<stance target="c0" position="反对" confidence="0.9"/>
<stance target="C3" position="maybe"/>
<objection target="[C3]" type="反例" severity="minor">n=40 失败<counterexample>1681=41^2</counterexample></objection>
<objection target="C4">   </objection>
<verdict target="C3" result="invalid">第 2 步错误</verdict>
<ruling objection="O2" result="驳回">不影响结论</ruling>
<response objection="O1" action="修正">修订<revised_statement>新陈述</revised_statement></response>
<compute purpose="check">
\`\`\`js
console.log(1+1)
\`\`\`
</compute>
<assign researcher="B" task="refute" target="C3">找反例</assign>
<decision value="结束">已判定</decision>
<withdraw target="C5">错了</withdraw>`);
  assert.deepEqual(p.stances.map((s) => [s.target, s.position]), [['C0', 'disagree']]);
  assert.equal(p.objections.length, 1);
  assert.equal(p.objections[0].type, 'counterexample');
  assert.equal(p.objections[0].severity, 'fatal', 'counterexamples are always fatal');
  assert.equal(p.objections[0].counterexample, '1681=41^2');
  assert.equal(p.verdicts[0].verdict, 'flawed');
  assert.equal(p.rulings[0].ruling, 'dismissed');
  assert.equal(p.responses[0].action, 'revise');
  assert.equal(p.responses[0].revisedStatement, '新陈述');
  assert.equal(p.computes[0].code, 'console.log(1+1)');
  assert.equal(p.assignments[0].task, 'refute');
  assert.equal(p.decision.value, 'conclude');
  assert.equal(p.withdrawals[0].target, 'C5');
});

test('reference normalisation and prose extraction', () => {
  assert.equal(normRef('c12'), 'C12');
  assert.equal(normRef('【O3】'), 'O3');
  assert.equal(normRef('C3v2'), 'C3');
  assert.equal(normRef('new2'), 'n2');
  assert.equal(proseOnly('前文<stance target="C0" position="agree"/>后文'), '前文后文');
});
