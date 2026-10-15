// Context menus for text, links and images — in the app itself and inside the sandboxed e-mail iframe — plus the
// menu for an e-mail address (sender / recipient). Electron shows no context menu of its own, so without this
// right-clicking a link or a selection did nothing.
import {
  Ban, ClipboardPaste, Copy, ExternalLink, Image as ImageIcon, Link, Mail, PenLine, Redo2, Scissors, Search, TextSelect,
  Trash2, Undo2, UserCheck
} from 'lucide-react';
import type { Address } from '@shared/types';
import type { EditCommand } from '@shared/api';
import { api, errorMessage } from '../api';
import { useApp } from '../store';
import { isContextMenuOpen, showContextMenuAt, type MenuItem } from '../components/ui';

const copy = (text: string, what = '已复制') => {
  api.copyText(text).then(() => useApp.getState().toast({ kind: 'success', message: what, duration: 1600 })).catch(() => {});
};

const ellipsize = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

function editable(el: Element | null): HTMLInputElement | HTMLTextAreaElement | HTMLElement | null {
  const e = el?.closest?.('input, textarea, [contenteditable=""], [contenteditable="true"]') as HTMLElement | null;
  if (!e) return null;
  if (e instanceof HTMLInputElement && ['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(e.type)) return null;
  return e;
}

function fieldSelection(el: HTMLElement, win: Window): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      const a = el.selectionStart ?? 0;
      const b = el.selectionEnd ?? 0;
      return el.value.slice(Math.min(a, b), Math.max(a, b));
    } catch { return ''; }
  }
  return win.getSelection()?.toString() || '';
}

const run = (cmd: EditCommand) => () => { void api.editCommand(cmd); };

/** Cut / copy / paste menu for text fields (commands run natively on the focused element). */
function editItems(el: HTMLElement, win: Window): MenuItem[] {
  const ro = (el as HTMLInputElement).readOnly || (el as HTMLInputElement).disabled;
  const secret = el instanceof HTMLInputElement && el.type === 'password';
  const hasSel = fieldSelection(el, win).length > 0;
  const rich = el.isContentEditable;
  return [
    { label: '撤销', icon: <Undo2 size={15} />, kbd: 'Ctrl Z', disabled: ro, onSelect: run('undo') },
    { label: '重做', icon: <Redo2 size={15} />, kbd: 'Ctrl Y', disabled: ro, onSelect: run('redo') },
    { separator: true },
    { label: '剪切', icon: <Scissors size={15} />, kbd: 'Ctrl X', disabled: ro || secret || !hasSel, onSelect: run('cut') },
    { label: '复制', icon: <Copy size={15} />, kbd: 'Ctrl C', disabled: secret || !hasSel, onSelect: run('copy') },
    { label: '粘贴', icon: <ClipboardPaste size={15} />, kbd: 'Ctrl V', disabled: ro, onSelect: run('paste') },
    ...(rich ? [{ label: '粘贴为纯文本', icon: <ClipboardPaste size={15} />, kbd: 'Ctrl Shift V', disabled: ro, onSelect: run('pasteAndMatchStyle') }] : []),
    { separator: true },
    { label: '全选', icon: <TextSelect size={15} />, kbd: 'Ctrl A', onSelect: run('selectAll') }
  ];
}

