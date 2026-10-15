import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDocument, validateDocument, summarizeDocument } from '../../src/core/doc.js';
import { applyOps } from '../../src/core/ops.js';
import { guideTarget, resolveAction, sayDuration } from '../../src/core/catalog/guide.js';

const lesson = () => ({
  title: 'L',
  scenes: [{
    blocks: [{ id: 'b_t', type: 'title', text: '勾股定理' }, { id: 'b_eq', type: 'equation', latex: 'a^2+b^2=c^2' }],
    guide: [
      { circle: 'b_eq', part: 'c^2', note: '斜边' },
      { action: 'Underline', target: 2, part: 'a^2', text: '先看 a 的平方' },
      { do: '高亮', part: '勾股', target: 'title' },
      '最后总结一下',
    ],
  }],
});

test('guide shorthand normalises: array form, action aliases, text→say, default target', () => {
  const { doc, warnings } = normalizeDocument(lesson());
  const g = doc.scenes[0].guide;
  assert.ok(Array.isArray(g.steps));
  assert.deepEqual(g.steps.map((s) => s.do), ['circle', 'underline', 'highlight', 'point']);
  assert.equal(g.steps[0].target, 'b_eq');
  assert.equal(g.steps[1].say, '先看 a 的平方');
  assert.equal(g.steps[3].say, '最后总结一下');
  assert.equal(warnings.filter((w) => w.level === 'error').length, 0);
  assert.deepEqual(validateDocument(doc).filter((i) => i.level === 'error'), []);
});

test('guide targets resolve by id, 1-based index, type, and default to the main visual', () => {
  const { doc } = normalizeDocument(lesson());
  const s = doc.scenes[0];
  assert.equal(guideTarget(s, 'b_eq').id, 'b_eq');
  assert.equal(guideTarget(s, 2).id, 'b_eq');
  assert.equal(guideTarget(s, 'title').id, 'b_t');
  assert.equal(guideTarget(s, null).id, 'b_eq');
  assert.equal(guideTarget(s, 'b_missing'), null);
});

test('validation reports a missing target and an unknown action with a hint', () => {
  const { doc, warnings } = normalizeDocument({ scenes: [{ blocks: [{ type: 'text', text: 'x' }], guide: { cursor: 'laserpointer', steps: [{ target: 'b_nope', do: 'circel' }] } }] });
  assert.ok(warnings.some((w) => /未知讲解动作/.test(w.message) && /circle/.test(w.hint)));
  assert.equal(doc.scenes[0].guide.cursor, 'arrow');
  const issues = validateDocument(doc);
  assert.ok(issues.some((i) => i.level === 'error' && /不在本场景/.test(i.message)));
});

test('guide is editable through ops and shows in the summary', () => {
  const { doc } = normalizeDocument(lesson());
  const r = applyOps(doc, [{ op: 'update_scene', scene: 1, set: { guide: { cursor: 'pen', steps: [{ target: 'b_eq', part: 'b^2', do: 'box' }] } } }]);
  assert.ok(r.ok, JSON.stringify(r.results));
  assert.equal(r.doc.scenes[0].guide.cursor, 'pen');
  assert.equal(r.doc.scenes[0].guide.steps.length, 1);
  assert.match(summarizeDocument(r.doc), /guide ×1: box\(b\^2\)/);
  const cleared = applyOps(r.doc, [{ op: 'update_scene', scene: 1, set: { guide: null } }]);
  assert.equal(cleared.doc.scenes[0].guide, undefined);
});

test('narration length sets how long a step lingers', () => {
  assert.equal(sayDuration(''), 0);
  const zh = sayDuration('等号右边是斜边 c 的平方'); // 10 CJK + 1 word
  assert.ok(zh > 2 && zh < 3.5, String(zh));
  assert.ok(sayDuration('Now look at the hypotenuse squared') > 2);
  assert.equal(resolveAction('Strike'), 'cross');
});
