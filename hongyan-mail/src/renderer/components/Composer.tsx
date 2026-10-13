import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Clock3, Maximize2, Minimize2, Minus, Paperclip, Send, Trash2, X, FileText } from 'lucide-react';
import type { Address, ComposeAttachment, ComposePayload } from '@shared/types';
import { useApp, type ComposerState } from '../store';
import { api, errorMessage, pathForFile } from '../api';
import { fileSize, longTime } from '../lib/format';
import { sanitizeForEditor } from '../lib/sanitize';
import { Button, cx, Dropdown, IconButton, Spinner, type MenuItem } from './ui';
import { RecipientField } from './RecipientField';
import { RichEditor, type RichEditorHandle } from './RichEditor';

const SIG_CLASS = 'hy-signature';

function signatureBlock(sig: string): string {
  if (!sig.trim()) return '';
  return `<div class="${SIG_CLASS}"><br>-- <br>${sanitizeForEditor(sig)}</div>`;
}

function initialBody(prefill: ComposerState['prefill'], signature: string): string {
  const quote = prefill.html ? sanitizeForEditor(prefill.html) : '';
  if (prefill.mode === 'draft' || prefill.draftId || (prefill.mode === 'new' && prefill.html)) return quote;
  const sig = signatureBlock(signature);
  if (prefill.mode === 'reply' || prefill.mode === 'replyAll' || prefill.mode === 'forward') return `<p><br></p>${sig}<br>${quote}`;
  return `<p><br></p>${sig}`;
}

function laterOptions(): Array<{ label: string; t: number }> {
  const now = new Date();
  const at = (d: Date, h: number) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x.getTime(); };
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const monday = new Date(now); monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  const opts: Array<{ label: string; t: number }> = [];
  if (now.getHours() < 17) opts.push({ label: '今天 18:00', t: at(now, 18) });
  opts.push({ label: '明天 08:00', t: at(tomorrow, 8) });
  opts.push({ label: '明天 14:00', t: at(tomorrow, 14) });
  opts.push({ label: `下周一 08:00`, t: at(monday, 8) });
  return opts;
}