/** Menu entries for a link (http(s) or mailto). */
export function linkItems(href: string): MenuItem[] {
  if (/^mailto:/i.test(href)) {
    const addr = decodeURIComponent(href.slice(7).split('?')[0] || '');
    return [
      { heading: ellipsize(addr || href, 48) },
      { label: '写邮件', icon: <PenLine size={15} />, onSelect: () => void api.openExternal(href) },
      { label: '复制邮箱地址', icon: <Copy size={15} />, onSelect: () => copy(addr, '邮箱地址已复制') }
    ];
  }
  if (!/^https?:/i.test(href)) return [];
  return [
    { heading: ellipsize(href.replace(/^https?:\/\//i, ''), 52) },
    { label: '在浏览器中打开链接', icon: <ExternalLink size={15} />, onSelect: () => void api.openExternal(href) },
    { label: '复制链接地址', icon: <Link size={15} />, onSelect: () => copy(href, '链接地址已复制') }
  ];
}

/**
 * Builds the menu for a right-click at `target` (in `win`, which is the app window or the e-mail iframe's window).
 * `point` is the click position in app-window coordinates (needed to copy an image).
 */
export function contextItems(target: Element | null, win: Window, point: { x: number; y: number }, inEmail: boolean): MenuItem[] {
  const field = inEmail ? null : editable(target);
  if (field) return editItems(field, win);
  const items: MenuItem[] = [];
  const add = (list: MenuItem[]) => {
    if (!list.length) return;
    if (items.length) items.push({ separator: true });
    items.push(...list);
  };
  // Like browsers: the copy / search entries appear when the right-click lands on the selected text.
  const sel = win.getSelection();
  const selection = sel && target && sel.containsNode(target, true) ? sel.toString().trim() : '';
  if (selection) {
    add([
      { label: '复制', icon: <Copy size={15} />, kbd: 'Ctrl C', onSelect: () => copy(win.getSelection()?.toString() || selection) },
      { label: `搜索“${ellipsize(selection.replace(/\s+/g, ' '), 18)}”`, icon: <Search size={15} />, onSelect: () => searchFor(selection) }
    ]);
  }
  const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (a) add(linkItems(a.href));
  const img = target?.closest?.('img') as HTMLImageElement | null;
  if (img && img.currentSrc && !/^data:image\/gif/i.test(img.currentSrc)) {
    const src = img.currentSrc;
    add([
      { label: '复制图片', icon: <ImageIcon size={15} />, onSelect: () => { void api.copyImageAt(point.x, point.y).then(() => useApp.getState().toast({ kind: 'success', message: '图片已复制', duration: 1600 })); } },
      ...(/^https?:/i.test(src) ? [{ label: '复制图片地址', icon: <Link size={15} />, onSelect: () => copy(src, '图片地址已复制') }] : [])
    ]);
  }
  if (inEmail && !selection) {
    add([{ label: '全选', icon: <TextSelect size={15} />, kbd: 'Ctrl A', onSelect: () => { const d = win.document; d.getSelection()?.selectAllChildren(d.body); } }]);
  }
  return items;
}

function searchFor(text: string) {
  const s = useApp.getState();
  const q = text.replace(/\s+/g, ' ').slice(0, 120);
  s.setSearch(q);
  s.setView({ kind: 'search', query: q }, { keepSearch: true });
}

/** Right-clicks that no component handled get the generic text / link / edit menu. */
export function installGlobalContextMenu(): () => void {
  const onContext = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    const items = contextItems(e.target as Element, window, { x: e.clientX, y: e.clientY }, false);
    if (!items.length) return;
    e.preventDefault();
    showContextMenuAt(items, e.clientX, e.clientY);
  };
  window.addEventListener('contextmenu', onContext);
  return () => window.removeEventListener('contextmenu', onContext);
}

/** Context menu inside the e-mail iframe; coordinates are translated to the app window. */
export function attachFrameContextMenu(iframe: HTMLIFrameElement) {
  const d = iframe.contentDocument;
  const w = iframe.contentWindow;
  if (!d || !w) return;
  d.addEventListener('contextmenu', (e) => {
    const r = iframe.getBoundingClientRect();
    const x = r.left + e.clientX;
    const y = r.top + e.clientY;
    const items = contextItems(e.target as Element, w, { x, y }, true);
    e.preventDefault();
    showContextMenuAt(items, x, y);
  });
  // The iframe keeps the keyboard focus: hand Esc / arrows / Enter to an open menu (it listens on the app window).
  d.addEventListener('keydown', (e) => {
    if (!isContextMenuOpen() || !['Escape', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return;
    e.preventDefault();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true, cancelable: true }));
  });
}

/** Menu for an address shown in the reader (sender, recipients) or the list. */
export function addressMenu(addr: Address, opts: { sender?: boolean; selection?: string } = {}): MenuItem[] {
  const s = useApp.getState();
  const mine = s.accounts.some((a) => a.email.toLowerCase() === addr.address.toLowerCase());
  const full = addr.name ? `${addr.name} <${addr.address}>` : addr.address;
  const items: MenuItem[] = [];
  if (opts.selection) items.push({ label: '复制所选文字', icon: <Copy size={15} />, kbd: 'Ctrl C', onSelect: () => copy(opts.selection!) }, { separator: true });
  items.push(
    { heading: ellipsize(addr.address, 44) },
    { label: '复制邮箱地址', icon: <Copy size={15} />, onSelect: () => copy(addr.address, '邮箱地址已复制') },
    ...(addr.name ? [{ label: '复制姓名和地址', icon: <Copy size={15} />, onSelect: () => copy(full, '已复制') }] : []),
    { separator: true },
    { label: '写邮件', icon: <Mail size={15} />, onSelect: () => s.compose({ to: [addr] }) },
    { label: '搜索往来邮件', icon: <Search size={15} />, onSelect: () => searchFor(`from:${addr.address}`) }
  );
  if (opts.sender && !mine) {
    items.push(
      { separator: true },
      { label: '总是显示此发件人的图片', icon: <UserCheck size={15} />, onSelect: () => { void api.trustSender(addr.address); s.toast({ kind: 'success', message: `今后将自动显示 ${addr.address} 的图片` }); } },
      { label: '删除此发件人的所有邮件', icon: <Trash2 size={15} />, danger: true, onSelect: () => void deleteAllFrom(addr.address) },
      { label: '屏蔽此发件人', icon: <Ban size={15} />, danger: true, onSelect: () => confirmBlock(addr.address) }
    );
  }
  return items;
}

export async function deleteAllFrom(address: string) {
  const s = useApp.getState();
  try {
    const ids = await api.messagesFromSender(address);
    if (!ids.length) { s.toast({ kind: 'info', message: '没有找到此发件人的其他邮件' }); return; }
    s.openModal({
      type: 'confirm',
      title: `删除 ${address} 的所有邮件？`,
      message: `${ids.length} 封邮件将移到「已删除」，可在其中恢复。`,
      confirmLabel: '移到已删除',
      danger: true,
      onConfirm: () => void useApp.getState().act('trash', ids)
    });
  } catch (e) {
    s.toast({ kind: 'error', message: errorMessage(e).title });
  }
}

/** Asks whether to block an address or its whole domain. */
export function confirmBlock(address: string) {
  useApp.getState().openModal({ type: 'block', address });
}
