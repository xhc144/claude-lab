import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle, Archive, ChevronDown, Clock3, FileText, Folder, FolderPlus, Inbox, Mails, MailOpen, Moon, OctagonAlert,
  Paperclip, PenLine, Plus, RefreshCw, Send, Settings as SettingsIcon, Star, Sun, Trash2, WifiOff, PanelLeftClose, PanelLeftOpen, Stethoscope
} from 'lucide-react';
import type { AccountSummary, FolderInfo, SpecialUse, UnifiedBox, ViewSpec } from '@shared/types';
import { useApp, persistUi } from '../store';
import { api, errorMessage } from '../api';
import { folderName, folderTree, flattenTree, sameView } from '../lib/folders';
import { number } from '../lib/format';
import { cx, IconButton, LogoMark, showContextMenu, Spinner, Wordmark, type MenuItem } from './ui';

export const SPECIAL_ICONS: Record<SpecialUse | 'folder', React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  inbox: Inbox, sent: Send, drafts: FileText, trash: Trash2, junk: OctagonAlert, archive: Archive, all: Mails, flagged: Star, important: Star, folder: Folder
};

const UNIFIED: Array<{ box: UnifiedBox; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { box: 'inbox', label: '收件箱', icon: Inbox },
  { box: 'unread', label: '未读', icon: MailOpen },
  { box: 'starred', label: '星标', icon: Star },
  { box: 'drafts', label: '草稿箱', icon: FileText },
  { box: 'sent', label: '已发送', icon: Send },
  { box: 'attachments', label: '附件', icon: Paperclip }
];

const MORE: Array<{ box: UnifiedBox; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { box: 'archive', label: '归档', icon: Archive },
  { box: 'junk', label: '垃圾邮件', icon: OctagonAlert },
  { box: 'trash', label: '已删除', icon: Trash2 }
];

function NavItem({ icon: Icon, label, count, active, onClick, onContextMenu, collapsed, muted, onDrop, accent, depth = 0, status }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; count?: number; active?: boolean; onClick: () => void; onContextMenu?: (e: React.MouseEvent) => void;
  collapsed?: boolean; muted?: boolean; onDrop?: (ids: number[]) => void; accent?: string; depth?: number; status?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      className={cx('nav-item', active && 'is-active', muted && 'is-muted', over && 'is-drop')}
      onClick={onClick}
      onContextMenu={onContextMenu}
      data-tip={collapsed ? (count ? `${label} · ${count}` : label) : undefined}
      data-tip-side="right"
      style={{ paddingLeft: collapsed ? undefined : 12 + depth * 14 }}
      onDragOver={onDrop ? (e) => { if (e.dataTransfer.types.includes('application/x-hy-messages')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); } } : undefined}
      onDragLeave={onDrop ? () => setOver(false) : undefined}
      onDrop={onDrop ? (e) => {
        setOver(false);
        const raw = e.dataTransfer.getData('application/x-hy-messages');
        if (raw) { e.preventDefault(); onDrop(JSON.parse(raw)); }
      } : undefined}
    >
      {active && <motion.span layoutId="nav-active" className="nav-active-bg" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
      <span className="nav-icon" style={accent ? { color: accent } : undefined}><Icon size={17} strokeWidth={active ? 2.2 : 1.8} /></span>
      {!collapsed && <span className="nav-label">{label}</span>}
      {!collapsed && status}
      {!!count && <span className={cx('nav-count', collapsed && 'is-dot')}>{collapsed ? '' : count > 9999 ? '9999+' : number(count)}</span>}
    </button>
  );
}

function AccountStatusIcon({ a }: { a: AccountSummary }) {
  const st = a.status.state;
  if (st === 'syncing' || st === 'connecting') return <span className="acct-status" data-tip={a.status.message || '同步中'}><Spinner size={12} /></span>;
  if (st === 'error') return <span className="acct-status is-error" data-tip={a.status.diagnosis?.title || a.status.message || '连接失败'}><AlertTriangle size={13} /></span>;
  if (st === 'offline') return <span className="acct-status is-muted" data-tip="离线"><WifiOff size={12} /></span>;
  if (st === 'disabled') return <span className="acct-status is-muted" data-tip="已停用"><Clock3 size={12} /></span>;
  return null;
}

