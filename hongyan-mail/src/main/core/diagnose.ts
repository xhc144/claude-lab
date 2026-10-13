// Step-by-step connection test used when adding an account and from the account's "诊断" panel.
import dns from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import type { DiagStep, DiagStepId, DiagnosisReport, ServerConfig, AuthType } from '../../shared/types';
import { createImapClient, type ImapAuth } from './imap';
import { createTransport } from './smtp';
import { explainError } from './explain';
import type { Logger } from './logger';

export interface DiagnoseInput {
  email: string;
  imap: ServerConfig;
  smtp: ServerConfig;
  username: string;
  smtpUsername?: string | null;
  allowInsecureTls: boolean;
  providerId: string | null;
  authType: AuthType;
  /** Resolves credentials; for OAuth this may refresh a token, so failures are reported as the "oauth" step. */
  getAuth: () => Promise<ImapAuth>;
  testSmtp?: boolean;
}

const LABELS: Record<DiagStepId, string> = {
  oauth: '获取 OAuth2 访问令牌',
  dns: '解析收信服务器地址',
  tcp: '连接收信服务器',
  tls: '建立加密连接',
  greeting: '服务器握手',
  auth: '验证账户身份',
  folders: '读取文件夹',
  'smtp-dns': '解析发信服务器地址',
  'smtp-tcp': '连接发信服务器',
  'smtp-tls': '发信加密连接',
  'smtp-auth': '验证发信身份'
};

function tcpConnect(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    const timer = setTimeout(() => { sock.destroy(); const e: any = new Error(`connect ETIMEDOUT ${host}:${port}`); e.code = 'ETIMEDOUT'; reject(e); }, timeoutMs);
    sock.once('connect', () => { clearTimeout(timer); sock.destroy(); resolve(); });
    sock.once('error', (e) => { clearTimeout(timer); sock.destroy(); reject(e); });
  });
}

function tlsProbe(host: string, port: number, allowInsecure: boolean, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const isIp = net.isIP(host) !== 0;
    const sock = tls.connect({ host, port, servername: isIp ? undefined : host, rejectUnauthorized: !allowInsecure });
    const timer = setTimeout(() => { sock.destroy(); const e: any = new Error('TLS handshake timeout'); e.code = 'ETIMEDOUT'; reject(e); }, timeoutMs);
    sock.once('secureConnect', () => {
      clearTimeout(timer);
      const cert = sock.getPeerCertificate();
      const proto = sock.getProtocol();
      const until = cert?.valid_to ? new Date(cert.valid_to) : null;
      const subject = (cert?.subject as any)?.CN || '';
      sock.destroy();
      resolve(`${proto || 'TLS'}，证书 ${subject}${until ? `，有效期至 ${until.toISOString().slice(0, 10)}` : ''}${!sock.authorized && allowInsecure ? '（未验证）' : ''}`);
    });
    sock.once('error', (e) => { clearTimeout(timer); sock.destroy(); reject(e); });
  });
}

