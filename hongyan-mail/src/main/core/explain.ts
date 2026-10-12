// Turns low-level network / TLS / IMAP / SMTP / OAuth errors into clear, actionable explanations.
import type { AuthType, Diagnosis, ServerConfig } from '../../shared/types';
import { providerById } from './providers';

export interface ErrorContext {
  phase: 'imap' | 'smtp' | 'oauth' | 'send';
  server?: ServerConfig;
  providerId?: string | null;
  authType?: AuthType;
  email?: string;
}

const proto = (ctx: ErrorContext) => (ctx.phase === 'smtp' || ctx.phase === 'send' ? 'SMTP（发信）' : 'IMAP（收信）');
const hostPort = (ctx: ErrorContext) => (ctx.server ? `${ctx.server.host}:${ctx.server.port}` : '服务器');

/** Collects every string we can find on an error (message, server response, nested cause). */
export function errorText(err: any): string {
  const parts: string[] = [];
  const seen = new Set<any>();
  const visit = (e: any, depth: number) => {
    if (!e || depth > 3 || seen.has(e)) return;
    seen.add(e);
    if (typeof e === 'string') { parts.push(e); return; }
    for (const k of ['message', 'response', 'responseText', 'reason', 'serverResponseCode', 'code', 'command']) {
      const v = e[k];
      if (typeof v === 'string' && v) parts.push(v);
      else if (v && typeof v === 'object' && k === 'response' && typeof v.toString === 'function') {
        try { parts.push(JSON.stringify(v).slice(0, 500)); } catch { /* ignore */ }
      }
    }
    if (e.oauthError) parts.push(typeof e.oauthError === 'string' ? e.oauthError : JSON.stringify(e.oauthError));
    visit(e.cause, depth + 1);
    visit(e._err, depth + 1);
  };
  visit(err, 0);
  return [...new Set(parts)].join(' | ');
}

function technical(err: any): string {
  const code = err?.code ? `[${err.code}] ` : '';
  const respCode = err?.responseCode ? `(${err.responseCode}) ` : '';
  return (code + respCode + errorText(err)).slice(0, 1200);
}

const has = (text: string, ...needles: (string | RegExp)[]) =>
  needles.some((n) => (typeof n === 'string' ? text.toLowerCase().includes(n.toLowerCase()) : n.test(text)));

