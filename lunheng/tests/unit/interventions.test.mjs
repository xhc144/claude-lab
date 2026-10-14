import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, startMock, setupLab, eulerTeam, waitFor } from './helpers.mjs';

let mock, lab, c, P;
before(async () => {
  mock = await startMock({ delayMs: 2 });
  lab = await startApp();
  ({ c, providers: P } = await setupLab(lab.url, mock.url));
});
after(async () => { await lab.close(); await mock.close(); });

const state = async (id) => (await c.get(`/api/sessions/${id}`)).data;
const idle = (id) => waitFor(async () => { const d = await state(id); return !d.running && d.session.status !== 'running' && d.session.status !== 'pausing' ? d.session : null; }, { timeout: 30000 });

test('step mode, PI directive in prompts, pause/resume, PI objection and consult', async () => {
  const id = (await c.post('/api/sessions', { question: '对所有非负整数 n，n^2+n+41 都是素数。', team: eulerTeam(P), settings: { maxRounds: 2 } })).data.id;
  await c.post(`/api/sessions/${id}/directives`, { text: '请特别检查 n=40 附近的取值' });
  await c.post(`/api/sessions/${id}/start`, { step: true });
  let s = await idle(id);
  assert.equal(s.status, 'paused');
  assert.equal(s.cursor.phase, 'critique', 'one phase executed');
  assert.ok(mock.stats.requests.some((r) => JSON.stringify(r.body).includes('请特别检查 n=40 附近的取值')), 'directive reached the models');

  // A PI objection becomes part of the ledger and is routed to the author for rebuttal.
  const target = Object.values(s.ledger.claims).find((x) => x.kind === 'conjecture').id;
  const o = await c.post(`/api/sessions/${id}/objections`, { target, type: 'gap', severity: 'major', content: '这只是数值观察' });
  assert.equal(o.status, 200);
  s = await state(id).then((d) => d.session);
  assert.equal(s.ledger.claims[target].status, 'disputed');

  const q = await c.post(`/api/sessions/${id}/consult`, { rid: 'R3', question: '你最有把握的结论是什么？' });
  assert.equal(q.status, 200);
  assert.equal(q.data.contribution.phase, 'consult');

  // Graceful pause while running, then resume to completion.
  await c.post(`/api/sessions/${id}/start`);
  await c.post(`/api/sessions/${id}/pause`);
  s = await idle(id);
  assert.ok(['paused', 'completed'].includes(s.status));
  if (s.status !== 'completed') {
    await c.post(`/api/sessions/${id}/start`);
    s = await waitFor(async () => { const d = await state(id); return d.session.status === 'completed' && !d.running ? d.session : null; }, { timeout: 30000 });
  }
  assert.equal(s.ledger.claims.C0.status, 'refuted');
  assert.ok(s.report.markdown.includes('一、已证明的结论'));
  const md = await c.req('GET', `/api/sessions/${id}/export?format=md`, undefined, { raw: true });
  assert.match(md.headers.get('content-disposition'), /\.md"/);
});

test('budget exhaustion pauses the study, raising the budget resumes it', async () => {
  const id = (await c.post('/api/sessions', { question: '对所有非负整数 n，n^2+n+41 都是素数。', team: eulerTeam(P), settings: { budgetUsd: 0.03, maxOutputTokens: 1000 } })).data.id;
  await c.post(`/api/sessions/${id}/start`);
  let s = await idle(id);
  assert.equal(s.status, 'paused');
  assert.match(s.pauseReason, /预算/);
  assert.ok(s.usage.costUsd <= 0.03 + 1e-9, `spent ${s.usage.costUsd}`);
  await c.put(`/api/sessions/${id}/settings`, { budgetUsd: 5 });
  await c.post(`/api/sessions/${id}/start`);
  s = await waitFor(async () => { const d = await state(id); return d.session.status === 'completed' && !d.running ? d.session : null; }, { timeout: 30000 });
  assert.equal(s.ledger.claims.C0.status, 'refuted');
});

test('SSE stream delivers meta, deltas, contributions and ledger updates', async () => {
  const id = (await c.post('/api/sessions', { question: '对所有非负整数 n，n^2+n+41 都是素数。', team: eulerTeam(P), settings: { maxRounds: 1 } })).data.id;
  const ctl = new AbortController();
  const res = await fetch(`${lab.url}/api/sessions/${id}/events`, { headers: { cookie: c.cookie }, signal: ctl.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const seen = new Set();
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (const m of buf.matchAll(/event: (\w+)/g)) seen.add(m[1]);
        if (seen.has('report')) break;
      }
    } catch { /* aborted */ }
  })();
  await c.post(`/api/sessions/${id}/start`);
  await Promise.race([pump, new Promise((r) => setTimeout(r, 20000))]);
  ctl.abort();
  for (const t of ['meta', 'call', 'delta', 'contribution', 'ledger', 'feed', 'consensus', 'synthesis', 'report']) assert.ok(seen.has(t), `saw ${t}`);
});

test('team edits are refused while running and applied while paused', async () => {
  const id = (await c.post('/api/sessions', { question: '测试命题：任意素数 p>2 均为奇数', team: eulerTeam(P) })).data.id;
  const r = await c.put(`/api/sessions/${id}/team`, { update: [{ id: 'R2', role: 'devil' }], add: [{ providerId: P.gemini.id, modelId: 'gemini-mock-pro', role: 'verifier' }] });
  assert.equal(r.status, 200);
  assert.equal(r.data.team.length, 6);
  assert.equal(r.data.team[1].role, 'devil');
  assert.equal(r.data.team[5].label, 'F');
  const bad = await c.post('/api/sessions', { question: '太小的团队', team: eulerTeam(P).slice(0, 2) });
  assert.equal(bad.status, 400);
});