export function Composer({ c }: { c: ComposerState }) {
  const s = useApp();
  const p = c.prefill;
  const enabled = s.accounts.filter((a) => a.enabled);
  const [accountId, setAccountId] = useState<number>(p.accountId ?? enabled[0]?.id);
  const account = s.accounts.find((a) => a.id === accountId);
  const [to, setTo] = useState<Address[]>(p.to);
  const [cc, setCc] = useState<Address[]>(p.cc);
  const [bcc, setBcc] = useState<Address[]>(p.bcc);
  const [showCc, setShowCc] = useState(p.cc.length > 0 || p.bcc.length > 0);
  const [subject, setSubject] = useState(p.subject);
  const [attachments, setAttachments] = useState<ComposeAttachment[]>(p.attachments);
  const [maximized, setMaximized] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(p.draftId);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const editor = useRef<RichEditorHandle>(null);
  const dirty = useRef(false);
  const initial = useMemo(() => initialBody(p, account?.signature || ''), []);

  const payload = (): ComposePayload => ({
    accountId,
    to, cc, bcc,
    subject,
    html: `<div style="font-family: 'Segoe UI', 'Microsoft YaHei UI', sans-serif; font-size: 14px; line-height: 1.6;">${editor.current?.getHtml() || ''}</div>`,
    attachments,
    inReplyTo: p.inReplyTo,
    references: p.references,
    replyToMessageId: p.replyToMessageId,
    forwardOfMessageId: p.forwardOfMessageId,
    draftId,
    serverDraftMessageId: p.serverDraftMessageId
  });

  const markDirty = () => { dirty.current = true; };
  useEffect(markDirty, [to, cc, bcc, subject, attachments, accountId]);

  // Autosave a local draft every few seconds while editing.
  useEffect(() => {
    const t = setInterval(() => {
      if (!dirty.current || sending) return;
      dirty.current = false;
      api.saveDraft(payload(), false).then((id) => { setDraftId(id); setSavedAt(Date.now()); }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  });

  // Switching the sending account swaps the signature.
  const switchAccount = (id: number) => {
    const next = s.accounts.find((a) => a.id === id);
    const root = editor.current?.element();
    if (root) {
      const old = root.querySelector(`.${SIG_CLASS}`);
      const html = signatureBlock(next?.signature || '');
      if (old) { if (html) old.outerHTML = html; else old.remove(); }
      else if (html) {
        const q = root.querySelector('.hy-quote-header, blockquote.hy-quote, .hy-forward');
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        if (q) root.insertBefore(tmp.firstChild!, q);
        else root.appendChild(tmp.firstChild!);
      }
    }
    setAccountId(id);
  };

  const isEmpty = () => !to.length && !cc.length && !bcc.length && !subject.trim() && !attachments.length && !(editor.current?.element()?.innerText || '').replace(/--\s*$/m, '').trim();

  const close = async (mode: 'save' | 'discard') => {
    if (mode === 'save' && !isEmpty()) {
      try {
        const id = await api.saveDraft(payload(), true);
        void id;
        s.toast({ kind: 'success', message: '已保存到草稿箱' });
      } catch (e) {
        s.toast({ kind: 'error', message: '草稿保存失败', detail: errorMessage(e).title });
      }
    } else if (draftId) {
      await api.deleteDraft(draftId).catch(() => {});
    }
    s.closeComposer(c.key);
  };

  const addFiles = async (paths: string[]) => {
    const stat = await api.statFiles(paths.filter(Boolean));
    if (stat.length) setAttachments((cur) => [...cur, ...stat]);
  };

  const doSend = async (sendAt?: number) => {
    if (!account) { s.toast({ kind: 'error', message: '请选择发件账户' }); return; }
    const all = [...to, ...cc, ...bcc];
    if (!all.length) { s.toast({ kind: 'error', message: '请至少填写一位收件人' }); return; }
    const invalid = all.filter((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.address));
    if (invalid.length) { s.toast({ kind: 'error', message: `收件人地址无效：${invalid.map((a) => a.address).join('、')}` }); return; }
    const bodyText = editor.current?.element()?.innerText || '';
    const ownText = bodyText.split(/\n-- \n/)[0];
    const checks: string[] = [];
    if (!subject.trim()) checks.push('这封邮件没有主题。');
    if (!attachments.length && /(附件|附上|见附|attached|attachment|enclosed)/i.test(ownText.slice(0, 4000)) && !/(没有附件|无附件)/.test(ownText)) checks.push('正文中提到了「附件」，但还没有添加任何附件。');
    const go = async () => {
      setSending(true);
      try {
        const data = payload();
        const res = await api.send(data, sendAt ?? null);
        s.closeComposer(c.key);
        const scheduled = sendAt && sendAt > Date.now() + 60_000;
        const undoSec = s.settings?.undoSendSeconds ?? 5;
        if (scheduled) {
          s.toast({ kind: 'success', message: `已安排在 ${longTime(res.sendAt)} 发送`, action: { label: '撤销', run: () => api.cancelSend(res.outboxId).then((back) => back && s.compose({ ...back, mode: 'new' })) } });
        } else if (undoSec > 0) {
          s.toast({ kind: 'progress', message: '正在发送…', duration: undoSec * 1000, action: { label: '撤销', run: () => api.cancelSend(res.outboxId).then((back) => { if (back) { s.compose({ ...back, mode: 'new' }); s.toast({ kind: 'info', message: '已撤销发送' }); } }) } });
        }
      } catch (e) {
        const m = errorMessage(e);
        s.toast({ kind: 'error', message: m.title, detail: m.detail });
      } finally {
        setSending(false);
      }
    };
    if (checks.length) {
      s.openModal({ type: 'confirm', title: '确定要发送吗？', message: checks.join('\n'), confirmLabel: '仍然发送', onConfirm: () => void go() });
      return;
    }
    await go();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void doSend(); }
    if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); void close('save'); }
  };

  const totalSize = attachments.reduce((x, a) => x + (a.size || 0), 0);
  const accountItems: MenuItem[] = enabled.map((a) => ({ label: `${a.displayName} <${a.email}>`, checked: a.id === accountId, onSelect: () => switchAccount(a.id) }));
  const title = subject.trim() || (p.mode === 'reply' || p.mode === 'replyAll' ? '回复' : p.mode === 'forward' ? '转发' : '新邮件');

  if (c.minimized) {
    return (
      <motion.button layout className="composer-pill" onClick={() => s.updateComposer(c.key, { minimized: false })} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <FileText size={14} />
        <span>{title}</span>
        <span className="pill-close" onClick={(e) => { e.stopPropagation(); void close('save'); }}><X size={13} /></span>
      </motion.button>
    );
  }

  return (
    <motion.div className={cx('composer-layer', maximized && 'is-max')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className={cx('composer', maximized && 'is-max', dragOver && 'is-drag')}
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onKeyDown={onKeyDown}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles([...e.dataTransfer.files].map((f) => pathForFile(f))); }}
      >
        <div className="composer-head">
          <span className="composer-title">{title}</span>
          {savedAt && <span className="composer-saved">草稿已自动保存</span>}
          <div className="composer-head-actions">
            <IconButton size="s" tip="最小化" onClick={() => s.updateComposer(c.key, { minimized: true })}><Minus size={16} /></IconButton>
            <IconButton size="s" tip={maximized ? '还原' : '最大化'} onClick={() => setMaximized(!maximized)}>{maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</IconButton>
            <IconButton size="s" tip="保存草稿并关闭" kbd="Esc" onClick={() => void close('save')}><X size={17} /></IconButton>
          </div>
        </div>

        <div className="composer-fields">
          <div className="rcpt-field from-field">
            <span className="rcpt-label">发件人</span>
            <Dropdown items={accountItems} trigger={(tp) => (
              <button className="from-btn" {...tp}>
                <span className="acct-dot" style={{ background: account?.color }} />
                <span>{account ? `${account.displayName} <${account.email}>` : '选择账户'}</span>
                <ChevronDown size={14} />
              </button>
            )} />
          </div>
          <RecipientField label="收件人" value={to} onChange={setTo} autoFocus={!to.length}
            trailing={!showCc ? <button className="cc-toggle" onClick={(e) => { e.stopPropagation(); setShowCc(true); }}>抄送 / 密送</button> : undefined} />
          {showCc && <RecipientField label="抄送" value={cc} onChange={setCc} />}
          {showCc && <RecipientField label="密送" value={bcc} onChange={setBcc} />}
          <div className="rcpt-field subject-field">
            <span className="rcpt-label">主题</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="" aria-label="主题" autoFocus={!!to.length && !subject}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor.current?.focus(true); } }} />
          </div>
        </div>

        <RichEditor ref={editor} initialHtml={initial} onChange={markDirty} placeholder="正文…" onFiles={(files) => void addFiles(files.map((f) => pathForFile(f)))} />

        <AnimatePresence initial={false}>
          {attachments.length > 0 && (
            <motion.div className="composer-atts" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              {attachments.map((a, i) => (
                <span key={i} className="att-chip">
                  <Paperclip size={13} />
                  <span className="att-chip-name">{a.filename}</span>
                  <span className="att-chip-size">{fileSize(a.size)}</span>
                  <button aria-label="移除附件" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}><X size={12} /></button>
                </span>
              ))}
              <span className={cx('att-total', totalSize > 25 * 1024 * 1024 && 'is-warn')}>
                共 {fileSize(totalSize)}{totalSize > 25 * 1024 * 1024 ? ' · 超过 25 MB，部分邮箱可能拒收' : ''}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="composer-foot">
          <div className="send-group">
            <Button variant="primary" className="send-btn" icon={sending ? <Spinner size={15} /> : <Send size={15} />} onClick={() => void doSend()} disabled={sending}>
              发送
            </Button>
            <Dropdown items={[
              { heading: '定时发送' },
              ...laterOptions().map((o) => ({ label: o.label, icon: <Clock3 size={15} />, onSelect: () => void doSend(o.t) })),
              { separator: true },
              { label: '选择日期和时间…', icon: <Clock3 size={15} />, onSelect: () => s.openModal({ type: 'schedule', onPick: (t) => void doSend(t) }) }
            ]} trigger={(tp) => <button className="send-more" aria-label="定时发送" {...tp}><ChevronDown size={15} /></button>} />
          </div>
          <span className="send-hint"><kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Enter</kbd> 发送</span>
          <div className="foot-spacer" />
          <IconButton tip="添加附件" onClick={async () => { const picked = await api.pickAttachments(); if (picked.length) setAttachments((cur) => [...cur, ...picked]); }}><Paperclip size={18} /></IconButton>
          <IconButton tip="舍弃草稿" onClick={() => {
            if (isEmpty()) { void close('discard'); return; }
            s.openModal({ type: 'confirm', title: '舍弃这封邮件？', message: '正在撰写的内容将被删除。', confirmLabel: '舍弃', danger: true, onConfirm: () => void close('discard') });
          }}><Trash2 size={18} /></IconButton>
        </div>
        {dragOver && <div className="drop-hint"><Paperclip size={22} /> 松开以添加附件</div>}
      </motion.div>
    </motion.div>
  );
}

export function Composers() {
  const composers = useApp((s) => s.composers);
  const open = composers.filter((c) => !c.minimized);
  const minimized = composers.filter((c) => c.minimized);
  return (
    <>
      <AnimatePresence>{open.map((c) => <Composer key={c.key} c={c} />)}</AnimatePresence>
      {minimized.length > 0 && (
        <div className="composer-dock">
          {minimized.map((c) => <Composer key={c.key} c={c} />)}
        </div>
      )}
    </>
  );
}