function authAdvice(ctx: ErrorContext, text: string): Diagnosis {
  const p = providerById(ctx.providerId);
  const pid = ctx.providerId || '';
  const base: Diagnosis = {
    kind: 'auth',
    title: '用户名或密码被服务器拒绝',
    explanation: `${proto(ctx)}服务器拒绝了登录请求。`,
    suggestions: [],
    technical: text,
    needsUserAction: true,
    helpUrl: p?.helpUrl
  };

  if (ctx.authType === 'oauth2') {
    return {
      ...base,
      kind: 'oauth-rejected',
      title: 'OAuth2 授权已失效或权限不足',
      explanation: '服务器不接受当前的访问令牌，可能是授权已被撤销、已过期，或者授权时没有包含邮件读写权限。',
      suggestions: ['在账户设置中点击「重新授权」，用浏览器重新登录一次。', '如果是工作/学校账户，请确认管理员允许 IMAP / SMTP 访问。']
    };
  }

  if (pid === 'gmail' || has(text, 'application-specific password', 'apppasswords', '534-5.7.9', 'web browser and then try again', 'WEBALERT')) {
    if (has(text, 'not enabled for imap', 'IMAP access is disabled')) {
      return { ...base, kind: 'imap-disabled', title: 'Gmail 未开启 IMAP', explanation: '该 Gmail 账户关闭了 IMAP 访问。', suggestions: ['在 Gmail 网页版 → 设置 → 查看所有设置 → 转发和 POP/IMAP 中启用 IMAP，保存后重试。'] };
    }
    return {
      ...base,
      title: 'Gmail 需要应用专用密码',
      explanation: 'Google 不允许第三方客户端直接使用 Google 账号密码登录。',
      suggestions: [
        '为 Google 账号开启「两步验证」。',
        '打开 myaccount.google.com/apppasswords 创建一个应用专用密码（16 位，可去掉空格），用它代替密码。',
        '或者改用「使用 Google 账号登录 (OAuth2)」。'
      ],
      helpUrl: 'https://myaccount.google.com/apppasswords'
    };
  }
  if (pid === 'outlook' || pid === 'office365' || has(text, 'basicauthblocked', 'basic authentication is disabled', '5.7.139', 'SmtpClientAuthentication')) {
    if (has(text, 'SmtpClientAuthentication is disabled')) {
      return { ...base, kind: 'smtp-auth-disabled', title: '组织关闭了 SMTP 身份验证', explanation: '该 Microsoft 365 租户禁用了 SMTP AUTH，无法通过客户端发信。', suggestions: ['请联系管理员为你的邮箱启用「经过身份验证的 SMTP」。'] };
    }
    return {
      ...base,
      kind: 'oauth-required',
      title: 'Outlook 需要使用 Microsoft 账号登录',
      explanation: 'Microsoft 已停止支持用密码（基本身份验证）登录 Outlook / Hotmail / Microsoft 365 的 IMAP 和 SMTP。',
      suggestions: ['删除此账户后重新添加，选择「使用 Microsoft 账号登录 (OAuth2)」。', '使用 OAuth2 前需要在 设置 → OAuth 中填写 Azure 应用的客户端 ID（设置页面有详细步骤）。']
    };
  }
  if (pid === 'qq' || has(text, 'authorized code', 'authorization code', 'help.mail.qq.com', 'service.mail.qq.com')) {
    return {
      ...base,
      title: 'QQ 邮箱需要授权码',
      explanation: 'QQ 邮箱拒绝了登录。常见原因：使用了 QQ 密码而不是授权码、IMAP/SMTP 服务未开启，或授权码已失效。',
      suggestions: [
        '登录 mail.qq.com → 设置 → 账号与安全，确认已开启「IMAP/SMTP 服务」。',
        '重新生成一个 16 位授权码并填写（授权码中不要有空格）。',
        '如果最近频繁尝试，QQ 可能暂时限制登录，请等待几分钟后再试。'
      ]
    };
  }
  if (/^(netease|vip1|yeah|qiye163)/.test(pid) || has(text, 'Unsafe Login', 'kefu@188.com', 'ERR.LOGIN', 'mail.163.com')) {
    if (has(text, 'Unsafe Login')) {
      return { ...base, kind: 'netease-unsafe', title: '网易邮箱判定为不安全登录', explanation: '网易要求客户端使用授权码登录，并在登录后表明身份。', suggestions: ['确认已开启 IMAP/SMTP 服务并使用授权码。', '在网页版登录一次邮箱解除风控后重试。'] };
    }
    return {
      ...base,
      title: '网易邮箱需要授权码',
      explanation: '网易邮箱拒绝了登录。常见原因：使用了网页登录密码而不是「授权码」，或尚未开启 IMAP/SMTP 服务。',
      suggestions: ['登录网易邮箱网页版 → 设置 → POP3/SMTP/IMAP，开启「IMAP/SMTP 服务」。', '获取新的授权码并填写在密码栏中。']
    };
  }
  if (pid.startsWith('gmx') || pid === 'webde' || pid === 'mailcom') {
    return {
      ...base,
      title: `${p?.name || 'GMX'} 拒绝了登录`,
      explanation: '密码错误，或者尚未在网页版中允许 POP3/IMAP 访问（GMX 默认关闭）。',
      suggestions: ['登录网页版，在 设置 → POP3 & IMAP 中勾选允许访问并保存。', '确认密码正确；若开启了两步验证，请使用应用专用密码。']
    };
  }
  if (p && (p.auth === 'app-password' || p.auth === 'authorization-code')) {
    return {
      ...base,
      title: `${p.name} 需要${p.passwordLabel}`,
      explanation: `${p.name} 拒绝了登录。该服务商要求使用「${p.passwordLabel}」而不是普通登录密码。`,
      suggestions: [...p.help, '确认填写时没有多余的空格。']
    };
  }
  return {
    ...base,
    suggestions: [
      '检查用户名（通常是完整邮箱地址）和密码是否正确。',
      '确认已在邮箱网页版设置中开启 IMAP / SMTP 服务。',
      '很多服务商要求使用「授权码」或「应用专用密码」代替登录密码。'
    ]
  };
}

