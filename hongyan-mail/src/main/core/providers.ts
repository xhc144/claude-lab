// Built-in knowledge of mainstream mail services: servers, sign-in method and how to enable IMAP.
import type { ProviderInfo, ServerConfig } from '../../shared/types';

const tls = (host: string, port = 993): ServerConfig => ({ host, port, security: 'tls' });
const starttls = (host: string, port = 587): ServerConfig => ({ host, port, security: 'starttls' });

type Def = Omit<ProviderInfo, 'id'> & { domains?: string[] };

const NETEASE_HELP = (site: string) => [
  `登录 ${site} 网页版 → 设置 → POP3/SMTP/IMAP，开启「IMAP/SMTP 服务」。`,
  '按页面提示（通常需手机验证）获取「授权码」，在下方填写授权码，而不是邮箱登录密码。'
];

const DEFS: Record<string, Def> = {
  gmail: {
    name: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    imap: tls('imap.gmail.com'),
    smtp: tls('smtp.gmail.com', 465),
    auth: 'app-password',
    oauth: 'google',
    usernameStyle: 'email',
    passwordLabel: '应用专用密码',
    help: [
      '方式一：为 Google 账号开启「两步验证」，然后在 myaccount.google.com/apppasswords 创建 16 位「应用专用密码」，填写在下方。',
      '方式二：点击「使用 Google 账号登录」，在浏览器中完成 OAuth2 授权（需先在 设置 → OAuth 中配置客户端 ID）。',
      'IMAP 在 Gmail 中默认开启，如被关闭，请在 Gmail 网页版 设置 → 转发和 POP/IMAP 中启用。'
    ],
    helpUrl: 'https://myaccount.google.com/apppasswords',
    quirks: { gmail: true, smtpSavesSent: true }
  },
  outlook: {
    name: 'Outlook.com',
    imap: tls('outlook.office365.com'),
    smtp: starttls('smtp-mail.outlook.com'),
    auth: 'oauth-required',
    oauth: 'microsoft',
    usernameStyle: 'email',
    passwordLabel: '密码',
    help: [
      'Microsoft 已停止个人 Outlook.com / Hotmail / Live 账户的密码（基本身份验证）登录第三方客户端。',
      '请点击「使用 Microsoft 账号登录」，在浏览器中完成 OAuth2 授权（需先在 设置 → OAuth 中配置客户端 ID）。'
    ],
    helpUrl: 'https://support.microsoft.com/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040',
    quirks: { smtpSavesSent: true }
  },
  office365: {
    name: 'Microsoft 365',
    imap: tls('outlook.office365.com'),
    smtp: starttls('smtp.office365.com'),
    auth: 'oauth-required',
    oauth: 'microsoft',
    usernameStyle: 'email',
    passwordLabel: '密码',
    help: [
      '工作或学校的 Microsoft 365 账户需要使用 OAuth2 登录，请点击「使用 Microsoft 账号登录」。',
      '如果登录后仍被拒绝，可能是组织管理员关闭了 IMAP / SMTP AUTH，请联系管理员开启。'
    ],
    quirks: { smtpSavesSent: true }
  },
  qq: {
    name: 'QQ 邮箱',
    domains: ['qq.com', 'vip.qq.com', 'foxmail.com'],
    imap: tls('imap.qq.com'),
    smtp: tls('smtp.qq.com', 465),
    auth: 'authorization-code',
    usernameStyle: 'email',
    passwordLabel: '授权码',
    help: [
      'QQ 邮箱不能用 QQ 密码登录第三方客户端，需要使用「授权码」。',
      '登录 mail.qq.com → 设置 → 账号与安全（或 账户）→ 开启「IMAP/SMTP 服务」，按提示用手机验证后获得 16 位授权码，填写在下方。'
    ],
    helpUrl: 'https://service.mail.qq.com/detail/0/75'
  },
  exmail: {
    name: '腾讯企业邮箱',
    domains: ['exmail.qq.com'],
    imap: tls('imap.exmail.qq.com'),
    smtp: tls('smtp.exmail.qq.com', 465),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码 / 客户端专用密码',
    help: [
      '一般使用企业邮箱登录密码即可。',
      '若开启了「安全登录」（微信动态密码），请在网页版 设置 → 微信绑定 → 安全登录 中生成「客户端专用密码」后填写。',
      '若提示 IMAP 未开启，请在 设置 → 收发信设置 中开启 IMAP/SMTP 服务。'
    ]
  },
  netease163: { name: '网易 163 邮箱', domains: ['163.com'], imap: tls('imap.163.com'), smtp: tls('smtp.163.com', 465), auth: 'authorization-code', usernameStyle: 'email', passwordLabel: '授权码', help: NETEASE_HELP('mail.163.com'), helpUrl: 'https://help.mail.163.com/' },
  netease126: { name: '网易 126 邮箱', domains: ['126.com'], imap: tls('imap.126.com'), smtp: tls('smtp.126.com', 465), auth: 'authorization-code', usernameStyle: 'email', passwordLabel: '授权码', help: NETEASE_HELP('mail.126.com') },
  yeah: { name: '网易 Yeah 邮箱', domains: ['yeah.net'], imap: tls('imap.yeah.net'), smtp: tls('smtp.yeah.net', 465), auth: 'authorization-code', usernameStyle: 'email', passwordLabel: '授权码', help: NETEASE_HELP('mail.yeah.net') },
  netease188: { name: '网易 188 财富邮', domains: ['188.com'], imap: tls('imap.188.com'), smtp: tls('smtp.188.com', 465), auth: 'authorization-code', usernameStyle: 'email', passwordLabel: '授权码', help: NETEASE_HELP('188.com') },
  vip163: { name: '网易 VIP 邮箱', domains: ['vip.163.com'], imap: tls('imap.vip.163.com'), smtp: tls('smtp.vip.163.com', 465), auth: 'authorization-code', usernameStyle: 'email', passwordLabel: '授权码', help: NETEASE_HELP('vip.163.com') },
  vip126: { name: '网易 VIP 邮箱', domains: ['vip.126.com'], imap: tls('imap.vip.126.com'), smtp: tls('smtp.vip.126.com', 465), auth: 'authorization-code', usernameStyle: 'email', passwordLabel: '授权码', help: NETEASE_HELP('vip.126.com') },
  qiye163: {
    name: '网易企业邮箱',
    imap: tls('imap.qiye.163.com'),
    smtp: tls('smtp.qiye.163.com', 465),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码 / 客户端授权密码',
    help: ['一般使用企业邮箱密码即可；若管理员开启了客户端授权密码，请在网页版 设置 → 客户端授权密码 中生成后填写。']
  },
  gmx_com: {
    name: 'GMX',
    domains: ['gmx.com', 'gmx.us', 'gmx.co.uk', 'gmx.fr', 'gmx.es', 'gmx.ca', 'gmx.it', 'gmx.info', 'gmx.tm', 'gmx.sg', 'gmx.ph', 'gmx.cn'],
    imap: tls('imap.gmx.com'),
    smtp: starttls('mail.gmx.com'),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码',
    help: [
      'GMX 默认关闭 IMAP：请登录 GMX 网页版 → E-mail Settings → POP3 & IMAP，勾选「Allow access via POP3 and IMAP」并保存。',
      '然后使用 GMX 登录密码；若开启了两步验证，请改用应用专用密码（Application-specific password）。'
    ],
    helpUrl: 'https://support.gmx.com/pop-imap/toggle.html'
  },
  gmx_net: {
    name: 'GMX',
    domains: ['gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch', 'gmx.li', 'gmx.eu'],
    imap: tls('imap.gmx.net'),
    smtp: starttls('mail.gmx.net'),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码',
    help: [
      'GMX 默认关闭 IMAP：请登录 GMX 网页版 → E-Mail → Einstellungen → POP3/IMAP Abruf，勾选「POP3 und IMAP Zugriff erlauben」。',
      '然后使用 GMX 登录密码；若开启了两步验证，请改用应用专用密码。'
    ],
    helpUrl: 'https://hilfe.gmx.net/pop-imap/einschalten.html'
  },
  webde: {
    name: 'WEB.DE',
    domains: ['web.de'],
    imap: tls('imap.web.de'),
    smtp: starttls('smtp.web.de'),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码',
    help: ['请先在 WEB.DE 网页版 → Einstellungen → POP3/IMAP Abruf 中允许 IMAP 访问。']
  },
  mailcom: {
    name: 'mail.com',
    domains: ['mail.com', 'email.com', 'usa.com', 'post.com', 'europe.com', 'consultant.com', 'engineer.com'],
    imap: tls('imap.mail.com'),
    smtp: starttls('smtp.mail.com'),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码',
    help: ['请先在 mail.com 网页版设置中开启 POP3 & IMAP 访问。']
  },
  yahoo: {
    name: 'Yahoo Mail',
    domains: ['yahoo.com', 'ymail.com', 'rocketmail.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.it', 'yahoo.es', 'yahoo.ca', 'yahoo.com.au', 'yahoo.co.in', 'yahoo.com.hk', 'yahoo.com.tw', 'yahoo.com.sg'],
    imap: tls('imap.mail.yahoo.com'),
    smtp: tls('smtp.mail.yahoo.com', 465),
    auth: 'app-password',
    usernameStyle: 'email',
    passwordLabel: '应用专用密码',
    help: ['Yahoo 需要「应用专用密码」：登录 Yahoo → 账户信息 → 账户安全 → 生成应用密码，填写在下方。'],
    helpUrl: 'https://login.yahoo.com/myaccount/security/app-password'
  },
  aol: {
    name: 'AOL Mail',
    domains: ['aol.com', 'aim.com'],
    imap: tls('imap.aol.com'),
    smtp: tls('smtp.aol.com', 465),
    auth: 'app-password',
    usernameStyle: 'email',
    passwordLabel: '应用专用密码',
    help: ['AOL 需要「应用专用密码」：在 AOL 账户安全设置中生成应用密码后填写。']
  },
  icloud: {
    name: 'iCloud 邮件',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    imap: tls('imap.mail.me.com'),
    smtp: starttls('smtp.mail.me.com'),
    auth: 'app-password',
    usernameStyle: 'email',
    passwordLabel: 'App 专用密码',
    help: ['登录 appleid.apple.com → 登录与安全 → App 专用密码，生成后填写在下方（需已开启双重认证）。'],
    helpUrl: 'https://appleid.apple.com/account/manage'
  },
  zoho: {
    name: 'Zoho Mail',
    domains: ['zoho.com', 'zohomail.com'],
    imap: tls('imap.zoho.com'),
    smtp: tls('smtp.zoho.com', 465),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码 / 应用专用密码',
    help: ['请在 Zoho Mail 设置 → Mail Accounts → IMAP Access 中开启 IMAP；若开启了两步验证，请使用应用专用密码。']
  },
  zohocn: {
    name: 'Zoho Mail 中国',
    domains: ['zoho.com.cn'],
    imap: tls('imap.zoho.com.cn'),
    smtp: tls('smtp.zoho.com.cn', 465),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码 / 应用专用密码',
    help: ['请在 Zoho Mail 设置中开启 IMAP 访问；若开启了两步验证，请使用应用专用密码。']
  },
  yandex: {
    name: 'Yandex Mail',
    domains: ['yandex.com', 'yandex.ru', 'ya.ru', 'yandex.by', 'yandex.kz'],
    imap: tls('imap.yandex.com'),
    smtp: tls('smtp.yandex.com', 465),
    auth: 'app-password',
    usernameStyle: 'email',
    passwordLabel: '应用密码',
    help: ['请在 Yandex ID → 安全 → 应用密码 中创建「邮件」类应用密码，并在邮箱设置中允许 IMAP 客户端访问。']
  },
  mailru: {
    name: 'Mail.ru',
    domains: ['mail.ru', 'inbox.ru', 'list.ru', 'bk.ru'],
    imap: tls('imap.mail.ru'),
    smtp: tls('smtp.mail.ru', 465),
    auth: 'app-password',
    usernameStyle: 'email',
    passwordLabel: '外部应用密码',
    help: ['请在 Mail.ru 账户设置 → 安全 → 外部应用密码 中生成密码后填写。']
  },
  fastmail: {
    name: 'Fastmail',
    domains: ['fastmail.com', 'fastmail.fm', 'fastmail.cn'],
    imap: tls('imap.fastmail.com'),
    smtp: tls('smtp.fastmail.com', 465),
    auth: 'app-password',
    usernameStyle: 'email',
    passwordLabel: '应用密码',
    help: ['请在 Fastmail 设置 → 隐私与安全 → 应用密码 中生成 IMAP/SMTP 应用密码。']
  },
  proton: {
    name: 'Proton Mail (Bridge)',
    domains: ['proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me'],
    imap: starttls('127.0.0.1', 1143),
    smtp: starttls('127.0.0.1', 1025),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: 'Bridge 密码',
    help: [
      'Proton Mail 只能通过官方「Proton Mail Bridge」使用 IMAP。请先安装并登录 Bridge。',
      '在 Bridge 中查看本地 IMAP/SMTP 端口与「Bridge 密码」，填写在下方；并在高级设置中允许 Bridge 的自签名证书。'
    ],
    helpUrl: 'https://proton.me/mail/bridge'
  },
  sina: {
    name: '新浪邮箱',
    domains: ['sina.com', 'sina.cn', 'vip.sina.com', 'sina.com.cn'],
    imap: tls('imap.sina.com'),
    smtp: tls('smtp.sina.com', 465),
    auth: 'authorization-code',
    usernameStyle: 'email',
    passwordLabel: '授权码',
    help: ['登录新浪邮箱网页版 → 设置 → 客户端 POP/IMAP/SMTP，开启 IMAP 服务并获取授权码后填写。']
  },
  sohu: {
    name: '搜狐邮箱',
    domains: ['sohu.com', 'vip.sohu.com'],
    imap: tls('imap.sohu.com'),
    smtp: tls('smtp.sohu.com', 465),
    auth: 'authorization-code',
    usernameStyle: 'email',
    passwordLabel: '独立密码 / 授权码',
    help: ['登录搜狐邮箱网页版 → 选项 → 设置 → POP3/SMTP/IMAP，开启服务并设置独立密码后填写。']
  },
  aliyun: {
    name: '阿里邮箱',
    domains: ['aliyun.com', 'alibaba-inc.com'],
    imap: tls('imap.aliyun.com'),
    smtp: tls('smtp.aliyun.com', 465),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码',
    help: ['请在阿里邮箱网页版 设置 → 账户 → POP3/SMTP 和 IMAP/SMTP 中开启 IMAP 服务。']
  },
  alimail: {
    name: '阿里企业邮箱',
    imap: tls('imap.qiye.aliyun.com'),
    smtp: tls('smtp.qiye.aliyun.com', 465),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码 / 三方客户端安全密码',
    help: ['如管理员开启了「三方客户端安全密码」，请在网页版 设置 → 账户与安全 中生成后填写。']
  },
  china139: {
    name: '139 邮箱',
    domains: ['139.com'],
    imap: tls('imap.139.com'),
    smtp: tls('smtp.139.com', 465),
    auth: 'authorization-code',
    usernameStyle: 'email',
    passwordLabel: '授权码',
    help: ['登录 139 邮箱网页版 → 设置 → 客户端设置，开启 IMAP/SMTP 服务并获取授权码后填写。']
  },
  china189: {
    name: '189 邮箱',
    domains: ['189.cn'],
    imap: tls('imap.189.cn'),
    smtp: tls('smtp.189.cn', 465),
    auth: 'authorization-code',
    usernameStyle: 'email',
    passwordLabel: '授权码 / 密码',
    help: ['登录 189 邮箱网页版 → 设置 → 客户端设置 中开启 IMAP 服务。']
  },
  naver: {
    name: 'Naver Mail',
    domains: ['naver.com'],
    imap: tls('imap.naver.com'),
    smtp: tls('smtp.naver.com', 465),
    auth: 'password',
    usernameStyle: 'local',
    passwordLabel: '密码 / 应用密码',
    help: ['请在 Naver Mail 环境设置 → POP3/IMAP 设置 中启用 IMAP。']
  },
  godaddy: {
    name: 'GoDaddy Workspace',
    imap: tls('imap.secureserver.net'),
    smtp: tls('smtpout.secureserver.net', 465),
    auth: 'password',
    usernameStyle: 'email',
    passwordLabel: '密码',
    help: []
  }
};

