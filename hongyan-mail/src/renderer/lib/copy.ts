// One-click copy: clicking a piece of information (an address, a server name…) copies it and shows a small
// "已复制" bubble right where the user clicked, instead of a toast in the corner. No extra buttons needed.
import { api } from '../api';
import type React from 'react';

let bubble: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** Shows the bubble centred above `anchor` (or at the given point). */
export function showCopiedBubble(anchor: Element | { x: number; y: number }, text = '已复制') {
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'copied-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    document.body.appendChild(bubble);
  }
  const b = bubble;
  b.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  b.appendChild(document.createTextNode(text));
  let x: number;
  let y: number;
  if (anchor instanceof Element) {
    const r = anchor.getBoundingClientRect();
    x = r.left + Math.min(r.width, 220) / 2;
    y = r.top;
  } else {
    x = anchor.x;
    y = anchor.y - 6;
  }
  b.classList.remove('is-shown');
  b.style.left = '0px';
  b.style.top = '0px';
  const w = b.offsetWidth;
  const h = b.offsetHeight;
  const below = y - h - 8 < 4;
  b.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, x - w / 2))}px`;
  b.style.top = `${below ? (anchor instanceof Element ? anchor.getBoundingClientRect().bottom + 6 : y + 18) : y - h - 6}px`;
  b.classList.toggle('is-below', below);
  // restart the entry animation
  void b.offsetWidth;
  b.classList.add('is-shown');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => b.classList.remove('is-shown'), 1200);
}

/** True when the user just finished selecting text inside `el` (then a click must not copy over their selection). */
export function hasSelectionIn(el: Element): boolean {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
  return sel.getRangeAt(0).intersectsNode(el);
}

/** Copies `text` and shows the bubble. Returns false when there was nothing to copy or the clipboard failed. */
export async function copyWithFeedback(text: string, anchor: Element | { x: number; y: number }, label = '已复制'): Promise<boolean> {
  const value = String(text ?? '').trim();
  if (!value) return false;
  try {
    await api.copyText(value);
  } catch {
    try { await navigator.clipboard.writeText(value); } catch { showCopiedBubble(anchor, '复制失败'); return false; }
  }
  showCopiedBubble(anchor, label);
  return true;
}

/**
 * Props that make any element copy `text` when clicked: `<span {...copyOnClick(addr)}>`.
 * A click that ends a text selection, or a modified click, keeps the native behaviour.
 */
export function copyOnClick(text: string | undefined | null, opts: { label?: string; tip?: string; stop?: boolean; focusable?: boolean } = {}) {
  if (!text) return {};
  const focusable = opts.focusable !== false;
  return {
    'data-copyable': '',
    'data-tip': opts.tip ?? `点击复制 ${text.length > 60 ? text.slice(0, 60) + '…' : text}`,
    ...(focusable ? { role: 'button', tabIndex: 0 } : {}),
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (opts.stop !== false) e.stopPropagation();
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || hasSelectionIn(e.currentTarget)) return;
      void copyWithFeedback(text, e.currentTarget, opts.label);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      void copyWithFeedback(text, e.currentTarget, opts.label);
    }
  } as const;
}
