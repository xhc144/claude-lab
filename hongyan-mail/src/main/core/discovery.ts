// Finds IMAP/SMTP settings for an email address:
// built-in presets → domain's own autoconfig → Mozilla ISPDB → MX records → guessing common host names.
import dns from 'node:dns/promises';
import net from 'node:net';
import type { DiscoveryResult, ProviderInfo, Security, ServerConfig } from '../../shared/types';
import { providerForDomain, providerForMx } from './providers';

export type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface DiscoveryOptions {
  online: boolean;
  fetch?: FetchFn;
  timeoutMs?: number;
  /** Skip TCP probing of guessed hosts (tests). */
  probe?: (host: string, port: number) => Promise<boolean>;
}

export function splitEmail(email: string): { local: string; domain: string } | null {
  const m = /^\s*([^@\s]+)@([^@\s]+\.[^@\s]+)\s*$/.exec(email);
  if (!m) return null;
  return { local: m[1], domain: m[2].toLowerCase() };
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s"<>]+@[^@\s"<>]+\.[A-Za-z0-9-]{2,}$/.test(email.trim());
}

function genericProvider(id: string, name: string, imap: ServerConfig, smtp: ServerConfig, usernameStyle: 'email' | 'local'): ProviderInfo {
  return {
    id,
    name,
    imap,
    smtp,
    auth: 'password',
    usernameStyle,
    passwordLabel: '密码',
    help: ['请确认已在邮箱网页版的设置中开启 IMAP / SMTP 服务。部分服务商要求使用「授权码」或「应用专用密码」代替登录密码。']
  };
}

/** Parses a Thunderbird autoconfig (config-v1.1.xml) document. */
export function parseAutoconfig(xml: string, domain: string): ProviderInfo | null {
  const pick = (type: 'incomingServer' | 'outgoingServer', proto: string) => {
    const re = new RegExp(`<${type}[^>]*type="${proto}"[^>]*>([\\s\\S]*?)</${type}>`, 'gi');
    const servers: Array<ServerConfig & { username: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const body = m[1];
      const tag = (n: string) => (new RegExp(`<${n}>\\s*([^<]*?)\\s*</${n}>`, 'i').exec(body)?.[1] || '').trim();
      const host = tag('hostname');
      const port = Number(tag('port'));
      const st = tag('socketType').toUpperCase();
      if (!host || !port) continue;
      const security: Security = st === 'SSL' ? 'tls' : st === 'STARTTLS' ? 'starttls' : 'none';
      servers.push({ host: host.replace('%EMAILDOMAIN%', domain), port, security, username: tag('username') });
    }
    // Prefer encrypted servers; implicit TLS first.
    const rank = (s: ServerConfig) => (s.security === 'tls' ? 0 : s.security === 'starttls' ? 1 : 2);
    return servers.sort((a, b) => rank(a) - rank(b))[0] || null;
  };
  const imap = pick('incomingServer', 'imap');
  const smtp = pick('outgoingServer', 'smtp');
  if (!imap || !smtp) return null;
  const name = (/<displayName>\s*([^<]+?)\s*<\/displayName>/i.exec(xml)?.[1] || domain).trim();
  const style = imap.username.includes('%EMAILLOCALPART%') ? 'local' : 'email';
  const { username: _u1, ...imapCfg } = imap;
  const { username: _u2, ...smtpCfg } = smtp;
  return genericProvider('autoconfig', name, imapCfg, smtpCfg, style);
}

export function defaultProbe(host: string, port: number, timeoutMs = 3500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (ok: boolean) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

async function fetchText(fetchFn: FetchFn, url: string, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Registrable base of a host name, e.g. mx1.mail.example.co.uk → example.co.uk (best effort). */
export function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2];
  const twoLevel = ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac'].includes(sld) && parts[parts.length - 1].length === 2;
  return parts.slice(twoLevel ? -3 : -2).join('.');
}

