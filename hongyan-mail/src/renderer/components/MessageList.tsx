import React, { useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Archive, Ban, Check, CheckCheck, Copy, Filter, Forward, FolderInput, ListChecks, MailOpen, Mail, MoreHorizontal, Paperclip, Reply, ReplyAll,
  Search, Server, ShieldAlert, Star, Tag, Trash2, CornerUpLeft, BrushCleaning
} from 'lucide-react';
import type { Category, CategoryCounts, MessageSummary } from '@shared/types';
import { PAGE, useApp, listQuery } from '../store';
import { api, errorMessage } from '../api';
import { UNIFIED_NAMES, folderName, viewKey } from '../lib/folders';
import { addressLine, dateBucket, displayName, listTime, number } from '../lib/format';
import { parseQuery } from '@shared/search';
import { Avatar, cx, Dropdown, IconButton, Spinner, showContextMenu, showContextMenuAt, type MenuItem } from './ui';
import { EmptyState } from './EmptyState';
import { confirmBlock, deleteAllFrom } from '../lib/contextmenu';

const CATEGORIES: Array<{ id: Category | 'all'; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'primary', label: '主要' },
  { id: 'notifications', label: '通知' },
  { id: 'promotions', label: '推广' },
  { id: 'social', label: '社交' }
];

const CATEGORY_NAMES: Record<Category, string> = { primary: '主要', notifications: '通知', promotions: '推广', social: '社交' };
const CATS: Category[] = ['primary', 'notifications', 'promotions', 'social'];

function useViewTitle() {
  const { view, folders, accounts } = useApp();
  if (view.kind === 'unified') return { title: UNIFIED_NAMES[view.box], sub: accounts.length > 1 ? `全部 ${accounts.length} 个账户` : accounts[0]?.email || '' };
  if (view.kind === 'folder') {
    const f = folders.find((x) => x.id === view.folderId);
    const a = accounts.find((x) => x.id === view.accountId);
    return { title: f ? folderName(f) : '文件夹', sub: a ? a.label || a.email : '' };
  }
  return { title: '搜索结果', sub: view.query };
}

