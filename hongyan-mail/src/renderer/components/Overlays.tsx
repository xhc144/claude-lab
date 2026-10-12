import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle, ArrowRight, CheckCircle2, Download, ExternalLink, Folder, Inbox, Info, Moon, PenLine, RefreshCw, Search, Send,
  Settings, Star, Sun, UserPlus, X, Stethoscope, Keyboard, FileText, Paperclip, MailOpen
} from 'lucide-react';
import type { DiagnosisReport } from '@shared/types';
import { useApp } from '../store';
import { api, errorMessage } from '../api';
import { folderName } from '../lib/folders';
import { Button, cx, Field, Kbd, Modal, Spinner } from './ui';
import { SettingsModal } from './Settings';
import { AddAccount } from './AddAccount';
import { DiagSteps, DiagnosisCard } from './Diagnostics';
import { SHORTCUTS } from '../lib/shortcuts';

// ------------------------------------------------------------------ toasts

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout className={cx('toast', `is-${t.kind}`)} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }} transition={{ type: 'spring', stiffness: 500, damping: 36 }}>
            <span className="toast-icon">
              {t.kind === 'success' ? <CheckCircle2 size={17} /> : t.kind === 'error' ? <AlertCircle size={17} /> : t.kind === 'progress' ? <Spinner size={15} /> : <Info size={17} />}
            </span>
            <div className="toast-text">
              <span className="toast-msg">{t.message}</span>
              {t.detail && <span className="toast-detail">{t.detail}</span>}
            </div>
            {t.action && <button className="toast-action" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="关闭"><X size={14} /></button>
            {t.kind === 'progress' && t.duration ? <motion.span className="toast-progress" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: t.duration / 1000, ease: 'linear' }} /> : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------------ command palette

interface Cmd { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void; group: string }

function CommandPalette({ onClose }: { onClose: () => void }) {
  const s = useApp();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const cmds = useMemo<Cmd[]>(() => {
    const list: Cmd[] = [
      { id: 'compose', label: '写邮件', hint: 'C', icon: <PenLine size={16} />, run: () => s.compose(), group: '操作' },
      { id: 'sync', label: '立即收取所有账户', hint: 'F5', icon: <RefreshCw size={16} />, run: () => api.syncNow(null), group: '操作' },
      { id: 'theme', label: s.dark ? '切换到浅色模式' : '切换到深色模式', icon: s.dark ? <Sun size={16} /> : <Moon size={16} />, run: () => s.updateSettings({ theme: s.dark ? 'light' : 'dark' }), group: '操作' },
      { id: 'add', label: '添加邮箱账户', icon: <UserPlus size={16} />, run: () => s.openModal({ type: 'add-account' }), group: '操作' },
      { id: 'settings', label: '打开设置', hint: 'Ctrl ,', icon: <Settings size={16} />, run: () => s.openModal({ type: 'settings' }), group: '操作' },
      { id: 'keys', label: '查看快捷键', hint: '?', icon: <Keyboard size={16} />, run: () => s.openModal({ type: 'shortcuts' }), group: '操作' },
      { id: 'inbox', label: '前往 收件箱', icon: <Inbox size={16} />, run: () => s.setView({ kind: 'unified', box: 'inbox' }), group: '前往' },
      { id: 'unread', label: '前往 未读', icon: <MailOpen size={16} />, run: () => s.setView({ kind: 'unified', box: 'unread' }), group: '前往' },
      { id: 'starred', label: '前往 星标', icon: <Star size={16} />, run: () => s.setView({ kind: 'unified', box: 'starred' }), group: '前往' },
      { id: 'sent', label: '前往 已发送', icon: <Send size={16} />, run: () => s.setView({ kind: 'unified', box: 'sent' }), group: '前往' },
      { id: 'drafts', label: '前往 草稿箱', icon: <FileText size={16} />, run: () => s.setView({ kind: 'unified', box: 'drafts' }), group: '前往' },
      { id: 'att', label: '前往 带附件的邮件', icon: <Paperclip size={16} />, run: () => s.setView({ kind: 'unified', box: 'attachments' }), group: '前往' }
    ];
    for (const a of s.accounts) {
      list.push({ id: `diag-${a.id}`, label: `诊断连接：${a.email}`, icon: <Stethoscope size={16} />, run: () => s.openModal({ type: 'diagnose', accountId: a.id }), group: '账户' });
      for (const f of s.folders.filter((x) => x.accountId === a.id)) {
        list.push({ id: `f-${f.id}`, label: `${folderName(f)}`, hint: a.label || a.email, icon: <Folder size={16} />, run: () => s.setView({ kind: 'folder', accountId: a.id, folderId: f.id }), group: '文件夹' });
      }
    }
    return list;
  }, [s.accounts, s.folders, s.dark]);

  const query = q.trim().toLowerCase();
  const filtered = query
    ? cmds.filter((c) => (c.label + ' ' + (c.hint || '')).toLowerCase().includes(query))
    : cmds.filter((c) => c.group !== '文件夹');
  const items: Cmd[] = query ? [{ id: 'search', label: `搜索邮件：“${q.trim()}”`, icon: <Search size={16} />, run: () => s.setView({ kind: 'search', query: q.trim() }), group: '搜索' }, ...filtered] : filtered;

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (c: Cmd) => { onClose(); setTimeout(c.run, 0); };
  let lastGroup = '';
  return (
    <Modal open onClose={onClose} width={600} className="palette" closable>
      <div className="palette-input">
        <Search size={18} />
        <input autoFocus value={q} placeholder="输入命令、文件夹，或要搜索的内容…" onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === 'Enter' && items[active]) { e.preventDefault(); run(items[active]); }
          }} />
        <Kbd>Esc</Kbd>
      </div>
      <div className="palette-list" ref={listRef}>
        {items.map((c, i) => {
          const head = c.group !== lastGroup ? c.group : null;
          lastGroup = c.group;
          return (
            <React.Fragment key={c.id}>
              {head && <div className="palette-group">{head}</div>}
              <button className={cx('palette-item', i === active && 'is-active')} onMouseEnter={() => setActive(i)} onClick={() => run(c)}>
                <span className="palette-icon">{c.icon}</span>
                <span className="palette-label">{c.label}</span>
                {c.hint && <span className="palette-hint">{c.hint}</span>}
                {i === active && <ArrowRight size={14} className="palette-go" />}
              </button>
            </React.Fragment>
          );
        })}
        {!items.length && <div className="palette-empty">没有匹配的命令</div>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ small dialogs

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onClose }: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} width={420} title={title} footer={
      <>
        <Button variant="ghost" onClick={onClose}>取消</Button>
        <Button variant={danger ? 'danger' : 'primary'} autoFocus onClick={() => { onClose(); onConfirm(); }}>{confirmLabel}</Button>
      </>
    }>
      <p className="dialog-text">{message.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p>
    </Modal>
  );
}

