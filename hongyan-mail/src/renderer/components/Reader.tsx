import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive, ChevronDown, ChevronUp, Code2, Download, ExternalLink, Eye, FileArchive, FileAudio, FileImage, FileSpreadsheet,
  FileText, FileVideo, File as FileIcon, Forward, FolderInput, ImageOff, Mail, MailOpen, MoreHorizontal, Presentation,
  Reply, ReplyAll, RotateCw, Send, ShieldAlert, Star, Trash2, UserCheck, BellOff, AlertTriangle, Clock3, Pencil, X, CornerUpLeft,
  Ban, Copy
} from 'lucide-react';
import type { Address, AttachmentInfo, MessageDetail, MessageSummary } from '@shared/types';
import { useApp } from '../store';
import { api, errorMessage, ApiError } from '../api';
import { addressLine, displayName, fileSize, formatAddress, listTime, longTime, relativeTime } from '../lib/format';
import { folderName } from '../lib/folders';
import { Avatar, Button, cx, Dropdown, IconButton, showContextMenu, Spinner, type MenuItem } from './ui';
import { EmailFrame, type LinkHover } from './EmailFrame';
import { addressMenu, confirmBlock } from '../lib/contextmenu';
import { ReaderEmpty } from './EmptyState';

const CATEGORY_LABEL = { primary: '主要', notifications: '通知', promotions: '推广', social: '社交' } as const;

function fileIcon(a: AttachmentInfo) {
  const t = a.contentType.toLowerCase();
  const n = a.filename.toLowerCase();
  if (t.startsWith('image/')) return FileImage;
  if (t.startsWith('video/')) return FileVideo;
  if (t.startsWith('audio/')) return FileAudio;
  if (/\.(zip|rar|7z|gz|tar|bz2)$/.test(n) || /zip|compressed|archive/.test(t)) return FileArchive;
  if (/\.(xlsx?|csv|numbers|et)$/.test(n) || /sheet|excel/.test(t)) return FileSpreadsheet;
  if (/\.(pptx?|key|dps)$/.test(n) || /presentation|powerpoint/.test(t)) return Presentation;
  if (/\.(docx?|pdf|txt|md|rtf|wps)$/.test(n) || /pdf|word|text/.test(t)) return FileText;
  return FileIcon;
}

function fileTone(a: AttachmentInfo): string {
  const n = a.filename.toLowerCase();
  if (/\.pdf$/.test(n)) return 'tone-red';
  if (/\.(xlsx?|csv)$/.test(n)) return 'tone-green';
  if (/\.(docx?|wps)$/.test(n)) return 'tone-blue';
  if (/\.(pptx?)$/.test(n)) return 'tone-orange';
  if (a.contentType.startsWith('image/')) return 'tone-purple';
  if (/\.(zip|rar|7z)$/.test(n)) return 'tone-amber';
  return 'tone-gray';
}

