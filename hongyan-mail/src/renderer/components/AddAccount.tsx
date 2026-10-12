import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, Eye, EyeOff, KeyRound, Lock, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import type { AccountDraftInput, DiagnosisReport, DiscoveryResult, OAuthProviderId, ProviderInfo, Security, ServerConfig } from '@shared/types';
import { useApp } from '../store';
import { api, ApiError, errorMessage } from '../api';
import { Button, cx, Field, LogoMark, Segmented, Spinner, Switch } from './ui';
import { DiagSteps, DiagnosisCard } from './Diagnostics';
import { InkScene } from './EmptyState';

const QUICK = [
  { name: 'Gmail', domain: 'gmail.com', color: '#ea4335' },
  { name: 'Outlook', domain: 'outlook.com', color: '#0a64c9' },
  { name: 'QQ 邮箱', domain: 'qq.com', color: '#12b7f5' },
  { name: '网易 163', domain: '163.com', color: '#d0021b' },
  { name: '网易 126', domain: '126.com', color: '#3d9c3f' },
  { name: 'GMX', domain: 'gmx.com', color: '#1c449b' },
  { name: 'iCloud', domain: 'icloud.com', color: '#3e8ef7' },
  { name: 'Yahoo', domain: 'yahoo.com', color: '#6001d2' }
];

const AUTH_HINT: Record<string, string> = {
  'app-password': '需要应用专用密码',
  'authorization-code': '需要授权码',
  password: '使用邮箱密码',
  'oauth-recommended': '推荐使用账号登录',
  'oauth-required': '需要使用账号登录'
};

type Step = 'email' | 'credentials' | 'testing' | 'done';