export async function runDiagnosis(input: DiagnoseInput, onProgress: (steps: DiagStep[]) => void, log: Logger): Promise<DiagnosisReport> {
  const ids: DiagStepId[] = [];
  if (input.authType === 'oauth2') ids.push('oauth');
  ids.push('dns', 'tcp', 'tls', 'greeting', 'auth', 'folders');
  if (input.testSmtp !== false) ids.push('smtp-dns', 'smtp-tcp', 'smtp-tls', 'smtp-auth');
  const steps: DiagStep[] = ids.map((id) => ({ id, label: LABELS[id], status: 'pending' }));
  const report: DiagnosisReport = { ok: false, steps, diagnosis: null, serverInfo: {} };
  const step = (id: DiagStepId) => steps.find((s) => s.id === id)!;
  const emit = () => onProgress(steps.map((s) => ({ ...s })));
  let firstError: { err: any; phase: 'imap' | 'smtp' | 'oauth' } | null = null;

  const run = async (id: DiagStepId, fn: () => Promise<string | void>, phase: 'imap' | 'smtp' | 'oauth'): Promise<boolean> => {
    const s = step(id);
    s.status = 'running';
    emit();
    const t0 = Date.now();
    try {
      const detail = await fn();
      s.status = 'ok';
      if (detail) s.detail = detail;
      return true;
    } catch (err: any) {
      s.status = 'fail';
      const d = explainError(err, { phase, server: phase === 'smtp' ? input.smtp : input.imap, providerId: input.providerId, authType: input.authType, email: input.email });
      s.detail = d.title;
      if (!firstError) firstError = { err, phase };
      log.info(`diagnose ${input.email} step ${id} failed: ${err?.code || ''} ${err?.message}`);
      return false;
    } finally {
      s.ms = Date.now() - t0;
      emit();
    }
  };
  const skip = (from: DiagStepId[]) => { for (const id of from) if (step(id).status === 'pending') step(id).status = 'skipped'; emit(); };

  let auth: ImapAuth | null = null;
  if (input.authType === 'oauth2') {
    const ok = await run('oauth', async () => { auth = await input.getAuth(); return '令牌有效'; }, 'oauth');
    if (!ok) {
      skip(ids);
      report.diagnosis = explainError(firstError!.err, { phase: 'oauth', providerId: input.providerId, authType: input.authType });
      return report;
    }
  } else {
    auth = await input.getAuth();
  }

  // ---------------- IMAP ----------------
  const imapSteps: DiagStepId[] = ['dns', 'tcp', 'tls', 'greeting', 'auth', 'folders'];
  let imapOk = await run('dns', async () => {
    const addrs = await dns.lookup(input.imap.host, { all: true });
    return addrs.slice(0, 2).map((a) => a.address).join('、');
  }, 'imap');
  if (imapOk) imapOk = await run('tcp', async () => { await tcpConnect(input.imap.host, input.imap.port, 12_000); return `${input.imap.host}:${input.imap.port}`; }, 'imap');
  if (imapOk && input.imap.security === 'tls') imapOk = await run('tls', () => tlsProbe(input.imap.host, input.imap.port, input.allowInsecureTls, 12_000), 'imap');
  if (imapOk) {
    const client = createImapClient({ server: input.imap, auth: auth!, allowInsecureTls: input.allowInsecureTls, log, label: 'diagnose', timeouts: { connection: 15_000, greeting: 15_000, socket: 60_000 } });
    client.on('error', () => {});
    const greetingStep = step('greeting');
    greetingStep.status = 'running';
    if (input.imap.security !== 'tls') step('tls').status = 'running';
    emit();
    const t0 = Date.now();
    try {
      await client.connect();
      greetingStep.status = 'ok';
      greetingStep.ms = Date.now() - t0;
      greetingStep.detail = (client.greeting || '').replace(/^\*\s*OK\s*/i, '').slice(0, 120) || undefined;
      if (input.imap.security !== 'tls') {
        step('tls').status = client.secureConnection ? 'ok' : input.imap.security === 'none' ? 'warn' : 'ok';
        step('tls').detail = client.secureConnection ? 'STARTTLS 已启用' : '未加密连接（不推荐）';
      }
      step('auth').status = 'ok';
      step('auth').detail = `已登录为 ${input.username}`;
      report.serverInfo!.imapGreeting = client.greeting;
      report.serverInfo!.capabilities = [...client.capabilities.keys()];
      emit();
      await run('folders', async () => {
        const list = await client.list();
        report.serverInfo!.folders = list.length;
        if (!list.some((l) => l.path.toUpperCase() === 'INBOX')) throw new Error('服务器没有返回收件箱 (INBOX)');
        return `共 ${list.length} 个文件夹`;
      }, 'imap');
    } catch (err: any) {
      const authFail = err?.authenticationFailed || err?.serverResponseCode === 'AUTHENTICATIONFAILED' || /auth|login|credential|password/i.test(err?.message || '') && !err?.tlsFailed;
      const tlsFail = err?.tlsFailed || /tls|ssl|certificate|wrong version/i.test(err?.message || '') || ['DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(err?.code);
      if (tlsFail && input.imap.security !== 'tls') {
        greetingStep.status = 'ok';
        step('tls').status = 'fail';
        step('tls').detail = explainError(err, { phase: 'imap', server: input.imap, providerId: input.providerId }).title;
      } else if (authFail) {
        greetingStep.status = 'ok';
        if (step('tls').status === 'running') step('tls').status = 'ok';
        step('auth').status = 'fail';
        step('auth').detail = explainError(err, { phase: 'imap', server: input.imap, providerId: input.providerId, authType: input.authType }).title;
      } else {
        greetingStep.status = 'fail';
        if (step('tls').status === 'running') step('tls').status = 'skipped';
        greetingStep.detail = explainError(err, { phase: 'imap', server: input.imap, providerId: input.providerId }).title;
      }
      greetingStep.ms = Date.now() - t0;
      firstError = firstError || { err, phase: 'imap' };
      imapOk = false;
      emit();
    } finally {
      try { await Promise.race([client.logout(), new Promise((r) => setTimeout(r, 1500))]); } catch { /* ignore */ }
      try { client.close(); } catch { /* ignore */ }
    }
  }
  skip(imapSteps);

  // ---------------- SMTP ----------------
  if (input.testSmtp !== false) {
    let smtpOk = await run('smtp-dns', async () => {
      const addrs = await dns.lookup(input.smtp.host, { all: true });
      return addrs.slice(0, 2).map((a) => a.address).join('、');
    }, 'smtp');
    if (smtpOk) smtpOk = await run('smtp-tcp', async () => { await tcpConnect(input.smtp.host, input.smtp.port, 12_000); return `${input.smtp.host}:${input.smtp.port}`; }, 'smtp');
    if (smtpOk && input.smtp.security === 'tls') smtpOk = await run('smtp-tls', () => tlsProbe(input.smtp.host, input.smtp.port, input.allowInsecureTls, 12_000), 'smtp');
    else if (smtpOk) { step('smtp-tls').status = input.smtp.security === 'none' ? 'warn' : 'ok'; step('smtp-tls').detail = input.smtp.security === 'none' ? '未加密连接（不推荐）' : 'STARTTLS（在身份验证时协商）'; }
    if (smtpOk) {
      await run('smtp-auth', async () => {
        const transport = createTransport({ server: input.smtp, auth: { ...auth!, user: input.smtpUsername || auth!.user }, allowInsecureTls: input.allowInsecureTls });
        try { await transport.verify(); } finally { transport.close(); }
        return '可以发送邮件';
      }, 'smtp');
    }
    skip(['smtp-dns', 'smtp-tcp', 'smtp-tls', 'smtp-auth']);
  }

  const failure = firstError as { err: any; phase: 'imap' | 'smtp' | 'oauth' } | null;
  report.ok = !failure;
  if (failure) {
    report.diagnosis = explainError(failure.err, {
      phase: failure.phase,
      server: failure.phase === 'smtp' ? input.smtp : input.imap,
      providerId: input.providerId,
      authType: input.authType,
      email: input.email
    });
  }
  emit();
  return report;
}
