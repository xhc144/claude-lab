import { useEffect } from 'react';
import { useApp } from '../store';
import { api } from '../api';

export const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: 'C', label: '写邮件' },
  { keys: 'R', label: '回复' },
  { keys: 'A', label: '全部回复' },
  { keys: 'F', label: '转发' },
  { keys: 'E', label: '归档' },
  { keys: 'Del', label: '删除' },
  { keys: '!', label: '标记为垃圾邮件' },
  { keys: 'S', label: '加星标 / 取消星标' },
  { keys: 'U', label: '标为已读 / 未读' },
  { keys: 'V', label: '移动到文件夹' },
  { keys: 'J', label: '下一封' },
  { keys: 'K', label: '上一封' },
  { keys: '/', label: '搜索' },
  { keys: 'Ctrl K', label: '命令面板' },
  { keys: 'Ctrl A', label: '全选列表' },
  { keys: 'Ctrl Enter', label: '发送邮件' },
  { keys: 'Ctrl ,', label: '设置' },
  { keys: 'G I', label: '前往收件箱' },
  { keys: 'G S', label: '前往星标' },
  { keys: 'G T', label: '前往已发送' },
  { keys: 'G D', label: '前往草稿箱' },
  { keys: 'F5', label: '立即收取' },
  { keys: 'Esc', label: '关闭 / 取消选择' },
  { keys: '?', label: '查看快捷键' }
];

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

export function useShortcuts(focusSearch: () => void) {
  useEffect(() => {
    let gPending = 0;
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); s.openModal(s.modal?.type === 'palette' ? null : { type: 'palette' }); return; }
      if (mod && e.key === ',') { e.preventDefault(); s.openModal({ type: 'settings' }); return; }
      if (mod && e.key.toLowerCase() === 'f' && !isTyping(e)) { e.preventDefault(); focusSearch(); return; }
      if (e.key === 'F5') { e.preventDefault(); api.syncNow(null); s.toast({ kind: 'info', message: '正在收取所有账户…', duration: 1800 }); return; }
      if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); s.compose(); return; }
      if (s.modal || isTyping(e) || s.composers.some((c) => !c.minimized)) return;
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); s.selectAll(); return; }
      if (mod || e.altKey) return;
      const key = e.key;
      const target = s.selection.length ? s.selection : s.openId != null ? [s.openId] : [];
      const cur = s.openId != null ? s.itemAt(s.indexOf(s.openId)) : undefined;
      if (Date.now() - gPending < 1200) {
        gPending = 0;
        const go = { i: 'inbox', s: 'starred', t: 'sent', d: 'drafts', u: 'unread' } as const;
        const box = go[key.toLowerCase() as keyof typeof go];
        if (box) { e.preventDefault(); s.setView({ kind: 'unified', box }); }
        return;
      }
      switch (key) {
        case 'g': case 'G': gPending = Date.now(); break;
        case 'c': case 'C': e.preventDefault(); s.compose(); break;
        case '/': e.preventDefault(); focusSearch(); break;
        case 'j': case 'ArrowDown': e.preventDefault(); s.moveFocus(1); break;
        case 'k': case 'ArrowUp': e.preventDefault(); s.moveFocus(-1); break;
        case 'r': case 'R': if (s.openId != null) { e.preventDefault(); void s.reply('reply', s.openId); } break;
        case 'a': case 'A': if (s.openId != null) { e.preventDefault(); void s.reply('replyAll', s.openId); } break;
        case 'f': case 'F': if (s.openId != null) { e.preventDefault(); void s.reply('forward', s.openId); } break;
        case 'e': case 'E': if (target.length) { e.preventDefault(); void s.act('archive'); } break;
        case 'Delete': case '#': if (target.length) { e.preventDefault(); void s.act('trash'); } break;
        case '!': if (target.length) { e.preventDefault(); void s.act('spam'); } break;
        case 's': case 'S': if (target.length) { e.preventDefault(); s.setFlagged(target, !(cur?.flagged)); } break;
        case 'u': case 'U': if (target.length) { e.preventDefault(); s.setSeen(target, !(cur?.seen ?? true)); } break;
        case 'v': case 'V': if (target.length && cur) { e.preventDefault(); s.openModal({ type: 'move', ids: target, accountId: cur.accountId }); } break;
        case 'Escape': if (s.selection.length > 1 || s.openId != null) { e.preventDefault(); s.clearSelection(); } break;
        case '?': e.preventDefault(); s.openModal({ type: 'shortcuts' }); break;
        case 'Enter': if (s.selection.length === 1 && s.openId == null) { e.preventDefault(); s.open(s.selection[0]); } break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
