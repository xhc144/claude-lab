import { describe, it, expect } from 'vitest';
import { explainError } from '../../src/main/core/explain';

const imap = { host: 'imap.example.com', port: 993, security: 'tls' as const };
const err = (props: Record<string, unknown>, message = 'failed') => Object.assign(new Error(message), props);

describe('network errors', () => {
  it.each([
    [err({ code: 'ENOTFOUND' }, 'getaddrinfo ENOTFOUND imap.example.com'), 'dns', '找不到服务器'],
    [err({ code: 'EAI_AGAIN' }), 'dns-temp', '域名解析暂时失败'],
    [err({ code: 'ECONNREFUSED' }), 'refused', '服务器拒绝连接'],
    [err({ code: 'ETIMEDOUT' }), 'timeout', '连接超时'],
    [err({ code: 'GREETING_TIMEOUT' }), 'greeting-timeout', '服务器无响应'],
    [err({ code: 'ENETUNREACH' }), 'network', '网络不可用'],
    [err({ code: 'ECONNRESET' }), 'reset', '连接被中断']
  ])('%#: %s', (e, kind, title) => {
    const d = explainError(e, { phase: 'imap', server: imap });
    expect(d.kind).toBe(kind);
    expect(d.title).toBe(title);
    expect(d.suggestions.length).toBeGreaterThan(0);
  });

  it('unwraps nodemailer socket errors', () => {
    const smtp = { host: 'smtp.x', port: 465, security: 'tls' as const };
    expect(explainError(err({ code: 'ESOCKET', errno: -111, syscall: 'connect' }, 'connect ECONNREFUSED 127.0.0.1:1'), { phase: 'send', server: smtp }).kind).toBe('refused');
    expect(explainError(err({ code: 'EDNS' }, 'getaddrinfo ENOTFOUND nonexistent.invalid'), { phase: 'smtp', server: smtp }).kind).toBe('dns');
    expect(explainError(err({ code: 'ETIMEDOUT', command: 'CONN' }, 'Connection timeout'), { phase: 'smtp', server: smtp }).kind).toBe('timeout');
  });

  it('suggests the right port family for refused SMTP connections', () => {
    const d = explainError(err({ code: 'ECONNREFUSED' }), { phase: 'smtp', server: { host: 'smtp.x', port: 25, security: 'starttls' } });
    expect(d.suggestions[0]).toContain('465');
  });
});

