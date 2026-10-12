// OAuth2 (authorization code + PKCE) for Google and Microsoft using a loopback redirect.
// Tokens go straight from the provider to this computer; no intermediate server is involved.
import http from 'node:http';
import crypto from 'node:crypto';
import type { OAuthClientConfig, OAuthProviderId } from '../../shared/types';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string | null;
}

export type HttpPost = (url: string, form: Record<string, string>) => Promise<{ status: number; json: any }>;

interface ProviderEndpoints {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  redirectHost: string;
}

export const OAUTH_ENDPOINTS: Record<OAuthProviderId, ProviderEndpoints> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/ openid email',
    redirectHost: '127.0.0.1'
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'offline_access openid email https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
    redirectHost: 'localhost'
  }
};

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function decodeJwtEmail(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return (payload.email || payload.preferred_username || payload.upn || null)?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

const PAGE = (ok: boolean, msg: string) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>鸿雁邮箱</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;font-family:"Segoe UI","Microsoft YaHei UI",sans-serif;background:#f6f4ef;color:#1d1b17}
.card{background:#fff;border-radius:18px;padding:40px 48px;box-shadow:0 20px 60px rgba(40,30,10,.12);text-align:center;max-width:420px}
.dot{width:56px;height:56px;border-radius:16px;margin:0 auto 18px;display:grid;place-items:center;font-size:28px;color:#fff;background:${ok ? 'linear-gradient(135deg,#e8553a,#b8321e)' : '#8f897d'}}
h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#5c574e;line-height:1.6}</style></head>
<body><div class="card"><div class="dot">${ok ? '✓' : '!'}</div><h1>${ok ? '授权完成' : '授权未完成'}</h1><p>${msg}</p></div></body></html>`;

export class OAuthManager {
  private sessions = new Map<string, { provider: OAuthProviderId; tokens: OAuthTokens; created: number }>();
  private active: { server: http.Server; reject: (e: Error) => void } | null = null;

  constructor(
    private getClient: (p: OAuthProviderId) => OAuthClientConfig,
    private post: HttpPost,
    private openBrowser: (url: string) => Promise<void> | void
  ) {}

  private client(provider: OAuthProviderId): OAuthClientConfig {
    const c = this.getClient(provider);
    if (!c.clientId) {
      throw new Error(provider === 'google'
        ? '尚未配置 Google OAuth 客户端 ID。请在 设置 → OAuth 中填写后重试，或改用应用专用密码。'
        : '尚未配置 Microsoft OAuth 客户端 ID。请在 设置 → OAuth 中填写后重试。');
    }
    return c;
  }

  cancel() {
    if (this.active) {
      this.active.reject(new Error('授权已取消'));
      this.active.server.close();
      this.active = null;
    }
  }

  /** Runs the browser flow; resolves with a short-lived session handle holding the tokens. */
  async start(provider: OAuthProviderId, loginHint?: string, timeoutMs = 5 * 60_000): Promise<{ session: string; email: string | null }> {
    const client = this.client(provider);
    this.cancel();
    const ep = OAUTH_ENDPOINTS[provider];
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));

    const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
      let redirectUri = '';
      const server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', redirectUri);
        if (url.pathname !== '/') { res.writeHead(404).end(); return; }
        const err = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        if (url.searchParams.get('state') !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE(false, '请求校验失败，请回到鸿雁邮箱重试。'));
          return;
        }
        if (err || !code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE(false, '你取消了授权，或授权过程出错。可以关闭此页面，回到鸿雁邮箱重试。'));
          finish(new Error(`${err || 'no_code'}: ${url.searchParams.get('error_description') || ''}`));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE(true, '鸿雁邮箱已获得授权，你可以关闭此页面并回到应用。'));
        finish(null, code);
      });
      const timer = setTimeout(() => finish(new Error('等待授权超时 (timeout)')), timeoutMs);
      const finish = (e: Error | null, code?: string) => {
        clearTimeout(timer);
        setTimeout(() => server.close(), 500);
        this.active = null;
        if (e) reject(e);
        else resolve({ code: code!, redirectUri });
      };
      this.active = { server, reject: (e) => { clearTimeout(timer); reject(e); } };
      server.on('error', (e) => finish(e));
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as any).port;
        redirectUri = `http://${ep.redirectHost}:${port}/`;
        const params = new URLSearchParams({
          client_id: client.clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: ep.scope,
          state,
          code_challenge: challenge,
          code_challenge_method: 'S256'
        });
        if (provider === 'google') { params.set('access_type', 'offline'); params.set('prompt', 'consent'); }
        else { params.set('prompt', 'select_account'); params.set('response_mode', 'query'); }
        if (loginHint) params.set('login_hint', loginHint);
        Promise.resolve(this.openBrowser(`${ep.authUrl}?${params}`)).catch((e) => finish(e));
      });
    });

    const form: Record<string, string> = {
      client_id: client.clientId,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    };
    if (client.clientSecret) form.client_secret = client.clientSecret;
    if (provider === 'microsoft') form.scope = ep.scope;
    const tokens = this.parseTokenResponse(await this.post(ep.tokenUrl, form), null);
    const session = b64url(crypto.randomBytes(18));
    this.sessions.set(session, { provider, tokens, created: Date.now() });
    // Drop sessions that were never used after 30 minutes.
    for (const [k, v] of this.sessions) if (Date.now() - v.created > 30 * 60_000) this.sessions.delete(k);
    return { session, email: tokens.email };
  }

  take(session: string): { provider: OAuthProviderId; tokens: OAuthTokens } | null {
    const s = this.sessions.get(session);
    if (!s) return null;
    this.sessions.delete(session);
    return { provider: s.provider, tokens: s.tokens };
  }

  peek(session: string): { provider: OAuthProviderId; tokens: OAuthTokens } | null {
    const s = this.sessions.get(session);
    return s ? { provider: s.provider, tokens: s.tokens } : null;
  }

  async refresh(provider: OAuthProviderId, tokens: OAuthTokens): Promise<OAuthTokens> {
    const client = this.client(provider);
    const ep = OAUTH_ENDPOINTS[provider];
    const form: Record<string, string> = {
      client_id: client.clientId,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    };
    if (client.clientSecret) form.client_secret = client.clientSecret;
    if (provider === 'microsoft') form.scope = ep.scope;
    return this.parseTokenResponse(await this.post(ep.tokenUrl, form), tokens);
  }

  private parseTokenResponse(res: { status: number; json: any }, previous: OAuthTokens | null): OAuthTokens {
    const j = res.json || {};
    if (res.status >= 400 || !j.access_token) {
      const e: any = new Error(`${j.error || 'token_error'}: ${j.error_description || 'HTTP ' + res.status}`);
      e.code = j.error === 'invalid_grant' ? 'EOAUTH_REVOKED' : 'EOAUTH';
      throw e;
    }
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token || previous?.refreshToken || '',
      expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000,
      email: decodeJwtEmail(j.id_token) || previous?.email || null
    };
  }
}
