// HTTP application: JSON API, Server-Sent Events, static console and vendored browser libraries.
import { createServer } from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';
import { loadConfig, ROOT } from './config.mjs';
import { loadMasterKey, Vault } from './security/vault.mjs';
import { UserStore } from './users.mjs';
import { ProviderStore, ValidationError } from './providers/store.mjs';
import { Gateway } from './providers/gateway.mjs';
import { publicPresets } from './providers/presets.mjs';
import { ProviderError } from './providers/errors.mjs';
import { SessionManager, cleanSettings } from './engine/sessions.mjs';
import { SETTINGS_DEFAULTS } from './engine/orchestrator.mjs';
import { ROLES } from './engine/roles.mjs';
import { PHASES, DOMAINS } from './engine/prompts.mjs';
import { CLAIM_STATUS } from './engine/ledger.mjs';
import { buildReport } from './engine/report.mjs';
import { AuthSessions, Throttle, parseCookies, sessionCookie, COOKIE } from './http/auth.mjs';
import { flushWrites } from './util/json-store.mjs';
import { log } from './util/log.mjs';

const VERSION = '1.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

const VENDOR = {
  'katex/katex.mjs': 'node_modules/katex/dist/katex.mjs',
  'katex/katex.min.css': 'node_modules/katex/dist/katex.min.css',
  'marked.esm.js': 'node_modules/marked/lib/marked.esm.js',
  'purify.es.mjs': 'node_modules/dompurify/dist/purify.es.mjs',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function createApp(overrides = {}, { fetchImpl } = {}) {
  const config = loadConfig(process.env, overrides);
  await fs.mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  const vault = new Vault(await loadMasterKey(config));
  const users = await new UserStore({ dataDir: config.dataDir }).load();
  const providers = new ProviderStore({ dataDir: config.dataDir, vault });
  const gateway = new Gateway({ config, providers, fetchImpl });
  const sessions = new SessionManager({ config, gateway, providers, accounts: users });
  const auth = await new AuthSessions({ dataDir: config.dataDir, ttlMs: config.sessionTtlMs }).load();
  const throttle = new Throttle();
  const sseClients = new Set();

  // ───────────────────────────── helpers ─────────────────────────────

  const send = (res, status, body, headers = {}) => {
    const data = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS, ...headers });
    res.end(data);
  };

  async function readBody(req) {
    const type = req.headers['content-type'] || '';
    if (!type.includes('application/json')) {
      if (req.headers['content-length'] === '0' || !req.headers['content-length']) return {};
      throw new HttpError(415, '请求体必须是 JSON');
    }
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > config.maxBodyBytes) throw new HttpError(413, '请求体过大');
      chunks.push(c);
    }
    if (!size) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'JSON 格式错误'); }
  }

  function currentAuth(req) {
    const t = parseCookies(req.headers.cookie)[COOKIE];
    const rec = auth.get(t);
    if (!rec) return null;
    const user = users.getById(rec.userId);
    return user ? { rec, user, token: t } : null;
  }

  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
  }

  const clientKey = (req) => req.socket.remoteAddress || 'unknown';

  // ───────────────────────────── routes ─────────────────────────────

  const routes = [];
  const route = (method, path, handler, { auth: needAuth = true } = {}) => {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([A-Za-z0-9_]+)'; }) + '$');
    routes.push({ method, re, keys, handler, needAuth });
  };

  route('GET', '/api/meta', async () => ({
    version: VERSION,
    signup: config.signup === 'closed' ? (users.count() === 0 ? 'open' : 'closed') : config.signup,
    hasUsers: users.count() > 0,
    presets: publicPresets(),
    roles: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, { name: v.name, en: v.en, duty: v.duty }])),
    phases: PHASES, domains: DOMAINS, statuses: CLAIM_STATUS, settingsDefaults: SETTINGS_DEFAULTS,
    allowPrivateHosts: config.allowPrivateHosts,
  }), { auth: false });

  route('POST', '/api/auth/register', async ({ req, res, body }) => {
    const mode = config.signup;
    if (mode === 'closed' && users.count() > 0) throw new HttpError(403, '本实验室已关闭注册');
    if (mode === 'invite' && users.count() > 0 && (!config.inviteCode || body.invite !== config.inviteCode)) throw new HttpError(403, '邀请码不正确');
    const key = `reg:${clientKey(req)}`;
    if (!throttle.check(key)) throw new HttpError(429, '注册过于频繁，请稍后再试');
    throttle.hit(key);
    const user = await users.create(body.username, body.password);
    const { token: t, csrf } = auth.create(user.id);
    res.setHeader('set-cookie', sessionCookie(t, { secure: config.secureCookies, maxAgeMs: config.sessionTtlMs }));
    return { user: users.publicUser(user), csrf };
  }, { auth: false });

  route('POST', '/api/auth/login', async ({ req, res, body }) => {
    const key = `login:${clientKey(req)}:${String(body.username || '').toLowerCase()}`;
    if (!throttle.check(key)) throw new HttpError(429, '登录尝试过多，请 15 分钟后再试');
    const user = await users.authenticate(body.username, body.password);
    if (!user) { throttle.hit(key); throw new HttpError(401, '用户名或密码错误'); }
    throttle.reset(key);
    const { token: t, csrf } = auth.create(user.id);
    res.setHeader('set-cookie', sessionCookie(t, { secure: config.secureCookies, maxAgeMs: config.sessionTtlMs }));
    return { user: users.publicUser(user), csrf };
  }, { auth: false });

  route('POST', '/api/auth/logout', async ({ res, ctx }) => {
    auth.destroy(ctx.token);
    res.setHeader('set-cookie', sessionCookie('', { secure: config.secureCookies, maxAgeMs: 0 }));
    return { ok: true };
  });

  route('GET', '/api/auth/me', async ({ ctx }) => (ctx ? { user: users.publicUser(ctx.user), csrf: ctx.rec.csrf } : { user: null }), { auth: false });

  route('PUT', '/api/account/settings', async ({ ctx, body }) => ({ user: await users.updateSettings(ctx.user.id, body) }));
  route('POST', '/api/account/password', async ({ ctx, body }) => {
    await users.changePassword(ctx.user.id, body.oldPassword, body.newPassword);
    auth.destroyUser(ctx.user.id, ctx.token);
    return { ok: true };
  });
  route('GET', '/api/account/usage', async ({ ctx }) => users.getUsage(ctx.user.id));

  // Providers (API keys never leave the server; responses carry only hints).
  route('GET', '/api/providers', async ({ ctx }) => ({ providers: await providers.list(ctx.user.id) }));
  route('POST', '/api/providers', async ({ ctx, body }) => ({ provider: await providers.create(ctx.user.id, body) }));
  route('PUT', '/api/providers/:id', async ({ ctx, body, params }) => {
    const p = await providers.update(ctx.user.id, params.id, body);
    if (!p) throw new HttpError(404, '服务商不存在');
    return { provider: p };
  });
  route('DELETE', '/api/providers/:id', async ({ ctx, params }) => {
    if (!(await providers.remove(ctx.user.id, params.id))) throw new HttpError(404, '服务商不存在');
    return { ok: true };
  });
  route('GET', '/api/providers/:id/models', async ({ ctx, params }) => ({ models: await gateway.listModels(ctx.user.id, params.id) }));
  route('POST', '/api/providers/:id/test', async ({ ctx, params, body }) => {
    const p = await providers.get(ctx.user.id, params.id);
    if (!p) throw new HttpError(404, '服务商不存在');
    const modelId = String(body.modelId || p.models[0]?.id || '').trim();
    if (!modelId) throw new HttpError(400, '请先添加至少一个模型');
    const account = await users.accountFor(ctx.user.id);
    const at = new Date().toISOString();
    try {
      const r = await gateway.invoke({
        userId: ctx.user.id, providerId: p.id, modelId, maxRetries: 0,
        system: 'You are a connectivity probe. Follow the instruction exactly.',
        messages: [{ role: 'user', content: 'Reply with exactly the two letters: OK' }],
        maxTokens: 2048, thinking: 'off', rates: account.rates,
      });
      account.addSpend(r.costUsd, r.usage.inputTokens + r.usage.outputTokens);
      const result = { ok: true, at, modelId, latencyMs: r.latencyMs, firstTokenMs: r.firstTokenMs, text: r.text.slice(0, 200), thinking: r.thinking.slice(0, 200), usage: r.usage, costUsd: r.costUsd, servedModel: r.servedModel, repairs: r.repairs };
      await providers.recordTest(ctx.user.id, p.id, { ok: true, at, modelId, latencyMs: r.latencyMs });
      return result;
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError({ kind: 'server', message: err.message });
      await providers.recordTest(ctx.user.id, p.id, { ok: false, at, modelId, message: e.summary });
      return { ok: false, at, modelId, error: e.toJSON() };
    }
  });

  // Research sessions.
  const openSession = async (ctx, id) => {
    const entry = await sessions.open(ctx.user.id, id);
    if (!entry) throw new HttpError(404, '研究不存在');
    return entry;
  };

  route('GET', '/api/sessions', async ({ ctx }) => ({ sessions: await sessions.list(ctx.user.id) }));
  route('POST', '/api/sessions', async ({ ctx, body }) => {
    const s = await sessions.create(ctx.user.id, body);
    if (body.autostart) (await sessions.open(ctx.user.id, s.id)).run.start();
    return { id: s.id };
  });
  route('GET', '/api/sessions/:id', async ({ ctx, params }) => {
    const { run } = await openSession(ctx, params.id);
    return { session: run.s, running: run.running };
  });
  route('DELETE', '/api/sessions/:id', async ({ ctx, params }) => {
    if (!(await sessions.remove(ctx.user.id, params.id))) throw new HttpError(404, '研究不存在');
    return { ok: true };
  });
  route('POST', '/api/sessions/:id/duplicate', async ({ ctx, params }) => {
    const s = await sessions.duplicate(ctx.user.id, params.id);
    if (!s) throw new HttpError(404, '研究不存在');
    return { id: s.id };
  });
  route('POST', '/api/sessions/:id/start', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    if (run.s.cursor.phase === 'done') throw new HttpError(409, '研究已完成；可使用「追加轮次」继续研究');
    run.start({ step: !!body.step });
    return { ok: true, status: run.s.status };
  });
  route('POST', '/api/sessions/:id/pause', async ({ ctx, params }) => {
    const { run } = await openSession(ctx, params.id);
    run.pause('首席研究员暂停');
    return { ok: true };
  });
  route('POST', '/api/sessions/:id/abort', async ({ ctx, params }) => {
    const { run } = await openSession(ctx, params.id);
    run.abort('首席研究员中止');
    return { ok: true };
  });
  route('POST', '/api/sessions/:id/conclude', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    if (run.running) throw new HttpError(409, '请先暂停研究');
    run.concludeNow();
    if (body.start !== false) run.start();
    return { ok: true };
  });
  route('POST', '/api/sessions/:id/extend', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    if (!run.extend(body.rounds || 1)) throw new HttpError(409, '研究正在运行');
    return { ok: true };
  });
  route('POST', '/api/sessions/:id/report/rebuild', async ({ ctx, params }) => {
    const { run } = await openSession(ctx, params.id);
    return { report: run.rebuildReport() };
  });
  route('PUT', '/api/sessions/:id/settings', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    const next = cleanSettings(body, run.s.settings);
    run.updateSettings(next);
    return { settings: run.s.settings };
  });
  route('PUT', '/api/sessions/:id/team', async ({ ctx, params, body }) => {
    const s = await sessions.updateTeam(ctx.user.id, params.id, body);
    if (!s) throw new HttpError(404, '研究不存在');
    return { team: s.team };
  });
  route('PUT', '/api/sessions/:id/title', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    const t = String(body.title || '').trim().slice(0, 120);
    if (!t) throw new HttpError(400, '标题不能为空');
    run.s.title = t;
    run.emitMeta(true);
    await run.save(true);
    return { ok: true };
  });
  route('POST', '/api/sessions/:id/directives', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    if (!String(body.text || '').trim()) throw new HttpError(400, '指示内容为空');
    return { directive: run.addDirective(body.text) };
  });
  route('PUT', '/api/sessions/:id/directives/:did', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    const d = run.setDirectiveActive(params.did, body.active);
    if (!d) throw new HttpError(404, '指示不存在');
    return { directive: d };
  });
  route('POST', '/api/sessions/:id/claims', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    const statement = String(body.statement || '').trim();
    if (!statement) throw new HttpError(400, '断言内容为空');
    const kinds = ['theorem', 'lemma', 'conjecture', 'counterexample', 'observation', 'definition'];
    const id = run.piClaim({ statement: statement.slice(0, 8000), proof: String(body.proof || '').slice(0, 20000), kind: kinds.includes(body.kind) ? body.kind : 'lemma', relation: ['proves', 'refutes', 'supports'].includes(body.relation) ? body.relation : null, target: body.target || null });
    return { id };
  });
  route('POST', '/api/sessions/:id/objections', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    const types = ['counterexample', 'gap', 'error', 'ambiguity', 'scope'];
    const id = run.piObjection({ target: body.target, content: String(body.content || '').trim().slice(0, 8000), type: types.includes(body.type) ? body.type : 'gap', severity: ['fatal', 'major', 'minor'].includes(body.severity) ? body.severity : 'major' });
    if (!id) throw new HttpError(400, '目标断言不存在或内容为空');
    return { id };
  });
  route('POST', '/api/sessions/:id/consult', async ({ ctx, params, body }) => {
    const { run } = await openSession(ctx, params.id);
    const q = String(body.question || '').trim();
    if (!q) throw new HttpError(400, '问题为空');
    const c = await run.consult(String(body.rid || ''), q);
    return { contribution: c };
  });
  route('GET', '/api/sessions/:id/export', async ({ ctx, params, res, query }) => {
    const { run } = await openSession(ctx, params.id);
    const s = run.s;
    const base = `lunheng-${s.id}`;
    if (query.get('format') === 'md') {
      const md = s.report?.markdown || buildReport(s, '');
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': `attachment; filename="${base}.md"`, 'cache-control': 'no-store', ...SECURITY_HEADERS });
      res.end(md);
    } else {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${base}.json"`, 'cache-control': 'no-store', ...SECURITY_HEADERS });
      res.end(JSON.stringify(s, null, 1));
    }
    return undefined;
  });

  route('GET', '/api/sessions/:id/events', async ({ ctx, params, req, res }) => {
    const { run } = await openSession(ctx, params.id);
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no', ...SECURITY_HEADERS });
    res.write('retry: 3000\n\n');
    const write = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    write('meta', run.meta());
    const off = sessions.subscribe(params.id, ({ type, data }) => write(type, data));
    const hb = setInterval(() => res.write(': hb\n\n'), 15_000);
    const client = { res, close: () => { clearInterval(hb); off(); } };
    sseClients.add(client);
    req.on('close', () => { client.close(); sseClients.delete(client); });
    return undefined;
  });

  // ───────────────────────────── static files ─────────────────────────────

  async function serveFile(res, file, { immutable = false } = {}) {
    let st;
    try { st = await fs.stat(file); } catch { return false; }
    if (!st.isFile()) return false;
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': immutable ? 'public, max-age=604800, immutable' : 'no-cache',
      ...SECURITY_HEADERS,
    });
    createReadStream(file).pipe(res);
    return true;
  }

  function within(base, rel) {
    const target = resolve(base, '.' + sep + rel);
    return target === base || target.startsWith(base + sep) ? target : null;
  }

  async function serveStatic(req, res, pathname) {
    if (pathname.startsWith('/vendor/')) {
      const rel = pathname.slice('/vendor/'.length);
      if (VENDOR[rel]) return serveFile(res, join(ROOT, VENDOR[rel]), { immutable: true });
      if (rel.startsWith('katex/fonts/')) {
        const f = within(join(ROOT, 'node_modules/katex/dist/fonts'), rel.slice('katex/fonts/'.length));
        return f ? serveFile(res, f, { immutable: true }) : false;
      }
      return false;
    }
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const f = within(config.publicDir, rel);
    if (f && (await serveFile(res, f))) return true;
    // SPA fallback for client-side routes.
    if (!extname(pathname)) return serveFile(res, join(config.publicDir, 'index.html'));
    return false;
  }

  // ───────────────────────────── dispatcher ─────────────────────────────

  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const pathname = url.pathname;
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: '不支持的方法' });
      if (!(await serveStatic(req, res, pathname))) send(res, 404, { error: '未找到' });
      return;
    }
    const match = routes.find((r) => r.method === req.method && r.re.test(pathname));
    if (!match) return send(res, 404, { error: '接口不存在' });
    const m = pathname.match(match.re);
    const params = Object.fromEntries(match.keys.map((k, i) => [k, m[i + 1]]));
    const ctx = currentAuth(req);
    if (match.needAuth && !ctx) return send(res, 401, { error: '请先登录' });
    if (req.method !== 'GET') {
      if (!sameOrigin(req)) return send(res, 403, { error: '跨站请求被拒绝' });
      if (ctx && !auth.checkCsrf(ctx.rec, req.headers['x-csrf-token'])) return send(res, 403, { error: 'CSRF 校验失败，请刷新页面' });
    }
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const result = await match.handler({ req, res, params, body, ctx, query: url.searchParams });
    if (result !== undefined && !res.headersSent) send(res, 200, result);
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err instanceof HttpError || err instanceof ValidationError ? err.status : err instanceof ProviderError ? 502 : 500;
      if (status >= 500 && !(err instanceof ProviderError)) log.error(`${req.method} ${req.url} → ${err.stack || err.message}`);
      const payload = err instanceof ProviderError ? { error: err.summary, provider: err.toJSON() } : { error: status === 500 ? '服务器内部错误' : err.message };
      if (!res.headersSent) send(res, status, payload);
      else res.end();
    });
  });
  server.requestTimeout = 0; // SSE and long consult calls
  server.headersTimeout = 30_000;

  async function close() {
    for (const c of sseClients) { c.close(); c.res.end(); }
    sseClients.clear();
    await sessions.shutdown();
    await auth.flush();
    await flushWrites();
    await new Promise((r) => server.close(() => r()));
  }

  return { server, config, users, providers, gateway, sessions, auth, close };
}