function PromptDialog({ title, label, initial, confirmLabel, onSubmit, onClose }: { title: string; label: string; initial: string; confirmLabel?: string; onSubmit: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const submit = () => { if (!v.trim()) return; onClose(); onSubmit(v.trim()); };
  return (
    <Modal open onClose={onClose} width={420} title={title} footer={
      <>
        <Button variant="ghost" onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!v.trim()}>{confirmLabel || '确定'}</Button>
      </>
    }>
      <Field label={label}><input className="input" autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} /></Field>
    </Modal>
  );
}

function ScheduleDialog({ onPick, onClose }: { onPick: (t: number) => void; onClose: () => void }) {
  const def = new Date(Date.now() + 24 * 3600_000);
  def.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const [v, setV] = useState(`${def.getFullYear()}-${pad(def.getMonth() + 1)}-${pad(def.getDate())}T${pad(def.getHours())}:${pad(def.getMinutes())}`);
  const t = new Date(v).getTime();
  const valid = !isNaN(t) && t > Date.now() + 60_000;
  return (
    <Modal open onClose={onClose} width={400} title="定时发送" subtitle="邮件会保存在发件箱，到时由鸿雁自动发送（需要鸿雁在运行）。" footer={
      <>
        <Button variant="ghost" onClick={onClose}>取消</Button>
        <Button variant="primary" disabled={!valid} onClick={() => { onClose(); onPick(t); }}>安排发送</Button>
      </>
    }>
      <Field label="发送时间" error={!valid ? '请选择一个将来的时间' : undefined}><input className="input" type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} /></Field>
    </Modal>
  );
}