function highlight(text: string, terms: string[]): React.ReactNode {
  if (!terms.length || !text) return text;
  const esc = terms.filter((t) => t.length > 0).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!esc.length) return text;
  const re = new RegExp(`(${esc.join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p));
}

export function messageMenu(m: MessageSummary, ids: number[]): MenuItem[] {
  const s = useApp.getState();
  const accountFolders = s.folders.filter((f) => f.accountId === m.accountId && f.id !== m.folderId);
  const folder = s.folders.find((f) => f.id === m.folderId);
  const multi = ids.length > 1;
  const mine = !!m.from && s.accounts.some((a) => a.email.toLowerCase() === m.from!.address);
  const junk = folder?.specialUse === 'junk';
  const sender: MenuItem[] = m.from && !multi ? [
    { separator: true },
    { heading: m.from.address },
    { label: '复制发件人地址', icon: <Copy size={15} />, onSelect: () => { void api.copyText(m.from!.address); s.toast({ kind: 'success', message: '邮箱地址已复制', duration: 1600 }); } },
    ...(!mine ? [
      { label: '删除此发件人的所有邮件', icon: <Trash2 size={15} />, onSelect: () => void deleteAllFrom(m.from!.address) },
      ...(!junk ? [{ label: '屏蔽此发件人', icon: <Ban size={15} />, danger: true, onSelect: () => confirmBlock(m.from!.address) }] : [])
    ] : [])
  ] : [];
  return [
    ...(!multi ? [
      { label: '回复', icon: <Reply size={15} />, kbd: 'R', onSelect: () => s.reply('reply', m.id) },
      { label: '全部回复', icon: <ReplyAll size={15} />, kbd: 'A', onSelect: () => s.reply('replyAll', m.id) },
      { label: '转发', icon: <Forward size={15} />, kbd: 'F', onSelect: () => s.reply('forward', m.id) },
      { separator: true }
    ] as MenuItem[] : []),
    { label: m.seen ? '标为未读' : '标为已读', icon: m.seen ? <Mail size={15} /> : <MailOpen size={15} />, kbd: 'U', onSelect: () => s.setSeen(ids, !m.seen) },
    { label: m.flagged ? '取消星标' : '添加星标', icon: <Star size={15} />, kbd: 'S', onSelect: () => s.setFlagged(ids, !m.flagged) },
    { separator: true },
    { label: '归档', icon: <Archive size={15} />, kbd: 'E', onSelect: () => s.act('archive', ids) },
    { label: '移动到', icon: <FolderInput size={15} />, submenu: accountFolders.slice(0, 40).map((f) => ({ label: folderName(f), onSelect: () => s.moveTo(ids, f.id) })) },
    { label: '分类为', icon: <Tag size={15} />, submenu: [
      ...CATS.map((c) => ({ label: CATEGORY_NAMES[c], checked: m.category === c, onSelect: () => { void api.setCategory(ids, c, false); } })),
      { separator: true },
      { heading: m.from ? `来自 ${m.from.address} 的邮件` : '此发件人' },
      ...CATS.map((c) => ({
        label: `总是归为「${CATEGORY_NAMES[c]}」`,
        disabled: !m.from,
        onSelect: () => { void api.setCategory(ids, c, true); s.toast({ kind: 'success', message: `今后 ${m.from?.address} 的邮件都会归为「${CATEGORY_NAMES[c]}」` }); }
      }))
    ] },
    folder?.specialUse === 'junk'
      ? { label: '不是垃圾邮件', icon: <CornerUpLeft size={15} />, onSelect: () => s.act('notspam', ids) }
      : { label: '标记为垃圾邮件', icon: <ShieldAlert size={15} />, kbd: '!', onSelect: () => s.act('spam', ids) },
    { label: folder?.specialUse === 'trash' ? '永久删除' : '删除', icon: <Trash2 size={15} />, kbd: 'Del', danger: true, onSelect: () => s.act('trash', ids) },
    ...sender
  ];
}

function MessageRow({ m, selected, open, showAvatar, showSnippet, multiAccount, terms, isSentView }: {
  m: MessageSummary; selected: boolean; open: boolean; showAvatar: boolean; showSnippet: boolean; multiAccount: boolean; terms: string[]; isSentView: boolean;
}) {
  const s = useApp.getState;
  const account = useApp((st) => st.accounts.find((a) => a.id === m.accountId));
  const me = useMemo(() => new Set(useApp.getState().accounts.map((a) => a.email)), []);
  const who = isSentView ? (m.to.length ? `发给 ${addressLine(m.to, me, 2)}` : '（无收件人）') : displayName(m.from, me);
  const avatarAddr = isSentView ? m.to[0] : m.from;
  const onClick = (e: React.MouseEvent) => {
    const mode = e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'single';
    s().select(m.id, mode);
  };
  const ids = () => (s().selection.includes(m.id) ? s().selection : [m.id]);
  // With "select all in view" the menu acts on every matching message, not just the loaded ones.
  const menuIds = async () => (s().allSelected && s().selection.includes(m.id) ? s().targetIds() : ids());
  return (
    <div
      className={cx('row', !m.seen && 'is-unread', selected && 'is-selected', open && 'is-open')}
      onClick={onClick}
      onContextMenu={(e) => {
        if (!s().selection.includes(m.id)) s().select(m.id, 'single');
        if (s().allSelected) {
          e.preventDefault();
          e.stopPropagation();
          const { clientX, clientY } = e;
          void menuIds().then((list) => showContextMenuAt(messageMenu(m, list), clientX, clientY));
        } else showContextMenu(e, messageMenu(m, ids()));
      }}
      draggable
      onDragStart={(e) => {
        const list = ids();
        e.dataTransfer.setData('application/x-hy-messages', JSON.stringify(list));
        e.dataTransfer.effectAllowed = 'move';
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.textContent = list.length > 1 ? `${list.length} 封邮件` : m.subject || '（无主题）';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 12, 12);
        setTimeout(() => ghost.remove(), 0);
      }}
      role="option"
      aria-selected={selected}
    >
      <span className="row-unread-dot" />
      {showAvatar && (
        <div className="row-avatar">
          {selected && useApp.getState().selection.length > 1 ? (
            <span className="row-check"><Check size={16} strokeWidth={2.6} /></span>
          ) : (
            <Avatar name={avatarAddr?.name || ''} address={avatarAddr?.address || '?'} size={36} ring={multiAccount ? account?.color : undefined} />
          )}
        </div>
      )}
      <div className="row-main">
        <div className="row-line1">
          <span className="row-from">{highlight(who, terms)}</span>
          {m.draft && <span className="row-tag is-draft">草稿</span>}
          {multiAccount && account && !showAvatar && <span className="row-account" style={{ background: account.color }} title={account.email} />}
          <span className="row-time">{listTime(m.date)}</span>
        </div>
        <div className="row-line2">
          <span className="row-subject">{m.answered && <CornerUpLeft size={12} className="row-replied" />}<span className="row-subject-text">{highlight(m.subject || '（无主题）', terms)}</span></span>
          <span className="row-icons">
            {m.hasAttachments && <Paperclip size={13} />}
            {m.flagged && <Star size={13} className="row-star" fill="currentColor" />}
          </span>
        </div>
        {showSnippet && (
          <div className="row-snippet">
            {m.snippet === null ? <span className="skeleton-text" style={{ width: `${45 + (m.id % 40)}%` }} /> : highlight(m.snippet || '（无正文）', terms)}
          </div>
        )}
      </div>
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        <IconButton size="s" tip="归档" onClick={() => s().act('archive', [m.id])}><Archive size={15} /></IconButton>
        <IconButton size="s" tip="删除" onClick={() => s().act('trash', [m.id])}><Trash2 size={15} /></IconButton>
        <IconButton size="s" tip={m.seen ? '标为未读' : '标为已读'} onClick={() => s().setSeen([m.id], !m.seen)}>{m.seen ? <Mail size={15} /> : <MailOpen size={15} />}</IconButton>
        <IconButton size="s" tip={m.flagged ? '取消星标' : '加星标'} onClick={() => s().setFlagged([m.id], !m.flagged)} className={m.flagged ? 'is-starred' : ''}><Star size={15} fill={m.flagged ? 'currentColor' : 'none'} /></IconButton>
      </div>
    </div>
  );
}

function SkeletonRow({ showAvatar }: { showAvatar: boolean }) {
  return (
    <div className="row is-skeleton">
      {showAvatar && <div className="row-avatar"><span className="skeleton-circle" /></div>}
      <div className="row-main">
        <div className="row-line1"><span className="skeleton-text" style={{ width: '38%' }} /></div>
        <div className="row-line2"><span className="skeleton-text" style={{ width: '72%' }} /></div>
        <div className="row-snippet"><span className="skeleton-text" style={{ width: '58%' }} /></div>
      </div>
    </div>
  );
}

export function MessageList() {
  const s = useApp();
  const { title, sub } = useViewTitle();
  const parentRef = useRef<HTMLDivElement>(null);
  const settings = s.settings!;
  const compact = settings.density === 'compact';
  const showAvatar = settings.showAvatars && !compact;
  const showSnippet = settings.showSnippets;
  const multiAccount = s.accounts.length > 1 && s.view.kind !== 'folder';
  const view = s.view;
  const viewFolderSU = view.kind === 'folder' ? s.folders.find((f) => f.id === view.folderId)?.specialUse ?? null : null;
  const inboxLike = (view.kind === 'unified' && view.box === 'inbox') || viewFolderSU === 'inbox';
  const isSentView = (view.kind === 'unified' && (view.box === 'sent' || view.box === 'drafts')) || viewFolderSU === 'sent' || viewFolderSU === 'drafts';
  const terms = useMemo(() => (s.view.kind === 'search' ? parseQuery(s.view.query).text.concat(parseQuery(s.view.query).subject) : []), [s.view]);
  const [catCounts, setCatCounts] = React.useState<CategoryCounts | null>(null);
  const [serverSearching, setServerSearching] = React.useState(false);

  const total = s.list.total;
  const rowHeight = compact ? (showSnippet ? 62 : 44) : showSnippet ? 84 : 62;

  const groupStarts = useMemo(() => {
    const starts = new Map<number, string>();
    const st = useApp.getState();
    for (const [p, items] of Object.entries(s.list.pages)) {
      items.forEach((m, i) => {
        const idx = Number(p) * PAGE + i;
        const bucket = dateBucket(m.date);
        const prev = idx > 0 ? st.itemAt(idx - 1) : undefined;
        if (idx === 0 || (prev && dateBucket(prev.date) !== bucket)) starts.set(idx, bucket);
      });
    }
    return starts;
  }, [s.list.pages]);

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => rowHeight + (groupStarts.has(i) ? 30 : 0),
    overscan: 8
  });

  useEffect(() => {
    virtualizer.measure();
  }, [groupStarts, rowHeight]);

  const items = virtualizer.getVirtualItems();
  useEffect(() => {
    if (!items.length) return;
    const first = Math.floor(items[0].index / PAGE);
    const last = Math.floor(items[items.length - 1].index / PAGE);
    for (let p = first; p <= last; p++) s.loadPage(p);
  }, [items.length ? items[0].index : -1, items.length ? items[items.length - 1].index : -1, s.list.key]);

  // keep the open message in view when navigating with the keyboard
  useEffect(() => {
    if (s.openId == null) return;
    const idx = s.indexOf(s.openId);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'auto' });
  }, [s.openId]);

  const resetKey = `${viewKey(s.view)}|${s.filter}|${s.category}|${s.accountFilter}`;
  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [resetKey]);

  useEffect(() => {
    if (!inboxLike || !settings.categoriesEnabled) return;
    api.categoryCounts(listQuery(s)).then(setCatCounts).catch(() => {});
  }, [s.list, inboxLike]);

  const selectedSet = new Set(s.selection);
  const filterLabel = { all: '全部', unread: '未读', starred: '星标', attachments: '带附件' }[s.filter];
  const unreadInView = Object.values(s.list.pages).flat().some((m) => !m.seen) || (inboxLike && !!catCounts?.all);
  const junkOrTrash = viewFolderSU === 'junk' || viewFolderSU === 'trash' || (view.kind === 'unified' && (view.box === 'junk' || view.box === 'trash'));
  const emptyTargets = s.folders.filter((f) => (view.kind === 'folder' ? f.id === view.folderId : view.kind === 'unified' && f.specialUse === view.box && (s.accountFilter == null || f.accountId === s.accountFilter)));
  const emptyFolders = () => {
    const what = (viewFolderSU || (view.kind === 'unified' ? view.box : '')) === 'junk' ? '垃圾邮件' : '已删除';
    s.openModal({
      type: 'confirm',
      title: `清空「${what}」？`,
      message: `将从邮件服务器上永久删除「${what}」中的全部 ${total} 封邮件${emptyTargets.length > 1 ? `（${emptyTargets.length} 个账户）` : ''}，此操作无法撤销。`,
      confirmLabel: '永久删除',
      danger: true,
      onConfirm: () => {
        Promise.all(emptyTargets.map((f) => api.emptyFolder(f.id)))
          .then((r) => s.toast({ kind: 'success', message: `已清空「${what}」`, detail: `永久删除了 ${r.reduce((a, b) => a + b, 0)} 封邮件` }))
          .catch((e) => s.toast({ kind: 'error', message: '清空失败', detail: errorMessage(e).title }));
      }
    });
  };
  const viewMenu: MenuItem[] = [
    { label: '全部标为已读', icon: <CheckCheck size={15} />, disabled: !unreadInView, onSelect: () => void s.markAllRead() },
    { label: `选择全部 ${number(total)} 封`, icon: <ListChecks size={15} />, kbd: 'Ctrl A', disabled: !total, onSelect: () => { s.selectAll(); s.selectAllMatching(); } },
    ...(junkOrTrash ? [
      { separator: true },
      { label: viewFolderSU === 'junk' || (view.kind === 'unified' && view.box === 'junk') ? '清空垃圾邮件' : '清空已删除', icon: <BrushCleaning size={15} />, danger: true, disabled: !total || !emptyTargets.length, onSelect: emptyFolders }
    ] as MenuItem[] : [])
  ];

  const searchServer = async () => {
    if (s.view.kind !== 'search') return;
    setServerSearching(true);
    try {
      const r = await api.searchServer(s.view.query, s.view.accountId ?? null);
      s.toast({ kind: r.errors.length ? 'error' : 'success', message: r.imported ? `从服务器找到 ${r.imported} 封新匹配的邮件` : '服务器上没有更多匹配的邮件', detail: r.errors[0] });
      void s.reloadList();
    } catch (e) {
      s.toast({ kind: 'error', message: '服务器搜索失败', detail: errorMessage(e).title });
    } finally {
      setServerSearching(false);
    }
  };

  return (
    <section className="list-pane" aria-label="邮件列表">
      <header className="list-head">
        <div className="list-title">
          <h1>{title}</h1>
          <span className="list-sub" title={sub}>{s.list.loaded ? `${number(total)} 封` : ''}{sub && s.view.kind !== 'search' ? ` · ${sub}` : ''}</span>
        </div>
        <div className="list-tools">
          {unreadInView && (
            <IconButton tip={s.category !== 'all' && inboxLike ? `「${CATEGORY_NAMES[s.category as Category]}」全部标为已读` : '全部标为已读'} size="s" onClick={() => void s.markAllRead()}><CheckCheck size={16} /></IconButton>
          )}
          <Dropdown align="end" items={viewMenu} trigger={(p) => <IconButton tip="更多操作" size="s" {...p}><MoreHorizontal size={16} /></IconButton>} />
          <Dropdown align="end" items={[
            { heading: '显示' },
            ...(['all', 'unread', 'starred', 'attachments'] as const).map((f) => ({ label: { all: '全部邮件', unread: '仅未读', starred: '仅星标', attachments: '仅带附件' }[f], checked: s.filter === f, onSelect: () => s.setFilter(f) })),
            ...(s.accounts.length > 1 && s.view.kind === 'unified' ? [{ separator: true }, { heading: '账户' }, { label: '全部账户', checked: s.accountFilter == null, onSelect: () => s.setAccountFilter(null) },
              ...s.accounts.map((a) => ({ label: a.label || a.email, checked: s.accountFilter === a.id, onSelect: () => s.setAccountFilter(a.id) }))] as MenuItem[] : [])
          ]} trigger={(p) => (
            <button className={cx('chip-btn', (s.filter !== 'all' || s.accountFilter != null) && 'is-active')} {...p}>
              <Filter size={13} />
              <span>{s.accountFilter != null ? (s.accounts.find((a) => a.id === s.accountFilter)?.email.split('@')[0] + ' · ') : ''}{filterLabel}</span>
            </button>
          )} />
        </div>
      </header>

      {inboxLike && settings.categoriesEnabled && s.view.kind !== 'search' && (
        <div className="cat-tabs" role="tablist">
          {CATEGORIES.map((c) => (
            <button key={c.id} role="tab" aria-selected={s.category === c.id} className={cx('cat-tab', s.category === c.id && 'is-active')} onClick={() => s.setCategory(c.id)}>
              {c.label}
              {c.id !== 'all' && !!catCounts?.[c.id] && <span className="cat-count">{catCounts[c.id] > 99 ? '99+' : catCounts[c.id]}</span>}
            </button>
          ))}
        </div>
      )}

      {s.view.kind === 'search' && (
        <div className="search-banner">
          <Search size={14} />
          <span>本地已索引的邮件中找到 {number(total)} 封</span>
          <button className="link-btn" onClick={searchServer} disabled={serverSearching}>
            {serverSearching ? <Spinner size={12} /> : <Server size={13} />} 在服务器上搜索正文
          </button>
        </div>
      )}

      <div className="list-scroll" ref={parentRef} role="listbox" aria-multiselectable tabIndex={-1}>
        {!s.list.loaded ? (
          Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} showAvatar={showAvatar} />)
        ) : total === 0 ? (
          <EmptyState view={s.view} filter={s.filter} syncing={s.accounts.some((a) => a.status.state === 'syncing' || a.status.state === 'connecting')} />
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {items.map((vi) => {
              const m = s.itemAt(vi.index);
              const group = groupStarts.get(vi.index);
              return (
                <div key={vi.key} data-index={vi.index} ref={virtualizer.measureElement} className="row-slot" style={{ transform: `translateY(${vi.start}px)` }}>
                  {group && <div className="group-label">{group}</div>}
                  {m ? (
                    <MessageRow m={m} selected={selectedSet.has(m.id)} open={s.openId === m.id} showAvatar={showAvatar} showSnippet={showSnippet} multiAccount={multiAccount} terms={terms} isSentView={isSentView} />
                  ) : (
                    <SkeletonRow showAvatar={showAvatar} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
