import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../server/app.mjs';
import { startMock, setupLab, eulerTeam, listen, waitFor, Client } from './helpers.mjs';

test('a study interrupted by a server shutdown resumes after restart with keys still decryptable', async () => {
  const mock = await startMock({ delayMs: 15 });
  const dir = await mkdtemp(join(tmpdir(), 'lunheng-persist-'));
  try {
    let app = await createApp({ dataDir: dir, allowPrivateHosts: true });
    let url = await listen(app.server);
    const { c, providers } = await setupLab(url, mock.url);
    const id = (await c.post('/api/sessions', { question: '对所有非负整数 n，n^2+n+41 都是素数。', team: eulerTeam(providers) })).data.id;
    await c.post(`/api/sessions/${id}/start`);
    await waitFor(async () => (await c.get(`/api/sessions/${id}`)).data.session.usage.calls >= 2);
    await app.close(); // aborts in-flight calls and flushes state

    app = await createApp({ dataDir: dir, allowPrivateHosts: true });
    url = await listen(app.server);
    const c2 = new Client(url);
    c2.cookie = c.cookie;
    const me = await c2.get('/api/auth/me');
    assert.ok(me.data.user, 'login session survives restart');
    c2.csrf = me.data.csrf;
    let s = (await c2.get(`/api/sessions/${id}`)).data.session;
    assert.equal(s.status, 'paused');
    assert.match(s.pauseReason, /服务器/);
    await c2.post(`/api/sessions/${id}/start`);
    s = await waitFor(async () => { const d = (await c2.get(`/api/sessions/${id}`)).data; return d.session.status === 'completed' && !d.running ? d.session : null; }, { timeout: 30000 });
    assert.equal(s.ledger.claims.C0.status, 'refuted');
    await app.close();
  } finally {
    await mock.close();
    await rm(dir, { recursive: true, force: true });
  }
});