describe('TLS errors', () => {
  it('detects TLS spoken to a plain-text port', () => {
    const d = explainError(err({}, 'C0:...:error:0A00010B:SSL routines:ssl3_get_record:wrong version number'), { phase: 'imap', server: imap });
    expect(d.kind).toBe('tls-mismatch');
    expect(d.needsUserAction).toBe(true);
  });
  it('explains untrusted and expired certificates', () => {
    expect(explainError(err({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }, 'self-signed certificate'), { phase: 'imap', server: imap }).kind).toBe('tls-untrusted');
    expect(explainError(err({ code: 'CERT_HAS_EXPIRED' }, 'certificate has expired'), { phase: 'imap', server: imap }).kind).toBe('tls-expired');
    expect(explainError(err({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' }, "Hostname/IP does not match certificate's altnames"), { phase: 'imap', server: imap }).kind).toBe('tls-hostname');
  });
});

describe('authentication failures are explained per provider', () => {
  const auth = (response: string) => err({ authenticationFailed: true, serverResponseCode: 'AUTHENTICATIONFAILED', response }, 'Command failed');

  it('Gmail needs an app password', () => {
    const d = explainError(auth('NO [ALERT] Application-specific password required: https://support.google.com/accounts/answer/185833 (Failure)'), { phase: 'imap', providerId: 'gmail', authType: 'password' });
    expect(d.title).toContain('应用专用密码');
    expect(d.helpUrl).toContain('apppasswords');
  });
  it('QQ needs an authorization code', () => {
    const d = explainError(auth('NO Login fail. Account is abnormal, service is not open, password is incorrect, login frequency limited, or system is busy. More information at https://help.mail.qq.com/detail/108/1023'), { phase: 'imap', providerId: 'qq', authType: 'password' });
    expect(d.title).toContain('授权码');
    expect(d.suggestions.join()).toContain('IMAP/SMTP');
  });
  it('NetEase unsafe login', () => {
    const d = explainError(auth('NO Unsafe Login. Please contact kefu@188.com for help'), { phase: 'imap', providerId: 'netease163', authType: 'password' });
    expect(d.kind).toBe('netease-unsafe');
  });
  it('NetEase wrong credential', () => {
    expect(explainError(auth('NO LOGIN Login error user name or password error'), { phase: 'imap', providerId: 'netease163', authType: 'password' }).title).toContain('授权码');
  });
  it('Outlook requires OAuth2', () => {
    const d = explainError(auth('NO AUTHENTICATE failed.'), { phase: 'imap', providerId: 'outlook', authType: 'password' });
    expect(d.kind).toBe('oauth-required');
  });
  it('GMX has IMAP disabled by default', () => {
    expect(explainError(auth('NO authentication failed'), { phase: 'imap', providerId: 'gmx_com', authType: 'password' }).explanation).toContain('POP3/IMAP');
  });
  it('OAuth tokens that the server rejects', () => {
    expect(explainError(auth('NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)'), { phase: 'imap', providerId: 'gmail', authType: 'oauth2' }).kind).toBe('oauth-rejected');
  });
  it('generic servers', () => {
    const d = explainError(auth('NO [AUTHENTICATIONFAILED] Authentication failed.'), { phase: 'imap', providerId: null, authType: 'password' });
    expect(d.kind).toBe('auth');
    expect(d.needsUserAction).toBe(true);
  });
  it('SMTP 535', () => {
    expect(explainError(err({ code: 'EAUTH', responseCode: 535 }, 'Invalid login: 535 5.7.8 Authentication credentials invalid'), { phase: 'smtp', providerId: null, authType: 'password' }).kind).toBe('auth');
  });
  it('throttling is temporary, not a credential problem', () => {
    const d = explainError(err({ code: 'ETHROTTLE' }, 'Too many login attempts'), { phase: 'imap' });
    expect(d.kind).toBe('throttled');
    expect(d.needsUserAction).toBe(false);
  });
  it('IMAP disabled', () => {
    expect(explainError(err({}, 'NO [ALERT] Your account is not enabled for IMAP use. IMAP access is disabled'), { phase: 'imap', providerId: 'yahoo' }).kind).toBe('imap-disabled');
  });
});

describe('sending errors', () => {
  const send = (props: Record<string, unknown>, msg: string) => explainError(err(props, msg), { phase: 'send', server: { host: 'smtp.x', port: 465, security: 'tls' } });
  it.each([
    [{ responseCode: 552 }, '552 5.3.4 Message size exceeds fixed maximum message size', 'too-large'],
    [{ responseCode: 554 }, '554 DT:SPM 163 smtp14, Message rejected as spam', 'spam-rejected'],
    [{ responseCode: 550 }, '550 5.1.1 <nobody@example.com>: Recipient address rejected: User unknown', 'recipient'],
    [{ responseCode: 553 }, '553 Mail from must equal authorized user', 'unknown'],
    [{ responseCode: 501 }, '501 Mail from address must be same as authorization user', 'sender-mismatch'],
    [{ responseCode: 550 }, '550 5.4.5 Daily user sending quota exceeded', 'send-quota'],
    [{ responseCode: 451 }, '451 4.3.0 Temporary server error', 'smtp-temp'],
    [{ code: 'EENVELOPE' }, 'No recipients defined', 'no-recipients']
  ])('%#: %s', (props, msg, kind) => {
    const d = send(props, msg);
    if (kind === 'unknown') expect(['recipient', 'unknown']).toContain(d.kind);
    else expect(d.kind).toBe(kind);
  });
});

describe('OAuth errors', () => {
  it('missing client configuration', () => {
    expect(explainError(new Error('尚未配置 Google OAuth 客户端 ID。'), { phase: 'oauth' }).kind).toBe('oauth-config');
  });
  it('bad client id', () => {
    expect(explainError(new Error('invalid_client: AADSTS700016: Application not found'), { phase: 'oauth' }).kind).toBe('oauth-client');
  });
  it('user cancelled', () => {
    expect(explainError(new Error('access_denied: user cancelled'), { phase: 'oauth' }).kind).toBe('oauth-cancelled');
  });
});