export function Sidebar() {
  const s = useApp();
  const collapsed = !!s.settings?.sidebarCollapsed;
  const [showMore, setShowMore] = useState(false);
  const foldersByAccount = useMemo(() => {
    const m = new Map<number, FolderInfo[]>();
    for (const f of s.folders) {
      if (!m.has(f.accountId)) m.set(f.accountId, []);
      m.get(f.accountId)!.push(f);
    }
    return m;
  }, [s.folders]);
  const isActive = (v: ViewSpec) => s.panel === 'mail' && sameView(s.view, v);
  const syncing = s.accounts.some((a) => a.status.state === 'syncing' || a.status.state === 'connecting');
  const errors = s.accounts.filter((a) => a.status.state === 'error');
  const backfill = s.accounts.map((a) => a.status.progress).filter(Boolean)[0];
  const unifiedCount = (box: UnifiedBox) => (box === 'inbox' ? s.counts.inboxUnread : box === 'starred' ? s.counts.starred : box === 'unread' ? s.counts.unreadTotal : 0);

  const toggleAccount = (id: number) => {
    useApp.setState({ collapsedAccounts: { ...s.collapsedAccounts, [id]: !s.collapsedAccounts[id] } });
    persistUi();
  };

  const moveDrop = (folder: FolderInfo) => (ids: number[]) => void s.moveTo(ids, folder.id);

  const newFolder = (a: AccountSummary, parent?: FolderInfo) => s.openModal({
    type: 'prompt', title: parent ? `在「${folderName(parent)}」中新建文件夹` : `在 ${a.email} 中新建文件夹`, label: '文件夹名称', initial: '', confirmLabel: '创建',
    onSubmit: (name) => api.createFolder(a.id, name, parent?.path).then(() => s.toast({ kind: 'success', message: `已创建文件夹「${name}」` })).catch((e) => s.toast({ kind: 'error', message: '无法创建文件夹', detail: errorMessage(e).title }))
  });

  const accountMenu = (a: AccountSummary): MenuItem[] => {
    const inbox = foldersByAccount.get(a.id)?.find((f) => f.specialUse === 'inbox');
    return [
      { label: '立即收取', icon: <RefreshCw size={15} />, onSelect: () => api.syncNow(a.id) },
      { label: '收件箱全部标为已读', icon: <MailOpen size={15} />, disabled: !inbox?.unread, onSelect: () => inbox && api.markFolderRead(inbox.id) },
      { label: '新建文件夹', icon: <FolderPlus size={15} />, onSelect: () => newFolder(a) },
      { separator: true },
      { label: '用此账户写邮件', icon: <PenLine size={15} />, onSelect: () => s.compose({ accountId: a.id }) },
      { label: '诊断连接', icon: <Stethoscope size={15} />, onSelect: () => s.openModal({ type: 'diagnose', accountId: a.id }) },
      { label: '账户设置', icon: <SettingsIcon size={15} />, onSelect: () => s.openModal({ type: 'settings', section: 'accounts', accountId: a.id }) }
    ];
  };

  const folderMenu = (a: AccountSummary, f: FolderInfo): MenuItem[] => [
    { label: '全部标为已读', icon: <MailOpen size={15} />, disabled: !f.unread, onSelect: () => api.markFolderRead(f.id) },
    { label: '立即同步', icon: <RefreshCw size={15} />, onSelect: () => api.setActiveFolder(f.id) },
    { separator: true },
    { label: '新建子文件夹', icon: <FolderPlus size={15} />, onSelect: () => newFolder(a, f) },
    ...(!f.specialUse ? [
      { label: '重命名', icon: <PenLine size={15} />, onSelect: () => s.openModal({ type: 'prompt', title: '重命名文件夹', label: '新名称', initial: f.name, confirmLabel: '重命名', onSubmit: (n) => api.renameFolder(f.id, n).catch((e) => s.toast({ kind: 'error', message: '重命名失败', detail: errorMessage(e).title })) }) },
      { label: '删除文件夹', icon: <Trash2 size={15} />, danger: true, onSelect: () => s.openModal({ type: 'confirm', title: `删除「${f.name}」？`, message: '文件夹及其中的所有邮件将从服务器上删除，无法恢复。', confirmLabel: '删除', danger: true, onConfirm: () => api.deleteFolder(f.id).catch((e) => s.toast({ kind: 'error', message: '删除失败', detail: errorMessage(e).title })) }) }
    ] as MenuItem[] : [])
  ];

  const toggleTheme = () => s.updateSettings({ theme: s.dark ? 'light' : 'dark' });

  return (
    <aside className={cx('sidebar', collapsed && 'is-collapsed')}>
      <div className="sidebar-head drag">
        <div className="brand">
          <LogoMark size={26} />
          {!collapsed && <Wordmark />}
        </div>
        {!collapsed && (
          <IconButton className="no-drag" tip="收起侧栏" size="s" onClick={() => s.updateSettings({ sidebarCollapsed: true })}><PanelLeftClose size={16} /></IconButton>
        )}
      </div>
      {collapsed && (
        <IconButton className="sidebar-expand" tip="展开侧栏" onClick={() => s.updateSettings({ sidebarCollapsed: false })}><PanelLeftOpen size={17} /></IconButton>
      )}

      <div className="compose-wrap">
        <button className="compose-btn" onClick={() => s.compose()} data-tip={collapsed ? '写邮件  C' : undefined} data-tip-side="right">
          <PenLine size={17} strokeWidth={2.1} />
          {!collapsed && <span>写邮件</span>}
          {!collapsed && <kbd className="compose-kbd">C</kbd>}
        </button>
      </div>

      <nav className="sidebar-scroll">
        <div className="nav-group">
          {UNIFIED.map((u) => (
            <NavItem key={u.box} icon={u.icon} label={u.label} collapsed={collapsed} count={unifiedCount(u.box)} active={isActive({ kind: 'unified', box: u.box })} onClick={() => s.setView({ kind: 'unified', box: u.box })} />
          ))}
          {s.counts.outbox > 0 && (
            <NavItem icon={Clock3} label="发件箱" collapsed={collapsed} count={s.counts.outbox} active={s.panel === 'outbox'} onClick={() => s.setPanel('outbox')} />
          )}
          {s.counts.drafts > 0 && (
            <NavItem icon={PenLine} label="本地草稿" collapsed={collapsed} count={s.counts.drafts} active={s.panel === 'drafts'} onClick={() => s.setPanel('drafts')} />
          )}
          {(showMore || MORE.some((m) => isActive({ kind: 'unified', box: m.box }))) && MORE.map((u) => (
            <NavItem key={u.box} icon={u.icon} label={u.label} collapsed={collapsed} active={isActive({ kind: 'unified', box: u.box })} onClick={() => s.setView({ kind: 'unified', box: u.box })} />
          ))}
          {!collapsed && (
            <button className="nav-more" onClick={() => setShowMore(!showMore)}>
              <ChevronDown size={14} style={{ transform: showMore ? 'rotate(180deg)' : undefined }} />
              {showMore ? '收起' : '更多'}
            </button>
          )}
        </div>

        {s.accounts.map((a) => {
          const folders = foldersByAccount.get(a.id) || [];
          const { specials, tree } = folderTree(folders);
          const flat = flattenTree(tree, new Set(Object.entries(s.collapsedFolders).filter(([, v]) => v).map(([k]) => Number(k))));
          const isCollapsed = !!s.collapsedAccounts[a.id];
          const inboxUnread = folders.find((f) => f.specialUse === 'inbox')?.unread || 0;
          return (
            <div key={a.id} className={cx('nav-group', 'account-group', !a.enabled && 'is-disabled')}>
              {collapsed ? (
                <button className="acct-chip" style={{ ['--acct' as any]: a.color }} data-tip={a.email} data-tip-side="right" onClick={() => { const inbox = folders.find((f) => f.specialUse === 'inbox'); if (inbox) s.setView({ kind: 'folder', accountId: a.id, folderId: inbox.id }); }} onContextMenu={(e) => showContextMenu(e, accountMenu(a))}>
                  {(a.label || a.email)[0].toUpperCase()}
                  {inboxUnread > 0 && <span className="acct-chip-dot" />}
                </button>
              ) : (
                <button className="acct-head" onClick={() => toggleAccount(a.id)} onContextMenu={(e) => showContextMenu(e, accountMenu(a))}>
                  <span className="acct-dot" style={{ background: a.color }} />
                  <span className="acct-name" title={a.email}>{a.label || a.email}</span>
                  <AccountStatusIcon a={a} />
                  {isCollapsed && inboxUnread > 0 && <span className="nav-count">{number(inboxUnread)}</span>}
                  <ChevronDown size={14} className={cx('acct-chevron', isCollapsed && 'is-collapsed')} />
                </button>
              )}
              {!collapsed && !isCollapsed && (
                <div className="acct-folders">
                  {a.status.state === 'error' && a.status.diagnosis && (
                    <button className="acct-error" onClick={() => s.openModal({ type: 'diagnose', accountId: a.id })}>
                      <AlertTriangle size={14} />
                      <span>{a.status.diagnosis.title}</span>
                      <span className="acct-error-cta">诊断</span>
                    </button>
                  )}
                  {specials.map((f) => (
                    <NavItem key={f.id} icon={SPECIAL_ICONS[f.specialUse!] || Folder} label={folderName(f)} count={f.specialUse === 'drafts' || f.specialUse === 'sent' || f.specialUse === 'trash' || f.specialUse === 'all' ? 0 : f.unread}
                      active={isActive({ kind: 'folder', accountId: a.id, folderId: f.id })} onClick={() => s.setView({ kind: 'folder', accountId: a.id, folderId: f.id })}
                      onContextMenu={(e) => showContextMenu(e, folderMenu(a, f))} onDrop={moveDrop(f)} />
                  ))}
                  {flat.map((n) => (
                    <NavItem key={n.folder.id} icon={Folder} label={n.folder.name} depth={n.depth} count={n.folder.unread}
                      active={isActive({ kind: 'folder', accountId: a.id, folderId: n.folder.id })} onClick={() => s.setView({ kind: 'folder', accountId: a.id, folderId: n.folder.id })}
                      onContextMenu={(e) => showContextMenu(e, folderMenu(a, n.folder))} onDrop={moveDrop(n.folder)}
                      status={n.children.length ? (
                        <span className="folder-toggle" onClick={(e) => { e.stopPropagation(); useApp.setState({ collapsedFolders: { ...s.collapsedFolders, [n.folder.id]: !s.collapsedFolders[n.folder.id] } }); persistUi(); }}>
                          <ChevronDown size={13} style={{ transform: s.collapsedFolders[n.folder.id] ? 'rotate(-90deg)' : undefined }} />
                        </span>
                      ) : undefined} />
                  ))}
                  {!folders.length && a.enabled && <div className="acct-loading"><Spinner size={13} /> 正在读取文件夹…</div>}
                </div>
              )}
            </div>
          );
        })}

        <button className={cx('nav-item', 'add-account')} onClick={() => s.openModal({ type: 'add-account' })} data-tip={collapsed ? '添加账户' : undefined} data-tip-side="right">
          <span className="nav-icon"><Plus size={17} /></span>
          {!collapsed && <span className="nav-label">添加账户</span>}
        </button>
      </nav>

      <div className="sidebar-foot">
        {!collapsed && (
          <div className="sync-line" title={errors.map((a) => `${a.email}: ${a.status.diagnosis?.title || a.status.message}`).join('\n')}>
            {!s.online ? (
              <><WifiOff size={13} /> <span>离线 · 恢复联网后自动同步</span></>
            ) : errors.length ? (
              <><AlertTriangle size={13} className="text-danger" /> <span>{errors.length} 个账户连接异常</span></>
            ) : syncing ? (
              <><Spinner size={12} /> <span>正在同步…</span></>
            ) : backfill ? (
              <><span className="mini-progress"><span style={{ width: `${Math.min(100, (backfill.done / Math.max(1, backfill.total)) * 100)}%` }} /></span><span>{backfill.label} {number(backfill.done)}/{number(backfill.total)}</span></>
            ) : (
              <><span className="sync-ok-dot" /> <span>已同步</span></>
            )}
          </div>
        )}
        <div className="sidebar-foot-actions">
          <IconButton tip={s.dark ? '浅色模式' : '深色模式'} size="s" onClick={toggleTheme}>{s.dark ? <Sun size={16} /> : <Moon size={16} />}</IconButton>
          <IconButton tip="立即收取" size="s" onClick={() => api.syncNow(null)}><RefreshCw size={16} /></IconButton>
          <IconButton tip="设置" kbd="Ctrl ," size="s" onClick={() => s.openModal({ type: 'settings' })}><SettingsIcon size={16} /></IconButton>
        </div>
      </div>
    </aside>
  );
}
