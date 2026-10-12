import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive, ChevronDown, ChevronUp, Code2, Download, ExternalLink, Eye, FileArchive, FileAudio, FileImage, FileSpreadsheet,
  FileText, FileVideo, File as FileIcon, Forward, FolderInput, ImageOff, Mail, MailOpen, MoreHorizontal, Presentation,
  Reply, ReplyAll, RotateCw, Send, ShieldAlert, Star, Trash2, UserCheck, BellOff, AlertTriangle, Clock3, Pencil, X, CornerUpLeft
} from 'lucide-react';
import type { AttachmentInfo, MessageDetail, MessageSummary } from '@shared/types';
import { useApp } from '../store';
import { api, errorMessage, ApiError } from '../api';
import { addressLine, displayName, fileSize, formatAddress, listTime, longTime, relativeTime } from '../lib/format';
import { folderName } from '../lib/folders';
import { Avatar, Button, cx, Dropdown, IconButton, Spinner, type MenuItem } from './ui';
import { EmailFrame } from './EmailFrame';
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

function RecipientDetails({ d, me }: { d: MessageDetail; me: Set<string> }) {
  const rows: Array<[string, string]> = [
    ['发件人', d.from ? formatAddress(d.from) : '—'],
    ...(d.replyTo.length && d.replyTo[0].address !== d.from?.address ? [['回复至', d.replyTo.map(formatAddress).join(', ')] as [string, string]] : []),
    ['收件人', d.to.map(formatAddress).join(', ') || '—'],
    ...(d.cc.length ? [['抄送', d.cc.map(formatAddress).join(', ')] as [string, string]] : []),
    ...(d.bcc.length ? [['密送', d.bcc.map(formatAddress).join(', ')] as [string, string]] : []),
    ['时间', longTime(d.date)],
    ['位置', d.folderPath]
  ];
  void me;
  return (
    <div className="recipients">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}><span className="rk">{k}</span><span className="rv">{v}</span></React.Fragment>
      ))}
    </div>
  );
}

function MessageCard({ id, summary, expanded, onToggle, isLast, me }: { id: number; summary?: MessageSummary; expanded: boolean; onToggle: () => void; isLast: boolean; me: Set<string> }) {
  const s = useApp();
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [allowRemote, setAllowRemote] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [hoverLink, setHoverLink] = useState<string | null>(null);
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
    { label: '查看原始邮件', icon: <Code2 size={15} />, onSelect: () => s.openModal({ type: 'source', messageId: id }) },
    { label: '导出为 .eml', icon: <Download size={15} />, onSelect: () => api.exportEml(id).then((p) => p && s.toast({ kind: 'success', message: '已导出', detail: p })) },
    { label: '打印', icon: <FileText size={15} />, onSelect: () => api.printMessage(id).catch((e) => s.toast({ kind: 'error', message: errorMessage(e).title })) }
  ] : [];

  return (
    <article className={cx('msg-card', isLast && 'is-last')}>
      <header className="mc-head">
        <button className="mc-head-main" onClick={onToggle} title="折叠">
          <Avatar name={from?.name || ''} address={from?.address || '?'} size={40} />
          <div className="mc-who">
            <div className="mc-line">
              <span className="mc-name">{displayName(from, me)}</span>
              {from && from.name && <span className="mc-addr">{from.address}</span>}
              {base?.draft && <span className="row-tag is-draft">草稿</span>}
            </div>
            <div className="mc-to" onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}>
              发给 {base ? addressLine(base.to, me, 3) || '（未填写）' : ''}{base && base.cc.length ? `，抄送 ${addressLine(base.cc, me, 2)}` : ''}
              <ChevronDown size={13} style={{ transform: showDetails ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
            </div>
          </div>
        </button>
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
            <RecipientDetails d={d} me={me} />
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
      <AnimatePresence>
        {hoverLink && (
          <motion.div className="link-peek" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <ExternalLink size={12} /> {hoverLink.length > 140 ? hoverLink.slice(0, 140) + '…' : hoverLink}
          </motion.div>
        )}
      </AnimatePresence>
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
  const loaded = Object.values(s.list.pages).flat().filter((m) => ids.includes(m.id));
  const allSeen = loaded.every((m) => m.seen);
  const allFlagged = loaded.every((m) => m.flagged);
  const accountIds = new Set(loaded.map((m) => m.accountId));
  const moveItems: MenuItem[] = accountIds.size === 1 ? s.folders.filter((f) => f.accountId === [...accountIds][0]).map((f) => ({ label: folderName(f), onSelect: () => s.moveTo(ids, f.id) })) : [{ label: '只能在同一账户内移动', disabled: true }];
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
      <h2>已选择 {ids.length} 封邮件</h2>
      <div className="bulk-actions">
        <Button icon={<Archive size={15} />} onClick={() => s.act('archive')}>归档</Button>
        <Button icon={<Trash2 size={15} />} onClick={() => s.act('trash')}>删除</Button>
        <Button icon={allSeen ? <Mail size={15} /> : <MailOpen size={15} />} onClick={() => s.setSeen(ids, !allSeen)}>{allSeen ? '标为未读' : '标为已读'}</Button>
        <Button icon={<Star size={15} />} onClick={() => s.setFlagged(ids, !allFlagged)}>{allFlagged ? '取消星标' : '加星标'}</Button>
        <Dropdown items={moveItems} trigger={(p) => <Button icon={<FolderInput size={15} />} {...p}>移动到</Button>} />
        <Button icon={<ShieldAlert size={15} />} onClick={() => s.act('spam')}>垃圾邮件</Button>
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
