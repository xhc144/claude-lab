import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bold, Italic, Link2, List, ListOrdered, Quote, RemoveFormatting, Strikethrough, Underline, Type, Check, X } from 'lucide-react';
import { sanitizeForEditor } from '../lib/sanitize';
import { cx, IconButton } from './ui';

export interface RichEditorHandle {
  getHtml(): string;
  setHtml(html: string): void;
  focus(atStart?: boolean): void;
  element(): HTMLDivElement | null;
}

const FONT_SIZES: Array<{ label: string; value: string }> = [
  { label: '小', value: '2' },
  { label: '正常', value: '3' },
  { label: '大', value: '5' }
];

export const RichEditor = React.forwardRef<RichEditorHandle, { initialHtml: string; onChange: () => void; placeholder?: string; onFiles?: (files: File[]) => void }>(
  function RichEditor({ initialHtml, onChange, placeholder, onFiles }, ref) {
    const el = useRef<HTMLDivElement>(null);
    const [, force] = useState(0);
    const [linkMode, setLinkMode] = useState<{ url: string; range: Range | null } | null>(null);

    useEffect(() => {
      if (el.current) el.current.innerHTML = initialHtml;
    }, []);

    useImperativeHandle(ref, () => ({
      getHtml: () => el.current?.innerHTML || '',
      setHtml: (h) => { if (el.current) el.current.innerHTML = h; },
      focus: (atStart = true) => {
        const node = el.current;
        if (!node) return;
        node.focus();
        if (atStart) {
          const r = document.createRange();
          r.setStart(node, 0);
          r.collapse(true);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
      },
      element: () => el.current
    }));

    const exec = (cmd: string, value?: string) => {
      el.current?.focus();
      document.execCommand(cmd, false, value);
      onChange();
      force((n) => n + 1);
    };
    const state = (cmd: string) => {
      try { return document.queryCommandState(cmd); } catch { return false; }
    };

    const startLink = () => {
      const sel = window.getSelection();
      const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      setLinkMode({ url: 'https://', range });
    };
    const applyLink = () => {
      if (!linkMode) return;
      const url = linkMode.url.trim();
      el.current?.focus();
      const sel = window.getSelection();
      if (linkMode.range && sel) { sel.removeAllRanges(); sel.addRange(linkMode.range); }
      if (url && url !== 'https://') {
        if (linkMode.range && !linkMode.range.collapsed) document.execCommand('createLink', false, url);
        else document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>&nbsp;`);
      }
      setLinkMode(null);
      onChange();
    };

    const onPaste = (e: React.ClipboardEvent) => {
      const files = [...e.clipboardData.files];
      if (files.length) {
        const images = files.filter((f) => f.type.startsWith('image/') && f.size < 6 * 1024 * 1024);
        const others = files.filter((f) => !images.includes(f));
        if (images.length || others.length) e.preventDefault();
        for (const img of images) {
          const reader = new FileReader();
          reader.onload = () => { document.execCommand('insertHTML', false, `<img src="${reader.result}" style="max-width:100%">`); onChange(); };
          reader.readAsDataURL(img);
        }
        if (others.length) onFiles?.(others);
        return;
      }
      const html = e.clipboardData.getData('text/html');
      if (html) {
        e.preventDefault();
        const clean = sanitizeForEditor(html)
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\s(class|id)="[^"]*"/g, '');
        document.execCommand('insertHTML', false, clean);
        onChange();
      }
    };

    const btn = (cmd: string, Icon: React.ComponentType<{ size?: number }>, tip: string, kbd?: string) => (
      <IconButton size="s" tip={tip} kbd={kbd} active={state(cmd)} onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}><Icon size={15} /></IconButton>
    );

    return (
      <div className="editor-wrap">
        <div
          ref={el}
          className="editor"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={() => { onChange(); }}
          onKeyUp={() => force((n) => n + 1)}
          onMouseUp={() => force((n) => n + 1)}
          onPaste={onPaste}
          onDrop={(e) => {
            if (e.dataTransfer.files.length) {
              e.preventDefault();
              onFiles?.([...e.dataTransfer.files]);
            }
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); startLink(); }
          }}
          spellCheck={false}
          role="textbox"
          aria-multiline
          aria-label="邮件正文"
        />
        <div className="editor-toolbar" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
          {linkMode ? (
            <div className="link-editor">
              <Link2 size={14} />
              <input autoFocus value={linkMode.url} onChange={(e) => setLinkMode({ ...linkMode, url: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') { e.stopPropagation(); setLinkMode(null); } }} />
              <IconButton size="s" tip="确定" onClick={applyLink}><Check size={14} /></IconButton>
              <IconButton size="s" tip="取消" onClick={() => setLinkMode(null)}><X size={14} /></IconButton>
            </div>
          ) : (
            <>
              {btn('bold', Bold, '粗体', 'Ctrl B')}
              {btn('italic', Italic, '斜体', 'Ctrl I')}
              {btn('underline', Underline, '下划线', 'Ctrl U')}
              {btn('strikeThrough', Strikethrough, '删除线')}
              <span className="tb-sep" />
              <div className="font-size">
                <Type size={14} />
                {FONT_SIZES.map((f) => (
                  <button key={f.value} className={cx('fs-btn')} onMouseDown={(e) => { e.preventDefault(); exec('fontSize', f.value); }}>{f.label}</button>
                ))}
              </div>
              <span className="tb-sep" />
              {btn('insertUnorderedList', List, '项目符号列表')}
              {btn('insertOrderedList', ListOrdered, '编号列表')}
              <IconButton size="s" tip="引用" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'blockquote'); }}><Quote size={15} /></IconButton>
              <IconButton size="s" tip="插入链接" kbd="Ctrl K" onMouseDown={(e) => { e.preventDefault(); startLink(); }}><Link2 size={15} /></IconButton>
              <IconButton size="s" tip="清除格式" onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }}><RemoveFormatting size={15} /></IconButton>
            </>
          )}
        </div>
      </div>
    );
  }
);