function Attachments({ detail }: { detail: MessageDetail }) {
  const s = useApp.getState();
  const list = detail.attachments.filter((a) => !a.inline);
  if (!list.length) return null;
  const total = list.reduce((x, a) => x + a.size, 0);
  const run = (p: Promise<unknown>, ok?: string) => p.then((r) => { if (ok && r) s.toast({ kind: 'success', message: ok, detail: typeof r === 'string' ? r : undefined }); }).catch((e) => s.toast({ kind: 'error', message: errorMessage(e).title }));
  return (
    <div className="attachments">
      <div className="attachments-head">
        <span>{list.length} 个附件 · {fileSize(total)}</span>
        {list.length > 1 && <button className="link-btn" onClick={() => run(api.saveAllAttachments(detail.id), '附件已全部保存')}><Download size={13} /> 全部保存</button>}
      </div>
      <div className="attachments-grid">
        {list.map((a) => {
          const Icon = fileIcon(a);
          const isImage = a.contentType.startsWith('image/');
          return (
            <div key={a.index} className="att-card" onDoubleClick={() => run(api.openAttachment(detail.id, a.index))} title={a.filename}>
              {isImage ? (
                <button className="att-thumb" onClick={() => s.openModal({ type: 'image', src: `hy-att://m/${detail.id}/${a.index}?t=${detail.attachmentToken}`, name: a.filename, messageId: detail.id, index: a.index })}>
                  <img src={`hy-att://m/${detail.id}/${a.index}?t=${detail.attachmentToken}`} alt="" loading="lazy" />
                </button>
              ) : (
                <span className={cx('att-icon', fileTone(a))}><Icon size={20} strokeWidth={1.7} /></span>
              )}
              <div className="att-meta">
                <span className="att-name">{a.filename}</span>
                <span className="att-size">{fileSize(a.size)}</span>
              </div>
              <div className="att-actions">
                {isImage && <IconButton size="s" tip="预览" onClick={() => s.openModal({ type: 'image', src: `hy-att://m/${detail.id}/${a.index}?t=${detail.attachmentToken}`, name: a.filename, messageId: detail.id, index: a.index })}><Eye size={15} /></IconButton>}
                <IconButton size="s" tip="打开" onClick={() => run(api.openAttachment(detail.id, a.index))}><ExternalLink size={15} /></IconButton>
                <IconButton size="s" tip="另存为" onClick={() => run(api.saveAttachment(detail.id, a.index), '已保存')}><Download size={15} /></IconButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Selected text inside an element (so a right-click on a selection can still offer "copy"). */
function selectionWithin(el: Element): string {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return '';
  return sel.getRangeAt(0).intersectsNode(el) ? sel.toString() : '';
}

/** An address that can be selected, copied and right-clicked (copy, write to, search, block…). */
function AddressText({ a, sender }: { a: Address; sender?: boolean }) {
  return (
    <span className="addr" onContextMenu={(e) => showContextMenu(e, addressMenu(a, { sender, selection: selectionWithin(e.currentTarget) }))}>
      {formatAddress(a)}
    </span>
  );
}

function AddressList({ list, sender }: { list: Address[]; sender?: boolean }) {
  if (!list.length) return <>—</>;
  return <>{list.map((a, i) => <React.Fragment key={a.address + i}>{i > 0 && ', '}<AddressText a={a} sender={sender} /></React.Fragment>)}</>;
}

function RecipientDetails({ d }: { d: MessageDetail }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['发件人', d.from ? <AddressText a={d.from} sender /> : '—'],
    ...(d.replyTo.length && d.replyTo[0].address !== d.from?.address ? [['回复至', <AddressList list={d.replyTo} />] as [string, React.ReactNode]] : []),
    ['收件人', <AddressList list={d.to} />],
    ...(d.cc.length ? [['抄送', <AddressList list={d.cc} />] as [string, React.ReactNode]] : []),
    ...(d.bcc.length ? [['密送', <AddressList list={d.bcc} />] as [string, React.ReactNode]] : []),
    ['时间', longTime(d.date)],
    ['位置', d.folderPath]
  ];
  return (
    <div className="recipients">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}><span className="rk">{k}</span><span className="rv">{v}</span></React.Fragment>
      ))}
    </div>
  );
}

/** The URL of the hovered link, shown next to the link (like a tooltip) instead of over the message. */
function LinkPeek({ link }: { link: LinkHover | null }) {
  const [shown, setShown] = useState<LinkHover | null>(null);
  useEffect(() => {
    if (!link) { setShown(null); return; }
    const t = setTimeout(() => setShown(link), 250);
    return () => clearTimeout(t);
  }, [link]);
  useEffect(() => {
    if (!shown) return;
    const hide = () => setShown(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('mousedown', hide, true);
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('mousedown', hide, true); };
  }, [shown]);
  if (!shown) return null;
  const below = shown.bottom + 40 < window.innerHeight;
  const left = Math.max(8, Math.min(shown.left, window.innerWidth - 480));
  const text = shown.url.length > 160 ? shown.url.slice(0, 160) + '…' : shown.url;
  return (
    <div className={cx('link-peek', below ? 'is-below' : 'is-above')} style={below ? { left, top: shown.bottom + 6 } : { left, bottom: window.innerHeight - shown.top + 6 }}>
      <ExternalLink size={12} /> <span>{text}</span>
    </div>
  );
}

function MessageCard({ id, summary, expanded, onToggle, isLast, me, collapsible }: { id: number; summary?: MessageSummary; expanded: boolean; onToggle: () => void; isLast: boolean; me: Set<string>; collapsible: boolean }) {
  const s = useApp();
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [allowRemote, setAllowRemote] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [hoverLink, setHoverLink] = useState<LinkHover | null>(null);
  const settings = s.settings!;

  const load = () => {
    setLoading(true);
    setError(null);
    api.getMessage(id).then((d) => { setDetail(d); setAllowRemote(!settings.blockRemoteImages || d.trustedSender); }).catch(setError).finally(() => setLoading(false));
  };
  useEffect(() => { if (expanded && !detail) load(); }, [expanded, id]);
  // refresh flags after background changes without reloading the body
  useEffect(() => {
    if (!detail || !expanded) return;
    api.getMessage(id).then((d) => setDetail((cur) => (cur && cur.html === d.html && cur.text === d.text ? { ...cur, seen: d.seen, flagged: d.flagged, answered: d.answered, category: d.category } : d))).catch(() => {});
  }, [s.readerVersion]);

  const d = detail;
  const base = d || summary;
  if (!base && !loading && !error) return null;
  const from = base?.from || null;

  if (!expanded) {
    return (
      <button className="msg-card is-collapsed" onClick={onToggle}>
        <Avatar name={from?.name || ''} address={from?.address || '?'} size={30} />
        <span className="mc-from">{displayName(from, me)}</span>
        {base?.draft && <span className="row-tag is-draft">草稿</span>}
        <span className="mc-snippet">{base?.snippet || ''}</span>
        <span className="mc-date">{base ? listTime(base.date) : ''}</span>
      </button>
    );
  }

  const unsubscribe = async () => {
    try {
      const r = await api.unsubscribe(id);
      s.toast({ kind: 'success', message: r === 'opened' ? '已在浏览器中打开退订页面' : r === 'sent' ? '已发送退订邮件' : '该邮件没有提供退订方式' });
    } catch (e) { s.toast({ kind: 'error', message: errorMessage(e).title }); }
  };

  const more: MenuItem[] = d ? [
    { label: '回复', icon: <Reply size={15} />, onSelect: () => s.reply('reply', id) },
    { label: '全部回复', icon: <ReplyAll size={15} />, onSelect: () => s.reply('replyAll', id) },
    { label: '转发', icon: <Forward size={15} />, onSelect: () => s.reply('forward', id) },
    ...(d.draft ? [{ label: '编辑草稿', icon: <Pencil size={15} />, onSelect: () => s.reply('draft', id) }] : []),
    { separator: true },
    { label: d.seen ? '标为未读' : '标为已读', icon: d.seen ? <Mail size={15} /> : <MailOpen size={15} />, onSelect: () => { s.setSeen([id], !d.seen); setDetail({ ...d, seen: !d.seen }); } },
    ...(d.listUnsubscribe ? [{ label: '退订此邮件列表', icon: <BellOff size={15} />, onSelect: unsubscribe }] : []),
    ...(d.from ? [
      { label: '复制发件人地址', icon: <Copy size={15} />, onSelect: () => { void api.copyText(d.from!.address); s.toast({ kind: 'success', message: '邮箱地址已复制', duration: 1600 }); } },
      ...(!me.has(d.from.address) ? [{ label: '屏蔽发件人', icon: <Ban size={15} />, danger: true, onSelect: () => confirmBlock(d.from!.address) }] : [])
    ] : []),
    { separator: true },
    { label: '查看原始邮件', icon: <Code2 size={15} />, onSelect: () => s.openModal({ type: 'source', messageId: id }) },
    { label: '导出为 .eml', icon: <Download size={15} />, onSelect: () => api.exportEml(id).then((p) => p && s.toast({ kind: 'success', message: '已导出', detail: p })) },
    { label: '打印', icon: <FileText size={15} />, onSelect: () => api.printMessage(id).catch((e) => s.toast({ kind: 'error', message: errorMessage(e).title })) }
  ] : [];

  return (
    <article className={cx('msg-card', isLast && 'is-last')}>
      <header className="mc-head">
        {/* Not a <button>: text inside buttons cannot be selected. A click that ends a text selection does not collapse. */}
        <div className={cx('mc-head-main', collapsible && 'is-collapsible')} role={collapsible ? 'button' : undefined} tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? true : undefined}
          onKeyDown={(e) => { if (collapsible && e.key === 'Enter' && e.target === e.currentTarget) onToggle(); }}
          onClick={(e) => {
            // Clicking (or double-clicking to select) the name, address or recipients never collapses the message.
            if (!collapsible || (e.target as Element).closest('.mc-line, .mc-to') || selectionWithin(e.currentTarget)) return;
            onToggle();
          }}>
          <span className="mc-avatar" data-tip={collapsible ? '折叠' : undefined}><Avatar name={from?.name || ''} address={from?.address || '?'} size={40} /></span>
          <div className="mc-who">
            <div className="mc-line" onContextMenu={(e) => { if (from) showContextMenu(e, addressMenu(from, { sender: true, selection: selectionWithin(e.currentTarget) })); }}>
              <span className="mc-name">{displayName(from, me)}</span>
              {from && from.name && <span className="mc-addr">{from.address}</span>}
              {base?.draft && <span className="row-tag is-draft">草稿</span>}
            </div>
            <button className="mc-to" onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }} aria-expanded={showDetails}>
              <span className="mc-to-text">发给 {base ? addressLine(base.to, me, 3) || '（未填写）' : ''}{base && base.cc.length ? `，抄送 ${addressLine(base.cc, me, 2)}` : ''}</span>
              <ChevronDown size={13} style={{ transform: showDetails ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
            </button>
          </div>
        </div>
        <div className="mc-side">
          <span className="mc-date" title={base ? longTime(base.date) : ''}>{base ? relativeTime(base.date) : ''}</span>
          {d?.answered && <span className="mc-flag" data-tip="已回复"><CornerUpLeft size={14} /></span>}
          {d && <IconButton size="s" tip={d.flagged ? '取消星标' : '加星标'} className={d.flagged ? 'is-starred' : ''} onClick={() => { s.setFlagged([id], !d.flagged); setDetail({ ...d, flagged: !d.flagged }); }}><Star size={16} fill={d.flagged ? 'currentColor' : 'none'} /></IconButton>}
          <IconButton size="s" tip="回复" onClick={() => s.reply('reply', id)}><Reply size={16} /></IconButton>
          <Dropdown align="end" items={more} trigger={(p) => <IconButton size="s" tip="更多" {...p}><MoreHorizontal size={16} /></IconButton>} />
        </div>
      </header>
      <AnimatePresence initial={false}>
        {showDetails && d && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
            <RecipientDetails d={d} />
          </motion.div>
        )}
      </AnimatePresence>

      {loading && !d && (
        <div className="mc-loading">
          <div className="skeleton-text" style={{ width: '92%' }} />
          <div className="skeleton-text" style={{ width: '84%' }} />
          <div className="skeleton-text" style={{ width: '64%' }} />
          <div className="mc-loading-label"><Spinner size={13} /> 正在下载邮件…</div>
        </div>
      )}
      {error && (
        <div className="mc-error">
          <AlertTriangle size={18} />
          <div>
            <strong>{error instanceof ApiError && error.diagnosis ? error.diagnosis.title : '无法加载这封邮件'}</strong>
            <p>{error instanceof ApiError && error.diagnosis ? error.diagnosis.explanation : error.message}</p>
          </div>
          <Button size="s" icon={<RotateCw size={14} />} onClick={load}>重试</Button>
        </div>
      )}
      {d && (
        <>
          {remoteCount > 0 && !allowRemote && (
            <div className="remote-banner">
              <ImageOff size={15} />
              <span>为保护隐私，已阻止 {remoteCount} 张远程图片（可能用于追踪是否已读）。</span>
              <button className="link-btn" onClick={() => setAllowRemote(true)}>显示图片</button>
              {d.from && <button className="link-btn" onClick={() => { api.trustSender(d.from!.address); setAllowRemote(true); s.toast({ kind: 'success', message: `今后将自动显示 ${d.from!.address} 的图片` }); }}><UserCheck size={13} /> 始终信任此发件人</button>}
            </div>
          )}
          <div className={cx('mc-body', !d.html && 'is-plain')}>
            <EmailFrame
              html={d.html}
              text={d.text}
              messageId={d.id}
              attachmentToken={d.attachmentToken}
              attachments={d.attachments}
              allowRemote={allowRemote}
              dark={s.dark}
              darkMode={settings.darkEmailMode}
              collapseQuotes={true}
              onRemoteCount={setRemoteCount}
              onLinkHover={setHoverLink}
            />
          </div>
          <Attachments detail={d} />
          {d.listUnsubscribe && d.category === 'promotions' && (
            <div className="unsub-hint"><BellOff size={13} /> 不想再收到此类邮件？<button className="link-btn" onClick={unsubscribe}>退订</button></div>
          )}
        </>
      )}
      <LinkPeek link={hoverLink} />
    </article>
  );
}

