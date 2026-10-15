import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { startApp, startMock, setupLab, eulerTeam, Client, MOCK_KEYS } from './helpers.mjs';
import { Vault } from '../../server/security/vault.mjs';
import { isPrivateAddress } from '../../server/security/netguard.mjs';

let mock, lab, alice, bob, P;

before(async () => {
  mock = await startMock();
  lab = await startApp();
  ({ c: alice, providers: P } = await setupLab(lab.url, mock.url, 'alice'));
  bob = new Client(lab.url);
  await bob.post('/api/auth/register', { username: 'bob', password: 'another long password' });
});
after(async () => { await lab.close(); await mock.close(); });

test('vault: round trip, tamper detection and binding to user + scope', () => {
  const v = new Vault(randomBytes(32));
  const box = v.encrypt('u1', 'provider:p1:key', 'sk-secret');
  assert.equal(v.decrypt('u1', 'provider:p1:key', box), 'sk-secret');
  assert.throws(() => v.decrypt('u2', 'provider:p1:key', box));
  assert.throws(() => v.decrypt('u1', 'provider:p2:key', box));
  const tampered = { ...box, ct: Buffer.from(Buffer.from(box.ct, 'base64').map((b, i) => (i === 0 ? b ^ 1 : b))).toString('base64') };
  assert.throws(() => v.decrypt('u1', 'provider:p1:key', tampered));
});

test('provider API responses never contain key material', async () => {
  const list = JSON.stringify((await alice.get('/api/providers')).data);
  for (const k of Object.values(MOCK_KEYS)) assert.ok(!list.includes(k));
  const p = (await alice.get('/api/providers')).data.providers.find((x) => x.id === P.openai.id);
  assert.equal(p.hasKey, true);
  assert.match(p.keyHint, /^sk-••••6789$/);
  const upd = await alice.put(`/api/providers/${P.openai.id}`, { extraHeaders: { 'X-Relay-Token': 'relay-secret-abcdef' } });
  assert.ok(!JSON.stringify(upd.data).includes('relay-secret-abcdef'));
  assert.deepEqual(upd.data.provider.headerNames, ['X-Relay-Token']);
});

test('users are isolated from each other', async () => {
  const s = await alice.post('/api/sessions', { question: 'n^2+n+41 恒为素数', team: eulerTeam(P) });
  assert.equal(s.status, 200);
  assert.equal((await bob.get('/api/providers')).data.providers.length, 0);
  assert.equal((await bob.get(`/api/sessions/${s.data.id}`)).status, 404);
  assert.equal((await bob.get('/api/sessions')).data.sessions.length, 0);
  assert.equal((await bob.put(`/api/providers/${P.openai.id}`, { name: 'pwned' })).status, 404);
  assert.equal((await bob.post(`/api/providers/${P.openai.id}/test`, {})).status, 404);
  assert.equal((await bob.get(`/api/sessions/${s.data.id}/events`)).status, 404);
  // Bob cannot staff his study with Alice's providers.
  const steal = await bob.post('/api/sessions', { question: 'x 是素数', team: eulerTeam(P) });
  assert.equal(steal.status, 400);
});

test('authentication, CSRF and origin checks', async () => {
  const anon = new Client(lab.url);
  assert.equal((await anon.get('/api/providers')).status, 401);
  const noCsrf = new Client(lab.url);
  noCsrf.cookie = alice.cookie;
  assert.equal((await noCsrf.post('/api/providers', { presetId: 'openai' })).status, 403);
  const res = await fetch(`${lab.url}/api/providers`, { method: 'POST', headers: { cookie: alice.cookie, 'x-csrf-token': alice.csrf, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
  const page = await fetch(`${lab.url}/`);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  const cookie = (await fetch(`${lab.url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'bob', password: 'another long password' }) })).headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
});

test('login throttling and generic error messages', async () => {
  const c = new Client(lab.url);
  const r1 = await c.post('/api/auth/login', { username: 'nobody', password: 'whatever123' });
  const r2 = await c.post('/api/auth/login', { username: 'bob', password: 'wrong password!' });
  assert.equal(r1.data.error, r2.data.error, 'no username enumeration');
  let last;
  for (let i = 0; i < 12; i++) last = await c.post('/api/auth/login', { username: 'carol', password: 'nope-nope-nope' });
  assert.equal(last.status, 429);
});

test('static file server refuses path traversal', async () => {
  const r = await fetch(`${lab.url}/..%2f..%2fpackage.json`);
  assert.notEqual((await r.text()).includes('"dependencies"'), true);
  const v = await fetch(`${lab.url}/vendor/katex/fonts/..%2f..%2f..%2fpackage.json`);
  assert.equal(v.status, 404);
});

test('private address detection', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1', '100.64.1.1']) assert.ok(isPrivateAddress(ip), ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) assert.ok(!isPrivateAddress(ip), ip);
});
