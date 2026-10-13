import { describe, it, expect } from 'vitest';
import { providerForDomain, providerForMx, providerForImapHost, providerById } from '../../src/main/core/providers';
import { baseDomain, discover, isValidEmail, parseAutoconfig, splitEmail } from '../../src/main/core/discovery';

describe('built-in providers', () => {
  it.each([
    ['gmail.com', 'gmail', 'imap.gmail.com', 993, 'smtp.gmail.com', 465],
    ['googlemail.com', 'gmail', 'imap.gmail.com', 993, 'smtp.gmail.com', 465],
    ['qq.com', 'qq', 'imap.qq.com', 993, 'smtp.qq.com', 465],
    ['foxmail.com', 'qq', 'imap.qq.com', 993, 'smtp.qq.com', 465],
    ['163.com', 'netease163', 'imap.163.com', 993, 'smtp.163.com', 465],
    ['126.com', 'netease126', 'imap.126.com', 993, 'smtp.126.com', 465],
    ['gmx.com', 'gmx_com', 'imap.gmx.com', 993, 'mail.gmx.com', 587],
    ['gmx.de', 'gmx_net', 'imap.gmx.net', 993, 'mail.gmx.net', 587],
    ['gmx.at', 'gmx_net', 'imap.gmx.net', 993, 'mail.gmx.net', 587],
    ['outlook.com', 'outlook', 'outlook.office365.com', 993, 'smtp-mail.outlook.com', 587],
    ['hotmail.co.uk', 'outlook', 'outlook.office365.com', 993, 'smtp-mail.outlook.com', 587],
    ['live.cn', 'outlook', 'outlook.office365.com', 993, 'smtp-mail.outlook.com', 587],
    ['icloud.com', 'icloud', 'imap.mail.me.com', 993, 'smtp.mail.me.com', 587],
    ['yahoo.com', 'yahoo', 'imap.mail.yahoo.com', 993, 'smtp.mail.yahoo.com', 465]
  ])('%s → %s', (domain, id, imapHost, imapPort, smtpHost, smtpPort) => {
    const p = providerForDomain(domain)!;
    expect(p.id).toBe(id);
    expect(p.imap).toMatchObject({ host: imapHost, port: imapPort });
    expect(p.smtp).toMatchObject({ host: smtpHost, port: smtpPort });
    expect(p.imap.security).toBe('tls');
    expect(p.help.length).toBeGreaterThan(0);
  });

  it('describes the credential each provider expects', () => {
    expect(providerForDomain('qq.com')!.passwordLabel).toBe('授权码');
    expect(providerForDomain('gmail.com')!.passwordLabel).toBe('应用专用密码');
    expect(providerForDomain('gmail.com')!.oauth).toBe('google');
    expect(providerForDomain('outlook.com')!.auth).toBe('oauth-required');
    expect(providerForDomain('outlook.com')!.oauth).toBe('microsoft');
  });

  it('returns copies so callers cannot corrupt the presets', () => {
    const a = providerForDomain('qq.com')!;
    a.imap.host = 'changed';
    expect(providerForDomain('qq.com')!.imap.host).toBe('imap.qq.com');
  });

  it('does not recognise unknown domains', () => {
    expect(providerForDomain('example.org')).toBeNull();
  });

  it('identifies hosted domains from MX records', () => {
    expect(providerForMx('aspmx.l.google.com')!.id).toBe('gmail');
    expect(providerForMx('aspmx.l.google.com')!.name).toBe('Google Workspace');
    expect(providerForMx('contoso-com.mail.protection.outlook.com.')!.id).toBe('office365');
    expect(providerForMx('mxbiz1.qq.com')!.id).toBe('exmail');
    expect(providerForMx('mx3.qq.com')!.id).toBe('qq');
    expect(providerForMx('qiye163mx01.mxmail.netease.com')!.id).toBe('qiye163');
    expect(providerForMx('mx.example.net')).toBeNull();
  });

  it('only infers a provider from an IMAP host when host and port match', () => {
    expect(providerForImapHost('imap.qq.com')!.id).toBe('qq');
    expect(providerForImapHost('127.0.0.1', 31993)).toBeNull();
    expect(providerForImapHost('127.0.0.1', 1143)!.id).toBe('proton');
    expect(providerById('nope')).toBeNull();
  });
});

describe('autodiscovery', () => {
  it('validates and splits addresses', () => {
    expect(isValidEmail('a.b+c@example.co.uk')).toBe(true);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(splitEmail(' Name@Example.COM ')).toEqual({ local: 'Name', domain: 'example.com' });
  });

  it('computes registrable base domains', () => {
    expect(baseDomain('mx1.mail.example.com')).toBe('example.com');
    expect(baseDomain('mx.example.co.uk')).toBe('example.co.uk');
    expect(baseDomain('example.com')).toBe('example.com');
  });

  it('parses Thunderbird autoconfig XML, preferring encrypted servers', () => {
    const xml = `<?xml version="1.0"?><clientConfig version="1.1"><emailProvider id="example.org">
      <displayName>Example Mail</displayName>
      <incomingServer type="pop3"><hostname>pop.example.org</hostname><port>995</port><socketType>SSL</socketType></incomingServer>
      <incomingServer type="imap"><hostname>imap.example.org</hostname><port>143</port><socketType>plain</socketType><username>%EMAILLOCALPART%</username></incomingServer>
      <incomingServer type="imap"><hostname>imap.example.org</hostname><port>993</port><socketType>SSL</socketType><username>%EMAILLOCALPART%</username></incomingServer>
      <outgoingServer type="smtp"><hostname>smtp.%EMAILDOMAIN%</hostname><port>587</port><socketType>STARTTLS</socketType></outgoingServer>
      </emailProvider></clientConfig>`;
    const p = parseAutoconfig(xml, 'example.org')!;
    expect(p.name).toBe('Example Mail');
    expect(p.imap).toEqual({ host: 'imap.example.org', port: 993, security: 'tls' });
    expect(p.smtp).toEqual({ host: 'smtp.example.org', port: 587, security: 'starttls' });
    expect(p.usernameStyle).toBe('local');
  });

  it('uses built-in presets without touching the network', async () => {
    let fetched = false;
    const r = await discover('someone@qq.com', { online: true, fetch: async () => { fetched = true; return { ok: false, status: 404, text: async () => '' }; } });
    expect(r.source).toBe('builtin');
    expect(r.provider!.id).toBe('qq');
    expect(fetched).toBe(false);
  });

  it('falls back to guessing reachable host names', async () => {
    const r = await discover('me@nonexistent-domain-for-tests.invalid', {
      online: false,
      timeoutMs: 1500,
      probe: async (host, port) => (host === 'mail.nonexistent-domain-for-tests.invalid' && (port === 993 || port === 587))
    });
    expect(r.source).toBe('guess');
    expect(r.provider!.imap).toEqual({ host: 'mail.nonexistent-domain-for-tests.invalid', port: 993, security: 'tls' });
    expect(r.provider!.smtp).toEqual({ host: 'mail.nonexistent-domain-for-tests.invalid', port: 587, security: 'starttls' });
  });

  it('asks for manual settings when nothing is reachable', async () => {
    const r = await discover('me@nonexistent-domain-for-tests.invalid', { online: false, timeoutMs: 1500, probe: async () => false });
    expect(r.source).toBe('none');
    expect(r.notes.join()).toContain('手动');
  });
});