export async function discover(email: string, opts: DiscoveryOptions): Promise<DiscoveryResult> {
  const parts = splitEmail(email);
  if (!parts) return { email, domain: '', source: 'none', provider: null, notes: ['邮箱地址格式不正确'] };
  const { domain } = parts;
  const notes: string[] = [];
  const timeoutMs = opts.timeoutMs ?? 6000;

  const builtin = providerForDomain(domain);
  if (builtin) {
    notes.push(`已识别为 ${builtin.name}，使用内置的服务器配置。`);
    return { email, domain, source: 'builtin', provider: builtin, notes };
  }

  // MX lookup runs locally through the system resolver.
  let mxHosts: string[] = [];
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
    ]);
    mxHosts = mx.sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
  } catch {
    notes.push('未能查询到该域名的 MX 记录。');
  }
  for (const h of mxHosts) {
    const p = providerForMx(h);
    if (p) {
      notes.push(`根据邮件交换记录（${h}），该域名托管在 ${p.name}。`);
      return { email, domain, source: 'mx', provider: p, notes };
    }
  }

  if (opts.online && opts.fetch) {
    const xml =
      (await fetchText(opts.fetch, `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(email)}`, timeoutMs)) ||
      (await fetchText(opts.fetch, `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`, timeoutMs));
    const fromDomain = xml && parseAutoconfig(xml, domain);
    if (fromDomain) {
      notes.push('使用了该域名自己发布的自动配置文件。');
      return { email, domain, source: 'autoconfig', provider: { ...fromDomain, id: 'autoconfig' }, notes };
    }
    const candidates = [domain, ...mxHosts.map(baseDomain).filter((d) => d !== domain)];
    for (const d of [...new Set(candidates)].slice(0, 3)) {
      const ispdb = await fetchText(opts.fetch, `https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(d)}`, timeoutMs);
      const p = ispdb && parseAutoconfig(ispdb, domain);
      if (p) {
        notes.push(`在 Mozilla ISPDB 公共配置库中找到了 ${d} 的配置（仅查询域名，不发送邮箱地址或密码）。`);
        return { email, domain, source: 'ispdb', provider: { ...p, id: 'ispdb' }, notes };
      }
    }
  }

  // Guess common host names and keep whatever accepts a connection.
  const probe = opts.probe ?? ((h: string, p: number) => defaultProbe(h, p));
  const imapCandidates: ServerConfig[] = [
    { host: `imap.${domain}`, port: 993, security: 'tls' },
    { host: `mail.${domain}`, port: 993, security: 'tls' },
    { host: `imap.${domain}`, port: 143, security: 'starttls' },
    { host: `mail.${domain}`, port: 143, security: 'starttls' },
    { host: domain, port: 993, security: 'tls' }
  ];
  const smtpCandidates: ServerConfig[] = [
    { host: `smtp.${domain}`, port: 465, security: 'tls' },
    { host: `smtp.${domain}`, port: 587, security: 'starttls' },
    { host: `mail.${domain}`, port: 465, security: 'tls' },
    { host: `mail.${domain}`, port: 587, security: 'starttls' },
    { host: domain, port: 465, security: 'tls' }
  ];
  const firstReachable = async (list: ServerConfig[]) => {
    const results = await Promise.all(list.map((c) => probe(c.host, c.port).catch(() => false)));
    const idx = results.findIndex(Boolean);
    return idx >= 0 ? list[idx] : null;
  };
  const [imap, smtp] = await Promise.all([firstReachable(imapCandidates), firstReachable(smtpCandidates)]);
  if (imap && smtp) {
    notes.push(`根据常见命名规则推测出服务器：${imap.host}、${smtp.host}，请在连接测试后确认。`);
    return { email, domain, source: 'guess', provider: genericProvider('guess', domain, imap, smtp, 'email'), notes };
  }
  notes.push('没有找到可用的服务器配置，请手动填写 IMAP / SMTP 服务器信息（可在邮箱服务商的帮助页面中查到）。');
  return {
    email,
    domain,
    source: 'none',
    provider: genericProvider('manual', domain, imap || imapCandidates[0], smtp || smtpCandidates[0], 'email'),
    notes
  };
}