/** Domain suffix patterns that are not plain lists (e.g. hotmail.co.uk, live.cn). */
const DOMAIN_PATTERNS: Array<[RegExp, string]> = [
  [/^(outlook|hotmail|live|msn|windowslive|passport)\.[a-z.]+$/, 'outlook'],
  [/^gmx\.[a-z.]+$/, 'gmx_com']
];

const MX_PATTERNS: Array<[RegExp, string, string]> = [
  [/(^|\.)(google|googlemail)\.com$/i, 'gmail', 'Google Workspace'],
  [/\.olc\.protection\.outlook\.com$/i, 'outlook', 'Outlook.com'],
  [/\.mail\.protection\.outlook\.com$/i, 'office365', 'Microsoft 365'],
  [/(^|\.)mxbiz\d*\.qq\.com$/i, 'exmail', '腾讯企业邮箱'],
  [/(^|\.)mx\d*\.qq\.com$/i, 'qq', 'QQ 域名邮箱'],
  [/qiye163mx\d*\.mxmail\.netease\.com$/i, 'qiye163', '网易企业邮箱'],
  [/(^|\.)qiye\.163\.com$/i, 'qiye163', '网易企业邮箱'],
  [/(^|\.)qiye\.aliyun\.com$/i, 'alimail', '阿里企业邮箱'],
  [/(^|\.)mxhichina\.com$/i, 'alimail', '阿里企业邮箱'],
  [/(^|\.)zoho\.com\.cn$/i, 'zohocn', 'Zoho Mail 中国'],
  [/(^|\.)zoho\.(com|eu|in|com\.au|jp)$/i, 'zoho', 'Zoho Mail'],
  [/(^|\.)gmx\.net$/i, 'gmx_net', 'GMX'],
  [/(^|\.)gmx\.com$/i, 'gmx_com', 'GMX'],
  [/(^|\.)web\.de$/i, 'webde', 'WEB.DE'],
  [/(^|\.)mail\.icloud\.com$/i, 'icloud', 'iCloud 自定义域名'],
  [/(^|\.)messagingengine\.com$/i, 'fastmail', 'Fastmail'],
  [/(^|\.)yandex\.(net|ru)$/i, 'yandex', 'Yandex 360'],
  [/(^|\.)protonmail\.ch$/i, 'proton', 'Proton Mail'],
  [/(^|\.)secureserver\.net$/i, 'godaddy', 'GoDaddy']
];