function ThreadView({ openId }: { openId: number }) {
  const s = useApp();
  const [thread, setThread] = useState<number[]>([openId]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([openId]));
  const [summaries, setSummaries] = useState<Record<number, MessageSummary>>({});
  const me = useMemo(() => new Set(s.accounts.map((a) => a.email)), [s.accounts]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const current = s.itemAt(s.indexOf(openId)) || summaries[openId];

  // New replies arriving while a conversation is open join it.
  useEffect(() => {
    api.getThread(openId).then((t) => setThread((cur) => (t.ids.length !== cur.length ? t.ids : cur))).catch(() => {});
  }, [s.readerVersion]);

  useEffect(() => {
    let alive = true;
    setThread([openId]);
    setExpanded(new Set([openId]));
    scrollRef.current?.scrollTo({ top: 0 });
    api.getThread(openId).then(async (t) => {
      if (!alive) return;
      setThread(t.ids);
      const exp = new Set([openId]);
      // Expand unread messages of the conversation as well.
      const loaded = Object.values(useApp.getState().list.pages).flat();
      for (const id of t.ids) { const m = loaded.find((x) => x.id === id); if (m && !m.seen) exp.add(id); }
      setExpanded(exp);
      // Summaries for messages outside the current list (other folders).
      const missing = t.ids.filter((id) => !loaded.some((x) => x.id === id));
      if (missing.length) {
        const details = await Promise.all(missing.map((id) => api.getMessage(id).catch(() => null)));
        if (!alive) return;
        const map: Record<number, MessageSummary> = {};
        details.forEach((d) => { if (d) map[d.id] = d; });
        setSummaries((cur) => ({ ...cur, ...map }));
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [openId]);

  // Mark as read after the configured delay.
  useEffect(() => {
    const st = useApp.getState();
    const delay = st.settings?.markReadDelay ?? 0;
    const m = st.itemAt(st.indexOf(openId));
    if (!m || m.seen || delay < 0) return;
    const t = setTimeout(() => useApp.getState().setSeen([openId], true), delay * 1000);
    return () => clearTimeout(t);
  }, [openId]);

  const folder = current ? s.folders.find((f) => f.id === current.folderId) : undefined;
  const account = current ? s.accounts.find((a) => a.id === current.accountId) : undefined;
  const ids = [openId];
  const subject = current?.subject || summaries[openId]?.subject || '';
  const isTrash = folder?.specialUse === 'trash';
  const isJunk = folder?.specialUse === 'junk';
  const moveItems: MenuItem[] = s.folders.filter((f) => current && f.accountId === current.accountId && f.id !== current.folderId).map((f) => ({ label: folderName(f), onSelect: () => s.moveTo(ids, f.id) }));
  const idx = s.indexOf(openId);

  return (
    <div className="reader-inner">
      <div className="reader-toolbar">
        <div className="rt-group">
          <IconButton tip="回复" kbd="R" onClick={() => s.reply('reply', openId)}><Reply size={18} /></IconButton>
          <IconButton tip="全部回复" kbd="A" onClick={() => s.reply('replyAll', openId)}><ReplyAll size={18} /></IconButton>
          <IconButton tip="转发" kbd="F" onClick={() => s.reply('forward', openId)}><Forward size={18} /></IconButton>
        </div>
        <span className="rt-sep" />
        <div className="rt-group">
          {folder?.specialUse !== 'archive' && folder?.specialUse !== 'all' && <IconButton tip="归档" kbd="E" onClick={() => s.act('archive', ids)}><Archive size={18} /></IconButton>}
          <IconButton tip={isTrash ? '永久删除' : '删除'} kbd="Del" onClick={() => s.act('trash', ids)}><Trash2 size={18} /></IconButton>
          {isJunk ? <IconButton tip="不是垃圾邮件" onClick={() => s.act('notspam', ids)}><CornerUpLeft size={18} /></IconButton> : <IconButton tip="垃圾邮件" kbd="!" onClick={() => s.act('spam', ids)}><ShieldAlert size={18} /></IconButton>}
          <Dropdown items={moveItems} trigger={(p) => <IconButton tip="移动到" kbd="V" {...p}><FolderInput size={18} /></IconButton>} />
        </div>
        <span className="rt-sep" />
        <div className="rt-group">
          {current && <IconButton tip={current.seen ? '标为未读' : '标为已读'} kbd="U" onClick={() => s.setSeen(ids, !current.seen)}>{current.seen ? <Mail size={18} /> : <MailOpen size={18} />}</IconButton>}
          {current && <IconButton tip={current.flagged ? '取消星标' : '加星标'} kbd="S" className={current.flagged ? 'is-starred' : ''} onClick={() => s.setFlagged(ids, !current.flagged)}><Star size={18} fill={current.flagged ? 'currentColor' : 'none'} /></IconButton>}
        </div>
        <div className="rt-spacer" />
        <div className="rt-group">
          <IconButton tip="上一封" kbd="K" disabled={idx <= 0} onClick={() => s.moveFocus(-1)}><ChevronUp size={18} /></IconButton>
          <IconButton tip="下一封" kbd="J" disabled={idx < 0 || idx >= s.list.total - 1} onClick={() => s.moveFocus(1)}><ChevronDown size={18} /></IconButton>
          <IconButton tip="关闭" kbd="Esc" onClick={() => s.open(null)}><X size={18} /></IconButton>
        </div>
      </div>
      <div className="reader-scroll" ref={scrollRef}>
        <motion.div key={openId} className="reader-paper" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 0.9, 0.24, 1] }}>
          <div className="subject-block">
            <h1 className="subject">{subject || '（无主题）'}</h1>
            <div className="subject-meta">
              {account && s.accounts.length > 1 && <span className="chip"><span className="chip-dot" style={{ background: account.color }} />{account.label || account.email}</span>}
              {folder && <span className="chip">{folderName(folder)}</span>}
              {current && current.category !== 'primary' && <span className="chip is-soft">{CATEGORY_LABEL[current.category]}</span>}
              {thread.length > 1 && <span className="chip is-soft">{thread.length} 封往来邮件</span>}
            </div>
          </div>
          <div className="thread">
            {thread.map((id, i) => (
              <MessageCard
                key={id}
                id={id}
                summary={s.itemAt(s.indexOf(id)) || summaries[id]}
                expanded={expanded.has(id)}
                isLast={i === thread.length - 1}
                collapsible={thread.length > 1}
                me={me}
                onToggle={() => setExpanded((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
              />
            ))}
          </div>
          <div className="reply-bar">
            <Button icon={<Reply size={15} />} onClick={() => s.reply('reply', openId)}>回复</Button>
            <Button icon={<ReplyAll size={15} />} onClick={() => s.reply('replyAll', openId)}>全部回复</Button>
            <Button icon={<Forward size={15} />} onClick={() => s.reply('forward', openId)}>转发</Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function BulkPanel() {
  const s = useApp();
  const ids = s.selection;
  const idSet = new Set(ids);
  const loaded = Object.values(s.list.pages).flat().filter((m) => idSet.has(m.id));
  const count = s.allSelected ? s.list.total : ids.length;
  const allSeen = !s.allSelected && loaded.every((m) => m.seen);
  const allFlagged = loaded.every((m) => m.flagged);
  const accountIds = new Set(loaded.map((m) => m.accountId));
  const viewFolder = s.view.kind === 'folder' ? s.folders.find((f) => f.id === (s.view as { folderId: number }).folderId) : undefined;
  const junkView = viewFolder?.specialUse === 'junk' || (s.view.kind === 'unified' && s.view.box === 'junk');
  const trashView = viewFolder?.specialUse === 'trash' || (s.view.kind === 'unified' && s.view.box === 'trash');
  const me = new Set(s.accounts.map((a) => a.email.toLowerCase()));
  const senders = [...new Set(loaded.map((m) => m.from?.address).filter((a): a is string => !!a && !me.has(a)))];
  const moveTo = async (folderId: number) => s.moveTo(await s.targetIds(), folderId);
  const moveItems: MenuItem[] = accountIds.size === 1 && (!s.allSelected || s.view.kind === 'folder') ? s.folders.filter((f) => f.accountId === [...accountIds][0]).map((f) => ({ label: folderName(f), onSelect: () => void moveTo(f.id) })) : [{ label: '只能在同一账户内移动', disabled: true }];
  const blockAll = () => s.openModal({
    type: 'confirm',
    title: `屏蔽 ${senders.length} 个发件人？`,
    message: `${senders.slice(0, 6).join('\n')}${senders.length > 6 ? `\n…等 ${senders.length} 个地址` : ''}\n\n他们现有和今后的邮件都会在服务器上移到「垃圾邮件」。`,
    confirmLabel: '屏蔽',
    danger: true,
    onConfirm: () => {
      api.blockSenders(senders).then((r) => {
        s.clearSelection();
        s.toast({ kind: 'success', message: `已屏蔽 ${senders.length} 个发件人`, detail: r.moved ? `${r.moved} 封邮件已移到「垃圾邮件」` : undefined, action: r.undoToken ? { label: '撤销', run: () => { senders.forEach((a) => void api.unblockSender(a)); void api.undo(r.undoToken!).catch(() => {}); } } : undefined });
      }).catch((e) => s.toast({ kind: 'error', message: '屏蔽失败', detail: errorMessage(e).title }));
    }
  });
  return (
    <div className="bulk-panel">
      <div className="bulk-stack">
        {loaded.slice(0, 3).map((m, i) => (
          <motion.div key={m.id} className="bulk-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, rotate: (i - 1) * 3 }} style={{ zIndex: 3 - i }}>
            <strong>{displayName(m.from)}</strong>
            <span>{m.subject}</span>
          </motion.div>
        ))}
      </div>
      <h2>{s.allSelected ? `已选择此视图中的全部 ${count} 封邮件` : `已选择 ${count} 封邮件`}</h2>
      {!s.allSelected && s.list.total > ids.length && ids.length >= Math.min(s.list.total, 20) && (
        <button className="link-btn bulk-all" onClick={() => s.selectAllMatching()}>选择此视图中的全部 {s.list.total} 封</button>
      )}
      <div className="bulk-actions">
        {!junkView && !trashView && <Button icon={<Archive size={15} />} onClick={() => s.act('archive')}>归档</Button>}
        <Button icon={<Trash2 size={15} />} variant={trashView ? 'danger' : undefined} onClick={() => s.act('trash')}>{trashView ? '永久删除' : '删除'}</Button>
        <Button icon={allSeen ? <Mail size={15} /> : <MailOpen size={15} />} onClick={() => void s.bulkSeen(!allSeen)}>{allSeen ? '标为未读' : '标为已读'}</Button>
        {!junkView && <Button icon={<Star size={15} />} onClick={() => void s.targetIds().then((t) => s.setFlagged(t, !allFlagged))}>{allFlagged ? '取消星标' : '加星标'}</Button>}
        <Dropdown items={moveItems} trigger={(p) => <Button icon={<FolderInput size={15} />} {...p}>移动到</Button>} />
        {junkView
          ? <Button icon={<CornerUpLeft size={15} />} onClick={() => s.act('notspam')}>不是垃圾邮件</Button>
          : <Button icon={<ShieldAlert size={15} />} onClick={() => s.act('spam')}>垃圾邮件</Button>}
        {!junkView && !trashView && !s.allSelected && senders.length > 0 && senders.length <= 50 && (
          <Button icon={<Ban size={15} />} onClick={blockAll}>屏蔽发件人</Button>
        )}
      </div>
      <button className="link-btn" onClick={() => s.clearSelection()}>取消选择</button>
    </div>
  );
}

function OutboxView() {
  const s = useApp();
  return (
    <div className="side-panel">
      <div className="reader-toolbar"><h2 className="panel-title">发件箱</h2></div>
      <div className="panel-scroll">
        {!s.outbox.length && <div className="panel-empty">发件箱是空的，所有邮件都已发出。</div>}
        {s.outbox.map((o) => {
          const acc = s.accounts.find((a) => a.id === o.accountId);
          return (
            <div key={o.id} className={cx('outbox-item', o.status === 'failed' && 'is-failed')}>
              <div className="outbox-icon">{o.status === 'sending' ? <Spinner size={16} /> : o.status === 'failed' ? <AlertTriangle size={16} /> : <Clock3 size={16} />}</div>
              <div className="outbox-main">
                <strong>{o.subject || '（无主题）'}</strong>
                <span>发给 {addressLine(o.to)} · 来自 {acc?.email}</span>
                <span className="outbox-status">
                  {o.status === 'sending' ? '正在发送…' : o.status === 'failed' ? `发送失败（已尝试 ${o.attempts} 次）` : o.sendAt > Date.now() + 60_000 ? `定时发送：${longTime(o.sendAt)}` : '即将发送'}
                </span>
                {o.error && (
                  <div className="outbox-error">
                    <strong>{o.error.title}</strong>
                    <p>{o.error.explanation}</p>
                    {o.error.suggestions.length > 0 && <ul>{o.error.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                  </div>
                )}
              </div>
              <div className="outbox-actions">
                {o.status === 'failed' && <Button size="s" variant="primary" icon={<Send size={13} />} onClick={() => api.retryOutbox(o.id)}>重试</Button>}
                {o.status !== 'sending' && <Button size="s" icon={<Pencil size={13} />} onClick={async () => { const p = await api.editOutbox(o.id); if (p) s.compose({ ...p, mode: 'new' }); }}>编辑</Button>}
                {o.status !== 'sending' && <IconButton size="s" tip="删除" onClick={() => api.deleteOutbox(o.id)}><Trash2 size={15} /></IconButton>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftsView() {
  const s = useApp();
  const [drafts, setDrafts] = useState<Awaited<ReturnType<typeof api.listDrafts>>>([]);
  useEffect(() => { api.listDrafts().then(setDrafts); }, [s.counts.drafts]);
  return (
    <div className="side-panel">
      <div className="reader-toolbar"><h2 className="panel-title">本地草稿</h2></div>
      <div className="panel-scroll">
        <p className="panel-note">这些草稿只保存在本机（例如离线时撰写的邮件）。打开后可继续编辑并发送。</p>
        {drafts.map((d) => (
          <div key={d.id} className="outbox-item">
            <div className="outbox-icon"><Pencil size={16} /></div>
            <div className="outbox-main">
              <strong>{d.subject || '（无主题）'}</strong>
              <span>{d.to.length ? `发给 ${addressLine(d.to)}` : '未填写收件人'} · {relativeTime(d.updatedAt)}</span>
            </div>
            <div className="outbox-actions">
              <Button size="s" variant="primary" onClick={() => s.compose({ ...d, mode: 'new', draftId: d.id })}>继续编辑</Button>
              <IconButton size="s" tip="删除" onClick={() => api.deleteDraft(d.id)}><Trash2 size={15} /></IconButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Reader() {
  const s = useApp();
  let content: React.ReactNode;
  if (s.panel === 'outbox') content = <OutboxView />;
  else if (s.panel === 'drafts') content = <DraftsView />;
  else if (s.selection.length > 1) content = <BulkPanel />;
  else if (s.openId != null) content = <ThreadView openId={s.openId} />;
  else content = <ReaderEmpty unread={s.counts.inboxUnread} accounts={s.accounts.length} />;
  return <section className="reader-pane" aria-label="阅读窗格">{content}</section>;
}
