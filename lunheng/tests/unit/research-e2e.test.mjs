import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, startMock, setupLab, eulerTeam, waitFor } from './helpers.mjs';

test('full research run across four protocols refutes Euler\'s polynomial claim', async () => {
  const mock = await startMock();
  const lab = await startApp();
  try {
    const { c, providers } = await setupLab(lab.url, mock.url);
    const created = await c.post('/api/sessions', {
      question: '对所有非负整数 $n$，$n^2+n+41$ 都是素数。', domain: 'math', team: eulerTeam(providers),
      settings: { maxRounds: 3, minVerifiers: 2, budgetUsd: 5 },
    });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const id = created.data.id;
    const started = await c.post(`/api/sessions/${id}/start`);
    assert.equal(started.status, 200, JSON.stringify(started.data));
    const s = await waitFor(async () => {
      const r = await c.get(`/api/sessions/${id}`);
      return ['completed', 'paused', 'failed'].includes(r.data.session.status) && !r.data.running ? r.data.session : null;
    }, { timeout: 30000 });
    if (s.status !== 'completed') console.log(s.pauseReason, s.feed.slice(-15).map((f) => f.text));
    assert.equal(s.status, 'completed', s.pauseReason);
    const L = s.ledger;
    assert.equal(L.claims.C0.status, 'refuted', L.claims.C0.statusReason);
    const bogus = Object.values(L.claims).find((x) => x.kind === 'theorem');
    assert.equal(bogus.status, 'refuted');
    const counter = Object.values(L.claims).find((x) => x.kind === 'counterexample');
    assert.equal(counter.status, 'proved', counter.statusReason);
    // Consensus at the end of round 1 independent phase favoured the (false) proposition.
    const first = s.consensus[0].claims.C0;
    assert.ok(first.a > first.d, `initial majority agreed: ${JSON.stringify(first)}`);
    assert.ok(Object.keys(L.evidence).length >= 1, 'compute sandbox evidence recorded');
    assert.match(Object.values(L.evidence)[0].output, /n=40 1681/);
    assert.ok(s.report.markdown.includes('主命题已被证伪'));
    assert.ok(s.usage.calls > 10);
    assert.ok(s.usage.costUsd > 0);
    for (const r of s.team) assert.ok(r.stats.calls > 0, `researcher ${r.label} participated`);
    // Every protocol was exercised.
    const protos = new Set(mock.stats.requests.map((x) => x.protocol));
    assert.deepEqual([...protos].sort(), ['anthropic', 'gemini', 'ollama', 'openai']);
  } finally {
    await lab.close();
    await mock.close();
  }
});