function toInfo(id: string, nameOverride?: string): ProviderInfo {
  const { domains: _d, ...rest } = DEFS[id];
  return { id, ...rest, name: nameOverride || rest.name, imap: { ...rest.imap }, smtp: { ...rest.smtp }, help: [...rest.help] };
}

export function providerById(id: string | null | undefined): ProviderInfo | null {
  if (!id || !DEFS[id]) return null;
  return toInfo(id);
}

export function providerForDomain(domain: string): ProviderInfo | null {
  const d = domain.toLowerCase();
  for (const [id, def] of Object.entries(DEFS)) {
    if (def.domains?.includes(d)) return toInfo(id);
  }
  for (const [re, id] of DOMAIN_PATTERNS) if (re.test(d)) return toInfo(id);
  return null;
}

export function providerForMx(mxHost: string): ProviderInfo | null {
  const h = mxHost.toLowerCase().replace(/\.$/, '');
  for (const [re, id, name] of MX_PATTERNS) if (re.test(h)) return toInfo(id, name);
  return null;
}

/** Finds a built-in provider for a configured IMAP host (used to look up quirks / help later). */
export function providerForImapHost(host: string, port?: number): ProviderInfo | null {
  const h = host.toLowerCase();
  const loopback = /^(127\.|localhost$|::1$)/.test(h);
  for (const id of Object.keys(DEFS)) {
    const imap = DEFS[id].imap;
    if (imap.host !== h) continue;
    if ((loopback || port !== undefined) && imap.port !== port) continue;
    return toInfo(id);
  }
  return null;
}

export const ALL_PROVIDER_IDS = Object.keys(DEFS);
