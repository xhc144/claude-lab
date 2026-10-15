import React, { useEffect, useRef, useState } from 'react';
import {
  Bell, Info, KeyRound, Keyboard, Palette, RefreshCw, Shield, SlidersHorizontal, Trash2, Users, ArrowUp, ArrowDown, Stethoscope,
  FolderOpen, FileText, ExternalLink, Check, Monitor, Moon, Sun, OctagonAlert, Ban
} from 'lucide-react';
import type { AccentId, AccountSummary, BlockedSender, Settings as SettingsT } from '@shared/types';
import { useApp } from '../store';
import { api, errorMessage } from '../api';
import { Button, cx, Field, LogoMark, Modal, Segmented, Switch } from './ui';
import { AddAccount } from './AddAccount';
import { SHORTCUTS } from '../lib/shortcuts';

const SECTIONS = [
  { id: 'general', label: '通用', icon: SlidersHorizontal },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'accounts', label: '账户', icon: Users },
  { id: 'sync', label: '同步与通知', icon: Bell },
  { id: 'privacy', label: '隐私与安全', icon: Shield },
  { id: 'junk', label: '垃圾邮件', icon: OctagonAlert },
  { id: 'oauth', label: 'OAuth 登录', icon: KeyRound },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'about', label: '关于', icon: Info }
];

const ACCENTS: Array<{ id: AccentId; name: string; light: string; dark: string }> = [
  { id: 'cinnabar', name: '朱砂', light: '#d0432a', dark: '#ee6447' },
  { id: 'indigo', name: '黛蓝', light: '#3a5aa8', dark: '#7e9be8' },
  { id: 'celadon', name: '青碧', light: '#1f8577', dark: '#4dbfae' },
  { id: 'amber', name: '琥珀', light: '#b97a12', dark: '#e5a843' },
  { id: 'wisteria', name: '紫藤', light: '#7a4fa3', dark: '#b48be0' },
  { id: 'ink', name: '墨', light: '#2b2825', dark: '#e9e4da' }
];

const ACCOUNT_COLORS = ['#D9472B', '#2F8F83', '#3F5BA9', '#C98A1B', '#7E4FA0', '#B5466B', '#4A7C3A', '#2B7BB9', '#8C5A3C', '#5B6470'];