function ServerEditor({ label, value, onChange }: { label: string; value: ServerConfig; onChange: (v: ServerConfig) => void }) {
  const ports: Record<Security, number[]> = label.startsWith('IMAP') ? { tls: [993], starttls: [143], none: [143] } : { tls: [465], starttls: [587, 25], none: [25] };
  return (
    <div className="server-editor">
      <div className="server-editor-title">{label}</div>
      <div className="server-row">
        <Field label="服务器"><input className="input" value={value.host} onChange={(e) => onChange({ ...value, host: e.target.value.trim() })} spellCheck={false} /></Field>
        <Field label="端口"><input className="input port" inputMode="numeric" value={value.port || ''} onChange={(e) => onChange({ ...value, port: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
      </div>
      <Segmented size="s" value={value.security} onChange={(sec) => onChange({ ...value, security: sec, port: ports[sec].includes(value.port) ? value.port : ports[sec][0] })}
        options={[{ value: 'tls', label: 'SSL/TLS' }, { value: 'starttls', label: 'STARTTLS' }, { value: 'none', label: '不加密' }]} />
    </div>
  );
}

export function AddAccount({ onDone, onCancel, reauthAccountId, embedded }: { onDone: () => void; onCancel?: () => void; reauthAccountId?: number; embedded?: boolean }) {
  const s = useApp();
  const reauth = reauthAccountId ? s.accounts.find((a) => a.id === reauthAccountId) : undefined;
  const [step, setStep] = useState<Step>(reauth ? 'credentials' : 'email');
  const [email, setEmail] = useState(reauth?.email || '');
  const [name, setName] = useState(reauth?.displayName || '');
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [imap, setImap] = useState<ServerConfig>(reauth?.imap || { host: '', port: 993, security: 'tls' });
  const [smtp, setSmtp] = useState<ServerConfig>(reauth?.smtp || { host: '', port: 465, security: 'tls' });
  const [username, setUsername] = useState(reauth?.username || '');
  const [smtpUsername, setSmtpUsername] = useState(reauth?.smtpUsername || '');
  const [insecure, setInsecure] = useState(!!reauth?.allowInsecureTls);
  const [oauth, setOauth] = useState<{ session: string; email: string | null; provider: OAuthProviderId } | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState('');
  const [report, setReport] = useState<DiagnosisReport | null>(null);
  const [testing, setTesting] = useState(false);
  const steps = s.diagRuns[runId];
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (reauth) {
      api.discover(reauth.email).then((d) => { setDiscovery(d); setProvider(d.provider); }).catch(() => {});
    }
  }, []);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());

  const goDiscover = async () => {
    if (!validEmail) { setError('请输入完整的邮箱地址，例如 name@example.com'); return; }
    setError(null);
    setDiscovering(true);
    try {
      const d = await api.discover(email.trim());
      setDiscovery(d);
      const p = d.provider;
      setProvider(p);
      if (p) {
        setImap(p.imap);
        setSmtp(p.smtp);
        setUsername(p.usernameStyle === 'local' ? email.trim().split('@')[0] : email.trim());
      }
      setAdvanced(!p || d.source === 'none' || d.source === 'guess');
      setStep('credentials');
    } catch (e) {
      setError(errorMessage(e).title);
    } finally {
      setDiscovering(false);
    }
  };

  const draft = (): AccountDraftInput => ({
    email: email.trim(),
    displayName: name.trim() || email.trim().split('@')[0],
    providerId: provider?.id && !['guess', 'manual', 'ispdb', 'autoconfig'].includes(provider.id) ? provider.id : null,
    imap,
    smtp,
    username: username.trim() || email.trim(),
    smtpUsername: smtpUsername.trim() || null,
    allowInsecureTls: insecure,
    authType: oauth ? 'oauth2' : 'password',
    password: oauth ? undefined : password,
    oauthSession: oauth?.session,
    oauthProvider: oauth?.provider
  });

  const signInOAuth = async (p: OAuthProviderId) => {
    setOauthBusy(true);
    setError(null);
    try {
      const r = await api.startOAuth(p, email.trim());
      if (r.email && r.email.toLowerCase() !== email.trim().toLowerCase()) {
        setError(`你在浏览器中登录的是 ${r.email}，与填写的邮箱不一致。请确认后重试。`);
        return;
      }
      setOauth(r);
      void runTest(r);
    } catch (e) {
      const m = e instanceof ApiError && e.diagnosis ? `${e.diagnosis.title}：${e.diagnosis.explanation}` : errorMessage(e).title;
      setError(m);
    } finally {
      setOauthBusy(false);
    }
  };

  const runTest = async (o = oauth) => {
    if (!o && !password) { setError(`请填写${provider?.passwordLabel || '密码'}`); return; }
    if (!imap.host || !smtp.host || !imap.port || !smtp.port) { setAdvanced(true); setError('请填写完整的服务器信息'); return; }
    setError(null);
    const id = Math.random().toString(36).slice(2);
    setRunId(id);
    setReport(null);
    setTesting(true);
    setStep('testing');
    try {
      const input = { ...draft(), authType: o ? 'oauth2' as const : 'password' as const, oauthSession: o?.session, oauthProvider: o?.provider, password: o ? undefined : password };
      const r = reauth ? await api.diagnoseAccount(reauth.id, id, { authType: input.authType, password: input.password, oauthSession: input.oauthSession, oauthProvider: input.oauthProvider }) : await api.testConnection(input, id);
      setReport(r);
    } catch (e) {
      setError(errorMessage(e).title);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    try {
      if (reauth) {
        await api.updateAccount(reauth.id, {
          imap, smtp, username: username.trim() || email.trim(), smtpUsername: smtpUsername.trim() || null, allowInsecureTls: insecure,
          credentials: { authType: oauth ? 'oauth2' : 'password', password: oauth ? undefined : password, oauthSession: oauth?.session, oauthProvider: oauth?.provider }
        });
        s.toast({ kind: 'success', message: '账户已更新，正在重新连接' });
        onDone();
        return;
      }
      await api.addAccount(draft());
      setStep('done');
    } catch (e) {
      setError(errorMessage(e).title);
      setStep('credentials');
    }
  };

  const quick = useMemo(() => QUICK, []);

  const body = (
    <AnimatePresence mode="wait">
      {step === 'email' && (
        <motion.div key="email" className="aa-step" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
          <h2 className="aa-title">添加邮箱账户</h2>
          <p className="aa-sub">支持 Gmail、Outlook、QQ、网易、GMX、iCloud 等常见邮箱，服务器设置会自动识别。</p>
          <Field label="邮箱地址">
            <input ref={emailRef} className="input input-l" type="email" autoFocus placeholder="name@example.com" value={email} spellCheck={false}
              onChange={(e) => { setEmail(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') void goDiscover(); }} />
          </Field>
          <Field label="你的名字" hint="收件人看到的发件人名称，可以稍后修改">
            <input className="input" placeholder="例如：张三" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void goDiscover(); }} />
          </Field>
          <div className="aa-quick">
            {quick.map((q) => (
              <button key={q.domain} className="aa-quick-chip" onClick={() => {
                const local = email.split('@')[0];
                setEmail(local ? `${local}@${q.domain}` : `@${q.domain}`);
                emailRef.current?.focus();
                setTimeout(() => emailRef.current?.setSelectionRange(0, local ? local.length : 0), 0);
              }}>
                <span className="aa-quick-dot" style={{ background: q.color }} />{q.name}
              </button>
            ))}
          </div>
          {error && <div className="aa-error">{error}</div>}
          <div className="aa-actions">
            {onCancel && <Button variant="ghost" onClick={onCancel}>取消</Button>}
            <Button variant="primary" size="l" onClick={() => void goDiscover()} loading={discovering} icon={!discovering ? <ArrowRight size={16} /> : undefined}>继续</Button>
          </div>
          <p className="aa-privacy"><ShieldCheck size={14} /> 密码只加密保存在这台电脑上，由鸿雁直接连接邮件服务器，不经过任何第三方服务器。</p>
        </motion.div>
      )}

      {step === 'credentials' && (
        <motion.div key="cred" className="aa-step" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
          {!reauth && <button className="aa-back" onClick={() => { setStep('email'); setOauth(null); }}><ArrowLeft size={15} /> {email}</button>}
          <div className="provider-card">
            <div className="provider-head">
              <span className="provider-logo">{(provider?.name || email.split('@')[1] || '?').slice(0, 1).toUpperCase()}</span>
              <div>
                <h3>{reauth ? `重新验证 ${reauth.email}` : provider?.name || discovery?.domain}</h3>
                <span className="provider-badge">{provider ? AUTH_HINT[provider.auth] : '手动配置'}{discovery?.source && discovery.source !== 'builtin' && discovery.source !== 'none' ? ` · ${{ mx: '通过 MX 记录识别', ispdb: '来自 ISPDB', autoconfig: '域名自动配置', guess: '根据常见规则推测' }[discovery.source as 'mx']}` : ''}</span>
              </div>
            </div>
            {provider && provider.help.length > 0 && (
              <ol className="provider-help">
                {provider.help.map((h, i) => <li key={i}>{h}</li>)}
              </ol>
            )}
            {provider?.helpUrl && <button className="link-btn" onClick={() => api.openExternal(provider.helpUrl!)}><ExternalLink size={13} /> 打开设置页面</button>}
          </div>

          {provider?.oauth && (
            <div className="oauth-block">
              <Button size="l" className={cx('oauth-btn', `oauth-${provider.oauth}`)} onClick={() => void signInOAuth(provider.oauth!)} loading={oauthBusy}
                icon={!oauthBusy ? <KeyRound size={16} /> : undefined}>
                使用 {provider.oauth === 'google' ? 'Google' : 'Microsoft'} 账号登录
              </Button>
              {oauthBusy && <p className="aa-hint">已在浏览器中打开登录页面，完成授权后会自动返回这里… <button className="link-btn" onClick={() => { api.cancelOAuth(); setOauthBusy(false); }}>取消</button></p>}
              {!s.settings?.oauth[provider.oauth].clientId && <p className="aa-hint">首次使用需要在 <button className="link-btn" onClick={() => s.openModal({ type: 'settings', section: 'oauth' })}>设置 → OAuth</button> 中填写客户端 ID（一次性配置，有详细步骤）。</p>}
              {provider.auth !== 'oauth-required' && <div className="or-line"><span>或使用{provider.passwordLabel}</span></div>}
            </div>
          )}

          {provider?.auth !== 'oauth-required' || advanced ? (
            <Field label={provider?.passwordLabel || '密码'}>
              <div className="pw-wrap">
                <Lock size={15} className="pw-icon" />
                <input className="input input-l pw" type={showPw ? 'text' : 'password'} autoFocus={!provider?.oauth} value={password} spellCheck={false}
                  onChange={(e) => { setPassword(e.target.value.replace(/\s+/g, provider?.auth === 'app-password' || provider?.auth === 'authorization-code' ? '' : ' ')); setError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void runTest(null); }} placeholder={provider?.auth === 'authorization-code' ? '16 位授权码' : provider?.auth === 'app-password' ? '应用专用密码' : ''} />
                <button className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label="显示密码">{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </Field>
          ) : null}

          <button className="aa-adv-toggle" onClick={() => setAdvanced(!advanced)}>
            <Settings2 size={14} /> 服务器设置 <ChevronDown size={14} style={{ transform: advanced ? 'rotate(180deg)' : undefined }} />
          </button>
          <AnimatePresence initial={false}>
            {advanced && (
              <motion.div className="aa-advanced" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <ServerEditor label="IMAP 收信服务器" value={imap} onChange={setImap} />
                <ServerEditor label="SMTP 发信服务器" value={smtp} onChange={setSmtp} />
                <div className="server-row">
                  <Field label="登录用户名"><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} spellCheck={false} /></Field>
                  <Field label="SMTP 用户名（可选）" hint="与登录用户名不同时填写"><input className="input" value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} spellCheck={false} /></Field>
                </div>
                <div className="switch-row">
                  <div><strong>允许不受信任的证书</strong><span>仅用于自签名证书的私有服务器或 Proton Bridge，会降低安全性</span></div>
                  <Switch checked={insecure} onChange={setInsecure} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <div className="aa-error">{error}</div>}
          <div className="aa-actions">
            {onCancel && <Button variant="ghost" onClick={onCancel}>取消</Button>}
            {(provider?.auth !== 'oauth-required' || advanced) && <Button variant="primary" size="l" onClick={() => void runTest(null)} icon={<ArrowRight size={16} />}>连接</Button>}
          </div>
        </motion.div>
      )}

      {step === 'testing' && (
        <motion.div key="test" className="aa-step" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
          <h2 className="aa-title">{testing ? '正在连接…' : report?.ok ? '连接成功' : '连接没有成功'}</h2>
          <p className="aa-sub">{testing ? `正在逐项检查 ${email} 的收发信设置` : report?.ok ? '收信和发信都已验证通过。' : '下面是具体原因和解决办法。'}</p>
          {steps && <DiagSteps steps={steps} />}
          {!steps && testing && <div className="aa-wait"><Spinner /> 准备中…</div>}
          {report && !report.ok && report.diagnosis && <DiagnosisCard d={report.diagnosis} report={report} />}
          {error && <div className="aa-error">{error}</div>}
          <div className="aa-actions">
            {!testing && <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => { setStep('credentials'); setOauth(null); }}>返回修改</Button>}
            {!testing && report && !report.ok && !report.diagnosis?.needsUserAction && <Button onClick={() => void save()}>仍然添加</Button>}
            {!testing && report && !report.ok && <Button onClick={() => void runTest()}>重试</Button>}
            {!testing && report?.ok && <Button variant="primary" size="l" onClick={() => void save()} icon={<Check size={16} />}>{reauth ? '保存' : '完成'}</Button>}
          </div>
        </motion.div>
      )}

      {step === 'done' && (
        <motion.div key="done" className="aa-step aa-done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
          <motion.div className="done-badge" initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
            <Check size={30} strokeWidth={3} />
          </motion.div>
          <h2 className="aa-title">{email} 已添加</h2>
          <p className="aa-sub">鸿雁正在收取最新邮件，历史邮件会在后台继续下载，你可以立即开始使用。</p>
          <div className="aa-actions center">
            <Button onClick={() => { setStep('email'); setEmail(''); setPassword(''); setOauth(null); setReport(null); }}>再添加一个</Button>
            <Button variant="primary" size="l" icon={<Sparkles size={16} />} onClick={onDone}>开始使用</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (embedded) return <div className="aa-embedded">{body}</div>;
  return body;
}

/** First-run screen shown while there are no accounts. */
export function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-art drag">
        <div className="welcome-brand">
          <LogoMark size={44} />
          <div>
            <div className="welcome-name">鸿雁</div>
            <div className="welcome-tag">一处收发，所有邮箱</div>
          </div>
        </div>
        <InkScene width={420} />
        <ul className="welcome-points">
          <li><Check size={15} /> 多个邮箱统一收件箱，新邮件实时推送</li>
          <li><Check size={15} /> 智能分类、全文搜索，历史邮件完整同步</li>
          <li><Check size={15} /> 凭据加密保存在本机，直连邮件服务器</li>
        </ul>
        <p className="welcome-quote">“云中谁寄锦书来，雁字回时，月满西楼。”</p>
      </div>
      <div className="welcome-form">
        <div className="welcome-card">
          <AddAccount onDone={() => { void useApp.getState().refreshAccounts(); useApp.setState({ onboarding: false }); }} />
        </div>
      </div>
    </div>
  );
}