function MoveDialog({ ids, accountId, onClose }: { ids: number[]; accountId: number; onClose: () => void }) {
  const s = useApp();
  const [q, setQ] = useState('');
  const folders = s.folders.filter((f) => f.accountId === accountId && (!q || folderName(f).toLowerCase().includes(q.toLowerCase())));
  return (
    <Modal open onClose={onClose} width={420} title={`移动 ${ids.length} 封邮件到…`}>
      <input className="input" autoFocus placeholder="筛选文件夹" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && folders[0]) { onClose(); void s.moveTo(ids, folders[0].id); } }} />
      <div className="move-list">
        {folders.map((f) => (
          <button key={f.id} className="move-item" onClick={() => { onClose(); void s.moveTo(ids, f.id); }}>
            <Folder size={15} /> {folderName(f)}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function SourceDialog({ messageId, onClose }: { messageId: number; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { api.getSource(messageId).then(setSrc).catch((e) => setSrc(`无法读取：${errorMessage(e).title}`)); }, [messageId]);
  return (
    <Modal open onClose={onClose} width={860} title="原始邮件" footer={<>
      <Button icon={<Download size={14} />} onClick={() => api.exportEml(messageId)}>导出 .eml</Button>
      <Button variant="primary" onClick={() => { void navigator.clipboard.writeText(src || ''); useApp.getState().toast({ kind: 'success', message: '已复制' }); }}>复制全部</Button>
    </>}>
      {src == null ? <div className="center-pad"><Spinner /></div> : <pre className="source-view">{src.length > 400_000 ? src.slice(0, 400_000) + '\n…（已截断）' : src}</pre>}
    </Modal>
  );
}

function ImageDialog({ src, name, messageId, index, onClose }: { src: string; name: string; messageId: number; index: number; onClose: () => void }) {
  return createPortal(
    <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span>{name}</span>
        <Button size="s" icon={<ExternalLink size={14} />} onClick={() => api.openAttachment(messageId, index)}>打开</Button>
        <Button size="s" icon={<Download size={14} />} onClick={() => api.saveAttachment(messageId, index)}>另存为</Button>
        <button className="lightbox-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
      </div>
      <motion.img src={src} alt={name} initial={{ scale: 0.96 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} />
    </motion.div>,
    document.body
  );
}

function DiagnoseDialog({ accountId, onClose }: { accountId: number; onClose: () => void }) {
  const s = useApp();
  const account = s.accounts.find((a) => a.id === accountId);
  const [runId] = useState(() => Math.random().toString(36).slice(2));
  const [report, setReport] = useState<DiagnosisReport | null>(null);
  const [running, setRunning] = useState(true);
  const [reauth, setReauth] = useState(false);
  const run = () => {
    setRunning(true);
    setReport(null);
    api.diagnoseAccount(accountId, runId).then(setReport).catch((e) => s.toast({ kind: 'error', message: errorMessage(e).title })).finally(() => setRunning(false));
  };
  useEffect(run, [accountId]);
  if (reauth) {
    return (
      <Modal open onClose={onClose} width={560}>
        <AddAccount embedded reauthAccountId={accountId} onDone={onClose} onCancel={() => setReauth(false)} />
      </Modal>
    );
  }
  const steps = s.diagRuns[runId];
  return (
    <Modal open onClose={onClose} width={560} title="连接诊断" subtitle={account?.email} footer={
      <>
        {report && !report.ok && report.diagnosis?.needsUserAction && <Button onClick={() => setReauth(true)}>修改账户设置</Button>}
        <Button onClick={run} disabled={running} icon={<RefreshCw size={14} />}>重新诊断</Button>
        {report?.ok && <Button variant="primary" onClick={() => { api.syncNow(accountId); onClose(); }}>立即同步</Button>}
      </>
    }>
      {steps ? <DiagSteps steps={steps} /> : <div className="center-pad"><Spinner /></div>}
      {report?.ok && <div className="diag-ok"><CheckCircle2 size={18} /> 一切正常：收信与发信都已验证通过。{account?.status.state === 'error' ? '账户将自动重新连接。' : ''}</div>}
      {report && !report.ok && report.diagnosis && <DiagnosisCard d={report.diagnosis} report={report} />}
    </Modal>
  );
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} width={560} title="键盘快捷键">
      <div className="shortcut-table two-col">
        {SHORTCUTS.map((sc) => (
          <div key={sc.keys} className="shortcut-row">
            <span>{sc.label}</span>
            <span className="shortcut-keys">{sc.keys.split(' ').map((k, i) => <kbd key={i} className="kbd">{k}</kbd>)}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function ModalHost() {
  const modal = useApp((s) => s.modal);
  const close = useApp((s) => s.closeModal);
  if (!modal) return null;
  switch (modal.type) {
    case 'settings': return <SettingsModal section={modal.section} accountId={modal.accountId} />;
    case 'add-account':
      return (
        <Modal open onClose={close} width={560}>
          <AddAccount embedded reauthAccountId={modal.reauthAccountId} onDone={close} onCancel={close} />
        </Modal>
      );
    case 'palette': return <CommandPalette onClose={close} />;
    case 'confirm': return <ConfirmDialog {...modal} onClose={close} />;
    case 'prompt': return <PromptDialog {...modal} onClose={close} />;
    case 'schedule': return <ScheduleDialog onPick={modal.onPick} onClose={close} />;
    case 'move': return <MoveDialog ids={modal.ids} accountId={modal.accountId} onClose={close} />;
    case 'source': return <SourceDialog messageId={modal.messageId} onClose={close} />;
    case 'image': return <ImageDialog {...modal} onClose={close} />;
    case 'diagnose': return <DiagnoseDialog accountId={modal.accountId} onClose={close} />;
    case 'shortcuts': return <ShortcutsDialog onClose={close} />;
  }
  return null;
}