function Row({ title, desc, children }: { title: React.ReactNode; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-title">{title}</div>
        {desc && <div className="set-row-desc">{desc}</div>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="set-group">
      {title && <h3 className="set-group-title">{title}</h3>}
      <div className="set-card">{children}</div>
    </section>
  );
}

function Select<T extends string | number>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <select className="select" value={String(value)} onChange={(e) => {
      const o = options.find((x) => String(x.value) === e.target.value);
      if (o) onChange(o.value);
    }}>
      {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

function SignatureEditor({ account }: { account: AccountSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(true);
  useEffect(() => { if (ref.current) ref.current.innerHTML = account.signature; }, [account.id]);
  const save = () => {
    api.updateAccount(account.id, { signature: ref.current?.innerHTML || '' }).then(() => setSaved(true));
  };
  return (
    <div className="sig-editor">
      <div ref={ref} className="sig-input" contentEditable suppressContentEditableWarning onInput={() => setSaved(false)} onBlur={save} data-placeholder="例如：张三 | 产品经理 | 138 0000 0000" />
      <span className="sig-status">{saved ? '已保存' : '编辑中…'}</span>
    </div>
  );
}

function AccountDetail({ account, onReauth }: { account: AccountSummary; onReauth: () => void }) {
  const s = useApp();
  const [displayName, setDisplayName] = useState(account.displayName);
  const [label, setLabel] = useState(account.label);
  useEffect(() => { setDisplayName(account.displayName); setLabel(account.label); }, [account.id]);
  const patch = (p: Parameters<typeof api.updateAccount>[1]) => api.updateAccount(account.id, p).catch((e) => s.toast({ kind: 'error', message: errorMessage(e).title }));
  return (
    <div className="acct-detail">
      <div className="acct-detail-head">
        <span className="acct-avatar" style={{ background: account.color }}>{account.email[0].toUpperCase()}</span>
        <div>
          <h3>{account.email}</h3>
          <span className="muted">{account.providerName} · {account.authType === 'oauth2' ? 'OAuth2 登录' : '密码登录'} · {account.status.state === 'error' ? <span className="text-danger">{account.status.diagnosis?.title || '连接异常'}</span> : account.enabled ? '正常' : '已停用'}</span>
        </div>
      </div>
      <Group>
        <Row title="发件人名称" desc="收件人看到的名字">
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} onBlur={() => displayName !== account.displayName && patch({ displayName })} />
        </Row>
        <Row title="账户备注名" desc="仅在侧栏中显示，例如「工作」「个人」">
          <input className="input" value={label} placeholder={account.email} onChange={(e) => setLabel(e.target.value)} onBlur={() => label !== account.label && patch({ label })} />
        </Row>
        <Row title="标识颜色">
          <div className="swatches">
            {ACCOUNT_COLORS.map((c) => (
              <button key={c} className={cx('swatch', c.toLowerCase() === account.color.toLowerCase() && 'is-active')} style={{ background: c }} onClick={() => patch({ color: c })} aria-label={c}>
                {c.toLowerCase() === account.color.toLowerCase() && <Check size={12} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Row>
        <Row title="启用同步" desc="停用后不再收取该账户的邮件，已下载的邮件仍保留">
          <Switch checked={account.enabled} onChange={(v) => patch({ enabled: v })} />
        </Row>
      </Group>
      <Group title="签名">
        <SignatureEditor account={account} />
      </Group>
      <Group title="服务器">
        <Row title="收信 (IMAP)"><span className="mono">{account.imap.host}:{account.imap.port} · {account.imap.security.toUpperCase()}</span></Row>
        <Row title="发信 (SMTP)"><span className="mono">{account.smtp.host}:{account.smtp.port} · {account.smtp.security.toUpperCase()}</span></Row>
        <Row title="用户名"><span className="mono">{account.username}</span></Row>
        <div className="set-actions">
          <Button icon={<KeyRound size={15} />} onClick={onReauth}>{account.authType === 'oauth2' ? '重新授权 / 修改设置' : '修改密码 / 服务器设置'}</Button>
          <Button icon={<Stethoscope size={15} />} onClick={() => s.openModal({ type: 'diagnose', accountId: account.id })}>诊断连接</Button>
          <Button icon={<RefreshCw size={15} />} onClick={() => api.syncNow(account.id)}>立即同步</Button>
        </div>
      </Group>
      <Group>
        <Row title="删除账户" desc="从鸿雁中移除此账户及本机缓存的邮件。服务器上的邮件不受影响。">
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => s.openModal({
            type: 'confirm', title: `删除 ${account.email}？`, message: '本机缓存的邮件和凭据会被删除，服务器上的邮件不会受到影响。', confirmLabel: '删除账户', danger: true,
            onConfirm: () => api.removeAccount(account.id).then(() => s.toast({ kind: 'success', message: '账户已删除' }))
          })}>删除</Button>
        </Row>
      </Group>
    </div>
  );
}

function AccountsSection({ initial }: { initial?: number }) {
  const s = useApp();
  const [sel, setSel] = useState<number | null>(initial ?? s.accounts[0]?.id ?? null);
  const [mode, setMode] = useState<'view' | 'add' | 'reauth'>('view');
  const account = s.accounts.find((a) => a.id === sel);
  const move = (id: number, d: number) => {
    const ids = s.accounts.map((a) => a.id);
    const i = ids.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    api.reorderAccounts(ids);
  };
  if (mode !== 'view') {
    return <AddAccount embedded reauthAccountId={mode === 'reauth' ? sel ?? undefined : undefined} onDone={() => setMode('view')} onCancel={() => setMode('view')} />;
  }
  return (
    <div className="accounts-split">
      <div className="accounts-list">
        {s.accounts.map((a, i) => (
          <div key={a.id} className={cx('acct-li', a.id === sel && 'is-active')} onClick={() => setSel(a.id)}>
            <span className="acct-dot" style={{ background: a.color }} />
            <span className="acct-li-name">{a.label || a.email}</span>
            <span className="acct-li-move">
              <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(a.id, -1); }} aria-label="上移"><ArrowUp size={12} /></button>
              <button disabled={i === s.accounts.length - 1} onClick={(e) => { e.stopPropagation(); move(a.id, 1); }} aria-label="下移"><ArrowDown size={12} /></button>
            </span>
          </div>
        ))}
        <Button variant="ghost" size="s" onClick={() => setMode('add')}>+ 添加账户</Button>
      </div>
      <div className="accounts-detail">
        {account ? <AccountDetail key={account.id} account={account} onReauth={() => setMode('reauth')} /> : <p className="muted">还没有账户。</p>}
      </div>
    </div>
  );
}

function ThemeCard({ mode, active, onClick }: { mode: 'system' | 'light' | 'dark'; active: boolean; onClick: () => void }) {
  const Icon = mode === 'system' ? Monitor : mode === 'light' ? Sun : Moon;
  return (
    <button className={cx('theme-card', `theme-${mode}`, active && 'is-active')} onClick={onClick}>
      <span className="theme-preview">
        <span className="tp-side" /><span className="tp-list"><i /><i /><i /></span><span className="tp-read"><i /><i /></span>
      </span>
      <span className="theme-label"><Icon size={14} /> {mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'}</span>
    </button>
  );
}

export function SettingsModal({ section: initialSection, accountId }: { section?: string; accountId?: number }) {
  const s = useApp();
  const st = s.settings!;
  const [section, setSection] = useState(initialSection || 'general');
  const set = (p: Partial<SettingsT>) => void s.updateSettings(p);
  const info = s.info;

  let body: React.ReactNode = null;
  switch (section) {
    case 'general':
      body = (
        <>
          <Group title="启动与窗口">
            <Row title="开机时自动启动" desc="启动后在托盘中运行，及时收到新邮件"><Switch checked={st.launchAtLogin} onChange={(v) => set({ launchAtLogin: v })} /></Row>
            <Row title="启动时最小化到托盘"><Switch checked={st.startMinimized} onChange={(v) => set({ startMinimized: v })} /></Row>
            <Row title="关闭窗口时最小化到托盘" desc="关闭后仍在后台收取邮件"><Switch checked={st.closeToTray} onChange={(v) => set({ closeToTray: v })} /></Row>
          </Group>
          <Group title="阅读与撰写">
            <Row title="打开邮件后标为已读">
              <Select value={st.markReadDelay} onChange={(v) => set({ markReadDelay: v })} options={[{ value: 0, label: '立即' }, { value: 2, label: '2 秒后' }, { value: 5, label: '5 秒后' }, { value: -1, label: '从不（手动标记）' }]} />
            </Row>
            <Row title="默认发件账户">
              <Select value={st.defaultAccountId ?? 0} onChange={(v) => set({ defaultAccountId: v || null })} options={s.accounts.map((a) => ({ value: a.id, label: a.email }))} />
            </Row>
            <Row title="撤销发送" desc="点击发送后，在这段时间内可以撤回">
              <Select value={st.undoSendSeconds} onChange={(v) => set({ undoSendSeconds: v })} options={[{ value: 0, label: '关闭' }, { value: 5, label: '5 秒' }, { value: 10, label: '10 秒' }, { value: 20, label: '20 秒' }, { value: 30, label: '30 秒' }]} />
            </Row>
            <Row title="永久删除前确认"><Switch checked={st.confirmDelete} onChange={(v) => set({ confirmDelete: v })} /></Row>
          </Group>
          <Group title="系统">
            <Row title="设为默认邮件程序" desc="点击网页中的邮箱链接（mailto:）时用鸿雁写信。Windows 会打开「默认应用」，请在其中选择鸿雁邮箱。">
              <Button size="s" onClick={() => api.setDefaultMailClient().then((ok) => s.toast({ kind: ok ? 'success' : 'error', message: ok ? '已注册为邮件程序' : '注册失败' }))}>设置</Button>
            </Row>
          </Group>
        </>
      );
      break;
    case 'appearance':
      body = (
        <>
          <Group title="主题">
            <div className="theme-cards">
              {(['system', 'light', 'dark'] as const).map((m) => <ThemeCard key={m} mode={m} active={st.theme === m} onClick={() => set({ theme: m })} />)}
            </div>
          </Group>
          <Group title="强调色 · 取自中国传统色">
            <div className="accent-row">
              {ACCENTS.map((a) => (
                <button key={a.id} className={cx('accent-chip', st.accent === a.id && 'is-active')} onClick={() => set({ accent: a.id })}>
                  <span className="accent-dot" style={{ background: s.dark ? a.dark : a.light }}>{st.accent === a.id && <Check size={13} strokeWidth={3} />}</span>
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          </Group>
          <Group title="布局">
            <Row title="列表密度"><Segmented value={st.density} onChange={(v) => set({ density: v })} options={[{ value: 'comfortable', label: '舒适' }, { value: 'compact', label: '紧凑' }]} /></Row>
            <Row title="显示发件人头像"><Switch checked={st.showAvatars} onChange={(v) => set({ showAvatars: v })} /></Row>
            <Row title="显示邮件摘要"><Switch checked={st.showSnippets} onChange={(v) => set({ showSnippets: v })} /></Row>
            <Row title="会话视图" desc="阅读时把同一主题的往来邮件放在一起"><Switch checked={st.conversationView} onChange={(v) => set({ conversationView: v })} /></Row>
            <Row title="智能分类" desc="在收件箱中按 主要 / 通知 / 推广 / 社交 分类（完全在本机完成）"><Switch checked={st.categoriesEnabled} onChange={(v) => set({ categoriesEnabled: v })} /></Row>
          </Group>
          <Group title="深色模式">
            <Row title="邮件正文显示" desc="「保持原样」在浅色纸面上显示 HTML 邮件，最忠实；「自适应」将其转为深色">
              <Segmented value={st.darkEmailMode} onChange={(v) => set({ darkEmailMode: v })} options={[{ value: 'original', label: '保持原样' }, { value: 'adaptive', label: '自适应深色' }]} />
            </Row>
            {info?.isWindows11 && <Row title="云母材质（实验性）" desc="Windows 11 的半透明窗口背景，重启后生效"><Switch checked={st.mica} onChange={(v) => set({ mica: v })} /></Row>}
          </Group>
        </>
      );
      break;
    case 'accounts':
      body = <AccountsSection initial={accountId} />;
      break;
    case 'sync':
      body = (
        <>
          <Group title="同步">
            <Row title="检查新邮件的间隔" desc="支持 IDLE 的服务器会实时推送收件箱的新邮件，其余文件夹按此间隔检查">
              <Select value={st.syncIntervalMinutes} onChange={(v) => set({ syncIntervalMinutes: v })} options={[1, 2, 3, 5, 10, 15, 30].map((n) => ({ value: n, label: `${n} 分钟` }))} />
            </Row>
            <Row title="预先下载最近的邮件正文" desc="离线也能阅读，并让全文搜索覆盖最近的邮件"><Switch checked={st.prefetchBodies} onChange={(v) => set({ prefetchBodies: v })} /></Row>
            <Row title="联网查询服务器配置" desc="识别不了的邮箱域名时，查询 Mozilla 公共配置库（只发送域名）"><Switch checked={st.autodiscoverOnline} onChange={(v) => set({ autodiscoverOnline: v })} /></Row>
          </Group>
          <Group title="通知">
            <Row title="新邮件桌面通知"><Switch checked={st.notifications} onChange={(v) => set({ notifications: v })} /></Row>
            <Row title="通知提示音"><Switch checked={st.notificationSound} onChange={(v) => set({ notificationSound: v })} /></Row>
          </Group>
        </>
      );
      break;
    case 'privacy':
      body = (
        <>
          <Group title="隐私">
            <Row title="默认阻止远程图片" desc="远程图片常被用来追踪你是否打开了邮件、何时打开、在哪里打开"><Switch checked={st.blockRemoteImages} onChange={(v) => set({ blockRemoteImages: v })} /></Row>
          </Group>
          <Group title="凭据与数据">
            <Row title="凭据加密" desc="密码与令牌在写入磁盘前加密，只能由当前 Windows 用户解密"><span className="pill-ok"><Check size={13} /> {info?.encryptionBackend}</span></Row>
            <Row title="网络连接" desc="鸿雁直接连接你的邮件服务器（IMAP / SMTP），没有任何中转服务器"><span className="pill-ok"><Check size={13} /> 直连</span></Row>
            <Row title="数据目录" desc={<span className="mono">{info?.dataDir}</span>}><Button size="s" icon={<FolderOpen size={14} />} onClick={() => api.openDataDir()}>打开</Button></Row>
            <Row title="运行日志" desc="不包含密码；排查问题时可以查看"><Button size="s" icon={<FileText size={14} />} onClick={() => api.openLogsDir()}>打开</Button></Row>
          </Group>
        </>
      );
      break;
    case 'oauth':
      body = <OAuthSection />;
      break;
    case 'junk':
      body = <JunkSection />;
      break;
    case 'shortcuts':
      body = (
        <Group>
          <div className="shortcut-table">
            {SHORTCUTS.map((sc) => (
              <div key={sc.keys} className="shortcut-row">
                <span>{sc.label}</span>
                <span className="shortcut-keys">{sc.keys.split(' ').map((k, i) => <kbd key={i} className="kbd">{k}</kbd>)}</span>
              </div>
            ))}
          </div>
        </Group>
      );
      break;
    case 'about':
      body = (
        <div className="about">
          <LogoMark size={64} />
          <h2>鸿雁邮箱 <span className="muted">Hongyan Mail</span></h2>
          <p className="muted">版本 {info?.version} · Electron {info?.electron} · Chromium {info?.chrome}</p>
          <p>一个完全在本机运行的多账户邮件客户端。没有服务器、没有账号体系、没有数据收集。</p>
          <p className="about-quote">鸿雁长飞光不度，鱼龙潜跃水成文。</p>
        </div>
      );
      break;
  }

  return (
    <Modal open onClose={() => s.closeModal()} width={880} className="settings-modal">
      <div className="settings">
        <nav className="settings-nav">
          <div className="settings-nav-title">设置</div>
          {SECTIONS.map((x) => (
            <button key={x.id} className={cx('settings-nav-item', section === x.id && 'is-active')} onClick={() => setSection(x.id)}>
              <x.icon size={16} /> {x.label}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          <h2 className="settings-title">{SECTIONS.find((x) => x.id === section)?.label}</h2>
          {body}
        </div>
      </div>
    </Modal>
  );
}

function JunkSection() {
  const s = useApp();
  const [list, setList] = useState<BlockedSender[] | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api.listBlockedSenders().then(setList).catch(() => setList([]));
  useEffect(() => { void load(); }, []);
  const add = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const r = await api.blockSenders(input.split(/[,;，；\s]+/).filter(Boolean));
      setInput('');
      s.toast({ kind: 'success', message: '已屏蔽', detail: r.moved ? `${r.moved} 封邮件已移到「垃圾邮件」` : undefined });
      void load();
    } catch (e) {
      s.toast({ kind: 'error', message: '无法屏蔽', detail: errorMessage(e).title });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Group title="已屏蔽的发件人">
        <div className="block-add">
          <input className="input" value={input} placeholder="name@example.com 或 @example.com（整个域名）" spellCheck={false}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
          <Button variant="primary" icon={<Ban size={14} />} loading={busy} disabled={!input.trim()} onClick={add}>屏蔽</Button>
        </div>
        {list && !list.length && <div className="block-empty">还没有屏蔽任何发件人。在邮件上点右键 →「屏蔽此发件人」即可添加。</div>}
        {list?.map((b) => (
          <Row key={b.pattern} title={<span className="mono">{b.pattern}</span>} desc={b.pattern.startsWith('@') ? '整个域名' : undefined}>
            <Button size="s" variant="ghost" onClick={() => api.unblockSender(b.pattern).then(load)}>解除屏蔽</Button>
          </Row>
        ))}
      </Group>
      <Group title="说明">
        <div className="set-note">
          <p>屏蔽后，对方现有的邮件和今后的新邮件都会在<strong>邮件服务器上</strong>移到「垃圾邮件」文件夹（不是只在本机隐藏），在手机等其他设备上也能看到同样的结果，也有助于服务器的垃圾邮件过滤学习。</p>
          <p>「垃圾邮件」和「已删除」中的邮件不计入未读数。开启智能分类后，收件箱的未读数只统计「主要」和「通知」，推广与社交邮件在各自的标签里单独计数。</p>
          <p>删除邮件时总是先移到「已删除」，可以撤销或从中恢复；只有在「已删除」里再次删除或清空时，才会永久删除。</p>
        </div>
      </Group>
    </>
  );
}

function OAuthSection() {
  const s = useApp();
  const st = s.settings!;
  const [g, setG] = useState(st.oauth.google);
  const [m, setM] = useState(st.oauth.microsoft);
  const save = () => { void s.updateSettings({ oauth: { google: { clientId: g.clientId.trim(), clientSecret: g.clientSecret.trim() }, microsoft: { clientId: m.clientId.trim(), clientSecret: m.clientSecret.trim() } } }); s.toast({ kind: 'success', message: 'OAuth 设置已保存' }); };
  return (
    <>
      <p className="set-intro">
        Gmail 与 Outlook 支持「用账号登录」（OAuth2）：在浏览器中授权，鸿雁只获得收发邮件的令牌，不接触你的密码。授权时浏览器会把结果直接交给本机的鸿雁，全程不经过第三方服务器。
        为此需要一个属于你自己的 OAuth 客户端 ID（免费、一次性配置）。Gmail 也可以直接使用「应用专用密码」而无需配置。
      </p>
      <Group title="Google（Gmail）">
        <ol className="howto">
          <li>打开 <button className="link-btn" onClick={() => api.openExternal('https://console.cloud.google.com/apis/credentials')}>Google Cloud 控制台 <ExternalLink size={12} /></button>，新建项目并启用「Gmail API」。</li>
          <li>配置「OAuth 同意屏幕」：用户类型选「外部」，把你自己的 Gmail 加入「测试用户」。</li>
          <li>「创建凭据」→「OAuth 客户端 ID」，应用类型选择 <b>桌面应用</b>，把客户端 ID 和密钥填在下面。</li>
        </ol>
        <div className="server-row">
          <Field label="客户端 ID"><input className="input mono" value={g.clientId} onChange={(e) => setG({ ...g, clientId: e.target.value })} placeholder="xxxx.apps.googleusercontent.com" spellCheck={false} /></Field>
          <Field label="客户端密钥"><input className="input mono" type="password" value={g.clientSecret} onChange={(e) => setG({ ...g, clientSecret: e.target.value })} spellCheck={false} /></Field>
        </div>
      </Group>
      <Group title="Microsoft（Outlook / Hotmail / Microsoft 365）">
        <ol className="howto">
          <li>打开 <button className="link-btn" onClick={() => api.openExternal('https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade')}>Microsoft Entra 应用注册 <ExternalLink size={12} /></button>，新建注册；受支持的帐户类型选「任何组织目录中的帐户和个人 Microsoft 帐户」。</li>
          <li>「身份验证」→ 添加平台「移动和桌面应用程序」，自定义重定向 URI 填 <code>http://localhost</code>，并开启「允许公共客户端流」。</li>
          <li>「API 权限」中添加 Office 365 Exchange Online 的 <code>IMAP.AccessAsUser.All</code>、<code>SMTP.Send</code>，以及 <code>offline_access</code>。把「应用程序(客户端) ID」填在下面。</li>
        </ol>
        <Field label="应用程序（客户端）ID"><input className="input mono" value={m.clientId} onChange={(e) => setM({ ...m, clientId: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" spellCheck={false} /></Field>
      </Group>
      <div className="set-actions"><Button variant="primary" onClick={save}>保存</Button></div>
    </>
  );
}