export function explainError(err: any, ctx: ErrorContext): Diagnosis {
  const text = technical(err);
  const msg = errorText(err);
  // nodemailer wraps socket failures (ESOCKET / EDNS / ECONNECTION); recover Node's own code from the message.
  let code: string = String(err?.code || '');
  if (!code || ['ESOCKET', 'ECONNECTION', 'EDNS', 'ETLS', 'EPROTOCOL'].includes(code)) {
    const m = /\b(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ENETDOWN|EPIPE|EADDRNOTAVAIL|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN)\b/.exec(msg);
    if (m) code = m[1];
  }
  const where = hostPort(ctx);
  const sec = ctx.server?.security;

  // ---- OAuth flow errors
  if (ctx.phase === 'oauth') {
    if (has(msg, 'client id', 'clientId', '未配置')) {
      return { kind: 'oauth-config', title: '尚未配置 OAuth 客户端', explanation: msg, suggestions: ['打开 设置 → OAuth，按页面说明填写客户端 ID 后重试。'], technical: text, needsUserAction: true };
    }
    if (has(msg, 'access_denied', 'cancel', '取消')) {
      return { kind: 'oauth-cancelled', title: '授权已取消', explanation: '浏览器中的授权没有完成。', suggestions: ['重新点击登录按钮，在浏览器中允许访问邮件。'], technical: text, needsUserAction: true };
    }
    if (has(msg, 'invalid_client', 'unauthorized_client', 'AADSTS700016', 'AADSTS7000218')) {
      return { kind: 'oauth-client', title: 'OAuth 客户端配置有误', explanation: '服务商不认可当前填写的客户端 ID / 密钥，或应用的平台类型不正确。', suggestions: ['检查 设置 → OAuth 中的客户端 ID 与密钥。', 'Google 需选择「桌面应用」类型；Microsoft 需在「移动和桌面应用程序」平台中添加重定向 URI http://localhost 并允许公共客户端流。'], technical: text, needsUserAction: true };
    }
    if (has(msg, 'redirect_uri')) {
      return { kind: 'oauth-redirect', title: '重定向地址不被接受', explanation: '服务商拒绝了本地回调地址。', suggestions: ['Microsoft：在应用注册 → 身份验证 → 移动和桌面应用程序 中添加 http://localhost。', 'Google：请使用「桌面应用」类型的 OAuth 客户端。'], technical: text, needsUserAction: true };
    }
    if (has(msg, 'timeout', '超时')) {
      return { kind: 'oauth-timeout', title: '等待授权超时', explanation: '在规定时间内没有收到浏览器的授权结果。', suggestions: ['重新尝试，并在浏览器中尽快完成登录。'], technical: text, needsUserAction: true };
    }
    return { kind: 'oauth', title: 'OAuth2 登录失败', explanation: msg || '授权过程中发生错误。', suggestions: ['检查网络连接后重试。', '确认 设置 → OAuth 中的客户端配置正确。'], technical: text, needsUserAction: true };
  }

  // ---- DNS
  if (code === 'ENOTFOUND' || has(msg, 'getaddrinfo ENOTFOUND')) {
    return { kind: 'dns', title: '找不到服务器', explanation: `无法解析服务器地址「${ctx.server?.host || ''}」。`, suggestions: ['检查服务器地址是否拼写正确。', '检查网络连接；如使用代理或公司网络，请确认 DNS 可用。'], technical: text, needsUserAction: true };
  }
  if (code === 'EAI_AGAIN') {
    return { kind: 'dns-temp', title: '域名解析暂时失败', explanation: '当前无法访问 DNS 服务器，通常是网络断开或不稳定。', suggestions: ['检查网络连接后重试。'], technical: text, needsUserAction: false };
  }
  // ---- network reachability
  if (['ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN', 'EADDRNOTAVAIL'].includes(code)) {
    return { kind: 'network', title: '网络不可用', explanation: `无法访问 ${where}，电脑当前可能没有联网。`, suggestions: ['检查网络连接、VPN 或代理设置。'], technical: text, needsUserAction: false };
  }
  if (code === 'ECONNREFUSED') {
    return {
      kind: 'refused',
      title: '服务器拒绝连接',
      explanation: `${where} 没有在该端口提供服务。`,
      suggestions: [
        ctx.phase === 'imap' ? 'IMAP 常用端口：993（SSL/TLS）或 143（STARTTLS）。' : 'SMTP 常用端口：465（SSL/TLS）或 587（STARTTLS）。',
        '检查服务器地址与端口；确认邮箱服务商提供该服务。',
        '防火墙或安全软件也可能阻止连接。'
      ],
      technical: text,
      needsUserAction: true
    };
  }
  if (['ETIMEDOUT', 'CONNECT_TIMEOUT', 'GREETING_TIMEOUT', 'ESOCKETTIMEDOUT', 'ETIMEOUT', 'UPGRADE_TIMEOUT'].includes(code) || has(msg, 'timed out', 'timeout')) {
    if (code === 'GREETING_TIMEOUT' || has(msg, 'greeting')) {
      return { kind: 'greeting-timeout', title: '服务器无响应', explanation: `已连上 ${where}，但服务器没有发送欢迎信息。通常是加密方式选择错误。`, suggestions: [sec === 'tls' ? '尝试将加密方式改为 STARTTLS。' : '尝试将加密方式改为 SSL/TLS。', '确认端口与加密方式匹配：993/465 对应 SSL/TLS，143/587 对应 STARTTLS。'], technical: text, needsUserAction: true };
    }
    return { kind: 'timeout', title: '连接超时', explanation: `连接 ${where} 超时。`, suggestions: ['检查网络是否通畅，稍后重试。', '公司网络、校园网或防火墙可能屏蔽了邮件端口，可尝试更换网络或端口。', '如使用代理/VPN，请确认其允许该连接。'], technical: text, needsUserAction: false };
  }
  // ---- TLS
  if (has(msg, 'wrong version number', 'WRONG_VERSION_NUMBER', 'packet length too long', 'unknown protocol', 'ssl3_get_record', 'http request')) {
    return { kind: 'tls-mismatch', title: '加密方式与端口不匹配', explanation: `${where} 不是 SSL/TLS 端口，或加密方式设置错误。`, suggestions: ['端口 993 / 465 使用「SSL/TLS」；端口 143 / 587 使用「STARTTLS」。', '修改后再次测试连接。'], technical: text, needsUserAction: true };
  }
  if (code === 'CERT_HAS_EXPIRED' || has(msg, 'certificate has expired')) {
    return { kind: 'tls-expired', title: '服务器证书已过期', explanation: `${where} 的安全证书已过期，连接可能不安全。`, suggestions: ['检查电脑的日期和时间是否正确。', '联系邮箱服务商；如确认安全，可在账户高级设置中允许不受信任的证书。'], technical: text, needsUserAction: true };
  }
  if (['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_GET_ISSUER_CERT', 'CERT_UNTRUSTED'].includes(code) || has(msg, 'self-signed certificate', 'self signed certificate', 'unable to verify the first certificate')) {
    return {
      kind: 'tls-untrusted',
      title: '无法验证服务器证书',
      explanation: `${where} 使用的证书不受信任（自签名或证书链不完整）。`,
      suggestions: [
        '杀毒软件的「HTTPS/邮件扫描」或公司代理会替换证书，可尝试关闭该功能。',
        '如果这是你信任的私有服务器（例如 Proton Bridge），可在账户高级设置中勾选「允许不受信任的证书」。'
      ],
      technical: text,
      needsUserAction: true
    };
  }
  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID' || has(msg, "Hostname/IP does not match", 'altnames')) {
    return { kind: 'tls-hostname', title: '证书与服务器地址不符', explanation: `${where} 提供的证书不属于这个主机名。`, suggestions: ['请使用服务商公布的官方服务器地址（而不是别名或 IP）。'], technical: text, needsUserAction: true };
  }
  if (err?.tlsFailed || has(msg, 'STARTTLS', 'ssl routines', 'tls')) {
    if (has(msg, 'does not support STARTTLS', 'STARTTLS not supported', "doesn't support STARTTLS")) {
      return { kind: 'starttls-missing', title: '服务器不支持 STARTTLS', explanation: `${where} 不提供 STARTTLS 加密。`, suggestions: ['改用 SSL/TLS 端口（IMAP 993 / SMTP 465）。'], technical: text, needsUserAction: true };
    }
    return { kind: 'tls', title: '建立加密连接失败', explanation: `与 ${where} 协商 TLS 加密时失败。`, suggestions: ['确认端口与加密方式匹配。', '检查安全软件或代理是否拦截了加密连接。'], technical: text, needsUserAction: true };
  }
  // ---- throttling
  // (QQ lists "login frequency limited" among the possible causes of every failed login, so a definite
  // authentication failure is not treated as throttling.)
  const authFailed = !!(err?.authenticationFailed || err?.serverResponseCode === 'AUTHENTICATIONFAILED' || code === 'EAUTH');
  if (code === 'ETHROTTLE' || (!authFailed && has(msg, 'too many login', 'login frequency', 'rate limit', 'Too many simultaneous connections', 'try again later', '[UNAVAILABLE]'))) {
    return { kind: 'throttled', title: '服务器暂时限制了访问', explanation: '登录或请求过于频繁，服务器暂时拒绝了连接。', suggestions: ['等待几分钟后再试。', '关闭其他同时连接此邮箱的客户端。'], technical: text, needsUserAction: false };
  }
  // ---- IMAP disabled
  if (has(msg, 'IMAP access is disabled', 'IMAP use is disabled', 'not enabled for IMAP', 'IMAP service is not', 'IMAP is disabled', 'IMAP服务未开启', 'imapdisabled')) {
    const p = providerById(ctx.providerId);
    return { kind: 'imap-disabled', title: '邮箱尚未开启 IMAP 服务', explanation: '服务器表示该账户没有开启 IMAP 访问。', suggestions: p?.help.length ? p.help : ['登录邮箱网页版，在设置中开启 IMAP / SMTP 服务。'], technical: text, needsUserAction: true, helpUrl: p?.helpUrl };
  }
  // ---- authentication
  if (err?.authenticationFailed || code === 'EAUTH' || err?.serverResponseCode === 'AUTHENTICATIONFAILED' || err?.responseCode === 535 || err?.responseCode === 534 ||
      has(msg, 'AUTHENTICATIONFAILED', 'Invalid credentials', 'authentication failed', 'LOGIN failed', 'Login fail', 'password error', 'Incorrect username or password', 'AUTHENTICATE failed')) {
    return authAdvice(ctx, text);
  }
  // ---- SMTP specific
  if (ctx.phase === 'send' || ctx.phase === 'smtp') {
    const rc = Number(err?.responseCode || 0);
    if (code === 'EENVELOPE' && has(msg, 'No recipients')) {
      return { kind: 'no-recipients', title: '没有收件人', explanation: '请至少填写一个收件人。', suggestions: [], technical: text, needsUserAction: true };
    }
    if (has(msg, 'Mail from address must be same', 'Sender address rejected', 'not owned by user', 'SendAsDenied', 'sender is not authorized')) {
      return { kind: 'sender-mismatch', title: '发件人地址不被允许', explanation: '服务器要求发件人地址与登录账户一致。', suggestions: ['使用该账户自己的邮箱地址作为发件人。'], technical: text, needsUserAction: true };
    }
    if (rc === 552 || has(msg, 'message size', 'too large', 'exceeds', 'size limit')) {
      return { kind: 'too-large', title: '邮件过大', explanation: '邮件（含附件）超过了服务器允许的大小。', suggestions: ['减少或压缩附件，大文件建议改用网盘链接。'], technical: text, needsUserAction: true };
    }
    if (has(msg, 'DT:SPM', 'spam', 'content rejected', 'message rejected')) {
      return { kind: 'spam-rejected', title: '邮件被判定为垃圾邮件', explanation: '服务器因内容原因拒绝投递这封邮件。', suggestions: ['修改标题或正文（避免过多链接、营销字样），然后重试。'], technical: text, needsUserAction: true };
    }
    if (has(msg, 'quota exceeded', 'sending limit', 'daily user sending', 'exceeded the limit')) {
      return { kind: 'send-quota', title: '已超出发送限额', explanation: '账户在一段时间内发送的邮件数量超过了服务商限制。', suggestions: ['等待一段时间（通常 24 小时内）后重试。'], technical: text, needsUserAction: false };
    }
    if (rc === 550 || rc === 553 || has(msg, 'User unknown', 'mailbox unavailable', 'Recipient address rejected', 'does not exist', 'no such user')) {
      return { kind: 'recipient', title: '收件人地址被拒绝', explanation: '服务器不接受其中一个或多个收件人地址。', suggestions: ['检查收件人地址是否拼写正确。'], technical: text, needsUserAction: true };
    }
    if (rc >= 400 && rc < 500) {
      return { kind: 'smtp-temp', title: '服务器暂时无法发送', explanation: `发信服务器返回临时错误（${rc}）。`, suggestions: ['稍后重试，邮件会保留在发件箱中。'], technical: text, needsUserAction: false };
    }
  }
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'EConnectionClosed' || code === 'NoConnection' || has(msg, 'Connection closed', 'socket hang up', 'Unexpected close')) {
    return {
      kind: 'reset',
      title: '连接被中断',
      explanation: `与 ${where} 的连接被意外关闭。`,
      suggestions: ['可能是网络不稳定，稍后会自动重试。', '若每次都失败，请检查端口与加密方式是否匹配（993/465 用 SSL/TLS，143/587 用 STARTTLS）。'],
      technical: text,
      needsUserAction: false
    };
  }
  if (code === 'NotFound' || err?.mailboxMissing) {
    return { kind: 'mailbox-missing', title: '文件夹不存在', explanation: '服务器上找不到该文件夹，它可能已在其他设备上被删除或重命名。', suggestions: ['刷新账户以更新文件夹列表。'], technical: text, needsUserAction: false };
  }
  return {
    kind: 'unknown',
    title: ctx.phase === 'send' ? '发送失败' : '连接失败',
    explanation: msg ? `服务器返回：${msg.slice(0, 300)}` : '发生了未知错误。',
    suggestions: ['稍后重试；如果问题持续，请在「诊断」中复制报告查看详细信息。'],
    technical: text,
    needsUserAction: false
  };
}

/** Errors for which retrying automatically is pointless until the user changes something. */
export function isPermanent(d: Diagnosis): boolean {
  return d.needsUserAction;
}
